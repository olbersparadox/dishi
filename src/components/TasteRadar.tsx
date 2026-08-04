'use client';
import { DIMS } from '@/lib/taste';
import type { EvidenceMap } from '@/lib/taste';
import { dimAngle, dimState } from '@/lib/blobForm';
import { buildMing, labelTier } from '@/lib/logogram';

/**
 * The 銘 · the full breakdown, written rather than plotted.
 *
 * The logogram (lib/logogram.ts) — a rough ink ring where each of the 18 dims
 * keeps its compass seat and carries strokes for what it has actually LEARNED.
 * Outward = love, inward = dislike, stroke count = evidence, silence = fog.
 * Plus the labels, because reading WHAT you like is the one job neither the
 * blob nor the creature can do.
 *
 * The radar polygon this file used to draw is GONE (owner, 2026-08-05), and
 * good riddance on honesty grounds: it mapped -1..1 onto a radius, which plots
 * an unrated dim at mid-radius, indistinguishable from a measured neutral. It
 * had no axis for evidence and so asserted readings it never had. The 銘 says
 * the same thing the polygon did — magnitude, per dim, at a fixed seat — but
 * in stroke reach, where silence is available as an answer. Nothing was lost
 * in the removal except the fabrication. Do not reinstate it.
 *
 * The compass is `dimAngle(i)`, the same helper the blob and the creature use,
 * never a local copy — that shared seat is what lets a dim mean one thing
 * across every register of the being.
 *
 * Hand-drawn SVG, not a charting library — matches how every other visual in
 * this app is built and keeps the bundle light.
 */
/** Interior guide rings, as fractions of the shared rim. No 1.0 — the 銘's own
 *  ink ring is the rim, and a guide drawn on top of it would only double it. */
const GUIDES = [0.25, 0.5, 0.75];

/**
 * How each label tier is inked. Tuned to 初學's feel (owner, 2026-08-05): a
 * mostly-pale ring of words with a couple of dark accents, rather than a wall
 * of mid-grey. The whole non-accent ladder sits one step lighter than the
 * tokens' full strength — only `called` is at full ink, and it earns it by
 * being the thing you are meant to read first.
 *
 * Resolved against paper, these come out roughly:
 *   called #5f5c58 · held #b4afa6 · quiet #c9c5bd · fog #d8d2c5
 *
 * `called` is held back from full --ink too (owner, 2026-08-05). It can afford
 * to be: WEIGHT is what marks a called-out taste, so the colour only has to
 * separate it, not shout. At full ink it read as a hard black accent against a
 * pale ring rather than as part of the same hand.
 *
 * That ORDER is the contract, not the numbers: strictly lightening from called
 * to fog, with fog lightest. `quiet` is a dim the engine has LEARNED and merely
 * has no opinion about; `fog` is one it has never been taught. If those two
 * ever cross, the figure starts rendering "no opinion" as "never tasted" —
 * the exact fabrication it was built to remove. A vitest guard pins the
 * ordering by resolving these to luminance, so a future "just a bit lighter"
 * cannot quietly invert them.
 */
export const TIER_INK = {
  called: { fill: 'var(--ink)', opacity: 0.75, weight: 700 },
  held: { fill: 'var(--ink-soft)', opacity: 0.55, weight: 400 },
  quiet: { fill: 'var(--ink-soft)', opacity: 0.38, weight: 400 },
  fog: { fill: 'var(--ink-faint)', opacity: 0.7, weight: 400 },
} as const;

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

  // One size for all 18 labels (owner, 2026-08-05). The called-out top tastes
  // are still marked, by WEIGHT and ink only — enlarging them as well made the
  // ring of labels ragged, and the 銘's own strokes already say which seats are
  // loud. Type size is not a third channel for the same fact.
  const labelFont = Math.max(11, size * 0.043);

  // Labels ride outside the ink the profile actually wrote, so a loud palate
  // never collides with its own labels and a quiet one isn't ringed by dead
  // space. Capped so the longest label still can't leave the box.
  const labelR = Math.min(ming.extent + size * 0.05, size * 0.4);
  // Where a spoke stops. Clearance is derived from the label's font size rather
  // than being a flat number — a centre-anchored label's box reaches back down
  // its own spoke by half its height, and a fixed gap struck 嫩 through the
  // middle back when the called-out labels were set larger.
  const spokeR = labelR - labelFont * 0.75 - size * 0.01;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label="Your 銘: an ink ring where each taste dimension keeps its own seat. Strokes reaching outward are tastes you like, inward ones you dislike, more strokes means more meals learned from, and a seat left blank is one the engine has not learned yet.">
      {/* Guide rings and spokes, restored at roughly half their old weight
          (owner, 2026-08-05). They are back for the seats, not for the
          measuring: with the polygon gone and silence a legitimate answer, a
          fog dim has no ink at all, and its spoke is the only thing tying its
          label to a place on the figure. At full --line weight they read as
          scaffolding abandoned by the removed chart; this faint they read as
          ruling under writing, which is what they are. Static — guides do not
          flow, only ink does. */}
      {GUIDES.map(f => (
        <polygon
          key={f}
          points={DIMS.map((_, i) => {
            const a = dimAngle(i);
            return `${(cx + Math.cos(a) * ringR * f).toFixed(1)},${(cy + Math.sin(a) * ringR * f).toFixed(1)}`;
          }).join(' ')}
          fill="none" stroke="var(--line)" strokeOpacity={0.5} strokeWidth={0.75}
        />
      ))}
      {DIMS.map((_, i) => {
        const a = dimAngle(i);
        // Spokes run the whole way out and stop just short of the label
        // (owner, 2026-08-05) rather than ending at the ring. Reaching the word
        // is what makes each spoke a POINTER — it names which seat the label
        // belongs to — instead of interior chart ruling that happens to align.
        // It matters most where there is no ink: a fog dim's spoke is the only
        // thing connecting its label to the figure.
        const outer = spokeR;
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={cx + Math.cos(a) * outer} y2={cy + Math.sin(a) * outer}
            stroke="var(--line)" strokeOpacity={0.5} strokeWidth={0.75}
          />
        );
      })}

      {/* 銘: wash blotches behind, then the ring's three brush passes. */}
      {ming.blotches.map((b, i) => (
        <ellipse key={`b${i}`} cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry}
          transform={`rotate(${b.rot.toFixed(1)} ${b.cx.toFixed(1)} ${b.cy.toFixed(1)})`}
          fill="var(--ink)" fillOpacity={0.08} />
      ))}
      {ming.ring.map((r, i) => (
        // The ring holds still. It is the body of the figure; only the strands
        // move, the way hair moves against a head that doesn't.
        <path key={`r${i}`} d={r.d} fill="none" stroke="var(--ink)"
          strokeOpacity={r.opacity} strokeWidth={r.width} strokeLinejoin="round" />
      ))}

      {/* 銘: the strokes each dim earned, and the spatter. */}
      {/* Each strand pivots about its own root (--ming-ox/oy) so the tip sways
          and the root stays on its seat. A NEGATIVE delay proportional to the
          strand's angle starts each one part-way through the same 6s loop —
          that is what makes the sway travel around the ring like wind rather
          than every strand swinging at once. */}
      {ming.strokes.map((s, i) => (
        <path key={`s${i}`} className="ming-strand" d={s.d} fill="none" stroke="var(--ink)"
          strokeOpacity={s.opacity} strokeWidth={s.width} strokeLinecap="round"
          style={{
            ['--ming-ox' as string]: `${s.rootX.toFixed(2)}px`,
            ['--ming-oy' as string]: `${s.rootY.toFixed(2)}px`,
            ['--ming-sway' as string]: `${s.sway.toFixed(2)}deg`,
            animationDelay: `${(-6 * s.phase).toFixed(2)}s`,
          }} />
      ))}
      {ming.specks.map((p, i) => (
        <circle key={`p${i}`} cx={p.cx} cy={p.cy} r={p.r} fill="var(--ink)" fillOpacity={p.opacity} />
      ))}

      {DIMS.map((dim, i) => {
        const a = dimAngle(i);
        const strong = strongSet.has(i);
        // Every label on one radius now that they share a size, so the ring of
        // words is even — the old +0.008 nudge existed only to give the larger
        // called-out labels room.
        const r = labelR;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        const label = labelFor ? labelFor(dim) : dim;
        const anchor = Math.abs(Math.cos(a)) < 0.15 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';

        // Four tiers of ink — see TIER_INK above for the ladder and the
        // ordering contract it has to keep.
        const ink = TIER_INK[labelTier(evidence[dim], vector[dim] ?? 0, strong)];
        return (
          <text
            key={dim}
            x={x} y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={labelFont}
            fontWeight={ink.weight}
            fill={ink.fill}
            fillOpacity={ink.opacity}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
