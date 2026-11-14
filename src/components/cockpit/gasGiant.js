// Yavin, the gas giant Red Squadron flies over: bands of rust, ochre and
// cream, ragged where they meet, with a storm or two, painted into a canvas
// as the X-wing is built (no picture to fetch, nothing borrowed from the
// universe map's planets, whose maps are their own worlds'). The colour is
// a pure function of where on the map a pixel is (bandColor, tested); the
// painter (gasGiantMap) runs it over a canvas.
//
// bandColor(u, v, { seed, palette }) → [r, g, b], 0…255: u the longitude
//   (0…1, wrapping), v the latitude (0 the north pole, 1 the south)
// gasGiantMap({ w, h, seed, palette }) → THREE.CanvasTexture (sRGB, wrapping in u)

import * as THREE from 'three';

// Yavin Prime as A New Hope shows it from orbit: warm, banded, darker at the poles
export const YAVIN = ['#6e321c', '#9c4a26', '#c46c36', '#dc9454', '#efc488', '#b65e33', '#86401f', '#d28245', '#e8b070'];

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const fract = (x) => x - Math.floor(x);
const smooth = (t) => t * t * (3 - 2 * t);
// (a value noise from a hash: smooth, seeded, the same every time)
const hash = (i, seed) => fract(Math.sin(i * 127.1 + seed * 311.7) * 43758.5453);
function noise1(x, seed) {
  const i = Math.floor(x);
  return hash(i, seed) + (hash(i + 1, seed) - hash(i, seed)) * smooth(x - i);
}
// (wrapping every `period` in x, so the map meets itself round the sphere with no seam)
function noise2(x, y, seed, period) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const i0 = ((i % period) + period) % period;
  const i1 = (i0 + 1) % period;
  const a = hash(i0 + j * 1013, seed);
  const b = hash(i1 + j * 1013, seed);
  const c = hash(i0 + (j + 1) * 1013, seed);
  const d = hash(i1 + (j + 1) * 1013, seed);
  const fx = smooth(x - i);
  const fy = smooth(y - j);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

const BANDS = 17;
const cache = new Map();
const colours = (palette) => {
  if (!cache.has(palette)) cache.set(palette, palette.map(hex));
  return cache.get(palette);
};

export function bandColor(u, v, { seed = 7, palette = YAVIN } = {}) {
  const pal = colours(palette);
  const lat = Math.min(1, Math.max(0, v));
  const lon = fract(u);
  // where the bands meet, they roll: the latitude pushed about along the
  // longitude, more in the band edges' turbulent belts than in their middles
  const belt = 0.35 + 0.65 * noise1(lat * 9, seed + 3);
  const roll = (Math.sin(lon * Math.PI * 2 * 3 + lat * 31) * 0.5 + (noise2(lon * 24, lat * 60, seed, 24) - 0.5)) * 0.018 * belt;
  const f = (lat + roll) * BANDS + noise1(lat * 34, seed) * 0.8;
  const k = Math.floor(f);
  const t = smooth(fract(f));
  const n = pal.length;
  const a = pal[(((k * 5 + seed) % n) + n) % n];
  const b = pal[((((k + 1) * 5 + seed) % n) + n) % n];
  // fine streaks along the longitude, and the poles in shadow
  const streak = 0.9 + 0.2 * noise2(lon * 180, lat * 700, seed + 11, 180);
  const pole = 0.7 + 0.3 * Math.sin(lat * Math.PI);
  const k2 = streak * pole;
  return [0, 1, 2].map((c) => Math.round(Math.min(255, Math.max(0, (a[c] + (b[c] - a[c]) * t) * k2))));
}

// A storm: an oval a band's height, lighter, its edge a ring of the band's dark
function storm(px, w, h, { u, v, rx, ry }) {
  const x0 = Math.floor((u - rx) * w);
  const x1 = Math.ceil((u + rx) * w);
  const y0 = Math.floor((v - ry) * h);
  const y1 = Math.ceil((v + ry) * h);
  for (let y = Math.max(0, y0); y < Math.min(h, y1); y++)
    for (let xx = x0; xx < x1; xx++) {
      const x = ((xx % w) + w) % w;
      const dx = (xx / w - u) / rx;
      const dy = (y / h - v) / ry;
      const d = Math.hypot(dx, dy);
      if (d >= 1) continue;
      const i = (y * w + x) * 4;
      const swirl = 0.5 + 0.5 * Math.sin(Math.atan2(dy, dx) * 3 + d * 9);
      const lift = d > 0.82 ? 0.82 : 1.12 + 0.08 * swirl * (1 - d);
      for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, px[i + c] * lift);
    }
}

export function gasGiantMap({ w = 1024, h = 512, seed = 7, palette = YAVIN } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const img = g.createImageData(w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const [r, gg, b] = bandColor((x + 0.5) / w, v, { seed, palette });
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = gg;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  storm(px, w, h, { u: 0.31, v: 0.62, rx: 0.045, ry: 0.032 });
  storm(px, w, h, { u: 0.74, v: 0.41, rx: 0.025, ry: 0.018 });
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}
