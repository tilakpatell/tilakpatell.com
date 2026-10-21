import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cut } from './crowd';

describe('the crowd’s cut-down figures', () => {
  it('cuts a dense mesh to about the triangles asked, inside its own bounds', async () => {
    const src = new THREE.SphereGeometry(1, 96, 64);
    const g = await cut(src, 1500);
    const out = g.index.count / 3;
    expect(out).toBeLessThan(2400);
    expect(out).toBeGreaterThan(600);
    g.computeBoundingBox();
    for (const v of [g.boundingBox.min.x, g.boundingBox.min.y, g.boundingBox.min.z]) expect(v).toBeGreaterThanOrEqual(-1.0001);
    for (const v of [g.boundingBox.max.x, g.boundingBox.max.y, g.boundingBox.max.z]) expect(v).toBeLessThanOrEqual(1.0001);
  });

  it('keeps every attribute, the skin’s weights among them, one a vertex', async () => {
    const src = new THREE.TorusKnotGeometry(1, 0.3, 200, 24);
    const n = src.attributes.position.count;
    src.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).fill(1), 4));
    src.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).fill(0.25), 4));
    const g = await cut(src, 2000);
    const m = g.attributes.position.count;
    expect(m).toBeLessThan(n);
    for (const k of ['normal', 'uv', 'skinIndex', 'skinWeight']) expect(g.attributes[k]?.count, k).toBe(m);
    expect(g.attributes.skinWeight.getX(0)).toBeCloseTo(0.25);
  });

  it('leaves a mesh already small enough as it is', async () => {
    const src = new THREE.BoxGeometry(1, 1, 1);
    expect(await cut(src, 1000)).toBe(src);
  });
});
