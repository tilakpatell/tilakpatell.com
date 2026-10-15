// One of the site's own cast as a body on Star Wars Battlefront II (2017)'s
// skeleton. Rick, Morty, Walt and Jesse are Meshy figures on 24 joints; every
// person in the Battlefront world stands on Walrus_HumanMale's 254 nodes
// (public/models/galaxy/bf2017/walrus.glb) and is moved by the game's clips,
// which bind by those names. This makes a guest a body of that kind, the
// game's own way for a figure that is not its 1.77 m man (the Ewok: the same
// names, its own lengths): the skeleton fitted to the guest's joints
// (lib/guest-skeleton.mjs), the guest's mesh posed at that skeleton's rest
// through its own Meshy skin and its weights moved to the game's bones
// (lib/guest-skin.mjs). The rig is whole and unrenamed (the owner's ruling,
// 2026-10-10); two nodes are added under Head, head_end and headfront, which
// the Wardrobe's gear takes its frame from. No clip comes along: Meshy's is
// left behind, and the game's are sized to the body by guest-clips.mjs.
//
// It calls no service and the same file in gives the same bytes out. The
// picture is the source's own, not encoded again.
//
//   node scripts/guest-rig.mjs <who> [--body <id>] [--out public/models/guests]
//
//   who     a row of scripts/guests.json (rick, morty…)
//   body    one of the row's bodies, a Wardrobe body id (every one of them
//           when left out); the file is <out>/<id>.glb
//
// It prints the guest's measures beside the game's man's and what it wrote.
//
//   guestRow(who) → the row; sourceOf(who, body) → the body's Meshy file
//   rigGuest(who, { body, out, log }) → { file, bytes, body, measured, fitted, legs }
//     (the first body of the row when none is named)

import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { readFileSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { checkWalrus, isWalrus } from '../src/lib/three/walrusRig.js';
import { parseArgs } from './lib/args.mjs';
import { glbJson } from './lib/bf2017-paths.mjs';
import { io, readGuest } from './lib/guest-file.mjs';
import { JOINT_MAP, fitSkeleton, legRatio, measure, rowsOf, worldsOf } from './lib/guest-skeleton.mjs';
import { bakeBind, bindPose, moveWeights, restPose } from './lib/guest-skin.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const WALRUS = join(ROOT, 'public', 'models', 'galaxy', 'bf2017', 'walrus.glb');
export const OUT = join(ROOT, 'public', 'models', 'guests');
const GUESTS = JSON.parse(readFileSync(join(ROOT, 'scripts', 'guests.json'), 'utf8'));

export function guestRow(who) {
  const row = GUESTS.rows.find((r) => r.who === who);
  if (!row) throw new Error(`${who}: no such guest (${GUESTS.rows.map((r) => r.who).join(', ')})`);
  return row;
}

export function sourceOf(who, body) {
  const file = guestRow(who).bodies[body];
  if (!file) throw new Error(`${body}: not one of ${who}’s bodies (${Object.keys(guestRow(who).bodies).join(', ')})`);
  return file;
}

export const walrusRows = (file = WALRUS) => rowsOf(glbJson(readFileSync(file)));

export async function rigGuest(who, { body = Object.keys(guestRow(who).bodies)[0], out = OUT, walrus = WALRUS, log = console.log } = {}) {
  const source = resolve(ROOT, sourceOf(who, body));
  const game = walrusRows(walrus);
  const guest = await readGuest(source);
  const { doc, node, surface } = guest;
  const measured = measure(guest.rows, surface);
  const fitted = fitSkeleton(game, measured);
  const names = fitted.map((r) => r.name);
  const check = checkWalrus(names);
  if (!check.ok || !isWalrus(names)) throw new Error(`${body}: the fitted skeleton is not the game’s (it lacks ${check.missing.join(', ')})`);
  const map = JOINT_MAP(guest.rows);
  const posed = bakeBind(surface.positions, surface.normals, surface.skinIndex, surface.skinWeight, bindPose(guest.rows), restPose(guest.rows, fitted, map, measured.palms), surface.joints);
  const weights = moveWeights(surface.skinIndex, surface.skinWeight, map, (n) => names.indexOf(n), guest.joints);

  // the fitted skeleton as the file's nodes, Reference at the scene's root
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const old = { nodes: root.listNodes().filter((n) => n !== node), skins: root.listSkins(), animations: root.listAnimations() };
  const made = new Map();
  for (const r of fitted) {
    const n = doc.createNode(r.name).setTranslation(r.translation).setRotation(r.rotation);
    made.set(r.name, n);
    if (r.parent == null) scene.addChild(n);
    else made.get(r.parent).addChild(n);
  }
  // every node a joint, as the game's own bodies have them, each bound where it rests
  const buffer = root.listBuffers()[0];
  const worlds = worldsOf(fitted);
  const inverse = new Float32Array(fitted.length * 16);
  fitted.forEach((r, i) => inverse.set(worlds.get(r.name).clone().invert().elements, i * 16));
  const skin = doc.createSkin(body).setSkeleton(made.get(fitted[0].name)).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(inverse).setBuffer(buffer));
  for (const r of fitted) skin.addJoint(made.get(r.name));

  const Index = fitted.length <= 256 ? Uint8Array : Uint16Array;
  const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  let tris = 0;
  for (const { prim, first, count } of guest.prims) {
    prim.setAttribute('POSITION', accessor('VEC3', posed.positions.slice(first * 3, (first + count) * 3)));
    if (prim.getAttribute('NORMAL')) prim.setAttribute('NORMAL', accessor('VEC3', posed.normals.slice(first * 3, (first + count) * 3)));
    prim.setAttribute('JOINTS_0', accessor('VEC4', Index.from(weights.skinIndex.subarray(first * 4, (first + count) * 4))));
    prim.setAttribute('WEIGHTS_0', accessor('VEC4', weights.skinWeight.slice(first * 4, (first + count) * 4)));
    tris += (prim.getIndices()?.getCount() ?? count) / 3;
  }
  // the mesh at the scene's root under the body's id, on the new skin; Meshy's joints and its clip go
  scene.addChild(node);
  node.setName(body).setSkin(skin).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
  node.getMesh().setName(body);
  for (const a of old.animations) a.dispose();
  for (const s of old.skins) s.dispose();
  for (const n of old.nodes) n.dispose();
  scene.setName(body);
  const legs = legRatio(game, fitted);
  // (what the body is, for whoever loads it: three hands a scene's extras on as its userData)
  scene.setExtras({ guest: { who, body, height: +measured.height.toFixed(4), hips: +worlds.get('Hips').elements[13].toFixed(4), legs: +legs.toFixed(4) } });

  await doc.transform(prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const file = join(out, `${body}.glb`);
  await mkdir(dirname(file), { recursive: true });
  await (await io()).write(file, doc);
  const bytes = (await stat(file)).size;

  const gw = worldsOf(game);
  const span = (w, a, b) => new THREE.Vector3().setFromMatrixPosition(w.get(b)).distanceTo(new THREE.Vector3().setFromMatrixPosition(w.get(a)));
  const s = measured.segments;
  log(`${body}: ${measured.height.toFixed(3)} m tall, hips ${measured.hipsHeight.toFixed(3)} (the game's man 1.802, 0.936)`);
  log(`  thigh ${s.thigh.toFixed(3)} shin ${s.shin.toFixed(3)} foot ${s.foot.toFixed(3)} (the game's ${span(gw, 'LeftUpLeg', 'LeftLeg').toFixed(3)}, ${span(gw, 'LeftLeg', 'LeftFoot').toFixed(3)}, ${span(gw, 'LeftFoot', 'LeftToeBase').toFixed(3)})`);
  log(`  upper arm ${s.upperArm.toFixed(3)} forearm ${s.forearm.toFixed(3)} hand ${s.hand.toFixed(3)} (the game's ${span(gw, 'LeftArm', 'LeftForeArm').toFixed(3)}, ${span(gw, 'LeftForeArm', 'LeftHand').toFixed(3)}, ${span(gw, 'LeftHand', 'LeftHandMiddle4').toFixed(3)})`);
  log(`  legs ${legs.toFixed(4)} of the game's; fitted hips at ${worlds.get('Hips').elements[13].toFixed(3)}`);
  log(`${relative(ROOT, file)}: ${Math.round(tris)} triangles on ${fitted.length} joints, ${(bytes / 1024).toFixed(1)} KB`);
  return { file, bytes, body, measured, fitted, legs };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  const [who] = args._;
  if (!who) {
    console.error(`usage: node scripts/guest-rig.mjs <who> [--body <id>] [--out public/models/guests] (guests: ${GUESTS.rows.map((r) => r.who).join(', ')})`);
    process.exit(1);
  }
  try {
    const bodies = typeof args.body === 'string' ? [args.body] : Object.keys(guestRow(who).bodies);
    for (const body of bodies) await rigGuest(who, { body, out: resolve(args.out ?? OUT) });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
