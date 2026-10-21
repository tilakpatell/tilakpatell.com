// transfer.mjs: a cut weighted like another by nearest vertex.
import { Document } from '@gltf-transform/core';
import { describe, expect, it } from 'vitest';
import { NAMES } from './skin.mjs';
import { weightsLike } from './transfer.mjs';

// a mesh of points, each with one joint, or none
function cloud(points, joints) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const prim = doc.createPrimitive().setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(points.flat())).setBuffer(buf));
  if (joints) {
    prim.setAttribute('JOINTS_0', doc.createAccessor().setType('VEC4').setArray(new Uint8Array(joints.flatMap((j) => [j, 0, 0, 0]))).setBuffer(buf));
    prim.setAttribute('WEIGHTS_0', doc.createAccessor().setType('VEC4').setArray(new Float32Array(joints.flatMap(() => [1, 0, 0, 0]))).setBuffer(buf));
  }
  doc.createScene().addChild(doc.createNode('m').setMesh(doc.createMesh('m').addPrimitive(prim)));
  return doc;
}

describe('weighting one cut like another', () => {
  it('gives each vertex the joints and weights of the nearest one, and a skin of the table’s bones', () => {
    const hand = NAMES.indexOf('LeftHand');
    const head = NAMES.indexOf('Head');
    const from = cloud([[0.5, 1, 0], [0, 1.4, 0], [0.48, 1.02, 0.01]], [hand, head, hand]);
    const to = weightsLike(cloud([[0.49, 1.01, 0], [0.01, 1.38, 0.02], [0.3, 1.9, 0.4]]), from);
    const prim = to.getRoot().listMeshes()[0].listPrimitives()[0];
    const j = prim.getAttribute('JOINTS_0').getArray();
    expect([j[0], j[4], j[8]]).toEqual([hand, head, head]);
    expect(Array.from(prim.getAttribute('WEIGHTS_0').getArray().slice(0, 4))).toEqual([1, 0, 0, 0]);
    const [node] = to.getRoot().listNodes().filter((n) => n.getMesh());
    expect(node.getSkin().listJoints().map((n) => n.getName())).toEqual(NAMES);
  });

  it('refuses a cut with no weights to take', () => {
    expect(() => weightsLike(cloud([[0, 0, 0]]), cloud([[0, 0, 0]]))).toThrow(/no weights/);
  });
});
