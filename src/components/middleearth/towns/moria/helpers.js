// Moria’s small helpers, shared by its builders: colour by a field, planar
// UVs, faces split by their facing, outlines and frames, swept tubes, rock
// chunks and dressed blocks, the runes, the rock’s tone, a passage into the
// dark and a cloud of cards. Moved out of props.js as they were.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, mix, smooth } from '../../../../lib/paint';
import { blob, boxUV, rng, tf } from '../../shire/build';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const C = (hex) => new THREE.Color(hex);
export const UP = V3(0, 1, 0);

// Three dimensions of lumps from the two-dimensional noise.
export const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── small helpers ──

// Values along a profile of rows [t, a, b, …] at t, by Catmull-Rom, so a
// handful of rows make a smooth outline.
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

// Texture coordinates projected flat from the front (x, y): the box
// (x0, y0, w, h) to 0..1.
export function planarUV(geo, x0, y0, w, h) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - x0) / w;
    uv[i * 2 + 1] = (p.getY(i) - y0) / h;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// A geometry's triangles in two: those `test(normal)` picks, and the rest.
export function splitFaces(geo, test) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const names = Object.keys(g.attributes);
  const a = Object.fromEntries(names.map((k) => [k, []]));
  const b = Object.fromEntries(names.map((k) => [k, []]));
  const e1 = V3();
  const e2 = V3();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i += 3) {
    e1.set(p.getX(i + 1) - p.getX(i), p.getY(i + 1) - p.getY(i), p.getZ(i + 1) - p.getZ(i));
    e2.set(p.getX(i + 2) - p.getX(i), p.getY(i + 2) - p.getY(i), p.getZ(i + 2) - p.getZ(i));
    const out = test(e1.cross(e2).normalize()) ? a : b;
    for (const k of names) {
      const at = g.attributes[k];
      for (let v = i; v < i + 3; v++) for (let c = 0; c < at.itemSize; c++) out[k].push(at.array[v * at.itemSize + c]);
    }
  }
  const make = (o) => {
    const r = new THREE.BufferGeometry();
    for (const k of names) r.setAttribute(k, new THREE.Float32BufferAttribute(o[k], g.attributes[k].itemSize));
    return r;
  };
  return [make(a), make(b)];
}

// The outline of a doorway with angled shoulders, as the dwarves cut them:
// straight jambs `a` either side of x = 0 up to `hs`, then in at 45° to a
// flat head `top` high. From the left foot, over, to the right foot.
export function dwarfDoor(a, hs, top) {
  const k = Math.min(a * 0.7, top - hs);
  return [[-a, 0], [-a, hs], [-a + k, top], [a - k, top], [a, hs], [a, 0]];
}

// An outline pushed outwards by d (each corner mitred), its ends kept on y = 0.
export function offsetOutline(pts, d) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    // the outward normals of the edges either side (the outline runs
    // clockwise round the opening, so outward is to its left)
    const nrm = (q, r) => {
      const dx = r[0] - q[0];
      const dy = r[1] - q[1];
      const l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    };
    const n0 = i > 0 ? nrm(a, p) : nrm(p, b);
    const n1 = i < n - 1 ? nrm(p, b) : nrm(a, p);
    let mx = n0[0] + n1[0];
    let my = n0[1] + n1[1];
    const ml = Math.hypot(mx, my) || 1;
    mx /= ml;
    my /= ml;
    const k = d / Math.max(0.3, mx * n0[0] + my * n0[1]);
    out.push([p[0] + mx * k, i === 0 || i === n - 1 ? 0 : p[1] + my * k]);
  }
  return out;
}

export const shapeOf = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
export const ext = (shape, depth, bevel = 0) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 6 });

// A band of moulding round a doorway's outline, `w` wide and `depth` proud.
export function frameGeo(outline, w, depth, inset = 0) {
  const inner = inset ? offsetOutline(outline, inset) : outline;
  const outer = offsetOutline(outline, inset + w);
  return ext(shapeOf([...outer, ...inner.slice().reverse()]), depth);
}

// A smooth body swept along a path through `points`: at each a section `rx`
// deep (to the front, square to the path and to `side`) and `rz` wide,
// round (sq 2) or squarer (sq more); a third number is the depth behind,
// when the back is flatter or fuller than the front. The radii ease between
// the points, the section follows the path round without twisting, and the
// ends are domed shut. bump(p, out, u, v) may push a point out along `out`
// in metres. Texture u runs round, v along in metres.
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

// A lump: the Shire's blob, sized, turned and placed.
export const lump = (r, o = {}, { detail = 2, amp = 0.12, freq = 1.6, seed = 1 } = {}) => tf(blob(r, { detail, amp, freq, seed }), o);

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

// A geometry turned so its +y runs along `dir`, then moved to `at`.
export function along(geo, dir, at) {
  const d = dir.isVector3 ? dir.clone() : V3(...dir);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  const p = at.isVector3 ? at : V3(...at);
  return geo.translate(p.x, p.y, p.z);
}

// A lump of broken stone about `s` across: the hull of a few points.
export function chunkGeo(seed, s = 0.3, flat = 0.6, pts = 11) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < pts; i++) {
    const a = r() * TAU;
    const b = Math.acos(2 * r() - 1);
    const k = s * (0.55 + r() * 0.5);
    list.push(V3(Math.sin(b) * Math.cos(a) * k, Math.cos(b) * k * flat, Math.sin(b) * Math.sin(a) * k));
  }
  return new ConvexGeometry(list);
}

// A squared block w × h × d, its corners knocked about (each moved by up to
// `chip`), as a hull: flat-faced, worn at its edges.
export function blockGeo(w, h, d, seed, chip = 0.04) {
  const r = rng(seed);
  const list = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const c = V3((sx * w) / 2, (sy * h) / 2, (sz * d) / 2);
        // three points round each corner, so its edges are bevelled
        for (const ax of [0, 1, 2]) {
          const q = c.clone();
          const k = chip * (0.4 + r() * (r() < 0.25 ? 3 : 1));
          if (ax === 0) q.x -= sx * k;
          if (ax === 1) q.y -= sy * k;
          if (ax === 2) q.z -= sz * k;
          list.push(q);
        }
      }
    }
  }
  return new ConvexGeometry(list);
}

// The dwarves' runes, as strokes in a box 1 wide and 1 tall (y down): a
// stave and its twigs, as they were cut, to be read as Cirth.
export const RUNES = {
  A: [[[0.5, 1], [0.5, 0]], [[0.14, 0.32], [0.5, 0], [0.86, 0.32]]],
  B: [[[0.32, 0], [0.32, 1]], [[0.32, 0], [0.82, 0.26], [0.32, 0.5], [0.82, 0.76], [0.32, 1]]],
  C: [[[0.78, 0], [0.24, 0.5], [0.78, 1]]],
  D: [[[0.3, 0], [0.3, 1]], [[0.3, 0], [0.82, 0.3], [0.3, 0.62]]],
  E: [[[0.18, 1], [0.18, 0], [0.5, 0.34], [0.82, 0], [0.82, 1]]],
  F: [[[0.34, 0], [0.34, 1]], [[0.34, 0.42], [0.84, 0.08]], [[0.34, 0.74], [0.84, 0.4]]],
  G: [[[0.16, 0], [0.84, 1]], [[0.84, 0], [0.16, 1]]],
  H: [[[0.2, 0], [0.2, 1]], [[0.8, 0], [0.8, 1]], [[0.2, 0.3], [0.8, 0.7]]],
  I: [[[0.5, 0], [0.5, 1]]],
  K: [[[0.36, 0], [0.36, 1]], [[0.84, 0.08], [0.36, 0.5], [0.84, 0.92]]],
  L: [[[0.4, 0], [0.4, 1]], [[0.4, 0], [0.86, 0.34]]],
  M: [[[0.18, 0], [0.18, 1]], [[0.82, 0], [0.82, 1]], [[0.18, 0], [0.82, 0.46]], [[0.82, 0], [0.18, 0.46]]],
  N: [[[0.5, 0], [0.5, 1]], [[0.22, 0.62], [0.78, 0.36]]],
  O: [[[0.5, 0], [0.86, 0.36], [0.5, 0.72], [0.14, 0.36], [0.5, 0]], [[0.14, 1], [0.5, 0.72], [0.86, 1]]],
  P: [[[0.3, 0], [0.3, 1]], [[0.3, 0], [0.8, 0.22], [0.8, 0.5], [0.3, 0.72]]],
  R: [[[0.32, 1], [0.32, 0], [0.82, 0.26], [0.32, 0.52], [0.82, 1]]],
  S: [[[0.8, 0], [0.22, 0.36], [0.78, 0.64], [0.2, 1]]],
  T: [[[0.5, 1], [0.5, 0]], [[0.12, 0.36], [0.5, 0], [0.88, 0.36]], [[0.12, 0.62], [0.5, 0.26], [0.88, 0.62]]],
  U: [[[0.2, 1], [0.2, 0], [0.8, 0.3], [0.8, 1]]],
  W: [[[0.36, 1], [0.36, 0], [0.82, 0.24], [0.36, 0.48]]],
  Z: [[[0.5, 0], [0.5, 1]], [[0.12, 0.2], [0.5, 0.5], [0.88, 0.2]]],
  Y: [[[0.5, 0], [0.5, 1]], [[0.12, 0.7], [0.5, 0.4], [0.88, 0.7]]],
};
// cut a line of runes (words split by spaces, a pair of points between them)
// into a 2D context, `h` tall from (x, y), returning where it ended
export function cutRunes(g, text, x, y, h, { gap = 0.42, width = 0.62 } = {}) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') {
      g.beginPath();
      g.arc(cx + h * 0.12, y + h * 0.32, h * 0.055, 0, TAU);
      g.arc(cx + h * 0.12, y + h * 0.68, h * 0.055, 0, TAU);
      g.fill();
      cx += h * 0.42;
      continue;
    }
    const strokes = RUNES[ch] || RUNES.I;
    for (const s of strokes) {
      g.beginPath();
      s.forEach(([u, v], i) => (i ? g.lineTo(cx + u * h * width, y + v * h) : g.moveTo(cx + u * h * width, y + v * h)));
      g.stroke();
    }
    cx += h * (width + gap * 0.5);
  }
  return cx;
}

// A passage going back into the dark from a doorway's outline (the points
// from its left foot over to its right, at z0), `deep` long: its walls and
// floor seen from inside, pale at the mouth and black by the far end.
export function passageGeo(outline, z0, deep, { light = 0.32, steps = 6 } = {}) {
  const pos = [];
  const col = [];
  const tri = (...pts) => {
    for (const q of pts) {
      pos.push(...q);
      const t = light * Math.pow(1 - clamp01((z0 - q[2]) / deep), 2.2);
      col.push(t, t, t * 1.05);
    }
  };
  const x0 = outline[0][0];
  const x1 = outline[outline.length - 1][0];
  const yF = outline[0][1];
  for (let k = 0; k < steps; k++) {
    const za = z0 - (k / steps) * deep;
    const zb = z0 - ((k + 1) / steps) * deep;
    for (let i = 0; i < outline.length - 1; i++) {
      const [ax, ay] = outline[i];
      const [bx, by] = outline[i + 1];
      tri([ax, ay, za], [bx, by, zb], [bx, by, za]);
      tri([ax, ay, za], [ax, ay, zb], [bx, by, zb]);
    }
    tri([x0, yF, za], [x1, yF, za], [x1, yF, zb]);
    tri([x0, yF, za], [x1, yF, zb], [x0, yF, zb]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return boxUV(g, 0.5);
}

// The colour of the cliff's rock at a point on its face: grey with a cold
// cast, paler where it stands out and darker in its hollows, streaked where
// water runs down it, damp and green low down and on its ledges; smoother
// and evener on the dressed face round the doors (`dressed` 1).
export function rockTone(n, x, y, z, nrm, out, dressed = 0, relief = 0) {
  const v = noise3(n, x * 0.35, y * 0.35, z * 0.35);
  const vary = mix(0.26, 0.08, dressed);
  out.setRGB(0.33, 0.335, 0.345).multiplyScalar(1 - vary + v * vary * 2);
  const streak = smooth(0.56, 0.74, n(x * 1.3 + 5, y * 0.06)) * (1 - dressed);
  out.multiplyScalar(1 - streak * 0.45);
  // hollows and fissures darker, the edges that stand out paler
  out.multiplyScalar(clamp01(0.92 + relief * 0.75) * (1 - dressed) + dressed);
  const damp = (1 - smooth(0, 2.2, y)) * 0.8 + clamp01((nrm.y - 0.45) * 2.5) * smooth(0.45, 0.6, n(x * 0.7, y * 0.7 + 9));
  out.lerp(_kd.setRGB(0.12, 0.15, 0.1), clamp01(damp) * 0.75 * (1 - dressed * 0.85));
}

// A cloud of cards for a flame or smoke material: `pts` the places they are
// born (in the parent's frame), each card its own seed.
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
