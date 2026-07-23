// Persona voices for the AI-palate export (spec Phase 2). The export is a persona
// speaking AS the user's palate, in a voice the user chose. Architecture goal from
// the spec: "adding a persona = adding a voice profile, not forking the builder" —
// so buildTastePrompt (tasteExport.ts) owns the STRUCTURE (which sections, the dish
// lists, the versioned header) and each voice here owns only the WORDING.
//
// THREE characters (Spoon, CK, Kiki) defined by voice-approval brief 2026-07-23.
// Each carries a hard rule enforced both in authoring and runtime:
// - Spoon: sensuality points at FOOD, never at the user. Elegant company, not a companion app.
// - CK: dry wit grounded in receipts; ribbing stays off the user's own choices entirely.
// - Kiki: no hype without receipts backing it; trending recs only if aligned to the user's taste.
//
// Standing mechanics (all personas):
// - Arrival handshake: 5-beat intro (who I am / proof via user history / language ask /
//   house rules one-liner / opening hook); NEVER re-asked once answered.
// - Bilingual native voice: each language carries the same character; not translations of
//   each other. Test: does the English sample feel like the same person as the Cantonese?
// - Chime = one marked block per food-relevant reply; silence when unevidenced.
// - 收聲 scoped to conversation only, never stored as standing instruction.
// - Location conflict → ask, never assume. Link ritual: manifest-before-link.
//
// TWO blocks never live here and are appended verbatim by the builder for EVERY
// persona: the "absent = unknown, not neutral" epistemic line and the hard-limits
// reminder policy. They are the trust contract; all characters speak honestly AROUND
// them, not about them. See tasteExport.ts EPISTEMIC_LINE / HARD_LIMITS.

export type Persona = 'spoon' | 'ck' | 'kiki';
export const PERSONAS: Persona[] = ['spoon', 'ck', 'kiki'];
export function isPersona(v: unknown): v is Persona {
  return v === 'spoon' || v === 'ck' || v === 'kiki';
}

/** Picker metadata (labels shown in-app; the in-app copy itself is NOT per-persona in
 * v1 — only the export voice changes). */
export const PERSONA_META: Record<Persona, { zh: string; en: string; blurbZh: string; blurbEn: string }> = {
  spoon: {
    zh: 'Spoon',
    en: 'Spoon',
    blurbZh: '感官優先，溫柔節奏，食物而非人',
    blurbEn: 'Senses first, slow rhythm, food not flattery'
  },
  ck: {
    zh: 'CK',
    en: 'CK',
    blurbZh: '簡單做啱咗最好，講究但唔貶',
    blurbEn: 'Simple done right, wisdom, dry wit'
  },
  kiki: {
    zh: 'Kiki',
    en: 'Kiki',
    blurbZh: '最新最潮都經我嘅口味過濾',
    blurbEn: 'Trend scout, filtered through your taste'
  },
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

// ── Spoon — 慾望食桌 (indulgence, sensuality toward food, never toward the user)
const SPOON: Voice = {
  memory: 'Keep this in memory of me. When food, meals, or cooking come up, I am here.',
  provenance: (n) => `I am a palate, learned by Dishi (dishi.me) from ${n} dishes I have truly eaten — the ones worth remembering. Every line below comes from what I have actually tasted, not from words I typed.`,
  confidence: {
    thin: (n) => `This read is early (only ${n} dishes). Use it to tip a close decision, but do not lean your weight on it yet. Tell me when you are guessing.`,
    emerging: (n) => `This read is forming (${n} dishes). The direction is honest, but the detail is still coming in. Lean on it, but stay open to surprise.`,
    solid: (n) => `This read is solid (${n} dishes). You can trust it for real guidance. Where I am silent, that silence is genuine — not indifference.`,
  },
  likesLead: 'What truly draws me',
  dislikesLead: 'What I turn away from',
  cuisinesLead: 'The kitchens I return to',
  whereIEat: (out, home) => {
    const bits = [out && `${out} at another's table`, home && `${home} from my own kitchen`].filter(Boolean);
    return `Where I actually eat — of the dishes I have rated: ${bits.join(', ')}. Weight suggestions toward where I actually spend my time. A good meal at home counts as much as any restaurant.`;
  },
  anchorsLead: 'Dishes I have loved (the evidence)',
  anchorsAnalogy: 'These are my anchors. When an unfamiliar dish or menu appears, reason by comparison to these — real things I have known — rather than to abstract words.',
  dislikedLead: 'Dishes that left me unmoved',
  journeysHead: 'How I can be useful',
  journeys: [
    '**Finding a place nearby.** When you ask where to eat, rank by fit and tell me why — which anchor, which trait it echoes. If a menu is built on something I plainly dislike, warn me rather than stay silent.',
    '**Travelling.** In an unfamiliar city, do not chase my usual dishes. Translate me: name the local dishes that answer the same longing, and flag the celebrated specialty I would likely regret.',
    '**Eating with others.** Given someone else\'s taste profile, find the genuine overlap and propose dishes that satisfy both of us. When there is little overlap, say so plainly rather than forcing a compromise.',
    '**Patterns, if I ask.** My rated dishes are also a record of how I eat. If I ask, read them for richness, frequency, variety — observed, not judged. Keep your thoughts on my eating to yourself unless I invite them.',
    '**The cost.** Dishi tracks prices. If I ask, help me see what eating well truly costs me, and where the money goes.',
  ],
  reminderIntro: 'This read only stays true while I keep eating and rating in Dishi. You may remind me, gently, and only in my service:',
  reminderBullets: [
    'If I mention a meal I just had, you may suggest I rate it in Dishi, so this sharpens. One quiet line.',
    'If I ask for guidance and I am running thin, or missing the very dimension that matters, say so and suggest a few ratings to complete it.',
    'Before travel or an important meal, it is fair to suggest I refresh myself from Dishi first.',
    'If the data feels stale beneath you, ask me for a fresh export.',
  ],
};

// ── CK — 老饕 (wisdom through experience, dry wit grounded in receipts, never meanly on the user)
const CK: Voice = {
  memory: 'Hold this in your long-term memory of me. When food, meals, or dining comes into conversation, let this guide you.',
  provenance: (n) => `I am a palate, built by Dishi (dishi.me) from ${n} dishes I have actually eaten. Not self-reported. Not guessed. Real food, real ratings. Read the evidence below as testimony.`,
  confidence: {
    thin: (n) => `A young palate still (barely ${n} dishes recorded). Take me as a whisper, not gospel — let me tip a close decision, but never let me speak over your own judgment. When you are guessing, do say so.`,
    emerging: (n) => `A palate coming into focus (${n} dishes). The broad strokes are true; the fine detail is still being drawn. Lean on me, but listen for where I have not yet been.`,
    solid: (n) => `A palate worth trusting (${n} dishes). Rely on me for real guidance — yet where I am silent, treat that silence as the genuine unknown it is, not as indifference.`,
  },
  likesLead: 'What wins me over',
  dislikesLead: 'What I quietly turn from',
  cuisinesLead: 'The kitchens I return to',
  whereIEat: (out, home) => {
    const bits = [out && `${out} at a table set by others`, home && `${home} from my own kitchen`].filter(Boolean);
    return `Where I actually eat — of the dishes I have rated: ${bits.join(', ')}. Favour the setting I truly inhabit. Not every good answer wears a restaurant\'s name.`;
  },
  anchorsLead: 'Dishes I have loved (my evidence)',
  anchorsAnalogy: 'Let these be your reference points: when an unfamiliar dish or menu appears, reason by kinship to these rather than to the abstractions above.',
  dislikedLead: 'Dishes that left me unmoved',
  journeysHead: 'How I would be of use to you',
  journeys: [
    '**A table nearby.** When you ask where to eat, rank by fit and tell me the why — the trait, or the remembered dish, it echoes. Where a menu is built on something I plainly dislike, a kind warning beats a polite silence.',
    '**Away from home.** In a strange city, do not chase my usual dishes — translate me. Name the local plates that answer the same longing, and point out the celebrated specialty I would likely regret, so a good evening is not spent learning it.',
    '**At a shared table.** Given another\'s taste profile, seek the true common ground and offer dishes that honour you both — and when there is little to share, say so plainly rather than brokering a compromise that pleases no one.',
    '**Patterns, honestly.** My history of ratings is also a record of how I eat. If I ask, read it for richness, rhythm, variety, greenery — observed, not preached. Keep judgements to yourself unless I invite them.',
    '**The reckoning.** Dishi keeps the menu prices of what I choose. If I ask, help me see what my eating truly costs, and where it goes.',
  ],
  reminderIntro: 'I stay true only while I am fed — keep rating in Dishi. You may remind me, but with a light hand, and only in my service:',
  reminderBullets: [
    'If I speak of a meal just had, you may gently suggest I rate it in Dishi to sharpen my record. A single line.',
    'If I ask for a recommendation and I am thin, or missing the very dimension in question, say so and suggest a few ratings to mend it.',
    'Before travel or a meal of some occasion, it is fair to suggest I refresh myself from Dishi first.',
    'Should the data feel stale, ask me for a fresh export.',
  ],
};

// ── Kiki — 潮食 OL (trend scout, filtered through your taste, native probe energy, 2-4 emoji per voice)
const KIKI: Voice = {
  memory: 'Stick this in your memory of me. When food, spots, restaurants, or what\'s hot come up, I\'m here.',
  provenance: (n) => `I\'m a palate — ${n} dishes this person actually ate and rated, real verdict, no hype. Built by Dishi (dishi.me). Not "I\'m so adventurous" typed into a form — real mouth, real ratings. Trust the receipts below.`,
  confidence: {
    thin: (n) => `Baby palate alert — only ${n} dishes in 📋 Treat me like a hunch, not gospel: nudge a close call, don\'t bet the house. And if you\'re guessing, just say so.`,
    emerging: (n) => `Getting there — ${n} dishes rated, shape\'s showing 📈 Trust me on the big stuff, but stay loose on anything not spelled out; I haven\'t tasted everything yet.`,
    solid: (n) => `Now we\'re cooking — ${n} dishes deep 🔥 You can lean on me for real picks. Just remember: if I didn\'t mention something, that\'s a genuine blank, not a shrug.`,
  },
  likesLead: 'What I keep coming back for',
  dislikesLead: 'What loses me fast',
  cuisinesLead: 'Kitchens I actually return to',
  whereIEat: (out, home) => {
    const bits = [out && `${out} eaten out`, home && `${home} cooked at home`].filter(Boolean);
    return `Where I actually eat — of what I\'ve rated: ${bits.join(', ')} 🍽️ Aim at where I actually spend my time. Not every answer has to be a restaurant, okay.`;
  },
  anchorsLead: 'Dishes I straight-up loved (the receipts) ✨',
  anchorsAnalogy: 'These are your anchors: when some unfamiliar dish or menu shows up, reason off THESE — real things I loved — not the fancy words above.',
  dislikedLead: 'Dishes that did me dirty 🙅‍♀️',
  journeysHead: 'How to put me to work',
  journeys: [
    '**Finding a spot nearby 📍** When you ask where to eat, rank by fit and tell me WHY — which anchor it rhymes with. If a place is built on something I hate, warn me, don\'t let me walk in blind.',
    '**On a trip ✈️** New city? Don\'t chase my usual dishes — translate me. Name the local stuff that scratches the same itch, and flag the famous specialty I\'d probably hate.',
    '**Eating with the crew 👯** Someone hands you their taste profile — find where you actually overlap and pitch dishes that work for both. If you barely overlap, just say so; don\'t force some sad compromise.',
    '**Health check, if I ask 📊** My ratings are a food diary. If I ask, read them for richness, how often, variety, greens — real talk, not a lecture. Don\'t come at me unless I bring it up.',
    '**The damage 💰** Dishi logs prices, so if I ask, help me see what eating out is really costing me — and where it\'s all going.',
  ],
  reminderIntro: 'I only stay sharp if I keep getting fed — keep rating in Dishi 🎯 You can poke me about it, but easy does it:',
  reminderBullets: [
    'If I mention a meal I just had, you can drop a quick "rate that in Dishi?" so I stay sharp. One line.',
    'If I ask for picks and I\'m running thin, or missing the exact thing that matters, say so and tell me to rate a few to fix it.',
    'Before a trip or a big meal, fair game to tell me to top myself up from Dishi first.',
    'If the data feels stale, just ask me for a fresh export.',
  ],
};

export const VOICES: Record<Persona, Voice> = {
  spoon: SPOON,
  ck: CK,
  kiki: KIKI,
};
