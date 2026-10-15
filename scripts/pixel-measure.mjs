// The universe polish audit's measure of a picture, as a script, so each
// lane's before and after are counted the same way
// (docs/research/2026-10-08-universe-polish-audit.md):
//
//   node scripts/pixel-measure.mjs <image>[@x0,y0,x1,y1] ...
//
// Luminance is Rec. 709 of the sRGB bytes, 0…1 (not linearised: it's what
// the eye is shown). For each image: the median, the 10th and 90th
// percentiles, the share of pixels under 0.02 (the floor) and under 0.05,
// and the bright points (a pixel over 0.6 that's the brightest of its
// 3 × 3 and 0.25 over their mean: a star, not the edge of a planet). With a
// crop (the ship's box, in pixels, the right and bottom edges not in it):
// its mean and standard deviation, and the mean of the ring 40 px round it,
// so a ship's separation from what's behind it is a number.
//
// measure({ data, width, height, channels }, crop?) → the numbers (pure;
// the CLI reads the image with sharp).
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RING = 40;
const r3 = (v) => Number(v.toFixed(3));

function luminanceOf({ data, width, height, channels }) {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * channels;
    lum[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  }
  return lum;
}

const statsOf = (values) => {
  const n = values.length || 1;
  let sum = 0;
  for (const v of values) sum += v;
  const mean = sum / n;
  let sq = 0;
  for (const v of values) sq += (v - mean) * (v - mean);
  return { mean, sd: Math.sqrt(sq / n) };
};

export function measure(image, crop = null) {
  const { width: w, height: h } = image;
  const lum = luminanceOf(image);
  const sorted = Float32Array.from(lum).sort();
  const n = sorted.length;
  const at = (q) => sorted[Math.min(n - 1, Math.floor(n * q))];
  let under2 = 0;
  let under5 = 0;
  for (const v of lum) {
    if (v < 0.02) under2++;
    if (v < 0.05) under5++;
  }
  let points = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = lum[y * w + x];
      if (v <= 0.6) continue;
      let top = true;
      let around = 0;
      for (let dy = -1; dy <= 1 && top; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const u = lum[(y + dy) * w + x + dx];
          if (u > v) {
            top = false;
            break;
          }
          around += u;
        }
      }
      if (top && v - around / 8 > 0.25) points++;
    }
  }
  const out = { width: w, height: h, median: r3(at(0.5)), p10: r3(at(0.1)), p90: r3(at(0.9)), under002: r3(under2 / n), under005: r3(under5 / n), points };
  if (crop) {
    const [x0, y0, x1, y1] = crop.map((v) => Math.round(v));
    const inside = [];
    const ring = [];
    for (let y = Math.max(0, y0 - RING); y < Math.min(h, y1 + RING); y++) {
      for (let x = Math.max(0, x0 - RING); x < Math.min(w, x1 + RING); x++) {
        (x >= x0 && x < x1 && y >= y0 && y < y1 ? inside : ring).push(lum[y * w + x]);
      }
    }
    const c = statsOf(inside);
    out.crop = { box: [x0, y0, x1, y1], mean: r3(c.mean), sd: r3(c.sd), ring: r3(statsOf(ring).mean) };
  }
  return out;
}

export async function measureFile(path, crop = null) {
  const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return measure({ data, width: info.width, height: info.height, channels: info.channels }, crop);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const items = process.argv.slice(2);
  if (!items.length) {
    console.log('node scripts/pixel-measure.mjs <image>[@x0,y0,x1,y1] ...');
    process.exit(1);
  }
  for (const item of items) {
    const [path, box] = item.split('@');
    const crop = box ? box.split(',').map(Number) : null;
    if (crop && (crop.length !== 4 || crop.some((v) => !Number.isFinite(v)))) throw new Error(`a crop is x0,y0,x1,y1 (${item})`);
    console.log(JSON.stringify({ image: path, ...(await measureFile(path, crop)) }));
  }
}
