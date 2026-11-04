import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { reworldMoved } from './reworld';

// a tree as a scene has one: nested groups turned and scaled, a camera, one
// kept by hand (matrixAutoUpdate off) and a branch its owner updates itself
// (matrixWorldAutoUpdate off)
const tree = () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  root.position.set(40000, -20, 300);
  root.rotation.set(0.1, 0.4, -0.2);
  scene.add(root);
  const a = new THREE.Group();
  a.position.set(5, 6, 7);
  a.scale.set(2, 2, 2);
  a.rotation.y = 1.2;
  root.add(a);
  const b = new THREE.Mesh();
  b.position.set(-3, 1, 0.5);
  a.add(b);
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(1, 2, 3);
  cam.rotation.x = -0.3;
  a.add(cam);
  const byHand = new THREE.Object3D();
  byHand.position.set(9, 9, 9);
  byHand.updateMatrix();
  byHand.matrixAutoUpdate = false;
  root.add(byHand);
  const own = new THREE.Group();
  own.position.set(1, 1, 1);
  own.matrixWorldAutoUpdate = false;
  root.add(own);
  const ownChild = new THREE.Object3D();
  ownChild.position.set(2, 0, 0);
  own.add(ownChild);
  return { scene, root, nodes: { a, b, cam, byHand, own, ownChild } };
};

describe('reworldMoved', () => {
  it('puts every world matrix under a moved branch where a whole update would, without composing them again', () => {
    const t = tree();
    const ref = tree();
    t.scene.updateMatrixWorld();
    ref.scene.updateMatrixWorld();
    // drawn near the middle: the branch moved in, updated, and moved back
    const d = new THREE.Vector3(40000, -20, 300);
    t.root.position.sub(d);
    t.scene.updateMatrixWorld();
    t.root.position.add(d);
    reworldMoved(t.root);
    ref.scene.updateMatrixWorld();
    for (const k of ['a', 'b', 'cam', 'byHand']) {
      const got = t.nodes[k].matrixWorld.elements;
      const want = ref.nodes[k].matrixWorld.elements;
      for (let i = 0; i < 16; i++) expect(got[i]).toBeCloseTo(want[i], 6);
    }
    for (let i = 0; i < 16; i++) expect(t.root.matrixWorld.elements[i]).toBeCloseTo(ref.root.matrixWorld.elements[i], 6);
    // the camera's inverse too, which its own update keeps
    const inv = t.nodes.cam.matrixWorldInverse.elements;
    const want = ref.nodes.cam.matrixWorldInverse.elements;
    for (let i = 0; i < 16; i++) expect(inv[i]).toBeCloseTo(want[i], 6);
  });

  it('leaves alone a branch its owner updates itself, as a whole update does', () => {
    const t = tree();
    t.scene.updateMatrixWorld();
    t.nodes.own.updateMatrixWorld(true);
    const before = t.nodes.ownChild.matrixWorld.clone();
    t.root.position.x += 50;
    reworldMoved(t.root);
    expect(t.nodes.ownChild.matrixWorld.equals(before)).toBe(true);
  });
});
