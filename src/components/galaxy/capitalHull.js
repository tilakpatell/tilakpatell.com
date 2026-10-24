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
// colour, and its ORM's roughness) on UV1; the game's Star Destroyer panel
// and detail sheets (t_stardestroyerpanels_01, t_stardestroyerdetails_01:
// the sheets its far Star Destroyers wear, SS_StarDestroyerPanels_01) on
// UV0, the panels at the UV's own tiling and the details four times finer;
// each sheet's colour divided by its mean (so the hull's map keeps its own
// grey) and its normal blended over the panels' (UDN, as
// lib/three/surface/gameMaterial.js blends a detail).
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
// A phone takes the maps smaller (and the Venator's parts a level coarser);
// the lowest detail the hull's map alone; a failed load leaves the ship as
// it came (plated, capitalLook.js).
//
// GAME_HULLS (kind → its hull's files), sizesFor(detail, phone),
// dressGameHull(root, kind, { detail, phone, aniso, loadMesh, loadTexture })
// → Promise<boolean> (true when the game's hull is on), hullMaterial(maps,
// def, { name }), combineMaterial(maps, def, { name }) and inFrame(geometry,
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
    panels: { colour: tex('sb_endor', 't_stardestroyerpanels_01_cs'), normal: tex('sb_endor', 't_stardestroyerpanels_01_nw__normal'), mean: [0.795, 0.792, 0.699], tiling: 1 },
    details: { colour: tex('sb_endor', 't_stardestroyerdetails_01_cs'), normal: tex('sb_endor', 't_stardestroyerdetails_01_nw__normal'), mean: [0.769, 0.768, 0.7], tiling: 4, strength: 0.8 },
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
// from UV0's slopes; the details' colour and normal and the panels' colour
// patched in)
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
  patchShaders(m, 'gamehull', (shader) => {
    shader.uniforms.uGhPanels = { value: maps.panels };
    shader.uniforms.uGhDetails = { value: maps.details };
    shader.uniforms.uGhDetailsN = { value: maps.detailsNormal };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGhPanels;\nuniform sampler2D uGhDetails;\nuniform sampler2D uGhDetailsN;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  // (the sheets over the hull's map, each by its own mean: the map's grey kept)
  vec3 ghPanel = texture2D( uGhPanels, vNormalMapUv ).rgb / ${vec3(def.panels.mean)};
  vec3 ghDetail = texture2D( uGhDetails, vNormalMapUv * ${f(ratio)} ).rgb / ${vec3(def.details.mean)};
  diffuseColor.rgb *= clamp( ghPanel * ghDetail, 0.0, 2.0 );`,
      )
      .replace(
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
  });
  return m;
}

// the Venator's: its paint under the hull's mask on UV1 (its red the
// patchwork and grime, by its mean; its green the occlusion, half of it in
// the paint and the whole of it on the light from the sky and the
// environment, three's own AO read from green; its alpha the plates' edges;
// its blue the blotches), and on UV0 the panel sheet's relief with the
// breakup's colour (by its mean) and relief over it, UDN
const MASK = { tone: 0.5, ao: 0.5, edge: [0.8, 1.1], blot: 0.35 };
export function combineMaterial(maps, def, { name = def.own } = {}) {
  const m = new THREE.MeshStandardMaterial({ name: `${name}|game`, color: def.paint, roughness: 0.62, metalness: 0 });
  m.userData.gameHull = true;
  maps.combine.channel = 1;
  m.aoMap = maps.combine;
  const sheets = maps.tilingNormal && maps.breakup && maps.breakupNormal;
  if (sheets) {
    maps.tilingNormal.channel = 0;
    maps.tilingNormal.repeat.setScalar(def.tiling.tiling);
    m.normalMap = maps.tilingNormal;
  }
  const ratio = def.breakup.tiling / def.tiling.tiling;
  patchShaders(m, 'gamecombine', (shader) => {
    shader.uniforms.uGhBreak = { value: maps.breakup };
    shader.uniforms.uGhBreakN = { value: maps.breakupNormal };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uGhBreak;\nuniform sampler2D uGhBreakN;')
      .replace('#include <aomap_fragment>', THREE.ShaderChunk.aomap_fragment.replace('texture2D( aoMap, vAoMapUv ).r', 'texture2D( aoMap, vAoMapUv ).g'))
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
  // (the paint under the hull's mask)
  vec4 ghMask = texture2D( aoMap, vAoMapUv );
  diffuseColor.rgb *= mix( 1.0, clamp( ghMask.r / ${f(def.combine.tone)}, 0.3, 2.0 ), ${f(MASK.tone)} ) * mix( 1.0, ghMask.g, ${f(MASK.ao)} ) * mix( ${f(MASK.edge[0])}, ${f(MASK.edge[1])}, ghMask.a ) * ( 1.0 - ${f(MASK.blot)} * ghMask.b );${
    sheets
      ? `
  diffuseColor.rgb *= clamp( texture2D( uGhBreak, vNormalMapUv * ${f(ratio)} ).rgb / ${vec3(def.breakup.mean)}, 0.0, 2.0 );`
      : ''
  }`,
      );
    if (sheets)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#ifdef USE_NORMALMAP_TANGENTSPACE
  // (the breakup's relief over the panels', UDN: its red and green a normal's x and y)
  vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
  vec2 ghBn = texture2D( uGhBreakN, vNormalMapUv * ${f(ratio)} ).xy * 2.0 - 1.0;
  mapN = normalize( vec3( mapN.xy + ghBn * ${f(def.breakup.strength ?? 1)}, mapN.z ) );
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#else
#include <normal_fragment_maps>
#endif`,
      );
  });
  return m;
}

// a geometry from one frame into another: `from` its mesh's matrix in its
// own file, `to` the matrix of the mesh it stands in for, in that one's.
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
  return g.applyMatrix4(new THREE.Matrix4().copy(to).invert().multiply(from));
}

// the parts' geometries as one (the stand-in was one): the attributes all
// of them have, as floats, and one index
export function joined(list) {
  if (list.length === 1) return list[0];
  const names = ['position', 'normal', 'uv', 'uv1'].filter((n) => list.every((g) => g.getAttribute(n)));
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

function packMap(path, size, { srgb, aniso, repeat }) {
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
  const size = sizesFor(detail, phone);
  const [colour, normal, orm] = await Promise.all([
    loadTexture(def.colour, size.atlas, { aniso, srgb: true }),
    loadTexture(def.normal, size.normal, { aniso, srgb: false }),
    loadTexture(def.orm, size.orm, { aniso, srgb: false }),
  ]);
  if (!colour && !normal && !orm) return false;
  const made = new Map(); // the cut's material → its game one (the meshes share it)
  const swap = (m) => {
    if (!m || !def.material.test(m.name ?? '')) return m;
    if (!made.has(m)) {
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
      made.set(m, g);
    }
    return made.get(m);
  };
  for (const mesh of meshes) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  return true;
}

// the size of a map the device asks for, among those published (`have`)
const fit = (want, have) => (!want || !have ? want : (have.filter((n) => n <= want).pop() ?? have[0]));

export async function dressGameHull(root, kind, { detail = 'high', phone = false, aniso = 8, loadMesh = packMesh, loadTexture = packMap } = {}) {
  const def = GAME_HULLS[kind];
  if (!def) return false;
  // the stand-ins: the meshes whose material is the bare hull's
  root.updateMatrixWorld(true);
  const targets = [];
  root.traverse((o) => o.isMesh && [o.material].flat().some((m) => def.material.test(m?.name ?? '')) && targets.push(o));
  if (!targets.length) return false;
  const want = sizesFor(detail, phone);
  const size = Object.fromEntries(Object.entries(want).map(([k, n]) => [k, fit(n, def.have)]));
  const lod = phone ? def.lod.phone : def.lod.computer;
  const get = (path, n, opts) => (path && n ? loadTexture(path, n, { aniso, ...opts }) : Promise.resolve(null));
  const mask = Boolean(def.combine);
  const [parts, own, sheets] = await Promise.all([
    Promise.all(def.parts.map((p) => loadMesh(`${p.mesh}.lod${lod}.glb`, p.own))),
    // (the hull's own map at the least)
    mask ? Promise.all([get(def.combine.map, size.atlas, { srgb: false })]) : Promise.all([get(def.atlas.colour, size.atlas, { srgb: true }), get(def.atlas.orm, size.orm, { srgb: false })]),
    // (and the sheets all or none)
    mask
      ? Promise.all([get(def.tiling.normal, size.normal, { srgb: false, repeat: true }), get(def.breakup.colour, size.colour, { srgb: false, repeat: true }), get(def.breakup.normal, size.normal, { srgb: false, repeat: true })])
      : Promise.all([get(def.panels.colour, size.colour, { srgb: true, repeat: true }), get(def.panels.normal, size.normal, { srgb: false, repeat: true }), get(def.details.colour, size.colour, { srgb: true, repeat: true }), get(def.details.normal, size.normal, { srgb: false, repeat: true })]),
  ]);
  // (every part, or the stand-in would lose what it held)
  if (parts.some((p) => !p) || !own[0]) return false;
  const all = sheets.every(Boolean);
  const material = mask
    ? combineMaterial({ combine: own[0], ...(all ? { tilingNormal: sheets[0], breakup: sheets[1], breakupNormal: sheets[2] } : {}) }, def)
    : hullMaterial({ atlas: own[0], orm: own[1], ...(all ? { panels: sheets[0], panelsNormal: sheets[1], details: sheets[2], detailsNormal: sheets[3] } : {}) }, def, { name: def.own });
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  targets.forEach((mesh, i) => {
    // (the first stand-in takes the whole hull; any other is the same hull split, gone)
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
    mesh.material = material;
  });
  return true;
}
