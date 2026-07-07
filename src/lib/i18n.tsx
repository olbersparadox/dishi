'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { dict, type Lang } from './i18n-dict';

export type { Lang } from './i18n-dict';
export { pickNames, cuisineLabel } from './i18n-dict';

/**
 * Lightweight i18n — dictionary + context, no framework. zh-Hant (HK flavour,
 * DEFAULT) and en. Persists per device. Pure data lives in i18n-dict.ts.
 */
const STORAGE_KEY = 'dishi-lang';

type I18nContext = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const Ctx = createContext<I18nContext>({
  lang: 'zh',
  setLang: () => {},
  t: (k) => k,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh'); // Traditional Chinese by default

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') setLangState(saved);
    } catch { /* private mode etc. — default stands */ }
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* fine */ }
  }

  function t(key: string, params?: Record<string, string | number>): string {
    let s = dict[key]?.[lang] ?? dict[key]?.en ?? key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}
