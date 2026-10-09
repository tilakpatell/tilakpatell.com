// Wingmen, drawn: the friends who come to help in a long fight (wingRules.js
// flies them, tested). Each is the traffic's own model of its kind (the
// X-wing, Birdperson, Saul's Cadillac: the side's allies, sides.js;
// glbFleet.js, the same fleet the traffic and the hunters draw from),
// banked into its turns, and its shots are bolts in its own colour (a
// Rebel's red, Birdperson's green, Saul's gold).
//
// createWingmen(parent, { fleet, solids }) → { join(kind, ship, n), update(dt, t,
//   ship, targets) → { hits, events }, active, clear(), dispose(), bodies
//   (shipHits.js's: friends, to bounce off, never hurt) }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { knock } from '../../lib/combat/contact';
import { createFleet } from './glbFleet';
import { createWing } from './wingRules';
import { alliesOf } from './sides';

const BOLT = { length: 0.34, radius: 0.01 };
const COLOUR = Object.fromEntries(Object.entries(alliesOf(null)).map(([k, a]) => [k, a.colour ?? [5.5, 0.6, 0.5]]));

export function createWingmen(parent, { fleet = createFleet(), solids = [] } = {}) {
  const wing = createWing({ solids });
  const pool = {}; // kind → models not in use
  const shown = new Map(); // a wingman → its model
  const boltGeo = new THREE.CylinderGeometry(BOLT.radius, BOLT.radius, BOLT.length, 5).rotateX(Math.PI / 2);
  const boltMats = Object.fromEntries(Object.entries(COLOUR).map(([k, c]) => [k, new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })]));
  const beams = wing.bolts.map(() => {
    const m = new THREE.Mesh(boltGeo, boltMats.xwing);
    m.visible = false;
    m.frustumCulled = false;
    parent.add(m);
    return m;
  });
  const shooter = new Map(); // a bolt → the kind that fired it (its colour)
  let kindNow = 'xwing';
  const look = new THREE.Vector3();

  const take = (kind) => {
    if (fleet.loaded(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) m.dispose();
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    parent.add(model.group);
    return model;
  };
  const give = (w) => {
    const model = shown.get(w);
    if (!model) return;
    model.group.removeFromParent();
    (pool[w.kind] ??= []).push(model);
    shown.delete(w);
  };

  return {
    // a wing of `n` of `kind` (one of the side's allies) up from behind `ship`
    join(kind, ship, n = 2) {
      fleet.want?.([kind]);
      kindNow = kind;
      wing.join(kind, ship, n);
    },

    update(dt, t, ship, targets, opts) {
      const r = wing.update(dt, ship, targets, opts);
      parent.updateWorldMatrix(true, false); // (lookAt is in the world, and the map turns: the map's points are carried into it)
      for (const w of shown.keys()) if (!wing.live.includes(w)) give(w); // (a Map can lose the entry it's on)
      for (const w of wing.live) {
        let model = shown.get(w);
        // one flying its built stand-in takes the model the moment it's here
        // (an escort's stay is short: it would otherwise be built all through)
        if (model && !model.model && fleet.loaded(w.kind)) {
          model.group.removeFromParent();
          model.dispose();
          model = null;
        }
        if (!model) {
          model = take(w.kind);
          shown.set(w, model);
        }
        const g = model.group;
        g.position.set(w.pos.x, w.pos.y, w.pos.z);
        const { x, y, z } = w.vel;
        if (x * x + y * y + z * z > 1e-6) g.lookAt(parent.localToWorld(look.set(w.pos.x + x, w.pos.y + y, w.pos.z + z)));
        g.rotateZ(-w.bank);
        g.scale.setScalar(w.type.size * model.fit);
        model.update(t);
      }
      for (let i = 0; i < wing.bolts.length; i++) {
        const b = wing.bolts[i];
        const m = beams[i];
        if (b.on && !m.visible) shooter.set(b, kindNow);
        m.visible = b.on;
        if (!b.on) continue;
        m.material = boltMats[shooter.get(b)] ?? boltMats.xwing;
        m.position.set(b.x, b.y, b.z);
        m.lookAt(parent.localToWorld(look.set(b.x + b.vx, b.y + b.vy, b.z + b.vz)));
      }
      return r;
    },

    get active() {
      return wing.active;
    },
    get leaving() {
      return wing.leaving;
    },
    // the live wingmen as the rules hold them (to read each frame without a copy: don't keep or change them)
    get ships() {
      return wing.live;
    },
    get bodies() {
      return wing.live.filter((w) => w.alive).map((w) => ({ key: `w:${w.id}`, id: w.id, kind: w.kind, at: w.pos, prev: w.prev, vel: w.vel, size: w.type.size, side: 'friend', hit: () => null, push: (dv) => knock(w, dv) }));
    },
    // for checking from a browser
    get live() {
      return wing.live.map((w) => ({ id: w.id, kind: w.kind, target: w.target, at: [w.pos.x, w.pos.y, w.pos.z].map((v) => +v.toFixed(2)) }));
    },
    get fired() {
      return wing.fired;
    },

    clear() {
      for (const w of [...shown.keys()]) give(w);
      wing.clear();
      for (const m of beams) m.visible = false;
    },

    dispose() {
      this.clear();
      for (const list of Object.values(pool)) for (const m of list) m.dispose();
      boltGeo.dispose();
      for (const m of Object.values(boltMats)) m.dispose();
      for (const m of beams) m.removeFromParent();
    },
  };
}
