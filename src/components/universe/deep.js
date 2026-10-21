// Deep space: everything out past the home system (the sun and the stations,
// layout.js). Pure numbers, so it's tested in Node: deepspace.js draws it,
// ship.js flies through it.
//
// The fandoms' planets are out here too, far apart (layout.js), and between
// them it's open: the ship's boost becomes a pulse drive, the ceiling lifts
// from the home system's 100 to DEEP.ceiling, and the edge of the map is
// DEEP.edge away. Near any place (the home system, a planet, a wonder) the
// drive drops back to the boost, so you arrive at flying speed. Among the
// planets are the wonders: a ringed gas giant and an ice giant, two other
// suns with planets of their own, a black hole, two nebulae to fly through,
// and the Citadel of Ricks. Everything but the nebulae is solid: graze it and
// you bounce off, hit it fast and you crash (and crash.js and the scene make
// something of it: the Citadel takes you to its world). The black hole is
// the exception: touch it at any speed and it has you, and you don't come
// back. What's on its far side (`beyond`) is a friend's universe, their own
// site, and the page goes on to it (Universe.jsx).

import { BODIES, HOME_RADIUS, POSITIONS, REACH, SECTORS, SUN, inSector } from './layout';
import { byId } from './universes';
import { HOLE_SCALE, SPREAD, STAR_SCALE } from './scale';

export const DEEP = {
  system: HOME_RADIUS + 40, // inside this is the home system: the ceiling is SHIP.ceiling (and the drive opens only between its stations: ship.js driveAt)
  open: HOME_RADIUS + 440, // out past this (and this far from any place), the pulse drive's full speed and the full height
  near: 40, // how far past a place's reach you're still at it (the drive stays down)
  ramp: 400, // and how much further the drive takes to open all the way
  edge: SECTORS.main.edge, // turned back here (the main sector's: the Rick and Morty sector has its own, layout.js)
  ceiling: 1400, // how far above or below the disc it can go out in deep space
};

// kind: what it is (deepspace.js draws each kind its own way); r: its radius
// (a black hole's is its shadow; a pulsar's its tiny star, solid to ten times
// that; a binary's its first sun, its second `pair` { r, color, apart }
// along +x; a wreck field's its white dwarf, the hulls out to `field`);
// colors: its own palette; planets (a sun's):
// each { r, orbit, angle, color, kind } round it, level with it; crew: whose
// universe it's from (it's there for everyone); world: the universe whose
// page a crash into it leads to (and `page`, a page of its own there, if it
// has one); beyond (the black hole's): what's on its
// far side, { name, what, url }, where the page goes when the ship falls in
// The suns out here and their planets (and a binary's second sun) drawn
// STAR_SCALE bigger than their numbers below, and the Maw HOLE_SCALE (its
// shadow and its disk; its pull and its fall are counted in its shadows,
// maw.js): so every sun and the black hole are bigger than any world
// (scale.js, scale.test.js). The orbits, and how far apart a binary's two
// are, stay: the planets still clear their bigger suns, and the systems
// don't spread into the routes between the worlds. A pulsar and a white
// dwarf stay small, as they are.
function grown(w) {
  if (w.kind === 'star') return { ...w, r: w.r * STAR_SCALE, planets: w.planets.map((p) => ({ ...p, r: p.r * STAR_SCALE })) };
  if (w.kind === 'binary') return { ...w, r: w.r * STAR_SCALE, pair: { ...w.pair, r: w.pair.r * STAR_SCALE } };
  if (w.kind === 'black-hole') return { ...w, r: w.r * HOLE_SCALE, disk: w.disk * HOLE_SCALE };
  return w;
}

// beside the Rick and Morty planet: 2.5 of its reaches out, turned a way
// round from the line in from home (so a ship flying in to land isn't
// taken through), a little above its middle
function besideRickAndMorty() {
  const [x, y, z] = POSITIONS.rickmorty;
  const a = Math.atan2(-z, -x) + 1.2;
  const d = REACH.rickmorty * 2.5;
  return [x + Math.cos(a) * d, y + 12, z + Math.sin(a) * d];
}

// (the main sector's wonders spread out with the planets, by scale.js's
// SPREAD, across the disc only: their heights stay, under the ceiling. The
// numbers below are where they were before the spread; their own sizes and
// reaches stay. The Rick and Morty sector's keep their own layout, and the
// portal sits by its planet, already spread.)
const spread = (w) => (w.sector || w.kind === 'portal' ? w : { ...w, at: [w.at[0] * SPREAD, w.at[1], w.at[2] * SPREAD] });

export const WONDERS = [
  { id: 'aurelia', kind: 'gas-giant', name: 'Aurelia', at: [-2230, 135, -2835], r: 140, ring: true, colors: ['#e9c592', '#b9814d', '#f5e6c8', '#8f5a35'] },
  { id: 'glacia', kind: 'ice-giant', name: 'Glacia', at: [3510, -235, 945], r: 80, colors: ['#8fd0ef', '#3f86c2', '#d8f2ff'] },
  {
    id: 'ember',
    kind: 'star',
    name: 'Ember',
    at: [1080, 305, 4320],
    r: 90,
    color: '#ff7a3c',
    planets: [
      { r: 22, orbit: 320, angle: 0.6, color: '#b0623c', kind: 'rock' },
      { r: 30, orbit: 520, angle: 3.4, color: '#6f86a0', kind: 'ocean' },
    ],
  },
  {
    id: 'halcyon',
    kind: 'star',
    name: 'Halcyon',
    at: [-4455, -370, 1890],
    r: 75,
    color: '#9cc4ff',
    planets: [
      { r: 18, orbit: 260, angle: 2.2, color: '#d9d3c4', kind: 'rock' },
      { r: 36, orbit: 450, angle: 5.1, color: '#c58fd8', kind: 'gas' },
    ],
  },
  {
    id: 'maw',
    kind: 'black-hole',
    name: 'The Maw',
    at: [4320, 200, -3510],
    r: 30,
    disk: 200,
    // on its far side: Shrey Pathak's portfolio, the Matrix (where Rick and Morty come out)
    beyond: { name: 'Shrey Pathak', what: 'the Matrix', url: 'https://shreyaanpathak.github.io/portfolio' },
  },
  { id: 'veil', kind: 'nebula', name: 'The Veil', at: [-2230, 505, 4725], r: 700, colors: ['#5b3fd1', '#d14f9a', '#3fb7d1'], solid: false },
  { id: 'cradle', kind: 'nebula', name: 'The Cradle', at: [4995, -505, 2230], r: 600, colors: ['#2f9e6b', '#c9d14f', '#2f6e9e'], solid: false },
  // the Rick and Morty sector (layout.js's SECTORS): the Citadel at its middle, and its own sun off to one side, past its worlds
  { id: 'citadel', kind: 'citadel', name: 'The Citadel', sector: 'rickmorty', at: inSector('rickmorty', [0, 0, 0]), r: 60, crew: 'rickmorty', world: 'rickmorty', page: '/c-137/citadel' }, // (as big as the biggest world: scale.js)
  { id: 'curvesun', kind: 'star', name: 'The Curve’s Sun', sector: 'rickmorty', at: inSector('rickmorty', [-2200, 450, 2000]), r: 80, color: '#e4ffb0', planets: [], light: { strength: 1.6, reach: 9000 } }, // (it lights the whole sector, out to its furthest world: lighting.js)
  // the portals between the two (portals.js): one beside the Rick and Morty
  // planet, off to the side of the way in from home, and its other end
  // beside the Citadel. Not solid: flown into, they take the ship through
  { id: 'rmportal', kind: 'portal', name: 'The Portal', at: besideRickAndMorty(), r: 10, color: '#7dff9a', solid: false, leadsTo: { sector: 'rickmorty', exit: 'rmportal-back' } },
  { id: 'rmportal-back', kind: 'portal', name: 'The Portal Home', sector: 'rickmorty', at: inSector('rickmorty', [0, 20, 420]), r: 10, color: '#7dff9a', solid: false, leadsTo: { sector: 'main', exit: 'rmportal' } },
  { id: 'lantern', kind: 'pulsar', name: 'The Lantern', at: [-6200, 300, 2600], r: 12, color: '#bfe0ff' },
  { id: 'twins', kind: 'binary', name: 'The Twins', at: [6100, -220, -1500], r: 60, color: '#ffd27a', pair: { r: 42, color: '#f4f6ff', apart: 230, period: 300 } }, // (at: the point the two go round, once in period seconds)
  { id: 'wanderer', kind: 'rogue', name: 'The Wanderer', at: [-900, -700, -6600], r: 55, ring: true, color: '#7fd8c8', colors: ['#1a2238', '#3a4a70', '#7fd8c8'] }, // (color: its auroras, for the chart and its name; colors: its rock, its accent, its auroras)
  { id: 'graveyard', kind: 'graveyard', name: 'The Graveyard', at: [-6400, 160, -1600], r: 14, color: '#dfe8ff', field: 190 },
].map(spread).map(grown);

// The trench run model (public/models/universe/trench.glb), as measured:
// its trench runs along x, 24.71 long, 6.6 wide (z −15…−8.4) and 7.1 deep
// (the rim at y 5.4, the floor at −1.7). trench.js lays it in the Death
// Star's trench (the Star Wars planet's, universes.js), `segments` sections
// all the way round (or `stretch` of them, if it says, centred on the side
// that faces home). (sunk a little into the surface, so its city blocks
// don't stand proud)
export const TRENCH_MODEL = { x: [-1.75, 22.96], z: [-15.0, -8.4], rim: 5.4, floor: -1.7, sink: 2.6 };

// a place's trench, in map units: how many sections to the ring, how many
// laid, scaled how much, how wide and deep its channel is, and the arc
// (either way round the place's middle from the way home) they cover
export function trenchOf(place) {
  const segments = place.trench.segments;
  const stretch = Math.min(place.trench.stretch ?? segments, segments);
  const scale = (2 * Math.PI * place.r) / segments / (TRENCH_MODEL.x[1] - TRENCH_MODEL.x[0]);
  const home = Math.atan2(-place.at[2], -place.at[0]);
  const arc = (stretch / segments) * Math.PI;
  return { segments, stretch, scale, width: (TRENCH_MODEL.z[1] - TRENCH_MODEL.z[0]) * scale, depth: (TRENCH_MODEL.rim + TRENCH_MODEL.sink - TRENCH_MODEL.floor) * scale, home, arc };
}

// the band a trench lets the ship into (ship.js): how far above and below
// the place's middle, how far in (the floor), and the arc it covers
export function trenchBand(place) {
  if (!place.trench) return null;
  const t = trenchOf(place);
  return { half: t.width / 2 - 0.3, floor: place.r - t.depth + 0.45, home: t.home, arc: t.arc };
}

// where a sun's planet is, in the map's space
export function planetAt(star, p) {
  return [star.at[0] + Math.cos(p.angle) * p.orbit, star.at[1], star.at[2] + Math.sin(p.angle) * p.orbit];
}

// how far a wonder's things reach out from its middle (its rings, its disk,
// its planets): nothing else is placed inside this
export function reachOf(w) {
  if (w.kind === 'star') return Math.max(w.r, ...w.planets.map((p) => p.orbit + p.r));
  if (w.kind === 'black-hole') return w.disk;
  if (w.kind === 'pulsar') return w.r * 14; // (its glare, and its beams: nobody goes near; the solid's own reach, so the ship parks at it)
  if (w.kind === 'binary') {
    // (the further either sun swings from the middle, and its own radius)
    const { ra, rb } = swings(w);
    return Math.max(ra + w.r, rb + w.pair.r);
  }
  if (w.kind === 'graveyard') return w.field; // (the hulls)
  if (w.ring) return w.r * 2.3;
  if (w.kind === 'citadel') return w.r * 1.9; // (its arms and its crystal: CITADEL_PARTS)
  return w.r;
}

// what's solid out here, as ship.js's solids: { id, at, r, reach, swallow }.
// A black hole is solid out past its shadow, where the light bends round
// it, and it swallows: nothing bounces off it, whatever the speed (ship.js)
const solid = (id, at, r, swallow = false) => ({ id, at, r, reach: r * 1.4, deep: true, ...(swallow ? { swallow } : {}) });
// The Citadel reaches past its great dome: its four saucers out on level
// arms a quarter turn apart, the hull under it and the crystal under that,
// as its model is (public/models/c137/rm/citadel-exterior.glb, which
// deepspace.js fits to a radius of 18: the dome 12.5 across its middle, the
// saucers 20.9 out) ([x, y, z, r] in those units). The first four are where
// the siege's generators stand (siege.js).
export const CITADEL_PARTS = [
  [20.25, -0.4, 5.17, 3.2],
  [-5.17, -0.4, 20.25, 3.2],
  [-20.25, -0.4, -5.17, 3.2],
  [5.17, -0.4, -20.25, 3.2],
  [0, -5, 0, 6.5],
  [0, -9.5, 0, 3.6],
  [0, -12.5, 0, 2.4],
  [0, -14.5, 0, 1.2],
];
// Its great dome, as drawn (12.5 across its middle and 5.4 high, on a hull
// 7.6 deep): solid as a core round its middle and a ring of smaller spheres
// round its rim, so it's solid where it's drawn and no further (one sphere
// round all of it had 16 of thin air solid past the rim and 40 over the
// dome: the ship bumped and scraped along nothing)
const CITADEL_DOME = { core: 7.6, ring: 9, r: 3.6, n: 8 };
const RIM = Array.from({ length: CITADEL_DOME.n }, (_, i) => {
  const a = (i / CITADEL_DOME.n) * Math.PI * 2;
  return [Math.cos(a) * CITADEL_DOME.ring, 0, Math.sin(a) * CITADEL_DOME.ring, CITADEL_DOME.r];
});
// (each a part of it: hitting one is hitting the Citadel, and none is
// somewhere of its own to fly to)
const partsOf = (w) => (w.kind === 'citadel' ? [...CITADEL_PARTS, ...RIM].map(([x, y, z, r], i) => ({ ...solid(`${w.id}-part${i + 1}`, [w.at[0] + (x * w.r) / 18, w.at[1] + (y * w.r) / 18, w.at[2] + (z * w.r) / 18], (r * w.r) / 18), part: true })) : []);
// a wonder's own solid: the Citadel's the core of its dome (but parked at,
// and minded by the autopilot, out as far as all of it), a black hole's out
// past its shadow, a pulsar's out into its glare
function bodyOf(w) {
  if (w.kind === 'citadel') return { ...solid(w.id, w.at, (CITADEL_DOME.core * w.r) / 18), reach: w.r * 1.4 };
  return solid(w.id, w.at, w.kind === 'black-hole' ? w.r * 1.5 : w.kind === 'pulsar' ? w.r * 10 : w.r, w.kind === 'black-hole');
}
// (a binary's two suns are two solids: the first is the Twins, the place to
// fly to; the second a part of it, as the Citadel's domes are, so hitting
// either is hitting the Twins; a pulsar is solid to ten radii; a wreck
// field's dwarf alone is solid, its hulls are drifting scenery)
const sunsOf = (w) => (w.kind === 'binary' ? [solid(w.id, binaryAt(w, 0).a, w.r), { ...solid(`${w.id}-2`, binaryAt(w, 0).b, w.pair.r), part: true }] : [bodyOf(w)]);
export const DEEP_SOLIDS = WONDERS.filter((w) => w.solid !== false).flatMap((w) => [...sunsOf(w), ...(w.planets ?? []).map((p, i) => solid(`${w.id}-${i + 1}`, planetAt(w, p), p.r)), ...partsOf(w)]);

// A binary's suns go round each other: round the point their masses balance
// at (as r³, so the bigger one swings round close to the middle and the
// smaller wide of it), `apart` between them all the way round, level with
// the disc, once every `pair.period` seconds. binaryAt(w, t) → { a, b }, each
// [x, y, z]; at t 0 they lie along x, the bigger short of the middle.
// moveBinaries(t) puts their solids there (ship.js's SOLIDS holds the same
// objects): the scene calls it each frame with its own clock, which stands
// still under reduced motion, so the suns do too.
function swings(w) {
  const ma = w.r ** 3;
  const mb = w.pair.r ** 3;
  return { ra: (w.pair.apart * mb) / (ma + mb), rb: (w.pair.apart * ma) / (ma + mb) };
}
export function binaryAt(w, t = 0) {
  const { ra, rb } = swings(w);
  const turn = ((t / w.pair.period) % 1) * Math.PI * 2;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return { a: [w.at[0] - c * ra, w.at[1], w.at[2] - s * ra], b: [w.at[0] + c * rb, w.at[1], w.at[2] + s * rb] };
}
const BINARIES = WONDERS.filter((w) => w.kind === 'binary').map((w) => ({ w, one: DEEP_SOLIDS.find((o) => o.id === w.id), two: DEEP_SOLIDS.find((o) => o.id === `${w.id}-2`) }));
export function moveBinaries(t) {
  for (const { w, one, two } of BINARIES) {
    const { a, b } = binaryAt(w, t);
    for (let i = 0; i < 3; i++) {
      one.at[i] = a[i];
      two.at[i] = b[i];
    }
  }
}

export const wonderById = (id) => WONDERS.find((w) => w.id === id) ?? null;
// a route param to a wonder's id (a link out to one: /universe/aurelia), or null
export const parseWonder = (param) => (typeof param === 'string' && WONDERS.some((w) => w.id === param) ? param : null);

// what's on the far side of the thing the ship fell into (the black hole's
// `beyond`: { name, what, url }), or null for anything you come back from
export const beyondOf = (id) => wonderById(id)?.beyond ?? null;

// every place there is to be at, out here and at home: the universes (the
// stations and the planets) and the wonders, each with how far it reaches
export const PLACES = [
  ...BODIES.map((id) => ({ id, at: POSITIONS[id], reach: REACH[id], kind: byId(id).kind === 'core' ? 'station' : 'planet' })),
  ...WONDERS.map((w) => ({ id: w.id, at: w.at, reach: reachOf(w), kind: w.kind })),
];
const far = PLACES.filter((p) => p.kind !== 'station'); // (the stations are the home system)

// every star on the map: the home sun, and the suns out among the wonders
// (each { id, at, r, color }: what a solar flare (director.js) comes from)
export const STARS = [{ id: 'sun', at: SUN.at, r: SUN.r, color: '#ffcf6a' }, ...WONDERS.filter((w) => w.kind === 'star').map((w) => ({ id: w.id, at: w.at, r: w.r, color: w.color }))];

// the star nearest (x, y, z), and how far its middle is
export function nearestStar(x, y, z) {
  let star = STARS[0];
  let dist = Infinity;
  for (const s of STARS) {
    const d = Math.hypot(x - s.at[0], y - s.at[1], z - s.at[2]);
    if (d < dist) {
      dist = d;
      star = s;
    }
  }
  return { star, dist };
}

// the place nearest (x, y, z), and how far past its reach it is (negative: inside)
// (it runs a few times a frame: plain square roots, and one answer made)
export function nearestPlace(x, y, z) {
  let place = null;
  let gap = Infinity;
  for (const p of far) {
    const dx = x - p.at[0];
    const dy = y - p.at[1];
    const dz = z - p.at[2];
    const g = Math.sqrt(dx * dx + dy * dy + dz * dz) - p.reach;
    if (g < gap) {
      gap = g;
      place = p;
    }
  }
  // (the home system as a ball round the sun: far above or below it is open space)
  const home = Math.sqrt(x * x + y * y + z * z) - HOME_RADIUS;
  return home < gap ? { place: null, gap: home } : { place, gap };
}

// 0 at a place (the home system, a planet, a wonder: in its space you fly at
// the boost, under the home ceiling), rising smoothly to 1 out in the open
// between them: how far it's opened up at (x, y, z). (What the ship's pulse
// drive does is driveOpen's, below; this is where it's deep space, for the
// crews, the traffic and the hunters.)
export function openness(x, y, z) {
  const { gap } = nearestPlace(x, y, z);
  const k = Math.min(1, Math.max(0, (gap - DEEP.near) / DEEP.ramp));
  return k * k * (3 - 2 * k);
}

// The pulse drive near a place: how it slows the ship coming up on one, so
// that it gets there at the boost without ever hitting a wall. It goes by
// where the ship's going, not just where it is: straight at a place it eases
// down over DRIVE.ramp (gently at first, so at pulse speed it hardly feels
// it begins, and never harder than a couple of hundred a second, a second);
// flying past one, wide of it, it barely slows at all (the gap counts
// DRIVE.wide times over for every unit the line it's on misses the place by);
// and going away from one it opens up again straight away.
export const DRIVE = { ramp: 600, wide: 4 };
// What it slows for: each planet and wonder by its reach, but a sun with
// planets of its own, and a binary, by each of its bodies (so between them,
// inside the system, it's open); and not a nebula, where there's nothing to
// hit: fly straight through on the drive. Each { at, reach } (a binary's are
// DEEP_SOLIDS' own, moved as its suns go round).
const BODIED = new Set(['star', 'binary']);
const MARKS = [
  ...far.filter((p) => p.kind === 'planet'),
  ...WONDERS.flatMap((w) => {
    if (w.solid === false) return [];
    if (BODIED.has(w.kind)) return DEEP_SOLIDS.filter((o) => o.id === w.id || o.id.startsWith(`${w.id}-`));
    return [{ at: w.at, reach: reachOf(w) }];
  }),
];
// how far past `reach` of `at` (x, y, z) is, as far as the drive's
// concerned, going the way `f` points (a unit vector; none: straight at it)
export function gapAlong(x, y, z, f, at, reach) {
  const cx = at[0] - x;
  const cy = at[1] - y;
  const cz = at[2] - z;
  const d = Math.sqrt(cx * cx + cy * cy + cz * cz);
  if (!f) return d - reach;
  const along = cx * f[0] + cy * f[1] + cz * f[2];
  const miss = along > 0 ? Math.sqrt(Math.max(0, d * d - along * along)) : d; // (going away: all of it)
  return d - reach + DRIVE.wide * Math.max(0, miss - reach);
}
// how open the drive is `gap` past where it's all the way down, 0 … 1, over
// `ramp`: easing out, so it starts to close gently and is quickest near the
// bottom, where the speeds are low
export function easeOpen(gap, ramp) {
  const t = Math.min(1, Math.max(0, gap / ramp));
  return 1 - (1 - t) * (1 - t);
}
// how open deep space's pulse drive is at (x, y, z), going the way `f` points
export function driveOpen(x, y, z, f = null) {
  let gap = Infinity;
  for (const m of MARKS) gap = Math.min(gap, gapAlong(x, y, z, f, m.at, m.reach));
  return easeOpen(gap - DEEP.near, DRIVE.ramp);
}
