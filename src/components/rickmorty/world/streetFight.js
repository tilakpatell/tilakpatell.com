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
// shields do. Pure: plain arrays, no React, no three.js.
//
//   FIGHT                          its numbers
//   createStreetFight({ loadout, fx, rand }) → {
//     patrol, shield, groundedUntil, armory,
//     fire(now, cruiser, at, cadence?) → boolean   (`at`: the patrol's place, or null)
//     pick(i), cycle(dir), refit(loadout, fx), view() → the HUD kit's ArmsView,
//     ring() → { angle } while the patrol fights (ship.js's stepFedShip), else null,
//     grounded(now), step(dt, now, { cruiser, at, flying, stats }) → events, live(), clear() }
//   events: { type: 'hit', at } (a flash) | 'provoked' | 'down' | 'hurt' | 'grounded' | 'back'
// (now in seconds; `cruiser` { x, y, z, yaw })

import { createBolts } from '../../../lib/combat/bolt';
import { armsView, createArmory, fan, steer } from '../../universe/shared/flying';
import { PATROL, calm, hitPatrol, newPatrol, patrolShot, stepPatrol } from './patrolRules';

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
};

const NONE = [];
const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

export function createStreetFight({ loadout, fx = null, rand = Math.random } = {}) {
  const armory = createArmory('cruiser', loadout, fx ?? undefined);
  const bolts = createBolts({ pool: 16 });
  let patrol = newPatrol();
  let shield = FIGHT.shield;
  let hitAt = -Infinity;
  let groundedUntil = -Infinity;
  let angle = 0;
  const ringArg = { angle: 0 };
  const armsOut = { name: '', line: 'primary', index: 0, ammo: 0, max: 0, filling: 0 };
  // (the two bodies a bolt can meet, moved each step)
  const patrolBody = { id: 'patrol', a: [0, 0, 0], b: [0, 0, 0], r: FIGHT.body.patrol, side: 'them', ref: 'patrol' };
  const cruiserBody = { id: 'cruiser', a: [0, 0, 0], b: [0, 0, 0], r: FIGHT.body.cruiser, side: 'you', ref: 'cruiser' };
  const both = [patrolBody, cruiserBody];
  const alone = [cruiserBody];
  const jitter = () => rand() * 2 - 1;
  const grounded = (now) => now < groundedUntil;

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
        if (d < FIGHT.reach && off < FIGHT.turn) dir = unit(to[0], to[1], to[2]);
      }
      const speed = FIGHT.bolt * w.speed;
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
      // the patrol's laser, while it's fighting and you're up there
      if (up && flying && !grounded(now)) {
        const r = patrolShot(patrol, at, c, now, rand);
        patrol = r.patrol;
        if (r.shot) {
          const L = PATROL.laser;
          const b = bolts.fire({ from: r.shot.from, dir: r.shot.dir, speed: L.speed, range: L.speed * L.life, owner: 'patrol', side: 'them', damage: L.damage, colour: FIGHT.foe, tag: 'laser' });
          b.homing = 0;
        }
      }
      // the heavy rounds come round onto it
      if (up) {
        for (const b of bolts.live()) {
          if (b.tag !== 'heavy' || !b.homing) continue;
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
      for (const e of bolts.step(dt, { solids: null, bodies: up ? both : alone })) {
        if (e.type === 'hit' || e.type === 'solid') say({ type: 'hit', at: e.at });
        if (e.type !== 'hit') continue;
        if (e.body.ref === 'patrol') {
          const was = patrol.mode;
          const r = hitPatrol(patrol, e.bolt.damage, now);
          patrol = r.patrol;
          if (r.down) say({ type: 'down' });
          else if (was === 'calm' && patrol.mode === 'fight') say({ type: 'provoked' });
        } else if (e.body.ref === 'cruiser' && !grounded(now)) {
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
    },
  };
}
