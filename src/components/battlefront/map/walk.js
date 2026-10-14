// The player on the soldier's body (docs/superpowers/HANDOFF-hoth-map.md
// step 2): Rapier's character controller with the 2017 soldier's capsule,
// step and slopes (lib/physics/soldier.js's controllerOptions, read from
// src/data/bf2017/physics/soldier.json) on the level's own shapes and its
// ground (map/collision.js's streamed cells, both the outside's and its
// interior's), in the pack's frame. The sim's soldier is moved by it
// (sim.js's `mover`) instead of the navgrid's 2D step, which stands a
// soldier on the terrain's heightmap: on Hoth that is the mountain's snow
// over Echo Base, 56 m above the hangar's floor, with the trench tunnels
// and the base's floors not there at all.
//
// The sim's speed is kept (soldier.js's speedOf: the pose, the sprint, the
// stack's modifiers); the controller decides where that goes: along a wall,
// up a step or a slope it may climb, down to the ground under it. A place
// written to the soldier by someone else (a spawn, the door's `place`) is a
// teleport. Until the engine has shapes round the soldier, and for good
// without an engine, the nav's step moves it, as before.
//
//   createWalker({ physics, pack, row, at = [0, 0, 0], ground(x, z) → the terrain's height }) → {
//     mover(s, dir, dt, nav) → metres moved   (sim.js's signature for move)
//     held (true while it waits in the air for something under it), ready(), dispose() }
//   toPackFrame(pack, [x, y, z]) / fromPackFrame(pack, [x, y, z])   (pure)

import { createCharacter } from '../../../lib/physics/character.js';
import { controllerOptions } from '../../../lib/physics/soldier.js';
import { move, speedOf } from '../../../lib/battlefront/soldier.js';

// m: a place written to the soldier further than this from where the body left it is a teleport
const MOVED = 0.05;
// m and m/s: falling this fast, ungrounded, this far under the terrain, the body is put back on it (shapes not streamed in yet);
// inside the base, under the mountain, a soldier stands on a floor and is never caught by it
const LOST = 6;
const FALLING = -25;
// m: how far down a ray looks for anything to land on before the body is held (nothing there: not streamed in yet)
const VOID = 200;

export function toPackFrame(pack, [x, y, z]) {
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  const dx = x - ox;
  const dz = z - oz;
  return [dx * c + dz * s, y - oy, -dx * s + dz * c];
}

export function fromPackFrame(pack, [x, y, z]) {
  const [ox, oy, oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  return [ox + x * c - z * s, y + oy, oz + x * s + z * c];
}

export function createWalker({ physics, pack, row, at = [0, 0, 0], ground = null }) {
  const opts = controllerOptions(row, 'stand');
  const lift = opts.halfHeight + opts.radius; // (the capsule's middle over the feet)
  const start = toPackFrame(pack, at);
  const ch = createCharacter(physics, { position: [start[0], start[1] + lift, start[2]], radius: opts.radius, halfHeight: opts.halfHeight, mass: opts.mass, step: opts.step, slope: opts.slope, snap: opts.snap, gravity: opts.gravity, group: 'character' });
  const rb = ch.body.body;
  const { RAPIER, world } = physics;
  const down = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  // (anything under the body to land on: a shape or the ground's heightfield)
  const below = () => {
    const t = rb.translation();
    down.origin.x = t.x;
    down.origin.y = t.y;
    down.origin.z = t.z;
    return world.castRay(down, VOID, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, undefined, rb) !== null;
  };
  let wrote = null; // the soldier's place as this body last wrote it
  let footing = null; // where it last stood on something: a fall through the streamed shapes comes back here
  let held = false;
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);

  function place(feet) {
    const p = toPackFrame(pack, feet);
    ch.teleport([p[0], p[1] + lift + 0.05, p[2]]);
  }

  return {
    get held() {
      return held;
    },
    ready: () => true,
    mover(sol, dir, dt, nav) {
      if (!sol.alive) return move(sol, dir, dt, nav);
      if (!wrote || Math.hypot(sol.at[0] - wrote[0], sol.at[1] - wrote[1], sol.at[2] - wrote[2]) > MOVED) {
        place(sol.at);
        wrote = sol.at.slice();
        footing = null;
      }
      // (held where it is, in the air, while nothing is under it yet: the game streams a level round a
      // spawn before the soldier drops in; here the stream adds a dense cell's shapes over seconds)
      held = !ch.grounded && !below();
      if (held) {
        sol.moving = false;
        sol.vel[0] = sol.vel[2] = 0;
        return 0;
      }
      const len = Math.hypot(dir[0], dir[1]);
      const speed = len > 1e-9 ? speedOf(sol) : 0;
      const wx = len > 1e-9 ? (dir[0] / len) * speed : 0;
      const wz = len > 1e-9 ? (dir[1] / len) * speed : 0;
      // (the wish in the pack's frame: turned by its yaw as toPackFrame turns a place)
      ch.move({ vel: { x: wx * c + wz * s, z: -wx * s + wz * c }, face: null }, dt);
      // (the world stepped: the body goes where the controller said, and the shapes and ground the
      // stream added since are in the engine's queries for the next move; fixed bodies and one
      // kinematic capsule, so a step is cheap)
      world.step();
      const n = rb.translation();
      let feet = fromPackFrame(pack, [n.x, n.y - lift, n.z]);
      const floor = ground?.(feet[0], feet[2]);
      if (Number.isFinite(floor) && !ch.grounded && ch.vy < FALLING && feet[1] < floor - LOST) {
        feet = footing ? footing.slice() : [feet[0], floor, feet[2]];
        place(feet);
      }
      if (ch.grounded) footing = feet.slice();
      const moved = Math.hypot(feet[0] - sol.at[0], feet[2] - sol.at[2]);
      sol.vel[0] = (feet[0] - sol.at[0]) / dt;
      sol.vel[2] = (feet[2] - sol.at[2]) / dt;
      sol.at[0] = feet[0];
      sol.at[1] = feet[1];
      sol.at[2] = feet[2];
      sol.moving = moved > 1e-4;
      sol.grounded = ch.grounded;
      wrote = sol.at.slice();
      return moved;
    },
    dispose: () => ch.remove(),
  };
}
