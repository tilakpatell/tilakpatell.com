// A capital drawn from the space level's own parts, as the game builds it.
// The war's Star Destroyer was the space kit's cut (scripts/bf2017-space.mjs):
// its eighty-odd parts each at the lightest of the game's six LODs (the
// command bridge 1,554 triangles of its 33,661), their maps at 1,024, and
// on most of them the two UV sets swapped (its colour on the tiling set, its
// detail normal on the unique one), so the superstructure and the deck's
// details were a smear of the wrong maps over coarse blocks, under the
// hull's game paint: two ships in one. The level pack (sb_endor) keeps every
// part whole at each LOD with both UV sets and their tangents, and the
// game's 2,048 maps; so the kit is drawn from those, each part where the
// level stands it round the hull (src/data/galaxy/kits/<kind>.json, from
// the map: scripts/bf2017-kit-places.mjs), in the cut's own frame (its
// `nose`, as capitalHull.js swaps the hull in), the cut's parts gone.
//
// Each material as the pack's GLB binds it (the game's
// SS_PropsMetallicPreset_2UV_TextureArray_01: the colour (_CS, sRGB) and its
// smoothness on the unique set, the detail normal (_NAM) on the tiling set;
// SS_StarDestroyer_2UV_TextureArray_0x: all three on the unique set): the
// colour, the normal through the part's own tangents, the roughness the
// ORM's green (one less the colour's smoothness), a dielectric (the ORM's
// blue, the metal, is laid out on the colour's UVs from the normal's, not
// the game's: left off, as on the hull), F0 0.04 (the game's reflectance
// 0.5). Not drawn: the texture array the game's NAM.b picks a slice of
// (the props' A_Generic_01, a metal grain a metre across). The windows
// (SS_StarDestroyer_Windows_01: a warm light, EmissiveColor 1, 1, 0.52, its
// panes a heightmap's, which the bucket hasn't got) are lit on their own
// UVs' grid, a pane each cell (half a unit across, 1.4 m, a unit up, 2 m),
// a frame round it, some dark, their mean far off (windowsMaterial). Each
// material is the game's (`userData.gameHull`): no paint, no plating over
// it; an engine's burns aft as every engine does.
//
// The parts' LOD and map sizes by the device: the superstructure (the
// towers, the domes, the bridge, the batteries: what a fighter flies past)
// a LOD finer than the rest. A failed part leaves the ship as it came.
//
//   GAME_KITS (kind → its kit), lodsFor(detail, phone) → [top, rest] | null,
//   mapSize(row, slug, tier), kitMaterial(def, maps), windowsMaterial(def) and
//   dressGameKit(root, kind, { detail, phone, aniso, loadPart, loadTexture }) → Promise<boolean>

import * as THREE from 'three';
import DESTROYER from '../../data/galaxy/kits/destroyer.json';
import { withFallback } from '../../lib/assetBase';
import { gltfLoader } from '../../lib/three/gltf';
import { inFrame, joined, packMap } from './capitalHull';
import { patchShaders } from './capitalPlating';
import { onChannel } from './surface/level/levelGltf.js';
import { splitTextures } from './surface/level/levelPack.js';

const LEVELS = '/models/galaxy/bf2017/levels';
export const GAME_KITS = { destroyer: DESTROYER };

// the superstructure: the parts a fighter flies closest past
const TOP = /communicationstower|deflectorshield|detailscommandbridge|detailshulltop|heavyturbolaser/;
// the hull's own material, capitalHull.js's (its stand-in kept for it to swap)
const HULL = /^M_Hull_01(_lods)?$/;
const WINDOW = /window/i;

// the LODs a part is drawn at, [superstructure, the rest]; the lowest
// detail keeps the cut (ultra about 290,000 triangles, high 150,000, mid
// 83,000, a phone 49,000; the cut was 37,000)
export function lodsFor(detail, phone = false) {
  if (detail === 'low') return null;
  if (phone) return [4, 5];
  if (detail === 'mid') return [3, 4];
  if (detail === 'high') return [2, 3];
  return [1, 2];
}

// a map's size: the pack's row for the tier (the colour 2,048 on ultra,
// 1,024 on high and mid, 512 on a phone; the normal 2,048, 512, 512, 256),
// the ORM, a roughness alone, no finer than 512
export function mapSize(row, slug, tier) {
  const size = row?.[tier] ?? row?.high ?? 512;
  return /__orm/.test(slug) ? Math.min(size, 512) : size;
}
const tierOf = (detail, phone) => (phone ? 'low' : detail === 'ultra' ? 'ultra' : detail === 'mid' ? 'mid' : 'high');

// ── a part: every primitive of its GLB (geometry, its matrix in the file,
// its material's name and the maps it names, each on its UV set)
const parts = new Map(); // url → Promise<{ prims } | null>
function packPart(url) {
  if (!parts.has(url)) {
    const p = withFallback((u) =>
      fetch(u).then((r) => {
        if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status });
        return r.arrayBuffer();
      }),
    )(url)
      .then(async (bytes) => {
        const { buffer, slots } = splitTextures(bytes);
        const json = glbJson(buffer);
        const gltf = await gltfLoader().parseAsync(buffer, '');
        gltf.scene.updateMatrixWorld(true);
        const prims = [];
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          const index = (json.materials ?? []).findIndex((m) => m.name === o.material?.name);
          const def = json.materials?.[index] ?? {};
          prims.push({
            geometry: o.geometry,
            matrix: o.matrixWorld.clone(),
            material: {
              name: def.name ?? o.material?.name ?? '',
              roughness: def.pbrMetallicRoughness?.roughnessFactor ?? 1,
              slots: slots.filter((s) => s.material === index).map((s) => ({ slot: s.slot, slug: slugOf(s.uri), texCoord: s.texCoord ?? 0 })),
            },
          });
        });
        return { prims };
      })
      .catch(() => {
        parts.delete(url);
        return null;
      });
    parts.set(url, p);
  }
  return parts.get(url);
}
const slugOf = (uri) => uri.split('/').pop().replace(/\.ktx2$/, '');
function glbJson(buffer) {
  const v = new DataView(buffer);
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, v.getUint32(12, true))));
}

// a part's material, the game's: its maps as the GLB binds them
//   def: { name, roughness, slots: [{ slot, slug, texCoord }] }; maps: slug → Texture | null
export function kitMaterial(def, maps) {
  if (WINDOW.test(def.name)) return windowsMaterial(def);
  const m = new THREE.MeshStandardMaterial({ name: `${def.name}|game`, color: 0xffffff, roughness: def.roughness, metalness: 0 });
  m.userData.gameHull = true;
  for (const { slot, slug, texCoord } of def.slots) {
    const t = onChannel(maps[slug] ?? null, texCoord);
    if (!t) continue;
    if (slot === 'map') m.map = t;
    else if (slot === 'normalMap') m.normalMap = t;
    else if (slot === 'metalRough') {
      m.roughnessMap = t;
      m.roughness = 1;
    }
  }
  // (a colour map that didn't come: the hull's grey, not white)
  if (!m.map) m.color.set(0x8a8f96);
  return m;
}

// the windows: a grey frame, and in it a pane a cell of their UVs' grid
// lit in the game's warm light (its windows all burn, EmissiveIntensity
// 500,000: a few in seven dark here), each its own brightness; where a
// pixel spans a cell, their mean
export const WINDOW_LIGHT = { colour: [1, 0.96, 0.62], intensity: 1.5, lit: 0.85 };
export function windowsMaterial(def) {
  const m = new THREE.MeshStandardMaterial({ name: `${def.name}|game`, color: 0x4a4d52, roughness: 0.5, metalness: 0 });
  m.userData.gameHull = true;
  m.emissive.setRGB(...WINDOW_LIGHT.colour);
  m.emissiveIntensity = WINDOW_LIGHT.intensity;
  m.defines = { USE_UV: '' };
  patchShaders(m, 'kitwindows', (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
  // (a pane a cell: half a unit across, a unit up; its frame round it)
  vec2 kwCell = vUv * vec2( 2.0, 1.0 );
  vec2 kwF = fract( kwCell );
  float kwPane = step( 0.18, kwF.x ) * step( kwF.x, 0.82 ) * step( 0.22, kwF.y ) * step( kwF.y, 0.78 );
  float kwHash = fract( sin( dot( floor( kwCell ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  float kwOn = kwPane * step( 1.0 - ${WINDOW_LIGHT.lit.toFixed(2)}, kwHash ) * ( 0.65 + 0.35 * fract( kwHash * 7.13 ) );
  // (the mean where a pixel spans a cell: no sparkle far off)
  float kwMean = 0.64 * 0.56 * ${WINDOW_LIGHT.lit.toFixed(2)} * 0.82;
  totalEmissiveRadiance *= mix( kwOn, kwMean, smoothstep( 0.35, 1.0, length( fwidth( kwCell ) ) ) );`,
    );
  });
  return m;
}

export async function dressGameKit(root, kind, { detail = 'high', phone = false, aniso = 8, loadPart = packPart, loadTexture = packMap } = {}) {
  const kit = GAME_KITS[kind];
  const lods = lodsFor(detail, phone);
  if (!kit || !lods) return false;
  root.updateMatrixWorld(true);
  // the cut's parts (all but the hull, capitalHull.js's) and its frame
  let nose = null;
  const cut = [];
  root.traverse((o) => {
    if (!nose && o.name === 'nose') nose = o;
    if (o.isMesh && ![o.material].flat().some((m) => HULL.test(m?.name ?? ''))) cut.push(o);
  });
  const frame = nose ?? root;
  const urlOf = (mesh) => `${LEVELS}/${kit.level}/meshes/${mesh}.lod${Math.min(TOP.test(mesh) ? lods[0] : lods[1], (kit.lods[mesh] ?? 1) - 1)}.glb`;
  const meshes = [...new Set(kit.parts.map((p) => p[0]))];
  const loaded = new Map(await Promise.all(meshes.map((mesh) => loadPart(urlOf(mesh)).then((part) => [mesh, part]))));
  // (every part, or the ship would lose what it held)
  if ([...loaded.values()].some((p) => !p)) return false;
  // the maps, each once, at the tier's size
  const tier = tierOf(detail, phone);
  const slugs = new Map();
  for (const part of loaded.values()) for (const prim of part.prims) for (const s of prim.material.slots) slugs.set(s.slug, s.slot === 'map');
  const maps = Object.fromEntries(
    await Promise.all(
      [...slugs].map(([slug, colour]) => loadTexture(`${LEVELS}/${kit.level}/tex/${slug}`, mapSize(kit.tex[slug], slug, tier), { aniso, srgb: colour, repeat: true }).then((t) => [slug, t])),
    ),
  );
  // the parts' primitives in the kit's frame, joined a material at a time
  const materials = new Map(); // a material's signature → { material, list }
  for (const [mesh, at, q, s] of kit.parts) {
    const place = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion(...q), new THREE.Vector3(...s));
    for (const prim of loaded.get(mesh).prims) {
      const key = `${prim.material.name}|${prim.material.slots.map((x) => `${x.slot}:${x.slug}:${x.texCoord}`).join(',')}`;
      if (!materials.has(key)) materials.set(key, { def: prim.material, list: [] });
      materials.get(key).list.push(inFrame(prim.geometry, new THREE.Matrix4().multiplyMatrices(place, prim.matrix), new THREE.Matrix4()));
    }
  }
  for (const o of cut) o.parent?.remove(o);
  for (const { def, list } of materials.values()) {
    const mesh = new THREE.Mesh(joined(list), kitMaterial(def, maps));
    mesh.name = `kit:${def.name}`;
    frame.add(mesh);
  }
  root.updateMatrixWorld(true);
  return true;
}
