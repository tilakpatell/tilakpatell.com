// A beat’s things knocked flying, on Rapier (lib/physics/world.js, loaded
// only when a tumble is first made, and not on low): crates and barrels as
// light bodies asleep on a slab of ground, movers (the Riders at a gallop)
// as kinematic boxes along the same paths their scene draws them on, and
// each body’s place written onto the beat’s own mesh. It is run as
// tumble.rules.js’s replay says, so it stays a function of the beat’s time:
// walk back before the beat and everything stands again; walk on through it
// and it falls the same way. Without the engine (low, or not loaded yet)
// the things stand where they were put.
//
//   createTumble({ items, movers, ground, physical }) → { update(now), ready, dispose() }
//     items: [{ object (its position and quaternion are the body’s), kind: 'crate' | 'barrel', half: [x, y, z] | { r, h } }]
//     movers: [{ at(t, out: Vector3) → out or null (not yet, or gone), half: [x, y, z] }]
//     ground: { y, x: [x0, x1], z: [z0, z1] }
//     now: the beat’s seconds (null before it, Infinity long done)

import * as THREE from 'three';
import { SETTLED, replay } from './tumble.rules';

const MASS = { crate: 8, barrel: 20 };
const AWAY = { x: 0, y: -100, z: 0 }; // (a mover not yet on its path, or past it)

const collider = (it) => (it.kind === 'barrel' ? { shape: 'cylinder', args: [it.half.h / 2, it.half.r] } : { shape: 'cuboid', args: it.half });

export function createTumble({ items, movers = [], ground, physical = true }) {
  const start = items.map((it) => ({ p: it.object.position.clone(), q: it.object.quaternion.clone() }));
  let world = null;
  let bodies = [];
  let kin = [];
  let last = null;
  let simT = 0;
  let gone = false;
  const v = new THREE.Vector3();
  const pa = [0, 0, 0];
  const qa = [0, 0, 0, 1];

  const ready = physical
    ? import('../../../lib/physics/world')
        .then(async ({ createPhysics }) => {
          const w = await createPhysics({ gravity: -9.81, maxSubsteps: Math.ceil(SETTLED * 60) + 4 });
          if (gone) return w.dispose();
          const [x0, x1] = ground.x;
          const [z0, z1] = ground.z;
          w.add({ type: 'fixed', position: [(x0 + x1) / 2, ground.y - 0.5, (z0 + z1) / 2], friction: 0.8, colliders: [{ shape: 'cuboid', args: [(x1 - x0) / 2, 0.5, (z1 - z0) / 2] }] });
          bodies = items.map((it, i) => w.add({ type: 'dynamic', position: start[i].p.toArray(), rotation: start[i].q.toArray(), mass: MASS[it.kind] ?? 10, friction: 0.6, restitution: 0.2, sleeping: true, colliders: [collider(it)] }));
          kin = movers.map((m) => w.add({ type: 'kinematicPositionBased', position: [AWAY.x, AWAY.y, AWAY.z], colliders: [{ shape: 'cuboid', args: m.half }] }));
          // (before each substep, each mover to where its path has it at that moment of the beat)
          w.onSubstep((dt) => {
            simT += dt;
            movers.forEach((m, i) => kin[i].body.setNextKinematicTranslation(m.at(simT, v) ?? AWAY));
          });
          w.step(1 / 60);
          world = w;
          return true;
        })
        .catch(() => false)
    : Promise.resolve(false);

  const write = () => {
    bodies.forEach((b, i) => {
      b.position(pa);
      b.quaternion(qa);
      items[i].object.position.set(pa[0], pa[1], pa[2]);
      items[i].object.quaternion.set(qa[0], qa[1], qa[2], qa[3]);
    });
  };

  return {
    ready,
    update(now) {
      const r = replay(last, now);
      if (!world) return;
      last = now;
      if (r.reset) {
        for (const b of [...bodies, ...kin]) b.reset();
        simT = 0;
        items.forEach((it, i) => {
          it.object.position.copy(start[i].p);
          it.object.quaternion.copy(start[i].q);
        });
      }
      if (r.run > 0) {
        world.step(r.run);
        write();
      }
    },
    dispose() {
      gone = true;
      world?.dispose();
      world = null;
    },
  };
}
