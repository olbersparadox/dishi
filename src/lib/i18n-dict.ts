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

  // ---- home ----
  'home.title': { zh: '食記', en: 'Journal' },
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
  // duel.title also labels a pending duel in the interactions feed: the row
  // heading in the bell's text list, and the aria-label on the journal's photo
  // pair (same for exec.title below). See InteractionRow's two variants.
  'duel.title': { zh: '如果要你揀', en: 'If you had to pick' },
  'duel.tie': { zh: '揀唔到', en: 'Can’t decide' },
  'duel.hit': { zh: 'dishi 估中咗', en: 'dishi called it' },
  'duel.miss': { zh: 'dishi 估錯咗', en: 'dishi got that wrong' },
  // Now doubles as the reveal HEADER for a tie (moved up from a standalone
  // line under the photo pair, owner call 2026-07-28) — kept short to fit
  // next to its emoji at .duel-title's size, not the old --fs-title-b line.
  'duel.tieresult': { zh: '唔緊要下次再試', en: 'No worries, try again next time' },
  'duel.learned': { zh: '學到：{dims}', en: 'Learned: {dims}' },
  'duel.ok': { zh: '好', en: 'OK' },

  // 佢哋整得點？ — execution quality, on the same duel chassis. Asks ONLY how well
  // this kitchen rendered the dish; it never asks the eater whether the problem
  // was the dish or the cooking — that is answered by comparing instances.
  // Register stays 書面 per the standing shift.
  'exec.title': { zh: '佢哋整得點？', en: 'How was it made?' },
  // The COMPARING shape's own title (owner call, 2026-07-30): once a second
  // instance is on screen the question is directly "which one", so the title
  // says that instead of the generic anchor phrasing above — and carries the
  // question alone, with no sub-line under it (exec.q.compare, "both scales
  // can move", removed as redundant: the two live sliders already show that).
  'exec.title.compare': { zh: '兩間，邊間整得好啲？', en: 'Which one did it better?' },
  // Body copy is 書面 per the standing register shift; the TITLE keeps its
  // Cantonese voice as a deliberate exception, exactly like 係咪同一味？ above.
  'exec.q': { zh: '只評廚房的功夫，與你喜不喜歡這道菜無關', en: 'Just the kitchen’s work — not whether you like the dish' },
  'exec.low': { zh: '整得差', en: 'Badly made' },
  'exec.high': { zh: '整得好', en: 'Well made' },
  // {n} is either the reference dish's actual execution score (a real number
  // ONLY when it was itself already execution-scored — see ratings/route.ts's
  // ANCHOR_THRESHOLD) or, more often, its flick VERDICT WORD (一般般/幾好食/
  // etc., via wordKeyFor) when it wasn't. Never an invented placeholder either
  // way — always something the person actually said about this exact dish.
  'exec.prior': { zh: '上次評 {n}', en: 'Rated {n} last time' },

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
  // Bell rows are ONE line each (owner call, 2026-07-30): no title above, no
  // sub below, one sentence that carries the whole ask. Register is 書面 per
  // the standing shift; the titles keep their Cantonese voice on the CARDS
  // (duel.title / exec.title above), where they remain the headline.
  // Two lines, not one long wrap — same \n + white-space:pre-line pattern as
  // .auth-tagline / .explain-modal-body (owner call, 2026-07-30, for tidier
  // reading in the 300px bell dropdown).
  'notif.duel.sub': { zh: '二選一\n讓 dishi 更懂你的口味', en: 'Pick one,\nso dishi learns your taste' },
  // Rematch framing: the engine ADMITS the last bet missed and re-checks — the
  // taste-understanding claim made visible, not an apology.
  'notif.duel.rematch': { zh: '上次猜錯了你的口味\n這次再驗證一次', en: 'dishi guessed wrong last time,\nverifying again' },
  'duel.rematch': { zh: '上次估錯了你的口味，這局再驗證一次', en: 'The last bet on your taste missed — this one double-checks' },
  // 佢哋整得點？ serves TWO comparison shapes and the line must say which, or it
  // reads as a mix-up (owner call, 2026-07-29 — the old single line said
  // 「邊間」, "which shop", even when both plates came from one kitchen).
  // Which variant is chosen: InteractionRow.execComparisonKind.
  //   .same  — one venue, two visits. Names the place: the whole point is that
  //            the SHOP is held constant and only the day changed.
  //   .cross — two venues. The card names them, so the line needn't.
  //   .again — anything we can't state confidently (home cooking, one side with
  //            no restaurant). Place-free, so it can never claim a venue wrong.
  'notif.exec.sub.same': { zh: '{place}的{dish}\n兩次水準有分別嗎？', en: '{place}’s {dish},\nwas the standard the same twice?' },
  'notif.exec.sub.cross': { zh: '兩間餐廳的{dish}\n哪間做得更好？', en: '{dish} at two places,\nwhich kitchen did it better?' },
  'notif.exec.sub.again': { zh: '吃過兩次的{dish}\n水準有分別嗎？', en: '{dish}, twice,\nwas the standard the same?' },
  'daily.title': { zh: '今日互動', en: 'Today' },
  'log.toRate': { zh: '待評菜式', en: 'Dishes to rate' },
  'log.rateNow': { zh: '而家評', en: 'Rate now' },
  'scan.pickcount': { zh: '已選 {n} 道', en: '{n} dishes picked' },
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
  // photoOnly (食記 retrospective edit): the shortlist is the PHOTO's location or
  // nothing — the device's location is days and miles away from the meal, so it
  // would be confidently wrong. Live GPS stays reachable for PINNING a newly
  // typed place, but only on an explicit tap (picker.uselivegeo).
  'picker.nophotoloc': {
    zh: '這張相片沒有位置資料 — 可以自己輸入店名，或者跳過。',
    en: 'This photo has no location — add the place by name, or skip.',
  },
  'picker.fromhere': { zh: '📍 你現時位置附近', en: '📍 Around where you are now' },
  'picker.needloc.photo': {
    zh: '這張相片沒有位置，新舖需要一個位置才釘得住。',
    en: 'This photo has no location, and a new place needs one to be pinned.',
  },
  'picker.uselivegeo': { zh: '用我現時位置', en: 'Use my current location' },
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
    zh: '一枱人可以共用同一次掃描結果。第一個掃描餐牌的人會獲得一個枱號，其他人輸入此枱號即可加入同一枱，在自己的手機上看到同一份餐牌。所有人的選擇會即時顯示，餐牌上會標示每道菜是由誰揀選的。',
    en: 'Everyone at the table can share one menu scan. Whoever scans first gets a table code; everyone else enters it to join the same table and see the same menu on their own phone. Picks show up in real time, so you can see who picked what on the menu.',
  },
  'table.joining': { zh: '入緊…', en: 'Joining…' },
  'table.joinbtn': { zh: '加入', en: 'Join' },
  'table.leave': { zh: '離開', en: 'Leave' },
  'table.back': { zh: '返回', en: 'Back' },
  'table.invite': { zh: '邀請', en: 'Invite' },
  // The restaurant line. 未定 rather than a question or an instruction: the
  // restaurant is usually resolved automatically, so this state is "not settled
  // yet", not a task anyone has been handed.
  'table.restaurant.unset': { zh: '餐廳未定', en: 'Restaurant not set' },
  'table.restaurant.which': { zh: '這一檯在哪間餐廳？', en: 'Which restaurant is this table at?' },
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
  // Names the code it just copied, because that is the whole point of tapping it:
  // the confirmation doubles as proof the RIGHT five characters are on the
  // clipboard. Says 檯號, not 連結 — the invite button copies a link, this copies
  // the code, and one string covering both would be wrong on one of them.
  'table.codecopied': { zh: '已複製檯號 {code}', en: 'Table code {code} copied' },
  'table.copycode': { zh: '複製檯號', en: 'Copy table code' },
  // A DISH permalink's confirmation. It used to borrow table.copied, so sharing a
  // dish from 食記 said "send it to the table" — a dish link has nothing to do
  // with a table, and the person may not be at one (owner, 2026-07-31).
  'share.linkcopied': { zh: '已複製連結', en: 'Link copied' },
  'table.sharetitle': { zh: '來我這桌 — Dishi', en: 'Join my table on Dishi' },
  // Rides the share sheet's message body, ahead of the URL. The code is spelled
  // out for humans on purpose: titles get dropped by messengers, and a mangled
  // link still leaves five characters someone can type into the join box.
  'table.sharetext': { zh: '一齊揀餸，入檯碼 {code}', en: 'Pick dishes together. Table code: {code}' },

  // ---- the done-picking handshake ----
  // 「我選好了」 states a fact about MYSELF, not a command to the table: the whole
  // point of the handshake is that no one member declares picking over for
  // everyone else. The waiting layer then says what is being waited for, because
  // "please wait" with no count is indistinguishable from a hung screen.
  'table.ready.done': { zh: '我選好了', en: 'I’m done' },
  // 等埋其他人, not 等其他人選完: the progress line directly underneath already
  // says 「1 / 2 位已選好」, so spelling out 選完 in the title only repeats it.
  // Knowingly Cantonese against the 書面化 register shift — the owner tuned this
  // line in the design pass and it stays an exception (see DECISIONS.md).
  'table.ready.waiting': { zh: '等埋其他人', en: 'Waiting for the others' },
  'table.ready.progress': { zh: '{n} / {total} 位已選好', en: '{n} of {total} ready' },
  'table.ready.undo': { zh: '繼續選', en: 'Keep picking' },

  // ---- settle: the bill and who carries it ----
  // Design handoff (2026-07-31, 大話骰): retitled from 埋單/本檯共選 to name the
  // moment that actually opens this screen — everyone has finished picking,
  // not yet decided who pays. 邊個埋單 two lines down still says 埋單, so the
  // word is not gone from the screen, just not the h1 any more.
  'table.settle.title': { zh: '大家揀左', en: 'What everyone picked' },
  'table.settle.dishcount': { zh: '共 {n} 碟菜', en: '{n} dishes' },
  // The "+" on a partial total is load-bearing everywhere else in this app; a
  // bill is the one place it MUST be spelled out, because a number people are
  // about to hand money over on cannot quietly mean "at least". The service
  // charge is named for the same reason (design handoff, 2026-07-31): a HK bill
  // adds 10% at the counter, and a total that ignored it would read as wrong.
  // Two separate caveats, because they are two different claims (owner, 2026-08-01).
  // A bill missing prices is a FLOOR: the real number is above it. A fully-priced
  // bill is an ESTIMATE: the printed prices are all there, but the 10% and whatever
  // else the shop adds are not, so it is close rather than short. Every total carries
  // one of them, since a bare figure on a bill nobody has seen yet reads as exact.
  'table.settle.partial': {
    zh: '有些沒有標價和未計加一，合計只是下限和大概。',
    en: 'Some dishes had no printed price and service is not included, so this total is a floor.',
  },
  'table.settle.estimate': {
    zh: '未計加一和其他費用，合計只是大概。',
    en: 'Service and other fees are not included, so this total is an estimate.',
  },
  // An equal split's answer, in the same slot the draw's reveal uses (owner,
  // 2026-08-01). 加一未計 matches how table.settle.partial already says it — the
  // printed prices never include the 10%, and a per-head figure that quietly ignored
  // it would be the one number on this screen someone actually hands over money on.
  'table.settle.eachhead': { zh: '位位 {amount} 加一未計', en: '{amount} each, service not included' },
  'table.settle.how': { zh: '邊個埋單', en: 'Who pays' },
  'table.settle.equal': { zh: '平均分攤', en: 'Equal split' },
  'table.settle.random': { zh: '隨機一人', en: 'Random' },
  'table.settle.game': { zh: '大話骰', en: 'Liar’s dice' },
  'table.settle.payer': { zh: '{name} 付這一餐', en: '{name} pays' },
  'table.settle.payeryou': { zh: '你付這一餐', en: 'You pay' },
  // 隨機一人's reveal, one line per draw, written by the owner 2026-08-01. The draw
  // is re-rollable, so the ladder is the screen's patience running out: it thanks
  // the payer, announces them, then starts needling, then offers to pay itself, and
  // finally gives up and tells the table to take all night.
  //
  // {name} is always the profile name — no you-form, by design, so one key serves
  // whoever is looking. Rungs 6 and 7 deliberately carry NO name: they are the app
  // talking about itself and to the table, not announcing a payer. Anything that
  // "fixes" that by adding {name} back breaks the joke.
  //
  // Deliberately Cantonese against the 書面化 register shift, on the same grounds
  // as the flick verdicts: this is the app's voice having a laugh, and 書面語
  // teasing reads as a memo. Sits alongside 等埋其他人 as a kept exception.
  'table.settle.draw1': { zh: '多謝 {name}', en: 'Thank You {name}' },
  'table.settle.draw2': { zh: '今次 {name} 請', en: '{name} is getting this round' },
  'table.settle.draw3': { zh: '請食飯嘅係...... {name}!', en: '{name} is going to pay the bill!' },
  'table.settle.draw4': { zh: '仲嚟? {name} 囉', en: 'Again? {name} shall pay' },
  'table.settle.draw5': { zh: '不如算吧啦 {name} 請唔請呀', en: 'Just let it be... {name}?' },
  'table.settle.draw6': { zh: '不如我請啦....', en: 'Maybe I should pay to end this' },
  'table.settle.draw7': { zh: '收舖未啊? 你地慢慢', en: 'Closing yet? Feel free to do this all night' },
  'table.settle.torate': { zh: '去評分', en: 'Rate what you ate' },

  // ---- 大話骰 ----
  // Cantonese, deliberately (owner, 2026-07-31): this surface is a named
  // exception to the 書面化 direction, because the game is spoken at the table
  // and 書面語 would make it sound like a form. A later register pass must not
  // flatten 邊個埋單 / 揀方向 / 就開咗盅.
  'table.dice.pickdir': { zh: '你先叫 揀方向', en: 'You open — pick a direction' },
  'table.dice.left': { zh: '向左', en: 'Left' },
  'table.dice.right': { zh: '向右', en: 'Right' },
  'table.dice.waitdir': { zh: '{name} 揀緊方向', en: '{name} is picking a direction' },
  'table.dice.youfirst': { zh: '你先叫', en: 'You open' },
  // 到你, not 你叫: the strip below now shows your pending call in your own
  // colour, so the label's job is to say the turn has come round, not to
  // restate the thing sitting under it.
  'table.dice.yourturn': { zh: '到你', en: 'Your turn' },
  'table.dice.theirturn': { zh: '{name} 叫', en: '{name} calls' },
  // A call is spoken as "six fours": the count in numerals, the face as a word.
  'table.dice.call': { zh: '{n}個{face}', en: '{n} {face}s' },
  'table.dice.say': { zh: '叫{n}個{face}', en: 'Call {n} {face}s' },
  'table.dice.face.1': { zh: '一', en: 'one' },
  'table.dice.face.2': { zh: '二', en: 'two' },
  'table.dice.face.3': { zh: '三', en: 'three' },
  'table.dice.face.4': { zh: '四', en: 'four' },
  'table.dice.face.5': { zh: '五', en: 'five' },
  'table.dice.face.6': { zh: '六', en: 'six' },
  'table.dice.minus': { zh: '減一', en: 'One fewer' },
  'table.dice.plus': { zh: '加一', en: 'One more' },
  'table.dice.open': { zh: '開', en: 'Open the cups' },
  'table.dice.result': { zh: '看結果', en: 'See the result' },
  // Who called what, and who stopped it. The second line is used when 開 came
  // from someone whose turn it was NOT — which is allowed, and is exactly the
  // moment worth naming.
  'table.dice.revealline': {
    zh: '{bidder} 叫 {call} {challenger} 就開咗盅',
    en: '{bidder} called {call}, {challenger} opened the cups',
  },
  'table.dice.revealcut': {
    zh: '{bidder} 叫 {call} {waiting} 仲未叫完 {challenger} 就開咗盅',
    en: '{bidder} called {call}, {waiting} hadn’t gone yet, {challenger} opened the cups anyway',
  },
  'table.dice.total': { zh: '全枱得 {n} 個{face}', en: '{n} {face}s on the table' },
  'table.dice.pays': { zh: '埋單', en: 'Pays' },

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
  // (The 食物相/打字/外賣單 redesign that briefly replaced these was rolled back
  // 2026-07-22 and the direction abandoned 2026-07-26 — see DECISIONS.md.)
  'logsrc.rest': { zh: '餐廳菜', en: 'Dining out' },
  'logsrc.home': { zh: '住家菜', en: 'Home-cooked' },
  'logsrc.album': { zh: '相簿舊菜', en: 'Old photos' },
  'logsrc.help.title': { zh: '食物相食評', en: 'Rating food photos' },
  'logsrc.help.body': {
    zh: '可以逐張評分，也可以一次揀一疊相片批量評。你的食物相裡，藏著許多關於你口味的理解，好好利用它們，訓練專屬於你的 AI 口味引擎：評得越多、越多元，dishi 就越懂你，推薦越貼近你的口味。',
    en: 'Rate one at a time, or pick a whole stack of photos and rate in a batch. Hidden inside your food shots is a wealth of understanding about your taste, so put them to good use and train an AI taste engine that belongs to you: the more you rate, and the more varied, the better dishi knows you.',
  },
  // dishi.username — claimed at the v1 unlock, then ONE change ever. The warning
  // is load-bearing copy, not decoration: it is the entire reason the scarcity is
  // fair, so it appears BEFORE the field, not as fine print under it.
  // Titled as a BIRTH, not a form: v1 is the first moment there is something
  // real to name, and the blurb spends its length on what that thing will grow
  // into (sharper with every rating → reads an unfamiliar menu → 植入 into the
  // AI they already use) rather than on the mechanics of naming.
  'username.title': { zh: '你的味覺 AI 誕生了', en: 'Your taste AI is born' },
  // Separate from the title because the title is a headline ("誕生了") that would
  // be a nonsense accessible name for a text field.
  'username.field.label': { zh: '為你的味覺 AI 改個名', en: 'Name your taste AI' },
  'username.blurb': {
    zh: '你已經建立了 dishi v1 — 由你真正吃過的每一道菜煉成的味覺 AI。繼續評分，它會越來越懂你：在完全陌生的餐牌上，一眼認出適合你的菜；也可以植入你日常使用的 AI，連「今晚吃什麼」都答得中你的口味。\n先為它改個名 — 這就是你的味覺身分。',
    en: 'You’ve built dishi v1 — a taste AI distilled from every dish you’ve actually eaten. Keep rating and it sharpens: picking out the right dish on a menu you’ve never seen, and — once implanted in the AI you already use — answering “what should I eat tonight?” in your own palate.\nName it first. That name is your taste identity.',
  },
  // Counts the naming happening RIGHT NOW as the first of the two, because that
  // is how the person experiences it — they are choosing a name, so telling them
  // they get "one change" reads as "zero flexibility" and undersells the one
  // rename they actually still hold. System-side this is unchanged:
  // USERNAME_CHANGES_ALLOWED is still 1, and the claim itself still spends none.
  'username.warn': {
    zh: '請認真選擇：改名的機會只有 2 次。',
    en: 'Choose carefully — you only get 2 chances at this name.',
  },
  'username.placeholder': { zh: '你的名字', en: 'your name' },
  'username.save': { zh: '就用這個名', en: 'Use this name' },
  'username.checking': { zh: '檢查中…', en: 'Checking…' },
  'username.available': { zh: '可以用', en: 'Available' },
  'username.err.empty': { zh: '請先輸入名字', en: 'Type a name first' },
  'username.err.tooshort': { zh: '最少 3 個字元', en: 'At least 3 characters' },
  'username.err.toolong': { zh: '最多 20 個字元', en: 'At most 20 characters' },
  'username.err.shape': {
    zh: '只可以用英文字母、數字和底線，並以字母開頭',
    en: 'Letters, numbers and underscores only, starting with a letter',
  },
  'username.err.reserved': { zh: '這個名已被保留', en: 'That name is reserved' },
  'username.err.taken': { zh: '這個名已經有人用了', en: 'That name is taken' },
  'username.err.nochangesleft': { zh: '改名機會已經用完', en: 'You’re out of chances' },
  'username.err.failed': { zh: '改名失敗，請再試一次', en: 'Couldn’t save that — try again' },
  // Rename sheet, reached by tapping the name on the taste card.
  'username.rename.title': { zh: '改名', en: 'Change your name' },
  'username.rename.last': {
    zh: '你還有一次改名機會，用了之後就不能再改。',
    en: 'You have one change left. After this, the name is permanent.',
  },
  'username.rename.none': {
    zh: '改名機會已經用完，這個名會一直跟著你。',
    en: 'You’re out of chances — this name is yours for good.',
  },
  'profile.helped': { zh: ' — 你的記錄曾幫助其他人做決定', en: ' — your logs helped other people decide' },
  'profile.cuisines': { zh: '菜系', en: 'Cuisines' },
  'profile.rated': { zh: '已評菜式', en: 'Dishes you\u2019ve rated' },
  'profile.owner': { zh: '開餐廳？', en: 'Own a restaurant?' },
  'rate.preparing': { zh: '正在處理相片…', en: 'Preparing photos…' },
  'rate.skip': { zh: '跳', en: 'Skip' },
  'rate.draghint': { zh: '上下拖曳評分', en: 'Drag to Rate' },
  // Progressive "watch your Taste AI learn" screen (merged reward + review)
  // 味覺 AI (the engine) vs 口味 (the preference it learns) — the split is
  // deliberate and applied app-wide, so this matches username.title's framing.
  'grow.build.title': { zh: '建立個人化味覺 AI', en: 'Building your personal taste AI' },
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
  // State B's one-line identity blurb (taste-only export: the carousel is gone,
  // the slot shows the container name + this line). Deliberately makes NO
  // ambient-surfacing promise — the doc teaches one summon path only.
  'export.install.blurb': { zh: '將你的口味植入你日常用的 AI', en: 'Install your palate into the AI you already use' },
  // The second swipe: the SAME palate, sent to a person instead of an AI.
  // The blurb says what the friend actually receives (the public page), so
  // the swipe is not mistaken for sending the export document itself.
  'export.share.blurb': { zh: '將你的頁面傳給朋友', en: 'Send your page to a friend' },
  'export.share.messengers': { zh: '傳給朋友', en: 'Send to a friend' },
  'export.share.copied': { zh: '已複製連結', en: 'Link copied' },
  // Unclaimed: only a claimed name resolves publicly, so there is no page to
  // send yet. Points at the claim field, which sits on this same card.
  'export.share.needname': {
    zh: '改咗上面個名，就有得分享你嘅味覺頁面',
    en: 'Claim your name above and you can share your taste page',
  },
  'export.swipe.ai': { zh: '植入 AI', en: 'Install into an AI' },
  'export.swipe.person': { zh: '傳給朋友', en: 'Send to a friend' },
  'form.migration.title': { zh: '你的夥伴進化了', en: 'Your companion evolved' },
  'form.migration.blurb': {
    zh: '現在它就是你的味覺本身 — 每次評分都會真實地改變它的模樣。',
    en: 'It\u2019s your taste itself now \u2014 every rating genuinely reshapes it.',
  },
  'form.migration.cta': { zh: '看看它', en: 'See it' },
  // What a rating taught the engine — restored 2026-07-24 with a real consumer
  // (the growth screen). Lost its previous one when /log was killed.
  'profile.justlearned': { zh: '你剛剛教會了我：{dims}', en: 'You just taught me: {dims}' },
  'seal.stamp.title': { zh: 'Dishi 封存了一個預測', en: 'Dishi sealed a prediction' },
  'seal.explain.title': { zh: '「印」是什麼？', en: 'What’s the 印 stamp?' },
  'seal.explain.body': {
    zh: 'Dishi 在你選擇之前就秘密寫下對你會選哪樣的預測，封存的內容無人能看見，連你自己也不例外。選擇之後才揭開，看預測是否準確。',
    en: 'Dishi writes down its guess before you pick, sealed, so nobody, not even you, can peek. It only opens after you choose.',
  },
  'seal.reveal.hit': { zh: '揭開封印 — 預測命中', en: 'Broke the seal \u2014 nailed it' },
  'seal.reveal.near': { zh: '拆開個印 \u2014 幾接近', en: 'Broke the seal \u2014 close' },
  'seal.reveal.miss': { zh: '揭開封印 — 預測落空', en: 'Broke the seal \u2014 missed it' },
  // Split into two title-sized lines (2026-07-26) \u2014 the balloon leads with the
  // call, then the actual, each big enough to read at a glance; the reason and
  // what it taught follow as smaller supporting text (seal.reveal.sealed /
  // profile.justlearned).
  'seal.reveal.predicted': { zh: 'Dishi \u9810\u8a08\uff1a\u300c{predicted}\u300d', en: 'Dishi called it: \u201c{predicted}\u201d' },
  'seal.reveal.actual': { zh: '\u4f60\u7684\u8a55\u50f9\uff1a\u300c{actual}\u300d', en: 'You rated it: \u201c{actual}\u201d' },
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
  // Public dossier — dishi.me/[username] (decision 3). 書面 register; the
  // page is an acquisition surface, so the CTA is quiet, never a wall.
  'dossier.back': { zh: '返回', en: 'Back' },
  // Was "實際食過並喜愛的菜" when this section was the top-rated ratings. It is
  // posts now, and posts may be negative — a label promising love would make
  // the page misrepresent a published dislike.
  'dossier.anchors': { zh: 'dishi.{name} 的特別推介', en: "dishi.{name}'s picks" },
  'dossier.cta': { zh: '建立你自己的味覺 AI →', en: 'Build your own taste AI →' },
  // The shared-dish permalink's way through to the whole palate behind it.
  'dossier.dish.more': { zh: '睇 dishi.{name} 嘅完整味覺 →', en: "See dishi.{name}'s full palate →" },
  'copied.short': { zh: '已複製', en: 'Copied' },
  'profile.owner.link': { zh: '開啟儀表板', en: 'Open the dashboard' },
  'profile.owner.blurb': { zh: '看看食客的口味如何回應你餐廳的菜式。', en: 'See how diners\u2019 palates respond to your menu.' },
  'buddy.xpto': { zh: '仲差 {n} XP 就到{name}', en: '{n} XP to {name}' },
  // English shortened to one word (2026-07-27): "engine strength"/"senses tuned"
  // wrapped to 2 lines while "reviews"/"cuisines" stayed 1, so the number above
  // each label sat at a different height across the 4 stat boxes — zh labels are
  // all naturally 1 line so this never showed there. Shortening keeps every
  // English label to 1 line too, which realigns the numbers without any CSS change.
  'buddy.strength': { zh: '引擎強度', en: 'Engine' },
  'buddy.flicks': { zh: '食評', en: 'reviews' },
  'buddy.cuisines': { zh: '菜系', en: 'cuisines' },
  'buddy.senses': { zh: '味覺調校', en: 'Senses' },
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
  // Sign-in asked for MID-ACTION (SignInSheet), not at the front door. The
  // body names the thing the person just reached for, so the ask reads as the
  // next step of their own intent rather than a wall in front of it.
  'auth.sheet.title': { zh: '差一步', en: 'One step first' },
  'auth.sheet.bookmark': {
    zh: '用電郵登入，就可以將呢道菜加入你嘅待評清單 — 順便開始建立你自己嘅味覺。',
    en: 'Sign in with your email to save this dish to your list — and start building your own palate while you are at it.',
  },
  // 食記's two tabs. 大家 is honest about what the second one is: posts from
  // whoever the RANKING matched, not from anyone you follow — there is no
  // follow anywhere in the product. Private/Public (owner call 2026-07-28)
  // name the actual visibility split more plainly than Journal/Everyone did.
  'home.tab.mine': { zh: '食自己', en: 'Private' },
  'home.tab.feed': { zh: '大家食', en: 'Public' },
  'feed.failed': { zh: '載入唔到，稍後再試', en: "Couldn't load — try again later" },
  // Says what is actually true of a chronological pool. The old line ("nothing
  // matching your taste today") described a ranking that no longer runs — copy
  // that claims a filter the code isn't applying is the worst kind of stale.
  'feed.empty': { zh: '未有人公開過菜式。', en: 'No one has published a dish yet.' },
  'feed.bookmark': { zh: '想食', en: 'Want to eat' },
  'feed.bookmarked': { zh: '已加入待評', en: 'In your queue' },
  'feed.bookmark.failed': { zh: '加唔到', en: "Couldn't add" },
  // The in-feed editorial review (editor-only; BACKLOG batch 2026-07-29).
  // 書面 register — this is workflow chrome, not persona voice.
  'feed.review.pending': { zh: '待刊', en: 'Draft' },
  'feed.review.publish': { zh: '刊出', en: 'Publish' },
  'feed.review.discard': { zh: '棄用', en: 'Discard' },
  'feed.review.failed': { zh: '操作失敗，請再試', en: 'Failed — try again' },
  'feed.bookmark.own.title': { zh: '係你自己碟菜', en: 'That’s your own dish' },
  'feed.bookmark.own.body': {
    zh: '收藏其他人推介的菜式才有意思。收藏後可以在 Taste AI 的 待評清單找到。',
    en: 'Bookmarking makes sense for dishes other people recommend. Once bookmarked, find it in Taste AI’s dishes-to-rate queue.',
  },
  // Said out loud on purpose: a broken daily job must never be indistinguishable
  // from a genuinely quiet day.
  'feed.persona.failed': { zh: '（今日的每日精選未更新到。）', en: "(Today's daily picks didn't update.)" },
  // 貼文 — publishing is per DISH, and the copy says 公開 (public), never
  // "share with friends": there is no friend concept in the product.
  // Share (simplified, owner call): no sheet, no card — 'post.share.title'
  // still rides in the OS share-sheet payload's own title field (lib/share.ts
  // via MyDishes.tsx's shareDish/sendDishLink).
  'post.share.title': { zh: '分享畀朋友', en: 'Share with a friend' },
  'post.share.cta': { zh: '分享', en: 'Share' },
  // Status glyph beside the kebab — non-interactive, just "this is posted".
  // Share needs a URL, and only a CLAIMED username mints one.
  'post.share.needname.title': { zh: '先改個名', en: 'Claim your name first' },
  'post.share.needname.body': {
    zh: '分享連結係 dishi.你個名／道菜 — 要先喺「味 AI」度改咗個名，先有得分享。',
    en: 'A share link looks like dishi.yourname/dish — claim your name on the 味 AI tab first, then you can share.',
  },
  'post.title': { zh: '食自己 > 大家食', en: 'Private > Public' },
  'post.body': {
    zh: '本身預設為私人，公開之後會貼出公海。但為了保障你的私隱，誰和你一齊以及用餐時間會被移除。',
    en: 'Private by default. Once published it goes public. But to protect your privacy, who you ate with and when are removed.',
  },
  'post.reason.placeholder': { zh: '形容一下怎樣 "{verdict}"（可以唔寫）', en: 'Describe how it’s "{verdict}" (optional)' },
  'post.negative.note': { zh: '負評一樣可以公開；頁面會照樣顯示你的評價。', en: 'A bad verdict can be published too; the page shows it as it is.' },
  'post.publish': { zh: '公開', en: 'Publish' },
  'post.update': { zh: '更新', en: 'Update' },
  'post.unpublish': { zh: '收回', en: 'Unpublish' },
  'post.public': { zh: '已公開', en: 'Public' },
  'post.failed': { zh: '公開唔到，再試一次', en: "Couldn't publish — try again" },
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
