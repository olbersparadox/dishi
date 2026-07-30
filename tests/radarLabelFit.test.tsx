// @vitest-environment jsdom
//
// TasteRadar's callout labels must FIT. This regressed silently for as long as
// the radar has existed: a callout near the horizontal rim is anchored to grow
// outward from a rim that already sits ~85% of the way to the edge, which is
// fine for a one- or two-glyph zh label and not for a Latin word — "umami" at
// 3 o'clock rendered as "umam", "braised" at 9 o'clock lost its first two
// letters. Nobody saw it because zh is the default and 鮮味/燒烤 fit with room
// to spare, so the only cell that would have shown it (an en preview card) was
// composed around the bug instead of catching it.
//
// Two halves, and they have to stay two halves or the test proves nothing:
//
//   1. estimateTextWidth never UNDER-estimates a real label. Checked against
//      advance widths measured in a browser at the app's own body font, so the
//      constants are pinned to reality rather than to themselves.
//   2. Rendering a horizontal-rim English palate puts every label inside the
//      viewBox — measured with those same real widths, NOT with the estimator.
//      Using the estimator here would only prove the component can agree with
//      itself.
//
// Plus the other direction, which is just as easy to break: the zh default must
// come out unchanged. The fix pads the viewBox only as far as a label actually
// overhangs, so a Chinese profile pays nothing for the English one's room.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TasteRadar from '../src/components/TasteRadar';
import { estimateTextWidth, labelOverhang } from '../src/lib/radarLabels';

/**
 * Real advance widths of the 18 dim labels, in em, measured with
 * getComputedTextLength() on an <svg><text> in Schibsted Grotesk (`--font-body`,
 * which the radar's labels inherit) at weight 400 and weight 700. Callouts are
 * drawn bold, everything else regular, so both figures matter.
 */
const EM: Record<string, { reg: number; bold: number }> = {
  sweet: { reg: 2.799, bold: 2.987 },
  salty: { reg: 2.220, bold: 2.432 },
  sour: { reg: 2.099, bold: 2.230 },
  bitter: { reg: 2.470, bold: 2.713 },
  umami: { reg: 3.122, bold: 3.320 },
  spicy: { reg: 2.431, bold: 2.629 },
  crispy: { reg: 2.821, bold: 3.078 },
  creamy: { reg: 3.449, bold: 3.703 },
  chewy: { reg: 3.063, bold: 3.275 },
  tender: { reg: 3.046, bold: 3.264 },
  rich: { reg: 1.750, bold: 1.912 },
  fresh: { reg: 2.350, bold: 2.527 },
  fried: { reg: 2.142, bold: 2.323 },
  grilled: { reg: 2.886, bold: 3.137 },
  braised: { reg: 3.454, bold: 3.722 },
  steamed: { reg: 4.008, bold: 4.252 },
  raw: { reg: 1.712, bold: 1.887 },
  baked: { reg: 2.856, bold: 3.048 },
};

const EN = Object.fromEntries(Object.keys(EM).map(w => [w, w]));
const ZH: Record<string, string> = {
  sweet: '甜', salty: '鹹', sour: '酸', bitter: '苦', umami: '鮮味', spicy: '辣',
  crispy: '脆', creamy: '香滑', chewy: '煙韌', tender: '嫩滑', rich: '濃郁', fresh: '新鮮',
  fried: '炸', grilled: '燒烤', braised: '炆', steamed: '蒸', raw: '生食', baked: '焗',
};

// The palate that breaks it: the top three dims are umami (3 o'clock) and
// grilled/braised (9 o'clock), i.e. the longest words land where the chart has
// the least horizontal room. This is the case the preview cards used to avoid.
const HORIZONTAL_PALATE: Record<string, number> = {
  umami: 0.72, grilled: 0.58, braised: 0.52, crispy: 0.30, rich: 0.24, fried: 0.20,
  tender: 0.18, salty: 0.14, spicy: 0.10, steamed: 0.08, chewy: 0.06, fresh: 0.05,
  creamy: 0.02, baked: 0, sour: -0.10, sweet: -0.22, raw: -0.28, bitter: -0.45,
};

/** The reveal size — round(190 * 1.55), the only size the app renders at. */
const SIZE = 295;

/** Every label's horizontal extent, using MEASURED widths for the text. */
function labelBoxes(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll('text')).map(t => {
    const label = t.textContent ?? '';
    const fontSize = Number(t.getAttribute('font-size'));
    const bold = t.getAttribute('font-weight') === '700';
    const width = label in EM
      ? EM[label][bold ? 'bold' : 'reg'] * fontSize
      // zh labels: CJK advance is exactly 1em per glyph, by definition of the
      // fullwidth grid — no measurement needed.
      : Array.from(label).length * fontSize;
    const x = Number(t.getAttribute('x'));
    const anchor = t.getAttribute('text-anchor');
    const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
    return { label, left, right: left + width };
  });
}

function viewBoxOf(svg: SVGSVGElement) {
  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
  return { x, y, w, h };
}

function renderRadar(vector: Record<string, number>, dict: Record<string, string>) {
  const { container } = render(
    <TasteRadar vector={vector} size={SIZE} labelFor={(d) => dict[d] ?? d} />,
  );
  return container.querySelector('svg')!;
}

describe('estimateTextWidth is calibrated against the real font', () => {
  it('never under-estimates a dim label, at either weight', () => {
    for (const [word, real] of Object.entries(EM)) {
      for (const fontSize of [12.685, 17.7]) {  // baseFont and strongFont at 295
        expect(estimateTextWidth(word, fontSize)).toBeGreaterThanOrEqual(real.bold * fontSize);
        expect(estimateTextWidth(word, fontSize)).toBeGreaterThanOrEqual(real.reg * fontSize);
      }
    }
  });

  it('does not over-estimate by more than 15%, which would shrink the chart for nothing', () => {
    for (const [word, real] of Object.entries(EM)) {
      expect(estimateTextWidth(word, 17.7) / (real.bold * 17.7)).toBeLessThan(1.15);
    }
  });

  it('gives CJK glyphs a full em each, so zh labels are measured exactly', () => {
    expect(estimateTextWidth('鮮味', 20)).toBe(40);
    expect(estimateTextWidth('燒烤', 17.7)).toBeCloseTo(35.4, 5);
  });

  it('reports overhang only for labels that actually leave the box', () => {
    expect(labelOverhang([{ x: 260, width: 50, anchor: 'start' }], 295)).toBe(15);
    expect(labelOverhang([{ x: 40, width: 60, anchor: 'end' }], 295)).toBe(20);
    expect(labelOverhang([{ x: 147, width: 60, anchor: 'middle' }], 295)).toBe(0);
    expect(labelOverhang([{ x: 260, width: 30, anchor: 'start' }], 295)).toBe(0);
  });
});

describe('TasteRadar labels fit inside the SVG', () => {
  it('keeps every English label inside the viewBox with the top dims on the horizontal rim', () => {
    const svg = renderRadar(HORIZONTAL_PALATE, EN);
    const vb = viewBoxOf(svg);
    const clipped = labelBoxes(svg).filter(b => b.left < vb.x || b.right > vb.x + vb.w);
    expect(clipped).toEqual([]);
  });

  it('specifically fits the three that used to clip', () => {
    const svg = renderRadar(HORIZONTAL_PALATE, EN);
    const vb = viewBoxOf(svg);
    const boxes = labelBoxes(svg);
    for (const label of ['umami', 'grilled', 'braised']) {
      const box = boxes.find(b => b.label === label)!;
      expect(box, label).toBeDefined();
      expect(box.left, label).toBeGreaterThanOrEqual(vb.x);
      expect(box.right, label).toBeLessThanOrEqual(vb.x + vb.w);
    }
  });

  it('leaves the zh default untouched: no padding, so no shrink', () => {
    const svg = renderRadar(HORIZONTAL_PALATE, ZH);
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${SIZE} ${SIZE}`);
    const vb = viewBoxOf(svg);
    const clipped = labelBoxes(svg).filter(b => b.left < vb.x || b.right > vb.x + vb.w);
    expect(clipped).toEqual([]);
  });

  it('never changes the box it occupies, so no caller layout moves', () => {
    for (const dict of [EN, ZH]) {
      const svg = renderRadar(HORIZONTAL_PALATE, dict);
      expect(svg.getAttribute('width')).toBe(String(SIZE));
      expect(svg.getAttribute('height')).toBe(String(SIZE));
      // Padding is symmetric, so the chart stays centred in that box — it
      // cross-fades over the blob it replaces and must not drift sideways.
      const vb = viewBoxOf(svg);
      expect(vb.x + vb.w / 2).toBeCloseTo(SIZE / 2, 5);
    }
  });
});
