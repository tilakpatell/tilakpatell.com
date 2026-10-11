import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import hoth from '../../../data/bf2017/light/hoth.json';
import { siteLightFrom } from '../../../lib/three/gameLight';
import { createGameLit } from './gameLit';

function rig() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#e2eaf3', 0.0011);
  scene.environmentIntensity = 0.4;
  // (the scene as gameSite builds it: under Hoth's sunny light)
  const sun = new THREE.DirectionalLight('#ffffff', siteLightFrom(hoth.weathers.sunny).light.sun);
  const hemi = new THREE.HemisphereLight('#9fbce6', '#e6edf6', 0.9);
  const sky = {
    uniforms: {
      uZenith: { value: new THREE.Color('#6f98c8') },
      uHorizon: { value: new THREE.Color('#e4ecf4') },
      uHaze: { value: new THREE.Color('#eef3f9') },
      uSunColor: { value: [new THREE.Color('#fff4e6')] },
      uSunDir: { value: [new THREE.Vector3(0, 1, 0)] },
    },
  };
  const loaded = [];
  const envs = [];
  const probes = {
    load: vi.fn(async (urls) => {
      loaded.push(urls);
      const env = { name: urls[0], dispose: vi.fn() };
      envs.push(env);
      return env;
    }),
    dispose: vi.fn(),
  };
  const post = { grading: vi.fn() };
  const lutLoad = vi.fn(async (u, n) => ({ u, n, dispose: vi.fn() }));
  const reframe = vi.fn();
  const lit = createGameLit({ light: hoth, scene, sun, hemi, sky, post, probes, lutLoad, reframe, url: (u) => u });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { scene, sun, hemi, sky, loaded, envs, probes, post, lutLoad, reframe, lit, settle };
}

describe('a world under the game’s light, running', () => {
  it('is nothing for a world without a record', () => {
    expect(createGameLit({ light: undefined })).toBeNull();
  });

  it('reflects the level’s outdoor probe, exposed as the light is', async () => {
    const r = rig();
    await r.settle();
    expect(r.loaded[0]).toEqual(['px', 'nx', 'py', 'ny', 'pz', 'nz'].map((f) => `/textures/galaxy/bf2017/light/hoth/sunny.${f}.hdr`));
    expect(r.scene.environment).toBe(r.envs[0]);
    expect(r.scene.environmentIntensity).toBeCloseTo(0.4 * siteLightFrom(hoth.weathers.sunny).probeScale, 6);
    expect(r.post.grading).toHaveBeenLastCalledWith({ lut: expect.objectContaining({ u: '/textures/galaxy/bf2017/light/hoth/sunny.lut.png', n: 33 }), size: 33 });
  });

  it('takes the room’s probe and the interior’s grade indoors, and the outdoor ones back', async () => {
    const r = rig();
    await r.settle();
    r.lit.zone({ id: 'echo' });
    await r.settle();
    expect(r.loaded.at(-1)[0]).toBe('/textures/galaxy/bf2017/light/hoth/indoor.px.hdr');
    expect(r.post.grading.mock.lastCall[0].lut.u).toBe('/textures/galaxy/bf2017/light/hoth/interior.lut.png');
    r.lit.zone(null);
    await r.settle();
    expect(r.loaded.at(-1)[0]).toBe('/textures/galaxy/bf2017/light/hoth/sunny.px.hdr');
    expect(r.sun.intensity).toBeCloseTo(siteLightFrom(hoth.weathers.sunny).light.sun);
  });

  it('fades into dusk over 20 s, the sun moving and the probe and grade changing half way', async () => {
    const r = rig();
    await r.settle();
    const noon = r.sun.intensity;
    const dusk = siteLightFrom(hoth.weathers.sunset);
    expect(r.lit.weather('dusk')).toBe(true);
    r.lit.step(5);
    expect(r.sun.intensity).toBeGreaterThan(noon);
    expect(r.sun.intensity).toBeLessThan(dusk.light.sun);
    expect(r.reframe).not.toHaveBeenCalled();
    r.lit.step(5);
    await r.settle();
    expect(r.reframe).toHaveBeenCalledTimes(1);
    expect(r.sky.uniforms.uSunDir.value[0].y).toBeCloseTo(Math.sin(dusk.sky.suns[0].el), 3);
    expect(r.loaded.at(-1)[0]).toBe('/textures/galaxy/bf2017/light/hoth/sunset.px.hdr');
    r.lit.step(10);
    expect(r.sun.intensity).toBeCloseTo(dusk.light.sun);
    expect('#' + r.sun.color.getHexString()).toBe(dusk.sky.suns[0].color);
    expect(r.lit.debug()).toMatchObject({ weather: 'sunset', fading: false });
  });

  it('says no to a weather the level hasn’t, and keeps its own', () => {
    const r = rig();
    expect(r.lit.weather('clear')).toBe(false);
  });

  it('lets its probe and grade go when it goes', async () => {
    const r = rig();
    await r.settle();
    r.lit.dispose();
    expect(r.probes.dispose).toHaveBeenCalled();
    expect(r.post.grading).toHaveBeenLastCalledWith(null);
  });
});

describe('the worlds the game has no record for', () => {
  it('keep their own sky and light exactly', async () => {
    const { siteOf } = await import('./sites/index');
    const { gameSite } = await import('../../../lib/three/gameLight');
    const { gameLightOf } = await import('../../../data/bf2017/light/index');
    for (const id of ['nevarro', 'mandalore', 'sorgan', 'lothal', 'coruscant', 'dagobah', 'mustafar']) {
      const site = siteOf(id);
      expect(site, id).toBeTruthy();
      expect(gameLightOf(site), id).toBeNull();
      expect(gameSite(site, gameLightOf(site), 'clear'), id).toBe(site);
    }
  });
});

describe('a zone left before its probe and grade arrive', () => {
  it('ends outdoors with the outdoor probe and grade, whatever lands late', async () => {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#ffffff', 0.001);
    const sun = new THREE.DirectionalLight('#ffffff', 1);
    const hemi = new THREE.HemisphereLight();
    const sky = { uniforms: { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uSunColor: { value: [new THREE.Color()] }, uSunDir: { value: [new THREE.Vector3()] } } };
    const pending = [];
    const later = (v) => new Promise((r) => pending.push(() => r(v)));
    const flush = async () => {
      while (pending.length) pending.shift()();
      await new Promise((r) => setTimeout(r, 0));
    };
    // (a holder that answers at once for what it has, late for anything new)
    let have = null;
    const probes = { load: vi.fn((urls) => (have === urls[0] ? Promise.resolve({ name: urls[0] }) : later({ name: urls[0] }).then((e) => ((have = urls[0]), e)))), dispose: vi.fn() };
    const post = { grading: vi.fn() };
    const lutLoad = vi.fn((u) => later({ u }));
    const lit = createGameLit({ light: hoth, scene, sun, hemi, sky, post, probes, lutLoad, url: (u) => u });
    await flush();
    lit.zone({ id: 'echo' });
    lit.zone(null);
    await flush();
    expect(scene.environment.name).toBe('/textures/galaxy/bf2017/light/hoth/sunny.px.hdr');
    expect(post.grading.mock.lastCall[0].lut.u).toBe('/textures/galaxy/bf2017/light/hoth/sunny.lut.png');
  });
});
