'use client';
import { DIMS } from '@/lib/taste';

/**
 * Radar/spider chart of the full 18-dimension taste vector — a "knowledge graph"
 * view of the engine's current understanding, alongside the bar list (which is
 * better for reading exact values; this is better for feeling the overall shape
 * at a glance). Hand-drawn SVG, not a charting library — matches how every other
 * visual in this app (Buddy, MatchRing) is built, keeping the bundle light.
 *
 * Values run -1..1 per dimension; the chart maps that to a 0..1 radius fraction
 * (a genuine dislike sits near the center, a strong like sits near the rim) so a
 * completely blank profile correctly renders as a flat point, not a lopsided shape.
 */
export default function TasteRadar({ vector, size = 280 }: { vector: Record<string, number>; size?: number }) {
  const cx = size / 2, cy = size / 2;
  const maxR = size * 0.36;
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
      <polygon points={dataPath} fill="var(--jade)" fillOpacity={0.18} stroke="var(--jade)" strokeWidth={2} strokeLinejoin="round" />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill="var(--jade)" />
      ))}
      {DIMS.map((dim, i) => {
        const a = angleFor(i);
        const labelR = maxR + 16;
        const x = cx + Math.cos(a) * labelR;
        const y = cy + Math.sin(a) * labelR;
        return (
          <text
            key={dim}
            x={x} y={y}
            textAnchor={Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end'}
            dominantBaseline="middle"
            fontSize={9.5}
            fill="var(--ink-soft)"
          >
            {dim}
          </text>
        );
      })}
    </svg>
  );
}
