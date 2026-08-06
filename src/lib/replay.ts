import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from './supabase/server';
import {
  emptyTaste, updateTaste, updateCuisineAffinity, bumpEvidence,
  updateTasteFromDuel, updateTasteFromDuelTie, bumpEvidenceFromDuel,
  calibratedScore, isExecutionConfounded, isExecutionSibling,
  type TasteVector, type EvidenceMap, type ExecutionSiblingKey,
} from './taste';
import {
  accumulateDomains, emptyDomainEvidence,
  accumulateDomainsT, emptyDomainEvidenceT, type DomainEvidenceT,
  accumulateDuel, emptyDuelVerdicts, type DuelVerdicts,
} from './domainEvidence';
import type { DomainEvidence } from './creatureForm';

/**
 * Rebuilds a user's ENTIRE taste profile from scratch by re-running every one of
 * their learning events — ratings AND answered duels — in original order through
 * the real learning functions, exactly as if each had just happened, but against
 * the dishes' CURRENT attributes.
 *
 * Why this exists: a dish record is a bundle (name, cuisine, attributes) derived
 * from one vision guess. When the person corrects the name, the attributes get
 * re-derived — but any event made BEFORE the correction already taught the profile
 * from the wrong attributes. Replay makes a correction retroactively heal the
 * learning itself, not just future scoring: the profile always reflects what the
 * person actually ate/chose, as currently best understood.
 *
 * Fidelity notes:
 * - ratings.voice_attributes is persisted, so spoken testimony replays exactly.
 * - ratings are upserted one-row-per-dish, so replay naturally applies each dish's
 *   FINAL score once — mirroring how a re-rate corrects rather than duplicates.
 * - Resolved duels replay using both dishes' CURRENT attributes, so a rename heals
 *   duel learning exactly as it heals ratings: a win through updateTasteFromDuel, a
 *   tie (揀唔落) through updateTasteFromDuelTie. Open/dismissed duels (answered_at
 *   null) are not learning events and are skipped.
 * - Deleted dishes cascade-delete both their ratings and their duels, so replay
 *   only ever sees events whose dishes still exist — same information the live
 *   profile would have after deletes.
 * - dish_duels is RLS-locked (a pending prediction must be invisible), so its rows
 *   are read via the admin client, scoped to this userId — never the user client,
 *   which no policy would let through.
 * - Each rating learns from its distance to the person's neutral point AS IT STOOD
 *   at that moment (see calibratedScore), rebuilt here from the scores of the
 *   ratings that preceded it. Duels don't move the centre — only flicks do — so
 *   they're skipped when accumulating it.
 *
 * At personal scale (tens to hundreds of events) this is a handful of milliseconds
 * of pure computation; there is no approximation involved.
 */
export async function replayProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  vector: TasteVector; evidence: EvidenceMap; cuisine_affinity: Record<string, number>;
  /** 骨 · what the palate lives on — the creature's body plan (domainEvidence.ts).
   *  Rebuilt here rather than incrementally so it heals on rename/re-rate exactly
   *  as the vector does, and so it is a pure function of history: same events in,
   *  same anatomy out, at any time. Deliberately carries NO wall-clock decay for
   *  that reason — "absence fades" belongs at read time, against updated_at. */
  domain_evidence: DomainEvidence;
  /** The TIMED sibling (G1, growth program): same events, same weights, plus a
   *  {v, at} clock per node so the metabolism can decay it at read time via
   *  domainsAsOf. Rebuilt in the same walk — the two records can only disagree
   *  about how much of the evidence time has kept, never about what was eaten. */
  domain_evidence_t: DomainEvidenceT;
  /** 對決 verdicts (G9): which variant won when two sub-nodes of one family
   *  were compared head to head. Breaks a contested tie the eating cannot. */
  duel_verdicts: DuelVerdicts;
  replayed: number;
  /** Per dish_id, the neutral point that dish's rating was scored against. */
  centers: Record<string, number>;
  /** How many ratings were dropped from learning as kitchen-attributable. */
  confounded: number;
} | null> {
  const [{ data: rows, error }, { data: duelRows }] = await Promise.all([
    supabase
      .from('ratings')
      // diet/ingredients/names ride along for the 骨 domain aggregate — the same
      // rows, one wider select, so domain evidence is rebuilt by the SAME replay
      // that heals the vector. A renamed dish therefore heals its anatomy too.
      .select('dish_id, score, execution_score, voice_attributes, created_at, dishes(attributes, cuisine, dish_identity_id, canonical_dish_id, diet, ingredients, name, name_zh)')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabaseAdmin()
      .from('dish_duels')
      // diet/ingredients/names ride along so a duel can say WHICH sub-nodes
      // fought — the same widening the ratings select above already carries.
      .select('winner, tied_at, answered_at, a:dishes!dish_a(id, attributes, diet, ingredients, name, name_zh), b:dishes!dish_b(id, attributes, diet, ingredients, name, name_zh)')
      .eq('user_id', userId)
      .not('answered_at', 'is', null),
  ]);
  if (error || !rows) return null;

  // One merged, time-ordered event stream so a duel answered between two ratings
  // learns in the position it actually happened — the vector's evidence-decayed
  // learning rate is order-sensitive, so interleaving must be faithful.
  /** What the 骨 register reads off a dish. Carried on the event so domain
   *  evidence replays in the same order, from the same rows, as everything else. */
  type DomainSource = { diet: string[] | null; ingredients: string[] | null; name: string | null; name_zh: string | null };

  type Event =
    | { t: number; kind: 'rating'; dishId: string; attrs: Record<string, number>; cuisine: string | null; score: number; voice: Record<string, number> | null; domain: DomainSource }
    | { t: number; kind: 'exposure'; dishId: string; domain: DomainSource }
    | { t: number; kind: 'duel'; winner: Record<string, number>; loser: Record<string, number>; winnerDomain: DomainSource; loserDomain: DomainSource }
    | { t: number; kind: 'tie'; a: Record<string, number>; b: Record<string, number> };

  const events: Event[] = [];
  let confounded = 0; // ratings the engine can now blame on the kitchen

  // Each rating is tested against its SIBLINGS — the same dish rendered by
  // another kitchen (canonical_dish_id, cross-venue) or the same kitchen on
  // another day (dish_identity_id, per-venue fallback). One shared rule,
  // isExecutionSibling, decides "same dish" here AND in /api/ratings — the two
  // paths must not drift. This is the whole basis of the confound rule: one
  // bad plate is ambiguous, one bad plate next to a good one is a verdict.
  const siblingKey = (r: any): ExecutionSiblingKey => ({
    dish_id: r.dish_id,
    canonical_dish_id: r.dishes?.canonical_dish_id ?? null,
    dish_identity_id: r.dishes?.dish_identity_id ?? null,
  });

  for (const r of rows as any[]) {
    const dish = r.dishes;
    if (!dish) continue; // defensive: rating without a joinable dish teaches nothing

    // A rating the engine can now attribute to the kitchen is not evidence about
    // this person's taste, so it leaves the learning stream ENTIRELY — no
    // vector, no evidence, no affinity, and (below) no contribution to the
    // neutral point either. A flick that wasn't about taste must not calibrate
    // how taste flicks are read. It still counts as a rating; see `replayed`.
    // (Self is excluded by dish_id inside the rule — ratings are unique per
    // user+dish, so identity of the row is identity of the dish.)
    const domain: DomainSource = {
      diet: dish.diet ?? null, ingredients: dish.ingredients ?? null,
      name: dish.name ?? null, name_zh: dish.name_zh ?? null,
    };

    const me = siblingKey(r);
    const siblings = (rows as any[])
      .filter(o => o.dishes && isExecutionSibling(me, siblingKey(o)))
      .map(o => o.execution_score as number | null);
    if (isExecutionConfounded(r.execution_score, siblings)) {
      confounded++;
      // The palate correctly ignores this flick — it was about the kitchen, not
      // the food. But the person DID eat the dish, and 骨 is a record of what a
      // body lives on, not of how it felt about one bad plate. So the domain
      // keeps the EXPOSURE and drops the opinion: a neutral-weight event.
      // Without this, someone whose only lobster was badly cooked would have
      // eaten lobster and grown nothing.
      events.push({ t: new Date(r.created_at).getTime(), kind: 'exposure', dishId: r.dish_id, domain });
      continue;
    }

    const voice = r.voice_attributes && Object.keys(r.voice_attributes).length ? r.voice_attributes : null;
    events.push({ t: new Date(r.created_at).getTime(), kind: 'rating', dishId: r.dish_id, attrs: dish.attributes ?? {}, cuisine: dish.cuisine, score: r.score, voice, domain });
  }

  for (const d of (duelRows ?? []) as any[]) {
    if (!d.a || !d.b || !d.answered_at) continue; // defensive
    const t = new Date(d.answered_at).getTime();
    if (d.tied_at) {
      // 揀唔落 — a tie. Symmetric; a/b order only sets the sign of the contrast.
      events.push({ t, kind: 'tie', a: d.a.attributes ?? {}, b: d.b.attributes ?? {} });
    } else if (d.winner) {
      const winnerDish = d.a.id === d.winner ? d.a : d.b.id === d.winner ? d.b : null;
      const loserDish = winnerDish === d.a ? d.b : d.a;
      if (!winnerDish || !loserDish) continue;
      const dom = (d: any): DomainSource =>
        ({ diet: d.diet ?? null, ingredients: d.ingredients ?? null, name: d.name ?? null, name_zh: d.name_zh ?? null });
      events.push({ t, kind: 'duel', winner: winnerDish.attributes ?? {}, loser: loserDish.attributes ?? {},
        winnerDomain: dom(winnerDish), loserDomain: dom(loserDish) });
    }
  }

  events.sort((x, y) => x.t - y.t);

  let vector = emptyTaste();
  let evidence: EvidenceMap = {};
  let affinity: Record<string, number> = {};
  let domains: DomainEvidence = emptyDomainEvidence();
  let domainsT: DomainEvidenceT = emptyDomainEvidenceT();
  let verdicts: DuelVerdicts = emptyDuelVerdicts();
  let replayed = 0; // ratings only — preserves rating_count-mirroring semantics
  const priorScores: number[] = []; // raw scores of ratings already applied
  // The centre each dish's rating actually learned from, so a caller can report
  // what a rating taught without re-deriving (and possibly disagreeing with) it.
  const centers: Record<string, number> = {};

  for (const e of events) {
    if (e.kind === 'rating') {
      const learned = calibratedScore(e.score, priorScores);
      centers[e.dishId] = e.score - learned;
      vector = updateTaste(vector, evidence, e.attrs, learned, e.voice);
      evidence = bumpEvidence(evidence, e.attrs, e.voice);
      affinity = updateCuisineAffinity(affinity, e.cuisine, learned);
      // Domains learn from the CALIBRATED score, like the vector: a person whose
      // flicks run cold must not read as disliking everything they eat.
      domains = accumulateDomains(domains, e.domain, learned);
      domainsT = accumulateDomainsT(domainsT, e.domain, learned, e.t);
      priorScores.push(e.score);
      replayed++;
    } else if (e.kind === 'exposure') {
      // Ate it; the flick told us nothing (see above). Neutral weight — passing
      // the score that makes DOMAIN_EXPOSURE the whole contribution.
      domains = accumulateDomains(domains, e.domain, 0);
      domainsT = accumulateDomainsT(domainsT, e.domain, 0, e.t);
    } else if (e.kind === 'duel') {
      vector = updateTasteFromDuel(vector, evidence, e.winner, e.loser);
      evidence = bumpEvidenceFromDuel(evidence, e.winner, e.loser);
      verdicts = accumulateDuel(verdicts, e.winnerDomain, e.loserDomain, false);
    } else {
      vector = updateTasteFromDuelTie(vector, evidence, e.a, e.b);
      evidence = bumpEvidenceFromDuel(evidence, e.a, e.b);
    }
  }

  // `replayed` counts ratings that TAUGHT, mirroring rating_count's meaning for
  // the learning rate. Execution-confounded ones are added back: the person did
  // rate the dish, so gates built on rating_count (the seal gate, export
  // confidence) must still see it — only the palate ignores it.
  return { vector, evidence, cuisine_affinity: affinity, domain_evidence: { ...domains, duels: verdicts }, domain_evidence_t: { ...domainsT, duels: verdicts }, duel_verdicts: verdicts, replayed: replayed + confounded, centers, confounded };
}
