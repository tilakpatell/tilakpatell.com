// The surface's looks on the node renderer (WebGPU, or WebGL 2 through the
// node renderer): the mid level on WebGPU, high and ultra always
// (runtime/backend.js). The twins lane T wrote beside each GLSL original,
// by the same names as ./classic.js, so scene.js and its parts draw with
// whichever set the renderer can.

import { PMREMGenerator } from 'three/webgpu';
import { singlePass } from '../../../../lib/three/renderer';
import { twinScene } from '../../../../lib/three/hookNodes';
import { createPost } from '../nodes/post';
import { SHIP_MODELS, buildShip, LENGTH } from '../../../universe/shipModelsNodes';
import { PARTY, loadPartyFigure, loadSharedFigure } from '../nodes/figures';
import { createGameFx } from '../../../../lib/three/fx/gameFxNodes';
import { createMeshyCast } from '../../../rickmorty/portal/meshyCastNodes';
import { withWardrobe } from '../../../rickmorty/wardrobe/wearNodes';
import { createSky } from '../nodes/sky';
import { wearScanSet } from '../../../../lib/three/scansNodes';
import { createSkyFog } from '../nodes/skyfog';
import { createWater } from '../nodes/water';
import { createWeather } from '../nodes/weather';
import { createKit } from '../nodes/kit';
import { createHouse } from '../../../../lib/three/houseNodes';
import { createDust } from '../../../../lib/three/dustNodes';
import { createGrass } from '../../../../lib/three/grassNodes';
import { createWind } from '../../../../lib/three/windNodes';
import { createGroundMap } from '../../../../lib/three/groundmapNodes';
import { floorShadow } from '../../../../lib/three/groundingNodes';
import { groundWorld } from '../../../../lib/three/groundworkNodes';
import { groundMaterial } from '../../../../lib/three/groundLookNodes';
import { createPortalFx, meshyJoints } from '../../../../lib/three/portalFxNodes';
import { createBoltMeshes } from '../../../../lib/three/combat/boltsNodes';
import { beamMaterial } from '../nodes/activity';
import { columnMaterial, meterMaterial } from '../nodes/missions';
import { wallMaterial } from '../nodes/hvv';

export const name = 'nodes';
export { createPost, SHIP_MODELS, buildShip, LENGTH, PARTY, loadPartyFigure, loadSharedFigure, createGameFx, createMeshyCast, withWardrobe };
export { createSky, wearScanSet, createSkyFog, createWater, createWeather, createKit, createHouse, createDust, createGrass, createWind, createGroundMap, floorShadow, groundWorld };
export { groundMaterial, createPortalFx, meshyJoints, createBoltMeshes, beamMaterial, columnMaterial, meterMaterial, wallMaterial, PMREMGenerator };
export const loadCruiser = () => import('../../../rickmorty/cruiser3dNodes');

// (a classic material with a hook on it swapped for the twin that holds
// the hook, lib/three/hookNodes, then the programs made through the
// runtime's compileAsync)
export function compile(root, { rt, camera, scene }) {
  twinScene(root);
  return rt.gfx.compile ? Promise.resolve(rt.gfx.compile(singlePass(root), camera, scene)).catch(() => {}) : Promise.resolve();
}

// every program made, compileAsync, then one small draw through the post,
// so its passes are made too
export async function prepareGpu({ rt, scene, camera, post, within, on, onProgress }) {
  twinScene(scene);
  onProgress?.(0.35, 'shaders');
  if (rt.gfx.compile) await within(rt.gfx.compile(scene, camera, scene), 600000);
  if (!on()) return;
  onProgress?.(0.8, 'first draw');
  post.render(64, 64);
  onProgress?.(1, 'first draw');
}
