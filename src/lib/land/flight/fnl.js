// One configured FastNoiseLite per use, behind a function of (x, z), so the
// class is named in this file only (docs/stack/fastnoise-lite.md). Seeds are
// 32-bit: a planet's bigint is folded, its low 32 bits xor its high 32.
//
// A generated planet's round ground samples the same noise in 3D, at a point
// on its sphere (characters.js), so nothing there has a seam or a pole.
//
// Pure: runs in Node and in the flight's terrain worker.
//
//   noiseFor(seed, { type, frequency, octaves, lacunarity, gain, fractal, warp }) → (x, z) → −1…1
//   noise3For(seed, the same options) → (x, y, z) → −1…1
//   cells3For(seed, { frequency, jitter = 1 }) → (x, y, z) → distance to the nearest cell point, ≥ 0
//   fold(seed: bigint | number) → int32

import FastNoiseLite from 'fastnoise-lite';

export const fold = (seed) => (typeof seed === 'bigint' ? Number((seed ^ (seed >> 32n)) & 0xffffffffn) | 0 : seed | 0);

const TYPES = {
  simplex: FastNoiseLite.NoiseType.OpenSimplex2,
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
  const wx = make(s ^ 0x5bd1e995, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wz = make(s ^ 0x27d4eb2f, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  return (x, z) => n.GetNoise(x + wx.GetNoise(x, z) * warp, z + wz.GetNoise(x, z) * warp);
}

// GetNoise reads its arguments' count: three are 3D, so every call passes all
// three. The 3D warp is noiseFor's made the same way, a third noise for y.
export function noise3For(seed, { type = 'simplex', frequency = 0.01, octaves = 4, lacunarity = 2, gain = 0.5, fractal = 'fbm', warp = 0 } = {}) {
  const s = fold(seed);
  const n = make(s, type, frequency, fractal, octaves, lacunarity, gain);
  if (!warp) return (x, y, z) => n.GetNoise(x, y, z);
  const wx = make(s ^ 0x5bd1e995, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wy = make(s ^ 0x165667b1, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  const wz = make(s ^ 0x27d4eb2f, 'simplex', frequency * 0.5, 'fbm', 3, 2, 0.5);
  return (x, y, z) => n.GetNoise(x + wx.GetNoise(x, y, z) * warp, y + wy.GetNoise(x, y, z) * warp, z + wz.GetNoise(x, y, z) * warp);
}

// The class's cellular Distance is the Euclidean distance to the nearest
// jittered cell point, in cells, less 1; adding the 1 back reads it from 0.
export function cells3For(seed, { frequency = 0.01, jitter = 1 } = {}) {
  const n = make(fold(seed), 'cellular', frequency, 'none', 1, 2, 0.5);
  n.SetCellularDistanceFunction(FastNoiseLite.CellularDistanceFunction.Euclidean);
  n.SetCellularReturnType(FastNoiseLite.CellularReturnType.Distance);
  n.SetCellularJitter(jitter);
  return (x, y, z) => n.GetNoise(x, y, z) + 1;
}
