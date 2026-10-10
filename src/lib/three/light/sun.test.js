import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { BLEND, REF_TEXEL, ULTRA_SHADOW_FAR, biasFor, cascadesFor, createSun, readShadowRecord, splitsFor } from './sun';
import { sunDir } from './entry';
import { raysLight } from './post';
import hoth from './fixtures/hoth.ve.json';

describe('readShadowRecord', () => {
  it('reads the record’s view distances and its shadow sun, flat or nested', () => {
    const r = readShadowRecord(hoth.sunny);
    expect(r.viewDistance).toEqual({ low: 30, mid: 30, high: 30, ultra: 70 });
    expect(r.shadowSun).toEqual([284.42, 82.044]);
    expect(readShadowRecord({ record: { ShadowsComponentData: [{ SunShadowmapViewDistance: { Ultra: 50 } }] } }).viewDistance.ultra).toBe(50);
    expect(readShadowRecord({}).shadowSun).toBe(null);
  });
});

describe('cascadesFor', () => {
  it('four on ultra and high, two on mid, none on low; the far from the record, ultra the site’s own', () => {
    const v = readShadowRecord(hoth.sunny).viewDistance;
    expect(cascadesFor('ultra', v)).toEqual({ n: 4, far: ULTRA_SHADOW_FAR, map: 2048 });
    expect(ULTRA_SHADOW_FAR).toBe(140);
    expect(cascadesFor('high', v)).toEqual({ n: 4, far: 30, map: 2048 });
    expect(cascadesFor('mid', v)).toEqual({ n: 2, far: 30, map: 1024 });
    expect(cascadesFor('low', v)).toEqual({ n: 0, far: 0, map: 0 });
    // (no record: Hoth's)
    expect(cascadesFor('high').far).toBe(30);
  });
});

describe('splitsFor', () => {
  it('runs from near to far, rising, the practical split at lambda 0.5 (CSMShadowNode’s own)', () => {
    const s = splitsFor(0.1, 140, 4);
    expect(s).toHaveLength(5);
    expect(s[0]).toBe(0.1);
    expect(s[4]).toBe(140);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
    // pinned: the four cascades on ultra
    expect(s.map((x) => Number(x.toFixed(2)))).toEqual([0.1, 17.84, 36.9, 63.96, 140]);
  });
  it('lambda 0 is uniform, 1 logarithmic', () => {
    expect(splitsFor(1, 101, 2, 0)[1]).toBeCloseTo(51);
    expect(splitsFor(1, 100, 2, 1)[1]).toBeCloseTo(10);
  });
});

describe('biasFor', () => {
  it('scales the depth and the normal bias with the cascade’s texel', () => {
    const base = { bias: -0.0004, normalBias: 0.02 };
    expect(biasFor(REF_TEXEL, base)).toEqual(base);
    const far = biasFor(REF_TEXEL * 8, base);
    expect(far.bias).toBeCloseTo(-0.0032);
    expect(far.normalBias).toBeCloseTo(0.16);
    // (never under a quarter of the base, so the first cascade does not acne)
    expect(biasFor(REF_TEXEL / 100, base).normalBias).toBeCloseTo(0.005);
  });
});

const fakeBuilder = (camera) => ({ camera, renderer: { coordinateSystem: THREE.WebGPUCoordinateSystem, reversedDepthBuffer: false } });

describe('createSun', () => {
  it('a DirectionalLight casting through four cascades; it lights along the sun and casts along the shadow sun', async () => {
    const sun = await createSun(hoth.sunny, { tier: 'ultra' });
    expect(sun.light.isDirectionalLight).toBe(true);
    expect(sun.light.castShadow).toBe(true);
    const csm = sun.light.shadow.shadowNode;
    expect(csm.cascades).toBe(4);
    expect(csm.maxFar).toBe(ULTRA_SHADOW_FAR);
    // the light's direction is the light's rotation
    const light = sunDir(265.61, 32.943);
    const pos = sun.light.position.clone().sub(sun.light.target.position).normalize();
    expect(pos.y).toBeCloseTo(light[1], 4);
    expect(pos.x).toBeCloseTo(light[0], 4);
    // the shadow's is the shadow rotation
    const shadow = sunDir(284.42, 82.044);
    expect(sun.shadowDir.toArray().map((v) => Number(v.toFixed(4)))).toEqual(shadow.map((v) => Number(v.toFixed(4))));
    // the cascades' cameras look along the shadow sun
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1000);
    camera.updateMatrixWorld();
    const scene = new THREE.Scene();
    scene.add(sun.light, sun.light.target);
    csm._init(fakeBuilder(camera));
    csm.updateBefore();
    for (const lw of csm.lights) {
      const look = lw.position.clone().sub(lw.target.position).normalize();
      expect(look.y).toBeCloseTo(shadow[1], 4);
      expect(look.x).toBeCloseTo(shadow[0], 4);
    }
    // the colour stays the light's
    expect(sun.light.color.b).toBeCloseTo(0.91762);
    // a weather with another shadow sun turns the cascades
    sun.setShadowSun([0, 90]);
    expect(sun.shadowDir.y).toBeCloseTo(1);
    // a new projection refits the cascades
    let refits = 0;
    const fit = csm.updateFrustums.bind(csm);
    csm.updateFrustums = () => (refits++, fit());
    sun.update(camera);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
    sun.update(camera);
    sun.update(camera);
    expect(refits).toBe(1);
    // the cascades' maps freed with the sun
    const freed = [];
    for (const n of csm._shadowNodes) n.dispose = () => freed.push(n);
    sun.dispose();
    expect(freed).toHaveLength(4);
  });
  it('the cascades’ biases from their texels, the near one least', async () => {
    const sun = await createSun(hoth.sunny, { tier: 'ultra' });
    const csm = sun.light.shadow.shadowNode;
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1000);
    new THREE.Scene().add(sun.light);
    csm._init(fakeBuilder(camera));
    const nb = csm.lights.map((l) => l.shadow.normalBias);
    for (let i = 1; i < nb.length; i++) expect(nb[i]).toBeGreaterThan(nb[i - 1]);
    const texel = (l) => (l.shadow.camera.right - l.shadow.camera.left) / l.shadow.mapSize.width;
    expect(csm.lights[3].shadow.normalBias).toBeCloseTo(biasFor(texel(csm.lights[3]), { bias: -0.0004, normalBias: 0.02 }).normalBias, 6);
    expect(BLEND).toBe(0.15);
    // CSMShadowNode's own breaks are splitsFor's
    const s = splitsFor(camera.near, ULTRA_SHADOW_FAR, 4);
    csm.breaks.forEach((b, i) => expect(b * ULTRA_SHADOW_FAR).toBeCloseTo(s[i + 1], 6));
    sun.dispose();
  });
  it('a record without a shadow sun casts along the light; mid two cascades; low none; rays when asked', async () => {
    const one = await createSun({ sky: { suns: [{ az: 90, el: 30 }] } }, { tier: 'mid' });
    expect(one.light.shadow.shadowNode.cascades).toBe(2);
    expect(one.shadowDir.y).toBeCloseTo(0.5);
    expect((await createSun({}, { tier: 'low' })).light.castShadow).toBe(false);
    // lane V's god rays never read the cascades (they have no single map): the rays helper or nothing
    expect(one.light.shadow.shadowNode.isCSMShadowNode).toBe(true);
    expect(raysLight(one)).toBe(null);
    const sun = await createSun({}, { tier: 'ultra', rays: true });
    expect(sun.rays.isDirectionalLight).toBe(true);
    expect(sun.rays.intensity).toBe(0);
    expect(raysLight(sun)).toBe(sun.rays);
    sun.update({ position: { x: 10, y: 2, z: -5 } });
    expect(sun.rays.target.position.x).toBe(10);
  });
});
