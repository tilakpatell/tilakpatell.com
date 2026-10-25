// One configured FastNoiseLite per use, behind a function of (x, z), or of
// (x, y, z) for a round planet's ground (characters.js), so the class is
// named in this file only (docs/stack/fastnoise-lite.md). Seeds are 32-bit:
// a planet's bigint is folded, its low 32 bits xor its high 32.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   noiseFor(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp }) → (x, z) → −1…1
//   noise3For(seed, the same options) → (x, y, z) → −1…1 (its type 'smooth'
//     unless asked: OpenSimplex2S, which has no steps)
//   cells3For(seed, { frequency, jitter = 1 }) → (x, y, z) → distance ≥ 0, in cells
//   fold(seed: bigint | number) → int32

import FastNoiseLite from 'fastnoise-lite';

export const fold = (seed) => (typeof seed === 'bigint' ? Number((seed ^ (seed >> 32n)) & 0xffffffffn) | 0 : seed | 0);

const TYPES = {
  simplex: FastNoiseLite.NoiseType.OpenSimplex2,
  // OpenSimplex2S: the 3D default, as the fast one steps where its corners tie
  smooth: FastNoiseLite.NoiseType.OpenSimplex2S,
  cellular: FastNoiseLite.NoiseType.Cellular,
  perlin: FastNoiseLite.NoiseType.Perlin,
  value: FastNoiseLite.NoiseType.Value,
};
const FRACTALS = {
  fbm: FastNoiseLite.FractalType.FBm,
  ridged: FastNoiseLite.FractalType.Ridged,
  pingpong: FastNoiseLite.FractalType.PingPong,
  none: FastNoiseLite.FractalType.None,
};

// the warp's own salts, so it never runs along the noise it pushes
const WARP_X = 0x5bd1e995;
const WARP_Y = 0x1b873593;
const WARP_Z = 0x27d4eb2f;

const make = (seed, type, frequency, fractal, octaves, lacunarity, gain) => {
  const n = new FastNoiseLite(seed);
  n.SetNoiseType(TYPES[type]);
  n.SetFrequency(frequency);
  n.SetFractalType(FRACTALS[fractal]);
  n.SetFractalOctaves(octaves);
  n.SetFractalLacunarity(lacunarity);
  n.SetFractalGain(gain);
  return n;
};

export function noiseFor(seed, { type = 'simplex', frequency = 0.01, octaves = 4, lacunarity = 2, gain = 0.5, fractal = 'fbm', warp = 0 } = {}) {
  const s = fold(seed);
  const n = make(s, type, frequency, fractal, octaves, lacunarity, gain);
  if (!warp) return (x, z) => n.GetNoise(x, z);
  // The warp is two more noises at half the frequency pushing (x, z) by up
  // to `warp` metres. Not the class's own DomainWrap: in 1.1.1 it checks its
  // argument against a Vector2 class the package doesn't export, so a plain
  // { x, y } goes through unwarped and nothing says so.
  const wx = make(s ^ WARP_X, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wz = make(s ^ WARP_Z, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  return (x, z) => n.GetNoise(x + wx.GetNoise(x, z) * warp, z + wz.GetNoise(x, z) * warp);
}

// noiseFor's twin in 3D: a round planet's ground is a function of the
// direction, so it has no seam and it wraps. The warp is three noises, one an
// axis, at half the frequency, for the same reason as the 2D one.
//
// Its simplex is the smooth kind, OpenSimplex2S. The fast OpenSimplex2 in 3D
// reads four corners, and where two are equally near (on the planes y = z,
// x = y, x = z and their like) it takes one by a comparison, so the value
// steps by up to 0.006 across them: a metre or more on a ridge, and one of
// those planes is a great circle through the poles of every planet.
export function noise3For(seed, { type = 'smooth', frequency = 0.01, octaves = 4, lacunarity = 2, gain = 0.5, fractal = 'fbm', warp = 0 } = {}) {
  const s = fold(seed);
  const n = make(s, type, frequency, fractal, octaves, lacunarity, gain);
  if (!warp) return (x, y, z) => n.GetNoise(x, y, z);
  const wx = make(s ^ WARP_X, 'smooth', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wy = make(s ^ WARP_Y, 'smooth', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wz = make(s ^ WARP_Z, 'smooth', frequency * 0.5, 'fbm', 3, 2, 0.5);
  return (x, y, z) => n.GetNoise(x + wx.GetNoise(x, y, z) * warp, y + wy.GetNoise(x, y, z) * warp, z + wz.GetNoise(x, y, z) * warp);
}

// The distance from a point to the nearest of a jittered lattice of points,
// in cells (one cell is 1 / frequency): the craters' bowls. The class's
// Distance return is that less 1, and its default distance is the squared
// one, so the wrapper asks for the Euclidean and adds the 1 back.
export function cells3For(seed, { frequency = 0.01, jitter = 1 } = {}) {
  const n = make(fold(seed), 'cellular', frequency, 'none', 1, 2, 0.5);
  n.SetCellularDistanceFunction(FastNoiseLite.CellularDistanceFunction.Euclidean);
  n.SetCellularReturnType(FastNoiseLite.CellularReturnType.Distance);
  n.SetCellularJitter(jitter);
  return (x, y, z) => n.GetNoise(x, y, z) + 1;
}
