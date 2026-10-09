// Fingers for a figure on Meshy's skeleton, by its own hands' geometry:
// Meshy's rig stops at the wrist, so each hand's vertices are read (which
// are which finger, which the thumb, where each finger's joints lie), and
// finger bones are added under the hand bone, each resting in the canonical
// frame (+y along the finger, +z out of the back of the hand), the hand's
// skin split onto them; and a twist bone half way down each forearm, the
// forearm's skin handed to it from the elbow (none) to the wrist (all). The
// skeleton stays Meshy's: no bone is moved or renamed, no clip is touched,
// and every vertex rests where it did. A hand the geometry can't split into
// four fingers is a mitten (one group of two joints); one it can't read at
// all is left and listed. A file already extended is left as it is.
// (docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md, piece 2;
// docs/decisions/2026-10-08-fingers-on-the-meshy-skeleton.md)
//
//   CANON[side]: { fingers, mitten }: the new bones' names for a hand of
//     four fingers (Thumb1..2, Index/Middle/Ring/Pinky1..3) and for a
//     mitten (Thumb1..2, Fingers1..2), as Mixamo names them unprefixed
//   twistName(side) → 'LeftForeArmTwist' | 'RightForeArmTwist'
//   SCULPTED: { file: { Left|Right: why } }: hands made holding something
//     (a grip, a trigger), seen on the paint sheet; their sculpt can't curl
//     further, so they keep grip.js's morph and are left as they are
//   extendHands(doc, { handFrame, skip }) → { L, R, forearm, changed }: on a
//     gltf-transform Document; L/R { kind: 'fingers' | 'mitten', thumb } or
//     { skipped: why }; handFrame: held.js's (injected: held.js reaches
//     rig.js, which only Vite loads); skip: { Left|Right: why } (SCULPTED's
//     row for the file). Writes extras.hands on the default
//     scene. changed: false when there was nothing to add.
//
//   node scripts/hands-extend.mjs <file.glb> [<file.glb> …] [--dry] [--list]
//
// --list says what each hand was read as and why one was skipped, writing
// nothing; --dry also says the size the file would be. The file is written
// back meshopt-compressed by the method it was (filters or none), so the
// parts this doesn't touch come back as they were.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { handShape } from '../src/lib/three/grip.js';
import { canonicalFrame, chainRadius, fingerChain, fingerGroups, fingerWeights, twistWeights } from './lib/hand-geometry.mjs';
import { glbJson } from './rig-audit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const V = THREE.Vector3;
const M4 = THREE.Matrix4;
const Q = THREE.Quaternion;

const SIDES = { Left: 'L', Right: 'R' };
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const bone = (side, f, n) => `${side}Hand${f}${n}`;
export const CANON = Object.fromEntries(
  Object.keys(SIDES).map((s) => [
    s,
    {
      fingers: [bone(s, 'Thumb', 1), bone(s, 'Thumb', 2), ...FINGERS.flatMap((f) => [1, 2, 3].map((n) => bone(s, f, n)))],
      mitten: [bone(s, 'Thumb', 1), bone(s, 'Thumb', 2), bone(s, 'Fingers', 1), bone(s, 'Fingers', 2)],
    },
  ]),
);
export const twistName = (side) => `${side}ForeArmTwist`;

export const SCULPTED = {
  'public/models/galaxy/troops/stormtrooper.glb': { Right: 'sculpted round a blaster’s grip, the index out along the trigger' },
};

const MIN_SKIN = 40; // vertices mostly on a hand to read it by (held.js's)
const FIRM = 0.5; // the hand's share for a vertex to count as the hand's (grip.js's)
const UP = new V(0, 1, 0);
// a new bone's rest, rounded (a ten-thousandth of the bone's unit, a
// millionth of a turn's component): the file says it in a few digits, and
// its inverse bind matrix is made from the rounded rest, so nothing drifts
const round = (a, k) => a.map((x) => Math.round(x * k) / k + 0);

// each skinned primitive, its vertices where the skin puts them at rest
function restOf(doc, W) {
  const out = [];
  for (const node of doc.getRoot().listNodes()) {
    const skin = node.getSkin();
    const mesh = node.getMesh();
    if (!skin || !mesh) continue;
    const ibm = skin.getInverseBindMatrices();
    const el = [];
    const bind = skin.listJoints().map((j, i) => W(j).clone().multiply(new M4().fromArray(ibm ? ibm.getElement(i, el) : new M4().elements)));
    for (const prim of mesh.listPrimitives()) {
      const P = prim.getAttribute('POSITION');
      const J = prim.getAttribute('JOINTS_0');
      const Wt = prim.getAttribute('WEIGHTS_0');
      if (!P || !J || !Wt) continue;
      const n = P.getCount();
      const at = [];
      const joints = new Uint16Array(n * 4);
      const weights = new Float32Array(n * 4);
      const p = [];
      const j = [];
      const w = [];
      const v = new V();
      for (let i = 0; i < n; i++) {
        P.getElement(i, p);
        J.getElement(i, j);
        Wt.getElement(i, w);
        const s = new V();
        const sum = w[0] + w[1] + w[2] + w[3] || 1;
        for (let k = 0; k < 4; k++) {
          joints[i * 4 + k] = j[k];
          weights[i * 4 + k] = w[k] / sum;
          if (w[k]) s.addScaledVector(v.fromArray(p).applyMatrix4(bind[j[k]]), w[k] / sum);
        }
        at.push(s);
      }
      out.push({ skin, prim, at, joints, weights, touched: new Set() });
    }
  }
  return out;
}

// a new bone's inverse bind matrix in a skin: the one that skins a vertex
// at rest exactly as `from` (the bone its weight came from) did
function addJoint(skin, node, world, from, W) {
  const joints = skin.listJoints();
  const fi = joints.indexOf(from);
  let acc = skin.getInverseBindMatrices();
  if (acc.listParents().filter((p) => p.propertyType === 'Skin').length > 1) {
    acc = acc.clone();
    skin.setInverseBindMatrices(acc);
  }
  const el = [];
  const ibm = world.clone().invert().multiply(W(from)).multiply(new M4().fromArray(acc.getElement(fi, el)));
  const arr = new Float32Array(acc.getCount() * 16 + 16);
  arr.set(acc.getArray());
  arr.set(ibm.elements, acc.getCount() * 16);
  acc.setArray(arr);
  skin.addJoint(node);
  return joints.length;
}

// the skin's weights back into the file's own types, only where they changed
function writeBack(parts) {
  const done = new Set();
  for (const part of parts) {
    if (!part.touched.size) continue;
    const J = part.prim.getAttribute('JOINTS_0');
    const Wt = part.prim.getAttribute('WEIGHTS_0');
    if (done.has(J) || done.has(Wt)) throw new Error('two primitives share a skin’s attributes');
    done.add(J).add(Wt);
    let ja = J.getArray();
    if (ja instanceof Uint8Array && part.joints.some((j) => j > 255)) {
      ja = Uint16Array.from(ja);
      J.setArray(ja);
    }
    const wa = Wt.getArray();
    const max = !Wt.getNormalized() ? 0 : wa instanceof Uint8Array ? 255 : wa instanceof Uint16Array ? 65535 : 0;
    for (const i of part.touched) {
      const w = part.weights.subarray(i * 4, i * 4 + 4);
      for (let k = 0; k < 4; k++) ja[i * 4 + k] = part.joints[i * 4 + k];
      if (!max) {
        for (let k = 0; k < 4; k++) wa[i * 4 + k] = w[k];
        continue;
      }
      // whole steps summing to exactly the most, the leftover to the largest remainders
      const raw = [...w].map((x) => x * max);
      const q = raw.map(Math.floor);
      let left = max - q.reduce((a, b) => a + b, 0);
      const order = [0, 1, 2, 3].sort((a, b) => raw[b] - q[b] - (raw[a] - q[a]));
      for (const k of order) if (left > 0 && w[k] > 0) (q[k]++, left--);
      for (let k = 0; k < 4; k++) wa[i * 4 + k] = q[k];
    }
  }
}

// one hand: read it, add its bones, split its skin
function extendHand(doc, side, ctx) {
  const { byName, W, parts, forward, handFrame } = ctx;
  const hand = byName(`${side}Hand`);
  if (!hand) return { skipped: 'no hand bone' };
  const HW = W(hand);
  const inv = HW.clone().invert();
  const mine = parts.filter((p) => p.skin.listJoints().includes(hand));
  // the hand's firm vertices in its space, welded (a seam splits a vertex)
  const firm = [];
  const weld = new Map();
  const ids = mine.map((part) => {
    const hi = part.skin.listJoints().indexOf(hand);
    return part.at.map((p, i) => {
      let h = 0;
      for (let k = 0; k < 4; k++) if (part.joints[i * 4 + k] === hi) h += part.weights[i * 4 + k];
      if (h < FIRM) return -1;
      const q = p.clone().applyMatrix4(inv);
      const key = q.toArray().map((x) => x.toFixed(3)).join();
      if (!weld.has(key)) {
        weld.set(key, firm.length);
        firm.push(q);
      }
      return weld.get(key);
    });
  });
  if (firm.length < MIN_SKIN) return { skipped: `too few vertices on the hand (${firm.length})` };
  const tris = [];
  mine.forEach((part, n) => {
    const idx = part.prim.getIndices();
    if (part.prim.getMode() !== 4 || !idx) return;
    for (let t = 0; t + 2 < idx.getCount(); t += 3) {
      const a = ids[n][idx.getScalar(t)];
      const b = ids[n][idx.getScalar(t + 1)];
      const c = ids[n][idx.getScalar(t + 2)];
      if (a >= 0 && b >= 0 && c >= 0) tris.push([a, b, c]);
    }
  });
  // which way the hand is (held.js's reading of a hand's skin)
  const axes = { x: new V().setFromMatrixColumn(HW, 0).normalize(), y: new V().setFromMatrixColumn(HW, 1).normalize(), z: new V().setFromMatrixColumn(HW, 2).normalize() };
  const hips = byName('Hips');
  const inward = hips ? new V().setFromMatrixPosition(W(hips)).sub(new V().setFromMatrixPosition(HW)) : new V();
  inward.addScaledVector(forward, -inward.dot(forward)).addScaledVector(UP, -inward.dot(UP)).normalize();
  const frame = handFrame(
    firm.map((p) => p.toArray()),
    axes,
    { forward, inward, skin: true },
    side === 'Left',
  );
  const shape = handShape(firm, frame);
  const groups = fingerGroups(firm, shape, frame, { tris });
  if (groups.fingers.some((g) => g.length < 6)) return { skipped: 'a finger with too few vertices' };
  const back = frame.normal.clone().negate();
  const chains = groups.fingers.map((g, f) => {
    const pts = g.map((i) => firm[i]);
    const joints = fingerChain(pts, { joints: groups.kind === 'fingers' ? 3 : 2, toward: shape.fingers });
    return { names: joints.map((_, n) => bone(side, groups.kind === 'fingers' ? FINGERS[f] : 'Fingers', n + 1)), joints, thumb: false, radius: chainRadius(pts, joints) };
  });
  if (groups.thumb) {
    // the thumb's line runs out from the palm's middle
    const pts = groups.thumb.map((i) => firm[i]);
    const palm = firm.filter((p) => p.dot(frame.along) <= shape.s0);
    const toward = pts.reduce((s, p) => s.add(p), new V()).divideScalar(pts.length).sub(palm.reduce((s, p) => s.add(p), new V()).divideScalar(Math.max(1, palm.length)));
    const joints = fingerChain(pts, { joints: 2, toward });
    chains.unshift({ names: [bone(side, 'Thumb', 1), bone(side, 'Thumb', 2)], joints, thumb: true, radius: chainRadius(pts, joints) });
  }
  if (chains.some((c) => c.joints.some((j) => !(j.len > 0)))) return { skipped: 'a finger of no length' };
  // the bones, each in the canonical frame, chained under the hand
  for (const c of chains) {
    let parent = hand;
    let prev = null;
    c.nodes = c.joints.map((j, n) => {
      const at = new V(...j.at);
      const q = new Q(...canonicalFrame(new V(...j.axis), back));
      const t = round((prev ? at.clone().sub(prev.at).applyQuaternion(prev.q.clone().invert()) : at).toArray(), 1e4);
      // (rounded once unit: a millionth off unit is a scale of two millionths, nothing)
      const r = new Q(...round((prev ? prev.q.clone().invert().multiply(q) : q).normalize().toArray(), 1e6));
      const node = doc.createNode(c.names[n]).setTranslation(t).setRotation(r.toArray());
      parent.addChild(node);
      node.world = (prev ? prev.world : HW).clone().multiply(new M4().compose(new V(...t), r, new V(1, 1, 1)));
      prev = { at, q, world: node.world };
      parent = node;
      return node;
    });
  }
  for (const part of mine) {
    const skin = part.skin;
    const hi = skin.listJoints().indexOf(hand);
    const placed = chains.map((c) => ({ ...c, bones: c.nodes.map((node) => skin.listJoints().indexOf(node)) }));
    for (const c of placed) c.bones = c.bones.map((b, n) => (b >= 0 ? b : addJoint(skin, c.nodes[n], c.nodes[n].world, hand, W)));
    const pts = part.at.map((p) => p.clone().applyMatrix4(inv));
    const out = fingerWeights(pts, part.joints, part.weights, placed, { hand: hi, along: frame.along, s0: shape.s0 });
    part.joints = out.joints;
    part.weights = out.weights;
    for (const i of out.touched) part.touched.add(i);
  }
  // a skin that holds the hand but none of its vertices still gets the bones
  for (const skin of doc.getRoot().listSkins()) {
    if (!skin.listJoints().includes(hand)) continue;
    for (const c of chains) c.nodes.forEach((node) => skin.listJoints().includes(node) || addJoint(skin, node, node.world, hand, W));
  }
  return { kind: groups.kind, thumb: Boolean(groups.thumb) };
}

// one forearm's twist bone, half way to the wrist, its skin from the forearm's
function addTwist(doc, side, { byName, W, parts }) {
  const fore = byName(`${side}ForeArm`);
  const hand = byName(`${side}Hand`);
  if (!fore || !hand) return false;
  const half = new V(...round([...hand.getTranslation()].map((x) => x / 2), 1e4));
  const node = doc.createNode(twistName(side)).setTranslation(half.toArray());
  fore.addChild(node);
  const FW = W(fore);
  const world = FW.clone().multiply(new M4().makeTranslation(half.x, half.y, half.z));
  const elbow = new V().setFromMatrixPosition(FW);
  const wrist = new V().setFromMatrixPosition(W(hand));
  for (const skin of doc.getRoot().listSkins()) if (skin.listJoints().includes(fore)) addJoint(skin, node, world, fore, W);
  for (const part of parts) {
    const joints = part.skin.listJoints();
    const fi = joints.indexOf(fore);
    if (fi < 0) continue;
    const out = twistWeights(part.at, part.joints, part.weights, { fore: fi, twist: joints.indexOf(node), elbow, wrist });
    part.joints = out.joints;
    part.weights = out.weights;
    for (const i of out.touched) part.touched.add(i);
  }
  return true;
}

export function extendHands(doc, { handFrame, skip = {} }) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const nodes = root.listNodes();
  const named = new Map();
  for (const n of nodes) if (!named.has(n.getName())) named.set(n.getName(), n);
  const byName = (n) => named.get(n) ?? null;
  const cache = new Map();
  const W = (n) => {
    if (!cache.has(n)) cache.set(n, new M4().fromArray(n.getWorldMatrix()));
    return cache.get(n);
  };
  // which way the figure faces at rest: its head to Meshy's headfront, flat
  const head = byName('Head');
  const front = byName('headfront');
  const forward = head && front ? new V().setFromMatrixPosition(W(front)).sub(new V().setFromMatrixPosition(W(head))) : new V(0, 0, 1);
  forward.addScaledVector(UP, -forward.dot(UP));
  if (forward.lengthSq() < 1e-12) forward.set(0, 0, 1);
  forward.normalize();
  const parts = restOf(doc, W);
  const ctx = { byName, W, parts, forward, handFrame };
  const before = scene.getExtras()?.hands ?? {};
  const out = { L: null, R: null, forearm: false, changed: false };
  let added = false;
  for (const [side, key] of Object.entries(SIDES)) {
    if (byName(bone(side, 'Index', 1)) || byName(bone(side, 'Fingers', 1))) out[key] = before[key] ?? { kind: byName(bone(side, 'Index', 1)) ? 'fingers' : 'mitten', thumb: Boolean(byName(bone(side, 'Thumb', 1))) };
    else if (skip[side]) out[key] = { skipped: skip[side] };
    else {
      out[key] = extendHand(doc, side, ctx);
      if (!out[key].skipped) added = true;
    }
    if (!byName(twistName(side))) added = addTwist(doc, side, ctx) || added;
    out.forearm = Boolean(doc.getRoot().listNodes().find((n) => n.getName() === twistName(side))) || out.forearm;
  }
  if (added) writeBack(parts);
  const hands = { L: out.L, R: out.R };
  const same = JSON.stringify(hands) === JSON.stringify(scene.getExtras()?.hands);
  if (!same) scene.setExtras({ ...scene.getExtras(), hands });
  out.changed = added || !same;
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const dry = args.includes('--dry');
  const list = args.includes('--list');
  if (!files.length) throw new Error('usage: node scripts/hands-extend.mjs <file.glb> … [--dry] [--list]');
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  try {
    const { handFrame } = await vite.ssrLoadModule('/src/lib/three/held.js');
    await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
    for (const file of files) {
      const bytes = new Uint8Array(await readFile(file));
      const filtered = (glbJson(bytes).bufferViews ?? []).some((b) => (b.extensions?.EXT_meshopt_compression?.filter ?? 'NONE') !== 'NONE');
      const doc = await io.readBinary(bytes);
      const r = extendHands(doc, { handFrame, skip: SCULPTED[relative(ROOT, resolve(file)).split(sep).join('/')] ?? {} });
      const said = (h) => (h.skipped ? `skipped: ${h.skipped}` : `${h.kind}${h.thumb ? ' and a thumb' : ', no thumb'}`);
      let size = '';
      if (r.changed && !list) {
        doc
          .getRoot()
          .listExtensionsUsed()
          .find((e) => e.extensionName === 'EXT_meshopt_compression')
          ?.setEncoderOptions({ method: filtered ? EXTMeshoptCompression.EncoderMethod.FILTER : EXTMeshoptCompression.EncoderMethod.QUANTIZE });
        const out = await io.writeBinary(doc);
        size = `, ${(bytes.length / 1024).toFixed(1)} → ${(out.length / 1024).toFixed(1)} KB (+${((out.length - bytes.length) / 1024).toFixed(1)})`;
        if (!dry) await writeFile(file, out);
      }
      console.log(`${file}: left ${said(r.L)}; right ${said(r.R)}; twist ${r.forearm ? 'yes' : 'no'}${r.changed ? size : ', already extended'}`);
    }
  } finally {
    await vite.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
