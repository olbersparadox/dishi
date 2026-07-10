import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export const maxDuration = 30;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function safeMediaType(t: string | undefined | null): string {
  return t && ALLOWED_IMAGE_TYPES.has(t) ? t : 'image/jpeg';
}

/**
 * POST /api/dishes/photo
 * multipart/form-data: dish_id, photo
 *
 * Lets a photo be attached to a dish AFTER the fact — specifically for picks (from
 * a menu scan or Table Mode) that were rated with no photo at all. Ownership is
 * enforced by the same RLS "own dishes updatable" policy the rename/edit path uses
 * (the UPDATE simply matches zero rows for a dish that isn't the caller's), not a
 * separate check here.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const form = await req.formData();
  const dishId = form.get('dish_id') as string | null;
  const photo = form.get('photo') as File | null;
  if (!dishId || !photo) return NextResponse.json({ error: 'dish_id and a photo are required.' }, { status: 400 });

  const bytes = Buffer.from(await photo.arrayBuffer());
  const mediaType = safeMediaType(photo.type);
  const path = `${user.id}/${Date.now()}-${(photo.name || 'photo.jpg').replace(/[^\w.\-]/g, '_')}`;

  const { error: upErr } = await supabase.storage.from('dish-photos').upload(path, bytes, { contentType: mediaType });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: pub } = supabase.storage.from('dish-photos').getPublicUrl(path);

  const { data, error } = await supabase
    .from('dishes').update({ photo_url: pub.publicUrl }).eq('id', dishId)
    .select('id, photo_url').single();
  if (error || !data) return NextResponse.json({ error: 'Dish not found or not yours.' }, { status: 403 });

  return NextResponse.json({ dish: data });
}
