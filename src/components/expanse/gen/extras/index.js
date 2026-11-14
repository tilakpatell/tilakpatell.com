// The sector's whole-sector lists, lane 4a's: everything between the
// systems (low ids, w3 to w63) and round them (high ids, w20000 and up), in
// the order they are made, each list told the lists before it. things.js
// imports none of them, so every list can import its constants with no cycle.
//
// SECTOR_EXTRAS: [{ list, base, max, make(ctx, made) → rows }] (things.js's thingsOf says the rules)
//   remnant  w10–w11   supernova remnants, 1–2 a sector (clouds.js)
//   storm    w18–w21   ion storms on loops, 2–4 (clouds.js)
//   pocket   w22–w27   nebula pockets, 2–6 (clouds.js)
//   swarm    w28–w36   a swarm in each pocket and legacy nebula, 9 at most (clouds.js)
//   herd     w37–w39   leviathan herds on loops, 1–3 (clouds.js)
//   debris   w40–w45   battle debris, 2–6 (clouds.js)
//   (none of the low lists in the core)
//   field    w20000 +  asteroid and ice fields, one system in three (systems.js)
//   comet    w30000 +  comets, one system in four (systems.js)
//   rig      w40000 +  mining rigs, one field in three (systems.js)
//   fleet    w50000 +  fleets at anchor over a station's pole, one station in two (anchored.js)
//   shipyard w60000 +  shipyards over the star's other pole, one station in four (anchored.js)
// NEBULA_SHOW (place.js)

import { FLEETS, YARDS } from './anchored';
import { DEBRIS, HERDS, POCKETS, REMNANTS, STORMS, SWARMS } from './clouds';
import { COMETS, FIELDS, RIGS } from './systems';

export { NEBULA_SHOW } from './place';

export const SECTOR_EXTRAS = [FIELDS, COMETS, RIGS, FLEETS, YARDS, REMNANTS, POCKETS, SWARMS, STORMS, HERDS, DEBRIS];
