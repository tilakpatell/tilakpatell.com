import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { sizeFor } from './sizing';
import { sizeFor as fromModels } from './models';

describe('sizeFor, on its own', () => {
  it('by height, length or width, else as it comes', () => {
    const size = new THREE.Vector3(3, 4, 6);
    expect(sizeFor(size, { tall: 2 })).toBe(0.5);
    expect(sizeFor(size, { long: 3 })).toBe(0.5);
    expect(sizeFor(size, { wide: 12 })).toBe(2);
    expect(sizeFor(size)).toBe(1);
    expect(sizeFor(new THREE.Vector3(0, 0, 0), { tall: 2 })).toBe(2);
  });

  it('is the one models.js exports', () => {
    expect(fromModels).toBe(sizeFor);
  });
});
