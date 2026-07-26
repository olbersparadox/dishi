'use client';
// The album-batch rating flow (rating-flow revamp), rendered as an OVERLAY on top
// of the Taste AI page so the drag-and-rate glass shows the live section blurred
// behind it (the page beneath stays mounted — the parent just conditionally renders
// this). You multi-select a roll; it becomes a flick STACK → the "watch your Taste AI
// learn" screen (reward + light review MERGED; the standalone review screen skipped).
//
// FLOW: pick → flick stack → the growth/refine screen.
//
// REAL WIRING (phase 1): a flicked card kicks off the REAL pipeline — create the dish
// from its photo (vision), then SEAL, then record the held flick score, then enrich —
// and streams each dish's real state into TasteGrowth. Nothing is simulated here.
//
// THE SEALED-BET CONTRACT (do not break): a sealed prediction must be written BEFORE
// the rating is recorded. The user flicks fast, so we CREATE the dish → POST /api/seals
// → and only THEN POST /api/ratings (the flick score is held until the seal is written).
// The prediction is thus sealed before the rating lands server-side — the honest
// reading of "written before the user rates". The client never sees a pending
// prediction; /api/seals returns only { sealed } and /api/ratings reveals on rating.
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { normalizePhoto } from '@/lib/image';
import { readPhotoMeta, type PhotoMeta } from '@/lib/photoMeta';
import { pickPlaceContext, type PickRestaurant } from '@/lib/pickContext';
import SnapRating from '@/components/SnapRating';
import TasteGrowth, { type GrowDish, type GrowPlace, type NameEdit } from '@/components/TasteGrowth';
import IdentityConfirmCard from '@/components/IdentityConfirmCard';
import SealRevealBadge, { type SealResult } from '@/components/SealRevealBadge';
import type { DuelDish } from '@/components/DuelSide';
import ExecutionSlider, { type ExecutionRow } from '@/components/ExecutionSlider';
import type { FormInputs } from '@/lib/blobForm';

type Phase = 'flick' | 'grow';
type Prepared = { file: File; url: string; meta: PhotoMeta };

/** A dish that ALREADY EXISTS and is waiting to be rated (待評菜式 — a menu-scan or
 *  shared-table pick). Rated through the same flick → growth flow as an album batch,
 *  but nothing is created and nothing may ever be deleted: see `picksMode` below. */
export type ExistingPick = {
  dishId: string;
  photoUrl: string | null;
  name: string;
  name_zh: string | null;
  coords: { lat: number; lng: number } | null;
  /** The restaurant this pick was created AT (scan/table). Known context must ride
   *  with the dish: the growth card shows it fixed, and the nearby guess never runs
   *  (its optimistic persist could overwrite this) — see pickContext.ts. */
  restaurant: PickRestaurant | null;
};

/** A dish CREATED (and, per the typed-quick-add design, already ENRICHED) by
 *  TypedQuickAdd BEFORE this component ever mounts — 打字 (backlog 2026-07-22,
 *  item 3). Unlike `photos`, there is no upload/vision step here; unlike
 *  `picks`, this dish is genuinely new to the session and gets discarded on
 *  cancel/skip like a photo would. See runTypedPipeline. */
export type TypedEntry = {
  dishId: string;
  name: string;
  name_zh: string | null;
  cuisine: string | null;
  ingredients: string[];
  diet: string[];
  heaviness: string | null;
  coords: { lat: number; lng: number } | null;
};

const freshDish = (url: string | null, score: number): GrowDish => ({
  photoUrl: url, score, status: 'creating', dishId: null, isDish: true,
  name: '', name_zh: null, cuisine: null, ingredients: [], diet: [], heaviness: null, enriched: false,
  coords: null, nearby: [], placeLoading: false, hasLocation: false, choice: null,
});

export default function RatingStack({ photos, picks, typed, userId, onExit }: {
  /** Album/camera batch: brand-new dishes get CREATED from these files. */
  photos?: File[];
  /** Queued picks: dishes that already exist and only need sealing + rating. */
  picks?: ExistingPick[];
  /** 打字 quick-add: a dish already created + enriched, needing only sealing + rating. */
  typed?: TypedEntry[];
  userId: string;
  onExit: () => void;
}) {
  const { t, lang } = useLang();
  // Normalize every photo up front with the SAME util the /log flow uses (image.ts):
  // HEIC → JPEG (Chrome can't render HEIC, vision can't read it) AND downscale to
  // ≤1600px. The downscale is what prevents the 413: a modern phone photo is 8-10MB
  // and Vercel's edge rejects bodies over ~4.5MB before our route ever runs — observed
  // live (first photo of a field session bounced, silently). EXIF (GPS + taken-at) is
  // read from the ORIGINAL file BEFORE conversion — the canvas re-encode strips it.
  // null = still decoding.
  const [prepared, setPrepared] = useState<Prepared[] | null>(null);
  // picksMode: rating dishes that ALREADY EXIST. Nothing is uploaded or created, and
  // — the load-bearing part — nothing this session may ever be deleted, because these
  // dishes were not ours to make. See cancelSession + the ✕ handling at the bottom.
  const picksMode = !!picks?.length;
  // typedMode: a dish 打字-created + enriched by TypedQuickAdd BEFORE this component
  // mounted (see TypedEntry). Nothing to upload or decode, but — unlike picksMode —
  // it IS ours to discard: see the sessionDishIds seed effect and runTypedPipeline.
  const typedMode = !!typed?.length;
  useEffect(() => {
    if (picksMode || typedMode) return;    // no files to decode
    const files = photos ?? [];
    let alive = true; let made: string[] = [];
    Promise.all([Promise.all(files.map(f => normalizePhoto(f))), Promise.all(files.map(readPhotoMeta))]).then(([fs, metas]) => {
      if (!alive) return;
      made = fs.map(f => URL.createObjectURL(f));
      setPrepared(fs.map((file, i) => ({ file, url: made[i], meta: metas[i] })));
    });
    return () => { alive = false; made.forEach(u => URL.revokeObjectURL(u)); };
  }, [photos, picksMode]);

  const [idx, setIdx] = useState(0);
  const [dishes, setDishes] = useState<GrowDish[]>([]); // one per RATED card (skips omitted)
  const [phase, setPhase] = useState<Phase>('flick');
  // EVERY seal this session broke, lifted off the /api/ratings responses (see
  // `rate` below) and shown on the growth screen — the session's own end-state,
  // which is where the person actually is when they land. It deliberately does
  // NOT live on the profile page any more: rating no longer navigates anywhere
  // (RatingStack is an overlay), so the old sessionStorage + ?rated=1 handoff had
  // nothing left to hand off to.
  //
  // ALL of them, not just the first: `revealed_at` is one-way, so a batch that
  // breaks five seals and renders one has destroyed four. Each verdict is stamped
  // on its OWN dish row (SealResult.dish → TasteGrowth's sealSlots) — that
  // attribution is what makes several legible rather than a stack of anonymous
  // cards.
  const [sealReveals, setSealReveals] = useState<SealResult[]>([]);
  // 佢哋整得點？ cards waiting for the growth screen. A queue rather than a single
  // card because an album batch can rate several plates worth asking about; they
  // are drained one at a time so the person is never stacked up on.
  const [executionQueue, setExecutionQueue] = useState<ExecutionRow[][]>([]);
  // Recovered reveals are held SEPARATELY from this session's own, so the render
  // order is deterministic rather than a race between the rating POST and the
  // recovery GET: this session's verdict leads (it's about the dish just rated),
  // older recovered ones follow. One combined list would order by whichever
  // request resolved first, which differs run to run.
  const [recoveredReveals, setRecoveredReveals] = useState<SealResult[]>([]);
  // Acknowledge that a reveal actually reached the screen. Until this lands the
  // row stays recoverable, so a crash between the rating and the render no
  // longer destroys the verdict (see /api/seals/displayed). Fire-and-forget is
  // correct HERE and only here: a failed ack costs a duplicate reveal later,
  // which is the safe direction to fail in.
  const markSealDisplayed = (id?: string) => {
    if (!id) return;
    fetch('/api/seals/displayed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  };
  // Reveals a PREVIOUS session computed but never showed (browser closed mid-flow,
  // crash, the render bug's failure mode). Picked up when this session reaches the
  // growth screen so they land in context — a rating screen — rather than ambushing
  // the person on an unrelated page. Only ever decided verdicts: the endpoint is
  // hard-filtered on revealed_at, so no pending seal can leak through here.
  useEffect(() => {
    if (phase !== 'grow') return;
    let alive = true;
    fetch('/api/seals/displayed')
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        const missed: SealResult[] = j?.seals ?? [];
        if (!alive || !missed.length) return;
        setRecoveredReveals(missed);
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);
  // Ack a RECOVERED reveal only once it actually has a row to be stamped on.
  // A verdict now lives beside its dish's name, so a recovered one whose dish
  // isn't in this session has nowhere to render — acking it on arrival (what the
  // old top-of-screen card stack could safely do, since it rendered everything
  // unconditionally) would mark it "seen" while showing nobody anything, which is
  // the exact failure class displayed_at exists to prevent. Unmatched ones are
  // left alone and stay recoverable for a session that does rate that dish.
  const ackedRecovered = useRef<Set<string>>(new Set());
  useEffect(() => {
    const fresh = recoveredReveals
      .filter(r => r.id && !ackedRecovered.current.has(r.id)
        && r.dish?.id && dishes.some(d => d.dishId === r.dish!.id))
      .map(r => r.id as string);
    if (!fresh.length) return;
    fresh.forEach(id => ackedRecovered.current.add(id));
    markSealDisplayedMany(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredReveals, dishes]);
  const markSealDisplayedMany = (ids: string[]) => {
    if (!ids.length) return;
    fetch('/api/seals/displayed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }).catch(() => {});
  };
  // The REAL engine state (from /api/buddy) that drives the growth bar — the dishi
  // version ladder: progress toward the NEXT version (toward v1 while locked), and
  // the ratcheted version number for the unlocked line. Refreshed as ratings +
  // enrichment land (both move the profile).
  const [engine, setEngine] = useState<{ fill: number; ready: boolean; v: number; hintKey: string; hintParams?: Record<string, number>; justUnlocked?: boolean } | null>(null);
  // The REAL profile inputs behind the growth screen's header blob — the same
  // vector/evidence/ratingCount/seed blobForm.ts consumes everywhere else, so the
  // shape growing in front of the user IS their actual identity, not a mock. Same
  // response as `engine` above; refreshed together so the bar and the blob can never
  // show two different moments of the profile.
  const [blobInputs, setBlobInputs] = useState<FormInputs | null>(null);
  const baselineV = useRef<number | null>(null); // version at session start (see justUnlocked)
  // While any rating session is open, hide the Taste-AI page's own blob behind the
  // glass (body class → .taste-blob-anchor). The overlays here are deliberately
  // translucent — the page glows through — but two blobs reading at once looked like
  // a mistake; the only blob on screen should be the growth header's.
  useEffect(() => {
    document.body.classList.add('rating-open');
    return () => document.body.classList.remove('rating-open');
  }, []);
  const refreshBuddy = async () => {
    try {
      const j = await fetch('/api/buddy').then(r => (r.ok ? r.json() : null));
      const s = j?.state;
      const vz = s?.version;
      if (!vz || typeof vz.progress !== 'number') return;
      // Remember the version the session STARTED at, so 「已經解鎖」 fires only when
      // the ladder actually moves in front of the user — not on every visit forever.
      if (baselineV.current === null) baselineV.current = vz.v;
      setEngine({
        fill: Math.min(100, vz.progress * 100),
        ready: vz.v >= 1,          // v1 ≡ the export unlock, by construction
        v: vz.v,
        hintKey: s.hint?.key ?? 'buddy.hint.tune',
        hintParams: s.hint?.params,
        justUnlocked: vz.v > (baselineV.current ?? vz.v),
      });
      setBlobInputs({
        vector: s.vector ?? {}, evidence: s.evidence ?? {},
        ratingCount: s.stats?.ratings ?? 0, seed: `${userId}:v${s.profile_version ?? 1}`,
      });
    } catch { /* keep the last good reading */ }
  };
  // Read the engine ONCE ON MOUNT, before anything is rated. Without this the growth
  // screen opened with no reading at all and fell back to a synthetic bar that started
  // at a fixed BASE and then snapped to the truth — so the bar appeared to begin at an
  // earlier level than the person is actually at, and the locked line guessed "v1" even
  // for someone long past it. Seeding the real pre-session value means the bar starts
  // where they genuinely are and only ever moves on real learning.
  useEffect(() => { refreshBuddy(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const countRef = useRef(0); // stable index into `dishes` for out-of-order pipeline patches
  const sessionDishIds = useRef<string[]>([]); // every dish this session created (for cancel)
  // The source (file + EXIF) behind each RATED card, kept so a failed upload can be
  // retried in place — the File is still in memory, no re-pick needed.
  const ratedSrc = useRef<Record<number, Prepared>>({});
  // Same idea for typedMode: the TypedEntry behind each rated card, for onRetry.
  const typedSrc = useRef<Record<number, TypedEntry>>({});
  // Per-dish rename generation: guards force-enrich responses against staleness (two
  // quick renames — only the latest response may land) and lets TasteGrowth know when
  // a REAL post-rename derivation arrived (GrowDish.enrichGen).
  const renameGen = useRef<Record<number, number>>({});
  // A growth-screen rename fires its PATCH detached (the user has already moved on)
  // — but the Taste tab refetches its 已評菜式 list the instant exit fires, so an
  // in-flight rename can lose that race and the tab shows the pre-rename name until a
  // manual reload (backlog 1d). Track it here and drain before actually exiting —
  // same discipline as sessionDishIds/discardAndExit uses for deletes.
  const pendingRenames = useRef<Promise<unknown>[]>([]);

  const patch = (i: number, upd: Partial<GrowDish>) =>
    setDishes(prev => prev.map((d, j) => (j === i ? { ...d, ...upd } : d)));

  // typedMode dishes are created by TypedQuickAdd BEFORE this component mounts (so the
  // blank card can already carry enriched chips) — seed sessionDishIds immediately,
  // not inside runTypedPipeline on flick, so an exit BEFORE ever flicking (✕ on the
  // very first card, or skipping the only card) still discards the just-created,
  // unrated dish instead of leaking it. Mount-once: typed is a single fixed batch.
  useEffect(() => {
    if (typed?.length) sessionDishIds.current.push(...typed.map(e => e.dishId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delete every dish THIS session created and never kept, then exit. Shared by the
  // ✕ (cancelSession) and by "nothing was rated" (gotoNextOrGrow) — both are the same
  // "walk away from what was never confirmed" outcome. picksMode/an all-skipped photo
  // batch both leave sessionDishIds empty, so this is a harmless bare onExit() for them.
  // AWAITED, deliberately: these used to be fired off and abandoned while onExit() ran
  // immediately, so the Taste-AI page refetched its lists BEFORE the deletes landed and
  // the discarded dishes were still sitting in 已評菜式 until a manual page refresh.
  // allSettled (not all) so one failed delete can't strand the user in the sheet.
  const discardAndExit = async () => {
    const ids = sessionDishIds.current;
    sessionDishIds.current = [];
    if (ids.length) {
      await Promise.allSettled(ids.map(id =>
        fetch('/api/my/dishes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_id: id }) })));
    }
    await finishExit();
  };
  const cancelSession = async () => {
    // picksMode NEVER deletes: those dishes existed before this screen opened (a
    // menu-scan pick, already sealed) and discarding them would destroy something the
    // person deliberately queued. Their ✕ is a plain close — a flicked rating stands,
    // correctable through 重新評分 in 食記, which replays the whole history honestly.
    if (picksMode) { await finishExit(); return; }
    await discardAndExit();
  };
  // Single choke point for actually leaving the sheet: drain any in-flight rename
  // before letting the parent (RatingStack's onExit) refetch the Taste tab's list —
  // see pendingRenames above.
  const finishExit = async () => {
    if (pendingRenames.current.length) await Promise.allSettled(pendingRenames.current);
    onExit();
  };

  // 係咪同一味？ — the log-time identity trigger (backlog 2026-07-22). Once a
  // just-logged dish has a restaurant, its name may fuzzy-match a dish_identity
  // already known there; gates 1+2 run server-side and return at most one
  // candidate, and the confirm card appears inline on the growth screen.
  // HARD CAP (spec): one identity question per log session — the ref flips the
  // moment a suggestion is SHOWN and never resets. No cards on the Taste tab.
  const [identityAsk, setIdentityAsk] = useState<{ mine: DuelDish; other: DuelDish } | null>(null);
  const identityShown = useRef(false);
  const probeIdentity = async (dishId: string, mine: { name: string; name_zh: string | null; photoUrl: string | null }) => {
    if (identityShown.current) return;
    try {
      const res = await fetch(`/api/dishes/identity?dish_id=${dishId}`);
      const j = res.ok ? await res.json() : null;
      if (j?.suggestion && !identityShown.current) {
        identityShown.current = true;
        setIdentityAsk({
          mine: {
            id: dishId, name: mine.name, name_zh: mine.name_zh,
            photo_url: mine.photoUrl, restaurant: j.suggestion.restaurant ?? null,
          },
          other: {
            id: j.suggestion.dish_id, name: j.suggestion.name, name_zh: j.suggestion.name_zh ?? null,
            photo_url: j.suggestion.photo_url ?? null, restaurant: j.suggestion.restaurant ?? null,
          },
        });
      }
    } catch { /* silence is the correct default — a wrong ask is worse than none */ }
  };

  // Persist (or clear) a dish's restaurant — same resolution the log flow uses.
  const persistPlace = (dishId: string, place: GrowPlace | null) => {
    const body = !place
      ? { dish_id: dishId, clear: true }
      : place.source === 'dishi'
        ? { dish_id: dishId, restaurant_id: place.restaurant_id }
        : { dish_id: dishId, new_restaurant: { name: place.label, lat: place.lat, lng: place.lng, place_id: place.place_id } };
    return fetch('/api/dishes/restaurant', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);
  };

  // ── Shared pipeline steps (reused by the first run AND a not-a-dish reclassify) ──
  const seal = (dishId: string) =>
    fetch('/api/seals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dish_id: dishId }) }).catch(() => {});
  // The rating POST is ALSO the seal reveal: /api/ratings breaks any pending seal
  // for this dish and returns it, and `revealed_at` is one-way — a response we
  // don't read is a seal permanently consumed with no payoff. (That is exactly
  // what regressed: the old /log page read `json.seal` into sessionStorage and
  // navigated to /profile?rated=1; when /log was killed 2026-07-22 the reveal
  // lost its only producer and every rating since has silently burned its seal.)
  // So this must stay await-and-parse, never fire-and-forget.
  const rate = async (
    dishId: string, score: number,
    dish?: { name: string; name_zh?: string | null },
  ): Promise<void> => {
    try {
      const res = await fetch('/api/ratings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dish_id: dishId, score }),
      });
      if (!res.ok) return;
      const json = await res.json().catch(() => null);
      // Keep EVERY seal the session breaks, tagged with the dish it belongs to.
      // Dropping any of them would silently consume a one-way `revealed_at`.
      if (json?.seal) {
        const withDish: SealResult = {
          ...json.seal,
          dish: dish ? { id: dishId, name: dish.name, name_zh: dish.name_zh ?? null } : null,
          // What THIS rating taught — rides on ITS seal, since the reveal balloon
          // is the only place it's shown now (the session-wide banner above the
          // dish rows was retired 2026-07-26). A rating with no seal teaches the
          // engine just the same; it just has nowhere on screen to say so.
          taught: Array.isArray(json.taught) && json.taught.length ? json.taught : undefined,
        };
        setSealReveals(cur => [...cur, withDish]);
        markSealDisplayed(json.seal.id);
      }
      // 佢哋整得點？ — queued, never shown mid-flick. The server decides whether
      // to ask and what range the flick permits (see /api/ratings); this side
      // only obeys, so the two can't drift. Queued cards are drained on the
      // growth screen, after the stack is done — interrupting a batch of album
      // photos to ask about one plate would break the flick rhythm the whole
      // rating flow is built around.
      if (Array.isArray(json?.execution?.rows) && json.execution.rows.length) {
        setExecutionQueue(cur => [...cur, json.execution.rows]);
      }
    } catch { /* a lost rating already shows as a failed card; don't mask it here */ }
  };
  const enrich = (i: number, dishId: string) =>
    fetch('/api/dishes/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dishId }) })
      .then(r => (r.ok ? r.json() : null))
      // Only overwrite ingredients when enrich actually produced some (the typed-name /
      // reclassify slow path) — never clobber vision's create-time list back to [] on the
      // photo fast-path (which returns the stored dish, no ingredients).
      .then(j => { if (j?.dish) patch(i, { ...(Array.isArray(j.dish.ingredients) && j.dish.ingredients.length ? { ingredients: j.dish.ingredients } : {}), diet: j.dish.diet ?? [], heaviness: j.dish.heaviness ?? null, name_zh: j.dish.name_zh ?? undefined, enriched: true }); refreshBuddy(); })
      .catch(() => {});
  // Post-rename RE-derivation — the REAL one (the 720ms chip animation used to be a
  // simulation restoring the OLD chips; see TasteGrowth). force:true makes the enrich
  // route re-reason from the CURRENT (just-renamed) name and overwrite attributes/
  // diet/method/heaviness — the typed name is the derivation seed, per the authority
  // ladder (HUMAN > VISION); the photo never overrides it. enrichGen tells TasteGrowth
  // "the real result landed" so the chips re-animate on DATA, not a timer. Always
  // bumped — even on failure — so the re-analysing state can never stick forever
  // (a failed re-derive honestly falls back to the current server state).
  const reDerive = (i: number, dishId: string) => {
    const gen = (renameGen.current[i] ?? 0) + 1;
    renameGen.current[i] = gen;
    return fetch('/api/dishes/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: dishId, force: true }) })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (renameGen.current[i] !== gen) return; // a newer rename superseded this response
        if (j?.dish) patch(i, { ingredients: j.dish.ingredients ?? [], diet: j.dish.diet ?? [], heaviness: j.dish.heaviness ?? null, name_zh: j.dish.name_zh ?? undefined, enriched: true, enrichGen: gen });
        else patch(i, { enrichGen: gen });
        refreshBuddy(); // force mode replays the profile server-side — reflect it
      })
      .catch(() => { if (renameGen.current[i] === gen) patch(i, { enrichGen: gen }); });
  };
  // Live GPS, resolved at most once per session and shared by every card that needs it.
  // Photos taken with the phone camera through a file input usually carry NO EXIF GPS
  // (iOS strips it), so those dishes previously got no location offer at all. For a shot
  // taken moments ago the device's CURRENT position is the honest answer.
  const liveCoords = useRef<Promise<{ lat: number; lng: number } | null> | null>(null);
  const getLiveCoords = () => {
    if (!liveCoords.current) {
      liveCoords.current = new Promise(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),                       // denied / unavailable: stay silent
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
        );
      });
    }
    return liveCoords.current;
  };
  // Only for photos plausibly taken JUST NOW — otherwise "where the phone is" is a lie
  // about where an old album shot was eaten. EXIF time when present, else the file's own
  // mtime (a fresh capture is written now; an album pick keeps its original date).
  const RECENT_MS = 60 * 60 * 1000;
  const looksJustTaken = (p: Prepared) => {
    const stamp = p.meta.takenAt?.getTime() ?? p.file.lastModified;
    return typeof stamp === 'number' && Date.now() - stamp < RECENT_MS;
  };

  // EXIF coords → real nearby list → auto-confirm + persist the nearest (correctable).
  const loadNearby = async (i: number, dishId: string, coords: { lat: number; lng: number }) => {
    patch(i, { coords, hasLocation: true, placeLoading: true });
    try {
      const nr = await fetch(`/api/restaurants/nearby?lat=${coords.lat}&lng=${coords.lng}&lang=${lang === 'zh' ? 'zh' : 'en'}`);
      const nj = await nr.json().catch(() => null);
      const list: any[] = nj?.restaurants ?? [];
      const rich: GrowPlace[] = list.map((r: any) => ({
        label: String(lang === 'zh' ? (r.name_zh ?? r.name) : r.name),
        lat: r.lat, lng: r.lng, source: r.source,
        restaurant_id: r.source === 'dishi' ? r.id : undefined,
        place_id: r.source === 'google' ? r.place_id : undefined,
      })).filter(p => p.label);
      const top = rich[0] ?? null;
      patch(i, { nearby: rich, placeLoading: false, choice: top ? top.label : null });
      if (top) persistPlace(dishId, top); // optimistic-commit the nearest; correctable
    } catch { patch(i, { placeLoading: false }); }
  };
  // The full rename cascade (name_edited_at + translate the cleared field + reanalyzeAnchored).
  const renamePatch = (dishId: string, e: NameEdit) =>
    fetch('/api/my/dishes', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dish_id: dishId, name: e.en || undefined, name_zh: e.zh || null, edited_en: e.edEn, edited_zh: e.edZh }),
    }).then(r => (r.ok ? r.json() : null)).catch(() => null);

  // The REAL pipeline for one rated card. Runs detached (the user has already moved on
  // to the next card); each step patches this dish's row in place as it lands.
  async function runPipeline(file: File, score: number, i: number, meta: PhotoMeta) {
    try {
      const form = new FormData();
      form.append('photo', file);
      form.append('source', 'album');
      // EXIF: where + when it was eaten (best-effort; absent on stripped photos).
      if (meta.coords) { form.append('lat', String(meta.coords.lat)); form.append('lng', String(meta.coords.lng)); }
      if (meta.takenAt) form.append('eaten_at', meta.takenAt.toISOString());
      const res = await fetch('/api/dishes', { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.dish) { patch(i, { status: 'failed' }); return; }
      const d = json.dish;
      sessionDishIds.current.push(d.id); // track for cancel-discard
      const isDish = d.is_dish !== false;
      patch(i, {
        status: 'ready', dishId: d.id, isDish,
        name: d.name, name_zh: d.name_zh, cuisine: d.cuisine ?? null,
        // Vision already read off the ingredients + diet at create — show them NOW
        // (the enrich fast-path returns none for photo dishes, which already carry
        // attributes). This is what makes the chips appear and the taste blob absorb.
        ingredients: d.ingredients ?? [], diet: d.diet ?? [], heaviness: d.heaviness ?? null, coords: meta.coords ?? null,
      });

      // NOT FOOD: never sealed, rated, or enriched — a non-dish must never move the taste
      // engine. (Reclassifying via "係嘢食嚟" starts the real pipeline; see onReclassify.)
      if (!isDish) return;

      await seal(d.id);   // seal BEFORE the rating (honesty contract), awaited for ordering
      await rate(d.id, score, { name: d.name, name_zh: d.name_zh }); // held flick score becomes the rating (reveals any seal)
      refreshBuddy();     // real engine confidence just moved → update the bar
      enrich(i, d.id);    // background: ingredients / diet / cooking / heaviness
      // EXIF coords win (they say where it was actually eaten). Failing that, a photo
      // taken moments ago gets the device's live position — the camera path had no
      // location offer at all before this.
      if (meta.coords) loadNearby(i, d.id, meta.coords);
      else if (looksJustTaken({ file, url: '', meta })) {
        const live = await getLiveCoords();
        if (live) loadNearby(i, d.id, live);
      }
    } catch { patch(i, { status: 'failed' }); }
  }

  // The pipeline for a QUEUED PICK. The dish already exists, so there is no upload and
  // no create — but the sealed-bet ordering is identical and non-negotiable: seal (the
  // route is idempotent, so a pick sealed at scan time just no-ops) strictly BEFORE the
  // rating. The dish id is never pushed to sessionDishIds: nothing here is ours to delete.
  async function runPickPipeline(pick: ExistingPick, score: number, i: number) {
    try {
      // The restaurant the pick was created at rides onto the card as FIXED context;
      // when it's known, the nearby guess must not run at all — its optimistic
      // persist (persistPlace of the geographically nearest) is a silent-overwrite
      // path for a restaurant that's already correct. See pickContext.ts.
      const place = pickPlaceContext(pick.restaurant, !!pick.coords, lang === 'zh' ? 'zh' : 'en');
      patch(i, {
        status: 'ready', dishId: pick.dishId, isDish: true,
        name: pick.name, name_zh: pick.name_zh, coords: pick.coords,
        ...(place.fixed ? { choice: place.choice, placeFixed: true, hasLocation: true } : {}),
      });
      await seal(pick.dishId);
      await rate(pick.dishId, score, { name: pick.name, name_zh: pick.name_zh });
      refreshBuddy();
      enrich(i, pick.dishId);   // fills in ingredients/diet chips if it never got them
      if (place.loadNearby && pick.coords) loadNearby(i, pick.dishId, pick.coords);
    } catch { patch(i, { status: 'failed' }); }
  }

  // The pipeline for a 打字 TYPED entry. Unlike runPipeline, creation AND enrichment
  // already happened in TypedQuickAdd before this component mounted (the whole point
  // is that the blank card carries real chips at the rating moment) — so this is just
  // seal + rate with the pre-fetched fields, no second enrich() call. A second call
  // would hit the enrich route's fast already-enriched early-return, which doesn't
  // select diet/heaviness and would blank those chips back out client-side — see the
  // spawned follow-up on that route. sessionDishIds is seeded on MOUNT, not here (see
  // the effect above), so a cancel/skip before ever reaching this still discards it.
  async function runTypedPipeline(entry: TypedEntry, score: number, i: number) {
    try {
      patch(i, {
        status: 'ready', dishId: entry.dishId, isDish: true,
        name: entry.name, name_zh: entry.name_zh, cuisine: entry.cuisine,
        ingredients: entry.ingredients, diet: entry.diet, heaviness: entry.heaviness,
        coords: entry.coords,
      });
      await seal(entry.dishId);
      await rate(entry.dishId, score, { name: entry.name, name_zh: entry.name_zh });
      refreshBuddy();
      if (entry.coords) loadNearby(i, entry.dishId, entry.coords);
    } catch { patch(i, { status: 'failed' }); }
  }

  // A pick on the growth screen (live mode): persist it. Home / skip clear the restaurant.
  const onPickPlace = (i: number, label: string) => {
    patch(i, { choice: label }); // optimistic display
    const gd = dishes[i];
    if (!gd?.dishId) return;
    if (label === t('place.home') || label === t('grow.skip')) { persistPlace(gd.dishId, null); return; }
    const place = (gd.nearby ?? []).find(p => p.label === label);
    if (place) {
      const dishId = gd.dishId;
      persistPlace(dishId, place).then(res => {
        // The dish just gained a restaurant → its name can now fuzzy-match an
        // identity there. Probe only on a confirmed persist.
        if (res) probeIdentity(dishId, { name: gd.name, name_zh: gd.name_zh, photoUrl: gd.photoUrl });
      });
    }
  };

  // A TYPED restaurant name ("+ 加間舖"). resolveOrCreateRestaurant REQUIRES finite
  // coords ("a new restaurant needs a name and location"), so a manual add with no
  // location would 400 and vanish — which is exactly how this read as "nothing
  // happens". Use the dish's own coords, else ask for live GPS, and if there is
  // genuinely no position, roll the optimistic label back instead of pretending.
  const onAddPlace = async (i: number, name: string) => {
    const gd = dishes[i];
    if (!gd?.dishId) return;
    const prev = gd.choice ?? null;
    patch(i, { choice: name, placeError: false }); // optimistic; clears any prior failure
    const coords = gd.coords ?? (await getLiveCoords());
    if (!coords) { patch(i, { choice: prev, placeError: true }); return; }
    const res = await persistPlace(gd.dishId, { label: name, source: 'manual', lat: coords.lat, lng: coords.lng });
    if (!res || !('ok' in res)) { patch(i, { choice: prev, placeError: true }); return; }
    // Restaurant attached (possibly a manual add that resolved to an existing
    // place) — same log-time identity trigger as the nearby-chip path.
    probeIdentity(gd.dishId, { name: gd.name, name_zh: gd.name_zh, photoUrl: gd.photoUrl });
  };

  // Rename on the growth screen → persist the full cascade, then RE-derive for real:
  // the PATCH's own reanalyzeAnchored (photo-anchored) resolves first, and reDerive
  // (name-seeded) runs after and overwrites — so when the two disagree (the observed
  // 鴨-beats-油雞 case), the typed name wins. Sequenced, so there is no race.
  const onEditName = (i: number, e: NameEdit) => {
    const gd = dishes[i];
    if (!gd?.dishId) return;
    const dishId = gd.dishId;
    patch(i, { name: e.en || gd.name, name_zh: e.zh || gd.name_zh }); // optimistic
    const renamed = renamePatch(dishId, e).then(j => {
      if (j?.dish) patch(i, { name: j.dish.name, name_zh: j.dish.name_zh ?? gd.name_zh, diet: j.dish.diet ?? gd.diet });
      reDerive(i, dishId); // the identity changed → re-derive from the NEW name
    });
    pendingRenames.current.push(renamed); // drained by finishExit — see pendingRenames above
  };

  // "It IS food" on a mis-flagged non-dish → name it, then run the REAL pipeline (now it
  // teaches): rename cascade → seal → rate the held flick score → enrich → nearby.
  const onReclassify = (i: number, e: NameEdit) => {
    const gd = dishes[i];
    if (!gd?.dishId) return;
    const dishId = gd.dishId;
    patch(i, { isDish: true, name: e.en || gd.name, name_zh: e.zh || gd.name_zh });
    (async () => {
      await renamePatch(dishId, e);
      await seal(dishId);
      await rate(dishId, gd.score, { name: e.en || gd.name, name_zh: e.zh || gd.name_zh });
      refreshBuddy();
      // Name-seeded, forced: a reclassified non-dish may already carry photo-derived
      // attributes (from the PATCH cascade), which would no-op a plain enrich.
      reDerive(i, dishId);
      if (gd.coords) loadNearby(i, dishId, gd.coords);
    })();
  };

  // Still decoding (e.g. HEIC → JPEG) — a brief loading sheet. Picks and typed entries
  // have nothing to decode, so they skip straight past it.
  if (!picksMode && !typedMode && !prepared) return (
    <div className="rate-sheet"><div className="rate-sheet-inner rate-loading">{t('rate.preparing')}</div></div>
  );
  const pv = prepared ?? [];
  const pk = picks ?? [];
  const tv = typed ?? [];
  const cardCount = picksMode ? pk.length : typedMode ? tv.length : pv.length;
  if (!cardCount) return null;

  const gotoNextOrGrow = (ratedAnything: boolean) => {
    if (idx + 1 >= cardCount) {
      if (ratedAnything) {
        setPhase('grow');
        // Queued picks were born at a restaurant (menu-scan/table), so they can
        // fuzzy-match an identity there WITHOUT any refine action. Probe a
        // bounded few, sequentially, stopping at the first suggestion — each
        // probe may cost an LLM adjudication server-side, and one question is
        // all this log gets anyway.
        if (picksMode) {
          (async () => {
            for (const p of pk.slice(0, 3)) {
              if (identityShown.current) break;
              await probeIdentity(p.dishId, { name: p.name, name_zh: p.name_zh, photoUrl: p.photoUrl });
            }
          })();
        }
      } else discardAndExit(); // nothing rated — discard anything this session created (typed/photo), a no-op for picksMode
    } else setIdx(i => i + 1);
  };
  const onRate = (score: number) => {
    const i = countRef.current++;
    if (picksMode) {
      const pick = pk[idx];
      setDishes(prev => [...prev, freshDish(pick.photoUrl, score)]);
      runPickPipeline(pick, score, i);
    } else if (typedMode) {
      const entry = tv[idx];
      typedSrc.current[i] = entry; // keep the entry so a failed seal/rate can retry in place
      setDishes(prev => [...prev, freshDish(null, score)]);
      runTypedPipeline(entry, score, i);
    } else {
      ratedSrc.current[i] = pv[idx]; // keep the source so a failed upload can retry in place
      setDishes(prev => [...prev, freshDish(pv[idx].url, score)]);
      runPipeline(pv[idx].file, score, i, pv[idx].meta); // detached — don't block advancing
    }
    gotoNextOrGrow(true);
  };
  // Retry a failed card (upload bounced — 413/network/5xx). The File is still in
  // memory; re-run the whole pipeline for that index with the same held score.
  const onRetry = (i: number) => {
    const gd = dishes[i];
    if (!gd) return;
    patch(i, { status: 'creating' });
    if (picksMode) {
      const pick = pk.find(p => p.dishId === gd.dishId);
      if (pick) runPickPipeline(pick, gd.score, i);
      return;
    }
    if (typedMode) {
      const entry = typedSrc.current[i];
      if (entry) runTypedPipeline(entry, gd.score, i);
      return;
    }
    const src = ratedSrc.current[i];
    if (!src) return;
    runPipeline(src.file, gd.score, i, src.meta);
  };
  const onSkip = () => gotoNextOrGrow(countRef.current > 0);

  if (phase === 'flick') {
    const card = picksMode ? pk[idx] : null;
    const typedCard = typedMode ? tv[idx] : null;
    return (
      <SnapRating
        key={idx}
        photoUrl={picksMode ? card!.photoUrl : typedMode ? null : pv[idx].url}
        // A queued pick or a typed entry has no photo, so the card leads with its
        // NAME instead — otherwise there'd be nothing to rate against.
        dishName={card?.name ?? typedCard?.name}
        dishNameZh={card?.name_zh ?? typedCard?.name_zh ?? undefined}
        showHint={idx === 0}
        onClose={cancelSession}
        onRate={onRate}
        onSkip={onSkip}
      />
    );
  }

  return (
    <div className="rate-sheet">
      <div className="rate-sheet-inner">
        {/* No onCancel in picksMode: TasteGrowth falls back to onExit, so its ✕ is a
            plain close-and-keep rather than a discard that would delete dishes we
            never created. */}
        <TasteGrowth live={dishes} engine={engine} blobInputs={blobInputs} onExit={finishExit} onCancel={picksMode ? undefined : cancelSession} onPickPlace={onPickPlace} onAddPlace={onAddPlace} onEditName={onEditName} onReclassify={onReclassify} onRetry={onRetry}
          sealSlots={(() => {
            // This session's verdicts first, then anything recovered from a
            // session that never got to paint. De-duped by row id: a reveal can
            // legitimately appear in both lists if the ack lost the race.
            const own = sealReveals;
            const ownIds = new Set(own.map(s => s.id).filter(Boolean));
            const older = recoveredReveals.filter(r => !r.id || !ownIds.has(r.id));
            const slots: Record<string, React.ReactNode> = {};
            [...own, ...older].forEach((sr, i) => {
              const dishId = sr.dish?.id;
              // First writer wins, and this session's own verdicts come first: if
              // a dish was re-rated here, the fresh call is the one to stamp, not
              // the stale recovered one for the same dish.
              if (!dishId || slots[dishId]) return;
              // The streak rides on THIS session's newest verdict only — it's a
              // running count ending at that rating, and a recovered older one
              // would state a stale figure.
              slots[dishId] = <SealRevealBadge key={sr.id ?? i} seal={sr} showStreak={i === own.length - 1} />;
            });
            return slots;
          })()}
          identitySlot={identityAsk ? (
            <IdentityConfirmCard
              mine={identityAsk.mine}
              other={identityAsk.other}
              onDone={() => setIdentityAsk(null)}
            />
          ) : undefined}
        />
      </div>
      {/* 佢哋整得點？ — drained one at a time, on top of the growth screen, only
          once the flicking is over. Dismissing is free and simply advances the
          queue: an unanswered card costs nothing (the rating still taught), so
          there is deliberately no nag and no badge. Sits OUTSIDE rate-sheet-inner
          because it is a floating overlay on the duel chassis, not page content. */}
      {executionQueue.length > 0 && (
        <ExecutionSlider
          key={executionQueue[0].map(r => r.dish.id).join('|')}
          rows={executionQueue[0]}
          onDone={() => setExecutionQueue(cur => cur.slice(1))}
        />
      )}
    </div>
  );
}
