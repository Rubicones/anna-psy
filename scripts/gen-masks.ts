/**
 * Generates the sprayed-edge mask images in src/styles/masks/.
 * Run: npx esbuild scripts/gen-masks.ts --bundle --platform=node --format=esm --outfile=scripts/.gen.mjs && node scripts/.gen.mjs && rm scripts/.gen.mjs
 *
 * Why masks: an SVG used as an *image* is rasterised once and cached as a bitmap, while a CSS
 * `filter: url(#spray)` on an element re-runs blur + turbulence + displacement every time that
 * element's tiles are rasterised (scrolling, repaints) — the main cause of late/missing content.
 */
import { writeFileSync } from 'node:fs';
import { wobble, type Pt } from '../src/lib/wobble';

const S = 200;
const shapes: Record<string, Pt[]> = {};

// round blobs a/b/c: irregular ellipses
const roundish = (seed: number, irr: number, k: number, rx = 78, ry = 76): Pt[] => {
  let a = seed;
  const rand = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: k }, (_, i) => {
    const t = (i / k) * Math.PI * 2;
    const m = 1 + (rand() - 0.5) * 2 * irr;
    return [100 + Math.cos(t) * rx * m, 100 + Math.sin(t) * ry * m] as Pt;
  });
};
shapes.a = roundish(11, 0.12, 8);
shapes.b = roundish(29, 0.15, 7, 80, 74);
shapes.c = roundish(53, 0.13, 9, 76, 79);
// panel: soft superellipse for content blobs (keeps text corners inside)
shapes.panel = Array.from({ length: 24 }, (_, i) => {
  const t = (i / 24) * Math.PI * 2;
  const c = Math.cos(t), s = Math.sin(t);
  const n = 4.5;
  const x = Math.sign(c) * Math.abs(c) ** (2 / n) * 84;
  const y = Math.sign(s) * Math.abs(s) ** (2 / n) * 82;
  return [100 + x, 100 + y] as Pt;
});

const variants = {
  '': { blur: 3.5, disp: 16 }, // sprayed edge
  '-soft': { blur: 11, disp: 14 }, // defocused + sprayed
};

for (const [name, pts] of Object.entries(shapes)) {
  const d = wobble(pts, { closed: true, overshoot: 0, amp: name === 'panel' ? 0.8 : 1.4, wave: 60, step: 6, jitter: 0.5, seed: name.length * 7 });
  for (const [suffix, v] of Object.entries(variants)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" preserveAspectRatio="none">
<filter id="s" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="8" result="n"/>
<feGaussianBlur in="SourceGraphic" stdDeviation="${v.blur}" result="b"/>
<feDisplacementMap in="b" in2="n" scale="${v.disp}" xChannelSelector="R" yChannelSelector="G"/>
</filter>
<path d="${d}" fill="#fff" filter="url(#s)"/>
</svg>
`;
    writeFileSync(new URL(`../src/styles/masks/spray-${name}${suffix}.svg`, import.meta.url), svg);
  }
}
console.log('masks written');
