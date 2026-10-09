// A skirmish, drawn: someone else's fight out ahead of you (skirmish.js
// fights it, tested). The freighter, the hunters on it and its escort are
// the traffic's and the hunters' own models (glbFleet.js, the fleet they all
// draw from); the hunters' lasers are in their faction's colour, the
// escort's bolts in a Rebel's red or Birdperson's green.
//
// createSkirmishes(parent, { fleet, solids }) → { start(opts) → bool,
//   update(dt, t) → events, hit(from, to, damage), targets, active, over,
//   info, clear(), dispose(), bodies (shipHits.js's: its hunters, foes, a
//   ram on one a shot's hit; its escort, friends; its freighter, civil, and
//   no shot of yours hurts it, so neither does a ram) }
// Everything is in `parent`'s space (the map's).

import * as THREE from 'three';
import { knock } from '../../lib/combat/contact';
import { createFleet } from './glbFleet';
import { FACTIONS, LASER, hasTrait } from './hunterRules';
import { createSkirmish } from './skirmish';

// the freighters' sizes (their length, as the traffic draws them)
const CIVIL_SIZE = { transport: 1.8, freighter: 0.7, saucer: 0.45, hauler: 0.9 };
const BOLT = { xwing: [5.5, 0.6, 0.5], birdperson: [0.7, 5.5, 1.2] };

export function createSkirmishes(parent, { fleet = createFleet(), solids = [] } = {}) {
  const sk = createSkirmish({ solids });
  const pool = {}; // kind → models not in use
  const shown = new Map(); // a thing (a hunter, a wingman, the freighter) → its model
  const look = new THREE.Vector3();
  const geo = new THREE.CylinderGeometry(0.009, 0.009, LASER.length, 5).rotateX(Math.PI / 2);
  const additive = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const factionMats = Object.fromEntries(Object.entries(FACTIONS).map(([id, f]) => [id, additive(f.laser)]));
  const boltMats = Object.fromEntries(Object.entries(BOLT).map(([k, c]) => [k, additive(c)]));
  const beamsFor = (list) =>
    list.map(() => {
      const m = new THREE.Mesh(geo, factionMats.empire);
      m.visible = false;
      m.frustumCulled = false;
      parent.add(m);
      return m;
    });
  const laserBeams = beamsFor(sk.hunt.lasers);
  const shotBeams = beamsFor(sk.shots);
  const boltBeams = beamsFor(sk.wing.bolts);
  let escortKind = 'xwing';
  let drawn = false; // (something of it was drawn last frame)
  const NONE = [];

  const take = (kind) => {
    if (fleet.loaded(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) m.dispose();
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    parent.add(model.group);
    return model;
  };
  const give = (thing, kind) => {
    const model = shown.get(thing);
    if (!model) return;
    model.group.removeFromParent();
    (pool[kind] ??= []).push(model);
    shown.delete(thing);
  };
  // a thing's model, where it is, nose along `vel`, banked, at `size`
  const draw = (thing, kind, pos, vel, bank, size, t) => {
    let model = shown.get(thing);
    if (!model) {
      model = take(kind);
      shown.set(thing, model);
    }
    const g = model.group;
    g.position.set(pos.x, pos.y, pos.z);
    if (vel.x * vel.x + vel.y * vel.y + vel.z * vel.z > 1e-6) g.lookAt(parent.localToWorld(look.set(pos.x + vel.x, pos.y + vel.y, pos.z + vel.z)));
    if (bank) g.rotateZ(-bank);
    g.scale.setScalar(size * model.fit);
    model.update(t);
  };
  const beam = (m, b, mat) => {
    m.visible = b.on;
    if (!b.on) return;
    m.material = mat;
    m.position.set(b.x, b.y, b.z);
    m.lookAt(parent.localToWorld(look.set(b.x + b.vx, b.y + b.vy, b.z + b.vz)));
  };
  const freighterVel = { x: 0, y: 0, z: 0 };
  const kinds = new Map(); // a thing → the kind its model is (for giving it back)
  const seen = new Set(); // (the things drawn this frame: reused)

  const sync = (t) => {
    parent.updateWorldMatrix(true, false); // (lookAt is in the world, and the map turns: the map's points are carried into it)
    const f = sk.freighter;
    seen.clear();
    if (f.on && f.alive) {
      freighterVel.x = -Math.sin(f.heading);
      freighterVel.z = -Math.cos(f.heading);
      draw(f, f.kind, f, freighterVel, 0, CIVIL_SIZE[f.kind] ?? 1, t);
      kinds.set(f, f.kind);
      seen.add(f);
    }
    for (const h of sk.hunt.live) {
      draw(h, h.kind, h.pos, h.vel, h.bank, h.type.size * Math.max(0.001, h.grow), t);
      kinds.set(h, h.kind);
      seen.add(h);
    }
    for (const w of sk.wing.live) {
      draw(w, w.kind, w.pos, w.vel, w.bank, w.type.size, t);
      kinds.set(w, w.kind);
      seen.add(w);
    }
    for (const thing of shown.keys()) {
      if (seen.has(thing)) continue;
      give(thing, kinds.get(thing)); // (a Map can lose the entry it's on)
      kinds.delete(thing);
    }
    const fm = factionMats[f.faction] ?? factionMats.empire;
    for (let i = 0; i < laserBeams.length; i++) beam(laserBeams[i], sk.hunt.lasers[i], factionMats[sk.hunt.lasers[i].faction] ?? fm);
    for (let i = 0; i < shotBeams.length; i++) beam(shotBeams[i], sk.shots[i], factionMats[sk.shots[i].faction] ?? fm);
    for (let i = 0; i < boltBeams.length; i++) beam(boltBeams[i], sk.wing.bolts[i], boltMats[escortKind] ?? boltMats.xwing);
  };

  return {
    // one out ahead (skirmish.js's start: { at, heading, faction, escort, civil })
    start(opts) {
      fleet.want?.([opts.civil, opts.escort, ...(FACTIONS[opts.faction]?.kinds ?? []).map(([k]) => k)].filter(Boolean));
      escortKind = opts.escort ?? 'xwing';
      return sk.start(opts);
    },

    // `viewer`: where you are (the ship), or null
    update(dt, t, viewer = null) {
      if (!sk.active) {
        if (shown.size || drawn) {
          sync(t);
          for (const m of [...laserBeams, ...shotBeams, ...boltBeams]) m.visible = false;
          drawn = false;
        }
        return NONE;
      }
      const events = sk.update(dt, viewer);
      sync(t);
      drawn = true;
      return events;
    },

    hit: (from, to, damage = 1) => sk.hit(from, to, damage),

    get targets() {
      return sk.targets;
    },
    get active() {
      return sk.active;
    },
    get bodies() {
      if (!sk.active) return NONE;
      const out = [];
      for (const h of sk.hunt.live) {
        if (!h.alive || h.pack.gone || h.hidden > 0 || hasTrait(h.type, 'rammer')) continue;
        out.push({ key: `sk:h:${h.id}`, id: h.id, kind: h.kind, at: h.pos, prev: h.prev, vel: h.vel, size: h.type.size, side: 'foe', hit: (punch) => sk.hunt.damage(h.id, punch), push: (dv) => knock(h, dv) });
      }
      for (const w of sk.wing.live) if (w.alive) out.push({ key: `sk:w:${w.id}`, id: w.id, kind: w.kind, at: w.pos, prev: w.prev, vel: w.vel, size: w.type.size, side: 'friend', hit: () => null, push: (dv) => knock(w, dv) });
      const f = sk.freighter;
      if (f.on && f.alive) {
        const v = { x: -Math.sin(f.heading) * Math.cos(f.pitch) * f.speed, y: f.vy, z: -Math.cos(f.heading) * Math.cos(f.pitch) * f.speed };
        out.push({ key: 'sk:f', id: 'freighter', kind: f.kind, at: { x: f.x, y: f.y, z: f.z }, vel: v, size: CIVIL_SIZE[f.kind] ?? 0.7, side: 'civil', hit: () => null });
      }
      return out;
    },
    get over() {
      return sk.over;
    },
    // where it is, for the crew and the scene (null when there's none)
    get at() {
      return sk.active ? { x: sk.freighter.x, y: sk.freighter.y, z: sk.freighter.z } : null;
    },
    // for checking from a browser
    get info() {
      const f = sk.freighter;
      return sk.active ? { freighter: f.alive ? { kind: f.kind, hp: f.hp, at: [f.x, f.y, f.z].map((v) => +v.toFixed(1)) } : null, hunters: sk.hunt.live.map((h) => h.kind), escort: sk.wing.live.map((w) => w.kind), over: sk.over } : null;
    },

    clear() {
      sk.clear();
      sync(0);
    },

    dispose() {
      this.clear();
      for (const list of Object.values(pool)) for (const m of list) m.dispose();
      geo.dispose();
      for (const m of [...Object.values(factionMats), ...Object.values(boltMats)]) m.dispose();
      for (const m of [...laserBeams, ...shotBeams, ...boltBeams]) m.removeFromParent();
    },
  };
}
