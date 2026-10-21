// Evil Rick's lair ("Close Rick-counters of the Rick Kind"): a dark hangar
// of green-black steel, its north wall glazed onto the dome of wired Mortys
// (the place's world, ./worlds.js), five pods with Mortys of their own in
// glass (the cast's Morty clones, in their shirts), Evil Rick's console with
// its screen of tracked Ricks, and the chair at the back where the Morty
// with the eyepatch sits with his arms crossed. The three pods with plugs are
// freed one by one (the area's 'freed1'…'freed3'); all three freed
// ('collected'), Evil Rick comes for Morty, and the fight is stage.js's duel
// (./duel.js). Spoken to after, Evil Morty leaves through a yellow portal
// ('leave').

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xbfe8d0, 0.9], hemi: [0x9ad8b8, 0x2a3a30, 2.1], fog: null, background: 0x060c08 };
const STEEL = 0x2a3a30;
const DARK = 0x121a14;

export async function buildEvilrick(kit) {
  const S = stage(kit, 'evilrick', { floor: specks('#1e2a22', ['#18231c', '#243028'], 21, 900, 2), floorTile: 3, wall: STEEL, ceiling: DARK, skirt: DARK });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const W = A.x1 - A.x0;

  // ribs and strip lights
  for (let dz = -18; dz <= 18; dz += 4) for (const x of [A.x0 + 0.2, A.x1 - 0.2]) R.frame(x, P(0, dz)[1], 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.4, H, 0.5);
  for (let dz = -14; dz <= 14; dz += 7) R.frame(...P(0, dz), 0, { list: 'fixed' }).box(DARK, 0, H - 0.4, 0, W - 1, 0.3, 0.5).glow(BOX, 0x4aff7a, 1.2, 0, H - 0.44, 0, 0, W - 2, 0.04, 0.2);
  // his console and its screen
  const [cx, cz] = P(0, -14);
  const C = R.frame(cx, cz, 0);
  C.box(DARK, 0, 0, 0, 7, 1.1, 1.6).box(STEEL, 0, 1.1, 0, 7.1, 0.08, 1.7).box(0x0a120c, 0, 1.2, -0.5, 6.4, 1.4, 0.14, 0, -0.35);
  C.glow(BOX, 0x4aff7a, 1.3, 0, 1.6, -0.42, 0, 6, 1.0, 0.02, -0.35);
  for (let k = 0; k < 10; k++) C.glow(BALL, k % 4 ? 0x4aff7a : 0xff3a3a, 1.6, -2.7 + k * 0.6, 1.16, 0.5, 0, 0.08);
  // the pods: glass tubes on dark bases along both walls, a Morty in each
  const tubeMat = R.own(new THREE.MeshBasicMaterial({ color: 0x9affc0, transparent: true, opacity: 0.2, depthWrite: false }));
  const tubeGeo = R.own(new THREE.CylinderGeometry(0.8, 0.8, 2.6, 16, 1, true));
  const pods = [];
  const podAt = [
    [-17, -8, 0],
    [-17, -2, 0],
    [-17, 4, 0],
    [17, 2, Math.PI],
    [17, 8, Math.PI],
  ];
  for (const [i, [dx, dz, face]] of podAt.entries()) {
    const [x, z] = P(dx, dz);
    const f = R.frame(x, z, 0);
    f.cyl(DARK, 0, 0, 0, 0.95, 0.4).cyl(DARK, 0, 3, 0, 0.95, 0.3).glow(BALL, i < 3 ? 0xff3a3a : 0x4aff7a, 1.5, 0, 3.4, 0, 0, 0.1);
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(x, 1.7, z);
    R.add(tube, { ink: false });
    const pod = { tube, clone: null, freed: false };
    pods.push(pod);
    S.figure('mortyclone', { x, z, y: 0.4, face, h: 1.95, onPlace: (c) => (pod.clone = c.group) });
    // a cable from the pod's top to the ceiling
    f.cyl(0x4a5a50, 0, 3.3, 0, 0.04, H - 3.3);
  }
  // Evil Morty's chair, at the back
  const [ex, ez] = P(14.6, -14);
  R.frame(ex, ez, Math.PI / 2).box(0x1a1a22, 0, 0, 0, 1.1, 0.5, 1.1).box(0x1a1a22, 0, 0.5, -0.45, 1.1, 1, 0.12).box(0x5a5a66, -0.5, 0.5, 0, 0.1, 0.3, 1).box(0x5a5a66, 0.5, 0.5, 0, 0.1, 0.3, 1);
  // crates
  R.frame(...P(-6, 6), 0.2).box(STEEL, 0, 0, 0, 2.4, 1.5, 2.4).box(DARK, 0, 1.5, 0, 2.5, 0.1, 2.5);
  R.frame(...P(7, 4), -0.3).box(STEEL, 0, 0, 0, 2, 1.2, 2);
  // the sign over the door he came in by
  R.cell('evilsign', 160, 40, (g, w, h) => {
    g.fillStyle = '#0a120c';
    g.fillRect(0, 0, w, h);
    fitText(g, 'DIMENSION J19ζ7', w / 2, h / 2, w - 12, 16, { color: '#4aff7a' });
  });
  R.frame(...P(0, (A.z1 - A.z0) / 2 - 0.14), Math.PI, { list: 'fixed' }).decal('evilsign', 0, 3.4, 0.06, 4, 1);
  // the yellow portal Evil Morty leaves by, where his chair is
  const swirlMat = R.own(kit.portal());
  swirlMat.uniforms.open.value = 0;
  const swirl = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.6, 3)), swirlMat);
  swirl.position.set(ex, 1.6, ez + 1.2);
  swirl.visible = false;
  R.add(swirl, { ink: false });
  // (its colour: the show's yellow, not Rick's green)
  if (swirlMat.uniforms.tint) swirlMat.uniforms.tint.value = new THREE.Color(0xffd84a);

  S.people();
  let leftAt = null;
  let now = 0;
  const area = S.done(LIGHT, (t, dt, state, camera) => {
    now = t;
    for (const p of pods) {
      if (p.clone) p.clone.visible = !p.freed;
      p.tube.visible = !p.freed;
    }
    if (leftAt != null) {
      const age = t - leftAt;
      swirl.visible = age < 5;
      swirlMat.uniforms.t.value = t;
      swirlMat.uniforms.open.value = age < 4 ? 1 : Math.max(0, 5 - age);
      if (camera) swirl.rotation.y = Math.atan2(camera.position.x - swirl.position.x, camera.position.z - swirl.position.z);
    }
  });
  const freed = (i) => () => {
    pods[i].freed = true;
  };
  area.actions = {
    ...area.actions,
    freed1: freed(0),
    freed2: freed(1),
    freed3: freed(2),
    // the last pod: he comes for Morty
    collected: () => S.hunt(true),
    leave: () => {
      leftAt = now;
    },
    calm: () => {
      for (const p of pods) p.freed = false;
      leftAt = null;
      swirl.visible = false;
      S.calm();
    },
  };
  return area;
}
