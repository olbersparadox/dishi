'use client';
import { DIMS } from '@/lib/taste';
import type { EvidenceMap } from '@/lib/taste';
import { dimAngle, dimState } from '@/lib/blobForm';
import { buildMing } from '@/lib/logogram';

/**
 * The 銘 · the full breakdown, one figure in two registers.
 *
 * Outside: the logogram (lib/logogram.ts) — a rough ink ring where each dim's
 * seat carries strokes for what it has actually LEARNED. Outward = love,
 * inward = dislike, stroke count = evidence, silence = fog.
 * Inside: the radar polygon — the same 18 dims plotted by magnitude, with the
 * labels, because reading WHAT you like is the one job neither the blob nor the
 * creature can do.
 *
 * These are not two drawings stacked. They sit on one compass — `dimAngle(i)`,
 * the same helper the blob and the creature use, not a local copy — and on one
 * radius: the polygon maps -1..1 onto 0..ringR, so a maximally-loved dim puts
 * its vertex exactly ON the ring at the point its stroke leaves from. The two
 * encodings meet, by construction rather than by tuning.
 *
 * Why merge at all rather than keep a radar: a radar has no axis for evidence.
 * Mapping -1..1 to a radius puts "never tasted" and "genuinely neutral" on the
 * same centre point, so the chart quietly asserts a reading it doesn't have.
 * The 銘 carries evidence in the ink itself, so this figure can say "I don't
 * know yet" — the honesty contract the rest of the taste engine already keeps.
 * That honesty is load-bearing here, not decorative: a fog dim gets no stroke,
 * no vertex dot and a faint label, and cannot be called a top taste.
 *
 * Hand-drawn SVG, not a charting library — matches how every other visual in
 * this app is built and keeps the bundle light.
 */
export default function TasteRadar({ vector, evidence, seed, size = 280, labelFor }: {
  vector: Record<string, number>;
  evidence: EvidenceMap;
  /** Profile-version seed: the same palate always writes the same hand. */
  seed: string;
  size?: number;
  labelFor?: (dim: string) => string;
}) {
  const cx = size / 2, cy = size / 2;
  // The shared rim. Smaller than the old radar-only chart because the 銘's
  // strokes now live outside it and the labels have to clear them both.
  const ringR = size * 0.225;
  const ming = buildMing(vector, evidence, seed, size, ringR);

  const pointFor = (i: number, value: number) => {
    // -1..1 -> 0..1 radius fraction: a strong dislike sits at the centre, a
    // strong like on the rim, and neutral halfway. NOTE this means an UNRATED
    // dim (value 0) plots at mid-radius, indistinguishable from a measured
    // neutral — the polygon alone cannot help that, and it is precisely the
    // fabrication the 銘 layer exists to expose. (The comment this replaces
    // claimed unrated dims land "at the exact center"; they do not.)
    const frac = (value + 1) / 2;
    const angle = dimAngle(i);
    return [cx + Math.cos(angle) * ringR * frac, cy + Math.sin(angle) * ringR * frac] as const;
  };

  const dataPoints = DIMS.map((dim, i) => pointFor(i, vector[dim] ?? 0));
  const dataPath = dataPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Strongest preferences: the top (up to) 3 clearly-positive dimensions —
  // and only ones the engine has actually LEARNED. A high number off one
  // tasting is a guess, and this figure does not shout guesses.
  const strongSet = new Set(
    DIMS.map((dim, i) => ({ i, v: vector[dim] ?? 0, known: dimState(evidence[dim]) === 'knows' }))
      .filter(e => e.v > 0.12 && e.known)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map(e => e.i),
  );

  const baseFont = Math.max(11, size * 0.043);
  const strongFont = size * 0.06;

  // Labels ride outside the ink the profile actually wrote, so a loud palate
  // never collides with its own labels and a quiet one isn't ringed by dead
  // space. Capped so the longest label still can't leave the box.
  const labelR = Math.min(ming.extent + size * 0.05, size * 0.4);

  // Faint interior guides at 25/50/75%. No 100% ring — the 銘 IS the rim.
  const rings = [0.25, 0.5, 0.75];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label="Your 銘: the ink ring records how much the engine has learned about each taste dimension, the inner chart how strongly you like it">
      {rings.map(f => (
        <polygon
          key={f}
          points={DIMS.map((_, i) => {
            const a = dimAngle(i);
            return `${(cx + Math.cos(a) * ringR * f).toFixed(1)},${(cy + Math.sin(a) * ringR * f).toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      {DIMS.map((_, i) => {
        const a = dimAngle(i);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(a) * ringR} y2={cy + Math.sin(a) * ringR}
            stroke="var(--line)" strokeWidth={1}
          />
        );
      })}

      {/* 銘, behind the chart: wash blotches, then the ring's three brush passes. */}
      {ming.blotches.map((b, i) => (
        <ellipse key={`b${i}`} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry}
          transform={`rotate(${b.rot.toFixed(1)} ${b.cx.toFixed(1)} ${b.cy.toFixed(1)})`}
          fill="var(--ink)" fillOpacity={0.08} />
      ))}
      {ming.ring.map((r, i) => (
        <path key={`r${i}`} d={r.d} fill="none" stroke="var(--ink)" strokeOpacity={r.opacity}
          strokeWidth={r.width} strokeLinejoin="round" />
      ))}

      <polygon points={dataPath} fill="var(--ink)" fillOpacity={0.12} stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => {
        // No dot on a dim the engine has never been taught. The polygon still
        // passes through the centre there (it has to close), but nothing marks
        // it as a reading — that vertex is an absence, not a measurement.
        if (dimState(evidence[DIMS[i]]) === 'fog') return null;
        return <circle key={i} cx={x} cy={y} r={strongSet.has(i) ? 4 : 2.5} fill="var(--ink)" />;
      })}

      {/* 銘, in front: the strokes each dim earned, and the spatter. */}
      {ming.strokes.map((s, i) => (
        <path key={`s${i}`} d={s.d} fill="none" stroke="var(--ink)" strokeOpacity={s.opacity}
          strokeWidth={s.width} strokeLinecap="round" />
      ))}
      {ming.specks.map((p, i) => (
        <circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="var(--ink)" fillOpacity={p.opacity} />
      ))}

      {DIMS.map((dim, i) => {
        const a = dimAngle(i);
        const strong = strongSet.has(i);
        const state = dimState(evidence[dim]);
        const fontSize = strong ? strongFont : baseFont;
        const r = labelR + (strong ? size * 0.008 : 0);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const label = labelFor ? labelFor(dim) : dim;
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';

        // Weight and ink carry the same three-tier reading as the ring itself:
        // learned and loved is full ink and bold, learned is plain ink, and a
        // dim still in fog is written faint — the label admits it is unknown
        // rather than looking like a measured zero.
        return (
          <text
            key={dim}
            x={x} y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={strong ? 700 : 400}
            fill={strong ? 'var(--ink)' : state === 'fog' ? 'var(--ink-faint)' : 'var(--ink-soft)'}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
