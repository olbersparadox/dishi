import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scanMenu, inferAttributesFromText } from '@/lib/menuScan';

export const maxDuration = 60;

/**
 * Owner menu management. RLS enforces the claim requirement at the database layer.
 *
 * GET   /api/restaurant/menu?restaurant_id=X — full menu incl. unavailable items
 * POST  /api/restaurant/menu (JSON)      { restaurant_id, name, price?, description?, cuisine? }
 *        — hand-add one item; attributes inferred from the text so personalization
 *          works (neutral {} without an API key, never wrong-by-guess)
 * POST  /api/restaurant/menu (multipart) restaurant_id + photo
 *        — bulk import: the SAME menu scanner diners use reads the owner's physical
 *          menu and creates every item, attributes included. The 30-second bootstrap.
 * PATCH /api/restaurant/menu             { item_id, available? , name?, price?, description? }
 */
export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const restaurantId = req.nextUrl.searchParams.get('restaurant_id');
  if (!restaurantId) return NextResponse.json({ error: 'restaurant_id is required.' }, { status: 400 });

  const { data: items, error } = await supabase
    .from('restaurant_menu_items')
<<<<<<< HEAD
    .select('id, name, name_zh, name_original, description, price, cuisine, available, position')
=======
    .select('id, name, name_original, description, price, cuisine, available, position')
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
    .eq('restaurant_id', restaurantId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: items ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const contentType = req.headers.get('content-type') ?? '';

  // ---- bulk import from a menu photo ----
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const restaurantId = form.get('restaurant_id') as string | null;
    const photo = form.get('photo') as File | null;
    if (!restaurantId || !photo) {
      return NextResponse.json({ error: 'restaurant_id and a menu photo are required.' }, { status: 400 });
    }

    const bytes = Buffer.from(await photo.arrayBuffer());
    const scan = await scanMenu(bytes.toString('base64'), photo.type && photo.type.startsWith('image/') ? photo.type : 'image/jpeg');
    if (scan.items.length === 0) {
      return NextResponse.json({ error: 'Could not read any dishes from that photo.' }, { status: 422 });
    }

    const rows = scan.items.map((m, i) => ({
      restaurant_id: restaurantId,
      name: m.name,
<<<<<<< HEAD
      name_zh: m.name_zh,
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
      name_original: m.name_original !== m.name ? m.name_original : null,
      description: m.description,
      price: m.price,
      cuisine: m.cuisine,
      attributes: m.attributes,
      position: i,
    }));
    const { data: inserted, error } = await supabase
      .from('restaurant_menu_items').insert(rows).select('id');
    if (error) {
      const msg = error.code === '42501' ? 'Claim this restaurant first.' : error.message;
      return NextResponse.json({ error: msg }, { status: error.code === '42501' ? 403 : 500 });
    }
    return NextResponse.json({ imported: inserted?.length ?? 0, mock: scan.mock });
  }

  // ---- hand-add one item ----
  const body = await req.json().catch(() => ({}));
  const restaurantId = body.restaurant_id;
  const name = String(body.name ?? '').trim().slice(0, 120);
  if (!restaurantId || !name) {
    return NextResponse.json({ error: 'restaurant_id and a dish name are required.' }, { status: 400 });
  }
  const description = body.description ? String(body.description).slice(0, 300) : null;
  const cuisine = body.cuisine ? String(body.cuisine).toLowerCase().slice(0, 40) : null;

  const attributes = await inferAttributesFromText(name, description, cuisine);

  const { data: item, error } = await supabase
    .from('restaurant_menu_items')
    .insert({
      restaurant_id: restaurantId,
      name,
      description,
      price: body.price ? String(body.price).slice(0, 20) : null,
      cuisine,
      attributes,
    })
    .select('id, name, price, available')
    .single();
  if (error) {
    const msg = error.code === '42501' ? 'Claim this restaurant first.' : error.message;
    return NextResponse.json({ error: msg }, { status: error.code === '42501' ? 403 : 500 });
  }
  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!body.item_id) return NextResponse.json({ error: 'item_id is required.' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.available === 'boolean') patch.available = body.available;
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
  if (typeof body.price === 'string') patch.price = body.price.slice(0, 20) || null;
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 300) || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const { data: item, error } = await supabase
    .from('restaurant_menu_items')
    .update(patch)
    .eq('id', body.item_id)
    .select('id, name, price, available')
    .single();
  if (error || !item) return NextResponse.json({ error: error?.message ?? 'Item not found or not yours.' }, { status: 403 });
  return NextResponse.json({ item });
}
