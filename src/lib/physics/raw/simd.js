// The SIMD Rapier build's wasm, brought up by the site (lane X3): the twin of
// scalar.js for `@dimforge/rapier3d-simd`; scripts/rapier-wasm.mjs sends
// that package's wasm import here. A browser whose SIMD check lied rejects
// this module's top-level await with the engine's CompileError, which
// rejects the package's dynamic import, which engine.js answers with the
// scalar build.
import * as bg from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.js';
import url from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.wasm?url';
import { instantiate } from '../../wasm/instantiate.js';

const { instance } = await instantiate(url, { './rapier_wasm3d_bg.js': bg });
bg.__wbg_set_wasm(instance.exports);

export * from '@dimforge/rapier3d-simd/rapier_wasm3d_bg.js';
