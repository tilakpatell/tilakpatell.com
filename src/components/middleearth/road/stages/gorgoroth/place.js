// Where things stand on Gorgoroth, in the stage's frame (the lane along +z,
// x = 0): Mount Doom, the Mount Doom chapter's own mountain, ahead and to
// the right, its western road turned toward the walkers, filling the sky as
// they come; the orc column on the road; the rock the two wait on; and,
// far under the plain (the cut takes the camera there), the Sammath Naur,
// its spur running out along the lane over the Crack of Doom. Pure.
//
//   MOUNT: { at, turn }: the mountain's foot-middle and its turn about y
//   CHAMBER: { at, turn }: the Sammath Naur's door (its spur runs +z from it)
//   SPUR: { y, door, tip }: the spur's top, and where along the lane it runs
//   CRACKS: { frodo, sam, gollum: [x, z], camera, look }: the Cracks' places
//   COLUMN: the orcs' road beside the lane (columns.js's rankAt)
//   REFUGE: [x, z]: the rock in the fire
//   sweep(t) → [x, z]: where the Eye's beam touches the plain, t s into its beat
//   CAMPS: [x, z]: the orc camps off the road, their fires burning
//   strewn(seed, n, { near, far }) → [[x, z, scale, turn]]: ash boulders on the plain,
//     off the lane and the column's road, clear of the camps, short of the Mountain's slope
//   fissures(seed, n) → [[[x, z], …]]: the cracks glowing in the plain, none across the lane

export const MOUNT = { at: [70, -24, 620], turn: -Math.PI / 2 };
export const CHAMBER = { at: [0, -200, 122], turn: -Math.PI / 2 };
const TIP = 14; // m: the spur's length (the chapter's sammathNaur)
export const SPUR = { y: CHAMBER.at[1], door: CHAMBER.at[2], tip: CHAMBER.at[2] + TIP };

export const CRACKS = {
  frodo: [0, SPUR.tip - 1.2],
  sam: [0, SPUR.tip - 5.6],
  gollum: [0, SPUR.tip - 3.2],
  // (low on the spur behind Sam, along it to Frodo at its broken tip over the fire)
  camera: [-2.6, SPUR.y + 1.7, SPUR.door + 5.5],
  look: [0, SPUR.y + 1, SPUR.tip - 1.2],
};

export const COLUMN = { from: [3.6, -24], to: [3.6, 92], files: 2, gap: 1.9, spacing: 1.15, speed: 1.6 };
export const REFUGE = [3.2, 158];

const BEAM_AT = 52; // m: the beam's beat
const SWEEP = [-70, 70]; // m across the plain the beam's spot runs
const SECONDS = 10;
export function sweep(t) {
  const k = Math.min(1, Math.max(0, t / SECONDS));
  return [SWEEP[0] + (SWEEP[1] - SWEEP[0]) * k, BEAM_AT + 6 + 6 * Math.sin(k * Math.PI)];
}

export const CAMPS = [
  [-44, 36],
  [54, 76],
];
const PLAIN = { from: -20, to: 92, lane: 6, camp: 10 }; // m: along the lane, off it, round a camp

// a seeded 0…1, the same on every load
const rngOf = (seed) => {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};
const off = (x, z) => Math.abs(x) >= PLAIN.lane && !CAMPS.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < PLAIN.camp);

export function strewn(seed, n, { near = PLAIN.lane, far = 70 } = {}) {
  const r = rngOf(seed);
  const out = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const side = r() < 0.5 ? -1 : 1;
    // (thicker near the lane, thinning out: a square's spread)
    const u = r();
    const x = side * (near + u * u * (far - near));
    const z = PLAIN.from + r() * (PLAIN.to - PLAIN.from);
    if (off(x, z)) out.push([x, z, 0.5 + r() * r() * 2.2, r() * Math.PI * 2]);
  }
  return out;
}

export function fissures(seed, n) {
  const r = rngOf(seed);
  const out = [];
  for (let tries = 0; out.length < n && tries < n * 10; tries++) {
    const side = r() < 0.5 ? -1 : 1;
    // (most of them near the road, where the walkers see them past the boulders)
    const u = r();
    let x = side * (PLAIN.lane + 1.5 + u * u * 36);
    let z = PLAIN.from + 10 + r() * (PLAIN.to - PLAIN.from - 10);
    let a = r() * Math.PI * 2;
    const line = [];
    for (let k = 0, steps = 5 + Math.floor(r() * 8); k < steps && off(x, z); k++) {
      line.push([x, z]);
      a += (r() - 0.5) * 1.1;
      x += Math.cos(a) * 1.6;
      z += Math.sin(a) * 1.6;
    }
    if (line.length >= 4) out.push(line);
  }
  return out;
}

