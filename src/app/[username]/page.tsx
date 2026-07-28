// dishi.me/[username] — the public taste dossier (owner decision 3).
//
// Publicly viewable WITHOUT login: no AuthGate, deliberately — "a signup wall
// here kills the acquisition path the page exists to serve." Data is fetched
// server-side with the admin client (taste_profiles/ratings are RLS-locked to
// their owner; a public page is exactly the read RLS exists to stop, so the
// bypass is explicit and everything it exposes passes through projectDossier,
// the tested privacy contract in lib/dossier.ts).
//
// Resolution: CLAIMED usernames only (username_set_at non-null). Legacy
// email-derived handles must never mint public URLs — that would publish
// address local-parts. validateUsername rejects most of them on shape alone
// (dots, etc.); hasClaimedUsername is the real gate.
//
// Hard rule 2 (never visible during a rating flow): nothing links here from
// a RATING surface (duel, seal reveal, rating stack) — seeing a friend's
// verdict before you flick contaminates the rating at source. 大家食's
// FeedCard now links here from a claimed user's chop/name (owner decision) —
// that is browsing, not rating, so it doesn't touch this rule.
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import type { Metadata } from 'next';
import { supabaseAdmin, supabaseServer } from '@/lib/supabase/server';
import { normalizeUsername, validateUsername, hasClaimedUsername } from '@/lib/username';
import { projectDossier, type DossierRawAnchor } from '@/lib/dossier';
import { versionForProfile, ratchetVersion } from '@/lib/version';
import { confidenceInputsFrom } from '@/lib/tasteExport';
import PublicDossier from '@/components/PublicDossier';

export const dynamic = 'force-dynamic';

type Params = { params: { username: string } };

async function resolveDossier(rawName: string) {
  // Next 14 Data-Caches the supabase REST GETs inside an RSC render even on a
  // force-dynamic page — a public page must always reflect the live posted
  // list, so opt this render out of the Data Cache.
  noStore();
  const u = normalizeUsername(decodeURIComponent(rawName));
  if (validateUsername(u)) return null; // wrong shape can't be a claimed name
  const admin = supabaseAdmin();
  const { data: prof } = await admin
    .from('profiles')
    .select('id, handle, username_set_at')
    .eq('handle', u)
    .maybeSingle();
  if (!prof || !hasClaimedUsername(prof.username_set_at)) return null;

  const { data: taste } = await admin
    .from('taste_profiles')
    .select('vector, evidence, cuisine_affinity, rating_count, version_unlocked')
    .eq('user_id', prof.id)
    .maybeSingle();
  if (!taste) return null;

  // Density gate is the claim itself (no username before v1), but compute the
  // live version the same ratcheted way the app does so the number agrees.
  const vector = (taste.vector ?? {}) as Record<string, number>;
  const affinity = (taste.cuisine_affinity ?? {}) as Record<string, number>;
  const ratingCount = taste.rating_count ?? 0;
  const version = ratchetVersion(
    taste.version_unlocked ?? 0,
    versionForProfile(confidenceInputsFrom(vector, affinity, ratingCount)).version,
  );

  // Anchors = POSTS (2026-07-28). Every row here is a dish this person chose
  // to publish; nothing reaches the page off the strength of a rating alone.
  // The verdict is read LIVE from ratings rather than snapshotted at post
  // time — re-rating replays the whole history, and a public page quoting a
  // verdict its owner has since abandoned is worse than one that lags.
  const { data: posts } = await admin
    .from('dish_posts')
    .select('reason, created_at, dishes!inner(id, name, name_zh, photo_url, diet, heaviness, ingredients, restaurants(name))')
    .eq('user_id', prof.id)
    .order('created_at', { ascending: false })
    .limit(24);

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

  return {
    ownerId: prof.id as string,
    dossier: projectDossier({
      username: prof.handle as string,
      version,
      ratingCount,
      vector,
      evidence: (taste.evidence ?? {}) as Record<string, number>,
      affinity,
      anchors,
    }),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const u = normalizeUsername(decodeURIComponent(params.username));
  return validateUsername(u) ? {} : { title: `dishi.${u}` };
}

export default async function PublicDossierPage({ params }: Params) {
  const resolved = await resolveDossier(params.username);
  if (!resolved) notFound();

  // Owner check: the page itself needs no session, but a viewer who IS this
  // dossier's owner sees no "build your own" CTA, and their own posted-dish
  // anchors render as their own (FeedCard's item.own — no bookmark affordance
  // on your own post). supabaseServer respects cookies; absent session =
  // plain visitor.
  let isOwner = false;
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    isOwner = user?.id === resolved.ownerId;
  } catch { /* signed-out viewers are the normal case */ }

  return <PublicDossier dossier={resolved.dossier} isOwner={isOwner} />;
}
