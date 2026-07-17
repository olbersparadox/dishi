import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { enrichOneDish, type OcrMenuItem } from '@/lib/menuScan';

export const maxDuration = 30;

/**
 * POST /api/menu-scan/enrich — STAGE 2, called ONCE PER DISH by the client, several
 * in parallel (capped concurrency client-side, same pattern as /score). Text-only,
 * no image input. Fills in the day-0 utility fields — hook, diet flags, cooking
 * method, heaviness, key ingredients — that need no taste learning at all, so
 * unlike /score this runs for EVERY user regardless of rating count.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to scan menus.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const item: OcrMenuItem | undefined = body?.item;
  if (!item?.name) return NextResponse.json({ error: 'No item to enrich.' }, { status: 400 });

  const enrichment = await enrichOneDish({
    name: item.name_original || item.name,
    // Passed so the diet tripwire (dietSuspicion) can see the Chinese name too — a
    // menu whose English column was translated loosely can hide a protein the
    // 中文 name states plainly (or vice versa).
    name_zh: item.name_zh,
    cuisine: item.cuisine,
    section: item.section,
  });

  return NextResponse.json({ item: { ...item, ...enrichment } });
}
