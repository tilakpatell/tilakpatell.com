import { describe, expect, it } from 'vitest';
import { ADVICE, FEATURES, LIMITS, MIN_CORES, MIN_MEMORY_GB, WHY, advice, engineSupport, probeAdapter, probeBrowser } from './engineSupport.js';
import play from '../../data/bf2web/play.json';

const browser = { gpu: true, isolated: true, sharedMemory: true, wasm: true, deviceMemory: 8, cores: null, mobile: false };
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

  it('holds a build that sends its own floor to it: 16 textures a stage where its renderer packs Hoth’s 23', () => {
    // (main-32a7a627's, as the adopt step reads them off its page, scripts/lib/bf2web-site.mjs floorNeeds)
    const floor = { features: ['texture-compression-bc'], limits: { maxTextureDimension2D: 8192, maxBufferSize: 268435456, maxStorageBufferBindingSize: 134217728, maxBindGroups: 4, maxSampledTexturesPerShaderStage: 16, maxSamplersPerShaderStage: 8, maxStorageTexturesPerShaderStage: 5, maxStorageBuffersPerShaderStage: 10, maxUniformBuffersPerShaderStage: 3 } };
    const laptop = { ...desktop, features: ['texture-compression-bc'], limits: { ...limits, maxSampledTexturesPerShaderStage: 16, maxTextureDimension2D: 16384, maxBufferSize: 2 ** 31, maxStorageBufferBindingSize: 2 ** 31 } };
    expect(engineSupport(laptop, { needs: floor })).toEqual({ ok: true, missing: [] });
    expect(engineSupport({ ...laptop, limits: { ...laptop.limits, maxStorageBuffersPerShaderStage: 8 } }, { needs: floor }).missing).toEqual([WHY.limit('maxStorageBuffersPerShaderStage', 8, 10)]);
  });

  it('turns away a software GPU and too few cores, as the engine’s page does', () => {
    expect(engineSupport({ ...desktop, software: true }).missing).toEqual([WHY.software]);
    expect(engineSupport({ ...desktop, cores: MIN_CORES - 2 }).missing).toEqual([WHY.cores]);
    expect(engineSupport({ ...desktop, cores: MIN_CORES }).ok).toBe(true);
  });

  it('asks no isolation of the page before the engine’s', () => {
    expect(engineSupport({ ...desktop, isolated: false, sharedMemory: false }, { beforeIsolation: true })).toEqual({ ok: true, missing: [] });
  });

  it('gives a browser that keeps its memory to itself the benefit of the doubt', () => {
    expect(engineSupport({ ...desktop, deviceMemory: null }).ok).toBe(true);
  });

  it('reads the facts off a window', () => {
    const win = { navigator: { gpu: {}, deviceMemory: 8, userAgent: 'Mozilla/5.0 (Windows NT 10.0)' }, crossOriginIsolated: true, SharedArrayBuffer: function SharedArrayBuffer() {}, WebAssembly: {} };
    expect(probeBrowser(win)).toEqual({ ...browser, os: 'windows' });
    expect(probeBrowser({ navigator: { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15', platform: 'MacIntel' } }).os).toBe('macos');
    expect(probeBrowser({ navigator: { userAgentData: { platform: 'macOS', mobile: false } } }).os).toBe('macos');
    expect(probeBrowser({ navigator: { userAgent: 'iPhone' } })).toMatchObject({ gpu: false, isolated: false, mobile: true, deviceMemory: null });
  });

  it('reads the features and limits off the adapter the engine’s page asks for, and none without one', async () => {
    const asked = [];
    const gpu = (adapter) => ({ requestAdapter: async (opts) => (asked.push(opts), adapter) });
    expect(await probeAdapter(gpu({ features: new Set(FEATURES), limits: { ...limits, maxTextureDimension2D: 16384, maxComputeInvocationsPerWorkgroup: 1024 } }))).toEqual({ features: FEATURES, limits: { ...limits, maxTextureDimension2D: 16384 }, software: false });
    expect(asked).toEqual([{ powerPreference: 'high-performance' }]);
    // (a fallback adapter, or SwiftShader named in its info)
    expect((await probeAdapter(gpu({ features: new Set(), limits, isFallbackAdapter: true }))).software).toBe(true);
    expect((await probeAdapter(gpu({ features: new Set(), limits, info: { description: 'Google SwiftShader' } }))).software).toBe(true);
    expect(Object.keys((await probeAdapter(gpu({ features: new Set(), limits }))).limits)).toEqual(LIMITS);
    expect(await probeAdapter(gpu(null))).toEqual({ features: [], limits: {}, software: false });
    expect(await probeAdapter({ requestAdapter: async () => { throw new Error('lost'); } })).toEqual({ features: [], limits: {}, software: false });
    expect(await probeAdapter(undefined)).toEqual({ features: [], limits: {}, software: false });
  });

  // 2026-11-03: r1055's needs named maxVertexAttributes (12) and maxInterStageShaderVariables (14), which the probe never
  // read, so every GPU was turned away with "the GPU allows no where the engine needs 12" (the owner's MacBook Pro M3 Pro
  // in Edge among them). WebGPU's defaults for both are 16, which every adapter meets.
  describe('a Mac (Edge or Chrome: Dawn on Metal) against the build the site serves', () => {
    // a GPUSupportedLimits as browsers make it: every limit a getter on its prototype, no own properties
    const supportedLimits = (values) => {
      class GPUSupportedLimits {}
      for (const [k, v] of Object.entries(values)) Object.defineProperty(GPUSupportedLimits.prototype, k, { get: () => v });
      return new GPUSupportedLimits();
    };
    // (the shape Dawn's Metal backend reports on Apple silicon, PhysicalDeviceMTL.mm; not a measured Mac. The compute workgroup
    // limits: Apple 4-9 and Mac 2 families have maxThreadsPerThreadgroup 1024 and maxTotalThreadgroupMemory 32768, which
    // Dawn's limit tiers, Limits.cpp, report as 1024 / 1024 / 64 and 32768)
    const m3 = {
      maxTextureDimension2D: 16384, maxBufferSize: 2 ** 32 - 4, maxStorageBufferBindingSize: 2 ** 32 - 4, maxBindGroups: 4, maxVertexAttributes: 30,
      maxInterStageShaderVariables: 28, maxSampledTexturesPerShaderStage: 16, maxSamplersPerShaderStage: 16, maxStorageBuffersPerShaderStage: 10,
      maxStorageTexturesPerShaderStage: 8, maxUniformBuffersPerShaderStage: 12, maxComputeInvocationsPerWorkgroup: 1024,
      maxComputeWorkgroupSizeX: 1024, maxComputeWorkgroupSizeY: 1024, maxComputeWorkgroupSizeZ: 64, maxComputeWorkgroupStorageSize: 32768,
    };
    const gpu = (limits) => ({ requestAdapter: async () => ({ features: new Set(['texture-compression-bc', 'dual-source-blending']), limits: supportedLimits(limits), info: { vendor: 'apple', architecture: 'metal-3' } }) });
    const mac = { ...browser, deviceMemory: null, cores: 12 };

    it('reads every limit the needs name, off the prototype, and lets the Mac through', async () => {
      const adapter = await probeAdapter(gpu(m3), Object.keys(play.needs.limits));
      expect(adapter.limits.maxVertexAttributes).toBe(30);
      expect(adapter.limits.maxInterStageShaderVariables).toBe(28);
      expect(engineSupport({ ...mac, ...adapter }, { beforeIsolation: true, needs: play.needs })).toEqual({ ok: true, missing: [] });
      // (and at WebGPU's defaults, 16 and 16)
      const defaults = await probeAdapter(gpu({ ...m3, maxVertexAttributes: 16, maxInterStageShaderVariables: 16 }), Object.keys(play.needs.limits));
      expect(engineSupport({ ...mac, ...defaults }, { beforeIsolation: true, needs: play.needs }).ok).toBe(true);
    });

    it('reads the two limits even when the caller names none', async () => {
      const adapter = await probeAdapter(gpu(m3));
      expect(adapter.limits).toMatchObject({ maxVertexAttributes: 30, maxInterStageShaderVariables: 28 });
    });

    it('reads every limit any build the site holds names (a new name in a build\'s needs can’t go unread)', async () => {
      const names = Object.keys(play.needs?.limits ?? {});
      const read = Object.keys((await probeAdapter(gpu(m3), names)).limits);
      for (const name of names) expect(read).toContain(name);
    });

    it('names a limit the browser didn’t report as unreported, not as "no"', () => {
      expect(WHY.limit('maxVertexAttributes', undefined, 12)).toBe('the browser didn’t report maxVertexAttributes (the engine needs 12)');
      expect(WHY.limit('maxStorageBuffersPerShaderStage', 8, 10)).toBe('the GPU allows 8 where the engine needs 10 (maxStorageBuffersPerShaderStage)');
      expect(engineSupport({ ...mac, features: ['texture-compression-bc'], limits: {} }, { beforeIsolation: true, needs: play.needs }).missing.join('\n')).not.toMatch(/allows no/);
    });

    it('gives a Mac its own advice, not the Windows graphics setting', () => {
      expect(advice('macos')).toBe(ADVICE.macos);
      expect(advice('macos')).not.toMatch(/High performance|Windows|discrete/);
      expect(advice('macos')).toMatch(/Chrome or Edge/);
      expect(advice('windows')).toMatch(/High performance/);
      expect(advice(undefined)).toBe(ADVICE.other);
    });
  });
});
