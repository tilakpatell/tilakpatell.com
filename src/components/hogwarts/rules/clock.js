// The world’s day (the design’s §4.13): twenty-four real minutes from one
// midnight to the next, a world hour a real minute, starting on the night
// the first-years come. Pure, so the sky, the light on the grounds, the
// castle’s windows, the bell and the enchanted ceiling all read one clock,
// and a test can ride a whole day in a loop.
//
//   DAY (real seconds a world day), HOUR (real seconds a world hour), ARRIVE (the hour the world opens at)
//   newClock({ hour, day, rate }) → { t: world hours since day 0’s midnight, rate }
//   step(clock, dt) → clock, dt real seconds (rate 0 stands the clock still)
//   hourOf(clock) → 0…24; dayOf(clock) → the whole days gone
//   setHour(clock, hour, { forward }) → clock: the same day at that hour (or the next, `forward`)
//   parseAt(at, week) → an hour from ‘dawn’, ‘morning’, ‘noon’, ‘afternoon’, ‘dusk’,
//     ‘evening’, ‘night’, ‘midnight’, ‘18:30’ or ‘7’; null for anything else
//   daylight(week) → { rise, set, high }: the sun’s hours and its noon height (radians) that week
//   sunAt(hour, week) → { az, el } (az the yaw from +z, south, toward +x, east)
//   moonAt(hour, day) → { az, el, phase } (phase 0 new … 1 full)
//   light(hour, { week, day, weather }) → the day’s light, in the Road’s daylight shape:
//     { sun: { az, el, colour }, ambient, fog: { colour, density }, moon, stars, pall, exposure, murk, cloud, windows }
//   windowsAt(hour, week) → 0…1, how much of the castle is lit: none by day, all from dusk, fewer past midnight
//   strikes(t0, t1) → the hour the bell strikes between two readings (1…12), or 0
//   keyLight(l), skyLight(l), shadeOf(l): the one light that casts, the sky light’s strength, the house look’s shade
//
// The grounds sit at about 57° north and the term runs from September to
// the leaving feast: long September evenings, short December days, the sun
// low over the lake all winter. Weeks are the term’s (1…12, rules/weather.js).

export const DAY = 24 * 60; // real seconds
export const HOUR = DAY / 24;
export const ARRIVE = 19.9; // (the blue hour on the first night: the sun just down behind the forest, the windows coming on)

export function newClock({ hour = ARRIVE, day = 0, rate = 1 } = {}) {
  return { t: day * 24 + wrap(hour), rate };
}

export function step(clock, dt) {
  if (!(dt > 0) || !clock.rate) return clock;
  return { ...clock, t: clock.t + (dt * clock.rate) / HOUR };
}

export const hourOf = (clock) => wrap(clock.t);
export const dayOf = (clock) => Math.floor(clock.t / 24);

// the same day at `hour`; `forward`: never back, so a later hour today or that hour tomorrow
export function setHour(clock, hour, { forward = false } = {}) {
  const day = dayOf(clock);
  let t = day * 24 + wrap(hour);
  if (forward && t < clock.t) t += 24;
  return { ...clock, t };
}

const NAMED = { dawn: 'dawn', morning: 9, noon: 12.5, day: 12.5, afternoon: 15.5, dusk: 'dusk', evening: 21, night: 23, midnight: 0 };
export function parseAt(at, week = 1) {
  if (at == null || at === '') return null;
  const s = String(at).trim().toLowerCase();
  if (Object.hasOwn(NAMED, s)) {
    const v = NAMED[s];
    const d = daylight(week);
    if (v === 'dawn') return wrap(d.rise - 0.25);
    if (v === 'dusk') return wrap(d.set + 0.3);
    return v;
  }
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 24 || min > 59) return null;
  return wrap(h + min / 60);
}

// The sun’s year over the term: week 1 is early September (a thirteen-hour
// day, the sun 38° up at noon), the shortest at week 8 (Christmas: seven
// and a half hours, 13° up, a little higher than the Highlands’ 10° so a
// winter noon still lights the grounds), and back toward March by week 12.
const LONG = { rise: 6.6, set: 19.6, high: 0.66 };
const SHORT = { rise: 8.7, set: 16.0, high: 0.23 };
export function daylight(week = 1) {
  const w = Math.min(12, Math.max(1, week));
  // (0 in September, 1 at the solstice, easing back toward spring)
  const k = w <= 8 ? smooth((w - 1) / 7) : 1 - 0.55 * smooth((w - 8) / 4);
  return { rise: mix(LONG.rise, SHORT.rise, k), set: mix(LONG.set, SHORT.set, k), high: mix(LONG.high, SHORT.high, k) };
}

// The sun on a circle tipped so it stands `high` at noon and crosses the
// horizon at the week’s rise and set: el = A cos(ω(h − noon)) + B, the noon
// halfway between them. Its bearing turns a full circle a day: south at
// noon, east (+x) in the morning, west in the evening.
export function sunAt(hour, week = 1) {
  const { rise, set, high } = daylight(week);
  const noon = (rise + set) / 2;
  const half = (set - rise) / 2;
  const w = (2 * Math.PI) / 24;
  const c = Math.cos(w * half);
  const A = high / (1 - c);
  const B = -A * c;
  return { az: -w * (hour - noon), el: A * Math.cos(w * (hour - noon)) + B };
}

// The moon: a 29.5-day round of phases on the world’s days, full on the
// first night (the arrival’s moon over the Astronomy Tower), rising later
// each day, across the sky from the sun when full.
const MONTH = 29.5;
export function moonAt(hour, day = 0) {
  const age = ((((day + hour / 24) / MONTH) % 1) + 1) % 1; // 0: full
  const phase = 0.5 + 0.5 * Math.cos(age * 2 * Math.PI);
  const h = hour - age * 24; // (a full moon is south at midnight, where the sun stood at noon; later each night after)
  const w = (2 * Math.PI) / 24;
  return { az: -w * h, el: 0.62 * Math.cos(w * h) + 0.08, phase };
}

const WARM = [1, 0.93, 0.8];
const GOLD = [1, 0.74, 0.46];
const EMBER = [1, 0.52, 0.3];
const WHITE = [1, 0.97, 0.92];
const MOON = [0.62, 0.7, 0.95];
// the haze by the sun’s height: a dark blue night, the blue hour, a dusk
// still warm low down, the gold of a low sun, a pale Highland day
const FOG = [
  [-0.4, [0.012, 0.018, 0.04]],
  [-0.2, [0.03, 0.045, 0.1]],
  [-0.08, [0.12, 0.13, 0.26]],
  [0.0, [0.5, 0.36, 0.4]],
  [0.08, [0.82, 0.6, 0.46]],
  [0.25, [0.78, 0.76, 0.72]],
  [0.6, [0.72, 0.79, 0.86]],
];
const SUN = [
  [-0.05, EMBER],
  [0.06, EMBER],
  [0.18, GOLD],
  [0.4, WARM],
  [0.8, WHITE],
];
const AMBIENT = [
  [-0.4, 0.09],
  [-0.1, 0.12],
  [0.0, 0.2],
  [0.2, 0.32],
  [0.6, 0.4],
];

export function light(hour, { week = 1, day = 0, weather = null } = {}) {
  const sun = sunAt(hour, week);
  const moon = moonAt(hour, day);
  const el = sun.el;
  const cloud = clamp01(weather?.cloud ?? 0);
  const murk = clamp01(Math.max(weather?.rain ?? 0, weather?.snow ?? 0)) * 0.6;
  // (an overcast day greys the haze toward the cloud’s own colour and thickens it)
  const clear = ramp3(FOG, el);
  const grey = lumOf(clear);
  const fog = mix3(clear, [grey * 0.92, grey * 0.96, grey * 1.04], cloud * 0.75);
  const density = 0.0011 * (1 + 2.2 * cloud + 3 * murk) + 0.0006 * smooth(clamp01(-el / 0.3)) + 0.004 * clamp01(weather?.mist ?? 0);
  return {
    sun: { az: sun.az, el, colour: mix3(ramp3(SUN, el), [0.85, 0.87, 0.9], cloud * 0.7) },
    ambient: ramp1(AMBIENT, el) * (1 + 0.25 * cloud),
    fog: { colour: fog, density },
    moon: { az: moon.az, el: moon.el, phase: moon.phase * (1 - cloud * 0.85) },
    stars: clamp01((-el - 0.08) / 0.2) * (1 - cloud),
    pall: { amount: 0, from: [1, 0.2, 0] },
    // (the eye opens a little at night, as the Road’s does)
    exposure: 1 + 0.45 * smooth(clamp01((0.05 - el) / 0.35)),
    murk,
    cloud,
    windows: windowsAt(hour, week),
  };
}

// The castle’s windows: none by day, coming on as the sun goes down (the
// threshold each window keeps in the shader spreads them over this), all
// lit through the evening, a third out after midnight as the castle
// sleeps, coming on again for the early risers before dawn.
export function windowsAt(hour, week = 1) {
  const { el } = sunAt(hour, week);
  const dark = smooth(clamp01((0.14 - el) / 0.22));
  const h = wrap(hour);
  const asleep = h < 5.5 ? 0.62 + 0.38 * smooth(clamp01(Math.abs(h - 3) / 2.5)) : 1;
  return dark * asleep;
}

// the hour struck between two readings of the clock (t in world hours):
// one stroke for one o’clock, twelve for noon and midnight
export function strikes(t0, t1) {
  if (!(t1 > t0)) return 0;
  const b = Math.floor(t1);
  if (b === Math.floor(t0)) return 0;
  return wrap(b) % 12 || 12;
}

// (the Road’s daylight.js’s three, by the same rule: the sun by day, the
// moon by night, so a night reads by moonlight; and the house look’s shade)
export function keyLight(l) {
  const { az, el, colour } = l.sun;
  const day = clamp01((el + 0.05) / 0.3) * (1 - 0.65 * (l.cloud ?? 0));
  const night = clamp01((-el - 0.04) / 0.16) * Math.min(1, l.moon.phase * 2.5) * (1 - (l.murk ?? 0));
  if (day > 0 || night === 0) return { dir: [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], colour: [...colour], intensity: 2.4 * day, moon: false };
  const mel = Math.max(0.35, l.moon.el);
  const maz = l.moon.el > 0.1 ? l.moon.az : az + Math.PI;
  return { dir: [Math.sin(maz) * Math.cos(mel), Math.sin(mel), Math.cos(maz) * Math.cos(mel)], colour: [...MOON], intensity: 0.85 * night, moon: true };
}

export const skyLight = (l) => 0.4 + l.ambient * 1.8;

const VIOLET = [0.195, 0.147, 0.687];
export const SHADE = { day: 0.28, least: 0.07, sun: 0.7, moon: 0.9 };
export function shadeOf(l, key = keyLight(l)) {
  const sky = l.fog.colour;
  const lean = key.moon ? 0.12 : 0.35;
  const c = sky.map((v, i) => v + (VIOLET[i] - v) * lean);
  const full = lumOf(key.colour) * key.intensity + lumOf(sky) * skyLight(l);
  const want = Math.min(SHADE.day, Math.max(SHADE.least, (full / Math.PI) * (key.moon ? SHADE.moon : SHADE.sun)));
  const got = lumOf(c);
  return got > 0 ? c.map((v) => (v * want) / got) : [want, want, want];
}

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}
function wrap(h) {
  return ((h % 24) + 24) % 24;
}
function mix(a, b, k) {
  return a + (b - a) * k;
}
function mix3(a, b, k) {
  return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
}
function smooth(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}
function lumOf(c) {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
// a table of [at, value] read between its rows (held at either end)
function ramp1(rows, x) {
  if (x <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (x <= rows[i][0]) return mix(rows[i - 1][1], rows[i][1], smooth((x - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0])));
  return rows[rows.length - 1][1];
}
function ramp3(rows, x) {
  if (x <= rows[0][0]) return rows[0][1];
  for (let i = 1; i < rows.length; i++) if (x <= rows[i][0]) return mix3(rows[i - 1][1], rows[i][1], smooth((x - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0])));
  return rows[rows.length - 1][1];
}
