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
  /** film grain over the field (scripts/grain.ts): opacity of a static noise layer */
  grainOn: true,
  grain: 0.12,
  /** grain "animation": the compositor jumps the noise layer to random offsets */
  grainAnimated: true,
  grainFps: 12,
  /** grain cell size in CSS px */
  grainSize: 1,
  /** pointer ripple strength (mouse only) */
  ripple: 1,
  /** field canvas size relative to CSS px — the browser stretches it; the field is soft anyway */
  resolution: 0.25,
  fpsCap: 30,
  /** hold idle drawing animations and line boil while the page scrolls */
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
  /** frosted (backdrop-filter) nav; re-blurs the animated canvas every frame — off by default */
  frostBlur: false,

  // ── SVG filters / drawings ──
  /** displacement filter on drawings (the hand wobble); re-runs on every idle-animation frame */
  drawFilter: true,
  boilOn: true,
  boilFps: 10,
  boilScale: 3.4,
  /** idle micro-life of drawings (sway, tail, hop…) */
  lifeOn: true,
  /** sprayed edges as a live SVG filter (true) or pre-rendered mask images (false, cheaper) */
  liveSpray: true,
  sprayScale: 22,
  sprayBlur: 5,
};

export type BgConfig = { -readonly [K in keyof typeof bgDefaults]: (typeof bgDefaults)[K] };
export type Tier = 'high' | 'mid' | 'low';

/**
 * high: desktop / fine pointer.
 * mid:  phones and tablets — smaller field canvas, no SVG filter on drawings.
 * low:  phones with ≤4 GB RAM / ≤4 cores / Save-Data — smallest canvas, 24 fps, 3 octaves,
 *       no idle animation, sprayed edges from pre-rendered masks.
 */
export const tierOverrides: Record<Tier, Partial<BgConfig>> = {
  high: {},
  mid: { resolution: 0.2, drawFilter: false, boilOn: false, ripple: 0 },
  low: { resolution: 0.15, fpsCap: 24, detail: 3, drawFilter: false, boilOn: false, ripple: 0, lifeOn: false, liveSpray: false },
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
