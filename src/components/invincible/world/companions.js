// Eve and Dad, going about with Mark: rules only (./npcs.js draws Eve and
// ./scene.js Dad, from these). Plain [x, y, z] arrays, metres; a frame is
// stepped whole, in steps of at most 0.05 s (the dev clock runs the game at
// several times real, and they keep their speed against it); a frame over a
// second, a hidden tab's, is one short step.
//
// Eve: `patrol` (her loop round downtown); `intercept` (he's hung about
// still within 300 m of her for 4 s: she comes over to 6 m from him, and
// says so); `escort` (he flies off from beside her: she holds 8 m off his
// left for 40 s, then peels back to her loop); `fight` (a foe within 400 m:
// she goes for it, with a word if he's near, knocking one out every 8 s);
// `talk` (E beside her: a line, and she waits). She never leads; she helps.
//
// Dad: `watch` (over downtown); `lesson` (Dad's rings: 50 m behind him and
// 20 m up, a word at each of the first three rings, impatient after 90 s);
// `home` (dusk and night, on the porch by Debbie, with a word when Mark
// comes up to it); `spar` (the last
// episode: he flies ahead through his points, waiting at each until Mark's
// within 20 m).
//
// sense: { hero, heroV, heroMode, lesson: { on, next, t } | null, mission,
// spar: [[x, y, z]…] | null, foes: [[x, y, z]…], talk, time }

import { COMPANION } from './lines';

// (she waits `patience` s beside him, then flies on, and doesn't come over
// again until he's been off past `spot`: he can't keep her in the air for ever)
export const EVE = { still: 4, spot: 300, beside: 6, left: 8, escort: 40, foe: 400, every: 8, talkR: 6, talk: 5, fast: 70, off: 8, patience: 45, over: 20 };
// (home: a word when Mark comes within `greet` m of the porch, again once he's been past `gone`)
export const DAD = { watch: [40, 150, -60], fast: 60, follow: 90, behind: 50, above: 20, slow: 90, slowEvery: 30, sparR: 20, greet: 12, gone: 40 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v) => Math.hypot(v[0], v[1], v[2]);
const dist = (a, b) => len(sub(a, b));
const STEP = 0.05;
const HIDDEN = 1; // s: a frame longer than this is a hidden tab's
const clampDt = (dt) => Math.min(STEP, Math.max(0, dt || 0));
// a frame's whole `dt` as steps of at most STEP through `once` (the rules for
// one step), the events of all of them in order
function whole(prev, sense, dt, once, key) {
  const span = dt > HIDDEN ? STEP : Math.max(0, dt || 0);
  const n = Math.max(1, Math.ceil(span / STEP - 1e-9));
  let cur = prev;
  const ev = [];
  for (let i = 0; i < n; i++) {
    const r = once(cur, sense, span / n);
    cur = r[key];
    ev.push(...r.ev);
  }
  return { [key]: cur, ev };
}

// `p` moved toward `to` at no more than `speed`
function toward(p, to, speed, dt) {
  const d = sub(to, p);
  const l = len(d);
  const step = speed * dt;
  if (l <= step) return [...to];
  return [p[0] + (d[0] / l) * step, p[1] + (d[1] / l) * step, p[2] + (d[2] / l) * step];
}
// where her loop has her at `s` (as ./npcs.js always drew it), and over
// the towers on it: `roof(x, z)`, if the loop has one, is the highest roof
// near there, and she keeps `EVE.over` m above it from a little before it
const flatAt = (L, s) => [L.cx + Math.cos(s) * L.rad, L.cz + Math.sin(s) * L.rad * 0.7];
function loopAt(L, s) {
  const [x, z] = flatAt(L, s);
  let y = L.y + Math.sin(s * 3) * 25;
  if (L.roof) for (const k of [-0.04, 0, 0.06, 0.12, 0.18]) y = Math.max(y, L.roof(...flatAt(L, s + k)) + EVE.over);
  return [x, y, z];
}
// which way he's flying, flat (or the last way, if he's still)
function heading(v, last) {
  const l = Math.hypot(v[0], v[2]);
  return l > 1 ? [v[0] / l, 0, v[2] / l] : last;
}
const line = (who, list, i) => ({ type: 'line', who, text: list[i % list.length] });

export function newEve(loop) {
  const p = loopAt(loop, 0);
  return { state: 'patrol', loop, s: 0, p, v: [0, 0, 0], still: 0, t: 0, hit: 0, said: 0, dir: [0, 0, 1], done: false };
}

export const stepEve = (prev, sense, dt) => whole(prev, sense, dt, stepEveOnce, 'eve');
function stepEveOnce(prev, sense, rawDt) {
  const dt = clampDt(rawDt);
  const e = { ...prev, p: [...prev.p] };
  const ev = [];
  const hero = sense.hero;
  const d = dist(e.p, hero);
  const heroSpeed = len(sense.heroV ?? [0, 0, 0]);
  e.dir = heading(sense.heroV ?? [0, 0, 0], e.dir);
  if (d > EVE.spot) e.done = false;
  // the nearest foe within reach, and which it is
  let foe = -1;
  let fd = EVE.foe;
  (sense.foes ?? []).forEach((f, i) => {
    const k = dist(e.p, f);
    if (k < fd) [foe, fd] = [i, k];
  });

  // E beside her: she stops to talk, whatever she was at (bar a fight)
  if (sense.talk && d < EVE.talkR && e.state !== 'fight' && e.state !== 'talk') {
    ev.push(line('eve', COMPANION.eveMeet, e.said++));
    Object.assign(e, { state: 'talk', t: EVE.talk });
  } else if (foe >= 0 && e.state !== 'fight') {
    Object.assign(e, { state: 'fight', hit: 0 });
    if (d < EVE.spot) ev.push(line('eve', COMPANION.eveFight, e.said++));
  }

  let to = e.p;
  let speed = EVE.fast;
  switch (e.state) {
    case 'fight': {
      if (foe < 0) {
        e.state = 'patrol';
        break;
      }
      // in close to it, from her side
      const f = sense.foes[foe];
      const k = Math.max(1e-6, fd);
      to = [f[0] + ((e.p[0] - f[0]) / k) * EVE.off, f[1] + ((e.p[1] - f[1]) / k) * EVE.off, f[2] + ((e.p[2] - f[2]) / k) * EVE.off];
      e.hit += dt;
      if (e.hit >= EVE.every) {
        e.hit -= EVE.every;
        ev.push({ type: 'eveHit', foe });
      }
      break;
    }
    case 'talk':
      e.t -= dt;
      speed = 0;
      if (e.t <= 0) Object.assign(e, d < EVE.spot && !e.done ? { state: 'intercept', t: EVE.patience } : { state: 'patrol' });
      break;
    case 'intercept': {
      // beside him, 6 m off, on her side of him
      const k = Math.max(1e-6, d);
      to = [hero[0] + ((e.p[0] - hero[0]) / k) * EVE.beside, hero[1] + ((e.p[1] - hero[1]) / k) * EVE.beside, hero[2] + ((e.p[2] - hero[2]) / k) * EVE.beside];
      e.t -= dt;
      if (heroSpeed > 8 && d < EVE.beside * 3) {
        ev.push(line('eve', COMPANION.eveEscort, e.said++));
        Object.assign(e, { state: 'escort', t: EVE.escort });
      } else if (d > EVE.spot || e.t <= 0) Object.assign(e, { state: 'patrol', done: e.t <= 0 });
      break;
    }
    case 'escort': {
      // 8 m off his left: heading (x, z), his left is (z, −x)
      to = [hero[0] + e.dir[2] * EVE.left, hero[1], hero[2] - e.dir[0] * EVE.left];
      e.t -= dt;
      if (e.t <= 0) e.state = 'patrol';
      break;
    }
    default: {
      e.state = 'patrol';
      e.s += (e.loop.speed / e.loop.rad) * dt;
      to = loopAt(e.loop, e.s);
      // he's hung about near her a while: over she goes
      e.still = d < EVE.spot && heroSpeed < 3 && !e.done ? e.still + dt : 0;
      if (e.still >= EVE.still) {
        e.still = 0;
        ev.push(line('eve', COMPANION.eveMeet, e.said++));
        Object.assign(e, { state: 'intercept', t: EVE.patience });
      }
    }
  }
  const was = prev.p;
  e.p = toward(e.p, to, speed, dt);
  e.v = dt > 0 ? sub(e.p, was).map((c) => c / dt) : [0, 0, 0];
  return { eve: e, ev };
}

export function newDad({ watch = DAD.watch, porch = null } = {}) {
  return { state: 'watch', watch, porch, p: [...watch], v: [0, 0, 0], ring: null, slowAt: -1, next: 0, said: 0, dir: [0, 0, 1] };
}

export const stepDad = (prev, sense, dt) => whole(prev, sense, dt, stepDadOnce, 'dad');
function stepDadOnce(prev, sense, rawDt) {
  const dt = clampDt(rawDt);
  const d = { ...prev, p: [...prev.p] };
  const ev = [];
  const hero = sense.hero;
  d.dir = heading(sense.heroV ?? [0, 0, 0], d.dir);
  let to = d.watch;
  let speed = DAD.fast;
  const L = sense.lesson;

  if (sense.mission === 'ep7' && sense.spar?.length) {
    // the spar: ahead to each of his points, and wait there for Mark
    if (d.state !== 'spar') Object.assign(d, { state: 'spar', next: 0 });
    const i = Math.min(d.next, sense.spar.length - 1);
    to = sense.spar[i];
    if (d.next < sense.spar.length && dist(d.p, to) < 1 && dist(hero, to) < DAD.sparR) {
      ev.push({ type: 'dadAt', i: d.next });
      d.next += 1;
      if (d.next < sense.spar.length) ev.push(line('omni', COMPANION.dadSpar, d.next));
      else ev.push({ type: 'dadDone' });
    }
  } else if (L?.on) {
    // the rings: behind him and over him, a word as he goes through each
    // (the lesson starts as he goes through the first: that one has its word too)
    if (d.state !== 'lesson' || d.ring == null) Object.assign(d, { state: 'lesson', ring: 0, slowAt: -1 });
    to = [hero[0] - d.dir[0] * DAD.behind, hero[1] + DAD.above, hero[2] - d.dir[2] * DAD.behind];
    speed = DAD.follow;
    if (L.next > d.ring) {
      for (let k = d.ring; k < L.next; k++) if (k < 3) ev.push(line('omni', COMPANION.dadRing, k));
      d.ring = L.next;
    }
    if (L.t > DAD.slow && (d.slowAt < 0 || L.t - d.slowAt >= DAD.slowEvery)) {
      d.slowAt = L.t;
      ev.push(line('omni', COMPANION.dadSlow, d.said++));
    }
  } else if ((sense.time === 'dusk' || sense.time === 'night') && d.porch) {
    d.state = 'home';
    to = d.porch;
    const by = dist(hero, d.porch);
    if (by < DAD.greet && !d.greeted && dist(d.p, d.porch) < 1) {
      d.greeted = true;
      ev.push(line('omni', COMPANION.dadHome, d.said++));
    } else if (by > DAD.gone) d.greeted = false;
  } else d.state = 'watch';
  if (d.state !== 'lesson') d.ring = null;

  const was = prev.p;
  d.p = toward(d.p, to, speed, dt);
  d.v = dt > 0 ? sub(d.p, was).map((c) => c / dt) : [0, 0, 0];
  return { dad: d, ev };
}
