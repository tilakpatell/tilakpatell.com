// The levels of detail generated space is drawn in, by how far off a thing
// is (the design's section A):
//
//   within its reach        built in full: the star and its light, planets
//                           on their orbits, moons and rings (near.js)
//   within the far plane    a disc of its true size (discs.js, farStars')
//   past it, in the 3×3×3   a speck in its colour, falling off as the square
//   past the 3×3×3          the rings beyond, fading to nothing at their edge
//
// A change of level fades, never pops: each hand-over is a smoothstep over
// the last fifth of the way in (FADE, farStars' own). The disc is the body's
// true size, so where it hands to the built body nothing shows or goes; it
// grows in from a speck over the far plane's last 9,000 units. Pure (no
// three.js, no DOM), so it runs in Node and in a worker.
//
// FAR, FADE, and the far stars' REAL_REACHES, REAL_LEAST, BRIGHT_AT and
// SPECK_LEAST: the numbers, for a shader to take as they are
// realAt({ reach | r }) → where a far place is real: farStars' rule
// levelWeights(dist, { reach, far = FAR }, out?) → { full, disc, speck },
//   summing to 1; `out` is filled and returned, so a frame allocates none
// discPx(dist, r, { fovY, height }) → a disc's pixels across; fovY is the
//   camera's vertical field in degrees (three's camera.fov), height its
//   pixels
// speckBright(dist, r) → 0.06 … 1: (4 · realAt(r) / dist)², clamped
// beyondFade(dist, edge) → 1 within 0.8 of the edge, 0 at it and past

export const FAR = 45000; // the universe camera's far plane (scene.js)
export const FADE = 0.2; // a hand-over takes the last fifth of the way in
export const REAL_REACHES = 20; // a far place is real within this many of its reaches
export const REAL_LEAST = 1500; // and never less
export const BRIGHT_AT = 4; // a speck is full bright within this many of where it's real
export const SPECK_LEAST = 0.06; // and never dimmer than this

export const realAt = ({ reach, r }) => Math.max(REAL_LEAST, (reach ?? r) * REAL_REACHES);

// 1 nearer than the last fifth before `edge`, 0 at it and past, smoothstep
// between; with no edge (none, 0 or NaN), 0
function inside(dist, edge) {
  const from = edge * (1 - FADE);
  if (!(edge > from)) return dist < edge ? 1 : 0;
  const t = Math.min(1, Math.max(0, (dist - from) / (edge - from)));
  return 1 - t * t * (3 - 2 * t);
}

export function levelWeights(dist, { reach, far = FAR }, out = { full: 0, disc: 0, speck: 0 }) {
  const full = inside(dist, reach);
  const rest = 1 - full;
  const disc = rest * inside(dist, far);
  out.full = full;
  out.disc = disc;
  out.speck = rest - disc;
  return out;
}

export const discPx = (dist, r, { fovY, height }) => ((2 * r) / (2 * Math.max(dist, 1e-6) * Math.tan((fovY * Math.PI) / 360))) * height;

export function speckBright(dist, r) {
  const k = (BRIGHT_AT * realAt({ r })) / Math.max(dist, 1e-6);
  return Math.min(1, Math.max(SPECK_LEAST, k * k));
}

export const beyondFade = (dist, edge) => inside(dist, edge);
