// A fight over the C-137 street: the cruiser's guns against the Federation
// patrol (./patrolRules.js), and its laser against the cruiser's deflectors.
// The cruiser fires the universe's armoury (its three lines, as fitted in
// the Hangar and tuned by the skill tree: the universe's weapons.js, through
// its flying face), on the one bolt step every blaster on the site flies by
// (lib/combat/bolt.js), drawn as Morty's shots are (the scene's bolts). Its
// guns turn onto the patrol when it's within their reach and turn; the
// heavy rounds home on it. The patrol's hits take the deflectors down (less
// with the skill tree's plating: stats.armorGame); at none the cruiser's
// engines cut out for `down` seconds and the patrol goes back to its loop.
// The deflectors come back once out of trouble a while, as the map's
// shields do. Its powers are the crew's (./streetPowers.js: G and X, the
// pair carried and the skill tree's effects), played at the street's size.
// The skill tree's four unique weapons fire here too, at the street's size
// against its one patrol (lib/arms/behaviours.js's tricks, as the map's
// uniqueArms.js plays them): a seismic charge dropped behind that goes off
// at its fuse, the patrol hit if it's within the ring; dark matter, a slow,
// big bolt; the cluster's round, bursting into its shards near the patrol;
// the arc, landing at once on the patrol within the guns' reach, drawn as a
// bolt too fast to see fly.
// In a chase (./games/chase.js) the patrol's turned on the cruiser without
// a word and held: a hit on it flashes and takes nothing, so it can't be
// shot down mid-run; let go, it's calmed (and held `keep` seconds more, when
// asked: a chase won, the shots still in the air don't turn it).
// Pure: plain arrays, no React, no three.js.
//
//   FIGHT                          its numbers
//   createStreetFight({ loadout, fx, picks, charge, rand }) → {
//     patrol, shield, groundedUntil, armory,
//     fire(now, cruiser, at, cadence?) → boolean   (`at`: the patrol's place, or null)
//     pick(i), cycle(dir), refit(loadout, fx), view() → the HUD kit's ArmsView,
//     ring() → { angle } while the patrol fights (ship.js's stepFedShip), else null,
//     grounded(now), step(dt, now, { cruiser, at, flying, stats }) → events, live(), clear(),
//     power(slot, now, cruiser, at) → { ok, id, why, portal? } (G and X), setPowers(picks, fx),
//     chase(on, now, keep) (a chase's start, held; its end, let go and calmed, held `keep` s more),
//     placeTiles(root, on, denied, nowMs) (the HUD's power tiles) }
//   events: { type: 'hit', at } (a flash) | 'provoked' | 'down' | 'hurt' | 'grounded' | 'back'
// (now in seconds; `cruiser` { x, y, z, yaw })

import { SHIP_FX, burstDirs } from '../../../lib/arms/behaviours';
import { createBolts } from '../../../lib/combat/bolt';
import { armsView, createArmory, createPowerTiles, fan, picksFor, steer } from '../../universe/shared/flying';
import { PATROL, calm, hitPatrol, newPatrol, patrolShot, provoke, stepPatrol } from './patrolRules';
import { createStreetPowers } from './streetPowers';

export const FIGHT = {
  shield: 100,
  regen: 12, // a second, once out of trouble `delay` seconds (the map's)
  delay: 5,
  down: 10, // seconds the engines are out at no deflectors
  reach: 45, // how far the guns turn onto the patrol from
  turn: 1.4, // and how far off the nose (radians)
  bolt: 60, // m/s, a blaster bolt's (the line's own speed times this)
  cadence: 0.19, // seconds between blaster shots (the cruiser's, armsTabRules.js's)
  body: { cruiser: 1.7, patrol: 2.4 }, // their sizes, for a hit
  ringRate: 0.45, // radians a second the patrol goes round its ring
  colour: '#9dff4a',
  heavy: '#dff4ff',
  foe: '#ff5a3c',
  // the unique four at the street's size (`ring`: the seismic charge's, metres; `drop`: how fast it falls behind)
  unique: { ring: 9, drop: 3, arc: 400, colour: { darkmatter: '#3dff6a', crystal: '#7fd8ff', energon: '#9ff3ff' } },
};

const NONE = [];
const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

export function createStreetFight({ loadout, fx = null, picks = null, charge = 0, rand = Math.random } = {}) {
  const armory = createArmory('cruiser', loadout, fx ?? undefined);
  const powers = createStreetPowers({ rand, charge });
  const tiles = createPowerTiles();
  const setPowers = (p, f) => powers.setCrew(picksFor('cruiser', p, f?.carry), f);
  setPowers(picks, fx);
  const bolts = createBolts({ pool: 16 });
  let patrol = newPatrol();
  let shield = FIGHT.shield;
  let hitAt = -Infinity;
  let groundedUntil = -Infinity;
  let angle = 0;
  let heldUntil = -Infinity; // (in a chase, and a while after when asked: hits take nothing)
  const ringArg = { angle: 0 };
  const armsOut = { name: '', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 };
  // (the two bodies a bolt can meet, moved each step)
  const patrolBody = { id: 'patrol', a: [0, 0, 0], b: [0, 0, 0], r: FIGHT.body.patrol, side: 'them', ref: 'patrol' };
  const cruiserBody = { id: 'cruiser', a: [0, 0, 0], b: [0, 0, 0], r: FIGHT.body.cruiser, side: 'you', ref: 'cruiser' };
  const both = [patrolBody, cruiserBody];
  const alone = [cruiserBody];
  const patrolOnly = [patrolBody];
  const jitter = () => rand() * 2 - 1;
  const grounded = (now) => now < groundedUntil;
  let arcs = []; // the arc's punches, landed on the step after it's fired (where a hit is landed)
  const U = FIGHT.unique;
  // a unique line's shot: `dir` the guns' way (onto the patrol where they turn to it), `nose` the cruiser's
  const fireUnique = (id, w, from, dir, nose, c, at) => {
    if (id === 'seismic') {
      const back = [c.x - nose[0] * 3, c.y - 0.4, c.z - nose[2] * 3];
      bolts.fire({ from: back, dir: [-nose[0], 0, -nose[2]], speed: U.drop, range: U.drop * SHIP_FX.seismic.fuse, owner: 'cruiser', side: 'you', damage: w.punch, colour: FIGHT.heavy, tag: 'seismic' }).homing = 0;
      return;
    }
    if (id === 'energon') {
      const d = at && patrol.mode !== 'down' ? Math.hypot(at.x - from[0], at.y - from[1], at.z - from[2]) : Infinity;
      const reach = d <= Math.min(FIGHT.reach, SHIP_FX.energon.reach) && dir !== nose;
      if (reach) arcs.push(w.punch);
      bolts.fire({ from, dir, speed: U.arc, range: reach ? d : 6, owner: 'cruiser', side: 'you', damage: 0, colour: U.colour.energon, ghost: true, tag: 'arc' }).homing = 0;
      return;
    }
    const speed = FIGHT.bolt * w.speed;
    for (const d of fan(dir, w.count, w.cone, jitter)) {
      const b = bolts.fire({ from, dir: d, speed, range: speed * w.life, owner: 'cruiser', side: 'you', damage: w.punch, colour: U.colour[id] ?? FIGHT.colour, tag: id === 'crystal' ? 'cluster' : 'shot' });
      b.homing = id === 'crystal' ? (w.homing ?? 0) : 0;
    }
  };
  // the cluster's rounds near the patrol: each bursts into its shards, flying on at it
  const burstNear = (at) => {
    const P = SHIP_FX.crystal;
    for (const b of bolts.live()) {
      if (b.tag !== 'cluster' || Math.hypot(at.x - b.pos[0], at.y - b.pos[1], at.z - b.pos[2]) > P.near) continue;
      b.alive = false;
      const way = unit(at.x - b.pos[0], at.y - b.pos[1], at.z - b.pos[2]);
      for (const d of burstDirs(way, P.shards, P.cone, rand)) bolts.fire({ from: b.pos, dir: d, speed: P.speed, range: P.reach, owner: 'cruiser', side: 'you', damage: (P.punch * b.damage) / 3, colour: U.colour.crystal, tag: 'shot' }).homing = 0;
    }
  };

  return {
    get patrol() {
      return patrol;
    },
    get shield() {
      return shield;
    },
    get groundedUntil() {
      return groundedUntil;
    },
    armory,
    grounded,
    pick: (i) => armory.select(i),
    cycle: (dir) => armory.cycle(dir),
    refit: (next, nextFx) => armory.refit(next, nextFx ?? {}),
    view: () => armsView(armory, armsOut),
    setPowers,
    // G and X: the power, if it can be (`portal`: where the cruiser comes out)
    power: (slot, now, c, at) => powers.press(slot, { now, cruiser: c, at: at && patrol.mode !== 'down' ? at : null }),
    placeTiles: (root, on, denied, nowMs) => tiles.place(root, on, powers.view(), denied, nowMs),
    chase(on, now, keep = 0) {
      heldUntil = on ? Infinity : (now ?? -Infinity) + keep;
      patrol = on ? provoke(patrol, now) : calm(patrol);
    },
    ring() {
      if (patrol.mode !== 'fight') return null;
      ringArg.angle = angle;
      return ringArg;
    },

    // the line picked, from the nose: onto the patrol if it's within the
    // guns' reach and turn, else straight ahead
    fire(now, c, at, cadence = 1) {
      if (grounded(now) || !armory.ready(now * 1000, FIGHT.cadence * cadence)) return false;
      const w = armory.weapon;
      const nose = [Math.sin(c.yaw), 0, Math.cos(c.yaw)];
      const from = [c.x + nose[0] * 2, c.y, c.z + nose[2] * 2];
      let dir = nose;
      if (at && patrol.mode !== 'down') {
        const to = [at.x - from[0], at.y - from[1], at.z - from[2]];
        const d = Math.hypot(to[0], to[1], to[2]);
        const flat = Math.hypot(to[0], to[2]) || 1;
        const off = Math.acos(Math.max(-1, Math.min(1, (to[0] * nose[0] + to[2] * nose[2]) / flat)));
        if (d < FIGHT.reach && off < (powers.mods().assist ? Math.PI : FIGHT.turn)) dir = unit(to[0], to[1], to[2]);
      }
      const speed = FIGHT.bolt * w.speed;
      if (w.unique) fireUnique(armory.id, w, from, dir, nose, c, at);
      else
        for (const d of fan(dir, w.count, w.cone, jitter)) {
          const b = bolts.fire({ from, dir: d, speed, range: speed * w.life, owner: 'cruiser', side: 'you', damage: w.punch, colour: w.heavy ? FIGHT.heavy : FIGHT.colour, tag: w.heavy ? 'heavy' : 'shot' });
          b.homing = w.heavy ? (w.homing ?? 0) : 0;
        }
      armory.fired(now * 1000);
      return true;
    },

    step(dt, now, { cruiser: c, at = null, flying = true, stats = null }) {
      let out = NONE;
      const say = (e) => (out === NONE ? (out = [e]) : out.push(e));
      armory.update(dt);
      const back = stepPatrol(patrol, now);
      if (back !== patrol) {
        patrol = back;
        say({ type: 'back' });
      }
      if (!flying) patrol = calm(patrol);
      if (patrol.mode === 'fight') angle += FIGHT.ringRate * dt;
      const up = Boolean(at) && patrol.mode !== 'down';
      const m = powers.mods();
      // the patrol's laser, while it's fighting and you're up there (not
      // while the magnets have it dazed; slowed while Force Focus is on)
      if (up && flying && !grounded(now) && !m.daze) {
        const r = patrolShot(patrol, at, c, now, rand);
        patrol = r.shot && m.slow < 1 ? { ...r.patrol, nextShot: now + (r.patrol.nextShot - now) / m.slow } : r.patrol;
        if (r.shot) {
          const L = PATROL.laser;
          const b = bolts.fire({ from: r.shot.from, dir: r.shot.dir, speed: L.speed, range: L.speed * L.life, owner: 'patrol', side: 'them', damage: L.damage, colour: FIGHT.foe, tag: 'laser' });
          b.homing = 0;
        }
      }
      // what the powers fire (the ray, the torpedoes, Chewie, the crystal)
      for (const s of powers.step(dt, { now, cruiser: c, at: up ? at : null, flying })) {
        const b = bolts.fire({ from: s.from, dir: s.dir, speed: s.speed, range: s.range, owner: 'cruiser', side: 'you', damage: s.damage, colour: s.colour, tag: s.tag });
        b.homing = s.homing ?? 0;
      }
      // the heavy rounds come round onto it (the cluster's too, bursting near it)
      if (up) {
        burstNear(at);
        for (const b of bolts.live()) {
          if ((b.tag !== 'heavy' && b.tag !== 'cluster') || !b.homing) continue;
          steer(b.dir, unit(at.x - b.pos[0], at.y - b.pos[1], at.z - b.pos[2]), b.homing, dt);
        }
        patrolBody.a[0] = patrolBody.b[0] = at.x;
        patrolBody.a[2] = patrolBody.b[2] = at.z;
        patrolBody.a[1] = at.y - 0.6;
        patrolBody.b[1] = at.y + 0.6;
      }
      cruiserBody.a[0] = cruiserBody.b[0] = c.x;
      cruiserBody.a[2] = cruiserBody.b[2] = c.z;
      cruiserBody.a[1] = c.y - 0.3;
      cruiserBody.b[1] = c.y + 0.6;
      const land = (punch) => {
        const was = patrol.mode;
        const r = now < heldUntil ? { patrol, down: false } : hitPatrol(patrol, punch, now);
        patrol = r.patrol;
        if (punch > 0) powers.hit();
        if (r.down) {
          powers.kill();
          say({ type: 'down' });
        } else if (was === 'calm' && patrol.mode === 'fight') say({ type: 'provoked' });
      };
      // the arc, landed as it's drawn
      if (arcs.length) {
        if (up && patrol.mode !== 'down') for (const p of arcs) land(p);
        if (up) say({ type: 'hit', at: [at.x, at.y, at.z] });
        arcs = [];
      }
      // (a cruiser set down is out of the fight: a laser still in the air passes it)
      for (const e of bolts.step(dt, { solids: null, bodies: flying ? (up ? both : alone) : up ? patrolOnly : NONE })) {
        // the seismic charge goes off where it is at its fuse (or on the patrol, if it runs into it): the patrol hit within the ring
        if (e.bolt.tag === 'seismic') {
          const p = e.at ?? e.bolt.pos;
          if (up && patrol.mode !== 'down' && Math.hypot(at.x - p[0], (at.y - p[1]) * 0.5, at.z - p[2]) <= U.ring) land(e.bolt.damage);
          say({ type: 'hit', at: p });
          continue;
        }
        if (e.type === 'hit' || e.type === 'solid') say({ type: 'hit', at: e.at });
        // Walt's crystal goes off where it ends: the patrol hit by how near it is
        if (e.bolt.tag === 'crystal' && up && patrol.mode !== 'down') {
          const p = e.at ?? e.bolt.pos;
          const punch = powers.blast({ x: p[0], y: p[1], z: p[2] }, at);
          if (punch > 0) land(punch);
          if (e.type === 'gone') say({ type: 'hit', at: p });
        }
        if (e.type !== 'hit') continue;
        if (e.body.ref === 'patrol') {
          if (e.bolt.tag !== 'crystal') land(e.bolt.damage);
        } else if (e.body.ref === 'cruiser' && !grounded(now) && !m.ghost) {
          shield = Math.max(0, shield - e.bolt.damage * (stats?.armorGame ?? 1));
          hitAt = now;
          say({ type: 'hurt' });
          if (shield <= 0) {
            groundedUntil = now + FIGHT.down;
            patrol = calm(patrol);
            say({ type: 'grounded' });
          }
        }
      }
      // the deflectors back, once out of trouble a while
      if (shield < FIGHT.shield && now - hitAt > (stats?.delay ?? FIGHT.delay)) shield = Math.min(FIGHT.shield, shield + dt * FIGHT.regen * (stats?.regen ?? 1));
      return out;
    },
    live: () => bolts.live(),
    clear() {
      bolts.clear();
      arcs = [];
    },
  };
}
