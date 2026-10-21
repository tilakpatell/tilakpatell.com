// The hero and his step: on the ground, perched, zipping to a perch, in the
// suit, starting a trick; and where he is (a door, the portal, outside).

import { createPress } from '../../../../lib/press';
import { DOOR_R, HERO_R, PLACES, PORTAL, START } from './plan';
import { collide, collide3, floorAt } from './bump';
import { HERO, SUIT, SWING, TRICK, nearArmour, turnTo } from './tuning';
import { findPerch } from './aim';
import { stepAir, stepWall } from './air';

export const newHero = (at = START) => ({
  x: at.x,
  z: at.z,
  y: at.y ?? 0,
  vy: 0,
  face: at.face ?? 0,
  vx: 0,
  vz: 0,
  speed: 0,
  running: false,
  air: false,
  mode: 'ground', // ground | air | swing | wall | zipto | perch | suit (the armour)
  flown: 0, // metres flown in the armour
  to: null, // a point launch's perch: { x, y, z, roof }
  perchT: 0, // after landing on a perch: a jump now is a point launch
  glide: false, // web wings out
  web: null, // { a: the point he swings about, at: where it sticks, len, target, hand }
  wall: null, // { id, nx, nz }: the solid he's on, and the way out of it
  airT: 0,
  held: false, // the web button, last step
  rearm: 0,
  zips: SWING.zip.charges,
  zipT: 0,
  cornerT: -SWING.corner.cool, // a corner swing's whip, seconds left (then its cool-down, down to -cool)
  stuck: 0,
  lastWall: null,
  runUp: 0, // speed carried up a wall
  fly: false, // off a web or a wall: his own momentum, not a jump's
  flip: 0, // a perfect release's flip, seconds left
  combo: 0,
  trick: null, // an air trick going: { kind: 'flip' | 'back' | 'twist', dir, t: seconds left }
  trickGap: 0,
  style: 0, // style points this flight, banked on landing
  land: 0, // a hard landing's crouch, seconds left
  climb: 0, // metres climbed, for his hands and feet
  ev: [], // what happened this step
});

// One step. `move` is where the visitor wants to go, already turned to the
// world (the camera does that, cameraMove): { x, z } up to length 1, `run`,
// `jump` (a press, not a hold), `web` (the jump button, held), `zip` and
// `perch` (presses), and `assist` (the settings' swing assist, 1 as it comes).
// The jump's press (lib/press.js): the handler keeps one, calls press() on
// the button's edge and hands it to stepHero as `press` (for `jump`).
// Pressed a moment before he lands (on the ground, a wall or a perch) it
// goes as he lands; a moment after he walks off a roof's edge it's still a
// jump. Roll out's numbers, rounded (the game-feel design).
export const JUMP = { buffer: 0.12, coyote: 0.1 };
export const jumpPress = () => createPress(JUMP);
const FOOTED = new Set(['ground', 'wall', 'perch']);

export function stepHero(h0, { x: mx = 0, z: mz = 0, run = false, jump: jumped = false, press = null, web = false, zip = false, perch = false, trick = false, suit = false, assist = 1 } = {}, dt) {
  const h = { ...h0, web: h0.web ? { ...h0.web } : null, ev: [] };
  h.mode ??= h.y > 0 ? 'air' : 'ground';
  h.stuck = Math.max(0, (h.stuck ?? 0) - dt);
  h.flip = Math.max(0, (h.flip ?? 0) - dt);
  h.land = Math.max(0, (h.land ?? 0) - dt);
  h.rearm = Math.max(0, (h.rearm ?? 0) - dt);
  h.zipT = Math.max(0, (h.zipT ?? 0) - dt);
  h.cornerT = Math.max(-SWING.corner.cool, (h.cornerT ?? -SWING.corner.cool) - dt);
  h.zips ??= SWING.zip.charges;
  const len = Math.hypot(mx, mz);
  const k = len > 1 ? 1 / len : 1;
  let jump = jumped;
  // (off an edge on foot: falling, with no web or wall's momentum)
  const walkedOff = h.mode === 'air' && !h.fly && !h.web && !h.glide;
  if (press) {
    press.ground(FOOTED.has(h.mode), dt);
    jump = (FOOTED.has(h.mode) || walkedOff) && press.take();
  }
  if (press && jump && h.mode === 'air') {
    // the coyote jump: as from the ground, a moment late
    h.vy = HERO.jump;
    h.ev.push({ type: 'jump' });
    jump = false;
  }
  const i = { mx: mx * k, mz: mz * k, len: Math.min(1, len), run, jump, web, zip, assist };
  h.perchT = Math.max(0, (h.perchT ?? 0) - dt);
  h.trickGap = Math.max(0, (h.trickGap ?? 0) - dt);
  h.style ??= 0;
  // the armour: into it at the plinth, out of it anywhere
  if (suit) {
    if (h.mode === 'suit') suitOff(h);
    else if (h.mode === 'ground' && nearArmour(h.x, h.z)) suitUp(h);
  }
  // a point launch: to the perch ahead
  if (perch && h.mode !== 'zipto' && h.mode !== 'suit') pointLaunch(h, i);
  // an air trick: in free flight, and only one at a time
  if (trick && h.mode === 'air' && h.fly && !h.web && !h.glide && !h.trick && h.trickGap <= 0 && h.airT >= TRICK.minAir) startTrick(h, i);
  if (h.trick) {
    h.trick = { ...h.trick, t: h.trick.t - dt };
    if (h.trick.t <= 0) {
      h.trick = null;
      h.trickGap = TRICK.gap;
    }
  }
  if (h.mode === 'suit') stepSuit(h, i, dt);
  else if (h.mode === 'zipto') stepZipTo(h, dt);
  else if (h.mode === 'perch') stepPerch(h, i, dt);
  else if (h.mode === 'wall') stepWall(h, i, dt);
  else if (h.mode === 'ground') stepGround(h, i, dt);
  else stepAir(h, i, dt);
  // on something solid again: the zips come back
  if (h.mode === 'ground' || h.mode === 'wall' || h.mode === 'perch') h.zips = SWING.zip.charges;
  if (h.mode !== 'air') h.glide = false;
  h.held = Boolean(web);
  h.air = h.mode !== 'ground';
  return h;
}

function stepGround(h, { mx, mz, len, run, jump }, dt) {
  const top = run ? HERO.run : HERO.walk;
  const grip = Math.min(1, ((HERO.accel * dt) / Math.max(1, top)) * 2.2);
  let vx = h.vx + (mx * top - h.vx) * grip;
  let vz = h.vz + (mz * top - h.vz) * grip;
  if (len < 0.05 && Math.hypot(vx, vz) < 0.05) {
    vx = 0;
    vz = 0;
  }
  const [x, z] = collide(h.x + vx * dt, h.z + vz * dt, HERO_R, h.y);
  const moved = Math.hypot(x - h.x, z - h.z) / Math.max(dt, 1e-6);
  if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  h.vx = (x - h.x) / Math.max(dt, 1e-6);
  h.vz = (z - h.z) / Math.max(dt, 1e-6);
  h.x = x;
  h.z = z;
  h.speed = moved;
  h.running = run && moved > HERO.walk + 0.5;
  h.airT = 0;
  h.fly = false;
  h.web = null;
  h.wall = null;
  h.runUp = 0;
  if (jump && h.perchT > 0) {
    launchOff(h, { mx, mz, len });
    return;
  }
  if (jump) {
    h.mode = 'air';
    h.vy = HERO.jump - HERO.gravity * dt;
    h.y += h.vy * dt;
    h.ev.push({ type: 'jump' });
    return;
  }
  // off the edge of a roof
  const f = floorAt(x, z, h.y);
  h.vy = 0;
  if (f < h.y - 0.05) h.mode = 'air';
  else h.y = f;
}

// A point launch: a web out to the perch, and he's pulled to it.
function pointLaunch(h, i) {
  const p = findPerch(h, i);
  if (!p) return;
  h.to = { ...p };
  h.web = null;
  h.wall = null;
  h.glide = false;
  h.mode = 'zipto';
  h.fly = true;
  h.ev.push({ type: 'point', at: [p.x, p.y + 0.3, p.z] });
}

function stepZipTo(h, dt) {
  const P = SWING.point;
  const t = h.to;
  const dx = t.x - h.x;
  const dy = t.y - h.y;
  const dz = t.z - h.z;
  const d = Math.hypot(dx, dy, dz);
  const sp = Math.min(P.speed, Math.hypot(h.vx, h.vy, h.vz) + P.accel * dt);
  if (d <= sp * dt + 0.3) {
    // there: on top of it
    Object.assign(h, { x: t.x, y: t.y, z: t.z, vx: 0, vy: 0, vz: 0, mode: t.roof ? 'ground' : 'perch', to: null, fly: false, trick: null, perchT: P.window, speed: 0 });
    h.ev.push({ type: 'perched' });
    return;
  }
  h.vx = (dx / d) * sp;
  h.vy = (dy / d) * sp;
  h.vz = (dz / d) * sp;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.z += h.vz * dt;
  turnTo(h, dx, dz, 10, dt);
  h.speed = sp;
}

// On a perch (a mast's or a flagpole's top): crouched there until he jumps
// (a point launch, forward and up), webs off, or steps off.
function stepPerch(h, { mx, mz, len, jump, web }, dt) {
  h.airT = 0;
  h.vx = h.vy = h.vz = 0;
  h.speed = 0;
  if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  if (jump) launchOff(h, { mx, mz, len });
  else if (web && !h.held) {
    h.mode = 'air';
    h.fly = true;
  } else if (len > 0.6 && h.perchT <= 0) {
    // off the edge
    h.mode = 'air';
    h.vx = mx * 3;
    h.vz = mz * 3;
  }
}

// Off a perch with a jump: the point launch, out and up
function launchOff(h, { mx, mz, len }) {
  const L = SWING.point.launch;
  const dx = len > 0.1 ? mx : Math.cos(h.face);
  const dz = len > 0.1 ? mz : -Math.sin(h.face);
  const l = Math.hypot(dx, dz) || 1;
  Object.assign(h, { mode: 'air', fly: true, vx: (dx / l) * L.out, vz: (dz / l) * L.out, vy: L.up, perchT: 0, airT: 0 });
  h.face = Math.atan2(-dz, dx);
  h.ev.push({ type: 'launch' });
}

// Into the armour: it lifts off the ground at once
function suitUp(h) {
  Object.assign(h, { mode: 'suit', fly: true, web: null, wall: null, glide: false, trick: null, to: null, vy: 3, airT: 0, speed: 0, running: false, flown: 0 });
  h.ev.push({ type: 'suitup' });
}
// Out of it: he's Spider-Man again, in the air wherever the armour was
function suitOff(h) {
  Object.assign(h, { mode: 'air', fly: true, airT: 0, held: true, rearm: SWING.rearm, flown: 0 });
  h.ev.push({ type: 'suitoff', x: h.x, y: h.y, z: h.z });
}
// The armour flying: it hovers, Space takes it up and Shift down, the stick
// drives it, and it goes no faster than it goes. Walls stop it, a roof or
// the lawn holds it up, and it keeps to the lawn.
function stepSuit(h, { mx, mz, len, run, web }, dt) {
  h.web = null;
  h.fly = true;
  h.airT += dt;
  let vx = h.vx + mx * SUIT.accel * dt;
  let vz = h.vz + mz * SUIT.accel * dt;
  let vy = h.vy;
  // up on the repulsors, down with Shift; idle, it holds its height
  if (web) vy += SUIT.lift * dt;
  else if (run) vy -= SUIT.lift * dt;
  else vy -= vy * Math.min(1, 4 * dt);
  const k = Math.exp(-SUIT.drag * dt);
  if (len < 0.05) {
    vx *= k;
    vz *= k;
  }
  const hs = Math.hypot(vx, vz);
  if (hs > SUIT.top) {
    vx *= SUIT.top / hs;
    vz *= SUIT.top / hs;
  }
  vy = Math.max(-SUIT.climb, Math.min(SUIT.climb, vy));
  // on its way, in steps short enough not to go through a wall
  const n = Math.max(1, Math.ceil((Math.hypot(vx, vy, vz) * dt) / 0.45));
  const sdt = dt / n;
  let { x, y, z } = h;
  for (let s = 0; s < n; s++) {
    const py = y;
    x += vx * sdt;
    y += vy * sdt;
    z += vz * sdt;
    if (y > SUIT.ceiling) {
      y = SUIT.ceiling;
      vy = Math.min(0, vy);
    }
    const c = collide3(py, x, y, z);
    x = c.x;
    y = c.y;
    z = c.z;
    if (c.head) vy = Math.min(0, vy);
    if (c.lawn) {
      const into = vx * c.lawn.nx + vz * c.lawn.nz;
      if (into < 0) {
        vx -= c.lawn.nx * into;
        vz -= c.lawn.nz * into;
      }
    }
    if (c.wall) {
      const into = -(vx * c.wall.nx + vz * c.wall.nz);
      if (into > 0) {
        vx += c.wall.nx * into;
        vz += c.wall.nz * into;
      }
    }
    // the ground (or a roof) holds it up: it hovers a little over it, never below
    const floor = floorAt(x, z, Math.max(py, y));
    if (y < floor + SUIT.hover && vy <= 0 && !run) {
      y = Math.min(floor + SUIT.hover, y + SUIT.hover * sdt * 2);
      vy = 0;
    } else if (c.landed != null && vy <= 0) {
      y = c.landed;
      vy = 0;
    }
  }
  h.flown = (h.flown ?? 0) + Math.hypot(x - h.x, y - h.y, z - h.z);
  Object.assign(h, { x, y, z, vx, vy, vz });
  const hs2 = Math.hypot(vx, vz);
  if (hs2 > 1.5) turnTo(h, vx, vz, SUIT.turn, dt);
  else if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  h.speed = hs2;
  h.running = false;
}

// A trick: a flip forward, a backflip with the stick pulled back, a twist
// with it to a side (against the way he's going), worth more for each in a row
function startTrick(h, { mx, mz, len }) {
  let kind = 'flip';
  let dir = 1;
  if (len > 0.3) {
    const hs = Math.hypot(h.vx, h.vz);
    const fx = hs > 1 ? h.vx / hs : Math.cos(h.face);
    const fz = hs > 1 ? h.vz / hs : -Math.sin(h.face);
    const along = mx * fx + mz * fz;
    const side = fx * mz - fz * mx;
    if (along < -0.5) kind = 'back';
    else if (Math.abs(side) > 0.5) {
      kind = 'twist';
      dir = side > 0 ? 1 : -1;
    }
  }
  h.trick = { kind, dir, t: TRICK.time };
  h.combo = (h.combo ?? 0) + 1;
  h.style = (h.style ?? 0) + TRICK.points[kind] * h.combo;
  h.ev.push({ type: 'trick', kind, dir, combo: h.combo, style: h.style });
}

// ── where you are ──

export function nearPlace(x, z, r = DOOR_R) {
  let best = null;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < r && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}
export const underPortal = (x, z) => Math.hypot(x - PORTAL.x, z - PORTAL.z) < PORTAL.r;

// Where the hero stands coming out of a place: a step outside its door,
// facing out.
export function outside(p) {
  return newHero({ x: p.x + Math.cos(p.face) * 1.6, z: p.z - Math.sin(p.face) * 1.6, face: p.face });
}
