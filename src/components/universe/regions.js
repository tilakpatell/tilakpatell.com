// The universe map's regions. Pure numbers, tested in Node: waypoints.js
// sits its beacons at their hubs, the director (where you are) and the
// roster (“Universe · Hero Reach”) read them.
//
// The fandoms live in neighbourhoods out in the Expanse (neighbourhoods.js),
// and each neighbourhood is a region, named for it. The wonders left round
// the Core (the Maw, Aurelia, Glacia, the Wanderer, the Graveyard) are
// grouped by complete linkage, the two groups whose furthest members are
// nearest merging again and again until CORE_GROUPS are left, each named
// for its biggest member (“Near the Maw”).
//
// Each region has a hub, its beacon: the middle of its members weighted by
// how far each reaches (the big ones pull it), lifted HUB_LIFT off the disc
// (up and down by turns), and
// pushed straight out of anything it lands in (the Veil is 700 across; a
// sun's planets reach further). The home system is a region of its own, its
// beacon just past its edge on the side the ship starts.
//
// regionAt(x, y, z) says which region a point is in: the region of the
// nearest member within LINK of it (past that member's own reach), or null
// out in the void between them.

import { HOME_RADIUS, ORDER, POSITIONS, REACH, SUN, mapSectorOf } from './layout';
import { DEEP_SOLIDS, PLACES, wonderById } from './deep';
import { byId } from './universes';
import { NEIGHBOURHOODS, NEIGHBOURHOOD_OF } from './neighbourhoods';

export const LINK = 2600;
export const HUB_LIFT = 90;
const CLEAR = 1.5; // a hub stays this many of a place's reaches from its middle

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// the main sector's places out past the home system: the fandoms' planets
// (the Star Wars gate one of them) and the wonders (the portal and the Maw
// among them); the Rick and Morty sector is through its portal
const FAR = PLACES.filter((p) => p.kind !== 'station' && mapSectorOf(...p.at) === 'main');
const STATIONS = ORDER.filter((id) => byId(id).kind === 'core');

// what a hub must stay out of: every place by CLEAR of its reach, and
// everything solid (a sun's planets, the binary's second sun, the Citadel's
// parts are in DEEP_SOLIDS) by its own reach. (Not ship.js's SOLIDS, which
// would import this file's users back: the same list, built from the same
// sources.)
const KEEP_OUT = [
  ...FAR.map((p) => ({ at: p.at, r: p.reach * CLEAR })),
  { at: SUN.at, r: SUN.r * 1.4 },
  ...DEEP_SOLIDS.map((o) => ({ at: o.at, r: o.reach })),
];

// complete linkage down to `count` groups (each an array of places)
function cluster(places, count) {
  let groups = places.map((p) => [p]);
  const span = (a, b) => {
    let m = 0;
    for (const p of a) for (const q of b) m = Math.max(m, dist(p.at, q.at));
    return m;
  };
  while (groups.length > count) {
    let best = null;
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const d = span(groups[i], groups[j]);
        if (!best || d < best.d) best = { d, i, j };
      }
    }
    const merged = [...groups[best.i], ...groups[best.j]];
    groups = groups.filter((_, k) => k !== best.i && k !== best.j);
    groups.push(merged);
  }
  return groups;
}

// the middle of a group, each member weighted by its reach
function centroid(group) {
  const w = group.reduce((s, p) => s + p.reach, 0);
  return [0, 1, 2].map((i) => group.reduce((s, p) => s + p.at[i] * p.reach, 0) / w);
}

// how far a lone place's hub is past its reach, toward home
const ALONE = 600;
const toward = (p, d) => {
  const k = (p.reach * CLEAR + d) / Math.hypot(p.at[0], p.at[2]);
  return [p.at[0] * (1 - k), p.at[1], p.at[2] * (1 - k)];
};

// out of everything it's inside: straight away from that thing's middle to
// just past its edge, round again until nothing holds it (a few rounds at
// most: the places are thousands apart)
function clearOf(at) {
  const p = [...at];
  for (let round = 0; round < 12; round++) {
    const o = KEEP_OUT.find((k) => dist(p, k.at) <= k.r + 1);
    if (!o) break;
    const d = dist(p, o.at);
    const u = d > 1e-6 ? p.map((v, i) => (v - o.at[i]) / d) : [0, 1, 0];
    for (let i = 0; i < 3; i++) p[i] = o.at[i] + u[i] * (o.r + 20);
  }
  return p;
}

// a world by its world's name (Middle-earth, not The Lord of the Rings), a wonder by its own
const nameOf = (id) => byId(id)?.world ?? byId(id)?.label ?? wonderById(id)?.name ?? id;

// The regions: the home system first, then a region per neighbourhood
// (neighbourhoods.js: its members and its landmarks, named for it), then the
// places left round the Core grouped by complete linkage. A region's id is
// its biggest member's, as it always was (the fleet war's fronts and the far
// fights are shared online by the beacons' ids: waypoints.js); its hub is
// its members' middle, lifted and pushed clear (a region of one: out from
// its place toward home).
const CORE_GROUPS = 2; // how many regions the places left round the Core make
export const REGION_COUNT = NEIGHBOURHOODS.length + CORE_GROUPS; // (besides the home system's)

function regionOf(g, name, i) {
  const biggest = g.reduce((a, b) => (b.reach > a.reach ? b : a));
  const at = g.length > 1 ? centroid(g) : toward(g[0], ALONE);
  const lifted = [at[0], at[1] + (i % 2 ? -HUB_LIFT : HUB_LIFT), at[2]];
  return { id: biggest.id, name: name ?? `Near ${nameOf(biggest.id).replace(/^The /, 'the ')}`, members: g.map((p) => p.id), hub: clearOf(lifted) };
}

function build() {
  const rows = NEIGHBOURHOODS.map((n) => ({ name: n.name, neighbourhood: n.id, g: FAR.filter((p) => NEIGHBOURHOOD_OF[p.id] === n.id || (p.id === 'rmportal' && n.id === 'rift')) }));
  const left = FAR.filter((p) => !rows.some((r) => r.g.includes(p)));
  rows.push(...cluster(left, CORE_GROUPS).map((g) => ({ name: null, neighbourhood: null, g })));
  const rest = rows
    .map((r) => ({ ...r, mid: centroid(r.g) }))
    .sort((a, b) => Math.atan2(a.mid[2], a.mid[0]) - Math.atan2(b.mid[2], b.mid[0]))
    .map((r, i) => ({ ...regionOf(r.g, r.name, i), neighbourhood: r.neighbourhood }));
  const home = { id: 'home', name: 'The home system', members: STATIONS, hub: [0, 0, HOME_RADIUS + 240], neighbourhood: null };
  return [home, ...rest];
}

export const REGIONS = build();
const BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
export const regionById = (id) => BY_ID.get(id) ?? null;

// every member as { at, reach, region }, for regionAt
const MEMBERS = REGIONS.flatMap((r) =>
  r.members.map((id) => {
    const p = PLACES.find((x) => x.id === id);
    return { at: p?.at ?? POSITIONS[id], reach: p?.reach ?? REACH[id], region: r };
  }),
);

// the region (x, y, z) is in: the nearest member's, if it's within LINK of
// that member's reach; null in the void
export function regionAt(x, y, z) {
  let best = null;
  let gap = Infinity;
  for (const m of MEMBERS) {
    const g = Math.hypot(x - m.at[0], y - m.at[1], z - m.at[2]) - m.reach;
    if (g < gap) {
      gap = g;
      best = m.region;
    }
  }
  return gap <= LINK ? best : null;
}
