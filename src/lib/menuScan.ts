import { DIMS, DishVector } from './taste';
import { callClaude, imagePart, textPart, parseJsonResponse } from './openrouter';

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

Menus are messy: multiple columns, section headers, prices in odd places, mixed languages (especially Chinese + English), specials taped on, glare, handwriting. Work through the layout systematically — left column top to bottom, then right, section by section. Do not skip items because they're partially legible; extract them with lower confidence instead. Do not invent items that aren't visible.

For each dish, estimate its sensory attributes from culinary knowledge (a 麻婆豆腐 is spicy ~0.9, umami ~0.8, tender ~0.7, braised ~0.7 even though the menu doesn't say so).

Respond with ONLY a JSON object, no markdown fences:
{"menu_language": string, "restaurant_guess": string|null (from logo/header if visible),
 "items": [{
   "name": string (English; translate if needed),
   "name_zh": string (Traditional Chinese; translate if needed),
   "name_original": string (exactly as printed),
   "section": string|null,
   "description": string|null (as printed, else null),
   "price": string|null (exactly as printed, e.g. "$88", "£12.50"),
   "cuisine": string (lowercase),
   "hook": string (<=8 words, the most distinctive sensory thing about this dish),
   "confidence": number 0..1,
   "attributes": { <only dims with presence >= 0.15, from: ${DIMS.join(', ')}>: number 0..1 }
 }]}
Omit near-zero attributes to keep output compact. Extract at most 40 items; if the menu has more, prefer mains and signatures over drinks and sides.`;

export async function scanMenu(base64: string, mediaType: string): Promise<MenuScanResult> {
  const text = await callClaude(SYSTEM, [
    imagePart(base64, mediaType),
    textPart('Extract every dish from this menu.'),
  ], { maxTokens: 4000 });

  const parsed = parseJsonResponse<{ items?: any[]; menu_language?: string; restaurant_guess?: string }>(text);
  if (!parsed) return mockMenu();

  const items: MenuItem[] = (parsed.items ?? []).map((raw: any) => sanitizeItem(raw)).filter(Boolean) as MenuItem[];
  if (items.length === 0) return { items: [], menu_language: 'unknown', restaurant_guess: null, mock: false };
  return {
    items,
    menu_language: String(parsed.menu_language ?? 'unknown'),
    restaurant_guess: parsed.restaurant_guess ? String(parsed.restaurant_guess) : null,
    mock: false,
  };
}

function sanitizeItem(raw: any): MenuItem | null {
  if (!raw?.name) return null;
  const attributes: DishVector = {};
  for (const d of DIMS) {
    const v = Number(raw?.attributes?.[d]);
    if (Number.isFinite(v) && v > 0) attributes[d] = Math.min(1, Math.max(0, v));
  }
  return {
    name: String(raw.name),
    name_zh: raw.name_zh ? String(raw.name_zh) : null,
    name_original: String(raw.name_original ?? raw.name),
    section: raw.section ? String(raw.section) : null,
    description: raw.description ? String(raw.description) : null,
    price: raw.price ? String(raw.price) : null,
    cuisine: String(raw.cuisine ?? 'unknown').toLowerCase(),
    hook: String(raw.hook ?? '').slice(0, 80),
    attributes,
    confidence: Math.min(1, Math.max(0, Number(raw.confidence ?? 0.5))),
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
