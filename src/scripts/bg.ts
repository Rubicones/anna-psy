/**
 * Runtime settings for everything that sits in the background: the WebGL field,
 * line boil, SVG edge filters, text glow, surface textures.
 *
 * `bgDefaults` are the shipped values. The dev toolbar (dev only) changes them live
 * through `setBg()`; production never does, so these defaults are what users see.
 * Bake tuned values by editing `bgDefaults` (or the matching CSS tokens / ArtDefs).
 *
 * Stored on `window` so every bundle (layout script, toolbar) shares one object.
 */

export const bgDefaults = {
  // ── WebGL field ──
  fieldOn: true,
  fieldPaused: false,
  /** flow speed multiplier */
  speed: 1,
  /** zoom of the noise: bigger = smaller blobs */
  scale: 1.5,
  /** domain-warp strength: 0 = plain fbm clouds, 1 = default swirls */
  warp: 1,
  /** fbm octaves 1–6: fewer = smoother, less fine shimmer */
  detail: 5,
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
  renderScale: 0.66,
  /** canvas resolution cap (device pixel ratio) */
  maxDpr: 1.5,
  fpsCap: 30,
  /** extra CSS blur on the canvas, px */
  canvasBlur: 0,

  // ── CSS layers ──
  /** light pool behind text on the field */
  glowA: 0.5,
  glowBlur: 34,
  pigmentTex: true,
  plaqueTex: true,
  plaqueEdge: true,

  // ── SVG filters ──
  boilOn: true,
  boilFps: 10,
  boilScale: 3.4,
  sprayScale: 22,
  sprayBlur: 5,
  roughScale: 3.5,
};

export type BgConfig = { -readonly [K in keyof typeof bgDefaults]: (typeof bgDefaults)[K] };

declare global {
  interface Window {
    __bg?: BgConfig;
  }
}

export function bg(): BgConfig {
  window.__bg ??= { ...bgDefaults };
  return window.__bg;
}

export function setBg(patch: Partial<BgConfig>): void {
  Object.assign(bg(), patch);
  dispatchEvent(new CustomEvent('bg:change', { detail: patch }));
}

export function onBg(cb: (patch: Partial<BgConfig>) => void): void {
  addEventListener('bg:change', (e) => cb((e as CustomEvent<Partial<BgConfig>>).detail));
}
