// The Emyn Muil, the Dead Marshes and the Black Gate, made in code: the
// kit the Two Towers road is built from. The sheer grey cliff of the Emyn
// Muil with its spurs, the razor spires round it, and Sam's elven rope;
// Gollum himself; the marsh's tussocks, reeds and drowned snags, the
// candle-lights over the pools and the dead faces under them; a Nazgûl on
// his fell beast; and the Morannon, its iron gates between the Towers of
// the Teeth, the Easterlings marching in, ash-grey boulders on the slope,
// and the elven cloak that makes a hobbit a rock.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are:
// its helpers, and its own materials for sharp grey rock, black iron, wet
// skin, membrane and red lacquer. The same conventions: each builder's
// group stands on y = 0 at its origin, fronts face +z, creatures face +x,
// and fixed parts are merged one mesh per material. Things meant for an
// InstancedMesh come back as one vertex-coloured geometry.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { blob, boxUV, createShireKit, parts, rng, tf, tube } from '../../shire/props';
import { createStride, ease, footAt } from '../../creatures';
import { faceMaterial } from '../../nodes/towns/marshes/propsShaders';

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

// ── painted textures ──

// Grey rock, nearly white so vertex colours give its hue: grain, joints
// and hairline cracks, rain streaks down it. With its relief.
export function rockCanvas(S, seed) {
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

// Black iron in great plates: seams, rivets along them, pitting and rust
// run down from the joints. With its relief.
export function ironCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const gu = u * 4;
    const gv = v * 4;
    const fu = gu - Math.floor(gu);
    const fv = gv - Math.floor(gv);
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
    const seam = 1 - smooth(0.004, 0.025, edge);
    // rivets in a row a little in from each seam
    const ru = Math.min(Math.abs(fu - 0.07), Math.abs(fu - 0.93));
    const rv = Math.min(Math.abs(fv - 0.07), Math.abs(fv - 0.93));
    const along = (t) => Math.abs(((t * 7) % 1) - 0.5) / 7;
    const rivet = Math.max(1 - smooth(0.012, 0.026, Math.hypot(ru, along(fv))), 1 - smooth(0.012, 0.026, Math.hypot(rv, along(fu))));
    const pit = n(u * 96, v * 96, 96);
    const blot = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const rust = smooth(0.58, 0.78, fbm(n, u * 3 + 5, v * 3, { period: 3, octaves: 3 }));
    const streak = smooth(0.5, 0.9, n(u * 48, 0.5, 48)) * (1 - fv);
    field[py * S + px] = clamp01(0.5 + rivet * 0.45 - seam * 0.45 + (pit - 0.5) * 0.12);
    const t = 0.55 + blot * 0.35 + (pit - 0.5) * 0.14 - seam * 0.4 + rivet * 0.35;
    out[0] = 150 * t + rust * 46 + streak * 18;
    out[1] = 144 * t + rust * 18 + streak * 6;
    out[2] = 140 * t;
  });
  return { c, field };
}

// A soft round glow.
export function glowCanvas() {
  const c = makeCanvas(64);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  return c;
}

// A candle flame: a teardrop, white at its heart.
export function flameCanvas() {
  const c = makeCanvas(32, 64);
  paintPixels(c, (u, v, out) => {
    const dy = v - 0.66;
    const d = Math.hypot((u - 0.5) / (0.2 + Math.max(0, dy) * 0.4), dy / (dy < 0 ? 0.6 : 0.26));
    const a = 1 - smooth(0.25, 1, d);
    const core = 1 - smooth(0, 0.45, d);
    out[0] = 200 + core * 55;
    out[1] = 255;
    out[2] = 215 + core * 40;
    out[3] = a * 255;
  });
  return c;
}

// Gollum's eye, wrapped on a ball: the iris at its +x, huge and pale blue,
// a small black pupil, a sallow white with red threads.
export function eyeCanvas() {
  const c = makeCanvas(128, 64);
  const x = c.getContext('2d');
  x.fillStyle = '#d6d6c2';
  x.fillRect(0, 0, 128, 64);
  x.strokeStyle = 'rgba(160,60,50,0.35)';
  x.lineWidth = 0.8;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * 40, 32 + Math.sin(a) * 26);
    x.quadraticCurveTo(64 + Math.cos(a + 0.3) * 30, 32 + Math.sin(a + 0.3) * 22, 64 + Math.cos(a) * 21, 32 + Math.sin(a) * 18);
    x.stroke();
  }
  const g = x.createRadialGradient(64, 32, 2, 64, 32, 19);
  g.addColorStop(0, '#cfe8f6');
  g.addColorStop(0.45, '#9cc8e4');
  g.addColorStop(0.85, '#6c9cc0');
  g.addColorStop(1, '#3a5a74');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(64, 32, 18, 17, 0, 0, TAU);
  x.fill();
  x.strokeStyle = 'rgba(40,70,100,0.35)';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    x.beginPath();
    x.moveTo(64 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
    x.lineTo(64 + Math.cos(a) * 16, 32 + Math.sin(a) * 15);
    x.stroke();
  }
  x.fillStyle = '#050608';
  x.beginPath();
  x.ellipse(64, 32, 5, 5.5, 0, 0, TAU);
  x.fill();
  return c;
}

// The elven rope's twist: silver-grey with darker strands winding round.
export function ropeCanvas() {
  const c = makeCanvas(32, 32);
  paintPixels(c, (u, v, out) => {
    const s = (u + v * 2) % 0.25;
    const k = 0.78 + 0.22 * Math.sin((s / 0.25) * Math.PI);
    out[0] = 214 * k;
    out[1] = 218 * k;
    out[2] = 222 * k;
  });
  return c;
}

// A drowned face for the marsh pools, pale on clear: `kind` 0 a Man of the
// Last Alliance under his helm, 1 an Elf, her hair spread in the water, 2
// an Orc.
export function faceCanvas(kind) {
  const S = 128;
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const cx = 64;
  const cy = 66;
  // hair first, floating out round the head
  x.lineCap = 'round';
  if (kind === 1) {
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * (0.92 + (i / 45) * 1.16);
      const r0 = 34;
      const r1 = 54 + ((i * 37) % 9);
      x.strokeStyle = `rgba(210,230,226,${0.18 + ((i * 13) % 5) * 0.04})`;
      x.lineWidth = 1.5;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * r0 * 0.8, cy + Math.sin(a) * r0);
      x.quadraticCurveTo(cx + Math.cos(a + 0.25) * r1 * 0.8, cy + Math.sin(a + 0.25) * r1 * 0.9, cx + Math.cos(a - 0.1) * r1, cy + Math.sin(a - 0.1) * r1);
      x.stroke();
    }
  } else if (kind === 2) {
    for (let i = 0; i < 18; i++) {
      const a = Math.PI * (1.1 + (i / 17) * 0.8);
      x.strokeStyle = 'rgba(150,170,160,0.35)';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 36);
      x.lineTo(cx + Math.cos(a + 0.15) * 44, cy + Math.sin(a + 0.15) * 46);
      x.stroke();
    }
  }
  // the face, pale, fading at its edges
  const fw = kind === 2 ? 30 : 26;
  const g = x.createRadialGradient(cx, cy - 4, 4, cx, cy, 40);
  g.addColorStop(0, 'rgba(236,246,240,0.95)');
  g.addColorStop(0.6, 'rgba(214,232,226,0.85)');
  g.addColorStop(0.85, 'rgba(190,214,208,0.35)');
  g.addColorStop(1, 'rgba(190,214,208,0)');
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(cx, cy, fw + 8, 42, 0, 0, TAU);
  x.fill();
  // a Man's helm, its rim round the brow
  if (kind === 0) {
    x.strokeStyle = 'rgba(200,220,215,0.75)';
    x.lineWidth = 6;
    x.beginPath();
    x.ellipse(cx, cy - 6, 32, 38, 0, Math.PI * 1.08, Math.PI * 1.92);
    x.stroke();
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(cx, cy - 44);
    x.lineTo(cx, cy - 22);
    x.stroke();
  }
  const dark = (a) => `rgba(18,34,32,${a})`;
  // the sockets: hollow and staring, or shut
  const eye = (s) => {
    const ex = cx + s * (kind === 2 ? 13 : 11);
    const ey = cy - 4;
    const sh = x.createRadialGradient(ex, ey, 1, ex, ey, 11);
    sh.addColorStop(0, dark(kind === 1 ? 0.45 : 0.95));
    sh.addColorStop(0.6, dark(kind === 1 ? 0.25 : 0.6));
    sh.addColorStop(1, dark(0));
    x.fillStyle = sh;
    x.beginPath();
    x.ellipse(ex, ey, 10, kind === 2 ? 6 : 7, s * (kind === 2 ? -0.35 : 0.1), 0, TAU);
    x.fill();
    if (kind === 1) {
      x.strokeStyle = dark(0.8);
      x.lineWidth = 1.4;
      x.beginPath();
      x.arc(ex, ey - 4, 6, Math.PI * 0.2, Math.PI * 0.8);
      x.stroke();
    }
  };
  eye(-1);
  eye(1);
  // the brow, heavy on an Orc
  if (kind === 2) {
    x.strokeStyle = dark(0.6);
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(cx - 24, cy - 16);
    x.lineTo(cx - 4, cy - 9);
    x.moveTo(cx + 24, cy - 16);
    x.lineTo(cx + 4, cy - 9);
    x.stroke();
  }
  // the nose's shadow
  x.strokeStyle = dark(0.35);
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(cx - 2, cy - 2);
  x.quadraticCurveTo(cx - 5, cy + 10, cx - 1, cy + 13);
  x.stroke();
  x.fillStyle = dark(0.5);
  x.beginPath();
  x.ellipse(cx - 3, cy + 14, 2, 1.4, 0, 0, TAU);
  x.ellipse(cx + 3, cy + 14, 2, 1.4, 0, 0, TAU);
  x.fill();
  // the mouth: open in a drowned cry, shut on an Elf, fanged on an Orc
  if (kind === 1) {
    x.strokeStyle = dark(0.6);
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(cx - 8, cy + 24);
    x.quadraticCurveTo(cx, cy + 26, cx + 8, cy + 24);
    x.stroke();
  } else {
    const mw = kind === 2 ? 13 : 8;
    const mh = kind === 2 ? 6 : 8;
    const m = x.createRadialGradient(cx, cy + 25, 1, cx, cy + 25, mw + 2);
    m.addColorStop(0, dark(0.95));
    m.addColorStop(0.7, dark(0.7));
    m.addColorStop(1, dark(0));
    x.fillStyle = m;
    x.beginPath();
    x.ellipse(cx, cy + 25, mw, mh, 0, 0, TAU);
    x.fill();
    if (kind === 2) {
      x.fillStyle = 'rgba(230,240,230,0.9)';
      for (const s of [-1, 1]) {
        x.beginPath();
        x.moveTo(cx + s * 9, cy + 28);
        x.lineTo(cx + s * 7, cy + 19);
        x.lineTo(cx + s * 5, cy + 28);
        x.fill();
      }
    }
  }
  // a Man's beard
  if (kind === 0) {
    x.strokeStyle = 'rgba(200,222,216,0.4)';
    x.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      const bx = cx - 18 + (i / 23) * 36;
      x.beginPath();
      x.moveTo(bx, cy + 18 + Math.abs(bx - cx) * 0.2);
      x.lineTo(bx + Math.sin(i) * 3, cy + 40 - Math.abs(bx - cx) * 0.4);
      x.stroke();
    }
  }
  return c;
}

// ── the Emyn Muil ──

const ROCK = { base: C(0xaeaeaa), dark: C(0x3a3c40), wet: C(0x606268), pale: C(0xd2d2ca), lichen: C(0xb8ba9e), moss: C(0x6e785e) };

// A razor spire of rock, about 3 m: a few blade-thin shards leaning
// together, flat-faced and sharp. One geometry for instancing.
export function spikeGeo(seed = 1) {
  const r = rng(seed * 13 + 1);
  const n = makeNoise(seed + 3);
  const list = [];
  const count = 3 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const main = k === 0;
    const H = main ? 2.8 + r() * 0.5 : 0.9 + r() * 1.5;
    const R = main ? 0.6 : 0.28 + r() * 0.3;
    const a = r() * TAU;
    const off = main ? 0 : 0.35 + r() * 0.4;
    const bx = Math.cos(a) * off;
    const bz = Math.sin(a) * off;
    const lx = (r() - 0.5) * 0.25 + (main ? 0 : Math.cos(a) * 0.3);
    const lz = (r() - 0.5) * 0.25 + (main ? 0 : Math.sin(a) * 0.3);
    const blade = r() * TAU;
    const cb = Math.cos(blade);
    const sb = Math.sin(blade);
    const at = (u, v, y) => V3(bx + u * cb - v * sb + lx * y, y, bz + u * sb + v * cb + lz * y);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * TAU + r() * 0.5;
      const rr = R * (0.75 + r() * 0.4);
      pts.push(at(Math.cos(t) * rr, Math.sin(t) * rr * 0.5, -0.5));
    }
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * TAU + r() * 0.8;
      const rr = R * (0.4 + r() * 0.25);
      pts.push(at(Math.cos(t) * rr, Math.sin(t) * rr * 0.4, H * (0.3 + r() * 0.3)));
    }
    pts.push(at((r() - 0.5) * R * 0.3, 0, H));
    if (r() < 0.6) pts.push(at(R * (0.25 + r() * 0.2) * (r() < 0.5 ? -1 : 1), 0, H * (0.72 + r() * 0.12)));
    list.push(new ConvexGeometry(pts));
  }
  const g = oneGeo(list.map((x) => facet(x)));
  boxUV(g, 0.6);
  tint(g, (x, y, z, out, nx, ny) => {
    const v = noise3(n, x * 1.4, y * 1.4, z * 1.4);
    out.copy(ROCK.base).multiplyScalar(0.7 + v * 0.55);
    out.lerp(ROCK.dark, clamp01(0.5 - y * 0.35) * 0.7);
    if (ny > 0.45) out.lerp(ROCK.pale, 0.35);
    out.lerp(ROCK.lichen, smooth(0.62, 0.7, noise3(n, x * 3 + 4, y * 3, z * 3)) * 0.4);
  });
  g.computeBoundingSphere();
  return g;
}

// A jagged spur of rock about `out` proud of the face, for the rope to
// knock against.
function spurGeo(seed, cx, cy, side, out = 0.8) {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + r() * 0.5;
    pts.push(V3(cx + Math.cos(a) * (0.6 + r() * 0.25), cy + Math.sin(a) * (0.5 + r() * 0.2), -0.5 + r() * 0.15));
  }
  for (let i = 0; i < 3; i++) pts.push(V3(cx + (r() - 0.5) * 0.6, cy + 0.15 - r() * 0.35, 0.2 + r() * 0.2));
  // a fang, pointing out and down, a lesser one beside it
  pts.push(V3(cx + side * 0.12, cy - 0.38, out));
  pts.push(V3(cx - side * 0.3, cy - 0.1, out * 0.7));
  pts.push(V3(cx + side * 0.05, cy + 0.12, out * 0.45));
  return facet(new ConvexGeometry(pts));
}

// The cliff: a sheer grey face `w` across and `h` high, its foot on y = 0,
// facing +z. Tall slabs split by vertical joints, set forward and back,
// layers stepping into ledges, the ends turning back into the hills; a
// jagged rim and rock crowding behind it. Down the middle (x = 0 ± 3) it
// is kept smooth and flush with z = 0 for the rope and for Gollum, but for
// the spurs in `outcrops`.
export function cliff(K, { w = 60, h = 34, outcrops = [] } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'cliff';
  const n = makeNoise(71);
  const hw = w / 2;
  const below = 4;
  const nx = Math.round(w / 0.5);
  const nf = Math.round((h + below) / 0.6);
  const nt = 10;
  const back = 10;
  // the face in tall slabs between vertical joints, each its own way out
  const cr = rng(72);
  const cuts = [-hw - 2];
  while (cuts[cuts.length - 1] < hw + 2) cuts.push(cuts[cuts.length - 1] + 1.6 + cr() * 3.6);
  const slabs = cuts.map(() => ({ out: (cr() - 0.5) * 1.8, lean: (cr() - 0.5) * 0.04, layer: 3.2 + cr() * 3.5, phase: cr() * 6, step: cr() }));
  const slabAt = (x) => {
    let i = 0;
    while (i < cuts.length - 2 && x > cuts[i + 1]) i++;
    return [i, Math.min(x - cuts[i], cuts[i + 1] - x)];
  };
  const calmAt = (x) => smooth(2.4, 5.5, Math.abs(x - 0.6));
  // spires along the skyline, none over the rope's head
  const tops = [];
  for (let x = -hw; x < hw; x += 2.2 + cr() * 3.5) tops.push([x, 1.5 + cr() * 5.5, 0.9 + cr() * 1.6]);
  const skyline = (x) => {
    let y = 0;
    for (const [px, ph, pw] of tops) y = Math.max(y, ph * (1 - Math.abs(x - px) / pw));
    return y * smooth(2.6, 5.5, Math.abs(x - 0.5)) * (1 - smooth(hw - 6, hw, Math.abs(x)) * 0.7) - smooth(hw - 18, hw, Math.abs(x)) * 24;
  };
  const face = (x, y) => {
    const [i, edge] = slabAt(x);
    const sl = slabs[i];
    const crack = 1 - smooth(0.05, 0.45, edge);
    // each slab steps back in layers up its height: the ledges
    const L = Math.floor((y + sl.phase) / sl.layer);
    let z = sl.out + (n(L * 1.73 + i * 7.1, 9.3) - 0.5) * 1.3 + sl.lean * y;
    z -= crack * 0.9;
    z += (fbm(n, x * 0.04 + 3, y * 0.045, { octaves: 3 }) - 0.5) * 3.2;
    z += (fbm(n, x * 0.6 + 9, y * 0.35, { octaves: 2 }) - 0.5) * 0.18;
    z -= smooth(hw - 14, hw, Math.abs(x)) * 16;
    const calm = calmAt(x);
    const quiet = -0.12 - crack * 0.18 + (fbm(n, x * 0.8, y * 0.4, { octaves: 2 }) - 0.5) * 0.1;
    return [mix(quiet, z, calm), crack * (0.35 + 0.65 * calm), i];
  };
  // the rim's teeth, and what's behind it; flat where Sam stands
  const calmTop = (x, d) => Math.max(smooth(2.4, 5, Math.abs(x - 0.5)), smooth(3, 5, d));
  const rim = (x, d) => {
    const s = x / 2.6 + n(x * 0.2, 7) * 1.6;
    const fr = s - Math.floor(s);
    const tooth = Math.pow(1 - Math.abs(fr * 2 - 1), 1.6) * (1 + n(Math.floor(s) * 3.1, 2) * 2.4);
    return (tooth * smooth(0.4, 1.6, d) * (1 - smooth(5, 9, d) * 0.6) + (fbm(n, x * 0.2, d * 0.3 + 5, { octaves: 2 }) - 0.5) * 1.2 * smooth(0, 3, d)) * calmTop(x, d);
  };
  const W = nx + 1;
  const pos = new Float32Array(W * (nf + nt + 1) * 3);
  const col = new Float32Array(W * (nf + nt + 1) * 3);
  const jr = rng(77);
  for (let j = 0; j <= nf + nt; j++) {
    for (let i = 0; i <= nx; i++) {
      let x = -hw + (i / nx) * w;
      const top = h + skyline(x);
      let y;
      let z;
      let joint = 0;
      let slab = 0;
      if (j <= nf) {
        y = -below + (j / nf) * (top + below);
        [z, joint, slab] = face(x, y);
      } else {
        const d = ((j - nf) / nt) * back;
        y = top + rim(x, d) - smooth(0, back, d) * Math.max(0, top - h) * 0.6;
        z = face(x, top)[0] - d;
        x += (jr() - 0.5) * 0.2;
      }
      const k = (j * W + i) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
      // grey, darker in the joints and down the wet streaks
      const v = fbm(n, x * 0.3 + 11, y * 0.3, { octaves: 3 });
      _kc.copy(ROCK.base).multiplyScalar((0.72 + v * 0.5) * (0.82 + n(slab * 3.7, 1.1) * 0.36));
      _kc.lerp(ROCK.dark, joint * 0.75);
      const streak = smooth(0.55, 0.78, n(x * 1.4 + 2, 0.5)) * (0.4 + 0.6 * (1 - clamp01(y / h)));
      _kc.lerp(ROCK.wet, streak * 0.55);
      _kc.lerp(ROCK.dark, clamp01(-y / below) * 0.5);
      if (j > nf) _kc.lerp(ROCK.moss, smooth(0.55, 0.7, n(x * 0.5, y * 0.5 + 3)) * 0.4);
      col[k] = _kc.r;
      col[k + 1] = _kc.g;
      col[k + 2] = _kc.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nf + nt; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * W + i;
      if ((i + j) % 2) idx.push(a, a + 1, a + W, a + 1, a + W + 1, a + W);
      else idx.push(a, a + 1, a + W + 1, a, a + W + 1, a + W);
    }
  }
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo = facet(geo);
  // ledges pale with lichen where they face the sky
  const p = geo.attributes.position;
  const nr = geo.attributes.normal;
  const cc = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const ny = nr.getY(i);
    if (ny > 0.4) {
      _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).lerp(ny > 0.75 ? ROCK.lichen : ROCK.pale, smooth(0.4, 0.9, ny) * 0.55);
      cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
    } else if (nr.getZ(i) < -0.2) {
      _kc.setRGB(cc.getX(i), cc.getY(i), cc.getZ(i)).multiplyScalar(0.7);
      cc.setXYZ(i, _kc.r, _kc.g, _kc.b);
    }
  }
  const list = [geo];
  // the spurs the rope swings against
  outcrops.forEach((o, i) => {
    const s = spurGeo(300 + i * 7, (o.side ?? 1) * 1.4, h - o.y, o.side ?? 1);
    tint(s, (x, y, z, out, nx2, ny) => out.copy(ROCK.base).multiplyScalar(0.8 + z * 0.3).lerp(ny > 0.4 ? ROCK.pale : ROCK.dark, ny > 0.4 ? 0.4 : clamp01(-ny) * 0.5));
    list.push(s);
  });
  // spires crowding the rim, clear of the rope's head
  const r = rng(91);
  for (let i = 0; i < 16; i++) {
    let x = (r() - 0.5) * (w - 6);
    if (Math.abs(x - 0.5) < 5) x += x < 0.5 ? -5 : 5;
    const d = 1.5 + r() * 7;
    const s = spikeGeo(20 + i).clone();
    const k = 0.9 + r() * 1.6;
    s.applyMatrix4(new THREE.Matrix4().compose(V3(x, h + skyline(x) * 0.5 + rim(x, d) - 0.3, face(x, h)[0] - d), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * TAU, (r() - 0.5) * 0.2)), V3(k, k * (0.8 + r() * 0.6), k)));
    list.push(s);
  }
  const all = oneGeo(list);
  boxUV(all, 0.3);
  const mesh = new THREE.Mesh(all, mats.rock);
  mesh.name = 'cliffFace';
  g.add(mesh);
  return { group: g, mesh };
}

// Sam's elven rope: thin, silver-grey, a tube that set([a, b]) lays from a
// to b with a little sag, rewritten in place.
export function rope(K) {
  const SEG = 28;
  const RAD = 6;
  const R = 0.026;
  const W = RAD + 1;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * W * 3);
  const nrm = new Float32Array((SEG + 1) * W * 3);
  const uv = new Float32Array((SEG + 1) * W * 2);
  const idx = [];
  for (let k = 0; k < SEG; k++) {
    for (let j = 0; j < RAD; j++) {
      const a = k * W + j;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, K.mats.elvenRope);
  mesh.name = 'elvenRope';
  mesh.frustumCulled = false;
  const a = V3();
  const b = V3();
  const d = V3();
  const sag = V3();
  const p = V3();
  const q = V3();
  const T = V3();
  const N = V3();
  const Bn = V3();
  const ref = V3();
  const at = (t, out) => out.copy(a).lerp(b, t).addScaledVector(sag, 4 * t * (1 - t));
  const set = ([A, Bv]) => {
    a.copy(A);
    b.copy(Bv);
    d.subVectors(b, a);
    const len = Math.max(0.01, d.length());
    d.divideScalar(len);
    // it sags across its line, and bows a little out from the rock
    sag.set(0, -1, 0).addScaledVector(d, d.y);
    sag.multiplyScalar(0.05 * len).add(q.set(0, 0, 1).addScaledVector(d, -d.z).multiplyScalar(0.012 * len));
    let run = 0;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG;
      at(t, p);
      at(Math.min(1, t + 0.02), q);
      at(Math.max(0, t - 0.02), T);
      T.subVectors(q, T).normalize();
      ref.set(Math.abs(T.z) > 0.9 ? 1 : 0, 0, Math.abs(T.z) > 0.9 ? 0 : 1);
      N.crossVectors(T, ref).normalize();
      Bn.crossVectors(T, N);
      if (k) run += len / SEG;
      for (let j = 0; j <= RAD; j++) {
        const th = (j / RAD) * TAU;
        const cx = Math.cos(th);
        const sx = Math.sin(th);
        const i = k * W + j;
        const nx = N.x * cx + Bn.x * sx;
        const ny = N.y * cx + Bn.y * sx;
        const nz = N.z * cx + Bn.z * sx;
        nrm[i * 3] = nx;
        nrm[i * 3 + 1] = ny;
        nrm[i * 3 + 2] = nz;
        pos[i * 3] = p.x + nx * R;
        pos[i * 3 + 1] = p.y + ny * R;
        pos[i * 3 + 2] = p.z + nz * R;
        uv[i * 2] = j / RAD;
        uv[i * 2 + 1] = run * 6;
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    geo.computeBoundingSphere();
  };
  set([V3(0, 2, 0), V3(0, 0, 0)]);
  return { mesh, group: mesh, set };
}

// ── Gollum ──

const GOLLUM = { thigh: 0.3, shin: 0.31, arm: 0.27, fore: 0.26, foot: 0.05, wrist: 0.05 };
const GOLLUM_SKIN = { base: C(0xc2c0b0), green: C(0xa2a892), pale: C(0xdcd2c4), deep: C(0x72705e), lip: C(0xb09a90) };
const _q0 = new THREE.Quaternion();
const _qf = new THREE.Quaternion();
const _zf = V3(0, 0, 1);
const CLIMB_Q = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), -Math.PI / 2));
const CLIMB_AT = V3(0.5, 0.38, 0);
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// Two bones from a root to a target in the x-y plane: the absolute angles
// of each (0 hanging straight down, positive swung forward to +x), the
// joint bent forward (`bend` 1, a knee) or back (-1, an elbow).
function reach2(rx, ry, tx, ty, L1, L2, bend) {
  let dx = tx - rx;
  let dy = ty - ry;
  const d0 = Math.hypot(dx, dy) || 1e-4;
  const max = (L1 + L2) * 0.995;
  const min = Math.abs(L1 - L2) + 0.03;
  const k = d0 > max ? max / d0 : d0 < min ? min / d0 : 1;
  dx *= k;
  dy *= k;
  const d = d0 * k;
  const a = Math.atan2(dx, -dy);
  const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const a1 = a + bend * b;
  const kx = rx + Math.sin(a1) * L1;
  const ky = ry - Math.cos(a1) * L1;
  return [a1, Math.atan2(rx + dx - kx, -(ry + dy - ky))];
}

// Gollum: about 1.2 m if he ever stood up, which he doesn't. Starved thin,
// pale grey-green and damp, his ribs and spine and every knuckle showing,
// a few lank strands of hair on a big skull, huge pale-blue eyes, big ears,
// a ragged loincloth, long fingers and toes. Faces +x.
// animate(t, { pose, speed, look, reach }): pose 'crouch' (on his heels),
// 'crawl' (all fours along +x), 'climb' (head first down a rock face, belly
// to it: the face is at his +x, so turned as the scene turns him it is at
// −z of the world, and he looks out), 'cower' (curled up), 'fall' (the
// Ring held high, toppling over backwards, legs kicking: falling, he tips
// back about his hips towards −x). His crawl and his climb go by the ground
// he covers (../../creatures.js), read from where the scene puts him, so
// his hands and feet hold where they're put however fast he scuttles; still,
// he doesn't paw the air. `speed` is no longer needed.
// The one Gollum: the Marshes' and Cirith Ungol's, Mount Doom's (with its
// kit's materials, ../doom/props.js) and the Rush thief's.
export function gollum(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'gollum';
  const rig = bone('rig', g);
  const n = makeNoise(611);
  const SKIN = mats.gollumSkin;
  const skin = (geo, { belly = 0, dark = 0, lip = 0 } = {}) =>
    tint(geo, (x, y, z, out, nx) => {
      const m = noise3(n, x * 16, y * 16, z * 16);
      const blot = smooth(0.42, 0.66, noise3(n, x * 5 + 5, y * 5, z * 5));
      out.copy(GOLLUM_SKIN.base).multiplyScalar(0.86 + m * 0.26).lerp(GOLLUM_SKIN.green, blot * 0.5);
      if (belly) out.lerp(GOLLUM_SKIN.pale, clamp01(belly * (0.2 + nx * 0.8)));
      if (lip) out.lerp(GOLLUM_SKIN.lip, lip);
      if (dark) out.lerp(GOLLUM_SKIN.deep, dark);
    });
  const build = (grp, fn) => {
    const bk = parts();
    fn(bk);
    bk.build(grp, { shadow: false, receive: false });
  };
  const sk = (bk, geo, o) => bk.add(SKIN, skin(geo, o));
  const knob = (bk, r, p, s = [1, 1, 1], o = {}, rot) => sk(bk, lump(r, { p, s, r: rot }, { detail: o.detail ?? 1, amp: o.amp ?? 0.08, seed: o.seed ?? 3 }), o);

  // ── the hips and the loincloth
  const hips = bone('hips', rig, [0, 0.3, 0]);
  build(hips, (bk) => {
    knob(bk, 0.1, [0, 0.02, 0], [0.95, 0.75, 1.2], { detail: 2 });
    for (const s of [-1, 1]) knob(bk, 0.026, [0.055, 0.05, s * 0.088], [1, 1, 1], { belly: 0.3 });
    // a filthy rag wound round the loins, torn at its hem, a flap before and behind
    const rag = new THREE.CylinderGeometry(0.098, 0.106, 0.085, 18, 2, true);
    const p = rag.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const y = p.getY(i);
      const a = Math.atan2(z, x);
      const tear = y < -0.04 ? (n(a * 4 + 3, 2) - 0.5) * 0.06 - Math.max(0, Math.sin(a * 5)) * 0.02 : 0;
      p.setXYZ(i, x, y + tear, z * 1.16);
    }
    rag.computeVertexNormals();
    const cloth = (geo) =>
      tint(geo, (x, y, z, out) => {
        out.setRGB(0.16, 0.12, 0.08).multiplyScalar(0.7 + noise3(n, x * 30, y * 30, z * 30) * 0.6);
      });
    bk.add(mats.loin, cloth(rag), { p: [0, -0.005, 0] });
    for (const s of [-1, 1]) {
      const flap = new THREE.PlaneGeometry(0.08, 0.075, 2, 3);
      const fp = flap.attributes.position;
      for (let i = 0; i < fp.count; i++) {
        const fy = fp.getY(i);
        fp.setXYZ(i, fp.getX(i) + (fy < -0.03 ? (n(i * 3.3, 1) - 0.5) * 0.025 : 0), fy + (fy < -0.03 ? (n(i * 1.7, 4) - 0.5) * 0.03 : 0), Math.abs(fp.getX(i)) * 0.5);
      }
      flap.computeVertexNormals();
      bk.add(mats.loin, cloth(flap), { p: [s * 0.098, -0.05, 0], r: [0, (s * Math.PI) / 2, s * -0.25] });
    }
    bk.add(mats.loin, cloth(new THREE.TorusGeometry(0.102, 0.007, 4, 22).scale(1, 1.16, 1).rotateX(Math.PI / 2)), { p: [0, 0.04, 0] });
  });

  // ── the legs: bony knees up by his ears, long splayed toes
  const legs = [-1, 1].map((s) => {
    const thigh = bone(s < 0 ? 'thighL' : 'thighR', hips, [0, -0.01, s * 0.068]);
    build(thigh, (bk) => {
      sk(bk, sweep([[0, 0.02, 0], [0.004, -0.15, 0], [0, -GOLLUM.thigh, 0]], [[0.046, 0.05], [0.033, 0.034], [0.026, 0.028]], { seg: 6, radial: 9 }));
      knob(bk, 0.03, [0.012, -GOLLUM.thigh, 0], [1.05, 1.15, 0.95], { dark: 0.1 });
    });
    const shin = bone('shin', thigh, [0, -GOLLUM.thigh, 0]);
    build(shin, (bk) => {
      sk(bk, sweep([[0, 0, 0], [-0.006, -0.16, 0], [0, -GOLLUM.shin, 0]], [[0.026, 0.026, 0.032], [0.022, 0.022, 0.026], [0.016, 0.018]], { seg: 6, radial: 8 }));
      knob(bk, 0.017, [0, -GOLLUM.shin, s * 0.012], [1, 1, 1], { dark: 0.1 });
      knob(bk, 0.017, [0, -GOLLUM.shin, -s * 0.012], [1, 1, 1], { dark: 0.1 });
    });
    const foot = bone('foot', shin, [0, -GOLLUM.shin, 0]);
    build(foot, (bk) => {
      knob(bk, 0.026, [-0.022, -0.026, 0], [1.1, 0.95, 0.9], { dark: 0.15 });
      sk(bk, sweep([[-0.03, -0.03, 0], [0.04, -0.034, 0], [0.098, -0.036, 0]], [[0.02, 0.026], [0.018, 0.034], [0.012, 0.038]], { seg: 5, radial: 8, side: [0, 0, 1] }), { dark: 0.05 });
      // five long toes, the big one inside
      const lens = [0.07, 0.078, 0.07, 0.062, 0.052];
      for (let t = 0; t < 5; t++) {
        const z0 = (-s * (t - 2) * 0.016) * 1.0;
        const L = lens[t];
        const r0 = t === 0 ? 0.0105 : 0.0078;
        sk(bk, sweep([[0.09, -0.036, z0], [0.09 + L * 0.5, -0.034, z0 * 1.35], [0.09 + L, -0.046, z0 * 1.6]], [[r0], [r0 * 0.85], [r0 * 0.7]], { seg: 4, radial: 5 }), { dark: 0.05 });
      }
    });
    return { thigh, shin, foot, s };
  });

  // ── the body: ribs and spine through the skin, a sunken belly
  const spine = bone('spine', hips, [-0.005, 0.045, 0]);
  const ROWS = [
    [0, 0.068, 0.088, 0.06],
    [0.26, 0.058, 0.078, 0.058],
    [0.5, 0.084, 0.1, 0.07],
    [0.77, 0.086, 0.112, 0.07],
    [1, 0.058, 0.1, 0.056],
  ];
  const TORSO = 0.35;
  build(spine, (bk) => {
    sk(bk, sweep([[0, 0, 0], [0.006, TORSO * 0.26, 0], [0.01, TORSO * 0.5, 0], [0.002, TORSO * 0.77, 0], [-0.008, TORSO, 0]], ROWS.map((r) => r.slice(1)), { seg: 12, radial: 14 }), { belly: 0.5 });
    // the ribs, each a ridge round from the spine to the breastbone
    for (let i = 0; i < 5; i++) {
      const y = 0.14 + i * 0.036;
      const [rf, rs, rb] = prof(ROWS, y / TORSO);
      for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 5; k++) {
          const f = 0.32 + (k / 5) * 2.35;
          pts.push([Math.cos(f) * ((f < Math.PI / 2 ? rf : rb) + 0.002), y - 0.04 * (1 - f / 2.7), s * Math.sin(f) * (rs + 0.002)]);
        }
        sk(bk, sweep(pts, [[0.0065]], { seg: 8, radial: 4, caps: [false, false] }), { belly: 0.3 });
      }
    }
    // the knobs of his spine, his shoulder blades, collarbones, breastbone
    for (let i = 0; i < 11; i++) {
      const y = 0.01 + i * 0.032;
      const [, , rb] = prof(ROWS, y / TORSO);
      knob(bk, 0.013, [-rb - 0.002, y, 0], [0.8, 0.9, 1.1], { dark: 0.05, detail: 0 });
    }
    for (const s of [-1, 1]) {
      knob(bk, 0.045, [-0.06, 0.27, s * 0.06], [0.32, 1, 0.75], { dark: 0.05 }, [0, 0, 0.2]);
      sk(bk, rod([0.066, 0.335, s * 0.012], [0.004, 0.345, s * 0.105], 0.009, 0.008, 5), { belly: 0.2 });
    }
    sk(bk, rod([0.08, 0.31, 0], [0.083, 0.2, 0], 0.01, 0.008, 5), { belly: 0.3 });
  });

  // ── the neck and the head: a big skull, huge eyes, great ears
  const neck = bone('neck', spine, [0.0, TORSO - 0.005, 0]);
  build(neck, (bk) => {
    sk(bk, sweep([[0, -0.01, 0], [0.008, 0.05, 0], [0.012, 0.1, 0]], [[0.034, 0.036], [0.03, 0.032], [0.032, 0.036]], { seg: 4, radial: 9 }), { belly: 0.2 });
    for (const s of [-1, 1]) sk(bk, rod([0.012, 0.0, s * 0.02], [0.0, 0.1, s * 0.03], 0.008, 0.006, 4));
  });
  const head = bone('head', neck, [0.014, 0.1, 0]);
  const eyes = [];
  build(head, (bk) => {
    knob(bk, 0.13, [-0.02, 0.095, 0], [1.02, 0.9, 0.9], { detail: 3, amp: 0.05, seed: 7 });
    knob(bk, 0.085, [0.062, 0.022, 0], [0.95, 0.82, 1.02], { detail: 2, amp: 0.05, seed: 8 });
    knob(bk, 0.05, [0.094, -0.03, 0], [1, 0.62, 1.15], { belly: 0.2, seed: 9 });
    knob(bk, 0.024, [0.13, -0.042, 0], [1, 0.8, 1.2], { belly: 0.3 });
    for (const s of [-1, 1]) {
      // the hooded brows over the eyes, the cheekbones and hollow cheeks
      knob(bk, 0.034, [0.1, 0.09, s * 0.05], [0.95, 0.55, 1.15], { dark: 0.08, seed: 10 + s }, [s * 0.15, 0, -0.2]);
      knob(bk, 0.028, [0.096, 0.03, s * 0.068], [1, 0.8, 1], { seed: 12 + s });
      knob(bk, 0.021, [0.112, 0.038, s * 0.052], [0.9, 0.5, 1.3], { dark: 0.12 });
      // the ears, big and thin, standing out and back
      knob(bk, 0.052, [-0.012, 0.07, s * 0.122], [0.55, 1, 0.18], { seed: 14 + s, lip: 0.2 }, [s * 0.45, s * -0.35, 0.35]);
      bk.add(mats.mouth, lump(0.03, { p: [-0.004, 0.068, s * 0.128], s: [0.45, 0.85, 0.12], r: [s * 0.45, s * -0.35, 0.35] }, { detail: 1 }));
    }
    // the nose: hardly any, two slits
    knob(bk, 0.015, [0.142, 0.036, 0], [1, 0.7, 1.25], { lip: 0.2 });
    for (const s of [-1, 1]) bk.add(mats.mouth, lump(0.004, { p: [0.153, 0.03, s * 0.008], s: [1, 0.6, 1.4] }, { detail: 0 }));
    // the mouth: a wide lipless slit, a few teeth left in it
    bk.add(mats.mouth, lump(0.05, { p: [0.128, -0.004, 0], s: [0.3, 0.12, 1.15] }, { detail: 1, amp: 0.04 }));
    knob(bk, 0.05, [0.126, 0.007, 0], [0.3, 0.11, 1.12], { lip: 0.5 });
    knob(bk, 0.046, [0.122, -0.015, 0], [0.3, 0.11, 1.08], { lip: 0.5 });
    for (const [z, l] of [[-0.022, 0.012], [0.006, 0.015], [0.03, 0.01]]) bk.add(mats.tooth, new THREE.ConeGeometry(0.0045, l, 4), { p: [0.142, -0.006, z], r: [Math.PI, 0, 0] });
    // a few lank strands of hair from the crown
    const hr = rng(41);
    const on = (dx, dy, dz) => {
      const d = V3(dx, dy, dz).normalize();
      return V3(-0.02 + d.x * 0.138, 0.095 + d.y * 0.122, d.z * 0.122);
    };
    for (let i = 0; i < 6; i++) {
      const z0 = (i / 5 - 0.5) * 0.75 + (hr() - 0.5) * 0.12;
      const f = 0.2 + hr() * 0.35;
      const pts = [on(f, 1, z0), on(-0.4, 0.8, z0 * 1.2), on(-1, 0.25, z0 * 1.3), on(-1, -0.25, z0 * 1.4), V3(-0.14 - hr() * 0.02, -0.06 - hr() * 0.07, z0 * 0.16 + (hr() - 0.5) * 0.03)];
      bk.add(mats.gollumHair, tube(pts, 0.0032, 0.0016, { seg: 10, radial: 3 }));
    }
  });
  // the eyes: each a ball with its lid, so he can blink
  for (const s of [-1, 1]) {
    const e = bone(s < 0 ? 'eyeL' : 'eyeR', head, [0.108, 0.064, s * 0.05]);
    e.rotation.y = -s * 0.22;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 12), mats.gollumEye);
    e.add(ball);
    const lid = new THREE.Mesh(skin(new THREE.SphereGeometry(0.0438, 12, 6, Math.PI * 0.1, Math.PI * 0.8, 0, Math.PI * 0.46), { dark: 0.1 }), SKIN);
    lid.rotation.z = -0.42;
    e.add(lid);
    eyes.push(e);
  }

  // ── the arms: thin as sticks, long knobbly fingers
  const arms = [-1, 1].map((s) => {
    const arm = bone(s < 0 ? 'armL' : 'armR', spine, [0, 0.3, s * 0.112]);
    build(arm, (bk) => {
      knob(bk, 0.034, [0, 0, 0], [1, 1, 1], { detail: 1 });
      sk(bk, sweep([[0, 0, 0], [0.003, -0.135, 0], [0, -GOLLUM.arm, 0]], [[0.026, 0.027], [0.021, 0.022], [0.019, 0.02]], { seg: 6, radial: 8 }));
      knob(bk, 0.021, [-0.008, -GOLLUM.arm, 0], [1, 1.1, 1], { dark: 0.1 });
    });
    const fore = bone('fore', arm, [0, -GOLLUM.arm, 0]);
    build(fore, (bk) => {
      sk(bk, sweep([[0, 0, 0], [0.003, -0.13, 0], [0, -GOLLUM.fore, 0]], [[0.022, 0.024], [0.019, 0.021], [0.013, 0.017]], { seg: 6, radial: 8 }));
      knob(bk, 0.014, [0, -GOLLUM.fore + 0.006, s * 0.008], [1, 1, 1], { dark: 0.1, detail: 0 });
    });
    const hand = bone('hand', fore, [0, -GOLLUM.fore, 0]);
    build(hand, (bk) => {
      knob(bk, 0.032, [0.004, -0.035, 0], [0.42, 1.05, 0.95], {});
      // four long fingers curling to the palm (−x), a thumb inside
      const fl = [0.1, 0.112, 0.106, 0.09];
      for (let f = 0; f < 4; f++) {
        const z = (f - 1.5) * 0.0145 * -s;
        const L = fl[f];
        const pts = [[0.002, -0.064, z], [-0.004, -0.064 - L * 0.36, z * 1.15], [-0.014, -0.064 - L * 0.72, z * 1.25], [-0.03, -0.064 - L, z * 1.3]];
        sk(bk, sweep(pts, [[0.0078], [0.0062], [0.007], [0.0048]], { seg: 6, radial: 5 }));
      }
      sk(bk, sweep([[-0.006, -0.025, -s * 0.024], [-0.022, -0.055, -s * 0.034], [-0.036, -0.08, -s * 0.032]], [[0.0085], [0.007], [0.005]], { seg: 4, radial: 5 }));
    });
    return { arm, fore, hand, s };
  });

  // ── the poses
  const P = {};
  const T = {};
  const KEYS = ['hx', 'hy', 'tilt', 'spine', 'neck', 'head', 'yaw', 'abd', 'out', 'f0x', 'f0y', 'f1x', 'f1y', 'h0x', 'h0y', 'h1x', 'h1y', 'hand', 'climb', 'twist', 'roll', 'fall', 'gait'];
  let last = null;
  // his scuttle: a stride from the ground he covers (up or down a rock face
  // as much as along the ground), each limb down a little over half of it,
  // a hand and the other side's foot together
  const stride = createStride({ stride: 0.44, hz: 1.35, longest: 1.6, stance: 0.55, cadence: [1.4, 2.6], seed: 5 });
  const moved = { x: 0, y: 0, z: 0, t: null, v: 0 };
  const LIMBS = [['f0', 0], ['f1', 0.5], ['h0', 0.5], ['h1', 0]];
  const Q = {};
  const legAt = (s) => [0, -0.01, s * 0.068];
  const armAt = [0, 0.3];
  const target = (t, pose, speed, look, reach) => {
    const breathe = Math.sin(t * 2.3);
    T.yaw = look;
    T.twist = 0;
    T.roll = 0;
    T.fall = 0;
    T.gait = 0;
    if (pose === 'fall') {
      // arms flung up, the hand with the Ring highest; arched back, legs kicking
      const k = Math.sin(t * 8.5);
      const k2 = Math.sin(t * 6.1 + 1);
      Object.assign(T, { hx: 0, hy: 0.46, tilt: 0, spine: 0.32 + k * 0.05, neck: -0.25, head: -0.1 + k2 * 0.1, abd: 0.3, out: 0.55, hand: 0.6, climb: 0, fall: 1 });
      T.f0x = 0.32 + k * 0.1;
      T.f0y = 0.3 + k * 0.08;
      T.f1x = 0.2 - k * 0.1;
      T.f1y = 0.14 - k * 0.06;
      T.h0x = -0.12 + k2 * 0.06;
      T.h0y = 1.16;
      T.h1x = 0.02 - k2 * 0.04;
      T.h1y = 1.26;
    } else if (pose === 'crawl' || pose === 'climb') {
      // the stance he crawls from; his stride's steps go on top (animate)
      const climb = pose === 'climb';
      Object.assign(T, {
        hx: -0.12,
        hy: (climb ? 0.17 : 0.35) + breathe * 0.004,
        tilt: 0,
        spine: (climb ? -1.6 : -1.36) + breathe * 0.02,
        neck: climb ? 0.95 : 0.72,
        head: (climb ? 1.15 : 0.72) + Math.sin(t * 1.3) * 0.05,
        abd: climb ? 1.0 : 0.42,
        out: climb ? 0.95 : 0.22,
        hand: climb ? 1.35 : 1.25,
        climb: climb ? 1 : 0,
        gait: 1,
      });
      T.f0x = -0.04;
      T.f0y = GOLLUM.foot;
      T.f1x = -0.04;
      T.f1y = GOLLUM.foot;
      T.h0x = climb ? 0.3 : 0.38;
      T.h0y = GOLLUM.wrist;
      T.h1x = climb ? 0.3 : 0.38;
      T.h1y = GOLLUM.wrist;
    } else if (pose === 'cower') {
      const shiver = Math.sin(t * 37) * 0.012 + Math.sin(t * 23) * 0.008;
      Object.assign(T, { hx: 0, hy: 0.21 + shiver * 0.3, tilt: 0, spine: -1.18 + shiver, neck: -0.15, head: -0.45 + shiver, abd: 0.18, out: -0.35, hand: 2.6, climb: 0, f0x: 0.12, f0y: GOLLUM.foot, f1x: 0.12, f1y: GOLLUM.foot, h0x: 0.38, h0y: 0.43, h1x: 0.4, h1y: 0.43 });
    } else {
      Object.assign(T, { hx: 0, hy: 0.25 + breathe * 0.004, tilt: 0, spine: -0.92 + breathe * 0.03, neck: 0.5, head: 0.5 + Math.sin(t * 0.9) * 0.06, abd: 0.34, out: -0.12, hand: 1.45, climb: 0, f0x: 0.16, f0y: GOLLUM.foot, f1x: 0.16, f1y: GOLLUM.foot, h0x: 0.35, h0y: GOLLUM.wrist + 0.01, h1x: 0.34, h1y: GOLLUM.wrist });
    }
    // reaching out with his right hand, craning after it
    if (reach > 0) {
      const sa = T.tilt + T.spine;
      const [sx0, sy0] = rot2(-0.005, 0.045, T.tilt);
      const [ax, ay] = rot2(armAt[0], armAt[1], sa);
      const shx = T.hx + sx0 + ax;
      const shy = T.hy + sy0 + ay;
      T.h1x = mix(T.h1x, shx + 0.52, reach);
      T.h1y = mix(T.h1y, shy + 0.06, reach);
      T.neck += 0.15 * reach;
      T.spine += 0.12 * reach;
    }
  };
  const animate = (t, { pose = 'crouch', speed = 0, look = 0, reach = 0 } = {}) => {
    target(t, pose, speed, look, clamp01(reach));
    const dt = last == null ? 1 : t - last;
    last = t;
    const f = dt < 0 || dt > 0.5 ? 1 : 1 - Math.exp(-dt * 9);
    for (const k of KEYS) P[k] = P[k] == null || f === 1 ? T[k] : P[k] + (T[k] - P[k]) * f;
    // how fast he's really going, along the ground or up and down the rock,
    // from where he's been put (a jump of the scene's is a jump, not a dash)
    const gp = g.position;
    if (moved.t != null && t > moved.t && t - moved.t < 1) {
      const span = t - moved.t;
      let raw = Math.hypot(gp.x - moved.x, gp.y - moved.y, gp.z - moved.z) / span / (g.scale.x || 1);
      if (raw > 12) raw = 0;
      moved.v += (raw - moved.v) * (1 - Math.exp(-Math.min(0.1, span) / 0.08));
    } else moved.v = 0;
    moved.x = gp.x;
    moved.y = gp.y;
    moved.z = gp.z;
    moved.t = t;
    const st = stride.step(dt > 0 && dt <= 0.5 ? dt : 0, moved.v);
    // his steps on top of the stance: each hand and foot back under him as
    // far as he goes on while it's down, then up and through
    for (const k of KEYS) Q[k] = P[k];
    const amt = st.amount * P.gait;
    if (amt > 0.001) {
      const lift = mix(0.065, 0.05, P.climb) * Math.min(1.3, 0.6 + 0.4 * st.reach);
      for (const [limb, off] of LIMBS) {
        const fo = footAt(st.cycle + off, 0.55);
        Q[limb + 'x'] += ((fo.x * st.travel) / 2) * amt;
        Q[limb + 'y'] += fo.lift * lift * amt;
      }
      const sway = Math.sin(st.phase);
      Q.twist += sway * 0.12 * amt;
      Q.roll += sway * 0.05 * amt;
      Q.hy += Math.sin(st.phase * 2) * 0.012 * amt;
    }
    // head first down the rock: the crawl turned so +x runs down and the
    // ground under him becomes the rock face at his +x
    rig.quaternion.copy(_q0).slerp(CLIMB_Q, Q.climb);
    rig.position.copy(CLIMB_AT).multiplyScalar(Q.climb);
    // toppling over backwards, about his hips
    if (Q.fall > 0.001) {
      rig.quaternion.multiply(_qf.setFromAxisAngle(_zf, 0.85 * Q.fall));
      rig.position.x += 0.18 * Q.fall;
      rig.position.y += 0.06 * Q.fall;
    }
    hips.position.set(Q.hx, Q.hy, 0);
    hips.rotation.set(Q.roll, 0, Q.tilt);
    spine.rotation.set(0, Q.twist, Q.spine);
    neck.rotation.set(0, -Q.twist * 0.6, Q.neck);
    head.rotation.set(0, Q.yaw, Q.head);
    const blink = t % 3.7 < 0.13 || (t + 1.1) % 7.9 < 0.1;
    for (const e of eyes) e.scale.y = blink ? 0.15 : 1;
    // the legs to their feet
    for (const L of legs) {
      const i = L.s < 0 ? 0 : 1;
      const [lx, ly] = rot2(legAt(L.s)[0], legAt(L.s)[1], Q.tilt);
      const rx = Q.hx + lx;
      const ry = Q.hy + ly;
      const c = Math.cos(Q.abd);
      const [a1, a2] = reach2(rx, ry, Q[`f${i}x`], ry + (Q[`f${i}y`] - ry) / c, GOLLUM.thigh, GOLLUM.shin, 1);
      L.thigh.rotation.set(-L.s * Q.abd, 0, a1 - Q.tilt);
      L.shin.rotation.set(0, 0, a2 - a1);
      L.foot.rotation.set(L.s * Q.abd * 0.8, 0, -a2);
    }
    // the arms to their hands
    const sa = Q.tilt + Q.spine;
    const [sx0, sy0] = rot2(-0.005, 0.045, Q.tilt);
    const [ax, ay] = rot2(armAt[0], armAt[1], sa);
    for (const A of arms) {
      const i = A.s < 0 ? 0 : 1;
      const rx = Q.hx + sx0 + ax;
      const ry = Q.hy + sy0 + ay;
      const out = i === 1 ? mix(Q.out, 0.05, clamp01(reach)) : Q.out;
      const c = Math.cos(out);
      const [a1, a2] = reach2(rx, ry, Q[`h${i}x`], ry + (Q[`h${i}y`] - ry) / c, GOLLUM.arm, GOLLUM.fore, -1);
      A.arm.rotation.set(-A.s * out, 0, a1 - sa);
      A.fore.rotation.set(0, 0, a2 - a1);
      const hand = i === 1 ? mix(Q.hand, a2 + 0.15, clamp01(reach)) : Q.hand;
      A.hand.rotation.set(0, 0, hand - a2);
    }
  };
  animate(0);
  return { group: g, head, rig, hips, spine, legs, arms, eyes, animate };
}

// ── the Dead Marshes ──

const MARSH = { mud: C(0x2a261a), khaki: C(0x8a8250), straw: C(0xa49464), dead: C(0x6a5a38), green: C(0x56603a), olive: C(0x6c6c3c) };

// One blade of grass or a reed leaf: a strip from its root up and out,
// bending over, coloured root to tip.
function bladeGeo(root, dir, len, wid, droop, segs, colour) {
  const pos = [];
  const col = [];
  const idx = [];
  const side = V3(-dir.z, 0, dir.x).normalize();
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = root.clone().addScaledVector(dir, len * t);
    p.y -= droop * len * t * t;
    const w = wid * (1 - t * 0.92);
    pos.push(p.x - side.x * w, p.y, p.z - side.z * w, p.x + side.x * w, p.y, p.z + side.z * w);
    colour(t, _kc);
    col.push(_kc.r, _kc.g, _kc.b, _kc.r, _kc.g, _kc.b);
    if (i < segs) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // lit as if round, from its own lean
  const nr = g.attributes.normal;
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, dir.x * 0.4, 0.9, dir.z * 0.4);
  return g;
}

// A tussock of marsh grass, about 0.7 m: a dark mound bristling with dull
// khaki blades, dead straw at their tips. One geometry.
export function tussockGeo(seed = 1) {
  const r = rng(seed * 7 + 2);
  const list = [];
  const mound = lump(0.26, { p: [0, 0.02, 0], s: [1.2, 0.45, 1.1] }, { detail: 1, amp: 0.2, seed });
  list.push(solid(mound, MARSH.mud));
  for (let i = 0; i < 46; i++) {
    const a = r() * TAU;
    const rr = Math.sqrt(r()) * 0.22;
    const root = V3(Math.cos(a) * rr, 0.06, Math.sin(a) * rr);
    const out = 0.25 + r() * 0.6;
    const dir = V3(Math.cos(a) * out, 1, Math.sin(a) * out).normalize();
    const tipC = r() < 0.5 ? MARSH.straw : MARSH.khaki;
    const midC = r() < 0.3 ? MARSH.green : MARSH.olive;
    list.push(bladeGeo(root, dir, 0.4 + r() * 0.42, 0.012 + r() * 0.008, 0.25 + r() * 0.45, 3, (t, o) => (t < 0.5 ? o.copy(MARSH.mud).lerp(midC, t * 2) : o.copy(midC).lerp(tipC, (t - 0.5) * 2))));
  }
  return oneGeo(list);
}

// Reeds, up to 2 m: dead brown-green stalks, a few bent and snapped, some
// with their brown heads, leaves trailing from their feet. One geometry.
export function reedsGeo(seed = 1) {
  const r = rng(seed * 5 + 9);
  const list = [];
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const rr = Math.sqrt(r()) * 0.4;
    const root = V3(Math.cos(a) * rr, -0.1, Math.sin(a) * rr);
    const H = 1.1 + r() * 1.0;
    const lean = V3(Math.cos(a) * 0.12 + (r() - 0.5) * 0.1, 1, Math.sin(a) * 0.12 + (r() - 0.5) * 0.1).normalize();
    const c0 = r() < 0.5 ? MARSH.green : MARSH.olive;
    const c1 = r() < 0.6 ? MARSH.dead : MARSH.straw;
    const broken = r() < 0.2;
    if (broken) {
      const k = 0.45 + r() * 0.2;
      list.push(bladeGeo(root, lean, H * k, 0.012, 0, 2, (t, o) => o.copy(MARSH.mud).lerp(c0, t)));
      const kink = root.clone().addScaledVector(lean, H * k);
      const down = V3(Math.cos(a + 1) * 0.8, -0.35, Math.sin(a + 1) * 0.8).normalize();
      list.push(bladeGeo(kink, down, H * (1 - k), 0.01, 0.05, 2, (t, o) => o.copy(c0).lerp(c1, t)));
    } else {
      list.push(bladeGeo(root, lean, H, 0.013, 0.04, 3, (t, o) => (t < 0.4 ? o.copy(MARSH.mud).lerp(c0, t / 0.4) : o.copy(c0).lerp(c1, (t - 0.4) / 0.6))));
      if (r() < 0.35) {
        const top = root.clone().addScaledVector(lean, H * 0.82);
        list.push(solid(along(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 5), lean, top.clone().addScaledVector(lean, 0.1)), C(0x4a3220)));
      }
    }
    // a leaf off its foot, trailing over
    const la = a + (r() - 0.5) * 2;
    const ld = V3(Math.cos(la) * 0.5, 1, Math.sin(la) * 0.5).normalize();
    list.push(bladeGeo(root.clone().add(V3(0, 0.05, 0)), ld, 0.6 + r() * 0.5, 0.018, 0.55 + r() * 0.3, 3, (t, o) => o.copy(c0).lerp(c1, t)));
  }
  return oneGeo(list);
}

// A drowned tree, about 4 m: a twisted bare snag, black and wet below,
// silver-grey above, limbs broken short, the top snapped. One geometry.
export function deadTreeGeo(seed = 1) {
  const r = rng(seed * 7 + 3);
  const n = makeNoise(seed + 17);
  const list = [];
  const H = 3.6 + r() * 0.8;
  const trunk = [];
  let x = 0;
  let z = 0;
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    trunk.push(V3(x, -0.5 + t * H * 0.85, z));
    x += (r() - 0.5) * 0.55 + (i > 3 ? 0.12 : 0);
    z += (r() - 0.5) * 0.55;
  }
  const curve = new THREE.CatmullRomCurve3(trunk);
  list.push(tube(trunk, 0.26, 0.09, { seg: 12, radial: 8, gnarl: 0.35, seed }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + r() * 0.6;
    const l = 0.6 + r() * 0.5;
    list.push(tube([[0, 0.35, 0], [Math.cos(a) * l * 0.5, 0.0, Math.sin(a) * l * 0.5], [Math.cos(a) * l, -0.45, Math.sin(a) * l]], 0.12, 0.04, { seg: 4, radial: 5, gnarl: 0.25, seed: seed + i }));
  }
  const branch = (from, dir, len, r0, depth) => {
    const pts = [from.clone()];
    const d = dir.clone();
    let p = from.clone();
    for (let i = 0; i < 3; i++) {
      d.x += (r() - 0.5) * 0.9;
      d.z += (r() - 0.5) * 0.9;
      d.y += (r() - 0.45) * 0.6;
      d.normalize();
      p = p.clone().addScaledVector(d, len / 3);
      pts.push(p);
    }
    list.push(tube(pts, r0, Math.max(0.01, r0 * 0.3), { seg: depth ? 3 : 5, radial: depth ? 3 : 5, gnarl: 0.2, seed: seed + depth * 9 + pts.length }));
    if (depth >= 1) return;
    for (let k = 0; k < 2; k++) {
      const at = new THREE.CatmullRomCurve3(pts).getPointAt(0.4 + r() * 0.5);
      branch(at, V3(r() - 0.5, 0.3 + r() * 0.5, r() - 0.5).normalize().add(d.clone().multiplyScalar(0.5)).normalize(), len * 0.45, r0 * 0.45, depth + 1);
    }
  };
  const limbs = 3 + Math.floor(r() * 2);
  for (let i = 0; i < limbs; i++) {
    const t = 0.4 + (i / limbs) * 0.45;
    const a = (i / limbs) * TAU + r() * 0.9;
    const from = curve.getPointAt(t);
    const dir = V3(Math.cos(a), 0.2 + r() * 0.6, Math.sin(a)).normalize();
    if (i === 0) {
      list.push(tube([from, from.clone().addScaledVector(dir, 0.35), from.clone().addScaledVector(dir, 0.6)], 0.08, 0.06, { seg: 3, radial: 5, gnarl: 0.3 }));
      continue;
    }
    branch(from, dir, H * (0.32 + r() * 0.15), 0.085 - t * 0.03, 0);
  }
  // the top, snapped off in splinters
  const top = trunk[trunk.length - 1];
  for (let i = 0; i < 3; i++) list.push(new THREE.ConeGeometry(0.035, 0.3 + r() * 0.25, 4).translate((r() - 0.5) * 0.08, 0.15, (r() - 0.5) * 0.08).rotateZ((r() - 0.5) * 0.3).translate(top.x, top.y, top.z));
  const g = oneGeo(list);
  const base = H * 0.85 - 0.5;
  tint(g, (px, py, pz, out) => {
    const v = noise3(n, px * 3, py * 1.2, pz * 3);
    out.setRGB(0.22, 0.2, 0.17).multiplyScalar(0.75 + v * 0.5);
    out.lerp(_kc2.setRGB(0.44, 0.43, 0.4), smooth(0.3, base, py) * 0.85);
    out.lerp(_kc2.setRGB(0.05, 0.06, 0.03), (1 - smooth(-0.4, 0.5, py)) * 0.75);
    out.lerp(_kc2.setRGB(0.12, 0.16, 0.07), (1 - smooth(0.0, 1.1, py)) * smooth(0.45, 0.6, v) * 0.6);
  });
  return g;
}
const _kc2 = new THREE.Color();

// A candle-light over the pools: a small pale flame about 0.2 m above the
// group's origin (the scene sets it 0.2 over the water), its soft green-white
// glow, and the glow lying on the water under it. update(t) flickers and
// bobs it.
export function wisp(K) {
  const g = new THREE.Group();
  g.name = 'wisp';
  const sprite = (map, colour, opacity, sx, sy) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: colour, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(sx, sy, 1);
    g.add(s);
    return s;
  };
  const halo = sprite(K.tex.glow, hot(0x9cffc8, 0.7), 0.55, 1.7, 1.7);
  const flame = sprite(K.tex.flame, hot(0xe8fff0, 2.4), 1, 0.13, 0.27);
  const core = sprite(K.tex.glow, hot(0xffffff, 2.6), 0.9, 0.09, 0.09);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0x8affc0, 0.5), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.position.y = -0.185;
  pool.renderOrder = 2;
  g.add(pool);
  const update = (t) => {
    const f = 0.82 + 0.1 * Math.sin(t * 13.3) * Math.sin(t * 7.1 + 1) + 0.08 * Math.sin(t * 29.7);
    const y = 0.21 + Math.sin(t * 1.3) * 0.05 + Math.sin(t * 3.1) * 0.012;
    const x = Math.sin(t * 0.7) * 0.04;
    for (const s of [halo, flame, core]) s.position.set(x, y, 0);
    flame.position.y = y + 0.04;
    flame.scale.set(0.12 * (0.9 + f * 0.15), 0.26 * f, 1);
    flame.material.opacity = 0.75 + f * 0.25;
    halo.material.opacity = 0.42 * f;
    core.material.opacity = 0.7 * f;
    pool.material.opacity = 0.38 * f;
    pool.scale.setScalar(0.9 + f * 0.15);
  };
  update(0);
  return { group: g, flame, update };
}

// A drowned face under the water, about 0.5 m, looking up: pale, ghostly,
// half there. Drawn where it lies, but tested for depth as if `lift` m
// higher, so the opaque water over it (up to 0.7 m above) doesn't hide it.
// update(t, k): k 0..1 how clearly it shows.
export function faceGeo() {
  const g = new THREE.PlaneGeometry(0.46, 0.46, 14, 14);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) - 0.5;
    const v = uv.getY(i) - 0.48;
    const oval = Math.max(0, 1 - Math.hypot(u / 0.26, v / 0.33));
    let h = Math.sqrt(oval) * 0.06;
    h += Math.exp(-((u / 0.035) ** 2) - (((v + 0.0) / 0.08) ** 2)) * 0.02;
    h -= Math.exp(-(((Math.abs(u) - 0.09) / 0.05) ** 2) - (((v - 0.03) / 0.035) ** 2)) * 0.015;
    h -= Math.exp(-((u / 0.06) ** 2) - (((v + 0.19) / 0.03) ** 2)) * 0.01;
    p.setZ(i, h);
  }
  g.computeVertexNormals();
  return g.rotateX(-Math.PI / 2);
}
export function face(K, seed = 1) {
  const kind = ((seed % 3) + 3) % 3;
  const g = new THREE.Group();
  g.name = 'face';
  // (a kit's own, where it gives one: the Road's, on its house look; else the chapter's)
  const m = (K.shaders?.face ?? faceMaterial)(K.tex.faces[kind]);
  const { uniforms } = m;
  const mesh = new THREE.Mesh(K.faceGeo, m);
  mesh.rotation.y = ((seed * 1.7) % 1) * TAU;
  mesh.renderOrder = 3;
  g.add(mesh);
  const update = (t, k = 0) => {
    uniforms.uTime.value = t;
    const flick = 0.85 + 0.15 * Math.sin(t * 2.1 + seed);
    uniforms.uK.value = (0.06 + 0.66 * clamp01(k)) * flick;
    mesh.position.y = Math.sin(t * 0.5 + seed) * 0.03;
  };
  update(0, 0);
  return { group: g, mesh, kind, update };
}

// ── the fell beast ──

const BEAST = { hide: C(0x2a2724), belly: C(0x433d36), back: C(0x141312), horn: C(0x5a5048), web: C(0x231e1b), vein: C(0x4a3c32), edge: C(0x3a2a24) };

// One wing for side s: an arm out to the wrist, four long fingers from it,
// and the torn membrane between, in two parts that flap about axes along
// their joins so the skin never parts: the inner from the flank (shoulder
// to hip), the outer from the fourth finger.
function wingParts(K, s, n, r) {
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
  const colour = (geo, fn) => tint(geo, fn);
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
        const a = L(v);
        const b = Tr(v);
        const p = a.lerp(b, u);
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
  const hide = (geo, dark = 0) =>
    colour(geo, (x, y, z, out) => {
      out.copy(BEAST.hide).multiplyScalar(0.8 + noise3(n, x * 3, y * 3, z * 3) * 0.4).lerp(BEAST.back, dark);
    });
  // the inner wing: arm bones and the membrane from the flank to the fourth finger
  const inner = parts();
  const lead = poly([S, E, W]);
  const trail = (v) => {
    const p = H.clone().lerp(F[3], v);
    return p.lerp(lead(v), 0.16 * Math.sin(Math.PI * v));
  };
  inner.add(mats.membrane, skinGrid(lead, trail, 6, 10, { sag: 0.3, holes: 2, seed: 11 + s }).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hide(sweep([S, S.clone().lerp(E, 0.5).add(V3(0, 0.08, 0)), E], [[0.17], [0.12], [0.11]], { seg: 5, radial: 7 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hide(sweep([E, E.clone().lerp(W, 0.5).add(V3(0, 0.04, 0)), W], [[0.11], [0.08], [0.085]], { seg: 5, radial: 7 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hide(lump(0.13, { p: E.toArray() }, { detail: 1 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHide, hide(lump(0.12, { p: W.toArray() }, { detail: 1 })).applyMatrix4(inv(Min)));
  inner.add(mats.beastHorn, spikeAt(W.clone().add(V3(0.05, 0.05, 0)), V3(1, 0.3, 0.15 * s), 0.45, 0.06, 5).applyMatrix4(inv(Min)));
  // the outer wing: the fingers, and the skin between them, scalloped and torn
  const outer = parts();
  F.forEach((f, i) => outer.add(mats.beastHide, hide(sweep([W, W.clone().lerp(f, 0.5).add(V3(0, 0.05, 0)), f], [[i === 0 ? 0.075 : 0.06], [0.045], [0.018]], { seg: 6, radial: 5 })).applyMatrix4(inv(Mout))));
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
  void r;
  return { pivot, flapIn, flapOut, sIn, sOut };
}

// The Nazgûl's fell beast with its rider, about 15 m from wingtip to
// wingtip: leathery wings, tattered at their trailing edges, a long
// snaking neck, a hooked beak of a reptile's head with horns swept back, a
// long tail, talons tucked under; on its shoulders the black rider, hooded
// and faceless, his cloak streaming. Faces +x. animate(t, { flap }).
export function fellBeast(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'fellBeast';
  const n = makeNoise(733);
  const r = rng(733);
  const body = bone('body', g);
  const hide = (geo, { belly = 0, dark = 0 } = {}) =>
    tint(geo, (x, y, z, out, nx, ny) => {
      const m = noise3(n, x * 2.5, y * 2.5, z * 2.5);
      out.copy(BEAST.hide).multiplyScalar(0.78 + m * 0.44);
      out.lerp(BEAST.belly, clamp01(-ny * 0.8) * belly);
      out.lerp(BEAST.back, clamp01(ny) * 0.5 + dark);
    });
  const H = mats.beastHide;
  const bk = parts();
  // the body: a deep keel of a chest, narrowing to the hips
  bk.add(H, hide(sweep([[-1.6, 0.0, 0], [-0.7, 0.05, 0], [0.3, 0.12, 0], [1.2, 0.26, 0], [1.85, 0.42, 0]], [[0.4, 0.38, 0.36], [0.6, 0.52, 0.5], [0.78, 0.6, 0.55], [0.66, 0.52, 0.48], [0.38, 0.34, 0.34]], { seg: 12, radial: 14 }), { belly: 1 }));
  // a ridge of spines down the back
  for (let i = 0; i < 9; i++) {
    const x = 1.5 - i * 0.36;
    bk.add(mats.beastHorn, spikeAt(V3(x, 0.5 + Math.sin((i / 8) * Math.PI) * 0.12, 0), V3(-0.6, 1, 0), 0.18 + Math.sin((i / 8) * Math.PI) * 0.12, 0.05, 4));
  }
  // the hind legs, trailed back, the talons curled
  for (const s of [-1, 1]) {
    bk.add(H, hide(sweep([[-0.9, -0.3, s * 0.38], [-1.35, -0.75, s * 0.5], [-1.95, -0.95, s * 0.46]], [[0.24], [0.15], [0.1]], { seg: 6, radial: 8 }), { belly: 0.6 }));
    bk.add(H, hide(lump(0.12, { p: [-1.98, -0.97, s * 0.46] }, { detail: 1 })));
    for (let t = 0; t < 3; t++) {
      const z = s * (0.46 + (t - 1) * 0.08);
      bk.add(mats.beastHorn, tube([[-2.0, -0.98, z], [-2.32, -1.04, z * 1.04], [-2.5, -0.92, z * 1.08]], 0.035, 0.008, { seg: 5, radial: 4 }));
    }
  }
  bk.build(body, { shadow: false, receive: false });

  // the neck, in two lengths, and the head
  const neckA = bone('neckA', body, [1.75, 0.4, 0]);
  const neckB = bone('neckB', neckA, [1.55, 0.62, 0]);
  const head = bone('head', neckB, [1.45, -0.05, 0]);
  const jaw = bone('jaw', head, [0.25, -0.1, 0]);
  {
    const a = parts();
    a.add(H, hide(sweep([[-0.2, -0.05, 0], [0.75, 0.42, 0], [1.6, 0.64, 0]], [[0.4, 0.36], [0.28, 0.26], [0.22, 0.2]], { seg: 9, radial: 10 }), { belly: 0.8 }));
    for (let i = 0; i < 4; i++) a.add(mats.beastHorn, spikeAt(V3(0.2 + i * 0.38, 0.38 + i * 0.12, 0), V3(-0.5, 1, 0), 0.16, 0.04, 4));
    a.build(neckA, { shadow: false, receive: false });
    const b = parts();
    b.add(H, hide(sweep([[-0.1, 0.02, 0], [0.7, 0.12, 0], [1.5, -0.05, 0]], [[0.22, 0.2], [0.19, 0.17], [0.17, 0.15]], { seg: 9, radial: 10 }), { belly: 0.8 }));
    b.add(H, hide(lump(0.21, { p: [0, 0.02, 0] }, { detail: 1 })));
    for (let i = 0; i < 3; i++) b.add(mats.beastHorn, spikeAt(V3(0.25 + i * 0.4, 0.18, 0), V3(-0.5, 1, 0), 0.13, 0.035, 4));
    b.build(neckB, { shadow: false, receive: false });
    const h = parts();
    h.add(H, hide(lump(0.26, { p: [0.12, 0.04, 0], s: [1.35, 0.78, 0.8] }, { detail: 2, amp: 0.08 })));
    // the beak: long, hooked, horn-coloured
    h.add(mats.beastHorn, sweep([[0.32, 0.05, 0], [0.72, 0.03, 0], [1.08, -0.04, 0], [1.3, -0.17, 0]], [[0.15, 0.13], [0.11, 0.09], [0.065, 0.055], [0.012, 0.012]], { seg: 9, radial: 8 }));
    // the horns swept back from the skull, a crest between
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

  // the tail, long and tapering, with a barbed tip
  const tailA = bone('tailA', body, [-1.55, 0.0, 0]);
  const tailB = bone('tailB', tailA, [-2.1, -0.12, 0]);
  {
    const a = parts();
    a.add(H, hide(sweep([[0.1, 0, 0], [-1.0, -0.08, 0], [-2.1, -0.12, 0]], [[0.38, 0.34], [0.24, 0.22], [0.16, 0.15]], { seg: 8, radial: 9 }), { belly: 0.6 }));
    for (let i = 0; i < 5; i++) a.add(mats.beastHorn, spikeAt(V3(-0.3 - i * 0.4, 0.2 - i * 0.02, 0), V3(-0.8, 1, 0), 0.14, 0.035, 4));
    a.build(tailA, { shadow: false, receive: false });
    const b = parts();
    b.add(H, hide(sweep([[0.05, 0, 0], [-1.2, -0.04, 0], [-2.5, 0.05, 0]], [[0.16, 0.15], [0.1, 0.09], [0.035, 0.035]], { seg: 9, radial: 7 })));
    b.add(mats.beastHorn, facet(new ConvexGeometry([V3(-2.4, 0.05, 0), V3(-2.75, 0.06, 0.2), V3(-2.75, 0.06, -0.2), V3(-3.15, 0.05, 0), V3(-2.7, 0.12, 0), V3(-2.7, 0.0, 0)])));
    b.build(tailB, { shadow: false, receive: false });
  }

  // the wings
  const wings = [-1, 1].map((s) => {
    const w = wingParts(K, s, n, r);
    body.add(w.pivot);
    return w;
  });

  // the rider: hooded, black, faceless, astride its shoulders
  const rider = bone('rider', body, [1.15, 0.6, 0]);
  {
    const rb = parts();
    const R = mats.nazgulRobe;
    rb.add(mats.saddle, new THREE.BoxGeometry(0.7, 0.14, 0.7), { p: [0, 0.05, 0] });
    for (const s of [-1, 1]) rb.add(R, sweep([[0, 0.25, s * 0.18], [0.3, 0.1, s * 0.46], [0.25, -0.45, s * 0.56]], [[0.11], [0.1], [0.09]], { seg: 6, radial: 7 }));
    rb.add(R, sweep([[0, 0.1, 0], [0.05, 0.55, 0], [0.12, 1.05, 0]], [[0.3, 0.32], [0.24, 0.27], [0.17, 0.2]], { seg: 6, radial: 12 }));
    // the hood, peaked, its opening a void
    rb.add(R, lump(0.21, { p: [0.2, 1.24, 0], s: [1.05, 1.15, 0.95] }, { detail: 2, amp: 0.05 }));
    rb.add(R, new THREE.ConeGeometry(0.12, 0.3, 8), { p: [0.12, 1.45, 0], r: [0, 0, 0.5] });
    rb.add(mats.void, lump(0.13, { p: [0.33, 1.2, 0], s: [0.5, 1, 0.85] }, { detail: 1 }));
    // the arms forward to the reins, gauntleted
    for (const s of [-1, 1]) {
      rb.add(R, sweep([[0.08, 0.92, s * 0.22], [0.36, 0.72, s * 0.26], [0.66, 0.62, s * 0.2]], [[0.08], [0.07], [0.065]], { seg: 5, radial: 7 }));
      rb.add(mats.gauntlet, lump(0.06, { p: [0.7, 0.6, s * 0.18], s: [1.3, 1, 1] }));
      rb.add(mats.gauntlet, spikeAt(V3(0.66, 0.66, s * 0.2), V3(0.3, 1, 0), 0.1, 0.02, 4));
    }
    rb.build(rider, { shadow: false, receive: false });
  }
  // the cloak, streaming back from his shoulders: a strip rewritten each frame
  const CW = 5;
  const CH = 8;
  const cloakGeo = new THREE.PlaneGeometry(1, 1, CW, CH);
  const cp = cloakGeo.attributes.position;
  const cloak = new THREE.Mesh(cloakGeo, mats.nazgulRobe);
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
        const len = 2.4 - (j === CH ? tatter[i] : 0);
        const x = -u * len;
        const wave = Math.sin(t * 7 - u * 5 + v * 2) * 0.16 * u * k + Math.sin(t * 13 - u * 9) * 0.04 * u;
        cp.setXYZ(idx, 0.02 + x, 1.08 - u * 0.75 + wave, v * (0.55 + u * 0.4) + Math.sin(t * 5 - u * 4) * 0.08 * u);
      }
    }
    cp.needsUpdate = true;
    cloakGeo.computeVertexNormals();
  };

  // its beat carried on from frame to frame, slowing as it glides, and how
  // hard it beats eased, so going from one to the other never jumps a wing
  const E = { t: null, k: null, ph: 0 };
  const animate = (t, { flap = 1 } = {}) => {
    const dt = E.t == null || t < E.t ? 0 : Math.min(0.1, t - E.t);
    E.t = t;
    E.k = E.k == null ? clamp01(flap) : ease(E.k, clamp01(flap), dt, 2.5);
    const k = E.k;
    E.ph += dt * 2.6 * (0.65 + 0.35 * k);
    const ph = E.ph;
    // a heavy downstroke, a slower recovery
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
    streamCloak(t, 0.6 + k * 0.4);
  };
  animate(0);
  return { group: g, body, head, jaw, wings, rider, animate };
}

// ── before the Black Gate ──

const GATE = { half: 30, height: 40, open: 1.2 };
const STONE = { base: C(0x4a4542), dark: C(0x221f1d), ash: C(0x8a8076), rust: C(0x5a3424), iron: C(0x77706a) };

// A peak of the Mountains of Shadow, `R` across at its foot and `H` high:
// a cone broken into facets and ridges, ash lying on its ledges.
function peakGeo(seed, R, H, detail = 2) {
  const r = rng(seed);
  const n = makeNoise(seed);
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU;
    const b = 0.5 + r() * 0.9;
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.4 + r() * 0.35 });
  }
  const lean = [(r() - 0.5) * 0.3, (r() - 0.5) * 0.3];
  const flutes = 4 + Math.floor(r() * 4);
  const turn = r() * TAU;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + (fbm(n, v.x * 1.7 + v.z + 3, v.y * 1.7 - v.z, { octaves: 3 }) - 0.5) * 0.5;
    v.multiplyScalar(k);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    const hf = clamp01((v.y + 1) / 2);
    const flute = 1 + 0.32 * Math.sin(Math.atan2(v.z, v.x) * flutes + turn) * Math.sin(hf * Math.PI);
    const taper = Math.pow(1 - hf, 0.9) * 1.15 * flute;
    v.set(v.x * R * taper + lean[0] * hf * H, Math.max(-0.15, hf - 0.15) * H, v.z * R * 0.8 * taper + lean[1] * hf * H);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = facet(g);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(STONE.base).multiplyScalar(0.7 + noise3(n, x * 0.04, y * 0.04, z * 0.04) * 0.6);
    out.lerp(STONE.ash, smooth(0.35, 0.8, ny) * 0.6);
    out.lerp(STONE.rust, smooth(0.6, 0.75, noise3(n, x * 0.02 + 5, y * 0.03, z * 0.02)) * 0.4);
  });
  return g;
}

// One iron leaf of the Gate, 30 m wide and 40 high, hinged at x = 0 and
// running out along σx: a slab, wedge ribs up it, bands across, braces in
// a zigzag between, spikes out of the bands and a crown of them along the
// top. Its front faces +z.
function gateLeafGeo(sigma, seed) {
  const r = rng(seed);
  const { half: Wd, height: Ht } = GATE;
  const list = [];
  list.push(new THREE.BoxGeometry(Wd, Ht, 2).translate((sigma * Wd) / 2, Ht / 2, 0));
  const ribs = [2.5, 8.5, 14.5, 20.5, 26.5];
  for (const x of ribs) list.push(new THREE.CylinderGeometry(1.4, 1.4, Ht, 3).scale(0.8, 1, 1).translate(sigma * x, Ht / 2, 1.7));
  // the leading edge, where the two meet
  list.push(new THREE.BoxGeometry(1.4, Ht, 2.6).translate(sigma * (Wd - 0.7), Ht / 2, 0.3));
  const bands = [4, 13, 22, 31];
  for (const y of bands) list.push(new THREE.BoxGeometry(Wd, 1.7, 1).translate((sigma * Wd) / 2, y, 1.4));
  list.push(new THREE.BoxGeometry(Wd, 1.4, 1.2).translate((sigma * Wd) / 2, Ht - 0.7, 1.3));
  // braces, zigzagging up each bay
  for (let b = 0; b < ribs.length - 1; b++) {
    for (let k = 0; k < bands.length - 1; k++) {
      const x0 = sigma * (ribs[b] + 0.8);
      const x1 = sigma * (ribs[b + 1] - 0.8);
      const up = (b + k) % 2 === 0;
      list.push(rod([x0, bands[k] + (up ? 0.9 : 8.1), 1.3], [x1, bands[k] + (up ? 8.1 : 0.9), 1.3], 0.45, 0.45, 4));
    }
  }
  // spikes out of the bands, between the ribs
  for (const y of bands) {
    for (let b = 0; b < ribs.length - 1; b++) list.push(spikeAt(V3(sigma * (ribs[b] + ribs[b + 1]) * 0.5, y, 1.8), V3(0, 0.3, 1), 3.4, 0.55, 4));
  }
  // the crown of spikes along the top
  for (let i = 0; i < 10; i++) {
    const x = sigma * (1.5 + i * 3);
    const tall = i % 2 ? 3 + r() * 1.5 : 5 + r() * 1.5;
    list.push(spikeAt(V3(x, Ht - 0.2, 0.4), V3(sigma * (r() - 0.5) * 0.2, 1, 0.12), tall, 0.9, 4));
  }
  // rivet heads along the bands
  for (const y of bands) for (let i = 0; i < 14; i++) list.push(new THREE.ConeGeometry(0.32, 0.35, 4).rotateX(Math.PI / 2).translate(sigma * (1 + i * 2.1), y + 0.55, 1.98));
  const g = oneGeo(list.map((x) => facet(x)));
  boxUV(g, 0.12);
  const n = makeNoise(seed + 1);
  tint(g, (x, y, z, out) => {
    out.copy(STONE.iron).multiplyScalar(0.8 + noise3(n, x * 0.1, y * 0.1, z * 0.1) * 0.4);
    out.lerp(STONE.rust, (1 - smooth(0, 9, y)) * 0.4);
  });
  return g;
}

// The Morannon: the Black Gate of Mordor across its pass, two iron leaves
// each 30 m wide and 40 high in a wall 58 high, the Towers of the Teeth
// either side, 70 m and crowned with fangs, slits of fire in them; walls
// running off to bastions and into the jagged mountains either side. Its
// front faces +z, the leaves hinged at x = ±30 and swinging in (to −z):
// open(k) 0 shut, 1 open. Built to be seen from 100–200 m.
export function blackGate(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'blackGate';
  const n = makeNoise(907);
  const r = rng(907);
  const stone = [];
  const fire = [];
  const add = (geo) => stone.push(geo);
  const box = (w, h, d, x, y, z) => add(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
  // a square tier from y0 to y1, `a` across at its foot and `b` at its head
  const tier = (a, b, y0, y1, x, z) => add(new THREE.CylinderGeometry((b * Math.SQRT2) / 2, (a * Math.SQRT2) / 2, y1 - y0, 4, 1).rotateY(Math.PI / 4).translate(x, (y0 + y1) / 2, z));
  const merlons = (x0, x1, y, z, d, step = 5) => {
    for (let x = x0 + step / 2; x < x1; x += step) {
      box(step * 0.55, 3.2, d, x, y + 1.6, z);
      if (Math.round((x - x0) / step) % 2 === 0) add(spikeAt(V3(x, y + 3.1, z), V3(0, 1, 0.08), 3.5, 0.8, 4));
    }
  };
  const slit = (x, y, z, h = 3.6, face = 'z') => fire.push(face === 'z' ? new THREE.BoxGeometry(0.7, h, 0.4).translate(x, y, z) : new THREE.BoxGeometry(0.4, h, 0.7).translate(x, y, z));

  // ── the wall the Gate stands in
  const TOP = 58;
  box(22, TOP + 10, 18, -41, TOP / 2 - 5, -4);
  box(22, TOP + 10, 18, 41, TOP / 2 - 5, -4);
  box(60, TOP - 47, 18, 0, (TOP + 47) / 2, -4);
  // the frame of the opening, wedged, and the cornice over it
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(2.4, 2.4, TOP + 10, 3).scale(1, 1, 1.2).translate(s * 31.6, TOP / 2 - 5, 5.4));
    add(new THREE.CylinderGeometry(1.8, 1.8, TOP + 6, 3).scale(1, 1, 1.2).translate(s * 46, TOP / 2 - 7, 5.4));
  }
  box(104, 2.6, 4, 0, 46, 6.2);
  box(104, 2, 3, 0, TOP - 1, 5.8);
  merlons(-52, 52, TOP, 2.5, 3);
  // teeth along the lintel, down and out over the leaves
  for (let i = 0; i < 12; i++) add(spikeAt(V3(-27.5 + i * 5, 46.5, 7.4), V3(0, -1, 0.7), 5 + (i % 2) * 1.5, 0.8, 4));
  slit(-41, 30, 5.1);
  slit(41, 30, 5.1);
  slit(-10, 52, 5.1, 2.6);
  slit(10, 52, 5.1, 2.6);
  slit(0, 52, 5.1, 2.6);

  // ── the Towers of the Teeth
  for (const s of [-1, 1]) {
    const x = s * 64;
    tier(24, 20, -12, 34, x, -2);
    box(22.5, 2, 22.5, x, 34.5, -2);
    tier(18, 15, 35, 57, x, -2);
    box(17, 1.8, 17, x, 57.5, -2);
    tier(13, 11, 58, 70, x, -2);
    // buttress fins at its corners
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.CylinderGeometry(2.2, 2.2, 52, 3).rotateY(Math.atan2(cx, cz)).translate(x + cx * 11.5, 14, -2 + cz * 11.5));
      add(spikeAt(V3(x + cx * 11.5, 40, -2 + cz * 11.5), V3(cx * 0.3, 1, cz * 0.3), 6, 1.3, 4));
      add(spikeAt(V3(x + cx * 8, 58, -2 + cz * 8), V3(cx * 0.35, 1, cz * 0.35), 5, 1, 4));
    }
    // the teeth: a crown of fangs round its head
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + 0.3;
      const rr = 5.2;
      add(spikeAt(V3(x + Math.cos(a) * rr, 69.5, -2 + Math.sin(a) * rr), V3(Math.cos(a) * 0.28, 1, Math.sin(a) * 0.28), 7 + (i % 3) * 2.5 + r() * 2, 1.5, 4));
    }
    add(spikeAt(V3(x, 69.5, -2), V3(0, 1, 0), 15, 2.4, 4));
    // its windows, slits of fire
    for (const y of [12, 22, 42, 50]) for (const dx of [-5, 0, 5]) slit(x + dx, y, -2 + (y < 34 ? 10.6 : 8.2));
    for (const dx of [-3, 3]) slit(x + dx, 63, -2 + 6.2, 2.8);
    for (const y of [18, 44]) slit(x + s * (y < 34 ? 10.6 : 8.2), y, -2, 3.6, 'x');
  }

  // ── the walls running off to bastions, and into the mountains
  for (const s of [-1, 1]) {
    box(110, 42, 9, s * 130, 9, -4);
    merlons(s > 0 ? 76 : -184, s > 0 ? 184 : -76, 30, -4, 9, 6);
    for (const bx of [110, 150]) {
      tier(13, 11, -12, 42, s * bx, -2);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        add(spikeAt(V3(s * bx + Math.cos(a) * 4, 41.5, -2 + Math.sin(a) * 4), V3(Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3), 5 + (i % 2) * 2, 1, 4));
      }
      slit(s * bx, 32, 4, 3);
    }
  }
  const stoneGeo = oneGeo(stone.map((x) => facet(x)));
  boxUV(stoneGeo, 0.08);
  tint(stoneGeo, (x, y, z, out, nx, ny) => {
    out.copy(STONE.base).multiplyScalar(0.72 + noise3(n, x * 0.06, y * 0.06, z * 0.06) * 0.56);
    out.lerp(STONE.dark, (1 - smooth(-6, 12, y)) * 0.5);
    if (ny > 0.6) out.lerp(STONE.ash, 0.5);
    out.lerp(STONE.rust, smooth(0.62, 0.75, noise3(n, x * 0.05 + 3, y * 0.08, z * 0.05)) * 0.3);
  });
  const wall = new THREE.Mesh(stoneGeo, mats.gateStone);
  wall.name = 'gateWall';
  g.add(wall);
  const glow = new THREE.Mesh(oneGeo(fire), mats.slit);
  glow.name = 'gateFires';
  g.add(glow);

  // ── the mountains either side, and the dark ground behind
  const peaks = [];
  const PEAKS = [
    [150, -40, 70, 120], [196, 10, 65, 165], [244, -60, 80, 210], [292, 14, 70, 150], [330, -110, 90, 240], [132, -130, 70, 150], [205, -170, 80, 200], [270, -230, 90, 260], [120, 40, 40, 70], [360, 40, 60, 120],
  ];
  for (const s of [-1, 1]) {
    PEAKS.forEach(([x, z, R, H], i) => {
      const px = s * (x + (r() - 0.5) * 20);
      const geo = peakGeo(500 + i * 7 + (s > 0 ? 3 : 0), R, H * (0.85 + r() * 0.3));
      geo.rotateY(r() * TAU).translate(px, -12, z);
      peaks.push(geo);
      // shoulders of lesser crags about it, so it reads as a range
      for (let k = 0; k < 2; k++) {
        const a = r() * TAU;
        const sub = peakGeo(700 + i * 11 + k + (s > 0 ? 5 : 0), R * (0.4 + r() * 0.25), H * (0.35 + r() * 0.3), 1);
        sub.rotateY(r() * TAU).translate(px + Math.cos(a) * R * 0.75, -12, z + Math.sin(a) * R * 0.6);
        peaks.push(sub);
      }
    });
  }
  const ground = new THREE.PlaneGeometry(260, 340, 1, 1).rotateX(-Math.PI / 2).translate(0, -0.5, -180);
  tint(ground, (x, y, z, out) => out.copy(STONE.dark).lerp(STONE.ash, 0.15));
  peaks.push(ground);
  const mountains = oneGeo(peaks);
  boxUV(mountains, 0.02);
  const hills = new THREE.Mesh(mountains, mats.mountain);
  hills.name = 'mountains';
  g.add(hills);

  // ── the leaves
  const leaves = [-1, 1].map((s) => {
    const hinge = bone(s < 0 ? 'leafL' : 'leafR', g, [s * GATE.half, 0, 0]);
    const m = new THREE.Mesh(gateLeafGeo(-s, 950 + s), mats.gateIron);
    m.name = 'gateLeaf';
    hinge.add(m);
    return hinge;
  });
  // the glow of Mordor through the gap as they part
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(64, 46), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0xff6a28, 1.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  haze.position.set(0, 20, -26);
  haze.scale.set(1.4, 1.2, 1);
  haze.name = 'mordorGlow';
  g.add(haze);
  const open = (k) => {
    const e = clamp01(k);
    const a = e * e * (3 - 2 * e) * GATE.open;
    leaves[0].rotation.y = a;
    leaves[1].rotation.y = -a;
    haze.material.opacity = e * 0.85;
    haze.visible = e > 0.001;
  };
  open(0);
  return { group: g, leaves, open };
}

// ── the Easterlings ──

const EAST = { lacquer: C(0x8c1c14), maroon: C(0x4c100c), gold: C(0xd0a038), black: C(0x16120f), cloth: C(0x30201a), steel: C(0xb4b8bc), shaft: C(0x2a140e), tassel: C(0xa01810) };
const EAST_METAL = new Set(['gold', 'steel']);
// Bones: [parent, position]. The figure faces +x, its right side +z.
const EAST_BONES = {
  hips: [null, [0, 1.0, 0]],
  legL: ['hips', [0, -0.03, -0.13]],
  legR: ['hips', [0, -0.03, 0.13]],
  shinL: ['legL', [0, -0.47, 0]],
  shinR: ['legR', [0, -0.47, 0]],
  body: ['hips', [0, 0.04, 0]],
  head: ['body', [0, 0.76, 0]],
  armL: ['body', [0, 0.62, -0.31]],
  armR: ['body', [0, 0.62, 0.31]],
  foreL: ['armL', [0, -0.35, 0]],
  foreR: ['armR', [0, -0.35, 0]],
  spear: ['foreR', [0, -0.36, 0]],
};
function eastRig(root) {
  const b = {};
  for (const [name, [parent, p]] of Object.entries(EAST_BONES)) b[name] = bone(name, parent ? b[parent] : root, p);
  return b;
}

// The parts of an Easterling, each in its bone's frame: [bone, kind, geo].
// `q` sets the detail: q.rad round, q.seg along, q.fine for the trim.
function eastParts(seed, q) {
  const r = rng(seed * 31 + 7);
  const out = [];
  const put = (b, kind, geo) => out.push([b, kind, geo]);
  const R = q.rad;
  const helm = r() < 0.5 ? 'lacquer' : 'black';
  // the hips: a skirt of lacquered lames in tiers, a belt
  put('hips', 'cloth', new THREE.CylinderGeometry(0.19, 0.2, 0.2, R).translate(0, -0.02, 0));
  const tiers = q.fine ? 3 : 2;
  for (let i = 0; i < tiers; i++) {
    const y = -0.07 - i * (q.fine ? 0.13 : 0.19);
    const rt = 0.22 + i * 0.025;
    const rb = 0.27 + i * 0.03;
    const h = q.fine ? 0.17 : 0.22;
    for (const side of [0, Math.PI]) {
      put('hips', i % 2 ? 'maroon' : 'lacquer', new THREE.CylinderGeometry(rt, rb, h, R, 1, !q.fine, side + 0.45, Math.PI - 0.9).translate(0, y, 0));
      if (q.fine) put('hips', 'gold', new THREE.TorusGeometry(rb, 0.011, 3, R, Math.PI - 0.9).rotateX(Math.PI / 2).rotateY(-(side + 0.45) + Math.PI / 2 - (Math.PI - 0.9)).translate(0, y - h / 2, 0));
    }
  }
  put('hips', 'gold', new THREE.CylinderGeometry(0.205, 0.205, 0.06, R).translate(0, 0.07, 0));
  // an apron of cloth before and behind, between the legs
  if (q.fine) for (const s of [-1, 1]) put('hips', 'maroon', new THREE.BoxGeometry(0.03, 0.42, 0.2).translate(s * 0.215, -0.2, 0).rotateZ(s * -0.08));
  // the legs
  for (const s of ['L', 'R']) {
    put(`leg${s}`, 'cloth', sweep([[0, 0, 0], [0, -0.47, 0]], [[0.1], [0.08]], { seg: q.seg, radial: R }));
    put(`leg${s}`, 'lacquer', lump(0.07, { p: [0.05, -0.46, 0], s: [0.8, 1, 1] }, { detail: q.fine ? 1 : 0, amp: 0.05 }));
    put(`shin${s}`, 'lacquer', sweep([[0, -0.02, 0], [0, -0.36, 0]], [[0.088], [0.07]], { seg: q.seg, radial: R }));
    if (q.fine) put(`shin${s}`, 'gold', new THREE.TorusGeometry(0.088, 0.01, 4, R).rotateX(Math.PI / 2).translate(0, -0.03, 0));
    put(`shin${s}`, 'black', new THREE.CylinderGeometry(0.075, 0.08, 0.1, R).translate(0, -0.41, 0));
    put(`shin${s}`, 'black', lump(0.08, { p: [0.065, -0.47, 0], s: [1.7, 0.55, 0.95] }, { detail: q.fine ? 1 : 0, amp: 0.04 }));
  }
  // the body: a lacquered cuirass edged in gold, a sun on its breast
  const rows = [[0.17, 0.2], [0.19, 0.24], [0.21, 0.28], [0.15, 0.25]];
  put('body', 'lacquer', sweep([[0, 0, 0], [0.01, 0.25, 0], [0.012, 0.5, 0], [0, 0.72, 0]], rows, { seg: q.fine ? 8 : 3, radial: R + 2 }));
  if (q.fine) {
    for (const [y, rf, rs] of [[0.16, 0.185, 0.235], [0.4, 0.21, 0.275]]) put('body', 'gold', new THREE.TorusGeometry(1, 0.012, 4, R * 2).scale(rf + 0.006, rs + 0.006, 1).rotateX(Math.PI / 2).translate(0.01, y, 0));
  }
  put('body', 'gold', new THREE.CylinderGeometry(0.075, 0.075, 0.025, q.fine ? 12 : 6).rotateZ(Math.PI / 2).translate(0.225, 0.52, 0));
  if (q.fine) for (let i = 0; i < 8; i++) put('body', 'gold', spikeAt(V3(0.23, 0.52, 0), V3(0, Math.cos((i / 8) * TAU), Math.sin((i / 8) * TAU)), 0.12, 0.018, 3));
  put('body', 'maroon', new THREE.CylinderGeometry(0.1, 0.14, 0.1, R).translate(0, 0.74, 0));
  // pauldrons: stacked shells over the shoulders
  for (const s of [-1, 1]) {
    const n = q.fine ? 3 : 1;
    for (let i = 0; i < n; i++) {
      const geo = new THREE.SphereGeometry(0.16 - i * 0.012, R, q.fine ? 4 : 2, 0, TAU, 0, Math.PI * 0.5).scale(1.15, 0.65, 1).rotateX(-s * (0.35 + i * 0.15)).translate(0, 0.66 - i * 0.07, s * (0.3 + i * 0.03));
      put('body', i % 2 ? 'maroon' : 'lacquer', geo);
      if (q.fine) put('body', 'gold', new THREE.TorusGeometry(0.16 - i * 0.012, 0.009, 3, R).scale(1.15, 1, 1).rotateX(Math.PI / 2 - s * (0.35 + i * 0.15)).translate(0, 0.66 - i * 0.07, s * (0.3 + i * 0.03)));
    }
  }
  // the head: a helm with a spike and a crest, a neck guard of lames, and
  // the gold mask with its scowl
  put('head', 'black', new THREE.SphereGeometry(0.16, R, Math.max(3, R - 3)).translate(0, 0.13, 0));
  put('head', helm, new THREE.SphereGeometry(0.2, R + 2, q.fine ? 6 : 3, 0, TAU, 0, Math.PI * 0.55).scale(1, 1.08, 0.95).translate(-0.01, 0.17, 0));
  put('head', 'maroon', new THREE.CylinderGeometry(0.2, 0.27, 0.17, R * 2, 1, !q.fine, Math.PI / 2 + 1.0, TAU - 2.0).translate(-0.01, 0.07, 0));
  if (q.fine) put('head', 'gold', new THREE.TorusGeometry(0.205, 0.016, 4, 14, Math.PI).rotateY(0).translate(-0.01, 0.17, 0).scale(1, 1.05, 1));
  put('head', 'gold', new THREE.ConeGeometry(0.03, 0.16, q.fine ? 6 : 4).translate(-0.01, 0.46, 0));
  put('head', 'gold', lump(0.155, { p: [0.15, 0.12, 0], s: [0.36, 0.95, 0.84] }, { detail: q.fine ? 2 : 0, amp: 0.02 }));
  if (q.fine) {
    for (const s of [-1, 1]) {
      put('head', 'black', new THREE.BoxGeometry(0.03, 0.022, 0.07).rotateX(s * 0.3).translate(0.198, 0.152, s * 0.055));
      put('head', 'gold', new THREE.BoxGeometry(0.03, 0.026, 0.11).rotateX(-s * 0.32).translate(0.208, 0.188, s * 0.05));
    }
    put('head', 'gold', new THREE.ConeGeometry(0.022, 0.08, 4).rotateZ(-Math.PI / 2 - 0.3).translate(0.215, 0.105, 0));
    put('head', 'black', new THREE.BoxGeometry(0.02, 0.016, 0.08).translate(0.198, 0.05, 0));
  } else {
    put('head', 'black', new THREE.BoxGeometry(0.02, 0.03, 0.15).translate(0.205, 0.15, 0));
  }
  // the arms
  for (const s of ['L', 'R']) {
    put(`arm${s}`, 'maroon', sweep([[0, 0, 0], [0, -0.35, 0]], [[0.075], [0.066]], { seg: q.seg, radial: R }));
    put(`fore${s}`, 'lacquer', sweep([[0, -0.02, 0], [0, -0.3, 0]], [[0.072], [0.06]], { seg: q.seg, radial: R }));
    if (q.fine) put(`fore${s}`, 'gold', new THREE.TorusGeometry(0.072, 0.009, 3, R).rotateX(Math.PI / 2).translate(0, -0.03, 0));
    put(`fore${s}`, 'black', lump(0.062, { p: [0, -0.35, 0], s: [1, 1.1, 0.9] }, { detail: q.fine ? 1 : 0, amp: 0.04 }));
  }
  // the spear: a long dark shaft, a red tassel and gold collar, a leaf blade
  put('spear', 'shaft', new THREE.CylinderGeometry(0.022, 0.022, 3.1, q.fine ? 6 : 4).translate(0, 0.65, 0));
  put('spear', 'gold', new THREE.CylinderGeometry(0.032, 0.03, 0.09, q.fine ? 8 : 4).translate(0, 2.22, 0));
  put('spear', 'tassel', new THREE.ConeGeometry(0.07, 0.2, q.fine ? 8 : 4).rotateX(Math.PI).translate(0, 2.1, 0));
  put('spear', 'steel', new THREE.LatheGeometry([[0, 0], [0.05, 0.08], [0.042, 0.26], [0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 4).scale(1, 1, 0.3).translate(0, 2.26, 0));
  if (q.fine) put('spear', 'steel', new THREE.ConeGeometry(0.025, 0.12, 4).rotateX(Math.PI).translate(0, -0.95, 0));
  return out;
}

// The Easterlings' march and stance: legs striding, the free arm swinging,
// the spear carried upright on the right; `alert` levels it at you.
function eastPose(b, t, { marching = false, alert = 0 } = {}) {
  const w = marching ? 1 : 0;
  const a = clamp01(alert);
  const ph = t * 6.2;
  const sw = Math.sin(ph) * w;
  b.legL.rotation.z = sw * 0.42 + a * 0.3;
  b.legR.rotation.z = -sw * 0.42 - a * 0.18;
  b.shinL.rotation.z = -Math.max(0, -Math.cos(ph)) * 0.55 * w - a * 0.4;
  b.shinR.rotation.z = -Math.max(0, Math.cos(ph)) * 0.55 * w - a * 0.15;
  b.hips.position.y = 1.0 + (Math.abs(Math.cos(ph)) - 1) * 0.04 * w - a * 0.1;
  b.body.rotation.set(0, sw * 0.08, -0.05 * w - a * 0.2 + Math.sin(t * 1.7) * 0.012);
  b.head.rotation.set(0, Math.sin(t * 0.5) * 0.25 * (1 - w) * (1 - a), a * 0.15);
  b.armL.rotation.set(0.08, 0, -sw * 0.45 * (1 - a) + a * 0.85);
  b.foreL.rotation.z = 0.25 + a * 0.75;
  b.armR.rotation.set(-0.12, 0, mix(0.2, 1.05, a));
  b.foreR.rotation.z = mix(1.2, 0.35, a);
  const held = b.body.rotation.z + b.armR.rotation.z + b.foreR.rotation.z;
  b.spear.rotation.set(0.12 * (1 - a), 0, mix(-held + 0.06, -Math.PI / 2 - held - 0.12, a));
}

// An Easterling soldier, 2.3 m with the spike on his helm: red lacquered
// lames edged in gold, a masked helm with a gold face, a long spear. Faces
// +x. animate(t, { marching, alert }).
function easterling(K, seed = 1) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'easterling';
  const b = eastRig(g);
  const byBone = new Map();
  for (const [name, kind, geo] of eastParts(seed, { rad: 10, seg: 6, fine: true })) {
    if (!byBone.has(name)) byBone.set(name, parts());
    const metal = EAST_METAL.has(kind);
    byBone.get(name).add(metal ? mats.eastMetal : mats.lacquer, solid(geo, EAST[kind]));
  }
  for (const [name, bk] of byBone) bk.build(b[name], { shadow: false, receive: false });
  const animate = (t, o = {}) => eastPose(b, t, o);
  animate(0);
  return { group: g, bones: b, head: b.head, animate };
}

// One Easterling mid-stride with his spear upright, as one vertex-coloured
// geometry for a marching column (under 800 triangles).
export function columnGeo() {
  const root = new THREE.Group();
  const b = eastRig(root);
  eastPose(b, Math.PI / 2 / 6.2, { marching: true });
  root.updateMatrixWorld(true);
  const list = eastParts(5, { rad: 5, seg: 2, fine: false }).map(([name, kind, geo]) => solid(geo.applyMatrix4(b[name].matrixWorld), EAST[kind]));
  return oneGeo(list);
}

// A boulder of the ash slope, about 2 m across: broken flat-faced rock,
// dark, ash lying grey on whatever faces up. One geometry.
export function ashRockGeo(seed = 1) {
  const r = rng(seed);
  const n = makeNoise(seed + 5);
  let g = new THREE.IcosahedronGeometry(1, 2);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 8; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.6 - 0.6);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.6 + r() * 0.25 });
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 3 }) - 0.5) * 0.6);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    v.set(v.x * 1.05, v.y * 0.72 + 0.32, v.z * 0.9);
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = facet(g);
  boxUV(g, 0.7);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(STONE.base).multiplyScalar(1.1 + noise3(n, x * 2, y * 2, z * 2) * 0.6);
    out.lerp(STONE.ash, smooth(0.25, 0.7, ny) * 0.75);
    out.lerp(STONE.dark, (1 - smooth(-0.1, 0.4, y)) * 0.4);
  });
  g.computeBoundingSphere();
  return g;
}

// Sam's elven cloak thrown over a crouching hobbit: a lumpy drape about a
// metre long and a metre high, grey and mottled like the rocks, folds
// running down it, its hem flared on the ground. Faces +x.
function elvenCloak(K) {
  const n = makeNoise(57);
  const geo = new THREE.SphereGeometry(1, 30, 16, 0, TAU, 0, Math.PI * 0.6);
  const p = geo.attributes.position;
  const bottom = Math.cos(Math.PI * 0.6);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    const f = 1 - (y - bottom) / (1 - bottom);
    const fold = 1 + 0.07 * Math.sin(a * 7 + noise3(n, x, y, z) * 4) * f;
    const k = (1 + (noise3(n, x * 1.6 + 2, y * 1.6, z * 1.6) - 0.5) * 0.35) * fold * (1 + f * f * 0.25);
    // the hood over his head at the front, his pack making a hump behind
    const headBump = Math.exp(-((x - 0.5) ** 2 + (z * 1.2) ** 2 + (y - 0.75) ** 2) / 0.08) * 0.15;
    const pack = Math.exp(-((x + 0.45) ** 2 + (z * 1.1) ** 2 + (y - 0.6) ** 2) / 0.12) * 0.12;
    p.setXYZ(i, x * 0.52 * k, (y - bottom) / (1 - bottom) * (1.02 + headBump + pack) * (1 + (k - 1) * 0.3), z * 0.43 * k);
  }
  geo.computeVertexNormals();
  const g2 = geo.toNonIndexed();
  boxUV(g2, 1.2);
  g2.computeVertexNormals();
  tint(g2, (x, y, z, out) => {
    const v = noise3(n, x * 5, y * 5, z * 5);
    const a = Math.atan2(z, x);
    out.setRGB(0.3, 0.31, 0.29).multiplyScalar(0.7 + v * 0.6);
    out.lerp(_kc2.setRGB(0.36, 0.37, 0.3), smooth(0.6, 0.7, noise3(n, x * 9 + 3, y * 9, z * 9)) * 0.6);
    out.multiplyScalar(0.85 + 0.15 * Math.sin(a * 7 + noise3(n, x, y, z) * 4));
  });
  const group = new THREE.Group();
  group.name = 'elvenCloak';
  const mesh = new THREE.Mesh(g2, K.mats.cloak);
  group.add(mesh);
  return { group, mesh };
}

// ── Gollum on his own ──
// For the towns further on, without building the rest of the kit.
export function createGollum(renderer) {
  const eye = canvasTexture(eyeCanvas(), renderer, { wrap: false });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    gollumSkin: M({ vertexColors: true, roughness: 0.42 }),
    gollumEye: M({ map: eye, roughness: 0.08, emissive: new THREE.Color(0xffffff), emissiveMap: eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e, roughness: 0.6 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    tooth: M({ color: 0xb4a472, roughness: 0.5 }),
    loin: M({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  return gollum({ mats, tex: { eye }, renderer });
}

// ── the kit ──

export function createMarshesKit(renderer) {
  const kit = createShireKit(renderer);
  const { K } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const rock = rockCanvas(S, 23);
  const iron = ironCanvas(S, 29);
  const tex = {
    rock: T(rock.c),
    rockN: T(normalFromField(rock.field, S, S, 3), { srgb: false }),
    iron: T(iron.c),
    ironN: T(normalFromField(iron.field, S, S, 3), { srgb: false }),
    glow: T(glowCanvas(), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    eye: T(eyeCanvas(), { wrap: false }),
    rope: T(ropeCanvas()),
    faces: [0, 1, 2].map((k) => T(faceCanvas(k), { wrap: false })),
  };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const mats = {
    ...kit.mats,
    // the scene's: rock (the cliff, spires, boulders), wood (the snags),
    // reeds (reeds and tussocks), easterling (the column)
    rock: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.93 }),
    wood: M({ map: K.tex.bark, normalMap: K.tex.barkN, vertexColors: true, roughness: 0.92 }),
    reeds: M({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }),
    easterling: M({ vertexColors: true, roughness: 0.42, metalness: 0.25 }),
    elvenRope: M({ map: tex.rope, color: 0xe4e8ec, roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(0x2c3238) }),
    gollumSkin: M({ vertexColors: true, roughness: 0.42 }),
    gollumEye: M({ map: tex.eye, roughness: 0.08, emissive: new THREE.Color(0xffffff), emissiveMap: tex.eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e, roughness: 0.6 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    tooth: M({ color: 0xb4a472, roughness: 0.5 }),
    loin: M({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
    beastHide: M({ vertexColors: true, roughness: 0.55 }),
    beastHorn: M({ color: 0x4a423c, roughness: 0.45 }),
    beastEye: new THREE.MeshBasicMaterial({ color: hot(0xff7a2a, 1.6) }),
    membrane: M({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    nazgulRobe: M({ color: 0x0e0e10, roughness: 0.92, side: THREE.DoubleSide }),
    gauntlet: M({ color: 0x2a2a2e, roughness: 0.35, metalness: 0.8 }),
    saddle: M({ color: 0x1e1612, roughness: 0.7 }),
    void: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    gateStone: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.9 }),
    gateIron: M({ map: tex.iron, normalMap: tex.ironN, vertexColors: true, roughness: 0.42, metalness: 0.4 }),
    slit: new THREE.MeshBasicMaterial({ color: hot(0xff5a1a, 2.2) }),
    mountain: M({ map: tex.rock, vertexColors: true, roughness: 0.95 }),
    lacquer: M({ vertexColors: true, roughness: 0.32, metalness: 0.05, side: THREE.DoubleSide }),
    eastMetal: M({ vertexColors: true, roughness: 0.3, metalness: 0.85 }),
    cloak: M({ map: tex.rock, normalMap: tex.rockN, vertexColors: true, roughness: 0.96, side: THREE.DoubleSide }),
  };
  const MK = { mats, tex: { ...K.tex, ...tex }, renderer, faceGeo: faceGeo() };
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
    cliff: (o) => cliff(MK, o),
    spike: (seed = 1) => once(`spike${seed}`, () => spikeGeo(seed)),
    rope: () => rope(MK),
    gollum: () => gollum(MK),
    tussock: (seed = 1) => once(`tussock${seed}`, () => tussockGeo(seed)),
    reeds: (seed = 1) => once(`reeds${seed}`, () => reedsGeo(seed)),
    deadTree: (seed = 1) => once(`tree${seed}`, () => deadTreeGeo(seed)),
    wisp: () => wisp(MK),
    face: (seed = 1) => face(MK, seed),
    fellBeast: () => fellBeast(MK),
    blackGate: () => blackGate(MK),
    easterling: (seed = 1) => easterling(MK, seed),
    column: () => once('column', columnGeo),
    ashRock: (seed = 1) => once(`ash${seed}`, () => ashRockGeo(seed)),
    elvenCloak: () => elvenCloak(MK),
  };
}
