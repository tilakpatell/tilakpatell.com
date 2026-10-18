// Amon Hen, made in code: the kit the seventh walkable town is built from.
// The Seat of Seeing on its round paved platform on the summit, the ruined
// stair up the hill, and the great stone kings of old fallen among the
// trees; broken columns, mossy boulders, ferns, tall pines and old beeches,
// fallen sticks and leaves; the camp on the lawn of Parth Galen, and the
// elven boats drawn up by the lake; the Uruk-hai and Lurtz, and the Horn of
// Gondor; and far off, the falls of Rauros, and the Eye on its tower.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are:
// its helpers, and its own materials for pale weathered stone gone green
// with moss, the forest, black iron, painted faces, water and fire. The
// same conventions: each builder's group stands on y = 0 at its origin,
// fronts face +z, figures, statues and boats face +x, and fixed parts are
// merged one mesh per material.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture } from '../../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { B, ball, blob, boxUV, createShireKit, cyl, cylX, lathe, parts, rng, roundBox, tf, tube } from '../../shire/props';
import { eyeMaterial, fallsMaterial, foamMaterial, mistMaterial, urukMaterial } from '../../nodes/towns/amonhen/propsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);
const UP = V3(0, 1, 0);

// Three dimensions of lumps from the two-dimensional noise.
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── small helpers ──

// A colour on every vertex, from fn(x, y, z, out, nx, ny, nz).
const _kc = new THREE.Color();
const _kd = new THREE.Color();
function tint(geo, fn) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _kc.setRGB(1, 1, 1);
    fn(p.getX(i), p.getY(i), p.getZ(i), _kc, nr.getX(i), nr.getY(i), nr.getZ(i));
    col[i * 3] = _kc.r;
    col[i * 3 + 1] = _kc.g;
    col[i * 3 + 2] = _kc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// One geometry, coloured in its vertices, from several, for instancing:
// unindexed, each part keeping its own normals; texture coordinates too
// when `uv` (for a textured material).
function oneGeo(list, { uv = false } = {}) {
  const keep = uv ? ['position', 'normal', 'color', 'uv'] : ['position', 'normal', 'color'];
  const out = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (uv && !g.attributes.uv) boxUV(g, 0.5);
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    return g;
  });
  const g = mergeGeometries(out, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// Values along a profile of rows [t, a, b, …] at t, by Catmull-Rom, so a
// handful of rows make a smooth outline (as Moria's).
function prof(rows, t) {
  const n = rows.length;
  if (t <= rows[0][0]) return rows[0].slice(1);
  if (t >= rows[n - 1][0]) return rows[n - 1].slice(1);
  let i = 0;
  while (t > rows[i + 1][0]) i++;
  const p0 = rows[Math.max(0, i - 1)];
  const p1 = rows[i];
  const p2 = rows[i + 1];
  const p3 = rows[Math.min(n - 1, i + 2)];
  const k = (t - p1[0]) / (p2[0] - p1[0]);
  const out = [];
  for (let c = 1; c < p1.length; c++) {
    const a = p0[c];
    const b = p1[c];
    const d = p2[c];
    const e = p3[c];
    out.push(0.5 * (2 * b + (-a + d) * k + (2 * a - 5 * b + 4 * d - e) * k * k + (-a + 3 * b - 3 * d + e) * k * k * k));
  }
  return out;
}

// A smooth body swept along a path through `points` (as Moria's): at each
// a section `rx` deep (to the front, square to the path and to `side`) and
// `rz` wide, round (sq 2) or squarer (sq more); a third number is the depth
// behind. The radii ease between the points, the ends are domed shut, and
// bump(p, out, u, v) may push a point out along `out`.
function sweep3(points, radii, { seg = 16, radial = 12, side = [0, 0, 1], sq = 2, bump = null, caps = [true, true] } = {}) {
  const P = points.map((p) => (p.isVector3 ? p.clone() : V3(...p)));
  const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  const n = P.length;
  const rows = radii.map((r, i) => [i / (n - 1), r[0], r[1], r[2] ?? r[0]]);
  const cs = [];
  for (let k = 0; k <= seg; k++) cs.push(curve.getPoint(k / seg));
  const W = radial + 1;
  const pos = [];
  const uv = [];
  const idx = [];
  const S = V3(...side).normalize();
  const T = V3();
  const F = V3();
  const Ts = [];
  let along = 0;
  const out = V3();
  for (let k = 0; k <= seg; k++) {
    T.subVectors(cs[Math.min(seg, k + 1)], cs[Math.max(0, k - 1)]).normalize();
    Ts.push(T.clone());
    S.addScaledVector(T, -S.dot(T));
    if (S.lengthSq() < 1e-8) S.set(0, 0, 1).addScaledVector(T, -T.z);
    S.normalize();
    F.crossVectors(T, S);
    if (k) along += cs[k].distanceTo(cs[k - 1]);
    const [rx, rz, rb] = prof(rows, k / seg);
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * TAU;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const ec = Math.sign(c) * Math.pow(Math.abs(c), 2 / sq);
      const es = Math.sign(s) * Math.pow(Math.abs(s), 2 / sq);
      const p = cs[k].clone().addScaledVector(F, ec * (c >= 0 ? rx : rb)).addScaledVector(S, es * rz);
      if (bump) {
        out.subVectors(p, cs[k]).normalize();
        p.addScaledVector(out, bump(p, out, j / radial, k / seg));
      }
      pos.push(p.x, p.y, p.z);
      uv.push(j / radial, along);
    }
  }
  for (let k = 0; k < seg; k++) {
    for (let j = 0; j < radial; j++) {
      const a = k * W + j;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  const cap = (k, dir) => {
    const [rx, rz] = prof(rows, k / seg);
    const c = cs[k].clone().addScaledVector(Ts[k], dir * Math.min(rx, rz) * 0.55);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z);
    uv.push(0.5, dir < 0 ? -0.1 : along + 0.1);
    for (let j = 0; j < radial; j++) {
      if (dir < 0) idx.push(ci, k * W + j, k * W + j + 1);
      else idx.push(ci, k * W + j + 1, k * W + j);
    }
  };
  if (caps[0]) cap(0, -1);
  if (caps[1]) cap(seg, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the seam round each ring: one normal for its two copies
  const nr = g.attributes.normal;
  for (let k = 0; k <= seg; k++) {
    const a = k * W;
    const b = k * W + radial;
    const v = V3(nr.getX(a) + nr.getX(b), nr.getY(a) + nr.getY(b), nr.getZ(a) + nr.getZ(b)).normalize();
    nr.setXYZ(a, v.x, v.y, v.z);
    nr.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

// A tapering rod from A to B.
function rod(A, Bv, r0, r1, radial = 6) {
  const a = A.isVector3 ? A : V3(...A);
  const b = Bv.isVector3 ? Bv : V3(...Bv);
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a.x, a.y, a.z);
}

const shapeOf = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const ext = (shape, depth, bevel = 0, curve = 6) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: curve });

// ── painted textures ──

// Old stone, nearly white so the vertex colours give its hue: a granular
// grain, shallow pits, hairline cracks, rain streaks, and crusts and rings
// of lichen. With its relief, for the normal map.
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
    const t = 0.8 + big * 0.2 + (grain - 0.5) * 0.12 - crack * 0.34 - pit * 0.12 - streak * 0.2;
    let r = 240 * t;
    let g = 238 * t;
    let b = 230 * t;
    // lichen: pale crusts in drifts, a few white rings, specks of black
    const drift = fbm(n, u * 3 + 11, v * 3 + 4, { period: 3, octaves: 2 });
    const l1 = smooth(0.6, 0.68, fbm(n, u * 6 + 3, v * 6 + 1, { period: 6, octaves: 4 }) + (drift - 0.5) * 0.4);
    const ring = q.id > 0.86 ? smooth(0.12, 0.2, q.f1) * (1 - smooth(0.24, 0.32, q.f1)) : 0;
    const l3 = smooth(0.76, 0.8, fbm(n, u * 32 + 2, v * 32 + 8, { period: 32, octaves: 2 }));
    r = mix(mix(mix(r, 226, l1 * 0.45), 250, ring * 0.45), 80, l3 * 0.3);
    g = mix(mix(mix(g, 226, l1 * 0.45), 250, ring * 0.45), 84, l3 * 0.3);
    b = mix(mix(mix(b, 196, l1 * 0.45), 242, ring * 0.45), 72, l3 * 0.3);
    out[0] = r;
    out[1] = g;
    out[2] = b;
  });
  return { c, field };
}

// Moss, close up: a felt of tiny fronds, pale so the vertex colours dye it,
// with the relief of its tufts.
function mossCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const k = cells(u * 14, v * 14, 14);
    const tuft = 1 - smooth(0.1, 0.62, k.f1);
    const fine = n(u * 96, v * 96, 96);
    const blot = fbm(n, u * 5, v * 5, { period: 5, octaves: 3 });
    const h = clamp01(tuft * 0.6 + fine * 0.3 + blot * 0.2);
    field[py * S + px] = h;
    const t = 0.62 + h * 0.42 + (k.id - 0.5) * 0.14;
    out[0] = 230 * t;
    out[1] = 240 * t;
    out[2] = 210 * t;
  });
  return { c, field };
}

// Wool, coarse and fulled, grey so a material's colour dyes it (a blanket,
// a pack): a weave, darker in the creases.
function woolCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const weave = Math.sin(u * S * 1.2) * Math.sin(v * S * 1.2) * 0.5 + 0.5;
    const blotch = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const fine = fbm(n, u * 48 + 3, v * 48, { period: 48, octaves: 2 });
    field[py * S + px] = weave * 0.25 + blotch * 0.5 + fine * 0.25;
    const k = 0.72 + blotch * 0.28 + fine * 0.1 - weave * 0.08;
    out[0] = 232 * k;
    out[1] = 230 * k;
    out[2] = 226 * k;
  });
  return { c, field };
}

// The grain of elven wood, pale grey, long and fine, for the boats.
function grainCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const wob = fbm(n, u * 2, v * 6, { period: 2, octaves: 3 }) * 2.5;
    const lines = Math.sin((v * 40 + wob) * TAU) * 0.5 + 0.5;
    const fine = n(u * 4, v * 160, 4);
    const h = lines * 0.6 + fine * 0.4;
    field[py * S + px] = h;
    const k = 0.86 + h * 0.12;
    out[0] = 236 * k;
    out[1] = 236 * k;
    out[2] = 230 * k;
  });
  return { c, field };
}

// A soft round puff, a little lumpy (mist, spray).
function puffCanvas(S = 64) {
  const n = makeNoise(23);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const lump = 0.7 + fbm(n, u * 4, v * 4, { octaves: 3 }) * 0.6;
    out[0] = out[1] = out[2] = 255;
    out[3] = 255 * clamp01(clamp01(1 - d) ** 1.5 * lump);
  });
  return c;
}

// ── stone ──

// The colours old stone weathers to under the trees.
const STONE = {
  base: C(0xa2a49e),
  grime: C(0x3a3c30),
  moss: C(0x4c6c1e),
  mossLit: C(0x86a634),
  damp: C(0x2e4216),
  lichen: C(0xc4c6a6),
  pale: C(0xdadbd0),
  streak: C(0x66665e),
};
const MOSS = { dark: C(0x203410), mid: C(0x4a6c1c), lit: C(0x9ab83a), gold: C(0xb8b44a) };

// A colour for a point of stone (in its model's frame) on a face turned
// `nrm`: the grey, rain streaks down what stands upright, grime in the
// joints (`edge`), moss on what faces up and low down where it's damp, and
// lichen in patches. Seeded once for a whole model, so the moss runs on
// from one block to the next.
function stonePaint(seed, { moss = 1, lichen = 1, damp = 1, base = STONE.base, vary = 0.12, ground = 0, streaks = 0.6, scale = 1 } = {}) {
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
function paintHull(geo, mains, paint, tintC) {
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
function paintSmooth(geo, paint, tintC = null) {
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
// The corners of a block of a ring, between angles a0 and a1, heights y0
// and y1, radii r0 and r1.
function ringCorners(a0, a1, y0, y1, r0, r1) {
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
function hexBlock(P, { chamfer = 0.045, chip = 0.22, seed = 1, jitter = 0.012, paint = null, tint: tintC = null, flatBottom = false } = {}) {
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
function chunkGeo(seed, s = 0.3, flat = 0.6, count = 10) {
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
function drumGeo(r, h, { flutes = 16, seed = 1, broken = 0, caps = [true, true] } = {}) {
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
function grassGeo(tufts, seed = 1) {
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
function mossGeo(r, seed = 1, { h = 0.32, detail = 1 } = {}) {
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
const LEAF_HUES = [C(0x6a4a24), C(0x8a6430), C(0xa88440), C(0x5a5a2a), C(0x7a6a34), C(0x4a3a20), C(0x8a8a3a)];
function fallenLeavesGeo(seed = 1, { count = 34, spread = 1.2, size = 1 } = {}) {
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

// ── the Seat of Seeing ──

// The White Tree in low relief on a flat face in the y-z plane (x = x0,
// facing +x), its trunk's foot at (y0, 0), `s` tall: a trunk, branches in
// pairs reaching up and out, a few roots, and seven stars over it.
function whiteTree(bk, mat, x0, y0, s, paint) {
  const add = (geo) => bk.add(mat, paintSmooth(geo, paint), { uv: 1.2 });
  const at = (y, z) => [x0, y0 + y * s, z * s];
  const d = 0.03 * s;
  add(tube([at(0, 0), at(0.35, 0), at(0.7, 0)], 0.045 * s, 0.022 * s, { seg: 4, radial: 5 }).translate(-0.02 * s, 0, 0));
  for (const [y, len, rise] of [[0.28, 0.32, 0.22], [0.42, 0.27, 0.2], [0.55, 0.2, 0.17], [0.65, 0.12, 0.12]]) {
    for (const sd of [-1, 1]) {
      add(tube([at(y, 0), at(y + rise * 0.45, sd * len * 0.55), at(y + rise, sd * len)], 0.02 * s, 0.009 * s, { seg: 3, radial: 4 }).translate(-0.02 * s, 0, 0));
    }
  }
  for (const sd of [-1, 0, 1]) add(tube([at(0, 0), at(-0.03, sd * 0.08), at(-0.06, sd * 0.16)], 0.025 * s, 0.01 * s, { seg: 2, radial: 4 }).translate(-0.02 * s, 0, 0));
  for (let i = 0; i < 7; i++) {
    const a = mix(-0.95, 0.95, i / 6);
    const st = new THREE.OctahedronGeometry(0.045 * s, 0);
    tf(st, { p: [x0 - d * 0.3, y0 + (0.86 + Math.cos(a) * 0.12) * s, Math.sin(a) * 0.36 * s], s: [0.45, 1, 1] });
    add(st);
  }
}

// The Seat of Seeing, on the summit of Amon Hen: a round platform of pale
// paving 9 m across, raised a metre on a drum of big curved blocks under a
// coping, with worn steps up its east (+x) side between broken cheek walls.
// In its middle on a dais a great carved throne, 3 m tall, facing west (-x)
// with its back to the steps: a deep seat, wide arms that end in scrolls,
// a high pointed back with the White Tree and its seven stars carved on it,
// and a post at each back corner. Four fluted columns stood round the rim;
// three still stand, broken off at different heights, and the fourth lies
// in its drums across the paving, its capital rolled off the edge. Moss
// and lichen over everything, grass in the joints, leaves blown in.
function seat(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'seatOfSeeing';
  const bk = parts();
  const rand = rng(31);
  const paint = stonePaint(11, { moss: 1.0, lichen: 1.0, damp: 1.0 });
  const R = 4.6;
  const TOP = 1.0;
  const tintOf = () => {
    const t = new THREE.Color(1, 1, 1);
    const k = rand();
    if (k < 0.3) t.setRGB(1.05, 1.02, 0.95);
    else if (k < 0.55) t.setRGB(0.93, 0.96, 1.0);
    else if (k < 0.65) t.setRGB(0.84, 0.84, 0.82);
    return t.multiplyScalar(0.93 + rand() * 0.14);
  };
  let seed = 1;
  const block = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint, tint: tintOf(), ...o }), { uv: 0.42 });
  const tufts = [];
  const moss = (x, y, z, r, o = {}) => bk.add(mats.moss, mossGeo(r, seed++, o), { p: [x, y, z], r: [0, rand() * TAU, 0], uv: 3 });

  // the core under the paving, dark and mossy where a flag has gone
  bk.add(mats.ruin, paintSmooth(cyl(3.62, 3.62, TOP - 0.13, 24).translate(0, (TOP - 0.13) / 2, 0), stonePaint(12, { moss: 1.5, base: C(0x5a5a50) })), { uv: 0.5 });
  // the drum: two courses of curved blocks, breaking joint, and a footing
  const gap = 0.012;
  const courses = [[0, 0.46, 15, 0], [0.46, 0.86, 15, 0.5]];
  for (const [y0, y1, count, off] of courses) {
    for (let i = 0; i < count; i++) {
      const a0 = ((i + off) / count) * TAU + gap;
      const a1 = ((i + 1 + off) / count) * TAU - gap;
      const sag = rand() < 0.2 ? rand() * 0.05 : 0;
      block(ringCorners(a0, a1, y0 - (y0 ? 0 : 0.2), y1 - sag, R - 1.0, R - 0.12), { chamfer: 0.05, flatBottom: !y0 });
    }
  }
  // the coping, overhanging a little, and the paving within it
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * TAU + gap * 0.8;
    const a1 = ((i + 1) / 18) * TAU - gap * 0.8;
    const lift = (rand() - 0.5) * 0.03;
    block(ringCorners(a0, a1, 0.86, TOP + lift, 3.48, R), { chamfer: 0.04 });
  }
  const rings = [[1.6, 2.58, 10, 0.3], [2.58, 3.48, 15, 0.1]];
  for (const [r0, r1, count, off] of rings) {
    for (let i = 0; i < count; i++) {
      const a0 = ((i + off) / count) * TAU + 0.014;
      const a1 = ((i + 1 + off) / count) * TAU - 0.014;
      if (r0 > 2 && (i === 4 || i === 11)) {
        // a flag gone: moss and grass in the hole
        const am = (a0 + a1) / 2;
        const rm = (r0 + r1) / 2;
        moss(Math.cos(am) * rm, TOP - 0.13, Math.sin(am) * rm, 0.45, { h: 0.45 });
        tufts.push({ x: Math.cos(am) * rm, y: TOP - 0.12, z: Math.sin(am) * rm, h: 0.32, n: 9, s: 0.3 });
        continue;
      }
      const sink = rand() < 0.3 ? rand() * 0.04 : 0;
      block(ringCorners(a0, a1, 0.86, TOP - sink, r0 + 0.01, r1 - 0.01), { chamfer: 0.025, chip: 0.3 });
      if (rand() < 0.45) {
        const a = mix(a0, a1, rand() > 0.5 ? 0.02 : 0.98);
        tufts.push({ x: Math.cos(a) * mix(r0, r1, rand()), y: TOP - sink, z: Math.sin(a) * mix(r0, r1, rand()), h: 0.16, n: 4, s: 0.05 });
      }
    }
  }
  bk.add(mats.ruin, paintSmooth(cyl(1.62, 1.62, 0.14, 20).translate(0, TOP - 0.07, 0), paint), { uv: 0.42 });

  // the steps up the east side, worn hollow, three stones to a step, and
  // the cheek walls either side
  const TREAD = 0.44;
  for (let k = 1; k <= 4; k++) {
    const x0 = R - 0.25 + (k - 1) * TREAD;
    const x1 = R + k * TREAD - (k === 1 ? 0.2 : 0);
    const yTop = TOP - 0.2 * k;
    const cuts = [-1.25, -0.42 + (rand() - 0.5) * 0.3, 0.44 + (rand() - 0.5) * 0.3, 1.25];
    for (let s = 0; s < 3; s++) {
      const wear = 0.02 + rand() * 0.04;
      const P = boxCorners(1, 1, 1).map((c) => V3(c.x < 0 ? x0 : x1, c.y < 0 ? -0.15 : yTop - (c.x > 0 ? wear : 0), c.z < 0 ? cuts[s] + 0.01 : cuts[s + 1] - 0.01));
      block(P, { chamfer: 0.05, chip: 0.4, flatBottom: true });
    }
    tufts.push({ x: x1 + 0.03, y: yTop - 0.2, z: (rand() - 0.5) * 2.2, h: 0.22, n: 6, s: 0.1 });
  }
  for (const sz of [-1, 1]) {
    const z0 = sz * 1.27;
    const z1 = sz * 1.72;
    const pieces = [[R - 0.4, R + 0.55, 1.15, 1.05], [R + 0.55, R + 1.25, 0.92, 0.6], [R + 1.25, R + 1.95, sz > 0 ? 0.42 : 0.55, 0.32]];
    for (const [xa, xb, ya, yb] of pieces) {
      const P = boxCorners(1, 1, 1).map((c) => V3(c.x < 0 ? xa + 0.01 : xb - 0.01, c.y < 0 ? -0.1 : c.x < 0 ? ya : yb, c.z < 0 ? Math.min(z0, z1) : Math.max(z0, z1)));
      block(P, { chamfer: 0.05, chip: 0.5, flatBottom: true });
    }
    moss(R + 0.2, 1.13, sz * 1.5, 0.3);
  }

  // the throne, built facing +x and turned to face west
  bk.at([0, TOP, 0], Math.PI, () => {
    const tp = stonePaint(13, { moss: 0.9, lichen: 1.1, damp: 0.4, base: C(0xb2afa4) });
    const tb = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint: tp, tint: tintOf(), ...o }), { uv: 0.42 });
    const box = (x0, x1, y0, y1, z0, z1, o) => tb(boxCorners(1, 1, 1).map((c) => V3(c.x < 0 ? x0 : x1, c.y < 0 ? y0 : y1, c.z < 0 ? z0 : z1)), o);
    // the dais and a step before it
    box(-1.45, 1.45, 0, 0.24, -1.4, 1.4, { chamfer: 0.04 });
    box(1.45, 1.95, 0, 0.12, -1.0, 1.0, { chamfer: 0.04, chip: 0.5 });
    // the seat, its front panelled
    box(-0.6, 0.55, 0.24, 0.78, -0.72, 0.72, { chamfer: 0.03 });
    box(0.55, 0.6, 0.32, 0.7, -0.6, -0.5, { chamfer: 0.01 });
    box(0.55, 0.6, 0.32, 0.7, 0.5, 0.6, { chamfer: 0.01 });
    box(0.55, 0.6, 0.32, 0.38, -0.5, 0.5, { chamfer: 0.01 });
    box(0.55, 0.6, 0.64, 0.7, -0.5, 0.5, { chamfer: 0.01 });
    // the arms, wide, capped, and ending in scrolls
    for (const sz of [-1, 1]) {
      box(-0.6, 0.5, 0.24, 1.28, sz * 0.72, sz * 1.22, { chamfer: 0.035 });
      box(-0.64, 0.56, 1.28, 1.38, sz * 0.68, sz * 1.27, { chamfer: 0.03 });
      const roll = cyl(0.2, 0.2, 0.52, 14).rotateX(Math.PI / 2).translate(0.56, 1.2, sz * 0.97);
      bk.add(mats.ruin, paintSmooth(roll, tp), { uv: 0.6 });
      // a spiral carved on its outer face
      const spiral = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU * 1.6;
        const rr = 0.16 * (1 - i / 19);
        spiral.push([0.56 + Math.cos(a) * rr, 1.2 + Math.sin(a) * rr, sz * 1.235]);
      }
      bk.add(mats.ruin, paintSmooth(tube(spiral, 0.016, 0.012, { seg: 16, radial: 4 }), tp), { uv: 0.6 });
      moss(-0.05, 1.38, sz * 0.98, 0.24, { h: 0.4 });
    }
    // the back: a slab shaped like a pointed arch, its face panelled and
    // carved, and posts at its corners
    const hw = 1.18;
    const outline = [[-hw, 0.24], [hw, 0.24], [hw, 2.2]];
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      outline.push([hw * Math.cos((t * Math.PI) / 2) ** 0.8, 2.2 + 0.8 * Math.sin((t * Math.PI) / 2) ** 1.3]);
    }
    for (let i = 7; i >= 1; i--) {
      const t = i / 8;
      outline.push([-hw * Math.cos((t * Math.PI) / 2) ** 0.8, 2.2 + 0.8 * Math.sin((t * Math.PI) / 2) ** 1.3]);
    }
    outline.push([-hw, 2.2]);
    const back = ext(shapeOf(outline), 0.32, 0.03).rotateY(-Math.PI / 2).translate(-0.6, 0, 0);
    bk.add(mats.ruin, paintSmooth(back, tp), { uv: 0.42 });
    // a raised frame round its face
    const frame = [];
    for (const [z, y] of outline) frame.push([-0.585, y + (y < 0.3 ? 0.62 : y > 2.2 ? -0.16 : 0), z * 0.84]);
    frame.push(frame[0]);
    bk.add(mats.ruin, paintSmooth(tube(frame.filter((p) => p[1] > 0.8), 0.035, 0.035, { seg: 40, radial: 4 }), tp), { uv: 0.6 });
    whiteTree(bk, mats.ruin, -0.56, 0.98, 1.65, tp);
    for (const sz of [-1, 1]) {
      const top = sz > 0 ? 3.05 : 2.6;
      box(-0.82, -0.52, 0.24, top, sz * 1.16, sz * 1.42, { chamfer: 0.03, chip: sz < 0 ? 0.9 : 0.2 });
      if (sz > 0) bk.add(mats.ruin, paintSmooth(new THREE.ConeGeometry(0.21, 0.38, 4).rotateY(Math.PI / 4).translate(-0.67, top + 0.19, sz * 1.29), tp), { uv: 0.6 });
      else moss(-0.67, top, sz * 1.29, 0.18, { h: 0.5 });
    }
    moss(-0.55, 0.78, 0.4, 0.22, { h: 0.3 });
    moss(-0.75, 2.95, 0.2, 0.2, { h: 0.5 });
    // moss creeping over the dais's edge
    for (let i = 0; i < 5; i++) moss(mix(-1.3, 1.3, rand()), 0.24, (rand() > 0.5 ? 1 : -1) * mix(1.0, 1.35, rand()), 0.18 + rand() * 0.14);
  });

  // the columns round the rim: three broken off standing, one fallen
  const cp = stonePaint(17, { moss: 1.1, lichen: 1.2, damp: 0.8, base: C(0xb0ada2) });
  const CR = 0.34;
  const column = (a, h) => {
    const x = Math.cos(a) * 3.95;
    const z = Math.sin(a) * 3.95;
    const tq = new THREE.Quaternion().setFromAxisAngle(UP, -a);
    const corner = (dx, dy, dz) => V3(dx, dy, dz).applyQuaternion(tq).add(V3(x, 0, z));
    const P = boxCorners(1, 1, 1).map((c) => corner(c.x * 0.94, c.y < 0 ? 0.9 : TOP + 0.3, c.z * 0.94));
    block(P, { chamfer: 0.04 });
    bk.add(mats.ruin, paintSmooth(lathe([[0.001, 0], [0.43, 0], [0.43, 0.06], [0.4, 0.1], [0.42, 0.15], [0.37, 0.2], [0.35, 0.24]], 24).translate(x, TOP + 0.3, z), cp), { uv: 0.6 });
    let y = TOP + 0.54;
    let left = h;
    let dn = 0;
    while (left > 0.05) {
      const dh = Math.min(left, 0.9 + rand() * 0.25);
      const last = left - dh < 0.3;
      const geo = drumGeo(CR, last ? left : dh, { seed: seed++, broken: last ? 0.35 : 0, caps: [dn === 0, true] });
      geo.rotateY(rand() * 0.2).translate(x + (rand() - 0.5) * 0.02, y, z + (rand() - 0.5) * 0.02);
      bk.add(mats.ruin, paintSmooth(geo, cp));
      y += (last ? left : dh) + 0.006;
      left -= last ? left : dh;
      dn++;
    }
    moss(x, y - 0.25, z, 0.26, { h: 0.55 });
    return V3(x, y, z);
  };
  column(0.7, 3.4);
  column(2.35, 1.8);
  column(3.95, 2.7);
  // the fallen one: a stump, its drums lying across the flags and one on
  // the grass below, and its capital rolled off the edge
  const fa = 5.25;
  column(fa, 0.55);
  const dir = V3(Math.cos(fa + 2.25), 0, Math.sin(fa + 2.25));
  const from = V3(Math.cos(fa) * 3.95, 0, Math.sin(fa) * 3.95);
  [[0.85, TOP], [1.85, TOP], [3.3, TOP]].forEach(([d, base], i) => {
    const p = from.clone().addScaledVector(dir, d);
    const roll = (rand() - 0.5) * 0.5;
    const geo = drumGeo(CR, 0.88, { seed: seed++, broken: i === 2 ? 0.25 : 0 });
    geo.translate(0, -0.44, 0).rotateZ(Math.PI / 2).rotateY(-Math.atan2(dir.z, dir.x) + roll).translate(p.x, base + CR - 0.02, p.z);
    bk.add(mats.ruin, paintSmooth(geo, cp));
    tufts.push({ x: p.x, y: base, z: p.z + 0.35, h: 0.2, n: 5, s: 0.2 });
  });
  {
    const out = V3(Math.cos(fa + 0.5) * (R + 1.0), 0, Math.sin(fa + 0.5) * (R + 1.0));
    bk.at([out.x, 0, out.z], rand() * TAU, () => {
      const cap = lathe([[0.001, 0], [0.32, 0], [0.33, 0.05], [0.42, 0.15], [0.55, 0.24], [0.56, 0.28], [0.001, 0.28]], 20);
      tf(cap, { r: [0.4, 0, 0.35], p: [0, 0.08, 0] });
      bk.add(mats.ruin, paintSmooth(cap, cp), { uv: 0.6 });
      const ab = hexBlock(placeCorners(boxCorners(1.2, 0.22, 1.2), { p: [0.1, 0.32, 0.12], r: [0.4, 0.3, 0.35] }), { seed: seed++, paint: cp, chip: 0.6, chamfer: 0.05 });
      bk.add(mats.ruin, ab, { uv: 0.42 });
    });
    tufts.push({ x: out.x + 0.5, y: 0, z: out.z, h: 0.4, n: 10, s: 0.4 });
  }

  // grass round the foot of the drum, moss on its coping
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * TAU + rand() * 0.1;
    if (Math.abs(((a + Math.PI) % TAU) - Math.PI) < 0.32) continue;
    const rr = R + 0.05 + rand() * 0.6;
    tufts.push({ x: Math.cos(a) * rr, y: 0, z: Math.sin(a) * rr, h: 0.3 + rand() * 0.3, n: 8, s: 0.25 });
  }
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    if (Math.abs(((a + Math.PI) % TAU) - Math.PI) < 0.35) continue;
    moss(Math.cos(a) * (R - 0.35), TOP - 0.01, Math.sin(a) * (R - 0.35), 0.2 + rand() * 0.3, { h: 0.3 });
  }
  bk.add(mats.grass, grassGeo(tufts, 7));
  for (let i = 0; i < 5; i++) {
    const a = rand() * TAU;
    const rr = 1.8 + rand() * 1.4;
    bk.add(mats.leaves, fallenLeavesGeo(40 + i, { count: 22, spread: 0.7 }), { p: [Math.cos(a) * rr, TOP, Math.sin(a) * rr] });
  }
  bk.build(g);
  return { group: g, sit: V3(0.12, TOP + 0.78, 0), stepsAt: V3(R + 4 * TREAD + 0.35, 0, 0), radius: R, top: TOP };
}

// ── the ruined stair ──

// An old stone stair laid up the hillside along +x, rising `rise` over
// `len`, `w` wide, its foot at the origin and its top at (len, rise, 0):
// the treads two or three stones across, worn, tilted, cracked, sunk, and
// here and there gone, grass and moss in the gaps; a low wall each side,
// broken down to a few courses and in places to nothing. Each step's stones
// go down well below it, so the stair can be set into a slope.
function ruinStair(K, { len = 14, w = 2.4, rise = 6 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'ruinStair';
  const bk = parts();
  const rand = rng(Math.round(len * 13 + rise * 7 + w * 3));
  const paint = stonePaint(19, { moss: 1.1, damp: 0.6 });
  const n = Math.max(3, Math.round(rise / 0.21));
  const tread = len / n;
  const step = rise / n;
  const slope = (x) => (rise * x) / len;
  const tufts = [];
  let seed = 100;
  const tintOf = () => new THREE.Color(1, 1, 1).multiplyScalar(0.9 + rand() * 0.18);
  const block = (P, o = {}) => bk.add(mats.ruin, hexBlock(P, { seed: seed++, paint, tint: tintOf(), ...o }), { uv: 0.42 });
  const hw = w / 2;
  for (let i = 0; i < n; i++) {
    const x0 = i * tread;
    const x1 = (i + 1) * tread + 0.04;
    const top = (i + 1) * step;
    const bottom = top - step - 0.45;
    const count = rand() < 0.5 ? 2 : 3;
    const cuts = [-hw];
    for (let k = 1; k < count; k++) cuts.push(mix(-hw, hw, k / count) + (rand() - 0.5) * 0.3);
    cuts.push(hw);
    for (let k = 0; k < count; k++) {
      const z0 = cuts[k] + 0.015;
      const z1 = cuts[k + 1] - 0.015;
      const roll = rand();
      if (roll < 0.07 && i > 0 && i < n - 1) {
        // gone: the earth under it, grass and moss
        tufts.push({ x: (x0 + x1) / 2, y: top - step * 0.9, z: (z0 + z1) / 2, h: 0.3, n: 9, s: 0.25 });
        bk.add(mats.moss, mossGeo(0.32, seed++, { h: 0.4 }), { p: [(x0 + x1) / 2, top - step - 0.02, (z0 + z1) / 2], uv: 3 });
        continue;
      }
      const wear = 0.02 + rand() * 0.05;
      const sink = roll < 0.2 ? rand() * 0.06 : 0;
      const tilt = roll > 0.85 ? (rand() - 0.5) * 0.12 : 0;
      const P = boxCorners(1, 1, 1).map((c) => {
        const x = c.x < 0 ? x0 : x1;
        const z = c.z < 0 ? z0 : z1;
        const y = c.y < 0 ? bottom : top - sink - (c.x > 0 ? wear : 0) + tilt * (z - (z0 + z1) / 2);
        return V3(x, y, z);
      });
      block(P, { chamfer: 0.04 + rand() * 0.03, chip: 0.45, flatBottom: true });
      if (rand() < 0.35) tufts.push({ x: x1 - 0.02, y: top - step, z: mix(z0, z1, rand()), h: 0.2, n: 4, s: 0.06 });
    }
    if (rand() < 0.5) tufts.push({ x: x0 + 0.05, y: top, z: (rand() > 0.5 ? 1 : -1) * (hw - 0.08), h: 0.25, n: 6, s: 0.08 });
  }
  // the side walls: blocks along the slope, broken down unevenly
  for (const sz of [-1, 1]) {
    const z0 = sz * (hw + 0.02);
    const z1 = sz * (hw + 0.44);
    let x = -0.3;
    while (x < len + 0.2) {
      const l = 0.9 + rand() * 0.6;
      const xb = Math.min(len + 0.4, x + l);
      const kind = rand();
      if (kind < 0.12) {
        // a gap where the wall has gone, a stone fallen out of it
        const fp = placeCorners(boxCorners(0.6, 0.3, 0.42), { p: [(x + xb) / 2, slope((x + xb) / 2) + 0.05, z1 + sz * 0.35], r: [rand() * 0.4, rand(), 0.2] });
        block(fp, { chamfer: 0.05, chip: 0.6 });
        x = xb;
        continue;
      }
      const ha = kind < 0.4 ? 0.2 + rand() * 0.2 : 0.45 + rand() * 0.5;
      const hb = Math.max(0.12, ha + (rand() - 0.5) * 0.35);
      const ya = slope(x);
      const yb = slope(xb);
      const P = boxCorners(1, 1, 1).map((c) => {
        const xx = c.x < 0 ? x + 0.012 : xb - 0.012;
        const base = c.x < 0 ? ya : yb;
        const y = c.y < 0 ? base - 0.6 : base + (c.x < 0 ? ha : hb);
        return V3(xx, y, c.z < 0 ? Math.min(z0, z1) : Math.max(z0, z1));
      });
      block(P, { chamfer: 0.05, chip: 0.5 });
      if (rand() < 0.4) bk.add(mats.moss, mossGeo(0.22 + rand() * 0.1, seed++, { h: 0.4 }), { p: [(x + xb) / 2, (ya + yb) / 2 + (ha + hb) / 2, (z0 + z1) / 2], uv: 3 });
      if (rand() < 0.6) tufts.push({ x: xb, y: yb, z: z1 + sz * 0.05, h: 0.35, n: 8, s: 0.15 });
      x = xb;
    }
  }
  bk.add(mats.grass, grassGeo(tufts, 3));
  bk.build(g);
  return { group: g, top: V3(len, rise, 0), steps: n };
}

// ── the kings of old ──

// Angles from `from` to `to`, closer together (`fine`) about `centre` and
// further apart (`coarse`) away from it: a head's rows and columns, so the
// face has room for its features without the back of the skull costing much.
function spaced(from, to, fine, coarse, centre, width) {
  const out = [from];
  let a = from;
  while (a < to - 1e-4) {
    const k = Math.exp(-(((a - centre) / width) ** 2));
    a = Math.min(to, a + mix(coarse, fine, k));
    if (to - a < fine * 0.4) a = to;
    out.push(a);
  }
  return out;
}
const gauss = (dx, dy, rx, ry) => Math.exp(-((dx / rx) ** 2 + (dy / ry) ** 2));

// A head, about 1 tall from the chin (y = -0.5) to the crown (+0.5), its
// face looking along +z: a ball shaped into skull and jaw, then the
// features pushed out and in over the face: brows, sockets and eyes, a
// nose, lips, chin, cheekbones, and a beard in carved locks. `F` sizes them;
// `snarl` opens the mouth. `fine` and `coarse` space the mesh's rows.
function headGeo(F = {}, { fine = 0.045, coarse = 0.22 } = {}) {
  const f = { width: 0.36, depth: 0.44, jaw: 0.8, brow: 0.035, socket: 0.05, eye: 0.03, nose: 0.1, noseW: 0.034, noseFlat: 1, lips: 0.024, mouthW: 0.08, chin: 0.045, cheek: 0.03, beard: 0, beardLen: 0, locks: 26, snarl: 0, ...F };
  const thetas = spaced(-Math.PI, Math.PI, fine, coarse, 0, 0.95);
  const phis = spaced(-Math.PI / 2, Math.PI / 2, fine, coarse, -0.3, 0.8);
  const nu = thetas.length;
  const pos = [];
  const idx = [];
  for (const ph of phis) {
    for (const th of thetas) {
      const dx = Math.cos(ph) * Math.sin(th);
      const dy = Math.sin(ph);
      const dz = Math.cos(ph) * Math.cos(th);
      let X = dx * f.width;
      let Y = dy * 0.5;
      let Z = dz > 0 ? f.depth * Math.pow(dz, 0.72) : dz * f.depth * 1.06;
      // the jaw narrows under the cheekbones, and the back of the neck
      // comes in under the skull
      X *= mix(1, f.jaw, smooth(-0.04, -0.46, Y));
      if (dz < 0) Z *= mix(1, 0.68, smooth(-0.08, -0.46, Y));
      const front = smooth(0.12, 0.6, dz);
      const fx = X;
      const fy = Y;
      const ax = Math.abs(fx);
      let d = 0;
      d += f.brow * gauss(ax - 0.12, fy - 0.085, 0.1, 0.032) + f.brow * 0.6 * gauss(fx, fy - 0.07, 0.06, 0.03);
      d -= f.socket * gauss(ax - 0.115, fy - 0.022, 0.078, 0.046);
      d += f.eye * gauss(ax - 0.115, fy - 0.016, 0.046, 0.028);
      const nt = clamp01((0.065 - fy) / 0.19);
      d += f.nose * (0.28 + 0.72 * Math.pow(nt, 1.4)) * gauss(fx, 0, f.noseW * f.noseFlat * (0.8 + 0.7 * nt), 1) * smooth(0.08, 0.045, fy) * smooth(-0.165, -0.128, fy);
      d += f.nose * 0.36 * gauss(ax - 0.046 * f.noseFlat, fy + 0.127, 0.032 * f.noseFlat, 0.026);
      d += f.lips * gauss(fx, fy + 0.19, f.mouthW, 0.022);
      d -= f.lips * (0.9 + f.snarl * 2.5) * gauss(fx, fy + 0.214, f.mouthW * (1.05 + f.snarl * 0.2), 0.012 + f.snarl * 0.022);
      d += f.lips * 1.15 * gauss(fx, fy + 0.242 + f.snarl * 0.02, f.mouthW * 0.86, 0.022);
      d += f.chin * gauss(fx, fy + 0.34, 0.085, 0.065);
      d += f.cheek * gauss(ax - 0.17, fy + 0.03, 0.075, 0.055);
      d -= f.cheek * 0.5 * gauss(ax - 0.16, fy + 0.17, 0.065, 0.06);
      Z += d * front;
      if (f.beard) {
        // a beard: the lower face built out in locks, a moustache over the
        // lip, and the whole carried down below the chin
        const lipsK = gauss(fx, fy + 0.222, 0.085, 0.04);
        const m = smooth(-0.09, -0.21, Y) * smooth(-0.35, 0.05, dz) * (1 - lipsK * front);
        const lock = 1 + 0.28 * Math.sin(Math.atan2(X, Z) * f.locks + Y * 6) * smooth(-0.15, -0.3, Y);
        const push = f.beard * m * lock;
        const rr = Math.hypot(X, Z) || 1;
        X += (X / rr) * push;
        Z += (Z / rr) * push;
        Z += f.beard * 0.9 * (gauss(ax - 0.055, fy + 0.172, 0.055, 0.02) + 0.7 * gauss(ax - 0.1, fy + 0.205, 0.04, 0.03)) * front;
        const down = smooth(-0.28, -0.5, Y) * smooth(-0.25, 0.35, dz);
        Y -= f.beardLen * down;
        Z += f.beardLen * 0.35 * down;
      }
      pos.push(X, Y, Z);
    }
  }
  for (let j = 0; j < phis.length - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i;
      idx.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A crack scored across a head's face: points near the jagged line (in the
// face's x, y) pushed in. Returns how far into the crack each vertex is, to
// darken it once painted.
function scoreCrack(geo, seed, { width = 0.016, depth = 0.025 } = {}) {
  const r = rng(seed);
  const line = [];
  let x = -0.36;
  let y = 0.18 + r() * 0.1;
  while (x < 0.38) {
    line.push([x, y]);
    x += 0.05 + r() * 0.05;
    y -= 0.03 + (r() - 0.35) * 0.08;
  }
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const w = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 0.05) continue;
    const px = p.getX(i);
    const py = p.getY(i);
    let best = 9;
    for (let k = 0; k < line.length - 1; k++) {
      const [ax, ay] = line[k];
      const [bx, by] = line[k + 1];
      const t = clamp01(((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2));
      best = Math.min(best, Math.hypot(px - ax - (bx - ax) * t, py - ay - (by - ay) * t));
    }
    const k = 1 - smooth(width * 0.3, width * 2.2, best);
    if (k <= 0) continue;
    w[i] = k;
    const s = depth * (1 - smooth(0, width * 1.6, best));
    p.setXYZ(i, px - nr.getX(i) * s, py - nr.getY(i) * s, p.getZ(i) - nr.getZ(i) * s);
  }
  geo.computeVertexNormals();
  return w;
}

// The crowned helm of the kings of Gondor, in a head's frame (headGeo): a
// tall peaked cap down over the temples and the nape, a band round its rim
// with a white star on the brow, and a seabird's wing swept up at each side.
function helmGeos(seed = 1) {
  const out = [];
  const cap = lathe([[0.395, 0.12], [0.405, 0.2], [0.4, 0.3], [0.365, 0.42], [0.3, 0.56], [0.2, 0.7], [0.1, 0.83], [0.035, 0.92], [0.001, 0.95]], 44);
  const p = cap.attributes.position;
  const rim = [];
  const dropAt = (a) => 0.36 * smooth(0.5, 1.15, a) + 0.1 * smooth(1.6, 2.6, a);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i) * 1.2;
    const a = Math.abs(Math.atan2(x, z));
    const drop = dropAt(a);
    const ny = y - drop * (1 - smooth(0.12, 0.5, y));
    // a ridge along the top, front to back
    const ridge = 0.03 * gauss(x, 0, 0.05, 1) * smooth(0.2, 0.6, y);
    p.setXYZ(i, x, ny + ridge * 0.5, z * (1 + ridge * 2));
  }
  cap.computeVertexNormals();
  out.push(cap);
  // the band round its rim
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * TAU;
    rim.push([Math.sin(a) * 0.41, 0.15 - dropAt(Math.abs(((a + Math.PI) % TAU) - Math.PI)), Math.cos(a) * 0.41 * 1.2]);
  }
  out.push(tube(rim, 0.032, 0.032, { seg: 72, radial: 5 }));
  out.push(tf(new THREE.OctahedronGeometry(0.06, 0), { p: [0, 0.2, 0.5], s: [0.9, 1.25, 0.6] }));
  // the wings, each a feathered blade lying along the side of the cap
  const wing = [[0.0, 0.0], [0.03, 0.14], [0.02, 0.3], [-0.04, 0.44], [-0.14, 0.58], [-0.28, 0.68], [-0.25, 0.56], [-0.34, 0.58], [-0.29, 0.46], [-0.37, 0.46], [-0.3, 0.34], [-0.36, 0.32], [-0.27, 0.22], [-0.3, 0.17], [-0.2, 0.1], [-0.18, 0.0]];
  for (const sd of [-1, 1]) {
    const geo = ext(shapeOf(wing), 0.03, 0.012).translate(0, 0, -0.015);
    // the shape's x runs back along the side, its y up
    geo.rotateY(sd * (-Math.PI / 2) + sd * 0.0);
    geo.rotateZ(sd * -0.12);
    if (sd < 0) geo.rotateY(Math.PI);
    out.push(tf(geo, { p: [sd * 0.43, 0.08, 0.12], r: [0, sd * 0.18, 0] }));
  }
  void seed;
  return out;
}

// A hand in its own frame: the wrist at the origin, the fingers up +y, the
// palm facing +z and the thumb to -x (a right hand; mirror x for a left),
// the palm about 1 long. `curl` closes it from 0 open to 1 a fist; `lost`
// lists fingers (0 the forefinger to 3 the little finger) broken off short.
function handGeos({ curl = 0, spread = 0.1, lost = [], thumb = 0.5 } = {}) {
  const out = [];
  out.push(tf(roundBox(0.92, 1.0, 0.38, 0.14), { p: [0, 0.5, 0] }));
  const lens = [[0.48, 0.3, 0.24], [0.54, 0.34, 0.26], [0.5, 0.32, 0.24], [0.38, 0.24, 0.2]];
  const base = [-0.33, -0.11, 0.11, 0.33];
  lens.forEach((L, i) => {
    const pts = [[base[i] * 1.0, 0.96, 0]];
    let ang = (i - 1.5) * spread;
    let bend = 0;
    let x = base[i];
    let y = 0.96;
    let z = 0;
    const segs = lost.includes(i) ? 1 : 3;
    for (let s = 0; s < segs; s++) {
      bend += curl * (s === 0 ? 1.2 : 1.45);
      const l = L[s];
      x += Math.sin(ang) * l * Math.cos(bend);
      y += Math.cos(ang) * l * Math.cos(bend);
      z += l * Math.sin(bend);
      pts.push([x, y, z]);
      ang *= 0.6;
    }
    out.push(tube(pts, i === 3 ? 0.1 : 0.12, i === 3 ? 0.085 : 0.095, { seg: segs * 2, radial: 6 }));
    const end = pts[pts.length - 1];
    out.push(tf(ball(i === 3 ? 0.085 : 0.095, 6, 4), { p: end }));
  });
  // the thumb, from the heel of the palm out and up
  const tb = [[-0.36, 0.25, 0.08], [-0.6, 0.5, 0.15 + thumb * 0.15], [-0.66 + thumb * 0.2, 0.78, 0.2 + thumb * 0.3], [-0.6 + thumb * 0.35, 0.98, 0.25 + thumb * 0.45]];
  out.push(tube(tb, 0.16, 0.11, { seg: 6, radial: 6 }));
  out.push(tf(ball(0.11, 6, 4), { p: tb[3] }));
  return out;
}

// A robe as a lathe about y from rows [r, y] (the hem first): elliptical
// (x deeper or shallower than z by `depth`), falling in `folds` folds that
// deepen towards the hem, its hem a little uneven. `phi` limits it to an
// arc (a cloak behind); `inner` adds the inside face for an open one.
function robeGeo(rows, { depth = 0.72, folds = 9, amp = 0.07, phi = [0, TAU], seg = 40, hem = 0.04, top = null, seed = 1, inner = false } = {}) {
  const n = makeNoise(seed);
  const y0 = rows[0][1];
  const y1 = top ?? rows[rows.length - 1][1];
  const geo = lathe(rows, seg, phi[0], phi[1]);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(x, z);
    const low = 1 - smooth(y0, y1, y);
    const fold = Math.sin(a * folds + Math.sin(a * 3 + seed) * 0.8 + n(a * 2, 1) * 2) * amp * (0.25 + low);
    const k = 1 + fold;
    const dy = low > 0.97 ? Math.sin(a * folds * 0.5 + seed) * hem + (n(a * 4, 3) - 0.5) * hem : 0;
    p.setXYZ(i, x * k * depth, y + dy, z * k);
  }
  geo.computeVertexNormals();
  if (!inner) return geo;
  const back = geo.clone();
  const bp = back.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setXYZ(i, bp.getX(i) * 0.96, bp.getY(i), bp.getZ(i) * 0.96);
  const ix = back.index.array;
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1];
    ix[i + 1] = ix[i + 2];
    ix[i + 2] = t;
  }
  back.computeVertexNormals();
  return mergeGeometries([geo.toNonIndexed(), back.toNonIndexed()]);
}

// A frame for a part of a figure: placed at p, turned by r (Euler, or a
// quaternion), scaled by s.
const frame = (p = [0, 0, 0], r = [0, 0, 0], s = 1) =>
  new THREE.Matrix4().compose(V3(...p), r.isQuaternion ? r : new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), typeof s === 'number' ? V3(s, s, s) : V3(...s));
// The turn that takes a hand's frame (fingers +y, palm +z) to fingers along
// `fing` and the palm facing `palm` (both roughly square to each other).
function handTurn(fing, palm) {
  const y = V3(...fing).normalize();
  const z = V3(...palm);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = V3().crossVectors(y, z);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

// A king's head in its helm, the face to +x: placed by `m` (its middle at
// the origin, about 1 tall from chin to crown before m scales it).
function kingHead(add, m, { seed = 1, crack = false, fine = 0.045, coarse = 0.22 } = {}) {
  const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const head = headGeo({ beard: 0.055, beardLen: 0.14, nose: 0.11, brow: 0.04 }, { fine, coarse });
  const cw = crack ? scoreCrack(head, seed + 3) : null;
  add(head.applyMatrix4(turn).applyMatrix4(m), cw);
  for (const g of helmGeos(seed)) add(g.applyMatrix4(turn).applyMatrix4(m));
}

// The great statues of the kings of old in the woods of Amon Hen, pale
// stone streaked with rain, green with moss on everything that faces the
// sky, lichen over the rest, ferns at their feet. Each faces +x, his right
// hand to +z, standing on y = 0. `kind`:
// - 'head': a giant fallen head, about 4 m, lying on his cheek half sunk in
//   the earth: a crowned helm with its wing swept up, a stern bearded face,
//   a crack across it, moss over the upturned side.
// - 'seated': a broken king about 7 m tall on his throne, on a plinth: his
//   right hand on his knee, his left arm gone at the shoulder and lying on
//   the ground by the plinth, his head bowed, moss and ferns in his lap.
// - 'standing': a king about 8 m tall on his plinth, his left hand raised
//   palm out in warning (two of its fingers broken), his right on the
//   pommel of a long sword whose point rests between his feet; a long robe
//   and a cloak to the ground.
function king(K, { kind = 'standing', seed = 1 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = `king-${kind}`;
  const bk = parts();
  const rand = rng(seed * 41 + kind.length);
  const paint = stonePaint(seed * 7 + 70, { moss: 1.25, lichen: 1.2, damp: 1.0, base: C(0xaaaba4), vary: 0.14, scale: 1.3 });
  // a part, already where it goes: painted (moss lands on what faces up),
  // darkened in its cracks
  const add = (geo, crack = null) => {
    if (!geo.attributes.normal) geo.computeVertexNormals();
    paintSmooth(geo, paint);
    if (crack) {
      const c = geo.attributes.color;
      for (let i = 0; i < c.count; i++) {
        const k = 1 - crack[i] * 0.78;
        c.setXYZ(i, c.getX(i) * k, c.getY(i) * k, c.getZ(i) * k);
      }
    }
    bk.add(mats.statue, geo, { uv: 0.45 });
  };
  const addHull = (geo) => bk.add(mats.statue, paintHull(geo, [], paint), { uv: 0.45 });
  let sd = 300 + seed * 50;
  const moss = (x, y, z, r, h = 0.35) => bk.add(mats.moss, mossGeo(r, sd++, { h, detail: r > 0.4 ? 2 : 1 }), { p: [x, y, z], r: [0, rand() * TAU, 0], uv: 3 });
  const block = (P, o = {}) => bk.add(mats.statue, hexBlock(P, { seed: sd++, paint, chamfer: 0.08, chip: 0.5, ...o }), { uv: 0.45 });
  const tufts = [];
  const ferns = [];
  const plinth = (w, d, h1, h2) => {
    block(placeCorners(boxCorners(w, h1 + 0.3, d), { p: [0, (h1 - 0.3) / 2, 0] }), { flatBottom: true });
    block(placeCorners(boxCorners(w - 0.5, h2, d - 0.5), { p: [0, h1 + h2 / 2, 0] }));
    for (let i = 0; i < 18; i++) {
      const a = rand() * TAU;
      const rr = Math.max(w, d) * (0.55 + rand() * 0.2);
      tufts.push({ x: Math.cos(a) * rr, y: 0, z: Math.sin(a) * rr, h: 0.4 + rand() * 0.3, n: 9, s: 0.3 });
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.5 + rand() * 0.6;
      ferns.push([Math.cos(a) * w * 0.62, 0, Math.sin(a) * d * 0.62, rand() * TAU, 1 + rand() * 0.4]);
    }
    return h1 + h2;
  };

  if (kind === 'bust') {
    kingHead(add, frame([0, 1.5, 0], [0, 0, 0], 1), { seed, crack: false, fine: 0.04, coarse: 0.2 });
  } else if (kind === 'head') {
    // about 2.6 m to the head's unit: 4 m from beard to the helm's peak
    const U = 2.6;
    const m = frame([0, 0.55, 0], [0.12, 0.25, 1.38], U);
    kingHead(add, m, { seed, crack: true, fine: 0.04, coarse: 0.2 });
    // the earth heaped round where it sank, and broken stone
    const ne = makeNoise(seed + 5);
    bk.add(mats.earth, blob(1, { detail: 3, amp: 0.25, freq: 2, seed: seed + 8 }), {
      p: [0.1, -0.05, 0.2],
      s: [2.4, 0.45, 2.1],
      color: (x, y, z, out) => out.setRGB(0.2, 0.15, 0.09).lerp(MOSS.mid, smooth(0.15, 0.3, y) * 0.8).multiplyScalar(0.6 + ne(x * 2, z * 2) * 0.6),
    });
    for (let i = 0; i < 7; i++) {
      const a = rand() * TAU;
      const rr = 2.4 + rand() * 1.4;
      const geo = chunkGeo(sd++, 0.25 + rand() * 0.35, 0.6);
      tf(geo, { p: [Math.cos(a) * rr, 0.08, Math.sin(a) * rr], r: [rand(), rand() * 3, rand()] });
      addHull(geo);
    }
    moss(0.2, 1.62, -0.6, 0.7, 0.4);
    moss(-0.9, 1.25, 0.6, 0.55, 0.4);
    moss(1.3, 0.55, 1.6, 0.45, 0.5);
    for (let i = 0; i < 26; i++) {
      const a = rand() * TAU;
      const rr = 1.9 + rand() * 1.2;
      tufts.push({ x: Math.cos(a) * rr * 1.1, y: 0, z: Math.sin(a) * rr, h: 0.35 + rand() * 0.3, n: 9, s: 0.3 });
    }
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + rand();
      ferns.push([Math.cos(a) * 2.6, 0, Math.sin(a) * 2.4, rand() * TAU, 1 + rand() * 0.5]);
    }
  } else if (kind === 'seated') {
    const U = 0.86;
    const top = plinth(3.9, 3.3, 0.5, 0.42);
    // the figure in U, from the plinth's top, under the pelvis
    const P = (x, y, z) => [x * U, top + y * U, z * U];
    const at = (o = {}) => frame(o.p ? P(...o.p) : P(0, 0, 0), o.r || [0, 0, 0], o.s ?? U);
    // the throne: a deep seat block and a high back, carved down its sides
    block(boxCorners(1, 1, 1).map((c) => V3(...P(c.x < 0 ? -1.55 : 0.55, c.y < 0 ? -0.2 : 2.05, c.z * 2.6))));
    const backShape = shapeOf([[-1.3, 0], [1.3, 0], [1.3, 4.6], [1.0, 5.3], [0.4, 5.6], [-0.4, 5.6], [-1.0, 5.3], [-1.3, 4.6]]);
    add(ext(backShape, 0.5, 0.06, 4).rotateY(-Math.PI / 2).scale(U, U, U).translate(-1.15 * U, top, 0));
    for (const s of [-1, 1]) add(tube([P(-1.2, 0.3, s * 1.32), P(-1.2, 3.8, s * 1.32)], 0.12 * U, 0.12 * U, { seg: 2, radial: 6 }));
    // the lap under the robe, and the robe falling from the knees
    const lapBump = (p, o, u, v) => (Math.sin(u * TAU * 3 + v * 2) * 0.04 + (u > 0.1 && u < 0.4 ? 0.06 : 0)) * U * smooth(0.2, 0.6, v);
    add(sweep3([P(-0.6, 2.35, 0), P(0.5, 2.38, 0), P(1.5, 2.4, 0), P(1.95, 2.3, 0)], [[0.62, 1.08], [0.58, 1.06], [0.52, 1.02], [0.45, 0.98]], { seg: 10, radial: 16, side: [0, 0, 1], sq: 2.6, bump: lapBump }));
    add(sweep3([P(1.95, 2.45, 0), P(2.08, 1.3, 0), P(2.18, 0.12, 0)], [[0.42, 1.0], [0.44, 1.06], [0.5, 1.14]], { seg: 10, radial: 16, side: [0, 0, 1], sq: 2.4, bump: (p, o, u) => Math.sin(u * TAU * 5) * 0.05 * U }));
    // the feet, out from under the hem
    for (const s of [-1, 1]) add(sweep3([P(2.1, 0.18, s * 0.5), P(2.5, 0.14, s * 0.55), P(2.85, 0.1, s * 0.58)], [[0.18, 0.24], [0.16, 0.24], [0.1, 0.2]], { seg: 5, radial: 8, side: [0, 0, 1] }));
    // the body, his chest and shoulders, a short mantle over them
    add(robeGeo([[0.9, 2.1], [0.84, 2.7], [0.88, 3.4], [0.98, 4.1], [0.95, 4.6], [0.7, 4.95], [0.3, 5.12], [0.001, 5.14]], { depth: 0.66, folds: 7, amp: 0.025, seed: 3 }).scale(U, U, U).translate(...P(-0.55, 0, 0)));
    add(robeGeo([[1.12, 3.95], [1.08, 4.4], [0.94, 4.85], [0.62, 5.06], [0.001, 5.1]], { depth: 0.7, folds: 11, amp: 0.05, seed: 4, phi: [Math.PI * 0.7, Math.PI * 1.6] }).scale(U, U, U).translate(...P(-0.55, 0, 0)));
    add(tube([P(-0.5, 4.95, 0), P(-0.42, 5.4, 0)], 0.36 * U, 0.33 * U, { seg: 2, radial: 10 }));
    for (const s of [-1, 1]) add(tf(blob(0.42, { detail: 2, amp: 0.05, seed: 9 + s }), { p: P(-0.52, 4.72, s * 1.0), s: [U, U * 0.9, U] }));
    // his right arm, the hand on his knee
    const S = P(-0.52, 4.65, 1.02);
    const E = P(-0.2, 3.25, 1.18);
    const Wr = P(1.1, 2.98, 0.8);
    add(tube([S, P(-0.4, 4.0, 1.14), E], 0.34 * U, 0.28 * U, { seg: 5, radial: 10 }));
    add(tube([E, P(0.45, 3.06, 1.04), Wr], 0.28 * U, 0.2 * U, { seg: 5, radial: 10 }));
    const hm = frame(Wr, handTurn([0.85, -0.5, -0.1], [0.4, 0.7, 0.1]).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.PI)), 0.62 * U);
    for (const hg of handGeos({ curl: 0.35, spread: 0.08, thumb: 0.2 })) add(hg.applyMatrix4(hm));
    // the left arm, gone: a broken stump at the shoulder
    add(tube([P(-0.52, 4.65, -1.02), P(-0.46, 4.2, -1.12), P(-0.42, 3.92, -1.16)], 0.34 * U, 0.31 * U, { seg: 3, radial: 10 }));
    addHull(tf(chunkGeo(sd++, 0.34 * U, 0.5, 14), { p: P(-0.42, 3.9, -1.16), r: [0.3, 0.2, 0.1] }));
    // his head, bowed a little, as if he looked down at the woods
    kingHead(add, at({ p: [-0.36, 5.95, 0], r: [0, 0, -0.2], s: U }), { seed: seed + 1, fine: 0.06, coarse: 0.26 });
    // the arm on the ground beside the plinth, its hand half open
    bk.at([2.6, 0, -3.0], 0.7, () => {
      const lie = (x, y, z) => [x * U, 0.32 + y * U, z * U];
      add(tube([lie(-0.3, 0, 0), lie(0.6, 0.02, 0.05), lie(1.4, -0.05, 0.1)], 0.3 * U, 0.2 * U, { seg: 5, radial: 10 }));
      const fm = frame(lie(1.4, -0.08, 0.12), handTurn([1, -0.1, 0.1], [0, 1, 0.2]), 0.62 * U);
      for (const hg of handGeos({ curl: 0.5, spread: 0.1, lost: [3] })) add(hg.applyMatrix4(fm));
      addHull(tf(chunkGeo(sd++, 0.3 * U, 0.6, 12), { p: lie(-0.35, 0, 0) }));
      moss(0.3 * U, 0.32 + 0.28 * U, 0, 0.28, 0.4);
      tufts.push({ x: 0, y: 0, z: 0.5, h: 0.4, n: 10, s: 0.4 });
    });
    // moss in his lap, on his shoulders and feet, a fern growing from it
    moss(...P(0.7, 2.98, 0.1), 0.62, 0.32);
    moss(...P(1.5, 2.9, -0.4), 0.42, 0.4);
    moss(...P(-0.1, 2.95, -0.6), 0.36, 0.4);
    moss(...P(-0.55, 5.02, -0.9), 0.32, 0.45);
    moss(...P(-0.55, 5.02, 0.85), 0.28, 0.45);
    for (const s of [-1, 1]) moss(...P(2.6, 0.24, s * 0.55), 0.22, 0.5);
    ferns.push([...P(0.95, 3.05, -0.25), 1.2, 0.55]);
    ferns.push([...P(-1.2, 5.6, 0.3), 2.2, 0.4]);
  } else {
    const U = 0.94;
    const top = plinth(3.3, 3.1, 0.5, 0.4);
    const P = (x, y, z) => [x * U, top + y * U, z * U];
    // the robe to his feet, the belt, his chest
    add(robeGeo([[1.02, 0.12], [1.0, 0.35], [0.92, 1.3], [0.84, 2.3], [0.78, 3.3], [0.74, 3.95], [0.72, 4.15], [0.001, 4.16]], { depth: 0.74, folds: 9, amp: 0.07, seed: 5, hem: 0.05, top: 4.0 }).scale(U, U, U).translate(...P(0, 0, 0)));
    add(lathe([[0.745, 3.98], [0.775, 4.02], [0.78, 4.22], [0.745, 4.26]], 28).scale(0.74 * U, U, U).translate(...P(0, 0, 0)));
    add(tf(new THREE.OctahedronGeometry(0.14, 0), { p: P(0.6, 4.12, 0), s: [0.5 * U, U, U] }));
    add(robeGeo([[0.73, 4.1], [0.76, 4.5], [0.86, 5.0], [0.93, 5.45], [0.9, 5.78], [0.68, 6.0], [0.32, 6.12], [0.001, 6.14]], { depth: 0.64, folds: 5, amp: 0.02, seed: 6 }).scale(U, U, U).translate(...P(0, 0, 0)));
    // the cloak from his shoulders to the ground behind him
    add(robeGeo([[1.32, 0.04], [1.22, 1.5], [1.1, 3.2], [1.02, 4.8], [0.98, 5.6], [0.84, 5.95], [0.5, 6.12]], { depth: 0.8, folds: 13, amp: 0.06, seed: 7, hem: 0.06, phi: [Math.PI * 0.9, Math.PI * 1.2], inner: true }).scale(U, U, U).translate(...P(-0.05, 0, 0)));
    for (const s of [-1, 1]) add(tf(blob(0.42, { detail: 2, amp: 0.05, seed: 19 + s }), { p: P(0, 5.72, s * 0.98), s: [U, U * 0.9, U] }));
    add(tube([P(0.02, 5.98, 0), P(0.06, 6.45, 0)], 0.34 * U, 0.31 * U, { seg: 2, radial: 10 }));
    // the feet under the hem
    for (const s of [-1, 1]) add(sweep3([P(0.45, 0.14, s * 0.4), P(0.85, 0.12, s * 0.44), P(1.12, 0.08, s * 0.46)], [[0.16, 0.24], [0.15, 0.24], [0.09, 0.19]], { seg: 5, radial: 8, side: [0, 0, 1] }));
    // his left arm raised, the palm out, the sleeve fallen back from it
    const LS = P(0.02, 5.7, -1.0);
    const LE = P(0.8, 5.3, -1.42);
    const LW = P(1.0, 6.5, -1.5);
    add(tube([LS, P(0.45, 5.5, -1.28), LE], 0.33 * U, 0.27 * U, { seg: 5, radial: 10 }));
    add(tube([LE, P(0.94, 5.95, -1.48), LW], 0.26 * U, 0.19 * U, { seg: 5, radial: 10 }));
    add(sweep3([P(0.98, 6.1, -1.48), P(0.85, 5.4, -1.45), P(0.7, 4.7, -1.4), P(0.6, 4.25, -1.38)], [[0.36, 0.3], [0.42, 0.3], [0.3, 0.22], [0.08, 0.08]], { seg: 10, radial: 12, side: [0, 0, 1] }));
    const lh = frame(P(1.02, 6.48, -1.5), handTurn([0.05, 1, 0.02], [1, 0, -0.15]).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), 0)), [-0.72 * U, 0.72 * U, 0.72 * U]);
    for (const hg of handGeos({ curl: 0.06, spread: 0.12, lost: [2, 3], thumb: 0.15 })) add(hg.applyMatrix4(lh));
    // his right hand on the pommel of his sword, its point between his feet
    const RS = P(0.02, 5.7, 1.0);
    const RE = P(0.28, 4.5, 1.2);
    const RW = P(0.98, 3.95, 0.85);
    add(tube([RS, P(0.1, 5.1, 1.14), RE], 0.33 * U, 0.27 * U, { seg: 5, radial: 10 }));
    add(tube([RE, P(0.62, 4.15, 1.05), RW], 0.26 * U, 0.2 * U, { seg: 5, radial: 10 }));
    const sx = 1.32;
    const sz = 0.66;
    add(tf(ball(0.2, 10, 8), { p: P(sx, 3.86, sz), s: U }));
    add(tube([P(sx, 3.7, sz), P(sx, 3.2, sz)], 0.1 * U, 0.12 * U, { seg: 2, radial: 8 }));
    add(tf(roundBox(0.24, 0.18, 1.5, 0.05), { p: P(sx, 3.1, sz), s: U }));
    add(ext(shapeOf([[-0.17, 0], [0.17, 0], [0.15, -2.6], [0, -2.95], [-0.15, -2.6]]), 0.07, 0.025, 2).translate(0, 0, -0.035).scale(U, U, U).rotateY(Math.PI / 2 - 0.15).translate(...P(sx, 3.02, sz)));
    const rh = frame(P(sx - 0.06, 3.92, sz + 0.06), handTurn([0.2, -0.15, -1], [0, -1, 0]), 0.6 * U);
    for (const hg of handGeos({ curl: 0.75, spread: 0.04, thumb: 0.6 })) add(hg.applyMatrix4(rh));
    kingHead(add, frame(P(0.08, 6.92, 0), [0, 0, 0.04], U), { seed: seed + 2, crack: true, fine: 0.06, coarse: 0.26 });
    // moss on his shoulders, his raised hand, his feet and the plinth
    moss(...P(-0.05, 6.06, -0.75), 0.34, 0.45);
    moss(...P(-0.1, 6.03, 0.8), 0.3, 0.45);
    moss(...P(1.0, 0.18, 0.42), 0.2, 0.5);
    moss(...P(-0.9, 0.05, -0.9), 0.4, 0.4);
    moss(...P(1.4, 0.0, -0.9), 0.36, 0.4);
  }
  bk.add(mats.grass, grassGeo(tufts, seed + 13));
  if (ferns.length) {
    const fg = fernGeo(seed + 4);
    ferns.forEach(([x, y, z, ry, s]) => bk.add(mats.fern, fg.clone(), { p: [x, y, z], r: [0, ry, 0], s }));
  }
  bk.build(g);
  return { group: g };
}

// ── forest things, for instancing ──

// A broken column stub for scatter, about 0.6 to 2.4 m: a square plinth, a
// moulded base, one or two fluted drums broken off ragged, moss on the
// break and lichen down it. One geometry, its colours in its vertices, with
// texture coordinates for the weathered stone (mats.ruin).
function pillarGeo(seed = 1) {
  const r = rng(seed * 29 + 3);
  const paint = stonePaint(seed + 60, { moss: 1.2, lichen: 1.2, damp: 1 });
  const list = [];
  const plinth = hexBlock(placeCorners(boxCorners(0.92, 0.42, 0.92), { p: [0, 0.11, 0], r: [0, r() * 0.3, 0] }), { seed, paint, chip: 0.5 });
  list.push(boxUV(plinth, 0.42));
  const base = lathe([[0.001, 0], [0.42, 0], [0.42, 0.06], [0.39, 0.1], [0.41, 0.15], [0.36, 0.2], [0.34, 0.24]], 20).translate(0, 0.32, 0);
  list.push(paintSmooth(base, paint));
  const h = 0.4 + r() * 1.8;
  let y = 0.56;
  let left = h;
  let k = 0;
  while (left > 0.05) {
    const dh = Math.min(left, 0.9);
    const last = left - dh < 0.3;
    const geo = drumGeo(0.33, last ? left : dh, { flutes: 12, seed: seed * 5 + k, broken: last ? 0.3 : 0, caps: [false, true] });
    geo.rotateY(r() * 0.3).translate(0, y, 0);
    list.push(paintSmooth(geo, paint));
    y += last ? left : dh;
    left -= last ? left : dh;
    k++;
  }
  const m = mossGeo(0.25, seed + 9, { h: 0.5 }).translate(0, y - 0.18, 0).toNonIndexed();
  list.push(boxUV(m, 3));
  return oneGeo(list, { uv: true });
}

// A tall straight pine for instancing, about 22 m: a long reddish trunk
// bare of branches for half its height but for a few dead stubs, moss at
// its foot, and above that tiers of dark needles, each a ragged skirt with
// drooping tips over a darker underside, uneven and smaller towards the top.
function pineGeo(seed = 1) {
  const r = rng(seed * 11 + 5);
  const n = makeNoise(seed + 3);
  const H = 20 + r() * 4;
  const lean = (y) => Math.sin(y * 0.11 + seed) * 0.18 * (y / H);
  const list = [];
  const trunk = new THREE.CylinderGeometry(0.11, 0.38, H, 8, 8).translate(0, H / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const flare = 1 + Math.max(0, 1 - y / 1.2) * 0.35;
    tp.setXYZ(i, tp.getX(i) * flare + lean(y), y, tp.getZ(i) * flare);
  }
  trunk.computeVertexNormals();
  list.push(tint(trunk, (x, y, z, out) => {
    const a = Math.atan2(z, x);
    out.setRGB(0.24, 0.15, 0.1).multiplyScalar(0.75 + n(a * 2.5, y * 0.6) * 0.5);
    if (y < 2.4) out.lerp(MOSS.mid, smooth(2.4, 0.3, y) * smooth(0.3, 0.6, n(a * 1.5 + 4, y)) * 0.8);
  }));
  // dead stubs on the bare trunk
  for (let i = 0; i < 6; i++) {
    const y = 4 + r() * (H * 0.4);
    const a = r() * TAU;
    const l = 0.4 + r() * 0.7;
    const geo = new THREE.CylinderGeometry(0.015, 0.05, l, 4, 1).translate(0, l / 2, 0).rotateZ(-1.2 - r() * 0.3).rotateY(a).translate(lean(y), y, 0);
    list.push(tint(geo, (x, yy, z, out) => out.setRGB(0.2, 0.17, 0.14)));
  }
  const tiers = 13;
  const y0c = H * 0.46;
  const top = C(0x2a4626);
  const tipC = C(0x5a7a34);
  const inner = C(0x13221a);
  const below = C(0x0b150e);
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y0 = y0c + Math.pow(t, 0.95) * (H - y0c - 1.4) + (r() - 0.5) * 0.4;
    const rad = mix(3.0, 0.5, Math.pow(t, 0.8)) * (0.8 + r() * 0.35);
    const h = mix(2.0, 1.4, t);
    const m = 9;
    const pos = [];
    const col = [];
    const cx = lean(y0) + (r() - 0.5) * 0.4 * (1 - t);
    const cz = (r() - 0.5) * 0.4 * (1 - t);
    const apex = [lean(y0 + h), y0 + h, 0];
    const under = [cx, y0 + h * 0.3, cz];
    const rim = [];
    for (let k = 0; k < m * 2; k++) {
      const a = (k / (m * 2)) * TAU + i * 0.9;
      const tip = k % 2 === 0;
      const rr = rad * (tip ? 1 : 0.62) * (0.75 + n(k * 0.7, i * 3) * 0.5);
      rim.push([cx + Math.cos(a) * rr, y0 + (tip ? -0.35 - r() * 0.35 : 0.15), cz + Math.sin(a) * rr, tip]);
    }
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
      _nv.y += 0.4;
      _nv.normalize();
      nr.setXYZ(k, _nv.x, _nv.y, _nv.z);
    }
    list.push(geo);
  }
  return oneGeo(list);
}

// The greens of the beeches' leaves, deep inside the crown to gold-green
// out in the low sun.
const BEECH = { inner: C(0x15240c), deep: C(0x2c4a14), mid: C(0x4a6e1e), light: C(0x86a434), gold: C(0xa8a83c) };

// A crown of leaf clumps for instancing: blobs round a dome, each vertex's
// colour from how high and how far out it is (darker under and inside,
// bright on top), in patches of hue; the normals turned out from the
// crown's middle, so it shades as one rounded mass.
function crownGeo(blobs, centre, { seed = 1, span = 4.5 }) {
  const n = makeNoise(seed + 7);
  const list = [];
  const ctr = V3(...centre);
  const tmp = V3();
  blobs.forEach(([x, y, z, rad], i) => {
    const geo = blob(rad, { detail: 1, amp: 0.34, freq: 1.8, seed: seed * 13 + i });
    geo.translate(x, y, z);
    const nr = geo.attributes.normal;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      tmp.set(p.getX(k), p.getY(k), p.getZ(k)).sub(ctr).normalize();
      const nx = nr.getX(k) * 0.4 + tmp.x * 0.6;
      const ny = nr.getY(k) * 0.4 + tmp.y * 0.6 + 0.15;
      const nz = nr.getZ(k) * 0.4 + tmp.z * 0.6;
      const l = Math.hypot(nx, ny, nz);
      nr.setXYZ(k, nx / l, ny / l, nz / l);
    }
    const own = n(i * 3.7 + 0.5, seed + 0.5);
    tint(geo, (px, py, pz, out) => {
      const up = (py - ctr.y) / span;
      const outward = Math.hypot(px - ctr.x, (py - ctr.y) * 0.6, pz - ctr.z) / span;
      const t = clamp01(0.4 + up * 0.38 + (outward - 0.62) * 0.7 + (n(px * 1.6, py * 1.6 + pz) - 0.5) * 0.3);
      out.copy(BEECH.inner).lerp(BEECH.deep, smooth(0, 0.3, t)).lerp(BEECH.mid, smooth(0.28, 0.6, t));
      out.lerp(own > 0.62 ? BEECH.gold : BEECH.light, smooth(0.62, 1, t) * 0.8);
    });
    list.push(geo);
  });
  return list;
}

// An old beech for instancing, about 16 m: a stout grey trunk on spreading
// buttress roots, green with moss up its lower half, parting into a few
// heavy limbs under a broad, uneven dome of leaf.
function beechGeo(seed = 1) {
  const r = rng(seed * 7 + 3);
  const n = makeNoise(seed + 20);
  const H = 14.5 + r() * 3;
  const list = [];
  const trunkH = H * 0.42;
  const trunk = new THREE.CylinderGeometry(0.42, 0.62, trunkH, 10, 5, true).translate(0, trunkH / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const flare = 1 + Math.max(0, 1 - y / 1.4) * (0.55 + Math.sin(a * 5 + seed) * 0.35);
    const bend = Math.sin(y * 0.4 + seed) * 0.15;
    tp.setX(i, tp.getX(i) * flare + bend);
    tp.setZ(i, tp.getZ(i) * flare);
  }
  trunk.computeVertexNormals();
  const bark = (x, y, z, out) => {
    const a = Math.atan2(z, x);
    out.setRGB(0.36, 0.35, 0.32).multiplyScalar(0.8 + n(y * 1.5, a * 2) * 0.4);
    const mossy = smooth(H * 0.38, 0.5, y) * smooth(0.25, 0.55, n(a * 1.3 + 7, y * 0.5) + (z < 0 ? 0.2 : 0));
    out.lerp(y < 1.2 ? MOSS.mid : MOSS.dark, mossy * 0.85);
  };
  list.push(tint(trunk, bark));
  const limbs = 4 + Math.floor(r() * 2);
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * TAU + r() * 0.8;
    const reach = 2.2 + r() * 1.8;
    const top = H * (0.6 + r() * 0.12);
    const end = [Math.cos(a) * reach, top, Math.sin(a) * reach];
    const geo = tube([[0, trunkH - 0.5, 0], [end[0] * 0.4, trunkH + (top - trunkH) * 0.4, end[2] * 0.4], end], 0.32, 0.09, { seg: 5, radial: 6 });
    list.push(tint(geo, bark));
  }
  // the crown: a broad dome of clumps
  const cy = H * 0.68;
  const R = H * 0.38;
  const blobs = [[0, cy + R * 0.25, 0, R * 0.5]];
  const count = 15 + Math.floor(r() * 4);
  for (let k = 0; k < count; k++) {
    const a = k * 2.39996 + r() * 0.5;
    const el = Math.asin(mix(-0.3, 0.92, (k + 0.5) / count));
    const rr = R * (0.72 + r() * 0.24);
    blobs.push([Math.cos(a) * Math.cos(el) * rr * 1.1, cy + Math.sin(el) * rr * 0.68, Math.sin(a) * Math.cos(el) * rr * 1.1, R * (0.28 + r() * 0.12)]);
  }
  list.push(...crownGeo(blobs, [0, cy, 0], { seed, span: R }));
  return oneGeo(list);
}

// A clump of fern for instancing, about 1.2 m across: a dozen fronds from a
// dark heart, arching out and over, each a midrib with its leaflets in
// pairs, longest in the middle of the frond; deep green at the heart, fresh
// and bright at the tips, a few gone brown. Each leaflet is wound both ways
// with its normal up, so it lights like the ground from either side on a
// single-sided material (a double-sided one turns the normal down for the
// back, and a frond seen from behind, or by its own face normal, lit black).
function fernGeo(seed = 1) {
  const r = rng(seed * 23 + 7);
  const pos = [];
  const col = [];
  const nor = [];
  const heart = C(0x16280c);
  const green = C(0x3e6a1c);
  const bright = C(0x86b03a);
  const brown = C(0x8a6a30);
  const c0 = new THREE.Color();
  const c1 = new THREE.Color();
  const fronds = 10 + Math.floor(r() * 4);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + r() * 0.4;
    const len = 0.55 + r() * 0.35;
    const lift = 0.7 + r() * 0.5;
    const dead = r() < 0.12;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const N = 7;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // out and up, then arching over
      const out = len * t;
      const y = len * lift * (t * 1.1 - t * t * 0.95);
      pts.push([dx * out, y, dz * out]);
    }
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const [ax, ay, az] = pts[i];
      const [bx, by, bz] = pts[i + 1];
      const leaf = 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.8 + r() * 0.3) * (len / 0.7);
      c0.copy(heart).lerp(green, smooth(0, 0.4, t));
      c1.copy(green).lerp(bright, smooth(0.2, 1, t));
      if (dead) {
        c0.lerp(brown, 0.7);
        c1.lerp(brown, 0.85);
      }
      for (const sd of [-1, 1]) {
        // a leaflet: from the midrib out to the side and on along the frond
        const sx = -dz * sd;
        const sz = dx * sd;
        const tip = [(ax + bx) / 2 + sx * leaf + dx * leaf * 0.35, (ay + by) / 2 - leaf * 0.18, (az + bz) / 2 + sz * leaf + dz * leaf * 0.35];
        const tri = sd > 0 ? [[ax, ay, az], [bx, by, bz], tip] : [[ax, ay, az], tip, [bx, by, bz]];
        for (const face of [tri, [tri[0], tri[2], tri[1]]]) {
          face.forEach((v) => {
            pos.push(...v);
            const c = v === tip ? c1 : c0;
            col.push(c.r, c.g, c.b);
            nor.push(dx * 0.2, 0.96, dz * 0.2);
          });
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// A grey lichened boulder for instancing, about 1.5 m: an icosahedron
// pushed about by noise and split along a few planes so it has the broken
// faces of real stone, a thick pelt of moss over its top and down its
// shaded side, lichen on the rest. Stands about y = -0.3 … 1.0: sink it to
// taste. Texture coordinates for the weathered stone (mats.rock).
function mossRockGeo(seed = 1) {
  const r = rng(seed);
  const n = makeNoise(seed);
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.6 - 0.6);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.62 + r() * 0.22 });
  }
  const sx = 0.8 + r() * 0.25;
  const sz = 0.65 + r() * 0.2;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 4 }) - 0.5) * 0.7);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    v.set(v.x * sx, v.y * 0.62 + 0.32, v.z * sz);
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  boxUV(g, 0.8);
  const paint = stonePaint(seed + 50, { moss: 1.8, lichen: 1.3, damp: 0.9, ground: -0.2, base: C(0x8e8c84), vary: 0.18 });
  paintHull(g, [], paint);
  g.computeBoundingSphere();
  return g;
}

// A fallen branch for firewood, about a metre: a crooked stick of grey-
// brown wood with two side twigs and a snapped end, lying along x on the
// ground.
function stickGeo(seed = 1) {
  const r = rng(seed * 31 + 11);
  const L = 0.85 + r() * 0.35;
  const rad = 0.025 + r() * 0.012;
  const pts = [];
  for (let i = 0; i <= 4; i++) pts.push([-L / 2 + (L * i) / 4, rad + (r() - 0.5) * 0.02, (r() - 0.5) * 0.06]);
  const n = makeNoise(seed);
  const wood = (x, y, z, out) => out.setRGB(0.3, 0.24, 0.18).multiplyScalar(0.7 + n(x * 9, y * 30 + z * 30) * 0.5);
  const list = [tint(tube(pts, rad, rad * 0.7, { seg: 6, radial: 5, gnarl: 0.2, seed }), wood)];
  for (let k = 0; k < 2; k++) {
    const i = 1 + k * 2;
    const b = pts[i];
    const sd = k ? 1 : -1;
    const tl = 0.15 + r() * 0.15;
    list.push(tint(tube([b, [b[0] + tl * 0.6, b[1] + 0.01, b[2] + sd * tl * 0.5], [b[0] + tl, b[1] + 0.02, b[2] + sd * tl * 0.75]], rad * 0.5, rad * 0.25, { seg: 2, radial: 3 }), wood));
  }
  // the pale wood of the snapped end
  list.push(tint(new THREE.CircleGeometry(rad * 0.75, 6).rotateY(-Math.PI / 2).translate(pts[0][0] - 0.002, pts[0][1], pts[0][2]), (x, y, z, out) => out.setRGB(0.7, 0.6, 0.45)));
  return oneGeo(list);
}

// ── more helpers ──

// A geometry from plain arrays (as Lórien's).
function geoOf(pos, idx, uv = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (idx) g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// The triangles of a grid of rows × cols quads, (cols + 1) points a row.
// Faces out to the side where (along a row) × (up the rows) points; `flip`
// turns them round.
function gridIdx(rows, cols, flip = false) {
  const idx = [];
  const w = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  return idx;
}

// Only those triangles of a geometry whose middle passes test(centre).
function keepTris(geo, test) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position;
  const keep = [];
  const c = V3();
  for (let i = 0; i < p.count; i += 3) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(_pv.fromBufferAttribute(p, i + k));
    if (test(c.multiplyScalar(1 / 3))) keep.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes)) {
    const n = attr.itemSize;
    const arr = new Float32Array(keep.length * 3 * n);
    keep.forEach((i, j) => arr.set(attr.array.subarray(i * n, (i + 3) * n), j * 3 * n));
    out.setAttribute(name, new THREE.BufferAttribute(arr, n));
  }
  return out;
}

// A point and the way along at s (0..1) on a curve, for setting rings round
// a horn or a log.
const _zAxis = V3(0, 0, 1);
function ringAt(curve, s, geo) {
  const p = curve.getPointAt(s);
  const t = curve.getTangentAt(s);
  return geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_zAxis, t)).translate(p.x, p.y, p.z);
}

// The light of the woods for metal and polished wood to catch, mapped round
// a sphere: a pale warm sky, the sun gold and low, the dark of the trees
// round the horizon and the brown floor below.
function envCanvas() {
  const n = makeNoise(5);
  const c = makeCanvas(128, 64);
  paintPixels(c, (u, v, out) => {
    const up = 1 - v * 2;
    const sky = smooth(0, 0.8, up);
    const sun = Math.exp(-(((u - 0.62) / 0.07) ** 2) - ((up - 0.22) / 0.1) ** 2);
    const edge = 0.1 + (fbm(n, u * 16, 0.5, { period: 16, octaves: 3 }) - 0.5) * 0.3;
    const tree = 1 - smooth(edge - 0.03, edge + 0.03, up);
    const floor = smooth(0, -0.3, up);
    out[0] = mix(mix(mix(mix(236, 140, sky), 255, sun), 58, tree), 74, floor);
    out[1] = mix(mix(mix(mix(214, 170, sky), 222, sun), 70, tree), 60, floor);
    out[2] = mix(mix(mix(mix(168, 204, sky), 150, sun), 40, tree), 38, floor);
  });
  return c;
}

// ── the camp at Parth Galen ──

// The Fellowship's camp on the lawn: a ring of stones round last night's
// cold ash, a few logs stood together over it ready to light and more laid
// by; the packs propped round about, each with its bedroll strapped on top,
// two more bedrolls rolled and tied and one spread out on the grass; and
// Sam's cooking pot at the ring's edge with a ladle in it.
function camp(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'camp';
  const bk = parts();
  const rand = rng(43);
  const ne = makeNoise(44);
  const rockPaint = stonePaint(45, { moss: 0.5, lichen: 0.8, damp: 0.3, base: C(0x8a887e) });

  // the hearth: grey ash, gone cold, and a few black ends of charcoal
  bk.add(mats.earth, blob(0.52, { detail: 2, amp: 0.15, freq: 3, seed: 6 }), {
    s: [1, 0.07, 1],
    color: (x, y, z, out) => out.setRGB(0.34, 0.32, 0.3).lerp(_kd.setRGB(0.05, 0.045, 0.04), clamp01(ne(x * 8, z * 8) * 1.6 - 0.55)),
  });
  // the ring of stones, sooted on the inside
  const ring = 11;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * TAU + rand() * 0.2;
    const rr = 0.66 + rand() * 0.06;
    const geo = blob(0.15 + rand() * 0.05, { detail: 1, amp: 0.3, freq: 2.2, seed: 70 + i });
    tf(geo, { p: [Math.cos(a) * rr, 0.05, Math.sin(a) * rr], s: [1.25, 0.72, 1], r: [rand() * 0.3, -a, rand() * 0.3] });
    paintSmooth(geo, rockPaint);
    const c = geo.attributes.color;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const soot = (1 - smooth(0.58, 0.74, Math.hypot(p.getX(k), p.getZ(k)))) * 0.75;
      c.setXYZ(k, mix(c.getX(k), 0.05, soot), mix(c.getY(k), 0.045, soot), mix(c.getZ(k), 0.04, soot));
    }
    bk.add(mats.rock, geo, { uv: 1.2 });
  }
  // a log: bark, and the pale wood of its sawn ends
  const endWood = (x, y, z, out) => out.setRGB(0.72, 0.6, 0.44).multiplyScalar(0.8 + ne(x * 40 + y * 30, z * 40) * 0.3);
  const log = (A, Bp, rad, seed) => {
    const a = V3(...A);
    const b = V3(...Bp);
    const mid = a.clone().lerp(b, 0.5).add(V3((rand() - 0.5) * 0.03, 0, (rand() - 0.5) * 0.03));
    bk.add(mats.trunk, tube([a, mid, b], rad, rad * 0.88, { seg: 4, radial: 7, gnarl: 0.15, seed, uvK: 1.6 }));
    for (const [p, q] of [[a, b], [b, a]]) {
      const end = new THREE.CircleGeometry(rad * 0.93, 8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_zAxis, p.clone().sub(q).normalize()));
      bk.add(mats.wood, end.translate(p.x, p.y, p.z), { color: endWood });
    }
  };
  // stood together over the ash, ready for the evening, and kindling under
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + rand() * 0.3;
    log([Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38], [Math.cos(a + 2.7) * 0.05, 0.6 + rand() * 0.08, Math.sin(a + 2.7) * 0.05], 0.03 + rand() * 0.014, 10 + i);
  }
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU;
    bk.add(mats.wood, cylX(0.008 + rand() * 0.006, 0.22 + rand() * 0.12, 4), { p: [Math.cos(a) * 0.12, 0.05 + rand() * 0.04, Math.sin(a) * 0.12], r: [rand(), a, rand() * 0.4], color: 0x6a5238 });
  }
  // more laid by the ring
  log([0.95, 0.075, 0.6], [1.55, 0.07, 1.0], 0.075, 20);
  log([0.86, 0.07, 0.82], [1.38, 0.065, 1.3], 0.068, 21);
  log([1.05, 0.2, 0.75], [1.5, 0.2, 1.2], 0.062, 22);

  // the packs, propped round about, leaning back from the fire, a bedroll
  // strapped on top of each
  const strap = 0x3a2a1c;
  const PACKS = [[2.0, 0.55, 0x6a5a3e, 0x5a6a4a], [2.3, 1.75, 0x5a4a34, 0x7a3a2a], [2.15, 3.05, 0x6e6248, 0x4a5a6a], [2.35, 4.35, 0x5c4c38, 0x8a7448], [1.95, 5.5, 0x665a44, 0x56604a]];
  PACKS.forEach(([rr, a, hue, roll], i) => {
    bk.at([Math.cos(a) * rr, 0, Math.sin(a) * rr], Math.PI - a, () => {
      bk.at([0, 0, 0], [0, 0, 0.22], () => {
        bk.add(mats.blanket, blob(0.26, { detail: 2, amp: 0.1, freq: 2.4, seed: 30 + i }), { p: [0, 0.3, 0], s: [0.58, 1.05, 0.82], color: hue, uv: 2 });
        bk.add(mats.blanket, blob(0.17, { detail: 1, amp: 0.1, freq: 3, seed: 40 + i }), { p: [0.07, 0.5, 0], s: [0.65, 0.32, 1.15], r: [0, 0, -0.5], color: C(hue).multiplyScalar(0.85), uv: 2 });
        bk.add(mats.blanket, cyl(0.1, 0.1, 0.56, 10), { p: [-0.02, 0.66, 0], r: [Math.PI / 2, 0, 0], color: roll, uv: 2 });
        for (const z of [-0.17, 0.17]) {
          bk.add(mats.wood, new THREE.TorusGeometry(0.104, 0.011, 4, 12), { p: [-0.02, 0.66, z], color: strap });
          bk.add(mats.wood, tube([[-0.13, 0.12, z * 0.8], [-0.17, 0.35, z * 0.8], [-0.13, 0.56, z * 0.8]], 0.012, 0.012, { seg: 4, radial: 4 }), { color: strap });
        }
      });
    });
  });
  // two bedrolls rolled and tied, and one spread out on the grass
  const spiral = (hue) => (x, y, z, out) => {
    const d = Math.hypot(x, y) / 0.11;
    out.copy(C(hue)).multiplyScalar(0.75 + 0.35 * (0.5 + 0.5 * Math.sin(d * 22)));
  };
  for (const [x, z, a, hue] of [[-1.7, 1.6, 0.6, 0x4e5a44], [-2.2, 0.9, 1.1, 0x6a4a3a]]) {
    bk.at([x, 0, z], a, () => {
      bk.add(mats.blanket, cyl(0.11, 0.11, 0.72, 12), { p: [0, 0.11, 0], r: [Math.PI / 2, 0, 0], color: hue, uv: 2 });
      for (const s of [-1, 1]) {
        bk.add(mats.blanket, new THREE.CircleGeometry(0.108, 12), { p: [0, 0.11, s * 0.361], r: [0, s > 0 ? 0 : Math.PI, 0], color: spiral(hue) });
        bk.add(mats.wood, new THREE.TorusGeometry(0.114, 0.01, 4, 12), { p: [0, 0.11, s * 0.2], color: strap });
      }
    });
  }
  {
    const nb = makeNoise(61);
    const l = 1.7;
    const w = 0.76;
    const sheet = new THREE.PlaneGeometry(l, w, 12, 6);
    const p = sheet.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / l + 0.5;
      const v = p.getY(i) / (w / 2);
      const fold = (nb(u * 6, v * 3) - 0.5) * 0.06;
      const sag = Math.abs(v) > 0.8 ? -(Math.abs(v) - 0.8) * 0.3 : 0;
      p.setZ(i, 0.03 + fold + sag + (u < 0.12 ? (0.12 - u) * 0.6 : 0));
    }
    sheet.computeVertexNormals();
    bk.at([-1.4, 0, -1.5], 2.2, () => {
      bk.add(mats.blanket, sheet, {
        r: [-Math.PI / 2, 0, 0],
        color: (x, y, z, out) => {
          const u = x / l + 0.5;
          const stripe = (u > 0.07 && u < 0.1) || (u > 0.9 && u < 0.93) ? 1 : 0;
          out.setRGB(0.36, 0.4, 0.3).multiplyScalar(0.85 + nb(x * 5, z * 5) * 0.3).lerp(_kd.setRGB(0.6, 0.55, 0.42), stripe * 0.6);
        },
        uv: 2,
      });
    });
  }
  // the pot at the ring's edge, its lid tipped against it, a ladle in it
  bk.at([0.62, 0, -0.98], 0.4, () => {
    bk.add(mats.iron, lathe([[0.001, 0], [0.13, 0.005], [0.155, 0.07], [0.15, 0.2], [0.162, 0.215], [0.146, 0.215], [0.135, 0.03], [0.001, 0.03]], 16));
    bk.add(mats.iron, new THREE.TorusGeometry(0.155, 0.006, 4, 16, Math.PI), { p: [0, 0.215, 0], r: [0, 0, 0.6] });
    bk.add(mats.iron, lathe([[0.001, 0.03], [0.07, 0.025], [0.15, 0.008], [0.152, 0]], 16), { p: [0.24, 0.155, 0.05], r: [0, 0, 1.25] });
    bk.add(mats.iron, ball(0.018, 6, 4), { p: [0.28, 0.17, 0.05] });
    bk.add(mats.wood, tube([[-0.04, 0.05, 0.02], [-0.06, 0.2, 0.03], [-0.09, 0.4, 0.04]], 0.012, 0.01, { seg: 3, radial: 4 }), { color: 0x7a5a3a });
    bk.add(mats.wood, ball(0.035, 6, 4), { p: [-0.035, 0.05, 0.02], s: [1, 0.5, 1], color: 0x7a5a3a });
  });
  bk.build(g);
  return { group: g, fire: V3(0, 0.15, 0) };
}

// ── the boats ──

// An elven boat of Lórien, as Lórien's own: 6 m long and 1.2 m in the
// beam, grey-white and slender as a leaf, its hull sweeping up at either
// end, the prow rising into a swan's neck and head, the stern into an
// upswept tip; silver inlaid under the gunwale and in a folded wing on
// either bow, small decks at either end, ribs and floorboards inside, and
// two thwarts, each with a leaf-bladed paddle laid on the boards by it.
// Faces +x, its keel at y = 0. Its seats are where a sitting figure's
// origin goes (a toy hobbit's hips sit 0.42 above it, so it sits on the
// thwart), bow first; the paddles are groups (shaft along their own y,
// blade at -y, the origin mid-shaft) to take up.
function boat(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'boat';
  const bk = parts();
  const HL = 3;
  const beam = (t) => 0.6 * Math.pow(Math.max(0, 1 - t * t), 0.62) * (1 - 0.05 * t);
  const keel = (t) => 0.02 + 0.22 * Math.pow(Math.abs(t), 3);
  const sheer = (t) => 0.47 + 0.3 * Math.pow(Math.abs(t), 4) + (t > 0 ? 0.14 * Math.pow(t, 8) : 0);
  // a point on the hull: t along it (-1 the stern, +1 the bow), f round it
  // (-1 the port gunwale, 0 the keel, +1 starboard), `inset` in from outside
  const hull = (t, f, inset = 0) => {
    const w = Math.max(0, beam(t) - inset);
    const yk = keel(t) + inset;
    const ys = sheer(t);
    const s = Math.sin((f * Math.PI) / 2);
    const c = 1 - Math.cos((f * Math.PI) / 2);
    return [t * HL, yk + (ys - yk) * Math.pow(c, 1.3), w * s];
  };
  const NT = 40;
  const NF = 14;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(Math.sin(((i / NT) * 2 - 1) * (Math.PI / 2)));
  const skin = (inset, outside) => {
    const pos = [];
    const uv = [];
    for (const t of ts) {
      for (let j = 0; j <= NF; j++) {
        const f = (j / NF) * 2 - 1;
        pos.push(...hull(t, f, inset));
        uv.push(t * HL * 0.9, f * 1.1);
      }
    }
    return geoOf(pos, gridIdx(NT, NF, outside), uv);
  };
  bk.add(mats.boat, skin(0, true));
  bk.add(mats.boat, skin(0.03, false));
  // the gunwale, round both sides and through both ends
  const gun = [];
  for (let i = 1; i < NT; i++) gun.push(V3(...hull(ts[i], 1, 0.015)).setY(sheer(ts[i]) + 0.012));
  gun.push(V3(HL, sheer(1) + 0.012, 0));
  for (let i = NT - 1; i > 0; i--) gun.push(V3(...hull(ts[i], -1, 0.015)).setY(sheer(ts[i]) + 0.012));
  gun.push(V3(-HL, sheer(-1) + 0.012, 0));
  bk.add(mats.boat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gun, true), 140, 0.03, 5, true));
  // small decks over either end, a line of silver down each
  for (const [t0, t1] of [[0.74, 0.995], [-0.995, -0.78]]) {
    const pos = [];
    const uv = [];
    const NR = 10;
    const NC = 5;
    for (let i = 0; i <= NR; i++) {
      const t = mix(t0, t1, i / NR);
      const w = Math.max(0.002, beam(t) - 0.012);
      for (let j = 0; j <= NC; j++) {
        const z = mix(-w, w, j / NC);
        pos.push(t * HL, sheer(t) - 0.015 + 0.03 * (1 - (z / w) ** 2), z);
        uv.push(t * HL * 0.9, z * 0.9);
      }
    }
    bk.add(mats.boat, geoOf(pos, gridIdx(NR, NC, t1 < t0), uv));
    const mid = [];
    for (let i = 0; i <= 6; i++) {
      const t = mix(t0, t1, i / 6);
      mid.push([t * HL, sheer(t) + 0.016, 0]);
    }
    bk.add(mats.silver, tube(mid, 0.008, 0.005, { seg: 8, radial: 3 }));
  }
  // the swan's neck and head at the prow, an upswept tip at the stern
  const neck = [[3.0, 0.8, 0], [3.13, 1.04, 0], [3.21, 1.34, 0], [3.15, 1.62, 0], [3.02, 1.82, 0], [2.97, 1.97, 0], [3.03, 2.09, 0], [3.15, 2.13, 0]];
  bk.add(mats.boat, tube(neck, 0.085, 0.045, { seg: 24, radial: 8, uvK: 1 }));
  bk.add(mats.boat, ball(0.07, 12, 8), { p: [3.18, 2.12, 0], s: [1.45, 0.9, 0.85] });
  bk.add(mats.silver, new THREE.ConeGeometry(0.028, 0.15, 6), { p: [3.32, 2.08, 0], r: [0, 0, -Math.PI / 2 - 0.35] });
  for (const s of [-1, 1]) bk.add(mats.silver, ball(0.011, 6, 4), { p: [3.2, 2.14, s * 0.052] });
  bk.add(mats.boat, tube([[-2.98, 0.76, 0], [-3.13, 0.9, 0], [-3.23, 1.06, 0], [-3.27, 1.2, 0], [-3.23, 1.3, 0]], 0.06, 0.016, { seg: 12, radial: 6, uvK: 1 }));
  // silver inlaid along her: a line under the gunwale, and on either bow a
  // folded wing, its feathers fanning back from the shoulder
  const dP = (t, f) => {
    const e = 1e-3;
    const a = V3(...hull(t + e, f)).sub(V3(...hull(t - e, f)));
    const b = V3(...hull(t, f + e)).sub(V3(...hull(t, f - e)));
    return a.cross(b).normalize();
  };
  const onHull = (t, f, side) => {
    const nrm = dP(t, f);
    if (nrm.z * side < 0) nrm.negate();
    return V3(...hull(t, f)).addScaledVector(nrm, 0.009);
  };
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i <= 24; i++) line.push(onHull(mix(-0.9, 0.93, i / 24), side * 0.88, side));
    bk.add(mats.silver, tube(line, 0.009, 0.009, { seg: 36, radial: 3 }));
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const t = mix(0.86, 0.38 - k * 0.07, u);
        const f = side * (mix(0.8, 0.74 - k * 0.12, u) - Math.sin(u * Math.PI) * 0.03 * (k + 1));
        pts.push(onHull(t, f, side));
      }
      bk.add(mats.silver, tube(pts, 0.012, 0.005, { seg: 12, radial: 3 }));
    }
  }
  // floorboards, above the water she draws
  const FY = 0.2;
  const fpos = [];
  const fuv = [];
  const NFR = 18;
  for (let i = 0; i <= NFR; i++) {
    const t = mix(-0.74, 0.74, i / NFR);
    const yk = keel(t) + 0.03;
    const ys = sheer(t);
    const c = Math.pow(clamp01((FY - yk) / (ys - yk)), 1 / 1.3);
    const f = (Math.acos(1 - c) * 2) / Math.PI;
    const w = Math.max(0.02, (beam(t) - 0.035) * Math.sin((f * Math.PI) / 2));
    for (let j = 0; j <= 4; j++) {
      const z = mix(-w, w, j / 4);
      fpos.push(t * HL, FY, z);
      fuv.push(t * HL * 0.9, z * 1.6);
    }
  }
  bk.add(mats.boat, geoOf(fpos, gridIdx(NFR, 4), fuv));
  // ribs inside
  for (const t of [-0.62, -0.38, -0.14, 0.1, 0.33, 0.56]) {
    const pts = [];
    for (let j = 0; j <= 8; j++) pts.push(hull(t, mix(-0.9, 0.9, j / 8), 0.04));
    bk.add(mats.boat, tube(pts, 0.017, 0.017, { seg: 10, radial: 3 }));
  }
  // the thwarts; a sitter's origin 0.4 under each top
  const seats = [];
  for (const x of [0.99, -1.14]) {
    const w = beam(x / HL) - 0.05;
    bk.add(mats.boat, roundBox(0.25, 0.036, 2 * w, 0.012), { p: [x, 0.38, 0], uv: 1 });
    seats.push(V3(x - 0.06, 0.0, 0));
  }
  bk.build(g);
  // the paddles, laid in: shaft along their own y, a leaf blade at -y
  const paddle = () => {
    const pg = new THREE.Group();
    pg.name = 'paddle';
    const pk = parts();
    pk.add(mats.boat, cyl(0.019, 0.022, 1.32, 6), { p: [0, 0.18, 0], uv: 2 });
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.11, -0.12, 0.08, -0.32);
    leaf.quadraticCurveTo(0.03, -0.46, 0, -0.52);
    leaf.quadraticCurveTo(-0.03, -0.46, -0.08, -0.32);
    leaf.quadraticCurveTo(-0.11, -0.12, 0, 0);
    pk.add(mats.boat, new THREE.ExtrudeGeometry(leaf, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 5 }), { p: [0, -0.46, -0.007], uv: 3 });
    pk.add(mats.boat, roundBox(0.13, 0.04, 0.045, 0.015), { p: [0, 0.85, 0] });
    pk.add(mats.silver, cyl(0.026, 0.026, 0.05, 8), { p: [0, -0.46, 0] });
    pk.add(mats.silver, new THREE.ConeGeometry(0.03, 0.14, 4), { p: [0, -0.6, 0.012], s: [1, 1, 0.2], r: [0, 0, Math.PI] });
    pk.build(pg);
    return pg;
  };
  const pa = paddle();
  pa.position.set(0.9, FY + 0.03, 0.2);
  pa.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  const pb = paddle();
  pb.position.set(-1.0, FY + 0.03, -0.2);
  pb.rotation.set(Math.PI / 2, Math.PI, -Math.PI / 2);
  g.add(pa, pb);
  return { group: g, seats, paddles: [pa, pb], length: 2 * HL, beam: 1.2 };
}

// ── the Uruk-hai ──

// Where a point falls on the war-paint sheet: square q (0 a face, 1 Lurtz's
// face, 2 a shield, 3 bare), (u, v) 0..1 within it.
const sheet = (q, u, v) => [(q % 2) * 0.5 + 0.5 * Math.min(0.97, Math.max(0.03, u)), (q < 2 ? 0.5 : 0) + 0.5 * Math.min(0.97, Math.max(0.03, v))];
const BARE = sheet(3, 0.5, 0.5);

// The war-paint sheet, four squares: the White Hand of Saruman smeared
// across a face (the palm over the mouth, the fingers up over the eyes to
// the brow); the same on Lurtz, with his scars; the Hand painted on a
// shield; and nothing.
function warpaintCanvas() {
  const S = 256;
  const H = S / 2;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const hand = (q, { k = 1, x = 0.5, y = 0.5, face = false } = {}) => {
    ctx.save();
    ctx.setTransform(H * k, 0, 0, H * k, (q % 2) * H + (x - 0.5 * k) * H, (q < 2 ? 0 : H) + (y - 0.5 * k) * H);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(0.5, face ? 0.66 : 0.7, face ? 0.23 : 0.21, face ? 0.17 : 0.17, 0, 0, TAU);
    ctx.fill();
    // four fingers, a little apart; on a face they reach up over the eyes
    // to the brow
    const tip = face ? 0.22 : 0.05;
    for (const [x0, x1, y1, w] of [[0.36, 0.22, 0.13, 0.1], [0.45, 0.4, 0, 0.11], [0.55, 0.6, 0, 0.11], [0.64, 0.78, 0.14, 0.095]]) {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x0, 0.64);
      ctx.lineTo(x1, tip + y1 * (face ? 0.7 : 1));
      ctx.stroke();
    }
    // the thumb, out to the side and up
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(0.36, 0.76);
    ctx.quadraticCurveTo(0.2, 0.72, 0.1, face ? 0.56 : 0.5);
    ctx.stroke();
    ctx.restore();
  };
  hand(0, { face: true });
  hand(1, { face: true });
  hand(2, { k: 0.78, y: 0.48 });
  // roughen it: smeared by fingers on a face, brushed on a shield
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  const n = makeNoise(17);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4;
      const a = d[i + 3] / 255;
      const rough = fbm(n, px / 7, py / 7, { octaves: 3 });
      const streak = n(px / 2.2, py / 16);
      const face = py < H;
      const k = face ? a * (0.45 + rough * 0.7 + streak * 0.35) * 1.5 - 0.3 : a * (0.8 + rough * 0.3 + streak * 0.1) * 1.3 - 0.15;
      d[i] = d[i + 1] = d[i + 2] = 248;
      d[i + 3] = 255 * smooth(0.2, 0.55, k);
    }
  }
  ctx.putImageData(img, 0, 0);
  // Lurtz's scars, pale and puckered, across his brow and cheek
  ctx.save();
  ctx.setTransform(H, 0, 0, H, H, 0);
  ctx.strokeStyle = 'rgba(176, 150, 136, 0.95)';
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1, w] of [[0.12, 0.3, 0.42, 0.62, 0.03], [0.68, 0.12, 0.86, 0.44, 0.026], [0.6, 0.78, 0.9, 0.7, 0.022]]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + 0.03, (y0 + y1) / 2 - 0.03, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
  return c;
}

// One rigid part of a figure: its pieces merged into one geometry for the
// Uruk-hai's material, each coloured in its vertices (a colour, or
// fn(x, y, z, out, nx, ny, nz)), lit a little from above and mottled, with
// how much of it is iron and, where `paint` says (test(centre, normal) for
// a triangle, map(x, y, z) for its corners), its place on the war-paint
// sheet. `m` moves a piece after it is coloured.
function figPart(seed = 1) {
  const list = [];
  const n = makeNoise(seed);
  const c = V3();
  const nr = V3();
  const api = {
    add(geo, colour, { p, r, s, m = null, metal = 0, flat = false, paint = null, grain = 0.07 } = {}) {
      tf(geo, { p, r, s });
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (flat || !g.attributes.normal) g.computeVertexNormals();
      const P = g.attributes.position;
      const N = g.attributes.normal;
      const count = P.count;
      const col = new Float32Array(count * 3);
      const puv = new Float32Array(count * 2);
      const fixed = typeof colour === 'function' ? null : C(colour);
      for (let i = 0; i < count; i++) {
        const x = P.getX(i);
        const y = P.getY(i);
        const z = P.getZ(i);
        const ny = N.getY(i);
        if (fixed) _kc.copy(fixed);
        else colour(x, y, z, _kc, N.getX(i), ny, N.getZ(i));
        _kc.multiplyScalar((0.8 + 0.2 * (ny * 0.5 + 0.5)) * (1 - grain + n(x * 11 + z * 7, y * 11) * grain * 2));
        col[i * 3] = _kc.r;
        col[i * 3 + 1] = _kc.g;
        col[i * 3 + 2] = _kc.b;
      }
      for (let i = 0; i < count; i += 3) {
        let on = false;
        if (paint) {
          c.set(0, 0, 0);
          nr.set(0, 0, 0);
          for (let k = 0; k < 3; k++) {
            c.add(_pv.fromBufferAttribute(P, i + k));
            nr.add(_nv.fromBufferAttribute(N, i + k));
          }
          on = paint.test(c.multiplyScalar(1 / 3), nr.normalize());
        }
        for (let k = 0; k < 3; k++) {
          const [u, v] = on ? paint.map(P.getX(i + k), P.getY(i + k), P.getZ(i + k)) : BARE;
          puv[(i + k) * 2] = u;
          puv[(i + k) * 2 + 1] = v;
        }
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', P);
      out.setAttribute('normal', N);
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.setAttribute('metal', new THREE.BufferAttribute(new Float32Array(count).fill(metal), 1));
      out.setAttribute('puv', new THREE.BufferAttribute(puv, 2));
      if (m) out.applyMatrix4(m);
      list.push(out);
      return api;
    },
    build(material, name) {
      const geo = mergeGeometries(list);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, material);
      mesh.name = name;
      list.length = 0;
      return mesh;
    },
  };
  return api;
}

const URUK = {
  skin: [C(0x4c4238), C(0x403b36), C(0x55483c), C(0x4a403a)],
  lurtz: C(0x655e55),
  iron: C(0x232326),
  leather: C(0x2e241c),
  strap: C(0x3c2e22),
  hair: C(0x0d0b0a),
  steel: C(0x5a5d63),
  tooth: C(0xc4b48a),
  eye: C(0x4a3a14),
  shield: C(0x141313),
  wood: C(0x2a2018),
};
const mat4 = (p, r = [0, 0, 0]) => new THREE.Matrix4().compose(V3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V3(1, 1, 1));

// A heavy Uruk blade, up its own y from the grip: broad and single-edged,
// the edge bellied, the back curving away to a clipped point; a bar guard,
// a bound grip, an iron pommel.
function urukBlade(bk, m) {
  const pts = [[-0.026, 0.15], [-0.034, 0.45], [-0.046, 0.72], [-0.07, 0.92], [-0.03, 1.0], [0.052, 0.9], [0.078, 0.62], [0.064, 0.34], [0.046, 0.15]];
  const shape = shapeOf(pts.map(([x, y]) => [x - 0.08 * ((y - 0.15) / 0.85) ** 2, y]));
  bk.add(ext(shape, 0.016, 0, 1), URUK.steel, { p: [0, 0, -0.008], m, metal: 1, flat: true, grain: 0.15 });
  bk.add(B(0.2, 0.034, 0.05), URUK.iron, { p: [0.005, 0.135, 0], m, metal: 1 });
  bk.add(cyl(0.021, 0.023, 0.22, 6), URUK.strap, { p: [0, 0.015, 0], m });
  bk.add(ball(0.032, 6, 4), URUK.iron, { p: [0, -0.1, 0], m, metal: 1, flat: true });
}

// The round black shield of the Uruk-hai, its face towards its own +x:
// domed boards painted black with the White Hand on them, an iron rim.
function urukShield(bk, m) {
  const R = 0.39;
  const face = { test: (c, nrm) => nrm.x > 0.3, map: (x, y, z) => sheet(2, 0.5 - z / (2.1 * R), 0.5 + y / (2.1 * R)) };
  bk.add(lathe([[R - 0.015, 0], [0.3, 0.03], [0.16, 0.052], [0.001, 0.06]], 20), URUK.shield, { r: [0, 0, -Math.PI / 2], m, paint: face, grain: 0.12 });
  bk.add(new THREE.TorusGeometry(R - 0.008, 0.022, 4, 20), URUK.iron, { r: [0, Math.PI / 2, 0], m, metal: 1, flat: true });
  bk.add(new THREE.CircleGeometry(R - 0.01, 16), URUK.wood, { p: [-0.02, 0, 0], r: [0, -Math.PI / 2, 0], m });
}

// Lurtz's bow: long and black, its grip bound, held upright with its belly
// to +x; the string behind.
function urukBow(bk, m) {
  const limb = (sd) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * sd;
      pts.push([0.12 * (1 - t * t) - 0.06 * Math.pow(Math.abs(t), 6), t * 0.74, 0]);
    }
    return pts;
  };
  for (const sd of [-1, 1]) bk.add(tube(limb(sd), 0.03, 0.012, { seg: 10, radial: 5 }), URUK.shield, { m, metal: 0.3, grain: 0.1 });
  bk.add(cyl(0.03, 0.03, 0.15, 6), URUK.strap, { p: [0.12, 0, 0], m });
  bk.add(tube([[-0.06, -0.74, 0], [-0.02, 0, 0], [-0.06, 0.74, 0]], 0.004, 0.004, { seg: 2, radial: 3 }), C(0x8a8478), { m, grain: 0 });
}

// A Uruk-hai, about 2.1 m: bigger and broader than any Man of the toy
// world, hunched, long in the arm, dark brownish-grey (Lurtz paler, and
// scarred), long black hair, the White Hand smeared across his face; black
// iron on his chest, shoulders, knees, shins and forearms; a heavy curved
// blade in his right hand, and on his left arm the round black shield with
// the Hand on it (Lurtz, a black bow). Faces +x, on y = 0. One mesh for
// each part that moves (the legs, the body, the head, the arms, the blade
// arm's forearm), all of one material.
function uruk(K, seed = 1, { lurtz = false } = {}) {
  const mat = K.mats.uruk;
  const r = rng(seed * 13 + 5);
  const skinC = lurtz ? URUK.lurtz.clone() : URUK.skin[seed % URUK.skin.length].clone().multiplyScalar(0.92 + r() * 0.16);
  const skin = (x, y, z, out) => out.copy(skinC);
  const g = new THREE.Group();
  g.name = lurtz ? 'lurtz' : 'urukhai';
  const HIP = 1.0;

  // the legs, from the hips: leather breeches, iron knees and greaves,
  // the shins bound, heavy boots
  const legs = [-1, 1].map((sd) => {
    const leg = new THREE.Group();
    leg.position.set(0, HIP, sd * 0.17);
    const bk = figPart(seed * 5 + sd);
    bk.add(rod([0, 0.06, 0], [0.05, -0.47, 0], 0.14, 0.105, 8), URUK.leather);
    bk.add(ball(0.08, 7, 5), URUK.iron, { p: [0.085, -0.47, 0], s: [0.75, 1, 1.05], metal: 1, flat: true });
    bk.add(rod([0.05, -0.47, 0], [0, -0.86, 0], 0.1, 0.08, 7), skin);
    bk.add(new THREE.CylinderGeometry(0.112, 0.094, 0.34, 7, 1, true, Math.PI / 2 - 1.5, 3.0), URUK.iron, { p: [0.03, -0.68, 0], r: [0, 0, -0.12], metal: 1, flat: true });
    bk.add(cyl(0.096, 0.102, 0.09, 7), URUK.strap, { p: [0, -0.86, 0] });
    bk.add(ball(0.1, 8, 6), URUK.leather, { p: [0.07, -0.93, 0], s: [1.7, 0.72, 1.05] });
    leg.add(bk.build(mat, 'leg'));
    g.add(leg);
    return leg;
  });

  // the body, hunched: a barrel of a chest under a black breastplate, a
  // belt and a skirt of leather and iron strips, a bull's neck
  const torso = new THREE.Group();
  torso.position.y = HIP;
  g.add(torso);
  const tb = figPart(seed * 5 + 7);
  tb.add(sweep3([[0, -0.15, 0], [0.01, 0.14, 0], [0.04, 0.4, 0], [0.05, 0.6, 0]], [[0.17, 0.25, 0.16], [0.2, 0.27, 0.18], [0.24, 0.35, 0.21], [0.15, 0.32, 0.17]], { seg: 8, radial: 12, sq: 2.3 }), skin);
  const plate = sweep3([[0.01, -0.03, 0], [0.02, 0.18, 0], [0.045, 0.42, 0], [0.05, 0.57, 0]], [[0.215, 0.285, 0.19], [0.235, 0.3, 0.2], [0.275, 0.375, 0.23], [0.19, 0.345, 0.19]], { seg: 6, radial: 14, sq: 2.3, caps: [false, false] });
  tb.add(keepTris(plate, (c) => c.x > 0), URUK.iron, { metal: 1, flat: true });
  tb.add(new THREE.CylinderGeometry(0.29, 0.28, 0.09, 14, 1, true), URUK.strap, { p: [0.01, 0, 0], s: [0.78, 1, 1] });
  tb.add(B(0.04, 0.09, 0.1), URUK.iron, { p: [0.235, 0, 0], metal: 1 });
  for (let i = 0; i < 7; i++) {
    const a = -1.7 + (i / 6) * 3.4;
    const front = Math.abs(a) < 1;
    tb.add(B(0.025, 0.36, 0.15), front ? URUK.iron : URUK.leather, { p: [0.01 + Math.cos(a) * 0.215, -0.22, Math.sin(a) * 0.29], r: [0, -a, 0.16], metal: front ? 1 : 0, flat: true });
  }
  tb.add(B(0.025, 0.4, 0.34), URUK.leather, { p: [-0.18, -0.22, 0], r: [0, Math.PI, 0.16], flat: true });
  tb.add(rod([0.03, 0.48, 0], [0.13, 0.72, 0], 0.13, 0.1, 8), skin);
  for (const sd of [-1, 1]) tb.add(ball(0.13, 8, 6), skin, { p: [0, 0.56, sd * 0.19], s: [0.95, 0.62, 1.15] });
  if (lurtz) {
    // a quiver over his right shoulder, black-fletched arrows in it
    const qm = mat4([-0.24, 0.3, 0.06], [0.4, 0, 0.15]);
    tb.add(cyl(0.07, 0.06, 0.62, 7), URUK.leather, { m: qm });
    for (let i = 0; i < 5; i++) tb.add(new THREE.ConeGeometry(0.022, 0.12, 3), URUK.hair, { p: [(i % 2) * 0.04 - 0.02, 0.36 + (i % 3) * 0.03, (i - 2) * 0.022], m: qm });
  }
  torso.add(tb.build(mat, 'body'));

  // the head: a heavy brow, a broad flat nose, a jaw like a trap and two
  // fangs up out of it; small eyes; long black hair down the back and in
  // two locks over the shoulders. The Hand's paint is planed onto the face.
  const head = new THREE.Group();
  head.position.set(0.15, 0.83, 0);
  head.scale.setScalar(1.12);
  torso.add(head);
  const hb = figPart(seed * 5 + 11);
  const q = lurtz ? 1 : 0;
  const face = { test: (c, nrm) => nrm.x > 0.15 && c.x > 0.03, map: (x, y, z) => sheet(q, 0.5 + z / 0.44, 0.5 + (y + 0.02) / 0.48) };
  hb.add(ball(0.2, 14, 10), skin, { s: [1, 1.08, 0.92], paint: face });
  hb.add(ball(0.1, 8, 5), skin, { p: [0.15, 0.065, 0], s: [0.55, 0.3, 1.7], paint: face });
  hb.add(ball(0.06, 6, 4), skin, { p: [0.195, -0.035, 0], s: [0.85, 0.85, 1.35], paint: face });
  hb.add(B(0.2, 0.14, 0.27), skin, { p: [0.09, -0.15, 0], flat: true, paint: face });
  for (const sd of [-1, 1]) {
    hb.add(ball(0.02, 6, 4), URUK.eye, { p: [0.172, 0.014, sd * 0.068], grain: 0 });
    hb.add(new THREE.ConeGeometry(0.017, 0.065, 4), URUK.tooth, { p: [0.19, -0.11, sd * 0.075], grain: 0 });
    hb.add(new THREE.ConeGeometry(0.045, 0.13, 4), skin, { p: [-0.01, 0.03, sd * 0.19], r: [sd * 1.2, 0, 0.9] });
  }
  hb.add(new THREE.SphereGeometry(0.212, 12, 7, -2.05, 4.1, 0, 1.95), URUK.hair, { s: [1.02, 1.09, 0.95], p: [-0.005, 0.005, 0], grain: 0.2 });
  const hn = makeNoise(seed + 40);
  hb.add(sweep3([[-0.06, 0.15, 0], [-0.19, 0, 0], [-0.27, -0.3, 0], [-0.31, -0.64, 0]], [[0.1, 0.18, 0.1], [0.1, 0.21, 0.09], [0.08, 0.23, 0.07], [0.04, 0.2, 0.03]], { seg: 7, radial: 10, bump: (p, o, u, v) => (hn(u * 12, v * 3) - 0.5) * 0.06 * (0.3 + v) }), URUK.hair, { grain: 0.25 });
  for (const sd of [-1, 1]) hb.add(tube([[0, 0.03, sd * 0.19], [0.03, -0.22, sd * 0.235], [0.06, -0.48, sd * 0.25]], 0.05, 0.02, { seg: 5, radial: 5 }), URUK.hair, { grain: 0.25 });
  head.add(hb.build(mat, 'head'));

  // the arms, from the shoulders: bare and long, iron on the shoulders in
  // two lames and on the forearms
  const armAt = (sd) => {
    const sh = new THREE.Group();
    sh.position.set(0.03, 0.55, sd * 0.42);
    torso.add(sh);
    const ab = figPart(seed * 5 + 20 + sd);
    ab.add(rod([0, 0.05, 0], [0.02, -0.36, sd * 0.03], 0.11, 0.088, 8), skin);
    ab.add(new THREE.SphereGeometry(0.155, 9, 4, 0, TAU, 0, 1.2), URUK.iron, { p: [-0.005, 0.03, sd * 0.03], s: [1.05, 0.85, 1], r: [sd * 0.4, 0, 0], metal: 1, flat: true });
    ab.add(new THREE.SphereGeometry(0.168, 9, 1, 0, TAU, 1.05, 0.45), URUK.iron, { p: [-0.005, 0.0, sd * 0.05], s: [1.05, 0.9, 1], r: [sd * 0.45, 0, 0], metal: 1, flat: true });
    return { sh, ab };
  };
  const forearm = (bk, m) => {
    bk.add(rod([0, 0, 0], [0, -0.34, 0], 0.088, 0.07, 7), skin, { m });
    bk.add(new THREE.CylinderGeometry(0.092, 0.08, 0.2, 7, 1, true), URUK.iron, { p: [0, -0.2, 0], m, metal: 1, flat: true });
    bk.add(ball(0.078, 7, 5), skin, { p: [0.01, -0.4, 0], s: [1.1, 1, 0.9], m });
  };
  // the right: the blade arm, bending at the elbow
  const R = armAt(1);
  R.sh.add(R.ab.build(mat, 'arm'));
  const elbow = new THREE.Group();
  elbow.position.set(0.02, -0.36, 0.03);
  R.sh.add(elbow);
  const fb = figPart(seed * 5 + 30);
  forearm(fb, null);
  urukBlade(fb, mat4([0.01, -0.4, 0], [0, 0, -2.54]));
  elbow.add(fb.build(mat, 'forearm'));
  // the left, bent and held out: the shield, or Lurtz's bow
  const L = armAt(-1);
  forearm(L.ab, mat4([0.02, -0.36, -0.03], [0, 0, lurtz ? 0.55 : 0.95]));
  if (lurtz) urukBow(L.ab, mat4([0.24, -0.71, -0.05]));
  else {
    const sm = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), V3(0.45, 0.05, -0.89).normalize())).setPosition(0.17, -0.47, -0.17);
    urukShield(L.ab, sm);
  }
  L.sh.add(L.ab.build(mat, 'arm'));

  // running, the blade swung (0 carried, about half up behind the head, 1
  // brought down in a chop), the head turned to look
  const animate = (t, { running = false, swing = 0, look = 0 } = {}) => {
    const ph = t * 9.5;
    const sw = running ? Math.sin(ph) : 0;
    legs[0].rotation.set(0.05, 0, sw * 0.75);
    legs[1].rotation.set(-0.05, 0, -sw * 0.75);
    torso.position.y = HIP + (running ? Math.abs(Math.cos(ph)) * 0.09 - 0.05 : Math.sin(t * 1.7) * 0.012);
    const raise = smooth(0, 0.55, swing);
    const strike = smooth(0.55, 1, swing);
    torso.rotation.set(0, -0.28 * raise + 0.42 * strike, -(running ? 0.3 : 0.1) - strike * 0.15 + Math.sin(t * 1.7) * 0.012);
    L.sh.rotation.set(0, 0, -sw * 0.55 + (running ? 0.15 : 0.05));
    R.sh.rotation.set(-0.08 - 0.35 * raise * (1 - strike), 0, sw * 0.5 + 0.08 + raise * 3.2 - strike * 2.7);
    elbow.rotation.z = 0.35 + raise * 0.9 - strike * 1.15;
    // the head kept up as the body leans, and looking about
    head.rotation.set(0, look + (running ? 0 : Math.sin(t * 0.6 + seed) * 0.12), -torso.rotation.z * 0.6);
  };
  animate(0);
  return { group: g, animate, head, torso, legs, arms: [L.sh, R.sh], top: 2.1 };
}

// ── the Horn of Gondor ──

// Boromir's horn: a great curved ox-horn, cream-white, honey towards the
// mouthpiece, with a fine grain along it; bound in silver, a broad band at
// the bell and its rim, rings at the middle and the throat, a silver
// mouthpiece; a leather baldric cord from throat to bell. About half a
// metre round its curve, lying on its side with the bell to +x.
function horn(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'horn';
  const bk = parts();
  const n = makeNoise(77);
  const rad = (s) => 0.011 + 0.045 * Math.pow(s, 1.6) + 0.008 * smooth(0.9, 1, s);
  const ang = (s) => -1.25 + s * 2.5;
  const at = (s) => V3(0.2 * Math.sin(ang(s)), rad(s) + 0.002, 0.2 * Math.cos(ang(s)) - 0.12 + 0.03 * s);
  const N = 8;
  const pts = [];
  const radii = [];
  for (let i = 0; i <= N; i++) {
    pts.push(at(i / N));
    radii.push([rad(i / N), rad(i / N)]);
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const body = sweep3(pts, radii, { seg: 28, radial: 14, caps: [true, false] });
  const cream = C(0xece2c8);
  const honey = C(0xa8804a);
  tint(body, (x, y, z, out) => {
    const s = clamp01((Math.asin(Math.max(-1, Math.min(1, x / 0.2))) + 1.25) / 2.5);
    out.copy(honey).lerp(cream, smooth(0.02, 0.6, s));
    out.multiplyScalar(0.9 + (n(s * 3, (y + z) * 40) - 0.5) * 0.18);
  });
  bk.add(mats.horn, body);
  // the dark of the bell
  const dir = curve.getTangentAt(1);
  bk.add(mats.horn, ringAt(curve, 1, new THREE.CircleGeometry(rad(1) * 0.92, 14)).translate(-dir.x * 0.004, -dir.y * 0.004, -dir.z * 0.004), { color: 0x2a2016 });
  // silver: the bell's band and rim, rings at the middle and the throat
  bk.add(mats.silver, ringAt(curve, 0.955, new THREE.CylinderGeometry(rad(0.97) + 0.004, rad(0.94) + 0.004, 0.045, 18, 1, true).rotateX(Math.PI / 2)));
  bk.add(mats.silver, ringAt(curve, 1, new THREE.TorusGeometry(rad(1) + 0.002, 0.005, 5, 18)).translate(dir.x * 0.002, 0, dir.z * 0.002));
  for (const s of [0.48, 0.52, 0.12]) bk.add(mats.silver, ringAt(curve, s, new THREE.TorusGeometry(rad(s) + 0.002, 0.0045, 5, 14)));
  // the mouthpiece
  const m0 = curve.getPointAt(0);
  const d0 = curve.getTangentAt(0).negate();
  const mouth = lathe([[0.001, 0], [0.012, 0], [0.008, 0.02], [0.007, 0.045], [0.012, 0.055], [0.006, 0.058], [0.001, 0.058]], 10);
  mouth.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d0)).translate(m0.x - d0.x * 0.01, m0.y, m0.z - d0.z * 0.01);
  bk.add(mats.silver, mouth);
  // the cord, lying in a loose loop inside the curve
  const a = at(0.12);
  const b = at(0.955);
  bk.add(mats.wood, tube([[a.x, 0.006, a.z], [-0.08, 0.005, -0.02], [0.02, 0.005, -0.08], [0.12, 0.005, -0.03], [b.x, 0.01, b.z]], 0.004, 0.004, { seg: 18, radial: 4 }), { color: 0x4a3020 });
  bk.build(g);
  return { group: g };
}

// ── the falls of Rauros ──

// A great crag about w × h × d, its middle at the origin: a box rounded a
// little and pushed about by noise into ribs and ledges, faceted.
function cragGeo(seed, w, h, d, seg = 7) {
  const n = makeNoise(seed);
  let g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(mix(1, 0.6 / Math.max(v.length(), 0.3), 0.4));
    const rib = (fbm(n, v.x * 4 + v.z * 4, v.y * 1.1, { octaves: 4 }) - 0.5) * 0.55;
    const lump = (noise3(n, v.x * 2.6, v.y * 2.6, v.z * 2.6) - 0.5) * 0.45;
    // ledges: the sides stepped in as they go up
    const ledge = (Math.floor(v.y * 5 + 0.5) - v.y * 5) * 0.03;
    v.x *= 1 + rib + lump + ledge;
    v.z *= 1 + rib + lump + ledge;
    v.y += (noise3(n, v.x * 2.2 + 5, v.y * 1.6, v.z * 2.2) - 0.5) * (v.y > 0.3 ? 0.3 : 0.12);
    p.setXYZ(i, v.x * w, v.y * h, v.z * d);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// The falls of Rauros, a far set piece: the river comes down between two
// great rocky shoulders, dark with pines along their tops, and goes over
// a lip 120 m across in a long curving curtain 50 m high, split by two
// buttresses of rock, into a churn of foam and a smoke of mist. The front
// faces +z, the lip's middle at about (0, 50, -9), the foot at y = 0
// (sink it a metre under the lake). update(t) runs the water and the mist.
function rauros(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'rauros';
  const W = 60;
  const H = 50;
  const lipZ = (x) => -9 + 9 * (x / W) ** 2;

  // the sheet of water: the river sliding to the lip, then the fall
  const NX = 44;
  const NA = 6;
  const NF = 24;
  const pos = [];
  const uv = [];
  for (let j = 0; j <= NA + NF; j++) {
    const t = j <= NA ? -1 + j / NA : (j - NA) / NF;
    for (let i = 0; i <= NX; i++) {
      const x = -W - 3 + ((2 * W + 6) * i) / NX;
      const zl = lipZ(x);
      let y;
      let z;
      if (t <= 0) {
        y = H + 0.4 + t * t * 1.5;
        z = zl + t * 45;
      } else {
        const out = 1 - (1 - Math.min(1, t * 2.4)) ** 2;
        y = H + 0.4 - (H + 0.4) * Math.pow(t, 1.15);
        z = zl + 5 * out + 3 * smooth(0.82, 1, t) + Math.sin(x * 0.23) * 0.7 * t;
      }
      pos.push(x, y, z);
      uv.push(x / 10, t);
    }
  }
  const sheetMesh = new THREE.Mesh(geoOf(pos, gridIdx(NA + NF, NX, true), uv), mats.falls);
  sheetMesh.name = 'falls';
  g.add(sheetMesh);

  // the foam spreading from the foot
  {
    const fp = [];
    const fu = [];
    const NR = 6;
    for (let j = 0; j <= NR; j++) {
      for (let i = 0; i <= NX; i++) {
        const x = -W - 3 + ((2 * W + 6) * i) / NX;
        fp.push(x * (1 + j * 0.04), 1.25, lipZ(x) + 7 + j * 7);
        fu.push(i / NX, j / NR);
      }
    }
    const foam = new THREE.Mesh(geoOf(fp, gridIdx(NR, NX, true), fu), mats.foam);
    foam.name = 'foam';
    foam.renderOrder = 2;
    g.add(foam);
  }

  // the rock: two shoulders, two lower spurs at the foot, and the two
  // buttresses that split the fall
  const bk = parts();
  const crag = (seed, w, h, d, at) => {
    const geo = cragGeo(seed, w, h, d, 9);
    geo.translate(...at);
    paintHull(geo, [], stonePaint(seed + 9, { moss: 1.4, lichen: 0.4, damp: 1, base: C(0x67655f), vary: 0.2, scale: 7, ground: -2, streaks: 1 }));
    boxUV(geo, 0.07);
    bk.add(mats.rock, geo);
    return geo;
  };
  const shoulders = [
    crag(3, 64, 80, 70, [-W - 36, 26, -28]),
    crag(11, 46, 56, 40, [-W - 18, 18, -4]),
    crag(12, 34, 30, 56, [-W - 70, 10, -10]),
    crag(4, 62, 76, 68, [W + 35, 24, -26]),
    crag(13, 44, 50, 38, [W + 17, 15, -3]),
    crag(14, 36, 34, 52, [W + 68, 12, -14]),
  ];
  crag(5, 30, 22, 26, [-W - 4, 4, 16]);
  crag(6, 28, 18, 24, [W + 6, 3, 14]);
  crag(7, 9, 60, 16, [-20, 25, lipZ(-20) + 2]);
  crag(8, 8, 56, 14, [23, 23, lipZ(23) + 2]);
  // pines along the shoulders' tops, on their level ground
  const r = rng(9);
  const pines = [];
  for (const geo of shoulders) {
    const p = geo.attributes.position;
    const nrm = geo.attributes.normal;
    for (let i = 0, tries = 0; i < 14 && tries < 3000; tries++) {
      const k = Math.floor(r() * (p.count / 3)) * 3;
      if (nrm.getY(k) < 0.7) continue;
      const x = (p.getX(k) + p.getX(k + 1) + p.getX(k + 2)) / 3;
      const y = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3;
      const z = (p.getZ(k) + p.getZ(k + 1) + p.getZ(k + 2)) / 3;
      if (y < 22) continue;
      const s = 0.7 + r() * 0.6;
      const cone = new THREE.ConeGeometry(2.4 * s, 10 * s, 6).translate(x, y + 4.5 * s, z);
      const c = C(0x1e2e18).multiplyScalar(0.8 + r() * 0.5);
      pines.push(tint(cone, (px, py, pz, out, nx, ny) => out.copy(c).multiplyScalar(0.75 + 0.35 * ny)));
      i++;
    }
  }
  bk.add(mats.tree, mergeGeometries(pines.map((x) => x.toNonIndexed())));
  bk.build(g, { shadow: false, receive: false });

  // the mist at the foot, rising and drifting out
  {
    const COUNT = 46;
    const mp = [];
    const corner = [];
    const puff = [];
    const idx = [];
    for (let i = 0; i < COUNT; i++) {
      const x = -W + 4 + ((2 * W - 8) * (i + r() * 0.8)) / COUNT;
      const at = [x, 1 + r() * 5, lipZ(x) + 5 + r() * 6];
      const pf = [r() * 10, 16 + r() * 14, 0.025 + r() * 0.03, r()];
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        mp.push(...at);
        corner.push(cx, cy);
        puff.push(...pf);
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mg.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
    mg.setAttribute('puff', new THREE.Float32BufferAttribute(puff, 4));
    mg.setIndex(idx);
    mg.boundingSphere = new THREE.Sphere(V3(0, 25, 10), 110);
    const mist = new THREE.Mesh(mg, mats.mist);
    mist.name = 'mist';
    mist.renderOrder = 3;
    g.add(mist);
  }
  const u = mats.falls.uniforms;
  return {
    group: g,
    update(t) {
      u.uTime.value = t;
    },
  };
}

// ── the Eye ──

// The vision from the Seat of Seeing: the dark of Barad-dûr, tier on tier
// of black battlements, buttresses like blades and spires, narrowing up
// into two great prongs that curve out and in again like a crown; and
// cradled between them the Eye, wreathed in flame. About 40 m tall,
// standing on y = 0, the Eye at about y = 33; the prongs and the Eye open to ±z (to be seen from
// along x). Nothing in it takes the fog, and the tower's black catches the
// Eye's fire about its top. update(t, k), k 0..1 how fiercely it burns.
function eye(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'eye';
  const EYE = V3(0, 37.5, 0);
  const T = [];
  // the tiers, each narrower, turned against the one below
  [[0, 8, 14, 10.5], [8, 7, 9, 7.6], [15, 7, 7.2, 6.1], [22, 6, 5.8, 4.9], [28, 4, 4.6, 4.2]].forEach(([y0, h, r0, r1], i) => {
    T.push(tf(cyl(r1, r0, h, 8), { p: [0, y0 + h / 2, 0], r: [0, (i % 2) * 0.39, 0] }));
    // a battlement of spikes round its top
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU + (i % 2) * 0.39 + 0.39;
      T.push(tf(new THREE.ConeGeometry(0.5 + r1 * 0.04, 2 + (j % 2) * 1.5, 4), { p: [Math.cos(a) * r1 * 0.95, y0 + h + 0.8, Math.sin(a) * r1 * 0.95] }));
    }
  });
  // blade-like buttresses up the lower tiers, spires round the upper
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    T.push(tf(new THREE.ConeGeometry(1.6, 26, 4), { p: [Math.cos(a) * 9.2, 12, Math.sin(a) * 9.2], s: [0.35, 1, 1.5], r: [0, -a, 0] }));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    T.push(tf(new THREE.ConeGeometry(0.9, 11, 4), { p: [Math.cos(a) * 6.6, 25, Math.sin(a) * 6.6], r: [Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1] }));
  }
  // the two prongs, out and up and in, spurred along their backs
  for (const sd of [-1, 1]) {
    const P = [[0, 30, sd * 3.2], [0, 33.5, sd * 5.6], [0, 38, sd * 6.6], [0, 42.5, sd * 5.4], [0, 46, sd * 3.0]];
    T.push(sweep3(P, [[1.5, 2.2], [1.3, 1.6], [1.0, 1.15], [0.6, 0.6], [0.08, 0.08]], { seg: 14, radial: 6, side: [1, 0, 0] }));
    for (let k = 0; k < 5; k++) {
      const y = 32 + k * 2.6;
      const z = sd * (6.4 + Math.sin((k / 4) * Math.PI) * 1.2 - k * 0.15);
      T.push(tf(new THREE.ConeGeometry(0.35, 2.6, 4), { p: [0, y, z], r: [sd * (1.0 + k * 0.12), 0, 0] }));
    }
  }
  const bk = parts();
  const glow = C(0x8a2808);
  const base = C(0x0c0807);
  const to = V3();
  for (const piece of T) {
    const geo = piece.index ? piece.toNonIndexed() : piece;
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    tint(geo, (x, y, z, out, nx, ny, nz) => {
      to.set(EYE.x - x, EYE.y - y, EYE.z - z);
      const d = to.length();
      const facing = Math.max(0, (nx * to.x + ny * to.y + nz * to.z) / d);
      out.copy(base).lerp(glow, Math.min(1, Math.exp(-d / 7) * (0.3 + 0.9 * facing)));
    });
    bk.add(mats.tower, geo);
  }
  // drawn 46 m tall, brought down to 40
  const FIT = 40 / 46;
  for (const m of bk.build(g, { shadow: false, receive: false })) m.geometry.scale(FIT, FIT, FIT);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(26 * FIT, 26 * FIT), mats.eye);
  fire.position.copy(EYE).multiplyScalar(FIT);
  fire.renderOrder = 5;
  fire.frustumCulled = false;
  fire.name = 'eyeOfSauron';
  g.add(fire);
  const u = mats.eye.uniforms;
  return {
    group: g,
    update(t, k = 0.6) {
      u.uTime.value = t;
      u.uK.value = clamp01(k);
      mats.tower.color.setScalar(0.75 + 0.5 * clamp01(k));
    },
  };
}

// ── the kit ──

export function createAmonHenKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const stone = weatheredCanvas(S, 7);
  const moss = mossCanvas(S, 9);
  const wool = woolCanvas(S, 13);
  const grain = grainCanvas(S, 15);
  const tex = {
    stone: T(stone.c),
    stoneN: T(normalFromField(stone.field, S, S, 3), { srgb: false }),
    moss: T(moss.c),
    mossN: T(normalFromField(moss.field, S, S, 3), { srgb: false }),
    wool: T(wool.c, { repeat: [3, 3] }),
    woolN: T(normalFromField(wool.field, S, S, 2.4), { srgb: false, repeat: [3, 3] }),
    grain: T(grain.c),
    grainN: T(normalFromField(grain.field, S, S, 1.2), { srgb: false }),
    puff: T(puffCanvas(), { wrap: false }),
  };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  Object.assign(mats, {
    // pale old stone, its colour in its vertices; rock; carved statues
    ruin: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.93 }),
    rock: M({ map: tex.stone, normalMap: tex.stoneN, vertexColors: true, roughness: 0.96 }),
    statue: M({ map: tex.stone, normalMap: tex.stoneN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.92 }),
    moss: M({ map: tex.moss, normalMap: tex.mossN, vertexColors: true, roughness: 1 }),
    grass: M({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    leaves: M({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
    // the forest, for instancing: trees, ferns
    tree: M({ vertexColors: true, roughness: 0.9 }),
    fern: M({ vertexColors: true, roughness: 0.8 }),
    earth: M({ vertexColors: true, roughness: 1 }),
  });
  // the light of the woods, for metal and polished wood to catch
  const env = T(envCanvas(), { wrap: false });
  env.mapping = THREE.EquirectangularReflectionMapping;
  tex.env = env;
  tex.warpaint = T(warpaintCanvas(), { wrap: false });
  // the falls' water, foam and mist keep one clock; so does the Eye
  const fall = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 } };
  const glare = { uTime: { value: 0 }, uK: { value: 0.5 } };
  Object.assign(mats, {
    // what the scene instances and lays about: stone in its own colours
    // (boulders, broken columns), wood in its own (sticks, kindling)
    stone: mats.rock,
    wood: M({ vertexColors: true, roughness: 0.9 }),
    // the camp's blankets and packs: wool, dyed in their vertices
    blanket: M({ map: tex.wool, normalMap: tex.woolN, vertexColors: true, roughness: 1 }),
    // the elven boats, grey-white and fine-grained, and their silver
    boat: M({ map: tex.grain, normalMap: tex.grainN, color: 0xd2d7dc, roughness: 0.42, envMap: env, envMapIntensity: 0.35 }),
    silver: M({ color: 0xe8ecf2, metalness: 0.92, roughness: 0.22, envMap: env }),
    horn: M({ vertexColors: true, roughness: 0.36, envMap: env, envMapIntensity: 0.45 }),
    // the Uruk-hai: skin, hair, leather, black iron and the White Hand
    uruk: urukMaterial(tex.warpaint, env),
    // Rauros
    falls: fallsMaterial(fall),
    foam: foamMaterial(fall),
    mist: mistMaterial({ ...fall, uPuff: { value: tex.puff } }),
    // the Eye and its tower, far off, unfogged
    tower: new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }),
    eye: eyeMaterial(glare),
  });
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  K.tex = { ...K.tex, ...tex };

  return {
    ...kit,
    mats,
    K,
    seat: () => seat(K),
    ruinStair: (o) => ruinStair(K, o),
    king: (o) => king(K, o),
    pillar: (seed = 1) => pillarGeo(seed),
    pine: (seed = 1) => pineGeo(seed),
    beech: (seed = 1) => beechGeo(seed),
    fern: (seed = 1) => fernGeo(seed),
    mossRock: (seed = 1) => mossRockGeo(seed),
    stick: (seed = 1) => stickGeo(seed),
    fallenLeaves: (seed = 1, o) => fallenLeavesGeo(seed, o),
    camp: () => camp(K),
    boat: () => boat(K),
    uruk: (seed = 1, o = {}) => uruk(K, seed, o),
    horn: () => horn(K),
    rauros: () => rauros(K),
    eye: () => eye(K),
  };
}
