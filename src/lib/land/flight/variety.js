// What makes one generated planet or moon its own, from its row alone: its
// colours, the character of its land, its sky, weather, flora and fauna, a
// rare exotic and the kinds of its places. generated.js builds its spec on it.
//
// - Streams. Each aspect draws from a stream of its own, the planet's folded
//   seed xor that aspect's salt, so a draw added to one aspect never moves
//   another.
// - The palette slot. A family's colours are slots, [hue°, lightness], every
//   one far enough from every other, in its family and across them, that two
//   jittered slots still stand 1 apart (FAMILIES; the test holds the gap). A
//   planet's index in its system (a moon's in its planet) picks its slot
//   through a shuffle seeded by the system, so two siblings of one family
//   take two slots, and siblings of two families sit apart by the table.
//   No sibling row is read, so the variety is the row's alone: one planet,
//   one description, whichever lookup found it.
// - Seeded systems. In sector (1, 0) the seeded planets hold their system's
//   first indices; a generated sibling picks from its family's slots clear
//   of their template colours, at its index past them. SEEDED_EXPANSE names
//   them and their types, so that too reads no row.
// - The dominant colour is the planet's slot, jittered: the colour its
//   palette is built round (an ocean's, its water). It's the slot itself and
//   not dominantOf measured back off the palette because the hex rounds (a
//   pale ice slot or a dark lava one at saturation 0.15 moves 8° to 10° of
//   hue a step of 8-bit RGB) and `high` leans 6° round, so the measured mix
//   strays past the jitter from its slot (by up to 0.7 on a dark lava); the
//   guarantee is made on the slot. dominantOf measures the seeded planets'
//   template palettes, which have no slot.
//
// Pure: runs in Node and in a worker.
//
//   FAMILIES[family] → { slots: [[hue°, lightness]…], sat: [lo, hi] } (ringed is gas's)
//   SLOT_JITTER = { hue: degrees, light }: how far a planet's own stream nudges its slot
//   colourDistance([h1, l1], [h2, l2]) → hypot(Δh°/15, Δl/0.08), Δh the short way round
//   dominantOf(palette, water = null) → [h°, l]: the mix of `low` and `high`, or `water.colour`
//   varietyOf(row) → { family, dominant: [h°, l], palette, water, character, sky, weather,
//     flora, fauna, exotic, poiKinds }

import { seeded } from '../../seeded.js';
import { parseSpaceId } from '../../space/address.js';
import { TERRAIN } from './characters.js';
import { canonicalId } from './expanse.js';
import { fold } from './fnl.js';
import { hash64 } from './hash.js';
import { SEEDED_EXPANSE, TYPE_LOOK, familyOf } from './planetTables.js';

// ── the palette slots ──

const grid = (hues, lights) => lights.flatMap((l) => hues.map((h) => [h, l]));

export const FAMILIES = {
  lava: { slots: grid([335, 0, 25, 50], [0.1, 0.21]), sat: [0.15, 0.35] },
  rock: { slots: grid([335, 0, 25, 50], [0.33, 0.45]), sat: [0.1, 0.45] },
  desert: { slots: grid([20, 42, 64], [0.58, 0.7, 0.82]), sat: [0.35, 0.6] },
  forest: { slots: grid([85, 108, 131, 154], [0.26, 0.38]), sat: [0.3, 0.55] },
  // an ocean's slot is its water's colour
  ocean: { slots: grid([178, 200, 222, 244], [0.28, 0.4]), sat: [0.4, 0.7] },
  ice: { slots: grid([178, 200, 222, 244], [0.8, 0.92]), sat: [0.15, 0.45] },
  // violet bands, and two pale cream decks above desert's
  gas: { slots: [...grid([266, 289, 312], [0.55, 0.67]), [20, 0.94], [42, 0.94]], sat: [0.25, 0.55] },
};
FAMILIES.ringed = FAMILIES.gas;

export const SLOT_JITTER = { hue: 2, light: 0.01 };
// the farthest the jitter moves a slot, and how far a slot must sit from a
// seeded sibling's colour so a generated planet stays 1 from it
const REACH = Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08);
const CLEAR = 1 + 2 * REACH;

export function colourDistance([h1, l1], [h2, l2]) {
  const d = Math.abs(h1 - h2) % 360;
  return Math.hypot(Math.min(d, 360 - d) / 15, (l1 - l2) / 0.08);
}

// ── colour ──

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const wrap = (h) => ((h % 360) + 360) % 360;
const hex2 = (c) => Math.round(clamp01(c) * 255).toString(16).padStart(2, '0');

function hsl(h, s, l) {
  const hh = wrap(h);
  const ss = clamp01(s);
  const ll = clamp01(l);
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n) => {
    const k = (n + hh / 30) % 12;
    return ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${hex2(f(0))}${hex2(f(8))}${hex2(f(4))}`;
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

// [h°, s, l]; a grey's hue is 0
function hslOf([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [wrap(h * 60), d / (1 - Math.abs(2 * l - 1)), l];
}

export function dominantOf(palette, water = null) {
  let rgb;
  if (water?.colour) rgb = rgbOf(water.colour);
  else {
    const hi = rgbOf(palette.high);
    rgb = rgbOf(palette.low).map((c, i) => (c + hi[i]) / 2);
  }
  const [h, , l] = hslOf(rgb);
  return [h, l];
}

// ── draws ──

const ASPECTS = ['slot', 'palette', 'water', 'character', 'sky', 'weather', 'flora', 'fauna', 'exotic', 'pois'];
const SALT = Object.fromEntries(ASPECTS.map((a) => [a, fold(hash64('variety', a))]));

const between = (rnd, [a, b]) => a + rnd() * (b - a);

// a value from [[value, weight]…]
function pick(rnd, rows) {
  let x = rnd() * rows.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of rows) if ((x -= w) < 0) return v;
  return rows[rows.length - 1][0];
}

// 0…n−1, Fisher–Yates
function shuffle(n, rnd) {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── the slot ──

const keyOf = (id) => id.slice(0, id.lastIndexOf(':'));

// each seeded system's template colours, its seeded planets in index order
const SEEDED_COLOURS = new Map();
for (const [id, type] of SEEDED_EXPANSE) {
  const key = keyOf(id);
  if (!SEEDED_COLOURS.has(key)) SEEDED_COLOURS.set(key, []);
  SEEDED_COLOURS.get(key).push(dominantOf(TYPE_LOOK[type].palette));
}

function slotOf(id, family, rnd) {
  const canon = canonicalId(id);
  const a = canon && parseSpaceId(canon);
  // (an id that's no planet's or moon's has no siblings to keep from: index 0)
  const key = a ? keyOf(canon) : String(id);
  let index = a ? (a.moon ?? a.planet) : 0;
  let slots = FAMILIES[family].slots;
  const held = SEEDED_COLOURS.get(key);
  if (held) {
    const clear = slots.filter((s) => held.every((c) => colourDistance(s, c) >= CLEAR));
    // (all thirteen leave every family several; should none be clear, the
    // family's own slots still keep the generated siblings apart)
    if (clear.length) slots = clear;
    index -= held.length;
  }
  const perm = shuffle(slots.length, seeded(fold(hash64('slots', key))));
  // An index past the end of the list wraps round it, and so does one below
  // 0 (a seeded planet's own id). Neither comes from the generator: a family
  // has 8 or more slots against 1–7 planets or 0–6 moons, and a seeded
  // system's clear list keeps 4 or more for the 4 places past its 3.
  const n = slots.length;
  const [h, l] = slots[perm[((index % n) + n) % n]];
  return [wrap(h + (2 * rnd() - 1) * SLOT_JITTER.hue), l + (2 * rnd() - 1) * SLOT_JITTER.light];
}

// ── the palette and the water ──

const spanOf = (slots, i) => [Math.min(...slots.map((s) => s[i])), Math.max(...slots.map((s) => s[i]))];
// an ocean's sand: desert's hues, lightnesses and saturations
const SAND = { hue: spanOf(FAMILIES.desert.slots, 0), light: spanOf(FAMILIES.desert.slots, 1), sat: FAMILIES.desert.sat };

const ACCENTS = {
  lava: (h, s, l, rnd) => hsl(between(rnd, [15, 35]), 1, 0.55),
  forest: (h, s, l) => hsl(h + 25, s + 0.1, l + 0.12),
  desert: (h, s, l) => hsl(h - 12, s, l - 0.1),
  rock: (h, s, l) => hsl(h + 15, s, l + 0.15),
  ice: (h, s, l) => hsl(h, s, l - 0.08),
  gas: (h, s, l) => hsl(h + 40, s, l),
  ringed: (h, s, l) => hsl(h + 40, s, l),
  // the water itself
  ocean: (h, s, l) => hsl(h, s, l),
};

function paletteOf(family, [h, l], rnd) {
  const s = between(rnd, FAMILIES[family].sat);
  const accent = ACCENTS[family](h, s, l, rnd);
  // an ocean's ground is its sand; everything else's is its slot
  const [gh, gs, gl] = family === 'ocean' ? [between(rnd, SAND.hue), between(rnd, SAND.sat), between(rnd, SAND.light)] : [h, s, l];
  return {
    s,
    low: hsl(gh, gs, gl - 0.05),
    high: hsl(gh + 6, 0.9 * gs, gl + 0.05),
    rock: hsl(h + 10, 0.6 * s, 0.6 * l),
    accent,
    deep: hsl(h, s, 0.7 * l),
  };
}

function waterOf(family, [h, l], s, rnd) {
  if (family === 'ocean') return { kind: 'sea', colour: hsl(h, s, l) };
  if (family === 'forest') return { kind: 'sea', colour: hsl(between(rnd, [195, 215]), 0.45, 0.3) };
  if (family === 'lava') return { kind: 'lava' };
  return null;
}

// ── the land ──

const CHARACTER_WEIGHTS = {
  rock: [['craters', 3], ['mesas', 2], ['canyons', 2], ['ridges', 1], ['plateaus', 1]],
  ice: [['ridges', 2], ['plateaus', 2], ['continents', 2], ['craters', 1]],
  desert: [['dunes', 3], ['mesas', 2], ['canyons', 2], ['plateaus', 1]],
  forest: [['continents', 3], ['ridges', 1], ['plateaus', 1], ['archipelago', 1]],
  lava: [['ridges', 2], ['craters', 2], ['canyons', 1], ['continents', 1]],
  ocean: [['archipelago', 3], ['continents', 2]],
};

function characterOf(family, rnd) {
  const rows = CHARACTER_WEIGHTS[family];
  if (!rows) return null;
  const kind = pick(rnd, rows);
  return { kind, sea: between(rnd, TERRAIN[kind].sea), peaks: between(rnd, TERRAIN[kind].peaks) };
}

// ── the sky ──

// hue: a range, or one round the ground's; low and high: [lightness, saturation]
const SKIES = {
  ice: { hue: [195, 215], low: [0.88, 0.3], high: [0.62, 0.45], haze: [0.1, 0.4], clouds: [0.2, 0.5], cloud: '#f2f4f6' },
  desert: { hue: [200, 215], low: [0.82, 0.45], high: [0.58, 0.5], haze: [0.2, 0.5], clouds: [0, 0.2], cloud: '#d8c4a0' },
  forest: { hue: [190, 210], low: [0.86, 0.35], high: [0.55, 0.55], haze: [0.1, 0.35], clouds: [0.3, 0.7], cloud: '#f2f4f6' },
  ocean: { hue: [185, 205], low: [0.88, 0.35], high: [0.55, 0.6], haze: [0.1, 0.3], clouds: [0.4, 0.8], cloud: '#f2f4f6' },
  lava: { hue: [10, 25], low: [0.32, 0.55], high: [0.1, 0.5], haze: [0.6, 0.9], clouds: [0.1, 0.3], cloud: '#5a5048' },
  rock: { hue: (h) => [h - 15, h + 15], low: [0.7, 0.25], high: [0.4, 0.3], haze: [0.2, 0.5], clouds: [0, 0.1], cloud: '#d8c4a0' },
  // a giant's clouds are its bands' own high colour
  gas: { hue: (h) => [h + 20, h + 20], low: [0.85, 0.4], high: [0.6, 0.5], haze: [0.4, 0.7], clouds: [0.7, 1], cloud: null },
};
SKIES.ringed = SKIES.gas;

function skyOf(family, [h], high, row, rnd) {
  const k = SKIES[family];
  const hue = between(rnd, typeof k.hue === 'function' ? k.hue(h) : k.hue);
  return {
    low: hsl(hue, k.low[1], k.low[0]),
    high: hsl(hue, k.high[1], k.high[0]),
    haze: between(rnd, k.haze),
    clouds: between(rnd, k.clouds),
    cloudColour: k.cloud ?? high,
    rings: Boolean(row.rings),
    moons: row.moons ?? 0,
  };
}

// ── weather, life and places ──

const WEATHER = {
  ice: [['snow', 3], ['none', 2]],
  desert: [['dust', 3], ['none', 2]],
  lava: [['ash', 4], ['none', 1]],
  forest: [['rain', 3], ['spores', 1], ['none', 2]],
  ocean: [['rain', 3], ['none', 2]],
  rock: [['dust', 1], ['none', 3]],
  gas: [['none', 1]],
  ringed: [['none', 1]],
};

// A glowing world has spores whatever its family. Nothing falls in `none`,
// so its amount is 0; the draws are made all the same, so the stream reads
// alike either way.
function weatherOf(family, exotic, rnd) {
  const drawn = pick(rnd, WEATHER[family]);
  const amount = between(rnd, [0.2, 1]);
  const kind = exotic === 'glowing' ? 'spores' : drawn;
  return { kind, amount: kind === 'none' ? 0 : amount };
}

// [lib/land/flora.js's family, density], one of them evenly
const FLORA = {
  forest: [['forest', [0.8, 1.6]], ['temperate', [0.6, 1.2]]],
  ocean: [['ocean', [0.4, 1]]],
  desert: [['desert', [0.1, 0.5]]],
  ice: [['ice', [0, 0.3]]],
  lava: [['volcanic', [0, 0.3]]],
  rock: [['desert', [0, 0.2]]],
};

function floraOf(family, rnd) {
  const rows = FLORA[family];
  if (!rows) return null;
  const [kind, range] = rows[Math.floor(rnd() * rows.length)];
  return { family: kind, density: between(rnd, range), pick: rnd() };
}

// density, and the share of planets with none at all
const FAUNA = {
  ice: { density: [0.3, 1], none: 0 },
  desert: { density: [0.2, 0.8], none: 0 },
  forest: { density: [0.6, 1.4], none: 0 },
  ocean: { density: [0.4, 1], none: 0 },
  rock: { density: [0.2, 0.5], none: 0.8 },
  lava: { density: [0.2, 0.4], none: 0.9 },
};
const BODIES = [
  { body: 'beast', role: 'herd', group: [4, 8] },
  { body: 'flyer', role: 'flock', group: [4, 8] },
  { body: 'walker', role: 'wander', group: [1, 3] },
];

function faunaOf(family, palette, rnd) {
  const f = FAUNA[family];
  if (!f) return null;
  const gate = rnd();
  const density = between(rnd, f.density);
  const n = 1 + Math.floor(rnd() * 3);
  const plans = shuffle(BODIES.length, rnd)
    .slice(0, n)
    .map((i) => ({ body: BODIES[i].body, role: BODIES[i].role, tint: rnd() < 0.5 ? palette.rock : palette.accent, group: [...BODIES[i].group] }));
  return { density: gate < f.none ? 0 : density, plans };
}

const EXOTICS = ['crystal', 'glowing', 'floating', 'spires'];

function exoticOf(rnd) {
  const r = rnd();
  const kind = EXOTICS[Math.floor(rnd() * EXOTICS.length)];
  return r < 0.05 ? kind : null;
}

const POI_COUNT = [[0, 1], [1, 3], [2, 3], [3, 2]];
const POI_KINDS = [['ruins', 3], ['wreck', 2], ['outpost', 2], ['monolith', 1], ['signal', 2]];

// distinct kinds, drawn by weight: a held system builds more outposts, and
// pirates leave more wrecks
function poiKindsOf(family, system, rnd) {
  if (family === 'gas' || family === 'ringed') return [];
  const n = pick(rnd, POI_COUNT);
  let rows = POI_KINDS.map(([k, w]) => [k, w * ((k === 'outpost' && system?.faction) || (k === 'wreck' && system?.hazard === 'pirates') ? 2 : 1)]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = pick(rnd, rows);
    out.push(k);
    rows = rows.filter(([x]) => x !== k);
  }
  return out;
}

// ── the variety ──

export function varietyOf(row) {
  const family = familyOf(row.type);
  if (!FAMILIES[family]) throw new Error(`No variety for ${row.type}.`);
  const seed = fold(BigInt(row.seed));
  const stream = (aspect) => seeded(seed ^ SALT[aspect]);
  const dominant = slotOf(row.id, family, stream('slot'));
  const { s, ...ground } = paletteOf(family, dominant, stream('palette'));
  const water = waterOf(family, dominant, s, stream('water'));
  const sky = skyOf(family, dominant, ground.high, row, stream('sky'));
  const palette = { ...ground, skyLow: sky.low, skyHigh: sky.high };
  const exotic = exoticOf(stream('exotic'));
  return {
    family,
    dominant,
    palette,
    water,
    character: characterOf(family, stream('character')),
    sky,
    weather: weatherOf(family, exotic, stream('weather')),
    flora: floraOf(family, stream('flora')),
    fauna: faunaOf(family, palette, stream('fauna')),
    exotic,
    poiKinds: poiKindsOf(family, row.system, stream('pois')),
  };
}
