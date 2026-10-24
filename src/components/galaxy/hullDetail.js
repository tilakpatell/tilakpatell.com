// A capital ship's hull detail, as the films' models and the game's kits
// have it, baked once into one tiling map (capitalPlating.js lays it over
// every capital's hull in metres): the plates, the panels each plate is
// cut into, and the small parts on those, with every kind of panel the
// films' kitbashing gives a Star Destroyer: plain, raised, sunk, ribbed,
// slatted vents, a hatch's ring, a grid of small squares, boxes and pipes.
// A map, not worked out pixel by pixel on the hull, so the GPU's mipmaps
// keep its detail as the hull goes off into the distance, where a pattern
// worked out on the hull would have to fade to flat or glitter.
//
// bakeDetail(size) → Uint8Array (size × size, RGBA), a square TILE metres
// on a side that tiles:
//   R, G: the slope of the hull's height across (u) and up (v), ±2 about
//         the middle (127.5): the light catching every bevel and groove;
//   B:    the paint's shade, ±0.5 about the middle (each plate its own grey,
//         the seams' dark lines);
//   A:    the cavity, 0 to 1: how deep in a groove or at a raised part's
//         foot, where the light from all round doesn't reach.
// Pure (no three.js), so a worker can bake it (hullDetail.worker.js).

// metres a tile is: the plates (26 × 13), the panels (a plate in 4 × 4),
// the small parts (a panel in 4 × 4) all fit it whole
export const TILE = 208;
const A = [26, 13];
const ROWS = TILE / A[1];

const hash = (a, b, c) => {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1440662683);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// the panels' kinds, by a dice (the share of each, in order)
export const KINDS = [
  ['vent', 0.07],
  ['ribbed', 0.1],
  ['raised', 0.13],
  ['squares', 0.08],
  ['sunk', 0.07],
  ['hatch', 0.05],
  ['parts', 0.22],
  ['plain', 0.28],
];
const kindOf = (d) => {
  let at = 0;
  for (const [k, share] of KINDS) {
    at += share;
    if (d < at) return k;
  }
  return 'plain';
};

// one point of the tile, (x, y) in metres: its height (m) and its shade
function point(x, y, px, out) {
  // the plate: its row staggered as brickwork
  const rowA = Math.floor(y / A[1]) % ROWS;
  const u = (((x + hash(rowA, 7, 1) * A[0]) % TILE) + TILE) % TILE;
  const colA = Math.floor(u / A[0]);
  const fxA = u - colA * A[0];
  const fyA = y - rowA * A[1];
  const eA = Math.min(fxA, A[0] - fxA, fyA, A[1] - fyA);
  const plate = hash(colA, rowA, 3);
  const plate2 = hash(colA, rowA, 5);
  // (a seam: a groove a pixel and a half wide at the least, its edges bevelled)
  const seamA = 1 - smooth(0, Math.max(0.16, px * 1.6), eA);
  let h = -0.12 * seamA;
  let shade = (plate - 0.5) * 0.18 + (plate2 > 0.88 ? 0.16 : plate2 < 0.1 ? -0.16 : 0) - 0.22 * seamA;
  // the panels: the plate in four by four, a pair now and then one, or (a
  // plate in five) the plate one panel whole
  if (plate2 >= 0.2) {
    const rowB = Math.floor(fyA / (A[1] / 4));
    let colB = Math.floor(fxA / (A[0] / 4));
    let wB = A[0] / 4;
    if (hash(colA * 4 + (colB >> 1), rowA * 4 + rowB, 11) < 0.3) {
      colB >>= 1;
      wB *= 2;
    }
    const hB = A[1] / 4;
    const fxB = fxA - colB * wB;
    const fyB = fyA - rowB * hB;
    const eB = Math.min(fxB, wB - fxB, fyB, hB - fyB);
    const id = [colA * 4 + colB, rowA * 4 + rowB];
    const panel = hash(id[0], id[1], 13);
    const seamB = 1 - smooth(0, Math.max(0.08, px * 1.5), eB);
    h -= 0.05 * seamB;
    shade += (panel - 0.5) * 0.08 - 0.12 * seamB;
    const inside = smooth(0.12, 0.3, eB);
    const kind = kindOf(hash(id[0], id[1], 17));
    if (kind === 'vent') {
      const s = Math.abs((fyB / 0.3) % 1 - 0.5);
      const slot = (1 - smooth(0.18, 0.28, s)) * inside;
      h -= 0.06 * slot;
      shade -= 0.14 * slot + 0.04 * inside;
    } else if (kind === 'ribbed') {
      h += 0.025 * (0.5 + 0.5 * Math.cos((2 * Math.PI * fxB) / 0.45)) * inside;
    } else if (kind === 'raised') {
      h += 0.07 * inside;
      shade += 0.03 * inside;
    } else if (kind === 'sunk') {
      h -= 0.05 * inside;
      shade -= 0.04 * inside;
    } else if (kind === 'hatch') {
      const d = Math.hypot(fxB - wB / 2, fyB - hB / 2);
      const r = hB * 0.34;
      h -= 0.04 * (1 - smooth(0, Math.max(0.1, px * 1.5), Math.abs(d - r)));
      h += 0.02 * (1 - smooth(r - 0.15, r, d));
    } else if (kind === 'squares' || kind === 'parts') {
      // the small parts: the panel in four by four
      const wC = wB / 4;
      const hC = hB / 4;
      const colC = Math.floor(fxB / wC);
      const rowC = Math.floor(fyB / hC);
      const fxC = fxB - colC * wC;
      const fyC = fyB - rowC * hC;
      const eC = Math.min(fxC, wC - fxC, fyC, hC - fyC);
      const part = hash(id[0] * 4 + colC, id[1] * 4 + rowC, 19);
      if (kind === 'squares') {
        h -= 0.025 * (1 - smooth(0, Math.max(0.05, px * 1.5), eC)) * inside;
        shade += (part - 0.5) * 0.05 * inside;
      } else if (part > 0.55) {
        // a box, or (a long one) a pipe along it, each its own height
        const tall = 0.04 + (part - 0.55) * 0.5;
        const pipe = part > 0.9;
        const rise = pipe ? Math.sqrt(Math.max(0, 1 - ((fyC - hC / 2) / (hC * 0.4)) ** 2)) : smooth(0, Math.max(0.1, px * 1.5), eC);
        h += tall * rise * inside;
        shade += (hash(id[0] * 4 + colC, id[1] * 4 + rowC, 23) - 0.5) * 0.08 * inside;
      }
    }
  } else if (plate2 < 0.08) h += 0.05 * smooth(0.3, 0.6, eA); // (a plate raised whole)
  out[0] = h;
  out[1] = shade;
}

export function bakeDetail(size) {
  const m = TILE / size; // metres a pixel
  const n = size * size;
  const height = new Float32Array(n);
  const shade = new Float32Array(n);
  const p = [0, 0];
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      point((i + 0.5) * m, (j + 0.5) * m, m, p);
      height[j * size + i] = p[0];
      shade[j * size + i] = p[1];
    }
  }
  // the cavity: how far under its surroundings' mean a point is (a box blur
  // a few pixels wide, along each way in turn, wrapping as the tile does)
  const r = Math.max(2, Math.round(0.45 / m));
  const blur = (src, along) => {
    const out = new Float32Array(n);
    const w = 2 * r + 1;
    for (let a = 0; a < size; a++) {
      let sum = 0;
      const at = (b) => (along ? a * size + ((b + size) % size) : ((b + size) % size) * size + a);
      for (let b = -r; b <= r; b++) sum += src[at(b)];
      for (let b = 0; b < size; b++) {
        out[at(b)] = sum / w;
        sum += src[at(b + r + 1)] - src[at(b - r)];
      }
    }
    return out;
  };
  const mean = blur(blur(height, true), false);
  const px = new Uint8Array(n * 4);
  const byte = (v) => Math.max(0, Math.min(255, Math.round(v)));
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      const gx = (height[j * size + ((i + 1) % size)] - height[j * size + ((i - 1 + size) % size)]) / (2 * m);
      const gy = (height[((j + 1) % size) * size + i] - height[((j - 1 + size) % size) * size + i]) / (2 * m);
      const cav = Math.min(1, Math.max(0, (mean[k] - height[k]) * 7));
      px[k * 4] = byte(127.5 + Math.max(-2, Math.min(2, gx)) * 63.75);
      px[k * 4 + 1] = byte(127.5 + Math.max(-2, Math.min(2, gy)) * 63.75);
      px[k * 4 + 2] = byte(127.5 + Math.max(-0.5, Math.min(0.5, shade[k])) * 255);
      px[k * 4 + 3] = byte(cav * 255);
    }
  }
  return px;
}
