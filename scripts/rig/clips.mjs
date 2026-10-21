// A skinned figure's own idle, walk and run, beside it as Meshy's figures
// have theirs (NAME-idle.glb, NAME-walk.glb, NAME-run.glb: what
// src/components/middleearth/road/cast.js loads a figure with), made from
// the site's clip library the way clipLibrary.js's forFigure makes a copy
// for a figure: each bone's turn as the clip has it, the hips' height
// scaled from the clip's rig to this one's; nothing else (another bone's
// offset would stretch the figure to the clip's proportions). Each file is
// the figure's skeleton and the one clip, nothing to draw.
//
// Which clips: the Universal Animation Library's (Quaternius, CC0), baked
// onto Luke's skeleton, which skin.mjs's skeleton is fitted from. On a
// big-headed figure they keep the feet down where Meshy's own walk, made
// on Rick's rig, lets a planted toe slide (rig-check.mjs: 0.11 m/s against
// 0.35 on the first figure, the bar 0.15).
//
//   node scripts/rig/clips.mjs FIGURE.glb [--idle idle.calm --walk walk.formal --run sprint]
//   ownClips(figure, { idle, walk, run }) → { files: { idle, walk, run }, hipsY }
//     hipsY: the hips' height to hand forFigure for the library's other
//     clips (hipsFor), which cast.json gives a world
//   ground(figure, doc, mode) → the hips moved so the soles meet the floor
//   hipsFor(figure, idleDoc) → that hips' height

import { Document } from '@gltf-transform/core';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LOCO = { idle: 'idle.calm', walk: 'walk.formal', run: 'sprint' };

// the library's file for a clip, by its name there (clipLibrary.js's CLIPS, read as text: it imports three)
export function fileOf(name) {
  const src = readFileSync(join(ROOT, 'src', 'lib', 'three', 'clipLibrary.js'), 'utf8');
  const esc = name.replace(/[.]/g, '\\.');
  const m = src.match(new RegExp(`^\\s*(?:'${esc}'|${esc}): \\{ url: \`\\$\\{(BASE|TROOPS)\\}/([^\`]+)\``, 'm'));
  if (!m) throw new Error(`no clip ${name} in the library`);
  return join(ROOT, 'public', m[1] === 'BASE' ? 'games/meshy' : 'models/galaxy/troops', m[2]);
}

// The skeleton of `figure` (a Document) and `clip`'s one animation (a
// Document of the library's) on it, as a new Document: rotations as they
// are, the hips' translation scaled by the hips' heights.
export function onFigure(figure, clip, name) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const fRoot = figure.getRoot();
  const armature = fRoot.listNodes().find((n) => n.getName() === 'Armature');
  const fHips = fRoot.listNodes().find((n) => n.getName() === 'Hips');
  const cHips = clip.getRoot().listNodes().find((n) => n.getName() === 'Hips');
  if (!armature || !fHips || !cHips) throw new Error('both need an Armature and Hips');
  const k = fHips.getTranslation()[1] / cHips.getTranslation()[1];
  // the skeleton, copied: the armature and every bone under it, no mesh
  const nodes = new Map();
  const copy = (n) => {
    const c = doc.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale());
    nodes.set(n.getName(), c);
    for (const ch of n.listChildren()) if (!ch.getMesh()) c.addChild(copy(ch));
    return c;
  };
  doc.createScene().addChild(copy(armature));
  const [anim] = clip.getRoot().listAnimations();
  if (!anim) throw new Error('the clip file has no animation');
  const out = doc.createAnimation(name);
  for (const ch of anim.listChannels()) {
    const target = ch.getTargetNode()?.getName();
    const path = ch.getTargetPath();
    const node = nodes.get(target);
    if (!node || !(path === 'rotation' || (path === 'translation' && target === 'Hips'))) continue;
    const s = ch.getSampler();
    const input = doc.createAccessor().setType('SCALAR').setArray(new Float32Array(s.getInput().getArray())).setBuffer(buf);
    const from = s.getOutput();
    const values = new Float32Array(from.getCount() * from.getElementSize());
    const e = [];
    for (let i = 0; i < from.getCount(); i++) values.set(from.getElement(i, e), i * from.getElementSize());
    if (path === 'translation') for (let i = 0; i < values.length; i++) values[i] *= k;
    const output = doc.createAccessor().setType(path === 'rotation' ? 'VEC4' : 'VEC3').setArray(values).setBuffer(buf);
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(s.getInterpolation());
    out.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
  }
  return { doc, k };
}

// ── the feet on the floor ──
//
// A clip turns each bone as it turned Luke's, and the hips are scaled by
// the hips' heights; but a big-headed figure's legs aren't Luke's legs in
// small (short thighs, big shoes), so the turns that put Luke's soles on the
// floor leave this figure's a few centimetres in it or over it. So each
// frame is measured: the soles (the vertices under the feet, skinned as
// three.js skins them) posed by the clip, and the hips
// raised or lowered by what puts the lowest of them where it is at rest.
// `each` frame for the idle and the walk (one foot is always down);
// `lowest` for the run, the whole clip by one amount (its flight kept).

// the skeleton of a Document (gltf-transform's) as three.js objects, by name
function skeletonOf(doc) {
  const byName = {};
  const make = (n) => {
    const o = new THREE.Object3D();
    o.name = n.getName();
    o.position.fromArray(n.getTranslation());
    o.quaternion.fromArray(n.getRotation());
    o.scale.fromArray(n.getScale());
    byName[o.name] = o;
    for (const c of n.listChildren()) if (!c.getMesh()) o.add(make(c));
    return o;
  };
  const arm = doc.getRoot().listNodes().find((n) => n.getName() === 'Armature');
  const root = new THREE.Group();
  root.add(make(arm));
  root.updateMatrixWorld(true);
  return { root, byName };
}

// The soles: the figure's own vertices within 3 cm of the floor at rest
// (as rig-check.mjs reads them), each with its weights and the bones'
// inverse bind matrices, so a pose's soles are skinned exactly as three.js
// skins them. → (pose: the skeleton's objects by name) → the lowest (m)
function soles(figure, byName) {
  const root = figure.getRoot();
  const node = root.listNodes().find((n) => n.getSkin() && n.getMesh());
  if (!node) return null;
  const skin = node.getSkin();
  const joints = skin.listJoints().map((j) => byName[j.getName()]);
  const ibm = skin.getInverseBindMatrices();
  const inv = joints.map((_, i) => new THREE.Matrix4().fromArray(ibm.getElement(i, [])));
  const pts = [];
  const e = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const pose = (p) => {
    const out = new THREE.Vector3();
    for (let k = 0; k < 4; k++) {
      if (!p.w[k]) continue;
      m.multiplyMatrices(joints[p.j[k]].matrixWorld, inv[p.j[k]]);
      out.addScaledVector(v.copy(p.v).applyMatrix4(m), p.w[k]);
    }
    return out;
  };
  for (const prim of node.getMesh().listPrimitives()) {
    const [pos, jn, wt] = ['POSITION', 'JOINTS_0', 'WEIGHTS_0'].map((n) => prim.getAttribute(n));
    if (!pos || !jn || !wt) continue;
    for (let i = 0; i < pos.getCount(); i++) {
      const p = { v: new THREE.Vector3().fromArray(pos.getElement(i, e)), j: jn.getElement(i, []), w: wt.getElement(i, []) };
      if (pose(p).y < 0.03) pts.push(p);
    }
  }
  if (!pts.length) return null;
  return () => Math.min(...pts.map((p) => pose(p).y));
}

// The clip's hips track moved so the soles stand on the floor (in place:
// `doc` is onFigure's). → the shifts (metres), frame by frame.
export function ground(figure, doc, mode = 'each') {
  const { root, byName } = skeletonOf(figure);
  const lowest = soles(figure, byName);
  if (!lowest) return [];
  const rest = lowest();
  const [anim] = doc.getRoot().listAnimations();
  const tracks = [];
  let hipsCh = null;
  for (const ch of anim.listChannels()) {
    const name = ch.getTargetNode().getName();
    const s = ch.getSampler();
    const times = Array.from(s.getInput().getArray());
    const values = Array.from(s.getOutput().getArray());
    if (ch.getTargetPath() === 'rotation') tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
    else if (name === 'Hips') {
      tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, values));
      hipsCh = ch;
    }
  }
  if (!hipsCh) return [];
  const clip = new THREE.AnimationClip('c', -1, tracks);
  const mixer = new THREE.AnimationMixer(root);
  // (once, held at its end: a looping action at its last key would be back at its first)
  const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const s = hipsCh.getSampler();
  const times = s.getInput().getArray();
  const out = s.getOutput().getArray();
  // (the hips' parent is the armature: metres in the world are its centimetres over its scale)
  const scale = byName.Armature.scale.y;
  const shifts = Array.from(times, (t) => {
    mixer.setTime(t);
    root.updateMatrixWorld(true);
    return lowest() - rest;
  });
  const by = mode === 'lowest' ? Array(shifts.length).fill(Math.min(...shifts)) : shifts;
  const next = new Float32Array(out);
  for (let i = 0; i < by.length; i++) next[i * 3 + 1] -= by[i] / scale;
  s.getOutput().setArray(next);
  return by;
}

// The hips' height (the rig's centimetres) to hand forFigure for every other
// clip in the library, so a standing clip's soles meet the floor: the
// figure's own, lifted by what its idle, unmoved, sinks by on average.
export function hipsFor(figure, idleDoc) {
  const hips = figure.getRoot().listNodes().find((n) => n.getName() === 'Hips');
  const arm = figure.getRoot().listNodes().find((n) => n.getName() === 'Armature');
  const shifts = ground(figure, idleDoc, 'each');
  if (!shifts.length) return hips.getTranslation()[1];
  const mean = shifts.reduce((a, b) => a + b, 0) / shifts.length;
  return Math.round((hips.getTranslation()[1] - mean / arm.getScale()[1]) * 10) / 10;
}

// how each of a figure's own clips is stood on the floor
export const GROUND = { idle: 'each', walk: 'each', run: 'lowest' };

// The three files beside the figure: NAME-idle.glb, NAME-walk.glb, NAME-run.glb.
export async function ownClips(figure, pick = {}) {
  const { NodeIO } = await import('@gltf-transform/core');
  const { ALL_EXTENSIONS } = await import('@gltf-transform/extensions');
  const { meshopt, resample, prune } = await import('@gltf-transform/functions');
  const { MeshoptDecoder, MeshoptEncoder } = await import('meshoptimizer');
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
  const fig = await io.read(figure);
  const files = {};
  const chosen = { ...LOCO, ...pick };
  const hipsY = hipsFor(fig, onFigure(fig, await io.read(fileOf(chosen.idle)), 'idle').doc);
  for (const [loco, name] of Object.entries(chosen)) {
    const { doc } = onFigure(fig, await io.read(fileOf(name)), loco);
    ground(fig, doc, GROUND[loco] ?? 'each');
    // (keys a linear blend would put back thinned out, then packed as the figures are)
    await doc.transform(resample(), prune({ keepLeaves: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    files[loco] = figure.replace(/\.glb$/, `-${loco}.glb`);
    await io.write(files[loco], doc);
  }
  return { files, hipsY };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flag = (n) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const pick = Object.fromEntries(['idle', 'walk', 'run'].map((n) => [n, flag(n)]).filter(([, v]) => v));
  const [figure] = args;
  if (!figure) throw new Error('usage: node scripts/rig/clips.mjs FIGURE.glb [--idle NAME --walk NAME --run NAME]');
  const { files, hipsY } = await ownClips(resolve(figure), pick);
  for (const [loco, file] of Object.entries(files)) console.log(`${loco}: ${file}`);
  console.log(`the hips for the library's clips: ${hipsY}`);
}
