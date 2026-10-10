import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createSky } from './sky';
import { panoramaOf, panoramaUrl } from './skyPanorama';
import { systemById } from './systems';

// the KTX2 loader and the asset base as far as the sky uses them: a texture
// for whatever's asked, by the URL asked
const asked = [];
vi.mock('../../lib/three/gltf', () => ({
  ktx2Loader: async () => ({
    loadAsync: async (url) => {
      asked.push(url);
      return new THREE.DataTexture(new Uint8Array(8 * 4 * 4), 8, 4);
    },
  }),
}));
vi.mock('../../lib/assetBase', () => ({ withFallback: (load) => load }));

const fakeRenderer = () => ({
  coordinateSystem: THREE.WebGLCoordinateSystem,
  autoClear: false,
  toneMapping: THREE.NoToneMapping,
  xr: { enabled: false },
  getRenderTarget: () => null,
  getActiveCubeFace: () => 0,
  getActiveMipmapLevel: () => 0,
  setRenderTarget: () => {},
  render: vi.fn(),
});
const settle = () => new Promise((r) => setTimeout(r, 20));
const bakeUniforms = (sky, r) => {
  let scene = null;
  r.render.mockImplementation((s) => (scene = s));
  sky.bake(r);
  return scene.children[0].material.uniforms;
};

describe('the game’s star fields under the sky', () => {
  it('gives Endor its own, the blockade at Naboo its map’s, the Core and the Outer Rim theirs, and the rest none', () => {
    expect(panoramaOf(systemById('endor'))).toBe('endor');
    expect(panoramaOf(systemById('naboo'))).toBe('rim');
    expect(panoramaOf(systemById('coruscant'))).toBe('core');
    expect(panoramaOf(systemById('hoth'))).toBe('rim');
    expect(panoramaOf(systemById('kashyyyk'))).toBe(null);
    expect(panoramaOf(systemById('kamino'))).toBe(null);
  });

  it('takes the quality level’s width, never wider than the game’s, and none on the lowest', () => {
    expect(panoramaUrl(systemById('endor'), 'ultra')).toBe('/textures/galaxy/sky/space/endor.4096.ktx2');
    expect(panoramaUrl(systemById('endor'), 'high')).toBe('/textures/galaxy/sky/space/endor.2048.ktx2');
    expect(panoramaUrl(systemById('coruscant'), 'mid')).toBe('/textures/galaxy/sky/space/core.1024.ktx2');
    expect(panoramaUrl(systemById('hoth'), 'ultra')).toBe('/textures/galaxy/sky/space/rim.2048.ktx2');
    expect(panoramaUrl(systemById('endor'), 'low')).toBe(null);
    expect(panoramaUrl(systemById('endor'), null)).toBe(null);
  });

  it('bakes it in once it’s here, wrapped round so the seam shows no line', async () => {
    const sky = createSky({ level: 'high' });
    sky.setSystem(systemById('endor'));
    const r = fakeRenderer();
    const u = bakeUniforms(sky, r);
    expect(u.uPanoOn.value).toBe(0);
    await settle();
    // (baked again with it)
    expect(r.render).toHaveBeenCalledTimes(12);
    expect(u.uPanoOn.value).toBe(1);
    expect(u.uPano.value.wrapS).toBe(THREE.RepeatWrapping);
    expect(asked).toContain('/textures/galaxy/sky/space/endor.2048.ktx2');
    sky.dispose();
  });

  it('samples it at its sharpest level, so the seam’s jump in u picks no blurrier one', () => {
    const sky = createSky({ level: 'high' });
    sky.setSystem(systemById('endor'));
    const u = bakeUniforms(sky, fakeRenderer());
    expect(u.uPano).toBeTruthy();
    const scene = new THREE.Scene();
    const r = fakeRenderer();
    r.render.mockImplementation((s) => scene.add(...s.children.map((c) => c.clone())));
    sky.bake(r);
    expect(scene.children[0].material.fragmentShader).toMatch(/textureLod\(uPano, uv, 0\.0\)/);
    sky.dispose();
  });

  it('leaves a system with none as it was: nothing asked, baked once', async () => {
    const before = asked.length;
    const sky = createSky({ level: 'ultra' });
    sky.setSystem(systemById('kashyyyk'));
    const r = fakeRenderer();
    const u = bakeUniforms(sky, r);
    await settle();
    expect(asked.length).toBe(before);
    expect(r.render).toHaveBeenCalledTimes(6);
    expect(u.uPanoOn.value).toBe(0);
    expect(u.uPano.value).toBe(null);
    sky.dispose();
  });

  it('drops a panorama that comes after the system’s changed', async () => {
    const sky = createSky({ level: 'high' });
    sky.setSystem(systemById('endor'));
    sky.setSystem(systemById('kashyyyk'));
    const r = fakeRenderer();
    const u = bakeUniforms(sky, r);
    await settle();
    expect(u.uPanoOn.value).toBe(0);
    expect(r.render).toHaveBeenCalledTimes(6);
    sky.dispose();
  });
});
