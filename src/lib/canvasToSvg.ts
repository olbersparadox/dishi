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

/**
 * A def's id, derived from its own CONTENT rather than a per-instance counter.
 *
 * This is load-bearing, not tidiness. The counter it replaced restarted at 0
 * for every recorder, so every snapshot on a page emitted `g0`, `g1`, `c2`…
 * and `url(#c2)` resolves to the FIRST `c2` in the DOCUMENT — another
 * creature's clip path or gradient. On the 膚 board that silently clipped one
 * creature's skin against a different creature's outline, so features that
 * were present and correct in the SVG string rendered as nothing on screen.
 * It only reproduced with several snapshots mounted at once, which is why
 * isolated rasterisation of the same markup looked fine.
 *
 * Content-hashing fixes it in both directions: different defs can never
 * collide, and identical defs deliberately SHARE one id (same geometry, same
 * paint — one def is correct and smaller). It is also deterministic, so
 * server and client render byte-identical markup and hydration stays quiet —
 * which a global counter would not guarantee.
 *
 * BUT sharing across SEPARATE <svg> elements is a second bug, found 2026-08-06
 * on the 膚 board: 14 of 16 creatures there referenced a paint server owned by
 * a different creature's <svg> (most often the fog wash, whose def is
 * byte-identical for every snapshot of the same size, so every 200px creature
 * on the page deferred to the first one). It renders correctly right up until
 * the OWNING svg unmounts or is hidden — then every borrower silently loses
 * that paint, with markup that still looks perfect in the DOM. Conditional
 * rendering and list virtualisation make that a matter of when, not if.
 *
 * The prefix applied in toInnerSvg() closes it: see there for why hashing the
 * finished markup is what makes each snapshot self-contained.
 */
function fnv(content: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    h ^= content.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function defId(kind: 'g' | 'c', content: string): string {
  return kind + fnv(content).toString(36);
}

/* ── ink measurement ───────────────────────────────────────────────────────────
   The recorder is the ONLY place that ever holds the creature's geometry in
   exact form — arc centres and sweeps, curve control points, stroke widths,
   clip regions. It used to flatten all of that into path text immediately,
   and every measurement question ("does it clip the canvas?", "how far does
   the claw reach?") then tried to RECONSTRUCT geometry by parsing the text
   back. That reconstruction is a trap that cost four broken ad-hoc parsers in
   one day (2026-08-07): arc flags misread as coordinates, curve endpoints
   skipped, rect()'s relative h/v choking an absolute-only parser, and control
   points counted as rendered ink when a curve never passes through its own
   control point. Each throwaway instrument was less tested than the renderer
   it was measuring, so every conclusion drawn through one was suspect.

   So the recorder now measures AT THE EMITTER, where nothing needs parsing.
   Curves and arcs are densely SAMPLED rather than solved in closed form — at
   the step sizes used the sampling error is under 0.05px, beyond the 2dp
   output precision, and sampling cannot have the algebra bugs that
   closed-form rotated-ellipse extrema invite. Bounds err conservative by
   design where exactness is expensive: strokes inflate by lineWidth/2 in all
   directions (slight overestimate at butt caps), clip is applied as the clip
   path's BOUNDING BOX (superset of the true region), and text uses an
   em-box. Conservative means "may flag near-misses", never "misses a real
   crop" — the right direction for every question this exists to answer.

   Ask via inkBounds()/inkRecords(); never parse `d=` text for geometry. */
export type InkBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type InkRecord = InkBounds & { kind: 'fill' | 'stroke' | 'text'; style: string };

const emptyBounds = (): InkBounds =>
  ({ minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
const boundsValid = (b: InkBounds) => b.minX <= b.maxX && b.minY <= b.maxY;
const intersect = (a: InkBounds, b: InkBounds): InkBounds => ({
  minX: Math.max(a.minX, b.minX), minY: Math.max(a.minY, b.minY),
  maxX: Math.min(a.maxX, b.maxX), maxY: Math.min(a.maxY, b.maxY),
});

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
  // ── ink measurement state (see block comment above) ────────────────────────
  private pb = emptyBounds();           // current path's bounds, reset by beginPath
  private px = 0; private py = 0;       // numeric current point, for curve sampling
  private clipStack: InkBounds[] = [];  // active clip bboxes; restore() truncates
  private records: InkRecord[] = [];
  private total = emptyBounds();
  /** Every id this recorder minted — the exact token set toInnerSvg() prefixes.
   *  Rewriting only these (never a blind regex over the markup) keeps glyph
   *  text and colour strings out of the substitution's reach.
   *
   *  It is also what keeps `defs` to ONE entry per id. Canvas has no reusable
   *  paint object — the renderer re-sets ctx.strokeStyle before every stroke —
   *  so paintRef used to append a byte-identical twin per call: a furry life
   *  emitted 70 defs carrying 2 distinct ones, and <defs> was 46% of the file
   *  (16,753 of 36,117 bytes at 190px). Because ids are content-derived, an id
   *  already minted PROVES its def is byte-identical, so skipping the push is
   *  a pure subtraction — no reference can dangle. */
  private mintedIds = new Set<string>();
  /** Open <g clip-path> nesting. save() marks depth; restore() closes back. */
  private groupDepth = 0;
  private saveStack: { groupDepth: number; alpha: number; clipDepth: number }[] = [];

  constructor(private width: number, private height: number) {}

  // ── path building ──────────────────────────────────────────────────────────
  private addPt(x: number, y: number) {
    if (x < this.pb.minX) this.pb.minX = x;
    if (y < this.pb.minY) this.pb.minY = y;
    if (x > this.pb.maxX) this.pb.maxX = x;
    if (y > this.pb.maxY) this.pb.maxY = y;
  }
  beginPath() { this.d = ''; this.pb = emptyBounds(); }
  moveTo(x: number, y: number) {
    this.d += `M${fmt(x)} ${fmt(y)}`;
    this.addPt(x, y); this.px = x; this.py = y;
  }
  lineTo(x: number, y: number) {
    this.d += `L${fmt(x)} ${fmt(y)}`;
    this.addPt(x, y); this.px = x; this.py = y;
  }
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    this.d += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(x)} ${fmt(y)}`;
    // sample the CURVE, never the control points — a curve does not pass
    // through its controls, and counting them as ink is exactly the parser
    // mistake this measurement layer exists to retire
    const x0 = this.px, y0 = this.py;
    for (let i = 1; i <= 48; i++) {
      const t = i / 48, u = 1 - t;
      this.addPt(
        u*u*u*x0 + 3*u*u*t*c1x + 3*u*t*t*c2x + t*t*t*x,
        u*u*u*y0 + 3*u*u*t*c1y + 3*u*t*t*c2y + t*t*t*y);
    }
    this.px = x; this.py = y;
  }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    this.d += `Q${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`;
    const x0 = this.px, y0 = this.py;
    for (let i = 1; i <= 32; i++) {
      const t = i / 32, u = 1 - t;
      this.addPt(u*u*x0 + 2*u*t*cx + t*t*x, u*u*y0 + 2*u*t*cy + t*t*y);
    }
    this.px = x; this.py = y;
  }
  closePath() { if (this.d) this.d += 'Z'; }
  rect(x: number, y: number, w: number, h: number) {
    this.d += `M${fmt(x)} ${fmt(y)}h${fmt(w)}v${fmt(h)}h${fmt(-w)}Z`;
    this.addPt(x, y); this.addPt(x + w, y + h);
    this.px = x; this.py = y;
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
    // measurement: sample the swept arc densely (~2° steps → <0.05px error at
    // creature scale, beyond the 2dp output precision anyway)
    const steps = Math.max(8, Math.ceil(Math.abs(sweep) / 0.035));
    for (let i = 0; i <= steps; i++) {
      const p = ellipsePoint(cx, cy, rx, ry, rot, a0 + dir * sweep * (i / steps));
      this.addPt(p.x, p.y);
    }
    const pEnd = ellipsePoint(cx, cy, rx, ry, rot, a0 + dir * sweep);
    this.px = pEnd.x; this.py = pEnd.y;
  }

  // ── painting ───────────────────────────────────────────────────────────────
  clearRect(_x: number, _y: number, _w: number, _h: number) { /* fresh page — no-op */ }

  private paintRef(style: string | SvgGradient): string {
    if (typeof style === 'string') return style;
    const stops = style.stops
      .map(s => `<stop offset="${fmt(s.offset)}" stop-color="${esc(s.color)}"/>`).join('');
    let attrs: string;
    if (style.kind === 'linear') {
      const [x0, y0, x1, y1] = style.coords;
      attrs = `gradientUnits="userSpaceOnUse" x1="${fmt(x0)}" y1="${fmt(y0)}" x2="${fmt(x1)}" y2="${fmt(y1)}"`;
    } else {
      const [x0, y0, r0, x1, y1, r1] = style.coords;
      attrs = `gradientUnits="userSpaceOnUse" cx="${fmt(x1)}" cy="${fmt(y1)}" r="${fmt(r1)}" fx="${fmt(x0)}" fy="${fmt(y0)}" fr="${fmt(r0)}"`;
    }
    const tag = style.kind === 'linear' ? 'linearGradient' : 'radialGradient';
    const id = defId('g', `${tag}|${attrs}|${stops}`);
    if (!this.mintedIds.has(id)) {
      this.mintedIds.add(id);
      this.defs.push(`<${tag} id="${id}" ${attrs}>${stops}</${tag}>`);
    }
    return `url(#${id})`;
  }

  private alphaAttr(): string {
    return this.globalAlpha < 1 ? ` opacity="${fmt(this.globalAlpha)}"` : '';
  }

  /** Merge a finished element's bounds into the measurement, clipped by the
   *  active clip stack (as bboxes — conservative superset of the true clip). */
  private commitInk(b: InkBounds, kind: InkRecord['kind'], style: string | SvgGradient) {
    if (!boundsValid(b)) return;
    let eff = b;
    for (const c of this.clipStack) eff = intersect(eff, c);
    if (!boundsValid(eff)) return; // fully clipped away — no ink reaches the page
    const styleStr = typeof style === 'string' ? style : `gradient:${style.kind}`;
    this.records.push({ ...eff, kind, style: styleStr });
    if (eff.minX < this.total.minX) this.total.minX = eff.minX;
    if (eff.minY < this.total.minY) this.total.minY = eff.minY;
    if (eff.maxX > this.total.maxX) this.total.maxX = eff.maxX;
    if (eff.maxY > this.total.maxY) this.total.maxY = eff.maxY;
  }

  fill() {
    if (!this.d) return;
    this.body.push(`<path d="${this.d}" fill="${esc(this.paintRef(this.fillStyle))}"${this.alphaAttr()}/>`);
    this.commitInk(this.pb, 'fill', this.fillStyle);
  }
  stroke() {
    if (!this.d) return;
    const caps = this.lineCap !== 'butt' ? ` stroke-linecap="${this.lineCap}"` : '';
    const join = this.lineJoin !== 'miter' ? ` stroke-linejoin="${this.lineJoin}"` : '';
    this.body.push(`<path d="${this.d}" fill="none" stroke="${esc(this.paintRef(this.strokeStyle))}" stroke-width="${fmt(this.lineWidth)}"${caps}${join}${this.alphaAttr()}/>`);
    const half = this.lineWidth / 2;
    this.commitInk({
      minX: this.pb.minX - half, minY: this.pb.minY - half,
      maxX: this.pb.maxX + half, maxY: this.pb.maxY + half,
    }, 'stroke', this.strokeStyle);
  }

  /** Canvas clip(): everything painted until the matching restore() is bounded
   *  by the current path. Modelled as a <clipPath> def plus an open <g> that
   *  restore() closes — nesting composes exactly like the canvas clip stack. */
  clip() {
    const id = defId('c', this.d);
    if (!this.mintedIds.has(id)) {
      this.mintedIds.add(id);
      this.defs.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`);
    }
    // the <g> is always emitted — deduping the DEF must never drop a clip the
    // paint order depends on (two separate marks can share one silhouette, as
    // 糙 and 甲 do on a shelled body)
    this.body.push(`<g clip-path="url(#${id})">`);
    this.groupDepth++;
    this.clipStack.push({ ...this.pb });
  }

  save() {
    this.saveStack.push({
      groupDepth: this.groupDepth, alpha: this.globalAlpha,
      clipDepth: this.clipStack.length,
    });
  }
  restore() {
    const s = this.saveStack.pop();
    if (!s) return;
    while (this.groupDepth > s.groupDepth) { this.body.push('</g>'); this.groupDepth--; }
    this.globalAlpha = s.alpha;
    this.clipStack.length = s.clipDepth;
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
    // measurement: em-box approximation (CJK ≈ 1em/char — an overestimate for
    // latin, which is the safe direction). Baseline metrics: ~0.8em ascent,
    // ~0.25em descent.
    const size = parseFloat(this.font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '10');
    const w = size * Array.from(text).length;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    this.commitInk(
      { minX: x0, minY: y - size * 0.8, maxX: x0 + w, maxY: y + size * 0.25 },
      'text', this.fillStyle);
  }

  /** Union bounds of every element that reached the page, or null if nothing
   *  painted. See the ink-measurement block comment for guarantees. */
  inkBounds(): InkBounds | null {
    return boundsValid(this.total) ? { ...this.total } : null;
  }
  /** Per-element bounds in paint order, for finer questions (which element
   *  sits leftmost, how much do two features overlap, …). */
  inkRecords(): readonly InkRecord[] { return this.records; }

  /** Inner SVG markup (defs + elements) — the caller owns the <svg> wrapper.
   *
   *  Every minted id gets a prefix hashed from this snapshot's OWN finished
   *  markup, which is what makes the fragment self-contained: an id can only
   *  be borrowed from a neighbour if two snapshots mint the same token, and
   *  two snapshots can only do that if their whole markup matches — in which
   *  case the borrower carries an identical def of its own and survives the
   *  lender unmounting. Hashing the finished markup rather than seeding from
   *  a counter keeps the property the content-hash was introduced for: server
   *  and client produce byte-identical output, so hydration stays quiet.
   *
   *  The substitution is driven by mintedIds, not by a regex over the markup,
   *  so a colour string or a 銘 glyph that happens to contain `url(#` can
   *  never be rewritten. */
  toInnerSvg(): string {
    let tail = '';
    for (let i = 0; i < this.groupDepth; i++) tail += '</g>';
    const defs = this.defs.length ? `<defs>${this.defs.join('')}</defs>` : '';
    let inner = defs + this.body.join('') + tail;
    if (!this.mintedIds.size) return inner;
    // leading 's' because a base36 hash can start with a digit, and an XML id
    // may not — browsers tolerate it, CSS selectors do not
    const prefix = 's' + fnv(inner).toString(36) + '-';
    this.mintedIds.forEach(id => {
      inner = inner.split(`id="${id}"`).join(`id="${prefix}${id}"`)
        .split(`url(#${id})`).join(`url(#${prefix}${id})`);
    });
    return inner;
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
  inkBounds: () => InkBounds | null; inkRecords: () => readonly InkRecord[];
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
  return {
    ctx: proxy as unknown as CanvasRenderingContext2D,
    svg: () => real.toInnerSvg(),
    inkBounds: () => real.inkBounds(),
    inkRecords: () => real.inkRecords(),
  };
}
