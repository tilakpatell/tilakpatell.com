// A figure's body: a kinematic capsule on Rapier's character controller.
// Nothing but `move` sets its pose, and `move` is called once a substep
// (from the physics world's onSubstep hook), with an intent: a horizontal
// velocity, a facing, a jump. The character keeps its own vertical speed
// (gravity, zeroed on the ground; a jump sets it) and a knock (a hit's
// shove, decaying), adds both to the intent, asks the controller how far
// that goes (it climbs a slope under `climb`, slides on one over `slide`,
// steps a kerb under `step.height`, snaps to the ground it walks down, and
// shoves dynamic bodies with `mass` behind it), and sets the body's next
// pose. `blocked` says the controller gave less than a third of what was
// asked (a wall): the steering reads it as danger. `prev` is the pose
// before the last substep, for drawing between steps. A kinematic body
// takes no impulse, so a hit is a `knock`: a velocity the controller
// carries along walls as it would a walk (the design's rule). No three.js.
//
//   CHARACTER: { offset, nudge (the controller's normal nudge: at Rapier's 1e-4 a run across a
//     heightfield catches on its triangles' edges a frame now and then; 0.01 never does), step: { height, minWidth }, slope: { climb, slide } (degrees), snap,
//     gravity (the walker's, so the feel is the same), knockDecay (a second) }
//   createCharacter(phys, { position, radius = 0.38, halfHeight = 0.5, mass = 70, group = 'character',
//     pushes = true, turn = 11 (rad/s), tag = null, ...CHARACTER's keys to override }) → {
//     body (world.js's Body), collider, radius, halfHeight,
//     move(intent, dt)   intent: { vel: { x, z } (m/s), face: yaw | null, jump?: m/s (only grounded) }
//     knock([x, y, z])   adds a velocity (m/s); knockLeft() → what's left of it (m/s)
//     jump(v)            sets the vertical speed outright, airborne (a press in its buffer, a jetpack)
//     face(yaw)          the facing outright, nothing else touched (a shot turns you)
//     grounded, blocked, yaw, vy,
//     position(out) → [x, y, z], quaternion(out) → [x, y, z, w], prev(out) → [x, y, z],
//     teleport([x, y, z], yaw?), enable(on), remove() }

import { filterOf } from './groups';

export const CHARACTER = { offset: 0.02, nudge: 0.01, step: { height: 0.35, minWidth: 0.2 }, slope: { climb: 50, slide: 60 }, snap: 0.3, gravity: 15.5, knockDecay: 6 };

const RAD = Math.PI / 180;
const SOLIDS = filterOf('floor', 'object', 'character', 'barrier');
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function createCharacter(phys, { position, radius = 0.38, halfHeight = 0.5, mass = 70, group = 'character', pushes = true, turn = 11, tag = null, offset = CHARACTER.offset, nudge = CHARACTER.nudge, step = CHARACTER.step, slope = CHARACTER.slope, snap = CHARACTER.snap, gravity = CHARACTER.gravity, knockDecay = CHARACTER.knockDecay } = {}) {
  const { RAPIER, world } = phys;
  const handle = phys.add({ type: 'kinematicPositionBased', position, group, colliders: [{ shape: 'capsule', args: [halfHeight, radius], tag }] });
  const rb = handle.body;
  const collider = handle.colliders[0];
  const ctl = world.createCharacterController(offset);
  ctl.setNormalNudgeFactor(nudge);
  ctl.enableAutostep(step.height, step.minWidth, true);
  ctl.enableSnapToGround(snap);
  ctl.setMaxSlopeClimbAngle(slope.climb * RAD);
  ctl.setMinSlopeSlideAngle(slope.slide * RAD);
  ctl.setApplyImpulsesToDynamicBodies(pushes);
  ctl.setCharacterMass(mass);
  const mine = (c) => c.handle !== collider.handle;
  const shape = collider.shape;
  // placed inside something solid (a spawn on a slope's wrong side, a
  // crate shoved into it): out along the deepest contact's normal first,
  // since the controller never resolves a penetration it starts in
  const push = { x: 0, y: 0, z: 0 };
  const unstick = (t) => {
    push.x = push.y = push.z = 0;
    world.intersectionsWithShape(t, rb.rotation(), shape, (other) => {
      const c = collider.contactCollider(other, 0);
      if (c && c.distance < -1e-4) {
        push.x -= c.normal2.x * c.distance;
        push.y -= c.normal2.y * c.distance;
        push.z -= c.normal2.z * c.distance;
      }
      return true;
    }, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, SOLIDS, undefined, rb);
    if (push.x === 0 && push.y === 0 && push.z === 0) return t;
    next.x = t.x + push.x;
    next.y = t.y + push.y;
    next.z = t.z + push.z;
    rb.setTranslation(next, false);
    return rb.translation();
  };

  const desired = { x: 0, y: 0, z: 0 };
  const next = { x: 0, y: 0, z: 0 };
  const q = { x: 0, y: 0, z: 0, w: 1 };
  const knock = { x: 0, y: 0, z: 0 };
  const before = [position[0], position[1], position[2]];
  let yaw = 0;
  let vy = 0;
  let grounded = false;
  let blocked = false;
  let removed = false;

  const face = (to) => {
    yaw = to;
    const h = yaw / 2;
    q.x = 0;
    q.y = Math.sin(h);
    q.z = 0;
    q.w = Math.cos(h);
    rb.setNextKinematicRotation(q);
  };

  return {
    body: handle,
    collider,
    radius,
    halfHeight,
    get grounded() {
      return grounded;
    },
    get blocked() {
      return blocked;
    },
    get yaw() {
      return yaw;
    },
    get vy() {
      return vy;
    },
    move(intent, dt) {
      if (removed || !(dt > 0)) return;
      const t = unstick(rb.translation());
      before[0] = t.x;
      before[1] = t.y;
      before[2] = t.z;
      if (grounded && intent.jump > 0) vy = intent.jump;
      else vy -= gravity * dt;
      const vx = (intent.vel?.x ?? 0) + knock.x;
      const vz = (intent.vel?.z ?? 0) + knock.z;
      desired.x = vx * dt;
      desired.y = (vy + knock.y) * dt;
      desired.z = vz * dt;
      ctl.computeColliderMovement(collider, desired, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, SOLIDS, mine);
      const got = ctl.computedMovement();
      grounded = ctl.computedGrounded();
      if (grounded && vy < 0) vy = 0;
      const asked = Math.hypot(desired.x, desired.z);
      blocked = asked > 0.01 && Math.hypot(desired.x - got.x, desired.z - got.z) > asked * 0.3;
      next.x = t.x + got.x;
      next.y = t.y + got.y;
      next.z = t.z + got.z;
      rb.setNextKinematicTranslation(next);
      const k = Math.exp(-knockDecay * dt);
      knock.x *= k;
      knock.y *= k;
      knock.z *= k;
      if (Number.isFinite(intent.face)) {
        const most = turn * dt;
        face(yaw + clamp(wrap(intent.face - yaw), -most, most));
      }
    },
    // turned to a yaw outright (the scene turns you to a shot): the facing and nothing else
    face(to) {
      if (removed || !Number.isFinite(to)) return;
      face(to);
    },
    // a jump (or a jetpack's lift) set outright: the vertical speed, airborne
    jump(v) {
      if (!Number.isFinite(v)) return;
      vy = v;
      grounded = false;
    },
    knock(v) {
      if (!v || !Number.isFinite(v[0] + v[1] + v[2])) return;
      knock.x += v[0];
      knock.y += v[1];
      knock.z += v[2];
    },
    knockLeft: () => Math.hypot(knock.x, knock.y, knock.z),
    position: (out = [0, 0, 0]) => handle.position(out),
    quaternion: (out = [0, 0, 0, 1]) => handle.quaternion(out),
    prev(out = [0, 0, 0]) {
      out[0] = before[0];
      out[1] = before[1];
      out[2] = before[2];
      return out;
    },
    teleport(at, to = yaw) {
      if (removed) return;
      next.x = at[0];
      next.y = at[1];
      next.z = at[2];
      rb.setTranslation(next, true);
      rb.setNextKinematicTranslation(next);
      before[0] = at[0];
      before[1] = at[1];
      before[2] = at[2];
      knock.x = knock.y = knock.z = 0;
      vy = 0;
      face(to);
      rb.setRotation(q, true);
    },
    enable: (on) => handle.enable(on),
    remove() {
      if (removed) return;
      removed = true;
      if (!phys.disposed) world.removeCharacterController(ctl); // (a world gone first took the controller with it)
      phys.remove(handle);
    },
  };
}
