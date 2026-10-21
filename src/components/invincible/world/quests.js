// Things to do in the city, as plain numbers (the drawing is ./challenges.js):
//
// - Dad's rings: ten rings from the Graysons' street, over the suburbs and
//   in among the towers to the Guardians' hall, flown in order against the
//   clock, the best time kept.
// - The title cards: the first season's eight, hidden round the city (on
//   the roof at home, the school's, over the Guardians' dome, on the
//   tallest tower, the GDA's hangar, the beach, Burger Mart's sign, and
//   one high in the sky), each picked up by flying through it.
// - Rescues: every minute or so, somewhere near him, someone slips off the
//   edge of a roof, or a news helicopter loses its tail rotor and comes
//   spinning down. Catch them before the ground, and set them down. (A
//   mission can put one there itself: its `source` says whose it is.)
//
// stepQuests(q, hero, dt, world) → the next state, with this step's events
// in `ev`. The hero is ./flight.js's: { p (his feet), v, mode, zone }; out
// in space (zone 'space', his p the space's) the city goes on without him.
// A step is never longer than a twentieth of a second, whatever `dt` says
// (a tab hidden for a minute comes back as one step).

import { COAST, groundAt, rng } from './map';

// ── the ring course ──
const COURSE = [
  [-2010, 25, 245], // over the street outside the house
  [-1840, 45, 175],
  [-1700, 55, 35], // over the arterial
  [-1440, 70, -40], // into town
  [-1080, 90, -120],
  [-680, 70, -200],
  [-360, 55, -280],
  [-40, 140, -280], // up between the towers
  [40, 80, -120],
  [0, 32, 40], // down to the Guardians' hall
];
const norm = (v) => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l);
};
export const RINGS = COURSE.map((p, i) => {
  const a = COURSE[Math.max(0, i - 1)];
  const b = i === 0 ? COURSE[1] : p;
  const from = i === 0 ? p : a;
  return { p, r: 9, n: norm([b[0] - from[0], b[1] - from[1], b[2] - from[2]]) };
});
export const LESSON_LIMIT = 240; // seconds before the lesson's called off

// ── the title cards ──
const tallest = (w) => w.buildings.reduce((a, b) => (b.h + (b.top?.h ?? 0) > a.h + (a.top?.h ?? 0) ? b : a));
const mark = (w, id) => w.landmarks.find((l) => l.id === id);
export const CARDS = [
  { ep: 1, title: 'It’s About Time', bg: '#1d8fd6', at: (w) => (({ x, z, h }) => [x, h + 2.2 + 2.5, z])(w.houses.find((q) => q.home)) },
  { ep: 2, title: 'Here Goes Nothing', bg: '#e8452c', at: (w) => (({ x, z, h }) => [x - 30, h + 3, z])(mark(w, 'school')) },
  { ep: 3, title: 'Who You Calling Ugly?', bg: '#2f9e5b', at: (w) => (({ x, z }) => [x, 42, z])(mark(w, 'guardians')) },
  { ep: 4, title: 'Neil Armstrong, Eat Your Heart Out', bg: '#7b4bd6', at: (w) => (({ x, z, h, top }) => [x, h + (top?.h ?? 0) + 5, z])(tallest(w)) },
  { ep: 5, title: 'That Actually Hurt', bg: '#f08a1c', at: (w) => (({ x, z, h }) => [x, h + 4, z])(mark(w, 'gda-hangar')) },
  { ep: 6, title: 'You Look Kinda Dead', bg: '#13a3a8', at: () => [420, groundAt(420, COAST - 40) + 2.5, COAST - 40] },
  { ep: 7, title: 'We Need to Talk', bg: '#d6336c', at: (w) => (({ x, z, w: ww, d }) => [x + ww / 2 + 8, 18, z - d / 2 - 2])(mark(w, 'burgermart')) },
  { ep: 8, title: 'Where I Really Come From', bg: '#1b2a4a', at: () => [0, 2500, -400] },
];
const CARD_R = 5;

// ── rescues ──
const FIRST_CALL = 25;
const G = 9.8;
const JUMP = 300; // m in one step: further than he flies, so he was put there, not flown

// (what was kept can be anything by the time it's read back: only what makes sense is taken)
export function newQuests(saved) {
  const s = saved && typeof saved === 'object' ? saved : {};
  return {
    lesson: { on: false, next: 0, t: 0, best: Number.isFinite(s.best) && s.best > 0 ? s.best : null },
    cards: Array.isArray(s.cards) ? CARDS.map((c) => c.ep).filter((ep) => s.cards.includes(ep)) : [],
    saved: Number.isFinite(s.saved) && s.saved > 0 ? Math.floor(s.saved) : 0,
    rescue: null,
    nextCall: FIRST_CALL,
    calls: 0,
    prev: null,
    cardAt: null,
    ev: [],
  };
}

// did the move a→b go through the ring?
function through(ring, a, b) {
  const d0 = (a[0] - ring.p[0]) * ring.n[0] + (a[1] - ring.p[1]) * ring.n[1] + (a[2] - ring.p[2]) * ring.n[2];
  const d1 = (b[0] - ring.p[0]) * ring.n[0] + (b[1] - ring.p[1]) * ring.n[1] + (b[2] - ring.p[2]) * ring.n[2];
  if (d0 === d1 || !((d0 <= 0 && d1 > 0) || (d0 >= 0 && d1 < 0))) return false;
  const k = d0 / (d0 - d1);
  const x = [a[0] + (b[0] - a[0]) * k - ring.p[0], a[1] + (b[1] - a[1]) * k - ring.p[1], a[2] + (b[2] - a[2]) * k - ring.p[2]];
  return Math.hypot(...x) < ring.r;
}

// how near the move a→b came to c (flat out, a slow frame carries him further than a card is wide)
function nearest(a, b, c) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const dd = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const k = dd ? Math.max(0, Math.min(1, ((c[0] - a[0]) * d[0] + (c[1] - a[1]) * d[1] + (c[2] - a[2]) * d[2]) / dd)) : 0;
  return Math.hypot(a[0] + d[0] * k - c[0], a[1] + d[1] * k - c[1], a[2] + d[2] * k - c[2]);
}

// somewhere for the next emergency: a tall roof's edge, or the sky over town
function call(q, hero, world) {
  const r = rng(9001 + q.calls * 7);
  const kind = q.calls % 2 === 0 ? 'fall' : 'heli';
  const [hx, , hz] = hero.p;
  if (kind === 'fall') {
    const tall = world.buildings.filter((b) => b.h >= 60 && !b.top && Math.hypot(b.x - hx, b.z - hz) > 250 && Math.hypot(b.x - hx, b.z - hz) < 1400);
    const pool = tall.length ? tall : world.buildings.filter((b) => b.h >= 60 && !b.top);
    const b = pool[Math.floor(r() * pool.length)];
    return { kind, p: [b.x + b.w / 2 - 0.6, b.h, b.z], v: [0, 0, 0], out: [1, 0, 0], t: 0, phase: 'warn', carried: false, spin: 0, source: 'city' };
  }
  const a = r() * Math.PI * 2;
  const d = 500 + r() * 600;
  const x = Math.max(-1500, Math.min(2500, hx + Math.cos(a) * d));
  const z = Math.max(-2000, Math.min(2000, hz + Math.sin(a) * d));
  return { kind, p: [x, 300, z], v: [0, -4, 0], out: [0, 0, 0], t: 0, phase: 'fall', carried: false, spin: 0, source: 'city' };
}

export function stepQuests(state, hero, rawDt, world) {
  // a twentieth of a second at most (and a step of NaN is no step at all)
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const q = { ...state, lesson: { ...state.lesson }, cards: state.cards, ev: [] };
  const away = hero.zone === 'space';
  const chest = [hero.p[0], hero.p[1] + 1, hero.p[2]];
  // where he was a step ago, unless he was put here (the dev hook, the way back from space)
  const prev = q.prev && Math.hypot(chest[0] - q.prev[0], chest[1] - q.prev[1], chest[2] - q.prev[2]) < JUMP ? q.prev : chest;

  // the rings
  const L = q.lesson;
  if (away) {
    if (L.on) L.t += dt;
  } else if (!L.on) {
    if (through(RINGS[0], prev, chest)) {
      Object.assign(L, { on: true, next: 1, t: 0 });
      // (and the first ring as a ring, so a mission counting rings counts it)
      q.ev.push({ type: 'lesson-start' }, { type: 'ring', n: 0 });
    }
  } else {
    L.t += dt;
    if (through(RINGS[L.next], prev, chest)) {
      q.ev.push({ type: 'ring', n: L.next });
      L.next++;
      if (L.next >= RINGS.length) {
        const best = L.best == null || L.t < L.best;
        if (best) L.best = L.t;
        q.ev.push({ type: 'lesson-done', time: L.t, best });
        L.on = false;
        L.next = 0;
      }
    } else if (L.t > LESSON_LIMIT) {
      q.ev.push({ type: 'lesson-lost' });
      L.on = false;
      L.next = 0;
    }
  }

  // the title cards
  if (!away && q.cards.length < CARDS.length) {
    q.cardAt ??= CARDS.map((c) => c.at(world));
    CARDS.forEach((c, i) => {
      if (q.cards.includes(c.ep)) return;
      if (nearest(prev, chest, q.cardAt[i]) < CARD_R) {
        q.cards = [...q.cards, c.ep].sort((a, b) => a - b);
        q.ev.push({ type: 'card', ep: c.ep, title: c.title, all: q.cards.length === CARDS.length });
      }
    });
  }

  // the rescues (nobody calls him while he's out in space)
  if (!q.rescue && !away) {
    q.nextCall -= dt;
    if (q.nextCall <= 0) {
      q.rescue = call(q, hero, world);
      q.calls++;
      q.ev.push({ type: 'emergency', kind: q.rescue.kind, p: [...q.rescue.p] });
    }
  } else if (q.rescue) {
    const r = { ...q.rescue, p: [...q.rescue.p], v: [...q.rescue.v] };
    q.rescue = r;
    r.t += dt;
    const reach = r.kind === 'heli' ? 7 : 3.5;
    if (!r.carried) {
      if (r.phase === 'warn' && r.t > 7) {
        // over the edge
        r.phase = 'fall';
        r.p[0] += r.out[0] * 1.6;
        r.p[2] += r.out[2] * 1.6;
        r.v = [r.out[0] * 1.5, 0, r.out[2] * 1.5];
        q.ev.push({ type: 'slip' });
      }
      if (r.phase === 'fall') {
        const top = r.kind === 'heli' ? 22 : 48;
        r.v[1] = Math.max(-top, r.v[1] - (r.kind === 'heli' ? 3 : G) * dt);
        for (const a of [0, 1, 2]) r.p[a] += r.v[a] * dt;
        r.spin += dt * (r.kind === 'heli' ? 4 : 2);
      }
      const p = r.kind === 'heli' ? [r.p[0], r.p[1] + 1.5, r.p[2]] : [r.p[0], r.p[1] + 1, r.p[2]];
      if (!away && nearest(prev, chest, p) < reach) {
        r.carried = true;
        // (whose it was: the city's own, or one a mission put there, which only it counts)
        q.ev.push({ type: 'caught', kind: r.kind, source: r.source ?? 'city' });
      } else if (r.phase === 'fall' && r.p[1] <= groundAt(r.p[0], r.p[2])) {
        q.ev.push({ type: 'missed', kind: r.kind, p: [...r.p] });
        q.rescue = null;
        q.nextCall = 50 + rng(31 + q.calls)() * 30;
      }
    }
    if (q.rescue?.carried && !away) {
      // in his arms (or held up over his head), until he lands (in the city: not on the Moon)
      const off = r.kind === 'heli' ? [0, 2.4, 0] : [0, 0.9, 0.35];
      r.p = [hero.p[0] + off[0], hero.p[1] + off[1], hero.p[2] + off[2]];
      r.v = [...hero.v];
      if (hero.mode === 'ground') {
        q.saved++;
        q.ev.push({ type: 'saved', kind: r.kind, count: q.saved });
        q.rescue = null;
        q.nextCall = 50 + rng(31 + q.calls)() * 30;
      }
    }
  }

  q.prev = away ? null : chest;
  return q;
}

// what to keep between visits
// Someone else caught them (a Guardian, ./guardians.js): theirs, not his;
// the next call comes as it would have. A mission's own (its `source`) is
// never theirs to catch: ./inside.js only sends them to the city's.
export function caughtBy(q, who) {
  if (!q.rescue || q.rescue.carried) return q;
  return { ...q, rescue: null, nextCall: 50 + rng(31 + q.calls)() * 30, ev: [...q.ev, { type: 'caughtBy', who, kind: q.rescue.kind }] };
}

export const keepQuests = (q) => ({ cards: q.cards, best: q.lesson.best, saved: q.saved });
