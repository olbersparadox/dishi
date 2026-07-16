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

import { contentScore, toMatchPercent, toRelativeMatchPercent, type TasteVector, type DishVector } from './taste';

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
  unanimous: boolean;                        // every profiled member genuinely likes it
  protected_by_fairness: boolean;            // min term changed this item's rank band
};

const FAIRNESS_WEIGHT = 0.6;

// Badge thresholds live in RAW score space, not display-percent space. This is the
// fix for the fixed-gain saturation the display used to inherit: once several strong
// preferences stacked, toMatchPercent clamped multiple dishes to the same "100", and
// badges computed on that clamped number quietly lost their meaning. Raw scores have
// no ceiling, so a badge computed here stays true no matter how aligned a table is.
//
// The constants are the EXACT raw equivalents of the old percent thresholds (at the
// default gain 8), so behaviour is unchanged for normal-magnitude scores and only
// differs where the old code would have wrongly saturated:
//   old "member >= 55%"      -> (raw*8+1)*50 = 55  -> raw = 0.0125
//   old "|mean-group| > 6pts" -> 400*|Δraw| = 6     -> |Δraw| = 0.015
const POSITIVE_RAW = 0.0125;
const FAIRNESS_MARGIN_RAW = 0.015;

export function rankForGroup<T extends { attributes: DishVector; cuisine?: string | null }>(
  items: T[],
  members: GroupMember[],
): GroupRankedItem<T>[] {
  const profiled = members.filter(m => m.vector && m.rating_count > 0);

  // Pass 1: raw per-member and per-dish blends. Ranking and badges both key off
  // these unbounded raw values — never the clamped display percent.
  const withRaw = items.map(item => {
    const memberRaws = profiled.map(m => ({
      handle: m.handle,
      raw: contentScore(m.vector!, item.attributes, m.cuisine_affinity, item.cuisine ?? undefined),
    }));

    if (memberRaws.length === 0) {
      return { item, memberRaws, groupRaw: 0, hasProfiles: false };
    }

    const raws = memberRaws.map(m => m.raw);
    const min = Math.min(...raws);
    const mean = raws.reduce((s, x) => s + x, 0) / raws.length;
    const groupRaw = FAIRNESS_WEIGHT * min + (1 - FAIRNESS_WEIGHT) * mean;
    return { item, memberRaws, groupRaw, mean, min, hasProfiles: true };
  });

  // Pass 2: display group_match RELATIVE to the batch, so a table whose whole menu
  // aligns with everyone still shows visible separation between its best and worst
  // options instead of a wall of "100". Ranking order is untouched (still raw).
  const allGroupRaw = withRaw.filter(x => x.hasProfiles).map(x => x.groupRaw);

  return withRaw
    .map(x => {
      if (!x.hasProfiles) {
        return {
          item: x.item, group_match: 50,
          member_matches: [], unanimous: false, protected_by_fairness: false,
          _groupRaw: 0,
        };
      }
      return {
        item: x.item,
        group_match: toRelativeMatchPercent(x.groupRaw, allGroupRaw),
        // Per-member bars stay ABSOLUTE ("how much do YOU match this dish") — that's
        // an honest personal read, and individual members rarely stack preferences
        // hard enough to saturate the way a fairness-blended group headline can.
        member_matches: x.memberRaws.map(m => ({ handle: m.handle, match: toMatchPercent(m.raw) })),
        // Unanimous = every profiled member GENUINELY likes it (raw positive past the
        // bar), a claim about real preference that must not depend on batch spread.
        unanimous: x.memberRaws.every(m => m.raw >= POSITIVE_RAW),
        // Fairness mattered when the min term pulled the group score a real margin
        // away from where the mean alone would have put it.
        protected_by_fairness: Math.abs((x.mean as number) - x.groupRaw) > FAIRNESS_MARGIN_RAW,
        _groupRaw: x.groupRaw,
      };
    })
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
