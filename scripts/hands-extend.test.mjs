import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { handFrame } from '../src/lib/three/held.js';
import { meshyRig } from '../src/lib/three/meshyRig.fixture.js';
import { CANON, SCULPTED, extendHands, twistName } from './hands-extend.mjs';
import { hand as handMesh, tube } from './lib/hand.fixture.mjs';

const V = THREE.Vector3;
const Q = THREE.Quaternion;
const S = 50; // the bind's scale, as a quantized Meshy file's inverse bind matrices carry

// Meshy's 24 bones (the fixture's) as a file, a skinned mesh on them: a
// hand laid out in code on each hand bone (mirrored for the left), a
// forearm round each forearm bone, and a clip on the hips. Positions are
// stored divided by S, the inverse bind matrices multiplied by it, and the
// weights are bytes, as a Meshy file has them.
function figureDoc({ fused = false, hands = true } = {}) {
  const rig = meshyRig();
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene();
  doc.getRoot().setDefaultScene(scene);
  scene.setExtras({ profile: { height: 1.67 } });
  const nodes = new Map();
  const add = (o, parent) => {
    const n = doc.createNode(o.name).setTranslation(o.position.toArray()).setRotation(o.quaternion.toArray()).setScale(o.scale.toArray());
    nodes.set(o, n);
    (parent ?? scene).addChild(n);
    for (const c of o.children) add(c, n);
  };
  add(rig.armature, null);
  const bones = Object.values(rig.bones);
  const index = (name) => bones.findIndex((b) => b.name === name);
  const pos = [];
  const ji = [];
  const wt = [];
  const tris = [];
  const put = (p, bone, pairs) => {
    const w = p.clone().applyMatrix4(rig.bones[bone].matrixWorld).divideScalar(S);
    pos.push(w.x, w.y, w.z);
    const j = [0, 0, 0, 0];
    const k = [0, 0, 0, 0];
    pairs.forEach(([b, x], n) => {
      j[n] = index(b);
      k[n] = Math.round(x * 255);
    });
    k[pairs.length - 1] += 255 - k.reduce((a, b) => a + b, 0); // (bytes summing to one exactly)
    ji.push(...j);
    wt.push(...k);
  };
  for (const side of ['Left', 'Right']) {
    if (hands) {
      const h = handMesh({ fused });
      const base = pos.length / 3;
      for (const p of h.pts) {
        const q = side === 'Left' ? new V(-p.x, p.y, p.z) : p;
        put(q, `${side}Hand`, q.y <= 2 ? [[`${side}Hand`, 0.7], [`${side}ForeArm`, 0.3]] : [[`${side}Hand`, 1]]);
      }
      for (const [a, b, c] of h.tris) tris.push(base + a, base + b, base + c);
    }
    // the forearm: a tube down the bone, the elbow's ring shared with the arm
    const len = rig.bones[`${side}Hand`].position.y;
    const pts = [];
    const ft = [];
    tube(pts, ft, (t) => new V(0, len * t, 0), { r: 3, rings: 9 });
    const base = pos.length / 3;
    for (const p of pts) put(p, `${side}ForeArm`, p.y < 0.01 ? [[`${side}ForeArm`, 0.5], [`${side}Arm`, 0.5]] : [[`${side}ForeArm`, 1]]);
    for (const [a, b, c] of ft) tris.push(base + a, base + b, base + c);
  }
  const acc = (a, type) => doc.createAccessor().setArray(a).setType(type).setBuffer(buffer);
  const prim = doc
    .createPrimitive()
    .setIndices(acc(new Uint32Array(tris), 'SCALAR'))
    .setAttribute('POSITION', acc(new Float32Array(pos), 'VEC3'))
    .setAttribute('JOINTS_0', acc(new Uint8Array(ji), 'VEC4'))
    .setAttribute('WEIGHTS_0', acc(new Uint8Array(wt), 'VEC4').setNormalized(true));
  const M = new THREE.Matrix4().makeScale(S, S, S);
  const ibm = new Float32Array(16 * bones.length);
  bones.forEach((b, j) => ibm.set(b.matrixWorld.clone().invert().multiply(M).elements, j * 16));
  const skin = doc.createSkin().setInverseBindMatrices(acc(ibm, 'MAT4'));
  for (const b of bones) skin.addJoint(nodes.get(b));
  scene.addChild(doc.createNode('body').setMesh(doc.createMesh().addPrimitive(prim)).setSkin(skin));
  const hips = nodes.get(rig.bones.Hips);
  const sampler = doc.createAnimationSampler().setInput(acc(new Float32Array([0, 1]), 'SCALAR')).setOutput(acc(new Float32Array([0, 0, 0, 1, 0, 0.1, 0, 0.995]), 'VEC4'));
  doc.createAnimation('idle').addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(hips).setTargetPath('rotation').setSampler(sampler));
  return doc;
}

const W = (n) => new THREE.Matrix4().fromArray(n.getWorldMatrix());
// every vertex where its skin puts it at rest
function skinned(doc) {
  const node = doc.getRoot().listNodes().find((n) => n.getSkin());
  const skin = node.getSkin();
  const ibm = skin.getInverseBindMatrices();
  const el = [];
  const mats = skin.listJoints().map((j, i) => W(j).multiply(new THREE.Matrix4().fromArray(ibm.getElement(i, el))));
  const prim = node.getMesh().listPrimitives()[0];
  const P = prim.getAttribute('POSITION');
  const J = prim.getAttribute('JOINTS_0');
  const Wt = prim.getAttribute('WEIGHTS_0');
  const out = [];
  const p = [];
  const j = [];
  const w = [];
  for (let i = 0; i < P.getCount(); i++) {
    P.getElement(i, p);
    J.getElement(i, j);
    Wt.getElement(i, w);
    const s = new V();
    for (let k = 0; k < 4; k++) if (w[k]) s.addScaledVector(new V(...p).applyMatrix4(mats[j[k]]), w[k]);
    out.push({ at: s, joints: [...j], weights: [...w] });
  }
  return out;
}
const names = (doc) =>
  doc
    .getRoot()
    .listSkins()[0]
    .listJoints()
    .map((n) => n.getName());

describe('extendHands', () => {
  it('adds the fingers, the thumbs and the twists by their own geometry, named as CANON names them', () => {
    const doc = figureDoc();
    const r = extendHands(doc, { handFrame });
    expect(r).toMatchObject({ changed: true, forearm: true, L: { kind: 'fingers', thumb: true }, R: { kind: 'fingers', thumb: true } });
    const all = names(doc);
    expect(all).toHaveLength(24 + 28 + 2);
    expect(all.slice(24).sort()).toEqual([...CANON.Left.fingers, ...CANON.Right.fingers, twistName('Left'), twistName('Right')].sort());
    expect(doc.getRoot().getDefaultScene().getExtras()).toEqual({ profile: { height: 1.67 }, hands: { L: { kind: 'fingers', thumb: true }, R: { kind: 'fingers', thumb: true } } });
  });

  it('rests every new bone in the canonical frame: +y to the next joint, +z out of the back of the hand', () => {
    const doc = figureDoc();
    extendHands(doc, { handFrame });
    const byName = new Map(doc.getRoot().listNodes().map((n) => [n.getName(), n]));
    for (const side of ['Left', 'Right']) {
      const hq = new Q().setFromRotationMatrix(new THREE.Matrix4().extractRotation(W(byName.get(`${side}Hand`))));
      const back = new V(side === 'Left' ? -1 : 1, 0, 0).applyQuaternion(hq);
      for (const name of CANON[side].fingers) {
        const n = byName.get(name);
        const m = W(n);
        const q = new Q().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));
        const y = new V(0, 1, 0).applyQuaternion(q);
        const z = new V(0, 0, 1).applyQuaternion(q);
        const child = n.listChildren()[0];
        if (child) expect(y.dot(new V().setFromMatrixPosition(W(child)).sub(new V().setFromMatrixPosition(m)).normalize())).toBeGreaterThan(1 - 1e-4);
        expect(Math.abs(y.dot(z))).toBeLessThan(1e-4);
        expect(z.dot(back)).toBeGreaterThan(0.9);
      }
    }
  });

  it('keeps every vertex where it was at rest, its weights summing to one in at most four bones', () => {
    const doc = figureDoc();
    const before = skinned(doc);
    extendHands(doc, { handFrame });
    const after = skinned(doc);
    const fingers = new Set(names(doc).slice(24).map((_, i) => 24 + i));
    let moved = 0;
    after.forEach((v, i) => {
      expect(v.at.distanceTo(before[i].at)).toBeLessThan(1e-6);
      expect(Math.abs(v.weights.reduce((a, b) => a + b) - 1)).toBeLessThan(1e-6);
      if (v.joints.some((j, k) => v.weights[k] > 0 && fingers.has(j))) moved++;
    });
    expect(moved).toBeGreaterThan(400);
  });

  it('hands the forearm’s skin to its twist from half way (none) to the wrist (all)', () => {
    const doc = figureDoc();
    extendHands(doc, { handFrame });
    const all = names(doc);
    const fore = all.indexOf('LeftForeArm');
    const twist = all.indexOf(twistName('Left'));
    const node = doc.getRoot().listNodes().find((n) => n.getName() === 'LeftForeArm');
    const elbow = new V().setFromMatrixPosition(W(node));
    const wrist = new V().setFromMatrixPosition(W(node.listChildren().find((c) => c.getName() === 'LeftHand')));
    const L = wrist.distanceTo(elbow);
    let seen = 0;
    for (const v of skinned(doc)) {
      const w = (j) => v.joints.reduce((s, x, k) => s + (x === j ? v.weights[k] : 0), 0);
      if (w(fore) + w(twist) < 0.99) continue;
      const x = v.at.clone().sub(elbow).dot(wrist.clone().sub(elbow)) / (L * L);
      if (x < 0.05 || x > 0.95) continue;
      expect(Math.abs(w(twist) - Math.max(0, 2 * x - 1))).toBeLessThan(0.07); // (in 16ths)
      seen++;
    }
    expect(seen).toBeGreaterThan(20);
  });

  it('leaves the body’s clips as they were', () => {
    const doc = figureDoc();
    const [a] = doc.getRoot().listAnimations();
    const out = Array.from(a.listSamplers()[0].getOutput().getArray());
    extendHands(doc, { handFrame });
    const [b] = doc.getRoot().listAnimations();
    expect(b.listChannels()).toHaveLength(1);
    expect(Array.from(b.listSamplers()[0].getOutput().getArray())).toEqual(out);
  });

  it('changes nothing on a file it has already extended', async () => {
    const io = new NodeIO();
    const doc = figureDoc();
    extendHands(doc, { handFrame });
    // (through the file once, so both writes start from a read)
    const again = await io.readBinary(await io.writeBinary(doc));
    const once = await io.writeBinary(again);
    expect(extendHands(again, { handFrame }).changed).toBe(false);
    expect(Buffer.from(await io.writeBinary(again)).equals(Buffer.from(once))).toBe(true);
  });

  it('gives a mitten one group of two joints, the thumb its own', () => {
    const doc = figureDoc({ fused: true });
    const r = extendHands(doc, { handFrame });
    expect(r.L).toMatchObject({ kind: 'mitten', thumb: true });
    expect(names(doc).slice(24).sort()).toEqual([...CANON.Left.mitten, ...CANON.Right.mitten, twistName('Left'), twistName('Right')].sort());
  });

  it('leaves a hand it is told was sculpted round something, and says why', () => {
    const doc = figureDoc();
    const r = extendHands(doc, { handFrame, skip: { Right: 'sculpted round a grip' } });
    expect(r.R).toEqual({ skipped: 'sculpted round a grip' });
    expect(r.L.kind).toBe('fingers');
    expect(names(doc).filter((n) => n.startsWith('RightHand'))).toEqual(['RightHand']);
    expect(SCULPTED['public/models/galaxy/troops/stormtrooper.glb'].Right).toMatch(/trigger/);
  });

  it('lists a hand it cannot read and leaves it', () => {
    const doc = figureDoc({ hands: false });
    const r = extendHands(doc, { handFrame });
    expect(r.L.skipped).toMatch(/vertices/);
    expect(names(doc).filter((n) => /Hand(Index|Fingers|Thumb)/.test(n))).toEqual([]);
    expect(doc.getRoot().getDefaultScene().getExtras().hands.L.skipped).toMatch(/vertices/);
  });
});
