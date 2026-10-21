// Think, Mark!: what every part of the rules shares. The numbers (the
// difficulties, Mark, the bosses, the waves, the portal, the rings, the
// quake, the chapters, the lines), the vectors, the city built once, the
// collisions, the rings, and what an attack reaching Mark does. Moved from
// ./rules.js as it was, so that file and ./bosses.js can both read it with
// no cycle between them; ./rules.js re-exports what the page and the tests
// had from it.

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

export const FLAXAN = { r: 0.8, speed: 21, orbit: [15, 27], aim: 0.75, gap: [2.3, 3.8], bolt: 34, boltLife: 3, dmg: 8 };
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
export const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const norm = (a) => {
  const l = len(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 0, 0];
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
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
export function bound(p, v, r) {
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

export const diff = (g) => DIFFICULTY[g.difficulty];
export const say = (ev, key) => ev.push({ type: 'line', key, who: LINES[key][0], text: LINES[key][1] });
export const facing = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];

export function result(g, won) {
  return { won, chapter: g.chapter, time: g.ct, score: g.chapterScore, total: g.score, hits: g.hits, perfects: g.perfects };
}

export function clearChapter(g, ev) {
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

export const points = (g, n) => {
  g.score += n;
  g.chapterScore += n;
};

export function damage(g, n, ev, by) {
  const m = g.mark;
  m.hp = Math.max(0, m.hp - n);
  m.sinceHurt = 0;
  m.combo = 0;
  g.taken += n;
  ev.push({ type: 'hurt', by, dmg: n, at: [...m.p] });
}

// A dodge started just before an attack reaches him, or just before it
// goes by close (it would have hit, but for the dodge), is a perfect one.
export function perfect(g, ev, by) {
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
export function strike(g, ev, { dmg, dir, knock, by }) {
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

export function next(g, state, timer) {
  g.boss.state = state;
  g.boss.t = 0;
  g.boss.timer = timer;
}

