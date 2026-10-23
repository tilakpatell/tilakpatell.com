// The player on the 2017 soldier's body: on a world whose level has the
// game's shapes in a physics world (lane P0's stream), the walker state you
// are drawn from is moved by Rapier's character controller with the
// soldier's capsule, step, slopes and speeds (lib/physics/soldier.js, read
// from src/data/bf2017/physics/soldier.json) instead of walker.js's maths.
// Everything downstream reads the walker state as before: `step` writes
// back every key `walk()` writes (x, y, z, vx, vz, vy, yaw, grounded,
// speed, air, wading) and returns walk()'s { landed, jumped, bumped }.
//
// Whatever else writes the state straight (a teleport, a respawn after a
// fall, the crowd's shove, a ride's dismount) is seen at the next step and
// carried into the body: a moved position is a teleport (the knock
// cleared), a changed vertical speed a jump (the jetpack's lift). The shore
// and the world's edge are the walker's own rules, on the intent.
//
// The engine may not come (offline, an old browser): `physics` is the world
// or a promise of it; until it resolves, and for good if it rejects, `step`
// is walk() on the walker's world, so the state never misses a frame.
//
//   walkIntent(state, input, row, pose, dt) → { vel: { x, z }, face, jump }   (pure)
//   createPlayerBody({ physics, state, row, world, drive = true, onError }) → {
//     step(input, dt) → { landed, jumped, bumped }, teleport([x, y, z], yaw), knock([x, y, z]),
//     pose (stand | crouch), ready (the engine is in), state, eye(), dispose() }
//   input: walk()'s ({ x, y, run, jump, heading }) and `crouch` (held)
//   drive: this body steps the physics world (false when its owner does)
//   (a fall out of the engine's world, past the edge of the cells it has
//   streamed, is caught: falling fast and 2 m under the walker's ground,
//   you're set back on it; a tunnel under a ridge, walked, never trips it)
//   (on a world with water, a floor under it at the walker's wading depth,
//   WALK.wade under its top, as walk() holds you: no deeper than the knees
//   wherever the ground goes further down; it goes with the body)

import { CHARACTER, createCharacter } from '../../../lib/physics/character';
import { filterOf } from '../../../lib/physics/groups';
import { accelFor, controllerOptions, eyeFor, jumpSpeed, poseFor, speedFor } from '../../../lib/physics/soldier';
import { WALK, shoreStep, walk } from './walker';

const MOVED = 1e-4; // m: the state written by someone else since the body last wrote it
// m: moved this little over the ground by someone else (a dodge's roll, the
// crowd's shove), and not up or down, the body walks it rather than being put there:
// put there at the height it had, it stood in a slope going up (and over one
// going down) till the capsule was pushed out
const SLIDE = 2.5;
const SOLIDS = filterOf('floor', 'object', 'character'); // (what the character itself stops at)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// a jump asked for: true (pressed, standing) or a press (lib/press.js: the buffer and the coyote time)
function jumpAsked(state, jump) {
  if (jump && typeof jump.take === 'function') return jump.take();
  return state.grounded && Boolean(jump);
}

// the stick, relative to the camera, as the body's velocity: walker.js's
// mapping, at the soldier's speeds and gains
export function walkIntent(state, input, row, pose = 'stand', dt = 1 / 60) {
  const mag = Math.min(1, Math.hypot(input.x, input.y));
  const h = input.heading ?? 0;
  let dx = Math.sin(h) * input.y - Math.cos(h) * input.x;
  let dz = Math.cos(h) * input.y + Math.sin(h) * input.x;
  const dl = Math.hypot(dx, dz);
  if (dl > 1e-6) {
    dx /= dl;
    dz /= dl;
  }
  const air = !state.grounded;
  const top = mag > 1e-6 ? speedFor(row, { pose, sprint: Boolean(input.run), dir: { x: input.x / mag, y: input.y / mag }, wading: state.wading > 0.3, air }) * mag : 0;
  const vel = accelFor(row, pose, { x: dx * top, z: dz * top }, { x: Number.isFinite(state.vx) ? state.vx : 0, z: Number.isFinite(state.vz) ? state.vz : 0 }, dt, { air });
  return { vel, face: mag > 0.08 && dl > 1e-6 ? Math.atan2(dx, dz) : null, jump: jumpAsked(state, input.jump) ? jumpSpeed(row) : 0 };
}

export function createPlayerBody({ physics, state, row, world, drive = true, onError = (err) => console.error('playerBody:', err) }) {
  let phys = null;
  let c = null;
  let off = null;
  let gone = false;
  let opts = controllerOptions(row, 'stand');
  let poseState = { pose: 'stand', next: null, until: 0 };
  let t = 0;
  const centre = () => opts.halfHeight + opts.radius + CHARACTER.offset; // the capsule's centre over the feet
  const intent = { vel: { x: 0, z: 0 }, face: null, jump: 0 };
  const wrote = { x: state.x, y: state.y, z: state.z, vy: state.vy, yaw: state.yaw };
  const pos = [0, 0, 0];
  const prev = [0, 0, 0];
  let pending = 0; // a jump asked, m/s, until a substep takes it
  let landed = 0;
  let wasGrounded = true;
  let lowest = 0; // the vertical speed just before landing

  function build(at, yaw) {
    const old = c;
    c = createCharacter(phys, { position: at, ...opts, turn: WALK.turn, tag: 'you' });
    c.teleport(at, yaw);
    old?.remove();
  }

  // The game's step where Rapier's autostep won't take it: the controller
  // never steps higher than the capsule's radius (the soldier's 0.3 stops at
  // a 0.35 m kerb; measured), and the record steps 0.4. Stopped by a wall
  // while standing: lift by the step, along by this substep's move, and down
  // onto what is there; a ceiling over you, a face still in the way at the
  // step's height, or nothing to stand on, and you stay where the wall put you.
  const UP = { x: 0, y: 1, z: 0 };
  const DOWN = { x: 0, y: -1, z: 0 };
  const ALONG = { x: 0, y: 0, z: 0 };
  const AT = { x: 0, y: 0, z: 0 };
  const STILL = { x: 0, y: 0, z: 0, w: 1 };
  function cast(from, dir, far) {
    const { RAPIER, world: w } = phys;
    const h = w.castShape(from, STILL, dir, c.collider.shape, 0, far, true, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, SOLIDS, c.collider, c.body.body);
    return h ? h.time_of_impact : Infinity;
  }
  function stepUp(dt) {
    const vx = intent.vel.x;
    const vz = intent.vel.z;
    const speed = Math.hypot(vx, vz);
    if (!c.blocked || !c.grounded || speed < 0.1) return;
    const lift = opts.step.height + CHARACTER.offset;
    const t = c.body.body.translation();
    if (cast(t, UP, lift) < lift) return; // a ceiling
    const ahead = Math.max(speed * dt, 0.03);
    AT.x = t.x;
    AT.y = t.y + lift;
    AT.z = t.z;
    ALONG.x = vx / speed;
    ALONG.z = vz / speed;
    if (cast(AT, ALONG, ahead) < ahead) return; // taller than the step
    // (the step measured by two rays, from the ground under your middle to
    // the top just past your front: the capsule's round foot rides up an
    // edge over a few substeps, and its own height is no measure of it)
    const { RAPIER, world: w } = phys;
    const flags = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS;
    const from = t.y - centre() + lift + 0.05;
    const under = w.castRay(new RAPIER.Ray({ x: t.x, y: t.y, z: t.z }, DOWN), centre() + lift, true, flags, SOLIDS, c.collider, c.body.body);
    if (!under) return;
    const base = t.y - under.timeOfImpact;
    const reach = opts.radius + CHARACTER.offset + 0.1;
    const hit = w.castRay(new RAPIER.Ray({ x: t.x + ALONG.x * reach, y: base + lift + 0.05, z: t.z + ALONG.z * reach }, DOWN), from - base + 0.1, true, flags, SOLIDS, c.collider, c.body.body);
    if (!hit) return; // nothing there to stand on
    const top = base + lift + 0.05 - hit.timeOfImpact;
    if (top > base + opts.step.height + 0.02 || top < base + 0.02) return;
    AT.x += ALONG.x * ahead;
    AT.z += ALONG.z * ahead;
    const down = cast(AT, DOWN, lift + 0.05);
    if (!Number.isFinite(down)) return;
    const y = AT.y - down + CHARACTER.offset;
    if (y - t.y < 0.005) return;
    c.teleport([AT.x, y, AT.z], c.yaw);
  }

  // (the wading floor: one slab under the water across the world, at the
  // depth the walker holds everyone; under the ground wherever it's dry)
  let wadeFloor = null;
  const WADE_SLAB = 0.1;
  function floorUnderWater() {
    if (world?.water == null || !Number.isFinite(world.water)) return;
    const half = (world.reach ?? 600) + 200;
    wadeFloor = phys.add({ type: 'fixed', position: [0, world.water - WALK.wade - WADE_SLAB, 0], group: 'floor', colliders: [{ shape: 'cuboid', args: [half, WADE_SLAB, half] }] });
  }

  function attach(p) {
    if (gone) return;
    phys = p;
    build([state.x, state.y + centre(), state.z], state.yaw);
    floorUnderWater();
    off = phys.onSubstep((dt) => {
      if (pending) {
        c.jump(pending);
        pending = 0;
      }
      lowest = Math.min(lowest, c.vy);
      c.move(intent, dt);
      stepUp(dt);
      if (c.grounded && !wasGrounded) {
        landed = Math.max(landed, -lowest);
        lowest = 0;
      }
      wasGrounded = c.grounded;
    });
    remember();
  }

  if (physics && typeof physics.then === 'function') physics.then(attach, (err) => onError(err));
  else if (physics) attach(physics);

  function remember() {
    wrote.x = state.x;
    wrote.y = state.y;
    wrote.z = state.z;
    wrote.vy = state.vy;
    wrote.yaw = state.yaw;
  }

  function teleport(at, yaw = state.yaw) {
    state.x = at[0];
    state.y = at[1];
    state.z = at[2];
    state.yaw = yaw;
    state.vx = state.vz = state.vy = 0;
    state.grounded = true;
    state.air = 0;
    pending = 0;
    if (c) c.teleport([at[0], at[1] + centre(), at[2]], yaw);
    remember();
  }

  // a capsule of these options at the feet given fits (nothing solid in it)
  function fits(o, feet) {
    const { RAPIER, world: w } = phys;
    const shape = new RAPIER.Capsule(o.halfHeight, o.radius);
    let hit = false;
    const at = { x: feet[0], y: feet[1] + o.halfHeight + o.radius + CHARACTER.offset, z: feet[2] };
    w.intersectionsWithShape(at, { x: 0, y: 0, z: 0, w: 1 }, shape, () => ((hit = true), false), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, c.collider, c.body.body);
    return !hit;
  }

  // the pose: the capsule rebuilt at its height when the transition lands (a stand that won't fit stays crouched)
  function stepPose(want) {
    const next = poseFor(row, poseState, want, t);
    if (next.pose !== poseState.pose) {
      const o = controllerOptions(row, next.pose);
      c.position(pos);
      const feet = [pos[0], pos[1] - centre(), pos[2]];
      if (fits(o, feet)) {
        opts = o;
        build([feet[0], feet[1] + centre(), feet[2]], c.yaw);
        poseState = next;
      } else poseState = { pose: poseState.pose, next: null, until: 0 };
    } else poseState = next;
  }

  function step(input, dt) {
    t += dt;
    if (!c) return walk(state, input, dt, world);
    // what someone else did to the state since the last step
    // (moved: the body goes there, falling as it was if it was; a step or
    // two over the ground, it walks there this step, along the ground (up a
    // kerb, as a walk does) and stopped by what's in the way)
    let sx = 0;
    let sz = 0;
    if (Math.abs(state.x - wrote.x) > MOVED || Math.abs(state.y - wrote.y) > MOVED || Math.abs(state.z - wrote.z) > MOVED) {
      const dx = state.x - wrote.x;
      const dz = state.z - wrote.z;
      if (Math.abs(state.y - wrote.y) <= MOVED && Math.hypot(dx, dz) <= SLIDE && dt > 0) {
        sx = dx / dt;
        sz = dz / dt;
      } else {
        c.teleport([state.x, state.y + centre(), state.z], state.yaw);
        if (!state.grounded && state.vy) c.jump(state.vy);
        remember();
      }
    }
    if (Math.abs(state.vy - wrote.vy) > MOVED) c.jump(state.vy);
    if (Math.abs(state.yaw - wrote.yaw) > MOVED) c.face(state.yaw);
    stepPose(input.crouch ? 'crouch' : 'stand');
    const it = walkIntent(state, input, row, poseState.pose, dt);
    let vx = it.vel.x + sx;
    let vz = it.vel.z + sz;
    let bumped = false;
    // the shore and the edge of the world, from the body's own place
    c.position(pos);
    const here = { x: pos[0], z: pos[2] };
    const nx = here.x + vx * dt;
    const nz = here.z + vz * dt;
    const held = world && shoreStep(world, here, nx, nz);
    if (held) {
      vx = (held[0] - here.x) / dt;
      vz = (held[1] - here.z) / dt;
      bumped = true;
    }
    const reach = world?.reach;
    const far = Math.hypot(nx, nz);
    if (reach && far > reach) {
      const outward = (nx * vx + nz * vz) / far;
      const most = (reach - Math.hypot(here.x, here.z)) / dt;
      if (outward > most) {
        vx -= ((outward - most) * nx) / far;
        vz -= ((outward - most) * nz) / far;
        bumped = true;
      }
    }
    intent.vel.x = vx;
    intent.vel.z = vz;
    intent.face = it.face;
    if (it.jump) pending = it.jump;
    landed = 0;
    if (drive) phys.step(dt);
    // (the walk's own speed kept, not the push: the next step eases from where you were going)
    sync(dt, vx - sx, vz - sz);
    if (world?.heightAt && !state.grounded && state.vy < -10) {
      const floor = world.heightAt(state.x, state.z);
      if (Number.isFinite(floor) && state.y < floor - 2) teleport([state.x, floor, state.z], state.yaw);
    }
    return { landed, jumped: Boolean(it.jump), bumped: bumped || c.blocked };
  }

  // the body into the walker state: its feet (between substeps by alpha), its yaw, its speeds
  function sync(dt, vx, vz) {
    const a = drive ? phys.alpha : 1;
    c.position(pos);
    c.prev(prev);
    const lag = centre();
    const x = prev[0] + (pos[0] - prev[0]) * a;
    const z = prev[2] + (pos[2] - prev[2]) * a;
    state.speed = Math.hypot(x - state.x, z - state.z) / Math.max(dt, 1e-6);
    state.x = x;
    state.y = prev[1] + (pos[1] - prev[1]) * a - lag;
    state.z = z;
    state.yaw = c.yaw;
    state.grounded = c.grounded;
    state.vy = c.grounded ? 0 : c.vy;
    state.vx = c.blocked ? (pos[0] - prev[0]) * 60 : vx;
    state.vz = c.blocked ? (pos[2] - prev[2]) * 60 : vz;
    state.air = c.grounded ? 0 : (Number.isFinite(state.air) ? state.air : 0) + dt;
    state.wading = world?.water != null ? clamp((world.water - state.y) / WALK.wade, 0, 1) : 0;
    state.pose = poseState.pose;
    remember();
  }

  return {
    step,
    teleport,
    knock: (v) => c?.knock(v),
    eye: () => eyeFor(row, poseState.pose),
    get pose() {
      return poseState.pose;
    },
    get ready() {
      return Boolean(c);
    },
    // the walker state it moves (the scene rebuilds the body when you swap to your crewmate)
    get state() {
      return state;
    },
    get character() {
      return c;
    },
    dispose() {
      if (gone) return;
      gone = true;
      off?.();
      c?.remove();
      c = null;
      if (wadeFloor) phys?.remove(wadeFloor);
      wadeFloor = null;
    },
  };
}
