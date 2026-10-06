// Edoras's games, as rules with no drawing, so they can be tested: keeping
// Wormtongue's men off Gandalf in the hall, the drinking game at the feast,
// and the watch for the beacon. ./EdorasWorld.jsx steps them; ./scene.js
// draws them.

import { GANDALF, SHADOWS } from './layout';

export function seeded(seed = 1) {
  let s = seed % 2147483647 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const between = (rand, [a, b]) => a + rand() * (b - a);

// ── Théoden King ──
// Gandalf works at the throne (`work`, 0 to 1). Wormtongue's men come out of
// the shadows between the pillars, one after another, and walk at him; one
// who reaches him breaks his work for a moment (he loses some of it, and
// throws the man back). You walk among them and knock them down (`bash`):
// whoever is close in front of you goes down, and stays down a while, then
// slinks off. The work done, the king is free.
export const BRAWL = { work: 1 / 20, speed: 1.6, gap: [1.4, 2.4], first: 1, reach: 1.2, hit: 1.9, arc: 1.1, setback: 0.16, down: 2.6, cool: 0.35 };

export function newBrawl(seed = 3) {
  const rand = seeded(seed);
  return { t: 0, work: 0, men: [], made: 0, nextT: BRAWL.first, cool: 0, state: 'on', rand, reached: 0, felled: 0 };
}
// One step. Events: 'come' { i }, 'reach' { i }, 'gone' { i }, 'done'.
export function stepBrawl(b, dt) {
  const ev = [];
  if (b.state !== 'on') return ev;
  b.t += dt;
  b.cool = Math.max(0, b.cool - dt);
  b.nextT -= dt;
  if (b.nextT <= 0) {
    const [x, z] = SHADOWS[Math.floor(b.rand() * SHADOWS.length)];
    b.men.push({ i: b.made, x, z, state: 'come', downT: 0 });
    ev.push({ type: 'come', i: b.made });
    b.made += 1;
    b.nextT = between(b.rand, BRAWL.gap);
  }
  for (const m of b.men) {
    if (m.state === 'down') {
      m.downT -= dt;
      if (m.downT <= 0) {
        m.state = 'gone';
        ev.push({ type: 'gone', i: m.i });
      }
      continue;
    }
    if (m.state !== 'come') continue;
    const dx = GANDALF.x - m.x;
    const dz = GANDALF.z - m.z;
    const d = Math.hypot(dx, dz);
    if (d <= BRAWL.reach) {
      // he lays hands on Gandalf: the work falters, and the man is flung back
      b.work = Math.max(0, b.work - BRAWL.setback);
      b.reached += 1;
      m.x -= (dx / d) * 3;
      m.z -= (dz / d) * 3;
      m.state = 'down';
      m.downT = BRAWL.down;
      ev.push({ type: 'reach', i: m.i });
      continue;
    }
    m.x += (dx / d) * BRAWL.speed * dt;
    m.z += (dz / d) * BRAWL.speed * dt;
  }
  b.men = b.men.filter((m) => m.state !== 'gone');
  b.work = Math.min(1, b.work + BRAWL.work * dt);
  if (b.work >= 1) {
    b.state = 'done';
    ev.push({ type: 'done' });
  }
  return ev;
}
// Swing at whoever is close in front of you (you at x, z, facing `face`).
// Returns how many went down (0 is a miss); 'cool' while you recover.
export function bash(b, { x, z, face }) {
  if (b.state !== 'on') return 0;
  if (b.cool > 0) return -1;
  b.cool = BRAWL.cool;
  const fx = Math.cos(face);
  const fz = -Math.sin(face);
  let hit = 0;
  for (const m of b.men) {
    if (m.state !== 'come') continue;
    const dx = m.x - x;
    const dz = m.z - z;
    const d = Math.hypot(dx, dz);
    if (d > BRAWL.hit) continue;
    if (d > 0.3 && Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))) > BRAWL.arc) continue;
    m.state = 'down';
    m.downT = BRAWL.down;
    // knocked back, away from you
    if (d > 0.01) {
      m.x += (dx / d) * 1.4;
      m.z += (dz / d) * 1.4;
    }
    hit += 1;
  }
  b.felled += hit;
  return hit;
}

// ── The drinking game ──
// A tankard swings up to your lips and away again (`k`, -1 to 1: 1 is at
// your lips). Drink while it's there: within `window` of the top. Each
// drink goes to your head; the further it's gone, the faster and less
// steadily the tankard swings and the narrower the moment. Miss, and it goes
// down your beard. When your head is full, you go under the table.
// Legolas drinks one to each of yours, and feels nothing.
export const DRINK = { slow: 2, fast: 0.9, wide: 0.24, narrow: 0.07, per: 0.068, more: 0.0025, spill: 0.012, wobble: 0.6 };

export function newDrink(seed = 5) {
  const rand = seeded(seed);
  return { t: 0, phase: -Math.PI / 2, k: -1, head: 0, drinks: 0, spills: 0, legolas: 0, state: 'on', rand, wob: 0, ready: true };
}
export const windowOf = (head) => DRINK.wide + (DRINK.narrow - DRINK.wide) * Math.min(1, head);
export const periodOf = (head) => DRINK.slow + (DRINK.fast - DRINK.slow) * Math.min(1, head);
// One step. Events: 'top' (it's at your lips), 'away'.
export function stepDrink(d, dt) {
  const ev = [];
  if (d.state !== 'on') return ev;
  d.t += dt;
  // drunker, the swing wobbles
  d.wob += (d.rand() - 0.5) * DRINK.wobble * d.head * dt * 6;
  d.wob *= 1 - Math.min(1, dt * 1.5);
  d.phase += ((Math.PI * 2) / periodOf(d.head)) * dt * (1 + d.wob);
  const was = d.k;
  d.k = Math.sin(d.phase);
  const top = 1 - windowOf(d.head);
  if (was < top && d.k >= top) ev.push({ type: 'top' });
  if (was >= top && d.k < top) {
    d.ready = true;
    ev.push({ type: 'away' });
  }
  return ev;
}
// Drink now: 'drank', 'spilled', or 'down' (that one put you under); 'wait'
// if you've already drunk at this swing.
export function drink(d) {
  if (d.state !== 'on') return 'over';
  if (!d.ready) return 'wait';
  d.ready = false;
  if (d.k >= 1 - windowOf(d.head)) {
    d.drinks += 1;
    d.legolas += 1;
    d.head += DRINK.per + d.drinks * DRINK.more;
    if (d.head >= 1) {
      d.head = 1;
      d.state = 'down';
      return 'down';
    }
    return 'drank';
  }
  d.spills += 1;
  d.head = Math.min(0.999, d.head + DRINK.spill);
  return 'spilled';
}

// ── The beacon ──
// You look along the mountains (`look`, a bearing, turned with A and D);
// after a while a fire is lit on one of the peaks. Say you see it while
// you're looking at it, and you've seen it first.
export const WATCH = { turn: 0.55, min: -0.62, max: 0.36, lit: [4, 8], close: 0.075 };

export function newWatch(seed = 7, peaks = []) {
  const rand = seeded(seed);
  return { t: 0, look: 0, peaks, lit: null, litAt: between(rand, WATCH.lit), state: 'on', rand };
}
// One step; `turn` -1..1. Events: 'lit' { i }.
export function stepWatch(w, dt, turn = 0) {
  const ev = [];
  if (w.state !== 'on') return ev;
  w.t += dt;
  w.look = Math.max(WATCH.min, Math.min(WATCH.max, w.look + Math.max(-1, Math.min(1, turn)) * WATCH.turn * dt));
  if (w.lit == null && w.t >= w.litAt && w.peaks.length) {
    w.lit = Math.floor(w.rand() * w.peaks.length);
    ev.push({ type: 'lit', i: w.lit });
  }
  return ev;
}
// Say you see it: 'spotted', 'nothing' (nothing's lit yet), 'wrong'.
export function spot(w) {
  if (w.state !== 'on') return 'over';
  if (w.lit == null) return 'nothing';
  if (Math.abs(w.look - w.peaks[w.lit].bearing) <= WATCH.close) {
    w.state = 'spotted';
    return 'spotted';
  }
  return 'wrong';
}
