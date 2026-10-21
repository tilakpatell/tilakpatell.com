import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GHOST, rimAt } from './ghostLook';
import { ghostMaterial } from './ghosts';
import { ghostNodeMaterial } from './ghostNodes';

// The ghosts' look on both renderers: the classic one's GLSL rim
// (ghosts.js) and the node renderer's twin (ghostNodes.js) are made from the
// one set of numbers, so a ghost is the same pale, the same glow and the same
// rim of light on WebGL and on WebGPU.

describe('a ghost’s look, on both renderers', () => {
  it('has the same base on both: tint, glow, its strength, roughness, see-through, unseen till faded in', () => {
    const gl = ghostMaterial();
    const gpu = ghostNodeMaterial();
    for (const m of [gl, gpu]) {
      expect(m.color.getHex()).toBe(new THREE.Color(GHOST.tint).getHex());
      expect(m.emissive.getHex()).toBe(new THREE.Color(GHOST.glow).getHex());
      expect(m.emissiveIntensity).toBe(GHOST.glowStrength);
      expect(m.roughness).toBe(GHOST.roughness);
      expect(m.transparent).toBe(true);
      expect(m.depthWrite).toBe(false);
      expect(m.opacity).toBe(0);
    }
    gl.dispose();
    gpu.dispose();
  });

  it('puts the rim on both: the GLSL from the shared numbers, a node graph on the node material', () => {
    const gl = ghostMaterial();
    const sh = { fragmentShader: 'x\n#include <emissivemap_fragment>\ny' };
    gl.onBeforeCompile(sh);
    expect(sh.fragmentShader).toContain(`pow(rim, ${GHOST.rimPower.toFixed(1)})`);
    expect(sh.fragmentShader).toContain(`* ${GHOST.rimStrength.toFixed(1)}`);
    const gpu = ghostNodeMaterial();
    expect(gpu.isNodeMaterial).toBe(true);
    expect(gpu.emissiveNode).toBeTruthy();
    gl.dispose();
    gpu.dispose();
  });

  it('a world may raise the glow (Earth’s planes), the rim the same', () => {
    const gpu = ghostNodeMaterial({ glowStrength: 0.8 });
    expect(gpu.emissiveIntensity).toBe(0.8);
    expect(gpu.emissiveNode).toBeTruthy();
    gpu.dispose();
  });

  it('the rim: naught facing you, full side on, as the shader has it', () => {
    expect(rimAt(1)).toBeCloseTo(0, 6);
    expect(rimAt(0)).toBeCloseTo(GHOST.rimStrength, 6);
    expect(rimAt(-1)).toBeCloseTo(0, 6);
    expect(rimAt(0.5)).toBeCloseTo(0.5 ** GHOST.rimPower * GHOST.rimStrength, 6);
  });
});
