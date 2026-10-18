// Minas Tirith, made in code: the kit the hidden chapter is built from. The
// white city of seven levels on the knee of Mount Mindolluin: the levels
// paved in pale flags, the seven walls (the first of black stone, the rest
// white) with their crenels and gate towers, the Great Gate with its dark
// doors standing open, the prow of rock thrust out east through every level
// with the road tunnelled through it, the road winding up on its ramps, the
// tall white houses, and the Citadel at the top: the court with its bands of
// grey stone, the hall of the kings and the Tower of Ecthelion rising from
// it, the White Tree's lawn and the fountain. Then the White Tree itself,
// dead or in flower; the hall of the kings inside, its black pillars, its
// kings of stone and the empty throne; the beacon's ledge up the mountain
// with its great pile of wood and the guard's supper; the far beacon peaks;
// and the Mountains of Shadow away in the east.
//
// The coordinates are ./layout.js's: metres, +x east, +z south, y up, the
// city's middle the origin. Fixed parts are merged one mesh per material
// (the walls and the paving once per level, so a level off screen isn't
// drawn); the houses are instanced, their windows and doors painted on by
// the shader so a house of any size keeps them the right size. What glows is
// brighter than 1, so the bloom takes it.

import * as THREE from 'three';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, ridge, smooth } from '../../../../lib/paint';
import { blob, lathe, parts, rng, tube } from '../../shire/props';
import { houseShader, roofShader, swayBanner } from '../../nodes/towns/minastirith/propsShaders';
import {
  BEACONS,
  CHAIR,
  COLUMNS,
  COURT_Y,
  COVERS,
  DAIS,
  FOUNTAIN,
  GATE_A,
  GATE_W,
  GATES,
  HALL,
  HALL_HOUSE,
  HOUSES,
  LEDGE,
  LEVEL_Y,
  PARAPET,
  PILE,
  PROW,
  ROAD,
  ROAD_W,
  SPAN,
  STATUES,
  THRONE,
  TOMATOES,
  TOWER,
  TREE,
  TUNNELS,
  WALL_R,
  WALL_T,
  WATCH,
  ledgeAt,
  levelOf,
} from './layout';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// How much each tier draws: texture sizes, how finely curves are cut, and
// whether the walls get every merlon.
const QUALITY = {
  high: { tex: 512, cell: 256, step: 1.2, merlons: 1, around: 1, peak: [72, 34] },
  mid: { tex: 384, cell: 192, step: 1.8, merlons: 1, around: 0.75, peak: [52, 24] },
  low: { tex: 256, cell: 128, step: 2.8, merlons: 0, around: 0.5, peak: [36, 18] },
};

// ── small helpers ──

// An integer hash to [0, 1).
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
// Value noise that repeats every px across and py down, so a streak can be
// long one way and short the other and still tile.
function stretchNoise(seed) {
  const w = (i, p) => ((i % p) + p) % p;
  return (x, y, px, py) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x0 = w(xi, px);
    const x1 = w(xi + 1, px);
    const y0 = w(yi, py);
    const y1 = w(yi + 1, py);
    return mix(mix(hash2(x0, y0, seed), hash2(x1, y0, seed), sx), mix(hash2(x0, y1, seed), hash2(x1, y1, seed), sx), sy);
  };
}
function sfbm(n, x, y, px, py, octaves = 3) {
  let s = 0;
  let a = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o++) {
    s += n(x * f, y * f, px * f, py * f) * a;
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return s / norm;
}

// A geometry from flat arrays (normals worked out if not given).
function bufferGeo({ pos, nor, uv, idx }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (idx) g.setIndex(idx);
  if (!nor) g.computeVertexNormals();
  return g;
}

// Quads (four corners each, in turn round) as flat triangles, each turned to
// face away from its `centre`: [a, b, c, d, centre].
function quadsFacing(list) {
  const pos = [];
  for (const [a, b, c, d, o] of list) {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const fx = (a[0] + c[0]) / 2 - o[0];
    const fy = (a[1] + c[1]) / 2 - o[1];
    const fz = (a[2] + c[2]) / 2 - o[2];
    if (nx * fx + ny * fy + nz * fz >= 0) pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    else pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  }
  return bufferGeo({ pos });
}

// A block between two arcs (radii r0 to r1, angles a0 to a1), from y0 to
// y1: a merlon, a buttress, a parapet's length. Pushed onto `list`.
function arcBlock(list, r0, r1, a0, a1, y0, y1, bottom = false) {
  const P = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  const am = (a0 + a1) / 2;
  const o = P((r0 + r1) / 2, am, (y0 + y1) / 2);
  list.push([P(r1, a0, y0), P(r1, a1, y0), P(r1, a1, y1), P(r1, a0, y1), o]);
  list.push([P(r0, a0, y0), P(r0, a1, y0), P(r0, a1, y1), P(r0, a0, y1), o]);
  list.push([P(r0, a0, y0), P(r1, a0, y0), P(r1, a0, y1), P(r0, a0, y1), o]);
  list.push([P(r0, a1, y0), P(r1, a1, y0), P(r1, a1, y1), P(r0, a1, y1), o]);
  list.push([P(r0, a0, y1), P(r1, a0, y1), P(r1, a1, y1), P(r0, a1, y1), o]);
  if (bottom) list.push([P(r0, a0, y0), P(r1, a0, y0), P(r1, a1, y0), P(r0, a1, y0), o]);
}
// A box standing from (x0, z0) to (x1, z1), `d` thick, from y0 to y1.
function slab(x0, z0, x1, z1, d, y0, y1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.BoxGeometry(len, y1 - y0, d);
  g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
}

// A closed profile ([dr, y] pairs, dr outward from R) swept round the arc
// from a0 to a1: a wall's whole section at once, sharp across its edges and
// smooth along it, the ends capped. Texture coordinates in metres / tile.
function arcSweep(R, a0, a1, prof, { step = 1.5, tile = 6, caps = true } = {}) {
  const n = Math.max(1, Math.ceil((Math.abs(a1 - a0) * (R + 1)) / step));
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  let area = 0;
  for (let i = 0; i < prof.length; i++) {
    const [x0, y0] = prof[i];
    const [x1, y1] = prof[(i + 1) % prof.length];
    area += x0 * y1 - x1 * y0;
  }
  const sg = area > 0 ? 1 : -1;
  const facing = (i0, i1, i2, nx, ny, nz) => {
    const ax = pos[i1 * 3] - pos[i0 * 3];
    const ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1];
    const az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
    const bx = pos[i2 * 3] - pos[i0 * 3];
    const by = pos[i2 * 3 + 1] - pos[i0 * 3 + 1];
    const bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
    return (ay * bz - az * by) * nx + (az * bx - ax * bz) * ny + (ax * by - ay * bx) * nz >= 0;
  };
  let vAcc = 0;
  for (let e = 0; e < prof.length; e++) {
    const [r0, y0] = prof[e];
    const [r1, y1] = prof[(e + 1) % prof.length];
    const len = Math.hypot(r1 - r0, y1 - y0);
    if (len < 1e-5) continue;
    const nr = (sg * (y1 - y0)) / len;
    const ny = (-sg * (r1 - r0)) / len;
    const base = pos.length / 3;
    for (let j = 0; j <= n; j++) {
      const a = a0 + ((a1 - a0) * j) / n;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pos.push(c * (R + r0), y0, s * (R + r0), c * (R + r1), y1, s * (R + r1));
      nor.push(c * nr, ny, s * nr, c * nr, ny, s * nr);
      uv.push((a * (R + r0)) / tile, vAcc / tile, (a * (R + r1)) / tile, (vAcc + len) / tile);
    }
    const ok = facing(base, base + 1, base + 3, Math.cos(a0) * nr, ny, Math.sin(a0) * nr);
    for (let j = 0; j < n; j++) {
      const q = base + j * 2;
      if (ok) idx.push(q, q + 1, q + 3, q, q + 3, q + 2);
      else idx.push(q, q + 3, q + 1, q, q + 2, q + 3);
    }
    vAcc += len;
  }
  if (caps) {
    const tris = THREE.ShapeUtils.triangulateShape(
      prof.map(([x, y]) => new THREE.Vector2(x, y)),
      [],
    );
    const dir = Math.sign(a1 - a0) || 1;
    for (const [a, out] of [
      [a0, -dir],
      [a1, dir],
    ]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = -s * out;
      const nz = c * out;
      const base = pos.length / 3;
      for (const [dr, y] of prof) {
        pos.push(c * (R + dr), y, s * (R + dr));
        nor.push(nx, 0, nz);
        uv.push(dr / tile, y / tile);
      }
      const ok = facing(base + tris[0][0], base + tris[0][1], base + tris[0][2], nx, 0, nz);
      for (const [i, j, k] of tris) {
        if (ok) idx.push(base + i, base + j, base + k);
        else idx.push(base + i, base + k, base + j);
      }
    }
  }
  return bufferGeo({ pos, nor, uv, idx });
}

// A lathe from a profile of [r, y] points, each stretch of it its own band
// (so its edges are sharp), with texture coordinates in metres / tile.
function latheM(prof, seg = 24, tile = 4, phi0 = 0, phiLen = TAU) {
  const pos = [];
  const nor = [];
  const uv = [];
  const idx = [];
  const rMax = Math.max(...prof.map((p) => p[0]), 0.01);
  let vAcc = 0;
  for (let e = 0; e < prof.length - 1; e++) {
    const [r0, y0] = prof[e];
    const [r1, y1] = prof[e + 1];
    const len = Math.hypot(r1 - r0, y1 - y0);
    if (len < 1e-5) continue;
    const nr = (y1 - y0) / len;
    const ny = -(r1 - r0) / len;
    const base = pos.length / 3;
    for (let j = 0; j <= seg; j++) {
      const a = phi0 + (phiLen * j) / seg;
      const s = Math.sin(a);
      const c = Math.cos(a);
      pos.push(s * r0, y0, c * r0, s * r1, y1, c * r1);
      nor.push(s * nr, ny, c * nr, s * nr, ny, c * nr);
      const u = ((a * rMax) / tile) * 1;
      uv.push(u, vAcc / tile, u, (vAcc + len) / tile);
    }
    for (let j = 0; j < seg; j++) {
      const q = base + j * 2;
      idx.push(q, q + 3, q + 1, q, q + 2, q + 3);
    }
    vAcc += len;
  }
  return bufferGeo({ pos, nor, uv, idx });
}

// A round-headed opening's outline: from the foot of one side, up, over the
// arch and down; `w` wide, its crown `h` above its foot.
function archPts(w, h, cx = 0, y0 = 0, n = 12) {
  const r = w / 2;
  const spring = y0 + h - r;
  const pts = [new THREE.Vector2(cx - r, y0), new THREE.Vector2(cx - r, spring)];
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (Math.PI * i) / n;
    pts.push(new THREE.Vector2(cx + Math.cos(a) * r, spring + Math.sin(a) * r));
  }
  pts.push(new THREE.Vector2(cx + r, spring), new THREE.Vector2(cx + r, y0));
  return pts;
}
// A slice of a ring (an arch's voussoirs, a kerb), `depth` thick from z = 0.
function ringSlice(r0, r1, a0, a1, depth, segs = 12) {
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = mix(a0, a1, i / segs);
    if (i) s.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    else s.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  for (let i = segs; i >= 0; i--) {
    const a = mix(a0, a1, i / segs);
    s.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 1 });
}

// ── textures ──

// Laid stone: rows of blocks (courses of a wall, or the flags of a
// pavement), each block its own shade, the joints cut in, the weather run
// down it in streaks. Returns the picture and its height field.
function blocksCanvas(S, { seed = 1, rows = 10, len = [0.14, 0.3], joint = 1.4, bevel = 2.6, light, dark, mortar, streak = 0.22, spread = 0.5, cool = 0, worn = 0 }) {
  const r = rng(seed);
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 5);
  const lay = [];
  for (let i = 0; i < rows; i++) {
    const lens = [];
    let sum = 0;
    while (sum < 1 - len[0] * 0.5) {
      const l = len[0] + r() * (len[1] - len[0]);
      lens.push(l);
      sum += l;
    }
    const edges = [0];
    let acc = 0;
    for (const l of lens) edges.push((acc += l / sum));
    edges[edges.length - 1] = 1;
    lay.push({ edges, off: r(), tone: lens.map(() => r()), hue: lens.map(() => r()) });
  }
  const field = new Float32Array(S * S);
  const rowH = S / rows;
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const ri = Math.min(rows - 1, Math.floor(y / rowH));
    const row = lay[ri];
    const fy = y + 0.5 - ri * rowH;
    const dy = Math.min(fy, rowH - fy);
    const uu = (u + row.off) % 1;
    let bi = 0;
    while (row.edges[bi + 1] <= uu) bi++;
    const dx = Math.min(uu - row.edges[bi], row.edges[bi + 1] - uu) * S;
    const d = Math.min(dx, dy);
    const face = smooth(joint * 0.5, joint + bevel, d);
    const m = fbm(n, u * 8, v * 8, { period: 8, octaves: 4 });
    const fine = n(u * 128, v * 128, 128);
    const st = sfbm(sn, u * 32, v * 3, 32, 3, 3);
    const chip = d < joint + bevel * 1.8 && n(u * 48 + 3, v * 48, 48) > 0.7 ? 0.14 : 0;
    let t = 0.55 + (row.tone[bi] - 0.5) * spread + (m - 0.5) * 0.5 + (fine - 0.5) * 0.12 - chip;
    t -= streak * smooth(0.5, 0.8, st) * (0.5 + 0.5 * m);
    t += worn * smooth(0.4, 0.9, d / (rowH * 0.5)) * 0.15;
    t = clamp01(t);
    const h = row.hue[bi] - 0.5;
    for (let k = 0; k < 3; k++) {
      const tint = 1 + cool * h * (k === 2 ? 0.07 : k === 0 ? -0.05 : 0);
      out[k] = mix(mortar[k] * (0.85 + m * 0.3), mix(dark[k], light[k], t) * tint, face);
    }
    field[y * S + x] = face * (0.72 + 0.28 * m) - chip * 0.6 + fine * 0.05;
  });
  return { c, field };
}

// Fine pale stone for mouldings, columns and kerbs: almost smooth, faint
// clouding and a vein or two.
function smoothStoneCanvas(S, seed = 17) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const m = fbm(n, u * 5, v * 5, { period: 5, octaves: 5 });
    const vein = Math.pow(ridge(n, u * 3 + 7, v * 3, { period: 3, octaves: 4 }), 22);
    const k = 0.86 + m * 0.14 - vein * 0.08;
    out[0] = 240 * k;
    out[1] = 237 * k;
    out[2] = 230 * k;
    field[y * S + x] = m * 0.5 - vein * 0.2;
  });
  return { c, field };
}

// The mountain's rock: pale grey, laid in beds each its own shade with a
// dark parting between, split by a few thin joints, grained.
function rockCanvas(S, seed = 31) {
  const n = makeNoise(seed);
  const sn = stretchNoise(seed + 3);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const warp = fbm(n, u * 3, v * 3, { period: 3, octaves: 2 });
    const bf = v * 9 + warp * 1.3;
    const bed = bf - Math.floor(bf);
    const tone = hash2((((Math.floor(bf) % 9) + 9) % 9) * 7, 1, seed);
    const parting = 1 - smooth(0, 0.05, Math.min(bed, 1 - bed));
    const joint = Math.pow(1 - Math.abs(sfbm(sn, u * 10, v * 2, 10, 2, 2) * 2 - 1), 40);
    const big = fbm(n, u * 5, v * 5, { period: 5, octaves: 4 });
    const grain = fbm(n, u * 48, v * 48, { period: 48, octaves: 2 });
    const streak = sfbm(sn, u * 16 + 5, v * 2, 16, 2, 3);
    const t = clamp01(0.62 + (tone - 0.5) * 0.14 + (big - 0.5) * 0.26 + (grain - 0.5) * 0.22 - parting * 0.04 - joint * 0.08 - smooth(0.5, 0.85, streak) * 0.12);
    field[y * S + x] = clamp01(big * 0.55 + grain * 0.22 + smooth(0, 0.6, bed) * 0.08 - joint * 0.1);
    const stain = smooth(0.6, 0.85, warp) * 0.025;
    out[0] = mix(112, 222, t) * (1 + stain);
    out[1] = mix(113, 221, t);
    out[2] = mix(116, 219, t) * (1 - stain);
  });
  return { c, field };
}

// Slates: rows of them, each its own grey-blue, the lower edges shadowed.
function slateCanvas(S, seed = 41) {
  const n = makeNoise(seed);
  const rows = 14;
  const across = 9;
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const fr = v * rows;
    const row = Math.floor(fr);
    const fy = fr - row;
    const fu = u * across + (row % 2) * 0.5;
    const col = Math.floor(fu);
    const fx = fu - col;
    const id = hash2(col % across, row, seed);
    const m = fbm(n, u * 8, v * 8, { period: 8, octaves: 3 });
    const edge = smooth(0, 0.06, Math.min(fx, 1 - fx)) * smooth(0, 0.12, fy) * (1 - smooth(0.82, 1, fy) * 0.35);
    const k = (0.72 + id * 0.26 + (m - 0.5) * 0.2) * (0.55 + 0.45 * edge);
    out[0] = 128 * k;
    out[1] = 136 * k;
    out[2] = 148 * k;
    field[y * S + x] = edge * (0.6 + 0.4 * (1 - fy));
  });
  return { c, field };
}

// The houses' fronts, an atlas of 4 × 2 cells, each a bay 2.6 m wide and a
// storey 3.2 m high: the upper storeys (top row) a tall window, a shuttered
// window, plain wall, a pair of round-headed lights; the ground floor (bottom
// row) a door, a barred window, plain wall, a shop's arch. All on near-white
// plaster, which each house tints its own way. And a mask of the glass, for
// the windows lit at night.
function facadeCanvas(C) {
  const W = C * 4;
  const H = C * 2;
  const n = makeNoise(51);
  const c = paintPixels(makeCanvas(W, H), (u, v, out) => {
    const m = fbm(n, u * 16, v * 8, { period: 8, octaves: 3 });
    const fine = n(u * 320, v * 160, 160);
    const cy = (v * 2) % 1;
    const k = 0.9 + (m - 0.5) * 0.14 + (fine - 0.5) * 0.05 - smooth(0.8, 1, cy) * 0.05;
    out[0] = 240 * k;
    out[1] = 236 * k;
    out[2] = 228 * k;
  });
  const mask = makeCanvas(W, H);
  const g = c.getContext('2d');
  const gm = mask.getContext('2d');
  gm.fillStyle = '#000';
  gm.fillRect(0, 0, W, H);
  const SX = C / 2.6;
  const SY = C / 3.2;
  const cell = (col, row, fn) => {
    for (const ctx of [g, gm]) {
      ctx.save();
      ctx.setTransform(SX, 0, 0, -SY, col * C, (row ? 1 : 2) * C);
      ctx.beginPath();
      ctx.rect(0, 0, 2.6, 3.2);
      ctx.clip();
    }
    fn();
    g.restore();
    gm.restore();
  };
  const rect = (ctx, x, y, w, h, fill) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
  };
  const arch = (ctx, x, y, w, h, fill) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    const pts = archPts(w, h, x + w / 2, y);
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  };
  const glass = (x, y, w, h, round = false) => {
    const gr = g.createLinearGradient(x, y + h, x + w, y);
    gr.addColorStop(0, '#2c3640');
    gr.addColorStop(0.55, '#161c22');
    gr.addColorStop(1, '#3a4652');
    if (round) arch(g, x, y, w, h, gr);
    else rect(g, x, y, w, h, gr);
    if (round) arch(gm, x, y, w, h, '#fff');
    else rect(gm, x, y, w, h, '#fff');
  };
  const stain = (x, y, w) => {
    for (let i = 0; i < 4; i++) {
      const gr = g.createLinearGradient(0, y, 0, y - 1.1 + i * 0.2);
      gr.addColorStop(0, 'rgba(96, 86, 72, 0.035)');
      gr.addColorStop(1, 'rgba(96, 86, 72, 0)');
      rect(g, x + w * 0.1 * i, y - 1.1 + i * 0.2, w * (1 - 0.2 * i), 1.1 - i * 0.2, gr);
    }
  };
  const STONE = '#ddd6c8';
  const STONE2 = '#c9c1b2';
  const course = () => {
    rect(g, 0, 0, 2.6, 0.14, '#d3ccbe');
    rect(g, 0, 0.14, 2.6, 0.03, 'rgba(60, 50, 40, 0.18)');
  };
  const plinth = () => {
    rect(g, 0, 0, 2.6, 0.5, STONE2);
    rect(g, 0, 0.5, 2.6, 0.05, '#b5ad9e');
  };
  // upper storeys
  cell(0, 1, () => {
    course();
    const [x, y, w, h] = [0.78, 0.82, 1.04, 1.85];
    stain(x, y - 0.1, w);
    rect(g, x - 0.16, y - 0.06, w + 0.32, h + 0.22, STONE);
    rect(g, x - 0.28, y - 0.17, w + 0.56, 0.15, STONE2);
    rect(g, x - 0.26, y + h + 0.12, w + 0.52, 0.22, '#d7d0c2');
    glass(x, y, w, h);
    for (const ctx of [g, gm]) {
      const f = ctx === g ? '#d4cdbf' : '#000';
      rect(ctx, x + w / 2 - 0.035, y, 0.07, h, f);
      rect(ctx, x, y + h * 0.66, w, 0.06, f);
    }
  });
  cell(1, 1, () => {
    course();
    const [x, y, w, h] = [0.86, 0.86, 0.88, 1.6];
    stain(x, y - 0.1, w);
    rect(g, x - 0.12, y - 0.05, w + 0.24, h + 0.17, STONE);
    rect(g, x - 0.22, y - 0.15, w + 0.44, 0.13, STONE2);
    glass(x, y, w, h);
    for (const sx of [x - 0.5, x + w + 0.04]) {
      rect(g, sx, y, 0.46, h, '#56676f');
      for (let k = 0.08; k < h; k += 0.1) rect(g, sx + 0.04, y + k, 0.38, 0.03, '#46555c');
    }
    rect(gm, x + w / 2 - 0.03, y, 0.06, h, '#000');
    rect(g, x + w / 2 - 0.03, y, 0.06, h, '#cfc8ba');
  });
  cell(2, 1, () => {
    course();
  });
  cell(3, 1, () => {
    course();
    stain(0.72, 0.8, 1.16);
    arch(g, 0.66, 0.8, 1.28, 2.05, STONE);
    rect(g, 0.56, 0.7, 1.48, 0.13, STONE2);
    glass(0.76, 0.88, 0.48, 1.72, true);
    glass(1.36, 0.88, 0.48, 1.72, true);
    rect(g, 1.26, 0.88, 0.08, 1.4, '#d4cdbf');
  });
  // the ground floor
  cell(0, 0, () => {
    plinth();
    arch(g, 0.6, 0, 1.4, 2.78, STONE);
    arch(g, 0.76, 0, 1.08, 2.56, '#4a3526');
    for (let x = 0.76 + 0.18; x < 1.84; x += 0.18) rect(g, x, 0, 0.025, 2.3, '#38281c');
    for (const y of [0.55, 1.7]) rect(g, 0.76, y, 1.08, 0.07, '#24201c');
    for (const y of [0.58, 1.73]) for (const x of [0.9, 1.15, 1.45, 1.7]) rect(g, x, y, 0.04, 0.04, '#7a7064');
    rect(g, 0.5, 0, 1.6, 0.1, '#bab2a4');
    rect(g, 1.23, 2.5, 0.14, 0.28, '#e2dccf');
  });
  cell(1, 0, () => {
    plinth();
    const [x, y, w, h] = [0.86, 1.15, 0.88, 0.95];
    stain(x, y - 0.1, w);
    rect(g, x - 0.12, y - 0.06, w + 0.24, h + 0.18, STONE);
    rect(g, x - 0.2, y - 0.15, w + 0.4, 0.12, STONE2);
    glass(x, y, w, h);
    for (let k = 1; k < 5; k++) {
      rect(g, x + (k * w) / 5 - 0.02, y, 0.04, h, '#26221e');
      rect(gm, x + (k * w) / 5 - 0.02, y, 0.04, h, '#000');
    }
  });
  cell(2, 0, () => {
    plinth();
  });
  cell(3, 0, () => {
    plinth();
    arch(g, 0.3, 0, 2.0, 2.8, STONE);
    const gr = g.createLinearGradient(0, 0, 0, 2.6);
    gr.addColorStop(0, '#1c1612');
    gr.addColorStop(1, '#2e251e');
    arch(g, 0.44, 0, 1.72, 2.62, gr);
    arch(gm, 0.44, 0.85, 1.72, 1.77, '#8a8a8a');
    rect(g, 0.44, 0, 1.72, 0.86, '#5a4130');
    rect(g, 0.44, 0.82, 1.72, 0.06, '#3e2c20');
    rect(g, 1.22, 2.55, 0.16, 0.27, '#e2dccf');
  });
  return { c, mask };
}

// Gondor's banner: black, the White Tree, the seven stars over it and the
// crown; cut in a swallowtail at the foot (transparent there).
function bannerCanvas(W = 128) {
  const H = W * 2;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#0d0d10';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(W, 0);
  g.lineTo(W, H);
  g.lineTo(W / 2, H * 0.86);
  g.lineTo(0, H);
  g.closePath();
  g.fill();
  g.strokeStyle = '#8a8478';
  g.lineWidth = W * 0.02;
  g.stroke();
  const ink = '#ece8dc';
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineCap = 'round';
  g.save();
  g.translate(W / 2, H * 0.74);
  g.scale(W / 100, W / 100);
  const branch = (x, y, a, len, w, depth) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + 0.25) * len * 0.5, y + Math.sin(a + 0.25) * len * 0.5, x2, y2);
    g.stroke();
    if (depth > 0) {
      branch(x2, y2, a - 0.5, len * 0.74, w * 0.68, depth - 1);
      branch(x2, y2, a + 0.5, len * 0.74, w * 0.68, depth - 1);
    } else {
      g.beginPath();
      g.arc(x2, y2, 1.6, 0, TAU);
      g.fill();
    }
  };
  branch(0, 4, -Math.PI / 2, 26, 7, 0);
  for (const s of [-1, 1]) {
    branch(0, -18, -Math.PI / 2 + s * 0.42, 20, 4.6, 3);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(0, 2);
    g.quadraticCurveTo(s * 8, 6, s * 14, 10);
    g.stroke();
  }
  branch(0, -20, -Math.PI / 2, 18, 4, 3);
  g.restore();
  // the stars
  const star = (cx, cy, r) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.42 : r;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  };
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (Math.PI * (i + 0.5)) / 7;
    star(W / 2 + Math.cos(a) * W * 0.38, H * 0.36 + Math.sin(a) * W * 0.3, W * 0.045);
  }
  // the crown
  g.beginPath();
  const cy = H * 0.07;
  g.moveTo(W * 0.36, cy + W * 0.12);
  g.lineTo(W * 0.64, cy + W * 0.12);
  for (let i = 4; i >= 0; i--) {
    const x = W * 0.36 + (W * 0.28 * i) / 4;
    g.lineTo(x, cy + (i % 2 ? W * 0.05 : 0));
  }
  g.closePath();
  g.fill();
  return c;
}

// The great doors: plates of black iron in panels, their edges standing
// proud, rivets along them.
function doorCanvas(S) {
  const c = makeCanvas(S, S * 2);
  const n = makeNoise(71);
  paintPixels(c, (u, v, out) => {
    const m = fbm(n, u * 6, v * 12, { period: 6, octaves: 4 });
    const k = 30 + m * 26;
    out[0] = k;
    out[1] = k;
    out[2] = k * 1.08;
  });
  const g = c.getContext('2d');
  const cols = 2;
  const rows = 6;
  const pw = S / cols;
  const ph = (S * 2) / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = i * pw;
      const y = j * ph;
      g.fillStyle = 'rgba(255, 255, 255, 0.07)';
      g.fillRect(x + pw * 0.06, y + ph * 0.06, pw * 0.88, ph * 0.04);
      g.fillRect(x + pw * 0.06, y + ph * 0.06, pw * 0.04, ph * 0.88);
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      g.fillRect(x + pw * 0.06, y + ph * 0.9, pw * 0.88, ph * 0.04);
      g.fillRect(x + pw * 0.9, y + ph * 0.06, pw * 0.04, ph * 0.88);
      g.fillStyle = '#7a7a80';
      for (let k = 0; k <= 6; k++) {
        for (const [rx, ry] of [
          [x + pw * 0.08 + (pw * 0.84 * k) / 6, y + ph * 0.08],
          [x + pw * 0.08 + (pw * 0.84 * k) / 6, y + ph * 0.92],
        ]) {
          g.beginPath();
          g.arc(rx, ry, S * 0.008, 0, TAU);
          g.fill();
        }
      }
    }
  }
  return c;
}

// The Court of the Fountain's pavement, all of it in one picture (68 m
// across): pale flags, the processional way from the hall's doors out to
// the prow bordered in grey-blue stone with lozenges down it, rings round
// the tree and the fountain, a band round the edge.
function courtCanvas(S) {
  const R = 34;
  const n = makeNoise(61);
  const c = paintPixels(makeCanvas(S), (u, v, out) => {
    const x = (u - 0.5) * 2 * R;
    const z = (v - 0.5) * 2 * R;
    const row = Math.floor(z / 1.0);
    const off = (row & 1) * 0.75;
    const fx = (x + off) / 1.5 - Math.floor((x + off) / 1.5);
    const fz = z - row;
    const j = Math.min(fx * 1.5, (1 - fx) * 1.5, fz, 1 - fz);
    const id = hash2(Math.floor((x + off) / 1.5), row, 3);
    const m = fbm(n, u * 40, v * 40, { period: 40, octaves: 2 });
    let k = 0.84 + id * 0.1 + (m - 0.5) * 0.12;
    k *= 0.74 + 0.26 * smooth(0.012, 0.045, j);
    out[0] = 230 * k;
    out[1] = 228 * k;
    out[2] = 222 * k;
  });
  const g = c.getContext('2d');
  g.setTransform(S / (2 * R), 0, 0, S / (2 * R), S / 2, S / 2);
  const band = '#9ca3ac';
  const pale = 'rgba(214, 214, 208, 0.9)';
  const ring = (cx, cz, r0, r1, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    g.arc(cx, cz, r1, 0, TAU);
    g.arc(cx, cz, r0, 0, TAU, true);
    g.fill();
  };
  // the way
  g.fillStyle = band;
  g.fillRect(HALL_HOUSE.x1, -3.6, R - HALL_HOUSE.x1 + 1, 0.4);
  g.fillRect(HALL_HOUSE.x1, 3.2, R - HALL_HOUSE.x1 + 1, 0.4);
  for (let x = HALL_HOUSE.x1 + 2.4; x < R; x += 3.2) {
    if (Math.hypot(x - TREE.x, 0) < 5.4 || Math.hypot(x - FOUNTAIN.x, 0) < 4.2) continue;
    g.fillStyle = 'rgba(150, 156, 166, 0.55)';
    g.beginPath();
    g.moveTo(x - 1.2, 0);
    g.lineTo(x, -1.6);
    g.lineTo(x + 1.2, 0);
    g.lineTo(x, 1.6);
    g.closePath();
    g.fill();
    g.fillStyle = pale;
    g.beginPath();
    g.arc(x, 0, 0.35, 0, TAU);
    g.fill();
  }
  // the tree and the fountain
  ring(TREE.x, TREE.z, TREE.lawn + 0.9, TREE.lawn + 1.35, band);
  ring(TREE.x, TREE.z, TREE.lawn + 3.4, TREE.lawn + 3.6, band);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    g.strokeStyle = 'rgba(150, 156, 166, 0.7)';
    g.lineWidth = 0.14;
    g.beginPath();
    g.moveTo(TREE.x + Math.cos(a) * (TREE.lawn + 1.35), Math.sin(a) * (TREE.lawn + 1.35));
    g.lineTo(TREE.x + Math.cos(a) * (TREE.lawn + 3.4), Math.sin(a) * (TREE.lawn + 3.4));
    g.stroke();
  }
  ring(FOUNTAIN.x, FOUNTAIN.z, FOUNTAIN.r + 0.6, FOUNTAIN.r + 1.0, band);
  // round the edge, and before the hall
  ring(0, 0, 29.4, 30.2, band);
  ring(0, 0, 28.4, 28.6, band);
  g.fillStyle = band;
  g.fillRect(HALL_HOUSE.x1, HALL_HOUSE.z0 - 1.2, 0.4, HALL_HOUSE.z1 - HALL_HOUSE.z0 + 2.4);
  return c;
}

// The hall's floor, one bay of it (17 m across, 6 m along, repeating down
// the hall): polished black, a runner of white marble down the middle with a
// black lozenge at each pair of pillars and a ring at each pair of kings, white
// bands beside the pillars, chequers in the aisles.
function hallFloorCanvas(S) {
  const W = S;
  const H = Math.round((S * 6) / 17);
  const n = makeNoise(81);
  const c = paintPixels(makeCanvas(W, H), (u, v, out) => {
    const m = fbm(n, u * 6, v * 2, { period: 2, octaves: 3 });
    const vein = Math.pow(ridge(n, u * 4 + 3, v * 1.4, { period: 2, octaves: 3 }), 18);
    const k = 14 + m * 12 + vein * 50;
    out[0] = k;
    out[1] = k;
    out[2] = k * 1.06;
  });
  const white = makeCanvas(128);
  const wn = makeNoise(83);
  paintPixels(white, (u, v, out) => {
    const m = fbm(wn, u * 4, v * 4, { period: 4, octaves: 4 });
    const vein = Math.pow(ridge(wn, u * 3, v * 3, { period: 3, octaves: 4 }), 16);
    const k = 0.86 + m * 0.12 - vein * 0.25;
    out[0] = 236 * k;
    out[1] = 234 * k;
    out[2] = 228 * k;
  });
  const g = c.getContext('2d');
  const pat = g.createPattern(white, 'repeat');
  g.setTransform(W / 17, 0, 0, H / 6, W / 2, H / 2);
  const poly = (pts, fill) => {
    g.fillStyle = fill;
    g.beginPath();
    pts.forEach(([x, z], i) => (i ? g.lineTo(x, z) : g.moveTo(x, z)));
    g.closePath();
    g.fill();
  };
  const black = '#121214';
  // the runner
  g.fillStyle = pat;
  g.fillRect(-3, -3, 6, 6);
  poly(
    [
      [0, -2.5],
      [2.5, 0],
      [0, 2.5],
      [-2.5, 0],
    ],
    black,
  );
  poly(
    [
      [0, -1.7],
      [1.7, 0],
      [0, 1.7],
      [-1.7, 0],
    ],
    pat,
  );
  g.fillStyle = black;
  g.beginPath();
  g.arc(0, 0, 0.8, 0, TAU);
  g.fill();
  for (const z of [-3, 3]) {
    g.fillStyle = black;
    g.beginPath();
    g.arc(0, z, 1.25, 0, TAU);
    g.fill();
    g.fillStyle = pat;
    g.beginPath();
    g.arc(0, z, 0.9, 0, TAU);
    g.fill();
  }
  g.fillStyle = black;
  g.fillRect(-3.0, -3, 0.12, 6);
  g.fillRect(2.88, -3, 0.12, 6);
  // the bands and the pillars' squares
  g.fillStyle = pat;
  for (const s of [-1, 1]) {
    g.fillRect(s * 3.4 - 0.1, -3, 0.2, 6);
    g.fillRect(s * 4.75 - 0.12, -3, 0.24, 6);
    g.lineWidth = 0.16;
    g.strokeStyle = pat;
    g.strokeRect(s * 6 - 1.15, -1.15, 2.3, 2.3);
    // chequers in the aisle
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 8; j++) {
        if ((i + j) % 2) continue;
        g.fillRect(s > 0 ? 7.0 + i * 0.75 : -8.5 + i * 0.75, -3 + j * 0.75, 0.75, 0.75);
      }
    }
  }
  return c;
}

// Grass for the tree's lawn.
function grassCanvas(S) {
  const n = makeNoise(91);
  const sn = stretchNoise(93);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const m = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const blade = sfbm(sn, u * 96, v * 24, 96, 24, 2);
    const k = 0.6 + m * 0.3 + blade * 0.25;
    out[0] = 64 * k;
    out[1] = 104 * k;
    out[2] = 46 * k;
  });
}

// The dead tree's bark: pale, nearly white, split along its length.
function barkCanvas(S) {
  const n = makeNoise(97);
  const sn = stretchNoise(99);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const fiss = Math.pow(1 - Math.abs(sfbm(sn, u * 2, v * 14, 2, 14, 3) * 2 - 1), 6);
    const m = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const k = 0.84 + m * 0.14 - fiss * 0.32;
    out[0] = 242 * k;
    out[1] = 240 * k;
    out[2] = 234 * k;
    field[y * S + x] = 1 - fiss * 0.8 + m * 0.2;
  });
  return { c, field };
}

// Embers, for the beacon's brushwood as it catches: glowing cracks and
// hot spots in the dark, for an emissive map.
function emberCanvas(S) {
  const n = makeNoise(107);
  const cells = makeCells(109);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const k = cells(u * 6, v * 6, 6);
    const crack = 1 - smooth(0, 0.08, k.f2 - k.f1);
    const hot = smooth(0.45, 0.85, fbm(n, u * 4, v * 4, { period: 4, octaves: 3 }));
    const e = clamp01(crack * (0.4 + hot) + hot * 0.5);
    out[0] = 255 * e;
    out[1] = 255 * e * e * 0.8;
    out[2] = 255 * e * e * e * 0.4;
  });
}
// Ripples, for water: a height field of soft rings and swell.
function rippleField(S) {
  const n = makeNoise(101);
  const field = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      field[y * S + x] = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 }) * 0.7 + Math.sin((u + fbm(n, u * 3, v * 3, { period: 3 }) * 0.4) * TAU * 4) * 0.08;
    }
  }
  return field;
}
// A falling sheet of water: bright streaks running down.
function fallCanvas(S) {
  const sn = stretchNoise(103);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const s = sfbm(sn, u * 24, v * 2, 24, 2, 3);
    const k = smooth(0.3, 0.9, s);
    out[0] = 200 + 55 * k;
    out[1] = 220 + 35 * k;
    out[2] = 235 + 20 * k;
    out[3] = 60 + 170 * k;
  });
}

// What glossy things see: a room, dark below and paler above, with panels of
// light in it (windows, fires).
function envRoom(renderer, low, high, lamps) {
  const room = new THREE.Scene();
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(low[0] + (high[0] - low[0]) * k, low[1] + (high[1] - low[1]) * k, low[2] + (high[2] - low[2]) * k);
  }
  walls.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  room.add(new THREE.Mesh(walls, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [hex, k, w, h, at] of lamps) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...at);
    m.lookAt(0, 0, 0);
    room.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  room.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  return env;
}

// The houses’ pitched roofs’ eaves and ridge, in metres (the gables are
// built to them and roofShader slopes the slates’ normals by them).
const EAVE = 0.4;
const RIDGE = 1.5;

// ── the houses ──

// The unit house: walls, a cornice round the top, a parapet (shown on the
// flat-roofed), the flat roof, a chimney (on some), and gable ends (on the
// pitched). Each vertex: a unit position, an offset in metres, a part.
function houseGeometries() {
  const body = { P: [], O: [], N: [], A: [] };
  const roof = { P: [], O: [], N: [], A: [] };
  const TYP = [5, 8, 7];
  // a quad: four corners [x, y, z, ox, oy, oz], the normal stored, the
  // direction it really faces (to wind it by), its part
  const quad = (buf, cs, n, part, face = n) => {
    const w = cs.map((c) => [c[0] * TYP[0] + c[3], c[1] * TYP[1] + c[4], c[2] * TYP[2] + c[5]]);
    const e1 = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]];
    const e2 = [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const ok = cr[0] * face[0] + cr[1] * face[1] + cr[2] * face[2] >= 0;
    const order = cs.length === 3 ? (ok ? [0, 1, 2] : [0, 2, 1]) : ok ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
    for (const i of order) {
      buf.P.push(cs[i][0], cs[i][1], cs[i][2]);
      buf.O.push(cs[i][3], cs[i][4], cs[i][5]);
      buf.N.push(n[0], n[1], n[2]);
      buf.A.push(part);
    }
  };
  const C = (x, y, z, ox = 0, oy = 0, oz = 0) => [x, y, z, ox, oy, oz];
  // the walls
  quad(body, [C(0.5, 0, -0.5), C(0.5, 0, 0.5), C(0.5, 1, 0.5), C(0.5, 1, -0.5)], [1, 0, 0], 0);
  quad(body, [C(-0.5, 0, -0.5), C(-0.5, 0, 0.5), C(-0.5, 1, 0.5), C(-0.5, 1, -0.5)], [-1, 0, 0], 0);
  quad(body, [C(-0.5, 0, 0.5), C(0.5, 0, 0.5), C(0.5, 1, 0.5), C(-0.5, 1, 0.5)], [0, 0, 1], 0);
  quad(body, [C(-0.5, 0, -0.5), C(0.5, 0, -0.5), C(0.5, 1, -0.5), C(-0.5, 1, -0.5)], [0, 0, -1], 0);
  // the cornice and the parapet, side by side
  const E = 0.2;
  const CH = 0.34;
  const PT = 0.3;
  const PH = 0.72;
  for (const [ax, s] of [
    ['x', 1],
    ['x', -1],
    ['z', 1],
    ['z', -1],
  ]) {
    const P = (t, out, along, yo) => (ax === 'x' ? C(s * 0.5, 1, t, s * out, yo, along) : C(t, 1, s * 0.5, along, yo, s * out));
    const n = ax === 'x' ? [s, 0, 0] : [0, 0, s];
    const inN = [-n[0], 0, -n[2]];
    quad(body, [P(-0.5, E, -E, -CH), P(0.5, E, E, -CH), P(0.5, E, E, 0), P(-0.5, E, -E, 0)], n, 1);
    quad(body, [P(-0.5, 0, 0, -CH), P(0.5, 0, 0, -CH), P(0.5, E, E, -CH), P(-0.5, E, -E, -CH)], [0, -1, 0], 1);
    quad(body, [P(-0.5, 0, 0, 0), P(0.5, 0, 0, 0), P(0.5, E, E, 0), P(-0.5, E, -E, 0)], [0, 1, 0], 1);
    quad(body, [P(-0.5, 0, 0, 0), P(0.5, 0, 0, 0), P(0.5, 0, 0, PH), P(-0.5, 0, 0, PH)], n, 3);
    quad(body, [P(-0.5, 0, 0, PH), P(0.5, 0, 0, PH), P(0.5, -PT, -PT, PH), P(-0.5, -PT, PT, PH)], [0, 1, 0], 3);
    quad(body, [P(-0.5, -PT, PT, 0), P(0.5, -PT, -PT, 0), P(0.5, -PT, -PT, PH), P(-0.5, -PT, PT, PH)], inN, 3);
  }
  // the flat roof
  quad(body, [C(-0.5, 1, -0.5, 0, 0.01, 0), C(0.5, 1, -0.5, 0, 0.01, 0), C(0.5, 1, 0.5, 0, 0.01, 0), C(-0.5, 1, 0.5, 0, 0.01, 0)], [0, 1, 0], 2);
  // a chimney, at the back
  {
    const [cx, cz] = [-0.22, 0.26];
    const q = (a, b, c, d, n) => quad(body, [C(cx, 1, cz, ...a), C(cx, 1, cz, ...b), C(cx, 1, cz, ...c), C(cx, 1, cz, ...d)], n, 4);
    const h0 = -0.4;
    const h1 = 1.7;
    const r = 0.36;
    q([r, h0, -r], [r, h0, r], [r, h1, r], [r, h1, -r], [1, 0, 0]);
    q([-r, h0, -r], [-r, h0, r], [-r, h1, r], [-r, h1, -r], [-1, 0, 0]);
    q([-r, h0, r], [r, h0, r], [r, h1, r], [-r, h1, r], [0, 0, 1]);
    q([-r, h0, -r], [r, h0, -r], [r, h1, -r], [-r, h1, -r], [0, 0, -1]);
    q([-r - 0.06, h1, -r - 0.06], [r + 0.06, h1, -r - 0.06], [r + 0.06, h1, r + 0.06], [-r - 0.06, h1, r + 0.06], [0, 1, 0]);
  }
  // gable ends
  for (const s of [-1, 1]) quad(body, [C(-0.5, 1, s * 0.5), C(0.5, 1, s * 0.5), C(0, 1, s * 0.5, 0, RIDGE, 0)], [0, 0, s], 5);

  // the pitched roof: two slopes, their undersides, the fascias and verges
  const OV = 0.3;
  const TH = 0.16;
  for (const s of [-1, 1]) {
    const eave = (z, dy = 0) => C(s * 0.5, 1, z, s * EAVE, 0.02 + dy, z * 2 * OV);
    const top = (z, dy = 0) => C(0, 1, z, 0, RIDGE + 0.02 + dy, z * 2 * OV);
    quad(roof, [eave(-0.5), eave(0.5), top(0.5), top(-0.5)], [s, 1, 0], 0, [s, 1.6, 0]);
    quad(roof, [eave(-0.5, -TH), eave(0.5, -TH), top(0.5, -TH), top(-0.5, -TH)], [-s, -1, 0], 0, [-s, -1.6, 0]);
    quad(roof, [eave(-0.5), eave(0.5), eave(0.5, -TH), eave(-0.5, -TH)], [s, 0, 0], 0);
    for (const e of [-0.5, 0.5]) quad(roof, [eave(e), top(e), top(e, -TH), eave(e, -TH)], [0, 0, Math.sign(e)], 0);
  }
  const make = (b) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(b.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((b.P.length / 3) * 2), 2));
    g.setAttribute('aOff', new THREE.Float32BufferAttribute(b.O, 3));
    g.setAttribute('aPart', new THREE.Float32BufferAttribute(b.A, 1));
    return g;
  };
  return { body: make(body), roof: make(roof) };
}

// All the houses: one instanced mesh of bodies, one of pitched roofs.
function houses(K) {
  const { mats } = K;
  const { body, roof } = houseGeometries();
  const r = rng(733);
  const N = HOUSES.length;
  const seeds = new Float32Array(N);
  const kinds = new Float32Array(N);
  const pitched = [];
  HOUSES.forEach((h, i) => {
    seeds[i] = r();
    kinds[i] = r() < 0.42 ? 1 : 0;
    if (kinds[i]) pitched.push(i);
  });
  body.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  body.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
  const bodies = new THREE.InstancedMesh(body, mats.house, N);
  const roofs = new THREE.InstancedMesh(roof, mats.houseRoof, pitched.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  const TINTS = [
    [1, 1, 1],
    [1, 0.975, 0.92],
    [0.92, 0.935, 0.96],
    [0.99, 0.94, 0.86],
    [0.96, 0.95, 0.93],
  ];
  const SLATES = [
    [0.86, 0.92, 1.02],
    [0.7, 0.73, 0.8],
    [0.96, 0.9, 0.85],
    [0.8, 0.84, 0.9],
  ];
  HOUSES.forEach((h, i) => {
    q.setFromAxisAngle(V3(0, 1, 0), h.face);
    m.compose(V3(h.x, h.y, h.z), q, V3(h.d, h.h, h.w));
    bodies.setMatrixAt(i, m);
    const t = TINTS[Math.floor(r() * TINTS.length)];
    const b = 0.9 + r() * 0.12;
    bodies.setColorAt(i, col.setRGB(t[0] * b, t[1] * b, t[2] * b));
  });
  pitched.forEach((i, j) => {
    bodies.getMatrixAt(i, m);
    roofs.setMatrixAt(j, m);
    const t = SLATES[Math.floor(r() * SLATES.length)];
    const b = 0.85 + r() * 0.25;
    roofs.setColorAt(j, col.setRGB(t[0] * b, t[1] * b, t[2] * b));
  });
  for (const mesh of [bodies, roofs]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  bodies.name = 'houses';
  roofs.name = 'house-roofs';
  return { bodies, roofs };
}

// ── the city's small furniture ──

// A lantern on an iron bracket, out from a wall facing `turn` (its +x out
// of the wall); the flame point back.
function bracketLantern(bk, mats, x, y, z, turn) {
  const c = Math.cos(turn);
  const s = -Math.sin(turn);
  const out = (d, dy = 0) => [x + c * d, y + dy, z + s * d];
  bk.add(mats.iron, tube([out(0, -0.35), out(0.32, -0.05), out(0.5, 0.18)], 0.03, 0.025, { seg: 4, radial: 5 }));
  bk.add(mats.iron, new THREE.BoxGeometry(0.08, 0.08, 0.08), { p: out(0.02, -0.35) });
  bk.add(mats.iron, lathe([[0.01, -0.32], [0.12, -0.28], [0.14, -0.26]], 6), { p: out(0.5, 0.1) });
  bk.add(mats.iron, lathe([[0.15, 0.1], [0.08, 0.2], [0.02, 0.26]], 6), { p: out(0.5, 0.1) });
  bk.add(mats.lampGlass, new THREE.CylinderGeometry(0.11, 0.11, 0.36, 6), { p: out(0.5, -0.06) });
  return V3(...out(0.5, -0.06));
}
// A lantern on an iron post.
function postLantern(bk, mats, x, y, z, h = 1.5) {
  bk.add(mats.iron, lathe([[0.14, 0], [0.1, 0.08], [0.05, 0.2], [0.04, h - 0.1], [0.08, h]], 6), { p: [x, y, z] });
  bk.add(mats.iron, lathe([[0.01, 0], [0.13, 0.04], [0.14, 0.06]], 6), { p: [x, y + h, z] });
  bk.add(mats.lampGlass, new THREE.CylinderGeometry(0.11, 0.12, 0.34, 6), { p: [x, y + h + 0.23, z] });
  bk.add(mats.iron, lathe([[0.16, 0], [0.09, 0.1], [0.02, 0.18]], 6), { p: [x, y + h + 0.4, z] });
  return V3(x, y + h + 0.23, z);
}
// A torch in an iron cup on a bracket.
function bracketTorch(bk, mats, x, y, z, turn) {
  const c = Math.cos(turn);
  const s = -Math.sin(turn);
  const out = (d, dy = 0) => [x + c * d, y + dy, z + s * d];
  bk.add(mats.iron, tube([out(0, -0.5), out(0.25, -0.3), out(0.38, 0)], 0.035, 0.03, { seg: 4, radial: 5 }));
  bk.add(mats.wood, new THREE.CylinderGeometry(0.045, 0.035, 0.7, 6), { p: out(0.4, 0.1) });
  bk.add(mats.iron, lathe([[0.04, 0], [0.11, 0.1], [0.12, 0.2]], 8), { p: out(0.4, 0.35) });
  bk.add(mats.coals, new THREE.CircleGeometry(0.1, 8).rotateX(-Math.PI / 2), { p: out(0.4, 0.53) });
  return V3(...out(0.4, 0.68));
}
// An iron brazier on a short stand.
function brazier(bk, mats, x, y, z, h = 0.9) {
  bk.add(mats.iron, lathe([[0.22, 0], [0.12, 0.08], [0.07, 0.2], [0.07, h - 0.2], [0.14, h - 0.08]], 8), { p: [x, y, z] });
  bk.add(mats.iron, lathe([[0.06, 0], [0.34, 0.1], [0.46, 0.3], [0.48, 0.34], [0.42, 0.34]], 12), { p: [x, y + h - 0.12, z] });
  bk.add(mats.coals, new THREE.CircleGeometry(0.42, 12).rotateX(-Math.PI / 2), { p: [x, y + h + 0.15, z] });
  return V3(x, y + h + 0.32, z);
}
// A banner on a pole with a crossbar, hanging `w` × `h` from it, facing
// `turn` (its face to (sin turn, cos turn)).
function bannerPole(bk, mats, list, x, y, z, turn, w = 1.6, h = 4.2, pole = h + 1.6) {
  bk.add(mats.iron, new THREE.CylinderGeometry(0.05, 0.07, pole, 6), { p: [x, y + pole / 2, z] });
  bk.add(mats.iron, new THREE.SphereGeometry(0.1, 8, 6), { p: [x, y + pole + 0.05, z] });
  const bar = new THREE.CylinderGeometry(0.035, 0.035, w + 0.3, 5).rotateZ(Math.PI / 2).rotateY(turn);
  const top = y + pole - 0.25;
  const fx = Math.sin(turn) * 0.09;
  const fz = Math.cos(turn) * 0.09;
  bk.add(mats.iron, bar, { p: [x + fx, top, z + fz] });
  list.push({ x: x + fx, y: top - 0.04, z: z + fz, turn, w, h });
}
// All the banners as one mesh, swaying.
function bannerMesh(mats, list) {
  const geos = list.map((b, i) => {
    const g = new THREE.PlaneGeometry(b.w, b.h, 3, 8);
    g.translate(0, -b.h / 2, 0);
    const p = g.attributes.position;
    const wave = new Float32Array(p.count * 3);
    for (let k = 0; k < p.count; k++) {
      wave[k * 3] = clamp01(-p.getY(k) / b.h);
      wave[k * 3 + 1] = i * 1.37 + p.getX(k) * 0.4;
      wave[k * 3 + 2] = b.h * 0.07;
    }
    g.setAttribute('aWave', new THREE.BufferAttribute(wave, 3));
    g.rotateY(b.turn);
    g.translate(b.x, b.y, b.z);
    return g;
  });
  const g = mergeAll(geos);
  const mesh = new THREE.Mesh(g, mats.banner);
  mesh.name = 'banners';
  return mesh;
}
// Merge plain geometries (same attributes).
function mergeAll(geos) {
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let count = 0;
  for (const g of flat) count += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const nm of Object.keys(flat[0].attributes)) {
    const size = flat[0].attributes[nm].itemSize;
    const arr = new Float32Array(count * size);
    let o = 0;
    for (const g of flat) {
      arr.set(g.attributes[nm].array, o);
      o += g.attributes[nm].array.length;
    }
    out.setAttribute(nm, new THREE.BufferAttribute(arr, size));
  }
  out.computeBoundingSphere();
  return out;
}

// ── the levels and the walls ──

// The parapet's coping, and the merlons' tops, over each level's walk.
const COPE = PARAPET * 0.7;
const MERLON = PARAPET + 0.18;
// The face of each wall: [dr, y] round from the inner foot, out along the
// bottom, up the battered face with its plinth and string course, over the
// parapet and its coping, down to the walk, in.
function wallProfile(k) {
  const yB = (k === 0 ? 0 : LEVEL_Y[k - 1]) - 0.6;
  const yW = LEVEL_Y[k];
  const T = WALL_T;
  return [
    [-T, yB],
    [0.72, yB],
    [0.72, yB + 1.3],
    [0.42, yB + 1.62],
    [0.3, mix(yB, yW, 0.45)],
    [0.08, yW - 2.6],
    [0, yW - 0.75],
    [0.24, yW - 0.75],
    [0.24, yW - 0.38],
    [0, yW - 0.38],
    [0, yW + COPE - 0.17],
    [0.08, yW + COPE - 0.17],
    [0.08, yW + COPE],
    [-0.88, yW + COPE],
    [-0.88, yW + COPE - 0.17],
    [-0.8, yW + COPE - 0.17],
    [-0.8, yW],
    [-T, yW],
  ];
}
const SHADE = makeNoise(907);
// Vertex colours for wall k: grime at the foot, broad weathering, faint
// streaks; the first wall black, pale only at its top.
function wallShade(k) {
  const y0 = k === 0 ? 0 : LEVEL_Y[k - 1];
  const yW = LEVEL_Y[k];
  return (x, y, z, c) => {
    const r = Math.hypot(x, z);
    const s = Math.atan2(z, x) * r;
    const w = SHADE(s * 0.05 + k * 13.1, y * 0.06);
    const st = SHADE(s * 0.4 + 40.3, k * 3.7);
    const foot = smooth(y0 - 0.5, y0 + 4.5, y);
    const v = (0.76 + 0.24 * foot) * (0.88 + 0.16 * w) * (1 - 0.07 * st);
    if (k === 0) {
      const t = smooth(yW - 2.7, yW - 0.7, y);
      c.setRGB(mix(0.2, 0.86, t) * v, mix(0.21, 0.86, t) * v, mix(0.235, 0.85, t) * v);
    } else c.setRGB(v, v * 0.99, v * 0.97);
  };
}
// A level's pavement, darker at the foot of the wall above it.
function plateShade(rIn) {
  return (x, y, z, c) => {
    const r = Math.hypot(x, z);
    const k = (0.74 + 0.26 * smooth(rIn, rIn + 3, r)) * (0.92 + 0.12 * SHADE(x * 0.08, z * 0.08));
    c.setRGB(k, k * 0.99, k * 0.97);
  };
}
// A ring sector of flat ground at y, its flags laid round the arc.
function ringPlate(r0, r1, a0, a1, y, { step = 2, tile = 6, rings = null } = {}) {
  const rs = rings ?? [r0, r1];
  const n = Math.max(2, Math.ceil(((a1 - a0) * r1) / step));
  const pos = [];
  const uv = [];
  const idx = [];
  const rm = (r0 + r1) / 2;
  for (let i = 0; i < rs.length; i++) {
    for (let j = 0; j <= n; j++) {
      const a = a0 + ((a1 - a0) * j) / n;
      pos.push(Math.cos(a) * rs[i], y, Math.sin(a) * rs[i]);
      uv.push((a * rm) / tile, rs[i] / tile);
    }
  }
  for (let i = 0; i < rs.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j;
      const b = a + n + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const nor = new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0));
  const g = bufferGeo({ pos, nor, uv, idx });
  // facing up?
  const p = g.attributes.position;
  const ax = p.getX(idx[1]) - p.getX(idx[0]);
  const az = p.getZ(idx[1]) - p.getZ(idx[0]);
  const bx = p.getX(idx[2]) - p.getX(idx[0]);
  const bz = p.getZ(idx[2]) - p.getZ(idx[0]);
  if (az * bx - ax * bz < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
  }
  return g;
}

// The prow's half-width at x: ten metres broad, narrowing a little east,
// then to a blade's edge at its point (the Citadel's deck runs out over it).
const prowHalf = (x) => {
  const base = PROW.w / 2;
  if (x <= 112) return base * (1 - 0.06 * clamp01((x - PROW.x0) / (112 - PROW.x0)));
  return base * mix(0.94, 0.14, smooth(112, 130.5, x));
};
const DECK = { x0: 106, x1: 126.4, r: 5, y0: 72.2, top: COURT_Y - 0.1 };

// The braziers on the Citadel's parapet (angles round it); its merlons
// leave room for them.
const CITADEL_BRAZIERS = [-2.3, -1.6, -0.9, 0.95, 1.6, 2.3, Math.PI];
// Where the walls are broken: the gate towers, and the prow going through.
const GATEHOUSE = (k) => (k === 0 ? { wo: 17, H: GATES[0].top + 8, D: 8.4, out: 3.6 } : { wo: GATE_W + 5.6, H: GATES[k].top + 3.2, D: WALL_T + 2.2, out: 1.5 });
function wallPieces(k) {
  const R = WALL_R[k];
  const gaps = [];
  const gh = (GATEHOUSE(k).wo / 2 - 0.25) / R;
  gaps.push([GATE_A[k] - gh, GATE_A[k] + gh]);
  if (k >= 1) {
    const ap = Math.asin(Math.min(0.99, (prowHalf(R - WALL_T / 2) - 0.08) / R));
    gaps.push([-ap, ap]);
  }
  gaps.sort((a, b) => a[0] - b[0]);
  if (k === 6) {
    // round the whole Citadel, from the prow round by the west to the gate
    return [
      [gaps[0][1], gaps[1][0]],
      [gaps[1][1], gaps[0][0] + TAU],
    ];
  }
  const out = [];
  let a = -SPAN;
  for (const [g0, g1] of gaps) {
    if (g0 > a) out.push([a, g0]);
    a = Math.max(a, g1);
  }
  if (a < SPAN) out.push([a, SPAN]);
  return out;
}

// One level: its pavement (the Citadel's its own pattern), its ends where
// the mountain closes it, its wall with merlons and buttresses (and, on the
// first, round towers).
function level(lv, bk, K, k) {
  const { mats, Q } = K;
  const y = LEVEL_Y[k];
  if (k < 6) {
    const r0 = WALL_R[k + 1];
    const r1 = WALL_R[k] - WALL_T;
    const rings = [r0, r0 + 1.2, r0 + 3.2, (r0 + r1) / 2, r1];
    lv.add(mats.paving, ringPlate(r0, r1, -SPAN, SPAN, y, { step: Q.step * 1.6, rings }), { color: plateShade(r0) });
    // the ends: rock, where the hill is cut
    for (const s of [-1, 1]) {
      const a = s * (SPAN + 0.003);
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const pts = [
        [c * r0, -2, sn * r0],
        [c * (r1 + 0.3), -2, sn * (r1 + 0.3)],
        [c * (r1 + 0.3), y, sn * (r1 + 0.3)],
        [c * r0, y, sn * r0],
      ];
      const rm = (r0 + r1) / 2;
      bk.add(mats.rock, quadsFacing([[...pts, [c * rm + s * sn * 5, y / 2, sn * rm - s * c * 5]]]), { uv: 1 / 12, color: 0xf0eee8 });
    }
  } else {
    // the Citadel: one round of court pavement
    const R = WALL_R[6] - WALL_T + 0.02;
    const g = new THREE.CircleGeometry(R, Math.round(96 * Q.around)).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 34) / 68, (34 - p.getZ(i)) / 68);
    g.translate(0, y, 0);
    lv.add(mats.court, g);
  }
  // the wall
  const R = WALL_R[k];
  const prof = wallProfile(k);
  const shade = wallShade(k);
  const yW = LEVEL_Y[k];
  const yB = prof[0][1];
  const merl = [];
  for (const [a0, a1] of wallPieces(k)) {
    lv.add(mats.wall, arcSweep(R, a0, a1, prof, { step: Q.step, tile: 9 }), { color: shade });
    // merlons along the parapet
    const len = (a1 - a0) * (R - 0.4);
    const period = Q.merlons ? 2.1 : 3.2;
    const count = Math.floor((len - 1.2) / period);
    const pad = (len - count * period) / 2;
    for (let i = 0; i <= count; i++) {
      const am = a0 + (pad + i * period) / (R - 0.4);
      const hw = 0.55 / (R - 0.4);
      if (am - hw < a0 || am + hw > a1) continue;
      if (k === 6 && CITADEL_BRAZIERS.some((b) => Math.abs(Math.atan2(Math.sin(am - b), Math.cos(am - b))) < 1.5 / R)) continue;
      arcBlock(merl, R - 0.86, R + 0.06, am - hw, am + hw, yW + COPE, yW + MERLON);
    }
    // buttresses down the face (every 13 m or so), and on the first wall
    // a round tower now and then
    if (k > 0) {
      const bc = Math.floor(len / 13);
      for (let i = 1; i < bc; i++) {
        const am = a0 + (i * (a1 - a0)) / bc;
        const hw = 0.7 / R;
        arcBlock(merl, R - 0.2, R + 0.82, am - hw, am + hw, yB + 1.2, yW - 0.75);
        arcBlock(merl, R - 0.2, R + 0.95, am - hw * 1.15, am + hw * 1.15, yB, yB + 1.45);
      }
    }
  }
  if (merl.length) lv.add(mats.wall, quadsFacing(merl), { uv: 1 / 9, color: shade });
  if (k === 0) {
    // round towers astride the first wall
    for (const a of [-1.42, -0.98, -0.52, 0.52, 0.98, 1.42]) {
      const [cx, cz] = [Math.cos(a) * (R + 0.8), Math.sin(a) * (R + 0.8)];
      const top = yW + 2.6;
      const tprof = [
        [5.4, yB],
        [5.4, yB + 1.4],
        [4.8, yB + 1.8],
        [4.5, top - 0.7],
        [4.78, top - 0.7],
        [4.78, top - 0.32],
        [4.5, top - 0.32],
        [4.5, top],
        [0, top],
      ];
      lv.add(mats.wall, latheM(tprof, Math.round(32 * Q.around), 6), { p: [cx, 0, cz], color: shade });
      const tm = [];
      const n = 16;
      for (let i = 0; i < n; i++) arcBlock(tm, 3.85, 4.58, (TAU * i) / n, (TAU * (i + 0.5)) / n, top, top + 0.75);
      lv.add(mats.wall, quadsFacing(tm).translate(cx, 0, cz), { uv: 1 / 9, color: shade });
    }
  }
}

// The gate tower over gate k: a block straddling the wall from the level
// below to above the arch, the way through it round-headed, the arch ringed
// in pale stone with a keystone, crenels round the top; torches either side
// and banners on top. The Great Gate is bigger: set in a tall recess, with
// towers either side, and its black doors standing open.
function gatehouse(bk, K, k, lamps, banners) {
  const { mats } = K;
  const gate = GATES[k];
  const a = gate.a;
  const R = WALL_R[k];
  const { wo, H, D, out } = GATEHOUSE(k);
  const yB = (k === 0 ? 0 : LEVEL_Y[k - 1]) - 0.6;
  const shade = wallShade(k);
  const ox = Math.cos(a) * R;
  const oz = Math.sin(a) * R;
  const turn = Math.PI / 2 - a;
  // local (along the wall, up, outward) to the city's coordinates
  const W = (lx, ly, lz) => [ox + lx * Math.sin(a) + lz * Math.cos(a), ly, oz - lx * Math.cos(a) + lz * Math.sin(a)];
  const sill = gate.sill;
  const top = gate.top;
  const gw = GATE_W;
  const block = (w, y0, y1, z0, z1, hole) => {
    const sh = new THREE.Shape([new THREE.Vector2(-w / 2, y0), new THREE.Vector2(w / 2, y0), new THREE.Vector2(w / 2, y1), new THREE.Vector2(-w / 2, y1)]);
    if (hole) sh.holes.push(new THREE.Path(hole));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
    return geo.translate(0, 0, z0);
  };
  const torches = [];
  const poles = [];
  const merlons = (cx, cz, w, d, y) => {
    const m = [];
    const nx = Math.max(1, Math.floor(w / 1.7));
    const nz = Math.max(1, Math.floor(d / 1.7));
    for (let i = 0; i <= nx; i++) {
      const x = cx - w / 2 + 0.4 + ((w - 0.8) * i) / nx;
      m.push([x, cz + d / 2 - 0.4], [x, cz - d / 2 + 0.4]);
    }
    for (let i = 1; i < nz; i++) {
      const z = cz - d / 2 + 0.4 + ((d - 0.8) * i) / nz;
      m.push([cx - w / 2 + 0.4, z], [cx + w / 2 - 0.4, z]);
    }
    for (const [x, z] of m) bk.add(mats.wall, new THREE.BoxGeometry(0.8, 0.85, 0.8), { p: [x, y + 0.42, z], uv: 1 / 9, color: shade });
  };
  bk.at([ox, 0, oz], turn, () => {
    if (k === 0) {
      // the recess, its own tall arch, and the gate set back in it
      const rw = 9.6;
      const front = 1.6;
      const crown = sill + 12;
      bk.add(mats.wall, block(wo, yB, H, out - front, out, archPts(rw, crown - sill + 0.4, 0, sill - 0.4, 16)), { uv: 1 / 9, color: shade });
      bk.add(mats.wall, block(wo, yB, H, out - D, out - front, archPts(gw, top - sill + 0.4, 0, sill - 0.4, 14)), { uv: 1 / 9, color: shade });
      bk.add(mats.trim, ringSlice(rw / 2, rw / 2 + 0.7, 0, Math.PI, 0.35, 16), { p: [0, crown - rw / 2, out] });
      bk.add(mats.trim, new THREE.BoxGeometry(1.0, 1.4, 0.55), { p: [0, crown + 0.3, out + 0.14] });
      for (const e of [-1, 1]) bk.add(mats.trim, new THREE.BoxGeometry(1.2, 0.4, 0.5), { p: [e * (rw / 2 + 0.35), crown - rw / 2 - 0.2, out + 0.1] });
      bk.add(mats.trim, ringSlice(gw / 2, gw / 2 + 0.45, 0, Math.PI, 0.25, 12), { p: [0, top - gw / 2, out - front] });
      bk.add(mats.trim, ringSlice(gw / 2, gw / 2 + 0.45, 0, Math.PI, 0.25, 12), { p: [0, top - gw / 2, out - D - 0.25] });
      // a band of pale stone across the gate tower, over the recess
      bk.add(mats.trim, new THREE.BoxGeometry(wo + 0.4, 0.5, D + 0.4), { p: [0, crown + 1.6, out - D / 2], uv: 1 / 4 });
      // the towers either side
      for (const s of [-1, 1]) {
        const tx = s * (wo / 2 + 2.8);
        const th = H - 2.5;
        bk.add(mats.wall, new THREE.BoxGeometry(6, th - yB, 7.6), { p: [tx, (yB + th) / 2, 0.2], uv: 1 / 9, color: shade });
        bk.add(mats.wall, new THREE.BoxGeometry(6.6, 1.4, 8.2), { p: [tx, yB + 0.7, 0.2], uv: 1 / 9, color: shade });
        bk.add(mats.trim, new THREE.BoxGeometry(6.4, 0.45, 8), { p: [tx, th - 0.6, 0.2], uv: 1 / 4 });
        bk.add(mats.trim, new THREE.BoxGeometry(6.3, 0.35, 7.9), { p: [tx, LEVEL_Y[0] + COPE, 0.2], uv: 1 / 4 });
        merlons(tx, 0.2, 6, 7.6, th);
        for (const yy of [LEVEL_Y[0] + 4.5, LEVEL_Y[0] + 8]) bk.add(mats.glass, new THREE.PlaneGeometry(0.4, 1.4), { p: [tx, yy, 0.2 + 3.81] });
        poles.push([tx, th, 0.2, 1.8, 5.2, 6.8]);
      }
      // the doors, open: black iron, hung at the inner face and swung in
      const lw = gw / 2 - 0.05;
      const lh = top - sill;
      const leaf = new THREE.Shape();
      leaf.moveTo(0, 0);
      leaf.lineTo(lw, 0);
      leaf.lineTo(lw, lh);
      for (let i = 1; i <= 10; i++) {
        const t = Math.PI / 2 + (Math.PI / 2) * (i / 10);
        leaf.lineTo(lw + Math.cos(t) * lw, lh - lw + Math.sin(t) * lw);
      }
      leaf.closePath();
      const lgeo = new THREE.ExtrudeGeometry(leaf, { depth: 0.4, bevelEnabled: false, curveSegments: 1 });
      const uv = lgeo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / lw, uv.getY(i) / lh);
      const zi = out - D - 0.02;
      for (const s of [-1, 1]) {
        const phi = ((s < 0 ? 100 : 80) * Math.PI) / 180;
        bk.add(mats.door, lgeo.clone().rotateY(phi), { p: [s * (gw / 2), sill, zi] });
        // a ring and a boss on the face towards the road
        const toward = s < 0 ? 0.46 : -0.06;
        const hx = s * (gw / 2) + Math.cos(phi) * lw * 0.72 + Math.sin(phi) * toward;
        const hz = zi - Math.sin(phi) * lw * 0.72 + Math.cos(phi) * toward;
        bk.add(mats.iron, new THREE.TorusGeometry(0.3, 0.06, 6, 14).rotateY(phi), { p: [hx, sill + 3.1, hz] });
        bk.add(mats.iron, new THREE.SphereGeometry(0.16, 8, 6), { p: [hx, sill + 3.5, hz] });
      }
      // torches out front either side of the recess, and inside the gate
      for (const s of [-1, 1]) {
        torches.push([s * (rw / 2 + 1.5), sill + 3.4, out, -Math.PI / 2]);
        torches.push([s * (gw / 2 + 1.6), sill + 3.4, out - D, Math.PI / 2]);
      }
      for (const s of [-1, 1]) poles.push([s * 4.6, H, out - 1.4, 2.0, 6.5, 9]);
    } else {
      bk.add(mats.wall, block(wo, yB, H, out - D, out, archPts(gw, top - sill + 0.4, 0, sill - 0.4, 14)), { uv: 1 / 9, color: shade });
      for (const z of [out, out - D - 0.3]) bk.add(mats.trim, ringSlice(gw / 2, gw / 2 + 0.55, 0, Math.PI, 0.3, 12), { p: [0, top - gw / 2, z] });
      bk.add(mats.trim, new THREE.BoxGeometry(0.7, 1.0, 0.45), { p: [0, top + 0.25, out + 0.1] });
      for (const s of [-1, 1]) {
        bk.add(mats.trim, new THREE.BoxGeometry(0.75, 0.32, D + 0.5), { p: [s * (gw / 2 + 0.38), top - gw / 2 - 0.16, out - D / 2] });
        torches.push([s * (gw / 2 + 1.25), sill + 3.3, out, -Math.PI / 2]);
      }
      // the parapet's coping runs on round the tower
      bk.add(mats.trim, new THREE.BoxGeometry(wo + 0.3, 0.3, D + 0.3), { p: [0, LEVEL_Y[k] + COPE + 3.2, out - D / 2], uv: 1 / 4 });
      for (const s of [-1, 1]) poles.push([s * (wo / 2 - 1.1), H, out - D / 2, 1.5, 4, 5.6]);
    }
    // the cornice and plinth, and the crenels round the top
    bk.add(mats.trim, new THREE.BoxGeometry(wo + 0.5, 0.45, D + 0.5), { p: [0, H - 0.6, out - D / 2], uv: 1 / 4 });
    bk.add(mats.wall, new THREE.BoxGeometry(wo + 0.6, 1.3, D + 0.6), { p: [0, yB + 0.65, out - D / 2], uv: 1 / 9, color: shade });
    merlons(0, out - D / 2, wo, D, H);
    for (const [x, y, z, tt] of torches) {
      const p = bracketTorch(bk, mats, x, y, z, tt);
      lamps.push(V3(...W(p.x, p.y, p.z)));
    }
  });
  for (const [x, y, z, w, h, pole] of poles) bannerPole(bk, mats, banners, ...W(x, y, z), turn, w, h, pole);
}

// ── the prow ──
// The great blade of rock, one piece: its side elevation (a stepped
// outline, each step down to a level's ground, the tunnels cut up into it)
// pushed through its breadth and narrowed to the point. Then the deck at its
// end, the walk along its top with its parapets, the corbels under the deck,
// the lanterns.
function prow(bk, K, lamps, banners) {
  const { mats } = K;
  const top = COURT_Y - 0.1;
  const pts = [];
  const put = (x, y) => {
    const l = pts[pts.length - 1];
    if (!l || Math.hypot(l[0] - x, l[1] - y) > 0.01) pts.push([x, y]);
  };
  for (let x = PROW.x0; x < DECK.x0; x += 2) put(x, top);
  put(DECK.x0, top);
  put(DECK.x0, DECK.y0);
  for (let x = DECK.x0 + 2; x < 130.5; x += 2) put(x, DECK.y0);
  put(130.5, DECK.y0);
  // down the nose, then back west along the bottom, a level at a time, the
  // tunnels cut up into it
  for (let y = DECK.y0 - 8; y > LEVEL_Y[0]; y -= 8) put(130.5, y);
  for (let k = 0; k <= 5; k++) {
    const xa = k === 5 ? PROW.x0 : WALL_R[k + 1] - WALL_T;
    const xb = Math.min(130.5, WALL_R[k] - WALL_T);
    if (xb <= xa) continue;
    const y = LEVEL_Y[k] - 0.5;
    const t = TUNNELS.find((u) => u.k === k);
    // stops along the bottom, east to west, the tunnel in its place
    const stops = [];
    for (let x = xb; x > xa + 0.5; x -= 2) if (!t || Math.abs(x - t.x) > t.w / 2 + 0.6) stops.push({ x, fn: () => put(x, y) });
    if (t) {
      stops.push({
        x: t.x,
        fn: () => {
          const r = t.w / 2;
          const spring = t.y + t.h - r;
          put(t.x + r, y);
          put(t.x + r, spring);
          for (let i = 1; i < 14; i++) {
            const an = (Math.PI * i) / 14;
            put(t.x + Math.cos(an) * r, spring + Math.sin(an) * r);
          }
          put(t.x - r, spring);
          put(t.x - r, y);
        },
      });
    }
    stops.sort((p0, p1) => p1.x - p0.x);
    for (const st of stops) st.fn();
    put(xa, y);
    if (k < 5) put(xa, LEVEL_Y[k + 1] - 0.5);
  }
  // the west end, under the Citadel
  put(PROW.x0, top - 4);
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: PROW.w, bevelEnabled: false, curveSegments: 1 });
  geo.translate(0, 0, -PROW.w / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, (p.getZ(i) * prowHalf(p.getX(i))) / (PROW.w / 2));
  geo.deleteAttribute('normal');
  const ng = geo.toNonIndexed();
  ng.computeVertexNormals();
  const rockShade = (x, y, z, c) => {
    const k = (0.8 + 0.2 * smooth(0, 30, y - 10)) * (0.92 + 0.14 * SHADE(x * 0.04, y * 0.05 + z * 0.1));
    c.setRGB(k, k, k * 0.98);
  };
  bk.add(mats.rock, ng, { uv: 1 / 16, color: rockShade });

  // each tunnel's mouths ringed in dressed stone, a keystone at the crown
  for (const t of TUNNELS) {
    const r = t.w / 2;
    const spring = t.y + t.h - r;
    const hw = prowHalf(t.x);
    for (const side of [-1, 1]) {
      const ring = ringSlice(r, r + 0.75, 0, Math.PI, 0.35, 14);
      if (side < 0) ring.rotateY(Math.PI);
      bk.add(mats.trim, ring, { p: [t.x, spring, side * (hw - 0.1)], uv: 1 / 3 });
      bk.add(mats.trim, new THREE.BoxGeometry(0.8, 1.1, 0.5), { p: [t.x, t.y + t.h + 0.3, side * (hw + 0.1)], uv: 1 / 3 });
      for (const e of [-1, 1]) bk.add(mats.trim, new THREE.BoxGeometry(0.95, 0.35, 0.45), { p: [t.x + e * (r + 0.38), spring - 0.18, side * (hw + 0.05)], uv: 1 / 3 });
    }
  }
  // the deck at the point: a slab, rounded at its end, four metres thick
  const deck = new THREE.Shape();
  deck.moveTo(DECK.x0, -DECK.r);
  deck.lineTo(DECK.x1, -DECK.r);
  for (let i = 1; i <= 16; i++) {
    const an = -Math.PI / 2 + (Math.PI * i) / 16;
    deck.lineTo(DECK.x1 + Math.cos(an) * DECK.r, Math.sin(an) * DECK.r);
  }
  deck.lineTo(DECK.x0, DECK.r);
  deck.closePath();
  const dg = new THREE.ExtrudeGeometry(deck, { depth: DECK.top - DECK.y0, bevelEnabled: false, curveSegments: 1 });
  dg.rotateX(-Math.PI / 2).translate(0, DECK.y0, 0);
  bk.add(mats.wall, dg, { uv: 1 / 9, color: 0xf2efe8 });
  // a moulding round its foot, and corbels under the overhang
  const rim = (t) => {
    // a point on the deck's edge, t from 0 (north side at x0) round the nose to 1 (south side)
    const L1 = DECK.x1 - DECK.x0;
    const L2 = Math.PI * DECK.r;
    const s = t * (2 * L1 + L2);
    if (s < L1) return [DECK.x0 + s, -DECK.r, 0, -1];
    if (s < L1 + L2) {
      const an = -Math.PI / 2 + ((s - L1) / L2) * Math.PI;
      return [DECK.x1 + Math.cos(an) * DECK.r, Math.sin(an) * DECK.r, Math.cos(an), Math.sin(an)];
    }
    return [DECK.x1 - (s - L1 - L2), DECK.r, 0, 1];
  };
  const total = 2 * (DECK.x1 - DECK.x0) + Math.PI * DECK.r;
  const nC = Math.floor(total / 1.5);
  for (let i = 1; i < nC; i++) {
    const [x, z, nx, nz] = rim(i / nC);
    const turn = Math.atan2(-nz, nx);
    const c = new THREE.BoxGeometry(0.55, 1.2, 0.6).rotateY(turn);
    bk.add(mats.trim, c, { p: [x - nx * 0.3, DECK.y0 - 0.6, z - nz * 0.3], uv: 1 / 3 });
    const c2 = new THREE.BoxGeometry(0.4, 0.8, 0.4).rotateY(turn);
    bk.add(mats.trim, c2, { p: [x - nx * 0.45, DECK.y0 - 1.6, z - nz * 0.45], uv: 1 / 3 });
  }
  // the walk's paving, along the top and over the deck
  const walk = new THREE.Shape();
  const wpts = [];
  for (let x = WALL_R[6] - WALL_T + 0.04; x <= DECK.x0; x += 4) wpts.push([x, prowHalf(x)]);
  wpts.push([DECK.x0, DECK.r]);
  for (let i = 0; i <= 16; i++) {
    const an = Math.PI / 2 - (Math.PI * i) / 16;
    wpts.push([DECK.x1 + Math.cos(an) * DECK.r, Math.sin(an) * DECK.r]);
  }
  wpts.push([DECK.x0, -DECK.r]);
  for (let x = DECK.x0; x >= WALL_R[6] - WALL_T + 0.04; x -= 4) wpts.push([x, -prowHalf(x)]);
  wpts.forEach(([x, z], i) => (i ? walk.lineTo(x, -z) : walk.moveTo(x, -z)));
  const wg = new THREE.ShapeGeometry(walk).rotateX(-Math.PI / 2).translate(0, COURT_Y, 0);
  bk.add(mats.paving, wg, { uv: 1 / 6, color: 0xf0ede6 });
  // the parapets: along the top, then round the deck
  const par = [];
  const PT = 0.62;
  const ph = 1.05;
  for (const s of [-1, 1]) {
    for (let x = WALL_R[6]; x < DECK.x0; x += 3) {
      const x1 = Math.min(DECK.x0, x + 3);
      const z0 = s * prowHalf(x);
      const z1 = s * prowHalf(x1);
      par.push(slab(x, z0 - s * PT * 0.5, x1, z1 - s * PT * 0.5, PT, COURT_Y - 0.05, COURT_Y + ph));
    }
    par.push(slab(DECK.x0, s * (DECK.r - PT / 2), DECK.x1, s * (DECK.r - PT / 2), PT, COURT_Y - 0.05, COURT_Y + ph));
  }
  for (let i = 0; i < 16; i++) {
    const a0 = -Math.PI / 2 + (Math.PI * i) / 16;
    const a1 = a0 + Math.PI / 16;
    const x0 = DECK.x1 + Math.cos(a0) * (DECK.r - PT / 2);
    const z0 = Math.sin(a0) * (DECK.r - PT / 2);
    const x1 = DECK.x1 + Math.cos(a1) * (DECK.r - PT / 2);
    const z1 = Math.sin(a1) * (DECK.r - PT / 2);
    par.push(slab(x0, z0, x1, z1, PT, COURT_Y - 0.05, COURT_Y + ph));
  }
  for (const g of par) bk.add(mats.wall, g, { uv: 1 / 9, color: 0xf4f1ea });
  // lanterns on the parapets, and on the deck banners either side
  for (const s of [-1, 1]) {
    for (const x of [48, 72, 96]) lamps.push(postLantern(bk, mats, x, COURT_Y + ph, s * (prowHalf(x) - PT * 0.5)));
    bannerPole(bk, mats, banners, DECK.x1 + 1.6, COURT_Y, s * (DECK.r - 0.9), Math.PI / 2 - 0.2 * s, 1.4, 3.8);
  }
  for (const s of [-1, 1]) {
    const an = s * 0.8;
    const x = DECK.x1 + Math.cos(an) * (DECK.r - PT / 2);
    const z = Math.sin(an) * (DECK.r - PT / 2);
    lamps.push(brazier(bk, mats, x, COURT_Y + ph, z, 0.5));
  }
}

// ── the road ──
// A ribbon of cobbles along the road, a hand's breadth over the pavement;
// where it climbs on a ramp, retaining walls down to the ground and a low
// parapet along its edges.
function road(bk, K) {
  const { mats } = K;
  const { pts, s } = ROAD;
  const hw = ROAD_W / 2;
  const ground = (x, z) => {
    const k = levelOf(x, z);
    return k < 0 ? 0 : LEVEL_Y[k];
  };
  const pos = [];
  const uv = [];
  const idx = [];
  const edges = [];
  let started = false;
  for (let i = 0; i < pts.length; i++) {
    const [x, y, z] = pts[i];
    // stop where it comes onto the court
    if (Math.hypot(x, z) < WALL_R[6] - WALL_T - 1.2 && y >= COURT_Y - 0.01) break;
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dz = b[2] - a[2];
    const d = Math.hypot(dx, dz) || 1;
    const rx = -dz / d;
    const rz = dx / d;
    const yy = y + 0.06;
    const base = pos.length / 3;
    pos.push(x - rx * hw, yy, z - rz * hw, x + rx * hw, yy, z + rz * hw);
    uv.push(0, s[i] / 3, ROAD_W / 3, s[i] / 3);
    if (started) idx.push(base - 2, base, base - 1, base - 1, base, base + 1);
    started = true;
    edges.push({ x, y: yy, z, rx, rz, s: s[i] });
  }
  const rg = bufferGeo({ pos, uv, idx });
  // facing up?
  const n = rg.attributes.normal;
  if (n.getY(0) < 0) {
    const ix = rg.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    rg.computeVertexNormals();
  }
  bk.add(mats.road, rg);
  // the ramps' walls and parapets
  const quads = [];
  const PT = 0.42;
  const PH = 0.9;
  for (let i = 0; i < edges.length - 1; i++) {
    const e0 = edges[i];
    const e1 = edges[i + 1];
    for (const side of [-1, 1]) {
      const at = (e, off) => [e.x + e.rx * side * off, e.z + e.rz * side * off];
      const [x0, z0] = at(e0, hw);
      const [x1, z1] = at(e1, hw);
      const g0 = ground(...at(e0, hw + 0.3));
      const g1 = ground(...at(e1, hw + 0.3));
      const drop0 = e0.y - g0;
      const drop1 = e1.y - g1;
      if (drop0 < 0.12 && drop1 < 0.12) continue;
      const wall = drop0 > 1.1 && drop1 > 1.1;
      const centre = [(e0.x + e1.x) / 2, (e0.y + e1.y) / 2 - 0.5, (e0.z + e1.z) / 2];
      if (wall) {
        const [ox0, oz0] = at(e0, hw + PT);
        const [ox1, oz1] = at(e1, hw + PT);
        const pc = [(x0 + ox1) / 2, (e0.y + e1.y) / 2 + PH / 2, (z0 + oz1) / 2];
        quads.push([[x0, e0.y - 0.06, z0], [x1, e1.y - 0.06, z1], [x1, e1.y + PH, z1], [x0, e0.y + PH, z0], pc]);
        quads.push([[x0, e0.y + PH, z0], [x1, e1.y + PH, z1], [ox1, e1.y + PH, oz1], [ox0, e0.y + PH, oz0], pc]);
        quads.push([[ox0, e0.y + PH, oz0], [ox1, e1.y + PH, oz1], [ox1, g1 - 0.3, oz1], [ox0, g0 - 0.3, oz0], centre]);
      } else {
        quads.push([[x0, e0.y, z0], [x1, e1.y, z1], [x1, Math.min(e1.y, g1) - 0.3, z1], [x0, Math.min(e0.y, g0) - 0.3, z0], centre]);
      }
    }
  }
  const sg = quadsFacing(quads);
  bk.add(mats.wall, sg, { uv: 1 / 9, color: (x, y, z, c) => c.setRGB(0.9, 0.89, 0.86) });
}

// ── the Citadel ──
// The hall of the kings, from outside: a long block of white stone on a
// plinth, pilasters down its sides with tall round-headed windows between,
// an entablature and a low slate roof with a pediment over the east front;
// the front itself with engaged columns and the great doors in a deep arch.
function hallHouse(bk, K, lamps, banners) {
  const { mats, Q } = K;
  const { x0, x1, z0, z1, h } = HALL_HOUSE;
  const y = COURT_Y;
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const white = 0xf6f3ec;
  bk.add(mats.trim, new THREE.BoxGeometry(w + 0.8, 0.9, d + 0.8), { p: [cx, y + 0.45, 0], uv: 1 / 3 });
  bk.add(mats.wall, new THREE.BoxGeometry(w, h - 0.9, d), { p: [cx, y + 0.9 + (h - 0.9) / 2, 0], uv: 1 / 3, color: white });
  // the entablature and cornice
  bk.add(mats.trim, new THREE.BoxGeometry(w + 0.5, 0.9, d + 0.5), { p: [cx, y + h - 1.5, 0], uv: 1 / 3 });
  bk.add(mats.trim, new THREE.BoxGeometry(w + 1.1, 0.5, d + 1.1), { p: [cx, y + h - 0.8, 0], uv: 1 / 3 });
  bk.add(mats.trim, new THREE.BoxGeometry(w + 0.7, 0.3, d + 0.7), { p: [cx, y + h - 0.4, 0], uv: 1 / 3 });
  // the long sides: pilasters, windows between
  const bays = 6;
  for (const s of [-1, 1]) {
    const zf = s * (d / 2);
    for (let i = 0; i <= bays; i++) {
      const x = x0 + 0.6 + ((w - 1.2) * i) / bays;
      bk.add(mats.trim, new THREE.BoxGeometry(0.9, h - 2.9, 0.5), { p: [x, y + 0.9 + (h - 2.9) / 2, zf + s * 0.15], uv: 1 / 3 });
      bk.add(mats.trim, new THREE.BoxGeometry(1.2, 0.5, 0.7), { p: [x, y + h - 2.25, zf + s * 0.2], uv: 1 / 3 });
    }
    for (let i = 0; i < bays; i++) {
      const x = x0 + 0.6 + ((w - 1.2) * (i + 0.5)) / bays;
      const wy = y + 6.6;
      const ww = 1.5;
      const wh = 5.2;
      const sh = new THREE.Shape(archPts(ww, wh, 0, 0, 12));
      const glass = new THREE.ShapeGeometry(sh).translate(0, wy, 0);
      if (s < 0) glass.rotateY(Math.PI);
      bk.add(mats.glass, glass, { p: [x, 0, zf + s * 0.04] });
      const ring = ringSlice(ww / 2, ww / 2 + 0.3, 0, Math.PI, 0.18, 10).translate(0, wy + wh - ww / 2, 0);
      if (s < 0) ring.rotateY(Math.PI);
      bk.add(mats.trim, ring, { p: [x, 0, zf] });
      bk.add(mats.trim, new THREE.BoxGeometry(ww + 0.5, 0.2, 0.45), { p: [x, wy - 0.1, zf + s * 0.12] });
      for (const e of [-1, 1]) bk.add(mats.trim, new THREE.BoxGeometry(0.22, wh - ww / 2, 0.2), { p: [x + e * (ww / 2 + 0.11), wy + (wh - ww / 2) / 2, zf + s * 0.06] });
      // a lower window, small and square
      bk.add(mats.glass, new THREE.PlaneGeometry(0.9, 1.4).rotateY(s < 0 ? Math.PI : 0), { p: [x, y + 2.9, zf + s * 0.04] });
      bk.add(mats.trim, new THREE.BoxGeometry(1.3, 0.16, 0.36), { p: [x, y + 2.12, zf + s * 0.1] });
    }
  }
  // the west end has the same pilasters
  for (let i = 0; i <= 5; i++) {
    const z = z0 + 0.6 + ((d - 1.2) * i) / 5;
    bk.add(mats.trim, new THREE.BoxGeometry(0.5, h - 2.9, 0.9), { p: [x0 - 0.15, y + 0.9 + (h - 2.9) / 2, z], uv: 1 / 3 });
  }
  // the roof: a low gable along the hall, slate, the gable ends walled
  const rise = 3.4;
  const eave = 0.9;
  const roofGeo = (sgn) => {
    const yE = y + h;
    const A = [x0 - eave, yE, sgn * (d / 2 + eave)];
    const B = [x1 + eave, yE, sgn * (d / 2 + eave)];
    const Cc = [x1 + eave, yE + rise, 0];
    const Dd = [x0 - eave, yE + rise, 0];
    return quadsFacing([[A, B, Cc, Dd, [cx, yE - 10, 0]]]);
  };
  for (const sgn of [-1, 1]) {
    bk.add(mats.slate, roofGeo(sgn), { uv: 1 / 3 });
    const under = roofGeo(sgn).translate(0, -0.25, 0);
    bk.add(mats.slate, under, { uv: 1 / 3 });
  }
  for (const xe of [x0 - 0.2, x1 + 0.2]) {
    const tri = new THREE.Shape([new THREE.Vector2(-d / 2 - 0.4, 0), new THREE.Vector2(d / 2 + 0.4, 0), new THREE.Vector2(0, rise)]);
    const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.6, bevelEnabled: false }).rotateY(Math.PI / 2).translate(xe - 0.3, y + h, 0);
    bk.add(mats.wall, tg, { uv: 1 / 3, color: white });
  }
  // the pediment's raking cornices
  for (const sgn of [-1, 1]) {
    const len = Math.hypot(d / 2 + eave, rise);
    const b = new THREE.BoxGeometry(0.8, 0.4, len + 0.4);
    b.rotateX(sgn * Math.atan2(rise, d / 2 + eave));
    bk.add(mats.trim, b, { p: [x1 + 0.45, y + h + rise / 2 + 0.15, sgn * ((d / 2 + eave) / 2)] });
  }
  // the east front: columns, the doors in their arch
  for (const zc of [-9.2, -6.3, -3.4, 3.4, 6.3, 9.2]) {
    bk.add(mats.trim, latheM([[0.62, 0], [0.62, 0.5], [0.5, 0.65], [0.46, h - 2.6], [0.62, h - 2.3], [0.7, h - 2.0], [0, h - 2.0]], Math.round(16 * Q.around), 2), { p: [x1 + 0.1, y + 0.9, zc] });
  }
  const dw = 4.4;
  const dh = 8.2;
  bk.add(mats.trim, ringSlice(dw / 2 + 0.05, dw / 2 + 0.75, 0, Math.PI, 0.4, 14).rotateY(Math.PI / 2), { p: [x1 + 0.05, y + dh - dw / 2, 0] });
  bk.add(mats.trim, new THREE.BoxGeometry(0.6, 1.0, 0.8), { p: [x1 + 0.3, y + dh + 0.35, 0] });
  // the doorway's dark depth, and the doors in it
  bk.add(mats.door, new THREE.ShapeGeometry(new THREE.Shape(archPts(dw, dh, 0, 0, 14))).rotateY(Math.PI / 2), { p: [x1 + 0.02, y, 0] });
  bk.add(mats.iron, new THREE.BoxGeometry(0.08, 0.12, dw), { p: [x1 + 0.06, y + 2.6, 0] });
  bk.add(mats.iron, new THREE.BoxGeometry(0.08, 0.12, dw), { p: [x1 + 0.06, y + 5.2, 0] });
  bk.add(mats.iron, new THREE.BoxGeometry(0.08, dh - dw / 2, 0.08), { p: [x1 + 0.06, y + (dh - dw / 2) / 2, 0] });
  for (const s of [-1, 1]) bk.add(mats.iron, new THREE.TorusGeometry(0.22, 0.04, 6, 12).rotateY(Math.PI / 2), { p: [x1 + 0.1, y + 3.4, s * 0.5] });
  bk.add(mats.trim, new THREE.BoxGeometry(1.6, 0.18, dw + 1.6), { p: [x1 + 0.7, y + 0.09, 0] });
  // torches either side of the door, banners between the columns
  for (const s of [-1, 1]) {
    lamps.push(bracketTorch(bk, mats, x1 + 0.56, y + 3.6, s * 3.4, 0));
    banners.push({ x: x1 + 0.32, y: y + h - 2.4, z: s * 4.85, turn: Math.PI / 2, w: 1.7, h: 6.4 });
    bk.add(mats.iron, new THREE.CylinderGeometry(0.035, 0.035, 2.0, 5).rotateX(Math.PI / 2), { p: [x1 + 0.32, y + h - 2.36, s * 4.85] });
  }
}

// The Tower of Ecthelion: up from the hall's west end, white and slender
// and ribbed, a ring of corbels carrying the balcony near the top, the
// lantern-room above it with its tall windows, a cone, and the needle with a
// pale lantern at its foot.
function towerOfEcthelion(bk, K, lamps, banners) {
  const { mats, Q } = K;
  const { x, z } = TOWER;
  const y = COURT_Y;
  const H = TOWER.h;
  const seg = Math.round(40 * Q.around);
  const r0 = TOWER.r;
  const shaftTop = H - 12;
  const prof = [
    [r0, 0],
    [r0, HALL_HOUSE.h + 3.6],
    [r0 + 0.35, HALL_HOUSE.h + 3.9],
    [r0 + 0.35, HALL_HOUSE.h + 4.6],
    [r0 - 0.15, HALL_HOUSE.h + 4.9],
    [3.95, shaftTop],
    [4.25, shaftTop + 0.4],
    [4.6, shaftTop + 0.9],
    [5.0, shaftTop + 1.3],
    [5.7, shaftTop + 1.7],
    [5.7, shaftTop + 2.1],
    [3.05, shaftTop + 2.1],
    [3.05, H - 4.0],
    [3.45, H - 3.7],
    [3.45, H - 3.2],
    [3.1, H - 3.2],
    [0.3, H],
    [0.0, H + 0.02],
  ];
  bk.add(mats.wall, latheM(prof, seg, 3), { p: [x, y, z], color: 0xfbfaf6 });
  // ribs up the shaft
  const yA = HALL_HOUSE.h + 4.9;
  const ribs = 16;
  for (let i = 0; i < ribs; i++) {
    const an = (i / ribs) * TAU + 0.1;
    const rA = r0 - 0.15 + 0.1;
    const rB = 3.95 + 0.1;
    const len = Math.hypot(rA - rB, shaftTop - yA);
    const rib = new THREE.BoxGeometry(0.3, len, 0.26);
    rib.rotateZ(Math.atan2(rA - rB, shaftTop - yA));
    rib.translate((rA + rB) / 2, (yA + shaftTop) / 2, 0);
    rib.rotateY(-an);
    bk.add(mats.trim, rib, { p: [x, y, z], uv: 1 / 3 });
  }
  // slit windows climbing round the shaft
  for (let i = 0; i < 22; i++) {
    const an = i * 0.95;
    const yy = yA + 2 + i * 1.45;
    if (yy > shaftTop - 2) break;
    const rr = mix(r0 - 0.15, 3.95, (yy - yA) / (shaftTop - yA)) + 0.03;
    const g = new THREE.PlaneGeometry(0.34, 1.3).rotateY(Math.PI / 2 - an);
    bk.add(mats.glass, g, { p: [x + Math.cos(an) * rr, y + yy, z + Math.sin(an) * rr] });
  }
  // the balcony's parapet and its crenels
  const bt = shaftTop + 2.1;
  bk.add(mats.wall, arcSweep(5.7, 0, TAU, [[-0.32, bt], [0, bt], [0, bt + 1.05], [-0.32, bt + 1.05]], { step: 0.6, tile: 3, caps: false }), { p: [x, y, z], color: 0xfbfaf6 });
  const cm = [];
  for (let i = 0; i < 28; i++) {
    const a0 = (i / 28) * TAU;
    arcBlock(cm, 5.36, 5.74, a0, a0 + TAU / 56, bt + 1.05, bt + 1.55);
  }
  bk.add(mats.wall, quadsFacing(cm), { p: [x, y, z], uv: 1 / 3, color: 0xfbfaf6 });
  // the lantern-room's windows
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * TAU + Math.PI / 8;
    const sh = new THREE.ShapeGeometry(new THREE.Shape(archPts(0.62, 3.2, 0, 0, 8)));
    sh.translate(0, bt + 0.5, 0).rotateY(Math.PI / 2 - an);
    bk.add(mats.towerGlow, sh, { p: [x + Math.cos(an) * 3.08, y, z + Math.sin(an) * 3.08] });
  }
  // the needle and its lantern
  const lampY = y + H + 0.6;
  for (let i = 0; i < 4; i++) {
    const an = (i / 4) * TAU + Math.PI / 4;
    bk.add(mats.trim, new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), { p: [x + Math.cos(an) * 0.32, lampY, z + Math.sin(an) * 0.32] });
  }
  bk.add(mats.towerLamp, new THREE.SphereGeometry(0.3, 12, 8), { p: [x, lampY, z] });
  bk.add(mats.trim, latheM([[0.42, 0], [0.3, 0.12], [0.16, 0.4], [0.06, 4.4], [0, 5.6]], 8, 1), { p: [x, lampY + 0.6, z] });
  lamps.push(V3(x, lampY, z));
  // the Steward's banner, from the balcony
  bannerPole(bk, mats, banners, x + 5.1, y + bt, z, Math.PI / 2, 1.6, 4.8, 6.6);
}

// The White Tree's lawn: green in a white kerb, a little raised.
function lawn(bk, K) {
  const { mats, Q } = K;
  const y = COURT_Y;
  const L = TREE.lawn;
  bk.add(mats.grass, new THREE.CircleGeometry(L, Math.round(40 * Q.around)).rotateX(-Math.PI / 2), { p: [TREE.x, y + 0.24, TREE.z], uv: 1 / 2 });
  bk.add(mats.trim, latheM([[L + 0.5, -0.05], [L + 0.5, 0], [L + 0.42, 0], [L + 0.42, 0.3], [L + 0.38, 0.36], [L, 0.36], [L - 0.02, 0.24]], Math.round(48 * Q.around), 1.5), { p: [TREE.x, y, TREE.z] });
}

// The fountain: a round basin of white stone, a pillar in it with a bowl,
// the water still in the basin and spilling in a sheet from the bowl.
function fountain(bk, K) {
  const { mats, Q } = K;
  const { x, z, r } = FOUNTAIN;
  const y = COURT_Y;
  const seg = Math.round(40 * Q.around);
  bk.add(
    mats.trim,
    latheM(
      [
        [r + 0.18, 0],
        [r + 0.08, 0.12],
        [r, 0.5],
        [r + 0.08, 0.6],
        [r + 0.02, 0.68],
        [r - 0.25, 0.68],
        [r - 0.35, 0.58],
        [r - 0.35, 0.1],
      ],
      seg,
      1.5,
    ),
    { p: [x, y, z] },
  );
  bk.add(mats.trim, new THREE.CircleGeometry(r - 0.34, seg).rotateX(-Math.PI / 2), { p: [x, y + 0.12, z] });
  bk.add(
    mats.trim,
    latheM(
      [
        [0.55, 0.1],
        [0.42, 0.3],
        [0.24, 0.5],
        [0.2, 1.05],
        [0.32, 1.12],
        [0.82, 1.3],
        [0.86, 1.4],
        [0.74, 1.42],
        [0.22, 1.4],
        [0.14, 1.55],
        [0.16, 1.9],
        [0.08, 2.1],
        [0.0, 2.2],
      ],
      Math.round(24 * Q.around),
      1,
    ),
    { p: [x, y, z] },
  );
  const water = new THREE.Mesh(new THREE.CircleGeometry(r - 0.36, seg).rotateX(-Math.PI / 2), mats.water);
  water.position.set(x, y + 0.5, z);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20).rotateX(-Math.PI / 2), mats.water);
  top.position.set(x, y + 1.36, z);
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.92, 0.88, 24, 1, true), mats.fall);
  fall.position.set(x, y + 0.94, z);
  for (const m of [water, top, fall]) m.name = 'fountain-water';
  return [water, top, fall];
}

// ── the city ──

function cityOf(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'minas-tirith';
  const lamps = [];
  const banners = [];
  const bk = parts();
  for (let k = 0; k < 7; k++) {
    const lv = parts();
    level(lv, bk, K, k);
    gatehouse(lv, K, k, lamps, banners);
    const sub = new THREE.Group();
    sub.name = `level-${k}`;
    for (const m of lv.build(sub, { shadow: true, receive: true })) m.name = `level${k}-${m.material.name}`;
    g.add(sub);
  }
  prow(bk, K, lamps, banners);
  road(bk, K);
  // the houses, and a lantern on one in every few
  const { bodies, roofs } = houses(K);
  g.add(bodies, roofs);
  // lanterns on the houses of the outer rows (fronts to the street, backs to
  // the wall), one every 45 m or so
  const lastLamp = new Map();
  for (const h of HOUSES) {
    const r = Math.hypot(h.x, h.z);
    if (r < (WALL_R[h.k] + WALL_R[h.k + 1]) / 2) continue;
    const along = Math.atan2(h.z, h.x) * r;
    const prev = lastLamp.get(h.k);
    if (prev != null && along - prev < 45) continue;
    lastLamp.set(h.k, along);
    const c = Math.cos(h.face);
    const sn = -Math.sin(h.face);
    // the house's own +z runs along its front
    const ax = Math.sin(h.face);
    const az = Math.cos(h.face);
    const off = Math.min(h.w / 2 - 0.5, 1.4);
    lamps.push(bracketLantern(bk, mats, h.x + c * (h.d / 2) + ax * off, h.y + 3.0, h.z + sn * (h.d / 2) + az * off, h.face));
  }
  // the Citadel
  hallHouse(bk, K, lamps, banners);
  towerOfEcthelion(bk, K, lamps, banners);
  lawn(bk, K);
  const water = fountain(bk, K);
  // braziers on the Citadel's parapet, round its edge
  for (const an of [-2.3, -1.6, -0.9, 0.95, 1.6, 2.3, Math.PI]) {
    const r = WALL_R[6] - 0.4;
    lamps.push(brazier(bk, mats, Math.cos(an) * r, COURT_Y + 1.12, Math.sin(an) * r, 0.55));
  }
  bk.build(g, { shadow: true, receive: true }).forEach((m) => (m.name = `city-${m.material.name}`));
  g.add(...water);
  const flagMesh = bannerMesh(mats, banners);
  g.add(flagMesh);
  return { group: g, lamps, flags: [flagMesh] };
}

// ── the White Tree ──
// Gnarled and white, its bole twisted, four great limbs spreading and
// forking and forking again to bare twigs; with blossom clusters and a few
// green leaves at the twigs' ends, shown as it flowers (set(bloom)).
function whiteTree(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'white-tree';
  const bk = parts();
  const r = rng(1201);
  const spots = [];
  const grow = (p0, dir, len, rad, depth, seed) => {
    const pts = [p0.clone()];
    let p = p0.clone();
    const d = dir.clone();
    const steps = depth < 2 ? 5 : 4;
    for (let i = 1; i <= steps; i++) {
      // wander, and droop a little as it reaches out
      d.add(V3((r() - 0.5) * 0.6, (r() - 0.5) * 0.35 - depth * 0.04, (r() - 0.5) * 0.6)).normalize();
      if (depth > 0) d.y = Math.max(d.y, -0.3);
      p = p.clone().addScaledVector(d, len / steps);
      pts.push(p);
    }
    const radial = depth < 1 ? 10 : depth < 2 ? 8 : depth < 3 ? 6 : 4;
    bk.add(mats.bark, tube(pts, rad, rad * 0.62, { seg: steps * 2, radial: Math.max(4, Math.round(radial * Q.around)), gnarl: depth < 2 ? 0.25 : 0.12, seed, uvK: 1.2 }));
    if (depth >= 2) for (let i = 2; i <= steps; i++) spots.push(pts[i]);
    if (depth >= 3) return;
    const kids = depth === 0 ? 3 : 2 + (r() < 0.55 ? 1 : 0);
    for (let i = 0; i < kids; i++) {
      const an = (i / kids) * TAU + r() * 1.4;
      const out = V3(Math.cos(an), 0, Math.sin(an));
      const nd = d
        .clone()
        .multiplyScalar(0.7)
        .addScaledVector(out, 0.7)
        .add(V3(0, 0.22 - depth * 0.06, 0))
        .normalize();
      grow(p, nd, len * (0.62 + r() * 0.14), rad * 0.6, depth + 1, seed * 7 + i);
    }
  };
  // the bole: thick, twisted, flaring to roots at its foot
  const bole = [V3(0, -0.35, 0), V3(0.1, 0.5, 0.06), V3(-0.08, 1.15, 0.14), V3(0.14, 1.75, -0.06), V3(0.22, 2.15, 0.04)];
  bk.add(mats.bark, tube(bole, 0.5, 0.34, { seg: 14, radial: 12, gnarl: 0.32, seed: 3, uvK: 1.2 }));
  for (let i = 0; i < 7; i++) {
    const an = (i / 7) * TAU + r() * 0.5;
    const c = Math.cos(an);
    const sn = Math.sin(an);
    const reach = 0.9 + r() * 0.5;
    bk.add(mats.bark, tube([V3(c * 0.22, 0.6, sn * 0.22), V3(c * 0.5, 0.18, sn * 0.5), V3(c * reach, 0.02, sn * reach), V3(c * (reach + 0.4), -0.15, sn * (reach + 0.4))], 0.22, 0.04, { seg: 8, radial: 6, gnarl: 0.25, seed: 40 + i }));
  }
  const top = bole[bole.length - 1];
  const limbs = 5;
  for (let i = 0; i < limbs; i++) {
    const an = (i / limbs) * TAU + 0.4 + r() * 0.6;
    const dir = V3(Math.cos(an) * 0.9, 0.62 + r() * 0.2, Math.sin(an) * 0.9).normalize();
    grow(top.clone().add(V3(0, -0.2 * r(), 0)), dir, 2.0 + r() * 0.6, 0.23, 0, 100 + i);
  }
  grow(top, V3(0.08, 1, -0.05).normalize(), 2.2, 0.2, 1, 199);
  bk.build(g, { shadow: true, receive: true }).forEach((m) => (m.name = 'tree-bark'));

  // blossom: a cluster of small five-petalled flowers round each spot
  const flowers = [];
  {
    const fr = rng(55);
    for (let i = 0; i < 14; i++) {
      const fg = new THREE.CircleGeometry(0.055 + fr() * 0.03, 5);
      const v = V3(fr() - 0.5, fr() - 0.25, fr() - 0.5).normalize();
      fg.lookAt(v);
      const d = 0.06 + fr() * 0.2;
      fg.translate(v.x * d, v.y * d, v.z * d);
      fg.deleteAttribute('uv');
      flowers.push(fg.toNonIndexed());
    }
    const heart = new THREE.IcosahedronGeometry(0.07, 0);
    heart.deleteAttribute('uv');
    flowers.push(heart.toNonIndexed());
  }
  const blossomGeo = mergeAll(flowers);
  const bloomAt = spots.map(() => ({ s: 0.75 + r() * 0.6, th: r() * 0.5, rot: new THREE.Euler(r() * TAU, r() * TAU, r() * TAU), off: V3((r() - 0.5) * 0.25, (r() - 0.5) * 0.2, (r() - 0.5) * 0.25) }));
  const blossoms = new THREE.InstancedMesh(blossomGeo, mats.blossom, spots.length);
  blossoms.name = 'tree-blossom';
  // and a few green leaves among them
  const leafGeo = new THREE.SphereGeometry(0.07, 5, 3).scale(1.6, 0.35, 0.8);
  const leafSpots = spots.filter((_, i) => i % 2 === 0);
  const leafAt = leafSpots.map(() => ({ s: 0.7 + r() * 0.6, rot: new THREE.Euler(r() * TAU, r() * TAU, r() * TAU), off: V3((r() - 0.5) * 0.4, (r() - 0.4) * 0.3, (r() - 0.5) * 0.4) }));
  const leaves = new THREE.InstancedMesh(leafGeo, mats.leaf, leafSpots.length);
  leaves.name = 'tree-leaves';
  g.add(blossoms, leaves);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = V3();
  const set = (bloom = 0) => {
    const b = clamp01(bloom);
    spots.forEach((p, i) => {
      const o = bloomAt[i];
      const k = o.s * smooth(o.th, o.th + 0.45, b);
      q.setFromEuler(o.rot);
      m.compose(p.clone().add(o.off), q, sc.setScalar(Math.max(k, 1e-4)));
      blossoms.setMatrixAt(i, m);
    });
    leafSpots.forEach((p, i) => {
      const o = leafAt[i];
      const k = o.s * smooth(0.35, 1, b);
      q.setFromEuler(o.rot);
      m.compose(p.clone().add(o.off), q, sc.setScalar(Math.max(k, 1e-4)));
      leaves.setMatrixAt(i, m);
    });
    blossoms.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    blossoms.visible = b > 0.001;
    leaves.visible = b > 0.36;
    blossoms.computeBoundingSphere();
    leaves.computeBoundingSphere();
  };
  set(0);
  return { group: g, set };
}

// ── the hall of the kings, inside ──
// Its own place: the floor at y = 0, the long walls at x = ±HALL.w / 2, the
// throne at the north end (HALL.z0), the doors at the south (HALL.z1).
function statueGeos(Q) {
  // one king, standing on y = 0 facing +x, some four metres tall: a long
  // robe flaring at the hem, a cloak from his shoulders, a tall winged helm,
  // a beard, his hands folded on the pommel of the sword before him
  const around = Math.max(10, Math.round(22 * Q.around));
  const list = [];
  const robe = latheM(
    [
      [0.001, 0],
      [0.62, 0],
      [0.64, 0.1],
      [0.58, 0.35],
      [0.5, 0.95],
      [0.44, 1.6],
      [0.39, 2.08],
      [0.43, 2.4],
      [0.5, 2.78],
      [0.5, 2.95],
      [0.34, 3.12],
      [0.14, 3.22],
      [0.12, 3.36],
    ],
    around,
    1,
  ).scale(0.64, 1, 1);
  list.push(robe);
  // folds down the front of the robe
  for (const z of [-0.26, -0.1, 0.1, 0.26]) list.push(tube([[0.3, 0.05, z * 1.2], [0.3, 1.0, z], [0.26, 2.0, z * 0.85]], 0.05, 0.03, { seg: 4, radial: 5 }));
  list.push(new THREE.TorusGeometry(0.4, 0.045, 6, around).rotateX(Math.PI / 2).scale(0.64, 1, 1).translate(0, 2.1, 0));
  // the cloak
  const cloak = new THREE.CylinderGeometry(0.5, 0.78, 3.0, around, 1, true, Math.PI * 0.95, Math.PI * 1.1);
  cloak.scale(0.75, 1, 1.05).translate(-0.1, 1.55, 0);
  list.push(cloak);
  // shoulders and arms, the hands on the pommel
  for (const s of [-1, 1]) {
    list.push(new THREE.SphereGeometry(0.19, 10, 8).scale(1, 0.9, 1).translate(0, 2.95, s * 0.44));
    list.push(tube([[0, 2.95, s * 0.48], [0.04, 2.62, s * 0.52], [0.12, 2.42, s * 0.46]], 0.13, 0.11, { seg: 5, radial: 7 }));
    list.push(tube([[0.12, 2.42, s * 0.46], [0.3, 2.34, s * 0.28], [0.44, 2.36, s * 0.1]], 0.11, 0.085, { seg: 5, radial: 7 }));
    list.push(new THREE.SphereGeometry(0.08, 8, 6).scale(1.2, 0.8, 1).translate(0.48, 2.38, s * 0.065));
  }
  // the head, the beard, the helm with its wings
  list.push(new THREE.SphereGeometry(0.185, 12, 10).scale(1, 1.12, 0.92).translate(0.02, 3.5, 0));
  list.push(new THREE.ConeGeometry(0.12, 0.42, 8).rotateZ(Math.PI).translate(0.11, 3.27, 0));
  list.push(latheM([[0.205, 0], [0.215, 0.12], [0.19, 0.34], [0.12, 0.52], [0.04, 0.64], [0, 0.7]], 14, 1).translate(0.02, 3.56, 0));
  list.push(new THREE.TorusGeometry(0.205, 0.02, 4, 14).rotateX(Math.PI / 2).translate(0.02, 3.6, 0));
  for (const s of [-1, 1]) {
    const wing = new THREE.Shape();
    wing.moveTo(0, 0);
    wing.quadraticCurveTo(0.08, 0.3, -0.16, 0.5);
    wing.quadraticCurveTo(-0.12, 0.22, -0.24, 0.05);
    wing.closePath();
    const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.025, bevelEnabled: false, curveSegments: 4 });
    wg.translate(0, 0, -0.012).rotateY(s * 0.25);
    list.push(wg.translate(0.04, 3.62, s * 0.21));
  }
  // the sword: pommel, grip, guard, and the blade down to the ground
  list.push(new THREE.SphereGeometry(0.065, 8, 6).translate(0.5, 2.5, 0));
  list.push(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6).translate(0.5, 2.3, 0));
  list.push(new THREE.BoxGeometry(0.07, 0.07, 0.7).translate(0.5, 2.13, 0));
  const blade = new THREE.CylinderGeometry(0.065, 0.012, 1.95, 4).scale(0.35, 1, 1).rotateY(Math.PI / 4);
  list.push(blade.translate(0.5, 1.12, 0));
  return list;
}

function hallInside(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'hall-of-kings';
  const bk = parts();
  const X = HALL.w / 2;
  const Z0 = HALL.z0;
  const Z1 = HALL.z1;
  const H = HALL.h;
  const L = Z1 - Z0;
  const ZC = (Z0 + Z1) / 2;
  const lamps = [];
  const windows = [];
  // the floor: its own texture coordinates, a bay to each pair of pillars
  {
    const fg = new THREE.PlaneGeometry(HALL.w, L, 1, 9).rotateX(-Math.PI / 2).translate(0, 0, ZC);
    const p = fg.attributes.position;
    const uv = fg.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + X) / HALL.w, 0.5 - (p.getZ(i) + 20) / 6);
    const fm = new THREE.Mesh(fg, mats.hallFloor);
    fm.name = 'hall-floor';
    fm.receiveShadow = true;
    g.add(fm);
  }
  // the long walls, broken by the high windows
  const winZ = STATUES.filter(([x]) => x < 0).map(([, z]) => z);
  const wy0 = 12.6;
  const wy1 = 17.8;
  const ww = 2.3;
  const T = 0.9;
  for (const s of [-1, 1]) {
    const xw = s * (X + T / 2);
    bk.add(mats.hallStone, new THREE.BoxGeometry(T, wy0, L + 2 * T), { p: [xw, wy0 / 2, ZC], uv: 1 / 9 });
    bk.add(mats.hallStone, new THREE.BoxGeometry(T, H - wy1, L + 2 * T), { p: [xw, (wy1 + H) / 2, ZC], uv: 1 / 9 });
    const cuts = [Z0 - T, ...winZ.flatMap((z) => [z - ww / 2, z + ww / 2]), Z1 + T];
    for (let i = 0; i < cuts.length; i += 2) {
      const za = cuts[i];
      const zb = cuts[i + 1];
      bk.add(mats.hallStone, new THREE.BoxGeometry(T, wy1 - wy0, zb - za), { p: [xw, (wy0 + wy1) / 2, (za + zb) / 2], uv: 1 / 9 });
    }
    for (const z of winZ) {
      // the glass, set back, and its round head and mullion
      const sh = new THREE.ShapeGeometry(new THREE.Shape(archPts(ww, wy1 - wy0, 0, 0, 12))).rotateY(s > 0 ? -Math.PI / 2 : Math.PI / 2);
      bk.add(mats.pane, sh, { p: [s * (X + T * 0.7), wy0, z] });
      bk.add(mats.iron, new THREE.BoxGeometry(0.1, wy1 - wy0, 0.08), { p: [s * (X + T * 0.6), (wy0 + wy1) / 2, z] });
      bk.add(mats.iron, new THREE.BoxGeometry(0.1, 0.08, ww), { p: [s * (X + T * 0.6), wy0 + (wy1 - wy0) * 0.45, z] });
      bk.add(mats.trim, new THREE.BoxGeometry(0.5, 0.25, ww + 0.6), { p: [s * (X - 0.1), wy0 - 0.12, z], uv: 1 / 3 });
      windows.push({ at: V3(s * (X - 0.2), (wy0 + wy1) / 2, z), dir: V3(-s, -0.85, 0.12).normalize() });
    }
    // pilasters behind the pillars, the dado, the string course, the cornice
    for (const [cx, cz] of COLUMNS.filter(([cx2]) => Math.sign(cx2) === s)) {
      void cx;
      bk.add(mats.hallStone, new THREE.BoxGeometry(0.3, H, 1.3), { p: [s * (X - 0.15), H / 2, cz], uv: 1 / 9 });
    }
    bk.add(mats.marble, new THREE.BoxGeometry(0.12, 1.2, L), { p: [s * (X - 0.06), 0.6, ZC], uv: 1 / 3 });
    bk.add(mats.trim, new THREE.BoxGeometry(0.3, 0.3, L), { p: [s * (X - 0.15), wy0 - 0.4, ZC], uv: 1 / 3 });
    bk.add(mats.trim, new THREE.BoxGeometry(0.6, 0.7, L), { p: [s * (X - 0.3), H - 0.9, ZC], uv: 1 / 3 });
  }
  // the end walls: the north behind the throne, the south with the doors
  bk.add(mats.hallStone, new THREE.BoxGeometry(HALL.w + 2 * T, H, T), { p: [0, H / 2, Z0 - T / 2], uv: 1 / 9 });
  const dw = 5.2;
  const dh = 9.4;
  for (const s of [-1, 1]) bk.add(mats.hallStone, new THREE.BoxGeometry(X + T - dw / 2, H, T), { p: [s * ((X + T + dw / 2) / 2), H / 2, Z1 + T / 2], uv: 1 / 9 });
  bk.add(mats.hallStone, new THREE.BoxGeometry(dw, H - dh, T), { p: [0, (H + dh) / 2, Z1 + T / 2], uv: 1 / 9 });
  for (const s of [-1, 1]) bk.add(mats.wood, new THREE.BoxGeometry(dw / 2 - 0.03, dh, 0.3), { p: [s * (dw / 4), dh / 2, Z1 + 0.35], uv: 1 / 2 });
  for (const yy of [2.2, 5.6, 8.4]) bk.add(mats.iron, new THREE.BoxGeometry(dw, 0.14, 0.06), { p: [0, yy, Z1 + 0.18] });
  for (const s of [-1, 1]) bk.add(mats.iron, new THREE.TorusGeometry(0.28, 0.05, 6, 14), { p: [s * 0.55, 3.6, Z1 + 0.16] });
  bk.add(mats.trim, ringSlice(dw / 2, dw / 2 + 0.7, 0, Math.PI, 0.3, 14), { p: [0, dh, Z1 - 0.3] });
  bk.add(mats.trim, new THREE.BoxGeometry(dw + 1.2, 0.5, 0.4), { p: [0, dh - 0.25, Z1 - 0.1] });
  // the emblem of the tree over the throne, inlaid in a panel of black
  bk.add(mats.marble, new THREE.BoxGeometry(4.2, 7.2, 0.2), { p: [0, 12.6, Z0 + 0.1] });
  bk.add(mats.emblem, new THREE.PlaneGeometry(3.4, 6.6), { p: [0, 12.6, Z0 + 0.22] });
  bk.add(mats.trim, new THREE.BoxGeometry(4.6, 0.3, 0.4), { p: [0, 16.3, Z0 + 0.2] });
  // the ceiling, dark, with beams across from pillar to pillar
  bk.add(mats.ceiling, new THREE.PlaneGeometry(HALL.w + 2 * T, L + 2 * T).rotateX(Math.PI / 2), { p: [0, H, ZC] });
  for (const z of [...new Set(COLUMNS.map(([, cz]) => cz))]) bk.add(mats.hallStone, new THREE.BoxGeometry(HALL.w, 1.1, 0.9), { p: [0, H - 0.55, z], uv: 1 / 9 });
  for (const s of [-1, 1]) bk.add(mats.hallStone, new THREE.BoxGeometry(1.0, 0.9, L), { p: [s * 6, H - 0.45, ZC], uv: 1 / 9 });

  // the pillars: black marble, a plinth, a moulded base, the shaft, a capital
  const seg = Math.round(20 * Q.around);
  for (const [x, z] of COLUMNS) {
    bk.add(mats.marble, new THREE.BoxGeometry(1.8, 0.45, 1.8), { p: [x, 0.225, z], uv: 1 / 2 });
    bk.add(mats.marble, latheM([[0.95, 0], [0.95, 0.12], [0.82, 0.3], [0.74, 0.42], [0.72, 0.42]], seg, 2), { p: [x, 0.45, z] });
    bk.add(mats.marble, new THREE.CylinderGeometry(0.66, 0.72, H - 2.4, seg, 1, true), { p: [x, 0.87 + (H - 2.4) / 2, z], uv: 1 / 3 });
    bk.add(mats.marble, latheM([[0.66, 0], [0.7, 0.1], [0.68, 0.18], [0.82, 0.55], [1.02, 0.9], [1.02, 1.0]], seg, 2), { p: [x, H - 1.55, z] });
    bk.add(mats.marble, new THREE.BoxGeometry(2.1, 0.5, 2.1), { p: [x, H - 0.5, z], uv: 1 / 2 });
    bk.add(mats.gilt, new THREE.TorusGeometry(0.69, 0.03, 4, seg).rotateX(Math.PI / 2), { p: [x, H - 1.6, z] });
  }
  // the kings, on their plinths, facing in
  const king = statueGeos(Q);
  for (const [x, z] of STATUES) {
    const turn = x < 0 ? 0 : Math.PI;
    bk.add(mats.statueStone, new THREE.BoxGeometry(1.35, 0.95, 1.35), { p: [x, 0.475, z], uv: 1 / 2 });
    bk.add(mats.statueStone, new THREE.BoxGeometry(1.5, 0.16, 1.5), { p: [x, 0.95, z], uv: 1 / 2 });
    for (const part of king) bk.add(mats.statueStone, part.clone(), { p: [x, 1.03, z], r: [0, turn, 0] });
  }
  // the dais, its steps up to the throne
  for (let i = 0; i < DAIS.steps; i++) {
    const h = ((i + 1) / DAIS.steps) * DAIS.h;
    const front = DAIS.z + DAIS.d / 2 - i * 0.55;
    const back = DAIS.z - DAIS.d / 2;
    const w = DAIS.w - i * 0.5;
    bk.add(mats.throneStone, new THREE.BoxGeometry(w, DAIS.h / DAIS.steps, front - back), { p: [DAIS.x, h - DAIS.h / DAIS.steps / 2, (front + back) / 2], uv: 1 / 2 });
    bk.add(mats.marble, new THREE.BoxGeometry(w + 0.02, 0.05, 0.05), { p: [DAIS.x, h - 0.03, front + 0.01] });
  }
  // the throne: white, high-backed, under its canopy
  {
    const y = DAIS.h;
    const { x, z } = THRONE;
    bk.add(mats.throneStone, new THREE.BoxGeometry(1.4, 0.52, 1.0), { p: [x, y + 0.26, z + 0.05], uv: 1 / 2 });
    const back = new THREE.ExtrudeGeometry(new THREE.Shape(archPts(1.4, 3.3, 0, 0, 10)), { depth: 0.26, bevelEnabled: false });
    bk.add(mats.throneStone, back, { p: [x, y, z - 0.6], uv: 1 / 2 });
    for (const s of [-1, 1]) {
      bk.add(mats.throneStone, new THREE.BoxGeometry(0.2, 0.55, 0.95), { p: [x + s * 0.7, y + 0.8, z + 0.05], uv: 1 / 2 });
      bk.add(mats.throneStone, new THREE.CylinderGeometry(0.13, 0.15, 5.4, 10), { p: [x + s * 1.35, y + 2.7, z - 0.55] });
      bk.add(mats.gilt, new THREE.SphereGeometry(0.12, 8, 6), { p: [x + s * 0.7, y + 1.1, z + 0.5] });
    }
    bk.add(mats.marble, new THREE.BoxGeometry(3.0, 5.4, 0.25), { p: [x, y + 2.7, z - 0.86] });
    bk.add(mats.throneStone, new THREE.BoxGeometry(3.2, 0.3, 1.5), { p: [x, y + 5.55, z - 0.25], uv: 1 / 2 });
    const gable = new THREE.Shape([new THREE.Vector2(-1.6, 0), new THREE.Vector2(1.6, 0), new THREE.Vector2(0, 1.9)]);
    bk.add(mats.throneStone, new THREE.ExtrudeGeometry(gable, { depth: 1.3, bevelEnabled: false }), { p: [x, y + 5.7, z - 0.95], uv: 1 / 2 });
    bk.add(mats.gilt, new THREE.ConeGeometry(0.1, 0.6, 6), { p: [x, y + 7.85, z - 0.3] });
  }
  // the Steward's chair: plain, black, at the foot of the steps, facing south
  {
    const { x, z } = CHAIR;
    bk.add(mats.blackWood, new THREE.BoxGeometry(0.66, 0.08, 0.58), { p: [x, 0.5, z] });
    for (const [dx, dz] of [
      [-0.28, -0.24],
      [0.28, -0.24],
      [-0.28, 0.24],
      [0.28, 0.24],
    ])
      bk.add(mats.blackWood, new THREE.BoxGeometry(0.07, 0.5, 0.07), { p: [x + dx, 0.25, z + dz] });
    bk.add(mats.blackWood, new THREE.BoxGeometry(0.66, 1.25, 0.08), { p: [x, 1.12, z - 0.27] });
    for (const s of [-1, 1]) {
      bk.add(mats.blackWood, new THREE.BoxGeometry(0.06, 0.06, 0.56), { p: [x + s * 0.31, 0.78, z] });
      bk.add(mats.blackWood, new THREE.BoxGeometry(0.05, 0.28, 0.05), { p: [x + s * 0.31, 0.64, z + 0.24] });
    }
  }
  // the little table, and the Steward's supper on it
  {
    const { x, z } = TOMATOES;
    bk.add(mats.blackWood, new THREE.CylinderGeometry(0.46, 0.46, 0.05, 20), { p: [x, 0.74, z] });
    bk.add(mats.blackWood, new THREE.CylinderGeometry(0.05, 0.07, 0.72, 8), { p: [x, 0.36, z] });
    bk.add(mats.blackWood, new THREE.CylinderGeometry(0.28, 0.3, 0.05, 12), { p: [x, 0.025, z] });
    const ty = 0.765;
    bk.add(mats.jug, latheM([[0.001, 0], [0.12, 0.005], [0.2, 0.05], [0.21, 0.06]], 16, 1), { p: [x - 0.1, ty, z + 0.05] });
    const tr = rng(17);
    for (let i = 0; i < 11; i++) {
      const an = tr() * TAU;
      const rr = Math.sqrt(tr()) * 0.13;
      bk.add(mats.tomato, new THREE.SphereGeometry(0.034 + tr() * 0.008, 8, 6).scale(1, 0.85, 1), { p: [x - 0.1 + Math.cos(an) * rr, ty + 0.05 + (i > 7 ? 0.05 : 0), z + 0.05 + Math.sin(an) * rr] });
    }
    bk.add(mats.bread, new THREE.SphereGeometry(0.1, 10, 8).scale(1.5, 0.7, 0.9), { p: [x + 0.18, ty + 0.06, z - 0.12] });
    bk.add(mats.jug, latheM([[0.001, 0], [0.07, 0], [0.09, 0.08], [0.06, 0.2], [0.05, 0.24], [0.06, 0.26]], 14, 1), { p: [x + 0.2, ty, z + 0.17] });
    bk.add(mats.jug, new THREE.TorusGeometry(0.05, 0.012, 5, 10, Math.PI).rotateZ(-Math.PI / 2), { p: [x + 0.28, ty + 0.14, z + 0.17] });
    bk.add(mats.gilt, latheM([[0.001, 0], [0.04, 0], [0.01, 0.02], [0.012, 0.09], [0.045, 0.12], [0.05, 0.17]], 12, 1), { p: [x - 0.04, ty, z - 0.2] });
  }
  // braziers by the throne, and tall lamps down by the doors
  for (const [x, z] of [
    [-4.3, -24.6],
    [4.3, -24.6],
    [-4.3, -19.2],
    [4.3, -19.2],
  ]) {
    for (let i = 0; i < 3; i++) {
      const an = (i / 3) * TAU + 0.3;
      bk.add(mats.iron, tube([[x + Math.cos(an) * 0.5, 0, z + Math.sin(an) * 0.5], [x + Math.cos(an) * 0.32, 0.75, z + Math.sin(an) * 0.32], [x + Math.cos(an) * 0.4, 1.15, z + Math.sin(an) * 0.4]], 0.045, 0.035, { seg: 6, radial: 5 }));
    }
    bk.add(mats.iron, lathe([[0.05, 0], [0.42, 0.12], [0.58, 0.34], [0.62, 0.38], [0.54, 0.38]], 14), { p: [x, 1.05, z] });
    bk.add(mats.coals, new THREE.CircleGeometry(0.54, 14).rotateX(-Math.PI / 2), { p: [x, 1.38, z] });
    lamps.push(V3(x, 1.55, z));
  }
  for (const [x, z] of [
    [-4.2, 20.5],
    [4.2, 20.5],
    [-4.2, 8.5],
    [4.2, 8.5],
  ]) {
    bk.add(mats.iron, lathe([[0.3, 0], [0.18, 0.1], [0.06, 0.25], [0.05, 2.3], [0.1, 2.4]], 8), { p: [x, 0, z] });
    bk.add(mats.iron, lathe([[0.03, 0], [0.22, 0.08], [0.26, 0.2]], 10), { p: [x, 2.4, z] });
    bk.add(mats.coals, new THREE.CircleGeometry(0.22, 10).rotateX(-Math.PI / 2), { p: [x, 2.58, z] });
    lamps.push(V3(x, 2.72, z));
  }
  bk.build(g, { shadow: false, receive: true }).forEach((m) => (m.name = `hall-${m.material.name}`));
  return { group: g, lamps, windows };
}

// ── the beacon ledge ──
// A shelf of rock along the mountain's face, flat where it's walked, ragged
// at its edge and underneath; the cliff going up behind it on the west; three
// boulders to hide behind; the great pile of wood on its stone footing, a
// ladder up its south face; the guard's stool and his supper beyond.
function beaconLedge(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'beacon-ledge';
  const bk = parts();
  const { x: LX, y: LY, w } = LEDGE;
  const xw = LX - w / 2;
  const xe = LX + w / 2;
  const zS = ledgeAt(0)[2] + 5;
  const zN = ledgeAt(LEDGE.len)[2] - 3.5;
  const n = makeNoise(77);
  const [, , zPileS] = ledgeAt(PILE.s);
  const zPile = zPileS - 1.2;
  const rockShade = (x, y, z, c) => {
    const k = 0.78 + 0.26 * n(x * 0.3 + 5, y * 0.3 + z * 0.2);
    c.setRGB(k * 0.98, k * 0.96, k * 0.93);
  };
  // the shelf
  {
    const geo = new THREE.BoxGeometry(1, 1, 1, 10, 6, 60);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i) + 0.5;
      const uy = p.getY(i) + 0.5;
      const uz = p.getZ(i) + 0.5;
      const z = mix(zN, zS, uz);
      const pileBulge = 2.2 * Math.exp(-Math.pow((z - zPile) / 2.6, 2));
      const bulge = 0.35 + fbm(n, z * 0.22, 1.3, { octaves: 3 }) * 1.1 + pileBulge;
      const depth = 4.5 + fbm(n, z * 0.12, 7.1, { octaves: 3 }) * 3.5;
      let x = mix(xw - 2.2, xe + bulge, ux);
      let y = mix(LY - depth, LY, uy);
      if (uy < 0.999) {
        // underneath it narrows back into the mountain, lumpy
        x = mix(xw - 2.2, x, 0.3 + 0.7 * Math.pow(uy, 0.7)) + (fbm(n, z * 0.4, y * 0.4 + 3, { octaves: 3 }) - 0.5) * 1.2 * (1 - uy);
        y += (fbm(n, x * 0.5, z * 0.5, { octaves: 2 }) - 0.5) * 0.8 * (1 - uy);
      } else {
        y = LY + (n(x * 1.7, z * 1.7) - 0.5) * 0.06 - (x > xe ? (x - xe) * 0.08 : 0);
      }
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    bk.add(mats.rock, geo, { uv: 1 / 8, color: rockShade });
  }
  // the cliff behind, going up 25 m, leaning and stepped
  {
    const len = zS - zN + 8;
    const ht = 28;
    const geo = new THREE.PlaneGeometry(len, ht, 56, 28).rotateY(Math.PI / 2);
    // (the rows run from the top down; the first is the cliff's ragged crest)
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i) + (zS + zN) / 2;
      const y = p.getY(i) + ht / 2 + LY - 2.5;
      const strata = Math.sin((y * 0.9 + fbm(n, z * 0.1, y * 0.1, { octaves: 2 }) * 4) * 1.3) * 0.25;
      const big = fbm(n, z * 0.08 + 11, y * 0.08, { octaves: 4 });
      const rib = Math.pow(ridge(n, z * 0.11 + 3, y * 0.02, { octaves: 3 }), 3);
      let x = xw - 0.25 - big * 2.6 + rib * 1.8 - strata + (y - LY) * 0.05;
      if (y < LY + 3) x = Math.min(x, xw - 0.2);
      const yy = i < 57 ? y + (fbm(n, z * 0.15, 4.4, { octaves: 3 }) - 0.5) * 6 : y;
      p.setXYZ(i, x, yy, z);
    }
    geo.computeVertexNormals();
    bk.add(mats.rock, geo, { uv: 1 / 10, color: rockShade });
    // the mountain closing the ledge at its north end: a fall of great blocks
    const er = rng(91);
    for (let i = 0; i < 7; i++) {
      const sz = 1.6 + er() * 2.2;
      const b = blob(sz, { detail: 1, amp: 0.34, freq: 1.1, seed: 9 + i });
      b.scale(1 + er() * 0.4, 0.7 + er() * 0.5, 0.8 + er() * 0.4);
      const x = LX - 2.6 + er() * 4.2 - (i < 3 ? 0 : 1.2);
      const y = LY - 0.6 + (i < 3 ? sz * 0.4 : sz * 1.3 + er() * 1.5);
      const fb = b.toNonIndexed();
      fb.computeVertexNormals();
      bk.add(mats.rock, fb, { p: [x, y, zN - 1.2 - er() * 2.5], r: [er(), er() * 3, er()], uv: 1 / 5, color: rockShade });
    }
  }
  // the boulders: across the north side of each hiding place, room to pass on the east
  COVERS.forEach((c, i) => {
    const [, , z] = ledgeAt(c.s);
    const b = blob(1, { detail: 1, amp: 0.3, freq: 1.3, seed: 20 + i }).toNonIndexed();
    const p = b.attributes.position;
    for (let k = 0; k < p.count; k++) if (p.getY(k) < -0.5) p.setY(k, -0.5 + (p.getY(k) + 0.5) * 0.2);
    b.scale(0.88, 0.95, 0.68);
    b.computeVertexNormals();
    bk.add(mats.rock, b, { p: [LX - 0.52, LY + 0.48, z - 0.8], r: [0, i * 1.3, 0], uv: 1 / 3, color: rockShade });
    // a stone or two beside it
    const s2 = blob(0.32, { detail: 1, amp: 0.25, seed: 30 + i }).toNonIndexed();
    s2.computeVertexNormals();
    bk.add(mats.rock, s2, { p: [LX - 1.25, LY + 0.12, z - 1.6], uv: 1 / 3, color: rockShade });
  });
  // the pile
  const pile = new THREE.Group();
  pile.name = 'beacon-pile';
  const pk = parts();
  const px = LX + 0.35;
  {
    pk.add(mats.rock, new THREE.BoxGeometry(3.4, 0.5, 2.9), { p: [px, LY + 0.2, zPile], uv: 1 / 2, color: 0xb0aca6 });
    const pr = rng(303);
    const layers = 10;
    const baseY = LY + 0.45;
    const rad = 0.16;
    for (let l = 0; l < layers; l++) {
      const span = 2.65 - l * 0.11;
      const count = Math.max(3, Math.floor(span / (rad * 2.1)));
      const alongX = l % 2 === 0;
      const y = baseY + rad + l * rad * 1.95;
      for (let i = 0; i < count; i++) {
        const t = -span / 2 + rad + ((span - 2 * rad) * i) / (count - 1);
        const len = span + 0.2 + pr() * 0.25;
        const r = rad * (0.85 + pr() * 0.3);
        const log = new THREE.CylinderGeometry(r, r * (0.9 + pr() * 0.2), len, 8, 1, true).rotateZ(Math.PI / 2);
        const luv = log.attributes.uv;
        for (let q = 0; q < luv.count; q++) luv.setXY(q, luv.getY(q) * len * 0.6, luv.getX(q) * 1.2);
        const ends = [new THREE.CircleGeometry(r, 7).rotateY(Math.PI / 2).translate(len / 2, 0, 0), new THREE.CircleGeometry(r, 7).rotateY(-Math.PI / 2).translate(-len / 2, 0, 0)];
        const turn = alongX ? 0 : Math.PI / 2;
        const off = (pr() - 0.5) * 0.2;
        const at = alongX ? [px + off, y, zPile + t] : [px + t, y, zPile + off];
        pk.add(mats.logs, log, { p: at, r: [0, turn, 0] });
        for (const e of ends) pk.add(mats.logEnd, e, { p: at, r: [0, turn, 0] });
      }
    }
    // brushwood heaped on top: sticks, and the dry mass the fire takes first
    const topY = baseY + layers * rad * 1.95;
    for (let i = 0; i < 60; i++) {
      const an = pr() * TAU;
      const r0 = pr() * 1.1;
      const a = V3(px + Math.cos(an) * r0, topY - 0.1, zPile + Math.sin(an) * r0);
      const b = a.clone().add(V3((pr() - 0.5) * 1.6, 0.3 + pr() * 0.7, (pr() - 0.5) * 1.6));
      pk.add(mats.logs, tube([a, b], 0.04, 0.015, { seg: 2, radial: 4 }));
    }
    const brush = blob(1, { detail: 2, amp: 0.45, freq: 2.6, seed: 61 }).scale(1.3, 0.5, 1.2);
    pk.add(mats.embers, brush, { p: [px, topY + 0.15, zPile], uv: 0.8 });
    // the ladder up its south face, on the line of the ledge (the way up)
    const zl = zPile + 1.5;
    for (const s of [-1, 1]) pk.add(mats.logs, tube([[LX + s * 0.28, LY, zl + 0.9], [LX + s * 0.28, topY - 0.2, zl]], 0.04, 0.035, { seg: 2, radial: 5 }));
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.6) / 11.5;
      pk.add(mats.logs, new THREE.CylinderGeometry(0.025, 0.025, 0.62, 5).rotateZ(Math.PI / 2), { p: [LX, mix(LY, topY - 0.2, t), mix(zl + 0.9, zl, t)] });
    }
  }
  pk.build(pile, { shadow: true, receive: true }).forEach((m) => (m.name = `pile-${m.material.name}`));
  g.add(pile);
  const fireAt = V3(px, LY + PILE.top + 0.1, zPile);
  // the guard's stool and his little table, with his supper
  const [sx, sy, sz] = ledgeAt(WATCH.s);
  {
    bk.add(mats.wood, new THREE.CylinderGeometry(0.22, 0.22, 0.06, 10), { p: [sx, sy + 0.45, sz] });
    for (let i = 0; i < 3; i++) {
      const an = (i / 3) * TAU + 0.4;
      bk.add(mats.wood, tube([[sx + Math.cos(an) * 0.24, sy, sz + Math.sin(an) * 0.24], [sx + Math.cos(an) * 0.12, sy + 0.43, sz + Math.sin(an) * 0.12]], 0.025, 0.02, { seg: 1, radial: 5 }));
    }
    // the table at his right hand as he sits facing south down the ledge
    const tx = LX - 0.98;
    const tz = sz + 0.15;
    bk.add(mats.wood, new THREE.BoxGeometry(0.62, 0.05, 0.5), { p: [tx, sy + 0.7, tz] });
    for (const [dx, dz] of [
      [-0.26, -0.2],
      [0.26, -0.2],
      [-0.26, 0.2],
      [0.26, 0.2],
    ])
      bk.add(mats.wood, new THREE.BoxGeometry(0.05, 0.68, 0.05), { p: [tx + dx, sy + 0.34, tz + dz] });
    bk.add(mats.jug, latheM([[0.001, 0], [0.09, 0.005], [0.14, 0.05], [0.15, 0.06]], 12, 1), { p: [tx - 0.1, sy + 0.725, tz] });
    bk.add(mats.bread, new THREE.SphereGeometry(0.09, 8, 6).scale(1.4, 0.65, 0.9), { p: [tx + 0.14, sy + 0.78, tz - 0.08] });
    bk.add(mats.jug, latheM([[0.001, 0], [0.05, 0], [0.055, 0.12], [0.05, 0.13]], 10, 1), { p: [tx + 0.16, sy + 0.725, tz + 0.12] });
    bk.add(mats.meat, new THREE.SphereGeometry(0.06, 8, 6).scale(1.3, 0.7, 1), { p: [tx - 0.1, sy + 0.77, tz] });
  }
  bk.build(g, { shadow: true, receive: true }).forEach((m) => (m.name = `ledge-${m.material.name}`));
  const set = (lit = 0) => {
    const k = clamp01(lit);
    mats.embers.emissiveIntensity = k * 3.2;
    mats.embers.color.setRGB(mix(0.2, 0.12, k), mix(0.15, 0.07, k), mix(0.1, 0.04, k));
  };
  set(0);
  return { group: g, pile: { group: pile, set }, fireAt, guardSeat: V3(sx, sy, sz) };
}

// ── the beacon peaks ──
// Seven mountains away north-west along the White Mountains, each a ragged
// cone of grey rock with snow on its shoulders and a pile on its summit.
function beaconPeaks(K) {
  const { mats, Q } = K;
  const g = new THREE.Group();
  g.name = 'beacon-peaks';
  const [NR, NH] = Q.peak;
  const geos = [];
  const fires = [];
  const pk = parts();
  BEACONS.forEach((b, bi) => {
    const n = makeNoise(500 + bi);
    const R = b.h * 1.1;
    const H = b.h;
    const pos = [];
    const col = [];
    const idx = [];
    for (let j = 0; j <= NH; j++) {
      const t = j / NH;
      for (let i = 0; i <= NR; i++) {
        const an = (i / NR) * TAU;
        const ca = Math.cos(an);
        const sa = Math.sin(an);
        // a twist to the ridges as they climb, sides that reach further than others
        const tw = an + (fbm(n, ca * 1.2 + 2, sa * 1.2 + t * 2, { octaves: 2 }) - 0.5) * 0.9;
        const gully = ridge(n, Math.cos(tw) * 3.2 + 3, Math.sin(tw) * 3.2 + t * 4.5, { octaves: 4 });
        const lump = fbm(n, ca * 1.6 + 7, sa * 1.6 + t * 2.2, { octaves: 5 });
        // the last rings make a small round summit for the pile
        let rr = R * Math.pow(1 - t, 1.3) * (0.62 + 0.76 * lump) * (0.74 + 0.45 * gully);
        let y = -30 + (H + 30) * Math.pow(t, 0.85) + (lump - 0.5) * H * 0.12 * (1 - t);
        if (j === NH - 1) {
          rr = 4.5;
          y = H - 0.6;
        } else if (j === NH) {
          rr = 0;
          y = H;
        } else {
          rr = Math.max(rr, 4.5 + (NH - 1 - j) * 1.2);
          y = Math.min(y, H - 1.5);
        }
        pos.push(b.x + ca * rr, y, b.z + sa * rr);
        const snow = smooth(0.62, 0.74, t + (lump - 0.5) * 0.3 - (1 - gully) * 0.12);
        const rock = 0.2 + lump * 0.12 + gully * 0.08;
        col.push(mix(rock, 0.92, snow), mix(rock * 0.97, 0.93, snow), mix(rock * 0.94, 0.98, snow));
      }
    }
    for (let j = 0; j < NH; j++) {
      for (let i = 0; i < NR; i++) {
        const a = j * (NR + 1) + i;
        const c = a + NR + 1;
        idx.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    const fl = geo.toNonIndexed();
    fl.computeVertexNormals();
    geos.push(fl);
    // the pile on top, bigger than the city's so it shows at this distance
    for (let l = 0; l < 6; l++) {
      const span = 4.6 - l * 0.4;
      for (let i = 0; i < 4; i++) {
        const t = -span / 2 + 0.4 + ((span - 0.8) * i) / 3;
        const log = new THREE.CylinderGeometry(0.3, 0.3, span + 0.4, 5).rotateZ(Math.PI / 2);
        pk.add(mats.logs, log, { p: l % 2 ? [b.x + t, H + 0.3 + l * 0.58, b.z] : [b.x, H + 0.3 + l * 0.58, b.z + t], r: [0, l % 2 ? Math.PI / 2 : 0, 0] });
      }
    }
    fires.push(V3(b.x, H + 0.3 + 6 * 0.58 + 0.4, b.z));
  });
  const merged = mergeAll(geos);
  const mesh = new THREE.Mesh(merged, mats.peak);
  mesh.name = 'beacon-mountains';
  g.add(mesh);
  pk.build(g, { shadow: false, receive: false }).forEach((m) => (m.name = 'beacon-piles'));
  return { group: g, fires };
}

// ── the Mountains of Shadow ──
// Far away east over the Pelennor: a long jagged ridge, dark, two ranks of
// it, one mesh.
function shadowRidge(K) {
  const { mats } = K;
  const n = makeNoise(611);
  const pos = [];
  const idx = [];
  const N = 220;
  for (const [R, hk, seed] of [
    [2640, 1, 0],
    [2900, 1.25, 17],
  ]) {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) {
      const an = -0.85 + (1.7 * i) / N;
      const rr = R + (fbm(n, i * 0.05 + seed, 2.1, { octaves: 3 }) - 0.5) * 260;
      const crest = ridge(n, i * 0.09 + seed, 5.7, { octaves: 4 });
      const peak = Math.pow(crest, 2.2);
      const h = (200 + 300 * peak + fbm(n, i * 0.3 + seed, 9.1, { octaves: 3 }) * 60) * hk;
      const x = Math.cos(an) * rr;
      const z = Math.sin(an) * rr;
      pos.push(x - Math.cos(an) * 260, -60, z - Math.sin(an) * 260);
      pos.push(x - Math.cos(an) * 90, h * 0.5, z - Math.sin(an) * 90);
      pos.push(x, h, z);
      pos.push(x + Math.cos(an) * 160, h * 0.55, z + Math.sin(an) * 160);
    }
    for (let i = 0; i < N; i++) {
      for (let r = 0; r < 3; r++) {
        const a = base + i * 4 + r;
        const b = a + 4;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geo = bufferGeo({ pos, idx }).toNonIndexed();
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mats.shadow);
  mesh.name = 'ephel-duath';
  const group = new THREE.Group();
  group.name = 'mountains-of-shadow';
  group.add(mesh);
  return { group };
}

// ── the kit ──

export function createMinasKit(renderer, { tier = 'high' } = {}) {
  const Q = QUALITY[tier] ?? QUALITY.high;
  const S = Q.tex;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const N = (field, s, k, o = {}) => T(normalFromField(field, s, s, k), { srgb: false, ...o });
  const ash = blocksCanvas(S, { seed: 3, rows: 10, len: [0.16, 0.34], light: [248, 246, 241], dark: [200, 201, 203], mortar: [176, 177, 178], streak: 0.2, spread: 0.42, cool: 1 });
  const pave = blocksCanvas(S, { seed: 5, rows: 8, len: [0.14, 0.28], joint: 1.6, bevel: 2, light: [238, 236, 231], dark: [192, 191, 188], mortar: [136, 136, 134], streak: 0.05, spread: 0.6, worn: 1 });
  const smo = smoothStoneCanvas(S >> 1);
  const cob = blocksCanvas(S >> 1, { seed: 23, rows: 12, len: [0.075, 0.12], joint: 1.6, bevel: 5, light: [156, 151, 142], dark: [92, 88, 83], mortar: [62, 59, 55], streak: 0.08, spread: 0.7, worn: 1.2 });
  const rk = rockCanvas(S);
  const sl = slateCanvas(S >> 1);
  const fac = facadeCanvas(Q.cell);
  const bark = barkCanvas(S >> 1);
  const ripple = rippleField(128);
  const tex = {
    ashlar: T(ash.c),
    ashlarN: N(ash.field, S, 2.4),
    paving: T(pave.c),
    pavingN: N(pave.field, S, 2.2),
    smooth: T(smo.c),
    smoothN: N(smo.field, S >> 1, 1.2),
    cobbles: T(cob.c),
    cobblesN: N(cob.field, S >> 1, 3.4),
    rock: T(rk.c),
    rockN: N(rk.field, S, 2),
    slate: T(sl.c),
    slateN: N(sl.field, S >> 1, 2.4),
    facade: T(fac.c),
    facadeGlow: T(fac.mask, { srgb: false }),
    banner: T(bannerCanvas(S >> 2), { wrap: false }),
    door: T(doorCanvas(S >> 1)),
    court: T(courtCanvas(S * 2), { wrap: false }),
    courtN: N(pave.field, S, 2, { repeat: [68 / 6, 68 / 6] }),
    hallFloor: T(hallFloorCanvas(S * 2)),
    grass: T(grassCanvas(S >> 1)),
    bark: T(bark.c),
    barkN: N(bark.field, S >> 1, 2.6),
    waterN: N(ripple, 128, 3, { repeat: [1.5, 1.5] }),
    fall: T(fallCanvas(128), { repeat: [3, 1] }),
    embers: T(emberCanvas(128), { repeat: [2, 2] }),
  };
  tex.hallEnv = envRoom(renderer, [0.03, 0.032, 0.036], [0.16, 0.17, 0.19], [
    [0xc8d4e4, 2.2, 3, 5, [9, 5, -6]],
    [0xc8d4e4, 2.2, 3, 5, [9, 5, 6]],
    [0xc8d4e4, 2.2, 3, 5, [-9, 5, -6]],
    [0xc8d4e4, 2.2, 3, 5, [-9, 5, 6]],
    [0xff9a48, 1.2, 2.4, 1.2, [6, 0.5, -8]],
    [0xff9a48, 1.2, 2.4, 1.2, [-6, 0.5, -8]],
  ]);
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const U = { uTime: { value: 0 } };
  const mats = {
    paving: M({ map: tex.paving, normalMap: tex.pavingN, normalScale: new THREE.Vector2(0.7, 0.7), vertexColors: true, roughness: 0.86 }),
    court: M({ map: tex.court, normalMap: tex.courtN, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.78 }),
    wall: M({ map: tex.ashlar, normalMap: tex.ashlarN, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, roughness: 0.84 }),
    trim: M({ map: tex.smooth, normalMap: tex.smoothN, normalScale: new THREE.Vector2(0.4, 0.4), color: 0xf6f3ec, vertexColors: true, roughness: 0.6 }),
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.93 }),
    road: M({ map: tex.cobbles, normalMap: tex.cobblesN, normalScale: new THREE.Vector2(1, 1), roughness: 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    house: M({ map: tex.facade, emissiveMap: tex.facadeGlow, emissive: hot(0xffb468, 1.6), emissiveIntensity: 0, roughness: 0.9 }),
    houseRoof: M({ map: tex.slate, normalMap: tex.slateN, roughness: 0.72 }),
    slate: M({ map: tex.slate, normalMap: tex.slateN, color: 0xd4dae2, roughness: 0.7 }),
    door: M({ map: tex.door, color: 0xc8c8d0, roughness: 0.48, metalness: 0.22, side: THREE.DoubleSide }),
    wood: M({ color: 0x5a3f2a, roughness: 0.85 }),
    iron: M({ color: 0x2a2b30, roughness: 0.45, metalness: 0.75, side: THREE.DoubleSide }),
    glass: M({ color: 0x1c232c, roughness: 0.12, metalness: 0.5, side: THREE.DoubleSide }),
    lampGlass: M({ color: 0xffe2b0, emissive: hot(0xffb060, 2.4), emissiveIntensity: 1, roughness: 0.3 }),
    towerGlow: M({ color: 0x2a3038, emissive: hot(0xdfe8ff, 0.6), emissiveIntensity: 0.6, roughness: 0.2, side: THREE.DoubleSide }),
    towerLamp: new THREE.MeshBasicMaterial({ color: hot(0xe8f0ff, 2.4) }),
    coals: new THREE.MeshBasicMaterial({ color: hot(0xff6a1a, 2.2) }),
    grass: M({ map: tex.grass, roughness: 0.95 }),
    water: M({ color: 0x3e5a66, normalMap: tex.waterN, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.06, metalness: 0.3 }),
    fall: M({ map: tex.fall, color: 0xdfeaf0, transparent: true, opacity: 0.6, depthWrite: false, roughness: 0.1, side: THREE.DoubleSide }),
    banner: M({ map: tex.banner, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.88 }),
    // the tree
    bark: M({ map: tex.bark, normalMap: tex.barkN, color: 0xf2efe8, roughness: 0.82 }),
    blossom: M({ color: 0xfffaf5, emissive: 0x4a4644, roughness: 0.6, side: THREE.DoubleSide }),
    leaf: M({ color: 0x5f8a4a, roughness: 0.75 }),
    // the hall
    hallFloor: M({ map: tex.hallFloor, roughness: 0.12, metalness: 0.15, envMap: tex.hallEnv, envMapIntensity: 1.4 }),
    hallStone: M({ map: tex.ashlar, normalMap: tex.ashlarN, normalScale: new THREE.Vector2(0.25, 0.25), color: 0xbab9b5, roughness: 0.7, envMap: tex.hallEnv, envMapIntensity: 0.5 }),
    marble: M({ map: tex.smooth, color: 0x2a2a2e, roughness: 0.14, metalness: 0.2, envMap: tex.hallEnv, envMapIntensity: 1.8 }),
    statueStone: M({ map: tex.smooth, normalMap: tex.smoothN, color: 0xd8d4ca, roughness: 0.62, envMap: tex.hallEnv, envMapIntensity: 0.5 }),
    throneStone: M({ map: tex.smooth, color: 0xf4f2ec, roughness: 0.32, envMap: tex.hallEnv, envMapIntensity: 1.1 }),
    ceiling: M({ color: 0x2c2c30, roughness: 0.9 }),
    pane: new THREE.MeshBasicMaterial({ color: hot(0xb8c6d8, 1.25), side: THREE.DoubleSide }),
    emblem: M({ map: tex.banner, alphaTest: 0.5, roughness: 0.4, envMap: tex.hallEnv, envMapIntensity: 0.6 }),
    gilt: M({ color: 0xc8a860, roughness: 0.3, metalness: 0.9, envMap: tex.hallEnv, envMapIntensity: 1.4, side: THREE.DoubleSide }),
    blackWood: M({ color: 0x141214, roughness: 0.35, metalness: 0.1, envMap: tex.hallEnv, envMapIntensity: 0.8 }),
    tomato: M({ color: 0xc8261a, roughness: 0.25, envMap: tex.hallEnv, envMapIntensity: 0.8 }),
    bread: M({ color: 0xb07a3c, roughness: 0.9 }),
    jug: M({ color: 0x8a6a4a, roughness: 0.5, envMap: tex.hallEnv, envMapIntensity: 0.5, side: THREE.DoubleSide }),
    meat: M({ color: 0x7a3a24, roughness: 0.6 }),
    // the beacon
    logs: M({ map: tex.bark, normalMap: tex.barkN, color: 0x6e5440, roughness: 0.92 }),
    logEnd: M({ color: 0xc09a68, roughness: 0.9 }),
    embers: M({ color: 0x4a3c2a, emissive: hot(0xff7a30, 1), emissiveMap: tex.embers, emissiveIntensity: 0, roughness: 1, flatShading: true }),
    peak: M({ vertexColors: true, roughness: 1, flatShading: true }),
    shadow: M({ color: 0x24212a, roughness: 1, flatShading: true, side: THREE.DoubleSide }),
  };
  mats.house = houseShader(mats.house);
  mats.houseRoof = roofShader(mats.houseRoof, { EAVE, RIDGE });
  mats.banner = swayBanner(mats.banner, U);
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const K = { mats, tex, renderer, Q };
  return {
    mats,
    tex,
    tick: (t) => {
      U.uTime.value = t;
      tex.waterN.offset.set(t * 0.03, t * 0.021);
      tex.fall.offset.y = -t * 0.8;
    },
    city: () => cityOf(K),
    tree: () => whiteTree(K),
    hall: () => hallInside(K),
    ledge: () => beaconLedge(K),
    peaks: () => beaconPeaks(K),
    shadow: () => shadowRidge(K),
  };
}
