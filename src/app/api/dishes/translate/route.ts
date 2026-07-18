import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { translateNames, type TranslateItem } from '@/lib/nameTranslate';
import { type LangCode } from '@/lib/i18n-dict';

export const maxDuration = 30;

/**
 * POST /api/dishes/translate  { items: [{key, id?, name, name_zh?}], lang }
 *   -> { translations: { key: translatedName } }
 *
 * Presentation-only translation of dish names into ONE non-canonical language.
 *  - Items WITH an id are cached in dishes.names (Mode A): a hit returns instantly
 *    with no LLM call, a miss is translated once and written back, so a later visit
 *    (even a new session) is free. Only the caller's OWN dishes persist — a write to
 *    someone else's dish is blocked by RLS and simply falls through to ephemeral.
 *  - Items WITHOUT an id (e.g. scan results before they're saved) are translated
 *    ephemerally (Mode B), never persisted.
 * name / name_zh stay the canonical identity; dishes.names is a display cache only.
 * Auth required.
 */
export async function POST(req: NextRequest) {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const lang = body?.lang as LangCode | undefined;
  const rawItems = Array.isArray(body?.items) ? body.items : [];
  if (!lang) return NextResponse.json({ error: 'lang is required.' }, { status: 400 });

  type In = TranslateItem & { id?: string };
  const items: In[] = rawItems
    .filter((i: any) => i && typeof i.key === 'string' && typeof i.name === 'string')
    .slice(0, 60)
    .map((i: any) => ({ key: i.key, name: i.name, name_zh: typeof i.name_zh === 'string' ? i.name_zh : null, id: typeof i.id === 'string' ? i.id : undefined }));

  const translations: Record<string, string> = {};

  // 1. Cache lookup for id'd items — existing names[lang] returns with no LLM call.
  const ids = Array.from(new Set(items.map(i => i.id).filter((x): x is string => !!x)));
  const existingNames = new Map<string, Record<string, string>>();
  if (ids.length) {
    const { data } = await supabase.from('dishes').select('id, names').in('id', ids);
    for (const d of (data ?? []) as any[]) {
      const names = (d.names ?? {}) as Record<string, string>;
      existingNames.set(d.id, names);
      if (typeof names[lang] === 'string' && names[lang].trim()) {
        for (const it of items) if (it.id === d.id) translations[it.key] = names[lang];
      }
    }
  }

  // 2. Translate the misses (both id'd-uncached and id-less) in one batched call.
  const misses = items.filter(i => translations[i.key] === undefined);
  const fresh = await translateNames(misses.map(i => ({ key: i.key, name: i.name, name_zh: i.name_zh ?? null })), lang);
  Object.assign(translations, fresh);

  // 3. Persist freshly-translated names for OWN id'd dishes (merge into names jsonb).
  const writes: PromiseLike<unknown>[] = [];
  const seen = new Set<string>();
  for (const it of misses) {
    if (!it.id || seen.has(it.id)) continue;
    const val = fresh[it.key];
    if (typeof val !== 'string') continue;
    seen.add(it.id);
    const merged = { ...(existingNames.get(it.id) ?? {}), [lang]: val };
    writes.push(supabase.from('dishes').update({ names: merged }).eq('id', it.id).eq('user_id', user.id));
  }
  if (writes.length) await Promise.allSettled(writes);

  return NextResponse.json({ translations });
}
