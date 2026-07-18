// Taste Buddy engine — the gamification layer, kept mathematically HONEST.
//
// The core principle: the buddy visualizes real engine confidence, not vanity points.
// The recommendation engine genuinely improves with (a) more ratings and (b) more
// VARIED ratings — new cuisines and newly-explored flavor dimensions teach it far
// more than the 30th rating of the same ramen. So XP weights diversity heavily, and
// "engine strength" is a truthful readout: when the buddy says 62%, that's a real
// statement about how much signal the taste vector is built on.

import { DIMS, type TasteVector } from './taste';
import { evidenceConfidence, EMERGING_AT } from './tasteExport';

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
// Levels — ONE bar, one meaning: engine confidence ("how much dishi knows"),
// rebased off flick-count XP onto the shared evidenceConfidence scale (spec §2).
// The bar the user sees, the % readout, the export unlock, and the export's own
// honesty note are now all the same number, so they can never disagree.
// ---------------------------------------------------------------------------

/** Dims the profile has real signal on — |preference| clear of noise. */
export function exploredDims(vector: TasteVector): string[] {
  return DIMS.filter(d => Math.abs(vector[d] ?? 0) > 0.15);
}

/** Max of the onboarding endowment (spec §2). Capped low enough that onboarding
 * alone can NEVER reach the export-unlock band — trained signal has to do that. */
export const ONBOARDING_MAX = 0.25;

/**
 * Endowed progress, honestly: credit for REAL early acts that a day-1 user does,
 * so the bar starts visibly non-zero without any fictional prefill. Each credited
 * act genuinely feeds the engine — being here (account), logging a first dish
 * (which IS a first rating in dishi), and getting a few ratings in. No credit for
 * acts that teach the engine nothing, per the 識咗/摸緊 honesty ethos.
 */
export function onboardingCredit(inputs: BuddyInputs): number {
  let c = 0.08;                            // account exists (route is authenticated)
  if (inputs.ratingCount >= 1) c += 0.09;  // first dish logged == first rating
  if (inputs.ratingCount >= 3) c += 0.08;  // genuinely getting going
  return Math.min(ONBOARDING_MAX, c);
}

/**
 * The buddy bar, 0..1. evidenceConfidence carries the LEARNING (shared with the
 * export tier); onboardingCredit layers the head start on top. A maxed profile
 * reaches 1.0; a fresh account with real onboarding acts sits ~0.25; a bare,
 * ratingless account sits at the account floor. Monotonic in ratings/coverage.
 */
export function engineConfidence(inputs: BuddyInputs): number {
  const ev = evidenceConfidence({
    ratingCount: inputs.ratingCount,
    exploredDimCount: exploredDims(inputs.vector).length,
    distinctCuisines: inputs.distinctCuisines,
  });
  return Math.min(1, onboardingCredit(inputs) + ev * (1 - ONBOARDING_MAX));
}

/** The bar confidence at which the export unlocks: evidenceConfidence's 'emerging'
 * point, with the onboarding endowment layered in. Defined from the SAME numbers
 * as engineConfidence so the level boundary and the gate coincide exactly (≈0.50)
 * — no floating-point gap between "reached 為食鬼" and "export unlocked". */
export const UNLOCK_CONFIDENCE = ONBOARDING_MAX + EMERGING_AT * (1 - ONBOARDING_MAX);

/** Confidence bands carrying the SAME level names as before, mapped onto the
 * 0..1 confidence scale. The export unlocks on reaching 為食鬼/Gourmand. */
export const CONFIDENCE_LEVELS = [
  { at: 0.00, name: 'Hatchling', size: 0 },
  { at: 0.14, name: 'Nibbler', size: 1 },
  { at: 0.30, name: 'Taster', size: 2 },
  { at: UNLOCK_CONFIDENCE, name: 'Gourmand', size: 3 },   // export unlock boundary (emerging)
  { at: 0.72, name: 'Connoisseur', size: 4 },
  { at: 0.90, name: 'Legend of the Table', size: 5 },
] as const;

export function levelForConfidence(conf: number) {
  let current: (typeof CONFIDENCE_LEVELS)[number] = CONFIDENCE_LEVELS[0];
  for (const l of CONFIDENCE_LEVELS) if (conf >= l.at) current = l;
  const idx = CONFIDENCE_LEVELS.findIndex(l => l.name === current.name);
  const next = CONFIDENCE_LEVELS[idx + 1] ?? null;
  return {
    name: current.name,
    size: current.size,
    level: idx + 1,
    next: next ? { name: next.name, at: next.at } : null,
    progress: next ? Math.min(1, (conf - current.at) / (next.at - current.at)) : 1,
  };
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
 * Returns a translation key + params so the client renders it in the user's language.
 */
export function growthHint(inputs: BuddyInputs): { key: string; params?: Record<string, number> } {
  if (inputs.ratingCount === 0) return { key: 'buddy.hint.first' };
  if (inputs.ratingCount < 5) return { key: 'buddy.hint.early', params: { n: 5 - inputs.ratingCount } };
  if (inputs.distinctCuisines < 3) return { key: 'buddy.hint.cuisine' };
  const unexplored = DIMS.length - exploredDims(inputs.vector).length;
  if (unexplored > 10) return { key: 'buddy.hint.explore' };
  if (inputs.ratingCount < 25) return { key: 'buddy.hint.tune' };
  return { key: 'buddy.hint.sharp' };
}
