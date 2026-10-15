// Mario's actions in the air, with the original's numbers: how fast each
// jump leaves the ground, the air drag and steering of
// update_air_without_turn, gravity of 4 a frame to a terminal 75 (2 for the
// long jump), the wall kick off a wall hit at speed, the ground pound's hang
// and drop, the dive and its belly slide, the ledge grab, and fall damage
// from over 1150. Each returns true when it hands over to another action
// this frame.

import { airStep, emit, groundStep, hurt, setAction, setGroundVel, wallYaw } from '../physics';
import { approach, turnToward, wrapAngle } from '../vec';

const FALL_HURT = 1150;

// steering in the air: drag toward 0, a push along the facing, and a
// sideways drift from the stick, as the original does it
function airControl(m, { drag = 32 } = {}) {
  m.fwd = m.fwd > 0 ? Math.max(0, m.fwd - 0.35) : Math.min(0, m.fwd + 0.35);
  let side = 0;
  if (m.mag > 0) {
    const d = m.iyaw - m.yaw;
    m.fwd += m.mag * Math.cos(d) * 1.5;
    side = m.mag * Math.sin(d) * 10;
  }
  if (m.fwd > drag) m.fwd -= 1;
  if (m.fwd < -16) m.fwd += 2;
  const s = Math.sin(m.yaw), c = Math.cos(m.yaw);
  // the side drift is along the facing turned a quarter left: (sin(yaw + π/2), cos(yaw + π/2))
  m.vel.x = m.fwd * s + side * c;
  m.vel.z = m.fwd * c - side * s;
}

// how each jump leaves the ground
const LAUNCH = {
  jump(m) {
    m.vel.y = 42 + m.fwd * 0.25;
    m.cutJump = true;
  },
  double(m) {
    m.vel.y = 52 + m.fwd * 0.25;
    m.cutJump = true;
  },
  triple(m) {
    m.vel.y = 69;
  },
  backflip(m) {
    m.vel.y = 62;
    m.fwd = -16;
  },
  sideflip(m) {
    m.vel.y = 62;
    m.fwd = 8;
    m.yaw = wrapAngle(m.yaw + Math.PI);
  },
  longjump(m) {
    m.vel.y = 30;
    m.fwd = Math.min(48, m.fwd * 1.5);
  },
  wallkick(m) {
    m.vel.y = 62;
    m.fwd = Math.max(24, m.fwd);
  },
  dive(m) {
    m.fwd = Math.min(48, m.fwd + 15);
  },
  rollout(m) {
    m.vel.y = 30;
  },
  jumpkick(m) {
    if (m.vel.y < 20) m.vel.y = 20;
  },
  holdjump(m) {
    m.vel.y = m.held?.heavy ? 22 : 40;
  },
};

export function takeOff(m, kind) {
  const keepVy = kind === 'dive' || kind === 'jumpkick';
  m.airborne = true;
  m.cutJump = false;
  if (!keepVy) m.vel.y = 0;
  LAUNCH[kind]?.(m);
  setAction(m, kind);
  m.peakY = m.pos.y;
  emit(m, 'jump', { kind, vy: m.vel.y });
}

// down on the floor from the air: fall damage, the chain's count, and what
// he lands into
export function landOn(m) {
  const from = m.action;
  const fell = m.peakY - m.pos.y;
  m.airborne = false;
  m.vel.y = 0;
  if (from === 'pound') {
    emit(m, 'pound');
    m.fwd = 0;
    return setAction(m, 'poundland');
  }
  emit(m, 'land', { fell });
  if (fell > FALL_HURT) hurt(m, 3);
  if (m.action === 'dead') return true;
  if (from === 'dive') return setAction(m, 'bellyslide');
  m.chain = { n: from === 'jump' ? 1 : from === 'double' ? 2 : from === 'triple' ? 3 : 0, t: 0 };
  return setAction(m, 'land');
}

// a wall hit in the air at speed: stuck to it for a moment, mirrored, facing
// it; A in that moment kicks off it
function hitWall(m) {
  if (m.fwd <= 16 || !m.wall) return false;
  const W = wallYaw(m.wall);
  m.yaw = wrapAngle(2 * W - m.yaw);
  m.vel.x = m.vel.z = 0;
  if (m.vel.y > 0) m.vel.y = 0;
  return setAction(m, 'airhit');
}

// the jumps and falls: Z pounds, B dives (fast) or kicks (slow); steer,
// fall, land, hit walls, grab ledges
function airborne(m, inp, w, { gravity = 'normal', drag = 32, ledge = true, kick = true, pound = true } = {}) {
  if (pound && inp.zp) {
    inp.zp = false;
    m.fwd = 0;
    m.vel.x = m.vel.y = m.vel.z = 0;
    return setAction(m, 'pound');
  }
  if (kick && inp.bp) {
    inp.bp = false;
    takeOff(m, m.fwd > 28 ? 'dive' : 'jumpkick');
    return true;
  }
  airControl(m, { drag });
  const r = airStep(m, w, { ledge, gravity, aHeld: inp.a });
  if (r === 'landed') return landOn(m);
  if (r === 'ledge') {
    m.airborne = false;
    m.fwd = 0;
    m.vel.x = m.vel.y = m.vel.z = 0;
    return setAction(m, 'ledge');
  }
  if (r === 'wall') return hitWall(m);
  return false;
}

const jump = (m, inp, w) => airborne(m, inp, w);
const double = (m, inp, w) => airborne(m, inp, w);
const triple = (m, inp, w) => airborne(m, inp, w);
const backflip = (m, inp, w) => airborne(m, inp, w, { kick: false });
const sideflip = (m, inp, w) => airborne(m, inp, w, { kick: false });
const longjump = (m, inp, w) => airborne(m, inp, w, { gravity: 'long', drag: 48, kick: false, pound: false, ledge: false });
const wallkick = (m, inp, w) => airborne(m, inp, w);
const freefall = (m, inp, w) => airborne(m, inp, w);
const rollout = (m, inp, w) => airborne(m, inp, w, { kick: false });

function jumpkick(m, inp, w) {
  if (m.t <= 8) m.attack = 'kick';
  return airborne(m, inp, w, { kick: false });
}

function dive(m, inp, w) {
  m.attack = 'dive';
  return airborne(m, inp, w, { kick: false, pound: false, ledge: false });
}

// knocked back by a hurt: no steering until he lands
function knockback(m, inp, w) {
  m.vel.x = m.fwd * Math.sin(m.yaw);
  m.vel.z = m.fwd * Math.cos(m.yaw);
  const r = airStep(m, w);
  if (r === 'landed') {
    m.airborne = false;
    m.vel.y = 0;
    m.fwd = 0;
    return setAction(m, 'land');
  }
  return false;
}

// stuck to a wall he hit: A within 5 frames kicks off it; else he slides off
function airhit(m, inp) {
  if (inp.ap) {
    inp.ap = false;
    m.yaw = wrapAngle(m.yaw + Math.PI);
    takeOff(m, 'wallkick');
    return true;
  }
  if (m.t >= 5) {
    m.fwd = -8;
    return setAction(m, 'freefall');
  }
  return false;
}

// the ground pound: a 10-frame spin in place, then straight down at 50
function pound(m, inp, w) {
  m.vel.x = m.vel.z = 0;
  if (m.t < 10) {
    m.vel.y = 0;
    return false;
  }
  m.vel.y = -50;
  const r = airStep(m, w, { gravity: 'none' });
  if (r === 'landed') return landOn(m);
  return false;
}

function poundland(m, inp, w) {
  if (m.t <= 1) m.attack = 'pound';
  if (inp.ap && m.t > 4) {
    inp.ap = false;
    takeOff(m, 'jump');
    return true;
  }
  m.fwd = 0;
  setGroundVel(m);
  groundStep(m, w);
  if (m.t >= 12) setAction(m, 'idle');
  return false;
}

// after a dive: sliding on his belly; A or B rolls him back onto his feet
function bellyslide(m, inp, w) {
  if (inp.ap || inp.bp) {
    inp.ap = inp.bp = false;
    takeOff(m, 'rollout');
    return true;
  }
  m.fwd = approach(m.fwd, 0, 1);
  m.yaw = turnToward(m.yaw, m.iyaw, m.mag > 0 ? 0.04 : 0);
  setGroundVel(m);
  const r = groundStep(m, w);
  if (r === 'left') {
    m.airborne = true;
    m.vel.y = 0;
    return setAction(m, 'freefall');
  }
  if (r === 'wall') m.fwd = 0;
  if (m.fwd === 0) setAction(m, 'idle');
  return false;
}

// hanging from a ledge (his position is on the ledge top, 60 in): A or the
// stick toward it climbs, Z or the stick away lets go
function ledge(m, inp) {
  const toward = m.mag > 0.5 ? Math.cos(m.iyaw - m.yaw) : 0;
  if (inp.ap || (m.t > 6 && toward > 0.7)) {
    inp.ap = false;
    return setAction(m, 'climb');
  }
  if (inp.zp || (m.t > 6 && toward < -0.7)) {
    inp.zp = false;
    m.pos.x -= Math.sin(m.yaw) * 70;
    m.pos.z -= Math.cos(m.yaw) * 70;
    m.pos.y -= 160;
    m.peakY = m.pos.y;
    m.airborne = true;
    m.fwd = 0;
    return setAction(m, 'freefall');
  }
  return false;
}

function climb(m, inp, w) {
  if (m.t >= 10) {
    setGroundVel(m);
    groundStep(m, w);
    m.peakY = m.pos.y;
    return setAction(m, 'idle');
  }
  return false;
}

// Off lava: 3 wedges (unless still blinking) and a leap of 84; he can steer
// a little, and lands into whatever is there, lava again included.
export function burn(m) {
  if (m.invuln === 0) {
    m.health = Math.max(0, m.health - 3);
    m.invuln = 30;
  }
  emit(m, 'burn');
  m.airborne = true;
  m.vel.y = 84;
  m.peakY = m.pos.y;
  m.held = null;
  setAction(m, 'burn');
}

function burning(m, inp, w) {
  airControl(m, { drag: 24 });
  const r = airStep(m, w);
  if (r === 'landed') {
    m.airborne = false;
    m.vel.y = 0;
    m.peakY = m.pos.y;
    return setAction(m, 'land');
  }
  return false;
}

export const AIR = {
  burn: burning, jump, double, triple, backflip, sideflip, longjump, wallkick, freefall, rollout, jumpkick, dive, knockback, airhit, pound, poundland, bellyslide, ledge, climb };
