// Painting textures in code for the 3D games, so nothing is downloaded:
// seeded noise that tiles (a texture repeats down a road without a seam),
// cells for cracks, cobbles and scales, and a few canvas helpers. The
// painters for each game live beside it; the normal maps come from
// ./texture.js.

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (i, p) => ((i % p) + p) % p;

// An integer hash of a lattice point, to [0, 1).
function hash3(x, y, seed) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise: n(x, y, period) in [0, 1], smooth, repeating every `period`
// units in x and y (an integer; leave it out for no repeat).
export function makeNoise(seed = 1) {
  const s = seed | 0;
  return (x, y, period = 0) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const p = period | 0;
    const x0 = p ? wrap(xi, p) : xi;
    const y0 = p ? wrap(yi, p) : yi;
    const x1 = p ? wrap(xi + 1, p) : xi + 1;
    const y1 = p ? wrap(yi + 1, p) : yi + 1;
    const a = hash3(x0, y0, s);
    const b = hash3(x1, y0, s);
    const c = hash3(x0, y1, s);
    const d = hash3(x1, y1, s);
    return mix(mix(a, b, fx), mix(c, d, fx), fy);
  };
}

// Octaves of noise, finer and fainter each time; still in [0, 1], and still
// tiling when the period is an integer.
export function fbm(noise, x, y, { period = 0, octaves = 4, gain = 0.5 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * f, y * f, period * f) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

// The same noise with a period of its own each way: n(x, y, px, py)
// repeats every `px` units in x and `py` in y (integers), so a texture whose
// grain is long one way and fine the other, as wood's is, still tiles. Its
// own function, so the common noise above pays nothing for it.
export function makeNoiseXY(seed = 1) {
  const s = seed | 0;
  return (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = fade(x - xi);
    const fy = fade(y - yi);
    const x0 = wrap(xi, px);
    const y0 = wrap(yi, py);
    const x1 = wrap(xi + 1, px);
    const y1 = wrap(yi + 1, py);
    return mix(mix(hash3(x0, y0, s), hash3(x1, y0, s), fx), mix(hash3(x0, y1, s), hash3(x1, y1, s), fx), fy);
  };
}

// fbm over makeNoiseXY's noise, tiling at px × py
export function fbmXY(noise, x, y, { px, py, octaves = 4, gain = 0.5 }) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x * f, y * f, px * f, py * f) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

// Ridged noise: sharp creases where the noise crosses its middle (veins,
// cracks in mud, ridgelines).
export const ridge = (noise, x, y, opts) => 1 - Math.abs(fbm(noise, x, y, opts) * 2 - 1);

// Cells (Worley noise): one jittered point per unit square. Returns the
// distance to the nearest point (f1), the next (f2), and an id in [0, 1) for
// the nearest cell, so each cell can be painted its own shade.
export function makeCells(seed = 1) {
  const s = seed | 0;
  return (x, y, period = 0) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let f1 = 9;
    let f2 = 9;
    let id = 0;
    const p = period | 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = p ? wrap(xi + i, p) : xi + i;
        const cy = p ? wrap(yi + j, p) : yi + j;
        const px = xi + i + hash3(cx, cy, s);
        const py = yi + j + hash3(cx, cy, s + 977);
        const d = Math.hypot(px - x, py - y);
        if (d < f1) {
          f2 = f1;
          f1 = d;
          id = hash3(cx, cy, s + 4099);
        } else if (d < f2) f2 = d;
      }
    }
    return { f1, f2, id };
  };
}

// ── canvas helpers (browser only) ──

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Fill a canvas pixel by pixel: fn(u, v, out) writes 0..255 into out[0..3]
// for each texel, with u and v in [0, 1).
export function paintPixels(canvas, fn) {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 255];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[3] = 255;
      fn(x / w, y / h, out, x, y);
      const i = (y * w + x) * 4;
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
      d[i + 3] = out[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// A tangent-space normal map from a height field (Float32Array, w × h, in
// 0..1), wrapping at the edges so a tiled texture shows no seam.
export function normalFromField(field, w, h, strength = 2) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const H = (x, y) => field[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = -(H(x + 1, y) - H(x - 1, y)) * strength;
      const ny = (H(x, y + 1) - H(x, y - 1)) * strength; // canvas rows run down, texture v up
      const len = Math.hypot(nx, ny, 1);
      const i = (y * w + x) * 4;
      d[i] = (nx / len) * 127.5 + 127.5;
      d[i + 1] = (ny / len) * 127.5 + 127.5;
      d[i + 2] = (1 / len) * 127.5 + 127.5;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// A grey canvas from a field in 0..1 (roughness, metalness, masks).
export function greyFromField(field, w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const v = clamp01(field[i]) * 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// '#rrggbb' to [r, g, b] in 0..255
export const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// A colour between stops ([t, [r, g, b]] sorted by t) at t.
export function ramp(stops, t) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, a] = stops[i - 1];
      const [t1, b] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)];
    }
  }
  return stops[stops.length - 1][1];
}

// Draw on a canvas so the drawing wraps at the edges: fn runs once for each
// of the nine copies a shape near an edge could need.
export function tiled(ctx, w, h, fn) {
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      ctx.save();
      ctx.translate(dx, dy);
      fn(ctx);
      ctx.restore();
    }
  }
}
