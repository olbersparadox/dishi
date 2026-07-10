import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scoreOneDish, type OcrMenuItem } from '@/lib/menuScan';
import { rankMenuItems } from '@/lib/menuScoring';
import { emptyTaste, type TasteVector } from '@/lib/taste';

export const maxDuration = 30;
const TRAINING_THRESHOLD = 5;

/**
 * POST /api/menu-scan/score — PHASE 2, called ONCE PER DISH by the client, several
 * in parallel (capped concurrency client-side). No image input, so no vision
 * preprocessing latency, and the model only generates 18 numbers — this is what
 * makes per-dish calls viable instead of one call carrying the whole menu's weight.
 *
 * Server re-checks the training threshold independently of the client — a stale
 * client state must not force a scoring call, or fabricate a reason, for a profile
 * that isn't ready.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in to scan menus.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const item: OcrMenuItem | undefined = body?.item;
  if (!item?.name) return NextResponse.json({ error: 'No item to score.' }, { status: 400 });

  const { data: profile } = await supabase
    .from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const ratingCount: number = profile?.rating_count ?? 0;
  if (ratingCount < TRAINING_THRESHOLD) {
    return NextResponse.json({ error: 'Not enough ratings yet for scoring.' }, { status: 409 });
  }

  const attributes = await scoreOneDish({ name: item.name_original || item.name, cuisine: item.cuisine });
  const taste: TasteVector = profile?.vector ?? emptyTaste();
  const affinity: Record<string, number> = profile?.cuisine_affinity ?? {};

  const [ranked] = rankMenuItems([{ ...item, attributes }], taste, affinity, true);
  return NextResponse.json({ item: ranked });
}
