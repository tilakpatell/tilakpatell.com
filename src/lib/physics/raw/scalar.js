// The scalar Rapier build's wasm, brought up by the site (lane X3): what
// `@dimforge/rapier3d/rapier_wasm3d.js` would do with an ES module import of
// the binary, done with a hashed asset and a streaming compile instead
// (scripts/rapier-wasm.mjs sends the package's import here). The glue module
// is the binary's import object under the name it was linked against, and
// takes the instance back through `__wbg_set_wasm`; the glue's exports are
// this module's, so the package sees what it expects.
import * as bg from '@dimforge/rapier3d/rapier_wasm3d_bg.js';
import url from '@dimforge/rapier3d/rapier_wasm3d_bg.wasm?url';
import { instantiate } from '../../wasm/instantiate.js';

const { instance } = await instantiate(url, { './rapier_wasm3d_bg.js': bg });
bg.__wbg_set_wasm(instance.exports);

export * from '@dimforge/rapier3d/rapier_wasm3d_bg.js';
