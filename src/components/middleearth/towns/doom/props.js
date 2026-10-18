// Mordor and Mount Doom, made in code: the kit the last walkable chapter is
// built from. Orodruin itself, black with ash and cinder, its gullies running
// with fire and its plume going up red into the reek, the road sweeping up
// its western side to the door of the Sammath Naur; Barad-dûr far off, its
// Eye between the horns of its crown and the long beam of its searching; the
// plain of Gorgoroth, its boulders and fangs of rock, an orc camp, a column
// of orcs on the march, the orcs themselves and their slave-driver with his
// whip; inside the Mountain, the spur over the Crack of Doom; the lava that
// comes after, and the rock Frodo and Sam wait on; Gwaihir the Windlord;
// Gollum, at the last; and the Ring, its letters burning.
//
// Built with the Shire's kit (../../shire/props.js) as the other towns are,
// and to the same conventions: metres, +x east, +z south, y up; each
// builder's group stands on y = 0 at its origin, fronts face +z, creatures
// face +x, and fixed parts are merged one mesh per material. Things meant for
// an InstancedMesh come back as one vertex-coloured geometry. What glows is
// brighter than 1, so the bloom (threshold about 0.8) takes it.
//
// Far things (the Mountain, the Tower) take the fog only so far (uFogCap),
// so they stand out of the reek as dark shapes with fire on them.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, ridge, smooth } from '../../../../lib/paint';
import { blob, boxUV, createShireKit, parts, rng, tf, tube } from '../../shire/props';
import { gollum } from '../marshes/props';
import { ease } from '../../creatures';
import { beamMaterial, bombCloud, bombMaterial, emberish, eyeMaterial, flameMaterial, hazeMaterial, lavaMaterial, orcMaterial, ringMaterial, smokeMaterial, sparkMaterial, sparkPoints, underglow } from '../../nodes/towns/doom/propsShaders';

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
const _kc2 = new THREE.Color();
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
  // a sliver of a triangle has no normal: give it one, or it lights as NaN
  const nr = g.attributes.normal;
  for (let i = 0; i < nr.count; i++) if (nr.getX(i) ** 2 + nr.getY(i) ** 2 + nr.getZ(i) ** 2 < 1e-10) nr.setXYZ(i, 0, 1, 0);
  return g;
}

// One geometry from several for one material: unindexed, each with a
// position, normal, uv and colour (and `extra` attributes kept, 1-wide).
function oneGeo(list, extra = []) {
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

const bone = (name, parent, p = [0, 0, 0]) => {
  const o = new THREE.Group();
  o.name = name;
  o.position.set(...p);
  parent.add(o);
  return o;
};

// A geometry from flat arrays.
function geoOf(pos, idx, uv = null) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (idx) g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A rough hull of rock: `count` points about an ellipsoid of half-sizes
// [a, b, c] at `at`, jittered. Flat-faced.
function hullRock(seed, [a, b, c], at = [0, 0, 0], count = 14, flatBottom = true) {
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

// ── painted textures ──

// Black basalt, nearly white so vertex colours give its hue: gas pits,
// grain, joints and fine cracks. With its relief.
function basaltCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 5);
  const pits = makeCells(seed + 9);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 6, v * 6, 6);
    const crack = (1 - smooth(0, 0.02, k.f2 - k.f1)) * smooth(0.5, 0.66, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 }));
    const p = pits(u * 24, v * 24, 24);
    const pit = (1 - smooth(0.06, 0.16, p.f1)) * smooth(0.45, 0.7, n(u * 8 + 3, v * 8, 8));
    field[py * S + px] = clamp01(0.4 + big * 0.4 + grain * 0.14 - crack * 0.5 - pit * 0.35);
    const t = 0.72 + big * 0.3 + (grain - 0.5) * 0.2 - crack * 0.3 - pit * 0.25;
    out[0] = 230 * t;
    out[1] = 226 * t;
    out[2] = 222 * t;
  });
  return { c, field };
}

// Ash and cinder: fine grains, scattered clinker, ripples where the wind
// has laid it. With its relief.
function cinderCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const grain = n(u * 160, v * 160, 160);
    const mid = fbm(n, u * 16, v * 16, { period: 16, octaves: 3 });
    const k = cells(u * 14, v * 14, 14);
    const clinker = (1 - smooth(0.1, 0.32, k.f1)) * smooth(0.55, 0.75, n(u * 10 + 5, v * 10, 10));
    const ripple = Math.sin((v + (mid - 0.5) * 0.08) * TAU * 22) * 0.5 + 0.5;
    field[py * S + px] = clamp01(0.35 + grain * 0.2 + clinker * 0.5 + ripple * 0.12 + mid * 0.1);
    const t = 0.78 + (grain - 0.5) * 0.34 + (mid - 0.5) * 0.24 - clinker * 0.28 + ripple * 0.05;
    out[0] = 232 * t;
    out[1] = 226 * t;
    out[2] = 220 * t;
  });
  return { c, field };
}

// Hide, scraped and stitched: patches, seams and stains.
function hideCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 2);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const k = cells(u * 3, v * 3, 3);
    const seam = 1 - smooth(0.0, 0.03, k.f2 - k.f1);
    const stitch = seam * (Math.sin((u + v) * 260) > 0.2 ? 1 : 0.4);
    const blot = fbm(n, u * 6, v * 6, { period: 6, octaves: 4 });
    const t = 0.7 + (k.id - 0.5) * 0.3 + (blot - 0.5) * 0.4 - stitch * 0.35;
    out[0] = 220 * t;
    out[1] = 205 * t;
    out[2] = 190 * t;
  });
}

// A soft round glow.
function glowCanvas(S = 64) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, S, S);
  return c;
}

// A tongue of flame, white at its heart, for a sprite.
function flameCanvas() {
  const n = makeNoise(77);
  return paintPixels(makeCanvas(64, 128), (u, v, out) => {
    const y = 1 - v;
    const w = 0.36 * Math.pow(1 - y, 0.7) * smooth(0, 0.12, y) + 0.02;
    const x = Math.abs(u - 0.5 + (n(u * 4, y * 5) - 0.5) * 0.18 * y);
    const a = smooth(w, w * 0.25, x) * smooth(1, 0.55, y + (n(u * 6 + 2, y * 6) - 0.5) * 0.3);
    const core = smooth(w * 0.7, 0, x) * smooth(0.7, 0.1, y);
    out[0] = 255;
    out[1] = 130 + core * 125;
    out[2] = 40 + core * 170;
    out[3] = a * 255;
  });
}

// A puff of smoke: soft, lumpy, its alpha in the canvas.
function puffCanvas(S = 128) {
  const n = makeNoise(41);
  return paintPixels(makeCanvas(S), (u, v, out) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const f = fbm(n, u * 5, v * 5, { octaves: 4 });
    const a = smooth(1, 0.25, d + (f - 0.5) * 0.7);
    out[0] = out[1] = out[2] = 200 + f * 55;
    out[3] = a * 255;
  });
}

// Smooth noise in three channels, tiling, for the shaders (lava, smoke,
// the beam's dust, the cracks in the rock).
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

// Feathers in rows, overlapping like slates: each a rounded tip with its
// shaft, the edge darker. Grey, for vertex colours to tint. With relief.
function featherCanvas(S, seed) {
  const n = makeNoise(seed);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const rows = 8;
    const row = Math.floor(v * rows);
    const fv = v * rows - row;
    const uu = u * 6 + (row % 2) * 0.5;
    const fu = uu - Math.floor(uu);
    // a scalloped tip at the bottom of each row
    const tip = Math.sqrt(Math.max(0, 1 - ((fu - 0.5) * 2) ** 2)) * 0.5;
    const inside = fv - (1 - tip - 0.48);
    const edge = 1 - smooth(0, 0.08, Math.abs(inside));
    const shaft = (1 - smooth(0, 0.035, Math.abs(fu - 0.5))) * 0.5;
    const barbs = Math.sin((fv * 3 + Math.abs(fu - 0.5)) * 60) * 0.5 + 0.5;
    const blot = fbm(n, u * 5, v * 5, { period: 5, octaves: 3 });
    field[py * S + px] = clamp01(0.5 + fv * 0.35 - edge * 0.3 + shaft * 0.2 + barbs * 0.05);
    const t = 0.7 + fv * 0.25 - edge * 0.22 + shaft * 0.12 + (barbs - 0.5) * 0.06 + (blot - 0.5) * 0.14;
    out[0] = out[1] = out[2] = 245 * clamp01(t);
  });
  return { c, field };
}

// The Ring's inscription: a line of flowing letters in the Elvish hand,
// white on black, wrapping round the band. Not a real text: bows and
// stems, the strokes swelling and thinning, the vowel-marks over them.
function lettersCanvas() {
  const W = 1024;
  const H = 64;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#000';
  x.fillRect(0, 0, W, H);
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  x.lineCap = 'round';
  x.lineJoin = 'round';
  const r = rng(1999);
  const base = 40;
  let px = 6;
  while (px < W - 30) {
    const kind = Math.floor(r() * 6);
    const w = 16 + r() * 8;
    x.lineWidth = 2.6;
    // the stem: up (a telco), down, or short
    const up = kind % 3 === 0;
    const down = kind % 3 === 1;
    x.beginPath();
    x.moveTo(px + 2, up ? base - 30 : base - 16);
    x.quadraticCurveTo(px, base - 6, px + 3, down ? base + 18 : base);
    x.stroke();
    // one or two bows off the stem
    const bows = 1 + (kind > 2 ? 1 : 0);
    for (let b = 0; b < bows; b++) {
      x.lineWidth = 2.2;
      x.beginPath();
      const y0 = base - 16 + b * 2;
      x.moveTo(px + 3, y0);
      x.bezierCurveTo(px + w * 0.6, y0 - 6, px + w * 0.9, base - 4, px + 3 + b * 4, base - (b ? 2 : 0));
      x.stroke();
      if (b === 0 && kind === 5) x.lineTo(px + w * 0.6 + 6, base + 1);
    }
    // a swash or a curl now and then
    if (r() < 0.25) {
      x.lineWidth = 1.8;
      x.beginPath();
      x.moveTo(px + w * 0.7, base);
      x.quadraticCurveTo(px + w, base + 6, px + w + 6, base - 3);
      x.stroke();
    }
    // the tehtar over it: an acute, a dot or two, a curl
    const t = r();
    x.lineWidth = 1.8;
    if (t < 0.3) {
      x.beginPath();
      x.moveTo(px + w * 0.35, base - 23);
      x.lineTo(px + w * 0.65, base - 30);
      x.stroke();
    } else if (t < 0.5) {
      x.beginPath();
      x.arc(px + w * 0.5, base - 26, 1.8, 0, TAU);
      x.fill();
      x.beginPath();
      x.arc(px + w * 0.5 + 6, base - 27, 1.8, 0, TAU);
      x.fill();
    } else if (t < 0.65) {
      x.beginPath();
      x.arc(px + w * 0.5, base - 25, 4, Math.PI, TAU);
      x.stroke();
    }
    px += w + 3 + r() * 5;
    if (r() < 0.08) px += 10;
  }
  return c;
}

// What polished metal catches in Mordor: a low sky of dark cloud, the fire
// of the Mountain red along the horizon, black ground.
function envCanvas() {
  const W = 128;
  const H = 64;
  const n = makeNoise(5);
  return paintPixels(makeCanvas(W, H), (u, v, out) => {
    const up = 1 - v * 2;
    const horizon = Math.exp(-Math.abs(up) * 5);
    const fire = horizon * (0.5 + 0.5 * smooth(0.3, 0.8, n(u * 6, 1.5, 6))) * (0.6 + 0.4 * Math.cos((u - 0.3) * TAU));
    const sky = up > 0 ? 0.18 + 0.1 * fbm(n, u * 8, v * 8, { period: 8, octaves: 3 }) : 0.05;
    out[0] = clamp01(sky * 0.9 + fire * 1.2) * 255;
    out[1] = clamp01(sky * 0.55 + fire * 0.42) * 255;
    out[2] = clamp01(sky * 0.45 + fire * 0.12) * 255;
  });
}

// The banner of the Eye: a ragged black cloth, the Lidless Eye on it in red.
function bannerCanvas() {
  const W = 64;
  const H = 128;
  const n = makeNoise(13);
  return paintPixels(makeCanvas(W, H), (u, v, out) => {
    const ex = (u - 0.5) / 0.32;
    const ey = (v - 0.36) / 0.16;
    const r = Math.hypot(ex, ey / Math.max(0.1, 1 - 0.7 * Math.min(1, Math.abs(ex)) ** 1.8));
    const eye = 1 - smooth(0.85, 1.0, r);
    const slit = 1 - smooth(0.04, 0.09, Math.abs(u - 0.5));
    const grime = fbm(n, u * 6, v * 6, { octaves: 3 });
    const k = 0.7 + grime * 0.5;
    out[0] = (20 + eye * (1 - slit * 0.9) * 150) * k;
    out[1] = (16 + eye * (1 - slit) * 20) * k;
    out[2] = 14 * k;
    // the hem torn into tatters
    const tear = v > 0.75 + (n(u * 9, 3) - 0.5) * 0.25 + Math.max(0, Math.sin(u * 30)) * 0.08;
    out[3] = tear ? 0 : 255;
  });
}

// A cloud of cards for a flame or smoke material: `pts` the places they are
// born (in the parent's frame), each card its own seed. One draw.
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

// An added glow on a sprite.
function glowSprite(map, colour, size, opacity = 1, fog = false) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: colour, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog }));
  s.scale.set(size, size, 1);
  s.renderOrder = 6;
  return s;
}

// ── Orodruin ──

// The Mountain's section, [r, y]: the crater floor, its rim 54 m out and
// 326 up, the cone steepening down to a broad shoulder of old flows, its
// skirts going down under the plain.
const DOOM_PROFILE = [[0, 297], [30, 298], [44, 313], [54, 326], [66, 321], [90, 301], [130, 256], [170, 205], [210, 160], [250, 128], [290, 111], [340, 97], [400, 72], [450, 44], [500, 18], [540, 3], [580, -6]];
const DOOM = { door: 213, edge: 580, roadW: 4.6, west: Math.PI };
// The streams of fire: [heading (0 east, π west, π/2 south), from r, to r,
// width, seed]. The road's side (west, ±0.62) is kept clear but for the
// one that comes down just over the door.
const DOOM_RIVERS = [
  [Math.PI - 0.4, 60, 136, 4, 1],
  [Math.PI + 0.98, 58, 330, 5, 2],
  [Math.PI - 1.08, 96, 300, 5.5, 3],
  [Math.PI - 0.84, 62, 225, 3.5, 4],
  [0.2, 56, 380, 7, 5],
  [0.42, 70, 250, 4, 11],
  [0.95, 120, 300, 5, 6],
  [-0.6, 58, 250, 5.5, 7],
  [1.75, 58, 310, 5.5, 8],
  [-1.45, 140, 335, 5, 9],
  [-0.64, 292, 470, 7, 10],
];
const DOOMC = {
  ash: C(0x5a524c),
  cinder: C(0x2e2826),
  rock: C(0x221e1d),
  pale: C(0x8e867e),
  rust: C(0x6e3622),
  sulphur: C(0x9e8a44),
  scorch: C(0x120c0a),
  ember: C(0x6a1e0e),
  road: C(0xa29482),
  bank: C(0x4a403a),
};
const wrapA = (a) => a - TAU * Math.round(a / TAU);

// The ground of the Mountain before the road is cut: at (r, φ) its height,
// and how hot it is (by the streams, in the crater).
function doomShape() {
  const n = makeNoise(1301);
  const n2 = makeNoise(1309);
  const n3 = makeNoise(1319);
  const rivers = DOOM_RIVERS.map(([phi, r0, r1, w, s]) => ({ phi, r0, r1, w, s, at: (r) => phi + 0.08 * Math.sin(r * 0.015 + s * 1.3) + 0.035 * Math.sin(r * 0.043 + s * 2.9) + 0.012 * Math.sin(r * 0.11 + s) }));
  const at = (r, phi) => {
    const x = r * Math.cos(phi);
    const z = r * Math.sin(phi);
    let y = prof(DOOM_PROFILE, r)[0];
    const u = ((((phi / TAU) % 1) + 1) % 1) * 36;
    // ridges and gullies running down it, finer ones on them
    const cone = smooth(46, 110, r) * (1 - 0.6 * smooth(250, 560, r));
    y += (ridge(n, u, r * 0.011, { period: 36, octaves: 3 }) - 0.62) * 22 * cone;
    y += (ridge(n2, u * 3, r * 0.03, { period: 108, octaves: 2 }) - 0.6) * 6.5 * cone;
    // the rim broken down on the east, where the fire spills over most
    y -= 18 * Math.exp(-((wrapA(phi - 0.2) / 0.32) ** 2)) * (1 - smooth(60, 150, r)) * smooth(30, 50, r);
    // great lumps of old flows, and a lesser cone on its north-east shoulder
    y += (fbm(n3, x * 0.004 + 9, z * 0.004, { octaves: 3 }) - 0.5) * 30 * smooth(70, 200, r) * (1 - smooth(470, 580, r));
    y += 36 * Math.exp(-((x - 230) ** 2 + (z + 170) ** 2) / 8000);
    // the crater broken and rough inside
    if (r < 62) y += (fbm(n2, x * 0.08, z * 0.08, { octaves: 3 }) - 0.5) * 9 * (1 - smooth(50, 62, r));
    let heat = r < 46 ? smooth(46, 28, r) : 0;
    // each stream in its gully, banked up either side by its own levees
    for (const R of rivers) {
      if (r < R.r0 - 8 || r > R.r1 + 40) continue;
      const d = wrapA(phi - R.at(r)) * r;
      if (Math.abs(d) > R.w * 4) continue;
      const w = R.w * 0.95;
      const run = smooth(R.r0 - 8, R.r0 + 4, r) * (1 - smooth(R.r1 + 5, R.r1 + 40, r));
      y += (-4.6 * Math.exp(-((d / w) ** 2)) + 1.7 * Math.exp(-(((Math.abs(d) - w * 1.3) / (w * 0.45)) ** 2))) * run;
      heat = Math.max(heat, Math.exp(-((d / (w * 1.7)) ** 2)) * smooth(R.r0 - 6, R.r0, r) * (1 - smooth(R.r1 - 10, R.r1 + 18, r)));
    }
    return [y, heat];
  };
  return { at, rivers };
}

// The road: up the western side in four long sweeps, hairpins between, to
// the door. Its curve, samples every 2 m, and a lookup of the nearest one.
function doomRoad(shape) {
  const legs = [[-0.6, 0.6], [0.6, -0.55], [-0.55, 0.5], [0.5, -0.17]];
  const top = DOOM.door;
  const rAt = (phi, y) => {
    let a = 70;
    let b = 576;
    for (let i = 0; i < 26; i++) {
      const m = (a + b) / 2;
      if (shape.at(m, phi)[0] > y) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const STEPS = 12;
  let ys = null;
  let pts = [];
  // twice over, the second time spreading the climb evenly along the way
  for (let pass = 0; pass < 3; pass++) {
    pts = [];
    let k = 0;
    legs.forEach(([a, b], i) => {
      for (let s = i ? 1 : 0; s <= STEPS; s++) {
        const f = s / STEPS;
        const phi = DOOM.west + mix(a, b, f);
        const y = ys ? ys[k] : (top * (i + f)) / legs.length;
        const r = rAt(phi, Math.max(0.6, y));
        pts.push(V3(r * Math.cos(phi), Math.max(0.15, y), r * Math.sin(phi)));
        k++;
      }
    });
    const len = [0];
    for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    ys = len.map((l) => (top * l) / len[len.length - 1]);
  }
  // the last of it turns in off the slope to the door, a little way in
  const E = pts[pts.length - 1];
  const phiE = Math.atan2(E.z, E.x);
  const rE = Math.hypot(E.x, E.z);
  const door = V3((rE - 9) * Math.cos(phiE - 0.03), top, (rE - 9) * Math.sin(phiE - 0.03));
  const mid = V3((rE - 4) * Math.cos(phiE - 0.045), top, (rE - 4) * Math.sin(phiE - 0.045));
  pts.push(mid, door);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const length = curve.getLength();
  const samples = curve.getSpacedPoints(Math.round(length / 2));
  const CELL = 16;
  const grid = new Map();
  samples.forEach((p, i) => {
    const key = `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  });
  // the nearest sample to (x, z) within about 30 m: [distance, index]
  const nearest = (x, z) => {
    const cx = Math.floor(x / CELL);
    const cz = Math.floor(z / CELL);
    let best = 1e9;
    let bi = -1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const list = grid.get(`${cx + dx},${cz + dz}`);
        if (!list) continue;
        for (const i of list) {
          const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
          if (d < best) {
            best = d;
            bi = i;
          }
        }
      }
    }
    return [Math.sqrt(best), bi];
  };
  return { curve, length, samples, nearest, door, end: E };
}

// Mount Doom: Orodruin, 326 m to its crater's rim, a kilometre across its
// foot, the group's origin at the middle of its base on the plain. Black
// ash and cinder, ridged and gullied, streams of fire running down its
// gullies, a heavy plume going up out of the crater and leaning east; a
// road climbing its western side in four long sweeps to the door of the
// Sammath Naur, two-thirds of the way up, a dark mouth with a red glow in
// it. road(k) is the road's surface at k (0 its foot, 1 the door), door the
// threshold; groundAt(x, z) the ground's height. update(t, { erupt }):
// erupt 0..1 sets it blazing.
function mountDoom(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'mountDoom';
  const shape = doomShape();
  const road = doomRoad(shape);
  const n = makeNoise(1331);
  const jn = makeNoise(1337);
  const top = DOOM.door;

  // the ground with the road cut into it, and the landing before the door
  const ground = (x, z) => {
    const r = Math.hypot(x, z);
    const phi = Math.atan2(z, x);
    let [y, heat] = shape.at(r, phi);
    let cut = 0;
    if (Math.abs(wrapA(phi - DOOM.west)) < 1.1 && r > 120) {
      const [d, i] = road.nearest(x, z);
      if (i >= 0 && d < 22) {
        const ry = road.samples[i].y - 0.1;
        const k = smooth(6.5, 21, d);
        y = mix(ry, y, k);
        cut = 1 - smooth(5, 9, d);
        heat *= k;
      }
      const dd = Math.min(Math.hypot(x - road.door.x, z - road.door.z), Math.hypot(x - road.end.x, z - road.end.z));
      if (dd < 26) {
        const k = smooth(11, 26, dd);
        y = mix(top - 0.1, y, k);
        cut = Math.max(cut, 1 - smooth(9, 13, dd));
        heat *= k;
      }
    }
    return [y, heat, cut];
  };

  // ── the Mountain: rings out from the crater, closer together on the
  // western side where the road is
  const rings = [];
  for (let r = 0.6; r < 60; r += 3) rings.push(r);
  for (let r = 60; r < 200; r += 3.6) rings.push(r);
  for (let r = 200; r <= DOOM.edge; r += 4.6) rings.push(r);
  const NP = 216;
  const NR = rings.length;
  const pos = new Float32Array(NR * NP * 3);
  const heatA = new Float32Array(NR * NP);
  const cutA = new Float32Array(NR * NP);
  const uv = new Float32Array(NR * NP * 2);
  for (let i = 0; i < NR; i++) {
    for (let j = 0; j < NP; j++) {
      const s = j / NP;
      const phi0 = TAU * s + 0.42 * Math.sin(TAU * s);
      const r0 = rings[i];
      // jittered off the rings, so it isn't a spider's web
      const jr = r0 > 2 ? (jn(i * 0.7, j * 0.7) - 0.5) * 2.4 : 0;
      const jp = r0 > 2 ? ((jn(i * 0.7 + 50, j * 0.7) - 0.5) * 1.6) / Math.max(r0, 20) : 0;
      const x = (r0 + jr) * Math.cos(phi0 + jp);
      const z = (r0 + jr) * Math.sin(phi0 + jp);
      const [y, heat, cut] = ground(x, z);
      const k = i * NP + j;
      pos.set([x, y, z], k * 3);
      heatA[k] = heat;
      cutA[k] = cut;
      uv.set([x * 0.07, z * 0.07], k * 2);
    }
  }
  const idx = [];
  for (let i = 0; i < NR - 1; i++) {
    for (let j = 0; j < NP; j++) {
      const a = i * NP + j;
      const b = i * NP + ((j + 1) % NP);
      const c = (i + 1) * NP + j;
      const d = (i + 1) * NP + ((j + 1) % NP);
      idx.push(a, b, c, b, d, c);
    }
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  mg.setAttribute('heat', new THREE.BufferAttribute(heatA, 1));
  mg.setIndex(idx);
  mg.computeVertexNormals();
  {
    const nr = mg.attributes.normal;
    const col = new Float32Array(NR * NP * 3);
    for (let k = 0; k < NR * NP; k++) {
      const x = pos[k * 3];
      const y = pos[k * 3 + 1];
      const z = pos[k * 3 + 2];
      const r = Math.hypot(x, z);
      const phi = Math.atan2(z, x);
      const ny = nr.getY(k);
      const u = ((((phi / TAU) % 1) + 1) % 1) * 140;
      const v = noise3(n, x * 0.03, y * 0.03, z * 0.03);
      // cinder on the steeps, grey ash lying where it is gentler
      _kc.copy(DOOMC.cinder).lerp(DOOMC.ash, smooth(0.6, 0.92, ny) * 0.85).multiplyScalar(0.75 + v * 0.55);
      _kc.lerp(DOOMC.rock, smooth(0.6, 0.35, ny) * 0.7);
      // pale ash and rust in long streaks down the slope
      const streak = n(u, r * 0.006);
      _kc.lerp(DOOMC.pale, smooth(0.62, 0.8, streak) * 0.45 * smooth(70, 140, r));
      _kc.lerp(DOOMC.rust, smooth(0.6, 0.78, n(u * 0.6 + 40, r * 0.01)) * 0.5);
      // yellow and red stains about the crater's rim
      const rim = smooth(28, 48, r) * (1 - smooth(70, 110, r));
      _kc.lerp(DOOMC.sulphur, rim * smooth(0.45, 0.7, noise3(n, x * 0.06 + 3, y * 0.06, z * 0.06)) * 0.7);
      _kc.lerp(DOOMC.rust, rim * 0.3);
      // scorched black about the fire
      const h = heatA[k];
      _kc.lerp(DOOMC.scorch, smooth(0.05, 0.4, h) * 0.8).lerp(DOOMC.ember, smooth(0.5, 0.9, h) * 0.6);
      // the trodden road, and dust settled about the foot
      _kc.lerp(DOOMC.bank, smooth(0, 0.6, cutA[k]) * 0.5).lerp(DOOMC.road, smooth(0.6, 1, cutA[k]) * 0.6);
      _kc.lerp(DOOMC.ash, smooth(470, 560, r) * 0.4);
      col.set([_kc.r, _kc.g, _kc.b], k * 3);
    }
    mg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  mg.computeBoundingSphere();
  const mountain = new THREE.Mesh(mg, mats.doom);
  mountain.name = 'orodruin';
  g.add(mountain);

  // the height of the Mountain as drawn (its triangles, not the sums they
  // were sampled from) at (x, z), so what lies on it lies on it
  const tri = (ia, ib, ic, x, z) => {
    const ax = pos[ia * 3];
    const az = pos[ia * 3 + 2];
    const v0x = pos[ic * 3] - ax;
    const v0z = pos[ic * 3 + 2] - az;
    const v1x = pos[ib * 3] - ax;
    const v1z = pos[ib * 3 + 2] - az;
    const v2x = x - ax;
    const v2z = z - az;
    const den = v0x * v1z - v1x * v0z;
    if (Math.abs(den) < 1e-9) return null;
    const u = (v2x * v1z - v1x * v2z) / den;
    const v = (v0x * v2z - v2x * v0z) / den;
    if (u < -1e-5 || v < -1e-5 || u + v > 1 + 1e-5) return null;
    const ay = pos[ia * 3 + 1];
    return ay + u * (pos[ic * 3 + 1] - ay) + v * (pos[ib * 3 + 1] - ay);
  };
  const surface = (x, z) => {
    const r = Math.hypot(x, z);
    let phi = Math.atan2(z, x);
    if (phi < 0) phi += TAU;
    let sv = phi / TAU;
    for (let k = 0; k < 6; k++) sv -= (TAU * sv + 0.42 * Math.sin(TAU * sv) - phi) / (TAU * (1 + 0.42 * Math.cos(TAU * sv)));
    const j0 = Math.floor(sv * NP);
    let lo = 0;
    let hi = NR - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (rings[m] > r) hi = m;
      else lo = m;
    }
    for (let di = -1; di <= 1; di++) {
      const i = lo + di;
      if (i < 0 || i >= NR - 1) continue;
      for (let dj = -2; dj <= 2; dj++) {
        const j = (((j0 + dj) % NP) + NP) % NP;
        const a = i * NP + j;
        const b = i * NP + ((j + 1) % NP);
        const c = (i + 1) * NP + j;
        const d = (i + 1) * NP + ((j + 1) % NP);
        const y = tri(a, b, c, x, z) ?? tri(b, d, c, x, z);
        if (y != null) return y;
      }
    }
    return ground(x, z)[0];
  };

  // ── the streams of fire, each a ribbon down its gully
  {
    const pl = [];
    const ul = [];
    const el = [];
    const il = [];
    const ACROSS = [-1, -0.66, -0.33, 0, 0.33, 0.66, 1];
    for (const R of shape.rivers) {
      const base = pl.length / 3;
      let rows = 0;
      let run = 0;
      let last = null;
      for (let r = R.r0; r <= R.r1; r += 2.5) {
        const c = R.at(r);
        const w = R.w * (0.5 + 0.5 * smooth(R.r0, R.r0 + 30, r)) * (1 - 0.65 * smooth(R.r1 - 45, R.r1, r)) * (0.85 + 0.3 * n(r * 0.05, R.s * 3));
        const cy = shape.at(r, c)[0];
        const here = V3(r * Math.cos(c), cy, r * Math.sin(c));
        if (last) run += here.distanceTo(last);
        last = here;
        for (const o of ACROSS) {
          const phi = c + (o * w * 0.5) / r;
          const x = r * Math.cos(phi);
          const z = r * Math.sin(phi);
          const y = Math.max(surface(x, z), shape.at(r, phi)[0]) + 0.5 - Math.abs(o) * 0.12;
          pl.push(x, y, z);
          ul.push(o * w * 0.5, run);
          el.push(Math.abs(o));
        }
        rows++;
      }
      for (let k = 0; k < rows - 1; k++) {
        for (let j = 0; j < ACROSS.length - 1; j++) {
          const a = base + k * ACROSS.length + j;
          const b = a + ACROSS.length;
          il.push(a, a + 1, b, a + 1, b + 1, b);
        }
      }
    }
    const rg = geoOf(pl, il, ul);
    rg.setAttribute('aEdge', new THREE.Float32BufferAttribute(el, 1));
    const streams = new THREE.Mesh(rg, mats.doomLava);
    streams.name = 'lavaStreams';
    streams.renderOrder = 1;
    g.add(streams);
  }
  // the lava lake in the crater
  {
    const lake = new THREE.CircleGeometry(40, 40).rotateX(-Math.PI / 2);
    const p = lake.attributes.position;
    const u2 = lake.attributes.uv;
    for (let i = 0; i < p.count; i++) u2.setXY(i, p.getX(i), p.getZ(i));
    const m = new THREE.Mesh(lake, mats.doomLake);
    m.position.y = 301.5;
    m.name = 'craterLake';
    g.add(m);
  }

  // ── the road's surface, a kerb of boulders on its outer edge, crags on
  // the ridges and about the rim
  {
    const S = road.samples;
    const pl = [];
    const ul = [];
    const il = [];
    const cl = [];
    const ACROSS = [-1, -0.7, -0.3, 0.3, 0.7, 1];
    const T = V3();
    const X = V3();
    let run = 0;
    S.forEach((p, i) => {
      T.subVectors(S[Math.min(S.length - 1, i + 1)], S[Math.max(0, i - 1)]).setY(0).normalize();
      X.set(-T.z, 0, T.x);
      if (i) run += p.distanceTo(S[i - 1]);
      for (const o of ACROSS) {
        const w = DOOM.roadW * 0.5;
        const edge = Math.abs(o) > 0.95 ? 0.16 : 0;
        pl.push(p.x + X.x * o * w, p.y + 0.12 + 0.05 * (1 - o * o) - edge, p.z + X.z * o * w);
        ul.push(o * w * 0.3, run * 0.3);
        const v = n(run * 0.2, o * 2);
        _kc.copy(DOOMC.road).multiplyScalar(0.8 + v * 0.4 - Math.abs(o) * 0.18);
        cl.push(_kc.r, _kc.g, _kc.b);
      }
      if (i < S.length - 1) {
        const a = i * ACROSS.length;
        for (let j = 0; j < ACROSS.length - 1; j++) il.push(a + j, a + j + ACROSS.length, a + j + 1, a + j + 1, a + j + ACROSS.length, a + j + ACROSS.length + 1);
      }
    });
    const rgeo = geoOf(pl, il, ul);
    rgeo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    const surface = new THREE.Mesh(rgeo, mats.doomRoad);
    surface.name = 'road';
    g.add(surface);

    const rocks = [];
    const r = rng(1401);
    const rockTint = (geo, ash = 0.5) =>
      tint(geo, (x, y, z, out, nx, ny) => {
        out.copy(DOOMC.rock).multiplyScalar(1.2 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.8);
        out.lerp(DOOMC.ash, smooth(0.4, 0.85, ny) * ash);
      });
    // the kerb: on the outer side, every few metres, gaps here and there
    for (let i = 4; i < S.length - 6; i += 3) {
      if (n(i * 0.13, 7) < 0.36) continue;
      const p = S[i];
      T.subVectors(S[i + 1], S[i - 1]).setY(0).normalize();
      X.set(-T.z, 0, T.x);
      const out = Math.sign(X.x * p.x + X.z * p.z) || 1;
      const s = 0.35 + r() * 0.55;
      const at = p.clone().addScaledVector(X, out * (DOOM.roadW * 0.5 + 0.5 + r() * 0.6));
      rocks.push(rockTint(hullRock(1500 + i, [s * 1.3, s, s * 1.1], [at.x, p.y + s * 0.35, at.z], 9), 0.6));
    }
    // crags on the ridges of the cone, clear of the road and the fire
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 70; tries++) {
      const rr = 62 + r() * 330;
      const phi = r() * TAU;
      const x = rr * Math.cos(phi);
      const z = rr * Math.sin(phi);
      const [y, heat, cut] = ground(x, z);
      if (heat > 0.15 || cut > 0) continue;
      if (Math.abs(wrapA(phi - DOOM.west)) < 1.1 && road.nearest(x, z)[0] < 16) continue;
      if (Math.hypot(x - road.door.x, z - road.door.z) < 30) continue;
      const ys = shape.at(rr + 4, phi)[0];
      const yn = shape.at(rr - 4, phi)[0];
      // only where it stands proud: on a crest, not in a gully
      const side = shape.at(rr, phi + 6 / rr)[0] + shape.at(rr, phi - 6 / rr)[0];
      if (y * 2 - side < 1.2) continue;
      const s = (2.5 + r() * 6) * (rr < 150 ? 1 : 0.8);
      const lean = (yn - ys) / 8;
      const geo = placed % 2 ? spikeGeo(1600 + tries).clone().scale(s * 0.45, s * (0.4 + r() * 0.3), s * 0.45) : hullRock(1600 + tries, [s * 0.8, s * (0.6 + r() * 0.5), s * 0.7], [0, s * 0.3, 0], 16);
      geo.rotateY(r() * TAU).rotateX(lean * 0.2).translate(x, y - s * 0.25, z);
      rocks.push(rockTint(geo, 0.35));
      placed++;
    }
    // the crater's rim, jagged
    for (let i = 0; i < 26; i++) {
      const phi = (i / 26) * TAU + r() * 0.15;
      const rr = 50 + r() * 8;
      const x = rr * Math.cos(phi);
      const z = rr * Math.sin(phi);
      const y = shape.at(rr, phi)[0];
      const s = 4 + r() * 7;
      const geo = hullRock(1700 + i, [s * 0.9, s * (0.8 + r()), s * 0.8], [0, 0, 0], 12);
      geo.rotateY(r() * TAU).translate(x, y - s * 0.2, z);
      rocks.push(rockTint(geo, 0.25));
    }
    const rk = new THREE.Mesh(oneGeo(rocks), mats.doomRock);
    boxUV(rk.geometry, 0.25);
    rk.name = 'crags';
    g.add(rk);
  }

  // ── the door of the Sammath Naur: a mouth in a buttress of black rock,
  // facing out over the road; dark, and red deep inside
  const door = road.door.clone();
  {
    const out = V3(door.x, 0, door.z).normalize();
    const right = V3().crossVectors(UP, out);
    const frame = new THREE.Matrix4().makeBasis(right, UP, out).setPosition(door);
    const r = rng(1801);
    const block = (seed, [x0, x1], [y0, y1], [z0, z1], j = 0.6) => {
      const br = rng(seed);
      const pts = [];
      for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) pts.push(V3(x + (br() - 0.5) * j, y + (br() - 0.5) * j, z + (br() - 0.5) * j));
      for (let i = 0; i < 6; i++) pts.push(V3(mix(x0, x1, br()), mix(y0, y1, br()), mix(z0, z1, br())));
      return facet(new ConvexGeometry(pts));
    };
    const W = 2.25;
    const Hd = 6.4;
    const list = [
      block(11, [-9, -W - 0.05], [-1.5, 10], [-12, 1.2], 1.4),
      block(12, [W + 0.05, 9.5], [-1.5, 9], [-12, 1.4], 1.4),
      block(13, [-W - 1.2, W + 1.2], [Hd, 10], [-11, 1.6], 0.8),
      block(14, [-7, 6.5], [9.2, 12.5], [-13, 0.4], 2.2),
      block(15, [-4, 4], [-1.5, 9], [-18, -5.2], 1),
      block(16, [-14, -8], [-1.5, 6], [-10, 0.5], 2.2),
      block(17, [8, 14], [-1.5, 5], [-10, 0.8], 2.2),
    ];
    for (let i = 0; i < 9; i++) {
      const x = -11 + i * 2.8 + (r() - 0.5);
      const sz = 1.4 + r() * 2;
      list.push(hullRock(1820 + i, [sz, sz * (0.8 + r() * 0.8), sz * 1.1], [x, 8 + r() * 4 - Math.abs(x) * 0.25, -3 - r() * 6], 12));
    }
    // fangs hung over the mouth, a couple of fallen stones
    list.push(facet(spikeAt(V3(-1.2, Hd + 0.4, 1.0), V3(0.1, -1, 0.15), 1.5, 0.45, 4)));
    list.push(facet(spikeAt(V3(1.0, Hd + 0.4, 1.1), V3(-0.1, -1, 0.1), 1.1, 0.4, 4)));
    list.push(hullRock(1811, [1.2, 0.8, 1], [-4.6, 0.3, 3.4], 9), hullRock(1812, [0.8, 0.6, 0.9], [4.2, 0.2, 4.2], 9));
    const geo = oneGeo(list);
    tint(geo, (x, y, z, o, nx, ny) => {
      o.copy(DOOMC.rock).multiplyScalar(1.1 + noise3(n, x * 0.4, y * 0.4, z * 0.4) * 0.8);
      o.lerp(DOOMC.ash, smooth(0.5, 0.9, ny) * 0.5);
      // red-lit about the mouth
      const d = Math.hypot(x, (y - 3) * 0.8, Math.max(0, z - 0.5));
      o.lerp(DOOMC.ember, (1 - smooth(2, 6, d)) * 0.7);
    });
    geo.applyMatrix4(frame);
    boxUV(geo, 0.3);
    const portal = new THREE.Mesh(geo, mats.doomRock);
    portal.name = 'sammathNaurDoor';
    g.add(portal);
    // the dark inside, going in and down to the fire
    const ip = [];
    const ic = [];
    const D = 6;
    const quad = (a, b, c2, d) => ip.push(...a, ...b, ...c2, ...a, ...c2, ...d);
    quad([-W, 0, 0.6], [-W, 0, -D], [-W, Hd, -D], [-W, Hd, 0.6]);
    quad([W, 0, -D], [W, 0, 0.6], [W, Hd, 0.6], [W, Hd, -D]);
    quad([-W, Hd, 0.6], [-W, Hd, -D], [W, Hd, -D], [W, Hd, 0.6]);
    quad([-W, 0, -D], [-W, 0, 0.6], [W, 0, 0.6], [W, 0, -D]);
    quad([-W, 0, -D], [W, 0, -D], [W, Hd, -D], [-W, Hd, -D]);
    for (let i = 0; i < ip.length; i += 9) {
      // the far wall red-hot low down; the sides and floor darker
      const back = ip[i + 2] < -D + 0.01 && ip[i + 5] < -D + 0.01 && ip[i + 8] < -D + 0.01;
      for (let k = 0; k < 9; k += 3) {
        const z = ip[i + k + 2];
        const y = ip[i + k + 1];
        const deep = smooth(0.6, -D, z);
        if (back) _kc.setRGB(0.12, 0.015, 0.004).lerp(_kc2.setRGB(1.1, 0.22, 0.035), 1 - (y / Hd) * 0.9);
        else _kc.setRGB(0.006, 0.003, 0.002).lerp(_kc2.setRGB(0.32, 0.045, 0.008), deep * deep * deep * (1 - (y / Hd) * 0.6));
        ic.push(_kc.r, _kc.g, _kc.b);
      }
    }
    const inside = geoOf(ip, null);
    inside.setAttribute('color', new THREE.Float32BufferAttribute(ic, 3));
    inside.applyMatrix4(frame);
    const mouth = new THREE.Mesh(inside, mats.doorDark);
    mouth.name = 'doorDark';
    g.add(mouth);
    const glow = glowSprite(K.tex.glow, hot(0xff4a12, 1.0), 8, 0.35);
    glow.position.set(0, 2.6, -1).applyMatrix4(frame);
    g.add(glow);
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(9, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0xff3a10, 0.8), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    spill.position.set(0, 0.22, 2.4).applyMatrix4(frame);
    spill.quaternion.setFromRotationMatrix(frame);
    spill.renderOrder = 2;
    g.add(spill);
    void r;
  }

  // ── the plume: the reek going up out of the crater, leaning east, and a
  // little from the lesser cone; the glow of the fire on its underside
  const r = rng(1901);
  const emits = [];
  for (let i = 0; i < 64; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 34;
    emits.push(V3(Math.cos(a) * d, 300 + r() * 14, Math.sin(a) * d));
  }
  const plume = cardCloud(mats.plume, emits, 1903);
  plume.name = 'plume';
  g.add(plume);
  const vent = [];
  for (let i = 0; i < 7; i++) vent.push(V3(230 + (r() - 0.5) * 16, 300 + r() * 4, -170 + (r() - 0.5) * 16));
  for (const p of vent) p.y = shape.at(Math.hypot(p.x, p.z), Math.atan2(p.z, p.x))[0] + 2;
  const wisps = cardCloud(mats.ventSmoke, vent, 1905);
  wisps.name = 'ventSmoke';
  g.add(wisps);
  const craterGlow = glowSprite(K.tex.glow, hot(0xff4410, 0.7), 320, 0.55);
  craterGlow.position.set(0, 345, 0);
  g.add(craterGlow);
  // fire thrown up out of the crater, when it erupts
  const fountainPts = [];
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * 28;
    fountainPts.push(V3(Math.cos(a) * d, 300, Math.sin(a) * d));
  }
  const fountain = cardCloud(mats.fountain, fountainPts, 1907);
  fountain.name = 'fountain';
  g.add(fountain);
  const bombs = bombCloud(mats.bombs, 70, V3(0, 306, 0), 26, 1909);
  bombs.name = 'bombs';
  g.add(bombs);

  const update = (t, { erupt = 0 } = {}) => {
    const e = clamp01(erupt);
    U.uTime.value = t;
    U.uErupt.value = e;
    mats.doom.userData.glow.value = 1 + e * 1.8;
    mats.doomLava.uniforms.uHeat.value = 1.05 + e * 0.5;
    mats.doomLake.uniforms.uHeat.value = 1.2 + e * 0.6;
    mats.fountain.uniforms.uK.value = e * 1.3;
    mats.bombs.uniforms.uK.value = smooth(0.05, 0.4, e);
    mats.bombs.userData.fit(K.renderer);
    const f = 0.9 + 0.1 * Math.sin(t * 1.7) * Math.sin(t * 0.73 + 1);
    craterGlow.material.opacity = (0.45 + 0.5 * e) * f;
    craterGlow.scale.setScalar(320 + 260 * e);
    fountain.visible = e > 0.01;
    bombs.visible = e > 0.01;
  };
  update(0);
  return {
    group: g,
    door,
    road: (k) => road.curve.getPointAt(clamp01(k)).add(V3(0, 0.17, 0)),
    roadLength: road.length,
    groundAt: (x, z) => surface(x, z),
    update,
  };
}

// ── Barad-dûr ──

// A wedge-sectioned fin: rows [y, rIn, rOut, halfThick] up it, the blade's
// edge out along +x, its back against the tower. Turned to `a` about y.
function finGeo(rows, a) {
  const pos = [];
  const idx = [];
  rows.forEach(([y, ri, ro, h]) => pos.push(ri, y, -h, ro, y, 0, ri, y, h));
  for (let i = 0; i < rows.length - 1; i++) {
    const b = i * 3;
    idx.push(b, b + 3, b + 1, b + 1, b + 3, b + 4, b + 1, b + 4, b + 2, b + 2, b + 4, b + 5);
  }
  const t = (rows.length - 1) * 3;
  idx.push(t, t + 1, t + 2);
  const g = geoOf(pos, idx);
  g.rotateY(-a);
  return facet(g);
}

// Barad-dûr: the Dark Tower, 420 m to the tips of its crown. A great
// plinth on the rock; black tiers narrowing up, each turned against the
// one below and fringed with spikes, ribbed all over; blade buttresses
// sweeping out and down from its flanks like roots; needle spires; and at
// the top the two horns of its crown curving out and in, the Eye between
// them at eyeAt, wreathed in fire, its beam thrown down to the ground.
// The horns open to ±x, so it is best seen from ±z. aim(target) points the
// beam at a world point; doom (world, default the origin) is where the Eye
// turns at the last: update(t, { k, look }), k how fierce, look 0..1.
function baradDur(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'baradDur';
  const eyeAt = V3(0, 394, 0);
  const n = makeNoise(2101);
  const r = rng(2101);
  const T = [];
  const oct = (y0, y1, r0, r1, turn, sides = 8) => T.push(new THREE.CylinderGeometry(r1, r0, y1 - y0, sides, 1).rotateY(turn).translate(0, (y0 + y1) / 2, 0));
  // the plinth, and the rock it stands on
  oct(-12, 6, 104, 92, 0.2, 10);
  oct(6, 22, 84, 74, 0.5, 8);
  const TIERS = [
    [22, 90, 62, 52],
    [90, 100, 57, 57],
    [100, 180, 47, 39],
    [180, 189, 43, 43],
    [189, 262, 35, 28],
    [262, 269, 31, 31],
    [269, 326, 25, 19.5],
    [326, 332, 22, 22],
    [332, 366, 17.5, 13],
    [366, 372, 15, 15],
  ];
  TIERS.forEach(([y0, y1, r0, r1], i) => {
    const turn = (Math.floor(i / 2) % 2) * (Math.PI / 8);
    oct(y0, y1, r0, r1, turn);
    const cornice = i % 2 === 1;
    if (cornice) {
      // a fringe of spikes about the ledge, leaning out
      const count = Math.round(r0 * 0.5);
      for (let j = 0; j < count; j++) {
        const a = (j / count) * TAU + turn;
        const len = 5 + (j % 3) * 3 + r() * 3;
        T.push(spikeAt(V3(Math.cos(a) * r0 * 0.96, y1 - 0.5, Math.sin(a) * r0 * 0.96), V3(Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35), len, 1 + r0 * 0.012, 4));
      }
    } else {
      // ribs up its faces, the tower's grain
      const ribs = 16;
      for (let j = 0; j < ribs; j++) {
        const a = (j / ribs) * TAU + turn + Math.PI / ribs;
        const rr0 = r0 * Math.cos(Math.PI / 8) + 0.5;
        const rr1 = r1 * Math.cos(Math.PI / 8) + 0.5;
        const h = y1 - y0;
        const rib = new THREE.CylinderGeometry(1.4, 1.9, h, 3).rotateY(-a);
        const p = rib.attributes.position;
        for (let v = 0; v < p.count; v++) {
          const k = (p.getY(v) + h / 2) / h;
          const rr = mix(rr0, rr1, k);
          p.setX(v, p.getX(v) + Math.cos(a) * rr);
          p.setZ(v, p.getZ(v) + Math.sin(a) * rr);
        }
        rib.translate(0, (y0 + y1) / 2, 0);
        T.push(rib);
      }
    }
  });
  // the great buttresses, blades sweeping out from its flanks to the rock
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const H = 300;
    const rows = [];
    for (let k = 0; k <= 12; k++) {
      const y = 8 + (k / 12) * (H - 8);
      const f = (y - 8) / (H - 8);
      rows.push([y, Math.max(12, prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] - 6), prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] + 4 + 64 * Math.pow(1 - f, 3.2) + 4 * (1 - f), 8 * (1 - f) + 1.8]);
    }
    T.push(finGeo(rows, a));
    // hooked spurs along its edge
    for (let k = 1; k < 11; k += 2) {
      const [y, , ro] = rows[k];
      T.push(spikeAt(V3(Math.cos(a) * (ro - 2), y, Math.sin(a) * (ro - 2)), V3(Math.cos(a), 0.9, Math.sin(a)), 9 + (k % 3) * 3, 2.2, 4));
    }
    // and lesser blades between, not so high
    const b = a + Math.PI / 8;
    const rows2 = [];
    for (let k = 0; k <= 8; k++) {
      const y = 8 + (k / 8) * 170;
      const f = k / 8;
      rows2.push([y, Math.max(12, prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] - 6), prof(TIERS.map(([y0, , r0]) => [y0, r0]), y)[0] + 2 + 40 * Math.pow(1 - f, 2.6), 5 * (1 - f) + 1.4]);
    }
    T.push(finGeo(rows2, b));
  }
  // needle spires about its upper tiers
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    const rr = i % 2 ? 31 : 22;
    const y = i % 2 ? 252 : 320;
    T.push(spikeAt(V3(Math.cos(a) * rr, y - 4, Math.sin(a) * rr), V3(Math.cos(a) * 0.06, 1, Math.sin(a) * 0.06), i % 2 ? 62 : 38, i % 2 ? 4.5 : 3.2, 4));
  }
  // the crown: two horns, out and up and in, spurred along their backs
  for (const sd of [-1, 1]) {
    const P = [[sd * 10, 364, 0], [sd * 22, 376, 0], [sd * 30, 393, 0], [sd * 26, 409, 0], [sd * 12, 421, 0]];
    T.push(sweep(P, [[7, 9], [6, 7], [4.6, 5], [3, 3.2], [0.5, 0.5]], { seg: 16, radial: 7, side: [0, 0, 1] }));
    for (let k = 0; k < 6; k++) {
      const f = 0.12 + k * 0.15;
      const c = new THREE.CatmullRomCurve3(P.map((p) => V3(...p))).getPoint(f);
      T.push(spikeAt(c, V3(sd * 1, 0.5 - k * 0.12, (k % 2 ? 0.4 : -0.4)), 10 - k * 0.8, 1.6, 4));
    }
    // a lesser horn below each, the crown's outer points
    T.push(sweep([[sd * 14, 360, 9], [sd * 24, 368, 13], [sd * 32, 382, 12]], [[3.5], [2.4], [0.3]], { seg: 8, radial: 5 }));
    T.push(sweep([[sd * 14, 360, -9], [sd * 24, 368, -13], [sd * 32, 382, -12]], [[3.5], [2.4], [0.3]], { seg: 8, radial: 5 }));
  }
  // the cup between the horns
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    T.push(spikeAt(V3(Math.cos(a) * 12, 368, Math.sin(a) * 12), V3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5), 7 + (i % 2) * 5, 1.6, 4));
  }
  const geo = oneGeo(T.map((x) => (x.index ? facet(x) : x)), ['heat']);
  const to = V3();
  const heat = geo.attributes.heat;
  const nr = geo.attributes.normal;
  const p = geo.attributes.position;
  const col = geo.attributes.color;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const ny = nr.getY(i);
    _kc.setRGB(0.05, 0.043, 0.042).multiplyScalar(0.75 + noise3(n, x * 0.05, y * 0.05, z * 0.05) * 0.6);
    if (ny > 0.55) _kc.lerp(_kc2.setRGB(0.12, 0.1, 0.095), 0.6);
    col.setXYZ(i, _kc.r, _kc.g, _kc.b);
    // the Eye's fire on the stone about it
    to.set(eyeAt.x - x, eyeAt.y - y, eyeAt.z - z);
    const d = to.length();
    const facing = Math.max(0, (nr.getX(i) * to.x + ny * to.y + nr.getZ(i) * to.z) / d);
    heat.setX(i, Math.min(1, Math.exp(-d / 40) * (0.35 + 0.95 * facing)));
  }
  boxUV(geo, 0.05);
  const tower = new THREE.Mesh(geo, mats.tower);
  tower.name = 'darkTower';
  g.add(tower);

  // the Eye
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), mats.eye);
  eye.position.copy(eyeAt);
  eye.renderOrder = 8;
  eye.frustumCulled = false;
  eye.name = 'eyeOfSauron';
  g.add(eye);

  // the beam, from the Eye down to where it is aimed, and its pool of light
  const beamGeo = new THREE.CylinderGeometry(1, 0.12, 1, 28, 10, true).translate(0, 0.5, 0).rotateX(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, mats.beam);
  beam.name = 'eyeBeam';
  beam.renderOrder = 7;
  beam.frustumCulled = false;
  g.add(beam);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mats.beamPool);
  pool.renderOrder = 7;
  pool.name = 'beamPool';
  g.add(pool);
  const RADIUS = 24;
  const aimed = V3(0, 0, 600);
  const doom = V3(0, 0, 0);
  const tmp = V3();
  const at = V3();
  const Z = V3(0, 0, 1);
  let look = 0;
  const place = () => {
    g.updateWorldMatrix(true, false);
    tmp.copy(doom);
    g.worldToLocal(tmp);
    at.copy(aimed).lerp(tmp, smooth(0, 1, look));
    const dir = tmp.subVectors(at, eyeAt);
    const L = Math.max(1, dir.length());
    beam.position.copy(eyeAt);
    beam.quaternion.setFromUnitVectors(Z, dir.divideScalar(L));
    beam.scale.set(RADIUS, RADIUS, L);
    pool.position.copy(at).add(V3(0, 0.4, 0));
    pool.scale.set(RADIUS * 3, 1, RADIUS * 3);
    mats.eye.uniforms.uGazeAt.value.copy(at);
    g.localToWorld(mats.eye.uniforms.uGazeAt.value);
  };
  const aim = (target) => {
    g.updateWorldMatrix(true, false);
    aimed.copy(target);
    g.worldToLocal(aimed);
    place();
  };
  const update = (t, { k = 1, look: lk = 0 } = {}) => {
    const kk = clamp01(k);
    U.uTime.value = t;
    look = clamp01(lk);
    mats.eye.uniforms.uK.value = kk;
    mats.eye.uniforms.uFix.value = 0.55 + 0.45 * look;
    mats.beam.uniforms.uK.value = 0.4 + 0.8 * kk;
    mats.beamPool.opacity = 0.35 + 0.4 * kk;
    mats.tower.userData.glow.value = 0.45 + 0.9 * kk;
    place();
  };
  update(0);
  return { group: g, eyeAt: eyeAt.clone(), eye, beam, doom, aim, update };
}

// ── the plain of Gorgoroth ──

const ASH = { base: C(0x2e2a28), dark: C(0x121010), ash: C(0x6e6660), rust: C(0x5a3020), pale: C(0x8a827a) };

// A boulder of the plain, about 2.5 m across and 1.4 high: broken
// flat-faced basalt, ash lying grey on whatever faces up. One geometry.
function ashRockGeo(seed = 1) {
  const r = rng(seed * 7 + 3);
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
  const sx = 1.15 + r() * 0.2;
  const sz = 0.95 + r() * 0.25;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 3 }) - 0.5) * 0.6);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    v.set(v.x * sx * 1.12, v.y * 0.95 + 0.42, v.z * sz * 1.12);
    if (v.y < -0.1) v.y = -0.1 + (v.y + 0.1) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = facet(g);
  boxUV(g, 0.6);
  tint(g, (x, y, z, out, nx, ny) => {
    out.copy(ASH.base).multiplyScalar(0.8 + noise3(n, x * 2, y * 2, z * 2) * 0.6);
    out.lerp(ASH.ash, smooth(0.3, 0.75, ny) * 0.7);
    out.lerp(ASH.rust, smooth(0.62, 0.74, noise3(n, x * 1.3 + 7, y * 1.3, z * 1.3)) * 0.35);
    out.lerp(ASH.dark, (1 - smooth(-0.1, 0.5, y)) * 0.45);
  });
  g.computeBoundingSphere();
  return g;
}

// A fang of rock about 4 m high: a few blade-thin shards leaning together,
// flat-faced and sharp, black with ash on their ledges. One geometry.
function spikeGeo(seed = 1) {
  const r = rng(seed * 13 + 1);
  const n = makeNoise(seed + 3);
  const list = [];
  const count = 3 + Math.floor(r() * 3);
  for (let k = 0; k < count; k++) {
    const main = k === 0;
    const H = main ? 3.8 + r() * 0.6 : 1.2 + r() * 2;
    const R = main ? 0.8 : 0.35 + r() * 0.4;
    const a = r() * TAU;
    const off = main ? 0 : 0.45 + r() * 0.5;
    const bx = Math.cos(a) * off;
    const bz = Math.sin(a) * off;
    const lx = (r() - 0.5) * 0.3 + (main ? 0 : Math.cos(a) * 0.3);
    const lz = (r() - 0.5) * 0.3 + (main ? 0 : Math.sin(a) * 0.3);
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
  boxUV(g, 0.5);
  tint(g, (x, y, z, out, nx, ny) => {
    const v = noise3(n, x * 1.2, y * 1.2, z * 1.2);
    out.copy(ASH.base).multiplyScalar(0.7 + v * 0.6);
    out.lerp(ASH.dark, clamp01(0.6 - y * 0.3) * 0.6);
    if (ny > 0.4) out.lerp(ASH.ash, 0.55);
    out.lerp(ASH.rust, smooth(0.62, 0.72, noise3(n, x * 2 + 4, y * 2, z * 2)) * 0.35);
  });
  g.computeBoundingSphere();
  return g;
}

// ── the orcs ──

const ORC = {
  skin: [C(0x5e5a54), C(0x56544c), C(0x625a52), C(0x4e4c48)],
  blotch: C(0x2e2a26),
  green: C(0x50544a),
  scar: C(0x8a7e74),
  iron: C(0x1c1c1e),
  rust: C(0x3e2618),
  leather: C(0x2a2018),
  rag: C(0x2e2824),
  hair: C(0x0c0a09),
  tooth: C(0xb0a070),
  eye: C(0xd8a830),
  wood: C(0x2e2218),
  bone: C(0xb8ac90),
};
// Bones: [parent, position]. The figure faces +x, its right side +z.
const ORC_BONES = {
  hips: [null, [0, 0.76, 0]],
  legL: ['hips', [0, -0.02, -0.12]],
  legR: ['hips', [0, -0.02, 0.12]],
  shinL: ['legL', [0.05, -0.36, 0]],
  shinR: ['legR', [0.05, -0.36, 0]],
  body: ['hips', [0, 0.05, 0]],
  head: ['body', [0.1, 0.52, 0]],
  armL: ['body', [0.02, 0.43, -0.25]],
  armR: ['body', [0.02, 0.43, 0.25]],
  foreL: ['armL', [0, -0.3, 0]],
  foreR: ['armR', [0, -0.3, 0]],
  hand: ['foreR', [0, -0.3, 0]],
};
function orcRig(root) {
  const b = {};
  for (const [name, [parent, p]] of Object.entries(ORC_BONES)) b[name] = bone(name, parent ? b[parent] : root, p);
  return b;
}

// Mottled grey orc-hide: blotches, a sickly green here and there.
function orcSkin(n, base) {
  return (x, y, z, out) => {
    const m = noise3(n, x * 14, y * 14, z * 14);
    out.copy(base).multiplyScalar(0.75 + m * 0.5);
    out.lerp(ORC.blotch, smooth(0.55, 0.72, noise3(n, x * 6 + 3, y * 6, z * 6)) * 0.7);
    out.lerp(ORC.green, smooth(0.5, 0.7, noise3(n, x * 3 + 9, y * 3, z * 3)) * 0.4);
  };
}
// Black iron, rust bleeding from its edges.
function orcIron(n) {
  return (x, y, z, out) => {
    out.copy(ORC.iron).multiplyScalar(0.8 + noise3(n, x * 20, y * 20, z * 20) * 0.5);
    out.lerp(ORC.rust, smooth(0.58, 0.75, noise3(n, x * 9 + 5, y * 9, z * 9)) * 0.7);
  };
}

// The parts of an orc, each in its bone's frame: [bone, geo, colour, metal].
// `low` for the marching column: a few hundred triangles in all.
function orcParts(seed, { slaver = false, low = false, weapon = 'spear' } = {}) {
  const r = rng(seed * 31 + 7);
  const n = makeNoise(seed * 7 + 11);
  const out = [];
  const R = low ? 5 : 10;
  const S = low ? 2 : 6;
  const D = low ? 0 : 1;
  const W = slaver ? 1.15 : 1;
  const skin = orcSkin(n, ORC.skin[seed % ORC.skin.length]);
  const iron = orcIron(n);
  const put = (b, geo, colour, metal = 0) => out.push([b, geo, colour, metal]);
  const caps = low ? [false, false] : [true, true];
  // the legs: wrapped in rags and leather, bowed; iron on the shins
  for (const s of ['L', 'R']) {
    put(`leg${s}`, sweep([[0, 0.04, 0], [0.03, -0.18, 0], [0.05, -0.36, 0]], [[0.088 * W], [0.074 * W], [0.06 * W]], { seg: S, radial: R, caps }), ORC.leather);
    put(`shin${s}`, sweep([[0, 0, 0], [-0.01, -0.17, 0], [-0.03, -0.33, 0]], [[0.06 * W], [0.052 * W], [0.046 * W]], { seg: S, radial: R, caps }), skin);
    put(`shin${s}`, lump(0.075 * W, { p: [0.02, -0.36, 0], s: [1.75, 0.7, 1.0] }, { detail: D, amp: 0.06, seed: 3 }), ORC.leather);
    if (!low) {
      put(`shin${s}`, new THREE.CylinderGeometry(0.066 * W, 0.058 * W, 0.2, 8, 1, true, -Math.PI / 2 - 1.3, 2.6).translate(-0.012, -0.17, 0), iron, 1);
      put(`leg${s}`, new THREE.TorusGeometry(0.08 * W, 0.012, 3, 10).rotateX(Math.PI / 2).translate(0.02, -0.1, 0), ORC.leather);
      put(`leg${s}`, new THREE.TorusGeometry(0.068 * W, 0.012, 3, 10).rotateX(Math.PI / 2).translate(0.04, -0.27, 0), ORC.leather);
      for (const dz of [-0.035, 0, 0.035]) put(`shin${s}`, new THREE.ConeGeometry(0.012, 0.06, 4).rotateZ(-Math.PI / 2).translate(0.13 * W, -0.38, dz), ORC.hair);
    }
  }
  // the body, hunched, a hump on the back; iron over the chest; a skirt of
  // leather strips; a belt
  const rows = [[0.14, 0.17, 0.13], [0.16, 0.2, 0.15], [0.17, 0.24, 0.17], [0.11, 0.2, 0.12]].map((x) => x.map((v) => v * W));
  const chest = (x, y, z, o) => (x > 0.06 && y > 0.12 ? iron(x, y, z, o) : skin(x, y, z, o));
  put('body', sweep([[0, -0.02, 0], [0.02, 0.2, 0], [0.03, 0.38, 0], [0.0, 0.5, 0]], rows, { seg: low ? 3 : 8, radial: low ? 6 : 12, caps }), low ? chest : skin);
  put('body', lump(0.13 * W, { p: [-0.1, 0.38, 0], s: [1, 0.8, 1.4] }, { detail: D, amp: 0.08, seed: 5 }), skin);
  put('body', new THREE.CylinderGeometry(0.19 * W, 0.24 * W, 0.26, low ? 6 : 12, 1, true).translate(0, -0.12, 0), ORC.rag);
  if (!low) {
    const plate = sweep([[0.012, 0.1, 0], [0.025, 0.25, 0], [0.034, 0.4, 0], [0.01, 0.5, 0]], [[0.168, 0.212, 0.1], [0.18, 0.25, 0.1], [0.12, 0.215, 0.1], [0.12, 0.2, 0.1]].map((x) => x.map((v) => v * W)), { seg: 6, radial: 12, caps: [false, false] });
    const keep = plate.toNonIndexed();
    const pp = keep.attributes.position;
    const kept = [];
    for (let i = 0; i < pp.count; i += 3) {
      if ((pp.getX(i) + pp.getX(i + 1) + pp.getX(i + 2)) / 3 > 0.04) for (let k = 0; k < 3; k++) kept.push(pp.getX(i + k), pp.getY(i + k), pp.getZ(i + k));
    }
    put('body', facet(geoOf(kept, null)), iron, 1);
    for (let i = 0; i < 5; i++) put('body', new THREE.SphereGeometry(0.012, 4, 3).translate(0.19 * W, 0.18 + i * 0.06, (i % 2 ? 1 : -1) * 0.08), iron, 1);
    put('body', new THREE.TorusGeometry(0.205 * W, 0.022, 4, 14).rotateX(Math.PI / 2).scale(1, 1, 1.1).translate(0.01, 0.0, 0), ORC.leather);
    put('body', new THREE.BoxGeometry(0.05, 0.06, 0.08).translate(0.2 * W, 0, 0), iron, 1);
    // the skirt torn into strips
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      put('body', new THREE.BoxGeometry(0.012, 0.22 + r() * 0.08, 0.1).rotateY(-a).translate(Math.cos(a) * 0.235 * W, -0.2, Math.sin(a) * 0.235 * W), i % 2 ? ORC.leather : ORC.rag);
    }
    // the neck, thick, thrust forward
    put('body', rod([0.02, 0.44, 0], [0.12, 0.56, 0], 0.075 * W, 0.065 * W, 8), skin);
  } else {
    put('body', rod([0.02, 0.44, 0], [0.12, 0.56, 0], 0.075, 0.065, 4), skin);
  }
  // a spiked iron pauldron on the left shoulder (both, on the slaver)
  for (const sd of slaver ? [-1, 1] : [-1]) {
    put('body', new THREE.SphereGeometry(0.12 * W, low ? 5 : 9, low ? 2 : 4, 0, TAU, 0, Math.PI * 0.5).scale(1.1, 0.8, 1).rotateX(sd * 0.5).translate(0.0, 0.45, sd * 0.25 * W), iron, 1);
    if (!low) for (let i = 0; i < 3; i++) put('body', spikeAt(V3(-0.04 + i * 0.04, 0.52, sd * (0.27 + i * 0.01) * W), V3(-0.2, 1, sd * 0.4), 0.09 + i * 0.02, 0.016, 4), iron, 1);
  }
  if (slaver && !low) {
    // a harness of straps over his bare shoulders
    for (const sd of [-1, 1]) put('body', sweep([[0.17, 0.05, sd * -0.1], [0.2, 0.3, sd * 0.05], [0.1, 0.5, sd * 0.16], [-0.12, 0.42, sd * 0.12], [-0.16, 0.1, sd * -0.08]], [[0.012, 0.03]], { seg: 14, radial: 4 }), ORC.leather);
  }

  // the head: a big low skull, a heavy brow, a jaw like a trap and tusks
  // up out of it, a flat nose, ears like blades; small yellow eyes
  const hs = slaver ? 1.08 : 1;
  const hd = (geo) => geo.scale(hs, hs, hs);
  put('head', hd(lump(0.115, { p: [0.0, 0.07, 0], s: [1.15, 0.95, 0.95] }, { detail: low ? 0 : 2, amp: 0.06, seed: 7 })), skin);
  put('head', hd(lump(0.08, { p: [0.09, -0.03, 0], s: [0.95, 0.7, 1.05] }, { detail: D, amp: 0.05, seed: 8 })), skin);
  if (!low) {
    put('head', hd(lump(0.07, { p: [0.09, 0.09, 0], s: [0.55, 0.35, 1.3] }, { detail: 1, amp: 0.05, seed: 9 })), (x, y, z, o) => skin(x, y, z, o.copy(ORC.blotch)));
    put('head', hd(lump(0.085, { p: [0.11, -0.08, 0], s: [0.75, 0.42, 1.0] }, { detail: 1, amp: 0.05, seed: 10 })), skin);
    put('head', hd(lump(0.03, { p: [0.165, 0.025, 0], s: [0.7, 0.6, 1.0] }, { detail: 1, amp: 0.05, seed: 11 })), skin);
    for (const sd of [-1, 1]) {
      put('head', hd(new THREE.ConeGeometry(0.013, 0.06, 4).translate(0.17, -0.04, sd * 0.04).rotateZ(0)), ORC.tooth);
      put('head', hd(new THREE.SphereGeometry(0.013, 6, 4).translate(0.142, 0.05, sd * 0.042)), ORC.eye);
      put('head', hd(new THREE.ConeGeometry(0.035, 0.15, 4).scale(1, 1, 0.35).rotateX(sd * 1.25).rotateY(sd * 0.5).translate(-0.01, 0.07, sd * 0.11)), skin);
      put('head', hd(new THREE.SphereGeometry(0.006, 4, 3).translate(0.185, 0.02, sd * 0.012)), ORC.hair);
    }
    for (let i = 0; i < 4; i++) put('head', hd(new THREE.ConeGeometry(0.007, 0.022, 3).translate(0.165, -0.045, (i - 1.5) * 0.017)), ORC.tooth);
  } else {
    for (const sd of [-1, 1]) put('head', new THREE.ConeGeometry(0.035, 0.15, 3).scale(1, 1, 0.35).rotateX(sd * 1.25).translate(-0.01, 0.07, sd * 0.11), skin);
  }
  const helm = slaver ? 3 : low ? 1 : seed % 3;
  if (helm === 0) {
    // bare-headed: lank black hair down the back of the skull
    for (let i = 0; i < 7; i++) {
      const z = (i / 6 - 0.5) * 0.14;
      put('head', tube([[0.04, 0.17, z * 0.6], [-0.06, 0.15, z], [-0.13, 0.05, z * 1.2], [-0.15, -0.12 - r() * 0.08, z * 1.3]], 0.012, 0.004, { seg: 6, radial: 3 }), ORC.hair);
    }
  } else {
    put('head', hd(new THREE.SphereGeometry(0.128, low ? 6 : 12, low ? 2 : 5, 0, TAU, 0, Math.PI * 0.52).scale(1.12, 0.9, 1.02).translate(0.0, 0.09, 0)), iron, 1);
    if (!low) {
      put('head', hd(new THREE.BoxGeometry(0.02, 0.1, 0.022).translate(0.15, 0.06, 0)), iron, 1);
      put('head', hd(new THREE.TorusGeometry(0.13, 0.01, 3, 16).rotateX(Math.PI / 2).scale(1.12, 1, 1.02).translate(0, 0.09, 0)), iron, 1);
    }
    if (helm === 1) put('head', hd(spikeAt(V3(-0.01, 0.19, 0), V3(-0.25, 1, 0), 0.12, 0.022, 4)), iron, 1);
    if (helm === 2) {
      for (const sd of [-1, 1]) put('head', hd(new THREE.BoxGeometry(0.08, 0.1, 0.012).rotateY(sd * 0.25).translate(0.09, 0.02, sd * 0.12)), iron, 1);
      for (let i = 0; i < 3; i++) put('head', hd(spikeAt(V3(0.06 - i * 0.06, 0.19 - i * 0.012, 0), V3(-0.3, 1, 0), 0.06 + i * 0.015, 0.012, 3)), iron, 1);
    }
    if (helm === 3) {
      // the slave-driver's: horns swept back
      for (const sd of [-1, 1]) put('head', hd(tube([[0.02, 0.15, sd * 0.09], [-0.05, 0.25, sd * 0.15], [-0.17, 0.27, sd * 0.17], [-0.25, 0.2, sd * 0.16]], 0.026, 0.004, { seg: 10, radial: 6 })), C(0x2a241e));
    }
  }

  // the arms, long; leather bracers; clawed hands
  for (const s of ['L', 'R']) {
    put(`arm${s}`, sweep([[0, 0.02, 0], [0.005, -0.15, 0], [0, -0.3, 0]], [[0.068 * W], [0.058 * W], [0.05 * W]], { seg: S, radial: R, caps }), skin);
    put(`fore${s}`, sweep([[0, 0, 0], [0.004, -0.15, 0], [0, -0.3, 0]], [[0.05 * W], [0.046 * W], [0.04 * W]], { seg: S, radial: R, caps }), skin);
    if (!low) put(`fore${s}`, new THREE.CylinderGeometry(0.052 * W, 0.046 * W, 0.16, 8, 1, true).translate(0, -0.17, 0), ORC.leather);
    const hb = s === 'R' ? 'hand' : 'foreL';
    const hy = s === 'R' ? 0 : -0.3;
    put(hb, lump(0.045 * W, { p: [0.008, hy - 0.04, 0], s: [0.9, 1.2, 0.8] }, { detail: D, amp: 0.05, seed: 12 }), skin);
    if (!low) {
      for (let f = 0; f < 4; f++) {
        const z = (f - 1.5) * 0.017;
        put(hb, tube([[0.01, hy - 0.07, z], [0.03, hy - 0.11, z * 1.1], [0.015, hy - 0.15, z * 1.2]], 0.011, 0.004, { seg: 4, radial: 4 }), skin);
        put(hb, new THREE.ConeGeometry(0.005, 0.025, 3).rotateZ(Math.PI - 0.5).translate(0.008, hy - 0.16, z * 1.2), ORC.hair);
      }
    }
  }

  // what he carries, in his right fist
  if (weapon === 'spear') {
    put('hand', new THREE.CylinderGeometry(0.016, 0.016, 2.1, low ? 4 : 6).translate(0, 0.32, 0), ORC.wood);
    put('hand', new THREE.ConeGeometry(0.045, 0.32, low ? 4 : 4).scale(1, 1, 0.3).translate(0, 1.52, 0), iron, 1);
    if (!low) {
      for (const sd of [-1, 1]) put('hand', spikeAt(V3(0, 1.4, 0), V3(sd * 0.6, -1, 0), 0.08, 0.012, 3), iron, 1);
      put('hand', new THREE.CylinderGeometry(0.022, 0.022, 0.08, 6).translate(0, 1.36, 0), ORC.leather);
    }
  } else if (weapon === 'blade') {
    const sh = new THREE.Shape();
    sh.moveTo(-0.022, 0);
    sh.quadraticCurveTo(-0.04, 0.35, 0.03, 0.66);
    sh.lineTo(0.06, 0.6);
    sh.lineTo(0.05, 0.52);
    sh.quadraticCurveTo(0.055, 0.25, 0.03, 0);
    const blade = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }).translate(0, 0.06, -0.006);
    put('hand', blade, iron, 1);
    put('hand', new THREE.BoxGeometry(0.1, 0.025, 0.04).translate(0.005, 0.06, 0), iron, 1);
    put('hand', new THREE.CylinderGeometry(0.018, 0.018, 0.14, 6).translate(0, -0.02, 0), ORC.leather);
  } else if (weapon === 'whip') {
    put('hand', new THREE.CylinderGeometry(0.02, 0.016, 0.34, 6).rotateZ(Math.PI / 2 + 0.25).translate(0.1, -0.06, 0), ORC.leather);
    put('hand', new THREE.SphereGeometry(0.025, 6, 4).translate(-0.06, -0.02, 0), iron, 1);
  }
  return out;
}

// The orcs' march and stance. The spear is carried upright; the slaver's
// whip arm swings up and back and lashes down (lash 0..1).
function orcPose(b, t, { marching = false, lash = 0, slaver = false, phase = 0 } = {}) {
  const w = marching ? 1 : 0;
  const ph = t * 6.8 + phase;
  const sw = Math.sin(ph) * w;
  const breathe = Math.sin(t * 1.9 + phase);
  b.legL.rotation.z = 0.12 + sw * 0.48;
  b.legR.rotation.z = 0.12 - sw * 0.48;
  b.shinL.rotation.z = -0.32 - Math.max(0, -Math.cos(ph)) * 0.6 * w;
  b.shinR.rotation.z = -0.32 - Math.max(0, Math.cos(ph)) * 0.6 * w;
  b.hips.position.y = 0.74 + (Math.abs(Math.cos(ph)) - 1) * 0.035 * w;
  b.hips.rotation.y = sw * 0.08;
  b.body.rotation.set(Math.sin(ph) * 0.04 * w, -sw * 0.12, -0.42 - 0.06 * w + breathe * 0.015);
  b.head.rotation.set(0, Math.sin(t * 0.6 + phase) * 0.35 * (1 - w), 0.38 + 0.05 * w);
  b.armL.rotation.set(-0.15, 0, -sw * 0.5 + 0.25);
  b.foreL.rotation.z = 0.35 + Math.max(0, sw) * 0.3;
  if (slaver) {
    const L = clamp01(lash);
    const up = smooth(0, 0.35, L);
    const down = smooth(0.35, 0.62, L);
    const back = smooth(0.62, 1, L);
    const a = mix(mix(mix(0.3 + sw * 0.4, 3.6, up), 0.75, down), 0.3 + sw * 0.4, back);
    b.armR.rotation.set(0.15 + 0.2 * up * (1 - down), 0, a);
    b.foreR.rotation.z = mix(mix(mix(0.4, 1.3, up), 0.15, down), 0.4, back);
    b.body.rotation.z += -0.18 * down * (1 - back) + 0.1 * up * (1 - down);
    b.hand.rotation.set(0, 0, mix(mix(0, -0.5, up), 0.4, down) * (1 - back));
  } else {
    b.armR.rotation.set(-0.1, 0, 0.55 + sw * 0.05);
    b.foreR.rotation.z = 1.05;
    const held = b.body.rotation.z + b.armR.rotation.z + b.foreR.rotation.z;
    b.hand.rotation.set(0.1, 0, -held + 0.08);
  }
}

// A Mordor orc, about 1.5 m, hunched and long in the arm: mottled grey
// skin, black iron on his chest, shoulder, shins and head, leather and
// rags; a barbed spear (or a jagged blade). The slaver (slaver: true) is
// bigger, 1.9 m, horned and harnessed, with a whip. Faces +x, on y = 0.
// animate(t, { marching, lash }), lash 0..1 cracking the whip.
function orc(K, seed = 1, { slaver = false } = {}) {
  const mat = K.mats.orcFlesh;
  const g = new THREE.Group();
  g.name = slaver ? 'orcSlaver' : 'orc';
  const root = bone('root', g);
  const b = orcRig(root);
  const weapon = slaver ? 'whip' : seed % 4 === 3 ? 'blade' : 'spear';
  const byBone = new Map();
  for (const [name, geo, colour, metal] of orcParts(seed, { slaver, weapon })) {
    if (!byBone.has(name)) byBone.set(name, []);
    const gg = typeof colour === 'function' ? tint(geo, colour) : solid(geo, colour);
    const m = new Float32Array(gg.attributes.position.count).fill(metal);
    gg.setAttribute('metal', new THREE.BufferAttribute(m, 1));
    byBone.get(name).push(gg);
  }
  for (const [name, list] of byBone) {
    const mesh = new THREE.Mesh(oneGeo(list, ['metal']), mat);
    mesh.name = name;
    b[name].add(mesh);
  }
  const scale = slaver ? 1.9 / 1.5 : 1;
  root.scale.setScalar(scale * (slaver ? 1 : 0.96 + (seed % 5) * 0.02));
  const phase = seed * 1.7;
  let whip = null;
  if (slaver) {
    // the lash: a tapering cord rewritten each frame from the whip's handle
    const SEG = 22;
    const RAD = 5;
    const Wd = RAD + 1;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((SEG + 1) * Wd * 3);
    const idx = [];
    for (let k = 0; k < SEG; k++) for (let j = 0; j < RAD; j++) {
      const a = k * Wd + j;
      idx.push(a, a + Wd, a + 1, a + 1, a + Wd, a + Wd + 1);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(pos.length), 3));
    geo.setIndex(idx);
    const lashMesh = new THREE.Mesh(geo, K.mats.lash);
    lashMesh.frustumCulled = false;
    lashMesh.name = 'lash';
    g.add(lashMesh);
    const tipFlash = glowSprite(K.tex.glow, hot(0xfff0d0, 2), 0.35, 0);
    g.add(tipFlash);
    const LEN = 3.2;
    const pts = Array.from({ length: SEG + 1 }, () => V3());
    const start = V3();
    const T = V3();
    const N = V3();
    const Bn = V3();
    const ref = V3(0, 0, 1);
    whip = (t, lash) => {
      const L = clamp01(lash);
      g.updateMatrixWorld(true);
      b.hand.localToWorld(start.set(0.26, -0.1, 0));
      g.worldToLocal(start);
      const up = smooth(0, 0.35, L);
      const strike = clamp01((L - 0.35) / 0.27);
      const back = smooth(0.62, 1, L);
      pts[0].copy(start);
      for (let k = 1; k <= SEG; k++) {
        const s = k / SEG;
        const rest = -0.35 - 1.25 * s;
        const wind = mix(rest, -1.5 - 0.4 * s, up) + TAU * (strike > 0 ? 1 : 0);
        const fwd = 1.42 - 0.1 * s;
        let beta;
        if (L < 0.35) beta = mix(rest, -1.5 - 0.4 * s, up);
        else if (L < 0.62) beta = mix(fwd, wind, smooth(strike * 1.25 - 0.18, strike * 1.25 + 0.04, s));
        else beta = mix(fwd + (0.25 + 0.6 * s) * smooth(0, 0.4, back) * -1, rest, smooth(0.3, 1, back));
        beta += Math.sin(t * 3 + s * 5) * 0.04;
        const step = LEN / SEG;
        pts[k].set(pts[k - 1].x + Math.sin(beta) * step, pts[k - 1].y - Math.cos(beta) * step, pts[k - 1].z + Math.sin(s * 3 + t) * 0.004);
        if (pts[k].y < 0.015) pts[k].y = 0.015;
      }
      for (let k = 0; k <= SEG; k++) {
        T.subVectors(pts[Math.min(SEG, k + 1)], pts[Math.max(0, k - 1)]).normalize();
        N.crossVectors(T, ref).normalize();
        Bn.crossVectors(T, N);
        const rr = mix(0.014, 0.003, k / SEG);
        for (let j = 0; j <= RAD; j++) {
          const th = (j / RAD) * TAU;
          const nx = N.x * Math.cos(th) + Bn.x * Math.sin(th);
          const ny = N.y * Math.cos(th) + Bn.y * Math.sin(th);
          const nz = N.z * Math.cos(th) + Bn.z * Math.sin(th);
          const i = (k * Wd + j) * 3;
          pos[i] = pts[k].x + nx * rr;
          pos[i + 1] = pts[k].y + ny * rr;
          pos[i + 2] = pts[k].z + nz * rr;
          geo.attributes.normal.array[i] = nx;
          geo.attributes.normal.array[i + 1] = ny;
          geo.attributes.normal.array[i + 2] = nz;
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
      geo.computeBoundingSphere();
      const crack = Math.exp(-(((L - 0.6) / 0.025) ** 2));
      tipFlash.position.copy(pts[SEG]);
      tipFlash.material.opacity = crack;
      tipFlash.visible = crack > 0.02;
    };
  }
  const animate = (t, { marching = false, lash = 0 } = {}) => {
    orcPose(b, t, { marching, lash, slaver, phase });
    if (whip) whip(t, lash);
  };
  animate(0);
  return { group: g, bones: b, head: b.head, animate, height: slaver ? 1.9 : 1.5 };
}

// One orc mid-stride with his spear upright, as one geometry for a marching
// column (vertex colours, and `metal`), for mats.orc.
function orcColumnGeo() {
  const root = new THREE.Group();
  const b = orcRig(root);
  orcPose(b, Math.PI / 2 / 6.8, { marching: true });
  root.updateMatrixWorld(true);
  const list = orcParts(5, { low: true, weapon: 'spear' }).map(([name, geo, colour, metal]) => {
    const gg = geo.applyMatrix4(b[name].matrixWorld);
    const out = typeof colour === 'function' ? tint(gg, colour) : solid(gg, colour);
    out.setAttribute('metal', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count).fill(metal), 1));
    return out;
  });
  return oneGeo(list, ['metal']);
}

// ── an orc camp ──

const CAMP = { hide: [C(0x4a3a2c), C(0x3a3028), C(0x58483a), C(0x2e2620)], pole: C(0x2a1e14), char: C(0x0e0b0a), iron: C(0x1e1d1e), rust: C(0x4a2a1a), bone: C(0xb4a88c), sack: C(0x4e4234) };

// A hide tent: spear-shaft poles leaning in to cross at the top, hides
// stretched over them sagging between, the hem ragged, a gap for a door.
function tentParts(bk, K, seed, R, H, at, turn) {
  const r = rng(seed);
  const n = makeNoise(seed);
  const poles = 5;
  const SEG = poles * 4;
  const RINGS = 6;
  const pos = [];
  const idx = [];
  const gap = [0.1, 0.9];
  for (let j = 0; j <= RINGS; j++) {
    const f = j / RINGS;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const a = mix(gap[1], TAU + gap[0], u);
      const sag = 1 - 0.1 * f * Math.sin((a * poles) / 2) ** 2;
      let y = H * (1 - f) - (f === 1 ? (n(i * 0.9, 3) - 0.3) * 0.25 : 0);
      y -= 0.08 * Math.sin(Math.PI * f) * Math.sin((a * poles) / 2) ** 2;
      const rr = R * f * sag + (f === 1 ? (n(i * 1.3, 5) - 0.5) * 0.1 : 0);
      pos.push(Math.cos(a) * rr, Math.max(0.02, y), Math.sin(a) * rr);
    }
  }
  const Wd = SEG + 1;
  for (let j = 0; j < RINGS; j++) for (let i = 0; i < SEG; i++) {
    const a = j * Wd + i;
    idx.push(a, a + 1, a + Wd, a + 1, a + Wd + 1, a + Wd);
  }
  const geo = geoOf(pos, idx);
  const base = CAMP.hide[seed % CAMP.hide.length];
  tint(geo, (x, y, z, o) => {
    o.copy(base).multiplyScalar(0.75 + noise3(n, x * 2, y * 2, z * 2) * 0.5);
    o.lerp(CAMP.hide[(seed + 1) % 4], smooth(0.55, 0.65, noise3(n, x * 0.9 + 4, y * 0.9, z * 0.9)) * 0.8);
    o.multiplyScalar(0.7 + 0.3 * smooth(0, H * 0.6, y));
  });
  bk.at(at, turn, () => {
    bk.add(K.mats.tentHide, geo, { uv: 0.6 });
    for (let k = 0; k < poles; k++) {
      const a = mix(gap[1], TAU + gap[0], (k + 0.5) / poles);
      const foot = V3(Math.cos(a) * R * 1.02, 0, Math.sin(a) * R * 1.02);
      const tip = V3(-Math.cos(a) * 0.25, H + 0.35 + r() * 0.2, -Math.sin(a) * 0.25);
      bk.add(K.mats.camp, solid(rod(foot, tip, 0.035, 0.03, 5), CAMP.pole));
      bk.add(K.mats.camp, solid(new THREE.ConeGeometry(0.04, 0.2, 4).translate(tip.x, tip.y + 0.1, tip.z), CAMP.iron));
    }
    bk.add(K.mats.camp, solid(new THREE.TorusGeometry(0.1, 0.025, 4, 8).rotateX(Math.PI / 2).translate(0, H + 0.02, 0), C(0x3a2a1a)));
  });
}

// An orc camp about 12 m across, its fire at the middle: three hide tents
// on spear poles, a fire pit ringed with stones, racks of spears, a cage,
// the banner of the Eye, and the refuse of orcs lying about. fire is where
// the flames are (a light goes there); update(t) flickers them.
function camp(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'orcCamp';
  const bk = parts();
  const r = rng(3301);
  const n = makeNoise(3301);
  const rockT = (geo) => tint(geo, (x, y, z, o, nx, ny) => o.copy(ASH.base).multiplyScalar(0.8 + noise3(n, x * 3, y * 3, z * 3) * 0.6).lerp(ASH.ash, smooth(0.3, 0.8, ny) * 0.5));
  tentParts(bk, K, 1, 1.8, 2.5, [-3.6, 0, -2.4], 0.6);
  tentParts(bk, K, 2, 1.5, 2.2, [2.9, 0, -3.3], 2.4);
  tentParts(bk, K, 3, 1.3, 1.9, [-4.0, 0, 2.8], -1.0);

  // the fire pit: stones about it, charred wood and bones in it
  const fire = V3(0.2, 0.25, 0.3);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + r() * 0.3;
    bk.add(mats.rock, rockT(hullRock(3400 + i, [0.22 + r() * 0.1, 0.16 + r() * 0.08, 0.2], [fire.x + Math.cos(a) * 0.85, 0.1, fire.z + Math.sin(a) * 0.85], 9)), { uv: 1.5 });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    bk.add(mats.camp, solid(rod([fire.x + Math.cos(a) * 0.55, 0.05, fire.z + Math.sin(a) * 0.55], [fire.x - Math.cos(a) * 0.15, 0.22, fire.z - Math.sin(a) * 0.15], 0.06, 0.045, 5), CAMP.char));
  }
  bk.add(mats.camp, solid(new THREE.CylinderGeometry(0.75, 0.8, 0.06, 12).translate(fire.x, 0.02, fire.z), CAMP.char));
  // a spit over it, a haunch on it
  for (const s of [-1, 1]) bk.add(mats.camp, solid(rod([fire.x - 0.2, 0, fire.z + s * 0.95], [fire.x + 0.1, 1.05, fire.z + s * 0.95], 0.03, 0.025, 4), CAMP.pole));
  bk.add(mats.camp, solid(rod([fire.x, 0.98, fire.z - 1.05], [fire.x, 0.98, fire.z + 1.05], 0.02, 0.02, 4), CAMP.iron));
  bk.add(mats.camp, tint(lump(0.16, { p: [fire.x, 0.93, fire.z], s: [1, 0.8, 1.6] }, { detail: 1, amp: 0.15, seed: 4 }), (x, y, z, o) => o.copy(C(0x4a2416)).multiplyScalar(0.6 + noise3(n, x * 9, y * 9, z * 9) * 0.6)));

  // racks of spears: two crossed poles at either end, a bar, spears against it
  const rack = (at, turn, count) =>
    bk.at(at, turn, () => {
      for (const x of [-1, 1]) for (const s of [-1, 1]) bk.add(mats.camp, solid(rod([x, 0, s * 0.35], [x, 1.25, -s * 0.15], 0.03, 0.028, 4), CAMP.pole));
      bk.add(mats.camp, solid(rod([-1.1, 1.08, 0], [1.1, 1.08, 0], 0.03, 0.03, 4), CAMP.pole));
      for (let i = 0; i < count; i++) {
        const x = -0.85 + (i / (count - 1)) * 1.7;
        const foot = V3(x + (r() - 0.5) * 0.1, 0, 0.55);
        const top = V3(x + (r() - 0.5) * 0.25, 2.1, -0.32);
        bk.add(mats.camp, solid(rod(foot, top, 0.016, 0.016, 4), CAMP.pole));
        const d = top.clone().sub(foot).normalize();
        bk.add(mats.camp, solid(spikeAt(top, d, 0.28, 0.04, 4), CAMP.iron));
        if (i % 2) bk.add(mats.camp, solid(spikeAt(top.clone().addScaledVector(d, -0.08), V3(0.6, -1, 0.2), 0.08, 0.012, 3), CAMP.iron));
      }
    });
  rack([3.9, 0, 1.0], 1.4, 6);
  rack([0.6, 0, -5.0], 0.15, 5);

  // the cage, iron bars on a frame, a skull in the corner of it
  bk.at([4.0, 0, 4.0], -0.5, () => {
    const W = 0.8;
    const Hh = 1.8;
    const bar = (a, b, rr = 0.022) => bk.add(mats.camp, tint(rod(a, b, rr, rr, 4), (x, y, z, o) => o.copy(CAMP.iron).lerp(CAMP.rust, smooth(0.5, 0.7, noise3(n, x * 6, y * 6, z * 6)) * 0.7)));
    for (const x of [-W, W]) for (const z of [-W, W]) bar([x, 0, z], [x, Hh, z], 0.04);
    for (const y of [0.05, Hh]) {
      bar([-W, y, -W], [W, y, -W], 0.035);
      bar([-W, y, W], [W, y, W], 0.035);
      bar([-W, y, -W], [-W, y, W], 0.035);
      bar([W, y, -W], [W, y, W], 0.035);
    }
    for (let i = 1; i < 7; i++) {
      const f = -W + (i / 7) * 2 * W;
      bar([f, 0, -W], [f, Hh, -W]);
      bar([f, 0, W], [f + (i === 3 ? 0.06 : 0), Hh, W]);
      bar([-W, 0, f], [-W, Hh, f]);
      bar([W, 0, f], [W, Hh, f]);
      bar([f, Hh, -W], [f, Hh, W]);
    }
    bk.add(mats.camp, solid(lump(0.1, { p: [-0.5, 0.09, -0.5], s: [1.1, 0.95, 0.9] }, { detail: 1, amp: 0.06 }), CAMP.bone));
    for (const s of [-1, 1]) bk.add(mats.camp, solid(new THREE.SphereGeometry(0.025, 5, 4).translate(-0.42, 0.11, -0.5 + s * 0.035), CAMP.char));
  });

  // the banner of the Eye on its pole
  bk.add(mats.camp, solid(rod([-0.8, 0, -4.6], [-0.8, 3.6, -4.6], 0.04, 0.03, 5), CAMP.pole));
  bk.add(mats.camp, solid(rod([-1.3, 3.3, -4.6], [-0.3, 3.3, -4.6], 0.025, 0.025, 4), CAMP.pole));
  bk.add(mats.camp, solid(spikeAt(V3(-0.8, 3.6, -4.6), UP, 0.3, 0.05, 4), CAMP.iron));
  bk.add(mats.camp, solid(lump(0.1, { p: [-0.8, 3.92, -4.6], s: [1.1, 0.95, 0.9] }, { detail: 1, amp: 0.05 }), CAMP.bone));
  {
    const cloth = new THREE.PlaneGeometry(1.0, 1.9, 4, 8);
    const p = cloth.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 2.2 + p.getX(i) * 3) * 0.05 + p.getX(i) * p.getX(i) * 0.08);
    cloth.computeVertexNormals();
    bk.add(mats.banner, cloth, { p: [-0.8, 2.33, -4.55] });
  }

  // the refuse: bones, skulls, a broken barrel, sacks, a split shield,
  // a pot, scraps
  for (let i = 0; i < 16; i++) {
    const a = r() * TAU;
    const d = 1.5 + r() * 4;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const len = 0.25 + r() * 0.3;
    const b = r() * TAU;
    const A = V3(x, 0.03, z);
    const Bp = V3(x + Math.cos(b) * len, 0.04, z + Math.sin(b) * len);
    bk.add(mats.camp, solid(rod(A, Bp, 0.022, 0.018, 5), CAMP.bone));
    bk.add(mats.camp, solid(lump(0.035, { p: A.toArray() }, { detail: 0 }), CAMP.bone));
    bk.add(mats.camp, solid(lump(0.035, { p: Bp.toArray() }, { detail: 0 }), CAMP.bone));
  }
  for (const [x, z] of [[1.9, 1.8], [-2.2, -0.2], [2.4, -1.2]]) {
    bk.add(mats.camp, solid(lump(0.1, { p: [x, 0.08, z], s: [1.1, 0.9, 0.9], r: [0, r() * TAU, 0.3] }, { detail: 1, amp: 0.06 }), CAMP.bone));
  }
  // the barrel, staved and burst
  bk.at([-1.8, 0, 4.2], 0.4, () => {
    for (let i = 0; i < 10; i++) {
      if (i === 3 || i === 4) continue;
      const a = (i / 10) * TAU;
      bk.add(mats.camp, solid(new THREE.BoxGeometry(0.03, 0.75 - (i % 3) * 0.12, 0.15).translate(0, 0.37 - (i % 3) * 0.06, 0).rotateY(-a).translate(Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27), C(0x3a2a1c)));
    }
    bk.add(mats.camp, solid(new THREE.TorusGeometry(0.29, 0.015, 3, 12).rotateX(Math.PI / 2).translate(0, 0.15, 0), CAMP.iron));
  });
  for (let i = 0; i < 4; i++) bk.add(mats.camp, tint(lump(0.25, { p: [-2.7 + i * 0.45, 0.2, 4.8 - (i % 2) * 0.3], s: [1, 0.8, 0.9] }, { detail: 1, amp: 0.12, seed: i + 7 }), (x, y, z, o) => o.copy(CAMP.sack).multiplyScalar(0.7 + noise3(n, x * 5, y * 5, z * 5) * 0.5)));
  bk.add(mats.camp, solid(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 12, 1, false, 0, Math.PI * 1.5).rotateX(-1.3).translate(1.6, 0.12, 3.2), CAMP.iron));
  bk.add(mats.camp, solid(new THREE.LatheGeometry([[0.0, 0], [0.16, 0.02], [0.2, 0.15], [0.16, 0.3], [0.12, 0.32]].map(([a, b]) => new THREE.Vector2(a, b)), 8).translate(-1.1, 0, 1.3), C(0x2a2522)));
  // a few boulders the camp is set among
  for (const [x, z, s] of [[-5.6, -0.4, 0.9], [5.4, -1.8, 0.7], [-1.0, 5.6, 0.6], [5.6, 5.4, 0.5]]) bk.add(mats.rock, rockT(hullRock(3500 + x * 10, [s * 1.2, s * 0.8, s], [x, s * 0.35, z], 12)), { uv: 0.6 });
  bk.build(g, { shadow: false, receive: false });

  // the fire itself: an ember glow on the ground, flames on sprites
  const embers = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: K.tex.glow, color: hot(0xff5a18, 1.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  embers.position.set(fire.x, 0.07, fire.z);
  embers.renderOrder = 2;
  g.add(embers);
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: K.tex.flame, color: hot(0xffb060, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.center.set(0.5, 0.05);
    s.position.set(fire.x + (i - 1) * 0.18, 0.12, fire.z + ((i * 7) % 3 - 1) * 0.12);
    s.renderOrder = 6;
    g.add(s);
    flames.push(s);
  }
  const halo = glowSprite(K.tex.glow, hot(0xff6a20, 1.2), 3.2, 0.5, true);
  halo.position.set(fire.x, 0.7, fire.z);
  g.add(halo);
  const update = (t) => {
    flames.forEach((s, i) => {
      const f = 0.8 + 0.12 * Math.sin(t * 13 + i * 2.1) * Math.sin(t * 7.3 + i) + 0.08 * Math.sin(t * 29 + i * 5);
      s.scale.set(0.55 * (0.9 + f * 0.2) * (i === 1 ? 1.2 : 0.85), 1.25 * f * (i === 1 ? 1.15 : 0.8), 1);
      s.material.opacity = 0.75 + f * 0.25;
    });
    halo.material.opacity = 0.42 * (0.85 + 0.15 * Math.sin(t * 11));
  };
  update(0);
  return { group: g, fire: V3(fire.x, 0.5, fire.z), update };
}

// ── inside the Mountain ──

// A wall of the cavern: a grid from `o` along U (uLen) and V (vLen), facing
// `into` the cavern and pushed that way by `bulge(u, v)`, minus a `hole(u, v)`.
function wallGeo(o, U, Vv, uLen, vLen, nu, nv, bulge, hole = () => false, into = null) {
  const N = V3().crossVectors(U, Vv).normalize();
  const flip = into && N.dot(into) < 0;
  if (flip) N.negate();
  const pos = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * uLen;
      const v = (j / nv) * vLen;
      const p = o.clone().addScaledVector(U, u).addScaledVector(Vv, v).addScaledVector(N, bulge(u, v));
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      if (hole(((i + 0.5) / nu) * uLen, ((j + 0.5) / nv) * vLen)) continue;
      const a = j * (nu + 1) + i;
      if (flip) idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
      else idx.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
    }
  }
  return geoOf(pos, idx);
}

// The Sammath Naur, the Chambers of Fire: the tunnel in from the door
// comes out at x = 0 through a sheer wall, onto a narrow jagged spur of
// rock 1.6 m wide, its top at y = 0, running out along +x to its broken tip
// at x = 14 over the Crack of Doom: a chasm 30 m across and 40 deep, lava
// flowing at its bottom, its glow coming up red on the cavern's walls and
// roof, haze and sparks rising. update(t, { erupt }): the fire rises,
// fiercer, flames bursting up out of it.
function sammathNaur(K) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'sammathNaur';
  const n = makeNoise(4101);
  const r = rng(4101);
  const DEEP = 40;
  const X1 = 31;
  const Z = 34;
  const TOP = 30;
  const rough = (a, b, k = 1) => (fbm(n, a * 0.09 * k, b * 0.09 * k, { octaves: 4 }) - 0.5) * 7 + (n(a * 0.6, b * 0.6) - 0.5) * 0.8;
  const pieces = [];
  // the near wall, the tunnel's mouth through it
  const mouth = (u, v) => Math.abs(u - Z) < 2.3 && v > DEEP - 1 && v < DEEP + 4.8;
  pieces.push(
    wallGeo(V3(0, -DEEP - 4, -Z), V3(0, 0, 1), V3(0, 1, 0), Z * 2, DEEP + TOP + 4, 48, 50, (u, v) => {
      const calm = smooth(3, 8, Math.hypot(u - Z, (v - DEEP - 2) * 0.7));
      return (rough(u, v) - 4) * calm - 0.3 * (1 - calm);
    }, mouth, V3(1, 0, 0)),
  );
  // the far wall, and the sides
  pieces.push(wallGeo(V3(X1, -DEEP - 4, Z), V3(0, 0, -1), V3(0, 1, 0), Z * 2, DEEP + TOP + 4, 40, 44, (u, v) => rough(u + 50, v) - 3, undefined, V3(-1, 0, 0)));
  pieces.push(wallGeo(V3(-2, -DEEP - 4, Z), V3(1, 0, 0), V3(0, 1, 0), X1 + 4, DEEP + TOP + 4, 22, 44, (u, v) => rough(u + 90, v) - 2 + smooth(20, 0, Math.abs(u - 15)) * -6, undefined, V3(0, 0, -1)));
  pieces.push(wallGeo(V3(X1 + 2, -DEEP - 4, -Z), V3(-1, 0, 0), V3(0, 1, 0), X1 + 4, DEEP + TOP + 4, 22, 44, (u, v) => rough(u + 130, v) - 2, undefined, V3(0, 0, 1)));
  // the roof, fangs of rock hanging from it
  pieces.push(wallGeo(V3(-2, TOP, -Z - 2), V3(1, 0, 0), V3(0, 0, 1), X1 + 4, Z * 2 + 4, 22, 40, (u, v) => rough(u + 170, v, 1.4) * 1.4 - 6 * smooth(10, 0, Math.min(u, X1 + 4 - u)), undefined, V3(0, -1, 0)));
  for (let i = 0; i < 24; i++) {
    const x = 1 + r() * (X1 - 2);
    const z = (r() - 0.5) * Z * 1.8;
    pieces.push(facet(spikeAt(V3(x, TOP + 2, z), V3((r() - 0.5) * 0.2, -1, (r() - 0.5) * 0.2), 4 + r() * 9, 0.8 + r() * 1.4, 5)));
  }
  // the tunnel in from the door, rough-walled, its floor at y = 0
  {
    const L = 16;
    const SEG = 16;
    const RAD = 14;
    const pos = [];
    const idx = [];
    for (let k = 0; k <= SEG; k++) {
      const x = -(k / SEG) * L + 0.4;
      for (let j = 0; j <= RAD; j++) {
        const a = Math.PI * (j / RAD);
        const w = 2.3 + (n(k * 0.7, j * 0.5) - 0.5) * 0.5;
        const h = 4.6 + (n(k * 0.5 + 9, j * 0.4) - 0.5) * 0.6;
        const z = Math.cos(a) * w;
        const y = Math.max(-0.05, Math.sin(a) * h * (j === 0 || j === RAD ? 0 : 1) + (j === 0 || j === RAD ? -0.05 : 0));
        pos.push(x, y, z);
      }
    }
    for (let k = 0; k < SEG; k++) for (let j = 0; j < RAD; j++) {
      const a = k * (RAD + 1) + j;
      idx.push(a, a + RAD + 1, a + 1, a + 1, a + RAD + 1, a + RAD + 2);
    }
    pieces.push(facet(geoOf(pos, idx)));
    const floor = new THREE.PlaneGeometry(L, 4.6, 8, 2).rotateX(-Math.PI / 2).translate(-L / 2 + 0.4, -0.02, 0);
    pieces.push(facet(floor));
  }
  // the spur: a tongue of rock out over the chasm, flat enough on top to
  // walk, ragged at its edges, thinning to its broken tip
  {
    const NX = 30;
    const sec = [];
    const pos = [];
    const idx = [];
    for (let i = 0; i <= NX; i++) {
      const x = (i / NX) * 14.3;
      const f = x / 14;
      const w = 0.8 * (1 + 1.4 * smooth(2.5, 0, x)) + (n(x * 2.1, 3) - 0.5) * 0.14;
      const deep = mix(9, 0.9, Math.pow(f, 0.7)) + (n(x * 0.9, 7) - 0.5) * 1.2;
      const tip = x > 13.4 ? (x - 13.4) * 1.2 : 0;
      const top = (n(x * 3.3, 1) - 0.5) * 0.05 - tip * 0.3;
      const pts = [
        [-w, top - 0.02],
        [-w * 0.5, top + 0.01],
        [0, top + 0.02],
        [w * 0.5, top + 0.01],
        [w, top - 0.02],
        [w * 1.05, top - 0.35 - n(x * 4, 5) * 0.3],
        [w * 0.7, -deep * 0.55],
        [w * 0.15, -deep],
        [-w * 0.2, -deep * 0.9],
        [-w * 0.75, -deep * 0.5],
        [-w * 1.05, top - 0.3 - n(x * 4, 9) * 0.35],
      ];
      sec.push(pts.map(([z, y]) => [x, y, z * (1 - tip * 0.6)]));
    }
    const M = sec[0].length;
    for (const row of sec) for (const p of row) pos.push(...p);
    for (let i = 0; i < NX; i++) for (let k = 0; k < M; k++) {
      const a = i * M + k;
      const b = i * M + ((k + 1) % M);
      idx.push(a, b, a + M, b, b + M, a + M);
    }
    // the broken tip, closed
    const e = NX * M;
    const c = pos.length / 3;
    pos.push(14.4, -0.4, 0);
    for (let k = 0; k < M; k++) idx.push(e + k, e + ((k + 1) % M), c);
    pieces.push(facet(geoOf(pos, idx)));
  }
  // boulders fallen on the ledge by the mouth
  for (let i = 0; i < 6; i++) pieces.push(hullRock(4200 + i, [0.4 + r() * 0.4, 0.3 + r() * 0.3, 0.4], [-0.5 - r() * 0.5, 0.1, (i % 2 ? 1 : -1) * (1.9 + r() * 0.6)], 10));
  const geo = oneGeo(pieces);
  boxUV(geo, 0.25);
  tint(geo, (x, y, z, o, nx, ny) => {
    o.copy(ASH.base).multiplyScalar(0.55 + noise3(n, x * 0.3, y * 0.3, z * 0.3) * 0.6);
    o.lerp(ASH.dark, smooth(-5, -DEEP, y) * 0.6);
    if (ny > 0.6 && y > -3) o.lerp(ASH.ash, 0.35);
    o.lerp(ASH.rust, smooth(0.6, 0.75, noise3(n, x * 0.15 + 4, y * 0.15, z * 0.15)) * 0.3);
  });
  const rock = new THREE.Mesh(geo, mats.cavern);
  rock.name = 'chambersOfFire';
  g.add(rock);

  // the fire at the bottom of the Crack
  const lavaGeo = new THREE.PlaneGeometry(X1 + 6, Z * 2 + 6, 24, 40).rotateX(-Math.PI / 2);
  {
    const p = lavaGeo.attributes.position;
    const u2 = lavaGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) u2.setXY(i, p.getX(i), p.getZ(i));
  }
  const lava = new THREE.Mesh(lavaGeo, mats.crackLava);
  lava.position.set(X1 / 2, -DEEP, 0);
  lava.name = 'crackOfDoom';
  g.add(lava);
  const hazeMat = hazeMaterial(U);
  for (let i = 0; i < 5; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(40, DEEP + 10), hazeMat);
    const a = (i / 5) * Math.PI;
    card.position.set(X1 / 2 + Math.cos(a) * 3, -DEEP / 2 + 4, Math.sin(a) * 8 - 4);
    card.rotation.y = a * 0.4 - 0.3;
    card.renderOrder = 3;
    g.add(card);
  }
  const NS = 220;
  const ss = new Float32Array(NS * 4);
  for (let i = 0; i < NS; i++) ss.set([r(), r(), r(), r()], i * 4);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const sparkMat = sparkMaterial(U);
  sparkMat.uniforms.uSpan.value.set(X1, DEEP + 20, Z * 1.4);
  const sparks = sparkPoints(sg, sparkMat);
  sparks.position.set(X1 / 2, -DEEP, 0);
  sparks.frustumCulled = false;
  sparks.renderOrder = 4;
  g.add(sparks);
  const burst = [];
  for (let i = 0; i < 40; i++) burst.push(V3(2 + r() * (X1 - 4), 0, (r() - 0.5) * Z * 1.4));
  const flames = cardCloud(mats.burst, burst, 4301);
  flames.position.y = -DEEP;
  g.add(flames);
  const glow = glowSprite(K.tex.glow, hot(0xff4a12, 0.6), 60, 0.2, false);
  glow.position.set(X1 / 2, -DEEP + 6, 0);
  g.add(glow);
  const tmp = V3();
  const update = (t, { erupt = 0 } = {}) => {
    const e = clamp01(erupt);
    U.uTime.value = t;
    U.uErupt.value = e;
    lava.position.y = -DEEP + e * 12 + Math.sin(t * 0.7) * 0.15;
    flames.position.y = lava.position.y;
    g.updateWorldMatrix(true, false);
    mats.cavern.userData.lavaY.value = g.localToWorld(tmp.set(0, lava.position.y, 0)).y;
    mats.cavern.userData.fire.value = (1 + 1.4 * e) * (0.92 + 0.08 * Math.sin(t * 2.3) * Math.sin(t * 1.3));
    mats.crackLava.uniforms.uHeat.value = 0.95 + 0.55 * e;
    hazeMat.uniforms.uK.value = 1 + 1.5 * e;
    sparkMat.uniforms.uK.value = 1 + 2 * e;
    if (K.renderer) {
      const v = new THREE.Vector2();
      K.renderer.getDrawingBufferSize(v);
      sparkMat.uniforms.uScale.value = v.y * 0.9;
    }
    mats.burst.uniforms.uK.value = e * 1.4;
    flames.visible = e > 0.01;
    glow.material.opacity = 0.2 + 0.4 * e;
  };
  update(0);
  return { group: g, tip: V3(14, 0, 0), door: V3(0, 0, 0), update };
}

// ── after ──

// A field of lava for the eruption: w × d, flowing along -z (to the
// south... the uv's +v), crusted plates drifting on it, white-hot in the
// seams, swelling slowly. Its middle at the origin, lying on y = 0.
function lavaField(K, w = 200, d = 200) {
  const geo = new THREE.PlaneGeometry(w, d, Math.min(80, Math.ceil(w / 5)), Math.min(80, Math.ceil(d / 5))).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i), -p.getZ(i));
  const mesh = new THREE.Mesh(geo, K.mats.lavaField);
  mesh.name = 'lavaField';
  return {
    mesh,
    group: mesh,
    update(t) {
      K.U.uTime.value = t;
    },
  };
}

// The rock Frodo and Sam wait on as the fire comes round them: a jagged
// black outcrop about 6 m across and 3 high, its top flat enough for two
// hobbits to sit. seat is the middle of the top; glow(k) how red the fire
// lights it from below.
function refuge(K) {
  const g = new THREE.Group();
  g.name = 'refuge';
  const n = makeNoise(5101);
  const r = rng(5101);
  const pieces = [];
  // the main block: a flat top, faces falling steep and broken
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + r() * 0.3;
    pts.push(V3(Math.cos(a) * (1.3 + r() * 0.3), 3.0 + (r() - 0.5) * 0.04, Math.sin(a) * (1.0 + r() * 0.3)));
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + r() * 0.4;
    pts.push(V3(Math.cos(a) * (2.0 + r() * 0.6), 1.6 + r() * 0.9, Math.sin(a) * (1.7 + r() * 0.5)));
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + r() * 0.4;
    pts.push(V3(Math.cos(a) * (2.6 + r() * 0.6), -0.6 - r() * 0.1, Math.sin(a) * (2.2 + r() * 0.6)));
  }
  pieces.push(facet(new ConvexGeometry(pts)));
  // lesser fangs and shoulders about it
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + r() * 0.5;
    const d = 2.2 + r() * 0.8;
    const s = 0.5 + r() * 0.7;
    pieces.push(hullRock(5200 + i, [s, s * (1 + r() * 1.3), s * 0.8], [Math.cos(a) * d, s * 0.4, Math.sin(a) * d], 11));
  }
  pieces.push(facet(spikeAt(V3(-1.9, 1.5, -1.1), V3(-0.3, 1, -0.2), 2.4, 0.5, 4)));
  pieces.push(facet(spikeAt(V3(2.1, 1.2, 0.9), V3(0.4, 1, 0.3), 1.8, 0.45, 4)));
  const geo = oneGeo(pieces);
  boxUV(geo, 0.6);
  tint(geo, (x, y, z, o, nx, ny) => {
    o.copy(ASH.base).multiplyScalar(0.6 + noise3(n, x * 1.5, y * 1.5, z * 1.5) * 0.5);
    o.lerp(ASH.dark, smooth(1.5, -0.5, y) * 0.6);
    if (ny > 0.8 && y > 2.9) o.lerp(ASH.ash, 0.3);
  });
  const mesh = new THREE.Mesh(geo, K.mats.scorch);
  mesh.name = 'refugeRock';
  g.add(mesh);
  const tmp = V3();
  const glow = (k) => {
    g.updateWorldMatrix(true, false);
    K.mats.scorch.userData.lavaY.value = g.localToWorld(tmp.set(0, 0, 0)).y;
    K.mats.scorch.userData.fire.value = Math.max(0, k) * 1.4;
  };
  glow(0.6);
  return { group: g, seat: V3(0, 3.02, 0), glow };
}

// ── Gwaihir ──

const EAGLE = {
  gold: C(0x9a6428),
  brown: C(0x4e3018),
  dark: C(0x22140a),
  pale: C(0xeadcb8),
  cream: C(0xc8a874),
  nape: C(0xc8902e),
  beak: C(0xd8b048),
  tip: C(0x2a2218),
  yellow: C(0xe0b030),
  talon: C(0x121010),
  under: C(0x8a6a44),
};

// One feather, lying flat in x-z, from its root at the origin out along +x:
// `len` long, `wid` wide, its tip rounded, bending down a little.
function featherGeo(len, wid, droop = 0.06) {
  const s = new THREE.Shape();
  s.moveTo(0, -wid * 0.28);
  s.quadraticCurveTo(len * 0.5, -wid * 0.55, len * 0.9, -wid * 0.38);
  s.quadraticCurveTo(len * 1.03, 0, len * 0.88, wid * 0.42);
  s.quadraticCurveTo(len * 0.5, wid * 0.55, 0, wid * 0.28);
  s.lineTo(0, -wid * 0.28);
  const g = new THREE.ShapeGeometry(s, 4).rotateX(Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, -droop * len * (p.getX(i) / len) ** 2);
  g.computeVertexNormals();
  return g;
}

// Gwaihir the Windlord, the great eagle: about 14 m from wingtip to wingtip,
// golden-brown, darker in his flight feathers, his head and nape pale gold,
// a great hooked beak, fierce brows over golden eyes; the long primaries
// spread like fingers at his wingtips; a broad fanned tail; yellow feet and
// black talons. Faces +x. animate(t, { flap, glide, reach }): flap 0..1
// the beat of his wings, glide 0..1 holding them out still, reach 0..1
// bringing his talons down and forward, open, to take someone up.
function eagle(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'gwaihir';
  const n = makeNoise(6101);
  const body = bone('body', g);
  const F = mats.eagle;
  const Hn = mats.eagleHorn;
  const plume = (base, { dark = 0, under = 0, mott = 0.35, to = null, k = 0 } = {}) => (geo) =>
    tint(geo, (x, y, z, out, nx, ny) => {
      out.copy(base).multiplyScalar(1 - mott * 0.5 + noise3(n, x * 2.5, y * 2.5, z * 2.5) * mott);
      if (to) out.lerp(to, k);
      if (dark) out.lerp(EAGLE.dark, dark);
      if (under) out.lerp(EAGLE.under, clamp01(-ny) * under);
    });
  const build = (grp, fn) => {
    const bk = parts();
    fn(bk);
    bk.build(grp, { shadow: false, receive: false });
  };
  // the body: a deep chest, narrowing to the tail; a ruff of golden hackles
  // about the nape, feathered thighs
  build(body, (bk) => {
    bk.add(F, plume(EAGLE.brown, { under: 0.5 })(sweep([[-1.7, 0.1, 0], [-0.8, 0.0, 0], [0.2, 0.04, 0], [1.0, 0.22, 0], [1.5, 0.44, 0]], [[0.3, 0.32, 0.26], [0.56, 0.56, 0.42], [0.68, 0.6, 0.48], [0.52, 0.46, 0.42], [0.33, 0.32, 0.32]], { seg: 14, radial: 16 })), { uv: 1.6 });
    const r = rng(6111);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU;
      const at = V3(1.35 + r() * 0.15, 0.45 + Math.sin(a) * 0.3, Math.cos(a) * 0.32);
      bk.add(F, plume(EAGLE.nape, { to: EAGLE.gold, k: r() * 0.5 })(spikeAt(at, V3(-1, Math.sin(a) * 0.3, Math.cos(a) * 0.3), 0.55 + r() * 0.2, 0.12, 4)), { uv: 2 });
    }
    // the back's coverts in rows, lying over one another
    for (let i = 0; i < 16; i++) {
      const x = 0.9 - (i % 8) * 0.28;
      const z = (i < 8 ? -1 : 1) * (0.12 + (i % 3) * 0.08);
      bk.add(F, plume(EAGLE.gold, { to: EAGLE.brown, k: 0.4 })(featherGeo(0.7, 0.3, 0.1).rotateZ(0.12).translate(0, 0, 0).rotateY(Math.PI + z * 0.6).translate(x, 0.6 - Math.abs(x - 0.2) * 0.12, z)), { uv: 2 });
    }
    for (const s of [-1, 1]) bk.add(F, plume(EAGLE.brown, { dark: 0.15 })(lump(0.34, { p: [-0.25, -0.4, s * 0.32], s: [1.3, 1.05, 0.85] }, { detail: 2, amp: 0.18, seed: 4 })), { uv: 2 });
  });

  // the neck and the head: pale gold, the brows heavy, the beak hooked
  const neck = bone('neck', body, [1.42, 0.45, 0]);
  build(neck, (bk) => {
    bk.add(F, plume(EAGLE.cream, { to: EAGLE.nape, k: 0.3 })(sweep([[0, 0, 0], [0.32, 0.17, 0], [0.62, 0.28, 0]], [[0.34, 0.33], [0.28, 0.28], [0.25, 0.25]], { seg: 6, radial: 12 })), { uv: 2.2 });
  });
  const head = bone('head', neck, [0.66, 0.3, 0]);
  build(head, (bk) => {
    bk.add(F, plume(EAGLE.pale, { mott: 0.2, to: EAGLE.cream, k: 0.2 })(lump(0.27, { p: [0.04, 0.06, 0], s: [1.3, 1.0, 0.9] }, { detail: 2, amp: 0.06, seed: 7 })), { uv: 3 });
    for (const s of [-1, 1]) {
      // the brow, jutting over the eye: the frown
      bk.add(F, plume(EAGLE.pale, { mott: 0.15, to: EAGLE.cream, k: 0.5 })(lump(0.12, { p: [0.2, 0.14, s * 0.13], s: [1.0, 0.32, 0.62], r: [s * 0.25, 0, -0.32] }, { detail: 1, amp: 0.05 })), { uv: 3 });
      bk.add(mats.eagleEye, new THREE.SphereGeometry(0.046, 12, 8), { p: [0.21, 0.075, s * 0.152] });
      bk.add(Hn, solid(new THREE.SphereGeometry(0.022, 8, 6), EAGLE.talon), { p: [0.245, 0.077, s * 0.168] });
      // the gape, a dark line back from the beak
      bk.add(Hn, solid(new THREE.BoxGeometry(0.14, 0.012, 0.012), C(0x3a2a1a)), { p: [0.32, -0.04, s * 0.085], r: [0, s * 0.35, -0.1] });
    }
    // the cere, yellow, and the beak: deep, narrow, hooked over at its tip
    bk.add(Hn, solid(lump(0.1, { p: [0.29, 0.05, 0], s: [0.55, 0.62, 0.9] }, { detail: 1, amp: 0.03 }), EAGLE.yellow));
    const beak = (geo) => tint(geo, (x, y, z, out) => out.copy(EAGLE.beak).lerp(EAGLE.tip, smooth(0.5, 0.7, x)));
    bk.add(Hn, beak(sweep([[0.27, 0.03, 0], [0.45, 0.04, 0], [0.6, -0.01, 0], [0.67, -0.12, 0], [0.62, -0.24, 0]], [[0.1, 0.075, 0.09], [0.085, 0.06, 0.08], [0.065, 0.045, 0.06], [0.04, 0.03, 0.04], [0.006, 0.006, 0.006]], { seg: 14, radial: 10 })));
    bk.add(Hn, beak(sweep([[0.28, -0.08, 0], [0.44, -0.1, 0], [0.55, -0.14, 0]], [[0.045, 0.06], [0.035, 0.045], [0.008, 0.01]], { seg: 6, radial: 8 })));
  });

  // the tail: a fan of broad feathers, barred
  const tail = bone('tail', body, [-1.62, 0.1, 0]);
  build(tail, (bk) => {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + ((i - 5.5) / 5.5) * 0.42;
      const len = 1.55 - Math.abs(i - 5.5) * 0.03;
      const geo = featherGeo(len, 0.36, 0.05).rotateY(-a).translate(0, (i % 2) * 0.012, 0);
      bk.add(F, tint(geo, (x, y, z, out) => {
        const d = Math.hypot(x, z);
        out.copy(EAGLE.brown).lerp(EAGLE.dark, 0.25 + 0.35 * smooth(0.4, 0.6, Math.sin(d * 11) * 0.5 + 0.5)).lerp(EAGLE.dark, smooth(1.1, 1.5, d) * 0.6);
      }), { uv: 1.5 });
    }
  });

  // the wings: the arm out to the wrist, its broad inner panel scalloped at
  // the trailing edge by the secondaries; the hand, and the primaries
  // splayed from it like fingers
  const wings = [-1, 1].map((s) => {
    const P = (x, y, z) => V3(x, y, z * s);
    const S = P(0.55, 0.38, 0.42);
    const E = P(0.78, 0.5, 2.5);
    const W = P(0.5, 0.52, 4.1);
    const pivot = bone(s < 0 ? 'wingL' : 'wingR', body, S.toArray());
    const flapIn = bone('flap', pivot);
    const wristAt = W.clone().sub(S);
    const wrist = bone('wrist', flapIn, wristAt.toArray());
    const flapOut = bone('flapOut', wrist);
    const panel = (lead, trail, nu, nv, { scallop = 12, camber = 0.12, colour }) => {
      const pos = [];
      const idx = [];
      for (let i = 0; i <= nu; i++) {
        const u = i / nu;
        const a = lead(u);
        const b = trail(u);
        for (let j = 0; j <= nv; j++) {
          const v = j / nv;
          const cut = j === nv ? 1 - 0.09 * Math.abs(Math.sin(Math.PI * scallop * u)) : 1;
          const p = a.clone().lerp(b, v * cut);
          p.y += camber * Math.sin(Math.PI * v) * (1 - u * 0.5);
          pos.push(p.x, p.y, p.z);
        }
      }
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const a = i * (nv + 1) + j;
        const b = a + nv + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
      return tint(geoOf(pos, idx), colour);
    };
    const poly = (pts) => (u) => {
      const k = u * (pts.length - 1);
      const i = Math.min(pts.length - 2, Math.floor(k));
      return pts[i].clone().lerp(pts[i + 1], k - i);
    };
    const wingTone = (x, y, z, out) => {
      // coverts golden over the arm, the flight feathers darker behind
      const back = clamp01((0.6 - x) / 1.6);
      out.copy(EAGLE.gold).lerp(EAGLE.brown, smooth(0.15, 0.55, back)).lerp(EAGLE.dark, smooth(0.65, 1, back) * 0.45);
      out.multiplyScalar(1.0 + noise3(n, x * 3, y * 3, z * 3) * 0.3);
    };
    const inner = parts();
    const lead = poly([S, E, W].map((p) => p.clone().sub(S)));
    const trail = poly([P(-0.95, 0.32, 0.5), P(-1.05, 0.44, 2.4), P(-0.75, 0.5, 4.1)].map((p) => p.sub(S)));
    inner.add(F, panel(lead, trail, 16, 6, { colour: wingTone }), { uv: 1.4 });
    inner.add(F, plume(EAGLE.gold, { to: EAGLE.brown, k: 0.3 })(sweep([S, S.clone().lerp(E, 0.5).add(V3(0.05, 0.06, 0)), E, W].map((p) => p.clone().sub(S)), [[0.2, 0.22], [0.15, 0.17], [0.12, 0.13], [0.1, 0.1]], { seg: 12, radial: 8 })), { uv: 1.6 });
    inner.build(flapIn, { shadow: false, receive: false });
    const outer = parts();
    // the hand: broad, its outer edge running back from the leading edge
    const H0 = P(0.45, 0.52, 4.1).sub(W);
    const H1 = P(0.25, 0.5, 5.25).sub(W);
    const T0 = P(-0.75, 0.5, 4.1).sub(W);
    const T1 = P(-0.7, 0.5, 4.95).sub(W);
    outer.add(F, panel(poly([H0, H1]), poly([T0, T1]), 6, 4, { scallop: 0, camber: 0.08, colour: wingTone }), { uv: 1.4 });
    outer.add(F, plume(EAGLE.gold, { to: EAGLE.brown, k: 0.4 })(sweep([V3(), H1.clone().multiplyScalar(0.55), H1.clone()], [[0.1], [0.075], [0.04]], { seg: 6, radial: 6 })), { uv: 1.6 });
    // the primaries from its outer edge, splayed like fingers, the
    // outermost a little shorter
    for (let i = 0; i < 6; i++) {
      const f = i / 5;
      const root = H1.clone().lerp(T1, f).add(V3(0.05, 0, -s * 0.55));
      const a = mix(-0.14, 0.5, f);
      const len = 2.75 + Math.sin(f * Math.PI * 0.8) * 0.3 - (i === 0 ? 0.3 : 0) - f * 0.5;
      const geo = featherGeo(len, 0.42 - f * 0.03, 0.05).rotateY(-(Math.PI / 2) * s).rotateY(-a * s).translate(root.x, root.y + i * 0.008, root.z);
      outer.add(F, tint(geo, (x, y, z, out) => {
        const d = Math.hypot(x - root.x, z - root.z);
        out.copy(EAGLE.brown).lerp(EAGLE.dark, 0.35 + 0.5 * smooth(0.4, 2.2, d)).multiplyScalar(0.85 + noise3(n, x * 4, y * 4, z * 4) * 0.3);
      }), { uv: 1.4 });
    }
    outer.build(flapOut, { shadow: false, receive: false });
    return { s, pivot, flapIn, wrist, flapOut };
  });

  // the legs, tucked back in flight: feathered high, yellow and scaled
  // below; four toes, three forward and one back, each with its talon
  const legs = [-1, 1].map((s) => {
    const hip = bone(s < 0 ? 'legL' : 'legR', body, [-0.25, -0.45, s * 0.3]);
    build(hip, (bk) => {
      bk.add(F, plume(EAGLE.brown, { dark: 0.1 })(lump(0.17, { p: [0, -0.2, 0], s: [1, 1.5, 1] }, { detail: 1, amp: 0.12 })), { uv: 2 });
      bk.add(Hn, tint(rod([0, -0.3, 0], [0, -0.82, 0], 0.075, 0.065, 8), (x, y, z, out) => out.copy(EAGLE.yellow).multiplyScalar(0.8 + 0.2 * Math.sin(y * 70))));
    });
    const foot = bone('foot', hip, [0, -0.84, 0]);
    build(foot, (bk) => bk.add(Hn, solid(lump(0.08, { s: [1.2, 0.8, 1.1] }, { detail: 1, amp: 0.05 }), EAGLE.yellow)));
    const toes = [0.42, 0, -0.42, Math.PI].map((a, i) => {
      const toe = bone('toe', foot, [0, -0.02, 0]);
      toe.rotation.y = a;
      const curl = bone('curl', toe);
      const L = i === 3 ? 0.24 : 0.34;
      build(curl, (bk) => {
        bk.add(Hn, solid(tube([[0, 0, 0], [L * 0.5, -0.01, 0], [L, -0.03, 0]], 0.042, 0.03, { seg: 4, radial: 6 }), EAGLE.yellow));
        bk.add(Hn, solid(tube([[L - 0.02, -0.02, 0], [L + 0.07, -0.02, 0], [L + 0.12, -0.08, 0], [L + 0.1, -0.16, 0]], 0.03, 0.004, { seg: 8, radial: 5 }), EAGLE.talon));
      });
      return curl;
    });
    return { hip, foot, toes, s };
  });

  // the beat carried on from frame to frame, slower gliding; flap, glide
  // and the talons' reach eased, so a change never jumps a wing or a leg
  const E = { t: null, fl: null, gl: 0, rc: 0, ph: 0 };
  const animate = (t, { flap = 1, glide = 0, reach = 0 } = {}) => {
    const dt = E.t == null || t < E.t ? 0 : Math.min(0.1, t - E.t);
    E.t = t;
    E.fl = E.fl == null ? clamp01(flap) : ease(E.fl, clamp01(flap), dt, 2.5);
    E.gl = ease(E.gl, clamp01(glide), dt, 2.5);
    E.rc = dt === 0 && E.rc === 0 ? clamp01(reach) : ease(E.rc, clamp01(reach), dt, 5);
    const gl = E.gl;
    const k = E.fl * (1 - gl);
    const rc = E.rc;
    E.ph += dt * 2.4 * (0.6 + 0.4 * k);
    const ph = E.ph;
    const w = Math.sin(ph) + 0.22 * Math.sin(ph * 2);
    const up = mix(0.1 + 0.035 * Math.sin(t * 0.8), 0.12 + 0.62 * w, k);
    const tip = mix(-0.06 + 0.03 * Math.sin(t * 1.1), 0.05 + 0.5 * (Math.sin(ph - 0.7) + 0.2 * Math.sin(ph * 2 - 1.4)), k);
    const sweepBack = k * 0.22 * Math.max(0, -Math.cos(ph));
    for (const W of wings) {
      W.flapIn.rotation.set(-W.s * up, W.s * sweepBack * 0.5, 0);
      W.flapOut.rotation.set(-W.s * tip, W.s * sweepBack, 0);
    }
    body.position.y = -Math.cos(ph) * 0.22 * k;
    body.rotation.z = 0.04 * Math.cos(ph) * k + 0.22 * rc;
    // the head held steady, looking about
    neck.rotation.z = -body.rotation.z * 0.7 + Math.sin(t * 0.5) * 0.03;
    head.rotation.set(0, Math.sin(t * 0.37) * 0.18, -0.05 - 0.15 * rc);
    tail.rotation.set(0, Math.sin(t * 0.6) * 0.04, -0.25 * rc + Math.cos(ph) * 0.05 * k);
    for (const L of legs) {
      L.hip.rotation.z = mix(-1.35, 0.6, smooth(0, 1, rc));
      L.hip.rotation.x = L.s * 0.12 * rc;
      L.foot.rotation.z = mix(1.0, -0.35, rc);
      L.toes.forEach((c, i) => {
        c.rotation.z = mix(-0.9, i === 3 ? 0.1 : 0.15, rc);
      });
    }
  };
  animate(0);
  return { group: g, body, head, wings, legs, animate };
}

// ── the One Ring ──

// The One Ring: plain gold, about 3 cm across its radius, lying flat (its
// hole along y), the fiery letters round it and a small glow about it.
// set(k): k 0..1 how bright the letters burn.
function ring(K) {
  const g = new THREE.Group();
  g.name = 'oneRing';
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0055, 16, 72).rotateX(Math.PI / 2), K.mats.gold);
  band.name = 'band';
  g.add(band);
  const glow = glowSprite(K.tex.glow, hot(0xff8a30, 1.6), 0.16, 0, true);
  g.add(glow);
  const set = (k) => {
    const kk = clamp01(k);
    K.mats.gold.userData.k.value = kk;
    glow.material.opacity = 0.08 + kk * 0.7;
    glow.scale.setScalar(0.09 + kk * 0.08);
  };
  set(0);
  return { group: g, band, glow, set };
}

// Gollum's eye, wrapped on a ball: the iris at its +x, huge and pale blue,
// a small black pupil, a sallow white with red threads.
function gollumEyeCanvas() {
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

// ── Gollum ── (the Marshes' builder, ../marshes/props.js, with this kit's
// materials: one Gollum for every town he's in, the fall at the last his
// own pose there)

// ── the kit ──

export function createDoomKit(renderer) {
  const kit = createShireKit(renderer);
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const basalt = basaltCanvas(S, 31);
  const cinder = cinderCanvas(S, 37);
  const feather = featherCanvas(S, 43);
  const tex = {
    rock: T(basalt.c),
    rockN: T(normalFromField(basalt.field, S, S, 3), { srgb: false }),
    cinder: T(cinder.c),
    cinderN: T(normalFromField(cinder.field, S, S, 2.5), { srgb: false }),
    hide: T(hideCanvas(S, 47)),
    feather: T(feather.c),
    featherN: T(normalFromField(feather.field, S, S, 2), { srgb: false }),
    glow: T(glowCanvas(64), { wrap: false }),
    flame: T(flameCanvas(), { wrap: false }),
    puff: T(puffCanvas(), { wrap: false }),
    noise: T(noiseCanvas(), { srgb: false }),
    letters: T(lettersCanvas(), { srgb: false }),
    banner: T(bannerCanvas(), { wrap: false }),
    eye: T(gollumEyeCanvas(), { wrap: false }),
  };
  const env = T(envCanvas(), { wrap: false });
  env.mapping = THREE.EquirectangularReflectionMapping;
  tex.env = env;
  // one clock and one eruption for every shader in the kit
  const U = { uTime: { value: 0 }, uErupt: { value: 0 }, uNoise: { value: tex.noise }, uPuff: { value: tex.puff } };
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const rockish = { map: tex.rock, normalMap: tex.rockN, vertexColors: true };
  const ashish = { map: tex.cinder, normalMap: tex.cinderN, vertexColors: true };
  const mats = {
    ...kit.mats,
    // the scene's: rock (boulders, fangs), ash (the plain), orc (the column)
    rock: M({ ...rockish, roughness: 0.92 }),
    ash: M({ ...ashish, roughness: 1 }),
    orc: orcMaterial(env),
    // the Mountain: its ash and its fire, its rock and road, held up out of the fog
    doom: emberish(M({ ...ashish, roughness: 0.96 }), U, { cap: 0.72, glow: { value: 1 }, key: 'doom-mountain' }),
    doomRock: emberish(M({ ...rockish, roughness: 0.9 }), U, { cap: 0.72, key: 'doom-rock' }),
    doomRoad: emberish(M({ ...ashish, roughness: 1 }), U, { cap: 0.72, key: 'doom-road' }),
    doorDark: emberish(new THREE.MeshBasicMaterial({ vertexColors: true }), U, { cap: 0.72, key: 'doom-door' }),
    doomLava: lavaMaterial(U, { ribbon: true, cap: 0.45, flow: 1.6 }),
    doomLake: lavaMaterial(U, { cap: 0.45, flow: 0.4, heat: 1.2 }),
    plume: smokeMaterial(U, { size: 125, rise: 620, spread: 200, wind: [0.55, 0, -0.2], cap: 0.6, alpha: 0.72, speed: 0.01 }),
    ventSmoke: smokeMaterial(U, { size: 30, rise: 160, spread: 30, wind: [0.6, 0, -0.1], cap: 0.6, alpha: 0.45, speed: 0.02 }),
    fountain: flameMaterial(U, { size: 26, rise: 120, rate: 0.45, cap: 0.4 }),
    bombs: bombMaterial(U, { speed: 55, cap: 0.4 }),
    // the Tower and the Eye
    tower: emberish(M({ ...rockish, roughness: 0.55, metalness: 0.35, envMap: env, envMapIntensity: 0.6, side: THREE.DoubleSide }), U, { cap: 0.62, glow: { value: 1 }, key: 'doom-tower' }),
    eye: eyeMaterial(U),
    beam: beamMaterial(U),
    beamPool: new THREE.MeshBasicMaterial({ map: tex.glow, color: hot(0xffa848, 1.2), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
    // the camp
    tentHide: M({ map: tex.hide, vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }),
    camp: M({ vertexColors: true, roughness: 0.8 }),
    banner: M({ map: tex.banner, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }),
    lash: M({ color: 0x2a1e16, roughness: 0.6 }),
    // inside the Mountain, and after
    cavern: underglow(M({ ...rockish, roughness: 0.82 }), U, 'doom-cavern'),
    crackLava: lavaMaterial(U, { swell: 0.4, heat: 0.95, flow: 0.5 }),
    burst: flameMaterial(U, { size: 5, rise: 16, rate: 0.6 }),
    lavaField: lavaMaterial(U, { swell: 0.35, heat: 0.92, flow: 0.6 }),
    scorch: underglow(M({ ...rockish, roughness: 0.9 }), U, 'doom-scorch'),
    // Gwaihir
    eagle: M({ map: tex.feather, normalMap: tex.featherN, vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }),
    eagleHorn: M({ vertexColors: true, roughness: 0.38, envMap: env, envMapIntensity: 0.5 }),
    eagleEye: M({ color: 0xd8a024, roughness: 0.08, emissive: new THREE.Color(0x4a2a00), envMap: env }),
    // the Ring
    gold: ringMaterial(env, tex.letters, U),
    // Gollum
    gollumSkin: M({ vertexColors: true, roughness: 0.42 }),
    gollumEye: M({ map: tex.eye, roughness: 0.08, emissive: new THREE.Color(0xffffff), emissiveMap: tex.eye, emissiveIntensity: 0.3 }),
    gollumHair: M({ color: 0x3a362e, roughness: 0.6 }),
    mouth: M({ color: 0x1a0d0c, roughness: 0.6 }),
    tooth: M({ color: 0xb4a472, roughness: 0.5 }),
    loin: M({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }),
  };
  mats.orcFlesh = mats.orc;
  mats.hide = mats.tentHide;
  mats.doomLava.polygonOffset = true;
  mats.doomLava.polygonOffsetFactor = -4;
  mats.doomLava.polygonOffsetUnits = -4;
  mats.scorch.userData.depth.value = 4;
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const DK = { mats, tex: { ...kit.K.tex, ...tex }, U, renderer };
  // the scene shares one geometry each among its instances
  const memo = new Map();
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, fn());
    return memo.get(key);
  };
  return {
    ...kit,
    mats,
    tex: DK.tex,
    uniforms: U,
    tick: (t) => {
      U.uTime.value = t;
    },
    mountDoom: () => mountDoom(DK),
    baradDur: () => baradDur(DK),
    ashRock: (seed = 1) => once(`ash${seed}`, () => ashRockGeo(seed)),
    spike: (seed = 1) => once(`spike${seed}`, () => spikeGeo(seed)),
    camp: () => camp(DK),
    orcColumn: () => once('column', orcColumnGeo),
    orc: (seed = 1, o = {}) => orc(DK, seed, o),
    sammathNaur: () => sammathNaur(DK),
    lavaField: (w = 200, d = 200) => lavaField(DK, w, d),
    refuge: () => refuge(DK),
    eagle: () => eagle(DK),
    gollum: () => gollum(DK),
    ring: () => ring(DK),
  };
}
