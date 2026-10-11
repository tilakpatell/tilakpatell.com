// LOD without a pop (GPU-first lane N1): for FADE seconds after a row's file
// changes, the cull lists it in both files (cull.js), and each draw keeps
// the pixels its side of a dither owns. The incoming file keeps a pixel
// whose noise is under t (the fade's share, 0 → 1 over FADE), the outgoing
// one the rest, so between them every pixel is drawn once, never twice and
// never left open; TRAA's history blends the dither into a crossfade. The
// noise is Jimenez's interleaved gradient noise (2014, "Next generation
// post processing in Call of Duty: Advanced Warfare"): no texture, even,
// and made for a temporal resolve.
//
//   fadeAlpha(age, duration = FADE) → t in 0…1
//   ign(x, y) → noise in 0…1 at a pixel; keeps(noise, t, incoming) → boolean
//   fadeNodes(tsl, { age, incoming, duration }) → { keep } (the fragment's bool, from vertex varyings)

import { FADE } from './cull.js';

export const fadeAlpha = (age, duration = FADE) => Math.min(1, Math.max(0, age / duration));

const fract = (v) => v - Math.floor(v);
export const ign = (x, y) => fract(52.9829189 * fract(0.06711056 * x + 0.00583715 * y));

export const keeps = (noise, t, incoming) => (incoming ? noise < t : noise >= t);

// age and incoming are vertex-stage nodes (a float and a 0/1 float); the
// share passes to the fragment as a varying and the noise is the pixel's
export function fadeNodes(tsl, { age, incoming, duration }) {
  const { varying, vec2, clamp, fract, screenCoordinate, float, select } = tsl;
  const v = varying(vec2(clamp(age.div(duration), 0, 1), incoming), 'vGpuFade');
  const noise = fract(float(52.9829189).mul(fract(screenCoordinate.x.mul(0.06711056).add(screenCoordinate.y.mul(0.00583715)))));
  const keep = select(v.y.greaterThan(0.5), noise.lessThan(v.x), noise.greaterThanEqual(v.x));
  return { keep, share: v };
}
