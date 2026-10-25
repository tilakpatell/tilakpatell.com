// The Rick and Morty sector's big planets, as worlds on the galaxy's surface
// engine (galaxy/surface/): one raw site each (./sites/<id>.js, data on the
// galaxy's site shape), made whole by its siteFrom and named as the
// universe map names it. pages/RmPlanet.jsx opens ./RmSurface.jsx for these
// and C-137's RmWorld for the rest (destinations.js's BIG, which the test
// holds to this book).

import { siteFrom } from '../../galaxy/surface/sites';
import { byId } from '../../universe/universes';
import { SITE as gazorpazorp } from './sites/gazorpazorp';
import { LINES } from './lines';

export const PLANET_SITES = { gazorpazorp };

// the show's portal green: the planets' accent on the compass and the HUD
export const ACCENT = '#8dff5a';

export const isBigPlanet = (id) => Object.hasOwn(PLANET_SITES, id);

// a planet's places that are achievements once found ({ planet: { place:
// achievement } }: Gazorpazorp's gate was C-137's, before the surface took
// the planet over), and the ones `found` has earned
export const PLANET_ACHIEVE = { gazorpazorp: { gate: 'gazorp' } };
export const planetAchievements = (id, found) => found.map((p) => PLANET_ACHIEVE[id]?.[p]).filter(Boolean);

export function planetSite(id) {
  if (!isBigPlanet(id)) return null;
  const raw = PLANET_SITES[id];
  // (Rick and Morty climbing out say the planet's landing lines, ./lines.js, unless the site has its own)
  const out = raw.lines?.out ?? LINES[id]?.landing;
  return siteFrom(out ? { ...raw, lines: { ...raw.lines, out } } : raw, id, { name: byId(id)?.label ?? id, accent: ACCENT });
}

// a planet's mission (the galaxy's mission shape: missions/index.js), by id;
// none until the planet's own phase writes it
const MISSIONS = {};
export const planetMission = (id) => MISSIONS[id] ?? null;
