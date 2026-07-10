import { describe, it, expect } from 'vitest';
import { salvageJsonObjects } from '../src/lib/jsonSalvage';

describe('salvageJsonObjects', () => {
  it('recovers every item from a fully valid array (nothing to salvage, but still correct)', () => {
    const raw = '{"items":[{"n":"A"},{"n":"B"},{"n":"C"}]}';
    expect(salvageJsonObjects(raw, 'items')).toEqual([{ n: 'A' }, { n: 'B' }, { n: 'C' }]);
  });

  it('recovers complete objects and stops cleanly at a truncation mid-object', () => {
    // Third object cut off mid-way — exactly the real production failure shape.
    const raw = '{"menu_language":"zh","items":[{"n":"A","p":"$10"},{"n":"B","p":"$20"},{"n":"C","p":"$3';
    expect(salvageJsonObjects(raw, 'items')).toEqual([{ n: 'A', p: '$10' }, { n: 'B', p: '$20' }]);
  });

  it('stops at truncation even mid-key, before any quote closes', () => {
    const raw = '{"items":[{"n":"A"},{"n":"B"},{"n":"C","hoo';
    expect(salvageJsonObjects(raw, 'items')).toEqual([{ n: 'A' }, { n: 'B' }]);
  });

  it('handles a string value containing braces/brackets without miscounting depth', () => {
    const raw = '{"items":[{"n":"Fried rice {special}"},{"n":"B"}]}';
    expect(salvageJsonObjects(raw, 'items')).toEqual([{ n: 'Fried rice {special}' }, { n: 'B' }]);
  });

  it('handles escaped quotes inside strings without breaking the string-tracking', () => {
    const raw = '{"items":[{"n":"The \\"Special\\""},{"n":"B"}]}';
    expect(salvageJsonObjects(raw, 'items')).toEqual([{ n: 'The "Special"' }, { n: 'B' }]);
  });

  it('returns an empty array when the key never appears', () => {
    expect(salvageJsonObjects('{"other":[]}', 'items')).toEqual([]);
  });

  it('returns an empty array when truncation happens before even one object closes', () => {
    const raw = '{"items":[{"n":"A","desc":"this never clo';
    expect(salvageJsonObjects(raw, 'items')).toEqual([]);
  });

  it('returns an empty array for garbage input', () => {
    expect(salvageJsonObjects('not json at all', 'items')).toEqual([]);
    expect(salvageJsonObjects('', 'items')).toEqual([]);
  });

  it('handles an empty array', () => {
    expect(salvageJsonObjects('{"items":[]}', 'items')).toEqual([]);
  });

  it('handles nested objects within an item without losing them', () => {
    const raw = '{"items":[{"n":"A","meta":{"x":1,"y":2}},{"n":"B"}]}';
    expect(salvageJsonObjects(raw, 'items')).toEqual([{ n: 'A', meta: { x: 1, y: 2 } }, { n: 'B' }]);
  });
});
