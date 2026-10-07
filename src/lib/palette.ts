/**
 * Single source of truth for colour.
 * - CSS custom properties are generated from `palette` (see BaseLayout → cssVars()).
 * - The WebGL field receives `daytimes` as uniforms.
 * Tune values by eye, but keep the warm/cool relationships.
 */

export const palette = {
  // dominant, warm (~60–70% of coloured area)
  sun: '#F7CB4D',
  orange: '#F39237',
  coral: '#F2735E',
  peach: '#F9C7A5',
  // supporting, cool (breathing space)
  sky: '#8CC4E3',
  turquoise: '#45AFA9',
  mint: '#A9DCC4',
  lavender: '#B8A8E3',
  olive: '#8C9A3E',
  // base + ink
  paper: '#FBF4E8',
  ink: '#2C2620',
  white: '#FFFFFF',
  // accents: tiny splatter dots only
  splatRed: '#E23B2E',
  splatBlue: '#2F5BD6',
  splatGreen: '#3AA54B',
} as const;

export type PaletteName = keyof typeof palette;

/** Extra shades the field needs that aren't part of the UI palette. */
const deepDusk = '#3E4A86';
const duskViolet = '#7A6FB8';
const seaDeep = '#2E8E95';

/**
 * Time of day → five field colours.
 * Order matters to the shader: [base, body, accent, highlight, halo].
 * base = large calm area, halo = brightest soft glow.
 */
export const daytimes = {
  /** hero — warm sea: turquoise water, peach light on it */
  sea: [seaDeep, palette.turquoise, palette.sky, palette.peach, '#FFE7CF'],
  /** about / approaches — meadow: mint, olive, sun-yellow flowers */
  meadow: [palette.olive, palette.mint, '#C9D36A', palette.sun, '#FFF1C2'],
  /** booking / education — sunset: orange, coral, a lavender sky */
  sunset: [palette.lavender, palette.coral, palette.orange, palette.sun, palette.peach],
  /** footer — dusk: lavender into deep blue, one last warm ember */
  dusk: [deepDusk, duskViolet, palette.lavender, palette.coral, palette.peach],
} as const satisfies Record<string, readonly [string, string, string, string, string]>;

export type Daytime = keyof typeof daytimes;
export const daytimeOrder: Daytime[] = ['sea', 'meadow', 'sunset', 'dusk'];

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** `--c-sun: #F7CB4D; …` plus `--c-sun-rgb: 247 203 77` for alpha use. */
export function cssVars(): string {
  return Object.entries(palette)
    .map(([k, v]) => {
      const [r, g, b] = hexToRgb(v);
      return `--c-${kebab(k)}:${v};--c-${kebab(k)}-rgb:${r} ${g} ${b};`;
    })
    .join('');
}

/** `var(--c-splat-red)` for a palette key — use in component props. */
export const colorVar = (name: PaletteName): string => `var(--c-${kebab(name)})`;
