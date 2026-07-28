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

/**
 * The OG card for a shared PROFILE (sharing batch item 4b's other half — the
 * Taste AI swipe sends this URL, and a bare link in WhatsApp reads as spam).
 *
 * Every byte comes off the PROJECTED dossier, never a raw row. That rule is
 * easy to break precisely here: generateMetadata runs as its own call, so
 * reaching straight into the DB for a "quick" name or count would bypass
 * projectDossier entirely — and an OG card is the worst place to leak, since
 * it is visible to everyone the link is forwarded to AND cached by crawlers.
 * resolveDossier is React-cached, so this costs no extra queries.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const u = normalizeUsername(decodeURIComponent(params.username));
  if (validateUsername(u)) return {};

  const resolved = await resolveDossier(params.username);
  const d = resolved?.dossier;
  const title = `dishi.${d?.username ?? u}`;
  if (!d) return { title };

  // Counts only — the palate's shape, not its contents. Deliberately NOT the
  // dish names: the page itself shows those with their verdicts attached, and
  // a verdict-less dish name in a link preview reads as a recommendation.
  const description = [
    `識 ${d.knowsCount} 味`,
    `${d.ratingCount} 次食評`,
    `${d.anchors.length} 道菜公開`,
  ].join(' · ');
  // The newest posted dish's photo — already public (it is on the page this
  // card previews), and it is what makes the preview look like food rather
  // than a URL.
  const photo = d.anchors.find(a => a.photo_url)?.photo_url ?? null;

  return {
    title,
    description,
    openGraph: {
      title, description, type: 'profile',
      ...(photo ? { images: [{ url: photo }] } : {}),
    },
    twitter: {
      card: photo ? 'summary_large_image' : 'summary',
      title, description,
      ...(photo ? { images: [photo] } : {}),
    },
  };
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
