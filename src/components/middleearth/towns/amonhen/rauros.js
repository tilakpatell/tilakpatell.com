// The falls of Rauros, far off. Moved out of props.js as they were; their
// water, foam and mist are the kit’s.

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { fbm, makeNoise, mix, smooth } from '../../../../lib/paint';
import { boxUV, parts, rng } from '../../shire/build';
import { C, geoOf, gridIdx, noise3, tint, V3 } from './helpers';
import { paintHull, stonePaint } from './stone';

// ── the falls of Rauros ──

// A great crag about w × h × d, its middle at the origin: a box rounded a
// little and pushed about by noise into ribs and ledges, faceted.
export function cragGeo(seed, w, h, d, seg = 7) {
  const n = makeNoise(seed);
  let g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g);
  const p = g.attributes.position;
  const v = V3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.multiplyScalar(mix(1, 0.6 / Math.max(v.length(), 0.3), 0.4));
    const rib = (fbm(n, v.x * 4 + v.z * 4, v.y * 1.1, { octaves: 4 }) - 0.5) * 0.55;
    const lump = (noise3(n, v.x * 2.6, v.y * 2.6, v.z * 2.6) - 0.5) * 0.45;
    // ledges: the sides stepped in as they go up
    const ledge = (Math.floor(v.y * 5 + 0.5) - v.y * 5) * 0.03;
    v.x *= 1 + rib + lump + ledge;
    v.z *= 1 + rib + lump + ledge;
    v.y += (noise3(n, v.x * 2.2 + 5, v.y * 1.6, v.z * 2.2) - 0.5) * (v.y > 0.3 ? 0.3 : 0.12);
    p.setXYZ(i, v.x * w, v.y * h, v.z * d);
  }
  g = g.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// The falls of Rauros, a far set piece: the river comes down between two
// great rocky shoulders, dark with pines along their tops, and goes over
// a lip 120 m across in a long curving curtain 50 m high, split by two
// buttresses of rock, into a churn of foam and a smoke of mist. The front
// faces +z, the lip's middle at about (0, 50, -9), the foot at y = 0
// (sink it a metre under the lake). update(t) runs the water and the mist.
export function rauros(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'rauros';
  const W = 60;
  const H = 50;
  const lipZ = (x) => -9 + 9 * (x / W) ** 2;

  // the sheet of water: the river sliding to the lip, then the fall
  const NX = 44;
  const NA = 6;
  const NF = 24;
  const pos = [];
  const uv = [];
  for (let j = 0; j <= NA + NF; j++) {
    const t = j <= NA ? -1 + j / NA : (j - NA) / NF;
    for (let i = 0; i <= NX; i++) {
      const x = -W - 3 + ((2 * W + 6) * i) / NX;
      const zl = lipZ(x);
      let y;
      let z;
      if (t <= 0) {
        y = H + 0.4 + t * t * 1.5;
        z = zl + t * 45;
      } else {
        const out = 1 - (1 - Math.min(1, t * 2.4)) ** 2;
        y = H + 0.4 - (H + 0.4) * Math.pow(t, 1.15);
        z = zl + 5 * out + 3 * smooth(0.82, 1, t) + Math.sin(x * 0.23) * 0.7 * t;
      }
      pos.push(x, y, z);
      uv.push(x / 10, t);
    }
  }
  const sheetMesh = new THREE.Mesh(geoOf(pos, gridIdx(NA + NF, NX, true), uv), mats.falls);
  sheetMesh.name = 'falls';
  g.add(sheetMesh);

  // the foam spreading from the foot
  {
    const fp = [];
    const fu = [];
    const NR = 6;
    for (let j = 0; j <= NR; j++) {
      for (let i = 0; i <= NX; i++) {
        const x = -W - 3 + ((2 * W + 6) * i) / NX;
        fp.push(x * (1 + j * 0.04), 1.25, lipZ(x) + 7 + j * 7);
        fu.push(i / NX, j / NR);
      }
    }
    const foam = new THREE.Mesh(geoOf(fp, gridIdx(NR, NX, true), fu), mats.foam);
    foam.name = 'foam';
    foam.renderOrder = 2;
    g.add(foam);
  }

  // the rock: two shoulders, two lower spurs at the foot, and the two
  // buttresses that split the fall
  const bk = parts();
  const crag = (seed, w, h, d, at) => {
    const geo = cragGeo(seed, w, h, d, 9);
    geo.translate(...at);
    paintHull(geo, [], stonePaint(seed + 9, { moss: 1.4, lichen: 0.4, damp: 1, base: C(0x67655f), vary: 0.2, scale: 7, ground: -2, streaks: 1 }));
    boxUV(geo, 0.07);
    bk.add(mats.rock, geo);
    return geo;
  };
  const shoulders = [
    crag(3, 64, 80, 70, [-W - 36, 26, -28]),
    crag(11, 46, 56, 40, [-W - 18, 18, -4]),
    crag(12, 34, 30, 56, [-W - 70, 10, -10]),
    crag(4, 62, 76, 68, [W + 35, 24, -26]),
    crag(13, 44, 50, 38, [W + 17, 15, -3]),
    crag(14, 36, 34, 52, [W + 68, 12, -14]),
  ];
  crag(5, 30, 22, 26, [-W - 4, 4, 16]);
  crag(6, 28, 18, 24, [W + 6, 3, 14]);
  crag(7, 9, 60, 16, [-20, 25, lipZ(-20) + 2]);
  crag(8, 8, 56, 14, [23, 23, lipZ(23) + 2]);
  // pines along the shoulders' tops, on their level ground
  const r = rng(9);
  const pines = [];
  for (const geo of shoulders) {
    const p = geo.attributes.position;
    const nrm = geo.attributes.normal;
    for (let i = 0, tries = 0; i < 14 && tries < 3000; tries++) {
      const k = Math.floor(r() * (p.count / 3)) * 3;
      if (nrm.getY(k) < 0.7) continue;
      const x = (p.getX(k) + p.getX(k + 1) + p.getX(k + 2)) / 3;
      const y = (p.getY(k) + p.getY(k + 1) + p.getY(k + 2)) / 3;
      const z = (p.getZ(k) + p.getZ(k + 1) + p.getZ(k + 2)) / 3;
      if (y < 22) continue;
      const s = 0.7 + r() * 0.6;
      const cone = new THREE.ConeGeometry(2.4 * s, 10 * s, 6).translate(x, y + 4.5 * s, z);
      const c = C(0x1e2e18).multiplyScalar(0.8 + r() * 0.5);
      pines.push(tint(cone, (px, py, pz, out, nx, ny) => out.copy(c).multiplyScalar(0.75 + 0.35 * ny)));
      i++;
    }
  }
  bk.add(mats.tree, mergeGeometries(pines.map((x) => x.toNonIndexed())));
  bk.build(g, { shadow: false, receive: false });

  // the mist at the foot, rising and drifting out
  {
    const COUNT = 46;
    const mp = [];
    const corner = [];
    const puff = [];
    const idx = [];
    for (let i = 0; i < COUNT; i++) {
      const x = -W + 4 + ((2 * W - 8) * (i + r() * 0.8)) / COUNT;
      const at = [x, 1 + r() * 5, lipZ(x) + 5 + r() * 6];
      const pf = [r() * 10, 16 + r() * 14, 0.025 + r() * 0.03, r()];
      for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        mp.push(...at);
        corner.push(cx, cy);
        puff.push(...pf);
      }
      idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
    mg.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
    mg.setAttribute('puff', new THREE.Float32BufferAttribute(puff, 4));
    mg.setIndex(idx);
    mg.boundingSphere = new THREE.Sphere(V3(0, 25, 10), 110);
    const mist = new THREE.Mesh(mg, mats.mist);
    mist.name = 'mist';
    mist.renderOrder = 3;
    g.add(mist);
  }
  const u = mats.falls.uniforms;
  return {
    group: g,
    update(t) {
      u.uTime.value = t;
    },
  };
}
