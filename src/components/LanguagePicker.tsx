'use client';
// The 語言對 globe picker — replaces the 中/EN switcher (same header footprint).
// Two rows (primary / secondary dish-name language) with a swap between; each is a
// native select of the curated LANGUAGES list, self-named. Picking the language the
// other slot holds swaps them (handled in setSlot). Chrome language is NOT chosen
// here — it's derived from whichever slot is 中文.
import { useState } from 'react';
import { useLang, LANGUAGES, type LangCode } from '@/lib/i18n';
import { useScanPreset } from '@/lib/scanPreset';

export default function LanguagePicker() {
  const { pair, setSlot, swapPair, t } = useLang();
  const { effectiveSecondary, override } = useScanPreset();
  const [open, setOpen] = useState(false);

  // While a scan's foreign-menu preset is active the picker shows the EFFECTIVE
  // pair — the menu language sits in the secondary slot, labelled "（餐牌原文）" —
  // not the persisted one, so the popover no longer contradicts the page. The
  // preset is only a default, though: any change here is an explicit choice, so it
  // clears the preset for the rest of the scan (override) BEFORE applying, and from
  // then on the persisted pair is used exactly as chosen (Fix 5). Off a scan,
  // effectiveSecondary is null and this all collapses to the plain persisted pair.
  const secondaryValue = effectiveSecondary ?? pair.secondary;
  const clearPresetThen = (apply: () => void) => { if (effectiveSecondary) override(); apply(); };

  return (
    <div className="lang-picker">
      <button className="lang-globe" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={t('lang.title')}>
        {/* globe glyph via icon */}
        {/* strokeWidth 1.45 (not 1.6): the globe renders at 22px vs the bell's 20px, so
            a matched 1.6 would read ~10% thicker. 1.45×22 ≈ 1.6×20 → same line weight. */}
        <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 010 18a14 14 0 010-18z" />
        </svg>
        {/* AI sparkle: signals the globe does more than switch language — it also
            translates dish names on the fly. Paper-outlined so it reads over the globe. */}
        <svg className="lang-globe-ai" viewBox="0 0 24 24" width={17} height={17} aria-hidden="true">
          <path d="M12 3 C12.7 9.3 14.7 11.3 21 12 C14.7 12.7 12.7 14.7 12 21 C11.3 14.7 9.3 12.7 3 12 C9.3 11.3 11.3 9.3 12 3 Z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="lang-scrim" onClick={() => setOpen(false)} />
          <div className="lang-sheet" role="dialog" aria-label={t('lang.title')}>
            <div className="lang-sheet-title">{t('lang.title')}</div>
            <div className="lang-rows">
              <label className="lang-row">
                <span className="lang-slot-label">{t('lang.primary')}</span>
                <select className="field lang-select" value={pair.primary} onChange={e => clearPresetThen(() => setSlot('primary', e.target.value as LangCode))}>
                  {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </label>
              <label className="lang-row">
                <span className="lang-slot-label">{t('lang.secondary')}</span>
                <select className="field lang-select" value={secondaryValue} onChange={e => clearPresetThen(() => setSlot('secondary', e.target.value as LangCode))}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>
                      {l.code === effectiveSecondary ? `${l.label}（${t('lang.menuoriginal')}）` : l.label}
                    </option>
                  ))}
                </select>
              </label>
              {/* Swap: a round button on the right, vertically straddling the two rows. */}
              <button className="lang-swap" onClick={() => clearPresetThen(swapPair)} aria-label={t('lang.swap')} title={t('lang.swap')}>⇅</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
