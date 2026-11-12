// What makes a generated planet its own: its colours, its land's character,
// its sky, weather, flora, fauna, a rare exotic touch and the kinds of place
// on it. A function of the planet's row alone (no sibling is read), so the
// universe and the flight, with any siblings known or none, describe the same
// planet (the endless universe's spec, section E).
//
// Siblings never look alike: a planet's dominant colour is one slot of its
// family's table, chosen by its index in its system through a shuffle seeded
// by the system, so two siblings of one family take different slots; the
// table keeps every family's slots apart, so siblings of two families do
// too. In the systems the roster's seeded planets sit in, the generated ones
// take only the slots clear of their seeded siblings' template colours.
//
// Each aspect draws from its own stream (the planet's seed xor a salt), so a
// new aspect never moves another.
//
// Pure: runs in Node and in a worker.
//
//   FAMILIES[family] → { slots: [[hue°, lightness]…], sat: [lo, hi] }
//   SLOT_JITTER → { hue, light }: how far a planet's colour strays from its slot
//   colourDistance([h, l], [h, l]) → hypot(Δh/15, Δl/0.08), Δh round the circle
//   dominantOf(palette, water = null) → [h, l] of the mix of low and high (or the water's colour)
//   varietyOf(row) → { family, dominant, palette, water, character, sky, weather, flora,
//     fauna, exotic, poiKinds }

import { fold } from './fnl.js';
import { hash64 } from './hash.js';
import { seeded } from '../../seeded.js';
import { canonicalId } from './expanse.js';
import { SEEDED_EXPANSE, TYPE_LOOK, familyOf } from './planetTables.js';
import { TERRAIN } from './characters.js';

// ── colour ──
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrapHue = (h) => ((h % 360) + 360) % 360;

export function hexOf(h, s, l) {
  h = wrapHue(h);
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function hslOf([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [wrapHue(h * 60), s, l];
}

export function colourDistance([h1, l1], [h2, l2]) {
  const dh = Math.abs(wrapHue(h1 - h2));
  return Math.hypot(Math.min(dh, 360 - dh) / 15, (l1 - l2) / 0.08);
}

export function dominantOf(palette, water = null) {
  if (water?.colour) {
    const [h, , l] = hslOf(rgbOf(water.colour));
    return [h, l];
  }
  const a = rgbOf(palette.low);
  const b = rgbOf(palette.high);
  const [h, , l] = hslOf(a.map((v, i) => (v + b[i]) / 2));
  return [h, l];
}

// ── the slots ──
const grid = (hues, lights) => hues.flatMap((h) => lights.map((l) => [h, l]));
const GAS = { slots: [...grid([266, 289, 312], [0.55, 0.67]), ...grid([20, 42], [0.94])], sat: [0.25, 0.55] };
export const FAMILIES = {
  lava: { slots: grid([335, 0, 25, 50], [0.1, 0.21]), sat: [0.15, 0.35] },
  rock: { slots: grid([335, 0, 25, 50], [0.33, 0.45]), sat: [0.1, 0.45] },
  desert: { slots: grid([20, 42, 64], [0.58, 0.7, 0.82]), sat: [0.35, 0.6] },
  forest: { slots: grid([85, 108, 131, 154], [0.26, 0.38]), sat: [0.3, 0.55] },
  ocean: { slots: grid([178, 200, 222, 244], [0.28, 0.4]), sat: [0.4, 0.7] },
  ice: { slots: grid([178, 200, 222, 244], [0.8, 0.92]), sat: [0.15, 0.45] },
  gas: GAS,
  ringed: GAS,
};
export const SLOT_JITTER = { hue: 2, light: 0.01 };
const JITTER = Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08);

// one stream an aspect
const SALT = { palette: 0x1f3a5b7d, character: 0x2c4e6a80, sky: 0x3d5f7b91, weather: 0x4e608ca2, flora: 0x5f719db3, fauna: 0x6082aec4, exotic: 0x7193bfd5, poi: 0x82a4c0e6, water: 0x93b5d1f7 };
const streamOf = (row, aspect) => seeded(fold(BigInt(row.seed)) ^ SALT[aspect]);
const between = (rnd, [a, b]) => a + rnd() * (b - a);
function weighted(rnd, table) {
  const entries = Object.entries(table);
  let r = rnd() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [k, w] of entries) if ((r -= w) < 0) return k;
  return entries[entries.length - 1][0];
}

function shuffled(n, seed) {
  const rnd = seeded(fold(seed));
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SEEDED_BY_SYSTEM = new Map();
for (const [id, type] of SEEDED_EXPANSE) {
  const key = id.slice(0, id.lastIndexOf(':'));
  if (!SEEDED_BY_SYSTEM.has(key)) SEEDED_BY_SYSTEM.set(key, []);
  SEEDED_BY_SYSTEM.get(key).push(dominantOf(TYPE_LOOK[type].palette, TYPE_LOOK[type].water));
}

// the planet's slot, from its id alone: [h, l] before the jitter
function slotOf(id, family) {
  const key = id.slice(0, id.lastIndexOf(':'));
  const index = Number(id.slice(id.lastIndexOf(':') + 1));
  const seededHere = SEEDED_BY_SYSTEM.get(key) ?? [];
  let slots = FAMILIES[family].slots;
  let at = index;
  if (seededHere.length && id.split(':').length === 4) {
    slots = slots.filter((s) => seededHere.every((t) => colourDistance(s, t) >= 1 + 2 * JITTER));
    at = index - seededHere.length;
  }
  const perm = shuffled(slots.length, hash64('slots', key));
  return slots[perm[((at % slots.length) + slots.length) % slots.length]];
}

// ── the tables ──
const CHARACTER_WEIGHTS = {
  rock: { craters: 3, mesas: 2, canyons: 2, ridges: 1, plateaus: 1 },
  ice: { ridges: 2, plateaus: 2, continents: 2, craters: 1 },
  desert: { dunes: 3, mesas: 2, canyons: 2, plateaus: 1 },
  forest: { continents: 3, ridges: 1, plateaus: 1, archipelago: 1 },
  lava: { ridges: 2, craters: 2, canyons: 1, continents: 1 },
  ocean: { archipelago: 3, continents: 2 },
};
// hue, [skyLow L, S], [skyHigh L, S], haze, clouds
const SKIES = {
  ice: { hue: [195, 215], low: [0.88, 0.3], high: [0.62, 0.45], haze: [0.1, 0.4], clouds: [0.2, 0.5], cloud: '#f2f4f6' },
  desert: { hue: [200, 215], low: [0.82, 0.45], high: [0.58, 0.5], haze: [0.2, 0.5], clouds: [0, 0.2], cloud: '#d8c4a0' },
  forest: { hue: [190, 210], low: [0.86, 0.35], high: [0.55, 0.55], haze: [0.1, 0.35], clouds: [0.3, 0.7], cloud: '#f2f4f6' },
  ocean: { hue: [185, 205], low: [0.88, 0.35], high: [0.55, 0.6], haze: [0.1, 0.3], clouds: [0.4, 0.8], cloud: '#f2f4f6' },
  lava: { hue: [10, 25], low: [0.32, 0.55], high: [0.1, 0.5], haze: [0.6, 0.9], clouds: [0.1, 0.3], cloud: '#5a5048' },
  rock: { hue: 'ground', low: [0.7, 0.25], high: [0.4, 0.3], haze: [0.2, 0.5], clouds: [0, 0.1], cloud: '#d8c4a0' },
  gas: { hue: 'dominant', low: [0.85, 0.4], high: [0.6, 0.5], haze: [0.4, 0.7], clouds: [0.7, 1], cloud: 'high' },
};
const WEATHER = {
  ice: { snow: 3, none: 2 },
  desert: { dust: 3, none: 2 },
  lava: { ash: 4, none: 1 },
  forest: { rain: 3, spores: 1, none: 2 },
  ocean: { rain: 3, none: 2 },
  rock: { dust: 1, none: 3 },
  gas: { none: 1 },
};
const FLORA = {
  forest: [['forest', [0.8, 1.6]], ['temperate', [0.6, 1.2]]],
  ocean: [['ocean', [0.4, 1]]],
  desert: [['desert', [0.1, 0.5]]],
  ice: [['ice', [0, 0.3]]],
  lava: [['volcanic', [0, 0.3]]],
  rock: [['desert', [0, 0.2]]],
};
const FAUNA_DENSITY = { ice: [1, [0.3, 1]], desert: [1, [0.2, 0.8]], forest: [1, [0.6, 1.4]], ocean: [1, [0.4, 1]], rock: [0.2, [0.2, 0.5]], lava: [0.1, [0.2, 0.4]] };
const BODIES = { beast: ['herd', [4, 8]], flyer: ['flock', [4, 8]], walker: ['wander', [1, 3]] };
export const EXOTICS = ['crystal', 'glowing', 'floating', 'spires'];
const POI_COUNT = { 0: 1, 1: 3, 2: 3, 3: 2 };
const POI_KINDS = { ruins: 3, wreck: 2, outpost: 2, monolith: 1, signal: 2 };

function paletteOf(family, [h, l], rnd) {
  const s = between(rnd, FAMILIES[family].sat);
  if (family === 'ocean') {
    // its land is sand, drawn from the desert's range; its accent is its water
    const sh = between(rnd, [20, 64]);
    const ss = between(rnd, FAMILIES.desert.sat);
    const sl = between(rnd, [0.58, 0.82]);
    const water = hexOf(h, s, l);
    return { low: hexOf(sh, ss, sl - 0.05), high: hexOf(sh + 6, 0.9 * ss, sl + 0.05), rock: hexOf(sh + 10, 0.6 * ss, 0.6 * sl), accent: water, deep: hexOf(sh, ss, 0.7 * sl) };
  }
  const accent = {
    lava: () => hexOf(between(rnd, [15, 35]), 1, 0.55),
    forest: () => hexOf(h + 25, s + 0.1, l + 0.12),
    desert: () => hexOf(h - 12, s, l - 0.1),
    rock: () => hexOf(h + 15, s, l + 0.15),
    ice: () => hexOf(h, s, l - 0.08),
  }[family] ?? (() => hexOf(h + 40, s, l));
  return { low: hexOf(h, s, l - 0.05), high: hexOf(h + 6, 0.9 * s, l + 0.05), rock: hexOf(h + 10, 0.6 * s, 0.6 * l), accent: accent(), deep: hexOf(h, s, 0.7 * l) };
}

function waterOf(family, palette, row) {
  if (family === 'ocean') return { kind: 'sea', colour: palette.accent };
  if (family === 'forest') {
    const rnd = streamOf(row, 'water');
    return { kind: 'sea', colour: hexOf(between(rnd, [195, 215]), 0.45, 0.3) };
  }
  if (family === 'lava') return { kind: 'lava' };
  return null;
}

function skyOf(family, row, palette, dominant) {
  const t = SKIES[family === 'ringed' ? 'gas' : family];
  const rnd = streamOf(row, 'sky');
  const hue = t.hue === 'ground' ? dominant[0] + between(rnd, [-15, 15]) : t.hue === 'dominant' ? dominant[0] + 20 : between(rnd, t.hue);
  const low = hexOf(hue, t.low[1], t.low[0]);
  const high = hexOf(hue, t.high[1], t.high[0]);
  return {
    low,
    high,
    haze: between(rnd, t.haze),
    clouds: between(rnd, t.clouds),
    cloudColour: t.cloud === 'high' ? palette.high : t.cloud,
    rings: Boolean(row.rings),
    moons: row.moons ?? 0,
  };
}

function faunaOf(family, row, palette) {
  const d = FAUNA_DENSITY[family];
  if (!d) return null;
  const rnd = streamOf(row, 'fauna');
  const density = rnd() < d[0] ? between(rnd, d[1]) : 0;
  const bodies = Object.keys(BODIES);
  const n = 1 + Math.floor(rnd() * 3);
  const plans = [];
  for (let i = 0; i < n; i++) {
    const body = bodies.splice(Math.floor(rnd() * bodies.length), 1)[0];
    const [role, group] = BODIES[body];
    plans.push({ body, role, tint: rnd() < 0.5 ? palette.rock : palette.accent, group });
  }
  return { density, plans };
}

function poiKindsOf(family, row) {
  if (family === 'gas' || family === 'ringed') return [];
  const rnd = streamOf(row, 'poi');
  const count = Number(weighted(rnd, POI_COUNT));
  const weights = { ...POI_KINDS };
  const held = row.system?.faction?.id && row.system.faction.id !== 'independent';
  if (held) weights.outpost *= 2;
  if (row.system?.hazard === 'pirates') weights.wreck *= 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const k = weighted(rnd, weights);
    out.push(k);
    delete weights[k];
  }
  return out;
}

export function varietyOf(row) {
  const id = canonicalId(row.id) ?? String(row.id).toLowerCase();
  const family = row.type === 'ringed' ? 'ringed' : familyOf(row.type);
  const palRnd = streamOf(row, 'palette');
  const slot = slotOf(id, family);
  const dominant = [wrapHue(slot[0] + (palRnd() * 2 - 1) * SLOT_JITTER.hue), slot[1] + (palRnd() * 2 - 1) * SLOT_JITTER.light];
  const palette = paletteOf(family, dominant, palRnd);
  const water = waterOf(family, palette, row);
  const charRnd = streamOf(row, 'character');
  const kind = CHARACTER_WEIGHTS[family] ? weighted(charRnd, CHARACTER_WEIGHTS[family]) : null;
  const character = kind && { kind, sea: between(charRnd, TERRAIN[kind].sea), peaks: between(charRnd, TERRAIN[kind].peaks) };
  const sky = skyOf(family, row, palette, dominant);
  palette.skyLow = sky.low;
  palette.skyHigh = sky.high;
  const exRnd = streamOf(row, 'exotic');
  const exotic = exRnd() < 0.05 ? EXOTICS[Math.floor(exRnd() * EXOTICS.length)] : null;
  const wRnd = streamOf(row, 'weather');
  const weather = exotic === 'glowing' ? { kind: 'spores', amount: between(wRnd, [0.2, 1]) } : { kind: weighted(wRnd, WEATHER[family === 'ringed' ? 'gas' : family]), amount: between(wRnd, [0.2, 1]) };
  if (weather.kind === 'none') weather.amount = 0;
  const fl = FLORA[family];
  let flora = null;
  if (fl) {
    const rnd = streamOf(row, 'flora');
    const [fam, range] = fl[Math.floor(rnd() * fl.length)];
    flora = { family: fam, density: between(rnd, range), pick: rnd() };
  }
  return { family, dominant, palette, water, character, sky, weather, flora, fauna: faunaOf(family, row, palette), exotic, poiKinds: poiKindsOf(family, row) };
}
