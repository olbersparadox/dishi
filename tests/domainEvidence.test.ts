// 骨 · the domain aggregate. This decides what the creature GROWS, so the tests
// are mostly honesty tests: silence where there is no evidence, one meal counting
// once, dislikes carving, and sub-nodes never outranking their parent.
import { describe, it, expect } from 'vitest';
import {
  classifyDish, accumulateDomains, emptyDomainEvidence, DOMAIN_EXPOSURE,
} from '../src/lib/domainEvidence';
import { hasAnatomy } from '../src/lib/creatureForm';

const dish = (o: Partial<Parameters<typeof classifyDish>[0]>) => ({
  diet: null, ingredients: null, name: null, name_zh: null, ...o,
});

describe('classifyDish — diet flags carry the body plan', () => {
  it('maps the protein flags onto their domains', () => {
    expect(classifyDish(dish({ diet: ['pork'] })).domains).toEqual(['land']);
    expect(classifyDish(dish({ diet: ['chicken'] })).domains).toEqual(['air']);
    expect(classifyDish(dish({ diet: ['seafood'] })).domains).toEqual(['sea']);
    expect(classifyDish(dish({ diet: ['veg'] })).domains).toEqual(['field']);
  });

  it('a crustacean dish earns BOTH sea and shell — 甲殼 sits under 海', () => {
    // vision tags crab dishes seafood+shellfish; the tree says shell is a child
    const d = classifyDish(dish({ diet: ['seafood', 'shellfish'], name_zh: '蟹' }));
    expect(d.domains.sort()).toEqual(['sea', 'shell']);
  });

  it('flags with no body-plan meaning stay SILENT (egg, dairy, spicy, nuts)', () => {
    expect(classifyDish(dish({ diet: ['egg', 'dairy', 'spicy', 'peanut', 'tree_nut'] })).domains)
      .toEqual([]);
  });

  it('a dish that says nothing contributes nothing', () => {
    expect(classifyDish(dish({})).domains).toEqual([]);
  });
});

describe('classifyDish — ingredients see what flags cannot', () => {
  it('finds 菌 fungus, which has no diet flag of its own', () => {
    expect(classifyDish(dish({ diet: ['veg'], ingredients: ['shiitake', 'chicken'] })).domains)
      .toContain('fungus');
  });

  it('finds 藻 algae — the vocabulary gap the data audit flagged', () => {
    for (const w of ['seaweed', 'nori', 'kelp', 'wakame']) {
      expect(classifyDish(dish({ ingredients: [w] })).domains).toContain('algae');
    }
  });
});

describe('classifyDish — sub-nodes split a domain, never author one', () => {
  it('separates 龍蝦 from 蟹 inside 甲殼', () => {
    expect(classifyDish(dish({ diet: ['shellfish'], name_zh: '龍蝦刺身' })).shellSub).toEqual(['lobster']);
    expect(classifyDish(dish({ diet: ['shellfish'], name_zh: '蒜蓉蒸蟹' })).shellSub).toEqual(['crab']);
  });

  it('reads sub-nodes from INGREDIENTS too, not only the name', () => {
    expect(classifyDish(dish({ diet: ['shellfish'], ingredients: ['crab', 'ginger'] })).shellSub)
      .toEqual(['crab']);
  });

  it('a name alone never creates a domain — the rating is the evidence, not the word', () => {
    // 龍蝦 in the name with no shellfish flag and no ingredient: no domain, no sub
    const d = classifyDish(dish({ name_zh: '龍蝦湯米線' }));
    expect(d.domains).toEqual([]);
    expect(d.shellSub).toEqual([]);
  });

  it('splits land sub-nodes (牛/豬/雞)', () => {
    expect(classifyDish(dish({ diet: ['beef'], name_zh: '牛腩飯' })).landSub).toEqual(['beef']);
    expect(classifyDish(dish({ diet: ['pork'], name_zh: '叉燒飯' })).landSub).toEqual(['pork']);
  });
});

describe('accumulateDomains — the metabolism, as arithmetic', () => {
  const neutral = 0;

  it('exposure counts: a neutral meal still grows the domain', () => {
    const out = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['pork'] }), neutral);
    expect(out.land).toBeCloseTo(DOMAIN_EXPOSURE, 6);
  });

  it('liking amplifies, and dislike CARVES (the owner metabolism rule)', () => {
    const base = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['pork'] }), neutral);
    const loved = accumulateDomains(base, dish({ diet: ['pork'] }), 1);
    const grown = loved.land!;
    const carved = accumulateDomains(loved, dish({ diet: ['pork'] }), -1).land!;
    expect(grown).toBeGreaterThan(base.land!);
    expect(carved).toBeLessThan(grown); // a dislike must SHRINK, not merely not-grow
  });

  it('never goes negative — "less than never eaten" has no meaning', () => {
    let ev = emptyDomainEvidence();
    for (let i = 0; i < 5; i++) ev = accumulateDomains(ev, dish({ diet: ['pork'] }), -1);
    expect(ev.land).toBeGreaterThanOrEqual(0);
  });

  it('ONE meal counts once: a mixed dish splits its weight, never doubles it', () => {
    // 蝦餃 is shellfish + pork; two domains must share one meal's worth
    const mixed = accumulateDomains(emptyDomainEvidence(),
      dish({ diet: ['shellfish', 'pork'] }), neutral);
    const total = (mixed.shell ?? 0) + (mixed.land ?? 0);
    const single = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['pork'] }), neutral);
    expect(total).toBeCloseTo(single.land!, 6);
  });

  it('a dish with no domain signal leaves the record untouched', () => {
    const before = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['pork'] }), neutral);
    const after = accumulateDomains(before, dish({ diet: ['egg', 'dairy'] }), 1);
    expect(after).toEqual(before);
  });

  it('sub-node mixes track positive pull only — a dislike does not re-assign the variant', () => {
    const crabLover = accumulateDomains(emptyDomainEvidence(),
      dish({ diet: ['shellfish'], name_zh: '蟹' }), 1);
    const afterBadCrab = accumulateDomains(crabLover,
      dish({ diet: ['shellfish'], name_zh: '蟹' }), -1);
    // disliking a crab dish must not make them a lobster eater
    expect(afterBadCrab.sub?.shell?.lobster ?? 0).toBe(0);
    expect(afterBadCrab.sub?.shell?.crab).toBeGreaterThan(0);
  });

  it('is PURE — accumulating does not mutate the previous record', () => {
    const before = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['pork'] }), 1);
    const snapshot = JSON.parse(JSON.stringify(before));
    accumulateDomains(before, dish({ diet: ['seafood'] }), 1);
    expect(before).toEqual(snapshot);
  });

  it('is DETERMINISTIC — the same history always yields the same anatomy', () => {
    const history: [Parameters<typeof classifyDish>[0], number][] = [
      [dish({ diet: ['shellfish'], name_zh: '蟹' }), 0.8],
      [dish({ diet: ['pork'] }), -0.2],
      [dish({ diet: ['veg'], ingredients: ['shiitake'] }), 0.5],
    ];
    const run = () => history.reduce((ev, [d, s]) => accumulateDomains(ev, d, s), emptyDomainEvidence());
    expect(run()).toEqual(run());
  });
});

describe('the creature gate — empty history must render today\'s blob', () => {
  it('no rated dishes → no anatomy', () => {
    expect(hasAnatomy(emptyDomainEvidence())).toBe(false);
  });

  it('dishes that say nothing about domain → still no anatomy', () => {
    const ev = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['egg'] }), 1);
    expect(hasAnatomy(ev)).toBe(false);
  });

  it('one real domain meal → the creature door opens', () => {
    const ev = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['seafood'] }), 0);
    expect(hasAnatomy(ev)).toBe(true);
  });
});

// Substring collisions — the failure family that bit here immediately (龍蝦
// contains 蝦) and that menuScan's tripwire comments warn about elsewhere.
describe('classifyDish — substring collisions in the sub-node vocabulary', () => {
  it('龍蝦 is lobster ONLY, never lobster+prawn', () => {
    expect(classifyDish(dish({ diet: ['shellfish'], name_zh: '龍蝦刺身' })).shellSub)
      .toEqual(['lobster']);
  });

  it('a genuinely mixed 龍蝦蝦餃 still scores BOTH — only the compound is consumed', () => {
    expect(classifyDish(dish({ diet: ['shellfish'], name_zh: '龍蝦蝦餃' })).shellSub.sort())
      .toEqual(['lobster', 'prawn']);
  });

  it('hamburger steak is beef, not pork — bare "ham" must not fire', () => {
    const d = classifyDish(dish({ diet: ['beef'], name: 'Hamburg steak set', name_zh: '煮浸漢堡扒定食' }));
    expect(d.landSub).toEqual(['beef']);
  });

  it('雞髀 is chicken once, not chicken twice', () => {
    expect(classifyDish(dish({ diet: ['chicken'], name_zh: '油雞髀飯' })).landSub)
      .toEqual(['chicken']);
  });
});

/* ── the TIMED record (G1, growth program) ────────────────────────────────────
   docs/rnd/mokling-growth-rnd.md Decision 2. The metabolism tests are honesty
   tests too: the two records may never disagree about WHAT was eaten (pinned
   by the same-instant equivalence), decay follows the half-life exactly,
   negatives carve immediately while absence only fades, and the read adapter
   fails closed to the blob on anything legacy or empty. */
import {
  accumulateDomainsT, domainsAsOf, emptyDomainEvidenceT, DOMAIN_HALF_LIFE_MS,
} from '../src/lib/domainEvidence';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000; // fixed epoch — determinism is part of the contract

describe('accumulateDomainsT — the feeding clock', () => {
  it('same-instant events reproduce the plain record exactly (weights are unchanged)', () => {
    const meals = [
      dish({ diet: ['seafood', 'shellfish'], name_zh: '蟹' }),
      dish({ diet: ['pork'] }),
      dish({ diet: ['chicken'] }),
      dish({ diet: ['veg'], ingredients: ['shiitake'] }),
    ];
    const scores = [0.8, -0.6, 0, 0.3];
    let plain = emptyDomainEvidence();
    let timed = emptyDomainEvidenceT();
    meals.forEach((m, i) => {
      plain = accumulateDomains(plain, m, scores[i]);
      timed = accumulateDomainsT(timed, m, scores[i], T0); // all at one instant → no decay
    });
    const read = domainsAsOf(timed, T0);
    for (const k of ['sea', 'shell', 'land', 'air', 'field', 'fungus'] as const) {
      expect(read[k] ?? 0).toBeCloseTo(plain[k] ?? 0, 10);
    }
    expect(read.sub?.shell?.crab ?? 0).toBeCloseTo(plain.sub?.shell?.crab ?? 0, 10);
  });

  it('halves in exactly one half-life, quarters in two', () => {
    const t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['seafood'] }), 0.5, T0);
    expect(domainsAsOf(t, T0).sea).toBeCloseTo(1.0, 10); // 0.5 exposure + 0.5 score
    expect(domainsAsOf(t, T0 + DOMAIN_HALF_LIFE_MS).sea).toBeCloseTo(0.5, 10);
    expect(domainsAsOf(t, T0 + 2 * DOMAIN_HALF_LIFE_MS).sea).toBeCloseTo(0.25, 10);
  });

  it('decays between events, then adds — order and spacing both matter', () => {
    let t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['seafood'] }), 0.5, T0);
    t = accumulateDomainsT(t, dish({ diet: ['seafood'] }), 0.5, T0 + DOMAIN_HALF_LIFE_MS);
    // 1.0 halved to 0.5, plus the new 1.0
    expect(domainsAsOf(t, T0 + DOMAIN_HALF_LIFE_MS).sea).toBeCloseTo(1.5, 10);
  });

  it('negatives carve immediately; the floor is zero, never debt', () => {
    let t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['pork'] }), 0.5, T0);
    t = accumulateDomainsT(t, dish({ diet: ['pork'] }), -1, T0); // weight −0.5
    expect(domainsAsOf(t, T0).land).toBeCloseTo(0.5, 10);
    t = accumulateDomainsT(t, dish({ diet: ['pork'] }), -1, T0);
    t = accumulateDomainsT(t, dish({ diet: ['pork'] }), -1, T0);
    expect(domainsAsOf(t, T0).land ?? 0).toBe(0); // carved to nothing, not below
  });

  it('sub-bags stay positive-only and ride the same clock', () => {
    let t = accumulateDomainsT(
      emptyDomainEvidenceT(), dish({ diet: ['seafood', 'shellfish'], name_zh: '龍蝦' }), 0.5, T0);
    // a dislike neither grows nor re-answers "which crustacean"
    t = accumulateDomainsT(
      t, dish({ diet: ['seafood', 'shellfish'], name_zh: '龍蝦' }), -1, T0);
    expect(domainsAsOf(t, T0).sub?.shell?.lobster).toBeCloseTo(1.0, 10);
    expect(domainsAsOf(t, T0 + DOMAIN_HALF_LIFE_MS).sub?.shell?.lobster).toBeCloseTo(0.5, 10);
  });

  it('a dish that says nothing about domain leaves the record untouched', () => {
    const t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['egg'] }), 1, T0);
    expect(t).toEqual(emptyDomainEvidenceT());
  });

  it('clock skew cannot grow evidence: an out-of-order event decays nothing', () => {
    let t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['seafood'] }), 0.5, T0);
    t = accumulateDomainsT(t, dish({ diet: ['seafood'] }), 0.5, T0 - DAY); // Δt clamped to 0
    expect(domainsAsOf(t, T0).sea).toBeCloseTo(2.0, 10);
  });
});

describe('domainsAsOf — the read adapter fails closed', () => {
  it('legacy / missing / empty records all read as the blob', () => {
    expect(domainsAsOf(undefined, T0)).toEqual({});
    expect(domainsAsOf(null, T0)).toEqual({});
    expect(domainsAsOf({}, T0)).toEqual({});
    expect(hasAnatomy(domainsAsOf({}, T0))).toBe(false);
  });

  it('emits the renderer shape — hasAnatomy accepts a lived record', () => {
    const t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['seafood'] }), 0.5, T0);
    expect(hasAnatomy(domainsAsOf(t, T0))).toBe(true);
  });

  it('is deterministic: same history and asOf, byte-identical output', () => {
    const build = () => {
      let t = emptyDomainEvidenceT();
      t = accumulateDomainsT(t, dish({ diet: ['seafood', 'shellfish'], name_zh: '蟹' }), 0.7, T0);
      t = accumulateDomainsT(t, dish({ diet: ['pork'] }), -0.2, T0 + 30 * DAY);
      return domainsAsOf(t, T0 + 90 * DAY);
    };
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });
});
