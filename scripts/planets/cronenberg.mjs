// Cronenberg World's coasts. It's the Earth Rick and Morty left behind in
// "Rick Potion #9", C-137's own, so its flesh lies on the real continents
// (Natural Earth's, through earth.mjs), as C-137's sea and land do; the
// flesh itself, its veins and lumps and the murky sea, are worked out in its
// shader (rmWorldsGlsl.js's cronenberg), which reads this for where the land is.
//
// Makes cronenberg-land at 1024: the land white on black, softened about
// two degrees either side of the coast, so the shader can push the coast
// about (the show's lumpy coasts, the land breathing) and still find it.

import { save } from './sphere.mjs';
import { landField } from './earth.mjs';

const [W, H] = [2048, 1024];

export async function bake() {
  console.log('Cronenberg World: tracing the coasts');
  // (a blur of 12 texels at 2048 is about two degrees)
  const land = await landField(W, H, 12);
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = land[i] / 255;
  await save(out, W, H, 1, 'cronenberg-land', [[1024, '']], { quality: 90 });
}
