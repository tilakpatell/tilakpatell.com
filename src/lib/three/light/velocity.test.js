import { beforeAll, describe, expect, it } from 'vitest';
import { loadThree } from './three.js';
import { holdOut, previousViewProjection, stillVelocity } from './velocity.js';

let three;
beforeAll(async () => {
  three = await loadThree();
});

describe('the still velocity (lane N2)', () => {
  it('is one node a tsl, on one uniform of the camera’s last view-projection', () => {
    const v = stillVelocity(three);
    expect(v.isNode).toBe(true);
    expect(stillVelocity(three)).toBe(v);
  });

  it('keeps each camera’s last frame: the first frame its own, then the one before', () => {
    const { THREE } = three;
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    cam.updateMatrixWorld();
    const u = previousViewProjection(three);
    const at = (frameId) => (u.update({ camera: cam, frameId }), u.value);
    const first = at(1).clone();
    const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    expect(first.equals(vp)).toBe(true);
    cam.position.x = 3;
    cam.updateMatrixWorld();
    // (the same frame drawn again by a second pass: unchanged)
    expect(at(1).equals(vp)).toBe(true);
    expect(at(2).equals(vp)).toBe(true);
    const vp2 = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    expect(at(3).equals(vp2)).toBe(true);
  });

  it('holds a sprite or a decal out of the history: its own MRT writes the still velocity beside its colour', () => {
    const { THREE } = three;
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    expect(holdOut(m, three)).toBe(m);
    expect(Object.keys(m.mrtNode.outputNodes).sort()).toEqual(['output', 'velocity']);
    expect(m.mrtNode.outputNodes.velocity).toBe(stillVelocity(three));
    expect(m.userData.history).toBe('still');
    // (a material with its own MRT keeps its outputs)
    const glow = new THREE.MeshBasicNodeMaterial();
    glow.mrtNode = three.tsl.mrt({ bloom: three.tsl.float(1) });
    holdOut(glow, three);
    expect(Object.keys(glow.mrtNode.outputNodes).sort()).toEqual(['bloom', 'output', 'velocity']);
  });
});
