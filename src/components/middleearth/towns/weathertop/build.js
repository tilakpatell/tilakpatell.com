// Weathertop's builders, made in code (moved out of props.js, which keeps
// the flood's shaders and createWeathertopKit): the broken ring of Amon Sûl
// and the crags round it, the hobbits' camp in the dell, a burning brand,
// the old stone they're painted as, and the canvases the kit's materials
// are made from. The stone trolls, the plants and trees, and Asfaloth are in
// ./trollshaws.js. Free of GLSL, so a 'nodes' world (the Road) may build
// with them on materials of its own: each takes a kit K = { mats, tex } as
// createWeathertopKit makes one.
//
// The same conventions as the Shire's (../../shire/build.js): each builder's
// group stands on y = 0 at its origin, creatures face +x, and fixed parts
// are merged one mesh per material.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { ball, blob, boxUV, cylX, cylZ, lanternParts, lathe, parts, rng, roundBox, tf, tube } from '../../shire/build';

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

export { TAU, V3, C, noise3, weatheredCanvas, woolCanvas, haloCanvas, STONE, stonePaint, HEX_FACES, hexNormals, paintHull, boxCorners, placeCorners, hexBlock, chunkGeo, grassGeo, ruin, rockGeo, paintSmooth, camp, torch };
