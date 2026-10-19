// Amon Hen’s small helpers, shared by its builders: colour by a field,
// merged and swept geometry, rods, grids. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, makeCanvas, makeNoise, mix, paintPixels, smooth } from '../../../../lib/paint';
import { boxUV } from '../../shire/build';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (hex) => new THREE.Color(hex);
export const UP = V3(0, 1, 0);

// Three dimensions of lumps from the two-dimensional noise.
export const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── small helpers ──

// A colour on every vertex, from fn(x, y, z, out, nx, ny, nz).
export const _kc = new THREE.Color();
export const _kd = new THREE.Color();
export function tint(geo, fn) {
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
export function oneGeo(list, { uv = false } = {}) {
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
export function prof(rows, t) {
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
export function sweep3(points, radii, { seg = 16, radial = 12, side = [0, 0, 1], sq = 2, bump = null, caps = [true, true] } = {}) {
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
export function rod(A, Bv, r0, r1, radial = 6) {
  const a = A.isVector3 ? A : V3(...A);
  const b = Bv.isVector3 ? Bv : V3(...Bv);
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a.x, a.y, a.z);
}

export const shapeOf = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
export const ext = (shape, depth, bevel = 0, curve = 6) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: curve });

// Colour a hull's triangles: each one's own normal says whether it is one of
// the block's faces or a worn edge between them.
export const _pv = V3();
export const _nv = V3();
// ── more helpers ──

// A geometry from plain arrays (as Lórien's).
export function geoOf(pos, idx, uv = null) {
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
export function gridIdx(rows, cols, flip = false) {
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
export function keepTris(geo, test) {
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
export const _zAxis = V3(0, 0, 1);
export function ringAt(curve, s, geo) {
  const p = curve.getPointAt(s);
  const t = curve.getTangentAt(s);
  return geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_zAxis, t)).translate(p.x, p.y, p.z);
}

// The light of the woods for metal and polished wood to catch, mapped round
// a sphere: a pale warm sky, the sun gold and low, the dark of the trees
// round the horizon and the brown floor below.
export function envCanvas() {
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
