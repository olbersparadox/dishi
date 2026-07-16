'use client';
import { DIMS } from '@/lib/taste';

/**
 * Radar/spider chart of the full 18-dimension taste vector — a "knowledge graph"
 * view of the engine's current understanding, alongside the bar list (which is
 * better for reading exact values; this is better for feeling the overall shape
 * at a glance). Hand-drawn SVG, not a charting library — matches how every other
 * visual in this app (taste form, MatchRing) is built, keeping the bundle light.
 *
 * Values run -1..1 per dimension; the chart maps that to a 0..1 radius fraction
 * (a genuine dislike sits near the center, a strong like sits near the rim) so a
 * completely blank profile correctly renders as a flat point, not a lopsided shape.
 *
 * The user's strongest preferences (top few positive dims) are called out: their
 * labels are enlarged, bolded and drawn in full ink — so at a glance you can READ
 * what you most like without squinting at 18 identical tiny labels. This is the one
 * thing the radar is for that the blob can't do.
 */
export default function TasteRadar({ vector, size = 280, labelFor }: {
  vector: Record<string, number>; size?: number; labelFor?: (dim: string) => string;
}) {
  const cx = size / 2, cy = size / 2;
  // Chart sits well inside the SVG so the (now larger) labels have a clear ring
  // of margin and never clip against the edge.
  const maxR = size * 0.30;
  const n = DIMS.length;
  const angleFor = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const pointFor = (i: number, value: number) => {
    // -1..1 -> 0..1 radius fraction: a neutral/unrated dim sits at the exact
    // center, never off to one side — no fabricated position for missing data.
    const frac = (value + 1) / 2;
    const angle = angleFor(i);
    return [cx + Math.cos(angle) * maxR * frac, cy + Math.sin(angle) * maxR * frac] as const;
  };

  const dataPoints = DIMS.map((dim, i) => pointFor(i, vector[dim] ?? 0));
  const dataPath = dataPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Strongest preferences: the top (up to) 3 clearly-positive dimensions. Only
  // meaningfully-liked dims qualify (> 0.12), so a sparse/neutral profile calls
  // out fewer — or nothing — rather than shouting about a near-flat dimension.
  const strongSet = new Set(
    DIMS.map((dim, i) => ({ i, v: vector[dim] ?? 0 }))
      .filter(e => e.v > 0.12)
      .sort((a, b) => b.v - a.v)
      .slice(0, 3)
      .map(e => e.i),
  );

  const baseFont = Math.max(11, size * 0.043);
  const strongFont = size * 0.06;

  // Faint reference rings at 25/50/75/100% so the shape has something to read against.
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar chart of your 18 taste dimensions">
      {rings.map(f => (
        <polygon
          key={f}
          points={DIMS.map((_, i) => {
            const a = angleFor(i);
            return `${(cx + Math.cos(a) * maxR * f).toFixed(1)},${(cy + Math.sin(a) * maxR * f).toFixed(1)}`;
          }).join(' ')}
          fill="none"
          stroke="var(--line)"
          strokeWidth={1}
        />
      ))}
      {DIMS.map((_, i) => {
        const a = angleFor(i);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(a) * maxR} y2={cy + Math.sin(a) * maxR}
            stroke="var(--line)" strokeWidth={1}
          />
        );
      })}
      <polygon points={dataPath} fill="var(--ink)" fillOpacity={0.12} stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={strongSet.has(i) ? 4 : 2.5} fill="var(--ink)" />
      ))}
      {DIMS.map((dim, i) => {
        const a = angleFor(i);
        const strong = strongSet.has(i);
        const fontSize = strong ? strongFont : baseFont;
        const labelR = maxR + (strong ? size * 0.058 : size * 0.05);
        const x = cx + Math.cos(a) * labelR;
        const y = cy + Math.sin(a) * labelR;
        const label = labelFor ? labelFor(dim) : dim;
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';

        // Strongest preferences are called out by weight + size + ink colour only —
        // no ring. Bolder/bigger/darker reads as "these are your top tastes" without
        // the pill chrome, and stays legible against the light chart behind it.
        return (
          <text
            key={dim}
            x={x} y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={strong ? 700 : 400}
            fill={strong ? 'var(--ink)' : 'var(--ink-soft)'}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
