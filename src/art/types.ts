import type { Pt } from '~/lib/wobble';

/**
 * line   → currentColor (set with the `tone` prop, white by default)
 * accent → var(--illo-accent), falls back to line colour
 * fill   → var(--illo-fill), the scribble-fill colour
 */
export type Tone = 'line' | 'accent' | 'fill';

/** Idle micro-life. Keep it rare, small and slow. */
export type Life = 'sway' | 'sway-soft' | 'tail' | 'dip' | 'hop' | 'blink' | 'spin' | 'crawl' | 'bob' | 'beat';

export interface IlloPath {
  d: string;
  tone?: Tone;
  /** stroke width multiplier, 1 = the shared marker weight */
  w?: number;
  /** only rendered when the `filled` prop is on (scribble fills) */
  fillOnly?: boolean;
}

export interface IlloGroup {
  life?: Life;
  /** transform-origin in viewBox units */
  origin?: Pt;
  /** animation delay, seconds */
  delay?: number;
  paths: IlloPath[];
}

export interface IlloDef {
  w: number;
  h: number;
  /** Russian alt text, used only when the drawing is meaningful (not decorative) */
  alt: string;
  groups: IlloGroup[];
}

/** Every drawing is a function of a variant seed: same name, different hand. */
export type IlloFactory = (variant: number) => IlloDef;
