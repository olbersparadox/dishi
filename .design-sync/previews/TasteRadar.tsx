import { TasteRadar } from 'dishi';

// In the product the radar is only ever reached THROUGH TasteFormReveal (one tap
// on the blob), rendered at round(190 * 1.55) = 295 so the 18 labels have room.
// labelFor is always passed: the app hands it `(dim) => t('dim.' + dim)`, so
// these cells hand it the exact strings that lookup resolves to.
const ZH: Record<string, string> = {
  sweet: '甜', salty: '鹹', sour: '酸', bitter: '苦', umami: '鮮味', spicy: '辣',
  crispy: '脆', creamy: '香滑', chewy: '煙韌', tender: '嫩滑', rich: '濃郁', fresh: '新鮮',
  fried: '炸', grilled: '燒烤', braised: '炆', steamed: '蒸', raw: '生食', baked: '焗',
};
const EN: Record<string, string> = {
  sweet: 'sweet', salty: 'salty', sour: 'sour', bitter: 'bitter', umami: 'umami', spicy: 'spicy',
  crispy: 'crispy', creamy: 'creamy', chewy: 'chewy', tender: 'tender', rich: 'rich', fresh: 'fresh',
  fried: 'fried', grilled: 'grilled', braised: 'braised', steamed: 'steamed', raw: 'raw', baked: 'baked',
};

// A real palate after ~50 ratings of HK food: loves 鮮味/脆/炸, genuinely dislikes
// 苦 and 生食, lukewarm on 甜. Lopsided on purpose — a symmetric vector renders
// as a meaningless shape and no learned profile ever looks like one.
const SEASONED: Record<string, number> = {
  umami: 0.72, crispy: 0.58, fried: 0.46, rich: 0.40, braised: 0.34, tender: 0.30,
  salty: 0.24, spicy: 0.18, steamed: 0.14, chewy: 0.12, grilled: 0.10, fresh: 0.08,
  creamy: 0.05, baked: 0, sour: -0.10, sweet: -0.22, raw: -0.28, bitter: -0.45,
};

// Six ratings in: only two dims have crossed the callout bar (> 0.12), so only
// 脆 and 甜 get the bold enlarged treatment — the radar refuses to shout about
// near-flat dimensions.
const EARLY: Record<string, number> = {
  crispy: 0.20, sweet: 0.14, salty: 0.10, fried: 0.08, umami: 0.06,
  bitter: -0.12, sour: 0, spicy: 0, creamy: 0, chewy: 0, tender: 0.04,
  rich: 0, fresh: 0, grilled: 0, braised: 0, steamed: 0, raw: 0, baked: 0,
};

// An English-primary 大牌檔 regular, with the top three dims deliberately on the
// HORIZONTAL rim: umami sits at 3 o'clock, grilled and braised at 9 — the
// longest Latin words landing where the chart has the least room sideways.
// This cell exists to hold the radar to that case: those labels used to clip
// against the SVG edge ("umam", "raised"), so an en cell has to be the one that
// would show it. Don't swap in a top/diagonal palate to make it look tidier.
const WOK: Record<string, number> = {
  umami: 0.72, grilled: 0.58, braised: 0.52, crispy: 0.30, rich: 0.24, fried: 0.20,
  tender: 0.18, salty: 0.14, spicy: 0.10, steamed: 0.08, chewy: 0.06, fresh: 0.05,
  creamy: 0.02, baked: 0, sour: -0.10, sweet: -0.22, raw: -0.28, bitter: -0.45,
};

/** The shape a well-fed profile makes: top three loves (鮮味/脆/炸) called out in
 *  bold enlarged ink, dislikes (苦, 生食) pulled toward the center. */
export function SeasonedPalate() {
  return <TasteRadar vector={SEASONED} size={295} labelFor={(dim) => ZH[dim] ?? dim} />;
}

/** A profile six ratings old: small lobes, only two callouts — the chart stays
 *  honest about how little it knows rather than inflating a flat vector. */
export function EarlyPalate() {
  return <TasteRadar vector={EARLY} size={295} labelFor={(dim) => ZH[dim] ?? dim} />;
}

/** An English-primary user — labelFor hands back the en strings t() resolves.
 *  A wok-shop palate whose callouts (umami, grilled, braised) sit on the
 *  horizontal rim, where a Latin label has the least room: the chart widens its
 *  viewBox by however much the longest one overhangs, so the words stay whole
 *  and the plot is drawn a touch smaller inside the same square box. A zh
 *  profile never triggers that and renders at full size. */
export function EnglishLabels() {
  return <TasteRadar vector={WOK} size={295} labelFor={(dim) => EN[dim] ?? dim} />;
}
