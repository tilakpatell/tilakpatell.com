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
// createHunters(parent, { small, fleet, factions, kinds, solids, engines }) → { pack(faction, ship, { prey, size, ace, from, ahead, interdict, heat, first }) → points,
//   update(dt, t, ship) → events,
//   hit(from, to, damage) → hit or null, damage(id, n) → hit or null (a hit
//   another pilot's shot made, told to you), pull(at, r, speed, secs, daze),
//   breakOff() and swallow(at, r) (the crews' ship powers: hunterRules.js's,
//   as they are; a ship handed to update may be a `ghost`, or carry a
//   `magnet`), clear(), dispose(), count,
//   active, wire() (the ones in the fight, for the other pilots to see),
//   targets: the ones still after you (or their prey), for the guns to lock
//   on to: [{ id, at, vel, size, kind, hp, hpMax, faction, threat }] (targeting.js;
//   threat is 1 for one on an attack run at you),
//   bodies: the ones in the fight as shipHits.js's bodies (a rammer is not
//   one: its own burst on you stands), a ram taken as damage(id, punch) and
//   knocking it off its line (the law's knock) }
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

import * as THREE from 'three';
import { knock } from '../../lib/combat/contact';
import { packSkill } from './difficulty';
import { createFleet } from './glbFleet';
import { FACTIONS, HUNTER_KINDS, LASER, NAMES, createHunt, hasTrait } from './hunterRules';

export { FACTIONS, HUNTER_KINDS, NAMES };

// (`factions` and `kinds` are these, unless another map brings its own: the
// galaxy's Separatists and the Imperial remnant, galaxy/hunted.js)
export function createHunters(parent, { small = false, fleet = createFleet(), factions = FACTIONS, kinds = HUNTER_KINDS, solids = [], engines = null } = {}) {
  const hunt = createHunt({ factions, kinds, solids, lasers: small ? 16 : 28 });
  const pool = {}; // kind → models not in use
  let difficulty = null; // (set: the `difficulty` below)
  const shown = new Set(); // the hunters with a model out
  const laserGeo = new THREE.CylinderGeometry(0.009, 0.009, LASER.length, 5).rotateX(Math.PI / 2);
  const laserMats = Object.fromEntries(
    Object.entries(factions).map(([id, f]) => [id, new THREE.MeshBasicMaterial({ color: new THREE.Color(...f.laser), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })]),
  );
  const firstMat = laserMats.empire ?? Object.values(laserMats)[0];
  // an ion bolt is the ion cannons' pale blue, a missile's a hot white-orange, whoever fired it
  const ionMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.2, 6.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const missileMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.5, 3.4, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const beams = hunt.lasers.map(() => {
    const m = new THREE.Mesh(laserGeo, firstMat);
    m.visible = false;
    m.frustumCulled = false;
    parent.add(m);
    return m;
  });

  const drawnAs = (kind) => kinds[kind]?.model ?? kind; // (a kind with no model of its own is drawn as another's)
  const take = (kind) => {
    const drawn = drawnAs(kind);
    // a built stand-in waiting in the pool gives way once the model is here
    if (fleet.loaded(drawn) && pool[kind]?.length && !pool[kind][pool[kind].length - 1].model) for (const m of pool[kind].splice(0)) drop(m);
    const model = pool[kind]?.pop() ?? fleet.make(drawn);
    model.fit ??= 1 / Math.max(model.size?.x ?? 1, model.size?.y ?? 1, model.size?.z ?? 1);
    // (its engines (engines.js), once: lit while it's out)
    if (engines && !model.engine) model.engine = engines.add(drawn, model.group, { size: model.size });
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
  // one flying its built stand-in, its model come since: the model takes over
  // where it is (the stand-in is not wanted again, so it goes, not to the pool)
  const swap = (h) => {
    h.view.group.removeFromParent();
    drop(h.view);
    h.view = take(h.kind);
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
    // how hard the fight is, set: a function giving difficulty.js's numbers
    // now (the setting can change mid-flight): every pack sent flies at its
    // skill (a tier better now and then, the hotter it is) and comes its
    // size more, unless the pack's own `skill` or `more` says otherwise
    get difficulty() {
      return difficulty;
    },
    set difficulty(fn) {
      difficulty = fn ?? null;
    },

    pack(faction, ship, opts = {}) {
      const d = difficulty?.() ?? null;
      const skill = opts.skill !== undefined ? opts.skill : d ? packSkill(d.skill, { heat: opts.heat ?? 0, promote: d.promote }) : null;
      const more = opts.more ?? (d ? d.size : 0);
      const members = hunt.pack(faction, ship, { ...opts, skill, more, prey: preyOf(opts.prey ?? null) });
      // (their models, the ones that are models and not here yet: nothing else
      // asks for a hunter's, and a kind flies as its built one until it comes)
      fleet.want?.([...new Set(members.map((h) => drawnAs(h.kind)))]);
      for (const h of members) {
        h.view = take(h.kind);
        shown.add(h);
      }
      return members.map((h) => new THREE.Vector3(h.pos.x, h.pos.y, h.pos.z));
    },

    // ship: yours ({ x, y, z, heading, pitch, speed, vy }) or null (not
    // flying: they all leave)
    update(dt, t, ship) {
      const events = hunt.update(dt, ship);
      // (lookAt takes a point in the world, and the map turns under the
      // camera: each point is the map's, carried into the world first)
      parent.updateWorldMatrix(true, false);
      // the ones that have gone (flown off, or shot down by someone else)
      for (const h of shown) if (!h.alive) give(h);
      for (const h of hunt.live) {
        // (the moment its model is here, as the galaxy's slots swap theirs: galaxy/models.js)
        if (h.view && !h.view.model && fleet.loaded(drawnAs(h.kind))) swap(h);
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
        m.material = l.ion ? ionMat : l.missile ? missileMat : (laserMats[l.faction] ?? firstMat);
        // (a bomb is a fat slow ball of light, not a bolt; a missile a short thick streak)
        if (l.bomb) m.scale.set(9, 9, 0.5);
        else if (l.missile) m.scale.set(4, 4, 0.7);
        else m.scale.set(1, 1, 1);
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
    // the crews' ship powers (shipPowers.js): the RV's magnet, Han's
    // corkscrew, a portal's mouth (each says how many it had)
    pull: (at, r, speed, secs, daze) => hunt.pull(at, r, speed, secs, daze),
    breakOff: () => hunt.breakOff(),
    swallow: (at, r) => hunt.swallow(at, r),

    // everyone gone at once (you were shot down, or changed ship)
    clear() {
      for (const h of [...shown]) give(h);
      hunt.clear();
      for (const m of beams) m.visible = false;
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
    get bodies() {
      const out = [];
      for (const h of hunt.live) {
        if (!h.alive || h.pack.gone || h.hidden > 0 || hasTrait(h.type, 'rammer')) continue;
        out.push({ key: `h:${h.id}`, id: h.id, kind: h.kind, at: h.pos, prev: h.prev, vel: h.vel, size: h.type.size, side: 'foe', hit: (punch) => answer(hunt.damage(h.id, punch)), push: (dv) => knock(h, dv) });
      }
      return out;
    },
    // the law's eyes and numbers (wanted.js), and one faction sent off
    sees: (factions, range) => hunt.sees(factions, range),
    strength: (faction) => hunt.strength(faction),
    leave: (faction) => hunt.leave(faction),
    // for checking from a browser
    get packs() {
      return hunt.packs;
    },
    wire: () => hunt.wire(),

    dispose() {
      this.clear();
      for (const list of Object.values(pool)) for (const m of list) drop(m);
      laserGeo.dispose();
      for (const m of Object.values(laserMats)) m.dispose();
      ionMat.dispose();
      missileMat.dispose();
      for (const m of beams) m.removeFromParent();
    },
  };
}
