// Pure i18n data + helpers — no React, so tests can run it under plain node.

// Chrome language stays a binary (zh-Hant HK / en) — EVERY t() call and the whole
// dictionary key off this. See i18n.tsx: it's DERIVED from the language pair below,
// never set independently, so no existing t() call site changes.
export type Lang = 'zh' | 'en';

// The dish-name language PAIR is a richer set. name (en) + name_zh (zh) are the
// CANONICAL stored identity of every dish (see dishIdentity.ts / the globe spec) —
// this constant names that pair so translation code never hardcodes 'zh'/'en', and
// a future regional deployment is a constant change, not a rewrite.
export type LangCode = 'zh' | 'en' | 'ja' | 'ko' | 'th' | 'vi' | 'id' | 'tl' | 'es' | 'fr';
export const CANONICAL_PAIR = ['zh', 'en'] as const;
export function isCanonical(code: LangCode): code is 'zh' | 'en' {
  return code === 'zh' || code === 'en';
}

/** Curated picker list — each language shown in its OWN language (self-identifying),
 * canonical pair first. */
export const LANGUAGES: { code: LangCode; label: string }[] = [
  { code: 'zh', label: '中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'th', label: 'ไทย' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'tl', label: 'Filipino' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];
export const languageLabel = (code: LangCode) => LANGUAGES.find(l => l.code === code)?.label ?? code;

/** Map a scan's `menu_language` string (the model returns names like "japanese")
 * to a picker LangCode, or null if it isn't one we display (mixed/unknown/etc.).
 * Drives the foreign-menu preset + the point-and-order fidelity rule. */
export function menuLanguageToCode(menuLanguage: string | null | undefined): LangCode | null {
  const m = (menuLanguage ?? '').trim().toLowerCase();
  if (!m) return null;
  // Bare 2-letter codes, exact.
  const exact: Record<string, LangCode> = { ja: 'ja', ko: 'ko', th: 'th', vi: 'vi', id: 'id', tl: 'tl', es: 'es', fr: 'fr', zh: 'zh', en: 'en' };
  if (exact[m]) return exact[m];
  // Distinctive substrings, NON-English probed first — so a compound/bilingual
  // value like "japanese and english" or "bilingual japanese-english" resolves to
  // the non-English language (that's what the dishes are really in).
  const probes: [string, LangCode][] = [
    ['japan', 'ja'], ['日本', 'ja'],
    ['korea', 'ko'], ['한국', 'ko'],
    ['thai', 'th'],
    ['viet', 'vi'],
    ['indones', 'id'], ['malay', 'id'], ['bahasa', 'id'],
    ['filipino', 'tl'], ['tagalog', 'tl'],
    ['spanish', 'es'], ['español', 'es'], ['espanol', 'es'],
    ['french', 'fr'], ['français', 'fr'], ['francais', 'fr'],
    ['chinese', 'zh'], ['cantonese', 'zh'], ['mandarin', 'zh'], ['中文', 'zh'], ['粵', 'zh'],
  ];
  for (const [needle, code] of probes) if (m.includes(needle)) return code;
  if (m.includes('english')) return 'en'; // only after every non-English probe missed
  return null;
}

export type LangPair = { primary: LangCode; secondary: LangCode };
/** Chrome language derived from a pair: it follows the PRIMARY slot, so the section
 * titles + info lines (date, cuisine/location meta, chips) read in the language you
 * chose to lead with. Chinese only when Chinese is primary; any other primary —
 * English, or a non-chrome language like ja/ko the dictionary can't render — falls
 * back to English. Chrome still stays zh/en only (ripple-containment preserved). */
export function chromeLangOf(pair: LangPair): Lang {
  return pair.primary === 'zh' ? 'zh' : 'en';
}

/** Stable in-memory cache key for a dish's non-canonical translations, from its
 * canonical identity. Lets DishName look up / request a translation without needing
 * a DB id (persistence by id is a later slice). */
export function dishNameKey(d: { name: string; name_zh?: string | null }): string {
  return `${d.name_zh ?? ''}|${d.name}`;
}

/** The secondary language a scanned menu should PRESET: the menu's own language,
 * but only when it isn't already one of the two pair slots (otherwise the pair
 * already covers it). null when there's nothing to preset. */
export function foreignMenuSecondary(menuCode: LangCode | null, pair: LangPair): LangCode | null {
  return menuCode && menuCode !== pair.primary && menuCode !== pair.secondary ? menuCode : null;
}

/** The pair a scan actually renders with. The foreign-menu preset overlays the
 * menu's language onto the secondary slot FOR THIS SCAN — but it's only a default:
 * once the user has made an explicit choice in the globe (`overridden`), the
 * preset yields and the persisted pair is used exactly as chosen (Fix 5). */
export function scanPresetPair(pair: LangPair, menuCode: LangCode | null, overridden: boolean): LangPair {
  const secondary = overridden ? null : foreignMenuSecondary(menuCode, pair);
  return secondary ? { primary: pair.primary, secondary } : pair;
}

/**
 * Resolve a dish's primary + secondary display strings for a pair. Pure, so it's
 * unit-tested directly (DishName is the only caller). Rules, in order:
 *  - FIDELITY: a slot whose language IS the scanned menu's language shows the exact
 *    printed original (name_original) — no translation.
 *  - canonical slots -> en / zh directly; other slots -> the cached translation.
 *  - a missing translation falls back to the chrome-language canonical (shown until
 *    the real one arrives).
 *  - if both slots resolve to the same string, the secondary is dropped (no dupes).
 */
export function resolveNamePair(opts: {
  pair: LangPair;
  chromeLang: Lang;
  en?: string;
  zh?: string;
  translated: (code: LangCode) => string | undefined;
  nameOriginal?: string | null;
  menuLanguage?: LangCode | null;
}): { primary?: string; secondary?: string } {
  const { pair, chromeLang, en, zh, translated, nameOriginal, menuLanguage } = opts;
  const resolve = (code: LangCode): string | undefined => {
    if (menuLanguage && code === menuLanguage && nameOriginal) return nameOriginal;
    if (code === 'en') return en;
    if (code === 'zh') return zh;
    return translated(code);
  };
  const fallback = (chromeLang === 'zh' ? zh : en) ?? en ?? zh;
  const primary = resolve(pair.primary) ?? fallback;
  let secondary = resolve(pair.secondary) ?? fallback;
  if (secondary === primary) secondary = undefined;
  return { primary, secondary };
}

export const dict: Record<string, { zh: string; en: string }> = {
  // ---- shell ----
  'nav.feed': { zh: '食記', en: 'Journal' },
  'nav.scan': { zh: '掃餐牌', en: 'Scan' },
  'nav.taste': { zh: '味 AI', en: 'Taste AI' },

  // ---- auth ----
  'auth.title': { zh: '電郵登入', en: 'Sign in to start' },
  'auth.tagline': {
    zh: 'Restaurant Reviews Tell You Where To Go.\nDishi Tells You What To Order',
    en: 'Restaurant Reviews Tell You Where To Go.\nDishi Tells You What To Order',
  },
  'auth.longcopy': {
    zh: 'Rate it all — the lobster, the leftovers, the cup noodles. Two seconds a flick. Your taste is in there somewhere, and Dishi finds it: built from what you actually ate, honest when it’s still guessing. Then take it anywhere — export your taste to any AI you use, and it finally knows your tongue.',
    en: 'Rate it all — the lobster, the leftovers, the cup noodles. Two seconds a flick. Your taste is in there somewhere, and Dishi finds it: built from what you actually ate, honest when it’s still guessing. Then take it anywhere — export your taste to any AI you use, and it finally knows your tongue.',
  },
  'auth.placeholder': { zh: 'you@example.com', en: 'you@example.com' },
  'auth.send': { zh: '傳送數字碼', en: 'Send code' },
  'auth.sent': { zh: '已將 6 位數字碼寄到你的 email', en: 'We emailed you a 6-digit code' },
  'auth.loading': { zh: '載入中…', en: 'Loading…' },

  // ---- home ----
  'home.title': { zh: '食記', en: 'Journal' },
  'home.rated': { zh: '已評分！', en: 'Rated!' },
  'profile.justlearned': { zh: '你剛剛教會了我：{dims}', en: 'You just taught me: {dims}' },
  'home.homecooking': { zh: '住家菜', en: 'Home cooking' },

  // ---- log ----
  'log.cancelflow': { zh: '取消', en: 'Cancel' },
  'voice.err.permission': { zh: '未取得麥克風權限 — 可改用文字輸入', en: 'Microphone access was denied — you can type instead' },
  'voice.err.language': { zh: '此裝置不支援粵語語音辨識 — 可改用文字輸入', en: "This device doesn't support speech recognition for this language — you can type instead" },
  'voice.err.nospeech': { zh: '沒有偵測到聲音 — 可重試或改用文字', en: "Didn't catch any speech — try again or type instead" },
  'voice.err.generic': { zh: '無法錄音 — 可改用文字輸入', en: "Voice recording isn't working right now — you can type instead" },
  'log.saving': { zh: '儲緊…', en: 'Saving…' },
  // Vision genuinely failed (timeout/garbled response after retries) — distinct
  // from notdish above, where a model DID look and said "not food." Here nobody
  // ever looked, and Dishi says so instead of silently pretending it's a dish.
  'log.visionfail.retry': { zh: '再試一次', en: 'Try again' },
  // 對決 (pairwise taste duels) — the 印 stamp signals a sealed prediction, same
  // honesty contract as the rating seal. 揀唔落 is a TIE (a real "these two are equal
  // for me" signal), distinct from the ✕ dismiss which teaches nothing.
  'duel.title': { zh: '調校口味', en: 'Refining your taste' },
  'duel.q': { zh: '憑直覺選一樣', en: 'Pick one — don’t overthink' },
  'duel.tie': { zh: '難以取捨', en: 'Can’t separate them' },
  'duel.hit': { zh: 'dishi 估中咗', en: 'dishi called it' },
  'duel.miss': { zh: 'dishi 估錯咗', en: 'dishi got that wrong' },
  'duel.tieresult': { zh: '兩者相近，已記錄', en: 'About even — noted' },
  'duel.learned': { zh: '學到：{dims}', en: 'Learned: {dims}' },
  'duel.ok': { zh: '好', en: 'OK' },

  // 係咪同一味？ — identity-confirm card (gate 3 of the identity pipeline, on
  // the duel chassis). Header/buttons keep the spec's own Cantonese wording —
  // this card's voice is a direct owner design, like the flick verdicts.
  'identity.title': { zh: '係咪同一味？', en: 'Same dish?' },
  'identity.same': { zh: '係同一味', en: 'Same dish' },
  'identity.notsame': { zh: '唔同嘅', en: 'Different' },
  'identity.unsure': { zh: '唔肯定', en: 'Not sure' },
  'identity.merged': { zh: '已合併，依家兩個名都指住同一味菜', en: 'Merged, both names now point to the same dish.' },
  'identity.kept': { zh: '收到，兩味分開記', en: 'Got it, kept as two dishes.' },
  // 語言對 globe picker (dish-name languages only — chrome stays zh/en)
  'lang.title': { zh: '掃任何語言餐牌', en: 'Scan Any Menu' },
  'lang.subtitle': { zh: '自動翻譯2種語言', en: 'Choose 2 languages to translate into' },
  'lang.primary': { zh: '主要', en: 'Primary' },
  'lang.secondary': { zh: '次要', en: 'Secondary' },
  'lang.swap': { zh: '對調', en: 'Swap' },
  'lang.foreignmenu': { zh: '副名稱：{lang}（餐牌原文）· 撳地球可改', en: 'Secondary: {lang} (as printed) · tap the globe to change' },
  'lang.menuoriginal': { zh: '餐牌原文', en: 'menu original' },
  // Notification bell list
  'notif.title': { zh: '通知', en: 'Notifications' },
  'notif.empty': { zh: '暫無新通知', en: 'Nothing new right now' },
  'notif.duel.sub': { zh: '揀一樣，幫個引擎調校口味', en: 'Pick one to refine your taste' },
  'log.toRate': { zh: '待評菜式', en: 'Dishes to rate' },
  'log.rateNow': { zh: '而家評', en: 'Rate now' },
  'scan.pickcount': { zh: '已選 {n} 道', en: '{n} dishes picked' },
  'scan.pickrestaurant': { zh: '這張餐牌是哪間餐廳？', en: 'Which restaurant is this menu from?' },
  'table.pickedsofar': { zh: '剛剛選了', en: 'Picked so far' },
  'table.pickbtn': { zh: '揀呢個', en: 'Pick' },
  'table.orderbtn': { zh: '叫呢個', en: 'Order' },
  'table.pickeddone': { zh: '✓ 已選', en: '\u2713 Picked' },
  'table.stampedby': { zh: '{n} 人揀咗呢道', en: '{n} people picked this' },
  'buddy.knows.count': { zh: '已識 {n} 味', en: 'knows {n}' },
  'buddy.learning.count': { zh: '摸索 {n} 味', en: 'learning {n}' },
  'log.willTranslate': { zh: '將依你的輸入自動翻譯', en: 'Will be translated from your input' },
  'log.relearned': { zh: '已根據你的修改重新學習你的口味', en: 'Re-learned your taste from your correction' },
  'journal.setdate': { zh: '某年某月某日', en: 'Add eaten date' },
  'journal.companions': { zh: '同檯', en: 'With' },
  // Dimension display names — used by the post-rating learned feedback (and
  // available to any future surface that speaks about dimensions in the UI).
  'dim.spicy': { zh: '辣', en: 'spicy' },
  'dim.sweet': { zh: '甜', en: 'sweet' },
  'dim.salty': { zh: '鹹', en: 'salty' },
  'dim.sour': { zh: '酸', en: 'sour' },
  'dim.bitter': { zh: '苦', en: 'bitter' },
  'dim.umami': { zh: '鮮味', en: 'umami' },
  'dim.crispy': { zh: '脆', en: 'crispy' },
  'dim.creamy': { zh: '香滑', en: 'creamy' },
  'dim.chewy': { zh: '煙韌', en: 'chewy' },
  'dim.tender': { zh: '嫩滑', en: 'tender' },
  'dim.rich': { zh: '濃郁', en: 'rich' },
  'dim.fresh': { zh: '新鮮', en: 'fresh' },
  'dim.fried': { zh: '炸', en: 'fried' },
  'dim.steamed': { zh: '蒸', en: 'steamed' },
  'dim.grilled': { zh: '燒烤', en: 'grilled' },
  'dim.braised': { zh: '炆', en: 'braised' },
  'dim.baked': { zh: '焗', en: 'baked' },
  'dim.raw': { zh: '生食', en: 'raw' },

  // ---- flick rating ----
  'flick.inhaled': { zh: '一掃而空', en: 'Inhaled it' },
  'flick.loved': { zh: '超好味', en: 'Loved it' },
  'flick.good': { zh: '幾好食', en: 'Pretty good' },
  'flick.fine': { zh: '一般般', en: 'It was fine' },
  'flick.notforme': { zh: '唔啱我', en: 'Not for me' },
  'flick.never': { zh: '唔會再食', en: 'Never again' },
  'flick.hint': { zh: '喜歡就向上滑 · 不喜歡向下 · 滑得越遠越強烈', en: 'Drag up if you loved it · down if not · further = more' },
  'flick.howto': {
    zh: '在相片上向上或向下滑動即可評分。或者，直接點選下方其中一項。',
    en: 'Rate by sliding up or down on the photo. Or rate by choosing the following.',
  },
  'flick.aria': { zh: '向上或向下滑動來評分', en: 'Rate this dish by dragging up or down' },
  'flick.notyet': { zh: '未評分', en: 'not rated yet' },

  // ---- restaurant picker ----
  'picker.finding': { zh: '正在尋找你附近的餐廳…', en: 'Finding restaurants near you…' },
  'picker.fromphoto': { zh: '📍 這張相片拍攝地點附近', en: '📍 Around where this photo was taken' },
  'picker.denied': { zh: '定位已關 — 可以自己輸入店名，或者跳過。', en: 'Location is off — add the place by name, or skip.' },
  'picker.add': { zh: '+ 加間舖', en: '+ Add a place' },
  'picker.addname': { zh: '餐廳名', en: 'Restaurant name' },
  'picker.name': { zh: '餐廳名', en: 'Restaurant name' },
  'picker.confirm': { zh: '加入', en: 'Add' },
  'picker.needloc': { zh: '新舖需要開定位，Dishi 先可以幫其他人釘住個位。', en: 'New places need location on, so Dishi can pin them for others.' },
  'picker.moredetails': { zh: '+ 更多資料', en: '+ Add more details' },
  'picker.area': { zh: '地區（例如：銅鑼灣）', en: 'Area (e.g. Causeway Bay)' },
  'picker.address': { zh: '地址', en: 'Address' },
  'picker.locating': { zh: '正在尋找你附近的地區…', en: 'Finding your area…' },
  'picker.detailshint': { zh: '這些已為你預先填好，隨時可以修改 — 想記錄在其他地方吃過的也可以。', en: 'These are pre-filled guesses \u2014 edit freely, including to log a dish from somewhere else entirely.' },
  'picker.new': { zh: '新', en: 'new' },
  'picker.sameas': { zh: '係咪即係「{name}」？', en: 'Same place as "{name}"?' },
  'picker.samesame': { zh: '是，同一間', en: 'Yes, same place' },
  'picker.notsame': { zh: '不是，是新的店', en: 'No, it\u2019s a new place' },
  'picker.searching': { zh: '搜尋緊…', en: 'Searching…' },
  'picker.searchmatch': { zh: '搵到呢啲，係咪其中一間？', en: 'Found these — is it one of them?' },

  // ---- voice ----
  'voice.listening': { zh: '● 聽緊 — 撳一下停止', en: '● Listening — tap to stop' },
  'voice.start': { zh: '🎙 說一句評語（可選）', en: '🎙 Say a quick note (optional)' },
  'voice.type': { zh: '或輸入文字 —「太鹹，但鑊氣十足」', en: 'or type it — "too salty but loved the char"' },
  'voice.typeonly': { zh: '「太鹹，但鑊氣十足」', en: '"too salty but loved the char"' },

  // ---- scan ----
  'scan.title': { zh: '掃餐牌', en: 'Scan a menu' },
  // The scan-dropzone benefit mock (ScanBenefitDemo): rotating dishes each show a
  // translated name over the original menu text + ingredient chips; this rec chip
  // is the constant — dishi's personalised pick. 'your match' reads as a verdict.
  'scan.benefit.rec': { zh: '啱你口味', en: 'your match' },
  'scan.help.title': { zh: '有時真係唔知食乜好', en: 'Never sure what to order?' },
  'scan.help.body': {
    zh: '拍下餐牌，dishi 會根據你的口味，告訴你整張餐牌上哪幾道最適合你，同時標出食材與致敏原。去到日本、韓國、泰國，外語菜名也一樣翻譯成你看得懂的文字，走到哪裡都點得稱心。',
    en: 'Snap the menu and dishi tells you which dishes on it suit your taste, flagging ingredients and allergens along the way. Travelling in Japan, Korea or Thailand? It translates foreign dish names into words you understand too, so you order well wherever you are.',
  },
  'scan.tablestatus': { zh: '|    {n} 人 · 已選 {m} 道', en: '|    {n} here · {m} picked' },
  'scan.tablelabel': { zh: '枱號：', en: 'Table ' },
  'scan.share.alsopicked': { zh: '{handles} 也選了', en: '{handles} picked this too' },
  'scan.results': { zh: '你的最佳選擇', en: 'Your best bets' },
  'scan.addpage': { zh: '加掃一版', en: 'Add a page' },
  'scan.addingpage': { zh: '加緊呢一版…', en: 'Adding this page…' },
  'scan.close': { zh: '關閉', en: 'Close' },
  'scan.kept': { zh: '這一頁似乎是不同餐廳 — 已保留「{name}」', en: 'That page looks like a different place — kept “{name}”' },
  'scan.new': { zh: '新', en: 'New' },
  'scan.read': { zh: '讀到 {n} 道菜', en: '{n} dishes read' },
  'scan.mock': { zh: '示範餐牌 — 需先加入 OPENROUTER_API_KEY 才能掃描真實餐牌。', en: 'Demo menu — add an OPENROUTER_API_KEY to scan real menus.' },
  'scan.logged': { zh: '叫咗嘢食？食完記得記錄 — 每次評分都令下次掃描更準。', en: 'Ordered something? Log it after — every rating sharpens the next scan.' },
  'scan.stage.0': { zh: '讀緊張餐牌…', en: 'Reading the menu…' },
  'scan.stage.1': { zh: '正在逐部分辨識…', en: 'Working through the sections…' },
  'scan.stage.2': { zh: '用廚藝知識估緊味道…', en: 'Estimating flavors from dish knowledge…' },
  'scan.stage.3': { zh: '正在比對你的口味檔案…', en: 'Matching against your taste profile…' },
  'scan.stage.4': { zh: '正在排列你的最佳選擇…', en: 'Ranking your best bets…' },
  'scan.err.notmenu': { zh: '這張相片似乎不是餐牌。拍一張餐牌再試？', en: "This doesn't look like a restaurant menu. Try a photo of an actual menu?" },
  'scan.err.unreadable': { zh: '讀取不到這張相片。試試拍近一點、拍平一點、光線充足一點，或一次拍一頁。', en: "Couldn't read that photo. Try getting closer, flatter, or better lit \u2014 or scan one page at a time." },

  // ---- table mode ----
  'table.join': { zh: '同朋友一齊點', en: 'Order Together' },
  'table.join.blurb': {
    zh: '一個先掃餐牌出 [枱號]，其他人跟住入',
    en: 'Already scanned by a friend? Ask them for the table code and enter it below to pick together.',
  },
  'table.help.title': { zh: '同朋友一齊點', en: 'Order Together' },
  'table.help.body': {
    zh: '一枱人可以共用同一次掃描結果。第一個人掃完餐牌會有一個枱號，其他人輸入呢個枱號就可以加入同一枱，喺自己部電話睇到同一份餐牌。大家揀菜會即時睇到，邊味畀邊個揀咗，餐牌上都有記認顯示，但揀嘅仍然係自己想食嘅嗰份，唔使夾單。',
    en: 'Everyone at the table can share one menu scan. Whoever scans first gets a table code; everyone else enters it to join the same table and see the same menu on their own phone. Picks show up in real time, so you can see who picked what on the menu, but each person still picks their own dishes, not a shared order.',
  },
  'table.joining': { zh: '入緊…', en: 'Joining…' },
  'table.joinbtn': { zh: '加入', en: 'Join' },
  'table.leave': { zh: '離開', en: 'Leave' },
  'table.back': { zh: '返回', en: 'Back' },
  'table.invite': { zh: '+ 邀請', en: '+ Invite' },
  'table.noprofile': { zh: '未有檔案', en: 'no profile yet' },
  'table.unanimous': { zh: '全檯啱', en: 'whole table' },
  'table.fairness': { zh: '公平之選', en: 'fairness call' },
  // 名印 one-time setup (Table Mode social batch, item 2) — a display name for the
  // chop avatar; skipping is a real, permanent choice (falls back to the auto handle
  // forever), not a "later" that nags again.
  'table.chop.title': { zh: '刻個名印', en: 'Cut your chop' },
  'table.chop.blurb': { zh: '改個名俾自己，其他人喺呢張檯都會見到。', en: 'Pick a name for yourself — everyone at this table will see it.' },
  'table.chop.placeholder': { zh: '你的名字', en: 'Your name' },
  'table.chop.skip': { zh: '遲啲先', en: 'Not now' },
  'table.pulling': { zh: '正在取得餐桌資料…', en: 'Pulling up the table…' },
  'table.copied': { zh: '連結已複製 — 發俾成檯人。', en: 'Link copied — send it to the table.' },
  'table.sharetitle': { zh: '來我這桌 — Dishi', en: 'Join my table on Dishi' },

  // ---- order (QR) ----
  'order.session': { zh: '場次', en: 'session' },
  'order.yourtable': { zh: '你張檯', en: 'Your table' },
  'order.menu': { zh: '餐牌', en: 'Menu' },
  'order.solo': { zh: '按你口味排名。同檯朋友掃同一個 QR 就可以一齊排。', en: 'Ranked for your taste. Friends at the table can scan the same QR to join the ranking.' },
  'order.group': { zh: '為呢檯 {n} 種口味排名 — 朋友可以用代碼加入。', en: 'Ranked for {n} palates at this table — friends can join with the code.' },
  'order.yours': { zh: '你點的菜', en: 'Your orders' },
  'order.send': { zh: '落單 · {n} 樣', en: 'Send order · {n} items' },
  'order.sending': { zh: '傳送緊…', en: 'Sending…' },
  'order.sent': { zh: '已送去廚房。', en: 'Order sent to the kitchen.' },
  'order.notsetup.title': { zh: '餐牌仲未設定好。', en: 'The menu isn\u2019t set up yet.' },
  'order.notsetup.blurb': { zh: '請詢問店員 — 這間餐廳尚未在 Dishi 加入菜式。', en: 'Ask the staff — the restaurant hasn\u2019t added dishes to Dishi ordering.' },
  'order.status.pending': { zh: '已送出 — 等緊廚房', en: 'Sent — waiting for the kitchen' },
  'order.status.confirmed': { zh: '已確認 — 整緊', en: 'Confirmed — being prepared' },
  'order.status.done': { zh: '已上菜', en: 'Served' },
  'order.status.cancelled': { zh: '餐廳已取消', en: 'Cancelled by the restaurant' },
  'order.setting': { zh: '幫你開緊檯…', en: 'Setting your table…' },
  'order.addone': { zh: '加一份{name}', en: 'Add one {name}' },
  'order.removeone': { zh: '減一份{name}', en: 'Remove one {name}' },

  // ---- profile / buddy ----
  'profile.title': { zh: '味 AI', en: 'Taste AI' },
  'profile.flicks': { zh: '{n} 次滑動 · {p} 有用積分', en: '{n} flicks · {p} usefulness points' },
  // Three-path entry on the Taste tab — these REPLACE the single log button, so
  // the surface itself says "anything counts": eating out, home cooking, or an
  // old photo sitting in the camera roll.
  // (2026-07-22: the 食物相/打字/外賣單 redesign that briefly replaced these was
  // rolled back — see profile/page.tsx's entry-pill comment.)
  'logsrc.rest': { zh: '餐廳菜', en: 'Dining out' },
  'logsrc.home': { zh: '住家菜', en: 'Home-cooked' },
  'logsrc.album': { zh: '相簿舊菜', en: 'Old photos' },
  'logsrc.help.title': { zh: '食物相食評', en: 'Rating food photos' },
  'logsrc.help.body': {
    zh: '可以逐張評分，也可以一次揀一疊相片批量評。你的食物相裡，藏著許多關於你口味的理解，好好利用它們，訓練專屬於你的 AI 口味引擎：評得越多、越多元，dishi 就越懂你，推薦越貼近你的口味。',
    en: 'Rate one at a time, or pick a whole stack of photos and rate in a batch. Hidden inside your food shots is a wealth of understanding about your taste, so put them to good use and train an AI taste engine that belongs to you: the more you rate, and the more varied, the better dishi knows you.',
  },
  // 打字 typed quick-add (backlog 2026-07-22, item 3) — name first, then
  // restaurant, then the same blank-card rating moment as the photo path.
  'typed.name.title': { zh: '打個名先', en: 'Name the dish' },
  'typed.name.continue': { zh: '繼續', en: 'Continue' },
  'typed.restaurant.title': { zh: '喺邊度食？', en: 'Where did you eat it?' },
  'typed.enriching': { zh: 'AI 認緊呢道菜…', en: 'Reading the dish…' },
  'typed.error.noname': { zh: '至少打一個名先得', en: 'Type a name first' },
  'profile.helped': { zh: ' — 你的記錄曾幫助其他人做決定', en: ' — your logs helped other people decide' },
  'profile.cuisines': { zh: '菜系', en: 'Cuisines' },
  'profile.rated': { zh: '已評菜式', en: 'Dishes you\u2019ve rated' },
  'profile.owner': { zh: '開餐廳？', en: 'Own a restaurant?' },
  'rate.preparing': { zh: '正在處理相片…', en: 'Preparing photos…' },
  'rate.skip': { zh: '跳', en: 'Skip' },
  // Progressive "watch your Taste AI learn" screen (merged reward + review)
  'grow.build.title': { zh: '建立個人化口味 AI', en: 'Building your personal taste AI' },
  // The version ladder (replaced Levels + the "Taste AI 1.0" naming): steady-state
  // unlocked line on the growth screen and anywhere else the ladder speaks.
  'version.unlocked': { zh: 'dishi v{n} 已經解鎖', en: 'dishi v{n} unlocked' },
  // The everyday (non-unlock-moment) bar line: current version + where it's heading.
  'grow.vnext': { zh: 'dishi v{v} · 邁向 v{next}', en: 'dishi v{v} · growing toward v{next}' },
  'grow.reanalysing': { zh: '重新分析緊…', en: 're-analysing…' },
  'grow.close': { zh: '關閉', en: 'Close' },
  'grow.analysing': { zh: '分析緊…', en: 'analysing…' },
  'grow.finding': { zh: '搵緊附近餐廳…', en: 'finding restaurants nearby…' },
  'grow.learned': { zh: '學到', en: 'learned' },
  'grow.rename': { zh: '改名', en: 'Rename' },
  'grow.confirm.ask': { zh: '確認或修正 AI 所辨識的內容 — 讓你的口味引擎更準確。現在或稍後修改都可以。', en: 'Confirm or refine what the AI read — it sharpens your taste engine. Now or later.' },
  'grow.addplace': { zh: '自己加', en: 'Add another' },
  'grow.addplace.failed': { zh: '未能儲存位置，請再試', en: 'Couldn’t save that place — try again' },
  'grow.skip': { zh: '略過', en: 'Skip' },
  'grow.fail': { zh: '這張上載失敗，尚未學到內容', en: 'This one didn’t upload — nothing learned yet' },
  'grow.notfood': { zh: '這張不太像食物', en: "This doesn't look like food" },
  'grow.notfood.fix': { zh: '這是食物', en: "It's food" },
  'place.home': { zh: '住家菜', en: 'Home cooked' },
  // NBSPs, not plain spaces: HTML collapses runs of ordinary whitespace, so the
  // wider gap the design asks for before 植入 would silently render as one space.
  'export.button': { zh: 'dishi v{v}  植入', en: 'Implant dishi v{v}' },
  // Locked state (§5): anticipation, not apology — names what unlocks and the
  // honest count left, with the 相簿舊菜 path as the designed fast track.
  // Deliberately NOT a disabled button (spec: "never a dead button").
  'export.antic': {
    zh: '你的味蕾尚未成形 — 再評 {n} 味，dishi 就可以搬進你的 AI。',
    en: 'Your palate is still taking shape — rate {n} more dishes and dishi can move into your AI.',
  },
  'export.antic.album': { zh: '由相簿舊菜開始 →', en: 'Start with old food photos →' },
  // The recurring "what's new in v{N}" line under the CTA (§5 + the
  // versioning-deltas open thread) — read-only preview, shown from the second
  // export onward.
  'export.delta': { zh: 'v{v} · 與上次相比：{dims}', en: 'v{v} · since last export: {dims}' },
  'export.version': { zh: 'v{v} · 與上次相比變化不大', en: 'v{v} · little has changed since last export' },
  'export.delta.companions': { zh: '新檯友：{names}', en: 'New table companions: {names}' },
  'export.copy': { zh: '複製', en: 'Copy' },
  // Install layer title (owner spec 2026-07-23) — {name} is the persona's display
  // name (dishi.Spoon…). The per-host steps live in tasteExport.ts INSTALL_HOSTS.
  'install.title': { zh: '植入 {name}', en: 'Install {name}' },
  'persona.next': { zh: '下一個角色', en: 'Next persona' },
  'form.migration.title': { zh: '你的夥伴進化了', en: 'Your companion evolved' },
  'form.migration.blurb': {
    zh: '現在它就是你的味覺本身 — 每次評分都會真實地改變它的模樣。',
    en: 'It\u2019s your taste itself now \u2014 every rating genuinely reshapes it.',
  },
  'form.migration.cta': { zh: '看看它', en: 'See it' },
  'seal.stamp.title': { zh: 'Dishi 封存了一個預測', en: 'Dishi sealed a prediction' },
  'seal.explain.title': { zh: '「印」是什麼？', en: 'What’s the 印 stamp?' },
  'seal.explain.body': {
    zh: 'Dishi 在你選擇之前就秘密寫下對你會選哪樣的預測，封存的內容無人能看見，連你自己也不例外。選擇之後才揭開，看預測是否準確。',
    en: 'Dishi writes down its guess before you pick, sealed, so nobody, not even you, can peek. It only opens after you choose.',
  },
  'seal.reveal.hit': { zh: '揭開封印 — 預測命中', en: 'Broke the seal \u2014 nailed it' },
  'seal.reveal.near': { zh: '拆開個印 \u2014 幾接近', en: 'Broke the seal \u2014 close' },
  'seal.reveal.miss': { zh: '揭開封印 — 預測落空', en: 'Broke the seal \u2014 missed it' },
  'seal.reveal.detail': {
    zh: 'Dishi 早前預測你會「{predicted}」，你實際是「{actual}」。',
    en: 'Dishi predicted you\u2019d feel \u201c{predicted}\u201d \u2014 you actually felt \u201c{actual}\u201d.',
  },
  'seal.reveal.sealed': {
    zh: '封存時寫下的理由：{reason}。',
    en: 'Sealed reason: {reason}.',
  },
  'seal.reveal.streak': {
    zh: '連續命中 {n} 次 — 引擎越來越了解你。',
    en: '{n} correct calls in a row \u2014 the engine\u2019s dialing you in.',
  },
  'seal.direction.love': { zh: '好鍾意', en: 'love it' },
  'seal.direction.like': { zh: '幾中意', en: 'like it' },
  'seal.direction.meh': { zh: '麻麻地', en: 'meh' },
  'seal.direction.dislike': { zh: '不喜歡', en: 'not for you' },
  'copied.short': { zh: '已複製', en: 'Copied' },
  'profile.owner.link': { zh: '開啟儀表板', en: 'Open the dashboard' },
  'profile.owner.blurb': { zh: '看看食客的口味如何回應你餐廳的菜式。', en: 'See how diners\u2019 palates respond to your menu.' },
  'buddy.xpto': { zh: '仲差 {n} XP 就到{name}', en: '{n} XP to {name}' },
  'buddy.strength': { zh: '引擎強度', en: 'engine strength' },
  'buddy.flicks': { zh: '食評', en: 'reviews' },
  'buddy.cuisines': { zh: '菜系', en: 'cuisines' },
  'buddy.senses': { zh: '味覺調校', en: 'senses tuned' },
  // Tappable stat-box explainers. zh is Standard Written Chinese (書面語) — these are
  // reference/explanatory copy, deliberately more formal than the app's Cantonese
  // interactive voice. Grounded in the real /api/buddy computation (buddy.ts /
  // tasteExport.ts); no number is hardcoded that isn't also interpolated live.
  'buddy.explain.strength': {
    zh: '這個數字反映你的口味引擎建立在多少真實訊號之上：評分數量、已探索的口味維度、嘗試過的菜系種類，三者合計。多元的選擇遠比重複評同一類菜式更能訓練引擎，此數字不會誇大引擎實際掌握的程度。',
    en: 'How much real signal your taste engine is built on: rating volume, explored flavour dimensions, and cuisine variety, combined. Trying something new teaches it far more than rating the same dish again, and this number never overstates what the engine actually knows.',
  },
  'buddy.explain.flicks': {
    zh: '你至今作出的食評總數，也是口味引擎唯一的學習來源。每一次評分都是一個真實的數據點，評得越多、越多元，引擎對你口味的理解越深、預測越準。起步階段的頭幾十次教得最多，其後每一次都在微調；持續評分，正是讓推薦保持準確的關鍵。',
    en: 'The total number of dishes you’ve reviewed, and the engine’s only source of signal. Every rating is a real data point: the more you rate, and the more varied, the deeper and sharper its read on your taste. The first few dozen teach it most, and every one after keeps it tuned, since rating more is what keeps its recommendations accurate.',
  },
  'buddy.explain.cuisines': {
    zh: '你曾實際評分的不同菜系數目。菜系越多元，引擎學得越快，一個全新菜系帶來的訊號，往往抵得上多次重複評分。',
    en: 'The number of distinct cuisines you’ve actually rated dishes from. The more varied, the faster the engine learns, since a genuinely new cuisine is often worth several repeat ratings.',
  },
  'buddy.explain.senses': {
    zh: '在 {total} 種追蹤中的口味維度裡，有多少已經沉澱成明確的偏好，而非雜訊。這個門檻比上方的「已識」更嚴格，「已識」只需足夠證據去信任該讀數，而這裡要求讀到一個清晰、確立的偏好。',
    en: 'Of {total} tracked flavour dimensions, how many have crystallized into an actual preference, clear of noise. Stricter than “knows” above, which only needs enough evidence to trust a reading, since this one needs a genuinely clear signal.',
  },
  'buddy.hint.first': { zh: '評你第一道菜我就會孵化。', en: 'Rate your first dish and I hatch.' },
  'buddy.hint.early': { zh: '再評 {n} 道菜 — 頭幾下教我最多。', en: 'Rate {n} more — early flicks teach me most.' },
  'buddy.hint.cuisine': { zh: '試評一個新菜系，教會我的比平常多三倍。', en: 'Try a new cuisine — teaches me 3\u00d7 more.' },
  'buddy.hint.explore': { zh: '試試不常吃的 — 酸、苦、刺身。', en: 'Try something unusual — sour, bitter, raw.' },
  'buddy.hint.tune': { zh: '繼續評分 — 現在每一次都是微調。', en: 'Keep flicking — this is fine-tuning now.' },
  'buddy.hint.sharp': { zh: '我已足夠精準，一起發掘隱世好菜。', en: 'I\u2019m sharp. Let\u2019s find hidden gems.' },

  'auth.codehint': { zh: '在下方輸入電郵中的數字碼，即可在此瀏覽器登入：', en: 'Enter the code from that email below to sign in — right here in this browser:' },
  'auth.codeplaceholder': { zh: '數字碼', en: 'code' },
  'auth.verify': { zh: '確認', en: 'Verify' },
  'auth.verifying': { zh: '核對緊…', en: 'Verifying…' },
  'auth.codefail': { zh: '數字碼不正確或已過期 — 請再試一次，或重新傳送。', en: 'That code is wrong or expired — try again, or resend.' },
  'auth.resend': { zh: '用另一個電郵 / 重新傳送', en: 'Different email / resend' },
  'home.edit': { zh: '編輯', en: 'Edit' },
  'home.delete': { zh: '刪除', en: 'Delete' },
  'home.more': { zh: '更多操作', en: 'More actions' },
  'home.changerestaurant': { zh: '轉餐廳', en: 'Change restaurant' },
  'home.changerating': { zh: '重新評分', en: 'Re-rate' },
  'home.ratingsaved': { zh: '已更新評分', en: 'Rating updated' },
  'home.delete.confirm': { zh: '刪除這道菜及你的評分？', en: 'Delete this dish and your rating?' },
  'home.hearts': { zh: '{n} 個心心', en: '{n} hearts' },
  'home.name.locked': { zh: '名稱依餐牌而定，無法修改（口味與餐廳仍可修改）', en: 'Name follows the menu — not editable here (rating and restaurant still are)' },
  'home.name.en': { zh: '英文', en: 'English' },
  'home.name.zh': { zh: '中文', en: 'Chinese' },
  'home.save': { zh: '儲存', en: 'Save' },
  'home.cancel': { zh: '取消', en: 'Cancel' },
  'home.locked': { zh: '已有其他人評過這道菜 — 為保護他們的記錄，已鎖定不可修改。', en: 'Someone else has rated this \u2014 locked to protect their history.' },
  'home.addphoto': { zh: '加相', en: 'Add a photo' },
  'home.saving': { zh: '儲存緊…', en: 'Saving\u2026' },
  'home.translateOnSave': { zh: '（填一種語言就得 — 儲存會自動翻譯）', en: '(Fill one language — auto-translated on save)' },
  'home.loadingmore': { zh: '載入緊更多…', en: 'Loading more\u2026' },
  'scan.training': { zh: '再評 {n} 道菜 Dishi 先可以開始推介 — 而家先列出菜式。', en: 'Rate {n} more dishes and Dishi can start recommending — for now, here\u2019s the menu.' },
  'scan.scoring': { zh: '正在對照你的口味…（菜式已全部讀取，可慢慢看）', en: 'Matching your taste\u2026 (the menu\u2019s already read \u2014 browse while it finishes)' },
  'scan.scorefailed': { zh: '未能對照口味，但菜式已全部讀取 — 就當作普通清單瀏覽吧。', en: 'Couldn\u2019t match these to your taste \u2014 the menu\u2019s still fully read, just shown as a plain list.' },
  'scan.fire': { zh: '合你口味', en: 'Made for you' },
  'scan.reading': { zh: '讀緊個餐牌…', en: 'Reading the menu\u2026' },
  // Diet/allergen flags \u2014 "likely" framing lives in the prompt itself, not here;
  // these are just short labels for the closed vocabulary in menuScan.ts.
  'scan.diet.veg': { zh: '素', en: 'Veg' },
  'scan.diet.pork': { zh: '豬肉', en: 'Pork' },
  'scan.diet.beef': { zh: '牛肉', en: 'Beef' },
  'scan.diet.chicken': { zh: '雞肉', en: 'Chicken' },
  'scan.diet.duck_goose': { zh: '鴨鵝', en: 'Duck & Goose' },
  'scan.diet.lamb': { zh: '羊肉', en: 'Lamb' },
  'scan.diet.seafood': { zh: '海鮮', en: 'Seafood' },
  'scan.diet.shellfish': { zh: '帶殼海鮮', en: 'Shellfish' },
  'scan.diet.egg': { zh: '蛋', en: 'Egg' },
  'scan.diet.dairy': { zh: '奶類', en: 'Dairy' },
  'scan.diet.offal': { zh: '內臟', en: 'Offal' },
  'scan.diet.peanut': { zh: '花生', en: 'Peanut' },
  'scan.diet.tree_nut': { zh: '果仁', en: 'Tree Nuts' },
  // 豆製品 (not 大豆) is deliberate: the flag covers soy-BASED foods only, never
  // soy-sauce trace — the label must not read as an allergen-safety claim.
  'scan.diet.soy': { zh: '豆製品', en: 'Soy-based' },
  'scan.diet.spicy': { zh: '辣', en: 'Spicy' },
  // Cooking method \u2014 only the two NOT already covered by dim.* (fried/steamed/
  // grilled/braised/baked/raw all reuse those existing labels for consistency).
  'scan.cooking.stir-fried': { zh: '小炒', en: 'Stir-fried' },
  'scan.heaviness.light': { zh: '清淡', en: 'Light' },
  'scan.heaviness.medium': { zh: '適中', en: 'Medium' },
  'scan.heaviness.heavy': { zh: '濃郁', en: 'Heavy' },
  'scan.bucket.fresh_raw': { zh: '鮮嫩生食', en: 'Fresh & Raw' },
  'scan.bucket.steamed_poached': { zh: '蒸浸嫩滑', en: 'Steamed & Poached' },
  'scan.bucket.grilled_roasted': { zh: '燒烤香脆', en: 'Grilled & Roasted' },
  'scan.bucket.braised_stewed': { zh: '燜炆入味', en: 'Braised & Stewed' },
  'scan.bucket.rich_fried': { zh: '香炸濃郁', en: 'Rich & Fried' },
  'upload.tap': { zh: '拍照或選擇相片', en: 'Take a photo or choose one' },
  'upload.change': { zh: '已揀好 · 撳一下換相', en: 'Photo selected · tap to change' },

  // ---- misc ----
};

export const CJK = /[\u3400-\u9fff\u3040-\u30ff]/;

/**
 * Kana/hangul tripwire. True iff the string contains hiragana, katakana (incl.
 * phonetic extensions) or hangul \u2014 scripts that must NEVER survive into a
 * Traditional-Chinese "z". A PURE script check: it cannot false-positive on real
 * Chinese, which lives in the CJK-ideograph block (\u5409\u5217\u8c6c\u6252\u5b9a\u98df \u2192 false). This is
 * the mechanical GUARANTEE the scan prompt hardening can't give us on its own \u2014
 * qwen leaks the printed Japanese/Korean name into "z" often enough that wording
 * alone is unreliable; when this trips, the caller re-authors "z" through the
 * proven translate path.
 */
export function hasNonChineseScript(s: string | null | undefined): boolean {
  // \u3040-\u30ff hiragana+katakana, \u31f0-\u31ff katakana phonetic ext,
  // \uac00-\ud7af hangul syllables. NOT the CJK-ideograph block, so Chinese passes.
  return /[\u3040-\u30ff\u31f0-\u31ff\uac00-\ud7af]/.test(s ?? '');
}

/**
 * Resolve a dish's bilingual name pair from whatever fields exist.
 * name is English by convention (vision output); name_zh is the explicit Traditional
 * Chinese; name_original (menus) fills the Chinese slot when it's actually CJK.
 */
export function pickNames(d: { name: string; name_zh?: string | null; name_original?: string | null }): { en?: string; zh?: string } {
  const zh = d.name_zh ?? (d.name_original && CJK.test(d.name_original) ? d.name_original : undefined)
    ?? (CJK.test(d.name) ? d.name : undefined);
  const en = CJK.test(d.name) ? (d.name_original && !CJK.test(d.name_original) ? d.name_original : undefined) : d.name;
  return { en, zh };
}


// Cuisine display names. zh uses the natural Cantonese/HK term; en capitalizes.
// Unmapped cuisines fall back to the raw value rather than guessing a translation.
const CUISINE_ZH: Record<string, string> = {
  japanese: '日本菜', cantonese: '粵菜', chinese: '中菜', sichuan: '川菜',
  shanghainese: '滬菜', thai: '泰國菜', italian: '意大利菜', french: '法國菜',
  korean: '韓國菜', indian: '印度菜', mexican: '墨西哥菜', vietnamese: '越南菜',
  american: '美式', british: '英式', greek: '希臘菜', spanish: '西班牙菜',
  'middle eastern': '中東菜', peruvian: '秘魯菜', malaysian: '馬拉菜',
  singaporean: '星洲菜', taiwanese: '台灣菜', turkish: '土耳其菜',
};

export function cuisineLabel(cuisine: string | null | undefined, lang: Lang): string {
  if (!cuisine || cuisine === 'unknown') return '';
  const key = cuisine.toLowerCase();
  if (lang === 'zh') return CUISINE_ZH[key] ?? cuisine;
  return cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
}
