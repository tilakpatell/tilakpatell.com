// The noise the nebulae are marched through: a small 3D volume made in code,
// so nothing is downloaded for it. Pure (no three.js, no DOM), so it runs in
// Node; index.js puts it in a Data3DTexture under RepeatWrapping, and it
// tiles, so a cloud of any size can read it at any scale without a seam.
//
// fbm3(x, y, z, { period, octaves, seed }) → 0…1: value noise, octaves summed
//   at halving strength. Octave o reads a lattice of random values
//   period · 2^o cells a side that wraps, so the sum repeats every period in
//   x, y and z. Each lattice is drawn once, from the seed, and read between
//   its eight corners with a smoothstep weight (a plain trilinear weight
//   leaves creases at the cells' faces, which a march shows as a grid); no
//   corner is hashed as it's read, which keeps a 64³ volume quick.
// noiseVolume(size, seed) → Uint8Array(size³ · 2), x fastest, then y, then z
//   (a Data3DTexture's order), two channels a voxel:
//     R  the gas, fbm3 at seed
//     G  the colour mix and the dust, fbm3 at seed + 1
//   Voxel (i, j, k) reads fbm3 at (i, j, k) / size · period, so the volume
//   tiles too. Each channel is stretched from its own least to its most onto
//   0…255, so the shader's thresholds have the whole range. Made once a
//   size and seed; the same array comes back after (don't write to it).
//
// A seed is a whole number: a fraction is cut to its whole part, and what
// isn't a number reads as 0.

const PERIOD = 4;
const OCTAVES = 4;

// splitmix32's finish: a seed's octaves, and seeds next to each other, start
// their draws far apart
const mix = (h) => {
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  return (h ^ (h >>> 15)) >>> 0;
};

const lattices = new Map();
function latticeOf(n, seed, o) {
  const key = `${n}:${seed}:${o}`;
  let lat = lattices.get(key);
  if (!lat) {
    lat = new Float32Array(n * n * n);
    let s = mix(mix(seed) + o + 1);
    for (let i = 0; i < lat.length; i++) {
      s = (s + 0x9e3779b9) | 0;
      lat[i] = mix(s) / 4294967296;
    }
    lattices.set(key, lat);
  }
  return lat;
}

const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// the eight corners' blend, a to d being the four rows' starts (y0 z0, y1
// z0, y0 z1, y1 z1); both paths below read through it, so the volume is
// fbm3 to the last bit
function corners(lat, a, b, c, d, x0, x1, u, v, w) {
  return lerp(
    lerp(lerp(lat[a + x0], lat[a + x1], u), lerp(lat[b + x0], lat[b + x1], u), v),
    lerp(lerp(lat[c + x0], lat[c + x1], u), lerp(lat[d + x0], lat[d + x1], u), v),
    w,
  );
}

// a coordinate in an octave's own cells → its two lattice planes (wrapped)
// and the weight between them
function cellOf(x, n) {
  const f = Math.floor(x);
  const i0 = ((f % n) + n) % n;
  return [i0, (i0 + 1) % n, fade(x - f)];
}

function levelsOf(period, octaves, seed) {
  const p = Math.max(1, Math.round(period) || PERIOD);
  const count = Math.max(1, Math.round(octaves) || OCTAVES);
  const s = Math.trunc(Number(seed)) | 0;
  const levels = [];
  let norm = 0;
  for (let o = 0, f = 1, amp = 1; o < count; o++, f *= 2, amp /= 2) {
    levels.push({ lat: latticeOf(p * f, s, o), n: p * f, f, amp });
    norm += amp;
  }
  return { levels, norm };
}

export function fbm3(x, y, z, { period = PERIOD, octaves = OCTAVES, seed = 1 } = {}) {
  const { levels, norm } = levelsOf(period, octaves, seed);
  let sum = 0;
  for (const { lat, n, f, amp } of levels) {
    const [x0, x1, u] = cellOf(x * f, n), [y0, y1, v] = cellOf(y * f, n), [z0, z1, w] = cellOf(z * f, n);
    const a = (y0 + z0 * n) * n, b = (y1 + z0 * n) * n, c = (y0 + z1 * n) * n, d = (y1 + z1 * n) * n;
    sum += amp * corners(lat, a, b, c, d, x0, x1, u, v, w);
  }
  return sum / norm;
}

// (every voxel's coordinates are one of size values an axis, so each
// octave's planes and weights are worked out once a value, not once a voxel)
function tableOf(size, n, f) {
  const i0 = new Int32Array(size), i1 = new Int32Array(size), t = new Float64Array(size);
  for (let q = 0; q < size; q++) [i0[q], i1[q], t[q]] = cellOf(((q / size) * PERIOD) * f, n);
  return { i0, i1, t };
}

const volumes = new Map();
export function noiseVolume(size, seed = 1) {
  if (!(Number.isInteger(size) && size > 0)) throw new TypeError(`A noise volume's side must be a whole number over 0, not ${size}.`);
  const s = Math.trunc(Number(seed)) | 0;
  const key = `${size}:${s}`;
  const made = volumes.get(key);
  if (made) return made;
  const out = new Uint8Array(size ** 3 * 2);
  const raw = new Float64Array(size ** 3);
  for (const ch of [0, 1]) {
    const { levels, norm } = levelsOf(PERIOD, OCTAVES, s + ch);
    raw.fill(0);
    // (an octave at a time, summed in fbm3's order, then over norm as it does)
    for (const { lat, n, f, amp } of levels) {
      const { i0, i1, t } = tableOf(size, n, f);
      for (let k = 0, i = 0; k < size; k++) {
        const z0 = i0[k] * n, z1 = i1[k] * n, w = t[k];
        for (let j = 0; j < size; j++, i += size) {
          const a = (i0[j] + z0) * n, b = (i1[j] + z0) * n, c = (i0[j] + z1) * n, d = (i1[j] + z1) * n, v = t[j];
          for (let q = 0; q < size; q++) raw[i + q] += amp * corners(lat, a, b, c, d, i0[q], i1[q], t[q], v, w);
        }
      }
    }
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < raw.length; i++) {
      const v = (raw[i] /= norm);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = hi > lo ? hi - lo : 1;
    for (let i = 0; i < raw.length; i++) out[i * 2 + ch] = Math.round(((raw[i] - lo) / span) * 255);
  }
  volumes.set(key, out);
  return out;
}
