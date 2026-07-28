// Create the profile row if missing, with collision-safe handles.
//
// Split out of AuthGate when the bookmark-driven sign-in sheet arrived
// (sharing batch item 5): two surfaces now create sessions, and a person who
// signs up from a shared dish link needs a profile row exactly as much as one
// who signed up at the front door.
//
// The handle minted here is the legacy EMAIL-DERIVED one — deliberately not a
// claimed username. hasClaimedUsername (lib/username.ts) is what tells the two
// apart, which is why nothing public resolves off a handle alone.
import type { supabaseBrowser } from '@/lib/supabase/client';

export async function ensureProfile(
  supabase: ReturnType<typeof supabaseBrowser>,
  user: { id: string; email?: string },
) {
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing) return;

  const base = (user.email?.split('@')[0] ?? 'diner').slice(0, 24) || 'diner';
  for (let attempt = 0; attempt < 4; attempt++) {
    const handle = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('profiles').insert({ id: user.id, handle });
    if (!error) return;
    if (error.code === '23505' && error.message.includes('profiles_pkey')) return;
    if (error.code !== '23505') { console.error('profile create failed', error); return; }
  }
  await supabase.from('profiles').insert({ id: user.id, handle: `diner-${user.id.slice(0, 8)}` });
}
