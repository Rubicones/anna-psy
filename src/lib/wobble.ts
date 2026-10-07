/**
 * Hand-drawn line toolkit. Runs at build time only (inside .astro frontmatter),
 * so none of this ships to the browser — the output is plain SVG path data.
 *
 * Idea: author a few rough control points by hand → smooth them with Catmull-Rom →
 * resample by arc length → push every sample along its normal by smooth 1D noise
 * (a slow "hand tremor") → emit cubic Béziers.
 */

export type Pt = [number, number];

/** Small, fast, seedable PRNG. Same seed → same drawing on every build. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise in 1D, range roughly [-1, 1]. */
function noise1D(rand: () => number, size = 97): (x: number) => number {
  const v = Array.from({ length: size }, () => rand() * 2 - 1);
  const at = (i: number) => v[((i % size) + size) % size] ?? 0;
  return (x) => {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3 - 2 * f);
    return at(i) + (at(i + 1) - at(i)) * t;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Dense Catmull-Rom polyline through the given points. */
function catmull(points: Pt[], closed: boolean, perSeg = 14): Pt[] {
  const n = points.length;
  if (n < 2) return points.slice();
  const get = (i: number): Pt => {
    if (closed) return points[((i % n) + n) % n]!;
    return points[Math.max(0, Math.min(n - 1, i))]!;
  };
  const out: Pt[] = [];
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? get(0) : get(n - 1));
  return out;
}

/** Evenly spaced samples along a polyline. */
function resample(poly: Pt[], step: number): Pt[] {
  if (poly.length < 2) return poly.slice();
  const out: Pt[] = [poly[0]!];
  let carry = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1]!, b = poly[i]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  const last = poly[poly.length - 1]!;
  const tail = out[out.length - 1]!;
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.35) out.push(last);
  return out;
}

/** Catmull-Rom → cubic Bézier path string through all samples. */
function toPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  const p = (i: number) => pts[Math.max(0, Math.min(pts.length - 1, i))]!;
  let d = `M${r1(p(0)[0])} ${r1(p(0)[1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d;
}

export interface WobbleOptions {
  seed?: number;
  /** tremor amplitude in viewBox units (≈px at default size) */
  amp?: number;
  /** tremor wavelength — bigger = lazier wobble */
  wave?: number;
  /** resample spacing; smaller = more detail, heavier markup */
  step?: number;
  /** random nudge applied to authored points before smoothing */
  jitter?: number;
  /** closed shape drawn "in one go": the pen overshoots the start a little */
  closed?: boolean;
  /** fraction of the loop to overshoot (closed only) */
  overshoot?: number;
}

/** The core: a wobbly hand-drawn path through rough control points. */
export function wobble(points: Pt[], o: WobbleOptions = {}): string {
  const { seed = 1, amp = 1.3, wave = 46, step = 7, closed = false, overshoot = 0.06 } = o;
  const jitter = o.jitter ?? amp * 0.9;
  const rand = rng(seed);
  const pts = points.map(([x, y]): Pt => [x + (rand() - 0.5) * 2 * jitter, y + (rand() - 0.5) * 2 * jitter]);

  let dense = catmull(pts, closed);
  if (closed && overshoot > 0) {
    // unroll the loop and keep going past the start — ends never quite meet
    const extra = Math.max(2, Math.floor(dense.length * overshoot));
    dense = dense.concat(dense.slice(1, extra));
  }
  const s = resample(dense, step);
  const n = noise1D(rand);
  const off = rand() * 50;

  const out = s.map((p, i): Pt => {
    const a = s[Math.max(0, i - 1)]!, b = s[Math.min(s.length - 1, i + 1)]!;
    let nx = -(b[1] - a[1]), ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l; ny /= l;
    const k = amp * n(off + (i * step) / wave);
    return [p[0] + nx * k, p[1] + ny * k];
  });
  return toPath(out);
}

/** Straight-ish stroke between two points with a little sag. */
export function line(a: Pt, b: Pt, o: WobbleOptions & { sag?: number } = {}): string {
  const sag = o.sag ?? 0;
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const mid: Pt = [mx + (-dy / l) * sag, my + (dx / l) * sag];
  return wobble([a, mid, b], { jitter: 0.6, ...o });
}

/** Loose ellipse drawn in one go (overshooting). */
export function ellipse(cx: number, cy: number, rx: number, ry: number, o: WobbleOptions & { k?: number } = {}): string {
  const k = o.k ?? 9;
  const pts: Pt[] = [];
  const start = rng((o.seed ?? 1) + 17)() * Math.PI * 2;
  for (let i = 0; i < k; i++) {
    const a = start + (i / k) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return wobble(pts, { closed: true, ...o });
}

export interface ScribbleOptions {
  cx: number; cy: number; rx: number; ry: number;
  /** stroke direction, radians */
  angle?: number;
  /** distance between zig-zag passes */
  gap?: number;
  seed?: number;
  amp?: number;
}

/** Marker scribble fill inside an ellipse (ref: crude magazine-cover fills). */
export function scribble(o: ScribbleOptions): string {
  const { cx, cy, rx, ry, angle = -0.5, gap = 7, seed = 3, amp = 1.6 } = o;
  const rand = rng(seed);
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const pts: Pt[] = [];
  const rows = Math.max(2, Math.floor((2 * ry) / gap));
  for (let i = 0; i <= rows; i++) {
    const v = -1 + (2 * i) / rows;
    const half = Math.sqrt(Math.max(0, 1 - v * v)) * rx * (0.8 + rand() * 0.25);
    const y = v * ry * 0.92;
    const dir = i % 2 === 0 ? 1 : -1;
    for (const x of [-half * dir, half * dir]) {
      const px = x + (rand() - 0.5) * gap * 0.8;
      const py = y + (rand() - 0.5) * gap * 0.6;
      pts.push([cx + px * cos - py * sin, cy + px * sin + py * cos]);
    }
  }
  return wobble(pts, { seed, amp, wave: 30, step: 6, jitter: 0.5 });
}

export interface FlowerOptions {
  cx: number; cy: number;
  petals: number;
  /** valley radius between petals */
  inner: number;
  /** petal length range */
  len: [number, number];
  /** petal half-width in radians */
  width?: number;
  rotation?: number;
  seed?: number;
  amp?: number;
}

/** One continuous outline of N irregular petals — the "single confident line" flower. */
export function petalFlower(o: FlowerOptions): string {
  const { cx, cy, petals, inner, len, width = 0.32, rotation = 0, seed = 7, amp = 1.4 } = o;
  const rand = rng(seed);
  const pts: Pt[] = [];
  const P = (r: number, a: number): Pt => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  const step = (Math.PI * 2) / petals;
  for (let i = 0; i < petals; i++) {
    const a = rotation + i * step + (rand() - 0.5) * step * 0.35;
    const L = len[0] + rand() * (len[1] - len[0]);
    const w = width * (0.75 + rand() * 0.5);
    const bend = (rand() - 0.5) * 0.25; // petals lean a bit
    pts.push(P(inner * (0.7 + rand() * 0.5), a - step / 2));
    pts.push(P(L * 0.45, a - w * 0.9 + bend * 0.3));
    pts.push(P(L * 0.86, a - w * 0.55 + bend));
    pts.push(P(L, a + bend * 1.2));
    pts.push(P(L * 0.84, a + w * 0.5 + bend));
    pts.push(P(L * 0.42, a + w * 0.85 + bend * 0.3));
  }
  return wobble(pts, { closed: true, seed: seed + 1, amp, wave: 40, step: 6, jitter: 1.2, overshoot: 0.025 });
}

/** Sparse splatter: tiny dots, seasoning not decoration. */
export function splatter(seed: number, count: number, w: number, h: number, colors: string[]) {
  const rand = rng(seed);
  return Array.from({ length: count }, () => {
    const big = rand() > 0.86;
    return {
      x: r1(rand() * w),
      y: r1(rand() * h),
      r: r1(big ? 2.2 + rand() * 2.2 : 0.7 + rand() * 1.3),
      fill: colors[Math.floor(rand() * colors.length)] ?? colors[0]!,
    };
  });
}

/** Organic blob outline (closed, smooth, no overshoot) for UI shapes. */
export function blob(cx: number, cy: number, rx: number, ry: number, seed = 1, irregularity = 0.18, k = 8): string {
  const rand = rng(seed);
  const pts: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2;
    const m = 1 + (rand() - 0.5) * 2 * irregularity;
    pts.push([cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m]);
  }
  const dense = catmull(pts, true, 6);
  return toPath(dense) + 'Z';
}
