// The scene's fixed numbers: the times of day and their light, the camera's
// seat, Mark's suit floor, the light that follows him, the hard landing's
// pose, and a ray against a box. Moved from ./scene.js as they were, so
// that file stays under the size rule; nothing drawn changed.
import * as THREE from 'three';

// the times of day: the sky, how it sits, the light, the haze, the night,
// the light that follows Mark (`spot`) and the rim round the cast (`rim`).
// The haze takes the sky photo's colour at the horizon (skyBands); a fog's
// `tint` or `color` is only for a photo that can't be read.
export const TIMES = ['noon', 'dusk', 'night'];
export const LOOK = {
  noon: { sky: 'noon', rotate: 0.6, env: 1.15, bg: 1, sun: 4.2, fill: 0.3, fog: { density: 0.00026, tint: 0.95 }, night: 0, exposure: 1, spot: 0, rim: 0.35, cloud: { lit: [1, 1, 1], shade: [0.62, 0.66, 0.74] } },
  dusk: { sky: 'dusk', rotate: 2.2, env: 0.62, bg: 1, sun: 2.6, sunColor: [1, 0.66, 0.4], fill: 0.16, fog: { density: 0.0003, tint: 0.7 }, night: 0.5, exposure: 1, spot: 20, rim: 0.7, cloud: { lit: [1, 0.74, 0.52], shade: [0.42, 0.36, 0.42] } },
  night: { sky: 'night', rotate: 0, env: 0.22, bg: 0.2, sun: 0.7, sunDir: [-0.3, 0.75, -0.4], sunColor: [0.62, 0.72, 1], fill: 0.4, fog: { density: 0.00024, color: new THREE.Color(0.05, 0.06, 0.08) }, night: 1, exposure: 1, spot: 45, rim: 1.2, cloud: { lit: [0.14, 0.16, 0.22], shade: [0.06, 0.07, 0.1], opacity: 0.7 } },
};

// The camera hovering or standing: `back` metres behind him, `pull` more
// flat out (the pull-back with speed, as it was), aimed so his feet sit
// `feet` of the screen's height up from its bottom. Close enough that he's
// a third of the frame tall, the one thing on it the player has to find
// (at FOV 64 that's 3.6 m; from further his black and blue were a few
// pixels wide against the street). Leaning into a flight, it aims `ahead`
// metres past him instead, as it always has (his feet trail behind him then).
export const CAM = { back: 3.6, pull: 1.5, feet: 0.35, ahead: 4, over: 0.9, overFoot: 0.7 };

// His suit: the atlas's black, raised to `floor` (people.js castMaterial),
// the show's navy, which keeps his arms and legs on a dark street or at night.
export const SUIT = { floor: 0x2a3754 };

// The light that follows him: from over the camera's shoulder, `back`
// metres toward the camera and `up` over his chest, at his chest. Warm
// white, `range` metres, so it lights him, and the street in a disc round
// his feet when he's down near it, and not the city. Never off, only dark
// (its intensity is the time's `spot`): a light switched on and off would
// recompile every lit material in the city at the turn of the time.
export const SPOT = { color: 0xffeedd, range: 12, angle: 0.5, penumbra: 0.6, back: 2, up: 2.2, chest: 1.25 };

// Down on one knee, a fist on the ground: how a hard landing ends.
export const LAND = {
  thighL: [0.1, -0.3, 0.95],
  calfL: [0.05, -1, -0.05],
  footL: [0, -0.3, 1],
  thighR: [-0.1, -1, -0.2],
  calfR: [-0.05, -0.12, -1],
  footR: [0, -0.2, -1],
  armR: [-0.15, -1, 0.4],
  foreR: [-0.05, -1, 0.1],
  armL: [0.65, -0.15, -0.7],
  foreL: [0.5, 0.15, -0.85],
  torso: { pitch: 0.55, yaw: 0.1, roll: 0 },
};

// a ray against a box: how far along (0…1) it first goes in, or 1
export function rayBox(o, d, b) {
  let t0 = 0;
  let t1 = 1;
  const lo = [b.x0, b.y0, b.z0];
  const hi = [b.x1, b.y1, b.z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) {
      if (o[a] < lo[a] || o[a] > hi[a]) return 1;
      continue;
    }
    let ta = (lo[a] - o[a]) / d[a];
    let tb = (hi[a] - o[a]) / d[a];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return 1;
  }
  return t0;
}

