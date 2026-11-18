// The nebulae's gas, a tiling 3D noise volume made in code (nothing is
// downloaded): value noise on an integer lattice, one lattice of random
// values an octave, interpolated smoothly. Octave o wraps every
// period · 2^o cells, so the whole volume tiles under RepeatWrapping and a
// cloud can sample it at any scale without a seam.
//
// noiseVolume(size, seed) → Uint8Array(size³ · 2): R the gas, G the colour
// mix and dust (another seed), each stretched to the whole 0…255. Made once
// a size and seed.

const lattices = new Map();

// one lattice of n³ random values, seeded (mulberry32)
function lattice(n, seed) {
  const key = `${n}:${seed}`;
  let l = lattices.get(key);
  if (l) return l;
  l = new Float32Array(n * n * n);
  let a = (seed * 0x9e3779b1 + n * 0x85ebca6b) >>> 0;
  for (let i = 0; i < l.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    l[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  lattices.set(key, l);
  return l;
}

const fade = (t) => t * t * (3 - 2 * t);
// a lattice's side is a power of two (period · 2^o), so a wrap is a mask;
// any other side wraps by modulo
const wrap = (i, n) => ((n & (n - 1)) === 0 ? i & (n - 1) : ((i % n) + n) % n);

function value(l, n, x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const x0 = wrap(xi, n), x1 = wrap(xi + 1, n);
  const y0 = wrap(yi, n) * n, y1 = wrap(yi + 1, n) * n;
  const z0 = wrap(zi, n) * n * n, z1 = wrap(zi + 1, n) * n * n;
  const a = l[z0 + y0 + x0] + (l[z0 + y0 + x1] - l[z0 + y0 + x0]) * u;
  const b = l[z0 + y1 + x0] + (l[z0 + y1 + x1] - l[z0 + y1 + x0]) * u;
  const c = l[z1 + y0 + x0] + (l[z1 + y0 + x1] - l[z1 + y0 + x0]) * u;
  const d = l[z1 + y1 + x0] + (l[z1 + y1 + x1] - l[z1 + y1 + x0]) * u;
  const e = a + (b - a) * v;
  return e + (c + (d - c) * v - e) * w;
}

// fractal value noise, 0…1, wrapping every `period` units
export function fbm3(x, y, z, { period = 4, octaves = 4, seed = 1 } = {}) {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    const n = period * f;
    sum += amp * value(lattice(n, seed + o * 101), n, x * f, y * f, z * f);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

const volumes = new Map();

export function noiseVolume(size, seed = 1) {
  const key = `${size}:${seed}`;
  const made = volumes.get(key);
  if (made) return made;
  const period = 4;
  const n = size ** 3;
  const raw = [new Float32Array(n), new Float32Array(n)];
  for (let c = 0; c < 2; c++) {
    const r = raw[c];
    // fbm3's sum, its lattices fetched once (a Map's lookup a voxel was most of the time)
    const ls = [0, 1, 2, 3].map((o) => lattice(period << o, seed + c + o * 101));
    for (let k = 0, i = 0; k < size; k++)
      for (let j = 0; j < size; j++)
        for (let h = 0; h < size; h++, i++) {
          const x = (h / size) * period, y = (j / size) * period, z = (k / size) * period;
          r[i] = (0.5 * value(ls[0], period, x, y, z) + 0.25 * value(ls[1], period * 2, x * 2, y * 2, z * 2) + 0.125 * value(ls[2], period * 4, x * 4, y * 4, z * 4) + 0.0625 * value(ls[3], period * 8, x * 8, y * 8, z * 8)) / 0.9375;
        }
  }
  // each channel stretched to the whole range, so the shader's thresholds have it all
  const out = new Uint8Array(n * 2);
  for (let c = 0; c < 2; c++) {
    const r = raw[c];
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { lo = Math.min(lo, r[i]); hi = Math.max(hi, r[i]); }
    const k = 255 / Math.max(hi - lo, 1e-6);
    for (let i = 0; i < n; i++) out[i * 2 + c] = Math.round((r[i] - lo) * k);
  }
  volumes.set(key, out);
  return out;
}
