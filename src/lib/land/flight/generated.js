// A generated planet's or moon's spec: any body of the Expanse past the
// fifty the roster flies (the endless universe's spec, section E). It's made
// from the planet's row alone: its variety (variety.js) for its colours, its
// land's character, its sky, weather, flora, fauna and places, and its round
// ground (sphereField.js), so the universe and the flight, whatever else
// they know, build the one description of it.
//
// A gas giant (gas or ringed) stays the plane cloud deck its template is,
// recoloured. Every other planet, and every moon, is round: a sphere of
// groundRadius metres, its biomes the template's places on the climate
// square (roundBiomes), its land the variety's character, its sea at 0. The
// flight flies it through the chart round `round.at` (field.js).
//
// Its places are set on the sphere. The candidates are FIB_512's first 256
// directions turned by the planet's own rotation and read in its own order;
// each kind the variety names, in turn, takes the first that's dry (4 m over
// the water), gentle (slope under 0.12) and 0.3 rad from every place already
// set, or is left out. The chart starts at the first place, or where there's
// none at the first dry, gentle candidate, so the flight begins over land;
// each place's chart `at` is read from there (chartedAt charts it again at
// any other spot, a landing's).
//
// The look is the template's, recoloured: its ground's palette swapped for
// the variety's (but a lava planet's glow and an ocean's sea, its accent,
// left off the ground), its low ground just over the water and its high
// ground at half the peaks; its trees and spires as thick as the flora; an exotic
// planet's own clutter set out on its ground (none on a cloud deck); its fog
// as thick as its sky's haze.
//
// Pure: plain data in and out, so a spec crosses to a worker.
//
//   POI_NAMES[kind] → a place's name, as the map and the HUD show it
//   groundRadius(row) → metres: 15 km to 60 km, linear in the universe radius
//     from 18 to 70; a moon's, or a row with no radius, 15 km
//   clutterOf(family, flora, exotic) → clutter rows: the template's, its
//     trunks and spires times flora.density, then the exotic's own
//   generatedSpecOf(row, family = familyOf(row.type)) → a spec with every key
//     a roster spec has (planetSpec.js's seventeen and ROSTER_EXTRA's), or null
//     for a type no family knows or a row with no whole seed
//   chartedAt(spec, dir) → the spec charted round dir: round.at and every
//     place's `at` moved, nothing else. A plane spec, or a dir that's no
//     direction, comes back as it was.

import { seeded } from '../../seeded.js';
import { FIB_512 } from './characters.js';
import { canonicalId } from './expanse.js';
import { fold } from './fnl.js';
import { PLANE_CLIMATE, TYPE_BIOMES, TYPE_LOOK, expand, familyOf, roundBiomes } from './planetTables.js';
import { angleBetween, chartOf, unit } from './sphere.js';
import { CLIMATE_SPHERE, sphereField } from './sphereField.js';
import { varietyOf } from './variety.js';

export const POI_NAMES = Object.freeze({ ruins: 'Ruins', wreck: 'A crashed ship', outpost: 'An outpost', monolith: 'A monolith', signal: 'A signal' });

// each draw its own stream off the planet's seed (no other stream in the
// flight shares a salt: variety.test.js reads them all)
const SALT = { turn: 0x8f1bbcdc, order: 0xca62c1d6, poi: 0x5a827999 };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const between = (r, lo, hi) => lo + r() * (hi - lo);

const GROUND = { least: 15000, most: 60000, from: 18, to: 70 }; // metres; the universe's radii
const CANDIDATES = 256;
const APART = 0.3; // rad between two places
const DRY = 4; // metres over the water
const GENTLE = 0.12; // the slope a place stands on, at most
const SIZE = { r: [60, 140], edge: [80, 120] };

const isMoon = (row) => row?.parent != null || canonicalId(row?.id)?.split(':').length === 5;

export function groundRadius(row) {
  if (isMoon(row) || !Number.isFinite(row?.radius)) return GROUND.least;
  return GROUND.least + (GROUND.most - GROUND.least) * clamp((row.radius - GROUND.from) / (GROUND.to - GROUND.from), 0, 1);
}

// ── the look ──

const GROWS = new Set(['trunk', 'spire']);
// (a glowing or a floating planet's trees, where its template has none)
const EXOTIC_ROWS = {
  crystal: { kind: 'crystal', perKm2: 25, depth: 5 },
  spires: { kind: 'spire', perKm2: 30, depth: 5, size: 1.4 },
  glowing: { kind: 'trunk', perKm2: 14, depth: 5 },
  floating: { kind: 'trunk', perKm2: 14, depth: 5 },
};
const deck = (family) => family === 'gas' || family === 'ringed';

export function clutterOf(family, flora, exotic) {
  const rows = TYPE_LOOK[family].clutter.map((c) => (flora && GROWS.has(c.kind) ? { ...c, perKm2: c.perKm2 * flora.density } : { ...c }));
  const own = !deck(family) && EXOTIC_ROWS[exotic];
  if (!own) return rows;
  // two rows of a kind at one depth are seeded alike (leafMesh.js), so they'd
  // stand on each other: the exotic's takes the template's place, and a
  // glowing or floating planet that has trees keeps its own
  const at = rows.findIndex((c) => c.kind === own.kind && c.depth === own.depth);
  if (at < 0) return [...rows, { ...own }];
  if (own.kind === 'trunk') return rows;
  return rows.map((c, i) => (i === at ? { ...own } : c));
}

const COLOURS = ['low', 'high', 'rock', 'accent', 'deep'];
// a lava planet's accent is its glow and an ocean's its sea: neither is a
// colour for patches of ground, so theirs keep the template's
const OWN_ACCENT = new Set(['lava', 'ocean']);

// the template's ground, in the variety's colours. A round planet's low
// ground starts just over its water and its high ground at half its peaks;
// a wet band keeps its colour and its width at the water's level. A cloud
// deck has only the colours its template's has.
function groundOf(family, colours, water, character) {
  const g = TYPE_LOOK[family].ground;
  const palette = { ...g.palette };
  for (const k of COLOURS) if ((character || k in palette) && !(k === 'accent' && OWN_ACCENT.has(family))) palette[k] = colours[k];
  if (character) {
    palette.hLow = (water?.level ?? 0) + 2;
    palette.hHigh = clamp(character.peaks * 0.5, 60, 500);
    if (palette.wet) palette.wet = { ...palette.wet, level: water?.level ?? palette.wet.level };
  }
  return { ...g, palette };
}

// ── the places ──

// a rotation drawn evenly over all of them: a unit quaternion from three
// draws (Shoemake's), as its matrix
function turnOf(r) {
  const u1 = r();
  const u2 = r();
  const u3 = r();
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  const x = a * Math.sin(TAU * u2);
  const y = a * Math.cos(TAU * u2);
  const z = b * Math.sin(TAU * u3);
  const w = b * Math.cos(TAU * u3);
  const m = [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
  // (+ 0, so no −0 is left in a spec)
  return ([px, py, pz]) => unit([m[0] * px + m[1] * py + m[2] * pz + 0, m[3] * px + m[4] * py + m[5] * pz + 0, m[6] * px + m[7] * py + m[8] * pz + 0]);
}

function shuffled(n, r) {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// the places on a spec with none yet, and the spot its chart starts at.
// A candidate is read once (its height first, its slope only if it's dry),
// however many kinds look at it.
function placesOf(bare, kinds, seed) {
  const turn = turnOf(seeded(seed ^ SALT.turn));
  const candidates = shuffled(CANDIDATES, seeded(seed ^ SALT.order)).map((i) => turn(FIB_512[i]));
  const field = sphereField(bare);
  const floor = bare.water ? bare.water.level + DRY : -Infinity;
  const fits = new Map();
  const fit = (i) => {
    if (!fits.has(i)) {
      const d = candidates[i];
      fits.set(i, field.heightAt(d) > floor && field.sample(d).slope < GENTLE);
    }
    return fits.get(i);
  };
  const r = seeded(seed ^ SALT.poi);
  const pois = [];
  for (const kind of kinds) {
    // (drawn whether it's placed or not, so one left out moves no other's size)
    const size = { r: Math.round(between(r, ...SIZE.r)), edge: Math.round(between(r, ...SIZE.edge)) };
    for (let i = 0; i < candidates.length; i++) {
      const d = candidates[i];
      if (pois.some((p) => angleBetween(d, p.dir) < APART) || !fit(i)) continue;
      pois.push({ id: `poi-${pois.length}`, name: POI_NAMES[kind], kind, dir: [...d], ...size });
      break;
    }
  }
  const start = pois[0]?.dir ?? candidates.find((_, i) => fit(i)) ?? candidates[0];
  return { pois, at: [...start] };
}

// each place's chart spot round `at`, to the centimetre (+ 0: no −0)
const cm = (v) => Math.round(v * 100) / 100 + 0;
function charted(pois, at, radius) {
  const { toChart } = chartOf(at, radius);
  return pois.map(({ id, name, kind, dir, r, edge }) => ({ id, name, kind, dir, at: toChart(dir).map(cm), r, edge }));
}

export function chartedAt(spec, dir) {
  if (!spec?.round || !Array.isArray(dir) || dir.length !== 3 || !dir.every(Number.isFinite)) return spec;
  const u = unit(dir);
  if (!(u[0] || u[1] || u[2])) return spec;
  const at = [u[0], u[1], u[2]];
  return { ...spec, round: { ...spec.round, at }, pois: charted(spec.pois, at, spec.round.radius) };
}

// ── the spec ──

export function generatedSpecOf(row, family = familyOf(row?.type)) {
  if (!Object.hasOwn(TYPE_BIOMES, family)) return null;
  const v = varietyOf(row);
  if (!v) return null;
  const id = canonicalId(row.id) ?? row.id;
  const moon = id.split(':').length === 5;
  const seed = fold(BigInt(row.seed));
  const round = !deck(family);
  const water = round && v.water ? { kind: v.water.kind, level: 0, ...(v.water.colour ? { colour: v.water.colour } : {}) } : null;
  const spec = {
    id,
    name: row.name,
    seed,
    type: family,
    climate: round ? CLIMATE_SPHERE : PLANE_CLIMATE,
    biomes: round ? roundBiomes(family) : expand(TYPE_BIOMES[family], seed),
    pois: [],
    pits: [],
    palette: v.palette,
    clutter: clutterOf(family, v.flora, v.exotic),
    step: 0,
    soft: !round,
    ground: groundOf(family, v.palette, water, round ? v.character : null),
    water,
    fog: { near: Math.round(1500 - 900 * v.sky.haze), far: Math.round(21000 - 9000 * v.sky.haze) },
    landmarks: [],
    hero: null,
    kind: moon ? 'moon' : 'planet',
    parent: moon ? id.slice(0, id.lastIndexOf(':')) : null,
    buildable: false,
    round: null,
    character: v.character,
    sky: v.sky,
    weather: v.weather,
    flora: v.flora,
    fauna: v.fauna,
    exotic: v.exotic,
  };
  if (!round) return spec;
  const radius = groundRadius(row);
  const { pois, at } = placesOf({ ...spec, round: { radius, at: FIB_512[0] } }, v.poiKinds, seed);
  return { ...spec, round: { radius, at }, pois: charted(pois, at, radius) };
}
