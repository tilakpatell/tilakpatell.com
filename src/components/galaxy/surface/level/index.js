// A world drawn from the game's own level (lane L: docs/superpowers/specs/
// 2026-10-10-bf2017-levels-lighting-sabers-design.md, "How a level draws").
// A site with `level: '<world>'` has a pack under
// public/models/galaxy/bf2017/levels/<world>/ (scripts/bf2017-level.mjs);
// this fetches it as the visitor moves and draws it. A site without one gets
// null and nothing changes.
//
//   levelGround(ground) → Promise<ground>: its `image` layers' heightmaps
//     fetched and decoded (before the ground's grid is made)
//   createLevel({ scene, site, tier, renderer, walk }) → null | { update(position), ready(), stats(), dispose() }
//     (walk: the walk world, { solids, floors }, the pack's collision goes into)
//
// On the node renderer (WebGPU, or the node renderer on WebGL 2) a pack with
// a recipes.json (scripts/bf2017-recipes.mjs, lane Q1) draws its game meshes
// with the game's own surface shader (src/lib/three/surface/); the classic
// renderer, or a pack without one, keeps the GLB's materials.

import { withFallback } from '../../../../lib/assetBase.js';
import { imageLayerFrom } from '../../../../lib/land/layers.js';
import { decodePng16 } from '../../../../lib/level/png16.js';
import { createLevelLoader, recipesIndex } from './levelGltf.js';
import { packUrl, wanted } from './levelPack.js';
import { createLevelScene } from './levelScene.js';
import { createLevelStream } from './levelStream.js';
import { createColliders } from './colliders.js';

// A pack file's bytes, from the bucket where it has it, else the site.
// (No abort signal on the request: assetBase reads any failure as the bucket
// down for the visit, so a cancelled fetch is let finish and its answer
// dropped by the stream; lane S's pool brings real aborts.)
const bytesOf = (world) => (path) =>
  withFallback((u) =>
    fetch(u).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${u}`);
      return r.arrayBuffer();
    }),
  )(packUrl(world, path));

const packs = new Map(); // world → Promise<level.json>
const packOf = (world) => {
  if (!packs.has(world)) {
    packs.set(
      world,
      bytesOf(world)('level.json')
        .then((b) => JSON.parse(new TextDecoder().decode(b)))
        .catch((e) => {
          packs.delete(world);
          throw e;
        }),
    );
  }
  return packs.get(world);
};

// The pack's terrain as an image layer: near and far decoded, in metres from
// the spot's ground
export async function imageLayerOf(world) {
  const pack = await packOf(world);
  const t = pack.terrain;
  if (!t) return null;
  const get = bytesOf(world);
  const [near, far] = await Promise.all([get(t.near.png).then(decodePng16), get(t.far.png).then(decodePng16)]);
  const frame = (m, img) => ({ data: img.data, w: img.w, h: img.h, minX: m.min[0], minZ: m.min[1], metresPerPixel: m.metresPerPixel });
  return imageLayerFrom({ heightScale: t.scale, heightOffset: t.offset, holePixels: t.hole === null ? 0 : 1 }, frame(t.near, near), frame(t.far, far));
}

export async function levelGround(ground) {
  const layers = ground?.layers ?? [];
  if (!layers.some((l) => l.type === 'image' && l.pack)) return ground;
  // (the places' flats the site marks `game` are the flight's: on the game's
  // own ground they would bury its trenches)
  const flats = (ground.flats ?? []).filter((f) => !f.game);
  const filled = await Promise.all(
    layers.map(async (l) => {
      if (l.type !== 'image' || !l.pack) return l;
      // (a pack that cannot be had leaves the layer empty: 0, the flats still level the pad)
      const img = await imageLayerOf(l.pack).catch(() => null);
      return img ? { ...l, near: img.near, far: img.far } : l;
    }),
  );
  return { ...ground, layers: filled, flats };
}

// The pack's recipes for the loader (null without a recipes.json)
const recipesFor = (world, pack) =>
  bytesOf(world)('recipes.json')
    .then((b) => recipesIndex(pack, JSON.parse(new TextDecoder().decode(b))))
    .catch(() => null);

// the game material for a tier, or null on the classic renderer
async function gameMaterials(world, pack, renderer, tier) {
  // (low draws the GLB as it is: nothing to swap or fetch)
  if (!renderer?.isWebGPURenderer || tier === 'low') return { recipes: null, materialFor: null };
  const [recipes, { loadSurfaceMaterial }, { TIER_MAPS }] = await Promise.all([recipesFor(world, pack), import('../../../../lib/three/surface/hair.js'), import('../../../../lib/three/surface/gameMaterial.js')]);
  if (!recipes) return { recipes: null, materialFor: null };
  const make = await loadSurfaceMaterial();
  return { recipes, materialFor: (recipe, maps) => make(recipe, maps, { tier }), mapKeys: TIER_MAPS[tier] ?? null };
}

export function createLevel({ scene, site, tier, renderer = null, walk = null }) {
  if (!site?.level) return null;
  const world = site.level;
  const fetchBytes = bytesOf(world);
  let level = null;
  let stream = null;
  let loader = null;
  let gone = false;
  let last = null;
  const colliders = walk ? createColliders(walk, tier) : null;
  packOf(world)
    .then(async (pack) => {
      const { recipes, materialFor, mapKeys } = await gameMaterials(world, pack, renderer, tier).catch(() => ({ recipes: null, materialFor: null }));
      if (gone) return;
      loader = createLevelLoader({ world, tier, renderer, fetchBytes, sizes: pack.tex, recipes, materialFor, mapKeys });
      level = createLevelScene({ scene, pack, loadGltf: loader.load, tier });
      // the far list is the whole arena's table; the cells round you bring
      // its collision (the walk world's solids and floors, switched off when
      // a cell goes)
      stream = createLevelStream({ pack, fetch: (path) => fetchBytes(path), wanted, tier, onFar: level.setTable, onHorizon: level.setHorizon, onCell: (key, bin) => colliders?.add(key, pack, bin), onDrop: (key) => colliders?.drop(key) });
      if (last) {
        stream.update(last, tier);
        level.update(last);
      }
    })
    .catch((e) => {
      if (import.meta.env?.DEV) console.warn('level pack failed', world, e);
    });
  return {
    // position: [x, z] in the site's frame (where you are, or the camera)
    update(position) {
      last = position;
      stream?.update(position, tier);
      level?.update(position);
    },
    ready: () => stream?.ready() ?? false,
    progress: () => stream?.progress() ?? 0,
    stats: () => level?.stats() ?? { tris: 0, calls: 0, instances: 0 },
    dispose() {
      gone = true;
      colliders?.dispose();
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
    },
  };
}
