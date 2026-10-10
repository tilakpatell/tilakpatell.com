// A figure on the 2017 game's rig, for tests: the committed skeleton
// (walrus.glb) with Luke's committed clip pack (clips-luke.glb), in a holder
// in a scene, as activity.js and scene.js keep one. Off disk, in Node.
//
//   walrusFigure() → { fig: { model, bones, sockets, rig: 'walrus', clips, tall }, scene, holder }

import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { socketsOf } from '../../../lib/three/walrus';

const parse = async (file) => {
  await MeshoptDecoder.ready;
  const buf = readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return new Promise((r, j) => loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', r, j));
};

let pack = null;
export async function walrusFigure() {
  pack ??= parse('public/models/galaxy/bf2017/clips-luke.glb').then((g) => Object.fromEntries(g.animations.map((c) => [c.name, c])));
  const clips = await pack;
  const g = await parse('public/models/galaxy/bf2017/walrus.glb');
  const bones = {};
  g.scene.traverse((o) => o.name && !(o.name in bones) && (bones[o.name] = o));
  // (the committed skeleton carries no skin, so its joints load as plain nodes; a crew figure's are bones)
  g.scene.traverse((o) => o !== g.scene && !o.isMesh && (o.isBone = true));
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  scene.add(holder);
  holder.add(g.scene);
  scene.updateMatrixWorld(true);
  return { fig: { model: g.scene, bones, sockets: socketsOf(g.scene), rig: 'walrus', clips, tall: 1.8 }, scene, holder };
}
