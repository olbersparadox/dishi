import { describe, it, expect } from 'vitest';
import {
  extractTasteSections, buildTastePrompt,
  evidenceConfidence, confidenceTier, exportUnlocked, ratingsToUnlock,
  confidenceInputsFrom, EMERGING_AT, SOLID_AT, exportPayload,
  HARD_LIMITS, EPISTEMIC_LINE, INSTALL_HOSTS, PROVENANCE_PREAMBLE,
} from '../src/lib/tasteExport';
import { PERSONAS, VOICES } from '../src/lib/persona';

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
    expect(p).toContain('27 at another\'s table');
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

describe('persona voices (spec §3/§4)', () => {
  const s = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [], cuisines: ['Cantonese'],
    lovedDishes: [{ name: 'Char Siu', name_zh: '叉燒', score: 0.9, restaurant: 'Joy Hing' }],
    dislikedDishes: [], ratingCount: 30, homeCookCount: 2, diningOutCount: 28, lovedSharedCount: 0,
  };

  it('keeps the trust contract VERBATIM — in every persona, at every band', () => {
    for (const persona of PERSONAS) {
      for (const confidence of ['thin', 'emerging', 'solid'] as const) {
        const p = buildTastePrompt({ ...s, confidence }, { persona });
        expect(p).toContain(HARD_LIMITS);
        expect(p).toContain(EPISTEMIC_LINE);
      }
    }
  });

  it('carries the versioned dishi.me header, named when a name is given', () => {
    for (const persona of PERSONAS) {
      const p = buildTastePrompt({ ...s, confidence: 'solid' as const }, { persona, version: 4, name: 'Jerry' });
      expect(p.startsWith("# dishi — Jerry's AI palate")).toBe(true);
      expect(p).toContain('v4 · fed 30 dishes · dishi.me');
    }
  });

  it('falls back to "my" when no name is given', () => {
    expect(buildTastePrompt({ ...s, confidence: 'solid' as const }, { persona: 'spoon' })
      .startsWith('# dishi — my AI palate')).toBe(true);
  });

  it('the three voices genuinely differ — not one doc with a relabel', () => {
    const docs = PERSONAS.map(persona => buildTastePrompt({ ...s, confidence: 'solid' as const }, { persona }));
    expect(new Set(docs).size).toBe(3);
    expect(buildTastePrompt({ ...s, confidence: 'solid' as const }, { persona: 'kiki' })).toMatch(/cooking/i);
    expect(buildTastePrompt({ ...s, confidence: 'solid' as const }, { persona: 'ck' })).toMatch(/testimony/i);
  });
});

describe('Phase 2: arrival handshake + house rules (voice-approval brief 2026-07-23)', () => {
  const s = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [], cuisines: ['Cantonese'],
    lovedDishes: [{ name: 'Char Siu', name_zh: '叉燒', score: 0.9, restaurant: 'Joy Hing' }],
    dislikedDishes: [], ratingCount: 30, homeCookCount: 2, diningOutCount: 28, lovedSharedCount: 0,
    confidence: 'solid' as const,
  };

  it('names each character into its own chime contract, not a generic one', () => {
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(s, { persona });
      expect(p).toContain(`\`**${VOICES[persona].displayName}:**`);
      expect(p).toMatch(/Chime contract/);
    }
  });

  it('carries the shared house rules verbatim for every persona', () => {
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(s, { persona });
      expect(p).toMatch(/Language mirroring/);
      expect(p).toMatch(/Scout missions/);
      // LINK_RITUAL is STRUCK (2026-07-24, Phase 0.5): the `/i` route doesn't
      // exist, and installed personas were handing out live 404s verbatim. The
      // doc must NOT contain the ritual until the route ships — these two
      // absences are the strike decision, pinned. Re-adding LINK_RITUAL to the
      // assembly without the route will fail here, on purpose.
      expect(p).not.toMatch(/manifest-before-link/);
      expect(p).not.toMatch(/dishi\.me\/i\?do=cook/);
      // VENUE_GROUNDING (new, Phase 0.5): the character may never invent a
      // venue — thin reach must be said plainly, anchors used instead.
      expect(p).toMatch(/Real places only/);
      expect(p).toMatch(/reach is thin/);
      expect(p).toMatch(/收聲/); // 收聲
      expect(p).toMatch(/REST OF THIS CONVERSATION ONLY/);
      expect(p).toMatch(/Location conflict/);
    }
  });

  it('chime contract lets the character block BE the reply on all-food messages', () => {
    // Phase 0.5: the host voice was re-asking whatever the chime just asked —
    // the no-restatement clause must ride in every persona's contract.
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(s, { persona });
      expect(p).toMatch(/the marked block IS the reply/);
      expect(p).toMatch(/never restate or re-ask/);
    }
  });

  it('performs the arrival handshake using a REAL anchor, never the tone calibration sample', () => {
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(s, { persona });
      expect(p).toContain('## Arrival');
      expect(p).toContain('Char Siu / 叉燒 at Joy Hing');
      // The calibration couplet must be present (for tone) but explicitly marked as
      // not-real-data, and distinct from the anchor used in the handshake.
      expect(p).toMatch(/Tone reference only \(not my real data\)/);
    }
  });

  it('degrades gracefully to no anchor citation when there is no evidence yet', () => {
    const thin = { ...s, lovedDishes: [], confidence: 'thin' as const };
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(thin, { persona });
      expect(p).toContain('## Arrival');
      expect(p).not.toContain('Char Siu');
    }
  });

  it('each persona states its own hard rule and never-does list', () => {
    const spoon = buildTastePrompt(s, { persona: 'spoon' });
    expect(spoon).toMatch(/sensuality points at FOOD, never at me/);
    const ck = buildTastePrompt(s, { persona: 'ck' });
    expect(ck).toMatch(/wit lands on dishes and restaurants.*never meanly on me/);
    const kiki = buildTastePrompt(s, { persona: 'kiki' });
    expect(kiki).toMatch(/no hype without receipts backing it/);
  });
});

describe('Phase 0.5 field-test hardening (2026-07-24): provenance, consent framing, grounding', () => {
  const s = {
    loves: ['umami'], strongLoves: [], dislikes: [], strongDislikes: [], cuisines: ['Cantonese'],
    lovedDishes: [{ name: 'Char Siu', name_zh: '叉燒', score: 0.9, restaurant: 'Joy Hing' }],
    dislikedDishes: [], ratingCount: 30, homeCookCount: 2, diningOutCount: 28, lovedSharedCount: 0,
    confidence: 'solid' as const,
  };

  it('3c: opens with the first-party provenance preamble, in every persona, BEFORE any character voice', () => {
    // The whole Phase 0.5 non-adoption: a host read the doc as prompt injection.
    // The preamble must say — in the user's own voice — that this is self-made
    // and its lines are requests, not third-party commands, and it must land
    // before the character's first utterance (v.memory) and the '## Meeting me'
    // section, or it isn't framing anything.
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(s, { persona });
      expect(p).toContain(PROVENANCE_PREAMBLE);
      expect(p).toMatch(/I made it myself/);
      expect(p).toMatch(/my own requests, not instructions reaching you from anyone else/);
      expect(p.indexOf(PROVENANCE_PREAMBLE)).toBeLessThan(p.indexOf('## Meeting me'));
      expect(p.indexOf(PROVENANCE_PREAMBLE)).toBeLessThan(p.indexOf(VOICES[persona].memory));
    }
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
    for (const persona of PERSONAS) {
      const p = buildTastePrompt(s, { persona });
      expect(p).toMatch(/Real places only/);       // block still present
      expect(p).toMatch(/reach is thin/);           // thin-reach behaviour intact
      expect(p).toMatch(/I only want recommendations for/); // request grammar, not "Recommend only"
      expect(p).not.toMatch(/Recommend only restaurants/);
    }
  });

  it('EPISTEMIC_LINE and HARD_LIMITS stay verbatim (explicitly untouched by the audit)', () => {
    const p = buildTastePrompt(s);
    expect(p).toContain(EPISTEMIC_LINE);
    expect(p).toContain(HARD_LIMITS);
  });
});

describe('install-host table (persona container install flow)', () => {
  it('covers all four hosts, in the export card logo row’s own order', () => {
    // Order is load-bearing: the install layer opens FROM the row's logos, so the
    // table and the row must agree (owner spec 2026-07-23 added Grok, the 4th mark).
    expect(INSTALL_HOSTS.map(h => h.id)).toEqual(['claude', 'gemini', 'grok', 'chatgpt']);
  });

  it("names the container in the persona's exact display name, in both languages", () => {
    // The summon only feels real if the container carries the character's name —
    // every host's steps must interpolate it, for every persona, in zh AND en.
    for (const persona of PERSONAS) {
      const name = VOICES[persona].displayName;
      for (const h of INSTALL_HOSTS) {
        expect(h.zh(name).join(' ')).toContain(name);
        expect(h.en(name).join(' ')).toContain(name);
      }
    }
  });

  it('gives the naming step its own line — the mechanic must not be buried mid-step', () => {
    for (const h of INSTALL_HOSTS) {
      const zhNaming = h.zh('dishi.Spoon').filter(s => s.includes('dishi.Spoon'));
      const enNaming = h.en('dishi.Spoon').filter(s => s.includes('dishi.Spoon'));
      expect(zhNaming).toHaveLength(1);
      expect(enNaming).toHaveLength(1);
      // A dedicated step is SHORT — a name plus a verb, not a full walkthrough line.
      expect(zhNaming[0].length).toBeLessThan(30);
      expect(enNaming[0].length).toBeLessThan(30);
    }
  });

  it('tells the user to paste the doc — instructions for a human, not an API call', () => {
    for (const h of INSTALL_HOSTS) {
      expect(h.en('dishi.Spoon').join(' ')).toMatch(/paste/i);
      expect(h.zh('dishi.Spoon').join(' ')).toMatch(/貼/);
    }
  });

  // Paste-target precision (Phase 0.5 field test): split-target hosts must name
  // the exact field AND where NOT to put the doc — a doc in knowledge gets
  // RAG'd for facts without steering behavior (observed live on both Claude
  // Projects and a custom GPT). Gemini adopted fully via its single target.
  it('every host names the exact instructions field, in both languages', () => {
    for (const h of INSTALL_HOSTS) {
      expect(h.zh('dishi.Spoon').join(' ').toLowerCase()).toContain('instructions');
      expect(h.en('dishi.Spoon').join(' ').toLowerCase()).toContain('instructions');
    }
  });

  it('Claude + ChatGPT warn off the knowledge slot explicitly', () => {
    const claude = INSTALL_HOSTS.find(h => h.id === 'claude')!;
    expect(claude.zh('dishi.Spoon').join(' ')).toContain('knowledge');
    expect(claude.en('dishi.Spoon').join(' ').toLowerCase()).toContain('not into knowledge');
    const gpt = INSTALL_HOSTS.find(h => h.id === 'chatgpt')!;
    expect(gpt.zh('dishi.Spoon').join(' ')).toContain('Knowledge');
    expect(gpt.en('dishi.Spoon').join(' ').toLowerCase()).toContain('not the knowledge');
  });

  // Item 2 (Phase 0.5): paste as TEXT, never a file attachment — the attachment
  // path routes through document-scanning machinery, which is where a host's
  // injection check fired and killed adoption. Every row, both languages.
  it('every host says paste as TEXT and never as a file attachment', () => {
    for (const h of INSTALL_HOSTS) {
      const zh = h.zh('dishi.Spoon').join(' ');
      const en = h.en('dishi.Spoon').join(' ');
      expect(zh, `${h.id} zh missing 以文字`).toContain('以文字');
      expect(zh, `${h.id} zh missing file/attachment warning`).toMatch(/檔案|附件/);
      expect(en.toLowerCase(), `${h.id} en missing "as text"`).toContain('as text');
      expect(en.toLowerCase(), `${h.id} en missing file/attachment warning`).toMatch(/file|attachment/);
    }
  });

  it('Claude carries the Sonnet-class model note (Haiku retrieved the doc but never became the character)', () => {
    const claude = INSTALL_HOSTS.find(h => h.id === 'claude')!;
    expect(claude.zh('dishi.Spoon').join(' ')).toContain('Sonnet');
    expect(claude.en('dishi.Spoon').join(' ')).toContain('Sonnet');
  });

  it('ChatGPT picks ONE recommended path: custom GPT, not a Project', () => {
    const gpt = INSTALL_HOSTS.find(h => h.id === 'chatgpt')!;
    expect(gpt.zh('dishi.Spoon').join(' ')).toContain('不是 Project');
    expect(gpt.en('dishi.Spoon').join(' ').toLowerCase()).toContain('recommended over a project');
  });
});
