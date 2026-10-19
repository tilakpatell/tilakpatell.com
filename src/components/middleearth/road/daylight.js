// Daylight: the light along the Road as a function of s (the design’s
// §4.3, each stage’s “light, weather”). Pure; sky.js and the world read it.
//
//   light(stages, s) → { sun: { az, el, colour }, ambient, fog: { colour, density },
//     moon: { phase, el }, stars, pall: { amount, from }, exposure, murk }
//   LIGHTS: { [stage]: { start, end } }, eased from one to the other by
//     smoothstep over the stage’s length
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
  marshes: [L({ el: 0.2, colour: GREY, ambient: 0.22, fog: [0.5, 0.52, 0.5], density: 0.012 }), { el: 0.15, ambient: 0.15, fog: [0.32, 0.3, 0.3], density: 0.008, pall: 0.5 }],
  ithilien: [L({ el: 0.5, colour: WARM, ambient: 0.38, fog: [0.72, 0.8, 0.72], density: 0.003 }), { el: 0.1, ambient: 0.1, fog: [0.2, 0.18, 0.2], density: 0.006, pall: 0.8 }],
  'cirith-ungol': [L({ el: -0.2, colour: RED, ambient: 0.06, fog: [0.08, 0.07, 0.08], density: 0.008, pall: 0.8 }), { el: -0.1, ambient: 0.08, fog: [0.2, 0.08, 0.05], density: 0.006, pall: 0.85 }],
  gorgoroth: [L({ el: 0.1, colour: RED, ambient: 0.12, fog: [0.3, 0.1, 0.05], density: 0.008, pall: 0.9 }), { el: 0.2, ambient: 0.2, fog: [0.4, 0.3, 0.28], density: 0.006, pall: 0.5 }],
  'minas-tirith': [L({ el: 1.0, colour: WHITE, ambient: 0.45, fog: [0.8, 0.86, 0.92], density: 0.0015 }), { el: 0.9, ambient: 0.45, fog: [0.8, 0.86, 0.92], density: 0.0015 }],
  havens: [L({ el: 0.08, az: Math.PI, colour: GOLD, ambient: 0.3, fog: [0.9, 0.75, 0.6], density: 0.002 }), { el: -0.02, az: Math.PI, colour: RED, ambient: 0.22, fog: [0.85, 0.6, 0.5], density: 0.002 }],
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
