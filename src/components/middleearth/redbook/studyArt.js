// The study’s surfaces, painted in code: each texel its colour, its height
// and how rough it is, so the oak, the plaster, the hearth’s stones and the
// mithril take the light of the fire, the candles, the lantern and Sting as
// they move (the height becomes a normal map, the roughness a map of where
// it shines). The bookcase and the sign are painted with the brush
// (./brush.js) and get their relief from their own shading. Each is a
// function of its size, so a tier halves it; the ones that repeat tile
// without a seam. A surface is { map, normal, rough }; with `relief` false,
// or no image data to paint into (the tests’ canvas), only the map.
//
//   wood(w, h, opts), panels(w, h), plaster(w), floorboards(w), vault(w, h),
//   stones(w), mithril(w), brass(w), door(w), rug(w), beads(w) → a surface
//   shelfArt(w, h), signArt(w, h), runesArt(w, h), rainArt(w) → a canvas;
//   paneArt(w) → { map, glow }; reliefOf(canvas, strength) → its normal map

import { clamp01, fbm, fbmXY, greyFromField, makeCanvas, makeCells, makeNoise, makeNoiseXY, normalFromField, smooth } from '../../../lib/paint';
import { CARD, brush, oval, rand, shade, tint } from './brush';

const TAU = Math.PI * 2;
const frac = (x) => x - Math.floor(x);
// a stable number in [0, 1) for an integer (a board, a stone, a ring)
const hash = (i, s = 0) => frac(Math.sin(i * 127.1 + s * 311.7) * 43758.5453);
// the nearest way round a tile of n from a to b
const wrapped = (d, n) => d - n * Math.round(d / n);

// a surface texel by texel: fn(u, v, out) sets out.c ([r, g, b], 0–255),
// out.h (its height, 0–1) and out.rough (0–1). `strength` is the relief’s
// at `ref` texels wide, kept the same at any size.
function surface(w, h, fn, { relief = true, strength = 2, ref = w } = {}) {
  const map = makeCanvas(w, h);
  const ctx = map.getContext('2d');
  const img = ctx.createImageData?.(w, h);
  if (!img?.data) return { map, normal: null, rough: null };
  const height = relief ? new Float32Array(w * h) : null;
  const rough = relief ? new Float32Array(w * h) : null;
  const out = { c: [0, 0, 0], h: 0.5, rough: 0.8 };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      out.h = 0.5;
      out.rough = 0.8;
      fn(x / w, y / h, out);
      const i = y * w + x;
      img.data[i * 4] = out.c[0];
      img.data[i * 4 + 1] = out.c[1];
      img.data[i * 4 + 2] = out.c[2];
      img.data[i * 4 + 3] = 255;
      if (relief) {
        height[i] = out.h;
        rough[i] = out.rough;
      }
    }
  ctx.putImageData(img, 0, 0);
  if (!relief) return { map, normal: null, rough: null };
  return { map, normal: normalFromField(height, w, h, strength * (w / ref)), rough: greyFromField(rough, w, h) };
}

const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// wood, its grain along u (or v, `upright`): rings that wander, fine fibres,
// and with `boards` a run of planks across, each its own shade, a rounded
// seam between (`seam` of a board’s width), their ends staggered (`ends` to
// a board) and nailed. It tiles
// (`period`: the grain’s wander in u, v). `varnish` shines; bare wood is dull.
export function wood(w, h, { tone = [66, 42, 26], seed = 17, rings = 7, boards = 0, seam: gap = 0.07, ends = 0, nails = false, upright = false, varnish = false, period = [2, 6], relief = true } = {}) {
  const noise = makeNoiseXY(seed);
  const fibres = makeNoiseXY(seed + 7);
  const [px, py] = period;
  // (each board’s own shade, grain, end joints and knot, worked out once)
  const plank = Array.from({ length: Math.max(1, boards) }, (_, id) => ({
    shade: 0.9 + hash(id, 1) * 0.2,
    phase: hash(id) * 3,
    ends: Array.from({ length: ends }, (_, j) => frac(hash(id, 3) + j / ends)),
    knot: boards && hash(id, 5) > 0.55 ? hash(id, 9) : -1,
  }));
  const across = (w / h) * boards; // a length along the boards, in boards’ widths
  return surface(
    w,
    h,
    (u0, v0, out) => {
      const u = upright ? v0 : u0;
      const v = upright ? u0 : v0;
      let bv = v;
      let id = 0;
      let seam = 1;
      if (boards) {
        id = Math.min(boards - 1, Math.floor(v * boards));
        bv = frac(v * boards);
        seam = smooth(0, gap, bv) * smooth(0, gap, 1 - bv);
        for (const at of plank[id].ends) seam = Math.min(seam, smooth(0, 0.06, Math.abs(wrapped(u - at, 1)) * across));
      }
      const b = plank[id];
      const wander = fbmXY(noise, u * px, v * py, { px, py, octaves: 3 });
      const ring = 0.5 + 0.5 * Math.sin(TAU * (bv * rings + wander * 2.4 + b.phase));
      const fibre = fbmXY(fibres, u * px * 24, v * py * 3, { px: px * 24, py: py * 3, octaves: 2 });
      const knot = b.knot >= 0 ? smooth(0.09, 0.0, Math.hypot(wrapped(u - b.knot, 1) * 6, (bv - 0.5) * 0.9)) : 0;
      const k = (0.68 + 0.24 * ring ** 1.6 + (fibre - 0.5) * 0.3) * b.shade * (1 - knot * 0.45);
      let c = scale(tone, k * (0.35 + 0.65 * seam));
      let hgt = (0.55 + (ring - 0.5) * 0.08 + (fibre - 0.5) * 0.08 - knot * 0.1) * (0.2 + 0.8 * seam);
      let rough = varnish ? 0.56 + (1 - ring) * 0.05 + (fibre - 0.5) * 0.12 : 0.66 + fibre * 0.2;
      if (nails)
        for (const at of b.ends) {
          if (Math.abs(wrapped(u - at, 1)) * across > 0.12) continue;
          for (const side of [-1, 1])
            for (const row of [0.28, 0.72]) {
              const d = Math.hypot(wrapped(u - at - side * 0.012, 1) * across, bv - row);
              if (d < 0.05) {
                const n = smooth(0.05, 0.02, d);
                c = blend(c, [34, 30, 28], n);
                hgt = Math.max(hgt, 0.58 + n * 0.12);
                rough = rough + (0.45 - rough) * n;
              }
            }
        }
      out.c = c;
      out.h = hgt;
      out.rough = clamp01(seam < 0.5 ? 0.95 : rough);
    },
    { relief, strength: 2.4, ref: 512 },
  );
}

// oak panelling round the walls: six raised and fielded panels in their
// frames, a moulded rail along the top, the grain up the panels. The canvas
// is the wall’s 2.5 × 0.62 m.
export function panels(w, h, { relief = true } = {}) {
  // (the grain at half size, drawn up: it runs long enough not to show it)
  const grain = makeCanvas(w, h);
  grain.getContext('2d').drawImage(wood(Math.max(32, w >> 1), Math.max(16, h >> 1), { tone: [96, 62, 34], seed: 23, rings: 26, upright: true, period: [3, 2], relief: false }).map, 0, 0, w, h);
  const read = grain.getContext('2d').getImageData?.(0, 0, w, h)?.data;
  const WM = 2.5;
  const HM = 0.62;
  const n = 6;
  return surface(
    w,
    h,
    (u, v, out) => {
      const i = Math.min(n - 1, Math.floor(u * n));
      const x0 = i / n + 0.022;
      const x1 = (i + 1) / n - 0.022;
      // (in metres from the panel’s edge: inside it if > 0)
      const d = Math.min((u - x0) * WM, (x1 - u) * WM, (v - 0.16) * HM, (0.86 - v) * HM);
      let hgt = 0.6;
      let ao = 1;
      if (d > 0) {
        if (d < 0.006) {
          hgt = 0.2;
          ao = 0.55;
        } else if (d < 0.03) {
          hgt = 0.3 + ((d - 0.006) / 0.024) * 0.55;
          ao = 0.8 + ((d - 0.006) / 0.024) * 0.2;
        } else hgt = 0.85;
      }
      // the rail along the top, and the skirting along the floor
      if (v < 0.07) {
        hgt = 0.7 + Math.sin((v / 0.07) * Math.PI) * 0.2;
        ao = 0.9;
      } else if (v < 0.1) {
        hgt = 0.45;
        ao = 0.7;
      }
      if (v > 0.93) hgt = 0.72;
      const x = Math.min(w - 1, Math.floor(u * w));
      const y = Math.min(h - 1, Math.floor(v * h));
      const g = read ? [read[(y * w + x) * 4], read[(y * w + x) * 4 + 1], read[(y * w + x) * 4 + 2]] : [96, 62, 34];
      out.c = scale(g, ao * (d > 0.03 ? 1.06 : 0.92));
      out.h = hgt;
      out.rough = d > 0 && d < 0.006 ? 0.85 : 0.42 + (1 - ao) * 0.4;
    },
    { relief, strength: 2.6, ref: 1024 },
  );
}

// the plaster over the panels: warm limewash, laid on by hand, a few hairline
// cracks and old stains. It tiles.
export function plaster(w, { relief = true } = {}) {
  const lumps = makeNoise(51);
  const trowel = makeNoise(52);
  const stains = makeNoise(53);
  const cells = makeCells(54);
  return surface(
    w,
    w,
    (u, v, out) => {
      const b = fbm(lumps, u * 4, v * 4, { period: 4, octaves: 3 });
      const t = fbm(trowel, u * 6 + b * 1.4, v * 6, { period: 6, octaves: 2 });
      const sweep = 0.5 + 0.5 * Math.sin(TAU * (u * 3 + t * 1.6));
      // (hairlines, here and there: most of the wall has none, and is spared the looking)
      const where = smooth(0.66, 0.76, fbm(stains, u * 2 + 7, v * 2, { period: 2, octaves: 2 }));
      let crack = 0;
      if (where > 0) {
        const { f1, f2 } = cells(u * 5, v * 5, 5);
        crack = smooth(0.012, 0.0, f2 - f1 + (b - 0.5) * 0.01) * where;
      }
      const stain = smooth(0.55, 0.75, fbm(stains, u * 3, v * 3, { period: 3, octaves: 3 }));
      let c = blend([202, 180, 144], [176, 150, 112], b * 0.8 + sweep * 0.15);
      c = blend(c, [140, 116, 86], stain * 0.35);
      c = blend(c, [112, 92, 70], crack * 0.45);
      out.c = c;
      out.h = 0.5 + (b - 0.5) * 0.45 + (t - 0.5) * 0.2 + sweep * 0.05 - crack * 0.12;
      out.rough = 0.9 - stain * 0.08;
    },
    { relief, strength: 2.2, ref: 384 },
  );
}

// the floor: oak boards end to end, nailed, worn paler where hobbits walk.
// It tiles, eight boards to a tile.
export function floorboards(w, { relief = true } = {}) {
  return wood(w, w, { tone: [78, 50, 30], seed: 31, rings: 5, boards: 8, ends: 1, nails: true, period: [2, 8], relief });
}

// the vault’s boards over the room, along it, tongued close together
export function vault(w, h, { relief = true } = {}) {
  return wood(w, h, { tone: [70, 46, 28], seed: 61, rings: 3, boards: 12, seam: 0.022, upright: true, period: [2, 12], relief });
}

// the hearth’s stones: rough blocks in courses of their own heights, each
// stone its own grey or brown, pitted, its edges wandering and rounded, in
// pale mortar, dirtier in the joints. It tiles, three courses to a tile.
export function stones(w, { relief = true } = {}) {
  const r = rand(3);
  const heights = [0.3 + r() * 0.12, 0.26 + r() * 0.12, 0];
  heights[2] = 1 - heights[0] - heights[1];
  const tops = [0, heights[0], heights[0] + heights[1], 1];
  // each course’s joints, across the tile and round again
  const courses = heights.map(() => {
    const n = 2 + Math.floor(r() * 2);
    let x = r();
    const cuts = [];
    for (let i = 0; i < n; i++) {
      cuts.push(frac(x));
      x += (0.55 + r() * 0.9) / n;
    }
    return cuts.sort((a, b) => a - b);
  });
  const TONES = [[128, 120, 106], [108, 98, 86], [142, 128, 106], [96, 90, 82], [124, 110, 94], [116, 112, 104]];
  const pits = makeNoise(12);
  const grain = makeNoise(13);
  const edge = makeNoise(14);
  const M = 0.014; // the mortar’s half-width, in tiles
  return surface(
    w,
    w,
    (u, v, out) => {
      let j = 0;
      while (j < 2 && v >= tops[j + 1]) j++;
      const cuts = courses[j];
      let du = 1;
      let id = cuts.length;
      for (let k = 0; k < cuts.length; k++) {
        du = Math.min(du, Math.abs(wrapped(u - cuts[k], 1)));
        if (u >= cuts[k]) id = k + 1;
      }
      const dv = Math.min(v - tops[j], tops[j + 1] - v);
      const wander = (fbm(edge, u * 10, v * 10, { period: 10, octaves: 2 }) - 0.5) * 0.03;
      const e = Math.min(du, dv) + wander;
      const p = fbm(pits, u * 8, v * 8, { period: 8, octaves: 3 });
      const g = fbm(grain, u * 28, v * 28, { period: 28, octaves: 2 });
      const face = smooth(M, M + 0.05, e);
      const bulge = smooth(M, M + 0.18, e);
      const which = (id % cuts.length) + j * 5;
      const tone = blend(TONES[Math.floor(hash(which, 2) * TONES.length)], [150, 136, 112], hash(which, 4) * 0.25);
      const stone = scale(tone, (0.8 + p * 0.28 + (g - 0.5) * 0.14) * (0.72 + 0.28 * face));
      const mortar = scale(blend([150, 140, 122], [112, 102, 88], p), 0.82);
      out.c = e < M ? mortar : stone;
      out.h = e < M ? 0.1 + p * 0.06 : 0.25 + face * 0.3 + bulge * 0.25 + (p - 0.5) * 0.2 + (g - 0.5) * 0.06;
      out.rough = e < M ? 0.97 : 0.8 + (1 - p) * 0.14;
    },
    { relief, strength: 2.6, ref: 256 },
  );
}

// mithril: rings of silver-steel, each through its neighbours, row on row,
// each row lapping the one below like scales, the dark between them. Eight
// rings across a tile, fourteen rows down, so it tiles.
export function mithril(w, { relief = true } = {}) {
  const N = 8;
  const ROWS = 14;
  const DY = N / ROWS;
  const RING = 0.46; // a ring’s radius, and its wire’s, in ring widths
  const WIRE = 0.14;
  const sparkle = makeNoise(77);
  return surface(
    w,
    w,
    (u, v, out) => {
      const x = u * N;
      const y = v * N;
      const j0 = Math.floor(y / DY);
      let best = 0;
      let lit = 0;
      for (let dj = -1; dj <= 2; dj++) {
        const j = j0 + dj;
        const cy = j * DY;
        const off = ((j % 2) + 2) % 2 ? 0.5 : 0;
        for (let di = -1; di <= 1; di++) {
          const cx = Math.floor(x - off) + di + off + 0.5;
          const dx = wrapped(x - cx, N);
          const dy = wrapped(y - cy, N);
          const d = Math.hypot(dx, dy);
          const t = (d - RING) / WIRE;
          if (Math.abs(t) >= 1) continue;
          const wire = Math.sqrt(1 - t * t);
          // (each ring leans out of the coat at its lower edge, over the row below)
          const hgt = 0.25 + wire * 0.45 + (dy / RING) * 0.18 + 0.1;
          if (hgt > best) {
            best = hgt;
            lit = wire;
          }
        }
      }
      const s = fbm(sparkle, u * 16, v * 16, { period: 16, octaves: 2 });
      out.c = best > 0 ? blend([96, 104, 118], [232, 238, 246], 0.35 + lit * 0.65 * (0.85 + s * 0.3)) : [14, 16, 20];
      out.h = best;
      out.rough = best > 0 ? 0.16 + (1 - lit) * 0.22 : 0.95;
    },
    { relief, strength: 3.2, ref: 256 },
  );
}

// brass, hammered: dimples over it, a little dulled between
export function brass(w, { relief = true } = {}) {
  const cells = makeCells(88);
  return surface(
    w,
    w,
    (u, v, out) => {
      const { f1, id } = cells(u * 6, v * 6, 6);
      const dimple = smooth(0.0, 0.7, f1);
      out.c = scale(blend([196, 156, 72], [150, 112, 44], id * 0.5), 0.85 + dimple * 0.2);
      out.h = dimple * 0.5;
      out.rough = 0.24 + (1 - dimple) * 0.16;
    },
    { relief, strength: 1.6, ref: 128 },
  );
}

// the round green door: painted planks, worn to the wood here and there, an
// oak frame round them, iron studs, the brass knob in the middle
export function door(w, { relief = true } = {}) {
  const wear = makeNoise(8);
  const grain = makeNoise(9);
  return surface(
    w,
    w,
    (u, v, out) => {
      const x = u - 0.5;
      const y = v - 0.5;
      const r = Math.hypot(x, y);
      const g = fbm(grain, u * 3, v * 40, { octaves: 2 });
      const oak = scale([96, 62, 34], 0.75 + g * 0.4);
      if (r > 0.45) {
        out.c = r > 0.495 ? scale(oak, 0.6) : oak;
        out.h = 0.75 + Math.sin(((r - 0.45) / 0.05) * Math.PI) * 0.15;
        out.rough = 0.7;
      } else {
        const plank = frac(u * 8);
        const seam = smooth(0, 0.05, plank) * smooth(0, 0.05, 1 - plank);
        const paint = blend([72, 146, 82], [26, 78, 40], clamp01(Math.hypot(x + 0.08, y + 0.12) / 0.55));
        const worn = smooth(0.62, 0.7, fbm(wear, u * 6, v * 6, { octaves: 3 }) + (r > 0.4 ? 0.12 : 0));
        out.c = scale(blend(paint, oak, worn), 0.45 + 0.55 * seam);
        out.h = (0.55 - worn * 0.05 + (g - 0.5) * 0.04) * (0.4 + 0.6 * seam);
        out.rough = worn > 0.5 ? 0.78 : 0.42;
      }
      // the studs round the edge, and the knob
      if (Math.abs(r - 0.475) < 0.015)
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const d = Math.hypot(x - Math.cos(a) * 0.475, y - Math.sin(a) * 0.475);
          if (d < 0.014) {
            const k = Math.sqrt(1 - (d / 0.014) ** 2);
            out.c = scale([46, 40, 36], 0.7 + k * 0.6);
            out.h = 0.8 + k * 0.2;
            out.rough = 0.5;
          }
        }
      if (r < 0.05) {
        const k = Math.sqrt(1 - (r / 0.05) ** 2);
        out.c = blend([150, 108, 30], [255, 236, 160], k * 0.8);
        out.h = 0.6 + k * 0.4;
        out.rough = 0.22;
      }
    },
    { relief, strength: 2.4, ref: 512 },
  );
}

// a round rug of braided rag, ring on ring, each ring a twisted cord
export function rug(w, { relief = true } = {}) {
  const colours = [[138, 58, 34], [200, 144, 42], [74, 106, 58], [122, 42, 26], [216, 176, 106], [58, 90, 106], [154, 74, 42], [90, 122, 58]];
  return surface(
    w,
    w,
    (u, v, out) => {
      const x = u - 0.5;
      const y = v - 0.5;
      const r = Math.hypot(x, y);
      const band = r / 0.031;
      const i = Math.floor(band);
      const f = band - i;
      const a = Math.atan2(y, x);
      const cross = Math.sin(f * Math.PI);
      const twist = 0.5 + 0.5 * Math.sin(a * (24 + i * 7) + f * TAU * (i % 2 ? 1 : -1));
      const hgt = cross * (0.55 + 0.45 * twist);
      out.c = scale(colours[i % colours.length], (0.45 + 0.6 * hgt) * (r > 0.47 ? 0.75 : 1));
      out.h = hgt;
      out.rough = 1;
    },
    { relief, strength: 2.4, ref: 512 },
  );
}

// a painted canvas’s relief from its own shading: the lighter, the nearer
export function reliefOf(canvas, strength = 1.5) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext('2d').getImageData?.(0, 0, w, h)?.data;
  if (!data) return null;
  const field = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) field[i] = (data[i * 4] * 0.3 + data[i * 4 + 1] * 0.55 + data[i * 4 + 2] * 0.15) / 255;
  return normalFromField(field, w, h, strength);
}

// Bilbo’s bookcase from the front: five shelves of spines, gilt on some,
// a jar, a candle, a rolled map
export function shelfArt(w, h) {
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(wood(Math.max(32, w >> 1), Math.max(32, h >> 1), { tone: [74, 46, 26], seed: 41, rings: 30, upright: true, relief: false }).map, 0, 0, w, h);
  const b = brush(c.getContext('2d'), w, h, { seed: 14, ppm: w / 0.7 });
  const r = rand(21);
  const shelves = 5;
  const spines = ['#6a1e1a', '#2e4a3a', '#3a3a5a', '#7a5a2a', '#4a2a1a', '#8a7a5a', '#5a2a3a', '#2a3a2a', '#9a6a3a'];
  for (let s = 0; s < shelves; s++) {
    const y1 = 0.04 + ((s + 1) / shelves) * 0.92;
    const y0 = y1 - 0.92 / shelves + 0.025;
    b.fill([[0.04, y0 - 0.02], [0.96, y0 - 0.02], [0.96, y1], [0.04, y1]], '#1a0e06');
    let x = 0.05;
    while (x < 0.94) {
      if (r() < 0.07) {
        // a jar, or a candle-end, between the books
        b.wash(oval(x + 0.035, y1 - 0.04, 0.03, 0.045), { v: ['#c8b890', '#6a5a3a'] }, { edge: 0.4 });
        x += 0.08;
        continue;
      }
      const bw = 0.022 + r() * 0.03;
      const bh = (y1 - y0) * (0.62 + r() * 0.34);
      const col = spines[Math.floor(r() * spines.length)];
      const lean = r() < 0.08 ? 0.01 : 0;
      const spine = [[x + lean, y1 - bh], [x + bw + lean, y1 - bh], [x + bw, y1], [x, y1]];
      b.wash(spine, { h: [tint(col, 0.2), shade(col, 0.35)], x0: x, x1: x + bw }, { edge: 0.4, grain: 0.3 });
      if (r() < 0.6) for (const k of [0.15, 0.8]) b.line([[x + 0.003, y1 - bh * k], [x + bw - 0.003, y1 - bh * k]], { width: 0.002, colour: '#d8b04a', alpha: 0.8, twice: false });
      x += bw + 0.003;
    }
    b.fill([[0.02, y1], [0.98, y1], [0.98, y1 + 0.02], [0.02, y1 + 0.02]], '#5a3a1e');
  }
  b.ink([[0.02, 0.02], [0.98, 0.02], [0.98, 0.98], [0.02, 0.98]], { width: 0.006, colour: '#2a160a', twice: false });
  return c;
}

// the sign Bilbo propped by the door
export function signArt(w, h) {
  const c = makeCanvas(w, h);
  const b = brush(c.getContext('2d'), w, h, { seed: 3, ppm: w / 0.3 });
  b.wash([[0, 0], [1, 0], [1, 1], [0, 1]], { v: [tint(CARD, 0.1), '#c8b48a'] }, { edge: 0.5 });
  b.text('No admittance', 0.5, 0.38, { size: 0.2, align: 'center', font: 'Georgia, serif', italic: true, weight: 600, max: 0.9 });
  b.text('except on', 0.5, 0.6, { size: 0.16, align: 'center', font: 'Georgia, serif', italic: true, weight: 500, max: 0.9 });
  b.text('party business', 0.5, 0.82, { size: 0.2, align: 'center', font: 'Georgia, serif', italic: true, weight: 600, max: 0.9 });
  return c;
}


// the letters down Sting’s blade, white on black (they glow blue as it
// shines): Elvish-looking strokes, stems and bows and the curls between
export function runesArt(w, h) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, w * 0.07);
  ctx.lineCap = 'round';
  const r = rand(19);
  const cx = w / 2;
  for (let y = h * 0.1; y < h * 0.62; y += w * 0.5) {
    const k = r();
    ctx.beginPath();
    if (k < 0.3) {
      // a stem with a bow
      ctx.moveTo(cx - w * 0.15, y);
      ctx.lineTo(cx - w * 0.15, y + w * 0.38);
      ctx.moveTo(cx - w * 0.15, y + w * 0.08);
      ctx.arc(cx, y + w * 0.12, w * 0.15, Math.PI, 0.2 * Math.PI, false);
    } else if (k < 0.6) {
      // two bows
      ctx.arc(cx - w * 0.08, y + w * 0.18, w * 0.12, 0.5 * Math.PI, 1.8 * Math.PI, false);
      ctx.moveTo(cx + w * 0.2, y + w * 0.18);
      ctx.arc(cx + w * 0.08, y + w * 0.18, w * 0.12, 0, 1.3 * Math.PI, true);
    } else {
      // a curl, and a dot over it
      ctx.moveTo(cx - w * 0.18, y + w * 0.3);
      ctx.quadraticCurveTo(cx, y - w * 0.05, cx + w * 0.18, y + w * 0.3);
      ctx.moveTo(cx + w * 0.02, y + w * 0.02);
      ctx.lineTo(cx + w * 0.02, y + w * 0.04);
    }
    ctx.stroke();
  }
  return c;
}

// the lantern’s four sides: an iron frame round panes of horn, lit from
// within; `glow` is the light alone, for its emissive
export function paneArt(w) {
  const make = (lit) => {
    const c = makeCanvas(w, w);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(w / 2, w * 0.6, 0, w / 2, w * 0.6, w * 0.6);
    g.addColorStop(0, lit ? '#ffd890' : '#e8b060');
    g.addColorStop(1, lit ? '#a05010' : '#7a4a20');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = lit ? '#000' : '#1e1c1a';
    const bar = w * 0.09;
    for (const x of [0, w / 2 - bar / 2, w - bar]) ctx.fillRect(x, 0, bar, w);
    for (const y of [0, w - bar]) ctx.fillRect(0, y, w, bar);
    return c;
  };
  return { map: make(false), glow: make(true) };
}

// rain on the glass: streaks and beads, tiled, scrolled down
export function rainArt(w) {
  const c = makeCanvas(w, w);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(200, 214, 234, 0.55)';
  ctx.lineWidth = Math.max(1, w / 256);
  const r = rand(21);
  ctx.beginPath();
  for (let i = 0; i < 90; i++) {
    const x = r() * w;
    const y = r() * w;
    ctx.moveTo(x, y);
    ctx.lineTo(x + w * 0.004, y + w * 0.08);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(223, 232, 244, 0.7)';
  for (let i = 0; i < 50; i++) {
    ctx.beginPath();
    ctx.arc(r() * w, r() * w, w * (0.003 + r() * 0.003), 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}

// a belt of pearls and crystals, bead after bead round it
export function beads(w, { relief = true } = {}) {
  const n = 48;
  return surface(
    w,
    Math.max(8, w / 8),
    (u, v, out) => {
      const i = Math.floor(u * n);
      const f = frac(u * n) - 0.5;
      const d = Math.hypot(f, (v - 0.5) * 0.9);
      const k = d < 0.45 ? Math.sqrt(1 - (d / 0.45) ** 2) : 0;
      const pearl = i % 3 !== 2;
      out.c = k ? scale(pearl ? [242, 236, 222] : [200, 220, 246], 0.6 + k * 0.45) : [40, 34, 30];
      out.h = k * 0.8;
      out.rough = pearl ? 0.3 : 0.08;
    },
    { relief, strength: 2, ref: 256 },
  );
}
