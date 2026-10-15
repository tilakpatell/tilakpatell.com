// The 2017 game's humanoid skeleton, Walrus_HumanMale, in one file
// (public/models/galaxy/bf2017/walrus.glb): every node from `Reference`
// down, at rest, as a rigged import of any 2017 person has it (bf2017-
// import.mjs --rig), and nothing else: no mesh, material, texture or skin.
// It is the contract the clip packs are written on (scripts/bf2017-clips.mjs
// puts these nodes in each pack, so a pack opens as the skeleton it moves)
// and what the site checks a body against (src/lib/three/walrusRig.js).
// The rig is whole: no bone is dropped or renamed (the owner's ruling,
// 2026-10-10), so a body's extra bones (a cape's physics) are the only ones
// a clip never names.
//
//   node scripts/bf2017-skeleton.mjs <rigged.glb> [--out public/models/galaxy/bf2017/walrus.glb]

import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkWalrus } from '../src/lib/three/walrusRig.js';
import { parseArgs } from './lib/args.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SKELETON = 'Walrus_HumanMale';

export async function io() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  return new NodeIO().setLogger(new Logger(Logger.Verbosity.ERROR)).registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
}

// a rigged document down to its skeleton: Reference and everything under it,
// Reference at the scene's root (out from under the import's `ground`, whose
// scale and offset are the body's, not the rig's), in the game's metres
export function skeletonOf(doc) {
  const root = doc.getRoot();
  const ref = root.listNodes().find((n) => n.getName() === 'Reference');
  if (!ref) throw new Error('no Reference node: is it a 2017 rig, imported with --rig?');
  const keep = new Set();
  // (the import's `grip`, under Wep_Root, is the site's, not the game's)
  const walk = (n) => {
    if (n.getName() === 'grip') return;
    keep.add(n);
    n.listChildren().forEach(walk);
  };
  walk(ref);
  const scene = root.listScenes()[0];
  scene.addChild(ref);
  ref.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  for (const n of root.listNodes()) {
    n.setMesh(null).setSkin(null);
    if (!keep.has(n)) n.dispose();
  }
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  for (const x of [...root.listSkins(), ...root.listMeshes(), ...root.listMaterials(), ...root.listTextures(), ...root.listAnimations()]) x.dispose();
  scene.setName(SKELETON);
  root.setDefaultScene(scene);
  return keep.size;
}

async function writeSkeleton(from, out) {
  const rw = await io();
  const doc = await rw.read(from);
  const joints = skeletonOf(doc);
  await doc.transform(prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  await mkdir(dirname(out), { recursive: true });
  await rw.write(out, doc);
  return { joints, bytes: (await stat(out)).size, check: checkWalrus(doc.getRoot().listNodes().map((n) => n.getName())) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [from] = args._;
  if (!from) {
    console.error('usage: node scripts/bf2017-skeleton.mjs <rigged.glb> [--out public/models/galaxy/bf2017/walrus.glb]');
    process.exit(1);
  }
  const out = resolve(args.out ?? join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'walrus.glb'));
  const r = await writeSkeleton(resolve(from), out);
  console.log(`${relative(ROOT, out)}: ${r.joints} joints, ${r.bytes} bytes; ${r.check.ok ? 'the body and sockets all there' : `missing ${r.check.missing.join(', ')}`}`);
  if (!r.check.ok) process.exit(1);
}
