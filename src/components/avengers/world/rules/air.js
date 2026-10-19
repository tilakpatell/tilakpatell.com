// Off the ground: the swing, letting go, corner whips, the web zip, flight
// in the suit, running up walls, and how he holds himself on a swing.

import { inPoly } from '../../compound/plan';
import { EDGE, HERO_R, SOLIDS, nearestEdge, solidById } from './plan';
import { atHeight, collide3, floorAt, onLawn, wallNormal } from './bump';
import { HERO, SWING, TRICK, turnTo } from './tuning';
import { CORNERS, aimWeb, clearLine, ropeFor } from './aim';

// his horizontal velocity turned toward (dx, dz), by at most `max` radians,
// keeping its speed (the swing-where-you-steer assist)
function steerToward(h, dx, dz, max) {
  const hs = Math.hypot(h.vx, h.vz);
  if (hs < 4 || max <= 0) return;
  let d = Math.atan2(dz, dx) - Math.atan2(h.vz, h.vx);
  d = Math.atan2(Math.sin(d), Math.cos(d));
  // (not round to go back the way he came: a hard turn is a corner, a little at a time)
  const t = Math.max(-max, Math.min(max, d));
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const vx = h.vx * c - h.vz * sn;
  h.vz = h.vx * sn + h.vz * c;
  h.vx = vx;
}

// How far past straight down from the anchor he's swung, the way he's
// going: 0 under it, more once he's past it (radians).
export function pastAnchor(h, w = h.web) {
  if (!w) return 0;
  const hs = Math.hypot(h.vx, h.vz);
  if (hs < 0.5) return 0;
  const along = ((h.x - w.a[0]) * h.vx + (h.z - w.a[2]) * h.vz) / hs;
  return Math.atan2(along, w.a[1] - h.y);
}

// A web out to the best anchor; false if there's nothing to catch.
function attach(h, turn) {
  const w = aimWeb(h, turn);
  if (!w) return false;
  // a dive into a web: the fall turned into speed along the way he's going
  if (h.vy < -8) {
    const hs = Math.hypot(h.vx, h.vz);
    const dx = hs > 1 ? h.vx / hs : Math.cos(h.face);
    const dz = hs > 1 ? h.vz / hs : -Math.sin(h.face);
    const more = (-h.vy - 8) * SWING.dive;
    h.vx += dx * more;
    h.vz += dz * more;
    h.vy *= 0.55;
    h.ev.push({ type: 'dive', more });
  }
  h.web = { a: w.a, at: w.at, len: w.len, target: ropeFor(w.a, w.len, h.y, floorAt(h.x, h.z, h.y)), hand: w.hand, entry: h.y };
  h.mode = 'swing';
  h.fly = true;
  h.trick = null;
  h.zips = SWING.zip.charges;
  h.ev.push({ type: 'web', at: w.at, hand: w.hand, kind: w.kind });
  return true;
}

function letGo(h) {
  const w = h.web;
  h.web = null;
  h.mode = 'air';
  h.rearm = SWING.rearm;
  const past = pastAnchor(h, w);
  const sp = Math.hypot(h.vx, h.vy, h.vz);
  const P = SWING.perfect;
  const R = SWING.release;
  // let go on the way up and he's flung on and up; on the way down, he drops
  if (h.vy > 0) {
    h.vx *= R.boost;
    h.vz *= R.boost;
    h.vy = Math.min(Math.max(h.vy, R.popMax), h.vy + R.pop);
  }
  if (past > P.from && past < P.to && h.vy > 0 && sp > 11) {
    h.vx *= P.boost;
    h.vy = h.vy * P.boost + P.lift;
    h.vz *= P.boost;
    h.combo = (h.combo ?? 0) + 1;
    h.flip = 0.7;
    h.style = (h.style ?? 0) + TRICK.points.perfect * h.combo;
    h.ev.push({ type: 'perfect', combo: h.combo, style: h.style });
  } else h.ev.push({ type: 'release' });
}

// A corner swing: steering hard (the stick well off the way he's going) with
// a building's corner ahead on that side, the web goes to the top of the
// corner and he whips round it, as Insomniac's corner swings do.
function cornerSwing(h, turn) {
  const C = SWING.corner;
  const hs = Math.hypot(h.vx, h.vz);
  if (hs < 8) return;
  const fx = h.vx / hs;
  const fz = h.vz / hs;
  const off = Math.atan2(fx * turn.z - fz * turn.x, fx * turn.x + fz * turn.z);
  if (Math.abs(off) < C.turn) return;
  let best = null;
  for (const c of CORNERS) {
    if (c.h < h.y + 3) continue;
    const rx = c.x - h.x;
    const rz = c.z - h.z;
    const d = Math.hypot(rx, rz);
    if (d > C.reach || d < 4) continue;
    // ahead of him, and on the side he's turning to
    const ahead = rx * fx + rz * fz;
    const side = fx * rz - fz * rx;
    if (ahead < 0 || Math.sign(side) !== Math.sign(off)) continue;
    if (!best || d < best.d) best = { c, d };
  }
  if (!best) return;
  const { c } = best;
  const a = [c.x + c.nx * C.out, c.h - 0.5, c.z + c.nz * C.out];
  const at = [c.x + c.nx * 0.05, c.h - 0.1, c.z + c.nz * 0.05];
  if (!clearLine(h.x, h.y + 1.5, h.z, at[0], at[1], at[2])) return;
  const len = Math.hypot(a[0] - h.x, a[1] - h.y, a[2] - h.z);
  if (len > SWING.reach) return;
  const left = (a[0] - h.x) * fz - (a[2] - h.z) * fx;
  h.web = { a, at, len, target: ropeFor(a, len, h.web.entry ?? h.y, floorAt(h.x, h.z, h.y)), hand: left > 0 ? 'L' : 'R', entry: h.web.entry ?? h.y };
  h.cornerT = C.time;
  h.ev.push({ type: 'corner', at, hand: h.web.hand });
}

// A web zip: a quick web out ahead and a burst along it.
function webZip(h, { mx, mz, len }) {
  const hs = Math.hypot(h.vx, h.vz);
  let dx;
  let dz;
  if (len > 0.1) {
    dx = mx;
    dz = mz;
  } else if (hs > 1) {
    dx = h.vx / hs;
    dz = h.vz / hs;
  } else {
    dx = Math.cos(h.face);
    dz = -Math.sin(h.face);
  }
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  const Z = SWING.zip;
  const along = Math.max(0, h.vx * dx + h.vz * dz);
  const want = Math.min(Z.max, along + Z.speed);
  // what's left of his speed off to the side mostly goes
  const sx = h.vx - dx * along;
  const sz = h.vz - dz * along;
  h.vx = dx * want + sx * 0.3;
  h.vz = dz * want + sz * 0.3;
  h.vy = Math.max(h.vy, Z.up);
  h.zips -= 1;
  h.zipT = Z.cool;
  h.fly = true;
  h.ev.push({ type: 'zip', at: [h.x + dx * Z.reach, h.y + 1.6 + Math.min(4, Z.reach * 0.12), h.z + dz * Z.reach] });
}

// The wall he's swinging alongside, if any: { nx, nz, d } (the way out of
// it and how far it is), and only one he's going along rather than into.
function alongside(h) {
  let best = null;
  for (const s of SOLIDS) {
    if (!atHeight(s, h.y)) continue;
    const [x0, z0, x1, z1] = s.box;
    const r = SWING.pushAt;
    if (h.x < x0 - r || h.x > x1 + r || h.z < z0 - r || h.z > z1 + r) continue;
    if (inPoly(h.x, h.z, s.foot)) continue;
    const e = nearestEdge(h.x, h.z, s.foot);
    if (e.d >= r || (best && e.d >= best.d)) continue;
    best = { nx: (h.x - e.x) / (e.d || 1), nz: (h.z - e.z) / (e.d || 1), d: e.d };
  }
  if (!best) return null;
  const hs = Math.hypot(h.vx, h.vz);
  if (hs > 1 && (h.vx * best.nx + h.vz * best.nz) / hs < -0.55) return null; // heading into it: let him hit it
  return best;
}

export function stepAir(h, { mx, mz, len, run, web, zip, assist = 1 }, dt) {
  h.airT = (h.airT ?? 0) + dt;
  const turn = len > 0.1 ? { x: mx, z: mz } : null;
  // the web: shot as the button goes down in the air (or after a moment, held
  // from a jump), let go as it comes up
  if (h.web && !web) letGo(h);
  else if (!h.web && web && h.rearm <= 0 && (!h.held || h.airT >= SWING.arm)) attach(h, turn);
  if (zip && !h.web && h.zips > 0 && h.zipT <= 0) webZip(h, { mx, mz, len });
  // web wings: the web held, nothing in reach to catch, and a way down to fall
  const wasGliding = h.glide;
  h.glide = !h.web && web && (h.vy < -2.5 || h.glide) && h.y - floorAt(h.x, h.z, h.y) > SWING.glide.above;
  if (h.glide) {
    h.fly = true;
    if (!wasGliding) h.ev.push({ type: 'glide' });
  }
  // steering hard round a building's corner: the web goes to the corner, and he whips round it
  if (h.web && turn && h.cornerT <= -SWING.corner.cool) cornerSwing(h, turn);
  const w = h.web;
  if (h.fly && turn) {
    // he goes where you steer: the swing (or the flight) comes round toward it (fast, whipping round a corner)
    // (the assist is the settings', down to none: then it's a rope and nothing else)
    steerToward(h, mx, mz, SWING.assist * assist * (w ? 1 : 0.5) * (h.cornerT > 0 ? SWING.corner.whip : 1) * len * dt);
    h.vx += mx * SWING.steer * assist * dt;
    h.vz += mz * SWING.steer * assist * dt;
  }
  let vx = h.vx;
  let vy = h.vy;
  let vz = h.vz;
  if (!h.fly) {
    // a jump: a little say in where it goes, as on foot
    const top = run ? HERO.run : HERO.walk;
    const grip = HERO.air * Math.min(1, ((HERO.accel * dt) / Math.max(1, top)) * 2.2);
    vx += (mx * top - vx) * grip;
    vz += (mz * top - vz) * grip;
  }
  if (h.glide) {
    // web wings: the fall slowed to a glide, and on along the way he's going
    const G = SWING.glide;
    vy += (-G.sink - vy) * Math.min(1, 3 * dt);
    const hs = Math.hypot(vx, vz) || 1;
    const dx = hs > 1 ? vx / hs : Math.cos(h.face);
    const dz = hs > 1 ? vz / hs : -Math.sin(h.face);
    if (hs < G.speed) {
      vx += dx * G.push * dt;
      vz += dz * G.push * dt;
    }
  } else {
    // gravity, and a beat of hang time at the top of a flight
    vy -= HERO.gravity * (h.fly && !w && Math.abs(vy) < 3 ? SWING.hang : 1) * dt;
  }
  let sp = Math.hypot(vx, vy, vz);
  // air resistance, more the faster he goes
  const drag = Math.exp(-SWING.drag * sp * dt);
  vx *= drag;
  vy *= drag;
  vz *= drag;
  if (w) {
    // the swing's own push, along the way he's going, under the anchor, so
    // long as the arc wouldn't go past pumpMax for it
    const energy = 0.5 * sp * sp + HERO.gravity * (h.y - w.a[1]);
    const reach = -energy / (HERO.gravity * Math.max(1, w.len)); // cos of the furthest the arc goes
    if (sp > 1 && h.y < w.a[1] && reach > Math.cos(SWING.pumpMax)) {
      vx += (vx / sp) * SWING.pump * dt;
      vy += (vy / sp) * SWING.pump * dt;
      vz += (vz / sp) * SWING.pump * dt;
    }
    // pushed off a wall he's swinging alongside, and his swing with him (so
    // he swings down the middle, not along the wall), as Insomniac do
    const side = alongside({ ...h, vx, vz });
    if (side) {
      const k = 1 - side.d / SWING.pushAt;
      vx += side.nx * SWING.push * k * dt;
      vz += side.nz * SWING.push * k * dt;
      w.a = [w.a[0] + side.nx * 3 * k * dt, w.a[1], w.a[2] + side.nz * 3 * k * dt];
    }
    // the web takes up its slack, down to what it wants
    w.target = Math.min(w.target, ropeFor(w.a, w.len, w.entry, floorAt(h.x, h.z, h.y)));
    if (w.len > w.target) w.len = Math.max(w.target, w.len - SWING.takeUp * dt);
  }
  sp = Math.hypot(vx, vy, vz);
  if (sp > SWING.maxSpeed) {
    vx *= SWING.maxSpeed / sp;
    vy *= SWING.maxSpeed / sp;
    vz *= SWING.maxSpeed / sp;
  }

  // on its way, in steps short enough not to go through a wall
  const n = Math.max(1, Math.ceil((Math.hypot(vx, vy, vz) * dt) / 0.45));
  const sdt = dt / n;
  let { x, y, z } = h;
  const before = -vy;
  for (let s = 0; s < n; s++) {
    const py = y;
    x += vx * sdt;
    y += vy * sdt;
    z += vz * sdt;
    // the web is a rope: past its length it pulls him back onto the circle
    if (h.web) {
      const a = h.web.a;
      const dx = x - a[0];
      const dy = y - a[1];
      const dz = z - a[2];
      const l = Math.hypot(dx, dy, dz);
      if (l > h.web.len) {
        const ux = dx / l;
        const uy = dy / l;
        const uz = dz / l;
        x = a[0] + ux * h.web.len;
        y = a[1] + uy * h.web.len;
        z = a[2] + uz * h.web.len;
        const out = vx * ux + vy * uy + vz * uz;
        if (out > 0) {
          vx -= ux * out;
          vy -= uy * out;
          vz -= uz * out;
        }
      }
    }
    if (y > SWING.ceiling) {
      y = SWING.ceiling;
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
    if (c.landed != null && vy <= 0) {
      Object.assign(h, { x, y, z, vx, vz });
      land(h, before);
      return;
    }
    if (c.wall) {
      const into = -(vx * c.wall.nx + vz * c.wall.nz);
      const pushing = -(mx * c.wall.nx + mz * c.wall.nz) > 0.3;
      const fresh = h.stuck <= 0 || c.wall.s.id !== h.lastWall;
      if (fresh && c.wall.s.h - y > 0.25 && (into > SWING.stick || pushing)) {
        // a spider: he sticks to it, and the speed he hit it with carries him up it
        const hit = Math.hypot(vx, vy, vz);
        const R = SWING.wallRun;
        Object.assign(h, { x, y, z, vx: 0, vy: 0, vz: 0, mode: 'wall', web: null, fly: false, trick: null, wall: { id: c.wall.s.id, nx: c.wall.nx, nz: c.wall.nz } });
        h.runUp = hit > R.min ? Math.min(R.max, hit * R.carry) : 0;
        h.face = Math.atan2(c.wall.nz, -c.wall.nx);
        h.speed = 0;
        h.ev.push({ type: 'stick', id: c.wall.s.id, run: h.runUp });
        return;
      }
      // or slides along it
      if (into > 0) {
        vx += c.wall.nx * into;
        vz += c.wall.nz * into;
      }
    }
  }
  Object.assign(h, { x, y, z, vx, vy, vz });
  // well past the anchor, the web would only pull him back: he lets it go
  if (h.web && pastAnchor(h) > SWING.letGo) letGo(h);
  const hs = Math.hypot(vx, vz);
  if (h.fly) {
    if (hs > 1) turnTo(h, vx, vz, 8, dt);
  } else if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  h.speed = hs;
  h.running = false;
}

function land(h, impact) {
  h.ev.push({ type: 'land', impact, x: h.x, y: h.y, z: h.z });
  h.mode = 'ground';
  h.vy = 0;
  h.web = null;
  h.fly = false;
  h.airT = 0;
  h.speed = Math.hypot(h.vx, h.vz);
  h.running = false;
  // the flight's style: banked, unless he's still mid-trick, which is a bail
  if (h.trick) {
    h.ev.push({ type: 'bail', style: h.style, combo: h.combo });
    h.trick = null;
    h.land = Math.max(h.land, TRICK.bail);
    h.vx *= 0.3;
    h.vz *= 0.3;
  } else if (h.style > 0) h.ev.push({ type: 'bank', style: h.style, combo: h.combo });
  h.style = 0;
  h.combo = 0;
  // a long way down: down on one knee, the way he does, and the run taken out of him
  if (impact > 14) {
    h.land = 0.45;
    h.vx *= 0.3;
    h.vz *= 0.3;
  }
}

export function stepWall(h, { mx, mz, run, jump }, dt) {
  const s = solidById(h.wall?.id);
  if (!s) {
    h.mode = 'air';
    h.wall = null;
    return;
  }
  h.airT = 0;
  h.web = null;
  h.fly = false;
  const { nx, nz } = h.wall;
  const tx = -nz;
  const tz = nx;
  const c = run ? SWING.climbRun : SWING.climb;
  // into the wall climbs, away from it climbs down, and along it goes along
  const into = Math.max(-1, Math.min(1, -(mx * nx + mz * nz)));
  let up = into * c;
  const side = Math.max(-1, Math.min(1, mx * tx + mz * tz)) * c * 0.75;
  // the speed he hit it with, carried on up it (unless he's pulling away)
  if (h.runUp > 0) {
    if (into > -0.2) up = Math.max(up, h.runUp);
    h.runUp = Math.max(0, h.runUp - SWING.wallRun.fade * dt);
  }
  if (jump) {
    // off the wall: out, up, and on along it the way he was going
    h.mode = 'air';
    h.fly = true;
    h.vx = nx * SWING.kick.out + tx * side * 0.8;
    h.vz = nz * SWING.kick.out + tz * side * 0.8;
    h.vy = SWING.kick.up + Math.max(0, up) * 0.4;
    h.x += nx * 0.05;
    h.z += nz * 0.05;
    h.stuck = SWING.restick;
    h.lastWall = s.id;
    h.wall = null;
    h.runUp = 0;
    h.face = Math.atan2(-h.vz, h.vx);
    h.ev.push({ type: 'kick' });
    return;
  }
  const y = h.y + up * dt;
  // along it, and back onto it wherever that is (round a corner, round the curve)
  const e = wallNormal(h.x + tx * side * dt, h.z + tz * side * dt, s.foot);
  let x = e.x + e.nx * (HERO_R + 0.02);
  let z = e.z + e.nz * (HERO_R + 0.02);
  if (y >= s.h - 0.15) {
    // over the top, onto the roof (running, if he came up it at a run)
    let rx = e.x - e.nx * 0.9;
    let rz = e.z - e.nz * 0.9;
    if (!inPoly(rx, rz, s.foot)) {
      rx = e.x - e.nx * 0.3;
      rz = e.z - e.nz * 0.3;
    }
    const on = Math.max(2, Math.min(HERO.run, up * 0.6));
    Object.assign(h, { x: rx, z: rz, y: s.h, vx: -e.nx * on, vz: -e.nz * on, vy: 0, mode: 'ground', wall: null, speed: on, runUp: 0 });
    h.face = Math.atan2(e.nz, -e.nx);
    h.ev.push({ type: 'mantle', id: s.id });
    return;
  }
  [x, z] = onLawn(x, z, Math.max(HERO_R, EDGE));
  const f = floorAt(x, z, y);
  if (y <= f) {
    // climbed down to the ground (or a roof below)
    Object.assign(h, { x, z, y: f, vx: 0, vz: 0, vy: 0, mode: 'ground', wall: null, speed: 0, runUp: 0 });
    return;
  }
  if (y < s.y0 - 0.5) {
    // off the bottom of something overhead
    Object.assign(h, { x, z, y, vx: 0, vz: 0, vy: 0, mode: 'air', wall: null, speed: 0, runUp: 0 });
    return;
  }
  Object.assign(h, { x, z, y, vx: tx * side, vz: tz * side, vy: up, wall: { id: s.id, nx: e.nx, nz: e.nz } });
  h.face = Math.atan2(e.nz, -e.nx); // facing the wall
  h.speed = Math.hypot(up, side);
  h.climb = (h.climb ?? 0) + h.speed * dt;
  h.running = false;
}

// ── how he holds himself on a swing ──
// Where he is on his arc, from the way he's going: -1 dropping into it behind
// the anchor, 0 at the bottom, 1 up past it (the angle off straight down,
// over 0.9 rad, kept to -1..1); 0 off a web or with no way to be going.
export function swingArc(h) {
  const w = h.web;
  const hs = Math.hypot(h.vx, h.vz);
  if (!w?.a || hs < 0.5) return 0;
  const along = ((h.x - w.a[0]) * h.vx + (h.z - w.a[2]) * h.vz) / hs;
  const s = Math.atan2(along, w.a[1] - h.y) / 0.9;
  return Math.max(-1, Math.min(1, s));
}

// His pose through the arc (the figure's frame: +z ahead, +y up his web, +x
// his left; `free` and `freeFore` are the free arm's, its x away from his
// side): legs trailing as he drops in, knees tucked through the bottom,
// legs thrown out ahead on the way up, leaning back, the free hand reaching
// up for the next web.
const SWING_KEYS = {
  in: { free: [0.85, -0.05, -0.45], freeFore: [0.55, 0.1, -0.6], thighL: [0.06, -1, -0.32], calfL: [0.04, -1, -0.5], thighR: [-0.06, -1, -0.22], calfR: [-0.04, -1, -0.6], foot: [0, -0.5, -0.9], pitch: -0.15 },
  low: { free: [0.95, -0.15, 0.3], freeFore: [0.7, 0.25, 0.55], thighL: [0.1, -0.35, 0.95], calfL: [0.05, -1, -0.1], thighR: [-0.1, -0.55, 0.85], calfR: [-0.05, -1, 0.05], foot: [0, -0.4, 0.9], pitch: 0.22 },
  out: { free: [0.35, 0.55, 0.8], freeFore: [0.2, 0.6, 0.85], thighL: [0.08, -0.4, 0.92], calfL: [0.05, -0.25, 1], thighR: [-0.08, -0.6, 0.8], calfR: [-0.05, -0.5, 0.9], foot: [0, 0.25, 1], pitch: -0.18 },
};
export function swingPose(s) {
  const k = Math.min(1, Math.abs(s));
  const a = SWING_KEYS.low;
  const b = s < 0 ? SWING_KEYS.in : SWING_KEYS.out;
  const out = { pitch: a.pitch + (b.pitch - a.pitch) * k };
  for (const key of Object.keys(a)) if (key !== 'pitch') out[key] = a[key].map((v, i) => v + (b[key][i] - v) * k);
  return out;
}
