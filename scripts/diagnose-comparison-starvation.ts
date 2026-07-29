/**
 * R&D diagnosis: why aren't comparison interactions firing? (owner, 2026-07-28)
 *
 * The complaint, from the product's heaviest user at 49 ratings: duels and
 * execution comparisons barely appear — the rating data is "wasted in the
 * back". Comparison is the core product DNA, so a comparison engine that goes
 * QUIETER as someone rates MORE is upside down.
 *
 * This script runs the REAL production gates (selectDuelPair verbatim, the
 * /api/ratings execution-offer conditions re-derived) against the live corpus
 * and attributes every lost pair / lost ask to the specific gate that killed
 * it — so the fix targets the binding constraint, not a guess.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/diagnose-comparison-starvation.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  duelContrast, calibratedScore,
  type EvidenceMap,
} from '../src/lib/taste';
import {
  DUEL_LIFETIME_CAP, DUEL_RECENT_DAYS, DUEL_CONTRAST_FLOOR, DUEL_UNCERTAIN_EVIDENCE,
  selectDuelPair, type DuelCandidate, type ExistingDuelRow,
} from '../src/lib/duels';

const OWNER = '4d1c3ae0-47d9-4cba-b35e-179c134271bf';
const pairKey = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

(async () => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [rRes, pRes, dRes] = await Promise.all([
    db.from('ratings')
      .select('dish_id, score, execution_score, created_at, dishes(id, cuisine, attributes, dish_identity_id, canonical_dish_id, restaurant_id, name, name_zh)')
      .eq('user_id', OWNER).order('created_at', { ascending: true }),
    db.from('taste_profiles').select('vector, evidence, rating_count').eq('user_id', OWNER).maybeSingle(),
    db.from('dish_duels').select('dish_a, dish_b, served_at, answered_at').eq('user_id', OWNER),
  ]);

  for (const [name, res] of [['ratings', rRes], ['profile', pRes], ['duels', dRes]] as const) {
    if ((res as any).error) { console.error(`${name} query failed:`, (res as any).error.message); process.exit(1); }
  }
  const ratings = rRes.data, profile = pRes.data, duelRows = dRes.data;

  const rows = (ratings ?? []) as any[];
  const evidence: EvidenceMap = profile?.evidence ?? {};
  const existing: ExistingDuelRow[] = (duelRows ?? []).map(d => ({
    dish_a: d.dish_a, dish_b: d.dish_b, resolved: !!d.answered_at, served_at: d.served_at,
  }));

  const candidates: DuelCandidate[] = [];
  for (const r of rows) {
    const d = r.dishes;
    if (!d?.attributes || Object.keys(d.attributes).length === 0) continue;
    candidates.push({ id: d.id, cuisine: d.cuisine, attributes: d.attributes, identityId: d.dish_identity_id ?? null });
  }

  console.log(`\n═══ CORPUS ═══`);
  console.log(`  ratings: ${rows.length}   duel candidates (attributed): ${candidates.length}`);
  console.log(`  duels ever served: ${existing.length}   answered: ${existing.filter(e => e.resolved).length}`);
  console.log(`  execution scores ever recorded: ${rows.filter(r => r.execution_score != null).length}`);

  // ── Evidence profile: how "uncertain" does the engine think this user is? ──
  const dims = Object.entries(evidence).sort((a, b) => (a[1] as number) - (b[1] as number));
  console.log(`\n═══ EVIDENCE MAP (duel gate needs a contrasting dim <= ${DUEL_UNCERTAIN_EVIDENCE}) ═══`);
  console.log('  ' + dims.map(([d, v]) => `${d}:${v}`).join('  '));
  console.log(`  dims at or under the uncertainty threshold: ${dims.filter(([, v]) => (v as number) <= DUEL_UNCERTAIN_EVIDENCE).length}/${dims.length}`);

  // ── Duel pair attrition, gate by gate (same order as selectDuelPair) ──
  const now = Date.now();
  const recentCutoff = now - DUEL_RECENT_DAYS * 24 * 60 * 60 * 1000;
  const lifetimeCount = new Map<string, number>();
  const answered = new Set<string>(); const recent = new Set<string>();
  for (const d of existing) {
    lifetimeCount.set(d.dish_a, (lifetimeCount.get(d.dish_a) ?? 0) + 1);
    lifetimeCount.set(d.dish_b, (lifetimeCount.get(d.dish_b) ?? 0) + 1);
    const key = pairKey(d.dish_a, d.dish_b);
    if (d.resolved) answered.add(key);
    if (new Date(d.served_at).getTime() >= recentCutoff) recent.add(key);
  }

  const kills = { cuisineUnknown: 0, cuisineMismatch: 0, lifetimeCap: 0, sameIdentity: 0, alreadyServed: 0, contrastFloor: 0, uncertaintyGate: 0, qualify: 0 };
  let contrastOnlySurvivors = 0; // counterfactual: drop ONLY the uncertainty gate
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j];
      const cuisine = a.cuisine?.toLowerCase();
      if (!cuisine || cuisine === 'unknown' || !b.cuisine || b.cuisine.toLowerCase() === 'unknown') { kills.cuisineUnknown++; continue; }
      if (cuisine !== b.cuisine?.toLowerCase()) { kills.cuisineMismatch++; continue; }
      if ((lifetimeCount.get(a.id) ?? 0) >= DUEL_LIFETIME_CAP || (lifetimeCount.get(b.id) ?? 0) >= DUEL_LIFETIME_CAP) { kills.lifetimeCap++; continue; }
      if (a.identityId && b.identityId && a.identityId === b.identityId) { kills.sameIdentity++; continue; }
      const key = pairKey(a.id, b.id);
      if (answered.has(key) || recent.has(key)) { kills.alreadyServed++; continue; }
      const contrast = duelContrast(a.attributes, b.attributes);
      const strong = contrast.filter(c => Math.abs(c.x) >= DUEL_CONTRAST_FLOOR);
      if (strong.length === 0) { kills.contrastFloor++; continue; }
      contrastOnlySurvivors++;
      if (!strong.some(c => (evidence[c.dim] ?? 0) <= DUEL_UNCERTAIN_EVIDENCE)) { kills.uncertaintyGate++; continue; }
      kills.qualify++;
    }
  }

  const total = (candidates.length * (candidates.length - 1)) / 2;
  console.log(`\n═══ DUEL PAIR ATTRITION — ${total} possible pairs ═══`);
  console.log(`  killed: cuisine unknown     ${kills.cuisineUnknown}`);
  console.log(`  killed: cuisine mismatch    ${kills.cuisineMismatch}`);
  console.log(`  killed: lifetime cap (${DUEL_LIFETIME_CAP})   ${kills.lifetimeCap}`);
  console.log(`  killed: same identity       ${kills.sameIdentity}`);
  console.log(`  killed: already served      ${kills.alreadyServed}`);
  console.log(`  killed: contrast < ${DUEL_CONTRAST_FLOOR}      ${kills.contrastFloor}`);
  console.log(`  killed: uncertainty gate    ${kills.uncertaintyGate}   <- pairs that contrast strongly but every such dim has evidence > ${DUEL_UNCERTAIN_EVIDENCE}`);
  console.log(`  QUALIFY TODAY               ${kills.qualify}`);
  console.log(`  counterfactual — drop only the uncertainty gate: ${contrastOnlySurvivors} pairs qualify`);

  const live = selectDuelPair(candidates, evidence, existing, now);
  console.log(`  selectDuelPair (production, verbatim): ${live ? 'serves a pair' : 'returns NULL — no duel will ever be served again'}`);

  // ── Execution-offer attrition: replay each rating's offer conditions ──
  // /api/ratings: reference requires a rated sibling (canonical or identity);
  // solo anchor requires rating_count >= 10 AND |calibrated| >= 0.35.
  const WARMUP = 10, ANCHOR = 0.35;
  let refAvailable = 0, soloQualifies = 0, neither = 0;
  rows.forEach((r, idx) => {
    const d = r.dishes;
    const prior = rows.filter(o => o.dish_id !== r.dish_id).map(o => o.score as number);
    const cal = calibratedScore(r.score as number, prior);
    const hasSib = rows.some(o => o.dish_id !== r.dish_id && o.dishes && (
      (d?.canonical_dish_id != null && o.dishes.canonical_dish_id === d.canonical_dish_id) ||
      (d?.dish_identity_id != null && o.dishes.dish_identity_id === d.dish_identity_id)
    ));
    if (hasSib) refAvailable++;
    else if (idx + 1 >= WARMUP && Math.abs(cal) >= ANCHOR) soloQualifies++;
    else neither++;
  });
  console.log(`\n═══ EXECUTION OFFER — replayed over ${rows.length} ratings (as the data stands TODAY) ═══`);
  console.log(`  would offer a sibling comparison : ${refAvailable}`);
  console.log(`  would offer the solo anchor      : ${soloQualifies}   (warmup ${WARMUP}, |calibrated| >= ${ANCHOR})`);
  console.log(`  no offer                         : ${neither}`);
  const cals = rows.map(r => Math.abs(calibratedScore(r.score, rows.filter(o => o.dish_id !== r.dish_id).map(o => o.score)))).sort((a, b) => a - b);
  const pct = (p: number) => cals[Math.min(cals.length - 1, Math.floor(p * cals.length))].toFixed(2);
  console.log(`  |calibrated| distribution: p25=${pct(0.25)} p50=${pct(0.5)} p75=${pct(0.75)} p90=${pct(0.9)}`);
})();
