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
// level stands it round the hull (src/data/galaxy/kits/<kit slug>.json,
// from the map: scripts/bf2017-kit-places.mjs), in the cut's own frame (its
// `nose`, as capitalHull.js swaps the hull in), the cut's parts gone. A
// level's kit stands its own way (Fondor's Star Destroyer in its dry dock
// is 91 parts, Endor's 83); a part its pack left out (Fondor's domes and
// batteries) is the same game mesh from another's, and wears that pack's
// maps.
//
// Each material as the pack's GLB binds it (the game's
// SS_PropsMetallicPreset_2UV_TextureArray_01: the colour (_CS, sRGB) and its
// smoothness on the unique set, the detail normal (_NAM) on the tiling set;
// SS_StarDestroyer_2UV_TextureArray_0x: all three on the unique set): the
// colour, the normal through the part's own tangents, the roughness the
// ORM's green (one less the colour's smoothness), and the metal the ORM's
// blue where the normal it came from is on the colour's set (the
// TextureArray_02 parts), as the level's own ISDs take it (levelGltf.js's
// ormMetal); where it isn't (the props preset's), that blue is another
// layout's and the part a dielectric, F0 0.04 (the game's reflectance
// 0.5). Not drawn: the texture array the game's NAM.b picks a slice of (the
// props' A_Generic_01, a metal grain a metre across). The windows
// (SS_StarDestroyer_Windows_01: a warm light, EmissiveColor 1, 1, 0.52) are
// lit on their own UVs' grid, a pane each cell (half a unit across, 1.4 m,
// a unit up, 2 m), its shape the game's own heightmap's (its
// ParallaxOcclusionHeightmap, published with Bespin's pack: a trapezoid,
// and one upside down beside it, their recess the pane), a plain pane in a
// frame while it comes or if it doesn't; some dark, their mean far off
// (windowsMaterial, paneHeight, withPanes). Each
// material is the game's (`userData.gameHull`): no paint, no plating over
// it; an engine's burns aft as every engine does.
//
// The parts' LOD and map sizes by the device: the superstructure (the
// towers, the domes, the bridge, the batteries: what a fighter flies past)
// a LOD finer than the rest. A failed part leaves the ship as it came. The
// kit is put together a few milliseconds at a time, the frame drawn between
// (150,000 triangles at high, about 130 ms in one go), into meshes of no more
// than MESH_TRIS, for cutting the ship apart (models.js's cutLater, a mesh a
// step) to stay a few milliseconds a step too.
//
//   GAME_KITS (a kit's slug → its kit), kitOf(key) (a slug's, or a kind's:
//   the war's Star Destroyer is Endor's), lodsFor(detail, phone) → [top,
//   rest] | null, mapSize(row, slug, tier), kitMaterial(def, maps),
//   windowsMaterial(def), paneHeight(loadTexture, phone), withPanes(m, map) and
//   dressGameKit(root, key, { detail, phone, aniso, loadPart, loadTexture }) → Promise<boolean>

import * as THREE from 'three';
import ENDOR_ISD from '../../data/galaxy/kits/endor-isd.json';
import FONDOR_ISD from '../../data/galaxy/kits/fondor-isd.json';
import { withFallback } from '../../lib/assetBase';
import { gltfLoader } from '../../lib/three/gltf';
import { inFrame, joined, packMap } from './capitalHull';
import { MAPPED_METAL } from './capitalLook';
import { patchShaders } from './capitalPlating';
import { onChannel, ormMetal } from './surface/level/levelGltf.js';
import { splitTextures } from './surface/level/levelPack.js';

const LEVELS = '/models/galaxy/bf2017/levels';
export const GAME_KITS = { 'endor-isd': ENDOR_ISD, 'fondor-isd': FONDOR_ISD };
const KIND_KITS = { destroyer: 'endor-isd' };
export const kitOf = (key) => GAME_KITS[key] ?? GAME_KITS[KIND_KITS[key]] ?? null;

// the superstructure: the parts a fighter flies closest past
const TOP = /communicationstower|deflectorshield|detailscommandbridge|detailshulltop|heavyturbolaser/;
// the hull's own material, capitalHull.js's (its stand-in kept for it to swap)
const HULL = /^M_Hull_01(_lods)?$/;
// (the hull's GLB's damage plane, the game's destruction shader's: drawn when a ship is hit, not here)
const DAMAGE = /^Burning$/;
const WINDOW = /window/i;
// (a joined mesh's most triangles, and the most milliseconds put together between frames)
export const MESH_TRIS = 12000;
const SLICE_MS = 6;

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
              metallic: def.pbrMetallicRoughness?.metallicFactor ?? 1,
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
//   def: { name, roughness, metallic, slots: [{ slot, slug, texCoord }] }; maps: slug → Texture | null
export function kitMaterial(def, maps) {
  if (WINDOW.test(def.name)) return windowsMaterial(def);
  const m = new THREE.MeshStandardMaterial({ name: `${def.name}|game`, color: 0xffffff, roughness: def.roughness, metalness: 0 });
  m.userData.gameHull = true;
  // (the level loader's rule, its slots a GLB's: these all the one material's)
  const metal = ormMetal(def.slots.map((x) => ({ ...x, material: 0 })), 0);
  for (const { slot, slug, texCoord } of def.slots) {
    const t = onChannel(maps[slug] ?? null, texCoord);
    if (!t) continue;
    if (slot === 'map') m.map = t;
    else if (slot === 'normalMap') m.normalMap = t;
    else if (slot === 'metalRough') {
      m.roughnessMap = t;
      m.roughness = 1;
      if (metal) {
        // (and no more of it than any capital's map keeps, capitalLook.js's
        // MAPPED_METAL: at the GLB's 1, the panels mirrored the sky's star
        // and a whole ship flared white at some angles)
        m.metalnessMap = t;
        m.metalness = Math.min(def.metallic ?? 1, MAPPED_METAL);
      }
    }
  }
  // (a colour map that didn't come: the hull's grey, not white)
  if (!m.map) m.color.set(0x8a8f96);
  return m;
}

// the windows: a grey frame, and in it a pane a cell of their UVs' grid
// lit in the game's warm light (its windows all burn, EmissiveIntensity
// 500,000: a few in seven dark here), each its own brightness, a dark one
// dark glass; where a pixel spans a cell, their mean
export const WINDOW_LIGHT = { colour: [1, 0.96, 0.62], intensity: 1.5, lit: 0.85 };
// the game's heightmap of the panes (512 × 256: two panes, a cell each, the
// surface white, the recess black with the pane's inside in it), and a
// pane's mean over its cell: the plain one's 0.36 (all lit inside), the
// heightmap's 0.196 (its recess 0.23 of a cell, lit 0.8 at its floor; read
// over the map's own top mip)
export const WINDOW_HEIGHT = `${LEVELS}/bespin/m2bes/tex/t_stardestroyer_windows_01_h`;
export const PANE_MEAN = { plain: 0.64 * 0.56, height: 0.196 };
// (where a pixel spans this much of a cell, the mean takes over: a plain
// pane's edges alias past a third of one; the heightmap's mips smear its
// recess away from about 1/16 of a cell on its 512 (a cell 16 texels at mip
// 4, the panes gone by mip 7), on a phone's 256 a mip sooner)
const BLUR = { plain: [0.35, 1.0], height: [0.06, 0.25] };
export const paneHeight = (loadTexture = packMap, phone = false) => loadTexture(WINDOW_HEIGHT, phone ? 256 : 512, { aniso: 4, srgb: false, repeat: true });
// the heightmap on a windows material, when it comes (its uniforms read each frame: no new program)
export function withPanes(m, map) {
  if (!map || !m?.userData.panes) return m;
  m.userData.panes.height.value = map;
  m.userData.panes.use.value = 1;
  // (the blend to the mean as far in as the map's width says its mips hold the panes)
  const k = 512 / (map.image?.width || map.mipmaps?.[0]?.width || 512);
  m.userData.panes.blur.value.set(BLUR.height[0] * k, BLUR.height[1] * k);
  return m;
}
export function windowsMaterial(def) {
  const m = new THREE.MeshStandardMaterial({ name: `${def.name}|game`, color: 0x4a4d52, roughness: 0.5, metalness: 0 });
  m.userData.gameHull = true;
  m.emissive.setRGB(...WINDOW_LIGHT.colour);
  m.emissiveIntensity = WINDOW_LIGHT.intensity;
  m.defines = { USE_UV: '' };
  const panes = { height: { value: null }, use: { value: 0 }, blur: { value: new THREE.Vector2(...BLUR.height) } };
  m.userData.panes = panes;
  const lit = WINDOW_LIGHT.lit.toFixed(2);
  patchShaders(m, 'kitwindows', (shader) => {
    shader.uniforms.kwHeight = panes.height;
    shader.uniforms.kwUse = panes.use;
    shader.uniforms.kwBlur = panes.blur;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D kwHeight;\nuniform float kwUse;\nuniform vec2 kwBlur;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
  // (a pane a cell: half a unit across, a unit up; the game's from its
  // heightmap, the recess the pane, the inside of it a little lit and
  // shaded as its depth goes; a plain one in a frame till that comes)
  vec2 kwCell = vUv * vec2( 2.0, 1.0 );
  vec2 kwF = fract( kwCell );
  float kwPlain = step( 0.18, kwF.x ) * step( kwF.x, 0.82 ) * step( 0.22, kwF.y ) * step( kwF.y, 0.78 );
  float kwH = texture2D( kwHeight, vUv ).r;
  float kwPane = mix( kwPlain, ( 1.0 - smoothstep( 0.15, 0.55, kwH ) ) * ( 0.8 + 1.3 * kwH ), kwUse );
  float kwHash = fract( sin( dot( floor( kwCell ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  float kwLit = step( 1.0 - ${lit}, kwHash );
  float kwOn = kwPane * kwLit * ( 0.65 + 0.35 * fract( kwHash * 7.13 ) );
  // (the mean where a pixel spans a cell: no sparkle far off)
  vec2 kwFrom = mix( vec2( ${BLUR.plain.map((v) => v.toFixed(2)).join(', ')} ), kwBlur, kwUse );
  float kwFar = smoothstep( kwFrom.x, kwFrom.y, length( fwidth( kwCell ) ) );
  float kwMean = mix( ${PANE_MEAN.plain.toFixed(4)}, ${PANE_MEAN.height.toFixed(4)}, kwUse ) * ${lit} * 0.82;
  totalEmissiveRadiance *= mix( kwOn, kwMean, kwFar );
  // (a dark pane dark glass in its frame, close to)
  diffuseColor.rgb *= 1.0 - 0.7 * min( kwPane, 1.0 ) * ( 1.0 - kwLit ) * ( 1.0 - kwFar );`,
    );
  });
  return m;
}

export async function dressGameKit(root, key, { detail = 'high', phone = false, aniso = 8, loadPart = packPart, loadTexture = packMap } = {}) {
  const kit = kitOf(key);
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
  // (a part by its pack and mesh: the kit's own pack unless the part names another)
  const urlOf = (pack, mesh) => `${LEVELS}/${pack}/meshes/${mesh}.lod${Math.min(mesh === kit.anchor ? 0 : TOP.test(mesh) ? lods[0] : lods[1], (kit.lods[mesh] ?? 1) - 1)}.glb`;
  // (the hull's own GLB too, for what it holds beside the hull: the cards under its stern)
  const placed = [[kit.anchor, [0, 0, 0], [0, 0, 0, 1], [1, 1, 1]], ...kit.parts].map(([mesh, at, q, s, pack = kit.level]) => ({ pack, mesh, at, q, s, id: `${pack}/${mesh}` }));
  const ids = [...new Map(placed.map((p) => [p.id, p])).values()];
  const loaded = new Map(await Promise.all(ids.map((p) => loadPart(urlOf(p.pack, p.mesh)).then((part) => [p.id, part]))));
  // (every part, or the ship would lose what it held)
  if ([...loaded.values()].some((p) => !p)) return false;
  // the maps, each once a pack, at the tier's size
  const tier = tierOf(detail, phone);
  const slugs = new Map(); // pack/slug → { pack, slug, colour }
  const drawn = (prim) => !HULL.test(prim.material.name) && !DAMAGE.test(prim.material.name);
  for (const p of ids) for (const prim of loaded.get(p.id).prims.filter(drawn)) for (const s of prim.material.slots) slugs.set(`${p.pack}/${s.slug}`, { pack: p.pack, slug: s.slug, colour: s.slot === 'map' });
  // (and the windows' panes, the game's heightmap of them, if the kit has windows)
  const windowed = [...loaded.values()].some((part) => part.prims.some((prim) => drawn(prim) && WINDOW.test(prim.material.name)));
  const height = windowed ? paneHeight(loadTexture, phone) : null;
  const maps = Object.fromEntries(
    await Promise.all(
      [...slugs].map(([id, { pack, slug, colour }]) => loadTexture(`${LEVELS}/${pack}/tex/${slug}`, mapSize(kit.tex[slug], slug, tier), { aniso, srgb: colour, repeat: true }).then((t) => [id, t])),
    ),
  );
  const panes = await height;
  // (every colour map, or the ship as it came: a part without one would be a bare grey block)
  if ([...slugs].some(([id, { colour }]) => colour && !maps[id])) return false;
  // the parts' primitives in the kit's frame, joined a material at a time
  let since = performance.now();
  const slice = async () => {
    if (performance.now() - since < SLICE_MS) return;
    await new Promise((r) => setTimeout(r, 0));
    since = performance.now();
  };
  const materials = new Map(); // a material's signature → { def, pack, list }
  for (const { pack, id, at, q, s } of placed) {
    await slice();
    const place = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion(...q), new THREE.Vector3(...s));
    for (const prim of loaded.get(id).prims.filter(drawn)) {
      const key = `${pack}|${prim.material.name}|${prim.material.slots.map((x) => `${x.slot}:${x.slug}:${x.texCoord}`).join(',')}`;
      if (!materials.has(key)) materials.set(key, { def: prim.material, pack, list: [] });
      materials.get(key).list.push(inFrame(prim.geometry, new THREE.Matrix4().multiplyMatrices(place, prim.matrix), new THREE.Matrix4()));
    }
  }
  const meshes = [];
  for (const { def, pack, list } of materials.values()) {
    const material = withPanes(kitMaterial(def, Object.fromEntries(def.slots.map((x) => [x.slug, maps[`${pack}/${x.slug}`] ?? null]))), panes);
    // (a normal on the unique set is lit through that set's frame, not the
    // parts' tangents, which are the tiling set's: three's own frame from the
    // normal map's UVs, and glTF's green turned for it, as GLTFLoader turns it)
    const unique = def.slots.some((x) => x.slot === 'normalMap' && x.texCoord !== 0);
    if (unique) material.normalScale.y = -1;
    for (const chunk of chunked(list)) {
      await slice();
      const geometry = joined(chunk);
      if (unique) geometry.deleteAttribute('tangent');
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `kit:${def.name}`;
      meshes.push(mesh);
    }
  }
  // (the cut's parts swapped for the kit's in one go)
  for (const o of cut) o.parent?.remove(o);
  for (const mesh of meshes) frame.add(mesh);
  root.updateMatrixWorld(true);
  return true;
}

// a material's geometries in runs of no more than MESH_TRIS triangles
function chunked(list) {
  const out = [[]];
  let tris = 0;
  for (const g of list) {
    const n = (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    if (out.at(-1).length && tris + n > MESH_TRIS) {
      out.push([]);
      tris = 0;
    }
    out.at(-1).push(g);
    tris += n;
  }
  return out;
}
