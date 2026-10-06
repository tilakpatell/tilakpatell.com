// Cybertron, the world: what happens, as plain numbers, with nothing drawn.
// Optimus walks, runs and jumps as a robot, drives as a truck and changes
// from one to the other; shots fly and hit or stop at walls; Decepticons
// close in, strafe and fire; energon is picked up; people are talked to and
// bridges stepped through; missions go step by step. scene.js draws it and
// GameWorld.jsx drives it; areas/*.js lay out each place as data this reads.
//
// Metres and seconds; y is up. A yaw of 0 faces +z and a positive one turns
// toward +x, so forward is (sin yaw, cos yaw). A solid is a box (centre,
// half sizes, a turn) or a circle, standing from `base` to `top`: what's
// higher than a step blocks, what's lower is floor to walk onto.

const TAU = Math.PI * 2;
const SUB = 1 / 120; // the slice everything is worked out in, whatever the frame rate
const MAX_DT = 0.05; // a frame longer than this (a tab come back) counts as this

export const ROBOT = { radius: 1.2, height: 9.5, walk: 7, run: 15, accel: 40, jump: 13, gravity: 32, step: 1.4, turn: 10, air: 0.35 };
export const VEHICLE = { radius: 2.6, height: 4, length: 9, top: 40, boost: 62, accel: 16, brake: 34, reverse: 12, drag: 6, grip: 9, turn: 1.7, steerRate: 3.2, boostDrain: 0.35, boostFill: 0.12, step: 1.0 };
export const TRANSFORM = { time: 0.9 };
// Getting his strength back: so many seconds out of the fight, then so much
// a second; and a little with every cube of energon he picks up
export const MEND = { after: 4, rate: 12, energon: 15 };
export const SHOT = { speed: 140, ttl: 1.2, robotDamage: 12, vehicleDamage: 7, cooldownRobot: 0.18, cooldownVehicle: 0.09, aim: (12 * Math.PI) / 180, aimVehicle: (8 * Math.PI) / 180, reach: 120 };
export const ENEMY_KINDS = {
  trooper: { hp: 40, speed: 6, range: 55, cooldown: 1.3, damage: 5, r: 1.2, h: 7 },
  vehicon: { hp: 40, speed: 6, range: 55, cooldown: 1.2, damage: 5, r: 1.2, h: 7 },
  megatron: { hp: 700, speed: 5, range: 70, cooldown: 0.5, damage: 9, r: 1.8, h: 10.5, boss: true, name: 'Megatron' },
  barricade: { hp: 150, speed: 7, range: 55, cooldown: 0.9, damage: 6, r: 1.3, h: 7.2 },
  // (his cannon: slow, and it hurts)
  shockwave: { hp: 420, speed: 3.5, range: 85, cooldown: 1.7, damage: 15, r: 1.6, h: 11, boss: true, name: 'Shockwave' },
  // (Megatron's side: the Autobots' raiders, and Zeta Prime at the last)
  autobot: { hp: 50, speed: 7.5, range: 60, cooldown: 1.1, damage: 6, r: 1.2, h: 7 },
  zeta: { hp: 650, speed: 4.5, range: 75, cooldown: 0.55, damage: 10, r: 1.8, h: 11, boss: true, name: 'Zeta Prime' },
};

// The Decepticons who change: so long on their feet, then into their
// other form (the change as long as their own model's takes), driving at
// Optimus, then back; still, and holding fire, while they change. Megatron,
// as Fall of Cybertron has him, turns into his tank and shells; Barricade,
// as War for Cybertron has him, into his car and rams. `alt` is the other
// form's name; `tank` (or `car`) how long it lasts; `r` and `h` its size.
export const MEGATRON = { alt: 'tank', robot: 12, shift: 2.1, tank: 6.5, back: 1.6, speed: 17, turn: 1.5, range: 95, cooldown: 1.5, damage: 16, shell: 0.5, r: 3, h: 5.5 };
export const BARRICADE = { alt: 'car', robot: 9, shift: 1.65, car: 5.5, back: 1.8, speed: 26, turn: 2.4, ram: 14, r: 2.3, h: 3.6 };
export const FORMS = { megatron: MEGATRON, barricade: BARRICADE };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);
const toward = (from, to, step) => from + clamp(wrap(to - from), -step, step);

// ── The world ──

const CELL = 32;

function solidOf(s) {
  const yaw = s.yaw ?? 0;
  return { ...s, base: s.base ?? 0, top: s.top ?? 1e4, yaw, c: Math.cos(yaw), s: Math.sin(yaw), reach: s.kind === 'circle' ? s.r : Math.hypot(s.hw, s.hd) };
}

// A point in a solid's own frame (box: x across it, z along it)
function local(s, x, z) {
  const dx = x - s.x;
  const dz = z - s.z;
  return [dx * s.c - dz * s.s, dx * s.s + dz * s.c];
}

function contains(s, x, z) {
  if (s.kind === 'circle') return (x - s.x) ** 2 + (z - s.z) ** 2 <= s.r * s.r;
  const [lx, lz] = local(s, x, z);
  return Math.abs(lx) <= s.hw && Math.abs(lz) <= s.hd;
}

// How far a circle at (x, z) of radius r must move to be clear of a solid,
// and which way (null if it's clear already)
export function overlap(s, x, z, r) {
  if (s.kind === 'circle') {
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.hypot(dx, dz);
    const need = s.r + r;
    if (d >= need) return null;
    if (d < 1e-6) return { nx: 1, nz: 0, depth: need };
    return { nx: dx / d, nz: dz / d, depth: need - d };
  }
  const [lx, lz] = local(s, x, z);
  const cx = clamp(lx, -s.hw, s.hw);
  const cz = clamp(lz, -s.hd, s.hd);
  let ox = lx - cx;
  let oz = lz - cz;
  let d = Math.hypot(ox, oz);
  let depth;
  if (d > 1e-6) {
    if (d >= r) return null;
    ox /= d;
    oz /= d;
    depth = r - d;
  } else {
    // the centre is inside: out the nearest side
    const px = s.hw - Math.abs(lx);
    const pz = s.hd - Math.abs(lz);
    if (px < pz) {
      ox = Math.sign(lx) || 1;
      oz = 0;
      depth = px + r;
    } else {
      ox = 0;
      oz = Math.sign(lz) || 1;
      depth = pz + r;
    }
    d = 0;
  }
  // back to the world's frame
  return { nx: ox * s.c + oz * s.s, nz: -ox * s.s + oz * s.c, depth };
}

export function buildWorld(area) {
  const solids = (area.solids ?? []).map(solidOf);
  const cells = new Map();
  const key = (i, j) => `${i},${j}`;
  for (const s of solids) {
    const i0 = Math.floor((s.x - s.reach) / CELL);
    const i1 = Math.floor((s.x + s.reach) / CELL);
    const j0 = Math.floor((s.z - s.reach) / CELL);
    const j1 = Math.floor((s.z + s.reach) / CELL);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(s);
      }
  }
  const heightAt = area.heightAt ?? (() => 0);
  const near = (x, z, r = 0) => {
    const i0 = Math.floor((x - r) / CELL);
    const i1 = Math.floor((x + r) / CELL);
    const j0 = Math.floor((z - r) / CELL);
    const j1 = Math.floor((z + r) / CELL);
    if (i0 === i1 && j0 === j1) return cells.get(key(i0, j0)) ?? [];
    const out = new Set();
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const s of cells.get(key(i, j)) ?? []) out.add(s);
    return [...out];
  };
  // the highest thing to stand on under (x, z) no higher than a step up from y
  const floorAt = (x, z, y, step = ROBOT.step) => {
    let best = heightAt(x, z);
    for (const s of near(x, z)) if (s.top <= y + step && s.top > best && contains(s, x, z)) best = s.top;
    return best;
  };
  const b = area.bounds ?? { minX: -1e4, maxX: 1e4, minZ: -1e4, maxZ: 1e4 };
  return { id: area.id, bounds: b, heightAt, solids, near, floorAt, ceiling: area.ceiling ?? Infinity };
}

// Push a body (circle of radius r, standing from y to y + h) out of whatever
// it has walked into, and out of the area's bounds. Returns the push's
// direction if there was one.
function resolve(world, body, r, h, step) {
  let hit = null;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const s of world.near(body.x, body.z, r)) {
      if (s.base >= body.y + h || s.top <= body.y + step) continue;
      const o = overlap(s, body.x, body.z, r);
      if (!o) continue;
      body.x += o.nx * o.depth;
      body.z += o.nz * o.depth;
      hit = o;
      moved = true;
    }
    if (!moved) break;
  }
  const B = world.bounds;
  if (body.x < B.minX + r) [body.x, hit] = [B.minX + r, { nx: 1, nz: 0 }];
  if (body.x > B.maxX - r) [body.x, hit] = [B.maxX - r, { nx: -1, nz: 0 }];
  if (body.z < B.minZ + r) [body.z, hit] = [B.minZ + r, { nx: 0, nz: 1 }];
  if (body.z > B.maxZ - r) [body.z, hit] = [B.maxZ - r, { nx: 0, nz: -1 }];
  return hit;
}

// ── Optimus ──

export function newPlayer(area, at = area.spawn) {
  return {
    mode: 'robot',
    shifting: 0,
    shiftTo: null,
    x: at.x,
    y: at.y ?? 0,
    z: at.z,
    yaw: at.yaw ?? 0,
    vx: 0,
    vz: 0,
    vy: 0,
    grounded: false,
    speed: 0,
    slide: 0,
    steer: 0,
    hp: 100,
    maxHp: 100,
    energon: 0,
    boost: 1,
    cooldown: 0,
    dead: false,
    hurt: 0,
    fell: 0,
  };
}

export const canTransform = (p) => p.grounded && !p.shifting && !p.dead;
const radiusOf = (p) => (p.mode === 'vehicle' ? VEHICLE.radius : ROBOT.radius);
const heightOf = (p) => (p.mode === 'vehicle' ? VEHICLE.height : ROBOT.height);

export function damage(p, amount) {
  if (p.dead || amount <= 0) return [];
  p.hp = Math.max(0, p.hp - amount);
  p.hurt = 0.4;
  p.calm = 0;
  if (p.hp > 0) return [{ type: 'hurt', amount }];
  p.dead = true;
  return [{ type: 'hurt', amount }, { type: 'dead' }];
}

function robotSlice(p, input, h) {
  const control = !p.shifting && !p.dead;
  const len = Math.hypot(input.moveX, input.moveZ);
  const k = control && len > 0.02 ? Math.min(1, len) / len : 0;
  const top = input.run ? ROBOT.run : ROBOT.walk;
  const wantX = input.moveX * k * top;
  const wantZ = input.moveZ * k * top;
  const a = ROBOT.accel * h * (p.grounded ? 1 : ROBOT.air);
  const dx = wantX - p.vx;
  const dz = wantZ - p.vz;
  const d = Math.hypot(dx, dz);
  if (d > a) {
    p.vx += (dx / d) * a;
    p.vz += (dz / d) * a;
  } else {
    p.vx = wantX;
    p.vz = wantZ;
  }
  // which way he faces: where he's aiming while he fires, else where he's going
  if (control && input.fire) p.yaw = toward(p.yaw, input.aimYaw, ROBOT.turn * h);
  else if (control && Math.hypot(p.vx, p.vz) > 0.6 && k) p.yaw = toward(p.yaw, Math.atan2(p.vx, p.vz), ROBOT.turn * h);
}

function vehicleSlice(p, input, h) {
  const control = !p.shifting && !p.dead;
  const throttle = control ? clamp(input.throttle, -1, 1) : 0;
  const steerTo = control ? clamp(input.steer, -1, 1) : 0;
  p.steer += clamp(steerTo - p.steer, -VEHICLE.steerRate * h, VEHICLE.steerRate * h);
  const boosting = control && input.boost && throttle > 0 && p.boost > 0;
  p.boost = clamp(p.boost + (boosting ? -VEHICLE.boostDrain : VEHICLE.boostFill) * h, 0, 1);
  const cap = boosting ? VEHICLE.boost : VEHICLE.top;
  if (throttle > 0) {
    if (p.speed < 0) p.speed = Math.min(0, p.speed + VEHICLE.brake * h);
    else if (p.speed < cap) p.speed = Math.min(cap, p.speed + VEHICLE.accel * (boosting ? 1.8 : 1) * throttle * h);
  } else if (throttle < 0) {
    if (p.speed > 0.5) p.speed = Math.max(0, p.speed - VEHICLE.brake * -throttle * h);
    else p.speed = Math.max(-VEHICLE.reverse, p.speed - VEHICLE.accel * -throttle * h);
  } else {
    p.speed -= Math.sign(p.speed) * Math.min(Math.abs(p.speed), VEHICLE.drag * h);
  }
  // over the cap (boost let go): back down to it, not all at once
  if (p.speed > cap) p.speed = Math.max(cap, p.speed - 20 * h);
  // the wheel turns it less at speed, and not at all standing still
  const v = Math.abs(p.speed);
  const yawRate = p.grounded ? p.steer * VEHICLE.turn * Math.min(1, v / 8) * (1 - 0.45 * Math.min(1, v / VEHICLE.top)) * Math.sign(p.speed || 1) : 0;
  p.yaw = wrap(p.yaw + yawRate * h);
  // a hard turn at speed lets the back step out a little; the tyres pull it back
  p.slide += -yawRate * p.speed * 0.06 * h;
  p.slide -= p.slide * Math.min(1, VEHICLE.grip * h);
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  p.vx = fx * p.speed + fz * p.slide;
  p.vz = fz * p.speed - fx * p.slide;
}

function slice(p, input, h, world, events) {
  if (p.mode === 'vehicle') vehicleSlice(p, input, h);
  else robotSlice(p, input, h);

  // the transformation, counting down
  if (p.shifting) {
    p.shifting = Math.max(0, p.shifting - h);
    if (p.mode === 'robot') {
      p.vx -= p.vx * Math.min(1, 6 * h);
      p.vz -= p.vz * Math.min(1, 6 * h);
    }
    if (!p.shifting) finishShift(p, world, events);
  }

  // falling and landing
  const step = p.mode === 'vehicle' ? VEHICLE.step : ROBOT.step;
  p.vy -= ROBOT.gravity * h;
  p.y += p.vy * h;
  const ox = p.x;
  const oz = p.z;
  p.x += p.vx * h;
  p.z += p.vz * h;
  const hit = resolve(world, p, radiusOf(p), heightOf(p), step);
  if (hit) {
    if (p.mode === 'vehicle') {
      // the speed into the wall goes; along it, it stays
      const vn = p.vx * hit.nx + p.vz * hit.nz;
      if (vn < 0) {
        if (vn < -3) events.push({ type: 'bump', speed: -vn });
        p.vx -= hit.nx * vn;
        p.vz -= hit.nz * vn;
        const fx = Math.sin(p.yaw);
        const fz = Math.cos(p.yaw);
        p.speed = p.vx * fx + p.vz * fz;
        p.slide = p.vx * fz - p.vz * fx;
      }
    } else {
      // walking into a wall: no speed into it
      const vn = p.vx * hit.nx + p.vz * hit.nz;
      if (vn < 0) {
        p.vx -= hit.nx * vn;
        p.vz -= hit.nz * vn;
      }
    }
  }
  if (p.y + heightOf(p) > world.ceiling) {
    p.y = world.ceiling - heightOf(p);
    p.vy = Math.min(0, p.vy);
  }
  const floor = world.floorAt(p.x, p.z, Math.max(p.y, p.y - p.vy * h), step);
  if (p.y <= floor) {
    if (!p.grounded && p.fell > 0.15) events.push({ type: 'land', speed: -p.vy });
    p.y = floor;
    p.vy = 0;
    p.grounded = true;
    p.fell = 0;
  } else if (p.grounded && p.vy <= 0 && p.y - floor <= step * 0.6) {
    // down a step without leaving the ground
    p.y = floor;
    p.vy = 0;
  } else {
    p.grounded = false;
    p.fell += h;
  }
  return ox !== p.x || oz !== p.z;
}

function finishShift(p, world, events) {
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  if (p.shiftTo === 'robot') {
    p.vx = fx * p.speed * 0.5;
    p.vz = fz * p.speed * 0.5;
    p.speed = 0;
    p.slide = 0;
  } else {
    p.speed = p.vx * fx + p.vz * fz;
    p.slide = 0;
  }
  p.mode = p.shiftTo;
  p.shiftTo = null;
  // the truck is longer than the robot is wide: clear of whatever it's in
  resolve(world, p, radiusOf(p), heightOf(p), VEHICLE.step);
  events.push({ type: 'transformed', to: p.mode });
}

export function stepPlayer(p, input, dt, world) {
  const events = [];
  dt = Math.min(Math.max(dt, 0), MAX_DT);
  if (!dt) return events;
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.hurt = Math.max(0, p.hurt - dt);
  p.calm = (p.calm ?? MEND.after) + dt;
  if (!p.dead && p.calm >= MEND.after && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + MEND.rate * dt);
  if (input.jump && p.mode === 'robot' && p.grounded && !p.shifting && !p.dead) {
    p.vy = ROBOT.jump;
    p.grounded = false;
    events.push({ type: 'jump' });
  }
  if (input.transform && canTransform(p)) {
    p.shifting = TRANSFORM.time;
    p.shiftTo = p.mode === 'robot' ? 'vehicle' : 'robot';
    events.push({ type: 'transform', to: p.shiftTo });
  }
  const n = Math.ceil(dt / SUB - 1e-9);
  const h = dt / n;
  for (let i = 0; i < n; i++) slice(p, input, h, world, events);
  return events;
}

// ── Line of sight ──

// The part of a segment (as t from 0 to 1) inside a solid's footprint, or null
function span(s, ax, az, bx, bz) {
  if (s.kind === 'circle') {
    const dx = bx - ax;
    const dz = bz - az;
    const fx = ax - s.x;
    const fz = az - s.z;
    const a = dx * dx + dz * dz;
    const b = 2 * (fx * dx + fz * dz);
    const c = fx * fx + fz * fz - s.r * s.r;
    if (a < 1e-9) return c <= 0 ? [0, 1] : null;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const q = Math.sqrt(disc);
    const t0 = Math.max(0, (-b - q) / (2 * a));
    const t1 = Math.min(1, (-b + q) / (2 * a));
    return t0 <= t1 ? [t0, t1] : null;
  }
  const [lax, laz] = local(s, ax, az);
  const [lbx, lbz] = local(s, bx, bz);
  let t0 = 0;
  let t1 = 1;
  for (const [p0, p1, half] of [
    [lax, lbx, s.hw],
    [laz, lbz, s.hd],
  ]) {
    const d = p1 - p0;
    if (Math.abs(d) < 1e-9) {
      if (Math.abs(p0) > half) return null;
      continue;
    }
    let u0 = (-half - p0) / d;
    let u1 = (half - p0) / d;
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

// Whether nothing solid stands between two points
export function segmentClear(world, ax, ay, az, bx, by, bz) {
  const mx = (ax + bx) / 2;
  const mz = (az + bz) / 2;
  const r = Math.hypot(bx - ax, bz - az) / 2 + 1;
  for (const s of world.near(mx, mz, r)) {
    const t = span(s, ax, az, bx, bz);
    if (!t) continue;
    const y0 = ay + (by - ay) * t[0];
    const y1 = ay + (by - ay) * t[1];
    if (Math.min(y0, y1) < s.top && Math.max(y0, y1) > s.base) return false;
  }
  return true;
}

// ── Shots ──

const chest = (t) => t.y + t.h * 0.6;

// Fire the guns, if they're cool: the robot's blaster from his shoulder, the
// truck's twin guns from its nose. Aimed where `aim` points, or at whatever
// live target is nearly in line with it.
export function fire(p, targets, aim) {
  if (p.cooldown > 0 || p.shifting || p.dead) return [];
  const vehicle = p.mode === 'vehicle';
  const yaw = vehicle ? p.yaw : aim.yaw;
  const pitch = vehicle ? 0 : aim.pitch ?? 0;
  let dx = Math.sin(yaw) * Math.cos(pitch);
  let dy = Math.sin(pitch);
  let dz = Math.cos(yaw) * Math.cos(pitch);
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const origins = vehicle
    ? [-1.2, 1.2].map((side) => [p.x + fx * 4.5 + fz * side, p.y + 1.5, p.z + fz * 4.5 - fx * side])
    : // (from the gun's muzzle, where the page knows it, else off his right
      // shoulder: +x is his left)
      [aim.from && Math.hypot(aim.from[0] - p.x, aim.from[2] - p.z) < 9 ? aim.from : [p.x + Math.sin(yaw) * 1.6 - Math.cos(yaw) * 1.4, p.y + 7.5, p.z + Math.cos(yaw) * 1.6 + Math.sin(yaw) * 1.4]];
  // the best target: the one nearest the line, within the cone and range
  const cone = vehicle ? SHOT.aimVehicle : SHOT.aim;
  let best = null;
  let bestAngle = cone;
  const [ox, oy, oz] = origins[0];
  for (const t of targets) {
    if (t.dead) continue;
    const tx = t.x - ox;
    const ty = chest(t) - oy;
    const tz = t.z - oz;
    const d = Math.hypot(tx, ty, tz);
    if (d > SHOT.reach || d < 1) continue;
    const angle = Math.acos(clamp((tx * dx + ty * dy + tz * dz) / d, -1, 1));
    if (angle < bestAngle) {
      bestAngle = angle;
      best = t;
    }
  }
  p.cooldown = vehicle ? SHOT.cooldownVehicle : SHOT.cooldownRobot;
  return origins.map(([x, y, z]) => {
    let ux = dx;
    let uy = dy;
    let uz = dz;
    if (best) {
      const tx = best.x - x;
      const ty = chest(best) - y;
      const tz = best.z - z;
      const d = Math.hypot(tx, ty, tz);
      [ux, uy, uz] = [tx / d, ty / d, tz / d];
    }
    return { from: 'player', x, y, z, vx: ux * SHOT.speed, vy: uy * SHOT.speed, vz: uz * SHOT.speed, ttl: SHOT.ttl, damage: vehicle ? SHOT.vehicleDamage : SHOT.robotDamage };
  });
}

// Whether a segment passes through a standing cylinder; the t it enters at
function crosses(t, ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const fx = ax - t.x;
  const fz = az - t.z;
  const a = dx * dx + dz * dz;
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - t.r * t.r;
  let u;
  if (c <= 0) u = 0;
  else {
    if (a < 1e-9) return null;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    u = (-b - Math.sqrt(disc)) / (2 * a);
    if (u < 0 || u > 1) return null;
  }
  const y = ay + (by - ay) * u;
  return y >= t.y && y <= t.y + t.h ? u : null;
}

// Move every shot on; take out the ones that hit something, run out or leave.
// Returns what was hit (the caller does the damage).
export function stepShots(shots, dt, world, targets) {
  const hits = [];
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    const nx = s.x + s.vx * dt;
    const ny = s.y + s.vy * dt;
    const nz = s.z + s.vz * dt;
    let hit = null;
    let at = Infinity;
    for (const t of targets) {
      if (t.dead) continue;
      const u = crosses(t, s.x, s.y, s.z, nx, ny, nz);
      if (u !== null && u < at) {
        at = u;
        hit = t;
      }
    }
    const blocked = !segmentClear(world, s.x, s.y, s.z, hit ? s.x + (nx - s.x) * at : nx, hit ? s.y + (ny - s.y) * at : ny, hit ? s.z + (nz - s.z) * at : nz) || ny < world.heightAt(nx, nz);
    s.ttl -= dt;
    if (hit && !blocked) hits.push({ shot: s, target: hit });
    if (hit || blocked || s.ttl <= 0) {
      shots.splice(i, 1);
      continue;
    }
    s.x = nx;
    s.y = ny;
    s.z = nz;
  }
  return hits;
}

// ── The Decepticons ──

export function newEnemy(kind, x, z, { id, model = null, y = 0 } = {}) {
  const k = ENEMY_KINDS[kind];
  return { id: id ?? `${kind}-${x}-${z}`, kind, model, x, y, z, yaw: 0, hp: k.hp, maxHp: k.hp, r: k.r, h: k.h, state: 'advance', t: 0, cooldown: k.cooldown * 0.6, dir: 1, dead: false, boss: !!k.boss, form: 'robot', shift: 0, span: 0 };
}

export function hurtEnemy(e, amount) {
  if (e.dead) return [];
  e.hp = Math.max(0, e.hp - amount);
  if (e.hp > 0) return [{ type: 'enemyHurt', id: e.id }];
  e.dead = true;
  e.state = 'dead';
  return [{ type: 'kill', id: e.id, kind: e.kind }];
}

export function stepEnemies(enemies, player, dt, world, rand = Math.random) {
  const shots = [];
  const events = [];
  dt = Math.min(Math.max(dt, 0), MAX_DT);
  for (const e of enemies) {
    if (e.dead) continue;
    const k = ENEMY_KINDS[e.kind];
    const dx = player.x - e.x;
    const dz = player.z - e.z;
    const d = Math.hypot(dx, dz) || 1e-6;
    // changing from one form to the other: still, and holding fire
    if (e.shift > 0) {
      e.shift = Math.max(0, e.shift - dt);
      continue;
    }
    const F = FORMS[e.kind];
    if (F) {
      const alt = e.form === F.alt;
      e.span = (e.span ?? 0) + dt;
      if (e.span >= (alt ? F[F.alt] : F.robot)) {
        e.form = alt ? 'robot' : F.alt;
        e.shift = alt ? F.back : F.shift;
        e.span = 0;
        e.r = alt ? k.r : F.r;
        e.h = alt ? k.h : F.h;
        e.state = 'shift';
        events.push({ type: 'enemyShift', id: e.id, to: e.form });
        continue;
      }
      if (!alt) e.ram = 0;
      else {
        drive(e, F, player, dt, world, d, shots, events, rand);
        continue;
      }
    }
    e.yaw = toward(e.yaw, Math.atan2(dx, dz), 4 * dt);
    e.t += dt;
    let vx = 0;
    let vz = 0;
    if (d > k.range * 0.8) {
      e.state = 'advance';
      vx = (dx / d) * k.speed;
      vz = (dz / d) * k.speed;
    } else {
      e.state = 'strafe';
      if (e.t > 2.2) {
        e.t = 0;
        e.dir = rand() < 0.5 ? -1 : 1;
      }
      // round the player, backing off if too close
      const back = d < 18 ? -0.8 : 0;
      vx = (dz / d) * e.dir * k.speed * 0.6 + (dx / d) * back * k.speed;
      vz = (-dx / d) * e.dir * k.speed * 0.6 + (dz / d) * back * k.speed;
    }
    e.x += vx * dt;
    e.z += vz * dt;
    resolve(world, e, e.r, e.h, ROBOT.step);
    e.y = world.floorAt(e.x, e.z, e.y + 1, ROBOT.step);
    e.cooldown -= dt;
    if (e.cooldown <= 0 && d < k.range && !player.dead) {
      const ex = e.x;
      const ey = e.y + e.h * 0.75;
      const ez = e.z;
      const px = player.x;
      const py = player.y + (player.mode === 'vehicle' ? 1.5 : ROBOT.height * 0.6);
      const pz = player.z;
      if (segmentClear(world, ex, ey, ez, px, py, pz)) {
        const spread = ((rand() - 0.5) * 6 * Math.PI) / 180;
        const yaw = Math.atan2(px - ex, pz - ez) + spread;
        const flat = Math.hypot(px - ex, pz - ez);
        const pitch = Math.atan2(py - ey, flat) + ((rand() - 0.5) * 3 * Math.PI) / 180;
        const speed = SHOT.speed * 0.6;
        shots.push({ from: 'enemy', by: e.id, x: ex, y: ey, z: ez, vx: Math.sin(yaw) * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed, vz: Math.cos(yaw) * Math.cos(pitch) * speed, ttl: 1.6, damage: k.damage });
        events.push({ type: 'enemyFire', id: e.id });
      }
      e.cooldown = k.cooldown * (0.8 + 0.4 * rand());
    }
  }
  return { shots, events };
}

// A Decepticon in his other form: straight at Optimus and on past him (he
// doesn't turn once he's close, so he overshoots and comes round again).
// Barricade's car rams him, once a pass; Megatron's tank lobs shells that
// hit hard.
function drive(e, F, player, dt, world, d, shots, events, rand) {
  e.state = 'charge';
  if (d > 16) e.yaw = toward(e.yaw, Math.atan2(player.x - e.x, player.z - e.z), F.turn * dt);
  e.x += Math.sin(e.yaw) * F.speed * dt;
  e.z += Math.cos(e.yaw) * F.speed * dt;
  resolve(world, e, e.r, e.h, VEHICLE.step);
  e.y = world.floorAt(e.x, e.z, e.y + 1, VEHICLE.step);
  if (F.ram) {
    // (a hit as he goes through: a shot from right beside Optimus, the
    // page's way of hurting him, that nobody sees)
    e.ram = Math.max(0, (e.ram ?? 0) - dt);
    const reach = e.r + (player.mode === 'vehicle' ? VEHICLE.radius : ROBOT.radius) + 0.6;
    if (!e.ram && !player.dead && Math.hypot(player.x - e.x, player.z - e.z) < reach && Math.abs(player.y - e.y) < 4) {
      e.ram = 1.4;
      const y = player.y + 1.5;
      shots.push({ from: 'enemy', by: e.id, ram: true, x: player.x - Math.sin(e.yaw) * 0.5, y, z: player.z - Math.cos(e.yaw) * 0.5, vx: Math.sin(e.yaw) * 30, vy: 0, vz: Math.cos(e.yaw) * 30, ttl: 0.05, damage: F.ram });
      events.push({ type: 'ram', id: e.id });
    }
    return;
  }
  e.cooldown -= dt;
  if (e.cooldown > 0 || d > F.range || player.dead) return;
  e.cooldown = F.cooldown * (0.85 + 0.3 * rand());
  // (the shell from the cannon's muzzle, ahead of the turret)
  const ex = e.x + Math.sin(e.yaw) * 4;
  const ey = e.y + F.h * 0.7;
  const ez = e.z + Math.cos(e.yaw) * 4;
  const px = player.x;
  const py = player.y + (player.mode === 'vehicle' ? 1.5 : ROBOT.height * 0.5);
  const pz = player.z;
  if (!segmentClear(world, ex, ey, ez, px, py, pz)) return;
  const yaw = Math.atan2(px - ex, pz - ez) + ((rand() - 0.5) * 4 * Math.PI) / 180;
  const pitch = Math.atan2(py - ey, Math.hypot(px - ex, pz - ez));
  const speed = SHOT.speed * F.shell;
  shots.push({ from: 'enemy', by: e.id, heavy: true, x: ex, y: ey, z: ez, vx: Math.sin(yaw) * Math.cos(pitch) * speed, vy: Math.sin(pitch) * speed, vz: Math.cos(yaw) * Math.cos(pitch) * speed, ttl: 2.2, damage: F.damage });
  events.push({ type: 'enemyFire', id: e.id, heavy: true });
}

// ── Energon, people, bridges ──

export function stepPickups(pickups, p) {
  const reach = p.mode === 'vehicle' ? 5 : 4;
  const got = [];
  for (const k of pickups) {
    if (k.taken) continue;
    if (Math.hypot(k.x - p.x, k.z - p.z) <= reach && Math.abs((k.y ?? 0) - p.y) < 10) {
      k.taken = true;
      got.push(k.id);
    }
  }
  return got;
}

// What there is to do close by: someone to talk to (on foot), or a bridge to
// go through (on foot, or driven into)
export function nearby(p, area, state = {}) {
  if (p.dead || p.shifting) return null;
  for (const x of area.exits ?? []) {
    const d = Math.hypot(x.x - p.x, x.z - p.z);
    if (d <= x.r || (p.mode === 'robot' && d <= x.r + 4)) return { type: 'exit', id: x.id, label: x.label, to: x.to };
  }
  let best = null;
  // (pulled up beside someone in the truck: he gets out to talk, so say so)
  let bestD = p.mode === 'robot' ? 10 : 14;
  for (const person of area.people ?? []) {
    if (!person.lines?.length || state.hidden?.includes(person.id)) continue;
    const d = Math.hypot(person.x - p.x, person.z - p.z);
    if (d <= bestD && Math.abs((person.y ?? 0) - p.y) < 6) {
      bestD = d;
      best = { type: p.mode === 'robot' ? 'talk' : 'shift', id: person.id, label: person.name };
    }
  }
  return best;
}

// ── Missions ──

export const newMissions = () => ({ active: null, step: 0, count: 0, timer: 0, done: [] });

// The missions an area offers now: not done, and whatever each needs done first
export const available = (area, ms) => (area.missions ?? []).filter((m) => !ms.done.includes(m.id) && ms.active !== m.id && (m.requires ?? []).every((r) => ms.done.includes(r)));

export function startMission(ms, mission) {
  ms.active = mission.id;
  ms.step = 0;
  ms.count = 0;
  ms.timer = mission.steps[0]?.within ?? 0;
  return mission.steps[0] ?? null;
}

const within = (e, at) => Math.hypot(e.x - at.x, e.z - at.z) <= at.r;

export function feedMission(ms, area, event) {
  const none = { advanced: false, step: null, completed: null };
  if (!ms.active) return none;
  const mission = (area.missions ?? []).find((m) => m.id === ms.active);
  if (!mission) return none; // (it belongs to another area: kept as it is)
  const step = mission.steps[ms.step];
  // (something that happened somewhere other than where this step is played)
  const where = step.area ?? mission.area;
  if (event.area && where && event.area !== where && event.type !== 'tick') return { ...none, step };
  let advance = false;
  const out = { ...none, step };
  switch (event.type) {
    case 'tick':
      if (step.within) {
        ms.timer -= event.dt;
        if (ms.timer <= 0) {
          ms.count = 0;
          ms.timer = step.within;
          return { ...out, failed: true };
        }
      }
      return out;
    case 'talk':
      advance = step.type === 'talk' && event.id === step.target;
      break;
    case 'move':
      if (step.type === 'reach') advance = within(event, step.at);
      else if (step.type === 'drive') {
        const gate = step.gates[ms.count];
        if (gate && within(event, gate)) {
          ms.count += 1;
          out.gate = ms.count - 1;
          advance = ms.count >= step.gates.length;
        }
      }
      break;
    case 'pickup':
      if (step.type === 'collect' && (!step.kind || event.kind === step.kind)) {
        ms.count += 1;
        advance = ms.count >= step.count;
      }
      break;
    case 'kill':
      if (step.type === 'clear') {
        ms.count += 1;
        advance = ms.count >= step.count;
      } else if (step.type === 'defeat') advance = event.id === step.target;
      break;
    case 'exit':
      advance = step.type === 'exit' && event.to === step.to;
      break;
    case 'transformed':
      advance = step.type === 'transform' && event.to === step.to;
      break;
    default:
      break;
  }
  if (!advance) return out;
  ms.step += 1;
  ms.count = 0;
  const next = mission.steps[ms.step] ?? null;
  ms.timer = next?.within ?? 0;
  if (!next) {
    ms.done.push(mission.id);
    ms.active = null;
    ms.step = 0;
    return { ...out, advanced: true, step: null, completed: mission.id };
  }
  return { ...out, advanced: true, step: next };
}
