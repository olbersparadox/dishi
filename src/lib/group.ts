// Table Mode's group-consensus engine.
//
// The social-choice problem: given N people's taste vectors and a set of candidate
// dishes, what should the table order? Pure averaging fails the obvious case — a dish
// three people love and one person hates can out-average a dish everyone quite likes,
// and the hater just has a bad night. Pure maximin (rank only by the least-happy
// person) over-corrects: one narrow palate vetoes everything and the group converges
// on the blandest safe option.
//
// The blend below is the standard practical compromise from group-recommender
// research: group = 0.6 * min(memberScores) + 0.4 * mean(memberScores).
// The min term protects the worst-off person (fairness); the mean term still rewards
// dishes that delight the rest of the table (efficiency). The 60/40 lean toward
// fairness is a product decision, not a mathematical necessity: a shared dinner where
// one person is miserable is a failed dinner, so we bias toward "nobody suffers."
//
// Members with no taste profile yet (0 ratings) are EXCLUDED from the math and
// flagged in the UI — a flat unknown vector would otherwise drag every min() toward
// neutral and erase everyone else's real preferences. Honest display beats fake
// inclusion.

import { contentScore, toMatchPercent, type TasteVector, type DishVector } from './taste';

export type GroupMember = {
  user_id: string;
  handle: string;
  vector: TasteVector | null;      // null -> no profile yet
  cuisine_affinity: Record<string, number>;
  rating_count: number;
};

export type GroupRankedItem<T> = {
  item: T;
  group_match: number;                       // 0-100
  member_matches: { handle: string; match: number }[];
  unanimous: boolean;                        // every profiled member >= 55
  protected_by_fairness: boolean;            // min term changed this item's rank band
};

const FAIRNESS_WEIGHT = 0.6;

export function rankForGroup<T extends { attributes: DishVector; cuisine?: string | null }>(
  items: T[],
  members: GroupMember[],
): GroupRankedItem<T>[] {
  const profiled = members.filter(m => m.vector && m.rating_count > 0);

  const scored = items.map(item => {
    const memberMatches = profiled.map(m => ({
      handle: m.handle,
      raw: contentScore(m.vector!, item.attributes, m.cuisine_affinity, item.cuisine ?? undefined),
    }));

    if (memberMatches.length === 0) {
      return {
        item, group_match: 50,
        member_matches: [], unanimous: false, protected_by_fairness: false,
        _groupRaw: 0,
      };
    }

    // Blend in match-percent space (see toMatchPercent for why raw scores are too
    // compressed for absolute thresholds). Ranking still keys off this same blended
    // value, so fairness affects order identically in either space.
    const pcts = memberMatches.map(m => toMatchPercent(m.raw));
    const min = Math.min(...pcts);
    const mean = pcts.reduce((s, x) => s + x, 0) / pcts.length;
    const groupPct = FAIRNESS_WEIGHT * min + (1 - FAIRNESS_WEIGHT) * mean;

    return {
      item,
      group_match: Math.round(groupPct),
      member_matches: memberMatches.map(m => ({ handle: m.handle, match: toMatchPercent(m.raw) })),
      unanimous: pcts.every(p => p >= 55),
      // "fairness mattered here": the mean alone would have placed this item more
      // than a visible margin (6 points) away from where the blend put it.
      protected_by_fairness: Math.abs(mean - groupPct) > 6,
      _groupRaw: groupPct,
    };
  });

  return scored
    .sort((a, b) => b._groupRaw - a._groupRaw)
    .map(({ _groupRaw, ...rest }) => rest);
}

/** Join codes: 5 chars, ambiguity-free alphabet (no 0/O/1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateTableCode(): string {
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}
