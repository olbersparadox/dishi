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
 * Idempotent by slug: an existing storage object is overwritten, an existing
 * post row (matched on image path) is skipped, so re-running never duplicates
 * feed content.
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

const SAMPLES: Sample[] = [
  {
    slug: 'khao-soi', persona: 'spoon',
    commonsFile: 'File:Khao Soi 01.jpg',
    name: 'Khao soi', name_zh: '泰北咖喱麵', cuisine: 'thai',
    pack: {
      name: 'Khao soi', name_zh: '泰北咖喱麵', cuisine: 'thai',
      facts_zh: ['清邁名物', '椰漿咖喱湯底', '蛋麵一半烚一半炸脆做面', '配醃芥菜、紅蔥頭同青檸'],
      facts_en: ['Chiang Mai signature', 'coconut curry broth', 'boiled egg noodles crowned with the same noodles fried crisp', 'served with pickled mustard greens, shallots and lime'],
      signal: null,
    },
    body_zh: '脆麵沉落椰漿咖喱湯嗰三秒，係成碗泰北咖喱麵嘅意義——一半腍，一半脆，醃芥菜喺碟邊等你。唔好急。',
    body_en: 'Give the khao soi its three seconds — the crown of fried noodles sinking into the coconut curry, half tender, half crisp. The pickled mustard greens can wait. So can you.',
  },
  {
    slug: 'basque-cheesecake', persona: 'spoon',
    commonsFile: 'File:Burnt Bake Cheesecake Khas Basque Spanyol.jpg',
    name: 'Basque burnt cheesecake', name_zh: '巴斯克焦香芝士蛋糕', cuisine: 'spanish',
    pack: {
      name: 'Basque burnt cheesecake', name_zh: '巴斯克焦香芝士蛋糕', cuisine: 'spanish',
      facts_zh: ['發源自聖塞巴斯蒂安', '高溫焗到面層深啡近黑', '冇餅底', '中心半流心'],
      facts_en: ['from San Sebastián', 'baked hot until the top goes nearly black', 'crustless', 'a barely-set molten centre'],
      signal: null,
    },
    body_zh: '燒燶咗先至完整。面層深啡近黑，入面仲係半流心——凍少少食，用匙羹，一啖一啖嚟。',
    body_en: 'Burnt on purpose. The top goes almost black so the middle can stay barely set — eat it cool, with a spoon, slower than you think you need to.',
  },
  {
    slug: 'cacio-e-pepe', persona: 'ck',
    commonsFile: 'File:Cacio e pepe.jpg',
    name: 'Cacio e pepe', name_zh: '芝士黑椒意粉', cuisine: 'italian',
    pack: {
      name: 'Cacio e pepe', name_zh: '芝士黑椒意粉', cuisine: 'italian',
      facts_zh: ['羅馬經典', '得三樣材料：意粉、Pecorino Romano 羊芝士、黑椒', '個醬係芝士溝意粉水，唔落忌廉唔落牛油'],
      facts_en: ['a Roman classic', 'three ingredients: pasta, Pecorino Romano, black pepper', 'the sauce is cheese emulsified with starchy pasta water — no cream, no butter'],
      signal: null,
    },
    body_zh: '芝士黑椒意粉，三樣嘢：意粉、羊芝士、黑椒。個醬係芝士溝意粉水，唔係忌廉。多一樣，都係打擾。',
    body_en: 'Cacio e pepe asks for three things — pasta, pecorino, black pepper — and punishes a fourth. The sauce is cheese and pasta water, nothing else. Cream is for people who have given up.',
  },
  {
    slug: 'tortilla-espanola', persona: 'ck',
    commonsFile: 'File:Tortilla de Patatas (Corte transversal).jpg',
    name: 'Tortilla española', name_zh: '西班牙薯仔蛋餅', cuisine: 'spanish',
    pack: {
      name: 'Tortilla española', name_zh: '西班牙薯仔蛋餅', cuisine: 'spanish',
      facts_zh: ['蛋、薯仔、橄欖油', '落唔落洋葱係全國之爭', '薯仔要慢火浸熟', '反鑊定型'],
      facts_en: ['eggs, potatoes, olive oil', 'the onion question is a national argument', 'potatoes cooked slowly in the oil', 'set by flipping the pan'],
      signal: null,
    },
    body_zh: '薯仔蛋餅：蛋、薯仔、橄欖油，慢火。落唔落洋葱，西班牙人自己都嘈緊。反鑊嗰下手要定——心亂，餅就散。',
    body_en: 'A tortilla is eggs, potatoes, olive oil, and a national argument about onion. Cook the potatoes slowly, flip once, and hold your nerve — hesitation is how it falls apart.',
  },
  {
    slug: 'dubai-chocolate', persona: 'kiki',
    commonsFile: 'File:Dubai-Schokolade-Riegel-Angeschnitten.jpg',
    name: 'Dubai chocolate', name_zh: '杜拜朱古力', cuisine: 'dessert',
    pack: {
      name: 'Dubai chocolate', name_zh: '杜拜朱古力', cuisine: 'dessert',
      facts_zh: ['朱古力夾流心開心果醬同 kunafa 脆絲', '發源自杜拜', '2024 年喺社交平台爆紅'],
      facts_en: ['a chocolate bar filled with pistachio cream and crisp kunafa threads', 'originated in Dubai', 'went viral on social platforms in 2024'],
      signal: 'TikTok',
    },
    body_zh: 'TikTok 爆咗好耐嘅杜拜朱古力 🍫 流心開心果醬夾 kunafa 脆絲 🤤 排隊前諗清楚：鍾意堅果先好入手，唔好齋跟風 🙅‍♀️',
    body_en: 'Dubai chocolate, the bar TikTok wore out 🍫 pistachio cream, crisp kunafa threads 🤤 queue only if nuts are your thing — no blind following 🙅‍♀️',
  },
  {
    slug: 'tanghulu', persona: 'kiki',
    commonsFile: 'File:Tanghulu sold in Yokohasma Chinatown.jpg',
    name: 'Tanghulu', name_zh: '糖葫蘆', cuisine: 'chinese',
    pack: {
      name: 'Tanghulu', name_zh: '糖葫蘆', cuisine: 'chinese',
      facts_zh: ['中國北方傳統小食', '山楂串裹脆糖殼係經典', '咬落「咔」一聲', '短片平台成日見佢個脆聲'],
      facts_en: ['a northern-Chinese street snack', 'hawthorn skewers in a glass-thin sugar shell', 'the bite cracks audibly', 'the crunch is all over short-video platforms'],
      signal: 'TikTok',
    },
    body_zh: '糖葫蘆嘅重點係嗰聲「咔」 🍓 山楂裹住玻璃咁脆嘅糖殼，條片就係靠呢下聲爆嘅 🔥 屋企整都得，不過煮糖真係考手勢 😅',
    body_en: 'Tanghulu is all about the crack 🍓 hawthorn under a glass-thin sugar shell — that snap is why the videos pop off 🔥 doable at home, but the sugar-work is no joke 😅',
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

    // 2. Re-verify the license and fetch the real URLs from Commons NOW.
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

    // 3. Re-host: Commons → persona-content bucket. Commons 429s bursts from
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
    const path = `${s.slug}.jpg`;
    const up = await db.storage.from('persona-content').upload(path, bytes, {
      contentType: 'image/jpeg', upsert: true,
    });
    if (up.error) { console.error(`✗ ${s.slug}: upload — ${up.error.message}`); process.exit(1); }
    const { data: pub } = db.storage.from('persona-content').getPublicUrl(path);

    // 4. Insert as PENDING — publishing is the editor's tap, in the feed.
    const { data: existing } = await db.from('persona_posts')
      .select('id').like('image_url', `%/${path}`).maybeSingle();
    if (existing) { console.log(`• ${s.slug}: already seeded, skipped`); continue; }

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
