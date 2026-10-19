// The cruiser's powers over the C-137 street: the universe's rules for them
// (shipPowers.js's cards, cooldowns, charge, the pair carried and the skill
// tree's effects, through its flying face), played at the street's size by
// its fight (./streetFight.js). The maps' player (powers.js) needs a map's
// own scene, so the street says what each power does here:
//
//   portal      out on the patrol's tail, facing its way (or a hop ahead)
//   wubba       the death ray: a stream of bolts straight ahead
//   focus       the patrol's clock slowed (its fire), the guns turned onto it all round
//   salvo       four homing torpedoes, one after another
//   odds        nothing hits you
//   quad        Chewie on the quad guns, at the patrol while it's near
//   magnets     the patrol dazed: it can't fire
//   heisenberg  a crystal thrown ahead, to go off where it lands (blast())
//
//   createStreetPowers({ rand, charge }) → {   (`charge`: the big one's, kept, 0–1)
//     setCrew(pair, fx)   the pair carried (picksFor's) and the skill tree's effects
//     press(slot, { now, cruiser, at }) → { ok, id, why, portal? }
//     step(dt, { now, cruiser, at, flying }) → the shots it fires: [{ from, dir,
//       speed, range, damage, colour, tag, homing }]
//     hit(), kill()       what charges the big one
//     blast(from, at)     a crystal's punch at the patrol, from where it went off
//     mods() → { ghost, slow, daze, assist }   what's on does to the fight
//     view()              the HUD tiles' (shipPowers.js's view)
//   }
// (now in seconds; `cruiser` and `at` (the patrol) { x, y, z, yaw })

import { POWERS, blastPunch, createPowers, gainPower, picksFor, powerOn, powersView, pressPower, retunePowers, stepPowers } from '../../universe/shared/flying';

const CREW = 'cruiser';
const OWN = picksFor(CREW, null, null);
const NONE = [];
const COLOUR = { wubba: '#9dff4a', salvo: '#ff9a4a', quad: '#ff5a50', crystal: '#7fd9ff' };
const BEAM = 200; // m/s: the ray's bolts, fast enough to read as one beam

const unit = (x, y, z) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const muzzle = (c) => [c.x + Math.sin(c.yaw) * 2, c.y, c.z + Math.cos(c.yaw) * 2];

export function createStreetPowers({ rand = Math.random, charge = 0 } = {}) {
  const st = createPowers(CREW, { charge });
  let sig = null;
  let big = 1;
  const run = { queue: [], beamNext: 0, quadNext: 0 };
  const m = { ghost: false, slow: 1, daze: false, assist: false };
  // (a shot from the cruiser: along its nose, or onto the patrol)
  const aim = (c, at) => (at ? unit(at.x - c.x, at.y - c.y, at.z - c.z) : [Math.sin(c.yaw), 0, Math.cos(c.yaw)]);

  return {
    setCrew(pair, fx) {
      const key = JSON.stringify([pair ?? null, fx ?? null]);
      if (key === sig) return;
      sig = key;
      big = Number.isFinite(fx?.bigPunch) && fx.bigPunch > 0 ? fx.bigPunch : 1;
      if (retunePowers(st, { fx, picks: pair ?? OWN }).cut) run.queue.length = 0;
    },

    press(slot, { now, cruiser: c, at = null }) {
      const id = st[slot]?.id;
      const r = pressPower(st, slot);
      if (!r.ok) return r;
      if (id === 'portal') {
        const P = POWERS.portal;
        if (at && apart(c, at) <= P.range) return { ...r, portal: { x: at.x - Math.sin(at.yaw) * P.behind, y: at.y, z: at.z - Math.cos(at.yaw) * P.behind, yaw: at.yaw } };
        return { ...r, portal: { x: c.x + Math.sin(c.yaw) * P.hop, y: c.y, z: c.z + Math.cos(c.yaw) * P.hop, yaw: c.yaw } };
      }
      if (id === 'salvo') for (let i = 0; i < POWERS.salvo.count; i++) run.queue.push({ at: now + i * POWERS.salvo.every, kind: 'torp' });
      if (id === 'heisenberg') run.queue.push({ at: now, kind: 'crystal' });
      if (id === 'wubba') run.beamNext = now;
      if (id === 'quad') run.quadNext = now;
      return r;
    },

    step(dt, { now, cruiser: c, at = null, flying = true }) {
      stepPowers(st, dt, { flying });
      let out = NONE;
      const fire = (s) => (out === NONE ? (out = [s]) : out.push(s));
      // the death ray: a bolt a tick, straight ahead, while it's on
      if (powerOn(st, 'wubba')) {
        const P = POWERS.wubba;
        while (run.beamNext <= now) {
          fire({ from: muzzle(c), dir: [Math.sin(c.yaw), 0, Math.cos(c.yaw)], speed: BEAM, range: P.length, damage: P.punch * big, colour: COLOUR.wubba, tag: 'beam', homing: 0 });
          run.beamNext += P.tick;
        }
      }
      // Chewie, at the patrol while it's near
      if (powerOn(st, 'quad')) {
        const P = POWERS.quad;
        while (run.quadNext <= now) {
          if (at && apart(c, at) <= P.range && rand() < P.chance) fire({ from: muzzle(c), dir: aim(c, at), speed: P.speed, range: P.range, damage: P.punch * big, colour: COLOUR.quad, tag: 'quad', homing: 0 });
          run.quadNext += P.every;
        }
      }
      // the torpedoes and the crystal, each at its moment
      for (let i = run.queue.length - 1; i >= 0; i--) {
        const q = run.queue[i];
        if (q.at > now) continue;
        run.queue.splice(i, 1);
        if (q.kind === 'torp') {
          const P = POWERS.salvo;
          fire({ from: muzzle(c), dir: aim(c, at), speed: P.speed, range: P.speed * P.life, damage: P.punch * big, colour: COLOUR.salvo, tag: 'heavy', homing: P.turn });
        } else {
          const P = POWERS.heisenberg;
          fire({ from: muzzle(c), dir: [Math.sin(c.yaw), 0, Math.cos(c.yaw)], speed: P.speed, range: P.speed * P.fuse, damage: 0, colour: COLOUR.crystal, tag: 'crystal', homing: 0 });
        }
      }
      return out;
    },

    hit() {
      gainPower(st, 'hit', 1, 'patrol');
    },
    kill() {
      gainPower(st, 'kill');
    },
    blast(from, at) {
      return at ? blastPunch(apart(from, at), POWERS.heisenberg) * big : 0;
    },
    mods() {
      m.ghost = powerOn(st, 'odds') || powerOn(st, 'portal');
      m.slow = powerOn(st, 'focus') ? POWERS.focus.slow : 1;
      m.daze = powerOn(st, 'magnets');
      m.assist = powerOn(st, 'focus');
      return m;
    },
    view: () => powersView(st),
  };
}
