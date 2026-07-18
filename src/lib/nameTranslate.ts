// Batch dish-name translation for the 語言對 globe picker. Presentation only —
// name (en) + name_zh (zh) stay the canonical identity; this produces display names
// for the OTHER languages, cached by the caller.
//
// The prompt hardening here is folded in from the Japanese-menu test: a target-
// language name must be REAL target language (translate by MEANING, never pass CJK
// through unread), with the kanji false-friends that trip machine translation
// between ja and zh called out explicitly.
import { callClaude, parseJsonResponse } from './openrouter';
import { languageLabel, isCanonical, type LangCode } from './i18n-dict';

export type TranslateItem = { key: string; name: string; name_zh?: string | null };

/** Shared guidance — exported so a test can assert the hardening is present. */
export const TRANSLATE_GUIDANCE = `Translate each dish name by MEANING into the target language, the way a native menu in that language would print it — never transliterate or pass characters through unread.
- The output for a language MUST be written in that language's own script: no kana/katakana or hangul may appear in a Chinese name; Chinese characters must never survive untranslated into a Japanese or Korean name; etc.
- Kanji false friends between Japanese and Chinese (translate the DISH, not the characters): 春雨 = 粉絲 (not 春天的雨); 人参 = 紅蘿蔔; 大根 = 白蘿蔔; 玉子 = 蛋; Japanese 湯 = hot water, NOT soup.
- Chinese output is Traditional, HONG KONG register (吉列豬扒定食, 烏冬, 天婦羅, 刺身), not Mainland/Taiwan terms.
- Figurative names translate by the actual dish, not the literal characters (e.g. 菠蘿包 is a pineapple-less "pineapple bun").`;

/** Build the system prompt for a target language. */
export function buildTranslatePrompt(lang: LangCode): string {
  return `You translate Hong Kong restaurant dish names into ${languageLabel(lang)}.
Input is a JSON array of items: [{"key": string, "name": English name, "name_zh": Traditional Chinese name}].
For each item, produce its dish name in ${languageLabel(lang)}.
${TRANSLATE_GUIDANCE}
Respond with ONLY a compact JSON object mapping each item's "key" to its ${languageLabel(lang)} name, no markdown fences: {"<key>": "<translated name>", ...}.`;
}

/**
 * Translate a batch of dish names into one target language in a SINGLE LLM call.
 * Returns a map keyed by each item's `key`. Canonical languages (zh/en) are never
 * translated — the caller already has those. Fails soft: on any error returns {},
 * so callers fall back to the canonical name.
 */
export async function translateNames(items: TranslateItem[], lang: LangCode): Promise<Record<string, string>> {
  if (isCanonical(lang) || items.length === 0) return {};
  const payload = items.map(i => ({ key: i.key, name: i.name, name_zh: i.name_zh ?? '' }));
  const text = await callClaude(buildTranslatePrompt(lang), JSON.stringify(payload), { maxTokens: 40 + items.length * 40, expectJson: true });
  const parsed = parseJsonResponse<Record<string, unknown>>(text);
  if (!parsed) return {};
  const out: Record<string, string> = {};
  for (const i of items) {
    const v = parsed[i.key];
    if (typeof v === 'string' && v.trim()) out[i.key] = v.trim();
  }
  return out;
}
