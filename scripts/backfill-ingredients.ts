/**
 * One-off, MANUAL backfill of `dishes.ingredients` for legacy PHOTO rows —
 * approved by the owner 2026-08-04 off the data audit (docs/rnd/data-audit.md).
 * NOT a cron. Run once by hand, confirm, then forget it.
 *
 * WHY: `ingredients` is the only persisted signal that can tell 菌 fungus
 * (冬菇/金菇/蠔菇) and 藻 algae apart, and can separate 龍蝦 from 蟹 inside the
 * 甲殼 node. The column is written on every path TODAY, but ~49 rated photo
 * rows predate that write, so those meals are invisible to the creature's
 * deeper nodes. Everything else the aggregate needs (diet flags) is already at
 * 100% coverage — this closes the one real gap.
 *
 * WHAT IT WRITES: `ingredients`, and nothing else. Deliberately narrow.
 * Re-deriving `attributes` would change what the taste engine already learned
 * from these ratings — the vector is built by replaying rating history over
 * stored attributes, so rewriting them retroactively would silently rewrite
 * the person's palate. Same reasoning for name/cuisine/diet: all are either
 * human-authored or already correct. This script must never widen.
 *
 * HOW: `reanalyzeAnchored`, i.e. the photo read ANCHORED on the dish's stored
 * name. Anchoring matters — a stored name may be human-corrected, which is
 * higher authority than a fresh vision guess (nameAuthority: HUMAN > VISION),
 * and an unanchored re-read could return a different dish's ingredients
 * entirely.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/backfill-ingredients.ts              # dry run: report only
 *   npx tsx scripts/backfill-ingredients.ts --limit 5    # bound a first pass
 *   npx tsx scripts/backfill-ingredients.ts --apply      # write
 */
import { supabaseAdmin } from '../src/lib/supabase/server';
import { callClaude, imagePart, textPart } from '../src/lib/openrouter';

/* Ingredients-only read, deliberately NOT reanalyzeAnchored.
 *
 * Two reasons, both discovered while running this backfill (2026-08-04):
 *
 * 1. reasoning MUST be off here, and that is only safe because this asks for
 *    ingredients alone. The live model (qwen3.7-plus, sole provider Alibaba)
 *    currently spends its ENTIRE completion budget on reasoning and returns
 *    null content — verified at 400/500/1500/3000 tokens, so it is not a
 *    budget problem. `reasoning: 'off'` restores real answers. The 2026-07-29
 *    A/B (openrouter.ts) rejected reasoning-off for PRODUCTION because the
 *    diet-flag DERIVATION discipline collapses without it — but that same A/B
 *    records ingredient extraction surviving intact (カキフライ still listed
 *    "oyster"; what broke was deriving the `shellfish` flag FROM it). This
 *    script never reads or writes diet, so the one thing reasoning-off is
 *    known to break is not in scope.
 * 2. Keeping it local means production's vision path is untouched by a
 *    reasoning choice that is only defensible for this narrow use.
 */
const INGREDIENTS_SYSTEM = `You identify the key ingredients of a dish from a photo.
The eater has told you what the dish is — their identification is ground truth and
overrides what the photo might suggest on its own.
Respond with ONLY a JSON object, no markdown fences, no explanation:
{"ingredients": [string]}
Up to 4 key ingredients of the dish as classically prepared, lowercase, English.
Name the ingredients themselves (e.g. "shiitake", "seaweed", "lobster", "pork belly"),
not preparations or seasonings. Empty array if you genuinely cannot tell.`;

async function readIngredients(name: string, base64: string, mediaType: string): Promise<string[] | null> {
  const text = await callClaude(INGREDIENTS_SYSTEM, [
    imagePart(base64, mediaType),
    textPart(`The eater says this dish is: ${name}`),
  ], { maxTokens: 300, expectJson: true, reasoning: 'off' });
  if (!text) return null;
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|^```\s*|```$/g, '').trim());
    if (!Array.isArray(parsed?.ingredients)) return null;
    return parsed.ingredients
      .map((g: unknown) => String(g).trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 4);
  } catch { return null; }
}

const APPLY = process.argv.includes('--apply');
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit');
  return i >= 0 ? Number(process.argv[i + 1]) || 0 : 0;
})();

type Row = {
  id: string; name: string | null; name_zh: string | null;
  photo_url: string | null; source: string | null; ingredients: string[] | null;
};

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required — this backfill needs real vision calls.');
  }
  const admin = supabaseAdmin();

  // Only rows that (a) genuinely lack ingredients and (b) have a photo to read.
  // Rows without a photo cannot be vision-backfilled at all; the audit found
  // those are unrated table picks, which feed no aggregate — correctly skipped.
  const { data, error } = await admin
    .from('dishes')
    .select('id, name, name_zh, photo_url, source, ingredients')
    .not('photo_url', 'is', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const all = (data ?? []) as Row[];
  const missing = all.filter(r => !(r.ingredients?.length));
  const targets = LIMIT > 0 ? missing.slice(0, LIMIT) : missing;

  console.log(`photo rows scanned:        ${all.length}`);
  console.log(`missing ingredients:       ${missing.length}`);
  console.log(`this run will attempt:     ${targets.length}${LIMIT ? ` (--limit ${LIMIT})` : ''}`);
  console.log(`mode:                      ${APPLY ? 'APPLY (writes)' : 'DRY RUN'}\n`);

  if (!APPLY) {
    for (const r of targets) console.log(`  would read: [${r.source}] ${r.name_zh || r.name}`);
    console.log('\nDRY RUN — re-run with --apply to write.');
    return;
  }

  let written = 0, skipped = 0, failed = 0;
  for (const r of targets) {
    const anchor = r.name_zh || r.name;
    if (!anchor || !r.photo_url) { skipped++; continue; }
    try {
      const imgRes = await fetch(r.photo_url);
      if (!imgRes.ok) { console.log(`  SKIP (photo ${imgRes.status}): ${anchor}`); failed++; continue; }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mediaType = imgRes.headers.get('content-type') ?? 'image/jpeg';
      const ingredients = await readIngredients(anchor, buf.toString('base64'), mediaType);

      // A null return or an empty list is a FAILED CALL, not a verdict that the
      // dish has no ingredients. Writing it would replace "unknown" with a
      // confident-looking lie — the exact failure that wiped real diet flags on
      // 2026-07-23 (see backfill-diet-flags.ts). Leave the row untouched.
      if (!ingredients?.length) {
        console.log(`  SKIP (model returned nothing usable): ${anchor}`);
        failed++; continue;
      }
      const out = { ingredients };

      // Re-check emptiness at write time and guard in the predicate too, so a
      // concurrent write (or a second run of this script) can never overwrite
      // real ingredients with a fresh guess.
      const { data: upd, error: upErr } = await admin
        .from('dishes')
        .update({ ingredients: out.ingredients })
        .eq('id', r.id)
        .or('ingredients.is.null,ingredients.eq.{}')
        .select('id');
      if (upErr) { console.error(`  FAILED ${r.id}: ${upErr.message}`); failed++; continue; }
      if (!upd?.length) { console.log(`  SKIP (already filled): ${anchor}`); skipped++; continue; }

      written++;
      console.log(`  ${anchor} -> [${out.ingredients.join(', ')}]`);
    } catch (e) {
      console.error(`  FAILED ${anchor}: ${(e as Error).message}`);
      failed++;
    }
  }

  console.log(`\nwritten: ${written}   skipped: ${skipped}   failed: ${failed}   of ${targets.length}`);
  console.log('Re-run is safe: filled rows are excluded by the same predicate.');
}

main().catch(e => { console.error(e); process.exit(1); });
