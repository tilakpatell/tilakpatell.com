import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ATMO, SHELL_FRAG, atmosphereParams, createAtmosphere, skyColoursFor, stepsFor } from './atmosphere';
import { NOISE } from './noiseGlsl';
import * as body from '../../components/galaxy/bodyShaders';

describe('the atmosphere shell', () => {
  it('turns an air description into the shell’s uniforms', () => {
    const p = atmosphereParams({ colour: '#a6ccff', density: 2.2, top: 1.065, falloff: 3.5, glow: 0.8 });
    expect(p.uAtmoP.toArray()).toEqual([1.065, 3.5, 2.2, 0.8]);
    const want = new THREE.Color('#a6ccff');
    expect(p.uAtmo.r).toBeCloseTo(want.r, 6);
    expect(p.uAtmo.b).toBeCloseTo(want.b, 6);
    // (the defaults: a little falloff and a forward glow, a warm sunset)
    const d = atmosphereParams({ colour: '#ffffff' });
    expect(d.uAtmoP.toArray()).toEqual([1.06, 3.5, 2, 0.8]);
    expect(d.uSunset.getHexString()).toBe(new THREE.Color('#ffa070').getHexString());
  });

  it('a shell with one sun has a black second slot', () => {
    const a = createAtmosphere({ radius: 10, colour: '#9fc4ff', suns: [{ dir: [0, 1, 0], colour: '#ffffff' }] });
    const u = a.mesh.material.uniforms;
    expect(u.uSunDir.value[0].toArray()).toEqual([0, 1, 0]);
    expect(u.uSunCol.value[1].getHex()).toBe(0);
    a.set({ suns: [{ dir: [1, 0, 0], colour: [1, 0.5, 0.25] }, { dir: [0, 0, 1], colour: '#ff0000' }], strength: 1.5 });
    expect(u.uSunDir.value[1].toArray()).toEqual([0, 0, 1]);
    expect(u.uSunCol.value[0].toArray()).toEqual([1, 0.5, 0.25]);
    expect(u.uStrength.value).toBe(1.5);
    a.dispose();
  });

  it('marches the steps it is told, the galaxy’s seven by default', () => {
    expect(createAtmosphere({ radius: 1, colour: '#ffffff', steps: 5 }).mesh.material.defines.STEPS).toBe(5);
    expect(createAtmosphere({ radius: 1, colour: '#ffffff' }).mesh.material.defines.STEPS).toBe(7);
    expect(ATMO).toContain('STEPS');
    expect(SHELL_FRAG).toContain('inscatter');
  });

  it('is what the galaxy’s bodies draw with (moved, not copied)', () => {
    expect(body.NOISE).toBe(NOISE);
    expect(body.ATMO).toBe(ATMO);
    expect(body.SHELL_FRAG).toBe(SHELL_FRAG);
  });

  it('can share a body’s uniforms, so the ground and its air read the same sun', () => {
    const shared = { uSunDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3()] } };
    const a = createAtmosphere({ radius: 1, colour: '#ffffff', uniforms: shared });
    expect(a.mesh.material.uniforms.uSunDir).toBe(shared.uSunDir);
  });

  it('finds the planet’s middle as it’s drawn, so it’s right drawn round the camera (universe/relative.js)', () => {
    // a planet's shell where the map is, then the map moved for the draw alone
    const scene = new THREE.Scene();
    const map = new THREE.Group();
    const planet = new THREE.Group();
    planet.position.set(15000, -520, -9000);
    const a = createAtmosphere({ radius: 90, colour: '#9fc4ff' });
    planet.add(a.mesh);
    map.add(planet);
    scene.add(map);
    map.position.set(-15200, 500, 9100);
    scene.updateMatrixWorld();
    a.mesh.onBeforeRender(null, scene, null);
    expect(a.mesh.material.uniforms.uCenter.value.toArray()).toEqual([-200, -20, 100]);
    a.dispose();
  });

  it('a flat air is two bands', () => {
    expect(createAtmosphere({ radius: 1, colour: '#b8ff5a', flat: true }).mesh.material.fragmentShader).toContain('#define FLAT');
    expect(createAtmosphere({ radius: 1, colour: '#b8ff5a' }).mesh.material.fragmentShader).not.toContain('#define FLAT');
  });
});

describe('the sky from the ground', () => {
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const middleEarth = { colour: '#8fc1ff', density: 1.8, top: 1.05 };
  it('a clear blue air gives a blue zenith and a pale horizon at noon', () => {
    const { zenith, horizon, sun } = skyColoursFor(middleEarth, 1);
    expect(zenith[2]).toBeGreaterThan(zenith[0]);
    expect(lum(horizon)).toBeGreaterThan(lum(zenith));
    // (paler: nearer white than the zenith, its colours closer together)
    expect(horizon[0] / horizon[2]).toBeGreaterThan(zenith[0] / zenith[2]);
    expect(sun.every((v) => v > 0.3 && v <= 1)).toBe(true);
  });

  it('at sunset the horizon warms', () => {
    const { horizon, sun } = skyColoursFor(middleEarth, 0.05);
    expect(horizon[0]).toBeGreaterThan(horizon[2]);
    expect(sun[0]).toBeGreaterThan(sun[2]);
    // and with the sun down, the sky goes dark
    const night = skyColoursFor(middleEarth, -0.3);
    expect(lum(night.zenith)).toBeLessThan(lum(skyColoursFor(middleEarth, 1).zenith) * 0.05);
  });
});

describe('the steps an air is marched in', () => {
  it('are what high marches at high, twice at ultra and fewer at mid', () => {
    expect(stepsFor('high', 8)).toBe(8);
    expect(stepsFor('ultra', 8)).toBe(16);
    expect(stepsFor('mid', 8)).toBe(5);
    expect(stepsFor('low', 4)).toBe(3);
  });
});
