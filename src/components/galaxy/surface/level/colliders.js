// The level's collision in the walk world (lane L, task 4): a cell's floors
// and solids (src/lib/level/collision.js) added to the scene's walk world
// when the cell comes, switched off when it goes and on again when it
// comes back (the walk world's shapes have no remove: `off` is how a gate
// or a trapdoor goes, walker.js), so nothing is added twice.
//
// Where the pack has the game's shapes (level.json's `physics`, lane P0's
// physics/<mesh>.bin; a prop with none, its web/collision/ mesh's hull,
// lane E0) and a loader is given, a piece with shapes stands as its hulls
// (src/lib/level/shapeSolids.js), and only the rest as their bounds: the
// walker's solids on the tiers without the engine.
//
//   createColliders({ solids, floors }, tier, { loadBin }) → { add(key, pack, bin) → Promise, drop(key), dispose() }
// (a mesh the tier does not draw stops no one: no wall you cannot see)

import { solidsOf } from '../../../../lib/level/collision.js';
import { shapeReader, shapeSolids } from '../../../../lib/level/shapeSolids.js';

export function createColliders(walk, tier = 'high', { loadBin = null } = {}) {
  const byCell = new Map(); // key → the shapes it added
  const dropped = new Set(); // (a cell gone before its shapes were read)
  const readers = new WeakMap(); // pack → its shape reader
  const set = (key, off) => {
    for (const s of byCell.get(key) ?? []) s.off = off;
  };
  const put = (key, { floors, boxes, circles = [] }) => {
    const added = [];
    for (const f of floors) {
      const floor = { ...f, tag: `level:${key}` };
      walk.floors.push(floor);
      added.push(floor);
    }
    for (const b of boxes) added.push(walk.solids.box(b.x, b.z, b.hw, b.hd, b.yaw, { top: b.top, base: b.base, tag: `level:${key}` }));
    for (const c of circles) added.push(walk.solids.circle(c.x, c.z, c.r, { top: c.top, base: c.base, tag: `level:${key}` }));
    byCell.set(key, added);
    if (dropped.has(key)) set(key, true);
  };
  return {
    async add(key, pack, bin) {
      dropped.delete(key);
      if (byCell.has(key)) return set(key, false);
      const c = pack.cells[key];
      if (!c) return;
      byCell.set(key, []); // (claimed: a second add while the shapes are read adds nothing)
      const draws = c.draws.filter((d) => !pack.cull?.[tier]?.dropped?.includes(d.mesh));
      const shaped = loadBin && Object.keys(pack.physics?.meshes ?? {}).length;
      if (!shaped) return put(key, solidsOf(pack, draws, bin));
      if (!readers.has(pack)) readers.set(pack, shapeReader(pack, loadBin));
      const read = readers.get(pack);
      const meshes = [...new Set(draws.map((d) => d.mesh))];
      const shapes = Object.fromEntries(await Promise.all(meshes.map(async (m) => [m, await read(m)])));
      const fromShapes = shapeSolids(draws, bin, shapes);
      const rest = solidsOf(pack, fromShapes.without, bin);
      put(key, { floors: [...fromShapes.floors, ...rest.floors], boxes: [...fromShapes.boxes, ...rest.boxes], circles: fromShapes.circles });
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
