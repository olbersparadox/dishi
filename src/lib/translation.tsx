'use client';
// In-memory dish-name translation cache for the globe picker. DishName declares
// "I need this dish in language L"; the provider batches all such needs across a
// screen into ONE call per language (debounced), then streams the results into a
// cache. Canonical shows instantly; the translation appears when it lands.
//
// The cache lives IN the context value so every DishName re-renders when a batch
// arrives. Registrations mutate refs (never state during render) and schedule a
// debounced flush, so declaring a need is cheap and render-safe.
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { dishNameKey, isCanonical, type LangCode } from './i18n-dict';

type Item = { id?: string; name: string; name_zh?: string | null; name_original?: string | null };
type Cache = Record<string, Record<string, string>>; // dishNameKey -> { langCode -> name }

type TranslationContext = {
  cache: Cache;
  register: (item: Item, lang: LangCode) => void;
};

const Ctx = createContext<TranslationContext>({ cache: {}, register: () => {} });

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Cache>({});
  const cacheRef = useRef<Cache>(cache); cacheRef.current = cache;
  // Plain objects (not Maps) so iteration needs no downlevelIteration flag.
  const pendingRef = useRef<Record<string, Record<string, Item>>>({}); // lang -> key -> item
  const inflightRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const pending = pendingRef.current;
    pendingRef.current = {};
    for (const [lang, itemsObj] of Object.entries(pending)) {
      const entries = Object.entries(itemsObj);
      if (!entries.length) continue;
      const items = entries.map(([key, it]) => ({ key, id: it.id, name: it.name, name_zh: it.name_zh ?? null }));
      for (const [key] of entries) inflightRef.current.add(`${lang}:${key}`);
      try {
        const res = await fetch('/api/dishes/translate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, lang }),
        });
        const j = await res.json();
        const translations: Record<string, string> = j.translations ?? {};
        if (Object.keys(translations).length) {
          setCache(prev => {
            const next: Cache = { ...prev };
            for (const [key, val] of Object.entries(translations)) next[key] = { ...(next[key] ?? {}), [lang]: val };
            return next;
          });
        }
      } catch { /* leave uncached — the canonical fallback stays on screen */ }
      finally { for (const [key] of entries) inflightRef.current.delete(`${lang}:${key}`); }
    }
  }, []);

  const register = useCallback((item: Item, lang: LangCode) => {
    if (isCanonical(lang)) return; // zh/en are the canonical names — never translated
    const key = dishNameKey(item);
    if (cacheRef.current[key]?.[lang]) return;              // already cached
    if (inflightRef.current.has(`${lang}:${key}`)) return;  // already being fetched
    const p = pendingRef.current;
    if (!p[lang]) p[lang] = {};
    if (p[lang][key]) return;
    p[lang][key] = item;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 250); // debounce one batch per screen per language
  }, [flush]);

  return <Ctx.Provider value={{ cache, register }}>{children}</Ctx.Provider>;
}

export function useTranslation() { return useContext(Ctx); }
