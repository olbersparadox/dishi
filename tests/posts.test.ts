import { describe, it, expect } from 'vitest';
import { normalizeReason, POST_REASON_MAX } from '../src/lib/posts';

// 貼文 — the reason line. A post with no words is still a post, so "absent" is
// a value here, not an error.

describe('normalizeReason', () => {
  it('treats blank input as no reason at all', () => {
    expect(normalizeReason('')).toBeNull();
    expect(normalizeReason('   ')).toBeNull();
    expect(normalizeReason('\n\t')).toBeNull();
    expect(normalizeReason(undefined)).toBeNull();
    expect(normalizeReason(null)).toBeNull();
    expect(normalizeReason(42)).toBeNull();
  });

  it('collapses whitespace so a pasted paragraph cannot restyle the public page', () => {
    expect(normalizeReason('  肥瘦   啱啱\n\n好  ')).toBe('肥瘦 啱啱 好');
  });

  it('caps at a line, not a review', () => {
    const long = 'a'.repeat(400);
    expect(normalizeReason(long)).toHaveLength(POST_REASON_MAX);
    expect(POST_REASON_MAX).toBe(140);
  });
});
