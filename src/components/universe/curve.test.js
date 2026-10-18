import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCurve } from './curve';
import { SECTORS } from './layout';

describe('the Central Finite Curve', () => {
  it('is drawn as a ball round the Rick and Morty pocket, where its wall stands, no heavier than the old wall', () => {
    const parent = new THREE.Group();
    const curve = createCurve(parent);
    const wall = parent.getObjectByName('central-finite-curve');
    expect(wall.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect(wall.geometry.parameters.radius).toBe(SECTORS.rickmorty.edge);
    expect(wall.position.toArray()).toEqual(SECTORS.rickmorty.origin);
    // (the open cylinder it replaces: 256 round and one high, 512 triangles)
    expect(wall.geometry.index.count / 3).toBeLessThanOrEqual(512);
    curve.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
