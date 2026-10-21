// The Expanse on the universe map: the generated sectors (gen/sector.js)
// round the ship, drawn, and the ones past them as a star field. Asleep
// inside the rim (the map there is as it always was: nothing is made); past
// RIM.outer, or out in an Expanse sector,
// it wakes: the 3 × 3 of sectors round the ship comes in through a chunk
// grid (runtime/chunkGrid.js, a sector a cell, radius 1), one sector built
// a frame, nearest and ahead first, and goes again a sector behind; the
// authored sector (0,0) is never built, it's the map. Back inside RIM.inner
// it all goes.
//
// Everything here sits in the map's own frame, in doubles: the root at the
// map's middle and each sector's group at its sector's middle, its contents
// in the sector's frame (small numbers). The map is drawn round the camera
// (universe/relative.js), so what reaches the chip is small however far out
// the ship is, and nothing here is ever re-anchored.
//
// Nothing generated is kept: a sector is made from its seed each time it's
// needed (and a few are remembered while the ship's near them).
//
// createExpanse(parent, { universe, make, makeStarfield,
//   tier, reduced, onSector }) → { root, update({ ship, camera, t,
//   dt }), loaded(), sector(), active(), dispose() }
// activeAt(ship, was) → whether it's awake for a ship at (x, z), given whether it was

import * as THREE from 'three';
import { createChunkGrid } from '../../../runtime/chunkGrid';
import { RIM, inExpanse, sectorOf } from '../../universe/layout';
import { SECTOR, makeSector } from '../gen/sector';
import { UNIVERSE } from '../gen/seed';
import { sectorAt, sectorId } from '../gen/grid';
import { createSector } from './sectors';
import { createStarfield } from './starfield';

const KEEP = 32; // sectors remembered, made

export function activeAt(ship, was) {
  if (!ship) return false;
  const sec = sectorOf(ship.x, 0, ship.z);
  if (inExpanse(sec)) return true;
  if (sec !== 'main') return false; // (the Rick and Morty pocket)
  const r = Math.hypot(ship.x, ship.z);
  return was ? r > RIM.inner : r > RIM.outer;
}

const parseKey = (key) => key.split(',').map(Number);

export function createExpanse(parent, { universe = UNIVERSE, make = createSector, makeStarfield = createStarfield, tier = 'mid', reduced = false, onSector = null } = {}) {
  const root = new THREE.Group();
  root.name = 'expanse';
  parent.add(root);
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
      made.set(id, (s = makeSector(universe, sx, sz)));
    }
    return s;
  };
  const drawn = new Map(); // key 'sx,sz' → drawn sector (or null: the authored one)
  let field = null;
  let awake = false;
  let here = null; // the sector the ship's in, 'sx,sz'

  const drop = (key) => {
    drawn.get(key)?.dispose();
    drawn.delete(key);
    grid.unload(key);
  };
  const sleep = () => {
    for (const key of [...drawn.keys()]) drop(key);
    grid.reset();
    field?.dispose();
    field = null;
    here = null;
    awake = false;
  };

  const api = {
    root,
    update({ ship, camera, t = 0, dt = 1 / 60 }) {
      const want = activeAt(ship, awake);
      if (!want) {
        if (awake || drawn.size) sleep();
        return;
      }
      awake = true;
      // the sector the ship's in: the star field round it rebuilt as it changes
      const [sx, sz] = sectorAt(ship.x, ship.z);
      const key = `${sx},${sz}`;
      if (key !== here) {
        here = key;
        field ??= makeStarfield(root, {});
        field.rebuild(universe, sx, sz);
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
        }
        if (grid.done(next, gen)) drawn.set(next, d);
        else d?.dispose();
      }
      for (const d of drawn.values()) d?.update(t, dt, camera);
      field?.update(camera, dt);
    },
    loaded: () => [...drawn.entries()].filter(([, d]) => d).map(([, d]) => d.sector.id),
    sector: () => (here ? sectorId(...parseKey(here)) : null),
    active: () => awake,
    dispose() {
      sleep();
      root.removeFromParent();
    },
  };
  return api;
}
