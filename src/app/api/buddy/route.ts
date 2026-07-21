import { NextResponse } from 'next/server';
import { supabaseServer, supabaseAdmin } from '@/lib/supabase/server';
import { emptyTaste, contentScore } from '@/lib/taste';
import {
  engineConfidence, buddyElements, growthHint, exploredDims, UNLOCK_CONFIDENCE,
} from '@/lib/buddy';
import { versionForProfile, ratchetVersion } from '@/lib/version';
import { stakeSeal, type SealableDish } from '@/lib/sealStake';

/**
 * GET  /api/buddy -> { species | null, state } — state computed fresh from the user's
 *                    real ratings/profile every call, so the buddy can never drift
 *                    out of sync with the engine it visualizes.
 * POST /api/buddy  { species } -> adopt (or switch) a buddy. Cosmetic only: all
 *                    growth state derives from data, so switching species never
 *                    resets progress.
 */
export async function GET() {
  const supabase = supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const [{ data: buddy }, { data: profile }, { data: myRatings }] = await Promise.all([
    supabase.from('buddies').select('species').eq('user_id', user.id).maybeSingle(),
    supabase.from('taste_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('ratings').select('dish_id').eq('user_id', user.id),
  ]);

  // Distinct real cuisines the user has rated.
  const dishIds = (myRatings ?? []).map(r => r.dish_id);
  let distinctCuisines = 0;
  if (dishIds.length) {
    const { data: dishes } = await supabase.from('dishes').select('cuisine').in('id', dishIds);
    distinctCuisines = new Set(
      (dishes ?? []).map(d => d.cuisine).filter(c => c && c !== 'unknown'),
    ).size;
  }

  const inputs = {
    ratingCount: profile?.rating_count ?? 0,
    distinctCuisines,
    vector: profile?.vector ?? emptyTaste(),
    cuisineAffinity: profile?.cuisine_affinity ?? {},
  };

  // ONE confidence number drives the bar, the % readout, and (via the shared
  // scale) the export unlock — rebased off the old flick-count XP (spec §2).
  const confidence = engineConfidence(inputs);

  // ── dishi version (the unbounded ladder that replaced Levels) ──────────────────
  // Live version from the same inputs as everything above; the STORED version is a
  // ratcheted unlock history (only ever rises — see version.ts). On the moment a NEW
  // version unlocks, the engine stakes ONE sealed prediction: its strongest-
  // confidence call about a dish the user hasn't rated yet — every 「dishi v{n}
  // 已經解鎖」 ships with the engine putting its reputation on the line. GET-with-
  // side-effect matches the existing lazy-seal pattern on profile load.
  const live = versionForProfile({
    ratingCount: inputs.ratingCount,
    exploredDimCount: exploredDims(inputs.vector).length,
    distinctCuisines,
  });
  const stored = profile?.version_unlocked ?? 0;
  const unlocked = ratchetVersion(stored, live.version);
  let justUnlockedTo: number | null = null;
  if (unlocked > stored && profile) {
    const { error: ratchetErr } = await supabase
      .from('taste_profiles').update({ version_unlocked: unlocked }).eq('user_id', user.id);
    if (!ratchetErr) {
      justUnlockedTo = unlocked;
      await autoSealOnUnlock(supabase, user.id, dishIds, profile).catch(() => {
        /* the unlock itself must never fail on the celebration seal */
      });
    }
  }

  return NextResponse.json({
    species: buddy?.species ?? null,
    state: {
      strength: Math.round(confidence * 100),
      version: {
        v: unlocked,               // ratcheted — what the UI names ("dishi v2")
        live: live.version,        // may sit below v after deletions; bar uses live progress
        progress: live.progress,   // 0..1 toward the next version
        nextAt: live.nextAt,
        justUnlockedTo,            // non-null exactly once, on the unlock that just happened
      },
      // The AI-export unlock threshold (為食鬼/Gourmand), as a %, so clients — e.g. the
      // rating-flow growth screen — can show honest progress toward "Taste AI ready".
      unlockAt: Math.round(UNLOCK_CONFIDENCE * 100),
      elements: buddyElements(inputs),
      hint: growthHint(inputs),
      // Capability honesty: which dimensions the engine genuinely knows (>= 3
      // ratings taught them) vs is still learning. Lets the Buddy speak in terms
      // of what it CAN and CAN'T do yet — under-promise, visibly grow — instead of
      // implying an accuracy it doesn't have.
      knows: Object.entries((profile?.evidence ?? {}) as Record<string, number>)
        .filter(([, n]) => n >= 3).map(([d]) => d),
      learning: Object.entries((profile?.evidence ?? {}) as Record<string, number>)
        .filter(([, n]) => n > 0 && n < 3).map(([d]) => d),
      stats: {
        ratings: inputs.ratingCount,
        cuisines: distinctCuisines,
        dims_explored: exploredDims(inputs.vector).length,
        dims_total: 18,
      },
      // Raw materials for the deterministic taste form (blobForm.ts) — the
      // SAME vector/evidence/count the rest of this response is computed
      // from, so the form can never show something the buddy stats disagree
      // with. profile_version seeds the form's identity and bumps on export.
      vector: inputs.vector,
      evidence: profile?.evidence ?? {},
      profile_version: profile?.profile_version ?? 1,
    },
  });
}

/**
 * The version-unlock auto-seal (backlog item 2, folded into the ladder): among the
 * user's UNRATED dishes with real attributes and no existing seal, stake ONE sealed
 * prediction on the dish the engine feels STRONGEST about (max |contentScore| —
 * conviction either direction counts; a confident "you won't like this" is as much
 * reputation on the line as a confident hit). Reuses sealed_predictions + the reveal
 * flow wholesale — no new tables, no new UI. If no candidate exists, stake nothing:
 * a filler seal would be the engine pretending conviction it doesn't have.
 */
async function autoSealOnUnlock(
  supabase: ReturnType<typeof supabaseServer>,
  userId: string,
  ratedDishIds: string[],
  profile: { vector?: Record<string, number>; cuisine_affinity?: Record<string, number>;
             evidence?: Record<string, number>; rating_count?: number; profile_version?: number },
) {
  const { data: dishRows } = await supabase
    .from('dishes')
    .select('id, attributes, cuisine')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200);
  const rated = new Set(ratedDishIds);
  const candidates: SealableDish[] = ((dishRows ?? []) as SealableDish[])
    .filter(d => !rated.has(d.id) && d.attributes && Object.keys(d.attributes).length > 0);
  if (!candidates.length) return;

  const admin = supabaseAdmin();
  const { data: sealedRows } = await admin
    .from('sealed_predictions').select('dish_id').eq('user_id', userId)
    .in('dish_id', candidates.map(d => d.id));
  const sealed = new Set((sealedRows ?? []).map(r => r.dish_id));

  const vector = profile.vector ?? {};
  const affinity = profile.cuisine_affinity ?? {};
  const best = candidates
    .filter(d => !sealed.has(d.id))
    .map(d => ({ d, conviction: Math.abs(contentScore(vector, d.attributes, affinity, d.cuisine ?? undefined)) }))
    .sort((a, b) => b.conviction - a.conviction)[0];
  if (!best || best.conviction <= 0) return; // zero conviction = nothing honest to stake

  await stakeSeal(admin, userId, best.d, profile);
}

// POST (adopt/switch a species) is retired: the species picker UI is gone —
// the taste form IS the companion now (Session A §3, option (a)). GET still
// returns the stored species so the one-time "your buddy evolved" migration
// card can fire for users who had one; the buddies table itself stays for that
// read until the migration moment has been seen broadly, then can be dropped.
