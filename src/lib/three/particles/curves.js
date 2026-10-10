// The emitter tables' curves and the particles' seeded draws, pure, so the
// CPU step (emitter.js), the GPU twin (gpu.js, which writes the same in TSL)
// and the tests agree to the bit where they can.
//
// A curve (scripts/lib/bf2017-emitters.mjs writes them): a number; a cubic
// over the particle's normalised life `{ poly: [x, y, z, w], min, max,
// scale }`, x·t³ + y·t² + z·t + w held to min…max (null: unbounded) then
// times scale (the game's `PolynomialData`); a table of even samples over
// 0…1, read linearly (`{ table: [...] }`, a `SplineData` sampled); or a draw
// per particle `{ random: [min, max] }` (`RandomEvaluatorData`).
//
// evalCurve(curve, t, r) → the value at t (0…1); r (0…1) the particle's draw
// curveRange(curve) → [min, max] over t in 0…1 and every draw
// pcg(v) → a 32-bit hash (PCG's output function: Jarzynski and Olano, 2020)
// rnd(seed, serial, k) → 0…1, the k-th draw of particle `serial`: the same
//   integers the TSL twin hashes, so a seeded spawn is the same on both

export function evalCurve(c, t = 0, r = 0) {
  if (typeof c === 'number') return c;
  if (!c) return 0;
  if (c.poly) {
    const [x, y, z, w] = c.poly;
    const v = ((x * t + y) * t + z) * t + w;
    return Math.min(c.max ?? Infinity, Math.max(c.min ?? -Infinity, v)) * (c.scale ?? 1);
  }
  if (c.table) {
    const n = c.table.length - 1;
    const f = Math.min(n, Math.max(0, t * n));
    const i = Math.min(n - 1, Math.floor(f));
    return c.table[i] + (c.table[i + 1] - c.table[i]) * (f - i);
  }
  if (c.random) return c.random[0] + (c.random[1] - c.random[0]) * r;
  return 0;
}

export function curveRange(c) {
  if (typeof c === 'number') return [c, c];
  if (c?.random) return [Math.min(...c.random), Math.max(...c.random)];
  if (c?.table) return [Math.min(...c.table), Math.max(...c.table)];
  if (c?.poly) {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i <= 32; i++) {
      const v = evalCurve(c, i / 32);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    return [lo, hi];
  }
  return [0, 0];
}

// (unsigned 32-bit arithmetic: Math.imul wraps as WGSL's and GLSL's u32 do)
export function pcg(v) {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> (((state >>> 28) + 4) >>> 0)) ^ state) >>> 0, 277803737) >>> 0;
  return ((word >>> 22) ^ word) >>> 0;
}

// 24 bits to a float in 0…1: exact in a float32, so the twin gets the same number
export const rnd = (seed, serial, k) => (pcg((pcg((seed + serial) >>> 0) + k) >>> 0) >>> 8) / 16777216;
