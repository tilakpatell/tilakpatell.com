// Where a pilot is, for the roster: off the universe map, the place's own
// name (where.js's placeName); on it, the region they were last seen in
// (regions.js), so a universe spread this wide still says roughly where:
// “Universe · Near Middle-earth”, “Universe · the void”. A module of its
// own, not where.js, which the site's shell loads on every page: this one
// pulls in the map's layout, and only the roster (loaded once you're
// online) needs it. Out in the Expanse (a pose with a sector), the sector
// and the nearest system in it: “Universe · E:3,-2 · Kepler”.

import { regionAt } from '../regions';
import { SECTORS, inExpanse, mapSectorOf } from '../layout';
import { fullSector } from '../../expanse/gen/space';
import { UNIVERSE as SHARED } from '../../expanse/gen/seed';
import { parseSectorKey } from '../../../lib/space/address';
import { UNIVERSE, placeName } from './where';

// (mid-sentence, a leading “The” goes small: “the home system”)
const small = (name) => name.replace(/^The /, 'the ');

// the roster's words for `where` (a page key), with the pilot's last pose
// ({ x, y, z }, or null) to say whereabouts on the map
export function rosterWhere(where, pose) {
  if (where !== UNIVERSE || !pose) return placeName(where);
  const { x, y, z } = pose;
  if (inExpanse(pose.sec)) return `Universe · ${pose.sec}${nearest(pose.sec, x, y, z)}`;
  // (the Rick and Morty sector is through its portal: none of the regions reach it;
  // a pose without a sector is the authored map's, wherever it says)
  const sector = mapSectorOf(x, y, z);
  const area = sector !== 'main' ? SECTORS[sector].name : (regionAt(x, y, z)?.name ?? 'the void');
  return `Universe · ${small(area)}`;
}

// ' · <name>' of the system in the sector nearest (x, y, z), within NEAR of it
const NEAR = 12000;
const SEEN = new Map(); // sector id → its systems (the last few)
function nearest(id, x, y, z) {
  let systems = SEEN.get(id);
  if (!systems) {
    const at = parseSectorKey(id);
    if (!at) return ''; // (a key inExpanse took that doesn't parse: no sector, no system)
    systems = fullSector(SHARED, ...at, { things: false }).systems;
    if (SEEN.size > 16) SEEN.clear();
    SEEN.set(id, systems);
  }
  let best = null;
  let d = NEAR;
  for (const s of systems) {
    const k = Math.hypot(s.at[0] - x, s.at[1] - y, s.at[2] - z);
    if (k < d) [best, d] = [s, k];
  }
  return best ? ` · ${best.name}` : '';
}
