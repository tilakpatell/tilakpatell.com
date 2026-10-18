// Moria, made in code: the kit the fifth walkable town is built from. The
// West-gate, the Doors of Durin drawn in ithildin on a sheer cliff with the
// holly trees either side, and the Watcher's arms coming up out of the pool;
// the Dwarrowdelf, a hall of great square pillars rising out of sight; the
// fork of three passages; the Chamber of Mazarbul, Balin's tomb in its shaft
// of grey daylight, the well, the dead and their broken arms, Ori's book;
// the stairs, broken, and the Bridge of Khazad-dûm over the abyss and its
// fire. And those who come: a cave troll, the goblins in their swarms, and
// Durin's Bane. Gandalf's staff-light, fallen stone and a fallen pillar to
// dress it all with.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are:
// its helpers, and its own materials for polished dark stone, carved
// dwarf-work, ithildin, wet hide, rock with fire in its cracks, smoke and
// flame. The same conventions: each builder's group stands on y = 0 at its
// origin, buildings and doorways face +z, creatures face +x, and fixed parts
// are merged one mesh per material. The shaders share one clock, the kit's
// tick(t); the creatures' own update calls move it too.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture, hot } from '../../../../lib/stage3d';
import { clamp01, fbm, greyFromField, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { B, ball, blob, boxUV, createShireKit, cyl, lathe, parts, rng, roundBox, tf, tube } from '../../shire/props';
import { createShot, createStride, createTracker, ease, footAt, legRig } from '../../creatures';
import { abyssMaterial, balrogFire, beamMaterial, dustPoints, fireSolidMaterial, flameMaterial, hide, ithildinGlow, revealable, rippleMaterial, smokeMaterial, sparkPoints, sunlitMaterial, underglow, wingMaterial } from './propsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);
const UP = V3(0, 1, 0);

// Three dimensions of lumps from the two-dimensional noise.
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── small helpers ──

// Values along a profile of rows [t, a, b, …] at t, by Catmull-Rom, so a
// handful of rows make a smooth outline.
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

// A colour on every vertex from fn(x, y, z, out, nx, ny, nz).
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

// Texture coordinates projected flat from the front (x, y): the box
// (x0, y0, w, h) to 0..1.
function planarUV(geo, x0, y0, w, h) {
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
function splitFaces(geo, test) {
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
function dwarfDoor(a, hs, top) {
  const k = Math.min(a * 0.7, top - hs);
  return [[-a, 0], [-a, hs], [-a + k, top], [a - k, top], [a, hs], [a, 0]];
}

// An outline pushed outwards by d (each corner mitred), its ends kept on y = 0.
function offsetOutline(pts, d) {
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

const shapeOf = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const ext = (shape, depth, bevel = 0) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 6 });

// A band of moulding round a doorway's outline, `w` wide and `depth` proud.
function frameGeo(outline, w, depth, inset = 0) {
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

// A lump: the Shire's blob, sized, turned and placed.
const lump = (r, o = {}, { detail = 2, amp = 0.12, freq = 1.6, seed = 1 } = {}) => tf(blob(r, { detail, amp, freq, seed }), o);

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

// A geometry turned so its +y runs along `dir`, then moved to `at`.
function along(geo, dir, at) {
  const d = dir.isVector3 ? dir.clone() : V3(...dir);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  const p = at.isVector3 ? at : V3(...at);
  return geo.translate(p.x, p.y, p.z);
}

// A lump of broken stone about `s` across: the hull of a few points.
function chunkGeo(seed, s = 0.3, flat = 0.6, pts = 11) {
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
function blockGeo(w, h, d, seed, chip = 0.04) {
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
const RUNES = {
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
function cutRunes(g, text, x, y, h, { gap = 0.42, width = 0.62 } = {}) {
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

// ── painted textures ──

// Polished stone of the deeps, nearly white so the material and the vertex
// colours give its hue: a fine dark grain of crystals, clouding, a few
// hairline veins, and worn patches where the polish has gone. With its
// height, for the normal map, and its roughness, low where it shines.
function basaltCanvas(S, seed) {
  const n = makeNoise(seed);
  const grains = makeCells(seed + 5);
  const field = new Float32Array(S * S);
  const rough = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const cloud = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const k = grains(u * 40, v * 40, 40);
    const crystal = (k.id - 0.5) * 0.7 - (1 - smooth(0, 0.08, k.f2 - k.f1)) * 0.25;
    const fine = n(u * 128, v * 128, 128);
    const vq = fbm(n, u * 2 + 5.3, v * 2 + 1.7, { period: 2, octaves: 5 });
    const vein = (1 - smooth(0, 0.016, Math.abs(vq - 0.5))) * smooth(0.42, 0.62, fbm(n, u * 3 + 11, v * 3, { period: 3, octaves: 2 }));
    const worn = smooth(0.56, 0.78, fbm(n, u * 6 + 2, v * 6 + 8, { period: 6, octaves: 4 }));
    const t = 0.64 + (cloud - 0.5) * 0.4 + crystal * 0.12 + (fine - 0.5) * 0.08 + vein * 0.1 + worn * 0.05;
    out[0] = 232 * t;
    out[1] = 236 * t;
    out[2] = 234 * t;
    field[py * S + px] = clamp01(0.5 + (fine - 0.5) * 0.12 + crystal * 0.04 - vein * 0.18);
    rough[py * S + px] = clamp01(0.3 + worn * 0.42 + (fine - 0.5) * 0.08 + vein * 0.12);
  });
  return { c, field, rough };
}

// Rough rock, the mountain's own: a coarse grain, a few sharp fractures,
// dark streaks where water has run down it, faint bedding; nearly white
// for the vertex colours. With its relief.
function rockCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const mid = fbm(n, u * 16 + 3, v * 16, { period: 16, octaves: 3 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 4, v * 4, 4);
    const crack = (1 - smooth(0, 0.018, k.f2 - k.f1)) * smooth(0.55, 0.66, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const streak = smooth(0.5, 0.85, n(u * 24, 3.5, 24)) * smooth(0.35, 0.7, fbm(n, u * 4, v * 4 + 7, { period: 4, octaves: 2 }));
    const bed = Math.sin((v * 6 + big * 1.2) * TAU) * 0.5 + 0.5;
    const t = 0.72 + (big - 0.5) * 0.36 + (mid - 0.5) * 0.22 - crack * 0.5 + (grain - 0.5) * 0.2 + (bed - 0.5) * 0.05 - streak * 0.26;
    out[0] = 230 * t;
    out[1] = 230 * t;
    out[2] = 228 * t;
    field[py * S + px] = clamp01(0.4 + big * 0.25 + mid * 0.25 + grain * 0.16 - crack * 0.5);
  });
  return { c, field };
}

// Dressed blocks for walls, in courses: big squared stones with fine
// joints, each its own shade, tooled faintly across its face, chipped at
// the arrises in places. One tile is two courses, the joints staggered.
function ashlarCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const JOINTS = [[0, 0.56], [0.24, 0.8]];
  paintPixels(c, (u, v, out, px, py) => {
    const row = v < 0.5 ? 0 : 1;
    const fv = (v * 2) % 1;
    const js = JOINTS[row];
    let du = 1;
    let blk = 0;
    for (let i = 0; i < js.length; i++) {
      const d = Math.abs(u - js[i]);
      du = Math.min(du, d, 1 - d);
      if (u >= js[i]) blk = i;
    }
    const dv = Math.min(fv, 1 - fv) / 2;
    const d = Math.min(du, dv);
    const chip = smooth(0.62, 0.8, fbm(n, u * 16, v * 16, { period: 16, octaves: 2 })) * 0.01;
    const joint = 1 - smooth(0.002, 0.007 + chip, d);
    const tone = n(row * 7.3 + blk * 3.1, 4.4) - 0.5;
    const cloud = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const tool = Math.sin((u * 64 + v * 32) * TAU) * 0.5 + 0.5;
    const t = 0.66 + tone * 0.22 + (cloud - 0.5) * 0.3 + tool * 0.03 - joint * 0.5;
    out[0] = 230 * t;
    out[1] = 236 * t;
    out[2] = 232 * t;
    field[py * S + px] = clamp01(0.62 + cloud * 0.12 + tool * 0.03 - joint * 0.6);
  });
  return { c, field };
}

// The great hall's floor, one bay of it between four pillars (they stand at
// the corners): long dark slabs in a band along each side, edged with a pale
// inlaid line; inside, nine big slabs, the middle one inlaid with a stepped
// lozenge. Each slab its own shade. With its relief.
function floorCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const hash = (a, b) => {
    const h = Math.sin(a * 127.1 + b * 311.7 + seed) * 43758.5453;
    return h - Math.floor(h);
  };
  const B0 = 0.07; // the band's half width, either side of the line between pillars
  paintPixels(c, (u, v, out, px, py) => {
    // distance to the band lines (u, v = 0 or 1)
    const eu = Math.min(u, 1 - u);
    const ev = Math.min(v, 1 - v);
    const inBand = eu < B0 || ev < B0;
    let joint;
    let tone;
    let inlay = 0;
    if (inBand) {
      // the band's slabs, long ways along it, 4 to a side
      const alongU = ev < B0 && eu >= B0;
      const t = alongU ? u : v;
      const across = alongU ? ev : eu;
      const f = (t * 4) % 1;
      const corner = eu < B0 && ev < B0;
      joint = corner ? Math.min(Math.abs(eu - B0), Math.abs(ev - B0)) : Math.min(Math.min(f, 1 - f) / 4, Math.abs(across - B0), across);
      tone = 0.55 + (hash(Math.floor(t * 4), alongU ? 1 : 2) - 0.5) * 0.12;
      inlay = 1 - smooth(0.004, 0.007, Math.abs(across - B0 + 0.012));
    } else {
      const x = (u - B0) / (1 - 2 * B0);
      const y = (v - B0) / (1 - 2 * B0);
      const fx = (x * 3) % 1;
      const fy = (y * 3) % 1;
      joint = Math.min(Math.min(fx, 1 - fx), Math.min(fy, 1 - fy)) / 3.5;
      const ix = Math.floor(x * 3);
      const iy = Math.floor(y * 3);
      tone = 0.8 + (hash(ix, iy) - 0.5) * 0.18;
      if (ix === 1 && iy === 1) {
        // the stepped lozenge: rings of squares, turned 45°
        const qx = Math.abs(fx - 0.5);
        const qy = Math.abs(fy - 0.5);
        const dd = qx + qy;
        const step = Math.max(Math.floor(qx * 12), Math.floor(qy * 12)) / 12;
        const ring = (r) => 1 - smooth(0.006, 0.012, Math.abs(Math.max(dd, step * 0.8) - r));
        inlay = Math.max(ring(0.36), ring(0.24), dd < 0.1 ? 1 : 0);
      }
    }
    const cloud = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const scuff = smooth(0.55, 0.8, fbm(n, u * 12 + 3, v * 12, { period: 12, octaves: 3 }));
    const j = 1 - smooth(0.0015, 0.004, joint);
    let t = tone + (cloud - 0.5) * 0.18 + scuff * 0.06 - j * 0.42;
    t = mix(t, 1.05, inlay * 0.75);
    out[0] = 220 * t;
    out[1] = 232 * t;
    out[2] = 226 * t;
    field[py * S + px] = clamp01(0.6 + cloud * 0.1 - j * 0.5 - inlay * 0.05);
  });
  return { c, field };
}

// Dwarf carving for bands and friezes, four kinds stacked one above the
// other (each repeating along its band): 0 nested chevrons; 1 a stepped
// key, running on; 2 runes cut in a raised panel between lozenges; 3
// stepped pyramids, up and down, locked together. The relief, for the
// normal map, and a picture of it (the stone darker down in the cuts).
const BANDS = 4;
function carvingCanvas(W = 512, H = 512) {
  const draw = makeCanvas(W, H);
  const g = draw.getContext('2d');
  const bh = H / BANDS;
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  const grey = (k) => {
    const v = Math.round(k * 255);
    return `rgb(${v},${v},${v})`;
  };
  g.lineJoin = 'miter';
  g.lineCap = 'butt';
  for (let b = 0; b < BANDS; b++) {
    const y0 = b * bh;
    g.save();
    g.beginPath();
    g.rect(0, y0, W, bh);
    g.clip();
    // the face, and raised fillets along its top and foot
    g.fillStyle = grey(0.45);
    g.fillRect(0, y0, W, bh);
    g.fillStyle = grey(0.85);
    g.fillRect(0, y0, W, bh * 0.1);
    g.fillRect(0, y0 + bh * 0.9, W, bh * 0.1);
    g.fillStyle = grey(0.2);
    g.fillRect(0, y0 + bh * 0.1, W, bh * 0.025);
    g.fillRect(0, y0 + bh * 0.875, W, bh * 0.025);
    const m0 = y0 + bh * 0.16;
    const m1 = y0 + bh * 0.84;
    const mh = m1 - m0;
    for (const dx of [-W, 0, W]) {
      g.save();
      g.translate(dx, 0);
      if (b === 0) {
        // nested chevrons: three raised zigzags, V-cut between
        const per = W / 8;
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = grey(0.95 - k * 0.08);
          g.lineWidth = mh * 0.11;
          g.beginPath();
          for (let i = -1; i <= 9; i++) {
            const x = i * per;
            const yA = m0 + mh * (0.12 + k * 0.28);
            g.lineTo(x, yA);
            g.lineTo(x + per / 2, yA + mh * 0.24);
          }
          g.stroke();
          g.strokeStyle = grey(0.1);
          g.lineWidth = mh * 0.04;
          g.beginPath();
          for (let i = -1; i <= 9; i++) {
            const x = i * per;
            const yA = m0 + mh * (0.12 + k * 0.28) + mh * 0.11;
            g.lineTo(x, yA);
            g.lineTo(x + per / 2, yA + mh * 0.24);
          }
          g.stroke();
        }
      } else if (b === 1) {
        // a stepped key: a square spiral hooking into the next, cut deep round it
        const per = W / 6;
        g.fillStyle = grey(0.12);
        g.fillRect(0, m0, W, mh);
        g.strokeStyle = grey(0.92);
        g.lineWidth = mh * 0.12;
        for (let i = -1; i <= 7; i++) {
          const x = i * per;
          const s = mh / 6;
          const pts = [[0, 5.4], [0, 0.6], [4.6, 0.6], [4.6, 4.2], [1.6, 4.2], [1.6, 2.2], [3.0, 2.2]];
          g.beginPath();
          pts.forEach(([px, py], j) => (j ? g.lineTo(x + px * s * (per / (6 * s)), m0 + py * s) : g.moveTo(x + px * s * (per / (6 * s)), m0 + py * s)));
          g.stroke();
          g.beginPath();
          g.moveTo(x, m0 + 5.4 * s);
          g.lineTo(x + per, m0 + 5.4 * s);
          g.stroke();
        }
      } else if (b === 2) {
        // runes in a raised panel, lozenges between the words
        g.fillStyle = grey(0.7);
        g.fillRect(0, m0 + mh * 0.06, W, mh * 0.88);
        g.strokeStyle = grey(0.08);
        g.fillStyle = grey(0.08);
        g.lineWidth = mh * 0.07;
        g.lineCap = 'round';
        const words = ['DURIN', 'KHAZAD', 'DUM', 'BARUK'];
        let x = 6;
        for (const w of words) {
          x = cutRunes(g, w, x, m0 + mh * 0.2, mh * 0.6, { gap: 0.5 });
          // a lozenge between
          g.beginPath();
          const cx = x + mh * 0.18;
          const cy = m0 + mh * 0.5;
          g.moveTo(cx, cy - mh * 0.22);
          g.lineTo(cx + mh * 0.13, cy);
          g.lineTo(cx, cy + mh * 0.22);
          g.lineTo(cx - mh * 0.13, cy);
          g.closePath();
          g.fill();
          x = cx + mh * 0.3;
        }
        g.lineCap = 'butt';
      } else {
        // stepped pyramids, pointing up and down by turns, cut round
        const per = W / 6;
        g.fillStyle = grey(0.14);
        g.fillRect(0, m0, W, mh);
        for (let i = -1; i <= 7; i++) {
          for (const up of [1, -1]) {
            const cx = i * per + (up > 0 ? 0 : per / 2);
            g.fillStyle = grey(up > 0 ? 0.9 : 0.72);
            for (let s = 0; s < 4; s++) {
              const w = per * 0.46 * (1 - s / 4);
              const h = mh * 0.22;
              const y = up > 0 ? m1 - mh * 0.06 - (s + 1) * h : m0 + mh * 0.06 + s * h;
              g.fillRect(cx - w, y, w * 2, h - 1);
            }
          }
        }
      }
      g.restore();
    }
    g.restore();
  }
  // soften the cuts a little, for the relief
  const field = new Float32Array(W * H);
  const d = g.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) field[i] = d[i * 4] / 255;
  const soft = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let k = -1; k <= 1; k++) s += field[y * W + ((x + k + W) % W)] + field[Math.min(H - 1, Math.max(0, y + k)) * W + x];
      soft[y * W + x] = s / 6;
    }
  }
  const n = makeNoise(31);
  const c = makeCanvas(W, H);
  paintPixels(c, (u, v, out, px, py) => {
    const h = soft[py * W + px];
    const t = (0.5 + h * 0.5 + (n(u * 64, v * 64, 64) - 0.5) * 0.08) * 255;
    out[0] = t * 0.97;
    out[1] = t;
    out[2] = t * 0.98;
  });
  return { c, field: soft, W, H };
}

// The lines of the Doors of Durin, in ithildin: white on black, for the
// doors' glow. The drawing covers the dressed face the doors are set in,
// 7 m wide and 10 m tall, the doors' foot at the middle of its bottom edge.
// Two pillars, each with a tree of the High-elves growing up it, under an
// arch lettered in the elves' script; the trees' boughs over the arch,
// crescent moons in them; within the arch the crown of Durin under seven
// stars, and his hammer and anvil; on the doors, the star of the house of
// Fëanor. A soft bloom round every line, for screens without bloom.
const GATE = { w: 7, h: 10, a: 1.8, hs: 3.2, pillar: [2.0, 2.8], cap: 5.6, spring: 6.1 };
function ithildinCanvas() {
  const k = 80;
  const W = GATE.w * k;
  const H = GATE.h * k;
  const lines = makeCanvas(W, H);
  const g = lines.getContext('2d');
  const X = (x) => (x + GATE.w / 2) * k;
  const Y = (y) => (GATE.h - y) * k;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const lw = (m) => {
    g.lineWidth = m * k;
  };
  const path = (pts, close = false) => {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
    if (close) g.closePath();
    g.stroke();
  };
  const arc = (cx, cy, r, a0, a1) => {
    g.beginPath();
    g.arc(X(cx), Y(cy), r * k, -a0, -a1, a1 > a0);
    g.stroke();
  };
  const curve = (pts) => {
    // a smooth line through points
    const cr = new THREE.CatmullRomCurve3(pts.map(([x, y]) => V3(x, y, 0)));
    path(cr.getPoints(pts.length * 10).map((p) => [p.x, p.y]));
  };
  const leaf = (x, y, ang, len, wid) => {
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * k * 0.5, -wid * k, len * k, 0);
    g.quadraticCurveTo(len * k * 0.5, wid * k, 0, 0);
    g.stroke();
    g.restore();
  };
  const crescent = (x, y, r, ang) => {
    // a crescent moon, its horns turned towards `ang`
    g.save();
    g.translate(X(x), Y(y));
    g.rotate(-ang);
    g.beginPath();
    g.arc(0, 0, r * k, Math.PI * 0.32, Math.PI * 1.68, false);
    g.arc(r * k * 0.42, 0, r * k * 0.78, Math.PI * 1.55, Math.PI * 0.45, true);
    g.closePath();
    g.stroke();
    g.restore();
  };
  const star = (x, y, r, rays, inner = 0.35) => {
    g.beginPath();
    for (let i = 0; i <= rays * 2; i++) {
      const a = (i / (rays * 2)) * TAU + Math.PI / 2;
      const rr = i % 2 ? r * inner : r;
      const px = X(x + Math.cos(a) * rr);
      const py = Y(y + Math.sin(a) * rr);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    }
    g.stroke();
  };
  const { a, hs, pillar, cap, spring } = GATE;

  // the doors' edge, just inside the stone
  lw(0.035);
  const da = a - 0.08;
  path([[-da, 0.05], [-da, hs]]);
  arc(0, hs, da, Math.PI, 0);
  path([[da, hs], [da, 0.05]]);
  lw(0.022);
  arc(0, hs, da - 0.12, Math.PI * 0.92, Math.PI * 0.08);

  // the pillars: base, shaft, capital; a tree up each
  const pc = (pillar[0] + pillar[1]) / 2;
  for (const s of [-1, 1]) {
    lw(0.035);
    const x0 = s * pillar[0];
    const x1 = s * pillar[1];
    path([[x0, 0.45], [x0, cap], [x1, cap], [x1, 0.45]]);
    path([[x0 - s * 0.1, 0.0], [x0 - s * 0.1, 0.45], [x1 + s * 0.1, 0.45], [x1 + s * 0.1, 0.0]]);
    path([[x0 - s * 0.15, cap], [x0 - s * 0.15, spring], [x1 + s * 0.15, spring], [x1 + s * 0.15, cap]], true);
    lw(0.02);
    path([[x0 - s * 0.15, cap + 0.17], [x1 + s * 0.15, cap + 0.17]]);
    crescent(s * pc, cap + 0.34, 0.11, Math.PI / 2);
    // the tree: a trunk winding up the shaft, its roots at the foot
    lw(0.028);
    for (const e of [-1, 1]) {
      const pts = [];
      for (let y = 0.5; y <= cap - 0.05; y += 0.25) pts.push([s * pc + e * 0.07 + Math.sin(y * 2.3 + e) * 0.06, y]);
      curve(pts);
    }
    for (const r of [-1, 0, 1]) curve([[s * pc + r * 0.06, 0.55], [s * pc + r * 0.18, 0.42], [s * pc + r * 0.28, 0.5]]);
    for (let y = 1.0; y < cap - 0.3; y += 0.55) {
      const x = s * pc + Math.sin(y * 2.3) * 0.06;
      leaf(x, y, Math.PI / 2 - 0.7, 0.22, 0.05);
      leaf(x, y + 0.2, Math.PI / 2 + 0.7, 0.22, 0.05);
    }
  }

  // the arch, lettered between two lines
  const R0 = pillar[0];
  const R1 = pillar[1];
  lw(0.035);
  arc(0, spring, R0, 0, Math.PI);
  arc(0, spring, R1, 0, Math.PI);
  lw(0.018);
  arc(0, spring, (R0 + R1) / 2, 0.06, Math.PI - 0.06);
  // the inscription, two lines in the elves' letters, round the arch
  const r = rng(808);
  for (const [rr, hh] of [[(R0 + R1) / 2 + 0.2, 0.26], [(R0 + R1) / 2 - 0.19, 0.24]]) {
    const span = Math.PI * 0.9;
    const count = Math.floor((span * rr) / (hh * 0.62));
    for (let i = 0; i < count; i++) {
      const ang = Math.PI - (Math.PI - span) / 2 - ((i + 0.5) / count) * span;
      if (r() < 0.12) continue; // a space between words
      g.save();
      g.translate(X(Math.cos(ang) * rr), Y(spring + Math.sin(ang) * rr));
      g.rotate(-(ang - Math.PI / 2));
      tengwa(g, r, hh * k);
      g.restore();
    }
  }

  // the boughs: from each capital over the arch and up the face, each
  // ending in a crescent moon, leaves along them
  lw(0.026);
  for (const s of [-1, 1]) {
    const bough = (pts, moon) => {
      curve(pts.map(([x, y]) => [s * x, y]));
      const [mx, my] = pts[pts.length - 1];
      crescent(s * mx, my + 0.16, 0.14, Math.PI / 2 - s * 0.4);
      for (let i = 1; i < pts.length - 1; i++) {
        const [x, y] = pts[i];
        leaf(s * x, y, Math.PI / 2 + s * 0.9, 0.2, 0.045);
        leaf(s * x, y, Math.PI / 2 - s * 0.2, 0.18, 0.04);
      }
      return moon;
    };
    bough([[pc, spring], [2.95, 7.0], [2.75, 8.2], [2.0, 9.0], [1.15, 9.45]]);
    bough([[pc + 0.25, spring], [3.25, 7.2], [3.25, 8.6], [2.95, 9.4]]);
    bough([[pc - 0.1, spring + 0.1], [2.4, 8.1], [1.6, 8.75], [0.55, 9.05]]);
  }

  // within the arch: the anvil and hammer, the crown, the seven stars
  lw(0.026);
  path([[-0.42, 5.62], [0.28, 5.62], [0.5, 5.55], [0.28, 5.5], [0.14, 5.42], [0.14, 5.3], [0.26, 5.22], [-0.26, 5.22], [-0.14, 5.3], [-0.14, 5.42], [-0.3, 5.5], [-0.42, 5.62]]);
  path([[0.36, 5.72], [-0.08, 5.98]]);
  path([[-0.2, 5.84], [-0.04, 6.1], [0.04, 6.05], [-0.12, 5.79]], true);
  path([[-0.44, 6.2], [0.44, 6.2]]);
  path([[-0.44, 6.32], [0.44, 6.32]]);
  path([[-0.44, 6.32], [-0.38, 6.62], [-0.2, 6.42], [0, 6.72], [0.2, 6.42], [0.38, 6.62], [0.44, 6.32]]);
  for (const [x, y] of [[-0.38, 6.66], [0, 6.77], [0.38, 6.66]]) {
    g.beginPath();
    g.arc(X(x), Y(y), 0.035 * k, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    const ang = Math.PI * (0.16 + (i / 6) * 0.68);
    star(Math.cos(ang) * 1.18, 6.3 + Math.sin(ang) * 1.18, 0.1, 6, 0.38);
  }

  // the star on the doors: eight long rays and eight short, round a ring
  const sy = 2.75;
  lw(0.026);
  star(0, sy, 0.78, 8, 0.24);
  lw(0.02);
  star(0, sy, 0.46, 8, 0.4);
  arc(0, sy, 0.15, 0, TAU);
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * TAU + Math.PI / 2;
    const rr = i % 2 ? 0.46 : 0.78;
    path([[Math.cos(ang) * 0.15, sy + Math.sin(ang) * 0.15], [Math.cos(ang) * rr * 0.9, sy + Math.sin(ang) * rr * 0.9]]);
  }

  // the bloom
  const out = makeCanvas(W, H);
  const o = out.getContext('2d');
  o.fillStyle = '#000';
  o.fillRect(0, 0, W, H);
  o.filter = 'blur(6px)';
  o.globalAlpha = 0.22;
  o.drawImage(lines, 0, 0);
  o.filter = 'blur(1.5px)';
  o.globalAlpha = 0.5;
  o.drawImage(lines, 0, 0);
  o.filter = 'none';
  o.globalAlpha = 1;
  o.drawImage(lines, 0, 0);
  return out;
}

// One letter of the elves' script, `h` px tall, centred on the origin (y
// down): a stem rising or falling, one or two bows on it, now and then a
// mark above.
function tengwa(g, r, h) {
  const w = h * 0.5;
  const kind = Math.floor(r() * 3);
  const top = kind === 1 ? -h * 0.55 : -h * 0.2;
  const bot = kind === 2 ? h * 0.55 : h * 0.2;
  const x0 = -w * 0.45;
  g.beginPath();
  g.moveTo(x0, top);
  g.lineTo(x0, bot);
  g.stroke();
  const bows = r() < 0.35 ? 2 : 1;
  for (let i = 0; i < bows; i++) {
    const bx = x0 + i * w * 0.42;
    g.beginPath();
    g.moveTo(bx, -h * 0.2);
    g.bezierCurveTo(bx + w * 0.55, -h * 0.24, bx + w * 0.55, h * 0.22, bx, h * 0.18);
    g.stroke();
  }
  if (r() < 0.5) {
    g.beginPath();
    if (r() < 0.5) g.arc(x0 + w * 0.3, -h * 0.42, h * 0.04, 0, TAU);
    else {
      g.moveTo(x0 + w * 0.1, -h * 0.36);
      g.lineTo(x0 + w * 0.45, -h * 0.5);
    }
    g.stroke();
  }
}

// A sprig of holly: glossy leaves, spined along their wavy edges and
// shining along their midribs, round a twig, and a few berries. On a clear
// ground, for leaf cards.
function hollyCanvas(S = 128) {
  const c = makeCanvas(S);
  const g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const r = rng(77);
  g.strokeStyle = '#3a3020';
  g.lineWidth = S * 0.03;
  g.beginPath();
  g.moveTo(S * 0.5, S * 0.98);
  g.lineTo(S * 0.5, S * 0.1);
  g.stroke();
  const leafAt = (x, y, ang, len) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    const wid = len * 0.34;
    const pts = [];
    const spines = 4;
    for (let i = 0; i <= spines * 2; i++) {
      const t = i / (spines * 2);
      const w = Math.sin(Math.PI * Math.min(1, t * 1.15)) * wid * (i % 2 ? 0.68 : 1.18);
      pts.push([t * len, w]);
    }
    const grad = g.createLinearGradient(0, -wid, 0, wid);
    grad.addColorStop(0, '#4f8a3e');
    grad.addColorStop(0.42, '#3a7030');
    grad.addColorStop(0.55, '#2c5a26');
    grad.addColorStop(1, '#1a3a18');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(0, 0);
    for (const [px, py] of pts) g.lineTo(px, -py);
    for (let i = pts.length - 1; i >= 0; i--) g.lineTo(pts[i][0], pts[i][1] * 0.9);
    g.closePath();
    g.fill();
    // the wax's shine either side of the midrib
    g.fillStyle = 'rgba(190,220,170,0.35)';
    g.beginPath();
    g.ellipse(len * 0.45, -wid * 0.28, len * 0.3, wid * 0.16, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(200,225,170,0.7)';
    g.lineWidth = 1.3;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(len * 0.95, 0);
    g.stroke();
    g.restore();
  };
  for (let i = 0; i < 8; i++) {
    const y = S * (0.22 + (i / 8) * 0.72);
    const side = i % 2 ? 1 : -1;
    leafAt(S * 0.5, y, (side > 0 ? -0.45 : Math.PI + 0.45) + (r() - 0.5) * 0.4, S * (0.4 + r() * 0.08));
  }
  leafAt(S * 0.5, S * 0.18, -Math.PI / 2 + (r() - 0.5) * 0.3, S * 0.36);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = '#b8201a';
    g.beginPath();
    g.arc(S * (0.44 + r() * 0.12), S * (0.3 + r() * 0.42), S * 0.032, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,200,190,0.8)';
    g.beginPath();
    g.arc(S * 0.5, S * 0.5, 0, 0, TAU);
    g.fill();
  }
  return c;
}

// A soft round glow: the staff's light, a flame's halo.
function glowCanvas(S = 128) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.28)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.07)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, S, S);
  return c;
}

// Smooth noise in three channels, tiling, for the shaders (fire, heat,
// smoke, the shimmer of ithildin).
function noiseCanvas(S = 128) {
  const n1 = makeNoise(3);
  const n2 = makeNoise(17);
  const n3 = makeNoise(29);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    out[0] = fbm(n1, u * 4, v * 4, { period: 4, octaves: 4 }) * 255;
    out[1] = fbm(n2, u * 8, v * 8, { period: 8, octaves: 3 }) * 255;
    out[2] = fbm(n3, u * 2, v * 2, { period: 2, octaves: 5 }) * 255;
  });
}

// What polished metal and wet hide see at night in the open: a dark sky,
// the moon's glow high on one side, the cliff's black below.
function nightEnv(renderer) {
  return envFrom(renderer, [0.012, 0.016, 0.03], [0.05, 0.07, 0.12], [
    [0xc8d6f4, 2.2, 6, 5, [-6, 9, 4]],
    [0x8a9ab8, 0.6, 16, 4, [0, 4, -9]],
  ]);
}
// And in the deeps: near black, a cold light overhead, fire far below.
function caveEnv(renderer) {
  return envFrom(renderer, [0.006, 0.006, 0.008], [0.02, 0.022, 0.03], [
    [0xdfe8ff, 1.6, 3, 3, [2, 9, 5]],
    [0xff6a20, 1.2, 14, 3, [0, -9, 0]],
    [0x9aa8c0, 0.4, 10, 2, [-8, 2, -4]],
  ]);
}
function envFrom(renderer, low, high, lamps) {
  const room = new THREE.Scene();
  const walls = new THREE.BoxGeometry(20, 20, 20);
  const shade = [];
  const p = walls.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = (p.getY(i) + 10) / 20;
    shade.push(mix(low[0], high[0], k), mix(low[1], high[1], k), mix(low[2], high[2], k));
  }
  walls.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
  room.add(new THREE.Mesh(walls, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  for (const [hex, k, w, h, pos] of lamps) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
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

// A passage going back into the dark from a doorway's outline (the points
// from its left foot over to its right, at z0), `deep` long: its walls and
// floor seen from inside, pale at the mouth and black by the far end.
function passageGeo(outline, z0, deep, { light = 0.32, steps = 6 } = {}) {
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

// ── the West-gate ──

// The colour of the cliff's rock at a point on its face: grey with a cold
// cast, paler where it stands out and darker in its hollows, streaked where
// water runs down it, damp and green low down and on its ledges; smoother
// and evener on the dressed face round the doors (`dressed` 1).
function rockTone(n, x, y, z, nrm, out, dressed = 0, relief = 0) {
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

// A holly tree, `h` tall: a grey trunk forking into boughs, and a dense
// crown, broad below and narrowing up, of glossy spined leaves (cards of
// sprigs over dark clumps). Added to `bk` at (x, z).
function hollyParts(bk, K, x, z, h, seed) {
  const { mats } = K;
  const r = rng(seed);
  const n = makeNoise(seed);
  bk.at([x, 0, z], r() * TAU, () => {
    const lean = (r() - 0.5) * 0.3;
    const top = V3(lean * h * 0.12, h * 0.7, (r() - 0.5) * 0.3);
    bk.add(mats.hollyBark, tube([[0, -0.2, 0], [lean * 0.4, h * 0.3, 0.05], top.toArray()], 0.26, 0.1, { seg: 8, radial: 8, gnarl: 0.18, seed }), { uv: 1.2 });
    const clumps = [];
    const N = 22;
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const y = h * mix(0.2, 0.97, Math.pow(t, 0.85));
      // broad low down, to a point at the top
      const rad = h * 0.27 * Math.pow(1 - t, 0.7) * (0.7 + r() * 0.45) + 0.2;
      const a = i * 2.4 + r() * 0.8;
      const c = V3(Math.cos(a) * rad * 0.7 + top.x * (y / h), y, Math.sin(a) * rad * 0.7 + top.z * (y / h));
      clumps.push({ c, rr: h * 0.1 * (1.2 - t * 0.55) + r() * 0.25 });
      const from = V3(top.x * (y / h) * 0.6, Math.min(y - 0.5, h * 0.68), 0);
      bk.add(mats.hollyBark, tube([from.toArray(), from.clone().lerp(c, 0.5).add(V3(0, 0.2, 0)).toArray(), c.toArray()], 0.06, 0.025, { seg: 4, radial: 5 }), { uv: 2 });
    }
    for (const { c, rr } of clumps) bk.add(mats.hollyDark, lump(rr * 0.72, { p: c.toArray(), s: [1, 0.85, 1] }, { detail: 1, amp: 0.25, seed: seed + c.y }));
    // the sprigs, facing out, each lit half as the crown's round mass and
    // half as itself, so the crown reads as one and still glints
    const mid = V3(top.x, h * 0.55, top.z);
    const nrm = V3();
    for (const { c, rr } of clumps) {
      const cards = 52;
      for (let i = 0; i < cards; i++) {
        const d = V3(r() - 0.5, r() - 0.3, r() - 0.5).normalize();
        const at = c.clone().addScaledVector(d, rr * (0.7 + r() * 0.4));
        const s = 0.36 + r() * 0.22;
        const card = new THREE.PlaneGeometry(s, s);
        card.lookAt(d.clone().add(V3((r() - 0.5) * 1.2, (r() - 0.2) * 1.2, (r() - 0.5) * 1.2)));
        card.rotateZ(r() * TAU);
        const own = V3().fromBufferAttribute(card.attributes.normal, 0);
        card.translate(at.x, at.y, at.z);
        const out = at.clone().sub(mid).normalize();
        nrm.copy(out).multiplyScalar(0.6).addScaledVector(own, 0.4).normalize();
        const nr = card.attributes.normal;
        for (let k = 0; k < nr.count; k++) nr.setXYZ(k, nrm.x, nrm.y, nrm.z);
        const tone = 0.8 + n(at.x * 2, at.y * 2 + at.z) * 0.4;
        bk.add(mats.holly, card, { color: _kc.setRGB(tone, tone * (0.96 + r() * 0.08), tone * 0.94).clone() });
      }
    }
  });
}

// The Doors of Durin in the cliff at the West-gate, at night. The cliff is
// 40 m across and 25 m high, its face on z = 0 looking to +z, falling back at
// its ends and along its top; the doors are 3.6 m wide and 5 m tall in a
// dressed face 7 m wide, between two carved pillars under an arch, and they
// swing inwards (each leaf hinged at its outer edge) on a dark passage. The
// ithildin glows when the moon finds it: setIthildin(k), 0..1. Two holly
// trees stand at the cliff's foot, either side. doorCentre is the middle of
// the doors' face.
function westGate(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'westGate';
  const bk = parts();
  const n = makeNoise(41);
  const r = rng(43);
  const HW = GATE.w / 2;
  const PH = GATE.h;
  const away = (x, y) => Math.hypot(Math.max(0, Math.abs(x) - HW), Math.max(0, y - PH));
  // how far the face stands out from z = 0 at (x, y): great slow bulges,
  // buttresses of rock running up it split by deep fissures, ledges where
  // the beds lie, and a rough skin; flat round the doors, leaning back above
  // them, and falling away at the ends
  const reliefAt = (x, y) => {
    const q = fbm(n, x * 0.26 + 9, y * 0.03 + 2, { octaves: 3 });
    const fin = 1 - Math.abs(q * 2 - 1);
    const fissure = smooth(0.12, 0.0, Math.abs(q - 0.5)) * 1.1;
    const s = y * 0.4 + fbm(n, x * 0.07, y * 0.07, { octaves: 2 }) * 3;
    const ledge = smooth(0.72, 0.96, s - Math.floor(s)) * 0.45;
    const fine = (fbm(n, x * 0.8, y * 0.8, { octaves: 3 }) - 0.5) * 0.4;
    return fin * fin * 1.8 - fissure + ledge + fine;
  };
  const faceZ = (x, y) => {
    const f = smooth(0, 3.5, away(x, y));
    const big = (fbm(n, x * 0.04 + 3, y * 0.045, { octaves: 4 }) - 0.5) * 4.5;
    let z = f * (big + reliefAt(x, y));
    z -= Math.max(0, y - PH) * 0.06;
    const end = Math.max(0, Math.abs(x) - 12.5) / 7.5;
    z -= end * end * 7;
    return z;
  };
  const topAt = (x) => 24 + fbm(n, x * 0.09 + 50, 3.3, { octaves: 4 }) * 3 + (n(x * 0.6, 8.1) - 0.5) * 0.8 - Math.max(0, Math.abs(x) - 14) * 0.5;

  // ── the cliff: a grid half a metre square, its cells over the dressed
  // face left out, and its top falling back into the mountain
  const NX = 80;
  const NY = 48;
  const BACK = [[1.6, 0.5], [3.6, 0.9], [6.5, 0.7], [10, 0.2]];
  const rows = NY + 1 + BACK.length;
  const pos = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i <= NX; i++) {
      const x = -20 + (40 * i) / NX;
      let y;
      let z;
      if (j < NY) {
        y = j * 0.5;
        z = faceZ(x, y);
      } else if (j === NY) {
        y = topAt(x);
        z = faceZ(x, y);
      } else {
        const [dz, dy] = BACK[j - NY - 1];
        y = topAt(x) + dy + (n(x * 0.4, j) - 0.5) * 0.6;
        z = faceZ(x, topAt(x)) - dz;
      }
      pos.push(x + (j > NY ? (n(x, j * 3) - 0.5) * 0.3 : 0), y, z);
    }
  }
  const idx = [];
  const W1 = NX + 1;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < NX; i++) {
      const x = -20 + (40 * (i + 0.5)) / NX;
      const y = (j + 0.5) * 0.5;
      if (j < NY && Math.abs(x) < HW && y < PH) continue;
      const a = j * W1 + i;
      idx.push(a, a + 1, a + W1, a + 1, a + W1 + 1, a + W1);
    }
  }
  const cliff = new THREE.BufferGeometry();
  cliff.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  cliff.setIndex(idx);
  cliff.computeVertexNormals();
  planarUV(cliff, 0, 0, 4, 4);
  tint(cliff, (x, y, z, out, nx, ny, nz) => {
    const f = smooth(0, 3.5, away(x, y));
    rockTone(n, x, y, z, { x: nx, y: ny, z: nz }, out, 1 - f, f * (reliefAt(x, y) - 0.6 + (fbm(n, x * 0.04 + 3, y * 0.045, { octaves: 4 }) - 0.5) * 1.2) * 0.5);
  });
  bk.add(mats.cliff, cliff);

  // ── the dressed face, in one piece with the doorway cut from its foot
  const { a, hs } = GATE;
  const opening = [[-a, 0], [-a, hs]];
  for (let i = 1; i < 24; i++) {
    const t = Math.PI - (i / 24) * Math.PI;
    opening.push([Math.cos(t) * a, hs + Math.sin(t) * a]);
  }
  opening.push([a, hs], [a, 0]);
  const face = new THREE.ShapeGeometry(shapeOf([[-HW, 0], ...opening, [HW, 0], [HW, PH], [-HW, PH]]), 24);
  planarUV(face, -HW, 0, GATE.w, PH);
  tint(face, (x, y, z, out) => rockTone(n, x, y, 0, { x: 0, y: 0, z: 1 }, out, 1));
  bk.add(mats.ithildin, face);

  // the pillars and the arch in low relief, the ithildin running over them
  const relief = (geo) => {
    planarUV(geo, -HW, 0, GATE.w, PH);
    tint(geo, (x, y, z, out) => rockTone(n, x, y, 0, { x: 0, y: 0, z: 1 }, out, 1));
    const [front, sides] = splitFaces(geo, (nr) => nr.z > 0.7);
    bk.add(mats.ithildin, front);
    bk.add(mats.gateStone, sides);
  };
  const [p0, p1] = GATE.pillar;
  for (const s of [-1, 1]) {
    const pc = (s * (p0 + p1)) / 2;
    relief(tf(B(p1 - p0, GATE.cap - 0.45, 0.12), { p: [pc, (GATE.cap + 0.45) / 2, 0.06] }));
    relief(tf(B(p1 - p0 + 0.2, 0.45, 0.2), { p: [pc, 0.225, 0.1] }));
    relief(tf(B(p1 - p0 + 0.3, GATE.spring - GATE.cap, 0.22), { p: [pc, (GATE.cap + GATE.spring) / 2, 0.11] }));
  }
  const archRing = new THREE.Shape();
  archRing.absarc(0, 0, p1, 0, Math.PI, false);
  archRing.absarc(0, 0, p0, Math.PI, 0, true);
  relief(tf(ext(archRing, 0.14), { p: [0, GATE.spring, 0] }));

  // a worn threshold before the doors, and the passage behind them going
  // into the dark
  bk.add(mats.gateStone, roundBox(GATE.w + 0.8, 0.14, 1.5, 0.04), { p: [0, 0.03, 0.72], uv: 0.5 });
  bk.add(mats.gateStone, roundBox(2 * a + 0.4, 0.1, 0.5, 0.03), { p: [0, 0.05, -0.1], uv: 0.5 });
  const DEEP = 14;
  bk.add(mats.deep, passageGeo(opening, -0.35, DEEP));
  bk.add(mats.void, new THREE.PlaneGeometry(2 * a, hs + a), { p: [0, (hs + a) / 2, -0.35 - DEEP] });

  // scree and fallen boulders along the cliff's foot, clear of the doors
  for (let i = 0; i < 26; i++) {
    let x = -19 + r() * 38;
    if (Math.abs(x) < HW + 1.2) x = Math.sign(x || 1) * (HW + 1.2 + r() * 3);
    const s = 0.25 + Math.pow(r(), 2) * 1.2;
    const geo = chunkGeo(500 + i, s, 0.55 + r() * 0.3);
    tf(geo, { p: [x, s * 0.2, faceZ(x, 0.5) + 0.3 + r() * 1.6], r: [r(), r() * TAU, r() * 0.5] });
    tint(geo, (px, py, pz, out, nx, ny, nz) => rockTone(n, px, py + 4, pz, { x: nx, y: ny, z: nz }, out, 0));
    bk.add(mats.cliff, geo, { uv: 0.4 });
  }

  // the holly trees
  hollyParts(bk, K, -6.4, 2.8, 9, 3);
  hollyParts(bk, K, 6.6, 3.0, 8.4, 8);
  bk.build(g);

  // ── the doors: each leaf in its own group at its hinge
  const leaves = [-1, 1].map((s) => {
    const pts = [[0, 0], [s * a, 0], [s * a, hs]];
    for (let i = 1; i <= 12; i++) {
      const t = s > 0 ? (i / 12) * (Math.PI / 2) : Math.PI - (i / 12) * (Math.PI / 2);
      pts.push([Math.cos(t) * a, hs + Math.sin(t) * a]);
    }
    if (s < 0) pts.reverse();
    const geo = ext(shapeOf(s < 0 ? [[0, 0], ...pts.filter((p) => !(p[0] === 0 && p[1] === 0))] : pts), 0.3);
    geo.translate(-s * 0.005, 0, -0.34);
    planarUV(geo, -HW, 0, GATE.w, PH);
    tint(geo, (x, y, z, out) => rockTone(n, x, y, 0, { x: 0, y: 0, z: 1 }, out, 1));
    const hinge = V3(s * a, 0, -0.19);
    geo.translate(-hinge.x, 0, -hinge.z);
    const leaf = new THREE.Group();
    leaf.name = s < 0 ? 'doorL' : 'doorR';
    leaf.position.copy(hinge);
    g.add(leaf);
    const lk = parts();
    const [front, rest] = splitFaces(geo, (nr) => nr.z > 0.7);
    lk.add(mats.ithildin, front);
    lk.add(mats.gateStone, rest);
    lk.build(leaf);
    return { leaf, s };
  });

  const open = (k) => {
    const t = clamp01(k);
    for (const { leaf, s } of leaves) leaf.rotation.y = -s * t * 1.62;
  };
  const setIthildin = (k) => {
    K.U.uIthil.value = clamp01(k);
  };
  open(0);
  return { group: g, doorCentre: V3(0, 2.5, -0.04), open, setIthildin, leaves: leaves.map((l) => l.leaf) };
}

// ── the Watcher in the Water ──

// The skin of the Watcher's arms, for the normal map: fine wrinkles
// ringing them, wandering, and warty bumps between. u runs round the arm,
// v along it.
function tentacleCanvas(S = 256) {
  const n = makeNoise(61);
  const cells = makeCells(67);
  const field = new Float32Array(S * S);
  paintPixels(makeCanvas(S), (u, v, out, px, py) => {
    const w = fbm(n, u * 4, v * 4, { period: 4, octaves: 3 });
    const ring = Math.pow(0.5 + 0.5 * Math.sin((v * 18 + w * 2.5) * TAU), 3);
    const k = cells(u * 10, v * 10, 10);
    const wart = (1 - smooth(0.05, 0.32, k.f1)) * (k.id > 0.4 ? 1 : 0.3);
    field[py * S + px] = clamp01(0.5 + wart * 0.35 - ring * 0.3 + (n(u * 64, v * 64, 64) - 0.5) * 0.1);
    out[0] = out[1] = out[2] = 128;
  });
  return field;
}

// An arm of the Watcher, about 9.5 m from the root, rising out of the pool
// (y = 0 is the water's surface; the root is 2.5 m under it): thick and
// tapering to a whip of a tip, dark green-grey and wet, paler underneath
// where two rows of suckers run up it. A chain of bones bends it.
// update(t, k, strike): k (0..1) how far it has risen, curled and swaying
// when up; strike (0..1) brings it over and down along +x, to lie flat on
// the bank beyond the water, about 0.25 m up: rolling out from the root to
// the tip like a whip, the tip last. Its rising and sinking are eased, so
// it never jumps from one height to another.
function tentacle(K, seed = 1) {
  const { mats } = K;
  const r = rng(seed * 13 + 3);
  const n = makeNoise(seed * 7 + 1);
  const L = 9.6 + r() * 1.4;
  const NB = 22;
  const SEG = L / (NB - 1);
  const DEPTH = 2.5;
  const radius = (s) => 0.03 + 0.64 * Math.pow(1 - s, 1.35) * (1 + 0.04 * Math.sin(s * 38));
  const g = new THREE.Group();
  g.name = 'tentacle';

  // the arm, straight up its local y, the sucker side to +x
  const ys = [];
  const rad = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    ys.push([0, s * L, 0]);
    rad.push([radius(s) * 0.8, radius(s), radius(s) * 1.04]);
  }
  const arm = sweep3(ys, rad, { seg: 70, radial: 14, side: [0, 0, 1], sq: 2, caps: [true, true] });
  tint(arm, (x, y, z, out, nx) => {
    const s = y / L;
    const under = smooth(-0.1, 0.8, nx);
    const mottle = noise3(n, x * 3, y * 1.5, z * 3);
    const blotch = smooth(0.45, 0.62, noise3(n, x * 1.2 + 4, y * 0.7, z * 1.2));
    out.setRGB(0.075, 0.1, 0.075).multiplyScalar(0.6 + mottle * 0.8).lerp(_kd.setRGB(0.03, 0.04, 0.035), blotch * 0.6);
    out.lerp(_kd.setRGB(0.4, 0.36, 0.29), under * 0.85);
    out.lerp(_kd.setRGB(0.26, 0.27, 0.2), smooth(0.8, 1, s) * 0.4);
  });
  const geos = [arm];
  // the suckers: two staggered rows, big near the root and small to the tip
  const cup = (rs) => lathe([[0.001, -0.1 * rs], [0.5 * rs, -0.06 * rs], [0.7 * rs, 0.3 * rs], [1.0 * rs, 0.2 * rs], [1.04 * rs, -0.3 * rs]], 7);
  let sAt = 0.1;
  let row = 0;
  while (sAt < 0.92) {
    const rr = radius(sAt);
    const rs = rr * 0.34;
    const side = row % 2 ? 1 : -1;
    const ang = side * 0.42;
    const nrm = V3(Math.cos(ang) * 0.8, 0, Math.sin(ang)).normalize();
    const at = V3(nrm.x * rr * 0.86, sAt * L, nrm.z * rr * 1.0);
    const c = cup(rs);
    tint(c, (x, y, z, out) => {
      const d = Math.hypot(x, z) / rs;
      out.setRGB(0.5, 0.45, 0.4).lerp(_kd.setRGB(0.16, 0.12, 0.12), 1 - smooth(0.35, 0.6, d));
    });
    geos.push(along(c, nrm, at));
    sAt += (rs * 1.9) / L;
    row++;
  }
  const geo = mergeGeometries(geos.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    if (!y.attributes.uv) y.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(y.attributes.position.count * 2), 2));
    return y;
  }));
  // each point bound to the two bones either side of it
  const P = geo.attributes.position;
  const si = new Uint16Array(P.count * 4);
  const sw = new Float32Array(P.count * 4);
  for (let i = 0; i < P.count; i++) {
    const f = clamp01(P.getY(i) / L) * (NB - 1) - 1e-4;
    const b = Math.max(0, Math.floor(f));
    const w = f - b;
    si[i * 4] = b;
    si[i * 4 + 1] = Math.min(NB - 1, b + 1);
    sw[i * 4] = 1 - w;
    sw[i * 4 + 1] = w;
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mesh = new THREE.SkinnedMesh(geo, mats.tentacle);
  mesh.name = 'arm';
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const bones = [];
  for (let i = 0; i < NB; i++) {
    const b = new THREE.Bone();
    b.position.y = i ? SEG : 0;
    if (i) bones[i - 1].add(b);
    bones.push(b);
  }
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  const rise = new THREE.Group();
  rise.name = 'rise';
  rise.add(mesh);
  g.add(rise);

  // rings spreading on the water where it comes up
  const ripple = new THREE.Mesh(new THREE.PlaneGeometry(6, 6).rotateX(-Math.PI / 2), K.mats.ripple.clone());
  ripple.position.y = 0.03;
  ripple.renderOrder = 2;
  g.add(ripple);

  // the strike: how the arm lies when slammed down (its direction at each
  // bone, from straight up, negative towards +x), and how high its root
  // must be for the flat of it to lie on the bank
  const strikeDir = (s) => {
    const l = s * L;
    if (l < 2.0) return mix(0, -0.55, l / 2.0);
    if (l < 4.0) return mix(-0.55, -2.35, smooth(0, 1, (l - 2.0) / 2.0));
    if (l < 5.4) return mix(-2.35, -1.57, smooth(0, 1, (l - 4.0) / 1.4));
    return -1.57 + smooth(0.85, 1, s) * 0.6;
  };
  let low = 0;
  {
    let y = 0;
    for (let i = 1; i < NB; i++) {
      y += SEG * Math.cos(strikeDir((i - 1) / (NB - 1)));
      if ((i * SEG) > 5.6 && (i * SEG) < L * 0.85) low = Math.max(low, y);
    }
  }
  const strikeRoot = 0.25 - low;
  const ph = r() * TAU;
  const curl = 3.3 + r() * 0.8;
  const lean = -0.25 - r() * 0.3;
  const E = { t: null, e: 0 };
  const update = (t, k = 1, strike = 0) => {
    K.U.uTime.value = t;
    const dt = E.t == null || t < E.t ? 1 : Math.min(0.1, t - E.t);
    E.t = t;
    const want = clamp01(k);
    E.e = dt >= 1 ? want : ease(E.e, want, dt, want > E.e ? 7 : 4);
    const e = E.e;
    const up = 1 - Math.pow(1 - e, 3);
    const sk = clamp01(strike);
    const st = smooth(0, 1, sk);
    g.visible = e > 0.001;
    rise.position.y = mix(mix(-L - DEPTH - 1, -DEPTH, up), strikeRoot, st);
    let prev = 0;
    let prevS = 0;
    for (let i = 0; i < NB; i++) {
      const s = i / (NB - 1);
      // standing: a lean towards the bank, the top curled over in a hook,
      // swaying in a wave that runs up it
      const wave = Math.sin(t * 1.3 + ph - s * 5.5) * (0.12 + 0.5 * s) + Math.sin(t * 2.3 + ph * 2 - s * 9) * 0.12 * s;
      const hook = curl * Math.pow(smooth(0.35, 1, s), 1.4) * mix(0.25, 1, smooth(0.4, 1, e));
      const stand = lean * Math.min(1, s * 3) + -hook + wave * 0.35 + (1 - e) * Math.sin(t * 5 + s * 12) * 0.3 * s;
      // the slam rolls out along it, root first
      const ss = smooth(0, 1, clamp01(sk * 1.35 - s * 0.35));
      const dir = mix(stand, strikeDir(s) + Math.sin(t * 6 + s * 10) * 0.04 * s * (1 - st * 0.5), ss);
      const bone = mesh.skeleton.bones[i];
      bone.rotation.z = i ? dir - prev : dir;
      const side = Math.sin(t * 0.9 + ph + s * 3) * 0.06 * s * (1 - st);
      bone.rotation.x = i ? side - prevS : side;
      prev = dir;
      prevS = side;
    }
    const rm = ripple.material;
    rm.uniforms.uTime.value = t + ph;
    rm.uniforms.uK.value = smooth(0, 0.3, e) * (1 - 0.5 * st);
  };
  update(0, 0, 0);
  return { group: g, update, mesh, length: L };
}

// ── dwarf-work: octagons, bands ──

// A square `half` either side of the middle with its corners cut back by
// `ch`: eight points (x, z), round anticlockwise seen from below.
function octagon(half, ch) {
  const a = half;
  const b = half - ch;
  return [[a, -b], [a, b], [b, a], [-b, a], [-a, b], [-a, -b], [-b, -a], [b, -a]];
}

// A post of octagonal rings [{ y, half, ch }] one above the next: each of
// its eight faces smooth up its length and sharp at its corners; capped
// top and bottom if asked. Rings at one height with different sizes make
// a ledge.
function octLoft(rings, { top = false, bottom = false } = {}) {
  const R = rings.map(({ y, half, ch }) => octagon(half, ch).map(([x, z]) => [x, y, z]));
  const geos = [];
  for (let e = 0; e < 8; e++) {
    const pos = [];
    const idx = [];
    for (let k = 0; k < R.length; k++) pos.push(...R[k][e], ...R[k][(e + 1) % 8]);
    for (let k = 0; k < R.length - 1; k++) {
      const i = k * 2;
      idx.push(i, i + 3, i + 1, i, i + 2, i + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g.toNonIndexed());
  }
  const cap = (ring, up) => {
    const pos = [];
    const y = ring[0][1];
    for (let e = 0; e < 8; e++) {
      const p0 = ring[e];
      const p1 = ring[(e + 1) % 8];
      if (up) pos.push(0, y, 0, ...p1, ...p0);
      else pos.push(0, y, 0, ...p0, ...p1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    geos.push(g);
  };
  if (top) cap(R[R.length - 1], true);
  if (bottom) cap(R[0], false);
  return mergeGeometries(geos);
}

// The texture rows of one kind of carving (BANDS), kept clear of the next.
const bandV = (kind) => [1 - (kind + 1) / BANDS + 0.003, 1 - kind / BANDS - 0.003];

// A carved band round an octagonal post: a ring `proud` of it from y0, h
// tall, its faces carrying `kind` of carving (reading left to right as you
// face it), its top and foot plain.
function octBand(half, ch, y0, h, kind, proud = 0.04) {
  const [v0, v1] = bandV(kind);
  const outer = octagon(half + proud, ch + proud * 0.4).reverse();
  const inner = octagon(half, ch).reverse();
  const pos = [];
  const uv = [];
  const rep = h * 4;
  let u = 0;
  for (let e = 0; e < 8; e++) {
    const [ax, az] = outer[e];
    const [bx, bz] = outer[(e + 1) % 8];
    const len = Math.hypot(bx - ax, bz - az);
    const u0 = u / rep;
    const u1 = (u + len) / rep;
    u += len;
    // the face
    pos.push(ax, y0, az, bx, y0, bz, bx, y0 + h, bz, ax, y0, az, bx, y0 + h, bz, ax, y0 + h, az);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    // its top and foot, back to the post
    const [cx, cz] = inner[e];
    const [dx, dz] = inner[(e + 1) % 8];
    pos.push(ax, y0 + h, az, bx, y0 + h, bz, dx, y0 + h, dz, ax, y0 + h, az, dx, y0 + h, dz, cx, y0 + h, cz);
    pos.push(ax, y0, az, dx, y0, dz, bx, y0, bz, ax, y0, az, cx, y0, cz, dx, y0, dz);
    for (let i = 0; i < 12; i++) uv.push(u0, v1 - 0.002);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A straight carved band w wide, h tall and d deep, its middle at the
// origin and its face to +z: `kind` of carving along it (or up it, if
// `upright`), its other faces plain.
function bandBox(w, h, d, kind, { upright = false } = {}) {
  const [v0, v1] = bandV(kind);
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const p = g.attributes.position;
  const nr = g.attributes.normal;
  const uv = g.attributes.uv;
  const across = upright ? w : h;
  for (let i = 0; i < p.count; i++) {
    if (nr.getZ(i) > 0.5) {
      const x = p.getX(i);
      const y = p.getY(i);
      if (upright) uv.setXY(i, (y + h / 2) / (across * 4), mix(v0, v1, (x + w / 2) / w));
      else uv.setXY(i, (x + w / 2) / (across * 4), mix(v0, v1, (y + h / 2) / h));
    } else uv.setXY(i, 0.1, v1 - 0.002);
  }
  return g;
}

// One great pillar of the Dwarrowdelf, its foot at the origin: a stepped
// plinth, a polished octagonal shaft 2.6 m across with carved bands low and
// high and long sunk panels on its faces, a moulded capital, then flaring
// in two steps and a long curve to meet its neighbours `step` away, `top`
// up. Returns its stone and its carving, for merging.
function pillarGeos(step = 9, top = 30) {
  const stone = [];
  const carve = [];
  const H = 1.3;
  const CH = 0.24;
  const shaftTop = top - 8.4;
  stone.push(octLoft([{ y: 0, half: 1.95, ch: 0.45 }, { y: 0.42, half: 1.95, ch: 0.45 }], { top: true }));
  stone.push(octLoft([{ y: 0.42, half: 1.68, ch: 0.38 }, { y: 0.8, half: 1.68, ch: 0.38 }], { top: true }));
  stone.push(octLoft([{ y: 0.8, half: 1.5, ch: 0.3 }, { y: 1.0, half: 1.5, ch: 0.3 }, { y: 1.16, half: 1.36, ch: 0.26 }], { top: true }));
  stone.push(octLoft([{ y: 1.16, half: H, ch: CH }, { y: shaftTop, half: H, ch: CH }]));
  carve.push(octBand(H, CH, 2.2, 0.9, 2, 0.05));
  carve.push(octBand(H, CH, 3.28, 0.34, 0, 0.035));
  carve.push(octBand(H, CH, shaftTop - 1.7, 0.6, 3, 0.05));
  carve.push(octBand(H, CH, shaftTop - 0.95, 0.3, 1, 0.035));
  // the long sunk panels: a fillet round each of the four broad faces
  const b = H - CH;
  const y0 = 4.3;
  const y1 = shaftTop - 2.4;
  for (let f = 0; f < 4; f++) {
    for (const [w, h, x, y] of [[0.07, y1 - y0, -b + 0.18, (y0 + y1) / 2], [0.07, y1 - y0, b - 0.18, (y0 + y1) / 2], [2 * b - 0.29, 0.07, 0, y0], [2 * b - 0.29, 0.07, 0, y1]]) {
      stone.push(B(w, h, 0.05).translate(x, y, H + 0.012).rotateY((f * Math.PI) / 2));
    }
  }
  // the capital: a moulded collar, then the flare: two corbelled steps and
  // a long curve out to the vault
  stone.push(octLoft([
    { y: shaftTop, half: H, ch: CH },
    { y: shaftTop + 0.14, half: H + 0.12, ch: CH + 0.04 },
    { y: shaftTop + 0.45, half: H + 0.12, ch: CH + 0.04 },
    { y: shaftTop + 0.55, half: H, ch: CH },
  ]));
  const fy = shaftTop + 0.55;
  const flare = (t) => H + (step / 2 - H) * Math.pow(t, 2.3);
  const rings = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = mix(fy, top, t);
    const hh = flare(t);
    const chh = CH + (hh - H) * 0.32;
    if (i === 4 || i === 8) rings.push({ y, half: hh - 0.16, ch: chh - 0.05 }, { y: y + 0.002, half: hh + 0.04, ch: chh + 0.01 });
    else rings.push({ y, half: hh, ch: chh });
  }
  stone.push(octLoft(rings));
  return { stone, carve };
}

// ── the Dwarrowdelf ──

// A section of the great hall of Dwarrowdelf, `w` (along x) by `d`, its
// floor at y = 0 and its roof `top` up, lost in the dark: a grid of the
// great pillars `step` apart standing on a floor of big slabs, banded
// along the lines between them. pillars: [{ x, z, w }] (w across, for
// colliders). lightFrom(k, at): Gandalf risking a little more light — a
// cold glow from the staff (at the camera, or `at` in the world) catching
// the pillars' polish, reaching further and higher as k goes 0 → 1.
function hall(K, { w = 60, d = 40, step = 9, top = 30 } = {}) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'dwarrowdelf';
  const bk = parts();
  const n = makeNoise(91);
  const nx = Math.floor(w / step / 2);
  const nz = Math.floor(d / step / 2);
  const pillars = [];
  const { stone, carve } = pillarGeos(step, top);
  const one = mergeGeometries(stone.map((x) => {
    const y = x.index ? x.toNonIndexed() : x;
    for (const k of Object.keys(y.attributes)) if (k !== 'position' && k !== 'normal') y.deleteAttribute(k);
    return y;
  }));
  const oneCarve = mergeGeometries(carve);
  for (let i = -nx; i <= nx; i++) {
    for (let j = -nz; j <= nz; j++) {
      const x = i * step;
      const z = j * step;
      pillars.push({ x, z, w: 2.6 });
      const tone = 0.85 + n(i * 3.1, j * 2.7) * 0.3;
      const green = n(i * 1.7 + 9, j * 1.3) - 0.5;
      const geo = one.clone().translate(x, 0, z);
      tint(geo, (px, py, pz, out) => {
        const v = noise3(n, px * 0.4, py * 0.15, pz * 0.4);
        out.setRGB(tone * (0.95 - green * 0.06), tone * (0.98 + green * 0.05), tone).multiplyScalar(0.8 + v * 0.4);
        // grime at the foot, where hands and feet have been
        out.multiplyScalar(mix(0.7, 1, smooth(0, 1.6, py)));
      });
      bk.add(mats.hallStone, geo, { uv: 0.22 });
      bk.add(mats.hallCarve, oneCarve.clone().translate(x, 0, z));
    }
  }
  // the floor: one bay of its pattern between each four pillars
  const floor = new THREE.PlaneGeometry(w, d, 1, 1).rotateX(-Math.PI / 2);
  {
    const p = floor.attributes.position;
    const uv = floor.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + nx * step) / step, (p.getZ(i) + nz * step) / step);
  }
  bk.add(mats.hallFloor, floor);
  // the roof, far up in the dark
  const roof = new THREE.PlaneGeometry(w + step, d + step).rotateX(Math.PI / 2).translate(0, top + 0.01, 0);
  bk.add(mats.hallStone, tint(roof, (x, y, z, out) => out.setRGB(0.25, 0.27, 0.26)), { uv: 0.1 });
  bk.build(g);

  const lightFrom = (k, at = null) => {
    U.uReveal.value = clamp01(k);
    if (at) {
      U.uRevealAt.value.copy(at);
      U.uRevealCam.value = 0;
    } else U.uRevealCam.value = 1;
  };
  return { group: g, pillars, lightFrom, step, top };
}

// ── the fork ──

// Where the way divides: three dark passages side by side, each 3 m wide
// and 5 m tall with the dwarves' angled heads, in a carved surround 14.8 m
// wide at the top of three steps (the landing is 0.8 up). Stepped frames
// round each doorway, runes over them, chevroned pilasters between, a
// frieze and a stepped cornice over all. Its face is on z = 0, looking to
// +z; ways are the three thresholds.
function fork(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'fork';
  const bk = parts();
  const XS = [-4.8, 0, 4.8];
  const A = 1.5;
  const HS = 4.0;
  const TOP = 5.0;
  const Y0 = 0.8;
  const HW = 7.4;
  const HT = 11;
  const D = 1.2;
  const BACK = 9;
  const door = dwarfDoor(A, HS, TOP);
  // the steps, and the platform the passages run back on
  for (const [y, z1] of [[0.8, 1.0], [0.6, 1.45], [0.4, 1.9], [0.2, 2.35]]) {
    bk.add(mats.basalt, roundBox(2 * HW + 0.6, y, z1, 0.03), { p: [0, y / 2, z1 / 2], uv: 0.4, color: 0x9a9a96 });
  }
  bk.add(mats.basalt, B(2 * HW, Y0, BACK), { p: [0, Y0 / 2, -BACK / 2], uv: 0.3, color: 0x8a8a86 });
  // the wall, the three doorways cut up into it
  const outline = [[-HW, Y0]];
  for (const x of XS) for (const [px, py] of door) outline.push([x + px, Y0 + py]);
  outline.push([HW, Y0], [HW, HT], [-HW, HT]);
  bk.add(mats.ashlar, ext(shapeOf(outline), D), { p: [0, 0, -D], uv: 0.34, color: 0xb0b0ac });
  for (const x of XS) {
    const o = door.map(([px, py]) => [px, py]);
    // two stepped frames, the inner proud of the outer
    bk.add(mats.basalt, frameGeo(o, 0.34, 0.26), { p: [x, Y0, 0], uv: 0.5, color: 0xd0d4d0 });
    bk.add(mats.basalt, frameGeo(o, 0.24, 0.14, 0.34), { p: [x, Y0, 0], uv: 0.5, color: 0xa8aca8 });
    // runes over the doorway, and a stepped crest over that
    bk.add(mats.carve, bandBox(3.6, 0.55, 0.2, 2), { p: [x, Y0 + TOP + 0.95, 0.1] });
    for (let k = 0; k < 3; k++) bk.add(mats.basalt, B(2.6 - k * 0.8, 0.28, 0.16), { p: [x, Y0 + TOP + 1.38 + k * 0.28, 0.08], uv: 0.5, color: 0xc0c4c0 });
    // the passage
    bk.add(mats.deep, passageGeo(o.map(([px, py]) => [x + px, Y0 + py]), -D + 0.001, BACK - D));
    bk.add(mats.void, new THREE.PlaneGeometry(2 * A, TOP), { p: [x, Y0 + TOP / 2, -BACK + 0.01] });
  }
  // pilasters between the doorways and at the ends, chevrons up them
  for (const x of [-HW + 0.32, -2.4, 2.4, HW - 0.32]) {
    bk.add(mats.carve, bandBox(0.56, 7.1, 0.22, 0, { upright: true }), { p: [x, Y0 + 3.55, 0.11] });
    bk.add(mats.basalt, B(0.76, 0.3, 0.32), { p: [x, Y0 + 0.15, 0.16], uv: 0.5, color: 0xb8bcb8 });
  }
  // the frieze and the cornice over all
  bk.add(mats.basalt, B(2 * HW, 0.3, 0.26), { p: [0, Y0 + 7.25, 0.13], uv: 0.5, color: 0xc0c4c0 });
  bk.add(mats.carve, bandBox(2 * HW, 0.8, 0.2, 3), { p: [0, Y0 + 7.8, 0.1] });
  for (let k = 0; k < 3; k++) bk.add(mats.basalt, B(2 * HW + 0.3 + k * 0.3, 0.26, 0.3 + k * 0.18), { p: [0, Y0 + 8.33 + k * 0.26, 0.15 + k * 0.09], uv: 0.5, color: 0xc8ccc8 });
  bk.build(g);
  return { group: g, ways: XS.map((x) => V3(x, Y0, 0)), landing: Y0 };
}

// ── the Chamber of Mazarbul ──

// The top of Balin's tomb: white stone, veined grey, stained and dusty,
// within a cut border the runes in three lines, their cuts filled red-brown:
// Here lies Balin, son of Fundin, Lord of Moria. With its relief.
function tombCanvas(W = 512, H = 256) {
  const draw = makeCanvas(W, H);
  const g = draw.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'square';
  g.lineJoin = 'miter';
  g.lineWidth = 5;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 2.5;
  g.strokeRect(24, 24, W - 48, H - 48);
  for (const [x, y] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]]) {
    g.beginPath();
    g.moveTo(x, y - 11);
    g.lineTo(x + 11, y);
    g.lineTo(x, y + 11);
    g.lineTo(x - 11, y);
    g.closePath();
    g.fill();
  }
  g.lineWidth = 6;
  g.lineCap = 'round';
  const lines = ['HERE LIES BALIN', 'SON OF FUNDIN', 'LORD OF MORIA'];
  const h = 44;
  lines.forEach((text, i) => {
    const probe = makeCanvas(8).getContext('2d');
    const w = cutRunes(probe, text, 0, 0, h) - h * 0.5 * 0.42;
    cutRunes(g, text, (W - w) / 2, 46 + i * (h + 18), h);
  });
  const mask = new Float32Array(W * H);
  const d = g.getImageData(0, 0, W, H).data;
  for (let i = 0; i < W * H; i++) mask[i] = d[i * 4] / 255;
  const n = makeNoise(97);
  const field = new Float32Array(W * H);
  const c = makeCanvas(W, H);
  paintPixels(c, (u, v, out, px, py) => {
    const cut = mask[py * W + px];
    const cloud = fbm(n, u * 6, v * 3, { octaves: 4 });
    const vein = 1 - smooth(0, 0.02, Math.abs(fbm(n, u * 3 + 4, v * 1.5 + 2, { octaves: 4 }) - 0.5));
    const stain = smooth(0.55, 0.8, fbm(n, u * 4 + 9, v * 2, { octaves: 3 }));
    const t = 0.9 + (cloud - 0.5) * 0.12 - vein * 0.12 - stain * 0.1;
    let r = 236 * t;
    let gg = 230 * t;
    let b = 218 * t;
    r = mix(r, 112, cut);
    gg = mix(gg, 44, cut);
    b = mix(b, 28, cut);
    out[0] = r;
    out[1] = gg;
    out[2] = b;
    field[py * W + px] = clamp01(0.7 + cloud * 0.1 - cut * 0.55);
  });
  return { c, field, W, H };
}

// Mail: rows of riveted rings, each overlapping the next, for the dead
// dwarves' shirts. Grey, darker in the gaps. With its relief.
function mailCanvas(S = 128) {
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const R = 8;
  paintPixels(c, (u, v, out, px, py) => {
    let h = 0;
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const row = Math.floor((py + j * R) / R);
        const cy = row * R + R / 2;
        const cx = Math.floor((px + i * R - (row % 2) * R * 0.5) / R) * R + R / 2 + (row % 2) * R * 0.5;
        const dd = Math.hypot(px - cx, (py - cy) * 1.3);
        h = Math.max(h, smooth(0.5, 0, Math.abs(dd - R * 0.48) / (R * 0.22)));
      }
    }
    field[py * S + px] = h;
    const t = 40 + h * 170;
    out[0] = t;
    out[1] = t;
    out[2] = t * 1.03;
  });
  return { c, field };
}

// A page of Ori's book: old paper, browned at its edges and scorched at a
// corner, lines of runes in brown ink, a splash of something dark.
function pageCanvas(W = 256, H = 192) {
  const c = makeCanvas(W, H);
  const n = makeNoise(5);
  paintPixels(c, (u, v, out) => {
    const edge = Math.min(u, 1 - u, v, 1 - v);
    const burn = smooth(0.32, 0.12, Math.hypot(u - 1, v - 1) + (n(u * 9, v * 9) - 0.5) * 0.15);
    const t = 0.86 - (1 - smooth(0, 0.08, edge)) * 0.3 + (fbm(n, u * 5, v * 4, { octaves: 3 }) - 0.5) * 0.12;
    out[0] = 222 * t * (1 - burn * 0.8);
    out[1] = 196 * t * (1 - burn * 0.85);
    out[2] = 150 * t * (1 - burn * 0.9);
  });
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(70,40,20,0.85)';
  g.fillStyle = 'rgba(70,40,20,0.85)';
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  const words = ['WE CANNOT GET OUT', 'THE SHADOW MOVES', 'IN THE DARK', 'DRUMS DRUMS IN', 'THE DEEP', 'THEY ARE COMING'];
  for (const half of [0, 1]) {
    words.forEach((w, i) => {
      if (half === 1 && i > 3) return;
      cutRunes(g, w.slice(0, 10 + ((i * 3) % 6)), 14 + half * (W / 2), 16 + i * 26, 12, { gap: 0.3 });
    });
  }
  g.fillStyle = 'rgba(40,16,10,0.6)';
  g.beginPath();
  g.ellipse(W * 0.3, H * 0.78, 18, 10, 0.4, 0, TAU);
  g.fill();
  return c;
}

// A dwarf long dead in his mail, slumped where he fell, added to `bk` in
// its frame: sitting with his back to -x (a wall) and his legs out along
// +x, or perched on a well's edge 0.84 up (`perch`), bowed over his knees.
// Thick old bones gone brown, a broad mail shirt hanging on them belted at
// the waist, a grey beard still on his jaw, a helmet on his skull or fallen
// by him, heavy boots.
function deadDwarf(bk, K, { seed = 1, perch = false, lap = [false, true], helmet = true, knees = 0.3 } = {}) {
  const { mats } = K;
  const r = rng(seed);
  const n = makeNoise(seed + 3);
  const bone = (geo) => bk.add(mats.bone, tint(geo, (x, y, z, out) => out.setRGB(0.5, 0.43, 0.32).multiplyScalar(0.6 + noise3(n, x * 9, y * 9, z * 9) * 0.5)));
  const shaft = (a, b, r0) => {
    bone(rod(a, b, r0, r0 * 0.85, 7));
    bone(lump(r0 * 1.6, { p: a, s: [1, 0.85, 1] }, { detail: 1, amp: 0.1, seed: seed + a[1] }));
    bone(lump(r0 * 1.5, { p: b, s: [1, 0.85, 1] }, { detail: 1, amp: 0.1, seed: seed + b[1] }));
  };
  const tilt = (r() - 0.5) * 0.7;
  const hip = perch ? [0.2, 0.88, 0] : [0.22, 0.14, 0];
  const chest = perch ? [0.34, 1.16, tilt * 0.06] : [0.12, 0.44, tilt * 0.04];
  const neck = perch ? [0.46, 1.32, tilt * 0.12] : [0.08, 0.63, tilt * 0.08];
  const headAt = perch ? V3(0.56, 1.3, tilt * 0.16) : V3(0.17, 0.74 + r() * 0.03, tilt * 0.25 + (r() - 0.5) * 0.08);
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    const p = t < 0.6 ? V3(...hip).lerp(V3(...chest), t / 0.6) : V3(...chest).lerp(V3(...neck), (t - 0.6) / 0.4);
    bone(cyl(0.036, 0.036, 0.055, 6).translate(p.x, p.y, p.z));
  }
  bone(lump(0.15, { p: [hip[0], hip[1] + 0.02, 0], s: [0.8, 0.6, 1.35] }, { detail: 1, amp: 0.2, seed }));
  // the mail: broad over a dwarf's chest, short-sleeved, its hem ragged
  const mailAt = [[hip[0] + 0.03, hip[1] - 0.05, 0], [(hip[0] + chest[0]) / 2 + 0.03, (hip[1] + chest[1]) / 2, chest[2] * 0.5], chest, [neck[0] - 0.01, neck[1] - 0.05, neck[2]]];
  bk.add(mats.mail, sweep3(mailAt, [[0.21, 0.27], [0.22, 0.29], [0.21, 0.29], [0.11, 0.15]], { seg: 9, radial: 12, sq: 2.4, caps: [false, true], bump: (p, o, u, v) => (v < 0.2 ? (n(u * 24, 1) - 0.5) * 0.08 : 0.008 * Math.sin(u * 50)) }));
  bk.add(mats.leatherOld, new THREE.TorusGeometry(1, 0.06, 4, 16).scale(0.22, 0.27, 1).rotateX(Math.PI / 2).rotateZ(perch ? -0.45 : 0.25), { p: [(hip[0] + chest[0]) / 2 + 0.03, (hip[1] + chest[1]) / 2 - 0.02, 0] });
  bk.add(mats.rustIron, B(0.03, 0.07, 0.08), { p: [(hip[0] + chest[0]) / 2 + 0.25, (hip[1] + chest[1]) / 2 - 0.02, 0] });
  // the skull: brow, cheekbones, the jaw dropped; sockets dark; the beard
  const fall = perch ? -0.8 : -0.2 - r() * 0.35;
  const face = (geo) => geo.rotateZ(fall).rotateX(tilt).translate(headAt.x, headAt.y, headAt.z);
  bone(face(new THREE.SphereGeometry(0.11, 12, 9).scale(1.08, 1.0, 0.88)));
  bone(face(lump(0.05, { p: [0.08, 0.035, 0], s: [0.7, 0.45, 1.9] }, { detail: 1, amp: 0.1 })));
  for (const s2 of [-1, 1]) bone(face(lump(0.03, { p: [0.07, -0.03, s2 * 0.065] }, { detail: 0, amp: 0.1 })));
  bone(face(lump(0.065, { p: [0.065, -0.1, 0], s: [1.05, 0.55, 1.2] }, { detail: 1, amp: 0.12 })));
  for (const s2 of [-1, 1]) bk.add(mats.void, face(ball(0.028, 6, 4).translate(0.085, 0.01, s2 * 0.038)));
  bk.add(mats.void, face(ball(0.016, 5, 3).translate(0.105, -0.04, 0)));
  for (let k = 0; k < 5; k++) {
    const z0 = (k - 2) * 0.03;
    const len = 0.16 + r() * 0.12;
    bk.add(mats.beard, face(tube([[0.06, -0.12, z0], [0.1, -0.12 - len * 0.5, z0 * 1.2], [0.08 + r() * 0.05, -0.12 - len, z0 * 1.4]], 0.028, 0.008, { seg: 3, radial: 5, gnarl: 0.3, seed: seed + k })));
  }
  if (helmet) {
    bk.add(mats.rustIron, face(new THREE.SphereGeometry(0.128, 12, 5, 0, TAU, 0, Math.PI / 2).scale(1.05, 1.0, 0.95).translate(-0.01, 0.025, 0)));
    bk.add(mats.rustIron, face(new THREE.TorusGeometry(0.122, 0.014, 4, 16).rotateX(Math.PI / 2).translate(-0.01, 0.025, 0)));
    bk.add(mats.rustIron, face(B(0.014, 0.1, 0.03).translate(0.125, -0.012, 0)));
  } else {
    bk.add(mats.rustIron, new THREE.SphereGeometry(0.128, 12, 5, 0, TAU, 0, Math.PI / 2).rotateX(1.9).translate(0.5, 0.09, 0.45));
  }
  // the arms: by his sides to the floor, or in his lap; over his knees if perched
  for (const s of [-1, 1]) {
    const sh = [chest[0] - 0.02, chest[1] + 0.13, s * 0.24];
    const inLap = lap[s < 0 ? 0 : 1];
    const el = perch ? [sh[0] + 0.14, sh[1] - 0.24, s * 0.22] : inLap ? [0.22, 0.3, s * 0.3] : [0.1, 0.28, s * 0.34];
    const wr = perch ? [sh[0] + 0.3, sh[1] - 0.42, s * 0.13] : inLap ? [0.44, 0.26, s * 0.13] : [0.26, 0.05, s * 0.4];
    shaft(sh, el, 0.026);
    shaft(el, wr, 0.022);
    bk.add(mats.mail, sweep3([sh, [(sh[0] * 2 + el[0]) / 3, (sh[1] * 2 + el[1]) / 3, (sh[2] * 2 + el[2]) / 3]], [[0.075, 0.075], [0.07, 0.07]], { seg: 2, radial: 7, caps: [false, false] }));
    for (let f = 0; f < 4; f++) bone(rod(V3(...wr), V3(wr[0] + 0.09, wr[1] - (inLap || perch ? 0.02 : 0.035), wr[2] + (f - 1.5) * 0.028), 0.01, 0.008, 4));
  }
  // the legs: out along the floor, knees up a little; or over the well's edge
  for (const s of [-1, 1]) {
    const h0 = [hip[0] + 0.04, hip[1] - 0.01, s * 0.12];
    const kn = perch ? [0.56, 0.84, s * 0.16] : [0.56, 0.17 + knees * 0.2 + (s > 0 ? r() * 0.06 : 0), s * (0.16 + r() * 0.05)];
    const an = perch ? [0.6, 0.47, s * 0.17] : [0.86, 0.09, s * (0.18 + r() * 0.08)];
    shaft(h0, kn, 0.036);
    shaft(kn, an, 0.03);
    // the boot, heavy and square-toed
    const toe = perch ? V3(0.74, 0.42, s * 0.18) : V3(an[0] + 0.12, 0.06, an[2]);
    bk.add(mats.leatherOld, lump(0.1, { p: [(an[0] * 0.6 + toe.x * 0.4), (an[1] * 0.5 + toe.y * 0.5), an[2]], s: [1.55, 0.95, 0.95] }, { detail: 1, amp: 0.1 }));
  }
}

// An axe: its haft from the origin along +x, the head at the end (or the
// haft snapped short).
function axeParts(bk, K, len = 0.95, broken = false) {
  const { mats } = K;
  const L = broken ? len * 0.55 : len;
  bk.add(mats.oldWood, cyl(0.022, 0.026, L, 6), { r: [0, 0, -Math.PI / 2], p: [L / 2, 0, 0], uv: 3 });
  if (broken) return;
  const head = shapeOf([[-0.03, 0], [-0.04, 0.05], [-0.14, 0.16], [0, 0.2], [0.14, 0.16], [0.04, 0.05], [0.03, 0]]);
  bk.add(mats.oldSteel, ext(head, 0.018), { p: [len - 0.06, 0, -0.009] });
  bk.add(mats.rustIron, B(0.08, 0.05, 0.04), { p: [len - 0.06, 0, 0] });
}

// A sword: its grip at the origin, the blade along +x, or snapped short.
function swordParts(bk, K, len = 0.75, broken = 0) {
  const { mats } = K;
  if (broken) bk.add(mats.oldSteel, B(len * broken, 0.05, 0.008), { p: [0.1 + (len * broken) / 2, 0, 0] });
  else bk.add(mats.oldSteel, ext(shapeOf([[0, -0.028], [len - 0.08, -0.024], [len, 0], [len - 0.08, 0.024], [0, 0.028]]), 0.008), { p: [0.1, 0, -0.004] });
  bk.add(mats.rustIron, B(0.03, 0.2, 0.035), { p: [0.1, 0, 0] });
  bk.add(mats.leatherOld, cyl(0.016, 0.016, 0.12, 6), { r: [0, 0, Math.PI / 2], p: [0.03, 0, 0] });
  bk.add(mats.rustIron, ball(0.025, 6, 4), { p: [-0.04, 0, 0] });
}

// A round shield lying flat, `cut` of it broken away.
function shieldParts(bk, K, r = 0.38, cut = 0) {
  const { mats } = K;
  const a = cut * TAU;
  bk.add(mats.oldWood, new THREE.CylinderGeometry(r, r, 0.04, 16, 1, false, a, TAU - a), { p: [0, 0.02, 0], uv: 2 });
  bk.add(mats.rustIron, new THREE.TorusGeometry(r, 0.016, 4, 20, TAU - a).rotateX(-Math.PI / 2).rotateY(a - Math.PI / 2), { p: [0, 0.035, 0] });
  if (cut < 0.3) bk.add(mats.rustIron, new THREE.SphereGeometry(0.08, 8, 4, 0, TAU, 0, Math.PI / 2), { p: [0, 0.04, 0] });
}

// The Chamber of Mazarbul, the records' room, where Balin's company made
// their last stand: 16 m (along x) by 14, 10 m high, its doorway in the +z
// wall with two heavy doors that swing in and shut (doors.open(k)). In the
// middle Balin's tomb, a block of white stone lettered in red-brown runes,
// and on it a shaft of grey daylight from a high window in the -x wall,
// dust turning in it. A well with a low wall in the far corner; square
// columns along the side walls; the dwarves' dead slumped against the walls
// in their mail, one sitting on the well's edge; broken weapons and shields
// scattered over the floor; Ori's book on a ledge by the back wall.
// Anchors (local): tomb (the middle of its top), well (its middle, on the
// floor), door (the middle of the doorway), book, beam { from, to }.
function chamber(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'mazarbul';
  const bk = parts();
  const r = rng(131);
  const n = makeNoise(131);
  const HX = 8;
  const HZ = 7;
  const H = 10;
  const T = 1;
  const wallTone = (x, y, z, out) => out.setRGB(1, 1, 1).multiplyScalar(0.72 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.5).multiplyScalar(mix(0.65, 1, smooth(0, 2, y)));
  const wall = (geo) => bk.add(mats.ashlar, tint(geo, wallTone), { uv: 0.34 });

  // the window, high in the -x wall, and the light it lets in
  const WZ = -2.0;
  const WY = 8.4;
  const ww = 1.1;
  const wh = 1.5;
  // the walls: the back, the right, the left round its window, the front
  // round its doorway
  wall(B(2 * HX + 2 * T, H, T).translate(0, H / 2, -HZ - T / 2));
  wall(B(T, H, 2 * HZ).translate(HX + T / 2, H / 2, 0));
  const lx = -HX - T / 2;
  wall(B(T, WY - wh / 2, 2 * HZ).translate(lx, (WY - wh / 2) / 2, 0));
  wall(B(T, H - WY - wh / 2, 2 * HZ).translate(lx, (H + WY + wh / 2) / 2, 0));
  wall(B(T, wh, WZ - ww / 2 + HZ).translate(lx, WY, (-HZ + WZ - ww / 2) / 2));
  wall(B(T, wh, HZ - WZ - ww / 2).translate(lx, WY, (HZ + WZ + ww / 2) / 2));
  const DA = 1.4;
  const door = dwarfDoor(DA, 3.1, 3.8);
  const front = ext(shapeOf([[-HX - T, 0], ...door, [HX + T, 0], [HX + T, H], [-HX - T, H]]), T);
  wall(front.translate(0, 0, HZ));
  // daylight beyond the window
  bk.add(mats.daylight, new THREE.PlaneGeometry(ww + 0.4, wh + 0.4).rotateY(Math.PI / 2), { p: [-HX - T - 0.05, WY, WZ] });
  // the roof, on beams
  wall(B(2 * HX + 2 * T, 0.6, 2 * HZ + 2 * T).translate(0, H + 0.3, 0));
  for (const z of [-4.6, -1.6, 1.6, 4.6]) bk.add(mats.basalt, B(2 * HX, 0.55, 0.6), { p: [0, H - 0.27, z], uv: 0.3, color: 0x8a8e8a });
  // a plinth round the foot of the walls, a band of runes round them high
  // up, and a stepped cornice under the roof
  for (const [w, x, z, ry] of [[2 * HX, 0, -HZ, 0], [2 * HZ, HX, 0, -Math.PI / 2], [2 * HZ, -HX, 0, Math.PI / 2]]) {
    bk.at([x, 0, z], ry, () => {
      bk.add(mats.basalt, B(w, 0.5, 0.16), { p: [0, 0.25, 0.08], uv: 0.4, color: 0x9a9e9a });
      bk.add(mats.carve, bandBox(w, 0.6, 0.1, 2), { p: [0, 6.9, 0.05] });
      bk.add(mats.basalt, B(w, 0.14, 0.18), { p: [0, 6.53, 0.09], uv: 0.4, color: 0xa0a4a0 });
      for (let k = 0; k < 3; k++) bk.add(mats.basalt, B(w, 0.2, 0.14 + k * 0.12), { p: [0, H - 0.75 + k * 0.2, 0.07 + k * 0.06], uv: 0.4, color: 0x9a9e9a });
    });
  }
  bk.at([0, 0, HZ], Math.PI, () => {
    for (const s of [-1, 1]) bk.add(mats.basalt, B(HX - DA - 0.3, 0.5, 0.16), { p: [s * (DA + 0.3 + (HX - DA - 0.3) / 2), 0.25, 0.08], uv: 0.4, color: 0x9a9e9a });
    bk.add(mats.carve, bandBox(2 * HX, 0.6, 0.1, 2), { p: [0, 6.9, 0.05] });
  });
  // the doorway's frame, inside
  bk.add(mats.basalt, frameGeo(door, 0.3, 0.16), { p: [0, 0, HZ], r: [0, Math.PI, 0], uv: 0.5, color: 0xb8bcb8 });

  // the floor, the well's mouth cut from it
  const WELL = V3(5.0, 0, -5.0);
  const floorShape = shapeOf([[-HX, -HZ], [HX, -HZ], [HX, HZ], [-HX, HZ]]);
  const hole = new THREE.Path();
  hole.absarc(WELL.x, -WELL.z, 0.8, 0, TAU, true);
  floorShape.holes.push(hole);
  const floor = new THREE.ShapeGeometry(floorShape, 20).rotateX(-Math.PI / 2);
  {
    const p = floor.attributes.position;
    const uv = floor.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 8 + 0.5, p.getZ(i) / 8 + 0.5);
  }
  bk.add(mats.paving, floor);

  // columns along the side walls
  const columns = [];
  for (const x of [-HX + 1.0, HX - 1.0]) {
    for (const z of [-4.5, 0, 4.5]) {
      columns.push({ x, z, r: 0.72 });
      const col = [
        octLoft([{ y: 0, half: 0.78, ch: 0.2 }, { y: 0.4, half: 0.78, ch: 0.2 }, { y: 0.4, half: 0.66, ch: 0.16 }, { y: 0.6, half: 0.62, ch: 0.15 }], { top: true }),
        octLoft([{ y: 0.6, half: 0.55, ch: 0.13 }, { y: 8.6, half: 0.55, ch: 0.13 }, { y: 8.75, half: 0.64, ch: 0.16 }, { y: 9.0, half: 0.64, ch: 0.16 }, { y: 9.0, half: 0.6, ch: 0.15 }, { y: H, half: 0.95, ch: 0.25 }]),
      ];
      for (const c of col) bk.add(mats.basalt, tint(c.translate(x, 0, z), (px, py, pz, out) => out.setRGB(0.85, 0.88, 0.86).multiplyScalar(mix(0.6, 1, smooth(0, 1.5, py)))), { uv: 0.4 });
      bk.add(mats.carve, octBand(0.55, 0.13, 2.0, 0.5, 0, 0.03).translate(x, 0, z));
      bk.add(mats.carve, octBand(0.55, 0.13, 7.6, 0.5, 3, 0.03).translate(x, 0, z));
    }
  }

  // Balin's tomb: a plinth, the white block, its lettered top
  const TOMB = { w: 2.8, d: 1.5, h: 1.15, base: 0.3 };
  const tombTop = TOMB.base + TOMB.h;
  bk.add(mats.tomb, roundBox(TOMB.w + 0.8, TOMB.base, TOMB.d + 0.8, 0.04), { p: [0, TOMB.base / 2, 0], uv: 0.5 });
  bk.add(mats.tomb, roundBox(TOMB.w, TOMB.h, TOMB.d, 0.04), { p: [0, TOMB.base + TOMB.h / 2, 0], uv: 0.5 });
  for (const s of [-1, 1]) {
    bk.at([0, TOMB.base + TOMB.h - 0.3, s * (TOMB.d / 2)], s > 0 ? 0 : Math.PI, () => bk.add(mats.tombCarve, bandBox(TOMB.w - 0.2, 0.32, 0.04, 0), { p: [0, 0, 0.02] }));
  }
  bk.add(mats.tombTop, new THREE.PlaneGeometry(TOMB.w - 0.12, TOMB.d - 0.12).rotateX(-Math.PI / 2), { p: [0, tombTop + 0.003, 0] });

  // the well: a ring of blocks, a coping, and the shaft going down black
  const WR0 = 0.8;
  const WR1 = 1.08;
  for (let i = 0; i < 10; i++) {
    const a0 = (i / 10) * TAU + 0.01;
    const a1 = ((i + 1) / 10) * TAU - 0.01;
    const shape = new THREE.Shape();
    shape.absarc(0, 0, WR1, a0, a1, false);
    shape.absarc(0, 0, WR0, a1, a0, true);
    bk.add(mats.basalt, ext(shape, 0.7).rotateX(-Math.PI / 2), { p: [WELL.x, 0, WELL.z], uv: 0.6, color: 0xa4a8a4 });
  }
  bk.add(mats.basalt, lathe([[WR0 - 0.04, 0.7], [WR1 + 0.05, 0.7], [WR1 + 0.06, 0.78], [WR1 + 0.02, 0.84], [WR0 - 0.04, 0.84], [WR0 - 0.05, 0.7]], 24), { p: [WELL.x, 0, WELL.z], uv: 0.6, color: 0xb0b4b0 });
  const shaft = new THREE.CylinderGeometry(WR0, WR0, 5, 18, 4, true);
  shaft.scale(-1, 1, 1);
  tint(shaft, (x, y, z, out) => out.setScalar(0.35 * smooth(-2.5, 2.5, y)));
  bk.add(mats.deep, shaft, { p: [WELL.x, -2.5 + 0.7, WELL.z], uv: 0.5 });
  bk.add(mats.void, new THREE.CircleGeometry(WR0, 18).rotateX(-Math.PI / 2), { p: [WELL.x, -4.2, WELL.z] });
  // a bucket on its chain, left on the coping
  bk.add(mats.oldWood, cyl(0.16, 0.13, 0.3, 10), { p: [WELL.x - 0.95, 1.0, WELL.z + 0.05], uv: 2 });
  bk.add(mats.rustIron, new THREE.TorusGeometry(0.16, 0.012, 4, 12).rotateX(Math.PI / 2), { p: [WELL.x - 0.95, 1.12, WELL.z + 0.05] });

  // Ori's book, open on a ledge on the back wall, his bones beneath it
  const BOOK = V3(-2.8, 1.12, -HZ + 0.32);
  bk.add(mats.basalt, B(1.5, 0.14, 0.6), { p: [BOOK.x, 1.0, -HZ + 0.3], uv: 0.5, color: 0xb0b4b0 });
  for (const s of [-1, 1]) bk.add(mats.basalt, B(0.18, 0.4, 0.4), { p: [BOOK.x + s * 0.55, 0.73, -HZ + 0.2], uv: 0.5, color: 0xa0a4a0 });
  bk.at([BOOK.x, 1.07, BOOK.z], 0.08, () => {
    for (const s of [-1, 1]) {
      bk.add(mats.bookCover, roundBox(0.36, 0.025, 0.5, 0.01), { p: [s * 0.19, 0.012, 0], r: [0, 0, s * 0.05] });
      bk.add(mats.paper, B(0.34, 0.07, 0.46), { p: [s * 0.18, 0.06, 0], r: [0, 0, s * 0.05] });
      bk.add(mats.page, new THREE.PlaneGeometry(0.34, 0.46).rotateX(-Math.PI / 2), { p: [s * 0.18, 0.098 - Math.abs(s) * 0.004, 0], r: [0, 0, s * 0.05] });
    }
  });

  // the dead
  const DEAD = [
    { at: [-4.6, 0, -HZ + 0.25], ry: -Math.PI / 2, o: { seed: 2, lap: [true, true] } },
    { at: [HX - 0.25, 0, -2.3], ry: Math.PI, o: { seed: 3, lap: [false, true], helmet: false } },
    { at: [-HX + 0.25, 0, 2.3], ry: 0, o: { seed: 4, lap: [false, false], knees: 0.8 } },
    { at: [4.0, 0, HZ - 0.25], ry: Math.PI / 2, o: { seed: 5, lap: [true, false] } },
    { at: [-0.9, 0, TOMB.d / 2 + 0.65], ry: -Math.PI / 2, o: { seed: 6, lap: [false, true], knees: 0.5 } },
    { at: [-HX + 0.25, 0, -5.6], ry: 0, o: { seed: 7, lap: [true, true], helmet: false } },
  ];
  for (const { at, ry, o } of DEAD) bk.at(at, ry, () => deadDwarf(bk, K, o));
  {
    const out = V3(-1, 0, 1).normalize();
    const at = WELL.clone().addScaledVector(out, 0.74);
    bk.at([at.x, 0, at.z], Math.atan2(-out.z, out.x), () => deadDwarf(bk, K, { seed: 8, perch: true, helmet: true }));
  }

  // broken weapons and shields over the floor, a few orc arrows stuck in it
  const clear = (x, z) => Math.abs(x) < TOMB.w / 2 + 0.6 && Math.abs(z) < TOMB.d / 2 + 0.6;
  for (let i = 0; i < 22; i++) {
    let x = (r() - 0.5) * 2 * (HX - 1.8);
    let z = (r() - 0.5) * 2 * (HZ - 1.4);
    if (clear(x, z)) x += x < 0 ? -2.2 : 2.2;
    if (Math.hypot(x - WELL.x, z - WELL.z) < 1.4) z += 2;
    if (Math.abs(x) < 1.8 && z > HZ - 2.5) z -= 2.5;
    const kind = i % 6;
    bk.at([x, 0, z], r() * TAU, () => {
      if (kind === 0) bk.at([0, 0.03, 0], [0, 0, 0.04], () => axeParts(bk, K, 0.9, r() < 0.4));
      else if (kind === 1) bk.at([0, 0.02, 0], [Math.PI / 2, 0, 0], () => swordParts(bk, K, 0.72, r() < 0.5 ? 0.3 + r() * 0.3 : 0));
      else if (kind === 2) shieldParts(bk, K, 0.34 + r() * 0.08, r() < 0.5 ? 0.25 + r() * 0.2 : 0);
      else if (kind === 3) bk.add(mats.rustIron, new THREE.SphereGeometry(0.12, 10, 5, 0, TAU, 0, Math.PI / 2), { p: [0, 0.06, 0], r: [1.6 + r(), 0, r()] });
      else if (kind === 4) {
        // a spear's broken shaft
        bk.add(mats.oldWood, cyl(0.02, 0.02, 0.8 + r() * 0.6, 5), { p: [0, 0.02, 0], r: [0, 0, Math.PI / 2], uv: 3 });
      } else {
        for (let k = 0; k < 3; k++) {
          const a = rod(V3((r() - 0.5) * 0.6, -0.1, (r() - 0.5) * 0.6), V3((r() - 0.5) * 0.6 + 0.3, 0.55, (r() - 0.5) * 0.4), 0.008, 0.008, 4);
          bk.add(mats.arrow, a);
        }
      }
    });
  }
  // rubble fallen in the corners
  for (let i = 0; i < 16; i++) {
    const cx = (i % 2 ? 1 : -1) * (HX - 0.5 - r() * 1.5);
    const cz = (i % 4 < 2 ? 1 : -1) * (HZ - 0.5 - r() * 1.2);
    if (Math.abs(cx) < 2) continue;
    const s = 0.12 + r() * 0.3;
    const geo = chunkGeo(700 + i, s, 0.6);
    tf(geo, { p: [cx, s * 0.25, cz], r: [r(), r() * 3, 0] });
    bk.add(mats.basalt, geo, { uv: 1, color: 0x9a9e9a });
  }
  bk.build(g);

  // ── the doors: heavy timber, banded and studded with iron, hinged at the
  // jambs, swinging in
  const doorLeaves = [-1, 1].map((s) => {
    const leaf = new THREE.Group();
    leaf.name = s < 0 ? 'doorL' : 'doorR';
    leaf.position.set(s * DA, 0, HZ - 0.02);
    g.add(leaf);
    const lk = parts();
    // its half of the doorway's outline, a finger's breadth short of the middle
    const side = door.filter(([x]) => s * x > 0);
    const leafGeo = ext(shapeOf([[s * 0.006, 0], ...(s < 0 ? side : side.slice().reverse()), [s * 0.006, door[2][1]]]), 0.2);
    leafGeo.translate(-s * DA, 0, -0.2);
    lk.add(mats.oldWood, leafGeo, { uv: 0.9 });
    for (const y of [0.5, 1.6, 2.7]) lk.add(mats.rustIron, B(DA - 0.1, 0.12, 0.03), { p: [-s * DA * 0.5, y, -0.215] });
    for (const y of [0.5, 1.6, 2.7]) {
      for (let k = 0; k < 4; k++) lk.add(mats.rustIron, new THREE.OctahedronGeometry(0.03, 0), { p: [-s * (0.2 + k * 0.32), y, -0.235] });
    }
    lk.build(leaf);
    return { leaf, s };
  });
  const doors = {
    open(k) {
      const t = clamp01(k);
      for (const { leaf, s } of doorLeaves) leaf.rotation.y = -s * t * 1.75;
    },
  };
  doors.open(1);

  // ── the light: the shaft, where it lands, and the dust in it
  const from = V3(-HX - 0.2, WY, WZ);
  const to = V3(0, tombTop, 0);
  const dir = to.clone().sub(from).normalize();
  const len = -from.y / dir.y;
  const beamInfo = { from, dir, r0: 0.62, r1: 1.25, len };
  const bg = new THREE.Group();
  bg.name = 'daylight';
  g.add(bg);
  const shaftGeo = new THREE.CylinderGeometry(beamInfo.r0, beamInfo.r1, len, 32, 1, true).translate(0, -len / 2, 0);
  shaftGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, -1, 0), dir));
  shaftGeo.translate(from.x, from.y, from.z);
  const beamMat = beamMaterial(U);
  const shaftMesh = new THREE.Mesh(shaftGeo, beamMat);
  shaftMesh.renderOrder = 4;
  bg.add(shaftMesh);
  const sun = sunlitMaterial(U, beamInfo);
  sun.uniforms.uBoxMin.value.set(-TOMB.w / 2, 0, -TOMB.d / 2);
  sun.uniforms.uBoxMax.value.set(TOMB.w / 2, tombTop - 0.01, TOMB.d / 2);
  const pools = [
    new THREE.PlaneGeometry(TOMB.w, TOMB.d).rotateX(-Math.PI / 2).translate(0, tombTop + 0.006, 0),
    new THREE.PlaneGeometry(9, 7).rotateX(-Math.PI / 2).translate(1, 0.012, 0),
    new THREE.PlaneGeometry(TOMB.d, TOMB.h).rotateY(-Math.PI / 2).translate(-TOMB.w / 2 - 0.006, TOMB.base + TOMB.h / 2, 0),
    new THREE.PlaneGeometry(TOMB.d + 0.8, TOMB.base).rotateY(-Math.PI / 2).translate(-TOMB.w / 2 - 0.406, TOMB.base / 2, 0),
    new THREE.PlaneGeometry(TOMB.w + 0.8, TOMB.d + 0.8).rotateX(-Math.PI / 2).translate(0, TOMB.base + 0.006, 0),
  ];
  const poolMesh = new THREE.Mesh(mergeGeometries(pools), sun);
  poolMesh.renderOrder = 3;
  bg.add(poolMesh);
  // the motes
  const NM = 420;
  const mp = new Float32Array(NM * 3);
  const ms = new Float32Array(NM * 4);
  const side = V3(0, 1, 0).cross(dir).normalize();
  const up2 = dir.clone().cross(side).normalize();
  for (let i = 0; i < NM; i++) {
    const t = Math.pow(r(), 0.8) * (len * 0.7);
    const rr = mix(beamInfo.r0, beamInfo.r1, t / len) * Math.sqrt(r()) * 0.85;
    const a = r() * TAU;
    const p = from.clone().addScaledVector(dir, t + 0.4).addScaledVector(side, Math.cos(a) * rr).addScaledVector(up2, Math.sin(a) * rr);
    mp.set([p.x, p.y, p.z], i * 3);
    ms.set([r(), r(), r(), r()], i * 4);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  dg.setAttribute('aSeed', new THREE.BufferAttribute(ms, 4));
  const dust = dustPoints(dg, U, K);
  dust.frustumCulled = false;
  dust.renderOrder = 5;
  bg.add(dust);
  const beam = {
    group: bg,
    from: from.clone(),
    to: from.clone().addScaledVector(dir, len),
    dir: dir.clone(),
    set(k) {
      const t = clamp01(k);
      beamMat.uniforms.uK.value = t;
      sun.uniforms.uK.value = t;
      dust.material.uniforms.uK.value = t;
      bg.visible = t > 0.001;
    },
  };
  const update = (t) => {
    U.uTime.value = t;
    dust.material.userData.fit();
  };
  update(0);
  return {
    group: g,
    tomb: V3(0, tombTop, 0),
    well: WELL.clone(),
    door: V3(0, 0, HZ + T / 2),
    beam,
    book: BOOK.clone().setY(1.17),
    columns,
    doors,
    update,
    size: { w: 2 * HX, d: 2 * HZ, h: H, wall: T },
  };
}

// ── the bridge and the stairs ──

// A block of stone from its eight corners (x fastest, then y, then z), each
// corner bevelled back along its edges (some chipped deep) so no edge is
// sharp, as a hull: flat-faced.
function hexHull(P, seed, chamfer = 0.04, chip = 0.25) {
  const r = rng(seed);
  const pts = [];
  for (let c = 0; c < 8; c++) {
    const nb = [c ^ 1, c ^ 2, c ^ 4].map((o) => P[o].clone().sub(P[c]));
    const lens = nb.map((v) => v.length());
    const dirs = nb.map((v) => v.normalize());
    const k = chamfer * (r() < chip ? 2 + r() * 3 : 0.7 + r() * 0.6);
    for (let e = 0; e < 3; e++) {
      const f = (e + 1) % 3;
      pts.push(P[c].clone().addScaledVector(dirs[e], Math.min(k, lens[e] * 0.4)).addScaledVector(dirs[f], Math.min(k, lens[f] * 0.4)));
    }
  }
  return new ConvexGeometry(pts);
}

// Darker the deeper it hangs, a little uneven: the abyss stone's colour.
const abyssTone = (n) => (x, y, z, out) => {
  out.setRGB(0.78, 0.8, 0.8).multiplyScalar(0.8 + noise3(n, x * 0.6, y * 0.6, z * 0.6) * 0.4);
  out.multiplyScalar(mix(1, 0.12, smooth(-1, -40, y)));
};

// The Bridge of Khazad-dûm: a single span of stone without kerb or rail,
// 1.6 m wide and `len` long along x (from -len/2 to len/2), its deck at
// y = 0. Under the deck a slender arch, thinnest at the middle, plunging at
// either end into the abyss 60 m down, where the fire's red glow comes up
// out of the dark, and sparks with it.
function bridge(K, len = 30) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'khazadDumBridge';
  const n = makeNoise(151);
  const L2 = len / 2;
  const DEPTH = 60;
  const under = (x) => -0.8 - (DEPTH - 0.8) * Math.pow(Math.min(1, Math.abs(x) / L2), 7);
  const width = (y) => (y > -0.4 ? 1.6 : mix(1.05, 0.55, smooth(-0.4, -DEPTH, y)));
  // the section at x: round from the deck's left edge, down the left side
  // of the arch, across its foot, and up the right
  const ROWS = 14;
  const section = (x) => {
    const yb = under(x);
    const pts = [[-0.8, 0.0], [-0.8, -0.32], [-0.6, -0.44]];
    for (let k = 1; k <= ROWS; k++) {
      const y = mix(-0.44, yb, Math.pow(k / ROWS, 1.6));
      pts.push([-width(y) / 2, y]);
    }
    const right = pts.slice().reverse().map(([z, y]) => [-z, y]);
    return [...pts, ...right];
  };
  const xs = [];
  for (let i = 0; i <= 56; i++) {
    const t = i / 56;
    xs.push(-L2 + len * (0.5 - 0.5 * Math.cos(Math.PI * t)));
  }
  const pos = [];
  const secs = xs.map((x) => section(x).map(([z, y]) => [x, y, z]));
  const M = secs[0].length;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let k = 0; k < M; k++) {
      const a = secs[i][k];
      const b = secs[i][(k + 1) % M];
      const c = secs[i + 1][(k + 1) % M];
      const d = secs[i + 1][k];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  // the ends, against the rock
  for (const [i, flip] of [[0, true], [xs.length - 1, false]]) {
    const sec = secs[i];
    const c = sec.reduce((acc, p) => [acc[0] + p[0] / M, acc[1] + p[1] / M, acc[2] + p[2] / M], [0, 0, 0]);
    for (let k = 0; k < M; k++) {
      const a = sec[k];
      const b = sec[(k + 1) % M];
      if (flip) pos.push(...c, ...b, ...a);
      else pos.push(...c, ...a, ...b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  // wear the deck's edges a little
  {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > -0.5 && Math.abs(p.getZ(i)) > 0.7) p.setZ(i, p.getZ(i) * (1 - n(p.getX(i) * 2.5, p.getY(i) * 4) * 0.05));
    }
    geo.computeVertexNormals();
  }
  const bk = parts();
  bk.add(mats.abyss, tint(geo, abyssTone(n)), { uv: 0.5 });
  bk.build(g);

  // the fire's glow, far below
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), abyssMaterial(U, false));
  floorGlow.position.y = -DEPTH + 2;
  floorGlow.renderOrder = 1;
  floorGlow.geometry.rotateX(Math.PI / 2);
  floorGlow.rotation.x = -Math.PI / 2;
  g.add(floorGlow);
  const cardMat = abyssMaterial(U, true);
  for (let i = 0; i < 5; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(len * 1.7, DEPTH + 4), cardMat);
    const a = (i / 5) * Math.PI;
    card.position.set(Math.cos(a) * 2, -DEPTH / 2 - 2, Math.sin(a) * 3 - 1.5);
    card.rotation.y = a * 0.35 - 0.3;
    card.renderOrder = 1;
    g.add(card);
  }
  const NS = 260;
  const sp = new Float32Array(NS * 3);
  const ss = new Float32Array(NS * 4);
  const r = rng(153);
  for (let i = 0; i < NS; i++) ss.set([r(), r(), r(), r()], i * 4);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const sparks = sparkPoints(sg, U, K);
  sparks.material.uniforms.uSpan.value.set(len * 1.3, DEPTH, 14);
  sparks.frustumCulled = false;
  sparks.renderOrder = 2;
  g.add(sparks);
  const glow = {
    set(k) {
      const t = Math.max(0, k);
      floorGlow.material.uniforms.uK.value = t;
      cardMat.uniforms.uK.value = t;
      sparks.material.uniforms.uK.value = t;
      U.uFire.value = t;
    },
  };
  const update = (t) => {
    U.uTime.value = t;
    sparks.material.userData.fit();
  };
  update(0);
  return { group: g, glow, update, len, width: 1.6, depth: DEPTH };
}

// A steep narrow stair of the dwarves, 3 m wide, without rails, going down
// along -x from its head 12 m up (at x = 14.4) to its foot at the origin:
// forty worn steps on a sloping slab, one slender pier under its upper half
// going down into the abyss. About two-thirds of the way down a piece has
// fallen away: gap { x0, x1 } is the hole, along x, its edges broken.
function stairs(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stairs';
  const bk = parts();
  const n = makeNoise(161);
  const r = rng(163);
  const N = 40;
  const RISE = 0.3;
  const TREAD = 0.36;
  const W = 1.5;
  const RUN = N * TREAD;
  const soffit = (x) => x * (RISE / TREAD) - 1.7;
  const gap = { x0: 11 * TREAD, x1: 16 * TREAD };
  const tone = abyssTone(n);
  for (let i = 0; i < N; i++) {
    const x0 = i * TREAD;
    const x1 = (i + 1) * TREAD;
    if (x0 >= gap.x0 - 1e-6 && x1 <= gap.x1 + 1e-6) continue;
    const yt = (i + 1) * RISE;
    const P = [];
    for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let ii = 0; ii < 2; ii++) {
      const x = ii ? x1 : x0;
      P.push(V3(x, j ? yt : soffit(x), (k - 0.5) * 2 * W));
    }
    // the steps either side of the break: broken off ragged
    const before = Math.abs(x1 - gap.x0) < 1e-6;
    const after = Math.abs(x0 - gap.x1) < 1e-6;
    if (before || after) {
      for (const c of [0, 1, 2, 3, 4, 5, 6, 7]) {
        const atEdge = before ? c & 1 : !(c & 1);
        if (!atEdge) continue;
        P[c].x += (before ? -1 : 1) * (0.05 + r() * 0.25);
        P[c].y -= c & 2 ? r() * 0.18 : -r() * 0.4;
      }
    }
    const geo = hexHull(P, 300 + i, 0.035, before || after ? 0.8 : 0.25);
    bk.add(mats.abyss, tint(geo, tone), { uv: 0.6 });
  }
  // shards hanging at the break, and stones fallen on the steps below it
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? gap.x1 + 0.1 : gap.x0 - 0.1;
    const s = 0.12 + r() * 0.18;
    const geo = chunkGeo(330 + i, s, 0.7);
    const x = side + (r() - 0.5) * 0.3;
    tf(geo, { p: [x, soffit(x) + 0.3 + r() * 1.2, (r() - 0.5) * 2.4], r: [r(), r() * 3, r()] });
    bk.add(mats.abyss, tint(geo, tone), { uv: 1 });
  }
  for (let i = 0; i < 5; i++) {
    const k = Math.floor(r() * 9);
    const x = (k + 0.5) * TREAD;
    const s = 0.08 + r() * 0.12;
    const geo = chunkGeo(340 + i, s, 0.6);
    tf(geo, { p: [x, (k + 1) * RISE + s * 0.3, (r() - 0.5) * 2.2], r: [r(), r() * 3, 0] });
    bk.add(mats.abyss, tint(geo, tone), { uv: 1 });
  }
  // the pier under its upper half, tapering away into the deep
  const px = RUN * 0.74;
  const top = soffit(px) + 0.2;
  const pier = [];
  for (let k = 0; k <= 10; k++) {
    const y = mix(top, -60, Math.pow(k / 10, 1.3));
    const w = mix(1.3, 0.6, k / 10);
    pier.push({ y, half: w, ch: w * 0.3 });
  }
  const pg = octLoft(pier.reverse()).translate(px, 0, 0);
  pg.scale(1, 1, 1);
  bk.add(mats.abyss, tint(pg, tone), { uv: 0.4 });
  bk.build(g);
  return { group: g, gap, run: RUN, rise: N * RISE, width: 2 * W };
}

// ── the cave troll ──

// A troll's hide, for laying on from three sides: red its height (warts of
// all sizes, folds and wrinkles, pores), green mottling, blue dark freckles
// and the grime in its creases.
function wartCanvas(S = 256) {
  const n = makeNoise(171);
  const cells = makeCells(173);
  const fine = makeCells(177);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, px, py) => {
    const k = cells(u * 5, v * 5, 5);
    const wart = Math.pow(1 - smooth(0.0, 0.34 + k.id * 0.18, k.f1), 1.5) * (k.id > 0.45 ? 1 : 0.2);
    const f = fine(u * 16, v * 16, 16);
    const small = (1 - smooth(0.0, 0.28, f.f1)) * (f.id > 0.55 ? 1 : 0);
    const fold = 1 - Math.abs(fbm(n, u * 4, v * 4, { period: 4, octaves: 4 }) * 2 - 1);
    const wrinkle = Math.pow(1 - Math.abs(fbm(n, u * 10 + 3, v * 10, { period: 10, octaves: 2 }) * 2 - 1), 6);
    const pore = n(u * 64, v * 64, 64);
    field[py * S + px] = clamp01(0.42 + wart * 0.4 + small * 0.14 - Math.pow(fold, 8) * 0.3 - wrinkle * 0.16 + (pore - 0.5) * 0.06);
    out[0] = field[py * S + px] * 255;
    out[1] = fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 3 }) * 255;
    out[2] = clamp01(smooth(0.74, 0.86, n(u * 20 + 5, v * 20, 20)) * 0.5 + Math.pow(fold, 8) * 0.45 + wrinkle * 0.25 - wart * 0.2) * 255;
  });
  return { c, field };
}

// A chain of iron links along points, every other one turned square; the
// last one broken open if asked. Added to `bk`.
function chainParts(bk, mat, pts, { r = 0.07, wire = 0.022, broken = true } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V3(...p))));
  const len = curve.getLength();
  const step = r * 2.3;
  const count = Math.max(2, Math.floor(len / step));
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const at = curve.getPointAt(t);
    const d = curve.getTangentAt(t);
    const last = broken && i === count - 1;
    const link = new THREE.TorusGeometry(r, wire, 5, 10, last ? TAU * 0.72 : TAU).scale(1, 1.45, 1);
    link.rotateY(i % 2 ? Math.PI / 2 : 0);
    bk.add(mat, along(link, d, at));
  }
}

// The cave troll, about 4.5 m tall, facing +x: grey-green and warty, hunched
// over a heavy belly, short bowed legs, long arms to huge hands, a small head
// thrust forward with an underbite and tusks; a broken chain hanging from an
// iron collar at its neck and a shackle on its left wrist; a huge spiked
// club in its right hand, resting on the ground ahead. Each part in its own
// group, pivoted at its joint: body (at the hips), head, arms [l, r] at the
// shoulders (each with .fore and .hand), legs [l, r] at the hips (each with
// .shin), club. animate(t, { swing, roar, reach }): swing 0..1 lifts the
// club overhead (to 0.5) and brings it down on the ground ahead along +x;
// left at 0 with `reach` (metres to whoever it's after) it swings on its
// own, started so the club comes down as it gets to them, and not again for
// a moment after. roar (0 or 1: it's hunting) roars once as it takes up the
// hunt, chest out and arms wide, then snarls while it hunts. Its walk is
// read from where the scene puts it (../../creatures.js), heavy and
// lengthening as it lumbers into a run; `walking` is no longer needed.
function caveTroll(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'caveTroll';
  const n = makeNoise(181);
  const r = rng(181);
  // the skin's colour: grey-green, mottled, paler on the belly and under
  // the jaw, darker on the back and down in the creases and undersides
  const skin = (geo, { belly = 0, dark = 0 } = {}) => tint(geo, (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 1.4, y * 1.4, z * 1.4);
    const blot = smooth(0.45, 0.65, noise3(n, x * 0.6 + 7, y * 0.6, z * 0.6));
    out.setRGB(0.3, 0.35, 0.28).multiplyScalar(0.78 + m * 0.4).lerp(_kd.setRGB(0.2, 0.24, 0.17), blot * 0.6);
    out.lerp(_kd.setRGB(0.44, 0.44, 0.36), clamp01(belly * (0.3 + nx * 0.7)));
    out.multiplyScalar((0.62 + 0.38 * smooth(-0.8, 0.4, ny)) * (1 - dark));
  });
  const part = (bk, geo, o) => bk.add(mats.trollSkin, skin(geo, o));
  const blobAt = (rad, p, s = [1, 1, 1], detail = 2, seed = 0, rot = [0, 0, 0]) => lump(rad, { p, s, r: rot }, { detail, amp: 0.1, freq: 1.4, seed: 190 + seed });
  const group = (name, parent, p) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(...p);
    parent.add(o);
    return o;
  };

  // ── the hips, the loincloth, and the legs
  const HIPS = [-0.1, 1.85, 0];
  const hips = group('hips', g, HIPS);
  {
    const bk = parts();
    part(bk, blobAt(0.72, [0, 0.02, 0], [0.95, 0.78, 1.28], 3, 1));
    // a hide wrapped round the loins, belted with rope, torn at its hem
    const rag = new THREE.CylinderGeometry(0.98, 1.08, 0.8, 22, 4, true);
    const p = rag.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const a = Math.atan2(z, x);
      const low = y < -0.3;
      const tear = low ? (n(a * 3 + 5, 2) - 0.5) * 0.5 - Math.max(0, Math.cos(a * 3)) * 0.2 : 0;
      const k = 1 + 0.05 * Math.sin(a * 9) * (0.5 - y);
      p.setXYZ(i, x * k * 0.95, y + tear, z * k * 1.12);
    }
    rag.computeVertexNormals();
    bk.add(mats.hideCloth, rag, { p: [0.05, -0.12, 0] });
    bk.add(mats.rope, new THREE.TorusGeometry(1, 0.05, 5, 26).scale(0.96, 1.16, 1).rotateX(Math.PI / 2), { p: [0.05, 0.24, 0] });
    bk.build(hips);
  }
  const legs = [-1, 1].map((s) => {
    const leg = group(s < 0 ? 'legL' : 'legR', hips, [0.02, -0.12, s * 0.58]);
    const bk = parts();
    part(bk, sweep3([[0, 0.05, 0], [0.18, -0.42, s * 0.05], [0.3, -0.82, s * 0.07]], [[0.48, 0.5], [0.46, 0.47], [0.34, 0.35]], { seg: 9, radial: 14 }));
    bk.build(leg);
    const shin = group('shin', leg, [0.3, -0.84, s * 0.07]);
    const sk = parts();
    part(sk, blobAt(0.32, [0.03, 0, 0], [1, 0.9, 1], 2, 2 + s));
    part(sk, sweep3([[0, 0, 0], [-0.07, -0.38, 0], [-0.09, -0.66, 0]], [[0.33, 0.34], [0.32, 0.33], [0.25, 0.27]], { seg: 8, radial: 14 }));
    part(sk, blobAt(0.28, [-0.17, -0.22, 0], [0.8, 1.2, 0.9], 2, 4 + s));
    // the foot: broad and flat, four stubby toes, thick yellow nails
    part(sk, blobAt(0.42, [0.18, -0.79, 0], [1.18, 0.38, 0.78], 2, 6 + s));
    for (let t = 0; t < 4; t++) {
      const tz = (t - 1.5) * 0.15 + s * 0.02;
      part(sk, blobAt(0.11, [0.62 - Math.abs(t - 1.5) * 0.05, -0.83, tz], [1.35, 0.8, 1], 1, 8 + t));
      sk.add(mats.nail, blobAt(0.055, [0.74 - Math.abs(t - 1.5) * 0.05, -0.81, tz], [0.9, 0.6, 1.1], 1, 12 + t));
    }
    sk.build(shin);
    leg.shin = shin;
    return leg;
  });

  // ── the body: a heavy belly, a chest, a hump of a back, all hunched forward
  const body = group('body', hips, [0, 0.1, 0]);
  {
    const bk = parts();
    part(bk, sweep3([[0.05, -0.15, 0], [0.15, 0.5, 0], [0.24, 1.12, 0], [0.42, 1.62, 0], [0.62, 1.88, 0]], [[0.72, 0.88, 0.68], [0.86, 1.02, 0.72], [0.9, 1.1, 0.78], [0.72, 1.02, 0.68], [0.45, 0.6, 0.45]], { seg: 16, radial: 20 }), { belly: 0.6 });
    part(bk, blobAt(0.96, [0.44, 0.34, 0], [0.98, 0.92, 1.06], 3, 20), { belly: 1 });
    part(bk, blobAt(0.18, [1.36, 0.42, 0], [0.4, 0.5, 0.4], 1, 21), { belly: 1, dark: 0.25 });
    for (const s of [-1, 1]) {
      part(bk, blobAt(0.42, [0.64, 1.24, s * 0.42], [0.55, 0.75, 1.0], 2, 22 + s), { belly: 0.5 });
      part(bk, blobAt(0.52, [0.3, 1.74, s * 0.62], [1, 0.9, 1], 2, 24 + s));
      // the love handles sagging over the belt
      part(bk, blobAt(0.4, [0.0, 0.2, s * 0.85], [1.1, 0.8, 0.7], 2, 26 + s));
    }
    part(bk, blobAt(0.76, [-0.16, 1.44, 0], [0.82, 0.85, 1.25], 2, 28), { dark: 0.08 });
    // the neck, thick and short, thrust forward
    part(bk, sweep3([[0.5, 1.72, 0], [0.82, 1.92, 0], [1.06, 2.0, 0]], [[0.44, 0.52], [0.38, 0.44], [0.3, 0.34]], { seg: 6, radial: 14 }));
    // the iron collar, and its chain hanging over the chest and belly
    bk.add(mats.forged, along(new THREE.TorusGeometry(0.43, 0.07, 6, 18).rotateX(Math.PI / 2).scale(1, 1, 1.12), V3(0.4, 0.92, 0), V3(0.82, 1.9, 0)));
    bk.add(mats.forged, along(new THREE.TorusGeometry(0.1, 0.03, 5, 10), V3(1, 0, 0), V3(1.08, 1.78, 0)));
    chainParts(bk, mats.forged, [[1.1, 1.7, 0.02], [1.28, 1.28, 0.05], [1.44, 0.86, 0.02], [1.45, 0.5, -0.05]], { r: 0.075, wire: 0.024 });
    bk.build(body);
  }

  // ── the head: small, low, thrust forward, a heavy brow, a broad flat nose,
  // little eyes, a jaw slung under it with tusks
  const head = group('head', body, [1.08, 2.02, 0]);
  const jaw = group('jaw', head, [0.08, -0.06, 0]);
  {
    const bk = parts();
    part(bk, blobAt(0.36, [0.0, 0.22, 0], [1.15, 0.78, 0.95], 2, 30));
    part(bk, sweep3([[0.28, 0.28, -0.29], [0.4, 0.3, 0], [0.28, 0.28, 0.29]], [[0.1, 0.1], [0.13, 0.12], [0.1, 0.1]], { seg: 6, radial: 8, side: [0, 1, 0] }), { dark: 0.05 });
    part(bk, blobAt(0.3, [0.28, 0.05, 0], [0.92, 0.9, 1.12], 2, 31));
    part(bk, blobAt(0.13, [0.53, 0.11, 0], [0.75, 0.72, 1.35], 2, 32), { dark: 0.05 });
    for (const s of [-1, 1]) {
      bk.add(mats.void, ball(0.032, 6, 4), { p: [0.6, 0.06, s * 0.07] });
      part(bk, blobAt(0.17, [0.33, 0.0, s * 0.21], [1, 0.9, 0.9], 1, 33 + s));
      part(bk, blobAt(0.13, [-0.06, 0.15, s * 0.33], [0.5, 1.0, 0.35], 1, 35 + s), { dark: 0.15 });
      // the eyes, small, deep under the brow, wet
      part(bk, blobAt(0.07, [0.4, 0.19, s * 0.13], [0.8, 0.7, 1], 1, 37 + s), { dark: 0.4 });
      bk.add(mats.trollEye, ball(0.042, 8, 6), { p: [0.44, 0.19, s * 0.13] });
      // the upper teeth, small and broken
      bk.add(mats.tooth, new THREE.ConeGeometry(0.022, 0.07, 5), { p: [0.5, -0.04, s * 0.06], r: [Math.PI, 0, 0] });
      bk.add(mats.tooth, new THREE.ConeGeometry(0.02, 0.06, 5), { p: [0.47, -0.04, s * 0.13], r: [Math.PI, 0, 0] });
    }
    bk.build(head);
    const jk = parts();
    part(jk, blobAt(0.34, [0.28, -0.15, 0], [1.15, 0.6, 1.3], 2, 40), { belly: 0.6 });
    part(jk, blobAt(0.19, [0.56, -0.12, 0], [1, 0.95, 1.25], 1, 41), { belly: 0.4 });
    part(jk, sweep3([[0.56, -0.02, -0.22], [0.64, 0.0, 0], [0.56, -0.02, 0.22]], [[0.06, 0.06], [0.075, 0.075], [0.06, 0.06]], { seg: 6, radial: 6, side: [0, 1, 0] }));
    jk.add(mats.mouth, blobAt(0.22, [0.34, -0.04, 0], [1.0, 0.42, 0.95], 1, 42));
    for (const s of [-1, 1]) {
      jk.add(mats.tooth, new THREE.ConeGeometry(0.045, 0.26, 6), { p: [0.58, 0.09, s * 0.16], r: [s * 0.12, 0, -0.2] });
      jk.add(mats.tooth, new THREE.ConeGeometry(0.024, 0.08, 5), { p: [0.62, 0.03, s * 0.06] });
    }
    jk.build(jaw);
  }
  head.jaw = jaw;

  // ── the arms: long, the knuckles hanging to the knees; huge hands
  const arms = [-1, 1].map((s) => {
    const arm = group(s < 0 ? 'armL' : 'armR', body, [0.3, 1.6, s * 1.0]);
    const bk = parts();
    part(bk, blobAt(0.46, [0.02, 0.06, s * 0.05], [1, 1, 1], 2, 50 + s));
    part(bk, sweep3([[0, 0, 0], [0.09, -0.55, s * 0.1], [0.18, -1.05, s * 0.18]], [[0.36, 0.38], [0.39, 0.36], [0.28, 0.3]], { seg: 9, radial: 14 }));
    bk.build(arm);
    const fore = group('fore', arm, [0.18, -1.05, s * 0.18]);
    const fk = parts();
    part(fk, blobAt(0.3, [0, 0, 0], [1, 1, 1], 1, 52 + s));
    part(fk, sweep3([[0, 0, 0], [0.1, -0.5, 0], [0.18, -0.98, 0]], [[0.3, 0.32], [0.35, 0.37], [0.24, 0.27]], { seg: 9, radial: 14 }));
    if (s < 0) {
      // the shackle on his left wrist, and its broken chain
      fk.add(mats.forged, along(lathe([[0.3, -0.12], [0.32, -0.1], [0.32, 0.1], [0.3, 0.12]], 16), V3(0.08, -0.48, 0), V3(0.16, -0.82, 0)));
      fk.add(mats.forged, ball(0.05, 6, 4), { p: [0.2, -0.82, s * 0.31] });
      chainParts(fk, mats.forged, [[0.2, -0.86, s * 0.33], [0.24, -1.2, s * 0.36], [0.14, -1.6, s * 0.34], [0.06, -1.9, s * 0.3]], { r: 0.06, wire: 0.02 });
    }
    fk.build(fore);
    const hand = group('hand', fore, [0.18, -0.98, 0]);
    const hk = parts();
    part(hk, blobAt(0.32, [0.04, -0.2, 0], [0.75, 1.0, 1.0], 2, 54 + s));
    const grip = s > 0;
    // the fingers: thick, knuckled, curled round the club's haft (right) or
    // half-closed (left)
    for (let f = 0; f < 4; f++) {
      const z = (f - 1.5) * 0.13;
      const a0 = V3(0.08, -0.42, z);
      const pts = grip
        ? [a0, V3(0.27, -0.5, z), V3(0.3, -0.66, z * 1.05), V3(0.15, -0.7, z)]
        : [a0, V3(0.14, -0.62, z), V3(0.24, -0.78, z * 1.05), V3(0.34, -0.84, z * 1.1)];
      part(hk, sweep3(pts, [[0.085, 0.085], [0.08, 0.08], [0.07, 0.07], [0.06, 0.06]], { seg: 6, radial: 8 }));
      const tip = pts[3];
      hk.add(mats.nail, lump(0.045, { p: [tip.x + 0.02, tip.y, tip.z], s: [1, 0.6, 1] }, { detail: 1, amp: 0.1 }));
    }
    const th = grip ? [V3(0.1, -0.22, s * 0.22), V3(0.24, -0.38, s * 0.2), V3(0.3, -0.5, s * 0.08)] : [V3(0.1, -0.22, s * 0.22), V3(0.22, -0.42, s * 0.24), V3(0.32, -0.52, s * 0.18)];
    part(hk, sweep3(th, [[0.1, 0.1], [0.09, 0.09], [0.07, 0.07]], { seg: 5, radial: 8 }));
    hk.build(hand);
    arm.fore = fore;
    fore.hand = hand;
    arm.hand = hand;
    return arm;
  });

  // ── the club: a gnarled trunk, banded with iron and driven through with
  // spikes, its haft wrapped where he holds it
  const club = new THREE.Group();
  club.name = 'club';
  club.position.set(0.22, -0.58, 0);
  club.quaternion.setFromUnitVectors(UP, V3(0.95, -0.3, 0.06).normalize());
  arms[1].hand.add(club);
  {
    const ck = parts();
    const shaft = sweep3([[0, -0.38, 0], [0, 0.4, 0], [0.02, 1.1, 0.01], [0, 1.8, 0], [0.01, 2.5, 0]], [[0.075, 0.075], [0.085, 0.085], [0.16, 0.16], [0.27, 0.27], [0.3, 0.3]], { seg: 14, radial: 10, bump: (p) => (fbm(n, p.y * 4, Math.atan2(p.z, p.x) * 2, { octaves: 2 }) - 0.5) * 0.05 });
    ck.add(mats.clubWood, shaft);
    ck.add(mats.clubWood, lump(0.4, { p: [0, 2.38, 0], s: [1, 1.3, 1] }, { detail: 2, amp: 0.18, seed: 7 }), { uv: 1.5 });
    ck.add(mats.leatherOld, sweep3([[0, -0.3, 0], [0, 0.35, 0]], [[0.09, 0.09], [0.095, 0.095]], { seg: 4, radial: 10 }));
    for (const y of [1.5, 2.05]) ck.add(mats.forged, new THREE.TorusGeometry(y > 2 ? 0.37 : 0.24, 0.04, 5, 16).rotateX(Math.PI / 2), { p: [0, y, 0] });
    for (let i = 0; i < 18; i++) {
      const y = 1.7 + (i / 18) * 0.95;
      const a = i * 2.4 + r() * 0.5;
      const rr = y > 2.1 ? 0.42 : 0.3;
      const d = V3(Math.cos(a), (r() - 0.3) * 0.5, Math.sin(a)).normalize();
      ck.add(mats.forged, along(new THREE.ConeGeometry(0.045, 0.3, 5).translate(0, 0.15, 0), d, V3(d.x * rr * 0.85, y, d.z * rr * 0.85)));
    }
    ck.add(mats.forged, along(new THREE.ConeGeometry(0.06, 0.34, 5).translate(0, 0.17, 0), V3(0, 1, 0), V3(0, 2.86, 0)));
    ck.build(club);
  }

  const rest = {
    hips: hips.position.clone(),
  };
  const track = createTracker({ fastest: 25 });
  const gait = createStride({ stride: 2.8, hz: 0.5, longest: 1.25, stance: 0.58, cadence: [0.6, 1.1], seed: 31 });
  // each leg on its rig: the knee where the shin hangs from the thigh, the
  // sole under the shin
  const RIG = legRig({ knee: [0.3, -0.84], foot: [0.42, -0.95] });
  const roared = createShot(1.8);
  const blow = createShot(1.1);
  const E = { last: null, hunt: 0, was: 0, cool: 0 };
  const animate = (t, { swing = 0, roar = 0, reach = Infinity } = {}) => {
    K.U.uTime.value = t;
    const dt = E.last == null ? 0 : Math.max(0, Math.min(0.1, t - E.last));
    E.last = t;
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = gait.step(dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const w = st.amount;
    const ph = st.phase;
    // the near leg's swing (+ forward), for the body's roll and the arms
    const wave = Math.cos(ph);
    // the club: as told, or its own blow, started to land as it reaches you
    E.cool = Math.max(0, E.cool - dt);
    if (!(swing > 0) && !blow.active && E.cool <= 0 && reach < 1.5 + m.speed * 0.5) {
      blow.fire();
      E.cool = 1.8;
    }
    const own = blow.step(dt);
    const sw = swing > 0 ? clamp01(swing) : Math.max(0, own);
    const up = smooth(0, 0.45, sw) * (1 - smooth(0.55, 0.78, sw));
    const down = smooth(0.55, 0.78, sw) * (1 - smooth(0.92, 1, sw) * 0.3);
    // the roar, once, as it takes up the hunt; a snarl while it hunts
    const r0 = clamp01(roar);
    if (r0 > 0.5 && E.was <= 0.5) roared.fire();
    E.was = r0;
    E.hunt = ease(E.hunt, r0, dt, 3);
    const rk = roared.step(dt);
    const ro = Math.max(rk < 0 ? 0 : smooth(0, 0.15, rk) * (1 - smooth(0.7, 1, rk)), E.hunt * 0.22);
    const breathe = Math.sin(t * 1.6) * 0.02;
    // the legs: heavy strides, each foot held where it comes down, the knee
    // bending as it comes through
    // each foot held where it comes down, its knee taking up the rest; the
    // stride under the hips, lower the longer it is; its roll with the
    // stride in its body, above them
    const cx = RIG.home[0] * (1 - w);
    const lower = RIG.sink(st.travel * w, cx) * (0.8 + 0.2 * Math.cos(2 * ph - 0.58 * Math.PI * 2));
    legs.forEach((leg, i) => {
      const f = footAt(st.cycle + (i ? 0.5 : 0), 0.58);
      const [th, sh] = RIG.reach(cx + ((f.x * st.travel) / 2) * w, RIG.home[1] + lower + down * 0.22 + f.lift * 0.32 * w);
      leg.rotation.z = th - down * 0.2 * (i ? 1 : -0.4);
      leg.rotation.x = (i ? 1 : -1) * 0.05;
      leg.shin.rotation.z = sh - down * 0.25;
    });
    hips.position.y = rest.hips.y - lower - down * 0.22;
    hips.rotation.x = 0;
    hips.rotation.y = 0;
    // the body: rolling with the stride, rearing up with the club, then
    // throwing its weight down behind the blow; chest out to roar
    body.rotation.y = -wave * 0.02 * w + up * 0.15 - down * 0.1;
    body.rotation.z = -0.05 * w + up * 0.32 - down * 0.45 + ro * 0.22 + breathe;
    body.rotation.x = wave * 0.1 * w;
    head.rotation.z = -up * 0.2 + down * 0.25 + ro * 0.55 + Math.sin(t * 0.7) * 0.04;
    head.rotation.y = Math.sin(t * 0.45) * 0.15 * (1 - ro);
    jaw.rotation.z = -0.06 - ro * 0.55 - down * 0.15 + Math.sin(t * 9) * 0.03 * ro;
    // the left arm swings and hangs; out wide when he roars
    const [L, R] = arms;
    L.rotation.z = -wave * 0.32 * w + ro * 0.5 + up * 0.25;
    L.rotation.x = -0.08 - ro * 0.55;
    L.fore.rotation.z = 0.2 + ro * 0.5 + Math.max(0, -wave) * 0.25 * w;
    // the club arm: up over his head and back, then down along +x
    const swingAng = mix(mix(wave * 0.3 * w, 3.35, up), 1.1, down);
    R.rotation.z = swingAng + ro * 0.3 * (1 - up);
    R.rotation.x = 0.12 + up * 0.35 - down * 0.1 + ro * 0.4;
    R.fore.rotation.z = 0.25 + up * 0.9 * (1 - down) - down * 0.2;
    R.hand.rotation.z = mix(mix(0, 0.4, up), -0.62, down);
  };
  animate(0);
  g.updateMatrixWorld(true);
  club.userData.head = V3(0, 2.4, 0);
  return { group: g, body, head, arms, legs, club, hips, animate };
}

// ── the goblins ──

// A Moria goblin, about 1.4 m tall, facing +x: hunched and long-armed, its
// skin a sickly grey-green, big pale eyes in a flat face, bat's ears, a
// ragged kilt and scraps of dark armour, a crude curved blade in its right
// hand. Light, for they come in swarms: all of it one skinned mesh a
// material (skin, gear, eyes), each part bound whole to its bone, so a
// goblin is three draw calls. The seed varies its size, its hunch, its
// colour, its helm and its blade. animate(t, { running }).
function goblin(K, seed = 1) {
  const { mats } = K;
  const r = rng(seed * 31 + 7);
  const n = makeNoise(seed * 17 + 5);
  const g = new THREE.Group();
  g.name = 'goblin';
  const tall = 0.92 + r() * 0.16;
  const hunch = 0.85 + r() * 0.3;
  const hue = (r() - 0.5) * 0.06;
  const helm = r() < 0.6;
  const pauldron = r() < 0.5 ? -1 : 1;
  const bladeLen = 0.55 + r() * 0.2;

  // the bones, in the pose it is built in
  const bones = [];
  const bone = (parent, p) => {
    const b = new THREE.Bone();
    b.position.set(...p);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const HIP = [0, 0.62, 0];
  const root = bone(null, [0, 0, 0]);
  const hips = bone(root, HIP);
  const body = bone(hips, [0, 0.04, 0]);
  const head = bone(body, [0.27 * hunch, 0.44, 0]);
  const arm = [-1, 1].map((s) => bone(body, [0.13 * hunch, 0.36, s * 0.18]));
  const fore = arm.map((a, i) => bone(a, [0.03, -0.24, (i ? 1 : -1) * 0.03]));
  const thigh = [-1, 1].map((s) => bone(hips, [0, -0.02, s * 0.09]));
  const shin = thigh.map((th) => bone(th, [0.07, -0.29, 0]));
  g.add(root);
  root.updateMatrixWorld(true);
  const at = (b) => b.getWorldPosition(V3());

  // its parts, each bound whole to one bone and laid where that bone is
  const lists = new Map();
  const add = (mat, b, geo, colour) => {
    const gg = geo.index ? geo.toNonIndexed() : geo;
    if (!gg.attributes.normal) gg.computeVertexNormals();
    for (const k of Object.keys(gg.attributes)) if (k !== 'position' && k !== 'normal') gg.deleteAttribute(k);
    tint(gg, colour);
    const count = gg.attributes.position.count;
    const si = new Uint16Array(count * 4);
    const sw = new Float32Array(count * 4);
    const bi = bones.indexOf(b);
    for (let i = 0; i < count; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
    }
    gg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    gg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (!lists.has(mat)) lists.set(mat, []);
    lists.get(mat).push(gg);
  };
  // the skin: grey-green, mottled, paler beneath, darker on the back
  const skinTone = (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 9, y * 9, z * 9);
    out.setRGB(0.3 + hue, 0.34, 0.26 - hue).multiplyScalar(0.78 + m * 0.42);
    out.lerp(_kd.setRGB(0.44, 0.45, 0.36), clamp01(nx * 0.5 + 0.1) * 0.35);
    out.multiplyScalar(0.7 + 0.3 * smooth(-0.8, 0.5, ny));
  };
  const skin = (b, geo) => add(mats.goblinSkin, b, geo, skinTone);
  const iron = (x, y, z, out) => out.setRGB(0.13, 0.125, 0.13).multiplyScalar(0.7 + noise3(n, x * 14, y * 14, z * 14) * 0.6).lerp(_kd.setRGB(0.22, 0.12, 0.06), smooth(0.55, 0.75, noise3(n, x * 6 + 3, y * 6, z * 6)) * 0.7);
  const rag = (x, y, z, out) => out.setRGB(0.11, 0.09, 0.075).multiplyScalar(0.7 + noise3(n, x * 10, y * 10, z * 10) * 0.6);
  const leather = (x, y, z, out) => out.setRGB(0.17, 0.11, 0.07).multiplyScalar(0.75 + noise3(n, x * 12, y * 12, z * 12) * 0.5);
  const gear = (b, geo, tone) => add(mats.goblinGear, b, geo, tone);
  const knob = (rad, o, detail = 1, amp = 0.12) => lump(rad, o, { detail, amp, freq: 1.8, seed: seed * 5 + bones.length });

  // the body: a narrow chest bent forward over a pot belly, a hump of a back
  const H = at(hips);
  const N = at(head);
  skin(body, sweep3([[H.x, H.y - 0.06, 0], [H.x + 0.06 * hunch, H.y + 0.18, 0], [N.x - 0.12, N.y - 0.1, 0], [N.x - 0.04, N.y - 0.02, 0]], [[0.15, 0.16, 0.14], [0.16, 0.18, 0.15], [0.13, 0.19, 0.16], [0.06, 0.07, 0.07]], { seg: 8, radial: 10 }));
  skin(body, knob(0.11, { p: [H.x - 0.08, N.y - 0.18, 0], s: [0.9, 1, 1.4] }));
  // the head: a low skull, a flat snout, a jaw thrust out, long bat's ears
  skin(head, knob(0.11, { p: [N.x + 0.03, N.y + 0.06, 0], s: [1.25, 0.9, 1] }));
  skin(head, knob(0.075, { p: [N.x + 0.1, N.y - 0.03, 0], s: [1.1, 0.75, 1.2] }));
  skin(head, new THREE.ConeGeometry(0.03, 0.08, 4).rotateZ(-Math.PI / 2).translate(N.x + 0.17, N.y + 0.04, 0));
  for (const s of [-1, 1]) {
    const ear = new THREE.ConeGeometry(0.045, 0.2 + r() * 0.06, 4).scale(1, 1, 0.3).translate(0, 0.1, 0);
    skin(head, along(ear, V3(-0.6, 0.45, s * 0.7), V3(N.x - 0.01, N.y + 0.08, s * 0.08)));
    // the eyes: big, pale, and glinting in the dark
    add(mats.goblinEye, head, ball(0.034, 6, 5).scale(0.9, 1, 1).translate(N.x + 0.115, N.y + 0.06, s * 0.055), (x, y, z, out) => out.setRGB(1, 1, 1).multiplyScalar(x > N.x + 0.14 && Math.abs(Math.abs(z) - 0.055) < 0.015 ? 0.15 : 1));
    // the fangs, up out of the jaw
    gear(head, new THREE.ConeGeometry(0.012, 0.045, 3).translate(N.x + 0.155, N.y - 0.01, s * 0.03), (x, y, z, out) => out.setRGB(0.55, 0.5, 0.36));
  }
  if (helm) gear(head, new THREE.SphereGeometry(0.125, 8, 3, 0, TAU, 0, Math.PI * 0.45).scale(1.2, 0.85, 1.05).translate(N.x + 0.02, N.y + 0.07, 0), iron);
  // the armour: a plate or two on the chest, a pauldron, a belt and a
  // ragged kilt
  gear(body, new THREE.CylinderGeometry(0.17, 0.165, 0.2, 7, 1, true, -Math.PI * 0.4, Math.PI * 0.8).rotateY(Math.PI / 2).rotateZ(-0.55 * hunch).translate(H.x + 0.13 * hunch, H.y + 0.27, 0), iron);
  const sh = at(arm[pauldron > 0 ? 1 : 0]);
  gear(body, new THREE.SphereGeometry(0.1, 7, 3, 0, TAU, 0, Math.PI * 0.5).scale(1.1, 0.8, 1).rotateX(pauldron * 0.5).translate(sh.x, sh.y + 0.03, sh.z + pauldron * 0.02), iron);
  gear(hips, new THREE.TorusGeometry(0.155, 0.022, 3, 10).rotateX(Math.PI / 2).scale(1, 1, 1.1).translate(H.x + 0.01, H.y + 0.02, 0), leather);
  {
    const kilt = new THREE.CylinderGeometry(0.15, 0.2, 0.24, 11, 2, true);
    const p = kilt.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.1) p.setY(i, y - 0.03 - r() * 0.07);
    }
    kilt.computeVertexNormals();
    gear(hips, kilt.scale(1, 1, 1.12).translate(H.x + 0.01, H.y - 0.1, 0), rag);
  }
  // the arms: thin, long, the hands big
  arm.forEach((a, i) => {
    const s = i ? 1 : -1;
    const A = at(a);
    const E = at(fore[i]);
    const W = E.clone().add(V3(0.03, -0.23, s * 0.01));
    skin(a, sweep3([A, A.clone().lerp(E, 0.5), E], [[0.045, 0.05], [0.042, 0.045], [0.034, 0.036]], { seg: 3, radial: 6 }));
    skin(fore[i], sweep3([E, E.clone().lerp(W, 0.5), W], [[0.034, 0.036], [0.036, 0.038], [0.028, 0.03]], { seg: 3, radial: 6 }));
    skin(fore[i], knob(0.045, { p: [W.x + 0.02, W.y - 0.04, W.z], s: [1, 1.3, 0.75] }, 0, 0.2));
    gear(fore[i], new THREE.CylinderGeometry(0.044, 0.04, 0.11, 6, 1, true).translate(E.x + 0.02, E.y - 0.14, E.z), leather);
    if (i === 1) {
      // the blade: a crude curved cleaver, ground on its outer edge, and
      // a hilt bound in leather
      const hand = V3(W.x + 0.03, W.y - 0.06, W.z);
      gear(fore[i], rod(hand.clone().add(V3(-0.02, 0.06, 0)), hand.clone().add(V3(0.02, -0.08, 0)), 0.018, 0.018, 5), leather);
      gear(fore[i], new THREE.BoxGeometry(0.03, 0.02, 0.11).translate(hand.x, hand.y - 0.085, hand.z), iron);
      const L = bladeLen;
      const pts = [0, 0.3, 0.65, 1].map((k) => hand.clone().add(V3(0.02 + k * k * L * 0.4, -0.09 - k * L, 0)));
      gear(fore[i], sweep3(pts, [[0.012, 0.035], [0.012, 0.045], [0.01, 0.05], [0.004, 0.012]], { seg: 6, radial: 4, side: [0, 0, 1], sq: 1.4 }), (x, y, z, out) => out.setRGB(0.42, 0.42, 0.4).multiplyScalar(0.7 + noise3(n, x * 20, y * 20, z * 20) * 0.5).lerp(_kd.setRGB(0.25, 0.14, 0.08), smooth(0.5, 0.7, noise3(n, x * 8, y * 8 + 3, z * 8)) * 0.8));
    }
  });
  // the legs: bowed, thin shanks, long splayed feet
  thigh.forEach((th, i) => {
    const s = i ? 1 : -1;
    const A = at(th);
    const Kn = at(shin[i]);
    const F = Kn.clone().add(V3(-0.05, -0.27, s * 0.01));
    skin(th, sweep3([A, A.clone().lerp(Kn, 0.5).add(V3(0, 0, s * 0.015)), Kn], [[0.06, 0.065], [0.055, 0.06], [0.042, 0.045]], { seg: 3, radial: 6 }));
    skin(shin[i], sweep3([Kn, Kn.clone().lerp(F, 0.5), F], [[0.042, 0.045], [0.04, 0.042], [0.03, 0.032]], { seg: 3, radial: 6 }));
    skin(shin[i], knob(0.06, { p: [F.x + 0.06, 0.035, F.z], s: [1.6, 0.55, 0.85] }, 1, 0.15));
    gear(shin[i], new THREE.CylinderGeometry(0.05, 0.045, 0.1, 6, 1, true).translate(Kn.x - 0.02, Kn.y - 0.13, Kn.z), rag);
  });

  // one skinned mesh a material, on the one skeleton; welded, so fewer
  // corners to move
  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];
  for (const [mat, geos] of lists) {
    const geo = mergeVertices(mergeGeometries(geos));
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.castShadow = true;
    g.add(mesh);
    mesh.bind(skeleton);
    meshes.push(mesh);
  }
  // its size, once bound, from its feet
  root.scale.setScalar(tall);

  const ph0 = r() * TAU;
  const rest = hips.position.clone();
  const animate = (t, { running = false } = {}) => {
    const w = running ? 1 : 0;
    const ph = t * (running ? 10 : 0) + ph0;
    const idle = Math.sin(t * 1.7 + ph0);
    // a scuttling run, low and leaning; or a crouch, swaying, the blade up
    hips.position.y = rest.y - 0.05 * w + Math.abs(Math.sin(ph)) * 0.05 * w + idle * 0.008 * (1 - w);
    hips.rotation.y = Math.sin(ph) * 0.15 * w;
    body.rotation.z = -0.28 * w - 0.1 + idle * 0.03 * (1 - w);
    body.rotation.y = -Math.sin(ph) * 0.2 * w;
    head.rotation.z = 0.32 * w + 0.12 + Math.sin(t * 2.3 + ph0) * 0.05;
    head.rotation.y = Math.sin(t * 0.9 + ph0) * 0.35 * (1 - w);
    thigh.forEach((th, i) => {
      const p = ph + (i ? Math.PI : 0);
      th.rotation.z = Math.sin(p) * 0.75 * w + (0.25 - (i ? 0.1 : -0.1)) * (1 - w);
      shin[i].rotation.z = -(0.25 + Math.max(0, Math.sin(p + 1.4)) * 1.1) * w - 0.45 * (1 - w);
    });
    arm.forEach((a, i) => {
      const s = i ? 1 : -1;
      const p = ph + (i ? 0 : Math.PI);
      a.rotation.z = Math.sin(p) * 0.7 * w + (i ? 0.9 + Math.sin(t * 3 + ph0) * 0.1 : 0.3) * (1 - w) + (i ? 0.5 : 0) * w;
      a.rotation.x = -s * 0.15;
      fore[i].rotation.z = 0.5 + Math.max(0, Math.sin(p)) * 0.5 * w + (i ? 0.6 : 0) * (1 - w);
    });
  };
  animate(0);
  return { group: g, animate, meshes, head, hips };
}

// ── Durin's Bane ──

// The Balrog's hide, for laying on from three sides: plates of black rock
// split by cracks, the big ones wide and the small hair-fine. Red the
// cracks (where the fire shows), green the plates' shading, blue soot; and
// its relief, the plates domed and the cracks deep.
function crackCanvas(S = 256) {
  const big = makeCells(201);
  const small = makeCells(203);
  const n = makeNoise(207);
  const field = new Float32Array(S * S);
  const c = paintPixels(makeCanvas(S), (u, v, out, px, py) => {
    const a = big(u * 4, v * 4, 4);
    const b = small(u * 10, v * 10, 10);
    const wob = (fbm(n, u * 8, v * 8, { period: 8, octaves: 3 }) - 0.5) * 0.06;
    const ea = a.f2 - a.f1 + wob;
    const eb = b.f2 - b.f1 + wob * 0.5;
    const wide = 1 - smooth(0.0, 0.05 + a.id * 0.04, ea);
    const fine = (1 - smooth(0.0, 0.035, eb)) * smooth(0.35, 0.6, fbm(n, u * 4 + 9, v * 4, { period: 4, octaves: 2 }));
    const crack = Math.max(wide, fine * 0.65);
    const dome = smooth(0.0, 0.3, ea) * (0.6 + 0.4 * smooth(0.0, 0.25, eb));
    const grain = n(u * 64, v * 64, 64);
    field[py * S + px] = clamp01(dome * 0.75 + grain * 0.12 - crack * 0.4 + a.id * 0.08);
    out[0] = crack * 255;
    out[1] = clamp01(0.35 + dome * 0.4 + (grain - 0.5) * 0.3 + (a.id - 0.5) * 0.3) * 255;
    out[2] = clamp01(smooth(0.6, 0.85, fbm(n, u * 6 + 3, v * 6, { period: 6, octaves: 3 })) * 0.6) * 255;
  });
  return { c, field };
}

// A cloud of cards for a flame or smoke material: `pts` the places they are
// born (in the parent's frame), each card its own seed.
function cardCloud(material, pts, seed = 1) {
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

// The membrane of a wing between its bones: a fan of panels from the wrist
// W out between each two rim points, bellying, the free edge between them
// scalloped. aWing is (how near the free edge, how near the body).
function wingSkin(W, rim, body, { n = 8, m = 6 } = {}) {
  const pos = [];
  const uv = [];
  const wing = [];
  const idx = [];
  const w = V3(...W);
  const A = V3();
  const Bv = V3();
  const nor = V3();
  const p = V3();
  const at = V3(...body);
  for (let k = 0; k < rim.length - 1; k++) {
    A.set(...rim[k]).sub(w);
    Bv.set(...rim[k + 1]).sub(w);
    nor.crossVectors(A, Bv).normalize();
    const base = pos.length / 3;
    const freeEdge = rim[k][3] ?? 1;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const sag = 1 - 0.22 * Math.sin(Math.PI * s) * freeEdge;
      for (let j = 0; j <= m; j++) {
        const t = j / m;
        p.copy(A).lerp(Bv, s).multiplyScalar(t * sag).add(w).addScaledVector(nor, 0.35 * Math.sin(Math.PI * s) * Math.sin(Math.PI * t * 0.9));
        pos.push(p.x, p.y, p.z);
        uv.push((k + s) * 1.3, t * 2.2);
        const nearBody = Math.exp(-p.distanceTo(at) / 3.2);
        wing.push(t * Math.sin(Math.PI * s) * freeEdge + t * 0.25, clamp01(nearBody + (1 - t) * 0.35));
      }
    }
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const a0 = base + i * (m + 1) + j;
        const b0 = a0 + m + 1;
        idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Durin's Bane, about 9 m to the top of its head and 11 to its horns,
// facing +x: a huge horned demon of black rock, fire flowing in its cracks;
// a bull's legs, a great chest hunched forward, long arms to clawed hands,
// a long tail; wings of shadow and smoke; a mane of flame on its head and
// neck and fire rising off its back and shoulders, smoke above; eyes like
// coals; a sword of flame in its right hand and a whip of fire in its left.
// update(t, { rage, whip }): its walk is read from where the scene puts it
// (../../creatures.js), each great foot held where it comes down however
// the gap to you opens or closes (`stride` is no longer needed); rage 0..1
// the fire up, the wings spread, the head up and
// roaring; whip 0..1 cracks the whip (up and back to 0.4, the lash rolling
// out forward to 0.8, the crack), then reaches it forward and up to wrap
// round the legs of whoever stands on the deck WHIP_REACH ahead: the deck
// it stood on, y = 0 in its parent's frame, however far it has fallen.
const WHIP_REACH = 2.2;
function balrog(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'balrog';
  const n = makeNoise(211);
  const r = rng(211);
  const rock = (geo, dark = 0) => tint(geo, (x, y, z, out, nx, ny) => {
    const v = noise3(n, x * 0.9, y * 0.9, z * 0.9);
    out.setRGB(0.05, 0.042, 0.038).multiplyScalar((0.7 + v * 0.6) * (1 - dark) * (0.7 + 0.3 * smooth(-0.7, 0.5, ny)));
  });
  const plates = (p) => (noise3(n, p.x * 1.3, p.y * 1.3, p.z * 1.3) - 0.5) * 0.22;
  const part = (bk, geo, dark = 0) => bk.add(mats.balrogSkin, rock(geo, dark));
  const knob = (rad, p, s = [1, 1, 1], detail = 2, seed = 0, rot = [0, 0, 0]) => lump(rad, { p, s, r: rot }, { detail, amp: 0.14, freq: 1.3, seed: 220 + seed });
  const spike = (bk, base, dir, len, rad) => bk.add(mats.horn, along(new THREE.ConeGeometry(rad, len, 6).translate(0, len / 2, 0), dir, base));
  const group = (name, parent, p) => {
    const o = new THREE.Group();
    o.name = name;
    o.position.set(...p);
    parent.add(o);
    return o;
  };
  const fire = (parent, pts, o, seed) => parent.add(cardCloud(flameMaterial(U, o), pts, seed));
  const smokes = (parent, pts, o, seed) => parent.add(cardCloud(smokeMaterial(U, o), pts, seed));
  const along3 = (a, b, count, jitter = 0) => {
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      out.push(V3(...a).lerp(V3(...b), t).add(V3((r() - 0.5) * jitter, (r() - 0.5) * jitter, (r() - 0.5) * jitter)));
    }
    return out;
  };

  // ── the hips, the legs and the tail
  const hips = group('hips', g, [-0.2, 4.9, 0]);
  {
    const bk = parts();
    part(bk, knob(1.25, [0, 0, 0], [1.0, 0.82, 1.25], 2, 1));
    bk.build(hips);
  }
  const legs = [-1, 1].map((s) => {
    const leg = group(s < 0 ? 'legL' : 'legR', hips, [0.1, -0.15, s * 1.15]);
    const bk = parts();
    part(bk, sweep3([[0, 0.2, 0], [0.55, -0.95, s * 0.08], [0.95, -1.75, s * 0.1]], [[0.88, 0.82], [0.78, 0.72], [0.5, 0.5]], { seg: 10, radial: 16, bump: plates }));
    part(bk, knob(0.62, [0.3, -0.55, s * 0.25], [0.8, 1.2, 0.7], 2, 2 + s));
    bk.build(leg);
    const shin = group('shin', leg, [0.95, -1.75, s * 0.1]);
    const sk = parts();
    part(sk, knob(0.5, [0.05, 0, 0], [1, 1, 1], 2, 4 + s));
    part(sk, sweep3([[0, 0, 0], [-0.35, -0.75, 0], [-0.65, -1.45, 0]], [[0.48, 0.46], [0.42, 0.4], [0.32, 0.32]], { seg: 9, radial: 14, bump: plates }));
    spike(sk, V3(0.25, 0.1, 0), V3(1, 0.4, 0), 0.6, 0.14);
    sk.build(shin);
    const foot = group('foot', shin, [-0.65, -1.45, 0]);
    const fk = parts();
    part(fk, knob(0.36, [0, 0, 0], [1, 1, 1], 1, 6 + s));
    part(fk, sweep3([[0, 0, 0], [0.18, -0.75, 0], [0.35, -1.36, 0]], [[0.3, 0.3], [0.27, 0.29], [0.3, 0.34]], { seg: 6, radial: 12, bump: plates }));
    for (let t = 0; t < 3; t++) {
      const z = (t - 1) * 0.28;
      const toe = [V3(0.35, -1.36, z * 0.4), V3(0.75, -1.4, z), V3(1.15, -1.45, z * 1.15)];
      part(fk, sweep3(toe, [[0.17, 0.17], [0.15, 0.15], [0.11, 0.11]], { seg: 5, radial: 8 }));
      spike(fk, toe[2], V3(1, -0.45, z * 0.4), 0.45, 0.09);
    }
    spike(fk, V3(-0.1, -1.2, 0), V3(-1, -0.6, 0), 0.4, 0.09);
    fk.build(foot);
    leg.shin = shin;
    shin.foot = foot;
    return leg;
  });
  const tail = group('tail', hips, [-1.0, 0.0, 0]);
  {
    const bk = parts();
    const pts = [[0, 0, 0], [-1.4, -0.7, 0.25], [-2.8, -1.9, -0.15], [-4.1, -3.4, 0.35], [-5.0, -4.3, 0.9]];
    part(bk, sweep3(pts, [[0.6, 0.6], [0.45, 0.45], [0.3, 0.3], [0.16, 0.16], [0.05, 0.05]], { seg: 18, radial: 12, bump: plates }));
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)));
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      spike(bk, curve.getPoint(t).add(V3(0, mix(0.55, 0.15, t), 0)), V3(-0.6, 1, 0), mix(0.5, 0.2, t), mix(0.12, 0.05, t));
    }
    bk.build(tail);
    fire(tail, along3([-4.0, -3.2, 0.3], [-5.1, -4.3, 0.95], 14, 0.25), { size: 0.6, rise: 1.3, heat: 0.6 }, 31);
  }

  // ── the body: a waist of plated rock, a vast chest, shoulders like crags
  const body = group('body', hips, [0, 0.1, 0]);
  {
    const bk = parts();
    part(bk, sweep3([[0, -0.5, 0], [0.3, 0.9, 0], [0.6, 2.05, 0], [0.78, 2.95, 0], [0.92, 3.55, 0]], [[1.05, 1.2, 0.95], [0.92, 1.12, 0.9], [1.3, 1.72, 1.12], [1.38, 1.95, 1.2], [0.9, 1.3, 0.85]], { seg: 18, radial: 22, bump: plates }));
    for (const s of [-1, 1]) {
      part(bk, knob(0.78, [1.38, 2.72, s * 0.78], [0.55, 0.85, 1.05], 2, 10 + s));
      for (let k = 0; k < 4; k++) part(bk, knob(0.34, [1.12 - k * 0.04, 0.95 + k * 0.42, s * 0.36], [0.55, 0.7, 0.95], 1, 12 + k + s * 4));
      part(bk, knob(0.62, [0.72, 0.6, s * 1.0], [0.8, 1.2, 0.7], 2, 20 + s));
      // the shoulders, and the spikes on them
      part(bk, knob(1.0, [0.5, 3.4, s * 1.9], [1.05, 0.95, 1], 2, 22 + s));
      spike(bk, V3(0.3, 4.0, s * 2.2), V3(-0.2, 1, s * 0.5), 1.1, 0.24);
      spike(bk, V3(-0.1, 3.7, s * 2.5), V3(-0.6, 0.8, s * 0.6), 0.8, 0.2);
    }
    // the ridge of the back: a row of spines
    for (let k = 0; k < 7; k++) {
      const t = k / 6;
      const at = V3(mix(-0.6, -1.05, Math.sin(t * Math.PI) * 0.6 + t * 0.4), mix(0.6, 3.6, t), 0);
      spike(bk, at, V3(-1, 0.55, 0), mix(0.5, 0.9, Math.sin(t * Math.PI)), 0.16);
    }
    part(bk, knob(0.95, [-0.55, 2.9, 0], [0.8, 1.0, 1.4], 2, 26), 0.1);
    // the neck
    part(bk, sweep3([[0.75, 3.35, 0], [1.35, 3.85, 0], [1.9, 4.12, 0]], [[0.88, 0.98], [0.72, 0.78], [0.56, 0.62]], { seg: 8, radial: 16, bump: plates }));
    bk.build(body);
    // the fire off its back and shoulders, and the smoke going up from it
    const back = [];
    for (let k = 0; k < 46; k++) {
      const t = r();
      back.push(V3(mix(-0.6, -1.15, Math.sin(t * Math.PI) * 0.6 + t * 0.4) + (r() - 0.5) * 0.4, mix(0.8, 3.9, t), (r() - 0.5) * 1.1));
    }
    for (const s of [-1, 1]) for (let k = 0; k < 22; k++) back.push(V3(0.4 + (r() - 0.5) * 1.0, 4.0 + r() * 0.3, s * (1.6 + r() * 0.9)));
    fire(body, back, { size: 1.0, rise: 2.4, heat: 0.5 }, 41);
    smokes(body, back.filter((_, i) => i % 3 === 0), { size: 2.6, rise: 9 }, 43);
  }

  // ── the head: a long skull, a heavy brow over eyes like coals, a muzzle
  // of fangs, horns sweeping back and out and round to the front; a mane of
  // flame from the brow back down the neck
  const head = group('head', body, [1.95, 4.2, 0]);
  const jaw = group('jaw', head, [0.3, -0.1, 0]);
  {
    const bk = parts();
    part(bk, knob(0.64, [0.05, 0.35, 0], [1.2, 0.85, 0.85], 2, 30));
    part(bk, sweep3([[0.55, 0.62, -0.46], [0.72, 0.56, 0], [0.55, 0.62, 0.46]], [[0.16, 0.16], [0.2, 0.18], [0.16, 0.16]], { seg: 6, radial: 8, side: [0, 1, 0] }));
    part(bk, sweep3([[0.35, 0.2, 0], [0.9, 0.12, 0], [1.4, 0.02, 0]], [[0.42, 0.5], [0.32, 0.38], [0.2, 0.25]], { seg: 8, radial: 12, bump: plates }));
    for (const s of [-1, 1]) {
      part(bk, knob(0.24, [0.55, 0.18, s * 0.42], [1.2, 0.8, 0.8], 1, 31 + s));
      // the eyes, deep in their sockets, burning; and the nostrils
      bk.add(mats.balrogEye, ball(0.1, 8, 6), { p: [0.66, 0.42, s * 0.3], s: [0.7, 0.75, 1.1] });
      bk.add(mats.balrogEye, ball(0.045, 6, 4), { p: [1.32, 0.12, s * 0.13] });
      // the horns
      const hp = [[0.0, 0.72, s * 0.42], [-0.65, 1.2, s * 1.0], [-0.55, 1.95, s * 1.55], [0.25, 2.35, s * 1.72], [1.0, 2.15, s * 1.5]];
      bk.add(mats.horn, sweep3(hp, [[0.32, 0.3], [0.27, 0.26], [0.2, 0.19], [0.12, 0.11], [0.02, 0.02]], { seg: 22, radial: 10, bump: (p, o, u, v) => Math.max(0, Math.sin(v * 70)) * 0.025 * (1 - v) }));
      for (let k = 0; k < 5; k++) bk.add(mats.horn, new THREE.ConeGeometry(0.035, 0.16, 4), { p: [1.0 - k * 0.12, 0.0, s * 0.18], r: [Math.PI, 0, 0] });
    }
    bk.build(head);
    const jk = parts();
    part(jk, sweep3([[0, 0, 0], [0.6, -0.16, 0], [1.05, -0.2, 0]], [[0.36, 0.42], [0.26, 0.32], [0.16, 0.2]], { seg: 8, radial: 12, bump: plates }));
    for (const s of [-1, 1]) for (let k = 0; k < 5; k++) jk.add(mats.horn, new THREE.ConeGeometry(0.04, 0.2, 4), { p: [1.0 - k * 0.13, 0.02, s * 0.17] });
    // the furnace of its mouth
    jk.add(mats.fireSolid, knob(0.22, [0.5, 0.05, 0], [1.6, 0.5, 0.9], 1, 35));
    jk.build(jaw);
    const mane = [];
    for (let k = 0; k < 64; k++) {
      const t = r();
      const p = t < 0.55
        ? V3(mix(0.55, -0.5, t / 0.55), 0.85 - (t / 0.55) * 0.2 + r() * 0.1, (r() - 0.5) * 0.7)
        : V3(mix(-0.5, -1.4, (t - 0.55) / 0.45), mix(0.6, -0.2, (t - 0.55) / 0.45), (r() - 0.5) * 1.0);
      mane.push(p);
    }
    fire(head, mane, { size: 0.85, rise: 2.0, heat: 0.6, rate: 1.1 }, 51);
  }

  // ── the arms: shoulders like boulders, elbows spiked, clawed hands
  const arms = [-1, 1].map((s) => {
    const arm = group(s < 0 ? 'armL' : 'armR', body, [0.55, 3.2, s * 2.15]);
    const bk = parts();
    part(bk, knob(0.85, [0, 0.05, s * 0.05], [1, 1, 1], 2, 60 + s));
    part(bk, sweep3([[0, 0, 0], [0.25, -1.1, s * 0.22], [0.4, -2.0, s * 0.32]], [[0.76, 0.74], [0.72, 0.68], [0.5, 0.5]], { seg: 10, radial: 16, bump: plates }));
    bk.build(arm);
    const fore = group('fore', arm, [0.4, -2.0, s * 0.32]);
    const fk = parts();
    part(fk, knob(0.5, [0, 0, 0], [1, 1, 1], 1, 62 + s));
    spike(fk, V3(-0.35, 0.05, 0), V3(-1, -0.2, s * 0.2), 0.8, 0.16);
    part(fk, sweep3([[0, 0, 0], [0.5, -0.85, 0], [0.95, -1.7, 0]], [[0.5, 0.55], [0.56, 0.58], [0.36, 0.4]], { seg: 10, radial: 16, bump: plates }));
    fk.build(fore);
    fire(fore, along3([-0.2, -0.1, s * 0.3], [0.7, -1.4, s * 0.35], 16, 0.3), { size: 0.7, rise: 1.5, heat: 0.55 }, 70 + s);
    const hand = group('hand', fore, [0.95, -1.7, 0]);
    const hk = parts();
    part(hk, knob(0.48, [0.05, -0.28, 0], [0.8, 1.0, 1.0], 2, 64 + s));
    // the fingers, curled round the sword's hilt and the whip's
    for (let f = 0; f < 4; f++) {
      const z = (f - 1.5) * 0.2;
      const pts = [V3(0.15, -0.62, z), V3(0.45, -0.75, z), V3(0.5, -1.0, z * 1.05), V3(0.28, -1.08, z)];
      part(hk, sweep3(pts, [[0.13, 0.13], [0.12, 0.12], [0.1, 0.1], [0.08, 0.08]], { seg: 6, radial: 8 }));
      spike(hk, pts[3], pts[3].clone().sub(pts[2]), 0.22, 0.06);
    }
    part(hk, sweep3([V3(0.15, -0.32, s * 0.36), V3(0.42, -0.55, s * 0.32), V3(0.52, -0.75, s * 0.12)], [[0.15, 0.15], [0.13, 0.13], [0.1, 0.1]], { seg: 5, radial: 8 }));
    hk.build(hand);
    arm.fore = fore;
    fore.hand = hand;
    arm.hand = hand;
    return arm;
  });

  // ── the sword of flame, in its right hand
  const sword = new THREE.Group();
  sword.name = 'sword';
  sword.position.set(0.42, -0.9, 0);
  sword.quaternion.setFromUnitVectors(UP, V3(0.75, -0.55, 0.12).normalize());
  arms[1].hand.add(sword);
  {
    const sk = parts();
    const L = 5.2;
    const blade = sweep3([[0, 0.4, 0], [0.04, 1.6, 0], [0.12, 3.2, 0], [0.04, 4.6, 0], [-0.1, L, 0]], [[0.04, 0.32], [0.05, 0.36], [0.05, 0.3], [0.04, 0.2], [0.01, 0.02]], { seg: 24, radial: 8, side: [0, 0, 1], bump: (p, o, u, v) => (Math.abs(o.z) > 0.5 ? (n(v * 30, u * 4) - 0.5) * 0.12 : 0) });
    sk.add(mats.fireSolid, blade);
    sk.add(mats.horn, sweep3([[0, 0.38, -0.7], [0, 0.48, 0], [0, 0.38, 0.7]], [[0.1, 0.1], [0.14, 0.14], [0.06, 0.06]], { seg: 8, radial: 8, side: [1, 0, 0] }));
    sk.add(mats.horn, sweep3([[0, -0.5, 0], [0, 0.4, 0]], [[0.1, 0.1], [0.1, 0.1]], { seg: 3, radial: 8 }));
    sk.build(sword);
    const pts = [];
    for (let k = 0; k < 52; k++) {
      const t = r();
      pts.push(V3(Math.sin(t * 3) * 0.08, mix(0.6, L - 0.2, t), (r() - 0.5) * 0.5 * (1 - t * 0.7)));
    }
    fire(sword, pts, { size: 0.6, rise: 1.2, heat: 0.7, rate: 1.4 }, 81);
  }

  // ── the whip of fire, in its left hand: a tapering lash rebuilt each frame
  const WN = 56;
  const WR = 8;
  const WLEN = 10.5;
  const wpos = new Float32Array((WN + 1) * (WR + 1) * 3);
  const wnor = new Float32Array((WN + 1) * (WR + 1) * 3);
  const wuv = new Float32Array((WN + 1) * (WR + 1) * 2);
  const widx = [];
  for (let i = 0; i <= WN; i++) {
    for (let j = 0; j <= WR; j++) wuv.set([j / WR, (i / WN) * WLEN], (i * (WR + 1) + j) * 2);
  }
  for (let i = 0; i < WN; i++) {
    for (let j = 0; j < WR; j++) {
      const a = i * (WR + 1) + j;
      widx.push(a, a + WR + 1, a + 1, a + 1, a + WR + 1, a + WR + 2);
    }
  }
  const wgeo = new THREE.BufferGeometry();
  wgeo.setAttribute('position', new THREE.BufferAttribute(wpos, 3).setUsage(THREE.DynamicDrawUsage));
  wgeo.setAttribute('normal', new THREE.BufferAttribute(wnor, 3).setUsage(THREE.DynamicDrawUsage));
  wgeo.setAttribute('uv', new THREE.BufferAttribute(wuv, 2));
  wgeo.setIndex(widx);
  const whipMesh = new THREE.Mesh(wgeo, mats.fireSolid);
  whipMesh.name = 'whip';
  whipMesh.frustumCulled = false;
  g.add(whipMesh);
  const WF = 46;
  const whipFire = cardCloud(flameMaterial(U, { size: 0.55, rise: 0.9, heat: 1, rate: 1.5 }), Array.from({ length: WF }, () => V3()), 91);
  g.add(whipFire);
  const wsAt = Array.from({ length: WF }, (_, i) => Math.pow((i + 0.5) / WF, 0.8));
  const whipPts = Array.from({ length: WN + 1 }, () => V3());

  // ── the wings: shadow and smoke on a frame of bones
  const wings = [-1, 1].map((s) => {
    const root = group(s < 0 ? 'wingL' : 'wingR', body, [-0.85, 3.3, s * 0.9]);
    const frame = new THREE.Group();
    frame.scale.z = s;
    root.add(frame);
    const W = [-0.3, 3.4, 5.0];
    const E = [-1.1, 1.8, 2.5];
    const F = [[-1.4, 5.6, 7.6], [-3.6, 4.2, 8.6], [-5.4, 1.6, 7.8], [-5.2, -1.4, 5.4]];
    const bodyEnd = [-2.2, -2.6, 0.9];
    const bk = parts();
    bk.add(mats.horn, sweep3([[0, 0, 0], E, W], [[0.36, 0.36], [0.28, 0.28], [0.2, 0.2]], { seg: 10, radial: 8 }));
    for (const f of F) {
      const mid = V3(...W).lerp(V3(...f), 0.5).add(V3(0.3, 0.35, 0));
      bk.add(mats.horn, sweep3([W, mid.toArray(), f], [[0.14, 0.14], [0.09, 0.09], [0.02, 0.02]], { seg: 10, radial: 6 }));
    }
    spike(bk, V3(...W), V3(0.3, 1, 0.2), 0.9, 0.14);
    bk.build(frame);
    // the skin: between the fingers, back to the body, and before the arm
    const rim = [[...F[0], 1], [...F[1], 1], [...F[2], 1], [...F[3], 1], [...bodyEnd, 0.6]];
    const skin = new THREE.Mesh(wingSkin(W, rim, [0, 0, 0]), mats.wing);
    const front = new THREE.Mesh(wingSkin([0, 0, 0], [[...E, 0.2], [...W, 0.2], [...F[0], 0.9]], [0, 0, 0], { n: 5, m: 4 }), mats.wing);
    const back = new THREE.Mesh(wingSkin([0, 0, 0], [[...W, 0], [...bodyEnd, 0.5]], [0, 0, 0], { n: 4, m: 4 }), mats.wing);
    for (const m of [skin, front, back]) {
      m.renderOrder = 4;
      frame.add(m);
    }
    // smoke streaming off the wing's edge
    const edge = [];
    for (let k = 0; k < 30; k++) {
      const a = Math.floor(r() * (F.length - 1));
      edge.push(V3(...F[a]).lerp(V3(...F[a + 1]), r()).lerp(V3(...W), r() * 0.3));
    }
    smokes(frame, edge, { size: 2.4, rise: 5 }, 100 + s);
    return root;
  });

  // ── moving it
  const rest = { hips: hips.position.clone() };
  const _m = new THREE.Matrix4();
  const _p = V3();
  const _q = V3();
  const _t = V3();
  const _s = V3();
  const _b = V3();
  const _a = V3();
  const _c1 = V3();
  const _c2 = V3();
  const whipAngles = new Float32Array(WN);
  const buildWhip = (t, k) => {
    // where the lash leaves the hand, in the group's frame
    g.updateMatrixWorld(true);
    _m.copy(g.matrixWorld).invert();
    arms[0].hand.localToWorld(_p.set(0.35, -0.95, 0)).applyMatrix4(_m);
    const seg = WLEN / WN;
    const up = smooth(0.02, 0.4, k);
    const lash = clamp01((k - 0.4) / 0.4);
    const crack = smooth(0.74, 0.8, k) * (1 - smooth(0.8, 0.9, k));
    const reach = smooth(0.8, 1, k);
    // lying, raised, then lashing out forward: a chain of fixed links
    for (let i = 0; i < WN; i++) {
      const s = i / (WN - 1);
      const lying = mix(-1.75, -2.95, smooth(0, 0.3, s)) + 0.1 * Math.sin(t * 1.3 + s * 9);
      const raised = mix(2.25, 3.0, s) - 0.5 * s * s + 0.06 * Math.sin(t * 3 + s * 7);
      const out = mix(0.22, -0.1, s) + crack * 0.5 * Math.sin(s * 14 - k * 40) * smooth(0.6, 1, s);
      const p = clamp01((lash - s * 0.55) / 0.45);
      whipAngles[i] = mix(mix(lying, raised, up), out, smooth(0, 1, p));
    }
    whipPts[0].copy(_p);
    let z = 0;
    for (let i = 0; i < WN; i++) {
      const s = i / (WN - 1);
      z += seg * mix(-0.35 * smooth(0.1, 0.8, s), 0.05, up) * (1 - lash * 0.8);
      whipPts[i + 1].set(whipPts[i].x + Math.cos(whipAngles[i]) * seg, Math.max(0.05, whipPts[i].y + Math.sin(whipAngles[i]) * seg), _p.z + z);
    }
    // reaching: up to the deck and twice round the legs of whoever is there
    if (reach > 0) {
      const deck = Math.max(0, -g.position.y);
      const R = 0.3;
      _a.set(WHIP_REACH - R, deck + 0.85, 0);
      const dy = _a.y - _p.y;
      _c1.set(_p.x + 1.4, _p.y + dy * 0.35 + 1.5, _p.z * 0.6);
      _c2.set(_a.x - 1.2, _a.y - dy * 0.3 + 0.4, R * 2);
      const W0 = 0.66;
      for (let i = 1; i <= WN; i++) {
        const s = i / WN;
        if (s <= W0) {
          const u = s / W0;
          const v = 1 - u;
          _q.copy(_p).multiplyScalar(v * v * v).addScaledVector(_c1, 3 * v * v * u).addScaledVector(_c2, 3 * v * u * u).addScaledVector(_a, u * u * u);
        } else {
          const u = (s - W0) / (1 - W0);
          const a = Math.PI + u * TAU * 2.2 + Math.sin(t * 5) * 0.05 * u;
          _q.set(WHIP_REACH + Math.cos(a) * R * (1 - 0.15 * u), deck + mix(0.85, 0.18, u), -Math.sin(a) * R * (1 - 0.15 * u));
        }
        whipPts[i].lerp(_q, reach);
      }
    }
    // the tube round it
    for (let i = 0; i <= WN; i++) {
      const a = whipPts[Math.max(0, i - 1)];
      const b = whipPts[Math.min(WN, i + 1)];
      _t.subVectors(b, a).normalize();
      _s.set(0, 0, 1).addScaledVector(_t, -_t.z);
      if (_s.lengthSq() < 1e-6) _s.set(0, 1, 0);
      _s.normalize();
      _b.crossVectors(_t, _s);
      const rad = mix(0.13, mix(0.025, 0.05, reach), Math.pow(i / WN, 0.7));
      for (let j = 0; j <= WR; j++) {
        const th = (j / WR) * TAU;
        _q.copy(_s).multiplyScalar(Math.cos(th)).addScaledVector(_b, Math.sin(th));
        const o = (i * (WR + 1) + j) * 3;
        wpos[o] = whipPts[i].x + _q.x * rad;
        wpos[o + 1] = whipPts[i].y + _q.y * rad;
        wpos[o + 2] = whipPts[i].z + _q.z * rad;
        wnor[o] = _q.x;
        wnor[o + 1] = _q.y;
        wnor[o + 2] = _q.z;
      }
    }
    wgeo.attributes.position.needsUpdate = true;
    wgeo.attributes.normal.needsUpdate = true;
    // its flames, riding along it
    const em = whipFire.geometry.attributes.aEmit;
    for (let f = 0; f < WF; f++) {
      const x = wsAt[f] * WN;
      const i = Math.min(WN - 1, Math.floor(x));
      _q.copy(whipPts[i]).lerp(whipPts[i + 1], x - i);
      em.setXYZ(f, _q.x, _q.y, _q.z);
    }
    em.needsUpdate = true;
    whipFire.material.uniforms.uHeat.value = 0.8 + crack * 0.8 + reach * 0.3;
  };

  // its walk: a stride from the ground it covers, a heavy tread
  const track = createTracker({ fastest: 40 });
  const gait = createStride({ stride: 6.0, hz: 0.8, longest: 1.3, stance: 0.54, cadence: [0.9, 1.3], seed: 13 });
  // each leg on its rig, to the ankle (the great foot kept level beneath
  // it while it's down): the knee where the shin hangs from the thigh
  const RIG = legRig({ knee: [0.95, -1.75], foot: [-0.65, -1.45], rest: [0.04, 0] });
  const update = (t, { rage = 0, whip = 0 } = {}) => {
    U.uTime.value = t;
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = gait.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const w = st.amount;
    const ra = clamp01(rage);
    const k = clamp01(whip);
    U.uRage.value = ra;
    const ph = st.phase;
    // the near leg's swing (+ forward), for the body's roll and the arms
    const sw = Math.cos(ph);
    // each great foot held where it comes down, kept level, its knee taking
    // up the rest; the stride under the hips, lower the longer it is
    const cx = RIG.home[0] * (1 - w);
    const lower = RIG.sink(st.travel * w, cx) * (0.8 + 0.2 * Math.cos(2 * ph - 0.54 * Math.PI * 2));
    legs.forEach((leg, i) => {
      const f = footAt(st.cycle + (i ? 0.5 : 0), 0.54);
      const [th, sh] = RIG.reach(cx + ((f.x * st.travel) / 2) * w, RIG.home[1] + lower + ra * 0.15 + f.lift * 0.8 * w);
      leg.rotation.z = th;
      leg.rotation.x = (i ? 1 : -1) * 0.04;
      leg.shin.rotation.z = sh;
      leg.shin.foot.rotation.z = 0.04 - th - sh + f.lift * 0.5 * w;
    });
    hips.position.y = rest.hips.y - lower - ra * 0.15;
    // (its roll with the stride in its body, above the hips, so the
    // planted foot isn't swung about with it)
    hips.rotation.x = 0;
    hips.rotation.y = 0;
    tail.rotation.y = Math.sin(t * 0.8) * 0.25 + sw * 0.12 * w;
    tail.rotation.z = Math.sin(t * 0.6 + 1) * 0.08 - ra * 0.15;
    const heave = Math.sin(t * 1.1) * 0.02 + ra * Math.sin(t * 3.3) * 0.02;
    const reach = smooth(0.8, 1, k);
    body.rotation.y = -sw * 0.01 * w;
    body.rotation.x = sw * 0.05 * w;
    body.rotation.z = -0.12 - 0.05 * w + ra * 0.24 + heave - smooth(0.45, 0.75, k) * 0.12 * (1 - reach);
    head.rotation.z = -0.05 + ra * 0.38 + Math.sin(t * 0.7) * 0.04;
    head.rotation.y = Math.sin(t * 0.33) * 0.18 * (1 - ra);
    jaw.rotation.z = -0.08 - ra * (0.45 + Math.sin(t * 7) * 0.05);
    // the sword arm: low, swinging with the walk, raised in its rage
    const [L, R] = arms;
    R.rotation.z = -sw * 0.22 * w + ra * 0.7 + 0.15;
    R.rotation.x = 0.15 + ra * 0.25;
    R.fore.rotation.z = 0.35 + ra * 0.5;
    // the whip arm: up and back, then down and forward with the lash, then
    // up after it as it reaches
    const wu = smooth(0.02, 0.4, k) * (1 - smooth(0.45, 0.72, k));
    const wd = smooth(0.45, 0.72, k);
    L.rotation.z = mix(mix(sw * 0.22 * w + 0.1 + ra * 0.3, 2.9, wu) * (1 - wd) + wd * 1.15, 1.9, reach);
    L.rotation.x = -0.15 - ra * 0.2 - wu * 0.2 + reach * 0.25;
    L.fore.rotation.z = 0.3 + wu * 0.9 - wd * 0.2 + reach * 0.3;
    // the wings: half open, wide in its rage, slowly beating
    const spread = 0.3 + 0.7 * ra;
    const beat = Math.sin(t * 1.2) * (0.06 + 0.1 * ra);
    wings.forEach((wg, i) => {
      const s = i ? 1 : -1;
      wg.rotation.x = -s * (0.6 * (1 - spread) - beat);
      wg.rotation.y = s * (0.9 * (1 - spread) + 0.05);
      wg.rotation.z = -0.15 * (1 - spread) + beat * 0.5;
    });
    buildWhip(t, k);
  };
  update(0);
  return { group: g, update, body, head, arms, legs, wings, tail, sword, whip: whipMesh };
}

// ── fallen stone ──

// A pile of fallen rock about 3 m across, one geometry coloured at its
// corners for instancing: a few big broken lumps, squared blocks from the
// dwarves' masonry among them, and smaller stones heaped round and between.
function rubbleGeo(seed = 1) {
  const r = rng(seed * 19 + 1);
  const n = makeNoise(seed * 3 + 2);
  const geos = [];
  const heap = (d) => 0.75 * Math.pow(Math.max(0, 1 - d / 1.6), 1.4);
  const put = (geo, x, z, lift, tone) => {
    geo.rotateY(r() * TAU).rotateX((r() - 0.5) * 0.6).rotateZ((r() - 0.5) * 0.6);
    geo.translate(x, heap(Math.hypot(x, z)) + lift, z);
    boxUV(geo, 0.5);
    tint(geo, (px, py, pz, out, nx, ny) => {
      const v = noise3(n, px * 2.5, py * 2.5, pz * 2.5);
      out.setRGB(tone, tone, tone * 1.02).multiplyScalar(0.75 + v * 0.45);
      // dust settled on the tops, grime low down
      out.lerp(_kd.setRGB(0.95, 0.93, 0.88), clamp01(ny) * 0.18);
      out.multiplyScalar(mix(0.55, 1, smooth(0, 0.5, py)));
    });
    geos.push(geo);
  };
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU;
    const d = 0.2 + r() * 0.5;
    put(chunkGeo(seed * 7 + i, 0.55 + r() * 0.3, 0.6, 12), Math.cos(a) * d, Math.sin(a) * d, -0.15, 0.8 + r() * 0.2);
  }
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU;
    const d = 0.4 + r() * 0.8;
    put(blockGeo(0.5 + r() * 0.4, 0.35 + r() * 0.15, 0.4 + r() * 0.2, seed * 11 + i, 0.05), Math.cos(a) * d, Math.sin(a) * d, -0.05, 0.95 + r() * 0.15);
  }
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 1.55;
    const s = mix(0.1, 0.32, r()) * (1.2 - d * 0.35);
    put(chunkGeo(seed * 13 + i + 20, s, 0.55, 8), Math.cos(a) * d, Math.sin(a) * d, s * 0.1, 0.7 + r() * 0.3);
  }
  const g = mergeGeometries(geos);
  g.computeBoundingSphere();
  return g;
}

// ── Gandalf's staff ──

// The staff-light: a soft white glow with a hot core, for the tip of the
// staff. set(k): 0 out, 1 bright; it grows as it brightens.
function staffLight(K) {
  const halo = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xdfe9ff, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xffffff, 3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sprite = new THREE.Sprite(halo);
  sprite.name = 'staffLight';
  const inner = new THREE.Sprite(core);
  inner.scale.setScalar(0.32);
  sprite.add(inner);
  sprite.renderOrder = 5;
  inner.renderOrder = 5;
  const set = (k) => {
    const t = clamp01(k);
    sprite.visible = t > 0.001;
    sprite.scale.setScalar(mix(0.25, 2.4, t));
    halo.opacity = mix(0.3, 0.85, t);
    core.opacity = mix(0.6, 1, t);
    core.color.copy(hot(0xffffff, mix(1.5, 4, t)));
  };
  set(0.6);
  return { sprite, set };
}

// ── the kit ──

export function createMoriaKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const basalt = basaltCanvas(S, 5);
  const rock = rockCanvas(S, 9);
  const ashlar = ashlarCanvas(S, 11);
  const floor = floorCanvas(512, 13);
  const carving = carvingCanvas();
  const tex = {
    basalt: T(basalt.c),
    basaltN: T(normalFromField(basalt.field, S, S, 1.4), { srgb: false }),
    basaltR: T(greyFromField(basalt.rough, S, S), { srgb: false }),
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    ashlar: T(ashlar.c),
    ashlarN: T(normalFromField(ashlar.field, S, S, 2.2), { srgb: false }),
    floor: T(floor.c),
    floorN: T(normalFromField(floor.field, 512, 512, 2), { srgb: false }),
    carve: T(carving.c),
    carveN: T(normalFromField(carving.field, carving.W, carving.H, 5), { srgb: false }),
    ithildin: T(ithildinCanvas(), { wrap: false }),
    holly: T(hollyCanvas(), { wrap: false }),
    glow: T(glowCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
  };
  // the dressed face of the gate: the rock's texture laid as on the cliff
  // round it (four metres a repeat, lined up), the drawing over the whole
  const rockFace = tex.rock.clone();
  const rockFaceN = tex.rockN.clone();
  for (const t of [rockFace, rockFaceN]) {
    t.repeat.set(GATE.w / 4, GATE.h / 4);
    t.offset.set(-GATE.w / 2 / 4, 0);
  }
  const night = nightEnv(renderer);
  const cave = caveEnv(renderer);

  // the shaders' shared numbers
  const U = {
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uRevealAt: { value: V3() },
    uRevealCam: { value: 1 },
    uRevealColor: { value: new THREE.Color(0.72, 0.84, 1.0) },
    uIthil: { value: 0 },
    uFire: { value: 1 },
    uFireColor: { value: new THREE.Color(1.0, 0.3, 0.07) },
    uNoise: { value: tex.noise },
    uRage: { value: 0 },
  };

  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const stone = { map: tex.basalt, normalMap: tex.basaltN, roughnessMap: tex.basaltR, roughness: 1 };
  Object.assign(mats, {
    // polished stone of the deeps, dark grey-green; dressed walls; carved
    // bands; paving
    basalt: M({ ...stone, color: 0x4c5652, vertexColors: true }),
    ashlar: M({ map: tex.ashlar, normalMap: tex.ashlarN, color: 0x56605c, roughness: 0.62, vertexColors: true }),
    carve: M({ map: tex.carve, normalMap: tex.carveN, normalScale: new THREE.Vector2(1.4, 1.4), color: 0x56605c, roughness: 0.5 }),
    paving: M({ map: tex.floor, normalMap: tex.floorN, color: 0x56605c, roughness: 0.5 }),
    // the gate: the cliff, its dressed face with the ithildin, the passage
    cliff: M({ map: tex.rock, normalMap: tex.rockN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.92 }),
    gateStone: M({ map: tex.rock, normalMap: tex.rockN, color: 0x9a9ea4, roughness: 0.88 }),
    ithildin: M({ map: rockFace, normalMap: rockFaceN, normalScale: new THREE.Vector2(0.45, 0.45), vertexColors: true, roughness: 0.8, emissive: new THREE.Color(0.62, 0.78, 1.0), emissiveMap: tex.ithildin, emissiveIntensity: 1.5 }),
    deep: M({ vertexColors: true, color: 0x8a8e96, roughness: 0.95 }),
    holly: M({ map: tex.holly, alphaTest: 0.45, side: THREE.DoubleSide, vertexColors: true, roughness: 0.34, envMap: night, envMapIntensity: 0.6 }),
    hollyDark: M({ color: 0x0d1a0c, roughness: 0.9 }),
    hollyBark: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x8a8a80, roughness: 0.9 }),
  });
  // the Watcher: wet, dark, a ring of ripples on the pool round each arm
  const tskin = tentacleCanvas(256);
  tex.tentacleN = T(normalFromField(tskin, 256, 256, 3.5), { srgb: false, repeat: [1, 1.6] });
  Object.assign(mats, {
    tentacle: M({ vertexColors: true, normalMap: tex.tentacleN, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.2, metalness: 0.05, envMap: night, envMapIntensity: 1.1 }),
    ripple: rippleMaterial(),
  });

  // the ithildin: lit by the moon (uIthil), coming out line by line in a
  // shimmer as the light finds it
  mats.ithildin = ithildinGlow(mats.ithildin, U);
  // the Chamber of Mazarbul: the tomb, the dead and their gear, the book
  const tomb = tombCanvas();
  const mail = mailCanvas();
  tex.tombTop = T(tomb.c, { wrap: false });
  tex.tombTopN = T(normalFromField(tomb.field, tomb.W, tomb.H, 3), { srgb: false, wrap: false });
  tex.mail = T(mail.c, { repeat: [4, 5] });
  tex.mailN = T(normalFromField(mail.field, 128, 128, 2.5), { srgb: false, repeat: [4, 5] });
  tex.page = T(pageCanvas(), { wrap: false });
  Object.assign(mats, {
    daylight: new THREE.MeshBasicMaterial({ color: hot(0xdfe6f0, 2.4), fog: false }),
    tomb: M({ ...stone, color: 0xd6d2c8, roughness: 0.8 }),
    tombTop: M({ map: tex.tombTop, normalMap: tex.tombTopN, roughness: 0.6 }),
    tombCarve: M({ map: tex.carve, normalMap: tex.carveN, color: 0xd6d2c8, roughness: 0.55 }),
    bone: M({ vertexColors: true, roughness: 0.78 }),
    beard: M({ color: 0x8a8680, roughness: 0.95 }),
    mail: M({ map: tex.mail, normalMap: tex.mailN, color: 0x8a8c90, metalness: 0.75, roughness: 0.5, envMap: cave, envMapIntensity: 0.8, side: THREE.DoubleSide }),
    rustIron: M({ color: 0x4e4038, metalness: 0.55, roughness: 0.62, envMap: cave, envMapIntensity: 0.6 }),
    oldSteel: M({ color: 0x9a9ea4, metalness: 0.85, roughness: 0.35, envMap: cave, envMapIntensity: 0.9 }),
    oldWood: M({ map: K.tex.planks, normalMap: K.tex.planksN, color: 0x6a5440, roughness: 0.85 }),
    leatherOld: M({ color: 0x3a2a1e, roughness: 0.7 }),
    bookCover: M({ color: 0x4a2418, roughness: 0.6 }),
    paper: M({ color: 0xd8c8a0, roughness: 0.9 }),
    page: M({ map: tex.page, roughness: 0.85 }),
    arrow: M({ color: 0x1a1612, roughness: 0.7 }),
  });

  // the cave troll: warty hide, iron, his club
  const wart = wartCanvas(256);
  tex.wart = T(wart.c, { srgb: false });
  tex.wartN = T(normalFromField(wart.field, 256, 256, 6), { srgb: false });
  Object.assign(mats, {
    trollSkin: hide(M({ vertexColors: true, roughness: 0.58 }), { tex: tex.wart, nrm: tex.wartN, scale: 0.9, bump: 0.9, shade: 0.35, key: 'moria-troll' }),
    trollEye: M({ color: 0x8a7a30, roughness: 0.08, emissive: new THREE.Color(0.08, 0.06, 0.01) }),
    tooth: M({ color: 0xc8b88a, roughness: 0.45 }),
    nail: M({ color: 0x6a5a40, roughness: 0.5 }),
    mouth: M({ color: 0x3a1210, roughness: 0.4 }),
    forged: M({ color: 0x3e3a38, metalness: 0.75, roughness: 0.45, envMap: cave, envMapIntensity: 0.9 }),
    clubWood: M({ map: K.tex.bark, normalMap: K.tex.barkN, color: 0x6a5a48, roughness: 0.9 }),
    hideCloth: M({ map: tex.rock, color: 0x4a3626, roughness: 0.8, side: THREE.DoubleSide }),
  });

  // the goblins: their skin the troll's hide, finer; dark iron, leather
  // and rags; pale eyes that catch any light there is
  Object.assign(mats, {
    goblinSkin: hide(M({ vertexColors: true, roughness: 0.6 }), { tex: tex.wart, nrm: tex.wartN, scale: 3.2, bump: 0.7, shade: 0.4, key: 'moria-goblin' }),
    goblinGear: M({ vertexColors: true, roughness: 0.55, metalness: 0.45, envMap: cave, envMapIntensity: 0.8 }),
    goblinEye: M({ vertexColors: true, color: 0xe8e2c4, roughness: 0.1, emissive: C(0x3a382a), envMap: cave, envMapIntensity: 1.2 }),
  });

  // Durin's Bane: black rock-hide with fire flowing in its cracks, bright
  // enough in the wide ones for the bloom to catch (and brighter in its
  // rage), a dull red glow at its edges as if lit from within; horn; eyes
  // like coals; the fire of its sword and whip, its wings of shadow
  const crack = crackCanvas(256);
  tex.crack = T(crack.c, { srgb: false });
  tex.crackN = T(normalFromField(crack.field, 256, 256, 4), { srgb: false });
  Object.assign(mats, {
    balrogSkin: hide(M({ vertexColors: true, roughness: 0.74, metalness: 0.05, envMap: cave, envMapIntensity: 0.4 }), {
      tex: tex.crack,
      nrm: tex.crackN,
      scale: 0.3,
      bump: 1.3,
      shade: 0.45,
      key: 'moria-balrog',
      ...balrogFire(U),
    }),
    horn: M({ color: 0x15110f, roughness: 0.35, metalness: 0.2, envMap: cave, envMapIntensity: 1 }),
    balrogEye: new THREE.MeshBasicMaterial({ color: hot(0xff8a24, 5) }),
    wing: wingMaterial(U),
    fireSolid: fireSolidMaterial(U),
  });

  // the hall's stone, its carving and floor, and fallen stone: the staff's
  // light reaches over them (hall().lightFrom)
  Object.assign(mats, {
    hallStone: revealable(M({ ...stone, color: 0x404a4a, vertexColors: true }), U, 'moria-reveal'),
    hallCarve: revealable(M({ map: tex.carve, normalMap: tex.carveN, normalScale: new THREE.Vector2(1.5, 1.5), color: 0x4a5454, roughness: 0.45 }), U, 'moria-reveal'),
    hallFloor: revealable(M({ map: tex.floor, normalMap: tex.floorN, color: 0x454e4e, roughness: 0.4 }), U, 'moria-reveal'),
    rubble: revealable(M({ ...stone, color: 0x5a6460, vertexColors: true }), U, 'moria-reveal'),
    // stone over the abyss, lit red from below
    abyss: underglow(M({ map: tex.ashlar, normalMap: tex.ashlarN, color: 0x5a6060, vertexColors: true, roughness: 0.7 }), U, 'moria-abyss'),
  });
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  Object.assign(K, { U, night, cave, tex: { ...K.tex, ...tex } });

  return {
    ...kit,
    mats,
    K,
    uniforms: U,
    tick: (t) => {
      U.uTime.value = t;
    },
    westGate: () => westGate(K),
    watcher: () => ({ tentacle: (seed = 1) => tentacle(K, seed) }),
    hall: (o) => hall(K, o),
    fork: () => fork(K),
    chamber: () => chamber(K),
    stairs: () => stairs(K),
    bridge: (len = 30) => bridge(K, len),
    caveTroll: () => caveTroll(K),
    goblin: (seed = 1) => goblin(K, seed),
    balrog: () => balrog(K),
    rubble: (seed = 1) => rubbleGeo(seed),
    staffLight: () => staffLight(K),
  };
}
