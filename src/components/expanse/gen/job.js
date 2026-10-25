// Sectors made off the main thread: the jobs the sector worker
// (scene/sector.worker.js) runs. A sector job makes one sector whole
// (space.js's fullSector) and its specks for the far layer; a beyond job
// makes the specks of every system in a shell of sectors round a centre,
// for the far layer's rings beyond the 3 × 3 × 3, each sector made once
// and kept while it's wanted. Pure (no three.js, no DOM), so it runs in
// Node as in the worker. Nothing made is stored: the cache is the worker's,
// and goes with the page.
//
// POOLS: { sector: 'expanse', beyond: 'expanse-beyond' }, the pools' names
// definePools(workers, { make, size }): sector jobs on POOLS.sector, `size`
//   workers wide (the budget's `workers`), and beyond jobs on POOLS.beyond,
//   one worker, so its cache serves them all. `make` makes a worker:
//   `() => new Worker(new URL('./sector.worker.js', import.meta.url), { type: 'module' })`
//   from scene/, where the worker is.
// sectorJob({ key, universe, sx, sy, sz }) → { answer: { key, sector, stars }, transfer }
//   sector: fullSector's, its planets without moonList (withMoons puts it
//   back); stars: specks.js's starsOf, every system then every legacy
//   wonder, from the sector's middle (farStars' setSlot takes it with the
//   sector's origin as centre); transfer: every typed array's buffer in the
//   answer, so none is copied across
// withMoons(sector) → the sector, each planet's moonList a getter that makes
//   moonsOf(planet) the first time it's read and keeps it
// beyondKeys(centre: [sx, sy, sz], ring) → [[sx, sy, sz]…]: the sectors at
//   Chebyshev ring + 1 from the centre, 98 for ring 1 and 218 for ring 2,
//   the core one like any other; none under ring 1 (that's the 3 × 3 × 3)
// beyondJob({ key, universe, centre, ring }, cache = new Map(), make = beyondSector)
//   → { answer: { key, centre, stars }, transfer }: every system of
//   beyondKeys(centre, ring) as a speck (starsOf's, no wonders), from the
//   centre sector's middle; `centre` is the message's, so a late answer is
//   told from the one wanted. Each sector's specks are kept in `cache` (the
//   last BEYOND_KEEP used), so a step to the next sector makes only the
//   face it steps into. Name a beyond job's key by its centre and ring: the
//   pool settles a key asked again with the first answer for it to come.
// beyondSector(universe, sx, sy, sz) → the sector a beyond job makes
//   (fullSector's, with no things)
// runJob(msg, cache, make) → the job's { answer, transfer }; null for a
//   cancel (a worker holds one job at a time, so a cancel comes after the
//   job it was for, whose answer the pool ignores); throws for a job it
//   doesn't know, so the pool gives the job up

import { sectorCentre } from '../../../lib/space/address.js';
import { starsOf } from '../scene/specks';
import { fullSector } from './space';
import { moonsOf } from './systems';

export const POOLS = Object.freeze({ sector: 'expanse', beyond: 'expanse-beyond' });
export const BEYOND_KEEP = 400;

export function definePools(workers, { make, size = 1 }) {
  workers.define(POOLS.sector, make, { size });
  workers.define(POOLS.beyond, make, { size: 1 });
}

// every typed array's buffer under a value, once each
function buffersOf(v, out = new Set(), seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v)) return out;
  seen.add(v);
  if (ArrayBuffer.isView(v)) out.add(v.buffer);
  else for (const x of Object.values(v)) buffersOf(x, out, seen);
  return out;
}

// the sector as it goes across: its moons are made again on the far side, when wanted
const wire = (sector) => ({
  ...sector,
  systems: sector.systems.map((s) => ({
    ...s,
    planets: s.planets.map((p) => {
      const out = { ...p };
      delete out.moonList;
      return out;
    }),
  })),
});

export function sectorJob({ key, universe, sx, sy, sz }) {
  const made = fullSector(universe, sx, sy, sz);
  const answer = { key, sector: wire(made), stars: starsOf(made) };
  return { answer, transfer: [...buffersOf(answer)] };
}

const keep = (planet, value) => {
  Object.defineProperty(planet, 'moonList', { value, writable: true, enumerable: true, configurable: true });
  return value;
};
const MOONS = {
  enumerable: true,
  configurable: true,
  get() {
    return keep(this, moonsOf(this));
  },
  set(value) {
    keep(this, value);
  },
};

export function withMoons(sector) {
  for (const s of sector.systems) for (const p of s.planets) if (!Object.hasOwn(p, 'moonList')) Object.defineProperty(p, 'moonList', MOONS);
  return sector;
}

export function beyondKeys([cx, cy, cz], ring) {
  const out = [];
  if (!(ring >= 1)) return out;
  const d = Math.floor(ring) + 1;
  for (let dx = -d; dx <= d; dx++)
    for (let dy = -d; dy <= d; dy++)
      for (let dz = -d; dz <= d; dz++) if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) === d) out.push([cx + dx, cy + dy, cz + dz]);
  return out;
}

export const beyondSector = (universe, sx, sy, sz) => fullSector(universe, sx, sy, sz, { things: false });

// a sector's specks beyond, kept: its systems' from its middle, and that middle
function keptStars(cache, universe, [sx, sy, sz], make) {
  const k = `${universe}|${sx},${sy},${sz}`;
  let kept = cache.get(k);
  if (kept) cache.delete(k); // (to the back: the most recently used)
  else {
    const s = make(universe, sx, sy, sz);
    kept = { origin: s.origin, ...starsOf(s, { wonders: false }) };
  }
  cache.set(k, kept);
  if (cache.size > BEYOND_KEEP) cache.delete(cache.keys().next().value);
  return kept;
}

export function beyondJob({ key, universe, centre, ring }, cache = new Map(), make = beyondSector) {
  const kept = beyondKeys(centre, ring).map((c) => keptStars(cache, universe, c, make));
  const n = kept.reduce((sum, e) => sum + e.count, 0);
  const at = new Float32Array(n * 3);
  const color = new Uint8Array(n * 3);
  const r = new Float32Array(n);
  const o = sectorCentre(...centre);
  let i = 0;
  for (const e of kept) {
    const dx = e.origin[0] - o[0];
    const dy = e.origin[1] - o[1];
    const dz = e.origin[2] - o[2];
    for (let j = 0; j < e.count; j++) {
      at[(i + j) * 3] = e.at[j * 3] + dx;
      at[(i + j) * 3 + 1] = e.at[j * 3 + 1] + dy;
      at[(i + j) * 3 + 2] = e.at[j * 3 + 2] + dz;
    }
    color.set(e.color, i * 3);
    r.set(e.r, i);
    i += e.count;
  }
  return { answer: { key, centre: [...centre], stars: { at, color, r, count: n } }, transfer: [at.buffer, color.buffer, r.buffer] };
}

export function runJob(msg, cache, make) {
  if (!msg || msg.type === 'cancel') return null;
  if (msg.type === 'sector') return sectorJob(msg);
  if (msg.type === 'beyond') return beyondJob(msg, cache, make);
  throw new Error(`no such job: ${msg.type}`);
}
