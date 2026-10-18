// Lothlórien, made in code: the kit the golden wood is built from. The
// great mallorns with their smooth silver bark and their crowns of pale
// gold, and far ones for the wood beyond; the flets that ring their trunks
// and the stairs that wind up to them; the elves' blue-white lanterns;
// Galadriel's Mirror in its hollow, and what it shows; a grey boat with a
// swan's neck at its prow; the Argonath on the Anduin, wet rocks for the
// rapids and cliffs for the banks; fallen leaves, ferns, and a little white
// fountain.
//
// Built with the Shire's kit (../../shire/props.js) as Rivendell's is: its
// materials and helpers, and its own for silver bark, gold leaves, pale
// elven woodwork, silver, weathered stone and water. The same conventions:
// each builder's group stands on y = 0 at its origin, fronts face +z,
// figures and boats face +x, and fixed parts are merged one mesh per
// material. Angles round a trunk are measured as the ground plane's
// (cos a, sin a) in (x, z): a = 0 is +x, a = π/2 is +z.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../../../../lib/three/stage3dNodes';
import { clamp01, fbm, makeCanvas, makeCells, makeNoise, mix, normalFromField, paintPixels, smooth } from '../../../../lib/paint';
import { stoneTextures } from '../../nodes/kit';
import { ball, blob, boxUV, createShireKit, cyl, lathe, parts, rng, roundBox, tf, tube } from '../../shire/props';
import { sharpen } from '../../../../lib/three/textures';
import { basinWaterMaterial, fallSheetMaterial, glowByColour, mirrorWaterMaterial } from '../../nodes/towns/lorien/propsShaders';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const C = (hex) => new THREE.Color(hex);

// ── small helpers ──

// Three dimensions of lumps from the two-dimensional noise.
const noise3 = (n, x, y, z) => (n(x + 31.7, y + z * 0.61) + n(y + 11.3, z + x * 0.47) + n(z + 7.1, x + y * 0.53)) / 3;

// The point at angle a and radius r in the ground plane, at height y.
const polar = (a, r, y = 0) => [Math.cos(a) * r, y, Math.sin(a) * r];

// A colour on every vertex, from fn(x, y, z, out, i).
const _kc = new THREE.Color();
const _kc2 = new THREE.Color();
function tint(geo, fn) {
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
const _pv = V3();
const _nv = V3();
function paintGeo(geo, paint) {
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
function oneGeo(list) {
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
function geoOf(pos, idx, uv = null) {
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
function gridIdx(rows, cols, flip = false, base = 0) {
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
function loftRound(rings, { radial = 48, push = null, a0 = -Math.PI / 2 } = {}) {
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
function slab(shape, depth, bevel = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
  geo.rotateX(Math.PI / 2);
  if (bevel) geo.translate(0, -bevel, 0);
  return geo;
}

// A carved leaf `len` long and `wid` wide, pointed at both ends, rising up
// y from its stalk and curling out towards +z (`curl` radians by its tip),
// folded a little along its midrib; a thin solid, so it needs no
// double-sided material.
function leafBlade(len, wid, { curl = 1, seg = 4, fold = 0.25, thick = 0.012 } = {}) {
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
function halo(K, parent, x, y, z, size = 1.3) {
  const s = new THREE.Sprite(K.mats.halo);
  s.name = 'halo';
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  s.renderOrder = 6;
  parent.add(s);
  return s;
}

// A canvas's brightness as a height field, for a normal map.
function fieldOf(c) {
  const { width: w, height: h } = c;
  const d = c.getContext('2d').getImageData(0, 0, w, h).data;
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
  return f;
}

// Draw at (x, y) on a tiling canvas, again across any edge within `r`.
function wrapAt(S, x, y, r, fn) {
  for (const dx of [-S, 0, S]) {
    if (x + dx < -r || x + dx > S + r) continue;
    for (const dy of [-S, 0, S]) {
      if (y + dy < -r || y + dy > S + r) continue;
      fn(x + dx, y + dy);
    }
  }
}

// ── painted textures ──

// Mallorn bark: smooth and silver-grey, like a beech's but paler, faintly
// striated up the trunk (v), mottled in broad soft patches, with faint dark
// lenticels across it and here and there the eye a fallen branch left.
// Pale, so the trunk's vertex colours tint it.
function barkCanvas(S) {
  const n = makeNoise(17);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out) => {
    const m = fbm(n, u * 4, v * 4, { period: 4, octaves: 4 });
    const fine = n(u * 64, v * 64, 64);
    const t = 0.9 + (m - 0.5) * 0.16 + (fine - 0.5) * 0.035;
    out[0] = 230 * t;
    out[1] = 234 * t;
    out[2] = 234 * t;
  });
  const x = c.getContext('2d');
  const r = rng(19);
  x.lineCap = 'round';
  // long faint lines up the trunk, wandering a little
  for (let i = 0; i < 300; i++) {
    const x0 = r() * S;
    const amp = 0.4 + r() * 1.8;
    const ph = r() * TAU;
    const y0 = r() * S;
    const len = S * (0.25 + r() * 0.75);
    const light = r() < 0.5;
    x.strokeStyle = light ? `rgba(246,248,248,${0.05 + r() * 0.12})` : `rgba(92,98,98,${0.05 + r() * 0.1})`;
    x.lineWidth = 0.5 + r() * 1.3;
    for (const dx of [-S, 0, S]) {
      for (const dy of [-S, 0, S]) {
        x.beginPath();
        for (let k = 0; k <= len; k += 4) {
          const yy = y0 + k + dy;
          const xx = x0 + dx + Math.sin((yy / S) * TAU * 2 + ph) * amp;
          if (k) x.lineTo(xx, yy);
          else x.moveTo(xx, yy);
        }
        x.stroke();
      }
    }
  }
  // lenticels: short dark dashes across
  for (let i = 0; i < 70; i++) {
    const px = r() * S;
    const py = r() * S;
    const l = 2 + r() * 6;
    x.strokeStyle = `rgba(70,74,72,${0.12 + r() * 0.2})`;
    x.lineWidth = 0.8 + r() * 0.6;
    wrapAt(S, px, py, l, (qx, qy) => {
      x.beginPath();
      x.moveTo(qx - l / 2, qy);
      x.lineTo(qx + l / 2, qy + (r() - 0.5));
      x.stroke();
    });
  }
  // the eyes of old branches: a dark lid over a paler hollow
  for (let i = 0; i < 1; i++) {
    const px = r() * S;
    const py = r() * S;
    const w = 6 + r() * 6;
    wrapAt(S, px, py, w * 2, (qx, qy) => {
      x.fillStyle = 'rgba(232,236,234,0.2)';
      x.beginPath();
      x.ellipse(qx, qy + 2, w * 0.7, w * 0.35, 0, 0, TAU);
      x.fill();
      x.strokeStyle = 'rgba(60,64,62,0.22)';
      x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(qx - w * 1.6, qy + w * 0.5);
      x.quadraticCurveTo(qx, qy - w * 0.6, qx + w * 1.6, qy + w * 0.5);
      x.stroke();
    });
  }
  return c;
}

// Elven wood, pale grey-white: a fine flowing grain along u, in four
// boards across v with the faintest seams between, and here and there a
// soft knot.
function woodCanvas(S) {
  const n = makeNoise(23);
  const r = rng(23);
  const c = makeCanvas(S);
  const shade = [0, 1, 2, 3].map(() => 0.94 + r() * 0.06);
  paintPixels(c, (u, v, out) => {
    const b = Math.floor(v * 4);
    const fv = v * 4 - b;
    let k = shade[b] * (0.92 + fbm(n, u * 6, v * 6, { period: 6, octaves: 3 }) * 0.1);
    k *= 0.72 + 0.28 * smooth(0, 0.03, Math.min(fv, 1 - fv));
    out[0] = 240 * k;
    out[1] = 238 * k;
    out[2] = 232 * k;
  });
  const x = c.getContext('2d');
  for (let b = 0; b < 4; b++) {
    for (let i = 0; i < 18; i++) {
      const y0 = (b + 0.08 + r() * 0.84) * (S / 4);
      const amp = 0.6 + r() * 2.2;
      const fq = 1 + Math.floor(r() * 3);
      const ph = r() * TAU;
      x.strokeStyle = `rgba(150,146,136,${0.1 + r() * 0.16})`;
      x.lineWidth = 0.5 + r() * 1.0;
      x.beginPath();
      for (let px = 0; px <= S; px += 4) {
        const yy = y0 + Math.sin((px / S) * TAU * fq + ph) * amp;
        if (px) x.lineTo(px, yy);
        else x.moveTo(px, yy);
      }
      x.stroke();
    }
    const kx = r() * S;
    const ky = (b + 0.5) * (S / 4);
    for (let k = 3; k > 0; k--) {
      x.strokeStyle = `rgba(140,134,124,${0.1 + k * 0.05})`;
      x.lineWidth = 1;
      wrapAt(S, kx, ky, 14, (qx, qy) => {
        x.beginPath();
        x.ellipse(qx, qy, k * 4, k * 1.6, 0, 0, TAU);
        x.stroke();
      });
    }
  }
  return c;
}

// A spray of mallorn leaves for a crown's cards: slender pointed leaves,
// pale cream to white so the cards' vertex colours give their gold, the
// darker ones behind, thick in the middle and thinning to a ragged edge
// within a round, so no card shows its corners.
function leafCardCanvas(S = 256) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(29);
  x.clearRect(0, 0, S, S);
  const leaves = [];
  for (let i = 0; i < 150; i++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 0.7) * S * 0.4;
    leaves.push({ a, d, k: r() });
  }
  leaves.sort((p, q) => p.k - q.k);
  x.lineCap = 'round';
  for (const { a, d, k } of leaves) {
    const px = S / 2 + Math.cos(a) * d;
    const py = S / 2 + Math.sin(a) * d;
    const ang = a + (r() - 0.5) * 1.6;
    const L = S * (0.07 + r() * 0.05);
    const W = L * (0.3 + r() * 0.1);
    const t = 0.66 + k * 0.34;
    x.save();
    x.translate(px, py);
    x.rotate(ang);
    x.beginPath();
    x.moveTo(-L / 2, 0);
    x.quadraticCurveTo(-L * 0.05, -W, L / 2, 0);
    x.quadraticCurveTo(-L * 0.05, W, -L / 2, 0);
    x.fillStyle = `rgb(${Math.round(255 * t)},${Math.round(250 * t)},${Math.round(232 * t)})`;
    x.fill();
    x.strokeStyle = 'rgba(96,84,56,0.4)';
    x.lineWidth = 0.8;
    x.stroke();
    x.beginPath();
    x.moveTo(-L / 2, 0);
    x.lineTo(L / 2, 0);
    x.strokeStyle = 'rgba(255,255,250,0.5)';
    x.stroke();
    x.restore();
  }
  return c;
}

// Old weathered stone, pale so the vertex colours give its grey-green: a
// grain, shallow pits, a web of hairline cracks, rain streaks down it,
// and crusts and rings of lichen. With its relief.
function weatheredCanvas(S, seed) {
  const n = makeNoise(seed);
  const cells = makeCells(seed + 3);
  const pits = makeCells(seed + 7);
  const field = new Float32Array(S * S);
  const c = makeCanvas(S);
  paintPixels(c, (u, v, out, px, py) => {
    const big = fbm(n, u * 4, v * 4, { period: 4, octaves: 5 });
    const grain = n(u * 128, v * 128, 128);
    const k = cells(u * 4, v * 4, 4);
    const crack = (1 - smooth(0, 0.025, k.f2 - k.f1)) * smooth(0.55, 0.68, fbm(n, u * 3 + 7, v * 3, { period: 3, octaves: 2 })) * 0.6;
    const q = pits(u * 20, v * 20, 20);
    const pit = q.id < 0.3 ? 1 - smooth(0.05, 0.18, q.f1) : 0;
    const streak = (n(u * 40, 2.5, 40) - 0.5) * smooth(0.35, 0.7, fbm(n, u * 2 + 1, v * 2, { period: 2, octaves: 2 }));
    field[py * S + px] = clamp01(0.4 + big * 0.4 + grain * 0.15 - crack * 0.45 - pit * 0.25);
    const t = 0.8 + big * 0.22 + (grain - 0.5) * 0.12 - crack * 0.32 - pit * 0.12 - streak * 0.24;
    let rr = 232 * t;
    let gg = 234 * t;
    let bb = 226 * t;
    const l1 = smooth(0.62, 0.7, fbm(n, u * 6 + 3, v * 6 + 1, { period: 6, octaves: 4 }));
    rr = mix(rr, 220, l1 * 0.5);
    gg = mix(gg, 218, l1 * 0.5);
    bb = mix(bb, 160, l1 * 0.5);
    const ring = q.id > 0.88 ? smooth(0.1, 0.18, q.f1) * (1 - smooth(0.22, 0.3, q.f1)) : 0;
    rr = mix(rr, 246, ring * 0.4);
    gg = mix(gg, 246, ring * 0.4);
    bb = mix(bb, 238, ring * 0.4);
    out[0] = rr;
    out[1] = gg;
    out[2] = bb;
  });
  return { c, field };
}

// A soft round glow, white, for the lamps' halos.
function haloCanvas() {
  const c = makeCanvas(64);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.18, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return c;
}

// What polished silver shows of the wood round it: pale gold light above,
// silver trunks and gold leaves about the horizon, dark green below.
function skyCanvas() {
  const c = makeCanvas(256, 128);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#f6f6f0');
  g.addColorStop(0.22, '#e8dca8');
  g.addColorStop(0.4, '#a89858');
  g.addColorStop(0.5, '#5a6048');
  g.addColorStop(0.62, '#2e3426');
  g.addColorStop(1, '#14160f');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 128);
  const r = rng(5);
  // silver trunks round the horizon, gold leaves above
  for (let i = 0; i < 16; i++) {
    x.fillStyle = `rgba(214,220,224,${0.35 + r() * 0.35})`;
    x.fillRect(r() * 256, 38 + r() * 12, 2 + r() * 5, 60);
  }
  for (let i = 0; i < 22; i++) {
    x.fillStyle = `rgba(255,222,120,${0.2 + r() * 0.25})`;
    x.beginPath();
    x.arc(r() * 256, 12 + r() * 34, 5 + r() * 12, 0, TAU);
    x.fill();
  }
  return c;
}

// The Shire burning, as the Mirror shows it to Frodo, painted simply: a
// sky of black smoke lit orange from beneath, the Hill with its round
// doors aflame, the mill burning by the Water, and along the ridge in front
// a line of hobbits in chains, black against the fire, driven by an orc
// with a whip.
function shireVisionCanvas(S = 512) {
  const c = makeCanvas(S);
  const x = c.getContext('2d');
  const r = rng(41);
  let g = x.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, '#0e0a08');
  g.addColorStop(0.3, '#2a160e');
  g.addColorStop(0.5, '#8a3416');
  g.addColorStop(0.6, '#d8702a');
  g.addColorStop(0.68, '#5a2410');
  g.addColorStop(1, '#100a06');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  // billows of smoke, some lit from beneath
  for (let i = 0; i < 90; i++) {
    const px = r() * S;
    const py = S * (0.04 + r() * 0.46);
    const rad = S * (0.04 + r() * 0.11);
    const lit = r() < 0.3 && py > S * 0.25;
    const rg = x.createRadialGradient(px, py, 0, px, py, rad);
    rg.addColorStop(0, lit ? 'rgba(140,60,24,0.55)' : 'rgba(18,14,12,0.62)');
    rg.addColorStop(1, 'rgba(18,12,10,0)');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(px, py, rad, 0, TAU);
    x.fill();
  }
  const flame = (px, py, h, w, col) => {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(px - w, py);
    x.bezierCurveTo(px - w, py - h * 0.45, px - w * 0.15, py - h * 0.55, px + (r() - 0.5) * w * 0.6, py - h);
    x.bezierCurveTo(px + w * 0.15, py - h * 0.55, px + w, py - h * 0.45, px + w, py);
    x.closePath();
    x.fill();
  };
  const fire = (px, py, s) => {
    x.save();
    x.globalCompositeOperation = 'lighter';
    const rg = x.createRadialGradient(px, py - s * 0.6, 0, px, py - s * 0.6, s * 2.4);
    rg.addColorStop(0, 'rgba(255,140,40,0.55)');
    rg.addColorStop(1, 'rgba(255,90,20,0)');
    x.fillStyle = rg;
    x.fillRect(px - s * 3, py - s * 3.2, s * 6, s * 6);
    x.restore();
    for (let k = 0; k < 4; k++) flame(px + (r() - 0.5) * s * 0.9, py, s * (1.2 + r() * 1.2), s * (0.35 + r() * 0.25), '#d8461a');
    for (let k = 0; k < 3; k++) flame(px + (r() - 0.5) * s * 0.6, py, s * (0.8 + r() * 0.8), s * (0.22 + r() * 0.15), '#f89a2c');
    for (let k = 0; k < 2; k++) flame(px + (r() - 0.5) * s * 0.4, py, s * (0.5 + r() * 0.5), s * 0.13, '#ffe28a');
  };
  // the far hills, then the Hill
  x.fillStyle = '#24160e';
  x.beginPath();
  x.moveTo(0, S * 0.6);
  for (let px = 0; px <= S; px += 16) x.lineTo(px, S * (0.58 + Math.sin(px * 0.013 + 1) * 0.03));
  x.lineTo(S, S);
  x.lineTo(0, S);
  x.fill();
  x.fillStyle = '#16100a';
  x.beginPath();
  x.moveTo(0, S * 0.72);
  x.quadraticCurveTo(S * 0.3, S * 0.5, S * 0.55, S * 0.6);
  x.quadraticCurveTo(S * 0.8, S * 0.68, S, S * 0.66);
  x.lineTo(S, S);
  x.lineTo(0, S);
  x.fill();
  // round doors and windows in the Hill, burning
  for (const [px, py, rr] of [[0.2, 0.66, 0.03], [0.33, 0.6, 0.035], [0.47, 0.6, 0.028], [0.62, 0.65, 0.03], [0.4, 0.66, 0.018], [0.26, 0.64, 0.016]]) {
    const rg = x.createRadialGradient(px * S, py * S, 0, px * S, py * S, rr * S);
    rg.addColorStop(0, '#ffe08a');
    rg.addColorStop(0.6, '#f07a20');
    rg.addColorStop(1, '#6a2008');
    x.fillStyle = rg;
    x.beginPath();
    x.arc(px * S, py * S, rr * S, 0, TAU);
    x.fill();
    fire(px * S, (py - rr * 0.8) * S, rr * S * 1.4);
  }
  // the mill by the Water, its wheel black against the flames
  x.fillStyle = '#0c0806';
  x.fillRect(S * 0.74, S * 0.5, S * 0.12, S * 0.14);
  x.beginPath();
  x.moveTo(S * 0.72, S * 0.5);
  x.lineTo(S * 0.8, S * 0.42);
  x.lineTo(S * 0.88, S * 0.5);
  x.fill();
  x.lineWidth = S * 0.008;
  x.strokeStyle = '#0c0806';
  x.beginPath();
  x.arc(S * 0.72, S * 0.6, S * 0.05, 0, TAU);
  x.stroke();
  fire(S * 0.8, S * 0.46, S * 0.06);
  fire(S * 0.86, S * 0.52, S * 0.04);
  // a field burning behind the ridge in front, so what stands on it is
  // black against the fire
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const px = S * (0.05 + i * 0.11 + r() * 0.04);
    const py = S * (0.73 + r() * 0.03);
    const rg = x.createRadialGradient(px, py, 0, px, py, S * 0.16);
    rg.addColorStop(0, 'rgba(255,150,50,0.75)');
    rg.addColorStop(0.5, 'rgba(220,80,20,0.35)');
    rg.addColorStop(1, 'rgba(160,40,10,0)');
    x.fillStyle = rg;
    x.fillRect(px - S * 0.16, py - S * 0.16, S * 0.32, S * 0.32);
  }
  x.restore();
  for (let i = 0; i < 10; i++) {
    const px = S * (0.04 + i * 0.1 + r() * 0.03);
    for (let k = 0; k < 3; k++) flame(px + (r() - 0.5) * S * 0.04, S * 0.79, S * (0.03 + r() * 0.04), S * (0.012 + r() * 0.01), k ? '#f8a030' : '#d8461a');
  }
  const ridge = (px) => {
    const t = px / S;
    return S * ((1 - t) * (1 - t) * 0.82 + 2 * (1 - t) * t * 0.77 + t * t * 0.81);
  };
  x.fillStyle = '#070403';
  x.beginPath();
  x.moveTo(0, ridge(0));
  for (let px = 0; px <= S; px += 8) x.lineTo(px, ridge(px));
  x.lineTo(S, S);
  x.lineTo(0, S);
  x.fill();
  const hands = [];
  for (let i = 0; i < 5; i++) {
    const px = S * (0.14 + i * 0.12);
    const py = ridge(px) + 1;
    const h = S * 0.11;
    const lean = 0.15 + r() * 0.1;
    x.fillStyle = '#060403';
    // a hunched body, a round head, curly hair, bare feet
    x.beginPath();
    x.ellipse(px, py - h * 0.42, h * 0.2, h * 0.32, lean, 0, TAU);
    x.fill();
    x.beginPath();
    x.arc(px + h * 0.12, py - h * 0.82, h * 0.14, 0, TAU);
    x.fill();
    for (let k = 0; k < 6; k++) {
      x.beginPath();
      x.arc(px + h * (0.02 + r() * 0.2), py - h * (0.88 + r() * 0.1), h * 0.06, 0, TAU);
      x.fill();
    }
    x.fillRect(px - h * 0.12, py - h * 0.14, h * 0.08, h * 0.14);
    x.fillRect(px + h * 0.04, py - h * 0.14, h * 0.08, h * 0.14);
    hands.push([px + h * 0.14, py - h * 0.42]);
  }
  // the chain from wrist to wrist, its links catching the firelight
  x.strokeStyle = '#d07a3a';
  x.lineWidth = 2;
  for (let i = 0; i < hands.length - 1; i++) {
    const [ax, ay] = hands[i];
    const [bx, by] = hands[i + 1];
    for (let k = 0; k <= 9; k++) {
      const t = k / 9;
      const lx = mix(ax, bx, t);
      const ly = mix(ay, by, t) + Math.sin(t * Math.PI) * S * 0.018;
      x.beginPath();
      x.ellipse(lx, ly, 3, 1.8, k % 2 ? 0.4 : -0.4, 0, TAU);
      x.stroke();
    }
  }
  // the orc driving them, the whip raised
  const ox = S * 0.82;
  const oy = ridge(ox) + 1;
  const oh = S * 0.17;
  x.fillStyle = '#050302';
  x.beginPath();
  x.ellipse(ox, oy - oh * 0.48, oh * 0.18, oh * 0.32, -0.25, 0, TAU);
  x.fill();
  x.beginPath();
  x.arc(ox - oh * 0.08, oy - oh * 0.86, oh * 0.11, 0, TAU);
  x.fill();
  for (let k = 0; k < 4; k++) {
    x.beginPath();
    x.moveTo(ox - oh * 0.16 + k * oh * 0.08, oy - oh * 0.92);
    x.lineTo(ox - oh * 0.12 + k * oh * 0.08, oy - oh * 1.06);
    x.lineTo(ox - oh * 0.08 + k * oh * 0.08, oy - oh * 0.9);
    x.fill();
  }
  x.fillRect(ox - oh * 0.12, oy - oh * 0.2, oh * 0.09, oh * 0.2);
  x.fillRect(ox + oh * 0.04, oy - oh * 0.2, oh * 0.09, oh * 0.2);
  x.lineWidth = 4;
  x.strokeStyle = '#050302';
  x.beginPath();
  x.moveTo(ox + oh * 0.1, oy - oh * 0.62);
  x.lineTo(ox + oh * 0.28, oy - oh * 1.0);
  x.stroke();
  x.lineWidth = 1.8;
  x.beginPath();
  x.moveTo(ox + oh * 0.28, oy - oh * 1.0);
  x.bezierCurveTo(ox - oh * 0.2, oy - oh * 1.5, ox - oh * 0.9, oy - oh * 1.0, ox - oh * 1.3, oy - oh * 0.75);
  x.stroke();
  // embers in the air
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 140; i++) {
    x.fillStyle = `rgba(255,${120 + Math.floor(r() * 100)},40,${0.3 + r() * 0.5})`;
    x.fillRect(r() * S, S * (0.15 + r() * 0.6), 1.5, 1.5);
  }
  x.restore();
  // darker round the edge
  g = x.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return c;
}

// ── the mallorns ──

// How thick a mallorn's trunk is at height y (above its buttresses): a
// column that barely tapers until its crown.
const trunkAt = (r, h, y) => r * (1 - 0.3 * Math.pow(clamp01(y / h), 1.6));

// Mallorn leaves: deep amber within and beneath a crown, through gold, to
// pale primrose out on top in the light; a few clumps greener, a few
// silvered.
const LEAF = { inner: C(0xa08236), deep: C(0xcaa448), gold: C(0xe8cc6a), pale: C(0xfaf2c2), green: C(0xd6d27a), silver: C(0xf2f0dc) };
function leafColour(t, own, out) {
  out.copy(LEAF.inner).lerp(LEAF.deep, smooth(0.0, 0.3, t));
  out.lerp(own > 0.76 ? LEAF.green : LEAF.gold, smooth(0.24, 0.58, t));
  out.lerp(own < 0.14 ? LEAF.silver : LEAF.pale, smooth(0.62, 1, t) * 0.8);
  return out;
}

// The silver of a mallorn's bark on a vertex: a little darker and greener
// at the foot where it's damp, paler up in the light.
function barkTint(n, h) {
  return (x, y, z, out) => {
    const a = Math.atan2(z, x);
    out.setRGB(0.9, 0.92, 0.92).multiplyScalar(0.93 + n(Math.cos(a) * 2 + 4, y * 0.05 + Math.sin(a) * 2) * 0.12);
    const foot = 1 - smooth(0.0, 3.2, y);
    out.lerp(_kc2.setRGB(0.42, 0.47, 0.36), foot * (0.3 + 0.4 * n(x * 0.7 + 9, z * 0.7 + 3)));
    out.lerp(_kc2.setRGB(0.96, 0.96, 0.93), smooth(h * 0.3, h * 0.85, y) * 0.3);
    return out;
  };
}

// Leaf clumps for a crown: lumpy balls, squashed into the flat tiers the
// mallorns' leaves hang in, each vertex's colour from how high and how far
// out it is in the crown (darker under and within, pale gold out on top),
// in patches of hue; their normals turned out from the crown's middle so it
// shades as one soft mass.
function crownBlobs(blobs, centre, { seed = 1, detail = 2, span = 10, squash = 0.62 } = {}) {
  const n = makeNoise(seed + 7);
  const ctr = V3(...centre);
  const tmp = V3();
  return blobs.map(([x, y, z, rad], i) => {
    const geo = blob(rad, { detail, amp: 0.3, freq: 1.6, seed: seed * 13 + i });
    geo.scale(1, squash, 1).translate(x, y, z);
    const nr = geo.attributes.normal;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      tmp.set(p.getX(k) - ctr.x, (p.getY(k) - ctr.y) / 0.45, p.getZ(k) - ctr.z).normalize();
      const nx = nr.getX(k) * 0.45 + tmp.x * 0.55;
      const ny = nr.getY(k) * 0.45 + tmp.y * 0.55 + 0.12;
      const nz = nr.getZ(k) * 0.45 + tmp.z * 0.55;
      const l = Math.hypot(nx, ny, nz);
      nr.setXYZ(k, nx / l, ny / l, nz / l);
    }
    const own = n(i * 3.7 + 0.5, seed + 0.5);
    tint(geo, (px, py, pz, out) => {
      const up = (py - ctr.y) / (span * 0.4);
      const outward = Math.hypot(px - ctr.x, (py - ctr.y) * 0.6, pz - ctr.z) / span;
      const t = clamp01(0.42 + up * 0.36 + (outward - 0.6) * 0.5 + (n(px * 0.8, py * 0.8 + pz) - 0.5) * 0.34);
      leafColour(t, own, out);
    });
    return geo;
  });
}

// Cards of leaves round the clumps, so a crown's edge is leaves and not a
// lump: `per` cards on each clump's skin, facing out from it, turned every
// way, `size` across, coloured as the clumps are.
function crownCards(blobs, centre, { seed = 1, per = 10, size = 3, span = 10, squash = 0.62 } = {}) {
  const r = rng(seed * 5 + 1);
  const n = makeNoise(seed + 9);
  const ctr = V3(...centre);
  const pos = [];
  const nor = [];
  const uv = [];
  const col = [];
  const idx = [];
  const d = V3();
  const out = V3();
  const t1 = V3();
  const t2 = V3();
  blobs.forEach(([x, y, z, rad], bi) => {
    const own = n(bi * 3.7 + 0.5, seed + 0.5);
    for (let k = 0; k < per; k++) {
      // a direction out of the clump, mostly away from the crown's middle
      out.set(x - ctr.x, (y - ctr.y) * 0.8, z - ctr.z).normalize();
      d.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
      // most face out of the crown; some hang beneath, to be seen from below
      if (k % 5 < 2) d.y -= 1.4;
      else d.addScaledVector(out, 0.7);
      d.normalize();
      const p = V3(x + d.x * rad * (0.8 + r() * 0.25), y + d.y * rad * squash * (0.8 + r() * 0.3), z + d.z * rad * (0.8 + r() * 0.25));
      t1.set(0, 1, 0).cross(d);
      if (t1.lengthSq() < 1e-4) t1.set(1, 0, 0);
      t1.normalize();
      t2.copy(d).cross(t1).normalize();
      const turn = r() * TAU;
      const s = size * (0.7 + r() * 0.5);
      const ca = Math.cos(turn) * s * 0.5;
      const sa = Math.sin(turn) * s * 0.5;
      const ax = V3().addScaledVector(t1, ca).addScaledVector(t2, sa);
      const ay = V3().addScaledVector(t1, -sa).addScaledVector(t2, ca);
      const up = (p.y - ctr.y) / (span * 0.4);
      const outward = Math.hypot(p.x - ctr.x, (p.y - ctr.y) * 0.6, p.z - ctr.z) / span;
      const tt = clamp01(0.62 + up * 0.3 + (outward - 0.6) * 0.45 + (r() - 0.5) * 0.3);
      leafColour(tt, own, _kc);
      const b = pos.length / 3;
      for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) {
        const q = p.clone().addScaledVector(ax, u * 2 - 1).addScaledVector(ay, v * 2 - 1);
        pos.push(q.x, q.y, q.z);
        nor.push(d.x * 0.6, d.y * 0.6 + 0.4, d.z * 0.6);
        uv.push(u, v);
        col.push(_kc.r, _kc.g, _kc.b);
      }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  const nn = g.attributes.normal;
  for (let i = 0; i < nn.count; i++) {
    const l = Math.hypot(nn.getX(i), nn.getY(i), nn.getZ(i)) || 1;
    nn.setXYZ(i, nn.getX(i) / l, nn.getY(i) / l, nn.getZ(i) / l);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

// Average the normals across a ring's seam, where its first and last
// points are one (a trunk's texture wraps there, so they can't be merged).
function weldSeam(geo, rows, ring) {
  const nr = geo.attributes.normal;
  for (let j = 0; j < rows; j++) {
    const a = j * (ring + 1);
    const b = a + ring;
    const x = nr.getX(a) + nr.getX(b);
    const y = nr.getY(a) + nr.getY(b);
    const z = nr.getZ(a) + nr.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    nr.setXYZ(a, x / l, y / l, z / l);
    nr.setXYZ(b, x / l, y / l, z / l);
  }
  return geo;
}

// A great mallorn, `h` tall, its trunk `r` round: smooth silver bark, the
// foot flaring into buttresses that run out as roots over the ground, a
// column rising clean but for two or three branches, then parting high up
// into great limbs that hold a broad crown of gold in flat tiers. The
// trunk is straight and stands at the origin; radiusAt(y) is how thick it
// is at a height (for a flet or a stair round it).
function mallorn(K, { h = 55, r = 1.8, seed = 1 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'mallorn';
  const rand = rng(seed * 31 + 5);
  const n = makeNoise(seed * 7 + 2);
  const bk = parts();
  const bark = barkTint(n, h);
  // the roots: six to eight, unevenly round
  const nRoots = 6 + Math.floor(rand() * 3);
  const roots = [];
  for (let i = 0; i < nRoots; i++) roots.push(((i + 0.2 + rand() * 0.6) / nRoots) * TAU);
  const lobe = (a) => {
    let s = 0;
    for (const ra of roots) {
      let d = Math.abs(a - ra) % TAU;
      if (d > Math.PI) d = TAU - d;
      s += Math.exp(-(d * d) / 0.08);
    }
    return s;
  };
  // the trunk: rings up it, closer at the foot where the buttresses flare
  const topY = h * 0.8;
  const ys = [-0.8, 0, 0.3, 0.7, 1.2, 1.9, 2.8, 4, 5.6, 7.6, 10];
  for (let y = 13.5; y < topY - 1.5; y += 3.5) ys.push(y);
  ys.push(topY);
  const RAD = 32;
  const repU = Math.max(2, Math.round((TAU * r) / 2.2));
  const pos = [];
  const uv = [];
  for (const y of ys) {
    const yy = Math.max(0, y);
    const base = trunkAt(r, h, yy);
    const flare = 1 + 0.32 * Math.exp(-yy / 2.2);
    const but = 1.3 * Math.exp(-yy / 1.35);
    for (let i = 0; i <= RAD; i++) {
      const a = (i / RAD) * TAU;
      const wob = 1 + (noise3(n, Math.cos(a) * 1.3, yy * 0.06, Math.sin(a) * 1.3) - 0.5) * 0.09;
      const rr = base * flare * wob * (1 + but * lobe(a));
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
      uv.push((i / RAD) * repU, y / 4.4);
    }
  }
  const trunk = weldSeam(geoOf(pos, gridIdx(ys.length - 1, RAD, true), uv), ys.length, RAD);
  bk.add(mats.bark, tint(trunk, bark));
  // a cap on it, out of sight in the crown
  const capR = trunkAt(r, h, topY);
  bk.add(mats.bark, tint(new THREE.ConeGeometry(capR, 2.5, 12, 1, true).translate(0, topY + 1.25, 0), bark));
  // the roots, arching over the ground from the buttresses and sinking
  roots.forEach((ra, i) => {
    const reach = r * (2.4 + rand() * 1.6);
    const bend = (rand() - 0.5) * 0.5;
    const pts = [];
    for (let k = 0; k <= 5; k++) {
      const f = k / 5;
      const a = ra + bend * f * f;
      pts.push(polar(a, mix(r * 1.15, r + reach, f), 1.1 * Math.pow(1 - f, 1.5) - 0.3 * f));
    }
    bk.add(mats.bark, tint(tube(pts, r * 0.36, r * 0.06, { seg: 10, radial: 7, gnarl: 0.05, seed: seed * 11 + i, uvK: 0.45 }), bark));
  });
  // a branch: a smooth tube from inside the trunk, out and up
  const branch = (pts, r0, r1, s) => bk.add(mats.bark, tint(tube(pts, r0, r1, { seg: 12, radial: 8, gnarl: 0.04, seed: s, uvK: 0.45 }), bark));
  const blobs = [];
  const small = [];
  // two or three low branches, each with a spray of gold at its end
  const lows = [];
  const nLow = 2 + (rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < nLow; i++) {
    const y0 = h * (0.4 + i * 0.09 + rand() * 0.04);
    const a = rand() * TAU;
    const reach = h * (0.11 + rand() * 0.05);
    const tr = trunkAt(r, h, y0);
    const end = polar(a + 0.16, reach, y0 + reach * 0.42);
    branch([polar(a, tr * 0.3, y0 - 0.3), polar(a, tr + reach * 0.25, y0 + reach * 0.16), polar(a + 0.08, reach * 0.7, y0 + reach * 0.38), end], r * 0.2, r * 0.035, seed * 3 + i);
    lows.push({ y: y0, a });
    const cr = reach * 0.3;
    small.push([end[0], end[1] + cr * 0.1, end[2], cr]);
    const mid = polar(a + 0.1, reach * 0.66, y0 + reach * 0.34);
    small.push([mid[0], mid[1], mid[2], cr * 0.75]);
    const side = polar(a + 0.4, reach * 0.85, y0 + reach * 0.28);
    small.push([side[0], side[1], side[2], cr * 0.7]);
  }
  // the crown: great limbs from the top of the trunk sweeping out and up,
  // each holding flat pads of leaf along its outer half, in tiers
  const cy = h * 0.85;
  const R = h * 0.4;
  const nLimbs = 7;
  const limbs = [];
  for (let i = 0; i < nLimbs; i++) {
    const a = (i / nLimbs) * TAU + rand() * 0.5;
    const y0 = h * (0.6 + rand() * 0.16);
    const reach = R * (0.62 + rand() * 0.3);
    const y1 = cy + (rand() - 0.55) * h * 0.12;
    const tr = trunkAt(r, h, y0);
    const end = polar(a + 0.18, reach, y1);
    branch([polar(a, tr * 0.25, y0), polar(a + 0.03, tr + reach * 0.16, y0 + (y1 - y0) * 0.5), polar(a + 0.1, reach * 0.6, y1 - 0.8), end], tr * 0.5, 0.15, seed * 5 + i);
    limbs.push({ a, reach, y: y1 });
    blobs.push([end[0], end[1] - 0.6, end[2], R * (0.26 + rand() * 0.06)]);
    const mid = polar(a + 0.1, reach * 0.62, y1 - 0.4);
    blobs.push([mid[0], mid[1] + R * 0.02, mid[2], R * (0.2 + rand() * 0.05)]);
    // and a lesser branch off it, with its own pad
    const b = polar(a + 0.55, reach * 0.82, y1 - 3 + rand() * 2);
    branch([polar(a + 0.1, reach * 0.48, y1 - 1.6), polar(a + 0.35, reach * 0.66, y1 - 2.4), b], 0.32, 0.08, seed * 7 + i);
    blobs.push([b[0], b[1] - 0.5, b[2], R * (0.19 + rand() * 0.05)]);
  }
  branch([[0, topY - 2, 0], [0.3, cy - 2, 0.2], [0.6, h * 0.97, -0.3]], capR * 0.7, 0.15, seed * 9);
  // and the higher tiers, filled in up to the top
  const fill = 9;
  for (let k = 0; k < fill; k++) {
    const a = k * 2.39996 + rand() * 0.4;
    const rr = R * (0.18 + 0.42 * ((k + 0.5) / fill));
    blobs.push([Math.cos(a) * rr, mix(h * 0.98, cy + 2, (k + 0.5) / fill), Math.sin(a) * rr, R * (0.2 + rand() * 0.05)]);
  }
  const centre = [0, cy, 0];
  for (const geo of crownBlobs(blobs, centre, { seed, span: R, detail: 2, squash: 0.42 })) bk.add(mats.canopy, geo, { uv: 0.09 });
  const lowCentre = [0, h * 0.4, 0];
  for (const geo of crownBlobs(small, lowCentre, { seed: seed + 3, span: h * 0.2, detail: 2, squash: 0.5 })) bk.add(mats.canopy, geo, { uv: 0.09 });
  bk.add(mats.leafCard, crownCards(blobs, centre, { seed, per: 26, size: R * 0.15, span: R, squash: 0.42 }));
  bk.add(mats.leafCard, crownCards(small, lowCentre, { seed: seed + 3, per: 18, size: h * 0.04, span: h * 0.2, squash: 0.5 }));
  bk.build(g);
  return { group: g, trunkR: r, height: h, radiusAt: (y) => trunkAt(r, h, y), crown: { y: cy, r: R, base: cy - R * 0.25 }, roots, branches: lows };
}

// A far mallorn for instancing, about 40 m: a silver trunk flaring at its
// foot, limbs sweeping out, and a broad crown of gold in flat tiers, all
// in vertex colours.
function mallornFarGeo(seed = 1) {
  const r = rng(seed * 11 + 3);
  const n = makeNoise(seed + 60);
  const H = 36 + r() * 8;
  const list = [];
  const R0 = 1.05;
  const trunkH = H * 0.78;
  const trunk = new THREE.CylinderGeometry(R0 * 0.62, R0, trunkH, 9, 6, true).translate(0, trunkH / 2 - 0.5, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const flare = 1 + Math.max(0, 1 - y / 3) * (0.55 + Math.sin(a * 3 + seed) * 0.4);
    tp.setX(i, tp.getX(i) * flare);
    tp.setZ(i, tp.getZ(i) * flare);
  }
  trunk.computeVertexNormals();
  const bark = (x, y, z, out) => {
    out.setRGB(0.58, 0.63, 0.67).multiplyScalar(0.92 + n(y * 0.2, Math.atan2(z, x)) * 0.14);
    out.lerp(_kc2.setRGB(0.32, 0.36, 0.28), (1 - smooth(0, 3, y)) * 0.55);
  };
  list.push(tint(trunk, bark));
  const cy = H * 0.84;
  const R = H * 0.36;
  const blobs = [];
  const limbs = 6;
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * TAU + r() * 0.7;
    const reach = R * (0.6 + r() * 0.3);
    const y1 = cy + (r() - 0.5) * H * 0.1;
    const end = polar(a, reach, y1);
    list.push(tint(tube([[0, H * 0.62, 0], polar(a, reach * 0.3, mix(H * 0.62, y1, 0.6)), end], 0.4, 0.1, { seg: 4, radial: 5 }), bark));
    blobs.push([end[0], end[1] - 0.5, end[2], R * (0.3 + r() * 0.06)]);
    const mid = polar(a + 0.12, reach * 0.6, y1 - 0.5);
    blobs.push([mid[0], mid[1], mid[2], R * 0.22]);
  }
  for (let k = 0; k < 5; k++) {
    const a = k * 2.39996 + r() * 0.5;
    const rr = R * (0.12 + 0.35 * ((k + 0.5) / 5));
    blobs.push([Math.cos(a) * rr, mix(H * 0.99, cy + 1.5, (k + 0.5) / 5), Math.sin(a) * rr, R * (0.24 + r() * 0.05)]);
  }
  list.push(...crownBlobs(blobs, [0, cy, 0], { seed: seed + 70, span: R, detail: 1, squash: 0.45 }));
  return oneGeo(list);
}

// ── flets ──

// A slab in plan between radii r0(a) and r1(a), from angle a0 to a1 (a
// whole ring if that is a full turn), its top at y = 0 and `t` thick, its
// boards running round it (u along the arc, v across, in metres × uvK).
// `walls`: inner, outer and ends, each true, false, or [from, to] for part
// of an edge.
function polarSlab(r0, r1, a0, a1, t, { rows = 2, step = 0.3, walls = {}, uvK = 0.8 } = {}) {
  const full = a1 - a0 >= TAU - 1e-6;
  const span = a1 - a0;
  const cols = Math.max(4, Math.ceil((span * r1((a0 + a1) / 2)) / step));
  const A = (j) => a0 + (span * j) / cols;
  const out = [];
  for (const [y, up] of [[0, true], [-t, false]]) {
    const pos = [];
    const uv = [];
    for (let i = 0; i <= rows; i++) {
      for (let j = 0; j <= cols; j++) {
        const a = A(j);
        const rho = mix(r0(a), r1(a), i / rows);
        pos.push(Math.cos(a) * rho, y, Math.sin(a) * rho);
        uv.push(a * mix(r0(a), r1(a), 0.5) * uvK, rho * uvK);
      }
    }
    out.push(geoOf(pos, gridIdx(rows, cols, !up), uv));
  }
  // an edge at radius rf(a) from angle w0 to w1, facing out or in
  const edge = (rf, w0, w1, outward) => {
    const n = Math.max(2, Math.ceil(((w1 - w0) * rf((w0 + w1) / 2)) / step));
    const pos = [];
    const uv = [];
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= n; j++) {
        const a = mix(w0, w1, j / n);
        const rho = rf(a);
        pos.push(Math.cos(a) * rho, i ? 0 : -t, Math.sin(a) * rho);
        uv.push(a * rho * uvK, (i ? 0 : -t) * uvK);
      }
    }
    out.push(geoOf(pos, gridIdx(1, n, outward), uv));
  };
  const range = (w) => (w === true ? [a0, a1] : w);
  const wi = walls.inner ?? true;
  const wo = walls.outer ?? true;
  if (wi) edge(r0, ...range(wi), false);
  if (wo) edge(r1, ...range(wo), true);
  if (!full && (walls.ends ?? true)) {
    for (const [a, first] of [[a0, true], [a1, false]]) {
      const p = [];
      const uv = [];
      for (const y of [-t, 0]) {
        for (const rho of [r0(a), r1(a)]) {
          p.push(Math.cos(a) * rho, y, Math.sin(a) * rho);
          uv.push(rho * uvK, y * uvK);
        }
      }
      out.push(geoOf(p, first ? [0, 2, 1, 1, 2, 3] : [0, 1, 2, 1, 3, 2], uv));
    }
  }
  return mergeGeometries(out.map((g) => g.toNonIndexed()));
}

// A balustrade along a line of points ([x, y, z], y its foot): a rounded
// handrail and a foot rail, two rails between that wave up and down out of
// step so they cross at every post and between, and slender posts that
// bow a little, each with a curling leaf on top. `posts` are indices into
// the line (default: its ends).
function flowingRail(bk, K, line, { h = 1.0, posts = null, waves = 1, rail = 0.042 } = {}) {
  const { mats } = K;
  const seg = Math.max(4, Math.ceil(line.length * 1.4));
  const at = (dy) => line.map(([x, y, z]) => [x, y + dy, z]);
  bk.add(mats.elfwood, tube(at(h), rail, rail, { seg, radial: 5, uvK: 1.2 }));
  bk.add(mats.elfwood, tube(at(0.1), rail * 0.7, rail * 0.7, { seg, radial: 3, uvK: 1.2 }));
  const P = posts ?? [0, line.length - 1];
  // the waving rails, a whole wave between each pair of posts
  for (const s of [-1, 1]) {
    const pts = [];
    for (let p = 0; p < P.length - 1; p++) {
      for (let i = P[p]; i < P[p + 1] + (p === P.length - 2 ? 1 : 0); i++) {
        const f = (i - P[p]) / Math.max(1, P[p + 1] - P[p]);
        const [x, y, z] = line[i];
        pts.push([x, y + h * 0.53 + s * h * 0.3 * Math.sin(f * TAU * waves), z]);
      }
    }
    if (pts.length > 2) bk.add(mats.elfwood, tube(pts, rail * 0.55, rail * 0.55, { seg: Math.max(4, Math.ceil(pts.length * 1.4)), radial: 3, uvK: 1.2 }));
  }
  for (const i of P) {
    const [x, y, z] = line[i];
    const q = line[Math.min(i + 1, line.length - 1)];
    const pp = line[Math.max(i - 1, 0)];
    const ry = -Math.atan2(q[2] - pp[2], q[0] - pp[0]);
    // which way is out: square to the line, in the ground plane
    const ox = Math.sin(ry + Math.PI);
    const oz = Math.cos(ry + Math.PI);
    bk.add(mats.elfwood, tube([[x, y, z], [x + ox * 0.035, y + h * 0.45, z + oz * 0.035], [x, y + h + 0.06, z]], 0.05, 0.034, { seg: 6, radial: 6 }));
    bk.add(mats.silver, leafBlade(0.24, 0.085, { curl: 0.9, seg: 3, thick: 0.008 }), { p: [x, y + h + 0.03, z], r: [0, ry + Math.PI, 0] });
  }
}

// An elven lantern hanging with its orb's middle at (x, y, z): a soft
// blue-white orb held in a cage of silver leaves (a calyx rising round it
// from beneath, a cap of leaves curling down over its shoulder, fine ribs
// between), a stem up to a ring to hang it by, and a drop beneath. `s`
// sizes it (1: the orb 0.24 across, the whole 0.74 tall). Returns where
// its ring hangs from.
function lanternParts(bk, K, x, y, z, s = 1) {
  const { mats } = K;
  bk.add(mats.lamp, ball(0.12 * s, 12, 9), { p: [x, y, z] });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const pts = [[0.015, -0.25], [0.08, -0.19], [0.14, -0.07], [0.145, 0.03], [0.12, 0.11], [0.05, 0.165]].map(([rr, hh]) => [x + Math.cos(a) * rr * s, y + hh * s, z + Math.sin(a) * rr * s]);
    bk.add(mats.silver, tube(pts, 0.006 * s, 0.005 * s, { seg: 8, radial: 3 }));
  }
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + TAU / 10;
    bk.add(mats.silver, leafBlade(0.2 * s, 0.075 * s, { curl: -1.2, seg: 3, thick: 0.005 * s }).rotateX(0.95), { p: [x + Math.cos(a) * 0.02 * s, y - 0.24 * s, z + Math.sin(a) * 0.02 * s], r: [0, Math.PI / 2 - a, 0] });
    bk.add(mats.silver, leafBlade(0.15 * s, 0.07 * s, { curl: 1.3, seg: 3, thick: 0.005 * s }).rotateX(Math.PI - 0.9), { p: [x + Math.cos(a) * 0.03 * s, y + 0.17 * s, z + Math.sin(a) * 0.03 * s], r: [0, Math.PI / 2 - a, 0] });
  }
  bk.add(mats.silver, lathe([[0.055, 0.15], [0.05, 0.18], [0.02, 0.215], [0.011, 0.24], [0.009, 0.42], [0.001, 0.425]].map(([rr, hh]) => [rr * s, hh * s]), 8), { p: [x, y, z] });
  bk.add(mats.silver, new THREE.TorusGeometry(0.03 * s, 0.007 * s, 3, 8), { p: [x, y + 0.45 * s, z] });
  bk.add(mats.silver, lathe([[0.001, -0.31], [0.014, -0.28], [0.018, -0.26], [0.009, -0.24], [0.001, -0.235]].map(([rr, hh]) => [rr * s, hh * s]), 6), { p: [x, y, z] });
  return y + 0.48 * s;
}

// A hanging elven lamp on its own, foot at y = 0: `light` is the orb's
// middle, `hook` where it hangs from.
function lantern(K) {
  const g = new THREE.Group();
  g.name = 'lantern';
  const bk = parts();
  const y = 0.31;
  const top = lanternParts(bk, K, 0, y, 0, 1);
  bk.build(g, { shadow: false });
  halo(K, g, 0, y, 0, 1.3);
  return { group: g, light: V3(0, y, 0), hook: V3(0, top, 0) };
}

// A flet: a ring of white-grey elven woodwork round a trunk `trunkR` thick,
// out to `r`, its floor's top at y = 0. Its edge waves gently, rounded, a
// skirt of hanging leaf-points below it, and curving ribs from lower on the
// trunk hold it up. Near the trunk on its +x side the floor is left open
// for a stair arriving from below (a spiralStair of radius trunkR + 0.6
// arriving at angle 0, coming round from +z): the stairwell runs from
// a = 0 to `hatch`, with a guard rail round it open at a = 0, where you step
// off. A balustrade of flowing rails runs round the edge (with `gate`
// radians open at +x if wanted), and three tall posts curve out over the
// edge, each hung with a lantern.
function flet(K, { r = 4.5, trunkR = 1.8, hatch = 1.15, gate = 0 } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'flet';
  const bk = parts();
  const T = 0.22;
  const well = trunkR + 1.3;
  const edge = (a) => r * (1 + 0.026 * Math.sin(a * 5 + 0.6) + 0.013 * Math.sin(a * 11 + 2.1));
  const inner = () => trunkR + 0.02;
  // the floor: a band round the trunk with the stairwell left open in it,
  // and the ring outside it
  bk.add(mats.elfwood, polarSlab(inner, () => well, hatch, TAU, T, { walls: { outer: false } }));
  bk.add(mats.elfwood, polarSlab(() => well, edge, 0, TAU, T, { rows: 3, walls: { inner: [0, hatch] } }));
  // a rounded lip round the edge, and a collar round the trunk
  const lip = [];
  for (let i = 0; i < 72; i++) lip.push(V3(...polar((i / 72) * TAU, edge((i / 72) * TAU) + 0.01, -0.03)));
  bk.add(mats.elfwood, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lip, true), 108, 0.075, 5, true));
  bk.add(mats.elfwood, new THREE.TorusGeometry(trunkR + 0.06, 0.08, 6, 48, TAU - hatch).rotateX(Math.PI / 2).rotateY(-hatch));
  // the skirt: hanging leaf-points under the edge, outside and in
  const nS = Math.round((TAU * r) / 0.95);
  for (const [off, outward] of [[0.015, true], [-0.04, false]]) {
    const M = nS * 8;
    const pos = [];
    const uv = [];
    for (let i = 0; i <= 1; i++) {
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * TAU;
        const rho = edge(a) + off;
        const drop = 0.1 + 0.2 * Math.pow(Math.abs(Math.sin((a * nS) / 2)), 0.6);
        const y = i ? -T + 0.02 : -T - drop;
        pos.push(Math.cos(a) * rho, y, Math.sin(a) * rho);
        uv.push(a * rho * 0.8, y * 0.8);
      }
    }
    bk.add(mats.elfwood, geoOf(pos, gridIdx(1, M, outward), uv));
  }
  // ribs beneath, sweeping out from low on the trunk to the edge, like
  // the veins of a leaf; none where the stair comes up beneath the well
  const nRibs = 10;
  for (let i = 0; i < nRibs; i++) {
    const a = (i / nRibs) * TAU + 0.2;
    if (a > -0.15 && a < hatch + 0.45) continue;
    const e = edge(a);
    const pts = [polar(a, trunkR - 0.15, -3.2), polar(a, trunkR + 0.45, -1.55), polar(a, mix(trunkR, e, 0.62), -0.5), polar(a, e - 0.3, -T - 0.02)];
    bk.add(mats.elfwood, tube(pts, 0.17, 0.07, { seg: 10, radial: 5, uvK: 1.2 }));
  }
  // a ring beam under the floor, on the ribs
  const beam = [];
  for (let i = 0; i < 48; i++) beam.push(V3(...polar((i / 48) * TAU, mix(trunkR, r, 0.7), -T - 0.06)));
  bk.add(mats.elfwood, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(beam, true), 64, 0.07, 4, true));
  // the balustrade round the edge
  const step = 0.08;
  const a0 = gate > 0 ? gate / 2 : 0;
  const a1 = gate > 0 ? TAU - gate / 2 : TAU;
  const nB = Math.max(3, Math.round(((a1 - a0) * r) / 1.75));
  const per = Math.max(2, Math.round((a1 - a0) / nB / step));
  const line = [];
  for (let i = 0; i <= nB * per; i++) {
    const a = mix(a0, a1, i / (nB * per));
    line.push(polar(a, edge(a) - 0.17, 0));
  }
  const posts = [];
  for (let k = 0; k <= nB; k++) posts.push(k * per);
  if (gate <= 0) {
    // closed: run the rail on past its start so the tubes meet smoothly
    line.push(line[1]);
  }
  flowingRail(bk, K, line, { posts });
  // the rail round the stairwell: along its outer edge, then in to the
  // trunk at its far end; open at a = 0
  const wl = [];
  const wr = well - 0.08;
  for (let a = 0.14; a < hatch - 0.06; a += 0.08) wl.push(polar(a, wr, 0));
  wl.push(polar(hatch - 0.06, wr, 0));
  for (let k = 1; k <= 4; k++) wl.push(polar(hatch - 0.06, mix(wr, trunkR + 0.14, k / 4), 0));
  flowingRail(bk, K, wl, { posts: [0, wl.length - 5, wl.length - 1], h: 0.95 });
  // three tall posts curving out over the edge, a lantern from each
  const lamps = [];
  const spots = [hatch + 1.1, hatch + 2.75, hatch + 4.25].map((a) => (gate > 0 ? Math.max(gate / 2 + 0.3, Math.min(TAU - gate / 2 - 0.3, a)) : a));
  for (const a of spots) {
    const e = edge(a) - 0.17;
    const pts = [polar(a, e, 0), polar(a, e + 0.02, 1.2), polar(a, e - 0.04, 2.3), polar(a, e + 0.3, 2.85), polar(a, e + 0.75, 2.9), polar(a, e + 0.98, 2.72)];
    bk.add(mats.elfwood, tube(pts, 0.06, 0.03, { seg: 18, radial: 6, uvK: 1.2 }));
    bk.add(mats.silver, leafBlade(0.32, 0.1, { curl: -0.8, seg: 3, thick: 0.008 }), { p: polar(a, e + 0.05, 2.35), r: [0, Math.PI / 2 - a, 0] });
    const [lx, , lz] = polar(a, e + 0.98, 0);
    const ly = 2.72 - 0.06 - 0.48;
    bk.add(mats.silver, cyl(0.006, 0.006, 0.06, 4), { p: [lx, 2.72 - 0.03, lz] });
    lanternParts(bk, K, lx, ly, lz, 1);
    halo(K, g, lx, ly, lz, 1.4);
    lamps.push(V3(lx, ly, lz));
  }
  bk.build(g);
  return { group: g, lamps, radius: r, landing: V3(trunkR + 0.6, 0, 0), well: { r0: trunkR, r1: well, a0: 0, a1: hatch }, edge };
}

// ── stairs ──

// A stair winding up round a trunk of radius r − 0.6: treads 1.2 m wide
// (r − 0.6 to r + 0.6, set a little into the trunk) hung from it on curving
// brackets, an outer string beneath their ends, and a thin handrail on the
// outside on slender balusters, curling at its foot. It starts at angle
// `start` on the ground (the point (cos a·r, 0, sin a·r)) and climbs `rise`
// in `turns` turns anticlockwise seen from above (as a turn about +y: the
// angle falls as it climbs), so it arrives at angle start − turns·2π.
// at(k), k from 0 to 1, is the treads' centre line, for a walker. Unless
// `lamps` is false, lanterns hang out from the handrail, three to a turn.
function spiralStair(K, { r = 2.4, rise = 18, turns = 1.25, start = 0, lamps = true } = {}) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'spiralStair';
  const bk = parts();
  const span = turns * TAU;
  const angle = (k) => start - k * span;
  const at = (k, out = V3()) => out.set(Math.cos(angle(k)) * r, k * rise, Math.sin(angle(k)) * r);
  const steps = Math.max(4, Math.round(rise / 0.2));
  const da = (span / steps) * 0.58;
  const r0 = r - 0.75;
  const r1 = r + 0.6;
  for (let i = 1; i < steps; i++) {
    const k = i / steps;
    const a = angle(k);
    const y = k * rise;
    // a tread: a slice of a ring, its outer end rounded
    const s = new THREE.Shape();
    const n = 3;
    for (let j = 0; j <= n; j++) {
      const b = a - da + (2 * da * j) / n;
      if (j) s.lineTo(Math.cos(b) * r0, Math.sin(b) * r0);
      else s.moveTo(Math.cos(b) * r0, Math.sin(b) * r0);
    }
    const ro = r1 - 0.06;
    s.lineTo(Math.cos(a + da) * ro, Math.sin(a + da) * ro);
    s.quadraticCurveTo(Math.cos(a + da * 0.5) * (r1 + 0.05), Math.sin(a + da * 0.5) * (r1 + 0.05), Math.cos(a) * (r1 + 0.04), Math.sin(a) * (r1 + 0.04));
    s.quadraticCurveTo(Math.cos(a - da * 0.5) * (r1 + 0.05), Math.sin(a - da * 0.5) * (r1 + 0.05), Math.cos(a - da) * ro, Math.sin(a - da) * ro);
    bk.add(mats.elfwood, slab(s, 0.075).translate(0, y, 0), { uv: 0.9 });
    // a bracket under every third, from the trunk below out to the string
    if (i % 3 === 0) bk.add(mats.elfwood, tube([polar(a, r0 + 0.05, y - 1.1), polar(a, r - 0.3, y - 0.45), polar(a, r1 - 0.12, y - 0.16)], 0.07, 0.04, { seg: 6, radial: 5, uvK: 1.2 }));
  }
  // the outer string, the handrail and a mid rail, each a helix
  const helix = (rho, dy, k0 = 0, k1 = 1) => {
    const n = Math.max(8, Math.ceil(turns * 40));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const k = mix(k0, k1, i / n);
      pts.push(polar(angle(k), rho, k * rise + dy));
    }
    return pts;
  };
  const kIn = 0.6 / steps;
  bk.add(mats.elfwood, tube(helix(r1 - 0.1, -0.16, kIn, 1), 0.075, 0.075, { seg: Math.ceil(turns * 64), radial: 5, uvK: 1.2 }));
  const hr = r1 - 0.06;
  // the handrail, curling into a scroll at its foot
  const foot = [];
  const a0 = angle(kIn * 2);
  const y0 = kIn * 2 * rise + 0.95;
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const b = a0 + (1 - t) * 0.8;
    const rr = hr + (1 - t) * 0.3 * Math.cos(t * 4.5);
    foot.push(polar(b, rr, mix(0.7, y0, smooth(0, 1, t))));
  }
  const rail = [...foot.slice(0, -1), ...helix(hr, 0.95, kIn * 2, 1)];
  bk.add(mats.elfwood, tube(rail, 0.042, 0.042, { seg: Math.ceil(turns * 80), radial: 5, uvK: 1.2 }));
  bk.add(mats.elfwood, tube(helix(hr, 0.45, kIn * 2, 1), 0.026, 0.026, { seg: Math.ceil(turns * 56), radial: 3, uvK: 1.2 }));
  // balusters on every other tread, bowing out a little
  for (let i = 2; i < steps; i += 2) {
    const k = i / steps;
    const a = angle(k);
    const y = k * rise;
    bk.add(mats.elfwood, tube([polar(a, hr, y - 0.02), polar(a, hr + 0.04, y + 0.45), polar(a, hr, y + 0.95)], 0.024, 0.02, { seg: 4, radial: 3, uvK: 1.2 }));
  }
  // lanterns hung out from the handrail, three to a turn
  const lights = [];
  if (lamps) {
    const nL = Math.max(1, Math.round(turns * 3));
    for (let i = 0; i < nL; i++) {
      const k = (i + 0.6) / (nL + 0.4);
      const a = angle(k);
      const y = k * rise + 0.95;
      bk.add(mats.elfwood, tube([polar(a, hr, y - 0.02), polar(a, hr + 0.2, y + 0.35), polar(a, hr + 0.5, y + 0.42), polar(a, hr + 0.62, y + 0.32)], 0.022, 0.014, { seg: 10, radial: 4, uvK: 1.2 }));
      const [lx, , lz] = polar(a, hr + 0.62, 0);
      const ly = y + 0.32 - 0.48 * 0.8;
      lanternParts(bk, K, lx, ly, lz, 0.8);
      halo(K, g, lx, ly, lz, 1.1);
      lights.push(V3(lx, ly, lz));
    }
  }
  bk.build(g);
  return { group: g, at, steps, start, end: angle(1), top: at(1), radius: r, lamps: lights };
}

// ── small growing things ──

// A fern for instancing, about a metre across: a dozen fronds arching up
// and out from the middle and drooping at their tips, each a stalk with
// leaflets either side that shorten towards its tip, pale green, dark at
// the heart, a few touched with gold. Each leaflet is wound both ways with
// its normal up, so it lights like the ground from either side on a
// single-sided material (double-sided, a leaflet seen from behind lit black).
function fernGeo(seed = 1) {
  const r = rng(seed * 23 + 5);
  const pos = [];
  const col = [];
  const nor = [];
  const heart = C(0x34502a);
  const mid = C(0x7ea456);
  const tipC = C(0xc8e098);
  const gold = C(0xd8cc78);
  const c = new THREE.Color();
  const fronds = 16 + Math.floor(r() * 6);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + r() * 0.4;
    const L = 0.45 + r() * 0.5;
    const up = 0.95 + r() * 0.4;
    const droop = 0.6 + r() * 0.3;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const goldish = r() < 0.22;
    const at = (s) => [dx * s * L * 0.92, L * (1.15 * s * Math.sin(up) - droop * s * s), dz * s * L * 0.92];
    const SEG = 16;
    for (let i = 0; i < SEG; i++) {
      const s0 = i / SEG;
      const s1 = (i + 1) / SEG;
      const p0 = at(s0);
      const p1 = at(s1);
      const len = L * 0.2 * Math.pow(Math.sin(Math.PI * Math.min(1, s0 * 0.85 + 0.15)), 0.7);
      c.copy(heart).lerp(mid, smooth(0, 0.4, s0)).lerp(goldish ? gold : tipC, smooth(0.45, 1, s0) * 0.8);
      for (const side of [-1, 1]) {
        const mx = (p0[0] + p1[0]) / 2;
        const my = (p0[1] + p1[1]) / 2;
        const mz = (p0[2] + p1[2]) / 2;
        const tip = [mx - dz * side * len + dx * len * 0.35, my - len * 0.3, mz + dx * side * len + dz * len * 0.35];
        for (const face of [[p0, p1, tip], [p0, tip, p1]]) {
          for (const v of face) {
            pos.push(...v);
            const k = v === tip ? 1.15 : 1;
            col.push(c.r * k, c.g * k, c.b * k);
            nor.push(dx * 0.25, 0.95, dz * 0.25);
          }
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// A scatter of fallen mallorn leaves for instancing on the ground: a
// hundred or so within about 2.5 m, thicker towards the middle, each a
// long pointed leaf folded along its midrib, in golds, a few silver-grey
// and a few gone brown.
function goldLeavesGeo(seed = 1) {
  const r = rng(seed * 17 + 9);
  const pos = [];
  const col = [];
  const hues = [LEAF.gold, LEAF.gold, LEAF.deep, LEAF.deep, LEAF.inner, C(0xd8a840), C(0xe6c870), C(0xb88a30), C(0xd4d0b8)];
  const c = new THREE.Color();
  const count = 230 + Math.floor(r() * 40);
  for (let k = 0; k < count; k++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 0.6) * 2.5;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const y = 0.006 + r() * 0.025;
    const len = 0.12 + r() * 0.09;
    const wid = len * (0.28 + r() * 0.1);
    const turn = r() * TAU;
    const fold = 0.006 + r() * 0.01;
    const tilt = (r() - 0.5) * 0.3;
    c.copy(hues[Math.floor(r() * hues.length)]).multiplyScalar(0.62 + r() * 0.3);
    const P = (u, v, lift) => {
      const lx = u * len;
      const lz = v * wid;
      return [x + Math.cos(turn) * lx - Math.sin(turn) * lz, y + lift + lx * tilt, z + Math.sin(turn) * lx + Math.cos(turn) * lz];
    };
    const base = P(-0.5, 0, 0);
    const tip = P(0.5, 0, 0.004);
    const l = P(-0.08, -0.5, 0);
    const rr = P(-0.08, 0.5, 0);
    const midP = P(0, 0, fold);
    for (const tri of [[base, midP, l], [midP, tip, l], [base, rr, midP], [midP, rr, tip]]) {
      for (const v of tri) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const nr = geo.attributes.normal;
  for (let k = 0; k < nr.count; k++) if (nr.getY(k) < 0) nr.setXYZ(k, -nr.getX(k), -nr.getY(k), -nr.getZ(k));
  geo.computeBoundingSphere();
  return geo;
}

// Little star-flowers among the ferns, elanor gold and niphredil white:
// each a five-pointed star on a thin stalk, at the points given ([x, y, z],
// y the ground), all in one geometry.
function flowersGeo(points, seed = 1) {
  const r = rng(seed * 3 + 1);
  const pos = [];
  const col = [];
  const nor = [];
  const gold = C(0xffd24a);
  const white = C(0xf4f6ff);
  const stalk = C(0x4a6a2a);
  for (const [x, y, z] of points) {
    const h = 0.1 + r() * 0.12;
    const rad = 0.035 + r() * 0.02;
    const c = r() < 0.55 ? gold : white;
    const tilt = (r() - 0.5) * 0.5;
    const turn = r() * TAU;
    const top = y + h;
    // the stalk, a thin blade
    pos.push(x - 0.005, y, z, x + 0.005, y, z, x, top, z);
    for (let k = 0; k < 3; k++) {
      col.push(stalk.r, stalk.g, stalk.b);
      nor.push(0, 0, 1);
    }
    for (let k = 0; k < 5; k++) {
      const a0 = turn + (k / 5) * TAU;
      const a1 = a0 + TAU / 10;
      const a2 = a0 - TAU / 10;
      const P = (a, rr) => [x + Math.cos(a) * rr, top + Math.cos(a) * rr * tilt, z + Math.sin(a) * rr];
      for (const v of [[x, top + 0.004, z], P(a2, rad * 0.4), P(a0, rad), [x, top + 0.004, z], P(a0, rad), P(a1, rad * 0.4)]) {
        pos.push(...v);
        col.push(c.r, c.g, c.b);
        nor.push(0, 1, 0);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// ── Galadriel's Mirror ──

// Galadriel's Mirror in its hollow: a dell whose floor is at y = 0, ringed
// by a bank rising to a crest about 1.7 m high some 7.2 m out and falling
// away outside to the ground by 13.5 m. Great silver roots arch over the
// bank and down into the hollow, ferns and small star-flowers grow on it,
// and on the +z side a short curved flight of pale stone steps comes down
// from the crest. In the middle, on a low round dais, a carved pedestal
// holds the shallow silver basin (its rim 1 m up and 1.45 m across), and
// beside it a silver ewer stands on a low stand. The water's shader shows
// visions: vision(k, kind), k from 0 (still water) to 1, kind 'still'
// (stars), 'eye' or 'shire'. update(t) runs it.
function mirror(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'mirror';
  const bk = parts();
  const rand = rng(77);
  const n = makeNoise(78);
  const FLOOR = 4.8;
  const CREST = 7.2;
  const RIM = 1.7;
  const FOOT = 13.5;
  // the steps' line in plan, from the crest (k = 0) down to the floor (1)
  const stepRho = (k) => mix(CREST + 0.6, FLOOR - 0.4, k);
  const stepA = (k) => mix(Math.PI / 2 + 0.5, Math.PI / 2 - 0.12, k);
  const stepAt = (k, out = V3()) => out.set(Math.cos(stepA(k)) * stepRho(k), RIM * (1 - k), Math.sin(stepA(k)) * stepRho(k));
  const path = [];
  for (let i = 0; i <= 40; i++) path.push(stepAt(i / 40));
  const nearSteps = (x, z) => {
    let best = 1e9;
    let bk2 = 0;
    path.forEach((p, i) => {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        bk2 = i / 40;
      }
    });
    return [best, bk2];
  };
  const crestY = (a) => RIM * (1 + (n(Math.cos(a) * 1.4 + 4, Math.sin(a) * 1.4 + 2) - 0.5) * 0.45);
  const bankY = (rho, a) => {
    const top = crestY(a);
    let y;
    if (rho <= FLOOR) y = 0;
    else if (rho <= CREST) y = top * smooth(FLOOR, CREST, rho);
    else y = top * (1 - smooth(CREST, FOOT, rho));
    const x = Math.cos(a) * rho;
    const z = Math.sin(a) * rho;
    const bell = smooth(FLOOR - 0.2, FLOOR + 0.8, rho) * (1 - smooth(FOOT - 1.8, FOOT, rho));
    y += (noise3(n, x * 0.45, 3.3, z * 0.45) - 0.5) * 0.55 * bell + (n(x * 1.3 + 7, z * 1.3) - 0.5) * 0.06;
    // the cut the steps come down in
    const [d, k] = nearSteps(x, z);
    const want = RIM * (1 - k) - 0.08;
    const w = 1 - smooth(0.95, 1.8, d);
    return mix(y, Math.min(y, want), w);
  };
  // the ground: rings out from under the dais to the bank's outer foot
  const rings = [1.6, 2.4, 3.2, 3.9, 4.4, 4.8, 5.1, 5.4, 5.7, 6.0, 6.3, 6.6, 6.9, 7.2, 7.5, 7.9, 8.4, 9.0, 9.8, 10.7, 11.7, 12.6, 13.5];
  const AR = 112;
  const pos = [];
  for (const rho of rings) {
    for (let i = 0; i <= AR; i++) {
      const a = (i / AR) * TAU;
      pos.push(Math.cos(a) * rho, bankY(rho, a), Math.sin(a) * rho);
    }
  }
  const ground = weldSeam(geoOf(pos, gridIdx(rings.length - 1, AR)), rings.length, AR);
  const moss = C(0x46522a);
  const mossLit = C(0x76843e);
  const earthC = C(0x4e4030);
  const litter = C(0xbc9c4c);
  ground.computeVertexNormals();
  weldSeam(ground, rings.length, AR);
  paintGeo(ground, (p, nrm, out) => {
    const rho = Math.hypot(p.x, p.z);
    out.copy(moss).lerp(mossLit, smooth(0.3, 0.8, n(p.x * 0.4 + 2, p.z * 0.4)) * 0.7);
    // bare earth where the bank is steep
    out.lerp(earthC, smooth(0.85, 0.55, nrm.y) * 0.75);
    // gold leaves lying in drifts, thicker on the floor
    const drift = smooth(0.4, 0.66, fbm(n, p.x * 0.35 + 5, p.z * 0.35, { octaves: 3 }));
    out.lerp(litter, drift * (rho < FLOOR + 0.3 ? 0.85 : 0.6));
  });
  bk.add(mats.earth, ground, { uv: 0.35 });
  // the dais, with a line of silver inlaid round it
  bk.add(mats.paleStone, lathe([[0.001, 0.08], [1.85, 0.08], [1.95, 0.06], [2.0, 0.02], [2.03, -0.15]], 56), { uv: 0.7 });
  bk.add(mats.silver, new THREE.TorusGeometry(1.62, 0.012, 3, 72).rotateX(Math.PI / 2), { p: [0, 0.08, 0] });
  // the pedestal, carved stone, with three stems twining up it
  const P0 = 0.08;
  bk.add(mats.paleStone, lathe([[0.46, 0], [0.46, 0.06], [0.4, 0.1], [0.38, 0.14], [0.27, 0.2], [0.2, 0.28], [0.15, 0.4], [0.14, 0.52], [0.15, 0.6], [0.2, 0.66], [0.3, 0.7], [0.36, 0.73]].map(([rr, y]) => [rr, y + P0]), 28), { uv: 1.4 });
  for (let k = 0; k < 3; k++) {
    const vine = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const y = mix(0.16, 0.68, t);
      const rr = (y < 0.28 ? mix(0.26, 0.19, (y - 0.16) / 0.12) : y > 0.6 ? mix(0.15, 0.22, (y - 0.6) / 0.08) : 0.15) + 0.018;
      vine.push(polar((k / 3) * TAU + t * TAU * 0.8, rr, y + P0));
    }
    bk.add(mats.paleStone, tube(vine, 0.022, 0.014, { seg: 36, radial: 4 }), { uv: 2 });
    for (let i = 4; i < 24; i += 5) {
      const [vx, vy, vz] = vine[i];
      const a = Math.atan2(vz, vx);
      bk.add(mats.paleStone, leafBlade(0.1, 0.045, { curl: 0.9, seg: 3, thick: 0.006 }), { p: [vx, vy, vz], r: [0, Math.PI / 2 - a, (i % 10 ? 0.7 : -0.7)], uv: 2 });
    }
  }
  // the basin: a shallow bowl of silver, a ring of silver leaves under its lip
  const B0 = P0 + 0.72;
  bk.add(mats.silver, lathe([[0.1, 0], [0.3, 0.02], [0.48, 0.07], [0.62, 0.14], [0.7, 0.19], [0.725, 0.2], [0.72, 0.215], [0.69, 0.215], [0.66, 0.19], [0.5, 0.13], [0.3, 0.09], [0.001, 0.08]].map(([rr, y]) => [rr, y + B0]), 48));
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    bk.add(mats.silver, leafBlade(0.16, 0.06, { curl: 0.7, seg: 3, thick: 0.006 }).rotateX(Math.PI - 0.5), { p: polar(a, 0.69, B0 + 0.175), r: [0, Math.PI / 2 - a, 0] });
  }
  const WY = B0 + 0.175;
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 },
    uK: { value: 0 },
    uKind: { value: 0 },
    uNight: K.night,
    uShire: { value: K.tex.shire },
  };
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.625, 48).rotateX(-Math.PI / 2), mirrorWaterMaterial(uniforms));
  water.name = 'mirrorWater';
  water.position.y = WY;
  water.renderOrder = 1;
  g.add(water);
  // the ewer's stand, and the ewer on it, its spout towards the basin
  const SA = 0.32;
  const [sx, , sz] = polar(SA, 1.32, 0);
  bk.add(mats.paleStone, lathe([[0.22, 0], [0.22, 0.05], [0.15, 0.09], [0.11, 0.2], [0.11, 0.34], [0.16, 0.4], [0.2, 0.43], [0.2, 0.46], [0.001, 0.47]].map(([rr, y]) => [rr, y + P0]), 20), { p: [sx, 0, sz], uv: 1.4 });
  const ewer = new THREE.Group();
  ewer.name = 'ewer';
  ewer.position.set(sx, P0 + 0.47, sz);
  ewer.rotation.y = Math.atan2(sz, -sx);
  const ek = parts();
  ek.add(mats.silver, lathe([[0.001, 0], [0.065, 0], [0.07, 0.012], [0.05, 0.03], [0.06, 0.05], [0.1, 0.1], [0.115, 0.16], [0.105, 0.22], [0.07, 0.27], [0.042, 0.31], [0.036, 0.36], [0.04, 0.4], [0.056, 0.43], [0.05, 0.442], [0.034, 0.42], [0.03, 0.38]], 20));
  ek.add(mats.silver, tube([[0.08, 0.15, 0], [0.15, 0.22, 0], [0.2, 0.33, 0], [0.25, 0.4, 0]], 0.02, 0.009, { seg: 10, radial: 6 }));
  ek.add(mats.silver, tube([[-0.035, 0.39, 0], [-0.13, 0.38, 0], [-0.16, 0.28, 0], [-0.1, 0.15, 0]], 0.012, 0.011, { seg: 12, radial: 5 }));
  ek.add(mats.silver, leafBlade(0.1, 0.04, { curl: -0.8, seg: 3, thick: 0.005 }), { p: [-0.12, 0.39, 0], r: [0, Math.PI / 2, 0] });
  ek.build(ewer);
  ewer.userData.spout = V3(0.25, 0.4, 0);
  g.add(ewer);
  // the steps down from the crest: curved treads following the flight,
  // a low stepped parapet either side
  const N = 8;
  const side = (k, off) => {
    const p = stepAt(k);
    const q = stepAt(Math.min(1, k + 0.01));
    const o = stepAt(Math.max(0, k - 0.01));
    const tx = q.x - o.x;
    const tz = q.z - o.z;
    const l = Math.hypot(tx, tz) || 1;
    return [p.x - (tz / l) * off, p.z + (tx / l) * off];
  };
  for (let i = 0; i < N; i++) {
    const k0 = Math.max(0, i / N - 0.02);
    const k1 = Math.min(1, (i + 1) / N + 0.02);
    const top = (RIM * (N - i)) / (N + 1);
    const pts = [];
    for (let j = 0; j <= 4; j++) pts.push(side(mix(k0, k1, j / 4), -0.8));
    for (let j = 4; j >= 0; j--) pts.push(side(mix(k0, k1, j / 4), 0.8));
    const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    bk.add(mats.paleStone, slab(shape, 0.36 + (i === N - 1 ? 0 : 0.12), 0.03).translate(0, top, 0), { uv: 0.8 });
    for (const off of [-0.98, 0.98]) {
      const [ax, az] = side(k0, off);
      const [bx, bz] = side(k1, off);
      const ry = Math.atan2(bx - ax, bz - az);
      const len2 = Math.hypot(bx - ax, bz - az) + 0.06;
      bk.add(mats.paleStone, roundBox(0.26, 0.9, len2, 0.04), { p: [(ax + bx) / 2, top - 0.05, (az + bz) / 2], r: [0, ry, 0], uv: 0.8 });
    }
  }
  // stepping stones on to the dais
  const sb = stepAt(1);
  for (let i = 1; i <= 2; i++) {
    const f = i / 3;
    bk.add(mats.paleStone, roundBox(0.7, 0.12, 0.55, 0.05), { p: [mix(sb.x, 0, f * 0.75), 0.03, mix(sb.z, 0, f * 0.75)], r: [0, 0.3 * i, 0], uv: 0.8 });
  }
  // great roots arching over the bank into the hollow
  const rootAt = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + rand() * 0.35;
    const [d] = nearSteps(Math.cos(a) * 7, Math.sin(a) * 7);
    if (d < 2.2) continue;
    rootAt.push(a);
  }
  const barkC = barkTint(n, 50);
  rootAt.forEach((a, i) => {
    const wob = (rand() - 0.5) * 0.35;
    // a root humps up out of the ground and sinks again as it goes
    const rhos = [12.6, 11.2, 9.9, 8.7, 7.7, 6.8, 6.0, 5.2, 4.4];
    const lift = [-0.6, 0.0, -0.22, 0.18, 0.12, -0.12, 0.1, -0.05, -0.38];
    const pts = rhos.map((rho, j) => {
      const b = a + wob * (j / 8) + Math.sin(j * 1.3 + i) * 0.035;
      return polar(b, rho, bankY(rho, b) + lift[j]);
    });
    const r0 = 0.46 + rand() * 0.16;
    bk.add(mats.bark, tint(tube(pts, r0, 0.09, { seg: 22, radial: 7, gnarl: 0.16, seed: 300 + i, uvK: 0.45 }), (x, y, z, out) => barkC(x, y * 0.5, z, out).multiplyScalar(0.8)));
    // and a lesser root off it
    const j = 3 + (i % 3);
    const [bx, by, bz] = pts[j];
    const b2 = a + (i % 2 ? 0.25 : -0.25);
    const end = polar(b2, rhos[j] - 2.2, bankY(rhos[j] - 2.2, b2) - 0.2);
    const midR = polar((a + b2) / 2, rhos[j] - 1.1, bankY(rhos[j] - 1.1, (a + b2) / 2) + 0.12);
    bk.add(mats.bark, tint(tube([[bx, by - 0.1, bz], midR, end], r0 * 0.45, 0.05, { seg: 8, radial: 5, gnarl: 0.15, seed: 340 + i, uvK: 0.45 }), (x, y, z, out) => barkC(x, y * 0.5, z, out).multiplyScalar(0.8)));
  });
  // ferns and flowers on the bank and round the floor's edge
  const fernGeos = [fernGeo(1), fernGeo(2), fernGeo(3)];
  const flowers = [];
  let tries = 0;
  let placed = 0;
  while (placed < 30 && tries < 500) {
    tries++;
    const a = rand() * TAU;
    const rho = mix(4.3, 11.5, Math.pow(rand(), 0.8));
    const x = Math.cos(a) * rho;
    const z = Math.sin(a) * rho;
    if (nearSteps(x, z)[0] < 1.3) continue;
    const y = bankY(rho, a);
    const geo = fernGeos[placed % 3].clone();
    const s = 0.8 + rand() * 0.7;
    bk.add(mats.fern, geo, { p: [x, y - 0.04, z], r: [0, rand() * TAU, 0], s });
    placed++;
  }
  for (let i = 0; i < 70; i++) {
    const a = rand() * TAU;
    const rho = mix(2.4, 7.8, rand());
    const x = Math.cos(a) * rho;
    const z = Math.sin(a) * rho;
    if (nearSteps(x, z)[0] < 1.0) continue;
    flowers.push([x, bankY(rho, a), z]);
  }
  bk.add(mats.petal, flowersGeo(flowers, 5));
  bk.build(g);
  const KIND = { still: 0, stars: 0, eye: 1, shire: 2 };
  return {
    group: g,
    water: V3(0, WY, 0),
    ewer,
    uniforms,
    vision(k, kind) {
      uniforms.uK.value = clamp01(k);
      if (kind != null && KIND[kind] != null) uniforms.uKind.value = KIND[kind];
    },
    update(t) {
      uniforms.uTime.value = t;
    },
    steps: { at: stepAt, top: stepAt(0), bottom: stepAt(1) },
    rim: { r: CREST, y: RIM },
    floor: FLOOR,
    outer: FOOT,
  };
}

// ── the boat ──

// An elven boat, 6 m long and 1.2 m in the beam, grey-white and slender as
// a leaf: its hull sweeps up at either end, the prow rising into a swan's
// neck and head, the stern into an upswept tip; silver inlaid under the
// gunwale and in a folded wing on either bow, small decks at either end,
// ribs and floorboards inside (the boards above the water she draws), and
// two thwarts, each with a leaf-bladed paddle laid on the boards by it. Faces +x,
// its keel at y = 0; it floats with about 0.16 m under the water. Its
// seats are where a sitter's seat goes (bow first); the paddles are groups
// (shaft along their own y, blade at −y, the origin mid-shaft) to take up.
function boat(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'boat';
  const bk = parts();
  const HL = 3;
  const beam = (t) => 0.6 * Math.pow(Math.max(0, 1 - t * t), 0.62) * (1 - 0.05 * t);
  const keel = (t) => 0.02 + 0.22 * Math.pow(Math.abs(t), 3);
  const sheer = (t) => 0.47 + 0.3 * Math.pow(Math.abs(t), 4) + (t > 0 ? 0.14 * Math.pow(t, 8) : 0);
  // a point on the hull: t along it (-1 the stern, +1 the bow), f round it
  // (-1 the port gunwale, 0 the keel, +1 starboard), `inset` in from outside
  const hull = (t, f, inset = 0) => {
    const w = Math.max(0, beam(t) - inset);
    const yk = keel(t) + inset;
    const ys = sheer(t);
    const s = Math.sin((f * Math.PI) / 2);
    const c = 1 - Math.cos((f * Math.PI) / 2);
    return [t * HL, yk + (ys - yk) * Math.pow(c, 1.3), w * s];
  };
  const NT = 44;
  const NF = 16;
  const ts = [];
  for (let i = 0; i <= NT; i++) ts.push(Math.sin(((i / NT) * 2 - 1) * (Math.PI / 2)));
  const skin = (inset, outside) => {
    const pos = [];
    const uv = [];
    for (const t of ts) {
      for (let j = 0; j <= NF; j++) {
        const f = (j / NF) * 2 - 1;
        pos.push(...hull(t, f, inset));
        uv.push(t * HL * 0.9, f * 1.1);
      }
    }
    return geoOf(pos, gridIdx(NT, NF, outside), uv);
  };
  bk.add(mats.boat, skin(0, true));
  bk.add(mats.boat, skin(0.03, false));
  // the gunwale, round both sides and through both ends
  const gun = [];
  for (let i = 1; i < NT; i++) gun.push(V3(...hull(ts[i], 1, 0.015)).setY(sheer(ts[i]) + 0.012));
  gun.push(V3(HL, sheer(1) + 0.012, 0));
  for (let i = NT - 1; i > 0; i--) gun.push(V3(...hull(ts[i], -1, 0.015)).setY(sheer(ts[i]) + 0.012));
  gun.push(V3(-HL, sheer(-1) + 0.012, 0));
  bk.add(mats.boat, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gun, true), 180, 0.03, 6, true));
  // small decks over either end
  for (const [t0, t1] of [[0.74, 0.995], [-0.995, -0.78]]) {
    const pos = [];
    const uv = [];
    const NR = 12;
    const NC = 6;
    for (let i = 0; i <= NR; i++) {
      const t = mix(t0, t1, i / NR);
      const w = Math.max(0.002, beam(t) - 0.012);
      for (let j = 0; j <= NC; j++) {
        const z = mix(-w, w, j / NC);
        pos.push(t * HL, sheer(t) - 0.015 + 0.03 * (1 - (z / w) ** 2), z);
        uv.push(t * HL * 0.9, z * 0.9);
      }
    }
    bk.add(mats.boat, geoOf(pos, gridIdx(NR, NC, t1 < t0), uv));
    const mid = [];
    for (let i = 0; i <= 6; i++) {
      const t = mix(t0, t1, i / 6);
      mid.push([t * HL, sheer(t) + 0.016, 0]);
    }
    bk.add(mats.silver, tube(mid, 0.008, 0.005, { seg: 8, radial: 3 }));
  }
  // the swan's neck and head at the prow, an upswept tip at the stern
  const neck = [[3.0, 0.8, 0], [3.13, 1.04, 0], [3.21, 1.34, 0], [3.15, 1.62, 0], [3.02, 1.82, 0], [2.97, 1.97, 0], [3.03, 2.09, 0], [3.15, 2.13, 0]];
  bk.add(mats.boat, tube(neck, 0.085, 0.045, { seg: 28, radial: 8, uvK: 1 }));
  bk.add(mats.boat, ball(0.07, 12, 8), { p: [3.18, 2.12, 0], s: [1.45, 0.9, 0.85] });
  bk.add(mats.silver, new THREE.ConeGeometry(0.028, 0.15, 6), { p: [3.32, 2.08, 0], r: [0, 0, -Math.PI / 2 - 0.35] });
  for (const s of [-1, 1]) bk.add(mats.silver, ball(0.011, 6, 4), { p: [3.2, 2.14, s * 0.052] });
  bk.add(mats.boat, tube([[-2.98, 0.76, 0], [-3.13, 0.9, 0], [-3.23, 1.06, 0], [-3.27, 1.2, 0], [-3.23, 1.3, 0]], 0.06, 0.016, { seg: 12, radial: 6, uvK: 1 }));
  // silver inlaid along her: a line under the gunwale, and on either bow
  // a folded wing, its feathers fanning back from the shoulder
  const dP = (t, f) => {
    const e = 1e-3;
    const a = V3(...hull(t + e, f)).sub(V3(...hull(t - e, f)));
    const b = V3(...hull(t, f + e)).sub(V3(...hull(t, f - e)));
    return a.cross(b).normalize();
  };
  const onHull = (t, f, side) => {
    const nrm = dP(t, f);
    if (nrm.z * side < 0) nrm.negate();
    return V3(...hull(t, f)).addScaledVector(nrm, 0.009);
  };
  for (const side of [-1, 1]) {
    const line = [];
    for (let i = 0; i <= 24; i++) line.push(onHull(mix(-0.9, 0.93, i / 24), side * 0.88, side));
    bk.add(mats.silver, tube(line, 0.009, 0.009, { seg: 40, radial: 3 }));
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const t = mix(0.86, 0.38 - k * 0.07, u);
        const f = side * (mix(0.8, 0.74 - k * 0.12, u) - Math.sin(u * Math.PI) * 0.03 * (k + 1));
        pts.push(onHull(t, f, side));
      }
      bk.add(mats.silver, tube(pts, 0.012, 0.005, { seg: 14, radial: 3 }));
    }
  }
  // floorboards, above the water she draws
  const FY = 0.2;
  const fpos = [];
  const fuv = [];
  const NFR = 20;
  for (let i = 0; i <= NFR; i++) {
    const t = mix(-0.74, 0.74, i / NFR);
    const yk = keel(t) + 0.03;
    const ys = sheer(t);
    const c = Math.pow(clamp01((FY - yk) / (ys - yk)), 1 / 1.3);
    const f = (Math.acos(1 - c) * 2) / Math.PI;
    const w = Math.max(0.02, (beam(t) - 0.035) * Math.sin((f * Math.PI) / 2));
    for (let j = 0; j <= 4; j++) {
      const z = mix(-w, w, j / 4);
      fpos.push(t * HL, FY, z);
      fuv.push(t * HL * 0.9, z * 1.6);
    }
  }
  bk.add(mats.boat, geoOf(fpos, gridIdx(NFR, 4), fuv));
  // ribs inside
  for (const t of [-0.62, -0.38, -0.14, 0.1, 0.33, 0.56]) {
    const pts = [];
    for (let j = 0; j <= 8; j++) pts.push(hull(t, mix(-0.9, 0.9, j / 8), 0.04));
    bk.add(mats.boat, tube(pts, 0.017, 0.017, { seg: 12, radial: 3 }));
  }
  // the thwarts
  const seatX = [0.99, -1.14];
  const seats = [];
  for (const x of seatX) {
    const w = beam(x / HL) - 0.05;
    bk.add(mats.boat, roundBox(0.25, 0.036, 2 * w, 0.012), { p: [x, 0.38, 0], uv: 1 });
    seats.push(V3(x, 0.4, 0));
  }
  bk.build(g);
  // the paddles, laid in: shaft along their own y, blade at -y
  const paddle = () => {
    const pg = new THREE.Group();
    pg.name = 'paddle';
    const pk = parts();
    pk.add(mats.boat, cyl(0.019, 0.022, 1.32, 6), { p: [0, 0.18, 0], uv: 2 });
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.11, -0.12, 0.08, -0.32);
    leaf.quadraticCurveTo(0.03, -0.46, 0, -0.52);
    leaf.quadraticCurveTo(-0.03, -0.46, -0.08, -0.32);
    leaf.quadraticCurveTo(-0.11, -0.12, 0, 0);
    pk.add(mats.boat, new THREE.ExtrudeGeometry(leaf, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 5 }), { p: [0, -0.46, -0.007], uv: 3 });
    pk.add(mats.boat, roundBox(0.13, 0.04, 0.045, 0.015), { p: [0, 0.85, 0] });
    pk.add(mats.silver, cyl(0.026, 0.026, 0.05, 8), { p: [0, -0.46, 0] });
    pk.add(mats.silver, leafBlade(0.14, 0.05, { curl: 0, seg: 2, thick: 0.004 }), { p: [0, -0.62, 0.012], r: [0, 0, Math.PI] });
    pk.build(pg);
    return pg;
  };
  const pa = paddle();
  pa.position.set(0.9, FY + 0.03, 0.2);
  pa.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  const pb = paddle();
  pb.position.set(-1.0, FY + 0.03, -0.2);
  pb.rotation.set(Math.PI / 2, Math.PI, -Math.PI / 2);
  g.add(pa, pb);
  return { group: g, seats, paddles: [pa, pb], length: 2 * HL, beam: 1.2, waterline: 0.16 };
}

// ── the Argonath ──

// The colours the kings have weathered to: grey-green stone, darker
// streaks where water has run down it for an age, cracks, moss on what
// faces up, lichen in drifts, and dark and slimed at the river's edge.
function kingPaint(seed) {
  const n = makeNoise(seed);
  const base = C(0x8e938a);
  const green = C(0x76826c);
  const dark = C(0x3a4236);
  const moss = C(0x56602e);
  const lichen = C(0xb8b68e);
  const pale = C(0xc6c8be);
  const slime = C(0x2a3020);
  return (p, nrm, out) => {
    const v = noise3(n, p.x * 0.05, p.y * 0.05, p.z * 0.05);
    out.copy(base).lerp(green, smooth(0.35, 0.68, v));
    const st = n(p.x * 0.3 + p.z * 0.3 + 11, p.y * 0.012 + 3);
    out.lerp(dark, smooth(0.6, 0.85, st) * 0.5);
    const cr = 1 - Math.abs(noise3(n, p.x * 0.035 + 9, p.y * 0.035, p.z * 0.035 + 4) * 2 - 1);
    out.multiplyScalar(1 - smooth(0.94, 0.99, cr) * 0.55);
    const up = clamp01((nrm.y - 0.35) / 0.5);
    out.lerp(moss, up * smooth(0.3, 0.6, noise3(n, p.x * 0.12, p.y * 0.12 + 5, p.z * 0.12)) * 0.85);
    const l = smooth(0.6, 0.72, noise3(n, p.x * 0.09 + 3, p.y * 0.09, p.z * 0.09 + 7));
    out.lerp(nrm.y > 0.2 ? lichen : pale, l * 0.5);
    if (nrm.y < -0.3) out.multiplyScalar(0.72);
    out.lerp(slime, clamp01(1 - (p.y + 1.5) / 4.5) * 0.7);
  };
}

// The stone king, one of the pair, on his pedestal: built here at full
// size, facing +z, his pedestal's foot sunk below the river (y = 0 the
// water) and its top 26 m up, the king 65 m more to his raised hand. A long robe falling in
// heavy folds, a cloak behind, a belt; a stern bearded face under a helm
// with cheek-guards, a crown of points round it and wings rising at its
// sides; his left arm raised, the palm out in warning, his right hand
// gripping the haft of a great axe whose foot rests by his feet.
function kingParts(bk, K, rocks) {
  const { mats } = K;
  const U = 8;
  const BASE = 26;
  const n = makeNoise(93);
  const paintFn = kingPaint(91);
  const eyes = [V3(0.105, 6.915, 0.3), V3(-0.105, 6.915, 0.3)].map((e) => e.multiplyScalar(U).add(V3(0, BASE, 0)));
  const paint = (p, nrm, out) => {
    paintFn(p, nrm, out);
    for (const e of eyes) out.multiplyScalar(mix(0.3, 1, smooth(0.25, 0.75, p.distanceTo(e))));
  };
  let seed = 400;
  const put = (geo, o = {}) => {
    tf(geo, o);
    geo.scale(U, U, U).translate(0, BASE, 0);
    bk.add(mats.kingStone, paintGeo(geo, paint), { uv: 0.09 });
  };
  const limb = (pts, r0, r1, seg = 10, radial = 12) => put(tube(pts, r0, r1, { seg, radial, gnarl: 0.02, seed: seed++ }));
  const lump = (rad, o, detail = 2, amp = 0.06) => put(blob(rad, { detail, amp, freq: 1.4, seed: seed++ }), o);
  // the robe and the cloak behind it, from the hem to the neck
  const KEYS = [
    [0.0, 1.02, 0.9, 1.22],
    [0.5, 0.95, 0.8, 1.14],
    [1.0, 0.9, 0.72, 1.06],
    [1.6, 0.86, 0.64, 1.0],
    [2.2, 0.83, 0.6, 0.94],
    [2.8, 0.81, 0.57, 0.88],
    [3.4, 0.79, 0.54, 0.82],
    [4.0, 0.78, 0.53, 0.76],
    [4.3, 0.8, 0.55, 0.72],
    [4.6, 0.86, 0.6, 0.68],
    [5.0, 0.95, 0.65, 0.66],
    [5.4, 1.06, 0.66, 0.64],
    [5.7, 1.12, 0.6, 0.6],
    [5.9, 1.04, 0.5, 0.54],
    [6.05, 0.82, 0.42, 0.46],
    [6.15, 0.52, 0.33, 0.37],
    [6.22, 0.25, 0.25, 0.27],
  ];
  const key = (y) => {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1][0] < y) i++;
    const [y0, ...a] = KEYS[i];
    const [y1, ...b] = KEYS[i + 1];
    const t = clamp01((y - y0) / (y1 - y0));
    return a.map((v, k) => mix(v, b[k], t));
  };
  const ys = [];
  for (let y = 0; y < 4.0; y += 0.25) ys.push(y);
  for (let y = 4.0; y < 6.2; y += 0.12) ys.push(y);
  ys.push(6.22);
  const folds = (a, y) => {
    const s = Math.sin(a);
    const skirt = 1 - smooth(2.6, 4.3, y);
    const back = smooth(0.0, -0.7, s) * (1 - smooth(5.3, 6.0, y));
    const k = Math.max(skirt * mix(1, 0.45, y / 4.3), back * 0.9);
    const f = 0.5 + 0.5 * Math.cos(a * 13 + Math.sin(a * 3) * 1.3 + y * 0.05);
    // a tabard hangs straight down the front from the belt
    const front = Math.abs(a - Math.PI / 2) < 0.3 ? 1 : 0;
    const tab = front * (1 - smooth(4.2, 4.35, y)) * 0.06;
    return k * 0.12 * (Math.pow(f, 1.8) - 0.3) * (1 - front * 0.8) + tab;
  };
  put(loftRound(ys.map((y) => [y, ...key(y), y < 4.4 ? 2.3 : 2.7]), { radial: 80, push: folds }));
  // his feet under the hem, the belt, the shoulders' plates
  for (const s of [-1, 1]) lump(0.2, { p: [s * 0.32, 0.08, 0.84], s: [0.9, 0.55, 1.35] });
  put(new THREE.TorusGeometry(1, 0.06, 6, 56).rotateX(Math.PI / 2).scale(0.78, 1, 0.63).translate(0, 4.3, -0.09));
  put(roundBox(0.22, 0.17, 0.08, 0.03), { p: [0, 4.3, 0.56] });
  for (const s of [-1, 1]) {
    lump(0.4, { p: [s * 1.0, 5.74, 0.0], s: [1.1, 0.72, 1.05] });
    lump(0.37, { p: [s * 1.08, 5.54, 0.0], s: [1.05, 0.6, 1.0] });
  }
  // the left arm, raised, the palm out
  const S1 = [1.06, 5.62, 0.02];
  const E1 = [1.66, 6.15, 0.3];
  const W1 = [1.72, 7.22, 0.5];
  limb([S1, [1.4, 5.84, 0.12], E1], 0.36, 0.3);
  lump(0.29, { p: E1 });
  limb([E1, [1.7, 6.7, 0.42], W1], 0.25, 0.19);
  const dir = V3(...W1).sub(V3(...E1)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
  const right = V3(1, 0, 0).applyQuaternion(q);
  const fwd = V3(0, 0, 1).applyQuaternion(q);
  const E = new THREE.Euler().setFromQuaternion(q);
  // the sleeve, fallen back down the raised forearm
  const bellAt = V3(...W1).addScaledVector(dir, -0.12);
  put(lathe([[0.19, 0], [0.24, -0.18], [0.33, -0.4], [0.38, -0.5], [0.35, -0.53], [0.3, -0.42], [0.21, -0.2], [0.17, 0.02]], 16), { p: bellAt.toArray(), r: [E.x, E.y, E.z] });
  const palm = V3(...W1).addScaledVector(dir, 0.24).addScaledVector(fwd, 0.02);
  put(roundBox(0.36, 0.4, 0.13, 0.05), { p: palm.toArray(), r: [E.x, E.y, E.z] });
  [0.4, 0.46, 0.44, 0.35].forEach((L, f) => {
    const b = palm.clone().addScaledVector(dir, 0.18).addScaledVector(right, (f - 1.5) * 0.085);
    const m = b.clone().addScaledVector(dir, L * 0.5).addScaledVector(right, (f - 1.5) * 0.012);
    const t = b.clone().addScaledVector(dir, L).addScaledVector(right, (f - 1.5) * 0.03).addScaledVector(fwd, -0.02);
    limb([b.toArray(), m.toArray(), t.toArray()], 0.054, 0.042, 4, 6);
  });
  const tb = palm.clone().addScaledVector(right, -0.16).addScaledVector(dir, -0.08).addScaledVector(fwd, 0.02);
  limb([tb.toArray(), tb.clone().addScaledVector(right, -0.12).addScaledVector(dir, 0.1).addScaledVector(fwd, 0.03).toArray(), tb.clone().addScaledVector(right, -0.19).addScaledVector(dir, 0.24).addScaledVector(fwd, 0.04).toArray()], 0.065, 0.048, 4, 6);
  // the right arm, down, the hand gripping the axe's haft
  const S2 = [-1.06, 5.62, 0.02];
  const E2 = [-1.28, 4.62, 0.16];
  const W2 = [-1.24, 3.98, 0.64];
  limb([S2, [-1.21, 5.12, 0.08], E2], 0.36, 0.31);
  lump(0.29, { p: E2 });
  limb([E2, [-1.28, 4.3, 0.42], W2], 0.26, 0.2);
  const d2 = V3(...W2).sub(V3(...E2)).normalize();
  const e2 = new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d2));
  put(lathe([[0.2, 0.06], [0.26, -0.06], [0.3, -0.2], [0.27, -0.22], [0.22, -0.1], [0.18, 0.05]], 14), { p: V3(...W2).addScaledVector(d2, -0.12).toArray(), r: [e2.x, e2.y, e2.z] });
  const HX = -1.3;
  const HZ = 0.9;
  lump(0.2, { p: [HX + 0.02, 3.84, HZ - 0.03], s: [1.05, 1.25, 0.95] });
  for (let f = 0; f < 4; f++) put(new THREE.TorusGeometry(0.11, 0.04, 5, 10, Math.PI * 1.2).rotateX(Math.PI / 2), { p: [HX, 3.98 - f * 0.085, HZ], r: [0, -Math.PI * 0.1, 0] });
  lump(0.07, { p: [HX - 0.02, 4.06, HZ + 0.08], s: [1, 0.8, 1.3] });
  // the axe: the haft, a socket, a crescent blade facing out, a back spike
  // and a point
  put(cyl(0.07, 0.08, 6.7, 10), { p: [HX, 3.45, HZ] });
  put(cyl(0.11, 0.1, 0.12, 10), { p: [HX, 0.06, HZ] });
  put(cyl(0.12, 0.12, 0.62, 10), { p: [HX, 6.24, HZ] });
  const axe = new THREE.Shape();
  axe.moveTo(0.06, 0.2);
  axe.lineTo(-0.2, 0.25);
  axe.quadraticCurveTo(-0.46, 0.33, -0.78, 0.58);
  axe.quadraticCurveTo(-0.6, 0.02, -0.8, -0.52);
  axe.quadraticCurveTo(-0.46, -0.24, -0.2, -0.19);
  axe.lineTo(0.06, -0.16);
  axe.lineTo(0.13, -0.07);
  axe.lineTo(0.44, 0.0);
  axe.lineTo(0.13, 0.07);
  axe.lineTo(0.06, 0.2);
  put(new THREE.ExtrudeGeometry(axe, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1, curveSegments: 6 }).translate(0, 0, -0.035).scale(1.35, 1.35, 1.2), { p: [HX, 6.24, HZ] });
  put(new THREE.ConeGeometry(0.09, 0.46, 8), { p: [HX, 6.78, HZ] });
  // the neck, the head, the face
  put(cyl(0.2, 0.23, 0.44, 14), { p: [0, 6.32, 0.02] });
  lump(0.3, { p: [0, 6.86, 0.04], s: [0.92, 1.18, 1.02] }, 3, 0.03);
  put(roundBox(0.44, 0.075, 0.12, 0.03), { p: [0, 6.975, 0.27] });
  put(new THREE.ConeGeometry(0.058, 0.2, 4), { p: [0, 6.86, 0.33], r: [-0.22, Math.PI / 4, 0], s: [1, 1, 0.75] });
  for (const s of [-1, 1]) lump(0.06, { p: [s * 0.13, 6.84, 0.28], s: [1.2, 0.8, 0.8] }, 1, 0.05);
  lump(0.22, { p: [0, 6.36, 0.2], s: [1.15, 1.62, 0.75] }, 2, 0.12);
  put(tube([[-0.16, 6.68, 0.25], [-0.06, 6.745, 0.31], [0.06, 6.745, 0.31], [0.16, 6.68, 0.25]], 0.036, 0.03, { seg: 8, radial: 5 }));
  // the helm: a dome, a brim, cheek-guards, a guard down the back of the neck
  put(lathe([[0.335, 0.08], [0.35, 0.16], [0.335, 0.26], [0.28, 0.36], [0.19, 0.44], [0.08, 0.49], [0.001, 0.5]], 28), { p: [0, 6.86, 0.03] });
  put(new THREE.TorusGeometry(0.345, 0.034, 6, 32).rotateX(Math.PI / 2), { p: [0, 6.95, 0.03] });
  for (const s of [-1, 1]) put(roundBox(0.06, 0.36, 0.3, 0.025), { p: [s * 0.315, 6.79, 0.07], r: [0, 0, s * 0.1] });
  put(lathe([[0.345, 0.08], [0.36, -0.05], [0.39, -0.2], [0.42, -0.3], [0.4, -0.31], [0.36, -0.2], [0.33, -0.05], [0.325, 0.08]], 12, Math.PI / 2, Math.PI), { p: [0, 6.86, 0.03] });
  // the crown: a band of points round the helm, the tallest in front, and
  // a wing rising at either side
  put(cyl(0.36, 0.355, 0.1, 28, true), { p: [0, 7.02, 0.03] });
  for (let k = 0; k < 9; k++) {
    const a = Math.PI / 2 + (k - 4) * 0.62;
    const h = k === 4 ? 0.42 : k % 2 ? 0.16 : 0.25;
    const [px, , pz] = polar(a, 0.355, 0);
    put(new THREE.ConeGeometry(0.055, h, 5), { p: [px, 7.06 + h / 2, pz + 0.03] });
  }
  const wing = new THREE.Shape();
  wing.moveTo(0.08, 0);
  wing.quadraticCurveTo(0.16, 0.22, 0.1, 0.46);
  wing.quadraticCurveTo(0.06, 0.62, -0.06, 0.78);
  wing.lineTo(-0.04, 0.6);
  wing.lineTo(-0.12, 0.62);
  wing.lineTo(-0.08, 0.44);
  wing.lineTo(-0.17, 0.44);
  wing.lineTo(-0.1, 0.27);
  wing.lineTo(-0.18, 0.24);
  wing.quadraticCurveTo(-0.08, 0.1, -0.08, 0);
  wing.lineTo(0.08, 0);
  for (const s of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(wing, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1, curveSegments: 5 });
    geo.translate(0, 0, -0.022).scale(0.85, 0.8, 1).rotateZ(-0.55).rotateY(Math.PI / 2).rotateZ(s * -0.12);
    put(geo, { p: [s * 0.37, 6.98, -0.06] });
  }
  // the pedestal: rough rock out of the river, dressed above, with a
  // projecting band and a cornice under the king's feet
  const PK = [
    [-8, 16.5, 17, 18.5, 4.0],
    [-3, 15.2, 15.4, 16.6, 4.4],
    [2, 14.0, 14.0, 15.0, 4.8],
    [7, 13.0, 13.0, 14.0, 5.2],
    [12, 12.2, 12.2, 13.2, 5.6],
    [17, 11.6, 11.6, 12.5, 6],
    [21.8, 11.3, 11.3, 12.2, 6],
    [21.8, 12.0, 12.0, 12.9, 6],
    [22.8, 12.0, 12.0, 12.9, 6],
    [22.8, 11.4, 11.4, 12.3, 6],
    [24.6, 11.4, 11.4, 12.3, 6],
    [24.6, 12.1, 12.1, 13.0, 6],
    [25.3, 12.2, 12.2, 13.1, 6],
    [25.3, 10.0, 10.0, 11.0, 6],
    [26.0, 10.0, 10.0, 11.0, 6],
  ];
  const rings = [];
  for (let i = 0; i < PK.length; i++) {
    rings.push(PK[i]);
    // more rings up the rough part, for its lumps
    if (i < 6) for (let k = 1; k < 4; k++) rings.push(PK[i].map((v, j) => mix(v, PK[i + 1][j], k / 4)));
  }
  const rough = (a, y, x, z) => {
    const k = y < 21.5 ? mix(1.0, 0.25, smooth(-6, 21.5, y)) : 0.04;
    const strata = Math.sin(y * 1.1 + n(Math.cos(a) * 2, y * 0.2) * 3) * 0.45;
    const cols = (1 - Math.abs(n(Math.cos(a) * 9 + 3, Math.sin(a) * 9 + y * 0.03) * 2 - 1)) * 0.9;
    return ((noise3(n, x * 0.12, y * 0.1, z * 0.12) - 0.5) * 3.2 + strata + cols) * k;
  };
  const ped = loftRound(rings, { radial: 56, push: rough });
  bk.add(mats.kingStone, paintGeo(ped, paint), { uv: 0.09 });
  // boulders fallen round its foot (none on the river side, +x)
  const r = rng(17);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.35 + (i / 9) * Math.PI * 1.3 + r() * 0.2;
    const s = 3 + r() * 3.5;
    const geo = rocks[i % rocks.length].clone();
    bk.add(mats.kingStone, geo, { p: polar(a, 16.5 + r() * 2.5, -0.6 + r() * 0.6), r: [r() * 0.4, r() * TAU, r() * 0.4], s, uv: 0.09 });
  }
}

// The Argonath: the Pillars of the Kings, two stone kings on pedestals
// rising out of the river either side of it, 91 m from the water to their
// raised hands. The river runs along z, its middle on x = 0; `gap` is its width
// between the pedestals' feet at the water (y = 0). They face +z,
// upstream; the king at -x raises his left hand, the one at +x (the same
// carving mirrored) his right, both on the river side, and both hold their
// axes on the outer.
function argonath(K, rocks) {
  const g = new THREE.Group();
  g.name = 'argonath';
  const bk = parts();
  kingParts(bk, K, rocks);
  const a = new THREE.Group();
  a.name = 'king';
  bk.build(a);
  const b = new THREE.Group();
  b.name = 'king';
  for (const m of a.children) b.add(m.clone());
  const GAP = 60;
  const x0 = GAP / 2 + 14.5;
  a.position.x = -x0;
  b.position.x = x0;
  b.scale.x = -1;
  g.add(a, b);
  return { group: g, gap: GAP, kings: [a, b], at: [-x0, x0], height: 91, pedestal: { top: 26, halfWidth: 14.5 } };
}

// ── the river ──

// A wet boulder for the rapids, for instancing, about 1.5 m long: a
// water-worn lump, rounded, a few softened breaks; black-wet and slimed
// low down, grey and lichened on top. Stands about y = -0.4 to 0.55.
function riverRockGeo(seed = 1) {
  const r = rng(seed * 13 + 7);
  const n = makeNoise(seed + 30);
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.5 - 0.5);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.6 + r() * 0.18 });
  }
  const sx = 0.75 * (0.95 + r() * 0.3);
  const sy = 0.75 * (0.55 + r() * 0.2);
  const sz = 0.75 * (0.7 + r() * 0.25);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.1 + v.z * 0.6 + 4, v.y * 1.1 - v.z * 0.4, { octaves: 3 }) - 0.5) * 0.55);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, (pl.d - d) * 0.85);
    }
    v.set(v.x * sx, v.y * sy, v.z * sz);
    if (v.y < -0.4) v.y = -0.4 + (v.y + 0.4) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g = g.toNonIndexed();
  const grey = C(0x7c7f78);
  const pale = C(0xa2a49a);
  const wet = C(0x2c302c);
  const algae = C(0x3e4a26);
  const lichen = C(0xb2b088);
  paintGeo(g, (q, nrm, out) => {
    out.copy(grey).lerp(pale, smooth(0.35, 0.7, noise3(n, q.x * 2, q.y * 2, q.z * 2)));
    out.multiplyScalar(0.85 + noise3(n, q.x * 7 + 5, q.y * 7, q.z * 7) * 0.3);
    out.lerp(lichen, smooth(0.66, 0.74, noise3(n, q.x * 4 + 3, q.y * 4, q.z * 4)) * 0.5 * clamp01(nrm.y + 0.3));
    out.lerp(algae, (1 - smooth(-0.05, 0.12, q.y)) * 0.6);
    out.lerp(wet, (1 - smooth(-0.3, 0.05, q.y)) * 0.75);
  });
  boxUV(g, 0.3);
  g.computeBoundingSphere();
  return g;
}

// A tall rocky riverbank for instancing, about 30 m wide (x) and 25 m
// high, its face to +z, its foot sunk under the water at y = 0 and its top
// going back 8 m: dark grey-green rock in columns between vertical joints,
// stepped back at ledges, leaning back as it rises, bulging and falling
// back in bays; streaked with rust and old water, moss on the ledges and
// grass on top. Its ends curl back so neighbours run on into one wall.
function riverCliffGeo(seed = 1) {
  const r = rng(seed * 37 + 11);
  const n = makeNoise(seed * 5 + 3);
  const W = 30;
  const H = 25;
  const ledges = [];
  for (let y = 3 + r() * 3; y < H - 3; y += 4 + r() * 4) ledges.push([y, 0.5 + r() * 1.0]);
  const face = (x, y) => {
    const big = (fbm(n, x * 0.06 + 1, y * 0.05, { octaves: 3 }) - 0.5) * 5.5;
    const jr = 1 - Math.abs(fbm(n, x * 0.28 + 7, y * 0.025 + 2, { octaves: 2 }) * 2 - 1);
    const cols = (smooth(0.5, 1, jr) - 0.4) * 1.8;
    let steps = 0;
    for (const [ly, k] of ledges) steps -= k * smooth(-0.2, 0.2, y - ly - (n(x * 0.09 + ly, 5.5) - 0.5) * 4);
    const fine = (fbm(n, x * 0.5 + 5, y * 0.4, { octaves: 2 }) - 0.5) * 0.8;
    const ends = -smooth(W / 2 - 4, W / 2 + 2, Math.abs(x)) * 7;
    return [big + cols + steps + fine - y * 0.08 + ends, cols];
  };
  const NX = 48;
  const xs = [];
  for (let i = 0; i <= NX; i++) xs.push(-W / 2 - 2 + (i / NX) * (W + 4));
  const yset = new Set([-2.5, -1]);
  for (let y = 0.4; y < H; y += 1.15) yset.add(+y.toFixed(2));
  for (const [ly] of ledges) {
    yset.add(+(ly - 0.25).toFixed(2));
    yset.add(+(ly + 0.25).toFixed(2));
  }
  yset.add(H);
  const ysR = [...yset].sort((p, q) => p - q);
  const pos = [];
  const dep = [];
  ysR.forEach((y, j) => {
    for (const [i, x0] of xs.entries()) {
      const x = x0 + (j % 2 && i > 0 && i < NX ? 0.15 : 0);
      const [z, cols] = face(x, y);
      const yy = j === ysR.length - 1 ? y + (fbm(n, x * 0.08, 4.4, { octaves: 3 }) - 0.5) * 7 : y + (n(x * 0.07 + 3, 9.1) - 0.5) * 2.4 * clamp01(y / 2.5) * clamp01((H - y) / 2.5);
      pos.push(x, yy, z);
      dep.push(cols);
    }
  });
  // the top, going back from the edge, lumpy and grassy
  const tops = [1.2, 3.5, 8];
  for (const back of tops) {
    for (const x of xs) {
      const [z] = face(x, H);
      pos.push(x, H + (fbm(n, x * 0.08, 4.4, { octaves: 3 }) - 0.5) * 7 + 0.4 + n(x * 0.2 + back, 7.7) * 1.1 - back * 0.1, Math.min(z, 0) - back);
      dep.push(0);
    }
  }
  const rowsN = ysR.length + tops.length;
  let geo = geoOf(pos, gridIdx(rowsN - 1, NX));
  const depth = new Float32Array(pos.length / 3);
  dep.forEach((d, i) => (depth[i] = d));
  const idx = geo.index.array;
  geo = geo.toNonIndexed();
  const dv = new Float32Array(idx.length);
  for (let i = 0; i < idx.length; i++) dv[i] = depth[idx[i]];
  // faceted, the facets' edges softened a little
  const flat = geo.clone();
  flat.deleteAttribute('normal');
  flat.computeVertexNormals();
  const sn = geo.attributes.normal;
  const fnm = flat.attributes.normal;
  for (let k = 0; k < sn.count; k++) {
    const nx = sn.getX(k) * 0.4 + fnm.getX(k) * 0.6;
    const ny = sn.getY(k) * 0.4 + fnm.getY(k) * 0.6;
    const nz = sn.getZ(k) * 0.4 + fnm.getZ(k) * 0.6;
    const l = Math.hypot(nx, ny, nz) || 1;
    sn.setXYZ(k, nx / l, ny / l, nz / l);
  }
  const grey = C(0x7a7e76);
  const pale = C(0xa4a69c);
  const rust = C(0x8a6a48);
  const stain = C(0x3a3e36);
  const moss = C(0x4a5a26);
  const grass = C(0x667634);
  const slime = C(0x262c1e);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k);
    const y = p.getY(k);
    const z = p.getZ(k);
    const ny = fnm.getY(Math.floor(k / 3) * 3);
    c.copy(grey).lerp(pale, smooth(0.38, 0.68, fbm(n, x * 0.12 + 3, y * 0.08, { octaves: 3 })));
    c.lerp(rust, smooth(0.58, 0.85, fbm(n, x * 0.2 + 11, y * 0.015 + 2, { octaves: 2 })) * 0.45);
    c.lerp(stain, smooth(0.64, 0.82, n(x * 0.8 + 21, y * 0.02 + 4)) * 0.5);
    c.multiplyScalar(0.88 + smooth(-0.6, 0.6, dv[k]) * 0.18);
    if (ny < -0.2) c.multiplyScalar(0.6);
    const m = smooth(0.35, 0.7, ny) * (0.55 + 0.45 * smooth(0.35, 0.6, n(x * 0.5, z * 0.5 + y)));
    c.lerp(y > H - 4 ? grass : moss, m * 0.65);
    c.lerp(slime, (1 - smooth(-0.5, 1.6, y)) * 0.7);
    col[k * 3] = c.r;
    col[k * 3 + 1] = c.g;
    col[k * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  boxUV(geo, 0.12);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
}

// ── the fountain ──

// A small white stone fountain for a flet's court, 1.7 m across and a
// metre high: a round basin with carved leaves hanging under its lip, a
// slender stem holding a shallow bowl that brims over in a thin falling
// sheet, a bud at the top. update(t) runs its water.
function fountain(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'fountain';
  const bk = parts();
  bk.add(mats.paleStone, lathe([[0.001, 0], [0.7, 0], [0.74, 0.03], [0.72, 0.08], [0.76, 0.3], [0.82, 0.42], [0.84, 0.46], [0.8, 0.48], [0.75, 0.47], [0.72, 0.42], [0.68, 0.2], [0.001, 0.17]], 40), { uv: 1.2 });
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * TAU;
    bk.add(mats.paleStone, leafBlade(0.2, 0.08, { curl: -0.7, seg: 3, thick: 0.01 }).rotateX(Math.PI), { p: polar(a, 0.83, 0.43), r: [0, Math.PI / 2 - a, 0], uv: 2 });
  }
  bk.add(mats.paleStone, lathe([[0.16, 0.17], [0.12, 0.25], [0.085, 0.45], [0.08, 0.62], [0.1, 0.7], [0.14, 0.74]], 16), { uv: 1.6 });
  bk.add(mats.paleStone, lathe([[0.1, 0.72], [0.22, 0.76], [0.32, 0.82], [0.35, 0.86], [0.33, 0.87], [0.3, 0.84], [0.2, 0.8], [0.001, 0.79]], 28), { uv: 1.6 });
  bk.add(mats.paleStone, lathe([[0.001, 0.8], [0.06, 0.82], [0.07, 0.88], [0.05, 0.95], [0.02, 1.0], [0.001, 1.01]], 12), { uv: 2 });
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    bk.add(mats.paleStone, leafBlade(0.16, 0.06, { curl: 0.9, seg: 3, thick: 0.008 }), { p: polar(a, 0.04, 0.82), r: [0, Math.PI / 2 - a, 0], uv: 2 });
  }
  bk.build(g);
  const lower = new THREE.Mesh(new THREE.CircleGeometry(0.73, 40).rotateX(-Math.PI / 2), mats.water);
  lower.position.y = 0.4;
  const upper = new THREE.Mesh(new THREE.CircleGeometry(0.31, 24).rotateX(-Math.PI / 2), mats.water);
  upper.position.y = 0.845;
  const sheet = new THREE.Mesh(new THREE.CylinderGeometry(0.352, 0.5, 0.45, 32, 1, true), mats.fall);
  sheet.position.y = 0.625;
  for (const m of [lower, upper, sheet]) {
    m.renderOrder = 2;
    g.add(m);
  }
  return {
    group: g,
    water: V3(0, 0.4, 0),
    radius: 0.84,
    update(t) {
      K.water.uTime.value = t;
    },
  };
}

// ── the kit ──

export function createLorienKit(renderer) {
  const kit = createShireKit(renderer);
  const { K, mats } = kit;
  const S = 256;
  const T = (c, o) => canvasTexture(c, renderer, o);
  const bark = barkCanvas(S);
  const wood = woodCanvas(S);
  const stone = weatheredCanvas(S, 11);
  // the wood's light, for silver to show
  const sky = new THREE.CanvasTexture(skyCanvas());
  sharpen(sky);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  sky.colorSpace = THREE.SRGBColorSpace;
  const tex = {
    bark: T(bark),
    barkN: T(normalFromField(fieldOf(bark), S, S, 1.2), { srgb: false }),
    wood: T(wood),
    woodN: T(normalFromField(fieldOf(wood), S, S, 1.0), { srgb: false }),
    leafCard: T(leafCardCanvas(), { wrap: false }),
    weathered: T(stone.c),
    weatheredN: T(normalFromField(stone.field, S, S, 2.5), { srgb: false }),
    halo: T(haloCanvas(), { wrap: false }),
    shire: T(shireVisionCanvas(), { wrap: false }),
    woodSky: sky,
  };
  const pale = stoneTextures(renderer, { seed: 61, dark: [186, 188, 184], light: [250, 250, 246], joint: 0.12, relief: 1.4 });
  const M = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const gold = C(0xffd884);
  // dusk to night, 0 to 1, shared by every water shader
  const night = { value: 0 };
  K.night = night;
  K.water = { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uTime: { value: 0 }, uNight: night };
  K.tex = { ...K.tex, ...tex };
  Object.assign(mats, {
    // the mallorns: silver bark, gold leaves, the far wood
    bark: M({ map: tex.bark, normalMap: tex.barkN, vertexColors: true, roughness: 0.5, envMap: sky, envMapIntensity: 0.3 }),
    canopy: M({ map: K.tex.leaves, normalMap: K.tex.leavesN, color: new THREE.Color(1.5, 1.46, 1.36), vertexColors: true, roughness: 0.8, emissive: gold, emissiveIntensity: 0.4 }),
    leafCard: M({ map: tex.leafCard, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, emissive: gold, emissiveIntensity: 0.4 }),
    far: M({ vertexColors: true, roughness: 0.9, emissive: gold, emissiveIntensity: 0.2 }),
    // white-grey elven woodwork, the boat, silver, the lamps' light
    elfwood: M({ map: tex.wood, normalMap: tex.woodN, color: 0xe2e5e8, roughness: 0.55 }),
    boat: M({ map: tex.wood, normalMap: tex.woodN, color: 0xd2d7dc, roughness: 0.42, envMap: sky, envMapIntensity: 0.35 }),
    silver: M({ color: 0xe8ecf2, metalness: 0.92, roughness: 0.2, envMap: sky }),
    lamp: M({ color: 0xeaf4ff, emissive: hot(0xbfe0ff, 2.4), emissiveIntensity: 0.35, roughness: 0.25 }),
    halo: new THREE.SpriteMaterial({ map: tex.halo, color: hot(0xbcdcff, 1.4), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    // stone: the kings, the river's rocks and banks, pale carved work
    kingStone: M({ map: tex.weathered, normalMap: tex.weatheredN, normalScale: new THREE.Vector2(1.3, 1.3), vertexColors: true, roughness: 0.95 }),
    riverRock: M({ map: tex.weathered, normalMap: tex.weatheredN, vertexColors: true, roughness: 0.38, envMap: sky, envMapIntensity: 0.4 }),
    cliff: M({ map: tex.weathered, normalMap: tex.weatheredN, vertexColors: true, roughness: 0.93 }),
    paleStone: M({ map: pale.map, normalMap: pale.normalMap, color: 0xf4f2ec, roughness: 0.62 }),
    // the forest floor and what grows on it
    earth: M({ map: K.tex.leaves, normalMap: K.tex.leavesN, vertexColors: true, roughness: 1 }),
    fern: M({ vertexColors: true, roughness: 0.8 }),
    litter: M({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 }),
    petal: M({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, emissive: C(0xffffff), emissiveIntensity: 0.12 }),
    // the fountains' water
    water: basinWaterMaterial(K.water),
    fall: fallSheetMaterial(K.water),
  });
  for (const k of ['canopy', 'leafCard', 'far', 'petal']) mats[k] = glowByColour(mats[k]);
  for (const [k, m] of Object.entries(mats)) if (!m.name) m.name = k;
  const shireNight = kit.setNight;
  // dusk and night: the lanterns brighten and their halos spread, the gold
  // leaves' own glow fades, the waters turn to the night sky
  const setNight = (k) => {
    shireNight(k);
    const t = clamp01(k);
    night.value = t;
    mats.lamp.emissiveIntensity = mix(0.35, 1, t);
    mats.halo.opacity = mix(0.22, 0.9, t);
    mats.canopy.emissiveIntensity = mix(0.4, 0.18, t);
    mats.leafCard.emissiveIntensity = mix(0.4, 0.18, t);
    mats.far.emissiveIntensity = mix(0.2, 0.07, t);
    mats.petal.emissiveIntensity = mix(0.12, 0.7, t);
  };
  const rocks = [riverRockGeo(3), riverRockGeo(7), riverRockGeo(12)];
  return {
    ...kit,
    mats,
    K,
    setNight,
    mallorn: (o) => mallorn(K, o),
    mallornFar: (seed = 1) => mallornFarGeo(seed),
    flet: (o) => flet(K, o),
    spiralStair: (o) => spiralStair(K, o),
    lantern: () => lantern(K),
    mirror: () => mirror(K),
    boat: () => boat(K),
    argonath: () => argonath(K, rocks),
    riverRock: (seed = 1) => riverRockGeo(seed),
    riverCliff: (seed = 1) => riverCliffGeo(seed),
    goldLeaves: (seed = 1) => goldLeavesGeo(seed),
    fern: (seed = 1) => fernGeo(seed),
    fountain: () => fountain(K),
  };
}
