// A Canvas2D → SVG recording context, so the creature has ONE drawing and two
// outputs instead of two drawings that drift.
//
// The two-renderer contract (TasteForm.tsx, blobForm.ts) says the live canvas
// and the static snapshot "can never disagree about what the profile looks
// like". For the blob that is cheap — both read sampleForm(). The creature is
// hundreds of strokes of anatomy, and a hand-written SVG twin of
// drawCreatureFrame would be exactly the lookalike CLAUDE.md forbids: same on
// the day it ships, divergent on the first tuning pass, with no test able to
// catch it. So the snapshot instead REPLAYS the real renderer through this
// recorder: identity by construction, not by imitation.
//
// Scope: precisely the ctx surface creatureForm.ts + creatureGestures.ts use
// (26 members, enumerated by grep and pinned by test). Anything outside that
// surface throws by design — see svgContext()'s proxy. If the creature one day
// calls drawImage(), the snapshot fails LOUDLY in tests instead of silently
// rendering a being with a missing organ. Same fail-loud philosophy as
// requireModel() in openrouter.ts, for the same reason: a plausible-but-wrong
// render is worse than a crash.

const TAU = Math.PI * 2;

/** 2dp everywhere: stable strings for determinism tests, ~1/50px geometric
 *  error at render scale — invisible, and identical on every run. */
function fmt(v: number): string {
  const r = Math.round(v * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Stop = { offset: number; color: string };
class SvgGradient {
  stops: Stop[] = [];
  constructor(public kind: 'linear' | 'radial', public coords: number[]) {}
  addColorStop(offset: number, color: string) { this.stops.push({ offset, color }); }
}

/** Point on a rotated ellipse at parameter angle θ. */
function ellipsePoint(cx: number, cy: number, rx: number, ry: number, rot: number, th: number) {
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const x = rx * Math.cos(th), y = ry * Math.sin(th);
  return { x: cx + x * cr - y * sr, y: cy + x * sr + y * cr };
}

export class SvgContext {
  // ── the state drawCreatureFrame actually sets ──────────────────────────────
  fillStyle: string | SvgGradient = '#000';
  strokeStyle: string | SvgGradient = '#000';
  lineWidth = 1;
  lineCap: string = 'butt';
  lineJoin: string = 'miter';
  globalAlpha = 1;
  font = '10px sans-serif';
  textAlign: string = 'start';

  private d = '';                       // current path
  private body: string[] = [];          // emitted elements, in paint order
  private defs: string[] = [];
  private ids = 0;
  /** Open <g clip-path> nesting. save() marks depth; restore() closes back. */
  private groupDepth = 0;
  private saveStack: { groupDepth: number; alpha: number }[] = [];

  constructor(private width: number, private height: number) {}

  // ── path building ──────────────────────────────────────────────────────────
  beginPath() { this.d = ''; }
  moveTo(x: number, y: number) { this.d += `M${fmt(x)} ${fmt(y)}`; }
  lineTo(x: number, y: number) { this.d += `L${fmt(x)} ${fmt(y)}`; }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.d += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(x)} ${fmt(y)}`;
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.d += `Q${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`;
  }
  closePath() { if (this.d) this.d += 'Z'; }
  rect(x: number, y: number, w: number, h: number) {
    this.d += `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`;
  }
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    this.ellipse(x, y, r, r, 0, a0, a1, ccw);
  }
  /** Canvas ellipse → SVG arc commands (endpoint parameterization). Canvas
   *  semantics kept where the creature relies on them: a path with a current
   *  point gets a connecting line to the arc's start. A full sweep becomes two
   *  half-turn A segments, since SVG can't draw a 360° arc in one. */
  ellipse(cx: number, cy: number, rx: number, ry: number, rot: number,
    a0: number, a1: number, ccw = false) {
    let sweep = ccw ? a0 - a1 : a1 - a0;
    if (sweep >= TAU) sweep = TAU;
    const dir = ccw ? -1 : 1;
    const p0 = ellipsePoint(cx, cy, rx, ry, rot, a0);
    this.d += this.d ? `L${fmt(p0.x)} ${fmt(p0.y)}` : `M${fmt(p0.x)} ${fmt(p0.y)}`;
    const rotDeg = fmt((rot * 180) / Math.PI);
    const sweepFlag = ccw ? 0 : 1;
    const seg = (from: number, to: number) => {
      const p = ellipsePoint(cx, cy, rx, ry, rot, to);
      const large = Math.abs(to - from) > Math.PI ? 1 : 0;
      this.d += `A${fmt(rx)} ${fmt(ry)} ${rotDeg} ${large} ${sweepFlag} ${fmt(p.x)} ${fmt(p.y)}`;
    };
    if (sweep >= TAU - 1e-9) {
      seg(a0, a0 + dir * Math.PI);
      seg(a0 + dir * Math.PI, a0 + dir * TAU);
    } else {
      seg(a0, a0 + dir * sweep);
    }
  }

  // ── painting ───────────────────────────────────────────────────────────────
  clearRect(_x: number, _y: number, _w: number, _h: number) { /* fresh page — no-op */ }

  private paintRef(style: string | SvgGradient): string {
    if (typeof style === 'string') return style;
    const id = `g${this.ids++}`;
    const stops = style.stops
      .map(s => `<stop offset="${fmt(s.offset)}" stop-color="${esc(s.color)}"/>`).join('');
    if (style.kind === 'linear') {
      const [x0, y0, x1, y1] = style.coords;
      this.defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${fmt(x0)}" y1="${fmt(y0)}" x2="${fmt(x1)}" y2="${fmt(y1)}">${stops}</linearGradient>`);
    } else {
      const [x0, y0, r0, x1, y1, r1] = style.coords;
      this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${fmt(x1)}" cy="${fmt(y1)}" r="${fmt(r1)}" fx="${fmt(x0)}" fy="${fmt(y0)}" fr="${fmt(r0)}">${stops}</radialGradient>`);
    }
    return `url(#${id})`;
  }

  private alphaAttr(): string {
    return this.globalAlpha < 1 ? ` opacity="${fmt(this.globalAlpha)}"` : '';
  }

  fill() {
    if (!this.d) return;
    this.body.push(`<path d="${this.d}" fill="${esc(this.paintRef(this.fillStyle))}"${this.alphaAttr()}/>`);
  }
  stroke() {
    if (!this.d) return;
    const caps = this.lineCap !== 'butt' ? ` stroke-linecap="${this.lineCap}"` : '';
    const join = this.lineJoin !== 'miter' ? ` stroke-linejoin="${this.lineJoin}"` : '';
    this.body.push(`<path d="${this.d}" fill="none" stroke="${esc(this.paintRef(this.strokeStyle))}" stroke-width="${fmt(this.lineWidth)}"${caps}${join}${this.alphaAttr()}/>`);
  }

  /** Canvas clip(): everything painted until the matching restore() is bounded
   *  by the current path. Modelled as a <clipPath> def plus an open <g> that
   *  restore() closes — nesting composes exactly like the canvas clip stack. */
  clip() {
    const id = `c${this.ids++}`;
    this.defs.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`);
    this.body.push(`<g clip-path="url(#${id})">`);
    this.groupDepth++;
  }

  save() { this.saveStack.push({ groupDepth: this.groupDepth, alpha: this.globalAlpha }); }
  restore() {
    const s = this.saveStack.pop();
    if (!s) return;
    while (this.groupDepth > s.groupDepth) { this.body.push('</g>'); this.groupDepth--; }
    this.globalAlpha = s.alpha;
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    return new SvgGradient('linear', [x0, y0, x1, y1]);
  }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new SvgGradient('radial', [x0, y0, r0, x1, y1, r1]);
  }

  fillText(text: string, x: number, y: number) {
    const anchor = this.textAlign === 'center' ? 'middle'
      : this.textAlign === 'right' || this.textAlign === 'end' ? 'end' : 'start';
    this.body.push(`<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" style="font:${esc(this.font)}" fill="${esc(this.paintRef(this.fillStyle))}"${this.alphaAttr()}>${esc(text)}</text>`);
  }

  /** Inner SVG markup (defs + elements) — the caller owns the <svg> wrapper. */
  toInnerSvg(): string {
    let tail = '';
    for (let i = 0; i < this.groupDepth; i++) tail += '</g>';
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    return defs + this.body.join('') + tail;
  }
}

/**
 * An SvgContext wrapped so that ANY canvas member outside the implemented
 * surface throws with a pointed message instead of silently no-oping. That
 * turns "the creature grew a new kind of stroke" into a red test the same day,
 * rather than a share image that quietly disagrees with the Taste tab.
 */
export function svgContext(width: number, height: number): {
  ctx: CanvasRenderingContext2D; svg: () => string;
} {
  const real = new SvgContext(width, height);
  const proxy = new Proxy(real, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      throw new Error(
        `canvasToSvg: the renderer called ctx.${String(prop)}, which the SVG recorder does not implement. `
        + 'Add it to SvgContext (and its test) — the snapshot must never silently drop a stroke the live canvas draws.',
      );
    },
  });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, svg: () => real.toInnerSvg() };
}
