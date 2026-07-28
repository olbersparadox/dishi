// Persona daily content — the pure half: what a persona is allowed to pick,
// and how its line is written.
//
// NO MODEL WRITES THIS TEXT. Phase 0.5 §6 measured a persona inventing three
// restaurants with prices, in character, convincingly — and precomputing a
// daily batch is exactly how that failure would be industrialised. So the line
// is COMPOSED from rows that already exist: the dish's own name, the
// restaurant's own name, and the dish's own strongest attributes. There is no
// slot in it a fact could be invented into. (An LLM may eventually write these
// at precompute time — never at read time — but only behind a check that the
// venue and dish it names are the ones it was handed.)
//
// The personas differ in WORDING only. A curation algorithm that pretended to
// separate them by taste would be theatre at this data density: the honest
// design is one candidate rule everyone can read, and three voices over it.
// Which pick lands on which persona is a stable hash, so a dish doesn't drift
// between characters day to day.

import { dict } from './i18n-dict';
import { PERSONAS, type Persona } from './persona';

/** A dish only becomes a candidate if someone genuinely liked it — the same
 * bar the public page used for anchors before posts replaced them. Below this
 * a "pick" is just a dish that exists. */
export const PERSONA_PICK_MIN_SCORE = 0.5;

/** Per persona, per day. Small on purpose: the feed is not a magazine, and
 * three characters × this many is already more content than a thin pool can
 * honestly support. */
export const PERSONA_PICKS_PER_DAY = 3;

export type PersonaCandidate = {
  dish_id: string;
  restaurant_id: string | null;
  /** From the DB, never from a model. A candidate without one is not a
   * candidate: the venue is the part that must be Places-verified. */
  restaurant: string | null;
  name: string | null;
  name_zh: string | null;
  cuisine: string | null;
  attributes: Record<string, number>;
  score: number;
};

/** Deterministic, dependency-free assignment. Same dish → same persona, every
 * run, so a pick doesn't change character between days. */
export function personaFor(dishId: string): Persona {
  let h = 0;
  for (let i = 0; i < dishId.length; i++) h = (h * 31 + dishId.charCodeAt(i)) >>> 0;
  return PERSONAS[h % PERSONAS.length];
}

/** The two strongest attributes the dish actually reports, as dim KEYS. Absent
 * dims are absent evidence (never "confirmed not present"), so nothing is
 * defaulted in — the same rule contentScore follows. */
export function topDims(attributes: Record<string, number>, n = 2): string[] {
  return Object.entries(attributes ?? {})
    .filter(([, v]) => typeof v === 'number' && v >= 0.6)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

const OPENER: Record<Persona, { zh: string; en: string }> = {
  // Senses first, and pointed at the FOOD — never at the reader (Spoon's hard rule).
  spoon: { zh: '慢慢食一次', en: 'Worth taking slowly' },
  // Simple done right, no put-downs (CK's hard rule).
  ck: { zh: '做啱咗就係好', en: 'Simple, done right' },
  // No hype without receipts (Kiki's hard rule) — hence "someone actually rated it".
  kiki: { zh: '有人真係食過先講', en: 'Someone actually rated it' },
};

/** The stored line, both languages, composed from facts the caller already
 * holds. `restaurant` is required by the type on purpose — a line that can't
 * name a verified venue shouldn't exist. */
export function personaLine(
  persona: Persona,
  c: { name: string | null; name_zh: string | null; restaurant: string; attributes: Record<string, number> },
): { zh: string; en: string } {
  const dims = topDims(c.attributes);
  const label = (k: string, lang: 'zh' | 'en') => dict[`dim.${k}`]?.[lang] ?? k;
  const zhDims = dims.map(d => label(d, 'zh')).join('、');
  const enDims = dims.map(d => label(d, 'en')).join(', ');
  const zhName = c.name_zh ?? c.name ?? '';
  const enName = c.name ?? c.name_zh ?? '';
  return {
    zh: `${OPENER[persona].zh}：${c.restaurant} 嘅${zhName}${zhDims ? `，${zhDims}` : ''}。`,
    en: `${OPENER[persona].en}: ${enName} at ${c.restaurant}${enDims ? ` — ${enDims}` : ''}.`,
  };
}

/**
 * Choose the day's picks from real candidates.
 *
 * Rules, all of them readable in one place:
 *  - a candidate must have a Places-verified restaurant (the caller filters on
 *    place_id) and a real name;
 *  - it must have been genuinely liked by someone (PERSONA_PICK_MIN_SCORE);
 *  - one dish appears once, and one NAME appears once — three shops' 乾炒牛河
 *    on the same day is a list, not a day's picks;
 *  - each persona gets at most PERSONA_PICKS_PER_DAY, assigned by personaFor.
 *
 * Returns rows ready to insert. An empty array is a legitimate outcome — the
 * caller records it as `empty`, which the feed can say out loud.
 */
export function choosePicks(candidates: PersonaCandidate[], day: string) {
  const seenDish = new Set<string>();
  const seenName = new Set<string>();
  const counts: Record<Persona, number> = { spoon: 0, ck: 0, kiki: 0 };
  const rows: {
    persona: Persona; day: string; dish_id: string; restaurant_id: string | null;
    name: string | null; name_zh: string | null; cuisine: string | null;
    attributes: Record<string, number>; line_zh: string; line_en: string;
  }[] = [];

  for (const c of [...candidates].sort((a, b) => b.score - a.score)) {
    if (!c.restaurant) continue;
    if (!c.name && !c.name_zh) continue;
    if (c.score < PERSONA_PICK_MIN_SCORE) continue;
    if (seenDish.has(c.dish_id)) continue;
    const nameKey = (c.name_zh ?? c.name ?? '').trim().toLowerCase();
    if (seenName.has(nameKey)) continue;

    const persona = personaFor(c.dish_id);
    if (counts[persona] >= PERSONA_PICKS_PER_DAY) continue;

    const line = personaLine(persona, {
      name: c.name, name_zh: c.name_zh, restaurant: c.restaurant, attributes: c.attributes,
    });
    rows.push({
      persona, day, dish_id: c.dish_id, restaurant_id: c.restaurant_id,
      name: c.name, name_zh: c.name_zh, cuisine: c.cuisine, attributes: c.attributes ?? {},
      line_zh: line.zh, line_en: line.en,
    });
    seenDish.add(c.dish_id);
    seenName.add(nameKey);
    counts[persona]++;
  }
  return rows;
}
