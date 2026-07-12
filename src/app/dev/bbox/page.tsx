'use client';
import React, { useState, useRef } from 'react';
import { normalizePhoto } from '@/lib/image';
import { useRowSnap } from '@/lib/useRowSnap';

/**
 * VALIDATION HARNESS UI (dev tool, not linked from anywhere) — /dev/bbox
 * Pick a real menu photo, see exactly where the production model thinks each dish
 * sits: numbered rectangles over the photo, health stats, and a per-item audit
 * list. The visual judgment ("is box #7 on the right dish?") is the part only a
 * human can grade — this page just makes that grading fast.
 */
type Item = { name: string; name_zh: string | null; price: string | null; box: { x: number; y: number; w: number; h: number } | null; rejectReason?: string };
type Result = { items: Item[]; stats: { total: number; valid: number; rejected: Record<string, number>; heavyOverlapShare: number; crowdedPairShare: number; gapTrendMax: number }; usable: boolean; elapsed_ms: number };

export default function BBoxHarness() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rawSample, setRawSample] = useState('');
  const [highlight, setHighlight] = useState<number | null>(null);
  // Row-snapped boxes, keyed by item index — computed client-side after the
  // photo loads (needs real pixel data, see rowSnap.ts). null box = unsnapped
  // (either snapping hasn't run yet, or it found no confident correction).
  const [snapEnabled, setSnapEnabled] = useState(true);
  const imgRef = useRef<HTMLImageElement>(null);
  // Delegates to the SAME hook the real overlay uses — a fix proven here is
  // automatically live in production, and vice versa; the two can't drift apart.
  const snapped = useRowSnap(result?.items.map(it => it.box) ?? [], imgRef.current, !!result);

    async function run(file: File) {
    setBusy(true); setError(''); setResult(null); setRawSample('');
    // Same normalization as the real scan flow: converts HEIC/AVIF/WebP to JPEG
    // and caps size. Validation hit this live — an .avif menu photo went straight
    // through to the model, which can't read AVIF, and the whole run failed with
    // an unparseable response. The harness must exercise the SAME input pipeline
    // production uses, or it validates a different system than the one we ship.
    const normalized = await normalizePhoto(file, 1600);
    setPreview(URL.createObjectURL(normalized));
    const form = new FormData();
    form.append('photo', normalized);
    try {
      const res = await fetch('/api/dev/bbox-test', { method: 'POST', body: form });
      const json = await res.json();
      setRawSample(json.raw_sample ?? '');
      if (!res.ok) throw new Error(json.error || 'failed');
      setResult(json);
    } catch (e: any) {
      setError(e.message || 'failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 12, maxWidth: 720, margin: '0 auto' }}>
      <h2>BBox grounding harness</h2>
      <p className="card-meta">
        Criteria: {'\u2265'}80% valid boxes on the right dishes {'\u00B7'} heavy overlap {'<'}15% {'\u00B7'} crowd {'<'}25% {'\u00B7'} drift {'<'}50% {'\u00B7'} rejects {'<'}5% {'\u00B7'} elapsed comparable to a normal scan.
      </p>
      <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && run(e.target.files[0])} />
      {busy && <p>Running against the production model{'\u2026'}</p>}
      {error && <p style={{ color: 'var(--lacquer)' }}>{error}</p>}
      {rawSample && <pre style={{ fontSize: 10.5, whiteSpace: 'pre-wrap', background: 'var(--paper, #f5f4ef)', padding: 8, borderRadius: 6 }}>{rawSample}</pre>}

      {result && (
        <div className="card" style={{ margin: '10px 0', padding: 10 }}>
          <strong>{result.usable ? '\u2705 usable' : '\u274C would fall back to list'}</strong>
          {' \u00B7 '}{result.stats.valid}/{result.stats.total} valid
          {' \u00B7 '}overlap {(result.stats.heavyOverlapShare * 100).toFixed(0)}%
          {' \u00B7 '}crowd {(result.stats.crowdedPairShare * 100).toFixed(0)}%
          {' \u00B7 '}drift {(result.stats.gapTrendMax * 100).toFixed(0)}%
          {' \u00B7 '}{(result.elapsed_ms / 1000).toFixed(1)}s
          {Object.keys(result.stats.rejected).length > 0 && (
            <span>{' \u00B7 '}rejected: {Object.entries(result.stats.rejected).map(([k, v]) => `${k}\u00D7${v}`).join(', ')}</span>
          )}
        </div>
      )}

      {result && Object.keys(snapped).length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, margin: '4px 0' }}>
          <input type="checkbox" checked={snapEnabled} onChange={e => setSnapEnabled(e.target.checked)} />
          Row-snap correction (green dashed = model's raw guess, when it differs)
        </label>
      )}
      {preview && (
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <img ref={imgRef} src={preview} alt="menu" style={{ maxWidth: '100%', display: 'block' }} />
          {result?.items.map((it, i) => {
            if (!it.box) return null;
            const snap = snapped[i];
            const shown = snapEnabled && snap ? snap : it.box;
            const moved = snap && (Math.abs(snap.y - it.box.y) > 0.002);
            return (
            <React.Fragment key={i}>
              {/* Ghost of the model's ORIGINAL (unsnapped) box — a sibling in the
                  SAME coordinate space as the image, not nested inside the shown
                  box, so its percentages stay meaningful when the box moved. Makes
                  a snap correction visibly auditable instead of invisible. */}
              {snapEnabled && moved && it.box && (
                <div style={{
                  position: 'absolute',
                  left: `${it.box.x * 100}%`, top: `${it.box.y * 100}%`,
                  width: `${it.box.w * 100}%`, height: `${it.box.h * 100}%`,
                  border: '1.5px dashed var(--jade)', opacity: 0.45, pointerEvents: 'none', boxSizing: 'border-box',
                }} />
              )}
            <div
              onClick={() => setHighlight(highlight === i ? null : i)}
              style={{
                position: 'absolute',
                left: `${shown.x * 100}%`, top: `${shown.y * 100}%`,
                width: `${shown.w * 100}%`, height: `${shown.h * 100}%`,
                border: `2px solid ${highlight === i ? 'var(--lacquer)' : 'var(--jade)'}`,
                background: highlight === i ? 'rgba(200,60,40,0.15)' : 'transparent',
                cursor: 'pointer', boxSizing: 'border-box',
              }}>
              {/* Chip sits INSIDE its own box: rendered above, it visually lands on
                  the PREVIOUS menu row at phone scale and reads as labeling the
                  wrong dish — exactly the 19-vs-20 confusion from validation. */}
              <span style={{ position: 'absolute', top: 0, left: 0, fontSize: 11, fontWeight: 700, background: 'var(--jade)', color: '#fff', padding: '0 4px', borderRadius: '0 0 3px 0' }}>{i + 1}</span>
              {highlight === i && (
                <span style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 2, fontSize: 12, fontWeight: 700, background: 'var(--lacquer)', color: '#fff', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap', maxWidth: '90vw', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 2 }}>
                  {result!.items[i].name_zh ?? result!.items[i].name}
                </span>
              )}
            </div>
            </React.Fragment>
            );
          })}
        </div>
      )}

      {result && (
        <ol style={{ fontSize: 13, paddingLeft: 22 }}>
          {result.items.map((it, i) => (
            <li key={i}
              onClick={() => setHighlight(highlight === i ? null : i)}
              style={{ cursor: 'pointer', fontWeight: highlight === i ? 700 : 400, color: it.box ? undefined : 'var(--lacquer)' }}>
              {it.name}{it.name_zh ? ` \u00B7 ${it.name_zh}` : ''}{it.price ? ` \u00B7 ${it.price}` : ''}
              {!it.box && ` \u2014 no box (${it.rejectReason})`}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
