// clips.mjs: a library clip put on a figure's own skeleton, as forFigure would make it.
import { Document } from '@gltf-transform/core';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fileOf, LOCO, onFigure } from './clips.mjs';

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
