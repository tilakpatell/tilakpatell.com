// A level pack's collision, streamed with its cells (lane P0 of the 2017
// physics design, docs/superpowers/specs/2026-10-10-bf2017-physics-design.md
// §1): beside lane L's colliders.js, as it is (add when the stream brings a
// cell, drop when it goes, from level/index.js's onCell and onDrop), the
// cell's placed meshes
// that have shapes become fixed bodies in the physics world (havok.js), and
// its ground a heightfield per 64 m from the same heights the ground is
// drawn from; when the cell goes, so do they (removed, not switched off as
// the walk world's shapes are: a body costs memory). The far ring and the
// horizon have none; a mesh the tier culls (pack.cull[tier]) stops no one.
//
// A mesh's shapes bin is fetched once (loadBin, lane L's fetch) and kept.
// A cell over its budget drops its detail and its lightest hulls first
// (havok.js's budgetCell) and says what in stats(). Bodies go into the
// world a slice at a time (update(ms) each frame), so a dense cell (Echo
// Base: 6,500 placed pieces, 12,800 shapes) doesn't stall a frame. A cell
// removed from inside a step (a substep hook) is gone once the step is
// done (world.js defers it); a cell arriving after dispose() adds nothing.
//
//   wantsEngine({ pack, small, tier }) → bool: not a phone, not low, a pack
//     whose `physics` section has meshes (the one rule)
//   createLevelPhysics({ physics (createPhysics's), pack (level.json, with
//     its `physics` section), loadBin(path) → Promise<ArrayBuffer>, tier =
//     'high', budget = BUDGETS[tier], cellSize = pack.cell ?? 128,
//     terrainCell = 64 })
//     → { add(key, bin) / addCell → Promise (bin: the cell's own, lane L's
//         32-byte records, read with pack.cells[key].draws; or
//         [{ mesh, position, quaternion, scale }]),
//       drop(key) / removeCell, setTerrain(heightAt | { near, far }), timed(stepMs),
//         update(ms = 4, at = [x, z] (the nearest cell's first))
//         → bodies added, stats() → { cells, bodies, colliders,
//         uniqueShapes, triangles, heightfields, queued, dropped, stepMs },
//       dispose() }
//   BUDGETS: per cell, by tier (low and phones: no engine at all)
//   instancesOf(draws, bin) → [{ mesh, position, quaternion, scale }] (lane
//     L's records: position Float32 × 3, quaternion Int16 × 4 over 32767,
//     scale Float32 × 3, 32 bytes each; lib/level/instances.js's layout)
//   imageHeight({ near, far }) → heightAt(x, z): bilinear in near where it
//     covers, else far, else 0; a hole (not a number) reads the next map
//     (maps in metres; on the scene, pass setTerrain lane L's own sampler,
//     (x, z) => LAYERS.image(x, z, layer), so the floor is the ground drawn)

import { addHeightfield } from '../../../../lib/physics/heightfield.js';
import { budgetCell, cellBodies, collidersOf, readShapes } from '../../../../lib/physics/havok.js';

// (measured on Hoth's densest cell, Echo Base: 400 colliders keep 93% of its
// hulls' volume, 1,000 keep 97% at 0.2 ms a step; docs/superpowers/
// HANDOFF-bf2017-physics.md has the table)
export const BUDGETS = {
  mid: { colliders: 400, triangles: 30000 },
  high: { colliders: 1000, triangles: 60000 },
  ultra: { colliders: 2000, triangles: 100000 },
};

export const wantsEngine = ({ pack, small = false, tier = 'high' }) => Boolean(!small && tier !== 'low' && Object.keys(pack?.physics?.meshes ?? {}).length);

const RECORD = 32;

export function instancesOf(draws, bin) {
  const v = bin instanceof ArrayBuffer ? new DataView(bin) : new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const out = [];
  for (const d of draws ?? [])
    for (let i = d.offset; i < d.offset + d.count; i++) {
      const o = i * RECORD;
      if (o + RECORD > v.byteLength) break;
      const f = (k) => v.getFloat32(o + k * 4, true);
      const q = [0, 1, 2, 3].map((k) => v.getInt16(o + 12 + k * 2, true) / 32767);
      const l = Math.hypot(...q) || 1;
      out.push({ mesh: d.mesh, position: [f(0), f(1), f(2)], quaternion: q.map((x) => x / l), scale: [v.getFloat32(o + 20, true), v.getFloat32(o + 24, true), v.getFloat32(o + 28, true)] });
    }
  return out;
}

function sample(map, x, z) {
  const fx = (x - map.minX) / map.metresPerPixel;
  const fz = (z - map.minZ) / map.metresPerPixel;
  if (!(fx >= 0 && fz >= 0 && fx <= map.w - 1 && fz <= map.h - 1)) return NaN;
  const ix = Math.min(Math.floor(fx), map.w - 2);
  const iz = Math.min(Math.floor(fz), map.h - 2);
  const tx = fx - ix;
  const tz = fz - iz;
  const at = (i, j) => map.data[j * map.w + i];
  return (at(ix, iz) * (1 - tx) + at(ix + 1, iz) * tx) * (1 - tz) + (at(ix, iz + 1) * (1 - tx) + at(ix + 1, iz + 1) * tx) * tz;
}

export function imageHeight({ near = null, far = null }) {
  return (x, z) => {
    for (const map of [near, far]) {
      if (!map) continue;
      const h = sample(map, x, z);
      if (Number.isFinite(h)) return h;
    }
    return 0;
  };
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createLevelPhysics({ physics, pack, loadBin, tier = 'high', budget = BUDGETS[tier] ?? BUDGETS.high, cellSize = pack.cell ?? 128, terrainCell = 64 }) {
  const culled = new Set(pack.cull?.[tier]?.dropped ?? []);
  const section = pack.physics ?? { meshes: {}, materials: {} };
  const shapes = new Map(); // mesh → Promise<colliders | null>
  const cells = new Map(); // key → { bodies, queue, heightfields, dropped, colliders, triangles }
  let heightAt = null;
  let disposed = false;
  let stepMs = 0;

  function collidersFor(mesh) {
    const key = String(mesh);
    if (!shapes.has(key)) {
      const rec = section.meshes?.[key];
      shapes.set(
        key,
        rec
          ? Promise.resolve(loadBin(rec.file))
              .then((buf) => collidersOf(readShapes(buf), { materials: section.materials }))
              .catch(() => null)
          : Promise.resolve(null),
      );
    }
    return shapes.get(key);
  }

  function terrainFor(cell, key) {
    if (!heightAt || cell.heightfields.length) return;
    const [cx, cz] = key.split(',').map(Number);
    const n = terrainCell + 1;
    for (let i = 0; i < cellSize / terrainCell; i++)
      for (let j = 0; j < cellSize / terrainCell; j++) {
        const x = cx * cellSize + i * terrainCell;
        const z = cz * cellSize + j * terrainCell;
        const heights = new Float32Array(n * n);
        for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) heights[iz * n + ix] = heightAt(x + ix * (terrainCell / (n - 1)), z + iz * (terrainCell / (n - 1)));
        cell.heightfields.push(addHeightfield(physics, { heights, n, size: terrainCell, x, z }));
      }
  }

  async function addCell(key, cellIn) {
    if (disposed || cells.has(key)) return;
    const cell = { bodies: [], queue: [], heightfields: [], dropped: [], colliders: 0, triangles: 0, gone: false };
    cells.set(key, cell);
    terrainFor(cell, key);
    const instances = (Array.isArray(cellIn) ? cellIn : instancesOf(pack.cells?.[key]?.draws, cellIn)).filter((i) => !culled.has(i.mesh));
    const byMesh = {};
    for (const mesh of new Set(instances.map((i) => String(i.mesh)))) {
      const c = await collidersFor(mesh);
      if (c?.length) byMesh[mesh] = c;
    }
    // (gone while the shapes came, or the whole thing put away)
    if (disposed || cell.gone || cells.get(key) !== cell) return;
    const { kept, dropped } = budgetCell(cellBodies(instances, byMesh), budget);
    cell.dropped = dropped;
    cell.queue = kept;
  }

  function removeCell(key) {
    const cell = cells.get(key);
    if (!cell) return;
    cell.gone = true;
    cells.delete(key);
    for (const b of [...cell.bodies, ...cell.heightfields]) physics.remove(b);
  }

  // bodies into the world until `ms` has gone (at least one a call); `at`
  // ([x, z], where you are): the nearest cell's first, so the deck under you
  // is solid before the far side of the map
  const nearFirst = (at) => {
    if (!at) return [...cells.values()];
    const d = (key) => {
      const [cx, cz] = key.split(',').map(Number);
      return Math.hypot((cx + 0.5) * cellSize - at[0], (cz + 0.5) * cellSize - at[1]);
    };
    return [...cells.keys()].sort((a, b) => d(a) - d(b)).map((k) => cells.get(k));
  };
  function update(ms = 4, at = null) {
    if (disposed) return 0;
    const start = now();
    let added = 0;
    for (const cell of nearFirst(at)) {
      while (cell.queue.length) {
        const desc = cell.queue.shift();
        try {
          cell.bodies.push(physics.add(desc));
        } catch {
          continue; // (a shape the engine won't build: the rest still go in)
        }
        for (const c of desc.colliders) {
          cell.colliders++;
          cell.triangles += c.triangles ?? 0;
        }
        added++;
        if (now() - start > ms) return added;
      }
    }
    return added;
  }

  return {
    addCell,
    removeCell,
    // (colliders.js's names)
    add: addCell,
    drop: removeCell,
    update,
    setTerrain(source) {
      if (disposed) return;
      heightAt = typeof source === 'function' ? source : source ? imageHeight(source) : null;
      for (const [key, cell] of cells) {
        for (const b of cell.heightfields) physics.remove(b);
        cell.heightfields = [];
        terrainFor(cell, key);
      }
    },
    // (the step timed by whoever steps: scene.js passes it in)
    timed(ms) {
      stepMs = ms;
    },
    stats() {
      let bodies = 0;
      let colliders = 0;
      let triangles = 0;
      let heightfields = 0;
      let queued = 0;
      const dropped = [];
      const unique = new Set();
      for (const [key, c] of cells) {
        bodies += c.bodies.length;
        for (const b of c.bodies) for (const d of b.desc.colliders) unique.add(d.args[0]);
        colliders += c.colliders;
        triangles += c.triangles;
        heightfields += c.heightfields.length;
        queued += c.queue.length;
        for (const d of c.dropped) dropped.push({ cell: key, ...d });
      }
      return { cells: cells.size, bodies, colliders, uniqueShapes: unique.size, triangles, heightfields, queued, dropped, stepMs };
    },
    dispose() {
      if (disposed) return;
      for (const key of [...cells.keys()]) removeCell(key);
      disposed = true;
      shapes.clear();
    },
  };
}
