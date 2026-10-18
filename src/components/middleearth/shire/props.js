// The Shire, made in code: the kit the walkable Hobbiton is built from.
// Hobbit holes in their grassy mounds and Bag End on the Hill, the mill and
// Maggot's barn, the Green Dragon, the double-arched bridge over the Water,
// the Party Tree and its pavilion, Gandalf's cart of fireworks, sheep, farm
// dogs and a Black Rider, the old tree whose roots hid the hobbits, and the
// small things a lane is dressed with: fences, hedges, crops, flowers,
// washing, a signpost.
//
// All of it at the toy figures' scale (../mapFigures.js: a hobbit is about
// 1.55 tall, Gandalf 2.6) and in their storybook colours. createShireKit
// paints a few small textures once and shares its materials between every
// builder. Each builder's group stands on y = 0 at its origin; buildings
// have their doors to +z, creatures (and the Rider) face +x. A building's
// fixed parts are merged into one mesh per material, so it is a dozen draw
// calls, not hundreds.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeNoise, mix, normalFromField, paintPixels, ramp, smooth } from '../../../lib/paint';
import { stoneTextures } from '../nodes/kit';
import { STANCE, TROT, WALK, createStride, createTracker, ease, gaitOffsets, legSwing } from '../creatures';
import { flowerTint } from '../nodes/shire/propsShaders';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Flower colours.
const BLOOMS = [0xe8638f, 0xf4c84a, 0xa27ad8, 0xfaf4ea, 0xec6a3c, 0x7aa0ea, 0xf29ab8];

// A small seeded random (mulberry32): the same seed builds the same model.
function rng(seed = 1) {
  let a = Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Three dimensions of lumps from the two-dimensional noise, for round things.
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── geometry helpers ──

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

// Move, turn and size a geometry in place: p [x, y, z], r [x, y, z] angles,
// s a number or [x, y, z]. Scaled first, then turned, then moved.
function tf(geo, { p, r, s } = {}) {
  if (!p && !r && s == null) return geo;
  _p.set(...(p || [0, 0, 0]));
  _q.setFromEuler(_e.set(...(r || [0, 0, 0])));
  if (typeof s === 'number') _s.setScalar(s);
  else _s.set(...(s || [1, 1, 1]));
  return geo.applyMatrix4(_m.compose(_p, _q, _s));
}

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, seg = 8, open = false) => new THREE.CylinderGeometry(r0, r1, h, seg, 1, open);
const ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
// a cylinder lying along z, or along x
const cylZ = (r, len, seg = 10) => tf(cyl(r, r, len, seg), { r: [Math.PI / 2, 0, 0] });
const cylX = (r, len, seg = 10) => tf(cyl(r, r, len, seg), { r: [0, 0, Math.PI / 2] });
const lathe = (pts, seg = 12, phi0 = 0, phiLen = TAU) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiLen);

// Turn a geometry inside out (a doorway's lining, seen from within).
function inward(geo) {
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  const n = geo.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  return geo;
}

// Texture coordinates projected from whichever side of a box each triangle
// faces most, `s` repeats a metre, so one texture keeps one size over a
// whole building however its parts are cut. Needs unindexed triangles.
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
function boxUV(geo, s = 1, off = 0) {
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i += 3) {
    _a.fromBufferAttribute(p, i);
    _b.fromBufferAttribute(p, i + 1);
    _c.fromBufferAttribute(p, i + 2);
    _c.sub(_b);
    _a.sub(_b);
    _c.cross(_a);
    const ax = Math.abs(_c.x);
    const ay = Math.abs(_c.y);
    const az = Math.abs(_c.z);
    for (let k = i; k < i + 3; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      let u;
      let v;
      if (ay > ax && ay > az) [u, v] = [x, z];
      else if (ax > az) [u, v] = [z, y];
      else [u, v] = [x, y];
      uv[k * 2] = u * s + off;
      uv[k * 2 + 1] = v * s + off * 0.7;
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

// Scale a geometry's own texture coordinates.
function scaleUV(geo, su, sv = su) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

// A colour on every vertex: one colour, or fn(x, y, z, out) for each.
const _k = new THREE.Color();
function fillColor(geo, c) {
  const p = geo.attributes.position;
  const arr = new Float32Array(p.count * 3);
  if (typeof c !== 'function') _k.set(c);
  for (let i = 0; i < p.count; i++) {
    if (typeof c === 'function') c(p.getX(i), p.getY(i), p.getZ(i), _k);
    arr[i * 3] = _k.r;
    arr[i * 3 + 1] = _k.g;
    arr[i * 3 + 2] = _k.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Ready a geometry to be merged with others of one material: unindexed,
// with normals and texture coordinates, a colour where the material reads
// one, and nothing else.
const KEEP = new Set(['position', 'normal', 'uv', 'color', 'tint']);
function prep(geo, material, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const count = g.attributes.position.count;
  if (o.uv) boxUV(g, o.uv, o.uvOff || 0);
  else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  const colors = !!material.vertexColors;
  const tint = !!material.userData?.tint;
  if (colors && !g.attributes.color) fillColor(g, o.color ?? 0xffffff);
  if (tint && !g.attributes.tint) g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(count).fill(o.tint ?? 0), 1));
  for (const k of Object.keys(g.attributes)) {
    if (!KEEP.has(k) || (k === 'color' && !colors) || (k === 'tint' && !tint)) g.deleteAttribute(k);
  }
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

// A model's fixed parts gathered by material, then merged into one mesh
// each. `at` places what a function adds as if the origin were elsewhere
// (a wall's own frame, a bench by a door), turned by ry or [rx, ry, rz].
function parts() {
  const lists = new Map();
  const stack = [];
  const bk = {
    add(material, geo, o = {}) {
      tf(geo, o);
      if (stack.length) geo.applyMatrix4(stack[stack.length - 1]);
      if (!lists.has(material)) lists.set(material, []);
      lists.get(material).push(prep(geo, material, o));
      return bk;
    },
    at(p, r, fn) {
      const q = Array.isArray(r) ? new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)) : new THREE.Quaternion().setFromAxisAngle(UP, r);
      const m = new THREE.Matrix4().compose(V3(...p), q, V3(1, 1, 1));
      stack.push(stack.length ? stack[stack.length - 1].clone().multiply(m) : m);
      fn();
      stack.pop();
      return bk;
    },
    build(parent, { shadow = true, receive = true } = {}) {
      const out = [];
      for (const [material, geos] of lists) {
        const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos);
        const mesh = new THREE.Mesh(geo, material);
        mesh.castShadow = shadow;
        mesh.receiveShadow = receive;
        parent.add(mesh);
        out.push(mesh);
      }
      lists.clear();
      return out;
    },
  };
  return bk;
}

// One geometry from several, for instancing: `colors` keeps vertex colours,
// `tint` the flower heads' mask.
function mergeAll(geos, { colors = false, tint = false } = {}) {
  const like = { vertexColors: colors, userData: { tint } };
  const g = mergeGeometries(geos.map((x) => prep(x, like)));
  g.computeBoundingSphere();
  return g;
}

// A tapering tube through points (a branch, a root, a leg, a rope), radius
// r0 to r1; `gnarl` roughens it like bark over knots.
function tube(points, r0, r1 = r0, { seg = 10, radial = 8, gnarl = 0, seed = 1, uvK = 0.7 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : V3(...p))));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position;
  const n = makeNoise(seed);
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, c);
    const r = mix(r0, r1, Math.pow(t, 0.8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      const bump = gnarl ? 1 + (fbm(n, (j / radial) * 4, t * 3, { period: 4, octaves: 2 }) - 0.5) * 2 * gnarl : 1;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r * bump).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  return scaleUV(g, curve.getLength() * uvK, Math.max(1, Math.round(TAU * r0 * uvK)));
}

// A lumpy ball: an icosphere pushed in and out by noise (a clump of
// leaves, a bush, a fleece).
function blob(r, { detail = 2, amp = 0.22, freq = 1.6, seed = 1 } = {}) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const n = makeNoise(seed);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const k = r * (1 + (noise3(n, x * freq, y * freq, z * freq) - 0.5) * 2.6 * amp);
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// A box with softened edges (a plank, a seat, a lid).
function roundBox(w, h, d, r = 0.02) {
  const s = new THREE.Shape();
  const a = w / 2 - r;
  const b = h / 2 - r;
  s.moveTo(-a, -b);
  s.lineTo(a, -b);
  s.lineTo(a, b);
  s.lineTo(-a, b);
  const depth = Math.max(0.002, d - 2 * r);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 1, curveSegments: 1 });
  return g.translate(0, 0, -depth / 2);
}

// A flat ring, `depth` thick from z = 0 (a door frame, a wheel's rim).
function ringGeo(r0, r1, depth, segs = 32) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r1, 0, TAU, false);
  const h = new THREE.Path();
  h.absarc(0, 0, r0, 0, TAU, true);
  s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: Math.max(4, Math.ceil(segs / 2)) });
}

// A slice of a ring between angles a0 and a1, `depth` thick from z = 0 (an
// arch stone, a door plank, a seat round a tree).
function sector(r0, r1, a0, a1, depth, bevel = 0, steps = 0) {
  const segs = steps || Math.max(1, Math.ceil((a1 - a0) / 0.15));
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = mix(a0, a1, i / segs);
    if (i) s.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    else s.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  if (r0 < 1e-3) s.lineTo(0, 0);
  else for (let i = segs; i >= 0; i--) s.lineTo(Math.cos(mix(a0, a1, i / segs)) * r0, Math.sin(mix(a0, a1, i / segs)) * r0);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 1 });
}

// A section (a loop of [x, y] points, anticlockwise) swept along z through
// `zs` (increasing), lifted by yAt(z): a parapet or a deck that follows a
// humped bridge. Flat across the section's edges, smooth along z.
function sweep(section, zs, yAt = () => 0) {
  const pos = [];
  const idx = [];
  const m = section.length;
  for (let e = 0; e < m; e++) {
    const [ax, ay] = section[e];
    const [bx, by] = section[(e + 1) % m];
    const base = pos.length / 3;
    for (const z of zs) {
      const y = yAt(z);
      pos.push(ax, ay + y, z, bx, by + y, z);
    }
    for (let i = 0; i < zs.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  for (const [z, first] of [
    [zs[0], true],
    [zs[zs.length - 1], false],
  ]) {
    const base = pos.length / 3;
    const y = yAt(z);
    for (const [x, yy] of section) pos.push(x, yy + y, z);
    for (let i = 1; i < m - 1; i++) {
      if (first) idx.push(base, base + i + 1, base + i);
      else idx.push(base, base + i, base + i + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A pitched roof running along z, its ridge over x = 0: `span` across the
// eaves, `len` gable to gable, `rise` from eaves to ridge, `t` thick.
// Thatch is fat, lumpy and round at the eaves; slate thin and sharp.
function roofGeo({ span, len, rise, t, thatch = false, seed = 1 }) {
  const a = span / 2;
  const dt = (t * Math.hypot(a, rise)) / a;
  const s = new THREE.Shape();
  s.moveTo(-a, 0);
  s.lineTo(0, rise);
  s.lineTo(a, 0);
  if (thatch) s.quadraticCurveTo(a + dt * 0.45, -dt * 0.45, a - dt * 0.35, -dt);
  else s.lineTo(a, -dt);
  s.lineTo(0, rise - dt);
  if (thatch) {
    s.lineTo(-a + dt * 0.35, -dt);
    s.quadraticCurveTo(-a - dt * 0.45, -dt * 0.45, -a, 0);
  } else s.lineTo(-a, -dt);
  const geo = new THREE.ExtrudeGeometry(s, { depth: len, steps: thatch ? 10 : 1, bevelEnabled: thatch, bevelThickness: 0.14, bevelSize: 0.05, bevelSegments: 2, curveSegments: 5 });
  geo.translate(0, 0, -len / 2);
  const n = makeNoise(seed);
  const p = geo.attributes.position;
  if (thatch) {
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const along = clamp01(1 - ((2 * z) / len) ** 2);
      const dy = (n(x * 1.6 + 3, z * 1.6) - 0.5) * 0.1 - 0.08 * along * clamp01(y / rise);
      const dx = (n(z * 1.3, y * 1.3 + 7) - 0.5) * 0.07 * Math.sign(x);
      p.setXYZ(i, x + dx, y + dy, z);
    }
    geo.computeVertexNormals();
  }
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getZ(i) * (thatch ? 0.55 : 0.62) + (p.getX(i) > 0 ? 0.37 : 0), p.getY(i) * (thatch ? 0.72 : 0.8));
  return geo;
}

// How high a gable can rise under a roof (span, rise, thickness t) whose
// eaves sit `drop` above the gable's foot: just short of the ridge's underside.
const underRidge = (span, rise, t, drop) => drop + rise - (t * Math.hypot(span / 2, rise)) / (span / 2) - 0.03;

// A gable's triangle of wall, `depth` thick from z = 0.
function gableGeo(a, rise, depth) {
  const s = new THREE.Shape();
  s.moveTo(-a, 0);
  s.lineTo(a, 0);
  s.lineTo(0, rise);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
}

// The greens of a clump of leaves, darker underneath and inside, brighter
// out in the sun: a colour function for fillColor, from where the clump's
// (or the whole crown's) middle is and how big it is.
const FOLIAGE = [
  [0, [0.05, 0.12, 0.03]],
  [0.35, [0.12, 0.3, 0.06]],
  [0.7, [0.3, 0.56, 0.1]],
  [1, [0.66, 0.8, 0.22]],
];
function foliageColor(cx, cy, cz, r, seed = 1, warm = 0) {
  const n = makeNoise(seed);
  return (x, y, z, out) => {
    const up = (y - cy) / r;
    const outward = Math.hypot(x - cx, y - cy, z - cz) / r;
    const t = clamp01(0.42 + up * 0.32 + (outward - 0.75) * 0.5 + (n(x * 0.9 + 3, z * 0.9 + y * 0.4) - 0.5) * 0.5);
    const [rr, gg, bb] = ramp(FOLIAGE, t);
    out.setRGB(rr + warm * 0.05, gg + warm * 0.02, bb);
  };
}

// ── painted textures (each 256 px, and tiling) ──

// Draw at (x, y) on a tiling canvas, again across any edge within `r`.
function wrapAt(size, x, y, r, fn) {
  for (const dx of [-size, 0, size]) {
    if (x + dx < -r || x + dx > size + r) continue;
    for (const dy of [-size, 0, size]) {
      if (y + dy < -r || y + dy > size + r) continue;
      fn(x + dx, y + dy);
    }
  }
}

// A canvas's brightness as a height field, for a normal map.
function heightOf(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  return f;
}

// Grass for the mounds: patchy green, blades, and a few daisies.
function grassCanvas(S) {
  const n = makeNoise(21);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const t = clamp01(fbm(n, u * 4, v * 4, { period: 4, octaves: 4 }) * 0.8 + n(u * 64, v * 64, 64) * 0.3 - 0.05);
    out[0] = mix(92, 158, t);
    out[1] = mix(136, 190, t);
    out[2] = mix(52, 86, t);
  });
  const x = c.getContext('2d');
  const r = rng(7);
  x.lineCap = 'round';
  for (let i = 0; i < 2200; i++) {
    const px = r() * S;
    const py = r() * S;
    const len = 3 + r() * 7;
    const a = -Math.PI / 2 + (r() - 0.5) * 1.1;
    x.strokeStyle = r() < 0.55 ? `rgba(200,226,124,${0.25 + r() * 0.35})` : `rgba(40,74,28,${0.25 + r() * 0.35})`;
    x.lineWidth = 0.8 + r() * 0.9;
    wrapAt(S, px, py, len, (qx, qy) => {
      x.beginPath();
      x.moveTo(qx, qy);
      x.lineTo(qx + Math.cos(a) * len, qy + Math.sin(a) * len);
      x.stroke();
    });
  }
  for (let i = 0; i < 26; i++) {
    x.fillStyle = r() < 0.6 ? '#f6f2e4' : '#f2cf4a';
    wrapAt(S, r() * S, r() * S, 3, (qx, qy) => {
      x.beginPath();
      x.arc(qx, qy, 1.3, 0, TAU);
      x.fill();
    });
  }
  return c;
}

// Thatch: courses of straw laid down the roof, each in the shadow of the
// one above. Strands run down the texture, courses across it.
function thatchCanvas(S) {
  const n = makeNoise(31);
  const c = makeCanvas(S);
  const field = new Float32Array(S * S);
  const COURSES = 5;
  const tone = [
    [0, [92, 64, 34]],
    [0.45, [170, 126, 64]],
    [0.78, [212, 170, 98]],
    [1, [236, 206, 140]],
  ];
  paintPixels(c, (u, v, out, px, py) => {
    const row = Math.floor(v * COURSES);
    const cv = v * COURSES - row;
    const strand = n(u * 128, 0.5 + row * 7.3 + cv * 0.8, 128) * 0.55 + n(u * 40, 1.5 + row * 3.1, 40) * 0.45;
    const lip = smooth(0, 0.35, cv) * (1 - 0.25 * smooth(0.85, 1, cv));
    const blot = fbm(n, u * 4 + 9, v * 4, { period: 4, octaves: 3 });
    const h = clamp01(strand * 0.55 + lip * 0.5);
    field[py * S + px] = h;
    const [r0, g0, b0] = ramp(tone, clamp01(h * 0.85 + (blot - 0.5) * 0.5));
    out[0] = r0;
    out[1] = g0;
    out[2] = b0;
  });
  return { c, field };
}

// Planks: four boards across, the grain running along them, pale so a
// material's colour paints them (oak, a green door, white pickets).
function planksCanvas(S) {
  const n = makeNoise(41);
  const r = rng(41);
  const c = makeCanvas(S);
  const shade = [0, 1, 2, 3].map(() => 0.84 + r() * 0.16);
  const joint = [0, 1, 2, 3].map(() => r());
  paintPixels(c, (u, v, out) => {
    const p = Math.floor(u * 4);
    const fu = u * 4 - p;
    let k = shade[p] * (0.88 + fbm(n, u * 8, v * 8, { period: 8, octaves: 3 }) * 0.18);
    k *= 0.35 + 0.65 * smooth(0, 0.045, Math.min(fu, 1 - fu));
    const dj = Math.abs(v - joint[p]);
    k *= 0.55 + 0.45 * smooth(0, 0.007, Math.min(dj, 1 - dj));
    out[0] = 238 * k;
    out[1] = 222 * k;
    out[2] = 198 * k;
  });
  const x = c.getContext('2d');
  for (let p = 0; p < 4; p++) {
    for (let i = 0; i < 16; i++) {
      const x0 = (p + 0.1 + r() * 0.8) * (S / 4);
      const amp = 1 + r() * 2.5;
      const fq = 1 + Math.floor(r() * 3);
      const ph = r() * TAU;
      x.strokeStyle = `rgba(92,62,32,${0.12 + r() * 0.2})`;
      x.lineWidth = 0.6 + r() * 1.2;
      x.beginPath();
      for (let y = 0; y <= S; y += 4) {
        const xx = x0 + Math.sin((y / S) * TAU * fq + ph) * amp;
        if (y) x.lineTo(xx, y);
        else x.moveTo(xx, y);
      }
      x.stroke();
    }
    // a knot
    const kx = (p + 0.3 + r() * 0.4) * (S / 4);
    const ky = r() * S;
    for (let k = 3; k > 0; k--) {
      x.strokeStyle = `rgba(80,50,26,${0.18 + k * 0.08})`;
      x.lineWidth = 1;
      wrapAt(S, kx, ky, 10, (qx, qy) => {
        x.beginPath();
        x.ellipse(qx, qy, k * 1.6, k * 3.6, 0, 0, TAU);
        x.stroke();
      });
    }
  }
  return c;
}

// Plaster: lime-washed, mottled, a little speckled.
function plasterCanvas(S) {
  const n = makeNoise(51);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const m = fbm(n, u * 6, v * 6, { period: 6, octaves: 5 });
    const s = n(u * 128, v * 128, 128);
    const t = 0.8 + m * 0.18 + (s - 0.5) * 0.06;
    out[0] = 252 * t;
    out[1] = 246 * t;
    out[2] = 232 * t;
  });
  return c;
}

// Leaves: a litter of little leaves, light on shadow, grey so the vertex
// colours give the green (also the curl of a fleece).
function leavesCanvas(S) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(61);
  x.fillStyle = 'rgb(150,150,150)';
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1500; i++) {
    const px = r() * S;
    const py = r() * S;
    const a = r() * TAU;
    const l = 4 + r() * 4;
    const g = Math.round(180 + r() * 75);
    wrapAt(S, px, py, l + 2, (qx, qy) => {
      x.beginPath();
      x.ellipse(qx, qy, l, l * 0.48, a, 0, TAU);
      x.fillStyle = `rgb(${g},${g},${g})`;
      x.fill();
      x.strokeStyle = 'rgba(60,60,60,0.45)';
      x.lineWidth = 0.8;
      x.stroke();
    });
  }
  return c;
}

// Bark: long fissures and ridges running along a branch (u).
function barkCanvas(S) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(71);
  x.fillStyle = 'rgb(186,176,158)';
  x.fillRect(0, 0, S, S);
  const stroke = (col, w0, w1, count) => {
    for (let i = 0; i < count; i++) {
      const y0 = r() * S;
      const amp = 2 + r() * 5;
      const fq = 1 + Math.floor(r() * 3);
      const ph = r() * TAU;
      x.strokeStyle = col(r());
      x.lineWidth = w0 + r() * (w1 - w0);
      for (const dy of [-S, 0, S]) {
        x.beginPath();
        for (let px = 0; px <= S; px += 4) {
          const yy = y0 + dy + Math.sin((px / S) * TAU * fq + ph) * amp;
          if (px) x.lineTo(px, yy);
          else x.moveTo(px, yy);
        }
        x.stroke();
      }
    }
  };
  stroke((k) => `rgba(226,218,200,${0.25 + k * 0.3})`, 2, 5, 70);
  stroke((k) => `rgba(70,56,42,${0.35 + k * 0.4})`, 1, 3.5, 100);
  return c;
}

// Slates: staggered rows, blue-grey to plum, each row's foot shadowing the
// row below, with moss in the damp places.
function slateCanvas(S) {
  const n = makeNoise(81);
  const c = makeCanvas(S);
  const field = new Float32Array(S * S);
  const ROWS = 8;
  const COLS = 5;
  const hash = (a, b) => {
    const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  paintPixels(c, (u, v, out, px, py) => {
    const row = Math.floor(v * ROWS);
    const fv = v * ROWS - row;
    const fu = u * COLS + (row % 2) * 0.5;
    const col = Math.floor(fu) % COLS;
    const fx = fu - Math.floor(fu);
    const id = hash(col, row);
    const gap = smooth(0, 0.035, Math.min(fx, 1 - fx));
    const shade = (0.55 + 0.45 * smooth(0, 0.16, fv)) * (0.75 + 0.25 * gap);
    const h = (0.4 + fv * 0.5) * gap;
    field[py * S + px] = h;
    const moss = smooth(0.62, 0.78, fbm(n, u * 5, v * 5, { period: 5, octaves: 4 }));
    const g0 = 0.85 + n(u * 64, v * 64, 64) * 0.2;
    const base = [mix(86, 104, id), mix(92, 96, id), mix(108, 112, 1 - id)];
    for (let k = 0; k < 3; k++) out[k] = mix(base[k], [128, 136, 66][k], moss * 0.8) * shade * g0;
  });
  return { c, field };
}

// The sign by Bag End's gate.
function bagEndSignCanvas() {
  const c = makeCanvas(256, 128);
  const x = c.getContext('2d');
  const r = rng(9);
  const grd = x.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#b8946a');
  grd.addColorStop(1, '#9a7650');
  x.fillStyle = grd;
  x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 46; i++) {
    x.strokeStyle = `rgba(70,46,24,${0.08 + r() * 0.14})`;
    x.lineWidth = 1;
    const y = r() * 128;
    x.beginPath();
    x.moveTo(0, y);
    x.bezierCurveTo(80, y + (r() - 0.5) * 6, 170, y + (r() - 0.5) * 6, 256, y);
    x.stroke();
  }
  x.strokeStyle = 'rgba(50,30,14,0.6)';
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(0, 64);
  x.lineTo(256, 64);
  x.stroke();
  x.fillStyle = '#2b1c0e';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'italic 600 25px Georgia, "Times New Roman", serif';
  ['No admittance', 'except on', 'party business'].forEach((t, i) => {
    x.save();
    x.translate(128 + (r() - 0.5) * 6, 26 + i * 37);
    x.rotate((r() - 0.5) * 0.05);
    x.fillText(t, 0, 0);
    x.restore();
  });
  return c;
}

// The Green Dragon's sign: a green dragon breathing a little fire, on a
// cream board with a green and gold border.
function dragonSignCanvas() {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  const r = rng(13);
  x.fillStyle = '#eadcb4';
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 30; i++) {
    x.strokeStyle = `rgba(120,90,50,${0.05 + r() * 0.08})`;
    x.lineWidth = 1;
    const y = r() * 256;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(256, y + (r() - 0.5) * 4);
    x.stroke();
  }
  x.lineWidth = 12;
  x.strokeStyle = '#2d5a2c';
  x.strokeRect(6, 6, 244, 244);
  x.lineWidth = 3;
  x.strokeStyle = '#c9a23e';
  x.strokeRect(16, 16, 224, 224);
  const ink = '#1b3317';
  const green = '#3f8a34';
  const pale = '#a6cf63';
  const fillOut = (path, fill, w = 4) => {
    x.lineJoin = 'round';
    x.lineWidth = w;
    x.strokeStyle = ink;
    x.fillStyle = fill;
    path();
    x.fill();
    x.stroke();
  };
  // the wing, behind
  fillOut(() => {
    x.beginPath();
    x.moveTo(112, 128);
    x.lineTo(84, 66);
    x.lineTo(102, 84);
    x.lineTo(112, 58);
    x.lineTo(124, 86);
    x.lineTo(146, 70);
    x.lineTo(140, 124);
    x.closePath();
  }, '#2f6e2a');
  x.strokeStyle = ink;
  x.lineWidth = 2;
  for (const [ex, ey] of [
    [84, 66],
    [112, 58],
    [146, 70],
  ]) {
    x.beginPath();
    x.moveTo(118, 126);
    x.lineTo(ex, ey);
    x.stroke();
  }
  // the tail, curling to a spade
  x.lineCap = 'round';
  x.lineWidth = 15;
  x.strokeStyle = ink;
  x.beginPath();
  x.moveTo(94, 162);
  x.quadraticCurveTo(46, 170, 56, 206);
  x.stroke();
  x.lineWidth = 9;
  x.strokeStyle = green;
  x.stroke();
  fillOut(() => {
    x.beginPath();
    x.moveTo(56, 200);
    x.lineTo(44, 222);
    x.lineTo(66, 214);
    x.closePath();
  }, green, 3);
  // legs
  for (const [ax, ay, bx, by] of [
    [100, 166, 92, 196],
    [146, 152, 156, 190],
  ]) {
    x.lineWidth = 14;
    x.strokeStyle = ink;
    x.beginPath();
    x.moveTo(ax, ay);
    x.lineTo(bx, by);
    x.stroke();
    x.lineWidth = 8;
    x.strokeStyle = green;
    x.stroke();
  }
  // the body, the neck, the head
  fillOut(() => {
    x.beginPath();
    x.ellipse(120, 150, 40, 24, -0.35, 0, TAU);
  }, green);
  x.lineWidth = 22;
  x.strokeStyle = ink;
  x.beginPath();
  x.moveTo(140, 136);
  x.quadraticCurveTo(160, 120, 166, 96);
  x.stroke();
  x.lineWidth = 15;
  x.strokeStyle = green;
  x.stroke();
  fillOut(() => {
    x.beginPath();
    x.ellipse(176, 88, 17, 12, 0.2, 0, TAU);
  }, green);
  fillOut(() => {
    x.beginPath();
    x.ellipse(193, 94, 11, 7, 0.25, 0, TAU);
  }, green, 3);
  // belly, horns, eye, fire
  x.lineWidth = 6;
  x.strokeStyle = pale;
  x.beginPath();
  x.ellipse(122, 156, 30, 13, -0.35, 0.2, 2.6);
  x.stroke();
  x.lineWidth = 3;
  x.strokeStyle = ink;
  for (const dx of [0, 8]) {
    x.beginPath();
    x.moveTo(170 + dx, 78);
    x.lineTo(160 + dx, 64);
    x.stroke();
  }
  x.fillStyle = '#f3d24a';
  x.beginPath();
  x.arc(180, 85, 3.2, 0, TAU);
  x.fill();
  x.fillStyle = '#e8622c';
  x.beginPath();
  x.moveTo(203, 96);
  x.quadraticCurveTo(222, 86, 232, 96);
  x.quadraticCurveTo(220, 100, 230, 108);
  x.quadraticCurveTo(214, 106, 203, 99);
  x.fill();
  x.fillStyle = '#2b4a22';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 22px Georgia, "Times New Roman", serif';
  x.fillText('THE GREEN', 128, 38);
  x.fillText('DRAGON', 128, 230);
  return c;
}

// A signpost's boards, one row each: weathered wood, painted letters.
function signpostCanvas(lines) {
  const c = makeCanvas(512, 64 * lines.length);
  const x = c.getContext('2d');
  const r = rng(17);
  lines.forEach((t, i) => {
    const y = i * 64;
    const grd = x.createLinearGradient(0, y, 0, y + 64);
    grd.addColorStop(0, '#c6a678');
    grd.addColorStop(1, '#a8885c');
    x.fillStyle = grd;
    x.fillRect(0, y, 512, 64);
    for (let k = 0; k < 10; k++) {
      x.strokeStyle = `rgba(80,52,26,${0.1 + r() * 0.12})`;
      x.lineWidth = 1;
      const yy = y + 4 + r() * 56;
      x.beginPath();
      x.moveTo(0, yy);
      x.lineTo(512, yy + (r() - 0.5) * 3);
      x.stroke();
    }
    x.fillStyle = '#2a1d10';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    let size = 36;
    x.font = `bold ${size}px Georgia, "Times New Roman", serif`;
    while (x.measureText(t).width > 400 && size > 18) {
      size -= 2;
      x.font = `bold ${size}px Georgia, "Times New Roman", serif`;
    }
    x.fillText(t, 236, y + 34);
  });
  return c;
}

// A crate's side: pale boards in a dark frame, and on some Gandalf's mark,
// a red G-rune.
function crateCanvas(rune) {
  const c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  const r = rng(rune ? 23 : 29);
  for (let i = 0; i < 4; i++) {
    x.fillStyle = `rgb(${200 + r() * 30},${168 + r() * 24},${118 + r() * 20})`;
    x.fillRect(0, i * 32, 128, 32);
    x.fillStyle = 'rgba(60,36,16,0.55)';
    x.fillRect(0, i * 32, 128, 2);
  }
  x.strokeStyle = '#6a4826';
  x.lineWidth = 12;
  x.strokeRect(6, 6, 116, 116);
  x.lineWidth = 9;
  x.beginPath();
  x.moveTo(10, 10);
  x.lineTo(118, 118);
  x.stroke();
  if (rune) {
    x.fillStyle = 'rgba(234,220,190,0.85)';
    x.beginPath();
    x.arc(64, 64, 34, 0, TAU);
    x.fill();
    x.strokeStyle = '#b8261c';
    x.lineWidth = 7;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(52, 42);
    x.lineTo(52, 88);
    x.moveTo(52, 46);
    x.lineTo(78, 40);
    x.moveTo(52, 66);
    x.lineTo(76, 56);
    x.lineTo(76, 80);
    x.lineTo(62, 88);
    x.stroke();
  }
  return c;
}

// ── small parts, added to a model's parts ──

// A little bed of flowers: leafy humps along `w`, and blooms dotted on them.
function flowerBed(bk, K, x, y, z, w, d, seed = 1, palette = BLOOMS, density = 1) {
  const r = rng(seed);
  const n = Math.max(2, Math.round((w / 0.34) * density));
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + (i + 0.5) * (w / n);
    const pz = z + (r() - 0.5) * d * 0.4;
    bk.add(K.mats.foliage, blob(0.13 + r() * 0.05, { detail: 1, amp: 0.3, freq: 3, seed: seed + i }), { p: [px, y + 0.03, pz], s: [1.1, 0.8, 1], uv: 4, color: foliageColor(px, y - 0.05, pz, 0.2, seed + i) });
  }
  for (let i = 0; i < n * 2; i++) {
    bk.add(K.mats.foliage, new THREE.OctahedronGeometry(0.04 + r() * 0.02, 0), { p: [x + (r() - 0.5) * w, y + 0.1 + r() * 0.08, z + (r() - 0.5) * d], uv: 6, color: palette[Math.floor(r() * palette.length)] });
  }
}

// A bush: a few clumps of leaves, maybe in flower.
function bush(bk, K, x, y, z, rad, seed = 1, flowers = 0) {
  const r = rng(seed);
  const shade = foliageColor(x, y + rad * 0.3, z, rad * 1.2, seed);
  for (let i = 0; i < 2; i++) {
    const a = r() * TAU;
    const k = i ? 0.65 : 1;
    bk.add(K.mats.foliage, blob(rad * k, { detail: i ? 1 : 2, amp: 0.25, freq: 1.8, seed: seed * 7 + i }), { p: [x + Math.cos(a) * rad * 0.5 * (i ? 1 : 0), y + rad * (i ? 0.45 : 0.6), z + Math.sin(a) * rad * 0.5 * (i ? 1 : 0)], s: [1, 0.85, 1], uv: 2.5, color: shade });
  }
  for (let i = 0; i < flowers; i++) {
    const a = r() * TAU;
    const up = 0.2 + r() * 0.7;
    const px = x + Math.cos(a) * rad * Math.sqrt(1 - up * up) * 1.02;
    const pz = z + Math.sin(a) * rad * Math.sqrt(1 - up * up) * 1.02;
    bk.add(K.mats.foliage, new THREE.OctahedronGeometry(0.05 + r() * 0.025, 0), { p: [px, y + rad * 0.6 + up * rad * 0.9, pz], uv: 6, color: BLOOMS[(seed + i) % BLOOMS.length] });
  }
}

// A lantern: a glowing paper body in an iron cap and foot, hung on a wire.
function lanternParts(bk, K, x, y, z, s = 1, wire = 0.25) {
  const { mats } = K;
  bk.add(mats.lantern, lathe([[0.001, -0.13], [0.07, -0.12], [0.105, -0.04], [0.105, 0.05], [0.07, 0.12], [0.001, 0.13]], 6), { p: [x, y, z], s });
  bk.add(mats.iron, cyl(0.035, 0.075, 0.05, 6, true), { p: [x, y + 0.14 * s, z], s });
  bk.add(mats.iron, cyl(0.07, 0.04, 0.04, 6, true), { p: [x, y - 0.14 * s, z], s });
  if (wire > 0) bk.add(mats.iron, cyl(0.006, 0.006, wire, 3), { p: [x, y + 0.16 * s + wire / 2, z] });
}

// A garden bench, its seat to +z: three planks, a back, arms. Returns the
// seat's height.
function benchParts(bk, K, len = 1.5) {
  const W = K.mats.wood;
  const seat = 0.45;
  for (let i = 0; i < 3; i++) bk.add(W, roundBox(len, 0.05, 0.13, 0.018), { p: [0, seat - 0.025, 0.15 - i * 0.145], uv: 1.4 });
  for (let i = 0; i < 2; i++) bk.add(W, roundBox(len, 0.11, 0.04, 0.015), { p: [0, seat + 0.2 + i * 0.19, -0.25 - i * 0.025], r: [-0.13, 0, 0], uv: 1.4 });
  for (const s of [-1, 1]) {
    const x = s * (len / 2 - 0.07);
    bk.add(W, B(0.07, seat - 0.05, 0.07), { p: [x, (seat - 0.05) / 2, 0.17], uv: 1.4 });
    bk.add(W, B(0.07, 0.97, 0.07), { p: [x, 0.485, -0.24], r: [-0.1, 0, 0], uv: 1.4 });
    bk.add(W, B(0.06, 0.22, 0.06), { p: [x, seat + 0.1, 0.17], uv: 1.4 });
    bk.add(W, roundBox(0.08, 0.05, 0.52, 0.015), { p: [x, seat + 0.24, -0.04], uv: 1.4 });
  }
  return seat;
}

// A barrel: bellied staves, iron hoops, a lid.
function barrelParts(bk, K, { h = 0.9, r = 0.3 } = {}) {
  const { mats } = K;
  const prof = [];
  for (let i = 0; i <= 5; i++) prof.push([r * (0.84 + 0.16 * Math.sin((Math.PI * i) / 5)), (i / 5) * h]);
  const top = r * 0.84;
  prof.push([top - 0.025, h], [top - 0.025, h - 0.03]);
  bk.add(mats.wood, scaleUV(lathe(prof, 11), 4, 1));
  bk.add(mats.wood, new THREE.CircleGeometry(top - 0.02, 11), { r: [-Math.PI / 2, 0, 0], p: [0, h - 0.03, 0], uv: 1.6 });
  for (const t of [0.1, 0.3, 0.7, 0.9]) {
    const rr = r * (0.84 + 0.16 * Math.sin(Math.PI * t)) + 0.006;
    bk.add(mats.iron, cyl(rr, rr, 0.035, 11, true), { p: [0, t * h, 0] });
  }
}

// A lamp post: a crooked oak post with an arm, a lantern hanging from it.
// Returns where the lantern is.
function lampParts(bk, K) {
  const { mats } = K;
  bk.add(mats.timber, tube([[0, 0, 0], [0.02, 1.0, 0], [-0.02, 2.0, 0], [0.04, 2.36, 0]], 0.075, 0.055, { seg: 6, radial: 6, gnarl: 0.15, seed: 4 }));
  bk.add(mats.timber, tube([[0.02, 2.22, 0], [0.28, 2.37, 0], [0.5, 2.3, 0]], 0.045, 0.03, { seg: 5, radial: 5 }));
  bk.add(mats.timber, cyl(0.12, 0.14, 0.12, 6), { p: [0, 0.06, 0] });
  lanternParts(bk, K, 0.5, 1.95, 0, 1.15, 0.16);
  return V3(0.5, 1.95, 0);
}

// A letterbox on a post: a little red box with a round roof and a slot.
function mailboxParts(bk, K, color = 0xb03a2e) {
  const { mats } = K;
  const paint = K.paint(color);
  bk.add(mats.timber, B(0.09, 1.0, 0.09), { p: [0, 0.5, 0], uv: 1.2 });
  bk.add(paint, roundBox(0.32, 0.24, 0.44, 0.02), { p: [0, 1.12, 0], uv: 2 });
  bk.add(paint, new THREE.CylinderGeometry(0.16, 0.16, 0.44, 12, 1, false, Math.PI / 2, Math.PI), { r: [Math.PI / 2, 0, 0], p: [0, 1.24, 0], uv: 2 });
  bk.add(mats.iron, B(0.18, 0.025, 0.02), { p: [0, 1.2, 0.225] });
  bk.add(mats.brass, B(0.12, 0.07, 0.01), { p: [0, 1.08, 0.225] });
  bk.add(mats.brass, B(0.02, 0.14, 0.08), { p: [0.17, 1.24, 0.06] });
}

// ── hobbit holes ──

// The arch a hobbit hole's front wall fills: A wide each side at its foot,
// Hf high, squarish round the top (a superellipse). archR is under 1 inside.
const ARCH = 3;
const archR = (A, Hf, x, y) => Math.pow(Math.pow(Math.abs(x) / A, ARCH) + Math.pow(Math.max(0, y) / Hf, ARCH), 1 / ARCH);

// The mound over a hobbit hole: a squashed dome, fuller than a hemisphere,
// lumpy. Where it comes forward of z = cut, an arch (A, Hf) is cut out of it
// for the door's wall: above the arch the turf is cut back to a thick brow
// just proud of the wall, beside it the banks run forward to the ground.
// Coloured lighter on top, darker at the foot and under the brow.
function moundGeo({ R, Rz, H, cut = Infinity, A = 1, Hf = 1, lip = 0.42, amp = 0.2, seed = 1 }) {
  let g = new THREE.SphereGeometry(1, 40, 16, 0, TAU, 0, Math.PI / 2);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const n = makeNoise(seed);
  const pos = g.attributes.position;
  const color = new Float32Array(pos.count * 3);
  const uv = new Float32Array(pos.count * 2);
  const low = new THREE.Color(0x8c9c6c);
  const high = new THREE.Color(0xfff4d2);
  const earth = new THREE.Color(0x3a2a1c);
  const k = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = Math.max(0, pos.getY(i));
    const z = pos.getZ(i);
    let X = x * R;
    let Y = H * Math.pow(y, 0.8);
    let Z = z * Rz;
    const ar = archR(A, Hf, X, Y);
    let hidden = false;
    let brow = 0;
    if (Z > cut) {
      if (ar < 1) {
        Z = cut - 0.03;
        hidden = true;
      } else {
        brow = smooth(0.6, 1.4, Y / Hf / Math.max(0.01, Math.abs(X) / A));
        Z = mix(cut + (Z - cut) * 0.55, Math.min(Z, cut + lip), brow);
      }
    }
    if (!hidden) {
      const near = Z > cut - 1.2 ? smooth(1.02, 1.35, ar) : 1;
      const l = (fbm(n, X * 0.42 + 5, Z * 0.42 + 9, { octaves: 3 }) - 0.5) * 2 * amp * smooth(0, 0.15, y) * near;
      X += x * l;
      Y += y * l;
      Z += z * l;
      const edge = brow * (1 - smooth(1.0, 1.2, ar));
      Y -= edge * 0.08;
      brow = edge;
    }
    pos.setXYZ(i, X, Y, Z);
    uv[i * 2] = X * 0.32;
    uv[i * 2 + 1] = Z * 0.32 - Y * 0.12;
    const patch = fbm(n, X * 0.3 + 40, Z * 0.3, { octaves: 2 });
    k.lerpColors(low, high, clamp01(Math.pow(y, 1.3) * 0.85 + (patch - 0.5) * 0.5 + 0.1));
    if (hidden) k.copy(earth);
    else if (brow > 0) k.multiplyScalar(1 - brow * 0.2);
    color[i * 3] = k.r;
    color[i * 3 + 1] = k.g;
    color[i * 3 + 2] = k.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// A round window in a wall at (x, y), its face at z: a painted frame with
// mullions, a stone sill, a box of flowers. Set into a hole in the wall,
// or `flush` on a solid one.
function roundWindow(bk, K, { x, y, z, rw, frame, seed, flush = false }) {
  const { mats } = K;
  const zg = flush ? z + 0.235 : z;
  if (!flush) bk.add(mats.timber, inward(new THREE.CylinderGeometry(rw + 0.1, rw + 0.1, 0.32, 16, 1, true)), { r: [Math.PI / 2, 0, 0], p: [x, y, z - 0.16] });
  bk.add(mats.window, new THREE.CircleGeometry(rw + 0.1, 16), { p: [x, y, zg - 0.225] });
  bk.add(frame, ringGeo(rw - 0.01, rw + 0.11, flush ? 0.1 : 0.26, 20), { p: [x, y, flush ? z : z - 0.17] });
  bk.add(frame, B(rw * 2, 0.05, 0.06), { p: [x, y, zg - 0.19] });
  bk.add(frame, B(0.05, rw * 2, 0.06), { p: [x, y, zg - 0.19] });
  bk.add(frame, new THREE.TorusGeometry(rw * 0.42, 0.025, 3, 12), { p: [x, y, zg - 0.19] });
  bk.add(mats.dressed, roundBox(rw * 2 + 0.34, 0.09, 0.28, 0.02), { p: [x, y - rw - 0.15, z + 0.06], uv: 0.6 });
  bk.add(mats.timber, roundBox(rw * 2 + 0.2, 0.22, 0.24, 0.02), { p: [x, y - rw - 0.32, z + 0.16], uv: 1.2 });
  flowerBed(bk, K, x, y - rw - 0.22, z + 0.16, rw * 2 + 0.1, 0.18, seed);
}

// A picket fence along x at z, from x0 to x1, posts at each end.
function picketRun(bk, mat, x0, x1, z, h = 0.82) {
  const len = x1 - x0;
  if (len < 0.2) return;
  const picket = new THREE.Shape();
  picket.moveTo(-0.034, 0);
  picket.lineTo(0.034, 0);
  picket.lineTo(0.034, h);
  picket.lineTo(0, h + 0.07);
  picket.lineTo(-0.034, h);
  const n = Math.max(1, Math.round(len / 0.19));
  for (let i = 0; i < n; i++) bk.add(mat, new THREE.ExtrudeGeometry(picket, { depth: 0.025, bevelEnabled: false }), { p: [x0 + (i + 0.5) * (len / n), 0, z], uv: 2 });
  for (const y of [0.24, 0.6]) bk.add(mat, B(len, 0.07, 0.04), { p: [(x0 + x1) / 2, y, z - 0.03], uv: 2 });
  for (const x of [x0, x1]) {
    bk.add(mat, B(0.1, h + 0.1, 0.1), { p: [x, (h + 0.1) / 2, z - 0.02], uv: 2 });
    bk.add(mat, new THREE.ConeGeometry(0.09, 0.1, 4), { p: [x, h + 0.15, z - 0.02], r: [0, Math.PI / 4, 0] });
  }
}

// A garden gate, hinged at its left (x = 0), `w` wide, in a Group to swing.
function gateGroup(K, mat, w = 1.0, h = 0.86) {
  const gg = new THREE.Group();
  gg.name = 'gate';
  const bk = parts();
  for (const y of [0.18, 0.66]) bk.add(mat, B(w - 0.04, 0.08, 0.04), { p: [w / 2, y, -0.02], uv: 2 });
  const brace = Math.atan2(0.48, w - 0.14);
  bk.add(mat, B(Math.hypot(0.48, w - 0.14), 0.07, 0.035), { p: [w / 2, 0.42, -0.04], r: [0, 0, brace], uv: 2 });
  const n = Math.round(w / 0.16);
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (w / n);
    const top = h - 0.1 + Math.sin((Math.PI * (i + 0.5)) / n) * 0.12;
    bk.add(mat, B(0.065, top, 0.025), { p: [x, top / 2 + 0.04, 0.01], uv: 2 });
  }
  bk.build(gg);
  return gg;
}

// A hobbit hole: the mound, the stone wall cut into its front with a round
// door (radial planks, a brass knob in the middle, an oak frame in a ring
// of arch stones), round windows, a brick chimney out of the top, and a
// garden in front with a path, a picket fence and a gate. `grand` is Bag
// End's. Returns the parts the scene moves and the places it needs.
function hole(K, { R = 4, door = 0x2e6b3a, doorD = 1.8, seed = 1, windows, grand = false }) {
  const { mats } = K;
  const r = rng(seed * 13 + 5);
  const g = new THREE.Group();
  g.name = grand ? 'bagEnd' : 'hobbitHole';
  const bk = parts();
  const Rz = R * 0.86;
  const H = Math.max(0.7 * R, 3.3);
  const doorR = doorD / 2;
  const Hf = doorD + 0.95;
  const paint = K.paint(door);

  // the windows either side of the door, and so the arch they need
  const rw = grand ? 0.5 : 0.42;
  const wy = grand ? 1.55 : 1.3;
  const wx = doorR + 0.5 + rw;
  // a little variety from the seed: one window or two, a white fence or
  // a plain one, a lamp or a letterbox
  const bits = seed >> 1;
  const nWin = windows ?? (grand ? 3 : 1 + (bits % 2));
  const wins = grand
    ? [
        [-wx, wy, rw],
        [wx, wy, rw],
        [-(wx + rw + 0.85), wy - 0.1, 0.34],
      ]
    : nWin >= 2
      ? [
          [-wx, wy, rw],
          [wx, wy, rw],
        ]
      : [[(seed >> 2) % 2 ? -wx : wx, wy, rw]];
  let A = doorR + 1.0;
  for (const [x, y, rr] of wins) A = Math.max(A, (Math.abs(x) + rr + 0.22) / Math.pow(1 - Math.pow((y + rr + 0.12) / Hf, ARCH), 1 / ARCH));
  if (!grand) A = Math.max(A, 2.75);
  // the wall stands where the mound is still well over the arch's top
  const cut = Rz * Math.sqrt(Math.max(0.02, 1 - Math.pow(Math.min(0.98, (Hf + 0.45) / H), 2.5)));
  const zF = cut + 0.3;

  // the turf
  bk.add(mats.turf, moundGeo({ R, Rz, H, cut, A, Hf, lip: 0.42, amp: 0.05 * R, seed }));

  // the wall in the arch: fieldstone, holed for the door and the windows
  const wall = new THREE.Shape();
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI;
    const c = Math.cos(t);
    const px = (A + 0.1) * Math.sign(c) * Math.pow(Math.abs(c), 2 / ARCH);
    const py = (Hf + 0.08) * Math.pow(Math.sin(t), 2 / ARCH);
    if (i) wall.lineTo(px, py);
    else wall.moveTo(px, py);
  }
  // back along the foot in short steps: one long edge under the holes and
  // the triangulation fills their lower halves
  for (let i = 1; i <= 16; i++) wall.lineTo(-(A + 0.1) + (i / 16) * 2 * (A + 0.1), 0);
  const doorY = doorR + 0.16;
  const holeAt = (x, y, rad) => {
    const p = new THREE.Path();
    p.absarc(x, y, rad, 0, TAU, true);
    wall.holes.push(p);
  };
  holeAt(0, doorY, doorR + 0.13);
  for (const [x, y, rr] of wins) holeAt(x, y, rr + 0.11);
  bk.add(mats.stone, new THREE.ExtrudeGeometry(wall, { depth: 0.4, bevelEnabled: false, curveSegments: 12 }), { p: [0, 0, cut - 0.1], uv: 0.6 });
  // a roll of turf round the arch, thick over the top, where the grass
  // meets the stone, with a few flowers in it
  const lowT = new THREE.Color(0xa8b484);
  const highT = new THREE.Color(0xf2ecc4);
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = Math.PI / 2 - side * (i / 10) * (Math.PI / 2 + 0.06);
      const c = Math.cos(t);
      const sn = Math.max(-0.05, Math.sin(t));
      pts.push([(A + 0.16) * Math.sign(c) * Math.pow(Math.abs(c), 2 / ARCH), (Hf + 0.14) * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ARCH) - 0.04, cut + 0.24]);
    }
    const roll = tube(pts, 0.34, 0.16, { seg: 14, radial: 7, gnarl: 0.28, seed: seed * 3 + side, uvK: 1.2 });
    fillColor(roll, (x, y, z, out) => out.lerpColors(lowT, highT, clamp01(y / (Hf + 0.4))));
    bk.add(mats.turf, roll);
  }
  for (let i = 0; i < 8; i++) {
    const t = 0.25 + (i / 7) * (Math.PI - 0.5);
    const c = Math.cos(t);
    const x = (A + 0.18) * Math.sign(c) * Math.pow(Math.abs(c), 2 / ARCH);
    const y = (Hf + 0.14) * Math.pow(Math.sin(t), 2 / ARCH) + 0.12 + r() * 0.06;
    bk.add(mats.foliage, new THREE.OctahedronGeometry(0.05 + r() * 0.02, 0), { p: [x, y, cut + 0.36 + r() * 0.1], uv: 6, color: BLOOMS[(i + seed) % BLOOMS.length] });
  }

  // the door's oak frame, its lining and the hall's dark behind it
  bk.add(mats.timber, ringGeo(doorR - 0.01, doorR + 0.14, 0.36, 32), { p: [0, doorY, zF - 0.28] });
  bk.add(mats.timber, inward(new THREE.CylinderGeometry(doorR + 0.02, doorR + 0.02, 1.2, 28, 1, true)), { r: [Math.PI / 2, 0, 0], p: [0, doorY, zF - 0.8] });
  bk.add(mats.inside, new THREE.CircleGeometry(doorR + 0.03, 28), { p: [0, doorY, zF - 1.35] });
  // a ring of arch stones round it, the keystone proud
  const nv = grand ? 15 : 13;
  const a0 = -0.38;
  const a1 = Math.PI + 0.38;
  for (let i = 0; i < nv; i++) {
    const s0 = mix(a0, a1, i / nv) + 0.014;
    const s1 = mix(a0, a1, (i + 1) / nv) - 0.014;
    const key = i === (nv - 1) / 2;
    bk.add(mats.dressed, sector(doorR + 0.16, doorR + (key ? 0.5 : 0.42) - (i % 2) * 0.03, s0, s1, 0.12, grand ? 0.015 : 0), { p: [0, doorY, zF - 0.05], uv: 0.7, uvOff: i * 0.31 });
  }
  // a stone step, and a path of flags down to the gate
  bk.add(mats.dressed, new THREE.CylinderGeometry(doorR * 0.85, doorR * 0.9, 0.16, 20, 1, false, -Math.PI / 2, Math.PI), { p: [0, 0.08, zF - 0.12], uv: 0.6 });
  const fenceZ = grand ? 7.4 : zF + 2.7;
  for (let z = zF + 0.85; z < fenceZ - 0.25; z += 0.62) {
    bk.add(mats.stone, cyl(0.3 + r() * 0.06, 0.32 + r() * 0.06, 0.06, 7), { p: [(r() - 0.5) * 0.2, 0.02, z], r: [0, r() * 3, 0], s: [1, 1, 0.8], uv: 0.9 });
  }

  // the door: radial planks, a rim, an oak back, iron straps, the knob in
  // the middle; hinged on its left, so rotation.y opens it inwards
  const doorG = new THREE.Group();
  doorG.name = 'door';
  doorG.position.set(-doorR + 0.02, doorY, zF - 0.17);
  g.add(doorG);
  const dk = parts();
  const planks = grand ? 12 : 10;
  for (let i = 0; i < planks; i++) {
    const span = TAU / planks;
    const geo = sector(0, doorR - 0.06, Math.PI / 2 - span / 2 + 0.012, Math.PI / 2 + span / 2 - 0.012, 0.05, 0.012, 3);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, 0.125 + pos.getX(k) * 0.5 + (i % 4) * 0.25, pos.getY(k) * 0.6);
    dk.add(paint, geo, { r: [0, 0, i * span], p: [doorR - 0.02, 0, -0.065] });
  }
  dk.add(paint, new THREE.TorusGeometry(doorR - 0.045, 0.04, 4, 26), { p: [doorR - 0.02, 0, -0.02] });
  dk.add(paint, cylZ(doorR - 0.03, 0.03, 24), { p: [doorR - 0.02, 0, -0.09] });
  for (const y of [-0.45, 0.45]) {
    const len = doorR * 0.75;
    dk.add(mats.iron, B(len, 0.07, 0.02), { p: [len / 2 + 0.12, y * (doorR / 0.9), 0.01] });
    dk.add(mats.iron, cylZ(0.05, 0.02, 10), { p: [len + 0.12, y * (doorR / 0.9), 0.01] });
  }
  dk.add(mats.brass, cylZ(0.13, 0.02, 20), { p: [doorR - 0.02, 0, 0.005] });
  dk.add(mats.brass, cylZ(0.025, 0.08, 8), { p: [doorR - 0.02, 0, 0.05] });
  dk.add(mats.brass, ball(0.075, 12, 8), { p: [doorR - 0.02, 0, 0.1] });
  dk.build(doorG, { receive: true });
  // where a model of the leaf would go, in the door's own frame: its middle, its back, and its rim
  doorG.userData.leaf = { x: doorR - 0.02, z: -0.09, r: doorR - 0.03 };

  // the windows
  wins.forEach(([x, y, rr], i) => roundWindow(bk, K, { x, y, z: zF, rw: rr, frame: paint, seed: seed * 5 + i }));

  // the chimney: brick, out of the mound's top towards the back
  const cx = R * 0.3;
  const cz = -Rz * 0.3;
  const uy = Math.sqrt(Math.max(0, 1 - 0.09 - 0.09));
  const cy = H * Math.pow(uy, 0.8);
  bk.add(mats.brick, B(0.62, 1.9, 0.62), { p: [cx, cy + 0.25, cz], uv: 0.8 });
  bk.add(mats.dressed, roundBox(0.8, 0.12, 0.8, 0.03), { p: [cx, cy + 1.26, cz], uv: 0.6 });
  bk.add(mats.clay, lathe([[0.17, 0], [0.13, 0.28], [0.17, 0.36], [0.155, 0.42], [0.11, 0.42], [0.1, 0.3]], 10), { p: [cx, cy + 1.32, cz] });
  const chimneyTop = V3(cx, cy + 1.32 + 0.42, cz);

  // flowers along the wall's foot, bushes at its ends
  const bedL = doorR + 0.4;
  const bedR = A - 0.5;
  if (bedR > bedL + 0.3) for (const s of [-1, 1]) flowerBed(bk, K, s * (bedL + bedR) / 2, 0, zF + 0.35, bedR - bedL, 0.35, seed * 3 + s);
  for (const s of [-1, 1]) bush(bk, K, s * (A + 0.05), 0, zF + 0.15, 0.6 + r() * 0.2, seed * 11 + s, 5);

  // the fence and the gate
  const fx = grand ? 5.2 : Math.min(A + 0.9, R - 0.1);
  const fenceMat = !grand && (seed >> 2) % 2 ? K.paint(0xf2ecdc) : mats.fence;
  picketRun(bk, fenceMat, -fx, -0.55, fenceZ);
  picketRun(bk, fenceMat, 0.55, fx, fenceZ);
  const gate = gateGroup(K, fenceMat, 1.0);
  gate.position.set(-0.5, 0, fenceZ);
  gate.rotation.y = 0.55;
  g.add(gate);
  if (grand) flowerBed(bk, K, -fx / 2 - 0.3, 0, fenceZ - 0.4, fx - 1.2, 0.3, seed * 17, BLOOMS, 0.4);

  // a lamp by the gate, or a letterbox
  let lamp = null;
  if (grand || (seed + bits) % 2) {
    bk.at([-0.95, 0, fenceZ + 0.2], Math.PI, () => lampParts(bk, K));
    lamp = V3(-1.45, 1.95, fenceZ + 0.2);
  } else bk.at([0.95, 0, fenceZ + 0.25], 0, () => mailboxParts(bk, K));

  bk.build(g);
  // circles that keep a walker off the mound but let them up to the door
  const colliders = [
    { x: 0, z: -Rz * 0.3, r: Math.min(R * 0.78, cut + Rz * 0.3 - 0.05) },
    { x: -R * 0.6, z: -Rz * 0.1, r: R * 0.4 },
    { x: R * 0.6, z: -Rz * 0.1, r: R * 0.4 },
    { x: -(A + 0.45), z: cut, r: 0.6 },
    { x: A + 0.45, z: cut, r: 0.6 },
  ];
  return { group: g, door: doorG, gate, chimneyTop, radius: R, doorAt: V3(0, 0, zF + 0.75), front: zF, colliders, lamp, fenceZ };
}

// Bag End: the grand hole on top of the Hill, its green door, a bench to the
// right of it (where Gandalf sits), and the sign on the gate.
function bagEnd(K) {
  const out = hole(K, { R: 6.5, door: 0x2f6b3c, doorD: 2.2, seed: 7, grand: true });
  const { group } = out;
  const bk = parts();
  const benchAt = [4.5, 0, 5.5];
  let seat = 0.45;
  bk.at(benchAt, 0, () => (seat = benchParts(bk, K, 1.6)));
  bush(bk, K, 5.6, 0, 4.6, 0.55, 41, 5);
  // the sign on its post by the gate
  const sign = new THREE.Group();
  sign.name = 'sign';
  sign.position.set(0.95, 0, out.fenceZ + 0.18);
  sign.rotation.y = -0.12;
  group.add(sign);
  const sk = parts();
  sk.add(K.mats.timber, B(0.09, 1.3, 0.09), { p: [0, 0.65, -0.06], uv: 1.2 });
  sk.add(K.mats.wood, roundBox(0.74, 0.42, 0.04, 0.012), { p: [0, 1.08, 0], uv: 1.5 });
  sk.build(sign);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.38), new THREE.MeshStandardMaterial({ map: canvasTexture(bagEndSignCanvas(), K.renderer, { wrap: false }), roughness: 0.85 }));
  face.position.set(0, 1.08, 0.022);
  sign.add(face);
  bk.build(group);
  return { ...out, bench: V3(benchAt[0], seat, benchAt[2] + 0.02), sign };
}

// ── the mill, the barn and the inn: timber, plaster and stone ──

// A beam on a wall, in the wall's frame (x along it, y up, z out of it).
function beam(bk, mat, x0, y0, x1, y1, t = 0.15, out = 0.06) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  bk.add(mat, B(len + t * 0.5, t, out + 0.05), { p: [(x0 + x1) / 2, (y0 + y1) / 2, out / 2 - 0.025], r: [0, 0, Math.atan2(y1 - y0, x1 - x0)], uv: 1.1 });
}

// A square window on a wall at (x, y), w × h, in panes: glass, an oak frame
// and glazing bars, a stone sill (and a lintel, and flowers, if asked).
function squareWindow(bk, K, { x, y, w, h, nx = 2, ny = 2, frame, sill, lintel, box = 0, seed = 1 }) {
  const { mats } = K;
  const F = frame || mats.timber;
  bk.add(mats.window, new THREE.PlaneGeometry(w, h), { p: [x, y, 0.012] });
  const t = 0.08;
  bk.add(F, B(w + t * 2, t, 0.12), { p: [x, y + h / 2 + t / 2, 0.04], uv: 1.2 });
  bk.add(F, B(w + t * 2, t, 0.12), { p: [x, y - h / 2 - t / 2, 0.04], uv: 1.2 });
  bk.add(F, B(t, h, 0.12), { p: [x - w / 2 - t / 2, y, 0.04], uv: 1.2 });
  bk.add(F, B(t, h, 0.12), { p: [x + w / 2 + t / 2, y, 0.04], uv: 1.2 });
  for (let i = 1; i < nx; i++) bk.add(F, B(0.035, h, 0.05), { p: [x - w / 2 + (w * i) / nx, y, 0.03] });
  for (let j = 1; j < ny; j++) bk.add(F, B(w, 0.035, 0.05), { p: [x, y - h / 2 + (h * j) / ny, 0.03] });
  if (sill) bk.add(sill, B(w + 0.34, 0.1, 0.24), { p: [x, y - h / 2 - t - 0.04, 0.09], uv: 0.6 });
  if (lintel) bk.add(lintel, B(w + 0.4, 0.2, 0.14), { p: [x, y + h / 2 + t + 0.1, 0.04], uv: 0.6 });
  if (box) {
    bk.add(mats.timber, roundBox(w + 0.2, 0.2, 0.24, 0.02), { p: [x, y - h / 2 - t - 0.22, 0.2], uv: 1.2 });
    flowerBed(bk, K, x, y - h / 2 - t - 0.12, 0.2, w + 0.1, 0.18, seed);
  }
}

// An oak frame on a plastered wall `len` long and `h` high: plates top and
// bottom, posts beside each window, rails above and below them, and braces
// leaning in the plain panels. Windows are [{ x, w, h, panes }].
function timberWall(bk, K, { len, h, wins = [], wy = h * 0.52, braces = true }) {
  const T = K.mats.timber;
  const t = 0.15;
  beam(bk, T, 0, t / 2, len, t / 2, t);
  beam(bk, T, 0, h - t / 2, len, h - t / 2, t);
  const xs = [t / 2, len - t / 2];
  for (const w of wins) xs.push(w.x - w.w / 2 - t / 2 - 0.1, w.x + w.w / 2 + t / 2 + 0.1);
  xs.sort((a, b) => a - b);
  const posts = [];
  for (let i = 0; i < xs.length; i++) {
    posts.push(xs[i]);
    const gap = xs[i + 1] - xs[i];
    const hasWin = wins.some((w) => w.x > xs[i] && w.x < xs[i + 1]);
    if (i < xs.length - 1 && !hasWin && gap > 2.2) {
      const k = Math.round(gap / 1.3);
      for (let j = 1; j < k; j++) posts.push(xs[i] + (gap * j) / k);
    }
  }
  for (const x of posts) beam(bk, T, x, t, x, h - t, t);
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    const win = wins.find((w) => w.x > a && w.x < b);
    if (win) {
      const wh = win.h ?? 0.85;
      const y0 = wy - wh / 2 - 0.16;
      const y1 = wy + wh / 2 + 0.16;
      beam(bk, T, a, y0, b, y0, t * 0.9);
      if (y1 < h - t * 1.5) beam(bk, T, a, y1, b, y1, t * 0.9);
      const [nx, ny] = win.panes || [2, 2];
      squareWindow(bk, K, { x: win.x, y: wy, w: win.w, h: wh, nx, ny });
    } else if (braces && b - a > 0.55) {
      if (i % 2) beam(bk, T, a, t, b, h - t, t * 0.85);
      else beam(bk, T, b, t, a, h - t, t * 0.85);
    }
  }
}

// A plank door with a round head, w × h, its face at z = 0, iron straps and
// a ring handle; `paint` colours it.
function plankDoor(bk, K, { x = 0, w, h, paint, y = 0 }) {
  const { mats } = K;
  const s = new THREE.Shape();
  const r = w / 2;
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, h - r);
  s.absarc(0, h - r, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1, curveSegments: 10 });
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.25, uv.getY(i) * 0.5);
  bk.add(paint, geo, { p: [x, y, -0.06] });
  for (const yy of [0.35, h - r - 0.2]) bk.add(mats.iron, B(w * 0.8, 0.07, 0.02), { p: [x - w * 0.08, y + yy, 0.035] });
  bk.add(mats.iron, new THREE.TorusGeometry(0.06, 0.012, 5, 12), { p: [x + w * 0.32, y + h * 0.48, 0.05] });
}

// The old mill by the pond: a stone ground floor, a plastered and
// timbered upper floor jettied out over it, a steep thatch with its gable
// to the front, a loft door with a hoist over it, and an overshot water
// wheel on its east side fed by a wooden flume on posts.
function mill(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'mill';
  const bk = parts();
  const w = 4.0;
  const d = 5.6;
  const h1 = 2.5;
  const h2 = 2.2;
  const jet = 0.12;
  const W = w + jet * 2;
  const D = d + jet * 2;
  const top = h1 + h2;
  bk.add(mats.ashlar, B(w + 0.24, 0.4, d + 0.24), { p: [0, 0.2, 0], uv: 0.45 });
  bk.add(mats.ashlar, B(w, h1, d), { p: [0, h1 / 2, 0], uv: 0.45 });
  bk.add(mats.plaster, B(W, h2, D), { p: [0, h1 + h2 / 2, 0], uv: 0.4 });
  bk.add(mats.timber, B(W + 0.08, 0.18, D + 0.08), { p: [0, h1 + 0.03, 0], uv: 1 });

  // the upper storey's frame and windows, face by face
  const faces = [
    [[-W / 2, h1, D / 2], 0, W, [{ x: W / 2, w: 0.9, h: 0.85 }]],
    [[W / 2, h1, D / 2], Math.PI / 2, D, [{ x: 0.75, w: 0.7, h: 0.75 }, { x: D - 0.75, w: 0.7, h: 0.75 }]],
    [[W / 2, h1, -D / 2], Math.PI, W, [{ x: W / 2, w: 0.8, h: 0.8 }]],
    [[-W / 2, h1, -D / 2], -Math.PI / 2, D, [{ x: 1.5, w: 0.8, h: 0.85 }, { x: D - 1.5, w: 0.8, h: 0.85 }]],
  ];
  for (const [o, ry, len, wins] of faces) bk.at(o, ry, () => timberWall(bk, K, { len, h: h2, wins }));

  // the ground floor: a round-headed door with an arch of stones, windows
  bk.at([0, 0.4, d / 2], 0, () => {
    plankDoor(bk, K, { w: 1.0, h: 1.85, paint: K.paint(0x5d7f78) });
    for (let i = 0; i < 9; i++) {
      const s0 = (i / 9) * Math.PI + 0.012;
      const s1 = ((i + 1) / 9) * Math.PI - 0.012;
      bk.add(mats.dressed, sector(0.52, i === 4 ? 0.77 : 0.7, s0, s1, 0.1, 0.012), { p: [0, 1.35, -0.03], uv: 0.7, uvOff: i * 0.3 });
    }
    for (const x of [-1.3, 1.3]) squareWindow(bk, K, { x, y: 1.0, w: 0.55, h: 0.7, nx: 2, ny: 2, sill: mats.dressed, lintel: mats.dressed });
  });
  bk.at([-w / 2, 0, -d / 2], -Math.PI / 2, () => {
    for (const x of [1.4, d - 1.4]) squareWindow(bk, K, { x, y: 1.4, w: 0.6, h: 0.7, sill: mats.dressed, lintel: mats.dressed });
  });
  bk.at([w / 2, 0, -d / 2], Math.PI, () => squareWindow(bk, K, { x: w / 2, y: 1.4, w: 0.6, h: 0.7, sill: mats.dressed, lintel: mats.dressed }));

  // gables: plaster and oak, the front with the loft door and its hoist
  const rise = 2.5;
  const span = W + 0.9;
  const roofY = top - 0.12;
  const gRise = underRidge(span, rise, 0.34, roofY - top);
  for (const s of [-1, 1]) {
    bk.add(mats.plaster, gableGeo(W / 2, gRise, 0.22), { p: [0, top, s > 0 ? D / 2 - 0.22 : -D / 2], uv: 0.4 });
    bk.at([s > 0 ? -W / 2 : W / 2, top, s * D / 2], s > 0 ? 0 : Math.PI, () => {
      const c = W / 2;
      beam(bk, mats.timber, 0.1, 0.06, c, gRise - 0.05, 0.14);
      beam(bk, mats.timber, W - 0.1, 0.06, c, gRise - 0.05, 0.14);
      if (s > 0) {
        beam(bk, mats.timber, c - 0.48, 0.1, c - 0.48, 1.35, 0.13);
        beam(bk, mats.timber, c + 0.48, 0.1, c + 0.48, 1.35, 0.13);
        beam(bk, mats.timber, c - 0.55, 1.35, c + 0.55, 1.35, 0.13);
        bk.add(K.paint(0x5d7f78), roundBox(0.8, 1.1, 0.06, 0.012), { p: [c, 0.72, 0.02], uv: 1.25 });
      } else {
        beam(bk, mats.timber, c, 0.1, c, gRise - 0.2, 0.14);
        beam(bk, mats.timber, c - 1.0, 0.95, c + 1.0, 0.95, 0.13);
      }
    });
  }
  // the hoist: a beam out from under the ridge, a pulley, a rope, a sack
  bk.add(mats.timber, B(0.18, 0.2, 1.4), { p: [0, top + gRise - 0.35, D / 2 + 0.45], uv: 1 });
  bk.add(mats.iron, new THREE.TorusGeometry(0.11, 0.03, 6, 14), { p: [0, top + gRise - 0.58, D / 2 + 0.95], r: [0, Math.PI / 2, 0] });
  bk.add(mats.rope, cyl(0.015, 0.015, 1.3, 4), { p: [0, top + gRise - 1.3, D / 2 + 1.05] });
  bk.add(mats.sack, blob(0.22, { detail: 1, amp: 0.12, seed: 5 }), { p: [0, top + gRise - 2.15, D / 2 + 1.05], s: [0.9, 1.3, 0.8], uv: 1.5 });

  // the thatch, with a roll along the ridge
  bk.add(mats.thatch, roofGeo({ span, len: D + 0.9, rise, t: 0.34, thatch: true, seed: 3 }), { p: [0, roofY, 0] });
  bk.add(mats.thatch, cylZ(0.17, D + 1.0, 10), { p: [0, roofY + rise - 0.06, 0], uv: 1.3 });

  // a stone chimney up the back of the roof
  const chx = 0.95;
  const chz = -1.7;
  bk.add(mats.ashlar, B(0.64, 3.0, 0.64), { p: [chx, top + 1.4, chz], uv: 0.45 });
  bk.add(mats.dressed, roundBox(0.82, 0.12, 0.82, 0.03), { p: [chx, top + 2.96, chz], uv: 0.6 });
  bk.add(mats.clay, lathe([[0.15, 0], [0.12, 0.25], [0.15, 0.32], [0.1, 0.32], [0.09, 0.22]], 10), { p: [chx, top + 3.02, chz] });
  const chimneyTop = V3(chx, top + 3.34, chz);

  // the flume on two posts, from behind, over the top of the wheel
  const wx = 2.42;
  const fy = 3.55;
  bk.add(mats.timber, B(0.5, 0.05, 4.9), { p: [wx, fy, -2.8], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.timber, B(0.05, 0.3, 4.9), { p: [wx + s * 0.25, fy + 0.13, -2.8], uv: 1 });
  for (const z of [-2.6, -4.6]) {
    bk.add(mats.timber, B(0.16, fy, 0.16), { p: [wx, fy / 2, z], uv: 1 });
    bk.add(mats.timber, B(0.7, 0.12, 0.14), { p: [wx, fy - 0.1, z], uv: 1 });
  }
  // sacks of flour by the door
  bk.add(mats.sack, blob(0.25, { detail: 1, amp: 0.15, seed: 8 }), { p: [-1.0, 0.32, d / 2 + 0.45], s: [1, 1.3, 0.85], uv: 1.5 });
  bk.add(mats.sack, blob(0.22, { detail: 1, amp: 0.15, seed: 9 }), { p: [-0.62, 0.27, d / 2 + 0.55], s: [1, 1.2, 0.85], r: [0, 0, 0.25], uv: 1.5 });
  bk.build(g);

  // the wheel: two rims on eight spokes each, sixteen buckets between, an
  // oak hub on an iron axle into the wall. It turns about x: the mount turns
  // it to face the wall, so the scene spins wheel.rotation.z.
  const mount = new THREE.Group();
  mount.position.set(wx, 1.5, 0);
  mount.rotation.y = Math.PI / 2;
  g.add(mount);
  const wheel = new THREE.Group();
  wheel.name = 'wheel';
  mount.add(wheel);
  const wk = parts();
  const Rw = 1.8;
  const wh = 0.3;
  for (const s of [-1, 1]) {
    wk.add(mats.timber, ringGeo(Rw - 0.22, Rw, 0.08, 40), { p: [0, 0, s * wh - 0.04] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + (s > 0 ? 0 : Math.PI / 8);
      wk.add(mats.timber, B(Rw - 0.12, 0.1, 0.07), { p: [(Math.cos(a) * (Rw - 0.12)) / 2, (Math.sin(a) * (Rw - 0.12)) / 2, s * wh], r: [0, 0, a], uv: 1 });
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    wk.add(mats.wood, B(0.4, 0.05, wh * 2 + 0.04), { p: [Math.cos(a) * (Rw - 0.15), Math.sin(a) * (Rw - 0.15), 0], r: [0, 0, a + 0.55], uv: 1.2 });
  }
  wk.add(mats.timber, cylZ(0.26, 0.8, 12), { uv: 1 });
  wk.add(mats.iron, cylZ(0.07, 1.3, 8), { p: [0, 0, -0.35] });
  wk.build(wheel);
  return { group: g, wheel, chimneyTop, footprint: { w: w + 0.24, d: d + 0.24 }, doorAt: V3(0, 0, d / 2 + 0.75), flumeEnd: V3(wx, fy, -0.35) };
}

// Farmer Maggot's barn: an oak frame filled with upright planks on a low
// stone footing, a steep thatch, big double doors to the front with a
// hayloft door over them, and a spare cart wheel leaning by the doors.
function barn(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'barn';
  const bk = parts();
  const w = 6;
  const d = 9;
  const foot = 0.55;
  const h = 3.1;
  const top = foot + h;
  bk.add(mats.stone, B(w + 0.2, foot, d + 0.2), { p: [0, foot / 2, 0], uv: 0.6 });
  bk.add(mats.barnwood, B(w, h, d), { p: [0, foot + h / 2, 0], uv: 0.75 });
  // the frame: corner and middle posts, a rail, braces
  const sides = [
    [[-w / 2, foot, d / 2], 0, w],
    [[w / 2, foot, d / 2], Math.PI / 2, d],
    [[w / 2, foot, -d / 2], Math.PI, w],
    [[-w / 2, foot, -d / 2], -Math.PI / 2, d],
  ];
  sides.forEach(([o, ry, len], i) =>
    bk.at(o, ry, () => {
      const T = mats.timber;
      beam(bk, T, 0, 0.08, len, 0.08, 0.18);
      beam(bk, T, 0, h - 0.08, len, h - 0.08, 0.18);
      const n = Math.max(2, Math.round(len / 2.2));
      for (let k = 0; k <= n; k++) {
        const x = 0.09 + ((len - 0.18) * k) / n;
        if (i === 0 && k > 0 && k < n) continue;
        beam(bk, T, x, 0.1, x, h - 0.1, 0.17);
      }
      if (i !== 0) {
        beam(bk, T, 0, h * 0.5, len, h * 0.5, 0.14);
        for (let k = 0; k < n; k++) {
          const xa = 0.09 + ((len - 0.18) * k) / n;
          const xb = 0.09 + ((len - 0.18) * (k + 1)) / n;
          if (k % 2) beam(bk, T, xa, h * 0.5, xb, h - 0.12, 0.13);
          else beam(bk, T, xb, h * 0.5, xa, h - 0.12, 0.13);
        }
      } else {
        beam(bk, T, 0, h - 0.7, len, h - 0.7, 0.15);
      }
    }),
  );
  // the double doors, standing a little open, and the hayloft door
  const doorW = 1.4;
  const doorH = foot + h - 0.85;
  bk.at([0, 0, d / 2 + 0.1], 0, () => {
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      leaf.position.set(s * doorW, 0, d / 2 + 0.16);
      leaf.rotation.y = s * (s > 0 ? 0.22 : 0.5);
      g.add(leaf);
      const lk = parts();
      lk.add(mats.barnwood, B(doorW, doorH, 0.08), { p: [-s * doorW / 2, doorH / 2, 0], uv: 0.75 });
      lk.add(mats.timber, B(doorW, 0.14, 0.06), { p: [-s * doorW / 2, 0.25, 0.06], uv: 1 });
      lk.add(mats.timber, B(doorW, 0.14, 0.06), { p: [-s * doorW / 2, doorH - 0.25, 0.06], uv: 1 });
      const diag = Math.hypot(doorW - 0.1, doorH - 0.5);
      lk.add(mats.timber, B(diag, 0.13, 0.05), { p: [-s * doorW / 2, doorH / 2, 0.06], r: [0, 0, s * Math.atan2(doorH - 0.5, doorW - 0.1)], uv: 1 });
      for (const y of [0.25, doorH - 0.25]) lk.add(mats.iron, B(0.4, 0.06, 0.02), { p: [-s * 0.2, y, 0.1] });
      lk.build(leaf);
    }
    bk.add(mats.inside, new THREE.PlaneGeometry(doorW * 2, doorH), { p: [0, doorH / 2, 0.006] });
    beam(bk, mats.timber, -doorW - 0.1, 0, -doorW - 0.1, doorH + 0.1, 0.18, 0.1);
    beam(bk, mats.timber, doorW + 0.1, 0, doorW + 0.1, doorH + 0.1, 0.18, 0.1);
    beam(bk, mats.timber, -doorW - 0.2, doorH + 0.08, doorW + 0.2, doorH + 0.08, 0.2, 0.1);
  });
  // gables, planked, with the hayloft door and a hoist beam on the front
  const rise = 3.6;
  const span = w + 1.0;
  const roofY = top - 0.15;
  const gRise = underRidge(span, rise, 0.36, roofY - top);
  for (const s of [-1, 1]) bk.add(mats.barnwood, gableGeo(w / 2, gRise, 0.2), { p: [0, top, s > 0 ? d / 2 - 0.2 : -d / 2], uv: 0.75 });
  bk.at([0, top, d / 2], 0, () => {
    bk.add(mats.timber, roundBox(1.1, 1.2, 0.06, 0.015), { p: [0, 0.75, 0.03], uv: 1.2 });
    beam(bk, mats.timber, -0.65, 0.1, -0.65, 1.45, 0.13);
    beam(bk, mats.timber, 0.65, 0.1, 0.65, 1.45, 0.13);
    beam(bk, mats.timber, -0.72, 1.45, 0.72, 1.45, 0.13);
    beam(bk, mats.timber, -w / 2 + 0.1, 0.06, 0, gRise - 0.05, 0.15);
    beam(bk, mats.timber, w / 2 - 0.1, 0.06, 0, gRise - 0.05, 0.15);
  });
  bk.add(mats.timber, B(0.18, 0.2, 1.2), { p: [0, top + gRise - 0.5, d / 2 + 0.45], uv: 1 });
  bk.add(mats.iron, new THREE.TorusGeometry(0.1, 0.028, 6, 14), { p: [0, top + gRise - 0.72, d / 2 + 0.9], r: [0, Math.PI / 2, 0] });
  bk.add(mats.rope, cyl(0.014, 0.014, 1.0, 4), { p: [0, top + gRise - 1.3, d / 2 + 1.0] });
  // the thatch, and its ridge roll
  bk.add(mats.thatch, roofGeo({ span, len: d + 0.9, rise, t: 0.36, thatch: true, seed: 9 }), { p: [0, roofY, 0] });
  bk.add(mats.thatch, cylZ(0.18, d + 1.0, 10), { p: [0, roofY + rise - 0.06, 0], uv: 1.3 });
  // a spare cart wheel leaning by the doors, a heap of hay by the side
  bk.at([2.3, 0, d / 2 + 0.25], 0, () => {
    const wg = [];
    wg.push(tf(ringGeo(0.48, 0.58, 0.07, 28), { p: [0, 0, -0.035] }));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      wg.push(tf(B(0.5, 0.045, 0.04), { p: [Math.cos(a) * 0.25, Math.sin(a) * 0.25, 0], r: [0, 0, a] }));
    }
    wg.push(cylZ(0.09, 0.2, 10));
    for (const geo of wg) bk.add(mats.wood, geo, { r: [0.28, 0, 0], p: [0, 0.6, -0.05], uv: 1.4 });
    bk.add(mats.iron, new THREE.TorusGeometry(0.58, 0.022, 5, 32), { r: [0.28, 0, 0], p: [0, 0.6, -0.05] });
  });
  bk.add(mats.thatch, blob(0.9, { detail: 2, amp: 0.15, freq: 1.4, seed: 12 }), { p: [w / 2 + 0.6, 0.35, 1.6], s: [1, 0.7, 1.4], uv: 0.8 });
  bk.build(g);
  return { group: g, footprint: { w: w + 0.2, d: d + 0.2 }, doorAt: V3(0, 0, d / 2 + 1.0) };
}

// The Green Dragon: a long inn of coursed stone below and plaster and oak
// above, jettied front and back, a slate roof with a cross-gable over the
// door (a round window in it) and stone chimneys up both ends, many-paned
// windows that glow at night, a lantern by the green door under a little
// porch roof, and outside, the sign on its post, a bench and barrels.
function greenDragon(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'greenDragon';
  const bk = parts();
  const w = 11;
  const d = 6.5;
  const h1 = 2.8;
  const h2 = 2.4;
  const jet = 0.2;
  const D = d + jet * 2;
  const top = h1 + h2;
  const green = K.paint(0x2f5e34);
  bk.add(mats.ashlar, B(w + 0.24, 0.35, d + 0.24), { p: [0, 0.175, 0], uv: 0.45 });
  bk.add(mats.ashlar, B(w, h1, d), { p: [0, h1 / 2, 0], uv: 0.45 });
  bk.add(mats.plaster, B(w, h2, D), { p: [0, h1 + h2 / 2, 0], uv: 0.4 });
  bk.add(mats.timber, B(w + 0.1, 0.2, D + 0.1), { p: [0, h1 + 0.06, 0], uv: 1 });
  for (let x = -w / 2 + 0.35; x <= w / 2 - 0.3; x += 0.7) bk.add(mats.timber, B(0.12, 0.12, jet + 0.05), { p: [x, h1 - 0.06, d / 2 + jet / 2] });

  // the upper floor's frame and windows
  const upper = [
    [[-w / 2, h1, D / 2], 0, w, [{ x: 1.6, w: 0.9, h: 0.9 }, { x: w / 2, w: 1.5, h: 0.95, panes: [3, 2] }, { x: w - 1.6, w: 0.9, h: 0.9 }]],
    [[w / 2, h1, D / 2], Math.PI / 2, D, [{ x: D / 2, w: 0.9, h: 0.9 }]],
    [[w / 2, h1, -D / 2], Math.PI, w, [{ x: 2.4, w: 0.9, h: 0.9 }, { x: w / 2, w: 0.9, h: 0.9 }, { x: w - 2.4, w: 0.9, h: 0.9 }]],
    [[-w / 2, h1, -D / 2], -Math.PI / 2, D, [{ x: D / 2, w: 0.9, h: 0.9 }]],
  ];
  for (const [o, ry, len, wins] of upper) bk.at(o, ry, () => timberWall(bk, K, { len, h: h2, wins }));

  // the ground floor: the door, windows with sills, lintels and flowers
  bk.at([0, 0.35, d / 2], 0, () => {
    plankDoor(bk, K, { w: 1.35, h: 2.2, paint: green });
    bk.add(mats.brass, ball(0.05, 10, 8), { p: [0.45, 1.05, 0.08] });
    for (let i = 0; i < 11; i++) {
      const s0 = (i / 11) * Math.PI + 0.012;
      const s1 = ((i + 1) / 11) * Math.PI - 0.012;
      bk.add(mats.dressed, sector(0.7, i === 5 ? 1.06 : 0.98, s0, s1, 0.1, 0.012), { p: [0, 1.525, -0.03], uv: 0.7, uvOff: i * 0.3 });
    }
    for (const x of [-4.3, -2.2, 2.2, 4.3]) squareWindow(bk, K, { x, y: 1.25, w: 1.0, h: 1.1, nx: 3, ny: 3, sill: mats.dressed, lintel: mats.dressed, box: Math.abs(x) < 3 ? 1 : 0, seed: Math.round(x * 10) });
  });
  bk.at([w / 2, 0.35, -d / 2], Math.PI, () => {
    for (const x of [2.2, w - 2.2]) squareWindow(bk, K, { x, y: 1.25, w: 1.0, h: 1.1, nx: 3, ny: 3, sill: mats.dressed, lintel: mats.dressed });
    plankDoor(bk, K, { x: w / 2, w: 1.0, h: 2.0, paint: mats.timber });
  });
  for (const s of [-1, 1]) bk.at([s * w / 2, 0.35, s * d / 2], s * Math.PI / 2, () => squareWindow(bk, K, { x: d / 2, y: 1.25, w: 0.9, h: 1.0, nx: 3, ny: 3, sill: mats.dressed, lintel: mats.dressed }));

  // the porch roof over the door, on two curved brackets, and the lantern
  bk.add(mats.slate, roundBox(2.2, 0.08, 1.05, 0.02), { p: [0, 2.95, d / 2 + 0.45], r: [0.32, 0, 0], uv: 1 });
  for (const s of [-1, 1]) bk.add(mats.timber, tube([[s * 0.95, 2.2, d / 2], [s * 0.95, 2.62, d / 2 + 0.25], [s * 0.95, 2.82, d / 2 + 0.75]], 0.06, 0.05, { seg: 5, radial: 5 }));
  bk.add(mats.iron, tube([[-1.15, 2.55, d / 2], [-1.15, 2.62, d / 2 + 0.3], [-1.18, 2.52, d / 2 + 0.42]], 0.02, 0.015, { seg: 4, radial: 4 }));
  lanternParts(bk, K, -1.18, 2.25, d / 2 + 0.42, 1.2, 0.12);

  // the cross-gable over the door, with a round window
  const cw = 2.4;
  const cRise = 2.2;
  bk.add(mats.plaster, gableGeo(cw, cRise, 0.25), { p: [0, top, D / 2 - 0.25], uv: 0.4 });
  bk.at([-cw, top, D / 2], 0, () => {
    beam(bk, mats.timber, 0.1, 0.06, cw, cRise - 0.05, 0.14);
    beam(bk, mats.timber, cw * 2 - 0.1, 0.06, cw, cRise - 0.05, 0.14);
    beam(bk, mats.timber, 0.6, 0.08, cw * 2 - 0.6, 0.08, 0.14);
  });
  roundWindow(bk, K, { x: 0, y: top + 0.95, z: D / 2, rw: 0.36, frame: green, seed: 31, flush: true });
  const cLen = D / 2 + 0.5 - 0.3;
  bk.add(mats.slate, roofGeo({ span: cw * 2 + 0.7, len: cLen, rise: cRise + 0.25, t: 0.17 }), { p: [0, top - 0.12, 0.3 + cLen / 2] });
  bk.add(mats.ridge, new THREE.CylinderGeometry(0.11, 0.11, cLen, 8, 1, false, -Math.PI / 2, Math.PI), { r: [Math.PI / 2, 0, 0], p: [0, top - 0.12 + cRise + 0.25 - 0.02, 0.3 + cLen / 2] });

  // the main roof, ridge along x, and its ridge tiles
  const rise = 3.0;
  const span = D + 1.0;
  bk.add(mats.slate, roofGeo({ span, len: w + 0.7, rise, t: 0.18 }), { p: [0, top - 0.1, 0], r: [0, Math.PI / 2, 0] });
  bk.add(mats.ridge, new THREE.CylinderGeometry(0.12, 0.12, w + 0.7, 8, 1, false, -Math.PI / 2, Math.PI), { r: [0, 0, Math.PI / 2], p: [0, top - 0.1 + rise - 0.02, 0] });
  // the end gables, timbered
  const gRise = underRidge(span, rise, 0.18, -0.1);
  for (const s of [-1, 1]) {
    bk.add(mats.plaster, gableGeo(D / 2, gRise, 0.22), { p: [s > 0 ? w / 2 - 0.22 : -w / 2, top, 0], r: [0, Math.PI / 2, 0], uv: 0.4 });
    bk.at([s * w / 2, top, s * D / 2], s * Math.PI / 2, () => {
      beam(bk, mats.timber, 0.1, 0.06, D / 2, gRise - 0.05, 0.14);
      beam(bk, mats.timber, D - 0.1, 0.06, D / 2, gRise - 0.05, 0.14);
      beam(bk, mats.timber, D / 2, 0.1, D / 2, gRise - 0.2, 0.14);
    });
  }
  // stone chimneys up the outside of both ends
  const chimneyTops = [];
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.38);
    const z = -0.9;
    bk.add(mats.ashlar, B(0.76, top, 1.1), { p: [x, top / 2, z], uv: 0.45 });
    bk.add(mats.ashlar, B(0.7, 0.5, 1.04), { p: [x - s * 0.04, top + 0.2, z], r: [0, 0, s * 0.35], uv: 0.45 });
    bk.add(mats.ashlar, B(0.6, 4.0, 0.8), { p: [x - s * 0.1, top + 2.0, z], uv: 0.45 });
    bk.add(mats.dressed, roundBox(0.8, 0.14, 1.0, 0.03), { p: [x - s * 0.1, top + 4.05, z], uv: 0.6 });
    for (const dz of [-0.18, 0.18]) bk.add(mats.clay, lathe([[0.13, 0], [0.1, 0.24], [0.13, 0.3], [0.09, 0.3], [0.08, 0.2]], 10), { p: [x - s * 0.1, top + 4.12, z + dz] });
    chimneyTops.push(V3(x - s * 0.1, top + 4.42, z - 0.18));
  }

  // outside: a bench, barrels, tubs of flowers by the door
  bk.at([-2.3, 0, d / 2 + 0.55], 0, () => benchParts(bk, K, 1.6));
  bk.at([2.25, 0, d / 2 + 0.45], 0, () => barrelParts(bk, K));
  bk.at([2.95, 0, d / 2 + 0.5], 0, () => barrelParts(bk, K));
  bk.at([3.3, 0.27, d / 2 + 1.1], [0, 0.5, Math.PI / 2], () => barrelParts(bk, K, { h: 0.8, r: 0.28 }));
  for (const s of [-1, 1]) {
    bk.at([s * 1.05, 0, d / 2 + 0.35], 0, () => barrelParts(bk, K, { h: 0.42, r: 0.3 }));
    bush(bk, K, s * 1.05, 0.38, d / 2 + 0.35, 0.3, 50 + s, 8);
  }
  bk.build(g);

  // the sign on its post
  const sign = new THREE.Group();
  sign.name = 'sign';
  sign.position.set(-4.6, 0, d / 2 + 2.1);
  g.add(sign);
  const sk = parts();
  sk.add(mats.timber, B(0.16, 3.4, 0.16), { p: [0, 1.7, 0], uv: 1 });
  sk.add(mats.timber, B(1.4, 0.14, 0.14), { p: [0.6, 3.15, 0], uv: 1 });
  sk.add(mats.timber, B(0.6, 0.1, 0.1), { p: [0.24, 2.92, 0], r: [0, 0, 0.75], uv: 1 });
  for (const x of [0.25, 1.05]) sk.add(mats.iron, cyl(0.012, 0.012, 0.32, 4), { p: [x, 2.95, 0] });
  sk.add(mats.wood, roundBox(1.02, 1.02, 0.06, 0.02), { p: [0.65, 2.28, 0], uv: 1.4 });
  sk.build(sign);
  const signMat = new THREE.MeshStandardMaterial({ map: canvasTexture(dragonSignCanvas(), K.renderer, { wrap: false }), roughness: 0.8 });
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), signMat);
    face.position.set(0.65, 2.28, s * 0.032);
    if (s < 0) face.rotation.y = Math.PI;
    face.castShadow = true;
    sign.add(face);
  }
  return { group: g, chimneyTop: chimneyTops[1], chimneyTops, footprint: { w: w + 0.24, d: d + 0.24 }, doorAt: V3(0, 0, d / 2 + 0.9), sign };
}

// ── the bridge ──

// The double-arched stone bridge over the Water: the deck humps along z
// from -span/2 to span/2, the arches open along x (the stream runs along x
// under it, its surface best a little below y = -0.8, where the arches
// spring from -1.0). Arch stones on both faces, parapets with a rounded
// coping, end piers, cutwaters on the middle pier, a little ivy.
function bridge(K, { span = 9, width = 3.2, rise = 1.3 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'bridge';
  const bk = parts();
  const L = span / 2;
  const deck = (z) => (Math.abs(z) >= L ? 0 : rise * 0.5 * (1 + Math.cos((Math.PI * z) / L)));
  const bed = -1.9;
  const spring = -1.0;
  const pier = 0.45;
  const ra = Math.max(0.6, (L - 0.75 - pier) / 2);
  const ha = Math.min(1.3, ra * 0.82);
  const c2 = pier + ra;
  const s = new THREE.Shape();
  s.moveTo(-L - 0.3, bed);
  s.lineTo(-L - 0.3, 0);
  for (let i = 0; i <= 36; i++) {
    const z = -L + (i / 36) * 2 * L;
    s.lineTo(z, deck(z));
  }
  s.lineTo(L + 0.3, 0);
  s.lineTo(L + 0.3, bed);
  s.lineTo(c2 + ra, bed);
  s.lineTo(c2 + ra, spring);
  s.absellipse(c2, spring, ra, ha, 0, Math.PI, false);
  s.lineTo(pier, bed);
  s.lineTo(-pier, bed);
  s.lineTo(-pier, spring);
  s.absellipse(-c2, spring, ra, ha, 0, Math.PI, false);
  s.lineTo(-c2 - ra, bed);
  bk.add(mats.ashlar, new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 20 }), { r: [0, -Math.PI / 2, 0], p: [width / 2, 0, 0], uv: 0.5 });

  // arch stones round both arches, on both faces
  const nV = 11;
  for (const c of [-c2, c2]) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < nV; i++) {
        const a0 = (i / nV) * Math.PI + 0.012;
        const a1 = ((i + 1) / nV) * Math.PI - 0.012;
        const out = i === (nV - 1) / 2 ? 0.5 : 0.38 - (i % 2) * 0.04;
        const P = (a, k) => [c + Math.cos(a) * (ra + k), spring + Math.sin(a) * (ha + k)];
        const q = new THREE.Shape();
        q.moveTo(...P(a0, -0.02));
        q.lineTo(...P(a0, out));
        q.lineTo(...P(a1, out));
        q.lineTo(...P(a1, -0.02));
        bk.add(mats.dressed, new THREE.ExtrudeGeometry(q, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 1 }), { r: [0, -Math.PI / 2, 0], p: [side > 0 ? width / 2 + 0.06 : -width / 2 + 0.08, 0, 0], uv: 0.6, uvOff: i * 0.29 });
      }
    }
  }

  // parapets with a rounded coping, the deck's setts between them
  const zs = [];
  for (let i = 0; i <= 30; i++) zs.push(-L + 0.2 + (i / 30) * (2 * L - 0.4));
  const pt = 0.3;
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? width / 2 - pt : -width / 2;
    const x1 = x0 + pt;
    bk.add(mats.ashlar, sweep([[x0, -0.05], [x1, -0.05], [x1, 0.58], [x0, 0.58]], zs, deck), { uv: 0.5 });
    const cop = [[x0 - 0.04, 0.56], [x1 + 0.04, 0.56]];
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI;
      cop.push([(x0 + x1) / 2 + Math.cos(a) * (pt / 2 + 0.04), 0.62 + Math.sin(a) * 0.09]);
    }
    bk.add(mats.dressed, sweep(cop, zs, deck), { uv: 0.6 });
    for (const e of [-1, 1]) {
      const pz = e * (L - 0.05);
      const px = (x0 + x1) / 2;
      bk.add(mats.dressed, roundBox(0.46, 0.9, 0.46, 0.03), { p: [px, 0.45, pz], uv: 0.6 });
      bk.add(mats.dressed, new THREE.ConeGeometry(0.33, 0.24, 4), { p: [px, 1.02, pz], r: [0, Math.PI / 4, 0], uv: 0.6 });
    }
  }
  const zd = [];
  for (let i = 0; i <= 36; i++) zd.push(-L - 0.3 + (i / 36) * (2 * L + 0.6));
  bk.add(mats.stone, sweep([[-width / 2 + pt, -0.04], [width / 2 - pt, -0.04], [width / 2 - pt, 0.03], [-width / 2 + pt, 0.03]], zd, deck), { uv: 0.9 });

  // cutwaters on the middle pier, up and down stream
  for (const side of [-1, 1]) {
    const x0 = side * (width / 2 - 0.1);
    const x1 = side * (width / 2 + 0.75);
    const tri = new THREE.Shape();
    tri.moveTo(x0, -pier);
    tri.lineTo(x1, 0);
    tri.lineTo(x0, pier);
    bk.add(mats.ashlar, new THREE.ExtrudeGeometry(tri, { depth: spring + 0.3 - bed, bevelEnabled: false }), { r: [Math.PI / 2, 0, 0], p: [0, spring + 0.3, 0], uv: 0.5 });
    const cap = new THREE.BufferGeometry();
    const yT = spring + 0.3;
    cap.setAttribute('position', new THREE.Float32BufferAttribute([x0, yT, -pier, x1, yT, 0, x0, yT + 0.7, 0, x1, yT, 0, x0, yT, pier, x0, yT + 0.7, 0], 3));
    const capGeo = side > 0 ? flipTris(cap) : cap;
    capGeo.computeVertexNormals();
    bk.add(mats.dressed, capGeo, { uv: 0.6 });
  }

  // ivy on the parapet ends and trailing down a spandrel
  const r = rng(5);
  for (const [x, y, z, rad] of [
    [width / 2 - 0.1, 0.6, L - 0.4, 0.32],
    [-width / 2 + 0.1, 0.5, -L + 0.5, 0.36],
    [width / 2 + 0.02, 0.25, -1.0, 0.24],
    [width / 2 + 0.02, -0.15, -1.05, 0.2],
    [width / 2 + 0.02, -0.5, -1.0, 0.17],
    [-width / 2 - 0.02, -0.2, 1.3, 0.24],
    [-width / 2 - 0.02, -0.55, 1.25, 0.18],
  ]) bk.add(mats.foliage, blob(rad, { detail: 1, amp: 0.3, freq: 3, seed: Math.round(r() * 99) }), { p: [x, y, z], s: [0.7, 1, 1.2], uv: 3, color: foliageColor(x, y, z, rad, 7) });
  bk.build(g);
  return { group: g, deckHeight: (z) => deck(z) + 0.03, span, width, waterLevel: -0.85 };
}

// Reverse the winding of an unindexed geometry's triangles.
function flipTris(geo) {
  const p = geo.attributes.position.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = p[i + 3 + k];
      p[i + 3 + k] = p[i + 6 + k];
      p[i + 6 + k] = t;
    }
  }
  return geo;
}

// ── trees ──

// A crown of leaf clumps around `centres` ([x, y, z, r]), coloured as one
// crown (darker within and beneath): geometries to merge.
function crownBlobs(centres, { cx, cy, cz, cr, seed = 1, fine = 1.1 }) {
  const shade = foliageColor(cx, cy, cz, cr, seed);
  return centres.map(([x, y, z, rad], i) => {
    const geo = blob(rad, { detail: rad > fine ? 2 : 1, amp: 0.2, freq: 1.4, seed: seed * 31 + i });
    tf(geo, { p: [x, y, z], s: [1, 0.86, 1] });
    return fillColor(boxUV(geo.toNonIndexed(), 0.9), shade);
  });
}

// The Party Tree: a thick, gnarled trunk on flaring roots, great limbs
// spreading into a crown about 14 tall and 7 across, lanterns hanging from
// its low boughs, and a round bench about the trunk.
function partyTree(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'partyTree';
  const bk = parts();
  const r = rng(77);
  bk.add(mats.trunk, tube([[0, -0.4, 0], [0.1, 1.6, 0.05], [-0.05, 3.2, 0.1], [0.15, 4.6, 0]], 0.82, 0.58, { seg: 10, radial: 14, gnarl: 0.3, seed: 3, uvK: 0.6 }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + r() * 0.4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    bk.add(mats.trunk, tube([[c * 0.35, 1.2, s * 0.35], [c * 0.85, 0.35, s * 0.85], [c * 1.38, -0.05, s * 1.38]], 0.42, 0.08, { seg: 5, radial: 7, gnarl: 0.2, seed: 10 + i, uvK: 0.6 }));
  }
  const centres = [];
  const limbs = 7;
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * TAU + r() * 0.5;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const y0 = 3.8 + r() * 0.9;
    const reach = 4.3 + r() * 1.5;
    const p1 = [c * reach * 0.45, y0 + 1.4 + r() * 0.6, s * reach * 0.45];
    const p2 = [c * reach, y0 + 2.6 + r() * 1.6, s * reach];
    bk.add(mats.trunk, tube([[c * 0.2, y0, s * 0.2], p1, p2], 0.42, 0.13, { seg: 8, radial: 8, gnarl: 0.2, seed: 20 + i, uvK: 0.6 }));
    const b = a + (r() - 0.5) * 1.2;
    const p3 = [Math.cos(b) * reach * 0.8, p1[1] + 3.2 + r() * 1.2, Math.sin(b) * reach * 0.8];
    bk.add(mats.trunk, tube([p1, [(p1[0] + p3[0]) / 2, p1[1] + 1.5, (p1[2] + p3[2]) / 2], p3], 0.2, 0.07, { seg: 5, radial: 6, seed: 40 + i, uvK: 0.6 }));
    centres.push([p2[0], p2[1] + 0.6, p2[2], 2.0 + r() * 0.5]);
    centres.push([p3[0], p3[1] + 0.5, p3[2], 1.8 + r() * 0.4]);
    centres.push([c * (reach + 0.9), p2[1] - 0.3, s * (reach + 0.9), 1.4 + r() * 0.3]);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    centres.push([Math.cos(a) * 2.6, 10.6 + r() * 0.8, Math.sin(a) * 2.6, 2.2 + r() * 0.4]);
  }
  centres.push([0, 12.3, 0, 2.5], [0.4, 8.4, -0.2, 2.6]);
  // the low boughs, near level, for the lanterns
  const lanterns = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.9;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const pts = [[c * 0.3, 3.3, s * 0.3], [c * 2.2, 4.1, s * 2.2], [c * 4.6, 4.5, s * 4.6]];
    bk.add(mats.trunk, tube(pts, 0.28, 0.08, { seg: 7, radial: 7, gnarl: 0.15, seed: 60 + i, uvK: 0.6 }));
    centres.push([c * 5.0, 4.9, s * 5.0, 1.15]);
    for (const k of [2.7, 3.9]) {
      const y = 4.1 + (k - 2.2) * 0.17 - 0.12;
      const len = 0.45 + r() * 0.35;
      lanternParts(bk, K, c * k, y - len - 0.26, s * k, 1.7, len);
      lanterns.push(V3(c * k, y - len - 0.26, s * k));
    }
  }
  for (const geo of crownBlobs(centres, { cx: 0, cy: 9.5, cz: 0, cr: 6.5, seed: 8 })) bk.add(mats.foliage, geo);

  // the bench round the trunk
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * TAU + 0.02;
    const a1 = ((i + 1) / segs) * TAU - 0.02;
    bk.add(mats.wood, sector(1.62, 2.06, a0, a1, 0.06, 0.012), { r: [-Math.PI / 2, 0, 0], p: [0, 0.42, 0], uv: 1.4 });
    const am = (a0 + a1) / 2;
    for (const rr of [1.7, 1.98]) bk.add(mats.wood, B(0.07, 0.42, 0.07), { p: [Math.cos(am) * rr, 0.21, -Math.sin(am) * rr], r: [0, am, 0], uv: 1.4 });
  }
  bk.build(g);
  return { group: g, radius: 2.1, trunkRadius: 0.95, lanterns, bench: { radius: 1.84, height: 0.48 } };
}

// Three oaks for instancing: [{ trunk, crown, height }]. Draw the trunks
// with kit.mats.trunk and the crowns (vertex coloured) with kit.mats.crown.
function oaks() {
  const out = [];
  for (const [seed, h, cr] of [
    [3, 5.4, 2.4],
    [5, 6.8, 2.9],
    [8, 8.0, 3.2],
  ]) {
    const r = rng(seed);
    const top = V3((r() - 0.5) * 0.3, h * 0.45, (r() - 0.5) * 0.3);
    const tg = [tube([[0, -0.3, 0], [0.04, h * 0.2, 0.03], top], 0.32, 0.2, { seg: 6, radial: 8, gnarl: 0.2, seed, uvK: 0.6 })];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + r();
      tg.push(tube([[0, -0.1, 0], [Math.cos(a) * 0.45, 0.06, Math.sin(a) * 0.45], [Math.cos(a) * 0.75, -0.08, Math.sin(a) * 0.75]], 0.2, 0.05, { seg: 3, radial: 5, uvK: 0.6 }));
    }
    const centres = [[0, h * 0.7, 0, cr * 0.8]];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + r() * 0.6;
      const end = [Math.cos(a) * cr * 0.6, h * (0.6 + r() * 0.12), Math.sin(a) * cr * 0.6];
      tg.push(tube([top, [end[0] * 0.5, (top.y + end[1]) / 2 + 0.3, end[2] * 0.5], end], 0.15, 0.06, { seg: 4, radial: 5, uvK: 0.6 }));
      centres.push([end[0], end[1] + 0.2, end[2], cr * (0.55 + r() * 0.12)]);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 1 + r();
      centres.push([Math.cos(a) * cr * 0.4, h * (0.82 + r() * 0.06), Math.sin(a) * cr * 0.4, cr * 0.42]);
    }
    centres.push([0, h - cr * 0.45, 0, cr * 0.48]);
    out.push({
      trunk: mergeAll(tg),
      crown: mergeAll(crownBlobs(centres, { cx: 0, cy: h * 0.72, cz: 0, cr: cr * 1.1, seed: seed + 3, fine: cr * 0.7 }), { colors: true }),
      height: h,
    });
  }
  return out;
}

// The old tree by the East Road: a huge trunk on a grassy bank, its roots
// arching over a hollow dug in the bank's front (+z), roofed with turf and
// hung with rootlets, about 1.3 high inside; big enough for four hobbits
// to hide under.
function rootTree(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'rootTree';
  const bk = parts();
  const n = makeNoise(91);
  const r = rng(91);

  // the bank: a heightfield over a disc, with a hollow cut in its front
  const RB = 4.2;
  const HB = 1.7;
  const rings = 18;
  const segs = 48;
  const pos = [];
  const col = [];
  const idx = [];
  const turf = new THREE.Color(0xd8e0b0);
  const foot = new THREE.Color(0x8c9c6c);
  const earth = new THREE.Color(0x4a3524);
  const k = new THREE.Color();
  for (let i = 0; i <= rings; i++) {
    for (let j = 0; j <= segs; j++) {
      const rho = (i / rings) * RB;
      const a = (j / segs) * TAU;
      const x = Math.cos(a) * rho;
      const z = Math.sin(a) * rho;
      let y = HB * Math.pow(Math.max(0, 1 - (rho / RB) ** 2), 0.65) + (fbm(n, x * 0.6, z * 0.6, { octaves: 3 }) - 0.5) * 0.3 * (1 - rho / RB);
      const carve = smooth(1.25, 0.75, Math.abs(x)) * smooth(0.35, 0.95, z) * smooth(3.4, 2.6, z);
      y = mix(y, 0.02, carve);
      pos.push(x, Math.max(0, y), z);
      k.lerpColors(foot, turf, clamp01(y / HB + (n(x, z) - 0.5) * 0.4)).lerp(earth, smooth(0.2, 0.7, carve));
      col.push(k.r, k.g, k.b);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j;
      const b = a + segs + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const bank = new THREE.BufferGeometry();
  bank.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bank.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const uvs = [];
  for (let i = 0; i < pos.length; i += 3) uvs.push(pos[i] * 0.32, pos[i + 2] * 0.32);
  bank.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  bank.setIndex(idx);
  bank.computeVertexNormals();
  bk.add(mats.turf, bank);

  // the hollow's roof: a slab of turf over it, dark earth beneath
  const lid = sector(1.15, 1.42, 0.42, Math.PI - 0.42, 1.75, 0.04);
  const lp = lid.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const x = lp.getX(i);
    const y = lp.getY(i);
    const z = lp.getZ(i);
    const ragged = z > 1.6 ? (n(x * 5, 3) - 0.5) * 0.3 : 0;
    lp.setXYZ(i, x * 1.05, y + (n(x * 2, z * 2) - 0.5) * 0.08, z + ragged);
  }
  lid.computeVertexNormals();
  const lidGeo = lid;
  fillColor(lidGeo, (x, y) => k.copy(y > 0.9 ? foot : earth));
  const ln = lidGeo.attributes.normal;
  const lc = lidGeo.attributes.color;
  for (let i = 0; i < ln.count; i++) if (ln.getY(i) < 0.2) lc.setXYZ(i, earth.r, earth.g, earth.b);
  bk.add(mats.turf, lidGeo, { p: [0, 0.25, 0.55] });

  // the trunk, enormous and gnarled, and its limbs
  bk.add(mats.trunk, tube([[0, 0.2, -0.1], [0.12, 2.6, -0.2], [-0.1, 4.6, -0.05], [0.12, 6.2, -0.2]], 1.05, 0.72, { seg: 10, radial: 14, gnarl: 0.32, seed: 5, uvK: 0.6 }));
  const centres = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.4 + r() * 0.4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const reach = 3.8 + r() * 1.4;
    const p1 = [c * reach * 0.45, 7.0 + r(), s * reach * 0.45];
    const p2 = [c * reach, 8.2 + r() * 1.2, s * reach];
    bk.add(mats.trunk, tube([[c * 0.3, 5.4, s * 0.3], p1, p2], 0.42, 0.13, { seg: 7, radial: 8, gnarl: 0.2, seed: 70 + i, uvK: 0.6 }));
    centres.push([p2[0], p2[1] + 0.5, p2[2], 1.9 + r() * 0.4], [p1[0], p1[1] + 1.6, p1[2], 1.7 + r() * 0.3]);
  }
  centres.push([0, 11.0, 0, 2.4], [0.3, 9.0, 0.4, 2.2]);
  for (const geo of crownBlobs(centres, { cx: 0, cy: 9.2, cz: 0, cr: 5.5, seed: 12 })) bk.add(mats.foliage, geo);

  // the roots: arching over the hollow and down its sides, spreading over
  // the bank, one across the mouth, and rootlets hanging from that
  const roots = [
    [[[-0.5, 1.6, 0.3], [-0.85, 1.95, 1.2], [-1.15, 1.3, 2.1], [-1.35, 0.0, 2.45]], 0.32, 0.12],
    [[[0.5, 1.6, 0.3], [0.85, 1.95, 1.2], [1.15, 1.3, 2.1], [1.35, 0.0, 2.45]], 0.32, 0.12],
    [[[0, 1.7, 0.6], [0.05, 1.85, 1.5], [0, 1.62, 2.2]], 0.26, 0.14],
    [[[-0.3, 1.75, 0.5], [-0.45, 1.86, 1.3], [-0.62, 1.72, 2.1], [-0.9, 1.4, 2.3]], 0.2, 0.1],
    [[[0.3, 1.75, 0.5], [0.42, 1.88, 1.4], [0.6, 1.7, 2.15], [0.95, 1.35, 2.3]], 0.2, 0.1],
    [[[-1.3, 1.25, 2.0], [-0.5, 1.6, 2.28], [0.5, 1.58, 2.28], [1.3, 1.25, 2.0]], 0.2, 0.18],
    [[[-0.8, 1.3, 0.0], [-1.9, 1.1, 0.4], [-2.9, 0.2, 0.9], [-3.4, -0.05, 1.0]], 0.36, 0.1],
    [[[0.8, 1.3, 0.0], [1.9, 1.15, 0.5], [2.8, 0.25, 0.9], [3.4, -0.05, 1.1]], 0.36, 0.1],
    [[[-0.6, 1.3, -0.6], [-1.6, 1.2, -1.4], [-2.6, 0.3, -2.4], [-3.0, -0.05, -2.8]], 0.36, 0.1],
    [[[0.6, 1.3, -0.7], [1.4, 1.2, -1.7], [2.2, 0.4, -2.9], [2.5, -0.05, -3.4]], 0.34, 0.1],
  ];
  roots.forEach(([pts, r0, r1], i) => bk.add(mats.trunk, tube(pts, r0, r1, { seg: 9, radial: 7, gnarl: 0.25, seed: 80 + i, uvK: 0.6 })));
  for (let i = 0; i < 7; i++) {
    const x = -0.9 + (i / 6) * 1.8 + (r() - 0.5) * 0.15;
    const top = 1.5 + Math.cos((x / 1.3) * 1.2) * 0.05;
    const len = 0.25 + r() * 0.4;
    bk.add(mats.trunk, tube([[x, top, 2.25], [x + (r() - 0.5) * 0.12, top - len * 0.6, 2.3], [x + (r() - 0.5) * 0.2, top - len, 2.28]], 0.035, 0.008, { seg: 4, radial: 4, uvK: 0.6 }));
  }
  // ferns and grass at the mouth
  for (const [x, z] of [
    [-1.6, 2.6],
    [1.7, 2.5],
    [-2.3, 1.9],
  ]) bush(bk, K, x, 0, z, 0.42, Math.round(x * 10 + 40), 0);
  bk.build(g);
  return {
    group: g,
    hollow: V3(0, 0, 1.35),
    radius: 1.1,
    bankRadius: RB,
    colliders: [
      { x: 0, z: -0.2, r: 1.25 },
      { x: -2.1, z: 0.9, r: 0.9 },
      { x: 2.1, z: 0.9, r: 0.9 },
      { x: 0, z: -2.2, r: 1.6 },
    ],
  };
}

// ── the party ──

// The pavilion: a white canvas marquee peaked on two king poles, open at
// the sides under a scalloped valance, with bunting along its ridge,
// strings of lanterns along its eaves, and long tables set underneath with
// tankards, bread and a cake.
function pavilion(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'pavilion';
  const bk = parts();
  const r = rng(33);
  const w = 10;
  const d = 6.4;
  const eave = 2.5;
  const peak = 4.4;
  const kx = 2.5;
  const roofY = (x, z) => {
    const f = 1 - Math.max(Math.abs(z) / (d / 2), Math.max(0, Math.abs(x) - kx) / (w / 2 - kx));
    const ff = clamp01(f);
    let y = eave + (peak - eave) * ff - 0.22 * Math.sin(Math.PI * ff);
    y += 0.5 * Math.exp(-((Math.abs(x) - kx) ** 2 + z * z) / 0.3);
    y -= 0.1 * Math.pow(1 - ff, 6) * Math.abs(Math.sin((Math.PI * x) / kx));
    return y;
  };
  // the roof: a grid over the whole marquee
  const NX = 24;
  const NZ = 14;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= NZ; i++) {
    for (let j = 0; j <= NX; j++) {
      const x = -w / 2 + (j / NX) * w;
      const z = -d / 2 + (i / NZ) * d;
      pos.push(x, roofY(x, z), z);
    }
  }
  for (let i = 0; i < NZ; i++) {
    for (let j = 0; j < NX; j++) {
      const a = i * (NX + 1) + j;
      const b = a + NX + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roof.setIndex(idx);
  roof.computeVertexNormals();
  bk.add(mats.canvas, roof, { uv: 0.35 });

  // the valance: scallops hanging all round the edge, a gold band on top
  const perim = [];
  const step = 0.2;
  const edge = [
    [-w / 2, d / 2, w / 2, d / 2],
    [w / 2, d / 2, w / 2, -d / 2],
    [w / 2, -d / 2, -w / 2, -d / 2],
    [-w / 2, -d / 2, -w / 2, d / 2],
  ];
  for (const [x0, z0, x1, z1] of edge) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const m = Math.round(len / step);
    for (let i = 0; i < m; i++) perim.push([mix(x0, x1, i / m), mix(z0, z1, i / m), i * step]);
  }
  perim.push([perim[0][0], perim[0][1], 0]);
  const vp = [];
  const vc = [];
  const vi = [];
  const gold = new THREE.Color(0xd9a93a);
  const white = new THREE.Color(0xfbf7ee);
  perim.forEach(([x, z, s], i) => {
    const y = roofY(x * 0.999, z * 0.999);
    const ph = (s % 0.8) / 0.8;
    const drop = 0.26 + 0.18 * Math.sqrt(Math.max(0, 1 - (ph * 2 - 1) ** 2));
    vp.push(x, y + 0.02, z, x, y - 0.07, z, x, y - 0.075, z, x, y - drop, z);
    vc.push(gold.r, gold.g, gold.b, gold.r, gold.g, gold.b, white.r, white.g, white.b, white.r, white.g, white.b);
    if (i) {
      const a = (i - 1) * 4;
      const b = i * 4;
      for (let k = 0; k < 3; k++) vi.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
    }
  });
  const val = new THREE.BufferGeometry();
  val.setAttribute('position', new THREE.Float32BufferAttribute(vp, 3));
  val.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3));
  val.setIndex(vi);
  val.computeVertexNormals();
  bk.add(mats.cloth, val);

  // poles, guy ropes and pegs, finials and pennants on the king poles
  const poles = [];
  for (const x of [-w / 2, -kx, 0, kx, w / 2]) for (const z of [-d / 2, d / 2]) poles.push([x, z]);
  poles.push([-w / 2, 0], [w / 2, 0]);
  for (const [x, z] of poles) {
    const y = roofY(x * 0.999, z * 0.999);
    bk.add(mats.wood, cyl(0.055, 0.065, y + 0.12, 7), { p: [x, (y + 0.12) / 2, z], uv: 1.5 });
    bk.add(mats.wood, new THREE.ConeGeometry(0.08, 0.14, 6), { p: [x, y + 0.18, z] });
    const ox = Math.abs(x) > w / 2 - 0.1 ? Math.sign(x) * 1.4 : 0;
    const oz = Math.abs(x) > w / 2 - 0.1 && Math.abs(z) < 0.1 ? 0 : Math.sign(z) * 1.4;
    bk.add(mats.rope, tube([[x, y + 0.08, z], [x + ox * 0.5, y * 0.48, z + oz * 0.5], [x + ox, 0.08, z + oz]], 0.012, 0.012, { seg: 2, radial: 3 }));
    bk.add(mats.wood, B(0.05, 0.25, 0.05), { p: [x + ox, 0.08, z + oz], r: [Math.sign(oz) * 0.3, 0, -Math.sign(ox) * 0.3] });
  }
  for (const s of [-1, 1]) {
    const x = s * kx;
    const y = roofY(x, 0);
    bk.add(mats.wood, cyl(0.07, 0.08, y + 0.6, 8), { p: [x, (y + 0.6) / 2, 0], uv: 1.5 });
    bk.add(K.paint(0xd9a93a), ball(0.1, 10, 8), { p: [x, y + 0.66, 0] });
    const flag = new THREE.BufferGeometry();
    flag.setAttribute('position', new THREE.Float32BufferAttribute([x, y + 0.55, 0, x + 0.7 * s, y + 0.42, 0.04, x, y + 0.3, 0], 3));
    bk.add(mats.cloth, flag, { color: s > 0 ? 0xc8402e : 0x3a6ab0 });
  }
  // bunting between the king poles
  const flags = 14;
  for (let i = 0; i < flags; i++) {
    const t0 = (i + 0.15) / flags;
    const t1 = (i + 0.85) / flags;
    const at = (t) => [mix(-kx, kx, t), roofY(kx, 0) + 0.45 - Math.sin(Math.PI * t) * 0.35];
    const [x0, y0] = at(t0);
    const [x1, y1] = at(t1);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([x0, y0, 0, x1, y1, 0, (x0 + x1) / 2, (y0 + y1) / 2 - 0.26, 0.02], 3));
    bk.add(mats.cloth, tri, { color: BLOOMS[i % BLOOMS.length] });
  }
  const bunt = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    bunt.push([mix(-kx, kx, t), roofY(kx, 0) + 0.45 - Math.sin(Math.PI * t) * 0.35, 0]);
  }
  bk.add(mats.rope, tube(bunt, 0.01, 0.01, { seg: 16, radial: 3 }));

  // lanterns strung along the long eaves
  const lanterns = [];
  for (const z of [-d / 2 - 0.12, d / 2 + 0.12]) {
    const xs = [-w / 2, -kx, 0, kx, w / 2];
    for (let i = 0; i < xs.length - 1; i++) {
      const xa = xs[i];
      const xb = xs[i + 1];
      const ya = roofY(xa * 0.999, Math.sign(z) * d * 0.4995) + 0.05;
      const yb = roofY(xb * 0.999, Math.sign(z) * d * 0.4995) + 0.05;
      const line = (t) => [mix(xa, xb, t), mix(ya, yb, t) - Math.sin(Math.PI * t) * 0.32, z];
      bk.add(mats.rope, tube([line(0), line(0.25), line(0.5), line(0.75), line(1)], 0.008, 0.008, { seg: 8, radial: 3 }));
      for (const t of [1 / 3, 2 / 3]) {
        const [x, y] = line(t);
        lanternParts(bk, K, x, y - 0.24, z, 0.9, 0.08);
        lanterns.push(V3(x, y - 0.24, z));
      }
    }
  }

  // two long tables on trestles, benches either side, and the feast
  const food = mats.food;
  for (const tz of [-1.3, 1.3]) {
    bk.add(mats.wood, roundBox(7.6, 0.07, 0.9, 0.02), { p: [0, 0.68, tz], uv: 1.4 });
    for (const x of [-3.3, 0, 3.3]) {
      for (const s of [-1, 1]) bk.add(mats.wood, B(0.07, 0.72, 0.07), { p: [x, 0.33, tz + s * 0.25], r: [s * 0.32, 0, 0], uv: 1.4 });
      bk.add(mats.wood, B(0.07, 0.07, 0.75), { p: [x, 0.62, tz], uv: 1.4 });
    }
    for (const s of [-1, 1]) {
      bk.add(mats.wood, roundBox(7.2, 0.06, 0.3, 0.015), { p: [0, 0.42, tz + s * 0.72], uv: 1.4 });
      for (const x of [-3.2, 0, 3.2]) bk.add(mats.wood, B(0.24, 0.39, 0.06), { p: [x, 0.195, tz + s * 0.72], uv: 1.4 });
    }
    for (let i = 0; i < 6; i++) {
      const x = -3.2 + i * 1.28 + (r() - 0.5) * 0.3;
      const z = tz + (i % 2 ? 0.26 : -0.26);
      bk.add(mats.pewter, lathe([[0.001, 0], [0.065, 0], [0.062, 0.17], [0.05, 0.17], [0.045, 0.03]], 6), { p: [x, 0.715, z] });
      bk.add(mats.pewter, new THREE.TorusGeometry(0.045, 0.011, 3, 6, Math.PI), { p: [x + 0.065, 0.8, z], r: [0, 0, -Math.PI / 2] });
      bk.add(food, cyl(0.12, 0.1, 0.02, 8), { p: [x + 0.35, 0.725, z], color: 0xf4efe2 });
    }
    for (let i = 0; i < 3; i++) bk.add(food, blob(0.12, { detail: 1, amp: 0.1, seed: i + 3 }), { p: [-2.6 + i * 2.4, 0.78, tz], s: [1.5, 0.75, 1], color: 0xb8742e });
    for (let i = 0; i < 6; i++) bk.add(food, ball(0.045, 5, 3), { p: [-1.2 + (r() - 0.5) * 0.3, 0.76, tz + (r() - 0.5) * 0.3], color: r() < 0.5 ? 0xc8352a : 0x8fbf3a });
  }
  // the cake, three tiers
  for (const [rad, h, y] of [
    [0.32, 0.18, 0.715],
    [0.24, 0.16, 0.895],
    [0.15, 0.14, 1.055],
  ]) {
    bk.add(food, cyl(rad, rad, h, 14), { p: [1.2, y + h / 2, 1.3], color: 0xfaf3e4 });
    bk.add(food, new THREE.TorusGeometry(rad, 0.022, 3, 14), { p: [1.2, y + h, 1.3], r: [Math.PI / 2, 0, 0], color: 0xf29ab8 });
  }
  bk.add(food, ball(0.04, 8, 6), { p: [1.2, 1.24, 1.3], color: 0xc8352a });
  bk.build(g);
  return { group: g, lanterns, footprint: { w: w + 0.2, d: d + 0.2 } };
}

// Gandalf's cart, its shafts to +x: two big spoked wheels, a plank bed with
// a driver's seat, piled with crates (one with his G-rune on it) and
// paper-wrapped rockets in bright colours.
function cart(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'cart';
  const bk = parts();
  const r = rng(19);
  const bedY = 0.95;
  // wheels
  for (const s of [-1, 1]) {
    const z = s * 0.86;
    bk.add(mats.wood, ringGeo(0.5, 0.62, 0.09, 32), { p: [-0.25, 0.62, z - 0.045], uv: 1.4 });
    bk.add(mats.iron, new THREE.TorusGeometry(0.62, 0.025, 5, 32), { p: [-0.25, 0.62, z] });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      bk.add(mats.wood, B(0.52, 0.05, 0.045), { p: [-0.25 + Math.cos(a) * 0.28, 0.62 + Math.sin(a) * 0.28, z], r: [0, 0, a], uv: 1.4 });
    }
    bk.add(mats.wood, cylZ(0.1, 0.24, 10), { p: [-0.25, 0.62, z] });
  }
  bk.add(mats.iron, cylZ(0.04, 1.9, 8), { p: [-0.25, 0.62, 0] });
  // the bed, sides, stakes, under-beams
  bk.add(mats.wood, roundBox(2.6, 0.08, 1.45, 0.02), { p: [0.05, bedY, 0], uv: 1.2 });
  for (const s of [-1, 1]) {
    bk.add(mats.wood, roundBox(2.6, 0.3, 0.05, 0.015), { p: [0.05, bedY + 0.19, s * 0.72], uv: 1.2 });
    bk.add(mats.timber, B(2.7, 0.1, 0.1), { p: [0.05, bedY - 0.09, s * 0.45], uv: 1.2 });
    for (const x of [-1.15, -0.4, 0.4, 1.15]) bk.add(mats.timber, B(0.06, 0.42, 0.06), { p: [x, bedY + 0.16, s * 0.75], uv: 1.2 });
  }
  for (const e of [-1, 1]) bk.add(mats.wood, roundBox(0.05, 0.3, 1.45, 0.015), { p: [0.05 + e * 1.3, bedY + 0.19, 0], uv: 1.2 });
  // the driver's seat
  bk.add(mats.wood, roundBox(0.36, 0.06, 1.3, 0.02), { p: [0.95, bedY + 0.42, 0], uv: 1.2 });
  for (const s of [-1, 1]) bk.add(mats.wood, B(0.3, 0.38, 0.06), { p: [0.95, bedY + 0.21, s * 0.6], uv: 1.2 });
  // shafts down to the ground in front
  for (const s of [-1, 1]) bk.add(mats.wood, tube([[1.1, bedY - 0.05, s * 0.5], [2.2, 0.55, s * 0.48], [3.25, 0.06, s * 0.45]], 0.045, 0.035, { seg: 6, radial: 6 }));
  bk.add(mats.wood, cylZ(0.035, 1.0, 6), { p: [1.6, 0.73, 0] });

  // the crates
  const plain = new THREE.MeshStandardMaterial({ map: canvasTexture(crateCanvas(false), K.renderer, { wrap: false }), roughness: 0.85 });
  const runed = new THREE.MeshStandardMaterial({ map: canvasTexture(crateCanvas(true), K.renderer, { wrap: false }), roughness: 0.85 });
  for (const [x, y, z, sz, m, ry] of [
    [-0.8, 0, 0.32, 0.62, runed, 0.05],
    [-0.8, 0, -0.33, 0.6, plain, -0.08],
    [-0.1, 0, 0.36, 0.52, plain, 0.12],
    [-0.75, 0.62, 0.0, 0.55, runed, 0.3],
  ]) bk.add(m, B(sz, sz, sz), { p: [x, bedY + 0.04 + y + sz / 2, z], r: [0, ry, 0] });

  // rockets: paper tubes banded white, cone tips, sticks; some standing in
  // a crate, two big ones lying across the top
  const paper = [0xc8402e, 0x3456a8, 0x3f8f4a, 0xe8b83a, 0x7a4a9a, 0xe0703a];
  const rocket = (len, rad, color, o) => {
    const c = new THREE.Color(color);
    const band = new THREE.Color(0xf6efe0);
    const body = cyl(rad, rad, len, 8);
    fillColor(body, (x, y, z, out) => out.copy(Math.sin((y / len) * 26) > 0.72 ? band : c));
    tf(body, { p: [0, len / 2, 0] });
    const tip = tf(new THREE.ConeGeometry(rad * 1.25, rad * 3, 8), { p: [0, len + rad * 1.5, 0] });
    fillColor(tip, (x, y, z, out) => out.copy(c).multiplyScalar(0.8));
    bk.add(mats.paper, body, o);
    bk.add(mats.paper, tip, o);
    bk.add(mats.wood, tf(cyl(0.012, 0.012, len * 1.3, 4), { p: [rad + 0.01, -len * 0.45, 0] }), o);
  };
  bk.add(mats.wood, roundBox(0.6, 0.3, 0.62, 0.02), { p: [0.45, bedY + 0.19, -0.3], uv: 1.2 });
  for (let i = 0; i < 9; i++) {
    const x = 0.3 + (i % 3) * 0.14;
    const z = -0.45 + Math.floor(i / 3) * 0.15;
    rocket(0.45 + r() * 0.25, 0.04 + r() * 0.015, paper[i % paper.length], { r: [(z + 0.3) * 0.8, 0, -(x - 0.45) * 0.9], p: [x, bedY + 0.42, z] });
  }
  rocket(1.2, 0.07, 0xc8402e, { r: [0, 0.2, Math.PI / 2 - 0.15], p: [-0.25, bedY + 0.62, 0.05] });
  rocket(1.0, 0.06, 0x3456a8, { r: [0.1, -0.3, Math.PI / 2 - 0.05], p: [0.2, bedY + 0.62, -0.42] });
  bk.build(g);
  return { group: g, seat: V3(0.95, bedY + 0.45, 0) };
}

// ── creatures ──

// A sheep, facing +x: a bobbled fleece, a dark face with drooping ears,
// thin dark legs. Each leg's group pivots at the hip; rotation.z swings it.
function sheep(K, { seed = 1 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'sheep';
  const bk = parts();
  bk.add(mats.wool, blob(1, { detail: 3, amp: 0.07, freq: 7, seed }), { p: [0, 0.7, 0], s: [0.58, 0.42, 0.42], uv: 3 });
  bk.add(mats.wool, blob(0.12, { detail: 1, amp: 0.2, freq: 5, seed: seed + 1 }), { p: [-0.58, 0.78, 0] });
  for (const [x, z] of [
    [0.3, 0.15],
    [0.3, -0.15],
    [-0.3, 0.15],
    [-0.3, -0.15],
  ]) bk.add(mats.wool, blob(0.12, { detail: 1, amp: 0.2, freq: 5, seed: seed + 7 }), { p: [x, 0.42, z] });
  bk.build(g);
  const dark = 0x2a2420;
  const legs = [];
  for (const [x, z] of [
    [0.3, 0.14],
    [0.3, -0.14],
    [-0.3, 0.14],
    [-0.3, -0.14],
  ]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.48, z);
    g.add(hip);
    const lk = parts();
    lk.add(mats.beast, cyl(0.04, 0.032, 0.44, 6), { p: [0, -0.22, 0], color: dark });
    lk.add(mats.beast, cyl(0.04, 0.045, 0.06, 6), { p: [0, -0.45, 0], color: 0x161210 });
    lk.build(hip);
    legs.push(hip);
  }
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.55, 0.85, 0);
  g.add(head);
  const hk = parts();
  hk.add(mats.beast, ball(0.13, 12, 10), { p: [0.08, -0.04, 0], s: [1.45, 1, 0.82], r: [0, 0, -0.45], color: dark });
  for (const s of [-1, 1]) {
    hk.add(mats.beast, ball(0.07, 8, 6), { p: [-0.0, 0.0, s * 0.13], s: [0.7, 0.35, 1.3], r: [s * 0.4, 0, -0.3], color: dark });
    hk.add(mats.beast, ball(0.022, 6, 5), { p: [0.11, 0.035, s * 0.08], color: 0xc9a050 });
  }
  hk.add(mats.beast, ball(0.03, 6, 5), { p: [0.24, -0.13, 0], color: 0x15100e });
  hk.add(mats.wool, blob(0.11, { detail: 1, amp: 0.25, freq: 5, seed: seed + 3 }), { p: [-0.04, 0.08, 0] });
  hk.build(head);

  // How it moves (../creatures.js): its legs from the ground it covers, read
  // from where the scene puts it, a sheep's ambling walk and a trot when it's
  // startled; standing, its head goes down to graze (`graze` to say so
  // instead).
  const track = createTracker();
  const stride = createStride({ stride: 0.62, hz: 1.1, longest: 1.4, cadence: [1.2, 1.9], seed });
  const LEG = 0.47;
  let grazing = 0;
  const animate = (t, { graze } = {}) => {
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = stride.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const offs = gaitOffsets(st.run, WALK, TROT);
    const stance = mix(STANCE.walk, STANCE.trot, st.run);
    legs.forEach((hip, j) => {
      const { angle, lift } = legSwing(st.cycle + offs[j], stance, stance * st.stride, LEG);
      hip.rotation.z = angle * st.amount;
      hip.scale.y = 1 - 0.14 * lift * st.amount;
    });
    grazing = ease(grazing, (graze ?? st.amount < 0.05) ? 1 : 0, m.dt, 1.6);
    head.rotation.z = mix(Math.sin(st.phase * 2) * 0.05 * st.amount, -0.5 + Math.sin(t * 2 + seed) * 0.1, grazing);
    head.rotation.y = (1 - grazing) * (1 - st.amount) * Math.sin(t * 0.45 + seed * 1.7) * 0.25;
  };
  return { group: g, legs, head, animate };
}

// A farm dog, facing +x (Maggot's Grip, Fang and Wolf: give each a coat): a
// deep-chested body, legs pivoted at the hips, a head with pricked ears and
// a long snout, a tail pivoted at its root.
function dog(K, { coat = 0x7a5232, patch = 0xeee4d0, seed = 1 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'dog';
  const c0 = new THREE.Color(coat);
  const c1 = new THREE.Color(patch);
  const n = makeNoise(seed);
  const bk = parts();
  const body = lathe([[0.001, -0.37], [0.1, -0.35], [0.14, -0.26], [0.145, -0.05], [0.165, 0.14], [0.15, 0.3], [0.1, 0.38], [0.001, 0.4]], 12);
  tf(body, { r: [0, 0, -Math.PI / 2], s: [1, 1.08, 0.85], p: [0, 0.5, 0] });
  fillColor(body, (x, y, z, out) => out.copy(y < 0.43 && x > -0.1 ? c1 : c0).lerp(c1, n(x * 6, z * 6) > 0.7 ? 0.5 : 0));
  bk.add(mats.beast, body);
  bk.build(g);
  const legs = [];
  for (const [x, z] of [
    [0.24, 0.08],
    [0.24, -0.08],
    [-0.25, 0.08],
    [-0.25, -0.08],
  ]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.45, z);
    g.add(hip);
    const lk = parts();
    lk.add(mats.beast, tube([[0, 0.02, 0], [x < 0 ? -0.04 : 0.02, -0.22, 0], [0.01, -0.41, 0]], 0.05, 0.03, { seg: 4, radial: 6 }), { color: c0 });
    lk.add(mats.beast, ball(0.04, 8, 6), { p: [0.025, -0.425, 0], s: [1.4, 0.6, 1], color: c1 });
    lk.build(hip);
    legs.push(hip);
  }
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.38, 0.62, 0);
  g.add(head);
  const hk = parts();
  hk.add(mats.beast, ball(0.115, 12, 10), { s: [1.1, 1, 0.95], color: c0 });
  hk.add(mats.beast, lathe([[0.065, 0], [0.055, 0.08], [0.04, 0.15], [0.001, 0.16]], 8), { r: [0, 0, -Math.PI / 2 - 0.15], p: [0.06, -0.03, 0], color: c1 });
  hk.add(mats.beast, ball(0.025, 6, 5), { p: [0.225, 0.0, 0], color: 0x111111 });
  hk.add(mats.beast, ball(0.03, 6, 4), { p: [0.15, -0.075, 0], s: [1.4, 0.4, 0.8], color: 0xd06a72 });
  for (const s of [-1, 1]) {
    hk.add(mats.beast, new THREE.ConeGeometry(0.045, 0.11, 5), { p: [-0.02, 0.12, s * 0.06], r: [s * 0.35, 0, 0.15], s: [1, 1, 0.5], color: c0 });
    hk.add(mats.beast, ball(0.018, 6, 5), { p: [0.085, 0.04, s * 0.055], color: 0x111111 });
  }
  hk.build(head);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.38, 0.56, 0);
  g.add(tail);
  const tk = parts();
  tk.add(mats.beast, tube([[0, 0, 0], [-0.12, 0.06, 0], [-0.2, 0.18, 0], [-0.22, 0.26, 0]], 0.04, 0.018, { seg: 6, radial: 5 }), { color: (x, y, z, out) => out.copy(y > 0.2 ? c1 : c0) });
  tk.build(tail);

  // How it moves (../creatures.js): its legs from the ground it covers, read
  // from where the scene puts it, a trot on its rounds lengthening into a
  // gallop after you. `mode` is its watcher's (../towns/watchers.js): ears
  // up and barking on the alert, nose down and tail out giving chase, nose
  // to the ground casting about on a search; `look` turns its head.
  const track = createTracker();
  const stride = createStride({ stride: 1.08, hz: 1.6, longest: 1.5, cadence: [1.9, 2.9], seed });
  const LEG = 0.45;
  const A = { look: 0, sniff: 0, bark: 0, chase: 0, wag: seed * 1.3 };
  const animate = (t, { mode = 'patrol', look = 0 } = {}) => {
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const dt = m.dt;
    const st = stride.step(dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const offs = gaitOffsets(st.run, TROT);
    const stance = mix(STANCE.trot, STANCE.gallop, st.run);
    legs.forEach((hip, j) => {
      const { angle, lift } = legSwing(st.cycle + offs[j], stance, stance * st.stride, LEG);
      hip.rotation.z = angle * st.amount;
      hip.scale.y = 1 - 0.16 * lift * st.amount;
    });
    A.look = ease(A.look, look, dt, 8);
    A.sniff = ease(A.sniff, mode === 'search' || mode === 'suspicious' ? 1 : 0, dt, 4);
    A.bark = ease(A.bark, mode === 'alert' ? 1 : 0, dt, 10);
    A.chase = ease(A.chase, mode === 'chase' ? 1 : 0, dt, 5);
    // the tail wags quicker and higher the keener it is
    const keen = Math.max(A.bark, A.chase, A.sniff * 0.6);
    A.wag += dt * (7 + 11 * keen);
    tail.rotation.y = Math.sin(A.wag) * (0.25 + 0.3 * keen) * (1 - 0.6 * A.chase);
    tail.rotation.z = -0.3 * A.chase + 0.12 * A.sniff;
    const cast = Math.sin(t * 3.1 + seed) * 0.45 + Math.sin(t * 7.3 + seed) * 0.1;
    head.rotation.y = A.look * (1 - A.sniff) + A.sniff * cast;
    head.rotation.z = -0.45 * A.sniff - 0.18 * A.chase + A.bark * (0.2 + Math.max(0, Math.sin(t * 13)) * 0.15) + Math.sin(st.phase * 2) * 0.04 * st.amount;
  };
  return { group: g, legs, head, tail, animate };
}

// A Black Rider, facing +x: a tall black horse (about 1.9 at the withers)
// in black barding with a ragged hem and a steel chanfron, its mane and tail
// long; on it a Nazgûl in a hooded, tattered black robe, steel gauntlets on
// the reins, and nothing but dark inside the hood. About 3.4 tall.
function blackRider(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'blackRider';
  const n = makeNoise(66);
  const horse = new THREE.Group();
  horse.name = 'horse';
  g.add(horse);
  const hb = parts();
  const cy = 1.42;
  hb.add(mats.hide, lathe([[0.001, -1.08], [0.2, -1.04], [0.34, -0.9], [0.41, -0.62], [0.42, -0.3], [0.4, 0.05], [0.42, 0.4], [0.43, 0.65], [0.38, 0.88], [0.26, 1.02], [0.001, 1.06]], 12), { r: [0, 0, -Math.PI / 2], s: [1, 1, 0.8], p: [0, cy, 0] });
  hb.add(mats.hide, ball(0.4, 8, 6), { p: [-0.65, cy + 0.1, 0], s: [1.1, 1, 0.82] });
  hb.add(mats.hide, ball(0.32, 8, 6), { p: [0.6, cy + 0.2, 0], s: [1.2, 1, 0.8] });
  // the barding: draped over the back, hanging in folds and tatters to
  // mid-leg, flaring a little as it falls
  const cols = 14;
  const rows = 14;
  const bp = [];
  const bi = [];
  for (let i = 0; i <= cols; i++) {
    const u = i / cols;
    const x = -0.98 + u * 1.86;
    const rad = 0.4 + 0.07 * Math.sin(Math.PI * u) + (u < 0.25 ? 0.03 : 0);
    const fold = Math.sin(i * 2.1) * 0.035;
    for (let j = 0; j <= rows; j++) {
      const t = (j / rows) * 2 - 1;
      const side = Math.sign(t) || 1;
      let y;
      let z;
      if (Math.abs(t) <= 0.7) {
        const a = (Math.abs(t) / 0.7) * (Math.PI / 2);
        y = cy + Math.cos(a) * rad * 1.04;
        z = side * Math.sin(a) * (rad * 0.86 + fold * Math.sin(a));
      } else {
        const k = (Math.abs(t) - 0.7) / 0.3;
        const tatter = (i % 3 === 0 ? 0.26 : i % 3 === 1 ? 0.08 : 0.16) * k * k;
        const hem = 0.58 + tatter + (n(i * 1.7, side * 3) - 0.5) * 0.14 - 0.1 * Math.abs(u - 0.5);
        y = cy - k * hem;
        z = side * (rad * 0.86 + fold + k * 0.12);
      }
      bp.push(x, y, z);
    }
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = a + rows + 1;
      bi.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const bard = new THREE.BufferGeometry();
  bard.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  bard.setIndex(bi);
  bard.computeVertexNormals();
  hb.add(mats.robe, bard);
  hb.build(horse);

  // legs: long, the hind ones bent at the hock, black hooves and feathers
  const legs = [];
  for (const [x, z, hind] of [
    [0.68, 0.19, false],
    [0.68, -0.19, false],
    [-0.72, 0.2, true],
    [-0.72, -0.2, true],
  ]) {
    const hip = new THREE.Group();
    hip.position.set(x, 1.32, z);
    horse.add(hip);
    const lk = parts();
    const pts = hind
      ? [[0, 0.15, 0], [-0.08, -0.4, 0], [0.06, -0.78, 0], [0.02, -1.2, 0]]
      : [[0, 0.1, 0], [0.04, -0.45, 0], [0.0, -0.85, 0], [0.02, -1.2, 0]];
    lk.add(mats.hide, tube(pts, 0.14, 0.055, { seg: 7, radial: 6 }));
    lk.add(mats.hide, cyl(0.065, 0.1, 0.16, 7), { p: [0.02, -1.13, 0] });
    lk.add(mats.iron, cyl(0.075, 0.085, 0.1, 8), { p: [0.03, -1.27, 0] });
    lk.build(hip);
    legs.push(hip);
  }
  // the neck, maned, and the head with its steel face-plate
  const neck = new THREE.Group();
  neck.name = 'neck';
  neck.position.set(0.82, 1.62, 0);
  horse.add(neck);
  const nk = parts();
  nk.add(mats.hide, tube([[-0.1, -0.05, 0], [0.25, 0.4, 0], [0.42, 0.8, 0]], 0.3, 0.16, { seg: 6, radial: 8 }), { s: [1, 1, 0.78] });
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    nk.add(mats.robe, new THREE.ConeGeometry(0.06, 0.38, 4), { p: [-0.12 + t * 0.48 - 0.06, 0.18 + t * 0.66, 0.06 * (i % 2 ? 1 : -1)], r: [0, 0, 2.3 - t * 0.3], s: [1, 1, 0.35] });
  }
  nk.build(neck);
  const hd = new THREE.Group();
  hd.name = 'head';
  hd.position.set(0.42, 0.82, 0);
  neck.add(hd);
  const hk = parts();
  hk.add(mats.hide, lathe([[0.001, 0], [0.13, 0.04], [0.15, 0.18], [0.12, 0.4], [0.1, 0.56], [0.08, 0.62], [0.001, 0.65]], 10), { s: [1, 1, 0.72], r: [0, 0, -2.5] });
  hk.add(mats.steel, roundBox(0.1, 0.46, 0.05, 0.02), { p: [0.27, -0.12, 0], r: [0, 0, -2.5 + Math.PI], s: [1, 1, 1] });
  for (const s of [-1, 1]) hk.add(mats.hide, new THREE.ConeGeometry(0.045, 0.16, 5), { p: [-0.04, 0.14, s * 0.07], r: [s * 0.25, 0, 0.35] });
  hk.build(hd);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-1.05, 1.66, 0);
  horse.add(tail);
  const tk = parts();
  for (const dz of [-0.05, 0, 0.05]) tk.add(mats.robe, tube([[0, 0, dz], [-0.24, -0.12, dz * 1.5], [-0.33, -0.6, dz * 2], [-0.28, -1.15, dz * 2.5]], 0.07, 0.015, { seg: 7, radial: 5 }));
  tk.build(tail);

  // the rider
  const rider = new THREE.Group();
  rider.name = 'rider';
  rider.position.set(0.12, 1.88, 0);
  g.add(rider);
  const body = new THREE.Group();
  body.name = 'body';
  rider.add(body);
  const rk = parts();
  const robe = lathe([[0.56, -0.74], [0.5, -0.4], [0.42, 0.0], [0.3, 0.45], [0.26, 0.8], [0.22, 0.95], [0.12, 1.02], [0.001, 1.04]], 18);
  const rp = robe.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const y = rp.getY(i);
    if (y < -0.3) {
      const a = Math.atan2(rp.getZ(i), rp.getX(i));
      const seg = Math.round((a / TAU) * 18);
      const k = (-0.3 - y) / 0.44;
      rp.setY(i, y - k * ((seg % 2) * 0.22 + n(seg * 2.3, 1) * 0.18));
    }
  }
  robe.computeVertexNormals();
  rk.add(mats.robe, robe, { s: [0.78, 1, 1.18] });
  rk.add(mats.robe, lathe([[0.46, 0.36], [0.4, 0.6], [0.28, 0.92], [0.14, 1.04]], 18), { s: [0.85, 1, 1.15] });
  for (const s of [-1, 1]) {
    rk.add(mats.robe, tube([[0.02, 0.86, s * 0.25], [0.28, 0.6, s * 0.3], [0.5, 0.44, s * 0.2]], 0.085, 0.13, { seg: 6, radial: 7 }));
    rk.add(mats.steel, ball(0.07, 8, 6), { p: [0.56, 0.42, s * 0.19], s: [1.3, 0.9, 0.9] });
    rk.add(mats.steel, cyl(0.075, 0.06, 0.1, 7), { p: [0.5, 0.44, s * 0.2], r: [0, 0, 1.2] });
    rk.add(mats.hide, tube([[0.6, 0.41, s * 0.18], [1.0, 0.18, s * 0.15], [1.45, 0.22, s * 0.1]], 0.012, 0.012, { seg: 6, radial: 3 }));
    rk.add(mats.steel, roundBox(0.3, 0.1, 0.12, 0.03), { p: [0.18, -0.92, s * 0.5] });
    rk.add(mats.iron, new THREE.TorusGeometry(0.08, 0.012, 3, 8), { p: [0.16, -0.94, s * 0.5], r: [Math.PI / 2, 0, 0] });
  }
  rk.build(body);
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(0.02, 1.06, 0);
  body.add(head);
  const hood = new THREE.SphereGeometry(0.27, 12, 8, Math.PI + 0.75, TAU - 1.5, 0, Math.PI * 0.8);
  const hp = hood.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    if (y > 0.12) hp.setXYZ(i, hp.getX(i) - (y - 0.12) * 0.55, 0.12 + (y - 0.12) * 1.5, hp.getZ(i) * (1 - (y - 0.12) * 0.8));
  }
  hood.computeVertexNormals();
  const hk2 = parts();
  hk2.add(mats.robe, hood, { s: [1, 1.1, 0.95] });
  hk2.add(mats.void, ball(0.22, 8, 6), { p: [0.0, -0.01, 0] });
  hk2.build(head);

  // How the horse moves (../creatures.js): its legs from the ground it
  // covers, read from where the scene puts the rider, a walk lengthening
  // into a gallop at the Rider's pace; its head nodding with the stride and
  // tossing at a stand. `sniff` (0…1) puts its head down at the hollow.
  const track = createTracker();
  const stride = createStride({ stride: 1.7, hz: 0.9, longest: 3.4, cadence: [1.05, 1.5], seed: 66 });
  const LEG = 1.32;
  const A = { sniff: 0 };
  const animate = (t, { sniff = 0 } = {}) => {
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const st = stride.step(m.dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const offs = gaitOffsets(st.run, WALK);
    const stance = mix(STANCE.walk, 0.3, st.run);
    legs.forEach((hip, j) => {
      const { angle, lift } = legSwing(st.cycle + offs[j], stance, stance * st.stride, LEG);
      const still = Math.sin(t * 1.5 + j) * 0.05;
      hip.rotation.z = mix(still, angle, st.amount);
      hip.scale.y = 1 - 0.12 * lift * st.amount;
    });
    A.sniff = ease(A.sniff, sniff, m.dt, 2);
    const nod = Math.sin(st.phase + 0.6 * st.run) * (0.04 + 0.06 * st.run) * st.amount;
    neck.rotation.z = mix(nod + Math.sin(t * 0.7) * 0.03 * (1 - st.amount), -0.25 + Math.sin(t * 1.3) * 0.08, A.sniff);
    tail.rotation.z = (-0.25 * st.run + Math.sin(st.phase) * 0.05) * st.amount;
  };
  return { group: g, horse: { group: horse, legs, neck, head: hd, tail }, rider: { group: rider, body, head }, animate };
}

// ── small dressing ──

// A scarecrow facing +z: a cross of poles in a patched coat, a sacking head
// with a stitched face under a straw hat, straw at the cuffs, a crow on one
// arm.
function scarecrowParts(bk, K) {
  const { mats } = K;
  const n = makeNoise(3);
  bk.add(mats.timber, cyl(0.045, 0.055, 2.0, 6), { p: [0, 1.0, 0], uv: 1.2 });
  bk.add(mats.timber, cylX(0.035, 1.6, 6), { p: [0, 1.4, 0], uv: 1.2 });
  const coat = lathe([[0.3, 0.7], [0.28, 0.95], [0.25, 1.25], [0.2, 1.42], [0.08, 1.5]], 14);
  const cp = coat.attributes.position;
  for (let i = 0; i < cp.count; i++) if (cp.getY(i) < 0.75) cp.setY(i, cp.getY(i) - n(i * 1.7, 2) * 0.16);
  coat.computeVertexNormals();
  const blue = new THREE.Color(0x56688a);
  const ochre = new THREE.Color(0xb88a3a);
  bk.add(mats.cloth, coat, { s: [1, 1, 0.75], color: (x, y, z, out) => out.copy(x > 0.05 && y > 0.9 && y < 1.15 && z > 0 ? ochre : blue) });
  for (const s of [-1, 1]) {
    bk.add(mats.cloth, tube([[s * 0.15, 1.4, 0], [s * 0.45, 1.4, 0], [s * 0.72, 1.38, 0]], 0.1, 0.12, { seg: 4, radial: 7 }), { color: blue });
    for (let i = 0; i < 5; i++) bk.add(mats.thatch, new THREE.ConeGeometry(0.03, 0.22, 4), { p: [s * 0.8, 1.34 + (i - 2) * 0.03, (i - 2) * 0.03], r: [0, 0, s * (Math.PI / 2 + (i - 2) * 0.2) * -1], uv: 2 });
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    bk.add(mats.thatch, new THREE.ConeGeometry(0.035, 0.24, 4), { p: [Math.cos(a) * 0.24, 0.58, Math.sin(a) * 0.18], r: [Math.PI, 0, 0], uv: 2 });
  }
  bk.add(mats.sack, ball(0.2, 12, 10), { p: [0, 1.7, 0], s: [1, 1.08, 0.95], uv: 1.6 });
  bk.add(mats.rope, new THREE.TorusGeometry(0.1, 0.02, 4, 12), { p: [0, 1.52, 0], r: [Math.PI / 2, 0, 0] });
  for (const s of [-1, 1]) {
    for (const t of [-1, 1]) bk.add(mats.iron, B(0.075, 0.016, 0.016), { p: [s * 0.075, 1.75, 0.185], r: [0, 0, t * 0.78] });
  }
  for (let i = 0; i < 5; i++) bk.add(mats.iron, B(0.035, 0.012, 0.012), { p: [-0.08 + i * 0.04, 1.62 + Math.abs(i - 2) * 0.012, 0.18], r: [0, 0, (i % 2 ? 0.6 : -0.6)] });
  bk.add(mats.thatch, cyl(0.38, 0.4, 0.03, 18), { p: [0, 1.88, 0], r: [0.08, 0, 0.06], uv: 1.5 });
  bk.add(mats.thatch, lathe([[0.19, 0], [0.18, 0.14], [0.13, 0.22], [0.001, 0.2]], 14), { p: [0, 1.88, 0], uv: 1.5 });
  bk.add(mats.cloth, cyl(0.192, 0.19, 0.05, 14, true), { p: [0, 1.92, 0], color: 0xa8302a });
  // the crow
  const black = 0x1c1a1e;
  bk.add(mats.beast, ball(0.08, 8, 6), { p: [0.55, 1.5, 0], s: [1.5, 1, 1], color: black });
  bk.add(mats.beast, ball(0.055, 8, 6), { p: [0.65, 1.58, 0], color: black });
  bk.add(mats.beast, new THREE.ConeGeometry(0.02, 0.08, 4), { p: [0.72, 1.57, 0], r: [0, 0, -Math.PI / 2], color: 0x5a5a52 });
  bk.add(mats.beast, new THREE.ConeGeometry(0.05, 0.14, 4), { p: [0.43, 1.52, 0], r: [0, 0, Math.PI / 2 + 0.3], s: [1, 1, 0.4], color: black });
}

// A straw skep of bees on a stand: coiled, domed, a dark door at its foot.
function beehiveParts(bk, K) {
  const { mats } = K;
  bk.add(mats.trunk, cyl(0.17, 0.2, 0.4, 8), { p: [0, 0.2, 0] });
  bk.add(mats.wood, cyl(0.36, 0.36, 0.06, 14), { p: [0, 0.43, 0], uv: 1.5 });
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const y = t * 0.56;
    const rr = 0.31 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.5) + 0.012 * Math.sin(t * TAU * 7);
    prof.push([Math.max(0.001, rr), y]);
  }
  const skep = lathe(prof, 18);
  const uv = skep.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i) * 2.2, uv.getX(i) * 3);
  bk.add(mats.thatch, skep, { p: [0, 0.46, 0] });
  bk.add(mats.void, new THREE.CircleGeometry(0.06, 8, 0, Math.PI), { p: [0, 0.465, 0.312] });
}

// A wheelbarrow, its wheel to +x: a flaring plank tray, handles, two legs,
// and a couple of pumpkins in it.
function wheelbarrowParts(bk, K, crops) {
  const { mats } = K;
  bk.add(mats.wood, roundBox(0.6, 0.04, 0.5, 0.012), { p: [0, 0.42, 0], uv: 1.4 });
  for (const s of [-1, 1]) bk.add(mats.wood, roundBox(0.72, 0.3, 0.04, 0.012), { p: [0, 0.56, s * 0.3], r: [s * -0.45, 0, 0], uv: 1.4 });
  bk.add(mats.wood, roundBox(0.04, 0.3, 0.66, 0.012), { p: [0.38, 0.56, 0], r: [0, 0, -0.55], uv: 1.4 });
  bk.add(mats.wood, roundBox(0.04, 0.28, 0.6, 0.012), { p: [-0.33, 0.55, 0], r: [0, 0, 0.2], uv: 1.4 });
  for (const s of [-1, 1]) {
    bk.add(mats.timber, tube([[0.62, 0.2, s * 0.14], [0.1, 0.38, s * 0.22], [-0.4, 0.5, s * 0.26], [-0.85, 0.62, s * 0.28]], 0.03, 0.025, { seg: 6, radial: 6 }));
    bk.add(mats.timber, B(0.05, 0.42, 0.05), { p: [-0.25, 0.2, s * 0.25], r: [0, 0, -0.08] });
  }
  bk.add(mats.wood, ringGeo(0.15, 0.2, 0.06, 20), { p: [0.62, 0.2, -0.03], uv: 2 });
  bk.add(mats.iron, new THREE.TorusGeometry(0.2, 0.014, 4, 20), { p: [0.62, 0.2, 0] });
  for (let i = 0; i < 6; i++) bk.add(mats.wood, B(0.3, 0.025, 0.025), { p: [0.62, 0.2, 0], r: [0, 0, (i / 6) * Math.PI], uv: 2 });
  bk.add(mats.iron, cylZ(0.02, 0.32, 6), { p: [0.62, 0.2, 0] });
  bk.add(mats.pumpkin, crops.pumpkin.clone(), { p: [-0.05, 0.43, 0.08], s: 0.85, r: [0, 1, 0.2] });
  bk.add(mats.pumpkin, crops.pumpkin.clone(), { p: [0.15, 0.45, -0.1], s: 0.65, r: [0.2, 2, 0] });
}

// A rectangular hay bale, softly rounded, tied twice with twine.
function hayBaleParts(bk, K) {
  const { mats } = K;
  let g = new THREE.BoxGeometry(1, 0.46, 0.56, 6, 3, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const n = makeNoise(4);
  const inner = V3(0.44, 0.17, 0.22);
  const q = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    q.copy(v).clamp(inner.clone().negate(), inner);
    const dd = v.clone().sub(q);
    if (dd.lengthSq() > 0) v.copy(q).add(dd.normalize().multiplyScalar(0.06 + (n(v.x * 6, v.y * 6 + v.z * 4) - 0.5) * 0.03));
    p.setXYZ(i, v.x, v.y + 0.23, v.z);
  }
  g.computeVertexNormals();
  bk.add(mats.thatch, g, { uv: 1.3 });
  for (const x of [-0.25, 0.25]) bk.add(mats.rope, new THREE.TorusGeometry(0.29, 0.012, 4, 20), { p: [x, 0.23, 0], r: [0, Math.PI / 2, 0], s: [1, 0.86, 1] });
}

// A cluster of field mushrooms: cream caps, brown gills, white stems, a
// tuft of grass. About 0.3 tall.
function mushroomParts(bk, K) {
  const M = K.mats.mushroom;
  const capTop = new THREE.Color(0xd8bf98);
  const capRim = new THREE.Color(0xf4ecdc);
  for (const [x, z, h, s, tilt] of [
    [0, 0, 0.24, 1.15, 0.05],
    [0.13, 0.07, 0.17, 0.8, -0.25],
    [-0.1, 0.11, 0.12, 0.62, 0.3],
  ]) {
    const o = { p: [x, 0, z], s, r: [tilt, 0, tilt * 0.6] };
    bk.add(M, lathe([[0.04, 0], [0.032, h * 0.5], [0.028, h], [0.001, h]], 8), { ...o, color: 0xf6f2e8 });
    bk.add(M, lathe([[0.03, h - 0.004], [0.112, h - 0.024], [0.001, h + 0.01]], 12), { ...o, color: 0x7a5640 });
    const cap = lathe([[0.11, h - 0.026], [0.122, h - 0.008], [0.1, h + 0.035], [0.06, h + 0.058], [0.001, h + 0.064]], 12);
    fillColor(cap, (cx, cy, cz, out) => out.lerpColors(capRim, capTop, clamp01((cy - h + 0.01) / 0.07)));
    bk.add(M, cap, o);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    bk.add(M, new THREE.ConeGeometry(0.012, 0.14 + (i % 3) * 0.04, 3), { p: [Math.cos(a) * 0.17, 0.07, Math.sin(a) * 0.15], r: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3], color: 0x5f8f38 });
  }
}

// ── instancing geometry ──

// A rough split post, 1.1 tall, its top cut on a slant.
function fencePostGeo() {
  const g = new THREE.CylinderGeometry(0.07, 0.085, 1.1, 6, 2);
  const p = g.attributes.position;
  const n = makeNoise(2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + (n(x * 30 + y, z * 30) - 0.5) * 0.25;
    p.setXYZ(i, x * k, y > 0.5 ? y - x * 0.6 : y, z * k);
  }
  g.translate(0, 0.55, 0);
  g.computeVertexNormals();
  scaleUV(g, 0.3, 1.2);
  return mergeAll([g]);
}

// A split rail, a metre long along x, centred on the origin.
function fenceRailGeo(y = 0, seed = 1) {
  const g = new THREE.CylinderGeometry(0.055, 0.055, 1, 5, 4);
  const p = g.attributes.position;
  const n = makeNoise(seed);
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (n(p.getY(i) * 4, i * 0.37) - 0.5) * 0.3;
    p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k * 0.72);
  }
  g.computeVertexNormals();
  scaleUV(g, 0.3, 1.2);
  return tf(g, { r: [0, 0, Math.PI / 2], p: [0, y, 0] });
}

// A block of hedge a metre long along x (a little more, so blocks run on
// without a seam), 1.3 tall and a metre through, rounded on top, leafy.
function hedgeGeo() {
  let g = new THREE.BoxGeometry(1.1, 1, 1, 10, 7, 7);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const n = makeNoise(5);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const yy = p.getY(i) + 0.5;
    const z = p.getZ(i);
    const across = Math.abs(z) * 2;
    let y = yy * 1.3;
    if (yy > 0.99) y = 1.3 - 0.3 * Math.pow(across, 2.5);
    let zz = z * (1 - 0.14 * yy);
    if (yy > 0.75 && across > 0.99) y = mix(y, y - 0.12, (yy - 0.75) * 4);
    const bump = (fbm(n, (x + 0.55) * 4, yy * 3 + z * 2, { period: 4, octaves: 3 }) - 0.5) * 0.24;
    const out = yy > 0.99 ? [0, 1] : [Math.sign(z), 0];
    zz += out[0] * bump;
    y += out[1] * bump;
    const tuck = smooth(0.4, 0.55, Math.abs(x));
    p.setXYZ(i, x, Math.max(0, y * (1 - 0.015 * tuck)), zz * (1 - 0.05 * tuck));
  }
  g.computeVertexNormals();
  const shade = foliageColor(0, 0.55, 0, 0.75, 6);
  const geo = g.toNonIndexed();
  boxUV(geo, 1.4);
  fillColor(geo, shade);
  return mergeAll([geo], { colors: true });
}

// A cabbage: a pale heart in loose, cupped outer leaves.
function cabbageGeo() {
  const geos = [];
  const heart = tf(new THREE.SphereGeometry(0.11, 10, 8), { p: [0, 0.11, 0], s: [1, 0.9, 1] });
  geos.push(fillColor(heart, 0x9cc47a));
  const outer = new THREE.Color(0x2a5a3c);
  const inner = new THREE.Color(0x6f9f5a);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const leaf = new THREE.SphereGeometry(0.19 + (i % 2) * 0.04, 6, 5, 0, 1.5, 0.45, 1.35);
    tf(leaf, { r: [0, a, 0], p: [0, 0.1, 0], s: [1.1, 0.75, 1.1] });
    geos.push(fillColor(leaf, (x, y, z, out) => out.lerpColors(outer, inner, clamp01(y / 0.22))));
  }
  return mergeAll(geos, { colors: true });
}

// A pumpkin: ribbed, squat, a crooked stem.
function pumpkinGeo() {
  const g = new THREE.SphereGeometry(0.24, 16, 10);
  const p = g.attributes.position;
  const groove = new THREE.Color(0xb05216);
  const crest = new THREE.Color(0xf08e2c);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const rib = Math.pow(Math.abs(Math.cos(Math.atan2(z, x) * 4)), 0.6);
    const k = 0.9 + 0.1 * rib;
    p.setXYZ(i, x * k, y * 0.72 + 0.17, z * k);
    _k.lerpColors(groove, crest, rib);
    col.set([_k.r, _k.g, _k.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  const stem = tf(cyl(0.022, 0.035, 0.1, 5), { p: [0.01, 0.37, 0], r: [0, 0, -0.3] });
  return mergeAll([g, fillColor(stem, 0x6b5a2a)], { colors: true });
}

// A clump of ripe wheat: stalks greening at the foot, bearded ears.
function wheatGeo() {
  const r = rng(12);
  const geos = [];
  const foot = new THREE.Color(0x8a9a4a);
  const gold = new THREE.Color(0xe0c27a);
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 0.16;
    const h = 0.85 + r() * 0.25;
    const lean = [(r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25];
    const o = { p: [Math.cos(a) * d, 0, Math.sin(a) * d], r: lean };
    const stalk = tf(cyl(0.006, 0.01, h, 3), { p: [0, h / 2, 0] });
    fillColor(stalk, (x, y, z, out) => out.lerpColors(foot, gold, clamp01(y / h)));
    geos.push(tf(stalk, o));
    const ear = tf(lathe([[0.001, 0], [0.022, 0.04], [0.02, 0.1], [0.001, 0.15]], 4), { p: [0, h, 0], r: [0, 0, 0.15] });
    geos.push(tf(fillColor(ear, 0xd9b45a), o));
  }
  return mergeAll(geos, { colors: true });
}

// A small flower: a green stem and leaves, a white star of petals that an
// instance's colour tints (kit.mats.flower keeps the stem green), and a
// yellow eye. About 0.35 tall.
function flowerGeo() {
  const geos = [];
  const green = 0x4f8a34;
  const stem = tf(cyl(0.008, 0.011, 0.3, 4), { p: [0, 0.15, 0] });
  geos.push(fillColor(stem, green));
  for (const s of [-1, 1]) geos.push(fillColor(tf(ball(0.045, 5, 3), { s: [1, 0.15, 0.4], r: [0, s > 0 ? 0.4 : 2.8, s * 0.4], p: [s * 0.035, 0.1 + s * 0.03, 0] }), green));
  const pos = [];
  const tips = 10;
  for (let i = 0; i < tips; i++) {
    const a0 = (i / tips) * TAU;
    const a1 = ((i + 1) / tips) * TAU;
    const r0 = i % 2 ? 0.035 : 0.095;
    const r1 = i % 2 ? 0.095 : 0.035;
    pos.push(0, 0, 0, Math.cos(a1) * r1, r1 * 0.2, -Math.sin(a1) * r1, Math.cos(a0) * r0, r0 * 0.2, -Math.sin(a0) * r0);
  }
  const head = new THREE.BufferGeometry();
  head.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  head.computeVertexNormals();
  tf(head, { r: [0.55, 0, 0], p: [0, 0.31, 0] });
  fillColor(head, 0xffffff);
  head.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(head.attributes.position.count).fill(1), 1));
  geos.push(head);
  geos.push(fillColor(tf(ball(0.026, 6, 4), { p: [0, 0.322, 0.012] }), 0xf2c43a));
  return mergeAll(geos, { colors: true, tint: true });
}

// ── signs and washing ──

// A wooden signpost with an arm for each line, pointing this way and that,
// the names painted on both faces.
function signpost(K, lines = ['Bywater', 'Bag End', 'The Green Dragon']) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'signpost';
  const bk = parts();
  bk.add(mats.timber, B(0.12, 2.6, 0.12), { p: [0, 1.3, 0], uv: 1.2 });
  bk.add(mats.timber, new THREE.ConeGeometry(0.11, 0.14, 4), { p: [0, 2.67, 0], r: [0, Math.PI / 4, 0] });
  bk.add(mats.timber, cyl(0.16, 0.2, 0.15, 6), { p: [0, 0.07, 0] });
  bk.build(g);
  const tex = canvasTexture(signpostCanvas(lines), K.renderer, { wrap: false });
  const text = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const L = 1.15;
  const h = 0.26;
  const tip = 0.16;
  const depth = 0.04;
  lines.forEach((t, i) => {
    const s = new THREE.Shape();
    s.moveTo(0, -h / 2);
    s.lineTo(L - tip, -h / 2);
    s.lineTo(L, 0);
    s.lineTo(L - tip, h / 2);
    s.lineTo(0, h / 2);
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    const caps = geo.groups[0];
    const v0 = 1 - (i + 1) / lines.length;
    const v1 = 1 - i / lines.length;
    for (let k = caps.start; k < caps.start + caps.count; k++) {
      const u = p.getX(k) / L;
      uv.setXY(k, p.getZ(k) > depth / 2 ? u : 1 - u, mix(v0, v1, (p.getY(k) + h / 2) / h));
    }
    geo.translate(0.07, 0, -depth / 2);
    const arm = new THREE.Mesh(geo, [text, mats.wood]);
    const dir = i % 2 ? Math.PI : 0;
    arm.position.y = 2.3 - i * 0.34;
    arm.rotation.y = dir + (i - 1) * 0.45;
    arm.castShadow = true;
    arm.receiveShadow = true;
    g.add(arm);
  });
  return { group: g };
}

// A washing line between two posts along x, `len` long, sagging, hung
// with shirts, a sheet, breeches and socks in hobbit colours.
function washingLine(K, len = 4) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'washingLine';
  const bk = parts();
  const top = 1.82;
  const sag = 0.18;
  const lineY = (x) => top - sag * (1 - ((2 * x) / len) ** 2);
  for (const s of [-1, 1]) {
    bk.add(mats.timber, cyl(0.045, 0.055, 1.95, 6), { p: [s * len / 2, 0.975, 0], uv: 1.2 });
    bk.add(mats.timber, B(0.07, 0.07, 0.4), { p: [s * len / 2, 1.86, 0], uv: 1.2 });
  }
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const x = -len / 2 + (i / 10) * len;
    pts.push([x, lineY(x), 0]);
  }
  bk.add(mats.rope, tube(pts, 0.008, 0.008, { seg: 20, radial: 3 }));
  const items = [
    ['shirt', 0.56, 0xf2ecdc],
    ['sheet', 0.9, 0xe8dfc8],
    ['sock', 0.13, 0xb8402e],
    ['sock', 0.13, 0xb8402e],
    ['breeches', 0.46, 0x6a7a4a],
    ['shirt', 0.56, 0xd9b45a],
    ['kerchief', 0.32, 0x4a6aa8],
  ];
  let x = -len / 2 + 0.25;
  for (const [kind, w, color] of items) {
    if (x + w > len / 2 - 0.2) break;
    const s = new THREE.Shape();
    if (kind === 'shirt') {
      s.moveTo(-0.17, 0);
      s.lineTo(-0.28, -0.05);
      s.lineTo(-0.26, -0.22);
      s.lineTo(-0.17, -0.18);
      s.lineTo(-0.17, -0.55);
      s.lineTo(0.17, -0.55);
      s.lineTo(0.17, -0.18);
      s.lineTo(0.26, -0.22);
      s.lineTo(0.28, -0.05);
      s.lineTo(0.17, 0);
      s.lineTo(0.05, -0.05);
      s.lineTo(-0.05, -0.05);
    } else if (kind === 'sheet') {
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, -0.85);
      s.quadraticCurveTo(0, -0.78, -w / 2, -0.88);
    } else if (kind === 'sock') {
      s.moveTo(-0.05, 0);
      s.lineTo(0.05, 0);
      s.lineTo(0.05, -0.2);
      s.lineTo(0.1, -0.26);
      s.lineTo(-0.02, -0.3);
      s.lineTo(-0.05, -0.24);
    } else if (kind === 'breeches') {
      s.moveTo(-0.22, 0);
      s.lineTo(0.22, 0);
      s.lineTo(0.2, -0.48);
      s.lineTo(0.05, -0.48);
      s.lineTo(0, -0.18);
      s.lineTo(-0.05, -0.48);
      s.lineTo(-0.2, -0.48);
    } else {
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(0, -0.3);
    }
    const geo = new THREE.ShapeGeometry(s, 4);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9 + p.getY(i) * 4) * 0.025 + p.getY(i) * -0.04);
    geo.computeVertexNormals();
    const cx = x + w / 2;
    const slope = Math.atan((8 * sag * cx) / (len * len));
    bk.add(mats.cloth, geo, { p: [cx, lineY(cx) + 0.005, 0], r: [0, 0, slope], color });
    for (const e of [-1, 1]) bk.add(mats.wood, B(0.02, 0.07, 0.025), { p: [cx + e * (w / 2 - 0.04), lineY(cx + e * (w / 2 - 0.04)) + 0.01, 0] });
    x += w + 0.1;
  }
  bk.build(g);
  return { group: g };
}

// ── the kit ──

export function createShireKit(renderer) {
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const thatch = thatchCanvas(S);
  const planks = planksCanvas(S);
  const leaves = leavesCanvas(S);
  const bark = barkCanvas(S);
  const slate = slateCanvas(S);
  const tex = {
    grass: T(grassCanvas(S)),
    thatch: T(thatch.c),
    thatchN: T(normalFromField(thatch.field, S, S, 2.5), { srgb: false }),
    planks: T(planks),
    planksN: T(normalFromField(heightOf(planks), S, S, 1.6), { srgb: false }),
    plaster: T(plasterCanvas(S)),
    leaves: T(leaves),
    leavesN: T(normalFromField(heightOf(leaves), S, S, 2), { srgb: false }),
    bark: T(bark),
    barkN: T(normalFromField(heightOf(bark), S, S, 3), { srgb: false }),
    slate: T(slate.c),
    slateN: T(normalFromField(slate.field, S, S, 2), { srgb: false }),
  };
  const field = stoneTextures(renderer, { seed: 12, dark: [70, 62, 54], light: [196, 182, 160], relief: 3 });
  const coursed = stoneTextures(renderer, { seed: 14, courses: 8, dark: [140, 128, 112], light: [222, 212, 192], joint: 0.36, relief: 2.5 });
  const brick = stoneTextures(renderer, { seed: 16, courses: 10, dark: [84, 42, 30], light: [190, 108, 76], joint: 0.4, relief: 2 });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    turf: M({ map: tex.grass, vertexColors: true, roughness: 0.95 }),
    stone: M({ map: field.map, normalMap: field.normalMap, roughness: 0.92 }),
    ashlar: M({ map: coursed.map, normalMap: coursed.normalMap, color: 0xe2d8c6, roughness: 0.9 }),
    dressed: M({ map: coursed.map, normalMap: coursed.normalMap, color: 0xfff9f0, roughness: 0.85 }),
    brick: M({ map: brick.map, normalMap: brick.normalMap, roughness: 0.9 }),
    clay: M({ color: 0xb4583a, roughness: 0.8 }),
    ridge: M({ color: 0x5e4c46, roughness: 0.7 }),
    plaster: M({ map: tex.plaster, color: 0xf4e6c6, roughness: 0.95 }),
    timber: M({ map: tex.planks, normalMap: tex.planksN, color: 0x5e4029, roughness: 0.85 }),
    wood: M({ map: tex.planks, normalMap: tex.planksN, color: 0xa47c52, roughness: 0.85 }),
    barnwood: M({ map: tex.planks, normalMap: tex.planksN, color: 0x8a6a4c, roughness: 0.9 }),
    fence: M({ map: tex.planks, normalMap: tex.planksN, color: 0x9a8670, roughness: 0.9 }),
    thatch: M({ map: tex.thatch, normalMap: tex.thatchN, roughness: 0.95 }),
    slate: M({ map: tex.slate, normalMap: tex.slateN, roughness: 0.78 }),
    brass: M({ color: 0xd9a845, metalness: 0.85, roughness: 0.3 }),
    iron: M({ color: 0x2e2b28, roughness: 0.6 }),
    window: M({ color: 0x2c4656, roughness: 0.15, emissive: hot(0xffa040, 2.6), emissiveIntensity: 0 }),
    inside: M({ color: 0x1e140c, roughness: 1, emissive: hot(0xff9a48, 1.4), emissiveIntensity: 0.1 }),
    lantern: M({ color: 0xf2c27a, roughness: 0.6, emissive: hot(0xff9438, 3.2), emissiveIntensity: 0.05 }),
    foliage: M({ map: tex.leaves, normalMap: tex.leavesN, vertexColors: true, roughness: 0.9 }),
    trunk: M({ map: tex.bark, normalMap: tex.barkN, color: 0xa88c70, roughness: 0.95 }),
    canvas: M({ map: tex.plaster, color: 0xfbf7ee, roughness: 0.9, side: THREE.DoubleSide }),
    cloth: M({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
    paper: M({ vertexColors: true, roughness: 0.75 }),
    rope: M({ color: 0xbfa77e, roughness: 1 }),
    sack: M({ map: tex.plaster, color: 0xcbb68a, roughness: 1 }),
    wool: M({ map: tex.leaves, color: 0xf6efe2, roughness: 1 }),
    beast: M({ vertexColors: true, roughness: 0.8 }),
    hide: M({ color: 0x1a1a1f, roughness: 0.45 }),
    robe: M({ color: 0x18181d, roughness: 0.85, side: THREE.DoubleSide }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    steel: M({ color: 0x3c3f45, roughness: 0.4 }),
    pewter: M({ color: 0xa3a39a, roughness: 0.45 }),
    food: M({ vertexColors: true, roughness: 0.7 }),
    mushroom: M({ vertexColors: true, roughness: 0.7 }),
    cabbage: M({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
    pumpkin: M({ vertexColors: true, roughness: 0.6 }),
    wheat: M({ vertexColors: true, roughness: 0.9 }),
    flower: M({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }),
  };
  mats.crown = mats.foliage;
  mats.hedge = mats.foliage;
  // the flowers' heads take an instance's colour, their stems don't: the
  // geometry's `tint` (1 on the petals) says how much
  mats.flower.userData.tint = true;
  flowerTint(mats.flower);
  const paints = new Map();
  const paint = (hex) => {
    if (!paints.has(hex)) paints.set(hex, M({ map: tex.planks, normalMap: tex.planksN, color: hex, roughness: 0.75 }));
    return paints.get(hex);
  };
  const K = { mats, tex, paint, renderer };

  // Night: windows, lanterns and doorways glow (above 1, so bloom finds them).
  const setNight = (k) => {
    const t = clamp01(k);
    mats.window.emissiveIntensity = mix(0, 1, t);
    mats.lantern.emissiveIntensity = mix(0.05, 1, t);
    mats.inside.emissiveIntensity = mix(0.1, 1, t);
  };

  const crops = { cabbage: cabbageGeo(), pumpkin: pumpkinGeo(), wheat: wheatGeo() };
  // a small prop from a parts function: { group, ...whatever it returns }
  const prop = (name, fn) => {
    const group = new THREE.Group();
    group.name = name;
    const bk = parts();
    const extra = fn(bk) || {};
    bk.build(group);
    return { group, ...extra };
  };

  return {
    mats,
    paint,
    setNight,
    K,
    hobbitHole: ({ door = 0x2e6b3a, radius = 4, seed = 1, windows } = {}) => hole(K, { R: radius, door, seed, windows }),
    bagEnd: () => bagEnd(K),
    mill: () => mill(K),
    barn: () => barn(K),
    greenDragon: () => greenDragon(K),
    bridge: (o) => bridge(K, o),
    partyTree: () => partyTree(K),
    oaks: () => oaks(),
    rootTree: () => rootTree(K),
    pavilion: () => pavilion(K),
    cart: () => cart(K),
    sheep: (o) => sheep(K, o),
    dog: (o) => dog(K, o),
    blackRider: () => blackRider(K),
    scarecrow: () => prop('scarecrow', (bk) => scarecrowParts(bk, K)),
    beehive: () => prop('beehive', (bk) => beehiveParts(bk, K)),
    wheelbarrow: () => prop('wheelbarrow', (bk) => wheelbarrowParts(bk, K, crops)),
    barrel: () => prop('barrel', (bk) => barrelParts(bk, K)),
    hayBale: () => prop('hayBale', (bk) => hayBaleParts(bk, K)),
    mailbox: () => prop('mailbox', (bk) => mailboxParts(bk, K)),
    bench: () => prop('bench', (bk) => ({ seatHeight: benchParts(bk, K) })),
    lampPost: () => prop('lampPost', (bk) => ({ light: lampParts(bk, K) })),
    mushroom: () => prop('mushroom', (bk) => mushroomParts(bk, K)),
    signpost: (lines) => signpost(K, lines),
    washingLine: (len) => washingLine(K, len),
    fencePost: fencePostGeo(),
    fenceRail: mergeAll([fenceRailGeo()]),
    fenceRails: mergeAll([fenceRailGeo(0.45, 1), fenceRailGeo(0.85, 2)]),
    hedge: () => hedgeGeo(),
    crops,
    flower: flowerGeo(),
  };
}

// The helpers the other walkable towns (../towns) build their own houses with.
export { parts, tf, B, cyl, ball, cylX, cylZ, lathe, tube, blob, roundBox, sector, roofGeo, gableGeo, underRidge, beam, squareWindow, timberWall, plankDoor, roundWindow, lanternParts, barrelParts, benchParts, lampParts, bush, boxUV, fillColor, mergeAll, rng };
