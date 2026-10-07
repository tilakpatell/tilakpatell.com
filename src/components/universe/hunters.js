// Hunters: the ones who come after you. Fly with Luke or Han and it's the
// Empire (TIE fighters in twos and threes, interceptors, and now and then
// Vader himself in his TIE Advanced, who takes some stopping); fly with Rick
// and it's the Galactic Federation's patrol fighters, or the Council of
// Ricks, out of their portals in their own cruisers, wanting their Rick back.
//
// How they fly and fight is hunterRules.js's (plain rules, tested): a pack
// arrives behind you (or ahead, an ambush; or, for the Council, out of
// portals round you) and makes attack runs, a few at a time, each swinging
// out, turning and coming at you, firing when it has you in its sights
// (leading you a little: a cloud of lasers, not a wall), screaming past and
// swinging out again; the quick ones sometimes sit on your tail. They bank
// into their turns, keep clear of each other and steer round the planets
// (which are cover: a laser stops at one). Shoot them down (the tougher
// ones take a few hits), or outrun them: far enough away for long enough
// and they give up and peel away, flying off out of sight (nobody just
// vanishes). Lasers that hit you are the scene's to count against your
// shields. This file is the drawing: each one's model, and the lasers.
//
// A hunter can also be sent after something else (`prey`, a distress call:
// pirates on a freighter), and it shoots at that instead until you deal with
// it, or turns on you if you shoot at it.
//
// createHunters(parent, { small, fleet, factions, kinds, solids, engines, rand, schedule, trace }) → { pack(faction, ship, { prey, size, ace, from, ahead, interdict, heat, first }) → points,
//   update(dt, t, ship) → events,
//   hit(from, to, damage) → hit or null, damage(id, n) → hit or null (a hit
//   another pilot's shot made, told to you), clear(), dispose(), count,
//   active, wire() (the ones in the fight, for the other pilots to see),
//   targets: the ones still after you (or their prey), for the guns to lock
//   on to: [{ id, at, vel, size, kind, hp, hpMax, faction, threat }] (targeting.js;
//   threat is 1 for one on an attack run at you) }
// `solids` is what they fly round: ship.js's, or a function giving them (the
// galaxy's change from system to system).
// A pack sent in `ahead` drops in ahead of you (an ambush on the way
// somewhere) and one that `interdict`s says so in its 'hunted' event: the
// scene holds the pulse drive down while it's on you. `heat` (the trouble
// you've made lately) brings more of them, and the ace more often; the
// `first` pack of a visit is a small one.
//
// Events: { type: 'hunted', faction, kinds, prey, interdict }, { type: 'shot', faction },
// { type: 'stage', id, kind, faction, stage, of, summon } (an ace hurt into
// its next stage: hunterRules.js's `stage`),
// (one fired at you), { type: 'laser', damage, from } (and hit), { type:
// 'escaped', faction } and { type: 'cleared', faction, rescued } (rescued:
// they were after someone else, and you saw them off).
// Everything is in `parent`'s space (the map's).
// They sense and choose on a schedule (lib/ai/schedule: by how near you
// they are) and fly every frame on what they last chose; each choice is
// noted in `trace`. `rand` is the visit's 'hunters' stream (seed.js), and
// the schedule and trace are made here when the scene brings none; `ai`
// ({ schedule, trace }) is what npcs.js puts beside its own on the debug hook.

import * as THREE from 'three';
import { createFleet } from './glbFleet';
import { FACTIONS, HUNTER_KINDS, LASER, NAMES, createHunt } from './hunterRules';
import { seedOf } from './seed';
import { streams } from '../../lib/seeded';
import { byDistance, createSchedule } from '../../lib/ai/schedule';
import { createTrace } from '../../lib/ai/trace';
import { device } from '../../lib/device';
import { scheduleBudget } from './npcs';

export { FACTIONS, HUNTER_KINDS, NAMES };

// (`factions` and `kinds` are these, unless another map brings its own: the
// galaxy's Separatists and the Imperial remnant, galaxy/hunted.js)
// how far off you a hunter still counts for something to the schedule (a
// pack gives up long before: LOSE.far)
const VIEW_RANGE = 300;

export function createHunters(parent, { small = false, fleet = createFleet(), factions = FACTIONS, kinds = HUNTER_KINDS, solids = [], engines = null, rand = null, schedule = null, trace = null } = {}) {
  const seed = rand && schedule ? null : seedOf();
  rand ??= streams(seed).fork('hunters');
  // (half the tier's budget: the characters' schedule has the other half, npcs.js)
  schedule ??= createSchedule({ significance: byDistance, seed, budget: scheduleBudget(device().tier) });
  trace ??= createTrace();
  const hunt = createHunt({ rand, factions, kinds, solids, lasers: small ? 16 : 28, trace });
  const scheduled = new Set(); // the hunters the schedule has
  const dueNow = new Map(); // id → the schedule's entry, this frame
  const timed = (h) => schedule.done(h);
  const enrol = () => {
    for (const h of hunt.live) {
      if (scheduled.has(h)) continue;
      scheduled.add(h);
      schedule.add(h, { id: h.id });
    }
  };
  const unenrol = () => {
    const live = new Set(hunt.live); // (once a frame: a search of the list for each would be n²)
    for (const h of scheduled) {
      if (h.alive && live.has(h)) continue;
      scheduled.delete(h);
      schedule.drop(h);
    }
  };
  const pool = {}; // kind → models not in use
  const shown = new Set(); // the hunters with a model out
  const laserGeo = new THREE.CylinderGeometry(0.009, 0.009, LASER.length, 5).rotateX(Math.PI / 2);
  const laserMats = Object.fromEntries(
    Object.entries(factions).map(([id, f]) => [id, new THREE.MeshBasicMaterial({ color: new THREE.Color(...f.laser), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })]),
  );
  const firstMat = laserMats.empire ?? Object.values(laserMats)[0];
  const beams = hunt.lasers.map(() => {
    const m = new THREE.Mesh(laserGeo, firstMat);
    m.visible = false;
    m.frustumCulled = false;
    parent.add(m);
    return m;
  });

  const take = (kind) => {
    // a built stand-in waiting in the pool gives way once the model is here
    if (fleet.loaded(kind) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) drop(m);
    const model = pool[kind]?.pop() ?? fleet.make(kind);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    // (its engines (engines.js), once: lit while it's out)
    if (engines && !model.engine) model.engine = engines.add(kind, model.group, { size: model.size });
    parent.add(model.group);
    return model;
  };
  const drop = (model) => {
    engines?.remove(model.engine);
    model.dispose();
  };
  const give = (h) => {
    if (!h.view) return;
    h.view.group.removeFromParent();
    h.view.group.visible = true; // (one hidden as it went, shown when it's next out)
    (pool[h.kind] ??= []).push(h.view);
    h.view = null;
    shown.delete(h);
  };
  const look = new THREE.Vector3();
  const answer = (r) => {
    if (!r) return null;
    if (r.down) give(r.hunter);
    return { id: r.id, kind: r.kind, at: new THREE.Vector3(r.at.x, r.at.y, r.at.z), size: r.size, down: r.down, faction: r.hunter.pack.faction, prey: Boolean(r.hunter.pack.prey && !r.hunter.pack.angry) };
  };
  // something else they're after, as the rules read it: where it is, the
  // way it's pointing, and whether it's still there
  const preyOf = (o) =>
    o && {
      at: o.position,
      alive: () => Boolean(o.parent),
      dir: (out) => {
        look.set(0, 0, 1).applyQuaternion(o.quaternion);
        out[0] = look.x;
        out[1] = look.y;
        out[2] = look.z;
      },
    };

  return {
    // a pack of hunters after you (or after `prey`: an Object3D, something
    // else, e.g. a freighter in distress). Returns the points they came in
    // at (the scene opens a portal or flashes a jump at each)
    pack(faction, ship, opts = {}) {
      const members = hunt.pack(faction, ship, { ...opts, prey: preyOf(opts.prey ?? null) });
      for (const h of members) {
        h.view = take(h.kind);
        shown.add(h);
      }
      enrol();
      return members.map((h) => new THREE.Vector3(h.pos.x, h.pos.y, h.pos.z));
    },

    // ship: yours ({ x, y, z, heading, pitch, speed, vy }) or null (not
    // flying: they all leave)
    update(dt, t, ship) {
      // the ones due to sense and choose this frame, nearest you first
      enrol();
      const { due } = schedule.frame(dt, ship ? { at: ship, range: VIEW_RANGE } : null, t);
      dueNow.clear();
      for (const d of due) if (d.agent) dueNow.set(d.agent.id, d);
      const events = hunt.update(dt, ship, { due: dueNow, done: timed, t });
      unenrol();
      // (lookAt takes a point in the world, and the map turns under the
      // camera: each point is the map's, carried into the world first)
      parent.updateWorldMatrix(true, false);
      // the ones that have gone (flown off, or shot down by someone else)
      for (const h of shown) if (!h.alive) give(h);
      for (const h of hunt.live) {
        const g = h.view?.group;
        if (!g) continue;
        g.position.set(h.pos.x, h.pos.y, h.pos.z);
        const { x, y, z } = h.vel;
        if (x * x + y * y + z * z > 1e-6) g.lookAt(parent.localToWorld(look.set(h.pos.x + x, h.pos.y + y, h.pos.z + z)));
        g.rotateZ(-h.bank);
        g.scale.setScalar(h.type.size * h.view.fit * Math.max(0.001, h.grow));
        g.visible = !(h.hidden > 0); // (a flicker, hit: gone from sight a moment)
        // its engines with how fast it's going, flaring past its cruising pace
        if (h.view.engine) {
          const k = Math.sqrt(x * x + y * y + z * z) / (h.type.speed || 8);
          engines.set(h.view.engine, { throttle: Math.min(1, k), boost: Math.max(0, Math.min(1, (k - 0.85) * 4)) });
        }
        h.view.update(t);
      }
      hunt.lasers.forEach((l, i) => {
        const m = beams[i];
        m.visible = l.on;
        if (!l.on) return;
        m.position.set(l.x, l.y, l.z);
        m.material = laserMats[l.faction] ?? firstMat;
        // (a bomb is a fat slow ball of light, not a bolt)
        m.scale.set(l.bomb ? 9 : 1, l.bomb ? 9 : 1, l.bomb ? 0.5 : 1);
        m.lookAt(parent.localToWorld(look.set(l.x + l.vx, l.y + l.vy, l.z + l.vz)));
      });
      return events;
    },

    // a shot of yours from `from` to `to` this frame, worth `damage` hits
    // (a fusion cannon's is worth more): the hunter it hit, if
    // any: { id, kind, at, size, down } (down: it's destroyed; otherwise it
    // took the hit and comes on)
    hit: (from, to, damage = 1) => answer(hunt.hit(from, to, damage)),
    // the same for a hit told to you (another pilot's shot at one of yours)
    damage: (id, n = 1) => answer(hunt.damage(id, n)),

    // everyone gone at once (you were shot down, or changed ship)
    clear() {
      for (const h of [...shown]) give(h);
      hunt.clear();
      for (const m of beams) m.visible = false;
      unenrol();
    },

    get count() {
      return hunt.count;
    },
    get targets() {
      return hunt.targets;
    },
    get active() {
      return hunt.active;
    },
    // for checking from a browser
    get packs() {
      return hunt.packs;
    },
    wire: () => hunt.wire(),
    // what they think on and what they chose (npcs.js puts it on the debug hook)
    ai: { schedule, trace },

    dispose() {
      this.clear();
      for (const list of Object.values(pool)) for (const m of list) drop(m);
      laserGeo.dispose();
      for (const m of Object.values(laserMats)) m.dispose();
      for (const m of beams) m.removeFromParent();
    },
  };
}
