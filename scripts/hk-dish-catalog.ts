/**
 * CANDIDATE canonical dish catalog for HK — R&D Phase 1 input, not shipped code.
 *
 * The Phase 0 finding (docs/rnd/cross-venue-dish-phase0.md) was that pairwise
 * adjudication works but candidate GENERATION doesn't: the hardest true pair
 * (絲襪奶茶 / 港式奶茶) shares zero characters, so no string prefilter can
 * surface it. A catalog sidesteps retrieval entirely — each dish resolves ONCE
 * against this list, and two dishes are the same iff they land on the same id.
 *
 * `comparable` — SETTLED 2026-07-27, and now uniformly TRUE. The owner's rule:
 * **if it is common enough that different restaurants offer it, then a "set" is
 * itself a dish in the customer's mind.** 壽司拼盤 and 車仔麵 vary in
 * composition shop to shop, but a diner absolutely uses them to judge which
 * restaurant is better — which is exactly what execution comparison measures.
 * All 14 previously-false entries were flipped.
 *
 * CONSEQUENCE: the column is now dead weight and should NOT be carried into the
 * schema. Do not add a `comparable` field to canonical_dishes; it would be true
 * for every row. Kept here only to record that the question was asked and
 * answered.
 *
 * WHAT THE FLAG WAS MUDDLING — a separate, still-open problem. Two of the 14
 * were not "assorted dishes" at all but GENERIC CATEGORIES: 炒飯 (fried rice)
 * and 燉湯 (double-boiled soup). A category entry is a false-merge magnet —
 * 揚州炒飯 and 帶子炒飯 are different dishes that could both collapse onto 炒飯,
 * which is precisely the dangerous error class this design exists to prevent.
 * Categories should probably not be catalog entries at all; the resolver should
 * return "none" instead. Flagged for the schema design, NOT resolved here.
 */

export type CatalogEntry = {
  id: string;
  zh: string;
  en: string;
  comparable: boolean;
};

export const CATALOG: CatalogEntry[] = [
  // ── 茶餐廳 cha chaan teng ────────────────────────────────────────────────
  { id: 'bolo-yau', zh: '菠蘿油', en: 'Pineapple bun with butter', comparable: true },
  { id: 'bolo-bao', zh: '菠蘿包', en: 'Pineapple bun', comparable: true },
  { id: 'french-toast-hk', zh: '西多士', en: 'Hong Kong French toast', comparable: true },
  { id: 'milk-tea', zh: '港式奶茶', en: 'Hong Kong milk tea', comparable: true },
  { id: 'yuenyeung', zh: '鴛鴦', en: 'Coffee with milk tea', comparable: true },
  { id: 'lemon-tea', zh: '凍檸茶', en: 'Iced lemon tea', comparable: true },
  { id: 'ham-macaroni', zh: '火腿通粉', en: 'Macaroni soup with ham', comparable: true },
  { id: 'spam-egg-noodle', zh: '餐蛋麵', en: 'Spam and egg instant noodles', comparable: true },
  { id: 'pork-chop-bun', zh: '豬扒包', en: 'Pork chop bun', comparable: true },
  { id: 'egg-sandwich', zh: '蛋治', en: 'Egg sandwich', comparable: true },
  { id: 'condensed-milk-toast', zh: '奶醬多', en: 'Condensed milk and butter toast', comparable: true },
  { id: 'baked-pork-chop-rice', zh: '焗豬扒飯', en: 'Baked pork chop rice', comparable: true },
  { id: 'set-meal-cha-chaan-teng', zh: '常餐', en: 'Cha chaan teng set meal', comparable: true },
  { id: 'club-sandwich', zh: '公司三文治', en: 'Club sandwich', comparable: true },
  { id: 'instant-noodle-generic', zh: '公仔麵', en: 'Instant noodles', comparable: true },

  // ── 燒味 roast meats ─────────────────────────────────────────────────────
  { id: 'char-siu-rice', zh: '叉燒飯', en: 'Char siu rice', comparable: true },
  { id: 'char-siu', zh: '蜜汁叉燒', en: 'Honey-glazed char siu', comparable: true },
  { id: 'roast-goose', zh: '燒鵝', en: 'Roast goose', comparable: true },
  { id: 'roast-goose-thigh-rice', zh: '燒鵝髀飯', en: 'Roast goose thigh rice', comparable: true },
  { id: 'roast-duck-rice', zh: '燒鴨飯', en: 'Roast duck rice', comparable: true },
  { id: 'soy-chicken', zh: '油雞', en: 'Soy-poached chicken', comparable: true },
  { id: 'soy-chicken-rice', zh: '油雞飯', en: 'Soy-poached chicken rice', comparable: true },
  { id: 'white-cut-chicken', zh: '白切雞', en: 'White cut chicken', comparable: true },
  { id: 'hainan-chicken-rice', zh: '海南雞飯', en: 'Hainanese chicken rice', comparable: true },
  { id: 'siu-yuk', zh: '燒肉', en: 'Crispy roast pork belly', comparable: true },
  { id: 'roast-meat-platter-rice', zh: '燒味拼盤飯', en: 'Mixed roast meat rice', comparable: true },
  { id: 'roast-pigeon', zh: '乳鴿', en: 'Roast pigeon', comparable: true },

  // ── 點心 dim sum ─────────────────────────────────────────────────────────
  { id: 'har-gow', zh: '蝦餃', en: 'Har gow (shrimp dumpling)', comparable: true },
  { id: 'siu-mai', zh: '燒賣', en: 'Siu mai', comparable: true },
  { id: 'char-siu-bao', zh: '叉燒包', en: 'Char siu bao', comparable: true },
  { id: 'cheung-fun', zh: '腸粉', en: 'Rice noodle roll', comparable: true },
  { id: 'ja-leung', zh: '炸兩', en: 'Rice noodle roll with fried dough', comparable: true },
  { id: 'turnip-cake', zh: '蘿蔔糕', en: 'Turnip cake', comparable: true },
  { id: 'taro-cake', zh: '芋頭糕', en: 'Taro cake', comparable: true },
  { id: 'chicken-feet', zh: '鳳爪', en: 'Braised chicken feet', comparable: true },
  { id: 'steamed-spare-ribs', zh: '豉汁蒸排骨', en: 'Steamed spare ribs with black bean', comparable: true },
  { id: 'egg-tart', zh: '蛋撻', en: 'Egg tart', comparable: true },
  { id: 'lo-mai-gai', zh: '糯米雞', en: 'Lotus leaf glutinous rice with chicken', comparable: true },
  { id: 'spring-roll', zh: '春卷', en: 'Spring roll', comparable: true },
  { id: 'malai-go', zh: '馬拉糕', en: 'Steamed sponge cake', comparable: true },
  { id: 'beef-ball', zh: '牛肉球', en: 'Steamed beef balls', comparable: true },
  { id: 'tripe', zh: '金錢肚', en: 'Braised honeycomb tripe', comparable: true },
  { id: 'steamed-pork-patty', zh: '蒸肉餅', en: 'Steamed pork patty', comparable: true },
  // Added after the Phase 1 coverage run surfaced them as honest "none" misses.
  // The 84.9% coverage figure in the results doc is PRE-patch — re-run to update it.
  { id: 'steamed-egg', zh: '蒸水蛋', en: 'Steamed egg custard', comparable: true },
  { id: 'duck-wings', zh: '火鴨翅', en: 'Roast duck wings', comparable: true },
  { id: 'xiao-long-bao', zh: '小籠包', en: 'Xiao long bao', comparable: true },
  { id: 'dim-sum-platter', zh: '點心拼盤', en: 'Assorted dim sum platter', comparable: true },

  // ── 粥粉麵 congee, rice noodle, noodle ───────────────────────────────────
  { id: 'wonton-noodle', zh: '雲吞麵', en: 'Wonton noodle soup', comparable: true },
  { id: 'dumpling-noodle', zh: '水餃麵', en: 'Dumpling noodle soup', comparable: true },
  { id: 'beef-brisket-noodle', zh: '牛腩麵', en: 'Beef brisket noodle soup', comparable: true },
  { id: 'beef-brisket-lo-mein', zh: '牛腩撈麵', en: 'Beef brisket tossed noodles', comparable: true },
  { id: 'fishball-noodle', zh: '魚蛋粉', en: 'Fishball rice noodles', comparable: true },
  { id: 'fishball-ho-fun', zh: '魚蛋河', en: 'Fishball flat rice noodles', comparable: true },
  { id: 'cart-noodle', zh: '車仔麵', en: 'Cart noodles', comparable: true },
  { id: 'century-egg-pork-congee', zh: '皮蛋瘦肉粥', en: 'Century egg and pork congee', comparable: true },
  { id: 'sampan-congee', zh: '艇仔粥', en: 'Sampan congee', comparable: true },
  { id: 'beef-congee', zh: '牛肉粥', en: 'Beef congee', comparable: true },
  { id: 'fish-slice-congee', zh: '魚片粥', en: 'Fish slice congee', comparable: true },
  { id: 'jook-sing-noodle', zh: '竹昇麵', en: 'Bamboo-pressed noodles', comparable: true },
  { id: 'goose-intestine-noodle', zh: '鵝腸撈麵', en: 'Goose intestine tossed noodles', comparable: true },
  { id: 'fish-soup-rice-noodle', zh: '魚湯米線', en: 'Fish soup rice vermicelli', comparable: true },

  // ── 小炒 / 飯麵 stir fry, fried rice and noodles ────────────────────────
  { id: 'beef-chow-fun', zh: '乾炒牛河', en: 'Dry-fried beef ho fun', comparable: true },
  { id: 'wet-chow-fun', zh: '濕炒牛河', en: 'Beef ho fun in gravy', comparable: true },
  { id: 'singapore-vermicelli', zh: '星洲炒米', en: 'Singapore fried vermicelli', comparable: true },
  { id: 'xiamen-vermicelli', zh: '廈門炒米', en: 'Xiamen fried vermicelli', comparable: true },
  { id: 'yangzhou-fried-rice', zh: '揚州炒飯', en: 'Yangzhou fried rice', comparable: true },
  { id: 'fried-rice-generic', zh: '炒飯', en: 'Fried rice', comparable: true },
  { id: 'scallop-fried-rice', zh: '帶子炒飯', en: 'Scallop fried rice', comparable: true },
  { id: 'shrimp-fried-rice', zh: '蝦仁炒飯', en: 'Shrimp fried rice', comparable: true },
  { id: 'sweet-sour-pork', zh: '咕嚕肉', en: 'Sweet and sour pork', comparable: true },
  { id: 'black-bean-ribs', zh: '豉椒排骨', en: 'Stir-fried ribs with black bean and chili', comparable: true },
  { id: 'mapo-tofu', zh: '麻婆豆腐', en: 'Mapo tofu', comparable: true },
  { id: 'scrambled-egg-shrimp', zh: '滑蛋蝦仁', en: 'Scrambled egg with shrimp', comparable: true },
  { id: 'scrambled-egg-beef', zh: '滑蛋牛肉', en: 'Scrambled egg with beef', comparable: true },
  { id: 'sticky-rice-fried', zh: '生炒糯米飯', en: 'Wok-fried glutinous rice', comparable: true },
  { id: 'salt-pepper-squid', zh: '椒鹽鮮魷', en: 'Salt and pepper squid', comparable: true },
  { id: 'honey-ribs', zh: '蜜汁燒排骨', en: 'Honey-glazed ribs', comparable: true },

  // ── 海鮮 seafood ─────────────────────────────────────────────────────────
  { id: 'blanched-prawn', zh: '白灼蝦', en: 'Blanched prawns', comparable: true },
  { id: 'salt-pepper-prawn', zh: '椒鹽蝦', en: 'Salt and pepper prawns', comparable: true },
  { id: 'garlic-butter-prawn', zh: '蒜蓉黃油蝦', en: 'Garlic butter prawns', comparable: true },
  { id: 'steamed-scallop-vermicelli', zh: '蒜蓉粉絲蒸扇貝', en: 'Steamed scallops with garlic and glass noodles', comparable: true },
  { id: 'steamed-fish', zh: '清蒸魚', en: 'Steamed whole fish', comparable: true },
  { id: 'steamed-abalone', zh: '蒸鮑魚', en: 'Steamed abalone', comparable: true },
  { id: 'mantis-shrimp', zh: '椒鹽瀨尿蝦', en: 'Salt and pepper mantis shrimp', comparable: true },
  { id: 'typhoon-shelter-crab', zh: '避風塘炒蟹', en: 'Typhoon shelter crab', comparable: true },
  { id: 'seafood-platter', zh: '海鮮拼盤', en: 'Seafood platter', comparable: true },
  { id: 'stir-fried-prawn', zh: '炒蝦', en: 'Stir-fried prawns', comparable: true },
  { id: 'garlic-squid', zh: '蒜蓉魷魚', en: 'Garlic squid', comparable: true },
  { id: 'clams', zh: '炒蜆', en: 'Stir-fried clams', comparable: true },

  // ── 火鍋 / 燉品 hotpot and soups ─────────────────────────────────────────
  { id: 'hotpot-sichuan', zh: '四川火鍋', en: 'Sichuan hotpot', comparable: true },
  { id: 'hotpot-cantonese', zh: '打邊爐', en: 'Cantonese hotpot', comparable: true },
  { id: 'shabu-shabu', zh: '涮涮鍋', en: 'Shabu-shabu', comparable: true },
  { id: 'snake-soup', zh: '蛇羹', en: 'Snake soup', comparable: true },
  { id: 'double-boiled-soup', zh: '燉湯', en: 'Double-boiled soup', comparable: true },
  { id: 'mushroom-chicken', zh: '冬菇蒸雞', en: 'Steamed chicken with mushroom', comparable: true },

  // ── 甜品 dessert ─────────────────────────────────────────────────────────
  { id: 'mango-pomelo-sago', zh: '楊枝甘露', en: 'Mango pomelo sago', comparable: true },
  { id: 'double-skin-milk', zh: '雙皮奶', en: 'Double skin milk', comparable: true },
  { id: 'black-sesame-soup', zh: '芝麻糊', en: 'Black sesame soup', comparable: true },
  { id: 'tofu-fa', zh: '豆腐花', en: 'Tofu pudding', comparable: true },
  { id: 'red-bean-soup', zh: '紅豆沙', en: 'Red bean soup', comparable: true },
  { id: 'sticky-rice-ball', zh: '糯米丸子', en: 'Glutinous rice balls', comparable: true },
  { id: 'souffle-pancake', zh: '舒芙蕾鬆餅', en: 'Soufflé pancakes', comparable: true },
  { id: 'matcha-cream-bun', zh: '抹茶奶油包', en: 'Matcha cream bun', comparable: true },

  // ── 日本菜 Japanese ──────────────────────────────────────────────────────
  { id: 'sushi-platter', zh: '壽司拼盤', en: 'Sushi platter', comparable: true },
  { id: 'salmon-sashimi', zh: '三文魚刺身', en: 'Salmon sashimi', comparable: true },
  { id: 'lobster-sashimi', zh: '龍蝦刺身', en: 'Lobster sashimi', comparable: true },
  { id: 'kaisendon', zh: '海鮮丼', en: 'Seafood donburi', comparable: true },
  { id: 'gyudon', zh: '牛丼', en: 'Beef donburi', comparable: true },
  { id: 'unadon', zh: '鰻魚飯', en: 'Unagi donburi', comparable: true },
  { id: 'tonkotsu-ramen', zh: '豚骨拉麵', en: 'Tonkotsu ramen', comparable: true },
  { id: 'shoyu-ramen', zh: '醬油拉麵', en: 'Shoyu ramen', comparable: true },
  { id: 'udon', zh: '烏冬', en: 'Udon', comparable: true },
  { id: 'pork-udon', zh: '豬肉烏龍麵', en: 'Pork udon', comparable: true },
  { id: 'tempura', zh: '天婦羅', en: 'Tempura', comparable: true },
  { id: 'grilled-mackerel-set', zh: '燒鯖魚定食', en: 'Grilled mackerel set', comparable: true },
  { id: 'hamburg-steak', zh: 'ハンバーグ', en: 'Japanese hamburg steak', comparable: true },
  { id: 'karaage', zh: '唐揚雞', en: 'Karaage fried chicken', comparable: true },
  { id: 'okonomiyaki', zh: '大阪燒', en: 'Okonomiyaki', comparable: true },

  // ── 其他亞洲 other Asian ─────────────────────────────────────────────────
  { id: 'pad-thai', zh: '泰式炒金邊粉', en: 'Pad thai', comparable: true },
  { id: 'tom-yum', zh: '冬蔭功', en: 'Tom yum goong', comparable: true },
  { id: 'green-curry', zh: '青咖喱', en: 'Green curry', comparable: true },
  { id: 'pho', zh: '越南牛肉粉', en: 'Beef pho', comparable: true },
  { id: 'banh-mi', zh: '越南三明治', en: 'Banh mi', comparable: true },
  { id: 'bibimbap', zh: '石鍋拌飯', en: 'Bibimbap', comparable: true },
  { id: 'korean-fried-chicken', zh: '韓式炸雞', en: 'Korean fried chicken', comparable: true },
  { id: 'butter-chicken', zh: '牛油雞', en: 'Butter chicken', comparable: true },
  { id: 'biryani', zh: '印度炒飯', en: 'Biryani', comparable: true },
  { id: 'satay', zh: '沙嗲', en: 'Satay skewers', comparable: true },
  { id: 'grilled-skewers', zh: '烤串', en: 'Grilled skewers (assorted)', comparable: true },
  { id: 'grilled-pork-skewer', zh: '烤豬肉串', en: 'Grilled pork skewers', comparable: true },

  // ── 西餐 Western ─────────────────────────────────────────────────────────
  { id: 'carbonara', zh: '卡邦尼意粉', en: 'Carbonara', comparable: true },
  { id: 'bolognese', zh: '肉醬意粉', en: 'Spaghetti bolognese', comparable: true },
  { id: 'seafood-pasta', zh: '海鮮意粉', en: 'Seafood pasta', comparable: true },
  { id: 'margherita-pizza', zh: '瑪格麗特薄餅', en: 'Margherita pizza', comparable: true },
  { id: 'fish-and-chips', zh: '炸魚薯條', en: 'Fish and chips', comparable: true },
  { id: 'fried-chicken-western', zh: '炸雞', en: 'Fried chicken', comparable: true },
  { id: 'lobster-roll', zh: '龍蝦三明治', en: 'Lobster roll', comparable: true },
  { id: 'greek-salad', zh: '希臘沙律', en: 'Greek salad', comparable: true },
  { id: 'caesar-salad', zh: '凱撒沙律', en: 'Caesar salad', comparable: true },
  { id: 'ceviche', zh: '秘魯青檸魚生', en: 'Ceviche', comparable: true },
  { id: 'falafel-wrap', zh: '鷹嘴豆卷', en: 'Falafel wrap', comparable: true },
  { id: 'steak', zh: '牛扒', en: 'Steak', comparable: true },
  { id: 'burger', zh: '漢堡包', en: 'Burger', comparable: true },
  { id: 'creamy-salmon-roe-pasta', zh: '奶油三文魚子意粉', en: 'Creamy pasta with salmon roe', comparable: true },
];

export const CATALOG_BY_ID = new Map(CATALOG.map(e => [e.id, e]));
