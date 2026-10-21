// The forest things, for instancing: broken columns, pines, beeches, ferns,
// mossy boulders, sticks. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp01, fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { blob, boxUV, lathe, rng, tube } from '../../shire/build';
import { _nv, C, oneGeo, TAU, tint, V3 } from './helpers';
import { boxCorners, drumGeo, hexBlock, MOSS, mossGeo, paintHull, paintSmooth, placeCorners, stonePaint } from './stone';

// ── forest things, for instancing ──

// A broken column stub for scatter, about 0.6 to 2.4 m: a square plinth, a
// moulded base, one or two fluted drums broken off ragged, moss on the
// break and lichen down it. One geometry, its colours in its vertices, with
// texture coordinates for the weathered stone (mats.ruin).
export function pillarGeo(seed = 1) {
  const r = rng(seed * 29 + 3);
  const paint = stonePaint(seed + 60, { moss: 1.2, lichen: 1.2, damp: 1 });
  const list = [];
  const plinth = hexBlock(placeCorners(boxCorners(0.92, 0.42, 0.92), { p: [0, 0.11, 0], r: [0, r() * 0.3, 0] }), { seed, paint, chip: 0.5 });
  list.push(boxUV(plinth, 0.42));
  const base = lathe([[0.001, 0], [0.42, 0], [0.42, 0.06], [0.39, 0.1], [0.41, 0.15], [0.36, 0.2], [0.34, 0.24]], 20).translate(0, 0.32, 0);
  list.push(paintSmooth(base, paint));
  const h = 0.4 + r() * 1.8;
  let y = 0.56;
  let left = h;
  let k = 0;
  while (left > 0.05) {
    const dh = Math.min(left, 0.9);
    const last = left - dh < 0.3;
    const geo = drumGeo(0.33, last ? left : dh, { flutes: 12, seed: seed * 5 + k, broken: last ? 0.3 : 0, caps: [false, true] });
    geo.rotateY(r() * 0.3).translate(0, y, 0);
    list.push(paintSmooth(geo, paint));
    y += last ? left : dh;
    left -= last ? left : dh;
    k++;
  }
  const m = mossGeo(0.25, seed + 9, { h: 0.5 }).translate(0, y - 0.18, 0).toNonIndexed();
  list.push(boxUV(m, 3));
  return oneGeo(list, { uv: true });
}

// A tall straight pine for instancing, about 22 m: a long reddish trunk
// bare of branches for half its height but for a few dead stubs, moss at
// its foot, and above that tiers of dark needles, each a ragged skirt with
// drooping tips over a darker underside, uneven and smaller towards the top.
export function pineGeo(seed = 1) {
  const r = rng(seed * 11 + 5);
  const n = makeNoise(seed + 3);
  const H = 20 + r() * 4;
  const lean = (y) => Math.sin(y * 0.11 + seed) * 0.18 * (y / H);
  const list = [];
  const trunk = new THREE.CylinderGeometry(0.11, 0.38, H, 8, 8).translate(0, H / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const flare = 1 + Math.max(0, 1 - y / 1.2) * 0.35;
    tp.setXYZ(i, tp.getX(i) * flare + lean(y), y, tp.getZ(i) * flare);
  }
  trunk.computeVertexNormals();
  list.push(tint(trunk, (x, y, z, out) => {
    const a = Math.atan2(z, x);
    out.setRGB(0.24, 0.15, 0.1).multiplyScalar(0.75 + n(a * 2.5, y * 0.6) * 0.5);
    if (y < 2.4) out.lerp(MOSS.mid, smooth(2.4, 0.3, y) * smooth(0.3, 0.6, n(a * 1.5 + 4, y)) * 0.8);
  }));
  // dead stubs on the bare trunk
  for (let i = 0; i < 6; i++) {
    const y = 4 + r() * (H * 0.4);
    const a = r() * TAU;
    const l = 0.4 + r() * 0.7;
    const geo = new THREE.CylinderGeometry(0.015, 0.05, l, 4, 1).translate(0, l / 2, 0).rotateZ(-1.2 - r() * 0.3).rotateY(a).translate(lean(y), y, 0);
    list.push(tint(geo, (x, yy, z, out) => out.setRGB(0.2, 0.17, 0.14)));
  }
  const tiers = 13;
  const y0c = H * 0.46;
  const top = C(0x2a4626);
  const tipC = C(0x5a7a34);
  const inner = C(0x13221a);
  const below = C(0x0b150e);
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const y0 = y0c + Math.pow(t, 0.95) * (H - y0c - 1.4) + (r() - 0.5) * 0.4;
    const rad = mix(3.0, 0.5, Math.pow(t, 0.8)) * (0.8 + r() * 0.35);
    const h = mix(2.0, 1.4, t);
    const m = 9;
    const pos = [];
    const col = [];
    const cx = lean(y0) + (r() - 0.5) * 0.4 * (1 - t);
    const cz = (r() - 0.5) * 0.4 * (1 - t);
    const apex = [lean(y0 + h), y0 + h, 0];
    const under = [cx, y0 + h * 0.3, cz];
    const rim = [];
    for (let k = 0; k < m * 2; k++) {
      const a = (k / (m * 2)) * TAU + i * 0.9;
      const tip = k % 2 === 0;
      const rr = rad * (tip ? 1 : 0.62) * (0.75 + n(k * 0.7, i * 3) * 0.5);
      rim.push([cx + Math.cos(a) * rr, y0 + (tip ? -0.35 - r() * 0.35 : 0.15), cz + Math.sin(a) * rr, tip]);
    }
    for (let k = 0; k < rim.length; k++) {
      const a = rim[k];
      const b = rim[(k + 1) % rim.length];
      for (const [v, c] of [[apex, inner], [b, b[3] ? tipC : top], [a, a[3] ? tipC : top]]) {
        pos.push(v[0], v[1], v[2]);
        col.push(c.r, c.g, c.b);
      }
      for (const [v, c] of [[under, below], [a, inner], [b, inner]]) {
        pos.push(v[0], v[1], v[2]);
        col.push(c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    // light from above: the needles' normals turned upward a little
    const nr = geo.attributes.normal;
    for (let k = 0; k < nr.count; k++) {
      _nv.fromBufferAttribute(nr, k);
      _nv.y += 0.4;
      _nv.normalize();
      nr.setXYZ(k, _nv.x, _nv.y, _nv.z);
    }
    list.push(geo);
  }
  return oneGeo(list);
}

// The greens of the beeches' leaves, deep inside the crown to gold-green
// out in the low sun.
export const BEECH = { inner: C(0x15240c), deep: C(0x2c4a14), mid: C(0x4a6e1e), light: C(0x86a434), gold: C(0xa8a83c) };

// A crown of leaf clumps for instancing: blobs round a dome, each vertex's
// colour from how high and how far out it is (darker under and inside,
// bright on top), in patches of hue; the normals turned out from the
// crown's middle, so it shades as one rounded mass.
export function crownGeo(blobs, centre, { seed = 1, span = 4.5 }) {
  const n = makeNoise(seed + 7);
  const list = [];
  const ctr = V3(...centre);
  const tmp = V3();
  blobs.forEach(([x, y, z, rad], i) => {
    const geo = blob(rad, { detail: 1, amp: 0.34, freq: 1.8, seed: seed * 13 + i });
    geo.translate(x, y, z);
    const nr = geo.attributes.normal;
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      tmp.set(p.getX(k), p.getY(k), p.getZ(k)).sub(ctr).normalize();
      const nx = nr.getX(k) * 0.4 + tmp.x * 0.6;
      const ny = nr.getY(k) * 0.4 + tmp.y * 0.6 + 0.15;
      const nz = nr.getZ(k) * 0.4 + tmp.z * 0.6;
      const l = Math.hypot(nx, ny, nz);
      nr.setXYZ(k, nx / l, ny / l, nz / l);
    }
    const own = n(i * 3.7 + 0.5, seed + 0.5);
    tint(geo, (px, py, pz, out) => {
      const up = (py - ctr.y) / span;
      const outward = Math.hypot(px - ctr.x, (py - ctr.y) * 0.6, pz - ctr.z) / span;
      const t = clamp01(0.4 + up * 0.38 + (outward - 0.62) * 0.7 + (n(px * 1.6, py * 1.6 + pz) - 0.5) * 0.3);
      out.copy(BEECH.inner).lerp(BEECH.deep, smooth(0, 0.3, t)).lerp(BEECH.mid, smooth(0.28, 0.6, t));
      out.lerp(own > 0.62 ? BEECH.gold : BEECH.light, smooth(0.62, 1, t) * 0.8);
    });
    list.push(geo);
  });
  return list;
}

// An old beech for instancing, about 16 m: a stout grey trunk on spreading
// buttress roots, green with moss up its lower half, parting into a few
// heavy limbs under a broad, uneven dome of leaf.
export function beechGeo(seed = 1) {
  const r = rng(seed * 7 + 3);
  const n = makeNoise(seed + 20);
  const H = 14.5 + r() * 3;
  const list = [];
  const trunkH = H * 0.42;
  const trunk = new THREE.CylinderGeometry(0.42, 0.62, trunkH, 10, 5, true).translate(0, trunkH / 2, 0);
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const a = Math.atan2(tp.getZ(i), tp.getX(i));
    const flare = 1 + Math.max(0, 1 - y / 1.4) * (0.55 + Math.sin(a * 5 + seed) * 0.35);
    const bend = Math.sin(y * 0.4 + seed) * 0.15;
    tp.setX(i, tp.getX(i) * flare + bend);
    tp.setZ(i, tp.getZ(i) * flare);
  }
  trunk.computeVertexNormals();
  const bark = (x, y, z, out) => {
    const a = Math.atan2(z, x);
    out.setRGB(0.36, 0.35, 0.32).multiplyScalar(0.8 + n(y * 1.5, a * 2) * 0.4);
    const mossy = smooth(H * 0.38, 0.5, y) * smooth(0.25, 0.55, n(a * 1.3 + 7, y * 0.5) + (z < 0 ? 0.2 : 0));
    out.lerp(y < 1.2 ? MOSS.mid : MOSS.dark, mossy * 0.85);
  };
  list.push(tint(trunk, bark));
  const limbs = 4 + Math.floor(r() * 2);
  for (let k = 0; k < limbs; k++) {
    const a = (k / limbs) * TAU + r() * 0.8;
    const reach = 2.2 + r() * 1.8;
    const top = H * (0.6 + r() * 0.12);
    const end = [Math.cos(a) * reach, top, Math.sin(a) * reach];
    const geo = tube([[0, trunkH - 0.5, 0], [end[0] * 0.4, trunkH + (top - trunkH) * 0.4, end[2] * 0.4], end], 0.32, 0.09, { seg: 5, radial: 6 });
    list.push(tint(geo, bark));
  }
  // the crown: a broad dome of clumps
  const cy = H * 0.68;
  const R = H * 0.38;
  const blobs = [[0, cy + R * 0.25, 0, R * 0.5]];
  const count = 15 + Math.floor(r() * 4);
  for (let k = 0; k < count; k++) {
    const a = k * 2.39996 + r() * 0.5;
    const el = Math.asin(mix(-0.3, 0.92, (k + 0.5) / count));
    const rr = R * (0.72 + r() * 0.24);
    blobs.push([Math.cos(a) * Math.cos(el) * rr * 1.1, cy + Math.sin(el) * rr * 0.68, Math.sin(a) * Math.cos(el) * rr * 1.1, R * (0.28 + r() * 0.12)]);
  }
  list.push(...crownGeo(blobs, [0, cy, 0], { seed, span: R }));
  return oneGeo(list);
}

// A clump of fern for instancing, about 1.2 m across: a dozen fronds from a
// dark heart, arching out and over, each a midrib with its leaflets in
// pairs, longest in the middle of the frond; deep green at the heart, fresh
// and bright at the tips, a few gone brown. Each leaflet is wound both ways
// with its normal up, so it lights like the ground from either side on a
// single-sided material (a double-sided one turns the normal down for the
// back, and a frond seen from behind, or by its own face normal, lit black).
export function fernGeo(seed = 1) {
  const r = rng(seed * 23 + 7);
  const pos = [];
  const col = [];
  const nor = [];
  const heart = C(0x16280c);
  const green = C(0x3e6a1c);
  const bright = C(0x86b03a);
  const brown = C(0x8a6a30);
  const c0 = new THREE.Color();
  const c1 = new THREE.Color();
  const fronds = 10 + Math.floor(r() * 4);
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + r() * 0.4;
    const len = 0.55 + r() * 0.35;
    const lift = 0.7 + r() * 0.5;
    const dead = r() < 0.12;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const N = 7;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      // out and up, then arching over
      const out = len * t;
      const y = len * lift * (t * 1.1 - t * t * 0.95);
      pts.push([dx * out, y, dz * out]);
    }
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      const [ax, ay, az] = pts[i];
      const [bx, by, bz] = pts[i + 1];
      const leaf = 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (0.8 + r() * 0.3) * (len / 0.7);
      c0.copy(heart).lerp(green, smooth(0, 0.4, t));
      c1.copy(green).lerp(bright, smooth(0.2, 1, t));
      if (dead) {
        c0.lerp(brown, 0.7);
        c1.lerp(brown, 0.85);
      }
      for (const sd of [-1, 1]) {
        // a leaflet: from the midrib out to the side and on along the frond
        const sx = -dz * sd;
        const sz = dx * sd;
        const tip = [(ax + bx) / 2 + sx * leaf + dx * leaf * 0.35, (ay + by) / 2 - leaf * 0.18, (az + bz) / 2 + sz * leaf + dz * leaf * 0.35];
        const tri = sd > 0 ? [[ax, ay, az], [bx, by, bz], tip] : [[ax, ay, az], tip, [bx, by, bz]];
        for (const face of [tri, [tri[0], tri[2], tri[1]]]) {
          face.forEach((v) => {
            pos.push(...v);
            const c = v === tip ? c1 : c0;
            col.push(c.r, c.g, c.b);
            nor.push(dx * 0.2, 0.96, dz * 0.2);
          });
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

// A grey lichened boulder for instancing, about 1.5 m: an icosahedron
// pushed about by noise and split along a few planes so it has the broken
// faces of real stone, a thick pelt of moss over its top and down its
// shaded side, lichen on the rest. Stands about y = -0.3 … 1.0: sink it to
// taste. Texture coordinates for the weathered stone (mats.rock).
export function mossRockGeo(seed = 1) {
  const r = rng(seed);
  const n = makeNoise(seed);
  let g = new THREE.IcosahedronGeometry(1, 3);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  const planes = [];
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU;
    const b = Math.acos(r() * 1.6 - 0.6);
    planes.push({ n: V3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)), d: 0.62 + r() * 0.22 });
  }
  const sx = 0.8 + r() * 0.25;
  const sz = 0.65 + r() * 0.2;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(1 + (fbm(n, v.x * 1.3 + v.z * 0.7 + 4, v.y * 1.3 - v.z * 0.4, { octaves: 4 }) - 0.5) * 0.7);
    for (const pl of planes) {
      const d = v.dot(pl.n);
      if (d > pl.d) v.addScaledVector(pl.n, pl.d - d);
    }
    v.set(v.x * sx, v.y * 0.62 + 0.32, v.z * sz);
    if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.15;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  boxUV(g, 0.8);
  const paint = stonePaint(seed + 50, { moss: 1.8, lichen: 1.3, damp: 0.9, ground: -0.2, base: C(0x8e8c84), vary: 0.18 });
  paintHull(g, [], paint);
  g.computeBoundingSphere();
  return g;
}

// A fallen branch for firewood, about a metre: a crooked stick of grey-
// brown wood with two side twigs and a snapped end, lying along x on the
// ground.
export function stickGeo(seed = 1) {
  const r = rng(seed * 31 + 11);
  const L = 0.85 + r() * 0.35;
  const rad = 0.025 + r() * 0.012;
  const pts = [];
  for (let i = 0; i <= 4; i++) pts.push([-L / 2 + (L * i) / 4, rad + (r() - 0.5) * 0.02, (r() - 0.5) * 0.06]);
  const n = makeNoise(seed);
  const wood = (x, y, z, out) => out.setRGB(0.3, 0.24, 0.18).multiplyScalar(0.7 + n(x * 9, y * 30 + z * 30) * 0.5);
  const list = [tint(tube(pts, rad, rad * 0.7, { seg: 6, radial: 5, gnarl: 0.2, seed }), wood)];
  for (let k = 0; k < 2; k++) {
    const i = 1 + k * 2;
    const b = pts[i];
    const sd = k ? 1 : -1;
    const tl = 0.15 + r() * 0.15;
    list.push(tint(tube([b, [b[0] + tl * 0.6, b[1] + 0.01, b[2] + sd * tl * 0.5], [b[0] + tl, b[1] + 0.02, b[2] + sd * tl * 0.75]], rad * 0.5, rad * 0.25, { seg: 2, radial: 3 }), wood));
  }
  // the pale wood of the snapped end
  list.push(tint(new THREE.CircleGeometry(rad * 0.75, 6).rotateY(-Math.PI / 2).translate(pts[0][0] - 0.002, pts[0][1], pts[0][2]), (x, y, z, out) => out.setRGB(0.7, 0.6, 0.45)));
  return oneGeo(list);
}
