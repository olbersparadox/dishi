# Spec: dishi — your AI palate (export redesign)

**Tier: [F] — use Opus.** Rewrites the export's identity, gates it behind an
earned unlock, and rebases the buddy level bar onto engine confidence (engine-
adjacent: simulation-honest treatment required for the level curve).

## The reframe

"Prompt export" dies. The user doesn't export a document — they send **dishi,
their AI palate** (tie-in: dishi.me), to live inside their own assistant. The
export IS a persona speaking as the user's palate, in a voice the USER chose.
It must never read as a marketing bot pasted into someone's AI: taste science
and the user's real eating history are the content; the app is mentioned only
as "where I live" and within the existing hard anti-nag limits (keep those
verbatim from the current buildTastePrompt — they are the trust contract).

## 1. Unlock gate (no day-1 export)

- First export is LOCKED until the engine genuinely knows enough to make a
  difference. Threshold: the existing 'emerging' confidence tier boundary in
  tasteExport.ts (single source of truth — do not invent a second threshold).
- Locked state on the Taste tab replaces the export section: the bar (below) +
  copy in anticipation register, e.g. 你嘅味蕾仲未成形 — 再評 {n} 味，dishi 就
  可以搬入你個 AI. Never apologetic, never a dead button.
- Unlock is an EVENT: one-time moment (existing reveal/celebration patterns —
  rated-banner / seal-reveal register, not confetti) leading straight into
  persona choice + first send.
- Tutorial fast path: the locked copy links the 相簿舊相 entry path — rating a
  handful of old foodshots is the designed day-1 route to first unlock.

## 2. The bar: level = confidence, with honest endowed progress

- Rebase the buddy level bar (buddy.ts + TasteFormCard) from flick-count XP to
  ENGINE CONFIDENCE — one bar, one meaning: "how much dishi actually knows."
  Derive from the same inputs as the export confidence tiers (rating count +
  learned-dims coverage). Keep level names (初生蛋 → … → 餐檯傳說); map bands
  onto the confidence scale. First unlock sits at the 'emerging' boundary.
- **Endowed Progress, honestly:** day-1 bar starts visibly non-zero (~25%) but
  every point is CREDIT FOR REAL ACTS that feed the engine — account created,
  first scan, first dish logged, first rating each deposit visible progress.
  No fictional prefill: the psychological head start comes from crediting
  genuine onboarding steps, consistent with the 識咗/摸緊 honesty ethos.
- Post-unlock, the same bar counts toward the NEXT version: caption becomes
  e.g. v4 就緒仲差 {n} 味 — level-up = "a newer dishi is ready to send," with
  the delta preview (computeExportDelta — already built) showing what it
  learned since last send.

## 3. Persona choice (the user's creation, not our export)

- At unlock, the user picks dishi's voice. v1: THREE personas, EXPORT VOICE
  ONLY (in-app copy unchanged — per-persona app localization is deferred):
  - 老實派 (the honest one): plain, precise, science-forward.
  - 食家腔 (the connoisseur): warm, literary, a little grand.
  - 貪玩 (the playful one): cheeky, vivid, HK code-switching energy.
- Changeable later in settings; re-export re-renders in the new voice.
- Future levels unlock more personas/perks — architecture must make adding a
  persona = adding a voice profile, not forking the builder. Level 10 粗口
  mode is the canonical future example (both in-app and export voice) — NOT in
  v1; leave a clean seam. When it ships, frame as flavor not guarantee (the
  user's AI may decline to swear; that's the assistant's call).
- Persist choice (taste_profiles column or profile jsonb — implementer's call;
  record migration in supabase/applied/ if a column is added).

## 4. The persona document (rewrite of buildTastePrompt)

Same extracted sections (extractTasteSections unchanged), new rendering:

- **Header:** `dishi — {user}'s AI palate · v{N} (fed {count} dishes) ·
  dishi.me` + supersede rule (newer version replaces older).
- **Voice:** first person AS the palate, in the chosen persona. It knows what
  he finished, ordered twice, left on the plate — evidence-first framing.
- **Taste science section:** dims rendered as character traits with the
  existing confidence honesty (weak signals stated as "still watching").
- **Anchors:** loved/disliked dishes with restaurant names; as levels rise the
  payload grows — add dates, home-cook vs dining-out patterns (dishes.source
  is in the data now), cuisines map, and at higher levels drift-over-time
  notes. Define payload-per-level-band explicitly in code (a table, not vibes).
- **Role section:** quietly be the food reference — trip planning, ordering,
  cooking; surface local-dish analogies when travelling. Keep the five co-use
  journeys' substance, rewritten in persona voice.
- **Keep verbatim in substance:** the hard limits block (mention Dishi at most
  once per conversation, drop on brush-off, usefulness outranks promotion) and
  the "absent = unknown, not neutral" epistemic line. These survive every
  persona; 貪玩 gets to be funny AROUND them, not about them.
- English-carrier with Cantonese code-switching for dish/dim terms (current
  export's language rationale stands: the reader is an AI).

## 5. UI (Taste tab)

- Export section renamed throughout: the feature is "dishi — 你嘅 AI 味蕾" /
  "dishi — your AI palate". Kill every remaining "export prompt" string.
- Locked: bar + anticipation copy + album-path link. Unlocked: persona picker
  (first time), send/copy action (existing clipboard flow), version + "what's
  new in v{N}" delta line, next-version progress underneath.
- Blob visual participation: OUT of v1 (explicitly deferred by owner).

## 6. Tests + verification

- Level rebase: unit-test the confidence→level mapping bands; onboarding
  credits deposit exactly once each; bar monotonic under replay.
- Persona rendering: all three personas produce the hard-limits block and the
  header/version line; snapshot-style tests per persona at thin/emerging/solid.
- Unlock gating: below threshold no export path renders; crossing it once
  fires the unlock state exactly once.
- i18n parity for all new keys.
- Simulation-honest check for the level curve: replay existing real profiles
  (or sim users) through the new mapping and eyeball that levels don't regress
  for active users vs the old XP levels — nobody should OPEN the app and find
  their buddy demoted. If the mapping demotes real users, bias bands until it
  doesn't and note it in the commit.

## Acceptance

- tsc clean; npm test green.
- Manual: fresh account → bar starts ~25% from onboarding credits with the
  acts visibly credited; rate up through the threshold via 相簿舊相 → unlock
  moment → pick 貪玩 → sent document reads as a character, names dishi.me once
  in the header and once as "where I live," contains zero marketing prose;
  existing mature account → not demoted, sees "v{N} ready" framing.
