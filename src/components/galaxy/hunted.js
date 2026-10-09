// Who comes after you in the galaxy, by the system's `faction`
// (systems.js): the Empire as on the universe map (TIE fighters and
// interceptors, now and then Vader in his TIE Advanced), the Separatists'
// droid starfighters over the Clone Wars' worlds (vulture droids, with a
// tri-fighter or two, which take more stopping), and the Imperial remnant's
// TIEs over the New Republic's (Moff Gideon's fighters and interceptors, with
// no Vader to lead them); and the universe map's Star Wars outlaws, which
// roamRules.js hands the director: what a Star Destroyer launches (`navy`),
// the bounty hunters (Fett in Slave I, IG-88, Bossk, Dengar) and the Weequay
// pirates. And, since the galaxy's wars (warEffects.js: who holds a system
// is who comes for you there), the other sides' pilots too: the Rebellion's
// (X-wings, A-wings, a Y-wing, and Wedge Antilles leading them, with the TIE
// Advanced's numbers), the New Republic's, the Republic's clones in their
// ARC-170s with a Jedi among them, and what a Mon Calamari cruiser or a
// Venator launches (`rebelnavy`, `republicnavy`). universe/hunters.js flies
// them all; this is who they are, how they fly and what they're called on
// the targeting bracket.

import { FACTIONS as HOME, HUNTER_KINDS, NAMES as HOME_NAMES } from '../universe/hunterRules';
import { pacedAll } from '../universe/ship';
import { lookOf } from './roster';

export const FACTIONS = {
  empire: HOME.empire,
  separatists: { family: 'starwars', kinds: [['vulture', 4], ['trifighter', 1]], laser: lookOf('separatists').laser, size: [3, 5] },
  remnant: { family: 'starwars', kinds: [['tie', 2], ['interceptor', 2]], laser: lookOf('remnant').laser, size: [2, 4] },
  rebellion: { family: 'starwars', kinds: [['xwing', 3], ['awing', 2], ['ywing', 1]], ace: 'redleader', laser: lookOf('rebel').laser, size: [3, 5] },
  rebelnavy: { family: 'starwars', kinds: [['xwing', 2], ['ywing', 1]], laser: lookOf('rebel').laser, size: [3, 4] },
  newrepublic: { family: 'starwars', kinds: [['xwing', 3], ['awing', 2]], ace: 'redleader', laser: lookOf('newrepublic').laser, size: [2, 4] },
  republic: { family: 'starwars', kinds: [['arc170', 3], ['delta7', 1]], laser: lookOf('republic').laser, size: [3, 5] },
  republicnavy: { family: 'starwars', kinds: [['arc170', 3]], laser: lookOf('republic').laser, size: [3, 4] },
  navy: HOME.navy,
  fett: HOME.fett,
  ig88: HOME.ig88,
  bossk: HOME.bossk,
  dengar: HOME.dengar,
  weequay: HOME.weequay,
};

export const KINDS = {
  ...HUNTER_KINDS,
  // (at the ship's pace, as the universe map's are: ship.js's PACE)
  ...pacedAll({
    vulture: { size: 0.28, speed: 20, accel: 19, hp: 1, fire: [0.7, 1.4] },
    trifighter: { size: 0.32, speed: 25, accel: 22, hp: 3, fire: [0.5, 0.95], tail: 0.3 },
    xwing: { size: 0.36, speed: 21, accel: 18, hp: 3, fire: [0.8, 1.5] },
    awing: { size: 0.3, speed: 26, accel: 23, hp: 2, fire: [0.6, 1.1], tail: 0.3 },
    arc170: { size: 0.46, speed: 19, accel: 16, hp: 4, fire: [0.7, 1.3] },
    delta7: { size: 0.3, speed: 26, accel: 23, hp: 3, fire: [0.5, 0.9], tail: 0.35 },
  }),
  ywing: { ...HUNTER_KINDS.tiebomber, size: 0.42 },
  redleader: { ...HUNTER_KINDS.tieadvanced, size: 0.36 }, // (Wedge, with the TIE Advanced's numbers)
};

export const NAMES = { ...HOME_NAMES, vulture: 'Vulture droid', trifighter: 'Droid tri-fighter', xwing: 'X-wing', awing: 'A-wing', ywing: 'Y-wing', arc170: 'ARC-170', delta7: 'Jedi starfighter', redleader: 'Wedge Antilles' };

// the hunters each faction's built ones are made of (made ahead, so a pack
// arriving doesn't stall a frame)
export const AHEAD = { empire: { tie: 3, tieadvanced: 1, tiebomber: 1 }, separatists: { vulture: 4, trifighter: 1 }, remnant: { tie: 2, interceptor: 2, tiebomber: 1 }, rebellion: { xwing: 3, awing: 2, ywing: 1 }, newrepublic: { xwing: 3, awing: 2 } };
