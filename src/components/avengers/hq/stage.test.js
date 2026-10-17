import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createStage } from './stage';
import { TIERS } from './tiers';
import { STEPS } from '../../../lib/three/pace';

// the runtime's renderer and its classic post chain, as far as a stage reads them
function fakeRt({ ratio = 1 } = {}) {
  const gl = { MAX_TEXTURE_SIZE: 1, MAX_RENDERBUFFER_SIZE: 2, MAX_VIEWPORT_DIMS: 3, getParameter: (k) => (k === 3 ? [8192, 8192] : 8192) };
  let clear = { hex: 0x123456, alpha: 0 };
  const renderer = {
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    shadowMap: { enabled: false, type: THREE.BasicShadowMap },
    outputColorSpace: THREE.SRGBColorSpace,
    info: { autoReset: true, reset: vi.fn(), render: { calls: 3, triangles: 9 }, memory: { geometries: 1, textures: 2 } },
    getContext: () => gl,
    getPixelRatio: () => ratio,
    getClearColor: (c) => c.setHex(clear.hex),
    getClearAlpha: () => clear.alpha,
    setClearColor: (c, a) => (clear = { hex: new THREE.Color(c).getHex(), alpha: a }),
  };
  const target = () => ({ samples: 0, dispose: vi.fn() });
  const made = [];
  const post = (passes) => {
    made.push(passes);
    const pass = (p) => (p.kind === 'render' ? { camera: p.camera } : p.kind === 'bloom' ? { enabled: true, highPassUniforms: { smoothWidth: { value: 0.01 } } } : { material: { fragmentShader: 'void main() {\n  gl_FragColor = vec4(1.0);\n}' } });
    return {
      composer: { renderTarget1: target(), renderTarget2: target(), readBuffer: {}, setPixelRatio: vi.fn() },
      passes: passes.map(pass),
      render: vi.fn(),
      setSize: vi.fn(),
      dispose: vi.fn(),
    };
  };
  return { rt: { gfx: { renderer, canvas: {}, post, lost: false } }, renderer, made, clearOf: () => clear };
}

describe('the HQ stage on the runtime', () => {
  it('describes its chain to the runtime: the scene, the game’s bloom, the output', () => {
    const { rt, made } = fakeRt();
    const stage = createStage(rt, { bloom: { strength: 0.5, radius: 0.4, threshold: 0.9, knee: 0.2 }, tier: 'high' });
    expect(made[0].map((p) => p.kind)).toEqual(['render', 'bloom', 'output']);
    expect(made[0][1]).toMatchObject({ strength: 0.5, radius: 0.4, threshold: 0.9 });
    expect(stage.bloom.highPassUniforms.smoothWidth.value).toBe(0.2);
    // (the output keeps the canvas opaque)
    expect(made.length).toBe(1);
  });

  it('leaves the shared renderer as it was until it draws, and gives it back when it goes', () => {
    const { rt, renderer, clearOf } = fakeRt();
    const stage = createStage(rt, { exposure: 1.2, tier: 'high' });
    expect(renderer.toneMapping).toBe(THREE.NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);
    expect(renderer.shadowMap.enabled).toBe(false);
    stage.resize(800, 450);
    stage.render();
    expect(renderer.toneMapping).toBe(THREE.NeutralToneMapping);
    expect(renderer.toneMappingExposure).toBe(1.2);
    expect(renderer.shadowMap).toEqual({ enabled: true, type: THREE.PCFShadowMap });
    expect(renderer.info.autoReset).toBe(false);
    expect(clearOf()).toEqual({ hex: 0, alpha: 1 });
    stage.dispose();
    expect(renderer.toneMapping).toBe(THREE.NoToneMapping);
    expect(renderer.toneMappingExposure).toBe(1);
    expect(renderer.shadowMap).toEqual({ enabled: false, type: THREE.BasicShadowMap });
    expect(renderer.info.autoReset).toBe(true);
    expect(clearOf()).toEqual({ hex: 0x123456, alpha: 0 });
  });

  it('takes a game’s exposure as its own, put on the renderer while it draws', () => {
    const { rt, renderer } = fakeRt();
    const stage = createStage(rt, { exposure: 1, tier: 'high' });
    stage.exposure = 0.8; // (a game's chapter, set as it's made)
    expect(renderer.toneMappingExposure).toBe(1);
    stage.resize(800, 450);
    stage.render();
    expect(renderer.toneMappingExposure).toBe(0.8);
    stage.exposure = 1.4; // (and as it plays)
    expect(renderer.toneMappingExposure).toBe(1.4);
    expect(stage.exposure).toBe(1.4);
    stage.dispose();
    expect(renderer.toneMappingExposure).toBe(1);
  });

  it('draws its chain at the canvas’s sharpness, which is the runtime’s', () => {
    let ratio = 1.5;
    const { rt, renderer, made } = fakeRt();
    renderer.getPixelRatio = () => ratio;
    const posts = [];
    const post = rt.gfx.post;
    rt.gfx.post = (passes) => {
      const p = post(passes);
      posts.push(p);
      return p;
    };
    const stage = createStage(rt, { tier: 'high' });
    stage.resize(800, 450);
    expect(stage.info().size).toEqual({ w: 800, h: 450 });
    expect(posts[0].composer.setPixelRatio).toHaveBeenLastCalledWith(1.5);
    // (the governor softens the canvas: the chain follows it at the next frame)
    ratio = 1.2;
    stage.render();
    expect(posts[0].composer.setPixelRatio).toHaveBeenLastCalledWith(1.2);
    expect(made.length).toBe(1);
  });

  it('steps a tier down a level, in the watchdog’s order, and says slow past the pace’s last step', () => {
    const onSlow = vi.fn();
    const { rt, made } = fakeRt();
    const stage = createStage(rt, { tier: 'high', onSlow });
    stage.resize(800, 450);
    expect(stage.tier).toBe('high');
    expect(stage.sun.shadow.mapSize.x).toBe(TIERS.high.shadow);
    stage.lowerQuality(1);
    expect(stage.tier).toBe('medium');
    expect(stage.sun.shadow.mapSize.x).toBe(TIERS.medium.shadow);
    stage.lowerQuality(2);
    expect(stage.tier).toBe('low');
    expect(stage.bloom.enabled).toBe(false);
    expect(stage.small).toBe(true);
    expect(onSlow).not.toHaveBeenCalled();
    stage.lowerQuality(STEPS.length);
    stage.lowerQuality(STEPS.length + 1);
    expect(onSlow).toHaveBeenCalledTimes(1);
    expect(made.length).toBe(1);
  });

  it('starts the chain’s targets at the tier’s samples', () => {
    const { rt } = fakeRt();
    const stage = createStage(rt, { tier: 'low' });
    stage.lowerQuality(0);
    expect(stage.tier).toBe('low');
  });

  it('gives its ?debug groups to the runtime’s panel: the bloom, the house, the game’s', () => {
    const { rt } = fakeRt();
    const stage = createStage(rt, { tier: 'high' });
    stage.tune([{ title: 'Feel', items: [] }]);
    const groups = stage.tuneGroups();
    expect(groups.at(-1)).toEqual({ title: 'Feel', items: [] });
    expect(groups.length).toBeGreaterThan(2);
  });
});
