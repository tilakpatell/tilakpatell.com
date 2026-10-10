import { describe, expect, it } from 'vitest';
import * as glsl from './groundLook';
import * as nodes from './groundLookNodes';
import { createGroundMap } from './groundmapNodes';

const site = {
  ground: {
    wind: 0.5,
    palette: { low: '#d2b083', high: '#ebd4a6', rock: '#a46a4e', accent: '#c69a6c', hLow: -4, hHigh: 12, rockAt: 0.36, accentCover: 0.22, ripple: { strength: 0.09, scale: 3.2 }, grain: 0.6, sparkle: 0.2, wet: { level: 1, band: 2, color: '#332211' }, roughness: 0.9 },
  },
};
const plain = (v) => (v?.toArray ? v.toArray() : Array.isArray(v) ? v.map(plain) : v);

describe('groundLookNodes, the twin of groundLook', () => {
  it('the same material: standard, white, the palette’s roughness, no metal', () => {
    const a = glsl.groundMaterial(site, { half: 300 });
    const n = nodes.groundMaterial(site, { half: 300 });
    expect(n.material.isMeshStandardNodeMaterial).toBe(true);
    for (const k of ['roughness', 'metalness', 'transparent', 'side', 'depthWrite']) expect(n.material[k]).toBe(a.material[k]);
    expect(n.material.color.getHex()).toBe(0xffffff);
  });

  it('the same uniforms by name, the same values where the GLSL set one', () => {
    const a = glsl.groundMaterial(site, { half: 300, small: true });
    const n = nodes.groundMaterial(site, { half: 300, small: true });
    expect(Object.keys(n.uniforms).sort()).toEqual(Object.keys(a.uniforms).sort());
    // (the textures the GLSL left null until loaded start as blanks: a texture node needs a picture)
    const textures = ['uMarks', 'uNoise', 'uScan', 'uScanN', 'uMacro', 'uSteep', 'uSteepN', 'uDecal'];
    for (const k of Object.keys(a.uniforms).filter((k) => !textures.includes(k))) expect(plain(n.uniforms[k].value)).toEqual(plain(a.uniforms[k].value));
    for (const k of textures) expect(n.uniforms[k].value?.isTexture).toBe(true);
    expect(n.uniforms.uNoise.value).toBe(a.uniforms.uNoise.value); // (the shared noise tile)
  });

  it('the marks are set as before, and the program keyed by the map and the layers', () => {
    const n = nodes.groundMaterial(site, {});
    const t = { isTexture: true };
    n.uniforms.uMarks.value = t;
    expect(n.uniforms.uMarks.value).toBe(t);
    expect(n.material.customProgramCacheKey()).toContain('|galaxy-ground:');
    const map = createGroundMap({ area: { x0: 0, z0: 0, w: 1, d: 1 }, size: 2, paint: () => 1 });
    expect(nodes.groundMaterial(site, { map }).material.customProgramCacheKey()).toContain('galaxy-ground:map');
  });
});
