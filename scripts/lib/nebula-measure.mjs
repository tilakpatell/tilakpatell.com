// What scripts/nebula-check.mjs measures in its shots, on plain pixel
// buffers (RGBA, row by row), so it is tested without a browser:
//
// diffMask({ on, off, width, height }, threshold) → Uint8Array: 1 where the
//   two frames' luminance differs by more than threshold (the nebula drawn
//   against the same frame without it)
// centroid(mask, width) → { x, y, n }: where the mask's pixels are, and how
//   many; { 0, 0, 0 } for none
// bestRotation(a, b, { width, height, about, radius, range, step }) → degrees:
//   the turn about `about` that best takes luminance image a onto b inside
//   `radius` (the least mean absolute difference, sampled bilinearly)

const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

export function diffMask({ on, off, width, height }, threshold = 12) {
  const m = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) m[p] = Math.abs(lum(on, p * 4) - lum(off, p * 4)) > threshold ? 1 : 0;
  return m;
}

export function centroid(mask, width) {
  let x = 0, y = 0, n = 0;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    x += p % width;
    y += Math.floor(p / width);
    n++;
  }
  return n ? { x: x / n, y: y / n, n } : { x: 0, y: 0, n: 0 };
}

// luminance at a fractional pixel, bilinear; 0 outside the frame
function sample(d, width, height, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return 0;
  const fx = x - x0, fy = y - y0;
  const at = (i, j) => lum(d, (j * width + i) * 4);
  const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
  const bot = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
  return top * (1 - fy) + bot * fy;
}

export function bestRotation(a, b, { width, height, about, radius, range = 60, step = 1 }) {
  const [cx, cy] = about;
  let best = 0, bestScore = Infinity;
  const r2 = radius * radius;
  for (let deg = -range; deg <= range + 1e-9; deg += step) {
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    let sum = 0, n = 0;
    for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(height - 1, Math.ceil(cy + radius)); y++)
      for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(width - 1, Math.ceil(cx + radius)); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r2) continue;
        // b at (x, y) is a turned by deg: where it came from in a
        const ax = cx + dx * c + dy * s, ay = cy - dx * s + dy * c;
        sum += Math.abs(lum(b, (y * width + x) * 4) - sample(a, width, height, ax, ay));
        n++;
      }
    const score = n ? sum / n : Infinity;
    if (score < bestScore - 1e-9 || (Math.abs(score - bestScore) <= 1e-9 && Math.abs(deg) < Math.abs(best))) {
      bestScore = score;
      best = Math.round(deg / step) * step;
    }
  }
  return best;
}

// largestBlob(mask, width, height) → the mask's largest 4-connected part
// alone (the cloud; not a star that twinkled between the two shots)
export function largestBlob(mask, width, height) {
  const label = new Int32Array(mask.length);
  const stack = [];
  let best = 0, bestSize = 0, next = 0;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p] || label[p]) continue;
    const id = ++next;
    let size = 0;
    label[p] = id;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop();
      size++;
      const x = q % width, y = (q - x) / width;
      for (const n of [x > 0 ? q - 1 : -1, x < width - 1 ? q + 1 : -1, y > 0 ? q - width : -1, y < height - 1 ? q + width : -1])
        if (n >= 0 && mask[n] && !label[n]) {
          label[n] = id;
          stack.push(n);
        }
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }
  const out = new Uint8Array(mask.length);
  if (best) for (let p = 0; p < mask.length; p++) out[p] = label[p] === best ? 1 : 0;
  return out;
}
