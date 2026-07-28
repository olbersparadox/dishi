import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';

/**
 * The in-feed review's two verbs (BACKLOG batch 2026-07-29 — review happens
 * in 大家食 itself, on the real card, never on an admin page):
 *
 *   PATCH  { action: 'publish' } — pending → published, stamped now. The
 *          publication stamp is the feed clock, so an approved draft surfaces
 *          as new rather than buried at its authoring date.
 *   DELETE                       — discard a draft (or retract a published
 *          post). Row deletion, not a tombstone: dishes.from_persona_post_id
 *          is ON DELETE SET NULL, so someone's already-bookmarked 待評 row
 *          survives — the bookmark became THEIR queue entry when they tapped.
 *
 * Gate: profiles.is_persona_editor — a DB flag, deliberately not an env var.
 * persona_posts is RLS-locked with no policies, so every touch goes through
 * the admin client AFTER this gate; there is no client-side path to a draft.
 */
async function requireEditor() {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const { data: profile } = await supabaseAdmin()
    .from('profiles').select('is_persona_editor').eq('id', user.id).maybeSingle();
  if (!profile?.is_persona_editor) {
    return { error: NextResponse.json({ error: 'Editors only.' }, { status: 403 }) };
  }
  return { error: null };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireEditor();
  if (gate.error) return gate.error;

  const body = await req.json().catch(() => null);
  if (body?.action !== 'publish') {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('persona_posts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('id')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'That post is gone.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireEditor();
  if (gate.error) return gate.error;

  const { error } = await supabaseAdmin()
    .from('persona_posts').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
