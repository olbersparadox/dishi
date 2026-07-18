import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { translateNames, type TranslateItem } from '@/lib/nameTranslate';
import { type LangCode } from '@/lib/i18n-dict';

export const maxDuration = 30;

/**
 * POST /api/dishes/translate  { items: [{key, name, name_zh?}], lang }
 *   -> { translations: { key: translatedName } }
 *
 * Slice 1: ephemeral only — translate the given canonical names into one target
 * language in a single batched LLM call and return them. The client caches the
 * result in memory. Persisting to dishes.names (so a second visit is instant) is a
 * later slice; the request shape is already keyed so persistence can be layered on
 * without a client change.
 *
 * Auth required (translation is a signed-in surface; keeps the endpoint from being
 * an open translation proxy).
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lang = body?.lang as LangCode | undefined;
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!lang) return NextResponse.json({ error: 'lang is required.' }, { status: 400 });

  const items: TranslateItem[] = rawItems
    .filter((i: any) => i && typeof i.key === 'string' && typeof i.name === 'string')
    .slice(0, 60) // one screen's worth; a bad client can't fan this out unbounded
    .map((i: any) => ({ key: i.key, name: i.name, name_zh: typeof i.name_zh === 'string' ? i.name_zh : null }));

  const translations = await translateNames(items, lang);
  return NextResponse.json({ translations });
}
