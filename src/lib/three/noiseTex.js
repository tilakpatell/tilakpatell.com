// A tile of noise for the shaders to read instead of working it out per
// pixel: four channels of smooth noise that wrap at the tile's edges, each
// finer than the last (r: 4 bumps across the tile, g: 8, b: 16, a: 32), so
// a shader samples it at a few scales for the cost of a few lookups. Made
// once and shared. (Moved down from galaxy/surface: the flight's ground
// wears the same shader.)

import * as THREE from 'three';
import { hash2 } from '../noise.js';

const N = 256;
let shared = null;

// value noise on a lattice that repeats every `period` cells
function tiled(x, y, period, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const w = (i) => ((i % period) + period) % period;
  const a = hash2(w(ix), w(iy), seed);
  const b = hash2(w(ix + 1), w(iy), seed);
  const c = hash2(w(ix), w(iy + 1), seed);
  const d = hash2(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// a channel: a few octaves from `base` cells across the tile
function channel(base, seed) {
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0;
      let amp = 0.5;
      let norm = 0;
      for (let o = 0; o < 4; o++) {
        const cells = base << o;
        s += amp * tiled((x / N) * cells, (y / N) * cells, cells, seed + o * 13);
        norm += amp;
        amp *= 0.5;
      }
      out[y * N + x] = s / norm;
    }
  return out;
}

export function noiseTexture() {
  if (shared) return shared;
  const data = new Uint8Array(N * N * 4);
  const chans = [channel(4, 3), channel(8, 7), channel(16, 11), channel(32, 17)];
  for (let i = 0; i < N * N; i++) for (let c = 0; c < 4; c++) data[i * 4 + c] = Math.round(chans[c][i] * 255);
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  shared = t;
  return t;
}
