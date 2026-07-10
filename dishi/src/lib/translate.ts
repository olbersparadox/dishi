import { callClaude } from './openrouter';
import { CJK } from './i18n-dict';

const SYSTEM = `You translate a single restaurant dish name between English and Traditional
Chinese, for a food app's bilingual dish listing. Respond with ONLY the translated
name — no quotes, no explanation, no punctuation beyond what belongs in the name
itself. Prefer how the dish is actually known/marketed (e.g. common menu phrasing)
over a literal word-for-word translation.`;

/**
 * Translates a dish name to the OTHER language, auto-detecting direction from the
 * input's script. Used for auto-fill on rename (edit the Chinese name, English
 * fills in automatically) — always a suggestion the field can still be freely
 * overridden, never a forced replacement.
 *
 * Returns null on any failure (no key configured, model error, empty response) so
 * callers can fail silently — a missed auto-fill is a minor inconvenience, never
 * something that should block saving a rename the user already typed themselves.
 */
export async function translateDishName(text: string): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const isChinese = CJK.test(trimmed);
  const instruction = isChinese
    ? `Translate this Traditional Chinese dish name to English: ${trimmed}`
    : `Translate this English dish name to Traditional Chinese: ${trimmed}`;

  const result = await callClaude(SYSTEM, instruction, { maxTokens: 60 });
  const cleaned = result?.trim().replace(/^["']|["']$/g, '');
  return cleaned || null;
}
