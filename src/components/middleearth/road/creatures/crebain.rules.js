// The crebain’s flock, pure: a murmuration of black birds out of Dunland
// sent to spy, as boids (each bird drawn to its neighbours’ middle, turned
// with their heading, kept off the ones too near) flying to a goal the
// beat moves: over the ridge and back. Two things hold whatever the flock
// does, so it reads as one cloud and never as birds through one another:
// every bird within RADIUS of the flock’s centre, no two closer than GAP.
//
//   newFlock(count, { seed, at }) → { count, p: Float64Array(3·count), v: Float64Array(3·count) }
//   step(flock, dt, goal) → the flock dt seconds on (a new one: the given is untouched)
//   centreOf(flock) → [x, y, z]
//
// Flat arrays, as the instanced mesh reads them, and every pair looked at
// with no allocation: three hundred birds a frame is 45,000 pairs.

export const RADIUS = 40; // m, the farthest a bird strays from the flock’s centre
export const GAP = 0.6; // m, the nearest two birds come
const NEAR = 3; // m: the neighbours a bird heeds
const APART = 1.4; // m: closer than this, a bird pulls away
const FAST = 15; // m/s
const SLOW = 5;
const TURN = 2.2; // 1/s: how hard a bird steers to what it wants
const SPACING = 1.3; // m between birds as the flock is made

// a small seeded generator (mulberry32), so a flock is the same every time
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newFlock(count, { seed = 1, at = [0, 20, 0] } = {}) {
  const r = rng(seed);
  const side = Math.ceil(Math.cbrt(count));
  const p = new Float64Array(count * 3);
  const v = new Float64Array(count * 3);
  // (a jittered lattice, the jitter under half the spacing less the gap, so none start too near)
  const j = (SPACING - GAP) / 2 - 0.01;
  for (let i = 0; i < count; i++) {
    const gx = i % side;
    const gy = Math.floor(i / side) % side;
    const gz = Math.floor(i / (side * side));
    p[i * 3] = at[0] + (gx - side / 2) * SPACING + (r() * 2 - 1) * j;
    p[i * 3 + 1] = at[1] + (gy - side / 2) * SPACING + (r() * 2 - 1) * j;
    p[i * 3 + 2] = at[2] + (gz - side / 2) * SPACING + (r() * 2 - 1) * j;
    v[i * 3] = (r() - 0.5) * 2;
    v[i * 3 + 1] = (r() - 0.5) * 0.5;
    v[i * 3 + 2] = SLOW + r() * 2;
  }
  return { count, p, v };
}

export function centreOf({ count, p }) {
  const c = [0, 0, 0];
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) c[k] += p[i * 3 + k] / count;
  return c;
}

export function step(flock, dt, goal) {
  const { count } = flock;
  const op = flock.p;
  const ov = flock.v;
  const p = new Float64Array(count * 3);
  const v = new Float64Array(count * 3);
  const near2 = NEAR * NEAR;
  const k = Math.min(1, TURN * dt);
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const bx = op[ix];
    const by = op[ix + 1];
    const bz = op[ix + 2];
    let mx = 0, my = 0, mz = 0, hx = 0, hy = 0, hz = 0, ax = 0, ay = 0, az = 0;
    let n = 0;
    for (let o = 0; o < count; o++) {
      if (o === i) continue;
      const ox = o * 3;
      const dx = bx - op[ox];
      const dy = by - op[ox + 1];
      const dz = bz - op[ox + 2];
      const l2 = dx * dx + dy * dy + dz * dz;
      if (l2 > near2) continue;
      n++;
      mx += op[ox];
      my += op[ox + 1];
      mz += op[ox + 2];
      hx += ov[ox];
      hy += ov[ox + 1];
      hz += ov[ox + 2];
      const l = Math.sqrt(l2);
      if (l < APART && l > 1e-6) {
        const w = (APART - l) / APART / l;
        ax += dx * w;
        ay += dy * w;
        az += dz * w;
      }
    }
    // what the bird wants: to the goal (slowing as it nears), with its neighbours, off the nearest
    const tx = goal[0] - bx;
    const ty = goal[1] - by;
    const tz = goal[2] - bz;
    const dist = Math.hypot(tx, ty, tz) || 1;
    const speed = Math.max(SLOW, Math.min(FAST, dist * 0.5)) / dist;
    let wx = tx * speed + 14 * ax;
    let wy = ty * speed + 14 * ay;
    let wz = tz * speed + 14 * az;
    if (n) {
      wx += 0.4 * (mx / n - bx) + 0.5 * (hx / n - ov[ix]);
      wy += 0.4 * (my / n - by) + 0.5 * (hy / n - ov[ix + 1]);
      wz += 0.4 * (mz / n - bz) + 0.5 * (hz / n - ov[ix + 2]);
    }
    let vx = ov[ix] + (wx - ov[ix]) * k;
    let vy = ov[ix + 1] + (wy - ov[ix + 1]) * k;
    let vz = ov[ix + 2] + (wz - ov[ix + 2]) * k;
    const s = Math.hypot(vx, vy, vz) || 1;
    const f = s > FAST ? FAST / s : s < SLOW ? SLOW / s : 1;
    vx *= f;
    vy *= f;
    vz *= f;
    v[ix] = vx;
    v[ix + 1] = vy;
    v[ix + 2] = vz;
    p[ix] = bx + vx * dt;
    p[ix + 1] = by + vy * dt;
    p[ix + 2] = bz + vz * dt;
  }
  // the two that hold: none strayed from the cloud (brought back inside it, a little short of its edge)…
  const c = centreOf({ count, p });
  const edge = RADIUS * 0.95;
  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    const dx = p[ix] - c[0];
    const dy = p[ix + 1] - c[1];
    const dz = p[ix + 2] - c[2];
    const l = Math.hypot(dx, dy, dz);
    if (l <= edge) continue;
    p[ix] = c[0] + (dx / l) * edge;
    p[ix + 1] = c[1] + (dy / l) * edge;
    p[ix + 2] = c[2] + (dz / l) * edge;
  }
  // …and none too near another: pushed apart along the line between, again until none is
  const gap2 = GAP * GAP;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < count; i++)
      for (let o = i + 1; o < count; o++) {
        const ix = i * 3;
        const ox = o * 3;
        let dx = p[ix] - p[ox];
        let dy = p[ix + 1] - p[ox + 1];
        let dz = p[ix + 2] - p[ox + 2];
        const l2 = dx * dx + dy * dy + dz * dz;
        if (l2 >= gap2) continue;
        let l = Math.sqrt(l2);
        if (l < 1e-9) {
          dx = 1;
          dy = 0;
          dz = 0;
          l = 1;
        } else {
          dx /= l;
          dy /= l;
          dz /= l;
        }
        const push = (GAP - Math.sqrt(l2)) / 2 + 1e-4;
        p[ix] += dx * push;
        p[ix + 1] += dy * push;
        p[ix + 2] += dz * push;
        p[ox] -= dx * push;
        p[ox + 1] -= dy * push;
        p[ox + 2] -= dz * push;
        moved = true;
      }
    if (!moved) break;
  }
  return { count, p, v };
}
