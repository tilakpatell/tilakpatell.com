// The chart's data: one Mark for each hand-made place, read from nav.js's own
// fixed list so the chart can never drift from the nav map, plus three marks
// that only the chart has, the regions, the live pilots and fights from the
// scene's where(), and the presets the chart opens on. Pure: no React, no DOM
// and no three.js. The Mark shape is stated in place.js.
//
// HAND_MARKS, markById(id) → Mark | null, REGIONS, liveMarks(now) → Mark[],
// presetView(id, ship), presetOf(view), openView(ship)

import { CHART_VIEWS, DESTINATIONS } from '../nav';
import { BELT, HOME_RADIUS, SECTORS, SUN, mapSectorOf } from '../layout';
import { byId } from '../universes';
import { CHART, createView, levelOf } from './projection';

// The colours the chart gives marks that nav.js gives none: the nav map's blue
// for its own labels and the pilots, the sun's amber, and the red-orange the
// nav map already draws a far fight in.
const TINT = { blue: '#9fd8ff', sun: '#ffbf5e', fight: '#ff8a5c' };

const ALL = Object.freeze(['system', 'neighbourhood', 'universe']);
const NEAR = Object.freeze(['system', 'neighbourhood']);

const SHAPE = { Nebula: 'cloud', 'Black hole': 'hole', Star: 'star', Portal: 'portal' };

function placeMark(d) {
  const moon = d.kind === 'world' && byId(d.id)?.kind === 'moon';
  const kind = moon ? 'moon' : d.kind;
  const portal = d.type === 'Portal';
  const priority = portal ? 30 : { world: 60, wonder: 50, moon: 45, station: 40 }[kind] ?? 40;
  const levels = kind === 'station' ? ['system'] : moon ? NEAR : ALL;
  return Object.freeze({
    id: d.id,
    kind,
    name: d.name,
    at: d.at,
    color: d.color,
    reach: d.reach,
    priority,
    levels,
    shape: SHAPE[d.type] ?? 'dot',
    pickable: true,
  });
}

const chartOnly = (m) => Object.freeze({ color: TINT.blue, pickable: false, ...m });

export const HAND_MARKS = Object.freeze([
  ...DESTINATIONS.filter((d) => d.kind !== 'system').map(placeMark),
  chartOnly({ id: 'chart:sun', kind: 'sun', name: '', at: SUN.at, reach: SUN.r, shape: 'sun', color: TINT.sun, priority: 80, levels: ALL }),
  chartOnly({ id: 'chart:home', kind: 'region', name: CHART_VIEWS.home.name, at: [0, 0, 0], priority: 90, levels: ['neighbourhood', 'universe'] }),
  chartOnly({ id: 'chart:curve', kind: 'region', name: CHART_VIEWS.rickmorty.name, at: SECTORS.rickmorty.origin, priority: 85, levels: ['universe'] }),
]);

const BY_ID = new Map(HAND_MARKS.map((m) => [m.id, m]));
export const markById = (id) => BY_ID.get(id) ?? null;

// Rings the chart draws: the home system, the asteroid belt, the Curve. The
// nav map's old dashed edge isn't one: there is no edge any more.
export const REGIONS = Object.freeze([
  Object.freeze({ id: 'home', centre: [0, 0, 0], radius: HOME_RADIUS, levels: ['neighbourhood', 'universe'] }),
  Object.freeze({ id: 'belt', centre: [0, 0, 0], radius: (BELT.inner + BELT.outer) / 2, levels: ['system'] }),
  Object.freeze({ id: 'curve', centre: SECTORS.rickmorty.origin, radius: SECTORS.rickmorty.edge, levels: NEAR }),
]);

// The pilots and far fights where() reports. Neither has a height, so both sit
// level with the ship, with no stem.
export function liveMarks(now) {
  if (!now) return [];
  const y = now.ship?.y ?? 0;
  const list = (v) => (Array.isArray(v) ? v : []).filter((e) => Number.isFinite(e?.x) && Number.isFinite(e?.z));
  return [
    ...list(now.pilots).map((p) => ({ id: `pilot:${p.id}`, kind: 'pilot', name: '', at: [p.x, y, p.z], color: TINT.blue, priority: 70, levels: NEAR, shape: 'pilot', pickable: false })),
    ...list(now.farFights).map((f) => ({ id: `fight:${f.id}`, kind: 'fight', name: f.label ?? '', at: [f.x, y, f.z], color: TINT.fight, priority: 35, levels: NEAR, shape: 'fight', pickable: false })),
  ];
}

// A preset's range kept inside what the chart can draw: today's numbers pass
// through, and an unbounded edge can't make the chart unbounded.
const within = (r) => (Number.isNaN(r) ? CHART.range.open : Math.min(CHART.range.max, Math.max(CHART.range.min, r)));

export function presetView(id, ship) {
  const v = CHART_VIEWS[id];
  return createView({ focus: [v.origin[0], ship?.y ?? 0, v.origin[2]], range: within(v.r), follow: false });
}

// Which part of space the chart is looking at.
export function presetOf(view) {
  const [x, , z] = view.focus;
  const o = SECTORS.rickmorty.origin;
  if (Math.hypot(x - o[0], z - o[2]) <= SECTORS.rickmorty.edge) return 'rickmorty';
  if (Math.hypot(x, z) <= 2 * HOME_RADIUS && levelOf(view.range) === 'system') return 'home';
  return 'all';
}

// What the chart opens on: the universe with no ship, else the ship, followed.
export function openView(ship) {
  if (!ship) return presetView('all', null);
  const y = ship.y ?? 0;
  const inCurve = mapSectorOf(ship.x, y, ship.z) === 'rickmorty';
  return createView({ focus: [ship.x, y, ship.z], range: within(inCurve ? CHART_VIEWS.rickmorty.r : CHART.range.open), follow: true });
}
