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
  price: string | null; cuisine: string; hook: string; confidence: number;
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
};
type ScanResponse = {
  phase?: 'done' | 'needs_scoring'; profile_ready: boolean; rating_count: number; needed?: number; menu_language: string;
  restaurant_guess: string | null; mock: boolean; items: ScannedItem[];
};

const SCAN_STAGE_KEYS = ['scan.stage.0', 'scan.stage.1', 'scan.stage.2', 'scan.stage.3', 'scan.stage.4'];
// Concurrency cap for parallel per-dish scoring: fast enough that total wait is
// close to "one dish's worth of latency," conservative enough to stay well clear
// of provider rate limits on a typical 15-20 item menu.
const SCORE_CONCURRENCY = 6;

export default function ScanPage() {
  return (
    <AuthGate>
      <Scanner />
    </AuthGate>
  );
}

function Scanner() {
  const { t } = useLang();
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
      const json: ScanResponse = await res.json();
      if (!res.ok) throw new Error((json as any).error || 'Scan failed.');
      if (!json.items?.length) throw new Error('No dishes could be read from that photo.');
      setResult(json);
      setScanning(false);
      if (json.phase !== 'needs_scoring') setSettled(true); // already complete (mock / under threshold)

      // Phase 2: one small call PER DISH, several in parallel (capped). Each ring
      // lights up the moment ITS call finishes — no waiting for the slowest dish
      // to unblock everyone else's result. Original menu order is preserved while
      // any dish is still pending; once every dish has an outcome (scored or
      // failed), the view "settles" into ranked order with the hero promoted.
      if (json.phase === 'needs_scoring') {
        await mapWithConcurrency(
          json.items,
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
              const items = [...prev.items];
              items[index] = scored ?? { ...items[index], match: null }; // null = failed, shown gracefully
              return { ...prev, items };
            });
          },
        );
        setSettled(true);
      }
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
        {t('scan.read', { n: result.items.length })}{result.restaurant_guess ? ` \u00b7 ${result.restaurant_guess}` : ''}
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

      {/* Under-threshold: an honest plain list — no rings, no reasons, no hero. */}
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
              <div className="card-meta">{item.hook}</div>
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
              <div className="card-meta">{item.hook}</div>
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
                  <div className="scan-rank">{i + 1}</div>
                  {fire && <div className="scan-fire" aria-label={t('scan.fire')}>{'\uD83D\uDD25'}</div>}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="dish-row">
                      <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
                      {item.price && <span className="dish-price">{item.price}</span>}
                    </div>
                    <div className="card-meta">{item.hook}</div>
                    {fire && item.reason && <p className="scan-reason" style={{ fontSize: 13 }}>{item.reason}</p>}
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
