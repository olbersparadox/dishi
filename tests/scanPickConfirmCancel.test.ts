// Field-session fix 2026-07-23, item 1b: the pick-confirm sheet's 取消 text
// pill became an icon-only circle, matching the house close convention. The
// full scan page needs a real vision round-trip to mount (menu photo → OCR →
// picked items → confirm sheet), so — same technique as
// identityCardChassis.test.tsx's CARD_SRC/DUEL_SRC checks — this asserts the
// wiring directly off source rather than duplicating that heavy setup here.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(path.resolve(__dirname, '../src/app/scan/page.tsx'), 'utf8');

describe('scan pick-confirm sheet — 取消 is an icon-only circle', () => {
  it('the confirmingPick sheet renders CloseIcon in the house .icon-btn.lg circle, not a text pill', () => {
    const sheetStart = SRC.indexOf('{confirmingPick && (');
    expect(sheetStart).toBeGreaterThan(-1);
    const sheet = SRC.slice(sheetStart, sheetStart + 1700);
    expect(sheet).toMatch(/className="icon-btn lg"/);
    expect(sheet).toMatch(/<CloseIcon/);
    expect(sheet).not.toMatch(/className="btn ghost"[^>]*>\s*\{t\('home\.cancel'\)\}/);
  });

  it('the cancel button still wires to setConfirmingPick(false) and stays disabled while saving', () => {
    const sheetStart = SRC.indexOf('{confirmingPick && (');
    const sheet = SRC.slice(sheetStart, sheetStart + 1700);
    expect(sheet).toMatch(/onClick=\{\(\) => setConfirmingPick\(false\)\}\s*disabled=\{pickSaving\}/);
    expect(sheet).toMatch(/aria-label=\{t\('home\.cancel'\)\}/);
  });
});
