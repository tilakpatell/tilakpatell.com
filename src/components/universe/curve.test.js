import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCurve } from './curve';
import { SECTORS } from './layout';
import { DEEP } from './deep';

describe('the Central Finite Curve', () => {
  it('is drawn as the band of a ball round the Rick and Morty pocket, where its wall stands, open above and below, no heavier than the old wall', () => {
    const parent = new THREE.Group();
    const curve = createCurve(parent);
    const wall = parent.getObjectByName('central-finite-curve');
    const { geometry: geo } = wall;
    expect(geo).toBeInstanceOf(THREE.SphereGeometry);
    expect(geo.parameters.radius).toBe(SECTORS.rickmorty.edge);
    expect(wall.position.toArray()).toEqual(SECTORS.rickmorty.origin);
    // (the open cylinder it replaces: 256 round and one high, 512 triangles)
    expect(geo.index.count / 3).toBe(512);
    // a band, not the whole ball: it stops short of both poles (no cap), as
    // high above and below the disc as the old cylinder reached
    const { thetaStart, thetaLength } = geo.parameters;
    expect(thetaStart).toBeGreaterThan(0);
    expect(thetaStart + thetaLength).toBeLessThan(Math.PI);
    const pos = geo.attributes.position;
    let top = 0;
    for (let i = 0; i < pos.count; i++) top = Math.max(top, Math.abs(pos.getY(i)));
    expect(top).toBeCloseTo(DEEP.ceiling * 1.3, 6);
    curve.dispose();
    expect(parent.children).toHaveLength(0);
  });
});
