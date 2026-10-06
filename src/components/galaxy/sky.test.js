import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { bakeSize, createSky, nebulaeOf } from './sky';
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
