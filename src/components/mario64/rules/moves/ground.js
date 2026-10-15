// Mario's actions on the ground: standing, walking and running (the
// original's update_walking_speed), stopping, skidding on a hard reverse,
// crouching, crawling, the crouch slide, the punch-punch-kick and the few
// frames of landing in which the next jump of a chain can be taken. Each
// returns true when it hands over to another action this frame.

import { emit, groundStep, setAction, setGroundVel } from '../physics';
import { angleDiff, approach, turnToward } from '../vec';
import { takeOff } from './air';

export const RUN = 32;
const TURN = 0.2; // radians a frame toward the stick (the original's 0x800)

function toFreefall(m) {
  m.airborne = true;
  m.vel.y = 0;
  setAction(m, 'freefall');
}

// the next jump of a chain: a double within 5 frames of landing a single, a
// triple after a double when fast enough
function nextJump(m) {
  if (m.chain.t <= 5) {
    if (m.chain.n === 1) return 'double';
    if (m.chain.n === 2 && m.fwd > 20) return 'triple';
  }
  return 'jump';
}

// moves him along the ground at his speed and facing; off an edge he falls
function move(m, w) {
  setGroundVel(m);
  const r = groundStep(m, w);
  m.peakY = m.pos.y;
  if (r === 'left') {
    toFreefall(m);
    m.vel.x = m.fwd * Math.sin(m.yaw);
    m.vel.z = m.fwd * Math.cos(m.yaw);
  }
  return r;
}

// too steep to stand on, for this floor's kind: slippery floors slide past
// about 11°, ordinary ones past about 45°, rough ones never
export function steep(m) {
  const f = m.floor;
  if (!f || m.airborne) return false;
  const ny = f.n[1];
  if (f.kind === 'slippery') return ny < 0.98;
  if (f.kind === 'rough') return false;
  return ny < 0.7;
}
const slideOf = (m) => (m.floor?.kind === 'slippery' ? 'buttslide' : 'slide');

// what every standing or moving action answers first: a slope too steep, a
// jump, a punch
function common(m, inp) {
  if (steep(m)) return setAction(m, slideOf(m));
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, nextJump(m));
    return true;
  }
  if (inp.bp) {
    inp.bp = false;
    if (m.fwd >= 29 && m.mag > 0.75) {
      m.vel.y = 20;
      takeOff(m, 'dive');
      return true;
    }
    setAction(m, 'punch', 0);
    return true;
  }
  return false;
}

function idle(m, inp, w) {
  if (common(m, inp)) return true;
  if (inp.z) return setAction(m, 'crouch');
  if (m.mag > 0) {
    m.yaw = m.iyaw;
    return setAction(m, 'walk');
  }
  m.fwd = 0;
  move(m, w);
  return false;
}

function walk(m, inp, w) {
  if (common(m, inp)) return true;
  if (inp.zp) {
    inp.zp = false;
    return setAction(m, m.fwd > 10 ? 'crouchslide' : 'crouch');
  }
  if (m.mag === 0) return setAction(m, 'stop');
  if (m.fwd >= 16 && Math.cos(angleDiff(m.iyaw, m.yaw)) < -0.17) return setAction(m, 'skid');
  const target = RUN * m.mag;
  if (m.fwd <= 0) m.fwd += 1.1;
  else if (m.fwd <= target) m.fwd = Math.min(target, m.fwd + 1.1 - m.fwd / 43);
  else m.fwd -= 1;
  m.yaw = turnToward(m.yaw, m.iyaw, TURN);
  const r = move(m, w);
  if (r === 'wall' && m.fwd > 6) m.fwd = 6;
  if (m.action === 'walk' && m.t % 8 === 0) emit(m, 'step');
  return false;
}

function stop(m, inp, w) {
  if (common(m, inp)) return true;
  if (inp.z) return setAction(m, 'crouch');
  if (m.mag > 0) return setAction(m, 'walk');
  m.fwd = approach(m.fwd, 0, 2);
  move(m, w);
  if (m.action === 'stop' && m.fwd === 0) setAction(m, 'idle');
  return false;
}

function skid(m, inp, w) {
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'sideflip');
    return true;
  }
  m.fwd = approach(m.fwd, 0, 2);
  move(m, w);
  if (m.action === 'skid' && m.fwd === 0) {
    if (m.mag > 0) {
      m.yaw = m.iyaw;
      m.fwd = 8;
      setAction(m, 'walk');
    } else setAction(m, 'idle');
  }
  return false;
}

function crouch(m, inp, w) {
  if (steep(m)) return setAction(m, slideOf(m));
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'backflip');
    return true;
  }
  if (!inp.z) return setAction(m, 'idle');
  if (m.mag > 0) return setAction(m, 'crawl');
  m.fwd = approach(m.fwd, 0, 2);
  move(m, w);
  return false;
}

function crawl(m, inp, w) {
  if (steep(m)) return setAction(m, slideOf(m));
  if (!inp.z) return setAction(m, m.mag > 0 ? 'walk' : 'idle');
  if (m.mag === 0) return setAction(m, 'crouch');
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'backflip');
    return true;
  }
  m.fwd = approach(m.fwd, 8 * m.mag, 1);
  m.yaw = turnToward(m.yaw, m.iyaw, 0.12);
  move(m, w);
  return false;
}

// running and crouching: a slide on the seat of the overalls, the long
// jump's run-up
function crouchslide(m, inp, w) {
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, m.fwd > 10 ? 'longjump' : 'jump');
    return true;
  }
  m.fwd = approach(m.fwd, 0, 1);
  m.yaw = turnToward(m.yaw, m.iyaw, 0.05);
  move(m, w);
  if (m.action === 'crouchslide' && (m.fwd === 0 || m.t > 24)) setAction(m, inp.z ? 'crouch' : m.mag > 0 ? 'walk' : 'idle');
  return false;
}

// punch (arg 0), punch (1), kick (2); the hit lands on frames 2 to 6
function punch(m, inp, w) {
  const len = m.arg === 2 ? 14 : 10;
  if (inp.bp && m.t >= 2 && m.arg < 2) {
    inp.bp = false;
    return setAction(m, 'punch', m.arg + 1);
  }
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'jump');
    return true;
  }
  if (m.t >= 2 && m.t <= 6) m.attack = m.arg === 2 ? 'kick' : 'punch';
  if (m.t === 2) emit(m, 'punch', { arg: m.arg });
  m.fwd = approach(m.fwd, 0, 1.5);
  move(m, w);
  if (m.action === 'punch' && m.t >= len) setAction(m, m.mag > 0 ? 'walk' : 'idle');
  return false;
}

// the frames just after a landing, when the chain's next jump can be taken
function land(m, inp, w) {
  if (common(m, inp)) return true;
  m.fwd = approach(m.fwd, m.mag > 0 ? m.fwd : 0, 2);
  m.yaw = turnToward(m.yaw, m.iyaw, m.mag > 0 ? TURN / 2 : 0);
  move(m, w);
  if (m.action === 'land' && m.t >= 3) setAction(m, m.mag > 0 ? 'walk' : m.fwd > 0 ? 'stop' : 'idle');
  return false;
}

// Sliding down a slope (the original's update_sliding): while the floor is
// too steep, pulled downhill by 7 (8 on slippery floors) times the slope,
// losing 2% a frame; on a slide, the stick steers a little. Once the floor
// is gentle he slows quickly and is his own again. A jumps out of it.
function sliding(m, inp, w) {
  if (inp.ap) {
    inp.ap = false;
    takeOff(m, 'jump');
    return true;
  }
  if (m.t === 0) {
    m.slideX = m.fwd * Math.sin(m.yaw);
    m.slideZ = m.fwd * Math.cos(m.yaw);
  }
  const n = m.floor?.n ?? [0, 1, 0];
  const pulled = steep(m);
  if (pulled) {
    const accel = m.floor?.kind === 'slippery' ? 8 : 7;
    m.slideX = (m.slideX + accel * n[0]) * 0.98;
    m.slideZ = (m.slideZ + accel * n[2]) * 0.98;
  } else {
    m.slideX *= 0.8;
    m.slideZ *= 0.8;
  }
  let sp = Math.hypot(m.slideX, m.slideZ);
  if (m.action === 'buttslide' && m.mag > 0 && sp > 1) {
    const dir = turnToward(Math.atan2(m.slideX, m.slideZ), m.iyaw, 0.04 * m.mag);
    m.slideX = sp * Math.sin(dir);
    m.slideZ = sp * Math.cos(dir);
  }
  if (sp > 100) {
    m.slideX *= 100 / sp;
    m.slideZ *= 100 / sp;
    sp = 100;
  }
  if (sp > 1) m.yaw = Math.atan2(m.slideX, m.slideZ);
  m.fwd = sp;
  m.vel.x = m.slideX;
  m.vel.z = m.slideZ;
  m.vel.y = 0;
  const r = groundStep(m, w);
  m.peakY = m.pos.y;
  if (r === 'left') {
    toFreefall(m);
    m.vel.x = m.slideX;
    m.vel.z = m.slideZ;
    return false;
  }
  if (r === 'wall') m.slideX = m.slideZ = m.fwd = 0;
  if (!steep(m) && m.fwd < 6) setAction(m, m.fwd > 1 ? 'stop' : 'idle');
  return false;
}

// holding a star up (the game moves him on)
function dance(m) {
  m.vel.x = m.vel.z = 0;
  m.fwd = 0;
  return false;
}

function dead(m) {
  m.vel.x = m.vel.y = m.vel.z = 0;
  m.fwd = 0;
  return false;
}

export const GROUND = { idle, walk, stop, skid, crouch, crawl, crouchslide, punch, land, slide: sliding, buttslide: sliding, dance, dead };
