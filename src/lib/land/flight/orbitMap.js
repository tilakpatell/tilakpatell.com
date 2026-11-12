// A planet's map as seen from orbit: an equirectangular image of the very
// ground the flight flies over, so what you see from space is what you walk
// on. Each texel is the ground at the chart's middle there, coloured by the
// flight's ground rule (lib/three/groundLook.js, at the mean of its noises:
// height between the palette's low and high, the accent's patches, rock
// where it is steep, wet by the water's edge), with the water over it.
//
// Three kinds of spec: a round one (a generated planet's: its sphere, ./sphereField.js);
// a gas giant (bands, as a cloud deck's plane is one colour); any other plane
// (the fifty: a window of its plane round the flight's origin, its edges not
// meeting, which is accepted).
//
// The layout is ./sphere.js's (the landings', three's SphereGeometry): u from
// −x round toward +z, v 0 at the north pole. Bytes are sRGB, mixed in linear
// light; alpha is 0 under water, 255 elsewhere. Never stored: ./orbitMaps.js
// keeps a few in memory.
//
// Pure: runs in Node and in a worker.
//
//   ORBIT_MAP_SIZE[tier] → [width, height]; orbitMapSize(tier) → { width, height } (mid's when unknown)
//   PLANE_WINDOW → metres across u of a plane planet's window (half that across v)
//   groundColour(spec, { h, slope }) → { rgb: [r, g, b] (0…255 sRGB), water: boolean }
//   bakeOrbitMap(spec, { width = 256, height = 128 }) → { width, height, rgba: Uint8ClampedArray, biome: Uint8Array }

import { planetField } from './field.js';
import { noise3For } from './fnl.js';
import { dirOfUv } from './sphere.js';
import { SLOPE_STEP, sphereField } from './sphereField.js';
import { WATER_LOOKS } from './planetTables.js';
import { seeded } from '../../seeded.js';

export const ORBIT_MAP_SIZE = { low: [256, 128], mid: [256, 128], high: [512, 256], ultra: [512, 256] };
export const orbitMapSize = (tier) => {
  const [width, height] = ORBIT_MAP_SIZE[tier] ?? ORBIT_MAP_SIZE.mid;
  return { width, height };
};
export const PLANE_WINDOW = 40000;

// ── colour, in linear light ──
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const cache = new Map();
function lin(hex) {
  let c = cache.get(hex);
  if (!c) {
    c = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
    cache.set(hex, c);
  }
  return c;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const bytes = (c) => c.map((v) => Math.round(Math.min(1, Math.max(0, toSrgb(Math.min(1, Math.max(0, v))))) * 255));
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// groundLook's noises at their mean: nBig = nMid = 0.5
const MEAN_PATCH = 0.5 * 0.7 + 0.5 * 0.45;

// a spec with no colours of its own (a hand-made one) bakes grey rather than throwing
const GREY = { low: '#6f6a64', high: '#a39383', rock: '#5c544c', accent: '#8a7f73' };

function looksOf(spec) {
  const palette = { ...GREY, ...(spec.palette ?? {}) };
  const p = { ...palette, ...(spec.ground?.palette ?? { hLow: 0, hHigh: 120 }) };
  const w = spec.water && WATER_LOOKS[spec.water.kind];
  return {
    low: lin(p.low),
    high: lin(p.high),
    rock: lin(p.rock).map((v) => v * 0.98),
    accent: p.accent ? lin(p.accent) : null,
    hLow: p.hLow ?? 0,
    hHigh: p.hHigh ?? 30,
    rockAt: p.rockAt ?? 0.42,
    cover: p.accentCover ?? 0,
    wet: p.wet ? { level: p.wet.level, band: p.wet.band ?? 1.5, colour: lin(p.wet.color ?? '#000000') } : null,
    water: w && {
      level: spec.water.level,
      lava: Boolean(w.glow),
      opacity: w.opacity,
      colour: mix(lin(spec.water.colour ?? w.color), lin(palette.accent), 0.15),
      glow: w.glow ? lin(w.glow) : null,
    },
  };
}

function colourWith(L, h, slope) {
  let c = mix(L.low, L.high, smoothstep(L.hLow, L.hHigh, h));
  if (L.accent && L.cover > 0.001) c = mix(c, L.accent, smoothstep(1 - L.cover, 1 - L.cover + 0.12, MEAN_PATCH));
  c = mix(c, L.rock, smoothstep(L.rockAt, L.rockAt + 0.14, slope));
  if (L.wet) c = mix(c, L.wet.colour, (1 - smoothstep(L.wet.level, L.wet.level + L.wet.band, h)) * 0.75);
  const w = L.water;
  if (w && h < w.level) return { rgb: bytes(w.lava ? mix(w.colour, w.glow, 0.6) : mix(c, w.colour, w.opacity)), water: true };
  return { rgb: bytes(c), water: false };
}

const looks = new WeakMap();
const looksFor = (spec) => {
  let L = looks.get(spec);
  if (!L) looks.set(spec, (L = looksOf(spec)));
  return L;
};

export const groundColour = (spec, { h, slope }) => colourWith(looksFor(spec), h, slope);

function bands(spec) {
  const n = noise3For(spec.seed, { frequency: 2.2, octaves: 4, warp: 0.25 });
  const B = 6 + seeded(spec.seed ^ 0x6a09e667)() * 5;
  const p = { ...GREY, ...(spec.palette ?? {}) };
  const low = lin(p.low);
  const high = lin(p.high);
  const accent = lin(p.accent);
  return (dir) => {
    const v = n(dir[0], dir[1], dir[2]);
    const t = Math.sin((dir[1] * B + 0.6 * v) * Math.PI);
    const c = Math.abs(v) > 0.55 ? accent : mix(low, high, 0.5 * t + 0.5);
    return { rgb: bytes(c), water: false, biome: 0 };
  };
}

function planeWindow(spec) {
  const g = planetField(spec);
  const s = SLOPE_STEP;
  return (dir, u, v) => {
    const x = (u - 0.5) * PLANE_WINDOW;
    const z = (v - 0.5) * (PLANE_WINDOW / 2);
    const h = g.heightAt(x, z);
    const gx = (g.heightAt(x + s, z) - g.heightAt(x - s, z)) / (2 * s);
    const gz = (g.heightAt(x, z + s) - g.heightAt(x, z - s)) / (2 * s);
    return { ...groundColour(spec, { h, slope: 1 - 1 / Math.hypot(1, gx, gz) }), biome: g.biomeAt(x, z) };
  };
}

function sphereOf(spec) {
  const f = sphereField(spec);
  return (dir) => {
    const s = f.sample(dir);
    return { ...groundColour(spec, s), biome: s.biome };
  };
}

export function bakeOrbitMap(spec, { width = 256, height = 128 } = {}) {
  const at = spec.round ? sphereOf(spec) : spec.type === 'gas' || spec.type === 'ringed' ? bands(spec) : planeWindow(spec);
  const rgba = new Uint8ClampedArray(width * height * 4);
  const biome = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    const v = (j + 0.5) / height;
    for (let i = 0; i < width; i++) {
      const u = (i + 0.5) / width;
      const t = at(dirOfUv(u, v), u, v);
      const k = j * width + i;
      rgba[k * 4] = t.rgb[0];
      rgba[k * 4 + 1] = t.rgb[1];
      rgba[k * 4 + 2] = t.rgb[2];
      rgba[k * 4 + 3] = t.water ? 0 : 255;
      biome[k] = t.biome;
    }
  }
  return { width, height, rgba, biome };
}
