import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { reauthorZhNames } from '@/lib/nameTranslate';
import { hasNonChineseScript } from '@/lib/i18n-dict';

export const maxDuration = 30;

/**
 * POST /api/menu-scan/fix-names  { items: [{key, name, name_zh}] }
 *   -> { names: { key: corrected Traditional-Chinese name } }
 *
 * The kana/hangul tripwire's re-author step. The skeleton model (qwen) leaks the
 * printed Japanese/Korean name into "z" often enough that the scan prompt's
 * "translate to Chinese" wording is not a guarantee. This endpoint is the
 * guarantee: it re-checks each item's name_zh with the deterministic detector and
 * re-authors ONLY the tripped ones — from the reliable English `name`, through the
 * demonstrably-compliant translate path (buildTranslatePrompt('zh')). One batched
 * LLM call, and none at all when nothing tripped. Returns only the keys it fixed;
 * the client patches those name_zh in place. Auth required.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  // Re-check server-side rather than trusting the client's pre-filter: the detector
  // is the contract, and it costs nothing to enforce it here too.
  const tripped = rawItems
    .filter((i: any) => i && typeof i.key === 'string' && typeof i.name === 'string' && hasNonChineseScript(i.name_zh))
    .slice(0, 60)
    .map((i: any) => ({ key: i.key, name: i.name }));

  if (tripped.length === 0) return NextResponse.json({ names: {} });

  const names = await reauthorZhNames(tripped);
  return NextResponse.json({ names });
}
