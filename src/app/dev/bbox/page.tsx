'use client';
import { useState } from 'react';

/**
 * VALIDATION HARNESS UI (dev tool, not linked from anywhere) — /dev/bbox
 * Pick a real menu photo, see exactly where the production model thinks each dish
 * sits: numbered rectangles over the photo, health stats, and a per-item audit
 * list. The visual judgment ("is box #7 on the right dish?") is the part only a
 * human can grade — this page just makes that grading fast.
 */
type Item = { name: string; name_zh: string | null; price: string | null; box: { x: number; y: number; w: number; h: number } | null; rejectReason?: string };
type Result = { items: Item[]; stats: { total: number; valid: number; rejected: Record<string, number>; heavyOverlapShare: number }; usable: boolean; elapsed_ms: number };

export default function BBoxHarness() {
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState<number | null>(null);

  async function run(file: File) {
    setBusy(true); setError(''); setResult(null);
    setPreview(URL.createObjectURL(file));
    const form = new FormData();
    form.append('photo', file);
    try {
      const res = await fetch('/api/dev/bbox-test', { method: 'POST', body: form });
      const json = await res.json();
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
        Criteria: {'\u2265'}80% valid boxes on the right dishes {'\u00B7'} heavy overlap {'<'}15% {'\u00B7'} rejects {'<'}5% {'\u00B7'} elapsed comparable to a normal scan.
      </p>
      <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && run(e.target.files[0])} />
      {busy && <p>Running against the production model{'\u2026'}</p>}
      {error && <p style={{ color: 'var(--lacquer)' }}>{error}</p>}

      {result && (
        <div className="card" style={{ margin: '10px 0', padding: 10 }}>
          <strong>{result.usable ? '\u2705 usable' : '\u274C would fall back to list'}</strong>
          {' \u00B7 '}{result.stats.valid}/{result.stats.total} valid
          {' \u00B7 '}overlap {(result.stats.heavyOverlapShare * 100).toFixed(0)}%
          {' \u00B7 '}{(result.elapsed_ms / 1000).toFixed(1)}s
          {Object.keys(result.stats.rejected).length > 0 && (
            <span>{' \u00B7 '}rejected: {Object.entries(result.stats.rejected).map(([k, v]) => `${k}\u00D7${v}`).join(', ')}</span>
          )}
        </div>
      )}

      {preview && (
        <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
          <img src={preview} alt="menu" style={{ maxWidth: '100%', display: 'block' }} />
          {result?.items.map((it, i) => it.box && (
            <div key={i}
              onClick={() => setHighlight(highlight === i ? null : i)}
              style={{
                position: 'absolute',
                left: `${it.box.x * 100}%`, top: `${it.box.y * 100}%`,
                width: `${it.box.w * 100}%`, height: `${it.box.h * 100}%`,
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
          ))}
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
