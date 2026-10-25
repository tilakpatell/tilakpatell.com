import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createUniqueFx } from './uniqueFx';

describe('uniqueFx', () => {
  it('draws ten dark matter orbs in one instanced draw (B9)', () => {
    const parent = new THREE.Group();
    createUniqueFx(parent).orbs(Array.from({ length: 10 }, (_, i) => ({ x: i, y: 0, z: 0 })));
    const pools = ['unique-orb', 'unique-halo'].map((n) => parent.children.filter((o) => o.name === n));
    expect(pools.map((p) => [p.length, p[0].count])).toEqual([[1, 10], [1, 10]]);
  });
});
