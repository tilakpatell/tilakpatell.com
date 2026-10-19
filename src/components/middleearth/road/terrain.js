// A stage’s land, as heights: lib/land’s layers summed under the stage’s
// spec, its flats levelled, the road levelled along its line (lib/land’s
// paths.js) and its rivers cut as channels. Pure, so the ground, the scatter
// and the walkers read the same land, in Node as in the browser.
//
//   buildHeights(spec, { size: [w, d], res, road, rivers = [], flats = [] })
//     → { heights: Float32Array, w, d, res, x0, z0, cols, rows, field(x, z), heightAt(x, z) }
//   specFor(id) → the stage’s spec (its own `ground.spec`, else SPECS’ row)
//   roadFor(id) → the stage’s road (a roadOf of its own `road`, else straight along +z)
//   landFor(id, { res, wide = 1024 }) → buildHeights for the stage, seamed, with { id, road, end }
//   heightsJob, landJob: the same as generators, a row a step; run(job) to the end
//   riverLevel(field, river) → (m) → the water’s height m metres along the river
//   wetBy(rivers) → (x, z) → true on a river’s water
//
// The seams: a stage’s land eases, over SEAM_EASE metres before each end of
// its road, to SEAM’s profile, which reads x alone, so the stage before and
// the stage after meet it at the same heights and the grounds abut with no
// step. That holds while a stage’s road starts at (0, 0) and ends at x = 0
// heading along +z (stages/index.test.js holds every stage to it).
//
// The stage frame: x ∈ [−w/2, w/2] across the road, z ∈ [−FRAME_BACK,
// d − FRAME_BACK] along it (the road starts at z = 0). A sample is a cell’s
// middle, `res` apart, so there are (w / res) × (d / res) of them.
// `field` is the land exactly; `heightAt` reads the samples (bilinear), as
// the far ground is drawn from them. A river is { line (a roadOf), depth,
// width, bank }.

import { fieldAt } from '../../../lib/land/layers.js';
import { flatten } from '../../../lib/land/flats.js';
import { cutAlong, distanceTo, levelAlong } from '../../../lib/land/paths.js';
import { endOf, roadOf } from './line';
import { stageById } from './stages/index';

export const FRAME_BACK = 40; // m of land behind a stage’s start

// The land under each stage until its own task writes its ground: low
// swells for the green places, ridges and peaks round the horizon for the
// hard ones. Mountains are measured from the stage’s start, so they ring it.
const GREEN = [
  { type: 'swell', scale: 220, height: 6 },
  { type: 'hills', scale: 90, height: 9, gain: 0.42, octaves: 4 },
  { type: 'mountains', scale: 160, height: 40, from: 300, to: 480 },
];
const ROUGH = [
  { type: 'swell', scale: 180, height: 8 },
  { type: 'ridges', scale: 120, height: 14, octaves: 4 },
  { type: 'mountains', scale: 140, height: 120, from: 220, to: 420 },
];
const FLAT = [
  { type: 'swell', scale: 260, height: 2 },
  { type: 'hills', scale: 70, height: 3, gain: 0.4, octaves: 3 },
];
export const SPECS = {
  // (the rise the Hill stands on, left of the lane’s start; the Hill itself is Hobbiton’s props)
  hobbiton: { seed: 11, relief: [...GREEN, { type: 'island', at: [34, 6], r: 32, height: 4 }] },
  'shire-edge': { seed: 12, relief: GREEN },
  bree: { seed: 13, relief: GREEN },
  weathertop: { seed: 14, relief: [...GREEN.slice(0, 2), { type: 'island', at: [60, 160], r: 90, height: 45 }] },
  ford: { seed: 15, relief: ROUGH },
  rivendell: { seed: 16, relief: ROUGH },
  caradhras: { seed: 17, relief: ROUGH },
  moria: { seed: 18, relief: FLAT },
  lorien: { seed: 19, relief: GREEN },
  anduin: { seed: 20, relief: ROUGH },
  marshes: { seed: 21, relief: FLAT },
  ithilien: { seed: 22, relief: GREEN },
  'cirith-ungol': { seed: 23, relief: ROUGH },
  gorgoroth: { seed: 24, relief: [...FLAT, { type: 'mountains', scale: 160, height: 90, from: 280, to: 480 }] },
  'minas-tirith': { seed: 25, relief: GREEN },
  havens: { seed: 26, relief: FLAT },
};

// the profile every seam eases to: a low swell across the road, x alone
export const SEAM = { seed: 7, relief: [{ type: 'swell', scale: 220, height: 5 }] };
export const SEAM_EASE = 50; // m

export const specFor = (id) => stageById(id)?.ground?.spec ?? SPECS[id] ?? { seed: 1, relief: FLAT };

export function roadFor(id) {
  const st = stageById(id);
  return roadOf(st?.road ?? [[0, 0, 0], [0, 0, st?.length ?? 100]]);
}

// `seam: [z0, z1]`: the stage’s land eased to SEAM’s at z0 and z1 (its road’s ends)
export function buildHeights(...args) {
  return run(heightsJob(...args));
}

// the same, a row at a time: a generator that yields after each row and
// returns the heights, so a stage ahead is built a few milliseconds a frame
export function* heightsJob(spec, { size: [w, d], res, road = null, rivers = [], flats = [], seam = null }) {
  let field = flatten((x, z) => fieldAt(spec, x, z), flats);
  if (seam) {
    const own = field;
    const [a, b] = seam;
    field = (x, z) => {
      const k = Math.min(ease((z - a) / SEAM_EASE), ease((b - z) / SEAM_EASE));
      if (k >= 1) return own(x, z);
      const edge = fieldAt(SEAM, x, 0);
      return k <= 0 ? edge : edge + (own(x, z) - edge) * k;
    };
  }
  if (road) field = levelAlong(field, road);
  for (const r of rivers) field = cutAlong(field, r.line, r);
  const cols = Math.round(w / res);
  const rows = Math.round(d / res);
  const x0 = -w / 2;
  const z0 = -FRAME_BACK;
  const heights = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const z = z0 + (j + 0.5) * res;
    for (let i = 0; i < cols; i++) heights[j * cols + i] = field(x0 + (i + 0.5) * res, z);
    yield;
  }
  // the samples read between, clamped to the outermost
  const heightAt = (x, z) => {
    const u = Math.min(cols - 1, Math.max(0, (x - x0) / res - 0.5));
    const v = Math.min(rows - 1, Math.max(0, (z - z0) / res - 0.5));
    const i = Math.min(cols - 2, Math.floor(u));
    const j = Math.min(rows - 2, Math.floor(v));
    const fu = u - i;
    const fv = v - j;
    const k = j * cols + i;
    const a = heights[k] + (heights[k + 1] - heights[k]) * fu;
    const b = heights[k + cols] + (heights[k + cols + 1] - heights[k + cols]) * fu;
    return a + (b - a) * fv;
  };
  return { heights, w, d, res, x0, z0, cols, rows, field, heightAt };
}

// a job run to its end
export function run(job) {
  for (;;) {
    const r = job.next();
    if (r.done) return r.value;
  }
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export function landFor(...args) {
  return run(landJob(...args));
}

export function* landJob(id, { res, wide = 1024 } = {}) {
  const st = stageById(id);
  const road = roadFor(id);
  const end = endOf(road).at[2];
  const g = st.ground ?? {};
  // (the land runs FRAME_BACK past each end, under the seams, so the
  // first stage has ground behind it and the last ahead)
  const d = Math.ceil((end + 2 * FRAME_BACK) / res) * res;
  const rivers = (g.rivers ?? []).map((r) => ({ ...r, line: r.line ?? roadOf(r.points) }));
  const land = yield* heightsJob(specFor(id), { size: [wide, d], res, road, rivers, flats: g.flats ?? [], seam: [0, end] });
  // (`clear`: the stage’s built places, where nothing is planted: scatter.js reads it)
  return { ...land, id, road, end, rivers, wet: wetBy(rivers), clear: g.clear ?? [] };
}

// The water stands FILL of the way up its channel, read off the cut land
// along the river’s middle every LEVEL_STEP metres; held under the banks
// either side (a stone in the bed must not lift it over them) and smoothed
// over LEVEL_SPAN. It follows the channel over a rise rather than run level
// from its lowest point: the channel is cut into the land, not the land
// shaped round the river, so a level sheet would sink under the bed.
export const FILL = 0.7;
const LEVEL_STEP = 2; // m
const LEVEL_SPAN = 6; // m either side
const UNDER_BANK = 0.15; // m

export function riverLevel(field, { line, depth, width = 8, bank = width / 2 }) {
  const n = Math.max(1, Math.ceil(line.length / LEVEL_STEP));
  const each = line.length / n;
  const raw = new Float64Array(n + 1);
  const out = (half) => half + bank;
  for (let i = 0; i <= n; i++) {
    const p = line.pointAt(i * each);
    const [tx, , tz] = p.tangent;
    const l = Math.hypot(tx, tz) || 1;
    const nx = -tz / l;
    const nz = tx / l;
    const o = out(width / 2);
    const banks = Math.min(field(p.x + nx * o, p.z + nz * o), field(p.x - nx * o, p.z - nz * o));
    raw[i] = Math.min(field(p.x, p.z) + depth * FILL, banks - UNDER_BANK);
  }
  const k = Math.round(LEVEL_SPAN / each);
  const level = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(n, i + k); j++) {
      sum += raw[j];
      count++;
    }
    level[i] = sum / count;
  }
  return (m) => {
    const f = Math.min(n, Math.max(0, m / each));
    const i = Math.min(n - 1, Math.floor(f));
    return level[i] + (level[i + 1] - level[i]) * (f - i);
  };
}

// on the water: within the channel’s floor and half its bank of a river’s line
export function wetBy(rivers) {
  const near = rivers.map((r) => {
    const reach = (r.width ?? 8) / 2 + (r.bank ?? (r.width ?? 8) / 2) / 2;
    return { off: distanceTo(r.line, reach), reach };
  });
  return (x, z) => near.some(({ off, reach }) => off(x, z) < reach);
}
