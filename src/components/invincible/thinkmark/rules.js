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

import { HALF, RIVER, SKY, clear, rng } from './city';
import { CHAPTERS, DIFFICULTY, LINES, MARK, QUAKE, add, bound, city, clamp, clearChapter, collide, damage, diff, dist, dot, len, lerp, norm, perfect, points, result, say, scale, strike, sub, vec } from './core';
import { BOSSES, bossTell, stepBoss } from './bosses';

// (what was here and moved, under the names it had)
export { BOSSES, CHAPTERS, DIFFICULTY, LINES, MARK, QUAKE, bossTell, city, collide, vec };

const FLAXAN = { r: 0.8, speed: 21, orbit: [15, 27], aim: 0.75, gap: [2.3, 3.8], bolt: 34, boltLife: 3, dmg: 8 };
export const WAVES = [
  { n: 4, hp: 1, age: 0, gap: 1 },
  { n: 6, hp: 1, age: 1, gap: 0.85 },
  { n: 8, hp: 2, age: 2, gap: 0.75 },
];
// the Flaxans' way through, over the river, facing the city
export const PORTAL = { p: [40, 64, 372], n: [0, 0, -1], r: 20 };
export const RINGS = { n: 9, r: 7.5 };

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
