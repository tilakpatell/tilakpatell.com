// A world drawn from the game's own level (lane L: docs/superpowers/specs/
// 2026-10-10-bf2017-levels-lighting-sabers-design.md, "How a level draws").
// A site with `level: '<world>'` has a pack under
// public/models/galaxy/bf2017/levels/<world>/ (scripts/bf2017-level.mjs);
// this fetches it as the visitor moves and draws it. A site without one gets
// null and nothing changes.
//
//   levelGround(ground) → Promise<ground>: its `image` layers' heightmaps
//     fetched and decoded (before the ground's grid is made)
//   createLevel({ scene, site, tier, renderer, walk, small, heightAt, onPhysics, ground }) → null | { update(position), step(dt), ready(), stats(), physics(), dispose() }
//     (ground: the surface's ground mesh, which a pack with a ground.json
//     draws in the game's terrain layers on the node renderer, lane Q2)
//   packJson(world, path) → Promise<object>: a JSON file beside the pack
//     (a pack with the game's shapes, off a phone and the low tier
//     (levelPhysics.js's wantsEngine): a Rapier world of its own, the cells'
//     shapes streamed into it beside the walk world's boxes, the ground under
//     them a heightfield from heightAt; onPhysics(engine) once it's up: the
//     scene puts the player on the 2017 soldier's body, playerBody.js)
//   packOf(world) → Promise<level.json> (fetched once)
//     (walk: the walk world, { solids, floors }, the pack's collision goes into)
//
// On the node renderer (WebGPU, or the node renderer on WebGL 2) a pack with
// a recipes.json (scripts/bf2017-recipes.mjs, lane Q1) draws its game meshes
// with the game's own surface shader (src/lib/three/surface/); the classic
// renderer, or a pack without one, keeps the GLB's materials. A pack with a
// variations.json (lane colour) draws each varied mesh in the game's
// variation for this level, and wears its weathering (weather.json, lane
// Q4: snow, sand or rain over the materials whose recipe takes it, grown
// over its record's seconds; step(dt) runs its clock). Their sun (a
// leaf's translucency, hair's lobes, a head's scattering) follows the
// scene's first directional light.

import { assetUrl, withFallback } from '../../../../lib/assetBase.js';
import { imageLayerFrom } from '../../../../lib/land/layers.js';
import { decodePng16 } from '../../../../lib/level/png16.js';
import { createLevelLoader, recipesIndex } from './levelGltf.js';
import { packUrl, wanted } from './levelPack.js';
import { variationsIndex } from './levelVariations.js';
import { createLevelScene } from './levelScene.js';
import { createLevelStream } from './levelStream.js';
import { createColliders } from './colliders.js';
import { createLevelPhysics, wantsEngine } from './levelPhysics.js';

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

export const packJson = (world, path) => bytesOf(world)(path).then((b) => JSON.parse(new TextDecoder().decode(b)));

const packs = new Map(); // world → Promise<level.json>
export const packOf = (world) => {
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

// The pack's variations for the loader (null without a variations.json:
// scripts/bf2017-variations.mjs, lane colour)
const variationsFor = (world, pack) =>
  bytesOf(world)('variations.json')
    .then((b) => variationsIndex(pack, JSON.parse(new TextDecoder().decode(b))))
    .catch(() => null);

// The scene's sun (its first directional light) as the game material takes
// it: a direction toward the sun and its colour; null without one
const _a = { x: 0, y: 0, z: 0 };
export function sunOf(scene, light = null) {
  light ??= findSun(scene);
  if (!light) return null;
  light.updateMatrixWorld?.();
  light.target?.updateMatrixWorld?.();
  const p = light.matrixWorld.elements;
  const t = light.target?.matrixWorld.elements ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  _a.x = p[12] - t[12];
  _a.y = p[13] - t[13];
  _a.z = p[14] - t[14];
  const len = Math.hypot(_a.x, _a.y, _a.z) || 1;
  return { direction: [_a.x / len, _a.y / len, _a.z / len], color: [light.color.r, light.color.g, light.color.b], light };
}

function findSun(scene) {
  let found = null;
  scene?.traverse?.((o) => {
    if (!found && o.isDirectionalLight) found = o;
  });
  return found;
}

// the game material for a tier, or null on the classic renderer; its sun one
// set of uniforms the level moves with the scene's
async function gameMaterials(world, pack, renderer, tier, scene) {
  // (low draws the GLB as it is: nothing to swap or fetch)
  if (!renderer?.isWebGPURenderer || tier === 'low') return { recipes: null, materialFor: null };
  const [recipes, variations, weather, { loadSurfaceMaterial }, { TIER_MAPS, createSunUniforms }, { loadThree }, { overlaysFor, weatherClock }] = await Promise.all([
    recipesFor(world, pack),
    variationsFor(world, pack),
    packJson(world, 'weather.json').catch(() => null),
    import('../../../../lib/three/surface/hair.js'),
    import('../../../../lib/three/surface/gameMaterial.js'),
    import('../../../../lib/three/light/three.js'),
    import('../../../../lib/three/surface/weather.js'),
  ]);
  if (!recipes) return { recipes: null, materialFor: null };
  const [make, three] = await Promise.all([loadSurfaceMaterial(), loadThree()]);
  const sun = createSunUniforms(three, sunOf(scene) ?? {});
  // (the level's weathering, its own kind: one set of contributors every material shares, one clock)
  const overlays = weather ? overlaysFor(weather, undefined, three) : [];
  const clock = overlays.length ? weatherClock(overlays) : null;
  return { recipes, variations, sun, clock, materialFor: (recipe, maps) => make(recipe, maps, { tier, sun, overlays }), mapKeys: TIER_MAPS[tier] ?? null };
}

export function createLevel({ scene, site, tier, renderer = null, walk = null, small = false, heightAt = null, onPhysics = null, ground = null }) {
  if (!site?.level) return null;
  const world = site.level;
  const fetchBytes = bytesOf(world);
  let level = null;
  let stream = null;
  let loader = null;
  let gone = false;
  let last = null;
  let sun = null; // the game materials' shared sun, when they draw
  let clock = null; // their weathering's clock
  let sunLight = null;
  const colliders = walk ? createColliders(walk, tier, { loadBin: fetchBytes }) : null;
  // the engine's side: its world, the cells' bodies, and the cells the
  // stream brought before the engine was up (added once it is)
  let engine = null;
  let bodies = null;
  const early = new Map(); // key → bin
  const onCell = (key, bin) => {
    colliders?.add(key, pack0, bin);
    if (bodies) bodies.add(key, bin);
    else early.set(key, bin);
  };
  const onDrop = (key) => {
    colliders?.drop(key);
    early.delete(key);
    bodies?.drop(key);
  };
  let pack0 = null;
  async function startEngine(pack) {
    if (!wantsEngine({ pack, small, tier })) return;
    const { createPhysics } = await import('../../../../lib/physics/world.js');
    const physics = await createPhysics({ gravity: -15.5 });
    if (gone) return physics.dispose();
    engine = physics;
    bodies = createLevelPhysics({ physics, pack, loadBin: fetchBytes, tier });
    if (heightAt) bodies.setTerrain(heightAt);
    for (const [key, bin] of early) bodies.add(key, bin);
    early.clear();
    onPhysics?.(physics);
  }
  packOf(world)
    .then(async (pack) => {
      pack0 = pack;
      // (the engine loads beside the materials; a failure leaves the walker as it was)
      startEngine(pack).catch((e) => {
        if (import.meta.env?.DEV) console.warn('level physics failed', world, e);
      });
      const { recipes, variations = null, materialFor, mapKeys, sun: shared = null, clock: weathering = null } = await gameMaterials(world, pack, renderer, tier, scene).catch(() => ({ recipes: null, materialFor: null }));
      sun = shared;
      clock = weathering;
      if (gone) return;
      loader = createLevelLoader({ world, tier, renderer, fetchBytes, sizes: pack.tex, recipes, materialFor, mapKeys, variations });
      // (the ground in the game's layers where the pack has them: the node renderer's, lane Q2)
      const layered = ground && renderer?.isWebGPURenderer ? { mesh: ground, renderer, fetchBytes, urlOf: (path) => assetUrl(packUrl(world, path)), entry: null } : null;
      level = createLevelScene({ scene, pack, loadGltf: loader.load, tier, ground: layered });
      // the far list is the whole arena's table; the cells round you bring
      // its collision (the walk world's solids and floors, switched off when
      // a cell goes)
      stream = createLevelStream({ pack, fetch: (path) => fetchBytes(path), wanted, tier, onFar: level.setTable, onHorizon: level.setHorizon, onCell, onDrop });
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
      if (sun) {
        // (the scene's sun found once, again if it leaves the scene)
        if (!sunLight?.parent) sunLight = findSun(scene);
        const s = sunLight && sunOf(scene, sunLight);
        if (s) sun.set(s.direction, s.color);
      }
      stream?.update(position, tier);
      level?.update(position);
      bodies?.update(4);
    },
    // the weathering's clock (lane Q4's accumulation), each frame
    step(dt) {
      clock?.update(dt);
    },
    ready: () => stream?.ready() ?? false,
    progress: () => stream?.progress() ?? 0,
    stats: () => ({ ...(level?.stats() ?? { tris: 0, calls: 0, instances: 0 }), physics: bodies?.stats() ?? null }),
    // the level's engine, once it's up (null on a phone, the low tier, a pack without shapes)
    physics: () => engine,
    dispose() {
      gone = true;
      colliders?.dispose();
      bodies?.dispose();
      engine?.dispose();
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
    },
  };
}
