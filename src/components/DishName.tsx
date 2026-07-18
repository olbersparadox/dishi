'use client';
import { useEffect } from 'react';
import { useLang, pickNames, isCanonical, dishNameKey, resolveNamePair, type LangCode, type LangPair } from '@/lib/i18n';
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
  pair: pairOverride,
  menuLanguage,
}: {
  /** Dish row id, when this name belongs to a saved dish. Enables persisting the
   * translation to dishes.names (a second visit is then free). Omitted for
   * not-yet-saved names (e.g. scan results), which translate ephemerally. */
  id?: string;
  name: string;
  name_zh?: string | null;
  name_original?: string | null;
  size?: 'lg' | 'md';
  /** Overrides the global pair for this name (scan results use a session preset
   * that shows a foreign menu's own language as the secondary). */
  pair?: LangPair;
  /** The scanned menu's language. FIDELITY RULE: a display slot whose language IS
   * the menu's language renders name_original (the exact printed text) — perfect
   * for point-and-order, and no translation call. */
  menuLanguage?: LangCode | null;
  /** Rendered inline before the primary name at the same size/weight —
   * used for the rank ("1. ") in scan results per the design handoff. */
  prefix?: string;
  /** Rendered inline right after the primary (core) dish name — e.g. the
   * 封印 seal stamp — so it sits on the same line as the core name rather
   * than floating beside the whole two-line bilingual block. */
  suffix?: React.ReactNode;
}) {
  const { pair: ctxPair, lang } = useLang();
  const pair = pairOverride ?? ctxPair;
  const { cache, register } = useTranslation();
  const { en, zh } = pickNames({ name, name_zh, name_original });
  const key = dishNameKey({ name, name_zh });

  // Request any non-canonical slot we don't yet have — EXCEPT a slot that matches
  // the menu's own language, where we render the printed original (no call). In an
  // effect so registering a need never runs a state update during render.
  useEffect(() => {
    for (const code of [pair.primary, pair.secondary] as LangCode[]) {
      if (!isCanonical(code) && code !== menuLanguage && !cache[key]?.[code]) register({ id, name, name_zh, name_original }, code);
    }
  }, [pair.primary, pair.secondary, key, cache, register, id, name, name_zh, name_original, menuLanguage]);

  const { primary, secondary } = resolveNamePair({
    pair, chromeLang: lang, en, zh,
    translated: (code) => cache[key]?.[code],
    nameOriginal: name_original, menuLanguage,
  });
  if (!primary) return null;

  return (
    <span className={`dishname ${size === 'lg' ? 'dishname-lg' : ''}`}>
      <span className="dishname-primary">{prefix}{primary}{suffix}</span>
      {secondary && <span className="dishname-secondary">{secondary}</span>}
    </span>
  );
}
