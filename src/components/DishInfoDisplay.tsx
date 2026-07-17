'use client';
import { useLang } from '@/lib/i18n';
import { cookingBucket, type CookingMethod, type Heaviness } from '@/lib/menuScan';

// The dish info format, in ONE place. This used to live only inside scan/page.tsx,
// so a dish read off a menu showed cooking style + diet + heaviness, while the very
// same dish — once rated and shown on the Taste tab — showed none of it. Same dish,
// two different amounts of information, purely as an accident of which screen you
// met it on. Both now render through this.

const DIET_ICON: Record<string, string> = {
  veg: '\u{1F331}', pork: '\u{1F416}', beef: '\u{1F404}',
  chicken: '\u{1F414}', duck_goose: '\u{1F986}', lamb: '\u{1F411}',
  seafood: '\u{1F41F}', shellfish: '\u{1F990}',
  egg: '\u{1F95A}', dairy: '\u{1F95B}',
  // offal: deliberately no emoji \u2014 nothing tasteful reads as "offal" at chip size,
  // and a wrong-but-cute icon is worse than the text label alone.
  peanut: '\u{1F95C}', spicy: '\u{1F336}\uFE0F',
};

// Filled/hollow dots for the heaviness chip: 清淡●○○ / 適中●●○ / 濃郁●●●
// — a quick-scan visual alongside the text label, not a replacement for it.
const HEAVINESS_DOTS: Record<Heaviness, string> = {
  light: '\u25cf\u25cb\u25cb', medium: '\u25cf\u25cf\u25cb', heavy: '\u25cf\u25cf\u25cf',
};

// Ingredients are OPEN free text (any of thousands), so unlike the closed diet
// vocabulary they can't all have icons. This maps only the common, cleanly-
// iconifiable ones by keyword substring; anything without a confident match is
// dropped (see ingredientIcon). Deliberately NOT exhaustive \u2014 the full,
// text-labelled ingredient list is a future dish-detail view (see BACKLOG).
const INGREDIENT_ICON: { keys: string[]; icon: string }[] = [
  { keys: ['garlic'], icon: '\u{1F9C4}' },
  { keys: ['ginger'], icon: '\u{1FADA}' },
  { keys: ['chili', 'chilli', 'chile'], icon: '\u{1F336}\ufe0f' },
  { keys: ['mushroom', 'shiitake', 'enoki', 'porcini'], icon: '\u{1F344}' },
  { keys: ['onion', 'shallot', 'scallion', 'leek'], icon: '\u{1F9C5}' },
  { keys: ['tomato'], icon: '\u{1F345}' },
  { keys: ['egg'], icon: '\u{1F95A}' },
  { keys: ['carrot'], icon: '\u{1F955}' },
  { keys: ['potato'], icon: '\u{1F954}' },
  { keys: ['corn'], icon: '\u{1F33D}' },
  { keys: ['eggplant', 'aubergine'], icon: '\u{1F346}' },
  { keys: ['broccoli'], icon: '\u{1F966}' },
  { keys: ['cucumber'], icon: '\u{1F952}' },
  { keys: ['bell pepper', 'capsicum'], icon: '\u{1FAD1}' },
  { keys: ['lettuce', 'cabbage', 'spinach', 'bok choy', 'choy', 'kale', 'greens'], icon: '\u{1F96C}' },
  { keys: ['lemon', 'lime'], icon: '\u{1F34B}' },
  { keys: ['avocado'], icon: '\u{1F951}' },
  { keys: ['coconut'], icon: '\u{1F965}' },
  { keys: ['pineapple'], icon: '\u{1F34D}' },
  { keys: ['mango'], icon: '\u{1F96D}' },
  { keys: ['apple'], icon: '\u{1F34E}' },
  { keys: ['banana'], icon: '\u{1F34C}' },
  { keys: ['grape'], icon: '\u{1F347}' },
  { keys: ['strawberr'], icon: '\u{1F353}' },
  { keys: ['peach'], icon: '\u{1F351}' },
  { keys: ['cherr'], icon: '\u{1F352}' },
  { keys: ['olive'], icon: '\u{1FAD2}' },
  { keys: ['bean', 'edamame'], icon: '\u{1FAD8}' },
  { keys: ['peanut', 'cashew', 'almond', 'walnut', 'nut'], icon: '\u{1F95C}' },
  { keys: ['cheese'], icon: '\u{1F9C0}' },
  { keys: ['butter'], icon: '\u{1F9C8}' },
  { keys: ['bread', 'bun', 'toast'], icon: '\u{1F35E}' },
  { keys: ['rice'], icon: '\u{1F35A}' },
  { keys: ['noodle', 'pasta', 'ramen', 'udon'], icon: '\u{1F35C}' },
  { keys: ['shrimp', 'prawn'], icon: '\u{1F990}' },
  { keys: ['crab'], icon: '\u{1F980}' },
  { keys: ['lobster'], icon: '\u{1F99E}' },
  { keys: ['squid', 'calamari'], icon: '\u{1F991}' },
  { keys: ['octopus'], icon: '\u{1F419}' },
  { keys: ['fish', 'salmon', 'tuna', 'cod'], icon: '\u{1F41F}' },
  { keys: ['bacon'], icon: '\u{1F953}' },
  { keys: ['chicken'], icon: '\u{1F357}' },
  { keys: ['beef', 'steak'], icon: '\u{1F969}' },
  { keys: ['pork'], icon: '\u{1F416}' },
  { keys: ['duck'], icon: '\u{1F986}' },
  { keys: ['lamb', 'mutton'], icon: '\u{1F411}' },
  { keys: ['honey'], icon: '\u{1F36F}' },
  { keys: ['milk', 'cream'], icon: '\u{1F95B}' },
  { keys: ['chocolate', 'cocoa'], icon: '\u{1F36B}' },
  { keys: ['herb', 'basil', 'mint', 'cilantro', 'coriander', 'parsley', 'lemongrass'], icon: '\u{1F33F}' },
];

/** One emoji for an ingredient, or null if there's no confident icon (in which
 * case the caller drops it entirely). Condiments/liquids are skipped up front:
 * they have no honest single-ingredient icon and would otherwise borrow their
 * base word's icon misleadingly (e.g. "oyster sauce" -> shellfish). */
function ingredientIcon(raw: string): string | null {
  const s = raw.toLowerCase();
  if (/sauce|paste|stock|broth|vinegar|powder|seasoning/.test(s)) return null;
  for (const { keys, icon } of INGREDIENT_ICON) {
    if (keys.some(k => s.includes(k))) return icon;
  }
  return null;
}

// Chinese (HK) names for the iconifiable ingredients, so chips read native in
// zh mode (stored names are lowercase English). Specific/compound keys come
// FIRST so they win the substring match (e.g. "chinese broccoli" → 芥蘭 before
// generic "broccoli" → 西蘭花). Falls back to the English name if unmatched.
const INGREDIENT_ZH: { keys: string[]; zh: string }[] = [
  { keys: ['chinese broccoli', 'kai lan', 'kailan', 'gai lan', 'kalian'], zh: '芥蘭' },
  { keys: ['bok choy', 'pak choi'], zh: '白菜' },
  { keys: ['napa', 'chinese cabbage'], zh: '大白菜' },
  { keys: ['green bean', 'string bean', 'french bean'], zh: '四季豆' },
  { keys: ['edamame'], zh: '毛豆' },
  { keys: ['bell pepper', 'capsicum'], zh: '燈籠椒' },
  { keys: ['green onion', 'spring onion', 'scallion'], zh: '蔥' },
  { keys: ['mock fish', 'vegetarian fish', 'veggie fish'], zh: '齋魚' },
  { keys: ['shiitake'], zh: '冬菇' },
  { keys: ['enoki'], zh: '金菇' },
  { keys: ['oyster mushroom'], zh: '蠔菇' },
  { keys: ['porcini'], zh: '牛肝菌' },
  { keys: ['mushroom'], zh: '蘑菇' },
  { keys: ['garlic'], zh: '蒜' },
  { keys: ['ginger'], zh: '薑' },
  { keys: ['chili', 'chilli', 'chile'], zh: '辣椒' },
  { keys: ['shallot'], zh: '乾蔥' },
  { keys: ['leek'], zh: '大蔥' },
  { keys: ['onion'], zh: '洋蔥' },
  { keys: ['tomato'], zh: '番茄' },
  { keys: ['egg'], zh: '蛋' },
  { keys: ['carrot'], zh: '甘筍' },
  { keys: ['potato'], zh: '薯仔' },
  { keys: ['corn'], zh: '粟米' },
  { keys: ['eggplant', 'aubergine'], zh: '茄子' },
  { keys: ['broccoli'], zh: '西蘭花' },
  { keys: ['cucumber'], zh: '青瓜' },
  { keys: ['lettuce'], zh: '生菜' },
  { keys: ['spinach'], zh: '菠菜' },
  { keys: ['kale'], zh: '羽衣甘藍' },
  { keys: ['cabbage'], zh: '椰菜' },
  { keys: ['choy', 'greens'], zh: '青菜' },
  { keys: ['lemon'], zh: '檸檬' },
  { keys: ['lime'], zh: '青檸' },
  { keys: ['avocado'], zh: '牛油果' },
  { keys: ['coconut'], zh: '椰子' },
  { keys: ['pineapple'], zh: '菠蘿' },
  { keys: ['mango'], zh: '芒果' },
  { keys: ['apple'], zh: '蘋果' },
  { keys: ['banana'], zh: '香蕉' },
  { keys: ['grape'], zh: '提子' },
  { keys: ['strawberr'], zh: '士多啤梨' },
  { keys: ['peach'], zh: '桃' },
  { keys: ['cherr'], zh: '車厘子' },
  { keys: ['olive'], zh: '橄欖' },
  { keys: ['peanut'], zh: '花生' },
  { keys: ['cashew'], zh: '腰果' },
  { keys: ['almond'], zh: '杏仁' },
  { keys: ['walnut'], zh: '合桃' },
  { keys: ['nut'], zh: '果仁' },
  { keys: ['bean'], zh: '豆' },
  { keys: ['cheese'], zh: '芝士' },
  { keys: ['butter'], zh: '牛油' },
  { keys: ['bread', 'bun', 'toast'], zh: '麵包' },
  { keys: ['rice'], zh: '飯' },
  { keys: ['ramen'], zh: '拉麵' },
  { keys: ['udon'], zh: '烏冬' },
  { keys: ['pasta', 'spaghetti'], zh: '意粉' },
  { keys: ['noodle'], zh: '麵' },
  { keys: ['shrimp', 'prawn'], zh: '蝦' },
  { keys: ['crab'], zh: '蟹' },
  { keys: ['lobster'], zh: '龍蝦' },
  { keys: ['squid', 'calamari'], zh: '魷魚' },
  { keys: ['octopus'], zh: '八爪魚' },
  { keys: ['salmon'], zh: '三文魚' },
  { keys: ['tuna'], zh: '吞拿魚' },
  { keys: ['cod'], zh: '鱈魚' },
  { keys: ['fish'], zh: '魚' },
  { keys: ['bacon'], zh: '煙肉' },
  { keys: ['chicken'], zh: '雞' },
  { keys: ['beef', 'steak'], zh: '牛肉' },
  { keys: ['pork'], zh: '豬肉' },
  { keys: ['duck'], zh: '鴨' },
  { keys: ['lamb', 'mutton'], zh: '羊' },
  { keys: ['honey'], zh: '蜜糖' },
  { keys: ['cream'], zh: '忌廉' },
  { keys: ['milk'], zh: '奶' },
  { keys: ['chocolate', 'cocoa'], zh: '朱古力' },
  { keys: ['basil'], zh: '羅勒' },
  { keys: ['mint'], zh: '薄荷' },
  { keys: ['cilantro', 'coriander'], zh: '芫茜' },
  { keys: ['parsley'], zh: '番茜' },
  { keys: ['lemongrass'], zh: '香茅' },
  { keys: ['herb'], zh: '香草' },
];

function ingredientZh(raw: string): string | null {
  const s = raw.toLowerCase();
  for (const { keys, zh } of INGREDIENT_ZH) {
    if (keys.some(k => s.includes(k))) return zh;
  }
  return null;
}

export type DishInfo = {
  cooking_method?: CookingMethod | string | null;
  heaviness?: Heaviness | string | null;
  diet?: string[] | null;
  ingredients?: string[] | null;
};

export default function DishInfoDisplay({ info, compact = false, hideHook = false }: { info: DishInfo; compact?: boolean; hideHook?: boolean }) {
  const { t, lang } = useLang();

  // null for 'other'/unknown — nothing honest to show, so nothing is shown. A
  // fabricated cooking category would be worse than an absent one.
  const bucket = cookingBucket(info.cooking_method as CookingMethod | null | undefined);
  const bucketText = bucket ? t(`scan.bucket.${bucket}`) : null;
  // hideHook: the caller already shows the cooking style elsewhere (e.g. the
  // journal meta line), so rendering it here too would duplicate it.
  const showHook = !!bucketText && !hideHook;
  const diet = info.diet ?? [];
  // Icons already shown as diet chips — an ingredient chip that repeats one of
  // these is redundant (e.g. a 🌶️ chili ingredient next to the 🌶️ 辣 diet flag,
  // or a 🥜 peanut ingredient next to the 🥜 花生 flag), so it's dropped: the diet
  // chip wins, since it's the derived, higher-signal one.
  const dietIcons = new Set(diet.map(d => DIET_ICON[d]).filter(Boolean));
  // Key ingredients become chips in the SAME row as the diet flags (icon + name),
  // matching the 🌱 素 / 🌶️ 辣 treatment. Only the ones with a confident icon are
  // shown; the rest are dropped, and the full text list is a future dish-detail
  // view (see BACKLOG). Names are stored lowercase English; in zh mode the chip
  // shows the Chinese name (ingredientZh), falling back to English if unmapped.
  const ingredients = (info.ingredients ?? []).filter(Boolean);
  const ingredientChips = ingredients
    .map(name => ({ name, icon: ingredientIcon(name) }))
    .filter((x): x is { name: string; icon: string } => !!x.icon && !dietIcons.has(x.icon))
    .map(({ name, icon }) => ({ label: lang === 'zh' ? (ingredientZh(name) ?? name) : name, icon }));
  const hasChips = diet.length > 0 || ingredientChips.length > 0 || !!info.heaviness;

  if (!showHook && !hasChips) return null;

  return (
    <>
      {showHook && <div className="card-meta dish-hook">{bucketText}</div>}
      {hasChips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: compact ? 6 : 5 }}>
          {diet.map(d => (
            <span key={`diet-${d}`} className="chip scan-chip">
              <span className="scan-chip-icon">{DIET_ICON[d] ?? ''}</span>
              <span className="scan-chip-label">{t(`scan.diet.${d}`)}</span>
            </span>
          ))}
          {ingredientChips.map(({ label, icon }, i) => (
            <span key={`ing-${i}-${label}`} className="chip scan-chip">
              <span className="scan-chip-icon">{icon}</span>
              <span className="scan-chip-label">{label}</span>
            </span>
          ))}
          {/* Heaviness (清淡/適中/濃郁) is always the LAST chip — it's the overall
              intensity summary, so it reads as a closing note after the specifics. */}
          {info.heaviness && (
            <span className="chip scan-chip">
              <span className="scan-chip-label">
                {t(`scan.heaviness.${info.heaviness}`)}
                {' '}
                <span className="heaviness-dots" aria-hidden>
                  {HEAVINESS_DOTS[info.heaviness as Heaviness]}
                </span>
              </span>
            </span>
          )}
        </div>
      )}
    </>
  );
}
