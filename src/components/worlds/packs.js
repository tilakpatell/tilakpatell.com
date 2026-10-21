// Every world's pack (its folder's pack.js): what an install downloads for it.
// Standalone, with each import's extension written out, so Node can load it
// as it is (scripts/pack-check.mjs, scripts/packs.mjs).
//
//   PACKS[to] → { id, pages, src, urls, globs }
//   packFor(pathname) → the pack of the world the address is in, or null

import { PACK as caribbean } from '../caribbean/pack.js';
import { PACK as invincible } from '../invincible/pack.js';
import { PACK as hogwarts } from '../hogwarts/pack.js';
import { PACK as cybertron } from '../cybertron/pack.js';
import { PACK as avengers } from '../avengers/pack.js';
import { PACK as c137 } from '../rickmorty/pack.js';
import { PACK as albuquerque } from '../albuquerque/pack.js';
import { PACK as scranton } from '../office/pack.js';
import { PACK as galaxy } from '../galaxy/pack.js';
import { PACK as deathstar } from '../deathstar/pack.js';
import { PACK as deathstarInside } from '../deathstar/inside/pack.js';
import { PACK as middleEarth } from '../middleearth/pack.js';
import { PACK as road } from '../middleearth/road/pack.js';
import { PACK as music } from '../music/pack.js';
import { PACK as dotMatrix } from '../dotmatrix/pack.js';
import { PACK as mario64 } from '../mario64/pack.js';
import { PACK as earth } from '../earth/pack.js';
import { PACK as minecraft } from '../minecraft/pack.js';
import { PACK as fly } from '../expanse/flight/pack.js'; // planet flight (scripts/flight-island.mjs removes this row)

export const PACKS = Object.fromEntries(
  [
    ...[caribbean, invincible, hogwarts, cybertron, avengers, c137, albuquerque, scranton, galaxy, deathstar, deathstarInside, middleEarth, road, music, dotMatrix, mario64, earth, minecraft],
    fly, // planet flight
  ].map((p) => [p.id, p]),
);

// The longest match wins, as worlds.js's worldAt: '/dot-matrix/64' is its own
// world, not Dot Matrix's.
export const packFor = (pathname) =>
  Object.values(PACKS)
    .filter((p) => pathname === p.id || pathname.startsWith(`${p.id}/`))
    .reduce((best, p) => (best && best.id.length >= p.id.length ? best : p), null);
