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
// The maps: the hull's map (t_stardestroyer_hull_01_cs, its colour, and its
// ORM's roughness) on UV1; the game's Star Destroyer panel and detail sheets
// (t_stardestroyerpanels_01, t_stardestroyerdetails_01: the sheets its far
// Star Destroyers wear, SS_StarDestroyerPanels_01) on UV0, the panels at the
// UV's own tiling and the details four times finer; each sheet's colour
// divided by its mean (so the hull's map keeps its own grey) and its normal
// blended over the panels' (UDN, as lib/three/surface/gameMaterial.js blends
// a detail). A phone takes them smaller; the lowest detail the hull's map
// alone; a failed load leaves the ship as it came (plated, capitalLook.js).
//
// GAME_HULLS (kind → its hull's files), sizesFor(detail, phone),
// dressGameHull(root, kind, { detail, phone, aniso, loadMesh, loadTexture })
// → Promise<boolean> (true when the game's hull is on), hullMaterial(maps,
// def, { name }) and inFrame(geometry, from, to) are the parts, for tests.

import * as THREE from 'three';
import { withFallback } from '../../lib/assetBase';
import { gltfLoader, ktx2Loader } from '../../lib/three/gltf';
import { patchShaders } from './capitalPlating';
import { splitTextures } from './surface/level/levelPack.js';

const LEVELS = '/models/galaxy/bf2017/levels';
const tex = (level, name) => `${LEVELS}/${level}/tex/${name}`;

// a sheet's colour, linear, averaged over the whole map (its smallest mip:
// measured on the published 2048 rows), which its colour is divided by
export const GAME_HULLS = {
  destroyer: {
    // (the fleet's and the ultra cut's hull, by its material's name; the pack's own)
    material: /^M_Hull_01(_lods)?$/,
    own: 'M_Hull_01',
    mesh: `${LEVELS}/sb_endor/meshes/stardestroyer_hull_01_sb_endor_mesh.lod0.glb`,
    atlas: { colour: tex('sb_endor', 't_stardestroyer_hull_01_cs'), orm: tex('sb_endor', 't_stardestroyer_hull_01_cs__orm_240cdb7c') },
    panels: { colour: tex('sb_endor', 't_stardestroyerpanels_01_cs'), normal: tex('sb_endor', 't_stardestroyerpanels_01_nw__normal'), mean: [0.795, 0.792, 0.699], tiling: 1 },
    details: { colour: tex('sb_endor', 't_stardestroyerdetails_01_cs'), normal: tex('sb_endor', 't_stardestroyerdetails_01_nw__normal'), mean: [0.769, 0.768, 0.7], tiling: 4, strength: 0.8 },
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

// ── loading ──
const meshes = new Map(); // url → Promise<{ geometry, matrix } | null>
const maps = new Map(); // url → Promise<Texture | null>

// the pack's hull, parsed without its maps (the GLB names the pack's other
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
          if (!found && o.isMesh && [o.material].flat().some((x) => x?.name === own)) found = { geometry: o.geometry, matrix: o.matrixWorld.clone() };
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

export async function dressGameHull(root, kind, { detail = 'high', phone = false, aniso = 8, loadMesh = packMesh, loadTexture = packMap } = {}) {
  const def = GAME_HULLS[kind];
  if (!def) return false;
  // the stand-ins: the meshes whose material is the bare hull's
  root.updateMatrixWorld(true);
  const targets = [];
  root.traverse((o) => o.isMesh && [o.material].flat().some((m) => def.material.test(m?.name ?? '')) && targets.push(o));
  if (!targets.length) return false;
  const size = sizesFor(detail, phone);
  const get = (path, n, opts) => (path && n ? loadTexture(path, n, { aniso, ...opts }) : Promise.resolve(null));
  const [pack, atlas, orm, panels, panelsNormal, details, detailsNormal] = await Promise.all([
    loadMesh(def.mesh, def.own),
    get(def.atlas.colour, size.atlas, { srgb: true }),
    get(def.atlas.orm, size.orm, { srgb: false }),
    get(def.panels.colour, size.colour, { srgb: true, repeat: true }),
    get(def.panels.normal, size.normal, { srgb: false, repeat: true }),
    get(def.details.colour, size.colour, { srgb: true, repeat: true }),
    get(def.details.normal, size.normal, { srgb: false, repeat: true }),
  ]);
  // (the hull's own map at the least, and the sheets all or none)
  if (!pack || !atlas) return false;
  const sheets = panels && panelsNormal && details && detailsNormal;
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  targets.forEach((mesh, i) => {
    // (the first stand-in takes the whole hull; any other is the same hull split, gone)
    if (i > 0) {
      mesh.visible = false;
      return;
    }
    const to = new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld);
    mesh.geometry = inFrame(pack.geometry, pack.matrix, to);
    mesh.material = hullMaterial(sheets ? { atlas, orm, panels, panelsNormal, details, detailsNormal } : { atlas, orm }, def, { name: def.own });
  });
  return true;
}
