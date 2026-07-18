'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import { mapWithConcurrency } from '@/lib/concurrency';
import DishInfoDisplay from '@/components/DishInfoDisplay';
import { sumPrices } from '@/lib/price';
import { CameraIcon, MenuBookIcon, ArrowRightIcon, CloseIcon, SpeechIcon } from '@/components/icons';
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
    <AuthGate>
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
  const restored = getScanSession<ScanResponse | null, RestaurantChoice>();
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
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
  const [tableMemberCount, setTableMemberCount] = useState(0);
  const [tablePicks, setTablePicks] = useState<{ name: string; name_zh: string | null; handle: string; identity_name?: string | null; identity_name_zh?: string | null }[]>([]);

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
  async function createTableSession(items: ScannedItem[]) {
    try {
      const res = await fetch('/api/table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not create a table code.');
      setTableSession({ code: json.code, session_id: json.session_id });
    } catch {
      /* A missing table code must never break a scan that otherwise worked. The
         dishes are the point; sharing is a bonus. Silently absent is correct. */
    }
  }

  async function copyTableLink() {
    if (!tableSession) return;
    const url = `${window.location.origin}/table?code=${tableSession.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: t('table.sharetitle'), url }); return; }
      await navigator.clipboard.writeText(url);
      alert(t('table.copied'));
    } catch { /* share/clipboard can be cancelled or unavailable — not an error */ }
  }

  // Poll the same endpoint /table itself polls, at the same interval — this is
  // genuinely the same shared state, just glanced at from a second screen.
  useEffect(() => {
    if (!tableSession) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/table/${tableSession!.code}`);
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setTableMemberCount(json.members?.length ?? 0);
        setTablePicks(json.table_picks ?? []);
      } catch { /* a missed poll just means slightly stale numbers next tick */ }
    }
    poll();
    const timer = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [tableSession]);

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

  // "Pick" mode: tap a scanned dish to mark it for later rating (no photo needed —
  // the taste engine already has its attributes from scoring). Keyed by the printed
  // name, which stays stable even when the list re-sorts into ranked order.
  const [picked, setPicked] = useState<Set<string>>(() => new Set(restored?.picked ?? []));
  const [confirmingPick, setConfirmingPick] = useState(false);
  const [pickRestaurant, setPickRestaurant] = useState<RestaurantChoice>(restored?.pickRestaurant ?? null);
  const [pickSaving, setPickSaving] = useState(false);
  const [pickError, setPickError] = useState('');

  // Keep the module-level store in sync with the on-screen menu, so leaving and
  // returning to this tab restores it. Only mirrors once a scan exists — with no
  // result there's nothing to preserve, and reset()/the X clears the store
  // directly. Not persisted: scanning, preview, and the transient confirm sheet,
  // none of which can (or should) be resurrected on a remount.
  useEffect(() => {
    if (!result) return;
    setScanSession({
      result, settled, keptNote, tableSession,
      picked: Array.from(picked),
      pickRestaurant,
    });
  }, [result, settled, keptNote, tableSession, picked, pickRestaurant]);

  function togglePick(key: string) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function confirmPicks() {
    if (!result) return;
    setPickSaving(true); setPickError('');
    const chosen = result.items.filter(i => picked.has(i.name_original));
    try {
      const res = await fetch('/api/dishes/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_id: pickRestaurant?.kind === 'existing' ? pickRestaurant.id : undefined,
          new_restaurant: pickRestaurant?.kind === 'new' ? pickRestaurant : undefined,
          table_session_id: tableSession?.session_id,
          items: chosen.map(i => ({
            name: i.name, name_zh: i.name_zh, cuisine: i.cuisine, attributes: i.attributes ?? {},
            cooking_method: i.cooking_method, heaviness: i.heaviness, diet: i.diet,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save your picks.');
      // Seal at PICK time — the moment you commit to ordering these dishes, the
      // engine commits its prediction, instead of waiting until you next open the
      // Taste tab. Picked dishes already carry real attributes from the scan, so the
      // seal is meaningful now. Server-gated (>= SEAL_GATE ratings) + idempotent, so
      // this no-ops when the engine's too young or a seal already exists; awaited so
      // the seal is committed BEFORE /log can let you rate (contentScore/composeReason
      // only — no LLM, so it's quick). The Taste-tab/log queue-load sealing stays as
      // the backstop for dishes born WITHOUT attributes yet (typed names, whose
      // enrichment is deferred) — those can only be sealed once enriched.
      const pickedIds: string[] = (json.picked ?? []).map((p: { id?: string }) => p.id).filter(Boolean) as string[];
      await Promise.all(pickedIds.map(id =>
        fetch('/api/seals', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dish_id: id }),
        }).catch(() => { /* a missing stamp is cosmetic; never block the pick on it */ }),
      ));
      router.push('/log');
    } catch (e: any) {
      setPickError(e.message || 'Something went wrong saving those picks.');
    } finally {
      setPickSaving(false);
    }
  }

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
      setPicked(new Set());
      setConfirmingPick(false);
      setPickError('');
      setPreview(URL.createObjectURL(file));
      setScanning(true);
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
                items = [...items, { ...incoming, isNew: true }];
                const snapshot = [...baseItems, ...items];
                setResult(prev => prev ? { ...prev, items: snapshot } : prev);
              }
            } else {
              const isFirst = items.length === 0;
              items = [...items, incoming];
              const snapshot = items;
              if (isFirst && meta) {
                // First real content: NOW switch to the results view.
                setScanning(false);
                setResult({
                  phase: meta.phase, profile_ready: meta.profile_ready, rating_count: meta.rating_count, needed: meta.needed,
                  mock: meta.mock, menu_language: 'unknown', restaurant_guess: null, items: snapshot,
                });
              } else {
                setResult(prev => prev ? { ...prev, items: snapshot } : prev);
              }
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

      if (!meta) throw new Error('Scan ended unexpectedly.');
      if (!append && items.length === 0) throw new Error('No dishes could be read from that photo.');

      const offset = baseItems.length; // where this page's new dishes sit in the combined list (0 when fresh)

      if (append) {
        // Page-1's restaurant wins for the session. If the new page guessed a
        // strongly-different place, note it quietly (likely a wrong-menu scan) —
        // never block; the dishes are added regardless.
        const decision = restaurantKeptNote(result?.restaurant_guess ?? null, done?.restaurant_guess ?? null);
        if (decision?.noteMismatch) setKeptNote(decision.keep);
        // Combined menu; restaurant/menu_language stay as page 1's.
        setResult(prev => prev ? { ...prev, items: [...baseItems, ...items] } : prev);
        setAppending(false);
        if (items.length === 0) { setSettled(true); return; } // nothing new to score
      } else {
        // Fire-and-forget: the table code appears when it appears, and never
        // blocks scoring or the dishes already on screen. Only the FIRST scan
        // creates the session — an appended page extends this person's local menu,
        // not the shared session (per-person menu, pooled picks).
        void createTableSession(items);
        setResult(prev => prev ? { ...prev, items, menu_language: done?.menu_language ?? 'unknown', restaurant_guess: done?.restaurant_guess ?? null } : prev);
      }
      if (meta.phase !== 'needs_scoring') setSettled(true); // already complete (mock / under threshold)

      // Stage 2 (enrichment: hook/diet/cooking/heaviness/ingredients) always runs,
      // for every user, regardless of profile maturity — day-0 utility needs no
      // taste learning. Stage 3 (flavor scoring) only runs once profile_ready. The
      // two are INDEPENDENT, so they run concurrently rather than one waiting on
      // the other.
      //
      // Each stage's server response echoes back the item snapshot it was CALLED
      // with, which — because the two calls fire at the same time — can be stale
      // by the time the response lands (the other stage may have already updated
      // that same item). Merging only the specific fields each stage OWNS, rather
      // than replacing the whole item, makes the merge order-independent: whichever
      // response arrives first or last, neither stage can ever clobber the other's
      // work.
      const enrichPromise = meta.mock ? Promise.resolve() : mapWithConcurrency(
        items,
        SCORE_CONCURRENCY,
        async (item) => {
          const r = await fetch('/api/menu-scan/enrich', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item }),
          });
          if (!r.ok) throw new Error('enrich failed');
          return (await r.json()).item as ScannedItem;
        },
        (enriched, index) => {
          setResult(prev => {
            if (!prev) return prev;
            const at = offset + index;
            const nextItems = [...prev.items];
            nextItems[at] = enriched
              ? { ...nextItems[at], hook: enriched.hook, hook_zh: enriched.hook_zh, diet: enriched.diet, cooking_method: enriched.cooking_method, heaviness: enriched.heaviness, ingredients: enriched.ingredients, enriched: true }
              : { ...nextItems[at], enriched: true }; // failed enrichment: stop showing the shimmer, stay honestly empty
            return { ...prev, items: nextItems };
          });
        },
      ).catch(() => {}); // best-effort: a failed enrichment batch must never block scoring or settle

      // Kana/hangul tripwire (語言對 fix v2). The skeleton model sometimes leaves
      // the printed Japanese/Korean name in name_zh despite the prompt telling it
      // to translate. A deterministic script check catches those; a single batched
      // call re-authors just the tripped ones through the proven translate path.
      // Runs CONCURRENTLY with enrichment/scoring and only when something tripped —
      // zero cost on Chinese/English menus — and patches only name_zh (matched by
      // name_original), so it can never clobber the other stages' fields.
      const tripped = items.filter(it => hasNonChineseScript(it.name_zh));
      const namefixPromise = (meta.mock || tripped.length === 0) ? Promise.resolve() : fetch('/api/menu-scan/fix-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: tripped.map(it => ({ key: it.name_original, name: it.name, name_zh: it.name_zh })) }),
      })
        .then(r => r.ok ? r.json() : { names: {} })
        .then((j: { names?: Record<string, string> }) => {
          const names = j.names ?? {};
          if (!Object.keys(names).length) return;
          setResult(prev => prev ? { ...prev, items: prev.items.map(it => names[it.name_original] ? { ...it, name_zh: names[it.name_original] } : it) } : prev);
        })
        .catch(() => {}); // best-effort: a failed re-author leaves the printed name, never blocks

      // Phase 2 (scoring): one small call PER DISH, several in parallel (capped).
      // Each ring lights up the moment ITS call finishes — no waiting for the
      // slowest dish to unblock everyone else's result. Original menu order is
      // preserved while any dish is still pending; once every dish has an outcome
      // (scored or failed), the view "settles" into ranked order with the hero
      // promoted.
      const scorePromise = meta.phase === 'needs_scoring'
        ? mapWithConcurrency(
            items,
            SCORE_CONCURRENCY,
            async (item) => {
              const r = await fetch('/api/menu-scan/score', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item, lang }),
              });
              if (!r.ok) throw new Error('score failed');
              return (await r.json()).item as ScannedItem;
            },
            (scored, index) => {
              setResult(prev => {
                if (!prev) return prev;
                const at = offset + index;
                const nextItems = [...prev.items];
                nextItems[at] = scored
                  ? { ...nextItems[at], match: scored.match, reason: scored.reason, caution: scored.caution, fire: scored.fire, raw_score: scored.raw_score, attributes: scored.attributes }
                  : { ...nextItems[at], match: null }; // null = failed, shown gracefully
                return { ...prev, items: nextItems };
              });
            },
          )
        : Promise.resolve();

      await scorePromise;
      setSettled(true);
      await enrichPromise; // usually already resolved by now; awaited so this function doesn't return early
      await namefixPromise; // same: a re-author still in flight shouldn't be dropped on return
      return;
    } catch (e: any) {
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
    // Everything below is state about the PREVIOUS menu and must not survive into
    // the next one. `picked` is keyed by printed dish name, so a leftover set kept
    // the cart bar showing the old menu's pick count while none of those dishes
    // exist in the new scan; and the table session kept polling a session that no
    // longer relates to what's on screen.
    setPicked(new Set());
    setConfirmingPick(false);
    setPickRestaurant(null);
    setPickError('');
    setTableSession(null);
    setTableMemberCount(0);
    setTablePicks([]);
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
            reads quieter. The dropzone is icon-only (thin camera, no label) to
            match the design mock — the scan.tip line under it carries the words. */}
        {scanning ? (
          <p className="scan-status" role="status">{t(SCAN_STAGE_KEYS[stage])}</p>
        ) : (
          <>
            <PhotoPicker
              key={preview ?? 'fresh'}
              onPick={f => onPick(f)}
              icon={
                <span className="scan-dropzone-content">
                  <span className="scan-dropzone-icons">
                    <CameraIcon size={42} strokeWidth={1.1} />
                    <MenuBookIcon size={59} />
                  </span>
                  <span className="scan-dropzone-tip">{t('scan.tip')}</span>
                </span>
              }
              hideLabel
            />
          </>
        )}
        {error && <p style={{ color: 'var(--lacquer)', marginTop: 12 }}>{error}</p>}

        {/* Secondary path, intentionally low-key: under a divider, quieter type.
            Matches the mock: serif heading, grey blurb, a large letter-spaced
            code input + a single round arrow submit button. */}
        {!preview && !scanning && (
          <div className="join-table">
            <h3 className="join-table-title">{t('table.join')}</h3>
            <p className="join-table-blurb">{t('table.join.blurb')}</p>
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
            {/* /table's create-a-table flow lost its nav tab in the restructure
                and had ZERO inbound links — this quiet line is its front door.
                (Creating a table without scanning a menu is a real capability:
                the table ranks dishes from around Dishi instead.) */}
            <p className="card-meta" style={{ marginTop: 12 }}>
              <a href="/table" className="table-open-link" style={{ color: 'var(--ink)' }}>{t('table.open.full')}</a>
            </p>
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
        <div className="table-bar">
          <span className="table-bar-left">
            <span className="table-bar-codewrap">
              <span className="table-bar-label">{t('scan.tablelabel')}</span>
              <span className="table-bar-code">{tableSession.code}</span>
            </span>
            {/* Headcount + dishes picked as one quiet meta line, sitting right
                after the code (separated by a "|") — status, not a dashboard. */}
            <span className="table-bar-stat">
              {t('scan.tablestatus', { n: tableMemberCount, m: tablePicks.length })}
            </span>
          </span>
          <button className="btn small" onClick={copyTableLink}>
            {t('table.invite')}
          </button>
        </div>
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
        <article className={`card scan-pickable ${picked.has(item.name_original) ? 'picked' : ''}`} key={`plain-${i}`}
          onClick={() => togglePick(item.name_original)}>
          <div className="card-body">
            <div className="dish-row">
              <div className="card-title"><DishName prefix={`${i + 1}. `} name={item.name} name_zh={item.name_zh} name_original={item.name_original} pair={scanPair} menuLanguage={menuCode} />{item.isNew && <span className="scan-new-tag">{t('scan.new')}</span>}</div>
              {item.price && <span className="dish-price">{item.price}</span>}
            </div>
            <DishDetails item={item} t={t} lang={lang} pickedBy={pickersFor(item, tablePicks)} />
          </div>
        </article>
      ))}

      {/* Scoring in progress OR all failed: every dish visible immediately, in
          original order, each ring reflecting its own individual state. */}
      {result.profile_ready && !readyToRank && result.items.map((item, i) => (
        <article className={`card scan-pickable ${picked.has(item.name_original) ? 'picked' : ''}`} key={`scoring-${i}`}
          onClick={() => togglePick(item.name_original)}>
          <div className="card-body">
            <div className="dish-row">
              <div className="card-title"><DishName prefix={`${i + 1}. `} name={item.name} name_zh={item.name_zh} name_original={item.name_original} pair={scanPair} menuLanguage={menuCode} />{item.isNew && <span className="scan-new-tag">{t('scan.new')}</span>}</div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {item.match === undefined && <Spinner size={16} />}
                {item.price && <span className="dish-price">{item.price}</span>}
              </span>
            </div>
            <DishDetails item={item} t={t} lang={lang} pickedBy={pickersFor(item, tablePicks)} />
          </div>
        </article>
      ))}

      {/* Settled: same original menu order — the engine speaks ONLY through fire.
          A fire dish gets the mark, a highlighted card, and its plain-words reason;
          every other dish is presented without any claim at all. Silence about a
          dish means "not confident enough to say," which is the honest default. */}
      {readyToRank && (
        <div className="scan-settle">
          {displayItems.map((item, i) => {
            const fire = fireWinners.has(item.name_original);
            return (
              <article
                className={`card scan-pickable scan-settle-row ${fire ? 'scan-hero' : ''} ${picked.has(item.name_original) ? 'picked' : ''}`}
                key={`${item.name}-${i}`}
                onClick={() => togglePick(item.name_original)}
              >
                <div className="card-body">
                  <div className="dish-row">
                    <div className="card-title" style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
                      <DishName prefix={`${i + 1}. `} name={item.name} name_zh={item.name_zh} name_original={item.name_original} pair={scanPair} menuLanguage={menuCode}
                        suffix={fire ? <span className="scan-fire scan-fire-pop" aria-label={t('scan.fire')}>{'\uD83D\uDD25'}</span> : undefined} />
                      {item.isNew && <span className="scan-new-tag">{t('scan.new')}</span>}
                    </div>
                    {item.price && <span className="dish-price">{item.price}</span>}
                  </div>
                  <DishDetails item={item} t={t} lang={lang} pickedBy={pickersFor(item, tablePicks)} />
                  {fire && item.reason && (
                    <p className="scan-reason fade-in">
                      <span className="scan-reason-icon" aria-hidden><SpeechIcon size={18} /></span>
                      <span>{item.reason}</span>
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="card-meta" style={{ margin: '4px 0 12px' }}>
        {t('scan.logged')}
      </p>

      {/* Pick-mode confirm: tapping any dish above marks it for later rating (no
          photo needed — attributes already came from scoring). This works even
          before profile_ready, since picking dishes to rate is exactly how a new
          user reaches the 5-rating threshold fastest. */}
      {(() => {
        const pickedItems = result.items.filter(i => picked.has(i.name_original));
        const priceSummary = sumPrices(pickedItems.map(i => i.price));
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
        const countLabel = t('scan.pickcount', { n: picked.size });

        return (
          <>
            {picked.size > 0 && !confirmingPick && (
              <div className="cart-bar">
                <button className="btn primary cart-btn" onClick={() => setConfirmingPick(true)}>
                  <span>{countLabel}</span>
                  {priceLabel && <span className="cart-total">{priceLabel}</span>}
                </button>
              </div>
            )}

            {confirmingPick && (
              <div className="cart-bar" style={{ bottom: 0, paddingBottom: 16 }}>
                <div className="card" style={{ marginBottom: 8, maxHeight: '60vh', overflowY: 'auto' }}>
                  <div className="card-body">
                    <p style={{ fontWeight: 700, marginBottom: 8 }}>{t('scan.pickrestaurant')}</p>
                    <RestaurantPicker onChange={setPickRestaurant} />
                    {pickError && <p style={{ color: 'var(--lacquer)', marginTop: 8 }}>{pickError}</p>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirmingPick(false)} disabled={pickSaving}>
                    {t('home.cancel')}
                  </button>
                  <button className="btn primary cart-btn" style={{ flex: 2 }} onClick={confirmPicks} disabled={pickSaving}>
                    {pickSaving ? <span>{t('log.saving')}</span> : (
                      <>
                        <span>{countLabel}</span>
                        {priceLabel && <span className="cart-total">{priceLabel}</span>}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
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
/** Which table members (if any) also picked this exact dish. Matches on name/
 * name_zh directly rather than fuzzy identity resolution — everyone at a shared
 * table is picking from the SAME stored item list (session.menu_items, seeded
 * once when sharing started), so an exact match is the correct comparison here,
 * not an approximation of one. */
function pickersFor(
  item: ScannedItem,
  tablePicks: { name: string; name_zh: string | null; handle: string; identity_name?: string | null; identity_name_zh?: string | null }[],
): string[] {
  const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
  const target = norm(item.name);
  const targetZh = norm(item.name_zh);
  return tablePicks
    // Match the menu's printed name against the pick's own names AND its
    // canonical identity's names — so a pick renamed after logging (or linked
    // to a canonical identity under a different spelling) still shows as
    // "also picked" instead of silently fragmenting.
    .filter(p => {
      const aliases = [p.name, p.name_zh, p.identity_name, p.identity_name_zh].map(norm).filter(Boolean);
      return aliases.includes(target) || (!!targetZh && aliases.includes(targetZh));
    })
    .map(p => p.handle);
}

function DishDetails({ item, t, lang, pickedBy }: { item: ScannedItem; t: (key: string, params?: Record<string, string | number>) => string; lang: 'zh' | 'en'; pickedBy?: string[] }) {
  if (!item.enriched) {
    return <div className="hook-shimmer" aria-hidden />;
  }
  // Cooking style + diet/heaviness now render through the SHARED DishInfoDisplay,
  // so a dish read off a menu and the same dish once rated (on the Taste tab) show
  // identical information rather than differing by which screen you met it on.
  return (
    <div className="fade-in">
      <DishInfoDisplay info={item} />
      {!!pickedBy?.length && (
        <div className="card-meta" style={{ color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}>
          {t('scan.share.alsopicked', { handles: pickedBy.join('、') })}
        </div>
      )}
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
