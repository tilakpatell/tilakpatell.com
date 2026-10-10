import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './core';
import * as nodes from './coreNodes';

const tex = () => new THREE.DataTexture(new Uint8Array([200, 180, 160, 255]), 1, 1);
const plain = (v) => (v?.toArray ? v.toArray() : v);

describe('coreNodes, the twin of core', () => {
  it('exports what core exports, but the GLSL string; the kit and its files the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'wearShader').sort());
    expect(nodes.CORE).toBe(glsl.CORE);
    for (const role of Object.keys(glsl.CORE).slice(0, 4)) expect(nodes.coreFiles(role, { xl: true })).toEqual(glsl.coreFiles(role, { xl: true }));
    const mats = { stone: new THREE.MeshStandardMaterial(), glow: new THREE.MeshStandardMaterial(), oak_timber: new THREE.MeshLambertMaterial() };
    expect(nodes.rolesFor(mats)).toEqual(glsl.rolesFor(mats));
  });

  it('wears a scan: a node material, the same uniforms by name and value, once', () => {
    const scan = { map: tex(), normalMap: tex() };
    const a = glsl.wear(new THREE.MeshStandardMaterial(), scan, { metres: 3, strength: 0.4, normal: 0.6, mean: 0.7 });
    const n = nodes.wear(new THREE.MeshStandardMaterial(), scan, { metres: 3, strength: 0.4, normal: 0.6, mean: 0.7 });
    expect(n.isNodeMaterial).toBe(true);
    expect(Object.keys(n.userData.core).sort()).toEqual(Object.keys(a.userData.core).sort());
    for (const k of Object.keys(a.userData.core)) expect(plain(n.userData.core[k].value)).toEqual(plain(a.userData.core[k].value));
    expect(nodes.wear(n, scan)).toBe(n);
    // (a mark a copy doesn't take)
    expect(Object.keys(n.userData)).not.toContain('core');
    expect(n.customProgramCacheKey()).toContain('core:n');
    expect(nodes.wear(new THREE.MeshBasicMaterial(), scan).isNodeMaterial).toBeFalsy(); // (unlit: as it was)
  });

  it('dresses a world’s materials as core does, on stand-ins with `keep`', async () => {
    const scan = { map: tex(), normalMap: tex() };
    const mats = { stone: new THREE.MeshStandardMaterial({ color: 0x808080 }) };
    const done = await nodes.dress(mats, { stone: 'stone' }, { keep: true, load: () => Promise.resolve(scan), tier: 'high' });
    expect(done).toBe(1);
    expect(mats.stone.isNodeMaterial).toBe(true);
    expect(mats.stone.userData.core.uCoreMap.value).toBe(scan.map);
    expect(await nodes.dress({ stone: new THREE.MeshStandardMaterial() }, { stone: 'stone' }, { tier: 'low' })).toBe(0);
  });
});
