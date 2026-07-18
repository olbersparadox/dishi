'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  dict, chromeLangOf, type Lang, type LangCode, type LangPair,
} from './i18n-dict';

export type { Lang, LangCode, LangPair } from './i18n-dict';
export {
  pickNames, cuisineLabel, LANGUAGES, languageLabel, CANONICAL_PAIR, isCanonical, dishNameKey, menuLanguageToCode, resolveNamePair, hasNonChineseScript,
  foreignMenuSecondary, scanPresetPair,
} from './i18n-dict';

/**
 * Lightweight i18n — dictionary + context, no framework.
 *
 * Two layers, deliberately separated (the globe spec's ripple-containment):
 *  - CHROME language: a binary zh-Hant(HK)/en that EVERY t() call and the whole
 *    dictionary use. It is DERIVED from the pair and never set on its own.
 *  - Dish-name PAIR: primary + secondary display languages (any of LANGUAGES).
 *    Only DishName consumes this. Default 中文/English -> the app is pixel-identical
 *    for anyone who never opens the globe.
 */
const PAIR_KEY = 'dishi-pair';
const LEGACY_LANG_KEY = 'dishi-lang'; // pre-globe single chrome-lang setting

type I18nContext = {
  lang: Lang;
  setLang: (l: Lang) => void; // back-compat: sets the canonical pair with l primary
  t: (key: string, params?: Record<string, string | number>) => string;
  pair: LangPair;
  setSlot: (slot: 'primary' | 'secondary', code: LangCode) => void;
  swapPair: () => void;
};

const DEFAULT_PAIR: LangPair = { primary: 'zh', secondary: 'en' };

const Ctx = createContext<I18nContext>({
  lang: 'zh', setLang: () => {}, t: (k) => k,
  pair: DEFAULT_PAIR, setSlot: () => {}, swapPair: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [pair, setPairState] = useState<LangPair>(DEFAULT_PAIR);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PAIR_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.primary && p?.secondary && p.primary !== p.secondary) { setPairState(p); return; }
      }
      // Migrate a pre-globe chrome-lang setting into a pair, so an English user
      // keeps English primary.
      const legacy = localStorage.getItem(LEGACY_LANG_KEY);
      if (legacy === 'en') setPairState({ primary: 'en', secondary: 'zh' });
    } catch { /* private mode etc. — default stands */ }
  }, []);

  function persist(p: LangPair) {
    setPairState(p);
    try { localStorage.setItem(PAIR_KEY, JSON.stringify(p)); } catch { /* fine */ }
  }

  // Setting a slot to the value the OTHER slot already holds swaps them (the two
  // must always differ), matching the spec's "picking the other slot's language
  // swaps them".
  function setSlot(slot: 'primary' | 'secondary', code: LangCode) {
    const other = slot === 'primary' ? pair.secondary : pair.primary;
    if (code === other) { persist({ primary: pair.secondary, secondary: pair.primary }); return; }
    persist(slot === 'primary' ? { primary: code, secondary: pair.secondary } : { primary: pair.primary, secondary: code });
  }

  function swapPair() { persist({ primary: pair.secondary, secondary: pair.primary }); }

  function setLang(l: Lang) { persist(l === 'en' ? { primary: 'en', secondary: 'zh' } : { primary: 'zh', secondary: 'en' }); }

  const lang = chromeLangOf(pair);

  function t(key: string, params?: Record<string, string | number>): string {
    let s = dict[key]?.[lang] ?? dict[key]?.en ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  return <Ctx.Provider value={{ lang, setLang, t, pair, setSlot, swapPair }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
