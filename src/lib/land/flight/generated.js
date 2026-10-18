// A generated planet's or moon's spec, from its row alone: everything a
// roster spec has, built on its variety (variety.js) instead of its family's
// template. The fifty never come here (planetSpec.js keeps them on their old
// paths); every other Expanse planet and moon does.
//
// - Round or plane. A landable family's ground is round: sphereField.js's,
//   on a sphere sized from the universe radius, flown through the chart round
//   `round.at` (field.js). A gas giant, ringed or not, stays the plane cloud
//   deck it was, in its own colours: there's no ground to put on a sphere.
// - The look. The family's template ground (TYPE_LOOK) keeps its scan and
//   its grain, and takes the variety's colours; its heights follow the
//   character's peaks, so the rock shows on the ridges and not on the plains.
// - Places. Each of the variety's POI kinds takes the first of 256 seeded
//   candidates that is dry, gentle and 0.3 rad from every place already
//   there: the first half of FIB_512 (a hemisphere, evenly), turned by a
//   seeded rotation and read in a seeded order, so a planet's places are its
//   own and a kind that finds no spot is left out. The chart starts at the
//   first place, so a ship lands beside it.
// - Charts. A POI's `at` is where the current chart puts it (what the
//   flight's flats, clutter and occurrences read); chartedAt makes the chart
//   again round another spot, as a landing far from the first place will.
//
// A spec is plain data (it's posted to the terrain and orbit-map workers):
// every number finite, no −0, nothing undefined.
//
// Pure: runs in Node and in a worker.
//
//   groundRadius(row) → metres: 15,000 to 60,000, linear in the universe radius
//     from 18 to 70 and clamped; 15,000 for a moon or a row with no radius
//   POI_NAMES[kind] → a place's name, by its kind
//   generatedSpecOf(row, family) → spec (planetSpec.js's seventeen fields and ROSTER_EXTRA's)
//   chartedAt(spec, dir) → the round spec charted round dir; a plane spec as it is

import { seeded } from '../../seeded.js';
import { parseSpaceId } from '../../space/address.js';
import { FIB_512 } from './characters.js';
import { canonicalId } from './expanse.js';
import { fold } from './fnl.js';
import { hash64 } from './hash.js';
import { PLANE_CLIMATE, TYPE_BIOMES, TYPE_LOOK, expand, roundBiomes } from './planetTables.js';
import { angleBetween, chartOf, unit } from './sphere.js';
import { CLIMATE_SPHERE, sphereField } from './sphereField.js';
import { varietyOf } from './variety.js';

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const isMoon = (id) => {
  const c = canonicalId(id);
  return Boolean(c) && parseSpaceId(c).moon !== undefined;
};

export function groundRadius(row) {
  if (isMoon(row.id) || !Number.isFinite(row.radius)) return 15000;
  return 15000 + 45000 * clamp((row.radius - 18) / 52, 0, 1);
}

export const POI_NAMES = { ruins: 'Ruins', wreck: 'A crashed ship', outpost: 'An outpost', monolith: 'A monolith', signal: 'A signal' };

// ── the look ──

// the template's clutter, its trees and spires as thick as the flora (a
// giant has no flora, and its spires are cloud: they stay); then, on ground
// only, what the exotic stands on it
function clutterOf(family, flora, exotic, round) {
  const density = flora ? flora.density : 1;
  const rows = TYPE_LOOK[family].clutter.map((c) => (c.kind === 'trunk' || c.kind === 'spire' ? { ...c, perKm2: c.perKm2 * density } : { ...c }));
  if (!round) return rows;
  if (exotic === 'crystal') rows.push({ kind: 'crystal', perKm2: 25, depth: 5 });
  // (a glowing or floating world's trees are what glows or floats)
  if ((exotic === 'glowing' || exotic === 'floating') && !rows.some((c) => c.kind === 'trunk')) rows.push({ kind: 'trunk', perKm2: 14 });
  if (exotic === 'spires') rows.push({ kind: 'spire', perKm2: 30, depth: 5, size: 1.4 });
  return rows;
}

// the template's ground in the variety's colours; on a round planet its
// heights are the character's (the rock from half its peaks up) and its wet
// band sits at the water's level (a band with no water under it would draw
// a shore on dry land, so it goes)
function groundOf(family, palette, character, water, round) {
  const look = TYPE_LOOK[family].ground;
  const { low, high, rock, accent, deep } = palette;
  if (!round) return { ...look, palette: { ...look.palette, low, high, rock, accent, deep } };
  const { wet, ...rest } = look.palette;
  return {
    ...look,
    palette: {
      ...rest,
      low,
      high,
      rock,
      accent,
      deep,
      hLow: (water?.level ?? 0) + 2,
      hHigh: clamp(character.peaks * 0.5, 60, 500),
      ...(wet && water ? { wet: { ...wet, level: water.level } } : {}),
    },
  };
}

const fogOf = (haze) => ({ near: Math.round(1500 - 900 * haze), far: Math.round(21000 - 9000 * haze) });

// ── the places ──

const PLACES = fold(hash64('generated', 'pois'));
const CANDIDATES = 256;
// a place stands on ground this far over the water, and no steeper
const DRY = 4;
const GENTLE = 0.12;
// radians between two places
const APART = 0.3;

// 0…n−1, Fisher–Yates
function shuffle(n, rnd) {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// a rotation drawn evenly over all rotations (a unit quaternion, Shoemake's
// three draws), as the matrix that turns a direction
function rotationOf(rnd) {
  const u1 = rnd();
  const u2 = rnd() * 2 * Math.PI;
  const u3 = rnd() * 2 * Math.PI;
  const a = Math.sqrt(1 - u1);
  const b = Math.sqrt(u1);
  const [x, y, z, w] = [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

// (+ 0: no −0 in a spec, which JSON would bring back as 0)
const turn = (m, d) => unit(m.map((row) => row[0] * d[0] + row[1] * d[1] + row[2] * d[2] + 0));

// The places, and where the chart starts: each kind takes the first
// candidate that is dry, gentle and apart, and the chart starts at the first
// place, else at the first dry, gentle candidate, else the first candidate.
// A candidate's sample is read once, whichever kind asks.
function placesOf(spec0, kinds) {
  const rnd = seeded(spec0.seed ^ PLACES);
  const m = rotationOf(rnd);
  const dirs = shuffle(CANDIDATES, rnd).map((i) => turn(m, FIB_512[i]));
  const field = sphereField(spec0);
  const floor = (spec0.water?.level ?? -Infinity) + DRY;
  const good = new Map();
  const isGood = (i) => {
    if (!good.has(i)) {
      const s = field.sample(dirs[i]);
      good.set(i, s.h > floor && s.slope < GENTLE);
    }
    return good.get(i);
  };
  const pois = [];
  for (const kind of kinds) {
    // (drawn whether or not the kind finds a spot, so one left out moves no other)
    const r = Math.round(60 + 80 * rnd());
    const edge = Math.round(80 + 40 * rnd());
    for (let i = 0; i < dirs.length; i++) {
      if (pois.some((p) => angleBetween(p.dir, dirs[i]) < APART) || !isGood(i)) continue;
      pois.push({ id: `poi-${pois.length}`, name: POI_NAMES[kind], kind, dir: dirs[i], r, edge });
      break;
    }
  }
  if (pois.length) return { pois, origin: pois[0].dir };
  for (let i = 0; i < dirs.length; i++) if (isGood(i)) return { pois, origin: dirs[i] };
  return { pois, origin: dirs[0] };
}

// ── the spec ──

export function generatedSpecOf(row, family) {
  const v = varietyOf(row);
  const seed = fold(BigInt(row.seed));
  const moon = isMoon(row.id);
  const round = family !== 'gas' && family !== 'ringed';
  const water = round && v.water ? { kind: v.water.kind, level: 0, ...(v.water.colour ? { colour: v.water.colour } : {}) } : null;
  const spec = {
    id: row.id,
    name: row.name,
    seed,
    type: family,
    climate: round ? CLIMATE_SPHERE : PLANE_CLIMATE,
    biomes: round ? roundBiomes(family) : expand(TYPE_BIOMES[family], seed),
    pois: [],
    pits: [],
    palette: v.palette,
    clutter: clutterOf(family, v.flora, v.exotic, round),
    step: 0,
    soft: !round,
    ground: groundOf(family, v.palette, v.character, water, round),
    water,
    fog: fogOf(v.sky.haze),
    landmarks: [],
    hero: null,
    kind: moon ? 'moon' : 'planet',
    parent: row.parent ?? null,
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
  // (sphereField reads the radius, not the spot: the spot waits on the places)
  const spec0 = { ...spec, round: { radius: groundRadius(row), at: FIB_512[0] } };
  const { pois, origin } = placesOf(spec0, v.poiKinds);
  return chartedAt({ ...spec0, pois }, origin);
}

// a POI's place on the chart, to the centimetre
const chartAt = (chart, dir) => chart.toChart(dir).map((x) => Math.round(x * 100) / 100 + 0);

export function chartedAt(spec, dir) {
  if (!spec.round) return spec;
  const at = unit(dir);
  const chart = chartOf(at, spec.round.radius);
  return { ...spec, round: { ...spec.round, at }, pois: spec.pois.map((p) => ({ ...p, at: chartAt(chart, p.dir) })) };
}
