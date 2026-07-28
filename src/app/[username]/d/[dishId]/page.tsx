// dishi.me/[username]/d/[dishId] — ONE shared dish (sharing batch item 3).
//
// Nested under the username on purpose: the identity IS the context ("jerry's
// take on this dish"), and stripping the last segment lands on the full
// dossier, which is a free and discoverable affordance rather than a
// navigation feature anyone had to build.
//
// Keyed on the DISH id, not the post id — a build-time correction to the spec,
// which asked for the post id so that unpublishing would break the link. It
// breaks either way: the lookup goes THROUGH dish_posts, so a revoked post
// resolves to nothing and 404s (see resolveDossier's onlyDishId branch). The
// dish id is what DossierAnchor already carries, what /api/bookmarks already
// takes, and what FeedCard already holds — keying on it means the share link,
// the card and the bookmark all speak about the same id instead of three
// surfaces translating between two.
//
// Serves BOTH tiers. A link-only post is exactly the audience this page is
// for; refusing to render it here would make the share tier useless.
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseServer } from '@/lib/supabase/server';
import { resolveDossier } from '@/lib/dossierResolve';
import { dict } from '@/lib/i18n-dict';
import PublicDish from '@/components/PublicDish';

export const dynamic = 'force-dynamic';

type Params = { params: { username: string; dishId: string } };

/**
 * The OG card is most of what "messenger share" actually is — a bare URL in
 * WhatsApp reads as spam, and this is the half a recipient sees before
 * deciding to tap. Everything in it comes off the projected anchor, never off
 * a raw row: generateMetadata runs as its own call and is the easy place to
 * quietly bypass the privacy projection every other public byte passes.
 *
 * The VERDICT rides in the description for the same reason it rides on the
 * card: a dish shown alone reads as a recommendation, and a negative post
 * previewed as just a photo and a name misrepresents the person sharing it.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const resolved = await resolveDossier(params.username, params.dishId);
  const a = resolved?.dossier.anchors[0];
  if (!a) return {};

  // Chinese-first, per the product's copy principle; the English name rides
  // along when the two differ so a non-Chinese reader still gets the dish.
  const name = [a.name_zh, a.name].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' / ');
  const verdict = dict[a.verdict]?.zh ?? '';
  const description = [verdict, a.reason, a.restaurant].filter(Boolean).join(' · ');
  const title = `${name} — dishi.${resolved.dossier.username}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      // The dish photo is already a public storage URL (the bucket serves
      // getPublicUrl), so the richest part of the card costs nothing.
      ...(a.photo_url ? { images: [{ url: a.photo_url }] } : {}),
    },
    twitter: {
      card: a.photo_url ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(a.photo_url ? { images: [a.photo_url] } : {}),
    },
  };
}

export default async function PublicDishPage({ params }: Params) {
  const resolved = await resolveDossier(params.username, params.dishId);
  const anchor = resolved?.dossier.anchors[0];
  // Not published, unpublished since, never rated, or not this person's —
  // all one answer. A 404 is the honest response to a revoked link.
  if (!resolved || !anchor) notFound();

  // Same owner check the dossier runs: an owner viewing their own shared dish
  // gets no bookmark affordance (the API refuses your own dish) and no
  // "build your own" CTA aimed at them.
  let isOwner = false;
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    isOwner = user?.id === resolved.ownerId;
  } catch { /* signed-out viewers are the normal case — that is who this is for */ }

  return <PublicDish anchor={anchor} username={resolved.dossier.username} isOwner={isOwner} />;
}
