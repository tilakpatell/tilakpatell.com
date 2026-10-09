// What holding a system means: who the galaxy's war says holds it (gcw.js's
// warTable, the war you fight in) against the side you swore to
// (allegiance.js's current), turned into what meets you there. Pure,
// tested; scene.js works it out on entering a system and at each step of the
// war, and hands it to the director (roamRules.js's galaxySide), the world
// (world.js's setEffects: the fleets in orbit) and the HUD. The design:
// docs/superpowers/specs/2026-10-07-gcw-allegiance-design.md, section 3 and
// revision 3a.
//
// effectsFor(sysId, table, current) → effects | null (a system out of the war):
// {
//   owner,      // the side that holds it (the Hutts', too)
//   yours,      // the owner is your side
//   hostile,    // unsworn: false; else not yours (the Hutts are nobody's friend)
//   garrison,   // roamRules.js's ROLES id: who comes for you here
//   droids,     // a Separatist world that isn't the Separatists', in the Clone Wars: their leftovers, always hostile
//   hunt,       // the director may send a hunt
//   escort,     // your side's wing comes to meet you
//   capital,    // what the director can drop in, or null
//   traffic,    // what flies by: the owner's, and the system's civil kinds
//   fleet,      // whose ships park at the planet
//   heat,       // added to the director's heat: a front 1, an attack 2
//   troops,     // the trooper kind on the ground (surface/hostiles.js)
//   deserter,   // you turned your coat from this owner this campaign
//   war,        // the war it's in (the one you fight in: what flies here is that war's)
// }
// piecesShown(sys, effects) → [boolean] by sys.pieces: a fleet piece only for
// its holder, a standing battle only while the system's fought over;
// garrisonFleet(sys, effects) → [{ kind, size, at, yaw }]: two of the
// holder's ships in orbit where the system has no fleet of theirs.

import { SIZE, obstacles } from './battles';
import { DEFAULT_WAR, otherSide } from './sides';
import { systemById } from './systems';

// each side's: who hunts for it (roamRules.js), what it drops in, flies,
// fields on the ground, and parks in orbit
export const OWNERS = {
  rebel: { garrison: 'rebellion', capital: 'moncal', traffic: ['xwing', 'ywing', 'transport', 'shuttle'], troops: 'rebel', escorts: ['corvette', 'nebulon'] },
  empire: { garrison: 'empire', capital: 'destroyer', traffic: ['tie', 'shuttle', 'gozanti'], troops: 'stormtrooper', escorts: ['lightcruiser', 'gozanti'] },
  republic: { garrison: 'republic', capital: 'venator', traffic: ['arc170', 'acclamator', 'corvette'], troops: 'clone', escorts: ['acclamator', 'corvette'] },
  separatists: { garrison: 'separatists', capital: null, traffic: ['vulture', 'munificent'], troops: 'battledroid', escorts: ['munificent', 'munificent'] },
  newrepublic: { garrison: 'newrepublic', capital: 'moncal', traffic: ['xwing', 'awing', 'shuttle'], troops: 'rebel', escorts: ['nebulon', 'corvette'] },
  remnant: { garrison: 'remnant', capital: 'destroyer', traffic: ['tie', 'gozanti'], troops: 'stormtrooper', escorts: ['lightcruiser', 'gozanti'] },
  hutt: { garrison: 'hutt', capital: null, traffic: ['freighter', 'skiff', 'gozanti'], troops: 'mercenary', escorts: ['gozanti', 'corvette'] },
};
// the kinds a system's own traffic list may name that are warships (the
// owner's fly by in their place)
const WARSHIPS = new Set(['tie', 'interceptor', 'tiebomber', 'tieadvanced', 'xwing', 'ywing', 'awing', 'bwing', 'uwing', 'arc170', 'delta7', 'vulture', 'trifighter', 'n1', 'venator', 'acclamator', 'munificent', 'providence', 'lucrehulk', 'destroyer', 'lightcruiser', 'gozanti', 'corvette', 'nebulon', 'moncal']);

export function effectsFor(sysId, table, current) {
  const row = table?.systems?.find((r) => r.id === sysId);
  const sys = systemById(sysId);
  if (!row || !sys) return null;
  const owner = row.owner;
  const o = OWNERS[owner];
  const side = current?.side ?? null;
  const yours = side !== null && owner === side;
  const hostile = side !== null && !yours;
  const deserter = Boolean(current?.turncoat) && side !== null && owner === otherSide(side);
  // the shows' worlds the Empire holds keep Gideon's TIEs
  const garrison = owner === 'empire' && sys.faction === 'remnant' ? 'remnant' : o.garrison;
  const civil = (sys.traffic ?? []).filter((k) => !WARSHIPS.has(k));
  const war = current?.war ?? DEFAULT_WAR;
  return {
    owner,
    yours,
    hostile,
    garrison,
    // (the droids' leftovers only while there are droids: the Clone Wars)
    droids: war === 'clone' && sys.faction === 'separatists' && owner !== 'separatists',
    hunt: (hostile && owner !== 'hutt') || deserter,
    escort: yours,
    capital: o.capital,
    traffic: [...new Set([...o.traffic, ...civil])],
    fleet: owner,
    heat: row.attack ? 2 : row.front ? 1 : 0,
    troops: o.troops,
    deserter,
    war,
  };
}

// a fleet piece's side as systems.js names it, as the war does
const pieceSide = (p) => (p.side === 'separatist' ? 'separatists' : p.side);

export function piecesShown(sys, effects) {
  return sys.pieces.map((p) => {
    if (!effects) return true;
    if (p.type === 'fleet') return pieceSide(p) === effects.fleet;
    if (p.type === 'battle') return effects.heat > 0;
    return true;
  });
}

export function garrisonFleet(sys, effects) {
  const owner = effects?.fleet;
  if (!OWNERS[owner] || sys.pieces.some((p) => p.type === 'fleet' && pieceSide(p) === owner)) return [];
  const avoid = obstacles(sys);
  const R = sys.body?.r ?? 30;
  const sun = sys.suns[0].dir;
  const base = Math.atan2(sun[2], sun[0]);
  return OWNERS[owner].escorts.map((kind, i) => {
    const size = SIZE[kind];
    const yaw = base + (i ? -0.7 : 0.7);
    // out from the planet, a little above, till it's clear of everything
    for (let out = R + 40 + size; ; out += 20) {
      const at = [Math.cos(yaw) * out, 18 + i * 10, Math.sin(yaw) * out].map((x) => +x.toFixed(2));
      if (avoid.every((ob) => Math.hypot(at[0] - ob.c.x, at[1] - ob.c.y, at[2] - ob.c.z) - size > ob.r)) return { kind, size, at, yaw: +(yaw + Math.PI / 2).toFixed(3) };
    }
  });
}
