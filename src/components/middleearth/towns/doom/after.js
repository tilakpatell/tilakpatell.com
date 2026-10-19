// After: the field of lava for the eruption, and the rock Frodo and Sam
// wait on. Moved out of props.js as they were.

import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { makeNoise, smooth } from '../../../../lib/paint';
import { boxUV, rng } from '../../shire/build';
import { facet, hullRock, noise3, oneGeo, spikeAt, TAU, tint, V3 } from './helpers';
import { ASH } from './plain';

// ── after ──

// A field of lava for the eruption: w × d, flowing along -z (to the
// south... the uv's +v), crusted plates drifting on it, white-hot in the
// seams, swelling slowly. Its middle at the origin, lying on y = 0.
export function lavaField(K, w = 200, d = 200) {
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
export function refuge(K) {
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
