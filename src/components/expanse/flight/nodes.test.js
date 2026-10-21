import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { cityMaterial as cityGlsl, skyDome as skyGlsl } from '../../../../scripts/twin-parity/cases/flightGlsl.js';
import { cityMaterial, skyDome } from './nodes.js';

// The flight's two shaders of its own as nodes, against the GLSL ones: the
// same flags, the same uniforms under the same names (occurrenceScene tints
// the sky through material.uniforms.uLow and uHigh), the same surface.
describe('the flight’s sky dome as nodes', () => {
  it('is drawn inside out, behind everything, unfogged, as the GLSL dome', () => {
    const glsl = skyGlsl('#334455', '#88aacc');
    const node = skyDome('#334455', '#88aacc');
    expect(node.material.isNodeMaterial).toBe(true);
    for (const k of ['side', 'depthWrite', 'fog']) expect(node.material[k]).toBe(glsl.material[k]);
    expect(node.frustumCulled).toBe(glsl.frustumCulled);
    expect(node.renderOrder).toBe(glsl.renderOrder);
    expect(node.geometry.parameters).toEqual(glsl.geometry.parameters);
    // (the GLSL dome has no tone-mapping chunk: its colours go out as they are)
    expect(node.material.toneMapped).toBe(false);
    expect(node.material.colorNode?.isNode).toBe(true);
  });

  it('keeps its two colours as uniforms under the GLSL names, a tint written into them reaching the nodes', () => {
    const glsl = skyGlsl('#334455', '#88aacc').material.uniforms;
    const { uniforms } = skyDome('#334455', '#88aacc').material;
    expect(Object.keys(uniforms).sort()).toEqual(Object.keys(glsl).sort());
    for (const k of ['uLow', 'uHigh']) {
      expect(uniforms[k].isNode).toBe(true);
      expect(uniforms[k].value.getHex()).toBe(glsl[k].value.getHex());
    }
    uniforms.uLow.value.set('#ff0000');
    expect(uniforms.uLow.value.getHex()).toBe(0xff0000);
  });
});

describe('the flight’s city as nodes', () => {
  it('is the GLSL city’s standard material, its name and its stone, with the lit windows as nodes', () => {
    const glsl = cityGlsl('#8a8f99');
    const node = cityMaterial('#8a8f99');
    expect(node.isMeshStandardNodeMaterial).toBe(true);
    expect(node.name).toBe(glsl.name);
    for (const k of ['roughness', 'metalness']) expect(node[k]).toBe(glsl[k]);
    expect(node.color.getHex()).toBe(glsl.color.getHex());
    expect(node.colorNode?.isNode).toBe(true);
    expect(node.emissiveNode?.isNode).toBe(true);
    expect(node).toBeInstanceOf(THREE.Material);
  });

  it('is one material a colour, as the GLSL one shares its program by name', () => {
    const a = cityMaterial('#8a8f99');
    const b = cityMaterial('#202428');
    expect(a).not.toBe(b);
    expect(b.color.getHex()).toBe(0x202428);
  });

  // (a TSL assignment outside an Fn has no stack: three says so and drops
  // it, so the hash lost its second step and the windows never lit, lane
  // P1's 20.9 dB)
  it('builds its window hash without a word from TSL', () => {
    const said = [];
    const err = vi.spyOn(console, 'error').mockImplementation((...a) => said.push(a.join(' ')));
    const warn = vi.spyOn(console, 'warn').mockImplementation((...a) => said.push(a.join(' ')));
    try {
      cityMaterial('#8a8f99');
    } finally {
      err.mockRestore();
      warn.mockRestore();
    }
    expect(said).toEqual([]);
  });
});
