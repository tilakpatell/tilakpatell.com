// The Galactic Federation's prison ("The Rickshank Rickdemption"): a green
// steel block with cells down the west wall, pillars and crates to hide
// behind, two switch boxes, and at the far end the Brainalyzer (a model)
// with Rick in it and Cornvelious Daniel at his console. The guards walk
// their rounds (./destinations.js; stage.js's NPC behaviour). Each switch
// thrown ('switch1', 'switch2') puts out a bank of lights; Rick unstrapped
// ('freed') is the task done.

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xe8ffe8, 0.75], hemi: [0xc8f0d8, 0x2a3a30, 1.9], fog: null, background: 0x0a140e };
const STEEL = 0x4a6a5a;
const DARK = 0x2a3a32;

export async function buildPrison(kit) {
  const S = stage(kit, 'prison', { floor: specks('#3a4a42', ['#34443c', '#405048'], 9, 900, 2), floorTile: 3, wall: STEEL, ceiling: DARK, skirt: 0x1a2a22 });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const W = A.x1 - A.x0;

  // ribs, and two banks of ceiling lights (their own meshes, so the switches can put them out)
  for (let dz = -18; dz <= 18; dz += 4) for (const x of [A.x0 + 0.2, A.x1 - 0.2]) R.frame(x, P(0, dz)[1], 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.4, H, 0.5);
  const lightMats = [R.own(new THREE.MeshBasicMaterial({ color: 0x9affc0 })), R.own(new THREE.MeshBasicMaterial({ color: 0x9affc0 }))];
  for (const [i, dz] of [-12, -4, 4, 12].entries()) {
    R.frame(...P(0, dz), 0, { list: 'fixed' }).box(DARK, 0, H - 0.4, 0, W - 1, 0.3, 0.5);
    const strip = new THREE.Mesh(BOX, lightMats[i % 2]);
    strip.position.set(P(0, dz)[0], H - 0.44, P(0, dz)[1]);
    strip.scale.set(W - 2, 0.04, 0.25);
    R.add(strip, { ink: false });
  }
  // pillars and crates
  for (const [dx, dz] of [
    [-6, 0],
    [6, 0],
    [0, 8],
  ]) R.frame(...P(dx, dz), 0).cyl(DARK, 0, 0, 0, 1, H).cyl(STEEL, 0, 0, 0, 1.2, 0.4);
  for (const [dx, dz, w, d] of [
    [-12, -8, 2.4, 2.4],
    [10, -12, 2, 2],
  ]) R.frame(...P(dx, dz), 0).box(STEEL, 0, 0, 0, w, 1.7, d).box(DARK, 0, 1.7, 0, w + 0.1, 0.1, d + 0.1);
  // the switch boxes, a lever each, their lamp green till thrown
  const lamps = [];
  for (const [i, dx] of [-17.4, 17.4].entries()) {
    const f = R.frame(...P(dx, -2), dx < 0 ? Math.PI / 2 : -Math.PI / 2);
    f.box(DARK, 0, 0, 0, 1.2, 1.6, 0.8).box(0x8a8a8a, 0, 1.0, 0.42, 0.08, 0.6, 0.08, 0, -0.6);
    const lamp = new THREE.Mesh(BALL, R.own(new THREE.MeshBasicMaterial({ color: 0x4aff7a })));
    lamp.position.set(P(dx, -2)[0] + (dx < 0 ? 0.45 : -0.45), 1.5, P(dx, -2)[1]);
    lamp.scale.setScalar(0.18);
    R.add(lamp, { ink: false });
    lamps[i] = lamp;
  }
  // Cornvelious Daniel's console (behind the chair, the north wall's window
  // onto space: its world's, ./worlds.js)
  const [cx, cz] = P(4, -15.6);
  R.frame(cx, cz, 0).box(DARK, 0, 0, 0, 4, 1.1, 1.4).box(STEEL, 0, 1.1, 0, 4.1, 0.08, 1.5).glow(BOX, 0x9affc0, 1.3, 0, 1.3, -0.4, 0, 3.4, 0.6, 0.02, -0.4);
  // the cells down the west wall
  for (let dz = 8; dz <= 16; dz += 2.5) {
    const f = R.frame(...P(-18.6, dz), Math.PI / 2, { list: 'fixed' });
    f.box(DARK, 0, 0, 0, 2.2, 3, 1.2);
    for (let u = -0.9; u <= 0.9; u += 0.3) f.cyl(0x8a9a90, u, 0, 0.62, 0.03, 2.6);
  }
  // the Federation's mark over the door
  R.cell('prisonsign', 160, 40, (g, w, h) => {
    g.fillStyle = '#0a140e';
    g.fillRect(0, 0, w, h);
    fitText(g, 'GALACTIC FEDERATION', w / 2, h / 2, w - 12, 14, { color: '#d8ff80' });
  });
  R.frame(...P(0, (A.z1 - A.z0) / 2 - 0.14), Math.PI, { list: 'fixed' }).decal('prisonsign', 0, 3.4, 0.06, 4, 1);

  S.people();
  const thrown = [false, false];
  const area = S.done(LIGHT, () => {
    for (const i of [0, 1]) {
      lightMats[i].color.setHex(thrown[i] ? 0x1a2a22 : 0x9affc0);
      lamps[i]?.material.color.setHex(thrown[i] ? 0x3a4a40 : 0x4aff7a);
    }
  });
  area.actions = {
    ...area.actions,
    switch1: () => {
      thrown[0] = true;
    },
    switch2: () => {
      thrown[1] = true;
    },
    freed: () => {},
    calm: () => {
      thrown[0] = thrown[1] = false;
      S.calm();
    },
  };
  return area;
}
