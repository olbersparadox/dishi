import { NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { scanMenuSkeleton, scanMenuSkeletonStream } from '@/lib/menuScan';
import { rankMenuItems, markFires } from '@/lib/menuScoring';
import { emptyTaste, type TasteVector } from '@/lib/taste';

export const maxDuration = 60;
const TRAINING_THRESHOLD = 5;

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
function safeMediaType(t: string | undefined | null): string {
  return t && ALLOWED_IMAGE_TYPES.has(t) ? t : 'image/jpeg';
}

const jsonError = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * POST /api/menu-scan — STAGE 1 of 3, STREAMED. Returns newline-delimited JSON
 * (NDJSON), one event per line, so the client can show each dish the moment its
 * OWN identity finishes generating — instead of waiting for the whole menu, then
 * seeing everything appear at once. Event kinds:
 *   {kind:'start', profile_ready, rating_count, needed, mock, phase}
 *     — sent immediately (profile is already known before the model call starts),
 *       so the client can render the results shell right away.
 *   {kind:'item', item}
 *     — one per dish, in the order the model finishes each one. If the user is
 *       under the rating threshold, neutral placeholder score fields are attached
 *       here (server-side, not client-side) so the client never has to reason
 *       about that distinction itself.
 *   {kind:'done', menu_language, restaurant_guess, elapsed_ms}
 *     — sent once, after the stream ends.
 *   {kind:'error', error}
 *     — sent ONLY if literally nothing could be recovered (mirrors the old
 *       "zero items" hard-failure case) — a partial scan (some dishes, then a
 *       drop) still ends in a normal 'done', with whatever was recovered.
 *
 * Stage 2 (enrichment) and Stage 3 (flavor scoring) are unchanged: per-dish,
 * concurrency-capped, kicked off by the client once it has the full item list.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError('Sign in to scan menus.', 401);

  const form = await req.formData();
  const photo = form.get('photo') as File | null;
  if (!photo) return jsonError('A menu photo is required.', 400);

  const bytes = Buffer.from(await photo.arrayBuffer());
  const mediaType = safeMediaType(photo.type);

  // Profile is fetched BEFORE the model call starts — a small, fast query, so
  // fetching it first costs nothing, and it means the terminal metadata the
  // client needs (profile_ready, rating_count) is available immediately in the
  // very first event rather than bolted on after the whole scan finishes.
  const { data: profile } = await supabase
    .from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle();
  const ratingCount: number = profile?.rating_count ?? 0;
  const profileReady = ratingCount >= TRAINING_THRESHOLD;
  const hasKey = !!process.env.OPENROUTER_API_KEY;

  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      send({
        kind: 'start', profile_ready: profileReady, rating_count: ratingCount, needed: TRAINING_THRESHOLD,
        mock: !hasKey, phase: !hasKey ? 'done' : profileReady ? 'needs_scoring' : 'done',
      });

      // Mock: no network cost, everything already known — emit it as fast events
      // on the SAME protocol, so the client has exactly one code path regardless
      // of whether this is a demo run or a real scan.
      if (!hasKey) {
        const scan = await scanMenuSkeleton('', ''); // internally resolves to mockMenu()
        const taste: TasteVector = profile?.vector ?? emptyTaste();
        const affinity: Record<string, number> = profile?.cuisine_affinity ?? {};
        const ranked = markFires(
          rankMenuItems(scan.items, taste, affinity, profileReady, profile?.evidence ?? undefined),
          taste, profile?.evidence ?? {},
        );
        for (const item of ranked) send({ kind: 'item', item: { ...item, enriched: true } });
        send({ kind: 'done', menu_language: scan.menu_language, restaurant_guess: scan.restaurant_guess, elapsed_ms: Date.now() - started });
        controller.close();
        return;
      }

      let itemCount = 0;
      let menu_language = 'unknown';
      let restaurant_guess: string | null = null;
      try {
        for await (const ev of scanMenuSkeletonStream(bytes.toString('base64'), mediaType)) {
          if (ev.kind === 'item') {
            itemCount++;
            // Under-threshold placeholder fields, applied per-item here (server
            // side) rather than left for the client to reason about — same
            // neutral values the old batch response used.
            const item = profileReady ? ev.item : { ...ev.item, match: 50, raw_score: 0, reason: null, caution: null };
            send({ kind: 'item', item });
          } else {
            menu_language = ev.menu_language;
            restaurant_guess = ev.restaurant_guess;
          }
        }
      } catch (e) {
        console.error('menu-scan/skeleton-stream: failed mid-stream', e);
        // Fall through: whatever streamed successfully before the failure is
        // still valid and already sent — degrade to "fewer dishes," not silence.
      }

      const elapsed_ms = Date.now() - started;
      console.log(`menu-scan/skeleton-stream: ${itemCount} items in ${elapsed_ms}ms`);

      if (itemCount === 0) {
        send({ kind: 'error', error: 'The scan failed or took too long. Try again — closer, flatter, better light; or scan one page at a time.' });
      } else {
        send({ kind: 'done', menu_language, restaurant_guess, elapsed_ms });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' },
  });
}
