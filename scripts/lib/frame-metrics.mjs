// The frame scores in Node (the GPU-first design’s G1): PSNR and SSIM of a
// candidate against a reference, and the reference itself made by
// averaging jittered shots in linear light. Pure, on raw pixels as sharp
// hands them over: { data, width, height, channels }. FLIP, the score the
// design gates on, is NVIDIA’s Python tool (scripts/frame-score.mjs runs it
// where it is installed); these are what is left where it is not.
//
// psnr(a, b) → dB over red, green and blue (Infinity when the same)
// ssim(a, b, { window = 8 }) → the mean SSIM of the BT.709 luma over every
//   window × window square (a uniform window, Wang et al. 2004’s constants)
// averageLinear(images) → { data, width, height, channels: 3 }
// toLinear(byte) → 0…1; toSrgb8(linear) → byte

const K1 = 0.01; // _source: Wang, Bovik, Sheikh and Simoncelli 2004, “Image quality assessment: from error visibility to structural similarity”, eq. 7
const K2 = 0.03; // _source: the same paper, eq. 9
const L = 255;
const C1 = (K1 * L) ** 2;
const C2 = (K2 * L) ** 2;
const WINDOW = 8; // _source: this file: 8 × 8, the paper’s block size before its Gaussian (11 × 11) refinement; integral images make any size the same cost

const same = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) throw new Error(`two sizes: ${a.width}×${a.height} and ${b.width}×${b.height}`);
};

export function psnr(a, b) {
  same(a, b);
  const n = a.width * a.height;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) {
      const d = a.data[i * a.channels + c] - b.data[i * b.channels + c];
      sq += d * d;
    }
  }
  const mse = sq / (n * 3);
  return mse === 0 ? Infinity : 10 * Math.log10((L * L) / mse);
}

// (BT.709’s luma weights on the encoded values, as SSIM is usually taken)
const luma = (img) => {
  const n = img.width * img.height;
  const out = new Float64Array(n);
  const ch = img.channels;
  for (let i = 0; i < n; i++) {
    const r = img.data[i * ch];
    const g = ch > 1 ? img.data[i * ch + 1] : r;
    const b = ch > 2 ? img.data[i * ch + 2] : r;
    out[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return out;
};

// a summed-area table, one row and column of zeros before the picture
const integral = (w, h, at) => {
  const t = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += at(y * w + x);
      t[(y + 1) * (w + 1) + x + 1] = t[y * (w + 1) + x + 1] + row;
    }
  }
  return t;
};

export function ssim(a, b, { window = WINDOW } = {}) {
  same(a, b);
  const { width: w, height: h } = a;
  const k = Math.max(1, Math.min(window, w, h));
  const x = luma(a);
  const y = luma(b);
  const sx = integral(w, h, (i) => x[i]);
  const sy = integral(w, h, (i) => y[i]);
  const sxx = integral(w, h, (i) => x[i] * x[i]);
  const syy = integral(w, h, (i) => y[i] * y[i]);
  const sxy = integral(w, h, (i) => x[i] * y[i]);
  const W = w + 1;
  const box = (t, x0, y0) => t[(y0 + k) * W + x0 + k] - t[y0 * W + x0 + k] - t[(y0 + k) * W + x0] + t[y0 * W + x0];
  const n = k * k;
  let sum = 0;
  let count = 0;
  for (let y0 = 0; y0 + k <= h; y0++) {
    for (let x0 = 0; x0 + k <= w; x0++) {
      const mx = box(sx, x0, y0) / n;
      const my = box(sy, x0, y0) / n;
      // (the window’s own spread: the population variance and covariance)
      const vx = box(sxx, x0, y0) / n - mx * mx;
      const vy = box(syy, x0, y0) / n - my * my;
      const cxy = box(sxy, x0, y0) / n - mx * my;
      sum += ((2 * mx * my + C1) * (2 * cxy + C2)) / ((mx * mx + my * my + C1) * (vx + vy + C2));
      count++;
    }
  }
  return sum / count;
}

// IEC 61966-2-1’s sRGB transfer, both ways
export const toLinear = (byte) => {
  const v = byte / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const toSrgb8 = (lin) => {
  const v = lin <= 0.0031308 ? lin * 12.92 : 1.055 * lin ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

// The shots averaged as light adds (in linear), not as bytes do: an edge
// half covered is half its light, which in sRGB bytes is 188 of 255
export function averageLinear(images) {
  if (!images?.length) throw new Error('nothing to average');
  const [first] = images;
  for (const img of images) same(first, img);
  const n = first.width * first.height;
  const LUT = Float64Array.from({ length: 256 }, (_, v) => toLinear(v));
  const acc = new Float64Array(n * 3);
  for (const img of images) for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) acc[i * 3 + c] += LUT[img.data[i * img.channels + c]];
  const data = new Uint8Array(n * 3);
  for (let i = 0; i < acc.length; i++) data[i] = toSrgb8(acc[i] / images.length);
  return { data, width: first.width, height: first.height, channels: 3 };
}
