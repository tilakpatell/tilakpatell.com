import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { UPRIGHT_GLSL, faceUpright, uprightBasis } from './upright';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);

describe('uprightBasis', () => {
  it('is square, faces the eye and keeps its right side level', () => {
    const eyes = [
      [0, 0, 10],
      [30, 4, -2],
      [-5, -12, 3],
      [1, 40, 1],
    ];
    for (const eye of eyes) {
      const { right, up, toward } = uprightBasis([0, 0, 0], eye);
      for (const v of [right, up, toward]) expect(len(v)).toBeCloseTo(1, 9);
      expect(dot(right, up)).toBeCloseTo(0, 9);
      expect(dot(right, toward)).toBeCloseTo(0, 9);
      expect(dot(up, toward)).toBeCloseTo(0, 9);
      const e = eye.map((x) => x / len(eye));
      expect(dot(toward, e)).toBeCloseTo(1, 9);
      expect(right[1]).toBeCloseTo(0, 9); // (no roll: level)
      expect(up[1]).toBeGreaterThanOrEqual(0); // (and the right way up)
    }
  });

  it('is the camera’s own axes for an upright camera looking straight at it', () => {
    const { right, up, toward } = uprightBasis([0, 0, -10], [0, 0, 0]);
    expect(right).toEqual([1, 0, 0].map((x) => expect.closeTo(x, 9)));
    expect(up).toEqual([0, 1, 0].map((x) => expect.closeTo(x, 9)));
    expect(toward).toEqual([0, 0, 1].map((x) => expect.closeTo(x, 9)));
  });

  it('stays defined looking straight down on it', () => {
    const { right, up, toward } = uprightBasis([0, 0, 0], [0, 50, 0]);
    expect(toward[1]).toBeCloseTo(1, 9);
    expect(len(right)).toBeCloseTo(1, 9);
    expect(len(up)).toBeCloseTo(1, 9);
    expect(dot(right, up)).toBeCloseTo(0, 9);
  });
});

describe('faceUpright', () => {
  it('turns a plane under a turned parent to face the eye, whatever the camera’s roll', () => {
    const parent = new THREE.Group();
    parent.rotation.y = 1.1;
    parent.position.set(5, 0, 0);
    const plane = new THREE.Object3D();
    plane.position.set(0, 2, -30);
    parent.add(plane);
    parent.updateMatrixWorld(true);
    const eye = new THREE.Vector3(3, 6, 12);
    faceUpright(plane, eye);
    plane.updateMatrixWorld(true);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(plane.matrixWorld);
    const to = eye.clone().sub(plane.getWorldPosition(new THREE.Vector3())).normalize();
    expect(normal.dot(to)).toBeCloseTo(1, 6);
    const right = new THREE.Vector3(1, 0, 0).transformDirection(plane.matrixWorld);
    expect(right.y).toBeCloseTo(0, 6);
  });

  it('has a shader twin', () => {
    expect(UPRIGHT_GLSL).toContain('vec3 upright(vec3 centre, vec2 offset)');
    expect(UPRIGHT_GLSL).toContain('cameraPosition');
  });
});
