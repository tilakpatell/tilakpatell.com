import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSky } from '../sky';
import { createSkyFog as glslSkyFog } from '../skyfog';
import { skyMaterial } from './sky';
import { createSkyFog } from './skyfog';
import { SITE as BESPIN } from '../sites/bespin';

describe('the sky’s fog as nodes', () => {
  it('the same uniforms, the dome’s own shared', () => {
    const g = glslSkyFog(createSky(BESPIN), THREE.ShaderChunk);
    const sky = skyMaterial(BESPIN);
    const f = createSkyFog(sky);
    expect(Object.keys(f.uniforms).sort()).toEqual(Object.keys(g.uniforms).sort());
    expect(f.uniforms.uSfZenith).toBe(sky.uniforms.uZenith);
    expect(f.uniforms.uSfSunDir).toBe(sky.uniforms.uSunDir);
    f.look({ halo: '#553311', below: 0.7 });
    g.look({ halo: '#553311', below: 0.7 });
    expect(f.uniforms.uSfHalo.value.getHex()).toBe(g.uniforms.uSfHalo.value.getHex());
    expect(f.uniforms.uSfBelowK.value).toBe(0.7);
    f.indoors(true);
    expect(f.uniforms.uSfMix.value).toBe(0);
  });

  it('patches what takes fog once, swaps a classic material for its twin, leaves the rest', () => {
    const f = createSkyFog(skyMaterial(BESPIN));
    const scene = new THREE.Scene();
    const lit = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const noFog = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ fog: false }));
    scene.add(lit, noFog);
    f.scene(scene);
    expect(lit.material.isNodeMaterial).toBe(true);
    expect(lit.material.userData.skyFog).toBe(true);
    expect(lit.material.customProgramCacheKey()).toContain('skyfog');
    expect(noFog.material.userData.skyFog).toBeFalsy();
    const m = lit.material;
    f.scene(scene);
    expect(lit.material).toBe(m);
  });
});
