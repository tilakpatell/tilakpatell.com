// A landing's things that can be knocked about, in Rapier (lib/physics):
// the planet a fixed ball its own size, pulling toward its middle; each
// thing ./bodies.js names a body standing where furnish stood it, asleep
// till something comes; the people walking about (foot.js still walks
// them) as capsules that shove what they walk into; and the shots, as rays
// along each bolt's flight that stop at the first thing and knock it.
//
// A knock goes by the thing's mass (./bodies.js knockOf): a push along the
// ground the bolt's way (any part of it into the ground left out, so a
// shot from eye height slides a crate as a level one does), landing
// halfway from the middle of its mass to where it was hit, and a little
// hop up. A fixed thing (a lamp post, a bollard) stops a bolt too, and
// isn't moved by it.
//
// The ground round where the landing's laid out (spot: the planet's up
// there) is a heightfield cap 256 m across (FLOOR_CAP), the ball 5 cm under
// it: on the ball's own round contact a knocked box rocks and turns for
// ever and never sleeps; on the cap it settles in under a second.
//
// Everything is in the planet's own space (footScene's root: its middle at
// the origin), in and out in map units; inside, the world is in metres
// (map units / METRE), Rapier's own scale for a person and a barrel. The
// layout is every pilot's (seeded), but what's been knocked about isn't
// sent: each pilot's props are their own.
//
// createLandingPhysics({ R, metre = METRE, g = 9.81, threshold = 15, onHit(force, at,
//   entry), spot ([x, y, z], the cap's middle; none, no cap) }) → Promise<{
//   add({ position, quaternion, scale, box (metres, its own frame), body,
//   awake?, user }) → entry | null, walls([{ n, r }]) (the landing's fixed
//   things, as walk() has them: a circle along the ground round n, r map
//   units; each a fixed post 3 m tall, so what's knocked stops at them),
//   people([{ key, at, up }], dt) (before step(dt), with the same dt),
//   where(key), shot(from, to) → { entry, at } | null, step(dt),
//   sync(write(entry, position, quaternion)) (those that moved),
//   settle(at, metres) (the far ones to sleep), pushers, size, dispose() }>
//
// The capsules are moved over the time the world will step this frame
// (whole 1/60 s substeps), not the frame's own time: at 144 Hz most frames
// step nothing, and a capsule sent at the frame's speed would run ahead of
// its walker and fling what it meets.
//   (onHit for every contact over `threshold`, the hit law's
//   (lib/impact.js): lib/physics tells a hit's force a kilogram, so a thing
//   lying there (its weight, g a kilogram) is never a knock, however heavy,
//   and a diya's knock and a chest's are on the one law. The law decides
//   how loud, and its gap is the one throttle. Position and at in map units;
//   its arguments are lib/three/impacts.js's onHit's, the entry the key, so
//   it can be handed the wiring's own)

import { STEP, createPhysics } from '../../../lib/physics/world';
import { addPusher } from '../../../lib/physics/pusher';
import { METRE } from '../foot';
import { KNOCK, knockOf, shapeFor, shotImpulse } from './bodies';

const PERSON = { radius: 0.35, half: 0.55 }; // (a capsule 1.8 m tall)
const SUBSTEPS = 4; // (the world's maxSubsteps)
const POST = 1.5; // a fixed thing's post: half its height, metres

// the turn taking +y to the unit vector u
function upTurn(u) {
  const [x, y, z] = u;
  if (y < -0.999999) return [1, 0, 0, 0];
  const q = [z, 0, -x, 1 + y];
  const n = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}
// (a way as a unit vector, or null if it isn't one)
function unit(u) {
  const l = Math.hypot(u?.[0], u?.[1], u?.[2]);
  return l > 0 && Number.isFinite(l) ? u.map((a) => a / l) : null;
}

// the floor round the landing as a heightfield: a ball's contact rocks a
// box for ever (never asleep, turning); this cap lets it settle
const FLOOR_CAP = { n: 129, size: 256, sink: 0.05 };
export function capHeights(Rm, { n = FLOOR_CAP.n, size = FLOOR_CAP.size } = {}) {
  const h = new Float32Array(n * n);
  for (let ix = 0; ix < n; ix++)
    for (let iz = 0; iz < n; iz++) {
      const x = (ix / (n - 1) - 0.5) * size;
      const z = (iz / (n - 1) - 0.5) * size;
      h[ix * n + iz] = Math.sqrt(Math.max(0, Rm * Rm - x * x - z * z)) - Rm;
    }
  return h;
}

export async function createLandingPhysics({ R, metre = METRE, g = 9.81, threshold = 15, onHit = null, spot = null } = {}) {
  const Rm = R / metre;
  const physics = await createPhysics({
    gravity: { centre: [0, 0, 0], g },
    maxSpeed: 30,
    // (fallen into the planet, or flown off it: put back)
    lost: ([x, y, z]) => {
      const d = Math.hypot(x, y, z);
      return d < Rm - 4 || d > Rm + 200;
    },
    onError: (err) => {
      if (import.meta.env?.DEV) console.warn('landing physics:', err);
    },
  });
  const { RAPIER, world } = physics;
  // the ground: the ball, and round the spot (if it's a way at all) the
  // cap, the ball a little under it so nothing on the cap meets its round
  // contact
  const mid = unit(spot);
  physics.add({ type: 'fixed', group: 'floor', friction: 0.8, colliders: [{ shape: 'ball', args: [Rm - (mid ? FLOOR_CAP.sink : 0)] }] });
  if (mid) {
    // (no wider than a small moon has room for)
    const size = Math.min(FLOOR_CAP.size, 0.8 * Rm);
    const cap = { shape: 'heightfield', args: [FLOOR_CAP.n - 1, FLOOR_CAP.n - 1, capHeights(Rm, { size }), [size, 1, size], RAPIER.HeightFieldFlags.FIX_INTERNAL_EDGES] };
    physics.add({ type: 'fixed', group: 'floor', friction: 0.8, position: mid.map((a) => a * Rm), rotation: upTurn(mid), colliders: [cap] });
  }
  const entries = new Map(); // Body → entry
  const pushers = new Map(); // key → pusher
  let gone = false;

  function add({ position, quaternion, scale = 1, box, body, awake = false, user = null }) {
    if (gone) return null;
    const shape = shapeFor(body, box, scale);
    if (!shape || !position?.every?.(Number.isFinite)) {
      if (import.meta.env?.DEV) console.warn('landing physics: no body for', { body, box, scale, position });
      return null;
    }
    const entry = { user, handle: null, scale };
    try {
      entry.handle = physics.add({
        type: shape.type,
        position: position.map((a) => a / metre),
        rotation: quaternion,
        sleeping: !awake,
        mass: shape.mass,
        friction: 0.6,
        restitution: 0.2,
        linearDamping: 0.3,
        angularDamping: 0.6,
        colliders: shape.colliders,
        // (Rapier's gate is the contact's whole force, in newtons: the law's
        // threshold a kilogram, times the thing's kilograms)
        hitThreshold: (shape.mass ?? 1) * threshold,
        onHit: onHit ? (force, at) => onHit(force, at.map((a) => a * metre), entry) : null,
      });
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('landing physics: no body,', err?.message ?? err);
      return null;
    }
    entries.set(entry.handle, entry);
    return entry;
  }

  // the landing's fixed things: a post each, a body a batch
  let wallCount = 0;
  function walls(list) {
    if (gone || !list?.length) return;
    const colliders = [];
    for (const w of list) {
      const l = Math.hypot(w?.n?.[0], w?.n?.[1], w?.n?.[2]);
      const r = w?.r / metre;
      if (!(l > 0) || !(r > 0)) continue;
      const n = w.n.map((a) => a / l);
      colliders.push({ shape: 'cylinder', args: [POST, r], position: n.map((a) => a * (Rm + POST - 0.3)), rotation: upTurn(n) });
    }
    if (!colliders.length) return;
    physics.add({ type: 'fixed', group: 'floor', friction: 0.6, colliders });
    wallCount += colliders.length;
  }
  Object.defineProperty(walls, 'count', { get: () => wallCount });

  // the people about: a capsule each, where foot.js has put them, moved
  // over the substeps the next step(dt) will take
  function people(list, dt = 1 / 60) {
    if (gone) return;
    const n = Math.min(SUBSTEPS, Math.floor(physics.alpha + (dt > 0 ? dt : 0) / STEP + 1e-9));
    const seen = new Set();
    for (const p of list) {
      if (!p?.at?.every?.(Number.isFinite)) continue;
      seen.add(p.key);
      const up = p.up ?? [0, 1, 0];
      const centre = [0, 1, 2].map((i) => p.at[i] / metre + up[i] * (PERSON.half + PERSON.radius));
      let pusher = pushers.get(p.key);
      if (!pusher) {
        pusher = addPusher(physics, { ...PERSON, position: centre });
        pushers.set(p.key, pusher);
      }
      // (no substep this frame: it stays where it is, as its walker will be
      // by the next one)
      if (n > 0) pusher.follow(centre, n * STEP, upTurn(up));
    }
    for (const [key, pusher] of pushers) {
      if (seen.has(key)) continue;
      pusher.remove();
      pushers.delete(key);
    }
  }

  // a bolt's flight this frame, from → to: the first thing in its way, knocked
  // (a fixed one stops it unmoved; the floor, the cap and the walls' posts
  // aren't things, so it flies on through those)
  const thing = (c) => entries.has(c.parent()?.userData);
  function shot(from, to) {
    if (gone) return null;
    const o = from.map((a) => a / metre);
    const d = [0, 1, 2].map((i) => to[i] / metre - o[i]);
    const len = Math.hypot(...d);
    if (!(len > 1e-6)) return null;
    const dir = { x: d[0] / len, y: d[1] / len, z: d[2] / len };
    const hit = world.castRay(new RAPIER.Ray({ x: o[0], y: o[1], z: o[2] }, dir), len, true, RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, undefined, undefined, thing);
    const entry = hit && entries.get(hit.collider.parent()?.userData);
    if (!entry) return null;
    const t = hit.timeOfImpact;
    const at = [o[0] + dir.x * t, o[1] + dir.y * t, o[2] + dir.z * t];
    const j = knockOf(entry.handle.mass);
    if (j > 0) {
      const l = Math.hypot(...at);
      const { side, lift } = shotImpulse(j, [dir.x, dir.y, dir.z], at.map((a) => a / l));
      const c = entry.handle.body.worldCom();
      entry.handle.push(side, [c.x + KNOCK.spin * (at[0] - c.x), c.y + KNOCK.spin * (at[1] - c.y), c.z + KNOCK.spin * (at[2] - c.z)]);
      entry.handle.push(lift); // (at the middle of its mass: a hop, no spin)
    }
    return { entry, at: at.map((a) => a * metre) };
  }

  const pos = [0, 0, 0];
  const quat = [0, 0, 0, 1];
  const out = (h, entry, write) => {
    h.position(pos);
    for (let i = 0; i < 3; i++) pos[i] *= metre;
    write(entry, pos, h.quaternion(quat));
  };

  return {
    add,
    walls,
    people,
    shot,
    step(dt) {
      if (gone) return 0;
      return physics.step(dt);
    },
    // (the ones awake, and once, any a reset has moved)
    sync(write) {
      if (gone) return;
      physics.awake((h) => {
        const entry = entries.get(h);
        if (!entry || !h.dynamic) return;
        h.dirty = false;
        out(h, entry, write);
      });
      for (const [h, entry] of entries) {
        if (!h.dirty) continue;
        h.dirty = false;
        out(h, entry, write);
      }
    },
    settle(at, metres) {
      if (!gone) physics.sleepOutside(at.map((a) => a / metre), metres);
    },
    // (where someone's capsule is: its middle, map units)
    where(key) {
      const pusher = pushers.get(key);
      return pusher ? pusher.position().map((a) => a * metre) : null;
    },
    get pushers() {
      return pushers.size;
    },
    get size() {
      return entries.size;
    },
    dispose() {
      if (gone) return;
      gone = true;
      entries.clear();
      pushers.clear();
      physics.dispose();
    },
  };
}
