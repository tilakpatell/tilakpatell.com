import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../../../towns/weathertop/propsShaders';
import * as nodes from './propsShaders';

const valueOf = (v) => (v?.toArray ? v.toArray() : v);
// the GLSL’s own uniforms (its u…), names and values, on the twin
const sameUniforms = (a, n) => {
  expect(Object.keys(n.uniforms).sort()).toEqual(
    Object.keys(a.uniforms)
      .filter((k) => k.startsWith('u'))
      .sort(),
  );
  for (const k of Object.keys(n.uniforms)) expect(valueOf(n.uniforms[k].value)).toEqual(valueOf(a.uniforms[k].value));
};
const sameState = (a, n) => expect([n.transparent, n.depthWrite, n.blending, n.side, n.fog]).toEqual([a.transparent, a.depthWrite, a.blending, a.side, a.fog]);

const sprayGeometry = (n) => {
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  pg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n * 4).fill(0.5), 4));
  pg.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  pg.setAttribute('aVel', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return pg;
};

describe('nodes/towns/weathertop/propsShaders, the twin of Weathertop’s props’ shaders', () => {
  it('exports what the original exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('makes the water and the churn node materials with the GLSL’s uniforms', () => {
    for (const k of ['floodWaterMaterial', 'churnMaterial']) {
      const a = glsl[k]();
      const n = nodes[k]();
      expect(n.isNodeMaterial).toBe(true);
      sameUniforms(a, n);
      sameState(a, n);
    }
  });

  it('makes the spray a sprite instanced once a drop, its uniforms the GLSL’s', () => {
    const a = glsl.sprayPoints(sprayGeometry(12));
    const n = nodes.sprayPoints(sprayGeometry(12));
    expect(a.isPoints).toBe(true);
    expect(n.isSprite).toBe(true);
    expect(n.count).toBe(12);
    expect(n.material.isNodeMaterial).toBe(true);
    sameUniforms(a.material, n.material);
    expect([n.material.transparent, n.material.depthWrite, n.material.blending]).toEqual([a.material.transparent, a.material.depthWrite, a.material.blending]);
    expect(n.material.toneMapped).toBe(false);
  });

  it('gives the hooked materials back as node twins, their properties kept', () => {
    const make = () =>
      new THREE.MeshStandardMaterial({
        color: 0x140804,
        emissive: new THREE.Color(0xff5a1c),
        emissiveIntensity: 1.6,
        vertexColors: true,
        side: THREE.DoubleSide,
      });
    for (const k of ['emberGlow', 'hairBothSides']) {
      const a = glsl[k](make());
      const n = nodes[k](make());
      expect(a.isNodeMaterial).toBeFalsy();
      expect(n.isNodeMaterial).toBe(true);
      expect(n.emissive.getHex()).toBe(a.emissive.getHex());
      expect([n.emissiveIntensity, n.vertexColors, n.side]).toEqual([a.emissiveIntensity, a.vertexColors, a.side]);
    }
    // (a key of their own, so a hooked material never shares a plain one’s program)
    const plain = nodes.hairBothSides(make()).customProgramCacheKey();
    expect(plain).toContain('wt-hair');
    expect(nodes.emberGlow(make()).customProgramCacheKey()).toContain('wt-ember');
  });
});
