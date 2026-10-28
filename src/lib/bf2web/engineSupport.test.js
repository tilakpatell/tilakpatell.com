import { describe, expect, it } from 'vitest';
import { FEATURES, MIN_MEMORY_GB, WHY, engineSupport, probeAdapter, probeBrowser } from './engineSupport.js';

const browser = { gpu: true, isolated: true, sharedMemory: true, wasm: true, deviceMemory: 8, mobile: false };
const desktop = { ...browser, features: [...FEATURES, 'shader-f16'] };

describe('whether a browser can run bf2-web’s engine', () => {
  it('lets a desktop with WebGPU, threads and memory through', () => {
    expect(engineSupport(desktop)).toEqual({ ok: true, missing: [] });
  });

  it('names each thing missing', () => {
    expect(engineSupport({ ...desktop, gpu: false }).missing).toEqual([WHY.gpu]);
    expect(engineSupport({ ...desktop, isolated: false, sharedMemory: false }).missing).toEqual([WHY.isolated, WHY.sharedMemory]);
    expect(engineSupport({ ...desktop, deviceMemory: MIN_MEMORY_GB - 2 }).missing).toEqual([WHY.memory]);
    expect(engineSupport({ ...desktop, mobile: true }).ok).toBe(false);
    expect(engineSupport().missing).toContain(WHY.wasm);
  });

  it('names each GPU feature the engine’s programs need and the adapter hasn’t got', () => {
    // (Hoth’s cooked materials blend with dual sources; its textures are BC)
    expect(engineSupport({ ...desktop, features: ['texture-compression-bc'] }).missing).toEqual([WHY.feature('dual-source-blending')]);
    expect(engineSupport({ ...desktop, features: [] }).missing).toHaveLength(FEATURES.length);
    expect(engineSupport({ ...desktop, gpu: false, features: [] }).missing).toEqual([WHY.gpu]);
  });

  it('asks no isolation of the page before the engine’s', () => {
    expect(engineSupport({ ...desktop, isolated: false, sharedMemory: false }, { beforeIsolation: true })).toEqual({ ok: true, missing: [] });
  });

  it('gives a browser that keeps its memory to itself the benefit of the doubt', () => {
    expect(engineSupport({ ...desktop, deviceMemory: null }).ok).toBe(true);
  });

  it('reads the facts off a window', () => {
    const win = { navigator: { gpu: {}, deviceMemory: 8, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }, crossOriginIsolated: true, SharedArrayBuffer: function SharedArrayBuffer() {}, WebAssembly: {} };
    expect(probeBrowser(win)).toEqual(browser);
    expect(probeBrowser({ navigator: { userAgent: 'iPhone' } })).toMatchObject({ gpu: false, isolated: false, mobile: true, deviceMemory: null });
  });

  it('reads the features off the adapter the engine’s page asks for, and none without one', async () => {
    const asked = [];
    const gpu = (adapter) => ({ requestAdapter: async (opts) => (asked.push(opts), adapter) });
    expect(await probeAdapter(gpu({ features: new Set(FEATURES) }))).toEqual(FEATURES);
    expect(asked).toEqual([{ powerPreference: 'high-performance' }]);
    expect(await probeAdapter(gpu(null))).toEqual([]);
    expect(await probeAdapter({ requestAdapter: async () => { throw new Error('lost'); } })).toEqual([]);
    expect(await probeAdapter(undefined)).toEqual([]);
  });
});
