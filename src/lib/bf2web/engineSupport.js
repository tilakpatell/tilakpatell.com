// Whether a visitor’s browser can run bf2-web’s engine (docs/decisions/2026-10-28-hoth-on-bf2-web.md): WebGPU for its
// renderer, with the adapter features its programs need, WebAssembly threads for the engine (SharedArrayBuffer, which needs the page cross-origin isolated) and
// the memory the World frames grow into. What is missing is named, so the route can say why it can’t run here. Pure: the caller reads the browser.
//
//   engineSupport({ gpu, features, limits, software, isolated, sharedMemory, wasm, deviceMemory, cores, mobile },
//     { beforeIsolation, needs }) → { ok, missing: [why, …] }
//     features, limits, software: the adapter’s (probeAdapter)
//     needs: the build’s, as the site adopts it (play.json’s needs, scripts/lib/bf2web-site.mjs): its page’s own floor
//     where the build sends one (floorNeeds: the features and limits its page refuses below, Hoth’s 23-texture
//     materials packed to 16 by its renderer), else what its programs bind (programNeeds). Without needs, FEATURES
//     alone. A GPU under a limit can’t make some of the engine’s pipelines, and the engine waits on them for good: its
//     frame 0 never comes (2026-10-28, an adapter allowing 16 textures a stage, Hoth’s materials 23, before the
//     packing). A software adapter and fewer than four cores are refused as the page refuses them (its belowFloor)
//     beforeIsolation: asked on a page that isn’t isolated itself, before going to the engine’s page, whose own
//     headers isolate it: isolation and shared memory aren’t asked
//   probeBrowser(win = globalThis) → the facts engineSupport takes, all but the adapter’s (and os, for advice)
//   probeAdapter(gpu = navigator.gpu, names = []) → Promise<{ features, limits, software }>: the adapter’s (limits: LIMITS
//     and every other name asked, as the build’s needs name them), empty without one. A limit the needs name and the
//     probe doesn’t read would count as missing on every GPU (r1055’s maxVertexAttributes and
//     maxInterStageShaderVariables, 2026-11-03: every visitor turned away), so the caller passes the needs’ names
//   advice(os) → what a visitor on that platform can do (a Mac has one GPU and no graphics setting)

// GB: the World frames grow linear memory to about 1.3 GB after loading and the threaded build caps it at 2 GiB
// (bf2-web’s validation/2026-10-25-hoth-bots-world); navigator.deviceMemory rounds down and stops at 8, so a machine
// that says 4 or more is let through
export const MIN_MEMORY_GB = 4;
// the page's floor: the main thread, the render thread and the job workers (bf2-web's runtime/play-quality.mjs FLOOR)
export const MIN_CORES = 4;

// the adapter features the engine can’t run without: its textures are BC, and Hoth’s cooked materials blend with dual
// sources (bf2-web’s tools/retail-surface-bridge.mjs; a program that can’t compile stops the engine as the level loads)
export const FEATURES = ['texture-compression-bc', 'dual-source-blending'];
// the limits a build's needs are given in (each stage's bindings, the bind groups, the vertex inputs and inter-stage
// variables its programs use: bf2-web's tools/catalog-requirements.mjs)
export const LIMITS = [
  'maxSampledTexturesPerShaderStage', 'maxSamplersPerShaderStage', 'maxStorageBuffersPerShaderStage', 'maxStorageTexturesPerShaderStage',
  'maxUniformBuffersPerShaderStage', 'maxBindGroups', 'maxTextureDimension2D', 'maxBufferSize', 'maxStorageBufferBindingSize',
  'maxVertexAttributes', 'maxInterStageShaderVariables',
];
// the adapter the engine’s page asks for (bf2-web’s tests/original-game-frame.mjs)
const ADAPTER = { powerPreference: 'high-performance' };

export const WHY = {
  gpu: 'no WebGPU',
  wasm: 'no WebAssembly',
  isolated: 'the page is not cross-origin isolated',
  sharedMemory: 'no shared memory for threads',
  memory: 'too little memory',
  software: 'a software GPU',
  cores: 'too few processor cores',
  mobile: 'a phone or tablet',
  feature: (name) => `no WebGPU ${name}`,
  limit: (name, have, need) =>
    have === undefined || have === null ? `the browser didn’t report ${name} (the engine needs ${need})` : `the GPU allows ${have} where the engine needs ${need} (${name})`,
};

// (Safari's WebGPU has no dual-source blending, which the engine's materials use; Chrome and Edge have it on a Mac)
export const ADVICE = {
  macos: 'On a Mac, use the latest Chrome or Edge, and keep macOS up to date. A Mac has one GPU, so there is no graphics setting to change.',
  windows: 'It needs a desktop browser with WebGPU, such as a current Chrome or Edge. On a PC with a dedicated graphics card, set the browser to High performance under Settings › System › Display › Graphics.',
  other: 'It needs a desktop browser with WebGPU, such as a current Chrome or Edge, with hardware acceleration on.',
};
export const advice = (os) => ADVICE[os] ?? ADVICE.other;

export function engineSupport(
  { gpu = false, features = [], limits = {}, software = false, isolated = false, sharedMemory = false, wasm = false, deviceMemory = null, cores = null, mobile = false } = {},
  { beforeIsolation = false, needs = null } = {},
) {
  const missing = [];
  if (!wasm) missing.push(WHY.wasm);
  if (!gpu) missing.push(WHY.gpu);
  else {
    for (const name of needs ? new Set([FEATURES[0], ...needs.features]) : FEATURES) if (!features.includes(name)) missing.push(WHY.feature(name));
    for (const [name, need] of Object.entries(needs?.limits ?? {})) if (!(limits[name] >= need)) missing.push(WHY.limit(name, limits[name], need));
    if (software) missing.push(WHY.software);
  }
  if (!beforeIsolation && !isolated) missing.push(WHY.isolated);
  if (!beforeIsolation && !sharedMemory) missing.push(WHY.sharedMemory);
  // (a browser that doesn't say is given the benefit of the doubt: Firefox and Safari keep deviceMemory to themselves)
  if (deviceMemory !== null && deviceMemory < MIN_MEMORY_GB) missing.push(WHY.memory);
  if (cores !== null && cores < MIN_CORES) missing.push(WHY.cores);
  if (mobile) missing.push(WHY.mobile);
  return { ok: missing.length === 0, missing };
}

export function probeBrowser(win = globalThis) {
  const nav = win.navigator ?? {};
  return {
    gpu: !!nav.gpu,
    isolated: win.crossOriginIsolated === true,
    sharedMemory: typeof win.SharedArrayBuffer === 'function',
    wasm: typeof win.WebAssembly === 'object',
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    cores: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    mobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(nav.userAgent ?? ''),
    os: osOf(nav),
  };
}

// macos, windows or other, from the browser's platform and user agent (an iPad that asks for the desktop site says Macintosh, and is mobile)
function osOf(nav) {
  const platform = `${nav.userAgentData?.platform ?? ''} ${nav.platform ?? ''}`, ua = nav.userAgent ?? '';
  if (/Mac/i.test(platform) || /Macintosh|Mac OS X/.test(ua)) return 'macos';
  if (/Win/i.test(platform) || /Windows/.test(ua)) return 'windows';
  return 'other';
}

export async function probeAdapter(gpu = globalThis.navigator?.gpu, names = []) {
  const adapter = await gpu?.requestAdapter(ADAPTER).catch(() => null);
  if (!adapter) return { features: [], limits: {}, software: false };
  // (a fallback adapter, or one named as a CPU renderer: the page's adapterKind)
  const info = adapter.info ?? {};
  const software = adapter.isFallbackAdapter === true || info.isFallbackAdapter === true || /swiftshader|llvmpipe|microsoft basic|warp/i.test(`${info.description ?? ''} ${info.device ?? ''}`);
  // (GPUSupportedLimits' limits are getters on its prototype: read by name, never spread)
  return { features: [...adapter.features], limits: Object.fromEntries([...new Set([...LIMITS, ...names])].map((n) => [n, adapter.limits?.[n]])), software };
}
