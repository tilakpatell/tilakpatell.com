// Whether a visitor’s browser can run bf2-web’s engine (docs/decisions/2026-10-28-hoth-on-bf2-web.md): WebGPU for its
// renderer, with the adapter features its programs need, WebAssembly threads for the engine (SharedArrayBuffer, which needs the page cross-origin isolated) and
// the memory the World frames grow into. What is missing is named, so the route can say why it fell back to the
// site’s world. Pure: the caller reads the browser.
//
//   engineSupport({ gpu, features, isolated, sharedMemory, wasm, deviceMemory, mobile }, { beforeIsolation }) → { ok, missing: [why, …] }
//     features: the adapter’s (probeAdapter), each of FEATURES required
//     beforeIsolation: asked on a page that isn’t isolated itself, before going to the engine’s page, whose own
//     headers isolate it: isolation and shared memory aren’t asked
//   probeBrowser(win = globalThis) → the facts engineSupport takes, all but features
//   probeAdapter(gpu = navigator.gpu) → Promise<[feature, …]>: the adapter’s, [] without one

// GB: the World frames grow linear memory to about 1.3 GB after loading and the threaded build caps it at 2 GiB
// (bf2-web’s validation/2026-10-25-hoth-bots-world); navigator.deviceMemory rounds down and stops at 8, so a machine
// that says 4 or more is let through
export const MIN_MEMORY_GB = 4;

// the adapter features the engine can’t run without: its textures are BC, and Hoth’s cooked materials blend with dual
// sources (bf2-web’s tools/retail-surface-bridge.mjs; a program that can’t compile stops the engine as the level loads)
export const FEATURES = ['texture-compression-bc', 'dual-source-blending'];
// the adapter the engine’s page asks for (bf2-web’s tests/original-game-frame.mjs)
const ADAPTER = { powerPreference: 'high-performance' };

export const WHY = {
  gpu: 'no WebGPU',
  wasm: 'no WebAssembly',
  isolated: 'the page is not cross-origin isolated',
  sharedMemory: 'no shared memory for threads',
  memory: 'too little memory',
  mobile: 'a phone or tablet',
  feature: (name) => `no WebGPU ${name}`,
};

export function engineSupport({ gpu = false, features = [], isolated = false, sharedMemory = false, wasm = false, deviceMemory = null, mobile = false } = {}, { beforeIsolation = false } = {}) {
  const missing = [];
  if (!wasm) missing.push(WHY.wasm);
  if (!gpu) missing.push(WHY.gpu);
  else for (const name of FEATURES) if (!features.includes(name)) missing.push(WHY.feature(name));
  if (!beforeIsolation && !isolated) missing.push(WHY.isolated);
  if (!beforeIsolation && !sharedMemory) missing.push(WHY.sharedMemory);
  // (a browser that doesn't say is given the benefit of the doubt: Firefox and Safari keep deviceMemory to themselves)
  if (deviceMemory !== null && deviceMemory < MIN_MEMORY_GB) missing.push(WHY.memory);
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
    mobile: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(nav.userAgent ?? ''),
  };
}

export async function probeAdapter(gpu = globalThis.navigator?.gpu) {
  const adapter = await gpu?.requestAdapter(ADAPTER).catch(() => null);
  return adapter ? [...adapter.features] : [];
}
