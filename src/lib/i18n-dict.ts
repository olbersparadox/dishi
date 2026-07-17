// Pure i18n data + helpers — no React, so tests can run it under plain node.

export type Lang = 'zh' | 'en';

export const dict: Record<string, { zh: string; en: string }> = {
  // ---- shell ----
  'nav.feed': { zh: '食記', en: 'Journal' },
  'nav.scan': { zh: '掃餐牌', en: 'Scan' },
  'nav.taste': { zh: '味 AI', en: 'Taste' },

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
  'auth.send': { zh: '傳送連結', en: 'Send link' },
  'auth.sent': { zh: '請查收電郵，撳登入連結。', en: 'Check your inbox for the sign-in link.' },
  'auth.loading': { zh: '載入中…', en: 'Loading…' },

  // ---- home ----
  'home.title': { zh: '食記', en: 'Journal' },
  'home.rated': { zh: '評分咗！', en: 'Rated!' },
  'profile.justlearned': { zh: '你啱啱教咗我：{dims}', en: 'You just taught me: {dims}' },
  'home.homecooking': { zh: '住家菜', en: 'Home cooking' },

  // ---- log ----
  'log.title': { zh: '記錄一道菜', en: 'Log a dish' },
  'log.cancelflow': { zh: '取消', en: 'Cancel' },
  'log.nophoto': { zh: '冇影相？直接打個名', en: 'No photo? Just type the dish' },
  'log.nophoto.go': { zh: '去評分', en: 'Rate it' },
  'log.where': { zh: '你喺邊度食緊？', en: 'Where are you eating?' },
  'log.continue': { zh: '繼續', en: 'Continue' },
  'log.reading': { zh: '讀緊你碟嘢…', en: 'Reading the plate…' },
  'log.how': { zh: '好唔好食？', en: 'How was it?' },
  'voice.err.permission': { zh: '冇到麥克風權限 — 可以打字代替', en: 'Microphone access was denied — you can type instead' },
  'voice.err.language': { zh: '呢部機唔支援語音辨識廣東話 — 可以打字代替', en: "This device doesn't support speech recognition for this language — you can type instead" },
  'voice.err.nospeech': { zh: '冇聽到聲音 — 可以再試或者打字', en: "Didn't catch any speech — try again or type instead" },
  'voice.err.generic': { zh: '語音錄唔到 — 可以打字代替', en: "Voice recording isn't working right now — you can type instead" },
  'log.done': { zh: '搞掂', en: 'Done' },
  'log.saving': { zh: '儲緊…', en: 'Saving…' },
  'log.notdish.title': { zh: '呢張...唔係幾似食物喎？', en: 'This... doesn\u2019t really look like a dish?' },
  'log.notdish.blurb': { zh: '可能你口味係真係幾特別，又或者呢張相入面根本冇嘢食得。Dishi 老實同你講：唔係食物嘅相，學唔到你嘅口味 \u2014 評落去都係得個吉。真係要評落去？', en: 'Either your taste is wonderfully unusual, or there\u2019s nothing edible in this photo. Honest heads up: Dishi genuinely can\u2019t learn your taste from something that isn\u2019t food \u2014 rating it won\u2019t teach the engine anything. Still want to rate it anyway?' },
  'log.notdish.retake': { zh: '換張相', en: 'Try another photo' },
  'log.notdish.anyway': { zh: '照評，我口味係特別', en: 'Rate it anyway' },
  'log.addphotohint': { zh: '得閒影返張相都得，唔影都評到分。', en: 'Optional \u2014 add a photo whenever you like, rating works fine without one.' },
  'log.toRate': { zh: '待評嘅菜', en: 'Dishes to rate' },
  'log.rateNow': { zh: '而家評', en: 'Rate now' },
  'scan.pickcount': { zh: '揀咗 {n} 碟', en: '{n} dishes picked' },
  'scan.pickrestaurant': { zh: '呢張餐牌係邊間餐廳？', en: 'Which restaurant is this menu from?' },
  'table.pickedsofar': { zh: '啱啱揀咗', en: 'Picked so far' },
  'table.pickbtn': { zh: '揀呢個', en: 'Pick' },
  'table.orderbtn': { zh: '叫呢個', en: 'Order' },
  'table.pickeddone': { zh: '\u2713 揀咗', en: '\u2713 Picked' },
  'log.looks': { zh: '睇落係{cuisine}菜 · ', en: 'Looks {cuisine} · ' },
  'log.lowconf': { zh: '唔太肯定 — ', en: 'Low-confidence guess — ' },
  'log.confirmName': { zh: '確認', en: 'Confirm' },
  'log.learned': { zh: '學到嘢', en: 'Learned something' },
  'buddy.knows.count': { zh: '識咗 {n} 味', en: 'knows {n}' },
  'buddy.learning.count': { zh: '摸緊 {n} 味', en: 'learning {n}' },
  'log.willTranslate': { zh: '會由你嘅輸入自動翻譯', en: 'Will be translated from your input' },
  'log.relearned': { zh: '已根據你嘅修改，重新學過你嘅口味', en: 'Re-learned your taste from your correction' },
  'log.samedish.title': { zh: '{restaurant} 有兩味：', en: '{restaurant} has two dishes:' },
  'log.samedish.pair': { zh: '「{a}」同「{b}」', en: '\u201c{a}\u201d and \u201c{b}\u201d' },
  'log.samedish.q': { zh: '係咪同一味菜？', en: 'Are they the same dish?' },
  'log.samedish.yes': { zh: '係', en: 'Yes' },
  'log.samedish.no': { zh: '唔係', en: 'No' },
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
  'log.uploadfail': { zh: '上載失敗。檢查下網絡再試。', en: 'The upload failed. Check your connection and try again.' },

  // ---- flick rating ----
  'flick.inhaled': { zh: '一掃而空', en: 'Inhaled it' },
  'flick.loved': { zh: '超好味', en: 'Loved it' },
  'flick.good': { zh: '幾好食', en: 'Pretty good' },
  'flick.fine': { zh: '一般般', en: 'It was fine' },
  'flick.notforme': { zh: '唔啱我', en: 'Not for me' },
  'flick.never': { zh: '唔會再食', en: 'Never again' },
  'flick.hint': { zh: '鍾意就向上滑 · 唔鍾意向下 · 滑得愈遠愈強烈', en: 'Drag up if you loved it · down if not · further = more' },
  'flick.howto': {
    zh: '喺相片上面向上或者向下滑就評到分。或者，喺下面直接撳一個。',
    en: 'Rate by sliding up or down on the photo. Or rate by choosing the following.',
  },
  'flick.aria': { zh: '向上或向下滑動嚟評分', en: 'Rate this dish by dragging up or down' },
  'flick.notyet': { zh: '未評分', en: 'not rated yet' },

  // ---- restaurant picker ----
  'picker.finding': { zh: '搵緊你附近嘅餐廳…', en: 'Finding restaurants near you…' },
  'picker.denied': { zh: '定位已關 — 可以自己輸入店名，或者跳過。', en: 'Location is off — add the place by name, or skip.' },
  'picker.add': { zh: '+ 加間舖', en: '+ Add a place' },
  'picker.skip': { zh: '唔喺餐廳', en: 'Not at a restaurant' },
  'picker.name': { zh: '餐廳名', en: 'Restaurant name' },
  'picker.confirm': { zh: '加入', en: 'Add' },
  'picker.needloc': { zh: '新舖需要開定位，Dishi 先可以幫其他人釘住個位。', en: 'New places need location on, so Dishi can pin them for others.' },
  'picker.moredetails': { zh: '+ 更多資料', en: '+ Add more details' },
  'picker.area': { zh: '地區（例如：銅鑼灣）', en: 'Area (e.g. Causeway Bay)' },
  'picker.address': { zh: '地址', en: 'Address' },
  'picker.locating': { zh: '搵緊你附近嘅地區…', en: 'Finding your area…' },
  'picker.detailshint': { zh: '呢啲已經幫你估好，隨時可以改 — 想記番喺其他地方食過嘅嘢都得。', en: 'These are pre-filled guesses \u2014 edit freely, including to log a dish from somewhere else entirely.' },
  'picker.new': { zh: '新', en: 'new' },
  'picker.sameas': { zh: '係咪即係「{name}」？', en: 'Same place as "{name}"?' },
  'picker.samesame': { zh: '係，同一間', en: 'Yes, same place' },
  'picker.notsame': { zh: '唔係，係新舖', en: 'No, it\u2019s a new place' },

  // ---- voice ----
  'voice.listening': { zh: '● 聽緊 — 撳一下停止', en: '● Listening — tap to stop' },
  'voice.start': { zh: '🎙 講句短評（可以唔講）', en: '🎙 Say a quick note (optional)' },
  'voice.type': { zh: '或者打字 —「太鹹但係鑊氣好正」', en: 'or type it — "too salty but loved the char"' },
  'voice.typeonly': { zh: '「太鹹但係鑊氣好正」', en: '"too salty but loved the char"' },

  // ---- scan ----
  'scan.title': { zh: '掃餐牌', en: 'Scan a menu' },
  'scan.tip': { zh: '平放影全頁效果最好。中文、英文、中英夾雜都得', en: 'Works best flat-on with the whole page in frame. Chinese, English, or both.' },
  'scan.tablestatus': { zh: '{n} 人 · 揀咗 {m} 碟', en: '{n} here · {m} picked' },
  'scan.share.alsopicked': { zh: '{handles} 都揀咗', en: '{handles} picked this too' },
  'scan.results': { zh: '你嘅最佳選擇', en: 'Your best bets' },
  'scan.addpage': { zh: '加掃一版', en: 'Add a page' },
  'scan.addingpage': { zh: '加緊呢一版…', en: 'Adding this page…' },
  'scan.close': { zh: '閂咗佢', en: 'Close' },
  'scan.kept': { zh: '呢版似乎唔同餐廳 — 保留咗「{name}」', en: 'That page looks like a different place — kept “{name}”' },
  'scan.new': { zh: '新', en: 'New' },
  'scan.read': { zh: '讀到 {n} 道菜', en: '{n} dishes read' },
  'scan.mock': { zh: '示範餐牌 — 加返 OPENROUTER_API_KEY 先可以掃真餐牌。', en: 'Demo menu — add an OPENROUTER_API_KEY to scan real menus.' },
  'scan.logged': { zh: '叫咗嘢食？食完記得記錄 — 每次評分都令下次掃描更準。', en: 'Ordered something? Log it after — every rating sharpens the next scan.' },
  'scan.stage.0': { zh: '讀緊張餐牌…', en: 'Reading the menu…' },
  'scan.stage.1': { zh: '逐個部分睇緊…', en: 'Working through the sections…' },
  'scan.stage.2': { zh: '用廚藝知識估緊味道…', en: 'Estimating flavors from dish knowledge…' },
  'scan.stage.3': { zh: '對緊你嘅口味檔案…', en: 'Matching against your taste profile…' },
  'scan.stage.4': { zh: '排緊你嘅最佳選擇…', en: 'Ranking your best bets…' },
  'scan.err.notmenu': { zh: '呢張相好似唔係餐牌喎。影返張餐牌試下？', en: "This doesn't look like a restaurant menu. Try a photo of an actual menu?" },
  'scan.err.unreadable': { zh: '讀唔到呢張相。試下影近啲、影平啲、光猛啲，或者一次影一頁。', en: "Couldn't read that photo. Try getting closer, flatter, or better lit \u2014 or scan one page at a time." },

  // ---- table mode ----
  'table.title': { zh: '一齊食', en: 'Eat together' },
  'table.blurb': { zh: '大家用一個代碼入檯，菜式排名保證冇人被犧牲 — 唔係求其平均。', en: 'Everyone joins with a code, and the menu gets ranked so nobody at the table gets sacrificed — not just averaged.' },
  'table.start': { zh: '開檯', en: 'Start a table' },
  'table.start.blurb': { zh: '影低餐牌（可選）— 唔影就用 Dishi 上面嘅菜式嚟排。', en: 'Snap the menu (optional) — otherwise the table ranks dishes from around Dishi.' },
  'table.starting': { zh: '整緊檯…', en: 'Setting the table…' },
  'table.readingmenu': { zh: '讀緊餐牌…', en: 'Reading the menu…' },
  'table.join': { zh: '同朋友一齊點', en: 'Order Together' },
  'table.join.blurb': {
    zh: '一個先掃餐牌出 [枱號]，其他人跟住入',
    en: 'Already scanned by a friend? Ask them for the table code and enter it below to pick together.',
  },
  'table.joining': { zh: '入緊…', en: 'Joining…' },
  'table.joinbtn': { zh: '加入', en: 'Join' },
  'table.open.full': { zh: '我要自己開檯', en: 'Want to start your own table? Open the Table page →' },
  'table.leave': { zh: '離開', en: 'Leave' },
  'table.back': { zh: '返回', en: 'Back' },
  'table.invite': { zh: '+ 邀請', en: '+ Invite' },
  'table.noprofile': { zh: '未有檔案', en: 'no profile yet' },
  'table.few': { zh: '有兩個或以上口味檔案入檯，排名先至好玩。', en: 'Rankings get interesting once two or more taste profiles are at the table.' },
  'table.ranked': { zh: '為 {n} 種口味排名 — 要人人都啱先算贏。', en: 'Ranked for {n} palates — a dish only wins if it works for everyone.' },
  'table.nomenu': { zh: '（未有餐牌 — 用 Dishi 上面嘅菜式排緊。）', en: '(No menu attached — ranking dishes from around Dishi.)' },
  'table.unanimous': { zh: '全檯啱', en: 'whole table' },
  'table.fairness': { zh: '公平之選', en: 'fairness call' },
  'table.see': { zh: '睇下全檯點睇', en: 'See the table\u2019s take' },
  'table.hide': { zh: '收埋', en: 'Hide the table\u2019s take' },
  'table.pulling': { zh: '攞緊檯嘅資料…', en: 'Pulling up the table…' },
  'table.copied': { zh: '連結已複製 — 發俾成檯人。', en: 'Link copied — send it to the table.' },
  'table.sharetitle': { zh: '嚟我張檯 — Dishi', en: 'Join my table on Dishi' },

  // ---- order (QR) ----
  'order.session': { zh: '場次', en: 'session' },
  'order.yourtable': { zh: '你張檯', en: 'Your table' },
  'order.menu': { zh: '餐牌', en: 'Menu' },
  'order.solo': { zh: '按你口味排名。同檯朋友掃同一個 QR 就可以一齊排。', en: 'Ranked for your taste. Friends at the table can scan the same QR to join the ranking.' },
  'order.group': { zh: '為呢檯 {n} 種口味排名 — 朋友可以用代碼加入。', en: 'Ranked for {n} palates at this table — friends can join with the code.' },
  'order.yours': { zh: '你叫咗嘅嘢', en: 'Your orders' },
  'order.send': { zh: '落單 · {n} 樣', en: 'Send order · {n} items' },
  'order.sending': { zh: '傳送緊…', en: 'Sending…' },
  'order.sent': { zh: '已送去廚房。', en: 'Order sent to the kitchen.' },
  'order.notsetup.title': { zh: '餐牌仲未設定好。', en: 'The menu isn\u2019t set up yet.' },
  'order.notsetup.blurb': { zh: '問下店員 — 呢間餐廳仲未喺 Dishi 加菜式。', en: 'Ask the staff — the restaurant hasn\u2019t added dishes to Dishi ordering.' },
  'order.status.pending': { zh: '已送出 — 等緊廚房', en: 'Sent — waiting for the kitchen' },
  'order.status.confirmed': { zh: '已確認 — 整緊', en: 'Confirmed — being prepared' },
  'order.status.done': { zh: '上咗菜', en: 'Served' },
  'order.status.cancelled': { zh: '餐廳取消咗', en: 'Cancelled by the restaurant' },
  'order.setting': { zh: '幫你開緊檯…', en: 'Setting your table…' },
  'order.addone': { zh: '加一份{name}', en: 'Add one {name}' },
  'order.removeone': { zh: '減一份{name}', en: 'Remove one {name}' },

  // ---- profile / buddy ----
  'profile.title': { zh: '味 AI', en: 'Taste AI' },
  'profile.flicks': { zh: '{n} 次滑動 · {p} 有用積分', en: '{n} flicks · {p} usefulness points' },
  // Three-path entry on the Taste tab — these REPLACE the single log button, so
  // the surface itself says "anything counts": eating out, home cooking, or an
  // old photo sitting in the camera roll.
  'logsrc.rest': { zh: '餐廳菜', en: 'Dining out' },
  'logsrc.home': { zh: '屋企煮', en: 'Home-cooked' },
  'logsrc.album': { zh: '相簿舊相', en: 'Old photos' },
  'log.title.home': { zh: '記錄屋企煮嘅', en: 'Log a home-cooked dish' },
  'log.title.album': { zh: '記錄相簿舊相', en: 'Log from your camera roll' },
  'log.album.hint': { zh: '喺相簿揀返張食物相 — 幾耐之前食都得', en: 'Pick a food shot from your photos — no matter how long ago' },
  'log.album.where': { zh: '記唔記得喺邊度食？唔記得可以跳過', en: 'Remember where you had it? Skip if not' },
  'profile.helped': { zh: ' — 你嘅記錄幫過其他人決定', en: ' — your logs helped other people decide' },
  'profile.cuisines': { zh: '菜系', en: 'Cuisines' },
  'profile.rated': { zh: '已評嘅菜', en: 'Dishes you\u2019ve rated' },
  'profile.owner': { zh: '開餐廳？', en: 'Own a restaurant?' },
  'export.button': { zh: '將我嘅口味引擎接入 AI', en: 'Connect my taste engine to AI' },
  'export.locked': { zh: '再評多 {n} 味就生成到', en: '{n} more ratings to unlock' },
  'export.version': { zh: 'v{v} \u2014 同上次比較冇乜變。', en: 'v{v} \u2014 little has changed since last time.' },
  'export.delta': { zh: 'v{v} \u2014 同上次比較：{dims}', en: 'v{v} \u2014 since last time: {dims}' },
  'export.copy': { zh: '複製', en: 'Copy' },
  'export.paste': { zh: '貼入 ChatGPT / Claude 或者你用開嗰個 AI，叫佢記住。', en: 'Paste into ChatGPT, Claude, or whichever AI you use, and ask it to remember this.' },
  'form.migration.title': { zh: '你嘅夥伴進化咗', en: 'Your companion evolved' },
  'form.migration.blurb': {
    zh: '而家佢就係你嘅味覺本身 \u2014 每次評分都真係會改變佢嘅樣。',
    en: 'It\u2019s your taste itself now \u2014 every rating genuinely reshapes it.',
  },
  'form.migration.cta': { zh: '睇下佢', en: 'See it' },
  'seal.stamp.title': { zh: 'Dishi 封咗個預測', en: 'Dishi sealed a prediction' },
  'seal.reveal.hit': { zh: '拆開個印 \u2014 估中咗', en: 'Broke the seal \u2014 nailed it' },
  'seal.reveal.near': { zh: '拆開個印 \u2014 幾接近', en: 'Broke the seal \u2014 close' },
  'seal.reveal.miss': { zh: '拆開個印 \u2014 估錯咗', en: 'Broke the seal \u2014 missed it' },
  'seal.reveal.detail': {
    zh: 'Dishi 之前估你會「{predicted}」，你實際係「{actual}」。',
    en: 'Dishi predicted you\u2019d feel \u201c{predicted}\u201d \u2014 you actually felt \u201c{actual}\u201d.',
  },
  'seal.reveal.sealed': {
    zh: '封印嗰陣寫低嘅理由：{reason}。',
    en: 'Sealed reason: {reason}.',
  },
  'seal.reveal.streak': {
    zh: '連續估中 {n} 次 \u2014 個引擎越嚟越識你。',
    en: '{n} correct calls in a row \u2014 the engine\u2019s dialing you in.',
  },
  'seal.direction.love': { zh: '好鍾意', en: 'love it' },
  'seal.direction.like': { zh: '幾中意', en: 'like it' },
  'seal.direction.meh': { zh: '麻麻地', en: 'meh' },
  'seal.direction.dislike': { zh: '唔中意', en: 'not for you' },
  'copied.short': { zh: '已複製', en: 'Copied' },
  'profile.owner.link': { zh: '開啟儀表板', en: 'Open the dashboard' },
  'profile.owner.blurb': { zh: '睇下食客嘅口味點回應你間餐廳嘅菜式。', en: 'See how diners\u2019 palates respond to your menu.' },
  'buddy.xpto': { zh: '仲差 {n} XP 就到{name}', en: '{n} XP to {name}' },
  'buddy.strength': { zh: '引擎強度', en: 'engine strength' },
  'buddy.flicks': { zh: '滑動', en: 'flicks' },
  'buddy.cuisines': { zh: '菜系', en: 'cuisines' },
  'buddy.senses': { zh: '味覺調校', en: 'senses tuned' },
  'buddy.level.Hatchling': { zh: '初生蛋', en: 'Hatchling' },
  'buddy.level.Nibbler': { zh: '小食客', en: 'Nibbler' },
  'buddy.level.Taster': { zh: '品味生', en: 'Taster' },
  'buddy.level.Gourmand': { zh: '為食鬼', en: 'Gourmand' },
  'buddy.level.Connoisseur': { zh: '食家', en: 'Connoisseur' },
  'buddy.level.Legend of the Table': { zh: '餐檯傳說', en: 'Legend of the Table' },
  'buddy.hint.first': { zh: '評你第一道菜我就會孵化。', en: 'Rate your first dish and I hatch.' },
  'buddy.hint.early': { zh: '再評 {n} 道菜 — 頭幾下教我最多。', en: 'Rate {n} more — early flicks teach me most.' },
  'buddy.hint.cuisine': { zh: '試評一個新菜系，教我嘅嘢多三倍。', en: 'Try a new cuisine — teaches me 3\u00d7 more.' },
  'buddy.hint.explore': { zh: '試下唔常食嘅嘢 — 酸、苦、刺身。', en: 'Try something unusual — sour, bitter, raw.' },
  'buddy.hint.tune': { zh: '繼續滑 — 而家每一下都係微調。', en: 'Keep flicking — this is fine-tuning now.' },
  'buddy.hint.sharp': { zh: '我夠晒精準，一齊搵隱世好菜。', en: 'I\u2019m sharp. Let\u2019s find hidden gems.' },

  'auth.codehint': { zh: '如果連結喺第二個瀏覽器打開咗，可以輸入電郵入面嘅數字碼：', en: 'If the link opened in a different browser, enter the code from the same email:' },
  'auth.codeplaceholder': { zh: '數字碼', en: 'code' },
  'auth.verify': { zh: '確認', en: 'Verify' },
  'auth.verifying': { zh: '核對緊…', en: 'Verifying…' },
  'auth.codefail': { zh: '個碼唔啱或者過咗期 — 再試一次，或者重新傳送。', en: 'That code is wrong or expired — try again, or resend.' },
  'auth.resend': { zh: '用另一個電郵 / 重新傳送', en: 'Different email / resend' },
  'home.edit': { zh: '編輯', en: 'Edit' },
  'home.delete': { zh: '刪除', en: 'Delete' },
  'home.more': { zh: '更多操作', en: 'More actions' },
  'home.changerestaurant': { zh: '轉餐廳', en: 'Change restaurant' },
  'home.changerating': { zh: '重新評分', en: 'Re-rate' },
  'home.ratingsaved': { zh: '已更新評分', en: 'Rating updated' },
  'home.delete.confirm': { zh: '刪除呢道菜？其他人會見唔到，但你嘅口味檔案唔會倒帶。', en: 'Delete this dish? Others won\u2019t see it, but your taste profile isn\u2019t rewound.' },
  'home.hearts': { zh: '{n} 個心心', en: '{n} hearts' },
  'home.name.locked': { zh: '名跟餐牌，改唔到（口味同餐廳仍然改得）', en: 'Name follows the menu — not editable here (rating and restaurant still are)' },
  'home.name.en': { zh: '英文名', en: 'English name' },
  'home.name.zh': { zh: '中文名', en: 'Chinese name' },
  'home.save': { zh: '儲存', en: 'Save' },
  'home.cancel': { zh: '取消', en: 'Cancel' },
  'home.locked': { zh: '已經有其他人評過呢道菜 \u2014 為咗保護佢哋嘅記錄，鎖住咗唔可以改。', en: 'Someone else has rated this \u2014 locked to protect their history.' },
  'home.addphoto': { zh: '加相', en: 'Add a photo' },
  'home.saving': { zh: '儲存緊…', en: 'Saving\u2026' },
  'home.translateOnSave': { zh: '得閒填一種語言就得 — 儲存嗰陣自動幫你譯埋另一種', en: 'Fill in just one language if you like — the other translates automatically on save' },
  'home.loadingmore': { zh: '載入緊更多…', en: 'Loading more\u2026' },
  'scan.training': { zh: '再評 {n} 道菜 Dishi 先可以開始推介 — 而家先列出菜式。', en: 'Rate {n} more dishes and Dishi can start recommending — for now, here\u2019s the menu.' },
  'scan.scoring': { zh: '啱緊你嘅口味…（菜式已經讀晒，你可以慢慢睇）', en: 'Matching your taste\u2026 (the menu\u2019s already read \u2014 browse while it finishes)' },
  'scan.scorefailed': { zh: '啱唔到口味，不過菜式讀晒喺度 \u2014 就當普通清單睇啦。', en: 'Couldn\u2019t match these to your taste \u2014 the menu\u2019s still fully read, just shown as a plain list.' },
  'scan.fire': { zh: '啱晒你', en: 'Made for you' },
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
  'upload.tap': { zh: '影相或者揀返張相', en: 'Take a photo or choose one' },
  'upload.change': { zh: '已揀好 · 撳一下換相', en: 'Photo selected · tap to change' },

  // ---- misc ----
};

export const CJK = /[\u3400-\u9fff\u3040-\u30ff]/;

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
