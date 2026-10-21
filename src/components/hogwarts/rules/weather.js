// The grounds’ weather by the term’s week and the world’s day (the design’s
// §4.13): Highland rain through the autumn, mist lying on the lake at dawn,
// snow from the eighth week, a clear cold spring at the end. Pure and
// seeded by the day, so a day’s weather is the same every time it is asked
// for (the Map, the ceiling in the Great Hall and the window all agree),
// and the week is only a number handed in (the term is Lane F’s: until it
// lands the week is a prop the module holds).
//
//   WEEKS (the term’s length), seasonOf(week) → 'autumn' | 'winter' | 'spring'
//   weatherAt({ week, day, hour }) → { season, kind, rain, snow, mist, cloud, wind, lying }
//     kind: 'clear' | 'cloud' | 'rain' | 'snow' | 'mist' (what a toast or the Map would call it)
//     rain, snow: how hard it falls, 0…1; mist: on the lake, 0…1; cloud: the sky’s cover;
//     wind: 0…1; lying: the snow on the ground, 0…1 (it builds over the winter weeks)
//   spellOf(day, salt) → { on, start, hours, k }: a day’s one spell of weather (pure, for the test)
//
// A spell is a stretch of the day with something falling: each autumn day
// rolls whether it has one, where it starts and how long it lasts, so a wet
// morning can clear by the afternoon and the next day be dry.

import { daylight } from './clock';

export const WEEKS = 12;
export const SNOW_FROM = 8;
export const SPRING_FROM = 11;

export const seasonOf = (week) => (week >= SPRING_FROM ? 'spring' : week >= SNOW_FROM ? 'winter' : 'autumn');

// mulberry32 on a day and a salt: a number 0…1 the same every time
function rng(day, salt) {
  let a = (Math.imul(Math.floor(day) + 1013, 2654435761) ^ Math.imul(salt + 7, 40503)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// how often a day has a spell, how long one runs (hours) and how hard, by season
const SPELLS = {
  autumn: { chance: 0.55, hours: [3, 11], k: [0.45, 1] },
  winter: { chance: 0.5, hours: [3, 9], k: [0.4, 0.95] },
  spring: { chance: 0.12, hours: [1, 3], k: [0.2, 0.45] },
};

export function spellOf(day, season = 'autumn') {
  const r = rng(day, season.length);
  const s = SPELLS[season];
  const on = r() < s.chance;
  const start = r() * 24;
  const hours = s.hours[0] + r() * (s.hours[1] - s.hours[0]);
  const k = s.k[0] + r() * (s.k[1] - s.k[0]);
  return { on, start, hours, k };
}

// 0…1 inside a spell, its first and last hour eased in and out; a spell
// begun late in the day runs on past midnight (yesterday’s is asked too)
function inSpell(spell, hour) {
  if (!spell.on) return 0;
  const t = hour - spell.start;
  if (t < 0 || t > spell.hours) return 0;
  const edge = Math.min(1, t, spell.hours - t);
  return spell.k * edge * edge * (3 - 2 * edge);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function weatherAt({ week = 1, day = 0, hour = 12 } = {}) {
  const season = seasonOf(week);
  const today = spellOf(day, season);
  const yesterday = spellOf(day - 1, season);
  const falling = Math.max(inSpell(today, hour), inSpell(yesterday, hour + 24));
  // the cloud comes in an hour or two before a spell and lingers after it;
  // a dry day has a cover of its own, broken
  const r = rng(day, 31);
  const cover = season === 'spring' ? 0.1 + r() * 0.25 : 0.25 + r() * 0.45;
  const near = Math.max(nearSpell(today, hour), nearSpell(yesterday, hour + 24));
  const cloud = clamp01(Math.max(cover, near * 0.85, falling * 1.4));
  // the mist lies on the lake from before dawn to two hours after, on a
  // still morning (none while it rains, little in the spring’s dry air)
  const { rise } = daylight(week);
  const dawn = clamp01(1 - Math.abs(hour - (rise + 0.4)) / 2.4);
  const calm = rng(day, 57)();
  const mist = clamp01(dawn * (calm < 0.7 ? 1 : 0.3) * (season === 'spring' ? 0.5 : 1) * (1 - falling * 1.5));
  const wind = clamp01(0.2 + falling * 0.6 + rng(day, 77)() * 0.25);
  const snow = season === 'winter' ? falling : 0;
  const rain = season === 'winter' ? 0 : falling;
  // snow lies once the winter comes, more each week of it, and goes in the spring
  const lying = season === 'winter' ? clamp01(0.55 + 0.15 * (week - SNOW_FROM)) : 0;
  const kind = snow > 0.05 ? 'snow' : rain > 0.05 ? 'rain' : mist > 0.3 ? 'mist' : cloud > 0.6 ? 'cloud' : 'clear';
  return { season, kind, rain, snow, mist, cloud, wind, lying };
}

// how close the hour is to a spell (1 inside it, falling off over two hours either side)
function nearSpell(spell, hour) {
  if (!spell.on) return 0;
  const before = spell.start - hour;
  const after = hour - (spell.start + spell.hours);
  const gap = Math.max(before, after, 0);
  return clamp01(1 - gap / 2);
}
