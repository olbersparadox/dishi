import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scanMenuOCR } from '@/lib/menuScan';
import { rankMenuItems } from '@/lib/menuScoring';
import { emptyTaste, type TasteVector } from '@/lib/taste';

export const maxDuration = 60;
const TRAINING_THRESHOLD = 5;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function safeMediaType(t: string | undefined | null): string {
  return t && ALLOWED_IMAGE_TYPES.has(t) ? t : 'image/jpeg';
}

/**
 * POST /api/menu-scan — PHASE 1 of 2: fast OCR only (names/prices/cuisine/hook, no
 * flavor numbers). This is the step that always runs, and it's deliberately small.
 *
 * If the user is under the rating threshold, this response is the WHOLE scan —
 * the client never calls Phase 2 (/api/menu-scan/score), because a flavor match
 * would be scored against a profile that isn't trustworthy yet. That's also the
 * single biggest real-world speed win: a fresh account (the most common "someone's
 * trying the demo" case) only ever pays for the fast call.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to scan menus.' }, { status: 401 });

  const form = await req.formData();
  const photo = form.get('photo') as File | null;
  if (!photo) return NextResponse.json({ error: 'A menu photo is required.' }, { status: 400 });

  const bytes = Buffer.from(await photo.arrayBuffer());
  const started = Date.now();
  const scan = await scanMenuOCR(bytes.toString('base64'), safeMediaType(photo.type));
  const elapsed_ms = Date.now() - started;
  console.log(`menu-scan/ocr: ${scan.items.length} items in ${elapsed_ms}ms (mock=${scan.mock})`);

  if (scan.items.length === 0) {
    return NextResponse.json({
      error: 'The scan failed or took too long. Try again — closer, flatter, better light; or scan one page at a time.',
      elapsed_ms,
    }, { status: 422 });
  }

  const { data: profile } = await supabase
    .from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const ratingCount: number = profile?.rating_count ?? 0;
  const profileReady = ratingCount >= TRAINING_THRESHOLD;

  // Mock already carries hardcoded attributes for free (no network cost) — rank it
  // immediately so the demo path is complete in one response, same as before.
  if (scan.mock) {
    const taste: TasteVector = profile?.vector ?? emptyTaste();
    const affinity: Record<string, number> = profile?.cuisine_affinity ?? {};
    const ranked = rankMenuItems(scan.items, taste, affinity, profileReady);
    return NextResponse.json({
      phase: 'done', profile_ready: profileReady, rating_count: ratingCount, needed: TRAINING_THRESHOLD,
      elapsed_ms, menu_language: scan.menu_language, restaurant_guess: scan.restaurant_guess,
      mock: true, items: ranked,
    });
  }

  // Real scan, under threshold: this IS the final response — no Phase 2 call.
  if (!profileReady) {
    return NextResponse.json({
      phase: 'done', profile_ready: false, rating_count: ratingCount, needed: TRAINING_THRESHOLD,
      elapsed_ms, menu_language: scan.menu_language, restaurant_guess: scan.restaurant_guess,
      mock: false,
      items: scan.items.map(i => ({ ...i, match: 50, raw_score: 0, reason: null, caution: null })),
    });
  }

  // Real scan, profile ready: hand off to Phase 2 for flavor scoring + ranking.
  return NextResponse.json({
    phase: 'needs_scoring', profile_ready: true, rating_count: ratingCount, needed: TRAINING_THRESHOLD,
    elapsed_ms, menu_language: scan.menu_language, restaurant_guess: scan.restaurant_guess,
    mock: false, items: scan.items,
  });
}
