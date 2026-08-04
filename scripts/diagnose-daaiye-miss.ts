/**
 * Field-miss post-mortem: 大爺燒鵝 香港仔田灣, 2026-08-04 (item 3b's first field pass).
 *
 * The owner scanned the menu (session VYGX4, 35 items, scan coords 13m away),
 * photographed 油雞髀腩仔飯 five minutes later, rated it at home. Vision named it
 * 燒鴨叉燒飯 — soy-sauce chicken read as roast duck, roast pork belly read as char
 * siu — and nothing was adopted (name_from_menu_at null).
 *
 * Two things are indistinguishable from the DB row alone, and they have opposite
 * fixes, so this replays the exact photo against the exact shortlist:
 *
 *   A (baseline)  — no context. Reproduces what shipped? If A != 燒鴨叉燒飯 the
 *                   miss was noise, not a systematic read.
 *   C (3b, live)  — the real 35-name shortlist from VYGX4. Three outcomes:
 *                     * 玫瑰豉油雞飯 / 脆皮燒腩仔飯  -> the shortlist RESCUES it
 *                     * 明爐燒鴨飯                  -> ADOPTED-WRONG, the
 *                       pre-agreed kill criterion: the menu HAS a roast duck
 *                       rice, so a forced match makes the wrong answer look
 *                       authoritative
 *                     * an off-menu descriptive name -> correct refusal, and the
 *                       failure is base vision accuracy, not 3b
 *
 * Repeated N times per arm because one sample cannot separate "the prompt does
 * this" from "the model did this once".
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/diagnose-daaiye-miss.ts
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { callClaude, imagePart, textPart, parseJsonResponse } from '../src/lib/openrouter';
import { VISION_PROMPTS, visionUserText } from '../src/lib/vision';
import { findAdoptedName } from '../src/lib/nameShortlist';

const SYSTEM = VISION_PROMPTS[0];
const PHOTO = process.env.PHOTO_PATH!;
const RUNS = Number(process.env.RUNS ?? 3);
const TRUTH = '油雞髀腩仔飯';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function name(base64: string, ctx: any): Promise<string> {
  const text = await callClaude(SYSTEM, [
    imagePart(base64, 'image/jpeg'),
    textPart(visionUserText(ctx)),
  ], { maxTokens: 500, expectJson: true });
  const p: any = parseJsonResponse(text);
  return p?.name_zh ?? p?.name ?? '(none)';
}

(async () => {
  const base64 = readFileSync(PHOTO).toString('base64');

  const { data: session } = await supabase
    .from('table_sessions').select('menu_items, scan_lat, scan_lng')
    .eq('code', 'VYGX4').single();

  const shortlist: string[] = (session!.menu_items as any[])
    .map(m => m?.name_zh ?? m?.name_original ?? m?.name).filter(Boolean);

  console.log(`shortlist: ${shortlist.length} names`);
  console.log(`truth: ${TRUTH} (a 自選雙拼飯 of 油雞髀 + 燒腩仔)`);
  console.log(`decoys on menu: 明爐燒鴨飯, 蜜汁叉燒飯 — what vision thought it saw\n`);

  for (const [label, ctx] of [
    ['A baseline   ', null],
    ['C +shortlist ', { shortlist, district: { zh: '香港仔', en: 'Aberdeen' } }],
  ] as const) {
    for (let i = 0; i < RUNS; i++) {
      try {
        const answer = await name(base64, ctx);
        const adopted = findAdoptedName(answer, ctx?.shortlist ?? []);
        const tag = adopted
          ? (adopted === '玫瑰豉油雞飯' || adopted === '脆皮燒腩仔飯' || adopted === '自選雙拼飯'
              ? 'ADOPTED-RIGHT-ISH' : 'ADOPTED-WRONG ***KILL***')
          : 'no adoption';
        console.log(`${label} #${i + 1}: ${answer.padEnd(14)} -> ${tag}`);
      } catch (e: any) {
        console.log(`${label} #${i + 1}: ERROR ${e?.message ?? e}`);
      }
    }
    console.log('');
  }
})();
