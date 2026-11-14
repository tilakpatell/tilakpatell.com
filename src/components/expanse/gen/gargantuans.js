// Gargantuans: a class of place 20 to 200 times a planet's size, seen from
// across a sector, one in exactly one sector of every 3 × 3 × 3 (spec C).
// A sector holds one when its coordinates match the universe's three
// residues mod 3, never all nought, so the core never does and any 3 × 3 × 3
// holds exactly one. Pure (no three.js).
//
// GARGANTUAN_FORMS: hole, arc, hulk, giant, dyson, equally likely
// GARGANTUAN = { far, tries, home, systems }: far is the camera's far plane (45,000; restated:
//   the generator imports nothing of expanse/scene), so a gargantuan keeps that plus its size
//   off every hand-made place and its mesh is never built at a baseline pose; systems is how
//   much more than its size appended systems keep off it
// FORM_SIZES: each form's numbers (size is the whole extent; body what's solid)
// residuesOf(universe) → [a, b, c]; hasGargantuan(universe, sx, sy, sz) → boolean
// formOf(universe, sx, sy, sz) → form: the first draw of the sector's own rng, no sector made
// gargantuanOf(universe, sx, sy, sz, legacy: { systems, wonders, beacons }) → row | null:
//   { kind: form, gargantuan: true, name, at, size, body, band?, span?, mid?, axis, light,
//   colors: [hex, hex], seed }, darted in the cube CUBE_HALF − size round the sector's middle,
//   clear of every row of KEEP_OUTS by far + size (all of them, not keepOutsNear's, which for
//   five of the core's six face neighbours is empty), of the legacy systems by their reach +
//   size + 2,000, of the legacy wonders by their size + size and of the beacons by 3,000 + size
// gargantuanKeeps(row) → [{ at, r }]: its solid parts as spheres, which the appended systems'
//   neighbours, the lattice and the lists keep off
// arcPoints(row, step) → [[x, y, z]]: points along a ringworld arc's band
// ARRIVAL_BASE (w4), ARRIVAL_MAX (1), ARRIVAL_GARGANTUANS (lane 4c's hand-placed row, [] until
//   it comes): the arrival's, in the shared universe's core. One at most, so the core keeps spec
//   C's "at most one a sector" (it never holds a generated one)
// checkGargantuan(row) → row, or a TypeError for a form not in the list, a non-finite `at`, a
//   size outside 20 to 200 planets or no axis
// gargantuanSectors(universe, from, { form = null, n = 1, ring = 12 }) → the nearest n sectors
//   holding one of that form (any, if null), out to Chebyshev `ring`, nearest first (ties by key)

import { sectorCentre, sectorKey } from '../../../lib/space/address.js';
import { PLANET_SIZE, hexOf } from './catalogue';
import { CUBE_HALF } from './cube';
import { KEEP_OUTS, clearOfKeepOuts } from './keepOuts';
import { nameOf } from './names';
import { hash64, range, rngOf, sectorSeedOf } from './seed';
import { tint } from '../../universe/shared/space';

export const GARGANTUAN_FORMS = Object.freeze(['hole', 'arc', 'hulk', 'giant', 'dyson']);
export const GARGANTUAN = Object.freeze({ far: 45000, tries: 200, home: 20000, systems: 2000 });
export const FORM_SIZES = Object.freeze({
  hole: { body: [300, 650], k: [9, 13] },
  arc: { size: [3000, 7500], band: [150, 400], span: [0.5 * Math.PI, 1.2 * Math.PI] },
  hulk: { size: [1200, 2800] },
  giant: { size: [1800, 3000] },
  dyson: { size: [1500, 4000], body: [150, 300] },
});
export const ARRIVAL_BASE = 4;
export const ARRIVAL_MAX = 1;
export const ARRIVAL_GARGANTUANS = Object.freeze([]);

const mod3 = (v) => ((v % 3) + 3) % 3;
const sphere = (rng) => {
  const z = rng() * 2 - 1;
  const a = rng() * 2 * Math.PI;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a), z];
};
const far = (a, b, r) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 >= r * r;

export function residuesOf(universe) {
  const h = hash64(universe, 'gargantuans');
  const r = [Number(h % 3n), Number((h >> 8n) % 3n), Number((h >> 16n) % 3n)];
  if (!r[0] && !r[1] && !r[2]) r[2] = 1;
  return r;
}

const residues = new Map();
export function hasGargantuan(universe, sx, sy, sz) {
  const k = String(universe);
  let r = residues.get(k);
  if (!r) residues.set(k, (r = residuesOf(universe)));
  return mod3(sx) === r[0] && mod3(sy) === r[1] && mod3(sz) === r[2];
}

const rngFor = (universe, sx, sy, sz) => rngOf(hash64(sectorSeedOf(universe, sx, sy, sz), 'gargantuan'));
const formIn = (rng) => GARGANTUAN_FORMS[Math.floor(rng() * GARGANTUAN_FORMS.length)];
export const formOf = (universe, sx, sy, sz) => formIn(rngFor(universe, sx, sy, sz));

const GIANT_TINTS = ['sun', 'bone', 'shot', 'engine', 'nebula'];
function colorsOf(form, rng) {
  if (form === 'hole') return [hexOf(tint('sun', 0)), hexOf(tint('shot', 0.1))];
  if (form === 'arc') return [hexOf(tint('bone', 0)), hexOf(tint('engine', 0.3))];
  if (form === 'hulk') return [hexOf(tint('grey', 0)), hexOf(tint('shot', 0))];
  if (form === 'dyson') return [hexOf(tint('sun', 0)), hexOf(tint('star', 0))];
  const a = Math.floor(rng() * GIANT_TINTS.length);
  const b = (a + 1 + Math.floor(rng() * (GIANT_TINTS.length - 1))) % GIANT_TINTS.length;
  return [hexOf(tint(GIANT_TINTS[a], 0.2)), hexOf(tint(GIANT_TINTS[b], 0.2))];
}

function shapeOf(form, rng) {
  const f = FORM_SIZES[form];
  if (form === 'hole') {
    const body = range(rng, ...f.body);
    return { size: body * range(rng, ...f.k), body };
  }
  if (form === 'arc') {
    const size = range(rng, ...f.size);
    const band = range(rng, ...f.band);
    return { size, body: band, band, span: range(rng, ...f.span), mid: rng() * 2 * Math.PI };
  }
  if (form === 'hulk') {
    const size = range(rng, ...f.size);
    return { size, body: 0.12 * size };
  }
  if (form === 'giant') {
    const size = range(rng, ...f.size);
    return { size, body: size };
  }
  return { size: range(rng, ...f.size), body: range(rng, ...f.body) };
}

export function gargantuanOf(universe, sx, sy, sz, legacy = {}) {
  if (!hasGargantuan(universe, sx, sy, sz)) return null;
  const rng = rngFor(universe, sx, sy, sz);
  const form = formIn(rng);
  const shape = shapeOf(form, rng);
  const axis = sphere(rng);
  const light = sphere(rng);
  const colors = colorsOf(form, rng);
  const n = nameOf(rng, 'core');
  const name = n[0].toUpperCase() + n.slice(1);
  const origin = sectorCentre(sx, sy, sz);
  const half = CUBE_HALF - shape.size;
  const { systems = [], wonders = [], beacons = {} } = legacy;
  for (let t = 0; t < GARGANTUAN.tries; t++) {
    const at = origin.map((o) => o + range(rng, -half, half));
    if (!clearOfKeepOuts(at, GARGANTUAN.far + shape.size, KEEP_OUTS)) continue;
    if (!systems.every((s) => far(at, s.at, (s.reach ?? 0) + shape.size + GARGANTUAN.systems))) continue;
    if (!wonders.every((w) => far(at, w.at, w.size + shape.size))) continue;
    if (!Object.values(beacons).every((b) => far(at, b.at, 3000 + shape.size))) continue;
    return { kind: form, gargantuan: true, name, at, ...shape, axis, light, colors, seed: hash64(sectorSeedOf(universe, sx, sy, sz), 'gargantuan', form) };
  }
  return null;
}

// (a unit square to the axis, the same one every time for the same axis)
function refOf(axis) {
  const ax = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const c = [axis[1] * ax[2] - axis[2] * ax[1], axis[2] * ax[0] - axis[0] * ax[2], axis[0] * ax[1] - axis[1] * ax[0]];
  const l = Math.hypot(c[0], c[1], c[2]);
  return [c[0] / l, c[1] / l, c[2] / l];
}

export function arcPoints(row, step = row.band) {
  const ref = refOf(row.axis);
  const a = row.axis;
  const side = [a[1] * ref[2] - a[2] * ref[1], a[2] * ref[0] - a[0] * ref[2], a[0] * ref[1] - a[1] * ref[0]];
  const n = Math.max(2, Math.ceil((row.span * row.size) / step) + 1);
  const out = [];
  for (let i = 0; i < n; i++) {
    const th = row.mid - row.span / 2 + (row.span * i) / (n - 1);
    const c = Math.cos(th) * row.size;
    const s = Math.sin(th) * row.size;
    out.push([0, 1, 2].map((k) => row.at[k] + c * ref[k] + s * side[k]));
  }
  return out;
}

export function gargantuanKeeps(row) {
  if (row.kind === 'hole') return [{ at: row.at, r: row.body * 1.6 }];
  if (row.kind === 'giant') return [{ at: row.at, r: row.size * 1.05 }];
  if (row.kind === 'dyson') return [{ at: row.at, r: row.body * 3 }];
  if (row.kind === 'arc') return arcPoints(row).map((at) => ({ at, r: row.band }));
  const out = [];
  for (let u = -1; u <= 1 + 1e-9; u += 0.2) out.push({ at: row.at.map((v, k) => v + row.axis[k] * u * row.size), r: 0.14 * row.size });
  return out;
}

export function checkGargantuan(row) {
  if (!GARGANTUAN_FORMS.includes(row?.kind)) throw new TypeError(`a gargantuan's form is one of ${GARGANTUAN_FORMS.join(', ')}`);
  if (!Array.isArray(row.at) || row.at.length !== 3 || !row.at.every(Number.isFinite)) throw new TypeError('a gargantuan needs a finite at');
  if (!(row.size >= 20 * PLANET_SIZE && row.size <= 200 * PLANET_SIZE)) throw new TypeError('a gargantuan is 20 to 200 planets across');
  if (!Array.isArray(row.axis) || row.axis.length !== 3) throw new TypeError('a gargantuan needs an axis');
  return row;
}

export function gargantuanSectors(universe, from, { form = null, n = 1, ring = 12 } = {}) {
  const out = [];
  for (let x = -ring; x <= ring; x++)
    for (let y = -ring; y <= ring; y++)
      for (let z = -ring; z <= ring; z++) {
        const c = [from[0] + x, from[1] + y, from[2] + z];
        if (!hasGargantuan(universe, ...c)) continue;
        if (form && formOf(universe, ...c) !== form) continue;
        out.push({ c, d: Math.hypot(x, y, z), k: sectorKey(...c) });
      }
  out.sort((a, b) => a.d - b.d || (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return out.slice(0, n).map((o) => o.c);
}

