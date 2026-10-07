import { bird, cat, heron, snail } from './illustrations/animals';
import { chamomile, fern, grassTuft, sevenPetal, tulip } from './illustrations/plants';
import { heart, moon, star, sun } from './illustrations/things';
import type { IlloFactory } from './types';

/**
 * The illustration library. Add a drawing = write a factory + register it here.
 * Phase 1 set; the rest (frog, fish, butterfly/bee, more plants) lands with the sections that need them.
 */
export const illustrations = {
  sevenPetal,
  chamomile,
  tulip,
  fern,
  grassTuft,
  cat,
  heron,
  snail,
  bird,
  sun,
  moon,
  star,
  heart,
} satisfies Record<string, IlloFactory>;

export type IlloName = keyof typeof illustrations;
export type { IlloDef, IlloGroup, IlloPath, Life, Tone } from './types';
