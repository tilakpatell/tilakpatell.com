import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { bakeSize, createSky, nebulaeOf, starCount } from './sky';
import FIXTURE from './__fixtures__/sky.json';
import { SYSTEMS, systemById } from './systems';

// a renderer as far as the bake uses it: where it draws to, what it draws
const fakeRenderer = () => {
  const before = new THREE.WebGLRenderTarget(4, 4);
  return {
    before,
    coordinateSystem: THREE.WebGLCoordinateSystem,
    autoClear: false,
    toneMapping: THREE.ACESFilmicToneMapping,
    xr: { enabled: false },
    target: before,
    getRenderTarget() {
      return this.target;
    },
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: vi.fn(function (t) {
      this.target = t;
    }),
    render: vi.fn(function () {
      this.drew = { autoClear: this.autoClear, toneMapping: this.toneMapping };
    }),
  };
};

describe('the nebulae', () => {
  it('gives each system three nebulae of its own, the same every time', () => {
    const a = nebulaeOf(systemById('hoth')), b = nebulaeOf(systemById('hoth')), c = nebulaeOf(systemById('naboo'));
    expect(a).toHaveLength(3); expect(a).toEqual(b); expect(a).not.toEqual(c);
    for (const n of a) { expect(Math.hypot(...n.dir)).toBeCloseTo(1, 5); expect(n.size).toBeGreaterThanOrEqual(0.18); expect(n.size).toBeLessThanOrEqual(0.45); }
  });

  it('gives every system colours and warps in range', () => {
    for (const s of SYSTEMS) {
      for (const n of nebulaeOf(s)) {
        expect(n.color).toMatch(/^#[0-9a-f]{6}$/);
        expect(n.warp).toBeGreaterThanOrEqual(0.6);
        expect(n.warp).toBeLessThanOrEqual(1.6);
        expect(n.size).toBeGreaterThanOrEqual(0.18);
        expect(n.size).toBeLessThanOrEqual(0.45);
      }
    }
  });
});

describe('the bake', () => {
  it('sizes its bake by the tier', () => { expect(bakeSize({ small: false })).toBe(1024); expect(bakeSize({ small: true })).toBe(512); });

  it('draws black until it is baked, then the cube; six faces, and the renderer left as it was', () => {
    const sky = createSky({ small: true });
    const look = sky.group.children[0].material.uniforms.uSky;
    expect(look.value).toBe(null);
    sky.setSystem(systemById('hoth'));
    const r = fakeRenderer();
    sky.bake(r);
    expect(r.render).toHaveBeenCalledTimes(6);
    expect(r.drew).toEqual({ autoClear: true, toneMapping: THREE.NoToneMapping });
    expect(look.value?.isCubeTexture).toBe(true);
    expect(look.value.image[0].width).toBe(512);
    expect(r.target).toBe(r.before);
    expect(r.autoClear).toBe(false);
    expect(r.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    sky.dispose();
  });

  it('bakes into the renderer it was made with, and not at all once disposed', () => {
    const r = fakeRenderer();
    const sky = createSky({ renderer: r });
    sky.setSystem(systemById('tatooine'));
    sky.bake();
    expect(r.render).toHaveBeenCalledTimes(6);
    sky.dispose();
    sky.bake();
    sky.bake(fakeRenderer());
    expect(r.render).toHaveBeenCalledTimes(6);
  });

  it('has its shader made and linking before the first bake, against the cube it bakes into', async () => {
    const r = fakeRenderer();
    let into = null;
    r.compile = vi.fn((scene) => {
      into = r.target;
      const mats = new Set();
      scene.traverse((o) => o.material && mats.add(o.material));
      return mats;
    });
    r.properties = { get: () => ({ currentProgram: { isReady: () => true } }) };
    r.getContext = () => ({ isContextLost: () => false });
    const sky = createSky({ small: true, renderer: r });
    await sky.prepare();
    expect(r.compile).toHaveBeenCalledTimes(1);
    expect(into?.isWebGLCubeRenderTarget).toBe(true); // (the shader it bakes with: drawn to a target, no tone mapping)
    expect([...r.compile.mock.results[0].value].map((m) => m.isShaderMaterial)).toEqual([true]);
    expect(r.target).toBe(r.before); // (the renderer left as it was)
    expect(r.render).not.toHaveBeenCalled(); // (nothing drawn)
    sky.dispose();
    await sky.prepare();
    expect(r.compile).toHaveBeenCalledTimes(1);
  });
});

// the sky as it was before its fidelity went up (__fixtures__/sky.json: the
// bake's uniforms, and a hash of the first 4,200 stars, rounded); Hoth's and Tatooine's third nebula
// has since become the atlas's own nearest one (landmarks.js: the Ivax
// Nebula and the Kaliida Nebula), and the fixture's with it
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const r2 = (v) => Math.round(v * 100) / 100;
const fnv = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16);
};
const starsOf = (sky) => sky.group.children.find((c) => c.isPoints && c.geometry.attributes.position.count > 1000).geometry.attributes;
const hashStars = (g, n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = [g.position.getX(i), g.position.getY(i), g.position.getZ(i), g.aSize.getX(i), g.aColor.getX(i), g.aColor.getY(i), g.aColor.getZ(i)].map(r4);
    out.push([r2(s[0]), r2(s[1]), r2(s[2]), r2(s[3] * 100) / 100, r2(s[4] * 100) / 100, r2(s[5] * 100) / 100, r2(s[6] * 100) / 100]);
  }
  return fnv(JSON.stringify(out));
};
const SYSTEM_OF = { hoth: () => systemById('hoth'), tatooine: () => systemById('tatooine'), 'kashyyyk-borrowed': () => ({ ...systemById('kashyyyk'), suns: [] }) };
const ser = (v) => (Array.isArray(v) ? v.map(ser) : typeof v === 'number' ? r4(v) : v.toArray().map(r4));

describe('its fidelity', () => {
  it('sizes the bake by level', () => {
    expect(bakeSize({ small: true, level: 'ultra' })).toBe(512);
    expect(bakeSize({ level: 'ultra' })).toBe(2048);
    expect(bakeSize({ level: 'high' })).toBe(1536);
    expect(bakeSize({ level: 'mid' })).toBe(1024);
    expect(bakeSize({ level: 'low' })).toBe(512);
    expect(bakeSize({ small: false })).toBe(1024);
    expect(bakeSize({ small: true })).toBe(512);
  });

  it('counts the stars by level', () => {
    expect(starCount({ level: 'ultra' })).toBe(12000);
    expect(starCount({ level: 'high' })).toBe(12000);
    expect(starCount({ level: 'mid' })).toBe(7000);
    expect(starCount({ level: 'low' })).toBe(3000);
    expect(starCount({ small: true, level: 'high' })).toBe(3000);
  });

  it('looks as it did: the same bake, and the same first 4,200 stars', () => {
    for (const [id, want] of Object.entries(FIXTURE)) {
      // (a borrowed sky is made as its borrowers make it, the universe map and the Rick and Morty page: beacons off)
      const sky = createSky({ level: 'high', beacons: id !== 'kashyyyk-borrowed' });
      sky.setSystem(SYSTEM_OF[id]());
      const r = fakeRenderer();
      let scene = null;
      r.render = vi.fn((s) => (scene = s));
      sky.bake(r);
      const un = scene.children[0].material.uniforms;
      for (const [k, v] of Object.entries(want.uniforms)) expect(ser(un[k].value), `${id} ${k}`).toEqual(v);
      const g = starsOf(sky);
      expect(g.position.count).toBe(12000);
      expect(hashStars(g, 4200), id).toBe(want.stars.hash);
      sky.dispose();
    }
  });

  it('bakes without mipmaps (the sky is only ever magnified)', () => {
    const sky = createSky({ level: 'ultra' });
    sky.setSystem(systemById('hoth'));
    sky.bake(fakeRenderer());
    const tex = sky.group.children[0].material.uniforms.uSky.value;
    expect(tex.generateMipmaps).toBe(false);
    expect(tex.minFilter).toBe(THREE.LinearFilter);
    expect(tex.image[0].width).toBe(2048);
    sky.dispose();
  });

  it('draws the stars past today\'s fainter, for depth rather than a new pattern', () => {
    const sky = createSky({ level: 'high' });
    sky.setSystem(systemById('hoth'));
    const g = starsOf(sky);
    const mean = (a, b) => {
      let s = 0;
      for (let i = a; i < b; i++) s += g.aColor.getX(i) + g.aColor.getY(i) + g.aColor.getZ(i);
      return s / (b - a);
    };
    expect(mean(4200, 12000)).toBeLessThan(mean(0, 4200) * 0.8);
    sky.dispose();
  });
});
