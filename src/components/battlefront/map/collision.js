// The level's shapes for the camera (the research's plan: docs/superpowers/
// evidence/battlefront-lane5b/research-collision.md §4): lane P0's
// createLevelPhysics, through the galaxy's face, on the near band of lane
// L's stream only (the cells round the player; a cell that drifts out to the
// mid band goes, as one dropped does), in the pack's frame; a question in
// the export's frame is turned into it (the pack's origin and yaw). The
// soldiers walk the navgrid (its nav mask), not this: here is only what the
// camera's arm must not pass through.
//
//   createLevelCollision({ pack, loadBin, physics, tier, deps })
//     → { add(key, bin, band) → Promise, drop(key), update(ms = 4) → bodies added,
//         sweep(from, dir, len, r) → metres along dir to the first shape | null,
//         stats(), dispose() }
//   armCaster({ heightAt, collision, nav, clear, step, radius }) → castArm(from, dir, len)
//     the nearer of a march over the ground and a ball swept through the
//     shapes (with no engine: the navgrid's solids and mask, firstSolid)
//   CULL_RADIUS, ARM_STEP, ARM_CLEAR; wantsEngine (lane P0's rule, passed on)

import * as laneL from '../../galaxy/shared/level.js';
import { firstSolid } from '../../../lib/battlefront/nav.js';

// m: the ball swept along the arm (Gameplay/Characters/StormTrooperShared#SoldierCameraComponentData.CameraCullSphereRadius; its use as the sweep's radius is hand)
export const CULL_RADIUS = 0.15;
export const ARM_STEP = 0.2; // m the camera's ray marches along the arm over the ground (hand)
export const ARM_CLEAR = 0.25; // m above the ground the camera keeps (hand)

const I = { x: 0, y: 0, z: 0, w: 1 };

export const wantsEngine = (opts) => laneL.wantsEngine(opts);

export function createLevelCollision({ pack, loadBin, physics, tier = 'high', deps = {} }) {
  const make = deps.createLevelPhysics ?? laneL.createLevelPhysics;
  const lp = make({ physics, pack, loadBin, tier });
  const { RAPIER, world } = physics;
  const balls = new Map();
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  // (map/level.js's toPack, with the height and for a direction too)
  const turn = (x, z) => [x * c + z * s, -x * s + z * c];
  const near = new Set();
  let gone = false;

  return {
    add(key, bin, band) {
      if (gone) return Promise.resolve();
      if (band !== 'near') {
        if (near.delete(key)) lp.drop(key);
        return Promise.resolve();
      }
      near.add(key);
      return lp.add(key, bin);
    },
    drop(key) {
      near.delete(key);
      lp.drop(key);
    },
    update(ms = 4) {
      if (gone) return 0;
      const added = lp.update(ms);
      // (the engine sees a body only after a step)
      if (added) world.step();
      return added;
    },
    sweep(from, dir, len, r = CULL_RADIUS) {
      if (gone) return null;
      if (!balls.has(r)) balls.set(r, new RAPIER.Ball(r));
      const [px, pz] = turn(from[0] - ox, from[2] - oz);
      const [dx, dz] = turn(dir[0], dir[2]);
      const h = world.castShape({ x: px, y: from[1] - oy, z: pz }, I, { x: dx * len, y: dir[1] * len, z: dz * len }, balls.get(r), 0, 1, true);
      return h ? h.time_of_impact * len : null;
    },
    stats: () => lp.stats(),
    dispose() {
      gone = true;
      near.clear();
      lp.dispose();
    },
  };
}

export function armCaster({ heightAt, collision = null, nav = null, clear = ARM_CLEAR, step = ARM_STEP, radius = CULL_RADIUS }) {
  return (from, dir, len) => {
    let best = null;
    for (let d = step; d <= len; d += step) {
      if (from[1] + dir[1] * d < heightAt(from[0] + dir[0] * d, from[2] + dir[2] * d) + clear) {
        best = d;
        break;
      }
    }
    let shape = null;
    if (collision) shape = collision.sweep(from, dir, len, radius);
    else if (nav) {
      const hit = firstSolid(nav, from, [from[0] + dir[0] * len, from[1] + dir[1] * len, from[2] + dir[2] * len]);
      // (the ground is the march's)
      if (hit && hit.solid !== -1) shape = hit.t * len;
    }
    return shape != null && (best == null || shape < best) ? shape : best;
  };
}
