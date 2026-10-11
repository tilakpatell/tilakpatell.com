import { describe, expect, it } from 'vitest';
import { readEntry } from './entry';
import * as THREE from 'three/webgpu';
import { PANORAMA_MEET, ZENITH_SHARE, createSky, panoramaGain, skyRadiance, skyUniforms } from './sky';
import { panoramaOf } from './grade';
import hoth from './fixtures/hoth.ve.json';

describe('createSky', () => {
  it('a node material whose uniforms are the record’s scattering and sun', async () => {
    const sky = await createSky(hoth.sunny);
    const p = readEntry(hoth.sunny);
    expect(sky.material.isNodeMaterial).toBe(true);
    expect(sky.material.colorNode).toBeTruthy();
    expect(sky.uniforms.betaR.value.z).toBeCloseTo(3e-5);
    expect(sky.uniforms.betaM.value).toBe(0);
    expect(sky.uniforms.mieG.value).toBe(0.785);
    expect(sky.uniforms.heightR.value).toBe(8000);
    expect(sky.uniforms.luminance.value).toBeCloseTo(p.sky.luminance);
    expect(sky.uniforms.sunDir.value.y).toBeCloseTo(p.sun.dir[1]);
    expect(sky.mesh.frustumCulled).toBe(false);
    sky.set(readEntry(hoth.sunset));
    expect(sky.uniforms.sunColor.value.g).toBeCloseTo(0.28355);
    sky.update({ position: { x: 1, y: 2, z: 3 }, far: 500 });
    expect(sky.mesh.position.y).toBe(2);
    expect(sky.mesh.scale.x).toBe(450);
    sky.dispose();
  });
  it('skyUniforms copies, never shares, the entry’s arrays', () => {
    const p = readEntry(hoth.sunny);
    const u = skyUniforms(p);
    u.betaR[0] = 1;
    expect(p.sky.rayleigh[0]).toBe(1e-5);
  });
});

// Hoth Sunny's panorama's horizon row, linear (scripts/bf2017-picture.mjs measured it)
const HORIZON = [0.734, 0.837, 0.962];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

describe('the painted panorama (lane Q6)', () => {
  it('skyRadiance is the shader’s sky: the zenith at its share of the record’s luminance, the ground below', () => {
    const v = skyUniforms(readEntry(hoth.sunny));
    const zenith = skyRadiance([0, 1, 0], v);
    expect(zenith[1] / (v.luminance * ZENITH_SHARE)).toBeGreaterThan(0.3);
    expect(zenith[1] / (v.luminance * ZENITH_SHARE)).toBeLessThan(3);
    expect(skyRadiance([0, -1, 0], v)[1]).toBeCloseTo(v.ground[1] * v.luminance * ZENITH_SHARE * 0.25);
    // the disc only toward the sun
    expect(lum(skyRadiance(v.sunDir, v))).toBeGreaterThan(lum(skyRadiance(v.sunDir, v, { disc: false })) * 2);
  });
  it('the gain brings the panorama’s horizon to the model’s where they meet, through the calibrated luminance', () => {
    const p = readEntry(hoth.sunny);
    const v = skyUniforms(p);
    const g = panoramaGain(p, HORIZON);
    let s = 0;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const r = Math.sqrt(1 - PANORAMA_MEET ** 2);
      s += lum(skyRadiance([r * Math.sin(a), PANORAMA_MEET, r * Math.cos(a)], v, { disc: false }));
    }
    expect(Math.abs((g * lum(HORIZON)) / (s / 32) - 1)).toBeLessThan(1e-9);
    // (calibrate.js's factor reaches it: twice the sky's luminance, twice the gain)
    expect(panoramaGain({ ...p, sky: { ...p.sky, luminance: p.sky.luminance * 2 } }, HORIZON)).toBeCloseTo(g * 2, 6);
    expect(panoramaGain(p, null)).toBe(1);
  });
  it('createSky takes the panorama behind the disc, its gain following the weather; without one the sky is as it was', async () => {
    const texture = new THREE.Texture();
    const panorama = { ...panoramaOf(hoth.sunny.record), texture, horizon: HORIZON };
    const sky = await createSky(hoth.sunny, { panorama });
    expect(sky.uniforms.panoramaGain.value).toBeCloseTo(panoramaGain(readEntry(hoth.sunny), HORIZON));
    sky.set(readEntry(hoth.sunset));
    expect(sky.uniforms.panoramaGain.value).toBeCloseTo(panoramaGain(readEntry(hoth.sunset), HORIZON));
    sky.dispose();
    const plain = await createSky(hoth.sunny);
    expect(plain.uniforms.panoramaGain.value).toBe(1);
    plain.dispose();
  });
});
