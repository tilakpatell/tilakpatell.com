// Everything in a course that isn't Mario or the ground: coins, stars,
// signs, doors, paintings and the cast. Each type is { r, h (its cylinder),
// make(a, g), step(a, g), touch(a, g, how), check(a, g) (in place of the
// cylinder test), talk(a, g) (B in front of it), holdable }. Each frame the
// game steps them, then Mario's cylinder (radius 37, height 160) is tested
// against theirs, and `how` says how they met: 'pound', 'stomp' (falling onto
// it from above), 'attack' (a punch, kick or dive reaching it) or 'touch'.
// What happened goes onto g.out as events for the game.
//
// newScene({ world, mario, save, area }) → g; g.spawn(def) → actor;
// stepActors(g); interact(g); tryTalk(g) → whether B was used on something.

import { FOES } from './foes';
import { OBJECTS } from './objects';

export const TYPES = { ...OBJECTS, ...FOES };
const MARIO_R = 37;
const MARIO_H = 160;
const REACH = 70; // how far past him a punch or kick lands

export function newScene({ world, mario, save, area = {} }) {
  const g = { world, mario, save, area, actors: [], out: [], visit: { coins: 0, reds: 0 }, nextId: 1, t: 0 };
  g.spawn = (def) => spawn(g, def);
  return g;
}

export function spawn(g, def) {
  const T = TYPES[def.type];
  if (!T) throw new Error(`no actor type ${def.type}`);
  const a = {
    id: g.nextId++,
    type: def.type,
    def,
    pos: { x: def.x ?? 0, y: def.y ?? 0, z: def.z ?? 0 },
    home: { x: def.x ?? 0, y: def.y ?? 0, z: def.z ?? 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: def.yaw ?? 0,
    state: 'idle',
    t: 0,
    alive: true,
    r: def.r ?? T.r,
    h: def.h ?? T.h,
  };
  T.make?.(a, g);
  g.actors.push(a);
  return a;
}

export function stepActors(g) {
  for (const a of [...g.actors]) {
    if (!a.alive) continue;
    TYPES[a.type].step?.(a, g);
    a.t++;
  }
  g.actors = g.actors.filter((a) => a.alive);
}

// in front of Mario, within `cone` radians of his facing
export function inFront(m, a, cone = Math.PI / 3) {
  const dx = a.pos.x - m.pos.x, dz = a.pos.z - m.pos.z;
  if (dx === 0 && dz === 0) return true;
  const d = Math.atan2(dx, dz) - m.yaw;
  return Math.cos(d) >= Math.cos(cone);
}

export const flatDist = (m, a) => Math.hypot(a.pos.x - m.pos.x, a.pos.z - m.pos.z);

function overlaps(m, a, extra = 0) {
  if (flatDist(m, a) >= MARIO_R + a.r + extra) return false;
  return m.pos.y < a.pos.y + a.h && m.pos.y + MARIO_H > a.pos.y;
}

// (where he was at the start of the frame: a fast fall crosses a Goomba's
// top within one)
function howMet(m, a) {
  const mid = a.pos.y + a.h / 2;
  const y = m.prevY ?? m.pos.y;
  if ((m.action === 'pound' || (m.action === 'poundland' && m.t <= 1)) && y >= mid - 20) return 'pound';
  if ((m.prevAir ?? m.airborne) && (m.prevVy ?? m.vel.y) < 0 && y >= mid) return 'stomp';
  if (m.attack) return 'attack';
  return 'touch';
}

export function interact(g) {
  const m = g.mario;
  if (m.action === 'dead') return;
  for (const a of [...g.actors]) {
    if (!a.alive) continue;
    const T = TYPES[a.type];
    if (T.check) {
      T.check(a, g);
      continue;
    }
    if (!T.touch) continue;
    const reach = m.attack && m.attack !== 'dive' && inFront(m, a) ? REACH : 0;
    if (!overlaps(m, a, reach)) continue;
    T.touch(a, g, howMet(m, a));
  }
  g.actors = g.actors.filter((a) => a.alive);
}

// B in front of something to read or talk to: that, instead of a punch
export function tryTalk(g) {
  const m = g.mario;
  if (m.airborne) return false;
  for (const a of g.actors) {
    const T = TYPES[a.type];
    if (!a.alive || !T.talk) continue;
    if (flatDist(m, a) > 200 || Math.abs(a.pos.y - m.pos.y) > 200 || !inFront(m, a)) continue;
    T.talk(a, g);
    return true;
  }
  return false;
}

// B beside something holdable (from behind, for the king): picked up
const BUSY = new Set(['held', 'thrown', 'gone', 'flat', 'knocked', 'stunned', 'defeated', 'return']);
const CAN_GRAB = new Set(['idle', 'walk', 'stop', 'land', 'crouch', 'skid']);
function tryGrab(g) {
  const m = g.mario;
  if (m.airborne || m.held || !CAN_GRAB.has(m.action)) return false;
  for (const a of g.actors) {
    const T = TYPES[a.type];
    if (!a.alive || !T.holdable || BUSY.has(a.state)) continue;
    if (flatDist(m, a) > MARIO_R + a.r + 80 || Math.abs(a.pos.y - m.pos.y) > 150) continue;
    if (T.grabbable ? !T.grabbable(a, g) : !inFront(m, a, Math.PI / 2.5)) continue;
    a.state = 'held';
    a.heavy = Boolean(T.heavy);
    m.held = a;
    m.fwd = 0;
    m.prev = m.action;
    m.action = 'pickup';
    m.t = 0;
    tell(g, 'grab', { type: a.type });
    return true;
  }
  return false;
}

// what B does before it's a punch: read, talk, or pick up
export const pressB = (g) => tryTalk(g) || tryGrab(g);

export const tell = (g, type, data) => g.out.push(data ? { type, ...data } : { type });
