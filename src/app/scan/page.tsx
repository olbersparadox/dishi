'use client';
import { useEffect, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';

type ScannedItem = {
  name: string; name_zh?: string | null; name_original: string; section: string | null; description: string | null;
  price: string | null; cuisine: string; hook: string; confidence: number;
  match: number; reason: string | null; caution: string | null;
};
type ScanResponse = {
  profile_ready: boolean; rating_count: number; menu_language: string;
  restaurant_guess: string | null; mock: boolean; items: ScannedItem[];
};

const SCAN_STAGE_KEYS = ['scan.stage.0', 'scan.stage.1', 'scan.stage.2', 'scan.stage.3', 'scan.stage.4'];

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
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

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
    setPreview(URL.createObjectURL(file));
    setScanning(true);
    try {
      const form = new FormData();
      form.append('photo', await normalizePhoto(file));
      const res = await fetch('/api/menu-scan', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Scan failed.');
      if (!json.items?.length) throw new Error('No dishes could be read from that photo.');
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'Something went wrong reading that menu.');
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setResult(null);
    setPreview(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
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
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => onPick(e.target.files?.[0] ?? null)}
              className="field"
            />
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
  const [top, ...rest] = result.items;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 style={{ marginBottom: 4 }}>{t('scan.results')}</h1>
        <button className="btn ghost small" onClick={reset}>{t('scan.another')}</button>
      </div>
      <p className="card-meta" style={{ marginBottom: 4 }}>
        {t('scan.read', { n: result.items.length })}{result.restaurant_guess ? ` · ${result.restaurant_guess}` : ''}
      </p>
      {result.mock && (
        <p className="scan-banner">{t('scan.mock')}</p>
      )}
      {!result.profile_ready && (
        <p className="scan-banner">
          {t('scan.noprofile')}
        </p>
      )}

      {/* Hero pick */}
      <article className="card scan-hero">
        <div className="card-body">
          <span className="reason collab">{t('scan.order')}</span>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 6 }}>
            <MatchRing value={top.match} size={64} />
            <div style={{ minWidth: 0 }}>
              <div className="card-title"><DishName name={top.name} name_zh={top.name_zh} name_original={top.name_original} /></div>
              <div className="card-meta">
                {top.price ?? ''}{top.price && top.hook ? ' · ' : ''}{top.hook}
              </div>
            </div>
          </div>
          {top.reason && <p className="scan-reason">{top.reason}</p>}
          {top.caution && <p className="scan-caution">{top.caution}</p>}
        </div>
      </article>

      {/* The rest, ranked */}
      {rest.map((item, i) => (
        <article className="card" key={`${item.name}-${i}`}>
          <div className="card-body scan-row">
            <div className="scan-rank">{i + 2}</div>
            <MatchRing value={item.match} size={44} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
              <div className="card-meta">
                {item.price ?? ''}{item.price ? ' · ' : ''}{item.hook}
              </div>
              {item.reason && <p className="scan-reason" style={{ fontSize: 13 }}>{item.reason}</p>}
              {item.caution && <p className="scan-caution" style={{ fontSize: 13 }}>{item.caution}</p>}
            </div>
          </div>
        </article>
      ))}

      <p className="card-meta" style={{ margin: '4px 0 12px' }}>
        {t('scan.logged')}
      </p>
    </div>
  );
}

/** Circular match gauge, jade for strong matches, fading toward grey for weak ones. */
function MatchRing({ value, size }: { value: number; size: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
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
