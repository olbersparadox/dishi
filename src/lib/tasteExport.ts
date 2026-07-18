// Exports what Dishi has genuinely LEARNED as a prompt the person pastes into
// their own AI (ChatGPT/Claude/whatever they already talk to daily), so that AI
// carries a real, evidence-backed model of their taste — and knows when to send
// them back to Dishi to keep it sharp.
//
// Deliberately export-only. Import was considered and rejected: a pasted-in "I
// love spicy, hate coriander" claim would write preferences with ZERO rating
// evidence behind them, which is exactly the phantom-preference failure mode the
// updateTaste bug fix existed to kill. Export carries no such risk — it can only
// ever describe what was actually, evidentially learned.
//
// The prompt is ENGLISH-ONLY by design, regardless of Dishi's UI language: it is
// not read by the user, it is read by a model, and assistants follow instructions
// most reliably in English. Dish and restaurant names inside it stay in whatever
// language they really are.

/** Only dims with a real, legible signal are worth putting in someone's mouth as
 * "I love X" — near-zero values are noise, not a preference, and listing them
 * would manufacture confidence the engine doesn't actually have. */
const MEANINGFUL_THRESHOLD = 0.25;
/** Above this, a preference is strong enough to state as a headline, not just list. */
const STRONG_THRESHOLD = 0.55;
/** A dim counts as "explored" (the engine has a real read on it) past this — same
 * noise floor buddy.ts uses, kept here so evidenceConfidence needs no import. */
const EXPLORED_THRESHOLD = 0.15;

// ── Engine confidence: the ONE honest scale of "how much dishi knows your taste"
// from real rating evidence. Rating VOLUME dominates; flavor-dimension COVERAGE
// and cuisine VARIETY round it out (40 ratings that only ever exercised two
// dimensions is not a solid profile, and this says so). Saturates near where
// recommendations empirically stop shifting (~25 varied ratings). This is the
// single source of truth for the export honesty note AND the unlock gate (spec
// §1); the buddy bar (buddy.ts) layers an onboarding endowment on top of it, but
// never feeds back into it — onboarding must never masquerade as trained signal.
/** Confidence at/above which the export unlocks — the 'emerging' tier boundary. */
export const EMERGING_AT = 0.33;
/** Confidence at/above which the profile is 'solid' — rely on it for real recs. */
export const SOLID_AT = 0.70;

export type ConfidenceInputs = { ratingCount: number; exploredDimCount: number; distinctCuisines: number };

export function evidenceConfidence({ ratingCount, exploredDimCount, distinctCuisines }: ConfidenceInputs): number {
  const vol = Math.min(1, ratingCount / 25);
  const cov = Math.min(1, exploredDimCount / 18);
  const varty = Math.min(1, distinctCuisines / 6);
  return Math.min(1, 0.55 * vol + 0.30 * cov + 0.15 * varty);
}

export type ConfidenceTier = 'thin' | 'emerging' | 'solid';
export function confidenceTier(conf: number): ConfidenceTier {
  return conf >= SOLID_AT ? 'solid' : conf >= EMERGING_AT ? 'emerging' : 'thin';
}
/** The export unlock gate (spec §1): unlocked once the engine reaches 'emerging'.
 * Single source of truth — nothing else may invent its own threshold. */
export function exportUnlocked(conf: number): boolean {
  return conf >= EMERGING_AT;
}

/** Derive the confidence inputs from a raw profile, applying the explored-dim and
 * positive-affinity rules in ONE place so every caller counts them identically. */
export function confidenceInputsFrom(
  vector: Record<string, number>, affinity: Record<string, number>, ratingCount: number,
): ConfidenceInputs {
  return {
    ratingCount,
    exploredDimCount: Object.values(vector).filter(v => Math.abs(v) > EXPLORED_THRESHOLD).length,
    distinctCuisines: Object.values(affinity).filter(v => v > 0).length,
  };
}

/** How many more ratings, at the profile's CURRENT coverage/variety, would cross
 * the unlock. A live, honest countdown for the locked state — 0 once unlocked.
 * Coverage and variety only lower it, so it never overstates the work left. */
export function ratingsToUnlock(input: ConfidenceInputs): number {
  if (exportUnlocked(evidenceConfidence(input))) return 0;
  const cov = Math.min(1, input.exploredDimCount / 18);
  const varty = Math.min(1, input.distinctCuisines / 6);
  const volNeeded = Math.max(0, (EMERGING_AT - 0.30 * cov - 0.15 * varty) / 0.55);
  const rcNeeded = Math.ceil(volNeeded * 25);
  return Math.max(1, rcNeeded - input.ratingCount);
}

export type ExportDish = {
  name: string; name_zh?: string | null; score: number; restaurant?: string | null;
  /** When the dish was eaten (photo-EXIF or hand-set) — surfaced on anchors only at
   * higher confidence bands (see exportPayload). Null when unknown. */
  eaten_at?: string | null;
  /** How it was logged: 'home' = home cooking; a restaurant name means dining out.
   * Feeds the home-vs-dining split (a real pattern the palate should know). */
  source?: string | null;
};

/** What extra evidence the export payload carries, BY confidence band — the spec's
 * "payload grows as levels rise" made explicit as a table, not vibes. A thin profile
 * (which is also still locked) stays minimal; an emerging one gains the home-vs-dining
 * split; a solid one additionally dates its anchor dishes. Personas (later slice) read
 * the SAME table, so growing the payload is one edit here, not per-voice. */
export type ExportPayload = { sourceSplit: boolean; dishDates: boolean };
export function exportPayload(tier: ConfidenceTier): ExportPayload {
  switch (tier) {
    case 'thin':     return { sourceSplit: false, dishDates: false };
    case 'emerging': return { sourceSplit: true,  dishDates: false };
    case 'solid':    return { sourceSplit: true,  dishDates: true };
  }
}

export type TasteExportInput = {
  vector: Record<string, number>;
  affinity: Record<string, number>;
  ratingCount: number;
  /** Dishes the person actually rated — the concrete evidence behind the abstract
   * dimensions. A model reasons far better from "loved 生炒骨 at 大喜屋" than from
   * "umami: 0.7", and real dishes survive contact with a real menu in a way an
   * abstract trait doesn't. */
  dishes?: ExportDish[];
};

export type TasteExportSections = {
  loves: string[];
  strongLoves: string[];
  dislikes: string[];
  strongDislikes: string[];
  cuisines: string[];
  lovedDishes: ExportDish[];
  dislikedDishes: ExportDish[];
  ratingCount: number;
  /** Home-vs-dining split across ALL rated dishes (not just the anchors) — a home dish
   * has source 'home'; a dining one carries a restaurant. Rendered only when the band
   * allows (exportPayload.sourceSplit). */
  homeCookCount: number;
  diningOutCount: number;
  /** Dishi's own honest read of how much it actually knows yet. */
  confidence: 'thin' | 'emerging' | 'solid';
};

/** Pure data extraction — separated from prompt WORDING so the wording can change
 * without touching the selection/threshold logic, and so this half is testable
 * without string-matching a page of prose. */
export function extractTasteSections(
  input: TasteExportInput,
  dimLabel: (dim: string) => string,
  cuisineLabelFn: (cuisine: string) => string,
): TasteExportSections {
  const entries = Object.entries(input.vector).filter(([, v]) => Math.abs(v) >= MEANINGFUL_THRESHOLD);
  const pos = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const neg = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);

  const dishes = input.dishes ?? [];
  const lovedDishes = dishes.filter(d => d.score >= 0.4).sort((a, b) => b.score - a.score).slice(0, 8);
  const dislikedDishes = dishes.filter(d => d.score <= -0.4).sort((a, b) => a.score - b.score).slice(0, 5);

  // Honest self-assessment. The prompt tells the other AI how much to trust this —
  // a profile built on 6 ratings must not be spoken about with the same authority
  // as one built on 60. Derived from the shared evidenceConfidence scale (rating
  // count + dimension coverage + cuisine variety), so the export note, the unlock
  // gate, and the buddy bar can never disagree about how much dishi knows.
  const confidence = confidenceTier(
    evidenceConfidence(confidenceInputsFrom(input.vector, input.affinity, input.ratingCount)),
  );

  return {
    loves: pos.map(([d]) => dimLabel(d)),
    strongLoves: pos.filter(([, v]) => v >= STRONG_THRESHOLD).map(([d]) => dimLabel(d)),
    dislikes: neg.map(([d]) => dimLabel(d)),
    strongDislikes: neg.filter(([, v]) => v <= -STRONG_THRESHOLD).map(([d]) => dimLabel(d)),
    cuisines: Object.entries(input.affinity)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([c]) => cuisineLabelFn(c) || c),
    lovedDishes,
    dislikedDishes,
    ratingCount: input.ratingCount,
    homeCookCount: dishes.filter(d => d.source === 'home').length,
    diningOutCount: dishes.filter(d => !!d.restaurant).length,
    confidence,
  };
}

/** "Jul 2026" — the eaten-date tag for an anchor at a band that carries dates. Empty
 * when unknown/unparseable, so the caller just omits it. English (the reader is an AI,
 * per the export's language rationale). */
function eatenTag(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function dishLine(d: ExportDish, showDate: boolean): string {
  const name = [d.name, d.name_zh].filter(Boolean).join(' / ');
  const meta = [d.restaurant, showDate ? eatenTag(d.eaten_at) : ''].filter(Boolean);
  return `- ${name}${meta.length ? ` (${meta.join(', ')})` : ''}`;
}

/**
 * Builds the paste-ready prompt.
 *
 * Design intent, since this piece has to actually earn its keep:
 *  - Leads with PROVENANCE, because that IS the differentiator. Any AI can guess at
 *    food preferences; this is derived from dishes the person really ate and really
 *    rated. It says so, and says how much evidence stands behind it.
 *  - Gives the other AI CONCRETE DISHES, not just abstract dimensions.
 *  - Defines real CO-USE JOURNEYS (local picks, travel, dining with others, health,
 *    spend) so the profile is useful well beyond "recommend a restaurant".
 *  - Sets an explicit, bounded REMINDER POLICY. This is the part that decides
 *    whether the prompt reads as a smart companion or as malware lodged in someone's
 *    assistant. The rules are deliberately restrictive: opportunistic, capped at one
 *    mention, dropped instantly on a brush-off. A prompt that nags is a prompt the
 *    user deletes — and rightly so.
 */
export function buildTastePrompt(s: TasteExportSections): string {
  const {
    loves, strongLoves, dislikes, strongDislikes,
    cuisines, lovedDishes, dislikedDishes, ratingCount, confidence,
    homeCookCount, diningOutCount,
  } = s;
  // The payload grows with the band (spec §4): emerging gains the home-vs-dining
  // split, solid additionally dates its anchor dishes. One table drives it.
  const payload = exportPayload(confidence);

  const confidenceNote = {
    thin: `This is an EARLY profile (only ${ratingCount} rated dishes). Treat it as a weak prior: use it to break ties, not to make confident claims about me. Tell me when you're guessing.`,
    emerging: `This profile is EMERGING (${ratingCount} rated dishes). It's directionally real but incomplete — lean on it, while staying open to being wrong, especially on dimensions not listed below.`,
    solid: `This profile is reasonably SOLID (${ratingCount} rated dishes). You can rely on it for real recommendations, while still treating absent dimensions as genuinely unknown rather than as neutral.`,
  }[confidence];

  const out: string[] = [];

  out.push('# MY FOOD TASTE PROFILE (from Dishi)');
  out.push('');
  out.push('Please keep this as long-term memory about me, and use it whenever food, restaurants, cooking, travel, or dining come up.');
  out.push('');
  out.push("## Where this came from — and why it's worth trusting");
  out.push(`This was NOT self-reported. It was learned by Dishi, an app that builds a taste model from dishes I actually ate and rated — ${ratingCount} of them so far. Every line below is derived from real ratings, not from me claiming to be adventurous, and not from generic demographic guesswork.`);
  out.push(confidenceNote);
  out.push("Anything NOT listed below is genuinely unknown, not neutral. Please don't quietly fill those gaps with assumptions — ask me, or say you don't know.");
  out.push('');

  out.push('## What I reliably like');
  if (strongLoves.length) out.push(`Strongly: ${strongLoves.join(', ')}`);
  if (loves.length) out.push(`Overall: ${loves.join(', ')}`);
  if (!loves.length) out.push('(No clear positive signal yet.)');
  out.push('');

  out.push("## What I reliably don't");
  if (strongDislikes.length) out.push(`Strongly avoid: ${strongDislikes.join(', ')}`);
  if (dislikes.length) out.push(`Generally prefer less: ${dislikes.join(', ')}`);
  if (!dislikes.length) out.push('(No clear negative signal yet.)');
  out.push('');

  if (cuisines.length) {
    out.push('## Cuisines I consistently rate well');
    out.push(cuisines.join(', '));
    out.push('');
  }

  // Home-vs-dining is a real behavioural pattern, not a taste dim — where I actually
  // eat should shape what you recommend. Only once the profile is past 'thin'.
  if (payload.sourceSplit && homeCookCount + diningOutCount > 0) {
    const bits: string[] = [];
    if (diningOutCount) bits.push(`${diningOutCount} eaten out`);
    if (homeCookCount) bits.push(`${homeCookCount} cooked at home`);
    out.push('## Where I actually eat');
    out.push(`Of the dishes I've rated: ${bits.join(', ')}. Weight suggestions toward the setting I use most, and don't assume every recommendation should be a restaurant.`);
    out.push('');
  }

  if (lovedDishes.length) {
    out.push('## Specific dishes I loved (the actual evidence)');
    out.push(...lovedDishes.map(d => dishLine(d, payload.dishDates)));
    out.push('Use these as concrete anchors: when judging an unfamiliar dish or menu, reason by analogy to these rather than to the abstract traits above.');
    out.push('');
  }

  if (dislikedDishes.length) {
    out.push('## Specific dishes I disliked');
    out.push(...dislikedDishes.map(d => dishLine(d, payload.dishDates)));
    out.push('');
  }

  out.push('## How I want you to use this');
  out.push("1. **Picking a place locally.** When I ask where to eat, rank by fit to the profile above and tell me WHY something fits — which specific trait or which dish above it echoes. If a strong dislike is central to a restaurant's menu, warn me rather than staying quiet.");
  out.push("2. **Travelling.** In an unfamiliar city, translate my taste into the local food culture instead of hunting down my usual dishes: name the local dishes that hit the same traits, and flag the famous local specialty I'd probably NOT enjoy, so I don't waste a meal discovering that myself.");
  out.push("3. **Eating with other people.** If I give you someone else's Dishi profile, find the genuine overlap and propose dishes and restaurants that satisfy both of us — and say plainly when there isn't much overlap, rather than forcing a compromise neither of us wants.");
  out.push("4. **Health and patterns.** My rated-dish history doubles as a real food log. If I ask, use it to spot patterns — richness, frequency, variety, vegetables — and give grounded observations rather than generic advice. Don't volunteer health judgements about my eating unless I ask for them.");
  out.push('5. **Spend.** Dishi records menu prices for the dishes I pick, so if I ask, you can help me see what eating out actually costs me and where the money goes.');
  out.push('');

  out.push('## Keeping this current (please respect these limits)');
  out.push('This profile only stays accurate if I keep rating dishes in Dishi. You can nudge me — sparingly, and only when it genuinely helps me:');
  out.push('- If I mention a meal I just ate, you may briefly suggest I rate it in Dishi so the profile sharpens. One short line.');
  out.push('- If I ask for food recommendations and this profile is thin, or is clearly missing the dimension that matters for the question, say so and suggest I rate a few dishes to fix it.');
  out.push("- If I'm about to travel or plan a big meal out, it's reasonable to suggest I refresh this profile from Dishi first.");
  out.push("- If you're working from data that feels stale, ask me to paste in an updated export.");
  out.push('');
  out.push("**Hard limits:** mention Dishi at most ONCE per conversation, only ever as a short aside, and never as the main content of a reply. If I decline, ignore it, or seem uninterested, drop it completely and don't raise it again in that conversation. Never nag, never repeat yourself, and never make it a condition of helping me. If mentioning it wouldn't genuinely help me right now, don't mention it at all — being useful to me matters more than promoting an app.");

  return out.join('\n');
}

/** A dim counts as "moved since last export" only past this threshold — small
 * noise-level drift between two exports shouldn't be reported as a change.
 * Separate from MEANINGFUL_THRESHOLD above: that gates "worth stating as a
 * preference at all," this gates "worth saying it changed." A dim can clear
 * one without clearing the other. */
export const EXPORT_DELTA_THRESHOLD = 0.15;

export type ExportDelta = { dim: string; dir: 1 | -1 };

/** Pure diff between two full 18-dim vectors. Null `prior` (no previous
 * export exists yet) always returns []: there is genuinely nothing to
 * compare against, not a zero-sized change. */
export function computeExportDelta(
  vector: Record<string, number>,
  prior: Record<string, number> | null,
  dims: readonly string[],
  threshold = EXPORT_DELTA_THRESHOLD,
): ExportDelta[] {
  if (!prior) return [];
  return dims
    .map(dim => ({ dim, diff: (vector[dim] ?? 0) - (prior[dim] ?? 0) }))
    .filter(x => Math.abs(x.diff) >= threshold)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 4)
    .map(x => ({ dim: x.dim, dir: Math.sign(x.diff) as 1 | -1 }));
}
