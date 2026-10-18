// Where on the site a pilot is, as the other pilots see it: a page key
// (the universe map is one place whatever's picked on it, and so are the
// roles on the experience page; each of the galaxy's star systems is a place
// of its own, so you meet the pilots in the system you're in, and so is each
// of Middle-earth's chapters, a world of its own to walk, apart from the map),
// checked when it comes in, and named for the roster ("Bree", "Hoth").

import { byPath } from '../universes';
import { GALAXY, SYSTEM_NAMES, inGalaxyFlight, systemOfPath } from '../../galaxy/names';
import { chapter } from '../../middleearth/chapters';
import { hidden } from '../../middleearth/hidden';

export const UNIVERSE = '/universe';
// a page that isn't on any map says so to no one: the other pilots see
// "somewhere else", with no way to follow
export const AWAY = '/away';
const UNLISTED = new Set(['/dickansh']);
const MIDDLE_EARTH = '/middle-earth';

export function whereOf(pathname) {
  if (pathname === '/' || pathname.startsWith('/universe')) return UNIVERSE;
  if (UNLISTED.has(pathname)) return AWAY;
  if (pathname.startsWith(MIDDLE_EARTH)) {
    const place = pathname.slice(MIDDLE_EARTH.length).split('/')[1];
    return place ? `${MIDDLE_EARTH}/${place}` : MIDDLE_EARTH;
  }
  if (pathname.startsWith('/experience')) return '/experience';
  return pathname;
}

// somewhere you fly (the universe map, or a system in the galaxy): the other
// pilots there are ships, not pointers on a page
export const isFlight = (where) => where === UNIVERSE || inGalaxyFlight(where);

// a page that draws who's online itself, in its own corner (Universe.jsx,
// Galaxy.jsx, GalaxySurface.jsx): the site leaves it to them
export const ownCorner = (where) => isFlight(where) || /^\/galaxy\/[a-z0-9-]+\/surface$/.test(where ?? '');

// a page key as it came in, or null if it isn't one
export function cleanWhere(raw) {
  if (typeof raw !== 'string' || raw.length > 64 || !/^\/[a-z0-9/-]*$/.test(raw)) return null;
  return raw;
}

const NAMES = { [AWAY]: 'somewhere else', [UNIVERSE]: 'the universe', [GALAXY]: 'a galaxy far, far away', '/deathstar': 'the Death Star', '/deathstar/inside': 'the Death Star’s corridors', '/projects': 'Projects', '/travel': 'Travel', '/resume': 'the résumé', '/c-137/citadel': 'the Citadel', '/middle-earth/road': 'the Road' };

export function placeName(where) {
  if (!where) return 'somewhere';
  if (NAMES[where]) return NAMES[where];
  if (where.startsWith(`${MIDDLE_EARTH}/`)) {
    const id = where.slice(MIDDLE_EARTH.length + 1);
    return (chapter(id) ?? hidden(id))?.name ?? placeName(MIDDLE_EARTH);
  }
  const sys = systemOfPath(where);
  if (sys) return inGalaxyFlight(where) ? SYSTEM_NAMES[sys] : where.endsWith('/surface') ? `down on ${SYSTEM_NAMES[sys]}` : `the ${SYSTEM_NAMES[sys]} briefing`;
  // (a world, or a Rick and Morty planet's: '/c-137/squanch' is Planet Squanch, not C-137)
  const u = byPath(where);
  if (u) return u.world ?? u.place ?? u.label;
  if (where.startsWith('/projects/')) return 'a project';
  const word = where.slice(1).split('/')[0].replace(/-/g, ' ');
  return word ? word[0].toUpperCase() + word.slice(1) : 'the front door';
}
