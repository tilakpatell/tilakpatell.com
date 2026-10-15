// The quest activity's pure parts (./activity.js draws with them): who a
// figure on your side or a hostile aims at, what a hostile carries, when
// it is up to fire or due its Force push, how it goes down. No three.js.

import { ARMS } from '../ground/troops';

// a duellist's Force: its push falls due every `force.every` seconds while
// you're within 8 m of it (t.forceAt: when it last pushed)
export const nextForce = (t, h, dYou, time) => Boolean(h?.force) && dYou <= 8 && time - (t.forceAt ?? -99) >= (h.force.every ?? 7);
// one on your side (spec.side: 'yours') fights the nearest hostile that's
// up, never you and never its own side
export function friendlyAim(t, targets) {
  if (t.spec?.side !== 'yours') return null;
  let best = null;
  let bd = Infinity;
  for (const o of targets) {
    if (o === t || o.down || !o.hostile || o.spec?.side === 'yours') continue;
    const d = Math.hypot(o.b.x - t.b.x, o.b.z - t.b.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}
// a hostile's mark: you, or a friend of yours nearer to it than you are
// ({ x, z, victim }: the friend, or null when it's you; null with nobody)
export function hostileAim(t, you, targets) {
  let best = you ? { x: you.x, z: you.z, victim: null } : null;
  let bd = you ? Math.hypot(you.x - t.b.x, you.z - t.b.z) : Infinity;
  for (const o of targets) {
    if (o === t || o.down || o.spec?.side !== 'yours') continue;
    const d = Math.hypot(o.b.x - t.b.x, o.b.z - t.b.z);
    if (d < bd) {
      bd = d;
      best = { x: o.b.x, z: o.b.z, victim: o };
    }
  }
  return best;
}
// What a hostile carries, by kind (universe/gunplay.js's GUNS): a Tusken's
// long cycler rifle, Jango's WESTAR-34, the troopers' E-11s, the clones'
// DC-15As, the battle droids' E-5s, a Rebel's A280; a blaster pistol for
// anyone else with a gun (a spawn's own `gun` first). A duellist carries
// its saber; a brawler, a beast or a target that doesn't fight back, nothing.
export { ARMS }; // (ground/troops.js's: the one table)
export function armsOf(s) {
  const h = s?.hostile;
  if (!h) return null;
  if (h.blade) return 'saber';
  if (h.melee) return null;
  return s.gun ?? ARMS[s.kind] ?? 'blaster';
}
// how one starts when it sees you, by kind, in place of react.js's alert:
// a Tusken's cry, its rifle brandished over its head (a clip on its upper
// half, so long, the gun's own pose let go meanwhile)
export const STARTS = { tusken: { clip: 'cheer', for: 1.6 } };
// up to fire: its next shot due within half a second (and not left waiting
// long for its turn), or one just fired: what stands it out of its crouch
// and brings the gun up, ahead of the shot rather than after it
export const upToFire = (t, time) => Boolean(t.aim && t.cool < 0.5 && t.cool > -0.4) || time - (t.firedAt ?? -Infinity) < 0.9;
// going down: a fall over `fall` seconds about its feet (for one with no
// clip to fall on; a clip's own length otherwise), then lying `lie`, then
// sinking `deep` metres over `sink` and gone
export const DEATH = { fall: 0.9, lie: 2, sink: 0.6, deep: 0.35 };
// `down` seconds after it went (len: its clip's length, null for the tip)
// → { k (0…1 of the tip), sink (metres), gone }
export function fallen(down, len = null) {
  const lain = (len ?? DEATH.fall) + DEATH.lie;
  return { k: Math.min(1, down / DEATH.fall), sink: down > lain ? Math.min(1, (down - lain) / DEATH.sink) * DEATH.deep : 0, gone: down > lain + DEATH.sink };
}
