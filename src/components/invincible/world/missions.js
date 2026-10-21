// Season one of the Invincible world, and the radio's side calls, as rules
// (./InvWorld.jsx runs them in the world: it feeds what happened and acts
// on what comes out; ./scene.js draws the markers). Plain [x, y, z] arrays
// in metres, the city's frame (space's frame for the Moon: the Earth at
// the origin, ./orbit.js).
//
// A mission is `MISSIONS`'s entry: who gives it, where it starts, what's
// said, its steps, and the achievement at the end. `startMission(id, now)`
// gives its progress; `feedMission(progress, event)` takes one thing that
// happened and says what changed (`out`: the step begun, a count, `done`
// or `fail` and why). Each step is one kind of thing to do:
//
// - reach  at, r         fly or walk there (y null: any height)
// - land   at, r         touch down there (`at` can be `{ npc }`, `{ car }`)
// - slam   at, r, speed  land harder than `speed` there
// - talk   npc           E beside them
// - catch  n             rescues (./quests.js's `caught`; with `source`, only
//                        that kind: a mission's own, not the city's); with
//                        `beat: { kind, n }` those knocked out too, in either
//                        order; with `shake` and `every`, once they're down the
//                        mission asks for one more rescue there every so often
// - defeat kind, n       knock-outs (./foes.js's `ko`, each foe once); `spawn`
//                        says who comes; `since` counts from that step on (its
//                        own, unless it says); `upto` asks for that many in all
// - race   gates, r, time   the gates in order within the time (`ring`
//                        events from ./quests.js's course, or flying through)
// - escort npc, to, within, grace   stay within `within` of them (over `grace` s away fails) until they say they're at `to` and moving on (`dadAt`)
// - protect what, time   `what`'s hp (from `hurt`) stays above 0 for `time`
// - through at, r, speed fly through it faster than `speed`
// - use    id            E somewhere (Think, Mark!, a photo)
// - event  on            the world says so ({ type: on }: the launch's end, the sky's)
// - hits   kind, n       blows landed on a kind (./foes.js's `hit`, counted, not knock-outs)
//   a catch step with `soft` and a time ends when the time is up instead of failing
//   (episode 8's plaza: the ones not caught are the standing's loss, not Mark's)
//
// The events: { type: 'at', p, mode, speed, face, npcs?, car? } each frame
// (where he is, and where the people and the car the step cares about are),
// { type: 'tick', dt }, { type: 'talk', npc }, { type: 'caught', source },
// { type: 'ko', kind, id }, { type: 'ring', i } (and 'lesson-start', the
// first ring as the lesson starts), { type: 'hurt', what, hp },
// { type: 'use', id, won? }, { type: 'land', speed, p, body? },
// { type: 'hit', kind, id } (a blow landed), { type: <a step's `on`> },
// { type: 'abandon' }.

import { PORTAL } from './foes';
import { CALLS } from './lines';
import { RINGS, LESSON_LIMIT } from './quests';
import { COAST, rng } from './map';
import { SPACE, BODIES } from './orbit';

const MOON = BODIES.find((b) => b.id === 'moon');

// where things are that the city's map doesn't name
const PLACES = {
  // the bank, east of the plaza across the street (the tower there goes,
  // Task 9); its door on the pavement, facing the hall
  bank: { p: [65, 0, 0], door: [50, 0, 0], face: -Math.PI / 2 },
  gda: { p: [1588, 0, -386], door: [1588, 0, -373], face: 0 },
  hangar: { p: [1608, 0, -412], door: [1608, 0, -396], face: 0 },
  school: { p: [-2610, 0, -418], door: [-2610, 0, -395], face: 0 },
  roof: { p: [-2610, 12, -418] }, // the school's roof
  home: { p: [-2050.2, 0, 264], door: [-2050.2, 0, 256.5], face: Math.PI },
  downtown: { p: [40, 150, -60] }, // where Dad watches from
  river: { p: [1150, 120, -420] }, // over the river, by where the portal opens
  bridge: { p: [1150, 12, -440] }, // the middle bridge's deck
  plaza: { p: [24, 0, 27] }, // on the plaza before the hall (open ground), where the top of a tower comes down (episode 8)
  pad: { p: [1618, 0, -384] }, // the GDA's pad, where the world catches him (episode 8)
  coast: { p: [0, 30, COAST - 120] },
  sky: { p: [0, 2000, 1200] }, // the city from 2 km
};
export const placeOf = (id) => PLACES[id] ?? null;

// the way back from the Moon: three gates, a gentle curve to the top of
// the city's air (space's frame). Each, and the line between each, stays
// over the height where he'd fall back into the city's air: the middle one
// is 30 km up, a third of the way round from over the city toward the Moon
// (it was once inside the Earth, and the race couldn't be won).
const MOON_WAY = [MOON.c[0], 0, MOON.c[2]].map((v) => v / Math.hypot(MOON.c[0], MOON.c[2]));
const HOME_GATES = [
  MOON.c.map((v) => v * 0.68),
  [MOON_WAY[0] * 0.5 * (SPACE.RE + 30000), Math.cos(Math.PI / 6) * (SPACE.RE + 30000), MOON_WAY[2] * 0.5 * (SPACE.RE + 30000)],
  [0, SPACE.RE + 12000, 0],
];
// Eve's race round downtown, a loop of eight
// (each over a crossing, so none is in a tower)
const EVE_GATES = [
  [-200, 60, -200],
  [-40, 80, -360],
  [200, 70, -200],
  [360, 60, 40],
  [200, 70, 200],
  [40, 80, 360],
  [-200, 60, 200],
  [-360, 50, -40],
];
// Dad's four points for the talk, in the order he leads them: over downtown,
// the river and the school above the skyline (the tallest tower is 360 m; he
// flies straight from one to the next, over the city, not through it), then home
const DAD_POINTS = [
  [40, 380, -60],
  [1150, 380, -420],
  [-2610, 380, -418],
  [-2050.2, 40, 264],
];
// the photo spots: where to hover (a 20 m sphere), and the way to face
const PHOTOS = [
  { id: 'photo1', name: 'The Guardians’ hall from the plaza', p: [24, 3, 27], face: -2.4 },
  { id: 'photo2', name: 'The river from the middle bridge', p: [1150, 14, -440], face: Math.PI },
  { id: 'photo3', name: 'Downtown from the coast', p: [0, 30, COAST - 120], face: Math.PI },
  { id: 'photo4', name: 'Home from the street', p: [-2050.2, 2, 240], face: 0 },
  { id: 'photo5', name: 'The city from two kilometres', p: [0, 2000, 1200], face: Math.PI },
];

const reach = (at, r = 12, text, extra = {}) => ({ type: 'reach', at, r, text, marker: at, ...extra });
const step = (type, text, extra = {}) => ({ type, text, ...extra });

// Each named for its episode, in order; each opens the next, and a done
// one can be played again from Cecil.
export const MISSIONS = [
  {
    id: 'ep1',
    ep: 1,
    title: 'It’s About Time',
    colour: '#1d8fd6',
    giver: 'omni',
    start: { npc: 'omni', place: 'home' },
    intro: [['omni', 'Ten rings, in order, and I want to see you move.'], ['omni', 'Go.']],
    steps: [step('race', 'Dad’s rings: through all ten, in order', { gates: RINGS.map((q) => q.p), r: 9, time: LESSON_LIMIT, ring: true, marker: { gate: true } })],
    done: [['omni', 'Not bad. For a start.']],
    achievement: 'dadsrings',
  },
  {
    id: 'ep2',
    ep: 2,
    title: 'Here Goes Nothing',
    colour: '#e8452c',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda' },
    intro: [['cecil', 'The Mauler twins are in the bank downtown. Both of them. Don’t let them leave with it.']],
    steps: [
      reach(PLACES.bank.door, 18, 'Get to the bank', { y: null }),
      step('slam', 'Stop the getaway truck: land hard in front of it', { at: { car: true }, r: 15, speed: 20, marker: { car: true }, car: { from: PLACES.bank.door, speed: 22 } }),
      step('defeat', 'Put the Mauler twins down', { kind: 'mauler', n: 2, spawn: [['mauler', 2, { car: true }]], marker: { foe: true } }),
    ],
    done: [['cecil', 'Two Maulers and one truck. The bank will send a card.']],
    achievement: 'maulers',
  },
  {
    id: 'ep3',
    ep: 3,
    title: 'Who You Calling Ugly?',
    colour: '#2f9e5b',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda' },
    intro: [['cecil', 'Doc Seismic. Your school. He’s shaking it and there are kids on the roof.']],
    steps: [
      reach(PLACES.school.door, 30, 'Get to the school', { y: null, spawn: [['seismic', 1, PLACES.school.p]] }),
      // (one step, in either order: beaten first, he shakes nobody off, so the roof does it every 6 s)
      step('catch', 'Catch the students off the roof and put Doc Seismic down', { n: 4, source: 'mission', beat: { kind: 'seismic', n: 1, name: 'Doc Seismic' }, shake: PLACES.roof.p, every: 6, marker: { faller: true, foe: true } }),
    ],
    done: [['cecil', 'Four for four. Go and get the glass out of your hair.']],
    achievement: 'seismic',
  },
  {
    id: 'ep4',
    ep: 4,
    title: 'Neil Armstrong, Eat Your Heart Out',
    colour: '#7b4bd6',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda' },
    intro: [['cecil', 'Something’s parked on the Moon and it wants a word with Earth’s new guy. That’s you. Straight up.']],
    steps: [
      step('land', 'Land on the Moon', { body: 'moon', marker: { body: 'moon' } }),
      step('talk', 'Talk to Allen', { npc: 'allen', marker: { npc: 'allen' } }),
      step('race', 'Race Allen home: three gates to the top of the sky', { gates: HOME_GATES, r: 600, time: 150, marker: { gate: true } }),
    ],
    done: [['allen', 'You beat me. Nobody beats me. I’m putting that in the report.']],
    achievement: 'moonwalk',
  },
  {
    id: 'ep5',
    ep: 5,
    title: 'That Actually Hurt',
    colour: '#f08a1c',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda' },
    intro: [['cecil', 'Portal over the river. Flaxans, and this time they brought their big ones.']],
    steps: [
      step('defeat', 'The first wave: twelve Flaxans', { kind: 'flaxan', n: 12, spawn: [['flaxan', 12, PORTAL.p]], marker: { foe: true } }),
      step('defeat', 'The second wave: ten, and two of their elite', { kind: ['flaxan', 'flaxanElite'], n: 12, spawn: [['flaxan', 10, PORTAL.p], ['flaxanElite', 2, PORTAL.p]], marker: { foe: true } }),
      step('through', 'Shut the portal: through it, flat out', { at: PORTAL.p, r: PORTAL.r, speed: 120, marker: PORTAL.p }),
    ],
    done: [['cecil', 'Closed. That’s a first. Go home and sleep.']],
    achievement: 'flaxans',
  },
  {
    id: 'ep6',
    ep: 6,
    title: 'You Look Kinda Dead',
    colour: '#13a3a8',
    giver: 'cecil',
    start: { npc: 'cecil', place: 'gda' },
    intro: [['cecil', 'The Maulers made more Maulers. They’re coming up the river bank for the hangar. Hold it.']],
    steps: [
      step('protect', 'Hold the hangar for ninety seconds', { what: 'hangar', hp: 100, time: 90, at: PLACES.hangar.p, spawn: [['mauler', 2, [1560, 0, -440]]], wave: { kind: 'mauler', n: 2, every: 30, of: 6 }, marker: PLACES.hangar.door }),
      // (the ones beaten while he held it count; any not yet come, come now)
      step('defeat', 'Put every clone down', { kind: 'mauler', n: 6, since: 0, upto: ['mauler', 6, [1560, 0, -440]], marker: { foe: true } }),
    ],
    done: [['cecil', 'Six Maulers. There are days I think you’re worth the noise.']],
    achievement: 'gda',
  },
  {
    id: 'ep7',
    ep: 7,
    title: 'We Need to Talk',
    colour: '#d6336c',
    giver: 'omni',
    start: { npc: 'omni', place: 'home', time: ['dusk', 'night'], after: ['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6'] },
    intro: [['omni', 'Walk with me, Mark. Fly, I mean.']],
    steps: [
      ...DAD_POINTS.map((p, i) => step('escort', ['Follow Dad over downtown', 'Follow Dad over the river', 'Follow Dad over the school', 'Follow Dad home'][i], { npc: 'omni', to: p, within: 200, grace: 10, marker: { npc: 'omni' } })),
      step('land', 'Land at home', { at: PLACES.home.door, r: 12, marker: PLACES.home.door }),
      step('use', 'Think, Mark!', { id: 'thinkmark', marker: PLACES.home.door }),
    ],
    done: [['omni', 'Then we’ll talk again. Go inside, your mother’s waiting.']],
    achievement: 'season',
  },
  {
    id: 'ep8',
    ep: 8,
    title: 'Where I Really Come From',
    colour: '#c1121f',
    giver: 'omni',
    start: { npc: 'omni', place: 'home', time: ['dusk', 'night'], after: ['ep1', 'ep2', 'ep3', 'ep4', 'ep5', 'ep6', 'ep7'] },
    intro: [['omni', 'Mark. There’s something I should have told you a long time ago.']],
    steps: [
      // 1. the porch: what he is, in panels (the world feeds `use panels` as they end)
      step('use', 'Listen to Dad', { id: 'panels', marker: PLACES.home.door }),
      // 2. the hit: Mark a projectile down the street into the river (the world feeds `recover` as he comes up)
      step('event', 'Get up', { on: 'recover', marker: PLACES.river.p }),
      // 3. the chase: three blows on Dad across downtown, each answered
      step('hits', 'Hit him. Three times.', { kind: 'omniman', n: 3, spawn: [['omniman', 1, 'hero']], marker: { npc: 'omni' } }),
      // 4. the people: the top of a tower comes down on the plaza; twelve to catch, one after another, in a minute
      step('catch', 'Catch them', { n: 12, source: 'mission', shake: PLACES.plaza.p, every: 2.5, time: 60, soft: true, marker: PLACES.plaza.p }),
      // 5. the sky: up through the clouds, the five hundred years, and Dad gone (the world feeds `sky`)
      step('event', 'Say it', { on: 'sky', marker: { npc: 'omni' } }),
    ],
    done: [['cecil', 'He’s gone. Get some rest, kid. We’ll talk in the morning.']],
    achievement: 'truth',
  },
  // the radio's side calls (`side`): one at a time, when nothing else is on
  {
    id: 'chase',
    side: true,
    title: 'A car running the grid',
    colour: '#f5c518',
    giver: 'cecil',
    intro: [['cecil', 'Stolen car heading downtown at speed. Land in front of it before somebody gets hurt.']],
    steps: [step('land', 'Stop the car: land just ahead of it', { at: { car: true }, r: 12, time: 45, marker: { car: true }, car: { speed: 28 } })],
    done: [['cecil', 'Stopped. The owner says thanks and asks about the roof.']],
  },
  {
    id: 'everace',
    side: true,
    title: 'Race Eve round downtown',
    colour: '#f5c518',
    giver: 'eve',
    intro: [['eve', 'Eight gates round downtown. Beat my time and I’ll admit you can fly.']],
    steps: [step('race', 'Eve’s gates: all eight, in order', { gates: EVE_GATES, r: 12, time: 60, marker: { gate: true } })],
    done: [['eve', 'Fine. You can fly. A bit.']],
  },
  ...PHOTOS.map((q) => ({
    id: q.id,
    side: true,
    title: q.name,
    colour: '#f5c518',
    giver: 'cecil',
    intro: [['cecil', `The GDA wants a picture: ${q.name.charAt(0).toLowerCase()}${q.name.slice(1)}. Hover in the spot, face it, and press E.`]],
    steps: [step('use', `Take the photo: ${q.name.charAt(0).toLowerCase()}${q.name.slice(1)}`, { id: 'photo', at: q.p, r: 20, face: q.face, within: Math.PI / 9, marker: q.p })],
    done: [['cecil', 'Got it. Don’t quit your day job.']],
  })),
];
const BY_ID = Object.fromEntries(MISSIONS.map((m) => [m.id, m]));
export const missionOf = (id) => BY_ID[id] ?? null;
export const STORY = MISSIONS.filter((m) => !m.side).map((m) => m.id);
export const PHOTO_SPOTS = PHOTOS;

const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
const flat = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// a to b, within r (b's y null: any height)
const within = (a, b, r) => (b[1] == null ? flat(a, b) : dist(a, b)) <= r;
// the angle round from one heading to another, 0..π
const turn = (a, b) => Math.abs(((((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

// Progress: which step, how far through it, the clock, what's protected,
// and the last place things were seen (for the markers and the car).
export function startMission(id, now = 0) {
  const m = BY_ID[id];
  if (!m) return null;
  // (kos: who's been knocked out since it began, by foe id, and in which step)
  return { id, step: 0, count: 0, t: 0, stepT: 0, shakeT: 0, hp: m.steps[0].hp ?? null, best: null, started: now, seen: { npcs: {}, car: null, p: null }, kos: {}, away: 0, done: false, fail: null };
}

// the step's `out` entry as it begins (what it needs set up: who to spawn, a car)
const begin = (m, i) => ({ type: 'step', i, text: m.steps[i].text, spawn: m.steps[i].spawn ?? null, car: m.steps[i].car ?? null, wave: m.steps[i].wave ?? null, upto: m.steps[i].upto ?? null });
// the same for the step under way (the first one, just after startMission)
export const stepOf = (p) => (p && !p.done && !p.fail && BY_ID[p.id]?.steps[p.step] ? begin(BY_ID[p.id], p.step) : null);

// how many of `kind` (one or a list) have been knocked out since step `since`
const isKind = (want, kind) => (Array.isArray(want) ? want.includes(kind) : want === kind);
const beaten = (p, kind, since) => Object.values(p.kos ?? {}).filter((k) => k.step >= since && isKind(kind, k.kind)).length;

export function feedMission(prev, ev) {
  if (!prev || prev.done || prev.fail) return { progress: prev, out: [] };
  const m = BY_ID[prev.id];
  const p = { ...prev, kos: { ...prev.kos }, seen: { ...prev.seen, npcs: { ...prev.seen.npcs } } };
  const out = [];
  const s = m.steps[p.step];
  // a catch step's knock-outs to go with its rescues (counted from the start)
  const beatDone = (q) => !q.beat || beaten(p, q.beat.kind, q.beat.since ?? 0) >= q.beat.n;
  const next = () => {
    p.step++;
    p.count = 0;
    p.stepT = 0;
    p.shakeT = 0;
    p.away = 0;
    if (p.step >= m.steps.length) {
      p.done = true;
      p.best = p.t;
      out.push({ type: 'done', time: p.t, achievement: m.achievement ?? null });
    } else {
      const q = m.steps[p.step];
      p.hp = q.hp ?? p.hp;
      out.push(begin(m, p.step));
      // a defeat step that counts from an earlier one may be part done, or done, already
      if (q.type === 'defeat') {
        p.count = beaten(p, q.kind, q.since ?? p.step);
        if (p.count >= q.n) next();
      }
    }
  };
  const fail = (why) => {
    p.fail = why;
    out.push({ type: 'fail', why, time: p.t });
  };
  const count = (n = 1) => {
    p.count += n;
    out.push({ type: 'count', count: p.count, of: s.n ?? s.gates?.length ?? null });
  };
  // where a step's `at` is right now
  const target = (at) => (at?.car ? p.seen.car : at?.npc ? p.seen.npcs[at.npc] : at);

  switch (ev.type) {
    case 'abandon':
      fail('abandoned');
      break;
    case 'tick': {
      const dt = Math.min(0.05, Math.max(0, ev.dt || 0));
      p.t += dt;
      p.stepT += dt;
      if (s.type === 'protect') {
        if (p.stepT >= s.time) next();
      } else if (s.time != null && p.stepT > s.time) {
        if (s.soft) next();
        else fail(s.type === 'race' ? 'time' : 'late');
      }
      else if (s.type === 'catch' && s.shake && (!s.beat || beatDone(s)) && p.count < s.n) {
        // no quakes left to shake them off: the roof gives one up every so often
        p.shakeT += dt;
        if (p.shakeT >= s.every) {
          p.shakeT -= s.every;
          out.push({ type: 'shake', at: [...s.shake] });
        }
      } else if (s.type === 'escort' && p.seen.p && p.seen.npcs[s.npc]) {
        // too far from them for too long
        p.away = dist(p.seen.p, p.seen.npcs[s.npc]) > s.within ? p.away + dt : 0;
        if (p.away >= s.grace) fail('left');
      }
      break;
    }
    case 'at': {
      p.seen.p = [...ev.p];
      if (ev.face != null) p.seen.face = ev.face;
      if (ev.npcs) for (const k of Object.keys(ev.npcs)) if (ev.npcs[k]) p.seen.npcs[k] = [...ev.npcs[k]];
      if (ev.car !== undefined) p.seen.car = ev.car ? [...ev.car] : null;
      if (s.type === 'reach' && within(ev.p, s.y === null ? [s.at[0], null, s.at[2]] : s.at, s.r)) next();
      else if (s.type === 'race' && !s.ring) {
        const g = s.gates[p.count];
        if (g && within(ev.p, g, s.r)) {
          count();
          if (p.count >= s.gates.length) next();
        }
      } else if (s.type === 'through' && within(ev.p, s.at, s.r)) {
        if ((ev.speed ?? 0) > s.speed) next();
      }
      break;
    }
    case 'dadAt':
      // (Dad at his point and moving on, which he does once Mark is close by
      // him: the step is done when he says so, so the two never disagree)
      if (s.type === 'escort' && s.npc === 'omni') next();
      break;
    case 'lesson-start':
    case 'ring':
      // (the lesson's start is its first ring: either says so, the other then doesn't count again)
      if (s.type === 'race' && s.ring && (ev.type === 'ring' ? ev.i : 0) === p.count) {
        count();
        if (p.count >= s.gates.length) next();
      }
      break;
    case 'land': {
      if (s.type === 'land' && s.body) {
        if (ev.body === s.body) next();
      } else if (s.type === 'land' || s.type === 'slam') {
        const at = target(s.at);
        if (at && ev.p && within(ev.p, at, s.r) && (s.type === 'land' || (ev.speed ?? 0) >= s.speed)) next();
      }
      break;
    }
    case 'talk':
      if (s.type === 'talk' && ev.npc === s.npc) next();
      break;
    case 'caught':
      if (s.type === 'catch' && (!s.source || ev.source === s.source)) {
        count();
        if (p.count >= s.n && beatDone(s)) next();
      }
      break;
    case 'ko': {
      // each foe once (one with no id is its own), with the step it went down in
      const key = ev.id ?? `n${Object.keys(p.kos).length}`;
      if (p.kos[key]) break;
      p.kos[key] = { kind: ev.kind, step: p.step };
      if (s.type === 'defeat' && isKind(s.kind, ev.kind)) {
        p.count = beaten(p, s.kind, s.since ?? p.step);
        out.push({ type: 'count', count: p.count, of: s.n });
        if (p.count >= s.n) next();
      } else if (s.type === 'catch' && s.beat && isKind(s.beat.kind, ev.kind)) {
        out.push({ type: 'count', count: p.count, of: s.n });
        if (p.count >= s.n && beatDone(s)) next();
      }
      break;
    }
    case 'hurt':
      if (s.type === 'protect' && ev.what === s.what) {
        p.hp = ev.hp;
        out.push({ type: 'hp', hp: p.hp });
        if (p.hp <= 0) fail('lost');
      }
      break;
    case 'hit':
      if (s.type === 'hits' && isKind(s.kind, ev.kind)) {
        count();
        out.push({ type: 'driven', n: p.count, of: s.n }); // (Dad answers each one)
        if (p.count >= s.n) next();
      }
      break;
    case 'use':
      if (s.type === 'use' && ev.id === s.id) {
        // (a photo wants him in its spot, facing the right way)
        if (s.at && !(p.seen.p && within(p.seen.p, s.at, s.r) && turn(ev.face ?? p.seen.face ?? 0, s.face) <= s.within)) break;
        next();
      }
      break;
    default:
      if (s.type === 'event' && ev.type === s.on) next();
      break;
  }
  return { progress: p, out };
}

// ── the radio: a side call every 60–120 s while no mission is on and he's
// in the city: a chase, a photo spot not yet taken (the five in turn, then
// any), Eve's race while she's flying beside him, or Cecil's portal while
// nothing's fighting (never the same call twice running; nothing while a
// story mission is on, or out in space) ──
export const RADIO = { every: [60, 120], offer: 20 }; // seconds between calls; how long one waits before it's dropped
// the calls that aren't missions: taken, the Flaxans come through over the
// river (./foes.js's invasion), Cecil's recorded line said as they do
export const RADIO_CALLS = { portal: CALLS.portal };
export function newRadio(seed = 11) {
  const r = rng(seed);
  return { t: 0, next: RADIO.every[0] + r() * (RADIO.every[1] - RADIO.every[0]), n: 0, last: null, seed };
}
// state: { mission: id | null, zone: 'city' | 'space', eve: true while she's beside him, fight: true while foes are up, done: [ids] }
export function nextRadioCall(prev, dt, state = {}) {
  const radio = { ...prev };
  const step = Math.min(0.05, Math.max(0, dt || 0));
  if (state.mission || state.zone === 'space') return { radio, call: null };
  radio.t += step;
  if (radio.t < radio.next) return { radio, call: null };
  const r = rng(radio.seed + radio.n * 7);
  radio.n += 1;
  radio.t = 0;
  radio.next = RADIO.every[0] + r() * (RADIO.every[1] - RADIO.every[0]);
  const done = new Set(Array.isArray(state.done) ? state.done : []);
  const photos = PHOTOS.map((q) => q.id).filter((id) => !done.has(id));
  const pool = [];
  if (radio.last !== 'chase') pool.push('chase');
  // (the one left untaken was the last call: no photo this time, rather than one already taken)
  const photo = photos.find((id) => id !== radio.last) ?? (photos.length ? null : PHOTOS.map((q) => q.id).find((id) => id !== radio.last));
  if (photo) pool.push(photo);
  if (state.eve && radio.last !== 'everace') pool.push('everace');
  if (!state.fight && radio.last !== 'portal') pool.push('portal');
  const call = pool[Math.floor(r() * pool.length)] ?? null;
  radio.last = call;
  return { radio, call };
}

// the next episode to play, or null once the season's done
export function nextStory(doneIds = []) {
  const done = new Set(Array.isArray(doneIds) ? doneIds : []);
  return STORY.find((id) => !done.has(id)) ?? null;
}

// where the current step's marker is: a point, or whatever the scene
// says is there now ({ npcs: { id: p }, foes: [p…], car: p, faller: p,
// bodies: { moon: p } })
export function markerOf(progress, scene = {}) {
  if (!progress || progress.done || progress.fail) return null;
  const s = BY_ID[progress.id]?.steps[progress.step];
  if (!s) return null;
  const mk = s.marker;
  if (!mk) return null;
  if (Array.isArray(mk)) return [...mk];
  if (mk.gate) return s.gates[progress.count] ? [...s.gates[progress.count]] : null;
  if (mk.npc) return scene.npcs?.[mk.npc] ? [...scene.npcs[mk.npc]] : (progress.seen.npcs[mk.npc] ?? null);
  if (mk.car) return scene.car ? [...scene.car] : (progress.seen.car ?? null);
  // (a catch-and-beat step: the one falling, until all are caught; then him)
  if (mk.faller && !(mk.foe && progress.count >= (s.n ?? 0))) return scene.faller ? [...scene.faller] : [...PLACES.roof.p];
  if (mk.foe) return scene.foes?.length ? [...scene.foes[0]] : null;
  if (mk.body) return scene.bodies?.[mk.body] ? [...scene.bodies[mk.body]] : null;
  return null;
}

// what's saved (`tp-inv-world-story`), from anything
export function loadStory(saved) {
  const out = { done: [], best: {} };
  if (!saved || typeof saved !== 'object') return out;
  if (Array.isArray(saved.done)) out.done = [...new Set(saved.done.filter((id) => typeof id === 'string' && BY_ID[id]))];
  if (saved.best && typeof saved.best === 'object') for (const [id, t] of Object.entries(saved.best)) if (BY_ID[id] && Number.isFinite(t) && t > 0) out.best[id] = t;
  return out;
}
// and the same with a mission just done
export function keepStory(story, id, time) {
  const s = loadStory(story);
  if (!s.done.includes(id)) s.done.push(id);
  if (Number.isFinite(time) && time > 0 && (s.best[id] == null || time < s.best[id])) s.best[id] = time;
  return s;
}
