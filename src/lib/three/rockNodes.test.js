import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './rock';
import * as nodes from './rockNodes';

describe('rockNodes, the twin of rock', () => {
  it('exports what rock exports; the same rocks, point for point', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    const a = glsl.rng(7);
    const b = nodes.rng(7);
    for (let i = 0; i < 5; i++) expect(b()).toBe(a());
    for (const [seed, opts] of [
      [11, {}],
      [53, { craters: true }],
    ]) {
      const o = glsl.rock(seed, opts);
      const n = nodes.rock(seed, opts);
      expect(Array.from(n.attributes.position.array)).toEqual(Array.from(o.attributes.position.array));
      expect(Array.from(n.attributes.normal.array)).toEqual(Array.from(o.attributes.normal.array));
      expect(n.index?.array && Array.from(n.index.array)).toEqual(o.index?.array && Array.from(o.index.array));
    }
  });

  it('one switch for every rock’s relief: a uniform node, written as the pace writes it', () => {
    expect(nodes.ROCK_RELIEF.isNode).toBe(true);
    expect(nodes.ROCK_RELIEF.value).toBe(1);
    nodes.ROCK_RELIEF.value = 0;
    expect(nodes.ROCK_RELIEF.value).toBe(0);
    nodes.ROCK_RELIEF.value = 1;
  });

  it('the rock material: a node material, pitted on high and mid, flat on low, the same uniforms', () => {
    const o = glsl.rockMaterial({ tier: 'high', scale: 1.5 });
    const shader = {
      uniforms: {},
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    };
    o.onBeforeCompile(shader);
    const n = nodes.rockMaterial({ tier: 'high', scale: 1.5 });
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    for (const k of ['roughness', 'metalness', 'envMapIntensity', 'flatShading']) expect(n[k]).toBe(o[k]);
    expect(Object.keys(n.userData.rock).sort()).toEqual(Object.keys(o.userData.rock).sort());
    for (const k of Object.keys(o.userData.rock)) {
      expect(n.userData.rock[k].isNode).toBe(true);
      const v = o.userData.rock[k].value;
      expect(v?.toArray ? n.userData.rock[k].value.toArray() : n.userData.rock[k].value).toEqual(v?.toArray ? v.toArray() : v);
    }
    expect(n.userData.rock.uRockRelief).toBe(nodes.ROCK_RELIEF);
    expect(n.customProgramCacheKey()).toContain('rock');
    expect(Object.hasOwn(n, 'setupVariants')).toBe(true); // (rougher in the pits)
    const low = nodes.rockMaterial({ tier: 'low' });
    expect(low.isMeshStandardNodeMaterial).toBe(true);
    expect(low.flatShading).toBe(true);
    expect(low.roughness).toBe(0.92);
    expect(low.userData.rock).toBeUndefined();
  });

  it('pits a rock material of your own: its node twin, after the hook it has; low leaves it be', () => {
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.95,
    });
    const n = nodes.rockHook(mat, { tier: 'mid' });
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    expect(n.flatShading).toBe(false);
    expect(n.roughness).toBe(0.95);
    expect(n.userData.rock.uRockScale.value).toBe(4);
    const own = new THREE.MeshStandardMaterial();
    expect(nodes.rockHook(own, { tier: 'low' })).toBe(own);
  });
});
