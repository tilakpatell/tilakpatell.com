import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { groundMaterial } from './ground';
import { createGroundMap } from '../../../lib/three/groundmap';
import { HALF } from './terrain';

const site = { ground: { seed: 1, palette: { low: '#806040', high: '#608040' } } };
const compiled = (m) => {
  const sh = { vertexShader: THREE.ShaderChunk.meshphysical_vert, fragmentShader: THREE.ShaderChunk.meshphysical_frag, uniforms: {} };
  m.material.onBeforeCompile(sh, null);
  return sh;
};

describe('the floor', () => {
  it('reads the ground map’s colour inside the walkable square, under its own grain', () => {
    const map = createGroundMap({ area: { x0: -HALF, z0: -HALF, w: 2 * HALF, d: 2 * HALF }, size: 4, paint: (x, z, out) => ((out[0] = out[1] = out[2] = 0.5), 0) });
    const sh = compiled(groundMaterial(site, { small: true, map }));
    expect(sh.uniforms.uGroundMap).toBe(map.uniforms.uGroundMap);
    const fs = sh.fragmentShader;
    expect(fs).toContain('groundColour(xz)');
    // (the map's colour before the grain and the scan, so they still show up close)
    expect(fs.indexOf('groundColour(xz)')).toBeLessThan(fs.indexOf('// grain close up'));
    expect(fs.split('uniform sampler2D uGroundMap;').length).toBe(2);
    map.dispose();
  });

  it('keeps its own rule without a map', () => {
    const fs = compiled(groundMaterial(site, { small: true })).fragmentShader;
    expect(fs).not.toContain('groundColour(');
  });
});

describe('the floor by the lava', () => {
  it('glows on the bank, by how near the lava is (the lava field’s G)', () => {
    const tex = new THREE.DataTexture(new Uint8Array(8), 2, 2, THREE.RGFormat);
    const m = groundMaterial(site, { small: true, lava: { texture: tex, half: 640, reach: 8 } });
    const sh = compiled(m);
    expect(sh.uniforms.uLavaField.value).toBe(tex);
    expect(sh.fragmentShader).toContain('uLavaField');
    expect(m.material.customProgramCacheKey()).toContain('lava');
  });

  it('no glow where there is no lava', () => {
    const sh = compiled(groundMaterial(site, { small: true }));
    expect(sh.fragmentShader).not.toContain('uLavaField');
  });
});
