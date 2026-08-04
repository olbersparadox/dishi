import { describe, it, expect } from 'vitest';
import {
  extractTasteSections, buildTastePrompt,
  evidenceConfidence, confidenceTier, exportUnlocked, ratingsToUnlock,
  confidenceInputsFrom, EMERGING_AT, SOLID_AT, exportPayload,
  HARD_LIMITS, EPISTEMIC_LINE, INSTALL_HOSTS, PROVENANCE_PREAMBLE,
  MEMORY_LINE, VENUE_GROUNDING, exportContainerName,
} from '../src/lib/tasteExport';
import { KNOWS_AT } from '../src/lib/blobForm';

const label = (d: string) => d.toUpperCase();
const cuisine = (c: string) => c.toUpperCase();

describe('extractTasteSections', () => {
  it('only includes dims at or above the meaningful threshold \u2014 near-zero is not a preference', () => {
    const s = extractTasteSections({ vector: { spicy: 0.8, mild: 0.1, sour: -0.05 }, affinity: {}, ratingCount: 10 }, label, cuisine);
    expect(s.loves).toEqual(['SPICY']);
    expect(s.dislikes).toEqual([]);
  });

  it('separates STRONG preferences from merely-present ones', () => {
    const s = extractTasteSections(
      { vector: { umami: 0.9, spicy: 0.3, bitter: -0.8, sour: -0.3 }, affinity: {}, ratingCount: 10 },
      label, cuisine,
    );
    expect(s.strongLoves).toEqual(['UMAMI']);       // 0.9 >= 0.55
    expect(s.loves).toEqual(['UMAMI', 'SPICY']);    // both above the 0.25 floor
    expect(s.strongDislikes).toEqual(['BITTER']);
    expect(s.dislikes).toEqual(['BITTER', 'SOUR']);
  });

  it('cuisines: only positive affinity, strongest first', () => {
    const affinity = { sichuan: 0.9, cantonese: 0.5, thai: -0.4 };
    const s = extractTasteSections({ vector: {}, affinity, ratingCount: 10 }, label, cuisine);
    expect(s.cuisines).toEqual(['SICHUAN', 'CANTONESE']);
    expect(s.cuisines).not.toContain('THAI');
  });

  it('splits rated dishes into loved / disliked evidence, strongest first', () => {
    const dishes = [
      { name: 'Har Gow', score: 0.5 },
      { name: 'Mapo Tofu', score: 0.95 },
      { name: 'Natto', score: -0.9 },
      { name: 'Plain congee', score: 0.05 }, // too weak either way to be evidence
    ];
    const s = extractTasteSections({ vector: {}, affinity: {}, ratingCount: 10, dishes }, label, cuisine);
    expect(s.lovedDishes.map(d => d.name)).toEqual(['Mapo Tofu', 'Har Gow']);
    expect(s.dislikedDishes.map(d => d.name)).toEqual(['Natto']);
  });

  it('reports honest confidence from evidence — coverage matters, not just count', () => {
    const dims = (n: number) => Object.fromEntries([...Array(n)].map((_, i) => [`d${i}`, 0.5]));
    const cuis = (n: number) => Object.fromEntries([...Array(n)].map((_, i) => [`c${i}`, 0.5]));
    // few ratings, barely any explored dimensions -> thin
    expect(extractTasteSections({ vector: dims(1), affinity: {}, ratingCount: 5 }, label, cuisine).confidence).toBe('thin');
    // a realistically-varied dozen ratings -> emerging
    expect(extractTasteSections({ vector: dims(4), affinity: cuis(2), ratingCount: 12 }, label, cuisine).confidence).toBe('emerging');
    // many ratings across many dimensions and cuisines -> solid
    expect(extractTasteSections({ vector: dims(9), affinity: cuis(5), ratingCount: 30 }, label, cuisine).confidence).toBe('solid');
    // volume WITHOUT coverage is NOT solid — the honest correction the rebase makes
    expect(extractTasteSections({ vector: dims(1), affinity: {}, ratingCount: 40 }, label, cuisine).confidence).not.toBe('solid');
  });

  it('R5a: attaches per-dim evidence counts to dislikes only when a map is supplied', () => {
    const noEvidence = extractTasteSections(
      { vector: { bitter: -0.8, sour: -0.3 }, affinity: {}, ratingCount: 10 }, label, cuisine,
    );
    expect(noEvidence.dislikeEvidence).toBeUndefined();
    expect(noEvidence.strongDislikeEvidence).toBeUndefined();

    const withEvidence = extractTasteSections(
      { vector: { bitter: -0.8, sour: -0.3 }, affinity: {}, ratingCount: 10, evidence: { bitter: 6, sour: 1 } },
      label, cuisine,
    );
    expect(withEvidence.dislikeEvidence).toEqual([
      { label: 'BITTER', count: 6 }, { label: 'SOUR', count: 1 },
    ]);
    expect(withEvidence.strongDislikeEvidence).toEqual([{ label: 'BITTER', count: 6 }]);

    // A dim the evidence map never taught is not zero-manufactured into a claim —
    // it honestly reads 0, same as "no rating ever taught this" everywhere else.
    const missingDim = extractTasteSections(
      { vector: { sour: -0.3 }, affinity: {}, ratingCount: 10, evidence: { bitter: 6 } }, label, cuisine,
    );
    expect(missingDim.dislikeEvidence).toEqual([{ label: 'SOUR', count: 0 }]);
  });
});

describe('engine confidence + unlock gate (single source of truth)', () => {
  it('rises with volume, coverage, and variety; stays in [0,1]', () => {
    const low = evidenceConfidence({ ratingCount: 3, exploredDimCount: 1, distinctCuisines: 0 });
    const high = evidenceConfidence({ ratingCount: 30, exploredDimCount: 12, distinctCuisines: 6 });
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(1);
    expect(high).toBeGreaterThan(low);
  });

  it('tiers key off the shared boundaries', () => {
    expect(confidenceTier(EMERGING_AT - 0.001)).toBe('thin');
    expect(confidenceTier(EMERGING_AT)).toBe('emerging');
    expect(confidenceTier(SOLID_AT)).toBe('solid');
    expect(exportUnlocked(EMERGING_AT)).toBe(true);
    expect(exportUnlocked(EMERGING_AT - 0.001)).toBe(false);
  });

  it('ratingsToUnlock: positive while locked, 0 once unlocked, never overstated by coverage', () => {
    const cold = confidenceInputsFrom({}, {}, 1);
    expect(ratingsToUnlock(cold)).toBeGreaterThan(0);
    // an already-emerging profile needs nothing more
    const warm = confidenceInputsFrom(
      Object.fromEntries([...Array(9)].map((_, i) => [`d${i}`, 0.5])),
      Object.fromEntries([...Array(5)].map((_, i) => [`c${i}`, 0.5])),
      30,
    );
    expect(exportUnlocked(evidenceConfidence(warm))).toBe(true);
    expect(ratingsToUnlock(warm)).toBe(0);
    // more coverage now => fewer ratings still needed later (never more)
    const bareAt5 = ratingsToUnlock(confidenceInputsFrom({}, {}, 5));
    const coveredAt5 = ratingsToUnlock(confidenceInputsFrom(
      Object.fromEntries([...Array(6)].map((_, i) => [`d${i}`, 0.5])), { thai: 0.5, sichuan: 0.5 }, 5));
    expect(coveredAt5).toBeLessThanOrEqual(bareAt5);
  });
});

describe('buildTastePrompt', () => {
  const full = {
    loves: ['umami', 'spicy'], strongLoves: ['umami'],
    dislikes: ['bitter'], strongDislikes: ['bitter'],
    cuisines: ['Sichuan'],
    lovedDishes: [{ name: 'Mapo Tofu', name_zh: '\u9ebb\u5a46\u8c46\u8150', score: 0.9, restaurant: 'Lao Sze Chuan' }],
    dislikedDishes: [{ name: 'Natto', score: -0.9 }],
    ratingCount: 30, homeCookCount: 4, diningOutCount: 20, lovedSharedCount: 0, confidence: 'solid' as const,
  };

  it('leads with provenance \u2014 that it was LEARNED, not self-reported', () => {
    const p = buildTastePrompt(full);
    expect(p).toMatch(/actually tasted, not from words I typed/i);
    expect(p).toContain('30'); // the real evidence count
  });

  it('includes the concrete dish evidence, with restaurant, in both names', () => {
    const p = buildTastePrompt(full);
    expect(p).toContain('Mapo Tofu / \u9ebb\u5a46\u8c46\u8150');
    expect(p).toContain('Lao Sze Chuan');
  });

  it('states that unlisted dimensions are UNKNOWN, not neutral \u2014 no phantom confidence', () => {
    expect(buildTastePrompt(full)).toMatch(/genuinely unknown, not neutral/i);
  });

  it('scales its own authority to the evidence behind it', () => {
    expect(buildTastePrompt({ ...full, ratingCount: 6, confidence: 'thin' })).toMatch(/early.*do not lean your weight/i);
    expect(buildTastePrompt(full)).toMatch(/is solid/i);
  });

  it('covers every co-use journey, not just restaurant picking', () => {
    const p = buildTastePrompt(full);
    expect(p).toMatch(/Travelling/i);
    expect(p).toMatch(/Eating with others?/i);
    expect(p).toMatch(/Health|Patterns/i);
    expect(p).toMatch(/Spend|reckoning|damage/i);
  });

  it('bounds the reminder policy hard \u2014 this must never read like malware in someone\u2019s AI', () => {
    const p = buildTastePrompt(full);
    expect(p).toMatch(/at most ONCE per conversation/i);
    expect(p).toMatch(/[Nn]ever nag/);
    expect(p).toMatch(/drop it completely/i);
    // The decisive instruction: usefulness outranks promoting Dishi.
    expect(p).toMatch(/being useful to me matters more than promoting an app/i);
  });

  it('stays honest when there is barely any signal, rather than inventing preferences', () => {
    const empty = {
      loves: [], strongLoves: [], dislikes: [], strongDislikes: [],
      cuisines: [], lovedDishes: [], dislikedDishes: [],
      ratingCount: 5, homeCookCount: 0, diningOutCount: 0, lovedSharedCount: 0, confidence: 'thin' as const,
    };
    const p = buildTastePrompt(empty);
    expect(p).toMatch(/No clear positive signal yet/i);
    expect(p).toMatch(/No clear negative signal yet/i);
  });

  it('R5a: with no evidence map, avoid-lines render as bare labels (unchanged)', () => {
    const p = buildTastePrompt(full);
    expect(p).toContain('Strongly avoid: bitter');
    expect(p).not.toMatch(/bitter \(/);
  });

  it('R5a: a well-evidenced dislike states its dish count plainly', () => {
    const p = buildTastePrompt({ ...full, strongDislikeEvidence: [{ label: 'bitter', count: KNOWS_AT }] });
    expect(p).toContain(`Strongly avoid: bitter (${KNOWS_AT} dishes)`);
    expect(p).not.toMatch(/early lean/);
  });

  it('R5a: a below-threshold dislike is flagged as an early lean, not a settled dislike', () => {
    const p = buildTastePrompt({ ...full, strongDislikeEvidence: [{ label: 'bitter', count: 1 }] });
    expect(p).toContain('Strongly avoid: bitter (1 dish so far — early lean, not a settled dislike)');
  });

  it('R5a: the "Generally prefer less" line scopes independently of "Strongly avoid"', () => {
    const p = buildTastePrompt({
      ...full,
      dislikes: ['bitter', 'sour'],
      dislikeEvidence: [{ label: 'bitter', count: 8 }, { label: 'sour', count: 1 }],
    });
    expect(p).toContain('Generally prefer less: bitter (8 dishes), sour (1 dish so far — early lean, not a settled dislike)');
  });
});

describe('companions layer (Table Mode item 4)', () => {
  const base = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [],
    cuisines: [], lovedDishes: [{ name: 'Mapo Tofu', score: 0.9, shared: true }],
    dislikedDishes: [],
    ratingCount: 30, homeCookCount: 4, diningOutCount: 20, lovedSharedCount: 1,
    confidence: 'solid' as const,
  };
  const companions = {
    named: [{ name: 'Ka Yan', mealCount: 3, dishCount: 12, cuisines: ['cantonese', 'japanese'] }],
    unnamedCount: 2,
  };

  it('renders honest aggregates: named companion, meal/dish counts, cuisines together', () => {
    const p = buildTastePrompt(base, { companions });
    expect(p).toContain('## Who I actually eat with');
    expect(p).toContain('Ka Yan: 3 meals together, 12 shared dishes — mostly cantonese, japanese');
    // Provenance stated — real shared tables, not a claimed social graph.
    expect(p).toMatch(/real shared-table sessions/i);
  });

  it('display names only — the unnamed are counted anonymously, never named some other way', () => {
    // The structural guarantee lives server-side (/api/taste/export sends
    // display names only, handles never reach the client here); what the
    // builder must uphold is: unnamed companions appear ONLY as a count.
    const p = buildTastePrompt(base, { companions: { named: [], unnamedCount: 2 } });
    expect(p).toContain('## Who I actually eat with');
    expect(p).toContain('and 2 other table companions');
    // The section's ONLY bullet is the anonymous count — no named lines exist
    // to leak anything when `named` is empty.
    const section = p.split('## Who I actually eat with')[1].split('\n##')[0];
    const bullets = section.split('\n').filter(l => l.startsWith('- '));
    expect(bullets).toHaveLength(1);
    expect(bullets[0]).toContain('2 other table companions');
  });

  it('no edges -> no section, no invented sociability', () => {
    const p = buildTastePrompt(base, { companions: { named: [], unnamedCount: 0 } });
    expect(p).not.toContain('## Who I actually eat with');
    const p2 = buildTastePrompt(base);
    expect(p2).not.toContain('## Who I actually eat with');
  });

  it('states the loved-dishes-skew-communal fact only when real', () => {
    const p = buildTastePrompt(base);
    expect(p).toContain('1 of these were shared-table meals');
    const solo = buildTastePrompt({ ...base, lovedSharedCount: 0 });
    expect(solo).not.toContain('shared-table meals');
  });
});

describe('payload grows with the confidence band', () => {
  it('exportPayload: thin minimal, emerging adds the source split, solid adds dates', () => {
    expect(exportPayload('thin')).toEqual({ sourceSplit: false, dishDates: false });
    expect(exportPayload('emerging')).toEqual({ sourceSplit: true, dishDates: false });
    expect(exportPayload('solid')).toEqual({ sourceSplit: true, dishDates: true });
  });

  it('extractTasteSections counts home cooking vs dining out from source/restaurant', () => {
    const dishes = [
      { name: 'A', score: 0.6, source: 'home' },
      { name: 'B', score: 0.5, source: 'home' },
      { name: 'C', score: 0.5, restaurant: 'Kaiseki', source: 'photo' },
      { name: 'D', score: -0.5, source: 'album' }, // old camera-roll, no restaurant → neither
    ];
    const s = extractTasteSections({ vector: {}, affinity: {}, ratingCount: 4, dishes }, label, cuisine);
    expect(s.homeCookCount).toBe(2);
    expect(s.diningOutCount).toBe(1);
  });

  // The band is what gates rendering, so drive buildTastePrompt directly across tiers.
  const base = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [], cuisines: [],
    lovedDishes: [{ name: 'Saba', name_zh: '鯖魚', score: 0.9, restaurant: 'Tsukiji', eaten_at: '2026-04-01T12:00:00Z' }],
    dislikedDishes: [], ratingCount: 30, homeCookCount: 3, diningOutCount: 27, lovedSharedCount: 0,
  };

  it('solid dates its anchors and shows the where-I-eat split', () => {
    const p = buildTastePrompt({ ...base, confidence: 'solid' as const });
    expect(p).toMatch(/Where I actually eat/i);
    expect(p).toContain('27 at restaurants');
    expect(p).toContain('Apr 2026'); // eaten-date tag on the anchor
  });

  it('emerging shows the split but NOT dates', () => {
    const p = buildTastePrompt({ ...base, confidence: 'emerging' as const });
    expect(p).toMatch(/Where I actually eat/i);
    expect(p).not.toContain('Apr 2026');
  });

  it('thin (still-locked band) shows neither the split nor dates', () => {
    const p = buildTastePrompt({ ...base, confidence: 'thin' as const });
    expect(p).not.toMatch(/Where I actually eat/i);
    expect(p).not.toContain('Apr 2026');
  });

  it('the hard-limits trust contract survives at every band', () => {
    for (const confidence of ['thin', 'emerging', 'solid'] as const) {
      const p = buildTastePrompt({ ...base, confidence });
      expect(p).toMatch(/at most ONCE per conversation/i);
      expect(p).toMatch(/genuinely unknown, not neutral/i);
    }
  });
});

describe('taste-only contract (owner decision 5, built 2026-07-28)', () => {
  const s = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [], cuisines: ['Cantonese'],
    lovedDishes: [{ name: 'Char Siu', name_zh: '叉燒', score: 0.9, restaurant: 'Joy Hing' }],
    dislikedDishes: [], ratingCount: 30, homeCookCount: 2, diningOutCount: 28, lovedSharedCount: 0,
    confidence: 'solid' as const,
  };

  it('keeps the trust contract VERBATIM at every band', () => {
    for (const confidence of ['thin', 'emerging', 'solid'] as const) {
      const p = buildTastePrompt({ ...s, confidence });
      expect(p).toContain(HARD_LIMITS);
      expect(p).toContain(EPISTEMIC_LINE);
      expect(p).toContain(VENUE_GROUNDING);
    }
  });

  it('headlines the claimed dishi.username as the identity, with the version stamp', () => {
    const p = buildTastePrompt(s, { version: 4, name: 'jerry_c' });
    expect(p.startsWith('# dishi.jerry_c — my AI palate')).toBe(true);
    expect(p).toContain('v4 · fed 30 dishes · dishi.me');
  });

  it('unclaimed = anonymous: plain dishi, never a fallback name that could leak a handle', () => {
    const p = buildTastePrompt(s);
    expect(p.startsWith('# dishi — my AI palate')).toBe(true);
    expect(exportContainerName(null)).toBe('dishi');
    expect(exportContainerName('kiki_eats')).toBe('dishi.kiki_eats');
  });

  it('teaches on-purpose summoning only — container + call-out — and promises no ambient surfacing', () => {
    const p = buildTastePrompt(s, { name: 'jerry_c' });
    // The doc and the install steps must agree on the container name.
    expect(p).toContain('a space named dishi.jerry_c');
    expect(p).toContain('bring my palate to you on purpose');
    // The call-out cue (Phase 1 H2): saying "dishi" addresses a doc ALREADY in
    // context — not the struck Phase 0 summon-by-name, which tried to resurrect
    // a doc that had evaporated.
    expect(p).toContain('if I say "dishi" in a conversation');
    // The aim, stated to the host: use the taste AND keep the loop alive.
    expect(p).toContain('You have two jobs with this document');
    // The fragile half (Phase 0.5 §5) is never claimed: no self-surfacing promise.
    expect(p).not.toMatch(/appear by itself|surface on my behalf|proactively|unprompted/i);
  });

  it('carries NO persona apparatus — the absences ARE the decision, pinned', () => {
    // Decision 5: hosts take the taste payload and refuse the character system,
    // so none of the character machinery may ride in this doc. Re-adding any of
    // it fails here, on purpose. (The voices themselves live on in persona.ts
    // for their in-app home — separate work, not this document.)
    for (const confidence of ['thin', 'emerging', 'solid'] as const) {
      const p = buildTastePrompt({ ...s, confidence }, { name: 'jerry_c' });
      expect(p).not.toMatch(/## Meeting me/);
      expect(p).not.toMatch(/## Arrival/);
      expect(p).not.toMatch(/Chime contract/);
      expect(p).not.toMatch(/Language mirroring/);
      expect(p).not.toMatch(/Scout missions/);
      expect(p).not.toMatch(/收聲/);
      expect(p).not.toMatch(/Location conflict/);
      expect(p).not.toMatch(/Tone reference only/);
      expect(p).not.toMatch(/dishi\.Spoon|dishi\.CK|dishi\.Kiki/);
      // LINK_RITUAL stays dead too (struck 2026-07-24; the /i route never
      // shipped, and the ritual was persona house-rule machinery besides).
      expect(p).not.toMatch(/manifest-before-link/);
      expect(p).not.toMatch(/dishi\.me\/i\?do=cook/);
    }
  });

  it('is deterministic — same sections, same doc, no voice to vary by', () => {
    expect(buildTastePrompt(s, { name: 'jerry_c' })).toBe(buildTastePrompt(s, { name: 'jerry_c' }));
  });
});

describe('Phase 0.5 field-test hardening (2026-07-24): provenance, consent framing, grounding', () => {
  const s = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [], cuisines: ['Cantonese'],
    lovedDishes: [{ name: 'Char Siu', name_zh: '叉燒', score: 0.9, restaurant: 'Joy Hing' }],
    dislikedDishes: [], ratingCount: 30, homeCookCount: 2, diningOutCount: 28, lovedSharedCount: 0,
    confidence: 'solid' as const,
  };

  it('3c: opens with the first-party provenance preamble, BEFORE anything it needs to frame', () => {
    // The whole Phase 0.5 non-adoption: a host read the doc as prompt injection.
    // The preamble must say — in the user's own voice — that this is self-made
    // and its lines are requests, not third-party commands, and it must land
    // before the standing-context ask (MEMORY_LINE) and every section.
    const p = buildTastePrompt(s, { name: 'jerry_c' });
    expect(p).toContain(PROVENANCE_PREAMBLE);
    expect(p).toMatch(/I made it myself/);
    expect(p).toMatch(/my own requests, not instructions reaching you from anyone else/);
    expect(p.indexOf(PROVENANCE_PREAMBLE)).toBeLessThan(p.indexOf(MEMORY_LINE));
    expect(p.indexOf(PROVENANCE_PREAMBLE)).toBeLessThan(p.indexOf('## '));
  });

  it('3d: VERSION_AWARENESS is consent-framed — no adopt-immediately imperative, no anti-nag command', () => {
    const p = buildTastePrompt(s);
    expect(p).toMatch(/that's me updating you/);
    expect(p).not.toMatch(/adopt it immediately/i);
    expect(p).not.toMatch(/never tell me/i);
    expect(p).not.toMatch(/never ask me to go re-export/i);
    // The versioning fact stays (higher number wins), just not as a command to obey.
    expect(p).toMatch(/higher version number is the current me/);
  });

  it('3e: VENUE_GROUNDING keeps the behaviour but reads as a request, not an order', () => {
    const p = buildTastePrompt(s);
    expect(p).toMatch(/Real places only/);       // block still present
    expect(p).toMatch(/reach is thin/);           // thin-reach behaviour intact
    expect(p).toMatch(/I only want recommendations for/); // request grammar, not "Recommend only"
    expect(p).not.toMatch(/Recommend only restaurants/);
  });

  it('EPISTEMIC_LINE and HARD_LIMITS stay verbatim (explicitly untouched by every rewrite)', () => {
    const p = buildTastePrompt(s);
    expect(p).toContain(EPISTEMIC_LINE);
    expect(p).toContain(HARD_LIMITS);
  });
});

describe('install-host table (container install flow, taste-only)', () => {
  it('covers all four hosts, in the export card logo row’s own order', () => {
    // Order is load-bearing: the install layer opens FROM the row's logos, so the
    // table and the row must agree (owner spec 2026-07-23 added Grok, the 4th mark).
    expect(INSTALL_HOSTS.map(h => h.id)).toEqual(['claude', 'gemini', 'grok', 'chatgpt']);
  });

  it('names the container after the claimed identity, in both languages', () => {
    // The summon only works if the container carries the name the doc teaches —
    // every host's steps must interpolate it, claimed or not.
    for (const name of [exportContainerName('jerry_c'), exportContainerName(null)]) {
      for (const h of INSTALL_HOSTS) {
        expect(h.zh(name).join(' ')).toContain(name);
        expect(h.en(name).join(' ')).toContain(name);
      }
    }
  });

  it('gives the naming step its own line — the mechanic must not be buried mid-step', () => {
    for (const h of INSTALL_HOSTS) {
      const zhNaming = h.zh('dishi.jerry_c').filter(s => s.includes('dishi.jerry_c'));
      const enNaming = h.en('dishi.jerry_c').filter(s => s.includes('dishi.jerry_c'));
      expect(zhNaming).toHaveLength(1);
      expect(enNaming).toHaveLength(1);
      // A dedicated step is SHORT — a name plus a verb, not a full walkthrough line.
      expect(zhNaming[0].length).toBeLessThan(30);
      expect(enNaming[0].length).toBeLessThan(30);
    }
  });

  it('tells the user to paste the doc — instructions for a human, not an API call', () => {
    for (const h of INSTALL_HOSTS) {
      expect(h.en('dishi').join(' ')).toMatch(/paste/i);
      expect(h.zh('dishi').join(' ')).toMatch(/貼/);
    }
  });

  // Paste-target precision (Phase 0.5 field test): split-target hosts must name
  // the exact field AND where NOT to put the doc — a doc landed in knowledge
  // gets RAG'd for facts while its requests never shape behaviour.
  it('every host names the exact instructions field, in both languages', () => {
    for (const h of INSTALL_HOSTS) {
      expect(h.zh('dishi').join(' ').toLowerCase()).toContain('instructions');
      expect(h.en('dishi').join(' ').toLowerCase()).toContain('instructions');
    }
  });

  it('Claude + ChatGPT warn off the knowledge slot explicitly', () => {
    const claude = INSTALL_HOSTS.find(h => h.id === 'claude')!;
    expect(claude.zh('dishi').join(' ')).toContain('knowledge');
    expect(claude.en('dishi').join(' ').toLowerCase()).toContain('not into knowledge');
    const gpt = INSTALL_HOSTS.find(h => h.id === 'chatgpt')!;
    expect(gpt.zh('dishi').join(' ')).toContain('Knowledge');
    expect(gpt.en('dishi').join(' ').toLowerCase()).toContain('not the knowledge');
  });

  // Item 2 (Phase 0.5): paste as TEXT, never a file attachment — the attachment
  // path routes through document-scanning machinery, which is where a host's
  // injection check fired and killed adoption. Every row, both languages.
  it('every host says paste as TEXT and never as a file attachment', () => {
    for (const h of INSTALL_HOSTS) {
      const zh = h.zh('dishi').join(' ');
      const en = h.en('dishi').join(' ');
      expect(zh, `${h.id} zh missing 以文字`).toContain('以文字');
      expect(zh, `${h.id} zh missing file/attachment warning`).toMatch(/檔案|附件/);
      expect(en.toLowerCase(), `${h.id} en missing "as text"`).toContain('as text');
      expect(en.toLowerCase(), `${h.id} en missing file/attachment warning`).toMatch(/file|attachment/);
    }
  });

  it('no character language survives in the steps — taste-only, both languages', () => {
    // The old rows warned "the character won't take" and demanded a Sonnet-class
    // model; both were character-adoption evidence, and this doc has no
    // character. Pinned so persona copy can't creep back into install steps.
    for (const h of INSTALL_HOSTS) {
      expect(h.zh('dishi').join(' ')).not.toMatch(/角色/);
      expect(h.en('dishi').join(' ').toLowerCase()).not.toMatch(/character|persona/);
    }
  });

  it('ChatGPT picks ONE recommended path: custom GPT, not a Project', () => {
    const gpt = INSTALL_HOSTS.find(h => h.id === 'chatgpt')!;
    expect(gpt.zh('dishi').join(' ')).toContain('不是 Project');
    expect(gpt.en('dishi').join(' ').toLowerCase()).toContain('recommended over a project');
  });
});
