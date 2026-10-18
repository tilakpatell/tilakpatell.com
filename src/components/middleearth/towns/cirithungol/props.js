// Cirith Ungol, made in code: the kit the chapter is built from. Minas
// Morgul across its valley, pale and glowing a dead green, its bridge of
// twisted statues and the beam that goes up from its tower; the host that
// marches out over the bridge, and the Witch-king on his fell beast; the
// endless stairs up their black cliff; Shelob's tunnels, her webs and the
// bones in them, Shelob herself, the phial of Galadriel and Frodo bound in
// silk; the courtyard of the orcs' Tower, and the orcs.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are,
// on the same conventions: metres, +x east, +z south, y up; each builder's
// group stands on y = 0 at its origin, fronts face +z, creatures face +x;
// fixed parts are merged one mesh per material, and things meant for an
// InstancedMesh come back as one vertex-coloured geometry. The creatures
// that move are skinned, every part bound whole to one bone, so each is a
// mesh or two however many joints it has.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { blob, boxUV, createShireKit, parts, rng, tf, tube } from '../../shire/props';
import { STAIRS } from './rules';
import { createStride, createTracker, ease } from '../../creatures';
import { beamMaterial, ghostMaterial, hide, shelobRim, splashMaterial } from '../../nodes/towns/cirithungol/propsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);
const UP = V3(0, 1, 0);

// Three dimensions of lumps from the two-dimensional noise.
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// ── small helpers ──

// Values along a profile of rows [t, a, b, …] at t, by Catmull-Rom.
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
const solid = (geo, c) => tint(geo, (x, y, z, out) => out.copy(c));

// A tube swept through points with an oval section: radii rows [front,
// side, back] at each point, so a limb can be deeper than it is wide.
function sweep(points, radii, { seg = 12, radial = 10, side = [0, 0, 1], caps = [true, true] } = {}) {
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
const lump = (r, o = {}, { detail = 1, amp = 0.1, freq = 1.6, seed = 1 } = {}) => tf(blob(r, { detail, amp, freq, seed }), o);

// A tapering rod from A to B (radial 4 makes it a square beam).
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

// A pointed spike from `at` along `dir`: a pyramid of `sides`.
const spikeAt = (at, dir, len, r, sides = 4) => along(new THREE.ConeGeometry(r, len, sides).translate(0, len / 2, 0), dir, at);

// Flat-shaded: every triangle its own normal, for broken rock.
function facet(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

// One geometry from several for one material: unindexed, each with a
// position, normal, uv and colour.
function oneGeo(list) {
  const out = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    g.morphAttributes = {};
    return g;
  });
  const g = mergeGeometries(out, false);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const bone = (name, parent, p = [0, 0, 0]) => {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(...p);
  parent.add(o);
  return o;
};

// A jagged lump of rock: an icosphere bulged by noise and then sliced by
// a few planes, so it has flat broken faces. Centred, about 1 across.
function shardGeo(seed, { detail = 1, planes = 7, cut = 0.55, amp = 0.5 } = {}) {
  const r = rng(seed);
  const n = makeNoise(seed + 5);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const cuts = [];
  for (let i = 0; i < planes; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 2 - 1);
    cuts.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: cut + r() * 0.3 });
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 3 }) - 0.5) * amp);
    for (const pl of cuts) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    p.setXYZ(i, v.x * 0.5, v.y * 0.5, v.z * 0.5);
  }
  return facet(g);
}

// ── painted textures ──

// Rock, nearly white so the vertex colours give its hue: grain, joints and
// hairline cracks, streaks down it. With its relief.
function rockCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 5, v * 5, 5);
    const crack = (1 - smooth(0, 0.018, k.f2 - k.f1)) * smooth(0.58, 0.7, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const streak = (n(u * 64, 0.5, 64) - 0.5) * smooth(0.35, 0.7, fbm(n, u * 2 + 3, v * 2, { period: 2, octaves: 2 }));
    const fleck = smooth(0.82, 0.9, n(u * 96 + 5, v * 96, 96));
    field[py * S + px] = clamp01(0.3 + big * 0.5 + grain * 0.14 - crack * 0.5);
    const t = 0.74 + big * 0.3 + (grain - 0.5) * 0.18 - crack * 0.22 - streak * 0.3 + fleck * 0.12;
    out[0] = 226 * t;
    out[1] = 226 * t;
    out[2] = 222 * t;
  });
  return { c, field };
}

// Dressed black stone in courses: blocks of uneven length, the joints
// deep, the faces chipped. With its relief.
function blockCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  const rows = 4;
  paintPixels(c, (u, v, out, px, py) => {
    const ry = v * rows;
    const row = Math.floor(ry);
    const fy = ry - row;
    const shift = n(row * 3.1, 1.7, rows) * 0.9;
    const bx = u * 2 + shift;
    const fx = bx - Math.floor(bx);
    const edge = Math.min(fy, 1 - fy, fx * 0.5, (1 - fx) * 0.5);
    const joint = 1 - smooth(0.006, 0.03, edge);
    const chip = smooth(0.62, 0.75, fbm(n, u * 12, v * 12, { period: 12, octaves: 3 })) * (1 - smooth(0.02, 0.08, edge));
    const grain = n(u * 96, v * 96, 96);
    const blot = fbm(n, u * 5 + 3, v * 5, { period: 5, octaves: 4 });
    const shade = 0.8 + n(Math.floor(bx) * 5.3, row * 2.9) * 0.3;
    field[py * S + px] = clamp01(0.62 - joint * 0.6 - chip * 0.25 + (grain - 0.5) * 0.12);
    const t = (0.62 + blot * 0.35 + (grain - 0.5) * 0.16) * shade - joint * 0.45 - chip * 0.15;
    out[0] = 220 * t;
    out[1] = 214 * t;
    out[2] = 208 * t;
  });
  return { c, field };
}

// Flagstones for the court: big irregular slabs, worn, dark joints.
function flagCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 2);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const k = cells(u * 4, v * 4, 4);
    const joint = 1 - smooth(0.02, 0.07, k.f2 - k.f1);
    const grain = n(u * 128, v * 128, 128);
    const blot = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const worn = smooth(0.4, 0.8, fbm(n, u * 2 + 9, v * 2, { period: 2, octaves: 3 }));
    field[py * S + px] = clamp01(0.6 - joint * 0.55 + (grain - 0.5) * 0.1 - k.f1 * 0.15);
    const t = (0.55 + k.id * 0.3 + blot * 0.3 + (grain - 0.5) * 0.15 + worn * 0.1) * (1 - joint * 0.75);
    out[0] = 215 * t;
    out[1] = 205 * t;
    out[2] = 196 * t;
  });
  return { c, field };
}

// Smooth noise in three channels, tiling, for the shaders.
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

// A soft round glow.
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

// Starlight: a hot point with long thin rays, for the phial.
function starCanvas(S = 256) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const h = S / 2;
  x.globalCompositeOperation = 'lighter';
  const ray = (a, len, w, alpha) => {
    x.save();
    x.translate(h, h);
    x.rotate(a);
    const g = x.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.4, `rgba(255,255,255,${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -w);
    x.lineTo(len, 0);
    x.lineTo(0, w);
    x.closePath();
    x.fill();
    x.restore();
  };
  for (let i = 0; i < 4; i++) ray((i / 4) * TAU, h * 0.98, 3, 0.9);
  for (let i = 0; i < 4; i++) ray((i / 4) * TAU + Math.PI / 4, h * 0.55, 2, 0.5);
  for (let i = 0; i < 12; i++) ray((i / 12) * TAU + 0.13, h * (0.25 + (i % 3) * 0.08), 1.2, 0.35);
  const g = x.createRadialGradient(h, h, 0, h, h, h * 0.3);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}

// A torch flame: a ragged teardrop, white-gold at its heart; the material's
// colour gives its heat.
function flameCanvas() {
  const c = makeCanvas(64, 128);
  const n = makeNoise(41);
  paintPixels(c, (u, v, out) => {
    const y = 1 - v;
    const w = 0.34 * Math.pow(Math.max(0, 1 - y), 0.7) * smooth(0, 0.25, y) + 0.02;
    const wob = (n(u * 4, y * 6) - 0.5) * 0.12 * y;
    const d = Math.abs(u - 0.5 + wob) / w;
    const a = (1 - smooth(0.4, 1, d)) * (1 - smooth(0.7, 1, y + (n(u * 8 + 3, y * 9) - 0.5) * 0.2));
    const core = (1 - smooth(0, 0.6, d)) * (1 - smooth(0.1, 0.5, y));
    out[0] = 255;
    out[1] = 150 + core * 105;
    out[2] = 60 + core * 170;
    out[3] = clamp01(a) * 255;
  });
  return c;
}

// Shelob's web in a sheet: threads every way, thick where they cross, holes
// torn in it, fading to nothing at its edges. The right-hand strip is solid
// thread, for strands to take their colour from.
function webCanvas(S = 256) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(91);
  x.clearRect(0, 0, S, S);
  x.lineCap = 'round';
  const W = S * 0.94;
  for (let i = 0; i < 260; i++) {
    const a = r() * TAU;
    const cx = r() * W;
    const cy = r() * S;
    const len = S * (0.2 + r() * 0.8);
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    x.strokeStyle = `rgba(255,255,255,${0.1 + r() * 0.35})`;
    x.lineWidth = 0.6 + r() * (r() < 0.1 ? 3 : 1.2);
    x.beginPath();
    x.moveTo(cx - dx / 2, cy - dy / 2);
    x.quadraticCurveTo(cx + (r() - 0.5) * 40, cy + (r() - 0.5) * 40 + 12, cx + dx / 2, cy + dy / 2);
    x.stroke();
  }
  // clotted sheets of it
  for (let i = 0; i < 26; i++) {
    const cx = r() * W;
    const cy = r() * S;
    const rad = 10 + r() * 34;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(255,255,255,${0.2 + r() * 0.25})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // fade it out at the edges and tear holes in it
  x.globalCompositeOperation = 'destination-out';
  const fade = (x0, y0, x1, y1) => {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    return g;
  };
  x.fillStyle = fade(0, 0, S * 0.08, 0);
  x.fillRect(0, 0, S * 0.08, S);
  x.fillStyle = fade(W, 0, W - S * 0.08, 0);
  x.fillRect(W - S * 0.08, 0, S * 0.08, S);
  x.fillStyle = fade(0, S, 0, S * 0.9);
  x.fillRect(0, S * 0.9, W, S * 0.1);
  for (let i = 0; i < 7; i++) {
    const cx = S * 0.15 + r() * W * 0.75;
    const cy = S * 0.15 + r() * S * 0.7;
    const rad = 6 + r() * 16;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, 'rgba(0,0,0,0.9)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // and an uneven oval, so no sheet shows its square edges
  x.globalCompositeOperation = 'destination-in';
  x.save();
  x.translate(W / 2, S * 0.42);
  x.scale(1, 1.15);
  const vg = x.createRadialGradient(0, 0, S * 0.1, 0, 0, W * 0.5);
  vg.addColorStop(0, 'rgba(0,0,0,1)');
  vg.addColorStop(0.65, 'rgba(0,0,0,0.85)');
  vg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = vg;
  x.fillRect(-W, -S, W * 2, S * 2);
  x.restore();
  x.globalCompositeOperation = 'source-over';
  x.fillStyle = 'rgba(255,255,255,0.55)';
  x.fillRect(S * 0.96, 0, S * 0.04, S);
  return c;
}

// Fine hair laid one way, and blotches: green the shading, blue the dark,
// for a hide's detail; and its relief.
function hairCanvas(S = 256) {
  const n = makeNoise(77);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const streak = n(u * 160, v * 18, 160) * 0.6 + n(u * 90 + 3, v * 12, 90) * 0.4;
    const blot = fbm(n, u * 6 + 11, v * 6, { period: 6, octaves: 4 });
    const pit = smooth(0.7, 0.85, n(u * 40 + 7, v * 40, 40));
    field[py * S + px] = clamp01(streak * 0.8 + blot * 0.2 - pit * 0.3);
    out[0] = 128;
    out[1] = streak * 255;
    out[2] = smooth(0.55, 0.75, blot) * 200 + pit * 55;
  });
  return { c, field };
}

// Warty, pitted skin for the orcs: green the shading, blue the dark.
function wartCanvas(S = 256) {
  const n = makeNoise(63);
  const cells = makeCells(65);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const k = cells(u * 14, v * 14, 14);
    const wart = 1 - smooth(0.05, 0.4, k.f1);
    const crease = 1 - smooth(0, 0.08, k.f2 - k.f1);
    const blot = fbm(n, u * 5, v * 5, { period: 5, octaves: 4 });
    field[py * S + px] = clamp01(0.4 + wart * 0.5 * smooth(0.4, 0.6, k.id) - crease * 0.3);
    out[0] = 128;
    out[1] = 128 + (blot - 0.5) * 200 + wart * 40;
    out[2] = crease * 140 + smooth(0.6, 0.8, blot) * 90;
  });
  return { c, field };
}

// ── shader pieces ──

// What glossy things see in the dark: near black, a cold light overhead,
// a little from the side. Lights the shine of chitin, eyes and iron.
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

// Skinned parts: each part bound whole to one bone and laid where that bone
// is in the pose it was built in, one skinned mesh per material on one
// skeleton. add(material, bone, geo) with geo in the bone's own frame.
function skinParts(bones) {
  const lists = new Map();
  const _m4 = new THREE.Matrix4();
  return {
    add(material, b, geo) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.color) solid(g, C(0xffffff));
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      g.applyMatrix4(_m4.copy(b.matrixWorld));
      const count = g.attributes.position.count;
      const si = new Uint16Array(count * 4);
      const sw = new Float32Array(count * 4);
      const bi = bones.indexOf(b);
      for (let i = 0; i < count; i++) {
        si[i * 4] = bi;
        sw[i * 4] = 1;
      }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      if (!lists.has(material)) lists.set(material, []);
      lists.get(material).push(g);
    },
    build(group, { shadow = true } = {}) {
      const skeleton = new THREE.Skeleton(bones);
      const meshes = [];
      for (const [mat, geos] of lists) {
        const geo = mergeVertices(mergeGeometries(geos));
        const mesh = new THREE.SkinnedMesh(geo, mat);
        mesh.castShadow = shadow;
        mesh.frustumCulled = false;
        group.add(mesh);
        mesh.bind(skeleton);
        meshes.push(mesh);
      }
      return meshes;
    },
  };
}

// ── Minas Morgul ──

const DARK = { base: C(0x2a2b2d), dark: C(0x0b0c0d), green: C(0x2c4a38), moss: C(0x262b24), pale: C(0x4a4c4c) };
const GHOST = { base: C(0xb4c4b8), pale: C(0xe2ecdc), dark: C(0x6c7c72), bone: C(0xdce4d8) };

// The ground under the city, from the gate (y = 0) up its spur to the north.
const spurAt = (x, z) => (z > -4 ? 0 : 64 * smooth(-4, -150, z)) * (1 - smooth(52, 104, Math.abs(x)));

// A twisted figure in pale stone on its plinth, about 5 m: a body writhing
// up from a robe, its head thrown back, arms clawing at the air.
function statueGeo(seed) {
  const r = rng(seed * 7 + 3);
  const list = [];
  list.push(new THREE.BoxGeometry(1.5, 1.4, 1.5, 1, 1, 1).translate(0, 0.7, 0));
  list.push(new THREE.BoxGeometry(1.8, 0.25, 1.8).translate(0, 1.5, 0));
  const tw = (r() - 0.5) * 1.6;
  const pts = [];
  for (let i = 0; i <= 5; i++) {
    const k = i / 5;
    const a = tw * k * 3 + r() * 0.4;
    pts.push([Math.sin(a) * 0.22 * k + (r() - 0.5) * 0.12, 1.6 + k * 2.6, Math.cos(a) * 0.2 * k - 0.1]);
  }
  list.push(sweep(pts, [[0.5, 0.55], [0.38, 0.42], [0.3, 0.36], [0.32, 0.4], [0.24, 0.3], [0.16, 0.18]], { seg: 8, radial: 6 }));
  const top = V3(...pts[5]);
  // the head, thrown back and to one side
  list.push(lump(0.2, { p: [top.x - 0.12, top.y + 0.22, top.z + (r() - 0.5) * 0.2], s: [1, 1.15, 0.9] }, { detail: 0, seed }));
  // the arms: one up and clawing, one across the body or out
  for (const s of [-1, 1]) {
    const sh = V3(...pts[4]).add(V3(0, -0.1, s * 0.32));
    const up = r() < 0.6;
    const el = sh.clone().add(V3((r() - 0.5) * 0.5, up ? 0.7 : 0.1, s * (0.35 + r() * 0.3)));
    const wr = el.clone().add(V3((r() - 0.5) * 0.6, up ? 0.75 : -0.5, s * (up ? -0.1 : 0.3)));
    list.push(sweep([sh, el, wr], [[0.13], [0.1], [0.08]], { seg: 4, radial: 5 }));
    for (let f = 0; f < 3; f++) list.push(spikeAt(wr, V3((r() - 0.5) * 1.2, up ? 1 : -0.4, s * (r() - 0.2)), 0.32, 0.035, 3));
  }
  // ribs and spines down the back
  for (let i = 0; i < 4; i++) list.push(spikeAt(V3(...pts[1 + i]).add(V3(-0.28, 0, 0)), V3(-1, 0.4 + r() * 0.5, (r() - 0.5) * 0.8), 0.4 + r() * 0.3, 0.06, 3));
  const n = makeNoise(seed);
  const g = oneGeo(list.map((x) => facet(x)));
  tint(g, (x, y, z, out) => {
    out.copy(GHOST.bone).multiplyScalar(0.85 + noise3(n, x * 3, y * 3, z * 3) * 0.3);
    if (y < 1.62) out.lerp(GHOST.dark, 0.35);
  });
  return g;
}

// Minas Morgul, the dead city, seen across its valley from about 250 m: its
// walls and towers climbing a spur of rock, the tower in the midst 130 m
// high with its crown turning slowly; the bridge 70 m long over the
// Morgulduin's gorge, pale statues writhing along it; the dark walls of the
// valley rising either side. The gate is the origin, the bridge running out
// from it along +z. update(t, { beam, glow }).
function morgul(K) {
  const { mats } = K;
  const U = { uTime: { value: 0 }, uGlow: { value: 1 }, uBeam: { value: 0 }, uNoise: K.U.uNoise, uGhost: { value: new THREE.Color(0.3, 1.0, 0.46) } };
  const ghost = ghostMaterial(U);
  const g = new THREE.Group();
  g.name = 'minasMorgul';
  const r = rng(1201);
  const n = makeNoise(1203);
  const stone = [];
  const lights = [];
  const add = (geo) => stone.push(geo);
  const box = (w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  // a square tier from y0 to y1, `a` across at its foot and `b` at its head
  const tier = (a, b, y0, y1, x, z, sides = 4) => add(new THREE.CylinderGeometry((b * Math.SQRT2) / 2, (a * Math.SQRT2) / 2, y1 - y0, sides, 1).rotateY(Math.PI / 4).translate(x, (y0 + y1) / 2, z));
  const cap = (w, h, x, y, z) => add(new THREE.ConeGeometry((w * Math.SQRT2) / 2, h, 4).rotateY(Math.PI / 4).translate(x, y + h / 2, z));
  const slit = (x, y, z, w = 0.5, h = 3, dir = 'z') => lights.push(dir === 'z' ? new THREE.BoxGeometry(w, h, 0.5).translate(x, y, z) : new THREE.BoxGeometry(0.5, h, w).translate(x, y, z));
  const merlons = (x0, x1, y, z, d, step = 3.4) => {
    for (let x = x0 + step / 2; x < x1; x += step) {
      box(step * 0.5, 1.6, d, x, y + 0.8, z);
      add(new THREE.ConeGeometry(step * 0.36, 2.6, 4).rotateY(Math.PI / 4).scale(1, 1, d / (step * 0.5)).translate(x, y + 2.9, z));
    }
  };
  // a tower: square, battlemented, its cap a steep spike, slits in its face
  const tower = (x, z, y0, w, h, capH = w * 1.6) => {
    tier(w, w * 0.92, y0, y0 + h, x, z);
    box(w * 1.06, 1.4, w * 1.06, x, y0 + h - 4, z);
    cap(w * 0.8, capH * 1.25, x, y0 + h, z);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(spikeAt(V3(x + (cx * w) / 2.2, y0 + h, z + (cz * w) / 2.2), V3(cx * 0.2, 1, cz * 0.2), capH * 0.45, w * 0.08, 4));
    for (let y = y0 + 12; y < y0 + h - 6; y += 9) if (r() < 0.45) slit(x + (r() - 0.5) * w * 0.4, y, z + w / 2 + 0.05, 0.45, 3.2);
  };

  // ── the front wall and its gate
  {
    const sh = new THREE.Shape();
    sh.moveTo(-62, -8);
    sh.lineTo(62, -8);
    sh.lineTo(62, 20);
    sh.lineTo(-62, 20);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-5, -0.01);
    hole.lineTo(5, -0.01);
    hole.lineTo(5, 12);
    hole.quadraticCurveTo(4.6, 16.5, 0, 19);
    hole.quadraticCurveTo(-4.6, 16.5, -5, 12);
    hole.closePath();
    sh.holes.push(hole);
    add(new THREE.ExtrudeGeometry(sh, { depth: 6, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -6));
    merlons(-62, 62, 20, -1, 2);
    // buttresses, wedge-shaped, down the face
    for (let x = -57; x <= 57; x += 7.5) if (Math.abs(x) > 19 && Math.abs(Math.abs(x) - 36) > 5) add(new THREE.CylinderGeometry(0.25, 1.9, 23, 3).translate(x, 3.5, 0.2));
    for (const s of [-1, 1]) tower(s * 36, -2, -8, 8, 36, 15);
    // the gate's frame: a pointed arch of stone stepped out from the wall,
    // and the glow beyond it
    const arch = new THREE.Shape();
    arch.moveTo(-8, 0);
    arch.lineTo(-8, 13);
    arch.quadraticCurveTo(-7.4, 20, 0, 24);
    arch.quadraticCurveTo(7.4, 20, 8, 13);
    arch.lineTo(8, 0);
    arch.lineTo(5, 0);
    arch.lineTo(5, 12);
    arch.quadraticCurveTo(4.6, 16.5, 0, 19);
    arch.quadraticCurveTo(-4.6, 16.5, -5, 12);
    arch.lineTo(-5, 0);
    arch.closePath();
    add(new THREE.ExtrudeGeometry(arch, { depth: 1.6, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, 0));
    add(spikeAt(V3(0, 23.5, 0.8), V3(0, 1, 0.15), 9, 1.2, 4));
    const glow = new THREE.Shape();
    glow.moveTo(-5, 0);
    glow.lineTo(5, 0);
    glow.lineTo(5, 12);
    glow.quadraticCurveTo(4.6, 16.5, 0, 19);
    glow.quadraticCurveTo(-4.6, 16.5, -5, 12);
    glow.closePath();
    lights.push(new THREE.ShapeGeometry(glow, 4).translate(0, 0, -4));
    // the gate towers either side, and the corner towers
    for (const s of [-1, 1]) {
      tower(s * 13, -1, -8, 10, 50, 18);
      tower(s * 62, -4, -8, 13, 40, 18);
    }
  }
  // ── the side walls, stepping up the spur
  const wallRun = (ax, az, bx, bz, h, thick = 5) => {
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.round(len / 8));
    const a = Math.atan2(-(bz - az), bx - ax);
    for (let i = 0; i < steps; i++) {
      const k = (i + 0.5) / steps;
      const x = mix(ax, bx, k);
      const z = mix(az, bz, k);
      const base = spurAt(x, z);
      const seg = len / steps + 0.6;
      add(new THREE.BoxGeometry(seg, h + 12, thick).rotateY(a).translate(x, base + (h - 12) / 2, z));
      for (let m = 0; m < 2; m++) add(new THREE.BoxGeometry(seg * 0.22, 2, thick * 0.7).translate(-seg / 4 + (m * seg) / 2, 0, 0).rotateY(a).translate(x, base + h + 1, z));
    }
  };
  for (const s of [-1, 1]) {
    wallRun(s * 62, -4, s * 52, -58, 20);
    wallRun(s * 52, -58, s * 34, -124, 18);
    tower(s * 52, -58, spurAt(52, -58) - 6, 11, 38, 16);
    tower(s * 34, -124, spurAt(34, -124) - 6, 10, 34, 14);
  }
  // ── the inner walls, tier on tier
  const inner = (z, x0, h, towersAt) => {
    const base = spurAt(0, z);
    box(x0 * 2, h + 10, 4, 0, base + (h - 10) / 2, z);
    merlons(-x0, x0, base + h, z, 3);
    for (let x = -x0 + 6; x < x0; x += 10) if (r() < 0.6) slit(x, base + h - 5, z + 2.05, 0.7, 2.2);
    for (const tx of towersAt) tower(tx, z, base - 6, 8, h + 18, 13);
  };
  inner(-48, 50, 16, [-50, -22, 22, 50]);
  inner(-88, 34, 14, [-34, -12, 12, 34]);
  // ── the houses of the dead city, crowding up the tiers
  const houses = [
    [-56, -10, -44, 56, 8, 20],
    [-46, -54, -84, 46, 10, 26],
    [-32, -94, -130, 32, 12, 30],
  ];
  for (const [x0, z0, z1, x1, h0, h1] of houses) {
    for (let z = z0 - 4; z > z1; z -= 9) {
      for (let x = x0 + 4; x < x1 - 2; x += 8 + r() * 4) {
        if (Math.abs(x) < 4 && z0 === -10) continue; // the street up from the gate
        if (Math.abs(x) < 16 && z < -94 && z > -126) continue; // the tower's foot
        const w = 5 + r() * 5;
        const d = 5 + r() * 4;
        const cx = x + (r() - 0.5) * 2;
        const cz = z + (r() - 0.5) * 2;
        const base = spurAt(cx, cz) - 4;
        const mid = 1 - Math.abs(cx) / Math.max(x1, 1);
        const h = mix(h0, h1, r() * 0.6 + mid * 0.4);
        box(w, h, d, cx, base + h / 2, cz);
        if (r() < 0.65) {
          const rh = h * (0.7 + r() * 0.8);
          add(new THREE.ConeGeometry((Math.max(w, d) * Math.SQRT2) / 2, rh, 4).rotateY(Math.PI / 4).scale(w / Math.max(w, d), 1, d / Math.max(w, d)).rotateZ((r() - 0.5) * 0.12).translate(cx, base + h + rh / 2, cz));
        }
        else {
          add(new THREE.CylinderGeometry(d * 0.62, d * 0.62, w, 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(cx, base + h + d * 0.31, cz));
        }
        if (r() < 0.3) add(spikeAt(V3(cx, base + h, cz), V3((r() - 0.5) * 0.1, 1, 0), h * (0.8 + r() * 0.6), 0.9, 4));
        if (r() < 0.3) slit(cx + (r() - 0.5) * w * 0.4, base + h * (0.55 + r() * 0.3), cz + d / 2 + 0.05, 0.4, 2.2);
      }
    }
  }
  // ── the tower in the midst
  const TX = 0;
  const TZ = -110;
  const TB = spurAt(TX, TZ) - 8;
  const dy = TB - 26;
  const TOP = 128 + dy;
  const markS = stone.length;
  const markL = lights.length;
  {
    tier(24, 21, 26, 72, TX, TZ);
    tier(25, 25, 72, 74, TX, TZ);
    tier(17, 14.4, 74, 102, TX, TZ);
    tier(17.6, 17.6, 102, 103.6, TX, TZ);
    tier(12, 9.2, 103.6, 122, TX, TZ);
    add(new THREE.CylinderGeometry(2.6, 3.4, 6, 8).translate(TX, 125, TZ));
    add(new THREE.CylinderGeometry(5.2, 3.2, 1.4, 8).translate(TX, TOP - 0.7, TZ));
    // fins up its corners, running on past each tier as horns
    const fin = (y0, y1, hw0, hw1, horn) => {
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const a = V3(TX + cx * hw0, y0, TZ + cz * hw0);
        const b = V3(TX + cx * hw1, y1, TZ + cz * hw1);
        add(rod(a, b, 1.3, 0.9, 3));
        add(spikeAt(b, V3(cx * 0.35, 1, cz * 0.35), horn, 0.9, 3));
      }
    };
    fin(26, 72, 12.3, 10.8, 9);
    fin(74, 102, 8.8, 7.4, 8);
    fin(103.6, 122, 6.2, 4.8, 7);
    // ribs up the middle of each face
    for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      add(rod(V3(TX + fx * 12.2, 30, TZ + fz * 12.2), V3(TX + fx * 10.6, 70, TZ + fz * 10.6), 0.8, 0.6, 3));
      add(rod(V3(TX + fx * 8.6, 76, TZ + fz * 8.6), V3(TX + fx * 7.3, 100, TZ + fz * 7.3), 0.6, 0.5, 3));
    }
    // its windows, slits of light up every face
    for (const [y, hw, w] of [[36, 11.8, 0.6], [52, 11.2, 0.6], [84, 8.2, 0.5], [112, 5.6, 0.45]]) {
      for (const dx of [-0.45, 0.45]) {
        slit(TX + dx * hw, y, TZ + hw + 0.15, w, 3.2);
        slit(TX + dx * hw, y, TZ - hw - 0.15, w, 3.2);
        slit(TX + hw + 0.15, y, TZ + dx * hw, w, 3.2, 'x');
        slit(TX - hw - 0.15, y, TZ + dx * hw, w, 3.2, 'x');
      }
    }
    for (let i = markS; i < stone.length; i++) stone[i].translate(0, dy, 0);
    for (let i = markL; i < lights.length; i++) lights[i].translate(0, dy, 0);
  }
  // ── the bridge: a deck 70 m long on four pointed arches over the gorge,
  // a parapet each side, and the statues along it
  const BW = 9;
  {
    const sh = new THREE.Shape();
    sh.moveTo(0, -27);
    sh.lineTo(70, -27);
    sh.lineTo(70, 0);
    sh.lineTo(0, 0);
    sh.closePath();
    const piers = [0, 17.5, 35, 52.5, 70];
    for (let i = 0; i < 4; i++) {
      const a = piers[i] + (i === 0 ? 4.5 : 2.4);
      const b = piers[i + 1] - (i === 3 ? 4.5 : 2.4);
      const m = (a + b) / 2;
      const hole = new THREE.Path();
      hole.moveTo(a, -27.5);
      hole.lineTo(b, -27.5);
      hole.lineTo(b, -15);
      hole.quadraticCurveTo(b - 0.5, -8.5, m, -5.2);
      hole.quadraticCurveTo(a + 0.5, -8.5, a, -15);
      hole.closePath();
      sh.holes.push(hole);
    }
    add(new THREE.ExtrudeGeometry(sh, { depth: BW, bevelEnabled: false, curveSegments: 5 }).rotateY(-Math.PI / 2).translate(BW / 2, 0, 0));
    // cutwaters on the piers
    for (const z of [17.5, 35, 52.5]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.2, 2.6, 26, 3).rotateY(s < 0 ? Math.PI : 0).translate(s * (BW / 2 + 0.6), -14, z));
    // the parapets, with a post under each statue
    for (const s of [-1, 1]) {
      box(0.7, 1.3, 70, s * (BW / 2 - 0.35), 0.65, 35);
      box(1.1, 0.5, 70, s * (BW / 2 - 0.2), -0.35, 35);
    }
  }
  const statues = [];
  for (const s of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const z = 6.5 + i * 11.4;
      const geo = statueGeo(i * 2 + (s > 0 ? 1 : 0) + 3).clone();
      geo.rotateY(s > 0 ? Math.PI : 0).translate(s * (BW / 2 + 0.2), 0, z);
      statues.push(geo);
    }
  }
  const stoneGeo = oneGeo(stone.map((x) => facet(x)));
  boxUV(stoneGeo, 0.1);
  tint(stoneGeo, (x, y, z, out, nx, ny) => {
    out.copy(GHOST.base).multiplyScalar(0.78 + noise3(n, x * 0.05, y * 0.05, z * 0.05) * 0.4);
    out.lerp(GHOST.pale, smooth(0.5, 0.9, ny) * 0.5);
    out.lerp(GHOST.dark, (1 - smooth(-20, 6, y)) * 0.5);
  });
  const city = new THREE.Mesh(stoneGeo, ghost);
  city.name = 'city';
  g.add(city);
  const statueMesh = new THREE.Mesh(oneGeo(statues), mats.statue);
  statueMesh.name = 'statues';
  g.add(statueMesh);
  const lightMat = new THREE.MeshBasicMaterial({ color: hot(0x86ffa4, 2.2), fog: true });
  const lit = new THREE.Mesh(oneGeo(lights), lightMat);
  lit.name = 'windows';
  g.add(lit);

  // ── the crown, turning slowly: eight curved blades round a light
  const crown = new THREE.Group();
  crown.name = 'crown';
  crown.position.set(TX, TOP, TZ);
  crown.scale.setScalar(1.35);
  g.add(crown);
  {
    const blades = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const R = (rr, y) => V3(Math.cos(a) * rr, y, Math.sin(a) * rr);
      const side = [-Math.sin(a), 0, Math.cos(a)];
      const tall = i % 2 ? 0.8 : 1;
      blades.push(sweep([R(3.4, 0), R(6.2, 6 * tall), R(5.6, 12 * tall), R(2.6, 19 * tall)], [[0.5, 1.4, 0.5], [0.45, 1.2, 0.45], [0.3, 0.8, 0.3], [0.05, 0.08, 0.05]], { seg: 8, radial: 6, side }));
      blades.push(spikeAt(R(6.2, 6 * tall), V3(Math.cos(a), 0.6, Math.sin(a)), 4, 0.35, 3));
    }
    blades.push(new THREE.TorusGeometry(3.8, 0.5, 4, 16).rotateX(Math.PI / 2).translate(0, 0.4, 0));
    blades.push(new THREE.TorusGeometry(5.6, 0.35, 4, 16).rotateX(Math.PI / 2).translate(0, 9, 0));
    const cg = oneGeo(blades.map((x) => facet(x)));
    tint(cg, (x, y, z, out) => out.copy(GHOST.pale).multiplyScalar(0.85 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.3));
    const cm = new THREE.Mesh(cg, ghost);
    cm.name = 'crownBlades';
    crown.add(cm);
  }
  const ORB_Y = TOP + 9;
  const orbMat = new THREE.MeshBasicMaterial({ color: hot(0xa0ffb8, 2.6) });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 2), orbMat);
  orb.position.set(TX, ORB_Y, TZ);
  orb.name = 'orb';
  g.add(orb);
  const flareMat = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0x6aff8e, 1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const flare = new THREE.Sprite(flareMat);
  flare.position.copy(orb.position);
  flare.scale.setScalar(26);
  flare.renderOrder = 6;
  g.add(flare);

  // ── the beam, in three: a white-hot thread, the beam, and its haze
  const H = 340;
  const beam = new THREE.Group();
  beam.name = 'beam';
  beam.position.set(TX, ORB_Y, TZ);
  g.add(beam);
  const layer = (r0, r1, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, H, 20, 1, true).translate(0, H / 2, 0), mat);
    m.frustumCulled = false;
    m.renderOrder = 7;
    beam.add(m);
    return m;
  };
  layer(1.1, 1.7, beamMaterial(U, { k: 1, core: 5, edge: 1.2 }));
  layer(3.0, 4.6, beamMaterial(U, { k: 0.8, core: 1.7, edge: 2.6 }));
  layer(8, 13, beamMaterial(U, { k: 0.14, core: 0.8, edge: 1.6 }));
  const splash = new THREE.Mesh(new THREE.CircleGeometry(110, 32).rotateX(Math.PI / 2), splashMaterial(U));
  splash.position.y = H * 0.82;
  splash.renderOrder = 7;
  splash.frustumCulled = false;
  beam.add(splash);

  // ── the land: the spur under the city, the valley's walls rising either
  // side and behind, the gorge of the Morgulduin, its black water
  const land = [];
  {
    const nx = 72;
    const nz = 40;
    const x0 = -360;
    const z0 = -360;
    const z1 = 4;
    const pos = [];
    const idx = [];
    const h = (x, z) => {
      const ax = Math.abs(x);
      const near = smooth(4, -45, z);
      const walls = 240 * smooth(80, 300, ax + (n(x * 0.008, z * 0.008) - 0.5) * 90) * near;
      const back = 190 * smooth(-150, -350, z + (n(x * 0.01 + 4, 2) - 0.5) * 60) * (0.45 + 0.55 * smooth(0, 140, ax));
      const crag = (fbm(n, x * 0.02, z * 0.02, { octaves: 4 }) - 0.5) * 50 * smooth(20, 120, walls + back);
      return Math.max(spurAt(x, z) - 2.5 + (n(x * 0.1, z * 0.1) - 0.5) * 2, walls + back + crag - 1.5);
    };
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = x0 + (i / nx) * 720 + (i > 0 && i < nx ? (r() - 0.5) * 4 : 0);
        const z = z0 + (j / nz) * (z1 - z0) + (j > 0 && j < nz ? (r() - 0.5) * 3 : 0);
        pos.push(x, h(x, z), z);
      }
    }
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    land.push(facet(geo));
    // the far walls on the near side of the valley, left and right
    for (const s of [-1, 1]) {
      const p2 = [];
      const i2 = [];
      const mx = 14;
      const mz = 16;
      for (let j = 0; j <= mz; j++) {
        for (let i = 0; i <= mx; i++) {
          const x = s * (170 + (i / mx) * 190);
          const z = 66 + (j / mz) * 260;
          const ax = Math.abs(x);
          const y = 230 * smooth(190, 340, ax + (n(x * 0.01, z * 0.01) - 0.5) * 70) * smooth(66, 120, z) + (fbm(n, x * 0.02 + 9, z * 0.02, { octaves: 3 }) - 0.5) * 30 * smooth(190, 260, ax) - 1.5;
          p2.push(x, y, z);
        }
      }
      for (let j = 0; j < mz; j++) {
        for (let i = 0; i < mx; i++) {
          const a = j * (mx + 1) + i;
          if (s > 0) i2.push(a, a + mx + 1, a + 1, a + 1, a + mx + 1, a + mx + 2);
          else i2.push(a, a + 1, a + mx + 1, a + 1, a + mx + 2, a + mx + 1);
        }
      }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
      g2.setIndex(i2);
      land.push(facet(g2));
    }
    // the gorge's walls: from the lip (y −1.5) down to the river, jagged
    for (const [zt, zb, sgn] of [[4, 9, 1], [66, 61, -1]]) {
      const p3 = [];
      const i3 = [];
      const cols = 120;
      const rows = 6;
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const x = -360 + (i / cols) * 720;
          const k = j / rows;
          const y = mix(-1.5, -27, k);
          const z = mix(zt, zb, Math.pow(k, 0.7)) + (fbm(n, x * 0.06, y * 0.12 + zt, { octaves: 3 }) - 0.5) * 5 * Math.sin(Math.PI * k) * sgn;
          p3.push(x, y, z);
        }
      }
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const a = j * (cols + 1) + i;
          if (sgn < 0) i3.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
          else i3.push(a, a + cols + 1, a + 1, a + 1, a + cols + 1, a + cols + 2);
        }
      }
      const g3 = new THREE.BufferGeometry();
      g3.setAttribute('position', new THREE.Float32BufferAttribute(p3, 3));
      g3.setIndex(i3);
      land.push(facet(g3));
    }
    // a lip of ground on the near bank, where the bridge lands
    land.push(new THREE.PlaneGeometry(320, 14, 1, 1).rotateX(-Math.PI / 2).translate(0, -1.5, 73));
  }
  const landGeo = oneGeo(land);
  boxUV(landGeo, 0.05);
  tint(landGeo, (x, y, z, out, nx, ny, nz) => {
    out.copy(DARK.base).multiplyScalar(0.45 + noise3(n, x * 0.02, y * 0.02, z * 0.02) * 0.5);
    out.lerp(DARK.dark, smooth(0.6, 0.95, ny) * 0.4 + (1 - smooth(-26, -8, y)) * 0.4);
    // the faces turned to the city catch its light
    const toCity = clamp01(-(x * nx + (z + 100) * nz) / Math.max(1, Math.hypot(x, z + 100)));
    out.lerp(DARK.green, toCity * (1 - smooth(60, 260, Math.hypot(x, z + 100))) * 0.5);
  });
  const ground = new THREE.Mesh(landGeo, mats.rock);
  ground.name = 'valley';
  g.add(ground);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(720, 56).rotateX(-Math.PI / 2).translate(0, -24.5, 35), mats.morgulWater);
  river.name = 'morgulduin';
  g.add(river);

  const glowBase = lightMat.color.clone();
  const orbBase = orbMat.color.clone();
  const update = (t, { beam: b = 0, glow = 1 } = {}) => {
    U.uTime.value = t;
    U.uGlow.value = glow;
    U.uBeam.value = clamp01(b);
    const on = clamp01(b);
    crown.rotation.y = t * 0.12;
    lightMat.color.copy(glowBase).multiplyScalar((0.35 + 0.65 * glow) * (1 + on * 0.5));
    orbMat.color.copy(orbBase).multiplyScalar((0.5 + 0.5 * glow) * (1 + on * 1.8));
    flareMat.color.copy(hot(0x6aff8e, 1.6)).multiplyScalar(0.5 + glow * 0.5 + on * 1.5);
    flare.scale.setScalar(22 + on * 26 + Math.sin(t * 9) * on * 3);
    beam.visible = on > 0.001;
    mats.statue.emissiveIntensity = 0.35 * glow + on * 0.25;
  };
  update(0);
  return { group: g, bridgeEnd: V3(0, 0, 70), top: V3(TX, ORB_Y, TZ), crown, update };
}

// ── the Witch-king on his fell beast ──

const BEAST = { hide: C(0x2a2724), belly: C(0x433d36), back: C(0x141312), horn: C(0x5a5048), web: C(0x231e1b), vein: C(0x4a3c32), edge: C(0x3a2a24) };

// One wing for side s: an arm out to the wrist, four long fingers from it,
// and the torn membrane between, in two parts that flap about axes along
// their joins so the skin never parts: the inner from the flank (shoulder
// to hip), the outer from the fourth finger.
function wingParts(K, s, n) {
  const { mats } = K;
  const P = (x, y, z) => V3(x, y, z * s);
  const S = P(0.95, 0.42, 0.45);
  const E = P(0.45, 0.66, 2.4);
  const W = P(1.2, 0.62, 4.15);
  const F = [P(-0.75, 0.52, 7.6), P(-2.1, 0.44, 6.5), P(-2.95, 0.38, 5.0), P(-2.6, 0.3, 3.35)];
  const H = P(-1.5, 0.2, 0.45);
  const frame = (o, axis) => {
    const X = axis.clone().normalize();
    const Y = UP.clone().addScaledVector(X, -X.y).normalize();
    const Z = V3().crossVectors(X, Y);
    return new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(o);
  };
  const Min = frame(S, S.clone().sub(H));
  const Mout = frame(W, F[3].clone().sub(W));
  const inv = (m) => m.clone().invert();
  const sgn = (axis, o, p) => Math.sign(V3().crossVectors(axis.clone().normalize(), p.clone().sub(o)).y) || 1;
  const sIn = sgn(S.clone().sub(H), S, E);
  const sOut = sgn(F[3].clone().sub(W), W, F[0]);
  // the membrane between the leading line L(v) and the trailing line T(v)
  const skinGrid = (L, Tr, nu, nv, { sag = 0.25, holes = 2, seed = 1 } = {}) => {
    const rr = rng(seed);
    const pos = [];
    const col = [];
    const idx = [];
    const cut = [];
    for (let j = 0; j <= nv; j++) cut.push(j === 0 || j === nv ? 0 : rr() * 0.22);
    for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
        const v = j / nv;
        let u = i / nu;
        if (i === nu) u -= cut[j];
        const p = L(v).lerp(Tr(v), u);
        p.y -= sag * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
        pos.push(p.x, p.y, p.z);
        const near = Math.max(1 - smooth(0, 0.12, u), 1 - smooth(0, 0.1, Math.min(v, 1 - v)));
        _kc.copy(BEAST.web).multiplyScalar(0.8 + noise3(n, p.x * 1.5, p.y, p.z * 1.5) * 0.4).lerp(BEAST.vein, near * 0.6).lerp(BEAST.edge, smooth(0.8, 1, u) * 0.5);
        col.push(_kc.r, _kc.g, _kc.b);
      }
    }
    const skip = new Set();
    for (let h = 0; h < holes; h++) skip.add((nu - 1 - Math.floor(rr() * 2)) * nv + 1 + Math.floor(rr() * (nv - 2)));
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        if (skip.has(i * nv + j)) continue;
        const a = i * (nv + 1) + j;
        const b = a + nv + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  const poly = (pts) => {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const total = lens[lens.length - 1];
    return (v) => {
      const d = v * total;
      let i = 1;
      while (i < pts.length - 1 && lens[i] < d) i++;
      const k = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return pts[i - 1].clone().lerp(pts[i], k);
    };
  };
  const hideTone = (geo) => tint(geo, (x, y, z, out) => out.copy(BEAST.hide).multiplyScalar(0.8 + noise3(n, x * 3, y * 3, z * 3) * 0.4));
  const inner = parts();
  const lead = poly([S, E, W]);
  const trail = (v) => H.clone().lerp(F[3], v).lerp(lead(v), 0.16 * Math.sin(Math.PI * v));
  inner.add(mats.membrane, skinGrid(lead, trail, 6, 10, { sag: 0.3, holes: 2, seed: 11 + s }).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(sweep([S, S.clone().lerp(E, 0.5).add(V3(0, 0.08, 0)), E], [[0.17], [0.12], [0.11]], { seg: 5, radial: 7 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(sweep([E, E.clone().lerp(W, 0.5).add(V3(0, 0.04, 0)), W], [[0.11], [0.08], [0.085]], { seg: 5, radial: 7 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(lump(0.13, { p: E.toArray() }, { detail: 1 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hideTone(lump(0.12, { p: W.toArray() }, { detail: 1 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHorn, spikeAt(W.clone().add(V3(0.05, 0.05, 0)), V3(1, 0.3, 0.15 * s), 0.45, 0.06, 5).applyMatrix4(inv(Min)));
  const outer = parts();
  F.forEach((f, i) => outer.add(mats.beastHide, hideTone(sweep([W, W.clone().lerp(f, 0.5).add(V3(0, 0.05, 0)), f], [[i === 0 ? 0.075 : 0.06], [0.045], [0.018]], { seg: 6, radial: 5 })).applyMatrix4(inv(Mout))));
  for (let i = 0; i < 3; i++) {
    const a = F[i];
    const b = F[i + 1];
    const edge = (v) => a.clone().lerp(b, v).lerp(W, 0.24 * Math.sin(Math.PI * v));
    outer.add(mats.membrane, skinGrid(() => W.clone(), edge, 6, 7, { sag: 0.18, holes: i === 1 ? 2 : 1, seed: 31 + i * 3 + s }).applyMatrix4(inv(Mout)));
  }
  const pivot = new THREE.Group();
  pivot.name = s < 0 ? 'wingL' : 'wingR';
  Min.decompose(pivot.position, pivot.quaternion, pivot.scale);
  const flapIn = bone('flap', pivot);
  inner.build(flapIn, { shadow: false, receive: false });
  const outerPivot = new THREE.Group();
  inv(Min).multiply(Mout).decompose(outerPivot.position, outerPivot.quaternion, outerPivot.scale);
  flapIn.add(outerPivot);
  const flapOut = bone('flapOut', outerPivot);
  outer.build(flapOut, { shadow: false, receive: false });
  return { pivot, flapIn, flapOut, sIn, sOut };
}

// The Witch-king of Angmar on his fell beast, about 15 m from wingtip to
// wingtip: the beast's leathery wings, its snaking neck and hooked beak,
// its barbed tail; on its shoulders the Lord of the Nazgûl, taller than the
// other riders, in his black robes and gauntlets and the spiked crown-helm,
// two pale points of light in the dark under it. Faces +x.
// animate(t, { flap, turn }): `turn` turns his head (radians, + to his
// left), as he feels for the Ring.
function witchKing(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'witchKing';
  const n = makeNoise(733);
  const r = rng(733);
  const body = bone('body', g);
  const hideTone = (geo, { belly = 0, dark = 0 } = {}) =>
    tint(geo, (x, y, z, out, nx, ny) => {
      const m = noise3(n, x * 2.5, y * 2.5, z * 2.5);
      out.copy(BEAST.hide).multiplyScalar(0.78 + m * 0.44);
      out.lerp(BEAST.belly, clamp01(-ny * 0.8) * belly);
      out.lerp(BEAST.back, clamp01(ny) * 0.5 + dark);
    });
  const H = mats.beastHide;
  const bk = parts();
  bk.add(H, hideTone(sweep([[-1.6, 0.0, 0], [-0.7, 0.05, 0], [0.3, 0.12, 0], [1.2, 0.26, 0], [1.85, 0.42, 0]], [[0.4, 0.38, 0.36], [0.6, 0.52, 0.5], [0.78, 0.6, 0.55], [0.66, 0.52, 0.48], [0.38, 0.34, 0.34]], { seg: 12, radial: 14 }), { belly: 1 }));
  for (let i = 0; i < 9; i++) {
    const x = 1.5 - i * 0.36;
    bk.add(mats.beastHorn, spikeAt(V3(x, 0.5 + Math.sin((i / 8) * Math.PI) * 0.12, 0), V3(-0.6, 1, 0), 0.18 + Math.sin((i / 8) * Math.PI) * 0.12, 0.05, 4));
  }
  for (const s of [-1, 1]) {
    bk.add(H, hideTone(sweep([[-0.9, -0.3, s * 0.38], [-1.35, -0.75, s * 0.5], [-1.95, -0.95, s * 0.46]], [[0.24], [0.15], [0.1]], { seg: 6, radial: 8 }), { belly: 0.6 }));
    bk.add(H, hideTone(lump(0.12, { p: [-1.98, -0.97, s * 0.46] }, { detail: 1 })));
    for (let t = 0; t < 3; t++) {
      const z = s * (0.46 + (t - 1) * 0.08);
      bk.add(mats.beastHorn, tube([[-2.0, -0.98, z], [-2.32, -1.04, z * 1.04], [-2.5, -0.92, z * 1.08]], 0.035, 0.008, { seg: 5, radial: 4 }));
    }
  }
  bk.build(body, { shadow: false, receive: false });

  const neckA = bone('neckA', body, [1.75, 0.4, 0]);
  const neckB = bone('neckB', neckA, [1.55, 0.62, 0]);
  const head = bone('head', neckB, [1.45, -0.05, 0]);
  const jaw = bone('jaw', head, [0.25, -0.1, 0]);
  {
    const a = parts();
    a.add(H, hideTone(sweep([[-0.2, -0.05, 0], [0.75, 0.42, 0], [1.6, 0.64, 0]], [[0.4, 0.36], [0.28, 0.26], [0.22, 0.2]], { seg: 9, radial: 10 }), { belly: 0.8 }));
    for (let i = 0; i < 4; i++) a.add(mats.beastHorn, spikeAt(V3(0.2 + i * 0.38, 0.38 + i * 0.12, 0), V3(-0.5, 1, 0), 0.16, 0.04, 4));
    a.build(neckA, { shadow: false, receive: false });
    const b = parts();
    b.add(H, hideTone(sweep([[-0.1, 0.02, 0], [0.7, 0.12, 0], [1.5, -0.05, 0]], [[0.22, 0.2], [0.19, 0.17], [0.17, 0.15]], { seg: 9, radial: 10 }), { belly: 0.8 }));
    b.add(H, hideTone(lump(0.21, { p: [0, 0.02, 0] }, { detail: 1 })));
    for (let i = 0; i < 3; i++) b.add(mats.beastHorn, spikeAt(V3(0.25 + i * 0.4, 0.18, 0), V3(-0.5, 1, 0), 0.13, 0.035, 4));
    b.build(neckB, { shadow: false, receive: false });
    const h = parts();
    h.add(H, hideTone(lump(0.26, { p: [0.12, 0.04, 0], s: [1.35, 0.78, 0.8] }, { detail: 2, amp: 0.08 })));
    h.add(mats.beastHorn, sweep([[0.32, 0.05, 0], [0.72, 0.03, 0], [1.08, -0.04, 0], [1.3, -0.17, 0]], [[0.15, 0.13], [0.11, 0.09], [0.065, 0.055], [0.012, 0.012]], { seg: 9, radial: 8 }));
    for (const s of [-1, 1]) {
      h.add(mats.beastHorn, tube([[0.02, 0.18, s * 0.12], [-0.35, 0.32, s * 0.2], [-0.75, 0.38, s * 0.24]], 0.055, 0.008, { seg: 6, radial: 5 }));
      h.add(mats.beastHorn, tube([[0.0, 0.05, s * 0.18], [-0.3, 0.06, s * 0.3], [-0.55, 0.02, s * 0.36]], 0.04, 0.006, { seg: 5, radial: 4 }));
      h.add(mats.beastEye, new THREE.SphereGeometry(0.028, 6, 4), { p: [0.33, 0.1, s * 0.16] });
    }
    for (let i = 0; i < 3; i++) h.add(mats.beastHorn, spikeAt(V3(-0.05 - i * 0.18, 0.2 - i * 0.02, 0), V3(-0.8, 1, 0), 0.28 - i * 0.05, 0.035, 4));
    h.build(head, { shadow: false, receive: false });
    const j = parts();
    j.add(mats.beastHorn, sweep([[0.0, 0, 0], [0.45, -0.06, 0], [0.88, -0.1, 0]], [[0.09, 0.1], [0.06, 0.06], [0.012, 0.015]], { seg: 7, radial: 7 }));
    j.add(mats.mouth, lump(0.1, { p: [0.25, 0.04, 0], s: [2.2, 0.35, 0.75] }));
    j.build(jaw, { shadow: false, receive: false });
  }

  const tailA = bone('tailA', body, [-1.55, 0.0, 0]);
  const tailB = bone('tailB', tailA, [-2.1, -0.12, 0]);
  {
    const a = parts();
    a.add(H, hideTone(sweep([[0.1, 0, 0], [-1.0, -0.08, 0], [-2.1, -0.12, 0]], [[0.38, 0.34], [0.24, 0.22], [0.16, 0.15]], { seg: 8, radial: 9 }), { belly: 0.6 }));
    for (let i = 0; i < 5; i++) a.add(mats.beastHorn, spikeAt(V3(-0.3 - i * 0.4, 0.2 - i * 0.02, 0), V3(-0.8, 1, 0), 0.14, 0.035, 4));
    a.build(tailA, { shadow: false, receive: false });
    const b = parts();
    b.add(H, hideTone(sweep([[0.05, 0, 0], [-1.2, -0.04, 0], [-2.5, 0.05, 0]], [[0.16, 0.15], [0.1, 0.09], [0.035, 0.035]], { seg: 9, radial: 7 })));
    b.add(mats.beastHorn, facet(new ConvexGeometry([V3(-2.4, 0.05, 0), V3(-2.75, 0.06, 0.2), V3(-2.75, 0.06, -0.2), V3(-3.15, 0.05, 0), V3(-2.7, 0.12, 0), V3(-2.7, 0.0, 0)])));
    b.build(tailB, { shadow: false, receive: false });
  }
  const wings = [-1, 1].map((s) => {
    const w = wingParts(K, s, n);
    body.add(w.pivot);
    return w;
  });

  // the rider: taller than the other Nine, in black robes, gauntleted
  const rider = bone('rider', body, [1.1, 0.6, 0]);
  const R = mats.nazgulRobe;
  {
    const rb = parts();
    rb.add(mats.saddle, new THREE.BoxGeometry(0.75, 0.14, 0.72), { p: [0, 0.05, 0] });
    for (const s of [-1, 1]) {
      rb.add(R, sweep([[0, 0.25, s * 0.18], [0.32, 0.1, s * 0.48], [0.26, -0.5, s * 0.58]], [[0.12], [0.11], [0.1]], { seg: 6, radial: 7 }));
      rb.add(mats.gauntlet, lump(0.08, { p: [0.28, -0.56, s * 0.6], s: [1.4, 0.7, 0.9] }, { detail: 1 }));
    }
    rb.add(R, sweep([[0, 0.1, 0], [0.04, 0.7, 0], [0.12, 1.3, 0]], [[0.32, 0.34], [0.27, 0.32], [0.2, 0.26]], { seg: 6, radial: 12 }));
    // pauldrons of black iron, spiked
    for (const s of [-1, 1]) {
      rb.add(mats.gauntlet, new THREE.SphereGeometry(0.16, 9, 4, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.7, 1).rotateX(-s * 0.4), { p: [0.1, 1.22, s * 0.26] });
      for (let k = 0; k < 3; k++) rb.add(mats.gauntlet, spikeAt(V3(0.04 + k * 0.06, 1.3, s * 0.3), V3(-0.2, 1, s * 0.5), 0.16, 0.022, 4));
    }
    // the arms forward, one to the reins, one holding his mace
    for (const s of [-1, 1]) {
      rb.add(R, sweep([[0.08, 1.15, s * 0.26], [0.38, 0.92, s * 0.3], [0.72, 0.8, s * 0.22]], [[0.085], [0.075], [0.07]], { seg: 5, radial: 7 }));
      rb.add(mats.gauntlet, lump(0.065, { p: [0.76, 0.78, s * 0.2], s: [1.3, 1, 1] }));
      rb.add(mats.gauntlet, spikeAt(V3(0.7, 0.86, s * 0.22), V3(0.3, 1, 0), 0.12, 0.022, 4));
    }
    rb.add(mats.gauntlet, rod([0.78, 0.6, 0.2], [0.86, 1.5, 0.24], 0.022, 0.022, 5));
    rb.add(mats.gauntlet, lump(0.11, { p: [0.87, 1.58, 0.24] }, { detail: 0, amp: 0.2 }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      rb.add(mats.gauntlet, spikeAt(V3(0.87, 1.58, 0.24), V3(Math.cos(a), 0.4 * (k % 2 ? -1 : 1), Math.sin(a)), 0.2, 0.03, 4));
    }
    rb.build(rider, { shadow: false, receive: false });
  }
  // his head: the hood, and the crown-helm over it, the light of his eyes
  const riderHead = bone('riderHead', rider, [0.16, 1.38, 0]);
  {
    const hb = parts();
    hb.add(R, lump(0.22, { p: [0.02, 0.04, 0], s: [1.05, 1.0, 0.95] }, { detail: 2, amp: 0.05 }));
    hb.add(mats.void, lump(0.14, { p: [0.15, 0.04, 0], s: [0.55, 0.9, 0.85] }, { detail: 1 }));
    // the helm: a tall iron cone, flaring, a face-plate down over the void
    hb.add(mats.crownHelm, new THREE.CylinderGeometry(0.17, 0.215, 0.3, 10, 1, true).translate(0.02, 0.2, 0));
    hb.add(mats.crownHelm, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10).translate(0.02, 0.05, 0));
    hb.add(mats.crownHelm, new THREE.BoxGeometry(0.06, 0.24, 0.24).translate(0.22, 0.04, 0));
    hb.add(mats.void, new THREE.BoxGeometry(0.02, 0.035, 0.17).translate(0.255, 0.08, 0));
    // the crown: tall spikes round its rim, the front ones tallest
    for (let k = 0; k < 11; k++) {
      const a = (k / 11) * TAU;
      const front = Math.max(0, Math.cos(a));
      const len = 0.32 + front * 0.26 + (k % 2) * 0.06;
      hb.add(mats.crownHelm, spikeAt(V3(0.02 + Math.cos(a) * 0.17, 0.32, Math.sin(a) * 0.17), V3(Math.cos(a) * 0.22, 1, Math.sin(a) * 0.22), len, 0.03, 4));
    }
    hb.add(mats.crownHelm, spikeAt(V3(0.02, 0.33, 0), V3(-0.05, 1, 0), 0.22, 0.05, 4));
    hb.build(riderHead, { shadow: false, receive: false });
    const eyes = parts();
    for (const s of [-1, 1]) eyes.add(mats.wraithEye, new THREE.SphereGeometry(0.018, 6, 4), { p: [0.258, 0.08, s * 0.045] });
    eyes.build(riderHead, { shadow: false, receive: false });
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xcfe0ff, 1.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
    glint.position.set(0.27, 0.08, 0);
    glint.scale.setScalar(0.22);
    riderHead.add(glint);
  }
  // the cloak, streaming back from his shoulders: a strip rewritten each frame
  const CW = 5;
  const CH = 8;
  const cloakGeo = new THREE.PlaneGeometry(1, 1, CW, CH);
  const cp = cloakGeo.attributes.position;
  const cloak = new THREE.Mesh(cloakGeo, R);
  cloak.name = 'cloak';
  cloak.frustumCulled = false;
  rider.add(cloak);
  const tatter = Array.from({ length: CW + 1 }, () => r() * 0.5);
  const streamCloak = (t, k) => {
    for (let j = 0; j <= CH; j++) {
      const u = j / CH;
      for (let i = 0; i <= CW; i++) {
        const v = i / CW - 0.5;
        const idx = j * (CW + 1) + i;
        const len = 2.8 - (j === CH ? tatter[i] : 0);
        const x = -u * len;
        const wave = Math.sin(t * 7 - u * 5 + v * 2) * 0.16 * u * k + Math.sin(t * 13 - u * 9) * 0.04 * u;
        cp.setXYZ(idx, 0.02 + x, 1.3 - u * 0.85 + wave, v * (0.6 + u * 0.45) + Math.sin(t * 5 - u * 4) * 0.08 * u);
      }
    }
    cp.needsUpdate = true;
    cloakGeo.computeVertexNormals();
  };

  // its beat carried on from frame to frame, slowing as it glides; how hard
  // it beats and how far he turns his head eased, so nothing jumps
  const E = { t: null, k: null, ph: 0, turn: 0 };
  const animate = (t, { flap = 1, turn = 0 } = {}) => {
    const dt = E.t == null || t < E.t ? 0 : Math.min(0.1, t - E.t);
    E.t = t;
    E.k = E.k == null ? clamp01(flap) : ease(E.k, clamp01(flap), dt, 2.5);
    E.turn = ease(E.turn, turn, dt, 3);
    const k = E.k;
    E.ph += dt * 2.6 * (0.65 + 0.35 * k);
    const ph = E.ph;
    const w = Math.sin(ph) + 0.25 * Math.sin(ph * 2);
    const up = 0.12 + 0.55 * w * k;
    const tip = 0.08 + 0.48 * (Math.sin(ph - 0.7) + 0.25 * Math.sin(ph * 2 - 1.4)) * k;
    for (const W of wings) {
      W.flapIn.rotation.x = W.sIn * up;
      W.flapOut.rotation.x = W.sOut * tip;
    }
    body.position.y = -Math.cos(ph) * 0.2 * k;
    body.rotation.z = Math.cos(ph) * 0.03 * k;
    neckA.rotation.z = Math.sin(ph + 1) * 0.06 + Math.sin(t * 0.6) * 0.04;
    neckA.rotation.y = Math.sin(t * 0.45) * 0.12;
    neckB.rotation.z = -Math.sin(ph + 1.6) * 0.08;
    neckB.rotation.y = Math.sin(t * 0.45 - 0.6) * 0.18;
    head.rotation.z = Math.sin(ph + 2.2) * 0.06 - 0.08;
    head.rotation.y = Math.sin(t * 0.7) * 0.15;
    jaw.rotation.z = -0.08 - 0.42 * Math.pow(Math.max(0, Math.sin(t * 0.8)), 6);
    tailA.rotation.y = Math.sin(t * 1.1) * 0.1;
    tailA.rotation.z = Math.sin(ph - 1) * 0.06 * k;
    tailB.rotation.y = Math.sin(t * 1.1 - 0.9) * 0.22;
    tailB.rotation.z = Math.sin(ph - 1.8) * 0.1 * k;
    rider.rotation.z = Math.cos(ph) * 0.03 * k;
    // he turns his head, and leans a little into it, and lifts his face
    const tr = Math.max(-1.5, Math.min(1.5, E.turn));
    riderHead.rotation.set(0, tr, Math.abs(tr) * 0.12 + Math.sin(t * 0.9) * 0.02, 'YZX');
    rider.rotation.y = tr * 0.25;
    streamCloak(t, 0.6 + k * 0.4);
  };
  animate(0);
  return { group: g, body, head, jaw, wings, rider, riderHead, animate };
}

// ── the orcs ──

const ORC = { skin: C(0x6a5d4c), dark: C(0x3a3028), pale: C(0x8e7e68), iron: C(0x1e1d1e), edge: C(0x403a36), leather: C(0x2e2219), cloth: C(0x2a221c), steel: C(0x625e5a), rust: C(0x5a3420), eye: C(0xd8a640), tooth: C(0xb8aa88), shaft: C(0x2c2016) };
const ORC_METAL = new Set(['iron', 'edge', 'steel']);
// Bones: [parent, position]. The figure faces +x, its right side +z.
const ORC_BONES = {
  root: [null, [0, 0, 0]],
  hips: ['root', [0, 0.78, 0]],
  legL: ['hips', [0, -0.04, -0.12]],
  legR: ['hips', [0, -0.04, 0.12]],
  shinL: ['legL', [0.03, -0.37, 0]],
  shinR: ['legR', [0.03, -0.37, 0]],
  body: ['hips', [0, 0.05, 0]],
  head: ['body', [0.17, 0.5, 0]],
  armL: ['body', [0.07, 0.43, -0.23]],
  armR: ['body', [0.07, 0.43, 0.23]],
  foreL: ['armL', [0, -0.27, 0]],
  foreR: ['armR', [0, -0.27, 0]],
  hand: ['foreR', [0.01, -0.28, 0]],
};
function orcRig(parent, make = () => new THREE.Group()) {
  const b = {};
  const list = [];
  for (const [name, [up, p]] of Object.entries(ORC_BONES)) {
    const o = make();
    o.name = name;
    o.position.set(...p);
    (up ? b[up] : parent).add(o);
    b[name] = o;
    list.push(o);
  }
  return { b, list };
}

// The parts of a Mordor orc, each in its bone's frame: [bone, kind, geo].
// `q` sets the detail: q.rad round, q.seg along, q.fine for the trim;
// q.spear arms him for the march, q.big makes him Shagrat.
function orcParts(seed, q) {
  const r = rng(seed * 37 + 11);
  const out = [];
  const put = (b, kind, geo) => out.push([b, kind, geo]);
  const R = q.rad;
  const k = q.big ? 1.2 : 1;
  const det = q.fine ? 1 : 0;
  const helm = r();
  // the hips: a belt, a kilt of leather strips with a ragged hem
  // (the smallest, for the column, goes without belt, nose and tusks)
  const tiny = R <= 4;
  if (!tiny) put('hips', 'leather', new THREE.CylinderGeometry(0.15 * k, 0.16 * k, 0.12, R).translate(0, 0.02, 0));
  {
    const kilt = new THREE.CylinderGeometry(0.16 * k, 0.23 * k, 0.32, R + (q.fine ? 4 : 0), 1, true);
    const p = kilt.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setY(i, p.getY(i) - r() * 0.09);
    kilt.computeVertexNormals();
    put('hips', 'leather', kilt.translate(0, -0.13, 0));
  }
  if (q.fine) put('hips', 'iron', new THREE.TorusGeometry(0.158 * k, 0.018, 3, R + 2).rotateX(Math.PI / 2).translate(0, 0.06, 0));
  // the legs: thick thighs, bowed shins, iron-shod boots
  for (const s of ['L', 'R']) {
    put(`leg${s}`, 'cloth', sweep([[0, 0, 0], [0.02, -0.18, 0], [0.03, -0.37, 0]], [[0.08 * k], [0.072 * k], [0.056 * k]], { seg: q.seg, radial: R }));
    put(`shin${s}`, 'skin', sweep([[0, 0, 0], [-0.01, -0.19, 0], [-0.03, -0.35, 0]], [[0.056 * k], [0.05 * k], [0.04 * k]], { seg: q.seg, radial: R }));
    put(`shin${s}`, 'leather', lump(0.075 * k, { p: [0.03, -0.38, 0], s: [1.7, 0.6, 1.0] }, { detail: det, amp: 0.06, seed: seed + 3 }));
    if (q.fine) {
      put(`shin${s}`, 'iron', new THREE.SphereGeometry(0.06 * k, R, 3, 0, TAU, 0, Math.PI / 2).rotateZ(-Math.PI / 2).translate(0.035, -0.02, 0));
      put(`shin${s}`, 'leather', new THREE.CylinderGeometry(0.05 * k, 0.047 * k, 0.16, R, 1, true).translate(-0.02, -0.26, 0));
    }
  }
  // the body: a deep chest bent forward, a hump of a back
  put('body', 'skin', sweep([[0, 0, 0], [0.04, 0.2, 0], [0.12, 0.4, 0], [0.17, 0.5, 0]], [[0.13 * k, 0.15 * k, 0.13 * k], [0.16 * k, 0.19 * k, 0.16 * k], [0.15 * k, 0.21 * k, 0.19 * k], [0.07, 0.09, 0.08]], { seg: q.seg + 1, radial: R + 1 }));
  put('body', 'dark', lump(0.12 * k, { p: [0.0, 0.38, 0], s: [0.9, 0.85, 1.35] }, { detail: det, amp: 0.12, seed: seed + 9 }));
  // crude black armour: a breastplate, pauldrons, a back plate
  put('body', 'iron', new THREE.CylinderGeometry(0.2 * k, 0.175 * k, 0.32, R + 2, 1, true, Math.PI * 0.05, Math.PI * 0.9).rotateZ(-0.3).translate(0.06, 0.25, 0));
  for (const s of [-1, 1]) {
    const big = q.big || r() < 0.5;
    put('body', 'iron', new THREE.SphereGeometry(0.105 * k * (big ? 1.2 : 1), R, 3, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.75, 1).rotateX(-s * 0.4).translate(0.07, 0.45, s * 0.24 * k));
    if (q.fine && big) for (let i = 0; i < (q.big ? 3 : 1); i++) put('body', 'edge', spikeAt(V3(0.05 + i * 0.04, 0.5, s * 0.27 * k), V3(-0.3, 1, s * 0.6), 0.1 + (q.big ? 0.06 : 0), 0.018, 4));
  }
  if (q.fine) put('body', 'iron', new THREE.CylinderGeometry(0.2 * k, 0.2 * k, 0.26, R, 1, true, Math.PI * 1.15, Math.PI * 0.7).rotateZ(-0.35).translate(0.02, 0.3, 0));
  if (q.big && q.fine) for (let i = 0; i < 4; i++) put('body', 'edge', spikeAt(V3(-0.12 + i * 0.03, 0.22 + i * 0.08, 0), V3(-1, 0.6, 0), 0.12, 0.022, 4));
  // the head: a low skull, a heavy brow, an underslung jaw, tusks, small
  // yellow eyes, ragged ears; and the helm
  put('head', 'skin', lump(0.105 * k, { p: [0.02, 0.07, 0], s: [1.15, 0.92, 0.95] }, { detail: det + 1, amp: 0.1, seed: seed + 5 }));
  put('head', 'dark', lump(0.06 * k, { p: [0.1, 0.1, 0], s: [0.8, 0.45, 1.6] }, { detail: det, amp: 0.1, seed: seed + 6 }));
  put('head', 'skin', lump(0.072 * k, { p: [0.085, -0.02, 0], s: [0.95, 0.66, 1.12] }, { detail: det, amp: 0.1, seed: seed + 7 }));
  if (!tiny) put('head', 'dark', new THREE.ConeGeometry(0.03 * k, 0.07, 4).rotateZ(-Math.PI / 2 - 0.5).translate(0.14 * k, 0.05, 0));
  for (const s of [-1, 1]) {
    put('head', 'skin', along(new THREE.ConeGeometry(0.035, 0.13 * k, 3).scale(1, 1, 0.4).translate(0, 0.065 * k, 0), V3(-0.5, 0.35, s), V3(0.0, 0.08, s * 0.09 * k)));
    if (q.fine) put('head', 'eye', new THREE.SphereGeometry(0.017, 5, 4).translate(0.12 * k, 0.075, s * 0.042 * k));
    if (!tiny) put('head', 'tooth', new THREE.ConeGeometry(0.012 * k, 0.05 * k, 3).rotateZ(-0.2).translate(0.13 * k, 0.005, s * 0.035 * k));
  }
  if (helm < 0.85 || q.big) {
    put('head', 'iron', new THREE.SphereGeometry(0.128 * k, R + 1, q.fine ? 4 : 3, 0, TAU, 0, Math.PI * 0.5).scale(1.15, 0.85, 1.05).translate(0.015, 0.085, 0));
    put('head', 'iron', new THREE.BoxGeometry(0.03, 0.09, 0.022).translate(0.152 * k, 0.07, 0));
    if (q.fine && helm < 0.4) put('head', 'iron', new THREE.CylinderGeometry(0.155 * k, 0.16 * k, 0.02, R + 1).translate(0.02, 0.09, 0));
    if (q.fine && (helm > 0.55 || q.big)) for (let i = 0; i < 3; i++) put('head', 'edge', spikeAt(V3(0.06 - i * 0.06, 0.18 * k - i * 0.01, 0), V3(-0.3, 1, 0), 0.1 + (q.big ? 0.05 : 0), 0.02, 4));
    if (q.big) for (const s of [-1, 1]) put('head', 'edge', tube([[0, 0.12, s * 0.1], [-0.02, 0.22, s * 0.2], [-0.1, 0.3, s * 0.22]], 0.025, 0.004, { seg: 4, radial: 4 }));
  }
  // the arms: long, the hands big
  for (const s of ['L', 'R']) {
    put(`arm${s}`, 'skin', sweep([[0, 0, 0], [0, -0.14, 0], [0, -0.27, 0]], [[0.062 * k], [0.056 * k], [0.046 * k]], { seg: q.seg, radial: R }));
    put(`fore${s}`, 'skin', sweep([[0, 0, 0], [0.005, -0.13, 0], [0.01, -0.26, 0]], [[0.047 * k], [0.046 * k], [0.038 * k]], { seg: q.seg, radial: R }));
    put(`fore${s}`, 'skin', lump(0.048 * k, { p: [0.012, -0.29, 0], s: [1, 1.25, 0.75] }, { detail: det, amp: 0.15, seed: seed + 11 }));
    if (q.fine) put(`fore${s}`, 'iron', new THREE.CylinderGeometry(0.055 * k, 0.05 * k, 0.12, R, 1, true).translate(0.006, -0.16, 0));
  }
  // the weapon, in the hand's frame, along its +x: a spear for the march,
  // or a jagged blade
  if (q.spear) {
    put('hand', 'shaft', new THREE.CylinderGeometry(0.017, 0.017, 2.2, 4).rotateZ(-Math.PI / 2).translate(0.25, 0, 0));
    put('hand', 'steel', new THREE.ConeGeometry(0.05, 0.3, 4).scale(1, 1, 0.35).rotateZ(-Math.PI / 2).translate(1.5, 0, 0));
  } else {
    const L = q.big ? 0.95 : 0.66 + r() * 0.12;
    const wd = q.big ? 1.35 : 1;
    const sh = new THREE.Shape();
    sh.moveTo(0.02, 0.018 * wd);
    sh.quadraticCurveTo(L * 0.5, 0.05 * wd, L * 0.92, 0.07 * wd);
    sh.lineTo(L, 0.02 * wd);
    // a hooked point, then the edge back, notched and broken
    sh.lineTo(L * 0.86, -0.07 * wd);
    for (let i = 0; i < 5; i++) {
      const x = L * (0.78 - i * 0.14);
      sh.lineTo(x + L * 0.04, -(0.085 + r() * 0.02) * wd);
      sh.lineTo(x, -(0.055 + r() * 0.02) * wd);
    }
    sh.lineTo(0.02, -0.03 * wd);
    sh.closePath();
    put('hand', 'steel', new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false, curveSegments: 3 }).translate(0, 0, -0.007));
    put('hand', 'leather', new THREE.CylinderGeometry(0.02, 0.02, 0.15, 5).rotateZ(-Math.PI / 2).translate(-0.06, 0, 0));
    put('hand', 'iron', new THREE.BoxGeometry(0.03, 0.1 * wd, 0.04).translate(0.02, -0.005, 0));
  }
  return out;
}

// The orcs' stance, march, run and brawl: `fighting` 0..1 crouches and
// hacks with the blade; `spear` carries a spear upright on the march.
function orcPose(b, t, { running = false, fighting = 0, march = false, ph0 = 0, spear = false } = {}) {
  const w = running ? 1 : march ? 0.55 : 0;
  const f = clamp01(fighting);
  const ph = t * (running ? 10.5 : 6.4) + ph0;
  const sw = Math.sin(ph) * w;
  const idle = Math.sin(t * 1.9 + ph0);
  // the brawl: wind up, a fast hack down, recover
  const fp = t * 0.62 + ph0 * 0.3;
  const cyc = fp - Math.floor(fp);
  const raise = cyc < 0.5 ? smooth(0, 0.5, cyc) : cyc < 0.62 ? 1 - smooth(0.5, 0.62, cyc) : 0;
  const lunge = cyc > 0.5 && cyc < 0.85 ? Math.sin(((cyc - 0.5) / 0.35) * Math.PI) : 0;
  b.hips.position.set(lunge * 0.1 * f, 0.78 - 0.05 * w + Math.abs(Math.cos(ph)) * 0.05 * w - f * 0.1 + idle * 0.005, 0);
  b.hips.rotation.set(0, Math.sin(ph) * 0.12 * w + f * 0.3, 0);
  b.legL.rotation.set(0.04, 0, sw * 0.75 + f * 0.5 + 0.05 * (1 - w));
  b.legR.rotation.set(-0.04, 0, -sw * 0.75 - f * 0.3 - 0.05 * (1 - w));
  b.shinL.rotation.z = -Math.max(0, -Math.cos(ph)) * 1.1 * w - f * 0.6 - 0.12;
  b.shinR.rotation.z = -Math.max(0, Math.cos(ph)) * 1.1 * w - f * 0.35 - 0.12;
  b.body.rotation.set(0, -Math.sin(ph) * 0.18 * w + f * (raise * 0.45 - lunge * 0.5), -0.3 - 0.22 * w - f * (0.1 + lunge * 0.22) + idle * 0.02);
  b.head.rotation.set(0, Math.sin(t * 0.8 + ph0) * 0.3 * (1 - w) * (1 - f), 0.28 + 0.22 * w + f * 0.12);
  b.armL.rotation.set(-0.2, 0, -sw * 0.8 + f * 0.6 + 0.1);
  b.foreL.rotation.z = 0.5 + Math.max(0, -sw) * 0.6 + f * 0.7;
  if (spear) {
    b.armR.rotation.set(-0.12, 0, 0.25 + sw * 0.15);
    b.foreR.rotation.z = 1.25;
    b.hand.rotation.set(0.05, 0, Math.PI / 2 - (b.body.rotation.z + b.armR.rotation.z + b.foreR.rotation.z));
  } else {
    b.armR.rotation.set(0.15 - raise * 0.2 * f, 0, mix(0.35 + sw * 0.55, 2.8 * raise + 0.35 * lunge, f));
    b.foreR.rotation.z = mix(1.05 + Math.max(0, sw) * 0.3, 0.5 + raise * 1.0, f);
    b.hand.rotation.set(0, 0, mix(0.15, -0.4 + raise * 0.7 + lunge * 0.3, f));
  }
}

// Colour an orc's parts: mottled grey-brown skin, its iron, leather, rags.
function orcTone(kind, n) {
  const base = ORC[kind] ?? ORC.skin;
  return (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 9, y * 9, z * 9);
    if (kind === 'skin' || kind === 'dark') {
      out.copy(kind === 'dark' ? ORC.dark : ORC.skin).multiplyScalar(0.72 + m * 0.5);
      out.lerp(ORC.dark, smooth(0.55, 0.75, noise3(n, x * 4 + 3, y * 4, z * 4)) * 0.6);
      out.lerp(ORC.pale, clamp01(-ny) * 0.25);
    } else if (kind === 'iron' || kind === 'edge' || kind === 'steel') {
      out.copy(base).multiplyScalar(0.75 + m * 0.5).lerp(ORC.rust, smooth(0.55, 0.78, noise3(n, x * 7 + 5, y * 7, z * 7)) * (kind === 'steel' ? 0.6 : 0.4));
    } else out.copy(base).multiplyScalar(0.8 + m * 0.4);
  };
}

// A Mordor orc, about 1.5 m and hunched; `big` is Shagrat, near 1.9 m and
// heavier. Skinned on one skeleton: two meshes. Faces +x.
// animate(t, { running, fighting }).
function orc(K, seed = 1, { big = false } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = big ? 'shagrat' : 'orc';
  const { b, list } = orcRig(g, () => new THREE.Bone());
  g.updateMatrixWorld(true);
  const n = makeNoise(seed * 13 + 5);
  const sk = skinParts(list);
  for (const [name, kind, geo] of orcParts(seed, { rad: 7, seg: 3, fine: true, big })) {
    tint(geo, orcTone(kind, n));
    sk.add(ORC_METAL.has(kind) || kind === 'leather' || kind === 'shaft' ? mats.orcGear : mats.orcSkin, b[name], geo);
  }
  const meshes = sk.build(g);
  const r = rng(seed * 5 + 1);
  const tall = big ? 1.28 : 1.0 + r() * 0.08;
  b.root.scale.setScalar(tall);
  const ph0 = r() * TAU;
  const animate = (t, { running = false, fighting = 0 } = {}) => orcPose(b, t, { running, fighting, ph0 });
  animate(0);
  return { group: g, bones: b, head: b.head, meshes, animate };
}

// One orc of the host on the march, his spear upright, as one
// vertex-coloured geometry for a column (an InstancedMesh, under 600
// triangles).
function orcColumnGeo() {
  const root = new THREE.Group();
  const { b } = orcRig(root);
  orcPose(b, 0.25, { march: true, spear: true });
  root.updateMatrixWorld(true);
  const n = makeNoise(5);
  const list = orcParts(5, { rad: 4, seg: 2, fine: false, spear: true }).map(([name, kind, geo]) => tint(geo.applyMatrix4(b[name].matrixWorld), orcTone(kind, n)));
  return oneGeo(list);
}

// A dead orc sprawled on the flags, as one geometry (for the court).
function deadOrcGeo(seed) {
  const r = rng(seed * 3 + 1);
  const root = new THREE.Group();
  const { b } = orcRig(root);
  const face = r() < 0.5;
  b.hips.position.set(0, 0.16, 0);
  b.hips.rotation.set(face ? Math.PI : 0, r() * TAU, face ? -Math.PI / 2 : Math.PI / 2, 'YXZ');
  b.body.rotation.set((r() - 0.5) * 0.4, 0, -0.2 + (r() - 0.5) * 0.3);
  b.head.rotation.set((r() - 0.5) * 1.2, (r() - 0.5) * 0.8, 0.4);
  b.legL.rotation.set(r() * 0.5, 0, (r() - 0.3) * 0.8);
  b.legR.rotation.set(-r() * 0.5, 0, (r() - 0.6) * 0.8);
  b.shinL.rotation.z = -r() * 0.9;
  b.shinR.rotation.z = -r() * 0.6;
  b.armL.rotation.set(-0.4 - r() * 1.6, 0, (r() - 0.5) * 1.4);
  b.armR.rotation.set(0.4 + r() * 1.6, 0, (r() - 0.5) * 1.4);
  b.foreL.rotation.z = r() * 1.2;
  b.foreR.rotation.z = r() * 1.2;
  root.updateMatrixWorld(true);
  const n = makeNoise(seed + 7);
  const list = orcParts(seed + 20, { rad: 5, seg: 2, fine: false, spear: false })
    .filter(([name]) => name !== 'hand' || r() < 0.3)
    .map(([name, kind, geo]) => tint(geo.applyMatrix4(b[name].matrixWorld), orcTone(kind, n)));
  return list;
}

// ── the endless stairs ──

const ROCK = { base: C(0x4a4743), dark: C(0x141312), pale: C(0x6e6a63), wet: C(0x26262a), rust: C(0x4a3428), worn: C(0x7a7468), fresh: C(0x8e8678) };

// A jagged black boulder about 2 m across: broken flat-faced rock, a
// little paler where its faces turn up. One geometry.
function rockGeo(seed = 1) {
  const n = makeNoise(seed + 5);
  const g = shardGeo(seed * 7 + 1, { detail: 2, planes: 9, cut: 0.5, amp: 0.6 });
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) * 1.5 + 0.55;
    p.setXYZ(i, p.getX(i) * 2.1, y < -0.05 ? -0.05 + (y + 0.05) * 0.2 : y, p.getZ(i) * 1.8);
  }
  g.computeVertexNormals();
  boxUV(g, 0.7);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(ROCK.base).multiplyScalar(0.6 + noise3(n, x * 2, y * 2, z * 2) * 0.6);
    out.lerp(ROCK.pale, smooth(0.4, 0.9, ny) * 0.35);
    out.lerp(ROCK.dark, (1 - smooth(-0.05, 0.5, y)) * 0.5);
    out.lerp(ROCK.rust, smooth(0.6, 0.75, noise3(n, x * 1.5 + 3, y * 1.5, z * 1.5)) * 0.3);
  });
  g.computeBoundingSphere();
  return g;
}

// The endless stairs up a sheer black cliff, its face the plane z = 0
// facing +z, 60 m across and 80 high (its rim 72 to 86 m up, notched where
// the stair comes out at the top), running on down out of sight below the
// foot. The stair follows at(s) exactly, `steps` narrow worn steps 1.24 m
// across, cut into the face: the rock rises sheer behind each tread and
// falls away beneath it, no rail. Wider on the ledges where you rest; on
// the crumbling stretches (rules.js STAIRS) the steps are cracked, tilted
// and broken back at their edges, rubble lying on them. A landing at each
// turn, a shelf at the foot.
function stairs(K, { at, len = STAIRS.len, steps = 260 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'stairs';
  const n = makeNoise(311);
  const r = rng(313);
  const P = (s) => at(Math.max(0, Math.min(len, s)));
  const crumbleAt = (s) => STAIRS.crumble.some(([a, b]) => s >= a && s <= b);
  const ledgeAt = (s) => STAIRS.ledges.some((l) => Math.abs(s - l) < 2.5);
  // the stair's line, finely, binned along x for the cliff to find
  const line = [];
  const bins = new Map();
  const BIN = 0.5;
  for (let i = 0; i <= len * 4; i++) {
    const s = i / 4;
    const [x, y, z] = P(s);
    const pt = { s, x, y, z, crumble: crumbleAt(s), ledge: ledgeAt(s) };
    line.push(pt);
    const k = Math.floor(x / BIN);
    if (!bins.has(k)) bins.set(k, []);
    bins.get(k).push(pt);
  }
  const near = (x) => {
    const k = Math.floor(x / BIN);
    return [...(bins.get(k - 1) || []), ...(bins.get(k) || []), ...(bins.get(k + 1) || [])].filter((p) => Math.abs(p.x - x) < 0.5);
  };
  const top = P(len);

  // ── the cliff
  const W = 60;
  const hw = W / 2;
  const below = 40;
  const cuts = [-hw - 2];
  while (cuts[cuts.length - 1] < hw + 2) cuts.push(cuts[cuts.length - 1] + 1.2 + r() * 3.4);
  const slabs = cuts.map(() => ({ out: (r() - 0.5) * 0.9, layer: 2.5 + r() * 4, phase: r() * 6, deep: r() < 0.1, tilt: (r() - 0.5) * 0.5 }));
  const slabAt = (x) => {
    let i = 0;
    while (i < cuts.length - 2 && x > cuts[i + 1]) i++;
    return [i, Math.min(x - cuts[i], cuts[i + 1] - x)];
  };
  // the rock's own face, before the stair is cut: never proud of z = 0.2
  const baseFace = (x, y) => {
    const [i, edge] = slabAt(x);
    const sl = slabs[i];
    // the joints wander, and fade in and out up the face
    const crack = (1 - smooth(0.04, 0.4, edge)) * smooth(0.3, 0.55, n(x * 0.2 + 4, y * 0.05));
    const L = Math.floor((y + sl.phase + x * sl.tilt) / sl.layer);
    let z = -0.55 + sl.out * 0.6 + (n(L * 1.73 + i * 7.1, 9.3) - 0.5) * 0.8;
    z -= crack * (sl.deep ? 1.8 : 0.7);
    z += (fbm(n, x * 0.05 + 3, y * 0.04, { octaves: 3 }) - 0.5) * 1.6;
    z += (fbm(n, x * 0.7 + 9, y * 0.5, { octaves: 2 }) - 0.5) * 0.3;
    z -= smooth(hw - 9, hw, Math.abs(x)) * 7;
    return [Math.min(0.2, z), crack];
  };
  // the cut: rock up behind each tread to its back edge, rock falling away
  // under it, and always clear headroom over a tread
  const face = (x, y) => {
    let [z, crack] = baseFace(x, y);
    let cut = 0;
    let clear = Infinity;
    for (const p of near(x)) {
      const dy = y - p.y;
      const back = p.z - 0.62;
      const wall = 2.4 + n(p.s * 0.4, 3.3) * 1.6;
      if (dy > -0.3 && dy < wall) {
        const k = 1 - smooth(wall - 0.9, wall, dy);
        z = Math.max(z, mix(z, back - 0.02 - n(x * 1.3, y * 1.3) * 0.18, k));
        cut = Math.max(cut, k);
      }
      if (dy <= -0.3 && dy > -3.4) {
        const lip = p.crumble ? 0.05 : 0.42;
        z = Math.max(z, mix(z, p.z + lip - (n(x * 0.9 + 5, y * 0.9) - 0.5) * 0.3, smooth(-3.4, -0.35, dy)));
      }
      if (dy > -0.05 && dy < 2.1) clear = Math.min(clear, back - 0.02);
    }
    return [Math.min(z, clear), crack, cut];
  };
  // the rim: jagged teeth, low where the stair comes out at the top
  const tops = [];
  for (let x = -hw; x < hw; x += 1.8 + r() * 3) tops.push([x, 1 + r() * 7, 0.8 + r() * 1.8]);
  const notch = (x) => 1 - smooth(3, 7, Math.abs(x - top[0]));
  const rimAt = (x) => {
    let y = 0;
    for (const [px, ph, pw] of tops) y = Math.max(y, ph * (1 - Math.abs(x - px) / pw));
    return mix(78 + y, top[1] + 1.4, notch(x)) - smooth(hw - 10, hw, Math.abs(x)) * 6;
  };
  const nx = 80;
  const nLow = 12;
  const nHigh = 124;
  const nf = nLow + nHigh;
  const nt = 8;
  const back = 10;
  const Wc = nx + 1;
  const rows = nf + nt + 1;
  const pos = new Float32Array(Wc * rows * 3);
  const col = new Float32Array(Wc * rows * 3);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = -hw + (i / nx) * W;
      const rim = rimAt(x);
      let y;
      let z;
      let crack = 0;
      let cut = 0;
      if (j <= nf) {
        y = j <= nLow ? mix(-below, -2, j / nLow) : mix(-2, rim, (j - nLow) / nHigh);
        [z, crack, cut] = face(x, y);
      } else {
        const d = ((j - nf) / nt) * back;
        const tooth = (n(x * 0.4, d * 0.3 + 7) - 0.5) * 3 * smooth(0.5, 3, d) * (1 - notch(x));
        y = rim + tooth - smooth(0, back, d) * 2;
        z = face(x, rim)[0] - d;
        x += (r() - 0.5) * 0.2;
      }
      const k = (j * Wc + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
      // black rock, darker in the joints, wet streaks down it; worn paler
      // where the stair is cut
      const v = fbm(n, x * 0.3 + 11, y * 0.3, { octaves: 3 });
      _kc.copy(ROCK.base).multiplyScalar(0.6 + v * 0.6);
      _kc.lerp(ROCK.dark, crack * 0.55);
      _kc.lerp(ROCK.wet, smooth(0.55, 0.78, n(x * 1.4 + 2, 0.5)) * 0.6);
      _kc.lerp(ROCK.worn, cut * 0.25);
      _kc.lerp(ROCK.dark, clamp01(-y / below) * 0.6);
      col[k] = _kc.r;
      col[k + 1] = _kc.g;
      col[k + 2] = _kc.b;
    }
  }
  const idx = [];
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * Wc + i;
      if ((i + j) % 2) idx.push(a, a + 1, a + Wc, a + 1, a + Wc + 1, a + Wc);
      else idx.push(a, a + 1, a + Wc + 1, a, a + Wc + 1, a + Wc);
    }
  }
  let cliff = new THREE.BufferGeometry();
  cliff.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cliff.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cliff.setIndex(idx);
  cliff = facet(cliff);
  {
    const p = cliff.attributes.position;
    const nr = cliff.attributes.normal;
    const cc = cliff.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const ny = nr.getY(i);
      if (ny > 0.5) {
        _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).lerp(ROCK.pale, smooth(0.5, 0.95, ny) * 0.35);
        cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
      } else if (ny < -0.3) {
        _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).multiplyScalar(0.6);
        cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
      }
    }
  }
  const rock = [cliff];

  // ── the steps
  const step = [];
  const rubble = [];
  const tone = (geo, fresh = 0) =>
    tint(geo, (x, y, z, out, nx2, ny) => {
      out.copy(ROCK.base).multiplyScalar(0.75 + noise3(n, x * 3, y * 3, z * 3) * 0.5);
      if (ny > 0.6) out.lerp(ROCK.worn, 0.45 * (1 - Math.abs(z - P((y / 70) * len)[2]) * 0.6));
      else out.lerp(ROCK.dark, 0.3);
      out.lerp(ROCK.fresh, fresh);
    });
  const ds = len / steps;
  for (let i = 0; i < steps; i++) {
    const s0 = i * ds;
    const s1 = s0 + ds;
    const a = P(s0);
    const b = P(s1);
    const m = P(s0 + ds / 2);
    const rise = Math.abs(b[1] - a[1]);
    const run = Math.max(0.12, Math.abs(b[0] - a[0]));
    const crumble = crumbleAt(s0);
    const ledge = ledgeAt(s0);
    const depthOut = ledge ? 1.7 : 0.62;
    let front = m[2] + depthOut;
    let tilt = 0;
    let drop = 0;
    let fresh = 0;
    if (crumble) {
      const roll = r();
      if (roll < 0.45) {
        front = m[2] + 0.12 + r() * 0.3;
        fresh = 0.3;
      } else if (roll < 0.7) {
        tilt = (r() - 0.5) * 0.14;
        drop = 0.03 + r() * 0.05;
      }
    }
    const backZ = m[2] - 0.62;
    const depth = front - backZ;
    const thick = 0.32 + rise;
    const geo = new THREE.BoxGeometry(run + 0.05, thick, depth, 1, 1, 3);
    const p = geo.attributes.position;
    const dir = Math.sign(b[0] - a[0]) || 1;
    for (let v = 0; v < p.count; v++) {
      let x = p.getX(v);
      let y = p.getY(v);
      const z = p.getZ(v);
      const zw = (z + depth / 2) / depth;
      if (y > 0) {
        // worn hollow down the middle of the tread, the nosing rounded off
        y -= 0.035 * Math.sin(Math.PI * clamp01((zw * depth) / 1.24));
        if (x * dir < 0) y -= 0.025;
        y -= Math.max(0, zw - 0.85) * 0.12;
      }
      x += (n(i * 1.7 + v, 2.1) - 0.5) * 0.04;
      y += (n(i * 1.3 + v, 5.7) - 0.5) * 0.03;
      p.setXYZ(v, x, y, z + (n(i * 0.9 + v, 8.3) - 0.5) * 0.05);
    }
    geo.rotateX(tilt);
    geo.translate((a[0] + b[0]) / 2, m[1] - thick / 2 - drop, backZ + depth / 2);
    step.push(tone(facet(geo), fresh));
    // cracked: a split across the tread, its far half dropped
    if (crumble && r() < 0.35) {
      const shard = shardGeo(900 + i, { detail: 0, planes: 5, cut: 0.4 });
      shard.scale(run * 0.7, 0.2, 0.5).translate(m[0], m[1] - 0.18, front + 0.1);
      rubble.push(tone(shard, 0.4));
    }
    // loose stones on the crumbling stretches, and at the foot of the wall
    if ((crumble && r() < 0.5) || r() < 0.06) {
      const k = 0.08 + r() * 0.14;
      const st = shardGeo(1300 + i, { detail: 0, planes: 4, cut: 0.4 });
      st.scale(k * 1.4, k, k * 1.2).rotateY(r() * TAU).translate(m[0] + (r() - 0.5) * run, m[1] + k * 0.25, backZ + 0.12 + r() * (crumble ? 0.5 : 0.2));
      rubble.push(tone(st, crumble ? 0.35 : 0));
    }
  }
  // a landing at each turn, where the stair doubles back
  for (let s = 0; s <= len; s += 0.25) {
    const a = P(s - 0.5);
    const b = P(s);
    const c = P(s + 0.5);
    if ((b[0] - a[0]) * (c[0] - b[0]) < 0) {
      const out = Math.sign(b[0]) || 1;
      const slab = new THREE.BoxGeometry(1.8, 0.6, 1.4).translate(b[0] + out * 0.5, b[1] - 0.3, b[2]);
      rubble.push(tone(facet(slab)));
      s += 2;
    }
  }
  // the shelf at the foot, and the top where the stair comes out
  for (const [p, wx] of [[P(0), 1], [top, -1]]) {
    const pts = [];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      pts.push(V3(p[0] + Math.cos(a) * (2.6 + r() * 0.8) - wx * 1.2, p[1] - (k % 2 ? 0 : 2.4 + r()), p[2] - 0.5 + Math.sin(a) * (2.2 + r() * 0.5)));
    }
    for (let k = 0; k < 8; k++) pts.push(V3(p[0] - wx * 1.2 + (r() - 0.5) * 4, p[1] - 0.02 - r() * 0.04, p[2] - 0.5 + (r() - 0.5) * 3.2));
    rubble.push(tone(facet(new ConvexGeometry(pts))));
  }
  const rockGeo2 = oneGeo([...rock, ...step, ...rubble]);
  boxUV(rockGeo2, 0.35);
  const mesh = new THREE.Mesh(rockGeo2, mats.rock);
  mesh.name = 'cliffAndStair';
  g.add(mesh);
  return { group: g, mesh };
}

// ── Shelob's lair ──

// A sheet of web about 3 m across and 2 high, strung across a corner: its
// top edge and sides anchored, its belly sagging out (+z) and down, torn
// at its lower edge, a few thick cables along it. One geometry for
// mats.web.
function webGeo(seed = 1) {
  const r = rng(seed * 11 + 3);
  const n = makeNoise(seed + 21);
  const nu = 10;
  const nv = 7;
  const w = 2.6 + r() * 0.8;
  const h = 1.7 + r() * 0.6;
  const pos = [];
  const uv = [];
  const idx = [];
  const tear = [];
  for (let i = 0; i <= nu; i++) tear.push(r() * 0.35 * Math.sin((Math.PI * i) / nu));
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      const belly = Math.sin(Math.PI * u) * Math.sin((Math.PI * (1 - v)) / 2 + Math.PI / 2) * (0.5 + r() * 0.08);
      const vv = Math.max(0, v - (j === 0 ? tear[i] : 0));
      const x = (u - 0.5) * w + (n(u * 5, v * 5) - 0.5) * 0.15;
      const y = h * (1 - vv) - Math.sin(Math.PI * u) * 0.35 * (1 - vv) + (n(u * 4 + 3, v * 4) - 0.5) * 0.1;
      const z = belly * (0.7 - 0.5 * vv);
      pos.push(x, h - y, z);
      uv.push(u * 0.94, vv);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      if (j < 2 && r() < 0.12) continue;
      idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  const sheet = new THREE.BufferGeometry();
  sheet.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sheet.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sheet.setIndex(idx);
  sheet.computeVertexNormals();
  const list = [sheet];
  // cables along its edges and across it: thin ribbons of solid thread
  const cable = (pts, wd) => {
    const c = new THREE.CatmullRomCurve3(pts);
    const seg = 8;
    const p2 = [];
    const u2 = [];
    const i2 = [];
    for (let k = 0; k <= seg; k++) {
      const pt = c.getPoint(k / seg);
      const tg = c.getTangent(k / seg);
      const sd = V3(-tg.y, tg.x, 0.3).normalize().multiplyScalar(wd);
      p2.push(pt.x - sd.x, pt.y - sd.y, pt.z - sd.z, pt.x + sd.x, pt.y + sd.y, pt.z + sd.z);
      u2.push(0.97, k / seg, 0.99, k / seg);
    }
    for (let k = 0; k < seg; k++) i2.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3));
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(u2, 2));
    gg.setIndex(i2);
    gg.computeVertexNormals();
    list.push(gg);
  };
  const at = (u, v) => {
    const i = Math.round(u * nu);
    const j = Math.round(v * nv);
    const k = (j * (nu + 1) + i) * 3;
    return V3(pos[k], pos[k + 1], pos[k + 2]);
  };
  cable([at(0.1, 1), at(0.3, 0.9), at(0.5, 0.95), at(0.7, 0.9), at(0.9, 1)], 0.009);
  cable([at(0.05, 0.8), at(0.3, 0.5), at(0.55, 0.35), at(0.75, 0.5), at(0.95, 0.75)], 0.007);
  for (let k = 0; k < 3; k++) {
    const u = 0.15 + r() * 0.7;
    cable([at(u, 0), at(u + (r() - 0.5) * 0.2, 0.5), at(u + (r() - 0.5) * 0.3, 1)], 0.008);
  }
  const g = oneGeo(list);
  tint(g, (x, y, z, out) => out.setRGB(0.86, 0.87, 0.84).multiplyScalar(0.8 + noise3(n, x * 2, y * 2, z * 2) * 0.35));
  return g;
}

// Bones on the floor of the lair: long bones, ribs, skulls, all old and
// gnawed, yellowed, dirt in their hollows. Pieces as one geometry each,
// laid on y = 0.
function longBone(len, r0) {
  const list = [rod([0, 0, 0], [len, 0, 0], r0, r0 * 0.8, 5), lump(r0 * 1.7, { p: [0, 0, 0], s: [1, 0.9, 1.3] }, { detail: 0, amp: 0.15 }), lump(r0 * 1.5, { p: [len, 0, 0], s: [1, 0.9, 1.4] }, { detail: 0, amp: 0.15 })];
  return oneGeo(list);
}
function skullGeo(seed, k = 1) {
  const list = [lump(0.1 * k, { p: [0, 0.09 * k, 0], s: [1.2, 1, 0.92] }, { detail: 1, amp: 0.06, seed }).toNonIndexed(), lump(0.06 * k, { p: [0.09 * k, 0.04 * k, 0], s: [0.9, 0.85, 1] }, { detail: 0, amp: 0.1, seed: seed + 1 })];
  const g = oneGeo(list);
  // the sockets and the nose, dark
  tint(g, (x, y, z, out) => {
    const eye = Math.min(Math.hypot(x - 0.12 * k, y - 0.09 * k, z - 0.045 * k), Math.hypot(x - 0.12 * k, y - 0.09 * k, z + 0.045 * k));
    out.setRGB(0.72, 0.66, 0.54).multiplyScalar(eye < 0.035 * k ? 0.15 : 1);
  });
  return g;
}

// Shelob's tunnels: rough black rock round the corridors in `list` (each
// [x0, z0, x1, z1] along its middle, 3 m wide, all at y = 0). A floor, and
// walls that rise sheer to 1.1 m and arch over to 3.2 m, one surface over
// the whole network so the joins don't show. The two ways out, at (0, 0)
// and (80, −8), stay open, each in a rough face of rock. Inside: web in
// sheets across the corners and over the roof, strands hanging, bones and
// skulls along the walls.
function tunnels(K, list, { r: rad = 1.6 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'lair';
  const n = makeNoise(503);
  const rr = rng(505);
  const T = 1.5;
  const G = 0.25;
  // inside the corridors' rectangles (as layout.js inTunnels)
  const inside = (x, z) => list.some(([x0, z0, x1, z1]) => x >= Math.min(x0, x1) - T && x <= Math.max(x0, x1) + T && z >= Math.min(z0, z1) - T && z <= Math.max(z0, z1) + T);
  const ends = [
    [0, 0, -1, 0],
    [80, -8, 1, 0],
  ];
  // the corridors, run on past the two ways out, for the arch's shape
  const long = list.map(([x0, z0, x1, z1]) => {
    const q = [x0, z0, x1, z1];
    for (const [ex, ez, dx, dz] of ends) {
      if (x0 === ex && z0 === ez) [q[0], q[1]] = [x0 + dx * 4, z0 + dz * 4];
      if (x1 === ex && z1 === ez) [q[2], q[3]] = [x1 + dx * 4, z1 + dz * 4];
    }
    return q;
  });
  // how far a point is in from the nearest wall
  const inDist = (x, z) => {
    let best = -Infinity;
    for (const [x0, z0, x1, z1] of long) {
      const dx = Math.max(Math.min(x0, x1) - T - x, x - Math.max(x0, x1) - T);
      const dz = Math.max(Math.min(z0, z1) - T - z, z - Math.max(z0, z1) - T);
      best = Math.max(best, -Math.max(dx, dz));
    }
    return best;
  };
  const openAt = (x, z) => ends.some(([ex, ez, dx, dz]) => (dx ? Math.abs(x - (ex + dx * T)) < 0.01 && Math.abs(z - ez) <= T + 0.01 : Math.abs(z - (ez + dz * T)) < 0.01 && Math.abs(x - ex) <= T + 0.01));
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x0, z0, x1, z1] of list) {
    minX = Math.min(minX, x0, x1);
    maxX = Math.max(maxX, x0, x1);
    minZ = Math.min(minZ, z0, z1);
    maxZ = Math.max(maxZ, z0, z1);
  }
  const ox = minX - T;
  const oz = minZ - T;
  const NX = Math.round((maxX - minX + 2 * T) / G);
  const NZ = Math.round((maxZ - minZ + 2 * T) / G);
  const cellIn = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && inside(ox + (i + 0.5) * G, oz + (j + 0.5) * G);
  const cells = new Uint8Array(NX * NZ);
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) cells[j * NX + i] = cellIn(i, j) ? 1 : 0;
  const isIn = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && cells[j * NX + i] === 1;
  // a corner of the lattice: on the wall if any cell round it is rock
  const onWall = (i, j) => !(isIn(i - 1, j - 1) && isIn(i, j - 1) && isIn(i - 1, j) && isIn(i, j));
  const out = rad - T;
  const roofH = 3.2;
  const verts = new Map();
  // the roof over a corner of the lattice: the arch, rough, pushed out a
  // little at the walls (and the wall's foot further, bulging)
  const roofAt = (i, j) => {
    const key = i * 100003 + j;
    if (verts.has(key)) return verts.get(key);
    const x = ox + i * G;
    const z = oz + j * G;
    const e = Math.max(0, inDist(x, z)) + out;
    const k = clamp01((rad - e) / rad);
    let y = roofH * Math.sqrt(Math.max(0, 1 - k * k));
    y += (fbm(n, x * 0.45, z * 0.45, { octaves: 3 }) - 0.5) * 0.95 * smooth(0, 0.6, e) + (n(x * 2.1, z * 2.1) - 0.5) * 0.18;
    let px = x;
    let pz = z;
    if (onWall(i, j)) {
      // push the wall out from the corridor, along the way out of it
      const gx = inDist(x + 0.05, z) - inDist(x - 0.05, z);
      const gz = inDist(x, z + 0.05) - inDist(x, z - 0.05);
      const gl = Math.hypot(gx, gz) || 1;
      const push = out + (n(x * 0.8 + 3, z * 0.8) - 0.3) * 0.45;
      px -= (gx / gl) * push;
      pz -= (gz / gl) * push;
    }
    const v = { x: px, y, z: pz };
    verts.set(key, v);
    return v;
  };
  const rp = [];
  const tri = (a, b, c) => {
    rp.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  // the roof: two triangles a cell, facing down
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      if (!isIn(i, j)) continue;
      const a = roofAt(i, j);
      const b = roofAt(i + 1, j);
      const c = roofAt(i + 1, j + 1);
      const d = roofAt(i, j + 1);
      tri(a, b, c);
      tri(a, c, d);
    }
  }
  // the walls: down from the roof's edge to the floor, bulging, between
  // each pair of wall corners, except across the two ways out
  const wallDown = (a, b, ax, az, bx, bz) => {
    if (openAt((ax + bx) / 2, (az + bz) / 2)) return;
    const foot = (v, x, z) => {
      const mx = v.x + (v.x - x) * 0.25;
      const mz = v.z + (v.z - z) * 0.25;
      const bulge = (n(x * 1.3 + 7, z * 1.3) - 0.4) * 0.35;
      const dx = v.x - x;
      const dz = v.z - z;
      const l = Math.hypot(dx, dz) || 1;
      return [
        { x: v.x + (dx / l) * bulge, y: v.y * 0.5, z: v.z + (dz / l) * bulge },
        { x: mx, y: -0.08, z: mz },
      ];
    };
    const [am, af] = foot(a, ax, az);
    const [bm, bf] = foot(b, bx, bz);
    tri(a, b, am);
    tri(b, bm, am);
    tri(am, bm, af);
    tri(bm, bf, af);
  };
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      if (!isIn(i, j)) continue;
      const x0 = ox + i * G;
      const z0 = oz + j * G;
      if (!isIn(i, j - 1)) wallDown(roofAt(i + 1, j), roofAt(i, j), x0 + G, z0, x0, z0);
      if (!isIn(i + 1, j)) wallDown(roofAt(i + 1, j + 1), roofAt(i + 1, j), x0 + G, z0 + G, x0 + G, z0);
      if (!isIn(i, j + 1)) wallDown(roofAt(i, j + 1), roofAt(i + 1, j + 1), x0, z0 + G, x0 + G, z0 + G);
      if (!isIn(i - 1, j)) wallDown(roofAt(i, j), roofAt(i, j + 1), x0, z0, x0, z0 + G);
    }
  }
  const shell = new THREE.BufferGeometry();
  shell.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  const sh = facet(shell);
  tint(sh, (x, y, z, out2) => {
    out2.copy(ROCK.base).multiplyScalar(0.5 + noise3(n, x * 0.8, y * 0.8, z * 0.8) * 0.5);
    out2.lerp(ROCK.wet, smooth(0.5, 0.7, noise3(n, x * 0.3 + 5, y * 2, z * 0.3)) * 0.7);
    out2.lerp(ROCK.dark, (1 - smooth(0, 1.2, y)) * 0.3);
  });
  // the floor: a little rough, dark grit, under the walls' feet
  const fl = [];
  const FG = 0.5;
  for (let j = 0; j < NZ; j += 2) {
    for (let i = 0; i < NX; i += 2) {
      if (!isIn(i, j) && !isIn(i + 1, j) && !isIn(i, j + 1) && !isIn(i + 1, j + 1)) continue;
      const x = ox + i * G;
      const z = oz + j * G;
      const corner = (cx, cz) => {
        const e = inDist(cx, cz);
        const y = (n(cx * 1.7, cz * 1.7) - 0.5) * 0.06 - smooth(0.4, -0.2, e) * 0.04;
        let px = cx;
        let pz = cz;
        if (e < 0.05) {
          const gx = inDist(cx + 0.05, cz) - inDist(cx - 0.05, cz);
          const gz = inDist(cx, cz + 0.05) - inDist(cx, cz - 0.05);
          const gl = Math.hypot(gx, gz) || 1;
          px -= (gx / gl) * (out + 0.5);
          pz -= (gz / gl) * (out + 0.5);
        }
        return { x: px, y, z: pz };
      };
      const a = corner(x, z);
      const b = corner(x + FG, z);
      const c = corner(x + FG, z + FG);
      const d = corner(x, z + FG);
      fl.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
    }
  }
  const floor = new THREE.BufferGeometry();
  floor.setAttribute('position', new THREE.Float32BufferAttribute(fl, 3));
  floor.computeVertexNormals();
  tint(floor, (x, y, z, out2) => {
    out2.copy(ROCK.base).multiplyScalar(0.45 + noise3(n, x * 1.5, y, z * 1.5) * 0.4);
    out2.lerp(ROCK.rust, smooth(0.55, 0.7, n(x * 0.7, z * 0.7)) * 0.3);
  });
  // the ways out, each in a rough face of rock round an arch
  const mouths = [];
  for (const [ex, ez, dx] of ends) {
    const shp = new THREE.Shape();
    shp.moveTo(-9, -1);
    shp.lineTo(9, -1);
    shp.lineTo(9, 9);
    shp.lineTo(-9, 9);
    shp.closePath();
    const hole = new THREE.Path();
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      pts.push([Math.cos(a) * rad * 0.92, roofH * 0.9 * Math.sin(a)]);
    }
    hole.moveTo(rad * 0.92, -1.01);
    for (const [hx, hy] of pts) hole.lineTo(hx, hy);
    hole.lineTo(-rad * 0.92, -1.01);
    hole.closePath();
    shp.holes.push(hole);
    const mg = new THREE.ShapeGeometry(shp, 6);
    const mp = mg.attributes.position;
    for (let k = 0; k < mp.count; k++) {
      const x = mp.getX(k);
      const y = mp.getY(k);
      const far = smooth(rad * 1.1, 6, Math.hypot(x, (y - 1) * 0.6));
      mp.setZ(k, -(fbm(n, x * 0.4 + ex, y * 0.4, { octaves: 3 }) - 0.3) * 1.6 * far);
    }
    mg.computeVertexNormals();
    // turn it to face out of the tunnel, at its end
    mg.rotateY(dx > 0 ? Math.PI / 2 : -Math.PI / 2).translate(ex + dx * (T + 0.05), 0, ez);
    mouths.push(mg);
  }
  const mouthGeo = oneGeo(mouths.map((x) => facet(x)));
  tint(mouthGeo, (x, y, z, out2) => out2.copy(ROCK.base).multiplyScalar(0.55 + noise3(n, x * 0.6, y * 0.6, z * 0.6) * 0.5));
  const rockAll = oneGeo([sh, floor, mouthGeo]);
  boxUV(rockAll, 0.4);
  const rockMesh = new THREE.Mesh(rockAll, mats.rock);
  rockMesh.name = 'lairRock';
  g.add(rockMesh);

  // ── web: sheets across the corners and over the roof, strands hanging
  const webs = [];
  const segs = list.map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1, len: Math.hypot(x1 - x0, z1 - z0), ax: x1 !== x0 }));
  // at every bend and joint, sheets across the corner up under the roof
  const joints = new Map();
  for (const s of segs) {
    for (const [x, z] of [[s.x0, s.z0], [s.x1, s.z1]]) {
      const k = `${x},${z}`;
      joints.set(k, (joints.get(k) || 0) + 1);
    }
  }
  let ws = 1;
  const place = (geo, x, y, z, yaw, tiltX = 0, k = 1) => {
    const m4 = new THREE.Matrix4().compose(V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(tiltX, yaw, 0, 'YXZ')), V3(k, k, k));
    webs.push(geo.clone().applyMatrix4(m4));
  };
  for (const [key] of joints) {
    const [jx, jz] = key.split(',').map(Number);
    if ((jx === 0 && jz === 0) || (jx === 80 && jz === -8)) continue;
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = jx + cx * (T - 0.25);
      const z = jz + cz * (T - 0.25);
      if (inside(x + cx * 0.6, z) || inside(x, z + cz * 0.6) || rr() < 0.2) continue;
      // across the corner, its belly sagging back into it
      place(webGeo(ws++), jx + cx * 0.78, 0.25 + rr() * 0.5, jz + cz * 0.78, Math.atan2(cx, cz), -0.1, 0.72 + rr() * 0.1);
    }
  }
  // along the corridors: sheets up under the roof, slung from wall to
  // wall, and a few lower down across the walls' corners
  for (const s of segs) {
    const count = Math.floor(s.len / 4.5);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.3 + rr() * 0.4) / count;
      const x = mix(s.x0, s.x1, t);
      const z = mix(s.z0, s.z1, t);
      const yaw = s.ax ? Math.PI / 2 : 0;
      // slung under the roof from wall to wall, sagging
      if (rr() < 0.5) place(webGeo(ws++), x, 2.3 + rr() * 0.2, z, yaw + (rr() < 0.5 ? Math.PI : 0), 1.3 + rr() * 0.2, 0.66);
      else {
        // in the angle of wall and roof, leaning into it
        const side = rr() < 0.5 ? -1 : 1;
        const px = s.ax ? x : x + side * 0.85;
        const pz = s.ax ? z + side * 0.85 : z;
        place(webGeo(ws++), px, 0.9 + rr() * 0.3, pz, s.ax ? (side > 0 ? 0 : Math.PI) : side > 0 ? Math.PI / 2 : -Math.PI / 2, 0.4, 0.55);
      }
    }
    // strands hanging from the roof
    for (let i = 0; i < s.len / 2.2; i++) {
      const t = rr();
      const x = mix(s.x0, s.x1, t) + (s.ax ? 0 : (rr() - 0.5) * 2);
      const z = mix(s.z0, s.z1, t) + (s.ax ? (rr() - 0.5) * 2 : 0);
      const e = inDist(x, z) + out;
      const kk = clamp01((rad - e) / rad);
      const yTop = roofH * Math.sqrt(Math.max(0, 1 - kk * kk)) - 0.1;
      const L = 0.5 + rr() * 1.6;
      const wd = 0.003 + rr() * 0.005;
      const strand = new THREE.PlaneGeometry(wd * 2, L, 1, 3).translate(0, yTop - L / 2, 0);
      const up = strand.attributes.uv;
      for (let q = 0; q < up.count; q++) up.setXY(q, 0.98, up.getY(q));
      strand.rotateY(rr() * Math.PI).translate(x, 0, z);
      webs.push(strand);
    }
  }
  const webGeoAll = oneGeo(webs);
  tint(webGeoAll, (x, y, z, out2) => out2.setRGB(0.86, 0.87, 0.84).multiplyScalar(0.82 + noise3(n, x * 2, y * 2, z * 2) * 0.3));
  const webMesh = new THREE.Mesh(webGeoAll, mats.web);
  webMesh.name = 'webs';
  webMesh.renderOrder = 3;
  g.add(webMesh);

  // ── bones along the walls, and old skulls
  const bones = [];
  for (const s of segs) {
    const count = Math.floor(s.len / 3);
    for (let i = 0; i < count; i++) {
      const t = rr();
      const side = rr() < 0.5 ? -1 : 1;
      const off = (0.8 + rr() * 0.6) * side;
      const x = mix(s.x0, s.x1, t) + (s.ax ? 0 : off);
      const z = mix(s.z0, s.z1, t) + (s.ax ? off : 0);
      const kind = rr();
      let geo;
      if (kind < 0.45) geo = longBone(0.3 + rr() * 0.25, 0.018 + rr() * 0.01);
      else if (kind < 0.7) geo = skullGeo(Math.floor(rr() * 50), 0.9 + rr() * 0.4);
      else {
        // ribs, curving up out of the grit
        const ribs = [];
        for (let q = 0; q < 4; q++) ribs.push(tube([[q * 0.08, 0, 0], [q * 0.08, 0.1, 0.12], [q * 0.08 + 0.02, 0.04, 0.26]], 0.012, 0.006, { seg: 4, radial: 3 }));
        ribs.push(rod([0, 0.01, 0], [0.32, 0.01, 0], 0.02, 0.02, 4));
        geo = oneGeo(ribs);
      }
      geo.rotateY(rr() * TAU).rotateZ((rr() - 0.5) * 0.3).translate(x, 0.01, z);
      bones.push(geo);
    }
  }
  const boneGeo = oneGeo(bones);
  const bc = boneGeo.attributes.color;
  const bp = boneGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    _kc.setRGB(bc.getX(i), bc.getY(i), bc.getZ(i));
    if (_kc.r > 0.95) _kc.setRGB(0.74, 0.68, 0.56);
    _kc.multiplyScalar(0.75 + noise3(n, bp.getX(i) * 9, bp.getY(i) * 9, bp.getZ(i) * 9) * 0.35);
    bc.setXYZ(i, _kc.r, _kc.g, _kc.b);
  }
  const boneMesh = new THREE.Mesh(boneGeo, mats.bone);
  boneMesh.name = 'bones';
  g.add(boneMesh);
  return { group: g, rock: rockMesh, webs: webMesh, bones: boneMesh };
}

// ── Shelob ──

const SPIDER = { hide: C(0x1e150f), brown: C(0x3c2a1a), ochre: C(0x6a4a28), pale: C(0x7a705e), dark: C(0x070504), belly: C(0x2c2219), band: C(0x4e3a24) };
// Her legs, front to back: each hip in her body's frame, each foot at rest
// in hers; the left side is these with z turned over.
const SPIDER_LEGS = [
  { hip: [0.42, -0.02, 0.24], foot: [3.0, 0, 1.95] },
  { hip: [0.18, -0.04, 0.36], foot: [1.75, 0, 3.25] },
  { hip: [-0.08, -0.04, 0.37], foot: [-0.05, 0, 3.35] },
  { hip: [-0.32, -0.02, 0.28], foot: [-1.65, 0, 2.6] },
];
const LEG_A = 2.1;
const LEG_B = 1.9;
const LEG_C = 0.75;
const TARSUS = -1.25;

// Shelob: a spider the size of a cart, her body 4 m long and 1.8 m high at
// rest, eight jointed hairy legs spanning 7 m, knees high over her back; a
// great bulbous abdomen, black-brown and mottled, bristling, a sting at its
// tail; a cluster of glossy eyes over two great fanged mandibles. Faces +x.
// Skinned on one skeleton (three meshes); her feet are placed by reaching
// for the ground. animate(t, { rear, strike, hurt, recoil, light }), each
// 0..1: rear lifts her front, legs raised; strike lunges; hurt makes her
// sag, limp and shudder; recoil shrinks her back from a light, though not
// while she's walking off forwards (a hunt given up, home to her round);
// light is the phial on her, and she flinches from it however she's going.
// Her gait is read from where the scene puts her (../../creatures.js): her
// feet keep their hold on the ground at any pace, the stride lengthening as
// she hurries; `walking` is no longer needed. Each is eased, so she doesn't
// snap from one to the next.
function shelob(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'shelob';
  const n = makeNoise(4021);
  const bones = [];
  const mk = (name, parent, p) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...p);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const root = mk('root', null, [0, 0, 0]);
  g.add(root);
  const BODY = V3(0.75, 0.9, 0);
  const body = mk('body', root, BODY.toArray());
  const head = mk('head', body, [0.6, 0.06, 0]);
  const fangs = [-1, 1].map((s) => mk(s < 0 ? 'fangL' : 'fangR', head, [0.27, -0.12, s * 0.12]));
  const palps = [-1, 1].map((s) => mk(s < 0 ? 'palpL' : 'palpR', head, [0.2, -0.06, s * 0.24]));
  const abdomen = mk('abdomen', body, [-0.55, 0.12, 0]);
  const sting = mk('sting', abdomen, [-2.3, 0.0, 0]);
  const legs = [];
  SPIDER_LEGS.forEach((L, i) => {
    for (const s of [-1, 1]) {
      const hip = V3(L.hip[0], L.hip[1], L.hip[2] * s);
      const femur = mk(`femur${i}${s < 0 ? 'L' : 'R'}`, body, hip.toArray());
      femur.rotation.order = 'YZX';
      const tibia = mk(`tibia${i}${s < 0 ? 'L' : 'R'}`, femur, [LEG_A, 0, 0]);
      const tarsus = mk(`tarsus${i}${s < 0 ? 'L' : 'R'}`, tibia, [LEG_B, 0, 0]);
      legs.push({ i, s, hip, femur, tibia, tarsus, rest: V3(L.foot[0], 0, L.foot[2] * s), phase: ((i + (s > 0 ? 1 : 0)) % 2) * 0.5 + i * 0.07 });
    }
  });
  g.updateMatrixWorld(true);
  const sk = skinParts(bones);
  const HIDE = mats.shelob;
  // her hide: black-brown, mottled ochre, darker beneath
  const hideTone = (bands = 0) => (x, y, z, out, nx, ny) => {
    const m = noise3(n, x * 2.2, y * 2.2, z * 2.2);
    out.copy(SPIDER.hide).multiplyScalar(0.75 + m * 0.5);
    out.lerp(SPIDER.brown, smooth(0.5, 0.7, noise3(n, x * 1.1 + 4, y * 1.1, z * 1.1)) * 0.7);
    out.lerp(SPIDER.dark, clamp01(-ny) * 0.5);
    if (bands) out.lerp(SPIDER.band, smooth(0.6, 0.9, Math.sin(x * bands) * 0.5 + 0.5) * 0.4);
  };
  // bristles: thin dark spikes out along a surface, pale at their tips
  const bristles = (b, geo, count, len, seed, { up = 0 } = {}) => {
    const p = geo.attributes.position;
    const nr = geo.attributes.normal;
    const br = rng(seed);
    const list = [];
    for (let k = 0; k < count; k++) {
      const v = Math.floor(br() * p.count);
      const at = V3().fromBufferAttribute(p, v);
      const dir = V3().fromBufferAttribute(nr, v).add(V3((br() - 0.5) * 0.8, up + (br() - 0.5) * 0.5, (br() - 0.5) * 0.8));
      const L = len * (0.5 + br());
      list.push(tint(along(new THREE.ConeGeometry(len * 0.06, L, 3, 1, true).translate(0, L / 2, 0), dir, at), (x, y, z, out) => out.copy(SPIDER.pale).multiplyScalar(0.55 + br() * 0.3)));
    }
    sk.add(HIDE, b, oneGeo(list));
  };
  // a lumpy, knobbled surface: pushed in and out along its normals
  const knobble = (geo, amp, freq) => {
    const p = geo.attributes.position;
    const nr = geo.attributes.normal;
    for (let k = 0; k < p.count; k++) {
      const x = p.getX(k);
      const y = p.getY(k);
      const z = p.getZ(k);
      const d = (noise3(n, x * freq, y * freq, z * freq) - 0.5) * amp;
      p.setXYZ(k, x + nr.getX(k) * d, y + nr.getY(k) * d, z + nr.getZ(k) * d);
    }
    geo.computeVertexNormals();
    return geo;
  };

  // the abdomen: huge, bulbous, ridged and mottled, a pale mark on its back
  {
    const geo = knobble(sweep([[0.15, -0.02, 0], [-0.25, 0.08, 0], [-0.8, 0.2, 0], [-1.5, 0.22, 0], [-2.05, 0.1, 0], [-2.35, -0.02, 0]], [[0.24, 0.24, 0.22], [0.64, 0.68, 0.56], [0.86, 0.95, 0.74], [0.84, 0.9, 0.74], [0.52, 0.58, 0.47], [0.1, 0.12, 0.1]], { seg: 22, radial: 22 }), 0.12, 2.6);
    tint(geo, (x, y, z, out, nx, ny) => {
      hideTone()(x, y, z, out, nx, ny);
      // ridges round it, and a pale broken chevron down its back
      out.multiplyScalar(0.85 + 0.25 * Math.sin(x * 9 + noise3(n, x, y, z) * 3));
      const chev = smooth(0.82, 0.95, 1 - Math.abs(Math.abs(z) * 1.6 - ((-x * 1.3) % 0.9))) * smooth(0.5, 0.8, ny);
      out.lerp(SPIDER.ochre, chev * smooth(0.45, 0.6, noise3(n, x * 3, y * 3, z * 3)) * 0.8);
      out.lerp(SPIDER.belly, clamp01(-ny) * 0.4);
    });
    sk.add(HIDE, abdomen, geo);
    bristles(abdomen, geo, 110, 0.16, 11, { up: 0.3 });
    // spinnerets under the tail
    for (let k = 0; k < 3; k++) sk.add(HIDE, abdomen, tint(spikeAt(V3(-2.2, -0.14, (k - 1) * 0.06), V3(-0.5, -1, (k - 1) * 0.3), 0.14, 0.035, 5), (x, y, z, out) => out.copy(SPIDER.brown)));
  }
  // the sting: a hooked spike, glossy, curled under her tail
  sk.add(mats.fang, sting, tube([[0.05, 0, 0], [-0.22, -0.08, 0], [-0.32, -0.32, 0], [-0.22, -0.52, 0]], 0.075, 0.004, { seg: 10, radial: 6 }));
  // the body: a domed carapace, the legs' roots round it
  {
    const geo = knobble(lump(0.55, { s: [1.18, 0.58, 0.88] }, { detail: 3, amp: 0.05, seed: 7 }), 0.05, 4);
    tint(geo, (x, y, z, out, nx, ny) => {
      hideTone()(x, y, z, out, nx, ny);
      out.lerp(SPIDER.ochre, smooth(0.7, 0.95, ny) * smooth(0.2, 0.0, Math.abs(z)) * 0.5);
    });
    sk.add(HIDE, body, geo);
    sk.add(HIDE, body, tint(lump(0.3, { p: [-0.1, 0.24, 0], s: [1.6, 0.4, 0.6] }, { detail: 1, amp: 0.1 }), hideTone()));
    sk.add(HIDE, body, tint(lump(0.32, { p: [0.02, -0.2, 0], s: [1.2, 0.5, 0.9] }, { detail: 1, amp: 0.08 }), hideTone()));
    bristles(body, geo, 40, 0.12, 13, { up: 0.4 });
    // the waist to the abdomen
    sk.add(HIDE, body, tint(sweep([[-0.45, 0.04, 0], [-0.62, 0.1, 0], [-0.75, 0.16, 0]], [[0.2], [0.16], [0.2]], { seg: 3, radial: 8 }), hideTone()));
  }
  // the head: the eyes clustered on its brow, glossy, catching any light
  {
    const geo = knobble(lump(0.33, { p: [0.05, 0.02, 0], s: [1.05, 0.78, 0.98] }, { detail: 2, amp: 0.06, seed: 9 }), 0.04, 5);
    tint(geo, hideTone());
    sk.add(HIDE, head, geo);
    sk.add(HIDE, head, tint(lump(0.16, { p: [0.14, 0.18, 0], s: [1.2, 0.8, 1.3] }, { detail: 1, amp: 0.08 }), hideTone()));
    bristles(head, geo, 28, 0.09, 15, { up: 0.3 });
    const eye = (rad, p) => sk.add(mats.shelobEye, head, new THREE.SphereGeometry(rad, 10, 7).translate(...p));
    for (const s of [-1, 1]) {
      eye(0.07, [0.33, 0.13, s * 0.075]);
      eye(0.048, [0.26, 0.25, s * 0.105]);
      eye(0.042, [0.19, 0.2, s * 0.19]);
      eye(0.034, [0.07, 0.28, s * 0.075]);
    }
    eye(0.028, [0.36, 0.23, 0]);
  }
  // the mandibles: thick hairy bases hanging from the head, each ending in
  // a great curved fang
  fangs.forEach((f, i) => {
    const s = i ? 1 : -1;
    const base = tint(knobble(sweep([[0, 0.02, 0], [0.09, -0.16, s * 0.01], [0.11, -0.34, 0]], [[0.12, 0.11], [0.11, 0.1], [0.075, 0.07]], { seg: 6, radial: 9 }), 0.03, 6), hideTone());
    sk.add(HIDE, f, base);
    bristles(f, base, 16, 0.08, 20 + i, { up: -0.2 });
    sk.add(mats.fang, f, tube([[0.11, -0.33, 0], [0.12, -0.46, s * 0.02], [0.06, -0.56, -s * 0.02], [-0.04, -0.6, -s * 0.05]], 0.045, 0.004, { seg: 8, radial: 6 }));
  });
  // the palps: short feelers either side of the mandibles
  palps.forEach((p, i) => {
    const s = i ? 1 : -1;
    const geo = tint(sweep([[0, 0, 0], [0.18, -0.12, s * 0.06], [0.34, -0.1, s * 0.1], [0.44, -0.22, s * 0.12]], [[0.05], [0.045], [0.04], [0.025]], { seg: 6, radial: 6 }), hideTone(18));
    sk.add(HIDE, p, geo);
    bristles(p, geo, 10, 0.07, 30 + i);
  });
  // the legs: femur, tibia and tarsus, banded, bristling, a knob at each
  // joint, a dark claw at each foot
  for (const L of legs) {
    const seed = 50 + L.i * 2 + (L.s > 0 ? 1 : 0);
    const fem = tint(knobble(sweep([[0, 0, 0], [LEG_A * 0.5, 0.06, 0], [LEG_A, 0, 0]], [[0.16, 0.15], [0.135, 0.125], [0.1, 0.095]], { seg: 8, radial: 8 }), 0.03, 7), hideTone(6));
    sk.add(HIDE, L.femur, fem);
    sk.add(HIDE, L.femur, tint(lump(0.17, { p: [0.02, 0, 0] }, { detail: 1, amp: 0.1 }), hideTone()));
    sk.add(HIDE, L.femur, tint(lump(0.14, { p: [LEG_A, 0.02, 0], s: [1.2, 1, 1] }, { detail: 1, amp: 0.12 }), hideTone()));
    bristles(L.femur, fem, 26, 0.2, seed, { up: 0.5 });
    const tib = tint(knobble(sweep([[0, 0, 0], [LEG_B * 0.5, -0.04, 0], [LEG_B, 0, 0]], [[0.115, 0.105], [0.095, 0.09], [0.075, 0.07]], { seg: 8, radial: 7 }), 0.025, 8), hideTone(7));
    sk.add(HIDE, L.tibia, tib);
    sk.add(HIDE, L.tibia, tint(lump(0.09, { p: [LEG_B, 0, 0] }, { detail: 1, amp: 0.1 }), hideTone()));
    bristles(L.tibia, tib, 24, 0.17, seed + 100, { up: 0.3 });
    const tar = tint(sweep([[0, 0, 0], [LEG_C * 0.6, 0.0, 0], [LEG_C, 0, 0]], [[0.07], [0.052], [0.022]], { seg: 6, radial: 6 }), hideTone(10));
    sk.add(HIDE, L.tarsus, tar);
    bristles(L.tarsus, tar, 12, 0.1, seed + 200, { up: 0.2 });
    sk.add(mats.fang, L.tarsus, spikeAt(V3(LEG_C - 0.04, 0, 0), V3(1, -0.4, 0), 0.12, 0.016, 4));
  }
  const meshes = sk.build(g);

  // ── her motion
  const inv = new THREE.Matrix4();
  const foot = V3();
  const loc = V3();
  let last = null;
  const track = createTracker({ fastest: 20 });
  const stride = createStride({ stride: 1.1, hz: 1.3, longest: 1.7, stance: 0.6, cadence: [1.3, 2.0], seed: 4021 });
  const E = { rear: 0, strike: 0, hurt: 0, recoil: 0, light: 0 };
  const reach = (L, target) => {
    loc.copy(target).applyMatrix4(inv);
    const dx = loc.x - L.hip.x;
    const dz = loc.z - L.hip.z;
    const dh = Math.hypot(dx, dz);
    const dv = loc.y - L.hip.y;
    const yaw = Math.atan2(-dz, dx);
    const u = dh - LEG_C * Math.cos(TARSUS);
    const v = dv - LEG_C * Math.sin(TARSUS);
    const D = Math.max(0.3, Math.min(LEG_A + LEG_B - 0.01, Math.hypot(u, v)));
    const a1 = Math.atan2(v, u) + Math.acos(Math.max(-1, Math.min(1, (LEG_A * LEG_A + D * D - LEG_B * LEG_B) / (2 * LEG_A * D))));
    const a2 = -(Math.PI - Math.acos(Math.max(-1, Math.min(1, (LEG_A * LEG_A + LEG_B * LEG_B - D * D) / (2 * LEG_A * LEG_B)))));
    L.femur.rotation.set(0, yaw, a1);
    L.tibia.rotation.set(0, 0, a2);
    L.tarsus.rotation.set(0, 0, TARSUS - a1 - a2);
  };
  const animate = (t, { rear = 0, strike = 0, hurt = 0, recoil = 0, light = 0 } = {}) => {
    const dt = last == null ? 0 : Math.max(0, Math.min(0.1, t - last));
    last = t;
    // how she's really going, from where she's been put
    const m = track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
    const gait = stride.step(dt, m.fwd < -0.05 ? -m.speed : m.speed);
    const w = gait.amount;
    const phase = gait.cycle;
    // walking off forwards she isn't shrinking from anything; the phial
    // on her she is, whichever way she's going
    const forward = smooth(0.3, 1.0, m.fwd);
    E.light = ease(E.light, clamp01(light), dt, clamp01(light) > E.light ? 12 : 3);
    const rcWant = Math.max(clamp01(recoil) * (1 - forward), E.light * 0.85);
    E.recoil = ease(E.recoil, rcWant, dt, rcWant > E.recoil ? 10 : 3);
    E.rear = ease(E.rear, clamp01(rear), dt, 6);
    E.strike = ease(E.strike, clamp01(strike), dt, 14);
    E.hurt = ease(E.hurt, clamp01(hurt), dt, 6);
    const re = E.rear;
    const st = E.strike;
    const hu = Math.max(E.hurt, E.light * 0.35);
    const rc = E.recoil;
    const breathe = Math.sin(t * 1.3);
    const shud = hu * (Math.sin(t * 31) * 0.6 + Math.sin(t * 47) * 0.4);
    // the body
    body.position.set(BODY.x - re * 0.35 + st * 1.3 - rc * 0.85 + shud * 0.025, BODY.y + re * 0.5 - st * 0.18 - hu * 0.32 - rc * 0.32 + breathe * 0.015 + Math.abs(Math.sin(phase * TAU)) * 0.05 * w, 0);
    body.rotation.set(hu * 0.13 + shud * 0.02, rc * Math.sin(t * 4.1) * 0.06, re * 0.72 - st * 0.2 + rc * 0.22 + shud * 0.03 + Math.sin(phase * TAU * 2) * 0.02 * w);
    body.updateMatrix();
    inv.copy(body.matrix).invert();
    head.rotation.set(Math.sin(t * 0.7) * 0.05 * (1 - st), Math.sin(t * 0.53) * 0.12 * (1 - re) + rc * Math.sin(t * 6) * 0.15, -st * 0.15 + rc * 0.3 - hu * 0.15);
    abdomen.rotation.set(Math.sin(t * 0.8) * 0.03 + hu * 0.1, Math.sin(t * 0.6) * 0.06, -re * 0.55 + st * 0.18 + rc * 0.15 - hu * 0.2 + breathe * 0.015);
    abdomen.scale.setScalar(1 + breathe * 0.015);
    sting.rotation.z = st * 0.7 + re * 0.4 + Math.sin(t * 1.7) * 0.05;
    // the mandibles: working slowly; open as she rears, thrust in a strike
    const chew = Math.sin(t * 2.2) * 0.08 * (1 - hu);
    fangs.forEach((f, i) => {
      const s = i ? 1 : -1;
      f.rotation.set(s * (0.1 + re * 0.35 + st * 0.3 + chew), 0, re * 0.35 + st * 0.9 - hu * 0.25 + chew);
    });
    palps.forEach((p, i) => {
      const s = i ? 1 : -1;
      p.rotation.set(s * 0.1, s * (0.1 + Math.sin(t * 3 + i) * 0.15), Math.sin(t * 2.6 + i * 2) * 0.2 + re * 0.6 - hu * 0.3);
    });
    // the feet: a gait in two sets of four, and her poses
    for (const L of legs) {
      foot.copy(L.rest);
      if (w > 0.01) {
        // her feet held where they're put while they're down: they go back
        // under her as far as she goes forward
        const c = (phase + L.phase + 1) % 1;
        const S = gait.travel * w;
        if (c < 0.6) foot.x += S * (0.5 - c / 0.6);
        else {
          const k = (c - 0.6) / 0.4;
          foot.x += S * (k - 0.5);
          foot.y += Math.sin(Math.PI * k) * (0.2 + 0.25 * Math.min(1.3, gait.reach)) * w;
        }
      }
      const front = L.i === 0;
      const second = L.i === 1;
      if (front) {
        foot.x += -re * 0.7 + st * 1.9 - rc * 1.1;
        foot.y += re * (2.6 + Math.sin(t * 5 + L.s) * 0.3) + Math.sin(Math.PI * st) * 0.7 + rc * (1.5 + Math.sin(t * 7 + L.s) * 0.12);
        foot.z *= 1 - re * 0.25 - rc * 0.45;
      } else if (second) {
        foot.x += re * 0.2 + st * 1.0 - rc * 0.7;
        foot.y += re * (1.4 + Math.sin(t * 4 + L.s * 2) * 0.2) + rc * 0.6;
      } else {
        foot.x += st * 0.55 - rc * 0.5 - re * 0.2;
        foot.z *= 1 + re * 0.08;
      }
      // hurt: the left legs buckle in, all of them tremble
      if (L.s < 0) foot.z *= 1 - hu * 0.15;
      foot.y += Math.max(0, Math.sin(t * 17 + L.i * 1.3 + L.s)) * 0.1 * hu * (L.i < 2 ? 1 : 0.4);
      // and idle, a front foot tapping now and then
      if (front && w < 0.01 && re + st + rc < 0.01) foot.y += Math.pow(Math.max(0, Math.sin(t * 0.9 + L.s * 1.7)), 8) * 0.25;
      reach(L, foot);
    }
  };
  animate(0);
  return { group: g, body, head, abdomen, sting, legs, meshes, animate };
}

// ── the phial, Frodo in silk ──

// Galadriel's phial: a little crystal flask, 12 cm, the light of Eärendil
// in it. set(k): 0 dark, 1 blazing white-blue, with rays like a star.
function phial(K) {
  const g = new THREE.Group();
  g.name = 'phial';
  const prof2 = [[0, 0], [0.022, 0.002], [0.032, 0.014], [0.035, 0.034], [0.03, 0.056], [0.016, 0.072], [0.009, 0.082], [0.009, 0.098], [0.013, 0.102], [0.013, 0.11], [0.007, 0.114], [0.006, 0.12]];
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdfeaff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.45, emissive: hot(0xbfd4ff, 1), emissiveIntensity: 0.4, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof2.map(([x, y]) => new THREE.Vector2(x, y)), 14), glassMat);
  glass.name = 'flask';
  g.add(glass);
  const coreMat = new THREE.MeshBasicMaterial({ color: hot(0xeaf2ff, 3) });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.02, 1), coreMat);
  core.position.y = 0.035;
  g.add(core);
  const S = (map, hex) => {
    const m = new THREE.SpriteMaterial({ map, color: hot(hex, 1), transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m);
    s.position.y = 0.035;
    s.renderOrder = 8;
    g.add(s);
    return s;
  };
  const halo = S(K.tex.glow, 0xd6e4ff);
  const star = S(K.tex.star, 0xeef4ff);
  const wide = S(K.tex.glow, 0x8eb4ff);
  const set = (k) => {
    const t = clamp01(k);
    const e = t * t;
    coreMat.color.copy(hot(0xeaf2ff, 0.6 + 9 * e));
    glassMat.emissiveIntensity = 0.15 + 2.2 * e;
    const f = e * e;
    halo.scale.setScalar(0.1 + 0.5 * t + 0.6 * f);
    halo.material.color.copy(hot(0xd6e4ff, 0.5 + 2.5 * e));
    halo.material.opacity = 0.4 + 0.6 * t;
    star.scale.setScalar(0.1 + 0.5 * e + 1.9 * f);
    star.material.color.copy(hot(0xeef4ff, 1 + 3 * e));
    star.material.opacity = smooth(0.25, 0.8, t);
    wide.scale.setScalar(0.4 + 1.2 * e + 2.4 * f);
    wide.material.color.copy(hot(0x8eb4ff, 0.6 * f));
    wide.material.opacity = 0.5 * f;
    for (const s of [halo, star, wide]) s.visible = t > 0.001;
  };
  set(0.5);
  return { group: g, glass, core, set };
}

// Frodo bound in Shelob's silk: a cocoon 1.4 m long lying along x on the
// ground, his head at +x; wound round and round in grey-white silk,
// tighter at the neck and ankles, a few loose strands trailing.
function silk(K) {
  const g = new THREE.Group();
  g.name = 'silk';
  const n = makeNoise(611);
  const r = rng(613);
  const rows = [
    [-0.7, 0.05, 0.06],
    [-0.62, 0.09, 0.11],
    [-0.4, 0.12, 0.14],
    [-0.1, 0.15, 0.19],
    [0.2, 0.16, 0.22],
    [0.34, 0.15, 0.2],
    [0.44, 0.1, 0.11],
    [0.56, 0.12, 0.12],
    [0.66, 0.1, 0.1],
    [0.72, 0.03, 0.03],
  ];
  const pts = rows.map(([x, ry]) => [x, ry + 0.005, 0]);
  const geo = sweep(pts, rows.map(([, ry, rz]) => [ry, rz, ry]), { seg: 46, radial: 18 });
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    const y = p.getY(k);
    const z = p.getZ(k);
    const a = Math.atan2(z, y - 0.15);
    // the winding: ridges spiralling round it, and lumps where it's thick
    const wind = Math.sin(a * 1 + x * 52) * 0.5 + Math.sin(-a * 1 + x * 37 + 1.3) * 0.5;
    const d = wind * 0.012 + (noise3(n, x * 6, y * 6, z * 6) - 0.5) * 0.03;
    p.setXYZ(k, x + nr.getX(k) * d, Math.max(0, y + nr.getY(k) * d), z + nr.getZ(k) * d);
  }
  geo.computeVertexNormals();
  const list = [geo];
  // loose strands trailing from it to the ground
  for (let k = 0; k < 6; k++) {
    const x = (r() - 0.5) * 1.2;
    const s = r() < 0.5 ? -1 : 1;
    list.push(tube([[x, 0.16, s * 0.17], [x + (r() - 0.5) * 0.2, 0.06, s * (0.3 + r() * 0.2)], [x + (r() - 0.5) * 0.4, 0.005, s * (0.45 + r() * 0.35)]], 0.006, 0.002, { seg: 6, radial: 3 }));
  }
  const all = oneGeo(list);
  tint(all, (x, y, z, out, nx, ny) => {
    const a = Math.atan2(z, y - 0.15);
    const wind = Math.sin(a + x * 52) * 0.5 + 0.5;
    out.setRGB(0.84, 0.83, 0.78).multiplyScalar(0.72 + wind * 0.22 + noise3(n, x * 9, y * 9, z * 9) * 0.15);
    out.multiplyScalar(0.75 + 0.25 * smooth(-0.6, 0.6, ny));
  });
  const mesh = new THREE.Mesh(all, K.mats.silk);
  mesh.name = 'cocoon';
  g.add(mesh);
  return { group: g, mesh };
}

// ── the Tower of Cirith Ungol ──

const TOWER = { stone: C(0x302c2a), dark: C(0x0e0c0c), soot: C(0x1a1614), pale: C(0x4c4642), red: C(0x5a2418) };

// The courtyard inside the Tower of Cirith Ungol: high black walls round a
// court `w` × `d` (x from −w/2 to w/2, z from −d/2 to d/2), square pillars
// at `pillars` [x, z], a dark doorway into the stair at `door` in the north
// wall; torches in iron brackets, dead orcs and smashed weapons on the
// flags; over the north wall the Tower climbing, horned, its slits lit
// red, into a dark red sky (the `sky` dome, which a scene with its own can
// drop). Returns the torches' flames (local) and update(t) to flicker them.
function court(K, { w = 44, d = 30, pillars = [], door = { x: 0, z: -15 } } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'towerCourt';
  const n = makeNoise(707);
  const r = rng(709);
  const HW = 15;
  const TH = 3;
  const stone = [];
  const fire = [];
  const iron = [];
  const add = (geo) => stone.push(geo);
  const box = (bw, bh, bd, x, y, z) => add(new THREE.BoxGeometry(bw, bh, bd).translate(x, y, z));
  const hx = w / 2;
  const hz = d / 2;
  // ── the floor
  const floorGeo = new THREE.PlaneGeometry(w + 2 * TH, d + 2 * TH, 1, 1).rotateX(-Math.PI / 2);
  const fuv = floorGeo.attributes.uv;
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, (fuv.getX(i) * (w + 2 * TH)) / 5, (fuv.getY(i) * (d + 2 * TH)) / 5);
  const floor = new THREE.Mesh(floorGeo, mats.flags);
  floor.name = 'flags';
  g.add(floor);
  // ── the walls: the north one with the door in it
  const dw = 3.2;
  const dh = 4.6;
  {
    const sh = new THREE.Shape();
    sh.moveTo(-hx - TH, -0.5);
    sh.lineTo(hx + TH, -0.5);
    sh.lineTo(hx + TH, HW);
    sh.lineTo(-hx - TH, HW);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(door.x - dw / 2, -0.51);
    hole.lineTo(door.x + dw / 2, -0.51);
    hole.lineTo(door.x + dw / 2, dh - 1);
    hole.quadraticCurveTo(door.x + dw / 2 - 0.1, dh - 0.2, door.x, dh + 0.3);
    hole.quadraticCurveTo(door.x - dw / 2 + 0.1, dh - 0.2, door.x - dw / 2, dh - 1);
    hole.closePath();
    sh.holes.push(hole);
    add(new THREE.ExtrudeGeometry(sh, { depth: TH, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -hz - TH));
  }
  box(w + 2 * TH, HW + 0.5, TH, 0, HW / 2 - 0.25, hz + TH / 2);
  box(TH, HW + 0.5, d, -hx - TH / 2, HW / 2 - 0.25, 0);
  box(TH, HW + 0.5, d, hx + TH / 2, HW / 2 - 0.25, 0);
  // pilasters up the inner faces, a ledge, battlements; not by the door
  const faceRun = (len, fn) => {
    for (let t = -len / 2 + 3; t <= len / 2 - 2.5; t += 5.5) fn(t);
  };
  faceRun(w, (x) => {
    if (Math.abs(x - door.x) > 3) box(0.9, HW, 0.3, x, HW / 2, -hz + 0.15);
    box(0.9, HW, 0.3, x, HW / 2, hz - 0.15);
  });
  faceRun(d, (z) => {
    box(0.3, HW, 0.9, -hx + 0.15, HW / 2, z);
    box(0.3, HW, 0.9, hx - 0.15, HW / 2, z);
  });
  box(w, 0.5, 0.5, 0, 9.5, -hz + 0.25);
  box(w, 0.5, 0.5, 0, 9.5, hz - 0.25);
  box(0.5, 0.5, d, -hx + 0.25, 9.5, 0);
  box(0.5, 0.5, d, hx - 0.25, 9.5, 0);
  const merl = (x0, x1, z0, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cnt = Math.floor(len / 2.2);
    for (let i = 0; i < cnt; i++) {
      const k = (i + 0.5) / cnt;
      const x = mix(x0, x1, k);
      const z = mix(z0, z1, k);
      box(x0 === x1 ? 0.8 : 1.1, 1.8, x0 === x1 ? 1.1 : 0.8, x, HW + 0.9, z);
      if (i % 3 === 0) add(spikeAt(V3(x, HW + 1.8, z), V3(0, 1, 0), 1.4, 0.25, 4));
    }
  };
  merl(-hx - TH, hx + TH, -hz - 0.4, -hz - 0.4);
  merl(-hx - TH, hx + TH, hz + 0.4, hz + 0.4);
  merl(-hx - 0.4, -hx - 0.4, -hz, hz);
  merl(hx + 0.4, hx + 0.4, -hz, hz);
  // the door's frame, stepped out, and one iron leaf hanging open
  {
    const fr = new THREE.Shape();
    fr.moveTo(door.x - dw / 2 - 0.7, 0);
    fr.lineTo(door.x - dw / 2 - 0.7, dh - 0.6);
    fr.quadraticCurveTo(door.x - dw / 2 - 0.4, dh + 0.8, door.x, dh + 1.3);
    fr.quadraticCurveTo(door.x + dw / 2 + 0.4, dh + 0.8, door.x + dw / 2 + 0.7, dh - 0.6);
    fr.lineTo(door.x + dw / 2 + 0.7, 0);
    fr.lineTo(door.x + dw / 2, 0);
    fr.lineTo(door.x + dw / 2, dh - 1);
    fr.quadraticCurveTo(door.x + dw / 2 - 0.1, dh - 0.2, door.x, dh + 0.3);
    fr.quadraticCurveTo(door.x - dw / 2 + 0.1, dh - 0.2, door.x - dw / 2, dh - 1);
    fr.lineTo(door.x - dw / 2, 0);
    fr.closePath();
    add(new THREE.ExtrudeGeometry(fr, { depth: 0.35, bevelEnabled: false, curveSegments: 4 }).translate(0, 0, -hz));
    add(spikeAt(V3(door.x, dh + 1.2, -hz + 0.2), V3(0, 1, 0.3), 1.6, 0.3, 4));
    const leaf = new THREE.BoxGeometry(dw / 2, dh - 0.6, 0.12).translate(dw / 4, (dh - 0.6) / 2, 0);
    for (let i = 0; i < 4; i++) iron.push(new THREE.BoxGeometry(dw / 2, 0.12, 0.05).translate(dw / 4, 0.5 + i * 1.1, 0.07).rotateY(-1.9).translate(door.x - dw / 2, 0, -hz + 0.05));
    iron.push(leaf.rotateY(-1.9).translate(door.x - dw / 2, 0, -hz + 0.05));
  }
  // ── the stair inside the door: a dark well, steps going up into it
  const well = [];
  {
    const x0 = door.x;
    const z0 = -hz - TH;
    const room = new THREE.BoxGeometry(5, 9, 6).translate(x0, 4.5, z0 - 3);
    const idx = room.index.array;
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    room.computeVertexNormals();
    well.push(room);
    for (let i = 0; i < 10; i++) well.push(new THREE.BoxGeometry(1.8, 0.24, 0.5).translate(x0 - 1.4, 0.12 + i * 0.24, z0 - 0.6 - i * 0.5));
    for (let i = 0; i < 10; i++) well.push(new THREE.BoxGeometry(1.4, 0.24 * (i + 1), 0.5).translate(x0 - 1.6, (0.24 * (i + 1)) / 2, z0 - 0.6 - i * 0.5));
  }
  // ── the pillars
  for (const [x, z] of pillars) {
    box(2.1, 0.7, 2.1, x, 0.35, z);
    box(1.5, 11, 1.5, x, 6.2, z);
    box(1.8, 0.4, 1.8, x, 1.0, z);
    box(2.2, 0.9, 2.2, x, 11.9, z);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(spikeAt(V3(x + cx * 0.9, 12.3, z + cz * 0.9), V3(cx * 0.3, 1, cz * 0.3), 1.2, 0.18, 4));
    add(spikeAt(V3(x, 12.3, z), V3(0, 1, 0), 2.2, 0.35, 4));
  }
  // ── torches: on the walls between the pilasters, and on some pillars
  const torches = [];
  const torch = (x, y, z, ox, oz) => {
    const base = V3(x, y, z);
    const tip = V3(x + ox * 0.45, y + 0.35, z + oz * 0.45);
    iron.push(rod(base, tip, 0.035, 0.03, 5));
    iron.push(new THREE.BoxGeometry(0.18, 0.3, 0.18).translate(x, y, z));
    iron.push(new THREE.CylinderGeometry(0.1, 0.06, 0.16, 6, 1, true).translate(tip.x, tip.y + 0.04, tip.z));
    iron.push(new THREE.CylinderGeometry(0.04, 0.035, 0.35, 5).translate(tip.x, tip.y + 0.15, tip.z));
    torches.push(V3(tip.x, tip.y + 0.48, tip.z));
  };
  for (const x of [-hx + 6, -hx + 17, hx - 12]) torch(x, 3.3, -hz + 0.1, 0, 1);
  torch(door.x - dw / 2 - 1.3, 3.3, -hz + 0.1, 0, 1);
  torch(door.x + dw / 2 + 1.3, 3.3, -hz + 0.1, 0, 1);
  for (const x of [-hx + 8, 0, hx - 8]) torch(x, 3.3, hz - 0.1, 0, -1);
  for (const z of [-hz + 8, hz - 8]) {
    torch(-hx + 0.1, 3.3, z, 1, 0);
    torch(hx - 0.1, 3.3, z, -1, 0);
  }
  pillars.forEach(([x, z], i) => {
    if (i % 2 === 0) torch(x, 3.0, z + 0.78, 0, 1);
  });
  // flames: a ragged tongue and a glow about it
  const flames = torches.map((p, i) => {
    const fm = new THREE.SpriteMaterial({ map: K.tex.flame, color: hot(0xffa850, 2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const f = new THREE.Sprite(fm);
    f.position.copy(p);
    f.scale.set(0.38, 0.72, 1);
    f.renderOrder = 6;
    g.add(f);
    const gm = new THREE.SpriteMaterial({ map: K.tex.glow, color: hot(0xff6a24, 1.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    const gl = new THREE.Sprite(gm);
    gl.position.copy(p).add(V3(0, -0.1, 0));
    gl.scale.setScalar(1.8);
    gl.renderOrder = 6;
    g.add(gl);
    return { f, gl, ph: i * 1.7 };
  });
  // ── the Tower over the north wall, horned and jagged, slits of fire
  {
    const tz = -hz - TH;
    const tier = (bw, bh, bd, x, y0, z) => {
      box(bw, bh, bd, x, y0 + bh / 2, z);
      box(bw + 0.8, 0.8, bd + 0.8, x, y0 + bh - 0.4, z);
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(spikeAt(V3(x + (cx * bw) / 2, y0 + bh, z + (cz * bd) / 2), V3(cx * 0.5, 1, cz * 0.5), 3 + r() * 2.5, 0.5, 4));
    };
    tier(36, 34, 26, 2, -0.5, tz - 13);
    tier(26, 16, 18, 4, 33.5, tz - 12);
    tier(16, 14, 12, 6, 49.5, tz - 12);
    tier(9, 9, 8, 7, 63.5, tz - 11);
    // the horn on its top, hooked over, and lesser spines
    add(sweep([[7, 72, tz - 11], [8, 80, tz - 11.5], [11, 86, tz - 10], [15, 87, tz - 8]], [[1.8], [1.3], [0.7], [0.08]], { seg: 10, radial: 6 }));
    add(sweep([[4, 72, tz - 13], [2, 78, tz - 14], [0, 81, tz - 13]], [[1], [0.6], [0.05]], { seg: 6, radial: 5 }));
    // buttresses down its face, like ribs
    for (const x of [-12, -4, 8, 16]) add(rod(V3(x, 0, tz + 0.2), V3(x * 0.8 + 1, 33, tz - 1.5), 1.4, 0.8, 4));
    for (const [y, x0, x1, zf] of [[18, -12, 16, tz + 0.1], [26, -10, 14, tz + 0.1], [40, -6, 14, tz - 2.9], [56, 0, 12, tz - 5.9], [67, 4, 10, tz - 6.9]]) {
      for (let x = x0; x <= x1; x += 4.5) if (r() < 0.6) fire.push(new THREE.BoxGeometry(0.35, 1.8, 0.3).translate(x + (r() - 0.5), y, zf));
    }
    // the cliffs it is built against, either side
    for (const s of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const sg = shardGeo(800 + k + (s > 0 ? 10 : 0), { detail: 1, planes: 7, cut: 0.45, amp: 0.7 });
        sg.scale(22 + r() * 14, 60 + r() * 50, 24 + r() * 10).translate(s * (hx + 14 + k * 16), 20 + r() * 10, tz - 18 - k * 8 - r() * 10);
        add(sg);
      }
    }
  }
  const stoneGeo = oneGeo(stone.map((x) => facet(x)));
  boxUV(stoneGeo, 0.4);
  tint(stoneGeo, (x, y, z, out, nx, ny) => {
    out.copy(TOWER.stone).multiplyScalar(0.65 + noise3(n, x * 0.15, y * 0.15, z * 0.15) * 0.6);
    out.lerp(TOWER.soot, smooth(0.5, 0.75, noise3(n, x * 0.4 + 3, y * 0.2, z * 0.4)) * 0.6);
    out.lerp(TOWER.dark, (1 - smooth(0, 2.5, y)) * 0.35);
    if (ny > 0.7) out.lerp(TOWER.pale, 0.25);
  });
  const walls = new THREE.Mesh(stoneGeo, mats.blackStone);
  walls.name = 'walls';
  g.add(walls);
  const wellGeo = oneGeo(well.map((x) => facet(x)));
  boxUV(wellGeo, 0.4);
  tint(wellGeo, (x, y, z, out) => out.copy(TOWER.dark).multiplyScalar(0.8 + noise3(n, x, y, z) * 0.4));
  const wellMesh = new THREE.Mesh(wellGeo, mats.blackStone);
  wellMesh.name = 'stairwell';
  g.add(wellMesh);
  const ironMesh = new THREE.Mesh(oneGeo(iron.map((x) => solid(x, C(0x2a2624)))), mats.orcGear);
  ironMesh.name = 'iron';
  g.add(ironMesh);
  const slits = new THREE.Mesh(oneGeo(fire), mats.slit);
  slits.name = 'slits';
  g.add(slits);
  // ── the dead, and their smashed weapons
  const dead = [];
  const spots = [[-15, -4], [-6, -9], [7, 2], [-3, 8], [14, -9], [17, 10], [-18, 9], [9, 12]];
  spots.forEach(([x, z], i) => {
    for (const geo of deadOrcGeo(30 + i)) dead.push(geo.translate(x + (r() - 0.5) * 1.5, 0, z + (r() - 0.5) * 1.5));
  });
  const nW = makeNoise(77);
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * (w - 4);
    const z = (r() - 0.5) * (d - 4);
    const kind = r();
    const yaw = r() * TAU;
    let parts2;
    if (kind < 0.3) {
      // a broken spear, its head still on
      const L = 0.6 + r() * 0.8;
      parts2 = [solid(new THREE.CylinderGeometry(0.018, 0.018, L, 4).rotateZ(Math.PI / 2).translate(L / 2, 0.02, 0), ORC.shaft), solid(new THREE.ConeGeometry(0.05, 0.3, 4).scale(1, 1, 0.35).rotateZ(-Math.PI / 2).translate(L + 0.15, 0.02, 0), ORC.steel)];
    } else if (kind < 0.55) {
      // a jagged blade, snapped
      const sh = new THREE.Shape();
      const L = 0.3 + r() * 0.35;
      sh.moveTo(0, 0.02);
      sh.lineTo(L, 0.04);
      sh.lineTo(L * 0.9, -0.05);
      sh.lineTo(L * 0.6, -0.07);
      sh.lineTo(L * 0.5, -0.04);
      sh.lineTo(0, -0.03);
      sh.closePath();
      parts2 = [solid(new THREE.ExtrudeGeometry(sh, { depth: 0.014, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.01, 0), ORC.steel), solid(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 5).rotateZ(Math.PI / 2).translate(-0.07, 0.02, 0), ORC.leather)];
    } else if (kind < 0.75) {
      // a helm, rolled on its side
      parts2 = [solid(new THREE.SphereGeometry(0.13, 7, 4, 0, TAU, 0, Math.PI * 0.5).scale(1.15, 0.85, 1.05).rotateZ(1.2).translate(0, 0.11, 0), ORC.iron)];
    } else {
      // a round shield, split
      parts2 = [solid(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12, 1, false, 0, Math.PI * (1.2 + r() * 0.6)).rotateX((r() - 0.5) * 0.2).translate(0, 0.03, 0), ORC.iron), solid(new THREE.SphereGeometry(0.08, 6, 3, 0, TAU, 0, Math.PI / 2).translate(0, 0.05, 0), ORC.edge)];
    }
    for (const p2 of parts2) {
      tint(p2, (px, py, pz, out) => out.multiplyScalar(0.75 + noise3(nW, px * 9 + i, py * 9, pz * 9) * 0.5));
      dead.push(p2.rotateY(yaw).translate(x, 0, z));
    }
  }
  const deadMesh = new THREE.Mesh(oneGeo(dead), mats.orc);
  deadMesh.name = 'dead';
  g.add(deadMesh);
  // ── the sky: black overhead, dull red low down, brightest in the east
  const skyGeo = new THREE.SphereGeometry(420, 32, 14, 0, TAU, 0, Math.PI / 2);
  tint(skyGeo, (x, y, z, out) => {
    const up = clamp01(y / 420);
    const east = clamp01((x / 420) * 0.5 + 0.5);
    out.setRGB(0.32, 0.06, 0.03).multiplyScalar(0.55 + east * 0.6).lerp(_kd.setRGB(0.025, 0.01, 0.01), smooth(0.02, 0.55, up));
  });
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.name = 'sky';
  sky.renderOrder = -1;
  g.add(sky);
  const update = (t) => {
    for (const { f, gl, ph } of flames) {
      const k = 1 + Math.sin(t * 13 + ph) * 0.1 + Math.sin(t * 29 + ph * 3) * 0.06;
      f.scale.set(0.38 * (2 - k), 0.72 * k, 1);
      gl.material.opacity = 0.45 + 0.12 * Math.sin(t * 17 + ph * 2);
    }
  };
  update(0);
  return { group: g, torches, sky, update };
}

// ── the kit ──

export function createCirithKit(renderer) {
  const kit = createShireKit(renderer);
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const rock = rockCanvas(S, 23);
  const block = blockCanvas(S, 31);
  const flag = flagCanvas(S, 37);
  const hair = hairCanvas(256);
  const wart = wartCanvas(256);
  const tex = {
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    block: T(block.c),
    blockN: T(normalFromField(block.field, S, S, 2.5), { srgb: false }),
    flags: T(flag.c),
    flagsN: T(normalFromField(flag.field, S, S, 2.5), { srgb: false }),
    glow: T(glowCanvas(), { wrap: false }),
    star: T(starCanvas(), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    web: T(webCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
    hair: T(hair.c, { srgb: false }),
    hairN: T(normalFromField(hair.field, 256, 256, 3), { srgb: false }),
    wart: T(wart.c, { srgb: false }),
    wartN: T(normalFromField(wart.field, 256, 256, 5), { srgb: false }),
  };
  // what glossy things see: the lair's dark with a cold light in it; the
  // vale's, lit green by the city
  const lair = envFrom(renderer, [0.004, 0.004, 0.006], [0.016, 0.018, 0.024], [
    [0xdfe8ff, 1.8, 3, 3, [2, 9, 5]],
    [0x9aa8c0, 0.5, 10, 2, [-8, 2, -4]],
  ]);
  const vale = envFrom(renderer, [0.005, 0.008, 0.006], [0.02, 0.04, 0.03], [
    [0x7aff9a, 1.6, 8, 4, [0, 4, -9]],
    [0x2a4a3a, 0.6, 16, 4, [-8, 9, 4]],
  ]);
  const U = { uTime: { value: 0 }, uNoise: { value: tex.noise } };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    ...kit.mats,
    // the scene's: rock (cliff, stairs, tunnels, boulders), web (the web
    // sheets), orc (the marching column, the dead)
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.88 }),
    web: M({ map: tex.web, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, roughness: 0.6, color: 0xb8bab6, emissive: C(0x0a0b0c) }),
    orc: M({ vertexColors: true, roughness: 0.55, metalness: 0.3, envMap: lair, envMapIntensity: 0.6 }),
    orcSkin: hide(M({ vertexColors: true, roughness: 0.6 }), { tex: tex.wart, nrm: tex.wartN, scale: 3.2, bump: 0.8, shade: 0.4, key: 'cirith-orc' }),
    orcGear: M({ vertexColors: true, roughness: 0.45, metalness: 0.55, envMap: lair, envMapIntensity: 0.9 }),
    // Shelob: glossy black-brown, hairy; a faint rim so she reads against
    // the dark; eyes like wet beads; her fangs and sting like horn
    shelob: hide(M({ vertexColors: true, roughness: 0.36, metalness: 0.05, envMap: lair, envMapIntensity: 1.1 }), {
      tex: tex.hair,
      nrm: tex.hairN,
      scale: 1.7,
      bump: 1.2,
      shade: 0.5,
      key: 'cirith-shelob',
      ...shelobRim(),
    }),
    shelobEye: M({ color: 0x050303, roughness: 0.03, metalness: 0.6, envMap: lair, envMapIntensity: 3, emissive: hot(0x8a9a58, 0.16) }),
    fang: M({ color: 0x2e1e12, roughness: 0.18, metalness: 0.1, envMap: lair, envMapIntensity: 1.8 }),
    silk: M({ vertexColors: true, roughness: 0.72, emissive: C(0x121210) }),
    bone: M({ vertexColors: true, roughness: 0.72 }),
    // Minas Morgul's
    statue: M({ vertexColors: true, roughness: 0.6, emissive: C(0x9ad0aa), emissiveIntensity: 0.35 }),
    morgulWater: M({ color: 0x020504, roughness: 0.22, metalness: 0.7, envMap: vale, envMapIntensity: 0.45, emissive: C(0x010402) }),
    // the fell beast and the Witch-king
    beastHide: M({ vertexColors: true, roughness: 0.55 }),
    beastHorn: M({ color: 0x4a423c, roughness: 0.45 }),
    beastEye: new THREE.MeshBasicMaterial({ color: hot(0xff7a2a, 1.6) }),
    membrane: M({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    nazgulRobe: M({ color: 0x0e0e10, roughness: 0.92, side: THREE.DoubleSide }),
    gauntlet: M({ color: 0x2a2a2e, roughness: 0.35, metalness: 0.8, envMap: vale, envMapIntensity: 1 }),
    crownHelm: M({ color: 0x3a3a3e, roughness: 0.3, metalness: 0.85, envMap: vale, envMapIntensity: 1.4, side: THREE.DoubleSide }),
    wraithEye: new THREE.MeshBasicMaterial({ color: hot(0xd8e6ff, 2.4) }),
    saddle: M({ color: 0x1e1612, roughness: 0.7 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    // the Tower's
    blackStone: M({ map: tex.block, normalMap: tex.blockN, vertexColors: true, roughness: 0.82 }),
    flags: M({ map: tex.flags, normalMap: tex.flagsN, color: 0x5e5650, roughness: 0.75 }),
    slit: new THREE.MeshBasicMaterial({ color: hot(0xff4410, 1.7) }),
  };
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const MK = { mats, tex: { ...kit.K.tex, ...tex }, U, renderer };
  // the scene shares one geometry each among its instances
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    ...kit,
    mats,
    tex: MK.tex,
    uniforms: U,
    tick: (t) => {
      U.uTime.value = t;
    },
    morgul: () => morgul(MK),
    orcColumn: () => once('column', orcColumnGeo),
    host: () => once('column', orcColumnGeo),
    witchKing: () => witchKing(MK),
    stairs: (o) => stairs(MK, o),
    tunnels: (list, o) => tunnels(MK, list, o),
    shelob: () => shelob(MK),
    phial: () => phial(MK),
    silk: () => silk(MK),
    court: (o) => court(MK, o),
    orc: (seed = 1, o) => orc(MK, seed, o),
    rock: (seed = 1) => once(`rock${seed}`, () => rockGeo(seed)),
    web: (seed = 1) => once(`web${seed}`, () => webGeo(seed)),
  };
}
