// The navgrid's walk mask from a level pack's shapes (the design's nav.bin,
// decision 15; the research: docs/superpowers/evidence/battlefront-lane5b/
// research-collision.md §3–4). Every placed mesh with shapes goes into the
// physics engine as lane P0's bodies (the pack's cell bins, its
// physics/<mesh>.bin), in the pack's frame; each question is turned into
// that frame (the pack's origin and yaw) and asked of the engine as the
// game's capsule controller asks it: from where a soldier stands, which
// surfaces (the shapes' tops, the ground) do the ground rays find at the
// next spot, and is the capsule free standing on one? navMask.js's
// buildWalkMask floods the map from its spawns on those answers, so a snow
// pile is walked up and over, a trench dropped into, and a wall is where the
// rise is past the climb. A blocked cell's top is a ray down from TOP_REACH
// over the ground. Most of a map's columns have no shape near them: each
// body's box is marked on the fine grid as it goes in (`near`), and the walk
// asks the engine nothing where none is (Hoth: 15.3 million columns, a
// twentieth of them near a shape).
//
//   capsuleOf(soldierJson) → { radius, step, height, sources }
//   raysOf(soldierJson) → { start, end, sources } (the ground probe's reach, the in-air end for the drops)
//   navMaskOf({ pack, loadBin, heightAt (export frame), holeAt, bounds, seeds, capsule, rays, climb, cell, fine }) → mask
//   pathTable({ map, heightAt, mask, cell, cover }) → rows of the measured paths
//
// Only the shapes: the ground's own slope is the navgrid's test.

import { CLIMB, buildWalkMask } from '../../src/lib/battlefront/navMask.js';
import { MAX_EXPAND, buildNav, findPath, walkable } from '../../src/lib/battlefront/nav.js';
import { cellBodies, collidersOf, readShapes } from '../../src/lib/physics/havok.js';
import { createPhysics } from '../../src/lib/physics/world.js';
import { instancesOf } from '../../src/components/galaxy/surface/level/levelPhysics.js';

// m over the ground a blocked cell's top is looked for from (hand: a byte of
// decimetres, navMask.js's TOP_MAX, is 25.5 m)
export const TOP_REACH = 25;

export function raysOf(soldier) {
  const r = soldier.rows[soldier.default].rays;
  return { start: r.groundStart, end: Math.min(r.groundEnd, r.airEnd), sources: { start: r.groundStart_source, end: r.airEnd_source } };
}

export function capsuleOf(soldier) {
  const row = soldier.rows[soldier.default];
  return {
    radius: row.radius,
    step: row.poses.stand.step,
    height: row.poses.stand.height,
    sources: { radius: row.radius_source, step: row.poses.stand.step_source, height: row.poses.stand.height_source },
  };
}

// the export's (x, y, z) in the pack's frame (level.js's toPack, with the height)
function packFrame(pack) {
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  return (x, y, z) => {
    const dx = x - ox;
    const dz = z - oz;
    return { x: dx * c + dz * s, y: y - oy, z: -dx * s + dz * c };
  };
}

// a point of a body's collider in the pack's frame: turned by the body's rotation, put at its place
function turned([qx, qy, qz, qw], x, y, z) {
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + (qy * tz - qz * ty), y + qw * ty + (qz * tx - qx * tz), z + qw * tz + (qx * ty - qy * tx)];
}

// a body's box on the ground (the pack's frame): [minX, minZ, maxX, maxZ] over its colliders
export function bodyBox(desc) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const grow = (x, z, r = 0) => {
    if (x - r < box[0]) box[0] = x - r;
    if (z - r < box[1]) box[1] = z - r;
    if (x + r > box[2]) box[2] = x + r;
    if (z + r > box[3]) box[3] = z + r;
  };
  const q = desc.rotation ?? [0, 0, 0, 1];
  const [px, , pz] = desc.position ?? [0, 0, 0];
  for (const c of desc.colliders ?? []) {
    if (c.shape === 'hull' || c.shape === 'trimesh') {
      const p = c.args[0];
      for (let i = 0; i < p.length; i += 3) {
        const [x, , z] = turned(q, p[i], p[i + 1], p[i + 2]);
        grow(px + x, pz + z);
      }
      continue;
    }
    // (a ball, a capsule or a box: a sphere round its middle holds it)
    const at = c.position ?? [0, 0, 0];
    const [x, , z] = turned(q, at[0], at[1], at[2]);
    const r = c.shape === 'ball' ? c.args[0] : c.shape === 'capsule' || c.shape === 'cylinder' ? c.args[0] + c.args[1] : Math.hypot(...(c.args ?? [0]));
    grow(px + x, pz + z, r);
  }
  return box;
}

async function loadBodies(physics, pack, loadBin, onBody = () => {}) {
  const section = pack.physics ?? { meshes: {}, materials: {} };
  const byMesh = {};
  for (const [mesh, rec] of Object.entries(section.meshes ?? {})) {
    const buf = await loadBin(rec.file).catch(() => null);
    if (buf) byMesh[mesh] = collidersOf(readShapes(buf), { materials: section.materials });
  }
  let bodies = 0;
  let refused = 0;
  for (const key of Object.keys(pack.cells ?? {}).sort()) {
    const c = pack.cells[key];
    const bin = await loadBin(c.bin ?? `cells/${key.replace(',', '_')}.bin`).catch(() => null);
    if (!bin) continue;
    for (const desc of cellBodies(instancesOf(c.draws, bin), byMesh)) {
      try {
        physics.add(desc);
        bodies++;
        onBody(desc);
      } catch {
        refused++;
      }
    }
  }
  physics.world.step();
  return { bodies, refused };
}

// The fine grid's columns a shape is near: each body's box (the pack's
// frame, put into the export's) grown by the capsule's reach, marked.
function nearGrid({ bounds, cell, fine, pack, reach }) {
  const k = Math.round(cell / fine);
  const f = cell / k;
  const cols = Math.ceil((bounds.max[0] - bounds.min[0]) / cell) * k;
  const rows = Math.ceil((bounds.max[1] - bounds.min[1]) / cell) * k;
  const marks = new Uint8Array(cols * rows);
  const [ox, , oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  const out = (x, z) => [ox + x * c - z * s, oz + x * s + z * c];
  let marked = 0;
  return {
    mark(desc) {
      const b = bodyBox(desc);
      if (!Number.isFinite(b[0])) return;
      const corners = [out(b[0], b[1]), out(b[2], b[1]), out(b[0], b[3]), out(b[2], b[3])];
      const x0 = Math.min(...corners.map((p) => p[0])) - reach;
      const x1 = Math.max(...corners.map((p) => p[0])) + reach;
      const z0 = Math.min(...corners.map((p) => p[1])) - reach;
      const z1 = Math.max(...corners.map((p) => p[1])) + reach;
      const c0 = Math.max(0, Math.floor((x0 - bounds.min[0]) / f));
      const c1 = Math.min(cols - 1, Math.floor((x1 - bounds.min[0]) / f));
      const r0 = Math.max(0, Math.floor((z0 - bounds.min[1]) / f));
      const r1 = Math.min(rows - 1, Math.floor((z1 - bounds.min[1]) / f));
      for (let r = r0; r <= r1; r++)
        for (let q = c0; q <= c1; q++)
          if (!marks[r * cols + q]) {
            marks[r * cols + q] = 1;
            marked++;
          }
    },
    bareAt(x, z) {
      const q = Math.floor((x - bounds.min[0]) / f);
      const r = Math.floor((z - bounds.min[1]) / f);
      return q < 0 || r < 0 || q >= cols || r >= rows || !marks[r * cols + q];
    },
    stats: () => ({ columns: cols * rows, near: marked }),
  };
}

export async function navMaskOf({ pack, loadBin, heightAt, holeAt = () => false, bounds, seeds = null, capsule, rays = { start: 1.2, end: -4 }, climb = CLIMB, cell = 2, fine = 0.5 }) {
  const physics = await createPhysics({ gravity: 0, onError: null });
  try {
    const { RAPIER, world } = physics;
    // (a column is near a shape when its middle is within the capsule's radius, and a little, of the shape's box)
    const near = nearGrid({ bounds, cell, fine, pack, reach: capsule.radius + 0.1 });
    const stats = await loadBodies(physics, pack, loadBin, near.mark);
    const frame = packFrame(pack);
    const length = capsule.height - capsule.step;
    const shape = length > 2 * capsule.radius ? new RAPIER.Capsule(length / 2 - capsule.radius, capsule.radius) : new RAPIER.Cylinder(length / 2, capsule.radius);
    const ROT = { x: 0, y: 0, z: 0, w: 1 };
    const DOWN = { x: 0, y: -1, z: 0 };
    // the shapes' surfaces under (x, z) between two heights, highest first:
    // every crossing of a ray down through them (a hull's top and its
    // underside both: the underside is never free for the capsule)
    const surfacesAt = (x, z, top, bottom) => {
      const out = [];
      const ray = new RAPIER.Ray(frame(x, top, z), DOWN);
      world.intersectionsWithRay(ray, top - bottom, false, (hit) => {
        out.push(top - hit.timeOfImpact);
        return true;
      });
      return out.sort((a, b) => b - a);
    };
    // the capsule, its foot at y, from the step to the height: free of every shape
    const freeAt = (x, y, z) => world.intersectionWithShape(frame(x, y + capsule.step + length / 2, z), ROT, shape) === null;
    const topAt = (x, z, g) => {
      const p = frame(x, g + TOP_REACH, z);
      const hit = world.castRay(new RAPIER.Ray(p, DOWN), TOP_REACH, true);
      if (hit) return TOP_REACH - hit.timeOfImpact;
      // (no shape under the middle: one beside it the capsule meets, its height; else ground the walk
      // never reached, too steep or cut off, which stops no line and makes no cover)
      return freeAt(x, g, z) ? 0.1 : capsule.height;
    };
    const from = seeds ?? [[(bounds.min[0] + bounds.max[0]) / 2, 0, (bounds.min[1] + bounds.max[1]) / 2]];
    const mask = buildWalkMask({ bounds, cell, fine, heightAt, holeAt, surfacesAt, freeAt, topAt, bareAt: near.bareAt, seeds: from.map(([x, y, z]) => [x, y ?? heightAt(x, z), z]), capsule: { step: capsule.step, height: capsule.height, radius: capsule.radius }, rays, climb });
    mask.stats = { ...stats, ...near.stats() };
    return mask;
  } finally {
    physics.dispose();
  }
}

const centreOf = (v) => {
  const n = v.points.length;
  return v.points.reduce((a, b) => [a[0] + b[0] / n, a[1] + b[1] / n], [0, 0]);
};

// for each team, from its first enabled spawn of the mode to every volume of
// the mode: how many paths are found, with the navgrid as it is and with the
// mask (`found` searching as far as `max`; `bots` within the bots' own
// MAX_EXPAND cells)
export function pathTable({ map, heightAt, mask = null, cell = 2, cover = {}, mode = 'galacticAssault', max = 1e6 }) {
  const t0 = Date.now();
  const nav = buildNav({ heightAt, bounds: map.bounds, cell, cover, mask });
  const ms = Date.now() - t0;
  const spawns = map.spawns.filter((s) => s.mode === mode);
  const volumes = map.volumes.filter((v) => v.mode === mode && v.points?.length);
  let solid = 0;
  for (let i = 0; i < nav.solid.length; i++) solid += nav.solid[i];
  const row = { mask: Boolean(nav.mask), solid, ms, spawns: spawns.length, offSpawns: spawns.filter((s) => !walkable(nav, s.at[0], s.at[2])).length, volumes: volumes.length, teams: {} };
  for (const team of [1, 2]) {
    const from = spawns.find((s) => s.team === team && s.enabled !== false) ?? spawns.find((s) => s.team === team);
    if (!from) continue;
    let found = 0;
    let bots = 0;
    let metres = 0;
    for (const v of volumes) {
      const p = findPath(nav, [from.at[0], from.at[2]], centreOf(v), { max });
      if (!p) continue;
      found++;
      if (findPath(nav, [from.at[0], from.at[2]], centreOf(v), { max: MAX_EXPAND })) bots++;
      for (let i = 1; i < p.length; i++) metres += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    }
    row.teams[team] = { from: from.id, found, bots, metres: Math.round(metres) };
  }
  return row;
}
