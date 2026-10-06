// Getting about on foot, and on whatever you ride: the rules, with no
// drawing in them (the scene moves the figures to match), so they're the
// same in a test as on the screen.
//
// On foot (walk): the stick (or WASD) moves you relative to the camera,
// Shift runs, Space jumps; you turn to face the way you're going, climb
// what isn't too steep, step down slopes without leaving the ground, and
// stop against whatever's solid (trees, rocks, walls, walkers' feet). Some
// worlds have floors over the land (Cloud City's walkways, Kamino's
// platforms, a Coruscant rooftop): you stand on whichever is under you.
// Walk off the edge of one with nothing below and you fall.
//
// Riding (ride): a speeder, a speeder bike, a tauntaun: throttle forward,
// steer round, it holds its height over the ground (or runs on it), banks
// into its turns, and bounces off what it hits, slowed.
//
// world: { heightAt(x, z), normalAt(x, z), solids (createSolids), floors
// (a list: { x, z, r } discs or { x, z, hw, hd, yaw } boxes, each at `y`;
// `tag`ged ones can be taken away, `off`: a trapdoor that's opened),
// reach (how far from the middle you can go), water? (a level you wade
// in and can't go under) }

export const WALK = { walk: 3.3, run: 7.4, accel: 26, air: 5, turn: 11, jump: 5.4, gravity: 15.5, step: 0.55, steep: 0.6, radius: 0.38, wade: 0.85 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// turn `from` toward `to` by at most `max` (radians)
export const turnToward = (from, to, max) => from + clamp(wrapAngle(to - from), -max, max);

// ── What's solid ──

// Circles (a trunk, a rock, a leg) and boxes turned about the vertical (a
// wall, a hut), in a grid of cells for finding the ones near you. `top`:
// how high it stands (you can jump onto something low; null for as high as
// you like); `base`: where it starts (something over your head, on the
// floor above: a throne over a rancor's pit).
export function createSolids(cell = 16) {
  const cells = new Map();
  const all = [];
  const key = (i, j) => i * 73856093 + j * 19349663;
  const put = (s, minX, minZ, maxX, maxZ) => {
    all.push(s);
    for (let i = Math.floor(minX / cell); i <= Math.floor(maxX / cell); i++)
      for (let j = Math.floor(minZ / cell); j <= Math.floor(maxZ / cell); j++) {
        const k = key(i, j);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(s);
      }
    return s;
  };
  const found = [];
  const seen = new Set(); // (one for every call: near() runs many times a frame)
  return {
    all,
    circle(x, z, r, { top = null, base = null, tag = null } = {}) {
      return put({ type: 'circle', x, z, r, top, base, tag }, x - r, z - r, x + r, z + r);
    },
    // a box hw × hd half-size, turned by yaw (as three.js turns a thing
    // about y: its own x along (cos yaw, −sin yaw))
    box(x, z, hw, hd, yaw = 0, { top = null, base = null, tag = null } = {}) {
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const ex = Math.abs(hw * c) + Math.abs(hd * s);
      const ez = Math.abs(hw * s) + Math.abs(hd * c);
      return put({ type: 'box', x, z, hw, hd, c, s, top, base, tag }, x - ex, z - ez, x + ex, z + ez);
    },
    // those whose cells reach within r of (x, z)
    near(x, z, r) {
      found.length = 0;
      seen.clear();
      for (let i = Math.floor((x - r) / cell); i <= Math.floor((x + r) / cell); i++)
        for (let j = Math.floor((z - r) / cell); j <= Math.floor((z + r) / cell); j++) {
          const list = cells.get(key(i, j));
          if (!list) continue;
          for (const s of list)
            if (!seen.has(s)) {
              seen.add(s);
              found.push(s);
            }
        }
      return found;
    },
  };
}

// Push a circle at (x, z) of radius r out of a solid; returns the push
// [dx, dz] or null if it wasn't in it (or the solid's gone: `off`, a gate
// that's up)
export function pushOut(s, x, z, r) {
  if (s.off) return null;
  if (s.type === 'circle') {
    const dx = x - s.x;
    const dz = z - s.z;
    const d = Math.hypot(dx, dz);
    const min = s.r + r;
    if (d >= min) return null;
    if (d < 1e-6) return [min, 0];
    return [(dx / d) * (min - d), (dz / d) * (min - d)];
  }
  // into the box's frame (turned by yaw as three.js turns things about y)
  const dx = x - s.x;
  const dz = z - s.z;
  const lx = dx * s.c - dz * s.s;
  const lz = dx * s.s + dz * s.c;
  const qx = clamp(lx, -s.hw, s.hw);
  const qz = clamp(lz, -s.hd, s.hd);
  let ox = lx - qx;
  let oz = lz - qz;
  const d = Math.hypot(ox, oz);
  if (d >= r) return null;
  let px;
  let pz;
  if (d > 1e-6) {
    px = (ox / d) * (r - d);
    pz = (oz / d) * (r - d);
  } else {
    // inside it: out the nearest side
    const toX = s.hw - Math.abs(lx);
    const toZ = s.hd - Math.abs(lz);
    if (toX < toZ) {
      px = Math.sign(lx || 1) * (toX + r);
      pz = 0;
    } else {
      px = 0;
      pz = Math.sign(lz || 1) * (toZ + r);
    }
  }
  // back out of its frame
  return [px * s.c + pz * s.s, -px * s.s + pz * s.c];
}

// ── What's underfoot ──

const onFloor = (f, x, z) => {
  if (f.r != null) return Math.hypot(x - f.x, z - f.z) <= f.r;
  const dx = x - f.x;
  const dz = z - f.z;
  const c = Math.cos(f.yaw ?? 0);
  const s = Math.sin(f.yaw ?? 0);
  return Math.abs(dx * c - dz * s) <= f.hw && Math.abs(dx * s + dz * c) <= f.hd;
};

// The height of what you'd stand on at (x, z), coming down from `y`: the
// land, or the highest floor there that isn't over your head
export function groundAt(world, x, z, y = Infinity, step = WALK.step) {
  let g = world.heightAt(x, z);
  if (world.floors)
    for (const f of world.floors) if (!f.off && f.y <= y + step && f.y > g && onFloor(f, x, z)) g = f.y;
  return g;
}

// ── On foot ──

export function walker(x = 0, z = 0, y = 0, yaw = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, grounded: true, speed: 0, air: 0, wading: 0 };
}

// input: { x (strafe, -1 left … 1 right), y (-1 back … 1 forward), run,
// jump (pressed this frame), heading (the camera's yaw: forward is
// (sin, cos) of it) }; returns what happened: { landed (the speed you hit
// the ground at), jumped, bumped }
export function walk(s, input, dt, world, rules = WALK) {
  const out = { landed: 0, jumped: false, bumped: false };
  const mag = Math.min(1, Math.hypot(input.x, input.y));
  const h = input.heading ?? 0;
  // the way the stick points, in the world
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const rx = -Math.cos(h); // (the camera's right, looking along +z, is -x)
  const rz = Math.sin(h);
  let dx = fx * input.y + rx * input.x;
  let dz = fz * input.y + rz * input.x;
  const dl = Math.hypot(dx, dz);
  if (dl > 1e-6) {
    dx /= dl;
    dz /= dl;
  }
  const top = (input.run ? rules.run : rules.walk) * mag * (s.wading > 0.3 ? 0.55 : 1);
  const want = [dx * top, dz * top];
  const a = (s.grounded ? rules.accel : rules.air) * dt;
  const tx = want[0] - s.vx;
  const tz = want[1] - s.vz;
  const tl = Math.hypot(tx, tz);
  const k = tl > a ? a / tl : 1;
  s.vx += tx * k;
  s.vz += tz * k;

  // across the ground
  const was = { x: s.x, z: s.z };
  let nx = s.x + s.vx * dt;
  let nz = s.z + s.vz * dt;
  // what's too steep to walk up stops you (you can still come down it)
  if (s.grounded) {
    const g0 = groundAt(world, s.x, s.z, s.y, rules.step);
    const g1 = groundAt(world, nx, nz, s.y, rules.step);
    const n = world.normalAt ? world.normalAt(nx, nz) : [0, 1, 0];
    if (g1 > g0 + 0.02 && n[1] < rules.steep) {
      // slide along it: keep only the part of the step across the slope
      const sx = n[0];
      const sz = n[2];
      const sl = Math.hypot(sx, sz) || 1;
      const into = (s.vx * sx + s.vz * sz) / sl;
      if (into < 0) {
        s.vx -= (into * sx) / sl;
        s.vz -= (into * sz) / sl;
        nx = s.x + s.vx * dt;
        nz = s.z + s.vz * dt;
        out.bumped = true;
      }
    }
  }
  // out of whatever's solid
  if (world.solids)
    for (let pass = 0; pass < 2; pass++)
      for (const sol of world.solids.near(nx, nz, rules.radius + 1)) {
        if (sol.top != null && s.y >= sol.top - 0.05) continue; // stood on it, or over it
        if (sol.base != null && s.y + 1.7 < sol.base) continue; // under it
        const p = pushOut(sol, nx, nz, rules.radius);
        if (!p) continue;
        nx += p[0];
        nz += p[1];
        out.bumped = true;
      }
  // and not past the edge of the world
  const r = Math.hypot(nx, nz);
  if (world.reach && r > world.reach) {
    nx *= world.reach / r;
    nz *= world.reach / r;
    out.bumped = true;
  }
  s.x = nx;
  s.z = nz;
  // (what it actually moved, for the legs)
  s.speed = Math.hypot(s.x - was.x, s.z - was.z) / Math.max(dt, 1e-6);
  if (out.bumped) {
    s.vx = (s.x - was.x) / Math.max(dt, 1e-6);
    s.vz = (s.z - was.z) / Math.max(dt, 1e-6);
  }

  // up and down
  const g = Math.max(groundAt(world, s.x, s.z, s.y, rules.step), solidTop(world, s.x, s.z, s.y, rules));
  if (s.grounded && input.jump) {
    s.vy = rules.jump;
    s.grounded = false;
    out.jumped = true;
  }
  if (s.grounded) {
    // follow the ground down a slope, or up a step
    if (g <= s.y + rules.step && g >= s.y - rules.step * 1.6) {
      s.y = g;
      s.vy = 0;
    } else s.grounded = false;
  }
  if (!s.grounded) {
    s.vy -= rules.gravity * dt;
    s.y += s.vy * dt;
    s.air += dt;
    if (s.y <= g) {
      out.landed = -s.vy;
      s.y = g;
      s.vy = 0;
      s.grounded = true;
      s.air = 0;
    }
  }
  // wading: how deep in the water you are
  s.wading = world.water != null ? clamp((world.water - s.y) / rules.wade, 0, 1) : 0;
  if (world.water != null && s.y < world.water - rules.wade) {
    s.y = world.water - rules.wade; // (no deeper than the knees… or so)
    if (s.vy < 0) s.vy = 0;
  }

  // face the way you're going
  if (mag > 0.08 && dl > 1e-6) s.yaw = turnToward(s.yaw, Math.atan2(dx, dz), rules.turn * dt);
  return out;
}

// the top of anything low enough to stand on, under you
function solidTop(world, x, z, y, rules) {
  if (!world.solids) return -Infinity;
  let top = -Infinity;
  for (const s of world.solids.near(x, z, 0.5)) {
    if (s.top == null || s.top > y + rules.step) continue;
    if (pushOut(s, x, z, 0.05)) top = Math.max(top, s.top);
  }
  return top;
}

// ── Riding ──

// spec: { top (m/s), boost?, accel, brake, turn (rad/s at speed), hover
// (m over the ground; 0 runs on it), bank, radius, grip (0…1: how much it
// keeps going the way it's pointed) }
export function rider(x, z, y, yaw = 0) {
  return { x, y, z, yaw, speed: 0, vx: 0, vz: 0, vy: 0, bank: 0, pitch: 0, grounded: true };
}

export function ride(s, input, dt, world, spec) {
  const out = { hit: 0 };
  const boost = input.run && spec.boost ? spec.boost : spec.top;
  const want = input.y >= 0 ? input.y * boost : input.y * spec.top * 0.35;
  const rate = want > s.speed ? spec.accel : spec.brake;
  s.speed += clamp(want - s.speed, -rate * dt, rate * dt);
  // turning: sharper slow, steadier fast
  const turn = spec.turn * (0.35 + 0.65 * Math.min(1, Math.abs(s.speed) / 6)) * (s.speed < 0 ? -1 : 1);
  s.yaw -= input.x * turn * dt;
  s.bank += (input.x * Math.min(1, Math.abs(s.speed) / spec.top) * spec.bank - s.bank) * Math.min(1, dt * 5);
  // its velocity swings round to where it's pointed (a hover vehicle drifts)
  const fx = Math.sin(s.yaw) * s.speed;
  const fz = Math.cos(s.yaw) * s.speed;
  const grip = 1 - Math.pow(1 - (spec.grip ?? 0.9), dt * 10);
  s.vx += (fx - s.vx) * grip;
  s.vz += (fz - s.vz) * grip;
  let nx = s.x + s.vx * dt;
  let nz = s.z + s.vz * dt;
  if (world.solids)
    for (const sol of world.solids.near(nx, nz, spec.radius + 1)) {
      if (sol.top != null && s.y >= sol.top) continue;
      const p = pushOut(sol, nx, nz, spec.radius);
      if (!p) continue;
      nx += p[0];
      nz += p[1];
      // hit it: lose most of the speed into it
      const pl = Math.hypot(p[0], p[1]) || 1;
      const into = -(s.vx * p[0] + s.vz * p[1]) / pl;
      if (into > 0) {
        out.hit = Math.max(out.hit, into);
        s.vx += ((p[0] / pl) * into * 1.4);
        s.vz += ((p[1] / pl) * into * 1.4);
        s.speed *= 0.35;
      }
    }
  const r = Math.hypot(nx, nz);
  if (world.reach && r > world.reach) {
    nx *= world.reach / r;
    nz *= world.reach / r;
    s.speed *= 0.6;
  }
  s.x = nx;
  s.z = nz;
  // its height: held over the ground (or the water), eased
  let g = groundAt(world, s.x, s.z, s.y + 2, 2);
  if (world.water != null && spec.hover > 0) g = Math.max(g, world.water);
  const ahead = groundAt(world, s.x + Math.sin(s.yaw) * 3, s.z + Math.cos(s.yaw) * 3, s.y + 2, 2);
  s.pitch += (Math.atan2(ahead - g, 3) * 0.6 - s.pitch) * Math.min(1, dt * 6);
  const target = g + (spec.hover ?? 0);
  if (spec.hover > 0) {
    // a hover: springs to its height, can be thrown off a crest
    s.vy += ((target - s.y) * 30 - s.vy * 7) * dt;
    s.vy -= 2 * dt;
    s.y += s.vy * dt;
    if (s.y < g + 0.15) {
      s.y = g + 0.15;
      s.vy = Math.max(0, s.vy);
    }
  } else {
    // on its feet: on the ground, jumping when asked
    if (s.grounded && input.jump) {
      s.vy = 5.2;
      s.grounded = false;
    }
    if (!s.grounded) {
      s.vy -= 15 * dt;
      s.y += s.vy * dt;
      if (s.y <= target) {
        s.y = target;
        s.vy = 0;
        s.grounded = true;
      }
    } else s.y = target;
  }
  return out;
}
