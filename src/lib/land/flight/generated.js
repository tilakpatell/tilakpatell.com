// A generated planet's or moon's spec: every one that isn't among the fifty.
// It is the roster's shape (the same seventeen fields and the same extras),
// filled from the planet's own variety (./variety.js): a round ground on its
// sphere (./sphereField.js) for a rocky, icy, desert, forest, lava or ocean
// world, flown through a chart round its landing spot; a plane cloud deck,
// recoloured, for a gas giant. Its places stand on dry, gentle land, apart;
// the chart starts at the first.
//
// Pure: runs in Node and in a worker; a spec is plain data.
//
//   groundRadius(row) → metres: 15 to 60 km from the universe radius (a moon's 15)
//   POI_NAMES[kind] → what a place is called
//   generatedSpecOf(row, family) → spec (planetSpec.js's shape, buildable false)
//   chartedAt(spec, dir) → the same spec charted round dir (its POIs' `at` again)

import { fold } from './fnl.js';
import { seeded } from '../../seeded.js';
import { FIB_512 } from './characters.js';
import { CLIMATE_SPHERE, sphereField } from './sphereField.js';
import { angleBetween, chartOf, unit } from './sphere.js';
import { varietyOf } from './variety.js';
import { PLANE_CLIMATE, TYPE_BIOMES, TYPE_LOOK, expand, roundBiomes } from './planetTables.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export const groundRadius = (row) =>
  Number.isFinite(row?.radius) && !row.parent ? 15000 + 45000 * clamp((row.radius - 18) / 52, 0, 1) : 15000;

export const POI_NAMES = { ruins: 'Ruins', wreck: 'A crashed ship', outpost: 'An outpost', monolith: 'A monolith', signal: 'A signal' };

const between = (rnd, [a, b]) => a + rnd() * (b - a);
const cm = (v) => Math.round(v * 100) / 100 + 0;

// a seeded rotation (a random unit quaternion) of the first 256 Fibonacci directions, in a seeded order
function candidatesOf(seed) {
  const rnd = seeded(seed ^ 0x51ed2701);
  const [u1, u2, u3] = [rnd(), rnd(), rnd()];
  const q = [Math.sqrt(1 - u1) * Math.sin(2 * Math.PI * u2), Math.sqrt(1 - u1) * Math.cos(2 * Math.PI * u2), Math.sqrt(u1) * Math.sin(2 * Math.PI * u3), Math.sqrt(u1) * Math.cos(2 * Math.PI * u3)];
  const [x, y, z, w] = q;
  const turn = ([a, b, c]) =>
    unit([
      (1 - 2 * (y * y + z * z)) * a + 2 * (x * y - z * w) * b + 2 * (x * z + y * w) * c,
      2 * (x * y + z * w) * a + (1 - 2 * (x * x + z * z)) * b + 2 * (y * z - x * w) * c,
      2 * (x * z - y * w) * a + 2 * (y * z + x * w) * b + (1 - 2 * (x * x + y * y)) * c,
    ]);
  const dirs = FIB_512.slice(0, 256).map(turn);
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return { dirs, rnd };
}

function placesOf(spec0, kinds) {
  const f = sphereField(spec0);
  const sea = spec0.water ? spec0.water.level : -Infinity;
  const { dirs, rnd } = candidatesOf(spec0.seed);
  const gentle = new Map();
  const ok = (d) => {
    if (!gentle.has(d)) {
      const s = f.sample(d);
      gentle.set(d, s.h > sea + 4 && s.slope < 0.12);
    }
    return gentle.get(d);
  };
  const pois = [];
  for (const kind of kinds) {
    const dir = dirs.find((d) => ok(d) && pois.every((p) => angleBetween(d, p.dir) >= 0.3));
    if (!dir) continue;
    pois.push({ id: `poi-${pois.length}`, name: POI_NAMES[kind], kind, dir, r: Math.round(between(rnd, [60, 140])), edge: Math.round(between(rnd, [80, 120])) });
  }
  const at = pois[0]?.dir ?? dirs.find(ok) ?? dirs[0];
  return { pois, at };
}

const charted = (pois, chart) => pois.map((p) => ({ ...p, at: chart.toChart(p.dir).map(cm) }));

function clutterOf(family, v) {
  const d = v.flora?.density ?? 1;
  const rows = TYPE_LOOK[family].clutter.map((c) => (c.kind === 'trunk' || c.kind === 'spire' ? { ...c, perKm2: Math.round(c.perKm2 * d * 10) / 10 } : { ...c }));
  if (v.exotic === 'crystal') rows.push({ kind: 'crystal', perKm2: 25, depth: 5 });
  if ((v.exotic === 'glowing' || v.exotic === 'floating') && !rows.some((c) => c.kind === 'trunk')) rows.push({ kind: 'trunk', perKm2: 14, depth: 5 });
  if (v.exotic === 'spires') rows.push({ kind: 'spire', perKm2: 30, depth: 5, size: 1.4 });
  return rows;
}

function groundLookOf(family, v, water) {
  const g = TYPE_LOOK[family].ground;
  const palette = { ...g.palette, low: v.palette.low, high: v.palette.high, rock: v.palette.rock, accent: v.palette.accent, deep: v.palette.deep };
  if (v.character) {
    palette.hLow = (water?.level ?? 0) + 2;
    palette.hHigh = clamp(v.character.peaks * 0.5, 60, 500);
  }
  if (palette.wet) palette.wet = { ...palette.wet, level: water?.level ?? palette.wet.level };
  return { ...g, palette };
}

export function generatedSpecOf(row, family) {
  const v = varietyOf(row);
  const seed = fold(BigInt(row.seed));
  const moon = String(row.id).split(':').length === 5;
  const fog = { near: Math.round(1500 - 900 * v.sky.haze), far: Math.round(21000 - 9000 * v.sky.haze) };
  const extra = { kind: moon ? 'moon' : 'planet', parent: row.parent ?? null, buildable: false };
  const varied = { character: v.character, sky: v.sky, weather: v.weather, flora: v.flora, fauna: v.fauna, exotic: v.exotic };
  const common = { id: row.id, name: row.name, seed, type: family };
  if (!v.character) {
    // a gas giant: a plane cloud deck as it always was, in its own colours
    return {
      ...common,
      climate: PLANE_CLIMATE,
      biomes: expand(TYPE_BIOMES[family], seed),
      pois: [],
      pits: [],
      palette: v.palette,
      clutter: clutterOf(family, v),
      step: 0,
      soft: true,
      ground: groundLookOf(family, v, null),
      water: null,
      fog,
      landmarks: [],
      hero: null,
      ...extra,
      round: null,
      ...varied,
    };
  }
  const water = v.water && { kind: v.water.kind, level: 0, ...(v.water.colour ? { colour: v.water.colour } : {}) };
  const radius = groundRadius(row);
  const spec0 = { ...common, climate: CLIMATE_SPHERE, biomes: roundBiomes(family), pois: [], character: v.character, round: { radius, at: [0, 1, 0] }, water };
  const { pois, at } = placesOf(spec0, v.poiKinds);
  return {
    ...common,
    climate: CLIMATE_SPHERE,
    biomes: roundBiomes(family),
    pois: charted(pois, chartOf(at, radius)),
    pits: [],
    palette: v.palette,
    clutter: clutterOf(family, v),
    step: 0,
    soft: false,
    ground: groundLookOf(family, v, water),
    water,
    fog,
    landmarks: [],
    hero: null,
    ...extra,
    round: { radius, at },
    ...varied,
  };
}

export function chartedAt(spec, dir) {
  if (!spec?.round) return spec;
  const at = unit(dir);
  return { ...spec, round: { ...spec.round, at }, pois: charted(spec.pois, chartOf(at, spec.round.radius)) };
}
