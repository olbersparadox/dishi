/**
 * Label geometry for TasteRadar's callouts.
 *
 * Why this is a lib module and not four lines inside the component: the radar
 * clipped long Latin labels for months without anyone noticing, because the
 * failure is arithmetic and invisible in the Chinese-first default (zh dim
 * labels are one or two square glyphs and never reach the rim; "umami" and
 * "braised" do). Arithmetic that has already gone wrong once belongs somewhere
 * a test can pin it — tests/radarLabels.test.ts checks the estimate against
 * real advance widths measured in the browser at the app's own body font.
 *
 * SVG offers no way to measure text before it is laid out (and jsdom offers no
 * way at all), so width is ESTIMATED from per-character advance classes. The
 * constants are deliberately biased high: reserving a few px too many costs a
 * fraction of a percent of chart size, reserving too few clips a word.
 */

/** Per-character advance width in em, by shape class. Measured from Schibsted
 *  Grotesk (`--font-body`, what the radar's <text> inherits) and rounded up to
 *  the bold figure, since a called-out label is drawn at weight 700. */
const EM_CJK = 1;         // CJK/fullwidth glyphs are square by definition
const EM_WIDE = 0.95;     // m w
const EM_HAIRLINE = 0.32; // i j l, the thin punctuation, and the space
const EM_SLIM = 0.47;     // f t r
const EM_CAP = 0.78;      // uppercase runs wider than lowercase in every grotesk
const EM_CAP_WIDE = 1;    // M W
const EM_DEFAULT = 0.62;  // every other lowercase letter, and digits

// Matches the CJK/fullwidth blocks the rest of the app tests for (see
// dishIdentity.ts, restaurant.ts), plus Hangul, since those are square too.
// Escaped, not literal, for the reason spelled out over DishName's copy of the
// same five ranges: decoded as Latin-1 a literal class becomes "range out of
// order" and the SyntaxError takes the whole module down.
const CJK_RE = /[\u3000-\u9FFF\u3400-\u4DBF\uAC00-\uD7AF\uF900-\uFAFF\uFF00-\uFFEF]/;

/**
 * Estimated rendered width of an SVG text label, in user units. Never returns
 * less than the real width for any label the app ships (pinned by test); an
 * unrecognised script falls back to the generous lowercase figure.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) {
    if (CJK_RE.test(ch)) em += EM_CJK;
    else if (ch === 'm' || ch === 'w') em += EM_WIDE;
    else if ('ijl.,:;\'!| '.includes(ch)) em += EM_HAIRLINE;
    else if ('ftr'.includes(ch)) em += EM_SLIM;
    else if (ch === 'M' || ch === 'W') em += EM_CAP_WIDE;
    else if (ch >= 'A' && ch <= 'Z') em += EM_CAP;
    else em += EM_DEFAULT;
  }
  return em * fontSize;
}

export type LabelBox = {
  /** The x the <text> is positioned at, before its anchor is applied. */
  x: number;
  width: number;
  anchor: 'start' | 'middle' | 'end';
};

/**
 * How far the widest label reaches past either vertical edge of a `size`-wide
 * box, in user units (0 when everything fits).
 *
 * A callout near the horizontal rim is the whole problem: it is anchored to
 * grow AWAY from the chart (start on the right, end on the left, so it never
 * lies over the plot), which means its far edge sits at rim + label width, and
 * a seven-letter Latin word is wider than the margin the square box leaves.
 */
export function labelOverhang(labels: LabelBox[], size: number): number {
  let over = 0;
  for (const { x, width, anchor } of labels) {
    const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
    over = Math.max(over, -left, left + width - size);
  }
  return Math.max(0, over);
}
