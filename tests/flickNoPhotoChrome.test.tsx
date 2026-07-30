// @vitest-environment jsdom
//
// FlickRating's NO-PHOTO chrome contract.
//
// The bug this locks (seen live, 2026-07-30): with `photoUrl={null}` the card
// renders the dish NAME as the flick surface — centred — while `.flick-hint`
// stayed centred too, so the swipe hint landed exactly on the name and left both
// illegible. It reached anyone logging home cooking or a menu pick that was never
// photographed, and re-rating one from the journal (`MyDishes` mounts FlickRating).
//
// The root cause is broader than the one collision: every piece of flick chrome is
// designed for a PHOTO — white ink over a dark image, centred over content there is
// nothing to read in. The no-photo surface inverts both assumptions (it is light,
// and it is entirely text), so all of it has to be re-homed, and the verdict word
// was separately invisible white-on-white once a rating landed.
//
// jsdom applies no stylesheets, so it cannot see an overlap. What it CAN do is hold
// the CSS contract that prevents one — the same approach as cartBarChrome.test.tsx.
// The visual state itself is pinned by `.design-sync/previews/FlickRating.tsx`'s
// `NameAtRest` cell.
//
// DELIBERATELY NOT LOCKED: the exact offsets, colours or opacities. Those are the
// owner's to tune. What is locked is that the hint is not centred on this surface,
// that the surface reserves room for it, that the chrome is ink rather than white,
// and that the hint is still SHOWN — "fix it by hiding the hint" would take the
// gesture affordance away from the one surface that looks least draggable.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';
import FlickRating from '../src/components/FlickRating';
import { LanguageProvider } from '../src/lib/i18n';

const CSS = readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8');

/** Every flat rule whose selector mentions `.flick-nophoto` — so a later override
 *  added ANYWHERE in the file counts, not just the original block. */
function noPhotoRules(): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]+)\{([^{}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(CSS))) {
    const selector = m[1].split('\n').pop()!.trim();
    if (/\.flick-nophoto(?![\w-])/.test(selector)) out.push({ selector, body: m[2] });
  }
  return out;
}

/** The rules that re-home a given piece of chrome for the no-photo surface. */
const chromeRules = (cls: string) =>
  noPhotoRules().filter(r => new RegExp(`\\.${cls}(?![\\w-])`).test(r.selector));

describe('no-photo flick chrome — the hint never lands on the dish name', () => {
  it('finds the no-photo surface at all (guards this file against a silent rename)', () => {
    expect(noPhotoRules().length).toBeGreaterThan(0);
  });

  it('re-homes the hint off centre for this surface', () => {
    // .flick-hint's base rule centres it with top:50% + translate(-50%,-50%) — which
    // is correct over a photo and fatal over a centred name.
    const rules = chromeRules('flick-hint');
    expect(rules.length, '.flick-hint must be re-homed for .flick-nophoto').toBeGreaterThan(0);
    const body = rules.map(r => r.body).join(' ');
    expect(body, 'must cancel the centred top offset').toMatch(/top\s*:\s*auto/);
    // Whatever the new anchor is, it must not re-introduce vertical centring.
    expect(body).not.toMatch(/transform\s*:[^;]*translate\s*\(\s*-?50%\s*,\s*-?50%/);
  });

  it('reserves room for it on the surface itself, so a long name cannot grow into it', () => {
    // A repositioned pill alone is not enough: the name is vertically centred inside
    // the card's padding box, so a two- or three-line name expands toward whichever
    // edge the pill now occupies. The padding is what actually keeps them apart.
    const base = noPhotoRules().filter(r => /^\.flick-nophoto$/.test(r.selector));
    expect(base.length).toBeGreaterThan(0);
    const pad = base.map(r => r.body).join(' ').match(/padding\s*:\s*([^;]+)/);
    expect(pad, '.flick-nophoto must declare padding').not.toBeNull();
    const parts = pad![1].trim().split(/\s+/).map(v => parseFloat(v));
    // Shorthand: 1 value = uniform, 2 = v/h, 3+ = top/h/bottom. Only 3+ can reserve
    // a band on one edge, which is the whole point.
    expect(parts.length, 'padding must be asymmetric to reserve a band').toBeGreaterThanOrEqual(3);
    const top = parts[0];
    const bottom = parts.length >= 3 ? parts[2] : top;
    const reserve = Math.max(top, bottom);
    // Two lines of the hint pill plus its own inset. A smaller band is the bug back.
    expect(reserve, 'the reserved band must clear a two-line hint pill').toBeGreaterThanOrEqual(60);
  });

  it('turns the white photo chrome to ink — white vanishes on a paper surface', () => {
    // .flick-word is `color: #fff` over a photo. On the light name card that rendered
    // the verdict as a ghost: present, unreadable.
    const word = chromeRules('flick-word').map(r => r.body).join(' ').toLowerCase();
    expect(word, '.flick-word must be re-coloured for .flick-nophoto').toMatch(/color\s*:/);
    expect(word).not.toMatch(/color\s*:\s*(#fff(f{3})?\b|white)/);
    expect(word).toMatch(/var\(--ink\)/);
    // The gauge track (#ffffff55) and arrows (55% white) are invisible on paper too,
    // which is what made the surface read as undraggable.
    expect(chromeRules('flick-gauge').length, '.flick-gauge must be re-coloured').toBeGreaterThan(0);
    expect(chromeRules('flick-arrow').length, '.flick-arrow must be re-coloured').toBeGreaterThan(0);
  });
});

describe('no-photo flick behaviour — the name and the hint both render', () => {
  const renderFlick = (photoUrl: string | null) => render(
    <LanguageProvider>
      <FlickRating photoUrl={photoUrl} dishName="Steamed Minced Pork" dishNameZh="鹹蛋蒸肉餅" onRate={() => {}} />
    </LanguageProvider>,
  );

  it('shows the dish name as the flick surface when there is no photo', () => {
    const { container } = renderFlick(null);
    const surface = container.querySelector('.flick-nophoto');
    expect(surface).not.toBeNull();
    expect(surface!.textContent).toContain('鹹蛋蒸肉餅');
    expect(container.querySelector('img')).toBeNull();
  });

  it('still shows the swipe hint — the fix is placement, NOT suppression', () => {
    // Hiding the hint here would be the cheap fix and the wrong one: a plain name
    // card carries no visual cue that it can be dragged at all, so this is the
    // surface that needs the hint most.
    expect(renderFlick(null).container.querySelector('.flick-hint')).not.toBeNull();
  });

  it('leaves the photo path exactly as it was — photo surface, same hint', () => {
    const { container } = renderFlick('/x.jpg');
    expect(container.querySelector('.flick-nophoto')).toBeNull();
    expect(container.querySelector('img.flick-photo')).not.toBeNull();
    expect(container.querySelector('.flick-hint')).not.toBeNull();
  });
});
