// scans.js on the node renderer: the same two sets and the same rule, the
// maps loaded by coreNodes (core.js's twin), so a 'nodes' world's ground
// doesn't reach core.js's GLSL. Copied for that reason.
//
// The surfaces' scans by role (the grounds underfoot, the props' trims):
// what each is and how big a tile of it is on the ground, and its maps, from
// one of two sets. The site's own photo scans (Poly Haven, CC0:
// public/cc0/galaxy/, made by scripts/galaxy-textures.mjs) by default; a
// Star Wars world on the game's own maps instead (its site's
// `look.scanned: 'bf2017'`: public/textures/galaxy/bf2017/, made by
// scripts/bf2017-textures.mjs from Battlefront II's, the owner's rule that
// every texture in a Star Wars world is the game's). One world is built at
// a time, so the set is the page's: surface/scene.js chooses it as a world
// is made and puts the site's back as it goes. Moved down from
// galaxy/surface/kit.js so the flight's ground wears the same scans as the
// walkable surfaces.
//
//   SCANS[role] → the site's own set: { source, id, name, authors, license, metres, arm, mean }
//   wearScanSet('cc0' | 'bf2017'), scanSet() → the set worn
//   scanOf(role) → the worn set's row, or null
//   scanFiles(role, { xl }) → its files
//   loadScan(role, { xl }) → its maps (lib/three/core's loadCore)

import SCANS from '../../../public/cc0/galaxy/index.json';
import GAME from '../../../public/textures/galaxy/bf2017/index.json';
import { coreFiles, loadCore } from './coreNodes';

const SETS = { cc0: { base: '/cc0/galaxy', index: SCANS }, bf2017: { base: '/textures/galaxy/bf2017', index: GAME } };
let worn = 'cc0';

export { SCANS };
export const wearScanSet = (name) => {
  worn = SETS[name] ? name : 'cc0';
};
export const scanSet = () => worn;
export const scanOf = (role) => SETS[worn].index[role] ?? null;
export const scanFiles = (role, { xl = false } = {}) => coreFiles(role, { xl, ...SETS[worn] });
export const loadScan = (role, { xl = false } = {}) => loadCore(role, { xl, ...SETS[worn] });
