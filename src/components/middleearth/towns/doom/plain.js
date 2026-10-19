// The plain of Gorgoroth: its ash's colours, its boulders and its fangs of
// rock. Moved out of props.js as they were.

import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { clamp01, fbm, makeNoise, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { C, facet, noise3, oneGeo, TAU, tint, V3 } from './helpers';

// ── the plain of Gorgoroth ──

export const ASH = { base: C(0x2e2a28), dark: C(0x121010), ash: C(0x6e6660), rust: C(0x5a3020), pale: C(0x8a827a) };

// A boulder of the plain, about 2.5 m across and 1.4 high: broken
// flat-faced basalt, ash lying grey on whatever faces up. One geometry.
export function ashRockGeo(seed = 1) {
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
export function spikeGeo(seed = 1) {
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
