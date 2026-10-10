// One emitter's particles stepped on the CPU, pure: the reference the GPU
// twin (gpu.js) is held to, and the path the node renderer takes on WebGL 2,
// where its buffers feed the instanced quads directly.
//
// An emitter is one record of src/data/bf2017/fx/<Effect>.json
// (scripts/lib/bf2017-emitters.mjs). Its particles live in a pool shared by
// every running instance of the effect kind (one draw a kind): `n` slots,
// a ring the spawns walk round. Each slot is three vec4s, the layout the
// GPU's storage buffers and the quads' attributes share:
//   posAge  x, y, z (world), age (s)
//   velLife vx, vy, vz, lifetime (s; 0 never spawned)
//   extra   size at spawn, gravity (m/s², the draw applied), draw (0…1, the
//           rotation's and the start frame's), owner (the instance's index)
// A slot is dead when age ≥ lifetime; dead slots draw nothing.
//
// The spawns: the CPU decides how many each instance makes this frame
// (`spawnCount`: the burst, the rate over the emitter's life, the cap of
// MaxCount alive, the culling by MaxSpawnDistance) and hands the step a
// list of batches { owner, count }; the batches take consecutive slots from
// the ring's head. A particle's draws are hashes of its serial (curves.js's
// `rnd`), so the GPU, given the same head, serial and batches, spawns the
// same particle in the same slot without being sent it.
//
// The owners: per instance four vec4s, `OWNER` floats, the same layout as
// gpu.js's uniform array: position and scale; the quaternion (x, y, z, w);
// the velocity (for FollowSpawnSourceVelocity); the move since the last
// frame (for FollowSpawnSource: a following particle moves with its owner).
//
// The step, each live slot: v += (−g ŷ + drag (wind − v)) dt; p += v dt
// (+ the owner's move when the emitter follows); age += dt. Semi-implicit
// Euler at a fixed dt, the same sum on both sides.
//
// createPool(em, n, { seed }) → pool
// stepPool(pool, dt, { batches, batchCount, owners, wind }) → spawned
// spawnCount(state, em, dt, { scale, factor }) → how many this instance spawns
// spawnFactor(distance, em) → 0…1 (MaxSpawnDistance, ParticleCullingFactor)
// stretchLength(size, speed, stretch) → the quad's length along its motion
// wrapLight(nDotL, w) → the sun's term wrapped by LightWrapAroundFactor
// lifeMax(em) ; aliveCount(pool)

import { curveRange, evalCurve, rnd } from './curves.js';

export const OWNER = 16; // floats an owner: 4 vec4s
export const MAX_OWNERS = 32; // instances of one kind with particles at once (the GPU's uniform array)
// spawn batches an emitter takes a frame: one per running instance at most
export const MAX_BATCHES = MAX_OWNERS;
const DEG = Math.PI / 180;
const UP = [0, 1, 0];

// a pool's slots for one instance: MaxCount, or (a record without it) what
// the rate and the burst keep alive
export const perInstance = (em) => Math.max(1, Math.ceil(em.maxCount > 0 ? em.maxCount : curveRange(em.spawn?.rate ?? 0)[1] * lifeMax(em) + (em.spawn?.burst ?? 0)));

export const lifeMax = (em) => Math.max(1e-3, curveRange(em.lifetime)[1]);

export function createPool(em, n, { seed = 1 } = {}) {
  return {
    em,
    n,
    seed: seed >>> 0,
    head: 0,
    serial: 0,
    posAge: new Float32Array(n * 4),
    velLife: new Float32Array(n * 4),
    extra: new Float32Array(n * 4),
  };
}

// (a quaternion [x, y, z, w] turning v, written out as the TSL twin writes it)
function turn(qx, qy, qz, qw, vx, vy, vz, out) {
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out[0] = vx + qw * tx + (qy * tz - qz * ty);
  out[1] = vy + qw * ty + (qz * tx - qx * tz);
  out[2] = vz + qw * tz + (qx * ty - qy * tx);
  return out;
}

const tmp = [0, 0, 0];
const dirW = [0, 0, 0];

// The particle `serial` into `slot`, for owner `o`: the draws k = 0…8 are
// position (3), direction (2), speed, size, lifetime, gravity; 9 the
// rotation's and frame's draw. gpu.js's spawn is this line for line.
export function spawnParticle(pool, slot, serial, o, owners) {
  const { em, seed } = pool;
  const pos = em.spawn?.position;
  let lx = 0;
  let ly = 0;
  let lz = 0;
  if (pos?.box) {
    const { center, size } = pos.box;
    lx = center[0] + (rnd(seed, serial, 0) - 0.5) * size[0];
    ly = center[1] + (rnd(seed, serial, 1) - 0.5) * size[1];
    lz = center[2] + (rnd(seed, serial, 2) - 0.5) * size[2];
  } else if (pos?.sphere) {
    const z = 2 * rnd(seed, serial, 0) - 1;
    const phi = 2 * Math.PI * rnd(seed, serial, 1);
    const rad = pos.sphere.radius * Math.cbrt(rnd(seed, serial, 2));
    const s = Math.sqrt(Math.max(0, 1 - z * z));
    lx = s * Math.cos(phi) * rad;
    ly = z * rad;
    lz = s * Math.sin(phi) * rad;
  }
  // a direction within the spread's cone round the record's direction
  const dir = em.spawn?.direction?.dir ?? UP;
  const dx = dir[0];
  const dy = dir[1];
  const dz = dir[2];
  const cosMax = Math.cos((em.spawn?.direction?.spread ?? 0) * DEG);
  const cosT = 1 - rnd(seed, serial, 3) * (1 - cosMax);
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = 2 * Math.PI * rnd(seed, serial, 4);
  // (a basis round d: a = d × (up or x), b = d × a)
  const ux = Math.abs(dy) < 0.99 ? 0 : 1;
  const uy = Math.abs(dy) < 0.99 ? 1 : 0;
  let ax = dy * 0 - dz * uy;
  let ay = dz * ux - dx * 0;
  let az = dx * uy - dy * ux;
  const al = Math.hypot(ax, ay, az) || 1;
  ax /= al;
  ay /= al;
  az /= al;
  const bx = dy * az - dz * ay;
  const by = dz * ax - dx * az;
  const bz = dx * ay - dy * ax;
  const cp = Math.cos(phi) * sinT;
  const sp = Math.sin(phi) * sinT;
  const ddx = dx * cosT + ax * cp + bx * sp;
  const ddy = dy * cosT + ay * cp + by * sp;
  const ddz = dz * cosT + az * cp + bz * sp;
  const speed = evalCurve(em.spawn?.speed ?? 0, 0, rnd(seed, serial, 5));
  const size = evalCurve(em.spawn?.size ?? 1, 0, rnd(seed, serial, 6));
  const life = evalCurve(em.lifetime ?? 1, 0, rnd(seed, serial, 7));
  const g = em.gravity ? em.gravity.g * (1 + (2 * rnd(seed, serial, 8) - 1) * (em.gravity.random ?? 0)) : 0;
  // into the owner's frame
  const b = o * OWNER;
  const sc = owners[b + 3];
  const qx = owners[b + 4];
  const qy = owners[b + 5];
  const qz = owners[b + 6];
  const qw = owners[b + 7];
  turn(qx, qy, qz, qw, lx * sc, ly * sc, lz * sc, tmp);
  turn(qx, qy, qz, qw, ddx, ddy, ddz, dirW);
  const follow = em.follow?.velocity ? 1 : 0;
  const i = slot * 4;
  pool.posAge[i] = owners[b] + tmp[0];
  pool.posAge[i + 1] = owners[b + 1] + tmp[1];
  pool.posAge[i + 2] = owners[b + 2] + tmp[2];
  pool.posAge[i + 3] = 0;
  pool.velLife[i] = dirW[0] * speed + follow * owners[b + 8];
  pool.velLife[i + 1] = dirW[1] * speed + follow * owners[b + 9];
  pool.velLife[i + 2] = dirW[2] * speed + follow * owners[b + 10];
  pool.velLife[i + 3] = Math.max(1e-3, life);
  pool.extra[i] = size * sc;
  pool.extra[i + 1] = g;
  pool.extra[i + 2] = rnd(seed, serial, 9);
  pool.extra[i + 3] = o;
}

// Spawn the batches into the ring, then step every live slot. Returns how
// many were spawned (batches past MAX_BATCHES, and counts past the pool, are
// dropped: the GPU drops the same).
export function stepPool(pool, dt, { batches = [], batchCount = batches.length, owners, wind = null } = {}) {
  const { n, em } = pool;
  let total = 0;
  const nb = Math.min(batchCount, MAX_BATCHES);
  for (let k = 0; k < nb; k++) {
    const { owner, count } = batches[k];
    for (let j = 0; j < count && total < n; j++, total++) spawnParticle(pool, (pool.head + total) % n, pool.serial + total, owner, owners);
  }
  const drag = em.drag ?? 0;
  const wx = wind ? wind[0] : 0;
  const wy = wind ? wind[1] : 0;
  const wz = wind ? wind[2] : 0;
  const follows = em.follow?.source ? 1 : 0;
  const { posAge: p, velLife: v, extra: e } = pool;
  for (let s = 0; s < n; s++) {
    const i = s * 4;
    if (!(p[i + 3] < v[i + 3])) continue;
    v[i] += drag * (wx - v[i]) * dt;
    v[i + 1] += (-e[i + 1] + drag * (wy - v[i + 1])) * dt;
    v[i + 2] += drag * (wz - v[i + 2]) * dt;
    const ob = e[i + 3] * OWNER + 12;
    p[i] += v[i] * dt + follows * owners[ob];
    p[i + 1] += v[i + 1] * dt + follows * owners[ob + 1];
    p[i + 2] += v[i + 2] * dt + follows * owners[ob + 2];
    p[i + 3] += dt;
  }
  pool.head = (pool.head + total) % n;
  pool.serial = (pool.serial + total) >>> 0;
  return total;
}

export function aliveCount(pool) {
  let a = 0;
  for (let i = 0; i < pool.n * 4; i += 4) if (pool.posAge[i + 3] < pool.velLife[i + 3]) a++;
  return a;
}

// An instance's spawns this frame. state: { t, acc, burst } (its own, from
// { t: 0, acc: 0, burst: false }); the rate is the record's curve over the
// emitter's duration (its lifetime when the record gives none), held to
// MaxCount alive (rate ≤ MaxCount / longest life; no cap where the record
// gives none), both scaled by the tier, a random rate at its mean;
// `factor` the distance's thinning (spawnFactor). A non-looping emitter
// spawns for its duration only.
export function spawnCount(state, em, dt, { scale = 1, factor = 1 } = {}) {
  const duration = em.duration ?? lifeMax(em);
  let n = 0;
  if (!state.burst) {
    state.burst = true;
    n += Math.round((em.spawn?.burst ?? 0) * scale * factor);
  }
  const live = em.loop !== false || state.t < duration;
  if (live) {
    const t = em.loop !== false ? (state.t % duration) / duration : Math.min(1, state.t / duration);
    const rate = Math.min(Math.max(0, evalCurve(em.spawn?.rate ?? 0, t, 0.5)), em.maxCount > 0 ? em.maxCount / lifeMax(em) : Infinity);
    state.acc += rate * scale * factor * dt;
    const whole = Math.floor(state.acc);
    state.acc -= whole;
    n += whole;
  }
  state.t += dt;
  return n;
}

// Spawning thins past ParticleCullingFactor of MaxSpawnDistance and stops at
// it (the reading the PR states: the record names the two, not the ramp)
export function spawnFactor(distance, em) {
  const max = em.maxSpawnDistance;
  if (!(max > 0)) return 1;
  const from = max * (em.cullingFactor ?? 1);
  if (distance <= from) return 1;
  if (distance >= max) return 0;
  return (max - distance) / Math.max(1e-6, max - from);
}

// MotionStretchScreen: the quad's length along its velocity across the
// screen: the size plus the distance moved in MotionStretchMultiplier
// seconds, held between MotionStretchMinLength and MaxLength times the size
export function stretchLength(size, speed, stretch) {
  if (!stretch) return size;
  const len = size + speed * stretch.mult;
  return Math.min(size * (stretch.max ?? Infinity), Math.max(size * (stretch.min ?? 1), len));
}

// LightWrapAroundFactor: the sun's n·l wrapped, (n·l + w) / (1 + w), so a
// sprite edge-on or a little behind is still lit
export const wrapLight = (nDotL, w = 0) => Math.max(0, (nDotL + w) / (1 + w));

// ── ribbons: a trail of points behind each owner (EmittableType_Ribbon) ──
//
// A ribbon emitter keeps, per owner slot, a ring of MaxCount points
// (position, age). The newest point rides the owner; a new one is frozen
// behind it at SpawnRate a second, or sooner once the owner has moved
// RibbonSegmentLength metres, so a fast ship's contrail stays smooth. Every
// point ages; past the lifetime it is gone (sprites.js draws it at width 0).
//
// createTrails(em, slots) → trails ; stepTrails(trails, dt, owners, active, count)
//   active: the owner slots running this frame (`count` of them)
// trailPoint(trails, slot, k) → the ring index of the k-th newest point

export function createTrails(em, slots) {
  const m = Math.max(2, perInstance(em));
  return {
    em,
    slots,
    m,
    pos: new Float32Array(slots * m * 3),
    age: new Float32Array(slots * m).fill(Infinity),
    head: new Int32Array(slots),
    acc: new Float32Array(slots),
    last: new Float32Array(slots * 3),
    on: new Uint8Array(slots),
    life: lifeMax(em),
  };
}

export const trailPoint = (tr, slot, k) => slot * tr.m + ((tr.head[slot] - k + tr.m * 2) % tr.m);

const put3 = (arr, i, x, y, z) => {
  arr[i] = x;
  arr[i + 1] = y;
  arr[i + 2] = z;
};

export function stepTrails(tr, dt, owners, active = [], count = active.length) {
  const { m } = tr;
  for (let i = 0; i < tr.age.length; i++) tr.age[i] += dt;
  const rate = Math.max(0, evalCurve(tr.em.spawn?.rate ?? 0, 0, 0.5));
  const seg = tr.em.ribbon?.segment ?? Infinity;
  for (let s = 0; s < tr.slots; s++) {
    let a = 0;
    while (a < count && active[a] !== s) a++;
    if (a === count) {
      // (not running this frame: it stops following, its points age out)
      tr.on[s] = 0;
      continue;
    }
    const b = s * OWNER;
    const x = owners[b];
    const y = owners[b + 1];
    const z = owners[b + 2];
    if (!tr.on[s]) {
      // a fresh trail: every point dead, a frozen point and the head on the owner
      // (every point on the owner, so a dead one's wedge has no area)
      for (let k = 0; k < m; k++) {
        tr.age[s * m + k] = Infinity;
        put3(tr.pos, (s * m + k) * 3, x, y, z);
      }
      tr.on[s] = 1;
      tr.acc[s] = 0;
      put3(tr.last, s * 3, x, y, z);
      put3(tr.pos, (s * m + tr.head[s]) * 3, x, y, z);
      tr.age[s * m + tr.head[s]] = 0;
      tr.head[s] = (tr.head[s] + 1) % m;
    } else {
      tr.acc[s] += rate * dt;
      const moved = Math.hypot(x - tr.last[s * 3], y - tr.last[s * 3 + 1], z - tr.last[s * 3 + 2]);
      if (tr.acc[s] >= 1 || moved >= seg) {
        // the head frozen on the owner where it is now, a new head beside it
        tr.acc[s] = Math.max(0, Math.min(1, tr.acc[s] - 1));
        put3(tr.pos, (s * m + tr.head[s]) * 3, x, y, z);
        tr.age[s * m + tr.head[s]] = 0;
        tr.head[s] = (tr.head[s] + 1) % m;
        put3(tr.last, s * 3, x, y, z);
      }
    }
    const h = s * m + tr.head[s];
    put3(tr.pos, h * 3, x, y, z);
    tr.age[h] = 0;
  }
}
