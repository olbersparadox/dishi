import { callClaude, parseJsonResponse } from './openrouter';
import type { DishLike } from './dishIdentity';

// Gate 2 of dish identity resolution (see dishIdentity.ts for the full rationale
// and the real-data evidence that string matching alone provably cannot do this).
//
// The job here is narrow and adversarial: given names that a cheap string
// prefilter already thinks LOOK similar, decide which ones are actually the same
// dish. Because the prefilter is over-inclusive by design, the default answer
// should be "different" — this layer exists to REJECT, not to agree.

const SYSTEM = `You decide whether two restaurant dish names refer to the SAME real-world dish
on the same restaurant's menu, or to two DIFFERENT dishes.

The names come from independent machine guesses (a menu OCR and a photo recognition),
so the same dish is often written with different levels of detail, different wording,
or a different mix of English and Traditional Chinese.

SAME dish — descriptive or stylistic variation of one item:
- "水晶鮮蝦餃" vs "蝦餃" — 水晶/鮮 are appearance/freshness flourishes on one dumpling
- "Steamed shrimp dumpling" vs "Shrimp Dumpling" — cooking method already implied
- "Pan-fried turnip cake" vs "Turnip cake" — same item, one names the default prep

DIFFERENT dishes — a defining ingredient, protein, or preparation actually changes:
- "蝦壽司" vs "壽司" — 蝦 (shrimp) names a specific topping; plain 壽司 is not it
- "軍艦壽司拼盤" vs "壽司" — an assorted platter is a distinct menu item
- "Roast duck rice" vs "Roast duck and char siu rice" — char siu is a real addition
- Any two items a restaurant would price and serve separately

The decisive question is NOT string similarity. It is: would a kitchen hand you the
same plate for both names? A shorter name being contained inside a longer one means
NOTHING on its own — that is true of both examples above and they land differently.

When genuinely unsure, answer "different". A wrong merge is permanent and destroys a
real dish's rating history; a missed merge is harmless and can be fixed later.

Respond with ONLY a JSON array, no prose, no markdown fences. One object per
candidate, in the order given:
[{"id": "<candidate id>", "same": true|false, "confidence": 0.0-1.0}]`;

export type MatchVerdict = { id: string; same: boolean; confidence: number };

/**
 * Only verdicts at or above this bar are ever shown to a human. Set high on
 * purpose: this is the last automated gate before a person is asked to confirm a
 * permanent, history-merging action, and Dishi's standing rule is that no
 * suggestion beats a wrong one.
 */
export const CONFIDENCE_FLOOR = 0.75;

/**
 * Adjudicates prefiltered candidates against a target dish. Returns only the ones
 * the model is confidently sure are the same dish — the caller then asks the human.
 *
 * Fails CLOSED: on any error (no API key, model timeout, malformed JSON, an id the
 * model invented), it returns an empty list. A failure to adjudicate must never
 * degrade into "show them all and let the human sort it out" — that would quietly
 * turn a precision pipeline into the exact false-positive machine this design
 * exists to avoid. Silently asking nothing is the correct failure mode.
 */
export async function adjudicateSameDish(
  target: DishLike,
  candidates: DishLike[],
  restaurantName?: string | null,
): Promise<DishLike[]> {
  if (candidates.length === 0) return [];

  const describe = (d: DishLike) =>
    [d.name, d.name_zh].filter(Boolean).join(' / ');

  const prompt = [
    restaurantName ? `Restaurant: ${restaurantName}` : null,
    `Target dish: ${describe(target)}`,
    '',
    'Candidates:',
    ...candidates.map(c => `- id: ${c.id} — ${describe(c)}`),
  ].filter(Boolean).join('\n');

  const raw = await callClaude(SYSTEM, prompt, { maxTokens: 400 });
  const parsed = parseJsonResponse<MatchVerdict[]>(raw);
  if (!Array.isArray(parsed)) return [];

  const byId = new Map(candidates.map(c => [c.id, c]));
  const accepted: { dish: DishLike; confidence: number }[] = [];
  for (const v of parsed) {
    if (!v || typeof v.id !== 'string') continue;
    const dish = byId.get(v.id); // an id the model made up resolves to nothing — dropped
    if (!dish) continue;
    if (v.same === true && typeof v.confidence === 'number' && v.confidence >= CONFIDENCE_FLOOR) {
      accepted.push({ dish, confidence: v.confidence });
    }
  }
  // Ask about one thing at a time. If the model somehow claims a dish is the same
  // as two DIFFERENT existing dishes, that's a contradiction, not a menu of
  // options — take only its single strongest answer.
  accepted.sort((a, b) => b.confidence - a.confidence);
  return accepted.slice(0, 1).map(a => a.dish);
}
