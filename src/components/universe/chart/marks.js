// What the charts show, as place.js's marks, read from the map's own data:
// every place on the nav map (nav.js's DESTINATIONS, the galaxy's systems
// left to the list: they all sit at the gate), the chart's own three (the
// sun, the home system's name, the Curve's), the rings round the home
// system, the belt and the Curve, and the live marks from the scene's
// where() (the other pilots, the far fights). Lane 6b adds the generated
// places and events here, as more marks.
// And the chart's presets: the chips' views (CHART_VIEWS' names, middles and
// ranges), which one a view is looking at, and the view the nav map opens on.
//
// HAND_MARKS, markById(id), REGIONS, liveMarks(now)
// presetView(id, ship), presetOf(view), openView(ship)

import { CHART_VIEWS, DESTINATIONS } from '../nav';
import { BELT, HOME_RADIUS, SECTORS, SUN } from '../layout';
import { byId } from '../universes';
import { CHART, createView, levelOf } from './projection';

const ALL = ['system', 'neighbourhood', 'universe'];
// (the Curve's moons are its own chart's: from outside it, its name stands for them)
const LEVELS = { station: ['system'], moon: ['system'], world: ALL, wonder: ALL };
const PRIORITY = { world: 60, wonder: 50, moon: 45, station: 40 };
const SHAPES = { Nebula: 'cloud', 'Black hole': 'hole', Star: 'star', Portal: 'portal' };
const NEAR = ['system', 'neighbourhood'];

const placeMark = (d) => {
  const kind = d.kind === 'world' && byId(d.id)?.kind === 'moon' ? 'moon' : d.kind;
  const shape = SHAPES[d.type] ?? 'dot';
  return Object.freeze({
    id: d.id,
    kind,
    name: d.name,
    at: d.at,
    priority: shape === 'portal' ? 30 : PRIORITY[kind],
    color: d.color,
    levels: LEVELS[kind],
    shape,
    reach: d.reach,
    pickable: true,
  });
};

export const HAND_MARKS = Object.freeze([
  ...DESTINATIONS.filter((d) => d.kind !== 'system').map(placeMark),
  // (prefixed: 'home' is already a station's id)
  Object.freeze({ id: 'chart:sun', kind: 'sun', name: '', at: SUN.at, priority: 95, color: '#ffbf5e', levels: ALL, shape: 'sun', reach: SUN.r, pickable: false }),
  Object.freeze({ id: 'chart:home', kind: 'region', name: CHART_VIEWS.home.name, at: [0, 0, 0], priority: 90, color: '#9fd8ff', levels: ['neighbourhood', 'universe'], shape: 'dot', pickable: false }),
  Object.freeze({ id: 'chart:curve', kind: 'region', name: CHART_VIEWS.rickmorty.name, at: SECTORS.rickmorty.origin, priority: 85, color: '#9fd8ff', levels: ['neighbourhood', 'universe'], shape: 'dot', pickable: false }),
]);
const BY_ID = new Map(HAND_MARKS.map((m) => [m.id, m]));
export const markById = (id) => BY_ID.get(id) ?? null;

// the rings the chart draws round parts of the map (there's no edge any
// more: space goes on, so the main map's old dashed edge isn't one)
export const REGIONS = Object.freeze([
  { id: 'home', centre: [0, 0, 0], radius: HOME_RADIUS, levels: ['neighbourhood', 'universe'] },
  { id: 'belt', centre: [0, 0, 0], radius: (BELT.inner + BELT.outer) / 2, levels: ['system'] },
  { id: 'curve', centre: SECTORS.rickmorty.origin, radius: SECTORS.rickmorty.edge, levels: NEAR },
]);

// the scene's where(): the other pilots (unnamed, as they always were) and
// the far fights. Neither carries a height yet, so both sit level with the
// ship, on no stem (lane 6b adds it).
export function liveMarks(now) {
  if (!now) return [];
  const y = Number.isFinite(now.ship?.y) ? now.ship.y : 0;
  const ok = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.z);
  return [
    ...(Array.isArray(now.pilots) ? now.pilots : []).filter(ok).map((p) => ({ id: `pilot:${p.id}`, kind: 'pilot', name: '', at: [p.x, y, p.z], priority: 70, color: '#9fd8ff', levels: NEAR, shape: 'pilot', pickable: false })),
    ...(Array.isArray(now.farFights) ? now.farFights : []).filter(ok).map((f) => ({ id: `fight:${f.id}`, kind: 'fight', name: f.label ?? '', at: [f.x, y, f.z], priority: 35, color: '#ff8a5c', levels: NEAR, shape: 'fight', pickable: false })),
  ];
}

export function presetView(id, ship) {
  const c = CHART_VIEWS[id] ?? CHART_VIEWS.all;
  const y = Number.isFinite(ship?.y) ? ship.y : 0;
  return createView({ focus: [c.origin[0], y, c.origin[2]], range: c.r, follow: false });
}

const curveFrom = (f) => Math.hypot(f[0] - SECTORS.rickmorty.origin[0], f[2] - SECTORS.rickmorty.origin[2]);
// which part of space the chart is looking at, for the chips' pressed one
export function presetOf(view) {
  const f = view.focus;
  if (curveFrom(f) <= SECTORS.rickmorty.edge) return 'rickmorty';
  if (Math.hypot(f[0], f[2]) <= 2 * HOME_RADIUS && levelOf(view.range) === 'system') return 'home';
  return 'all';
}

export function openView(ship) {
  if (!ship || !Number.isFinite(ship.x) || !Number.isFinite(ship.z)) return presetView('all', null);
  const focus = [ship.x, Number.isFinite(ship.y) ? ship.y : 0, ship.z];
  return createView({ focus, range: curveFrom(focus) <= SECTORS.rickmorty.edge ? CHART_VIEWS.rickmorty.r : CHART.range.open, follow: true });
}
