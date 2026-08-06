import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/lib/openrouter', () => ({
  callClaude: vi.fn(),
  imagePart: (base64: string, mediaType: string) => ({ kind: 'image', base64, mediaType }),
  textPart: (text: string) => ({ kind: 'text', text }),
  parseJsonResponse: (raw: string | null) => {
    if (!raw) return null;
    try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); } catch { return null; }
  },
}));
import { callClaude } from '../src/lib/openrouter';
import { inferDish } from '../src/lib/vision';
import { DIET_RECHECK_LINE } from '../src/lib/menuScan';

/** A full vision answer, overridable per case. */
const answer = (over: Record<string, unknown> = {}) => JSON.stringify({
  is_dish: true, name: 'Soy-Poached Chicken Thigh and Belly Rice', name_zh: '油雞髀腩仔飯',
  cuisine: 'cantonese', confidence: 0.95, ingredients: ['chicken', 'rice', 'ginger'],
  diet: ['chicken'], cooking_method: 'braised', heaviness: 'medium', attributes: { umami: 0.7 },
  ...over,
});

/** Text of the nth call's user turn (the tripwire nudge rides here, not on SYSTEM). */
const userTextOf = (n: number) =>
  (vi.mocked(callClaude).mock.calls[n][1] as any[]).find(p => p.kind === 'text').text as string;
const optsOf = (n: number) => vi.mocked(callClaude).mock.calls[n][2] as any;

// The diet tripwire guarded menu-scan enrichment from the day it was written, but
// nothing ever wired it to PHOTO logging — the path that logs most dishes. That gap
// is how 油雞髀腩仔飯 reached the journal twice with no pork flag while 腩仔 sat in
// its name. These pin the wiring, not the checker (dietFlags.test.ts owns that).
describe('inferDish — the diet tripwire runs on the photo path', () => {
  beforeEach(() => {
    vi.mocked(callClaude).mockReset();
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('re-asks ONCE when the name says 腩仔 and the flags deny pork', async () => {
    vi.mocked(callClaude)
      .mockResolvedValueOnce(answer())                                  // pork missing
      .mockResolvedValueOnce(answer({ diet: ['pork', 'chicken'] }));    // corrected

    const out = await inferDish('BASE64', 'image/jpeg');

    expect(vi.mocked(callClaude)).toHaveBeenCalledTimes(2);
    expect(out.diet).toEqual(['pork', 'chicken']);
    // The nudge is appended to the user turn, leaving SYSTEM byte-identical —
    // the arrangement the naming R&D measured and the scan pipeline's rule
    // against per-item system-prompt edits both require.
    expect(userTextOf(1)).toContain(DIET_RECHECK_LINE);
    expect(userTextOf(0)).not.toContain(DIET_RECHECK_LINE);
  });

  it('does not re-ask when the answer is self-consistent', async () => {
    vi.mocked(callClaude).mockResolvedValueOnce(
      answer({ diet: ['pork', 'chicken'], ingredients: ['chicken', 'pork belly', 'rice'] }),
    );
    const out = await inferDish('BASE64', 'image/jpeg');
    expect(vi.mocked(callClaude)).toHaveBeenCalledTimes(1);
    expect(out.diet).toEqual(['pork', 'chicken']);
  });

  // Fail closed: a tripwire is advisory, so a failed re-ask must never cost the
  // user the identification they already waited for.
  it('keeps the first answer when the re-ask fails', async () => {
    vi.mocked(callClaude)
      .mockResolvedValueOnce(answer())
      .mockResolvedValueOnce(null);
    const out = await inferDish('BASE64', 'image/jpeg');
    expect(vi.mocked(callClaude)).toHaveBeenCalledTimes(2);
    expect(out.diet).toEqual(['chicken']);
    expect(out.name_zh).toBe('油雞髀腩仔飯');
  });

  // Whatever the re-ask returns is FINAL, matching enrichOneDish exactly: 菠蘿包
  // is entitled to keep its no-pineapple answer rather than be asked forever.
  it('accepts a re-ask that stands its ground', async () => {
    vi.mocked(callClaude)
      .mockResolvedValueOnce(answer())
      .mockResolvedValueOnce(answer());
    const out = await inferDish('BASE64', 'image/jpeg');
    expect(vi.mocked(callClaude)).toHaveBeenCalledTimes(2);
    expect(out.diet).toEqual(['chicken']);
  });

  // Identification is extraction: the same plate should read the same way twice.
  // Unset, these calls sampled at the provider default of 1.0 — which is how one
  // dish came back braised one day and steamed the next.
  it('pins sampling on both the first call and the re-ask', async () => {
    vi.mocked(callClaude)
      .mockResolvedValueOnce(answer())
      .mockResolvedValueOnce(answer({ diet: ['pork', 'chicken'] }));
    await inferDish('BASE64', 'image/jpeg');
    expect(optsOf(0).temperature).toBe(0);
    expect(optsOf(1).temperature).toBe(0);
  });
});
