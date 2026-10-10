import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './wind';
import * as nodes from './windNodes';

describe('windNodes, the twin of wind', () => {
  it('the same noise picture', () => {
    expect(Array.from(nodes.windNoise(16).image.data)).toEqual(Array.from(glsl.windNoise(16).image.data));
  });

  it('the same uniforms by name and value, moved and set the same', () => {
    const a = glsl.createWind({ strength: 0.3, angle: 1 });
    const n = nodes.createWind({ strength: 0.3, angle: 1 });
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    a.update(0.5);
    n.update(0.5);
    a.set({ strength: 0.7, angle: 2 });
    n.set({ strength: 0.7, angle: 2 });
    expect(n.uniforms.uWindTime.value).toBe(a.uniforms.uWindTime.value);
    expect(n.uniforms.uWindStrength.value).toBe(a.uniforms.uWindStrength.value);
    expect(n.uniforms.uWindDir.value.toArray()).toEqual(a.uniforms.uWindDir.value.toArray());
    expect(typeof n.windOffset).toBe('function');
  });

  it('sways a material once, as a node material keyed by its sway', () => {
    const n = nodes.createWind();
    const m = n.sway(new THREE.MeshLambertMaterial(), { strength: 0.3, height: 2 });
    expect(m.isNodeMaterial).toBe(true);
    expect(m.userData.sway).toBe(n.uniforms);
    expect(m.customProgramCacheKey()).toContain('sway:0.3:2');
    expect(n.sway(m)).toBe(m);
  });
});
