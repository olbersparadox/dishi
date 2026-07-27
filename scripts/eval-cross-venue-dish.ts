/**
 * R&D eval: can we resolve "the same DISH at different restaurants"?
 *
 * Context — the problem this exists to answer (BACKLOG, 2026-07-27): dish
 * identity is scoped to ONE restaurant by schema and by an explicit guard in
 * /api/dishes/identity. The execution slider's whole purpose (why 乾炒牛河 is
 * good at shop A and bad at shop B) needs a CROSS-VENUE dish concept that does
 * not exist. Before designing one, measure whether the resolution is even
 * feasible.
 *
 * TWO ARMS, so the answer is measured and not asserted:
 *   A = the SHIPPED within-restaurant prompt (dishMatch.ts, verbatim).
 *       Expected to fail: its rules encode MENU-ITEM semantics ("any two items
 *       a restaurant would price and serve separately" = different), and two
 *       restaurants always price their 乾炒牛河 separately.
 *   B = a cross-venue prompt written for the execution-comparison purpose.
 *
 * The label definition for arm B, derived from the USE CASE rather than from
 * abstract taxonomy: two plates are the SAME dish if you would compare them to
 * judge which kitchen does it better.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/eval-cross-venue-dish.ts
 */
import { callClaude, parseJsonResponse } from '../src/lib/openrouter';

export type Case = {
  a: string; b: string;
  same: boolean;
  /** Why this pair is in the set — the failure mode it probes. */
  probes: string;
};

// HELD-OUT by construction: not one dish here appears as a worked example in
// EITHER arm's prompt. The first version of this set shared most of its pairs
// with arm B's examples and scored a meaningless 100% — an open-book exam.
// Hard cases only; a set of easy exact matches would report a fake 95%.
// ★ = drawn from the live corpus.
export const CASES: Case[] = [
  // ── TRUE: same dish, different restaurants ────────────────────────────────
  { a: '星洲炒米', b: 'Singapore fried vermicelli', same: true, probes: 'cross-language' },
  { a: '蘿蔔糕', b: '港式蘿蔔糕', same: true, probes: '★live corpus: 港式 regional qualifier' },
  { a: '楊枝甘露', b: 'Mango pomelo sago', same: true, probes: 'cross-language dessert' },
  { a: '舒芙蕾鬆餅', b: '日式舒芙蕾鬆餅', same: true, probes: '★live corpus: 日式 style qualifier' },
  { a: '西多士', b: 'French toast', same: true, probes: 'cross-language, opaque name' },
  { a: '蒸蛋', b: '蒸水蛋', same: true, probes: 'one extra char, SAME dish (contrast with 車仔/公仔 below)' },
  { a: '皮蛋瘦肉粥', b: 'Century egg and pork congee', same: true, probes: 'cross-language congee' },
  { a: '蜜汁叉燒', b: '招牌蜜汁叉燒', same: true, probes: '招牌 house-special framing' },
  { a: '蝦仁炒蛋', b: '滑蛋蝦仁', same: true, probes: 'HARD: same dish, reversed word order + 滑 flourish' },
  { a: '豬扒包', b: 'Pork chop bun', same: true, probes: 'cross-language' },
  { a: '絲襪奶茶', b: '港式奶茶', same: true, probes: 'HARD: two names for one drink, no shared characters' },
  { a: '白灼蝦', b: '白灼海蝦', same: true, probes: '海 specifies the standard prawn' },
  { a: '車仔麵', b: 'Cart noodles', same: true, probes: 'cross-language' },
  { a: '生滾魚片粥', b: '魚片粥', same: true, probes: '生滾 names the standard method' },
  { a: '楊州炒飯', b: '揚州炒飯', same: true, probes: 'common HK misspelling 楊/揚' },

  // ── FALSE: near-misses that must NOT merge ────────────────────────────────
  { a: '白切雞', b: '海南雞', same: false, probes: 'ADVERSARIAL: both poached chicken, different dishes' },
  { a: '牛腩麵', b: '牛腩撈麵', same: false, probes: 'soup noodle vs tossed dry noodle' },
  { a: '雲吞麵', b: '水餃麵', same: false, probes: 'different dumpling' },
  { a: '奶茶', b: '鴛鴦', same: false, probes: 'ADVERSARIAL: 鴛鴦 is tea+coffee, no shared chars' },
  { a: '腸粉', b: '炸兩', same: false, probes: 'ADVERSARIAL: 炸兩 is 腸粉 wrapped around 油條' },
  { a: '皮蛋瘦肉粥', b: '艇仔粥', same: false, probes: 'different congee' },
  { a: '蜜汁叉燒', b: '蜜汁燒排骨', same: false, probes: 'shared 蜜汁, different protein' },
  { a: '豬扒包', b: '菠蘿包', same: false, probes: 'different bun entirely' },
  { a: '蝦仁炒蛋', b: '蝦仁炒飯', same: false, probes: 'shared protein, egg vs rice' },
  { a: '生炒糯米飯', b: '糯米雞', same: false, probes: 'both glutinous rice, different dish' },
  { a: '星洲炒米', b: '廈門炒米', same: false, probes: 'HARD: different regional fried vermicelli' },
  { a: '車仔麵', b: '公仔麵', same: false, probes: 'ADVERSARIAL: one char, cart noodles vs instant noodles' },
  { a: '白灼蝦', b: '椒鹽蝦', same: false, probes: 'same protein, different preparation' },
  { a: '蘿蔔糕', b: '芋頭糕', same: false, probes: '★live corpus shape: different root vegetable' },
  { a: '滑蛋蝦仁', b: '滑蛋牛肉', same: false, probes: 'same prep, different protein' },
];

/** RETIRED — the first, contaminated set: these pairs appear as worked examples
 *  inside arm B's prompt, so scoring them measured recall of the prompt, not
 *  dish resolution. Kept visible so the mistake is on the record, not deleted. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const RETIRED_CONTAMINATED_CASES: Case[] = [
  // ── TRUE: the core case the whole feature exists for ──────────────────────
  { a: '乾炒牛河', b: '干炒牛河', same: true, probes: 'traditional vs simplified 乾/干' },
  { a: '乾炒牛河', b: 'Beef chow fun', same: true, probes: 'cross-language, same dish' },
  { a: '乾炒牛河', b: '招牌乾炒牛河', same: true, probes: '招牌 house-special prefix is not a dish change' },
  { a: '蝦餃', b: '水晶鮮蝦餃', same: true, probes: 'appearance/freshness flourishes' },
  { a: '蝦餃', b: 'Har gow', same: true, probes: 'romanisation' },
  { a: '雲吞麵', b: '鮮蝦雲吞麵', same: true, probes: '鮮蝦 describes the standard wonton filling' },
  { a: '菠蘿油', b: '菠蘿包配牛油', same: true, probes: 'same item, one spells out the butter' },
  { a: '楊枝甘露', b: 'Mango pomelo sago', same: true, probes: 'cross-language dessert' },
  { a: '舒芙蕾鬆餅', b: '日式舒芙蕾鬆餅', same: true, probes: '★live corpus: 日式 style qualifier' },
  { a: '壽司拼盤', b: 'sushi platter', same: true, probes: '★live corpus: exact cross-language' },
  { a: '白切雞', b: '海南雞', same: false, probes: 'ADVERSARIAL: both poached chicken, different dishes' },
  { a: '揚州炒飯', b: 'Yang Chow fried rice', same: true, probes: 'romanisation of a specific fried rice' },
  { a: '牛腩麵', b: '牛腩撈麵', same: false, probes: 'soup noodle vs tossed/dry noodle — different plate' },
  { a: '叉燒飯', b: '叉燒例牌飯', same: true, probes: '例牌 is a portion-size marker' },

  // ── FALSE: near-misses that must NOT merge ────────────────────────────────
  { a: '乾炒牛河', b: '濕炒牛河', same: false, probes: 'ONE CHAR apart, completely different dish' },
  { a: '乾炒牛河', b: '乾炒牛河飯', same: false, probes: 'noodle dish vs rice plate' },
  { a: '燒鵝', b: '燒鵝髀飯', same: false, probes: '★live corpus: the meat vs a rice plate of it' },
  { a: '蒜蓉黃油蝦', b: '蒜蓉魷魚絲', same: false, probes: '★live corpus: shared 蒜蓉 token, different protein' },
  { a: '烤串', b: '烤豬肉串', same: false, probes: '★live corpus: category vs specific item' },
  { a: '壽司拼盤', b: '大致壽司', same: false, probes: '★live corpus: ambiguous vision read, should reject' },
  { a: '菠蘿包', b: '菠蘿油', same: false, probes: 'the 油 (butter slab) IS the difference' },
  { a: '雲吞麵', b: '水餃麵', same: false, probes: 'different dumpling entirely' },
  { a: '叉燒飯', b: '油雞飯', same: false, probes: '★live corpus shape: different protein on rice' },
  { a: '揚州炒飯', b: '炒飯', same: false, probes: 'specific dish vs the generic category' },
  { a: '蒸蛋', b: '蒸水蛋', same: true, probes: 'TRUE despite looking like the above — same dish' },
  { a: '魚蛋粉', b: '魚蛋河', same: false, probes: 'same topping, different noodle — HK treats these separately' },
  { a: '西多士', b: 'French toast', same: true, probes: 'cross-language' },
  { a: '奶茶', b: '鴛鴦', same: false, probes: 'adversarial: 鴛鴦 is tea+coffee, a different drink' },
  { a: '腸粉', b: '炸兩', same: false, probes: 'adversarial: 炸兩 is 腸粉 wrapped around 油條' },
  { a: '生滾牛肉粥', b: '牛肉粥', same: true, probes: '生滾 names the standard cooking method' },
];

const CROSS_VENUE_SYSTEM = `You decide whether two dish names, FROM DIFFERENT RESTAURANTS, refer to the same
dish — so that a diner could compare the two plates and say which kitchen makes it better.

This is NOT a question about menus. Two restaurants always price and serve their own
version separately; that is irrelevant here. The question is whether the two names
denote the same dish in the way a Hong Kong diner means it when they say "their
乾炒牛河 is better than that place's".

SAME dish — the core item is identical and only wording, language, romanisation,
regional style, portion, or house-special framing differs:
- "乾炒牛河" vs "干炒牛河" vs "Beef chow fun" — script, language
- "招牌乾炒牛河" vs "乾炒牛河" — 招牌/特色/精選 are marketing framing
- "蝦餃" vs "水晶鮮蝦餃" — 水晶/鮮 are flourishes on one dumpling
- "叉燒飯" vs "叉燒例牌飯" — 例牌/大/細 are portion markers
- "生滾牛肉粥" vs "牛肉粥" — names the standard method

DIFFERENT dishes — the plate itself changes:
- "乾炒牛河" vs "濕炒牛河" — dry-fried vs gravy; one character, different dish
- "乾炒牛河" vs "乾炒牛河飯" — a noodle dish vs a rice plate
- "燒鵝" vs "燒鵝髀飯" — the meat vs a rice plate built on it
- "蒜蓉黃油蝦" vs "蒜蓉魷魚絲" — shared seasoning, different protein
- "菠蘿包" vs "菠蘿油" — the butter slab IS the item
- "揚州炒飯" vs "炒飯" — a named dish vs the generic category
- "烤串" vs "烤豬肉串" — a category vs one specific skewer
- "魚蛋粉" vs "魚蛋河" — same topping, different noodle; HK treats these as separate

Decisive test: if a diner ordered one expecting the other, would they feel they got
the wrong thing? If yes, DIFFERENT.

Beware near-identical strings that are different dishes, and very different strings
that are the same dish. String similarity is not the signal.

When genuinely unsure, answer false. A wrong merge permanently fuses two dishes'
rating histories; a missed merge is harmless and fixable.

Respond with ONLY a JSON array, no prose, no fences, one object per pair IN ORDER:
[{"i": <index>, "same": true|false, "confidence": 0.0-1.0}]`;

// Arm A: the shipped within-restaurant prompt, verbatim from dishMatch.ts, with
// only the response format adapted to this eval's pair-indexed shape.
const WITHIN_RESTAURANT_SYSTEM = `You decide whether two restaurant dish names refer to the SAME real-world dish
on the same restaurant's menu, or to two DIFFERENT dishes.

The names come from independent machine guesses (a menu OCR and a photo recognition),
so the same dish is often written with different levels of detail, different wording,
or a different mix of English and Traditional Chinese.

SAME dish — descriptive or stylistic variation of one item:
- "水晶鮮蝦餃" vs "蝦餃" — 水晶/鮮 are appearance/freshness flourishes on one dumpling
- "Steamed shrimp dumpling" vs "Shrimp Dumpling" — cooking method already implied
- "Pan-fried turnip cake" vs "Turnip cake" — same item, one names the default prep

DIFFERENT dishes — a defining ingredient, protein, or preparation actually changes:
- "蝦壽司" vs "壽司" — 蝦 (shrimp) names a specific topping; plain 壽司 is not it
- "軍艦壽司拼盤" vs "壽司" — an assorted platter is a distinct menu item
- "Roast duck rice" vs "Roast duck and char siu rice" — char siu is a real addition
- Any two items a restaurant would price and serve separately

The decisive question is NOT string similarity. It is: would a kitchen hand you the
same plate for both names? A shorter name being contained inside a longer one means
NOTHING on its own — that is true of both examples above and they land differently.

When genuinely unsure, answer "different". A wrong merge is permanent and destroys a
real dish's rating history; a missed merge is harmless and can be fixed later.

Respond with ONLY a JSON array, no prose, no fences, one object per pair IN ORDER:
[{"i": <index>, "same": true|false, "confidence": 0.0-1.0}]`;

type Verdict = { i: number; same: boolean; confidence: number };

/** The configured model (qwen3.7-plus) is a REASONING model: it spends the token
 *  budget thinking before it emits content, so a 30-pair batch at a modest
 *  maxTokens truncates into unparseable output. Small batches + a high ceiling. */
const BATCH = 6;

async function runArm(label: string, system: string): Promise<Verdict[]> {
  const out: Verdict[] = [];
  for (let start = 0; start < CASES.length; start += BATCH) {
    const slice = CASES.slice(start, start + BATCH);
    const prompt = slice.map((c, k) => `${start + k}. "${c.a}"  vs  "${c.b}"`).join('\n');
    const raw = await callClaude(system, `Pairs:\n${prompt}`, { maxTokens: 6000, expectJson: true });
    const parsed = parseJsonResponse<Verdict[]>(raw);
    if (!Array.isArray(parsed)) {
      console.error(`  ${label}: batch @${start} unusable — those pairs go unscored`);
      continue;
    }
    out.push(...parsed);
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  return out;
}

function score(label: string, verdicts: Verdict[]) {
  const byIdx = new Map(verdicts.map(v => [v.i, v]));
  let tp = 0, tn = 0, fp = 0, fn = 0, missing = 0;
  const errors: string[] = [];

  CASES.forEach((c, i) => {
    const v = byIdx.get(i);
    if (!v || typeof v.same !== 'boolean') { missing++; return; }
    if (v.same && c.same) tp++;
    else if (!v.same && !c.same) tn++;
    else if (v.same && !c.same) {
      fp++;
      errors.push(`  FALSE MERGE  "${c.a}" = "${c.b}"  (conf ${v.confidence ?? '?'}) — ${c.probes}`);
    } else {
      fn++;
      errors.push(`  missed match "${c.a}" ≠ "${c.b}"  (conf ${v.confidence ?? '?'}) — ${c.probes}`);
    }
  });

  const n = tp + tn + fp + fn;
  const acc = n ? ((tp + tn) / n) * 100 : 0;
  const precision = tp + fp ? (tp / (tp + fp)) * 100 : 0;
  const recall = tp + fn ? (tp / (tp + fn)) * 100 : 0;

  console.log(`\n═══ ${label} ═══`);
  console.log(`  accuracy   ${acc.toFixed(1)}%   (${tp + tn}/${n})`);
  console.log(`  precision  ${precision.toFixed(1)}%   — of merges proposed, how many were right`);
  console.log(`  recall     ${recall.toFixed(1)}%   — of true same-dish pairs, how many found`);
  console.log(`  FALSE MERGES: ${fp}  (the dangerous error — permanent history fusion)`);
  console.log(`  missed:       ${fn}  (harmless, fixable)`);
  if (missing) console.log(`  unscored:     ${missing}`);
  if (errors.length) { console.log('  ── errors ──'); errors.forEach(e => console.log(e)); }
  return { acc, precision, recall, fp, fn };
}

// Guarded: this module EXPORTS CASES for the Phase 1 catalog eval, and an
// unguarded top-level IIFE fired both arms (real, billed LLM calls) merely on
// import. Only run when invoked directly.
const invokedDirectly = process.argv[1]?.includes('eval-cross-venue-dish');
(async () => {
  if (!invokedDirectly) return;
  console.log(`Cross-venue dish resolution — ${CASES.length} hard pairs`);
  console.log(`(${CASES.filter(c => c.same).length} true same-dish, ${CASES.filter(c => !c.same).length} true different)`);

  const a = await runArm('arm A', WITHIN_RESTAURANT_SYSTEM);
  const resA = score('ARM A — shipped within-restaurant prompt (baseline)', a);

  const b = await runArm('arm B', CROSS_VENUE_SYSTEM);
  const resB = score('ARM B — cross-venue prompt', b);

  console.log('\n═══ VERDICT ═══');
  console.log(`  accuracy   ${resA.acc.toFixed(1)}%  →  ${resB.acc.toFixed(1)}%`);
  console.log(`  precision  ${resA.precision.toFixed(1)}%  →  ${resB.precision.toFixed(1)}%`);
  console.log(`  false merges ${resA.fp}  →  ${resB.fp}`);
})();
