import { describe, it, expect } from 'vitest';
import { splitBoldKeywords } from '../src/lib/textBold';

describe('splitBoldKeywords', () => {
  it('returns the whole text unbolded when there are no keywords', () => {
    expect(splitBoldKeywords('開啟 Claude，建立新 Project', [])).toEqual([
      { text: '開啟 Claude，建立新 Project', bold: false },
    ]);
  });

  it('bolds a single keyword, splitting the surrounding text', () => {
    expect(splitBoldKeywords('開啟 Claude，建立新 Project', ['Claude'])).toEqual([
      { text: '開啟 ', bold: false },
      { text: 'Claude', bold: true },
      { text: '，建立新 Project', bold: false },
    ]);
  });

  it('bolds multiple non-overlapping keywords in one pass', () => {
    expect(splitBoldKeywords('開啟 Claude，建立新 Project', ['Claude', 'Project'])).toEqual([
      { text: '開啟 ', bold: false },
      { text: 'Claude', bold: true },
      { text: '，建立新 ', bold: false },
      { text: 'Project', bold: true },
    ]);
  });

  it('prefers the LONGER keyword at a shared prefix — "GPTs" over "GPT"', () => {
    const segs = splitBoldKeywords('去 GPTs 建立自訂 GPT', ['GPT', 'GPTs']);
    const bolded = segs.filter(s => s.bold).map(s => s.text);
    expect(bolded).toEqual(['GPTs', 'GPT']); // GPTs matched whole, not "GPT" + stray "s"
  });

  it('never bolds a keyword absent from the list — the "don\'t do this" case', () => {
    // Knowledge is deliberately never passed for this step (tasteExport.ts's
    // ChatGPT boldZh/boldEn) — this pins that omission is sufficient on its own.
    const segs = splitBoldKeywords('不要上載到 Knowledge，放錯位只會記得事實', ['「Instructions」']);
    expect(segs.every(s => !s.bold)).toBe(true);
  });

  it('bolds an interpolated persona name token as a whole unit', () => {
    expect(splitBoldKeywords('命名為 dishi.Spoon', ['dishi.Spoon'])).toEqual([
      { text: '命名為 ', bold: false },
      { text: 'dishi.Spoon', bold: true },
    ]);
  });

  it('is safe against regex-special characters in a keyword (e.g. Chinese corner quotes are literal, not special, but guard anyway)', () => {
    expect(() => splitBoldKeywords('a (b) c', ['(b)'])).not.toThrow();
    expect(splitBoldKeywords('a (b) c', ['(b)']).filter(s => s.bold).map(s => s.text)).toEqual(['(b)']);
  });

  it('bolds every occurrence of a repeated keyword', () => {
    const segs = splitBoldKeywords('GPT 同 GPT 都得', ['GPT']);
    expect(segs.filter(s => s.bold)).toHaveLength(2);
  });
});
