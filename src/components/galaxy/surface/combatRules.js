// The rules of close combat on the galaxy's worlds that aren't the
// lightsaber's, pure (tested in Node; scene.js and powers.js run them): the
// Force's push and pull, and the moment a hit holds the frame. The
// lightsaber's are the 2017 game's own, from its records
// (src/data/bf2017/saber.json, run by lib/combat/saber2017.js); its strokes
// are a hero's stroke table (gameStance.js).
//
//   STANCE_IDS           the ways a hero holds a saber ('single', 'double': a staff), which the universe's online
//                        protocol sends; the game's heroes hold one hilt or a staff
//   STANCE_NAMES         { id: name } for the deploy screen
//   FORCE                push / pull: { range, cone, force, cool, damage }
//   forceAt(me, t, kind)         whether t is in the Force's reach: { hit, k (1 close … 0 at range) }
//   pushVelocity(me, t, k)       the shove a push gives t: { vx, vz, vy }
//   hitStop(damage, killed)      seconds the frame holds on a hit (damage in the site's hit points)

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const STANCE_IDS = ['single', 'double'];
export const STANCE_NAMES = { single: 'One blade', double: 'Double blade' };
export const FORCE = {
  push: { range: 9, cone: 0.75, force: 11, lift: 3.5, cool: 9, damage: 1 },
  pull: { range: 14, cone: 0.5, force: 9, lift: 2, cool: 7, damage: 0 },
};

// (`f` is the push's own numbers where it isn't the Force's: a roar, say)
export function forceAt(me, t, kind = 'push', f = FORCE[kind]) {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz);
  if (d > f.range) return { hit: false, k: 0 };
  if (d > 1e-6 && Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)) > f.cone) return { hit: false, k: 0 };
  return { hit: true, k: 1 - (d / f.range) * 0.6 };
}

export function pushVelocity(me, t, k, kind = 'push', f = FORCE[kind]) {
  const dx = t.x - me.x;
  const dz = t.z - me.z;
  const d = Math.hypot(dx, dz) || 1e-6;
  const sign = kind === 'pull' ? -1 : 1;
  return { vx: (dx / d) * f.force * k * sign, vz: (dz / d) * f.force * k * sign, vy: f.lift * k };
}

export const hitStop = (damage, killed = false) => (killed ? 0.09 : damage >= 4 ? 0.06 : 0.04);
