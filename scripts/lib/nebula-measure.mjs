// What scripts/nebula-check.mjs measures of its shots, pure (no browser), so
// it is tested on made-up frames (./nebula-measure.test.mjs):
//
// diffMask({ on, off, width, height }, threshold = 12) → Uint8Array
//   1 where two RGBA frames' luminance differs by more than the threshold:
//   the nebulae drawn and not, so the mask is the clouds alone
// centroid(mask, width, { about, radius }?) → { x, y, n }: the mask's
//   middle, in pixels, and how many it holds, within `radius` of `about`
//   when given (one cloud of two in view); { 0, 0, 0 } for none, never NaN
// bestRotation(a, b, { width, height, about, to = about, radius, range = 60, step = 1 }) → degrees
//   the turn (clockwise on the screen, y down, positive) that best takes
//   image a, turned about `about`, onto b about `to`: every pixel of b
//   within `radius` of `to`, against a sampled bilinearly, scored by the
//   mean absolute difference; the first best from −range up. An image is
//   RGBA (width × height × 4, read as luminance) or one value a pixel.

const lumAt = (d, i) => 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];

// one luminance a pixel, whichever an image came as
export function luminance(img, width, height) {
  const n = width * height;
  if (img.length === n) return img;
  if (img.length !== n * 4) throw new RangeError(`an image of ${img.length} values isn’t ${width} × ${height}, RGBA or one a pixel`);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = lumAt(img, i);
  return out;
}

export function diffMask({ on, off, width, height }, threshold = 12) {
  const a = luminance(on, width, height);
  const b = luminance(off, width, height);
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = Math.abs(a[i] - b[i]) > threshold ? 1 : 0;
  return mask;
}

export function centroid(mask, width, { about = null, radius = Infinity } = {}) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const px = i % width;
    const py = Math.floor(i / width);
    if (about && (px - about[0]) ** 2 + (py - about[1]) ** 2 > radius * radius) continue;
    x += px;
    y += py;
    n++;
  }
  return n ? { x: x / n, y: y / n, n } : { x: 0, y: 0, n: 0 };
}

// (bilinear; outside the frame reads as 0, as the black of space)
function sample(img, width, height, x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const at = (i, j) => (i < 0 || j < 0 || i >= width || j >= height ? 0 : img[j * width + i]);
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bottom * fy;
}

export function bestRotation(a, b, { width, height, about, to = about, radius, range = 60, step = 1 }) {
  const la = luminance(a, width, height);
  const lb = luminance(b, width, height);
  // b's pixels within the radius, once
  const near = [];
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(to[1] - radius)); y <= Math.min(height - 1, Math.ceil(to[1] + radius)); y++) {
    for (let x = Math.max(0, Math.floor(to[0] - radius)); x <= Math.min(width - 1, Math.ceil(to[0] + radius)); x++) {
      const dx = x - to[0];
      const dy = y - to[1];
      if (dx * dx + dy * dy <= r2) near.push(dx, dy, lb[y * width + x]);
    }
  }
  if (!near.length) return 0;
  let best = 0;
  let bestScore = Infinity;
  const steps = Math.round((2 * range) / step);
  for (let k = 0; k <= steps; k++) {
    const deg = -range + k * step;
    const t = (deg * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    let sum = 0;
    for (let i = 0; i < near.length; i += 3) {
      // where in a this pixel of b came from: turned back by deg
      const dx = near[i];
      const dy = near[i + 1];
      sum += Math.abs(sample(la, width, height, about[0] + c * dx + s * dy, about[1] - s * dx + c * dy) - near[i + 2]);
    }
    const score = sum / (near.length / 3);
    if (score < bestScore) {
      bestScore = score;
      best = deg;
    }
  }
  return best === 0 ? 0 : best;
}
