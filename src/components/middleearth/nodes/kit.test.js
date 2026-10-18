import { describe, expect, it } from 'vitest';
import * as glsl from '../kit';
import * as nodes from './kit';

describe('nodes/kit, the twin of the kit', () => {
  it('exports what the kit exports, its parts the same objects', () => {
    expect(
      Object.keys(nodes)
        .filter((k) => k !== 'fbm')
        .sort(),
    ).toEqual(Object.keys(glsl).sort());
    for (const k of ['FIRE', 'EMBER', 'SMOKE', 'LIGHT', 'stoneTextures', 'makeGandalf', 'makeBalrog', 'makeHobbit', 'makeOrc']) expect(nodes[k]).toBe(glsl[k]);
  });

  it('makes node materials whose uniforms carry the GLSL’s names and values', () => {
    const pairs = [
      [glsl.lavaMaterial({ heat: 1.3 }), nodes.lavaMaterial({ heat: 1.3 })],
      [glsl.skyDome(10, { cloud: 1 }).material, nodes.skyDome(10, { cloud: 1 }).material],
      [glsl.createParticles(4, { stretch: 2 }).mesh.material, nodes.createParticles(4, { stretch: 2 }).mesh.material],
    ];
    for (const [a, n] of pairs) {
      expect(n.isNodeMaterial).toBe(true);
      expect(Object.keys(n.uniforms).sort()).toEqual(
        Object.keys(a.uniforms)
          .filter((k) => k.startsWith('u'))
          .sort(),
      );
      for (const k of Object.keys(n.uniforms)) {
        const v = a.uniforms[k].value;
        expect(v?.toArray ? n.uniforms[k].value.toArray() : n.uniforms[k].value).toEqual(v?.toArray ? v.toArray() : v);
      }
      expect([n.transparent, n.depthWrite, n.blending, n.side]).toEqual([a.transparent, a.depthWrite, a.blending, a.side]);
    }
  });

  it('pools particles the same on either side', () => {
    const a = glsl.createParticles(8);
    const n = nodes.createParticles(8);
    for (const p of [a, n]) {
      p.emit(0, 0, 0, 0, 1, 0, 1, 0.5);
      p.step(0.1);
    }
    expect(n.count).toBe(a.count);
    expect([...n.mesh.geometry.getAttribute('aAt').array]).toEqual([...a.mesh.geometry.getAttribute('aAt').array]);
  });
});
