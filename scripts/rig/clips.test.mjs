// clips.mjs: a library clip put on a figure's own skeleton, as forFigure would make it.
import { Document } from '@gltf-transform/core';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { fileOf, ground, GROUND, hipsFor, LOCO, onFigure } from './clips.mjs';

// an armature with a mesh and two bones, the hips `hipsY` high
function skeleton(hipsY, { mesh = false } = {}) {
  const doc = new Document();
  const arm = doc.createNode('Armature').setScale([0.01, 0.01, 0.01]);
  const hips = doc.createNode('Hips').setTranslation([0, hipsY, 0]);
  hips.addChild(doc.createNode('Spine02').setTranslation([0, 10, 0]));
  if (mesh) arm.addChild(doc.createNode('char1').setMesh(doc.createMesh('m')));
  arm.addChild(hips);
  doc.createScene().addChild(arm);
  return doc;
}

// a clip on a rig whose hips stand 100 high: the hips moved and turned, the spine turned and moved (as Meshy's files have it)
function clipDoc() {
  const doc = skeleton(100);
  const buf = doc.createBuffer();
  const [hips, spine] = ['Hips', 'Spine02'].map((n) => doc.getRoot().listNodes().find((x) => x.getName() === n));
  const anim = doc.createAnimation('take');
  const add = (node, path, type, values) => {
    const s = doc
      .createAnimationSampler()
      .setInput(doc.createAccessor().setType('SCALAR').setArray(new Float32Array([0, 1])).setBuffer(buf))
      .setOutput(doc.createAccessor().setType(type).setArray(new Float32Array(values)).setBuffer(buf));
    anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(s));
  };
  add(hips, 'translation', 'VEC3', [0, 100, 0, 2, 96, 4]);
  add(hips, 'rotation', 'VEC4', [0, 0, 0, 1, 0, 0.1, 0, 0.995]);
  add(spine, 'rotation', 'VEC4', [0.1, 0, 0, 0.995, 0, 0, 0, 1]);
  add(spine, 'translation', 'VEC3', [0, 10, 0, 0, 12, 0]);
  add(spine, 'scale', 'VEC3', [1, 1, 1, 1.1, 1.1, 1.1]);
  return doc;
}

describe('a figure’s own clips', () => {
  it('are its skeleton, nothing to draw, each bone’s turns as the clip has them and the hips’ height scaled to its own', () => {
    const { doc, k } = onFigure(skeleton(50, { mesh: true }), clipDoc(), 'walk');
    expect(k).toBe(0.5);
    const root = doc.getRoot();
    expect(root.listNodes().map((n) => n.getName())).toEqual(['Armature', 'Hips', 'Spine02']);
    expect(root.listMeshes()).toHaveLength(0);
    const [anim] = root.listAnimations();
    expect(anim.getName()).toBe('walk');
    const got = Object.fromEntries(anim.listChannels().map((c) => [`${c.getTargetNode().getName()}.${c.getTargetPath()}`, Array.from(c.getSampler().getOutput().getArray())]));
    expect(Object.keys(got).sort()).toEqual(['Hips.rotation', 'Hips.translation', 'Spine02.rotation']);
    expect(got['Hips.translation']).toEqual([0, 50, 0, 1, 48, 2]);
    expect(got['Spine02.rotation'][0]).toBeCloseTo(0.1, 6);
  });

  it('come from the library’s files by the library’s names', () => {
    for (const name of Object.values(LOCO)) expect(existsSync(fileOf(name)), name).toBe(true);
    expect(fileOf('walk.formal')).toMatch(/games[\\/]meshy[\\/]ual-walk\.formal\.glb$/);
    expect(fileOf('walk')).toMatch(/rick-walk\.glb$/);
    expect(() => fileOf('moonwalk')).toThrow(/no clip moonwalk/);
  });
});

// a figure standing on one foot's bone: the hips 50 cm up, the foot under them, three
// vertices on the foot (two on the floor) and one up at the knee, bound at rest
function onAFoot() {
  const doc = new Document();
  const buf = doc.createBuffer();
  const arm = doc.createNode('Armature').setScale([0.01, 0.01, 0.01]);
  const hips = doc.createNode('Hips').setTranslation([0, 50, 0]);
  const foot = doc.createNode('LeftFoot').setTranslation([5, -45, 0]);
  hips.addChild(foot);
  const world = (node) => new THREE.Matrix4().fromArray(node.getWorldMatrix());
  arm.addChild(hips);
  doc.createScene().addChild(arm);
  const ibm = new Float32Array(32);
  ibm.set(world(hips).invert().elements, 0);
  ibm.set(world(foot).invert().elements, 16);
  const skin = doc.createSkin().addJoint(hips).addJoint(foot).setInverseBindMatrices(doc.createAccessor().setType('MAT4').setArray(ibm).setBuffer(buf));
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array([0.05, 0, 0, 0.05, 0.01, 0.06, 0.05, 0.3, 0])).setBuffer(buf))
    .setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array([1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0])).setBuffer(buf))
    .setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])).setBuffer(buf));
  arm.addChild(doc.createNode('char1').setMesh(doc.createMesh('m').addPrimitive(prim)).setSkin(skin));
  return doc;
}

// a clip on a rig whose hips stand 50 high, its hips at `ys` (cm) a second apart
function hipsAt(ys) {
  const doc = skeleton(50);
  const buf = doc.createBuffer();
  const hips = doc.getRoot().listNodes().find((n) => n.getName() === 'Hips');
  const s = doc
    .createAnimationSampler()
    .setInput(doc.createAccessor().setType('SCALAR').setArray(Float32Array.from(ys, (_, i) => i)).setBuffer(buf))
    .setOutput(doc.createAccessor().setType('VEC3').setArray(Float32Array.from(ys.flatMap((y) => [0, y, 0]))).setBuffer(buf));
  doc.createAnimation('take').addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(hips).setTargetPath('translation').setSampler(s));
  return doc;
}

const hipsTrack = (doc) => Array.from(doc.getRoot().listAnimations()[0].listChannels().find((c) => c.getTargetPath() === 'translation').getSampler().getOutput().getArray()).filter((_, i) => i % 3 === 1);

describe('a figure’s own clips on the floor', () => {
  it('raise or lower the hips each frame by what puts the soles back where they stand at rest', () => {
    const fig = onAFoot();
    const { doc } = onFigure(fig, hipsAt([45, 52, 50]), 'walk');
    const by = ground(fig, doc, 'each');
    expect(by.map((v) => Math.round(v * 1000) / 1000)).toEqual([-0.05, 0.02, 0]);
    hipsTrack(doc).forEach((y) => expect(y).toBeCloseTo(50, 4));
  });

  it('move a run by one amount, so its flight is kept and its lowest frame meets the floor', () => {
    const fig = onAFoot();
    const { doc } = onFigure(fig, hipsAt([48, 56, 50]), 'run');
    ground(fig, doc, 'lowest');
    const ys = hipsTrack(doc);
    expect(ys[0]).toBeCloseTo(50, 4);
    expect(ys[1] - ys[0]).toBeCloseTo(8, 4);
  });

  it('give the library’s clips the hips that stand the figure’s idle on the floor', () => {
    const fig = onAFoot();
    expect(hipsFor(fig, onFigure(fig, hipsAt([47, 47]), 'idle').doc)).toBeCloseTo(53, 4);
    expect(GROUND).toEqual({ idle: 'each', walk: 'each', run: 'lowest' });
  });
});
