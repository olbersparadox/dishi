'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import ScanBenefitDemo from '@/components/ScanBenefitDemo';
import ExplainModal from '@/components/ExplainModal';
import { createTaskPool } from '@/lib/concurrency';
import { createScanTelemetry, type ScanSummary } from '@/lib/scanTelemetry';
import { mergeFinalScanItems } from '@/lib/tableMenuItems';
import { shareLink } from '@/lib/share';
import DishInfoDisplay from '@/components/DishInfoDisplay';
import DishListRow from '@/components/DishListRow';
import TableBar from '@/components/TableBar';
// The table-session chassis: the SAME engine and the SAME stamp row /table mounts,
// not this screen's own rendering of the same ideas (see useTableSession's header).
import ChopStampRow from '@/components/ChopStampRow';
import TableRestaurantLine from '@/components/TableRestaurantLine';
import { useTableSession } from '@/lib/useTableSession';
import { sumPrices } from '@/lib/price';
import { CameraIcon, MenuBookIcon, ArrowRightIcon, CloseIcon } from '@/components/icons';
import { sameDishInSession, restaurantKeptNote } from '@/lib/menuMerge';
import { getScanSession, setScanSession, clearScanSession } from '@/lib/scanSession';
import { useLang, menuLanguageToCode, languageLabel, hasNonChineseScript, foreignMenuSecondary, scanPresetPair } from '@/lib/i18n';
import { useScanPreset } from '@/lib/scanPreset';

type ScannedItem = {
  name: string; name_zh?: string | null; name_original: string; section: string | null; description: string | null;
  price: string | null; cuisine: string; hook: string; hook_zh?: string; confidence: number;
  // undefined = not yet requested/still scoring; null = this dish's scoring call
  // failed (degrade gracefully, don't block the rest); number = a real match.
  match?: number | null; reason?: string | null; caution?: string | null;
  // Server-side fire QUALIFICATION (the honest confident mark). The batch cap —
  // at most 2 fires actually shown per scan — is applied client-side at settle,
  // since Phase 2 scores dishes in isolated calls.
  fire?: boolean;
  // The Phase 2 endpoint scores ONE dish per call, in isolation — it has no way to
  // know the other dishes' scores, so its OWN `match` field can't be relative to
  // anything. raw_score is the real signal; the client recomputes a proper relative
  // `match` once every dish's raw_score is in (see the settle step below).
  // Transient client-only flag: set on dishes added by an "add a page" append this
  // session, so they can animate in and carry a brief 新 tag. Cleared when a further
  // page is appended (only the newest page is tagged) — never sent to any endpoint.
  isNew?: boolean;
  raw_score?: number;
  // Present once Phase 2 has scored the item — carried through so a "pick" can be
  // created with its real taste attributes instead of an empty/neutral dish.
  attributes?: Record<string, number>;
  // Day-0 utility, filled in by Stage 2 (/api/menu-scan/enrich) — useful before any
  // taste learning has happened, unlike match/fire which need evidence. Starts
  // empty/null (NOT yet enriched); `enriched` distinguishes "pending" from
  // "enriched and genuinely has none" so the UI never shows a false empty state.
  diet: string[];
  cooking_method: string | null;
  heaviness: 'light' | 'medium' | 'heavy' | null;
  ingredients: string[];
  enriched?: boolean;
};
type ScanResponse = {
  phase?: 'done' | 'needs_scoring'; profile_ready: boolean; rating_count: number; needed?: number; menu_language: string;
  restaurant_guess: string | null; mock: boolean; items: ScannedItem[];
};

/** AuthGate's fallback while the session check is in flight — shape-only
 * stand-ins for the capture screen (Scanner's own initial state is entirely
 * static/session-restored, no fetch of its own to wait on), so this is the
 * one loading state this page actually needs: the sign-in check itself. */
function ScanGateSkeleton() {
  return (
    <div aria-hidden>
      <span className="skel-box" style={{ display: 'block', width: 100, height: 28, borderRadius: 6, marginBottom: 18 }} />
      <span className="skel-box" style={{ display: 'block', height: 112, borderRadius: 16 }} />
      <div style={{ borderTop: '1px solid var(--line)', marginTop: 20, paddingTop: 20 }}>
        <span className="skel-box" style={{ display: 'block', width: 130, height: 20, borderRadius: 6 }} />
        <span className="skel-box" style={{ display: 'block', width: '85%', height: 14, borderRadius: 6, marginTop: 10 }} />
        <span className="skel-box" style={{ display: 'block', height: 48, borderRadius: 12, marginTop: 14 }} />
      </div>
    </div>
  );
}

const SCAN_STAGE_KEYS = ['scan.stage.0', 'scan.stage.1', 'scan.stage.2', 'scan.stage.3', 'scan.stage.4'];
// Concurrency cap for parallel per-dish calls (both enrichment and scoring):
// fast enough that total wait is close to "one dish's worth of latency,"
// conservative enough to stay well clear of provider rate limits on a typical
// 15-20 item menu. The two stages each get their own cap of this many at once,
// so worst case ~2x this many concurrent calls in flight together — comfortably
// inside normal rate limits.
const SCORE_CONCURRENCY = 6;

export default function ScanPage() {
  return (
    <AuthGate fallback={<ScanGateSkeleton />}>
      <Scanner />
    </AuthGate>
  );
}

function Scanner() {
  const { t, lang, pair } = useLang();
  // Restore a scan left behind when the user switched tabs (Feed/Taste) and came
  // back. Read once, synchronously, so the very first render already shows the
  // menu instead of flashing the capture screen. `scanning`/`preview` are
  // deliberately NOT restored: the SSE stream and the blob URL both died with the
  // previous mount, and the results view doesn't need either — it renders from
  // `result`. See scanSession.ts for why this is in-memory (survives tab switch,
  // clears on refresh) rather than Web Storage.
  const restored = getScanSession<ScanResponse | null>();
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanHelp, setScanHelp] = useState(false); // tap the ⓘ on the banner → what a scan returns
  const [tableHelp, setTableHelp] = useState(false); // tap the ⓘ by 同朋友一齊點 → what table ordering is
  // Appending a second page ("加掃一版"): the existing results stay on screen with a
  // small inline indicator, rather than the full capture screen taking over.
  const [appending, setAppending] = useState(false);
  // Set to the kept restaurant name when an appended page guessed a strongly-
  // different place — a quiet "kept 〈restaurant〉" note, not a blocking dialog.
  const [keptNote, setKeptNote] = useState<string | null>(restored?.keptNote ?? null);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<ScanResponse | null>(restored?.result ?? null);
  const [settled, setSettled] = useState(restored?.settled ?? false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Sharing an already-in-progress scan as a table session. Deliberately reuses
  // the SAME session model, join code, and pick pipeline the standalone Table
  // page runs on — this creates one, it doesn't invent a second one. Once active,
  // members who join via the code land on /table (real ranked view, fairness
  // math, picks-so-far) — what lives HERE is a lightweight glance: the code
  // itself, who's joined, and a quiet "X also picked this" on matching cards, so
  // the value of doing this together is visible without leaving the scan screen.
  const [tableSession, setTableSession] = useState<{ code: string; session_id: string } | null>(restored?.tableSession ?? null);

  // Foreign-menu preset (Fix 5). Computed here at the top — before any early
  // return — so the header globe can be told about it and so the results render
  // below can reuse it. `overridden` (from the shared preset context) records an
  // explicit choice made in the globe: once set, the preset yields and scanPair is
  // just the persisted pair. The raw foreign secondary is PUBLISHED to the picker
  // so its popover shows the effective pair instead of contradicting the page.
  const { overridden, setPresetSecondary, resetPreset } = useScanPreset();
  const menuCode = result ? menuLanguageToCode(result.menu_language) : null;
  const foreignSecondary = foreignMenuSecondary(menuCode, pair);
  useEffect(() => { setPresetSecondary(foreignSecondary); }, [foreignSecondary, setPresetSecondary]);

  /**
   * Every successful scan gets a table code, automatically — there's no longer a
   * "share with friends" button to press first.
   *
   * The reasoning: the code costs the solo user nothing (it's one line of UI, and
   * an unused session simply expires), but requiring a decision UP FRONT — before
   * anyone has even seen the dishes — gets it wrong in the common case. People
   * don't know they want to share until a friend leans over and asks what's good.
   * By then the moment has passed if the code doesn't already exist.
   *
   * Called with the FINAL item list once the stream completes, not from an effect
   * watching `result` — result.items grows during streaming, and a session created
   * mid-stream would snapshot a half-read menu for everyone who joined.
   */
  // Where the scanner is standing, warmed the moment a scan STARTS rather than
  // read when it's needed. The session's restaurant is resolved from this at
  // create time (POST /api/table), and geolocation can take seconds — asking for
  // it at the end of the stream would put a visible stall between "the menu is
  // on screen" and "the table code exists", which is exactly the moment someone
  // leans over to ask what's good. A denied or absent fix is not a failure:
  // restaurant_id stays null and the table bar's restaurant line asks instead.
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  function warmCoords() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => { coordsRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }; },
      () => { /* no fix — the restaurant line handles it; never blocks a scan */ },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function createTableSession(items: ScannedItem[]): Promise<{ code: string; session_id: string } | null> {
    try {
      const res = await fetch('/api/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, ...(coordsRef.current ?? {}), lang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not create a table code.');
      const session = { code: json.code, session_id: json.session_id };
      setTableSession(session);
      // Returned as well as set: the post-stage re-author sync below runs in the
      // same performScan call, where the closure's tableSession is still null.
      return session;
    } catch {
      /* A missing table code must never break a scan that otherwise worked. The
         dishes are the point; sharing is a bonus. Silently absent is correct. */
      return null;
    }
  }

  async function copyTableLink() {
    if (!tableSession) return;
    const url = `${window.location.origin}/table?code=${tableSession.code}`;
    // shareLink owns the sheet-then-clipboard chain (lib/share.ts); only the
    // "it's on your clipboard" feedback is this screen's to give.
    if (await shareLink({ title: t('table.sharetitle'), url }) === 'copied') alert(t('table.copied'));
  }

  // The SAME engine /table mounts — poll, realtime channel, stamp overlay, and
  // pick/unpick (src/lib/useTableSession.ts). This screen used to run its own
  // poll-only copy with no realtime at all, which is why the scanner received
  // everything up to 5s late while joiners saw each other instantly.
  const table = useTableSession(tableSession?.code ?? null);

  // Joining a table from here reuses the exact same endpoint/session model the
  // standalone /table page already uses — this is purely a second entry point
  // into it, not a new join mechanism, so nothing about table sessions themselves
  // changes. Landing someone straight on the results screen there (rather than a
  // splash) is what ?code= is for.
  const [joinCode, setJoinCode] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState('');
  async function joinTable() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 5) return;
    setJoinBusy(true); setJoinError('');
    try {
      const res = await fetch('/api/table/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || t('table.joining'));
      router.push(`/table?code=${json.code}`);
    } catch (e: any) {
      setJoinError(e.message || t('table.joining'));
      setJoinBusy(false);
    }
  }

  // "Pick": tap a scanned dish to mark it for later rating (no photo needed — the
  // taste engine already has its attributes from scoring).
  //
  // A pick is WRITTEN THE MOMENT IT IS TAPPED, through the shared engine, exactly
  // as it is on /table. It used to only mutate a local Set here, with nothing
  // reaching the server until a three-step confirm (cart bar -> CTA -> restaurant
  // chips). In a two-account field test that meant the scanner tapped dishes all
  // through the meal and the other person saw NOTHING: verified in the DB, both
  // picks on session SA9YZ belonged to the joiner and the host had written zero
  // rows. The restaurant those picks needed is now resolved once at session level
  // (see createTableSession / POST /api/table), which is what freed the tap to be
  // immediate — there is nothing left to batch a confirm step for.
  //
  // "Picked" is therefore no longer local state at all: it's whether MY chop is on
  // the dish, the same rule /table uses, so it can never disagree with the stamp
  // shown underneath.

  // Keep the module-level store in sync with the on-screen menu, so leaving and
  // returning to this tab restores it. Only mirrors once a scan exists — with no
  // result there's nothing to preserve, and reset()/the X clears the store
  // directly. Not persisted: scanning, preview, and the transient confirm sheet,
  // none of which can (or should) be resurrected on a remount.
  useEffect(() => {
    if (!result) return;
    // Picks are no longer mirrored here: they live on the server the moment they're
    // tapped, so the session state IS the restore path — a remount re-polls and
    // gets the truth, instead of replaying a local Set that could disagree with it.
    setScanSession({ result, settled, keptNote, tableSession });
  }, [result, settled, keptNote, tableSession]);

  // Cycle the status line while scanning so the wait feels alive, not stuck.
  useEffect(() => {
    if (!scanning) return;
    setStage(0);
    const timer = setInterval(() => setStage(s => Math.min(s + 1, SCAN_STAGE_KEYS.length - 1)), 2200);
    return () => clearInterval(timer);
  }, [scanning]);

  async function onPick(file: File | null, opts: { append?: boolean } = {}) {
    if (!file) return;
    const append = !!opts.append && !!result;
    setError('');
    if (!append) {
      // Fresh scan: a new photo is a new menu. Also reachable WITHOUT reset()
      // (e.g. after a failed scan leaves the capture screen up), so the previous
      // menu's picks are cleared here rather than relying on reset() having run.
      clearScanSession(); // a new menu supersedes any restored one
      resetPreset(); // new menu -> re-evaluate the foreign-language preset fresh (Fix 5)
      setResult(null);
      setSettled(false);
      setPreview(URL.createObjectURL(file));
      setScanning(true);
      warmCoords(); // in flight during the scan, ready when the session is created
    } else {
      // Append (加掃一版): keep the current menu, restaurant, picks, and table
      // session on screen. Only the incremental capture UI changes. Clear any
      // prior 新 tags so only THIS newest page ends up marked new.
      setSettled(false);
      setAppending(true);
      setKeptNote(null);
      setResult(prev => prev ? { ...prev, items: prev.items.map(it => it.isNew ? { ...it, isNew: false } : it) } : prev);
    }
    // The dish list this scan started from — append merges onto it; fresh starts empty.
    const baseItems: ScannedItem[] = append && result ? result.items : [];

    // Latency record for THIS scan (lib/scanTelemetry.ts). The clock starts
    // before the upload, because the wait a person actually experiences starts
    // when they tap, not when the server begins reading. Ships once at the end
    // via sendTelemetry — fire-and-forget, never awaited, never able to fail a
    // scan.
    const tele = createScanTelemetry();
    let teleSent = false;
    const sendTelemetry = (summary: ScanSummary) => {
      if (teleSent) return; // success and error paths both call this; first wins
      teleSent = true;
      try {
        fetch('/api/scan-telemetry', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(summary),
        }).catch(() => { /* measurement must never be load-bearing */ });
      } catch { /* ditto */ }
    };

    try {
      const form = new FormData();
      form.append('photo', await normalizePhoto(file));
      form.append('lang', lang);
      const res = await fetch('/api/menu-scan', { method: 'POST', body: form });
      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as any).error || 'Scan failed.');
      }

      // Consume the NDJSON stream one line at a time. 'item' events append a dish
      // to the visible list the MOMENT its own JSON object closed in the model's
      // response — this is what makes dishes appear one by one instead of all at
      // once after one long wait. 'start' arrives first (profile info is already
      // known before the model call even begins), but the screen deliberately
      // does NOT switch to the results view yet — see below. Only the FIRST
      // 'item' event does that, once there is something real to show.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let lineBuffer = '';
      let items: ScannedItem[] = [];
      let meta: { profile_ready: boolean; rating_count: number; needed: number; mock: boolean; phase: 'done' | 'needs_scoring' } | null = null;
      let done: { menu_language: string; restaurant_guess: string | null } | null = null;

      const offset = baseItems.length; // where this page's new dishes sit in the combined list (0 when fresh)

      // STAGE 2/3 ARE PIPELINED INTO STAGE 1 (2026-07-29): enrichment and
      // scoring are per-dish calls, so nothing about them ever needed the full
      // menu — each dish's calls fire the moment ITS item event arrives, not
      // after the stream ends. The old sequencing had a measured, brutal cost:
      // a Japanese menu's skeleton stream stalled after its last item and held
      // the connection to the full stream timeout, and only THEN did 28
      // per-dish calls begin — chips and recommendations trailed the visible
      // menu by minutes, on the app's core loop. The pools keep the old batch
      // semantics (cap, per-item onEach the moment each result lands, one
      // failure never touching the rest); `drain()` below is awaited exactly
      // where the old batch promises were.
      //
      // Each stage still merges only the fields it OWNS (see the note on the
      // enrich/score onEach bodies) — pipelining changes WHEN calls start,
      // never who wins a write.
      const enrichPool = createTaskPool<ScannedItem>(SCORE_CONCURRENCY, (enriched, index) => {
        tele.mark('chips_done'); // last result to land is the one that counts
        setResult(prev => {
          if (!prev) return prev;
          const at = offset + index;
          // Bounds guard: a result can only be merged into a dish that is
          // actually on screen. Writing past the end would punch an undefined
          // hole into the list rather than failing loudly.
          if (at >= prev.items.length) return prev;
          const nextItems = [...prev.items];
          nextItems[at] = enriched
            ? { ...nextItems[at], hook: enriched.hook, hook_zh: enriched.hook_zh, diet: enriched.diet, cooking_method: enriched.cooking_method, heaviness: enriched.heaviness, ingredients: enriched.ingredients, enriched: true }
            : { ...nextItems[at], enriched: true }; // failed enrichment: stop showing the shimmer, stay honestly empty
          return { ...prev, items: nextItems };
        });
      });
      const scorePool = createTaskPool<ScannedItem>(SCORE_CONCURRENCY, (scored, index) => {
        tele.mark('recs_done'); // ditto — the settle waits for the slowest one
        setResult(prev => {
          if (!prev) return prev;
          const at = offset + index;
          if (at >= prev.items.length) return prev; // same bounds guard as enrich
          const nextItems = [...prev.items];
          nextItems[at] = scored
            ? { ...nextItems[at], match: scored.match, reason: scored.reason, caution: scored.caution, fire: scored.fire, raw_score: scored.raw_score, attributes: scored.attributes }
            : { ...nextItems[at], match: null }; // null = failed, shown gracefully
          return { ...prev, items: nextItems };
        });
      });
      // Fired at item ACCEPTANCE (so an appended duplicate that gets dropped is
      // never enriched/scored). meta always precedes items on the wire ('start'
      // is sent before the model call even begins — see the route), so the
      // guard is a formality, not a race. Mock items arrive already enriched.
      const startStages = (item: ScannedItem, index: number) => {
        if (!meta || meta.mock) return;
        enrichPool.push(index, async () => {
          // Timed around the WHOLE attempt, failures included: a call that
          // burned its budget and then failed cost the person that time just
          // as surely as a slow success did (see callStats' own note).
          const t0 = tele.now();
          try {
            const r = await fetch('/api/menu-scan/enrich', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ item }),
            });
            if (!r.ok) throw new Error('enrich failed');
            const out = (await r.json()).item as ScannedItem;
            tele.recordEnrich(tele.since(t0), true);
            return out;
          } catch (e) {
            tele.recordEnrich(tele.since(t0), false);
            throw e;
          }
        });
        if (meta.phase === 'needs_scoring') {
          scorePool.push(index, async () => {
            const t0 = tele.now();
            try {
              const r = await fetch('/api/menu-scan/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item, lang }),
              });
              if (!r.ok) throw new Error('score failed');
              const out = (await r.json()).item as ScannedItem;
              tele.recordScore(tele.since(t0), true);
              return out;
            } catch (e) {
              tele.recordScore(tele.since(t0), false);
              throw e;
            }
          });
        }
      };

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        lineBuffer += decoder.decode(value, { stream: true });
        // \r?\n rather than a strict '\n': any intermediary (proxy, CDN edge)
        // between the server and the browser could normalize line endings to
        // CRLF, and a strict split would then leave a stray \r glued onto every
        // line, breaking JSON.parse on every single event.
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() ?? ''; // last element may be a partial line — carry over

        for (const line of lines) {
          if (!line.trim()) continue;
          // One malformed line must never take down an otherwise-successful
          // scan — real evidence from earlier truncation bugs is exactly this
          // shape of failure (a good response ruined by treating one bad
          // fragment as fatal). Skip it, keep reading; the stream is line-
          // delimited, so the NEXT line is unaffected by this one being bad.
          let ev: any;
          try {
            ev = JSON.parse(line);
          } catch (parseErr) {
            console.error('menu-scan stream: skipped an unparseable line', parseErr, line.slice(0, 200));
            continue;
          }
          if (ev.kind === 'item') tele.markOnce('first_name'); // the screen stops looking dead here
          if (ev.kind === 'start') {
            // Stash the terminal metadata for later; DON'T transition the screen
            // yet. Real evidence: flipping to the results view here used to show
            // an empty shell for up to ~50s on a not-a-menu photo — the scanning
            // animation (still running, since scanning stays true) is the only
            // thing telling the person anything is happening, and an inert empty
            // "results" screen looked exactly like a hang.
            meta = ev;
          } else if (ev.kind === 'item') {
            const incoming = ev.item as ScannedItem;
            if (append) {
              // Merge onto the accumulated menu. Dedup incrementally against the
              // page-1 set AND anything already accepted this page, so an
              // overlapping photo or a dish printed twice folds instead of
              // doubling. Duplicates are dropped here (the existing, possibly
              // already-scored row stays); only genuinely new dishes are kept and
              // will be scored below.
              const combined = [...baseItems, ...items];
              if (!combined.some(e => sameDishInSession(e, incoming))) {
                const added = { ...incoming, isNew: true };
                items = [...items, added];
                // APPEND ONTO prev.items, never onto a snapshot of the local
                // `items` array — see the note in the else-branch below.
                setResult(prev => prev ? { ...prev, items: [...prev.items, added] } : prev);
                startStages(added, items.length - 1);
              }
            } else {
              const isFirst = items.length === 0;
              items = [...items, incoming];
              if (isFirst && meta) {
                // First real content: NOW switch to the results view.
                setScanning(false);
                setResult({
                  phase: meta.phase, profile_ready: meta.profile_ready, rating_count: meta.rating_count, needed: meta.needed,
                  mock: meta.mock, menu_language: 'unknown', restaurant_guess: null, items: [incoming],
                });
              } else {
                // FUNCTIONAL APPEND, not a snapshot of the local `items` array.
                // `items` is the raw stream transcript and NEVER carries stage
                // 2/3 results — those land only in React state. Writing a
                // snapshot of it here therefore erased the chips of every dish
                // already enriched, on every new dish that streamed in. Live
                // symptom (2026-07-29): chips appearing and then vanishing,
                // ending with only the last dish or two enriched, while the
                // telemetry line honestly reported enrich fail:0of18 — the
                // calls all succeeded; the UI threw their results away.
                // Harmless before stages 2/3 were pipelined into the stream
                // (nothing wrote enrichment until after it closed); a
                // guaranteed race the moment they overlapped.
                setResult(prev => prev ? { ...prev, items: [...prev.items, incoming] } : prev);
              }
              startStages(incoming, items.length - 1);
            }
          } else if (ev.kind === 'done') {
            done = ev;
          } else if (ev.kind === 'error') {
            // No items ever arrived (or the server gave up before any did), so
            // we're still on the capture screen — result was never set. Throwing
            // here surfaces a clean, single message there, with the camera ready
            // for another attempt, instead of an error bolted onto an empty
            // results shell.
            const err: any = new Error(ev.error);
            err.reason = ev.reason;
            throw err;
          }
        }
      }

      tele.mark('names_done'); // the skeleton stream has closed

      if (!meta) throw new Error('Scan ended unexpectedly.');
      if (!append && items.length === 0) throw new Error('No dishes could be read from that photo.');

      // Only the FIRST scan creates the session; captured as a promise (not just
      // state) so the post-stage re-author sync at the bottom of this same call
      // can reach the session the closure's tableSession doesn't know about yet.
      let sessionPromise: Promise<{ code: string; session_id: string } | null> = Promise.resolve(null);
      if (append) {
        // Page-1's restaurant wins for the session. If the new page guessed a
        // strongly-different place, note it quietly (likely a wrong-menu scan) —
        // never block; the dishes are added regardless.
        const decision = restaurantKeptNote(result?.restaurant_guess ?? null, done?.restaurant_guess ?? null);
        if (decision?.noteMismatch) setKeptNote(decision.keep);
        // Restaurant/menu_language stay as page 1's. NOTE: this deliberately no
        // longer rewrites `items` — every dish was already appended to state as
        // it streamed in, and re-writing the local transcript here would erase
        // the enrichment that landed during the stream (same clobber documented
        // in the item handler above).
        setAppending(false);
        if (items.length === 0) {
          // Every dish on this page was already on the menu. No stage 2/3 work
          // to do — but stage 1 still made a real provider call, so its latency
          // is real and gets reported (this early return is exactly the kind of
          // path a "log it at the end" instrument would silently miss).
          setSettled(true);
          sendTelemetry(tele.summary({ lang: done?.menu_language ?? 'unknown', items: 0, append }));
          return;
        }
      } else {
        // Fire-and-forget: the table code appears when it appears, and never
        // blocks scoring or the dishes already on screen.
        sessionPromise = createTableSession(items);
        // Metadata ONLY. `items` is deliberately absent: the dishes are already
        // in state from the stream, and writing the local transcript here was
        // the single worst instance of the clobber above — it fired once, right
        // after the stream, and erased EVERY enrichment that had landed while
        // the stream was still open.
        setResult(prev => prev ? { ...prev, menu_language: done?.menu_language ?? 'unknown', restaurant_guess: done?.restaurant_guess ?? null } : prev);
      }
      if (meta.phase !== 'needs_scoring') setSettled(true); // already complete (mock / under threshold)

      // Stage 2 (enrichment) and Stage 3 (scoring) are ALREADY RUNNING — each
      // dish's calls fired the moment it streamed in (see startStages above).
      // Enrichment runs for every user regardless of profile maturity (day-0
      // utility needs no taste learning); scoring only once profile_ready.
      //
      // Each stage's server response echoes back the item snapshot it was CALLED
      // with, which can be stale by the time the response lands (the other stage
      // may have already updated that same item). Merging only the specific
      // fields each stage OWNS (the pool onEach bodies above), rather than
      // replacing the whole item, makes the merge order-independent: whichever
      // response arrives first or last, neither stage can ever clobber the
      // other's work.

      // Kana/hangul tripwire (語言對 fix v2). The skeleton model sometimes leaves
      // the printed Japanese/Korean name in name_zh despite the prompt telling it
      // to translate. A deterministic script check catches those; a single batched
      // call re-authors just the tripped ones through the proven translate path.
      // Runs CONCURRENTLY with enrichment/scoring and only when something tripped —
      // zero cost on Chinese/English menus — and patches only name_zh (matched by
      // name_original), so it can never clobber the other stages' fields.
      const tripped = items.filter(it => hasNonChineseScript(it.name_zh));
      // Resolves to the fixed-names map (not void): the shared-session sync below
      // folds it in itself — reading item.name_zh there would ship the STALE
      // pre-fix snapshot, since this handler only ever patched setResult.
      const namefixPromise: Promise<Record<string, string>> = (meta.mock || tripped.length === 0) ? Promise.resolve({}) : fetch('/api/menu-scan/fix-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: tripped.map(it => ({ key: it.name_original, name: it.name, name_zh: it.name_zh })) }),
      })
        .then(r => r.ok ? r.json() : { names: {} })
        .then((j: { names?: Record<string, string> }) => {
          const names = j.names ?? {};
          if (Object.keys(names).length) {
            setResult(prev => prev ? { ...prev, items: prev.items.map(it => names[it.name_original] ? { ...it, name_zh: names[it.name_original] } : it) } : prev);
          }
          return names;
        })
        .catch(() => ({})); // best-effort: a failed re-author leaves the printed name, never blocks

      // The view "settles" (ranked order, hero promoted, fire cap applied) once
      // every dish has a scoring outcome — i.e. when the score pool drains.
      // Much of it usually finished DURING the stream; this await only covers
      // the stragglers.
      const scoreResults = await scorePool.drain();
      setSettled(true);
      const enrichResults = await enrichPool.drain(); // usually already resolved by now; awaited so this function doesn't return early
      const nameFixes = await namefixPromise; // same: a re-author still in flight shouldn't be dropped on return

      // Both stages are done — the scan's full latency shape is known. Mock
      // runs are skipped: no provider calls happened, so their numbers would
      // only dilute the real ones.
      if (!meta.mock) {
        sendTelemetry(tele.summary({
          lang: done?.menu_language ?? 'unknown',
          items: items.length,
          append,
        }));
      }

      // Keep the SHARED table session in step with this scanner's finished view,
      // not just their local state — the shared session otherwise holds whatever
      // snapshot it was created/appended with forever, which is exactly how a
      // joiner at a Japanese restaurant saw untranslated names all meal
      // (two-account field test, 2026-07-24). Append grows it with the new
      // page's final items; a fresh scan RE-AUTHORS the creation-time snapshot
      // (which predates every stage) in place, keyed on name_original so
      // existing picks/stamps re-point instead of duplicating. Best-effort: a
      // failed sync must never surface as a scan error, since the scanner's own
      // view already has everything regardless.
      if (!meta.mock) {
        const forTable = mergeFinalScanItems(items, enrichResults, scoreResults, nameFixes);
        if (append && tableSession) {
          fetch(`/api/table/${tableSession.code}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: forTable }),
          }).catch(() => {});
        } else if (!append) {
          const session = await sessionPromise;
          if (session) {
            fetch(`/api/table/${session.code}`, {
              method: 'PATCH', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reauthor: forTable }),
            }).catch(() => {});
          }
        }
      }
      return;
    } catch (e: any) {
      // A scan that DIED is the most interesting latency record of all — how
      // far it got before failing is exactly what says whether the provider
      // stalled at stage 1 or something downstream broke. `reason` (or a
      // generic marker) rather than the raw message: the field is a token,
      // and a server-authored string has no business in a log dimension.
      sendTelemetry(tele.summary({
        lang: 'unknown', items: 0, append,
        error: e?.reason || 'threw',
      }));
      // Known reasons get localized copy (this app is zh-first by default, and a
      // hardcoded English server string would be unreadable to most users here).
      const localized = e?.reason === 'not_menu' ? t('scan.err.notmenu')
        : e?.reason === 'unreadable' ? t('scan.err.unreadable')
        : null;
      setError(localized || e.message || 'Something went wrong reading that menu.');
      if (append) {
        // A bad second-page photo must NOT wipe the good menu already on screen —
        // the whole point of accumulating is that page 1 survives. Just surface
        // the error inline and drop back to the (intact) results view.
        setAppending(false);
      } else {
        setScanning(false);
      }
    }
  }

  function reset() {
    clearScanSession(); // the X dismisses the menu for real — don't resurrect it on the next visit
    resetPreset(); // and forget any foreign-language preset/override with it (Fix 5)
    setResult(null);
    setPreview(null);
    setError('');
    setSettled(false);
    // The table session is state about the PREVIOUS menu and must not survive into
    // the next one — it kept polling a session that no longer relates to what's on
    // screen. Clearing it is now the ONLY thing needed: picks and their stamps hang
    // off the session inside useTableSession, so dropping the code drops them with
    // it, and there is no local pick Set left to go stale against the new menu.
    setTableSession(null);
  }

  // ---- capture state ----
  if (!result) {
    return (
      <div>
        <h1 style={{ marginBottom: 18 }}>{t('scan.title')}</h1>

        {preview && (
          <div className={`scan-frame ${scanning ? 'scanning' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Menu" className="card-photo" style={{ aspectRatio: 'auto', maxHeight: 420 }} />
            {scanning && <div className="scan-beam" aria-hidden />}
          </div>
        )}

        {/* SCANNING A MENU IS THE PRIMARY ACTION and now comes first, before the
            table-join box. Solo scanning is by far the more common path; joining a
            friend's table is the occasional one, so it sits below and deliberately
            reads quieter. Icons left; the right side is a MINIATURE of what a scan
            hands back — translated dish line + ingredient chips + dishi's rec —
            showing the payoff instead of describing the mechanics. */}
        {scanning ? (
          <p className="scan-status" role="status">{t(SCAN_STAGE_KEYS[stage])}</p>
        ) : (
          // Wrap so the ⓘ can sit over the banner's top-right as a SIBLING of the
          // picker button (a nested <button> is invalid and would swallow the tap).
          <div className="scan-dropzone-wrap">
            <PhotoPicker
              key={preview ?? 'fresh'}
              onPick={f => onPick(f)}
              icon={
                <span className="scan-dropzone-content">
                  <span className="scan-dropzone-icons">
                    <CameraIcon size={42} strokeWidth={1.1} />
                    <MenuBookIcon size={59} />
                  </span>
                  <ScanBenefitDemo />
                </span>
              }
              hideLabel
            />
            <button type="button" className="card-info-badge" aria-label={t('scan.help.title')}
              onClick={e => { e.stopPropagation(); setScanHelp(true); }}>i</button>
          </div>
        )}
        {scanHelp && (
          <ExplainModal title={t('scan.help.title')} body={t('scan.help.body')} onClose={() => setScanHelp(false)} />
        )}
        {error && <p style={{ color: 'var(--lacquer)', marginTop: 12 }}>{error}</p>}

        {/* Secondary path, intentionally low-key: under a divider, quieter type.
            Matches the mock: serif heading, grey blurb, a large letter-spaced
            code input + a single round arrow submit button. */}
        {!preview && !scanning && (
          <div className="join-table">
            <h3 className="join-table-title">
              {t('table.join')}
              <button type="button" className="info-inline-badge" aria-label={t('table.help.title')}
                onClick={() => setTableHelp(true)}>i</button>
            </h3>
            <p className="join-table-blurb">{t('table.join.blurb')}</p>
            {tableHelp && (
              <ExplainModal title={t('table.help.title')} body={t('table.help.body')} onClose={() => setTableHelp(false)} />
            )}
            <div className="join-row">
              <input
                className="field join-code-input" placeholder="ABCDE" maxLength={5}
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                aria-label={t('table.joinbtn')}
              />
              <button className="join-go" disabled={joinBusy || joinCode.trim().length !== 5} onClick={joinTable}
                aria-label={t('table.joinbtn')} title={t('table.joinbtn')}>
                <ArrowRightIcon size={22} />
              </button>
            </div>
            {joinError && <p style={{ color: 'var(--lacquer)', fontSize: 12.5, marginTop: 6 }}>{joinError}</p>}
          </div>
        )}
      </div>
    );
  }

  // ---- results state ----
  const pending = result.items.filter(i => i.match === undefined).length;
  const failed = result.items.filter(i => i.match === null).length;
  const allFailed = result.profile_ready && settled && failed === result.items.length;

  // Ranked rendering (hero promoted, sorted, reasons shown) only once EVERY dish has
  // an outcome — scored or failed. While anything is still pending, keep the
  // original menu order so nothing visually jumps around mid-scan.
  const readyToRank = result.profile_ready && settled && !allFailed;

  // No displayed numbers, no reordering. Match percentages felt like confident
  // claims the engine couldn't back at low maturity — the raw spread across a menu
  // is often tiny, and any visual stretch of it manufactures differentiation out of
  // noise. The math still runs in the background (raw_score ranks fire candidates);
  // the only user-facing claim is FIRE, and only when it's earned. Everything else:
  // an honest menu in its own original order, fully pickable.
  //
  // Fire cap applied here at settle: the server qualifies each dish in isolation
  // (Phase 2 is one call per dish), the client keeps only the top 2 qualifiers by
  // background raw score — scarcity is part of what makes the mark credible.
  const fireWinners = new Set(
    readyToRank
      ? result.items
          .filter(i => i.fire && i.raw_score !== undefined)
          .sort((a, b) => (b.raw_score ?? 0) - (a.raw_score ?? 0))
          .slice(0, 2)
          .map(i => i.name_original)
      : [],
  );
  const displayItems = result.items;

  // ---- picks, through the shared table engine ----
  // One adapter from this screen's ScannedItem to the engine's item shape. The key
  // IS name_original — scanCandidateKey's contract (see tableMenuItems.ts), which
  // is what makes a pick made HERE and a pick made on /table land on the same
  // candidate. Index keys made cross-view stamps invisible in both directions once
  // before (2026-07-24); nothing here may reintroduce one.
  const stampable = (item: ScannedItem) => ({
    key: item.name_original, name: item.name, name_zh: item.name_zh,
  });
  // The scan's own enrichment/scoring output, carried into the stored dish row so
  // nothing the scan already computed has to be re-inferred server-side.
  const togglePick = (item: ScannedItem) => table.toggle(stampable(item), {
    cuisine: item.cuisine, attributes: item.attributes ?? {},
    cooking_method: item.cooking_method, heaviness: item.heaviness,
    diet: item.diet, ingredients: item.ingredients,
  });
  const isPicked = (item: ScannedItem) => table.isPicked(stampable(item));
  const stampsOf = (item: ScannedItem) => table.stampsFor(stampable(item));

  // Foreign-menu preset: if the menu's language is one we can display but is in
  // NEITHER slot of the active pair, show it as the secondary for THIS scan only
  // (the persisted pair is untouched — leaving the scan restores it). Passing
  // menuLanguage also triggers the fidelity rule: that slot renders the printed
  // original verbatim rather than a re-translation. `menuCode`/`foreignSecondary`
  // are computed at the top of the component; `overridden` makes an explicit globe
  // choice win over the preset (Fix 5).
  const scanPair = scanPresetPair(pair, menuCode, overridden);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <h1 style={{ margin: 0 }}>{t('scan.results')}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* 加掃一版 (add a page): scans another page and MERGES its dishes onto
              this menu, so the ranking spans everything orderable. Disabled while a
              page is being read. */}
          <label className={`btn ghost small ${appending ? 'is-disabled' : ''}`} style={{ cursor: appending ? 'default' : 'pointer' }}>
            <input type="file" accept="image/*" hidden disabled={appending}
              onChange={e => { const f = e.target.files?.[0] ?? null; e.target.value = ''; onPick(f, { append: true }); }} />
            {appending ? t('scan.addingpage') : t('scan.addpage')}
          </label>
          {/* X: close the results and return to the fresh Scan landing. Not a lock
              — the menu simply stays put until the user closes it or leaves. */}
          <button className="icon-btn" onClick={reset} aria-label={t('scan.close')} title={t('scan.close')}>
            <CloseIcon />
          </button>
        </div>
      </div>
      <p className="card-meta" style={{ marginBottom: keptNote ? 6 : 18 }}>
        {result.items.length > 0
          ? <>{t('scan.read', { n: result.items.length })}{result.restaurant_guess ? ` \u00b7 ${result.restaurant_guess}` : ''}</>
          : <span role="status">{t('scan.reading')}</span>}
      </p>
      {keptNote && (
        <p className="card-meta" style={{ marginBottom: 18, color: 'var(--ink-soft)' }} role="status">
          {t('scan.kept', { name: keptNote })}
        </p>
      )}
      {foreignSecondary && !overridden && (
        <p className="card-meta" style={{ marginTop: -15, marginBottom: 18, color: 'var(--ink-soft)' }} role="status">
          {t('lang.foreignmenu', { lang: languageLabel(foreignSecondary) })}
        </p>
      )}
      {appending && (
        <div className="scan-appending" role="status">
          <span className="scan-appending-dot" aria-hidden />
          {t('scan.addingpage')}
        </div>
      )}

      {/* Table sharing: a lightweight glance, not a duplicate of /table's full
          ranked view. Before a session exists, one tap turns this exact scan
          into a shared one; once it does, the code/member-count/pick-count here
          are the SAME live numbers /table itself polls — just visible without
          leaving the scan screen. */}
      {tableSession && (
        <TableBar
          code={tableSession.code}
          memberCount={table.members.length}
          // DISTINCT dishes with a stamp, not raw pick rows: two people picking the
          // same dish used to inflate this count (owner correction, 2026-07-21, on
          // /table's own copy of the same bug). Live-merged, so it agrees with the
          // stamps on the rows instead of lagging a poll behind them.
          pickCount={displayItems.filter(i => stampsOf(i).length > 0).length}
          onInvite={copyTableLink}
          restaurantLine={
            <TableRestaurantLine restaurant={table.restaurant} onChange={table.setRestaurant} />
          }
        />
      )}

      {result.mock && (
        <p className="scan-banner">{t('scan.mock')}</p>
      )}
      {!result.profile_ready && (
        <p className="scan-banner">
          {t('scan.training', { n: (result.needed ?? 5) - result.rating_count })}
        </p>
      )}
      {result.profile_ready && pending > 0 && (
        <p className="scan-banner" role="status">{t('scan.scoring')}</p>
      )}
      {allFailed && (
        <p className="scan-banner">{t('scan.scorefailed')}</p>
      )}

      {/* Under-threshold: an honest plain list — no rings, no reasons, no hero.
          Hook + day-0 chips still fill in progressively via Stage 2 enrichment. */}
      {!result.profile_ready && result.items.map((item, i) => (
        <article className={`card scan-pickable ${isPicked(item) ? 'picked' : ''}`} key={`plain-${i}`}
          onClick={() => togglePick(item)}>
          <div className="card-body">
            <div className="scan-item">
              <span className="scan-rank">{i + 1}.</span>
              <div className="scan-item-main">
                <div className="dish-row">
                  <div className="card-title"><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} pair={scanPair} menuLanguage={menuCode} />{item.isNew && <span className="scan-new-tag">{t('scan.new')}</span>}</div>
                  {item.price && <span className="dish-price">{item.price}</span>}
                </div>
                {/* Cooking hook stays indented under the name; chips sit further left. */}
                {item.enriched && <DishInfoDisplay info={item} hookOnly />}
              </div>
            </div>
            <DishDetails item={item} hideHook />
            <ChopStampRow itemKey={item.name_original} stamps={stampsOf(item)} colorFor={table.colorFor} />
          </div>
        </article>
      ))}

      {/* Scoring in progress OR all failed: every dish visible immediately, in
          original order, each ring reflecting its own individual state. */}
      {result.profile_ready && !readyToRank && result.items.map((item, i) => (
        <article className={`card scan-pickable ${isPicked(item) ? 'picked' : ''}`} key={`scoring-${i}`}
          onClick={() => togglePick(item)}>
          <div className="card-body">
            <div className="scan-item">
              <span className="scan-rank">{i + 1}.</span>
              <div className="scan-item-main">
                <div className="dish-row">
                  <div className="card-title"><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} pair={scanPair} menuLanguage={menuCode} />{item.isNew && <span className="scan-new-tag">{t('scan.new')}</span>}</div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {item.match === undefined && <Spinner size={16} />}
                    {item.price && <span className="dish-price">{item.price}</span>}
                  </span>
                </div>
                {item.enriched && <DishInfoDisplay info={item} hookOnly />}
              </div>
            </div>
            <DishDetails item={item} hideHook />
            <ChopStampRow itemKey={item.name_original} stamps={stampsOf(item)} colorFor={table.colorFor} />
          </div>
        </article>
      ))}

      {/* Settled: same original menu order — the engine speaks ONLY through fire.
          A fire dish gets the mark, a highlighted card, and its plain-words reason;
          every other dish is presented without any claim at all. Silence about a
          dish means "not confident enough to say," which is the honest default. */}
      {readyToRank && (
        <div className="scan-settle">
          {displayItems.map((item, i) => (
            <DishListRow
              key={`${item.name}-${i}`}
              item={{
                key: item.name_original, name: item.name, name_zh: item.name_zh, name_original: item.name_original,
                price: item.price, cooking_method: item.cooking_method, heaviness: item.heaviness,
                diet: item.diet, ingredients: item.ingredients, enriched: item.enriched, isNew: item.isNew,
              }}
              rank={i + 1}
              picked={isPicked(item)}
              onSelect={() => togglePick(item)}
              // The chop stamp carries who — never a "X 也選了" line alongside it
              // (owner feedback, 2026-07-21): that stacking was the crowding.
              stamps={<ChopStampRow itemKey={item.name_original} stamps={stampsOf(item)} colorFor={table.colorFor} />}
              fire={fireWinners.has(item.name_original)}
              reason={item.reason}
              pair={scanPair}
              menuLanguage={menuCode}
            />
          ))}
        </div>
      )}

      <p className="card-meta" style={{ margin: '4px 0 12px' }}>
        {t('scan.logged')}
      </p>

      {/* Running summary of what MY OWN picks come to — count + price, read-only.
          There is no confirm step to reach anymore: each pick was already written
          the moment it was tapped (see the pick note above), so this is a receipt,
          not a button. Same .cart-bar chrome /table's own footer uses, for the same
          reason it's read-only there. Picking works before profile_ready too, since
          picking dishes to rate is how a new user reaches the 5-rating threshold
          fastest. */}
      {(() => {
        const myPicks = displayItems.filter(i => isPicked(i));
        if (!myPicks.length) return null;
        const priceSummary = sumPrices(myPicks.map(i => i.price));
        // Only worth showing once at least one picked dish has a real price —
        // otherwise this would just be a count with extra steps. When some (but
        // not all) picked prices are unreadable/missing, the "+" is load-bearing:
        // it's an honest floor, not the real total, and must never be shown as one.
        const priceLabel = priceSummary.parsedCount > 0
          ? `${priceSummary.currency}${priceSummary.total}${priceSummary.complete ? '' : '+'}`
          : null;
        // "揀咗 X 碟" on the left, running total hard-right — the two are different
        // KINDS of information (what you did vs what it costs), so they're pushed to
        // opposite ends rather than run together into one comma-joined string.
        return (
          <div className="cart-bar">
            <div className="btn primary cart-btn" style={{ pointerEvents: 'none' }}>
              <span>{t('scan.pickcount', { n: myPicks.length })}</span>
              {priceLabel && <span className="cart-total">{priceLabel}</span>}
            </div>
          </div>
        );
      })()}
    </div>
  );
}




/**
 * Cooking-bucket line + day-0 utility chips (diet/heaviness) for one dish card.
 * These arrive from Stage 2 enrichment progressively, in concurrency-capped
 * waves, independent of whether taste scoring is even running — a shimmer
 * placeholder holds the line's space (so cards don't visibly jump in height as
 * enrichment lands) and everything fades in once `enriched` flips true, rather
 * than popping in abruptly.
 */
// pickersFor is gone: matching a pick to a dish is pickMatchesItem's job (see
// tableStamps.ts), reached through useTableSession's stampsFor. This screen had
// its own near-copy of that rule, which is precisely the kind of second
// implementation the chassis extraction removed — and it returned bare handle
// STRINGS for a text line, where the stamp needs a user_id to colour a chop from.

function DishDetails({ item, hideHook = false }: { item: ScannedItem; hideHook?: boolean }) {
  if (!item.enriched) {
    return <div className="hook-shimmer" aria-hidden />;
  }
  // Cooking style + diet/heaviness now render through the SHARED DishInfoDisplay,
  // so a dish read off a menu and the same dish once rated (on the Taste tab) show
  // identical information rather than differing by which screen you met it on.
  return (
    <div className="fade-in">
      <DishInfoDisplay info={item} hideHook={hideHook} />
    </div>
  );
}

/** Small in-progress spinner shown while a dish's background scoring is running. */
function Spinner({ size }: { size: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} role="img" aria-label="Thinking\u2026" style={{ flexShrink: 0 }} className="match-ring-spinner">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} opacity={0.35} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-faint)" strokeWidth={4}
        strokeLinecap="round" strokeDasharray={`${c * 0.22} ${c}`} />
    </svg>
  );
}
