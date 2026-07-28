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
// any rating surface — this page is reached by shared URL only.
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
  // force-dynamic page — verified live: the hide-restaurants PATCH landed in
  // the DB while reloads kept serving the cached read. A public page must
  // always reflect the stored flag, so opt this render out of the Data Cache.
  noStore();
  const u = normalizeUsername(decodeURIComponent(rawName));
  if (validateUsername(u)) return null; // wrong shape can't be a claimed name
  const admin = supabaseAdmin();
  const { data: prof } = await admin
    .from('profiles')
    .select('id, handle, username_set_at, public_hide_restaurants')
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

  // Positive anchors with restaurant names — the credibility layer. Scores and
  // dates ride only as far as the projection, which drops them.
  const { data: rated } = await admin
    .from('ratings')
    .select('score, dishes!inner(name, name_zh, restaurants(name))')
    .eq('user_id', prof.id)
    .gte('score', 0.4)
    .order('score', { ascending: false })
    .limit(24);
  const anchors: DossierRawAnchor[] = (rated ?? []).map(r => {
    const d = r.dishes as unknown as { name: string | null; name_zh: string | null; restaurants: { name: string | null } | null };
    return { name: d?.name ?? null, name_zh: d?.name_zh ?? null, restaurant: d?.restaurants?.name ?? null, score: Number(r.score) };
  });

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
      hideRestaurants: !!prof.public_hide_restaurants,
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

  // Owner check (for the hide-restaurants toggle): the page itself needs no
  // session, but IF the viewer is this dossier's owner, they get its one
  // control. supabaseServer respects cookies; absent session = plain visitor.
  let isOwner = false;
  try {
    const { data: { user } } = await supabaseServer().auth.getUser();
    isOwner = user?.id === resolved.ownerId;
  } catch { /* signed-out viewers are the normal case */ }

  return <PublicDossier dossier={resolved.dossier} isOwner={isOwner} />;
}
