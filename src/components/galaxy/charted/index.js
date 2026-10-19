// The charted worlds: the systems the films and the shows visit or name
// that have no ground to land on yet, in systems.js's shape and joined to
// its SYSTEMS, so they fly, light the sky and take a course like any other.
// The Republic's last days (republic.js), the Empire's years (empire.js)
// and the New Republic's (newRepublic.js); their planets are looks.js's.
//
// Each sits in the grid square the atlas gives it, or as near as the map's
// regions allow (`grid` null where it can't: the comment beside it says
// why). `charted: true` marks them for the galaxy map, which draws them
// smaller and names them only where a name has room (labelPlace.js's
// `optional`): there are twice as many systems as before, and the south
// is crowded. None of them is in the war (gcwRules.js: no `war` row).
//
// CHARTED_LIFT: how far above or below the galaxy's plane each sits, in grid
// squares, picked with systems.js's LIFT so that from every system no two
// others' stars are closer than about two and a third degrees in its sky
// (systems.test.js).

import { REPUBLIC } from './republic.js'; // (with its extension: the prerender reads systems.js in Node)
import { EMPIRE } from './empire.js';
import { NEW_REPUBLIC } from './newRepublic.js';

export const CHARTED = [...REPUBLIC, ...EMPIRE, ...NEW_REPUBLIC].map((s) => ({ ...s, charted: true }));

export const CHARTED_LIFT = {
  utapau: -0.64,
  mygeeto: -0.1,
  saleucami: 0.85,
  catoneimoidia: -0.11,
  polismassa: 0.31,
  malastare: 0.98,
  jedha: 0.19,
  eadu: -0.98,
  lahmu: -0.76,
  wobani: -0.21,
  kafrene: -0.2,
  dantooine: -0.06,
  ordmantell: 0.58,
  corellia: -0.35,
  tython: 0.66,
  arvala: -0.12,
  trask: -0.94,
  corvus: 0.55,
  morak: 0.98,
  plazir: 0.28,
  seatos: 0.14,
};
