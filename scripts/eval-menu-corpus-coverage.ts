/**
 * R&D Phase 2: catalog coverage at REAL scale, measured from menu photos.
 *
 * Why this exists — Phase 1 measured 84.9% coverage on 73 dishes from one
 * person's eating history, which is a weak estimate from an eclectic corpus.
 * The number that matters is coverage over real HK MENUS, and the base rate
 * underneath the whole cross-venue feature: how often does the same dish
 * actually appear across different restaurants?
 *
 * Why photos and not the app — the menu-scan route persists NOTHING. Scanned
 * menus live in memory only (src/lib/scanSession.ts, deliberately: they must
 * die on refresh), and only dishes the user PICKS ever become rows. So
 * scanning menus in the app would not build a corpus. This script runs the
 * same pipeline (scanMenuSkeleton) offline, straight off image files, with no
 * app change and no DB writes.
 *
 * HOW TO USE
 *   1. Photograph menus — shop windows, takeaway flyers, anything. No ordering
 *      needed; this measures NAMES, not eating. 15-20 menus is a real sample.
 *   2. Drop the images in  scripts/menu-corpus/  (jpg/png, any filenames).
 *      That directory is gitignored — the photos are not committed.
 *   3. set -a; source .env.local; set +a
 *      npx tsx scripts/eval-menu-corpus-coverage.ts
 *
 * Cost note: one scan call per image, then catalog resolution batched over the
 * unique names. Deduping before resolution is what keeps this cheap — a
 * 20-menu corpus is hundreds of lines but far fewer distinct dishes.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { scanMenuSkeleton } from '../src/lib/menuScan';
import { callClaude, parseJsonResponse } from '../src/lib/openrouter';
import { CATALOG } from './hk-dish-catalog';

const DIR = join(import.meta.dirname, 'menu-corpus');
const CACHE = join(DIR, '_scanned.json');

const SYSTEM = `You map a dish name to an entry in a fixed catalog of common Hong Kong dishes.

The name may be Traditional Chinese, English, a romanisation, or a menu OCR read, and
may carry qualifiers a catalog entry does not: 招牌/特色/精選 (house special),
例牌/大/細 (portion), 日式/港式/星洲 (regional style), 生滾/白灼 (standard method),
鮮/水晶/滑 (flourishes). Strip those and map to the underlying dish.

Map to the SAME entry when the plate is the same dish: a different language or
romanisation, a marketing/portion/style/method/freshness qualifier, or a common
misspelling.

Map to DIFFERENT entries when the plate changes — a different protein, a different
carb vehicle, or a different preparation.

Answer "none" when no entry is the same dish. "none" is CORRECT and expected for
anything the catalog does not cover, INCLUDING when the closest entry is only a
generic category (e.g. do not map 帶子炒飯 onto a generic 炒飯 entry). Do NOT stretch
to the nearest neighbour. A wrong mapping permanently fuses two different dishes'
rating histories; an honest "none" costs nothing.

Respond with ONLY a JSON array, no prose, no fences, one object per input IN ORDER:
[{"i": <index>, "id": "<catalog id>" | "none"}]`;

const catalogBlock = CATALOG.map(e => `${e.id} | ${e.zh} | ${e.en}`).join('\n');
const VALID = new Set(CATALOG.map(e => e.id));
const BATCH = 8;

type Scanned = { menu: string; names: string[] };

async function scanAll(): Promise<Scanned[]> {
  // Cache scans so re-running the ANALYSIS (the cheap half) never re-pays for
  // vision calls (the expensive half). Delete _scanned.json to force a rescan.
  if (existsSync(CACHE)) {
    console.log('  using cached scans (delete scripts/menu-corpus/_scanned.json to rescan)');
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  }
  const files = readdirSync(DIR).filter(f => ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(f).toLowerCase()));
  if (!files.length) {
    console.error(`\n  No images in ${DIR}\n  Add menu photos and re-run — see the header of this file.\n`);
    process.exit(1);
  }
  const out: Scanned[] = [];
  for (const f of files) {
    const bytes = readFileSync(join(DIR, f));
    const mediaType = extname(f).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    try {
      const res = await scanMenuSkeleton(bytes.toString('base64'), mediaType);
      const names = (res.items ?? []).map(i => [i.name_zh, i.name].filter(Boolean).join(' / ')).filter(Boolean);
      out.push({ menu: f, names });
      console.log(`  ${f}: ${names.length} items`);
    } catch (e) {
      console.error(`  ${f}: scan FAILED — ${(e as Error).message}`);
    }
  }
  writeFileSync(CACHE, JSON.stringify(out, null, 2));
  return out;
}

async function resolveNames(names: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let s = 0; s < names.length; s += BATCH) {
    const slice = names.slice(s, s + BATCH);
    const user = [
      'CATALOG (id | 中文 | English):', catalogBlock, '',
      'Dish names to map:', ...slice.map((n, k) => `${s + k}. ${n}`),
    ].join('\n');
    const raw = await callClaude(SYSTEM, user, { maxTokens: 6000, expectJson: true });
    const parsed = parseJsonResponse<{ i: number; id: string }[]>(raw);
    if (!Array.isArray(parsed)) { console.error(`  resolve batch @${s} unusable`); continue; }
    for (const r of parsed) {
      if (!r || typeof r.i !== 'number' || !names[r.i]) continue;
      map.set(names[r.i], r.id);
    }
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return map;
}

(async () => {
  console.log('\n═══ scanning menu photos ═══');
  const menus = await scanAll();
  const totalLines = menus.reduce((a, m) => a + m.names.length, 0);

  // Dedupe before resolving — this is what keeps the cost sane.
  const unique = Array.from(new Set(menus.flatMap(m => m.names)));
  console.log(`\n  ${menus.length} menus · ${totalLines} lines · ${unique.length} distinct names`);

  console.log('\n═══ resolving against the catalog ═══');
  const resolved = await resolveNames(unique);

  // ── 1. COVERAGE ────────────────────────────────────────────────────────
  let mapped = 0, none = 0, invalid = 0;
  const gaps = new Map<string, number>();
  for (const m of menus) {
    for (const n of m.names) {
      const id = resolved.get(n);
      if (id === undefined) continue;
      if (id === 'none') { none++; gaps.set(n, (gaps.get(n) ?? 0) + 1); }
      else if (!VALID.has(id)) { invalid++; }
      else mapped++;
    }
  }
  const scored = mapped + none + invalid;
  console.log('\n═══ 1. COVERAGE (by menu line, weighted by how often it appears) ═══');
  console.log(`  mapped  : ${mapped}/${scored}  (${scored ? ((mapped / scored) * 100).toFixed(1) : '0'}%)`);
  console.log(`  "none"  : ${none}`);
  if (invalid) console.log(`  INVALID ids (hallucinated): ${invalid}  <- must be 0`);

  // ── 2. CROSS-VENUE BASE RATE — the number this whole feature rests on ──
  const venuesById = new Map<string, Set<string>>();
  for (const m of menus) {
    for (const n of m.names) {
      const id = resolved.get(n);
      if (!id || id === 'none' || !VALID.has(id)) continue;
      if (!venuesById.has(id)) venuesById.set(id, new Set());
      venuesById.get(id)!.add(m.menu);
    }
  }
  const multi = Array.from(venuesById.entries()).filter(([, v]) => v.size > 1).sort((a, b) => b[1].size - a[1].size);
  console.log('\n═══ 2. CROSS-VENUE BASE RATE ═══');
  console.log(`  canonical dishes seen        : ${venuesById.size}`);
  console.log(`  seen at 2+ different menus   : ${multi.length}  (${venuesById.size ? ((multi.length / venuesById.size) * 100).toFixed(1) : '0'}%)`);
  console.log('  ── most widely offered ──');
  multi.slice(0, 15).forEach(([id, v]) => {
    const e = CATALOG.find(c => c.id === id)!;
    console.log(`    ${String(v.size).padStart(2)} menus  ${e.zh} (${id})`);
  });
  if (!multi.length) console.log('    none — with few menus this is expected; add more.');

  // ── 3. RESOLUTION CONSISTENCY — do variants converge on one id? ────────
  const variantsById = new Map<string, Set<string>>();
  for (const [name, id] of Array.from(resolved.entries())) {
    if (id === 'none' || !VALID.has(id)) continue;
    if (!variantsById.has(id)) variantsById.set(id, new Set());
    variantsById.get(id)!.add(name);
  }
  const merged = Array.from(variantsById.entries()).filter(([, v]) => v.size > 1).sort((a, b) => b[1].size - a[1].size);
  console.log('\n═══ 3. RESOLUTION CONSISTENCY — distinct spellings folded onto one id ═══');
  console.log('  (EYEBALL THESE: every line is a merge that would become permanent.)');
  merged.slice(0, 20).forEach(([id, v]) => {
    console.log(`    ${id}:`);
    Array.from(v).forEach(n => console.log(`        ${n}`));
  });
  if (!merged.length) console.log('    no multi-variant merges in this corpus.');

  console.log('\n═══ 4. CATALOG GAPS — most frequent unmapped names ═══');
  Array.from(gaps.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25)
    .forEach(([n, c]) => console.log(`    ${String(c).padStart(3)}x  ${n}`));
})();
