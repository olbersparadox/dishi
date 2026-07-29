/**
 * R&D: replace the duel qualification gate — evidence-count -> unresolved bet.
 *
 * MEASURED PROBLEM (scripts/diagnose-comparison-starvation.ts, 2026-07-28):
 * the current gate requires a contrasting dim with evidence <= 2, but evidence
 * counters only ever grow — at 49 ratings the owner's LOWEST dim is 3, so all
 * 374 strongly-contrasting pairs are killed and selectDuelPair returns null
 * FOREVER. The engine goes quieter the more someone rates: upside down.
 *
 * PROPOSAL under test: qualify by the engine's own inability to call the bet.
 * Every duel already seals a predicted winner + confidence (sigmoid over the
 * content-score gap). A pair where that prediction is a coin flip is precisely
 * the question the engine cannot answer from flicks alone — classic
 * uncertainty sampling, no new state, and structurally incapable of
 * ratcheting shut (SOME pairs are always the least-certain).
 *
 * MEASUREMENTS:
 *   1. predictedP distribution over the contrast-qualified live pairs — how
 *      many sit in the genuinely-uncertain band?
 *   2. Sustained supply: simulate daily serving with all existing exclusions
 *      (recent/answered/lifetime-cap) — how many weeks until starvation?
 *   3. Sanity: the 4 answered duels — did high-p bets go the predicted way?
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/eval-duel-uncertainty.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  contentScore, sigmoid, emptyTaste, DUEL_K, duelContrast,
  type TasteVector,
} from '../src/lib/taste';
import { DUEL_CONTRAST_FLOOR, DUEL_LIFETIME_CAP, type DuelCandidate } from '../src/lib/duels';

const OWNER = '4d1c3ae0-47d9-4cba-b35e-179c134271bf';
const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const [rRes, pRes, dRes] = await Promise.all([
    db.from('ratings').select('dish_id, dishes(id, cuisine, attributes, dish_identity_id, name_zh, name)').eq('user_id', OWNER),
    db.from('taste_profiles').select('vector').eq('user_id', OWNER).maybeSingle(),
    db.from('dish_duels').select('dish_a, dish_b, predicted_winner, predicted_p, winner, tied_at, answered_at').eq('user_id', OWNER),
  ]);
  if (rRes.error || pRes.error || dRes.error) {
    console.error(rRes.error?.message ?? pRes.error?.message ?? dRes.error?.message); process.exit(1);
  }

  const vector: TasteVector = (pRes.data?.vector as TasteVector) ?? emptyTaste();
  const label = new Map<string, string>();
  const candidates: DuelCandidate[] = [];
  for (const r of (rRes.data ?? []) as any[]) {
    const d = r.dishes;
    if (!d?.attributes || Object.keys(d.attributes).length === 0) continue;
    candidates.push({ id: d.id, cuisine: d.cuisine, attributes: d.attributes, identityId: d.dish_identity_id ?? null });
    label.set(d.id, d.name_zh ?? d.name);
  }

  // Contrast-qualified pairs (all structural exclusions except history), with
  // the sealed-bet confidence the production route would compute.
  type Pair = { a: DuelCandidate; b: DuelCandidate; p: number; maxContrast: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      const cuisine = a.cuisine?.toLowerCase();
      if (!cuisine || cuisine === 'unknown' || cuisine !== b.cuisine?.toLowerCase()) continue;
      if (a.identityId && b.identityId && a.identityId === b.identityId) continue;
      const contrast = duelContrast(a.attributes, b.attributes);
      const strong = contrast.filter(c => Math.abs(c.x) >= DUEL_CONTRAST_FLOOR);
      if (!strong.length) continue;
      const sA = contentScore(vector, a.attributes, {});
      const sB = contentScore(vector, b.attributes, {});
      const p = sigmoid(DUEL_K * Math.abs(sA - sB)); // sealed confidence, verbatim
      pairs.push({ a, b, p, maxContrast: Math.max(...strong.map(c => Math.abs(c.x))) });
    }
  }

  console.log(`\n═══ 1. SEALED-BET CONFIDENCE over ${pairs.length} contrast-qualified live pairs ═══`);
  const bands: [string, (p: number) => boolean][] = [
    ['p < 0.55  (coin flip — engine truly cannot call it)', p => p < 0.55],
    ['0.55–0.65 (leaning, far from sure)                 ', p => p >= 0.55 && p < 0.65],
    ['0.65–0.80 (fairly confident)                       ', p => p >= 0.65 && p < 0.8],
    ['p >= 0.80 (settled — asking teaches ~nothing)      ', p => p >= 0.8],
  ];
  for (const [name, f] of bands) console.log(`  ${name}: ${pairs.filter(x => f(x.p)).length}`);

  // ── 2. Sustained supply: serve greedily (most uncertain first), one per day,
  // honouring lifetime cap + never repeating a pair. How long does it last?
  const UNCERTAIN_BAND = 0.65;
  const eligible = pairs.filter(x => x.p < UNCERTAIN_BAND).sort((x, y) => x.p - y.p);
  const lifetime = new Map<string, number>();
  for (const d of (dRes.data ?? []) as any[]) {
    lifetime.set(d.dish_a, (lifetime.get(d.dish_a) ?? 0) + 1);
    lifetime.set(d.dish_b, (lifetime.get(d.dish_b) ?? 0) + 1);
  }
  const servedPairs = new Set<string>((dRes.data ?? []).map((d: any) => pairKey(d.dish_a, d.dish_b)));
  const stream: Pair[] = [];
  for (const pr of eligible) {
    const key = pairKey(pr.a.id, pr.b.id);
    if (servedPairs.has(key)) continue;
    if ((lifetime.get(pr.a.id) ?? 0) >= DUEL_LIFETIME_CAP || (lifetime.get(pr.b.id) ?? 0) >= DUEL_LIFETIME_CAP) continue;
    stream.push(pr);
    servedPairs.add(key);
    lifetime.set(pr.a.id, (lifetime.get(pr.a.id) ?? 0) + 1);
    lifetime.set(pr.b.id, (lifetime.get(pr.b.id) ?? 0) + 1);
  }
  console.log(`\n═══ 2. SUSTAINED SUPPLY (band p < ${UNCERTAIN_BAND}, one/day, lifetime cap ${DUEL_LIFETIME_CAP}, no repeats) ═══`);
  console.log(`  servable stream from TODAY's 49 ratings: ${stream.length} duels (~${Math.floor(stream.length / 7)} weeks at 1/day)`);
  console.log(`  first five the owner would see:`);
  stream.slice(0, 5).forEach(pr =>
    console.log(`    p=${pr.p.toFixed(2)}  ${label.get(pr.a.id)}  vs  ${label.get(pr.b.id)}`));

  // ── 3. Sanity: were the answered high-confidence bets actually right? ──
  console.log(`\n═══ 3. THE 4 ANSWERED DUELS — does sealed confidence track reality? ═══`);
  for (const d of (dRes.data ?? []) as any[]) {
    if (!d.answered_at) continue;
    const outcome = d.tied_at ? 'tie' : (d.winner === d.predicted_winner ? 'predicted RIGHT' : 'predicted WRONG');
    console.log(`  p=${Number(d.predicted_p).toFixed(2)}  ${label.get(d.dish_a) ?? d.dish_a}  vs  ${label.get(d.dish_b) ?? d.dish_b}  ->  ${outcome}`);
  }
})();
