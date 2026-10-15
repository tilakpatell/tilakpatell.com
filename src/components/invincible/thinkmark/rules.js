// Think, Mark!: the rules, with no drawing in them (scene.js draws them, and
// the tests play them). You are Invincible, flying over the city: four
// chapters, each its own fight.
//
//   1. Flight lesson: follow your father through rings, over and between
//      the towers.
//   2. The Flaxans: a portal opens over the park and soldiers pour out of
//      it, three waves; each wave has aged a decade on the other side.
//   3. Think, Mark!: Omni-Man. He winds up and charges; dodge, then punish
//      him while he recovers. Punch him at any other time and he blocks and
//      hits back. From the second phase he also climbs and dives into a
//      shockwave. Bring him low enough and he leaves.
//   4. The Grand Regent: Thragg, faster, and twice in a row.
//
// Flying is free: a direction to fly in (world space, worked out from the
// camera by the page), a boost, a dash-punch at whatever you're locked on to
// (a short jab if nothing is near), and a dodge that can't be hit for a
// moment. A dodge just before a hit is a perfect dodge: it slows time and
// leaves a boss open for longer. Everything here is plain numbers and arrays
// ([x, y, z], metres and seconds), stepped at a fixed rate.

import { BOUND, HALF, RIVER, SKY, boxes, buildCity, clear, index, rng } from './city';

export const DIFFICULTY = {
  guardian: { label: 'Guardian', note: 'Hits hurt less, bosses telegraph longer', hurt: 0.55, boss: 0.7, windup: 1.3, regen: 1.6, ring: 1.3, iframes: 1.4, charge: 0.8 },
  hero: { label: 'Hero', note: 'As the show has it', hurt: 1, boss: 1, windup: 1, regen: 1, ring: 1, iframes: 1, charge: 1 },
  viltrumite: { label: 'Viltrumite', note: 'Faster, harder, and no second chances', hurt: 1.45, boss: 1.3, windup: 0.78, regen: 0.5, ring: 0.85, iframes: 0.85, charge: 1.1 },
};

export const MARK = {
  hp: 100,
  r: 0.9,
  cruise: 26,
  boost: 64,
  turn: 4.2, // how quickly he reaches the speed he's asking for (per second)
  boostTurn: 2.6,
  drag: 2.8, // how quickly he stops when nothing is pressed
  dash: { range: 62, speed: 96, time: 0.7, reach: 2.4, cooldown: 0.16 },
  jab: { time: 0.2, speed: 34, reach: 3.6 },
  dodge: { speed: 42, time: 0.26, iframes: 0.42, cooldown: 0.45, perfect: 0.24 },
  hurt: 0.5,
  mercy: 0.45, // can't be hurt again for this long after a hit
  regenAfter: 4.5,
  regen: 4,
  dmg: 10,
  combo: 2.4, // seconds a combo waits for the next hit
};

export const BOSSES = {
  omni: { name: 'Omni-Man', hp: 520, r: 1.3, orbit: 23, speed: 34, charge: 98, windup: 0.9, recover: 1.75, slamAfter: 2, dmg: { charge: 20, slam: 16, counter: 6 }, leaveAt: 0.12 },
  thragg: { name: 'Thragg', hp: 680, r: 1.35, orbit: 21, speed: 40, charge: 116, windup: 0.66, recover: 1.4, slamAfter: 1, double: true, dmg: { charge: 24, slam: 19, counter: 8 }, leaveAt: 0 },
};

const FLAXAN = { r: 0.8, speed: 21, orbit: [15, 27], aim: 0.75, gap: [2.3, 3.8], bolt: 34, boltLife: 3, dmg: 8 };
export const WAVES = [
  { n: 4, hp: 1, age: 0, gap: 1 },
  { n: 6, hp: 1, age: 1, gap: 0.85 },
  { n: 8, hp: 2, age: 2, gap: 0.75 },
];
// the Flaxans' way through, over the river, facing the city
export const PORTAL = { p: [40, 64, 372], n: [0, 0, -1], r: 20 };
export const RINGS = { n: 9, r: 7.5 };
export const QUAKE = { r: 30, time: 0.6, band: 3.4 };

export const CHAPTERS = [
  { id: 'lesson', title: 'Flight lesson', kicker: 'Chapter one', sky: 'noon', blurb: 'Your father wants to see you fly. Follow him through the rings: over the river, between the towers, and over the top.', start: [0, 58, 330], yaw: Math.PI },
  { id: 'flaxans', title: 'The Flaxans', kicker: 'Chapter two', sky: 'noon', blurb: 'A portal has opened over the river and soldiers are pouring out of it. Knock them back through. Time runs faster on their side.', start: [40, 56, 296], yaw: 0 },
  { id: 'omni', title: 'Think, Mark!', kicker: 'Chapter three', sky: 'dusk', blurb: 'The Guardians are dead and you know who did it. Dodge his charge, then hit him while he recovers. Hit him any other time and he hits back.', start: [60, 110, 330], yaw: Math.PI },
  { id: 'thragg', title: 'The Grand Regent', kicker: 'Chapter four', sky: 'night', blurb: 'Thragg has come for the planet that turned Nolan. He is faster than your father, and he charges twice.', start: [-60, 290, 60], yaw: Math.PI },
];

// Who says what. Most are the show's; the rest are in its voice.
export const LINES = {
  lessonStart: ['Omni-Man', 'Stay with me, Mark. Through the rings.'],
  lesson3: ['Omni-Man', 'Faster. You’re flying like a tourist.'],
  lesson6: ['Omni-Man', 'Better. Use the boost on the straights.'],
  lessonEnd: ['Omni-Man', 'Not bad. You might be ready for what’s coming.'],
  flaxStart: ['Mark', 'Is that a portal? Over the river?'],
  wave2: ['Mark', 'Wait, are those the same guys? They’re older. A lot older.'],
  wave3: ['Mark', 'Okay, now they’re ancient. And angry.'],
  portalShut: ['Omni-Man', 'Good. Now they’ll have something to think about for a few centuries.'],
  omniStart: ['Omni-Man', 'You need to listen to me, Mark.'],
  omni2: ['Omni-Man', 'Look what they need to mimic a fraction of our power.'],
  omni3: ['Omni-Man', 'Think, Mark!'],
  omniLeave: ['Omni-Man', 'You’ll outlast every fragile, insignificant being on this planet.'],
  omniLeave2: ['Mark', 'I’d still have you, Dad.'],
  thraggStart: ['Thragg', 'So this is the world that turned Nolan.'],
  thragg2: ['Thragg', 'Viltrum does not kneel. Not to a half-breed.'],
  thragg3: ['Thragg', 'You fight like your father. He lost too.'],
  thraggDown: ['Thragg', 'This is not over, Grayson.'],
  block: ['Omni-Man', 'Sloppy.'],
};

// ── vectors ──
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const norm = (a) => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0];
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
export const vec = { add, sub, len, dist, dot, scale, norm };

// ── the city, built once ──
let CITY = null;
export function city() {
  if (!CITY) {
    const c = buildCity(7);
    CITY = { ...c, idx: index(boxes(c)) };
  }
  return CITY;
}

// A sphere pushed out of whatever box it's in, its speed into the wall
// taken away. Returns how fast it hit, and where, or null.
export function collide(p, v, r) {
  const { idx } = city();
  let hit = null;
  for (const b of idx.at(p[0], p[2])) {
    const cx = clamp(p[0], b.x0, b.x1);
    const cy = clamp(p[1], 0, b.y1);
    const cz = clamp(p[2], b.z0, b.z1);
    const d = [p[0] - cx, p[1] - cy, p[2] - cz];
    const d2 = dot(d, d);
    if (d2 >= r * r) continue;
    let n;
    let push;
    if (d2 > 1e-10) {
      const l = Math.sqrt(d2);
      n = scale(d, 1 / l);
      push = r - l;
    } else {
      // the centre is inside: out through the nearest face
      const faces = [
        [p[0] - b.x0, [-1, 0, 0]],
        [b.x1 - p[0], [1, 0, 0]],
        [b.y1 - p[1], [0, 1, 0]],
        [p[2] - b.z0, [0, 0, -1]],
        [b.z1 - p[2], [0, 0, 1]],
      ].sort((x, y) => x[0] - y[0]);
      n = faces[0][1];
      push = faces[0][0] + r;
    }
    p[0] += n[0] * push;
    p[1] += n[1] * push;
    p[2] += n[2] * push;
    const into = dot(v, n);
    if (into < 0) {
      v[0] -= n[0] * into;
      v[1] -= n[1] * into;
      v[2] -= n[2] * into;
    }
    hit = { speed: -into, at: [cx, cy, cz], n, id: b.id };
  }
  return hit;
}

// keep inside the world: above the street, under the ceiling, within the city
function bound(p, v, r) {
  if (p[1] < r + 0.3) {
    p[1] = r + 0.3;
    if (v[1] < 0) v[1] = 0;
  }
  if (p[1] > SKY) {
    p[1] = SKY;
    if (v[1] > 0) v[1] = 0;
  }
  for (const k of [0, 2]) {
    if (Math.abs(p[k]) > BOUND) {
      p[k] = Math.sign(p[k]) * BOUND;
      if (v[k] * p[k] > 0) v[k] = 0;
    }
  }
}

// ── the rings ──
// A course through the city, the same every time: from over the river,
// between the towers and over their tops, each ring within sight of the last
// and clear of every wall, never turning back on itself.
export function buildRings(seed = 11, n = RINGS.n) {
  const { idx, towers } = city();
  const r = rng(seed);
  const cell = (HALF * 2) / 11;
  const cands = [];
  for (let i = 1; i < 11; i++)
    for (let j = 1; j < 11; j++) {
      const x = -HALF + i * cell;
      const z = -HALF + j * cell;
      if (z > RIVER.z0 - 10) continue;
      for (const y of [32, 58, 90]) cands.push([x, y, z]);
    }
  for (const t of towers) if (t.h > 50 && t.h < 160) cands.push([t.x, t.h + (t.top ? t.top.h : 0) + 28, t.z]);
  const start = CHAPTERS[0].start;
  for (let attempt = 0; attempt < 400; attempt++) {
    const path = [start];
    let dir = [0, 0, -1];
    for (let k = 0; k < n; k++) {
      const from = path[path.length - 1];
      const ok = cands.filter((c) => {
        const d = sub(c, from);
        const l = len(d);
        if (l < 85 || l > 175) return false;
        const flat = norm([d[0], 0, d[2]]);
        if (dot(flat, norm([dir[0], 0, dir[2]])) < (k === 0 ? 0.8 : 0.05)) return false;
        if (Math.abs(d[1]) > l * 0.55) return false;
        if (path.some((p) => dist(p, c) < 70)) return false;
        return clear(idx, from, c, RINGS.r + 2.5);
      });
      if (!ok.length) break;
      const c = ok[Math.floor(r() * ok.length)];
      dir = norm(sub(c, from));
      path.push(c);
    }
    if (path.length === n + 1) {
      return path.slice(1).map((c, k) => {
        const next = path[k + 2] ?? add(c, sub(c, path[k]));
        return { p: c, n: norm(sub(next, path[k])) };
      });
    }
  }
  throw new Error('no ring course');
}

// ── a game ──
const newMark = (ch) => ({
  p: [...ch.start],
  v: [0, 0, 0],
  yaw: ch.yaw,
  hp: MARK.hp,
  state: 'fly',
  t: 0,
  target: null,
  cool: 0,
  dodgeCool: 0,
  iframe: 0,
  dodgeAt: -9,
  perfectAt: -9,
  sinceHurt: 9,
  combo: 0,
  lastHit: -9,
  r: MARK.r,
  dashTime: 0,
  dodgeDir: [1, 0, 0],
  side: 1,
});

export function newGame({ seed = 1, difficulty = 'hero' } = {}) {
  return {
    seed,
    rand: rng(seed),
    difficulty: DIFFICULTY[difficulty] ? difficulty : 'hero',
    phase: 'title', // title | play | clear | lost | won
    chapter: 0,
    t: 0,
    ct: 0,
    mark: newMark(CHAPTERS[0]),
    enemies: [],
    bolts: [],
    boss: null,
    guide: null,
    rings: [],
    ring: 0,
    portal: null,
    wave: -1,
    waveT: 0,
    spawn: 0,
    quake: null,
    lock: null,
    input: { dir: [0, 0, 0], boost: false },
    press: { punch: 0, dodge: 0 },
    score: 0,
    chapterScore: 0,
    hits: 0,
    perfects: 0,
    taken: 0,
    nextId: 1,
    done: [], // chapters finished
    result: null,
  };
}

const diff = (g) => DIFFICULTY[g.difficulty];

export function startChapter(g, i = g.chapter) {
  const ch = CHAPTERS[i];
  Object.assign(g, {
    phase: 'play',
    chapter: i,
    ct: 0,
    mark: newMark(ch),
    enemies: [],
    bolts: [],
    boss: null,
    guide: null,
    rings: [],
    ring: 0,
    portal: null,
    wave: -1,
    waveT: 0,
    spawn: 0,
    quake: null,
    lock: null,
    chapterScore: 0,
    result: null,
    press: { punch: 0, dodge: 0 },
    input: { dir: [0, 0, 0], boost: false },
  });
  const ev = [{ type: 'chapter', i, id: ch.id, title: ch.title }];
  if (ch.id === 'lesson') {
    g.rings = buildRings();
    g.guide = { p: add(ch.start, [7, 3, -10]), v: [0, 0, 0], yaw: Math.PI, state: 'lead' };
    say(ev, 'lessonStart');
  } else if (ch.id === 'flaxans') {
    g.portal = { ...PORTAL, open: 0, closing: false };
    g.waveT = 2.5;
    say(ev, 'flaxStart');
  } else {
    const B = BOSSES[ch.id];
    // he comes in over the rooftops, from in front of you
    const from = add(ch.start, [0, 0, -150]);
    from[1] = Math.min(Math.max(from[1] + 40, 280), SKY - 5);
    g.boss = { id: g.nextId++, kind: ch.id, name: B.name, p: from, v: [0, 0, 0], r: B.r, hp: B.hp * diff(g).boss, max: B.hp * diff(g).boss, state: 'intro', t: 0, timer: 3, phase: 1, hits: 0, orbit: g.rand() * Math.PI * 2, dir: [0, 0, 1], doubled: false, attacks: 0, open: 1 };
    g.lock = g.boss.id;
    say(ev, ch.id === 'omni' ? 'omniStart' : 'thraggStart');
  }
  return ev;
}

const say = (ev, key) => ev.push({ type: 'line', key, who: LINES[key][0], text: LINES[key][1] });

// ── input ──
// dir: where to fly, world space, length 0..1 (the page turns keys and
// sticks into this through the camera); boost: flying flat out
export function setInput(g, dir, boost = false) {
  const l = len(dir);
  g.input.dir = l > 1 ? scale(dir, 1 / l) : [...dir];
  g.input.boost = boost;
}
// presses wait a moment, so one made a little early still counts
export const punch = (g) => (g.press.punch = 0.16);
export const dodge = (g) => (g.press.dodge = 0.16);

// Everything Mark can hit: the Flaxans still fighting, and the boss.
export function targets(g) {
  const out = g.enemies.filter((e) => e.state !== 'ko');
  if (g.boss && !['leave', 'down'].includes(g.boss.state)) out.push(g.boss);
  return out;
}
const byId = (g, id) => (g.boss?.id === id ? g.boss : g.enemies.find((e) => e.id === id)) ?? null;
export const lockTarget = (g) => {
  const t = g.lock != null ? byId(g, g.lock) : null;
  return t && t.state !== 'ko' && !['leave', 'down'].includes(t.state) ? t : null;
};

const facing = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];

// the best thing to lock on to: near, and ahead of where he's facing
function pickLock(g, skip = null) {
  const m = g.mark;
  const fwd = facing(m.yaw);
  let best = null;
  let score = Infinity;
  for (const t of targets(g)) {
    if (t.id === skip) continue;
    const d = sub(t.p, m.p);
    const l = len(d);
    if (l > 170) continue;
    const s = l - 30 * dot(fwd, norm(d));
    if (s < score) {
      score = s;
      best = t;
    }
  }
  return best;
}
// the next target round from the one locked on
export function cycle(g) {
  const next = pickLock(g, g.lock);
  if (next) g.lock = next.id;
}

// ── a step ──
export function step(g, dt) {
  const ev = [];
  if (g.phase !== 'play') return ev;
  g.t += dt;
  g.ct += dt;
  g.press.punch = Math.max(0, g.press.punch - dt);
  g.press.dodge = Math.max(0, g.press.dodge - dt);
  const id = CHAPTERS[g.chapter].id;
  stepMark(g, dt, ev);
  if (id === 'lesson') stepLesson(g, dt, ev);
  else if (id === 'flaxans') stepFlaxans(g, dt, ev);
  else stepBoss(g, dt, ev);
  stepBolts(g, dt, ev);
  // keep a lock: the boss always; otherwise the best Flaxan once the last is gone
  if (g.boss) {
    if (!['leave', 'down'].includes(g.boss.state)) g.lock = g.boss.id;
  } else if (!lockTarget(g) || dist(lockTarget(g).p, g.mark.p) > 170) g.lock = pickLock(g)?.id ?? null;
  if (g.mark.hp <= 0 && g.phase === 'play') {
    g.phase = 'lost';
    g.result = result(g, false);
    ev.push({ type: 'lost' });
  }
  return ev;
}

function result(g, won) {
  return { won, chapter: g.chapter, time: g.ct, score: g.chapterScore, total: g.score, hits: g.hits, perfects: g.perfects };
}

function clearChapter(g, ev) {
  g.phase = g.chapter === CHAPTERS.length - 1 ? 'won' : 'clear';
  const id = CHAPTERS[g.chapter].id;
  // a quick lesson, or a fight without much hurt, is worth more
  const bonus = id === 'lesson' ? Math.max(0, Math.round((90 - g.ct) * 40)) : Math.round(g.mark.hp * 20);
  g.chapterScore += bonus;
  g.score += bonus;
  if (!g.done.includes(g.chapter)) g.done.push(g.chapter);
  g.result = result(g, true);
  ev.push({ type: g.phase === 'won' ? 'won' : 'cleared', chapter: g.chapter, bonus });
}

const points = (g, n) => {
  g.score += n;
  g.chapterScore += n;
};

// ── Mark ──
function stepMark(g, dt, ev) {
  const m = g.mark;
  const D = diff(g);
  m.t += dt;
  m.cool -= dt;
  m.dodgeCool -= dt;
  m.iframe -= dt;
  m.sinceHurt += dt;
  if (m.combo && g.t - m.lastHit > MARK.combo) m.combo = 0;
  if (m.state === 'fly') {
    const want = scale(g.input.dir, g.input.boost ? MARK.boost : MARK.cruise);
    if (len(g.input.dir) > 0.05) {
      const k = 1 - Math.exp(-(g.input.boost ? MARK.boostTurn : MARK.turn) * dt);
      for (let i = 0; i < 3; i++) m.v[i] += (want[i] - m.v[i]) * k;
    } else {
      const k = Math.exp(-MARK.drag * dt);
      m.v = scale(m.v, k);
    }
    if (g.press.dodge > 0 && m.dodgeCool <= 0) startDodge(g, ev);
    else if (g.press.punch > 0 && m.cool <= 0) startPunch(g, ev);
  } else if (m.state === 'dash') {
    const t = byId(g, m.target);
    if (!t || t.state === 'ko' || ['leave', 'down'].includes(t.state)) endDash(g, ev, false);
    else {
      const d = sub(t.p, m.p);
      const l = len(d);
      m.v = scale(norm(d), Math.min(MARK.dash.speed, l / dt));
      if (l <= MARK.dash.reach + t.r) impact(g, t, ev);
      else if (m.t > MARK.dash.time) endDash(g, ev, true);
    }
  } else if (m.state === 'jab') {
    m.v = scale(facing(m.yaw), MARK.jab.speed);
    if (m.t > MARK.jab.time) {
      const fwd = facing(m.yaw);
      const t = targets(g).find((e) => dist(e.p, m.p) < MARK.jab.reach + e.r && dot(norm(sub(e.p, m.p)), fwd) > 0.2);
      if (t) impact(g, t, ev);
      else {
        m.state = 'fly';
        m.v = scale(m.v, 0.3);
        m.cool = MARK.dash.cooldown;
        ev.push({ type: 'whiff' });
      }
    }
  } else if (m.state === 'dodge') {
    m.v = scale(m.v, Math.exp(-2 * dt));
    if (m.t > MARK.dodge.time) m.state = 'fly';
  } else if (m.state === 'hurt') {
    m.v = scale(m.v, Math.exp(-1.6 * dt));
    if (m.t > MARK.hurt) m.state = 'fly';
  }
  m.p = add(m.p, m.v, dt);
  const hit = collide(m.p, m.v, m.r);
  if (hit && hit.speed > 30 && g.t - (m.crashed ?? -9) > 0.4) {
    m.crashed = g.t;
    ev.push({ type: 'crash', at: hit.at, n: hit.n, speed: hit.speed, who: 'mark' });
    if (m.state === 'hurt') damage(g, 4 * D.hurt, ev, 'wall');
  }
  bound(m.p, m.v, m.r);
  // which way he faces: at what he's dashing at, at what he's locked on to
  // when he's nearly still, else the way he's going
  const lock = lockTarget(g);
  let face = null;
  if (m.state === 'dash' || m.state === 'jab') face = m.state === 'dash' ? sub(byId(g, m.target)?.p ?? add(m.p, m.v), m.p) : null;
  else if (lock && Math.hypot(m.v[0], m.v[2]) < 16 && dist(lock.p, m.p) < 120) face = sub(lock.p, m.p);
  else if (Math.hypot(m.v[0], m.v[2]) > 2) face = m.v;
  if (face && Math.hypot(face[0], face[2]) > 0.01) {
    const want = Math.atan2(face[0], face[2]);
    let d = want - m.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.yaw += d * Math.min(1, dt * (m.state === 'dash' ? 20 : 9));
  }
  if (m.sinceHurt > MARK.regenAfter && m.hp > 0) m.hp = Math.min(MARK.hp, m.hp + MARK.regen * D.regen * dt);
}

function startPunch(g, ev) {
  const m = g.mark;
  g.press.punch = 0;
  const t = lockTarget(g);
  if (t && dist(t.p, m.p) < MARK.dash.range) {
    m.state = 'dash';
    m.target = t.id;
    m.t = 0;
    ev.push({ type: 'dash', target: t.id });
  } else {
    m.state = 'jab';
    m.t = 0;
    ev.push({ type: 'jab' });
  }
}

function endDash(g, ev, missed) {
  const m = g.mark;
  m.state = 'fly';
  m.v = scale(m.v, 0.25);
  m.cool = MARK.dash.cooldown;
  if (missed) ev.push({ type: 'whiff' });
}

function startDodge(g, ev) {
  const m = g.mark;
  g.press.dodge = 0;
  let dir = g.input.dir;
  if (len(dir) < 0.2) {
    // nothing pressed: sideways from what he's facing, a different side each time
    const t = lockTarget(g);
    const to = t ? norm(sub(t.p, m.p)) : facing(m.yaw);
    m.side = -m.side;
    dir = norm([to[2] * m.side, 0.15, -to[0] * m.side]);
  }
  m.dodgeDir = norm(dir);
  m.v = scale(m.dodgeDir, MARK.dodge.speed);
  m.state = 'dodge';
  m.t = 0;
  m.iframe = Math.max(m.iframe, MARK.dodge.iframes * diff(g).iframes);
  m.dodgeAt = g.t;
  m.dodgeCool = MARK.dodge.cooldown;
  ev.push({ type: 'dodge', dir: m.dodgeDir });
}

// Mark's fist lands.
function impact(g, t, ev) {
  const m = g.mark;
  const dir = norm(sub(t.p, m.p));
  m.state = 'fly';
  m.cool = MARK.dash.cooldown;
  m.v = scale(dir, -9);
  const at = add(m.p, dir, m.r + 0.3);
  if (t === g.boss) {
    const b = g.boss;
    if (!['recover', 'stagger'].includes(b.state)) {
      // he sees it coming: blocks, and hits back
      ev.push({ type: 'block', at });
      if (b.kind === 'omni' && g.rand() < 0.3) say(ev, 'block');
      if (m.iframe <= 0) {
        damage(g, BOSSES[b.kind].dmg.counter * diff(g).hurt, ev, 'counter');
        m.state = 'hurt';
        m.t = 0;
        m.v = scale(dir, -24);
        m.iframe = MARK.mercy;
      }
      return;
    }
  }
  if (g.t - m.lastHit < MARK.combo) m.combo++;
  else m.combo = 1;
  m.lastHit = g.t;
  g.hits++;
  const k = 1 + Math.min(0.6, (m.combo - 1) * 0.1);
  if (t === g.boss) {
    const b = g.boss;
    const dmg = MARK.dmg * k * (b.state === 'stagger' ? 0.6 : 1);
    b.hp = Math.max(0, b.hp - dmg);
    b.hits++;
    points(g, Math.round(dmg * 10));
    ev.push({ type: 'hit', at, target: b.id, dmg, combo: m.combo, boss: true });
    if (b.hits >= 4 && b.state === 'recover') {
      b.state = 'stagger';
      b.t = 0;
      b.timer = 1.1;
      b.v = scale(dir, 30);
      ev.push({ type: 'stagger', at });
    } else b.v = add(b.v, dir, 6);
  } else {
    t.hp -= 1;
    t.v = add(scale(dir, 42), [0, 7, 0]);
    points(g, 100 * m.combo);
    ev.push({ type: 'hit', at, target: t.id, dmg: 1, combo: m.combo });
    if (t.hp <= 0) {
      t.state = 'ko';
      t.t = 0;
      ev.push({ type: 'ko', at: [...t.p], id: t.id });
    } else {
      t.state = 'fly';
      t.t = 0;
    }
  }
}

function damage(g, n, ev, by) {
  const m = g.mark;
  m.hp = Math.max(0, m.hp - n);
  m.sinceHurt = 0;
  m.combo = 0;
  g.taken += n;
  ev.push({ type: 'hurt', by, dmg: n, at: [...m.p] });
}

// A dodge started just before an attack reaches him, or just before it
// goes by close (it would have hit, but for the dodge), is a perfect one.
function perfect(g, ev, by) {
  const m = g.mark;
  if (g.t - m.dodgeAt > MARK.dodge.perfect + (m.iframe > 0 ? 0 : 0.12) || m.perfectAt >= m.dodgeAt) return false;
  m.perfectAt = g.t;
  g.perfects++;
  points(g, 250);
  ev.push({ type: 'perfect', by, at: [...m.p] });
  if (g.boss && (by === 'charge' || by === 'quake')) g.boss.perfect = true;
  return true;
}

// An attack reaching Mark. Returns whether it hurt.
function strike(g, ev, { dmg, dir, knock, by }) {
  const m = g.mark;
  if (m.iframe > 0) {
    perfect(g, ev, by);
    return false;
  }
  damage(g, dmg * diff(g).hurt, ev, by);
  m.state = 'hurt';
  m.t = 0;
  m.v = scale(norm(dir), knock);
  m.iframe = MARK.mercy;
  return true;
}

// ── chapter one: the rings ──
function stepLesson(g, dt, ev) {
  const m = g.mark;
  const ring = g.rings[g.ring];
  if (ring) {
    const R = RINGS.r * diff(g).ring;
    const s = dot(sub(m.p, ring.p), ring.n);
    const lateral = len(add(sub(m.p, ring.p), ring.n, -s));
    const was = ring.side ?? s;
    // through: from in front of it to behind it, inside the hoop (or near enough the middle)
    if ((was < 0 && s >= 0 && lateral < R) || dist(m.p, ring.p) < R * 0.6) {
      ring.done = true;
      g.ring++;
      points(g, 200);
      ev.push({ type: 'ring', i: g.ring - 1, at: ring.p, left: g.rings.length - g.ring });
      if (g.ring === 3) say(ev, 'lesson3');
      if (g.ring === 6) say(ev, 'lesson6');
      if (g.ring === g.rings.length) {
        say(ev, 'lessonEnd');
        clearChapter(g, ev);
      }
    }
    ring.side = s;
  }
  // Omni-Man leads: he waits a little past the next ring, to one side, and goes on as you come
  const gd = g.guide;
  if (gd) {
    const next = g.rings[Math.min(g.ring, g.rings.length - 1)];
    const goal = add(add(next.p, next.n, 14), [0, 5, 0]);
    const d = sub(goal, gd.p);
    const want = scale(norm(d), Math.min(48, len(d) * 1.6));
    gd.v = add(gd.v, sub(want, gd.v), Math.min(1, dt * 2.2));
    gd.p = add(gd.p, gd.v, dt);
    collide(gd.p, gd.v, 1.2);
    const face = len(gd.v) > 3 ? gd.v : sub(m.p, gd.p);
    gd.yaw = Math.atan2(face[0], face[2]);
    gd.speed = len(gd.v);
  }
}

// ── chapter two: the Flaxans ──
function stepFlaxans(g, dt, ev) {
  const P = g.portal;
  const w = WAVES[g.wave];
  P.open = P.closing ? Math.max(0, P.open - dt / 1.2) : Math.min(1, P.open + dt / 1.5);
  if (P.closing) {
    if (P.open <= 0 && g.phase === 'play') clearChapter(g, ev);
    return;
  }
  // between waves
  const fighting = g.enemies.some((e) => e.state !== 'ko');
  if (!fighting && g.spawn <= 0) {
    g.waveT -= dt;
    if (g.waveT <= 0) {
      g.wave++;
      if (g.wave >= WAVES.length) {
        P.closing = true;
        say(ev, 'portalShut');
        ev.push({ type: 'portal-close', at: P.p });
        return;
      }
      g.spawn = WAVES[g.wave].n;
      g.spawnT = 0;
      g.waveT = 2.4; // the pause after this wave, once it's beaten
      ev.push({ type: 'wave', n: g.wave + 1, of: WAVES.length, age: WAVES[g.wave].age });
      if (g.wave === 1) say(ev, 'wave2');
      if (g.wave === 2) say(ev, 'wave3');
    }
  }
  // out through the portal, one at a time
  if (g.spawn > 0 && w) {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      g.spawn--;
      g.spawnT = 0.5;
      const a = g.rand() * Math.PI * 2;
      const out = norm(add([Math.cos(a) * 0.6, Math.sin(a) * 0.4, 0], P.n));
      g.enemies.push({ id: g.nextId++, kind: 'flaxan', age: w.age, p: add(P.p, [Math.cos(a) * 6, Math.sin(a) * 6, P.n[2] * 2]), v: scale(out, 26), r: FLAXAN.r, hp: w.hp, state: 'arrive', t: 0, orbit: g.rand() * Math.PI * 2, rad: lerp(FLAXAN.orbit[0], FLAXAN.orbit[1], g.rand()), lift: (g.rand() - 0.5) * 10, shot: 1.2 + g.rand() * 2 * w.gap, spin: 0 });
      ev.push({ type: 'spawn', at: [...P.p] });
    }
  }
  const m = g.mark;
  for (const e of g.enemies) {
    e.t += dt;
    if (e.state === 'ko') {
      e.v[1] -= 22 * dt;
      e.v = scale(e.v, Math.exp(-0.4 * dt));
      e.p = add(e.p, e.v, dt);
      e.spin += dt * 9;
      if (collide(e.p, e.v, e.r) || e.p[1] < 1.2) {
        if (!e.landed) ev.push({ type: 'thud', at: [...e.p] });
        e.landed = true;
        e.v = scale(e.v, 0.3);
        e.p[1] = Math.max(e.p[1], 1);
      }
      continue;
    }
    if (e.state === 'arrive') {
      e.p = add(e.p, e.v, dt);
      if (e.t > 1.1) {
        e.state = 'fly';
        e.t = 0;
      }
      continue;
    }
    // circle Mark at its own distance, at its own height
    e.orbit += dt * (0.35 + 0.1 * e.age) * (e.id % 2 ? 1 : -1);
    const goal = add(m.p, [Math.cos(e.orbit) * e.rad, e.lift, Math.sin(e.orbit) * e.rad]);
    goal[1] = Math.max(goal[1], 26);
    const d = sub(goal, e.p);
    const want = scale(norm(d), Math.min(FLAXAN.speed * (1 + e.age * 0.15), len(d) * 1.4));
    e.v = add(e.v, sub(want, e.v), Math.min(1, dt * (e.state === 'aim' ? 4 : 1.8)));
    if (e.state === 'aim') e.v = scale(e.v, Math.exp(-4 * dt));
    e.p = add(e.p, e.v, dt);
    collide(e.p, e.v, e.r);
    bound(e.p, e.v, e.r);
    e.yaw = Math.atan2(m.p[0] - e.p[0], m.p[2] - e.p[2]);
    if (e.state === 'fly') {
      e.shot -= dt;
      if (e.shot <= 0 && dist(e.p, m.p) < 70) {
        e.state = 'aim';
        e.t = 0;
        ev.push({ type: 'aim', id: e.id });
      }
    } else if (e.state === 'aim' && e.t > FLAXAN.aim) {
      // at where he's going to be
      const lead = add(m.p, m.v, Math.min(0.5, dist(e.p, m.p) / FLAXAN.bolt) * 0.7);
      const v = scale(norm(sub(lead, e.p)), FLAXAN.bolt);
      g.bolts.push({ id: g.nextId++, p: add(e.p, norm(v), 1), v, life: FLAXAN.boltLife, from: e.id });
      ev.push({ type: 'bolt', at: [...e.p] });
      e.state = 'fly';
      e.t = 0;
      e.shot = (lerp(FLAXAN.gap[0], FLAXAN.gap[1], g.rand()) * w.gap) / diff(g).boss;
    }
  }
  // the knocked out ones go, after a while
  g.enemies = g.enemies.filter((e) => !(e.state === 'ko' && e.t > 2.2));
}

function stepBolts(g, dt, ev) {
  const m = g.mark;
  const { idx } = city();
  for (const b of g.bolts) {
    const from = b.p;
    b.p = add(b.p, b.v, dt);
    b.life -= dt;
    // closest approach to Mark over this step
    const seg = sub(b.p, from);
    const k = clamp(dot(sub(m.p, from), seg) / Math.max(1e-9, dot(seg, seg)), 0, 1);
    const miss = dist(add(from, seg, k), m.p);
    if (miss < m.r + 0.45) {
      b.life = 0;
      if (strike(g, ev, { dmg: FLAXAN.dmg, dir: b.v, knock: 14, by: 'bolt' })) ev.push({ type: 'zap', at: [...m.p] });
      continue;
    }
    if (miss < 5 && k > 0 && k < 1) perfect(g, ev, 'bolt');
    for (const box of idx.at(b.p[0], b.p[2]))
      if (b.p[0] > box.x0 && b.p[0] < box.x1 && b.p[2] > box.z0 && b.p[2] < box.z1 && b.p[1] < box.y1) {
        b.life = 0;
        ev.push({ type: 'spark', at: [...b.p] });
        break;
      }
    if (b.p[1] < 0.3) {
      b.life = 0;
      ev.push({ type: 'spark', at: [...b.p] });
    }
  }
  g.bolts = g.bolts.filter((b) => b.life > 0);
}

// ── chapters three and four: a Viltrumite ──
function stepBoss(g, dt, ev) {
  const b = g.boss;
  const B = BOSSES[b.kind];
  const D = diff(g);
  const m = g.mark;
  b.t += dt;
  b.timer -= dt;
  const toMark = sub(m.p, b.p);
  const range = len(toMark);
  const face = (d) => {
    if (Math.hypot(d[0], d[2]) > 0.01) b.yaw = Math.atan2(d[0], d[2]);
  };
  // phases
  const share = b.hp / b.max;
  if (b.phase === 1 && share < 0.66) {
    b.phase = 2;
    say(ev, b.kind === 'omni' ? 'omni2' : 'thragg2');
    ev.push({ type: 'phase', n: 2 });
  } else if (b.phase === 2 && share < 0.33) {
    b.phase = 3;
    say(ev, b.kind === 'omni' ? 'omni3' : 'thragg3');
    ev.push({ type: 'phase', n: 3 });
  }
  if (!['leave', 'down'].includes(b.state) && share <= B.leaveAt + 1e-9) {
    if (b.kind === 'omni') {
      b.state = 'leave';
      say(ev, 'omniLeave');
      ev.push({ type: 'leave' });
    } else {
      b.state = 'down';
      say(ev, 'thraggDown');
      ev.push({ type: 'down', at: [...b.p] });
    }
    b.t = 0;
    b.said = false;
  }
  const move = (goal, speed, rate = 2.4) => {
    const d = sub(goal, b.p);
    const want = scale(norm(d), Math.min(speed, len(d) * 1.8));
    b.v = add(b.v, sub(want, b.v), Math.min(1, dt * rate));
  };
  const windup = B.windup * D.windup * (b.phase === 3 ? 0.82 : 1);
  switch (b.state) {
    case 'intro':
      move(add(m.p, [0, 6, -B.orbit]), 70, 1.5);
      face(toMark);
      if (b.timer <= 0) next(g, 'circle', 1.4);
      break;
    case 'circle': {
      b.orbit += dt * (0.45 + b.phase * 0.08);
      const goal = add(m.p, [Math.cos(b.orbit) * B.orbit, 4 + Math.sin(b.t * 0.7) * 3, Math.sin(b.orbit) * B.orbit]);
      move(goal, range > 90 ? 90 : B.speed * (1 + (b.phase - 1) * 0.12));
      face(toMark);
      if (b.timer <= 0 && range < 110) {
        b.attacks++;
        // the slam from the second phase (Thragg's from the first), every third attack or so
        if (b.phase >= B.slamAfter && b.attacks % 3 === 0) next(g, 'rise', 1.05);
        else next(g, 'windup', windup);
        ev.push({ type: 'windup', kind: b.state, time: b.timer });
      }
      break;
    }
    case 'windup':
      b.v = scale(b.v, Math.exp(-5 * dt));
      face(toMark);
      if (b.timer <= 0) {
        const lead = add(m.p, m.v, 0.12);
        b.dir = norm(sub(lead, b.p));
        b.from = [...b.p];
        b.go = len(sub(lead, b.p)) + 28;
        next(g, 'charge', 1.3);
        ev.push({ type: 'charge', from: [...b.p], dir: b.dir });
      }
      break;
    case 'charge': {
      const from = b.p;
      b.v = scale(b.dir, B.charge * D.charge * (b.phase === 3 ? 1.08 : 1));
      b.p = add(b.p, b.v, dt);
      face(b.dir);
      // through anything in the way (a Viltrumite doesn't go round buildings)
      const { idx } = city();
      for (const box of idx.at(b.p[0], b.p[2]))
        if (b.p[0] > box.x0 && b.p[0] < box.x1 && b.p[2] > box.z0 && b.p[2] < box.z1 && b.p[1] < box.y1 && b.through !== box) {
          b.through = box;
          ev.push({ type: 'smash', at: [...b.p], dir: b.dir });
        }
      const seg = sub(b.p, from);
      const k = clamp(dot(sub(m.p, from), seg) / Math.max(1e-9, dot(seg, seg)), 0, 1);
      const miss = dist(add(from, seg, k), m.p);
      if (!b.landed && miss < b.r + m.r + 0.5) {
        b.landed = true;
        if (strike(g, ev, { dmg: B.dmg.charge, dir: b.dir, knock: 52, by: 'charge' })) ev.push({ type: 'slugged', at: [...m.p], dir: b.dir });
      } else if (!b.landed && miss < 8 && k > 0 && k < 1) perfect(g, ev, 'charge');
      if (dist(b.p, b.from) > b.go || b.timer <= 0) {
        b.landed = false;
        b.through = null;
        // Thragg comes straight back, once
        if (B.double && !b.doubled) {
          b.doubled = true;
          next(g, 'windup', windup * 0.45);
          ev.push({ type: 'windup', kind: 'windup', time: b.timer });
        } else {
          b.doubled = false;
          next(g, 'recover', B.recover * (b.perfect ? 1.8 : 1));
          ev.push({ type: 'open', perfect: !!b.perfect });
          b.perfect = false;
        }
      }
      return; // (moved already)
    }
    case 'rise':
      move(add(m.p, [0, 30, 0]), 70, 4);
      face(toMark);
      if (b.timer <= 0) {
        b.from = [...b.p];
        b.aim = [...m.p];
        b.dir = norm(sub(b.aim, b.p));
        next(g, 'dive', 1);
        ev.push({ type: 'dive', from: [...b.p], to: [...b.aim] });
      }
      break;
    case 'dive':
      b.v = scale(b.dir, 125);
      face(b.dir);
      if (dist(b.p, b.aim) < 3 || dot(sub(b.aim, b.p), b.dir) < 0 || b.timer <= 0) {
        b.p = [...b.aim];
        b.v = [0, 0, 0];
        g.quake = { p: [...b.aim], t: 0, hit: false };
        ev.push({ type: 'quake', at: [...b.aim] });
        next(g, 'recover', B.recover * 1.15);
      }
      break;
    case 'recover':
      b.v = scale(b.v, Math.exp(-3 * dt));
      if (b.timer <= 0) {
        next(g, 'circle', lerp(1.2, 2.4, g.rand()) / (1 + (b.phase - 1) * 0.25));
        b.hits = 0;
      }
      break;
    case 'stagger':
      b.v = scale(b.v, Math.exp(-2.2 * dt));
      if (b.timer <= 0) {
        next(g, 'circle', 1);
        b.hits = 0;
      }
      break;
    case 'leave':
      // up and away: over the city and gone
      b.v = add(b.v, sub([b.v[0] * 0.2, 120, b.v[2] * 0.2], b.v), Math.min(1, dt * (b.t > 3 ? 1.5 : 0.3)));
      if (b.t > 3.2 && !b.said) {
        b.said = true;
        say(ev, 'omniLeave2');
      }
      if (b.t > 6.5 && g.phase === 'play') clearChapter(g, ev);
      break;
    case 'down':
      b.v[1] -= 20 * dt;
      if (b.t > 3.5 && g.phase === 'play') clearChapter(g, ev);
      break;
    default:
  }
  b.p = add(b.p, b.v, dt);
  if (!['leave', 'down', 'charge', 'dive'].includes(b.state)) collide(b.p, b.v, b.r);
  if (b.state !== 'leave') bound(b.p, b.v, b.r);
  // the shockwave from a dive, spreading
  const q = g.quake;
  if (q) {
    q.t += dt;
    const r = (q.t / QUAKE.time) * QUAKE.r;
    const off = Math.abs(dist(m.p, q.p) - r);
    if (!q.hit && off < QUAKE.band) {
      q.hit = true;
      strike(g, ev, { dmg: B.dmg.slam, dir: add(norm(sub(m.p, q.p)), [0, 0.4, 0]), knock: 34, by: 'quake' });
    } else if (!q.hit && off < QUAKE.band + 5) perfect(g, ev, 'quake');
    if (q.t > QUAKE.time) g.quake = null;
  }
}

function next(g, state, timer) {
  g.boss.state = state;
  g.boss.t = 0;
  g.boss.timer = timer;
}

// What a boss is up to, for the page and the scene: how far into a windup
// (0..1), and whether he can be hit.
export function bossTell(b) {
  if (!b) return null;
  return { state: b.state, open: b.state === 'recover' || b.state === 'stagger', windup: b.state === 'windup' ? clamp(b.t / (b.t + Math.max(0, b.timer)), 0, 1) : b.state === 'rise' ? clamp(b.t / (b.t + Math.max(0, b.timer)), 0, 1) : 0 };
}

// ── an autopilot (the tests play with it; the title screen shows it off) ──
export function pilot(g, { skill = 1 } = {}) {
  const m = g.mark;
  const id = CHAPTERS[g.chapter].id;
  let dir = [0, 0, 0];
  let boost = false;
  const toward = (p, keep = 0) => {
    const d = sub(p, m.p);
    const l = len(d);
    return l > keep + 1 ? scale(norm(d), 1) : l < keep - 2 ? scale(norm(d), -1) : [0, 0, 0];
  };
  if (id === 'lesson') {
    const r = g.rings[g.ring];
    if (r) {
      const d = dist(r.p, m.p);
      // line up on the far side's approach, then go through
      const s = dot(sub(m.p, r.p), r.n);
      const aim = s < -12 ? add(r.p, r.n, Math.max(-14, s * 0.4)) : add(r.p, r.n, 12);
      dir = toward(aim);
      boost = d > 45;
    }
  } else if (id === 'flaxans') {
    const threat = g.bolts.find((b) => {
      const rel = sub(m.p, b.p);
      const t = dot(rel, b.v) / dot(b.v, b.v);
      return t > 0 && t < 0.3 && len(add(rel, b.v, -t)) < 2.2;
    });
    const t = lockTarget(g);
    if (threat && m.dodgeCool <= 0 && skill > 0.3) dodge(g);
    else if (t && m.state === 'fly' && m.cool <= 0 && dist(t.p, m.p) < MARK.dash.range * 0.9) punch(g);
    if (t) dir = toward(t.p, 10);
    else if (g.portal) dir = toward(add(g.portal.p, g.portal.n, 40), 0);
  } else if (g.boss) {
    const b = g.boss;
    const d = dist(b.p, m.p);
    let eta = Infinity;
    if (b.state === 'charge') {
      const rel = sub(m.p, b.p);
      const along = dot(rel, b.dir);
      eta = along > 0 && len(add(rel, b.dir, -along)) < 5 ? along / (BOSSES[b.kind].charge * diff(g).charge) : Infinity;
    }
    const q = g.quake;
    const wave = q ? Math.abs(dist(m.p, q.p) - (q.t / QUAKE.time) * QUAKE.r) : Infinity;
    const danger = (b.state === 'windup' && b.timer < 0.08) || eta < 0.2 || (wave < 7 && q && !q.hit);
    if (danger && m.dodgeCool <= 0 && m.state === 'fly' && skill > 0.3) dodge(g);
    else if ((b.state === 'recover' || b.state === 'stagger') && m.state === 'fly' && m.cool <= 0 && d < MARK.dash.range * 0.9) punch(g);
    if (b.state === 'rise' || b.state === 'dive') {
      // out from under him
      const away = norm([m.p[0] - b.p[0], 0, m.p[2] - b.p[2]]);
      dir = len(away) > 0.1 ? away : [1, 0, 0];
    } else dir = toward(b.p, b.state === 'recover' || b.state === 'stagger' ? 0 : 20);
  }
  setInput(g, dir, boost);
}
