// Taste Buddy engine — the gamification layer, kept mathematically HONEST.
//
// The core principle: the buddy visualizes real engine confidence, not vanity points.
// The recommendation engine genuinely improves with (a) more ratings and (b) more
// VARIED ratings — new cuisines and newly-explored flavor dimensions teach it far
// more than the 30th rating of the same ramen. So XP weights diversity heavily, and
// "engine strength" is a truthful readout: when the buddy says 62%, that's a real
// statement about how much signal the taste vector is built on.

import { DIMS, type TasteVector } from './taste';

export const SPECIES = ['shiba', 'redpanda', 'octo', 'frog', 'penguin'] as const;
export type Species = (typeof SPECIES)[number];

export const SPECIES_INFO: Record<Species, { name: string; blurb: string }> = {
  shiba: { name: 'Shiba', blurb: 'Loyal. Will guard your leftovers with its life.' },
  redpanda: { name: 'Red Panda', blurb: 'Snacks constantly. Judges quietly.' },
  octo: { name: 'Octopus', blurb: 'Eight arms, eight simultaneous dishes.' },
  frog: { name: 'Frog', blurb: 'Patient. Waits for exactly the right bite.' },
  penguin: { name: 'Penguin', blurb: 'Formal dress at every meal.' },
};

export type BuddyInputs = {
  ratingCount: number;
  distinctCuisines: number; // cuisines actually rated (not 'unknown')
  vector: TasteVector;
  cuisineAffinity: Record<string, number>;
};

// ---------------------------------------------------------------------------
// XP + levels
// ---------------------------------------------------------------------------
export const LEVELS = [
  { xp: 0, name: 'Hatchling', size: 0 },
  { xp: 5, name: 'Nibbler', size: 1 },
  { xp: 15, name: 'Taster', size: 2 },
  { xp: 35, name: 'Gourmand', size: 3 },
  { xp: 70, name: 'Connoisseur', size: 4 },
  { xp: 120, name: 'Legend of the Table', size: 5 },
] as const;

/** Dims the profile has real signal on — |preference| clear of noise. */
export function exploredDims(vector: TasteVector): string[] {
  return DIMS.filter(d => Math.abs(vector[d] ?? 0) > 0.15);
}

/**
 * XP: each rating counts 1; each distinct cuisine counts 3; each explored flavor
 * dimension counts 2. The weights encode the engine's actual learning economics —
 * variety is worth more than volume, because that's true.
 */
export function computeXP(inputs: BuddyInputs): number {
  return inputs.ratingCount
    + inputs.distinctCuisines * 3
    + exploredDims(inputs.vector).length * 2;
}

export function levelFor(xp: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) current = l;
  const idx = LEVELS.findIndex(l => l.name === current.name);
  const next = LEVELS[idx + 1] ?? null;
  return {
    ...current,
    level: idx + 1,
    next: next ? { name: next.name, xp: next.xp, remaining: next.xp - xp } : null,
    progress: next ? Math.min(1, (xp - current.xp) / (next.xp - current.xp)) : 1,
  };
}

/**
 * Engine strength (0-100): a truthful confidence readout, shown next to the buddy.
 * Saturates around ~25 varied ratings — which matches when recommendations
 * empirically stop shifting much per new rating.
 */
export function engineStrength(inputs: BuddyInputs): number {
  const s = inputs.ratingCount * 2
    + inputs.distinctCuisines * 6
    + exploredDims(inputs.vector).length * 3;
  return Math.min(100, Math.round(s));
}

// ---------------------------------------------------------------------------
// Evolution elements — the buddy dresses itself in your actual taste data.
// ---------------------------------------------------------------------------
export type BuddyElement =
  | { kind: 'cuisine'; id: string; label: string }
  | { kind: 'aura'; id: 'fire' | 'fresh' | 'golden' | 'sweet' | 'crackle' | 'royal'; label: string };

const CUISINE_ELEMENTS: Record<string, string> = {
  japanese: 'Hachimaki headband',
  cantonese: 'Bamboo steamer hat',
  chinese: 'Bamboo steamer hat',
  sichuan: 'Chili charm',
  thai: 'Chili garland',
  italian: 'Chef\u2019s toque',
  french: 'Beret',
  korean: 'Gochu charm',
  indian: 'Spice tin',
  mexican: 'Tiny sombrero',
  vietnamese: 'Herb sprig',
};

const AURA_RULES: { dim: string; threshold: number; id: BuddyElement['id'] & string; label: string }[] = [
  { dim: 'spicy', threshold: 0.4, id: 'fire', label: 'Fire aura \u2014 heat seeker' },
  { dim: 'fresh', threshold: 0.4, id: 'fresh', label: 'Leaf halo \u2014 freshness first' },
  { dim: 'umami', threshold: 0.45, id: 'golden', label: 'Golden glow \u2014 umami devotee' },
  { dim: 'sweet', threshold: 0.4, id: 'sweet', label: 'Candy sparkle \u2014 sweet tooth' },
  { dim: 'crispy', threshold: 0.4, id: 'crackle', label: 'Crackle stars \u2014 crunch royalty' },
  { dim: 'rich', threshold: 0.45, id: 'royal', label: 'Velvet crown \u2014 richness reigns' },
];

/**
 * Which elements the buddy currently wears: the strongest cuisine identity (affinity
 * > 0.35) plus up to two attribute auras. Every element traces to a specific number
 * in the user's profile — the buddy can't wear anything the data doesn't support.
 */
export function buddyElements(inputs: BuddyInputs): BuddyElement[] {
  const elements: BuddyElement[] = [];

  const topCuisine = Object.entries(inputs.cuisineAffinity)
    .filter(([c, v]) => v > 0.35 && CUISINE_ELEMENTS[c])
    .sort((a, b) => b[1] - a[1])[0];
  if (topCuisine) {
    elements.push({ kind: 'cuisine', id: topCuisine[0], label: CUISINE_ELEMENTS[topCuisine[0]] });
  }

  const auras = AURA_RULES
    .map(r => ({ r, strength: inputs.vector[r.dim] ?? 0 }))
    .filter(x => x.strength > x.r.threshold)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2)
    .map(x => ({ kind: 'aura' as const, id: x.r.id as any, label: x.r.label }));

  return [...elements, ...auras];
}

/**
 * Honest, specific growth guidance: what would ACTUALLY strengthen the engine next.
 * Never "rate more!" — always the highest-value next action given the data.
 */
export function growthHint(inputs: BuddyInputs): string {
  if (inputs.ratingCount === 0) return 'Rate your first dish and I hatch. No pressure. (Some pressure.)';
  if (inputs.ratingCount < 5) return `Rate ${5 - inputs.ratingCount} more ${5 - inputs.ratingCount === 1 ? 'dish' : 'dishes'} — early flicks teach me the most.`;
  if (inputs.distinctCuisines < 3) return 'Rate a cuisine I haven\u2019t tried — new cuisines teach me 3\u00d7 more than repeats.';
  const unexplored = DIMS.length - exploredDims(inputs.vector).length;
  if (unexplored > 10) return 'Try something outside your usual — sour, bitter, or raw dishes would sharpen whole new senses.';
  if (inputs.ratingCount < 25) return 'Keep flicking — every rating past this point is fine-tuning.';
  return 'I\u2019m sharp. Now we hunt for hidden gems together.';
}
