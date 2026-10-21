// Every named figure’s day (the design’s §4.8): where each of the castle’s
// people is at every hour of the world’s day, and where they are on the way
// between. The Marauder’s Map draws its footprints from here and the
// walkers (cast/walkers.js) stand the figures where it says, so the Map is
// also how you find anyone: Hagrid at his hut by day and in the Three
// Broomsticks on a Saturday night, Snape in his dungeons, Filch on his
// rounds after curfew with Mrs Norris ahead of him, the prefects on the
// Grand Staircase, the students between the hall, the lawns, the library
// and their common rooms, the ghosts on their floors, Peeves anywhere.
//
// Pure in time: a figure’s place is worked out from the world’s clock, not
// stepped, so the Map, the walkers and a test always agree, and a night
// slept through or a clock set from the Menu lands everyone where they
// would be. A day is a list of [hour, where] (where a spot of
// rules/paths.js, a round, or another figure to keep ahead of); each is set
// off for at its hour along the paths at the figure’s pace, and a walk not
// finished when the next is due turns for the next from where it is. The
// road over the viaduct and down the glen is ridden (the carriages that
// pull themselves, on the Map a pair of wheel ruts). Time is the world’s,
// in hours since the arrival day’s midnight (rules/clock.js’s `t`).
//
//   HOUR_S (real seconds a world hour), CURFEW, DAWN, CARRIAGE
//   ROSTER: [{ id, name, kind, house, cast, ghost }]   ROUNDS: { id: [spot…] }
//   dayKind(day) → 'weekday' | 'weekend': every third world day is a Saturday
//   dayName(day) → 'Monday' … for the Map’s corner
//   dayOf(id, day, week) → [[hour, where, { rest }]…]: the figure’s day as it stands that week
//   whereIs(id, time, week) → { place, walking, ride, round, inside, rest }: the spot it is at or bound for
//   positionAt(id, time, week, out?) → { x, z, dx, dz (its heading), moving, ride, place, at,
//     inside (null on the grounds, 'castle', or a room’s id), rest, round (its name, on one) }
//   everyone(time, week, out?) → [{ id, …positionAt }]: every figure at once, for the Map

import { indoorAt, pathOf, route, spotById } from './paths';

export const HOUR_S = 60; // real seconds a world hour (rules/clock.js: a world day is 24 real minutes)
export const CURFEW = 21;
export const DAWN = 6;
export const CARRIAGE = { speed: 9 }; // m/s: the carriages on the road (rules/paths.js’s `ride` stretches)
// a figure standing about: its own place within `share` of the spot’s r, and a
// new step within `r` m of it every `slot` hours at `pace` m/s (short enough to
// be finished within the slot, so nobody is ever caught mid-stride by the next)
const WANDER = { slot: 0.2, pace: 0.6, share: 0.55, r: 2.4 };

// m/s going somewhere (a world hour is a real minute, so a walk across the castle takes one), and walking a round
const PACE = { student: 2.4, prefect: 2.4, staff: 2.0, hagrid: 2.9, filch: 1.4, cat: 1.7, ghost: 1.6, peeves: 4.5 };
const ROUND_PACE = { filch: 1.3, prefects: 1.5, snape: 1.6, baron: 1.2 };

export const dayKind = (day) => ((((Math.floor(day) % 3) + 3) % 3) === 2 ? 'weekend' : 'weekday');
const NAMES = ['Monday', 'Tuesday', 'Saturday'];
export const dayName = (day) => NAMES[((Math.floor(day) % 3) + 3) % 3];

// The term’s days out of the ordinary (rules/term.js has the weeks)
export const CHRISTMAS = 6;
export const LEAVING = 12;
export const MATCH_WEEKS = [3, 7, 10];
export const HOGSMEADE_FROM = 3;

// Filch’s rounds after curfew, the prefects’ on the staircase, Snape’s in the dungeons
export const ROUNDS = {
  filch: ['filch-office', 'entrance', 'staircase', 'corridor-west', 'charms', 'corridor-west', 'staircase', 'staffroom', 'corridor-north', 'library', 'restricted', 'library', 'corridor-north', 'defence', 'corridor-north', 'requirement', 'corridor-north', 'staffroom', 'staircase', 'entrance', 'below', 'dungeons', 'potions', 'dungeons', 'below', 'entrance'],
  prefects: ['staircase', 'fat-lady', 'staircase', 'witch', 'staircase', 'courtyard-door'],
  snape: ['potions', 'dungeons', 'below', 'entrance', 'below', 'dungeons'],
  baron: ['slytherin', 'potions', 'dungeons', 'below', 'kitchens', 'below', 'dungeons', 'potions'],
};

const COMMON = { gryffindor: 'gryffindor', ravenclaw: 'ravenclaw', hufflepuff: 'hufflepuff', slytherin: 'slytherin' };
const TABLE = { gryffindor: 'table-gryffindor', ravenclaw: 'table-ravenclaw', hufflepuff: 'table-hufflepuff', slytherin: 'table-slytherin' };
const REST = { rest: true };

// A student’s days: three lessons a weekday on one of two timetables, the
// meals at the house’s table, an hour free, the common room by curfew; a
// Saturday of lie-in, the lawns and the library, or the pitch on a match
// day, or the village from the third week. `out`: a night’s outing of
// their own after curfew (the Map’s first owners were out every night).
function student({ house, a, b, free = 'courtyard', evening = null, saturday = ['lawn', 'library'], out = [] }) {
  const bed = COMMON[house];
  const table = TABLE[house];
  const school = (lessons) => [
    [0, bed, REST],
    [6.8, table],
    [8.3, lessons[0]],
    [11.1, lessons[1]],
    [13.3, table],
    [14.5, lessons[2]],
    [17.1, free],
    [18.6, table],
    [19.9, evening ?? bed],
    [21, bed, REST],
    ...out,
  ];
  return {
    a: school(a),
    b: school(b),
    weekend: [[0, bed, REST], [8.2, table], [9.6, saturday[0]], [12.6, table], [13.8, saturday[1]], [18.4, table], [19.8, bed], [21, bed, REST], ...out],
    match: [[0, bed, REST], [7.8, table], [9.2, 'pitch'], [13.4, table], [14.6, saturday[1]], [18.4, table], [19.8, bed], [21, bed, REST], ...out],
    village: [[0, bed, REST], [7.6, table], [8.8, saturday.includes('library') ? 'broomsticks' : 'honeydukes'], [12.2, 'high-street'], [13.2, saturday.includes('library') ? 'honeydukes' : 'broomsticks'], [15.4, table], [18.4, table], [19.8, bed], [21, bed, REST], ...out],
  };
}

// the staff’s days: a teacher teaches where they teach and eats at the high table
function teacher({ room, bed = 'staffroom', evening = null, saturday = null, night = null }) {
  const day = [[0, bed, REST], [6.6, 'high-table'], [8.0, room], [13.1, 'high-table'], [14.2, room], [18.4, 'high-table'], [19.8, evening ?? room], [22.5, bed, REST]];
  if (night) day.splice(7, 0, ...night);
  return { a: day, b: day, weekend: saturday ?? day };
}

export const ROSTER_DAYS = {
  // the three
  harry: { name: 'Harry Potter', kind: 'student', house: 'gryffindor', cast: 'harry', ...student({ house: 'gryffindor', a: ['charms', 'potions', 'greenhouses'], b: ['defence', 'charms', 'lawn'], free: 'lawn', saturday: ['pitch', 'lawn'] }) },
  ron: { name: 'Ron Weasley', kind: 'student', house: 'gryffindor', cast: 'ron', ...student({ house: 'gryffindor', a: ['charms', 'potions', 'greenhouses'], b: ['defence', 'charms', 'lawn'], free: 'lawn', saturday: ['pitch', 'courtyard'] }) },
  hermione: { name: 'Hermione Granger', kind: 'student', house: 'gryffindor', cast: 'hermione', ...student({ house: 'gryffindor', a: ['charms', 'potions', 'greenhouses'], b: ['defence', 'charms', 'lawn'], free: 'library', evening: 'library', saturday: ['library', 'library'] }) },
  // the rest of Gryffindor
  neville: { name: 'Neville Longbottom', kind: 'student', house: 'gryffindor', cast: 'neville', ...student({ house: 'gryffindor', a: ['charms', 'potions', 'greenhouses'], b: ['defence', 'charms', 'lawn'], free: 'greenhouses', saturday: ['greenhouses', 'lawn'] }) },
  ginny: { name: 'Ginny Weasley', kind: 'student', house: 'gryffindor', cast: 'student', ...student({ house: 'gryffindor', a: ['potions', 'charms', 'lawn'], b: ['charms', 'defence', 'greenhouses'], free: 'courtyard', saturday: ['pitch', 'courtyard'] }) },
  fred: { name: 'Fred Weasley', kind: 'student', house: 'gryffindor', cast: 'student', twin: true, ...student({ house: 'gryffindor', a: ['defence', 'charms', 'potions'], b: ['potions', 'defence', 'charms'], free: 'courtyard', saturday: ['pitch', 'courtyard'], out: [[22.6, 'kitchens'], [23.6, 'gryffindor', REST]] }) },
  george: { name: 'George Weasley', kind: 'student', house: 'gryffindor', cast: 'student', twin: true, ...student({ house: 'gryffindor', a: ['defence', 'charms', 'potions'], b: ['potions', 'defence', 'charms'], free: 'courtyard', saturday: ['pitch', 'courtyard'], out: [[22.6, 'witch'], [23.6, 'gryffindor', REST]] }) },
  percy: { name: 'Percy Weasley', kind: 'prefect', house: 'gryffindor', cast: 'student', ...prefect('gryffindor', 'library') },
  // Ravenclaw
  luna: { name: 'Luna Lovegood', kind: 'student', house: 'ravenclaw', cast: 'student3', ...student({ house: 'ravenclaw', a: ['potions', 'charms', 'lawn'], b: ['charms', 'defence', 'greenhouses'], free: 'courtyard', saturday: ['lawn', 'library'] }) },
  cho: { name: 'Cho Chang', kind: 'student', house: 'ravenclaw', cast: 'student3', ...student({ house: 'ravenclaw', a: ['greenhouses', 'defence', 'charms'], b: ['lawn', 'potions', 'charms'], free: 'library', saturday: ['pitch', 'library'] }) },
  penelope: { name: 'Penelope Clearwater', kind: 'prefect', house: 'ravenclaw', cast: 'student3', ...prefect('ravenclaw', 'library') },
  // Hufflepuff
  cedric: { name: 'Cedric Diggory', kind: 'student', house: 'hufflepuff', cast: 'student2', ...student({ house: 'hufflepuff', a: ['greenhouses', 'defence', 'charms'], b: ['lawn', 'potions', 'charms'], free: 'lawn', saturday: ['pitch', 'lawn'] }) },
  hannah: { name: 'Hannah Abbott', kind: 'student', house: 'hufflepuff', cast: 'student2', ...student({ house: 'hufflepuff', a: ['greenhouses', 'defence', 'charms'], b: ['lawn', 'potions', 'charms'], free: 'greenhouses', saturday: ['lawn', 'library'] }) },
  // Slytherin
  malfoy: { name: 'Draco Malfoy', kind: 'student', house: 'slytherin', cast: 'malfoy', ...student({ house: 'slytherin', a: ['potions', 'charms', 'greenhouses'], b: ['charms', 'defence', 'lawn'], free: 'courtyard', saturday: ['pitch', 'courtyard'] }) },
  crabbe: { name: 'Vincent Crabbe', kind: 'student', house: 'slytherin', cast: 'student4', ...student({ house: 'slytherin', a: ['potions', 'charms', 'greenhouses'], b: ['charms', 'defence', 'lawn'], free: 'courtyard', saturday: ['pitch', 'courtyard'] }) },
  goyle: { name: 'Gregory Goyle', kind: 'student', house: 'slytherin', cast: 'student4', ...student({ house: 'slytherin', a: ['potions', 'charms', 'greenhouses'], b: ['charms', 'defence', 'lawn'], free: 'courtyard', saturday: ['pitch', 'courtyard'] }) },
  // the staff
  dumbledore: { name: 'Albus Dumbledore', kind: 'staff', cast: 'dumbledore', ...teacher({ room: 'headmaster', bed: 'headmaster', evening: 'astronomy', saturday: [[0, 'headmaster', REST], [7.4, 'high-table'], [9.0, 'headmaster'], [12.6, 'high-table'], [14.0, 'stone-circle'], [18.4, 'high-table'], [19.8, 'astronomy'], [22.8, 'headmaster', REST]] }) },
  mcgonagall: { name: 'Minerva McGonagall', kind: 'staff', cast: 'mcgonagall', ...teacher({ room: 'staffroom', bed: 'gryffindor', evening: 'staircase' }) },
  snape: { name: 'Severus Snape', kind: 'staff', cast: 'snape', ...teacher({ room: 'potions', bed: 'slytherin', evening: 'library', night: [[21.2, { round: 'snape' }]] }) },
  flitwick: { name: 'Filius Flitwick', kind: 'staff', cast: 'flitwick', ...teacher({ room: 'charms', bed: 'ravenclaw' }) },
  sprout: { name: 'Pomona Sprout', kind: 'staff', cast: 'sprout', ...teacher({ room: 'greenhouses', bed: 'hufflepuff', evening: 'greenhouses' }) },
  hooch: { name: 'Rolanda Hooch', kind: 'staff', cast: 'hooch', ...teacher({ room: 'lawn', evening: 'pitch', saturday: [[0, 'staffroom', REST], [7.4, 'high-table'], [8.8, 'pitch'], [13.4, 'high-table'], [14.6, 'pitch'], [18.4, 'high-table'], [19.8, 'staffroom', REST]] }) },
  pince: { name: 'Irma Pince', kind: 'staff', cast: 'pince', ...teacher({ room: 'library', evening: 'restricted' }) },
  pomfrey: { name: 'Poppy Pomfrey', kind: 'staff', cast: null, a: [[0, 'hospital', REST], [7.0, 'high-table'], [8.4, 'hospital']], b: [[0, 'hospital', REST], [7.0, 'high-table'], [8.4, 'hospital']], weekend: [[0, 'hospital', REST], [8.0, 'hospital']] },
  hagrid: {
    name: 'Rubeus Hagrid',
    kind: 'hagrid',
    cast: 'hagrid',
    a: [[0, 'hut', REST], [6.4, 'pumpkins'], [8.6, 'paddock'], [12.4, 'hut'], [13.6, 'forest-edge'], [16.2, 'high-table'], [19.6, 'hut'], [21.6, 'hut', REST]],
    b: [[0, 'hut', REST], [6.4, 'paddock'], [9.8, 'willow'], [11.6, 'pumpkins'], [13.0, 'hut'], [14.4, 'clearing'], [17.4, 'hut'], [21.4, 'hut', REST]],
    // (a Saturday: the pumpkins, then down to the village for the evening, back after closing)
    weekend: [[0, 'hut', REST], [7.6, 'pumpkins'], [11.0, 'hut'], [15.0, 'broomsticks'], [23.2, 'hut'], [23.9, 'hut', REST]],
  },
  filch: {
    name: 'Argus Filch',
    kind: 'filch',
    cast: 'filch',
    a: [[0, { round: 'filch' }], [4.6, 'filch-office', REST], [9.0, 'entrance'], [12.6, 'staircase'], [15.0, 'filch-office'], [19.0, 'entrance'], [20.4, 'filch-office'], [CURFEW, { round: 'filch' }]],
  },
  norris: {
    name: 'Mrs Norris',
    kind: 'cat',
    cast: null,
    a: [[0, { follow: 'filch', lead: 9 }], [4.6, 'filch-office', REST], [8.4, 'corridor-west'], [11.0, 'library'], [13.6, 'staircase'], [16.0, 'corridor-north'], [19.0, 'entrance'], [20.4, 'filch-office'], [CURFEW, { follow: 'filch', lead: 9 }]],
  },
  rosmerta: { name: 'Rosmerta', kind: 'staff', cast: 'rosmerta', a: [[0, 'broomsticks', REST], [8.0, 'broomsticks']] },
  aberforth: { name: 'Aberforth Dumbledore', kind: 'staff', cast: 'barman', a: [[0, 'hogshead', REST], [9.0, 'hogshead'], [13.0, 'village-head'], [13.8, 'hogshead']] },
  // the ghosts, who glide through what the living walk round
  nick: { name: 'Nearly Headless Nick', kind: 'ghost', cast: 'nick', a: [[0, 'gryffindor'], [3.0, 'staircase'], [7.0, 'table-gryffindor'], [9.0, 'fat-lady'], [12.4, 'table-gryffindor'], [14.0, 'corridor-west'], [18.4, 'table-gryffindor'], [20.0, 'gryffindor']] },
  greylady: { name: 'The Grey Lady', kind: 'ghost', cast: 'greylady', a: [[0, 'ravenclaw'], [4.0, 'restricted'], [7.0, 'table-ravenclaw'], [9.0, 'library'], [12.4, 'table-ravenclaw'], [14.0, 'astronomy'], [18.4, 'table-ravenclaw'], [20.0, 'ravenclaw']] },
  friar: { name: 'The Fat Friar', kind: 'ghost', cast: 'friar', a: [[0, 'hufflepuff'], [5.0, 'kitchens'], [7.0, 'table-hufflepuff'], [9.0, 'entrance'], [12.4, 'table-hufflepuff'], [14.0, 'kitchens'], [18.4, 'table-hufflepuff'], [20.0, 'hufflepuff']] },
  baron: { name: 'The Bloody Baron', kind: 'ghost', cast: 'baron', a: [[0, { round: 'baron' }], [7.0, 'table-slytherin'], [9.0, 'dungeons'], [12.4, 'table-slytherin'], [14.0, { round: 'baron' }], [18.4, 'table-slytherin'], [20.0, { round: 'baron' }]] },
  peeves: { name: 'Peeves', kind: 'peeves', cast: 'peeves', a: null },
};

// a prefect’s day: a student’s, and the staircase after supper until the castle’s abed
function prefect(house, study) {
  const s = student({ house, a: ['charms', 'potions', 'defence'], b: ['defence', 'charms', 'potions'], free: study, saturday: ['library', study] });
  const late = (day) => day.map((e) => (e[0] === 19.9 || e[0] === 19.8 ? [e[0], { round: 'prefects' }] : e[0] === 21 ? [22.4, COMMON[house], REST] : e));
  return { a: late(s.a), b: late(s.b), weekend: late(s.weekend), match: late(s.match), village: late(s.village) };
}

export const ROSTER = Object.entries(ROSTER_DAYS).map(([id, f]) => ({ id, name: f.name, kind: f.kind, house: f.house ?? null, cast: f.cast ?? null, ghost: f.kind === 'ghost' }));
const FIG = new Map(Object.entries(ROSTER_DAYS));

// Peeves’s day: anywhere in the castle, a new somewhere every forty minutes,
// the same somewhere every time the same day is asked about
const HAUNTS = ['entrance', 'staircase', 'witch', 'fat-lady', 'corridor-west', 'charms', 'corridor-north', 'library', 'defence', 'requirement', 'astronomy', 'kitchens', 'dungeons', 'potions', 'courtyard', 'hall', 'staffroom', 'filch-office'];
function peevesDay(day) {
  let a = (Math.imul(Math.floor(day) + 77, 2654435761) >>> 0) || 1;
  const rnd = () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
  const out = [];
  for (let h = 0; h < 24; h += 0.66) out.push([Math.round(h * 100) / 100, HAUNTS[Math.floor(rnd() * HAUNTS.length)]]);
  return out;
}

// the figure’s day as it stands in a week: the term’s feasts, its Saturdays
export function dayOf(id, day, week = 1) {
  const f = FIG.get(id);
  if (!f) return null;
  if (id === 'peeves') return peevesDay(day);
  const kind = dayKind(day);
  const second = ((Math.floor(day) % 3) + 3) % 3 === 1;
  let base;
  if (kind === 'weekend') {
    if (MATCH_WEEKS.includes(week) && f.match) base = f.match;
    else if (week >= HOGSMEADE_FROM && week !== LEAVING && f.village) base = f.village;
    else base = f.weekend ?? f.a;
  } else base = (second ? f.b : f.a) ?? f.a;
  // at Christmas and at the leaving feast, supper is the feast and everyone comes
  if ((week === CHRISTMAS || week === LEAVING) && feasts(f)) return withFeast(base, f, week);
  return base;
}

const feasts = (f) => f.kind === 'student' || f.kind === 'prefect' || f.kind === 'staff' || f.kind === 'ghost' || f.kind === 'hagrid';
const FEAST = { from: 18.2, to: 21.4 };
function withFeast(base, f, week) {
  const seat = f.kind === 'student' || f.kind === 'prefect' || f.kind === 'ghost' ? (f.house ? TABLE[f.house] : ghostTable(f)) : 'high-table';
  if (!seat) return base;
  const before = base.filter((e) => e[0] < FEAST.from - (f.kind === 'hagrid' ? 3.2 : 0));
  const after = base.filter((e) => e[0] >= FEAST.to + (week === LEAVING ? 0.6 : 0));
  // (the bed after it, if the day had one later; else the last place before)
  const bed = base.find((e) => e[2]?.rest && e[0] > 0)?.[1] ?? base[0][1];
  const end = after.length ? after : [[FEAST.to + (week === LEAVING ? 0.6 : 0), bed, REST]];
  return [...before, [FEAST.from - (f.kind === 'hagrid' ? 3.2 : 0), seat], ...end];
}
const GHOST_TABLE = { nick: 'table-gryffindor', greylady: 'table-ravenclaw', friar: 'table-hufflepuff', baron: 'table-slytherin' };
const ghostTable = (f) => GHOST_TABLE[[...FIG.entries()].find(([, v]) => v === f)?.[0]] ?? null;

// ── walking it ──

const LOOPS = new Map();
function loopOf(name) {
  let loop = LOOPS.get(name);
  if (loop) return loop;
  const ids = ROUNDS[name];
  const all = [];
  for (let i = 0; i < ids.length; i++) {
    const leg = route(ids[i], ids[(i + 1) % ids.length]);
    all.push(...(i === 0 ? leg : leg.slice(1)));
  }
  loop = pathOf(all);
  LOOPS.set(name, loop);
  return loop;
}

const paceOf = (f) => PACE[f.kind] ?? PACE.student;
const glides = (f) => f.kind === 'ghost' || f.kind === 'peeves';

// a stable number from a few strings and numbers (FNV-1a, then a mix)
function hash(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    h = Math.imul(h ^ 0x9e37, 2654435761);
  }
  return h >>> 0;
}
// a point in a disc of radius r, from a hash
function inDisc(h, r, out = [0, 0]) {
  const a = (h % 6283) / 1000;
  const d = Math.sqrt(((h >>> 13) % 1000) / 1000) * r;
  out[0] = Math.cos(a) * d;
  out[1] = Math.sin(a) * d;
  return out;
}
// (a seed and a step’s number mixed, for the standing about: numbers only, it is read every frame)
const mix = (seed, n) => {
  let h = Math.imul(seed ^ (n + 0x7f4a7c15), 2654435761);
  h ^= h >>> 15;
  return Math.imul(h, 2246822519) >>> 0;
};
const ZERO = [0, 0];
const P0 = [0, 0];
const P1 = [0, 0];

// Where a figure stands at a spot: its own place in it, so a lawn has
// people across it and a table has them along it, not all on one point
function homeOf(id, spotId) {
  const s = spotById(spotId);
  const [ox, oz] = inDisc(hash(id, spotId), s.r * (s.r > 4 ? WANDER.share : 0.4));
  return [s.at[0] + ox, s.at[1] + oz];
}

// A path’s times: the seconds each corner is reached at, walking at
// `pace` and riding the carriages’ stretches at theirs
function timed(path, pace) {
  const times = [0];
  for (let i = 1; i < path.points.length; i++) times.push(times[i - 1] + (path.lengths[i] - path.lengths[i - 1]) / (path.rides[i] ? CARRIAGE.speed : pace));
  path.times = times;
  path.dur = times[times.length - 1];
  return path;
}

// a point along a path `sec` seconds in (by its times) or `s` metres in:
// [x, z], the heading, the stretch it is on and how far along it
function along(path, s, out, byTime = false) {
  const { points } = path;
  const marks = byTime ? path.times : path.lengths;
  const end = marks[marks.length - 1];
  let i = 1;
  if (points.length === 1) {
    out.x = points[0][0];
    out.z = points[0][1];
    out.seg = 0;
    out.k = 1;
    out.s = 0;
    return out;
  }
  const d = Math.max(0, Math.min(s, end));
  while (i < marks.length - 1 && marks[i] < d) i++;
  const a = points[i - 1];
  const b = points[i];
  const span = marks[i] - marks[i - 1];
  const k = span > 0 ? (d - marks[i - 1]) / span : 1;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  out.x = a[0] + (b[0] - a[0]) * k;
  out.z = a[1] + (b[1] - a[1]) * k;
  if (l > 1e-6) {
    out.dx = (b[0] - a[0]) / l;
    out.dz = (b[1] - a[1]) / l;
  }
  out.seg = i;
  out.k = k;
  out.s = path.lengths[i - 1] + l * k;
  return out;
}

// A day’s legs, worked out once and kept: each starts where the last had
// got to by its hour (the day before’s end carried over midnight, and a
// round walked on through it), and is a path to the figure’s place at a
// spot (then standing about there), a path onto a round, or a catch-up to
// the figure it follows
const DAYS = new Map();
const KEEP = 600;
function legsOf(id, day, week, depth = 1) {
  const key = `${id}|${day}|${week}|${depth}`;
  const kept = DAYS.get(key);
  if (kept) return kept;
  const f = FIG.get(id);
  const list = dayOf(id, day, week);
  let from;
  let yLast = null;
  if (depth > 0) {
    const y = legsOf(id, day - 1, week, depth - 1);
    yLast = y.legs[y.legs.length - 1];
    from = endOf(yLast, 24, f, y.ctx);
  } else {
    const first = list[0][1];
    const s = typeof first === 'string' ? first : first.round ? ROUNDS[first.round][0] : 'filch-office';
    const [x, z] = typeof first === 'string' ? homeOf(id, s) : spotById(s).at;
    from = { x, z, prev: s, next: s };
  }
  const ctx = { id, day, week };
  const legs = [];
  for (let i = 0; i < list.length; i++) {
    const [t0, where, opts] = list[i];
    let leg;
    // (a round that was being walked at midnight goes on, rather than starting over)
    if (i === 0 && yLast?.round && where?.round === yLast.round && !where.lead) leg = { ...yLast, t0: yLast.t0 - 24, arrive: yLast.arrive - 24 };
    else leg = makeLeg(f, id, t0, where, opts, from, ctx);
    legs.push(leg);
    const t1 = i + 1 < list.length ? list[i + 1][0] : 24;
    from = endOf(leg, t1, f, ctx);
  }
  const out = { legs, ctx };
  DAYS.set(key, out);
  if (DAYS.size > KEEP) DAYS.delete(DAYS.keys().next().value);
  return out;
}

// a leg from a state to somewhere: the path there (by the paths, or straight
// for those who glide), ridden where the carriages go, then a place to
// stand at, a round, or a figure to keep ahead of
function makeLeg(f, id, t0, where, opts = {}, from, ctx) {
  const pace = paceOf(f);
  const rest = Boolean(opts?.rest);
  if (where?.follow) {
    // (the start of a catch-up: how far the one followed is at its hour)
    const lead = positionAt(where.follow, ctx.day * 24 + t0, ctx.week, {});
    const d0 = Math.hypot(lead.x - from.x, lead.z - from.z);
    return { t0, kind: 'follow', where: lead.place, follow: where.follow, lead: where.lead ?? 0, from: [from.x, from.z], d0, pace, rest, arrive: t0 + d0 / pace / HOUR_S };
  }
  const round = where?.round ?? null;
  const goal = round ? ROUNDS[round][0] : where;
  const ids = glides(f) ? [goal] : (route(from.next, goal) ?? [goal]);
  const home = round ? spotById(goal).at : homeOf(id, goal);
  const path = timed(pathOf(ids, [from.x, from.z], from.prev, home), pace);
  return { t0, kind: round ? 'round' : 'spot', where: goal, round, lead: where?.lead ?? 0, rest, path, home, pace, slow: ROUND_PACE[round] ?? pace, arrive: t0 + path.dur / HOUR_S, seed: hash(id, goal, t0) };
}

// where a leg has got to by a time (the hand-off to the next)
function endOf(leg, t, f, ctx) {
  const p = place(leg, t, f, {}, ctx);
  return { x: p.x, z: p.z, prev: p.prev, next: p.next };
}

// a figure on a leg at a time (hours into its day): walking its path,
// standing about at its place, on its round, or a step ahead of another
function place(leg, t, f, out, ctx) {
  const since = (t - leg.t0) * HOUR_S;
  out.ride = false;
  out.rest = false;
  out.round = null;
  if (leg.kind === 'follow') return follow(leg, t, out, ctx);
  if (since < leg.path.dur) {
    along(leg.path, since, out, true);
    out.moving = true;
    out.ride = leg.path.rides[out.seg] ?? false;
    out.place = leg.where;
    out.at = false;
    out.prev = leg.path.names[out.seg - 1] ?? leg.where;
    out.next = leg.path.names[out.seg] ?? leg.where;
    out.path = leg.path;
    out.then = leg.round;
    return out;
  }
  out.then = null;
  if (leg.round) {
    const loop = loopOf(leg.round);
    const s = (since - leg.path.dur) * leg.slow + leg.lead;
    along(loop, ((s % loop.length) + loop.length) % loop.length, out);
    out.moving = true;
    out.round = leg.round;
    out.place = loop.names[out.seg] ?? leg.where;
    out.at = false;
    out.prev = loop.names[out.seg - 1] ?? leg.where;
    out.next = loop.names[out.seg] ?? leg.where;
    out.path = loop;
    return out;
  }
  // there: standing about its place (a seat or a bed keeps still)
  out.place = leg.where;
  out.at = true;
  out.prev = leg.where;
  out.next = leg.where;
  out.rest = leg.rest;
  out.path = null;
  if (leg.rest || f.kind === 'peeves') {
    out.x = leg.home[0];
    out.z = leg.home[1];
    out.moving = false;
    return out;
  }
  wander(leg, since - leg.path.dur, out);
  return out;
}

// Standing about: a new spot a little way from its place every
// WANDER.slot hours, walked to slowly, eased in from where it arrived (so
// nobody steps sideways the moment they get somewhere)
function wander(leg, since, out) {
  const slotS = WANDER.slot * HOUR_S;
  const n = Math.floor(since / slotS);
  const p0 = n === 0 ? ZERO : inDisc(mix(leg.seed, n - 1), WANDER.r, P0);
  const p1 = inDisc(mix(leg.seed, n), WANDER.r, P1);
  const into = since - n * slotS;
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  const k = len > 1e-6 ? Math.min(1, (into * WANDER.pace) / len) : 1;
  out.x = leg.home[0] + p0[0] + (p1[0] - p0[0]) * k;
  out.z = leg.home[1] + p0[1] + (p1[1] - p0[1]) * k;
  out.moving = k < 1 && len > 0.05;
  if (out.moving) {
    out.dx = (p1[0] - p0[0]) / len;
    out.dz = (p1[1] - p0[1]) / len;
  }
}

// Keeping ahead of another (Mrs Norris on Filch’s rounds): its place
// `lead` metres on along the way the other is going, caught up with from
// where this leg began at the figure’s own pace
const LEADER = {};
function follow(leg, t, out, ctx) {
  const o = positionAt(leg.follow, ctx.day * 24 + t, ctx.week, LEADER);
  let tx = o.x;
  let tz = o.z;
  let hx = o.dx ?? 0;
  let hz = o.dz ?? 1;
  if (o.path && leg.lead) {
    const p = {};
    const s = o.s + leg.lead;
    // (on the way to a round, the lead runs on past the way’s end onto the round itself)
    if (o.then && s > o.path.length) along(loopOf(o.then), s - o.path.length, p);
    else along(o.path, o.round ? ((s % o.path.length) + o.path.length) % o.path.length : s, p);
    tx = p.x;
    tz = p.z;
    hx = p.dx ?? hx;
    hz = p.dz ?? hz;
  }
  const k = leg.d0 > 0.01 ? Math.min(1, ((t - leg.t0) * HOUR_S * leg.pace) / leg.d0) : 1;
  out.x = leg.from[0] + (tx - leg.from[0]) * k;
  out.z = leg.from[1] + (tz - leg.from[1]) * k;
  if (k < 1) {
    const l = Math.hypot(tx - leg.from[0], tz - leg.from[1]) || 1;
    out.dx = (tx - leg.from[0]) / l;
    out.dz = (tz - leg.from[1]) / l;
  } else {
    out.dx = hx;
    out.dz = hz;
  }
  out.moving = k < 1 || o.moving;
  out.place = o.place;
  out.at = k >= 1 && o.at;
  out.prev = o.prev;
  out.next = o.next;
  out.round = o.round;
  out.rest = o.rest;
  out.path = null;
  out.seg = o.seg;
  out.k = o.k;
  return out;
}

// ── reading it ──

const split = (time) => {
  const day = Math.floor(time / 24);
  return { day, hour: time - day * 24 };
};

export function positionAt(id, time, week = 1, out = {}) {
  const f = FIG.get(id);
  if (!f) return null;
  const { day, hour } = split(time);
  const { legs, ctx } = legsOf(id, day, week);
  let leg = legs[0];
  for (const l of legs) if (l.t0 <= hour) leg = l;
  place(leg, hour, f, out, ctx);
  out.dx ??= 0;
  out.dz ??= 1;
  out.inside = insideOf(out);
  return out;
}

// what the figure is in: its spot’s inside where it stands, the stretch’s where it walks
function insideOf(p) {
  if (p.at) return spotById(p.place)?.inside ?? null;
  if (!p.prev || !p.next || p.prev === p.next) return spotById(p.next ?? p.place)?.inside ?? null;
  return indoorAt(p.prev, p.next, p.k ?? 0);
}

export function whereIs(id, time, week = 1) {
  const p = positionAt(id, time, week);
  if (!p) return null;
  return { place: p.place, walking: Boolean(p.moving && !p.at), ride: p.ride, round: p.round ?? null, inside: p.inside, rest: p.rest };
}

const EVERY = ROSTER.map((r) => r.id);
export function everyone(time, week = 1, out = []) {
  for (let i = 0; i < EVERY.length; i++) {
    const o = (out[i] ??= { id: EVERY[i] });
    positionAt(EVERY[i], time, week, o);
  }
  out.length = EVERY.length;
  return out;
}
