// Persona editorial — the grounding contract (BACKLOG batch 2026-07-29).
//
// Personas are COLUMNISTS in 大家食: precomputed dish-level posts, never venue
// verdicts. The voice may be written by an LLM at precompute time — the
// carve-out personaDaily.ts always reserved — but ONLY behind this validator,
// and the same gate applies to hand-authored lines: the contract holds
// regardless of who wrote the text.
//
// What it enforces, and why each check exists:
//  * Phase 0.5 §6's measured failure was FABRICATED VENUES WITH PRICES —
//    actionable claims. So: no digits the grounding pack doesn't contain, no
//    currency at all, no venue-speak (地址/分店/電話…). An editorial post has
//    nothing to walk into and nothing to pay; a line that tries to acquires
//    both is exactly the failure being industrialised.
//  * Latin proper nouns must come from the pack — a persona name-dropping a
//    place or brand it wasn't handed is §6 wearing a nicer shirt.
//  * Register rules ride along (persona.ts neverDoes, enforced not hoped):
//    CK zero emoji; Kiki 2–4, never a wall; Spoon no exclamation clusters.
//
// Known limits, deliberate: sentence-initial capitalized English words are
// exempt from the proper-noun check (no wordlist heuristics), and CJK
// numerals are not validated (一/兩 live inside ordinary words; prices in zh
// carry arabic digits, which ARE checked). The validator is a safety net over
// packs we author — not a defence against an adversarial writer.

import type { Persona } from './persona';

/** Everything a voiced line is allowed to know. Facts come from the source
 * recorded on the post (Wikipedia article, owner's note, trend signal) —
 * the line may rephrase them, never extend them. */
export type GroundingPack = {
  name: string | null;
  name_zh: string | null;
  cuisine: string | null;
  facts_zh: string[];
  facts_en: string[];
  /** Named signal source for Kiki's receipts ("Reddit r/food"). Null for the
   * other beats — a receipt she wasn't handed is hype. */
  signal: string | null;
};

const packCorpus = (p: GroundingPack) =>
  [p.name, p.name_zh, p.cuisine, ...p.facts_zh, ...p.facts_en, p.signal]
    .filter(Boolean).join(' ');

/** Grapheme clusters containing a pictograph — so 🙅‍♀️ counts once, not per
 * codepoint. Register rules count what a reader sees. (Constructed RegExp +
 * Array.from because the repo's bare `npx tsc` runs an older target that
 * rejects the /u literal and Segments iteration — runtime is unaffected.) */
const PICTO = new RegExp('\\p{Extended_Pictographic}', 'u');
const graphemes = (s: string) =>
  Array.from(new Intl.Segmenter().segment(s), seg => seg.segment);

function emojiCount(s: string): number {
  return graphemes(s).filter(g => PICTO.test(g)).length;
}
function maxEmojiRun(s: string): number {
  let run = 0, max = 0;
  for (const g of graphemes(s)) {
    if (PICTO.test(g)) { run++; max = Math.max(max, run); }
    else if (g.trim() !== '') run = 0;
  }
  return max;
}

/** Validate one voiced body against its pack. Returns every violation, not
 * just the first — a rejected batch line gets fixed in one pass. */
export function validateEditorialBody(
  persona: Persona,
  pack: GroundingPack,
  body: string,
  lang: 'zh' | 'en',
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const corpus = packCorpus(pack);

  // ── Grounding ────────────────────────────────────────────────────────────
  // Currency is banned outright: an editorial pack never contains a price, so
  // any currency mark is invented money.
  if (/[$€£¥￥]|\bHKD\b|\bUSD\b/.test(body) || /\d+\s*(?:蚊|港元|美元|元(?![素氣]))/.test(body)) {
    reasons.push('currency: editorial posts never state prices');
  }
  // Every digit sequence must exist in the pack (years, counts, temperatures —
  // fine when sourced, fabrication when not).
  for (const m of body.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!corpus.includes(m)) reasons.push(`ungrounded number: ${m}`);
  }
  // Venue-speak: the surviving §6 rule is that naming a venue requires a
  // Places-verified one, and the editorial pipeline simply doesn't do venues.
  const venueMark = body.match(/地址|分店|電話|訂位|營業時間|opening hours|reservations?\b/i);
  if (venueMark) reasons.push(`venue-speak: ${venueMark[0]}`);

  // Latin proper nouns (len>1, capitalized, not sentence-initial) must appear
  // in the pack, case-insensitively.
  const lc = corpus.toLowerCase();
  const tokens = Array.from(body.matchAll(/[A-Z][A-Za-z'’-]+/g));
  for (const t of tokens) {
    const before = body.slice(0, t.index).trimEnd();
    const sentenceInitial = before === '' || /[.!?。！？:：\n]$/.test(before);
    if (sentenceInitial) continue;
    if (!lc.includes(t[0].toLowerCase())) reasons.push(`ungrounded name: ${t[0]}`);
  }

  // ── Register (persona.ts neverDoes, mechanically checkable subset) ──────
  // The ghostwriter tell (owner, 2026-07-29): three voices sharing one
  // punctuation habit collapse into one author, and the em-dash is THE habit —
  // every early sample leaned on 「——」/「—」 for its pivot. Banned for all
  // personas, both languages: a voice that needs a pivot writes it with a full
  // stop, a colon, or a second sentence, and each persona pivots differently.
  if (/[—―]/.test(body)) reasons.push('register: em-dash is the one-author tell; pivot with punctuation the persona owns');
  const emoji = emojiCount(body);
  if (persona === 'ck' && emoji > 0) reasons.push('register: CK never uses emoji');
  if (persona === 'kiki') {
    if (emoji < 2 || emoji > 4) reasons.push(`register: Kiki uses 2–4 emoji (got ${emoji})`);
    if (maxEmojiRun(body) >= 5) reasons.push('register: emoji wall');
  }
  if (persona === 'spoon') {
    if (/[!！]{2,}/.test(body) || (body.match(/[!！]/g) ?? []).length > 1) {
      reasons.push('register: Spoon never clusters exclamation marks');
    }
    if (lang === 'zh' && emoji > 0) reasons.push('register: Spoon stays unadorned');
    if (lang === 'en' && emoji > 0) reasons.push('register: Spoon stays unadorned');
  }

  return { ok: reasons.length === 0, reasons };
}

/** Both languages of one post through the same gate. */
export function validateEditorialPost(
  persona: Persona,
  pack: GroundingPack,
  post: { body_zh: string; body_en: string },
): { ok: boolean; reasons: string[] } {
  const zh = validateEditorialBody(persona, pack, post.body_zh, 'zh');
  const en = validateEditorialBody(persona, pack, post.body_en, 'en');
  const reasons = [...zh.reasons.map(r => `zh: ${r}`), ...en.reasons.map(r => `en: ${r}`)];
  return { ok: reasons.length === 0, reasons };
}
