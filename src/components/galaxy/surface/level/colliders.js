// The level's collision in the walk world (lane L, task 4): a cell's floors
// and solids (src/lib/level/collision.js) added to the scene's walk world
// when the cell comes, switched off when it goes and on again when it
// comes back (the walk world's shapes have no remove: `off` is how a gate
// or a trapdoor goes, walker.js), so nothing is added twice.
//
// A pack with the game's shapes (its `physics` section, lane P0) and a
// loadBin: the pieces that have shapes stop you at their hulls
// (lib/level/shapeSolids.js: each hull's footprint a box, a thin wide one
// a floor, a capsule a circle), read once a mesh; the rest by their bounds
// as before. That cell's add is then a promise; a cell dropped while its
// shapes are read comes in switched off.
//
//   createColliders({ solids, floors }, tier, { loadBin }) → { add(key, pack, bin) → undefined | Promise, drop(key), dispose() }
// (a mesh the tier does not draw stops no one: no wall you cannot see)

import { solidsOf } from '../../../../lib/level/collision.js';
import { shapeReader, shapeSolids } from '../../../../lib/level/shapeSolids.js';

export function createColliders(walk, tier = 'high', { loadBin = null } = {}) {
  const byCell = new Map(); // key → the shapes it added
  const dropped = new Set(); // cells gone (their shapes off)
  let reader = null;
  let readerOf = null;
  const set = (key, off) => {
    for (const s of byCell.get(key) ?? []) s.off = off;
  };
  const put = (key, added, { floors = [], boxes = [], circles = [] }) => {
    const tag = `level:${key}`;
    for (const f of floors) {
      const floor = { ...f, tag };
      walk.floors.push(floor);
      added.push(floor);
    }
    for (const b of boxes) added.push(walk.solids.box(b.x, b.z, b.hw, b.hd, b.yaw, { top: b.top, base: b.base, tag }));
    for (const c of circles) added.push(walk.solids.circle(c.x, c.z, c.r, { top: c.top, base: c.base, tag }));
  };
  return {
    add(key, pack, bin) {
      dropped.delete(key);
      if (byCell.has(key)) return set(key, false);
      const c = pack.cells[key];
      if (!c) return;
      const draws = c.draws.filter((d) => !pack.cull?.[tier]?.dropped?.includes(d.mesh));
      const added = [];
      byCell.set(key, added);
      if (!loadBin || !Object.keys(pack.physics?.meshes ?? {}).length) {
        put(key, added, solidsOf(pack, draws, bin));
        return;
      }
      if (readerOf !== pack) {
        reader = shapeReader(pack, loadBin);
        readerOf = pack;
      }
      const meshes = [...new Set(draws.map((d) => d.mesh))];
      return Promise.all(meshes.map((m) => reader(m))).then((list) => {
        const shapesByMesh = {};
        meshes.forEach((m, i) => list[i] && (shapesByMesh[m] = list[i]));
        const fromShapes = shapeSolids(draws, bin, shapesByMesh);
        put(key, added, fromShapes);
        put(key, added, solidsOf(pack, fromShapes.without, bin));
        if (dropped.has(key)) set(key, true);
      });
    },
    drop: (key) => {
      dropped.add(key);
      set(key, true);
    },
    dispose() {
      for (const key of byCell.keys()) set(key, true);
    },
  };
}
