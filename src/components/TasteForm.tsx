'use client';
// The taste form — replaces the animal Buddy as the primary visual identity
// (Session A spec, buddy migration option (a)). Two render modes sharing one
// source of truth (blobForm.ts):
//   - live: a slow-breathing Canvas2D render for the Taste tab
//   - snapshot: a static SVG path for version cards / export headers / share
// Both take the SAME raw inputs (vector, evidence, ratingCount, seed) so they
// can never show a different being than the numbers say.
import { useEffect, useRef, useState } from 'react';
import { sampleForm, formToSvgPath, fogExtent, type FormInputs } from '@/lib/blobForm';
import TasteRadar from './TasteRadar';

const PAPER_INK = ['#3a3733', '#211d18', '#2e2a24'] as const;
const PAPER_WASH = '217,210,194';
const PAPER_HIGHLIGHT = '250,247,241';

export function TasteFormSnapshot({
  inputs, size = 200, glyph,
}: { inputs: FormInputs; size?: number; glyph?: string }) {
  const path = formToSvgPath(sampleForm(inputs, 96), size);
  const fog = fogExtent(inputs.evidence);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Taste form">
      <defs>
        <radialGradient id={`wash-${inputs.seed}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor={`rgba(${PAPER_WASH},${0.45 * fog})`} />
          <stop offset="1" stopColor={`rgba(${PAPER_WASH},0)`} />
        </radialGradient>
        <linearGradient id={`ink-${inputs.seed}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={PAPER_INK[0]} />
          <stop offset="0.6" stopColor={PAPER_INK[1]} />
          <stop offset="1" stopColor={PAPER_INK[2]} />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={size * 0.48} fill={`url(#wash-${inputs.seed})`} />
      <path d={path} fill={`url(#ink-${inputs.seed})`} />
      {glyph && (
        <text x={size / 2} y={size / 2 + size * 0.045} textAnchor="middle"
          fill="#faf7f1" fontFamily="'Songti TC','Noto Serif TC',serif" fontSize={size * 0.09} letterSpacing={size * 0.015}>
          {glyph}
        </text>
      )}
    </svg>
  );
}

/**
 * Live breathing render. Draws the SAME deterministic base form as the
 * snapshot, with time-varying noise layered on top purely as motion — the
 * noise never touches the underlying sample, so pausing at any frame and
 * comparing to TasteFormSnapshot with identical inputs always matches.
 */
export function TasteFormLive({
  inputs, size = 280, glyph,
}: { inputs: FormInputs; size?: number; glyph?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const { angles, radii } = sampleForm(inputs, 96);
    const fog = fogExtent(inputs.evidence);
    const c = size / 2;
    const scale = size * 0.36;

    const io = new IntersectionObserver(([e]) => { visibleRef.current = e.isIntersecting; },
      { threshold: 0.05 });
    io.observe(canvas);

    function frame(t: number) {
      if (!visibleRef.current) { rafRef.current = requestAnimationFrame(frame); return; }
      ctx!.clearRect(0, 0, size, size);

      const wash = ctx!.createRadialGradient(c, c, size * 0.2, c, c, size * 0.48);
      wash.addColorStop(0, `rgba(${PAPER_WASH},${0.45 * fog})`);
      wash.addColorStop(1, `rgba(${PAPER_WASH},0)`);
      ctx!.fillStyle = wash;
      ctx!.beginPath(); ctx!.arc(c, c, size * 0.48, 0, Math.PI * 2); ctx!.fill();

      const px: number[] = [], py: number[] = [];
      for (let i = 0; i < angles.length; i++) {
        const breathe = 1
          + 0.09 * Math.sin(t * 0.0009 + i * 0.33)
          + 0.06 * Math.sin(t * 0.0016 + i * 0.09)
          + 0.04 * Math.sin(t * 0.0005 - i * 0.21);
        const r = radii[i] * breathe * scale;
        px.push(c + Math.cos(angles[i] - Math.PI / 2) * r);
        py.push(c + Math.sin(angles[i] - Math.PI / 2) * r);
      }
      const n = px.length;
      ctx!.beginPath();
      ctx!.moveTo(px[0], py[0]);
      for (let i = 0; i < n; i++) {
        const a = (i - 1 + n) % n, b = i, cc = (i + 1) % n, d = (i + 2) % n;
        ctx!.bezierCurveTo(
          px[b] + (px[cc] - px[a]) / 6, py[b] + (py[cc] - py[a]) / 6,
          px[cc] - (px[d] - px[b]) / 6, py[cc] - (py[d] - py[b]) / 6,
          px[cc], py[cc],
        );
      }
      ctx!.closePath();
      const ink = ctx!.createLinearGradient(c - size * 0.3, c - size * 0.3, c + size * 0.3, c + size * 0.3);
      ink.addColorStop(0, PAPER_INK[0]); ink.addColorStop(0.6, PAPER_INK[1]); ink.addColorStop(1, PAPER_INK[2]);
      ctx!.fillStyle = ink;
      ctx!.fill();

      ctx!.fillStyle = `rgba(${PAPER_HIGHLIGHT},0.16)`;
      ctx!.beginPath();
      ctx!.ellipse(c - size * 0.16, c - size * 0.25, size * 0.19, size * 0.08, -0.35 + 0.05 * Math.sin(t * 0.0006), 0, Math.PI * 2);
      ctx!.fill();

      if (glyph) {
        ctx!.fillStyle = '#faf7f1';
        ctx!.font = `500 ${Math.round(size * 0.09)}px "Songti TC","Noto Serif TC",serif`;
        ctx!.textAlign = 'center';
        ctx!.fillText(glyph, c, c + size * 0.036);
      }

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.seed, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size }} aria-label="Your taste form, live" role="img" />;
}

/**
 * Tap to toggle between the breathing blob and the full 18-dim taste radar.
 * The blob is the primary identity; the radar is the same data in analytic
 * form (removed as a permanent second card because it duplicated the blob's
 * job — here it's an on-demand reveal instead). One tap swaps blob → radar
 * (rendered larger, so the dimension labels are readable); tapping again swaps
 * back. No new data, just a second way to read the same profile.
 */
export function TasteFormReveal({
  inputs, size = 190, glyph, vector, labelFor, onToggle,
}: {
  inputs: FormInputs; size?: number; glyph?: string;
  vector: Record<string, number>; labelFor: (dim: string) => string;
  /** Fires with the new state right when the blob/radar toggle happens — lets a
   * parent (the spacing below, which lives outside this component) react to
   * which one is currently showing. */
  onToggle?: (showRadar: boolean) => void;
}) {
  const [showRadar, setShowRadarState] = useState(false);
  const setShowRadar = (next: boolean | ((v: boolean) => boolean)) => {
    setShowRadarState(prev => {
      const v = typeof next === 'function' ? next(prev) : next;
      onToggle?.(v);
      return v;
    });
  };

  // Radar renders larger than the blob so the 18 labels have room to breathe;
  // the wrapper grows to fit it and stays centered, so the card expands
  // smoothly rather than the radar overflowing its box. Kept modest (was 1.55)
  // so the reveal reads as a swap, not the card ballooning.
  const radarSize = Math.round(size * 1.3);
  const boxSize = showRadar ? radarSize : size;

  return (
    <div
      style={{
        position: 'relative', width: boxSize, height: boxSize, margin: '0 auto',
        cursor: 'pointer', transition: 'width 240ms ease, height 240ms ease',
      }}
      onClick={() => setShowRadar(v => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowRadar(v => !v); } }}
      aria-pressed={showRadar}
      aria-label={showRadar ? 'Showing taste breakdown — tap to return to your taste form' : 'Your taste form — tap for the full breakdown'}
    >
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: showRadar ? 0 : 1, transform: showRadar ? 'scale(0.9)' : 'scale(1)',
        transition: 'opacity 220ms ease, transform 220ms ease',
        pointerEvents: 'none',
      }}>
        <TasteFormLive inputs={inputs} size={size} glyph={glyph} />
      </div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: showRadar ? 1 : 0, transform: `translateY(-20px) scale(${showRadar ? 1 : 0.9})`,
        transition: 'opacity 220ms ease, transform 220ms ease',
        pointerEvents: 'none',
      }}>
        <TasteRadar vector={vector} size={radarSize} labelFor={labelFor} />
      </div>
    </div>
  );
}
