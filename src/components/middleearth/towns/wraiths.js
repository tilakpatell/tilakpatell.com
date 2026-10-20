// The Nazgûl on foot, made in code: the Ringwraiths that hunt the lanes of
// Bree at night, and will stand on Weathertop and come down to the Ford.
// Tall, gaunt and hunched, about 2.5 to the tip of the hood, in layers of
// black cloth torn to rags at every hem: a long under-robe that drags in the
// mud, an over-cloak split at the front, a short mantle over the shoulders,
// wide sleeves, and a deep pointed hood with nothing in it. Steel gauntlets
// with long jointed claws, pointed steel feet under the hem, a long sword.
//
// One kit paints the textures and makes the materials once, and every
// Nazgûl it builds shares them. The cloth is a charcoal weave with folds in
// its normal map; its hems are torn by an alpha mask, so every edge frays
// into strips. A faint cold rim lets the shape read against a dark lane
// while the cloth stays black, and wind moves it in the vertex shader (the
// hems most, the shoulders not at all). Each moving part (the robe, the
// body, the head, each arm, the sword) is its fixed pieces merged into one
// mesh per material: 11 draws a Nazgûl.
//
// Seen through the Ring (kit.setRing, 0..1) the same materials turn pale,
// grey-white and see-through, with a cold glow at their edges; in the hood
// a gaunt face and a grey crown fade in. Nothing is rebuilt. The materials
// and their shaders are ./wraithsShaders.js's.
//
// Conventions as in ../shire/props.js: the group stands on y = 0 at its
// feet and faces +x.

import * as THREE from 'three';
import { canvasTexture } from '../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../lib/paint';
import { ball, cyl, lathe, parts, rng, roundBox, sector } from '../shire/props';
import { breathe, sway } from '../../../lib/three/gait';
import { createShot, createStride, createTracker, ease } from '../creatures';
import { nightEnv, wraithMaterials } from '../nodes/towns/wraithsShaders';

const TAU = Math.PI * 2;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V3(0, 1, 0);
const Z = V3(0, 0, 1);

// The frame, in metres from the feet. The body pivots at the hips; the
// shoulders and the neck sit forward of them, for the stoop.
const HIP = 1.08;
const SHOULDER = [0.11, 1.84, 0.205]; // x, y, and ±z
const NECK = [0.16, 1.98, 0];
// The tears: how far up from a hem they reach, and how much hem one copy of
// the torn mask covers.
const TORN = 0.42;
const TORN_TILE = 1.15;

// ── profiles ──

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

// ── cloth ──

// A sheet of cloth: (nu + 1) × (nv + 1) points from at(u, v, p, i, j), v = 0
// along its top and v = 1 its hem. at() writes p.x, p.y, p.z, the cloth's
// three numbers (kept in the vertex colour, which the cloth reads as data,
// not colour): p.sway (0 pinned … 1 free in the wind), p.shade (1 lit … 0
// black) and p.phase, and where the inside is (p.cx, p.cy, p.cz) so the
// sheet can face out. Texture u runs along the hem in metres, v up from the
// hem in metres (× vK, + vOff): the weave keeps one size on every piece, and
// the bottom TORN of v is torn. A closed sheet's seam is smoothed, and its
// hem rounded to whole copies of the tear so it doesn't show.
function sheet(nu, nv, at, { closed = false, uOff = 0, vK = 1, vOff = 0, uRow = nv } = {}) {
  const W = nu + 1;
  const count = W * (nv + 1);
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const mid = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const p = {};
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      p.sway = 0;
      p.shade = 1;
      p.phase = 0;
      p.cx = 0;
      p.cy = null;
      p.cz = 0;
      at(i / nu, j / nv, p, i, j);
      const q = (j * W + i) * 3;
      pos[q] = p.x;
      pos[q + 1] = p.y;
      pos[q + 2] = p.z;
      col[q] = p.sway;
      col[q + 1] = p.shade;
      col[q + 2] = p.phase;
      mid[q] = p.cx;
      mid[q + 1] = p.cy ?? p.y;
      mid[q + 2] = p.cz;
    }
  }
  const dist = (a, b) => Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
  const us = new Float32Array(W);
  for (let i = 1; i <= nu; i++) us[i] = us[i - 1] + dist(uRow * W + i, uRow * W + i - 1);
  if (closed && us[nu] > 0) {
    const k = (Math.max(1, Math.round(us[nu] / TORN_TILE)) * TORN_TILE) / us[nu];
    for (let i = 0; i <= nu; i++) us[i] *= k;
  }
  for (let i = 0; i <= nu; i++) {
    let v = vOff;
    for (let j = nv; j >= 0; j--) {
      if (j < nv) v += dist(j * W + i, (j + 1) * W + i) * vK;
      uv[(j * W + i) * 2] = us[i] + uOff;
      uv[(j * W + i) * 2 + 1] = v;
    }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * W + i;
      idx.push(a, a + W, a + 1, a + 1, a + W, a + W + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // face out: the side away from each point's inside
  const nrm = g.attributes.normal.array;
  let out = 0;
  for (let q = 0; q < count * 3; q += 3) out += nrm[q] * (pos[q] - mid[q]) + nrm[q + 1] * (pos[q + 1] - mid[q + 1]) + nrm[q + 2] * (pos[q + 2] - mid[q + 2]);
  if (out < 0) {
    for (let t = 0; t < idx.length; t += 3) [idx[t + 1], idx[t + 2]] = [idx[t + 2], idx[t + 1]];
    g.setIndex(idx);
    for (let q = 0; q < nrm.length; q++) nrm[q] = -nrm[q];
  }
  if (closed) {
    for (let j = 0; j <= nv; j++) {
      const a = j * W * 3;
      const b = (j * W + nu) * 3;
      const n = V3(nrm[a] + nrm[b], nrm[a + 1] + nrm[b + 1], nrm[a + 2] + nrm[b + 2]).normalize();
      nrm[a] = nrm[b] = n.x;
      nrm[a + 1] = nrm[b + 1] = n.y;
      nrm[a + 2] = nrm[b + 2] = n.z;
    }
  }
  return g;
}

// A made shape in the cloth: its numbers set, and its texture v lifted
// clear of the tears.
function solid(geo, { sway = 0, shade = 1, phase = 0 } = {}) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([sway, shade, phase], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const uv = geo.attributes.uv;
  if (uv) for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) + 2);
  return geo;
}

// Folds: two waves round a piece that wander as they fall, in -1..1. `per`
// is how many repeat round a closed piece, so the seam meets.
function folder(seed, per = 0) {
  const n = makeNoise(seed);
  const ph = rng(seed)() * 10;
  return (u, y, k1, k2) => {
    const w = (per ? n(u * per, y * 0.9 + 3, per) : n(u * 5 + ph, y * 0.9 + 3)) * 2.8;
    return 0.62 * Math.sin(u * TAU * k1 + w + ph) + 0.38 * Math.sin(u * TAU * k2 + w * 1.7 + 2.3);
  };
}

// The under-robe, in the group (it doesn't lean): from the waist to the
// ground, where it pools and drags behind, short enough at the front for the
// steel feet to show.
function underRobe(seed) {
  const n = makeNoise(seed * 7 + 3);
  const fold = folder(seed * 5 + 1, 5);
  const top = 1.34;
  const rows = [[0, 0.445], [0.22, 0.4], [0.55, 0.33], [0.9, 0.26], [1.15, 0.215], [1.34, 0.19]];
  const r0 = rows[0][1];
  return sheet(48, 20, (u, v, p) => {
    const a = u * TAU;
    const off = Math.abs(Math.atan2(Math.sin(a), Math.cos(a))); // 0 front … π back
    const hemY = 0.075 * (1 - smooth(0.45, 1.05, off));
    const pool = 0.05 * smooth(0.5, 1.1, off) + 0.34 * smooth(0.9, 2.9, off) * (0.7 + 0.6 * n(u * 4, 2.5, 4));
    const drop = top - hemY;
    const L = Math.pow(v, 0.85) * (drop + pool);
    let y;
    let r;
    if (L <= drop) {
      y = top - L;
      r = prof(rows, y)[0];
    } else {
      y = 0.012;
      r = r0 + (L - drop);
    }
    const A = 0.012 + 0.05 * Math.pow(clamp01(1 - y / top), 1.3);
    const f = fold(u, y, 7, 12);
    r += A * f;
    const ground = L > drop ? smooth(0, 0.12, L - drop) : 0;
    y += 0.035 * Math.max(0, f) * ground;
    p.x = Math.cos(a) * r * 0.86 - 0.02;
    p.z = Math.sin(a) * r;
    p.y = y;
    p.cx = -0.02;
    p.cy = L > drop ? -0.3 : y;
    p.sway = mix(0.7 * smooth(top, 0.35, y), 0.12, ground);
    p.shade = (1 - 0.45 * Math.max(0, -f) * (A / 0.062)) * mix(1, 0.55, smooth(0.95, 1.3, y)) * (1 - 0.2 * ground);
    p.phase = n(u * 9, 0.5, 9);
  }, { closed: true, uOff: seed * 0.37 });
}

// The over-cloak, from the shoulders to the calves, split at the front, a
// hump at the back over the stoop. Returns its sheet and its at(), so rags
// can hang from it.
function overCloak(seed) {
  const n = makeNoise(seed * 3 + 11);
  const fold = folder(seed * 5 + 2);
  // [v, y, half-width, centre x, depth / width]
  const rows = [
    [0, 2.0, 0.12, 0.13, 0.9],
    [0.05, 1.95, 0.22, 0.11, 0.85],
    [0.12, 1.83, 0.33, 0.07, 0.78],
    [0.3, 1.45, 0.37, 0.03, 0.8],
    [0.6, 0.95, 0.44, -0.01, 0.86],
    [1.0, 0.36, 0.53, -0.04, 0.9],
  ];
  const at = (u, v, p) => {
    const [y0, rz0, cx, kx] = prof(rows, v);
    const gap = mix(0.95, 0.62, smooth(0, 1, v));
    const a = gap + u * (TAU - 2 * gap);
    const back = Math.max(0, -Math.cos(a));
    const hemY = 0.36 + 0.14 * Math.pow(Math.abs(u - 0.5) * 2, 2) + (n(u * 7, 1.7) - 0.5) * 0.09;
    const y = y0 + (hemY - 0.36) * smooth(0.3, 1, v);
    const A = 0.006 + 0.062 * Math.pow(smooth(0.08, 1, v), 1.3);
    const f = fold(u, y, 6, 10);
    const edge = smooth(0.06, 0, Math.min(u, 1 - u));
    const r = rz0 + A * f + 0.055 * back * Math.exp(-Math.pow((v - 0.14) / 0.11, 2)) + 0.02 * edge;
    p.x = cx + Math.cos(a) * r * kx;
    p.y = y;
    p.z = Math.sin(a) * r;
    p.cx = cx;
    p.sway = Math.pow(smooth(0.1, 1, v), 1.4);
    p.shade = (1 - 0.5 * Math.max(0, -f) * (A / 0.068)) * mix(0.55, 1, smooth(0.15, 0.32, v));
    p.phase = n(u * 13 + 4, 0.5);
    p.a = a;
  };
  return { geo: sheet(44, 24, at, { uOff: seed * 0.71 }), at };
}

// The mantle: a short cape over the shoulders, ragged at its edge.
function mantle(seed) {
  const n = makeNoise(seed * 5 + 7);
  const fold = folder(seed * 5 + 3);
  const rows = [
    [0, 2.06, 0.11, 0.15],
    [0.15, 2.0, 0.2, 0.13],
    [0.4, 1.9, 0.31, 0.09],
    [0.7, 1.74, 0.38, 0.06],
    [1, 1.55, 0.42, 0.04],
  ];
  const gap = 0.3;
  const at = (u, v, p) => {
    const [y0, rz0, cx] = prof(rows, v);
    const a = gap + u * (TAU - 2 * gap);
    const back = Math.max(0, -Math.cos(a));
    const y = y0 + ((n(u * 9, 4.2) - 0.6) * 0.1 - 0.06 * back) * smooth(0.5, 1, v);
    const A = 0.004 + 0.03 * Math.pow(v, 1.3);
    const f = fold(u, y, 9, 16);
    const r = rz0 + A * f + 0.03 * back * smooth(0.1, 0.5, v);
    p.x = cx + Math.cos(a) * r * 0.84;
    p.y = y;
    p.z = Math.sin(a) * r;
    p.cx = cx;
    p.sway = 0.4 * v * v;
    p.shade = (1 - 0.4 * Math.max(0, -f) * (A / 0.034)) * mix(0.8, 1, v);
    p.phase = n(u * 11 + 9, 0.5);
    p.a = a;
  };
  return { geo: sheet(40, 9, at, { vK: 2.1, uOff: seed * 0.53 }), at };
}

// The body under it all, seen in the cloak's split: hunched, narrow.
function torso() {
  const rows = [
    [0, 1.95, 0.12, 0.1, 0.15],
    [0.25, 1.75, 0.2, 0.15, 0.12],
    [0.6, 1.4, 0.19, 0.15, 0.06],
    [1, 1.04, 0.18, 0.14, 0.01],
  ];
  return sheet(16, 6, (u, v, p) => {
    const [y, rz, rx, cx] = prof(rows, v);
    const a = u * TAU;
    const f = Math.sin(a * 6 + v * 3) * 0.008;
    p.x = cx + Math.cos(a) * (rx + f);
    p.y = y;
    p.z = Math.sin(a) * (rz + f);
    p.cx = cx;
    p.shade = 0.5;
  }, { closed: true, vOff: 2 });
}

// A rag: a narrow strip hanging from `at` down `down`, flaring out along
// `out`, frayed at its end by the tears.
function rag(at, down, out, across, len, width, r) {
  const twist = (r() - 0.5) * 0.6;
  const ph = r();
  return sheet(1, 8, (u, v, p) => {
    const w = (u - 0.5) * width * (1 - 0.3 * v);
    const o = 0.014 + 0.06 * v * v;
    p.x = at.x + down.x * len * v + across.x * w + out.x * (o + w * twist * v);
    p.y = at.y + down.y * len * v + across.y * w + out.y * (o + w * twist * v);
    p.z = at.z + down.z * len * v + across.z * w + out.z * (o + w * twist * v);
    p.cx = at.x - out.x;
    p.cy = p.y - out.y;
    p.cz = at.z - out.z;
    p.sway = 0.45 + 0.55 * v;
    p.shade = 0.92;
    p.phase = ph;
  }, { vK: TORN / (0.62 * len), uOff: r() * 20 });
}

// Rags from a piece of cloth: n of them, from rows near its hem, round it.
function ragsFrom(bk, mat, piece, { n, v, len, width, seed, u0 = 0.06, u1 = 0.94 }) {
  const r = rng(seed);
  const p = {};
  for (let i = 0; i < n; i++) {
    const u = mix(u0, u1, (i + 0.2 + r() * 0.6) / n);
    piece.at(u, v, p);
    const out = V3(Math.cos(p.a), 0, Math.sin(p.a));
    const down = V3(out.x * 0.08, -1, out.z * 0.08).normalize();
    const across = V3(-Math.sin(p.a), 0, Math.cos(p.a));
    bk.add(mat, rag(V3(p.x, p.y, p.z), down, out, across, len[0] + r() * (len[1] - len[0]), width[0] + r() * (width[1] - width[0]), r));
  }
}

// ── the hood ──

// A deep cowl. Its opening is a tall pointed arch facing +x, its brow
// standing out over the face; it runs back over the skull with a seam along
// its top, drapes down the back of the neck, and closes behind. Round its
// middle in rings: a lining that goes black as it goes in, a rolled lip,
// then the outside. In the head's own space, from the neck.
const HOOD = { x: 0.2, y: 0.2, back: 0.34, drop: 0.08 };
const hoodMid = (s) => V3(HOOD.x - HOOD.back * s, HOOD.y - HOOD.drop * s, 0);

function hood(seed) {
  const n = makeNoise(seed * 9 + 2);
  // [depth, size, shade]: the lining from deep inside out to the lip, then the outside
  const rings = [
    [0.44, 0.86, 0],
    [0.3, 0.87, 0],
    [0.19, 0.875, 0],
    [0.11, 0.88, 0.03],
    [0.05, 0.885, 0.12],
    [0, 0.89, 0.26],
    [-0.02, 0.945, 0.55],
    [0, 1, 0.85],
    [0.05, 1, 1],
    [0.12, 1, 1],
    [0.2, 1, 1],
    [0.29, 1, 1],
    [0.38, 1, 1],
    [0.47, 1, 1],
    [0.56, 1, 1],
    [0.65, 1, 1],
    [0.74, 1, 1],
    [0.82, 1, 1],
    [0.89, 1, 1],
    [0.95, 1, 1],
    [1, 1, 1],
  ];
  return sheet(28, rings.length - 1, (u, _v, p, i, j) => {
    const [s, k, shade] = rings[j];
    const sc = clamp01(s);
    const phi = u * TAU;
    const cs = Math.cos(phi);
    const sn = Math.sin(phi);
    const shut = sc < 0.5 ? 1 : Math.sqrt(Math.max(0, 1 - ((sc - 0.5) / 0.5) ** 2));
    const swell = 1 + 0.08 * Math.sin(Math.PI * Math.min(sc / 0.6, 1));
    const crease = 1 + 0.035 * Math.sin(phi * 6 + sc * 5 + n(u * 3, 1) * 2) * smooth(0, 0.25, sc);
    const W = 0.152 * swell * k * shut * crease;
    const Ht = 0.29 * Math.cos(sc * 1.15) * k * (0.3 + 0.7 * shut);
    const Hb = (0.16 + 0.15 * smooth(0.1, 0.6, sc)) * k * shut;
    // the arch: steep sides meeting in a point; below, round
    const h = sn >= 0 ? Ht * Math.pow(1 - Math.abs(cs), 0.62) : Hb * sn;
    const c = hoodMid(s);
    const brow = 0.045 * Math.max(0, h / 0.27) * Math.pow(Math.max(0, 1 - sc * 2), 2);
    const outer = j > 6;
    p.x = c.x + brow;
    p.y = c.y + h;
    p.z = W * cs;
    p.cx = c.x;
    p.cy = c.y + 0.05;
    p.sway = outer ? 0.08 * sc : 0;
    p.shade = shade * (outer && sn < -0.4 ? mix(1, 0.75, smooth(0.1, 0.5, sc)) : 1);
    p.phase = 0.3;
  }, { closed: true, uRow: 7, vOff: 3 });
}

// The face the Ring shows, deep in the hood: long, gaunt, sunken-eyed,
// facing +x, about the size of a man's.
function ghostFace() {
  const g = new THREE.SphereGeometry(1, 18, 14);
  const p = g.attributes.position;
  const col = new Float32Array(p.count * 3);
  const bump = (y, z, cy, cz, w) => Math.exp(-((y - cy) ** 2 + (z - cz) ** 2) / w);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    const y = p.getY(i);
    let z = p.getZ(i);
    const front = Math.max(0, x);
    // sockets, cheeks hollowed under the bones, a brow and the bridge of a nose
    const sockets = bump(y, Math.abs(z), 0.22, 0.38, 0.03);
    const cheeks = bump(y, Math.abs(z), -0.28, 0.55, 0.05);
    x -= front * (0.5 * sockets + 0.28 * cheeks);
    x += front * (0.12 * bump(y, Math.abs(z), 0.42, 0.3, 0.03) + 0.16 * bump(y, z, 0.05, 0, 0.012) * (y < 0.35 ? 1 : 0));
    z *= 1 - 0.38 * Math.max(0, -y);
    p.setXYZ(i, x * 0.07, y * 0.118, z * 0.082);
    const d = Math.max(0.03, 0.85 - 1.1 * sockets * front - 0.35 * cheeks * front - 0.3 * Math.max(0, -y));
    col.set([d, d * 1.02, d * 1.06], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ── steel ──

const _basis = new THREE.Matrix4();
// a geometry set at `o` with its x, y, z along X, Y, Z
const orient = (geo, o, X, Y, Z_) => geo.applyMatrix4(_basis.makeBasis(X, Y, Z_).setPosition(o));
// a tapering rod from A to B (a finger's bone, a claw)
function rod(A, B, r0, r1, radial = 6) {
  const d = B.clone().sub(A);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, true).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  return g.translate(A.x, A.y, A.z);
}
function claw(A, dir, len, r) {
  const g = new THREE.ConeGeometry(r, len, 5).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  return g.translate(A.x, A.y, A.z);
}

// [index, middle, ring, little]: each finger's three bones
const FINGERS = [
  [0.05, 0.04, 0.033],
  [0.056, 0.044, 0.036],
  [0.052, 0.041, 0.033],
  [0.042, 0.033, 0.027],
];

// A gauntlet: a flared cuff, plates over the back of the hand and the
// knuckles, and long fingers of jointed plates ending in claws. `axis` runs
// from the wrist to the fingertips, `palm` out of the palm, `fore` up the
// forearm; `curl` bends each joint toward the palm, `splay` spreads them.
function gauntlet(bk, mat, { wrist, axis, palm, fore, thumb, curl, splay, thumbCurl }) {
  const side = axis.clone().cross(palm).normalize();
  // the cuff, flaring up the forearm, with a point on its outer edge
  const cuff = lathe([[0.036, -0.012], [0.043, 0.012], [0.056, 0.07], [0.075, 0.128], [0.069, 0.134], [0.05, 0.072], [0.034, 0.0]], 12);
  const cx = fore.clone().cross(palm).normalize();
  const cz = cx.clone().cross(fore).normalize();
  bk.add(mat, orient(cuff, wrist, cx, fore, cz));
  bk.add(mat, claw(wrist.clone().addScaledVector(fore, 0.1).addScaledVector(palm, -0.06), fore.clone().addScaledVector(palm, -0.35), 0.07, 0.014));
  // the back of the hand and the palm, and a ridge of plate over the knuckles
  const mid = wrist.clone().addScaledVector(axis, 0.048);
  bk.add(mat, orient(ball(1, 8, 6), mid.clone().addScaledVector(palm, -0.008), side.clone().multiplyScalar(0.046), axis.clone().multiplyScalar(0.055), palm.clone().multiplyScalar(0.02)));
  bk.add(mat, orient(roundBox(0.1, 0.022, 0.02, 0.006), wrist.clone().addScaledVector(axis, 0.082).addScaledVector(palm, -0.012), side, axis, palm));
  bk.add(mat, claw(mid.clone().addScaledVector(palm, -0.024).addScaledVector(axis, -0.02), axis.clone().addScaledVector(palm, -0.4), 0.06, 0.008));
  const K = wrist.clone().addScaledVector(axis, 0.085);
  for (let i = 0; i < 4; i++) {
    const role = thumb > 0 ? 3 - i : i;
    const o = (i - 1.5) * 0.021;
    let at = K.clone().addScaledVector(side, o).addScaledVector(axis, -0.006 * Math.abs(i - 1.5) ** 2);
    const d = axis.clone().applyAxisAngle(palm, -(i - 1.5) * splay);
    const bend = d.clone().cross(palm).normalize();
    bk.add(mat, ball(0.0125, 6, 4), { p: [at.x, at.y, at.z] });
    FINGERS[role].forEach((len, k) => {
      d.applyAxisAngle(bend, curl[k]);
      const to = at.clone().addScaledVector(d, len);
      const r0 = 0.0115 - k * 0.0018;
      bk.add(mat, rod(at, to, r0, r0 * 0.82));
      if (k < 2) bk.add(mat, ball(r0 * 0.92, 6, 4), { p: [to.x, to.y, to.z] });
      at = to;
    });
    bk.add(mat, claw(at, d.clone().applyAxisAngle(bend, 0.3), 0.034, 0.0068));
  }
  // the thumb, from the heel of the hand
  let at = wrist.clone().addScaledVector(axis, 0.03).addScaledVector(side, thumb * 0.034).addScaledVector(palm, 0.012);
  const d = axis.clone().multiplyScalar(0.6).addScaledVector(side, thumb * 0.55).addScaledVector(palm, 0.45).normalize();
  const bend = d.clone().cross(palm).normalize();
  bk.add(mat, ball(0.013, 6, 4), { p: [at.x, at.y, at.z] });
  for (const [k, len] of [0.045, 0.034].entries()) {
    d.applyAxisAngle(bend, thumbCurl[k]);
    const to = at.clone().addScaledVector(d, len);
    bk.add(mat, rod(at, to, 0.012 - k * 0.002, 0.0095 - k * 0.002));
    bk.add(mat, ball(0.0105 - k * 0.002, 6, 4), { p: [to.x, to.y, to.z] });
    at = to;
  }
  bk.add(mat, claw(at, d, 0.028, 0.0068));
}

// A pointed steel foot, its toe to +x, its origin on the ground under the
// ball of the foot: lames over the instep and a long toe cap.
function sabaton(bk, mat) {
  for (let i = 0; i < 3; i++) {
    const r = 0.06 - i * 0.004;
    bk.add(mat, sector(r - 0.007, r, 0, Math.PI, 0.052, 0, 5), { p: [-0.1 + i * 0.042, 0.004, 0], r: [0, Math.PI / 2, 0], s: [1, 1.15 - i * 0.12, 1] });
  }
  bk.add(mat, lathe([[0.056, 0], [0.055, 0.04], [0.045, 0.1], [0.028, 0.17], [0.01, 0.23], [0.001, 0.25]], 10, Math.PI, Math.PI), { p: [0.02, 0.004, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 1] });
  bk.add(mat, roundBox(0.32, 0.012, 0.11, 0.004), { p: [0.04, 0.006, 0] });
}

// The sword, in its own frame: the grip along x through the fist at the
// origin, the blade out along +x, its edges up and down (y), its flats to
// ±z. A long blade with a fuller, a straight guard with points, a wrapped
// grip, a spiked pommel.
function swordParts(bk, mats) {
  const L = 1.02;
  const x0 = 0.085;
  const loop = (w, t, deep) => {
    const f = mix(t * 0.5, t * 0.18, deep);
    const half = [[w / 2, 0], [w * 0.32, t / 2], [w * 0.15, t / 2], [w * 0.09, f]];
    const pts = [...half, ...half.slice().reverse().map(([y, z]) => [-y, z])];
    return [...pts, ...pts.map(([y, z]) => [y, -z]).reverse()];
  };
  const stations = [0, 0.08, 0.25, 0.45, 0.62, 0.72, 0.8, 0.86, 0.91, 0.95, 0.98, 1];
  const ring = (s) => {
    const k = s / 1;
    const w = 0.056 * (1 - 0.25 * k) * (k < 0.82 ? 1 : Math.sqrt(Math.max(0, (1 - k) / 0.18)));
    const deep = 1 - smooth(0.6, 0.76, k);
    return loop(w, 0.009 * (1 - 0.4 * k), deep).map(([y, z]) => V3(x0 + k * L, y, z));
  };
  const rings = stations.map(ring);
  const tri = [];
  for (let s = 0; s < rings.length - 1; s++) {
    const a = rings[s];
    const b = rings[s + 1];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      tri.push(a[i], b[i], a[j], a[j], b[i], b[j]);
    }
  }
  // facing out from the blade's middle
  const e1 = V3();
  const e2 = V3();
  let out = 0;
  for (let i = 0; i < tri.length; i += 3) {
    e1.subVectors(tri[i + 1], tri[i]);
    e2.subVectors(tri[i + 2], tri[i]);
    const c = e1.cross(e2);
    out += c.y * (tri[i].y + tri[i + 1].y + tri[i + 2].y) + c.z * (tri[i].z + tri[i + 1].z + tri[i + 2].z);
  }
  if (out < 0) for (let i = 0; i < tri.length; i += 3) [tri[i + 1], tri[i + 2]] = [tri[i + 2], tri[i + 1]];
  const blade = new THREE.BufferGeometry().setFromPoints(tri);
  blade.computeVertexNormals();
  bk.add(mats.blade, blade);
  // the guard, with a langet onto the blade, and its points bent toward the blade
  bk.add(mats.steel, roundBox(0.024, 0.26, 0.03, 0.007), { p: [x0 - 0.008, 0, 0] });
  for (const s of [-1, 1]) bk.add(mats.steel, new THREE.ConeGeometry(0.013, 0.07, 5), { p: [x0 + 0.012, s * 0.14, 0], r: [0, 0, s > 0 ? -0.75 : -Math.PI + 0.75] });
  bk.add(mats.steel, new THREE.OctahedronGeometry(0.03, 0), { p: [x0 + 0.02, 0, 0], s: [1.5, 0.7, 0.35] });
  // the grip, wrapped round in a spiral of cord, and its ferrules
  const grip = new THREE.CylinderGeometry(0.0165, 0.0165, 0.2, 12, 20, true);
  const gp = grip.attributes.position;
  for (let i = 0; i < gp.count; i++) {
    const y = gp.getY(i);
    const a = Math.atan2(gp.getZ(i), gp.getX(i));
    const k = 1 + 0.13 * Math.pow(Math.max(0, Math.sin(a + y * 290)), 2) - 0.06 * Math.abs(y / 0.1) ** 4;
    gp.setXYZ(i, gp.getX(i) * k, y, gp.getZ(i) * k);
  }
  grip.computeVertexNormals();
  bk.add(mats.steel, grip, { p: [-0.025, 0, 0], r: [0, 0, -Math.PI / 2] });
  for (const x of [0.072, -0.124]) bk.add(mats.steel, cyl(0.02, 0.02, 0.014, 10), { p: [x, 0, 0], r: [0, 0, Math.PI / 2] });
  bk.add(mats.steel, lathe([[0.012, 0], [0.027, 0.012], [0.031, 0.03], [0.019, 0.05], [0.004, 0.072], [0.001, 0.078]], 8), { p: [-0.13, 0, 0], r: [0, 0, Math.PI / 2] });
}

// ── an arm ──

// An arm in its own space from the shoulder, hanging down -y, the elbow a
// little bent: the wide sleeve, ragged at its end and drooping on the side
// that falls when the arm comes up; the forearm in it; the gauntlet.
const ELBOW = V3(-0.035, -0.32, 0);
const WRIST = V3(0.09, -0.58, 0);
function armParts(bk, mats, { seed, hand }) {
  const fdir = WRIST.clone().sub(ELBOW).normalize();
  const curve = new THREE.CatmullRomCurve3([V3(0, 0.03, 0), ELBOW, WRIST, WRIST.clone().addScaledVector(fdir, 0.07)], false, 'centripetal');
  const droop = V3(-1, -0.25, 0).normalize();
  const n = makeNoise(seed * 13 + 1);
  const C = V3();
  const sleeve = {
    at(u, v, p) {
      curve.getPointAt(v, C);
      const T = curve.getTangentAt(v);
      const N = V3(T.y, -T.x, 0).normalize();
      const phi = u * TAU;
      const radial = N.clone().multiplyScalar(Math.cos(phi)).addScaledVector(Z, Math.sin(phi));
      const r = (0.08 + 0.075 * Math.pow(v, 1.5)) * (1 + (0.06 + 0.22 * v) * Math.sin(phi * 4 + n(u * 4, v * 2, 4) * 3));
      const hang = 0.09 * v ** 3 * Math.max(0, radial.dot(droop)) ** 1.5;
      const P = C.clone().addScaledVector(radial, r).addScaledVector(droop, hang);
      p.x = P.x;
      p.y = P.y;
      p.z = P.z;
      p.cx = C.x;
      p.cy = C.y;
      p.cz = C.z;
      p.sway = 0.35 * v * v;
      p.shade = mix(0.65, 0.9, v);
      p.phase = n(u * 6 + 2, 1.5, 6);
      p.radial = radial;
      p.T = T;
    },
  };
  bk.add(mats.cloth, sheet(18, 12, sleeve.at, { closed: true, vK: 1.5, uOff: seed * 0.29 }));
  // rags from the sleeve's end, on the hanging side
  const r = rng(seed * 7 + 5);
  const p = {};
  for (let i = 0; i < 2; i++) {
    sleeve.at(0.35 + i * 0.3 + r() * 0.1, 0.86, p);
    const down = p.T.clone().multiplyScalar(0.6).addScaledVector(droop, 0.5).normalize();
    const across = down.clone().cross(p.radial).normalize();
    bk.add(mats.cloth, rag(V3(p.x, p.y, p.z), down, p.radial, across, 0.16 + r() * 0.14, 0.04 + r() * 0.025, r));
  }
  bk.add(mats.cloth, solid(rod(ELBOW, WRIST, 0.045, 0.038, 6), { shade: 0.15 }));
  gauntlet(bk, mats.steel, { wrist: WRIST, fore: fdir.clone().negate(), ...hand });
}

// The hands: the left a claw that reaches, palm back so it comes down when
// the arm comes up; the right closed on the sword (or another claw).
const dirZ = (deg) => V3(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180), 0);
const CLAW = { axis: dirZ(-68), palm: dirZ(-158), curl: [0.35, 0.55, 0.5], splay: 0.17, thumbCurl: [0.3, 0.45] };
const BLADE_ANGLE = -15; // the sword's angle in the arm's space, in degrees
const GRIP = { axis: dirZ(BLADE_ANGLE - 90), palm: V3(0, 0, -1), curl: [1.2, 1.35, 1.05], splay: 0.02, thumbCurl: [0.7, 0.6], thumb: 1 };

// ── the textures ──

// The cloth: a heavy charcoal twill, worn greyer in patches and streaked
// down its fall, and its height (fine folds and the threads) for the normal map.
function clothCanvases(S = 256) {
  const n = makeNoise(17);
  const m = makeNoise(23);
  const field = new Float32Array(S * S);
  const hash = (i) => {
    const h = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return h - Math.floor(h);
  };
  const c = paintPixels(makeCanvas(S), (u, v, out, x, y) => {
    const warp = ((x >> 1) + (y >> 1)) % 4 < 2;
    const across = warp ? x & 1 : y & 1;
    const thread = (across ? 0.72 : 1) * (0.85 + 0.15 * hash(warp ? x >> 1 : 997 + (y >> 1)));
    const blotch = fbm(n, u * 5, v * 5, { period: 5, octaves: 4 });
    const streak = n(u * 32, 3.5, 32) * (0.5 + 0.5 * fbm(m, u * 4, v * 4, { period: 4, octaves: 2 }));
    const worn = smooth(0.6, 0.78, fbm(m, u * 3 + 7, v * 3, { period: 3, octaves: 3 }));
    const L = 12 + 9 * thread + 7 * (blotch - 0.5) + 6 * (streak - 0.4) + 7 * worn;
    out[0] = L + worn * 2;
    out[1] = L + worn;
    out[2] = L * 1.12 + 2;
    const fold = 0.5 + 0.5 * Math.sin(u * TAU * 3 + 4 * fbm(n, u * 3, v * 3, { period: 3, octaves: 3 }));
    const crumple = fbm(m, u * 6, v * 6, { period: 6, octaves: 3 });
    field[y * S + x] = fold * 0.55 + crumple * 0.3 + thread * 0.15;
  });
  return { color: c, normal: normalFromField(field, S, S, 4.5) };
}

// The tears: one copy along a hem (u) and down into it (canvas rows run
// from the whole cloth at the top to the hem's very edge at the bottom).
// Strips of different widths and lengths with pointed, slanted and notched
// ends, slits between them opening toward the hem, and moth holes.
function tornCanvas(W = 512, H = 160, seed = 5) {
  const r = rng(seed);
  const n = makeNoise(seed + 9);
  const strips = [];
  for (let x = 0; x < 1; ) {
    const w = Math.min(1 - x, 0.035 + r() * 0.08);
    const len = 0.18 + Math.pow(r(), 0.8) * 0.82;
    strips.push({ x0: x, w, len, slit: 0.1 + r() * 0.5, end: Math.floor(r() * 3), lean: r() < 0.5 ? -1 : 1, gap: 0.004 + r() * 0.006 });
    x += w;
  }
  const holes = Array.from({ length: 6 }, () => ({ u: r(), d: 0.04 + r() * 0.3, ru: 0.004 + r() * 0.01, rd: 0.015 + r() * 0.035 }));
  const at = new Int16Array(W);
  for (let x = 0, s = 0; x < W; x++) {
    while (s < strips.length - 1 && (x + 0.5) / W > strips[s].x0 + strips[s].w) s++;
    at[x] = s;
  }
  return paintPixels(makeCanvas(W, H), (u, d, out, x) => {
    const s = strips[at[x]];
    const t = ((x + 0.5) / W - s.x0) / s.w;
    const jag = (n(u * 45, d * 6) - 0.5) * 0.08 + (n(u * 160, d * 20) - 0.5) * 0.03;
    let end = s.len;
    if (s.end === 0) end -= Math.abs(t - 0.5) * 0.5;
    else if (s.end === 1) end -= (s.lean > 0 ? t : 1 - t) * 0.4;
    else end -= (0.5 - Math.abs(t - 0.5)) * 0.22;
    let keep = d < end + jag;
    // the slit to the next strip, widening toward the hem
    if (keep && d > s.slit) {
      const g = (s.gap * (1 + 2.5 * (d - s.slit))) / s.w + (n(u * 120 + 3, d * 14) - 0.5) * 0.05;
      if (t < g * 0.5 || t > 1 - g * 0.5) keep = false;
    }
    if (keep) {
      for (const h of holes) {
        let du = Math.abs(u - h.u);
        du = Math.min(du, 1 - du);
        if ((du / h.ru) ** 2 + ((d - h.d) / h.rd) ** 2 < 1 + jag * 4) keep = false;
      }
    }
    const v = keep ? 255 : 0;
    out[0] = out[1] = out[2] = v;
  });
}

export function createWraithKit(renderer) {
  const cv = clothCanvases(256);
  const T = (c, o) => canvasTexture(c, renderer, o);
  const weave = T(cv.color);
  const weaveN = T(cv.normal, { srgb: false });
  weave.repeat.set(2 / TORN_TILE, 2 / TORN_TILE);
  weaveN.repeat.copy(weave.repeat);
  const torn = T(tornCanvas(), { srgb: false });
  torn.wrapT = THREE.ClampToEdgeWrapping;
  const env = nightEnv(renderer);

  // the uniforms every Nazgûl's materials share
  const U = {
    uTime: { value: 0 },
    uWind: { value: V3(0.05, 0, 0.03) },
    uTorn: { value: torn },
    uTear: { value: new THREE.Vector2(TORN, 1 / TORN_TILE) },
    uRimColor: { value: new THREE.Color(0.6, 0.7, 0.9) },
    uRim: { value: 0.17 },
    uInner: { value: 0.42 },
    uRing: { value: 0 },
    uGhost: { value: new THREE.Color(0.78, 0.83, 0.9) },
  };

  const { mats, setRing } = wraithMaterials(U, { weave, weaveN, env });
  const K = { mats, U };

  return {
    mats,
    uniforms: U,
    nazgul: (o) => nazgul(K, o),
    animate,
    tick: (t) => {
      U.uTime.value = t;
    },
    setRing,
  };
}

// ── a Nazgûl ──

function nazgul(K, { seed = 1, sword: armed = true } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'nazgul';

  // the robe and the feet: they stay on the ground
  const gk = parts();
  gk.add(mats.cloth, underRobe(seed));
  for (const s of [-1, 1]) gk.at([0.17, 0, s * 0.11], -s * 0.12, () => sabaton(gk, mats.steel));
  gk.build(g);

  // the body, from the hips: torso, cloak, mantle, rags
  const body = new THREE.Group();
  body.name = 'body';
  body.position.set(0, HIP, 0);
  g.add(body);
  const bk = parts();
  bk.at([0, -HIP, 0], 0, () => {
    const cloak = overCloak(seed);
    const cape = mantle(seed);
    bk.add(mats.cloth, torso());
    bk.add(mats.cloth, cloak.geo);
    bk.add(mats.cloth, cape.geo);
    ragsFrom(bk, mats.cloth, cloak, { n: 11, v: 0.84, len: [0.28, 0.55], width: [0.05, 0.09], seed: seed * 17 + 1 });
    ragsFrom(bk, mats.cloth, cape, { n: 9, v: 0.82, len: [0.14, 0.28], width: [0.045, 0.075], seed: seed * 17 + 2, u0: 0.04, u1: 0.96 });
    bk.add(mats.cloth, solid(lathe([[0.13, 1.84], [0.125, 1.96], [0.105, 2.08]], 12), { shade: 0.35 }), { p: [NECK[0] - 0.02, 0, 0] });
  });
  bk.build(body);

  // the head: the hood, the dark in it, and the face and crown only the Ring shows
  const head = new THREE.Group();
  head.name = 'head';
  head.position.set(NECK[0], NECK[1] - HIP, NECK[2]);
  body.add(head);
  const hk = parts();
  hk.add(mats.cloth, hood(seed));
  const c = hoodMid(0.3);
  hk.add(mats.void, ball(1, 10, 8), { p: [c.x, c.y + 0.0, 0], s: [0.06, 0.13, 0.085] });
  const f = hoodMid(0.2);
  hk.add(mats.face, ghostFace(), { p: [f.x, f.y - 0.01, 0], r: [0, 0, -0.08] });
  hk.add(mats.crown, new THREE.TorusGeometry(0.088, 0.007, 4, 22), { p: [f.x - 0.04, f.y + 0.06, 0], r: [Math.PI / 2, 0.15, 0] });
  for (let i = 0; i < 7; i++) {
    const a = ((i - 3) / 3) * 1.25;
    hk.add(mats.crown, new THREE.ConeGeometry(0.009, i === 3 ? 0.05 : 0.034, 4), { p: [f.x - 0.04 + Math.cos(a) * 0.088, f.y + 0.072 + Math.cos(a) * 0.012 + (i === 3 ? 0.008 : 0), Math.sin(a) * 0.088], r: [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2 - 0.15] });
  }
  // the face and crown draw before the cloth, so they show through it
  for (const m of hk.build(head)) if (m.material === mats.face || m.material === mats.crown) m.renderOrder = -1;

  // the arms, from the shoulders: left (-z) the reaching claw, right (+z) the sword
  const arms = [-1, 1].map((s) => {
    const arm = new THREE.Group();
    arm.name = s < 0 ? 'armL' : 'armR';
    arm.position.set(SHOULDER[0], SHOULDER[1] - HIP, s * SHOULDER[2]);
    body.add(arm);
    const ak = parts();
    const holds = s > 0 && armed;
    const hand = holds ? GRIP : { ...CLAW, thumb: s < 0 ? -1 : 1, splay: s < 0 ? CLAW.splay : CLAW.splay * 0.7 };
    armParts(ak, mats, { seed: seed * 2 + (s > 0 ? 1 : 0), hand });
    ak.build(arm);
    return arm;
  });
  let sword = null;
  if (armed) {
    sword = new THREE.Group();
    sword.name = 'sword';
    const K0 = WRIST.clone().addScaledVector(GRIP.axis, 0.085);
    const at = K0.addScaledVector(GRIP.palm, 0.024).addScaledVector(GRIP.axis, 0.016);
    sword.position.copy(at);
    sword.rotation.z = (BLADE_ANGLE * Math.PI) / 180;
    arms[1].add(sword);
    const sk = parts();
    swordParts(sk, mats);
    sk.build(sword);
  }

  // how tall it stands: the tip of the hood
  g.updateMatrixWorld(true);
  const top = new THREE.Box3().setFromObject(head.children[0]).max.y;
  return { group: g, body, head, arms, sword, top, hip: HIP, phase: rng(seed * 31 + 7)() * TAU };
}

// ── posing ──

// Each Nazgûl's own motion (../creatures.js): how fast it's really gliding,
// read from where the scene puts it; a glide's "step" under the robe from
// the ground it covers; its hunt, sniff and look eased; a shriek.
function motionOf(n) {
  const seed = Math.round((n.phase ?? 0) * 1000);
  return (n.motion ??= {
    track: createTracker({ fastest: 20 }),
    stride: createStride({ stride: 1.5, hz: 0.75, longest: 1.9, cadence: [0.85, 1.4], seed }),
    shriek: createShot(1.4),
    hunt: 0,
    sniff: 0,
    look: 0,
    recoil: 0,
    was: { hunt: 0, recoil: 0, shriek: 0 },
    seed,
  });
}

// Poses one Nazgûl for this frame, with transforms only. It glides (there
// are no legs to walk on) as fast as the scene moves it: a rise and a lean
// from foot to foot under the robe in step with the ground it covers, more
// at a run, none standing; `moving` is no longer needed (it's read from
// where it's put). `sniff` (0..1) puts the head low, casting about, and
// brings the left claw up and out; `hunt` (0..1) leans it in, fixes the
// head and raises the sword. `look` turns the hood. Driven back (`recoil`
// 0..1, or seen backing off as it's put further away facing in: a brand
// thrust at Weathertop), it rears back from it with its claw up before its
// hood. It shrieks (head thrown back, arms flung out) as it takes up a hunt,
// as it's driven back, or on `shriek`. Each is eased, so nothing pops.
function animate(n, t, { hunt = 0, sniff = 0, look = 0, recoil = 0, shriek = 0 } = {}) {
  const M = motionOf(n);
  const g = n.group;
  const m = M.track(t, g.position.x, g.position.z, g.rotation.y, g.scale.x);
  const dt = m.dt;
  const st = M.stride.step(dt, m.fwd < -0.05 ? -m.speed : m.speed);
  const ph = n.phase ?? 0;
  // driven back: backing off faster than it would ever choose to
  const backing = smooth(0.4, 2.5, -m.fwd);
  const rWant = Math.max(clamp01(recoil), backing);
  M.recoil = ease(M.recoil, rWant, dt, rWant > M.recoil ? 14 : 2.5);
  // the shriek, once, as it takes up the hunt, is driven back, or is told
  const h0 = clamp01(hunt);
  if ((h0 > 0.5 && M.was.hunt <= 0.5) || (rWant > 0.5 && M.was.recoil <= 0.5) || (shriek > 0.5 && M.was.shriek <= 0.5)) M.shriek.fire();
  M.was.hunt = h0;
  M.was.recoil = rWant;
  M.was.shriek = shriek;
  const sk = M.shriek.step(dt);
  const sh = sk < 0 ? 0 : smooth(0, 0.12, sk) * (1 - smooth(0.55, 1, sk));
  M.hunt = ease(M.hunt, h0, dt, 4);
  M.sniff = ease(M.sniff, clamp01(sniff), dt, 3);
  M.look = ease(M.look, look, dt, 6);
  const h = M.hunt;
  const s = M.sniff * (1 - sh);
  const rc = M.recoil;
  const go = st.amount;
  const [L, R] = n.arms;
  const sw = sway(st.phase, go);
  const air = breathe(t, M.seed);
  const swing = go * Math.sin(st.phase);
  n.body.position.y = (n.hip ?? HIP) + sw.bob * (0.022 + 0.014 * st.run) - 0.01 * go + air * 0.008 * (1 - go) - rc * 0.07 + sh * 0.05;
  n.body.rotation.z = -0.05 - 0.07 * go - 0.07 * st.run - 0.2 * s - 0.15 * h * (1 - rc) + rc * 0.38 + sh * 0.32 + Math.sin(t * 0.8 + ph) * 0.015 * (1 - go);
  n.body.rotation.x = sw.roll * 0.035 + air * 0.01 * (1 - go);
  n.body.rotation.y = swing * 0.04 + rc * Math.sin(t * 9 + ph) * 0.03;
  const cast = Math.sin(t * 1.4 + ph) * 0.55 + Math.sin(t * 3.7 + ph * 2) * 0.12;
  const away = rc * 0.35 * (Math.sin(ph * 3) > 0 ? 1 : -1);
  n.head.rotation.y = M.look + s * cast + (1 - s) * (1 - h) * (1 - sh) * Math.sin(t * 0.45 + ph) * 0.25 + away;
  n.head.rotation.z = -0.06 - 0.32 * s - 0.1 * h * (1 - rc) + rc * 0.22 + sh * 0.62 + s * Math.sin(t * 5.3 + ph) * 0.04;
  n.head.rotation.x = s * Math.sin(t * 0.9 + ph) * 0.1 + sh * Math.sin(t * 23 + ph) * 0.04;
  const tremble = Math.sin(t * 17 + ph) * 0.015 * Math.max(s, h, rc, sh);
  L.rotation.z = 0.22 + 1.05 * s + 0.3 * h * (1 - s) + swing * 0.08 + tremble + rc * 1.15 * (1 - sh) + sh * 0.55;
  L.rotation.x = 0.14 * s + 0.05 + sh * 0.95 + rc * 0.2;
  R.rotation.z = -0.12 + 1.35 * h * (1 - rc) - swing * 0.06 + tremble * 0.5 + rc * 0.45 + sh * 0.5;
  R.rotation.x = -0.06 - 0.08 * h - sh * 0.95;
}
