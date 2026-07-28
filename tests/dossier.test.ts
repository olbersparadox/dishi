import { describe, it, expect } from 'vitest';
import { projectDossier, buildDossierText, DOSSIER_KNOWS_AT } from '../src/lib/dossier';
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
  anchors: [
    { name: 'Char siu', name_zh: '叉燒', restaurant: '再興', eaten_at: '2026-06-28T12:00:00Z', score: 0.9 },
    { name: 'Beef chow fun', name_zh: '乾炒牛河', restaurant: '新記', eaten_at: '2026-07-12T12:00:00Z', score: 0.95 },
    { name: 'Natto', name_zh: null, restaurant: '金冠', eaten_at: null, score: -0.9 },
    { name: 'Plain congee', name_zh: null, restaurant: null, eaten_at: null, score: 0.1 },
  ],
  hideRestaurants: false,
};

describe('projectDossier — the privacy contract', () => {
  it('eaten dates die at the projection — raw rows carry them, the output cannot', () => {
    const d = projectDossier(raw);
    // Structural: no field in the output type holds a date, so serializing the
    // whole projection must not contain either raw timestamp.
    const json = JSON.stringify(d);
    expect(json).not.toContain('2026-06-28');
    expect(json).not.toContain('2026-07-12');
    expect(json).not.toContain('eaten');
  });

  it('anchors are POSITIVE only — a public "this dish was bad here" is a statement about the restaurant', () => {
    const d = projectDossier(raw);
    expect(d.anchors.map(a => a.name)).toEqual(['Beef chow fun', 'Char siu']); // strongest first
    expect(d.anchors.map(a => a.name)).not.toContain('Natto');
    expect(d.anchors.map(a => a.name)).not.toContain('Plain congee'); // 0.1 is not loved
  });

  it('the hide-restaurants toggle strips every restaurant string, nothing else', () => {
    const d = projectDossier({ ...raw, hideRestaurants: true });
    expect(d.anchors.length).toBe(2);
    expect(d.anchors.every(a => a.restaurant === null)).toBe(true);
    expect(JSON.stringify(d)).not.toContain('再興');
    expect(JSON.stringify(d)).not.toContain('新記');
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

  it('re-rated dishes appear ONCE — rating rows are history, the page is a list of dishes', () => {
    const d = projectDossier({
      ...raw,
      anchors: [
        { name: 'sushi platter', name_zh: '壽司拼盤', restaurant: 'Tsumura', eaten_at: null, score: 0.9 },
        { name: 'sushi platter', name_zh: '壽司拼盤', restaurant: 'Tsumura', eaten_at: null, score: 0.7 },
        { name: 'sushi platter', name_zh: '壽司拼盤', restaurant: 'Ok Sushi', eaten_at: null, score: 0.6 },
      ],
    });
    // Same dish same place collapses to its strongest; same dish elsewhere stays.
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

describe('buildDossierText — third-person reference, one artifact two readers', () => {
  const label = (k: string) => k.toUpperCase();
  const cuisine = (k: string) => k.toUpperCase();

  it('is ABOUT the person, addressed to the reader\'s AI — never first-person taste', () => {
    const txt = buildDossierText(projectDossier(raw), label, cuisine);
    expect(txt).toContain('# dishi.jerry_c — a taste dossier (reference only)');
    expect(txt).toContain("dishi.jerry_c's taste profile");
    expect(txt).toContain('What dishi.jerry_c loves');
    // The palate export's first-person voice must not leak in here.
    expect(txt).not.toContain('my AI palate');
    expect(txt).not.toContain('What I love');
  });

  it('states hard rule 1 in the text itself — the recipient\'s AI is where Dishi cannot enforce it structurally', () => {
    const txt = buildDossierText(projectDossier(raw), label, cuisine);
    expect(txt).toMatch(/read-only reference/);
    expect(txt).toMatch(/don't fold any of it into what you know about me/);
  });

  it('carries anchors with restaurants, and honors the hidden variant', () => {
    const shown = buildDossierText(projectDossier(raw), label, cuisine);
    expect(shown).toContain('Beef chow fun / 乾炒牛河 (新記)');
    const hidden = buildDossierText(projectDossier({ ...raw, hideRestaurants: true }), label, cuisine);
    expect(hidden).toContain('Beef chow fun / 乾炒牛河');
    expect(hidden).not.toContain('新記');
  });

  it('no dates, no companions — by construction, at the text level too', () => {
    const txt = buildDossierText(projectDossier(raw), label, cuisine);
    expect(txt).not.toMatch(/2026|Jun|Jul/);
    expect(txt).not.toMatch(/companion|eat with/i);
  });

  it('closes on unknown-not-neutral — the dossier\'s twin of the epistemic line', () => {
    const txt = buildDossierText(projectDossier(raw), label, cuisine);
    expect(txt).toMatch(/genuinely unknown about dishi\.jerry_c, not neutral/);
  });
});
