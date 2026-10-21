// Daylight: the light along the Road as a function of s (the design’s
// §4.3, each stage’s “light, weather”). Pure; sky.js and the world read it.
//
//   light(stages, s) → { sun: { az, el, colour }, ambient, fog: { colour, density },
//     moon: { phase, el }, stars, pall: { amount, from }, exposure, murk }
//   LIGHTS: { [stage]: { start, end } }, eased from one to the other by
//     smoothstep over the stage’s length
//   keyLight(light) → { dir: [x, y, z], colour, intensity, moon }: the one light
//     that casts, the sun by day and the moon by night (cold, as bright as its
//     phase, none under a storm or the pall), so a night reads by moonlight
//     rather than by the ambient alone
//   skyLight(light) → the sky light's strength (module.js's hemisphere light):
//     the chapters' 1.0 by a clear day, so a back turned to a low sun still reads
//   shadeOf(light, key?) → [r, g, b], linear: the house look's shade (the
//     albedo times this where the key light doesn't reach), from the sky
//     light's hue and how much light there is
//   STORMS: { [stage]: { at: [from, to], ramp, fog, density, ambient, el? } }:
//     a stretch of a stage under an air of its own (the white-out on the
//     Redhorn, the dark under the mountain in Moria), coming on over `ramp`
//     metres and going the same way, the sun put at `el` if it says; `murk`
//     is how far into it the ride is, 0…1 (the sky lost in the fog)
//
// `el` and `az` are radians (el above the horizon, az the yaw from +z in
// the stage’s frame); `pall` is Mordor’s lid of cloud, `from` the way it
// comes. A stage ends in the sun’s colour the next begins in, so the
// hand-over at a seam never jumps (days pass between some stages; their
// title cards cover the rest).

import { at } from './line';

// a light from the few numbers a stage’s brief gives
const L = ({ el, az = -0.6, colour = [1, 0.95, 0.85], ambient = 0.35, fog = [0.75, 0.8, 0.85], density = 0.004, moon = 0.3, stars, pall = 0, from = [1, 0.2, 0], exposure = 1 }) => ({
  sun: { az, el, colour },
  ambient,
  fog: { colour: fog, density },
  moon: { phase: moon, el: -el * 0.8 },
  stars: stars ?? Math.min(1, Math.max(0, -el * 5)),
  pall: { amount: pall, from },
  exposure,
});

const WARM = [1, 0.9, 0.75];
const GOLD = [1, 0.78, 0.5];
const GREY = [0.82, 0.84, 0.88];
const COLD = [0.85, 0.9, 1];
const RED = [1, 0.45, 0.25];
const WHITE = [1, 0.97, 0.92];

// each stage’s start; its end is listed without a colour, which is taken
// from the next stage’s start (the last keeps its own)
const TABLE = {
  hobbiton: [L({ el: 0.35, colour: WARM, fog: [0.82, 0.86, 0.8], density: 0.002 }), { el: -0.3, ambient: 0.08, fog: [0.025, 0.032, 0.06], density: 0.004 }],
  'shire-edge': [L({ el: 0.12, colour: GOLD, fog: [0.9, 0.78, 0.6], density: 0.003 }), { el: 0.22, ambient: 0.3, fog: [0.6, 0.64, 0.68], density: 0.012 }],
  // (Bree’s night and Weathertop’s a little lighter than dark: the town and the hill read by moonlight, the walkers not black)
  bree: [L({ el: -0.35, colour: GREY, ambient: 0.13, fog: [0.03, 0.035, 0.045], density: 0.01 }), { el: 0.05, ambient: 0.2, fog: [0.5, 0.52, 0.56], density: 0.008 }],
  weathertop: [L({ el: 0.06, colour: GOLD, ambient: 0.22, fog: [0.7, 0.55, 0.45], density: 0.003 }), { el: -0.4, ambient: 0.11, fog: [0.03, 0.035, 0.065], density: 0.003 }],
  ford: [L({ el: 0.4, colour: GREY, ambient: 0.32, fog: [0.62, 0.64, 0.62], density: 0.006 }), { el: 0.5, ambient: 0.38, fog: [0.75, 0.82, 0.88], density: 0.002 }],
  rivendell: [L({ el: 0.35, colour: GOLD, ambient: 0.36, fog: [0.85, 0.75, 0.6], density: 0.002 }), { el: 0.1, ambient: 0.3, fog: [0.8, 0.84, 0.9], density: 0.003 }],
  caradhras: [L({ el: 0.6, colour: COLD, ambient: 0.42, fog: [0.8, 0.86, 0.95], density: 0.002 }), { el: -0.05, ambient: 0.12, fog: [0.12, 0.14, 0.2], density: 0.004 }],
  // (the Dimrill Dale’s grey January day, the sun behind the walkers on the climbing
  // slope; the dark under the mountain is its span, STORMS’)
  moria: [L({ el: 0.25, az: Math.PI - 0.5, colour: GREY, ambient: 0.3, fog: [0.62, 0.66, 0.72], density: 0.004 }), { el: 0.3, ambient: 0.32, fog: [0.66, 0.7, 0.74], density: 0.003 }],
  lorien: [L({ el: 0.3, colour: GOLD, ambient: 0.4, fog: [0.9, 0.8, 0.55], density: 0.003 }), { el: 0.05, ambient: 0.25, fog: [0.7, 0.72, 0.75], density: 0.004 }],
  anduin: [L({ el: 0.3, colour: GREY, ambient: 0.32, fog: [0.66, 0.68, 0.7], density: 0.004 }), { el: 0.25, ambient: 0.3, fog: [0.62, 0.64, 0.66], density: 0.005 }],
  // (the eye opened a little: black mud and dead reeds with the low sun ahead read as nothing at 1)
  marshes: [L({ el: 0.2, colour: GREY, ambient: 0.22, fog: [0.5, 0.52, 0.5], density: 0.012, exposure: 1.35 }), { el: 0.15, ambient: 0.15, fog: [0.32, 0.3, 0.3], density: 0.008, pall: 0.5, exposure: 1.35 }],
  ithilien: [L({ el: 0.5, colour: WARM, ambient: 0.38, fog: [0.72, 0.8, 0.72], density: 0.003 }), { el: 0.1, ambient: 0.1, fog: [0.2, 0.18, 0.2], density: 0.006, pall: 0.8 }],
  'cirith-ungol': [L({ el: -0.2, colour: RED, ambient: 0.06, fog: [0.08, 0.07, 0.08], density: 0.008, pall: 0.8 }), { el: -0.1, ambient: 0.08, fog: [0.2, 0.08, 0.05], density: 0.006, pall: 0.85 }],
  // (the eye opened: under the pall the ash and the hobbits on it went black at 1)
  gorgoroth: [L({ el: 0.1, colour: RED, ambient: 0.12, fog: [0.3, 0.1, 0.05], density: 0.008, pall: 0.9, exposure: 1.65 }), { el: 0.2, ambient: 0.2, fog: [0.4, 0.3, 0.28], density: 0.006, pall: 0.5, exposure: 1.35 }],
  'minas-tirith': [L({ el: 1.0, colour: WHITE, ambient: 0.45, fog: [0.8, 0.86, 0.92], density: 0.0015 }), { el: 0.9, ambient: 0.45, fog: [0.8, 0.86, 0.92], density: 0.0015 }],
  // (the sun going down into the Sea ahead, where the ship sails)
  havens: [L({ el: 0.08, az: 0.12, colour: GOLD, ambient: 0.3, fog: [0.9, 0.75, 0.6], density: 0.002 }), { el: -0.02, az: 0.12, colour: RED, ambient: 0.22, fog: [0.85, 0.6, 0.5], density: 0.002 }],
};

export const STORMS = {
  // (the snow on the Redhorn’s shoulder: the walkers grey shapes in it, the mountain gone)
  caradhras: { at: [46, 104], ramp: 14, fog: [0.86, 0.88, 0.92], density: 0.04, ambient: 0.55 },
  // (from the Doors, already shut behind, to the East-gate: no sun, black air, the staff the one light)
  moria: { at: [-8, 128], ramp: 8, fog: [0, 0, 0], density: 0.03, ambient: 0.02, el: -1 },
};

const ids = Object.keys(TABLE);
export const LIGHTS = Object.fromEntries(
  ids.map((id, i) => {
    const [start, endish] = TABLE[id];
    const colour = endish.colour ?? TABLE[ids[i + 1]]?.[0].sun.colour ?? start.sun.colour;
    return [id, { start, end: L({ az: start.sun.az, ...endish, colour }) }];
  }),
);

const mix = (a, b, k) => a + (b - a) * k;
const mix3 = (a, b, k) => [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
const smooth = (x) => x * x * (3 - 2 * x);

export function light(stages, s) {
  const here = at(stages, s);
  const len = stages[here.index].length;
  const { start: a, end: b } = LIGHTS[here.stage];
  const k = smooth(Math.min(1, Math.max(0, here.local / len)));
  const storm = STORMS[here.stage];
  const w = storm ? smooth(Math.min(1, Math.max(0, (here.local - storm.at[0]) / storm.ramp))) * (1 - smooth(Math.min(1, Math.max(0, (here.local - storm.at[1] + storm.ramp) / storm.ramp)))) : 0;
  const fog = mix3(a.fog.colour, b.fog.colour, k);
  return {
    sun: { az: mix(a.sun.az, b.sun.az, k), el: mix(mix(a.sun.el, b.sun.el, k), storm?.el ?? 0, storm?.el == null ? 0 : w), colour: mix3(a.sun.colour, b.sun.colour, k) },
    ambient: mix(mix(a.ambient, b.ambient, k), storm?.ambient ?? 0, w),
    fog: { colour: w ? mix3(fog, storm.fog, w) : fog, density: mix(mix(a.fog.density, b.fog.density, k), storm?.density ?? 0, w) },
    moon: { phase: mix(a.moon.phase, b.moon.phase, k), el: mix(a.moon.el, b.moon.el, k) },
    stars: mix(a.stars, b.stars, k) * (1 - w),
    pall: { amount: mix(a.pall.amount, b.pall.amount, k), from: mix3(a.pall.from, b.pall.from, k) },
    exposure: mix(a.exposure, b.exposure, k),
    murk: w,
  };
}

const MOON = [0.62, 0.7, 0.95];
const clamp01 = (x) => Math.min(1, Math.max(0, x));
export function keyLight(l) {
  const { az, el, colour } = l.sun;
  const pall = 1 - 0.6 * l.pall.amount;
  const day = clamp01((el + 0.05) / 0.3);
  const night = clamp01((-el - 0.04) / 0.16) * Math.min(1, l.moon.phase * 2.5) * (1 - (l.murk ?? 0)) * (1 - 0.8 * l.pall.amount);
  if (day > 0 || night === 0) return { dir: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], colour: [...colour], intensity: 2.4 * day * pall, moon: false };
  // (the moon across the sky from where the sun went down, at least a little up)
  const mel = Math.max(0.35, l.moon.el);
  const maz = az + Math.PI;
  return { dir: [Math.sin(maz) * Math.cos(mel), Math.sin(mel), Math.cos(maz) * Math.cos(mel)], colour: [...MOON], intensity: 0.9 * night, moon: true };
}

// The shade: the sky light's hue (the fog's, as module.js lights it) leaned
// toward violet by day, hardly at all under the moon (a night's shade is
// blue, not purple) or the pall (Mordor's, brown). By day seven tenths of
// the full light the key and the sky light give a face (a noon's is held
// to its cap; a dusk's, all of it shade, went muddy at less), by night nine
// (an eye used to the dark: Bree's street, in the houses' moon shadow,
// went black), on the house's measure (three's Lambert
// divides by pi); never brighter than a clear day's (a little under the
// house's LOOK.shadow, 0x9d93c4, so a shadow cast reads) nor so dark that
// the deeps go black
export const skyLight = (l) => 0.4 + l.ambient * 1.8;

const VIOLET = [0.195, 0.147, 0.687]; // (0x7a6ad8, linear: houseNodes' shadowFor leans the same way)
export const SHADE = { day: 0.28, least: 0.07, sun: 0.7, moon: 0.9 }; // its brightness (luma, linear): the most, the least; its share of the full light by the sun, by the moon
const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export function shadeOf(l, key = keyLight(l)) {
  const sky = l.fog.colour;
  const lean = (key.moon ? 0.12 : 0.35) * (1 - 0.7 * l.pall.amount);
  const c = sky.map((v, i) => v + (VIOLET[i] - v) * lean);
  const full = lumOf(key.colour) * key.intensity + lumOf(sky) * skyLight(l);
  const want = Math.min(SHADE.day, Math.max(SHADE.least, (full / Math.PI) * (key.moon ? SHADE.moon : SHADE.sun)));
  const got = lumOf(c);
  return got > 0 ? c.map((v) => (v * want) / got) : [want, want, want];
}

// The full light the look measures a point against (houseNodes' uLookRef,
// the sun's and the sky light's over pi), held at least to the light the
// shade's floor stands for (the shade is SHADE.sun of its full light): under
// Moria's black air the sky light is none, the reference fell to nothing,
// and every glimmer on a wall read as full light, so the shade never came
// and the deeps went black where the shade is meant to keep them shapes.
// `c` a colour ({ r, g, b }, linear), lifted in place, its hue kept.
export const REF_LEAST = SHADE.least / SHADE.sun;
export function refFloor(c) {
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  if (l >= REF_LEAST) return c;
  const k = l > 1e-6 ? REF_LEAST / l : 0;
  if (k) {
    c.r *= k;
    c.g *= k;
    c.b *= k;
  } else c.r = c.g = c.b = REF_LEAST;
  return c;
}
