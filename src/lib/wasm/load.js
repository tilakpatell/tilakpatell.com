// A WebAssembly module loaded so that it can't hang a world (lane X2:
// docs/stack/webassembly.md). Every module the site runs (Rapier, the Basis
// transcoder, the meshopt decoder, the ports under wasm/) comes up through
// `load`: one try at a time, a failure named and not kept (the next ask
// tries again: a page that went offline and came back gets its physics),
// and a load that neither finishes nor fails within its time rejecting as a
// WasmError instead of leaving the world on its loading screen for good.
// A world's build that awaits one sees the WasmError, and either goes on
// without the module (the Battlefront without its engine walks the
// navgrid) or fails with the error's name, which the runtime keeps
// (rt.failure).
//
//   WasmError: name 'WasmError', module, reason ('unsupported' | 'load' |
//     'timeout'), cause
//   load(module, make() → Promise<value>, { timeoutMs = 20000, build }) →
//     Promise<value>: the same promise to every caller while it's coming or
//     once it's come
//   status() → { [module]: { state: 'loading' | 'ready' | 'failed', build,
//     ms, error } }, for the evidence and the profile (window.__wasm in
//     development)
//   forget(module): a test's (the next load makes it again)

export class WasmError extends Error {
  constructor(module, reason, cause) {
    super(`${module}: WebAssembly ${reason === 'timeout' ? 'did not come up in time' : reason === 'unsupported' ? 'is not available here' : 'failed to load'}${cause?.message ? ` (${cause.message})` : ''}`);
    this.name = 'WasmError';
    this.module = module;
    this.reason = reason;
    if (cause !== undefined) this.cause = cause;
  }
}

const loads = new Map(); // module → Promise
const states = new Map(); // module → { state, build, ms, error }
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function within(module, promise, ms) {
  if (!(ms > 0) || ms === Infinity) return promise;
  let timer = null;
  const late = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new WasmError(module, 'timeout')), ms);
  });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

export function load(module, make, { timeoutMs = 20000, build = null } = {}) {
  if (loads.has(module)) return loads.get(module);
  const t0 = clock();
  states.set(module, { state: 'loading', build, ms: null, error: null });
  let made;
  try {
    made = Promise.resolve(make());
  } catch (err) {
    made = Promise.reject(err);
  }
  const p = within(module, made, timeoutMs).then(
    (value) => {
      states.set(module, { state: 'ready', build: states.get(module)?.build ?? build, ms: +(clock() - t0).toFixed(1), error: null });
      return value;
    },
    (err) => {
      const named = err instanceof WasmError ? err : new WasmError(module, typeof WebAssembly === 'undefined' ? 'unsupported' : 'load', err);
      states.set(module, { state: 'failed', build: states.get(module)?.build ?? build, ms: +(clock() - t0).toFixed(1), error: named.message });
      if (loads.get(module) === p) loads.delete(module);
      throw named;
    },
  );
  loads.set(module, p);
  if (typeof window !== 'undefined' && import.meta.env?.DEV) window.__wasm = status;
  return p;
}

// the build a module settled on (a loader that falls back says so here)
export function settle(module, build) {
  const s = states.get(module);
  if (s) s.build = build;
}

export function status() {
  return Object.fromEntries([...states].map(([k, v]) => [k, { ...v }]));
}

export function forget(module) {
  loads.delete(module);
  states.delete(module);
}
