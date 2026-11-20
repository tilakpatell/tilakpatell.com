// A generated planet's or moon's look in space: the galaxy body shader's
// LOOKS shape (galaxy/bodies.js), made from the planet's own variety
// (./variety.js) and a stream of its own, so every one of them is its own
// world, and the world in orbit is the one on the ground: its colours, its
// land's character (sea, peaks, craters, mesas, canyons, dunes, islands),
// its cloud cover and colour and its sky's tint are the flight's. A gas
// giant's bands, turbulence and storm are seeded here. The shader's noise is
// offset by the look's name, the planet's id, so no two share a pattern.
//
// Each family keeps the atmosphere and clouds its old fixed look had
// (near.js's TYPE_LOOK), so a planet draws the calls it drew before, and its
// flags come from a short list a family (FLAG_SETS), so the shader variants
// stay few enough to warm.
//
// Pure: plain data, no three.js; runs in Node and in a worker.
//
//   FLAG_SETS[family] → the flag lists a look of that shader family may carry
//   planetLook(row) → a LOOKS entry: { name, swatch, family, bump, flags, pal, p, clouds?, atmo? }
//     row: a planet's or moon's row (id, seed, type, rings, moons, parent for a moon, …)
//   swatchOf(look) → '#rrggbb': the look's mean colour from far off (the far layer's disc)
//   lookDistance(a, b) → how far apart two looks are (0 the same; a family apart is 100)
//   planetRowOf(p), moonRowOf(m, p) → the row a look reads, from a sector's planet and moon
//     (the fields of a planet's row a look reads)
//   planetSwatch(p) → planetLook(planetRowOf(p)).swatch, kept on the sector's row (a WeakMap)

import { fold } from './hash64.js';
import { seeded } from '../seeded.js';
import { hexOf, varietyOf } from './variety.js';

export const FLAG_SETS = {
  lush: [[], ['ISLANDS'], ['RIVERS']],
  desert: [[], ['CRATERS']],
  ice: [[]],
  lava: [[]],
  gas: [[]],
  moon: [[]],
};

const SALT = 0xa4c6e208;

export const planetRowOf = (p) => ({ id: p.id.toLowerCase(), type: p.type, seed: String(p.seed), radius: p.radius, moons: typeof p.moons === 'number' ? p.moons : (p.moons?.length ?? 0), rings: Boolean(p.rings) });
export const moonRowOf = (m, p) => ({ id: m.id.toLowerCase(), type: m.type, seed: String(m.seed), radius: m.radius, parent: p.id.toLowerCase() });
const swatches = new WeakMap();
export function planetSwatch(p) {
  let c = swatches.get(p);
  if (!c) swatches.set(p, (c = planetLook(planetRowOf(p)).swatch));
  return c;
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const between = (rnd, a, b) => a + rnd() * (b - a);

// ── colour ──
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const hexRgb = (c) => `#${c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, '0')).join('')}`;
function hslOf(hex) {
  const [r, g, b] = rgbOf(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
// a colour turned dh degrees, its saturation and lightness moved by ds and dl
const turn = (hex, dh = 0, ds = 0, dl = 0) => {
  const [h, s, l] = hslOf(hex);
  return hexOf(h + dh, s + ds, l + dl);
};
const mix = (a, b, t) => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return hexRgb(x.map((v, i) => v + (y[i] - v) * t));
};
const scale = (hex, k) => hexRgb(rgbOf(hex).map((v) => v * k));

const air = (color, density, top, sunset, falloff = 3.5, glow = 0.8) => ({ color, top, falloff, density, glow, sunset });

// the shader family a planet type is drawn by
const SHADER = { forest: 'lush', ocean: 'lush', ice: 'ice', desert: 'desert', rock: 'desert', lava: 'lava', gas: 'gas', ringed: 'gas' };

function gasLook(v, rnd, base) {
  const P = v.palette;
  // (the bands round the planet's own colours, warmed or cooled together, with a pale one and a
  // dark one for contrast; the generator's slots for giants are pale or violet, so the bands spread
  // the hue round them without moving the dominant colour that keeps siblings apart)
  const warm = between(rnd, -40, 40);
  const pale = mix('#efe4d2', P.high, 0.55);
  const stormy = rnd() < 0.85;
  const glow = v.exotic === 'glowing';
  return {
    ...base,
    family: 'gas',
    bump: 0.002,
    pal: {
      band1: turn(P.low, warm * 0.5, -0.08, -0.06),
      band2: turn(pale, warm),
      band3: turn(P.high, warm, -0.1, 0.02),
      band4: turn(P.deep, warm * 0.3, 0, -0.14),
      band5: turn(P.accent, -warm, -0.1, 0.06),
      storm: glow ? turn(P.accent, 0, 0.3, 0.2) : turn(P.accent, 30, -0.2, 0.1),
    },
    p: {
      bands: Math.round(between(rnd, 5, 18)),
      turb: between(rnd, 0.6, 1.3),
      flow: between(rnd, 0.002, 0.007),
      fine: between(rnd, 0.7, 1.6),
      stormSize: stormy ? between(rnd, 0.03, 0.08) : 0,
      stormLat: between(rnd, -0.6, 0.6),
      stormLon: between(rnd, 0, Math.PI * 2),
    },
    atmo: air(mix(P.high, '#ffffff', 0.2), 2 + v.sky.haze, 1.03, '#ff8a6a'),
  };
}

function lavaLook(v, rnd, base, cloud) {
  const P = v.palette;
  return {
    ...base,
    family: 'lava',
    bump: 0.024,
    // (the crust and ash its own, dark; the melt kept to the reds and oranges that read as hot)
    pal: { crust: turn(P.low, 0, -0.1, -0.03), ash: turn(P.high, 0, -0.15, 0.05), hot: hexOf(between(rnd, 32, 52), 1, between(rnd, 0.68, 0.8)), lava: turn('#ff4a10', between(rnd, -14, 22)), ember: turn('#a01808', between(rnd, -8, 14), 0, between(rnd, -0.06, 0.06)) },
    p: { rivers: between(rnd, 0.4, 1), lakes: between(rnd, 0.05, 0.8), glow: between(rnd, 0.5, 1), pulse: between(rnd, 0.1, 1) },
    clouds: cloud(0.1 + 0.3 * v.sky.clouds),
    atmo: air(mix(P.accent, '#402018', 0.55), 1.2 + 0.5 * v.sky.haze, 1.05, '#ff5020'),
  };
}

function lushLook(v, rnd, base, cloud, atmo, ch) {
  const P = v.palette;
  const water = v.water?.colour ?? '#1c4a6a';
  const ocean = v.family === 'ocean';
  const islands = ch.kind === 'archipelago';
  const rain = v.weather.kind === 'rain';
  return {
    ...base,
    family: 'lush',
    bump: 0.02,
    flags: islands ? ['ISLANDS'] : rain ? ['RIVERS'] : [],
    pal: {
      deep: scale(water, 0.55),
      shallow: turn(water, -6, 0, 0.08),
      forest: ocean ? P.rock : P.low,
      grass: P.high,
      rock: P.rock,
      snow: '#eef2f4',
      beach: ocean ? P.low : mix(P.high, '#c8b88a', 0.6),
      murk: scale(P.low, 0.7),
    },
    p: {
      sea: (ch.sea - 0.5) * 0.8,
      forest: v.flora ? Math.min(1.3, v.flora.density) : 0.2,
      mountains: Math.min(1, ch.peaks / 900),
      caps: between(rnd, 0, 0.12),
      islands: islands ? between(rnd, 0.2, 0.5) : 0,
      swamp: 0,
      rivers: rain && !islands ? between(rnd, 0.3, 1) : 0,
      scale: between(rnd, 1.9, 2.8),
    },
    clouds: cloud(v.sky.clouds),
    atmo,
  };
}

function desertLook(v, rnd, base, cloud, atmo, ch) {
  const P = v.palette;
  const craters = ch.kind === 'craters' ? between(rnd, 0.5, 1) : between(rnd, 0, 0.25);
  const has = (k) => (ch.kind === k ? 1 : between(rnd, 0, 0.45));
  return {
    ...base,
    family: 'desert',
    bump: 0.024,
    flags: craters > 0.4 ? ['CRATERS'] : [],
    pal: { sand: P.low, sand2: P.high, rock: P.rock, dark: P.deep, salt: turn(P.high, 0, -0.2, 0.2), crest: turn(P.high, 0, 0, 0.08) },
    p: { dunes: has('dunes'), rock: between(rnd, -0.1, 0.2), craters, salt: between(rnd, 0, 0.7), scars: 0, duneFreq: between(rnd, 28, 52), canyons: has('canyons'), mesas: has('mesas') },
    // (a rock world's old look, a dusty moon's, had no air and no cloud: it keeps none, and draws as it did)
    ...(v.family === 'rock' ? {} : { clouds: v.sky.clouds > 0.05 ? cloud(v.sky.clouds) : undefined, atmo }),
  };
}

function iceLook(v, rnd, base, cloud, atmo, ch) {
  const P = v.palette;
  return {
    ...base,
    family: 'ice',
    bump: 0.02,
    pal: { snow: mix(P.high, '#ffffff', 0.35), ice: P.low, rock: P.rock, deep: P.deep },
    p: { ice: between(rnd, 0.2, 0.7), mountains: Math.min(1, ch.peaks / 900), crevasses: between(rnd, 0.3, 1) },
    clouds: cloud(v.sky.clouds),
    atmo,
  };
}

function moonLook(v, rnd, base) {
  const P = v.palette;
  return {
    ...base,
    family: 'moon',
    bump: 0.03,
    pal: { base: mix(P.low, P.high, 0.5), dark: scale(P.low, 0.75), bright: turn(P.high, 0, -0.05, 0.08), crack: scale(P.rock, 0.7) },
    p: { craters: between(rnd, 0.4, 1), maria: between(rnd, 0.1, 0.6), cracks: v.family === 'ice' ? between(rnd, 0.4, 1) : between(rnd, 0, 0.2) },
  };
}

const memo = new Map();
const MEMO = 4096;

export function planetLook(row) {
  const key = `${row.id}|${row.seed}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const v = varietyOf(row);
  const rnd = seeded(fold(BigInt(row.seed)) ^ SALT);
  const base = { name: String(row.id), swatch: v.palette.low, bump: 0.022, flags: [] };
  const cloud = (cover) => ({ cover, sharp: between(rnd, 1.2, 2), drift: between(rnd, 0.002, 0.006), scale: between(rnd, 2.6, 5.2), color: v.sky.cloudColour });
  const atmo = air(mix(v.sky.high, v.sky.low, 0.35), 1.6 + 1.4 * v.sky.haze, 1.045 + 0.03 * v.sky.haze, mix('#ff9a60', v.sky.low, 0.3));
  const ch = v.character ?? { kind: 'craters', sea: 0, peaks: 300, rough: 1 };
  let look;
  if (row.parent) look = moonLook(v, rnd, base);
  else {
    const family = SHADER[row.type] ?? 'desert';
    if (family === 'gas') look = gasLook(v, rnd, base);
    else if (family === 'lava') look = lavaLook(v, rnd, base, cloud);
    else if (family === 'lush') look = lushLook(v, rnd, base, cloud, atmo, ch);
    else if (family === 'ice') look = iceLook(v, rnd, base, cloud, atmo, ch);
    else look = desertLook(v, rnd, base, cloud, atmo, ch);
  }
  if (!look.clouds) delete look.clouds;
  if (!look.atmo) delete look.atmo;
  look.swatch = swatchOf(look);
  if (memo.size >= MEMO) memo.delete(memo.keys().next().value);
  memo.set(key, look);
  return look;
}

// the mean of what shows from far off: its sea and land by how much sea, its bands, its crust
// and melt, its clouds over it by their cover
export function swatchOf(look) {
  const p = look.pal;
  let c;
  if (look.family === 'gas') c = mix(mix(p.band1, p.band2, 0.5), mix(p.band3, p.band4, 0.5), 0.5);
  else if (look.family === 'lush') c = mix(mix(p.forest, p.grass, 0.5), mix(p.deep, p.shallow, 0.4), clamp(0.5 + look.p.sea, 0.1, 0.9));
  else if (look.family === 'lava') c = mix(mix(p.crust, p.ash, 0.4), p.lava, 0.12 * (look.p.rivers + look.p.lakes));
  else if (look.family === 'ice') c = mix(p.snow, p.ice, 0.4);
  else if (look.family === 'moon') c = p.base;
  else c = mix(p.sand, p.sand2, 0.5);
  if (look.clouds) c = mix(c, look.clouds.color, 0.6 * look.clouds.cover);
  return c;
}

// (colours by their distance in RGB, a unit a just-seen step; the params by their share of a range)
const colourGap = (a, b) => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 20;
};
export function lookDistance(a, b) {
  if (a.family !== b.family) return 100;
  let d = 0;
  for (const k of Object.keys(a.pal)) d += colourGap(a.pal[k], b.pal[k]);
  for (const k of Object.keys(a.p)) {
    const span = Math.max(1e-6, Math.abs(a.p[k]) + Math.abs(b.p[k]));
    d += (2 * Math.abs(a.p[k] - b.p[k])) / span;
  }
  d += 4 * Math.abs((a.clouds?.cover ?? 0) - (b.clouds?.cover ?? 0));
  if (String(a.flags) !== String(b.flags)) d += 2;
  return d;
}
