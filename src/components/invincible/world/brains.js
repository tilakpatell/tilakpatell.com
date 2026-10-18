// The townspeople's brains: rules only (./npcs.js poses and draws them).
// Each person stands somewhere of their own (`home`), and is one of: idle
// (weight shifting, looking about), chat (in a group, turned to the
// others), wander (a few steps off and back: along their pavement, for a
// passer-by), look (turned to Mark when he's about), wave (he's hanging
// near them), gather (he's landed close by: they come up to him, phones
// out), flee (something hit the ground near them: they run, and stay
// jumpy for a while, too frightened to come and gawp) and cheer (a fight
// near them was won). A frightened person runs first; then cheering beats
// gathering beats waving beats looking.
//
// sense: { hero: [x, y, z], heroMode, heroSpeed, slam: [x, z] | null,
// hit: [x, z] | null, carried: [x, z] | null (a car he's carrying), line:
// [[x, z], [x, z]] | null (Omni-Man's line-break, ./powers.js: 60 m either
// side of it floors them), fight, won, time }; r: a seeded random (lib/seeded).

import { WALK } from './traffic';

// the nearest point to `p` on a line-break's line, if it's within 60 m of it
function onLine(p, [a, b]) {
  const d = [b[0] - a[0], b[1] - a[1]];
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (d[0] * d[0] + d[1] * d[1] || 1)));
  const q = [a[0] + d[0] * k, a[1] + d[1] * k];
  return Math.hypot(p[0] - q[0], p[1] - q[1]) <= 60 ? q : null;
}

const BRAIN = { walk: 1.3, run: 4, flee: 6, fright: 40, calm: 20, cheer: 4, cheerR: 80, gatherR: 25, gather: 12, near: 6, waveR: 15, wave: 3, waveCool: 20, lookR: 30, roam: 20, roamMin: 6, mill: 4 };

const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// walk: { axis, line, side } for a passer-by, whose pavement is WALK off
// the street at `line` (traffic.js's), on its `side` (±1)
export function newBrain({ home, yaw = 0, group = null, walk = null }) {
  const at = onPavement([...home], walk);
  return { state: 'idle', t: 2, home: at, at: [...at], yaw, face: yaw, target: null, fear: 0, group, walk, away: null, cool: 0, gathered: false };
}

// a point held to its pavement (unchanged for someone who isn't on one)
function onPavement(p, walk) {
  if (!walk) return p;
  const k = walk.axis === 'x' ? 1 : 0;
  p[k] = walk.line + WALK * walk.side;
  return p;
}

// `n` moved toward `to` at `speed`, along its pavement if it keeps to one;
// true when it's there
function moveToward(n, to, speed, dt) {
  const goal = onPavement([...to], n.walk);
  const d = dist(n.at, goal);
  const step = speed * dt;
  if (d <= step) {
    n.at = goal;
    return true;
  }
  n.at = onPavement([n.at[0] + ((goal[0] - n.at[0]) / d) * step, n.at[1] + ((goal[1] - n.at[1]) / d) * step], n.walk);
  return false;
}

// somewhere to wander to: 6–20 m off along the pavement (within 20 m of
// home), or a few steps round home for someone without one
function roamTo(n, r) {
  if (!n.walk) {
    const a = r() * Math.PI * 2;
    const d = r() * BRAIN.mill;
    return [n.home[0] + Math.cos(a) * d, n.home[1] + Math.sin(a) * d];
  }
  const k = n.walk.axis === 'x' ? 0 : 1;
  const here = n.at[k] - n.home[k];
  const len = BRAIN.roamMin + r() * (BRAIN.roam - BRAIN.roamMin);
  const go = Math.max(-BRAIN.roam, Math.min(BRAIN.roam, here + (r() < 0.5 ? -len : len)));
  const p = [...n.at];
  p[k] = n.home[k] + go;
  return p;
}

export function stepBrain(b, sense, rawDt, r) {
  // a twentieth of a second at most (a hidden tab is one short step)
  const dt = Math.min(0.05, Math.max(0, rawDt || 0));
  const n = { ...b, at: [...b.at] };
  const hero = [sense.hero[0], sense.hero[2]];
  const dHero = dist(n.at, hero);
  const d3 = Math.hypot(dHero, sense.hero[1] ?? 0);
  const still = (sense.heroSpeed ?? 0) < 3;
  const landed = sense.heroMode === 'ground' && still;
  n.cool = Math.max(0, n.cool - dt);
  if (n.state !== 'flee') n.fear = Math.max(0, n.fear - dt / BRAIN.calm);
  // he's gone: the next time he lands near, they come again
  if (n.gathered && (!landed || dHero > BRAIN.lookR)) n.gathered = false;

  // something hit the ground near them, or a car's being carried over them: run, away from it
  const danger = (sense.line && onLine(n.at, sense.line)) || [sense.slam, sense.hit, sense.carried].find((p) => p && dist(n.at, p) < BRAIN.fright);
  if (danger) {
    const d = dist(n.at, danger);
    const a = d > 1e-6 ? [(n.at[0] - danger[0]) / d, (n.at[1] - danger[1]) / d] : [Math.cos(r() * 6.28), Math.sin(r() * 6.28)];
    Object.assign(n, { state: 'flee', t: BRAIN.flee, fear: 1, away: a, target: null });
  } else if (sense.won && dHero < BRAIN.cheerR && n.state !== 'flee' && n.state !== 'cheer') Object.assign(n, { state: 'cheer', t: BRAIN.cheer, target: null });

  let face = n.face;
  const toHero = Math.atan2(hero[0] - n.at[0], hero[1] - n.at[1]);
  switch (n.state) {
    case 'flee': {
      n.t -= dt;
      // (along the pavement, for a passer-by: away down it, not through a wall)
      moveToward(n, [n.at[0] + n.away[0] * 10, n.at[1] + n.away[1] * 10], BRAIN.run, dt);
      face = Math.atan2(n.away[0], n.away[1]);
      if (n.t <= 0) Object.assign(n, { state: 'idle', t: 2 + r() * 3, away: null });
      break;
    }
    case 'cheer':
      n.t -= dt;
      face = toHero;
      if (n.t <= 0) Object.assign(n, { state: 'idle', t: 1 + r() * 2 });
      break;
    case 'gather': {
      n.t -= dt;
      moveToward(n, n.target, BRAIN.walk, dt);
      face = toHero;
      if (n.t <= 0 || !landed || dHero > BRAIN.gatherR) Object.assign(n, { state: 'idle', t: 1 + r() * 2, target: null });
      break;
    }
    case 'wave':
      n.t -= dt;
      face = toHero;
      if (n.t <= 0) Object.assign(n, { state: d3 < BRAIN.lookR ? 'look' : 'idle', t: 1 + r() * 2 });
      break;
    default: {
      if (landed && dHero < BRAIN.gatherR && n.fear < 0.2 && !n.gathered) {
        // up to him, to a spot 6 m from him on their side, phone up
        const d = dHero || 1;
        const spot = [hero[0] + ((n.at[0] - hero[0]) / d) * BRAIN.near, hero[1] + ((n.at[1] - hero[1]) / d) * BRAIN.near];
        Object.assign(n, { state: 'gather', t: BRAIN.gather, target: spot, gathered: true });
        face = toHero;
      } else if (d3 < BRAIN.waveR && still && n.cool <= 0 && n.fear < 0.5) {
        Object.assign(n, { state: 'wave', t: BRAIN.wave, cool: BRAIN.waveCool });
        face = toHero;
      } else if (d3 < BRAIN.lookR) {
        n.state = 'look';
        face = toHero;
      } else if (n.state === 'look') Object.assign(n, { state: 'idle', t: 1 + r() * 2 });
      else if (n.state === 'wander') {
        face = Math.atan2(n.target[0] - n.at[0], n.target[1] - n.at[1]);
        if (moveToward(n, n.target, BRAIN.walk, dt)) Object.assign(n, { state: 'idle', t: 3 + r() * 5, target: null });
      } else {
        // idle or chatting, a while; then a few steps somewhere, or (in a group) a chat
        n.t -= dt;
        if (n.t <= 0) {
          if (n.group != null && r() < 0.5) Object.assign(n, { state: 'chat', t: 4 + r() * 6 });
          else if (r() < 0.6) Object.assign(n, { state: 'wander', target: roamTo(n, r) });
          else Object.assign(n, { state: 'idle', t: 3 + r() * 5 });
        }
      }
    }
  }
  n.yaw += angle(face - n.yaw) * (1 - Math.exp(-6 * dt));
  return n;
}

const POSE = { idle: 'idle', look: 'idle', chat: 'talk', wander: 'walk', wave: 'wave', gather: 'phone', flee: 'run', cheer: 'cheer' };
export const poseOf = (b) => POSE[b.state] ?? 'idle';

// how many of a spot's people are out at this time of day (and nobody on
// the school's steps at night)
export function crowdCount(base, time, { school = false } = {}) {
  if (school && time === 'night') return 0;
  return Math.round(base * ({ noon: 1, dusk: 0.7, night: 0.35 }[time] ?? 1));
}
