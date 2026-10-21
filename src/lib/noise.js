// Noise for the worlds' ground: value noise on a grid, smooth between its
// corners, summed over octaves (fbm), folded into ridges (ridged), and a
// seeded random for placing things. All of it pure and the same every time
// for the same seed, so a world is laid out the same for everyone who lands
// on it (and online, in the same place for each of them).

// a number 0…1 from two integers and a seed (a hash: no tables to build)
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// value noise, -1…1, about one bump per unit
export function noise2(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fade(fx);
  const v = fade(fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}

// octaves of it, each twice as fine and `gain` as strong; -1…1 (about)
export function fbm(x, y, { octaves = 5, gain = 0.5, lacunarity = 2, seed = 0 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, y * f, seed + i * 17);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

// sharp crests and soft valleys (mountain ridges, dune crests): 0…1
export function ridged(x, y, { octaves = 5, gain = 0.5, lacunarity = 2, seed = 0 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  let prev = 1;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise2(x * f, y * f, seed + i * 31));
    const r = n * n * prev;
    prev = n;
    sum += amp * r;
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

// a seeded random, 0…1 (mulberry32)
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const lerp = (a, b, t) => a + (b - a) * t;
