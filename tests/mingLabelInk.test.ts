import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TIER_INK } from '../src/components/TasteRadar';
import type { LabelTier } from '../src/lib/logogram';

/**
 * The 銘's label ink ladder must lighten strictly from `called` to `fog`.
 *
 * This is an honesty guard, not a style preference. `quiet` is a dim the engine
 * HAS learned and simply has no opinion about; `fog` is one it has never been
 * taught. If a future "make it a bit lighter" pass pushes quiet past fog, the
 * figure silently starts rendering "no opinion" identically to "never tasted" —
 * precisely the conflation the 銘 replaced the radar polygon to eliminate.
 *
 * Token values are READ FROM globals.css rather than copied here, so retuning a
 * token is checked too, not just retuning the opacities.
 */
const CSS = readFileSync(resolve(__dirname, '../src/app/globals.css'), 'utf8');

function token(name: string): [number, number, number] {
  const m = CSS.match(new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} not found in globals.css`);
  const h = m[1];
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const PAPER = token('--glaze');

/** Perceived lightness of a tier once its opacity is composited over paper. */
function lightness(tier: LabelTier): number {
  const { fill, opacity } = TIER_INK[tier];
  const name = fill.match(/var\((--[\w-]+)\)/)![1];
  const ink = token(name);
  const [r, g, b] = ink.map((c, i) => c * opacity + PAPER[i] * (1 - opacity));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

describe('銘 label ink ladder', () => {
  it('lightens strictly from called to fog, with fog the lightest', () => {
    const order: LabelTier[] = ['called', 'held', 'quiet', 'fog'];
    const ls = order.map(lightness);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeGreaterThan(ls[i - 1]);
    }
  });

  it('keeps a real gap between quiet and fog — the tiers that must never merge', () => {
    // "Learned but neutral" vs "never tasted". Anything under a few points of
    // lightness is a difference nobody can see, which is the same as no
    // difference at all for the claim the figure is making.
    expect(lightness('fog') - lightness('quiet')).toBeGreaterThan(5);
  });

  it('keeps the called-out tastes clearly the darkest thing in the ring', () => {
    expect(lightness('held') - lightness('called')).toBeGreaterThan(40);
    expect(TIER_INK.called.weight).toBeGreaterThan(TIER_INK.held.weight);
  });

  it('keeps a pale ring with soft accents — nothing is inked at full strength', () => {
    // 初學's look is the target: a mostly-pale ring of words with a couple of
    // accents that are darker without being hard black. Every tier is held
    // back from its token's full strength, the callout included.
    for (const t of ['called', 'held', 'quiet', 'fog'] as LabelTier[]) {
      expect(TIER_INK[t].opacity).toBeLessThan(1);
    }
    // The three non-accent tiers all sit in genuinely pale territory.
    for (const t of ['held', 'quiet', 'fog'] as LabelTier[]) {
      expect(lightness(t)).toBeGreaterThan(160);
    }
  });
});
