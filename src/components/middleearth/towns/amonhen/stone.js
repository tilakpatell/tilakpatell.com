// Amon Hen’s stone: the paint of pale weathered stone gone green with moss,
// hewn blocks, drums of columns, grass, moss and fallen leaves. Moved out of
// props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, fbm, makeNoise, smooth } from '../../../../lib/paint';
import { blob, rng } from '../../shire/build';
import { _kc, _kd, _nv, _pv, C, noise3, TAU, tint, V3 } from './helpers';

// ── stone ──

// The colours old stone weathers to under the trees.
export const STONE = {
  base: C(0xa2a49e),
  grime: C(0x3a3c30),
  moss: C(0x4c6c1e),
  mossLit: C(0x86a634),
  damp: C(0x2e4216),
  lichen: C(0xc4c6a6),
  pale: C(0xdadbd0),
  streak: C(0x66665e),
};
export const MOSS = { dark: C(0x203410), mid: C(0x4a6c1c), lit: C(0x9ab83a), gold: C(0xb8b44a) };

// A colour for a point of stone (in its model's frame) on a face turned
// `nrm`: the grey, rain streaks down what stands upright, grime in the
// joints (`edge`), moss on what faces up and low down where it's damp, and
// lichen in patches. Seeded once for a whole model, so the moss runs on
// from one block to the next.
export function stonePaint(seed, { moss = 1, lichen = 1, damp = 1, base = STONE.base, vary = 0.12, ground = 0, streaks = 0.6, scale = 1 } = {}) {
  const n = makeNoise(seed);
  return (p, nrm, edge, out) => {
    const x = p.x / scale;
    const y = p.y / scale;
    const z = p.z / scale;
    const v = noise3(n, x * 0.7, y * 0.7, z * 0.7);
    out.copy(base).multiplyScalar(1 - vary + v * vary * 2);
    const side = 1 - Math.abs(nrm.y);
    const st = smooth(0.55, 0.8, n(x * 3.1 + z * 2.3, y * 0.22)) * side * streaks;
    out.lerp(STONE.streak, st * 0.55);
    if (edge) out.lerp(STONE.grime, 0.4);
    const up = clamp01((nrm.y - 0.2) / 0.55);
    const drift = noise3(n, x * 1.3 + 4, y * 1.3, z * 1.3);
    const m1 = up * smooth(0.46, 0.6, drift) * moss;
    const m2 = clamp01(1 - (p.y - ground) / (1.4 * scale)) * smooth(0.34, 0.6, noise3(n, x * 1.1, y * 2.2, z * 1.1 + 9)) * damp;
    const m3 = edge ? 0.45 * moss : 0;
    const mk = clamp01(m1 + m2 * 0.85 + m3);
    _kd.copy(STONE.damp).lerp(STONE.moss, up).lerp(STONE.mossLit, up * smooth(0.48, 0.75, drift));
    out.lerp(_kd, mk * 0.92);
    const l = smooth(0.6, 0.7, noise3(n, x * 2.1 + 7, y * 2.1, z * 2.1 + 3)) * lichen * (1 - mk);
    out.lerp(nrm.y > 0.2 ? STONE.lichen : STONE.pale, l * 0.55);
  };
}

// The outward normals of a six-sided block's faces, from its eight corners
// (x fastest, then y, then z, as boxCorners gives them).
export const HEX_FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 4, 5], [2, 3, 6, 7], [0, 2, 4, 6], [1, 3, 5, 7]];
export function hexNormals(P) {
  const ctr = V3();
  for (const p of P) ctr.add(p);
  ctr.multiplyScalar(1 / 8);
  return HEX_FACES.map(([a, b, c, d]) => {
    const nrm = V3().subVectors(P[d], P[a]).cross(V3().subVectors(P[c], P[b])).normalize();
    const fc = V3().add(P[a]).add(P[b]).add(P[c]).add(P[d]).multiplyScalar(0.25).sub(ctr);
    if (nrm.dot(fc) < 0) nrm.negate();
    return nrm;
  });
}

export function paintHull(geo, mains, paint, tintC) {
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    _nv.fromBufferAttribute(nr, i);
    let best = 0;
    for (const m of mains) best = Math.max(best, _nv.dot(m));
    const edge = mains.length > 0 && best < 0.975 && _nv.y < 0.8;
    for (let k = i; k < i + 3; k++) {
      _pv.fromBufferAttribute(p, k);
      paint(_pv, _nv, edge, _kc);
      if (tintC) _kc.multiply(tintC);
      col[k * 3] = _kc.r;
      col[k * 3 + 1] = _kc.g;
      col[k * 3 + 2] = _kc.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Colour a smooth geometry by `paint`, vertex by vertex, from its normals.
export function paintSmooth(geo, paint, tintC = null) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _pv.fromBufferAttribute(p, i);
    _nv.fromBufferAttribute(nr, i);
    paint(_pv, _nv, false, _kc);
    if (tintC) _kc.multiply(tintC);
    col[i * 3] = _kc.r;
    col[i * 3 + 1] = _kc.g;
    col[i * 3 + 2] = _kc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// The eight corners of a box w × h × d about its middle.
export function boxCorners(w, h, d) {
  const out = [];
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) out.push(V3((i - 0.5) * w, (j - 0.5) * h, (k - 0.5) * d));
  return out;
}
export const _mx = new THREE.Matrix4();
export const placeCorners = (P, { p = [0, 0, 0], r = [0, 0, 0] } = {}) => {
  _mx.compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V3(1, 1, 1));
  return P.map((q) => q.clone().applyMatrix4(_mx));
};
// The corners of a block of a ring, between angles a0 and a1, heights y0
// and y1, radii r0 and r1.
export function ringCorners(a0, a1, y0, y1, r0, r1) {
  const out = [];
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const a = i ? a1 : a0;
    const rr = k ? r1 : r0;
    out.push(V3(Math.cos(a) * rr, j ? y1 : y0, Math.sin(a) * rr));
  }
  return out;
}

// A worn block of stone from its eight corners (already where it lies):
// each corner cut back along its three edges, so every edge is chamfered and
// the corners rounded off, a few of them chipped deep. Flat-faced, coloured
// by `paint`.
export function hexBlock(P, { chamfer = 0.045, chip = 0.22, seed = 1, jitter = 0.012, paint = null, tint: tintC = null, flatBottom = false } = {}) {
  const r = rng(seed);
  const pts = [];
  for (let c = 0; c < 8; c++) {
    if (flatBottom && !(c & 2)) {
      pts.push(P[c].clone());
      continue;
    }
    const nb = [c ^ 1, c ^ 2, c ^ 4].map((o) => P[o].clone().sub(P[c]));
    const lens = nb.map((v) => v.length());
    const dirs = nb.map((v) => v.normalize());
    const k = chamfer * (r() < chip ? 2 + r() * 4 : 0.7 + r() * 0.6);
    for (let e = 0; e < 3; e++) {
      const f = (e + 1) % 3;
      const q = P[c].clone().addScaledVector(dirs[e], Math.min(k, lens[e] * 0.42)).addScaledVector(dirs[f], Math.min(k, lens[f] * 0.42));
      q.x += (r() - 0.5) * jitter;
      q.y += (r() - 0.5) * jitter;
      q.z += (r() - 0.5) * jitter;
      pts.push(q);
    }
  }
  const geo = new ConvexGeometry(pts);
  if (paint) paintHull(geo, hexNormals(P), paint, tintC);
  return geo;
}

// A lump of broken stone about `s` across: the hull of a few points.
export function chunkGeo(seed, s = 0.3, flat = 0.6, count = 10) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const b = Math.acos(2 * r() - 1);
    const k = s * (0.6 + r() * 0.5);
    pts.push(V3(Math.sin(b) * Math.cos(a) * k, Math.cos(b) * k * flat, Math.sin(b) * Math.sin(a) * k));
  }
  return new ConvexGeometry(pts);
}

// A drum of a fluted column, `r` round and `h` tall from y = 0: its flutes
// worn soft, its edges chipped here and there. `broken` breaks its top off
// raggedly, that deep. Its own texture coordinates, a metre a repeat.
export function drumGeo(r, h, { flutes = 16, seed = 1, broken = 0, caps = [true, true] } = {}) {
  const rnd = rng(seed);
  const n = makeNoise(seed);
  const seg = flutes * 4;
  const rows = broken ? 4 : 2;
  const chips = [];
  for (let i = 0; i < 3; i++) chips.push({ a: rnd() * TAU, top: rnd() < 0.5, w: 0.2 + rnd() * 0.4, d: 0.05 + rnd() * 0.08 });
  const topAt = (a) => (broken ? h - broken * (0.35 + 0.65 * fbm(n, Math.cos(a) * 1.4 + 3, Math.sin(a) * 1.4, { octaves: 3 })) : h);
  const radAt = (a, y, yTop) => {
    const f = 0.5 - 0.5 * Math.cos(a * flutes);
    let k = 1 - 0.07 * Math.pow(f, 0.7) + (noise3(n, Math.cos(a) * 2, y * 1.5, Math.sin(a) * 2) - 0.5) * 0.05;
    for (const c of chips) {
      const da = Math.abs(((a - c.a + Math.PI * 3) % TAU) - Math.PI);
      const dy = c.top ? yTop - y : y;
      k -= c.d * smooth(c.w, 0, da) * smooth(0.25, 0, dy);
    }
    return r * k;
  };
  const pos = [];
  const uv = [];
  const idx = [];
  const W = seg + 1;
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      const yTop = topAt(a);
      const y = (j / rows) * yTop;
      const rr = radAt(a, y, yTop);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uv.push((i / seg) * TAU * r, y);
    }
  }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < seg; i++) {
      const a = j * W + i;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  side.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  side.setIndex(idx);
  side.computeVertexNormals();
  const list = [side.toNonIndexed()];
  // the ends, each its own fan so its edge stays sharp: the broken top
  // humped and pitted
  const fan = (j, up) => {
    const fp = [];
    const fu = [];
    const ring = [];
    for (let i = 0; i <= seg; i++) ring.push([pos[(j * W + i) * 3], pos[(j * W + i) * 3 + 1], pos[(j * W + i) * 3 + 2]]);
    const cy = up ? (broken ? h - broken * 0.55 : h) : 0;
    for (let i = 0; i < seg; i++) {
      const a = ring[i];
      const b = ring[i + 1];
      const tri = up ? [[0, cy, 0], b, a] : [[0, cy, 0], a, b];
      for (const v of tri) {
        fp.push(...v);
        fu.push(v[0], v[2]);
      }
    }
    const f = new THREE.BufferGeometry();
    f.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    f.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
    f.computeVertexNormals();
    return f;
  };
  if (caps[1]) list.push(fan(rows, true));
  if (caps[0]) list.push(fan(0, false));
  return mergeGeometries(list, false);
}

// Tufts of rough grass, all in one geometry: blades of three triangles,
// bowed over, dark at the root and gold at the tip. Each tuft is
// { x, y, z, h, n, s (spread), dry (0..1) }.
export function grassGeo(tufts, seed = 1) {
  const r = rng(seed);
  const pos = [];
  const col = [];
  const nor = [];
  const root = C(0x24341a);
  const mid = C(0x4e7024);
  const tipG = C(0x8eb040);
  const tipD = C(0xc6b468);
  const k = new THREE.Color();
  for (const t of tufts) {
    const n = t.n ?? 7;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU;
      const lean = 0.2 + r() * 0.55;
      const h = t.h * (0.55 + r() * 0.55);
      const w = (0.02 + r() * 0.018) * (t.w ?? 1);
      const off = r() * (t.s ?? 0.1);
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const bx = t.x + dx * off;
      const bz = t.z + dz * off;
      const sx = -dz * w;
      const sz = dx * w;
      const mx = bx + dx * lean * h * 0.3;
      const mz = bz + dz * lean * h * 0.3;
      const my = t.y + h * 0.55;
      const tx = bx + dx * lean * h;
      const tz = bz + dz * lean * h;
      const ty = t.y + h * (1 - lean * 0.45);
      const v = [[bx - sx, t.y - 0.02, bz - sz], [bx + sx, t.y - 0.02, bz + sz], [mx + sx * 0.7, my, mz + sz * 0.7], [mx - sx * 0.7, my, mz - sz * 0.7], [tx, ty, tz]];
      k.copy(tipG).lerp(tipD, clamp01((t.dry ?? 0.25) + (r() - 0.5) * 0.5));
      const cs = [root, root, mid, mid, k];
      for (const tri of [[0, 1, 2], [0, 2, 3], [3, 2, 4]]) {
        for (const q of tri) {
          pos.push(...v[q]);
          col.push(cs[q].r, cs[q].g, cs[q].b);
          nor.push(dx * 0.25, 0.94, dz * 0.25);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// A cushion of moss `r` across, to lay on stone: a lumpy dome, flat
// beneath, gold-green where the light finds it and dark at its edges.
export function mossGeo(r, seed = 1, { h = 0.32, detail = 1 } = {}) {
  const g = blob(r, { detail, amp: 0.3, freq: 2.4, seed });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setY(i, y > 0 ? y * h : y * 0.12);
  }
  g.computeVertexNormals();
  const n = makeNoise(seed + 3);
  return tint(g, (x, y, z, out, nx, ny) => {
    const k = clamp01(0.25 + ny * 0.55 + (n((x * 4) / r, (z * 4) / r) - 0.5) * 0.6);
    out.copy(MOSS.dark).lerp(MOSS.mid, smooth(0, 0.5, k)).lerp(MOSS.lit, smooth(0.55, 1, k));
    if (n((x * 2) / r + 9, (z * 2) / r) > 0.7) out.lerp(MOSS.gold, 0.35);
  });
}

// A scatter of fallen leaves, for the ground: thirty or so, brown, ochre,
// olive and a few still green, each a little pointed leaf folded along its
// midrib, lying every way within `spread` metres.
export const LEAF_HUES = [C(0x6a4a24), C(0x8a6430), C(0xa88440), C(0x5a5a2a), C(0x7a6a34), C(0x4a3a20), C(0x8a8a3a)];
export function fallenLeavesGeo(seed = 1, { count = 34, spread = 1.2, size = 1 } = {}) {
  const r = rng(seed * 17 + 9);
  const pos = [];
  const col = [];
  const c = new THREE.Color();
  for (let k = 0; k < count; k++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * spread;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.006 + r() * 0.02;
    const len = (0.06 + r() * 0.05) * size;
    const wid = len * (0.45 + r() * 0.2);
    const turn = r() * TAU;
    const fold = 0.006 + r() * 0.01;
    const tilt = (r() - 0.5) * 0.3;
    c.copy(LEAF_HUES[Math.floor(r() * LEAF_HUES.length)]).multiplyScalar(0.8 + r() * 0.35);
    const P = (u, v, lift) => {
      const lx = u * len;
      const lz = v * wid;
      return [x + Math.cos(turn) * lx - Math.sin(turn) * lz, y + lift + lx * tilt, z + Math.sin(turn) * lx + Math.cos(turn) * lz];
    };
    const base = P(-0.5, 0, 0);
    const tip = P(0.5, 0, 0.004);
    const l = P(-0.05, -0.5, 0);
    const rr = P(-0.05, 0.5, 0);
    const mid = P(0, 0, fold);
    for (const tri of [[base, mid, l], [mid, tip, l], [base, rr, mid], [mid, rr, tip]]) {
      for (const v of tri) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const nr = geo.attributes.normal;
  for (let k = 0; k < nr.count; k++) if (nr.getY(k) < 0) nr.setXYZ(k, -nr.getX(k), -nr.getY(k), -nr.getZ(k));
  geo.computeBoundingSphere();
  return geo;
}
