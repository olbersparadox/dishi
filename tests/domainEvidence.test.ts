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

/* ── G3 sub-node detectors (growth R&D Decision 4) ─────────────────────────────
   air (free from flags), lamb, sea fish/cephalopod, field leaf/root/soy — the
   detectors that unblock the lab gestures. Fill bags nothing reads yet, so
   these are honesty tests about the CLASSIFICATION, same spirit as above:
   the right word claims the right node, and a wrong-shaped word claims none. */
describe('air sub-node — chicken vs duck_goose, straight from the flags', () => {
  it('splits by flag, not by name — FLAG_DOMAINS already made this distinction', () => {
    expect(classifyDish(dish({ diet: ['chicken'] })).airSub).toEqual(['chicken']);
    expect(classifyDish(dish({ diet: ['duck_goose'] })).airSub).toEqual(['duck_goose']);
  });

  it('a dish naming duck but flagged chicken trusts the FLAG (name search is not used for air)', () => {
    // air deliberately skips name morphemes — the flag vocabulary already
    // carries this split with 100% coverage, so there is nothing to search for.
    expect(classifyDish(dish({ diet: ['chicken'], name_zh: '鴨' })).airSub).toEqual(['chicken']);
  });

  it('no air flag, no air sub — even on a land-flagged dish', () => {
    expect(classifyDish(dish({ diet: ['pork'] })).airSub).toEqual([]);
  });
});

describe('land sub-node — lamb added, flag OR morpheme', () => {
  it('the lamb flag alone earns lamb, with no name at all', () => {
    expect(classifyDish(dish({ diet: ['lamb'] })).landSub).toEqual(['lamb']);
  });

  it('田雞 (frog) never fires the bare 雞 morpheme as chicken', () => {
    // the latent misread this guards: LAND_SUB's chicken entry contains bare 雞,
    // which is also the last character of 田雞. Struck globally before any
    // family runs, regardless of what domain (if any) the dish carries.
    expect(classifyDish(dish({ diet: ['land'] as any, name_zh: '田雞粥' })).landSub).toEqual([]);
    expect(classifyDish(dish({ diet: ['chicken'], name_zh: '田雞粥' })).landSub).toEqual([]);
  });

  it('a real chicken dish still fires normally once 田雞 is not in play', () => {
    expect(classifyDish(dish({ diet: ['chicken'], name_zh: '豉油雞' })).landSub).toEqual(['chicken']);
  });
});

describe('sea sub-node — cephalopod before fish, order load-bearing', () => {
  it('章魚 (octopus) claims cephalopod only — the 魚 inside it must not also fire fish', () => {
    const d = classifyDish(dish({ diet: ['seafood'], name_zh: '章魚' }));
    expect(d.seaSub).toEqual(['cephalopod']);
  });

  it('墨魚 and 魷魚 also resolve to cephalopod alone', () => {
    expect(classifyDish(dish({ diet: ['seafood'], name_zh: '墨魚' })).seaSub).toEqual(['cephalopod']);
    expect(classifyDish(dish({ diet: ['seafood'], name_zh: '魷魚' })).seaSub).toEqual(['cephalopod']);
  });

  it('a plain fish name resolves to fish, not cephalopod', () => {
    expect(classifyDish(dish({ diet: ['seafood'], name_zh: '三文魚' })).seaSub).toEqual(['fish']);
  });

  it('魚香 (fish-fragrant — no fish) is voided: no seaSub hit, whatever else is in the name', () => {
    // 魚香茄子 is an eggplant dish; it would not normally carry the `seafood`
    // flag, but the void must hold even if it somehow does (defense in depth).
    expect(classifyDish(dish({ diet: ['seafood'], name_zh: '魚香茄子' })).seaSub).toEqual([]);
  });

  it('a mixed dish still earns BOTH: 章魚魚香 strikes 魚香 first, then reads 章魚', () => {
    const d = classifyDish(dish({ diet: ['seafood'], name_zh: '魚香章魚' }));
    expect(d.seaSub).toEqual(['cephalopod']);
  });

  it('seaSub is empty without the sea domain, however the name reads', () => {
    expect(classifyDish(dish({ diet: ['pork'], name_zh: '三文魚' })).seaSub).toEqual([]);
  });
});

describe('field sub-node — soy from the flag, leaf/root from morphemes', () => {
  it('the soy flag alone earns soy, with no name at all', () => {
    expect(classifyDish(dish({ diet: ['soy'] })).fieldSub).toEqual(['soy']);
  });

  it('leaf and root morphemes fire independently — disjoint vocabularies', () => {
    expect(classifyDish(dish({ diet: ['veg'], name_zh: '菠菜' })).fieldSub).toEqual(['leaf']);
    expect(classifyDish(dish({ diet: ['veg'], name_zh: '蘿蔔' })).fieldSub).toEqual(['root']);
  });

  it('a soy AND leafy dish earns both in the same bag (soy flag + a real leaf word)', () => {
    const d = classifyDish(dish({ diet: ['soy', 'veg'], name_zh: '菠菜' }));
    expect(d.fieldSub.sort()).toEqual(['leaf', 'soy']);
  });

  it('fieldSub is empty without the field domain', () => {
    expect(classifyDish(dish({ diet: ['pork'], name_zh: '菠菜' })).fieldSub).toEqual([]);
  });
});

describe('accumulateDomains folds all five sub-bags the same honest way', () => {
  it('a lamb dish grows sub.land.lamb, not beef/pork', () => {
    const d = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['lamb'] }), 0.5);
    expect(d.sub?.land?.lamb).toBeCloseTo(DOMAIN_EXPOSURE + 0.5, 10);
    expect(d.sub?.land?.beef).toBeUndefined();
  });

  it('a duck dish grows sub.air.duck_goose only', () => {
    const d = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['duck_goose'] }), 0.3);
    expect(d.sub?.air?.duck_goose).toBeCloseTo(DOMAIN_EXPOSURE + 0.3, 10);
    expect(d.sub?.air?.chicken).toBeUndefined();
  });

  it('a disliked dish still counts exposure but never grows a sub-node negatively', () => {
    const d = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['seafood'], name_zh: '三文魚' }), -1);
    // subWeight = max(0, 0.5-1) = 0 → no sub growth at all, same rule as shell/land
    expect(d.sub?.sea).toBeUndefined();
  });

  it('one prior fish dish plus one cephalopod dish keeps both alive in sub.sea', () => {
    let d = accumulateDomains(emptyDomainEvidence(), dish({ diet: ['seafood'], name_zh: '三文魚' }), 0.4);
    d = accumulateDomains(d, dish({ diet: ['seafood'], name_zh: '八爪魚' }), 0.4);
    expect(d.sub?.sea?.fish).toBeGreaterThan(0);
    expect(d.sub?.sea?.cephalopod).toBeGreaterThan(0);
  });
});

describe('accumulateDomainsT — the timed siblings agree with the plain ones', () => {
  it('same-instant lamb/air/sea/field events reproduce the plain record exactly', () => {
    const meals = [
      dish({ diet: ['lamb'] }),
      dish({ diet: ['duck_goose'] }),
      dish({ diet: ['seafood'], name_zh: '八爪魚' }),
      dish({ diet: ['soy'] }),
    ];
    let plain = emptyDomainEvidence();
    let timed = emptyDomainEvidenceT();
    for (const m of meals) {
      plain = accumulateDomains(plain, m, 0.4);
      timed = accumulateDomainsT(timed, m, 0.4, T0);
    }
    const read = domainsAsOf(timed, T0);
    expect(read.sub?.land?.lamb ?? 0).toBeCloseTo(plain.sub?.land?.lamb ?? 0, 10);
    expect(read.sub?.air?.duck_goose ?? 0).toBeCloseTo(plain.sub?.air?.duck_goose ?? 0, 10);
    expect(read.sub?.sea?.cephalopod ?? 0).toBeCloseTo(plain.sub?.sea?.cephalopod ?? 0, 10);
    expect(read.sub?.field?.soy ?? 0).toBeCloseTo(plain.sub?.field?.soy ?? 0, 10);
  });

  it('an untouched sub-bag decays out of the record (domainsAsOf omits it) same as before', () => {
    const t = accumulateDomainsT(emptyDomainEvidenceT(), dish({ diet: ['lamb'] }), 0.5, T0);
    const readFar = domainsAsOf(t, T0 + 20 * DOMAIN_HALF_LIFE_MS);
    expect(readFar.sub?.land?.lamb ?? 0).toBeLessThan(1e-4);
  });
});
