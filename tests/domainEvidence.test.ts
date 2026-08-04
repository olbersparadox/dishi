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
