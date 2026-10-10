// The navgrid's mask from a level pack's shapes (the design's nav.bin,
// decision 15; the research: docs/superpowers/evidence/battlefront-lane5b/
// research-collision.md §3–4). Every placed mesh with shapes goes into the
// physics engine as lane P0's bodies (the pack's cell bins, its
// physics/<mesh>.bin), in the pack's frame; each question is turned into
// that frame (the pack's origin and yaw) and asked of the engine: does the
// soldier's capsule, from a step above the ground to its height, meet a
// shape at this spot? (src/lib/battlefront/navMask.js keeps the answers.)
// A blocked cell's top is a ray down from TOP_REACH over the ground.
//
//   capsuleOf(soldierJson) → { radius, step, height, sources }
//   navMaskOf({ pack, loadBin, heightAt (export frame), bounds, capsule, cell, fine }) → mask
//   pathTable({ map, heightAt, mask, cell, cover }) → rows of the measured paths
//
// Only the shapes: the ground's own slope is the navgrid's test.

import { buildMask } from '../../src/lib/battlefront/navMask.js';
import { MAX_EXPAND, buildNav, findPath, walkable } from '../../src/lib/battlefront/nav.js';
import { cellBodies, collidersOf, readShapes } from '../../src/lib/physics/havok.js';
import { createPhysics } from '../../src/lib/physics/world.js';
import { instancesOf } from '../../src/components/galaxy/surface/level/levelPhysics.js';

// m over the ground a blocked cell's top is looked for from (hand: a byte of
// decimetres, navMask.js's TOP_MAX, is 25.5 m)
export const TOP_REACH = 25;

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

async function loadBodies(physics, pack, loadBin) {
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
      } catch {
        refused++;
      }
    }
  }
  physics.world.step();
  return { bodies, refused };
}

export async function navMaskOf({ pack, loadBin, heightAt, bounds, capsule, cell = 2, fine = 0.5 }) {
  const physics = await createPhysics({ gravity: 0, onError: null });
  try {
    const { RAPIER, world } = physics;
    const stats = await loadBodies(physics, pack, loadBin);
    const frame = packFrame(pack);
    const length = capsule.height - capsule.step;
    const shapes = new Map();
    // a capsule of radius r from the step to the height; a cylinder once r is
    // too wide for a capsule that short (the probe grown to a cell's corners)
    const shapeOf = (r) => {
      if (!shapes.has(r)) shapes.set(r, length > 2 * r ? new RAPIER.Capsule(length / 2 - r, r) : new RAPIER.Cylinder(length / 2, r));
      return shapes.get(r);
    };
    const ROT = { x: 0, y: 0, z: 0, w: 1 };
    const blockedAt = (x, g, z, r) => world.intersectionWithShape(frame(x, g + capsule.step + length / 2, z), ROT, shapeOf(r)) !== null;
    const topAt = (x, z, g) => {
      const p = frame(x, g + TOP_REACH, z);
      const hit = world.castRay(new RAPIER.Ray(p, { x: 0, y: -1, z: 0 }), TOP_REACH, true);
      // (no shape under the middle, though the capsule met one: its height)
      return hit ? TOP_REACH - hit.timeOfImpact : capsule.height;
    };
    const mask = buildMask({ bounds, cell, fine, heightAt, blockedAt, topAt, capsule: { step: capsule.step, height: capsule.height, radius: capsule.radius } });
    mask.stats = stats;
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
