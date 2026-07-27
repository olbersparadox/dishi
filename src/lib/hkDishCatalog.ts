// Canonical dish catalog for HK — cross-venue dish identity (the KEYSTONE item).
//
// Each dish row resolves ONCE against this list at enrichment; two dishes are
// the same real-world dish iff they land on the same id. That replaces O(N²)
// pairwise matching with O(N) classification, and no string prefilter exists to
// be defeated (絲襪奶茶 / 港式奶茶 share zero characters and both land on
// `milk-tea`). Evidence: docs/rnd/cross-venue-dish-phase0.md — 0 false merges
// on every run, 100% on decided held-out pairs.
//
// GROWTH POLICY (settled 2026-07-28): entries are curated and human-reviewed,
// never auto-minted — auto-minting recreates the false-merge risk this design
// exists to prevent. Frequent honest-"none" clusters surface for review via
// dishes with a NULL canonical_dish_id; an uncovered dish is a safe state, not
// a failure.
//
// `comparable` was deliberately NOT carried over from the R&D file: settled
// 2026-07-27 as uniformly true ("if it is common enough that different
// restaurants offer it, a set is itself a dish in the customer's mind") — a
// column that is true for every row is dead weight. Generic CATEGORY entries
// (炒飯, 燉湯) are handled structurally instead: see isCategoryEntry below.
//
// STRUCTURES (hkDishCatalogStructures.gen.ts) are decomposed OFFLINE by
// scripts/generate-catalog-structures.ts and checked in, so the category
// derivation and every veto input are reviewable in a diff instead of being a
// runtime surprise.
import { STRUCTURES } from './hkDishCatalogStructures.gen';
import { isCategoryStructure, type DishStructure } from './dishStructure';

export type CatalogEntry = {
  id: string;
  zh: string;
  en: string;
};

export const CATALOG: CatalogEntry[] = [
  // ── 茶餐廳 cha chaan teng ────────────────────────────────────────────────
  { id: 'bolo-yau', zh: '菠蘿油', en: 'Pineapple bun with butter' },
  { id: 'bolo-bao', zh: '菠蘿包', en: 'Pineapple bun' },
  { id: 'french-toast-hk', zh: '西多士', en: 'Hong Kong French toast' },
  { id: 'milk-tea', zh: '港式奶茶', en: 'Hong Kong milk tea' },
  { id: 'yuenyeung', zh: '鴛鴦', en: 'Coffee with milk tea' },
  { id: 'lemon-tea', zh: '凍檸茶', en: 'Iced lemon tea' },
  { id: 'ham-macaroni', zh: '火腿通粉', en: 'Macaroni soup with ham' },
  { id: 'spam-egg-noodle', zh: '餐蛋麵', en: 'Spam and egg instant noodles' },
  { id: 'pork-chop-bun', zh: '豬扒包', en: 'Pork chop bun' },
  { id: 'egg-sandwich', zh: '蛋治', en: 'Egg sandwich' },
  { id: 'condensed-milk-toast', zh: '奶醬多', en: 'Condensed milk and butter toast' },
  { id: 'baked-pork-chop-rice', zh: '焗豬扒飯', en: 'Baked pork chop rice' },
  { id: 'set-meal-cha-chaan-teng', zh: '常餐', en: 'Cha chaan teng set meal' },
  { id: 'club-sandwich', zh: '公司三文治', en: 'Club sandwich' },
  { id: 'instant-noodle-generic', zh: '公仔麵', en: 'Instant noodles' },

  // ── 燒味 roast meats ─────────────────────────────────────────────────────
  { id: 'char-siu-rice', zh: '叉燒飯', en: 'Char siu rice' },
  { id: 'char-siu', zh: '蜜汁叉燒', en: 'Honey-glazed char siu' },
  { id: 'roast-goose', zh: '燒鵝', en: 'Roast goose' },
  { id: 'roast-goose-thigh-rice', zh: '燒鵝髀飯', en: 'Roast goose thigh rice' },
  { id: 'roast-duck-rice', zh: '燒鴨飯', en: 'Roast duck rice' },
  { id: 'soy-chicken', zh: '油雞', en: 'Soy-poached chicken' },
  { id: 'soy-chicken-rice', zh: '油雞飯', en: 'Soy-poached chicken rice' },
  { id: 'white-cut-chicken', zh: '白切雞', en: 'White cut chicken' },
  { id: 'hainan-chicken-rice', zh: '海南雞飯', en: 'Hainanese chicken rice' },
  { id: 'siu-yuk', zh: '燒肉', en: 'Crispy roast pork belly' },
  { id: 'roast-meat-platter-rice', zh: '燒味拼盤飯', en: 'Mixed roast meat rice' },
  { id: 'roast-pigeon', zh: '乳鴿', en: 'Roast pigeon' },

  // ── 點心 dim sum ─────────────────────────────────────────────────────────
  { id: 'har-gow', zh: '蝦餃', en: 'Har gow (shrimp dumpling)' },
  { id: 'siu-mai', zh: '燒賣', en: 'Siu mai' },
  { id: 'char-siu-bao', zh: '叉燒包', en: 'Char siu bao' },
  { id: 'cheung-fun', zh: '腸粉', en: 'Rice noodle roll' },
  { id: 'ja-leung', zh: '炸兩', en: 'Rice noodle roll with fried dough' },
  { id: 'turnip-cake', zh: '蘿蔔糕', en: 'Turnip cake' },
  { id: 'taro-cake', zh: '芋頭糕', en: 'Taro cake' },
  { id: 'chicken-feet', zh: '鳳爪', en: 'Braised chicken feet' },
  { id: 'steamed-spare-ribs', zh: '豉汁蒸排骨', en: 'Steamed spare ribs with black bean' },
  { id: 'egg-tart', zh: '蛋撻', en: 'Egg tart' },
  { id: 'lo-mai-gai', zh: '糯米雞', en: 'Lotus leaf glutinous rice with chicken' },
  { id: 'spring-roll', zh: '春卷', en: 'Spring roll' },
  { id: 'malai-go', zh: '馬拉糕', en: 'Steamed sponge cake' },
  { id: 'beef-ball', zh: '牛肉球', en: 'Steamed beef balls' },
  { id: 'tripe', zh: '金錢肚', en: 'Braised honeycomb tripe' },
  { id: 'steamed-pork-patty', zh: '蒸肉餅', en: 'Steamed pork patty' },
  // Added after the Phase 1 coverage run surfaced them as honest "none" misses.
  // The 84.9% coverage figure in the results doc is PRE-patch — re-run to update it.
  { id: 'steamed-egg', zh: '蒸水蛋', en: 'Steamed egg custard' },
  { id: 'duck-wings', zh: '火鴨翅', en: 'Roast duck wings' },
  { id: 'xiao-long-bao', zh: '小籠包', en: 'Xiao long bao' },
  { id: 'dim-sum-platter', zh: '點心拼盤', en: 'Assorted dim sum platter' },

  // ── 粥粉麵 congee, rice noodle, noodle ───────────────────────────────────
  { id: 'wonton-noodle', zh: '雲吞麵', en: 'Wonton noodle soup' },
  { id: 'dumpling-noodle', zh: '水餃麵', en: 'Dumpling noodle soup' },
  { id: 'beef-brisket-noodle', zh: '牛腩麵', en: 'Beef brisket noodle soup' },
  { id: 'beef-brisket-lo-mein', zh: '牛腩撈麵', en: 'Beef brisket tossed noodles' },
  { id: 'fishball-noodle', zh: '魚蛋粉', en: 'Fishball rice noodles' },
  { id: 'fishball-ho-fun', zh: '魚蛋河', en: 'Fishball flat rice noodles' },
  { id: 'cart-noodle', zh: '車仔麵', en: 'Cart noodles' },
  { id: 'century-egg-pork-congee', zh: '皮蛋瘦肉粥', en: 'Century egg and pork congee' },
  { id: 'sampan-congee', zh: '艇仔粥', en: 'Sampan congee' },
  { id: 'beef-congee', zh: '牛肉粥', en: 'Beef congee' },
  { id: 'fish-slice-congee', zh: '魚片粥', en: 'Fish slice congee' },
  { id: 'jook-sing-noodle', zh: '竹昇麵', en: 'Bamboo-pressed noodles' },
  { id: 'goose-intestine-noodle', zh: '鵝腸撈麵', en: 'Goose intestine tossed noodles' },
  { id: 'fish-soup-rice-noodle', zh: '魚湯米線', en: 'Fish soup rice vermicelli' },

  // ── 小炒 / 飯麵 stir fry, fried rice and noodles ────────────────────────
  { id: 'beef-chow-fun', zh: '乾炒牛河', en: 'Dry-fried beef ho fun' },
  { id: 'wet-chow-fun', zh: '濕炒牛河', en: 'Beef ho fun in gravy' },
  { id: 'singapore-vermicelli', zh: '星洲炒米', en: 'Singapore fried vermicelli' },
  { id: 'xiamen-vermicelli', zh: '廈門炒米', en: 'Xiamen fried vermicelli' },
  { id: 'yangzhou-fried-rice', zh: '揚州炒飯', en: 'Yangzhou fried rice' },
  { id: 'fried-rice-generic', zh: '炒飯', en: 'Fried rice' },
  { id: 'scallop-fried-rice', zh: '帶子炒飯', en: 'Scallop fried rice' },
  { id: 'shrimp-fried-rice', zh: '蝦仁炒飯', en: 'Shrimp fried rice' },
  { id: 'sweet-sour-pork', zh: '咕嚕肉', en: 'Sweet and sour pork' },
  { id: 'black-bean-ribs', zh: '豉椒排骨', en: 'Stir-fried ribs with black bean and chili' },
  { id: 'mapo-tofu', zh: '麻婆豆腐', en: 'Mapo tofu' },
  { id: 'scrambled-egg-shrimp', zh: '滑蛋蝦仁', en: 'Scrambled egg with shrimp' },
  { id: 'scrambled-egg-beef', zh: '滑蛋牛肉', en: 'Scrambled egg with beef' },
  { id: 'sticky-rice-fried', zh: '生炒糯米飯', en: 'Wok-fried glutinous rice' },
  { id: 'salt-pepper-squid', zh: '椒鹽鮮魷', en: 'Salt and pepper squid' },
  { id: 'honey-ribs', zh: '蜜汁燒排骨', en: 'Honey-glazed ribs' },

  // ── 海鮮 seafood ─────────────────────────────────────────────────────────
  { id: 'blanched-prawn', zh: '白灼蝦', en: 'Blanched prawns' },
  { id: 'salt-pepper-prawn', zh: '椒鹽蝦', en: 'Salt and pepper prawns' },
  { id: 'garlic-butter-prawn', zh: '蒜蓉黃油蝦', en: 'Garlic butter prawns' },
  { id: 'steamed-scallop-vermicelli', zh: '蒜蓉粉絲蒸扇貝', en: 'Steamed scallops with garlic and glass noodles' },
  { id: 'steamed-fish', zh: '清蒸魚', en: 'Steamed whole fish' },
  { id: 'steamed-abalone', zh: '蒸鮑魚', en: 'Steamed abalone' },
  { id: 'mantis-shrimp', zh: '椒鹽瀨尿蝦', en: 'Salt and pepper mantis shrimp' },
  { id: 'typhoon-shelter-crab', zh: '避風塘炒蟹', en: 'Typhoon shelter crab' },
  { id: 'seafood-platter', zh: '海鮮拼盤', en: 'Seafood platter' },
  { id: 'stir-fried-prawn', zh: '炒蝦', en: 'Stir-fried prawns' },
  { id: 'garlic-squid', zh: '蒜蓉魷魚', en: 'Garlic squid' },
  { id: 'clams', zh: '炒蜆', en: 'Stir-fried clams' },

  // ── 火鍋 / 燉品 hotpot and soups ─────────────────────────────────────────
  { id: 'hotpot-sichuan', zh: '四川火鍋', en: 'Sichuan hotpot' },
  { id: 'hotpot-cantonese', zh: '打邊爐', en: 'Cantonese hotpot' },
  { id: 'shabu-shabu', zh: '涮涮鍋', en: 'Shabu-shabu' },
  { id: 'snake-soup', zh: '蛇羹', en: 'Snake soup' },
  { id: 'double-boiled-soup', zh: '燉湯', en: 'Double-boiled soup' },
  { id: 'mushroom-chicken', zh: '冬菇蒸雞', en: 'Steamed chicken with mushroom' },

  // ── 甜品 dessert ─────────────────────────────────────────────────────────
  { id: 'mango-pomelo-sago', zh: '楊枝甘露', en: 'Mango pomelo sago' },
  { id: 'double-skin-milk', zh: '雙皮奶', en: 'Double skin milk' },
  { id: 'black-sesame-soup', zh: '芝麻糊', en: 'Black sesame soup' },
  { id: 'tofu-fa', zh: '豆腐花', en: 'Tofu pudding' },
  { id: 'red-bean-soup', zh: '紅豆沙', en: 'Red bean soup' },
  { id: 'sticky-rice-ball', zh: '糯米丸子', en: 'Glutinous rice balls' },
  { id: 'souffle-pancake', zh: '舒芙蕾鬆餅', en: 'Soufflé pancakes' },
  { id: 'matcha-cream-bun', zh: '抹茶奶油包', en: 'Matcha cream bun' },

  // ── 日本菜 Japanese ──────────────────────────────────────────────────────
  { id: 'sushi-platter', zh: '壽司拼盤', en: 'Sushi platter' },
  { id: 'salmon-sashimi', zh: '三文魚刺身', en: 'Salmon sashimi' },
  { id: 'lobster-sashimi', zh: '龍蝦刺身', en: 'Lobster sashimi' },
  { id: 'kaisendon', zh: '海鮮丼', en: 'Seafood donburi' },
  { id: 'gyudon', zh: '牛丼', en: 'Beef donburi' },
  { id: 'unadon', zh: '鰻魚飯', en: 'Unagi donburi' },
  { id: 'tonkotsu-ramen', zh: '豚骨拉麵', en: 'Tonkotsu ramen' },
  { id: 'shoyu-ramen', zh: '醬油拉麵', en: 'Shoyu ramen' },
  { id: 'udon', zh: '烏冬', en: 'Udon' },
  { id: 'pork-udon', zh: '豬肉烏龍麵', en: 'Pork udon' },
  { id: 'tempura', zh: '天婦羅', en: 'Tempura' },
  { id: 'grilled-mackerel-set', zh: '燒鯖魚定食', en: 'Grilled mackerel set' },
  { id: 'hamburg-steak', zh: 'ハンバーグ', en: 'Japanese hamburg steak' },
  { id: 'karaage', zh: '唐揚雞', en: 'Karaage fried chicken' },
  { id: 'okonomiyaki', zh: '大阪燒', en: 'Okonomiyaki' },

  // ── 其他亞洲 other Asian ─────────────────────────────────────────────────
  { id: 'pad-thai', zh: '泰式炒金邊粉', en: 'Pad thai' },
  { id: 'tom-yum', zh: '冬蔭功', en: 'Tom yum goong' },
  { id: 'green-curry', zh: '青咖喱', en: 'Green curry' },
  { id: 'pho', zh: '越南牛肉粉', en: 'Beef pho' },
  { id: 'banh-mi', zh: '越南三明治', en: 'Banh mi' },
  { id: 'bibimbap', zh: '石鍋拌飯', en: 'Bibimbap' },
  { id: 'korean-fried-chicken', zh: '韓式炸雞', en: 'Korean fried chicken' },
  { id: 'butter-chicken', zh: '牛油雞', en: 'Butter chicken' },
  { id: 'biryani', zh: '印度炒飯', en: 'Biryani' },
  { id: 'satay', zh: '沙嗲', en: 'Satay skewers' },
  { id: 'grilled-skewers', zh: '烤串', en: 'Grilled skewers (assorted)' },
  { id: 'grilled-pork-skewer', zh: '烤豬肉串', en: 'Grilled pork skewers' },

  // ── 西餐 Western ─────────────────────────────────────────────────────────
  { id: 'carbonara', zh: '卡邦尼意粉', en: 'Carbonara' },
  { id: 'bolognese', zh: '肉醬意粉', en: 'Spaghetti bolognese' },
  { id: 'seafood-pasta', zh: '海鮮意粉', en: 'Seafood pasta' },
  { id: 'margherita-pizza', zh: '瑪格麗特薄餅', en: 'Margherita pizza' },
  { id: 'fish-and-chips', zh: '炸魚薯條', en: 'Fish and chips' },
  { id: 'fried-chicken-western', zh: '炸雞', en: 'Fried chicken' },
  { id: 'lobster-roll', zh: '龍蝦三明治', en: 'Lobster roll' },
  { id: 'greek-salad', zh: '希臘沙律', en: 'Greek salad' },
  { id: 'caesar-salad', zh: '凱撒沙律', en: 'Caesar salad' },
  { id: 'ceviche', zh: '秘魯青檸魚生', en: 'Ceviche' },
  { id: 'falafel-wrap', zh: '鷹嘴豆卷', en: 'Falafel wrap' },
  { id: 'steak', zh: '牛扒', en: 'Steak' },
  { id: 'burger', zh: '漢堡包', en: 'Burger' },
  { id: 'creamy-salmon-roe-pasta', zh: '奶油三文魚子意粉', en: 'Creamy pasta with salmon roe' },
];

export const CATALOG_BY_ID = new Map(CATALOG.map(e => [e.id, e]));

/** Precomputed structural decomposition of an entry's own zh name, or null when
 * the generated table doesn't cover it (fails safe: no structure -> no veto,
 * not a category). */
export function entryStructure(id: string): DishStructure | null {
  return STRUCTURES[id] ?? null;
}

/**
 * Category entries (炒飯, 燉湯) are false-merge magnets — 揚州炒飯 and 帶子炒飯
 * must never both collapse onto 炒飯 — so they are never merge TARGETS.
 * Derived from the empty-ingredient-slot signal, not a hand-maintained
 * blocklist; see isCategoryStructure for why `absent` (drinks, plain dishes)
 * deliberately does not trigger it.
 */
export function isCategoryEntry(id: string): boolean {
  const s = STRUCTURES[id];
  return !!s && isCategoryStructure(s);
}
