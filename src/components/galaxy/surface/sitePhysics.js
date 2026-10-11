// Rapier on every galaxy surface (the owner's word, 2026-10-11: the engine
// for every world, the 2017 game's own shapes where the world is the game's).
// A world drawn from a level pack with the game's collision (Hoth: lane P0's
// stream, level/levelPhysics.js) keeps that; every other world gets a Rapier
// world made from what the walker already walks on, so the 2017 soldier's
// body (playerBody.js) stands on it the same way:
// - the ground: 64 m heightfields from the world's own heightAt (the ground
//   as drawn), in a ring of cells round you, as the level's terrain is;
// - the solids (walker.js's createSolids: the circles and boxes you walk
//   into) as fixed cylinders and boxes from their base to their top (a solid
//   with no top stands TALL over the ground; one with no base goes BURY
//   under it), each turned off while it is `off` (a gate that is up);
// - the floors (Cloud City's walkways, a room's raised deck) as slabs
//   SLAB thick under their top, a floor that `moves` a kinematic one
//   following its height.
// What is placed after a cell came (the placer's later props) joins it at
// the next update. Where the world has the 2017 game's material grid (the
// site's `materials`: its level's book, lib/physics/materials.js, and the
// indices its ground, boxes and circles stand for), each collider carries
// its material index as its tag (what a bolt meets, as on a level) and the
// grid's friction and bounce; else the engine's own. No three.js, no DOM.
//
//   solidBody(solid, heightAt, surface?) → desc | null   (pure: physics.add's desc)
//   floorBody(floor, surface?) → desc | null             (pure)
//   surfaceOf(materials, book, hit) → { tag, friction, restitution } | null   (pure)
//   cellsAround([x, z], cell, ring) → Set<"cx,cz">   (pure)
//   createSitePhysics({ physics, world, materials, book, cell = CELL, ring = RING }) →
//     { update([x, z]), stats() → { cells, heightfields, solids, floors }, dispose() }

import { addHeightfield } from '../../../lib/physics/heightfield';
import { frictionOf, tagOf } from '../../../lib/physics/materials';

export const CELL = 64; // m: a heightfield's side, the level's terrain cell
export const RING = 1; // cells either side of yours: 192 m square round you
export const TALL = 12; // m: a solid with no top (walker.js's: it stops you whatever your height)
export const BURY = 1; // m: a solid with no base goes this far under the ground
export const SLAB = 0.3; // m: a floor's thickness under its top

const yawQuat = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];

// what a collider is made of: its material index and the grid's friction
// and bounce; null without the world's grid (the engine's own then)
export function surfaceOf(materials, book, hit) {
  const tag = tagOf(materials, hit);
  if (tag == null) return null;
  return { tag, ...frictionOf(book, tag) };
}
const dressed = (desc, surface) => {
  if (!desc || !surface) return desc;
  const { tag, friction, restitution } = surface;
  return { ...desc, friction, restitution, colliders: desc.colliders.map((c) => ({ ...c, tag: c.tag ?? tag })) };
};
const keyOf = (cx, cz) => `${cx},${cz}`;
const cellOf = (x, cell) => Math.floor(x / cell);

export function solidBody(s, heightAt, surface = null) {
  if (!s || !Number.isFinite(s.x) || !Number.isFinite(s.z)) return null;
  const ground = heightAt(s.x, s.z);
  const base = Number.isFinite(s.base) ? s.base : ground - BURY;
  const top = Number.isFinite(s.top) ? s.top : ground + TALL;
  const half = (top - base) / 2;
  if (!(half > 0.01)) return null;
  const position = [s.x, base + half, s.z];
  if (s.type === 'circle') {
    if (!(s.r > 0)) return null;
    return dressed({ type: 'fixed', position, group: 'object', colliders: [{ shape: 'cylinder', args: [half, s.r], tag: s.tag ?? null }] }, surface);
  }
  if (!(s.hw > 0 && s.hd > 0)) return null;
  // (walker.js keeps cos and sin of the yaw, as three.js turns a thing about y)
  return dressed({ type: 'fixed', position, rotation: yawQuat(Math.atan2(s.s ?? 0, s.c ?? 1)), group: 'object', colliders: [{ shape: 'cuboid', args: [s.hw, half, s.hd], tag: s.tag ?? null }] }, surface);
}

export function floorBody(f, surface = null) {
  if (!f || !Number.isFinite(f.x) || !Number.isFinite(f.z) || !Number.isFinite(f.y)) return null;
  const type = f.moves ? 'kinematicPositionBased' : 'fixed';
  const position = [f.x, f.y - SLAB / 2, f.z];
  if (f.r != null) return f.r > 0 ? dressed({ type, position, group: 'floor', colliders: [{ shape: 'cylinder', args: [SLAB / 2, f.r] }] }, surface) : null;
  if (!(f.hw > 0 && f.hd > 0)) return null;
  return dressed({ type, position, rotation: yawQuat(f.yaw ?? 0), group: 'floor', colliders: [{ shape: 'cuboid', args: [f.hw, SLAB / 2, f.hd] }] }, surface);
}

export function cellsAround([x, z], cell = CELL, ring = RING) {
  const out = new Set();
  const cx = cellOf(x, cell);
  const cz = cellOf(z, cell);
  for (let i = -ring; i <= ring; i++) for (let j = -ring; j <= ring; j++) out.add(keyOf(cx + i, cz + j));
  return out;
}

export function createSitePhysics({ physics, world, materials = null, book = null, cell = CELL, ring = RING }) {
  const surface = (hit) => (materials ? surfaceOf(materials, book, hit) : null);
  const groundSurface = surface({ ground: true });
  const cells = new Map(); // key → { heightfields: Body[] }
  const solids = new Map(); // solid → Body (its cell's while the cell is in)
  const floors = new Map(); // floor → Body
  let seenSolids = 0;
  let seenFloors = 0;
  let disposed = false;
  const heightAt = (x, z) => {
    const h = world.heightAt(x, z);
    return Number.isFinite(h) ? h : 0;
  };
  const inCells = (x, z) => cells.has(keyOf(cellOf(x, cell), cellOf(z, cell)));
  const add = (desc) => {
    try {
      return desc ? physics.add(desc) : null;
    } catch {
      return null; // (a shape the engine won't build: the rest still go in)
    }
  };
  const put = (map, thing, make) => {
    if (map.has(thing) || !inCells(thing.x, thing.z)) return;
    const body = add(make(thing));
    if (body) map.set(thing, body);
  };
  const putSolid = (s) => put(solids, s, (x) => solidBody(x, heightAt, surface({ solid: x, tag: x.tag })));
  const putFloor = (f) => put(floors, f, (x) => floorBody(x, groundSurface));

  function addCell(key) {
    const [cx, cz] = key.split(',').map(Number);
    const n = 65;
    const step = cell / (n - 1);
    const x = cx * cell;
    const z = cz * cell;
    const heights = new Float32Array(n * n);
    for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) heights[iz * n + ix] = heightAt(x + ix * step, z + iz * step);
    let field = null;
    try {
      field = addHeightfield(physics, { heights, n, size: cell, x, z, ...(groundSurface ?? {}) });
    } catch {
      field = null;
    }
    cells.set(key, { heightfields: field ? [field] : [] });
    const mid = [x + cell / 2, z + cell / 2];
    for (const s of world.solids?.near?.(mid[0], mid[1], cell * 0.75) ?? []) putSolid(s);
    for (const f of world.floors ?? []) putFloor(f);
  }

  function dropCell(key) {
    const c = cells.get(key);
    if (!c) return;
    cells.delete(key);
    for (const b of c.heightfields) physics.remove(b);
    for (const map of [solids, floors])
      for (const [thing, body] of map)
        if (!inCells(thing.x, thing.z)) {
          physics.remove(body);
          map.delete(thing);
        }
  }

  return {
    update(at) {
      if (disposed || !at) return;
      const want = cellsAround(at, cell, ring);
      for (const key of [...cells.keys()]) if (!want.has(key)) dropCell(key);
      for (const key of want) if (!cells.has(key)) addCell(key);
      // (what the placer put down since: into the cells it falls in)
      const all = world.solids?.all ?? [];
      for (; seenSolids < all.length; seenSolids++) putSolid(all[seenSolids]);
      const fl = world.floors ?? [];
      for (; seenFloors < fl.length; seenFloors++) putFloor(fl[seenFloors]);
      // a gate up or down; a floor that moves, where it is now
      for (const [s, body] of solids) body.enable?.(!s.off);
      for (const [f, body] of floors) {
        body.enable?.(!f.off);
        if (f.moves && body.body?.setNextKinematicTranslation) body.body.setNextKinematicTranslation({ x: f.x, y: f.y - SLAB / 2, z: f.z });
      }
    },
    stats: () => ({ cells: cells.size, heightfields: [...cells.values()].reduce((n, c) => n + c.heightfields.length, 0), solids: solids.size, floors: floors.size }),
    dispose() {
      if (disposed) return;
      for (const key of [...cells.keys()]) dropCell(key);
      for (const map of [solids, floors]) {
        for (const body of map.values()) physics.remove(body);
        map.clear();
      }
      disposed = true;
    },
  };
}
