import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { scanMenu, inferAttributesFromText } from '@/lib/menuScan';
import { applyOwnerMenuAuthority, propagateIdentityNameToDishes } from '@/lib/ownerMenuReconcile';

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
    .select('id, name, name_zh, name_original, description, price, cuisine, available, position')
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
      name_zh: m.name_zh,
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
    // The owner's menu is now the authoritative name source for this restaurant.
    // Reconcile existing diner dish_identities against it: exact matches adopt the
    // owner's name, fuzzy ones go through the LLM adjudicator (the owner authored
    // these names, so no human confirm is needed). Admin client because
    // dish_identities are diner-owned. Awaited — serverless kills post-response work.
    await applyOwnerMenuAuthority(supabaseAdmin(), restaurantId, { useLLM: true });
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
  // One newly-published item: adopt it onto any diner identity that exactly matches
  // it. Exact-only (no LLM) — a single hand-typed dish doesn't warrant a fuzzy sweep,
  // and the owner can bulk-import for the full fuzzy reconcile.
  await applyOwnerMenuAuthority(supabaseAdmin(), restaurantId, { useLLM: false });
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
    .select('id, name, name_zh, price, available, restaurant_id')
    .single();
  if (error || !item) return NextResponse.json({ error: error?.message ?? 'Item not found or not yours.' }, { status: 403 });

  // Owner renamed this item: (1) re-point every identity that had adopted its name
  // (linked via owner_menu_item_id) to the NEW name — the gap the owner-authority
  // tier shipped with — and (2) run an exact reconcile so any identity that now
  // matches the new spelling adopts it too.
  if (typeof patch.name === 'string' && item.restaurant_id) {
    const admin = supabaseAdmin();
    // Re-point identities that had adopted this item, then push the new name onto
    // their member dish rows so linked occurrences follow the rename too.
    const { data: repointed } = await admin
      .from('dish_identities')
      .update({ name: item.name, name_zh: item.name_zh ?? null })
      .eq('owner_menu_item_id', item.id)
      .select('id');
    for (const ident of repointed ?? []) {
      await propagateIdentityNameToDishes(admin, ident.id, item.name, item.name_zh ?? null);
    }
    await applyOwnerMenuAuthority(admin, item.restaurant_id, { useLLM: false });
  }
  return NextResponse.json({ item });
}
