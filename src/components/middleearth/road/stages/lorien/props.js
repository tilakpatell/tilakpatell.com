// Lothlórien’s landmarks, built with the Lothlórien chapter’s own builders
// (towns/lorien/{mallorn,flets,mirror,boat}.js) on the Road’s Lothlórien
// kit: great mallorns along the road, silver and gold, and far ones round
// the wood; a stair of pale elven wood up beside the road to a wide flet
// round the greatest of them, the dais on it, and down again; Galadriel’s
// Mirror in its hollow; the hythe on the Silverlode with three grey boats.
// In the stage’s frame: the road along +z from 0, +x on the walker’s left.
// The stair runs straight up the road (the Road’s walkers keep to its
// line), its posts down to the ground, lanterns along it.
//
//   buildProps({ K, road, heightAt, tier }) → { group, mirror, boats, floor(x, z), flet, dispose }
//   DAIS, MIRROR, HYTHE, UP, DOWN, RISE: where they stand, for the beats and the scene

import * as THREE from 'three';
import { mallorn, mallornFarGeo } from '../../../towns/lorien/mallorn';
import { flet as buildFlet, lantern } from '../../../towns/lorien/flets';
import { mirror as buildMirror } from '../../../towns/lorien/mirror';
import { boat as buildBoat } from '../../../towns/lorien/boat';
import { C, merged, mergeStatics, part } from '../parts';

export const RISE = 18; // m: the flet over the ground
export const DAIS = { tree: [-9, 80], r: 12 }; // the greatest mallorn, its flet over the road
export const UP = [46, 75]; // m: the stair up
export const DOWN = [85, 97]; // m: and down
export const MIRROR = { at: [-6, 103] }; // the Mirror in its hollow, its steps to the road
export const HYTHE = { z: [126, 136] }; // the landing on the Silverlode

// the mallorns by the road: [x, z, height, seed] (on low the first three)
const TREES = [
  [-12, 24, 52, 11],
  [14, 42, 56, 12],
  [12, 96, 50, 14],
  [-17, 122, 54, 15],
];
const WOOD = 0xe2e5e8;

export function buildProps({ K, road, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'lorien:props';
  const ground = (x, z) => heightAt(x, z);
  const top = heightAt(0, DAIS.tree[1]) + RISE;
  const foot = [heightAt(0, UP[0]), heightAt(0, DOWN[1])];

  // the great mallorn and its flet over the road
  const great = mallorn(K, { h: 64, r: 2.2, seed: 13 });
  great.group.position.set(DAIS.tree[0], ground(...DAIS.tree), DAIS.tree[1]);
  group.add(great.group);
  const flet = buildFlet(K, { r: DAIS.r, trunkR: great.radiusAt(top - ground(...DAIS.tree)) });
  flet.group.position.set(DAIS.tree[0], top, DAIS.tree[1]);
  group.add(flet.group);
  for (const [x, z, h, seed] of tier === 'low' ? TREES.slice(0, 3) : TREES) {
    const t = mallorn(K, { h, r: 1.8, seed });
    t.group.position.set(x, ground(x, z), z);
    group.add(t.group);
  }
  // the wood beyond: far mallorns in a ring, one instanced draw
  const far = mallornFarGeo(3);
  const ring = [];
  for (let i = 0; i < (tier === 'low' ? 14 : 26); i++) {
    const a = (i / (tier === 'low' ? 14 : 26)) * Math.PI * 2;
    const r = 70 + ((i * 37) % 30);
    ring.push([Math.cos(a) * r, 75 + Math.sin(a) * r * 1.1]);
  }
  const wood = new THREE.InstancedMesh(far, K.mats.far, ring.length);
  const m = new THREE.Matrix4();
  ring.forEach(([x, z], i) => {
    const k = 0.9 + ((i * 7) % 5) * 0.08;
    m.compose(new THREE.Vector3(x, ground(x, z) - 1, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 1.7), new THREE.Vector3(k, k, k));
    wood.setMatrixAt(i, m);
  });
  wood.name = 'lorien:wood';
  group.add(wood);

  // the stairs up and down: treads on two stringers, posts to the ground, a handrail
  const woodMat = road.material({ vertexColors: true, flatShading: true });
  const geos = [];
  const flight = (z0, z1, y0, y1) => {
    const run = z1 - z0;
    const n = Math.max(2, Math.round(Math.abs(y1 - y0) / 0.32));
    const pitch = Math.atan2(y1 - y0, run);
    const len = Math.hypot(run, y1 - y0);
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n;
      geos.push(part(new THREE.BoxGeometry(2.4, 0.1, run / n + 0.04), C(WOOD), { at: [0, y0 + (y1 - y0) * k - 0.04, z0 + run * k] }));
    }
    for (const s of [-1, 1]) {
      geos.push(part(new THREE.BoxGeometry(0.12, 0.34, len), C(0xcfd4d8), { at: [s * 1.25, (y0 + y1) / 2 - 0.2, (z0 + z1) / 2], pitch: -pitch }));
      geos.push(part(new THREE.BoxGeometry(0.06, 0.06, len), C(0xdfe4e8), { at: [s * 1.25, (y0 + y1) / 2 + 0.95, (z0 + z1) / 2], pitch: -pitch }));
      for (let z = z0 + 2; z < z1 - 1; z += 3) {
        const y = y0 + ((z - z0) / run) * (y1 - y0);
        geos.push(part(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), C(0xdfe4e8), { at: [s * 1.25, y + 0.5, z] }));
      }
    }
    // (slender posts down to the ground every few metres)
    for (let z = z0 + 4; z < z1 - 1; z += 6) {
      const y = y0 + ((z - z0) / run) * (y1 - y0);
      const g = ground(0, z);
      if (y - g > 1) for (const s of [-1, 1]) geos.push(part(new THREE.CylinderGeometry(0.1, 0.14, y - g, 6), C(0xd8dde2), { at: [s * 1.15, (y + g) / 2, z] }));
    }
  };
  flight(UP[0], UP[1], foot[0], top);
  flight(DOWN[0], DOWN[1], top, foot[1]);
  // the walk between the stairs and the flet’s edge, where the flet leaves the road
  geos.push(part(new THREE.BoxGeometry(2.4, 0.12, DOWN[0] - UP[1]), C(WOOD), { at: [0, top - 0.06, (UP[1] + DOWN[0]) / 2] }));
  // the dais on the flet: a low round of pale stone by the trunk
  geos.push(part(new THREE.CylinderGeometry(2.4, 2.6, 0.32, 28), C(0xf2f0ea), { at: [-4.2, top + 0.16, DAIS.tree[1] + 0.8] }));
  const stairs = merged(geos, woodMat, 'lorien:stairs');
  group.add(stairs);

  // lanterns along the stairs, blue-white
  const lamps = [];
  for (const [z0, z1, y0, y1] of [[UP[0], UP[1], foot[0], top], [DOWN[0], DOWN[1], top, foot[1]]])
    for (let z = z0 + 5; z < z1; z += 8) {
      const l = lantern(K);
      l.group.position.set(1.45, y0 + ((z - z0) / (z1 - z0)) * (y1 - y0) + 1.4, z);
      l.group.scale.setScalar(1.2);
      group.add(l.group);
      lamps.push(l);
    }

  // Galadriel’s Mirror, its steps (the chapter’s +z) to the road
  const mirror = buildMirror(K);
  mirror.group.position.set(MIRROR.at[0], ground(...MIRROR.at), MIRROR.at[1]);
  mirror.group.rotation.y = Math.PI / 2;
  group.add(mirror.group);

  // the hythe: a landing of pale planks, three grey boats tied by it
  const landing = merged([part(new THREE.BoxGeometry(4, 0.16, HYTHE.z[1] - HYTHE.z[0]), C(WOOD), { at: [0, 0, 0] })], woodMat, 'lorien:hythe');
  landing.position.set(0, ground(0, HYTHE.z[0]) + 0.3, (HYTHE.z[0] + HYTHE.z[1]) / 2);
  group.add(landing);
  const boats = [0, 1, 2].map(() => {
    const b = buildBoat(K);
    b.group.rotation.y = -Math.PI / 2;
    group.add(b.group);
    return b;
  });

  // (the stills one a material; the boats, the Mirror’s water and the lanterns’ halos as they are)
  mergeStatics(group, { keep: [...boats.map((b) => b.group), mirror.group, ...lamps.map((l) => l.group), stairs, landing] });

  // what carries the walkers: up the stair, along the flet, down again
  const floor = (x, z) => {
    if (Math.abs(x) > 1.4) return null;
    if (z >= UP[0] && z <= UP[1]) return foot[0] + ((z - UP[0]) / (UP[1] - UP[0])) * (top - foot[0]);
    if (z > UP[1] && z < DOWN[0]) return top;
    if (z >= DOWN[0] && z <= DOWN[1]) return top + ((z - DOWN[0]) / (DOWN[1] - DOWN[0])) * (foot[1] - top);
    return null;
  };

  return {
    group,
    mirror,
    boats,
    flet,
    top,
    floor,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => o.geometry?.dispose());
      woodMat.dispose();
    },
  };
}
