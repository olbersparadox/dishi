/**
 * R&D eval: does CONTEXT fix vision naming? (BACKLOG "attribution & naming
 * accuracy" item 3, 2026-08-02)
 *
 * The field miss this measures (owner, 2026-08-02, 一起食堂): the owner scanned
 * the menu (session KE7KK — 和風牛肉烏龍麵 among 31 items), then photographed
 * that very dish; vision guessed 豚骨拉麵/"pork ramen" from pixels alone and the
 * owner retyped the name BY COPYING IT OFF THE MENU THEY HAD ALREADY SCANNED.
 * The right name sat in the DB; nothing joined them.
 *
 * THREE ARMS, so 3a and 3b are judged separately, each against the shipped
 * baseline, on the SAME photos:
 *   A = the shipped SYSTEM prompt, photo only (reproduces current behaviour).
 *   B = 3a: + one locale line in the user turn ("taken near {district}, HK").
 *   C = 3b: + a verbatim-zh candidate shortlist from (1) dish_identities of
 *       restaurants near the photo's EXIF coords and (2) menu_items of scan
 *       sessions near those coords within a recency window. Match first,
 *       open-guess on no-match. The prompt SYSTEM is untouched in all arms —
 *       context rides the user turn, which is exactly how production would
 *       ship it additively.
 *
 * Ground truth: the owner's own album backlog. Two tiers, scored separately:
 *   EDITED   — name_edited_at set: the human typed this zh name. Real truth.
 *   ACCEPTED — vision's name kept as-is. Weak truth (acceptance is not
 *              verification); for these the interesting signal is arm B/C
 *              FLIPPING an answer the owner already accepted (regression risk),
 *              not exact match.
 *
 * Scoring is on name_zh (the menu's verbatim truth). Menu ENGLISH is not a
 * match key by design: the same KE7KK menu prints "Pork Belly Noodles" against
 * 和風牛肉烏龍麵 — loose print or scan mistranslation, either way unreliable.
 * Non-exact answers get an LLM same-dish judgment (name-level, both zh) so
 * "三文魚刺身 vs 三文魚魚生" doesn't score as a miss; the per-case table is
 * printed for owner eyeballing regardless.
 *
 * Arm C's separately-counted failure class, because it gates the design:
 * ADOPTED-WRONG (shortlist name returned, but not the dish). The backlog's
 * pre-agreed kill criterion — a wrong adoption looks authoritative — decides
 * auto-adopt vs the item-5 two-name pick.
 *
 * Session coords: table_sessions carries none today (3b's production wiring
 * adds them at scan time). Eval proxy: a session linked to a restaurant uses
 * the restaurant's coords; KE7KK (unlinked — 一起食堂 didn't exist yet, the
 * exact gap design constraint (1) names) is pinned to 一起食堂's later-created
 * row, justified by the field record placing the scan there.
 *
 * RUN (manual, real LLM calls, ~110 of them):
 *   set -a; source .env.local; set +a
 *   SIM_USER_ID=<owner uuid> npx tsx scripts/eval-vision-naming.ts [--edited-only]
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { callClaude, imagePart, textPart, parseJsonResponse } from '../src/lib/openrouter';
import { VISION_PROMPTS } from '../src/lib/vision';

const SYSTEM = VISION_PROMPTS[0]; // the shipped identify prompt, byte-identical in every arm

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER = process.env.SIM_USER_ID!;
const EDITED_ONLY = process.argv.includes('--edited-only');

// Same spatial scale as the field miss (~100m between EXIF and the scan) with
// slack for urban GPS error. Recency: a scanned menu stays true for days, not
// hours — the window exists to bound shortlist size, not to model menu churn.
const RADIUS_M = 250;
const RECENCY_DAYS = 7;
const SHORTLIST_CAP = 40;

// Field-known session locations for sessions that predate their restaurant row
// (see docstring). Maps session code -> restaurant id whose coords stand in.
const SESSION_COORD_OVERRIDES: Record<string, string> = {
  KE7KK: 'dc2f89b1-6579-47f6-8187-1a63c53ca035', // 一起食堂, Central
};

type Case = {
  id: string;
  truth_zh: string | null;
  truth_en: string;
  tier: 'EDITED' | 'ACCEPTED';
  photo_url: string;
  lat: number; lng: number;
  district: { zh?: string; en?: string } | null;
  when: string; // eaten_at ?? created_at — what "recent" is measured against
  shortlist: string[];
};

const distM = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const dLat = (aLat - bLat) * 111_320;
  const dLng = (aLng - bLng) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
};

// zh comparison must survive spacing, full/half-width punctuation, and the
// scan pipeline's own habit of shedding parentheticals (紅燒牛肉麵（烏龍麵）).
const norm = (s: string | null | undefined) =>
  (s ?? '').replace(/[\s（）()【】\[\]・·，,。.!！?？~～-]/g, '').toLowerCase();

async function main() {
  const sb = createClient(url, key);

  const { data: dishes, error: dErr } = await sb.from('dishes')
    .select('id, name, name_zh, name_edited_at, photo_url, lat, lng, district, eaten_at, created_at, restaurant_id, source')
    .eq('user_id', USER).not('photo_url', 'is', null).not('lat', 'is', null)
    .in('source', ['album', 'photo', 'home'])
    .order('created_at', { ascending: false });
  if (dErr) throw dErr;

  const { data: restaurants } = await sb.from('restaurants').select('id, name, name_zh, lat, lng, district');
  const { data: identities } = await sb.from('dish_identities').select('restaurant_id, name, name_zh');
  const { data: sessions } = await sb.from('table_sessions').select('id, code, restaurant_id, created_at, menu_items');

  const restById = new Map((restaurants ?? []).map((r: any) => [r.id, r]));

  // Where each scan happened, as well as this eval can know it (see docstring).
  const sessionCoords = (sessions ?? []).map((s: any) => {
    const r = restById.get(SESSION_COORD_OVERRIDES[s.code] ?? s.restaurant_id);
    return r?.lat != null ? { ...s, lat: r.lat, lng: r.lng } : null;
  }).filter(Boolean) as any[];

  const cases: Case[] = (dishes ?? [])
    .filter((d: any) => (EDITED_ONLY ? d.name_edited_at : true))
    .map((d: any) => {
      const rest = restById.get(d.restaurant_id);
      const when = d.eaten_at ?? d.created_at;

      const fromIdentities = (identities ?? [])
        .filter((i: any) => {
          const r = restById.get(i.restaurant_id);
          return r?.lat != null && distM(d.lat, d.lng, r.lat, r.lng) <= RADIUS_M;
        })
        .map((i: any) => i.name_zh ?? i.name);

      const fromSessions = sessionCoords
        .filter((s) => distM(d.lat, d.lng, s.lat, s.lng) <= RADIUS_M
          && Math.abs(+new Date(when) - +new Date(s.created_at)) <= RECENCY_DAYS * 86_400_000)
        .flatMap((s) => (s.menu_items ?? []).map((m: any) => m.name_zh ?? m.name_original ?? m.name));

      const shortlist = Array.from(new Set([...fromIdentities, ...fromSessions].filter(Boolean))).slice(0, SHORTLIST_CAP);

      return {
        id: d.id,
        truth_zh: d.name_zh,
        truth_en: d.name,
        tier: d.name_edited_at ? 'EDITED' as const : 'ACCEPTED' as const,
        photo_url: d.photo_url,
        lat: d.lat, lng: d.lng,
        district: d.district ?? rest?.district ?? null,
        when,
        shortlist,
      };
    });

  console.log(`${cases.length} cases (${cases.filter(c => c.tier === 'EDITED').length} EDITED, ${cases.filter(c => c.shortlist.length > 0).length} with a shortlist)\n`);

  const results: any[] = [];
  const pool = 3;
  let idx = 0;
  await Promise.all(Array.from({ length: pool }, async () => {
    while (idx < cases.length) {
      const c = cases[idx++];
      try {
        results.push(await runCase(c));
        process.stdout.write('.');
      } catch (e) {
        console.error(`\ncase ${c.id} failed:`, e);
      }
    }
  }));
  console.log('\n');

  report(results);
  // Real meals in a public repo: same rule as seal-rows.json — local file only,
  // gitignored, for re-analysis without re-spending ~110 LLM calls.
  writeFileSync('scripts/vision-naming-results.json', JSON.stringify(results, null, 1));
  console.log('\nraw per-case output -> scripts/vision-naming-results.json (gitignored)');
}

async function runCase(c: Case) {
  const photoRes = await fetch(c.photo_url);
  if (!photoRes.ok) throw new Error(`photo fetch ${photoRes.status}`);
  const b64 = Buffer.from(await photoRes.arrayBuffer()).toString('base64');
  const mediaType = photoRes.headers.get('content-type') ?? 'image/jpeg';

  const locale = c.district
    ? `Context: this photo was taken near ${[c.district.zh, c.district.en].filter(Boolean).join(' / ')}, Hong Kong.`
    : 'Context: this photo was taken in Hong Kong.';

  const shortlistBlock = c.shortlist.length === 0 ? null :
    `Context: menus scanned near where this photo was taken include these items (verbatim):\n` +
    c.shortlist.map((s, i) => `${i + 1}. ${s}`).join('\n') +
    `\nIf the photographed dish IS one of these menu items, return that item's name as name_zh EXACTLY as printed above. If none of them is this dish, ignore the list and identify freely — do not force a match.`;

  const ask = async (extra: string | null) => {
    const text = await callClaude(SYSTEM, [
      imagePart(b64, mediaType),
      textPart(extra ? `Identify this dish. ${extra}` : 'Identify this dish.'),
    ], { maxTokens: 500, expectJson: true });
    const p = parseJsonResponse<any>(text);
    return p ? { name: String(p.name ?? ''), name_zh: p.name_zh ? String(p.name_zh) : null } : null;
  };

  const [A, B, C] = await Promise.all([ask(null), ask(locale), shortlistBlock ? ask(shortlistBlock) : Promise.resolve(null)]);

  const score = async (out: { name: string; name_zh: string | null } | null) => {
    if (!out) return { verdict: 'CALL-FAILED' as const, out };
    if (!c.truth_zh) return { verdict: 'NO-TRUTH' as const, out };
    if (norm(out.name_zh) === norm(c.truth_zh)) return { verdict: 'EXACT' as const, out };
    return { verdict: (await judgeSameDish(c.truth_zh, out.name_zh ?? out.name)) ? 'SAME-DISH' as const : 'MISS' as const, out };
  };

  // Score C whenever a shortlist EXISTED — a failed C call must read CALL-FAILED,
  // not masquerade as "no shortlist" (it did, in run 1, for 花雕麻油雞湯麵).
  const [sa, sb_, sc] = await Promise.all([score(A), score(B), shortlistBlock ? score(C) : Promise.resolve(null)]);

  // Adoption bookkeeping for arm C's kill-criterion class.
  const adoptedItem = C?.name_zh ? c.shortlist.find(s => norm(s) === norm(C.name_zh)) : undefined;
  const truthOnList = c.truth_zh ? c.shortlist.some(s => norm(s) === norm(c.truth_zh)) : false;

  return {
    id: c.id, tier: c.tier, truth_zh: c.truth_zh, truth_en: c.truth_en,
    shortlist_len: c.shortlist.length, truth_on_list: truthOnList,
    A: sa, B: sb_, C: sc,
    adopted: adoptedItem ?? null,
    adopted_wrong: !!(adoptedItem && c.truth_zh && norm(adoptedItem) !== norm(c.truth_zh)),
  };
}

/** Name-level same-dish judgment, zh-first — deliberately the cheap text call,
 * not another vision call: the question is whether two NAMES denote one dish
 * (三文魚刺身/三文魚魚生), which the cross-venue eval showed this model answers
 * at ~95%+ (docs/rnd/cross-venue-dish-phase0.md). */
async function judgeSameDish(a: string, b: string | null): Promise<boolean> {
  if (!b) return false;
  const text = await callClaude(
    'Two dish names. Answer ONLY {"same": boolean} — same=true if a diner would say they are the same dish (translations, spelling variants, and regional synonyms count as same; a different protein, preparation, or dish type is different).',
    `A: ${a}\nB: ${b}`,
    { maxTokens: 60, expectJson: true },
  );
  return parseJsonResponse<any>(text)?.same === true;
}

function report(results: any[]) {
  const arms = ['A', 'B', 'C'] as const;
  const armName = { A: 'A baseline', B: 'B +locale (3a)', C: 'C +shortlist (3b)' };

  for (const tier of ['EDITED', 'ACCEPTED'] as const) {
    const rows = results.filter(r => r.tier === tier && r.truth_zh);
    if (!rows.length) continue;
    console.log(`\n═══ ${tier} (n=${rows.length}) ═══`);
    for (const arm of arms) {
      const scored = rows.filter(r => r[arm] && r[arm].verdict !== 'CALL-FAILED');
      if (!scored.length) continue;
      const exact = scored.filter(r => r[arm].verdict === 'EXACT').length;
      const same = scored.filter(r => r[arm].verdict === 'SAME-DISH').length;
      console.log(`${armName[arm]}: exact ${exact}/${scored.length}, same-dish ${exact + same}/${scored.length}`);
    }
  }

  const withList = results.filter(r => r.shortlist_len > 0);
  console.log(`\n═══ Arm C adoption (n=${withList.length} with shortlist) ═══`);
  console.log(`truth on list: ${withList.filter(r => r.truth_on_list).length}`);
  console.log(`adopted:       ${withList.filter(r => r.adopted).length}`);
  console.log(`ADOPTED-WRONG: ${withList.filter(r => r.adopted_wrong).length}  <- kill-criterion class`);

  console.log('\n═══ Per-case (EDITED + all shortlist cases) ═══');
  for (const r of results.filter(r => r.tier === 'EDITED' || r.shortlist_len > 0)) {
    console.log(`\n${r.truth_zh ?? r.truth_en}  [${r.tier}${r.shortlist_len ? `, list=${r.shortlist_len}${r.truth_on_list ? ', truth on list' : ''}` : ''}]`);
    for (const arm of arms) {
      const s = r[arm];
      if (!s) continue;
      console.log(`  ${arm}: ${s.verdict.padEnd(11)} ${s.out ? `${s.out.name_zh ?? ''} / ${s.out.name}` : ''}${arm === 'C' && r.adopted ? (r.adopted_wrong ? '  ⚠ ADOPTED-WRONG' : '  ✓ adopted') : ''}`);
    }
  }
}

main();
