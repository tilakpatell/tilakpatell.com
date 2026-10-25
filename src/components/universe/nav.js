// The nav map's numbers: everywhere there is to go on the universe map, the
// ways to get there, how long each takes, and where things sit on the chart.
// Pure (no React, no three.js), so it's tested in Node; NavMap.jsx draws it
// and scene.js flies it.
//
// Three drives, picked on the nav map and kept between visits (the
// hyperlanes went: the jump is the everyday way, the galaxy's way):
//   hyper   Hyperspeed. A jump to lightspeed: the site's own jump plays over
//           the map (or the crew's own way across it, Rick's portal or the
//           RV's Blue Sky: components/jumps), and the ship comes out parked
//           at the place, whatever the distance. It can't jump while hunters
//           have it interdicted, and the hyperdrive takes HYPER.recharge
//           seconds to charge again.
//   super   Super speed. The autopilot on the pulse drive pushed to
//           OVERDRIVE times its speed (ship.js), roughly half the trip. You
//           see the whole way and can take the stick back at any time.
//   cruise  The pulse drive as it comes: the scenic way, the crew talking.
// Picking a place anywhere on the map (its name, the panel, the nav map)
// goes by the drive picked.
//
// Generated places, out in the endless universe (an E: id, in any spelling:
// places/ids.js), are places to go too, but never listed here: there are
// too many, and none is stored. Every function that takes an id takes the
// caller's lookup in its opts, { place(id) → Destination | null, park(id,
// from) → Park | null } (places/resolve.js's lookupOf, or the scene's
// places), and a generated place is what that finds, and nothing without
// one. The scene's lookup reads only the sectors it has; the terminal's
// makes one, on its own page. It's a lookup and not an import, and the ids
// come from places/ids.js, because a module is never split across chunks:
// anything taken from the resolver would bring the generator onto every page
// that loads this one (⌘K, the home page's mini-map and the site's root),
// and a sector's making onto the main thread. The park comes with the lookup
// too (places/park.js's parkPlace): imported here, it took ⌘K past the 2 kB
// those pages may grow by. A generated place is timed by places/trip.js's
// formula, and a jump to one is a jump like any other.

import { EDGE, GOALS, OVERDRIVE, SHIP, SOLIDS, autopilot, forward, goalAt, headingTo, isGoal, parkAt, step } from './ship';
import { PORTALS, portalById, portalHit, transit } from './portals';
import { MAW, parkNear } from './maw';
import { WONDERS, reachOf } from './deep';
import { HOME_RADIUS, ORDER, POSITIONS, REACH, SECTORS, mapSectorOf, sectorOf } from './layout';
import { MOONS, byId } from './universes';
import { LENGTH } from './scale';
import { pilotId } from './pilotGoal';
import { SYSTEM_MARKS, SYSTEM_NAMES } from '../galaxy/names';
import { canonicalPlace, isPlaceId } from './places/ids';
import { longTrip } from './places/trip';

export const DRIVE_KEY = 'tp-universe-drive';

export const DRIVES = [
  {
    id: 'hyper',
    name: 'Jump',
    verb: 'Jump',
    od: 1,
    about: 'A jump to lightspeed, the galaxy’s way: the ship comes round onto it, spools up and goes, and you come out parked at it, however far it is. Or put the nose on a far star and press J.',
  },
  {
    id: 'super',
    name: 'Super speed',
    verb: 'Race', // (a verb: “Race to Marvel”; the drive keeps its name)
    od: OVERDRIVE,
    about: `The pulse drive pushed to ${OVERDRIVE}× its speed, about half the trip. You fly the whole way and can take the stick back any time.`,
  },
  {
    id: 'cruise',
    name: 'Cruise',
    verb: 'Cruise',
    od: 1,
    about: 'The pulse drive as it comes. The scenic route, with time for the crew to talk on the way.',
  },
];
export const driveById = (id) => DRIVES.find((d) => d.id === id) ?? DRIVES[0];
// a stored drive, or the jump (the everyday way; a drive kept from when there
// were hyperlanes, `lanes`, reads as it too)
export const parseDrive = (v) => (DRIVES.some((d) => d.id === v) ? v : 'hyper');

// the jump, in seconds: to the flash, when the ship's moved (the site's jump
// overlay flashes at 1.15 to 1.3 s, components/Hyperspace.jsx); all of it;
// and how long till the hyperdrive can go again (a few seconds: it's the
// everyday way across, the galaxy's way; before the jump the ship comes
// round onto the place, aim.js's JUMP.align at most)
export const HYPER = { flash: 1.2, length: 2.45, recharge: 5 };

// Whether the hyperdrive can jump now: { ready, wait (seconds), why }.
// `last` is when it last jumped and `now` the clock (both in seconds), or
// null for never; `recharge`, the seconds it takes (the skill tree's hot
// drive shortens it).
export function hyperState({ last = null, now = 0, interdicted = false, recharge = HYPER.recharge } = {}) {
  if (interdicted) return { ready: false, wait: 0, why: 'interdicted' };
  const wait = last === null ? 0 : Math.max(0, last + recharge - now);
  return wait > 0 ? { ready: false, wait, why: 'charging' } : { ready: true, wait: 0, why: null };
}

// What each wonder is, in a line (they have no page: the crews have their say as you pass)
const WONDER_KIND = { portal: 'Portal', 'gas-giant': 'Gas giant', 'ice-giant': 'Ice giant', star: 'Star', 'black-hole': 'Black hole', nebula: 'Nebula', citadel: 'Space station', pulsar: 'Pulsar', binary: 'Binary star', rogue: 'Rogue planet', graveyard: 'Wreck field' };
const WONDER_ABOUT = {
  aurelia: 'A ringed gas giant, bigger than any world on the map. Its rings go a long way out.',
  glacia: 'An ice giant: cold, blue and very quiet.',
  ember: 'An orange sun with two planets of its own, a rock and an ocean world.',
  halcyon: 'A blue sun, hot and young, with a rock and a gas giant round it.',
  maw: 'A black hole. The autopilot stops you at the edge of its pull: past that it has you, and on its far side is a friend’s universe.',
  veil: 'A nebula, purple and rose. Not solid: fly right through it on the pulse drive.',
  cradle: 'A green and gold nebula. Not solid: fly right through it on the pulse drive.',
  citadel: 'The Citadel of Ricks, at the middle of its own sector of space. Fly into it too fast and you’re inside its world.',
  curvesun: 'The Rick and Morty sector’s own sun, a little green: everything in the Curve is a little off.',
  rmportal: 'A green portal beside the Rick and Morty planet. Fly into it and you come out by the Citadel, in a sector of space of its own.',
  'rmportal-back': 'The portal home, beside the Citadel. Fly into it and you come out by the Rick and Morty planet.',
  lantern: 'A pulsar: a dead star the size of a city, spinning, two beams of light sweeping round it. Nobody goes near.',
  twins: 'Two suns, one gold and one white, close enough to share a bridge of burning gas.',
  wanderer: 'A rogue planet with no sun of its own: dark, ice-crusted, lit only by its auroras and a thin ring of ice. Far out, below the disc.',
  graveyard: 'A white dwarf with a field of dead ships drifting round it, from every fleet and none. Quiet.',
};
const wonderColor = (w) => w.color ?? w.colors?.[0] ?? (w.kind === 'black-hole' ? '#ffb070' : '#7fd6ff');

// Everywhere there is to go: the site's pages (stations round the sun), the
// fandoms' worlds, the wonders out in deep space, and the galaxy's star
// systems, through the Star Wars gate. Each { id, name, kind ('station',
// 'world', 'wonder' or 'system'), type (in words), at, reach, color, about,
// to (its page, or null) }; a system has `via` too, the place on this map
// the trip really goes to (the gate), and `to` is where the page goes on
// from there.
export const DESTINATIONS = [
  ...ORDER.map((id) => {
    const u = byId(id);
    const station = u.kind === 'core';
    return {
      id,
      name: station ? u.label : u.world,
      kind: station ? 'station' : 'world',
      type: station ? 'Station' : u.label,
      at: POSITIONS[id],
      reach: REACH[id],
      color: u.swatch,
      about: station ? u.sign[1] : u.portal ? `The hyperspace gate into ${u.world.toLowerCase()}.` : `${u.world}, the ${u.label} world.`,
      to: u.to,
    };
  }),
  // the Rick and Morty sector's worlds, round the Citadel
  ...MOONS.map((m) => ({
    id: m.id,
    name: m.label,
    kind: 'world',
    type: 'Rick and Morty',
    at: POSITIONS[m.id],
    reach: REACH[m.id],
    color: m.swatch,
    about: `${m.label}, a planet from Rick and Morty, out in the Citadel's own sector of space. Land on it and you're straight into it, on foot as Morty, with something to do there; its own portal brings you back out to space.`,
    to: m.to,
  })),
  ...WONDERS.map((w) => ({
    id: w.id,
    name: w.name,
    kind: 'wonder',
    type: WONDER_KIND[w.kind] ?? 'Wonder',
    at: w.at,
    reach: reachOf(w),
    color: wonderColor(w),
    about: WONDER_ABOUT[w.id] ?? '',
    to: null,
  })),
  ...Object.entries(SYSTEM_NAMES).map(([id, name]) => ({
    id: `sys:${id}`,
    name,
    kind: 'system',
    type: 'Star system',
    at: POSITIONS.starwars,
    reach: REACH.starwars,
    color: SYSTEM_MARKS[id]?.[2] ?? byId('starwars').swatch,
    about: `Through the hyperspace gate: ${name}, in a galaxy far, far away.`,
    to: `/galaxy/${id}`,
    via: 'starwars',
  })),
].map((d) => ({ ...d, sector: sectorOf(...d.at) })); // (which sector of the map it's in: layout.js)
const BY_ID = new Map(DESTINATIONS.map((d) => [d.id, d])); // (a Map: a word from a visitor is never a prototype's key here)
// a generated place the caller's lookup finds, by its canonical id; null
// for none, and with no lookup (this file never reaches the generator)
function generated(id, place) {
  const canon = typeof place === 'function' ? canonicalPlace(id) : null;
  return (canon && place(canon)) || null;
}
// a place by its id: one on the map, else a generated one the lookup finds
export const destinationById = (id, { place } = {}) => BY_ID.get(id) ?? generated(id, place);
// the place on this map a trip to `id` really goes to: a system's gate, else
// itself (a generated place by its canonical id)
export const goalOf = (id) => (BY_ID.has(id) ? (BY_ID.get(id).via ?? id) : (canonicalPlace(id) ?? id));
// whether there's somewhere to go for `id`: a place on the map, or a
// generated place the lookup finds (one in a sector the caller hasn't got
// isn't, yet: the scene's own travel fetches it)
export const canGo = (id, { place } = {}) => isGoal(goalOf(id)) || generated(id, place) !== null;

// The sectors (layout.js): a place in another sector than the ship's is
// gone to through the portal between them (portals.js), then on from its far
// end. portalBetween(from, to) → the portal in `from` that opens on `to`, or
// null; legOf(ship, id) → where the trip to `id` goes first: that portal, or
// the place itself (its gate, for a star system) when it's in the ship's sector.
// (Another pilot, `pilot:<id>` (pilotGoal.js), is in whichever sector their
// `pose` says: legOf(ship, id, pose). A generated place is in the main
// map's: none is in the Curve, so from there it's gone to by the portal home)
const sectorOfGoal = (id) => {
  const g = goalAt(goalOf(id));
  return g ? sectorOf(...g.at) : isPlaceId(id) ? 'main' : null;
};
export const portalBetween = (from, to) => PORTALS.find((p) => sectorOf(...p.at) === from && p.leadsTo.sector === to) ?? null;
export function legOf(ship, id, pose = null) {
  const goal = goalOf(id);
  const there = pilotId(goal) ? (pose ? mapSectorOf(pose.x, pose.y ?? 0, pose.z) : null) : sectorOfGoal(goal);
  if (!ship || !there) return goal;
  const here = mapSectorOf(ship.x, ship.y ?? 0, ship.z); // (out in the Expanse, by the main map's portals)
  return here === there ? goal : (portalBetween(here, there)?.id ?? goal);
}

export const KINDS = [
  { id: 'all', name: 'Everywhere' },
  { id: 'station', name: 'Stations' },
  { id: 'world', name: 'Worlds' },
  { id: 'wonder', name: 'Wonders' },
  { id: 'system', name: 'Star systems' },
];

// the destinations a filter and a search leave, in map order (the search
// matches the name, its fandom or what it is, ignoring case and accents)
// (and `more`, rows of generated places, the ones in view or visited, after
// the map's own, each once; a generated row matches by its id too, and an id
// in any spelling that isn't among them is looked up; a row round the ship
// (around.js's) has no type, so it matches by its name or its whole id.
// Generated systems are kind 'star', since a 'system' on the chart is a gate
// system, so the "Star systems" filter takes both)
const fold = (t) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const ofKind = (d, kind) => kind === 'all' || d.kind === kind || (kind === 'system' && d.kind === 'star');
function withMore(more) {
  if (!more?.length) return DESTINATIONS;
  const rows = [...DESTINATIONS];
  const seen = new Set(BY_ID.keys());
  for (const d of more) if (d?.id && !seen.has(d.id)) (seen.add(d.id), rows.push(d));
  return rows;
}
export function findDestinations(kind = 'all', query = '', { more = [], place } = {}) {
  const text = String(query ?? '').trim();
  const q = fold(text);
  const canon = canonicalPlace(text);
  const rows = withMore(more);
  const found = rows.filter((d) => ofKind(d, kind) && (!q || d.id === canon || fold(`${d.name} ${d.type ?? ''} ${byId(d.id)?.label ?? ''}${d.generated ? ` ${d.id}` : ''}`).includes(q)));
  const looked = canon && !rows.some((d) => d.id === canon) ? generated(canon, place) : null;
  return looked && ofKind(looked, kind) ? [...found, looked] : found;
}
// one place for a word (the terminal's `fly`): its id as it is (a system's
// with or without `sys:`), else the first the search finds; null for nothing
// (a generated place's id, in any spelling, is the lookup's to find or not)
export function findDestination(query = '', { place } = {}) {
  const text = String(query ?? '').trim();
  if (isPlaceId(text)) return generated(text, place);
  const q = fold(text);
  if (!q) return null;
  return BY_ID.get(q) ?? BY_ID.get(`sys:${q}`) ?? findDestinations('all', q)[0] ?? null;
}

// the grand tour: every station, world and wonder (the systems are the
// galaxy's own), from wherever the ship is, nearest first and on from each
// to its nearest left (by default, the places in the sector it's in)
export const TOUR_IDS = DESTINATIONS.filter((d) => d.kind !== 'system').map((d) => d.id);
export const tourIdsIn = (sector) => TOUR_IDS.filter((id) => BY_ID.get(id).sector === sector);
export function tourFrom(ship, ids = tourIdsIn(mapSectorOf(ship.x, ship.y ?? 0, ship.z))) {
  const left = new Set(ids);
  const order = [];
  let at = { x: ship.x, y: ship.y ?? 0, z: ship.z };
  while (left.size) {
    let best = null;
    for (const id of left) {
      const d = distanceTo(at, id);
      if (best === null || d < best.d) best = { id, d };
    }
    order.push(best.id);
    left.delete(best.id);
    const dest = BY_ID.get(best.id);
    at = { x: dest.at[0], y: dest.at[1], z: dest.at[2] };
  }
  return order;
}

// where the ship parks at a place (the Maw: the edge of its pull, not in it)
// (a generated place: where the lookup's park says; null if it hasn't got it)
export function parkFor(id, from, { park } = {}) {
  id = goalOf(id);
  if (isPlaceId(id)) return (typeof park === 'function' && park(id, from)) || null;
  if (id === MAW.id) return parkNear(from);
  // (a portal: right into its middle, so the ship goes through: portals.js)
  const portal = portalById(id);
  if (portal) return { x: portal.at[0], y: portal.at[1], z: portal.at[2], heading: headingTo(portal.at[0] - from[0], portal.at[2] - from[1]) };
  return parkAt(id, from);
}

// Where a rift (director.js) comes out: any place or wonder on the map but
// the one you're at (`fromId`, or null for nowhere) and the Maw (nobody's
// thrown into a black hole), never a part of one (the Citadel's domes)
// (and never a portal, and never out of the sector it opened in: `sector`,
// layout.js; somewhere you haven't been, from `saw`, while there's anywhere left)
const RIFT_EXITS = Object.keys(GOALS).filter((id) => id !== MAW.id && !id.includes('-') && !portalById(id));
export function riftExit(fromId = null, rand = Math.random, sector = 'main', saw = null) {
  const exits = RIFT_EXITS.filter((id) => id !== fromId && sectorOf(...GOALS[id].at) === sector);
  const fresh = saw ? exits.filter((id) => !saw.has(id)) : exits;
  const pool = fresh.length ? fresh : exits;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

// Where a rift opens: ahead of the ship and off to one side, at its height,
// the nearest spot of a few (RIFT_AHEAD out, either side) that's clear of
// anything solid by RIFT_CLEAR past its surface; null if none is (the ship
// is in a crowd). `rand` picks which side comes first.
export const RIFT_R = 4;
const RIFT_AHEAD = [35, 55, 80];
const RIFT_SIDE = 12;
const RIFT_CLEAR = RIFT_R + 6;
export function riftSpot(ship, rand = Math.random) {
  const [fx, fz] = forward(ship.heading);
  const rx = -fz;
  const rz = fx;
  const first = rand() < 0.5 ? -1 : 1;
  for (const ahead of RIFT_AHEAD) {
    for (const side of [first, -first]) {
      const x = ship.x + fx * ahead + rx * side * RIFT_SIDE;
      const z = ship.z + fz * ahead + rz * side * RIFT_SIDE;
      const y = ship.y;
      if (SOLIDS.some((o) => Math.hypot(x - o.at[0], y - o.at[1], z - o.at[2]) < o.r + RIFT_CLEAR)) continue;
      return [x, y, z];
    }
  }
  return null;
}

// how far it is from (x, y, z) to a place: to its parking spot's side of
// it, in map units (the edge of what's there, not its middle)
// (in another sector: to the portal, and on from its far end; a generated
// place where the lookup has it)
export function distanceTo(ship, id, opts = {}) {
  const d = destinationById(goalOf(id), opts);
  if (!d || !ship) return null;
  const leg = legOf(ship, id);
  const p = leg !== d.id ? portalById(leg) : null;
  if (p) {
    const out = portalById(p.leadsTo.exit);
    return Math.hypot(ship.x - p.at[0], (ship.y ?? 0) - p.at[1], ship.z - p.at[2]) + distanceTo({ x: out.at[0], y: out.at[1], z: out.at[2] }, id, opts);
  }
  const c = Math.hypot(ship.x - d.at[0], (ship.y ?? 0) - d.at[1], ship.z - d.at[2]);
  return Math.max(0, c - d.reach);
}

// How long the trip takes on a drive, in seconds: the jump, or the
// autopilot flown there on the ship's own physics (without hunters, who'd
// slow it); null if it can't get there (or isn't somewhere to go)
// (in another sector: into the portal, through, and on from the far end; a
// jump goes to the portal, and the hyperdrive's charging by the far side, so
// on from there at super speed)
// (a leg the autopilot doesn't fly within `limit` seconds, and a generated
// place on the pulse drive, are timed by places/trip.js's formula instead:
// a far trip has a time, not a dash)
export const TRANSIT = 0.6; // seconds through a portal (the flash)
export function tripTime(ship, id, drive = 'super', { limit = 150, dt = 1 / 30, ...look } = {}) {
  id = goalOf(id);
  const dest = generated(id, look.place);
  if (!ship || !(goalAt(id) || dest)) return null;
  const leg = legOf(ship, id);
  if (leg !== id) {
    const p = portalById(leg);
    let first;
    let out;
    if (drive === 'hyper') first = HYPER.length;
    else {
      const park = parkFor(leg, [ship.x, ship.z]);
      const od = driveById(drive).od;
      let s = { ...ship };
      for (let t = 0; t < limit && !out; t += dt) {
        const next = step(s, autopilot(s, leg, park, undefined, od).input, dt).ship;
        if (portalHit(s, next) === leg) {
          first = t + dt;
          out = transit(next, leg).ship;
        }
        s = next;
      }
      if (!out) first = Math.max(limit, longTrip(ship, park, drive));
    }
    out ??= transit({ ...ship, x: p.at[0], y: p.at[1], z: p.at[2], speed: 0 }, leg)?.ship;
    if (!out) return null;
    const rest = tripTime(out, id, drive === 'hyper' ? 'super' : drive, { limit, dt, ...look });
    return rest === null ? null : first + TRANSIT + rest;
  }
  if (drive === 'hyper') return HYPER.length;
  const park = parkFor(id, [ship.x, ship.z], look);
  if (!park) return null;
  if (dest) return longTrip(ship, park, drive);
  const od = driveById(drive).od;
  let s = { ...ship };
  for (let t = 0; t < limit; t += dt) {
    const a = autopilot(s, id, park, undefined, od);
    if (a.done) return t;
    s = step(s, a.input, dt).ship;
  }
  return Math.max(limit, longTrip(ship, park, drive));
}

// "8 s", "1 min 5 s", or a dash
export function formatTime(t) {
  if (t === null || t === undefined || !Number.isFinite(t)) return '—';
  if (t < 10) return `${t.toFixed(1)} s`;
  if (t < 60) return `${Math.round(t)} s`;
  const m = Math.floor(t / 60);
  const s = Math.round(t - m * 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}
// the same measure, short, for the HUD beside a target: ship-lengths with
// no unit word, thousands as "4.6k"
export function shortDistance(units) {
  const n = Math.max(0, units / LENGTH);
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}k`;
}

// map units in the map's own measure: ship-lengths (scale.js's LENGTH)
export function formatDistance(units) {
  if (units === null || units === undefined) return '—';
  const n = units / LENGTH;
  if (n < 1) return 'Here';
  const r = n < 1000 ? Math.round(n / 10) * 10 : Math.round(n / 100) * 100;
  return `${Math.max(10, r).toLocaleString('en-US')} ship-lengths`;
}

// ── The chart ──
// Seen from straight above, north (−z) up. Two views: the whole universe,
// out to the edge of the map, on a root scale (so the home system opens up
// and the far worlds still fit: since the spread, scale.js's SPREAD, a 0.375
// power, which keeps the home system as big on it as the square root did on
// the map a quarter the size), and the home system alone, to scale. chartAt gives where (x, z) is on it, 0…1 across and down.
// (and a third, the Rick and Morty sector, round its own middle: each view's
// `sector`, and its `origin`, the point at its middle)
export const CHART_VIEWS = {
  all: { id: 'all', name: 'Universe', r: EDGE, scale: 'root', power: 0.375, sector: 'main', origin: [0, 0, 0] },
  home: { id: 'home', name: 'Home system', r: HOME_RADIUS * 1.15, scale: 'linear', sector: 'main', origin: [0, 0, 0] },
  rickmorty: { id: 'rickmorty', name: 'The Curve', r: SECTORS.rickmorty.edge, scale: 'root', power: 0.5, sector: 'rickmorty', origin: SECTORS.rickmorty.origin },
};
// the chart a sector opens on
export const viewFor = (sector) => (sector === 'rickmorty' ? 'rickmorty' : 'all');
const MARGIN = 0.47; // the chart's radius, of its width (a little room round the edge)
export function chartRadius(r, view = CHART_VIEWS.all) {
  const k = Math.max(0, r) / view.r;
  return (view.scale === 'root' ? k ** view.power : k) * MARGIN;
}
export function chartAt(x, z, view = CHART_VIEWS.all) {
  const o = view.origin ?? [0, 0, 0];
  x -= o[0];
  z -= o[2];
  const r = Math.hypot(x, z);
  if (r < 1e-9) return [0.5, 0.5];
  const k = chartRadius(r, view) / r;
  return [0.5 + x * k, 0.5 + z * k];
}
// on the chart at all (the home view leaves deep space off it)
export const onChart = ([u, v]) => u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01;
// which way the ship's nose points on the chart, in degrees clockwise from
// pointing right (its heading 0 is −z: up)
export const chartHeading = (heading) => (Math.atan2(-Math.cos(heading), -Math.sin(heading)) * 180) / Math.PI;

// how fast the ship's going, in words: parked, flying, on the pulse drive, at super speed
export function speedWord(speed) {
  const v = Math.abs(speed ?? 0);
  if (v < 0.3) return 'Holding still';
  if (v <= SHIP.boost + 1) return 'Flying';
  if (v <= SHIP.pulse + 5) return 'On the pulse drive';
  return 'At super speed';
}
