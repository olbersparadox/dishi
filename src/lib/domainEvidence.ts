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
// 田雞 (frog) is struck to NOTHING before any family runs — not mapped to a
// domain (frog has no taxonomy node today), just removed so the bare 雞
// morpheme below cannot misread it as chicken. Global, not LAND_SUB-scoped:
// frog has no other claim in this vocabulary either.
const VOID_WORDS = ['田雞'];
const LAND_SUB: [('beef' | 'pork' | 'chicken' | 'lamb'), string[]][] = [
  // no bare 'ham': it fires inside hamburger (a BEEF dish) and hamachi (a fish).
  // 火腿 is the unambiguous Chinese term and carries the real signal here.
  ['pork', ['叉燒', '肉餅', '火腿', '豬', 'pork', 'bacon', 'char siu']],
  ['beef', ['牛', 'beef', 'steak', 'wagyu', 'brisket', 'hamburg']],
  ['chicken', ['雞髀', '雞', 'chicken']], // 田雞 already struck — see VOID_WORDS
  ['lamb', ['羊', 'lamb', 'mutton']],
];
/* ── G3 additions (growth R&D Decision 4) — air/sea/field sub-nodes ────────────
   Same discipline as above: split a domain the flags/ingredients already
   established, never author one. */

// air: FLAG-derived, not morpheme — chicken vs duck_goose is exactly the split
// FLAG_DOMAINS already makes and discards, so reading dish.diet again is
// cheaper and more reliable than searching the name for it.
const AIR_FLAGS: ('chicken' | 'duck_goose')[] = ['chicken', 'duck_goose'];

// sea: fish vs cephalopod (軟體 mollusc). ORDER LOAD-BEARING, same reason as
// SHELL_SUB — every Chinese cephalopod word CONTAINS 魚 (八爪魚, 章魚, 墨魚),
// so cephalopod must strike first or its own 魚 gets claimed by the generic
// fish entry first. 魚香 (fish-fragrant — no fish in the dish) is voided
// globally for the same reason 田雞 is: it is not a false SEA_SUB hit, it is
// a false SEA hit waiting to happen the moment fish vocabulary broadens.
VOID_WORDS.push('魚香');
const SEA_SUB: [('cephalopod' | 'fish'), string[]][] = [
  ['cephalopod', ['八爪魚', '章魚', '魷魚', '魷', '墨魚', 'octopus', 'squid', 'calamari']],
  ['fish', [
    '魚', 'fish', '三文魚', 'salmon', '吞拿魚', 'tuna', '刺身', 'sashimi',
    '鰻', '鱔', 'eel', '鱈魚', 'cod', '鯛魚', '鯖魚', 'saba', '油甘', 'hamachi',
  ]],
];

// field: leaf/root/soy. soy is FLAG-derived (free — the `soy` diet flag is
// already an unambiguous positive); leaf/root are morphemes, no ordering
// conflict between them (disjoint ingredient vocabularies).
const FIELD_SUB: [('leaf' | 'root'), string[]][] = [
  ['leaf', ['菠菜', '芥蘭', '生菜', '白菜', '通菜', '西洋菜', '西蘭花',
    'spinach', 'lettuce', 'kale', 'choy', 'bok choy', 'broccoli']],
  ['root', ['薯', '蘿蔔', '蓮藕', '芋', '山藥', '番薯',
    'potato', 'carrot', 'lotus root', 'taro', 'yam', 'sweet potato']],
];

/** What one rated dish says about domains. Weight is split across hits below —
 *  this returns membership only. */
export type DishDomains = {
  domains: Domain[];
  shellSub: ('lobster' | 'crab' | 'prawn')[];
  landSub: ('beef' | 'pork' | 'chicken' | 'lamb')[];
  airSub: ('chicken' | 'duck_goose')[];
  seaSub: ('cephalopod' | 'fish')[];
  fieldSub: ('leaf' | 'root' | 'soy')[];
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
  // Chinese half is case-invariant anyway. VOID_WORDS strike FIRST and
  // globally — they are not a hit for anything, just compounds a later,
  // broader family would otherwise misread (田雞 as 雞, 魚香 as fish).
  const nameBlob = `${dish.name ?? ''} ${dish.name_zh ?? ''}`.toLowerCase();
  let searchBlob = `${nameBlob} ${ingBlob}`;
  for (const w of VOID_WORDS) searchBlob = searchBlob.split(w).join(' ');

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

  const dietSet = new Set(dish.diet ?? []);

  const shellSub = domains.has('shell') ? matchSubs(SHELL_SUB, searchBlob) : [];
  // lamb differs from beef/pork/chicken in this same table: the doc calls it
  // out as flag-OR-morpheme, since (unlike the others) `lamb` is already an
  // unambiguous single-species flag — no need to make it wait for a name.
  const landSub = (domains.has('land') || domains.has('air'))
    ? Array.from(new Set([
      ...matchSubs(LAND_SUB, searchBlob),
      ...(dietSet.has('lamb') ? ['lamb' as const] : []),
    ]))
    : [];

  // air: flag only — no name search. FLAG_DOMAINS already reads chicken vs
  // duck_goose separately and discards which one fired; this just keeps it.
  const airSub = domains.has('air') ? AIR_FLAGS.filter(f => dietSet.has(f)) : [];

  // sea: cephalopod/fish by morpheme, only once 海 itself is established.
  const seaSub = domains.has('sea') ? matchSubs(SEA_SUB, searchBlob) : [];

  // field: soy is the flag (free, unambiguous); leaf/root are morphemes.
  // Both feed the SAME bag — a dish can be soy AND leafy (豆苗, pea shoots).
  const fieldSub: ('leaf' | 'root' | 'soy')[] = domains.has('field')
    ? [...(dietSet.has('soy') ? ['soy' as const] : []), ...matchSubs(FIELD_SUB, searchBlob)]
    : [];

  return { domains: Array.from(domains), shellSub, landSub, airSub, seaSub, fieldSub };
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
/** Folds one family's hits into its bag, splitting subWeight evenly — the
 *  shared body five call sites used to repeat by hand. Returns `bag`
 *  unchanged (not a copy) when there is nothing to add, so a dish that
 *  doesn't touch a family never even allocates for it. */
function foldSub<K extends string>(
  bag: Partial<Record<K, number>> | undefined, hits: K[], subWeight: number,
): Partial<Record<K, number>> | undefined {
  if (!hits.length || subWeight <= 0) return bag;
  const next: Partial<Record<K, number>> = { ...(bag ?? {}) };
  for (const k of hits) next[k] = (next[k] ?? 0) + subWeight / hits.length;
  return next;
}

export function accumulateDomains(
  prev: DomainEvidence,
  dish: Parameters<typeof classifyDish>[0],
  score: number,
): DomainEvidence {
  const { domains, shellSub, landSub, airSub, seaSub, fieldSub } = classifyDish(dish);
  if (domains.length === 0) return prev; // says nothing about body plan

  const weight = (DOMAIN_EXPOSURE + score) / domains.length;
  const next: DomainEvidence = { ...prev };

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
  const shell = foldSub(prev.sub?.shell, shellSub, subWeight);
  const land = foldSub(prev.sub?.land, landSub, subWeight);
  const air = foldSub(prev.sub?.air, airSub, subWeight);
  const sea = foldSub(prev.sub?.sea, seaSub, subWeight);
  const field = foldSub(prev.sub?.field, fieldSub, subWeight);
  if (shell || land || air || sea || field) {
    next.sub = {
      ...prev.sub,
      ...(shell && { shell }), ...(land && { land }), ...(air && { air }),
      ...(sea && { sea }), ...(field && { field }),
    };
  }
  return next;
}

/** Empty is empty: `hasAnatomy` (creatureForm) reads this as "render the blob". */
export function emptyDomainEvidence(): DomainEvidence {
  return {};
}

/* ── the TIMED record — G1 of the growth program ──────────────────────────────
   docs/rnd/mokling-growth-rnd.md, Decision 2. The metabolism (萎 atrophy,
   蛻 shed) needs evidence that FADES, and the plain record above cannot say
   when anything happened. This record carries {v, at} per node — evidence v as
   of feeding-time `at` — and decays it as a continuous-time EMA:

     decay(v, Δt) = v · 2^(−Δt / HALF_LIFE)

   The clock is FEEDING time (the rating's created_at): the creature is fed by
   the act of rating, so a 2023 photo rated tonight feeds at full strength
   tonight. Eaten-date discounting was proposed and REJECTED by the owner
   (2026-08-06) — old photos never count less; do not re-key this to eaten_at.

   Still a pure function — of (history, asOf) — so replay rebuilds it and a
   re-rate heals the body exactly as it heals the palate. Written ALONGSIDE the
   plain record; nothing in production reads it until G2 switches the renderer
   to `domainsAsOf`. Both accumulators run from the same classifyDish/weight
   arithmetic, so with all events at one instant the two records agree exactly
   — pinned by test. */

/** ~120 days: stable day-to-day, transforms over seasons. G2's harness slider
 *  is where the owner tunes it — change it there, not casually here. */
export const DOMAIN_HALF_LIFE_MS = 120 * 24 * 60 * 60 * 1000;

/** 對決 verdicts: `"family:x|y" -> net`, positive = x leads. See the 對決
 *  section below for why these are pairwise, direct, and never decayed. */
export type DuelVerdicts = Record<string, number>;

export type TimedNode = { v: number; at: number };
export type DomainEvidenceT = {
  nodes?: Partial<Record<Domain, TimedNode>>;
  sub?: {
    shell?: Partial<Record<'lobster' | 'crab' | 'prawn', TimedNode>>;
    land?: Partial<Record<'beef' | 'pork' | 'chicken' | 'lamb', TimedNode>>;
    air?: Partial<Record<'chicken' | 'duck_goose', TimedNode>>;
    sea?: Partial<Record<'cephalopod' | 'fish', TimedNode>>;
    field?: Partial<Record<'leaf' | 'root' | 'soy', TimedNode>>;
  };
  /** 對決 verdicts ride along UNDECAYED — a verdict is a statement, not an
   *  exposure, so it carries no {v, at}. Kept on this record too (not only the
   *  plain one) so `domainsAsOf` can hand the renderer everything it needs. */
  duels?: DuelVerdicts;
};

const decayV = (v: number, dtMs: number): number =>
  v * Math.pow(2, -Math.max(0, dtMs) / DOMAIN_HALF_LIFE_MS);

/** Decay-then-add against one node. `at` may only move forward — replay walks
 *  events in feeding order, and a clamped Δt keeps clock skew harmless. */
function feedNode(prev: TimedNode | undefined, atMs: number, weight: number): TimedNode {
  const decayed = prev ? decayV(prev.v, atMs - prev.at) : 0;
  return { v: Math.max(0, decayed + weight), at: prev ? Math.max(prev.at, atMs) : atMs };
}

/** Timed sibling of foldSub: same even-split-over-hits arithmetic, decayed
 *  instead of summed. Returns `bag` unchanged when there's nothing to fold. */
function foldSubT<K extends string>(
  bag: Partial<Record<K, TimedNode>> | undefined, hits: K[], subWeight: number, atMs: number,
): Partial<Record<K, TimedNode>> | undefined {
  if (!hits.length || subWeight <= 0) return bag;
  const next: Partial<Record<K, TimedNode>> = { ...(bag ?? {}) };
  for (const k of hits) next[k] = feedNode(next[k], atMs, subWeight / hits.length);
  return next;
}

/** Fold one rated dish into the timed record. Same classify, same weight
 *  arithmetic as accumulateDomains — the records may never disagree about
 *  WHAT was eaten, only about how much of it time has kept. */
export function accumulateDomainsT(
  prev: DomainEvidenceT,
  dish: Parameters<typeof classifyDish>[0],
  score: number,
  atMs: number,
): DomainEvidenceT {
  const { domains, shellSub, landSub, airSub, seaSub, fieldSub } = classifyDish(dish);
  if (domains.length === 0) return prev;

  const weight = (DOMAIN_EXPOSURE + score) / domains.length;
  const nodes = { ...(prev.nodes ?? {}) };
  for (const d of domains) nodes[d] = feedNode(nodes[d], atMs, weight);
  const next: DomainEvidenceT = { ...prev, nodes };

  const subWeight = Math.max(0, DOMAIN_EXPOSURE + score);
  const shell = foldSubT(prev.sub?.shell, shellSub, subWeight, atMs);
  const land = foldSubT(prev.sub?.land, landSub, subWeight, atMs);
  const air = foldSubT(prev.sub?.air, airSub, subWeight, atMs);
  const sea = foldSubT(prev.sub?.sea, seaSub, subWeight, atMs);
  const field = foldSubT(prev.sub?.field, fieldSub, subWeight, atMs);
  if (shell || land || air || sea || field) {
    next.sub = {
      ...prev.sub,
      ...(shell && { shell }), ...(land && { land }), ...(air && { air }),
      ...(sea && { sea }), ...(field && { field }),
    };
  }
  return next;
}

/** The read adapter: decay every node to `nowMs` and emit the plain
 *  DomainEvidence shape the renderer has always eaten. G2's consumers call
 *  this; the renderer contract itself never changes. A missing / legacy /
 *  empty record yields {} — hasAnatomy reads that as "render the blob", so
 *  the door fails closed exactly as it always has. */
export function domainsAsOf(t: DomainEvidenceT | null | undefined, nowMs: number): DomainEvidence {
  if (!t?.nodes) return {};
  const out: DomainEvidence = {};
  for (const d of DOMAINS) {
    const n = t.nodes[d];
    if (n && n.v > 0) out[d] = decayV(n.v, nowMs - n.at);
  }
  const readBag = <K extends string>(bag: Partial<Record<K, TimedNode>> | undefined) => {
    if (!bag) return undefined;
    const o: Partial<Record<K, number>> = {};
    let any = false;
    for (const k of Object.keys(bag) as K[]) {
      const n = bag[k];
      if (n && n.v > 0) { o[k] = decayV(n.v, nowMs - n.at); any = true; }
    }
    return any ? o : undefined;
  };
  if (t.duels && Object.keys(t.duels).length) out.duels = t.duels;
  const shell = readBag(t.sub?.shell);
  const land = readBag(t.sub?.land);
  const air = readBag(t.sub?.air);
  const sea = readBag(t.sub?.sea);
  const field = readBag(t.sub?.field);
  if (shell || land || air || sea || field) {
    out.sub = {
      ...(shell && { shell }), ...(land && { land }), ...(air && { air }),
      ...(sea && { sea }), ...(field && { field }),
    };
  }
  return out;
}

export function emptyDomainEvidenceT(): DomainEvidenceT {
  return {};
}

/* ── 對決 verdicts — G9: the duel breaks a contested tie ───────────────────────
   Owner, 2026-08-06: "if a crab dish and a lobster dish is being compared and
   user chooses crab, then the crab claw wins."

   Eating tells us HOW MUCH of each variant; it cannot tell us which one a
   person would pick when they eat both equally. A duel asks exactly that
   question and gets an explicit answer, so it is the honest instrument for a
   contested sub-node — and it is already replayed history, so the body stays a
   pure function of what the person did.

   Stored as a flat map, `"family:x|y" -> net`, x<y lexicographically, positive
   meaning x leads. Deliberately PAIRWISE and DIRECT — no transitive inference
   (crab beating prawn says nothing about crab vs lobster; taste is not
   transitive, and guessing here would invent a verdict the person never gave).

   NOT decayed, unlike evidence. A verdict is a statement, not an exposure, and
   it only ever applies INSIDE the dead zone — when eating genuinely shifts, the
   share leaves the dead zone and dominance overrides the verdict anyway. So an
   old answer can never outvote present-tense eating; it only speaks when eating
   is silent. */

/** Every family whose variants a gesture can choose between. */
const DUEL_FAMILIES = ['shell', 'land', 'air', 'sea', 'field'] as const;

export const duelKey = (family: string, x: string, y: string): string =>
  x < y ? `${family}:${x}|${y}` : `${family}:${y}|${x}`;

/** The variants a dish resolves to, per family. */
function familyVariants(d: DishDomains): Record<string, string[]> {
  return {
    shell: d.shellSub, land: d.landSub, air: d.airSub,
    sea: d.seaSub, field: d.fieldSub,
  };
}

/**
 * Fold ONE answered duel into the verdict map. Pure.
 *
 * A side only counts when it resolves to EXACTLY ONE variant in that family:
 * a 龍蝦蝦餃 is both lobster and prawn, and a muddy side makes a muddy verdict.
 * A 揀唔落 TIE records nothing at all — the person said they could not choose,
 * and manufacturing a winner out of that would be a lie.
 */
export function accumulateDuel(
  prev: DuelVerdicts,
  winnerDish: Parameters<typeof classifyDish>[0],
  loserDish: Parameters<typeof classifyDish>[0],
  isTie: boolean,
): DuelVerdicts {
  if (isTie) return prev;
  const w = familyVariants(classifyDish(winnerDish));
  const l = familyVariants(classifyDish(loserDish));
  let next = prev;
  for (const fam of DUEL_FAMILIES) {
    const wv = w[fam], lv = l[fam];
    if (wv.length !== 1 || lv.length !== 1) continue;  // ambiguous side
    if (wv[0] === lv[0]) continue;                     // same variant, no contest
    const key = duelKey(fam, wv[0], lv[0]);
    // positive means the lexicographically-first variant leads
    const delta = wv[0] < lv[0] ? 1 : -1;
    if (next === prev) next = { ...prev };
    next[key] = (next[key] ?? 0) + delta;
  }
  return next;
}

export function emptyDuelVerdicts(): DuelVerdicts {
  return {};
}
