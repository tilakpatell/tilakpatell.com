// The game's own hull on a capital ship whose great plates the export left
// bare. The 2017 game draws a Star Destroyer's hull (`M_Hull_01`) with its
// ship shader: the hull's own map painted once over the whole of it on its
// second UV set (the deck, the flanks, the keel, each where it is: the large
// patchwork of greys, the darker sections, the grime), and over that, on its
// first UV set, the kitbash sheets tiling every few tens of metres (the
// plates, the trenches, the greebles: their colour and their relief). The
// export kept neither the graph nor, on the fleet's and the ultra cut's
// hull, the UVs, so that hull was a flat grey slab beside parts in the
// game's own paint. The space level's pack (scripts/bf2017-level.mjs,
// sb_endor) keeps the same hull, in the same frame, with both UV sets, and
// the maps are published with it: so the hull is drawn from those, swapped
// in when the ship loads, the rest of the ship as it came.
//
// The Star Destroyer's maps: the hull's map (t_stardestroyer_hull_01_cs, its
// colour, and its ORM's roughness) on UV1; on UV0 the relief of the game's
// Star Destroyer panel and detail sheets (t_stardestroyerpanels_01,
// t_stardestroyerdetails_01: the sheets its far Star Destroyers wear,
// SS_StarDestroyerPanels_01), the panels at the UV's own tiling and the
// details four times finer, the details' normal blended over the panels'
// (UDN, as lib/three/surface/gameMaterial.js blends a detail). Not their
// colour: painted for the far ship, its windows and greebles, magnified
// over the deck it smeared into streaks and black and white blocks (the
// game's close hull, SS_StarDestroyer_2UV_Detailmap_02, tiles a panel
// normal of its own, T_StarDestroyer_PanelTile_01_N, not in the bucket). A
// hull whose def names the sheets' colour takes it, each by its mean (so
// the hull's map keeps its own grey). The rest of the Star Destroyer, its
// eighty parts, is the pack's own: capitalKit.js.
//
// The Venator's (SS_ShipShader_PanelTile_01, the kamino pack's maps): no
// colour map at all, the hull's own map on UV1 a mask (its RGBAUnique,
// t_venatorstardestroyer_hull_01_combine_rgba, linear: red the hull's tonal
// patchwork and grime, green its occlusion, blue sparse blotches, alpha its
// plates' edges), so the hull is the Republic's grey paint under it; on UV0
// the panel sheet's relief (TilingNormal) and the breakup's colour and
// relief over it. Its stand-in is more than the hull: the export joined the
// hull's plates, the three towers' and the stern's into one bare material,
// so the hull is all five parts from sb_kamino, each set where the level
// sets it (its far.bin: the towers turned half round), all in the cut's own
// kit frame (the `nose` node the fleet's row turned half round to fly bow
// first, scripts/bf2017-fleet.mjs).
//
// The Arquitens's and the MC80's are the same shader's: the Arquitens's
// hull from the bucket (sb_fondor, the Republic's sb_kamino: the export kept
// neither UV set), its mask and sheets with it; the MC80's mask and breakup
// on the parts it has already.
//
// A phone takes the maps smaller (and the Venator's parts a level coarser);
// the lowest detail the hull's map alone; a failed load leaves the ship as
// it came (plated, capitalLook.js).
//
// GAME_HULLS (kind → its hull's files), sizesFor(detail, phone),
// dressGameHull(root, kind, { detail, phone, aniso, loadMesh, loadTexture })
// → Promise<boolean> (true when the game's hull is on), hullMaterial(maps,
// def, { name }), paintMaterial(maps, def, { name }) and inFrame(geometry,
// from, to) are the parts, for tests; and GAME_MAPS, dressGameMaps(root,
// kind, { detail, phone, aniso, loadTexture }) → Promise<boolean>, for the
// capitals whose cut wears the game's maps already, small (below).

import * as THREE from 'three';
import { withFallback } from '../../lib/assetBase';
import { gltfLoader, ktx2Loader } from '../../lib/three/gltf';
import { patchShaders } from './capitalPlating';
import { splitTextures } from './surface/level/levelPack.js';

const LEVELS = '/models/galaxy/bf2017/levels';
const tex = (level, name) => `${LEVELS}/${level}/tex/${name}`;

const turned = new THREE.Matrix4().makeRotationY(Math.PI);
const at = (x, y, z, turn = false) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(turn ? turned : new THREE.Matrix4());
// a turn about y by a quaternion's y and w (the Lucrehulk's ring), and a placement by its axes' signs
const yaw = (y, w) => new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(0, y, 0, w).normalize());
const signs = (x, y, z) => new THREE.Matrix4().makeScale(x, y, z);

// a sheet's colour, linear, averaged over the whole map (its smallest mip:
// measured on the published 2048 rows), which its colour is divided by.
// `parts`: the pack's meshes the stand-in is (`mesh` without its LOD,
// `own` its material, `place` where the level sets it in the hull's frame);
// `lod`: the LOD a computer and a phone take; `have`: the sizes the maps are
// published at, where they stop short of 2,048
export const GAME_HULLS = {
  destroyer: {
    // (the fleet's and the ultra cut's hull, by its material's name; the pack's own)
    material: /^M_Hull_01(_lods)?$/,
    own: 'M_Hull_01',
    parts: [{ mesh: `${LEVELS}/sb_endor/meshes/stardestroyer_hull_01_sb_endor_mesh`, own: /^M_Hull_01$/ }],
    lod: { computer: 0, phone: 0 },
    atlas: { colour: tex('sb_endor', 't_stardestroyer_hull_01_cs'), orm: tex('sb_endor', 't_stardestroyer_hull_01_cs__orm_240cdb7c') },
    // (the sheets' relief alone: their colour is the far Star Destroyer's
    // (SS_StarDestroyerPanels_01, its painted windows and greebles), and
    // magnified over the deck it smeared into streaks and black and white
    // blocks; the game's own close hull, SS_StarDestroyer_2UV_Detailmap_02,
    // tiles its panel normal over the hull's map, T_StarDestroyer_PanelTile_01_N,
    // which the bucket hasn't got)
    panels: { colour: null, normal: tex('sb_endor', 't_stardestroyerpanels_01_nw__normal'), tiling: 1 },
    details: { colour: null, normal: tex('sb_endor', 't_stardestroyerdetails_01_nw__normal'), tiling: 4, strength: 0.8 },
  },
  venator: {
    // ('red', the markings, is bare too, but its own mesh: capitalLook.js paints it)
    material: /^M_VenatorStarDestroyer_Hull_01(_lods)?$/,
    own: 'M_VenatorStarDestroyer_Hull_01',
    // (sb_kamino's far.bin, instances 153–164 and 205–206, in metres; both Venators there agree to 2 cm)
    parts: [
      { mesh: `${LEVELS}/sb_kamino/meshes/venatorstardestroyer_hull_01_mesh`, own: /^M_VenatorStarDestroyer_Hull_01(_lods)?$/ },
      { mesh: `${LEVELS}/sb_kamino/meshes/venatorstardestroyer_controltower_01_mesh`, own: /^M_VenatorStarDestroyer_ControlTower_01(_lods)?$/, place: at(0, 67.839, -8.663, true) },
      { mesh: `${LEVELS}/sb_kamino/meshes/venatorstardestroyer_controltower_left_mesh`, own: /^M_VenatorStarDestroyer_ControlTower_01(_lods)?$/, place: at(-28.71, 194.968, 222.196, true) },
      { mesh: `${LEVELS}/sb_kamino/meshes/venatorstardestroyer_controltower_right_mesh`, own: /^M_VenatorStarDestroyer_ControlTower_01(_lods)?$/, place: at(28.672, 194.969, 222.197, true) },
      { mesh: `${LEVELS}/sb_kamino/meshes/venatorstardestroyer_detailback_01_mesh`, own: /^M_VenatorStarDestroyer_DetailBack_01(_lods)?$/, place: at(-1.672, -0.584, 341.229) },
    ],
    // (all five at the first LOD under the game's whole: 97,000 triangles; its own is 268,000)
    lod: { computer: 1, phone: 2 },
    have: [256, 512, 1024],
    // the Republic's paint, light grey, under the mask (sRGB)
    paint: '#c6c6c2',
    combine: { map: tex('kamino', 't_venatorstardestroyer_hull_01_combine_rgba'), tone: 0.333 },
    tiling: { normal: tex('kamino', 't_venatorstardestroyer_paneltile_02_n'), tiling: 1 },
    breakup: { colour: tex('kamino', 't_venatorstardestroyer_paneltile_01_breakup_02_rgba'), normal: tex('kamino', 't_venatorstardestroyer_paneltile_01_breakup_01_rgba'), mean: [0.465, 0.463, 0.451], tiling: 1, strength: 0.6 },
  },
  lightcruiser: {
    // (the Arquitens: the Venator's shader, its own maps. The war's cut and
    // the space kits kept the hull without either UV set, a flat grey slab;
    // the game's hull, from the bucket, keeps both. The kits' anchor, so at
    // the kit's origin, and the Republic's kit names it so too)
    material: /^M_ImperialCruiser_PanelTile_01(_lods)?$/,
    own: 'M_ImperialCruiser_PanelTile_01',
    parts: [{ mesh: `${LEVELS}/sb_fondor/meshes/imperialcruiser_hull_01_mesh`, own: /^M_ImperialCruiser_PanelTile_01(_lods)?$/ }],
    // (18,000 triangles; the cut's own is 4,800; its maps no finer than the
    // Venator's, three and a half times its length)
    lod: { computer: 1, phone: 2 },
    have: [256, 512, 1024],
    // the Empire's grey under the mask (sRGB)
    paint: '#a2a6ab',
    combine: { map: tex('sb_fondor', 't_imperialcruiser_hull_01_combine_rgba'), tone: 0.396 },
    // (its panel sheet keeps a normal's x and y; the breakup at half the
    // sheet's tiling, the game's BreakUpRGBATiling)
    tiling: { normal: tex('sb_fondor', 't_imperialcruiser_paneltile_01_n'), tiling: 1, rg: true },
    breakup: { colour: tex('sb_fondor', 't_imperialcruiser_paneltile_breakup_02_rgba'), normal: tex('sb_fondor', 't_imperialcruiser_paneltile_breakup_01_rgba'), mean: [0.454, 0.455, 0.44], tiling: 0.5, strength: 0.6 },
  },
  jedicruiser: {
    // (the Republic's Arquitens, a kit's (spaceKits.js), not a kind: the same
    // hull, its own mask and breakup; its sheet and relief byte for byte the
    // Imperial one's)
    material: /^M_ImperialCruiser_PanelTile_01(_lods)?$/,
    own: 'M_ImperialCruiser_PanelTile_01',
    parts: [{ mesh: `${LEVELS}/sb_kamino/meshes/jedicruiser_hull_01_mesh`, own: /^M_ImperialCruiser_PanelTile_01(_lods)?$/ }],
    lod: { computer: 1, phone: 2 },
    have: [256, 512, 1024],
    // the Republic's paint, the Venator's
    paint: '#c6c6c2',
    combine: { map: tex('sb_kamino', 't_jedicruiser_hull_01_combine_rgba'), tone: 0.343 },
    tiling: { normal: tex('sb_fondor', 't_imperialcruiser_paneltile_01_n'), tiling: 1, rg: true },
    breakup: { colour: tex('sb_kamino', 't_jedicruiser_paneltile_breakup_02_rgba'), normal: tex('sb_fondor', 't_imperialcruiser_paneltile_breakup_01_rgba'), mean: [0.454, 0.454, 0.44], tiling: 0.5, strength: 0.6 },
  },
  lucrehulk: {
    // (its plates' geometry alone: their maps aren't published, so the
    // stand-in's material stays, plated as before, capitalLook.js. The fleet
    // cut kept one instance a mesh and a spot, so of the ring's six arcs, all
    // at the hull's middle, one, and none of the three mirrored twins: the
    // ring was a sixth of itself. The plates are all 25 instances
    // sb_droidbattleship's far.bin sets, in the hull's frame, mirrors as
    // they are; the two force fields joined into the stand-in go)
    material: /^M_LucrehulkClass_DroidBattleShip_MainHull_01_lods$/,
    own: 'M_LucrehulkClass_DroidBattleShip_MainHull_01',
    keep: true,
    parts: [
      ['mainhull_01'],
      ['mainhull_02'],
      ...[
        [-0.2588, 0.9659],
        [0.866, 0.5],
        [-0.5, 0.866],
        [-0.7071, 0.7071],
        [0.9659, 0.2588],
        [1, 0],
      ].map(([y, w]) => ['mainhull_03', yaw(y, w)]),
      ['mainhull_04'],
      ['mainhull_05'],
      ['mainhull_06'],
      ['mainhull_07'],
      ['centersphere_exterior_01', at(0, 11.56, 0)],
      ['forwardcontroltower_01'],
      ['controlbridgetower_01'],
      ['controlbridgetower_01_left', at(137.56, 608.58, -180.26)],
      ['controlbridgetower_01_right', at(-137.51, 608.68, -180.5)],
      ['hangar_03'],
      ['hangar_03', signs(-1, 1, 1)],
      ['tractor_01'],
      ['tractor_01', signs(-1, 1, 1)],
      ['tractor_01_base', at(328.743, 79.2508, 1200.6748, true)],
      ['tractor_01_base', at(-328.743, 79.2508, 1200.6748)],
      ['tractor_02', signs(-1, -1, 1)],
      ['tractor_02', signs(1, -1, 1)],
    ].map(([name, place]) => ({
      mesh: `${LEVELS}/sb_droidbattleship/meshes/lucrehulkclass_droidbattleship_${name}_mesh`,
      // (a plate's material, by its LOD: the towers' at the third LOD end in a 1)
      own: /^(ccc_)?M_LucrehulkClass_DroidBattleShip_(MainHull_0\d|CenterSphere_01|ForwardControlTower_01|ControlBridgeTower_0[12]|Tractor_0[12])(_lods)?1?$/,
      place,
    })),
    // (the plates at the third LOD: about 75,000 triangles over 3.2 km)
    lod: { computer: 2, phone: 3 },
  },
  moncal: {
    // (MC_80_light_Met, the windows, its own mesh and maps: left as it is)
    material: /^MC_80_Met$/,
    own: 'MC_80_Met',
    // (the hull and the seven nodules sb_endor's cells set on it, each a
    // plain offset in metres; the export joined them in one material)
    parts: [
      { mesh: `${LEVELS}/sb_endor/meshes/mc80_mainhull_01_mesh`, own: /^MC_80_Met(_lods)?$/ },
      ...[
        ['largenodule_01', -151.988, 1.976, -166.892],
        ['largenodule_02', -64.651, 30.499, 28.692],
        ['largenodule_03', 62.045, 29.047, 28.694],
        ['largenodule_04', 131.23, 3.747, -172.483],
        ['largenodule_05', -2.562, -49.176, 352.212],
        ['largenodule_06', -73.57, -47.806, -91.127],
        ['nodulehanger_01', 55.199, -52.994, -118.09],
      ].map(([name, x, y, z]) => ({ mesh: `${LEVELS}/sb_endor/meshes/mc80_${name}_mesh`, own: /^MC_80_Met(_lods)?$/, place: at(x, y, z) })),
    ],
    // (the hull's first LOD alone is 293,000 triangles: its third, the whole about 90,000)
    lod: { computer: 2, phone: 3 },
    have: [256, 512, 1024],
    // the Mon Calamari's grey, a little blue, under its own mask (the hull's
    // organic patchwork, its nodules' too: six of the seven name it) and the
    // breakup's mottle
    paint: '#a3abb0',
    combine: { map: tex('sb_endor', 't_mc80_hull_01_combine_rgba'), tone: 0.305 },
    // (the game's own tiling normal is a fine grain, next to flat at the
    // hull's scale: the MC80's panel sheet the Endor level's far cruisers
    // wear stands in for its relief)
    tiling: { normal: tex('endor/deathstar', 't_starcruisermc80panels_01_ns'), tiling: 1, rg: true },
    // (the game's breakup and its relief at its BreakUpRGBATiling, a quarter:
    // its grime streaks across the hull, not repeated every 80 m; `hue`,
    // `amount`: a third of its tan and three quarters of its mottle, or its
    // grime read as rust over a grey hull)
    breakup: { colour: tex('sb_endor', 'mc80_paneltile_breakup_02_rgba'), normal: tex('sb_endor', 'mc80_surfacedetail_02_n'), mean: [0.528, 0.466, 0.349], tiling: 0.25, strength: 0.6, hue: 0.3, amount: 0.75 },
  },
};

// The capitals whose cut already wears the game's own maps on the game's
// own UVs (the CR90's, the Providence's: one unique atlas each, no tiling
// sheet, their shaders' whole hull), but smaller than the packs publish
// them (the ultra cut's 1,024, the fleet's 256 and 128) and without their
// ORM (bf2017-space.mjs bound the colour and the normal only): each map
// swapped for the pack's at the device's size, the ORM's roughness and
// occlusion bound, and the paint a dielectric's, as the game's (the
// Providence came as a whole metal). The material's name is the cut's;
// nothing laid over them (capitalLook.js leaves a game hull as it is).
export const GAME_MAPS = {
  corvette: {
    material: /^NEWHULL$/,
    colour: tex('sb_endor', 't_corvettecr90_hull_cs'),
    normal: tex('sb_endor', 't_corvettecr90_hull_n__normal'),
    orm: tex('sb_endor', 't_corvettecr90_hull_n__orm_3a53a0f8'),
  },
  providence: {
    material: /^M_ProvidenceClass_DestroyerBackdrop_01(_lods)?$/,
    // (sb_droidbattleship's: sb_kamino's ORM stops at 1,024)
    colour: tex('sb_droidbattleship', 't_providenceclassdreadnaught_01_cs'),
    normal: tex('sb_droidbattleship', 't_providenceclassdreadnaught_01_nam__normal'),
    orm: tex('sb_droidbattleship', 't_providenceclassdreadnaught_01_nam__orm_977091d1'),
  },
  moncal: {
    // (its lit windows, SS_EmissiveWindows_01, a mesh of their own whose
    // export gave them the hull's breakup: the game's map of them on UV0, the
    // cut's own UVs, a tiling sheet of 7 m)
    material: /^MC_80_light_Met$/,
    windows: tex('sb_endor', 't_mc80_windows_01_rgba'),
  },
};

// each map's size by the device: the rows the bucket holds (colour 512,
// 1,024 and 2,048; data 256, 512 and 2,048). The sheets tile, so they are
// sized by how close a fighter flies to them, not by the ship: every
// computer at mid and up has them whole; a phone at half; the lowest
// detail has the hull's map alone
export function sizesFor(detail, phone = false) {
  if (detail === 'low') return { atlas: 512, orm: 0, colour: 0, normal: 0 };
  if (phone) return { atlas: 1024, orm: 512, colour: 1024, normal: 512 };
  if (detail === 'mid') return { atlas: 1024, orm: 512, colour: 2048, normal: 2048 };
  return { atlas: 2048, orm: 2048, colour: 2048, normal: 2048 };
}

const f = (v) => v.toFixed(4);
const vec3 = (a) => `vec3( ${a.map(f).join(', ')} )`;

// the hull's material: the game's map on UV1, the sheets on UV0 (the
// panels' normal as three's own normal map, so three works out the frame
// from UV0's slopes; the details' normal patched in, and the sheets'
// colour where a hull's def names it)
export function hullMaterial(maps, def, { name = 'M_Hull_01' } = {}) {
  const m = new THREE.MeshStandardMaterial({ name: `${name}|game`, color: 0xffffff, map: maps.atlas, roughness: maps.orm ? 1 : 0.55, metalness: 0 });
  m.userData.gameHull = true;
  maps.atlas.channel = 1;
  if (maps.orm) {
    maps.orm.channel = 1;
    m.roughnessMap = maps.orm;
  }
  if (!maps.panelsNormal) return m;
  maps.panelsNormal.channel = 0;
  maps.panelsNormal.repeat.setScalar(def.panels.tiling);
  m.normalMap = maps.panelsNormal;
  const ratio = def.details.tiling / def.panels.tiling;
  const colour = Boolean(maps.panels && maps.details);
  if (!colour && !maps.detailsNormal) return m;
  patchShaders(m, colour ? 'gamehull' : 'gamehull-relief', (shader) => {
    shader.uniforms.uGhPanels = { value: maps.panels ?? null };
    shader.uniforms.uGhDetails = { value: maps.details ?? null };
    shader.uniforms.uGhDetailsN = { value: maps.detailsNormal ?? null };
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uGhPanels;\nuniform sampler2D uGhDetails;\nuniform sampler2D uGhDetailsN;');
    if (colour)
      fs = fs.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  // (the sheets over the hull's map, each by its own mean: the map's grey kept)
  vec3 ghPanel = texture2D( uGhPanels, vNormalMapUv ).rgb / ${vec3(def.panels.mean)};
  vec3 ghDetail = texture2D( uGhDetails, vNormalMapUv * ${f(ratio)} ).rgb / ${vec3(def.details.mean)};
  diffuseColor.rgb *= clamp( ghPanel * ghDetail, 0.0, 2.0 );`,
      );
    if (maps.detailsNormal)
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
  // (the details' relief over the panels', UDN)
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  vec3 ghDn = texture2D( uGhDetailsN, vNormalMapUv * ${f(ratio)} ).xyz * 2.0 - 1.0;
  mapN = normalize( vec3( mapN.xy + ghDn.xy * ${f(def.details.strength ?? 1)}, mapN.z ) );
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#else
#include <normal_fragment_maps>
#endif`,
      );
    shader.fragmentShader = fs;
  });
  return m;
}

// a hull with no colour map of the game's: its paint (`def.paint`), under the
// hull's mask on UV1 where it has one (the Venator's RGBAUnique: its red the
// patchwork and grime, by its mean; its green the occlusion, half of it in
// the paint and the whole of it on the light from the sky and the
// environment, three's own AO read from green; its alpha the plates' edges;
// its blue the blotches), and on UV0 the panel sheet's relief (`rg`: a sheet
// that keeps only a normal's x and y, its z rebuilt) with the breakup's
// colour (by its mean; `hue` and `amount` how much of its colour and of its
// contrast) and, where it has one, its relief over it, UDN
const MASK = { tone: 0.5, ao: 0.5, edge: [0.8, 1.1], blot: 0.35 };
export function paintMaterial(maps, def, { name = def.own } = {}) {
  const m = new THREE.MeshStandardMaterial({ name: `${name}|game`, color: def.paint, roughness: 0.62, metalness: 0 });
  m.userData.gameHull = true;
  if (maps.combine) {
    maps.combine.channel = 1;
    m.aoMap = maps.combine;
  }
  const sheets = Boolean(maps.tilingNormal && maps.breakup);
  if (sheets) {
    maps.tilingNormal.channel = 0;
    maps.tilingNormal.repeat.setScalar(def.tiling.tiling);
    m.normalMap = maps.tilingNormal;
  }
  const ratio = def.breakup.tiling / def.tiling.tiling;
  const relief = sheets && maps.breakupNormal;
  patchShaders(m, 'gamepaint', (shader) => {
    shader.uniforms.uGhBreak = { value: maps.breakup ?? null };
    shader.uniforms.uGhBreakN = { value: maps.breakupNormal ?? null };
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uGhBreak;\nuniform sampler2D uGhBreakN;');
    if (maps.combine) fs = fs.replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r', 'texture2D( aoMap, vAoMapUv ).g'));
    fs = fs.replace(
      '#include <map_fragment>',
      `#include <map_fragment>${
        maps.combine
          ? `
  // (the paint under the hull's mask)
  vec4 ghMask = texture2D( aoMap, vAoMapUv );
  diffuseColor.rgb *= mix( 1.0, clamp( ghMask.r / ${f(def.combine.tone)}, 0.3, 2.0 ), ${f(MASK.tone)} ) * mix( 1.0, ghMask.g, ${f(MASK.ao)} ) * mix( ${f(MASK.edge[0])}, ${f(MASK.edge[1])}, ghMask.a ) * ( 1.0 - ${f(MASK.blot)} * ghMask.b );`
          : ''
      }${
        sheets
          ? `
  vec3 ghB = texture2D( uGhBreak, vNormalMapUv * ${f(ratio)} ).rgb / ${vec3(def.breakup.mean)};
  ghB = mix( vec3( dot( ghB, vec3( 0.2126, 0.7152, 0.0722 ) ) ), ghB, ${f(def.breakup.hue ?? 1)} );
  diffuseColor.rgb *= clamp( mix( vec3( 1.0 ), ghB, ${f(def.breakup.amount ?? 1)} ), 0.0, 2.0 );`
          : ''
      }`,
    );
    if (sheets)
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
  // (the panels' relief${def.tiling.rg ? ', its z rebuilt from its x and y' : ''}${relief ? ", and the breakup's over it, UDN: its red and green a normal's x and y" : ''})
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;${
    def.tiling.rg
      ? `
  mapN.z = sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) );`
      : ''
  }${
    relief
      ? `
  vec2 ghBn = texture2D( uGhBreakN, vNormalMapUv * ${f(ratio)} ).xy * 2.0 - 1.0;
  mapN = normalize( vec3( mapN.xy + ghBn * ${f(def.breakup.strength ?? 1)}, mapN.z ) );`
      : ''
  }
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#else
#include <normal_fragment_maps>
#endif`,
      );
    shader.fragmentShader = fs;
  });
  return m;
}

// a geometry from one frame into another: `from` its mesh's matrix in its
// own file, `to` the matrix of the mesh it stands in for, in that one's (a
// mirror's triangles put back the right way out).
// (The pack's meshes are quantized, KHR_mesh_quantization: their positions
// whole numbers its node's scale makes metres, their normals and tangents
// packed in shorts; each is widened to floats first, or moving it would
// round it back into its integers.)
export function inFrame(geometry, from, to) {
  const g = geometry.clone();
  for (const name of ['position', 'normal', 'tangent']) {
    const a = g.getAttribute(name);
    if (!a || a.array instanceof Float32Array) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  const m = new THREE.Matrix4().copy(to).invert().multiply(from);
  g.applyMatrix4(m);
  // (a mirror turns every triangle inside out: its corners put back in order,
  // and its tangents' handedness)
  if (m.determinant() < 0) {
    const t = g.getAttribute('tangent');
    if (t && t.itemSize === 4) for (let i = 0; i < t.count; i++) t.setW(i, -t.getW(i));
    if (!g.index) g.setIndex([...Array(g.getAttribute('position').count).keys()]);
    const index = g.index;
    for (let i = 0; i + 2 < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  }
  return g;
}

// the parts' geometries as one (the stand-in was one): the attributes all
// of them have, as floats, and one index
export function joined(list) {
  if (list.length === 1) return list[0];
  const names = ['position', 'normal', 'tangent', 'uv', 'uv1'].filter((n) => list.every((g) => g.getAttribute(n)));
  const count = list.reduce((sum, g) => sum + g.getAttribute('position').count, 0);
  const out = new THREE.BufferGeometry();
  for (const n of names) {
    const k = list[0].getAttribute(n).itemSize;
    const array = new Float32Array(count * k);
    let o = 0;
    for (const g of list) {
      const a = g.getAttribute(n);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < k; c++) array[o++] = a.getComponent(i, c);
    }
    out.setAttribute(n, new THREE.BufferAttribute(array, k));
  }
  const size = list.reduce((sum, g) => sum + (g.index ? g.index.count : g.getAttribute('position').count), 0);
  const index = count > 65535 ? new Uint32Array(size) : new Uint16Array(size);
  let o = 0;
  let base = 0;
  for (const g of list) {
    const n = g.getAttribute('position').count;
    if (g.index) for (let i = 0; i < g.index.count; i++) index[o++] = g.index.getX(i) + base;
    else for (let i = 0; i < n; i++) index[o++] = i + base;
    base += n;
  }
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

// ── loading ──
const meshes = new Map(); // url → Promise<{ geometry, matrix } | null>
const maps = new Map(); // url → Promise<Texture | null>

// a part of the pack's hull (its mesh whose material is `own`, a name or a
// pattern), parsed without its maps (the GLB names the pack's other
// materials' maps beside it: not wanted here)
function packMesh(url, own) {
  if (!meshes.has(url)) {
    const p = withFallback((u) =>
      fetch(u).then((r) => {
        if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
        return r.arrayBuffer();
      }),
    )(url)
      .then((bytes) => gltfLoader().parseAsync(splitTextures(bytes).buffer, ''))
      .then((gltf) => {
        let found = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          if (!found && o.isMesh && [o.material].flat().some((x) => (own instanceof RegExp ? own.test(x?.name ?? '') : x?.name === own))) found = { geometry: o.geometry, matrix: o.matrixWorld.clone() };
        });
        return found;
      })
      .catch(() => {
        meshes.delete(url);
        return null;
      });
    meshes.set(url, p);
  }
  return meshes.get(url);
}

export function packMap(path, size, { srgb, aniso, repeat }) {
  const url = `${path}.${size}.ktx2`;
  if (!maps.has(url)) {
    const p = ktx2Loader()
      .then((k) => withFallback((u) => k.loadAsync(u))(url))
      .then((t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = aniso;
        if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
      })
      .catch(() => {
        maps.delete(url);
        return null;
      });
    maps.set(url, p);
  }
  return maps.get(url);
}

// a cut's own game maps at the pack's sizes (GAME_MAPS): true when any came
export async function dressGameMaps(root, kind, { detail = 'high', phone = false, aniso = 8, loadTexture = packMap } = {}) {
  const def = GAME_MAPS[kind];
  if (!def || detail === 'low') return false;
  const meshes = [];
  root.traverse((o) => o.isMesh && [o.material].flat().some((m) => def.material.test(m?.name ?? '')) && meshes.push(o));
  if (!meshes.length) return false;
  if (def.windows) {
    const map = await loadTexture(def.windows, phone ? 512 : 1024, { aniso, srgb: false, repeat: true });
    if (!map) return false;
    swapAll(meshes, def, (m) => windowsMaterial(m, map));
    return true;
  }
  const size = sizesFor(detail, phone);
  const [colour, normal, orm] = await Promise.all([
    loadTexture(def.colour, size.atlas, { aniso, srgb: true }),
    loadTexture(def.normal, size.normal, { aniso, srgb: false }),
    loadTexture(def.orm, size.orm, { aniso, srgb: false }),
  ]);
  if (!colour && !normal && !orm) return false;
  swapAll(meshes, def, (m) => {
    const g = m.clone();
    g.userData.gameHull = true;
    if (colour) g.map = colour;
    if (normal) g.normalMap = normal;
    if (orm) {
      g.roughnessMap = orm;
      g.roughness = 1;
      g.aoMap = orm;
    }
    g.metalness = 0;
    g.metalnessMap = null;
    return g;
  });
  return true;
}

// each of the meshes' materials `def` names made over by `make`, once a material (the meshes share it)
function swapAll(meshes, def, make) {
  const made = new Map();
  const swap = (m) => {
    if (!m || !def.material.test(m.name ?? '')) return m;
    if (!made.has(m)) made.set(m, make(m));
    return made.get(m);
  };
  for (const mesh of meshes) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
}

// lit windows by the game's map of them (its ColorParallaxEmissiveOpacity:
// red the frame's grey, green a parallax's height, blue where a pane is lit,
// alpha the panes cut out): the frame its red, the light its blue, in
// capitalLook.js's window light; its alpha left whole (the shell sits off
// the hull, and would open holes in it), its parallax not drawn
const WINDOW_LIGHT = { colour: [1.0, 0.88, 0.7], intensity: 1.4 };
export function windowsMaterial(m, map) {
  const g = m.clone();
  g.userData.gameHull = true;
  g.map = null;
  g.color.setScalar(1);
  g.emissive.setRGB(...WINDOW_LIGHT.colour);
  g.emissiveIntensity = WINDOW_LIGHT.intensity;
  g.emissiveMap = map;
  g.metalness = 0;
  g.metalnessMap = null;
  patchShaders(g, 'gamewindows', (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', THREE.ShaderChunk.emissivemap_fragment.replace('totalEmissiveRadiance *= emissiveColor.rgb;', 'diffuseColor.rgb *= emissiveColor.r;\n\ttotalEmissiveRadiance *= emissiveColor.b;'));
  });
  return g;
}

// the size of a map the device asks for, among those published (`have`)
const fit = (want, have) => (!want || !have ? want : (have.filter((n) => n <= want).pop() ?? have[0]));

// a hull's game material: its maps at the device's sizes and the material
// over them, or null when its own map can't be had
async function materialOf(def, { detail, phone, aniso, loadTexture }) {
  const want = sizesFor(detail, phone);
  const size = Object.fromEntries(Object.entries(want).map(([k, n]) => [k, fit(n, def.have)]));
  const get = (path, n, opts) => (path && n ? loadTexture(path, n, { aniso, ...opts }) : Promise.resolve(null));
  const painted = Boolean(def.paint);
  const wanted = painted
    ? {
        combine: def.combine ? get(def.combine.map, size.atlas, { srgb: false }) : null,
        tilingNormal: get(def.tiling.normal, size.normal, { srgb: false, repeat: true }),
        breakup: get(def.breakup.colour, size.colour, { srgb: false, repeat: true }),
        breakupNormal: def.breakup.normal ? get(def.breakup.normal, size.normal, { srgb: false, repeat: true }) : null,
      }
    : {
        atlas: get(def.atlas.colour, size.atlas, { srgb: true }),
        orm: get(def.atlas.orm, size.orm, { srgb: false }),
        panels: get(def.panels.colour, size.colour, { srgb: true, repeat: true }),
        panelsNormal: get(def.panels.normal, size.normal, { srgb: false, repeat: true }),
        details: get(def.details.colour, size.colour, { srgb: true, repeat: true }),
        detailsNormal: get(def.details.normal, size.normal, { srgb: false, repeat: true }),
      };
  const got = await Promise.all(Object.entries(wanted).map(([k, v]) => Promise.resolve(v).then((t) => [k, t]))).then(Object.fromEntries);
  // (the hull's own map at the least, where it has one; and the sheets all or none)
  if (painted ? def.combine && !got.combine : !got.atlas) return null;
  // (the hull's sheets: those its def names, a colour sheet left out by a hull that has none)
  const sheetNames = painted
    ? ['tilingNormal', 'breakup', ...(def.breakup.normal ? ['breakupNormal'] : [])]
    : [['panels', def.panels.colour], ['panelsNormal', def.panels.normal], ['details', def.details.colour], ['detailsNormal', def.details.normal]].filter(([, path]) => path).map(([k]) => k);
  const maps = { ...got };
  if (!sheetNames.every((k) => maps[k])) for (const k of sheetNames) delete maps[k];
  return painted ? paintMaterial(maps, def) : hullMaterial(maps, def, { name: def.own });
}

export async function dressGameHull(root, kind, { detail = 'high', phone = false, aniso = 8, loadMesh = packMesh, loadTexture = packMap } = {}) {
  const def = GAME_HULLS[kind];
  if (!def) return false;
  // the stand-ins: the meshes whose material is the bare hull's
  root.updateMatrixWorld(true);
  const targets = [];
  root.traverse((o) => o.isMesh && [o.material].flat().some((m) => def.material.test(m?.name ?? '')) && targets.push(o));
  if (!targets.length) return false;
  const lod = phone ? def.lod.phone : def.lod.computer;
  const [parts, material] = await Promise.all([
    Promise.all(def.parts.map((p) => loadMesh(`${p.mesh}.lod${lod}.glb`, p.own))),
    def.keep ? null : materialOf(def, { detail, phone, aniso, loadTexture }),
  ]);
  // (every part, or the stand-in would lose what it held; and the game's material, where it has one)
  if (parts.some((p) => !p) || (!def.keep && !material)) return false;
  swapIn(root, targets, def, parts, material);
  return true;
}

// The space level a battle is fought in (spaceLevel.js) draws the pack's
// own hulls, the same meshes with both their UVs, and bare: each takes the
// game's material its kind has on the war's ship (one a kind, shared), so
// the level's Star Destroyers are the war's.
export const LEVEL_HULLS = [
  { kind: 'destroyer', material: /^M_Hull_01(_lods)?$/ },
  { kind: 'venator', material: /^M_VenatorStarDestroyer_(Hull_01|ControlTower_01|DetailBack_01)(_lods)?$/ },
  { kind: 'moncal', material: /^MC_80_Met(_lods)?$/ },
];
const levelMade = new Map(); // a kind → Promise<Material | null>
export function levelHull(name, { detail = 'high', phone = false, aniso = 8, loadTexture = packMap } = {}) {
  const row = LEVEL_HULLS.find((r) => r.material.test(name ?? ''));
  if (!row) return null;
  if (!levelMade.has(row.kind)) levelMade.set(row.kind, materialOf(GAME_HULLS[row.kind], { detail, phone, aniso, loadTexture }));
  return levelMade.get(row.kind);
}

// the parts, joined, in the first stand-in's place (and its material, unless
// `material` is null); any other stand-in is the same hull split, gone
function swapIn(root, targets, def, parts, material) {
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  targets.forEach((mesh, i) => {
    if (i > 0) {
      mesh.visible = false;
      return;
    }
    // the pack's frame is the kit's: the cut's `nose` (a fleet row's turn), or its root
    let kit = mesh.parent;
    while (kit && kit !== root && kit.name !== 'nose') kit = kit.parent;
    const frame = new THREE.Matrix4().multiplyMatrices(rootInverse, kit?.name === 'nose' ? kit.matrixWorld : root.matrixWorld);
    const to = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
    mesh.geometry = joined(parts.map((p, k) => inFrame(p.geometry, new THREE.Matrix4().multiplyMatrices(frame, def.parts[k].place ?? new THREE.Matrix4()).multiply(p.matrix), to)));
    if (material) mesh.material = material;
  });
}
