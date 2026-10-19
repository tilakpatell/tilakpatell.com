// The multiverse's destinations as data, and the portal gun's dial. Each
// place stands in its own column west of the rooms, one per 100 m of z from
// z = 900 (the plan's Global Constraints); its builder (./<id>.js) loads the
// first time the portal opens on it. Rick's garage portal goes wherever the
// dial is set (kept as tp-rm-dial), and the place's own portal goes home to
// the garage.
//
// Ten of them are the planets of the universe map's Rick and Morty sector
// (PLANETS): you land on one from the map and come out at its way in
// (#/c-137/<id>, planetStart), and its own portal (isWayHome) takes you back
// out to the map, not to the garage. Four of them (the adventure's) are on
// the dial too, where they're a destination like any other.
//
// Pure: rules.js spreads these into AREAS, LINKS, PEOPLE, HOTSPOTS and
// TASKS; RmWorld.jsx takes the names, what people say and what talking to
// them does.

import { GARAGE_BACK } from './place';
import { ROWS as ROWS1 } from './rows1';
import { ROWS as ROWS2 } from './rows2';
import { ROWS as ROWS3 } from './rows3';

export { DEST_COL, DEST_X, GARAGE_BACK, destArea, destZ } from './place';

// every place, in the dial's order (the rows' files, ./place.js's shape; the planets are off the dial)
export const DESTINATIONS = [...ROWS1, ...ROWS2, ...ROWS3];

export const destinationById = (id) => DESTINATIONS.find((d) => d.id === id) ?? null;

// ── the planets ──

// in the order of the map's moons (universes.js's MOONS, which its test holds them to)
export const PLANETS = ['gazorpazorp', 'squanch', 'birdworld', 'gearworld', 'pluto', 'snakeplanet', 'nuptia', 'resort', 'cronenberg', 'purge'];
export const isPlanet = (id) => PLANETS.includes(id);
// where Morty starts on a planet he's landed on: its way in, facing in
export function planetStart(id) {
  const d = isPlanet(id) ? destinationById(id) : null;
  return d ? { area: d.id, x: d.arrive.x, z: d.arrive.z, face: d.arrive.face } : null;
}
// The big planets: whole worlds on the galaxy's surface engine
// (rickmorty/planets/, its PLANET_SITES, which its test holds this to), not
// boxes here. Their rows stay for the map's moons, but RmWorld never opens
// them and their old box tasks are retired (rules.js). Each planet joins as
// its site is made.
export const BIG = new Set(['gazorpazorp']);
export const isBigPlanet = (id) => BIG.has(id);
// is this the planet's own portal, the way back out to the map?
export const isWayHome = (link, id) => link?.id === `${id}-portal`;

// ── the dial ──

// the arcade, then every destination but the planets (an old setting for one
// is the arcade), then the adventure's five on the end: the Citadel (its own
// page) and the four sector planets its story visits, dialled from the garage
// as any destination is, with the portal home to the garage
const row = ({ id, name, note }) => ({ id, name, note });
export const DIAL = [
  { id: 'annex', name: 'Blips and Chitz', note: 'An arcade on an alien street. Roy: A Life Well Lived is in the back.' },
  ...DESTINATIONS.filter((d) => !isPlanet(d.id)).map(row),
  { id: 'citadel', name: 'The Citadel', note: 'The Citadel of Ricks: every Rick there is, and a Council to keep them in line.', to: '/c-137/citadel' },
  ...['birdworld', 'gearworld', 'pluto', 'squanch'].map((id) => row(destinationById(id))),
];
export const DIAL_KEY = 'tp-rm-dial';
// a dial place that's a page of its own (the Citadel), not an area of C-137's
export const pageOf = (id) => DIAL.find((d) => d.id === id)?.to ?? null;
// where the garage portal opens: the dial if it's on the dial and open (the
// story's lock, when given), else the first open place, else Customs
export function portalTarget(dial, open = () => true) {
  if (DIAL.some((d) => d.id === dial) && open(dial)) return dial;
  return DIAL.find((d) => open(d.id))?.id ?? 'customs';
}
export function readDial() {
  try {
    return portalTarget(localStorage.getItem(DIAL_KEY));
  } catch {
    return 'annex';
  }
}
export function writeDial(id) {
  try {
    localStorage.setItem(DIAL_KEY, portalTarget(id));
  } catch {
    /* (private mode: the dial lasts the visit) */
  }
}

// the garage portal, sent where the dial is set (to a page, it carries the
// page for RmWorld to go to); any other link as it is
export function linkTarget(link, dial) {
  if (link.id !== 'garage-portal') return link;
  const id = portalTarget(dial);
  const page = pageOf(id);
  if (page) return { ...link, page, label: `Through the portal to ${DIAL.find((d) => d.id === id).name}` };
  const d = destinationById(id);
  return d ? { ...link, to: d.id, label: `Through the portal to ${d.name}`, arrive: d.arrive } : link;
}

// a saved spot, if it's still somewhere Morty can be: in a built-in area, or
// in a destination (whatever the dial says now: the way home's there), else
// the garage, where the portal is
export function validArrive(saved, areas) {
  const a = saved && areas[saved.area];
  if (a && saved.x >= a.x0 && saved.x <= a.x1 && saved.z >= a.z0 && saved.z <= a.z1) return { area: saved.area, x: saved.x, z: saved.z, face: saved.face ?? 0 };
  return { area: 'garage', ...GARAGE_BACK };
}
