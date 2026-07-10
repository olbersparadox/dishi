import { DIMS, DishVector } from './taste';
import { callClaude, imagePart, textPart, parseJsonResponse } from './openrouter';
import { salvageJsonObjects } from './jsonSalvage';

// Menu Scanner perception layer.
//
// Architecture note: this module ONLY does perception — turning a photo of a physical
// menu into structured items with attribute vectors. It deliberately does NOT rank or
// personalize. Ranking happens in the API route using the exact same contentScore()
// math that powers the feed, so a "92% match" on a scanned menu means the same thing
// as it does everywhere else in Dishi, and every recommendation is explainable from
// the user's real taste vector rather than model vibes.

export type MenuItem = {
  name: string;            // English name (translated if the menu isn't in English)
  name_zh: string | null;  // Traditional Chinese name (translated if the menu isn't Chinese)
  name_original: string;   // exactly as printed, e.g. 麻婆豆腐
  section: string | null;  // menu section header if present, e.g. "Starters", 小菜
  description: string | null;
  price: string | null;    // as printed, currency and all — no parsing games
  cuisine: string;
  hook: string;            // one distinctive sensory detail, e.g. "wok-charred, numbing heat"
  attributes: DishVector;  // 0..1 presence on the shared 18 dims
  confidence: number;      // how legible/certain this item was
};

export type MenuScanResult = {
  items: MenuItem[];
  menu_language: string;
  restaurant_guess: string | null;
  mock: boolean;
};

const SYSTEM = `You read a photograph of a physical restaurant menu and extract EVERY legible dish as structured data.

Menus are messy: multiple columns, section headers, prices in odd places, mixed languages (especially Chinese + English), specials taped on, glare, handwriting. Work systematically. Do not invent items; extract partially-legible ones with lower confidence.

For each dish, estimate sensory attributes from culinary knowledge.

Respond with ONLY compact JSON, no markdown fences, minimal whitespace:
{"menu_language": string, "restaurant_guess": string|null,
 "items": [{
   "n": string (English name; translate if needed),
   "z": string (Traditional Chinese name; translate if needed),
   "o": string (name exactly as printed),
   "p": string|null (price exactly as printed),
   "c": string (cuisine, lowercase),
   "h": string (<=6 words, most distinctive sensory hook),
   "f": number 0..1 (confidence),
   "a": [18 numbers 0..1, ONE decimal place, in this exact order: ${DIMS.join(', ')}]
 }]}
Keep output small: one decimal place everywhere, no extra fields. Extract at most 28 items; prefer mains and signatures over drinks and sides.`;

export async function scanMenu(base64: string, mediaType: string): Promise<MenuScanResult> {
  // Mock ONLY when no key is configured. A failed/timed-out call with a real key
  // must surface as an error, never silently masquerade as the demo menu.
  if (!process.env.OPENROUTER_API_KEY) return mockMenu();

  const text = await callClaude(SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Extract every dish from this menu.'),
  ], { maxTokens: 3000 });

  const parsed = parseJsonResponse<{ items?: any[]; menu_language?: string; restaurant_guess?: string }>(text);
  if (!parsed) return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false };

  const items: MenuItem[] = (parsed.items ?? []).map((raw: any) => sanitizeItem(raw)).filter(Boolean) as MenuItem[];
  if (items.length === 0) return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false };
  return {
    items,
    menu_language: String(parsed.menu_language ?? 'unknown'),
    restaurant_guess: parsed.restaurant_guess ? String(parsed.restaurant_guess) : null,
    mock: false,
  };
}

// ---------------------------------------------------------------------------
// TWO-PHASE SCAN. A single call that OCRs a menu AND estimates 18 flavor numbers
// per dish is fundamentally a 20-40+ second generation task once a menu has more
// than a handful of items — no schema trick changes that. So the phases split:
//   Phase 1 (scanMenuOCR): names/prices/cuisine/hook only. No attribute numbers.
//            Much smaller output -> the fast, always-run step.
//   Phase 2 (scoreOneDish, called once per dish, in parallel with a concurrency
//            cap — see src/lib/concurrency.ts): flavor vectors only, TEXT-ONLY (no
//            image, no vision preprocessing). Only runs when the user has enough
//            ratings (>=5) for a score to mean anything — for new users this phase
//            is skipped entirely, which is the single biggest real-world speed win,
//            since a fresh account is exactly the common "someone's trying the demo"
//            case. Per-dish (rather than one batched call for the whole menu) means
//            total wait is roughly bounded by the SLOWEST single dish, not the sum
//            of all of them, and each ring can light up the moment its own call
//            finishes rather than everything appearing at once at the end.
// ---------------------------------------------------------------------------

const OCR_SYSTEM = `You read a photograph of a physical restaurant menu and extract EVERY legible dish.

Menus are messy: multiple columns, section headers, prices in odd places, mixed languages (especially Chinese + English), specials taped on, glare, handwriting. Work systematically. Do not invent items; extract partially-legible ones with lower confidence.

Respond with ONLY compact JSON, no markdown fences, minimal whitespace:
{"menu_language": string, "restaurant_guess": string|null,
 "items": [{
   "n": string (English name; translate if needed),
   "z": string (Traditional Chinese name; translate if needed),
   "o": string (name exactly as printed),
   "p": string|null (price exactly as printed),
   "c": string (cuisine, lowercase),
   "h": string (<=6 words, most distinctive sensory hook),
   "f": number 0..1 (confidence)
 }]}
Extract at most 20 items; prefer mains and signatures over drinks and sides. No flavor scoring in this step.`;

export type OcrMenuItem = Omit<MenuItem, 'attributes'>;

export async function scanMenuOCR(base64: string, mediaType: string): Promise<MenuScanResult> {
  // Mock includes attributes already (they're hardcoded, free) — the demo path
  // stays a single complete response, no phase 2 needed.
  if (!process.env.OPENROUTER_API_KEY) return mockMenu();

  const text = await callClaude(OCR_SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Extract every dish from this menu. Names, prices, cuisine, and a hook only — no flavor scoring.'),
  // Was 1400 — too tight for large/dense menus. Real evidence: a genuine large-menu
  // scan returned 0 items in ~16s (not a timeout — it finished fast, just got cut
  // off mid-JSON before the array closed, which fails to parse and looks like total
  // failure). CJK text and 20 items' worth of bilingual names/prices/hooks can
  // genuinely need more room than that. Raised with real headroom rather than a
  // minimal bump, since a truncated response is a silent full-scan failure, not a
  // graceful degradation — worth erring generous here.
  ], { maxTokens: 3000 });

  const parsed = parseJsonResponse<{ items?: any[]; menu_language?: string; restaurant_guess?: string }>(text);

  if (parsed) {
    const items = (parsed.items ?? []).map((raw: any) => sanitizeItem(raw)).filter(Boolean) as MenuItem[];
    if (items.length > 0) {
      return {
        items,
        menu_language: String(parsed.menu_language ?? 'unknown'),
        restaurant_guess: parsed.restaurant_guess ? String(parsed.restaurant_guess) : null,
        mock: false,
      };
    }
  }

  // Clean parse failed (or parsed but had zero usable items) — almost certainly the
  // response got cut off before the JSON closed. Try to salvage whatever complete
  // dish objects exist before the cutoff point, rather than discarding a 45-of-50-
  // dishes response as a total failure just because dish #46 didn't finish.
  const salvaged = text ? salvageJsonObjects(text, 'items').map((raw: any) => sanitizeItem(raw)).filter(Boolean) as MenuItem[] : [];

  if (salvaged.length > 0) {
    console.log(`menu-scan/ocr: salvaged ${salvaged.length} items from a truncated/malformed response`);
    return { items: salvaged, menu_language: 'unknown', restaurant_guess: null, mock: false };
  }

  // Total failure with nothing recoverable — log enough of the raw response that the
  // NEXT occurrence is a definitive diagnosis instead of an inference from timing
  // alone. (Deliberately capped snippet length — this is a log line, not a dump.)
  if (text) {
    console.error(`menu-scan/ocr: unparseable response, length=${text.length}, head="${text.slice(0, 200)}", tail="${text.slice(-200)}"`);
  } else {
    console.error('menu-scan/ocr: no response text at all (call failed/timed out before returning anything)');
  }
  return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false };
}

const SCORE_ONE_SYSTEM = `You estimate sensory flavor attributes for ONE dish, using culinary knowledge only (no photo).
Respond with ONLY compact JSON, no fences: {"a": [18 numbers 0..1, one decimal, in this exact order: ${DIMS.join(', ')}]}`;

/**
 * Score a SINGLE dish (name + cuisine in, 18 flavor numbers out). Deliberately not
 * batched: the client fires one of these per dish, several in parallel (capped —
 * see src/lib/concurrency.ts) — total wait time becomes roughly the slowest single
 * call rather than the sum of every dish, and each dish's ring can light up the
 * moment ITS call finishes instead of all-or-nothing at the end.
 */
export async function scoreOneDish(item: { name: string; cuisine: string }): Promise<DishVector> {
  const userText = `${item.name} (${item.cuisine})`;
  const text = await callClaude(SCORE_ONE_SYSTEM, userText, { maxTokens: 150 });
  const parsed = parseJsonResponse<{ a?: unknown }>(text);
  return mergeScoredAttributes(1, Array.isArray(parsed?.a) ? [parsed!.a] : null)[0];
}

/**
 * Trust nothing from the model here either: wrong length, wrong types, extra/missing
 * entries are all real possibilities. Maps by index up to the shorter of the two
 * lengths; anything unmatched gets an empty (neutral) attribute set rather than a
 * crash or a misaligned dish-to-flavor mapping.
 */
export function mergeScoredAttributes(itemCount: number, scores: unknown[] | null): DishVector[] {
  const out: DishVector[] = Array.from({ length: itemCount }, () => ({}));
  if (!Array.isArray(scores)) return out;
  const n = Math.min(itemCount, scores.length);
  for (let i = 0; i < n; i++) {
    const arr = scores[i];
    if (!Array.isArray(arr)) continue;
    const attrs: DishVector = {};
    DIMS.forEach((d, di) => {
      const v = Number(arr[di]);
      if (Number.isFinite(v) && v > 0) attrs[d] = Math.min(1, Math.max(0, v));
    });
    out[i] = attrs;
  }
  return out;
}

function sanitizeItem(raw: any): MenuItem | null {
  // Compact schema (short keys, fixed-order attr array) cuts output tokens ~55%,
  // which is the difference between finishing inside the serverless window and
  // getting killed at 60s on big menus. Long keys still accepted for back-compat.
  const name = raw?.n ?? raw?.name;
  if (!name) return null;
  const attributes: DishVector = {};
  const arr = raw?.a;
  if (Array.isArray(arr)) {
    DIMS.forEach((d, i) => {
      const v = Number(arr[i]);
      if (Number.isFinite(v) && v > 0) attributes[d] = Math.min(1, Math.max(0, v));
    });
  } else {
    for (const d of DIMS) {
      const v = Number(raw?.attributes?.[d]);
      if (Number.isFinite(v) && v > 0) attributes[d] = Math.min(1, Math.max(0, v));
    }
  }
  return {
    name: String(name),
    name_zh: (raw.z ?? raw.name_zh) ? String(raw.z ?? raw.name_zh) : null,
    name_original: String(raw.o ?? raw.name_original ?? name),
    section: raw.section ? String(raw.section) : null,
    description: raw.description ? String(raw.description) : null,
    price: (raw.p ?? raw.price) ? String(raw.p ?? raw.price) : null,
    cuisine: String(raw.c ?? raw.cuisine ?? 'unknown').toLowerCase(),
    hook: String(raw.h ?? raw.hook ?? '').slice(0, 80),
    attributes,
    confidence: Math.min(1, Math.max(0, Number(raw.f ?? raw.confidence ?? 0.5))),
  };
}

/** Demo menu so the whole flow works with no API key — clearly flagged as mock. */
function mockMenu(): MenuScanResult {
  const mk = (name: string, name_original: string, cuisine: string, hook: string, price: string, attrs: DishVector): MenuItem => ({
    name, name_zh: name_original, name_original, section: 'Demo menu', description: null, price, cuisine, hook, attributes: attrs, confidence: 0.9,
  });
  return {
    mock: true,
    menu_language: 'demo',
    restaurant_guess: 'Demo Kitchen (no vision key set)',
    items: [
      mk('Mapo tofu', '麻婆豆腐', 'sichuan', 'numbing heat, silky tofu', '$78', { spicy: 0.9, umami: 0.8, tender: 0.7, braised: 0.7, rich: 0.6, salty: 0.5 }),
      mk('Char siu', '蜜汁叉燒', 'cantonese', 'lacquered, honeyed char', '$92', { sweet: 0.7, grilled: 0.8, umami: 0.7, tender: 0.7, rich: 0.6 }),
      mk('Steamed fish', '清蒸魚', 'cantonese', 'delicate, ginger-scallion', '$168', { fresh: 0.9, steamed: 1, tender: 0.8, umami: 0.6 }),
      mk('Salt & pepper squid', '椒鹽鮮魷', 'cantonese', 'crackling crust', '$88', { crispy: 0.9, fried: 0.9, salty: 0.7, chewy: 0.5 }),
      mk('Hot & sour soup', '酸辣湯', 'chinese', 'sharp, warming', '$48', { sour: 0.8, spicy: 0.6, umami: 0.6 }),
      mk('Egg tart', '蛋撻', 'cantonese', 'flaky, wobbly custard', '$12', { sweet: 0.8, creamy: 0.8, crispy: 0.7, baked: 1, rich: 0.6 }),
    ],
  };
}

/**
 * Attribute inference for HAND-ADDED menu items (no photo involved): a text-only
 * call turning "Salt & pepper squid — crispy battered squid, HK style" into the same
 * 18-dim vector the whole taste engine runs on. Without attributes, an item can't be
 * personalized; with a mock fallback of {} it ranks neutrally rather than wrongly.
 */
export async function inferAttributesFromText(name: string, description?: string | null, cuisine?: string | null): Promise<DishVector> {
  const system = `Estimate sensory attributes of a dish from its menu text using culinary knowledge. Respond ONLY with JSON: { <only dims with presence >= 0.15, from: ${DIMS.join(', ')}>: number 0..1 }`;
  const userText = `${name}${description ? ` — ${description}` : ''}${cuisine ? ` (${cuisine})` : ''}`;
  const text = await callClaude(system, userText, { maxTokens: 300 });
  const parsed = parseJsonResponse<Record<string, unknown>>(text);
  if (!parsed) return {};

  const attrs: DishVector = {};
  for (const d of DIMS) {
    const v = Number(parsed[d]);
    if (Number.isFinite(v) && v > 0) attrs[d] = Math.min(1, Math.max(0, v));
  }
  return attrs;
}
