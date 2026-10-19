// The keep-outs: spheres round the hand-made places, so the generator, which
// fills every sector (the core too), leaves them clear. Pure (no three.js),
// so it runs in Node.
//
// HOME_KEEP: the radius kept clear round the origin
// KEEP_OUTS: [{ id, at, r }], home first, then the places, then the Rick and Morty pocket
//   (ids can repeat: PLACES has a planet 'home' and a planet 'rickmorty' beside the home sphere and the
//   pocket, so key rows by index, or by id plus `at`, never by id alone)
// keepOutsNear(sx, sy, sz) → the KEEP_OUTS rows whose sphere meets that sector's cube
// clearOfKeepOuts(at, extent, outs = KEEP_OUTS) → true when a body of that extent at `at` touches none

import { SECTOR, sectorCentre } from '../../../lib/space/address.js';
import { PLACES, SECTORS, SECTOR_RADIUS, sectorOf } from '../../universe/shared/space';

export const HOME_KEEP = 8000;

// A place keeps three of its own reaches clear; a station rides with its
// planet, and what sits inside the pocket is covered by the pocket's sphere.
const PLACE_KEEP = 3;
const POCKET_MARGIN = 4000;

export const KEEP_OUTS = [
  { id: 'home', at: [0, 0, 0], r: HOME_KEEP },
  ...PLACES.filter((p) => p.kind !== 'station' && sectorOf(...p.at) === 'main').map((p) => ({
    id: p.id,
    at: [...p.at],
    r: PLACE_KEEP * p.reach,
  })),
  {
    id: 'rickmorty',
    at: [...SECTORS.rickmorty.origin],
    r: SECTOR_RADIUS.rickmorty + POCKET_MARGIN,
  },
];

// A sphere meets a cube when its centre is within r of the cube's nearest point.
export function keepOutsNear(sx, sy, sz) {
  const c = sectorCentre(sx, sy, sz);
  const half = SECTOR / 2;
  return KEEP_OUTS.filter((k) => {
    let d2 = 0;
    for (let i = 0; i < 3; i++) {
      const over = Math.abs(k.at[i] - c[i]) - half;
      if (over > 0) d2 += over * over;
    }
    return d2 <= k.r * k.r;
  });
}

export function clearOfKeepOuts(at, extent, outs = KEEP_OUTS) {
  for (let i = 0; i < outs.length; i++) {
    const k = outs[i];
    const dx = at[0] - k.at[0];
    const dy = at[1] - k.at[1];
    const dz = at[2] - k.at[2];
    const min = k.r + extent;
    if (dx * dx + dy * dy + dz * dz < min * min) return false;
  }
  return true;
}
