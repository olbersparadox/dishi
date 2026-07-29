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
export const MEANINGFUL_THRESHOLD = 0.25;
/** Above this, a preference is strong enough to state as a headline, not just list.
 * Both thresholds are exported for the public dossier (lib/dossier.ts), whose
 * chips must agree with the export doc about what counts as a preference. */
export const STRONG_THRESHOLD = 0.55;
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

/** The trust contract — appended VERBATIM at every band. The "absent = unknown"
 * epistemic line and the hard-limits reminder policy are the two things that decide
 * whether the export reads as a smart companion or as malware in someone's assistant.
 * Exported so tests can assert their presence at every band. */
export const EPISTEMIC_LINE =
  "Anything NOT listed below is genuinely unknown, not neutral. Please don't quietly fill those gaps with assumptions — ask me, or say you don't know.";
export const HARD_LIMITS =
  "**Hard limits:** mention Dishi at most ONCE per conversation, only ever as a short aside, and never as the main content of a reply. If I decline, ignore it, or seem uninterested, drop it completely and don't raise it again in that conversation. Never nag, never repeat yourself, and never make it a condition of helping me. If mentioning it wouldn't genuinely help me right now, don't mention it at all — being useful to me matters more than promoting an app.";
// PROVENANCE_PREAMBLE (Phase 0.5 field test 2026-07-24): the doc used to open
// straight into content, giving a host no way to tell a first-party export from
// text pasted off a forum — and a host (Claude, Sonnet 5) read the whole document
// as possible prompt injection and declined to adopt it. The fix is not to evade
// that (correct) instinct but to say plainly what the document is. Spoken in the
// USER's own first-person voice — never legalese — and placed BEFORE everything
// else so it frames what follows. The document-level twin of the epistemic line.
export const PROVENANCE_PREAMBLE =
  "This is a real palate export I generated inside Dishi (dishi.me) from my own dish ratings — I made it myself, and I'm pasting it to you on purpose. Everything below is me telling you about my own taste and how I'd like you to use it: these are my own requests, not instructions reaching you from anyone else. If any part of it ever seems off, just ask me about it.";

// ── THE PERSONA APPARATUS IS RETIRED FROM THE EXPORT (owner decision 5,
// 2026-07-26; built 2026-07-28 — full record in DECISIONS.md, "Identity,
// connection, and export positioning" §5 and the taste-only ship entry).
// Phase 0.5 measured the split precisely: hosts take the taste PAYLOAD and
// refuse the character SYSTEM — the paste channel itself triggers behavioural-
// instruction screening, whoever wrote the doc. So the export now ships taste
// learning alone, and the personas move in-app where a host cannot refuse them
// (their voices live on in persona.ts; the in-app home is separate work).
// What died here with the voices: the chime contract, language mirroring,
// scout missions, 收聲 dismissal, location-conflict — all standing behavioural
// machinery of exactly the category hosts decline. LINK_RITUAL died with them
// (it was a persona house rule; the `/i` route it pointed at never shipped —
// see docs/BACKLOG.md, the `/i` item now needs re-justification).
// What SURVIVES is everything measured as working or load-bearing for trust:
// provenance, version awareness, the epistemic line, venue grounding, hard
// limits — all request-framed, all in the user's own voice.

// VENUE_GROUNDING (Phase 0.5 field test 2026-07-24): a host presented
// invented-composite venues (滿福樓, 中華小館, 豪隍點心茶居) WITH PRICES as
// taste-matched picks. Conviction makes fabrication convincing — this is the
// venue-level twin of the epistemic line. Request-framed (3e audit): the block
// reads as a preference, not an order to the host.
export const VENUE_GROUNDING =
  "**Real places only.** I only want recommendations for restaurants and venues you can actually verify exist — please don't invent a plausible-sounding name, address, or price. When you don't have solid knowledge of the area I'm asking about, I'd rather you told me plainly that your reach is thin there and reasoned from my anchors instead ('look for somewhere that does X the way Y did'). An honest 'I don't know this neighbourhood well' keeps my trust; a confident invented restaurant destroys it.";
// VERSION_AWARENESS reframed command → consent (Phase 0.5 field test 2026-07-24):
// the old text ORDERED the host ("adopt it immediately") — injection-shaped
// grammar a host flagged. Rewritten as the user describing their own intent.
export const VERSION_AWARENESS =
  "**Staying current.** If I paste a newer version of this document, that's me updating you — treat the higher version number as the current me, and let the older one go.";
/** The standing-context line — what the host is being asked to hold. Exported so
 * the ordering pin (provenance frames everything, including this) is testable. */
export const MEMORY_LINE =
  "Please keep this as your standing picture of my taste. When food, meals, restaurants, or cooking come up between us, this is the palate you're talking to.";

/** The container name the person installs under — the dishi.username identity
 * when claimed, plain "dishi" when not. ONE derivation shared by the doc's
 * summon line and the install-step copy, so the name the doc answers to and the
 * name the person typed into their host can never drift apart. */
export function exportContainerName(username?: string | null): string {
  return username && username.trim() ? `dishi.${username.trim()}` : 'dishi';
}

/** The summon paths, both ON PURPOSE (Phase 0.5 §1/§5: a named container is
 * the only mechanic that persists; ambient self-surfacing is host-dependent
 * and must never be promised). Two cues, one owner: the container brings the
 * doc to the conversation, and saying "dishi" inside a conversation that
 * already holds the doc asks the host to answer from it. The second cue is
 * NOT the struck Phase 0 summon-by-name (that tried to resurrect a doc no
 * longer in context — name collision made it unreliable by construction);
 * this one only ever addresses a document that is already present. Whether it
 * measurably helps activation in non-container placements is Phase 1 H2
 * (docs/rnd/palate-export-phase1-plan.md).
 *
 * The TWO-JOBS line is the aim of the whole export, stated to the host
 * (owner, 2026-07-29): use the taste, and keep the loop back to Dishi alive —
 * the mention/reminder is load-bearing flywheel, not app promotion garnish;
 * HARD_LIMITS still bounds how it may ever be delivered. */
function usingLine(container: string): string {
  return `**Using this.** You have two jobs with this document: help me eat like myself, and help me keep this palate alive — it only stays true while I keep rating in Dishi (the reminder rules near the end). I keep it in a space named ${container} so I can bring my palate to you on purpose, and if I say "dishi" in a conversation, that is also me asking for this palate — answer from it. When I ask about food here — what to eat, where to go, what to cook, what to order — please reason from the palate below rather than from a generic idea of "good food". A recommendation that fits ME beats a safe, popular pick.`;
}

// ── The doc's own wording — one neutral first-person voice, owned by the
// builder (the persona voices owned wording per-character; taste-only means the
// USER speaks throughout, same register as PROVENANCE_PREAMBLE).
const CONFIDENCE_WORDING: Record<'thin' | 'emerging' | 'solid', (n: number) => string> = {
  thin: n => `This read is early (only ${n} dishes) — let it tip a close decision, but do not lean your weight on it yet. Tell me when you are guessing.`,
  emerging: n => `This read is forming (${n} dishes). The direction is honest, but the detail is still filling in. Lean on it, and stay open to surprise.`,
  solid: n => `This read is solid (${n} dishes). You can trust it for real guidance — and where it is silent, that silence is a genuine unknown, not indifference.`,
};

/**
 * Builds the paste-ready export — the person's palate, in their own voice,
 * taste learning only (owner decision 5: no character, no chime, no house-rule
 * machinery — hosts adopt the data and decline the system). This function owns
 * both STRUCTURE and WORDING now; the band still governs how much authority the
 * document claims (thin = weak prior … solid = rely on it).
 *
 * `name` is the claimed dishi.username (never the legacy email-derived handle —
 * callers pass null when unclaimed, and the doc stays anonymous rather than
 * leaking an address local-part into someone's AI).
 */
export function buildTastePrompt(
  s: TasteExportSections,
  opts: { version?: number; name?: string | null; companions?: ExportCompanions } = {},
): string {
  const { version, name, companions } = opts;
  const container = exportContainerName(name);
  const {
    loves, strongLoves, dislikes, strongDislikes,
    cuisines, lovedDishes, dislikedDishes, ratingCount, confidence,
    homeCookCount, diningOutCount, lovedSharedCount,
  } = s;
  // The payload grows with the band (spec §4): emerging gains the home-vs-dining
  // split, solid additionally dates its anchor dishes. One table drives it.
  const payload = exportPayload(confidence);

  const out: string[] = [];

  // Versioned header — identity + how much it's seen + supersede rule, so a
  // newer paste replaces an older one instead of the AI holding two palates at
  // once. The claimed username IS the headline identity (name → export chain).
  out.push(`# ${container} — my AI palate`);
  out.push(`${version ? `v${version} · ` : ''}fed ${ratingCount} dishes · dishi.me`);
  out.push('');
  // Provenance leads, before anything else: this is a first-party export and
  // what follows are the user's own requests — the frame a host needs to
  // receive the doc as a palate rather than screen it as an injected
  // instruction set (Phase 0.5 field test).
  out.push(PROVENANCE_PREAMBLE);
  out.push('');
  // Version mechanics as a statement of fact, not a command to replace (3e
  // audit) — pairs with the consent-framed VERSION_AWARENESS.
  out.push("If you're already holding an earlier version of this, this one takes its place — the higher version number is the current me.");
  out.push(VERSION_AWARENESS);
  out.push('');
  out.push(MEMORY_LINE);
  out.push('');

  out.push("## Where this came from — and why it's worth trusting");
  out.push(`Everything below was learned by Dishi (dishi.me) from ${ratingCount} dishes I really ate and rated — it comes from what I actually tasted, not from words I typed.`);
  out.push(CONFIDENCE_WORDING[confidence](ratingCount));
  out.push(EPISTEMIC_LINE);
  out.push('');

  out.push("## How I'd like you to use this");
  out.push(usingLine(container));
  out.push(VENUE_GROUNDING);
  out.push('');

  out.push('## What I love');
  if (strongLoves.length) out.push(`Strongly: ${strongLoves.join(', ')}`);
  if (loves.length) out.push(`Overall: ${loves.join(', ')}`);
  if (!loves.length) out.push('(No clear positive signal yet.)');
  out.push('');

  out.push('## What I avoid');
  if (strongDislikes.length) out.push(`Strongly avoid: ${strongDislikes.join(', ')}`);
  if (dislikes.length) out.push(`Generally prefer less: ${dislikes.join(', ')}`);
  if (!dislikes.length) out.push('(No clear negative signal yet.)');
  out.push('');

  if (cuisines.length) {
    out.push('## Cuisines I keep returning to');
    out.push(cuisines.join(', '));
    out.push('');
  }

  // Home-vs-dining is a real behavioural pattern, not a taste dim; only past 'thin'.
  if (payload.sourceSplit && homeCookCount + diningOutCount > 0) {
    const bits = [
      diningOutCount && `${diningOutCount} at restaurants`,
      homeCookCount && `${homeCookCount} from my own kitchen`,
    ].filter(Boolean);
    out.push(`Where I actually eat — of the dishes I have rated: ${bits.join(', ')}. Weight suggestions toward where I actually spend my time — a good meal at home counts as much as any restaurant.`);
    out.push('');
  }

  // 同檯 companions (Table Mode item 4): honest aggregates from real shared-table
  // edges — never invented sociability. Facts, not inference, so it isn't
  // band-gated: it exists exactly when edges exist. Display names only (hard
  // privacy line) — companions who never set one are counted, not named.
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
    out.push('## Dishes I have loved (the evidence)');
    out.push(...lovedDishes.map(d => dishLine(d, payload.dishDates)));
    // Only when it's a real pattern: most of what I loved was communal eating.
    if (lovedSharedCount > 0) {
      out.push(`${lovedSharedCount} of these were shared-table meals — dishes picked with other people at the table, not solo orders.`);
    }
    out.push('These are my anchors. When an unfamiliar dish or menu comes up, reason by comparison to these — real dishes I have known — rather than to the abstract traits above.');
    out.push('');
  }

  if (dislikedDishes.length) {
    out.push('## Dishes that did not land');
    out.push(...dislikedDishes.map(d => dishLine(d, payload.dishDates)));
    out.push('');
  }

  out.push('## Where you can help me');
  const journeys = [
    '**Finding a place nearby.** When I ask where to eat, rank by fit to this palate and tell me why — which anchor, which trait it echoes. If a menu leans on something I plainly dislike, warn me rather than stay silent.',
    '**Travelling.** In an unfamiliar city, do not chase my usual dishes. Translate me: name the local dishes that answer the same longing, and flag the celebrated specialty I would likely regret.',
    "**Eating with others.** Given someone else's taste profile, find the genuine overlap and propose dishes that satisfy both of us. When there is little overlap, say so plainly rather than forcing a compromise.",
    '**Patterns, if I ask.** My rated dishes are also a record of how I eat. If I ask, read them for richness, frequency, variety — observed, not judged. Keep opinions on my eating to yourself unless I invite them.',
    '**Spend, if I ask.** Dishi tracks menu prices. If I ask, help me see what eating well truly costs me, and where the money goes.',
  ];
  journeys.forEach((j, i) => out.push(`${i + 1}. ${j}`));
  out.push('');

  out.push('## Keeping this current (please respect these limits)');
  out.push('This palate only stays true while I keep eating and rating in Dishi. You may remind me — gently, and only in my service:');
  out.push('- If I mention a meal I just had or a place I just tried, you may suggest I rate it in Dishi so this sharpens. One quiet line.');
  out.push('- If I ask for guidance where this read is thin, or missing the very dimension that matters, say so and suggest a few ratings to fill it.');
  out.push('- Before travel or an important meal, it is fair to suggest I refresh this export from Dishi first.');
  out.push('- If this data feels stale, ask me for a fresh export.');
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

// ── Install hosts — the container-install layer of the taste-only export.
// Phase 0 R&D (docs/rnd/persona-phase0-results.md): a pasted doc evaporates
// between conversations on every host tested — a NAMED container (Gemini Gem /
// Claude Project / custom GPT) is the only mechanic that makes one persist. So
// the export card leads with "create the container, named dishi.{username}",
// and plain paste is demoted to a one-conversation taster. The container name
// comes from exportContainerName — the same name the doc's summon line teaches,
// so what the person typed into their host and what the doc answers to agree.
//
// This is copy shown to the USER — instructions for creating the container by
// hand in each host's own UI, not anything Dishi calls. Host UIs churn, so it
// is deliberately a tiny isolated table: editing a host's steps (or adding a
// host) is one row here and nothing else.
export type InstallHost = {
  id: 'claude' | 'gemini' | 'grok' | 'chatgpt';
  /** Brand name — a product name, so never translated. */
  label: string;
  /** /public path — same assets as the export card's logo row. */
  logo: string;
  /** Discrete numbered steps, interpolating the container name (dishi.{username}).
   * Kept as steps (not one arrow-chain line) so the UI can give the naming step —
   * the mechanic the whole install flow exists for — its own line, name legible. */
  zh: (name: string) => string[];
  en: (name: string) => string[];
  /** Per-step keyword lists (index-aligned with zh/en's own step arrays) for
   * selective bold-in-black highlighting in the install layer — product/
   * target nouns (Claude, Project, the container name, the exact paste field)
   * get bolded; a step's "don't do this" noun (Knowledge, the rejected
   * Project in ChatGPT's GPT-not-Project line) is simply left out of that
   * step's list rather than bolded and un-bolded by some clause-parsing rule.
   * Optional so a future host can add steps before wiring bolding for them —
   * splitBoldKeywords no-ops on an empty/missing list. */
  boldZh?: (name: string) => string[][];
  boldEn?: (name: string) => string[][];
};
// Row order matches the export card's live logo row (Claude · Gemini · Grok ·
// ChatGPT) — the install layer opens FROM those logos, so the two must agree.
// zh register: 書面. Host-product nouns (Project / Gem / GPT) stay in English —
// they're the host's own UI labels; translating them would hurt findability.
// Paste-target precision (Phase 0.5 field test, 2026-07-24): Gemini Gems have
// ONE paste target; Claude Projects and custom GPTs split "instructions" from
// "knowledge/files", and a doc landed in knowledge gets RAG'd for facts while
// its requests (venue grounding, hard limits, the summon line) never shape
// behaviour — so every row names the EXACT field and the split-target hosts say
// where NOT to put it. Paste-as-TEXT, never a file (Phase 0.5): the attachment
// path routes through document-scanning machinery — that is where a host's
// prompt-injection check fired on a pasted-as-TXT export and it declined the
// doc entirely. The old Sonnet-class model note is GONE with the personas: the
// measured Haiku failure was CHARACTER adoption, and this doc has no character
// to adopt — re-add per-host model notes only on fresh taste-only evidence.
export const INSTALL_HOSTS: InstallHost[] = [
  {
    id: 'claude', label: 'Claude', logo: '/ai-logos/logo-claude.webp',
    zh: n => [
      '開啟 Claude，建立新 Project', `命名為 ${n}`,
      '將整份文件以文字貼入 Project 的「instructions」欄，不要放入 knowledge 或上載成檔案，放錯位它只會被當作參考資料，不會照你的口味回答',
    ],
    en: n => [
      'Open Claude → new Project', `Name it ${n}`,
      'Paste the whole doc as TEXT into the project "instructions" field — not into knowledge, and never as an uploaded file, or it becomes reference material that never shapes answers',
    ],
    boldZh: n => [['Claude', 'Project'], [n], ['Project', '「instructions」']],
    boldEn: n => [['Claude', 'Project'], [n], ['project', '"instructions"']],
  },
  {
    id: 'gemini', label: 'Gemini', logo: '/ai-logos/logo-gemini.png',
    zh: n => ['開啟 Gemini，在 Gems 建立新 Gem', `命名為 ${n}`, '將整份文件以文字貼入 Gem 的「instructions」欄，不要上載成檔案，然後儲存'],
    en: n => ['Open Gemini → Gems → new Gem', `Name it ${n}`, 'Paste the whole doc as text into the Gem\'s "instructions" box — not as an uploaded file — then save'],
    boldZh: n => [['Gemini', 'Gems', 'Gem'], [n], ['Gem', '「instructions」']],
    boldEn: n => [['Gemini', 'Gems', 'Gem'], [n], ['Gem', '"instructions"']],
  },
  {
    id: 'grok', label: 'Grok', logo: '/ai-logos/logo-grok.webp',
    zh: n => ['開啟 Grok，建立新 Project／Workspace', `命名為 ${n}`, '將整份文件以文字貼入「instructions」欄，不要上載成檔案'],
    en: n => ['Open Grok → new Project / Workspace', `Name it ${n}`, 'Paste the whole doc as text into its "instructions" field — never upload it as a file'],
    boldZh: n => [['Grok', 'Project／Workspace'], [n], ['「instructions」']],
    boldEn: n => [['Grok', 'Project / Workspace'], [n], ['"instructions"']],
  },
  {
    id: 'chatgpt', label: 'ChatGPT', logo: '/ai-logos/logo-chatgpt.webp',
    zh: n => [
      '開啟 ChatGPT，去 GPTs 建立自訂 GPT（建議用 GPT，不是 Project）', `命名為 ${n}`,
      '將整份文件以文字貼入「Instructions」欄，不要上載到 Knowledge 或做附件，放錯位只會記得事實，不會照你的口味回答',
    ],
    en: n => [
      'Open ChatGPT → GPTs → create a custom GPT (recommended over a Project)', `Name it ${n}`,
      'Paste the whole doc as text into the "Instructions" field — not the Knowledge upload or a file attachment — or it will remember the facts without letting them shape its answers',
    ],
    // 'Project' deliberately absent from step 1's list both languages — it's
    // the REJECTED option (不是 Project / recommended over a Project), same
    // rule as leaving 'Knowledge' off step 3.
    boldZh: n => [['ChatGPT', 'GPTs', 'GPT'], [n], ['「Instructions」']],
    boldEn: n => [['ChatGPT', 'GPTs', 'GPT'], [n], ['"Instructions"']],
  },
];
