// A planet's orbit map: the small equirectangular picture the universe's
// planet wears from orbit and the on-foot biome lookup reads (the endless
// universe's spec, “Orbit matches ground”), baked from the very ground the
// flight flies, so what's seen from orbit is what's landed on.
//
// Each texel is coloured as the flight's ground shader colours the ground
// there (lib/three/groundLook.js), at the mean of its noises: the palette by
// height, its accent over a share of it, rock on the slopes, darker by the
// water, and under the water the water's sheet over it (expanse/flight/
// water.js), each mixed in linear light and written as sRGB bytes. Its alpha
// is 0 under water and 255 elsewhere; `biome` is the heaviest biome's index.
//
// The map's layout is sphere.js's (the landings' and three's SphereGeometry):
// texel (i, j) is dirOfUv((i + 0.5) / width, (j + 0.5) / height), its top
// row the north pole. There are three kinds of planet:
//   - round (a generated one): its ground on the sphere (sphereField.js), the
//     same height, slope and biome the flight reads at a chart's middle;
//   - a gas giant (gas or ringed, a plane cloud deck): bands across it, its
//     palette's low and high in turn, broken by a 3D noise, its accent where
//     the noise runs strong (the storms), biome 0;
//   - any other plane (the named worlds, the seeded thirteen): a window of
//     its plane round the flight's start, PLANE_WINDOW metres across and half
//     that down, which doesn't meet itself at the map's edges (the spec
//     accepts the seam).
//
// Never stored (the spec): orbitMaps.js keeps a few in memory.
//
// Pure: runs in Node and in a worker.
//
//   ORBIT_MAP_SIZE[tier] → [width, height]; orbitMapSize(tier) → { width, height },
//     mid's for a tier it doesn't know
//   PLANE_WINDOW → metres of a plane planet's ground across its map
//   groundColour(spec, { h, slope: 0…1 (1 − normal.y) }) → { rgb: [r, g, b]
//     sRGB bytes, water: under the water }
//   bakeOrbitMap(spec, { width = 256, height = 128 }) → { width, height,
//     rgba: Uint8ClampedArray, biome: Uint8Array } | null (no spec). A size
//     that isn't a whole number from 1 to 4096 is the usual one.

import { smoothstep } from '../../noise.js';
import { seeded } from '../../seeded.js';
import { planetField } from './field.js';
import { noise3For } from './fnl.js';
import { WATER_LOOKS, byteOf, linearOf, waterLinearOf } from './planetTables.js';
import { dirOfUv } from './sphere.js';
import { SLOPE_STEP, sphereField } from './sphereField.js';

export const ORBIT_MAP_SIZE = Object.freeze({ low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] });
export const PLANE_WINDOW = 40000;

export function orbitMapSize(tier) {
  const [width, height] = Object.hasOwn(ORBIT_MAP_SIZE, tier) ? ORBIT_MAP_SIZE[tier] : ORBIT_MAP_SIZE.mid;
  return { width, height };
}

// the bands' count, its own stream off the planet's seed (variety.test.js
// holds every salt in the flight's lib apart)
const SALT = { bands: 0x6c62272e };
const BANDS = [6, 11];
const STORM = 0.55;
const LARGEST = 4096;

const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
// the first of the colours that's a colour, in linear light (grey if none is)
const colourOf = (...cs) => linearOf(cs.find(isHex) ?? '#808080');
const mixInto = (out, a, b, t) => {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
};

// what the shader reads of a spec, once a bake: its uniforms' defaults
// (groundLook.js's), ground.js's fallback where it has no ground look, and
// its water's sheet, if it has one, as water.js draws it
function lookOf(spec) {
  const p = spec.ground?.palette ?? { ...spec.palette, hLow: 0, hHigh: 120 };
  const wet = p.wet?.level ?? -1e4;
  const w = spec.water;
  const sheet = w && Object.hasOwn(WATER_LOOKS, w.kind) ? WATER_LOOKS[w.kind] : null;
  let water = null;
  if (sheet && Number.isFinite(w.level)) {
    const own = isHex(w.colour) ? w.colour : sheet.color;
    const c = waterLinearOf({ ...w, colour: own }, isHex(spec.palette?.accent) ? spec.palette.accent : own);
    // lava glows: its colour is mostly its glow, and nothing shows through it
    water = sheet.glow ? { level: w.level, colour: mixInto([0, 0, 0], c, linearOf(sheet.glow), 0.6), opacity: 1 } : { level: w.level, colour: c, opacity: sheet.opacity };
  }
  return {
    low: colourOf(p.low),
    high: colourOf(p.high, p.low),
    // (at the mean of its strata, 0.78 + 0.4 × 0.5)
    rock: colourOf(p.rock, p.low).map((v) => v * 0.98),
    accent: colourOf(p.accent, p.high, p.low),
    hLow: p.hLow ?? 0,
    hHigh: p.hHigh ?? 30,
    rockAt: p.rockAt ?? 0.42,
    cover: p.accentCover ?? 0,
    wet: wet >= -9999 ? { level: wet, band: p.wet.band ?? 1.5, colour: colourOf(p.wet.color, '#000000') } : null,
    water,
  };
}

// the shader's colour rule, into `c` (linear); true under the water
function shade(look, h, slope, c) {
  mixInto(c, look.low, look.high, smoothstep(look.hLow, look.hHigh, h));
  mixInto(c, c, look.accent, look.cover * 0.5);
  mixInto(c, c, look.rock, smoothstep(look.rockAt, look.rockAt + 0.14, slope));
  if (look.wet) mixInto(c, c, look.wet.colour, (1 - smoothstep(look.wet.level, look.wet.level + look.wet.band, h)) * 0.75);
  const under = look.water !== null && h < look.water.level;
  if (under) mixInto(c, c, look.water.colour, look.water.opacity);
  return under;
}

export function groundColour(spec, { h, slope }) {
  const c = [0, 0, 0];
  const water = shade(lookOf(spec), h, slope, c);
  return { rgb: c.map(byteOf), water };
}

// ── the three kinds ──

const slopeOf = (gx, gz) => 1 - 1 / Math.hypot(1, gx, gz);

// each a function of a texel's (u, v), into `c`: → { water, biome }
function roundTexel(spec, look) {
  const ground = sphereField(spec);
  return (u, v, c) => {
    const s = ground.sample(dirOfUv(u, v));
    return { water: shade(look, s.h, s.slope, c), biome: s.biome };
  };
}

function bandsTexel(spec) {
  const p = spec.palette ?? spec.ground?.palette ?? {};
  const low = colourOf(p.low);
  const high = colourOf(p.high, p.low);
  const accent = colourOf(p.accent, p.high, p.low);
  const n = noise3For(spec.seed, { frequency: 2.2, octaves: 4, warp: 0.25 });
  const B = BANDS[0] + (BANDS[1] - BANDS[0]) * seeded(spec.seed ^ SALT.bands)();
  const flat = { water: false, biome: 0 };
  return (u, v, c) => {
    const [x, y, z] = dirOfUv(u, v);
    const k = n(x, y, z);
    if (Math.abs(k) > STORM) [c[0], c[1], c[2]] = accent;
    else mixInto(c, low, high, 0.5 * Math.sin((y * B + 0.6 * k) * Math.PI) + 0.5);
    return flat;
  };
}

function planeTexel(spec, look) {
  const g = planetField(spec);
  const s = SLOPE_STEP;
  return (u, v, c) => {
    const x = (u - 0.5) * PLANE_WINDOW;
    const z = (v - 0.5) * (PLANE_WINDOW / 2);
    const gx = (g.heightAt(x + s, z) - g.heightAt(x - s, z)) / (2 * s);
    const gz = (g.heightAt(x, z + s) - g.heightAt(x, z - s)) / (2 * s);
    return { water: shade(look, g.heightAt(x, z), slopeOf(gx, gz), c), biome: g.biomeAt(x, z) };
  };
}

const whole = (v, usual) => (Number.isInteger(v) && v >= 1 && v <= LARGEST ? v : usual);

export function bakeOrbitMap(spec, { width, height } = {}) {
  if (!spec || typeof spec !== 'object') return null;
  const W = whole(width, ORBIT_MAP_SIZE.mid[0]);
  const H = whole(height, ORBIT_MAP_SIZE.mid[1]);
  const look = lookOf(spec);
  const texel = spec.round ? roundTexel(spec, look) : spec.type === 'gas' || spec.type === 'ringed' ? bandsTexel(spec) : planeTexel(spec, look);
  const rgba = new Uint8ClampedArray(W * H * 4);
  const biome = new Uint8Array(W * H);
  const c = [0, 0, 0];
  for (let j = 0; j < H; j++) {
    const v = (j + 0.5) / H;
    for (let i = 0; i < W; i++) {
      const t = texel((i + 0.5) / W, v, c);
      const k = j * W + i;
      rgba[k * 4] = byteOf(c[0]);
      rgba[k * 4 + 1] = byteOf(c[1]);
      rgba[k * 4 + 2] = byteOf(c[2]);
      rgba[k * 4 + 3] = t.water ? 0 : 255;
      biome[k] = t.biome;
    }
  }
  return { width: W, height: H, rgba, biome };
}
