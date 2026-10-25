// A generated planet's or moon's variety: what makes it its own and not its
// type's template. Its colours, its land's character, its sky, its weather,
// its flora and fauna, whether it's one of the rare exotic ones, and the
// kinds of place on it (the endless universe's spec, section E). The
// generated spec (generated.js) is made from this and the round ground.
//
// It's a function of the planet's row alone, so a planet is the same
// whichever lookup built it, with its siblings known or not. Each aspect
// draws from its own stream off the planet's seed (SALT), so adding one
// never moves another.
//
// The colours. Each family has its slots (FAMILIES): a hue and a lightness
// each, kept far enough apart that no two can meet, jitter and all. A
// planet's slot is its system's own shuffle of its family's slots (seeded by
// the system's id), read at the planet's index (a moon's by its index round
// its planet). A system that holds seeded planets (the roster's, which keep
// their templates' looks) gives them its first indices and its other planets
// only the slots clear of their colours. The palette is drawn round the slot
// nudged by up to SLOT_JITTER, and the dominant colour is read back from the
// palette (dominantOf): the mix of `low` and `high`, or an ocean planet's
// water. '#rrggbb' moves that mix off the aim, by degrees of hue on a pale or
// a dark planet; where it would carry it out past the jitter, the palette is
// drawn round the slot's own colour, which every family's saturation keeps
// inside. So the colours a visitor sees hold the guarantee: two siblings at
// least 1 apart by colourDistance, and a generated planet at least that far
// from a seeded sibling's template.
//
// Pure: plain data in and out, so it crosses to a worker.
//
//   FAMILIES[family] → { slots: [[hue°, lightness]…], sat: [lo, hi] } (ringed is gas's)
//   SLOT_JITTER = { hue: degrees, light } either way
//   colourDistance([h1, l1], [h2, l2]) → hypot(Δh / 15°, Δl / 0.08), Δh round the circle
//   dominantOf(palette, water = null) → [h°, l]: the mix of `low` and `high`,
//     or the water's colour when one is given (an ocean planet's)
//   paletteOf(family, [h°, l], r) → { colours: { low, high, rock, accent, deep },
//     water }: the palette round (h, l), its saturation and the rest drawn from r
//   varietyOf(row) → { family, dominant: [h°, l], palette: { low, high, rock,
//     accent, deep, skyLow, skyHigh }, water: { kind: 'sea' | 'lava', colour? } | null,
//     character: { kind, sea, peaks } | null, sky: { low, high, haze, clouds,
//     cloudColour, rings, moons }, weather: { kind, amount }, flora: { family,
//     density, pick } | null, fauna: { density, plans: [{ body, role, tint, group }] } | null,
//     exotic: null | 'crystal' | 'glowing' | 'floating' | 'spires', poiKinds: kind[] } | null
//     (null for a type no family knows, or a row whose seed isn't a whole
//     number). dominant is dominantOf(palette, an ocean's water). A gas giant
//     (gas or ringed) has no character, flora, fauna, water or places, and
//     its only exotic is 'glowing'. flora.family is one of
//     lib/land/flora.js's and `pick` (0…1) chooses among its trees; a fauna
//     plan's body is 'beast', 'flyer' or 'walker', 1–3 of them and each
//     different, and its tint the palette's rock or accent (a density of 0
//     keeps its plans and walks none); poiKinds are 0–3 different kinds of
//     'ruins', 'wreck', 'outpost', 'monolith' and 'signal'.

import { seeded } from '../../seeded.js';
import { TERRAIN } from './characters.js';
import { canonicalId } from './expanse.js';
import { fold } from './fnl.js';
import { hash64 } from './hash.js';
import { SEEDED_EXPANSE, TYPE_LOOK, familyOf } from './planetTables.js';

// ── colours ──

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const wrap = (h) => ((h % 360) + 360) % 360;

const rgbOfHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

function hslOfRgb([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [wrap(h * 60), s, l];
}

// (h, s, l)'s channels in whole steps of 1/steps: 255 for a '#rrggbb', 510
// for the mix of two
function stepsOfHsl(h, s, l, steps) {
  const sat = clamp01(s);
  const light = clamp01(l);
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const hh = wrap(h) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = light - c / 2;
  return [r, g, b].map((v) => Math.round(clamp01(v + m) * steps));
}

const hexOfSteps = (c) => `#${c.map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0')).join('')}`;
const hexOfHsl = (h, s, l) => hexOfSteps(stepsOfHsl(h, s, l, 255));

export function colourDistance([h1, l1], [h2, l2]) {
  const dh = Math.abs(wrap(h1 - h2));
  return Math.hypot(Math.min(dh, 360 - dh) / 15, (l1 - l2) / 0.08);
}

export function dominantOf(palette, water = null) {
  if (water?.colour) {
    const [h, , l] = hslOfRgb(rgbOfHex(water.colour));
    return [h, l];
  }
  const a = rgbOfHex(palette.low);
  const b = rgbOfHex(palette.high);
  const [h, , l] = hslOfRgb(a.map((v, i) => (v + b[i]) / 2));
  return [h, l];
}

// ── the slots ──

const grid = (hues, lights) => hues.flatMap((h) => lights.map((l) => Object.freeze([h, l])));
const family = (slots, sat) => Object.freeze({ slots: Object.freeze(slots), sat: Object.freeze(sat) });
const GAS = family([...grid([266, 289, 312], [0.55, 0.67]), ...grid([20, 42], [0.94])], [0.3, 0.55]);

// Starting values. The tests hold every two slots, in a family and across,
// at least 1 + twice the jitter apart, and each slot's own colour inside the
// jitter through '#rrggbb' at every saturation its family draws. That's what
// set ice's and gas's floors: a pale slot has so little chroma that one
// rounded channel swings its hue. An ocean's slots are its water's.
export const FAMILIES = Object.freeze({
  lava: family(grid([335, 0, 25, 50], [0.1, 0.21]), [0.15, 0.35]),
  rock: family(grid([335, 0, 25, 50], [0.33, 0.45]), [0.1, 0.45]),
  desert: family(grid([20, 42, 64], [0.58, 0.7, 0.82]), [0.35, 0.6]),
  forest: family(grid([85, 108, 131, 154], [0.26, 0.38]), [0.3, 0.55]),
  ocean: family(grid([178, 200, 222, 244], [0.28, 0.4]), [0.4, 0.7]),
  ice: family(grid([178, 200, 222, 244], [0.8, 0.92]), [0.25, 0.45]),
  gas: GAS,
  ringed: GAS,
});

export const SLOT_JITTER = Object.freeze({ hue: 2, light: 0.01 });
const JITTER = Math.hypot(SLOT_JITTER.hue / 15, SLOT_JITTER.light / 0.08);

// each seeded type's template colour, as the roster's seeded planets wear it.
// (A seeded ocean's is its sand's for now: its sea's colour is the flight's
// water.js's until that moves into planetTables. Then a seeded ocean is to be
// held by its water, dominantOf(palette, { colour }), as a generated one is;
// three ocean slots sit within 1 + 2·jitter of that sea.)
const TEMPLATE = Object.fromEntries(Object.entries(TYPE_LOOK).map(([type, look]) => [type, dominantOf(look.palette)]));
const systemOf = (id) => id.slice(0, Math.max(0, id.lastIndexOf(':')));

const shuffled = (n, r) => {
  const out = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

// the slot at a planet's index in its system's shuffle; in a system with
// seeded planets, among the slots clear of theirs, after them. (A system has
// 7 planets at most and a planet 6 moons, under every family's 8 slots, so
// the wrap round the list is only a guard.)
function slotOf(fam, key, index) {
  const { slots } = FAMILIES[fam];
  const seededHere = SEEDED_EXPANSE.filter(([id]) => systemOf(id) === key);
  const clear = slots.filter((s) => seededHere.every(([, type]) => colourDistance(s, TEMPLATE[type]) >= 1 + 2 * JITTER));
  const list = clear.length ? clear : slots;
  const perm = shuffled(list.length, seeded(fold(hash64('slots', key))));
  return list[perm[Math.max(0, index - seededHere.length) % list.length]];
}

// ── the tables, by family (ringed reads gas's) ──

const SKY = {
  ice: { hue: [195, 215], low: [0.88, 0.3], high: [0.62, 0.45], haze: [0.1, 0.4], clouds: [0.2, 0.5], cloud: '#f2f4f6' },
  desert: { hue: [200, 215], low: [0.82, 0.45], high: [0.58, 0.5], haze: [0.2, 0.5], clouds: [0, 0.2], cloud: '#d8c4a0' },
  forest: { hue: [190, 210], low: [0.86, 0.35], high: [0.55, 0.55], haze: [0.1, 0.35], clouds: [0.3, 0.7], cloud: '#f2f4f6' },
  ocean: { hue: [185, 205], low: [0.88, 0.35], high: [0.55, 0.6], haze: [0.1, 0.3], clouds: [0.4, 0.8], cloud: '#f2f4f6' },
  lava: { hue: [10, 25], low: [0.32, 0.55], high: [0.1, 0.5], haze: [0.6, 0.9], clouds: [0.1, 0.3], cloud: '#5a5048' },
  // (a hue off the dominant's, and a gas giant's clouds its own `high`)
  rock: { off: [-15, 15], low: [0.7, 0.25], high: [0.4, 0.3], haze: [0.2, 0.5], clouds: [0, 0.1], cloud: '#d8c4a0' },
  gas: { off: [20, 20], low: [0.85, 0.4], high: [0.6, 0.5], haze: [0.4, 0.7], clouds: [0.7, 1], cloud: null },
};

const CHARACTER = {
  rock: [['craters', 3], ['mesas', 2], ['canyons', 2], ['ridges', 1], ['plateaus', 1]],
  ice: [['ridges', 2], ['plateaus', 2], ['continents', 2], ['craters', 1]],
  desert: [['dunes', 3], ['mesas', 2], ['canyons', 2], ['plateaus', 1]],
  forest: [['continents', 3], ['ridges', 1], ['plateaus', 1], ['archipelago', 1]],
  lava: [['ridges', 2], ['craters', 2], ['canyons', 1], ['continents', 1]],
  ocean: [['archipelago', 3], ['continents', 2]],
};

const WEATHER = {
  ice: [['snow', 3], ['none', 2]],
  desert: [['dust', 3], ['none', 2]],
  lava: [['ash', 4], ['none', 1]],
  forest: [['rain', 3], ['spores', 1], ['none', 2]],
  ocean: [['rain', 3], ['none', 2]],
  rock: [['dust', 1], ['none', 3]],
  gas: [['none', 1]],
};

// lib/land/flora.js's families, each with its density's range, picked evenly
const FLORA = {
  forest: [['forest', [0.8, 1.6]], ['temperate', [0.6, 1.2]]],
  ocean: [['ocean', [0.4, 1]]],
  desert: [['desert', [0.1, 0.5]]],
  ice: [['ice', [0, 0.3]]],
  lava: [['volcanic', [0, 0.3]]],
  rock: [['desert', [0, 0.2]]],
};

// the chance it has any fauna, and its density when it does
const FAUNA = { ice: [1, [0.3, 1]], desert: [1, [0.2, 0.8]], forest: [1, [0.6, 1.4]], ocean: [1, [0.4, 1]], rock: [0.2, [0.2, 0.5]], lava: [0.1, [0.2, 0.4]] };
const BODIES = { beast: ['herd', [4, 8]], flyer: ['flock', [4, 8]], walker: ['wander', [1, 3]] };

const EXOTICS = ['crystal', 'glowing', 'floating', 'spires'];
const EXOTIC_SHARE = 0.05;

const POI_COUNT = [[0, 1], [1, 3], [2, 3], [3, 2]];
const POI_KINDS = { ruins: 3, wreck: 2, outpost: 2, monolith: 1, signal: 2 };

// each aspect's own stream, off the planet's seed (no other stream in the
// flight shares a salt: the test reads every SALT here)
const SALT = { slot: 0x1f83d9ab, palette: 0x5be0cd19, character: 0x6a09e667, sky: 0xa4093822, weather: 0x510e527f, flora: 0x9b05688c, fauna: 0x243f6a88, exotic: 0x13198a2e, poi: 0x299f31d0 };

const between = (r, [lo, hi]) => lo + r() * (hi - lo);
const round3 = (v) => Math.round(v * 1000) / 1000;
function weighted(r, rows) {
  const total = rows.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [v, w] of rows) if ((x -= w) < 0) return v;
  return rows[rows.length - 1][0];
}

// each family's accent off its (h, s, l); a lava planet's is its glow, an ocean's its water
const ACCENT = {
  lava: (h, s, l, r) => hexOfHsl(between(r, [15, 35]), 1, 0.55),
  forest: (h, s, l) => hexOfHsl(h + 25, s + 0.1, l + 0.12),
  desert: (h, s, l) => hexOfHsl(h - 12, s, l - 0.1),
  rock: (h, s, l) => hexOfHsl(h + 15, s, l + 0.15),
  ice: (h, s, l) => hexOfHsl(h, s, l - 0.08),
  gas: (h, s, l) => hexOfHsl(h + 40, s, l),
};

// a ground's four colours round (h, s, l). low is a shade darker and 3° back
// round the hue; high is whatever makes the mix of the two (h, s, l) itself,
// to the half step a mix of two '#rrggbb's can hit (so it comes out near
// (h + 3, s, l + 0.05)). The mix is what dominantOf reads.
function groundColours(h, s, l) {
  const low = stepsOfHsl(h - 3, s, l - 0.05, 255);
  const mix = stepsOfHsl(h, s, l, 510);
  return { low: hexOfSteps(low), high: hexOfSteps(mix.map((v, i) => v - low[i])), rock: hexOfHsl(h + 10, 0.6 * s, 0.6 * l), deep: hexOfHsl(h, s, 0.7 * l) };
}

export function paletteOf(fam, [h, l], r) {
  const look = fam === 'ringed' ? 'gas' : fam;
  const s = between(r, FAMILIES[look].sat);
  if (look === 'ocean') {
    // its water is (h, l); its sand is a desert's
    const colour = hexOfHsl(h, s, l);
    const sand = groundColours(between(r, [20, 64]), between(r, FAMILIES.desert.sat), between(r, [0.58, 0.82]));
    return { colours: { ...sand, accent: colour }, water: { kind: 'sea', colour } };
  }
  const ground = groundColours(h, s, l);
  const accent = ACCENT[look](h, s, l, r);
  const water = look === 'forest' ? { kind: 'sea', colour: hexOfHsl(between(r, [195, 215]), 0.45, 0.3) } : look === 'lava' ? { kind: 'lava' } : null;
  return { colours: { ...ground, accent }, water };
}

function skyOf(look, [h], high, row, r) {
  const t = SKY[look];
  const hue = t.off ? h + between(r, t.off) : between(r, t.hue);
  return {
    low: hexOfHsl(hue, t.low[1], t.low[0]),
    high: hexOfHsl(hue, t.high[1], t.high[0]),
    haze: round3(between(r, t.haze)),
    clouds: round3(between(r, t.clouds)),
    cloudColour: t.cloud ?? high,
    rings: Boolean(row.rings),
    moons: row.moons ?? 0,
  };
}

function faunaOf(look, colours, r) {
  const [chance, range] = FAUNA[look];
  const any = r() < chance;
  const density = between(r, range);
  const bodies = shuffled(3, r).map((i) => Object.keys(BODIES)[i]);
  const plans = bodies.slice(0, 1 + Math.floor(r() * 3)).map((body) => {
    const [role, group] = BODIES[body];
    return { body, role, tint: r() < 0.5 ? colours.rock : colours.accent, group: [...group] };
  });
  return { density: any ? round3(density) : 0, plans };
}

function poiKindsOf(system, r) {
  const weights = { ...POI_KINDS };
  if (system?.faction) weights.outpost *= 2;
  if (system?.hazard === 'pirates') weights.wreck *= 2;
  const count = weighted(r, POI_COUNT);
  const kinds = [];
  for (let n = 0; n < count; n++) {
    const kind = weighted(r, Object.entries(weights));
    kinds.push(kind);
    delete weights[kind];
  }
  return kinds;
}

// a row's seed as a bigint: the generator's string, a whole number or a bigint, else null
const bigSeedOf = (v) => (typeof v === 'bigint' ? v : (Number.isInteger(v) || (typeof v === 'string' && /^-?\d+$/.test(v))) ? BigInt(v) : null);

export function varietyOf(row) {
  const fam = familyOf(row.type);
  const big = bigSeedOf(row.seed);
  if (!Object.hasOwn(FAMILIES, fam) || big === null) return null;
  const look = fam === 'ringed' ? 'gas' : fam;
  const gas = look === 'gas';
  const seed = fold(big);
  const stream = (aspect) => seeded(seed ^ SALT[aspect]);

  // the system's key and the planet's index in it (a moon's are its planet and its own number)
  const id = canonicalId(row.id) ?? String(row.id ?? '');
  const key = systemOf(id);
  const index = Number(id.slice(id.lastIndexOf(':') + 1)) || 0;
  const slot = slotOf(fam, key, index);
  const jitter = stream('slot');
  const aim = [wrap(slot[0] + (2 * jitter() - 1) * SLOT_JITTER.hue), slot[1] + (2 * jitter() - 1) * SLOT_JITTER.light];

  // the dominant is read back from what's drawn; where '#rrggbb' carries the
  // jittered aim out past the jitter, it's drawn round the slot itself,
  // which the tests hold inside it (the same stream, so the same draws)
  const dominantIn = (made) => dominantOf(made.colours, look === 'ocean' ? made.water : null);
  let made = paletteOf(look, aim, stream('palette'));
  if (colourDistance(dominantIn(made), slot) > JITTER) made = paletteOf(look, slot, stream('palette'));
  const { colours, water } = made;
  const dominant = dominantIn(made);
  const sky = skyOf(look, dominant, colours.high, row, stream('sky'));

  // a gas giant has no ground for crystals, islands or spires: a rare one glows
  const ex = stream('exotic');
  const rare = ex() < EXOTIC_SHARE;
  const exoticKind = EXOTICS[Math.floor(ex() * EXOTICS.length)];
  const exotic = rare ? (gas ? 'glowing' : exoticKind) : null;

  const w = stream('weather');
  const drawn = weighted(w, WEATHER[look]);
  const amount = round3(between(w, [0.2, 1]));
  const kind = exotic === 'glowing' ? 'spores' : drawn;
  const weather = { kind, amount: kind === 'none' ? 0 : amount };

  let character = null;
  let flora = null;
  let fauna = null;
  if (!gas) {
    const c = stream('character');
    const k = weighted(c, CHARACTER[look]);
    character = { kind: k, sea: round3(between(c, TERRAIN[k].sea)), peaks: Math.round(between(c, TERRAIN[k].peaks)) };
    const f = stream('flora');
    const [floraFamily, range] = FLORA[look][Math.floor(f() * FLORA[look].length)];
    flora = { family: floraFamily, density: round3(between(f, range)), pick: round3(f()) };
    fauna = faunaOf(look, colours, stream('fauna'));
  }

  return {
    family: fam,
    dominant,
    palette: { ...colours, skyLow: sky.low, skyHigh: sky.high },
    water,
    character,
    sky,
    weather,
    flora,
    fauna,
    exotic,
    poiKinds: gas ? [] : poiKindsOf(row.system, stream('poi')),
  };
}
