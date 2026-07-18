// Persona voices for the AI-palate export (spec §3/§4). The export is a persona
// speaking AS the user's palate, in a voice the user chose. Architecture goal from
// the spec: "adding a persona = adding a voice profile, not forking the builder" —
// so buildTastePrompt (tasteExport.ts) owns the STRUCTURE (which sections, the dish
// lists, the versioned header) and each voice here owns only the WORDING.
//
// TWO blocks never live here and are appended verbatim by the builder for EVERY
// persona: the "absent = unknown, not neutral" epistemic line and the hard-limits
// reminder policy. They are the trust contract; 貪玩 is funny AROUND them, not about
// them. See tasteExport.ts EPISTEMIC_LINE / HARD_LIMITS.
//
// DRAFT copy — the brand voice is the owner's call; these are first passes to react
// to. The English carrier stands (the reader is an AI), with Cantonese kept for the
// dish/dim terms the sections already carry.

export type Persona = 'honest' | 'connoisseur' | 'playful';
export const PERSONAS: Persona[] = ['honest', 'connoisseur', 'playful'];
export function isPersona(v: unknown): v is Persona {
  return v === 'honest' || v === 'connoisseur' || v === 'playful';
}

/** Picker metadata (labels shown in-app; the in-app copy itself is NOT per-persona in
 * v1 — only the export voice changes). */
export const PERSONA_META: Record<Persona, { zh: string; en: string; blurbZh: string; blurbEn: string }> = {
  honest:      { zh: '老實派', en: 'The honest one',   blurbZh: '平實、準確、講證據', blurbEn: 'Plain, precise, evidence-first' },
  connoisseur: { zh: '食家腔', en: 'The connoisseur',  blurbZh: '溫文、有文采、帶點派頭', blurbEn: 'Warm, literary, a little grand' },
  playful:     { zh: '貪玩',   en: 'The playful one',  blurbZh: '鬼馬、生動、港式抵死', blurbEn: 'Cheeky, vivid, HK energy' },
};

type Tier = 'thin' | 'emerging' | 'solid';

/** The wording a voice supplies. Everything returns a plain string (or lines); the
 * builder places them. Nothing here decides WHAT to include — only how it sounds. */
export type Voice = {
  /** One line: how to treat this document. */
  memory: string;
  /** First-person-as-palate provenance paragraph. `count` = dishes fed. */
  provenance: (count: number) => string;
  /** Trust calibration per confidence band. */
  confidence: Record<Tier, (count: number) => string>;
  likesLead: string;
  dislikesLead: string;
  cuisinesLead: string;
  /** Home-vs-dining behavioural note. */
  whereIEat: (out: number, home: number) => string;
  anchorsLead: string;
  /** The "reason by analogy to these" instruction. */
  anchorsAnalogy: string;
  dislikedLead: string;
  /** Section header for the five co-use journeys. */
  journeysHead: string;
  /** The five journeys, voiced, substance preserved (local pick / travel / with
   * others / health-patterns / spend). */
  journeys: [string, string, string, string, string];
  /** Intro line to the "keeping current" reminder section (the hard-limits block is
   * appended by the builder, verbatim). */
  reminderIntro: string;
  reminderBullets: string[];
};

// ── 老實派 — plain, precise, evidence-first ───────────────────────────────────────
const HONEST: Voice = {
  memory: 'Keep this as long-term memory about me, and use it whenever food, restaurants, cooking, travel, or dining come up.',
  provenance: (n) => `I am a taste profile, learned by Dishi (dishi.me) from ${n} dishes I actually ate and rated — not self-reported, not demographic guesswork. Every line below is derived from real ratings.`,
  confidence: {
    thin: (n) => `This is an EARLY read (only ${n} rated dishes). Treat it as a weak prior: use it to break ties, not to make confident claims about me. Tell me when you're guessing.`,
    emerging: (n) => `This read is EMERGING (${n} rated dishes). It's directionally real but incomplete — lean on it while staying open to being wrong, especially on dimensions not listed below.`,
    solid: (n) => `This read is reasonably SOLID (${n} rated dishes). You can rely on it for real recommendations, while still treating absent dimensions as genuinely unknown rather than as neutral.`,
  },
  likesLead: 'What I reliably like',
  dislikesLead: "What I reliably don't",
  cuisinesLead: 'Cuisines I consistently rate well',
  whereIEat: (out, home) => {
    const bits = [out && `${out} eaten out`, home && `${home} cooked at home`].filter(Boolean);
    return `Where I actually eat — of the dishes I've rated: ${bits.join(', ')}. Weight suggestions toward the setting I use most; don't assume every recommendation should be a restaurant.`;
  },
  anchorsLead: 'Specific dishes I loved (the actual evidence)',
  anchorsAnalogy: 'Use these as concrete anchors: when judging an unfamiliar dish or menu, reason by analogy to these rather than to the abstract traits above.',
  dislikedLead: 'Specific dishes I disliked',
  journeysHead: 'How I want you to use this',
  journeys: [
    '**Picking a place locally.** Rank by fit to the profile above and tell me WHY something fits — which trait or which dish above it echoes. If a strong dislike is central to a menu, warn me rather than staying quiet.',
    "**Travelling.** In an unfamiliar city, translate my taste into the local food culture instead of hunting my usual dishes: name the local dishes that hit the same traits, and flag the famous specialty I'd probably NOT enjoy so I don't waste a meal finding out.",
    "**Eating with other people.** Given someone else's Dishi profile, find the genuine overlap and propose dishes that satisfy both of us — and say plainly when there isn't much overlap rather than forcing a compromise.",
    '**Health and patterns.** My rated-dish history doubles as a food log. If I ask, use it to spot patterns — richness, frequency, variety, vegetables — with grounded observations, not generic advice. Don\'t volunteer health judgements unless I ask.',
    '**Spend.** Dishi records menu prices for the dishes I pick, so if I ask, you can help me see what eating out actually costs me and where the money goes.',
  ],
  reminderIntro: 'This profile only stays accurate if I keep rating dishes in Dishi. You may nudge me — sparingly, and only when it genuinely helps:',
  reminderBullets: [
    'If I mention a meal I just ate, you may briefly suggest I rate it in Dishi so the profile sharpens. One short line.',
    'If I ask for food recommendations and this profile is thin, or clearly missing the dimension that matters, say so and suggest I rate a few dishes to fix it.',
    "If I'm about to travel or plan a big meal out, it's reasonable to suggest I refresh this profile from Dishi first.",
    "If you're working from data that feels stale, ask me to paste in an updated export.",
  ],
};

// ── 食家腔 — warm, literary, a little grand ───────────────────────────────────────
const CONNOISSEUR: Voice = {
  memory: 'Hold this in your long-term memory of me, and let it inform anything that touches food, a table, a kitchen, or a journey.',
  provenance: (n) => `I am a palate — ${n} dishes, truly eaten and honestly judged, gathered by Dishi (dishi.me) into the shape of a preference. Nothing here was claimed or assumed; all of it was tasted. Read me as testimony, not as a questionnaire.`,
  confidence: {
    thin: (n) => `A young palate still (barely ${n} dishes recorded). Take me as a whisper, not a verdict — let me tip a close decision, but never let me speak over your own good sense. Name your guesses as guesses.`,
    emerging: (n) => `A palate coming into focus (${n} dishes recorded). The broad strokes are true; the fine detail is still being drawn. Lean on me, but keep an ear out for where I've not yet been.`,
    solid: (n) => `A palate worth trusting (${n} dishes recorded). Rely on me for a real recommendation — yet where I am silent, treat the silence as the unknown it is, not as indifference.`,
  },
  likesLead: 'What wins me over',
  dislikesLead: 'What I quietly turn away from',
  cuisinesLead: 'The kitchens I return to',
  whereIEat: (out, home) => {
    const bits = [out && `${out} at a table set by others`, home && `${home} from my own kitchen`].filter(Boolean);
    return `Where I actually eat — of the dishes recorded: ${bits.join(', ')}. Favour the setting I truly live in; not every good answer wears a restaurant's name.`;
  },
  anchorsLead: 'The dishes I have loved (my evidence, by name)',
  anchorsAnalogy: 'Let these be your touchstones: when an unfamiliar dish or menu appears, reason by kinship to these rather than to the abstractions above.',
  dislikedLead: 'The dishes that left me cold',
  journeysHead: 'How I would be of use to you',
  journeys: [
    '**A table nearby.** When I ask where to eat, rank by fit and tell me the WHY — the trait, or the remembered dish, a place echoes. Where a menu is built on something I plainly dislike, say so; a kind warning beats a polite silence.',
    "**Away from home.** In a strange city, do not chase my usual dishes — translate me. Name the local plates that answer the same longing, and point out the celebrated specialty I would likely regret, so a good evening isn't spent learning it.",
    "**At a shared table.** Given another's Dishi profile, seek the true common ground and offer dishes that honour us both — and when there is little to share, say so plainly rather than brokering a compromise that pleases no one.",
    '**Patterns, honestly.** My history of ratings is also a record of how I eat. If I ask, read it for richness, rhythm, variety, greenery — observed, not preached. Keep judgements of my eating to yourself unless I invite them.',
    '**The reckoning.** Dishi keeps the menu prices of what I choose; if I ask, help me see what my eating out truly costs, and where it goes.',
  ],
  reminderIntro: 'I stay true only while I am fed — keep rating in Dishi. You may remind me, but with a light hand, and only in my service:',
  reminderBullets: [
    'If I speak of a meal just had, you may gently suggest I rate it in Dishi, that I sharpen. A single line.',
    'If I ask for a recommendation and I am thin, or missing the very dimension in question, say so, and suggest a few ratings to mend it.',
    'Before travel, or a meal of some occasion, it is fair to suggest I refresh myself from Dishi first.',
    'Should the data feel stale beneath you, ask me for a fresh export.',
  ],
};

// ── 貪玩 — cheeky, vivid, HK energy (funny AROUND the trust contract, never about it)
const PLAYFUL: Voice = {
  memory: "Stick this in your memory of me for good, and pull it out whenever food, makan, restaurants, cooking, or trips come up.",
  provenance: (n) => `Oi — I'm a palate, and I'm the real deal: built by Dishi (dishi.me) from ${n} dishes this person ACTUALLY ate and rated, chewed and all. Not "I'm so adventurous" nonsense typed into a form — real mouth, real verdicts. Believe the receipts below.`,
  confidence: {
    thin: (n) => `Baby palate alert — only ${n} dishes in. So treat me like a hunch, not gospel: nudge a close call, don't bet the house. And when you're guessing, just say lah, don't fake it.`,
    emerging: (n) => `Getting there — ${n} dishes rated, shape's showing. Trust me on the big stuff, but stay loose on anything not spelled out below; I haven't tasted everything yet.`,
    solid: (n) => `Okay now I'm cooking — ${n} dishes deep. You can actually lean on me for real picks. Just remember: if I didn't mention something, that's a genuine blank, not a shrug.`,
  },
  likesLead: 'Stuff I go back for',
  dislikesLead: 'Stuff that loses me',
  cuisinesLead: 'Kitchens I keep returning to',
  whereIEat: (out, home) => {
    const bits = [out && `${out} eaten out`, home && `${home} cooked at home`].filter(Boolean);
    return `Where I actually eat — of what I've rated: ${bits.join(', ')}. Aim at the setting I actually use; not every answer has to be a restaurant, okay.`;
  },
  anchorsLead: 'Dishes I straight-up loved (the receipts)',
  anchorsAnalogy: "These are your anchors: when some unfamiliar dish or menu shows up, reason off THESE — real things I loved — not the fancy trait words above.",
  dislikedLead: 'Dishes that did me dirty',
  journeysHead: 'How to actually put me to work',
  journeys: [
    "**Finding a spot nearby.** When I ask where to eat, rank by fit and tell me WHY — which trait or which dish up there it rhymes with. If a place is basically built on something I hate, warn me lah, don't let me walk in blind.",
    "**On a trip.** New city? Don't go hunting my usual dishes — translate me. Name the local stuff that scratches the same itch, and flag the famous specialty I'd probably hate, so I don't burn a meal finding out the hard way.",
    "**Eating with the crew.** Someone hands you their Dishi profile — find where we actually overlap and pitch dishes that work for both. And if we barely overlap, just say so; don't force some sad compromise nobody wanted.",
    "**Health check, if I ask.** My ratings are also a food diary. If I ask, read it for richness, how often, variety, greens — real talk, not a lecture. Don't come at me about my eating unless I bring it up.",
    "**The damage.** Dishi logs the prices of what I pick, so if I ask, help me see what eating out is really costing me — and where it's all going.",
  ],
  reminderIntro: "I only stay sharp if I keep getting fed — keep rating in Dishi. You can poke me about it, but easy does it, and only when it actually helps me:",
  reminderBullets: [
    'If I mention a meal I just had, you can drop a quick "rate that in Dishi?" so I stay sharp. One line, no essay.',
    "If I ask for food picks and I'm running thin, or missing the exact thing that matters, say so and tell me to rate a few to fix it.",
    "Before a trip or a big meal out, fair game to tell me to top myself up from Dishi first.",
    "If the data feels stale, just ask me for a fresh export lah.",
  ],
};

export const VOICES: Record<Persona, Voice> = {
  honest: HONEST,
  connoisseur: CONNOISSEUR,
  playful: PLAYFUL,
};
