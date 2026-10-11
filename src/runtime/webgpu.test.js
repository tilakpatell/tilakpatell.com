import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';

// WebGPURenderer needs a browser; a stand-in records what it was made with
const made = [];
let fallBack = false; // (three's renderer, finding no adapter, on its WebGL 2 backend)
vi.mock('three/webgpu', () => ({
  WebGPURenderer: class {
    constructor(options) {
      this.options = options;
      let destroyed;
      const lost = new Promise((resolve) => (destroyed = resolve));
      this.backend = fallBack ? { isWebGLBackend: true } : { isWebGPUBackend: true, device: { lost } };
      // (a device destroyed on dispose says it's lost, as a real one does)
      this.destroy = () => destroyed({ reason: 'destroyed' });
      this.init = vi.fn(async () => {});
      this.setPixelRatio = vi.fn();
      this.setSize = vi.fn();
      this.dispose = vi.fn(() => this.destroy());
      this.getPixelRatio = vi.fn(() => 1);
      this.setClearColor = vi.fn();
      made.push(this);
    }
  },
}));
vi.mock('../lib/settle', () => ({ settle: (p) => p }));
// the game light's chain is lib/three/light/passes.js's to build (its own test builds every kind)
const built = [];
vi.mock('../lib/three/light/passes.js', () => ({
  buildChain: vi.fn(async (renderer, passes) => {
    const chain = { pipeline: { render: vi.fn() }, dispose: vi.fn(), passes };
    built.push(chain);
    return chain;
  }),
}));

const { adapterLimits, buildPostProcessing, createWebGPU, RAISED_LIMITS } = await import('./webgpu');
const { mipBias, setMipState } = await import('../lib/three/mipBias');

const fakeCanvas = () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() });

describe('createWebGPU', () => {
  beforeEach(() => {
    made.length = 0;
    fallBack = false;
  });

  it('forceWebGL makes the nodes-webgl kind on a WebGL 2 context', async () => {
    const gfx = await createWebGPU(fakeCanvas(), { forceWebGL: true });
    expect(gfx.backend).toBe('nodes-webgl');
    expect(made[0].options.forceWebGL).toBe(true);
  });

  it('tone-maps the house’s way unless a world asks otherwise', async () => {
    await createWebGPU(fakeCanvas());
    expect(made[0].toneMapping).toBe(THREE.NeutralToneMapping);
    await createWebGPU(fakeCanvas(), { toneMapping: THREE.NoToneMapping });
    expect(made[1].toneMapping).toBe(THREE.NoToneMapping);
  });

  it('draws on a reversed depth buffer on a WebGPU device, and on the standard one over WebGL 2 or when asked (lane N2)', async () => {
    const was = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', { value: { gpu: { requestAdapter: async () => ({ limits: { maxColorAttachments: 8 } }) } }, configurable: true });
    try {
      const gfx = await createWebGPU(fakeCanvas());
      expect(made.at(-1).options.reversedDepthBuffer).toBe(true);
      expect(gfx.reversedDepth).toBe(true);
      await createWebGPU(fakeCanvas(), { reversedDepth: false });
      expect(made.at(-1).options.reversedDepthBuffer).toBe(false);
      expect((await createWebGPU(fakeCanvas(), { forceWebGL: true })).reversedDepth).toBe(false);
      expect(made.at(-1).options.reversedDepthBuffer).toBe(false);
      // (asked outright over WebGL 2: the fixture's measurement)
      expect((await createWebGPU(fakeCanvas(), { forceWebGL: true, reversedDepth: true })).reversedDepth).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: was, configurable: true });
    }
    // (no adapter: three falls back to WebGL 2 by itself, so the standard buffer, until measured there)
    await createWebGPU(fakeCanvas());
    expect(made.at(-1).options.reversedDepthBuffer).toBe(false);
  });

  it('without it the kind is webgpu', async () => {
    const canvas = fakeCanvas();
    const gfx = await createWebGPU(canvas);
    expect(gfx.backend).toBe('webgpu');
    expect(made[0].options.forceWebGL).toBe(false);
    expect(canvas.addEventListener).not.toHaveBeenCalled(); // (the device says when it's lost)
  });

  it('a device lost while drawing is reported, and one destroyed by its own dispose is not', async () => {
    const onLost = vi.fn();
    const gfx = await createWebGPU(fakeCanvas(), { onLost });
    made[0].destroy();
    await Promise.resolve();
    expect(onLost).toHaveBeenCalledTimes(1);
    const onLost2 = vi.fn();
    const gfx2 = await createWebGPU(fakeCanvas(), { onLost: onLost2 });
    gfx2.dispose();
    await new Promise((r) => setTimeout(r, 0));
    expect(onLost2).not.toHaveBeenCalled();
    gfx.dispose();
  });

  it('asked for WebGPU but fallen back to WebGL 2 (no adapter), it says so, and listens to the canvas', async () => {
    fallBack = true;
    const onLost = vi.fn();
    const canvas = fakeCanvas();
    const gfx = await createWebGPU(canvas, { onLost });
    expect(gfx.backend).toBe('nodes-webgl');
    const [, handler] = canvas.addEventListener.mock.calls.find((c) => c[0] === 'webglcontextlost');
    handler({ preventDefault() {} });
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('a WebGL 2 context lost is reported through onLost, and the listener goes with the gfx', async () => {
    const onLost = vi.fn();
    const canvas = fakeCanvas();
    const gfx = await createWebGPU(canvas, { forceWebGL: true, onLost });
    const [, handler] = canvas.addEventListener.mock.calls.find((c) => c[0] === 'webglcontextlost');
    const preventDefault = vi.fn();
    handler({ preventDefault });
    expect(onLost).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalled();
    expect(gfx.lost).toBe(true);
    gfx.dispose();
    expect(canvas.removeEventListener).toHaveBeenCalledWith('webglcontextlost', handler);
  });
});

describe('buildPostProcessing', () => {
  it('a chain with the game light’s passes is built by lib/three/light, drawn and disposed through it', async () => {
    const passes = [{ kind: 'render' }, { kind: 'ssgi' }, { kind: 'ao' }, { kind: 'traa' }, { kind: 'output' }];
    const post = buildPostProcessing({}, passes);
    await post.ready;
    const chain = built.at(-1);
    expect(chain.passes).toBe(passes);
    post.render();
    expect(chain.pipeline.render).toHaveBeenCalledTimes(1);
    post.dispose();
    expect(chain.dispose).toHaveBeenCalled();
  });
  it('says whether the chain is temporal, for the mip bias at native (lane N2)', async () => {
    setMipState({ scale: 1, classic: false });
    // (each built before it is let go: a chain's import left resolving past
    // the file's end reached the real passes.js, its mock gone)
    const traa = buildPostProcessing({}, [{ kind: 'render' }, { kind: 'traa' }, { kind: 'output' }]);
    expect(mipBias()).toBe(-0.5);
    await traa.ready;
    traa.dispose();
    const smaa = buildPostProcessing({}, [{ kind: 'render' }, { kind: 'smaa' }, { kind: 'output' }]);
    expect(mipBias()).toBe(0);
    await smaa.ready;
    smaa.dispose();
  });
});

describe('the reference shots’ hooks', () => {
  it('leaves a chain’s TRAA out with temporal off, and keeps it by default', async () => {
    const passes = [{ kind: 'render' }, { kind: 'ao' }, { kind: 'traa' }, { kind: 'output' }];
    built.length = 0;
    const on = await createWebGPU(fakeCanvas());
    await on.post(passes).ready;
    expect(built.at(-1).passes.map((p) => p.kind)).toEqual(['render', 'ao', 'traa', 'output']);
    const off = await createWebGPU(fakeCanvas(), { temporal: false });
    await off.post(passes).ready;
    expect(built.at(-1).passes.map((p) => p.kind)).toEqual(['render', 'ao', 'output']);
  });

  it('jitters through the renderer’s render only once asked', async () => {
    const gfx = await createWebGPU(fakeCanvas());
    const own = vi.fn();
    const renderer = made.at(-1);
    renderer.render = own;
    expect(typeof gfx.jitter).toBe('function');
    expect(renderer.render).toBe(own);
    gfx.jitter(0);
    expect(renderer.render).not.toBe(own);
    gfx.jitter(null);
  });
});

describe('adapterLimits', () => {
  it('asks for the adapter’s own values of the limits a chain can exceed', async () => {
    const gpu = { requestAdapter: async () => ({ limits: { maxColorAttachmentBytesPerSample: 128, maxColorAttachments: 8, maxStorageBuffersPerShaderStage: 10, maxBindGroups: 4 } }) };
    expect(await adapterLimits(gpu)).toEqual({ maxColorAttachmentBytesPerSample: 128, maxColorAttachments: 8, maxStorageBuffersPerShaderStage: 10 });
    expect(RAISED_LIMITS).toContain('maxColorAttachmentBytesPerSample');
  });
  it('is nothing without WebGPU, an adapter, or when the adapter throws', async () => {
    expect(await adapterLimits(undefined)).toBeUndefined();
    expect(await adapterLimits({ requestAdapter: async () => null })).toBeUndefined();
    expect(await adapterLimits({ requestAdapter: async () => { throw new Error('no'); } })).toBeUndefined();
  });
});
