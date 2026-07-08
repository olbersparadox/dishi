import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scanMenu, MenuItem } from '@/lib/menuScan';
import { contentScore, toMatchPercent, emptyTaste, DIMS, TasteVector } from '@/lib/taste';

export const maxDuration = 60;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function safeMediaType(t: string | undefined | null): string {
  return t && ALLOWED_IMAGE_TYPES.has(t) ? t : 'image/jpeg';
}


/**
 * POST /api/menu-scan
 * multipart/form-data: photo (a photograph of an entire physical menu)
 *
 * Pipeline: vision model extracts every dish + attributes (perception) -> the SAME
 * contentScore() that ranks the feed scores each item against this user's taste vector
 * (judgment) -> reasons are composed deterministically from the actual matched
 * dimensions (explanation). No step where a model free-writes "you'll love this" —
 * every claim traces to the user's real data.
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
  const scan = await scanMenu(bytes.toString('base64'), safeMediaType(photo.type));
  const elapsed_ms = Date.now() - started;
  console.log(`menu-scan: ${scan.items.length} items in ${elapsed_ms}ms (mock=${scan.mock})`);

  if (scan.items.length === 0) {
    return NextResponse.json({
      error: 'The scan failed or took too long. Try again — closer, flatter, better light; or scan one page at a time.',
      elapsed_ms,
    }, { status: 422 });
  }

  const { data: profile } = await supabase
    .from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const taste: TasteVector = profile?.vector ?? emptyTaste();
  const affinity: Record<string, number> = profile?.cuisine_affinity ?? {};
  const ratingCount: number = profile?.rating_count ?? 0;

  const ranked = scan.items
    .map(item => {
      const raw = contentScore(taste, item.attributes, affinity, item.cuisine);
      return {
        ...item,
        match: toMatchPercent(raw),
        raw_score: raw,
        reason: ratingCount >= 5 ? composeReason(item, taste, affinity) : null,
        caution: ratingCount >= 5 ? composeCaution(item, taste) : null,
      };
    })
    .sort((a, b) => b.raw_score - a.raw_score);

  const TRAINING_THRESHOLD = 5;
  return NextResponse.json({
    profile_ready: ratingCount >= TRAINING_THRESHOLD,
    rating_count: ratingCount,
    needed: TRAINING_THRESHOLD,
    elapsed_ms,
    menu_language: scan.menu_language,
    restaurant_guess: scan.restaurant_guess,
    mock: scan.mock,
    items: ranked,
  });
}

// ---------------------------------------------------------------------------
// Deterministic, data-grounded explanations. Each dim gets human phrasing; a reason
// is built from the dims where (user loves it) x (dish has it) is strongest. This is
// explainable-AI by construction: if the reason says "deep umami", it's because the
// user's umami preference and the dish's umami presence are both actually high.
// ---------------------------------------------------------------------------

const DIM_PHRASES: Record<string, string> = {
  sweet: 'a sweet edge', salty: 'bold saltiness', sour: 'bright acidity', bitter: 'bitter depth',
  umami: 'deep umami', spicy: 'real heat',
  crispy: 'proper crunch', creamy: 'creamy body', chewy: 'satisfying chew', tender: 'melting tenderness',
  rich: 'unapologetic richness', fresh: 'clean freshness',
  fried: 'fried indulgence', grilled: 'char from the grill', braised: 'slow-braised depth',
  steamed: 'delicate steaming', raw: 'raw purity', baked: 'baked comfort',
};

function composeReason(item: MenuItem, taste: TasteVector, affinity: Record<string, number>): string {
  const hits = DIMS
    .map(d => ({ d, strength: (taste[d] ?? 0) * (item.attributes[d] ?? 0) }))
    .filter(h => h.strength > 0.12 && (taste[h.d] ?? 0) > 0.15)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2);

  const cuisineLove = (affinity[item.cuisine] ?? 0) > 0.3;

  if (hits.length === 0) {
    return cuisineLove
      ? `Your track record with ${item.cuisine} food says try it`
      : 'A wildcard for your palate — nothing here you usually chase';
  }
  const phrases = hits.map(h => DIM_PHRASES[h.d] ?? h.d);
  const core = phrases.length === 2 ? `${cap(phrases[0])} and ${phrases[1]}` : cap(phrases[0]);
  return cuisineLove
    ? `${core} — and it's ${item.cuisine}, which you keep coming back to`
    : `${core} — squarely what you keep rating up`;
}

function composeCaution(item: MenuItem, taste: TasteVector): string | null {
  const warn = DIMS
    .map(d => ({ d, strength: -(taste[d] ?? 0) * (item.attributes[d] ?? 0) }))
    .filter(h => h.strength > 0.2)
    .sort((a, b) => b.strength - a.strength)[0];
  if (!warn) return null;
  return `Heads up: ${DIM_PHRASES[warn.d] ?? warn.d} — historically not your thing`;
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
