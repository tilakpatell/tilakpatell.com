// A building's far copy: a box its size wearing pictures of its five outer
// faces (its four sides and its roof), drawn from its own textured
// triangles on the CPU, an orthographic picture a face, into one square
// atlas. Ten triangles stand in for twenty thousand past the full model's
// distance: the city kit's buildings simplified as a tree is tore their
// walls open, and simplified to keep them stayed at four fifths
// (import.mjs's LOD1, `facade` in a pack's `lod`).
//
//   FACES: the five, each its outward normal and its picture's right and up
//   facadeOf(tris, { size = 1024, most = 20 }) → { rgba, size, density,
//     box: { positions, normals, uvs, indices } }
//     tris: [{ p: [ax, ay, az, bx, by, bz, cx, cy, cz], uv: [au, av, bu, bv,
//       cu, cv], tex: { rgba, w, h } | null, colour: [r, g, b, a] (0–1),
//       cut: an alpha cutoff, or null for opaque }]
//     size: the atlas's side in pixels; most: its pixels a metre at most
//     (fewer if the five faces won't fit)
//     A triangle is pictured on a face it looks out of (its winding's
//     normal toward the face's), the nearest at each pixel; a pixel no
//     triangle reaches takes its neighbours' colour, or the face's own.

export const FACES = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
];
const PAD = 2; // pixels round each face's picture, against bleeding

const dot = (a, i, d) => a[i] * d[0] + a[i + 1] * d[1] + a[i + 2] * d[2];
const frac = (x) => x - Math.floor(x);

// the box round every triangle
function boundsOf(tris) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris)
    for (let i = 0; i < 9; i++) {
      lo[i % 3] = Math.min(lo[i % 3], t.p[i]);
      hi[i % 3] = Math.max(hi[i % 3], t.p[i]);
    }
  return { lo, hi };
}
const corners = ({ lo, hi }) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [k & 1 ? hi[0] : lo[0], k & 2 ? hi[1] : lo[1], k & 4 ? hi[2] : lo[2]]);

// each face's rectangle in its own picture's terms: its right and up spans
// and how far out its plane is
function rectsOf(box) {
  const cs = corners(box).flat();
  const span = (d) => {
    let a = Infinity;
    let b = -Infinity;
    for (let i = 0; i < cs.length; i += 3) {
      a = Math.min(a, dot(cs, i, d));
      b = Math.max(b, dot(cs, i, d));
    }
    return [a, b];
  };
  return FACES.map((f) => ({ ...f, us: span(f.u), vs: span(f.v), out: span(f.n)[1] }));
}

// shelves across the atlas, tallest first; null if they won't fit
function pack(rects, density, size) {
  const items = rects.map((r, i) => ({ i, w: Math.ceil((r.us[1] - r.us[0]) * density) + 2 * PAD, h: Math.ceil((r.vs[1] - r.vs[0]) * density) + 2 * PAD })).sort((a, b) => b.h - a.h);
  const at = [];
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const it of items) {
    if (it.w > size) return null;
    if (x + it.w > size) {
      y += shelf;
      x = 0;
      shelf = 0;
    }
    if (y + it.h > size) return null;
    at[it.i] = { x, y, w: it.w, h: it.h };
    x += it.w;
    shelf = Math.max(shelf, it.h);
  }
  return at;
}

// a texel's colour times the material's (nearest, the map repeating)
function sample(t, u, v, out) {
  const [r, g, b, a] = t.colour;
  if (!t.tex) {
    out[0] = r;
    out[1] = g;
    out[2] = b;
    out[3] = a;
    return;
  }
  const { rgba, w, h } = t.tex;
  const k = (Math.min(h - 1, Math.floor(frac(v) * h)) * w + Math.min(w - 1, Math.floor(frac(u) * w))) * 4;
  out[0] = (rgba[k] / 255) * r;
  out[1] = (rgba[k + 1] / 255) * g;
  out[2] = (rgba[k + 2] / 255) * b;
  out[3] = (rgba[k + 3] / 255) * a;
}

// one face's picture: every triangle that looks out of it, nearest first
function picture(tris, r, density, w, h) {
  const colour = new Float32Array(w * h * 3);
  const depth = new Float32Array(w * h).fill(Infinity);
  const got = new Float32Array(4);
  for (const t of tris) {
    const p = t.p;
    // (its winding's normal, toward the face's or not)
    const e1 = [p[3] - p[0], p[4] - p[1], p[5] - p[2]];
    const e2 = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
    const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    if (g[0] * r.n[0] + g[1] * r.n[1] + g[2] * r.n[2] <= 0) continue;
    // its corners in pixels across and down the picture, and how deep
    const px = [0, 3, 6].map((i) => (dot(p, i, r.u) - r.us[0]) * density);
    const py = [0, 3, 6].map((i) => (r.vs[1] - dot(p, i, r.v)) * density);
    const pd = [0, 3, 6].map((i) => r.out - dot(p, i, r.n));
    const area = (px[1] - px[0]) * (py[2] - py[0]) - (px[2] - px[0]) * (py[1] - py[0]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...px)));
    const x1 = Math.min(w - 1, Math.ceil(Math.max(...px)));
    const y0 = Math.max(0, Math.floor(Math.min(...py)));
    const y1 = Math.min(h - 1, Math.ceil(Math.max(...py)));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const sx = x + 0.5;
        const sy = y + 0.5;
        const b0 = ((px[1] - sx) * (py[2] - sy) - (px[2] - sx) * (py[1] - sy)) / area;
        const b1 = ((px[2] - sx) * (py[0] - sy) - (px[0] - sx) * (py[2] - sy)) / area;
        const b2 = 1 - b0 - b1;
        if (b0 < 0 || b1 < 0 || b2 < 0) continue;
        const d = b0 * pd[0] + b1 * pd[1] + b2 * pd[2];
        const k = y * w + x;
        if (d >= depth[k]) continue;
        sample(t, b0 * t.uv[0] + b1 * t.uv[2] + b2 * t.uv[4], b0 * t.uv[1] + b1 * t.uv[3] + b2 * t.uv[5], got);
        if (t.cut != null && got[3] < t.cut) continue;
        depth[k] = d;
        colour[k * 3] = got[0];
        colour[k * 3 + 1] = got[1];
        colour[k * 3 + 2] = got[2];
      }
  }
  // (what no triangle reached: its neighbours' colour, a few pixels in, then the face's own)
  const filled = Uint8Array.from(depth, (d) => (d < Infinity ? 1 : 0));
  for (let pass = 0; pass < 6; pass++) {
    const was = filled.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const k = y * w + x;
        if (was[k]) continue;
        let n = 0;
        const sum = [0, 0, 0];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const q = (y + dy) * w + x + dx;
          if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h || !was[q]) continue;
          for (let c = 0; c < 3; c++) sum[c] += colour[q * 3 + c];
          n++;
        }
        if (!n) continue;
        for (let c = 0; c < 3; c++) colour[k * 3 + c] = sum[c] / n;
        filled[k] = 1;
      }
  }
  const mean = [0, 0, 0];
  let n = 0;
  for (let k = 0; k < w * h; k++)
    if (filled[k]) {
      for (let c = 0; c < 3; c++) mean[c] += colour[k * 3 + c];
      n++;
    }
  for (let k = 0; k < w * h; k++) if (!filled[k]) for (let c = 0; c < 3; c++) colour[k * 3 + c] = n ? mean[c] / n : 0.5;
  return colour;
}

export function facadeOf(tris, { size = 1024, most = 20 } = {}) {
  const box = boundsOf(tris);
  const rects = rectsOf(box);
  // (the most pixels a metre that fits, halving toward it)
  let lo = 0;
  let hi = most;
  if (pack(rects, most, size)) lo = most;
  else
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (pack(rects, mid, size)) lo = mid;
      else hi = mid;
    }
  const density = lo;
  const at = pack(rects, density, size);
  const rgba = new Uint8Array(size * size * 4);
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  rects.forEach((r, i) => {
    const { x, y, w, h } = at[i];
    const iw = w - 2 * PAD;
    const ih = h - 2 * PAD;
    const pic = picture(tris, r, density, iw, ih);
    // (the picture into the atlas, its edge pixels out into the pad)
    for (let j = 0; j < h; j++)
      for (let k = 0; k < w; k++) {
        const sx = Math.min(iw - 1, Math.max(0, k - PAD));
        const sy = Math.min(ih - 1, Math.max(0, j - PAD));
        const q = (sy * iw + sx) * 3;
        const o = ((y + j) * size + x + k) * 4;
        for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(Math.min(1, Math.max(0, pic[q + c])) * 255);
        rgba[o + 3] = 255;
      }
    // its quad, corners from the bottom left round, the way it looks out
    const base = positions.length / 3;
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]) {
      const uu = r.us[a];
      const vv = r.vs[b];
      for (let c = 0; c < 3; c++) positions.push(r.u[c] * uu + r.v[c] * vv + r.n[c] * r.out);
      normals.push(...r.n);
      uvs.push((x + PAD + (uu - r.us[0]) * density) / size, (y + PAD + (r.vs[1] - vv) * density) / size);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  return { rgba, size, density, box: { positions: new Float32Array(positions), normals: new Float32Array(normals), uvs: new Float32Array(uvs), indices: new Uint16Array(indices) } };
}
