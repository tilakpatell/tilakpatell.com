// Morty's shots, as bolts (lib/combat/bolt.js, the one step every blaster
// on the site flies by): Total Rickall's and a duel's. A shot leaves his
// hand for where it's aimed and is decided when it gets there, so the
// furniture or the arena's walls in the way stop it (./roomSolids.js), and
// someone who's stepped out of the line isn't hit. Pure: plain arrays, no
// React, no three.js (./rmBoltsView.js draws them).
//
//   createShots({ pool }) → { rickall({ m, sight, aim, game, solids, cone, bodies }),
//     duel({ m, at }), step(dt, { solids, bodies }) → events, live(), clear() }
//   rickallBodies(game, hide) → the crowd's cylinders as bodies (side 'them')
//
// A bolt's `tag` says whose ('rickall' or 'duel'); a hit's `body.ref` is
// the person in Total Rickall's game, or 'duel' for a duel's hunter.

import { aimPoint, assist, rayCapsule, snapped } from '../../../lib/combat/aim';
import { BOLT_SPEED, createBolts } from '../../../lib/combat/bolt';
import { AIM, aimR } from './interiors/rickall';
import { SHOT } from './dimensions/duel';

// (and what stops them: RmWorld loads this with Total Rickall's rules, when it's first wanted)
export { roomSolids } from './roomSolids';

// the portal-green zap of Rick's gun, and how high Morty holds it
const ZAP = { colour: '#9dff4a', hand: 1.15, ahead: 0.35, side: 0.25 };

// a person in the crowd as rickall.js's crosshair has them: an upright
// cylinder, aimR round, from the floor to the top of their head
const cylinder = (p) => {
  const r = aimR(p);
  return { id: p.id, a: [p.x, Math.min(r, p.h / 2), p.z], b: [p.x, Math.max(p.h - r, p.h / 2), p.z], r, side: 'them', ref: p };
};

export function rickallBodies(game, hide = []) {
  if (!game || game.state !== 'on') return [];
  return game.people.filter((p) => !game.shot.includes(p.id) && !hide.includes(p.id)).map(cylinder);
}

const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
// his gun hand: a little ahead of him and to the right of `f` (flat, unit)
const hand = (m, f) => [m.x + f[0] * ZAP.ahead - f[1] * ZAP.side, (m.y ?? 0) + ZAP.hand, m.z + f[1] * ZAP.ahead + f[0] * ZAP.side];

export function createShots({ pool = 16 } = {}) {
  const bolts = createBolts({ pool });
  const send = (from, to, range, tag) => {
    const d = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
    return bolts.fire({ from, dir: unit(d), speed: BOLT_SPEED, range: Math.max(range, Math.hypot(d[0], d[1], d[2]) + 1), owner: 'morty', side: 'you', colour: ZAP.colour, tag });
  };
  return {
    // Total Rickall: at whoever's in the sights (rickall.js's aimAt), where
    // the line meets them (or, for someone small it passes over, their
    // head); with nobody in them, down the line to the first thing it meets,
    // bent within the input's `cone` (aim.js's: a touch tap snaps onto
    // someone just off the line) toward `bodies` (rickallBodies)
    rickall({ m, sight: s, aim = null, game, solids = null, cone = null, bodies = null }) {
      const o = [s.x, s.y, s.z];
      const d = unit([s.dx, s.dy, s.dz]);
      const flat = unit([s.dx, 0, s.dz]);
      let to = null;
      const p = aim && game.people.find((q) => q.id === aim);
      if (p) {
        const c = cylinder(p);
        const t = rayCapsule(o, d, c.a, c.b, c.r);
        to = t != null ? [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t] : [p.x, p.h * 0.8, p.z];
      } else {
        const crowd = bodies ?? rickallBodies(game);
        const bent = cone ? assist(d, o, crowd, snapped(cone)) : d;
        to = aimPoint({ from: o, dir: bent }, solids, crowd, { min: 0.5, max: AIM.reach }).at;
      }
      return send(hand(m, [flat[0], flat[2]]), to, AIM.reach, 'rickall');
    },
    // a duel: at the hunter in the cone (npc.js's fire: his middle), or
    // along Morty's facing, as far as a shot carries
    duel({ m, at = null }) {
      const f = [Math.cos(m.face), -Math.sin(m.face)];
      const from = hand(m, f);
      const to = at ? [at.x, at.y, at.z] : [from[0] + f[0] * SHOT.range, from[1], from[2] + f[1] * SHOT.range];
      return send(from, to, SHOT.range, 'duel');
    },
    step: (dt, world) => bolts.step(dt, { solids: world.solids, bodies: world.bodies ?? [], blades: [] }),
    live: () => bolts.live(),
    clear: () => bolts.clear(),
  };
}
