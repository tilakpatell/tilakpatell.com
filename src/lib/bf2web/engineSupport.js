// Whether a visitor’s browser can run bf2-web’s engine (docs/decisions/2026-10-28-hoth-on-bf2-web.md): WebGPU for its
// renderer, WebAssembly threads for the engine (SharedArrayBuffer, which needs the page cross-origin isolated) and
// the memory the World frames grow into. What is missing is named, so the route can say why it fell back to the
// site’s world. Pure: the caller reads the browser.
//
//   engineSupport({ gpu, isolated, sharedMemory, wasm, deviceMemory, mobile }, { beforeIsolation }) → { ok, missing: [why, …] }
//     beforeIsolation: asked on a page that isn’t isolated itself, before going to the engine’s page, whose own
//     headers isolate it: isolation and shared memory aren’t asked
//   probeBrowser(win = globalThis) → the facts engineSupport takes

// GB: the World frames grow linear memory to about 1.3 GB after loading and the threaded build caps it at 2 GiB
// (bf2-web’s validation/2026-10-25-hoth-bots-world); navigator.deviceMemory rounds down and stops at 8, so a machine
// that says 4 or more is let through
export const MIN_MEMORY_GB = 4;

export const WHY = {
  gpu: 'no WebGPU',
  wasm: 'no WebAssembly',
  isolated: 'the page is not cross-origin isolated',
  sharedMemory: 'no shared memory for threads',
  memory: 'too little memory',
  mobile: 'a phone or tablet',
};

export function engineSupport({ gpu = false, isolated = false, sharedMemory = false, wasm = false, deviceMemory = null, mobile = false } = {}, { beforeIsolation = false } = {}) {
  const missing = [];
  if (!wasm) missing.push(WHY.wasm);
  if (!gpu) missing.push(WHY.gpu);
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
