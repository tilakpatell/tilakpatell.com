import { describe, expect, it } from 'vitest';
import { FEATURES, LIMITS, MIN_MEMORY_GB, WHY, engineSupport, probeAdapter, probeBrowser } from './engineSupport.js';

const browser = { gpu: true, isolated: true, sharedMemory: true, wasm: true, deviceMemory: 8, mobile: false };
// (a desktop's adapter: more than WebGPU's defaults)
const limits = { maxSampledTexturesPerShaderStage: 48, maxSamplersPerShaderStage: 16, maxStorageBuffersPerShaderStage: 10, maxStorageTexturesPerShaderStage: 8, maxUniformBuffersPerShaderStage: 12, maxBindGroups: 4 };
const desktop = { ...browser, features: [...FEATURES, 'shader-f16'], limits };
// main-da7a51b3's, as the adopt step reads them off its programs (scripts/lib/bf2web-site.mjs programNeeds)
const needs = { features: ['dual-source-blending'], limits: { maxSampledTexturesPerShaderStage: 23, maxSamplersPerShaderStage: 8, maxStorageBuffersPerShaderStage: 7, maxStorageTexturesPerShaderStage: 1, maxUniformBuffersPerShaderStage: 3, maxBindGroups: 4 } };

describe('whether a browser can run bf2-web’s engine', () => {
  it('lets a desktop with WebGPU, threads and memory through', () => {
    expect(engineSupport(desktop)).toEqual({ ok: true, missing: [] });
    expect(engineSupport(desktop, { needs })).toEqual({ ok: true, missing: [] });
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
    // (a build's own needs: BC always, and what its programs ask)
    expect(engineSupport({ ...desktop, features: ['texture-compression-bc'] }, { needs: { features: [], limits: {} } }).ok).toBe(true);
  });

  it('turns away a GPU whose limits the build’s programs go over, as an adapter that allows 16 textures a stage', () => {
    // (SwiftShader’s, and WebGPU’s defaults: Hoth’s ten 23-texture materials never get their pipelines, and frame 0 never comes)
    const swiftshader = { ...limits, maxSampledTexturesPerShaderStage: 16, maxStorageTexturesPerShaderStage: 4 };
    expect(engineSupport({ ...desktop, limits: swiftshader }, { needs }).missing).toEqual([WHY.limit('maxSampledTexturesPerShaderStage', 16, 23)]);
    expect(engineSupport({ ...desktop, limits: {} }, { needs }).missing).toHaveLength(Object.keys(needs.limits).length);
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

  it('reads the features and limits off the adapter the engine’s page asks for, and none without one', async () => {
    const asked = [];
    const gpu = (adapter) => ({ requestAdapter: async (opts) => (asked.push(opts), adapter) });
    expect(await probeAdapter(gpu({ features: new Set(FEATURES), limits: { ...limits, maxTextureDimension2D: 16384 } }))).toEqual({ features: FEATURES, limits });
    expect(asked).toEqual([{ powerPreference: 'high-performance' }]);
    expect(Object.keys((await probeAdapter(gpu({ features: new Set(), limits }))).limits)).toEqual(LIMITS);
    expect(await probeAdapter(gpu(null))).toEqual({ features: [], limits: {} });
    expect(await probeAdapter({ requestAdapter: async () => { throw new Error('lost'); } })).toEqual({ features: [], limits: {} });
    expect(await probeAdapter(undefined)).toEqual({ features: [], limits: {} });
  });
});
