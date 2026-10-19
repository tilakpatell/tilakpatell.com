// Mordor's small helpers, shared by its builders: profiles, colour by a
// field, swept tubes, lumps and rods, spikes, flat-shaded hulls of rock, one
// geometry from many, bones, and the cloud of cards, the gobbets and the
// glow the fire is drawn with (their materials are the kit's). Moved out of
// props.js as they were.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { blob, rng, tf } from '../../shire/build';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (hex) => new THREE.Color(hex);
export const UP = V3(0, 1, 0);

// Three dimensions of lumps from the two-dimensional noise.
export const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;
// ── small helpers ──

// Values along a profile of rows [t, a, b, …] at t, by Catmull-Rom.
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

// A colour on every vertex from fn(x, y, z, out, nx, ny, nz).
export const _kc = new THREE.Color();
export const _kc2 = new THREE.Color();
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
export const solid = (geo, c) => tint(geo, (x, y, z, out) => out.copy(c));

// A tube swept through points with an oval section: radii rows [front,
// side, back] at each point, so a limb can be deeper than it is wide.
export function sweep(points, radii, { seg = 12, radial = 10, side = [0, 0, 1], caps = [true, true] } = {}) {
  const P = points.map((p) => (p.isVector3 ? p.clone() : V3(...p)));
  const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  const n = P.length;
  const rows = radii.map((r, i) => [i / (n - 1), r[0], r[1] ?? r[0], r[2] ?? r[0]]);
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
  let run = 0;
  for (let k = 0; k <= seg; k++) {
    T.subVectors(cs[Math.min(seg, k + 1)], cs[Math.max(0, k - 1)]).normalize();
    Ts.push(T.clone());
    S.addScaledVector(T, -S.dot(T));
    if (S.lengthSq() < 1e-8) S.set(1, 0, 0).addScaledVector(T, -T.x);
    S.normalize();
    F.crossVectors(T, S);
    if (k) run += cs[k].distanceTo(cs[k - 1]);
    const [rf, rs, rb] = prof(rows, k / seg);
    for (let j = 0; j <= radial; j++) {
      const th = (j / radial) * TAU;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const p = cs[k].clone().addScaledVector(F, c * (c >= 0 ? rf : rb)).addScaledVector(S, s * rs);
      pos.push(p.x, p.y, p.z);
      uv.push(j / radial, run);
    }
  }
  for (let k = 0; k < seg; k++) {
    for (let j = 0; j < radial; j++) {
      const a = k * W + j;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  const cap = (k, dir) => {
    const [rf, rs] = prof(rows, k / seg);
    const c = cs[k].clone().addScaledVector(Ts[k], dir * Math.min(rf, rs) * 0.5);
    const ci = pos.length / 3;
    pos.push(c.x, c.y, c.z);
    uv.push(0.5, dir < 0 ? 0 : run);
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
  // one normal for the two copies of each ring's seam
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

// A lump: the Shire's blob, sized, turned and placed.
export const lump = (r, o = {}, { detail = 1, amp = 0.1, freq = 1.6, seed = 1 } = {}) => tf(blob(r, { detail, amp, freq, seed }), o);

// A tapering rod from A to B (radial 4 makes it a square beam).
export function rod(A, Bv, r0, r1, radial = 6) {
  const a = A.isVector3 ? A : V3(...A);
  const b = Bv.isVector3 ? Bv : V3(...Bv);
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(a.x, a.y, a.z);
}

// A geometry turned so its +y runs along `dir`, then moved to `at`.
function along(geo, dir, at) {
  const d = dir.isVector3 ? dir.clone() : V3(...dir);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  const p = at.isVector3 ? at : V3(...at);
  return geo.translate(p.x, p.y, p.z);
}

// A pointed spike from `at` along `dir`: a pyramid of `sides`.
export const spikeAt = (at, dir, len, r, sides = 4) => along(new THREE.ConeGeometry(r, len, sides).translate(0, len / 2, 0), dir, at);

// Flat-shaded: every triangle its own normal, for broken rock.
export function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  // a sliver of a triangle has no normal: give it one, or it lights as NaN
  const nr = g.attributes.normal;
  for (let i = 0; i < nr.count; i++) if (nr.getX(i) ** 2 + nr.getY(i) ** 2 + nr.getZ(i) ** 2 < 1e-10) nr.setXYZ(i, 0, 1, 0);
  return g;
}

// One geometry from several for one material: unindexed, each with a
// position, normal, uv and colour (and `extra` attributes kept, 1-wide).
export function oneGeo(list, extra = []) {
  const keep = ['position', 'normal', 'uv', 'color', ...extra];
  const out = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const k of extra) if (!g.attributes[k]) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n), 1));
    for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
    return g;
  });
  const g = mergeGeometries(out, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export const bone = (name, parent, p = [0, 0, 0]) => {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(...p);
  parent.add(o);
  return o;
};

// A geometry from flat arrays.
export function geoOf(pos, idx, uv = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (idx) g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A rough hull of rock: `count` points about an ellipsoid of half-sizes
// [a, b, c] at `at`, jittered. Flat-faced.
export function hullRock(seed, [a, b, c], at = [0, 0, 0], count = 14, flatBottom = true) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < count; i++) {
    const u = r() * TAU;
    const v = Math.acos(r() * 2 - 1);
    const k = 0.75 + r() * 0.35;
    let y = Math.cos(v) * b * k;
    if (flatBottom && y < -b * 0.3) y = -b * 0.3 - r() * 0.05 * b;
    pts.push(V3(at[0] + Math.sin(v) * Math.cos(u) * a * k, at[1] + y, at[2] + Math.sin(v) * Math.sin(u) * c * k));
  }
  return facet(new ConvexGeometry(pts));
}


// ── cards, gobbets and glows ──

// A cloud of cards for a flame or smoke material: `pts` the places they are
// born (in the parent's frame), each card its own seed. One draw.
export function cardCloud(material, pts, seed = 1) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  const em = new Float32Array(pts.length * 3);
  const sd = new Float32Array(pts.length * 4);
  const r = rng(seed);
  pts.forEach((p, i) => {
    em.set([p.x, p.y, p.z], i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  });
  geo.setAttribute('aEmit', new THREE.InstancedBufferAttribute(em, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 4));
  geo.instanceCount = pts.length;
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = material.blending === THREE.AdditiveBlending ? 6 : 5;
  return mesh;
}

// Points for the bomb material, all born at `at`, spread over `r`.
export function bombCloud(material, count, at, r0, seed = 1) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  const sd = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * r0;
    pos.set([at.x + Math.cos(a) * d, at.y, at.z + Math.sin(a) * d], i * 3);
    sd.set([r(), r(), r(), r()], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 4));
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  p.renderOrder = 7;
  return p;
}

// An added glow on a sprite.
export function glowSprite(map, colour, size, opacity = 1, fog = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: colour, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog }));
  s.scale.set(size, size, 1);
  s.renderOrder = 6;
  return s;
}
