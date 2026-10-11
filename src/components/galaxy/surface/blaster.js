// Blaster fire on the ground, every bolt of it on lib/combat/bolt.js's one
// step: yours (from the muzzle to where your eyes' line first meets
// something: a target, a wall, the ground), theirs at you, theirs at each
// other and your mate's. Each flies at the one speed and stops at the first
// thing in its way, tested every frame against the world's solids
// (solids.js), the bodies' capsules and a raised blade; what it hit comes
// back as an event when it gets there, never decided when it's fired.
//
// createBlaster({ parent, world, pool, ballistic }) → { bolts (the pool),
// solids (the world's raycast: a physics world's `physicsRay` when it has
// one, a segment ray in bolt.js's solids form such as lib/physics/blast.js's
// segmentRay, else solids.js over the walker's world), aim(from, dir, targets, reach) → { target, at },
// fire(from, dir, targets, color, reach, muzzle, tag) → { target, at, bolt }
// (`target`: what the eyes' line meets first, for the flash's way; the hit
// itself is the bolt's event), enemy(from, to, spread, color, damage, opts)
// → bolt (at `to`, scattered by `spread`; turned by a raised blade),
// shoot(spec) → bolt (lib/combat/bolt's fire), tracer(from, to, color) (a
// battle's bolt that only walls stop), update(dt, { bodies, blades }) →
// the step's events, flash(at), dispose() }; `pool`: bolts in the air at
// once (48 unless a battle asks for more); `ballistic`: a projectiles.json
// row your bolts fly by (lib/combat/ballistics.js, at the one speed), none
// and they fly straight as ever.
// capsuleOf(t) → { a, b, r }: a figure's body as the bolts see it.

import * as THREE from 'three';
import { scatter } from '../../../lib/combat/accuracy';
import { BOLT_SPEED, createBolts, segCapsule } from '../../../lib/combat/bolt';
import { createBoltMeshes } from '../../../lib/three/combat/bolts';
import { boltSolids } from './solids';

const RANGE = 90;
const POOL = 48;

const arr = (v) => (Array.isArray(v) ? v : [v.x, v.y, v.z]);

// a figure's body: feet to crown, as wide as a person of its height
export function capsuleOf(t) {
  const p = t.holder.position;
  const tall = (t.fig?.tall ?? 1.6) * (t.spec?.scale ?? 1);
  const r = Math.max(0.4, tall * 0.25);
  return { a: [p.x, p.y + r, p.z], b: [p.x, p.y + Math.max(r, tall - r), p.z], r };
}

export function createBlaster({ parent, world, pool = POOL, ballistic = null }) {
  const bolts = createBolts({ pool });
  const draw = createBoltMeshes(parent, { pool });
  // (read each time: a level's engine comes after the blaster is made)
  const walkerSolids = boltSolids(world);
  const solids = (a, b, exclude) => (world.physicsRay ?? walkerSolids)(a, b, exclude);
  const flat = { solids, bodies: [], blades: [] };

  // the first thing along a ray: a target's body or a solid (the aim point)
  const aim = (from, dir, targets, reach = RANGE) => {
    const a = arr(from);
    const d = arr(dir);
    const l = Math.hypot(d[0], d[1], d[2]) || 1;
    const far = Math.min(RANGE, reach);
    const b = [a[0] + (d[0] / l) * far, a[1] + (d[1] / l) * far, a[2] + (d[2] / l) * far];
    let t = 1;
    let target = null;
    const wall = solids(a, b);
    if (wall) t = Math.hypot(wall.at[0] - a[0], wall.at[1] - a[1], wall.at[2] - a[2]) / far;
    for (const o of targets) {
      if (!o?.holder) continue;
      const c = capsuleOf(o);
      const k = segCapsule(a, b, c.a, c.b, c.r);
      if (k && k.t < t) {
        t = k.t;
        target = o;
      }
    }
    return { target, at: new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t) };
  };

  return {
    bolts,
    solids,
    aim,
    // yours: the eyes' line finds the aim point; the bolt leaves the gun's
    // `muzzle` (or `from`) for it, and what it hits is its event
    fire(from, dir, targets, color = '#ff3b30', reach = RANGE, muzzle = null, tag = null) {
      const hit = aim(from, dir, targets, reach);
      const start = muzzle ?? from;
      const go = hit.at.clone().sub(start);
      // (the aim point behind the muzzle, a wall at your nose: along the look)
      const way = go.lengthSq() > 1e-4 && go.dot(dir) > 0 ? go : dir;
      const bolt = bolts.fire({ from: arr(start), dir: arr(way), range: Math.min(RANGE, reach), owner: 'you', side: 'you', colour: color, tag, ballistic });
      return { ...hit, bolt };
    },
    // theirs at `to` (a point on you, or on what they believe is you), off by `spread`
    enemy(from, to, spread = 0.06, color = '#ff3b30', damage = 8, { side = 'them', owner = null, tag = null, rng = Math.random, min = 0 } = {}) {
      const f = arr(from);
      const t = arr(to);
      const dir = scatter([t[0] - f[0], t[1] - f[1], t[2] - f[2]], spread, rng, min);
      return bolts.fire({ from: f, dir, range: RANGE, owner, side, damage, colour: color, deflect: true, tag });
    },
    shoot: (spec) => bolts.fire(spec),
    // a battle's (assault.js counts its own hits): it flies, and only a wall stops it
    tracer(from, to, color = '#ff3b30') {
      const f = arr(from);
      const t = arr(to);
      const d = [t[0] - f[0], t[1] - f[1], t[2] - f[2]];
      return bolts.fire({ from: f, dir: d, range: Math.min(RANGE, Math.hypot(d[0], d[1], d[2])), colour: color, ghost: true });
    },
    update(dt, { bodies = [], blades = [] } = {}) {
      flat.bodies = bodies;
      flat.blades = blades;
      const events = bolts.step(dt, flat);
      for (const e of events) if (e.type !== 'gone') draw.flash(e.at);
      draw.sync(bolts.live());
      draw.update(dt);
      return events;
    },
    flash: (at) => draw.flash(at),
    speed: BOLT_SPEED,
    dispose() {
      draw.dispose();
    },
  };
}
