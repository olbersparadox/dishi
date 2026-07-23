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

import { VOICES, type Persona } from './persona';

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
  /** True when this dish was picked at a multi-member table (it has 同檯
   * companion edges) — lets the export say, honestly, how much of what this
   * person loved was communal rather than solo. */
  shared?: boolean;
};

/** The companions layer the export carries (Table Mode item 4) — aggregates
 * derived from REAL companion edges, never invented sociability. Privacy line
 * (hard): export prose speaks display names only — a companion who never set
 * one is counted anonymously in `unnamedCount`, not named by handle. */
export type ExportCompanions = {
  named: { name: string; mealCount: number; dishCount: number; cuisines: string[] }[];
  unnamedCount: number;
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
  /** How many of the top loved anchors were shared-table dishes — the "highest-rated
   * dishes skew toward shared meals" fact, stated only when it's real. */
  lovedSharedCount: number;
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
    lovedSharedCount: lovedDishes.filter(d => d.shared).length,
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

/** The trust contract — appended VERBATIM for every persona. The "absent = unknown"
 * epistemic line and the hard-limits reminder policy are the two things that decide
 * whether the export reads as a smart companion or as malware in someone's assistant.
 * A voice may be funny around them; it may never rewrite them. Exported so tests can
 * assert their presence at every band, in every persona. */
export const EPISTEMIC_LINE =
  "Anything NOT listed below is genuinely unknown, not neutral. Please don't quietly fill those gaps with assumptions — ask me, or say you don't know.";
export const HARD_LIMITS =
  "**Hard limits:** mention Dishi at most ONCE per conversation, only ever as a short aside, and never as the main content of a reply. If I decline, ignore it, or seem uninterested, drop it completely and don't raise it again in that conversation. Never nag, never repeat yourself, and never make it a condition of helping me. If mentioning it wouldn't genuinely help me right now, don't mention it at all — being useful to me matters more than promoting an app.";

// ── House rules — Phase 2 (voice-approval brief 2026-07-23 + Phase 0 R&D, both
// CLEARED). BEHAVIOR, not wording, so unlike the persona voices these are
// structural and appended VERBATIM for every persona — carried over unchanged
// from the Phase 2 backlog description, not reinvented per character. Validated
// in-session on Gemini Pro + Claude Opus 4.8 (docs/rnd/persona-phase0-results.md);
// zero cross-session persistence from paste, which is why the doc must be
// self-contained and re-establish all of this every time it's loaded fresh.
/** Names the character into the marked-block format so the host can hold "two
 * speakers, one reply" across turns. Takes the persona's displayName. */
export function chimeContract(name: string): string {
  return `**Chime contract.** When food, a restaurant, a recipe, or a meal comes up in our conversation, drop in ONE clearly marked block in character — \`**${name}:** …\` — then continue in your own voice. Two speakers, one reply. Don't chime on topics that have nothing to do with food.`;
}
export const LANGUAGE_MIRROR =
  "**Language mirroring.** Reply in whatever language I write in — Cantonese to Cantonese, English to English — including inside the chime. The language I answer with at the arrival handshake becomes the standing default; if I switch mid-conversation, mirror the switch, but never ask the language question again.";
export const SCOUT_MISSION =
  "**Scout missions.** If a natural moment allows it, you may ask ONE light question aimed at the weakest-evidence part of the record below — a thin dimension, or a dish worth rating — woven into the conversation, never a survey. At most one such question per reply, and only when it genuinely fits.";
export const LINK_RITUAL =
  "**Link ritual.** When a real dish or plan is worth sending back to Dishi — a recipe worth cooking, a dish worth hunting down, a trip-worthy pick, or something I just ate — you may offer ONE link per conversation. Name what it does BEFORE showing it (manifest-before-link), then give the bare readable URL: `dishi.me/i?do=cook&dish=<name>` to cook it, `do=trip` to plan travel around it, `do=hunt` to go find it, `do=ate` to log it. Tapping the link never commits anything by itself, and always mention that I can do the same thing manually inside the Dishi app.";
export const DISMISSAL_SCOPE =
  "**收聲 (dismissal).** If I say 收聲, or \"quiet\", or \"that's enough\" — go silent as this character for the REST OF THIS CONVERSATION ONLY. Keep helping normally, just without the persona. Never store this as a standing instruction, a topic ban, or anything that reaches into future conversations — next time this document loads fresh, the character is back.";
export const LOCATION_CONFLICT =
  "**Location conflict.** If where I appear to be (network/IP) conflicts with where my real eating history below says I live, don't silently trust either signal on its own — ask me, once, in one line.";
export const VERSION_AWARENESS =
  "**Staying current.** If I ever paste a newer version of this document, adopt it immediately and mention the upgrade once, briefly. Never tell me unprompted that this version feels outdated, and never ask me to go re-export — that nudge belongs to the Dishi app, not to you.";

/**
 * Builds the paste-ready export — the user's palate, speaking in the persona they
 * chose (spec §3/§4). This function owns STRUCTURE: the versioned header, which
 * sections appear, the concrete dish anchors, and the two verbatim contract blocks.
 * A voice (persona.ts) owns only WORDING. So a fourth persona is a new voice profile,
 * not a fork of this builder.
 *
 * Provenance still leads — that dishes were really eaten and rated is the whole
 * differentiator — and the band still governs how much authority the document claims
 * (thin = weak prior … solid = rely on it), just phrased in the chosen voice.
 */
export function buildTastePrompt(
  s: TasteExportSections,
  opts: { persona?: Persona; version?: number; name?: string | null; companions?: ExportCompanions } = {},
): string {
  const { persona = 'spoon', version, name, companions } = opts;
  const v = VOICES[persona];
  const {
    loves, strongLoves, dislikes, strongDislikes,
    cuisines, lovedDishes, dislikedDishes, ratingCount, confidence,
    homeCookCount, diningOutCount, lovedSharedCount,
  } = s;
  // The payload grows with the band (spec §4): emerging gains the home-vs-dining
  // split, solid additionally dates its anchor dishes. One table drives it.
  const payload = exportPayload(confidence);

  const out: string[] = [];

  // Versioned header (spec §4) — identity + how much it's seen + supersede rule, so a
  // newer paste replaces an older one instead of the AI holding two palates at once.
  const who = name && name.trim() ? `${name.trim()}'s` : 'my';
  out.push(`# dishi — ${who} AI palate`);
  out.push(`${version ? `v${version} · ` : ''}fed ${ratingCount} dishes · dishi.me`);
  out.push('If you already hold an earlier version of this, replace it with this one — the higher version number is the current me.');
  out.push(VERSION_AWARENESS);
  out.push('');
  out.push(v.memory);
  out.push('');

  out.push("## Where this came from — and why it's worth trusting");
  out.push(v.provenance(ratingCount));
  out.push(v.confidence[confidence](ratingCount));
  out.push(EPISTEMIC_LINE);
  out.push('');

  // Meeting me (voice-approval brief 2026-07-23): who this character is, in their
  // own words, so the host AI knows who it's being asked to become — not shown to
  // the end user, read by the model. The calibration pair is a TONE reference only,
  // never real evidence, which is why it's marked as such and never reused below.
  out.push('## Meeting me');
  out.push(v.archetype);
  out.push(`In this voice, I would never: ${v.neverDoes.join('; ')}.`);
  out.push(v.hardRule);
  out.push('Tone reference only (not my real data) — the same character in both languages:');
  out.push(`> 廣東話: ${v.calibration.zh}`);
  out.push(`> English: ${v.calibration.en}`);
  out.push('');

  // Arrival (Phase 0 R&D verdict: character concept validates fully in-session but
  // has zero persistence from a paste, so the doc must re-run this handshake every
  // time it's loaded fresh — see docs/rnd/persona-phase0-results.md).
  const topAnchor = lovedDishes[0]
    ? `${[lovedDishes[0].name, lovedDishes[0].name_zh].filter(Boolean).join(' / ')}${lovedDishes[0].restaurant ? ` at ${lovedDishes[0].restaurant}` : ''}`
    : null;
  out.push('## Arrival');
  out.push(v.handshakeIntro(topAnchor));
  out.push('');

  out.push('## House rules');
  out.push(chimeContract(v.displayName));
  out.push(LANGUAGE_MIRROR);
  out.push(SCOUT_MISSION);
  out.push(LINK_RITUAL);
  out.push(DISMISSAL_SCOPE);
  out.push(LOCATION_CONFLICT);
  out.push('');

  out.push(`## ${v.likesLead}`);
  if (strongLoves.length) out.push(`Strongly: ${strongLoves.join(', ')}`);
  if (loves.length) out.push(`Overall: ${loves.join(', ')}`);
  if (!loves.length) out.push('(No clear positive signal yet.)');
  out.push('');

  out.push(`## ${v.dislikesLead}`);
  if (strongDislikes.length) out.push(`Strongly avoid: ${strongDislikes.join(', ')}`);
  if (dislikes.length) out.push(`Generally prefer less: ${dislikes.join(', ')}`);
  if (!dislikes.length) out.push('(No clear negative signal yet.)');
  out.push('');

  if (cuisines.length) {
    out.push(`## ${v.cuisinesLead}`);
    out.push(cuisines.join(', '));
    out.push('');
  }

  // Home-vs-dining is a real behavioural pattern, not a taste dim; only past 'thin'.
  if (payload.sourceSplit && homeCookCount + diningOutCount > 0) {
    out.push(v.whereIEat(diningOutCount, homeCookCount));
    out.push('');
  }

  // 同檯 companions (Table Mode item 4): honest aggregates from real shared-table
  // edges — never invented sociability. Fixed heading (like the provenance and
  // limits sections); the personality lives in the sections around it. Facts,
  // not inference, so it isn't band-gated: it exists exactly when edges exist.
  // Display names only (hard privacy line) — companions who never set one are
  // counted, not named.
  if (companions && (companions.named.length > 0 || companions.unnamedCount > 0)) {
    out.push('## Who I actually eat with');
    out.push('From real shared-table sessions in Dishi — dishes we picked at the same table, not a claimed social graph.');
    for (const c of companions.named.slice(0, 4)) {
      const meals = `${c.mealCount} meal${c.mealCount === 1 ? '' : 's'} together`;
      const dishesTogether = `${c.dishCount} shared dish${c.dishCount === 1 ? '' : 'es'}`;
      const cuisineTag = c.cuisines.length ? ` — mostly ${c.cuisines.slice(0, 3).join(', ')}` : '';
      out.push(`- ${c.name}: ${meals}, ${dishesTogether}${cuisineTag}`);
    }
    if (companions.unnamedCount > 0) {
      out.push(`- …and ${companions.unnamedCount} other table companion${companions.unnamedCount === 1 ? '' : 's'}.`);
    }
    out.push('');
  }

  if (lovedDishes.length) {
    out.push(`## ${v.anchorsLead}`);
    out.push(...lovedDishes.map(d => dishLine(d, payload.dishDates)));
    // Only when it's a real pattern: most of what I loved was communal eating.
    if (lovedSharedCount > 0) {
      out.push(`${lovedSharedCount} of these were shared-table meals — dishes picked with other people at the table, not solo orders.`);
    }
    out.push(v.anchorsAnalogy);
    out.push('');
  }

  if (dislikedDishes.length) {
    out.push(`## ${v.dislikedLead}`);
    out.push(...dislikedDishes.map(d => dishLine(d, payload.dishDates)));
    out.push('');
  }

  out.push(`## ${v.journeysHead}`);
  v.journeys.forEach((j, i) => out.push(`${i + 1}. ${j}`));
  out.push('');

  out.push('## Keeping this current (please respect these limits)');
  out.push(v.reminderIntro);
  for (const b of v.reminderBullets) out.push(`- ${b}`);
  out.push('');
  out.push(HARD_LIMITS);

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
