// A system's space level's capitals (spacePieces.js: the game's own kit of
// each, where its starfighter assault map stands it) dressed as the war's
// ships of their kind are (galaxy/models.js): the game's own hull where the
// export left it bare (capitalHull.js), its paint, plating, lit windows and
// engines (capitalLook.js), and the sun's shadow (capitalShadow.js). As they
// came, the level's Star Destroyer had the export's bare white hull beside
// the war's in the game's paint: two Star Destroyers, one of them wrong.
//
// capitalLook.js dresses a ship in a frame of its own (bow to +z, one long,
// its middle at the origin: models.js's), so the kit is dressed in that
// frame and handed back as the level stood it.
//
//   KIT_KINDS: a kit's slug → [kind, turn, hull] (the war's kind it is, the
//     turn about y that puts its bow to +z: measured where each kit's
//     engines are; the Venator's at +z, the rest at −z; and, where it isn't
//     the kind's, its game hull's row, capitalHull.js)
//   dressKit(gltf, slug, { detail, phone, aniso, hull, maps, parts }) → Promise<Object3D>
//     (parts: a kit the level pack has whole drawn from its own parts, capitalKit.js)
//     a copy of the kit, dressed, in its own frame (a kit it has no kind
//     for, as it came)

import * as THREE from 'three';
import { budget, device } from '../../lib/device';
import { cloneScene } from '../../lib/three/gltfCache';
import { dressGameHull, dressGameMaps } from './capitalHull';
import { GAME_KITS, dressGameKit } from './capitalKit';
import { dressCapital, isCapital } from './capitalLook';
import { shadowed } from './capitalShadow';

export const KIT_KINDS = {
  'endor-isd': ['destroyer', 0],
  'fondor-isd': ['destroyer', 0],
  'endor-mc80': ['moncal', 0],
  'fondor-mc80': ['moncal', 0],
  'kamino-venator': ['venator', Math.PI],
  'kamino-venator-2': ['venator', Math.PI],
  'naboo-venator': ['venator', Math.PI],
  'naboo-venator-2': ['venator', Math.PI],
  'naboo-lucrehulk': ['lucrehulk', 0],
  'providenceclassdreadnaught-01': ['providence', Math.PI / 2],
  'corvettecr90-01': ['corvette', 0],
  'fondor-arquitens': ['lightcruiser', 0],
  // (the Republic's Arquitens: its hull the Imperial one's, in its own paint and mask)
  'naboo-jedicruiser': ['lightcruiser', 0, 'jedicruiser'],
  'kamino-jedicruiser': ['lightcruiser', 0, 'jedicruiser'],
};

export async function dressKit(gltf, slug, { detail = device().detail, phone = device().phone, aniso = budget().aniso, hull = dressGameHull, maps = dressGameMaps, parts = dressGameKit } = {}) {
  const root = cloneScene(gltf);
  const row = KIT_KINDS[slug];
  if (!row || !isCapital(row[0])) return root;
  const [kind, turn, own = kind] = row;
  const dressing = { detail, phone, aniso };
  // (a kit the pack stands its own way drawn as its level has it: Fondor's Star Destroyer is its dry dock's, not Endor's)
  await Promise.all([hull(root, own, dressing), maps(root, kind, dressing), parts(root, slug in GAME_KITS ? slug : own, dressing)]);
  // (in the ship's own frame: centred, turned bow to +z, one long)
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const centre = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const long = Math.max(size.x, size.z) || 1;
  const middle = new THREE.Group();
  middle.position.copy(centre).negate();
  middle.add(root);
  const unit = new THREE.Group();
  unit.rotation.y = turn;
  unit.scale.setScalar(1 / long);
  unit.add(middle);
  unit.updateMatrixWorld(true);
  dressCapital(unit, kind, { plating: detail !== 'low', size: phone ? 1024 : 2048, lite: phone });
  shadowed(unit);
  // (and back as the level stood it)
  const kit = new THREE.Group();
  kit.position.copy(centre);
  kit.rotation.y = -turn;
  kit.scale.setScalar(long);
  kit.add(unit);
  return kit;
}
