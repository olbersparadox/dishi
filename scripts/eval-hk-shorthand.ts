/**
 * MANUAL eval for the HK carb-shorthand fix (backlog item #4c) — run by hand after
 * prompt changes, NOT in CI (it makes real LLM calls and costs tokens). Mirrors the
 * spirit of backfill-diet-flags.ts: run the LIVE enrich path over a curated fixture of
 * shorthand dishes and print the derived carb/ingredients vs. what we expect, so a
 * human can eyeball whether the glossary + carbSuspicion re-ask are actually working.
 *
 * A row PASSES if its derived ingredients contain the expected carb word and none of
 * the wrong ones. This is a sanity signal, not an assertion — the model is
 * probabilistic; read the misses and decide whether the prompt needs another nudge.
 *
 * RUN:
 *   set -a; source .env.local; set +a
 *   npx tsx scripts/eval-hk-shorthand.ts
 */
import { enrichOneDish } from '../src/lib/menuScan';

// name_original (as printed) + the English seed the scan might have produced, plus the
// carb we EXPECT expanded and the wrong reading we must NOT see.
type Case = { o: string; en: string; want: string[]; notWant: string[] };
const CASES: Case[] = [
  { o: '炆米', en: 'Braised rice vermicelli', want: ['vermicelli', 'noodle'], notWant: ['rice grain'] },
  { o: '干炒牛河', en: 'Beef chow fun', want: ['noodle', 'ho fun', 'flat rice noodle'], notWant: [] },
  { o: '星洲炒米', en: 'Singapore fried vermicelli', want: ['vermicelli', 'noodle'], notWant: [] },
  { o: '肉醬意', en: 'Bolognese', want: ['spaghetti', 'pasta', 'noodle'], notWant: [] },
  { o: '火腿通', en: 'Ham macaroni', want: ['macaroni', 'pasta'], notWant: [] },
  { o: '餐蛋丁', en: 'Spam egg instant noodle', want: ['noodle', 'instant noodle'], notWant: [] },
  { o: '西多士', en: 'French toast', want: ['bread', 'toast'], notWant: [] },
  { o: '蛋治', en: 'Egg sandwich', want: ['bread'], notWant: [] },
  // Look-alikes that must keep their real (non-noodle) reading:
  { o: '糯米雞', en: 'Glutinous rice chicken', want: ['glutinous rice', 'rice'], notWant: ['vermicelli'] },
  { o: '粟米斑塊飯', en: 'Corn fish fillet rice', want: ['corn', 'rice'], notWant: ['vermicelli', 'noodle'] },
];

async function main() {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY required for a live eval.');
  let pass = 0;
  for (const c of CASES) {
    const e = await enrichOneDish({ name: c.o, name_zh: c.o, cuisine: 'hong kong' });
    const ings = e.ingredients.map(i => i.toLowerCase());
    const hay = ings.join(', ');
    const hit = c.want.length === 0 || c.want.some(w => hay.includes(w));
    const bad = c.notWant.some(w => hay.includes(w));
    const ok = hit && !bad;
    if (ok) pass++;
    console.log(`${ok ? '✓' : '✗'} ${c.o} (${c.en})`);
    console.log(`    ingredients: [${hay}]  diet: [${e.diet.join(', ')}]`);
    if (!ok) console.log(`    EXPECTED one of [${c.want.join(', ')}]${c.notWant.length ? `, NOT [${c.notWant.join(', ')}]` : ''}`);
  }
  console.log(`\n${pass}/${CASES.length} cases read the carb as expected.`);
}

main().catch(e => { console.error(e); process.exit(1); });
