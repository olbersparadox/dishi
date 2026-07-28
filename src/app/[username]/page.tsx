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
import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { normalizeUsername, validateUsername } from '@/lib/username';
import { resolveDossier } from '@/lib/dossierResolve';
import PublicDossier from '@/components/PublicDossier';

export const dynamic = 'force-dynamic';

type Params = { params: { username: string } };

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
