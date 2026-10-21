// The vat of acid ("The Vat of Acid Episode"): a back room with the vat in
// the middle, a round steel tank of green, with a ladder and a rim, fake
// bones on a shelf, barrels, the crystal in its case. Rick and the two
// Gromflomites he's about to fool are models placed from ./destinations.js.
// Jumping in ('splash') ripples the green and sends up a few bubbles.

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xd8ffd8, 0.8], hemi: [0xc8f0c8, 0x2a3a2a, 1.7], fog: null, background: 0x0a140a };

export async function buildVat(kit) {
  const S = stage(kit, 'vat', { floor: specks('#4a5a4a', ['#445444', '#505f50'], 5, 700, 2), floorTile: 3, wall: 0x6a7a6a, ceiling: 0x2a3a2a, skirt: 0x2a3a2a });
  const { R, P } = S;

  // the vat: a steel tank, a rim, a ladder up its side, and the acid's surface
  const [vx, vz] = P(0, -4);
  const V = R.frame(vx, vz, 0);
  V.cyl(0x7a8a8a, 0, 0, 0, 2.6, 2.2).cyl(0x9aa8a8, 0, 2.2, 0, 2.75, 0.2);
  for (let y = 0.3; y < 2.2; y += 0.4) V.box(0x8a9a9a, 2.62, y, 0, 0.06, 0.06, 0.6).box(0x8a9a9a, 2.62, 0, 0.28, 0.06, 2.4, 0.06).box(0x8a9a9a, 2.62, 0, -0.28, 0.06, 2.4, 0.06);
  const acidMat = R.own(new THREE.MeshBasicMaterial({ color: 0x6aff3a, transparent: true, opacity: 0.9 }));
  const acid = new THREE.Mesh(R.own(new THREE.CircleGeometry(2.5, 32)), acidMat);
  acid.rotation.x = -Math.PI / 2;
  acid.position.set(vx, 2.0, vz);
  R.add(acid, { ink: false });
  const bubbles = [];
  for (let k = 0; k < 8; k++) {
    const b = new THREE.Mesh(BALL, R.own(new THREE.MeshBasicMaterial({ color: 0xbfffa0, transparent: true, opacity: 0.8 })));
    b.scale.setScalar(0.12 + (k % 3) * 0.05);
    b.position.set(vx + Math.cos(k * 0.8) * 1.4, 2.0, vz + Math.sin(k * 0.8) * 1.4);
    b.visible = false;
    R.add(b, { ink: false });
    bubbles.push(b);
  }
  // the fake bones on a shelf by the vat, with their sign
  R.cell('bonesign', 96, 32, (g, w, h) => {
    g.fillStyle = '#f6f2e0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'BONES (FAKE)', w / 2, h / 2, w - 8, 12, { color: '#2a2a2a', font: 'Comic Sans MS, Marker Felt, cursive' });
  });
  const B = R.frame(...P(0, -10.2), 0);
  B.box(0x6a4a2a, 0, 1.0, 0, 2.4, 0.06, 0.5).decal('bonesign', 0, 0.75, 0.26, 0.9, 0.3);
  for (let k = 0; k < 5; k++) B.box(0xf6f0e0, -0.9 + k * 0.45, 1.06, 0, 0.3, 0.06, 0.08).ball(0xf6f0e0, -0.75 + k * 0.45, 1.09, 0, 0.06);
  B.ball(0xf6f0e0, 0.9, 1.2, 0, 0.14);
  // the crystal in its case, barrels, a sign on the door
  const [cx, cz] = P(-10, 4);
  R.frame(cx, cz, 0).box(0x3a3a3a, 0, 0, 0, 1.2, 1.1, 1.2).box(0xd8b25a, 0, 1.1, 0, 1.25, 0.04, 1.25);
  const caseMat = R.own(new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, depthWrite: false }));
  const glass = new THREE.Mesh(BOX, caseMat);
  glass.position.set(cx, 1.6, cz);
  glass.scale.set(1, 1, 1);
  R.add(glass, { ink: false });
  R.frame(cx, cz, 0).glow(BALL, 0x6ad8ff, 1.8, 0, 1.6, 0, 0, 0.3, 0.4, 0.3);
  R.cell('propertyof', 96, 24, (g, w, h) => {
    g.fillStyle = '#d8b25a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'PROPERTY OF R. SANCHEZ', w / 2, h / 2, w - 6, 8, { color: '#2a1a0a' });
  });
  R.frame(cx, cz, 0).decal('propertyof', 0, 0.6, 0.61, 1, 0.24);
  for (const [dx, dz] of [
    [9, 6],
    [10, 4.4],
  ]) R.frame(...P(dx, dz), 0).cyl(0x3a6a3a, 0, 0, 0, 0.6, 1.1).cyl(0x2a4a2a, 0, 1.1, 0, 0.62, 0.05).glow(BALL, 0x6aff3a, 1.2, 0, 0.6, 0.61, 0, 0.1);

  S.people();
  let splashAt = null;
  let now = 0;
  const area = S.done(LIGHT, (t) => {
    now = t;
    acid.position.y = 2.0 + Math.sin(t * 1.3) * 0.02;
    const age = splashAt == null ? Infinity : t - splashAt;
    for (const [k, b] of bubbles.entries()) {
      b.visible = age < 6;
      if (b.visible) b.position.y = 2.0 + ((age * 0.6 + k * 0.3) % 1.2);
    }
    acidMat.color.setHex(age < 1 ? 0x9aff6a : 0x6aff3a);
  });
  // (its splash, when Morty jumps in: the stage's freeze says when)
  S.freeze({
    splash: () => {
      splashAt = now;
    },
  });
  area.actions = {
    ...area.actions,
    calm: () => {
      splashAt = null;
      S.calm();
    },
  };
  return area;
}
