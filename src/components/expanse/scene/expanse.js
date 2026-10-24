// The Expanse on the universe map: the generated sectors (gen/sector.js)
// round the ship, drawn, and the ones past them as a star field. Asleep
// inside the rim (the map there is as it always was: nothing is made, the
// origin stays at the middle); past RIM.outer, or out in an Expanse sector,
// it wakes: the 3 × 3 of sectors round the ship comes in through a chunk
// grid (runtime/chunkGrid.js, a sector a cell, radius 1), one sector built
// a frame, nearest and ahead first, and goes again a sector behind; the
// authored sector (0,0) is never built, it's the map. Back inside RIM.inner
// it all goes.
//
// Each loaded sector is drawn in levels.js's levels: its wonders as
// sectors.js draws them; its stars and wonders as a slot of specks in the
// far layer (sectors.js's slotOf, faded in over SLOT_IN), past the far
// plane; its stars, planets, moons and wonders as discs within it
// (discs.js), fed every frame; and the nearest systems built whole
// (near.js), its discs giving way to them. Planets and moons go round on the
// shared clock (orbits.js's spaceTime of the wall time it's given).
//
// The floating origin (runtime/origin.js): out in the Expanse the ship's
// position is checked against it each frame, and when it moves (by whole
// cells, ORIGIN_CELL) everything here is re-anchored in that same frame:
// the root sits at the origin and each sector's group at its middle less
// the origin, so the sum, where it's drawn, never changes (nothing jumps)
// while the numbers inside each sector stay small however far out. Home
// again, the origin goes back to the middle. (What's built and the far
// layer keep the map's own numbers: they're drawn round the camera.)
//
// Nothing generated is kept: a sector is made from its seed each time it's
// needed (and a few are remembered while the ship's near them).
//
// What it builds is solid and lit by its own star: the ship hits its
// stars, planets and moons (solids(), for ship.js's step, through
// shipHits.js's solidsWith), and its stars light the map as the hand-made
// ones do (stars(), for lighting.js's lightAt).
//
// createExpanse(parent, { universe, origin, make, makeStarfield, makeNear,
//   build, far, tier, detail, budget, prepare, reduced, onSector, onShift })
//   → { root, update({ ship, camera, t, dt, now }), loaded(), sector(),
//   active(), stars(), solids(), setStep(step, floor), pops(), dispose() }
//   far: the far layer to draw in (universe/farStars.js's, in the parent's
//   space, made with farRoom's room and updated before this each frame);
//   none, and it makes its own under the parent the first time it wakes
//   tier, detail: the device's (lib/device), for the budget; budget:
//   universe/budget.js's row (the level's, unless it's given)
//   build: near.js's body builder (galaxy/bodies.js's buildBody, unless it's given)
//   prepare(root, alive): the scene's warm(), for what near.js builds
//   (near.js's: alive() says whether that system's still held)
//   update: `t` the scene's clock, `now` the wall time in ms (0 holds the
//   orbits where they start)
//   stars(): lighting.js's STARS, then the light of each system built; one
//   array, the same every frame
//   solids(): what's built, each where it is this frame ({ id, at, r,
//   reach }, near.js's); one array, kept while what's built stays the same
//   setStep(step, floor): the pace's (qualityStep.js's stepAt): the discs
//   to the level's budget at that step, and near.js's detail with it
//   pops(): its far layer's (dev): what came in at once, since last asked
// farRoom({ tier, detail }) → { slots, discs }: the room a far layer is made
//   with for a level, the budget's slots and half again its discs (an edge
//   easing in draws more than the budget)
// activeAt(ship, was) → whether it's awake for a ship at (x, z), given whether it was

import * as THREE from 'three';
import { createChunkGrid } from '../../../runtime/chunkGrid';
import { RIM, inExpanse, sectorOf } from '../../universe/layout';
import { SKY_FAR, createFarStars, universeBudget } from '../../universe/shared/far';
import { STARS } from '../../universe/shared/space';
import { spaceTime } from '../gen/orbits';
import { SECTOR, makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { addBodies } from '../gen/systems';
import { sectorAt, sectorId } from '../gen/grid';
import { createDiscs } from './discs';
import { createNear } from './near';
import { createSector, slotOf } from './sectors';
import { createStarfield } from './starfield';

const KEEP = 32; // sectors remembered, made
const SLOT_IN = 1; // a sector's specks fade in over this many seconds
const DISC_ROOM = 1.5; // a far layer's room for discs, of the budget's (an edge easing in draws more)
const NONE = [];
const NO_POPS = Object.freeze({ count: 0, px: 0 });

const roomOf = (budget) => ({ slots: Array(budget.nearSlots).fill(budget.slotSize), discs: Math.ceil(budget.discs * DISC_ROOM) });
export const farRoom = (level) => roomOf(universeBudget(level));

export function activeAt(ship, was) {
  if (!ship) return false;
  const sec = sectorOf(ship.x, 0, ship.z);
  if (inExpanse(sec)) return true;
  if (sec !== 'main') return false; // (the Rick and Morty pocket)
  const r = Math.hypot(ship.x, ship.z);
  return was ? r > RIM.inner : r > RIM.outer;
}

const parseKey = (key) => key.split(',').map(Number);

export function createExpanse(parent, { universe = UNIVERSE, origin, make = createSector, makeStarfield = createStarfield, makeNear = createNear, build, far = null, tier = 'mid', detail, budget = universeBudget({ tier, detail }), prepare = null, reduced = false, onSector = null, onShift = null } = {}) {
  const root = new THREE.Group();
  root.name = 'expanse';
  parent.add(root);
  // what's built, in the map's space: under the root, less where it is
  const nearRoot = new THREE.Group();
  nearRoot.name = 'expanse-near';
  root.add(nearRoot);
  const near = makeNear(nearRoot, { budget, tier, prepare, build });
  // the far layer and its discs, made the first time it wakes (at the pace's
  // step it was last told); and its slots
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
  // the light of what's built, after the map's own (one array, kept)
  const lit = [...STARS];
  const slots = new Map(); // key → its slot
  const camAt = new THREE.Vector3();
  const cam = [0, 0, 0];
  const grid = createChunkGrid({ size: SECTOR, radius: 1, inFlight: 1 });
  // (the grid's cells are corner-based; the sectors are centred on theirs:
  // asked for by the sector's middle, so a cell is a sector)
  const half = SECTOR / 2;
  const made = new Map(); // id → Sector
  const sectorFor = (sx, sz) => {
    const id = sectorId(sx, sz);
    let s = made.get(id);
    if (!s) {
      if (made.size >= KEEP) made.delete(made.keys().next().value);
      made.set(id, (s = addBodies(makeSector(universe, sx, sz))));
    }
    return s;
  };
  const drawn = new Map(); // key 'sx,sz' → drawn sector (or null: the authored one)
  let sectors = []; // what's drawn: the sectors, and their systems
  let systems = [];
  const relist = () => {
    sectors = [...drawn.values()].filter(Boolean).map((d) => d.sector);
    systems = sectors.flatMap((x) => x.systems);
  };
  let field = null;
  let awake = false;
  let here = null; // the sector the ship's in, 'sx,sz'
  let at = [0, 0, 0]; // the origin, as last anchored to

  const anchor = () => {
    at = origin ? origin.at : [0, 0, 0];
    root.position.set(at[0], at[1], at[2]);
    nearRoot.position.set(-at[0], -at[1], -at[2]);
    for (const d of drawn.values()) d?.reanchor(at);
    field?.reanchor(at);
  };
  const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

  const drop = (key) => {
    drawn.get(key)?.dispose();
    drawn.delete(key);
    grid.unload(key);
    const i = slots.get(key);
    if (i !== undefined) {
      layer.far.hideSlots([i]);
      layer.free.push(i);
      slots.delete(key);
    }
    relist();
  };
  const sleep = () => {
    for (const key of [...drawn.keys()]) drop(key);
    near.update(NONE, cam);
    if (layer) {
      layer.far.discs.begin();
      layer.far.discs.end();
      if (layer.own) layer.own.points.visible = false;
    }
    grid.reset();
    field?.dispose();
    field = null;
    here = null;
    awake = false;
    if (origin && !same(origin.at, [0, 0, 0])) {
      const shift = origin.at.map((v) => -v);
      origin.reset();
      onShift?.(shift);
    }
    anchor();
  };

  const api = {
    root,
    update({ ship, camera, t = 0, dt = 1 / 60, now = 0 }) {
      const want = activeAt(ship, awake);
      if (!want) {
        if (awake || drawn.size) sleep();
        return;
      }
      awake = true;
      // the origin: moved out in the Expanse, and everything re-anchored with it
      if (origin && inExpanse(sectorOf(ship.x, 0, ship.z))) {
        const shift = origin.check([ship.x, ship.y ?? 0, ship.z]);
        if (shift) onShift?.(shift);
      }
      if (!origin || !same(origin.at, at)) anchor();
      // the sector the ship's in: the star field round it rebuilt as it changes
      const [sx, sz] = sectorAt(ship.x, ship.z);
      const key = `${sx},${sz}`;
      if (key !== here) {
        here = key;
        field ??= makeStarfield(root, {});
        field.rebuild(universe, sx, sz, at);
        onSector?.(sectorId(sx, sz));
      }
      // the 3 × 3: what's gone behind let go, one more built
      const heading = Number.isFinite(ship.heading) ? [-Math.sin(ship.heading), -Math.cos(ship.heading)] : null;
      const { ask, drop: gone, cancel } = grid.update({ x: ship.x + half, z: ship.z + half, heading });
      for (const k of gone) drop(k);
      for (const k of cancel) grid.failed(k);
      const next = ask[0];
      if (next) {
        const gen = grid.gen;
        grid.began(next, gen);
        const [cx, cz] = parseKey(next);
        let d = null;
        if (cx !== 0 || cz !== 0) {
          const s = sectorFor(cx, cz);
          d = make(s, { tier, reduced });
          root.add(d.group);
          d.reanchor(at);
        }
        if (grid.done(next, gen)) {
          drawn.set(next, d);
          relist();
          // (its stars and wonders as specks, faded in)
          const L = layerOf();
          const i = d ? L.free.pop() : undefined;
          if (i !== undefined) {
            L.far.setSlot(i, slotOf(d.sector));
            L.far.fadeSlot(i, SLOT_IN);
            slots.set(next, i);
          }
        } else d?.dispose();
      }
      for (const d of drawn.values()) d?.update(t, dt, camera);
      field?.update(camera, dt);
      // the nearest systems built, and the rest within the far plane as discs
      const L = layerOf();
      if (L.own) {
        L.own.points.visible = true;
        L.own.update(camera, dt);
      }
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      cam[0] = camAt.x;
      cam[1] = camAt.y;
      cam[2] = camAt.z;
      const ts = spaceTime(now);
      near.update(systems, cam, ts, camera, t);
      L.discs.feed(sectors, cam, ts);
    },
    loaded: () => [...drawn.entries()].filter(([, d]) => d).map(([, d]) => d.sector.id),
    sector: () => (here ? sectorId(...parseKey(here)) : null),
    active: () => awake,
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
    dispose() {
      sleep();
      near.dispose();
      layer?.own?.dispose();
      root.removeFromParent();
    },
  };
  return api;
}
