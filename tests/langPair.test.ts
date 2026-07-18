import { describe, it, expect, vi } from 'vitest';
import {
  chromeLangOf, menuLanguageToCode, dishNameKey, resolveNamePair,
  CANONICAL_PAIR, isCanonical, LANGUAGES, type LangPair,
} from '../src/lib/i18n-dict';

// ── chrome language derivation ──────────────────────────────────────────────────
describe('chromeLangOf', () => {
  it('is zh when either slot is 中文, else en', () => {
    expect(chromeLangOf({ primary: 'zh', secondary: 'en' })).toBe('zh');
    expect(chromeLangOf({ primary: 'en', secondary: 'zh' })).toBe('zh');
    expect(chromeLangOf({ primary: 'zh', secondary: 'ja' })).toBe('zh');
    expect(chromeLangOf({ primary: 'ja', secondary: 'en' })).toBe('en');
    expect(chromeLangOf({ primary: 'ja', secondary: 'ko' })).toBe('en'); // no zh -> en
  });
});

describe('canonical set', () => {
  it('is exactly zh + en', () => {
    expect([...CANONICAL_PAIR].sort()).toEqual(['en', 'zh']);
    expect(isCanonical('zh')).toBe(true);
    expect(isCanonical('en')).toBe(true);
    expect(isCanonical('ja')).toBe(false);
  });
  it('lists the canonical pair first and every language self-named', () => {
    expect(LANGUAGES.slice(0, 2).map(l => l.code)).toEqual(['zh', 'en']);
    expect(LANGUAGES.find(l => l.code === 'ja')?.label).toBe('日本語');
  });
});

// ── menu_language mapping ───────────────────────────────────────────────────────
describe('menuLanguageToCode', () => {
  it('maps display languages and rejects the rest', () => {
    expect(menuLanguageToCode('japanese')).toBe('ja');
    expect(menuLanguageToCode('Japanese')).toBe('ja');
    expect(menuLanguageToCode('cantonese')).toBe('zh');
    expect(menuLanguageToCode('english')).toBe('en');
    expect(menuLanguageToCode('unknown')).toBeNull();
    expect(menuLanguageToCode('mixed')).toBeNull();
    expect(menuLanguageToCode('klingon')).toBeNull();
    expect(menuLanguageToCode(null)).toBeNull();
  });
});

describe('dishNameKey', () => {
  it('is stable from the canonical identity', () => {
    expect(dishNameKey({ name: 'Har gow', name_zh: '蝦餃' })).toBe('蝦餃|Har gow');
    expect(dishNameKey({ name: 'Har gow' })).toBe('|Har gow');
  });
});

// ── pair resolution ─────────────────────────────────────────────────────────────
const names = { en: 'Braised Pork Belly', zh: '金錢肚' };
const none = () => undefined;

describe('resolveNamePair', () => {
  it('canonical pair -> both canonical names', () => {
    const r = resolveNamePair({ pair: { primary: 'zh', secondary: 'en' }, chromeLang: 'zh', ...names, translated: none });
    expect(r).toEqual({ primary: '金錢肚', secondary: 'Braised Pork Belly' });
  });

  it('uses a cached translation for a non-canonical slot', () => {
    const r = resolveNamePair({
      pair: { primary: 'zh', secondary: 'ja' }, chromeLang: 'zh', ...names,
      translated: (c) => (c === 'ja' ? '豚バラ肉の醤油煮込み' : undefined),
    });
    expect(r).toEqual({ primary: '金錢肚', secondary: '豚バラ肉の醤油煮込み' });
  });

  it('falls back to the chrome-language canonical while a translation is missing', () => {
    // pair {ja, en} -> chrome en. ja not cached -> primary falls back to en; secondary
    // en too -> identical -> collapses to en alone (canonical shows first).
    const r = resolveNamePair({ pair: { primary: 'ja', secondary: 'en' }, chromeLang: 'en', ...names, translated: none });
    expect(r).toEqual({ primary: 'Braised Pork Belly', secondary: undefined });
  });

  it('collapses to primary only when both slots resolve identically', () => {
    const r = resolveNamePair({ pair: { primary: 'zh', secondary: 'ja' }, chromeLang: 'zh', ...names, translated: none });
    // ja missing -> falls back to zh, which equals the primary -> dropped
    expect(r.primary).toBe('金錢肚');
    expect(r.secondary).toBeUndefined();
  });

  it('FIDELITY: a slot in the menu language renders the printed original, not a translation', () => {
    const r = resolveNamePair({
      pair: { primary: 'zh', secondary: 'ja' }, chromeLang: 'zh', ...names,
      translated: () => 'このキャッシュは無視される', // a cached ja value exists...
      nameOriginal: '特選ロースかつ膳', menuLanguage: 'ja',
    });
    expect(r.secondary).toBe('特選ロースかつ膳'); // ...but fidelity wins: printed text verbatim
  });

  it('preset: a foreign menu code becomes the secondary and shows the original', () => {
    // scan of a Japanese menu with the default pair -> menuLanguageToCode + the
    // scan page's "not in pair" check make ja the secondary; fidelity renders name_original.
    const menuCode = menuLanguageToCode('japanese')!;
    const pair: LangPair = { primary: 'zh', secondary: menuCode };
    const r = resolveNamePair({ pair, chromeLang: 'zh', ...names, nameOriginal: '特選ロースかつ膳', menuLanguage: menuCode, translated: none });
    expect(r).toEqual({ primary: '金錢肚', secondary: '特選ロースかつ膳' });
  });
});

// ── translation batching + prompt hardening (model mocked) ──────────────────────
vi.mock('../src/lib/openrouter', () => ({
  callClaude: vi.fn(async () => '{"k1":"豚バラ肉","k2":"エッグタルト"}'),
  parseJsonResponse: (raw: string | null) => { try { return JSON.parse(raw ?? ''); } catch { return null; } },
}));

describe('translateNames', () => {
  it('batches all items into ONE model call and keys the result', async () => {
    const { translateNames } = await import('../src/lib/nameTranslate');
    const { callClaude } = await import('../src/lib/openrouter');
    (callClaude as any).mockClear();
    const out = await translateNames(
      [{ key: 'k1', name: 'Pork Belly', name_zh: '金錢肚' }, { key: 'k2', name: 'egg tart', name_zh: '蛋撻' }],
      'ja',
    );
    expect(out).toEqual({ k1: '豚バラ肉', k2: 'エッグタルト' });
    expect((callClaude as any)).toHaveBeenCalledTimes(1); // one batched call, not one per item
  });

  it('never calls the model for a canonical language or an empty batch', async () => {
    const { translateNames } = await import('../src/lib/nameTranslate');
    const { callClaude } = await import('../src/lib/openrouter');
    (callClaude as any).mockClear();
    expect(await translateNames([{ key: 'k', name: 'x', name_zh: 'x' }], 'en')).toEqual({});
    expect(await translateNames([], 'ja')).toEqual({});
    expect((callClaude as any)).not.toHaveBeenCalled();
  });
});

describe('prompt hardening', () => {
  it('translation guidance forbids wrong-script output and names ja/zh false friends', async () => {
    const { TRANSLATE_GUIDANCE, buildTranslatePrompt, ZH_FROM_MENU_GUIDANCE } = await import('../src/lib/nameTranslate');
    for (const text of [TRANSLATE_GUIDANCE, buildTranslatePrompt('ja'), ZH_FROM_MENU_GUIDANCE]) {
      expect(text.toLowerCase()).toContain('katakana');
      expect(text).toContain('春雨');
      expect(text).toContain('人参');
    }
  });
});
