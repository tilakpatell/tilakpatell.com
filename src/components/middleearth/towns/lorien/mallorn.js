// The mallorns: the great trees with their smooth silver bark and their
// crowns of pale gold, and far ones for the wood beyond. Moved out of
// props.js as they were.

import * as THREE from 'three';
import { clamp01, makeNoise, mix, smooth } from '../../../../lib/paint';
import { blob, parts, rng, tube } from '../../shire/build';
import { _kc, _kc2, C, geoOf, gridIdx, noise3, oneGeo, polar, TAU, tint, V3 } from './helpers';

// ── the mallorns ──

// How thick a mallorn's trunk is at height y (above its buttresses): a
// column that barely tapers until its crown.
export const trunkAt = (r, h, y) => r * (1 - 0.3 * Math.pow(clamp01(y / h), 1.6));

// Mallorn leaves: deep amber within and beneath a crown, through gold, to
// pale primrose out on top in the light; a few clumps greener, a few
// silvered.
export const LEAF = { inner: C(0xa08236), deep: C(0xcaa448), gold: C(0xe8cc6a), pale: C(0xfaf2c2), green: C(0xd6d27a), silver: C(0xf2f0dc) };
export function leafColour(t, own, out) {
  out.copy(LEAF.inner).lerp(LEAF.deep, smooth(0.0, 0.3, t));
  out.lerp(own > 0.76 ? LEAF.green : LEAF.gold, smooth(0.24, 0.58, t));
  out.lerp(own < 0.14 ? LEAF.silver : LEAF.pale, smooth(0.62, 1, t) * 0.8);
  return out;
}

// The silver of a mallorn's bark on a vertex: a little darker and greener
// at the foot where it's damp, paler up in the light.
export function barkTint(n, h) {
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
export function crownBlobs(blobs, centre, { seed = 1, detail = 2, span = 10, squash = 0.62 } = {}) {
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
export function crownCards(blobs, centre, { seed = 1, per = 10, size = 3, span = 10, squash = 0.62 } = {}) {
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
export function weldSeam(geo, rows, ring) {
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
export function mallorn(K, { h = 55, r = 1.8, seed = 1 } = {}) {
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
export function mallornFarGeo(seed = 1) {
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
