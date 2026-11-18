// Where the parts of a thing in space go when it's drawn near: a field's
// rocks, a rig's haulers, a comet's coma and tail, a herd's creatures, a
// pulsar's beams, a fleet's ships. Pure (no three.js), each seeded from the
// row's own seed so it's the same every visit, and every motion on the
// shared clock reduced by frac(t / period) before it's an angle, so a clock
// at epoch seconds keeps its precision.
//
// ANCHOR: the cell a drawer's meshes sit at (anchorOf), so an instance's numbers stay small
// weightOf(dist, size, reach = THING_NEAR × size) → 0 … 1: how much of a near thing is drawn,
//   1 within 0.8 of its reach, nothing past it, so nothing pops in
// anchorOf([x, y, z]) → each rounded to ANCHOR: where a drawer's meshes sit, in doubles
// seededRng(seed) → () => [0, 1)
// fieldRocks(row, n) → [{ x, y, z, r, shape }] from the field's middle: a flattened ball of
//   its size, none within 0.12 × size of the middle (a park there is clear), radii 0.3 to 3
//   on the lane's scale × size / 120, shape 0 … 2
// rigHaulers(row, n, t) → [{ at, heading }]: haulers out from the rig to its field's edge
// cometParts(row, t) → { head, coma, tail: { dir, length } }
// herdBodies(row, n, t) → [{ at, heading, k }]: creatures strung behind the herd's place on its loop
// beamDirs(traits, t) → [[x, y, z], [x, y, z]]: a pulsar's two beams, swept about its spin
// blink(seed, t, period = 2.4) → 0 … 1: a beacon's lamp

import { THING_NEAR, pathAt, rowAt, tailOf } from '../../expanse/shared/gen';
import { levelWeights } from '../../expanse/shared/levels';

export const ANCHOR = 4096;
const TAU = 2 * Math.PI;
const frac = (x) => x - Math.floor(x);

export const weightOf = (dist, size, reach = THING_NEAR * size) => levelWeights(dist, { reach }).full;

export const anchorOf = (p) => [Math.round(p[0] / ANCHOR) * ANCHOR, Math.round(p[1] / ANCHOR) * ANCHOR, Math.round(p[2] / ANCHOR) * ANCHOR];

export function seededRng(seed) {
  let s = Number(BigInt.asUintN(32, BigInt(seed ?? 1))) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fieldRocks(row, n) {
  const rng = seededRng(row.seed);
  const out = [];
  const hole = 0.12 * row.size;
  while (out.length < n) {
    const x = (rng() * 2 - 1) * row.size;
    const y = (rng() * 2 - 1) * row.size * 0.35;
    const z = (rng() * 2 - 1) * row.size;
    const e = (x * x + z * z) / (row.size * row.size) + (y * y) / (row.size * 0.35) ** 2;
    if (e > 1 || Math.hypot(x, y, z) < hole) continue;
    const u = rng();
    out.push({ x, y, z, r: 0.3 + 2.7 * u * u * u, shape: Math.floor(rng() * 3) });
  }
  return out;
}

export function rigHaulers(row, n, t) {
  const rng = seededRng(row.seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * TAU;
    const period = 90 + rng() * 60;
    const reach = row.size * (1.5 + rng() * 2);
    const f = frac(t / period + rng());
    const k = 0.5 - 0.5 * Math.cos(f * TAU); // (out and back)
    const d = row.size * 0.6 + reach * k;
    out.push({ at: [row.at[0] + Math.cos(a) * d, row.at[1] + (rng() - 0.5) * row.size * 0.4, row.at[2] + Math.sin(a) * d], heading: f < 0.5 ? a : a + Math.PI });
  }
  return out;
}

export function cometParts(row, t) {
  const head = rowAt(row, t);
  return { head, coma: 4 * row.size, tail: tailOf(row, t) };
}

export function herdBodies(row, n, t) {
  const out = [];
  const rng = seededRng(row.seed);
  // (strung back along the loop, a few hundred apart, each bobbing a little)
  const per = row.path ? (2 * Math.PI * row.path.radius * row.path.revs) / 65536 : 0;
  for (let i = 0; i < n; i++) {
    const lag = (i * row.size * 2.2) / Math.max(per, 1e-6);
    const at = row.path ? pathAt(row.path, t - lag) : row.at;
    const ahead = row.path ? pathAt(row.path, t - lag + 5) : row.at;
    const side = (rng() - 0.5) * row.size * 1.5;
    const bob = Math.sin(TAU * frac(t / (9 + i)) + i) * row.size * 0.15;
    out.push({ at: [at[0] + side, at[1] + bob, at[2] - side * 0.5], heading: Math.atan2(ahead[0] - at[0], ahead[2] - at[2]), k: 0.6 + rng() * 0.6 });
  }
  return out;
}

export function beamDirs(traits, t) {
  const [sx, sy, sz] = traits.spin;
  // (a beam leans 0.5 rad off the spin and goes round it once a period)
  const ax = Math.abs(sx) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let u = [sy * ax[2] - sz * ax[1], sz * ax[0] - sx * ax[2], sx * ax[1] - sy * ax[0]];
  const ul = Math.hypot(...u);
  u = u.map((v) => v / ul);
  const w = [sy * u[2] - sz * u[1], sz * u[0] - sx * u[2], sx * u[1] - sy * u[0]];
  const a = TAU * frac(t / traits.period);
  const lean = 0.5;
  const d = [0, 1, 2].map((k) => Math.cos(lean) * traits.spin[k] + Math.sin(lean) * (Math.cos(a) * u[k] + Math.sin(a) * w[k]));
  return [d, d.map((v) => -v)];
}

export function blink(seed, t, period = 2.4) {
  const f = frac(t / period + Number(BigInt.asUintN(16, BigInt(seed ?? 0))) / 65536);
  return f < 0.12 ? 1 : 0.15;
}
