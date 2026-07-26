import { describe, it, expect } from 'vitest';
import {
  normalizeUsername, validateUsername, renamesLeft, hasClaimedUsername,
  USERNAME_CHANGES_ALLOWED,
} from '../src/lib/username';

describe('normalizeUsername', () => {
  it('lowercases and trims so case can never fork one name into two people', () => {
    expect(normalizeUsername('  Jerry  ')).toBe('jerry');
    expect(normalizeUsername('JERRY')).toBe('jerry');
  });
});

describe('validateUsername', () => {
  it('accepts an ordinary name', () => {
    expect(validateUsername('jerry')).toBeNull();
    expect(validateUsername('jerry_chu')).toBeNull();
    expect(validateUsername('foodie88')).toBeNull();
  });

  it('validates the NORMALIZED form, so typed case and spaces pass', () => {
    expect(validateUsername('  Jerry_Chu ')).toBeNull();
  });

  it('reports length problems as themselves — that is the actionable fix', () => {
    expect(validateUsername('')).toBe('empty');
    expect(validateUsername('   ')).toBe('empty');
    expect(validateUsername('ab')).toBe('tooshort');
    expect(validateUsername('a'.repeat(21))).toBe('toolong');
    expect(validateUsername('a'.repeat(20))).toBeNull();
    expect(validateUsername('abc')).toBeNull();
  });

  it('requires a leading letter so a username can never read as an id', () => {
    expect(validateUsername('1jerry')).toBe('shape');
    expect(validateUsername('_jerry')).toBe('shape');
  });

  it('rejects anything that would break a URL path', () => {
    expect(validateUsername('jerry chu')).toBe('shape');
    expect(validateUsername('jerry.chu')).toBe('shape');
    expect(validateUsername('jerry-chu')).toBe('shape');
    expect(validateUsername('jerry/chu')).toBe('shape');
    // Chinese is fine for display_name (which stays free-form) but not for a
    // URL path — long enough to clear the length check, so this really is the
    // charset rule rejecting it.
    expect(validateUsername('食家阿豬')).toBe('shape');
  });

  it('reserves routes the app owns and names that impersonate the product', () => {
    expect(validateUsername('api')).toBe('reserved');
    expect(validateUsername('dishi')).toBe('reserved');
    expect(validateUsername('admin')).toBe('reserved');
    expect(validateUsername('table')).toBe('reserved');
    // the export doc's intent-landing route (BACKLOG 1b) must stay claimable
    // by the app, but it is 1 char so the length rule catches it first
    expect(validateUsername('i')).toBe('tooshort');
    // reserved matching is case-insensitive because validation normalizes first
    expect(validateUsername('Dishi')).toBe('reserved');
  });
});

describe('rename budget', () => {
  it('starts with exactly one change available', () => {
    expect(USERNAME_CHANGES_ALLOWED).toBe(1);
    expect(renamesLeft(0)).toBe(1);
    expect(renamesLeft(null)).toBe(1);
    expect(renamesLeft(undefined)).toBe(1);
  });

  it('is spent after one rename and never goes negative', () => {
    expect(renamesLeft(1)).toBe(0);
    expect(renamesLeft(5)).toBe(0);
  });
});

describe('hasClaimedUsername', () => {
  it('treats a legacy auto-handle as UNCLAIMED so the naming moment still fires', () => {
    // profiles.handle is non-empty for every existing user (email local part),
    // so "has a handle" must never be read as "chose a username".
    expect(hasClaimedUsername(null)).toBe(false);
    expect(hasClaimedUsername(undefined)).toBe(false);
    expect(hasClaimedUsername('2026-07-26T00:00:00Z')).toBe(true);
  });
});
