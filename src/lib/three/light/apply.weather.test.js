import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import hoth from './fixtures/hoth.ve.json';
import { readEntry } from './entry';
import { panoramaGain } from './sky';

// (no network: each texture a stand-in named by its url, counted)
const loads = [];
vi.mock('../gltf.js', () => ({
  ktx2Loader: async () => ({
    loadAsync: async (url) => {
      loads.push(url);
      const t = new THREE.DataTexture(new Uint8Array(4), 1, 1);
      t.name = url;
      return t;
    },
  }),
}));
vi.mock('../gameLut.js', () => ({
  loadLut: async (url, n) => {
    loads.push(url);
    const t = new THREE.Data3DTexture(new Uint8Array(n * n * n * 4), n, n, n);
    t.name = url;
    return t;
  },
}));

const { applyGameLight } = await import('./apply');
const fakeRenderer = () => ({ isWebGPURenderer: true, backend: { isWebGPUBackend: true }, library: { addLight() {} }, shadowMap: { enabled: false }, lighting: 'base' });
const urls = (w, horizon) => ({
  lut: { url: `textures/galaxy/bf2017/light/hoth/${w}.lut33.png`, size: 33 },
  panorama: { url: `textures/galaxy/bf2017/light/hoth/${w}.panorama.ktx2`, horizon },
  gradient: { url: `textures/galaxy/bf2017/light/hoth/${w}.gradient.ktx2` },
  cloudShadow: { url: `textures/galaxy/bf2017/light/hoth/${w}.clouds.ktx2` },
});
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('a weather’s crossfade under the record’s picture', () => {
  it('loads the next textures ahead, eases the gain across and swaps the textures and the chain once at the end', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const chains = [];
    const sunny = urls('sunny', [0.7335, 0.8368, 0.962]);
    const sunset = urls('sunset', [0.157, 0.0909, 0.0708]);
    const lit = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'ultra', camera, picture: sunny, onChain: (p) => chains.push(p) });
    expect(lit.parts.picture).toMatchObject({ lut: true, panorama: true, gradient: true, cloudShadow: true, missing: [] });
    const lutOf = () => lit.passes.find((p) => p.kind === 'lut')?.texture?.name;
    expect(lutOf()).toBe('/textures/galaxy/bf2017/light/hoth/sunny.lut33.png');
    const gain0 = lit.parts.sky.uniforms.panoramaGain.value;

    loads.length = 0;
    lit.setWeather(hoth.sunset, 10, { picture: sunset });
    await settle();
    // (ahead: all four asked for at the call, before the fade has moved)
    expect(loads).toHaveLength(4);
    lit.update(5);
    const mid = lit.parts.sky.uniforms.panoramaGain.value;
    lit.update(4.9);
    expect(chains).toHaveLength(0);
    expect(lit.parts.picture.urls.panorama).toBe(sunny.panorama.url);
    lit.update(0.1);
    await settle();
    // (the gain lands on the sunset's own, its model sky against its painted
    // foot, and was between the two half way)
    const end = lit.parts.sky.uniforms.panoramaGain.value;
    expect(end).toBeCloseTo(panoramaGain(readEntry(hoth.sunset), sunset.panorama.horizon), 6);
    expect(gain0).toBeCloseTo(panoramaGain(readEntry(hoth.sunny), sunny.panorama.horizon), 6);
    expect(mid).toBeLessThan(Math.max(gain0, end));
    expect(mid).toBeGreaterThan(Math.min(gain0, end));
    expect(chains).toHaveLength(1);
    expect(lit.parts.picture.urls).toEqual({ lut: sunset.lut.url, panorama: sunset.panorama.url, gradient: sunset.gradient.url, cloudShadow: sunset.cloudShadow.url });
    expect(lutOf()).toBe('/textures/galaxy/bf2017/light/hoth/sunset.lut33.png');
    expect(chains[0]).toBe(lit.passes);
    // (the sunset's own Gaussians in the rebuilt chain)
    expect(lit.passes.find((p) => p.kind === 'bloom')).toMatchObject({ gaussians: true });
    lit.dispose();
  });

  it('shares a texture two weathers name, and drops a picture a newer weather overtook', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const sunny = urls('sunny', [0.7335, 0.8368, 0.962]);
    const lit = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'ultra', camera, picture: sunny });
    loads.length = 0;
    // (the interior names the day's sky: only its LUT is new)
    const inside = { ...sunny, lut: { url: 'textures/galaxy/bf2017/light/hoth/interior.lut33.png', size: 33 } };
    lit.setWeather(hoth.sunset, 10, { picture: urls('sunset', [0.157, 0.0909, 0.0708]) });
    lit.setWeather(hoth.sunny, 0, { picture: inside });
    await settle();
    expect(loads.filter((u) => u.includes('interior'))).toEqual(['/textures/galaxy/bf2017/light/hoth/interior.lut33.png']);
    expect(lit.parts.picture.urls.panorama).toBe(sunny.panorama.url);
    lit.update(10);
    await settle();
    // (the sunset's fade was overtaken: its textures never take hold)
    expect(lit.parts.picture.urls.lut).toBe(inside.lut.url);
    expect(lit.parts.picture.urls.panorama).toBe(sunny.panorama.url);
    lit.dispose();
  });
});
