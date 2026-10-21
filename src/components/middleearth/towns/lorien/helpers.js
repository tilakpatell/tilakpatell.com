// Lothlórien’s small helpers, shared by its builders: colour by a field,
// painted geometry, lofts and slabs, a leaf blade, a halo. Moved out of
// props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const TAU = Math.PI * 2;
export const UP = new THREE.Vector3(0, 1, 0);
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (hex) => new THREE.Color(hex);

// ── small helpers ──

// Three dimensions of lumps from the two-dimensional noise.
export const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// The point at angle a and radius r in the ground plane, at height y.
export const polar = (a, r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];

// A colour on every vertex, from fn(x, y, z, out, i).
export const _kc = new THREE.Color();
export const _kc2 = new THREE.Color();
export function tint(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    fn(p.getX(i), p.getY(i), p.getZ(i), _kc, i);
    col[i * 3] = _kc.r;
    col[i * 3 + 1] = _kc.g;
    col[i * 3 + 2] = _kc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// A colour on every vertex from where it is and which way it faces:
// paint(p, normal, out).
export const _pv = V3();
export const _nv = V3();
export function paintGeo(geo, paint) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    _pv.fromBufferAttribute(p, i);
    _nv.fromBufferAttribute(nr, i);
    paint(_pv, _nv, _kc);
    col[i * 3] = _kc.r;
    col[i * 3 + 1] = _kc.g;
    col[i * 3 + 2] = _kc.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

// Geometries in one, for instancing: positions, normals and colours only.
export function oneGeo(list) {
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

// A geometry from plain arrays.
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
export function gridIdx(rows, cols, flip = false, base = 0) {
  const idx = [];
  const w = cols + 1;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = base + j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  return idx;
}

// A rounded body going round the y axis, its rings each [y, half-width,
// depth in front (+z), depth behind, squareness]; `push(a, y)` moves it
// out (a robe's folds, rough rock), `ox`, `oz` its middle. One smooth
// surface with no seam, closed top and bottom.
export function loftRound(rings, { radial = 48, push = null, a0 = -Math.PI / 2 } = {}) {
  const pos = [];
  for (const [y, wx, wf, wb, sq = 2.2, ox = 0, oz = 0] of rings) {
    for (let i = 0; i < radial; i++) {
      const a = a0 + (i / radial) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ec = Math.sign(c) * Math.pow(Math.abs(c), 2 / sq);
      const es = Math.sign(s) * Math.pow(Math.abs(s), 2 / sq);
      let x = ec * wx;
      let z = es * (s > 0 ? wf : wb);
      const d = push ? push(a, y, x, z) : 0;
      const l = Math.hypot(x, z) || 1;
      x += (x / l) * d;
      z += (z / l) * d;
      pos.push(ox + x, y, oz + z);
    }
  }
  const idx = [];
  const R = radial;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < R; i++) {
      const a = j * R + i;
      const b = j * R + ((i + 1) % R);
      idx.push(a, a + R, b, b, a + R, b + R);
    }
  }
  // the ends, fanned from their middles
  const last = rings.length - 1;
  const bc = pos.length / 3;
  pos.push(rings[0][5] ?? 0, rings[0][0], rings[0][6] ?? 0);
  const tc = pos.length / 3;
  pos.push(rings[last][5] ?? 0, rings[last][0], rings[last][6] ?? 0);
  for (let i = 0; i < R; i++) {
    const i1 = (i + 1) % R;
    idx.push(bc, i, i1);
    idx.push(tc, last * R + i1, last * R + i);
  }
  return geoOf(pos, idx);
}

// Lay a flat shape (drawn in x, y) down in the ground plane, its top at
// y = 0 and `depth` thick beneath; the shape's (x, y) become (x, z), so its
// angles are the ground plane's.
export function slab(shape, depth, bevel = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
  geo.rotateX(Math.PI / 2);
  if (bevel) geo.translate(0, -bevel, 0);
  return geo;
}

// A carved leaf `len` long and `wid` wide, pointed at both ends, rising up
// y from its stalk and curling out towards +z (`curl` radians by its tip),
// folded a little along its midrib; a thin solid, so it needs no
// double-sided material.
export function leafBlade(len, wid, { curl = 1, seg = 4, fold = 0.25, thick = 0.012 } = {}) {
  const pos = [];
  const idx = [];
  let py = 0;
  let pz = 0;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    if (i) {
      const a0 = curl * ((i - 0.5) / seg) ** 2;
      py += (Math.cos(a0) * len) / seg;
      pz += (Math.sin(a0) * len) / seg;
    }
    const ang = curl * t * t;
    const nx = -Math.sin(ang);
    const nz = Math.cos(ang);
    const half = wid * 0.5 * Math.pow(Math.sin(Math.PI * t), 0.8);
    const f = half * fold;
    pos.push(-half, py, pz, 0, py + nx * f, pz + nz * f, half, py, pz);
    pos.push(-half, py - nx * thick, pz - nz * thick, 0, py + nx * (f - thick), pz + nz * (f - thick), half, py - nx * thick, pz - nz * thick);
    if (i) {
      const a = (i - 1) * 6;
      const b = i * 6;
      idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      idx.push(a + 3, b + 3, a + 4, a + 4, b + 3, b + 4, a + 4, b + 4, a + 5, a + 5, b + 4, b + 5);
    }
  }
  return geoOf(pos, idx);
}

// A soft glow round a lamp: a sprite of the kit's halo, `size` across.
export function halo(K, parent, x, y, z, size = 1.3) {
  const s = new THREE.Sprite(K.mats.halo);
  s.name = 'halo';
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  s.renderOrder = 6;
  parent.add(s);
  return s;
}

// A canvas's brightness as a height field, for a normal map.
export function fieldOf(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  return f;
}

// Draw at (x, y) on a tiling canvas, again across any edge within `r`.
export function wrapAt(S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) {
    if (x + dx < -r || x + dx > S + r) continue;
    for (const dy of [-S, 0, S]) {
      if (y + dy < -r || y + dy > S + r) continue;
      fn(x + dx, y + dy);
    }
  }
}
