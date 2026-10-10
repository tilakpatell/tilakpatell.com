import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './grounding-bake';
import * as nodes from './groundingBakeNodes';

describe('groundingBakeNodes, the twin of grounding-bake', () => {
  it('exports what grounding-bake exports, and the CPU resolve', () => {
    expect(Object.keys(nodes).filter((k) => k !== 'resolveMask').sort()).toEqual(Object.keys(glsl).sort());
  });

  it('the pure parts are the same', () => {
    const axis = new THREE.Vector3(0.3, 0.8, 0.1);
    expect(nodes.coneDirections(axis, 0.07, 12).map((v) => v.toArray())).toEqual(glsl.coneDirections(axis, 0.07, 12).map((v) => v.toArray()));
    expect(nodes.skyDirections(9).map((v) => v.toArray())).toEqual(glsl.skyDirections(9).map((v) => v.toArray()));
    expect(nodes.liftSun(new THREE.Vector3(1, 0.05, 0), 20).toArray()).toEqual(glsl.liftSun(new THREE.Vector3(1, 0.05, 0), 20).toArray());
    expect(nodes.packHeight(3.3, [-2, 10])).toEqual(glsl.packHeight(3.3, [-2, 10]));
    expect(nodes.BAKE_TIERS).toEqual(glsl.BAKE_TIERS);
  });

  // a 4 × 4 floor rising 1 m a row in z, read back with its rows either way round
  const picture = (flip) => {
    const n = 4;
    const pos = new Float32Array(n * n * 4);
    const acc = new Float32Array(n * n * 4);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const row = flip ? n - 1 - j : j;
        const k = (row * n + i) * 4;
        pos.set([i, j, j, 1], k);
        acc.set([i === 0 ? 0 : 1, 0, 0, 0.5], k);
      }
    return { pos, acc, n };
  };

  it('resolves a sum into the mask: sun in R, the height in G and B, the sky in A, z0 first however it was read', () => {
    const a = picture(false);
    const b = picture(true);
    const ma = nodes.resolveMask(a.acc, a.pos, a.n, [0, 3]);
    const mb = nodes.resolveMask(b.acc, b.pos, b.n, [0, 3]);
    expect(Array.from(mb)).toEqual(Array.from(ma));
    // (row j is the floor's j metres up: unpacked, the height comes back)
    for (let j = 0; j < 4; j++) expect(nodes.unpackHeight(ma[(j * 4 + 2) * 4 + 1], ma[(j * 4 + 2) * 4 + 2], [0, 3])).toBeCloseTo(j, 3);
    expect(ma[(1 * 4 + 3) * 4]).toBe(255); // (lit, inside)
    expect(ma[(1 * 4 + 0) * 4]).toBeLessThan(255); // (the shaded column, softened by the tent)
    expect(ma[3]).toBe(128);
  });

  it('gives up on a renderer that can’t read a picture back: the world stands as it is', async () => {
    expect(await nodes.bakeFloorTexture({}, new THREE.Scene(), { area: { x0: 0, z0: 0, w: 1, d: 1 }, floor: [new THREE.Object3D()] })).toBe(null);
  });
});
