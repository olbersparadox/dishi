'use client';
// Cross-component state for the scan page's FOREIGN-MENU language preset (Fix 5).
//
// The preset lives in TWO places at once: the scan page detects the menu's
// language and renders its dishes with that as the secondary; the globe picker
// in the header must SHOW that same effective secondary and let an explicit pick
// override it. Without a shared channel the two disagree — the popover shows the
// persisted pair while the page shows the preset — and, worse, the preset is
// recomputed every render, so any pick that doesn't contain the menu language is
// silently stomped back. This context is that channel.
//
// The rule (spec v3): the preset is a DEFAULT; an explicit user choice beats it
// immediately and for the rest of that scan session. `overridden` carries that.
//
// Lifetime: a Shell-level provider (the persistent root layout), so it survives
// bottom-nav tab switches — like the rest of the scan state in scanSession — and
// dies on a full refresh. The scan page's X calls resetPreset() to forget it, and
// a brand-new scan resets it so the new menu re-evaluates the preset fresh.
import { createContext, useContext, useState, useCallback } from 'react';
import type { LangCode } from './i18n-dict';

type ScanPresetContext = {
  /** The foreign secondary actually in effect for the header globe to display:
   *  the detected menu language, or null once nothing is presettable OR the user
   *  has overridden it. */
  effectiveSecondary: LangCode | null;
  /** True once the user made an explicit pick in the globe this scan session. */
  overridden: boolean;
  /** Scan page publishes the detected foreign secondary (null when none). */
  setPresetSecondary: (code: LangCode | null) => void;
  /** Globe picker: an explicit pick beats the preset for the rest of this scan. */
  override: () => void;
  /** Scan closed (X) or a brand-new scan: forget the preset entirely. */
  resetPreset: () => void;
};

const Ctx = createContext<ScanPresetContext>({
  effectiveSecondary: null, overridden: false,
  setPresetSecondary: () => {}, override: () => {}, resetPreset: () => {},
});

export function ScanPresetProvider({ children }: { children: React.ReactNode }) {
  const [presetSecondary, setPresetSecondary] = useState<LangCode | null>(null);
  const [overridden, setOverridden] = useState(false);

  const publish = useCallback((code: LangCode | null) => setPresetSecondary(code), []);
  const override = useCallback(() => setOverridden(true), []);
  const resetPreset = useCallback(() => { setPresetSecondary(null); setOverridden(false); }, []);

  // Overriding hides the preset from the picker while leaving the raw value in
  // place — a new scan calls resetPreset() and starts clean.
  const effectiveSecondary = overridden ? null : presetSecondary;

  return (
    <Ctx.Provider value={{ effectiveSecondary, overridden, setPresetSecondary: publish, override, resetPreset }}>
      {children}
    </Ctx.Provider>
  );
}

export function useScanPreset() { return useContext(Ctx); }
