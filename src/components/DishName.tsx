'use client';
import { useEffect } from 'react';
import { useLang, pickNames, isCanonical, dishNameKey, type LangCode } from '@/lib/i18n';
import { useTranslation } from '@/lib/translation';

/**
 * The dish-name treatment, now driven by the language PAIR (globe picker):
 *   primary (big, bold) over secondary (small, thin), each in its slot's language.
 * Default pair 中文/English -> identical to before.
 *
 * Resolution per slot language L:
 *   - L is canonical (zh/en) -> name_zh / name directly.
 *   - else -> the cached translation if present; otherwise fall back to the
 *     CHROME-language canonical (shown instantly) and request the translation,
 *     which appears when the batch lands.
 * If both slots resolve to the same string, only the primary renders (no dupes).
 */
export default function DishName({
  id,
  name,
  name_zh,
  name_original,
  size = 'md',
  prefix,
  suffix,
}: {
  /** Dish row id, when this name belongs to a saved dish. Enables persisting the
   * translation to dishes.names (a second visit is then free). Omitted for
   * not-yet-saved names (e.g. scan results), which translate ephemerally. */
  id?: string;
  name: string;
  name_zh?: string | null;
  name_original?: string | null;
  size?: 'lg' | 'md';
  /** Rendered inline before the primary name at the same size/weight —
   * used for the rank ("1. ") in scan results per the design handoff. */
  prefix?: string;
  /** Rendered inline right after the primary (core) dish name — e.g. the
   * 封印 seal stamp — so it sits on the same line as the core name rather
   * than floating beside the whole two-line bilingual block. */
  suffix?: React.ReactNode;
}) {
  const { pair, lang } = useLang();
  const { cache, register } = useTranslation();
  const { en, zh } = pickNames({ name, name_zh, name_original });
  const key = dishNameKey({ name, name_zh });

  // Request any non-canonical slot we don't yet have. In an effect so registering a
  // need never runs a state update during render.
  useEffect(() => {
    for (const code of [pair.primary, pair.secondary] as LangCode[]) {
      if (!isCanonical(code) && !cache[key]?.[code]) register({ id, name, name_zh, name_original }, code);
    }
  }, [pair.primary, pair.secondary, key, cache, register, id, name, name_zh, name_original]);

  const resolve = (code: LangCode): string | undefined => {
    if (code === 'en') return en;
    if (code === 'zh') return zh;
    return cache[key]?.[code]; // translated, or undefined while it loads
  };
  // While a translation is missing, show the chrome-language canonical in its place.
  const fallback = (lang === 'zh' ? zh : en) ?? en ?? zh;

  const primary = resolve(pair.primary) ?? fallback;
  let secondary = resolve(pair.secondary) ?? fallback;
  if (secondary === primary) secondary = undefined; // never render the same string twice
  if (!primary) return null;

  return (
    <span className={`dishname ${size === 'lg' ? 'dishname-lg' : ''}`}>
      <span className="dishname-primary">{prefix}{primary}{suffix}</span>
      {secondary && <span className="dishname-secondary">{secondary}</span>}
    </span>
  );
}
