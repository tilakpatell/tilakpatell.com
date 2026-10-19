// The Bridge of Khazad-dûm over the abyss. Moved out of props.js as it
// was; the abyss’s glow and its sparks come from the kit (K.shaders).

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { makeNoise, mix, smooth } from '../../../../lib/paint';
import { parts, rng } from '../../shire/build';
import { noise3, tint } from './helpers';

// ── the bridge and the stairs ──

// A block of stone from its eight corners (x fastest, then y, then z), each
// corner bevelled back along its edges (some chipped deep) so no edge is
// sharp, as a hull: flat-faced.
export function hexHull(P, seed, chamfer = 0.04, chip = 0.25) {
  const r = rng(seed);
  const pts = [];
  for (let c = 0; c < 8; c++) {
    const nb = [c ^ 1, c ^ 2, c ^ 4].map((o) => P[o].clone().sub(P[c]));
    const lens = nb.map((v) => v.length());
    const dirs = nb.map((v) => v.normalize());
    const k = chamfer * (r() < chip ? 2 + r() * 3 : 0.7 + r() * 0.6);
    for (let e = 0; e < 3; e++) {
      const f = (e + 1) % 3;
      pts.push(P[c].clone().addScaledVector(dirs[e], Math.min(k, lens[e] * 0.4)).addScaledVector(dirs[f], Math.min(k, lens[f] * 0.4)));
    }
  }
  return new ConvexGeometry(pts);
}

// Darker the deeper it hangs, a little uneven: the abyss stone's colour.
export const abyssTone = (n) => (x, y, z, out) => {
  out.setRGB(0.78, 0.8, 0.8).multiplyScalar(0.8 + noise3(n, x * 0.6, y * 0.6, z * 0.6) * 0.4);
  out.multiplyScalar(mix(1, 0.12, smooth(-1, -40, y)));
};

// The Bridge of Khazad-dûm: a single span of stone without kerb or rail,
// 1.6 m wide and `len` long along x (from -len/2 to len/2), its deck at
// y = 0. Under the deck a slender arch, thinnest at the middle, plunging at
// either end into the abyss 60 m down, where the fire's red glow comes up
// out of the dark, and sparks with it.
export function bridge(K, len = 30) {
  const { mats, U } = K;
  const g = new THREE.Group();
  g.name = 'khazadDumBridge';
  const n = makeNoise(151);
  const L2 = len / 2;
  const DEPTH = 60;
  const under = (x) => -0.8 - (DEPTH - 0.8) * Math.pow(Math.min(1, Math.abs(x) / L2), 7);
  const width = (y) => (y > -0.4 ? 1.6 : mix(1.05, 0.55, smooth(-0.4, -DEPTH, y)));
  // the section at x: round from the deck's left edge, down the left side
  // of the arch, across its foot, and up the right
  const ROWS = 14;
  const section = (x) => {
    const yb = under(x);
    const pts = [[-0.8, 0.0], [-0.8, -0.32], [-0.6, -0.44]];
    for (let k = 1; k <= ROWS; k++) {
      const y = mix(-0.44, yb, Math.pow(k / ROWS, 1.6));
      pts.push([-width(y) / 2, y]);
    }
    const right = pts.slice().reverse().map(([z, y]) => [-z, y]);
    return [...pts, ...right];
  };
  const xs = [];
  for (let i = 0; i <= 56; i++) {
    const t = i / 56;
    xs.push(-L2 + len * (0.5 - 0.5 * Math.cos(Math.PI * t)));
  }
  const pos = [];
  const secs = xs.map((x) => section(x).map(([z, y]) => [x, y, z]));
  const M = secs[0].length;
  for (let i = 0; i < xs.length - 1; i++) {
    for (let k = 0; k < M; k++) {
      const a = secs[i][k];
      const b = secs[i][(k + 1) % M];
      const c = secs[i + 1][(k + 1) % M];
      const d = secs[i + 1][k];
      pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  }
  // the ends, against the rock
  for (const [i, flip] of [[0, true], [xs.length - 1, false]]) {
    const sec = secs[i];
    const c = sec.reduce((acc, p) => [acc[0] + p[0] / M, acc[1] + p[1] / M, acc[2] + p[2] / M], [0, 0, 0]);
    for (let k = 0; k < M; k++) {
      const a = sec[k];
      const b = sec[(k + 1) % M];
      if (flip) pos.push(...c, ...b, ...a);
      else pos.push(...c, ...a, ...b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  // wear the deck's edges a little
  {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > -0.5 && Math.abs(p.getZ(i)) > 0.7) p.setZ(i, p.getZ(i) * (1 - n(p.getX(i) * 2.5, p.getY(i) * 4) * 0.05));
    }
    geo.computeVertexNormals();
  }
  const bk = parts();
  bk.add(mats.abyss, tint(geo, abyssTone(n)), { uv: 0.5 });
  bk.build(g);

  // the fire's glow, far below
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(90, 90).rotateX(-Math.PI / 2), K.shaders.abyss(U, false));
  floorGlow.position.y = -DEPTH + 2;
  floorGlow.renderOrder = 1;
  floorGlow.geometry.rotateX(Math.PI / 2);
  floorGlow.rotation.x = -Math.PI / 2;
  g.add(floorGlow);
  const cardMat = K.shaders.abyss(U, true);
  for (let i = 0; i < 5; i++) {
    const card = new THREE.Mesh(new THREE.PlaneGeometry(len * 1.7, DEPTH + 4), cardMat);
    const a = (i / 5) * Math.PI;
    card.position.set(Math.cos(a) * 2, -DEPTH / 2 - 2, Math.sin(a) * 3 - 1.5);
    card.rotation.y = a * 0.35 - 0.3;
    card.renderOrder = 1;
    g.add(card);
  }
  const NS = 260;
  const sp = new Float32Array(NS * 3);
  const ss = new Float32Array(NS * 4);
  const r = rng(153);
  for (let i = 0; i < NS; i++) ss.set([r(), r(), r(), r()], i * 4);
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 4));
  const sparks = new THREE.Points(sg, K.shaders.spark(U, K));
  sparks.material.uniforms.uSpan.value.set(len * 1.3, DEPTH, 14);
  sparks.frustumCulled = false;
  sparks.renderOrder = 2;
  g.add(sparks);
  const glow = {
    set(k) {
      const t = Math.max(0, k);
      floorGlow.material.uniforms.uK.value = t;
      cardMat.uniforms.uK.value = t;
      sparks.material.uniforms.uK.value = t;
      U.uFire.value = t;
    },
  };
  const update = (t) => {
    U.uTime.value = t;
    sparks.material.userData.fit();
  };
  update(0);
  return { group: g, glow, update, len, width: 1.6, depth: DEPTH };
}
