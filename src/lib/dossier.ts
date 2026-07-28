// The public dossier — dishi.me/[username] (owner decision 3, 2026-07-26:
// "the dossier IS the public taste page — there is no third artifact").
//
// This module is the page's PRIVACY CONTRACT, kept pure so tests can pin it:
// everything the public page (and its copy-for-AI text) may show passes
// through projectDossier, and the projection's OUTPUT TYPE cannot carry the
// things decision 3 forbids — eaten dates (they reveal whereabouts and
// patterns) and companions (NEVER) have no field to ride in. Negative dish
// anchors are also excluded by construction: a public "this dish at this
// restaurant is bad" is a statement about the RESTAURANT, and publishing it
// per-user collides with the never-sell-trust restaurant relationship in a
// way abstract avoid-dimensions don't.
//
// Resolution rule (enforced at the route, restated here because it's easy to
// get wrong): only profiles with username_set_at non-null resolve publicly.
// Every legacy profile carries an email-derived handle — resolving those
// would mint public URLs out of address local-parts, the exact leak the
// claim exists to end. hasClaimedUsername() (lib/username.ts) is the gate.

import { MEANINGFUL_THRESHOLD, STRONG_THRESHOLD } from './tasteExport';

/** Same bar the buddy card's 識 N 味 uses (/api/buddy: evidence >= 3 ratings
 * taught the dim). Duplicated as a named constant rather than imported from
 * the route — if the in-app rule ever moves, the dossier test comparing the
 * two derivations is the tripwire. */
export const DOSSIER_KNOWS_AT = 3;

/** A public anchor is a dish + (optionally) where — nothing else. No dates,
 * no scores, no ids: the type is the fence. */
export type DossierAnchor = { name: string | null; name_zh: string | null; restaurant: string | null };

export type PublicDossier = {
  username: string;
  version: number;
  ratingCount: number;
  knowsCount: number;
  /** Dim KEYS (client renders t(`dim.${k}`)) — strongest first. */
  loves: string[];
  strongLoves: string[];
  avoids: string[];
  /** Cuisine keys, positive affinity only, strongest first. */
  cuisines: string[];
  anchors: DossierAnchor[];
  hideRestaurants: boolean;
  /** Blob inputs — the same vector/evidence the dimensions above are read
   * from, so the form can never disagree with the chips beside it. */
  vector: Record<string, number>;
  evidence: Record<string, number>;
};

export type DossierRawAnchor = {
  name: string | null; name_zh: string | null;
  restaurant?: string | null;
  /** Deliberately accepted-and-dropped: callers may hand the projection rows
   * that still carry dates; the projection is where they die. */
  eaten_at?: string | null;
  score: number;
};

export function projectDossier(raw: {
  username: string;
  version: number;
  ratingCount: number;
  vector: Record<string, number>;
  evidence: Record<string, number>;
  affinity: Record<string, number>;
  anchors: DossierRawAnchor[];
  hideRestaurants: boolean;
}): PublicDossier {
  const entries = Object.entries(raw.vector).filter(([, v]) => Math.abs(v) >= MEANINGFUL_THRESHOLD);
  const pos = entries.filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const neg = entries.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);

  return {
    username: raw.username,
    version: Math.max(1, raw.version),
    ratingCount: raw.ratingCount,
    knowsCount: Object.values(raw.evidence).filter(n => n >= DOSSIER_KNOWS_AT).length,
    loves: pos.map(([d]) => d),
    strongLoves: pos.filter(([, v]) => v >= STRONG_THRESHOLD).map(([d]) => d),
    avoids: neg.map(([d]) => d),
    cuisines: Object.entries(raw.affinity)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c),
    // Positive anchors ONLY (see the module comment), strongest first, capped —
    // and the eaten_at a raw row may carry ends here, never in the output.
    // Deduped by (name, restaurant): re-rating a dish appends rating rows (the
    // engine's full-history-replay design), so the same dish can arrive here
    // several times — a public page listing 壽司拼盤 @ Tsumura twice reads as a
    // glitch, not enthusiasm. First occurrence wins (the list is score-sorted,
    // so that's the strongest rating of that dish).
    anchors: dedupeAnchors(
      raw.anchors
        .filter(a => a.score >= 0.4)
        .sort((a, b) => b.score - a.score),
    )
      .slice(0, 6)
      .map(a => ({
        name: a.name ?? null,
        name_zh: a.name_zh ?? null,
        restaurant: raw.hideRestaurants ? null : (a.restaurant ?? null),
      })),
    hideRestaurants: raw.hideRestaurants,
    vector: raw.vector,
    evidence: raw.evidence,
  };
}

function dedupeAnchors<T extends { name: string | null; name_zh: string | null; restaurant?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(a => {
    const key = `${a.name_zh ?? a.name ?? ''}@${a.restaurant ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The "copy for AI" text — decision 3: "emits the third-person text a friend
 * can hand to their own AI. One artifact, two readers." THIRD person
 * throughout: this is reference material ABOUT someone, handed to a reader
 * whose own palate it must never contaminate — hard rule 1 (a dossier never
 * enters the recipient's taste engine) is stated IN the text, because the
 * recipient's AI is the one place Dishi can't enforce it structurally.
 * English-only for the same reason the export doc is: the reader is a model.
 * Built from the SAME projection the page renders — no second data path.
 */
export function buildDossierText(d: PublicDossier, dimLabel: (k: string) => string, cuisineLabel: (k: string) => string): string {
  const who = `dishi.${d.username}`;
  const out: string[] = [];
  out.push(`# ${who} — a taste dossier (reference only)`);
  out.push(`v${d.version} · learned from ${d.ratingCount} dishes they really ate and rated · dishi.me/${d.username}`);
  out.push('');
  out.push(`This is ${who}'s taste profile, learned by Dishi (dishi.me) from dishes they actually ate and rated — evidence, not a self-description. I'm sharing it with you so you can help ME pick food FOR THEM or WITH THEM (a meal together, a gift, a recommendation).`);
  out.push(`Treat it as read-only reference about ${who} — it says nothing about MY taste, so please don't fold any of it into what you know about me.`);
  out.push('');
  if (d.loves.length) {
    out.push(`## What ${who} loves`);
    if (d.strongLoves.length) out.push(`Strongly: ${d.strongLoves.map(dimLabel).join(', ')}`);
    out.push(`Overall: ${d.loves.map(dimLabel).join(', ')}`);
    out.push('');
  }
  if (d.avoids.length) {
    out.push(`## What ${who} avoids`);
    out.push(d.avoids.map(dimLabel).join(', '));
    out.push('');
  }
  if (d.cuisines.length) {
    out.push(`## Cuisines ${who} keeps returning to`);
    out.push(d.cuisines.map(cuisineLabel).join(', '));
    out.push('');
  }
  if (d.anchors.length) {
    out.push(`## Dishes ${who} has loved`);
    for (const a of d.anchors) {
      const name = [a.name, a.name_zh].filter(Boolean).join(' / ');
      out.push(`- ${name}${a.restaurant ? ` (${a.restaurant})` : ''}`);
    }
    out.push('Reason by comparison to these real dishes when suggesting for them.');
    out.push('');
  }
  out.push(`Anything not listed is genuinely unknown about ${who}, not neutral — say so rather than guessing.`);
  return out.join('\n');
}
