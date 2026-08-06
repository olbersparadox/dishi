// Server-side resolution for BOTH public surfaces:
//   dishi.me/[username]        — the whole palate (public-tier posts)
//   dishi.me/[username]/d/[id] — one shared dish (either tier)
//
// One function on purpose. These two pages expose the same KIND of material
// about the same person, and the moment they resolve separately is the moment
// one of them grows a field the other's privacy review never saw. Everything
// still lands in projectDossier (lib/dossier.ts) — the page decides WHICH rows
// to read, the projection decides what may leave. Adding a second projection
// for the permalink would be the mistake; adding a scope argument here is not.
//
// Split out of app/[username]/page.tsx when the permalink shipped; the logic
// is unchanged from what that page ran, aside from the `onlyDishId` scope.
import { cache } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase/server';
import { normalizeUsername, validateUsername, hasClaimedUsername } from '@/lib/username';
import { projectDossier, type DossierRawAnchor, type PublicDossier } from '@/lib/dossier';
import { versionForProfile, ratchetVersion } from '@/lib/version';
import { confidenceInputsFrom } from '@/lib/tasteExport';
import type { DomainEvidence } from '@/lib/creatureForm';
import { domainsAsOf, type DomainEvidenceT } from '@/lib/domainEvidence';

export type ResolvedDossier = { ownerId: string; dossier: PublicDossier };

/**
 * `onlyDishId` scopes the anchors to a single dish and, deliberately, DROPS
 * the public-tier filter: a permalink is exactly the audience a link-only
 * post was published to, and refusing to render it there would make the
 * share tier useless. The dossier path keeps the filter, because that page
 * IS the "everyone" audience.
 *
 * Wrapped in React `cache` so a page and its generateMetadata — which run as
 * separate calls for the same request — resolve once between them rather
 * than doubling every query on a share landing.
 */
export const resolveDossier = cache(async (
  rawName: string,
  onlyDishId?: string,
): Promise<ResolvedDossier | null> => {
  // Next 14 Data-Caches the supabase REST GETs inside an RSC render even on a
  // force-dynamic page — a public page must always reflect the live posted
  // list, so opt this render out of the Data Cache.
  noStore();
  const u = normalizeUsername(decodeURIComponent(rawName));
  if (validateUsername(u)) return null; // wrong shape can't be a claimed name
  const admin = supabaseAdmin();
  const { data: prof } = await admin
    .from('profiles')
    .select('id, handle, username_display, username_set_at')
    .eq('handle', u)
    .maybeSingle();
  if (!prof || !hasClaimedUsername(prof.username_set_at)) return null;

  const { data: taste } = await admin
    .from('taste_profiles')
    .select('vector, evidence, cuisine_affinity, rating_count, version_unlocked, domain_evidence, domain_evidence_t')
    .eq('user_id', prof.id)
    .maybeSingle();
  if (!taste) return null;

  // Density gate is the claim itself (no username before v1), but compute the
  // live version the same ratcheted way the app does so the number agrees.
  // The SAME call's .progress feeds the public page's version bar too (owner
  // call: match Taste AI's card exactly) — captured once rather than
  // re-derived from a second formula.
  const vector = (taste.vector ?? {}) as Record<string, number>;
  const affinity = (taste.cuisine_affinity ?? {}) as Record<string, number>;
  const ratingCount = taste.rating_count ?? 0;
  const liveVersion = versionForProfile(confidenceInputsFrom(vector, affinity, ratingCount));
  const version = ratchetVersion(taste.version_unlocked ?? 0, liveVersion.version);

  // Distinct real cuisines actually RATED (not just posted) — the same input
  // /api/buddy's own engineConfidence/versionForProfile use for the strength
  // stat and version substrate. A public admin-client join since this page
  // has no session to scope an RLS-respecting read to.
  const { data: myRatings } = await admin.from('ratings').select('dish_id').eq('user_id', prof.id);
  const ratedDishIds = (myRatings ?? []).map(r => r.dish_id as string);
  let distinctCuisines = 0;
  if (ratedDishIds.length > 0) {
    const { data: ratedDishes } = await admin.from('dishes').select('cuisine').in('id', ratedDishIds);
    distinctCuisines = new Set(
      (ratedDishes ?? []).map(d => d.cuisine).filter(c => c && c !== 'unknown'),
    ).size;
  }

  // Anchors = POSTS (2026-07-28). Every row here is a dish this person chose
  // to publish; nothing reaches the page off the strength of a rating alone.
  // The verdict is read LIVE from ratings rather than snapshotted at post
  // time — re-rating replays the whole history, and a public page quoting a
  // verdict its owner has since abandoned is worse than one that lags.
  let q = admin
    .from('dish_posts')
    .select('reason, created_at, visibility, dishes!inner(id, name, name_zh, photo_url, diet, heaviness, ingredients, restaurants(name))')
    .eq('user_id', prof.id);
  if (onlyDishId) {
    // Permalink scope: this dish, whatever its tier (see the note above).
    q = q.eq('dish_id', onlyDishId);
  } else {
    // PUBLIC TIER ONLY — the dossier IS the "everyone" audience. A dish
    // shared to one friend must not appear here just because they own both.
    q = q.eq('visibility', 'public');
  }
  const { data: posts } = await q.order('created_at', { ascending: false }).limit(onlyDishId ? 1 : 24);

  const postRows = (posts ?? []).map(p => ({
    reason: (p.reason as string | null) ?? null,
    posted_at: p.created_at as string,
    dish: p.dishes as unknown as {
      id: string; name: string | null; name_zh: string | null; photo_url: string | null;
      diet: string[] | null; heaviness: string | null; ingredients: string[] | null;
      restaurants: { name: string | null } | null;
    },
  }));

  // One batched read of the current verdicts. A post with no rating left (only
  // reachable if a rating was deleted out from under it) is DROPPED rather
  // than rendered verdictless — an anchor with no verdict is exactly the
  // "reads as praise" failure the verdict word exists to prevent.
  const scores = new Map<string, number>();
  if (postRows.length > 0) {
    const { data: rated } = await admin
      .from('ratings')
      .select('dish_id, score')
      .eq('user_id', prof.id)
      .in('dish_id', postRows.map(p => p.dish.id));
    for (const r of rated ?? []) scores.set(r.dish_id as string, Number(r.score));
  }

  const anchors: DossierRawAnchor[] = postRows
    .filter(p => scores.has(p.dish.id))
    .map(p => ({
      id: p.dish.id,
      name: p.dish.name ?? null,
      name_zh: p.dish.name_zh ?? null,
      restaurant: p.dish.restaurants?.name ?? null,
      photo_url: p.dish.photo_url ?? null,
      diet: p.dish.diet ?? [],
      heaviness: p.dish.heaviness ?? null,
      ingredients: p.dish.ingredients ?? [],
      reason: p.reason,
      posted_at: p.posted_at,
      score: scores.get(p.dish.id)!,
    }));

  // A permalink to a dish that is not (or no longer) published resolves to
  // nothing — the caller 404s. Unpublishing revokes the URL, which is the
  // point of keying the page on a post rather than on a dish alone.
  if (onlyDishId && anchors.length === 0) return null;

  return {
    ownerId: prof.id as string,
    dossier: projectDossier({
      username: prof.handle as string,
      usernameDisplay: prof.username_display as string | null,
      version,
      versionProgress: liveVersion.progress,
      ratingCount,
      distinctCuisines,
      vector,
      evidence: (taste.evidence ?? {}) as Record<string, number>,
      // decayed to now (G2 flip) — the dossier shows the present-tense body,
      // the same read the Taste tab serves. Field name unchanged for callers.
      domain_evidence: domainsAsOf((taste.domain_evidence_t ?? {}) as DomainEvidenceT, Date.now()),
      affinity,
      anchors,
    }),
  };
});
