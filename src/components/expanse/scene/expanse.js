// The Expanse on the universe map: generated space round the ship,
// everywhere, the core included. One space in three dimensions, with no rim
// and no floating origin: everything is in the map's own numbers (the root
// at nought), and the scene draws round the camera (universe/relative.js).
//
// Loading. A chunk grid in three dimensions (runtime/chunkGrid3.js, a sector
// a cell, radius 1) asks the worker pool for the 3 × 3 × 3 round the ship
// (gen/job.js's sectorJob: space.js's fullSector, made off the main thread),
// nearest first and then along the nose, no more out at once than the
// budget's workers. Each answer comes back on a promise and is taken one a
// frame. A sector is let go a band further out (the grid's hysteresis),
// its job cancelled if it's still out; an answer for one let go, or for
// where the ship was before a jump, is refused. The rings of sectors past
// the 3 × 3 × 3 come as specks, a ring a job, nearest first (gen/job.js's
// beyondJob, on a worker of their own).
//
// Drawing, in levels.js's levels: each loaded sector's wonders
// (sectors.js); its stars and wonders as a slot of specks in the far layer,
// past the far plane, and each ring beyond in a slot of its own; within the
// far plane its stars, planets, moons and wonders as discs (discs.js), fed
// every frame, faded in over PLACE_IN as its sector comes, the specks
// coming in where their budget ends; and the nearest systems built whole
// (near.js). Planets and moons go round on the shared clock (orbits.js's
// spaceTime of the wall time it's given).
//
// The centre drawn. The far layer draws one centre's 3 × 3 × 3 and rings,
// whole. Once the ship is SWAP_PAST into the next sector (so one sitting on
// a face never flickers between two), that centre's new sectors and rings
// are staged hidden while the old draw, and swapped in with one showSlots
// and one hideSlots once all are in (a ring has two slots, A and B, for
// that). A place with nothing drawn before it (the first, or after a jump:
// a centre not next to the one drawn) fades in as it comes, over PLACE_IN.
// Every speck fades to nothing at the edge of what's drawn (farStars'
// setEdge: as far as the drawn sectors reach from the camera, eased out after
// a swap, in at once), so nothing comes or goes there at once.
//
// What it builds is solid and lit by its own star: solids() (for ship.js's
// step, through shipHits.js's solidsWith) and stars() (lighting.js's
// lightAt). With no ship, or in the Rick and Morty pocket (walled off as it
// always was), it lets everything go. Nothing generated is kept but while
// it's near: a sector is made from its seed each time it's wanted.
//
// createExpanse(parent, { universe, workers, far, tier, detail, budget,
//   prepare, reduced, onSector, make, makeNear, build, timer, warn })
//   → { root, update({ ship, camera, t, dt, now }), loaded(), sector(),
//   sectors(), nearestSystem(at), stars(), solids(), setStep(step, floor),
//   pops(), workMs(), reload(id), dispose() }
//   workers: the page's pool (runtime/workers.js's, rt.workers), its pools
//   defined here (gen/job.js's POOLS); none, and the sector the ship is in
//   is made in process the frame it's asked, and nothing round it (Node's
//   way: making the 3 × 3 × 3 on the main thread is what the pool is for),
//   the last KEPT so made kept for the next
//   far: the far layer to draw in (universe/farStars.js's, in the parent's
//   space, made with farRoom's room and updated before this each frame);
//   none, and it makes its own under the parent the first frame it's asked to
//   draw
//   tier, detail: the device's (lib/device), for the budget; budget:
//   universe/budget.js's row (the level's, unless it's given)
//   prepare(root, alive): the scene's warm(), for what near.js builds
//   onSector(id): where the ship is, by layout.js's sectorOf ('main' inside
//   the core's edge, else an 'E:' key), each time it changes
//   make: a sector's wonders drawn (sectors.js's createSector); makeNear,
//   build: near.js's createNear and its body builder; timer: () → ms
//   update: `t` the scene's clock, `now` the wall time in ms (0 holds the
//   orbits where they start)
//   loaded() → the ids of the sectors it holds; sectors() → Map(id → Sector,
//   withMoons'd); sector() → the id of the sector the ship is in (null
//   before)
//   nearestSystem(at) → { system, sector, dist } of all it holds, or null
//   stars(): lighting.js's STARS, then the light of each system built; one
//   array, the same every frame
//   solids(): what's built, each where it is this frame ({ id, at, r,
//   reach }, near.js's); one array, kept while what's built stays the same
//   setStep(step, floor): the pace's (qualityStep.js's stepAt): the discs
//   and the rings beyond to the level's budget at that step, and near.js's
//   detail with it
//   pops(): its far layer's (dev): what came in at once, since last asked
//   workMs(): the most a frame of its own took, since last asked (dev)
//   reload(id): the sector made again, its slot swapped for the new in one
//   frame (dev: the pop check); false if it holds none such
// farRoom({ tier, detail }) → { slots, discs }: the room a far layer is made
//   with for a level: the budget's slots, then A and B for each ring
//   beyond (room for every star of its sectors), and half again its discs
//   (an edge easing in draws more than the budget)

import * as THREE from 'three';
import { SECTOR, parseSectorKey, sectorAt, sectorCentre, sectorKey } from '../../../lib/space/address';
import { createChunkGrid3, parseCell } from '../../../runtime/chunkGrid3';
import { sectorOf } from '../../universe/layout';
import { SKY_FAR, createFarStars, universeBudget } from '../../universe/shared/far';
import { STARS } from '../../universe/shared/space';
import { POOLS, beyondKeys, definePools, sectorJob, withMoons } from '../gen/job';
import { spaceTime } from '../gen/orbits';
import { UNIVERSE } from '../gen/seed';
import { createDiscs } from './discs';
import { FAR } from './levels';
import { createNear } from './near';
import { createSector } from './sectors';

const PLACE_IN = 0.5; // a place with nothing before it fades in over this many seconds
const SWAP_PAST = 2000; // how far into the next sector the ship goes before the far layer swaps to it
const EDGE_OUT = 0.5; // the edge eases out by this share of where it's going a second
const TRIES = 3; // a job that fails is asked again till it's failed this often
const DISC_ROOM = 1.5; // a far layer's room for discs, of the budget's (an edge easing in draws more)
const SECTOR_MOST = 330; // the most stars a sector holds (gen: 24 of its own, 300 more), and a few over
const HALF = SECTOR / 2;
const NONE = [];
const NO_POPS = Object.freeze({ count: 0, px: 0 });
const KEPT = 8; // sectors made in process, kept (read-only: shared by every Expanse made so)

// a sector job's answer made in process, the last few kept
const kept = new Map();
function inProcess(msg) {
  let answer = kept.get(msg.key);
  if (answer) kept.delete(msg.key);
  else answer = sectorJob(msg).answer;
  kept.set(msg.key, answer);
  if (kept.size > KEPT) kept.delete(kept.keys().next().value);
  return answer;
}

// the sectors in ring r (98, 218), and the rings a budget draws
const shellOf = (r) => (2 * r + 3) ** 3 - (2 * r + 1) ** 3;
const ringsOf = (budget) => Array.from({ length: Math.max(0, budget.beyondRings) }, (_, i) => i + 1);
const roomOf = (budget) => ({
  slots: [...Array(budget.nearSlots).fill(budget.slotSize), ...ringsOf(budget).flatMap((r) => [shellOf(r) * SECTOR_MOST, shellOf(r) * SECTOR_MOST])],
  discs: Math.ceil(budget.discs * DISC_ROOM),
});
export const farRoom = (level) => roomOf(universeBudget(level));

const cellKey = (c) => `${c[0]},${c[1]},${c[2]}`;
// how far a point is out of a sector's cube, and how far past it anything of
// the sector can reach (a system's bodies are within twice its reach of its
// star, as discs.js has it; a wonder's ball within its size)
function outOf(o, p) {
  let s = 0;
  for (let k = 0; k < 3; k++) {
    const d = Math.abs(p[k] - o[k]) - HALF;
    if (d > 0) s += d * d;
  }
  return Math.sqrt(s);
}
function marginOf(sector) {
  let m = 0;
  for (const x of sector.systems) m = Math.max(m, 2 * x.reach);
  for (const w of sector.wonders) m = Math.max(m, w.size);
  return m;
}
const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
const same = (a, b) => Boolean(a && b) && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const cube = (r) => {
  const out = [];
  for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) out.push([dx, dy, dz]);
  return out;
};
// the nose, in quarters (heading 0 down −z, pitch up: orient.js's), for the grid's order
const quarter = (v) => Math.round(v * 4) / 4 + 0;
function noseOf(s) {
  if (!Number.isFinite(s.heading)) return null;
  const p = Number.isFinite(s.pitch) ? s.pitch : 0;
  return [quarter(-Math.sin(s.heading) * Math.cos(p)), quarter(Math.sin(p)), quarter(-Math.cos(s.heading) * Math.cos(p))];
}

export function createExpanse(parent, { universe = UNIVERSE, workers = null, far = null, tier = 'mid', detail, budget = universeBudget({ tier, detail }), prepare = null, reduced = false, onSector = null, make = createSector, makeNear = createNear, build, timer = () => performance.now(), warn = (...a) => console.warn(...a) } = {}) {
  const root = new THREE.Group();
  root.name = 'expanse';
  parent.add(root);
  // what's built, in the map's space
  const nearRoot = new THREE.Group();
  nearRoot.name = 'expanse-near';
  root.add(nearRoot);
  const near = makeNear(nearRoot, { budget, tier, prepare, build });
  const pool = workers;
  if (pool) definePools(pool, { make: () => new Worker(new URL('./sector.worker.js', import.meta.url), { type: 'module' }), size: budget.workers });
  const radius = pool ? 1 : 0;
  const NEAR = cube(radius);
  const grid = createChunkGrid3({ size: SECTOR, radius, inFlight: budget.workers });

  // the far layer and its discs, made the first frame (at the pace's step it
  // was last told); its sectors' slots, and A and B for each ring
  let layer = null;
  let stepped = budget;
  const layerOf = () => {
    if (!layer) {
      const own = far ? null : createFarStars(parent, { places: [], skyFar: SKY_FAR, ...roomOf(budget) });
      const into = far ?? own;
      layer = { far: into, own, discs: createDiscs(into, { budget: stepped, built: near.built }), free: Array.from({ length: budget.nearSlots }, (_, i) => budget.nearSlots - 1 - i) };
    }
    return layer;
  };
  const rings = (pool ? ringsOf(budget) : NONE).map((r) => ({ r, slots: [budget.nearSlots + 2 * (r - 1), budget.nearSlots + 2 * (r - 1) + 1], shown: null, staged: null }));
  const wanted = () => Math.min(stepped.beyondRings, rings.length);

  // the light of what's built, after the map's own (one array, kept)
  const lit = [...STARS];
  const held = new Map(); // grid key → { id, cell, sector, stars, drawn, slot, shown }
  const byId = new Map(); // sector id → Sector
  const blocked = new Set(); // grid keys given up on
  const fails = new Map(); // job key → how often it's failed
  const asked = new Map(); // job key → the job, till it's taken or let go
  const landed = []; // [job key, job, answer], taken one a frame
  let sectorList = []; // every sector held
  let entries = [];
  // the sectors near enough the camera to have anything within the far
  // plane, fed to the discs and what's built, and how much of each sector's
  // discs show (faded in as it comes)
  const fed = [];
  let fedSectors = [];
  let systems = [];
  let restale = true;
  let shares = new Float64Array(0);
  const relist = () => {
    entries = [...held.values()];
    sectorList = entries.map((e) => e.sector);
    if (shares.length < entries.length) shares = new Float64Array(2 * entries.length);
    restale = true;
  };
  let drawnAt = null; // the centre the far layer draws, [sx, sy, sz]
  let here = null; // the sector the ship is in
  let named = null; // where onSector last said it was
  let edge = 0;
  let awake = false;
  let most = 0;
  const camAt = new THREE.Vector3();
  const cam = [0, 0, 0];

  const within = (cell, centre) => cheb(cell, centre) <= radius;
  const sectorJobKey = (cell) => `${universe}|${sectorKey(...cell)}`;
  const ringJobKey = (centre, r) => `${universe}|beyond|${sectorKey(...centre)}|${r}`;
  const ringKeys = (centre, r) => [`beyond:${r}`, ...beyondKeys(centre, r).map((c) => sectorKey(...c))];

  // a job out: its answer queued while it's still ours; in process, at once
  const send = (name, msg, job) => {
    asked.set(msg.key, job);
    const take = (answer) => {
      if (asked.get(msg.key) === job) landed.push([msg.key, job, answer]);
    };
    if (!pool) return take(inProcess(msg));
    let p;
    try {
      p = pool.request(name, msg);
    } catch {
      p = Promise.resolve(null);
    }
    p.then(take, () => take(null));
  };
  const askSector = (key, reload = false) => {
    const cell = parseCell(key);
    const gen = grid.gen;
    if (!reload) grid.began(key, gen);
    send(POOLS.sector, { type: 'sector', key: sectorJobKey(cell), universe, sx: cell[0], sy: cell[1], sz: cell[2] }, { kind: 'sector', key, cell, gen, reload });
  };
  const askRing = (centre, r) => send(POOLS.beyond, { type: 'beyond', key: ringJobKey(centre, r), universe, centre: [...centre], ring: r, priority: r }, { kind: 'ring', centre: [...centre], r });
  const cancelJob = (k) => {
    const job = asked.get(k);
    if (!job) return;
    asked.delete(k);
    pool?.cancel(job.kind === 'ring' ? POOLS.beyond : POOLS.sector, k);
  };

  // a near slot: a free one, or one held by a sector neither drawn nor near
  const takeSlot = () => {
    const L = layerOf();
    if (L.free.length) return L.free.pop();
    for (const e of held.values()) {
      if (e.slot < 0 || e.shown || (here && within(e.cell, here)) || (drawnAt && within(e.cell, drawnAt))) continue;
      const s = e.slot;
      e.slot = -1;
      return s;
    }
    return -1;
  };
  const putSlot = (e) => {
    if (e.slot < 0) e.slot = takeSlot();
    if (e.slot >= 0) layerOf().far.setSlot(e.slot, { centre: [...e.sector.origin], ...e.stars, key: e.id });
    return e.slot;
  };
  const freeSlot = (e) => {
    if (e.slot < 0) return;
    if (e.shown) layerOf().far.hideSlots([e.slot]);
    layerOf().free.push(e.slot);
    e.slot = -1;
    e.shown = false;
  };

  const putSector = (job, answer) => {
    const was = held.get(job.key);
    if (job.reload ? !was : !grid.done(job.key, job.gen)) return;
    const sector = withMoons(answer.sector);
    const drawn = make(sector, { tier, reduced });
    root.add(drawn.group);
    const e = { id: sector.id, cell: job.cell, sector, stars: answer.stars, drawn, slot: -1, shown: false, age: was?.age ?? 0, margin: marginOf(sector) };
    const L = layerOf();
    const swap = Boolean(was?.shown);
    // (made again with no slot free: into the one it had)
    if (was && was.slot >= 0 && !L.free.length) {
      e.slot = was.slot;
      was.slot = -1;
      was.shown = false;
    }
    held.set(job.key, e);
    byId.set(e.id, sector);
    relist();
    if (putSlot(e) >= 0) {
      if (swap) {
        // (made again: swapped for what it was, in one frame)
        L.far.showSlots([e.slot]);
        e.shown = true;
      } else if (drawnAt && within(e.cell, drawnAt)) {
        // (of the place drawn, and nothing of it drawn before)
        L.far.fadeSlot(e.slot, PLACE_IN);
        e.shown = true;
      }
    }
    if (was) {
      was.drawn.dispose();
      freeSlot(was);
    }
  };
  const putRing = (job, stars) => {
    const ring = rings.find((x) => x.r === job.r);
    if (!ring || job.r > wanted() || !(same(job.centre, drawnAt) || same(job.centre, here))) return;
    const slot = ring.slots.find((s) => s !== ring.shown?.slot);
    layerOf().far.setSlot(slot, { centre: sectorCentre(...job.centre), ...stars, key: ringKeys(job.centre, job.r) });
    ring.staged = { centre: job.centre, slot };
    // (round the place drawn: nothing of it there before, so faded in)
    if (same(job.centre, drawnAt)) showRing(ring, true);
  };
  const showRing = (ring, fade) => {
    const L = layerOf();
    if (ring.shown) L.far.hideSlots([ring.shown.slot]);
    if (fade) L.far.fadeSlot(ring.staged.slot, PLACE_IN);
    ring.shown = ring.staged;
    ring.staged = null;
  };
  const hideRing = (ring) => {
    if (ring.shown) layerOf().far.hideSlots([ring.shown.slot]);
    ring.shown = null;
    ring.staged = null;
  };

  // a job that came back with nothing: asked again, or given up
  const failed = (k, job) => {
    const n = (fails.get(k) ?? 0) + 1;
    fails.set(k, n);
    if (job.kind === 'ring') {
      if (n < TRIES) return;
      warn(`[expanse] the ring ${job.r} round ${sectorKey(...job.centre)} failed ${n} times; it's left empty`);
      putRing(job, { at: new Float32Array(0), color: new Uint8Array(0), r: new Float32Array(0), count: 0 });
    } else if (!job.reload) {
      if (n < TRIES) return grid.failed(job.key, job.gen);
      warn(`[expanse] the sector ${sectorKey(...job.cell)} failed ${n} times; it's left empty`);
      if (grid.done(job.key, job.gen)) blocked.add(job.key);
    }
  };
  // what's come back: taken, one a frame
  const takeOne = () => {
    while (landed.length) {
      const [k, job, answer] = landed.shift();
      if (asked.get(k) !== job) continue; // (let go of since)
      asked.delete(k);
      const good = answer?.key === k && (job.kind === 'ring' ? same(answer.centre, job.centre) && answer.stars : answer.sector && answer.stars);
      if (!good) {
        failed(k, job);
        continue;
      }
      fails.delete(k);
      if (job.kind === 'ring') putRing(job, answer.stars);
      else putSector(job, answer);
      return;
    }
  };

  const dropSector = (k) => {
    blocked.delete(k);
    const e = held.get(k);
    if (!e) return;
    cancelJob(sectorJobKey(e.cell)); // (a reload of it, still out)
    e.drawn.dispose();
    freeSlot(e);
    held.delete(k);
    byId.delete(e.id);
    relist();
  };
  // everything of a centre in (or given up on), and its rings
  const whole = (centre) => {
    for (const o of NEAR) {
      const k = `${centre[0] + o[0]},${centre[1] + o[1]},${centre[2] + o[2]}`;
      if (!held.has(k) && !blocked.has(k)) return false;
    }
    for (const ring of rings) if (ring.r <= wanted() && !same(ring.shown?.centre, centre) && !same(ring.staged?.centre, centre)) return false;
    return true;
  };
  // the far layer to the next centre, in one showSlots and one hideSlots
  const swapTo = (centre) => {
    const show = [];
    const hide = [];
    for (const e of held.values()) {
      const wants = within(e.cell, centre);
      if (wants && !e.shown && putSlot(e) >= 0) {
        show.push(e.slot);
        e.shown = true;
      } else if (!wants && e.shown) {
        hide.push(e.slot);
        e.shown = false;
      }
    }
    for (const ring of rings) {
      if (!same(ring.staged?.centre, centre)) continue;
      if (ring.shown) hide.push(ring.shown.slot);
      show.push(ring.staged.slot);
      ring.shown = ring.staged;
      ring.staged = null;
    }
    const L = layerOf();
    L.far.hideSlots(hide);
    L.far.showSlots(show);
    drawnAt = centre;
  };
  // a jump: what's drawn goes at once, and the new place comes in as it's made
  const jump = (centre) => {
    const hide = [];
    for (const e of held.values()) {
      if (e.shown && !within(e.cell, centre)) {
        hide.push(e.slot);
        e.shown = false;
      }
    }
    for (const ring of rings) {
      if (ring.shown) hide.push(ring.shown.slot);
      ring.shown = null;
    }
    layerOf().far.hideSlots(hide);
    drawnAt = null;
  };
  const startAt = (centre) => {
    drawnAt = centre;
    const L = layerOf();
    for (const e of held.values()) {
      if (!e.shown && within(e.cell, centre) && putSlot(e) >= 0) {
        L.far.fadeSlot(e.slot, PLACE_IN);
        e.shown = true;
      }
    }
    for (const ring of rings) if (same(ring.staged?.centre, centre)) showRing(ring, true);
  };

  const sleep = () => {
    for (const k of [...asked.keys()]) cancelJob(k);
    landed.length = 0;
    for (const k of [...held.keys()]) dropSector(k);
    for (const ring of rings) hideRing(ring);
    blocked.clear();
    fails.clear();
    near.update(NONE, cam);
    if (layer) {
      layer.far.discs.begin();
      layer.far.discs.end();
      layer.far.setDiscEdge?.(Infinity);
      if (layer.own) layer.own.points.visible = false;
    }
    grid.reset();
    drawnAt = null;
    here = null;
    named = null;
    edge = 0;
    awake = false;
  };

  function fly(ship, camera, t, dt, now) {
    const x = ship.x;
    const y = ship.y ?? 0;
    const z = ship.z;
    here = sectorAt(x, y, z);
    const name = sectorOf(x, y, z);
    if (name !== named) {
      named = name;
      onSector?.(name);
    }
    const L = layerOf();
    // the centre to draw: the one drawn till the ship's SWAP_PAST out of it;
    // one not next to it is a jump
    const o = drawnAt && sectorCentre(...drawnAt);
    const inside = o && Math.max(Math.abs(x - o[0]), Math.abs(y - o[1]), Math.abs(z - o[2])) <= HALF + SWAP_PAST;
    const target = inside ? drawnAt : here;
    if (drawnAt && cheb(target, drawnAt) > 1) jump(target);
    if (!drawnAt) startAt(target);
    // the 3 × 3 × 3 round the ship: what's gone behind let go, more asked
    const { ask, drop, cancel } = grid.update({ x: x + HALF, y: y + HALF, z: z + HALF, heading: noseOf(ship) });
    for (const k of cancel) cancelJob(sectorJobKey(parseCell(k)));
    for (const k of drop) dropSector(k);
    for (const k of ask) askSector(k);
    // the rings beyond: round the centre to draw, nearest first; none round anywhere else
    const want = wanted();
    for (const ring of rings) {
      if (ring.r > want) hideRing(ring);
      else if (!same(ring.shown?.centre, target) && !same(ring.staged?.centre, target) && !asked.has(ringJobKey(target, ring.r))) askRing(target, ring.r);
    }
    for (const [k, job] of asked) if (job.kind === 'ring' && (job.r > want || !(same(job.centre, target) || same(job.centre, here)))) cancelJob(k);
    // one answer taken, and the swap once the next centre's whole
    takeOne();
    if (!same(target, drawnAt) && whole(target)) swapTo(target);
    // the camera, in the map's space
    parent.updateWorldMatrix(true, false);
    parent.worldToLocal(camera.getWorldPosition(camAt));
    cam[0] = camAt.x;
    cam[1] = camAt.y;
    cam[2] = camAt.z;
    // the edge of what's drawn, from the camera: in at once, out eased
    let k = 0;
    while (k < rings.length && k < want && same(rings[k].shown?.centre, drawnAt)) k++;
    const c = sectorCentre(...drawnAt);
    const reach = Math.max(0, (radius + 0.5 + k) * SECTOR - Math.max(Math.abs(cam[0] - c[0]), Math.abs(cam[1] - c[1]), Math.abs(cam[2] - c[2])));
    edge = reach <= edge ? reach : edge + Math.min(reach - edge, EDGE_OUT * reach * Math.min(dt, 1 / 30));
    L.far.setEdge?.(edge);
    // the wonders; the nearest systems built, and the rest within the far
    // plane as discs, a sector's faded in over PLACE_IN from when it came
    let n = 0;
    let changed = restale;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      e.drawn.update(t, dt, camera);
      if (outOf(e.sector.origin, cam) <= FAR + e.margin) {
        if (fed[n] !== e) changed = true;
        fed[n] = e;
        shares[n++] = Math.min(1, e.age / PLACE_IN);
      }
      e.age += dt;
    }
    if (fed.length !== n) {
      fed.length = n;
      changed = true;
    }
    if (changed) {
      fedSectors = fed.map((e) => e.sector);
      systems = fedSectors.flatMap((x) => x.systems);
      restale = false;
    }
    if (L.own) {
      L.own.points.visible = true;
      L.own.update(camera, dt);
    }
    const ts = spaceTime(now);
    near.update(systems, cam, ts, camera, t);
    L.discs.feed(fedSectors, cam, ts, shares);
    // (the specks come in where the discs' budget ends)
    L.far.setDiscEdge?.(L.discs.edge());
  }

  return {
    root,
    update({ ship, camera, t = 0, dt = 1 / 60, now = 0 }) {
      const t0 = timer();
      if (!ship || sectorOf(ship.x, ship.y ?? 0, ship.z) === 'rickmorty') {
        if (awake) sleep();
      } else {
        awake = true;
        fly(ship, camera, t, dt, now);
      }
      most = Math.max(most, timer() - t0);
    },
    loaded: () => [...byId.keys()],
    sector: () => (here ? sectorKey(...here) : null),
    sectors: () => byId,
    nearestSystem(at) {
      let best = null;
      for (const sector of sectorList) {
        for (const system of sector.systems) {
          const d = Math.hypot(system.at[0] - at[0], system.at[1] - at[1], system.at[2] - at[2]);
          if (!best || d < best.dist) best = { system, sector, dist: d };
        }
      }
      return best;
    },
    stars() {
      const built = near.stars();
      lit.length = STARS.length;
      for (let i = 0; i < built.length; i++) lit.push(built[i]);
      return lit;
    },
    solids: () => near.solids(),
    setStep(step, floor = false) {
      stepped = universeBudget({ tier, detail }, step, floor);
      layer?.discs.setBudget(stepped);
      near.setStep(step);
    },
    pops: () => layer?.far.pops?.() ?? NO_POPS,
    workMs() {
      const m = most;
      most = 0;
      return m;
    },
    reload(id) {
      const at = parseSectorKey(id);
      const k = at && cellKey(at);
      if (!k || !held.has(k) || asked.has(sectorJobKey(at))) return false;
      askSector(k, true);
      return true;
    },
    dispose() {
      sleep();
      near.dispose();
      layer?.own?.dispose();
      root.clear();
      root.removeFromParent();
    },
  };
}
