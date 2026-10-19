// The Eye on its tower, far off. Moved out of props.js as it was; its fire
// is the kit’s.

import * as THREE from 'three';
import { clamp01 } from '../../../../lib/paint';
import { cyl, parts, tf } from '../../shire/build';
import { C, sweep3, TAU, tint, V3 } from './helpers';

// ── the Eye ──

// The vision from the Seat of Seeing: the dark of Barad-dûr, tier on tier
// of black battlements, buttresses like blades and spires, narrowing up
// into two great prongs that curve out and in again like a crown; and
// cradled between them the Eye, wreathed in flame. About 40 m tall,
// standing on y = 0, the Eye at about y = 33; the prongs and the Eye open to ±z (to be seen from
// along x). Nothing in it takes the fog, and the tower's black catches the
// Eye's fire about its top. update(t, k), k 0..1 how fiercely it burns.
export function eye(K) {
  const { mats } = K;
  const g = new THREE.Group();
  g.name = 'eye';
  const EYE = V3(0, 37.5, 0);
  const T = [];
  // the tiers, each narrower, turned against the one below
  [[0, 8, 14, 10.5], [8, 7, 9, 7.6], [15, 7, 7.2, 6.1], [22, 6, 5.8, 4.9], [28, 4, 4.6, 4.2]].forEach(([y0, h, r0, r1], i) => {
    T.push(tf(cyl(r1, r0, h, 8), { p: [0, y0 + h / 2, 0], r: [0, (i % 2) * 0.39, 0] }));
    // a battlement of spikes round its top
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU + (i % 2) * 0.39 + 0.39;
      T.push(tf(new THREE.ConeGeometry(0.5 + r1 * 0.04, 2 + (j % 2) * 1.5, 4), { p: [Math.cos(a) * r1 * 0.95, y0 + h + 0.8, Math.sin(a) * r1 * 0.95] }));
    }
  });
  // blade-like buttresses up the lower tiers, spires round the upper
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    T.push(tf(new THREE.ConeGeometry(1.6, 26, 4), { p: [Math.cos(a) * 9.2, 12, Math.sin(a) * 9.2], s: [0.35, 1, 1.5], r: [0, -a, 0] }));
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    T.push(tf(new THREE.ConeGeometry(0.9, 11, 4), { p: [Math.cos(a) * 6.6, 25, Math.sin(a) * 6.6], r: [Math.sin(a) * 0.1, 0, -Math.cos(a) * 0.1] }));
  }
  // the two prongs, out and up and in, spurred along their backs
  for (const sd of [-1, 1]) {
    const P = [[0, 30, sd * 3.2], [0, 33.5, sd * 5.6], [0, 38, sd * 6.6], [0, 42.5, sd * 5.4], [0, 46, sd * 3.0]];
    T.push(sweep3(P, [[1.5, 2.2], [1.3, 1.6], [1.0, 1.15], [0.6, 0.6], [0.08, 0.08]], { seg: 14, radial: 6, side: [1, 0, 0] }));
    for (let k = 0; k < 5; k++) {
      const y = 32 + k * 2.6;
      const z = sd * (6.4 + Math.sin((k / 4) * Math.PI) * 1.2 - k * 0.15);
      T.push(tf(new THREE.ConeGeometry(0.35, 2.6, 4), { p: [0, y, z], r: [sd * (1.0 + k * 0.12), 0, 0] }));
    }
  }
  const bk = parts();
  const glow = C(0x8a2808);
  const base = C(0x0c0807);
  const to = V3();
  for (const piece of T) {
    const geo = piece.index ? piece.toNonIndexed() : piece;
    if (geo.attributes.uv) geo.deleteAttribute('uv');
    tint(geo, (x, y, z, out, nx, ny, nz) => {
      to.set(EYE.x - x, EYE.y - y, EYE.z - z);
      const d = to.length();
      const facing = Math.max(0, (nx * to.x + ny * to.y + nz * to.z) / d);
      out.copy(base).lerp(glow, Math.min(1, Math.exp(-d / 7) * (0.3 + 0.9 * facing)));
    });
    bk.add(mats.tower, geo);
  }
  // drawn 46 m tall, brought down to 40
  const FIT = 40 / 46;
  for (const m of bk.build(g, { shadow: false, receive: false })) m.geometry.scale(FIT, FIT, FIT);
  const fire = new THREE.Mesh(new THREE.PlaneGeometry(26 * FIT, 26 * FIT), mats.eye);
  fire.position.copy(EYE).multiplyScalar(FIT);
  fire.renderOrder = 5;
  fire.frustumCulled = false;
  fire.name = 'eyeOfSauron';
  g.add(fire);
  const u = mats.eye.uniforms;
  return {
    group: g,
    update(t, k = 0.6) {
      u.uTime.value = t;
      u.uK.value = clamp01(k);
      mats.tower.color.setScalar(0.75 + 0.5 * clamp01(k));
    },
  };
}
