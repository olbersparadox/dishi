// @vitest-environment jsdom
//
// 迎新 onboarding (album-first cold start). Two things are pinned here:
// (1) the gate FAILS CLOSED — any existing activity, unresolved fetch, or a
//     seen flag renders exactly today's page (no walkthrough), so the feature
//     is additive-only for every non-fresh account;
// (2) the sheet is the batch's shape — two cards, then the ask, skippable at
//     every step, with the CTA delegating to the merged pill's own picker
//     rather than owning any picker of its own.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Onboarding from '../src/components/Onboarding';
import { shouldShowOnboarding, type OnboardGate } from '../src/lib/onboarding';
import { LanguageProvider } from '../src/lib/i18n';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const fresh: OnboardGate = {
  seen: false, toRateCount: 0, ratedLoaded: true, ratedCount: 0, ratingCount: 0,
};

describe('shouldShowOnboarding — fails closed for every non-fresh state', () => {
  it('shows only for a genuinely empty, loaded, unseen account', () => {
    expect(shouldShowOnboarding(fresh)).toBe(true);
  });
  it('never shows when anything already exists or has not loaded', () => {
    expect(shouldShowOnboarding({ ...fresh, seen: true })).toBe(false);
    expect(shouldShowOnboarding({ ...fresh, toRateCount: null })).toBe(false);   // unrated fetch in flight
    expect(shouldShowOnboarding({ ...fresh, toRateCount: 1 })).toBe(false);      // a queued pick counts as activity
    expect(shouldShowOnboarding({ ...fresh, ratedLoaded: false })).toBe(false);  // rated fetch pending/failed
    expect(shouldShowOnboarding({ ...fresh, ratedCount: 2 })).toBe(false);
    expect(shouldShowOnboarding({ ...fresh, ratingCount: 3 })).toBe(false);
  });
});

function mount(onPick = () => {}, onSkip = () => {}) {
  render(
    <LanguageProvider>
      <Onboarding onPick={onPick} onSkip={onSkip} />
    </LanguageProvider>,
  );
}

describe('the walkthrough sheet — two cards, then the ask', () => {
  it('walks card 1 → card 2 (with the scan clause) → the ask, and the CTA opens the picker', () => {
    const onPick = vi.fn();
    mount(onPick);
    // Card 1: equal-weight logging, the owner's line verbatim.
    expect(screen.getByText(/dishi 記住你食過乜/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    // Card 2: the blob + export line, plus the single scan clause.
    expect(screen.getByText(/評得多，你嘅味 AI 就愈似你/)).toBeTruthy();
    expect(screen.getByText(/影埋張菜牌/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
    // The ask: 5+ framed 多多益善, and the CTA is a delegation, not a picker.
    expect(screen.getByText('揀幾張你影過嘅食物相')).toBeTruthy();
    expect(screen.getByText(/至少 5 張，多多益善/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '揀相' }));
    expect(onPick).toHaveBeenCalledTimes(1);
    // No file input of its own — the one entry point stays the merged pill's.
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('is skippable at every step via the corner ✕', () => {
    for (let advance = 0; advance < 3; advance++) {
      const onSkip = vi.fn();
      mount(() => {}, onSkip);
      for (let i = 0; i < advance; i++) fireEvent.click(screen.getByRole('button', { name: '下一步' }));
      fireEvent.click(screen.getByRole('button', { name: '略過' }));
      expect(onSkip).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });
});
