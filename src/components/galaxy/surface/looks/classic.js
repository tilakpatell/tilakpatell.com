// The surface's looks on the classic renderer: the low level's, and mid's
// without WebGPU (runtime/backend.js). What scene.js and its parts draw
// with there, by the same names as ./nodes.js: the GLSL originals the node
// twins were written beside, so the low level draws as the surface did
// before the flip. Reached only through module.js's classic branch
// (import(/* classic */ …)), never by the node renderer.

import * as THREE from 'three';
import { precompile, precompilePasses, singlePass } from '../../../../lib/three/renderer';
import { prepareScene } from '../../../../lib/three/gpuWork';
import { createPost } from '../../../universe/post';
import { SHIP_MODELS, buildShip, LENGTH } from '../../../universe/shipModels';
import { PARTY, loadPartyFigure, loadSharedFigure } from '../../../universe/footScene';
import { createGameFx } from '../../../../lib/three/fx/gameFx';
import { createMeshyCast } from '../../../rickmorty/portal/meshyCast';
import { withWardrobe } from '../../../rickmorty/wardrobe/wear';
import { createSky } from '../sky';
import { wearScanSet } from '../../../../lib/three/scans';
import { createSkyFog as skyFogOf } from '../skyfog';
import { createWater } from '../water';
import { createWeather } from '../weather';
import { createKit } from '../kit';
import { createHouse } from '../../../../lib/three/house';
import { createDust } from '../../../../lib/three/dust';
import { createGrass } from '../../../../lib/three/grass';
import { createWind } from '../../../../lib/three/wind';
import { createGroundMap } from '../../../../lib/three/groundmap';
import { floorShadow } from '../../../../lib/three/grounding';
import { groundWorld } from '../../../../lib/three/groundwork';
import { groundMaterial } from '../../../../lib/three/groundLook';
import { createPortalFx, meshyJoints } from '../../../../lib/three/portalFx';
import { createBoltMeshes } from '../../../../lib/three/combat/bolts';
import { beamMaterial, columnMaterial, meterMaterial, wallMaterial } from './classicShaders';

export const name = 'classic';
export { createPost, SHIP_MODELS, buildShip, LENGTH, PARTY, loadPartyFigure, loadSharedFigure, createGameFx, createMeshyCast, withWardrobe };
export { createSky, wearScanSet, createWater, createWeather, createKit, createHouse, createDust, createGrass, createWind, createGroundMap, floorShadow, groundWorld };
export { groundMaterial, createPortalFx, meshyJoints, createBoltMeshes, beamMaterial, columnMaterial, meterMaterial, wallMaterial };
export const PMREMGenerator = THREE.PMREMGenerator;
// (the classic fog is three's own chunks, patched)
export const createSkyFog = (sky) => skyFogOf(sky, THREE.ShaderChunk);
export const loadCruiser = () => import('../../../rickmorty/cruiser3d');
// (the game's light stack is the node renderer's: the classic keeps the
// surface's own sun, its baked floor and its post)
export const createStack = async () => null;
export const levelJson = async () => null;

// a root's programs made before it is shown, against the post's buffer
export function compile(root, { renderer, camera, scene, post }) {
  return precompile(renderer, singlePass(root), camera, scene, post.on ? post.composer.readBuffer : undefined);
}

// everything sent to the chip before the surface is shown: the passes'
// shaders, then every picture, shader and one draw, a slice at a time
export async function prepareGpu({ renderer, scene, camera, post, within, on, onProgress }) {
  if (post.composer) await within(precompilePasses(renderer, post.composer, camera), 20000);
  if (!on()) return;
  await within(prepareScene({ renderer, roots: [scene], scene, camera, target: post.target, render: () => post.render(64, 64), onProgress, alive: on }), 600000);
}
