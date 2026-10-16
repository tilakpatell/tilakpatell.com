// How Mario's body moves through a course, a quarter of a frame at a time,
// after Super Mario 64's perform_ground_step and perform_air_step: walls
// pushed out of at two heights, the floor found (a step up of FLOOR_UP is
// taken, a drop of more than 100 leaves the ground), the ceiling kept 160
// clear. The actions in ./moves call these; ./mario.js dispatches to them.

import { FLOOR_UP, carried, findCeil, findFloor, pushWalls } from './collide';
import { angleDiff } from './vec';

export const HEIGHT = 160;
export const MAX_HEALTH = 8;
const GRAV = 4;
export const TERMINAL = 75;

export function setAction(m, name, arg = 0) {
  m.prev = m.action;
  m.action = name;
  m.arg = arg;
  m.t = 0;
  return true;
}

export const emit = (m, type, data) => m.events.push(data ? { type, ...data } : { type });

// the heading a wall faces
export const wallYaw = (s) => Math.atan2(s.n[0], s.n[2]);

// ground velocity from the forward speed and the facing
export function setGroundVel(m) {
  m.vel.x = m.fwd * Math.sin(m.yaw);
  m.vel.z = m.fwd * Math.cos(m.yaw);
  m.vel.y = 0;
}

function groundQuarter(m, w, p) {
  // (a wall no taller than a step up is a step: he walks up it)
  pushWalls(w, p, 30, 24, FLOOR_UP);
  const upper = pushWalls(w, p, 60, 50, FLOOR_UP);
  const f = findFloor(w, p.x, p.y, p.z);
  if (!f) return 'stop';
  const c = findCeil(w, p.x, f.y + 80, p.z);
  const ceilY = c ? c.y : Infinity;
  if (p.y > f.y + 100) {
    if (p.y + HEIGHT >= ceilY) return 'stop';
    m.pos.x = p.x;
    m.pos.y = p.y;
    m.pos.z = p.z;
    m.floor = f.surf;
    m.floorY = f.y;
    return 'left';
  }
  if (f.y + HEIGHT >= ceilY) return 'stop';
  m.pos.x = p.x;
  m.pos.y = f.y;
  m.pos.z = p.z;
  m.floor = f.surf;
  m.floorY = f.y;
  m.wall = upper;
  if (upper) {
    const d = Math.abs(angleDiff(wallYaw(upper), m.yaw));
    // sliding along it (60° to 120° off) isn't hitting it
    if (d >= Math.PI / 3 && d <= (Math.PI * 2) / 3) return 'none';
    return 'wall';
  }
  return 'none';
}

// four quarter steps along vel on the ground → 'none' | 'left' | 'wall'
export function groundStep(m, w) {
  m.wall = null;
  let result = 'none';
  for (let i = 0; i < 4; i++) {
    const p = { x: m.pos.x + m.vel.x / 4, y: m.pos.y, z: m.pos.z + m.vel.z / 4 };
    const r = groundQuarter(m, w, p);
    if (r === 'left') return 'left';
    if (r === 'stop') return 'wall';
    if (r === 'wall') result = 'wall';
  }
  return result;
}

// A ledge grab: falling, a wall at the feet but none at the head, and a
// floor on top of it within reach. Mario is put on the ledge's top, 60 in,
// facing the wall; the hang is drawn below it.
function ledgeGrab(m, w, wall, p) {
  if (m.vel.y > 0) return false;
  const lx = p.x - wall.n[0] * 60;
  const lz = p.z - wall.n[2] * 60;
  const f = findFloor(w, lx, p.y + 160, lz);
  if (!f || f.y - p.y <= 100 || f.surf.n[1] < 0.9) return false;
  m.pos.x = lx;
  m.pos.y = f.y;
  m.pos.z = lz;
  m.floor = f.surf;
  m.floorY = f.y;
  m.yaw = wallYaw(wall) + Math.PI;
  m.ledgeWall = wall;
  return true;
}

function airQuarter(m, w, p, ledge) {
  const upper = pushWalls(w, p, 150, 50);
  const lower = pushWalls(w, p, 30, 50);
  const f = findFloor(w, p.x, p.y, p.z);
  const c = findCeil(w, p.x, (f ? f.y : p.y) + 80, p.z);
  const ceilY = c ? c.y : Infinity;
  if (!f) {
    // nothing below: no going sideways out of the world, but down he goes
    m.pos.y = p.y;
    return 'wall';
  }
  if (p.y <= f.y) {
    if (ceilY - f.y > HEIGHT) {
      m.pos.x = p.x;
      m.pos.y = f.y;
      m.pos.z = p.z;
      m.floor = f.surf;
      m.floorY = f.y;
    }
    return 'landed';
  }
  if (p.y + HEIGHT > ceilY) {
    if (m.vel.y >= 0) {
      m.vel.y = 0;
      if (ceilY - f.y > HEIGHT) {
        m.pos.x = p.x;
        m.pos.z = p.z;
        m.pos.y = ceilY - HEIGHT;
        m.floor = f.surf;
        m.floorY = f.y;
      }
      emit(m, 'bonk');
      return 'none';
    }
    // falling with a ceiling at the head: sliding under a slope's lip
    return 'wall';
  }
  if (ledge && !upper && lower && ledgeGrab(m, w, lower, p)) return 'ledge';
  m.pos.x = p.x;
  m.pos.y = p.y;
  m.pos.z = p.z;
  m.floor = f.surf;
  m.floorY = f.y;
  const wall = upper ?? lower;
  if (wall) {
    m.wall = wall;
    // facing into it, within 45° of straight on
    if (Math.abs(angleDiff(wallYaw(wall), m.yaw)) > (Math.PI * 3) / 4) return 'wall';
  }
  return 'none';
}

// Gravity, by kind: 'normal', 'long' (the long jump's floatier arc), 'none'.
function applyGravity(m, kind = 'normal', aHeld = true) {
  if (kind === 'none') return;
  if (m.cutJump && !aHeld && m.vel.y > 20) {
    m.vel.y *= 0.25;
    m.cutJump = false;
  }
  m.vel.y -= kind === 'long' ? 2 : GRAV;
  if (m.vel.y < -TERMINAL) m.vel.y = -TERMINAL;
}

// four quarter steps along vel in the air, then gravity → 'none' | 'landed' |
// 'wall' | 'ledge'
export function airStep(m, w, { ledge = false, gravity = 'normal', aHeld = true } = {}) {
  m.wall = null;
  let result = 'none';
  for (let i = 0; i < 4; i++) {
    const p = { x: m.pos.x + m.vel.x / 4, y: m.pos.y + m.vel.y / 4, z: m.pos.z + m.vel.z / 4 };
    const r = airQuarter(m, w, p, ledge);
    if (r === 'landed' || r === 'ledge') {
      result = r;
      break;
    }
    if (r === 'wall') result = 'wall';
  }
  if (m.vel.y >= 0) m.peakY = m.pos.y;
  if (result !== 'landed' && result !== 'ledge') applyGravity(m, gravity, aHeld);
  return result;
}

// standing on a moving platform: carried with it
export function ride(m) {
  const c = m.floor?.owner;
  if (!c || m.airborne) return;
  const p = carried(c, m.pos.x, m.pos.y, m.pos.z);
  m.pos.x = p.x;
  m.pos.y = p.y;
  m.pos.z = p.z;
  // turned with it too
  const turn = Math.atan2(c.m[2], c.m[0]) - Math.atan2(c.prev[2], c.prev[0]);
  m.yaw += turn;
}

export function die(m) {
  if (m.action === 'dead') return;
  m.health = 0;
  m.airborne = false;
  m.held = null;
  setAction(m, 'dead');
  emit(m, 'dead');
}

// Takes wedges of health; from a point (fromX, fromZ), he faces it and is
// knocked back from it. Not while blinking from the last hurt.
export function hurt(m, wedges, fromX, fromZ) {
  if (m.invuln > 0 || wedges <= 0 || m.action === 'dead') return false;
  m.health = Math.max(0, m.health - wedges);
  m.invuln = 60;
  emit(m, 'hurt', { wedges });
  if (m.health <= 0) {
    die(m);
    return true;
  }
  if (fromX != null) {
    m.yaw = Math.atan2(fromX - m.pos.x, fromZ - m.pos.z);
    m.fwd = -16;
    m.vel.y = 30;
    m.airborne = true;
    m.held = null;
    setAction(m, 'knockback');
  }
  return true;
}

export function heal(m, wedges) {
  m.health = Math.min(MAX_HEALTH, m.health + wedges);
}
