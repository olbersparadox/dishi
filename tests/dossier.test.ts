import { describe, it, expect } from 'vitest';
import { projectDossier, DOSSIER_KNOWS_AT } from '../src/lib/dossier';
import { MEANINGFUL_THRESHOLD, STRONG_THRESHOLD } from '../src/lib/tasteExport';

// The public dossier's privacy contract (decision 3). These tests pin what the
// page may NEVER show; the projection is the single gate every rendered field
// and every copy-for-AI byte passes through.

const raw = {
  username: 'jerry_c',
  version: 2,
  ratingCount: 30,
  vector: { umami: 0.7, rich: 0.6, tender: 0.3, sweet: -0.3, bitter: -0.6, fresh: 0.1 },
  evidence: { umami: 5, rich: 4, tender: 2, sweet: 3, bitter: 1 },
  affinity: { cantonese: 0.8, sichuan: 0.4, thai: -0.2 },
  // Anchors are POSTS now — each one an explicit publish, so the fixture
  // carries what a post carries: a reason, a post date, and any verdict.
  anchors: [
    { name: 'Char siu', name_zh: '叉燒', restaurant: '再興', photo_url: 'https://example.com/charsiu.jpg', eaten_at: '2026-06-28T12:00:00Z', posted_at: '2026-07-20T00:00:00Z', reason: '肥瘦啱啱好', score: 0.9 },
    { name: 'Beef chow fun', name_zh: '乾炒牛河', restaurant: '新記', eaten_at: '2026-07-12T12:00:00Z', posted_at: '2026-07-26T00:00:00Z', reason: null, score: 0.95 },
    { name: 'Natto', name_zh: null, restaurant: '金冠', eaten_at: null, posted_at: '2026-07-27T00:00:00Z', reason: null, score: -0.9 },
    { name: 'Plain congee', name_zh: null, restaurant: null, eaten_at: null, posted_at: '2026-07-18T00:00:00Z', reason: null, score: 0.1 },
  ],
  hideRestaurants: false,
};

describe('projectDossier — the privacy contract', () => {
  it('dates die at the projection — raw rows carry them, the output cannot', () => {
    const d = projectDossier(raw);
    // Structural: no field in the output type holds a date, so serializing the
    // whole projection must not contain either raw timestamp. Post dates are
    // as private as meal dates — they order the list and then die with it.
    const json = JSON.stringify(d);
    expect(json).not.toContain('2026-06-28');
    expect(json).not.toContain('2026-07-12');
    expect(json).not.toContain('2026-07-20');
    expect(json).not.toContain('eaten');
    expect(json).not.toContain('posted_at');
  });

  it('every posted dish survives, whatever the verdict — the post IS the consent', () => {
    const d = projectDossier(raw);
    // No score filter: filtering would swallow a post the person deliberately
    // made. Negative posts were opened by the owner 2026-07-28 precisely
    // because per-dish opt-in is a consent the old blanket source couldn't give.
    expect(d.anchors.map(a => a.name)).toContain('Natto');       // score -0.9
    expect(d.anchors.map(a => a.name)).toContain('Plain congee'); // score 0.1
    expect(d.anchors).toHaveLength(4);
  });

  it('newest post first — a publishing surface, not a leaderboard', () => {
    const d = projectDossier(raw);
    // Score-sorting would bury the negative post under the loves and quietly
    // undo the owner's call.
    expect(d.anchors.map(a => a.name)).toEqual(['Natto', 'Beef chow fun', 'Char siu', 'Plain congee']);
  });

  it('the verdict rides with every anchor, so a published dislike cannot read as praise', () => {
    const d = projectDossier(raw);
    const byName = new Map(d.anchors.map(a => [a.name, a]));
    expect(byName.get('Natto')!.verdict).toBe('flick.never');        // -0.9
    expect(byName.get('Beef chow fun')!.verdict).toBe('flick.inhaled'); // 0.95
    expect(byName.get('Plain congee')!.verdict).toBe('flick.fine');  // 0.1
    // The word, never the number: no raw score reaches the page.
    expect(JSON.stringify(d.anchors)).not.toContain('0.95');
  });

  it('the reason is published verbatim, and absent when there is none', () => {
    const d = projectDossier(raw);
    const byName = new Map(d.anchors.map(a => [a.name, a]));
    expect(byName.get('Char siu')!.reason).toBe('肥瘦啱啱好');
    expect(byName.get('Natto')!.reason).toBeNull();
  });

  it('the hide-restaurants toggle strips every restaurant string, nothing else', () => {
    const d = projectDossier({ ...raw, hideRestaurants: true });
    expect(d.anchors.length).toBe(4);
    expect(d.anchors.every(a => a.restaurant === null)).toBe(true);
    expect(JSON.stringify(d)).not.toContain('再興');
    expect(JSON.stringify(d)).not.toContain('新記');
    // "Nothing else" is the point of this test: a food photo names no place,
    // so it must survive the same toggle that strips the restaurant string.
    const charSiu = d.anchors.find(a => a.name === 'Char siu')!;
    expect(charSiu.photo_url).toBe('https://example.com/charsiu.jpg');
  });

  it("the photo travels with a posted dish (owner call 2026-07-28 — photo-forward cards), and is null when there is none", () => {
    const d = projectDossier(raw);
    const byName = new Map(d.anchors.map(a => [a.name, a]));
    expect(byName.get('Char siu')!.photo_url).toBe('https://example.com/charsiu.jpg');
    expect(byName.get('Beef chow fun')!.photo_url).toBeNull(); // fixture carries none
  });

  it('dimension chips use the SAME thresholds as the export doc — one definition of "a preference"', () => {
    const d = projectDossier(raw);
    expect(d.loves).toEqual(['umami', 'rich', 'tender']);   // >= 0.25, desc
    expect(d.strongLoves).toEqual(['umami', 'rich']);       // >= 0.55
    expect(d.avoids).toEqual(['bitter', 'sweet']);          // <= -0.25, most-avoided first
    expect(d.loves).not.toContain('fresh');                 // 0.1 = noise, not preference
    expect(MEANINGFUL_THRESHOLD).toBe(0.25);
    expect(STRONG_THRESHOLD).toBe(0.55);
  });

  it('識 N 味 uses the buddy card\'s own bar (evidence >= 3) so the two surfaces agree', () => {
    const d = projectDossier(raw);
    expect(DOSSIER_KNOWS_AT).toBe(3);
    expect(d.knowsCount).toBe(3); // umami 5, rich 4, sweet 3 — tender 2 and bitter 1 don't count
  });

  it('one dish appears ONCE — two rows of the same dish at one place is a glitch, not enthusiasm', () => {
    const d = projectDossier({
      ...raw,
      anchors: [
        { name: 'sushi platter', name_zh: '壽司拼盤', restaurant: 'Tsumura', eaten_at: null, posted_at: '2026-07-26T00:00:00Z', score: 0.9 },
        { name: 'sushi platter', name_zh: '壽司拼盤', restaurant: 'Tsumura', eaten_at: null, posted_at: '2026-07-20T00:00:00Z', score: 0.7 },
        { name: 'sushi platter', name_zh: '壽司拼盤', restaurant: 'Ok Sushi', eaten_at: null, posted_at: '2026-07-22T00:00:00Z', score: 0.6 },
      ],
    });
    // Same dish same place collapses to its most recent post; elsewhere stays.
    expect(d.anchors).toHaveLength(2);
    expect(d.anchors[0].restaurant).toBe('Tsumura');
    expect(d.anchors[1].restaurant).toBe('Ok Sushi');
  });

  it('positive-affinity cuisines only, capped', () => {
    const d = projectDossier(raw);
    expect(d.cuisines).toEqual(['cantonese', 'sichuan']);
    expect(d.cuisines).not.toContain('thai');
  });
});

describe('no copy-for-AI path (owner call 2026-07-28, amending decision 3)', () => {
  it('exposes NO text-builder — the guardrail on that text was unenforceable', async () => {
    // The dossier briefly emitted third-person text for a friend's own AI,
    // carrying one line asking that AI not to fold it into what it knows about
    // its reader. That is a standing behavioural instruction — the exact
    // category Phase 0.5 measured hosts REFUSING while accepting the data, so
    // the payload would land and the protection wouldn't. Hard rule 1 is
    // enforceable inside Dishi (no import path exists) and not inside someone
    // else's host. A friend who trusts this palate should reach its POSTS,
    // which are per-dish opt-in and carry a reason.
    //
    // Deliberately broader than the old name: any text/prompt/export surface
    // added to this module trips this, because re-adding the affordance under
    // a new name is the regression worth catching. Read DECISIONS.md before
    // deleting this test.
    const mod = await import('../src/lib/dossier');
    expect(Object.keys(mod)).not.toContain('buildDossierText');
    expect(Object.keys(mod).filter(k => /text|prompt|export/i.test(k))).toEqual([]);
  });
});
