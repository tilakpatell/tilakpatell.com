// Weathertop’s landmarks, built with the Weathertop chapter’s own builders
// (towns/weathertop/build.js and trollshaws.js, on the Road’s town kit with
// its wild materials): Amon Sûl’s ruin on the crown, its broken ring of
// weathered walls and three arches, the flagstones and the plinth, turned
// so the road comes in under an arch and out by the wide gap on the far
// side; Sam’s camp in the dell under it, the fire-ring, the bedrolls, the
// pan; crags and dead trees on the hill’s flanks, weeds about the ruin, and
// the athelas by the road where Frodo falls. In the stage’s frame: the road
// along +z from 0, +x on the walker’s left.
//
//   buildProps({ K, heightAt }) → { group, camp, athelas, dispose }
//   RING, FIRE, KINGSFOIL: where they stand, for the beats and the scene

import * as THREE from 'three';
import { camp as buildCamp, rockGeo, ruin } from '../../../towns/weathertop/build';
import { athelas as buildAthelas, deadTree, weed } from '../../../towns/weathertop/trollshaws';
import { RUIN } from '../../../towns/weathertop/layout';
import { rngOf } from '../../scatter';
import { mergeStatics } from '../parts';

// the ruin: its middle off the road’s line, so the plinth stands beside the
// walkers, and turned (yaw) so its arch at −0.875 rad is where the road comes in
export const RING = { at: [2.2, 122], scale: 1.3, yaw: 0.87 };
export const FIRE = [2.4, 68.5]; // Sam’s fire in the dell, beside the road
export const KINGSFOIL = [1.3, 147.2]; // the athelas, where Frodo lies
const WILD = 0.68; // the Road’s hobbit (1.05 m) over the chapter’s (1.55): the camp and the plants
const CRAGS = 46; // rocks on the hill’s flanks
const BOULDERS = 70; // the Lone-lands’ stones, strewn wide either side of the road
const DEAD = [[-14, 84, 1], [18, 98, 2], [-22, 140, 3], [12, 40, 4], [-30, 22, 5], [34, 60, 6], [-40, 112, 7], [26, 8, 8], [-9, 52, 9], [44, 150, 10]]; // x, z, seed
// the old stones by the road: standing stones of the Dúnedain’s watch on the hills, a cairn: x, z, height, lean
const STANDING = [[9, 30, 2.6, 0.06], [11.5, 31.8, 2.1, -0.08], [13, 29.4, 1.6, 0.12], [-18, 66, 3, -0.05], [-8, 150, 2.4, 0.1]];
const CAIRN = [-4.6, 44];

export function buildProps({ K, heightAt }) {
  const group = new THREE.Group();
  group.name = 'weathertop:props';
  // Amon Sûl’s ruin on the crown
  const amonSul = ruin(K, RUIN);
  // (its floor at the road’s height where the road crosses it: the road is
  // levelled along its own line, a little under the crown’s pad)
  amonSul.group.position.set(RING.at[0], heightAt(0, RING.at[1]) - 0.12, RING.at[1]);
  amonSul.group.rotation.y = RING.yaw;
  amonSul.group.scale.setScalar(RING.scale);
  group.add(amonSul.group);

  // Sam’s camp in the dell
  const camp = buildCamp(K);
  camp.group.position.set(FIRE[0], heightAt(...FIRE), FIRE[1]);
  camp.group.scale.setScalar(WILD);
  group.add(camp.group);

  // crags on the flanks (not on the road, not in the ruin), instanced, three shapes
  const rng = rngOf(14);
  const shapes = [rockGeo(3), rockGeo(8), rockGeo(21)];
  const per = shapes.map(() => []);
  for (let i = 0; i < CRAGS; i++) {
    const x = (rng() < 0.5 ? -1 : 1) * (4 + rng() * 40);
    const z = 20 + rng() * 140;
    if (Math.hypot(x - RING.at[0], z - RING.at[1]) < RUIN.r * RING.scale + 2) continue;
    per[i % 3].push({ x, z, s: 0.6 + rng() * 1.6, yaw: rng() * 6.28, tilt: (rng() - 0.5) * 0.4 });
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  shapes.forEach((geo, k) => {
    const list = per[k];
    const mesh = new THREE.InstancedMesh(geo, K.mats.rock, list.length);
    list.forEach((r, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(r.x, heightAt(r.x, r.z) - 0.25 * r.s, r.z), q.setFromEuler(e.set(r.tilt, r.yaw, 0)), new THREE.Vector3(r.s, r.s * 0.8, r.s))));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  // the Lone-lands’ boulders, wider than the flanks’ crags and smaller, half sunk in the heath
  const strewn = shapes.map(() => []);
  for (let i = 0; i < BOULDERS; i++) {
    const x = (rng() < 0.5 ? -1 : 1) * (3.5 + rng() * 70);
    const z = rng() * 165;
    if (Math.hypot(x - RING.at[0], z - RING.at[1]) < RUIN.r * RING.scale + 4) continue;
    strewn[i % 3].push({ x, z, s: 0.25 + rng() * 0.7, yaw: rng() * 6.28, tilt: (rng() - 0.5) * 0.6 });
  }
  // the standing stones (tall, thin, leaning) and the cairn’s heap
  const stones = shapes.map(() => []);
  for (const [x, z, h, lean] of STANDING) stones[Math.round(h * 10) % 3].push({ x, z, sx: 0.35, sy: h / 1.6, sz: 0.3, yaw: x, tilt: lean });
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = i < 6 ? 0.55 : 0.2;
    stones[i % 3].push({ x: CAIRN[0] + Math.cos(a) * r, z: CAIRN[1] + Math.sin(a) * r, sx: 0.3, sy: 0.22, sz: 0.3, yaw: a, tilt: 0, lift: i < 6 ? 0 : 0.32 });
  }
  shapes.forEach((geo, k) => {
    const list = [...strewn[k].map((r) => ({ ...r, sx: r.s, sy: r.s * 0.7, sz: r.s })), ...stones[k]];
    const mesh = new THREE.InstancedMesh(geo, K.mats.rock, list.length);
    list.forEach((r, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(r.x, heightAt(r.x, r.z) - 0.2 * r.sy + (r.lift ?? 0), r.z), q.setFromEuler(e.set(r.tilt, r.yaw, 0)), new THREE.Vector3(r.sx, r.sy, r.sz))));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
  // dead trees on the flanks, weeds about the ruin and the road
  for (const [x, z, seed] of DEAD) {
    const t = deadTree(K, seed);
    t.group.position.set(x, heightAt(x, z), z);
    t.group.scale.setScalar(WILD * 1.2);
    group.add(t.group);
  }
  for (let i = 0; i < 18; i++) {
    const a = rng() * 6.28;
    const r = RUIN.r * RING.scale * (0.4 + rng() * 0.9);
    const x = RING.at[0] + Math.cos(a) * r;
    const z = RING.at[1] + Math.sin(a) * r;
    if (Math.abs(x) < 1.4) continue;
    const w = weed(K, 10 + i);
    w.group.position.set(x, heightAt(x, z), z);
    w.group.scale.setScalar(WILD);
    group.add(w.group);
  }
  // weeds along the road’s verges, through the Lone-lands
  for (let i = 0; i < 34; i++) {
    const x = (i % 2 ? -1 : 1) * (2.2 + rng() * 6);
    const z = 4 + (i / 34) * 156 + rng() * 3;
    if (Math.hypot(x - RING.at[0], z - RING.at[1]) < RUIN.r * RING.scale) continue;
    const w = weed(K, 40 + i);
    w.group.position.set(x, heightAt(x, z), z);
    w.group.rotation.y = rng() * 6.28;
    w.group.scale.setScalar(WILD * (0.8 + rng() * 0.5));
    group.add(w.group);
  }
  // the athelas where Frodo falls
  const athelas = buildAthelas(K);
  athelas.group.position.set(KINGSFOIL[0], heightAt(...KINGSFOIL), KINGSFOIL[1]);
  athelas.group.scale.setScalar(WILD * 1.4);
  group.add(athelas.group);
  // (the ruin, the dead trees and the weeds are a dozen meshes each: one a material, the camp’s fire and the athelas’s glow kept)
  mergeStatics(group, { keep: [camp.group, athelas.group] });

  return {
    group,
    camp,
    athelas,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => {
        o.geometry?.dispose();
        if (o.isSprite) o.material.dispose();
      });
    },
  };
}
