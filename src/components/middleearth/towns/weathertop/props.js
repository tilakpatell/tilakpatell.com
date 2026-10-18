// Weathertop and the Ford of Bruinen, made in code: the kit the third
// walkable town is built from. The broken ring of Amon Sûl on the summit and
// the crags round it, the hobbits' camp in the dell, the three stone trolls,
// Asfaloth with Arwen and Frodo, the horses of the flood, athelas and the
// weeds it hides among, dead trees on the heath, pines and birches for the
// road to the Ford, a pine fallen across it, and a burning brand.
//
// Built with the Shire's kit (../../shire/props.js) as Bree's is: its
// materials and helpers, and a few of its own for old stone, water and fire.
// The same conventions: each builder's group stands on y = 0 at its origin,
// creatures face +x, and fixed parts are merged one mesh per material.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture, hot } from '../../../../lib/stage3d';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { B, ball, blob, boxUV, createShireKit, cyl, cylX, cylZ, fillColor, lanternParts, lathe, parts, rng, roundBox, tf, tube } from '../../shire/props';
import { createStride, createTracker, footAt, legRig } from '../../creatures';
import { churnMaterial, emberGlow, floodWaterMaterial, hairBothSides, sprayPoints } from './propsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// Three dimensions of lumps from the two-dimensional noise.
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── painted textures ──

// Old stone, nearly white so the vertex colours give its hue: a granular
// grain, shallow pits, hairline cracks in places, rain streaks down it, and
// crusts and rings of lichen. With its relief, for the normal map.
function weatheredCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const pits = makeCells(seed + 7);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 5, v * 5, 5);
    const crack = (1 - smooth(0, 0.03, k.f2 - k.f1)) * smooth(0.5, 0.62, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const q = pits(u * 22, v * 22, 22);
    const pit = q.id < 0.25 ? 1 - smooth(0.04, 0.16, q.f1) : 0;
    const streak = (n(u * 48, 3.5, 48) - 0.5) * smooth(0.4, 0.7, fbm(n, u * 2 + 1, v * 2, { period: 2, octaves: 2 }));
    field[py * S + px] = clamp01(0.35 + big * 0.45 + grain * 0.18 - crack * 0.4 - pit * 0.25);
    const t = 0.76 + big * 0.24 + (grain - 0.5) * 0.12 - crack * 0.34 - pit * 0.14 - streak * 0.26;
    let r = 236 * t;
    let g = 234 * t;
    let b = 226 * t;
    // lichen: pale yellow-green crusts in drifts, a few white rings, and
    // specks of black
    const drift = fbm(n, u * 3 + 11, v * 3 + 4, { period: 3, octaves: 2 });
    const l1 = smooth(0.6, 0.68, fbm(n, u * 6 + 3, v * 6 + 1, { period: 6, octaves: 4 }) + (drift - 0.5) * 0.4);
    const ring = q.id > 0.86 ? smooth(0.12, 0.2, q.f1) * (1 - smooth(0.24, 0.32, q.f1)) : 0;
    const l3 = smooth(0.76, 0.8, fbm(n, u * 32 + 2, v * 32 + 8, { period: 32, octaves: 2 }));
    r = mix(r, 220, l1 * 0.55);
    g = mix(g, 210, l1 * 0.55);
    b = mix(b, 150, l1 * 0.55);
    r = mix(r, 248, ring * 0.45);
    g = mix(g, 248, ring * 0.45);
    b = mix(b, 240, ring * 0.45);
    r = mix(r, 80, l3 * 0.35);
    g = mix(g, 82, l3 * 0.35);
    b = mix(b, 74, l3 * 0.35);
    out[0] = r;
    out[1] = g;
    out[2] = b;
  });
  return { c, field };
}

// Wool, coarse and fulled, grey so a material's colour dyes it (a riding
// cloak, a blanket): a weave, darker in the creases.
function woolCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const weave = Math.sin(u * S * 1.2) * Math.sin(v * S * 1.2) * 0.5 + 0.5;
    const blotch = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const fine = fbm(n, u * 48 + 3, v * 48, { period: 48, octaves: 2 });
    field[py * S + px] = weave * 0.25 + blotch * 0.5 + fine * 0.25;
    const k = 0.7 + blotch * 0.3 + fine * 0.1 - weave * 0.08;
    out[0] = 230 * k;
    out[1] = 230 * k;
    out[2] = 230 * k;
  });
  return { c, field };
}

// ── stone ──

// The colours old stone weathers to at night.
const STONE = {
  base: C(0x8e8b82),
  grime: C(0x26271f),
  moss: C(0x43532a),
  damp: C(0x2c3a1e),
  lichen: C(0xb2aa74),
  pale: C(0xc2c4b8),
};

// A colour for a point of stone (in its model's frame) on a face turned
// `nrm`, from the grey, grime in the joints (`edge`), moss on what faces up
// and low down where it's damp, and lichen in patches. Seeded once for a
// whole model, so the moss runs on from one block to the next.
function stonePaint(seed, { moss = 1, lichen = 1, damp = 1, base = STONE.base, vary = 0.13, ground = 0 } = {}) {
  const n = makeNoise(seed);
  return (p, nrm, edge, out) => {
    const v = noise3(n, p.x * 0.8, p.y * 0.8, p.z * 0.8);
    out.copy(base).multiplyScalar(1 - vary + v * vary * 2);
    if (edge) out.lerp(STONE.grime, 0.5);
    const up = clamp01((nrm.y - 0.3) / 0.5);
    const m1 = up * smooth(0.4, 0.6, noise3(n, p.x * 1.6 + 4, p.y * 1.6, p.z * 1.6)) * moss;
    const m2 = clamp01(1 - (p.y - ground) / 1.2) * smooth(0.36, 0.62, noise3(n, p.x * 1.1, p.y * 2.2, p.z * 1.1 + 9)) * damp;
    out.lerp(m2 > m1 ? STONE.damp : STONE.moss, clamp01(m1 + m2 * 0.85) * 0.85);
    const l = smooth(0.58, 0.68, noise3(n, p.x * 2.1 + 7, p.y * 2.1, p.z * 2.1 + 3)) * lichen;
    out.lerp(nrm.y > 0.25 ? STONE.lichen : STONE.pale, l * 0.5);
  };
}

// The outward normals of a six-sided block's faces, from its eight corners
// (x fastest, then y, then z, as boxCorners gives them).
const HEX_FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 4, 5], [2, 3, 6, 7], [0, 2, 4, 6], [1, 3, 5, 7]];
function hexNormals(P) {
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

// Colour a hull's triangles: each one's own normal says whether it is one of
// the block's faces or a worn edge between them.
const _pv = V3();
const _nv = V3();
const _kc = new THREE.Color();
const _pc = new THREE.Color();
function paintHull(geo, mains, paint, tint) {
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
      if (tint) _kc.multiply(tint);
      col[k * 3] = _kc.r;
      col[k * 3 + 1] = _kc.g;
      col[k * 3 + 2] = _kc.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// The eight corners of a box w × h × d about its middle.
function boxCorners(w, h, d) {
  const out = [];
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) out.push(V3((i - 0.5) * w, (j - 0.5) * h, (k - 0.5) * d));
  return out;
}
const _mx = new THREE.Matrix4();
const placeCorners = (P, { p = [0, 0, 0], r = [0, 0, 0] } = {}) => {
  _mx.compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V3(1, 1, 1));
  return P.map((q) => q.clone().applyMatrix4(_mx));
};

// A worn block of stone from its eight corners (already where it lies):
// each corner cut back along its three edges, so every edge is chamfered and
// the corners rounded off, a few of them chipped deep; `cut(p)` breaks its
// top off at that height, roughly. Flat-faced, coloured by `paint`.
function hexBlock(P, { chamfer = 0.045, chip = 0.22, seed = 1, cut = null, jitter = 0.012, paint = null, tint = null, flatBottom = false } = {}) {
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
      if (cut) q.y = Math.min(q.y, cut(q));
      pts.push(q);
    }
  }
  const geo = new ConvexGeometry(pts);
  if (paint) paintHull(geo, cut ? hexNormals(P).filter((m) => m.y < 0.9) : hexNormals(P), paint, tint);
  return geo;
}

// A lump of broken stone about `s` across: the hull of a few points.
function chunkGeo(seed, s = 0.3, flat = 0.6) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = r() * TAU;
    const b = Math.acos(2 * r() - 1);
    const k = s * (0.6 + r() * 0.5);
    pts.push(V3(Math.sin(b) * Math.cos(a) * k, Math.cos(b) * k * flat, Math.sin(b) * Math.sin(a) * k));
  }
  return new ConvexGeometry(pts);
}

// Tufts of rough grass, all in one geometry: blades of three triangles,
// bowed over, dark at the root and bleached at the tip. Each tuft is
// { x, y, z, h, n, s (spread), dry (0..1) }.
function grassGeo(tufts, seed = 1) {
  const r = rng(seed);
  const pos = [];
  const col = [];
  const nor = [];
  const root = C(0x222c16);
  const mid = C(0x4e5e34);
  const tipG = C(0x84905a);
  const tipD = C(0xb0a474);
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
      k.copy(tipG).lerp(tipD, clamp01((t.dry ?? 0.4) + (r() - 0.5) * 0.5));
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

// ── Amon Sûl ──

// The ruin of the watchtower on the summit, from RUIN (../layout.js): a ring
// of thick walls of big grey ashlar, r out to their middle and `thick`
// through, broken down to ragged stepped tops; tall piers either side of
// three gaps with what is left of their arches; a floor of flagstones,
// cracked, heaved and gone in places, and a broken plinth in the middle;
// tumbled blocks in and around it, and grass at every foot.
function ruin(K, RUIN) {
  const { mats } = K;
  const { r: R, thick: T, walls, arches = [], fallen = [] } = RUIN;
  const g = new THREE.Group();
  g.name = 'amonSul';
  const bk = parts();
  const rand = rng(17);
  const tufts = [];
  const paint = stonePaint(5);
  const tintOf = () => {
    const t = new THREE.Color(1, 1, 1);
    const k = rand();
    if (k < 0.3) t.setRGB(1.06, 1.02, 0.94);
    else if (k < 0.55) t.setRGB(0.92, 0.95, 1.0);
    else if (k < 0.65) t.setRGB(0.8, 0.8, 0.78);
    return t.multiplyScalar(0.92 + rand() * 0.16);
  };
  let seed = 1;
  const block = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint, tint: tintOf(), ...o }), { uv: 0.42 });
  const rubble = (x, y, z, s) => {
    const geo = chunkGeo(seed++, s, 0.55 + rand() * 0.3);
    tf(geo, { p: [x, y + s * 0.12, z], r: [rand(), rand() * TAU, rand() * 0.4] });
    bk.add(mats.ruin, paintHull(geo, [], paint, tintOf()), { uv: 0.42 });
  };
  const ringCorners = (a0, a1, y0, y1, r0, r1) => {
    const out = [];
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const a = i ? a1 : a0;
      const rr = k ? r1 : r0;
      out.push(V3(Math.cos(a) * rr, j ? y1 : y0, Math.sin(a) * rr));
    }
    return out;
  };
  const at = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];

  // the gaps that keep their arches, between which two walls' ends
  const PW = 1.45; // a pier along the ring
  const PD = T + 0.24; // and through it
  const YS = 3.75; // where the arches spring
  const DEPTH = 0.62; // the arch stones, from soffit to back
  const sorted = [...walls].sort((a, b) => a[0] - b[0]);
  const archs = arches.map((c) => {
    let prev = null;
    let next = null;
    for (const w of sorted) {
      if (w[1] <= c && (!prev || w[1] > prev[1])) prev = w;
      if (w[0] >= c && (!next || w[0] < next[0])) next = w;
    }
    const a0 = prev ? prev[1] : c - 0.125;
    const a1 = next ? next[0] : c + 0.125;
    return { c: (a0 + a1) / 2, a0, a1, half: (a1 - a0) / 2 };
  });
  const pierAt = (a) => archs.some((A) => Math.abs(A.a0 - a) < 1e-4 || Math.abs(A.a1 - a) < 1e-4);

  // ── the walls ──
  walls.forEach(([a0, a1, H], wi) => {
    const pS = pierAt(a0);
    const pE = pierAt(a1);
    const s0 = a0 + (pS ? PW / R : 0);
    const s1 = a1 - (pE ? PW / R : 0);
    const n = makeNoise(100 + wi);
    // the line of its broken top along it: high in places, falling away to
    // rubble at a free end, held up against a pier
    const raw = (u) => {
      let k = 0.58 + 0.42 * fbm(n, u * 3.2 + wi * 1.7, 0.5, { octaves: 3 });
      if (!pS) k *= mix(0.15, 1, smooth(0, 0.42, u));
      else k = Math.max(k, 0.9 * (1 - smooth(0.05, 0.22, u)));
      if (!pE) k *= mix(0.15, 1, smooth(0, 0.42, 1 - u));
      else k = Math.max(k, 0.9 * (1 - smooth(0.05, 0.22, 1 - u)));
      return k;
    };
    let peak = 0;
    for (let i = 0; i <= 80; i++) peak = Math.max(peak, raw(i / 80));
    const hAt = (u) => (raw(u) / peak) * H;
    const Larc = (s1 - s0) * R;
    const courses = [{ y0: -0.3, y1: 0.32, base: true }];
    for (let y = 0.32; y < H - 0.05;) {
      const h = 0.5 + rand() * 0.17;
      courses.push({ y0: y, y1: y + h });
      y += h;
    }
    courses.forEach((c, ci) => {
      let pos = 0;
      let first = true;
      while (pos < Larc - 0.02) {
        let L = first && ci % 2 ? 0.4 + rand() * 0.5 : 0.85 + rand() * 0.8;
        first = false;
        if (Larc - pos - L < 0.45) L = Larc - pos;
        const u = (pos + L / 2) / Larc;
        const b0 = s0 + (pos + 0.004) / R;
        const b1 = s0 + (pos + L - 0.004) / R;
        pos += L;
        const top = hAt(u);
        if (!c.base && c.y0 > top - 0.24) continue;
        const broken = !c.base && c.y1 > top + 0.05;
        const thick = c.base ? T + 0.18 : T + (rand() - 0.5) * 0.04;
        const dr = (rand() - 0.5) * 0.05;
        let r0 = R - thick / 2 + dr;
        let r1 = R + thick / 2 + dr;
        // now and then a face stone robbed, the core behind it showing
        if (!c.base && !broken && ci < courses.length - 1 && rand() < 0.06) {
          if (rand() < 0.5) r0 += thick * 0.42;
          else r1 -= thick * 0.42;
        }
        const nb = makeNoise(seed * 7);
        const slope = (rand() - 0.5) * 0.5;
        const am = (b0 + b1) / 2;
        const cut = broken ? (q) => Math.max(c.y0 + 0.16, top + (nb(q.x * 2.2, q.z * 2.2) - 0.5) * 0.35 + slope * ((Math.atan2(q.z, q.x) - am) * R)) : null;
        let P = ringCorners(b0, b1, c.y0, c.y1, r0, r1);
        // a top stone gone out of true: leaning out, or in, off its bed
        if (!broken && !c.base && c.y1 + 0.55 > top - 0.24 && rand() < 0.4) {
          const axis = V3(-Math.sin(am), 0, Math.cos(am));
          const side = rand() < 0.6 ? 1 : -1;
          const pivot = V3(Math.cos(am) * (side > 0 ? r1 : r0), c.y0, Math.sin(am) * (side > 0 ? r1 : r0));
          const tilt = side * (0.04 + rand() * 0.08);
          P = P.map((q) => q.sub(pivot).applyAxisAngle(axis, -tilt).add(pivot));
        }
        block(P, { cut, chip: broken ? 0.55 : c.base ? 0.3 : 0.2 });
        // the tops: grass where soil has gathered on them
        const nextTop = c.y1 + 0.6;
        if ((broken || nextTop > top) && rand() < 0.4) {
          const [x, z] = at(am + (rand() - 0.5) * (b1 - b0) * 0.6, R + (rand() - 0.5) * 0.4);
          tufts.push({ x, y: broken ? top - 0.05 : c.y1, z, h: 0.32, n: 6, s: 0.12, dry: 0.55 });
        }
      }
    });
    // grass and fallen stones along its feet, inside and out
    for (let pos = 0.3; pos < Larc; pos += 0.45 + rand() * 0.5) {
      const a = s0 + pos / R;
      const u = pos / Larc;
      for (const side of [-1, 1]) {
        if (rand() < 0.2) continue;
        const [x, z] = at(a, R + side * (T / 2 + 0.12 + rand() * 0.25));
        tufts.push({ x, y: 0, z, h: 0.45 + rand() * 0.3, n: 8, s: 0.18, dry: 0.35 });
      }
      // where the wall has come down, its stones lie at its foot
      const fallenHere = (1 - hAt(u) / H) * (u < 0.3 || u > 0.7 ? 1 : 0.4);
      if (rand() < fallenHere * 0.7) {
        const side = rand() < 0.6 ? 1 : -1;
        const [x, z] = at(a + (rand() - 0.5) * 0.04, R + side * (T / 2 + 0.3 + rand() * 0.9));
        rubble(x, 0, z, 0.22 + rand() * 0.3);
      }
    }
  });

  // ── the piers and their broken arches ──
  const PIERS = [[5.75, 5.3], [5.95, 5.55], [5.5, 4.25]];
  const KEEP = [[4, 2], [3, 5], [5, 0]];
  archs.forEach((A, j) => {
    const [hl, hr] = PIERS[j % PIERS.length];
    const [kl, kr] = KEEP[j % KEEP.length];
    const backA = (DEPTH + 0.03) / R; // the arch's back, from the gap's edge
    for (const side of [-1, 1]) {
      const H = side < 0 ? hl : hr;
      const arched = (side < 0 ? kl : kr) > 0;
      const pa0 = side < 0 ? A.a0 - PW / R : A.a1;
      const pa1 = side < 0 ? A.a0 : A.a1 + PW / R;
      const ri = R - PD / 2;
      const ro = R + PD / 2;
      // a plinth, a little proud
      block(ringCorners(pa0 - 0.08 / R, pa1 + 0.08 / R, -0.3, 0.42, ri - 0.08, ro + 0.08), { chip: 0.3 });
      let y = 0.42;
      const below = Math.min(YS - 0.32, H);
      while (y < below - 0.05) {
        const h = Math.min(0.62 + rand() * 0.14, below - y);
        const last = y + h >= H - 0.01;
        const top = y + h;
        block(ringCorners(pa0 + (rand() - 0.5) * 0.006, pa1 + (rand() - 0.5) * 0.006, y, top, ri + (rand() - 0.5) * 0.04, ro + (rand() - 0.5) * 0.04), { cut: last ? (q) => top - 0.2 - Math.abs(Math.sin(q.x * 3 + q.z)) * 0.25 : null, chip: last ? 0.6 : 0.2 });
        y = top;
      }
      if (H > YS - 0.32) {
        // the impost the arch springs from, moulded proud of the pier
        block(ringCorners(pa0 - 0.07 / R, pa1 + 0.07 / R, YS - 0.32, YS, ri - 0.07, ro + 0.07), { chamfer: 0.06, chip: 0.25 });
        // and the pier goes on up behind the arch
        const q0 = side < 0 ? pa0 : arched ? A.a1 + backA : A.a1;
        const q1 = side < 0 ? (arched ? A.a0 - backA : A.a0) : pa1;
        y = YS;
        while (y < H - 0.05) {
          const h = Math.min(0.6 + rand() * 0.14, H - y);
          const top = y + h;
          const last = top >= H - 0.01;
          const tilt = (rand() - 0.5) * 0.6;
          const nb = makeNoise(seed * 3);
          block(ringCorners(q0, q1, y, top, ri + 0.02, ro - 0.02), { cut: last ? (q) => top - 0.12 + tilt * (Math.atan2(q.z, q.x) - (q0 + q1) / 2) * R - nb(q.x * 3, q.z * 3) * 0.3 : null, chip: last ? 0.6 : 0.22 });
          y = top;
        }
        if (rand() < 0.8) {
          const [x, z] = at((q0 + q1) / 2, R);
          tufts.push({ x, y: H - 0.25, z, h: 0.3, n: 5, s: 0.1, dry: 0.6 });
        }
      }
      // grass at its foot
      for (const s of [-1, 1]) {
        const [x, z] = at((pa0 + pa1) / 2 + (rand() - 0.5) * 0.08, R + s * (PD / 2 + 0.2));
        tufts.push({ x, y: 0, z, h: 0.55, n: 10, s: 0.25, dry: 0.3 });
      }
    }
    // the arch, square to the gap: its stones from the left springing round
    const t = V3(-Math.sin(A.c), 0, Math.cos(A.c));
    const nrm = V3(Math.cos(A.c), 0, Math.sin(A.c));
    const O = nrm.clone().multiplyScalar(R * Math.cos(A.half));
    const rho = R * Math.sin(A.half);
    const N = 9;
    for (let i = 0; i < N; i++) {
      if (!(i < kl || i >= N - kr)) continue;
      const th0 = Math.PI - (i / N) * Math.PI - 0.004;
      const th1 = Math.PI - ((i + 1) / N) * Math.PI + 0.004;
      const P = [];
      for (let k = 0; k < 2; k++) for (let jj = 0; jj < 2; jj++) for (let ii = 0; ii < 2; ii++) {
        const th = ii ? th1 : th0;
        const rr = rho + (jj ? DEPTH : 0);
        P.push(O.clone().addScaledVector(t, Math.cos(th) * rr).addScaledVector(nrm, (k - 0.5) * T).setY(YS + Math.sin(th) * rr));
      }
      const end = i === kl - 1 || i === N - kr;
      block(P, { chamfer: 0.04, chip: end ? 0.7 : 0.2 });
    }
  });

  // ── the floor ──
  const FR = R - 0.3;
  const glow = [];
  const earth = new THREE.CircleGeometry(FR + 0.15, 56);
  const ne = makeNoise(9);
  bk.add(mats.earth, earth, {
    r: [-Math.PI / 2, 0, 0],
    p: [0, -0.07, 0],
    color: (x, y, z, out) => out.setRGB(0.05, 0.06, 0.035).lerp(_kc.setRGB(0.07, 0.1, 0.035), smooth(0.4, 0.6, ne(x * 0.6, z * 0.6))),
  });
  const floorPaint = stonePaint(11, { moss: 0.7, damp: 0.25, lichen: 0.8, base: C(0x86847c) });
  const rings = [1.62, 2.55, 3.45, 4.4, 5.3, 6.25, 7.2, 8.2, FR];
  for (let i = 0; i < rings.length - 1; i++) {
    const r0 = rings[i] + 0.02;
    const r1 = rings[i + 1] - 0.02;
    const rm = (r0 + r1) / 2;
    const count = Math.max(6, Math.round((TAU * rm) / (1.05 + rand() * 0.35)));
    const lens = Array.from({ length: count }, () => 0.7 + rand() * 0.6);
    const sum = lens.reduce((a, b) => a + b, 0);
    let a = rand() * TAU;
    const nearWall = r1 > FR - 1.2;
    for (const l of lens) {
      const span = (l / sum) * TAU;
      const g0 = a + 0.02 / rm;
      const g1 = a + span - 0.02 / rm;
      a += span;
      const am = (g0 + g1) / 2;
      const [cx, cz] = at(am, rm);
      if (rand() < (nearWall ? 0.18 : 0.06)) {
        // a slab gone: earth and grass in the hole
        tufts.push({ x: cx, y: -0.05, z: cz, h: 0.35, n: 12, s: (r1 - r0) * 0.4, dry: 0.3 });
        if (rand() < 0.5) rubble(cx + (rand() - 0.5) * 0.4, -0.06, cz + (rand() - 0.5) * 0.4, 0.14);
        continue;
      }
      // a slab: heaved up at an edge now and then, cracked across now and then
      const heave = rand() < 0.12 ? 0.05 + rand() * 0.09 : 0;
      const hx = (rand() - 0.5) * 2;
      const hz = (rand() - 0.5) * 2;
      const y0 = (rand() - 0.5) * 0.025 - 0.015 * (nearWall ? 1 : 0);
      const lift = (q) => {
        if (!heave) return q;
        const dx = q.x - cx;
        const dz = q.z - cz;
        q.y += Math.max(0, (dx * hx + dz * hz) * heave);
        return q;
      };
      const pieces = rand() < 0.14 ? [[g0, (g0 + g1) / 2 - 0.018 / rm], [(g0 + g1) / 2 + 0.018 / rm, g1]] : [[g0, g1]];
      if (pieces.length > 1 && glow.length < 4 && rm > 2.5 && rm < 7) {
        const [gx, gz] = at((g0 + g1) / 2, rm);
        glow.push(V3(gx, 0.02, gz));
      }
      for (const [p0, p1] of pieces) {
        const dy = pieces.length > 1 ? (rand() - 0.5) * 0.05 : 0;
        const P = ringCorners(p0, p1, -0.16 + y0 + dy, y0 + dy, r0, r1).map(lift);
        bk.add(mats.ruin, hexBlock(P, { seed: seed++, chamfer: 0.035, chip: 0.25, paint: floorPaint, tint: tintOf(), flatBottom: true }), { uv: 0.42 });
      }
      if (nearWall && rand() < 0.45) {
        const [x, z] = at(g1, rm + (rand() - 0.5) * 0.5);
        tufts.push({ x, y: 0, z, h: 0.3, n: 6, s: 0.1, dry: 0.4 });
      }
    }
  }
  // grass in the joints, here and there across the floor
  for (let i = 0; i < 26; i++) {
    const a = rand() * TAU;
    const [x, z] = at(a, 2 + rand() * (FR - 2.4));
    tufts.push({ x, y: 0, z, h: 0.22, n: 5, s: 0.08, dry: 0.5 });
  }

  // ── the plinth in the middle: two worn steps and a broken column ──
  for (const [ra, rb, y0, y1, cnt] of [[1.0, 1.6, -0.12, 0.2, 9], [0.62, 1.04, 0.2, 0.46, 7]]) {
    const off = rand();
    for (let i = 0; i < cnt; i++) {
      const p0 = ((i + off) / cnt) * TAU + 0.006;
      const p1 = ((i + 1 + off) / cnt) * TAU - 0.006;
      block(ringCorners(p0, p1, y0, y1 + (rand() - 0.5) * 0.03, ra, rb), { chamfer: 0.05, chip: 0.35 });
    }
  }
  const drum = new THREE.CylinderGeometry(0.5, 0.53, 1, 20, 4);
  {
    const p = drum.attributes.position;
    const nd = makeNoise(31);
    // the break: high on one side, shattered lower on the other
    const hb = (a, d) => 0.6 + 0.32 * (0.5 + 0.5 * Math.cos(a - 0.7)) + (nd(a * 2.5, d * 3) - 0.5) * 0.16;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i) + 0.5;
      const a = Math.atan2(z, x);
      const d = Math.hypot(x, z);
      let yy = y;
      if (y > 0.99) yy = d < 0.01 ? 0.72 : hb(a, d);
      else if (y > 0.7) yy = Math.min(y, hb(a, 0.5) - 0.06);
      const k = 1 + (nd(a * 3, yy * 4) - 0.5) * 0.05;
      p.setXYZ(i, x * k, yy, z * k);
    }
    drum.computeVertexNormals();
  }
  drum.translate(0, 0.46, 0);
  bk.add(mats.ruin, paintSmooth(drum, paint), { uv: 0.42 });
  // the column's next drum, fallen and lying by it
  const drum2 = new THREE.CylinderGeometry(0.5, 0.5, 0.95, 20, 1);
  tf(drum2, { r: [Math.PI / 2, 0.6, 0], p: [1.9, 0.42, -1.2] });
  bk.add(mats.ruin, paintSmooth(drum2, paint), { uv: 0.42 });
  for (const [x, z] of [[1.3, 0.2], [-1.5, 0.6], [0.2, -1.7], [2.4, -0.4], [1.4, -1.9]]) tufts.push({ x, y: 0, z, h: 0.3, n: 7, s: 0.12, dry: 0.4 });

  bk.add(mats.grass, grassGeo(tufts, 3));
  bk.build(g);

  // ── tumbled blocks, each in its own group so it can sit on the hill ──
  const tumbled = fallen.map(([x, z, turn, size], i) => {
    const fg = new THREE.Group();
    fg.name = 'fallenBlock';
    fg.position.set(x, 0, z);
    g.add(fg);
    const fb = parts();
    const tilt = [(rand() - 0.5) * 0.45, turn, (rand() - 0.5) * 0.45];
    let P;
    if (i % 3 === 2) {
      // a stone of an arch
      P = [];
      for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let ii = 0; ii < 2; ii++) {
        const th = (ii ? 0.2 : -0.2) + Math.PI / 2;
        const rr = (j ? 1.25 : 0.62) * size;
        P.push(V3(Math.cos(th) * rr, Math.sin(th) * rr - 0.9 * size, (k - 0.5) * 0.9 * size));
      }
      P = placeCorners(P, { r: [Math.PI / 2 + tilt[0] * 0.3, turn, 0.15] });
      for (const q of P) q.y += 0.3 * size;
    } else P = placeCorners(boxCorners(1.3 * size, 0.62 * size, 0.92 * size), { p: [0, 0.2 * size, 0], r: tilt });
    fb.add(mats.ruin, hexBlock(P, { seed: 300 + i, chamfer: 0.05, chip: 0.55, paint: stonePaint(5, { ground: -0.1 }), tint: tintOf() }), { uv: 0.42 });
    // a piece knocked off it
    if (i % 2 === 0) {
      const geo = chunkGeo(400 + i, 0.32 * size, 0.6);
      tf(geo, { p: [0.75 * size * Math.cos(turn + 1), 0.05, 0.75 * size * Math.sin(turn + 1)], r: [rand(), rand() * 3, 0] });
      fb.add(mats.ruin, paintHull(geo, [], paint, tintOf()), { uv: 0.42 });
    }
    const ft = [];
    for (let k = 0; k < 4; k++) {
      const a = turn + (k / 4) * TAU + rand() * 0.6;
      ft.push({ x: Math.cos(a) * 0.75 * size, y: 0, z: Math.sin(a) * 0.6 * size, h: 0.4, n: 8, s: 0.15, dry: 0.35 });
    }
    fb.add(mats.grass, grassGeo(ft, 50 + i));
    fb.build(fg);
    return fg;
  });
  return { group: g, glow, fallen: tumbled };
}

// ── crags and boulders ──

// A jagged rock about a metre across, for instancing: an icosahedron pushed
// about by noise, then split along a few planes so it has the flat broken
// faces of real stone, a little flattened, grey with lichen and moss.
// Stands about y = -0.45 … 0.65: sink it to taste.
function rockGeo(seed) {
  const r = rng(seed);
  const n = makeNoise(seed);
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  // the planes it broke along
  const planes = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.6 - 0.6);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.62 + r() * 0.22 });
  }
  const sx = 1 + r() * 0.3;
  const sz = 0.85 + r() * 0.25;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 4 }) - 0.5) * 0.7;
    v.multiplyScalar(k);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    v.set(v.x * sx, v.y * 0.66, v.z * sz);
    if (v.y < -0.45) v.y = -0.45 + (v.y + 0.45) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  boxUV(g, 0.8);
  const paint = stonePaint(seed + 50, { moss: 1.1, lichen: 1.2, damp: 0.6, ground: -0.3, base: C(0x7e7c75), vary: 0.18 });
  paintHull(g, [], paint);
  g.computeBoundingSphere();
  return g;
}

// Colour a smooth geometry by `paint`, vertex by vertex, from its normals.
function paintSmooth(geo, paint, tint = null) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _pv.fromBufferAttribute(p, i);
    _nv.fromBufferAttribute(nr, i);
    paint(_pv, _nv, false, _kc);
    if (tint) _kc.multiply(tint);
    col.set([_kc.r, _kc.g, _kc.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// ── the camp in the dell ──

// The hobbits' camp, the fire at its middle: a ring of stones round a bed of
// ash and glowing embers with charred logs fallen in; Sam's frying pan on a
// flat stone at the fire's edge, sausages, tomatoes and bacon in it; four
// bedrolls round about with their packs for pillows, his pots and the
// kettle, a bundle of kindling and a lantern.
function camp(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'camp';
  const bk = parts();
  const rand = rng(23);
  const rockPaint = stonePaint(41, { moss: 0.5, damp: 0.2, base: C(0x7c7a72) });
  const sooty = stonePaint(41, { moss: 0, lichen: 0.2, damp: 0, base: C(0x3a3632) });

  // scorched earth, fading out into the grass, and the ash in the pit
  const ne = makeNoise(4);
  const scorch = new THREE.CircleGeometry(1.35, 32, 0, TAU);
  scorch.rotateX(-Math.PI / 2).translate(0, 0.012, 0);
  {
    const p = scorch.attributes.position;
    const col = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const d = Math.hypot(x, z) / 1.35 + (ne(x * 4, z * 4) - 0.5) * 0.25;
      const c = _kc.setRGB(0.025, 0.022, 0.018).lerp(_pc.setRGB(0.07, 0.065, 0.06), 1 - smooth(0.2, 0.42, d));
      col.set([c.r, c.g, c.b, 1 - smooth(0.55, 0.98, d)], i * 4);
    }
    scorch.setAttribute('color', new THREE.BufferAttribute(col, 4));
  }
  const scorchMesh = new THREE.Mesh(scorch, mats.scorch);
  scorchMesh.receiveShadow = true;
  g.add(scorchMesh);
  bk.add(mats.earth, blob(0.5, { detail: 2, amp: 0.15, freq: 3, seed: 6 }), { p: [0, 0.0, 0], s: [1, 0.1, 1], color: (x, y, z, out) => out.setRGB(0.1, 0.095, 0.09).lerp(_kc.setRGB(0.03, 0.025, 0.02), clamp01(ne(x * 9, z * 9) * 1.4 - 0.3)) });
  // the bed of the fire, still red under the ash
  bk.add(mats.ember, blob(0.34, { detail: 2, amp: 0.25, freq: 4, seed: 8 }), { p: [0, 0.02, 0], s: [1, 0.14, 1], color: (x, y, z, out) => out.setRGB(0.5, 0.42, 0.36).multiplyScalar(clamp01(1 - Math.hypot(x, z) / 0.36) * (0.4 + ne(x * 12, z * 12) * 0.8)) });
  // the stones of the ring, sooted on the inside
  const ring = 12;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * TAU + rand() * 0.15;
    const rr = 0.62 + rand() * 0.06;
    const geo = blob(0.15 + rand() * 0.05, { detail: 1, amp: 0.28, freq: 2.2, seed: 70 + i });
    tf(geo, { p: [Math.cos(a) * rr, 0.06, Math.sin(a) * rr], s: [1.25, 0.72, 1], r: [rand() * 0.3, -a, rand() * 0.3] });
    const inner = paintSmooth(geo, rockPaint);
    const c = inner.attributes.color;
    const p = inner.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const d = Math.hypot(p.getX(k), p.getZ(k));
      const soot = 1 - smooth(0.55, 0.72, d);
      c.setXYZ(k, mix(c.getX(k), 0.03, soot * 0.85), mix(c.getY(k), 0.028, soot * 0.85), mix(c.getZ(k), 0.026, soot * 0.85));
    }
    bk.add(mats.rock, inner, { uv: 1.2 });
  }
  // charred logs fallen in towards the middle, their ends still alight
  const charCol = (x, y, z, out) => {
    const d = Math.hypot(x, z);
    out.setRGB(0.012, 0.011, 0.01).lerp(_kc.setRGB(0.1, 0.07, 0.045), smooth(0.55, 0.9, d + (ne(x * 7, z * 7 + y * 9) - 0.5) * 0.3));
  };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3 + rand() * 0.5;
    const r0 = 0.62 + rand() * 0.28;
    const rad = 0.045 + rand() * 0.025;
    // fallen in: the outer end on the ground or the ring, the inner end
    // across the middle and over the others
    const across = (rand() - 0.5) * 0.5;
    const inner = [Math.cos(a + Math.PI + across) * 0.12, 0.1 + (i % 3) * 0.05, Math.sin(a + Math.PI + across) * 0.12];
    const outer = [Math.cos(a) * r0, rad + (r0 > 0.7 ? 0.08 : 0.02), Math.sin(a) * r0];
    const mid = [(inner[0] + outer[0]) / 2, (inner[1] + outer[1]) / 2 + 0.02, (inner[2] + outer[2]) / 2];
    bk.add(mats.char, tube([outer, mid, inner], rad, rad * 0.7, { seg: 5, radial: 7, gnarl: 0.25, seed: 5 + i }), { color: charCol });
    bk.add(mats.char, new THREE.CircleGeometry(rad, 7), { p: outer, r: [0, -a + Math.PI / 2, 0], color: 0x2a2018 });
    bk.add(mats.ember, ball(rad * 0.75, 7, 5), { p: inner, color: 0xffffff });
    // a glowing seam along its underside
    bk.add(mats.ember, tube([mid, inner], rad * 0.4, rad * 0.35, { seg: 2, radial: 4 }), { p: [0, -rad * 0.55, 0], color: 0x9a8070 });
  }
  // the embers: a heap of coals, the brightest deep in it
  for (let i = 0; i < 42; i++) {
    const d = Math.sqrt(rand()) * 0.42;
    const a = rand() * TAU;
    const geo = chunkGeo(200 + i, 0.045 + rand() * 0.045, 0.7);
    const k = 1 - d / 0.45;
    const hue = rand();
    tf(geo, { p: [Math.cos(a) * d, 0.03 + k * 0.05, Math.sin(a) * d], r: [rand() * 3, rand() * 3, 0] });
    bk.add(mats.ember, geo, { color: _kc.setRGB(1, 0.75 + hue * 0.25, 0.6 + hue * 0.4).multiplyScalar(0.25 + k * 0.85 * (0.5 + rand() * 0.5)).clone() });
  }

  // the pan, on a flat stone at the fire's edge, its handle out to the dell
  const panAt = V3(0.5, 0, 0.3);
  const slab = hexBlock(placeCorners(boxCorners(0.42, 0.12, 0.36), { p: [panAt.x + 0.08, 0.06, panAt.z + 0.05], r: [0, 0.6, 0] }), { seed: 9, chamfer: 0.03, chip: 0.5, paint: sooty });
  bk.add(mats.rock, slab, { uv: 1.2 });
  bk.build(g);
  const pan = new THREE.Group();
  pan.name = 'pan';
  pan.position.set(panAt.x, 0.125, panAt.z);
  pan.rotation.set(0.04, -Math.atan2(panAt.z, panAt.x), -0.05);
  g.add(pan);
  const pk = parts();
  pk.add(mats.iron, lathe([[0.001, 0], [0.15, 0], [0.165, 0.006], [0.182, 0.052], [0.174, 0.054], [0.158, 0.014], [0.001, 0.014]], 20));
  pk.add(mats.iron, roundBox(0.32, 0.018, 0.034, 0.008), { p: [0.33, 0.06, 0], r: [0, 0, 0.18] });
  pk.add(mats.iron, new THREE.TorusGeometry(0.018, 0.005, 4, 10), { p: [0.48, 0.087, 0], r: [Math.PI / 2, 0, 0] });
  // sausages, browned and split
  for (const [x, z, a] of [[-0.06, -0.07, 0.3], [0.0, -0.08, 0.1], [0.06, -0.05, -0.2]]) {
    const sg = new THREE.CapsuleGeometry(0.021, 0.085, 3, 8);
    pk.add(mats.food, sg, { p: [x, 0.036, z], r: [0, a, Math.PI / 2], color: (px, py, pz, out) => out.setRGB(0.3, 0.1, 0.04).lerp(_kc.setRGB(0.14, 0.05, 0.02), py > 0.045 ? 0.6 : 0) });
  }
  // tomatoes, halved and face down
  for (const [x, z] of [[-0.07, 0.06], [0.02, 0.09]]) {
    pk.add(mats.food, new THREE.SphereGeometry(0.036, 10, 5, 0, TAU, 0, Math.PI / 2), { p: [x, 0.014, z], s: [1, 0.85, 1], color: (px, py, pz, out) => out.setRGB(0.62, 0.05, 0.02).lerp(_kc.setRGB(0.3, 0.02, 0.01), py > 0.04 ? 0.3 : 0) });
  }
  // and the bacon, crisp and curling
  for (const [x, z, a] of [[0.08, 0.04, 0.6], [0.04, 0.0, -0.3]]) {
    const bacon = new THREE.PlaneGeometry(0.15, 0.04, 8, 2);
    const bp = bacon.attributes.position;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getX(i) * 60) * 0.006 + Math.abs(bp.getY(i)) * 0.05);
    bacon.computeVertexNormals();
    pk.add(mats.food, bacon, { r: [-Math.PI / 2, 0, a], p: [x, 0.022, z], color: (px, py, pz, out) => out.setRGB(0.45, 0.12, 0.08).lerp(_kc.setRGB(0.75, 0.56, 0.4), smooth(0.004, 0.012, Math.abs(Math.sin((px - x) * 40 + (pz - z) * 70)) * 0.012)) });
  }
  pk.build(pan);

  // the bedrolls: a blanket thrown back over a roll, and a pack for a pillow
  const ck = parts();
  const BEDS = [[0.35, 2.2, 0x5a6a3a], [1.95, 2.3, 0x7e3426], [3.35, 2.1, 0x3a4866], [4.75, 2.25, 0x8a6a34]];
  BEDS.forEach(([a, rr, hue], bi) => {
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    const ry = -a; // its length (local x) out from the fire
    ck.at([x, 0, z], ry, () => {
      const nb = makeNoise(60 + bi);
      const base = C(hue);
      const sheet = (w, l, lift, seed, dark = 1) => {
        const geo = new THREE.PlaneGeometry(l, w, 12, 6);
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const u = p.getX(i) / l + 0.5;
          const v = p.getY(i) / (w / 2);
          const body = Math.max(0, 1 - Math.abs(v) * 1.15) * 0.12 * (u > 0.1 && u < 0.85 ? 1 : 0.5);
          const fold = (nb(u * 6 + seed, v * 3) - 0.5) * 0.07;
          const sag = Math.abs(v) > 0.82 ? -(Math.abs(v) - 0.82) * 0.5 : 0;
          p.setZ(i, lift + body + fold + sag);
        }
        geo.computeVertexNormals();
        ck.add(mats.blanket, geo, {
          r: [-Math.PI / 2, 0, 0],
          color: (px, py, pz, out) => {
            const u = px / l + 0.5;
            const stripe = (u > 0.06 && u < 0.1) || (u > 0.9 && u < 0.94) ? 1 : 0;
            out.copy(base).multiplyScalar(dark * (0.85 + nb(px * 5, pz * 5) * 0.3)).lerp(_kc.setRGB(0.6, 0.55, 0.42), stripe * 0.6);
          },
        });
      };
      sheet(0.78, 1.45, 0.03, 0, 0.8);
      ck.at([-0.18, 0, 0], 0, () => sheet(0.74, 1.0, 0.07, 3));
      // the blanket rolled at the foot, towards the fire
      ck.add(mats.blanket, cylZ(0.085, 0.76, 10), { p: [-0.72, 0.09, 0], color: base.clone().multiplyScalar(0.9) });
      // the pack at the head: canvas, a flap, straps, a tin cup
      ck.add(mats.sack, blob(0.22, { detail: 2, amp: 0.12, freq: 2.5, seed: 30 + bi }), { p: [0.7, 0.15, 0.02], s: [0.75, 0.68, 1.0], r: [0, 0.1, 0.35], uv: 2 });
      ck.add(mats.sack, blob(0.16, { detail: 1, amp: 0.1, freq: 3, seed: 40 + bi }), { p: [0.62, 0.27, 0.02], s: [0.7, 0.3, 1.25], r: [0, 0.1, 0.6], uv: 2 });
      for (const s of [-1, 1]) ck.add(mats.rope, tube([[0.5, 0.1, s * 0.12], [0.6, 0.33, s * 0.12], [0.84, 0.25, s * 0.12]], 0.012, 0.012, { seg: 4, radial: 4 }));
      ck.add(mats.blanket, cylZ(0.065, 0.42, 9), { p: [0.82, 0.3, 0.02], color: base.clone().lerp(C(0x8a7a5a), 0.5) });
      ck.add(mats.pewter, lathe([[0.001, 0], [0.035, 0], [0.04, 0.07], [0.036, 0.07], [0.031, 0.006], [0.001, 0.006]], 10), { p: [0.84, 0.04, -0.2] });
    });
  });
  // Sam's pots and the kettle, by the fire
  const potAt = [-0.95, 0, 0.55];
  ck.at(potAt, 0.3, () => {
    ck.add(mats.iron, lathe([[0.001, 0], [0.12, 0.005], [0.135, 0.06], [0.13, 0.16], [0.14, 0.17], [0.125, 0.17], [0.118, 0.02], [0.001, 0.02]], 16));
    ck.add(mats.iron, lathe([[0.001, 0.19], [0.06, 0.185], [0.135, 0.165], [0.137, 0.158]], 16));
    ck.add(mats.iron, new THREE.TorusGeometry(0.135, 0.006, 4, 16, Math.PI), { p: [0, 0.17, 0], r: [0, 0, 0.5] });
    ck.add(mats.iron, lathe([[0.001, 0], [0.085, 0.005], [0.095, 0.09], [0.1, 0.1], [0.088, 0.1], [0.082, 0.015], [0.001, 0.015]], 14), { p: [0.27, 0, 0.12] });
    ck.add(mats.iron, roundBox(0.18, 0.012, 0.028, 0.005), { p: [0.44, 0.09, 0.15], r: [0, -0.3, 0.1] });
    // the kettle
    ck.at([-0.1, 0, 0.3], -0.6, () => {
      ck.add(mats.copper, lathe([[0.001, 0], [0.1, 0.004], [0.115, 0.04], [0.112, 0.1], [0.085, 0.145], [0.045, 0.16], [0.042, 0.172], [0.001, 0.175]], 18));
      ck.add(mats.copper, tube([[0.1, 0.05, 0], [0.17, 0.1, 0], [0.2, 0.16, 0]], 0.022, 0.011, { seg: 5, radial: 7 }));
      ck.add(mats.iron, new THREE.TorusGeometry(0.075, 0.008, 5, 14, Math.PI), { p: [0, 0.17, 0], r: [0, 0, 0] });
      ck.add(mats.iron, ball(0.014, 6, 5), { p: [0, 0.18, 0] });
    });
  });
  // a bundle of kindling, tied
  ck.at([-1.25, 0, -0.75], 0.9, () => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const rr = 0.04 + (i % 3) * 0.025;
      ck.add(mats.trunk, cylX(0.011 + rand() * 0.008, 0.62 + rand() * 0.16, 5), { p: [(rand() - 0.5) * 0.08, 0.07 + Math.sin(a) * rr * 0.8, Math.cos(a) * rr], r: [0, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.1], uv: 3 });
    }
    for (const x of [-0.16, 0.16]) ck.add(mats.rope, new THREE.TorusGeometry(0.095, 0.009, 4, 12), { p: [x, 0.075, 0], r: [0, Math.PI / 2, 0], s: [1, 0.8, 1] });
  });
  // a log to sit on
  ck.add(mats.trunk, tube([[-1.55, 0.16, 0.9], [-1.5, 0.18, 1.55], [-1.38, 0.16, 2.2]], 0.17, 0.14, { seg: 4, radial: 9, gnarl: 0.12, seed: 3, uvK: 1.4 }));
  ck.add(mats.wood, new THREE.CircleGeometry(0.16, 9), { p: [-1.55, 0.16, 0.86], r: [0, Math.PI - 0.1, 0] });
  // the lantern, on the ground by a pack
  const lantern = V3(1.45, 0.17, -1.35);
  lanternParts(ck, K, lantern.x, lantern.y, lantern.z, 1, 0);
  ck.add(mats.iron, new THREE.TorusGeometry(0.06, 0.006, 4, 10, Math.PI), { p: [lantern.x, lantern.y + 0.17, lantern.z] });
  ck.build(g);
  return { group: g, fireAt: V3(0, 0.12, 0), pan, lantern };
}

// ── the stone trolls ──

// Bert, Tom and William, turned to stone where the dawn found them
// quarrelling: great pot-bellied hulks, hunched, long in the arm and short
// in the leg, with big noses and bigger ears. One crouches reaching for the
// others, one stands with a hand to his head, one is bent nearly double.
// Grey stone gone green with moss on every upward surface, lichen in
// patches, and a bird has nested on Tom's head.
const TROLLS = [
  // where each stands, and the spot he faces; how far he leans and squats;
  // then, in his leaning body's own frame (x forward, y up from the hips),
  // his head and its tilt, and each arm's elbow and wrist (left, -z, first)
  {
    at: [-3.5, 0, 1.5], toward: [1.0, -0.4], lean: -0.4, hip: 1.0, knee: 1.0, spread: 1.0,
    head: [0.95, 2.05, 0.05], tilt: [0.1, 0.3, 0.3],
    arms: [[[0.35, 1.2, -1.55], [0.9, 0.5, -1.4]], [[1.0, 2.0, 1.45], [2.05, 2.25, 1.0]]],
    hands: [0, 1],
  },
  {
    at: [3.4, 0, 1.3], toward: [-1.5, 0.6], lean: -0.15, hip: 1.5, knee: 0.3, spread: 0.65,
    head: [0.85, 2.15, 0], tilt: [-0.25, -0.3, 0.05],
    arms: [[[0.15, 1.15, -1.55], [0.4, 0.38, -1.45]], [[0.15, 2.95, 1.75], [0.62, 3.05, 0.65]]],
    hands: [0, 2], nest: true,
  },
  {
    at: [0.0, 0, -3.6], toward: [0.2, 0.6], lean: -0.95, hip: 1.3, knee: 0.7, spread: 0.85,
    head: [0.95, 2.05, -0.05], tilt: [0.1, 0.15, 0.7],
    arms: [[[0.85, 1.6, -1.4], [1.55, 0.95, -1.1]], [[0.9, 1.55, 1.4], [1.75, 1.1, 1.15]]],
    hands: [0, 0],
  },
];
const _dark = new THREE.Color(0.32, 0.3, 0.28);
function trolls(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stoneTrolls';
  const bk = parts();
  const paint = stonePaint(77, { moss: 1.4, lichen: 1.1, damp: 1, base: C(0x8a877e), vary: 0.16 });
  const M4 = (p = [0, 0, 0], r = [0, 0, 0]) => new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V3(1, 1, 1));
  let nestAt = null;
  TROLLS.forEach((T, ti) => {
    let seed = 500 + ti * 50;
    // turned to face the spot he was quarrelling over
    const turn = Math.atan2(-(T.toward[1] - T.at[2]), T.toward[0] - T.at[0]);
    // a part: placed in its frame, then the frame in the troll, then painted
    // (so moss lands on what faces up as he stands)
    const add = (geo, o = {}, frame = null, tint = null) => {
      tf(geo, o);
      if (frame) geo.applyMatrix4(frame);
      bk.add(mats.troll, paintSmooth(geo, paint, tint), { uv: 0.55 });
    };
    const lump = (rad, o, frame, detail = 2, amp = 0.15) => add(blob(rad, { detail, amp, freq: 1.5, seed: seed++ }), o, frame);
    const limb = (pts, r0, r1, frame, seg = 6) => add(tube(pts, r0, r1, { seg, radial: r0 > 0.2 ? 9 : 6, gnarl: 0.16, seed: seed++ }), {}, frame);
    const torso = M4([0, T.hip, 0], [0, 0, T.lean]);
    const headM = torso.clone().multiply(M4(T.head, T.tilt));
    bk.at(T.at, turn, () => {
      // a pot belly and a barrel chest in one great mass, the shoulders
      // hunched up over it
      lump(1.0, { p: [0.3, 0.78, 0], s: [1.02, 0.95, 1.05] }, torso, 3, 0.09);
      lump(0.95, { p: [0.0, 1.62, 0], s: [0.85, 0.88, 1.18] }, torso, 2, 0.1);
      lump(0.82, { p: [-0.22, 2.22, 0], s: [0.82, 0.55, 1.55] }, torso, 2, 0.12);
      // the legs: thick thighs to bent knees, short shins, flat great feet
      for (const s of [-1, 1]) {
        const kx = 0.5 + T.knee * 0.4;
        const ky = Math.max(0.6, T.hip - 0.4 - T.knee * 0.18);
        const kz = s * (0.6 + T.spread * 0.32);
        limb([[0, T.hip + 0.1, s * 0.55], [kx * 0.55, (T.hip + ky) / 2 + 0.08, (s * 0.55 + kz) / 2], [kx, ky, kz]], 0.5, 0.38);
        limb([[kx, ky, kz], [kx - 0.1, ky * 0.5, kz * 1.03], [kx - 0.04, 0.22, kz * 1.05]], 0.36, 0.28, null, 4);
        lump(0.4, { p: [kx + 0.04, ky + 0.02, kz] }, null, 1, 0.12);
        lump(0.5, { p: [0.05, T.hip + 0.1, s * 0.58], s: [1.1, 1, 1] }, null, 1, 0.1);
        lump(0.5, { p: [kx + 0.28, 0.17, kz * 1.08], s: [1.08, 0.38, 0.65], r: [0, s * 0.15, 0] }, null, 2, 0.12);
        for (let t = 0; t < 3; t++) lump(0.14, { p: [kx + 0.74, 0.11, kz * 1.08 + (t - 1) * 0.17], s: [1.3, 0.75, 1] }, null, 0, 0.12);
      }
      // the arms, long, to big clumsy hands
      T.arms.forEach(([el, wr], ai) => {
        const sh = [0.0, 2.15, ai ? 1.15 : -1.15];
        lump(0.44, { p: sh }, torso, 2, 0.14);
        limb([sh, [(sh[0] + el[0]) / 2, (sh[1] + el[1]) / 2, (sh[2] + el[2]) / 2], el], 0.38, 0.31, torso, 5);
        limb([el, [(el[0] + wr[0]) / 2, (el[1] + wr[1]) / 2, (el[2] + wr[2]) / 2], wr], 0.35, 0.25, torso, 5);
        lump(0.34, { p: el }, torso, 1, 0.12);
        // a fist (0), reaching open (1), or clutching the head (2)
        const kind = T.hands[ai];
        const dir = V3(wr[0] - el[0], wr[1] - el[1], wr[2] - el[2]).normalize();
        const palm = V3(...wr).addScaledVector(dir, 0.22);
        lump(0.28, { p: palm.toArray(), s: [1, 0.72, 1.05] }, torso, 1, 0.14);
        const side = V3(0, 0, ai ? 1 : -1).cross(dir).normalize();
        const across = dir.clone().cross(side).normalize();
        for (let f = 0; f < 4; f++) {
          const base = palm.clone().addScaledVector(dir, 0.16).addScaledVector(across, (f - 1.5) * 0.13);
          const reach = kind === 1 ? 0.45 : 0.3;
          const curl = kind === 1 ? 0.1 : kind === 2 ? 0.22 : 0.34;
          const mid = base.clone().addScaledVector(dir, reach * 0.6).addScaledVector(side, -curl * 0.5);
          const tip = base.clone().addScaledVector(dir, reach * (kind === 0 ? 0.5 : 0.9)).addScaledVector(side, -curl);
          limb([base.toArray(), mid.toArray(), tip.toArray()], 0.09, 0.065, torso, 3);
        }
        const tb = palm.clone().addScaledVector(across, 0.24 * (ai ? -1 : 1));
        limb([tb.toArray(), tb.clone().addScaledVector(dir, 0.24).addScaledVector(side, -0.12).toArray()], 0.095, 0.07, torso, 2);
      });
      // the head, slung low and forward: a skull, heavy jowls, a beetling
      // brow, a great nose, an underbite with two tusks, ears like jug
      // handles, little eyes
      const H = 1.25;
      const hp = (x, y, z) => [x * H, y * H, z * H];
      lump(0.55 * H, { p: hp(-0.12, 0.08, 0), s: [1.0, 0.85, 0.95] }, headM, 2, 0.1);
      lump(0.5 * H, { p: hp(0.06, -0.28, 0), s: [1.0, 0.72, 1.12] }, headM, 2, 0.1);
      lump(0.24 * H, { p: hp(0.38, 0.15, 0), s: [0.8, 0.5, 2.2] }, headM, 2, 0.12);
      lump(0.34 * H, { p: hp(0.7, -0.14, 0), s: [1.2, 1.35, 0.95], r: [0, 0, -0.45] }, headM, 2, 0.12);
      lump(0.27 * H, { p: hp(0.42, -0.52, 0), s: [1.0, 0.6, 1.35] }, headM, 2, 0.1);
      add(ball(0.2 * H, 10, 6), { p: hp(0.47, -0.38, 0), s: [0.7, 0.16, 1.6] }, headM, _dark);
      add(ball(0.17 * H, 10, 6), { p: hp(0.36, 0.06, 0), s: [0.6, 0.35, 1.9] }, headM, _dark);
      for (const s of [-1, 1]) {
        lump(0.32 * H, { p: hp(-0.06, 0.06, s * 0.6), s: [0.62, 1.1, 0.36], r: [s * 0.45, 0, 0.25] }, headM, 2, 0.14);
        add(ball(0.075 * H, 7, 5), { p: hp(0.5, 0.03, s * 0.2) }, headM, _dark);
        add(new THREE.ConeGeometry(0.07 * H, 0.24 * H, 6), { p: hp(0.56, -0.38, s * 0.18), r: [0, 0, -0.25] }, headM);
      }
      if (T.nest) nestAt = { top: V3(-0.15 * 1.25, 0.52 * 1.25, 0).applyMatrix4(headM), T, turn };
    });
  });
  bk.build(g);
  // a bird's nest of twigs on Tom's head, three eggs in it
  if (nestAt) {
    const { top, T, turn } = nestAt;
    const nest = new THREE.Group();
    nest.name = 'nest';
    nest.position.set(T.at[0], 0, T.at[2]);
    nest.rotation.y = turn;
    g.add(nest);
    const nk = parts();
    const nr = rng(5);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const rr = 0.2 + nr() * 0.06;
      const pts = [];
      for (let k = 0; k < 3; k++) {
        const b = a + k * 0.5;
        pts.push([top.x + Math.cos(b) * rr, top.y + 0.02 + nr() * 0.08 + k * 0.02, top.z + Math.sin(b) * rr]);
      }
      nk.add(mats.trunk, tube(pts, 0.012, 0.008, { seg: 3, radial: 3 }), { uv: 3 });
    }
    nk.add(mats.trunk, blob(0.19, { detail: 1, amp: 0.3, freq: 4, seed: 3 }), { p: [top.x, top.y, top.z], s: [1.2, 0.4, 1.2], uv: 4 });
    for (let i = 0; i < 3; i++) nk.add(mats.food, ball(0.035, 8, 6), { p: [top.x + Math.cos(i * 2.1) * 0.06, top.y + 0.08, top.z + Math.sin(i * 2.1) * 0.06], s: [1, 1.3, 1], color: 0xc8dcd6 });
    nk.build(nest);
  }
  return { group: g };
}

// ── plants ──

// A long leaf, serrated, from its stalk at the origin out along +x: bowed up
// and over, folded a little along its midrib. `teeth` along each edge.
function leafGeo({ len = 0.28, wid = 0.045, teeth = 7, rise = 0.5, droop = 0.6, fold = 0.25, twist = 0, colours, seed = 1 }) {
  const n = makeNoise(seed);
  const steps = teeth * 2 + 2;
  const pos = [];
  const col = [];
  const idx = [];
  const [dark, light, rib] = colours;
  const k = new THREE.Color();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // the outline: narrow at the stalk, widest past the middle, to a point
    let w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8) * (t < 0.12 ? t / 0.12 * 0.5 + 0.2 : 1);
    if (i > 2 && i < steps) w *= i % 2 ? 1 : 0.72;
    const x = t * len;
    const y = Math.sin(t * Math.PI * 0.85) * rise * len * 0.6 - t * t * droop * len * 0.5;
    const tw = twist * t;
    for (const s of [-1, 0, 1]) {
      const along = s === 0 ? 0 : (i % 2 ? 0.012 : 0) * len;
      const yy = y - Math.abs(s) * w * fold + s * w * Math.sin(tw);
      pos.push(x + along, yy + (n(t * 5, s) - 0.5) * 0.008, s * w * Math.cos(tw));
      k.copy(dark).lerp(light, clamp01(t * 0.8 + (n(t * 7 + s, 2) - 0.5) * 0.4));
      if (s === 0) k.lerp(rib, 0.55);
      col.push(k.r, k.g, k.b);
    }
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 3;
    const b = a + 3;
    idx.push(a, a + 1, b + 1, a, b + 1, b, a + 1, a + 2, b + 2, a + 1, b + 2, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A rosette of leaves and a few stalks of small flowers, into bk: athelas,
// or (with other leaves) the weeds it grows among.
function rosette(bk, { leaf, flower, stalk }, o) {
  const r = rng(o.seed);
  const n = o.leaves;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996 + r() * 0.3;
    const inner = i > n * 0.6;
    const geo = leafGeo({
      len: o.len * (inner ? 0.7 : 1) * (0.85 + r() * 0.3),
      wid: o.wid * (0.85 + r() * 0.3),
      teeth: o.teeth,
      rise: (inner ? 0.9 : 0.45) + r() * 0.3,
      droop: (inner ? 0.4 : 0.8) + r() * 0.3,
      fold: 0.3,
      twist: (r() - 0.5) * 0.8,
      colours: o.colours,
      seed: o.seed * 13 + i,
    });
    bk.add(leaf, geo, { r: [0, -a, 0], p: [0, 0.01, 0] });
  }
  bk.add(leaf, ball(0.025, 6, 4), { p: [0, 0.02, 0], color: o.colours[0] });
  for (let i = 0; i < o.stalks; i++) {
    const a = r() * TAU;
    const h = o.tall * (0.75 + r() * 0.3);
    const lean = 0.03 + r() * 0.06;
    const top = [Math.cos(a) * lean, h, Math.sin(a) * lean];
    bk.add(stalk, tube([[0, 0.02, 0], [top[0] * 0.4, h * 0.5, top[2] * 0.4], top], 0.0045, 0.003, { seg: 4, radial: 3 }), { color: o.colours[2] });
    // an umbel of tiny five-petalled flowers
    for (let f = 0; f < o.florets; f++) {
      const b = (f / o.florets) * TAU + r();
      const rr = 0.012 + r() * 0.022;
      const p = [top[0] + Math.cos(b) * rr, top[1] + 0.008 + r() * 0.012, top[2] + Math.sin(b) * rr];
      bk.add(flower, new THREE.CircleGeometry(0.0085, 5), { p, r: [-Math.PI / 2 + (r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8], color: o.bloom });
      bk.add(flower, ball(0.0035, 4, 3), { p: [p[0], p[1] + 0.003, p[2]], color: o.eye });
    }
  }
}

const ATHELAS = { leaves: 12, len: 0.3, wid: 0.04, teeth: 8, stalks: 4, tall: 0.38, florets: 9, colours: [C(0x2c4a22), C(0x6a9050), C(0xa8c890)], bloom: 0xf4f8f0, eye: 0xe8e8a0 };

// Athelas, kingsfoil: a low weed, its long toothed leaves in a rosette and
// small white flowers on thin stalks. glow(k) lights it from within, pale
// green-white, enough for the bloom to find.
function athelas(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'athelas';
  const leaf = mats.leaf.clone();
  const flower = mats.petal.clone();
  const bk = parts();
  rosette(bk, { leaf, flower, stalk: leaf }, { ...ATHELAS, seed: 7 });
  bk.build(g, { shadow: false });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.tex.halo, color: hot(0xb8ffcc, 1), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.y = 0.16;
  halo.scale.set(1.1, 0.7, 1);
  g.add(halo);
  const glow = (k) => {
    const t = clamp01(k);
    leaf.emissive.setRGB(0.32, 0.62, 0.42).multiplyScalar(t * 0.55);
    flower.emissive.setRGB(0.85, 1, 0.9).multiplyScalar(t * 2.4);
    halo.material.opacity = t * 0.3;
    halo.visible = t > 0.01;
  };
  glow(0);
  return { group: g, glow };
}

// A weed like it (dock, plantain, ribwort), that doesn't glow.
function weed(K, seed = 1) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'weed';
  const r = rng(seed * 31);
  const bk = parts();
  const kinds = [
    { leaves: 9, len: 0.32, wid: 0.06, teeth: 2, stalks: 3, tall: 0.42, florets: 6, colours: [C(0x30482a), C(0x6a8448), C(0x9ab070)], bloom: 0xe8e2c0, eye: 0xc8b860 },
    { leaves: 14, len: 0.26, wid: 0.03, teeth: 5, stalks: 2, tall: 0.36, florets: 8, colours: [C(0x2a4626), C(0x5e8a48), C(0xa0c084)], bloom: 0xf0f2ea, eye: 0xd8d8a0 },
    { leaves: 8, len: 0.34, wid: 0.075, teeth: 3, stalks: 4, tall: 0.4, florets: 5, colours: [C(0x34482a), C(0x7a8a4a), C(0x98a870)], bloom: 0xe8d890, eye: 0xd8b040 },
  ];
  const o = kinds[seed % kinds.length];
  rosette(bk, { leaf: mats.leaf, flower: mats.petal, stalk: mats.leaf }, { ...o, len: o.len * (0.85 + r() * 0.3), seed: seed + 3 });
  bk.build(g, { shadow: false });
  return { group: g };
}

// ── trees ──

// A dead tree on the heath, gnarled and grey: a twisted trunk on spreading
// roots, a few crooked limbs and their branches bare to the twigs, one limb
// snapped off short, the top broken.
function deadTree(K, seed = 1) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'deadTree';
  const r = rng(seed * 7 + 3);
  const bk = parts();
  const H = 4.4 + r() * 1.6;
  // the trunk, twisting as it goes up
  const trunk = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunk.push(V3(x, t * H * 0.72, z));
    x += (r() - 0.5) * 0.5;
    z += (r() - 0.5) * 0.5;
  }
  const curve = new THREE.CatmullRomCurve3(trunk);
  bk.add(mats.deadwood, tube(trunk, 0.36, 0.15, { seg: 12, radial: 10, gnarl: 0.3, seed }));
  // roots: buttresses into the ground
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + r() * 0.6;
    const l = 0.7 + r() * 0.5;
    bk.add(mats.deadwood, tube([[0, 0.55, 0], [Math.cos(a) * l * 0.45, 0.2, Math.sin(a) * l * 0.45], [Math.cos(a) * l, -0.05, Math.sin(a) * l]], 0.16, 0.05, { seg: 4, radial: 6, gnarl: 0.2, seed: seed + i }));
  }
  // the limbs, and their branches, and twigs on those
  const branch = (from, dir, len, r0, depth) => {
    const pts = [from.clone()];
    const d = dir.clone();
    let p = from.clone();
    const n = depth === 0 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      d.x += (r() - 0.5) * 0.7;
      d.z += (r() - 0.5) * 0.7;
      d.y += (r() - 0.5) * 0.5;
      d.normalize();
      p = p.clone().addScaledVector(d, len / n);
      pts.push(p);
    }
    const r1 = Math.max(0.01, r0 * 0.3);
    bk.add(mats.deadwood, tube(pts, r0, r1, { seg: depth === 0 ? 7 : depth === 1 ? 5 : 3, radial: depth === 0 ? 7 : depth === 1 ? 5 : 3, gnarl: 0.2, seed: seed + depth * 9 + pts.length }));
    if (depth >= 2) return;
    const kids = depth === 0 ? 2 + Math.floor(r() * 2) : 2;
    for (let k = 0; k < kids; k++) {
      const t = 0.35 + r() * 0.55;
      const at = new THREE.CatmullRomCurve3(pts).getPointAt(t);
      const side = V3(r() - 0.5, 0.05 + r() * 0.5, r() - 0.5).normalize().add(d.clone().multiplyScalar(0.6)).normalize();
      branch(at, side, len * (0.45 + r() * 0.2), r0 * (0.5 - t * 0.2), depth + 1);
    }
  };
  const limbs = 4 + Math.floor(r() * 2);
  for (let i = 0; i < limbs; i++) {
    const t = 0.42 + (i / limbs) * 0.5;
    const from = curve.getPointAt(t);
    const a = (i / limbs) * TAU + r() * 0.8;
    const dir = V3(Math.cos(a), 0.15 + r() * 0.5, Math.sin(a)).normalize();
    if (i === 1) {
      // snapped off short, its end splintered
      const end = from.clone().addScaledVector(dir, 0.55);
      bk.add(mats.deadwood, tube([from, from.clone().addScaledVector(dir, 0.3), end], 0.1, 0.075, { seg: 3, radial: 6, gnarl: 0.3 }));
      bk.add(mats.wood, new THREE.ConeGeometry(0.075, 0.12, 6), { p: end.toArray(), r: [Math.atan2(Math.hypot(dir.x, dir.z), dir.y) * 0 + 0.3, 0, -0.5] });
      continue;
    }
    branch(from, dir, H * (0.4 + r() * 0.18), 0.13 - t * 0.04, 0);
  }
  // the top, broken off: a splintered snag
  const top = trunk[trunk.length - 1];
  bk.add(mats.deadwood, tube([top, top.clone().add(V3(0.1, H * 0.12, 0.05)), top.clone().add(V3(0.15, H * 0.2, -0.02))], 0.12, 0.08, { seg: 3, radial: 7, gnarl: 0.3 }));
  bk.add(mats.wood, new THREE.ConeGeometry(0.085, 0.3, 6, 1, true), { p: top.clone().add(V3(0.17, H * 0.2 + 0.12, -0.02)).toArray(), r: [0.1, 0, -0.15] });
  bk.build(g);
  return { group: g };
}

// One geometry, coloured in its vertices, from several: unindexed, keeping
// each part's own normals.
function oneGeo(list) {
  const out = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    return g;
  });
  const g = mergeGeometries(out, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}
// A pine for instancing, about 14 m: a tall grey-brown trunk in tiers of
// dark needles, each tier a skirt with a ragged hem of drooping tips over a
// darker underside, smaller and closer together towards the top.
function pineGeo(seed = 1) {
  const r = rng(seed * 11 + 5);
  const n = makeNoise(seed);
  const H = 14;
  const list = [];
  list.push(fillColor(new THREE.CylinderGeometry(0.08, 0.3, H, 7, 1).translate(0, H / 2, 0), (x, y, z, out) => out.setRGB(0.1, 0.075, 0.055).multiplyScalar(0.8 + n(y, x * 9) * 0.4)));
  const tiers = 9;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y0 = 2.6 + Math.pow(t, 0.9) * (H - 3.6);
    const rad = mix(2.7, 0.55, Math.pow(t, 0.85)) * (0.9 + r() * 0.2);
    const h = mix(2.6, 1.6, t);
    const m = 11;
    const pos = [];
    const col = [];
    const apex = [0, y0 + h, 0];
    const under = [0, y0 + h * 0.32, 0];
    const rim = [];
    for (let k = 0; k < m * 2; k++) {
      const a = (k / (m * 2)) * TAU + i * 0.7;
      const tip = k % 2 === 0;
      const rr = rad * (tip ? 1 : 0.72) * (0.88 + n(k * 0.7, i * 3) * 0.24);
      rim.push([Math.cos(a) * rr, y0 + (tip ? -0.25 - r() * 0.2 : 0.12), Math.sin(a) * rr, tip]);
    }
    const top = C(0x2e4a2c);
    const tipC = C(0x46663a);
    const inner = C(0x14241a);
    const below = C(0x0c160e);
    for (let k = 0; k < rim.length; k++) {
      const a = rim[k];
      const b = rim[(k + 1) % rim.length];
      for (const [v, c] of [[apex, inner], [b, b[3] ? tipC : top], [a, a[3] ? tipC : top]]) {
        pos.push(v[0], v[1], v[2]);
        col.push(c.r, c.g, c.b);
      }
      for (const [v, c] of [[under, below], [a, inner], [b, inner]]) {
        pos.push(v[0], v[1], v[2]);
        col.push(c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    // light from above: the needles' normals turned upward a little
    const nr = geo.attributes.normal;
    for (let k = 0; k < nr.count; k++) {
      _nv.fromBufferAttribute(nr, k);
      _nv.y += 0.35;
      _nv.normalize();
      nr.setXYZ(k, _nv.x, _nv.y, _nv.z);
    }
    list.push(geo);
  }
  return oneGeo(list);
}

// A birch for instancing, about 10 m: a slender pale trunk, a little bent,
// with dark marks and black at its foot, a few thin limbs, and light
// yellow-green crowns, airy and uneven.
function birchGeo(seed = 1) {
  const r = rng(seed * 13 + 1);
  const n = makeNoise(seed + 40);
  const list = [];
  const H = 8.2;
  const trunk = new THREE.CylinderGeometry(0.1, 0.17, H, 7, 16).translate(0, H / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.sin(y * 0.35) * 0.22);
  }
  trunk.computeVertexNormals();
  list.push(fillColor(trunk, (x, y, z, out) => {
    const mark = n(y * 3.2, Math.atan2(z, x) * 1.2) > 0.68 || n(y * 1.3 + 9, Math.atan2(z, x)) > 0.78;
    out.setRGB(0.6, 0.59, 0.55);
    if (mark) out.setRGB(0.05, 0.045, 0.04);
    if (y < 0.9) out.lerp(_kc.setRGB(0.07, 0.065, 0.06), 1 - y / 0.9);
  }));
  for (let i = 0; i < 5; i++) {
    const y = 4 + i * 0.8;
    const a = i * 2.3 + r();
    const l = 1.2 + r() * 0.8;
    const geo = new THREE.CylinderGeometry(0.02, 0.05, l, 4, 1).translate(0, l / 2, 0);
    geo.rotateZ(-0.7 - r() * 0.3).rotateY(a).translate(Math.sin(y * 0.35) * 0.22, y, 0);
    list.push(fillColor(geo, (x, yy, z, out) => out.setRGB(0.45, 0.42, 0.38)));
  }
  const leaf = [C(0x4e6426), C(0x7e9638), C(0xaebc5a)];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y = mix(4.8, 9.6, t) + (r() - 0.5) * 0.6;
    const a = i * 2.4 + r() * 0.8;
    const out = mix(1.3, 0.4, t) * (0.6 + r() * 0.5);
    const rad = mix(1.05, 0.7, t) * (0.8 + r() * 0.35);
    const x = Math.cos(a) * out + Math.sin(y * 0.35) * 0.22;
    const z = Math.sin(a) * out;
    const geo = blob(rad, { detail: 1, amp: 0.38, freq: 2.2, seed: seed * 5 + i });
    geo.scale(1, 0.8, 1).translate(x, y, z);
    list.push(fillColor(geo, (px, py, pz, o) => {
      const up = (py - y) / rad;
      const k = clamp01(0.45 + up * 0.35 + (n(px * 1.6 + 3, pz * 1.6 + py) - 0.5) * 0.7);
      o.copy(leaf[0]).lerp(leaf[1], smooth(0, 0.6, k)).lerp(leaf[2], smooth(0.65, 1, k));
    }));
  }
  return oneGeo(list);
}

// A pine fallen across the road, about 9 m: lying along z, its root plate
// torn up at -z standing on its edge, earth and roots, its branches broken
// to stubs, its top snapped. The trunk's top is about 0.9 up.
function fallenTree(K, seed = 1) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'fallenTree';
  const r = rng(seed * 17 + 2);
  const bk = parts();
  const L0 = -4.3;
  const L1 = 4.7;
  const ry = (z) => mix(0.5, 0.42, (z - L0) / (L1 - L0));
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const z = mix(L0, L1, i / 6);
    pts.push([(r() - 0.5) * 0.12, ry(z), z]);
  }
  bk.add(mats.pinebark, tube(pts, 0.42, 0.2, { seg: 14, radial: 11, gnarl: 0.12, seed }));
  // the snapped top: splinters
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    bk.add(mats.wood, new THREE.ConeGeometry(0.05, 0.35 + r() * 0.3, 4), { p: [Math.cos(a) * 0.1, ry(L1) + Math.sin(a) * 0.1, L1 + 0.15], r: [Math.PI / 2 + (r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4] });
  }
  // the root plate: a wall of earth on edge, roots out of it
  const ne = makeNoise(seed + 9);
  bk.add(mats.earth, blob(1, { detail: 3, amp: 0.3, freq: 2.2, seed: seed + 4 }), {
    p: [0, 0.7, L0 - 0.3],
    s: [1.45, 1.2, 0.26],
    color: (x, y, z, out) => out.setRGB(0.13, 0.09, 0.06).lerp(_kc.setRGB(0.05, 0.07, 0.03), y > 1.55 ? 0.8 : 0).multiplyScalar(0.55 + ne(x * 4, y * 4) * 0.8),
  });
  // stones caught in it
  for (let i = 0; i < 5; i++) {
    const a = r() * TAU;
    const rr = 0.3 + r() * 0.7;
    bk.add(mats.rock, blob(0.12 + r() * 0.08, { detail: 1, amp: 0.3, seed: 90 + i }), { p: [Math.cos(a) * rr, 0.7 + Math.sin(a) * rr * 0.8, L0 - 0.55], uv: 2, color: 0x6a6862 });
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + r() * 0.3;
    const rr = 0.55 + r() * 0.7;
    const o = [Math.cos(a) * 0.35, 0.75 + Math.sin(a) * 0.35, L0 - 0.35];
    const e = [Math.cos(a) * rr * 1.45, Math.max(-0.1, 0.75 + Math.sin(a) * rr * 1.25), L0 - 0.5 - r() * 0.5];
    bk.add(mats.deadwood, tube([o, [(o[0] + e[0]) / 2, (o[1] + e[1]) / 2 + 0.1, (o[2] + e[2]) / 2], e], 0.07, 0.015, { seg: 4, radial: 4, gnarl: 0.3, seed: i }));
  }
  // stubs of branches in whorls, a few longer ones with a twig or two left
  for (let w = 0; w < 7; w++) {
    const z = mix(L0 + 1.4, L1 - 0.4, w / 6);
    const rad = mix(0.4, 0.22, (z - L0) / (L1 - L0));
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * TAU + w * 0.9 + r() * 0.4;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      if (dy < -0.6) continue;
      const long = dy > -0.2 && r() < 0.3;
      const l = long ? 0.55 + r() * 0.45 : 0.18 + r() * 0.3;
      const o = [dx * rad * 0.8, ry(z) + dy * rad * 0.8, z];
      const e = [dx * (rad + l), Math.max(0.05, ry(z) + dy * (rad + l) * 0.7), z + l * 0.45];
      bk.add(mats.deadwood, tube([o, e], long ? 0.06 : 0.05, long ? 0.022 : 0.035, { seg: 2, radial: 5 }));
      if (long) {
        for (let tw = 0; tw < 2; tw++) {
          const te = [e[0] + dx * 0.25 + (r() - 0.5) * 0.3, e[1] + (r() - 0.3) * 0.25, e[2] + 0.12 + r() * 0.2];
          bk.add(mats.deadwood, tube([e, te], 0.018, 0.008, { seg: 1, radial: 3 }));
        }
      }
    }
  }
  bk.build(g);
  return { group: g };
}

// ── creatures' bodies ──

// A smooth body swept along a path in the x-y plane (a horse's barrel, its
// neck, its head): at each station a point on the path, the section's
// half-width (z) and its half-heights to either side of the path, square to
// it (`up` on the side the path's left hand is, `dn` the other); `wt` and
// `wb` narrow the section towards its top and bottom; `sq` squares it off.
// The ends are closed.
function loft(stations, { radial = 16, sq = 2.2 } = {}) {
  const pos = [];
  const uv = [];
  const idx = [];
  const N = stations.length;
  for (let i = 0; i < N; i++) {
    const s = stations[i];
    const a = stations[Math.max(0, i - 1)].p;
    const b = stations[Math.min(N - 1, i + 1)].p;
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    for (let k = 0; k < radial; k++) {
      const th = (k / radial) * TAU;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const ec = Math.sign(c) * Math.pow(Math.abs(c), 2 / sq);
      const es = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / sq);
      const h = es > 0 ? s.up : s.dn;
      const w = s.w * (es > 0 ? mix(1, s.wt ?? 1, es) : mix(1, s.wb ?? 1, -es));
      pos.push(s.p[0] - ty * es * h, s.p[1] + tx * es * h, ec * w);
      uv.push(i / (N - 1), k / radial);
    }
  }
  for (let i = 0; i < N - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const a = i * radial + k;
      const b = i * radial + ((k + 1) % radial);
      idx.push(a, a + radial, b, b, a + radial, b + radial);
    }
  }
  const c0 = pos.length / 3;
  pos.push(...stations[0].p, 0, ...stations[N - 1].p, 0);
  uv.push(0, 0, 1, 0);
  for (let k = 0; k < radial; k++) {
    const k1 = (k + 1) % radial;
    idx.push(c0, k, k1);
    idx.push(c0 + 1, (N - 1) * radial + k1, (N - 1) * radial + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Hair in ribbons (a mane, a tail, long hair): each strand from its root,
// hanging along `hang` when still and streaming along `stream` in the wind,
// rippling across `flutter`. Built in its parent's frame; flow(t, k) moves it,
// k from 0 (still) to 1 (a gallop's wind).
function strands(material, list, { segs = 6, colour = [C(0xffffff), C(0xffffff)], speed = 1 } = {}) {
  const n = list.length;
  const vpr = (segs + 1) * 2;
  const pos = new Float32Array(n * vpr * 3);
  const col = new Float32Array(n * vpr * 3);
  const nor = new Float32Array(n * vpr * 3);
  const idx = [];
  const c = new THREE.Color();
  list.forEach((s, i) => {
    for (let j = 0; j < segs; j++) {
      const a = i * vpr + j * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
    for (let j = 0; j <= segs; j++) {
      c.copy(colour[0]).lerp(colour[1], j / segs).multiplyScalar(s.shade ?? 1);
      for (const e of [0, 1]) {
        col.set([c.r, c.g, c.b], (i * vpr + j * 2 + e) * 3);
        nor.set([s.normal.x, s.normal.y, s.normal.z], (i * vpr + j * 2 + e) * 3);
      }
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const p = V3();
  const d = V3();
  const sv = V3();
  const flow = (t, k) => {
    list.forEach((s, i) => {
      p.copy(s.root);
      for (let j = 0; j <= segs; j++) {
        const u = j / segs;
        sv.copy(s.side).multiplyScalar((s.width * (1 - u * 0.75)) / 2);
        const o = (i * vpr + j * 2) * 3;
        pos[o] = p.x - sv.x;
        pos[o + 1] = p.y - sv.y;
        pos[o + 2] = p.z - sv.z;
        pos[o + 3] = p.x + sv.x;
        pos[o + 4] = p.y + sv.y;
        pos[o + 5] = p.z + sv.z;
        if (j === segs) break;
        d.copy(s.hang).lerp(s.stream, clamp01(k * (0.45 + 0.75 * u)));
        const wave = Math.sin(t * (2.2 + 9 * k) * speed - u * 5.5 + s.phase) + 0.4 * Math.sin(t * (3.1 + 13 * k) * speed - u * 9 + s.phase * 2.3);
        d.addScaledVector(s.flutter, wave * (0.05 + 0.32 * k) * (0.3 + u));
        d.normalize();
        p.addScaledVector(d, s.len / segs);
      }
    });
    geo.attributes.position.needsUpdate = true;
  };
  flow(0, 0);
  return { mesh, flow };
}

// ── Asfaloth, Arwen and Frodo ──

// The horse's barrel from tail to chest: x, the top line, the belly line,
// the half-width, and how the section narrows at its top and bottom.
const HORSE = [
  [-1.0, 1.52, 1.4, 0.05, 1, 1],
  [-0.96, 1.62, 1.24, 0.15, 0.85, 0.8],
  [-0.86, 1.68, 1.12, 0.22, 0.85, 0.8],
  [-0.7, 1.71, 1.08, 0.255, 0.9, 0.8],
  [-0.5, 1.7, 1.07, 0.265, 0.85, 0.75],
  [-0.3, 1.66, 1.03, 0.275, 0.8, 0.8],
  [-0.1, 1.63, 0.99, 0.3, 0.8, 0.82],
  [0.1, 1.63, 0.97, 0.305, 0.78, 0.82],
  [0.3, 1.67, 0.98, 0.29, 0.7, 0.8],
  [0.5, 1.73, 1.02, 0.25, 0.5, 0.75],
  [0.66, 1.72, 1.07, 0.225, 0.5, 0.7],
  [0.8, 1.62, 1.12, 0.2, 0.6, 0.55],
  [0.9, 1.5, 1.16, 0.165, 0.7, 0.5],
  [0.97, 1.38, 1.22, 0.1, 0.8, 0.6],
  [1.0, 1.32, 1.26, 0.03, 1, 1],
];
// where the barrel's surface is, at x and angle th round it (0 out to +z,
// π/2 on top)
function barrelAt(x, th, off = 0) {
  let i = 0;
  while (i < HORSE.length - 2 && HORSE[i + 1][0] < x) i++;
  const a = HORSE[i];
  const b = HORSE[i + 1];
  const t = clamp01((x - a[0]) / (b[0] - a[0]));
  const top = mix(a[1], b[1], t);
  const bot = mix(a[2], b[2], t);
  const w = mix(a[3], b[3], t);
  const sn = Math.sin(th);
  const cy = (top + bot) / 2;
  const h = (top - bot) / 2;
  const ww = w * (sn > 0 ? mix(1, mix(a[4], b[4], t), sn) : mix(1, mix(a[5], b[5], t), -sn));
  return V3(x, cy + sn * (h + off), Math.cos(th) * (ww + off));
}

// Asfaloth, Arwen's horse, facing +x: tall and fine-boned, pale grey-white,
// 1.7 at the withers, with a long silver mane and tail and a silver bridle,
// no saddle but a cloth. On him Arwen, in a dark blue-grey riding cloak with
// its hood down, her dark hair long, Hadhafang at her hip and the reins in
// her hands; slumped in front of her, Frodo, pale and hurt. gallop() runs
// him.
function asfaloth(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'asfaloth';
  const n = makeNoise(17);
  const body = new THREE.Group();
  body.name = 'body';
  g.add(body);
  const white = C(0xeeeef0);
  const grey = C(0x9a9aa2);
  const dark = C(0x2c2a2c);
  const coat = (x, y, z, out) => {
    // pale all over, a little greyer underneath, faintly dappled behind
    out.copy(white).multiplyScalar(0.92 + n(x * 3, z * 3 + y * 2) * 0.08);
    out.lerp(grey, clamp01((1.18 - y) * 1.6) * 0.45);
    const dap = smooth(0.62, 0.72, n(x * 9 + 3, y * 9 + z * 4)) * smooth(0.1, -0.6, x);
    out.lerp(grey, dap * 0.25);
  };
  const bk = parts();
  const stations = HORSE.map(([x, top, bot, w, wt, wb]) => ({ p: [x, (top + bot) / 2], up: (top - bot) / 2, dn: (top - bot) / 2, w, wt, wb }));
  bk.add(mats.coat, loft(stations, { radial: 18, sq: 2.3 }), { color: coat });
  // the saddle-cloth: silver-grey, edged in dark blue
  const cloth = [];
  for (let i = 0; i <= 8; i++) {
    for (let j = 0; j <= 10; j++) {
      const x = mix(-0.34, 0.3, i / 8);
      const th = mix(0.25, Math.PI - 0.25, j / 10);
      cloth.push(barrelAt(x, th, 0.012));
    }
  }
  const cg = new THREE.BufferGeometry().setFromPoints(cloth);
  const ci = [];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 10; j++) {
    const a = i * 11 + j;
    ci.push(a, a + 1, a + 11, a + 1, a + 12, a + 11);
  }
  cg.setIndex(ci);
  cg.computeVertexNormals();
  const edge = C(0xb8bcc8);
  const field = C(0x26324e);
  const cc = new Float32Array(cloth.length * 3);
  cloth.forEach((q, k) => {
    const i = Math.floor(k / 11);
    const j = k % 11;
    // a silver band a little in from its edge
    const outer = i === 0 || i === 8 || j === 0 || j === 10;
    const band = !outer && (i === 1 || i === 7 || j === 1 || j === 9);
    const c = band ? edge : field;
    cc.set([c.r, c.g, c.b], k * 3);
  });
  cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  bk.add(mats.cloth, cg);
  bk.build(body);

  // the legs: shoulders and hips are the pivots, knees and hocks bend
  const legs = [];
  const legCol = (x, y, z, out, hipY) => {
    const wy = hipY + y;
    out.copy(white).lerp(grey, clamp01((0.65 - wy) * 1.4) * 0.6);
    if (wy < 0.12) out.copy(dark);
  };
  for (const [x, z, hind] of [[0.62, 0.15, false], [0.62, -0.15, false], [-0.62, 0.16, true], [-0.62, -0.16, true]]) {
    const hipY = hind ? 1.34 : 1.3;
    const hip = new THREE.Group();
    hip.position.set(x, hipY, z);
    body.add(hip);
    const knee = new THREE.Group();
    knee.name = hind ? 'hock' : 'knee';
    const lk = parts();
    const kk = parts();
    const col = (px, py, pz, out) => legCol(px, py, pz, out, hipY);
    if (hind) {
      // the thigh and gaskin, forward to the stifle and back to the hock
      lk.add(mats.coat, tube([[0, 0.12, 0], [0.1, -0.22, 0], [0.0, -0.5, 0], [-0.13, -0.8, 0]], 0.17, 0.065, { seg: 9, radial: 11 }), { s: [1, 1, 0.85], color: col });
      lk.add(mats.coat, ball(0.2, 14, 12), { p: [0.02, -0.06, 0], s: [1.2, 1.45, 0.62], r: [0, 0, 0.25], color: col });
      knee.position.set(-0.13, -0.8, 0);
      const ky = hipY - 0.8;
      const kc = (px, py, pz, out) => legCol(px, py, pz, out, ky);
      kk.add(mats.coat, tube([[0, 0.02, 0], [0.01, -0.2, 0], [0.02, -0.4, 0], [0.06, -0.47, 0]], 0.055, 0.042, { seg: 6, radial: 7 }), { color: kc });
      kk.add(mats.coat, ball(0.05, 8, 6), { p: [0.02, -0.4, 0], s: [1.1, 1, 0.9], color: kc });
      kk.add(mats.coat, cyl(0.05, 0.068, 0.1, 9), { p: [0.085, -ky + 0.05, 0], r: [0, 0, -0.18], color: dark });
    } else {
      // the forearm down to the knee
      lk.add(mats.coat, tube([[0, 0.1, 0], [0.03, -0.25, 0], [0.02, -0.55, 0], [0.02, -0.72, 0]], 0.12, 0.06, { seg: 9, radial: 11 }), { s: [1, 1, 0.85], color: col });
      lk.add(mats.coat, ball(0.1, 12, 10), { p: [0.03, -0.18, 0], s: [1.05, 2.3, 0.8], color: col });
      knee.position.set(0.02, -0.72, 0);
      const ky = hipY - 0.72;
      const kc = (px, py, pz, out) => legCol(px, py, pz, out, ky);
      kk.add(mats.coat, ball(0.058, 8, 6), { s: [1, 1.1, 0.9], color: kc });
      kk.add(mats.coat, tube([[0, 0, 0], [0.0, -0.2, 0], [0.0, -0.34, 0], [0.05, -0.47, 0]], 0.048, 0.04, { seg: 6, radial: 7 }), { color: kc });
      kk.add(mats.coat, ball(0.05, 8, 6), { p: [0.0, -0.33, 0], s: [1.1, 1, 0.9], color: kc });
      kk.add(mats.coat, cyl(0.05, 0.068, 0.1, 9), { p: [0.075, -ky + 0.05, 0], r: [0, 0, -0.18], color: dark });
    }
    lk.build(hip);
    hip.add(knee);
    kk.build(knee);
    hip.userData = { knee, hind, rest: 0 };
    legs.push(hip);
  }

  // the neck, arched, and the mane along its crest
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.set(0.74, 1.56, 0);
  body.add(neck);
  const NECK = [[-0.14, -0.12, 0.2, 0.3, 0.32], [0.04, 0.02, 0.19, 0.27, 0.28], [0.2, 0.2, 0.16, 0.2, 0.22], [0.33, 0.38, 0.13, 0.15, 0.16], [0.43, 0.55, 0.11, 0.12, 0.13], [0.5, 0.66, 0.1, 0.11, 0.12], [0.53, 0.72, 0.07, 0.08, 0.08]];
  const nk = parts();
  const ncol = (x, y, z, out) => coat(x + 0.74, y + 1.56, z, out);
  nk.add(mats.coat, loft(NECK.map(([x, y, w, up, dn]) => ({ p: [x, y], w, up: up * 1.05, dn, wt: 0.55, wb: 0.85 })), { radial: 14, sq: 2.1 }), { color: ncol });
  nk.build(neck);
  const maneRoots = [];
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    // along the crest, from the withers to the poll
    const x = mix(-0.2, 0.47, t);
    const y = mix(0.18, 0.78, Math.pow(t, 0.9)) + Math.sin(t * Math.PI) * 0.03;
    for (const sd of [1, -1, 1]) {
      maneRoots.push({
        root: V3(x - 0.02, y, sd * 0.025),
        hang: V3(-0.3, -1, sd * 0.4).normalize(),
        stream: V3(-1, 0.15, sd * 0.15).normalize(),
        flutter: V3(0, 0.8, sd * 0.6).normalize(),
        side: V3(1, 0.5, 0).normalize(),
        normal: V3(0, 0.75, sd * 0.65).normalize(),
        len: mix(0.48, 0.32, t) * (0.8 + n(i, sd + maneRoots.length) * 0.35),
        width: 0.1,
        phase: i * 0.7 + sd,
        shade: 0.9 + n(i * 3, sd) * 0.15,
      });
    }
  }
  const mane = strands(mats.silverHair, maneRoots, { segs: 6, colour: [C(0xc8ccd4), C(0xf4f6fa)] });
  neck.add(mane.mesh);

  // the head, its long face down and forward, with the silver bridle
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.5, 0.7, 0);
  neck.add(head);
  const HEAD = [[-0.07, 0.05, 0.06, 0.06], [0.0, 0.1, 0.1, 0.13], [0.08, 0.108, 0.075, 0.15], [0.19, 0.092, 0.07, 0.11], [0.31, 0.072, 0.064, 0.08], [0.43, 0.064, 0.058, 0.07], [0.52, 0.072, 0.06, 0.076], [0.58, 0.06, 0.048, 0.06], [0.615, 0.03, 0.025, 0.03]];
  const hk = parts();
  const HA = -1.05; // how far it hangs
  const hcol = (x, y, z, out) => {
    // its frame: x down the face; the muzzle and round the eyes go grey
    out.copy(white).multiplyScalar(0.94);
    out.lerp(grey, smooth(0.36, 0.5, x) * 0.7).lerp(dark, smooth(0.5, 0.6, x) * 0.6);
    if (x > 0.08 && x < 0.2 && Math.abs(z) > 0.06 && y > 0) out.lerp(grey, 0.35);
  };
  hk.at([0, 0, 0], [0, 0, HA], () => {
    const geo = loft(HEAD.map(([x, w, up, dn]) => ({ p: [x, 0], w, up, dn, wt: 0.8, wb: 0.7 })), { radial: 14, sq: 2.2 });
    fillColor(geo, hcol);
    hk.add(mats.coat, geo);
    for (const s of [-1, 1]) {
      // ears, pricked
      const ear = new THREE.ConeGeometry(0.035, 0.15, 7);
      ear.scale(1, 1, 0.55);
      fillColor(ear, (x, y, z, out) => out.copy(white).lerp(grey, 0.2));
      hk.add(mats.coat, ear, { p: [-0.035, 0.11, s * 0.055], r: [s * 0.25, 0, 0.82] });
      // the eyes, large and dark
      hk.add(mats.eye, ball(0.024, 10, 8), { p: [0.13, 0.04, s * 0.09], s: [1.2, 1, 0.7] });
      // the nostrils
      hk.add(mats.eye, ball(0.016, 8, 6), { p: [0.585, 0.02, s * 0.03], s: [1.4, 0.7, 0.8] });
      // the bridle: cheek straps down to the bit, a ring there
      hk.add(mats.silver, tube([[-0.03, 0.07, s * 0.1], [0.2, 0.0, s * 0.098], [0.47, -0.035, s * 0.067]], 0.007, 0.007, { seg: 6, radial: 4 }));
      hk.add(mats.silver, new THREE.TorusGeometry(0.022, 0.005, 5, 12), { p: [0.5, -0.045, s * 0.068] });
      // little leaf-shaped rosettes where the straps meet
      hk.add(mats.silver, ball(0.016, 8, 5), { p: [0.02, 0.05, s * 0.105], s: [1.4, 0.8, 0.5] });
    }
    // the brow band, the noseband and the crown piece
    const strap = (x, ups, dns, wid, r = 0.007) => {
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const th = (k / 16) * TAU;
        const sn = Math.sin(th);
        pts.push(V3(x, sn * (sn > 0 ? ups : dns), Math.cos(th) * wid));
      }
      hk.add(mats.silver, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 20, r, 4, true));
    };
    strap(0.42, 0.075, 0.085, 0.072);
    strap(-0.01, 0.11, 0.15, 0.11, 0.006);
    hk.add(mats.silver, tube([[0.045, 0.098, -0.09], [0.06, 0.112, 0], [0.045, 0.098, 0.09]], 0.008, 0.008, { seg: 6, radial: 4 }));
    hk.add(mats.silver, ball(0.02, 8, 6), { p: [0.07, 0.11, 0], s: [1.2, 0.6, 1] });
  });
  hk.build(head);
  // the forelock
  const fore = strands(mats.silverHair, [-1, 0, 1].map((sd) => ({
    root: V3(-0.02, 0.1, sd * 0.03),
    hang: V3(Math.cos(HA), Math.sin(HA), sd * 0.3).normalize(),
    stream: V3(-0.6, 0.5, sd * 0.4).normalize(),
    flutter: V3(0, 0.4, 1),
    side: V3(0, 0, 1),
    normal: V3(Math.sin(-HA), Math.cos(HA), 0),
    len: 0.16,
    width: 0.05,
    phase: sd,
  })), { segs: 3, colour: [C(0xb8bcc4), C(0xeef0f4)] });
  head.add(fore.mesh);
  const bitAt = [-1, 1].map((s) => V3(0.5, -0.045, s * 0.068).applyAxisAngle(V3(0, 0, 1), HA));

  // the tail: a long silver switch from a short dock
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.98, 1.56, 0);
  body.add(tail);
  const tk = parts();
  tk.add(mats.coat, tube([[0.04, 0.02, 0], [-0.08, -0.02, 0], [-0.14, -0.14, 0]], 0.06, 0.045, { seg: 4, radial: 7 }), { color: white });
  tk.build(tail);
  const tailRoots = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    tailRoots.push({
      root: V3(-0.12 + Math.cos(a) * 0.02, -0.1, Math.sin(a) * 0.035),
      hang: V3(-0.12, -1, Math.sin(a) * 0.12).normalize(),
      stream: V3(-1, -0.12, Math.sin(a) * 0.12).normalize(),
      flutter: V3(0, 0.7, 0.7).normalize(),
      side: V3(Math.cos(a), 0, Math.sin(a)).cross(V3(0, 1, 0)).normalize(),
      normal: V3(Math.cos(a), 0, Math.sin(a)),
      len: 0.95 + n(i, 7) * 0.3,
      width: 0.09,
      phase: i * 0.9,
      shade: 0.88 + n(i, 3) * 0.2,
    });
  }
  const tailHair = strands(mats.silverHair, tailRoots, { segs: 7, colour: [C(0xc8ccd4), C(0xf2f4f8)] });
  tail.add(tailHair.mesh);

  // ── Arwen ──
  const arwen = new THREE.Group();
  arwen.name = 'arwen';
  arwen.position.set(-0.12, 1.73, 0);
  body.add(arwen);
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.rotation.z = -0.2;
  arwen.add(torso);
  const ak = parts();
  // her legs astride, in dark riding breeches and tall boots
  for (const s of [-1, 1]) {
    ak.add(mats.dress, tube([[0.0, 0.07, s * 0.1], [0.18, 0.0, s * 0.26], [0.32, -0.16, s * 0.33]], 0.085, 0.07, { seg: 6, radial: 8 }));
    ak.add(mats.leather, tube([[0.32, -0.16, s * 0.33], [0.3, -0.36, s * 0.35], [0.24, -0.56, s * 0.34]], 0.066, 0.052, { seg: 5, radial: 8 }));
    ak.add(mats.leather, roundBox(0.2, 0.07, 0.08, 0.03), { p: [0.29, -0.6, s * 0.34], r: [0, 0, -0.35] });
  }
  ak.build(arwen);
  const tk2 = parts();
  // her body, slim, in a dark grey-blue riding dress, leaning into the ride
  tk2.add(mats.dress, lathe([[0.001, -0.02], [0.15, 0.0], [0.155, 0.12], [0.12, 0.26], [0.135, 0.38], [0.145, 0.48], [0.135, 0.56], [0.08, 0.62], [0.045, 0.66], [0.001, 0.67]], 16), { s: [0.78, 1, 1.12] });
  tk2.add(mats.skin, cyl(0.04, 0.045, 0.12, 10), { p: [0.01, 0.7, 0] });
  // the hood, down, bunched round the back of her neck
  tk2.add(mats.riding, new THREE.TorusGeometry(0.12, 0.055, 7, 14, Math.PI * 1.25), { p: [-0.03, 0.6, 0], r: [Math.PI / 2, 0, Math.PI / 2 + Math.PI * 0.125], s: [1, 1.15, 0.8] });
  tk2.add(mats.riding, ball(0.11, 10, 8), { p: [-0.13, 0.52, 0], s: [0.6, 1.1, 1.2] });
  // a silver clasp at her throat
  tk2.add(mats.silver, ball(0.022, 8, 6), { p: [0.1, 0.6, 0], s: [0.6, 1, 1.4] });
  // a belt, and Hadhafang in its scabbard at her left hip, hilt forward
  tk2.add(mats.leather, tube([[0.0, 0.2, -0.155], [0.13, 0.2, 0], [0.0, 0.2, 0.155]], 0.016, 0.016, { seg: 8, radial: 5 }));
  tk2.add(mats.leather, tube([[0.03, 0.17, -0.2], [-0.2, 0.06, -0.24], [-0.45, -0.1, -0.25], [-0.66, -0.3, -0.24]], 0.022, 0.017, { seg: 10, radial: 6 }), { s: [1, 1, 0.7] });
  tk2.add(mats.silver, cyl(0.022, 0.012, 0.07, 6), { p: [-0.68, -0.33, -0.24], r: [0, 0, 0.75] });
  tk2.add(mats.silver, tube([[0.06, 0.2, -0.2], [0.15, 0.26, -0.2], [0.25, 0.3, -0.19]], 0.011, 0.01, { seg: 4, radial: 5 }));
  tk2.add(mats.silver, roundBox(0.03, 0.11, 0.03, 0.01), { p: [0.06, 0.2, -0.2], r: [0, 0, -0.9] });
  tk2.add(mats.silver, ball(0.016, 6, 5), { p: [0.27, 0.31, -0.19] });
  // arms forward round Frodo to the reins
  for (const s of [-1, 1]) {
    tk2.add(mats.dress, tube([[0.0, 0.56, s * 0.15], [0.12, 0.38, s * 0.22], [0.3, 0.27, s * 0.19], [0.44, 0.22, s * 0.12]], 0.05, 0.036, { seg: 8, radial: 7 }));
    tk2.add(mats.skin, ball(0.035, 8, 6), { p: [0.47, 0.215, s * 0.11], s: [1.3, 0.9, 0.9] });
  }
  tk2.build(torso);
  const handAt = [-1, 1].map((s) => V3(0.48, 0.22, s * 0.11));
  // her head: pale, fine, an elf's ears through long dark hair
  const ahead = new THREE.Group();
  ahead.name = 'head';
  ahead.position.set(0.03, 0.86, 0);
  torso.add(ahead);
  const hk3 = parts();
  hk3.add(mats.skin, ball(0.13, 18, 14), { s: [1, 1.14, 0.9] });
  hk3.add(mats.skin, ball(0.06, 10, 8), { p: [0.045, -0.075, 0], s: [1, 0.75, 1.15] });
  hk3.add(mats.skin, new THREE.ConeGeometry(0.014, 0.04, 5), { p: [0.128, -0.01, 0], r: [0, 0, -1.25], s: [1, 1, 0.8] });
  for (const s of [-1, 1]) {
    hk3.add(mats.eye, ball(0.014, 8, 6), { p: [0.112, 0.02, s * 0.045], s: [0.6, 0.7, 1.2] });
    hk3.add(mats.hair, B(0.012, 0.006, 0.04), { p: [0.118, 0.048, s * 0.046], r: [s * 0.2, 0, 0], color: 0x140c08 });
    hk3.add(mats.skin, new THREE.ConeGeometry(0.02, 0.09, 5), { p: [-0.01, 0.03, s * 0.115], r: [s * -1.0, 0, 0.5], s: [1, 1, 0.45] });
  }
  hk3.add(mats.food, B(0.01, 0.008, 0.035), { p: [0.118, -0.068, 0], color: 0x7a3a3a });
  // the hair over her crown, parted, and its fall down her back
  hk3.add(mats.hair, new THREE.SphereGeometry(0.142, 18, 12, Math.PI + 0.85, TAU - 1.7, 0, Math.PI * 0.64), { s: [1, 1.14, 0.95], color: 0x1c130e });
  hk3.add(mats.hair, new THREE.SphereGeometry(0.143, 14, 6, Math.PI - 0.9, 1.8, 0, Math.PI * 0.2), { s: [1, 1.14, 0.95], color: 0x1c130e });
  hk3.add(mats.hair, ball(0.12, 12, 10), { p: [-0.07, -0.05, 0], s: [0.8, 1.1, 1.05], color: 0x1c130e });
  hk3.build(ahead);
  const hairRoots = [];
  for (let i = 0; i < 13; i++) {
    const a = mix(-1.7, 1.7, i / 12);
    hairRoots.push({
      root: V3(-0.06 - Math.cos(a) * 0.08, 0.02 - Math.abs(a) * 0.03, Math.sin(a) * 0.11),
      hang: V3(-0.25, -1, Math.sin(a) * 0.15).normalize(),
      stream: V3(-1, -0.15, Math.sin(a) * 0.25).normalize(),
      flutter: V3(0, 0.75, 0.65).normalize(),
      side: V3(-Math.sin(a) * 0.3, 0, Math.cos(a)).normalize(),
      normal: V3(-Math.cos(a), 0.2, Math.sin(a)).normalize(),
      len: 0.55 + n(i, 11) * 0.15,
      width: 0.07,
      phase: i * 0.8,
      shade: 0.85 + n(i, 13) * 0.3,
    });
  }
  const hair = strands(mats.hair, hairRoots, { segs: 6, colour: [C(0x1e140e), C(0x2a1c14)] });
  ahead.add(hair.mesh);
  // the riding cloak: from her shoulders down her back and over his
  // quarters, streaming out behind at a gallop
  const cloak = clothSheet(mats.riding, { cols: 11, rows: 9 });
  torso.add(cloak.mesh);

  // ── Frodo, slumped back against her ──
  const frodo = seatedFrodo(K);
  frodo.group.position.set(0.17, 1.74, 0);
  body.add(frodo.group);

  // ── the reins, from the bit to her hands, drawn fresh each frame ──
  const reins = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4, 1).translate(0, 0.5, 0), mats.silver);
    g.add(m);
    return m;
  });
  const _a = V3();
  const _b = V3();
  const _q = new THREE.Quaternion();
  const drawReins = () => {
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    for (let i = 0; i < 2; i++) {
      head.localToWorld(_a.copy(bitAt[i])).applyMatrix4(inv);
      torso.localToWorld(_b.copy(handAt[i])).applyMatrix4(inv);
      const d = _b.clone().sub(_a);
      reins[i].position.copy(_a);
      reins[i].scale.set(1, d.length(), 1);
      reins[i].quaternion.copy(_q.setFromUnitVectors(V3(0, 1, 0), d.normalize()));
    }
  };

  const a = {
    group: g,
    body,
    horse: { group: body, legs, neck, head, tail, mane: mane.mesh },
    arwen: { group: arwen, torso, head: ahead, hair: hair.mesh, cloak: cloak.mesh },
    frodo,
    flow: { mane, fore, tail: tailHair, hair, cloak },
    drawReins,
    state: { phase: 0, t: null, k: 0, wind: 0 },
  };
  gallop(a, 0, 0);
  return a;
}

// Frodo, wounded, riding in front of Arwen: a hobbit in Arwen's proportions
// (not the toy figures', whose big heads would hide her), in his shirt,
// brown waistcoat and breeches, bare hairy feet, pale, his eyes shut,
// slumped back against her, one hand to the wound in his shoulder. The
// Ring on its chain at his neck. Sits at its origin, facing +x.
function seatedFrodo(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'frodo';
  const skin = 0xe2d3c8;
  const bk = parts();
  for (const s of [-1, 1]) {
    bk.add(mats.beast, tube([[0.0, 0.05, s * 0.07], [0.12, 0.02, s * 0.2], [0.2, -0.04, s * 0.26]], 0.062, 0.05, { seg: 5, radial: 8 }), { color: 0x5a4632 });
    bk.add(mats.beast, tube([[0.2, -0.04, s * 0.26], [0.2, -0.18, s * 0.27], [0.17, -0.3, s * 0.27]], 0.045, 0.04, { seg: 4, radial: 7 }), { color: 0xd8b494 });
    bk.add(mats.beast, ball(0.06, 10, 8), { p: [0.21, -0.34, s * 0.27], s: [1.7, 0.65, 1.05], color: 0xd6a878 });
    bk.add(mats.hair, blob(0.045, { detail: 1, amp: 0.3, freq: 6, seed: 3 + s }), { p: [0.2, -0.3, s * 0.27], s: [1.3, 0.7, 1.1], color: 0x3a2214 });
  }
  bk.build(g);
  const torso = new THREE.Group();
  torso.name = 'torso';
  torso.rotation.set(0.1, 0, 0.3);
  g.add(torso);
  const tk = parts();
  tk.add(mats.beast, lathe([[0.001, 0], [0.12, 0.0], [0.13, 0.1], [0.12, 0.24], [0.115, 0.34], [0.07, 0.4], [0.001, 0.42]], 14), { s: [0.82, 1, 1], color: 0xeee6d6 });
  tk.add(mats.beast, lathe([[0.125, 0.02], [0.135, 0.1], [0.126, 0.24], [0.12, 0.33]], 14, Math.PI * 0.62, Math.PI * 1.76), { s: [0.84, 1, 1.02], color: 0x7a4a2a });
  for (let k = 0; k < 3; k++) tk.add(mats.brass, ball(0.008, 5, 4), { p: [0.1, 0.1 + k * 0.07, 0.025] });
  tk.add(mats.beast, cyl(0.035, 0.04, 0.08, 8), { p: [0, 0.44, 0], color: skin });
  // the Ring on its chain
  tk.add(mats.gold, new THREE.TorusGeometry(0.05, 0.003, 3, 14), { p: [0.03, 0.4, 0], r: [Math.PI / 2 + 0.5, 0, 0.3] });
  tk.add(mats.gold, new THREE.TorusGeometry(0.014, 0.004, 5, 12), { p: [0.085, 0.32, 0.0], r: [0, Math.PI / 2, 0] });
  // the left arm hanging, the right across to the wound
  tk.add(mats.beast, tube([[0.0, 0.36, -0.13], [0.04, 0.2, -0.17], [0.12, 0.08, -0.13]], 0.035, 0.03, { seg: 5, radial: 7 }), { color: 0xeee6d6 });
  tk.add(mats.beast, ball(0.03, 7, 6), { p: [0.14, 0.06, -0.12], color: skin });
  tk.add(mats.beast, tube([[0.0, 0.36, 0.13], [0.11, 0.26, 0.14], [0.11, 0.33, -0.04], [0.06, 0.37, -0.09]], 0.035, 0.03, { seg: 6, radial: 7 }), { color: 0xeee6d6 });
  tk.add(mats.beast, ball(0.03, 7, 6), { p: [0.05, 0.37, -0.1], color: skin });
  tk.build(torso);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.02, 0.55, 0);
  head.rotation.set(0.35, 0.25, -0.38);
  torso.add(head);
  const hk = parts();
  hk.add(mats.beast, ball(0.105, 16, 12), { s: [1, 1.07, 0.93], color: skin });
  for (const s of [-1, 1]) {
    hk.add(mats.eye, B(0.006, 0.004, 0.026), { p: [0.1, 0.012, s * 0.035], r: [s * 0.15, 0, 0] });
    hk.add(mats.beast, new THREE.ConeGeometry(0.018, 0.05, 5), { p: [-0.005, 0.02, s * 0.097], r: [s * -1.2, 0, 0.4], s: [1, 1, 0.5], color: skin });
  }
  hk.add(mats.beast, ball(0.016, 6, 5), { p: [0.105, -0.015, 0], color: 0xd8c4b6 });
  // dark curls all over
  const r = rng(12);
  for (let i = 0; i < 30; i++) {
    const a = r() * TAU;
    const up = 0.05 + r() * 0.95;
    const x = Math.cos(a) * Math.sqrt(1 - up * up);
    const z = Math.sin(a) * Math.sqrt(1 - up * up);
    if (x > 0.45 && up < 0.6) continue;
    hk.add(mats.hair, ball(0.032 + r() * 0.014, 5, 4), { p: [x * 0.1 - 0.01, up * 0.1 + 0.015, z * 0.1], color: 0x3a2214 });
  }
  hk.build(head);
  return { group: g, torso, head };
}

// A cloak hung from the shoulders (in the torso's frame), a grid of cloth
// that falls down the back and over the horse's quarters when still, and
// streams out behind, rippling, in the wind.
function clothSheet(material, { cols = 11, rows = 9 } = {}) {
  const N = (cols + 1) * (rows + 1);
  const pos = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const idx = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) uv.set([i / cols, 1 - j / rows], (j * (cols + 1) + i) * 2);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i;
    idx.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const flow = (t, k) => {
    for (let j = 0; j <= rows; j++) {
      const v = j / rows;
      for (let i = 0; i <= cols; i++) {
        const u = i / cols;
        // round her shoulders: an arc across her back
        const a = mix(-1.45, 1.45, u);
        const sx = -0.03 - Math.cos(a) * 0.13;
        const sz = Math.sin(a) * 0.19;
        // still: falling, then spreading over the horse
        const fall = v * 0.95;
        let x = sx - v * 0.28 - v * v * 0.25;
        let y = 0.6 - fall;
        let z = sz * (1 + v * 1.6);
        // the wind: out behind her, lifting, in waves running down it
        const wave = Math.sin(t * (3 + 10 * k) - v * 6 + u * 2.2) * 0.5 + Math.sin(t * (5 + 15 * k) - v * 10 + u * 4) * 0.25;
        x = mix(x, sx - v * 1.3, k);
        y = mix(y, 0.6 - v * 0.45 + wave * 0.14 * v * k, k);
        z = mix(z, sz * (1 + v * 1.5) + wave * 0.07 * v * k, k);
        y += Math.sin(t * 1.3 + u * 3) * 0.01 * v * (1 - k);
        pos.set([x, y, z], (j * (cols + 1) + i) * 3);
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  flow(0, 0);
  return { mesh, flow };
}

// Gallops Asfaloth (what asfaloth() made) at time t (seconds). `speed` is
// how fast he goes against a full gallop at the ride's pace: 1 is that (the
// ride's base speed), 0 stands him still, a half is a slowed, shorter
// gallop, and more than 1 (spurred on) quickens the stride. A transverse
// gallop: the body rocking, the head and neck nodding with it, mane and tail
// and Arwen's hair and cloak streaming out. Standing, he shifts a little and
// swishes his tail. Call it every frame; it eases between the two.
//
// His legs keep their hold on the ground at any pace: how fast he really
// goes is read from where the scene puts him (../../creatures.js), and his
// stride both lengthens and quickens with it, uncapped, so his hooves don't
// slide at a spurred gallop. Moved by something else (a parent group) or not
// at all while `speed` says he's galloping, he gallops at `speed` × `base`
// metres a second (opts.base: the ride's own pace, Weathertop's by
// default); opts.mps says his speed outright. Each hoof is put down and held
// where it lands while the body rocks on over it, the knee (the hock behind)
// taking up the rest; up, it folds and comes through.
const GALLOP_BASE = 15.2; // m/s: a full gallop at Weathertop (./rules.js RIDE.base)
const GALLOP_STANCE = 0.25; // the share of a stride each hoof is down
const GALLOP_OFF = [0.45, 0.55, 0.0, 0.1]; // legs[]: fore +z, fore -z, hind +z, hind -z
// the legs as asfaloth() builds them: the knee (the hock behind) below the
// shoulder (the hip), the hoof below that; both fold back
const FORE = legRig({ knee: [0.02, -0.72], foot: [0.132, -0.591], bend: -1 });
const HIND = legRig({ knee: [-0.13, -0.8], foot: [0.142, -0.551], bend: -1 });
export function gallop(a, t, speed = 0, { mps = null, base = GALLOP_BASE } = {}) {
  if (!a?.horse) return;
  const S = a.state;
  const first = S.t == null;
  const dt = first ? 0 : Math.max(0, Math.min(0.1, t - S.t));
  S.t = t;
  // how far into the gallop he is eases towards what the speed asks
  const v = Math.max(0, speed);
  const want = smooth(0, 0.35, v);
  S.k += (want - S.k) * (first ? 1 : 1 - Math.exp(-dt * 4));
  const k = S.k;
  // how fast he really goes: told, or read from where he's put, or (moved
  // some other way) what `speed` says
  S.track ??= createTracker({ fastest: 40 });
  S.stride ??= createStride({ stride: 3.6, hz: 1.9, longest: 2.0, stance: GALLOP_STANCE, cadence: [1.6, 2.6], seed: 17 });
  const g = a.group;
  const m = g ? S.track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x) : null;
  const read = m && m.speed > 0.3 ? m.speed : 0;
  const ground = mps != null ? Math.max(0, mps) : read > 0 ? read : v * base;
  const st = S.stride.step(dt, v > 0 ? ground : 0);
  // the wind in his mane
  const gust = v > 0 ? Math.min(1, 0.35 + 0.65 * v) : 0;
  S.wind += (gust - S.wind) * (first ? 1 : 1 - Math.exp(-dt * 3));
  S.phase = st.cycle;
  const ph = S.phase;
  // the body rocks and rises with the stride, highest in the air between
  // footfalls, a little low throughout so the legs can reach
  const rock = Math.sin((ph + 0.2) * TAU);
  const pitch = rock * 0.07 * k;
  const lift = (Math.abs(Math.sin((ph + 0.1) * Math.PI)) * 0.1 - 0.12) * k + Math.sin(t * 1.4) * 0.006 * (1 - k);
  a.body.rotation.z = pitch;
  a.body.position.y = lift;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const up = Math.min(1.3, 0.6 + 0.4 * st.reach);
  const { legs, neck, head, tail } = a.horse;
  legs.forEach((hip, i) => {
    const { knee, hind } = hip.userData;
    const rig = hind ? HIND : FORE;
    const f = footAt(ph + GALLOP_OFF[i], GALLOP_STANCE);
    // where the hoof goes, from his feet, level: beneath its hip as he
    // stands, swept back by the ground he covers while it's down
    const hx = hip.position.x;
    const hy = hip.position.y;
    const gx = hx + rig.home[0] + (f.x * st.travel) / 2;
    const gy = hy + rig.home[1] + f.lift * (hind ? 0.32 : 0.38) * up;
    // from the hip, as the rocking body has it
    const dx = gx - (hx * cp - hy * sp);
    const dy = gy - (hx * sp + hy * cp + lift);
    const [th, kn] = rig.reach(dx * cp + dy * sp, -dx * sp + dy * cp);
    const still = Math.sin(t * 0.6 + i * 1.7) * 0.02;
    hip.rotation.z = mix(still, th, k);
    knee.rotation.z = mix(0, kn, k);
  });
  // the neck stretches out and nods; standing, he looks about
  neck.rotation.z = mix(Math.sin(t * 0.37) * 0.06 + 0.02, -0.38 + Math.sin((ph + 0.35) * TAU) * 0.13, k);
  neck.rotation.y = Math.sin(t * 0.23) * 0.12 * (1 - k);
  head.rotation.z = mix(Math.sin(t * 0.5 + 1) * 0.05, 0.3 - Math.sin((ph + 0.35) * TAU) * 0.08, k);
  tail.rotation.z = mix(Math.sin(t * 0.9) * 0.05, 0.35 + Math.sin(ph * TAU) * 0.08, k);
  tail.rotation.y = Math.sin(t * 1.1) * 0.25 * (1 - k);
  // Arwen leans into it; Frodo lolls
  a.arwen.torso.rotation.z = mix(-0.08, -0.32 + rock * 0.05, k);
  a.arwen.head.rotation.z = mix(0.05, 0.2, k);
  a.arwen.head.rotation.y = Math.sin(t * 0.3) * 0.15 * (1 - k);
  a.frodo.group.rotation.x = Math.sin(ph * TAU) * 0.04 * k;
  a.frodo.head.rotation.x = 0.35 + Math.sin(ph * TAU + 1) * 0.08 * k;
  const w = Math.min(k, S.wind);
  const f = a.flow;
  f.mane.flow(t, w);
  f.fore.flow(t, w);
  f.tail.flow(t, w);
  f.hair.flow(t, w);
  f.cloak.flow(t, w);
  a.drawReins();
}

// ── the flood ──

// One of the horses of the flood at the Ford of Bruinen: the river rising in
// the shape of a horse, its head and arched neck and striking forelegs
// surging out of a cresting wave, spray for its mane, white water churning
// at its foot. Faces +x, downstream; its local y = 0 is the river's surface.
// update(t, k): k is how far it has risen (0 hidden under the water, 1 up,
// about 4 m tall).
function floodHorse(K, seed = 1) {
  const g = new THREE.Group();
  g.name = 'floodHorse';
  const r = rng(seed * 19 + 7);
  const rise = new THREE.Group();
  rise.name = 'rise';
  g.add(rise);
  const water = floodWaterMaterial();
  const list = [];
  // the forequarters, rearing out of the wave
  list.push(loft([
    [-1.6, 0.7, 0.3, 0.3], [-1.1, 1.15, 0.42, 0.5], [-0.5, 1.65, 0.5, 0.6], [0.1, 2.0, 0.48, 0.6], [0.6, 2.25, 0.4, 0.52], [0.95, 2.35, 0.26, 0.36], [1.12, 2.36, 0.08, 0.12],
  ].map(([x, y, w, h]) => ({ p: [x, y], w, up: h, dn: h, wt: 0.6, wb: 0.6 })), { radial: 18, sq: 2.1 }));
  // the neck, arched, flung up and forward
  const NECK = [[-0.14, -0.12, 0.2, 0.3, 0.32], [0.04, 0.04, 0.19, 0.27, 0.28], [0.2, 0.24, 0.16, 0.2, 0.22], [0.34, 0.44, 0.13, 0.15, 0.16], [0.44, 0.62, 0.11, 0.12, 0.13], [0.52, 0.74, 0.1, 0.11, 0.12], [0.56, 0.8, 0.07, 0.08, 0.08]];
  const neckAt = V3(0.35, 2.35, 0);
  const NX = 2.1; // the neck: further forward than up, and thick
  const NY = 1.55;
  const NT = 2.15;
  const neckGeo = loft(NECK.map(([x, y, w, up, dn]) => ({ p: [x * NX, y * NY], w: w * NT, up: up * NT * 1.05, dn: dn * NT, wt: 0.55, wb: 0.85 })), { radial: 14, sq: 2.1 });
  neckGeo.translate(neckAt.x, neckAt.y, 0);
  list.push(neckGeo);
  // the head, thrust forward, ears flat back
  const HEAD = [[-0.07, 0.05, 0.06, 0.06], [0.0, 0.1, 0.1, 0.13], [0.08, 0.108, 0.075, 0.15], [0.19, 0.092, 0.07, 0.11], [0.31, 0.072, 0.064, 0.08], [0.43, 0.064, 0.058, 0.07], [0.52, 0.072, 0.06, 0.08], [0.58, 0.06, 0.05, 0.065], [0.615, 0.03, 0.025, 0.03]];
  const HS = 2.2;
  const headGeo = loft(HEAD.map(([x, w, up, dn]) => ({ p: [x * HS, 0], w: w * HS, up: up * HS, dn: dn * HS * 1.1, wt: 0.8, wb: 0.7 })), { radial: 14, sq: 2.2 });
  const poll = V3(0.53 * NX, 0.78 * NY, 0).add(neckAt);
  headGeo.rotateZ(-0.78).translate(poll.x, poll.y, 0);
  list.push(headGeo);
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.075, 0.32, 6);
    ear.rotateZ(1.75).rotateX(s * 0.35).translate(poll.x - 0.12, poll.y + 0.2, s * 0.14);
    list.push(ear);
  }
  // the forelegs: one folded high, one striking out
  const legs = [
    [[0.55, 2.0, 0.3], [1.0, 2.2, 0.34], [1.45, 2.05, 0.36], [1.55, 1.5, 0.36], [1.7, 1.25, 0.36]],
    [[0.55, 2.0, -0.3], [0.95, 1.65, -0.34], [1.3, 1.25, -0.36], [1.75, 1.05, -0.36], [2.05, 0.95, -0.36]],
  ];
  for (const pts of legs) list.push(tube(pts, 0.25, 0.11, { seg: 12, radial: 9 }));
  for (const pts of legs) {
    const h = pts[pts.length - 1];
    list.push(new THREE.SphereGeometry(0.15, 8, 6).translate(h[0], h[1], h[2]));
  }
  // the wave the horse bursts from: cresting and curling forward, highest
  // behind the horse, running out along the river either side
  const W = 2.7 + r() * 0.5;
  const prof = [[-4.0, -0.4], [-3.0, 0.15], [-2.0, 0.75], [-1.1, 1.35], [-0.4, 1.85], [0.15, 2.05], [0.6, 1.95], [0.95, 1.65], [1.05, 1.25], [0.8, 0.95], [0.75, 0.5], [0.9, -0.4]];
  const zs = 30;
  const wpos = [];
  const widx = [];
  for (let i = 0; i <= zs; i++) {
    const z = mix(-W, W, i / zs);
    const hz = Math.pow(Math.max(0, 1 - (z / W) ** 2), 0.6) * (1 + 0.12 * Math.sin(z * 1.7 + seed));
    for (const [x, y] of prof) wpos.push(x * (0.75 + 0.25 * hz) - (1 - hz) * 0.6, y > 0 ? y * hz : y, z);
  }
  const m = prof.length;
  for (let i = 0; i < zs; i++) for (let k = 0; k < m - 1; k++) {
    const a = i * m + k;
    widx.push(a, a + m, a + 1, a + 1, a + m, a + m + 1);
  }
  const wave = new THREE.BufferGeometry();
  wave.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  wave.setIndex(widx);
  wave.computeVertexNormals();
  list.push(wave);
  const form = new THREE.Mesh(mergeGeometries(list.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k);
    if (!y.attributes.normal) y.computeVertexNormals();
    y.setAttribute('aWave', new THREE.BufferAttribute(new Float32Array(y.attributes.position.count).fill(x === wave ? 1 : 0), 1));
    return y;
  }), false), water);
  form.renderOrder = 2;
  form.frustumCulled = false;
  rise.add(form);

  // white water on the river round its foot
  const churn = churnMaterial();
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(9, 8, 1, 1).rotateX(-Math.PI / 2).translate(0.2, 0.04, 0), churn);
  disc.renderOrder = 1;
  g.add(disc);

  // spray
  const N = 900;
  const seeds = new Float32Array(N * 4);
  const from = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const crest = (z) => {
    const hz = Math.pow(Math.max(0, 1 - (z / W) ** 2), 0.6);
    return [0.3 * hz, 2.0 * hz];
  };
  for (let i = 0; i < N; i++) {
    seeds.set([r(), r(), r(), r()], i * 4);
    const kind = i % 3;
    let f;
    let v;
    if (kind === 0) {
      // off the crest of the wave, flung forward and up
      const z = mix(-W, W, r());
      const [x, y] = crest(z);
      f = [x + 0.2, y, z];
      v = [1.2 + r() * 1.5, 1.4 + r() * 1.6, (r() - 0.5) * 1.2];
    } else if (kind === 1) {
      // the mane: streaming back off the crest of the neck
      const t = r();
      const nx = mix(-0.15, 0.5, t) * NX + neckAt.x;
      const ny = mix(0.2, 0.85, t) * NY + neckAt.y + 0.25;
      f = [nx - 0.1, ny + 0.15, (r() - 0.5) * 0.25];
      v = [-2.6 - r() * 1.6, 1.4 + r() * 1.4, (r() - 0.5) * 1.4];
    } else {
      // bursting off the chest and the striking hooves
      const leg = legs[i % 2];
      const h = r() < 0.5 ? leg[leg.length - 1] : [0.95 + r() * 0.3, 1.6 + r() * 0.8, (r() - 0.5) * 0.8];
      f = [h[0], h[1], h[2]];
      v = [0.6 + r() * 1.4, 0.6 + r() * 1.8, (r() - 0.5) * 2.0];
    }
    from.set(f, i * 3);
    vel.set(v, i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  pg.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  pg.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  const spray = sprayPoints(pg);
  spray.frustumCulled = false;
  spray.renderOrder = 3;
  rise.add(spray);

  const _v2 = new THREE.Vector2();
  const update = (t, k = 1) => {
    const e = clamp01(k);
    const up = 1 - Math.pow(1 - e, 3);
    g.visible = e > 0.001;
    rise.position.y = mix(-4.6, 0, up);
    rise.position.x = mix(-1.2, 0, up);
    rise.rotation.z = mix(0.35, 0, up) + Math.sin(t * 1.3 + seed) * 0.03;
    g.updateWorldMatrix(true, false);
    const wy = g.matrixWorld.elements[13];
    water.uniforms.uTime.value = t + seed * 3.1;
    water.uniforms.uWater.value = wy;
    churn.uniforms.uTime.value = t + seed;
    churn.uniforms.uRise.value = smooth(0, 0.35, e);
    const sp = spray.material.uniforms;
    sp.uTime.value = t + seed * 1.7;
    sp.uRise.value = smooth(0.15, 0.7, e);
    sp.uWater.value = wy;
    const renderer = K.renderer;
    if (renderer) {
      renderer.getDrawingBufferSize(_v2);
      sp.uScale.value = _v2.y * 0.9;
    }
  };
  update(0, 0);
  return { group: g, update };
}

// ── a burning brand ──

// A brand from the fire: a stick with its head wrapped round in rags soaked
// in pitch, embers in the wrapping. Its grip is the origin; it points up.
function torch(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'torch';
  const bk = parts();
  bk.add(mats.timber, tube([[0.005, -0.32, 0], [0, 0.0, 0.004], [-0.004, 0.36, 0]], 0.022, 0.026, { seg: 4, radial: 6, gnarl: 0.15, seed: 2 }), { uv: 3 });
  // the rag, wound round and round in a fat spindle
  const head = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const a = t * TAU * 6;
    const y = 0.33 + t * 0.26;
    const rr = 0.032 + Math.sin(Math.PI * t) * 0.022;
    head.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
  }
  bk.add(mats.pitch, lathe([[0.02, 0.32], [0.04, 0.36], [0.052, 0.45], [0.048, 0.56], [0.03, 0.6], [0.001, 0.61]], 10));
  bk.add(mats.pitch, tube(head, 0.016, 0.014, { seg: 48, radial: 5, seed: 4 }));
  // a loose end of rag
  bk.add(mats.pitch, tube([[0.045, 0.36, 0], [0.065, 0.31, 0.02], [0.06, 0.26, 0.04]], 0.012, 0.006, { seg: 3, radial: 4 }));
  // embers caught in the wrapping
  const r = rng(3);
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU;
    const y = 0.47 + r() * 0.12;
    const rr = 0.04 + Math.sin(Math.PI * ((y - 0.33) / 0.26)) * 0.018;
    bk.add(mats.brand, ball(0.008 + r() * 0.008, 5, 4), { p: [Math.cos(a) * rr, y, Math.sin(a) * rr] });
  }
  bk.build(g);
  return { group: g, flameAt: V3(0, 0.66, 0) };
}

// ── the kit ──

// a soft round glow, for the athelas's light
function haloCanvas() {
  const c = makeCanvas(64);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,0.8)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.4)');
  grd.addColorStop(0.55, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  return c;
}

export function createWeathertopKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = weatheredCanvas(S, 7);
  const wool = woolCanvas(S, 13);
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 3), { srgb: false }),
    wool: T(wool.c, { repeat: [3, 3] }),
    woolN: T(normalFromField(wool.field, S, S, 2.4), { srgb: false, repeat: [3, 3] }),
    halo: T(haloCanvas(), { wrap: false }),
  };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  Object.assign(mats, {
    ruin: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.94 }),
    rock: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.96 }),
    troll: M({ map: tex.stone, normalMap: tex.stoneN, normalScale: new THREE.Vector2(1.4, 1.4), vertexColors: true, roughness: 0.95 }),
    earth: M({ vertexColors: true, roughness: 1 }),
    scorch: M({ vertexColors: true, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    grass: M({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    // the fire's embers: pulse them by emissiveIntensity
    ember: M({ color: 0x140804, emissive: new THREE.Color(0xff5a1c), emissiveIntensity: 1.6, vertexColors: true, roughness: 0.9 }),
    char: M({ vertexColors: true, roughness: 0.95 }),
    blanket: M({ map: tex.wool, normalMap: tex.woolN, vertexColors: true, roughness: 0.97, side: THREE.DoubleSide }),
    copper: M({ color: 0xa8643a, metalness: 0.75, roughness: 0.42 }),
    leaf: M({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(0) }),
    petal: M({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide, emissive: new THREE.Color(0) }),
    deadwood: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x8e8a84, roughness: 0.95 }),
    pinebark: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x6a5446, roughness: 0.95 }),
    tree: M({ vertexColors: true, roughness: 0.9 }),
    pitch: M({ color: 0x0b0907, roughness: 0.38, metalness: 0.1 }),
    brand: M({ color: 0x100604, emissive: new THREE.Color(0xff7a2a), emissiveIntensity: 2.2, roughness: 0.9 }),
    // Asfaloth, and Arwen
    coat: M({ vertexColors: true, roughness: 0.52 }),
    silverHair: M({ vertexColors: true, roughness: 0.42, metalness: 0.2, side: THREE.DoubleSide }),
    silver: M({ color: 0xdde2ea, metalness: 0.9, roughness: 0.26 }),
    eye: M({ color: 0x0c0a0a, roughness: 0.12 }),
    skin: M({ color: 0xf0ddd2, roughness: 0.6 }),
    hair: M({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }),
    riding: M({ map: tex.wool, normalMap: tex.woolN, color: 0x4a5670, roughness: 0.93, side: THREE.DoubleSide }),
    dress: M({ color: 0x2e3546, roughness: 0.82 }),
    leather: M({ color: 0x2a1f18, roughness: 0.6 }),
    gold: M({ color: 0xd8a840, metalness: 0.9, roughness: 0.25, emissive: hot(0xffc040, 0.6) }),
  });
  // an ember's vertex colour dims its glow too, so the coals aren't all alike
  mats.ember = emberGlow(mats.ember);
  // hair in ribbons is lit by the normals it was given, from either side
  for (const k of ['silverHair', 'hair']) mats[k] = hairBothSides(mats[k]);
  K.tex = { ...K.tex, ...tex };
  const rocks = [rockGeo(3), rockGeo(8), rockGeo(21)];
  return {
    ...kit,
    mats,
    ruin: (RUIN) => ruin(K, RUIN),
    rocks,
    camp: () => camp(K),
    trolls: () => trolls(K),
    athelas: () => athelas(K),
    weed: (seed) => weed(K, seed),
    deadTree: (seed) => deadTree(K, seed),
    pine: (seed) => pineGeo(seed),
    birch: (seed) => birchGeo(seed),
    fallenTree: (seed) => fallenTree(K, seed),
    torch: () => torch(K),
    asfaloth: () => asfaloth(K),
    floodHorse: (seed) => floodHorse(K, seed),
    gallop,
  };
}

