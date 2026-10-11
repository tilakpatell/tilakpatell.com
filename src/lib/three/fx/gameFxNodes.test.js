import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// (every sheet the bucket has, a 2 × 2 grid; no push dome)
const sheet = (name) => {
  const t = new THREE.DataTexture(new Uint8Array(16).fill(255), 2, 2);
  t.userData.look = { grid: [2, 2], name, rampV: 0.5 };
  return t;
};
vi.mock('./gameLook', () => ({ loadLook: async (name) => sheet(name), loadLookMesh: async () => null }));
vi.mock('./debris', async (orig) => ({ ...(await orig()), createDebris: () => ({ preload() {}, throw: () => 0, update() {}, clear() {}, dispose() {}, busy: 0 }) }));

const glsl = await import('./gameFx');
const nodes = await import('./gameFxNodes');

describe('gameFxNodes, the twin of gameFx', () => {
  it('the same parts, every one drawn in nodes', async () => {
    const a = glsl.createGameFx(new THREE.Group(), { level: 'high' });
    const b = nodes.createGameFx(new THREE.Group(), { level: 'high' });
    expect(await a.ready).toBe(true);
    expect(await b.ready).toBe(true);
    for (const part of ['scorch', 'burst', 'ring', 'metal', 'ember', 'glow']) expect(b.has(part)).toBe(a.has(part));
    expect(b.meshes.map((m) => m.name)).toEqual(a.meshes.map((m) => m.name));
    expect(b.meshes.every((m) => m.material.isNodeMaterial)).toBe(true);
    expect(a.meshes.some((m) => m.material.isNodeMaterial)).toBe(false);
    expect(b.explode(new THREE.Vector3(), 'grenade')).toBe(true);
    b.update(0.05);
    expect(b.busy).toBeGreaterThan(0);
    a.dispose();
    b.dispose();
  });
});
