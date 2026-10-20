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

// the ruin: its middle off the road’s line, so the plinth stands beside the
// walkers, and turned (yaw) so its arch at −0.875 rad is where the road comes in
export const RING = { at: [2.2, 122], scale: 1.3, yaw: 0.87 };
export const FIRE = [2.4, 68.5]; // Sam’s fire in the dell, beside the road
export const KINGSFOIL = [1.3, 147.2]; // the athelas, where Frodo lies
const WILD = 0.68; // the Road’s hobbit (1.05 m) over the chapter’s (1.55): the camp and the plants
const CRAGS = 46; // rocks on the hill’s flanks
const DEAD = [[-14, 84, 1], [18, 98, 2], [-22, 140, 3], [12, 40, 4]]; // x, z, seed

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
  // the athelas where Frodo falls
  const athelas = buildAthelas(K);
  athelas.group.position.set(KINGSFOIL[0], heightAt(...KINGSFOIL), KINGSFOIL[1]);
  athelas.group.scale.setScalar(WILD * 1.4);
  group.add(athelas.group);

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
