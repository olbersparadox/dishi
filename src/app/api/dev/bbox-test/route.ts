import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { callClaude, imagePart, textPart, parseJsonResponse } from '@/lib/openrouter';
import { analyzeGrounding, groundingUsable } from '@/lib/bbox';

export const maxDuration = 60;

/**
 * VALIDATION HARNESS — not a product feature. Answers one question before any
 * overlay UI gets built: can the PRODUCTION vision model ground menu items to
 * bounding boxes accurately enough on REAL menu photos?
 *
 * POST multipart { photo } -> { items: [{ name, name_zh, price, box|null,
 * rejectReason? }], stats, usable, elapsed_ms, raw_sample }
 *
 * Pass/fail criteria (fixed before testing):
 *  - >= 80% of dishes get a valid box, centered on the right dish (visual check)
 *  - no systematic column confusion on 2-column menus (heavyOverlapShare < 15%)
 *  - < 5% degenerate/out-of-range after normalization
 *  - elapsed time comparable to a normal scan
 * Auth-gated like every other route; costs one model call per use.
 */
const GROUND_SYSTEM = `You read a restaurant menu photo and locate each dish on it.
Respond with ONLY a JSON array, no markdown fences:
[{"name": string (English), "name_zh": string|null (Traditional Chinese if printed or translatable),
  "price": string|null,
  "bbox": [x1, y1, x2, y2]}]
bbox is the tight rectangle around THAT dish's own text block (its name line(s),
plus its price if adjacent), in integer coordinates from 0 to 1000, where x is
fraction of image WIDTH x 1000 and y is fraction of image HEIGHT x 1000.
Each dish gets its OWN rectangle — never one rectangle around a whole section or
column. If you cannot locate a dish confidently, set its bbox to null rather than
guessing.`;

export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const form = await req.formData();
  const photo = form.get('photo') as File | null;
  if (!photo) return NextResponse.json({ error: 'photo is required' }, { status: 400 });

  const buf = Buffer.from(await photo.arrayBuffer());
  const started = Date.now();
  const text = await callClaude(GROUND_SYSTEM, [
    imagePart(buf.toString('base64'), photo.type || 'image/jpeg'),
    textPart('Locate every dish on this menu.'),
  ], { maxTokens: 3500 });
  const elapsed_ms = Date.now() - started;

  const parsed = parseJsonResponse<any[]>(text);
  if (!Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Model response did not parse.', raw_sample: (text ?? '').slice(0, 400), elapsed_ms }, { status: 502 });
  }

  const { results, stats } = analyzeGrounding(parsed.map(i => i?.bbox));
  const items = parsed.map((i, idx) => ({
    name: String(i?.name ?? `item ${idx + 1}`),
    name_zh: i?.name_zh ?? null,
    price: i?.price ?? null,
    box: results[idx].ok ? (results[idx] as any).box : null,
    rejectReason: results[idx].ok ? undefined : (results[idx] as any).reason,
  }));

  return NextResponse.json({ items, stats, usable: groundingUsable(stats), elapsed_ms, raw_sample: (text ?? '').slice(0, 300) });
}
