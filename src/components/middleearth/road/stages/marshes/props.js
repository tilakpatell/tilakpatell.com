// The Dead Marshes’ landmarks, built with the Marshes chapter’s own
// builders (towns/marshes/props.js’s cliff, face, blackGate…) on the Road’s
// Marshes kit: the last cliff of the Emyn Muil on the left of the road, its
// spires round it and Sam’s rope down its face; the marsh’s tussocks, reeds
// and drowned snags, three still pools with the candles over them and the
// dead faces under; the ash-grey boulders of Dagorlad; and the Morannon off
// to the left at the stage’s end, its gate in its wall between the Towers of
// the Teeth, with the road up to it for the Easterlings’ column. In the
// stage’s frame: the road along +z from 0, +x on the walker’s left.
//
//   buildProps({ K, heightAt, tier }) → { group, rope, pools, wisps, faces, gate, column, dispose }
//   CLIFF, POOLS, GATE, COLUMN: where they stand, for the beats and the scene

import * as THREE from 'three';
import { ashRockGeo, blackGate, cliff as buildCliff, columnGeo, deadTreeGeo, face as buildFace, reedsGeo, rope as buildRope, spikeGeo, tussockGeo, wisp as buildWisp } from '../../../towns/marshes/props';
import { mergeStatics } from '../parts';

export const CLIFF = { x: 7.5, z: 22, w: 46, h: 22 }; // its face to the road (−x), the smooth middle at z
export const POOLS = [
  { at: [-16, 70], r: 14 },
  { at: [14, 84], r: 12 },
  { at: [-12, 98], r: 11 },
]; // (the ground’s hollows: stages/index.js’s islands)
export const GATE = { at: [118, 176], scale: 0.62 }; // the Morannon, its face to the road (−x)
export const COLUMN = { from: [26, 92], to: [96, 168], rows: 22, files: 4 }; // the Easterlings’ road to the Gate
const SCALE = 0.8; // the chapter’s at the Road’s

const rand = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// one instanced draw of a geometry at [x, z, scale, turn] on the ground
function scatter(geo, material, list, heightAt, sink = 0) {
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  list.forEach(([x, z, s, turn], i) => {
    q.setFromAxisAngle(up, turn);
    m.compose(new THREE.Vector3(x, heightAt(x, z) - sink * s, z), q, new THREE.Vector3(s, s, s));
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

export function buildProps({ K, heightAt, tier = 'high' }) {
  const group = new THREE.Group();
  group.name = 'marshes:props';
  const low = tier === 'low';
  const { mats } = K;

  // the cliff on the left, its face to the road
  const cliff = buildCliff(K, { w: CLIFF.w / SCALE, h: CLIFF.h / SCALE });
  cliff.group.scale.setScalar(SCALE);
  cliff.group.position.set(CLIFF.x, heightAt(CLIFF.x, CLIFF.z) - 0.4, CLIFF.z);
  cliff.group.rotation.y = -Math.PI / 2;
  group.add(cliff.group);
  // Sam’s rope from the top to the foot (the scene moves its end)
  const rope = buildRope(K);
  group.add(rope.group);
  const foot = heightAt(CLIFF.x, CLIFF.z);
  const ropeTop = new THREE.Vector3(CLIFF.x - 0.3, foot + CLIFF.h, CLIFF.z - 1.2);
  rope.set([ropeTop, new THREE.Vector3(CLIFF.x - 0.6, foot + 0.2, CLIFF.z - 1)]);

  // the Emyn Muil’s spires round the cliff and on the right of the road
  const spires = [];
  for (let i = 0; i < (low ? 9 : 16); i++) {
    const side = i % 3 === 0 ? -1 : 1;
    const x = side < 0 ? -10 - rand(i) * 26 : 12 + rand(i + 40) * 30;
    const z = -10 + rand(i + 80) * 60;
    spires.push([x, z, (0.5 + rand(i + 9) * 0.7) * SCALE, rand(i + 3) * 6.28]);
  }
  group.add(scatter(spikeGeo(3), mats.rock, spires, heightAt, 0.1));

  // the marsh: tussocks and reeds (vertex-coloured, one draw each), the drowned snags
  const tussocks = [];
  const reeds = [];
  const snags = [];
  const n = low ? 60 : 140;
  for (let i = 0; i < n; i++) {
    const z = 52 + rand(i + 200) * 66;
    const side = rand(i + 300) < 0.5 ? -1 : 1;
    const x = side * (3.5 + rand(i + 400) * 34);
    const s = (0.7 + rand(i + 500) * 0.6) * SCALE;
    (i % 3 === 0 ? reeds : tussocks).push([x, z, s, rand(i + 600) * 6.28]);
    if (i % 9 === 0) snags.push([x * 1.1, z + 3, s * 1.4, rand(i + 700) * 6.28]);
  }
  group.add(scatter(tussockGeo(2), mats.reeds, tussocks, heightAt, 0.05));
  group.add(scatter(reedsGeo(3), mats.reeds, reeds, heightAt, 0.05));
  group.add(scatter(deadTreeGeo(4), mats.wood, snags, heightAt, 0.15));

  // the pools: their levels (the scene makes their water), a candle and the faces under each
  // (each pool’s water just under the lowest of its rim, so its sheet’s square edges are under the ground)
  const pools = POOLS.map((p) => {
    let rim = Infinity;
    for (let a = 0; a < 6.28; a += 0.4) rim = Math.min(rim, heightAt(p.at[0] + Math.cos(a) * p.r * 0.75, p.at[1] + Math.sin(a) * p.r * 0.75));
    return { ...p, level: Math.max(heightAt(...p.at) + 0.4, rim - 0.25) };
  });
  const wisps = [];
  const faces = [];
  pools.forEach((p, i) => {
    for (let j = 0; j < (low ? 1 : 3); j++) {
      const a = j * 2.1 + i;
      const w = buildWisp(K);
      w.group.position.set(p.at[0] + Math.cos(a) * p.r * 0.35, p.level + 0.25, p.at[1] + Math.sin(a) * p.r * 0.35);
      w.group.scale.setScalar(SCALE);
      group.add(w.group);
      wisps.push(w);
    }
    for (let j = 0; j < (low ? 2 : 5); j++) {
      const a = j * 1.3 + i * 0.7;
      const f = buildFace(K, i * 5 + j + 1);
      f.group.position.set(p.at[0] + Math.cos(a) * p.r * 0.3, p.level - 0.5, p.at[1] + Math.sin(a) * p.r * 0.3);
      f.group.scale.setScalar(3.4);
      group.add(f.group);
      faces.push(f);
    }
  });

  // Dagorlad’s ash-grey boulders, up towards the Gate
  const rocks = [];
  for (let i = 0; i < (low ? 14 : 30); i++) {
    const x = 6 + rand(i + 800) * 90;
    const z = 108 + rand(i + 900) * 60;
    if (Math.abs(x - 20) < 6 && z < 160) continue;
    rocks.push([x, z, 0.8 + rand(i + 1000) * 1.6, rand(i + 1100) * 6.28]);
  }
  group.add(scatter(ashRockGeo(4), mats.rock, rocks, heightAt, 0.3));

  // the Morannon, its face to the road
  const gate = blackGate(K);
  gate.group.position.set(GATE.at[0], heightAt(...GATE.at) - 2, GATE.at[1]);
  gate.group.rotation.y = -Math.PI / 2;
  gate.group.scale.setScalar(GATE.scale);
  group.add(gate.group);

  // the Easterlings’ column on its road to the Gate (one instanced draw; the scene marches it)
  const count = COLUMN.rows * COLUMN.files * (low ? 0.5 : 1);
  const column = new THREE.InstancedMesh(columnGeo(), mats.easterling, count);
  column.name = 'marshes:column';
  column.frustumCulled = false;
  // (it marches: not solid where it first stood)
  column.userData.moves = true;
  group.add(column);

  // (the stills one a material: the rope, the candles, the faces, the gate’s leaves and the column as they are)
  mergeStatics(group, { keep: [rope.group, column, ...wisps.map((w) => w.group), ...faces.map((f) => f.group), ...gate.leaves, gate.group.getObjectByName('mordorGlow')].filter(Boolean) });

  return {
    group,
    rope,
    ropeTop,
    pools,
    wisps,
    faces,
    gate,
    column,
    dispose() {
      group.removeFromParent();
      group.traverse((o) => {
        o.geometry?.dispose();
        if (o.isMesh && !Object.values(mats).includes(o.material)) [o.material].flat().forEach((m) => m?.dispose?.());
      });
    },
  };
}
