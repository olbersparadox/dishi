// 骨 · Domain evidence — what the palate LIVES ON, aggregated per user.
//
// The creature renderer (creatureForm.ts) has always taken a DomainEvidence
// record; nothing produced one. This is that producer: the missing half of
// ship-path step 2 in docs/rnd/mokling-framework.md.
//
// Everything here reads columns that ALREADY EXIST on rated dishes — no new
// extraction, per the data audit (docs/rnd/data-audit.md). Classifier priority,
// strongest signal first:
//   1. diet flags     — 100% coverage including historical rows, and the 15-flag
//                       vocabulary IS a protein/domain vocabulary
//   2. ingredients    — the only signal that separates 菌 fungus and 藻 algae,
//                       and 龍蝦 from 蟹 inside 甲殼
//   3. name morphemes — a closed, purpose-built list for SUB-NODES only (the
//                       parents are already covered by flags); deliberately not
//                       imported from menuScan's private tripwire arrays, which
//                       answer a different question (is a flag suspicious?)
//
// HONESTY: only mouth-data feeds the being. Every number here traces to a dish
// the person actually ate and rated. Nothing is rolled, nothing is assumed from
// a birth trait, and a dish that says nothing about domain contributes nothing.

import type { DomainEvidence } from './creatureForm';

/** The seven body-plan domains the renderer knows how to draw. */
export const DOMAINS = ['sea', 'land', 'air', 'shell', 'field', 'algae', 'fungus'] as const;
export type Domain = (typeof DOMAINS)[number];

/* ── 1. diet flags → domains ──────────────────────────────────────────────────
   Flags absent from this map are real flags that carry no BODY PLAN meaning:
   egg and dairy are ingredients rather than domains; spicy is temperament (it
   already drives 姿 through the spicy dim); peanut/tree_nut are garnish-scale
   and would make a cashew stir-fry read as a plant being. Silence is correct
   for those — a domain must be what the meal WAS, not what was sprinkled on. */
const FLAG_DOMAINS: Partial<Record<string, Domain>> = {
  pork: 'land', beef: 'land', lamb: 'land', offal: 'land',
  chicken: 'air', duck_goose: 'air',
  seafood: 'sea',
  // 甲殼 sits UNDER 海 in the taxonomy, and the flag vocabulary reflects that:
  // vision tags a crab dish `seafood` AND `shellfish`. Both hits are kept, so a
  // crustacean meal earns some sea character and its claws from the same event,
  // with no special-casing — exactly what the tree implies.
  shellfish: 'shell',
  veg: 'field', soy: 'field',
};

/* ── 2. ingredient words → the nodes only ingredients can see ──────────────────
   菌 and 藻 have no diet flag at all: a mushroom dish is flagged `veg` at best,
   and seaweed usually nothing. The audit named 藻 as a genuine vocabulary gap —
   no seaweed morphemes existed anywhere in the codebase — so this closes it. */
const FUNGUS_WORDS = [
  'mushroom', 'shiitake', 'enoki', 'oyster mushroom', 'porcini', 'truffle',
  'wood ear', 'black fungus', 'king oyster', 'shimeji', 'maitake', 'portobello',
  'button mushroom', 'straw mushroom', 'matsutake',
];
const ALGAE_WORDS = [
  'seaweed', 'nori', 'kelp', 'wakame', 'kombu', 'laver', 'hijiki', 'agar',
  'sea grape', 'dulse', 'irish moss',
];

/* ── 3. sub-node vocabulary — the detail that makes a being SOMEONE's ──────────
   Only used to split a domain the flags have already established, never to
   author a domain on its own: a name is not evidence that a meal happened, the
   rating is. Both scripts, because HK dish names mix them freely.

   ORDER IS LOAD-BEARING — most specific first. 龍蝦 CONTAINS 蝦, so a lobster
   dish matched prawn too until the ordering was added (caught by its own test).
   Each matched term is struck from the string before the next family is tried,
   so a generic morpheme can never re-fire inside a compound that already
   claimed it — the same specific-keys-first discipline ingredientLabel.ts uses,
   and the collision family menuScan's tripwire comments warn about (bare 仁
   inside 蝦仁, bare 果 inside every fruit). A genuinely mixed 龍蝦蝦餃 still
   scores both, because only the 龍蝦 occurrence is consumed. */
const SHELL_SUB: [('lobster' | 'crab' | 'prawn'), string[]][] = [
  ['lobster', ['龍蝦', 'lobster', 'crayfish', 'langoustine', 'scampi']],
  ['crab', ['膏蟹', '花蟹', '蟹', 'crab']],
  ['prawn', ['蝦', 'prawn', 'shrimp', '海老']], // 蝦 last: it lives inside 龍蝦
];
const LAND_SUB: [('beef' | 'pork' | 'chicken'), string[]][] = [
  // no bare 'ham': it fires inside hamburger (a BEEF dish) and hamachi (a fish).
  // 火腿 is the unambiguous Chinese term and carries the real signal here.
  ['pork', ['叉燒', '肉餅', '火腿', '豬', 'pork', 'bacon', 'char siu']],
  ['beef', ['牛', 'beef', 'steak', 'wagyu', 'brisket', 'hamburg']],
  ['chicken', ['雞髀', '雞', 'chicken']],
];

/** What one rated dish says about domains. Weight is split across hits below —
 *  this returns membership only. */
export type DishDomains = {
  domains: Domain[];
  shellSub: ('lobster' | 'crab' | 'prawn')[];
  landSub: ('beef' | 'pork' | 'chicken')[];
};

const hasWord = (hay: string, words: string[]) => words.some(w => hay.includes(w));

/**
 * Classify ONE rated dish. Pure — same row in, same answer out, forever.
 *
 * `prawn` deserves a note: it maps to the 甲殼 domain like crab and lobster, but
 * the shipped claw gestures are only 龍蝦 and 蟹 (creatureGestures.ts). A
 * prawn-dominant palate therefore renders the nearer of the two rather than a
 * fine pincer gesture that does not exist yet. That is the framework's own rule
 * — an undifferentiated node falls back to its parent's gesture, because a
 * wrong claw is worse than no claw.
 */
export function classifyDish(dish: {
  diet?: string[] | null;
  ingredients?: string[] | null;
  name?: string | null;
  name_zh?: string | null;
}): DishDomains {
  const domains = new Set<Domain>();
  for (const f of dish.diet ?? []) {
    const d = FLAG_DOMAINS[f];
    if (d) domains.add(d);
  }

  const ing = (dish.ingredients ?? []).map(i => i.toLowerCase());
  const ingBlob = ing.join(' ');
  if (hasWord(ingBlob, FUNGUS_WORDS)) domains.add('fungus');
  if (hasWord(ingBlob, ALGAE_WORDS)) domains.add('algae');

  // Names are searched for sub-nodes only. Lowercased for the latin half; the
  // Chinese half is case-invariant anyway.
  const nameBlob = `${dish.name ?? ''} ${dish.name_zh ?? ''}`.toLowerCase();
  const searchBlob = `${nameBlob} ${ingBlob}`;

  /** Walks the families most-specific-first, striking each match out of the
   *  string so a generic morpheme cannot re-fire inside a compound that already
   *  claimed it (龍蝦 → lobster, never lobster+prawn). */
  const matchSubs = <K extends string>(table: [K, string[]][], blob: string): K[] => {
    const hits: K[] = [];
    let rest = blob;
    for (const [key, words] of table) {
      const found = words.filter(w => rest.includes(w));
      if (!found.length) continue;
      hits.push(key);
      for (const w of found) rest = rest.split(w).join(' ');
    }
    return hits;
  };

  const shellSub = domains.has('shell') ? matchSubs(SHELL_SUB, searchBlob) : [];
  const landSub = (domains.has('land') || domains.has('air'))
    ? matchSubs(LAND_SUB, searchBlob) : [];

  return { domains: Array.from(domains), shellSub, landSub };
}

/* ── the accumulator ──────────────────────────────────────────────────────────
   "Exposure counts, liking amplifies, dislike carves" — the metabolism rules,
   made arithmetic:

     weight = 0.5 + score     (score is the CALIBRATED flick, −1..1)

   so a neutral meal is worth 0.5 (you ate it), a loved one 1.5, and a genuinely
   disliked one −0.5, which SHRINKS the feature. That last part is the owner's
   metabolism decision ("a few negative ones would shrink the claw"), and it is
   why this is not the lab's `0.5 + max(0, score)`: that version could only ever
   grow, so a palate that turned against lobster kept its claws forever.

   One meal contributes ONE meal's worth: the weight is SPLIT across the domains
   the dish hit, never given to each. Otherwise 蝦餃 (shellfish + pork) would
   count double, and the absolute-evidence floors that gate every feature
   (absF(ev, 5, 7) in creatureForm) would inflate for people who eat mixed
   dishes — which is everyone. */
export const DOMAIN_EXPOSURE = 0.5;

/**
 * Fold one rated dish into a running record. Returns a NEW record (pure), so
 * replay can build the aggregate the same way it builds the vector.
 *
 * `score` must be the CALIBRATED score — the same value the vector learns from
 * — so that a person whose flicks run cold isn't read as disliking everything
 * they eat. Neutral for them is neutral here.
 */
export function accumulateDomains(
  prev: DomainEvidence,
  dish: Parameters<typeof classifyDish>[0],
  score: number,
): DomainEvidence {
  const { domains, shellSub, landSub } = classifyDish(dish);
  if (domains.length === 0) return prev; // says nothing about body plan

  const weight = (DOMAIN_EXPOSURE + score) / domains.length;
  const next: DomainEvidence = { ...prev, sub: { ...prev.sub } };

  for (const d of domains) {
    // Floored at zero: a feature can atrophy to nothing, but negative evidence
    // is not a thing — "less than never eaten" has no meaning, and a negative
    // would flip the share arithmetic in the renderer.
    next[d] = Math.max(0, (prev[d] ?? 0) + weight);
  }

  // Sub-node mixes track only the POSITIVE pull toward a variant: they answer
  // "which crustacean is this person's crustacean", a question a dislike does
  // not re-answer (disliking one crab dish does not make you a lobster eater).
  const subWeight = Math.max(0, DOMAIN_EXPOSURE + score);
  if (shellSub.length && subWeight > 0) {
    const bag = { ...(next.sub?.shell ?? {}) };
    for (const k of shellSub) bag[k] = (bag[k] ?? 0) + subWeight / shellSub.length;
    next.sub = { ...next.sub, shell: bag };
  }
  if (landSub.length && subWeight > 0) {
    const bag = { ...(next.sub?.land ?? {}) };
    for (const k of landSub) bag[k] = (bag[k] ?? 0) + subWeight / landSub.length;
    next.sub = { ...next.sub, land: bag };
  }
  return next;
}

/** Empty is empty: `hasAnatomy` (creatureForm) reads this as "render the blob". */
export function emptyDomainEvidence(): DomainEvidence {
  return {};
}
