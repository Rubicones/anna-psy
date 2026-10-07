/**
 * Writes the colour-shape art files from src/lib/spray.ts (`sprayDefaults`):
 *   src/styles/masks/core-*, halo-*, *-soft, speck  — sprayed-edge mask layers
 *   src/styles/textures/pigment.svg                  — pigment texture inside colour shapes
 * Run: npx esbuild scripts/gen-masks.ts --bundle --platform=node --format=esm --outfile=scripts/.gen.mjs && node scripts/.gen.mjs && rm scripts/.gen.mjs
 *
 * A sprayed colour shape = three mask layers, no live filters (see .spray-shape in global.css):
 *   core  : the shape with a softly blurred edge   — stretched to the element
 *   halo  : the same shape, larger, very blurred    — stretched to the element
 *   speck : a tile of sparse spray dots             — tiled at fixed px size, never stretched
 * mask = core ∪ (halo ∩ speck). Every image is rasterised once and cached.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildMasks, buildPigment, sprayDefaults } from '../src/lib/spray';

const masksDir = new URL('../src/styles/masks/', import.meta.url);
mkdirSync(masksDir, { recursive: true });
for (const [name, svg] of Object.entries(buildMasks(sprayDefaults))) writeFileSync(new URL(`${name}.svg`, masksDir), svg);
writeFileSync(new URL('../src/styles/textures/pigment.svg', import.meta.url), buildPigment(sprayDefaults));
console.log('masks + pigment written');
