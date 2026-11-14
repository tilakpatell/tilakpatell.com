// How each generated body is drawn by how far off it is: built whole within
// its reach, a disc of its true size out to the far plane, a speck of its
// star's light past it inside the 3 × 3 × 3 of sectors round the ship, and
// past those the beyond rings, fading to nothing at their edge. Each level
// hands over to the next over the last fifth of the way, as farStars.js's
// places do, so nothing pops. Pure: no three.js.
//
// FAR (scene.js's far plane), FADE (the share of the way a hand-over takes)
// levelWeights(dist, { reach, far = FAR }) → { full, disc, speck }, summing
//   to 1: full and disc are the same body at the same size, so their
//   hand-over is a crossfade; the disc and the speck's is the one a visitor
//   could see, and is slow (a fifth of the far plane, 9,000 units)
// discPx(dist, r, { fov, height }) → how many pixels across a ball of radius
//   r is at dist, with a vertical field of view `fov` in degrees (three's)
//   on a screen `height` pixels tall
// speckBright(dist, r) → 0.06 … 1: a star's speck, bright within four
//   times where its place is real (farStars.js's realAt) and falling off
//   with the square of the distance past it
// beyondFade(dist, edge) → 1 within 0.8 of the edge, 0 at it

export const FAR = 45000;
export const FADE = 0.2;
const REAL_REACHES = 20; // (farStars.js's: a place is real within this many of its reaches)
const REAL_LEAST = 1500;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function levelWeights(dist, { reach, far = FAR }) {
  const full = 1 - smoothstep(reach * (1 - FADE), reach, dist);
  const disc = (1 - full) * (1 - smoothstep(far * (1 - FADE), far, dist));
  return { full, disc, speck: 1 - full - disc };
}

export const discPx = (dist, r, { fov, height }) => ((2 * r) / (2 * Math.max(dist, r) * Math.tan((fov * Math.PI) / 360))) * height;

export const realAt = (r) => Math.max(REAL_LEAST, r * REAL_REACHES);

export function speckBright(dist, r) {
  const k = (4 * realAt(r)) / Math.max(dist, 1);
  return Math.min(1, Math.max(0.06, k * k));
}

export const beyondFade = (dist, edge) => 1 - smoothstep(0.8 * edge, edge, dist);
