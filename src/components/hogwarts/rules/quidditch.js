// Quidditch, the Seeker’s game, as a sim (docs/superpowers/specs/
// 2026-10-21-hogwarts-world-design.md §4.6). You are the Seeker; the
// other twelve fly their own loops round you: three Chasers a side passing
// the Quaffle and putting it through the hoops now and then (the score runs
// on its own, ten a goal, from a seeded timeline), a Keeper a side swaying
// at the hoops, two Beaters a side batting the Bludgers off (one of yours
// shadows you). Two Bludgers hunt whoever is nearest. The Snitch wanders,
// keeps its distance from a Seeker and darts when one is near, then tires
// a moment, which is when it can be had. The other Seeker steers for it a
// little worse than you can at the first match and better by the third.
// Catch it (within 1.5 m, E) and the match is over; the score decides it
// by the book’s rule, the catch worth 150. Pure and seeded: the same seed
// plays the same match.
//
// The pitch’s own frame: the middle of the grass at the origin, x along
// the long axis (the hoops at ±PITCH.hoopX, ours at −x), z across, y up.
// play/snitch.js puts it where the pitch stands.
//
//   PITCH, CATCH, FOES, SNITCH, BLUDGER, fixtures(house) → the term’s three
//   newMatch({ n, house, seed, practice, at }) → a match
//   stepMatch(match, input, dt) → match (its events in match.ev)
//   playersAt(match) → the twelve, where they are now
//   quaffleAt(match) → where the Quaffle is
//   result(match) → { type: 'match', n, house, against, us, them, caught,
//     won, draw } once it is over (null before)
//   seekerBot(match) → the input a Seeker who knows what they’re doing gives
//   lineFor(event, match, k) → the commentator’s line for an event

import { seeded } from '../../../lib/seeded';
import { BROOM, hit, mount, stepBroom } from './flight';

export const PITCH = {
  length: 152, // the oval’s long axis (the book’s five hundred feet)
  width: 56, // and across
  hoopX: 66, // the hoops at either end
  hoops: [
    { z: -7, y: 12.5, r: 1.6 },
    { z: 0, y: 15.5, r: 1.6 },
    { z: 7, y: 12.5, r: 1.6 },
  ],
  top: 34, // the play goes no higher than this over the grass
};
export const CATCH = 1.5; // metres from the Snitch, with E
export const GOAL = 10;
export const SNITCH_POINTS = 150;
// the Snitch: its speeds (m/s), how near a Seeker makes it flee and dart,
// and how long it darts and tires for; after `fatigue` seconds of a match
// it flees slower and slower, so a match always ends
export const SNITCH = { wander: 8, flee: 15, dart: 20, dartFor: 0.3, tired: 7, tiredFor: 3, keep: 14, near: 3.5, dartEvery: 4, turn: 30, fatigue: 300, worn: 8, spent: 0.6 };
// the other Seeker, match by match: top speed, how quickly it gets there,
// how far it can see the Snitch from (outside that it searches, flying a
// loop of the pitch), how stale its sight of it is (seconds), how fast it
// turns, and how long it has to keep within reach to close its hand
export const FOES = [
  { top: 12, accel: 4, sight: 12, lag: 1, turn: 0.85, grab: 1.1 },
  { top: 16, accel: 5, sight: 22, lag: 0.7, turn: 1.2, grab: 0.4 },
  { top: 19, accel: 6.5, sight: 32, lag: 0.45, turn: 1.6, grab: 0.3 },
];
export const BLUDGER = { speed: 14, accel: 9, bat: 3, batted: 22, rest: 1.8, hitR: 1.2, knockR: 1 };
// the chance a goal is ours, match by match (the third side is the best)
const OURS = [0.55, 0.5, 0.45];
const HOUSE_ORDER = ['slytherin', 'ravenclaw', 'hufflepuff'];

// the term’s three matches: Slytherin, Ravenclaw, Hufflepuff, Gryffindor
// standing in for whichever of them is yours
export const fixtures = (house) => HOUSE_ORDER.map((h) => (h === house ? 'gryffindor' : h));

const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// the play’s box: the Snitch and the Bludgers keep in it
const BOX = { x: PITCH.length / 2 + 6, z: PITCH.width / 2 + 6, y0: 2, y1: PITCH.top };

// the score’s timeline: a goal every so often, ours or theirs
function goalsFor(n, rand, until = 1500) {
  const goals = [];
  let t = 6 + rand() * 6;
  while (t < until) {
    goals.push({ t, side: rand() < OURS[n - 1] ? 'us' : 'them' });
    t += 9 - Math.log(1 - rand()) * 16;
  }
  return goals;
}

export function newMatch({ n = 1, house = 'gryffindor', seed = 1, practice = false, at = null } = {}) {
  const rand = seeded(seed * 7919 + n);
  const against = practice ? null : fixtures(house)[n - 1];
  const start = at ?? { x: -PITCH.hoopX + 12, y: 0, z: 0, yaw: Math.PI / 2 };
  const you = { ...mount(start), p: [start.x, 8, start.z] };
  return {
    n,
    house,
    against,
    practice,
    seed,
    t: 0,
    rand: Math.floor(rand() * 2 ** 31),
    you,
    foe: practice ? null : { p: [PITCH.hoopX - 12, 9, 2], yaw: -Math.PI / 2, spd: 0, slow: 0, held: 0 },
    // (released in the middle, it goes up and off somewhere of its own first)
    snitch: { p: [0, 10, 0], v: [0, 6, 0], mode: 'wander', left: 0, dartReady: 0, darts: 0, target: [(rand() * 2 - 1) * 50, 22, (rand() < 0.5 ? -1 : 1) * 22], retarget: 6 },
    trail: [], // where the Snitch was, for the other Seeker’s stale sight
    bludgers: practice ? [] : [0, 1].map((i) => ({ p: [0, 10 + i * 3, i ? 8 : -8], v: [i ? -6 : 6, 0, 0], rest: 2 })),
    goals: practice ? [] : goalsFor(n, rand),
    next: 0,
    score: { us: 0, them: 0 },
    over: false,
    caught: null,
    ev: [],
  };
}

// the match’s own random, stepped (pure: the state carries it)
function roll(m) {
  const r = seeded(m.rand);
  const x = r();
  m.rand = Math.floor(r() * 2 ** 31);
  return x;
}

// The twelve on their loops. Each loop is a pure function of the match’s
// time, so the drawing and the sim agree; the one of your Beaters who
// minds you flies off your shoulder instead.
const ROLES = ['chaser', 'chaser', 'chaser', 'beater', 'beater', 'keeper'];
export function playersAt(m) {
  if (m.practice) return [];
  const out = [];
  for (const team of ['us', 'them']) {
    const end = team === 'us' ? -1 : 1; // the end a team defends
    for (const [i, role] of ROLES.entries()) {
      const ph = i * 2.1 + (team === 'us' ? 0 : 1.3);
      const t = m.t;
      let p;
      if (role === 'keeper') p = [end * (PITCH.hoopX - 3), 13 + 1.5 * Math.sin(t * 1.1 + ph), 6 * Math.sin(t * 0.7 + ph)];
      else if (role === 'chaser') {
        const w = 0.16;
        p = [55 * Math.sin(w * t + ph), 9 + 4 * Math.sin(0.5 * t + ph), 18 * Math.sin(2 * (w * t + ph))];
      } else if (team === 'us' && i === 3) {
        // the Beater who minds you: above and behind, swinging round
        const y = m.you.p;
        p = [y[0] - Math.sin(m.you.yaw) * 4 + 2 * Math.cos(t), y[1] + 2.5, y[2] - Math.cos(m.you.yaw) * 4 + 2 * Math.sin(t)];
      } else p = [40 * Math.sin(0.11 * t + ph), 12 + 3 * Math.sin(0.4 * t), 22 * Math.cos(0.11 * t + ph)];
      out.push({ team, role, i, p });
    }
  }
  // the scorer of a goal coming takes the Quaffle to the hoops in its last seconds
  const g = m.goals[m.next];
  if (g && g.t - m.t < RUN) {
    const k = clamp(1 - (g.t - m.t) / RUN, 0, 1);
    const who = out.find((o) => o.team === g.side && o.role === 'chaser' && o.i === quaffleHolder(m, g.side));
    const hoop = hoopOf(g);
    const e = k * k * (3 - 2 * k);
    who.p = who.p.map((v, j) => v + (hoop[j] - v) * e);
  }
  return out;
}
const RUN = 4; // seconds a scorer’s run at the hoops takes
// the hoop a goal goes through: at the other side’s end, one of three by the time
function hoopOf(g) {
  const h = PITCH.hoops[Math.floor(g.t * 7) % 3];
  return [(g.side === 'us' ? 1 : -1) * PITCH.hoopX, h.y, h.z];
}
// who has the Quaffle: the side scoring next, passing it every three
// seconds among its Chasers (the side that just conceded has it first)
function quaffleHolder(m, side) {
  return Math.floor(m.t / 3 + (side === 'us' ? 0 : 1)) % 3;
}
export function quaffleAt(m) {
  if (m.practice) return null;
  const g = m.goals[m.next];
  const side = g ? g.side : 'us';
  const who = playersAt(m).find((o) => o.team === side && o.role === 'chaser' && o.i === quaffleHolder(m, side));
  return [who.p[0], who.p[1] + 0.4, who.p[2]];
}

export function stepMatch(m0, input = {}, dt) {
  if (m0.over) return { ...m0, ev: [] };
  const m = { ...m0, ev: [], score: { ...m0.score } };
  m.t = m0.t + dt;

  // you, on the broom
  m.you = stepBroom(m0.you, input, dt);
  if (m.you.mode === 'ground') m.you = { ...m.you, mode: 'air' }; // (a match is played in the air: touching down is a skim)

  // the score, on its own
  while (m.goals[m.next] && m.goals[m.next].t <= m.t) {
    const g = m.goals[m.next];
    m.score[g.side] += GOAL;
    m.next += 1;
    m.ev.push({ type: 'goal', side: g.side, score: { ...m.score } });
  }

  // the Snitch, the other Seeker, the Bludgers
  m.snitch = stepSnitch(m, m0.snitch, dt);
  m.trail = [...m0.trail, { t: m.t, p: m.snitch.p }].filter((s) => m.t - s.t <= 1.6);
  if (m0.foe) m.foe = stepFoe(m, m0.foe, dt);
  const players = playersAt(m);
  m.bludgers = m0.bludgers.map((b) => stepBludger(m, b, players, dt));

  // the catch
  const d = v3.dist(m.you.p, m.snitch.p);
  if (input.catch && d <= CATCH && m.you.tumble === 0) return end(m, 'you');
  // (the other Seeker’s hand closes quicker on a worn-out Snitch)
  if (m.foe && m.foe.held >= (FOES[m.n - 1] ?? FOES[0]).grab * (1 - 0.75 * wornAt(m.t))) return end(m, 'them');
  if (d < 6 && v3.dist(m0.you.p, m0.snitch.p) >= 6) m.ev.push({ type: 'near' });
  return m;
}

function end(m, by) {
  const score = { ...m.score };
  if (!m.practice) score[by === 'you' ? 'us' : 'them'] += SNITCH_POINTS;
  m.ev.push({ type: 'caught', by, score });
  return { ...m, score, over: true, caught: by };
}

export function result(m) {
  if (!m.over || m.practice) return null;
  const { us, them } = m.score;
  return { type: 'match', n: m.n, house: m.house, against: m.against, us, them, caught: m.caught, won: us > them, draw: us === them, seconds: Math.round(m.t) };
}

function stepSnitch(m, s0, dt) {
  const s = { ...s0 };
  // away from every Seeker in reach, the nearer the more (so it never
  // flees one straight into the other’s hands)
  let d = Infinity;
  const push = [0, 0, 0];
  for (const p of [m.you.p, m.foe?.p]) {
    if (!p) continue;
    const e = v3.dist(p, s.p);
    d = Math.min(d, e);
    if (e > SNITCH.keep) continue;
    const w = 1 / Math.max(e, 0.5) ** 2;
    for (let j = 0; j < 3; j++) push[j] += (s.p[j] - p[j]) * w;
  }
  const away3 = v3.norm(push);
  const awayFlat = v3.norm(flat(push));
  const worn = wornAt(m.t);
  // (and each dart takes a little out of it: a chase that goes on is one
  // it starts to lose)
  const flee = Math.max(SNITCH.worn, SNITCH.flee + (SNITCH.worn - SNITCH.flee) * worn - SNITCH.spent * s.darts);
  s.dartReady = Math.max(0, s.dartReady - dt);
  s.left = Math.max(0, s.left - dt);
  let want = null;
  let speed = SNITCH.wander;
  if (s.mode === 'dart') {
    if (s.left === 0) Object.assign(s, { mode: 'tired', left: SNITCH.tiredFor });
  } else if (s.mode === 'tired') {
    speed = SNITCH.tired;
    want = d <= SNITCH.keep ? awayFlat : null;
    if (s.left === 0) s.mode = 'wander';
  } else if (d < SNITCH.near && s.dartReady === 0 && worn < 1) {
    // a dart: square to the Seeker’s line, left or right as it falls
    const away = awayFlat;
    const side = roll(m) < 0.5 ? 1 : -1;
    const dir = v3.norm([-away[2] * side + away[0] * 0.4, (roll(m) - 0.4) * 0.5, away[0] * side + away[2] * 0.4]);
    Object.assign(s, { mode: 'dart', left: SNITCH.dartFor, dartReady: SNITCH.dartEvery * (1 + 3 * worn), darts: s.darts + 1, v: v3.scale(dir, SNITCH.dart) });
    m.ev.push({ type: 'dart' });
  } else if (d < SNITCH.keep) {
    // away, swerving, mostly level (a broom can’t follow it straight up)
    const away = away3;
    const sw = Math.sin(m.t * 2.3) * 0.5 * (1 - worn); // (a worn-out Snitch flies straighter)
    want = v3.norm([away[0] - away[2] * sw, away[1] * 0.3, away[2] + away[0] * sw]);
    speed = flee;
  } else {
    s.retarget -= dt;
    if (s.retarget <= 0 || v3.dist(s.p, s.target) < 3) {
      s.target = [(roll(m) * 2 - 1) * (BOX.x - 12), BOX.y0 + 3 + roll(m) * (BOX.y1 - BOX.y0 - 8), (roll(m) * 2 - 1) * (BOX.z - 8)];
      s.retarget = 4 + roll(m) * 3;
    }
    want = v3.norm(v3.sub(s.target, s.p));
  }
  if (s.mode !== 'dart') {
    // the box keeps it in: at a wall it slides along it rather than
    // turning back into the Seeker behind it (a cornered Snitch was a
    // caught one, by whoever happened to be chasing)
    const out = [s.p[0] > BOX.x ? 1 : s.p[0] < -BOX.x ? -1 : 0, s.p[1] > BOX.y1 ? 1 : s.p[1] < BOX.y0 ? -1 : 0, s.p[2] > BOX.z ? 1 : s.p[2] < -BOX.z ? -1 : 0];
    if (out.some((o) => o)) {
      const w = want ?? [0, 0, 0];
      const slide = w.map((c, j) => (out[j] && Math.sign(c) === out[j] ? 0 : c) - out[j] * 0.35);
      // (straight into a corner: along the wall it hit, the way it swerves)
      if (Math.hypot(slide[0], slide[2]) < 0.5) slide[out[0] ? 2 : 0] += Math.sin(m.t * 2.3) >= 0 ? 1 : -1;
      want = v3.norm(slide);
    }
    const goal = want ? v3.scale(want, speed) : [0, 0, 0];
    const dv = v3.sub(goal, s.v);
    const l = v3.len(dv);
    const k = Math.min(1, (SNITCH.turn * dt) / (l || 1));
    s.v = [s.v[0] + dv[0] * k, s.v[1] + dv[1] * k, s.v[2] + dv[2] * k];
  } else if (Math.abs(s.p[0]) > BOX.x || Math.abs(s.p[2]) > BOX.z) s.v = [-s.v[0] * (Math.abs(s.p[0]) > BOX.x ? 1 : -1), s.v[1], -s.v[2] * (Math.abs(s.p[2]) > BOX.z ? 1 : -1)];
  s.p = [s.p[0] + s.v[0] * dt, clamp(s.p[1] + s.v[1] * dt, 1, BOX.y1 + 2), s.p[2] + s.v[2] * dt];
  return s;
}
const flat = (a) => [a[0], 0, a[2]];
// how worn out the Snitch is, 0 to 1, from `fatigue` seconds in over three minutes
export const wornAt = (t) => clamp((t - SNITCH.fatigue) / 180, 0, 1);

function stepFoe(m, f0, dt) {
  const skill = FOES[(m.n ?? 1) - 1] ?? FOES[0];
  const f = { ...f0 };
  f.slow = Math.max(0, f.slow - dt);
  // it sees the Snitch within its sight, and keeps after it a few seconds
  // once it has; else it searches, a loop of the pitch at a steady height
  const d = v3.dist(f.p, m.snitch.p);
  // (the longer a match goes, the further it sees: the stands are shouting)
  f.seen = d <= skill.sight + m.t * 0.1 ? FOE_MEMORY : Math.max(0, (f.seen ?? 0) - dt);
  const sees = f.seen > 0;
  const k = m.t * 0.12;
  // (its sight is `lag` seconds stale far off; close in, it sees it as it is)
  const lag = skill.lag * Math.min(1, d / 20);
  const seen = sees ? (m.trail.find((s) => m.t - s.t <= lag)?.p ?? m.snitch.p) : [Math.sin(k) * 55, 14, Math.cos(k) * 20];
  const to = v3.sub(seen, f.p);
  const diff = wrap(Math.atan2(to[0], to[2]) - f.yaw);
  // (slow, a broom turns tighter: it brakes for a Snitch behind it)
  const turn = skill.turn * clamp(12 / Math.max(f.spd, 1), 1, 3);
  f.yaw = f.yaw + clamp(diff, -turn * dt, turn * dt);
  f.held = d <= CATCH ? f.held + dt : 0;
  // (close in, it matches the Snitch’s pace rather than flying through it)
  const pace = Math.hypot(m.snitch.v[0], m.snitch.v[2]);
  const top = f.slow > 0 ? 4 : !sees ? skill.top * 0.7 : Math.abs(diff) > 1.2 ? 5 : Math.min(skill.top, pace + Math.max(0, d - 1) * 1.2);
  f.spd = f.spd < top ? Math.min(top, f.spd + skill.accel * dt) : Math.max(top, f.spd - 10 * dt);
  const climb = clamp(to[1], -6, 6);
  f.p = [f.p[0] + Math.sin(f.yaw) * f.spd * dt, clamp(f.p[1] + climb * dt, 1, BOX.y1), f.p[2] + Math.cos(f.yaw) * f.spd * dt];
  return f;
}
const FOE_MEMORY = 4; // seconds the other Seeker keeps after a Snitch it has lost sight of

function stepBludger(m, b0, players, dt) {
  const b = { ...b0 };
  b.rest = Math.max(0, b.rest - dt);
  // a Beater near enough bats it off, away from them and up
  for (const o of players) {
    if (o.role !== 'beater' || v3.dist(o.p, b.p) > BLUDGER.bat || b.rest > 0) continue;
    const away = v3.norm(v3.sub(b.p, o.p));
    b.v = v3.scale(v3.norm([away[0] + (roll(m) - 0.5), 0.4, away[2] + (roll(m) - 0.5)]), BLUDGER.batted);
    b.rest = BLUDGER.rest;
    m.ev.push({ type: 'batted', team: o.team });
    return move(b, dt);
  }
  if (b.rest === 0) {
    // the nearest one not holding a bat
    let aim = null;
    let best = Infinity;
    const who = [{ id: 'you', p: m.you.p }, ...(m.foe ? [{ id: 'foe', p: m.foe.p }] : []), ...players.filter((o) => o.role !== 'beater').map((o) => ({ id: `${o.team}-${o.role}-${o.i}`, p: o.p }))];
    for (const w of who) {
      const d = v3.dist(w.p, b.p);
      if (d < best) {
        best = d;
        aim = w;
      }
    }
    const want = v3.scale(v3.norm(v3.sub(aim.p, b.p)), BLUDGER.speed);
    const dv = v3.sub(want, b.v);
    const k = Math.min(1, (BLUDGER.accel * dt) / (v3.len(dv) || 1));
    b.v = [b.v[0] + dv[0] * k, b.v[1] + dv[1] * k, b.v[2] + dv[2] * k];
    if (best <= (aim.id === 'you' ? BLUDGER.hitR : BLUDGER.knockR)) {
      b.rest = BLUDGER.rest;
      b.v = v3.scale(b.v, -0.5);
      if (aim.id === 'you') {
        if (m.you.tumble === 0) {
          m.you = hit(m.you, v3.norm(b0.v));
          m.ev.push({ type: 'bludger' });
        }
      } else if (aim.id === 'foe') {
        m.foe = { ...m.foe, slow: BROOM.tumble };
        m.ev.push({ type: 'knock', who: 'foe' });
      } else m.ev.push({ type: 'knock', who: aim.id });
    }
  }
  return move(b, dt);
}
function move(b, dt) {
  const p = [b.p[0] + b.v[0] * dt, b.p[1] + b.v[1] * dt, b.p[2] + b.v[2] * dt];
  const v = [...b.v];
  // off the box’s walls, the way a heavy iron ball does
  if (Math.abs(p[0]) > BOX.x) v[0] = -Math.sign(p[0]) * Math.abs(v[0]);
  if (Math.abs(p[2]) > BOX.z) v[2] = -Math.sign(p[2]) * Math.abs(v[2]);
  if (p[1] > BOX.y1 || p[1] < BOX.y0) v[1] = (p[1] < BOX.y0 ? 1 : -1) * Math.abs(v[1]);
  return { ...b, p, v };
}

// A Seeker who knows the game: aims where the Snitch will be, flat out
// when it’s far, matching its pace when it’s close, braking to turn when
// it’s behind, and reaching for it the moment it’s in reach.
export function seekerBot(m) {
  const y = m.you;
  const s = m.snitch;
  const d = v3.dist(y.p, s.p);
  if (y.mode === 'ground') return { up: 1 };
  const lead = Math.min(0.7, d / BROOM.top);
  const aim = [s.p[0] + s.v[0] * lead, s.p[1] + s.v[1] * lead, s.p[2] + s.v[2] * lead];
  const to = v3.sub(aim, y.p);
  const diff = wrap(Math.atan2(to[0], to[2]) - y.yaw);
  const side = clamp(-diff * 2.5, -1, 1);
  const pace = Math.hypot(s.v[0], s.v[2]);
  const want = Math.abs(diff) > 1.2 ? 3 : clamp(pace + Math.hypot(to[0], to[2]) * 1.5, 3, BROOM.top);
  const fwd = y.spd > want + 2 ? -1 : want / BROOM.top;
  const up = clamp(to[1] / 2, -1, 1);
  return { fwd, side, up: Math.max(0, up), down: Math.max(0, -up), boost: true, catch: d <= CATCH };
}

// The commentator, the site’s own words: a few lines an event, said in
// turn (k counts the lines said so far). {us} and {them} are the houses.
export const LINES = {
  start: ['And they’re off. Somebody tell the Snitch it’s allowed to be seen.', 'The Snitch is away, and so is every sensible bird in the Highlands.'],
  goalUs: ['Ten points to {us}. The hoop never saw it coming.', 'Through the middle hoop. {them}’s Keeper is having words with it.', 'Another for {us}. The stands are standing.'],
  goalThem: ['Ten to {them}. Our Keeper went left, the Quaffle didn’t.', 'Ten to {them}. Steady, now.'],
  bludger: ['A Bludger, square on. That’ll leave a mark on the broom and the pride.', 'Ooh. Our Seeker has met a Bludger. The Bludger is fine.'],
  batted: ['Lovely bit of batting there.', 'And that Bludger has been sent somewhere else to be a problem.'],
  knock: ['And that is a foul, or it would be if anyone had seen it.', 'Someone’s been clipped. Madam Hooch is pretending not to look.'],
  dart: ['And it’s gone. Snitches don’t believe in fair play.', 'Left, right, gone. The Snitch has done this before.'],
  near: ['Within an arm’s length. The whole stand has stopped breathing.', 'Our Seeker has seen it. Look at that broom go.'],
  caughtYou: ['Caught. {us} have the Snitch, and the stands have lost their voices.', 'It’s in the hand. A hundred and fifty to {us}, and that’s the match.'],
  caughtThem: ['{them}’s Seeker has it. Somebody check that broom for charms.', 'Caught, by the wrong Seeker. A hundred and fifty to {them}.'],
};
const NAMES = { gryffindor: 'Gryffindor', hufflepuff: 'Hufflepuff', ravenclaw: 'Ravenclaw', slytherin: 'Slytherin' };
export function lineFor(e, m, k = 0) {
  const key = e.type === 'goal' ? (e.side === 'us' ? 'goalUs' : 'goalThem') : e.type === 'caught' ? (e.by === 'you' ? 'caughtYou' : 'caughtThem') : e.type;
  const set = LINES[key];
  if (!set) return null;
  return set[k % set.length].replaceAll('{us}', NAMES[m.house] ?? 'us').replaceAll('{them}', NAMES[m.against] ?? 'them');
}
