// A guest's file, read as this repository reads skinned glTF
// (glTF-Transform with the meshopt codec, as scripts/rig-transfer.mjs does):
// a Meshy figure is glTF-Transform's own output, its positions quantised and
// its buffers meshopt-packed, with the quantisation folded into the skin's
// inverse bind matrices. So a vertex is where its joints' world × inverse
// bind puts it, which at the bind is one matrix for every joint; that is
// checked, and the mesh is handed over in the scene's own metres.
//
//   io() → a NodeIO that reads and writes the site's models
//   readGuest(file) → { doc, node, rows, joints, surface, prims }
//     rows: the file's nodes (guest-skeleton.mjs's rowsOf)
//     joints: [{ name, parent }] in the skin's order
//     surface: { positions, normals, skinIndex, skinWeight, joints: [name…] },
//       every primitive's vertices one after another, at the bind, in metres
//     prims: [{ prim, first, count }]: where each primitive's vertices are in it

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { glbJson } from './bf2017-paths.mjs';
import { rowsOf } from './guest-skeleton.mjs';

export async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// how far apart the joints' matrices may put a point a metre out and still be one bind
const BIND = 1e-4;

export async function readGuest(file) {
  const buf = await readFile(file);
  const doc = await (await io()).readBinary(new Uint8Array(buf));
  await doc.transform(dequantize());
  const skinned = doc.getRoot().listNodes().filter((n) => n.getSkin() && n.getMesh());
  if (skinned.length !== 1) throw new Error(`${file}: ${skinned.length} skinned meshes; a guest is one`);
  const [node] = skinned;
  const skin = node.getSkin();
  const bones = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const mats = bones.map((j, i) => new THREE.Matrix4().fromArray(j.getWorldMatrix()).multiply(new THREE.Matrix4().fromArray(ibm.getElement(i, []))));
  const probe = new THREE.Vector3(1, 1, 1).applyMatrix4(mats[0]);
  const spread = Math.max(...mats.map((m) => new THREE.Vector3(1, 1, 1).applyMatrix4(m).distanceTo(probe)));
  if (spread > BIND) throw new Error(`${file}: its nodes do not stand at the skin’s bind (${spread.toExponential(1)} m apart)`);

  const prims = [];
  let total = 0;
  for (const prim of node.getMesh().listPrimitives()) {
    const count = prim.getAttribute('POSITION').getCount();
    prims.push({ prim, first: total, count });
    total += count;
  }
  const surface = { positions: new Float32Array(total * 3), normals: new Float32Array(total * 3), skinIndex: new Uint16Array(total * 4), skinWeight: new Float32Array(total * 4), joints: bones.map((j) => j.getName()) };
  const p = new THREE.Vector3();
  const el = [];
  for (const { prim, first, count } of prims) {
    const P = prim.getAttribute('POSITION');
    const N = prim.getAttribute('NORMAL');
    const J = prim.getAttribute('JOINTS_0');
    const W = prim.getAttribute('WEIGHTS_0');
    if (!J || !W) throw new Error(`${file}: a primitive with no skin`);
    for (let v = 0; v < count; v++) {
      p.fromArray(P.getElement(v, el)).applyMatrix4(mats[0]).toArray(surface.positions, (first + v) * 3);
      if (N) p.fromArray(N.getElement(v, el)).transformDirection(mats[0]).toArray(surface.normals, (first + v) * 3);
      surface.skinIndex.set(J.getElement(v, el), (first + v) * 4);
      const w = W.getElement(v, el);
      const sum = w[0] + w[1] + w[2] + w[3] || 1;
      surface.skinWeight.set(w.map((x) => x / sum), (first + v) * 4);
    }
  }
  const names = new Set(surface.joints);
  const parentOf = (j) => {
    const up = j.getParentNode();
    return up && names.has(up.getName()) ? up.getName() : null;
  };
  return { doc, node, rows: rowsOf(glbJson(buf)), joints: bones.map((j) => ({ name: j.getName(), parent: parentOf(j) })), surface, prims };
}
