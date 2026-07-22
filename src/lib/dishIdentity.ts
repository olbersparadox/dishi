// Dish identity resolution: deciding when two differently-named dish rows at the
// same restaurant are the SAME real-world dish (蝦餃 vs 水晶鮮蝦餃), so that dish
// locking, owner-dashboard aggregation, and dish history don't fragment.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS ISN'T PURE STRING MATCHING — the thing real data proved
// ─────────────────────────────────────────────────────────────────────────────
// The obvious approach is containment: if one normalised name contains the other,
// call them the same dish. Real rows in Dishi's own database show why that fails,
// in BOTH directions, and why no length/similarity threshold rescues it:
//
//   TRUE positive:   蝦餃 (2 chars) ⊂ 水晶鮮蝦餃 (5)      length ratio 0.40
//   FALSE positive:  壽司 (2 chars) ⊂ 蝦壽司   (3)      length ratio 0.67
//
// Chinese dish names put the head noun LAST and stack modifiers in front, so both
// pairs are structurally identical strings. The only difference is semantic: 水晶
// ("crystal") and 鮮 ("fresh") are descriptive flourishes on the same dumpling,
// while 蝦 ("shrimp") is the defining ingredient that makes 蝦壽司 a different dish
// from plain 壽司. English does exactly the same thing ("shrimp dumpling" ⊂
// "steamed shrimp dumpling" = same; "sushi" ⊂ "shrimp sushi" = different).
//
// Note the length ratios are INVERTED relative to truth — a similarity threshold
// would systematically pick the wrong pairs. This is not a tunable-parameter
// problem; it needs food knowledge.
//
// So identity resolution is a THREE-gate pipeline, and this file is only gate 1:
//
//   Gate 1 (here, pure/free):  containment prefilter → a small candidate set.
//                              Deliberately over-inclusive; it is a cheap way to
//                              avoid asking a model about every unrelated dish.
//   Gate 2 (dishMatch.ts):     an LLM adjudicates each candidate with real food
//                              knowledge, and must come back confident.
//   Gate 3 (the human):        the person confirms "同一味餸?" — nothing is ever
//                              merged automatically.
//
// The gates are ordered cheapest-first and each one can only REMOVE candidates.
// This follows Dishi's standing principle — no suggestion is better than a wrong
// suggestion. A bad "is this the same dish?" prompt is worse than none: it trains
// people to tap through the confirm without reading it, which is exactly how a
// 壽司 gets silently merged into a 蝦壽司 forever.

import { CJK } from './i18n-dict';

/**
 * Normalises a dish name for comparison — NOT for display. Folds cosmetic variation
 * only: case, whitespace, punctuation, and full-width/half-width forms. CJK
 * characters pass through untouched.
 */
const PUNCT_AND_SYMBOLS = /['’‘"“”.,!?…、。，！？：；:;()（）\[\]{}「」『』・\-–—~＿_/\\@#$%^&*+=|<>`]/g;

export function normalizeDishName(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(PUNCT_AND_SYMBOLS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Whitespace-insensitive form, for containment tests on Latin text. */
function compact(raw: string): string {
  return normalizeDishName(raw).replace(/\s+/g, '');
}

export type DishLike = {
  id: string;
  name: string;
  name_zh?: string | null;
  dish_identity_id?: string | null;
  source?: string | null;
  name_edited_at?: string | null;
};

/** An owner's published menu row, reduced to what identity matching needs. */
export type OwnerMenuLike = { id: string; name: string; name_zh?: string | null };

/**
 * Finds the owner menu item a dish/identity name EXACTLY is, folding only cosmetic
 * variation (the same normalisation scan-vs-scan matching uses), in either language.
 *
 * Exact only, on purpose. This is the confident, synchronous path used when a diner
 * links a dish: if their 蝦餃 is spelled exactly like the owner's 蝦餃, adopt the
 * owner's canonical row with zero risk. FUZZY owner matching (a diner's 蝦餃 vs the
 * owner's 水晶鮮蝦餃) is a real entity-resolution problem and goes through the LLM
 * adjudicator in the owner-publish reconcile — never here. Auto-adopting a fuzzy
 * owner name with no human in the loop is exactly the silent-mislabel failure the
 * whole three-gate design exists to prevent.
 */
export function ownerMenuExactMatch(
  target: { name?: string | null; name_zh?: string | null },
  items: OwnerMenuLike[],
): OwnerMenuLike | null {
  const tn = target.name ? compact(target.name) : '';
  const tz = target.name_zh ? compact(target.name_zh) : '';
  if (!tn && !tz) return null;
  for (const it of items) {
    const enHit = !!tn && compact(it.name) === tn;
    const zhHit = !!tz && !!it.name_zh && compact(it.name_zh) === tz;
    if (enHit || zhHit) return it;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// NAME AUTHORITY — which name a shared dish identity should actually be known by
// ─────────────────────────────────────────────────────────────────────────────
// When several rows are confirmed to be the same real dish, they'll usually carry
// different names for it, and one of them has to become the canonical one. "First
// one logged wins" is arbitrary; the right answer is "whichever name has the best
// claim to being what the dish is ACTUALLY called."
//
// The menu scan wins over diner names, because it is the only diner-side name in
// the system that isn't a guess: it is the restaurant's own printed words, read
// off their own menu. A photo name is a vision model's guess from an image. A
// user's rename is one diner's guess — better-informed than vision's (they were
// sitting in front of the dish), but still not the restaurant's name for it.
//
// ABOVE all of those sits the restaurant OWNER's own published menu item. A menu
// scan is only OCR of the printed menu; the owner typing (or confirming) that same
// dish in their dashboard is the source the OCR was trying to read. So an owner
// item, when a dish is confidently matched to one, is the single most authoritative
// name there is. It is applied at the IDENTITY level (see applyOwnerMenuAuthority
// in ownerMenuReconcile.ts), not by nameAuthority() below — that function only sees
// a single dish ROW's own fields and can't know about a separate owner menu table.
//
// The one subtlety that makes the scan tier correct rather than merely plausible: a
// scan row whose name a user later EDITED is no longer the menu's words. It must be
// demoted to the human tier, or an overwritten OCR name would masquerade as menu truth.
export const AUTHORITY_OWNER = 4;  // the restaurant owner's own published menu item
export const AUTHORITY_MENU = 3;   // read off the restaurant's printed menu, unedited
export const AUTHORITY_HUMAN = 2;  // a person typed this name themselves
export const AUTHORITY_VISION = 1; // a vision model's guess from a photo
export const AUTHORITY_NONE = 0;

/** How strong a claim this row's CURRENT name has to being the dish's real name. */
export function nameAuthority(dish: Pick<DishLike, 'source' | 'name_edited_at'>): number {
  const fromMenu = dish.source === 'scan' || dish.source === 'table';
  const humanEdited = !!dish.name_edited_at;

  if (fromMenu && !humanEdited) return AUTHORITY_MENU;
  if (humanEdited) return AUTHORITY_HUMAN;
  if (dish.source === 'photo') return AUTHORITY_VISION;
  return AUTHORITY_NONE;
}

/**
 * May a MACHINE re-author this dish's ENGLISH name (the carb-shorthand honest
 * re-score, and any future machine correction of a machine-derived name)?
 *
 * The ladder question here is subtle: a scan dish's zh name is the menu's verbatim
 * truth (MENU tier), but its ENGLISH name was authored by the scan model — so
 * re-deriving the English FROM THE SAME zh original is a better rendering of the
 * same MENU-tier source, not a tier demotion. What machine re-authoring must never
 * touch:
 *  - a human's words (`name_edited_at` set — HUMAN tier, hard stop);
 *  - an identity-linked dish (its canonical name lives on the identity row and may
 *    be OWNER/MENU-propagated; rewriting the dish's own EN underneath it would
 *    fight the identity resolution — conservative skip, report instead);
 *  - a dish with no CJK zh seed distinct from the EN (nothing trustworthy to
 *    re-translate FROM — re-authoring would be guess-on-guess).
 * The zh name itself is NEVER re-authored by this path: it may be the printed
 * original, and misreadings only ever live in derived fields.
 */
export function canReauthorEnName(dish: {
  name: string | null; name_zh: string | null;
  name_edited_at?: string | null; dish_identity_id?: string | null;
}): boolean {
  if (dish.name_edited_at) return false;
  if (dish.dish_identity_id) return false;
  const zh = (dish.name_zh ?? '').trim();
  if (!zh || !CJK.test(zh)) return false;
  return zh !== (dish.name ?? '').trim();
}

/**
 * Picks which of two rows should give a shared identity its canonical name.
 * Ties go to `incumbent` — an equally-authoritative newcomer has no claim to rename
 * a dish the restaurant's other diners already know by a settled name. Only a
 * STRICTLY better claim (a real menu scan arriving after a photo guess) may upgrade.
 */
export function preferredName<T extends Pick<DishLike, 'name' | 'name_zh' | 'source' | 'name_edited_at'>>(
  incumbent: T,
  challenger: T,
): { winner: T; authority: number; upgraded: boolean } {
  const a = nameAuthority(incumbent);
  const b = nameAuthority(challenger);
  return b > a
    ? { winner: challenger, authority: b, upgraded: true }
    : { winner: incumbent, authority: a, upgraded: false };
}

/**
 * True when two names are close enough to be WORTH ASKING about — not close enough
 * to act on. Containment in either direction, after normalisation.
 *
 * The 2-character / 3-letter floor exists because a 1-character CJK name (麵, 飯)
 * is contained in half a menu and would nominate everything. It is a noise guard,
 * not a correctness guarantee — correctness is gates 2 and 3.
 */
export function namesWorthAsking(a: string, b: string): boolean {
  const x = compact(a), y = compact(b);
  if (!x || !y) return false;
  if (x === y) return true;

  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  // Script-aware floor: CJK packs a whole word into 2 chars; Latin needs more.
  const hasCjk = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(shorter);
  const floor = hasCjk ? 2 : 3;
  if (shorter.length < floor) return false;

  return longer.includes(shorter);
}

// ─────────────────────────────────────────────────────────────────────────────
// PAIR VERDICTS — what a human's earlier answer means for asking again
// ─────────────────────────────────────────────────────────────────────────────
// The identity-confirm card (係咪同一味？) records one of two verdicts per pair
// in dish_identity_dismissals:
//   'different' — a real denial. PERMANENT. Re-asking a settled "no" reads as
//                 the app not listening; the negative record is as load-bearing
//                 as a merge. This is also what makes human distinctness STICKY
//                 against any later scan/owner sameness signal: candidate pairs
//                 are filtered through these verdicts BEFORE anything else runs,
//                 and no automated path links identities (gate 3 — the human —
//                 is the only merge author in the whole system).
//   'unsure'    — 唔肯定. Skip semantics with a cooldown, borrowed from the
//                 duel rhythm (DUEL_RECENT_DAYS): the pair is off the table for
//                 a while, then may be asked again.

/** How long a 唔肯定 keeps a pair off the table — same rhythm as DUEL_RECENT_DAYS. */
export const IDENTITY_UNSURE_COOLDOWN_DAYS = 30;

export type PairVerdict = 'different' | 'unsure';

/** Whether an earlier verdict still blocks re-asking about this pair. */
export function dismissalBlocks(
  verdict: PairVerdict,
  createdAt: string,
  now: number = Date.now(),
): boolean {
  if (verdict !== 'unsure') return true; // a real denial is permanent
  const t = new Date(createdAt).getTime();
  if (isNaN(t)) return true; // unparseable clock -> fail closed (don't nag)
  return now - t < IDENTITY_UNSURE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Whether a dish whose last identity probe found nothing (dish_identity_checked_at)
 * is due a re-check. The stamp exists so a genuine singleton isn't re-probed — and
 * re-billed for LLM adjudication — on every visit; but a permanent stamp would also
 * mean a dish that GAINS a lookalike later (someone logs 水晶鮮蝦餃 next month), or
 * whose pair earned only an expiring 唔肯定, could never be asked about again. The
 * same cooldown window bounds both concerns: at most one probe per dish per window.
 */
export function identityRecheckDue(
  checkedAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!checkedAt) return true;
  const t = new Date(checkedAt).getTime();
  if (isNaN(t)) return true;
  return now - t >= IDENTITY_UNSURE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Gate 1. Given a target dish and the other dishes at the same restaurant, returns
 * the ones worth adjudicating. Compares each language independently — a menu-scan
 * row and a photo row often agree in Chinese while their English names diverge
 * wildly (both are independent machine guesses), so a match in EITHER language is
 * enough to nominate a candidate.
 *
 * Excludes the target itself, and any dish already sharing its identity (nothing to
 * resolve — they're already known to be the same dish).
 */
export function candidateMatches(target: DishLike, pool: DishLike[]): DishLike[] {
  const seen = new Set<string>();
  const out: DishLike[] = [];

  for (const other of pool) {
    if (other.id === target.id) continue;
    if (
      target.dish_identity_id &&
      other.dish_identity_id === target.dish_identity_id
    ) continue;

    // One candidate per identity group: if three rows are already linked as one
    // dish, that's ONE thing to ask about, not three.
    const groupKey = other.dish_identity_id ?? other.id;
    if (seen.has(groupKey)) continue;

    const enMatch = namesWorthAsking(target.name, other.name);
    const zhMatch =
      !!target.name_zh && !!other.name_zh &&
      namesWorthAsking(target.name_zh, other.name_zh);

    if (enMatch || zhMatch) {
      seen.add(groupKey);
      out.push(other);
    }
  }

  // Cap: a human is going to be asked about these. More than a handful means the
  // prefilter is misfiring anyway, and a wall of confirms is worse than none.
  return out.slice(0, 5);
}
