import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { applyGameLight, sunShadowNode } from './apply';
import { readEntry } from './entry';
import hoth from './fixtures/hoth.ve.json';

// a node renderer that cannot draw: enough for the wiring and the dispose
const fakeRenderer = () => ({ isWebGPURenderer: true, backend: { isWebGPUBackend: true }, library: { addLight() {} }, shadowMap: { enabled: false }, lighting: 'base' });
const lights = { cells: { '0,0': [{ kind: 'point', pos: [2, 1, 2], color: [1, 0.8, 0.6], candela: 5000, range: 8 }, { kind: 'spot', pos: [4, 5, 4], dir: [0, -1, 0], cone: [0.4, 0.8], color: [1, 1, 1], candela: 9000, range: 12 }] } };

describe('applyGameLight', () => {
  it('takes the record’s picture only where asked (lane Q6): its tone map, five Gaussians and HBAO; a texture that fails to load is named', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    const plain = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'ultra', camera });
    expect(plain.parts.grade).toBeNull();
    expect(plain.parts.picture).toBeNull();
    expect(plain.passes.map((p) => p.kind)).not.toContain('tonemap');
    plain.dispose();
    const graded = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'ultra', camera, picture: true });
    expect(graded.passes.map((p) => p.kind)).toEqual(['render', 'ssgi', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'tonemap', 'traa', 'output']);
    // (the record's Gaussians keep their own threshold, none)
    expect(graded.passes.find((p) => p.kind === 'bloom')).toMatchObject({ gaussians: true, threshold: 0, strength: 0.1 });
    expect(graded.passes.find((p) => p.kind === 'ao')).toMatchObject({ radius: 1.5, scale: 2 });
    expect(graded.parts.picture).toMatchObject({ lut: false, panorama: false, missing: [] });
    graded.dispose();
    // (no network here: each texture fails, is named, and the rest still lights)
    const urls = { lut: { url: '/nope.lut.png', size: 17 }, panorama: { url: '/nope.ktx2', horizon: [0.7, 0.8, 0.9] } };
    const missing = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'ultra', camera, picture: urls });
    expect(missing.parts.picture.missing).toEqual(expect.arrayContaining(['/nope.lut.png', '/nope.ktx2']));
    expect(missing.passes.map((p) => p.kind)).not.toContain('lut');
    missing.dispose();
    // the classic renderer takes none of it
    const classic = await applyGameLight(scene, { isWebGLRenderer: true, shadowMap: { enabled: false } }, hoth.sunny, { tier: 'ultra', camera, picture: true, post: false });
    expect(classic.parts.grade).toBeNull();
    classic.dispose();
  });
  it('wires the sun, the sky’s hemisphere, the placed lights, the sky, the fog and the chain, and takes them all away', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(3, 2, 3);
    const renderer = fakeRenderer();
    const before = scene.children.length;
    const light = await applyGameLight(scene, renderer, hoth.sunny, { tier: 'ultra', camera, lights });
    const names = scene.children.map((o) => o.name);
    expect(names).toEqual(expect.arrayContaining(['sun', 'sun-rays', 'sky-light', 'placed-lights', 'sky']));
    expect(scene.fogNode).toBeTruthy();
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.lighting.maxLights).toBe(1024);
    expect(light.passes.map((p) => p.kind)).toEqual(['render', 'ssgi', 'ao', 'ssr', 'bloom', 'godrays', 'lensflare', 'motionBlur', 'traa', 'output']);
    expect(light.passes.find((p) => p.kind === 'godrays').light).toBe(light.parts.sun.rays);
    // PCSS on the sun's cascades, the record's 256 on ultra
    expect(light.parts.soft).toMatchObject({ kind: 'pcss', initial: 8, max: 256 });
    expect(typeof light.parts.sun.csm.filter).toBe('function');
    // the record's clouds on the sun's shadow; the shadow term for the particles
    expect(light.parts.clouds.layers.map((l) => l.size)).toEqual([8192, 500]);
    expect(sunShadowNode(light)).toBe(light.shadowTerm);
    expect(light.shadowTerm).toBeTruthy();
    // a contact shadow under a tracked figure
    const walker = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6));
    walker.position.set(3, 0.9, 1);
    scene.add(walker);
    light.track(walker);
    expect(light.parts.contact.planes).toHaveLength(1);
    // the bloom's threshold from the record's ColorGradingMaxHdrValue (calibrate.js)
    expect(light.passes.find((p) => p.kind === 'bloom').threshold).toBe(1);
    light.update(1 / 60, camera);
    // the placed lights in the game's candela times the weather's factor
    expect(light.parts.placed.pools.points[0].intensity).toBeCloseTo(5000 * readEntry(hoth.sunny).gameToSite);
    light.dispose();
    scene.remove(walker);
    expect(scene.children.length).toBe(before);
    expect(scene.fogNode).toBeFalsy();
    expect(renderer.shadowMap.enabled).toBe(false);
    expect(renderer.lighting).toBe('base');
  });
  it('a weather crossfades: halfway, halfway between; at the end, the next', async () => {
    const scene = new THREE.Scene();
    const light = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'high', post: false });
    const day = readEntry(hoth.sunny).sun.intensity;
    const dusk = readEntry(hoth.sunset).sun.intensity;
    light.setWeather(hoth.sunset, 20);
    light.update(10);
    expect(light.parts.sun.light.intensity).toBeCloseTo((day + dusk) / 2);
    light.update(10);
    expect(light.parts.sun.light.intensity).toBeCloseTo(dusk);
    expect(light.parts.sky.uniforms.sunColor.value.g).toBeCloseTo(0.28355);
    light.setWeather(hoth.sunny, 0);
    expect(light.parts.sun.light.intensity).toBeCloseTo(day);
    // the weather's shadow sun comes with it
    light.setWeather({ ...hoth.sunny, record: { ...hoth.sunny.record, OutdoorLightComponentData: [{ ...hoth.sunny.record.OutdoorLightComponentData[0], ShadowSunRotationY: 90 }] } }, 0);
    expect(light.parts.sun.shadowDir.y).toBeCloseTo(1);
    expect(light.passes).toEqual([]);
    light.dispose();
  });
  it('a level’s volumes.json: marched on ultra into the chain, its volumes updated, taken away', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(4, 2, 4);
    const volumetrics = { cells: { '0,0': [{ kind: 'cone', pos: [4, 0, 4], quat: [0, 0, 0, 1], scale: [2, 5, 2], color: [1, 1, 1], exponent: 2, emission: 1 }] } };
    const light = await applyGameLight(scene, fakeRenderer(), hoth.sunny, { tier: 'ultra', camera, lights, volumetrics });
    expect(light.passes.map((p) => p.kind)).toContain('volumes');
    light.update(1 / 60, camera);
    expect(light.parts.volumetrics.lit).toBe(1);
    // (the spot at (4, 5, 4) is the cone's apex: the cone is lit by it)
    expect(light.parts.volumetrics.slots[0].u.lit.value).toBe(1);
    light.dispose();
    expect(scene.getObjectByName('volumetrics')).toBeFalsy();
    const mid = await applyGameLight(new THREE.Scene(), fakeRenderer(), hoth.sunny, { tier: 'mid', camera, volumetrics });
    expect(mid.parts.volumetrics).toBe(null);
  });
  it('on low: no shadow, render and bloom only', async () => {
    const renderer = fakeRenderer();
    const light = await applyGameLight(new THREE.Scene(), renderer, {}, { tier: 'low', camera: new THREE.PerspectiveCamera() });
    expect(renderer.shadowMap.enabled).toBe(false);
    expect(light.parts.sun.light.castShadow).toBe(false);
    expect(sunShadowNode(light)).toBe(null);
    expect(light.parts.clouds).toBe(null);
    expect(light.passes.map((p) => p.kind)).toEqual(['render', 'bloom', 'output']);
  });
});
