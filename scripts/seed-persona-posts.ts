/**
 * Seed the persona editorial SAMPLES (BACKLOG batch 2026-07-29, item 1).
 *
 * Two per persona, on their beats: Spoon 世界慾望誌 (khao soi, basque burnt
 * cheesecake), CK 簡單做啱咗 (cacio e pepe, tortilla española), Kiki 講緊乜
 * (dubai chocolate, tanghulu — named-source receipts, timeless phrasing).
 *
 * Every image is pulled from Wikimedia Commons at seed time WITH its license
 * metadata re-verified via the API — the credit rendered on the card is built
 * from what Commons says at this moment, not from what a shortlist remembered.
 * CC BY / CC BY-SA / CC0 / PD only; anything else aborts. Images are re-hosted
 * in the persona-content bucket (hotlinking Commons is fragile and slow) with
 * the file page recorded in image_source_url.
 *
 * Every body runs through validateEditorialPost — the SAME gate a future LLM
 * voice pass sits behind. A failing line aborts the seed; fix the line or the
 * pack, never the gate.
 *
 * Idempotent by slug, and the script is the source of truth for sample TEXT:
 * an existing post row (matched on image path) gets its bodies + pack UPDATED
 * in place (no image refetch, no duplicate row), so revising a voice is an
 * edit here + a re-run — the 2026-07-29 voice pass (longer, distinct, no
 * em-dash) shipped exactly that way. Only a brand-new slug walks the full
 * Commons license-verify + re-host path.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/seed-persona-posts.ts
 */
import { createClient } from '@supabase/supabase-js';
import { validateEditorialPost, type GroundingPack } from '../src/lib/personaEditorial';
import type { Persona } from '../src/lib/persona';

type Sample = {
  slug: string;
  persona: Persona;
  commonsFile: string; // exact File: title on Commons
  name: string; name_zh: string; cuisine: string;
  pack: GroundingPack;
  body_zh: string; body_en: string;
};

// Voice pass 2026-07-29 (owner feedback): longer bodies with room for
// character; no em-dashes anywhere (the one-author tell, now validator-
// enforced); Spoon and CK pulled APART — Spoon dwells inside the eating
// (senses, tempo, an instruction, a quiet close), CK tells you what the dish
// proves about kitchens (contract first, then worldly observation, then the
// wrong version damned politely). Kiki keeps her receipts-verdict-tip shape,
// with one more receipt's worth of room. Every new claim a body leans on was
// added to its pack first — the line may rephrase its pack, never extend it.
const SAMPLES: Sample[] = [
  {
    slug: 'khao-soi', persona: 'spoon',
    commonsFile: 'File:Khao Soi 01.jpg',
    name: 'Khao soi', name_zh: '泰北咖喱麵', cuisine: 'thai',
    pack: {
      name: 'Khao soi', name_zh: '泰北咖喱麵', cuisine: 'thai',
      facts_zh: ['清邁名物', '椰漿咖喱湯底，溫和唔鬥辣', '蛋麵一半烚腍，一半炸脆鋪面', '配醃芥菜、紅蔥頭同青檸，酸辛解膩'],
      facts_en: ['Chiang Mai signature', 'a gentle coconut curry broth, warmth over heat', 'boiled egg noodles crowned with the same noodles fried crisp', 'served with pickled mustard greens, shallots and lime to cut the richness'],
      signal: null,
    },
    body_zh: '泰北咖喱麵最靚嗰一刻，係脆麵沉落椰漿咖喱湯嗰三秒。上面嗰撮炸麵仲脆，底下啲蛋麵已經腍咗，一啖落去，係同一份麵嘅兩個時態。清邁人煨呢個湯唔係鬥辣，椰漿將咖喱撫平到近乎暖。碟邊嘅醃芥菜同紅蔥頭唔係裝飾，嗰陣酸同辛，係留返俾你中途唞氣用嘅。青檸最後先擠。唔使急，佢等你。',
    body_en: 'The best moment of a khao soi is the three seconds the fried noodles take to sink into the coconut curry. The crown is still crisp, the noodles underneath have gone tender, and one mouthful holds both at once: the same noodle in two tenses. Chiang Mai makes this broth gently, coconut milk smoothing the curry into something closer to warmth than heat. The pickled mustard greens and shallots are not garnish; that sourness is there so you can catch your breath halfway through. Squeeze the lime last. No hurry. It waits for you.',
  },
  {
    slug: 'basque-cheesecake', persona: 'spoon',
    commonsFile: 'File:Burnt Bake Cheesecake Khas Basque Spanyol.jpg',
    name: 'Basque burnt cheesecake', name_zh: '巴斯克焦香芝士蛋糕', cuisine: 'spanish',
    pack: {
      name: 'Basque burnt cheesecake', name_zh: '巴斯克焦香芝士蛋糕', cuisine: 'spanish',
      facts_zh: ['由聖塞巴斯蒂安一間酒吧發明', '高溫焗到面層深啡近黑', '冇餅底冇糖霜', '中心半流心，微苦襯奶滑', '放涼少少更好食'],
      facts_en: ['invented at a bar in San Sebastián', 'baked hot until the top goes nearly black', 'no crust, no frosting', 'a barely-set molten centre, slight bitterness against the cream', 'better eaten slightly cool'],
      signal: null,
    },
    body_zh: '巴斯克焦香芝士蛋糕係故意燒燶嘅。聖塞巴斯蒂安嗰間酒吧發明佢嗰時就諗通咗：面層焗到深啡近黑，中心先可以留得住半流心。冇餅底，冇糖霜，冇嘢分你心，淨係得質地：外層嗰浸微苦，襯住入面暖滑嘅芝士，放涼少少會更滑。用匙羹，唔好用叉。呢件蛋糕唔係俾你趕時間食嘅。佢嘅慢，就係佢嘅味。',
    body_en: 'A Basque cheesecake is burnt on purpose. The bar in San Sebastián that invented it understood the trade: bake the top to the edge of black, and the centre gets to stay barely set. No crust, no frosting, nothing to divide your attention, only texture: a thin bitterness outside, warm cream within, smoother still once it has cooled a little. Use a spoon, not a fork. This is not a cake for people in a hurry. Its slowness is its flavour.',
  },
  {
    slug: 'cacio-e-pepe', persona: 'ck',
    commonsFile: 'File:Cacio e pepe.jpg',
    name: 'Cacio e pepe', name_zh: '芝士黑椒意粉', cuisine: 'italian',
    pack: {
      name: 'Cacio e pepe', name_zh: '芝士黑椒意粉', cuisine: 'italian',
      facts_zh: ['羅馬經典，起源同牧羊人嘅乾糧有關', '得三樣材料：意粉、Pecorino Romano 羊芝士、黑椒', '個醬係芝士溝意粉水靠澱粉乳化，唔落忌廉唔落牛油', '溫度唔啱芝士會結粒'],
      facts_en: ["a Roman classic that began as shepherds' provisions", 'three ingredients: pasta, Pecorino Romano, black pepper', 'the sauce is cheese emulsified with starchy pasta water, no cream, no butter', 'the cheese seizes into clumps if the temperature is wrong'],
      signal: null,
    },
    body_zh: 'Cacio e pepe，芝士黑椒意粉。羅馬牧羊人嘅乾糧傳落嚟：意粉、羊芝士、黑椒，三樣，講完。個醬唔係整出嚟，係逼出嚟嘅。芝士溝意粉水，靠澱粉乳化，所以呢碟嘢冇得呃：水太熱，芝士即刻結粒俾你睇。而家啲餐廳興加忌廉，話穩陣啲。穩陣嘅意思，即係佢知自己會失手。三樣材料嘅菜，先至係真正考廚房嘅菜。',
    body_en: "Cacio e pepe came down from Roman shepherds, who carried pasta, pecorino and black pepper because nothing else would keep. Three ingredients, and that is the entire recipe. The sauce is not so much made as coaxed: cheese emulsified with starchy pasta water, and it forgives nobody. Run the water too hot and the cheese seizes into clumps, in front of your guests, without apology. Restaurants that add cream will tell you it is for reliability, which is a polite way of announcing they expect to fail. A dish of three ingredients is the most honest examination a kitchen can sit. Most prefer not to take it.",
  },
  {
    slug: 'tortilla-espanola', persona: 'ck',
    commonsFile: 'File:Tortilla de Patatas (Corte transversal).jpg',
    name: 'Tortilla española', name_zh: '西班牙薯仔蛋餅', cuisine: 'spanish',
    pack: {
      name: 'Tortilla española', name_zh: '西班牙薯仔蛋餅', cuisine: 'spanish',
      facts_zh: ['蛋、薯仔、橄欖油', '落唔落洋葱係全國之爭', '薯仔喺橄欖油入面慢火浸腍，唔係炒', '反鑊一下定型', '全西班牙酒吧檯面嘅常設菜'],
      facts_en: ['eggs, potatoes, olive oil', 'the onion question is a national argument', 'potatoes coddled slowly in the oil, not fried hard', 'set with one flip of the pan', 'a fixture on bar counters across Spain'],
      signal: null,
    },
    body_zh: '西班牙薯仔蛋餅，材料一句講完：蛋、薯仔、橄欖油。薯仔唔係炒，係浸喺橄欖油度慢火養腍，呢步急唔嚟。落唔落洋葱，西班牙人嘈咗幾代，兩邊都覺得對面係異端。我兩邊版本都食，邊個整得用心就幫邊個講話。最後嗰下反鑊係考試：一下手勢，唔准猶豫。你話佢不過係蛋溝薯仔？佢喺全西班牙嘅酒吧檯面坐足咁多年，位都冇讓過，自然有佢嘅道理。',
    body_en: 'A tortilla española asks for eggs, potatoes, olive oil, and patience. The potatoes are not fried but coddled, slowly, in rather more oil than your doctor would care to hear about. On the onion question Spain has argued for generations, each side quite certain the other is beyond saving; I eat both, and side with whichever was made with care, which settles the matter nicely. The flip is the examination: one motion, no hesitation. And if you are tempted to call it merely eggs with potatoes, consider that it has held its seat on every bar counter in Spain for generations. Institutions do not keep their chairs by accident.',
  },
  {
    slug: 'dubai-chocolate', persona: 'kiki',
    commonsFile: 'File:Dubai-Schokolade-Riegel-Angeschnitten.jpg',
    name: 'Dubai chocolate', name_zh: '杜拜朱古力', cuisine: 'dessert',
    pack: {
      name: 'Dubai chocolate', name_zh: '杜拜朱古力', cuisine: 'dessert',
      facts_zh: ['朱古力夾流心開心果醬同 kunafa 脆絲', '本尊係杜拜品牌 Fix 出嘅', '2024 年喺社交平台爆紅', '而家模仿版周街都係', '脆絲受潮會軟'],
      facts_en: ['a chocolate bar filled with pistachio cream and crisp kunafa threads', 'the original is by the Dubai brand Fix', 'went viral on social platforms in 2024', 'imitations are everywhere now', 'the threads go soft if they take on moisture'],
      signal: 'TikTok',
    },
    body_zh: 'TikTok 爆咗成年嘅杜拜朱古力 🍫 本尊係杜拜品牌 Fix 出嘅：流心開心果醬夾 kunafa 脆絲，咬落嗰下沙沙聲先係靈魂 🤤 而家周街都係翻版，俾錢之前check清楚：開心果醬夠唔夠厚，啲脆絲受咗潮未。仲有句真心話：你本身唔鍾意堅果嘅，幾靚都唔關你事 🙅‍♀️ 唔好齋跟風。',
    body_en: "Dubai chocolate, the bar TikTok refused to shut up about 🍫 the original is by Fix in Dubai: pistachio cream, crisp kunafa threads, and that quiet crunch is the whole point 🤤 imitations are everywhere now, so check before you pay: thick pistachio layer, threads still crisp, otherwise it's just green chocolate. And the honest rule stands: if nuts aren't your thing, the prettiest bar in the world still isn't for you 🙅‍♀️",
  },
  {
    slug: 'tanghulu', persona: 'kiki',
    commonsFile: 'File:Tanghulu sold in Yokohasma Chinatown.jpg',
    name: 'Tanghulu', name_zh: '糖葫蘆', cuisine: 'chinese',
    pack: {
      name: 'Tanghulu', name_zh: '糖葫蘆', cuisine: 'chinese',
      facts_zh: ['中國北方傳統小食', '山楂串裹玻璃咁薄嘅糖殼', '咬落「咔」一聲', '短片平台成日見佢個脆聲', '而家興埋士多啤梨、提子版', '糖漿煮過火會苦', '要攤凍先食'],
      facts_en: ['a northern-Chinese street snack', 'hawthorn skewers in a glass-thin sugar shell', 'the bite cracks audibly', 'the crunch is all over short-video platforms', 'strawberry and grape versions are trending now', 'the syrup turns bitter if overcooked', 'eaten once the shell has cooled'],
      signal: 'TikTok',
    },
    body_zh: '糖葫蘆嘅重點係嗰聲「咔」 🍓 山楂裹住玻璃咁薄嘅糖殼，啲短片就係靠呢下聲爆嘅 🔥 而家興到士多啤梨、提子乜都攞嚟裹，但老北方嗰句有道理：山楂先係本體，夠酸先頂得住咁甜。屋企整得到，不過煮糖真係考手勢，糖漿一過火就苦 😅 整親記得攤凍先食，唔係黐牙黐到你懷疑人生。',
    body_en: "Tanghulu is all about the crack 🍓 hawthorn under a sugar shell thin as glass, and that snap is the entire reason the videos pop off 🔥 everyone's dipping strawberries and grapes now, but the classic hawthorn version exists for a reason: the sourness is what stands up to all that sugar. doable at home if you respect the sugar work, one degree too far and it turns bitter 😅 and let it cool properly first, unless gluing your teeth together is part of the plan.",
  },
];

const OK_LICENSES = /^(CC BY(-SA)?( \d\.\d)?|CC0|Public domain)$/i;
const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim();

(async () => {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  for (const s of SAMPLES) {
    // 1. The gate, before anything touches the network.
    const v = validateEditorialPost(s.persona, s.pack, s);
    if (!v.ok) {
      console.error(`✗ ${s.slug}: validator rejected — ${v.reasons.join('; ')}`);
      process.exit(1);
    }

    // 2. Existing row → this run is a TEXT revision: update bodies + pack in
    // place (and the name fields, same source of truth), touch nothing about
    // the image, and skip Commons entirely. Published stays published — a
    // voice revision does not re-open review.
    const path = `${s.slug}.jpg`;
    const { data: existing } = await db.from('persona_posts')
      .select('id').like('image_url', `%/${path}`).maybeSingle();
    if (existing) {
      const { error: updErr } = await db.from('persona_posts').update({
        name: s.name, name_zh: s.name_zh, cuisine: s.cuisine,
        body_zh: s.body_zh, body_en: s.body_en, pack: s.pack,
      }).eq('id', existing.id);
      if (updErr) { console.error(`✗ ${s.slug}: update — ${updErr.message}`); process.exit(1); }
      console.log(`✎ ${s.slug}: existing row, bodies + pack updated`);
      continue;
    }

    // 3. New slug → re-verify the license and fetch the real URLs from Commons NOW.
    const api = new URL('https://commons.wikimedia.org/w/api.php');
    api.search = new URLSearchParams({
      action: 'query', format: 'json', titles: s.commonsFile,
      prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '1200',
    }).toString();
    const res = await fetch(api, { headers: { 'User-Agent': 'DishiSeed/0.1 (persona editorial samples)' } });
    const pages = (await res.json())?.query?.pages ?? {};
    const info = (Object.values(pages)[0] as any)?.imageinfo?.[0];
    if (!info) { console.error(`✗ ${s.slug}: Commons has no ${s.commonsFile}`); process.exit(1); }
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? '');
    if (!OK_LICENSES.test(license)) {
      console.error(`✗ ${s.slug}: license "${license}" is not in the allowed set`);
      process.exit(1);
    }
    const artist = stripHtml(meta.Artist?.value ?? 'Wikimedia Commons');
    const credit = `${artist} / Wikimedia Commons / ${license}`;
    const filePage = info.descriptionurl as string;

    // 4. Re-host: Commons → persona-content bucket. Commons 429s bursts from
    // new user agents — space the calls and back off rather than hammering.
    let img: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      await new Promise(r => setTimeout(r, attempt === 0 ? 1500 : 8000 * attempt));
      img = await fetch(info.thumburl ?? info.url, { headers: { 'User-Agent': 'DishiSeed/0.1 (persona editorial samples)' } });
      if (img.ok) break;
      console.log(`  ${s.slug}: image fetch ${img.status}, retrying…`);
    }
    if (!img?.ok) { console.error(`✗ ${s.slug}: image fetch kept failing`); process.exit(1); }
    const bytes = Buffer.from(await img.arrayBuffer());
    const up = await db.storage.from('persona-content').upload(path, bytes, {
      contentType: 'image/jpeg', upsert: true,
    });
    if (up.error) { console.error(`✗ ${s.slug}: upload — ${up.error.message}`); process.exit(1); }
    const { data: pub } = db.storage.from('persona-content').getPublicUrl(path);

    // 5. Insert as PENDING — publishing is the editor's tap, in the feed.
    const { error: insErr } = await db.from('persona_posts').insert({
      persona: s.persona, name: s.name, name_zh: s.name_zh, cuisine: s.cuisine,
      body_zh: s.body_zh, body_en: s.body_en,
      image_url: pub.publicUrl, image_credit: credit, image_license: license,
      image_source_url: filePage,
      fact_source_url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.name.replace(/ /g, '_'))}`,
      pack: s.pack, status: 'pending',
    });
    if (insErr) { console.error(`✗ ${s.slug}: insert — ${insErr.message}`); process.exit(1); }
    console.log(`✓ ${s.slug} (${s.persona}) — ${license}, credit: ${credit}`);
  }
  console.log('done');
})();
