/**
 * Runtime settings for everything that sits in the background: the WebGL field,
 * line boil, SVG edge filters, text glow, surface textures.
 *
 * `bgDefaults` are the shipped desktop values; `tierOverrides` lower them for phones and
 * weak devices (the tier is detected by an inline script in BaseLayout → html[data-quality]).
 * The dev toolbar changes settings live through `setBg()`; production never does.
 * Bake tuned values by editing `bgDefaults` / `tierOverrides`.
 *
 * Stored on `window` so every bundle (layout script, toolbar) shares one object.
 */

export const bgDefaults = {
  // ── WebGL field ──
  fieldOn: true,
  fieldPaused: false,
  /** true = smooth Perlin-style gradient noise (no facets), false = the original blockier value noise */
  gradientNoise: true,
  /** flow speed multiplier */
  speed: 1,
  /** zoom of the noise: bigger = smaller blobs */
  scale: 1.5,
  /** domain-warp strength: 0 = plain fbm clouds, 1 = default swirls */
  warp: 1,
  /** fbm octaves 1–6: fewer = smoother, cheaper, less fine shimmer */
  detail: 4,
  /** bright defocused halo mix */
  halo: 0.7,
  /** in-shader film grain — the only full-screen grain layer */
  grainOn: true,
  grain: 0.055,
  grainAnimated: true,
  grainFps: 12,
  /** grain cell size in canvas pixels (1 = finest) */
  grainSize: 1,
  /** pointer ripple strength (mouse only) */
  ripple: 1,
  /** field pass resolution, relative to the canvas (grain is always full canvas res) */
  renderScale: 0.45,
  /** lower the field resolution automatically when frames run late, raise it back when calm */
  adaptive: true,
  /** canvas resolution cap (device pixel ratio); below 1 the browser upscales the canvas */
  maxDpr: 1.25,
  fpsCap: 30,
  /** soft upsampling of the field texture (texels): hides low resolution on weak devices */
  soften: 1,
  /** skip field frames (and line boil) while the page is scrolling — leaves the GPU to page content */
  pauseOnScroll: true,
  /** extra CSS blur on the canvas, px */
  canvasBlur: 0,

  // ── CSS layers ──
  /** light pool behind text on the field */
  glowA: 0.5,
  glowBlur: 160,
  pigmentTex: true,
  plaqueTex: true,
  plaqueEdge: true,
  /** frosted (backdrop-filter) nav; expensive over an animated canvas */
  frostBlur: true,

  // ── SVG filters / drawings ──
  /** displacement filter on drawings (the hand wobble); re-runs on every idle-animation frame */
  drawFilter: true,
  boilOn: true,
  boilFps: 10,
  boilScale: 3.4,
  /** idle micro-life of drawings (sway, tail, hop…) */
  lifeOn: true,
  sprayScale: 22,
  sprayBlur: 5,
  roughScale: 3.5,
};

export type BgConfig = { -readonly [K in keyof typeof bgDefaults]: (typeof bgDefaults)[K] };
export type Tier = 'high' | 'mid' | 'low';

/**
 * high: desktop / fine pointer.
 * mid:  phones and tablets — field at CSS-px resolution, fewer octaves, no SVG filter on
 *       animated drawings, no backdrop blur.
 * low:  phones with ≤4 GB RAM / ≤4 cores / Save-Data — everything above, plus a canvas at
 *       0.6 CSS px, tiny field texture with soft upsampling, 20 fps, 3 octaves, no idle animation.
 */
export const tierOverrides: Record<Tier, Partial<BgConfig>> = {
  high: {},
  mid: {
    maxDpr: 1,
    renderScale: 0.45,
    detail: 4,
    soften: 1.25,
    drawFilter: false,
    boilOn: false,
    frostBlur: false,
    ripple: 0,
  },
  // weak phones: hard cap. The field is soft by nature, so a tiny texture + soft upsampling
  // reads the same, and the GPU/memory budget goes to page content instead.
  low: {
    maxDpr: 0.6,
    renderScale: 0.35,
    detail: 3,
    soften: 2,
    fpsCap: 20,
    grain: 0.035,
    drawFilter: false,
    boilOn: false,
    frostBlur: false,
    ripple: 0,
    lifeOn: false,
  },
};

declare global {
  interface Window {
    __bg?: BgConfig;
    __bgStats?: { dyn: number; frameMs: number; fieldPx: string };
  }
}

export function tier(): Tier {
  const q = document.documentElement.dataset.quality;
  return q === 'low' || q === 'mid' ? q : 'high';
}

/** shipped values for the current device tier */
export function tierDefaults(): BgConfig {
  return { ...bgDefaults, ...tierOverrides[tier()] } as BgConfig;
}

export function bg(): BgConfig {
  window.__bg ??= tierDefaults();
  return window.__bg;
}

export function setBg(patch: Partial<BgConfig>): void {
  Object.assign(bg(), patch);
  dispatchEvent(new CustomEvent('bg:change', { detail: patch }));
}

export function onBg(cb: (patch: Partial<BgConfig>) => void): void {
  addEventListener('bg:change', (e) => cb((e as CustomEvent<Partial<BgConfig>>).detail));
}
