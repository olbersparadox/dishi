'use client';
import { useEffect, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import PhotoPicker from '@/components/PhotoPicker';
import { mapWithConcurrency } from '@/lib/concurrency';
import { useLang } from '@/lib/i18n';

type ScannedItem = {
  name: string; name_zh?: string | null; name_original: string; section: string | null; description: string | null;
  price: string | null; cuisine: string; hook: string; confidence: number;
  // undefined = not yet requested/still scoring; null = this dish's scoring call
  // failed (degrade gracefully, don't block the rest); number = a real match.
  match?: number | null; reason?: string | null; caution?: string | null;
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
  const ranked = readyToRank
    ? [...result.items].sort((a, b) => (b.match ?? -1) - (a.match ?? -1))
    : result.items;
  const [top, ...rest] = ranked;

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
        <article className="card" key={`plain-${i}`}>
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
        <article className="card" key={`scoring-${i}`}>
          <div className="card-body scan-row">
            <div className="scan-rank">{i + 1}</div>
            <MatchRing value={item.match} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dish-row">
                <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
                {item.price && <span className="dish-price">{item.price}</span>}
              </div>
              <div className="card-meta">{item.hook}</div>
              {item.match === null && <p className="scan-caution" style={{ fontSize: 12.5 }}>{t('scan.itemfailed')}</p>}
            </div>
          </div>
        </article>
      ))}

      {/* Settled: ranked order, hero promoted, reasons shown. Fades/scales in once
          every dish has a real outcome — the "satisfying settle" moment. */}
      {readyToRank && (
        <div className="scan-settle">
          <article className="card scan-hero">
            <div className="card-body">
              <span className="reason collab">{t('scan.order')}</span>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 6 }}>
                <MatchRing value={top.match} size={64} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="dish-row">
                    <div className="card-title"><DishName name={top.name} name_zh={top.name_zh} name_original={top.name_original} /></div>
                    {top.price && <span className="dish-price">{top.price}</span>}
                  </div>
                  <div className="card-meta">{top.hook}</div>
                </div>
              </div>
              {top.reason && <p className="scan-reason">{top.reason}</p>}
              {top.caution && <p className="scan-caution">{top.caution}</p>}
            </div>
          </article>

          {rest.map((item, i) => (
            <article className="card" key={`${item.name}-${i}`}>
              <div className="card-body scan-row">
                <div className="scan-rank">{i + 2}</div>
                <MatchRing value={item.match} size={44} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="dish-row">
                    <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
                    {item.price && <span className="dish-price">{item.price}</span>}
                  </div>
                  <div className="card-meta">{item.hook}</div>
                  {item.match === null ? (
                    <p className="scan-caution" style={{ fontSize: 12.5 }}>{t('scan.itemfailed')}</p>
                  ) : <>
                    {item.reason && <p className="scan-reason" style={{ fontSize: 13 }}>{item.reason}</p>}
                    {item.caution && <p className="scan-caution" style={{ fontSize: 13 }}>{item.caution}</p>}
                  </>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="card-meta" style={{ margin: '4px 0 12px' }}>
        {t('scan.logged')}
      </p>
    </div>
  );
}

/**
 * Circular match gauge. Three states: pending (undefined — dashed, pulsing, no
 * number), failed (null — flat grey, a quiet dash), scored (a number — real ring).
 */
function MatchRing({ value, size }: { value: number | null | undefined; size: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;

  if (value === undefined) {
    return (
      <svg width={size} height={size} role="img" aria-label="Matching…" style={{ flexShrink: 0 }} className="match-ring-pending">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={5} strokeDasharray={`${c * 0.28} ${c * 0.14}`} />
      </svg>
    );
  }
  if (value === null) {
    return (
      <svg width={size} height={size} role="img" aria-label="Couldn't match" style={{ flexShrink: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={5} />
        <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size * 0.4} fill="var(--ink-soft)">&ndash;</text>
      </svg>
    );
  }

  const frac = Math.min(100, Math.max(0, value)) / 100;
  const color = value >= 70 ? 'var(--jade)' : value >= 45 ? 'var(--egg-tart)' : 'var(--ink-soft)';
  return (
    <svg width={size} height={size} role="img" aria-label={`${value}% match`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={5} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeLinecap="round" strokeDasharray={`${c * frac} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle"
        fontSize={size * 0.28} fontWeight={800} fill="var(--ink)">
        {value}
      </text>
    </svg>
  );
}
