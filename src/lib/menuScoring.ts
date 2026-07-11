import { contentScore, toRelativeMatchPercent, type TasteVector, type DishVector, type EvidenceMap } from './taste';
import { DIMS } from './taste';

// Extracted from the old single-phase route so Phase 2 (score/route.ts) can use it,
// and so it's independently testable — deterministic, data-grounded explanations.
// A reason is built from the dims where (user loves it) x (dish has it) is
// strongest. Explainable-AI by construction: if the reason says "deep umami", the
// user's umami preference and the dish's umami presence are both actually high.

const DIM_PHRASES: Record<string, string> = {
  sweet: 'a sweet edge', salty: 'bold saltiness', sour: 'bright acidity', bitter: 'bitter depth',
  umami: 'deep umami', spicy: 'real heat',
  crispy: 'proper crunch', creamy: 'creamy body', chewy: 'satisfying chew', tender: 'melting tenderness',
  rich: 'unapologetic richness', fresh: 'clean freshness',
  fried: 'fried indulgence', grilled: 'char from the grill', braised: 'slow-braised depth',
  steamed: 'delicate steaming', raw: 'raw purity', baked: 'baked comfort',
};

export type ScorableItem = { attributes: DishVector; cuisine: string };

/** A dim may be CITED in a reason/caution only if at least this many ratings have
 * actually taught it. Scores are untouched by this — simulation showed evidence
 * gating has no power to improve predictions — but a written claim like "deep
 * umami, squarely what you keep rating up" is a factual statement about the
 * user's history, and it must never be composed from a dim the history never
 * actually touched. Explanations are held to a stricter honesty bar than numbers. */
export const MIN_CITE_EVIDENCE = 2;
/** A dim may be cited only when the DISH strongly exhibits it. "Deep umami" written
 * about a dish the scoring model gave umami 0.3 is a false claim about the dish even
 * when the preference side is well-evidenced — the real case was a sweet dessert
 * praised for "deep umami" off a 0.3 attribute. Both sides of a written claim now
 * carry an honesty bar: the preference must be evidenced, the attribute must be
 * genuinely present. */
export const MIN_CITE_ATTR = 0.55;
const citable = (d: string, evidence?: EvidenceMap) =>
  evidence === undefined || (evidence[d] ?? 0) >= MIN_CITE_EVIDENCE;

/**
 * FIRE — the single confident mark, replacing displayed match percentages.
 * Symbolic and scale-free by design: qualifies only when the engine can name at
 * least two well-evidenced strong preferences (taste >= 0.35, evidence >= 3) that
 * the dish strongly exhibits (attr >= 0.55), with ZERO evidenced turn-offs present
 * (attr >= 0.5 against taste <= -0.2 with evidence >= 2 vetoes). The criterion IS
 * the explanation — the matching dims are the reason text.
 *
 * Calibration (ground-truth simulation through this real code): P(enjoy | fire)
 * ~87% vs ~50% base rate; P(love | fire) ~53% vs ~21% base rate. Fire rate grows
 * naturally with profile maturity (≈0% at 5 ratings -> ~10% at 40) so cold-start
 * silence is emergent, not a bolted-on gate. Absolute raw-score thresholds were
 * tested and rejected: raw magnitudes don't transfer between simulation and
 * production (different attribute densities), so a raw cutoff calibrated anywhere
 * is miscalibrated everywhere else. Match percentages remain computed in the
 * background for ranking; they are no longer a user-facing claim.
 */
export function deservesFire(item: ScorableItem, taste: TasteVector, evidence: EvidenceMap): boolean {
  let matches = 0;
  for (const d of DIMS) {
    const attr = item.attributes[d] ?? 0;
    const pref = taste[d] ?? 0;
    if (attr >= 0.5 && pref <= -0.2 && (evidence[d] ?? 0) >= MIN_CITE_EVIDENCE) return false; // known turn-off
    if (attr >= MIN_CITE_ATTR && pref >= 0.35 && (evidence[d] ?? 0) >= 3) matches++;
  }
  return matches >= 2;
}

/**
 * Marks at most `maxFires` fire dishes in an already-ranked batch: qualification is
 * symbolic (deservesFire), selection among qualifiers follows the background raw
 * ranking. The cap preserves scarcity — a menu that genuinely suits the person
 * (e.g. a dim sum house for a steamed/umami/tender profile) could qualify half its
 * items, and ten fires is no signal at all.
 */
export function markFires<T extends ScorableItem & { raw_score: number }>(
  ranked: T[], taste: TasteVector, evidence: EvidenceMap, maxFires = 2,
): (T & { fire: boolean })[] {
  const qualifying = ranked
    .filter(i => deservesFire(i, taste, evidence))
    .sort((a, b) => b.raw_score - a.raw_score)
    .slice(0, maxFires);
  const chosen = new Set(qualifying);
  return ranked.map(i => ({ ...i, fire: chosen.has(i) }));
}

export function composeReason(item: ScorableItem, taste: TasteVector, affinity: Record<string, number>, evidence?: EvidenceMap): string {
  const hits = DIMS
    .map(d => ({ d, strength: (taste[d] ?? 0) * (item.attributes[d] ?? 0) }))
    .filter(h => h.strength > 0.12 && (taste[h.d] ?? 0) > 0.15 && (item.attributes[h.d] ?? 0) >= MIN_CITE_ATTR && citable(h.d, evidence))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2);

  const cuisineLove = (affinity[item.cuisine] ?? 0) > 0.3;

  if (hits.length === 0) {
    return cuisineLove
      ? `Your track record with ${item.cuisine} food says try it`
      : 'A wildcard for your palate — nothing here you usually chase';
  }
  const phrases = hits.map(h => DIM_PHRASES[h.d] ?? h.d);
  const core = phrases.length === 2 ? `${cap(phrases[0])} and ${phrases[1]}` : cap(phrases[0]);
  return cuisineLove
    ? `${core} — and it's ${item.cuisine}, which you keep coming back to`
    : `${core} — squarely what you keep rating up`;
}

export function composeCaution(item: ScorableItem, taste: TasteVector, evidence?: EvidenceMap): string | null {
  const warn = DIMS
    .map(d => ({ d, strength: -(taste[d] ?? 0) * (item.attributes[d] ?? 0) }))
    .filter(h => h.strength > 0.2 && (item.attributes[h.d] ?? 0) >= 0.5 && citable(h.d, evidence))
    .sort((a, b) => b.strength - a.strength)[0];
  if (!warn) return null;
  return `Heads up: ${DIM_PHRASES[warn.d] ?? warn.d} — historically not your thing`;
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

/**
 * Score + sort a batch of menu items against a taste profile. `includeReasons`
 * gates the composed explanation strings behind the same training threshold used
 * everywhere else in the app (reasons before the engine has enough signal would be
 * explaining a guess as if it were insight).
 */
export function rankMenuItems<T extends ScorableItem>(
  items: T[],
  taste: TasteVector,
  affinity: Record<string, number>,
  includeReasons: boolean,
  evidence?: EvidenceMap,
): (T & { match: number; raw_score: number; reason: string | null; caution: string | null })[] {
  const withRaw = items.map(item => ({ item, raw: contentScore(taste, item.attributes, affinity, item.cuisine) }));
  const allRaw = withRaw.map(x => x.raw);
  return withRaw
    .map(({ item, raw }) => ({
      ...item,
      match: toRelativeMatchPercent(raw, allRaw),
      raw_score: raw,
      reason: includeReasons ? composeReason(item, taste, affinity, evidence) : null,
      caution: includeReasons ? composeCaution(item, taste, evidence) : null,
    }))
    .sort((a, b) => b.raw_score - a.raw_score);
}
