import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { DIMS } from '@/lib/taste';
import { computeExportDelta } from '@/lib/tasteExport';
import { isPersona } from '@/lib/persona';

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  // The chosen voice, if the client is committing one on this export. Validated; an
  // absent/invalid persona leaves the stored choice untouched.
  const body = await req.json().catch(() => ({}));
  const persona = isPersona(body?.persona) ? body.persona : null;

  const { data: profile } = await supabase
    .from('taste_profiles')
    .select('vector, profile_version, last_export_vector, persona')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'No taste profile yet.' }, { status: 404 });

  const vector = (profile.vector ?? {}) as Record<string, number>;
  const prior = (profile.last_export_vector ?? null) as Record<string, number> | null;
  const delta = computeExportDelta(vector, prior, DIMS);

  const nextVersion = (profile.profile_version ?? 1) + 1;
  const { error } = await supabase.from('taste_profiles').update({
    profile_version: nextVersion,
    last_export_vector: vector,
    last_export_at: new Date().toISOString(),
    ...(persona ? { persona } : {}),
  }).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    profile_version: nextVersion, delta, is_first_export: !prior,
    persona: persona ?? profile.persona ?? 'honest',
  });
}
