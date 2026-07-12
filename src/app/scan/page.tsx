'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import RestaurantPicker, { RestaurantChoice } from '@/components/RestaurantPicker';
import { mapWithConcurrency } from '@/lib/concurrency';
import { useLang } from '@/lib/i18n';

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
  const { t, lang } = useLang();
  const [preview, setPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // "Pick" mode: tap a scanned dish to mark it for later rating (no photo needed —
  // the taste engine already has its attributes from scoring). Keyed by the printed
  // name, which stays stable even when the list re-sorts into ranked order.
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirmingPick, setConfirmingPick] = useState(false);
  const [pickRestaurant, setPickRestaurant] = useState<RestaurantChoice>(null);
  const [pickSaving, setPickSaving] = useState(false);
  const [pickError, setPickError] = useState('');

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
          items: chosen.map(i => ({ name: i.name, name_zh: i.name_zh, cuisine: i.cuisine, attributes: i.attributes ?? {} })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save your picks.');
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

  async function onPick(file: File | null) {
    if (!file) return;
    setError('');
    setResult(null);
    setSettled(false);
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const form = new FormData();
      form.append('photo', await normalizePhoto(file));
      const res = await fetch('/api/menu-scan', { method: 'POST', body: form });
      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as any).error || 'Scan failed.');
      }

      // Consume the NDJSON stream one line at a time. 'item' events append a dish
      // to the visible list the MOMENT its own JSON object closed in the model's
      // response — this is what makes dishes appear one by one instead of all at
      // once after one long wait. 'start' arrives first (profile info is already
      // known before the model call even begins) and switches the screen to the
      // results view immediately, with an empty list that fills in live.
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
            meta = ev;
            setScanning(false);
            setResult({
              phase: ev.phase, profile_ready: ev.profile_ready, rating_count: ev.rating_count, needed: ev.needed,
              mock: ev.mock, menu_language: 'unknown', restaurant_guess: null, items: [],
            });
          } else if (ev.kind === 'item') {
            items = [...items, ev.item as ScannedItem];
            const snapshot = items;
            setResult(prev => prev ? { ...prev, items: snapshot } : prev);
          } else if (ev.kind === 'done') {
            done = ev;
          } else if (ev.kind === 'error') {
            throw new Error(ev.error);
          }
        }
      }

      if (!meta) throw new Error('Scan ended unexpectedly.');
      if (items.length === 0) throw new Error('No dishes could be read from that photo.');

      // Finalize with the terminal metadata (menu_language/restaurant_guess) now
      // that the stream has ended.
      setResult(prev => prev ? { ...prev, items, menu_language: done?.menu_language ?? 'unknown', restaurant_guess: done?.restaurant_guess ?? null } : prev);
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
            const nextItems = [...prev.items];
            nextItems[index] = enriched
              ? { ...nextItems[index], hook: enriched.hook, hook_zh: enriched.hook_zh, diet: enriched.diet, cooking_method: enriched.cooking_method, heaviness: enriched.heaviness, ingredients: enriched.ingredients, enriched: true }
              : { ...nextItems[index], enriched: true }; // failed enrichment: stop showing the shimmer, stay honestly empty
            return { ...prev, items: nextItems };
          });
        },
      ).catch(() => {}); // best-effort: a failed enrichment batch must never block scoring or settle

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
                body: JSON.stringify({ item }),
              });
              if (!r.ok) throw new Error('score failed');
              return (await r.json()).item as ScannedItem;
            },
            (scored, index) => {
              setResult(prev => {
                if (!prev) return prev;
                const nextItems = [...prev.items];
                nextItems[index] = scored
                  ? { ...nextItems[index], match: scored.match, reason: scored.reason, caution: scored.caution, fire: scored.fire, raw_score: scored.raw_score, attributes: scored.attributes }
                  : { ...nextItems[index], match: null }; // null = failed, shown gracefully
                return { ...prev, items: nextItems };
              });
            },
          )
        : Promise.resolve();

      await scorePromise;
      setSettled(true);
      await enrichPromise; // usually already resolved by now; awaited so this function doesn't return early
      return;
    } catch (e: any) {
      setError(e.message || 'Something went wrong reading that menu.');
      setScanning(false);
    }
  }

  function reset() {
    setResult(null);
    setPreview(null);
    setError('');
    setSettled(false);
  }

  // ---- capture state ----
  if (!result) {
    return (
      <div>
        <h1 style={{ marginBottom: 4 }}>{t('scan.title')}</h1>
        <p className="card-meta" style={{ marginBottom: 16 }}>
          {t('scan.blurb')}
        </p>

        {preview && (
          <div className={`scan-frame ${scanning ? 'scanning' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Menu" className="card-photo" style={{ aspectRatio: 'auto', maxHeight: 420 }} />
            {scanning && <div className="scan-beam" aria-hidden />}
          </div>
        )}

        {scanning ? (
          <p className="scan-status" role="status">{t(SCAN_STAGE_KEYS[stage])}</p>
        ) : (
          <>
            <PhotoPicker key={preview ?? 'fresh'} onPick={f => onPick(f)} />
            <p className="card-meta" style={{ marginTop: 8 }}>
              {t('scan.tip')}
            </p>
          </>
        )}
        {error && <p style={{ color: 'var(--lacquer)', marginTop: 12 }}>{error}</p>}
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ marginBottom: 4 }}>{t('scan.results')}</h1>
        <button className="btn ghost small" onClick={reset}>{t('scan.another')}</button>
      </div>
      <p className="card-meta" style={{ marginBottom: 4 }}>
        {result.items.length > 0
          ? <>{t('scan.read', { n: result.items.length })}{result.restaurant_guess ? ` \u00b7 ${result.restaurant_guess}` : ''}</>
          : <span role="status">{t('scan.reading')}</span>}
      </p>
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
          <div className="card-body scan-row">
            <div className="scan-rank">{i + 1}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dish-row">
                <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
                {item.price && <span className="dish-price">{item.price}</span>}
              </div>
              <DishDetails item={item} t={t} lang={lang} />
            </div>
          </div>
        </article>
      ))}

      {/* Scoring in progress OR all failed: every dish visible immediately, in
          original order, each ring reflecting its own individual state. */}
      {result.profile_ready && !readyToRank && result.items.map((item, i) => (
        <article className={`card scan-pickable ${picked.has(item.name_original) ? 'picked' : ''}`} key={`scoring-${i}`}
          onClick={() => togglePick(item.name_original)}>
          <div className="card-body scan-row">
            <div className="scan-rank">{i + 1}</div>
            {item.match === undefined && <Spinner size={22} />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dish-row">
                <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
                {item.price && <span className="dish-price">{item.price}</span>}
              </div>
              <DishDetails item={item} t={t} lang={lang} />
            </div>
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
                <div className="card-body scan-row">
                  <div className="scan-rank-col">
                    <div className="scan-rank">{i + 1}</div>
                    {fire && <div className="scan-fire scan-fire-pop" aria-label={t('scan.fire')}>{'\uD83D\uDD25'}</div>}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="dish-row">
                      <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
                      {item.price && <span className="dish-price">{item.price}</span>}
                    </div>
                    <DishDetails item={item} t={t} lang={lang} />
                    {fire && item.reason && <p className="scan-reason fade-in" style={{ fontSize: 13 }}>{item.reason}</p>}
                  </div>
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
      {picked.size > 0 && !confirmingPick && (
        <div className="cart-bar">
          <button className="btn primary" style={{ width: '100%' }} onClick={() => setConfirmingPick(true)}>
            {t('scan.ratethese')} · {t('scan.pickcount', { n: picked.size })}
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
            <button className="btn primary" style={{ flex: 2 }} onClick={confirmPicks} disabled={pickSaving}>
              {pickSaving ? t('log.saving') : `${t('scan.ratethese')} · ${picked.size}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



const DIET_ICON: Record<string, string> = {
  veg: '\u{1F331}', pork: '\u{1F416}', beef: '\u{1F404}', seafood: '\u{1F41F}',
  shellfish: '\u{1F990}', peanut: '\u{1F95C}', spicy: '\u{1F336}\uFE0F',
};

/**
 * Hook line + day-0 utility chips (diet/cooking/heaviness) for one dish card.
 * These arrive from Stage 2 enrichment progressively, in concurrency-capped
 * waves, independent of whether taste scoring is even running — a shimmer
 * placeholder holds the hook's space (so cards don't visibly jump in height as
 * enrichment lands) and everything fades in once `enriched` flips true, rather
 * than popping in abruptly.
 */
function DishDetails({ item, t, lang }: { item: ScannedItem; t: (key: string, params?: Record<string, string | number>) => string; lang: 'zh' | 'en' }) {
  if (!item.enriched) {
    return <div className="hook-shimmer" aria-hidden />;
  }
  const hasChips = item.diet.length > 0 || item.cooking_method || item.heaviness;
  // Bilingual hook, mirroring the same name/name_zh pattern used everywhere else
  // in Dishi: prefer the current UI language, fall back to whichever exists if
  // the other came back empty (never show a blank hook when SOME text exists).
  const hookText = lang === 'zh' ? (item.hook_zh || item.hook) : (item.hook || item.hook_zh);
  return (
    <>
      {/* text-transform:capitalize is a no-op on Chinese characters (no case to
          transform), so this one class safely handles both languages: Title Case
          in English, untouched in Chinese — rather than trusting the model to be
          consistent about capitalization on every single call. */}
      {hookText && <div className="card-meta fade-in dish-hook">{hookText}</div>}
      {hasChips && (
        <div className="fade-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
          {item.diet.map(d => (
            <span key={d} className="chip scan-chip">
              <span className="scan-chip-icon">{DIET_ICON[d] ?? ''}</span>
              <span className="scan-chip-label">{t(`scan.diet.${d}`)}</span>
            </span>
          ))}
          {item.cooking_method && (
            <span className="chip scan-chip">
              <span className="scan-chip-label">{t(`scan.cooking.${item.cooking_method}`)}</span>
            </span>
          )}
          {item.heaviness && (
            <span className="chip scan-chip">
              <span className="scan-chip-label">{t(`scan.heaviness.${item.heaviness}`)}</span>
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** Small in-progress spinner shown while a dish's background scoring is running. */
function Spinner({ size }: { size: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} role="img" aria-label="Thinking\u2026" style={{ flexShrink: 0 }} className="match-ring-spinner">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} opacity={0.35} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--egg-tart)" strokeWidth={4}
        strokeLinecap="round" strokeDasharray={`${c * 0.22} ${c}`} />
    </svg>
  );
}
