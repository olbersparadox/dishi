// Every fill-in box in the app is sans — hint text and typed text alike
// (owner, 2026-08-01).
//
// Two independent holes produced serif fields, and a test that only checked one
// input would have missed the other:
//
//   1. .join-code-input asked for var(--font-display) outright, so the ABCDE hint
//      read as a heading rather than something to type into;
//   2. .field declared `font: inherit`, and form controls inherit nothing by
//      default — so a field took the font of whatever it was NESTED IN. The same
//      component came out sans on one screen and serif inside a serif-headed card.
//
// So this checks the RULE, not one field: no selector that describes a form control
// may reach for the display face, and the base rule that pins the family has to
// survive.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CSS = readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8');

/** Every `selector { …body… }` pair, comments stripped so a rule discussed in prose
 *  can't be mistaken for one that is declared. */
function rules(css: string): Array<{ selector: string; body: string }> {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Array<{ selector: string; body: string }> = [];
  // Array.from, not for-of: bare tsc has no downlevelIteration and would flag the
  // iterator (the same complaint it already makes about tests/i18n.test.ts).
  for (const m of Array.from(bare.matchAll(/([^{}]+)\{([^{}]*)\}/g))) {
    out.push({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  }
  return out;
}
const ALL = rules(CSS);
/** Selectors that style a form control: the elements themselves, plus the app's own
 *  field classes. Deliberately broad — a new .foo-input should be caught too. */
const FORM = /(^|[\s,>])(input|textarea|select)\b|\binput\b|\bfield\b/i;

describe('fill-in boxes are sans, everywhere', () => {
  it('no form-control rule reaches for the serif display face', () => {
    const offenders = ALL
      .filter(r => FORM.test(r.selector) && /font-family:\s*var\(--font-display\)/.test(r.body))
      .map(r => r.selector);
    expect(offenders).toEqual([]);
  });

  it('a base rule pins the family, since controls inherit none by default', () => {
    const base = ALL.find(r => /^input, textarea, select, ::placeholder$/.test(r.selector));
    expect(base, 'base form-control rule missing').toBeTruthy();
    expect(base!.body).toMatch(/font-family:\s*var\(--font-body\), system-ui, sans-serif/);
  });

  it('.field pins the family AFTER `font: inherit`, or the shorthand wins', () => {
    // Order is the whole point: `font: inherit` resets family, so a family declared
    // before it would be silently discarded and the nesting bug would come back.
    const field = ALL.find(r => r.selector === '.field');
    expect(field, '.field rule missing').toBeTruthy();
    const body = field!.body;
    expect(body).toMatch(/font:\s*inherit/);
    expect(body).toMatch(/font-family:\s*var\(--font-body\)/);
    expect(body.indexOf('font-family:')).toBeGreaterThan(body.indexOf('font: inherit'));
  });

  it('the one deliberate exception stays monospace, which is not serif', () => {
    // A table code reads as a code in mono. Documented at the rule itself; this is
    // here so "make everything sans" never flattens it by accident.
    const code = ALL.find(r => r.selector === '.code-input' && /font-family/.test(r.body));
    expect(code, '.code-input font rule missing').toBeTruthy();
    expect(code!.body).toMatch(/ui-monospace/);
  });
});
