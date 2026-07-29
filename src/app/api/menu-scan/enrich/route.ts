import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { enrichOneDish, type OcrMenuItem } from '@/lib/menuScan';

// 60, not 30: enrichOneDish is up to TWO sequential LLM calls (first pass +
// the one tripwire re-ask — and the seafood tripwire fires often on exactly
// the Japanese menus that also run slow), each with its own retry ladder at
// ~12s/attempt. 30 killed the function mid-second-call on a degraded provider
// and those dishes' chips never arrived at all (2026-07-29 Japanese scan).
export const maxDuration = 60;

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
