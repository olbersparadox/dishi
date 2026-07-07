'use client';
import { useEffect, useRef, useState } from 'react';
import AuthGate from '@/components/AuthGate';
import { normalizePhoto } from '@/lib/image';
<<<<<<< HEAD
import DishName from '@/components/DishName';
import { useLang } from '@/lib/i18n';

type ScannedItem = {
  name: string; name_zh?: string | null; name_original: string; section: string | null; description: string | null;
=======

type ScannedItem = {
  name: string; name_original: string; section: string | null; description: string | null;
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
  price: string | null; cuisine: string; hook: string; confidence: number;
  match: number; reason: string | null; caution: string | null;
};
type ScanResponse = {
  profile_ready: boolean; rating_count: number; menu_language: string;
  restaurant_guess: string | null; mock: boolean; items: ScannedItem[];
};

<<<<<<< HEAD
const SCAN_STAGE_KEYS = ['scan.stage.0', 'scan.stage.1', 'scan.stage.2', 'scan.stage.3', 'scan.stage.4'];
=======
const SCAN_STAGES = [
  'Reading the menu…',
  'Working through the sections…',
  'Estimating flavors from dish knowledge…',
  'Matching against your taste profile…',
  'Ranking your best bets…',
];
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c

export default function ScanPage() {
  return (
    <AuthGate>
      <Scanner />
    </AuthGate>
  );
}

function Scanner() {
<<<<<<< HEAD
  const { t } = useLang();
=======
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
    const timer = setInterval(() => setStage(s => Math.min(s + 1, SCAN_STAGE_KEYS.length - 1)), 2200);
    return () => clearInterval(timer);
=======
    const t = setInterval(() => setStage(s => Math.min(s + 1, SCAN_STAGES.length - 1)), 2200);
    return () => clearInterval(t);
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
        <h1 style={{ marginBottom: 4 }}>{t('scan.title')}</h1>
        <p className="card-meta" style={{ marginBottom: 16 }}>
          {t('scan.blurb')}
=======
        <h1 style={{ marginBottom: 4 }}>Scan a menu</h1>
        <p className="card-meta" style={{ marginBottom: 16 }}>
          Photograph the whole menu — Dishi reads every dish and ranks it against your taste.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        </p>

        {preview && (
          <div className={`scan-frame ${scanning ? 'scanning' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Menu" className="card-photo" style={{ aspectRatio: 'auto', maxHeight: 420 }} />
            {scanning && <div className="scan-beam" aria-hidden />}
          </div>
        )}

        {scanning ? (
<<<<<<< HEAD
          <p className="scan-status" role="status">{t(SCAN_STAGE_KEYS[stage])}</p>
=======
          <p className="scan-status" role="status">{SCAN_STAGES[stage]}</p>
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
              {t('scan.tip')}
=======
              Works best flat-on with the whole page in frame. Chinese, English, or both.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
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
=======
        <h1 style={{ marginBottom: 4 }}>Your best bets</h1>
        <button className="btn ghost small" onClick={reset}>Scan another</button>
      </div>
      <p className="card-meta" style={{ marginBottom: 4 }}>
        {result.items.length} dishes read{result.restaurant_guess ? ` · ${result.restaurant_guess}` : ''}
      </p>
      {result.mock && (
        <p className="scan-banner">Demo menu — add an ANTHROPIC_API_KEY to scan real menus.</p>
      )}
      {!result.profile_ready && (
        <p className="scan-banner">
          No taste profile yet, so this is unpersonalized. Rate a few dishes and scan again — the ranking becomes yours.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
        </p>
      )}

      {/* Hero pick */}
      <article className="card scan-hero">
        <div className="card-body">
<<<<<<< HEAD
          <span className="reason collab">{t('scan.order')}</span>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 6 }}>
            <MatchRing value={top.match} size={64} />
            <div style={{ minWidth: 0 }}>
              <div className="card-title"><DishName name={top.name} name_zh={top.name_zh} name_original={top.name_original} /></div>
=======
          <span className="reason collab">Order this</span>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 6 }}>
            <MatchRing value={top.match} size={64} />
            <div style={{ minWidth: 0 }}>
              <div className="card-title">{top.name}</div>
              {top.name_original !== top.name && <div className="card-meta">{top.name_original}</div>}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
<<<<<<< HEAD
              <div className="card-title" style={{ fontSize: 15.5 }}><DishName name={item.name} name_zh={item.name_zh} name_original={item.name_original} /></div>
              <div className="card-meta">
=======
              <div className="card-title" style={{ fontSize: 15.5 }}>{item.name}</div>
              <div className="card-meta">
                {item.name_original !== item.name ? `${item.name_original} · ` : ''}
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
                {item.price ?? ''}{item.price ? ' · ' : ''}{item.hook}
              </div>
              {item.reason && <p className="scan-reason" style={{ fontSize: 13 }}>{item.reason}</p>}
              {item.caution && <p className="scan-caution" style={{ fontSize: 13 }}>{item.caution}</p>}
            </div>
          </div>
        </article>
      ))}

      <p className="card-meta" style={{ margin: '4px 0 12px' }}>
<<<<<<< HEAD
        {t('scan.logged')}
=======
        Ordered something? Log it after — every rating sharpens the next scan.
>>>>>>> a5ab899ab9ea165d98b3124f2a73de9782080d1c
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
