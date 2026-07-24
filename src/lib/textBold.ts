// Pure text→segment splitter for selective keyword bolding (the install
// layer's numbered steps: product/target nouns like "Claude"/"Project"/the
// persona name get bolded, "don't do this" nouns like "Knowledge" in "不要
// 上載到 Knowledge" don't — see tasteExport.ts's boldZh/boldEn per-step lists,
// which curate that distinction by simply omitting the negated word from a
// given step's keyword list rather than any clause-detection logic here).
// Framework-agnostic on purpose so it's testable without a DOM.
export type TextSegment = { text: string; bold: boolean };

/** Splits `text` on `keywords`, longest-first at each position so a list
 * containing both "GPT" and "GPTs" bolds the longer match instead of also
 * re-matching the substring inside it (e.g. leaving a stray "s" unbolded). */
export function splitBoldKeywords(text: string, keywords: string[]): TextSegment[] {
  const active = keywords.filter(Boolean);
  if (active.length === 0) return [{ text, bold: false }];
  const sorted = [...active].sort((a, b) => b.length - a.length);
  const pattern = sorted.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(${pattern})`, 'g');
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[0], bold: true });
    lastIndex = match.index + match[0].length;
    if (match[0].length === 0) re.lastIndex++; // guard against a zero-length keyword looping forever
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false });
  return segments;
}
