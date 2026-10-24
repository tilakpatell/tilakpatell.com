// What the chart draws, read from the map's own data: nav.js's fixed list of
// places, the scene's where() for what moves, and the views the chips open.
// Pure: no React, no DOM, no three.js. The marks are place.js's Mark shape.
//
// HAND_MARKS: Mark[], frozen and built once: a mark for each of nav.js's
//   DESTINATIONS but the galaxy's systems (they all sit at the gate, and the
//   list has them), each with its name, what it is (its type), place, colour
//   and reach, pickable;
//   then the chart's own three, never picked: the sun (unnamed), the home
//   system and the Curve (their ids start chart:, as home is a station's)
// markById(id) → Mark | null
// REGIONS: [{ id, centre, radius, levels }], the rings the chart outlines:
//   the home system's, the belt and the Curve's edge (no edge round the
//   map: there isn't one any more)
// liveMarks(now) → Mark[], from where(): the other pilots and the far
//   fights, level with the ship (where() gives neither a height)
// presetView(id, ship) → View, a chip's: 'all', 'home' or 'rickmorty'
// presetOf(view) → which of the three the chart is looking at
// openView(ship) → View, where the nav map opens: on the ship, or the whole
//   universe with none
//
// Lane 6b feeds the generated places, events and pilots in as more marks.

import { CHART_VIEWS, DESTINATIONS } from '../nav';
import { BELT, HOME_RADIUS, SECTORS, SUN, mapSectorOf } from '../layout';
import { byId } from '../universes';
import { CHART, createView, levelOf } from './projection';

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const ALL = Object.freeze(['system', 'neighbourhood', 'universe']);
const NEAR = Object.freeze(['system', 'neighbourhood']);
const LEVELS = { station: Object.freeze(['system']), moon: NEAR, world: ALL, wonder: ALL };
const PRIORITY = { world: 60, wonder: 50, moon: 45, station: 40 };
const PORTAL = 30; // (a portal ranks under every place, whatever its kind)
const SHAPES = { Nebula: 'cloud', 'Black hole': 'hole', Star: 'star', Portal: 'portal' }; // (by nav.js's type, as NavMap.jsx draws the wonders)
// the colours the nav map draws them in today: the sun's gradient's middle,
// the "Home system" button's amber, the map's blue, its pilots' green and its
// far fights' orange (navmap.css)
const COLOUR = { sun: '#ffbf5e', home: '#ffd9a0', curve: '#9fd8ff', pilot: '#7dff9a', fight: '#ff8a5c' };

// (copies: freezing a mark never freezes nav.js's or layout.js's own arrays)
const point = (at) => Object.freeze([at[0], at[1], at[2]]);
const mark = (m) => Object.freeze({ ...m, at: point(m.at) });

function placeMark(d) {
  const kind = d.kind === 'world' && byId(d.id)?.kind === 'moon' ? 'moon' : d.kind;
  const shape = SHAPES[d.type] ?? 'dot';
  return mark({
    id: d.id,
    kind,
    name: d.name,
    type: d.type,
    at: d.at,
    priority: shape === 'portal' ? PORTAL : PRIORITY[kind],
    color: d.color,
    levels: LEVELS[kind],
    shape,
    reach: d.reach,
    pickable: true,
  });
}

export const HAND_MARKS = Object.freeze([
  ...DESTINATIONS.filter((d) => d.kind !== 'system').map(placeMark),
  mark({ id: 'chart:sun', kind: 'sun', name: '', at: SUN.at, priority: 0, color: COLOUR.sun, levels: ALL, shape: 'sun', reach: SUN.r, pickable: false }),
  mark({ id: 'chart:home', kind: 'region', name: CHART_VIEWS.home.name, at: [0, 0, 0], priority: 90, color: COLOUR.home, levels: Object.freeze(['neighbourhood', 'universe']), pickable: false }),
  mark({ id: 'chart:curve', kind: 'region', name: CHART_VIEWS.rickmorty.name, at: SECTORS.rickmorty.origin, priority: 85, color: COLOUR.curve, levels: Object.freeze(['universe']), pickable: false }),
]);
const BY_ID = new Map(HAND_MARKS.map((m) => [m.id, m])); // (a Map: no id is ever a prototype's key)
export const markById = (id) => BY_ID.get(id) ?? null;

export const REGIONS = Object.freeze(
  [
    { id: 'home', centre: [0, 0, 0], radius: HOME_RADIUS, levels: Object.freeze(['neighbourhood', 'universe']) },
    { id: 'belt', centre: [0, 0, 0], radius: (BELT.inner + BELT.outer) / 2, levels: Object.freeze(['system']) },
    { id: 'curve', centre: SECTORS.rickmorty.origin, radius: SECTORS.rickmorty.edge, levels: NEAR },
  ].map((r) => Object.freeze({ ...r, centre: point(r.centre) })),
);

// what moves, from where(): pilots unnamed (as the nav map has them), the
// far fights by their label; one with no id or no number for x or z is left
// off, and so is a second with the same id
export function liveMarks(now) {
  if (!now) return [];
  const y = finite(now.ship?.y) ? now.ship.y : 0;
  const out = [];
  const seen = new Set();
  const add = (list, kind, make) => {
    for (const e of Array.isArray(list) ? list : []) {
      if (!e || e.id === null || e.id === undefined || !finite(e.x) || !finite(e.z)) continue;
      const id = `${kind}:${e.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, kind, shape: kind, at: [e.x, y, e.z], color: COLOUR[kind], levels: NEAR, pickable: false, ...make(e) });
    }
  };
  add(now.pilots, 'pilot', () => ({ name: '', priority: 70 }));
  add(now.farFights, 'fight', (f) => ({ name: typeof f.label === 'string' ? f.label : '', priority: 35 }));
  return out;
}

export function presetView(id, ship) {
  const v = CHART_VIEWS[Object.hasOwn(CHART_VIEWS, id) ? id : 'all'];
  const [x, , z] = v.origin;
  return createView({ focus: [x, finite(ship?.y) ? ship.y : 0, z], range: v.r, follow: false });
}

// which part of space the chart is on: the Curve when its focus is inside
// the Curve's edge, the home system when it's near the sun at a system's
// range, else the universe (so a chip still reads as pressed)
export function presetOf(view) {
  const [fx, , fz] = view.focus;
  const o = SECTORS.rickmorty.origin;
  if (Math.hypot(fx - o[0], fz - o[2]) <= SECTORS.rickmorty.edge) return 'rickmorty';
  if (Math.hypot(fx, fz) <= 2 * HOME_RADIUS && levelOf(view.range) === 'system') return 'home';
  return 'all';
}

export function openView(ship) {
  if (!ship || !finite(ship.x) || !finite(ship.y) || !finite(ship.z)) return presetView('all', null);
  const curve = mapSectorOf(ship.x, ship.y, ship.z) === 'rickmorty';
  return createView({ focus: [ship.x, ship.y, ship.z], range: curve ? CHART_VIEWS.rickmorty.r : CHART.range.open, follow: true });
}
