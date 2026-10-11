import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

// (the dome, as gameLook would bring it)
vi.mock('./gameLook', () => ({ loadLookMesh: async () => ({ scene: new THREE.Mesh(new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)) }) }));

const glsl = await import('./push');
const nodes = await import('./pushNodes');
const KEYS = ['transparent', 'depthWrite', 'blending', 'side', 'toneMapped', 'fog'];

describe('pushNodes, the twin of push', () => {
  it('the same fronts: node materials, the same flags and uniforms, played the same', async () => {
    const [ga, gb] = [new THREE.Group(), new THREE.Group()];
    const a = glsl.createPush(ga);
    const b = nodes.createPush(gb);
    expect(await a.ready).toBe(true);
    expect(await b.ready).toBe(true);
    const ma = ga.children[0].children[0].material;
    const mb = gb.children[0].children[0].material;
    expect(mb.isNodeMaterial).toBe(true);
    for (const k of KEYS) expect(mb[k]).toBe(ma[k]);
    expect(Object.keys(mb.uniforms).sort()).toEqual(Object.keys(ma.uniforms).sort());
    for (const p of [a, b]) {
      expect(p.push(new THREE.Vector3(), new THREE.Vector3(0, 0, 1), { colour: '#ff0000' })).toBe(true);
      p.update(0.2);
    }
    expect(mb.uniforms.uAge.value).toBeCloseTo(ma.uniforms.uAge.value);
    expect(mb.uniforms.uColour.value.getHex()).toBe(0xff0000);
    a.dispose();
    b.dispose();
  });
});
