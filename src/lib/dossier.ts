// The public dossier — dishi.me/[username] (owner decision 3, 2026-07-26:
// "the dossier IS the public taste page — there is no third artifact").
//
// This module is the page's PRIVACY CONTRACT, kept pure so tests can pin it:
// everything the public page may show passes through projectDossier, and the
// projection's OUTPUT TYPE cannot carry the things decision 3 forbids — eaten
// dates (they reveal whereabouts and patterns) and companions (NEVER) have no
// field to ride in.
//
// ANCHORS ARE POSTS (2026-07-28, ending the placeholder). They used to be the
// person's top ratings, published on the single blanket event of claiming a
// username — a coarser consent grain than the rest of the product, where the
// unit is the DISH. Now one anchor = one `dish_posts` row = one deliberate
// act of publishing, and unpublishing deletes it.
//
// That change is what reopened negative anchors, and the owner opened them
// (2026-07-28): a post may carry ANY verdict, because per-dish opt-in IS the
// consent the old blanket rule couldn't give. The earlier rule — never publish
// "this dish at this restaurant is bad" — rested on the person never having
// chosen that dish specifically; they choose now. The cost is paid by carrying
// the VERDICT WORD on every anchor: a published dislike that rendered like the
// loves beside it would be worse than not publishing it at all.
//
// NO COPY-FOR-AI PATH (owner call 2026-07-28, amending decision 3). This
// module briefly emitted third-person text for a friend's own AI. It carried
// one line asking that AI not to fold the dossier into what it knows about
// its owner — which is a standing behavioural instruction, precisely the
// category Phase 0.5 measured hosts REFUSING while accepting the data. The
// payload would land and the protection wouldn't. Hard rule 1 (a dossier
// never enters the recipient's taste engine) is enforceable inside Dishi —
// there is no import path — and unenforceable inside someone else's host, so
// the affordance is gone rather than nominally guarded. A friend who trusts
// this palate should reach its POSTS, which are per-dish opt-in and carry a
// reason. Do not re-add an export/copy path here; see DECISIONS.md.
//
// Resolution rule (enforced at the route, restated here because it's easy to
// get wrong): only profiles with username_set_at non-null resolve publicly.
// Every legacy profile carries an email-derived handle — resolving those
// would mint public URLs out of address local-parts, the exact leak the
// claim exists to end. hasClaimedUsername() (lib/username.ts) is the gate.

import { wordKeyFor } from './flickWords';
import { engineConfidence, exploredDims } from './buddy';
import type { DomainEvidence } from './creatureForm';

/** Same bar the buddy card's 識 N 味 uses (/api/buddy: evidence >= 3 ratings
 * taught the dim). Duplicated as a named constant rather than imported from
 * the route — if the in-app rule ever moves, the dossier test comparing the
 * two derivations is the tripwire. */
export const DOSSIER_KNOWS_AT = 3;

/** A public anchor is a posted dish: what, (optionally) where, the verdict in
 * the app's own flick vocabulary, and the line the person wrote. No eaten/posted
 * dates, no numeric scores: the type is the fence.
 *
 * `verdict` is a flick word KEY (client renders t(key)), not a number — the
 * same six-band vocabulary the person rated in. It is here because posts may
 * be negative; a coarse word is the minimum needed to keep a published dislike
 * from reading as praise, and it leaks no more than the band.
 *
 * `photo_url` (owner call 2026-07-28, photo-forward post cards): the dish's
 * own photo, already public storage (getPublicUrl — /api/dishes/photo), and
 * exactly as consented as the name/reason beside it: posting a dish IS
 * publishing the photo of it, not a lesser act.
 *
 * `id` (owner call: anchors mount FeedCard, the exact 大家食 card, not a
 * lookalike) — the dish id lets that card's bookmark control target the real
 * row; `diet`/`heaviness`/`ingredients` let it show the same chip row 大家食
 * does. All food attributes, not personal/location data. */
export type DossierAnchor = {
  id: string;
  name: string | null; name_zh: string | null; restaurant: string | null;
  photo_url: string | null;
  diet: string[]; heaviness: string | null; ingredients: string[];
  verdict: string; reason: string | null;
};

export type PublicDossier = {
  username: string;
  /** Cosmetic casing only ("Jerry" over "jerry") — see
   * profiles_username_display_casing.sql. Falls back to `username` itself. */
  usernameDisplay: string;
  version: number;
  /** 0..1 toward the NEXT version — the SAME live number Taste AI's own
   * progress bar reads (versionForProfile), not re-derived here from a
   * different formula. */
  versionProgress: number;
  ratingCount: number;
  knowsCount: number;
  learningCount: number;
  /** 0-100 — the SAME engine-confidence number Taste AI's own strength stat
   * reads (engineConfidence). Owner call: matching Taste AI's card EXACTLY,
   * stats included — these are food-engine numbers, not personal/location
   * data, so they carry no more privacy weight than the vector/evidence
   * already exposed below for the blob. */
  strength: number;
  /** Distinct real cuisines actually rated (not just posted) — the same
   * "cuisines" stat Taste AI shows, not the affinity-filtered list the old
   * loves/avoids/cuisines summary used. */
  cuisineCount: number;
  dimsExplored: number;
  dimsTotal: number;
  /** Full cuisine affinity (not filtered to positive-only) — feeds the
   * cuisines stat's explainer chips exactly like Taste AI's own. */
  affinity: Record<string, number>;
  anchors: DossierAnchor[];
  /** Blob inputs — the same vector/evidence the stats above are read from,
   * so the form can never disagree with them. */
  vector: Record<string, number>;
  evidence: Record<string, number>;
  // 骨 domain evidence — absent/empty renders today's blob (fail-closed, same
  // as every 墨靈 phase-2 site). A visitor's dossier and the owner's own Taste
  // tab must show the SAME being, so this rides the identical field.
  domain_evidence?: DomainEvidence;
};

export type DossierRawAnchor = {
  id: string;
  name: string | null; name_zh: string | null;
  restaurant?: string | null;
  diet?: string[] | null; heaviness?: string | null; ingredients?: string[] | null;
  /** Deliberately accepted-and-dropped: callers may hand the projection rows
   * that still carry dates; the projection is where they die. `posted_at`
   * orders the list and then dies with them — a post's date is as private as
   * a meal's. */
  eaten_at?: string | null;
  posted_at?: string | null;
  reason?: string | null;
  photo_url?: string | null;
  /** The CURRENT rating, read live (never snapshotted at post time). Becomes a
   * verdict word in the projection; the number itself never leaves. */
  score: number;
};

export function projectDossier(raw: {
  username: string;
  usernameDisplay?: string | null;
  version: number;
  /** Live progress toward the next version (versionForProfile's own .progress)
   * — the caller already runs that call to ratchet `version`, so it's passed
   * through rather than re-derived here from a second formula. */
  versionProgress: number;
  ratingCount: number;
  /** Distinct real cuisines actually rated (not 'unknown') — the SAME input
   * engineConfidence/versionForProfile use, computed by the caller (a DB join
   * this module has no connection to run). */
  distinctCuisines: number;
  vector: Record<string, number>;
  evidence: Record<string, number>;
  domain_evidence?: DomainEvidence;
  affinity: Record<string, number>;
  anchors: DossierRawAnchor[];
}): PublicDossier {
  const learningCount = Object.values(raw.evidence).filter(n => n > 0 && n < DOSSIER_KNOWS_AT).length;

  return {
    username: raw.username,
    usernameDisplay: raw.usernameDisplay?.trim() || raw.username,
    version: Math.max(1, raw.version),
    versionProgress: raw.versionProgress,
    ratingCount: raw.ratingCount,
    knowsCount: Object.values(raw.evidence).filter(n => n >= DOSSIER_KNOWS_AT).length,
    learningCount,
    strength: Math.round(engineConfidence({
      ratingCount: raw.ratingCount, distinctCuisines: raw.distinctCuisines,
      vector: raw.vector, cuisineAffinity: raw.affinity,
    }) * 100),
    cuisineCount: raw.distinctCuisines,
    dimsExplored: exploredDims(raw.vector).length,
    dimsTotal: 18,
    affinity: raw.affinity,
    // POSTED dishes — every one of them an explicit publish (see the module
    // comment). NO score filter: filtering would silently swallow a post the
    // person deliberately made, which is the same disrespect for the consent
    // act that the blanket source had, pointed the other way.
    //
    // Newest first, because this is a publishing surface and not a leaderboard;
    // score-sorting would bury a negative post under the loves and quietly
    // undo the owner's call. The eaten_at / posted_at a raw row carries ends
    // here, never in the output.
    //
    // Deduped by (name, restaurant): one dish can only be posted once (unique
    // index), but the SAME real dish logged as two rows at one restaurant can
    // be posted twice — 壽司拼盤 @ Tsumura listed twice reads as a glitch, not
    // enthusiasm. First occurrence wins, i.e. the most recent post of it.
    //
    // Capped at a page length, not at a taste: 12 keeps the dossier a dossier
    // without making the cap the thing that decides what's public.
    anchors: dedupeAnchors(
      [...raw.anchors].sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? '')),
    )
      .slice(0, 12)
      .map(a => ({
        id: a.id,
        name: a.name ?? null,
        name_zh: a.name_zh ?? null,
        restaurant: a.restaurant ?? null,
        photo_url: a.photo_url ?? null,
        diet: a.diet ?? [],
        heaviness: a.heaviness ?? null,
        ingredients: a.ingredients ?? [],
        verdict: wordKeyFor(a.score),
        reason: a.reason ?? null,
      })),
    vector: raw.vector,
    evidence: raw.evidence,
    domain_evidence: raw.domain_evidence,
  };
}

function dedupeAnchors<T extends { name: string | null; name_zh: string | null; restaurant?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(a => {
    const key = `${a.name_zh ?? a.name ?? ''}@${a.restaurant ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
