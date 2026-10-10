// The whole map from lane L's pack (the game design's decision 15), in the
// export's frame: metres, +Y up, +Z forward, nothing rebased. Lane L's pack
// is cut round a spot (level.json's `origin`, turned by its `yaw`); its
// scene is drawn in a group put back at that origin, so a spawn, a volume or
// a light from the rulebooks lands where the game has it. Lane L's stream
// does the order (the far list first, so the map is whole; then the cells
// round the player nearest first; the horizon last) and keeps every cell's
// bytes once fetched; this hands it the player's place in the pack's frame.
// The ground is the pack's two heightmaps (the `image` layer), drawn here
// (ground.js) since the pack carries no ground mesh: the galaxy draws its
// own over it.
//
// What landed after lane 5 (the sixth design's picture lane), each behind
// the tier and the pack's own files, as the galaxy's surface wires them
// (surface/level/index.js, levelScene.js): on the node renderer above low,
// a pack with recipes.json draws its meshes in the game's surface shader
// (lane Q1; a pack without one, or low, keeps the GLB's materials), the
// ground in the terrain's layers from ground.json (lane Q2; its masks moved
// into the map's frame, packFrame.js), and the placed decals from
// decals.json cell by cell, cut from the cell's static instances (lane Q4;
// mid and up). A file the pack lacks skips its pass with one log line.
// Lane colour's variations ride Q1's recipes (a recipe gains `variation`
// in levelGltf.js), so nothing here reads variations.json.
//
//   createLevel({ scene, tier, renderer, world = 'hoth', ground = true, entry, deps })
//     → { ready: Promise, group, origin, pack, file(name), update([x, y, z]),
//         heightAt(x, z), progress(), loaded(), stats(), dispose() }
//   (file(name): a file beside the pack as JSON, null where it has none)
//   toPack(pack, [x, y, z]) → [x, z] in the pack's frame (pure)

import * as THREE from 'three';
import { LAYERS } from '../../../lib/land/layers.js';
import { readInstances } from '../../../lib/level/instances.js';
import { backendOf } from '../../../lib/three/light/three.js';
import * as laneL from '../../galaxy/shared/level.js';
import { buildGround } from './ground.js';
import { groundInMap } from './packFrame.js';

export function toPack(pack, [x, , z]) {
  const [ox, , oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  const dx = x - ox;
  const dz = z - oz;
  return [dx * c + dz * s, -dx * s + dz * c];
}

// the pack's level.json and its bytes, from the asset host where it has them
const bytes = (world) => (path) =>
  fetch(laneL.packUrl(world, path)).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${path}`);
    return r.arrayBuffer();
  });
const json = (b) => JSON.parse(new TextDecoder().decode(b));
const enc = (o) => new TextEncoder().encode(JSON.stringify(o)).buffer;
// one line for a pass the pack has no file for (never an error)
const skipped = (world, file, pass) => console.info(`battlefront: ${world} has no ${file}; ${pass} skipped`);

// Q1's material for a pack (the galaxy's surface/level/index.js does the
// same): its recipes, the material by recipe, the maps the tier draws and
// the shared sun; recipes null without a recipes.json
async function gameMaterials({ pack, tier, fetchBytes }) {
  const [recipes, { loadSurfaceMaterial }, { TIER_MAPS, createSunUniforms }, { loadThree }] = await Promise.all([
    fetchBytes('recipes.json')
      .then((b) => laneL.recipesIndex(pack, json(b)))
      .catch(() => null),
    import('../../../lib/three/surface/hair.js'),
    import('../../../lib/three/surface/gameMaterial.js'),
    import('../../../lib/three/light/three.js'),
  ]);
  if (!recipes) return { recipes: null, materialFor: null };
  const [make, three] = await Promise.all([loadSurfaceMaterial(), loadThree()]);
  const sun = createSunUniforms(three, {});
  return { recipes, sun, materialFor: (recipe, maps) => make(recipe, maps, { tier, sun }), mapKeys: TIER_MAPS[tier] ?? null };
}

// A cell's static instances as the decals cut from them: each draw's
// finest shipped LOD at each instance's matrix
const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
export async function cellTargets(pack, key, bin, load, tier = 'high') {
  const draws = (pack.cells?.[key]?.draws ?? []).filter((d) => !pack.cull?.[tier]?.dropped?.includes(d.mesh));
  if (!draws.length) return [];
  const inst = readInstances(bin);
  const out = [];
  for (const d of draws) {
    const glb = pack.meshes?.[d.mesh]?.glb?.find(Boolean);
    const gltf = glb ? await load(glb) : null;
    if (!gltf) continue;
    gltf.scene.updateMatrixWorld(true);
    const parts = [];
    gltf.scene.traverse((o) => o.isMesh && parts.push(o));
    for (let i = d.offset; i < d.offset + d.count; i++) {
      _m.compose(_p.fromArray(inst.position, i * 3), _q.fromArray(inst.quaternion, i * 4).normalize(), _s.fromArray(inst.scale, i * 3));
      for (const o of parts) out.push({ geometry: o.geometry, matrix: _m.clone().multiply(o.matrixWorld) });
    }
  }
  return out;
}

const DEPS = {
  bytesOf: bytes,
  gameMaterials,
  attachGround: (o) => import('../../../lib/three/ground/layeredGround.js').then((m) => m.attachLayeredGround(o)),
  createDecals: null, // (decalScene.js's, loaded when a pack has decals)
  packOf: (world) => bytes(world)('level.json').then((b) => JSON.parse(new TextDecoder().decode(b))),
  imageLayer: (world) => laneL.imageLayerOf(world),
  createLevelLoader: laneL.createLevelLoader,
  createLevelScene: laneL.createLevelScene,
  createLevelStream: laneL.createLevelStream,
};

export function createLevel({ scene, tier = 'high', renderer = null, world = 'hoth', ground = true, entry = null, deps = {} }) {
  const d = { ...DEPS, ...deps };
  const group = new THREE.Group();
  group.name = `level:${world}`;
  scene.add(group);
  let pack = null;
  let layer = null;
  let level = null;
  let stream = null;
  let loader = null;
  let groundMesh = null;
  let last = null;
  let gone = false;
  let decals = null;
  let sun = null; // the game materials' shared sun, when they draw
  let sunLight = null;
  const layered = [];
  const fetchBytes = d.bytesOf(world);
  // (the passes after lane 5: on the node renderer, above low)
  const node = !!renderer?.isWebGPURenderer && tier !== 'low';
  const backend = backendOf(renderer);
  // the decals' GLBs for cutting, each loaded once
  const cut = new Map();
  const cutLoad = (glb) => {
    if (!cut.has(glb)) cut.set(glb, Promise.resolve(loader.load(glb)).catch(() => null));
    return cut.get(glb);
  };

  // Q4's decals from decals.json, in the pack's group (its frame is the
  // pack's): null without the file, on low or off the node renderer
  async function decalsOf() {
    if (!node || tier === 'low') return null;
    const file = await fetchBytes('decals.json')
      .then(json)
      .catch(() => null);
    if (!file?.cells) {
      skipped(world, 'decals.json', 'the decals');
      return null;
    }
    const make = d.createDecals ?? (await import('../../../lib/three/decals/decalScene.js')).createDecals;
    const ktx = d.createDecals ? null : await import('../../../lib/three/gltf.js').then((m) => m.ktx2Loader({ renderer }));
    return make({ scene: group, pack: file, tier, backend, loader: (name, path) => ktx.loadAsync(laneL.packUrl(world, path ?? name)) });
  }
  const cellOf = (key) => key.split(',').map(Number);
  const onCell = (key, bin) => {
    if (!decals) return;
    cellTargets(pack, key, bin, cutLoad, tier)
      .then((targets) => !gone && decals?.cell(...cellOf(key), targets))
      .catch((e) => console.warn('battlefront: decals', key, e));
  };
  const onDrop = (key) => decals?.drop(...cellOf(key));

  const ready = (async () => {
    const [p, img] = await Promise.all([d.packOf(world), d.imageLayer(world).catch(() => null)]);
    if (gone) return;
    pack = p;
    layer = img;
    group.position.fromArray(pack.origin ?? [0, 0, 0]);
    group.rotation.y = -(pack.yaw ?? 0);
    const mats = node ? await d.gameMaterials({ world, pack, renderer, tier, fetchBytes }).catch(() => null) : null;
    if (gone) return;
    if (node && !mats?.recipes) skipped(world, 'recipes.json', 'the game material');
    sun = mats?.sun ?? null;
    loader = d.createLevelLoader({ world, tier, renderer, fetchBytes, sizes: pack.tex, recipes: mats?.recipes ?? null, materialFor: mats?.materialFor ?? null, mapKeys: mats?.mapKeys ?? null });
    decals = await decalsOf().catch((e) => (console.warn('battlefront: decals', e), null));
    if (gone) return decals?.dispose();
    level = d.createLevelScene({ scene: group, pack, loadGltf: loader.load, tier });
    stream = d.createLevelStream({ pack, fetch: (path) => fetchBytes(path), wanted: laneL.wanted, tier, onFar: level.setTable, onHorizon: level.setHorizon, onCell, onDrop });
    if (ground && layer) {
      groundMesh = buildGround(layer, pack.terrain);
      group.add(groundMesh);
      layGround();
    }
    if (last) update(last);
  })();

  // Q2's layers on the ground's meshes (they sample the masks by world x
  // and z: ground.json is handed over in the map's frame)
  function layGround() {
    if (!node || !pack.ground) return;
    const inMap = async (path) => {
      const b = await fetchBytes(path);
      if (path !== pack.ground) return b;
      const g = groundInMap(json(b), pack);
      if (!g) throw new Error('a turned pack: its masks are not in the map’s frame');
      return enc(g);
    };
    const urlOf = (path, t) => laneL.packUrl(world, laneL.tierTexture(path, t, pack.tex));
    groundMesh.traverse((o) => {
      if (!o.isMesh) return;
      Promise.resolve(d.attachGround({ mesh: o, renderer, pack, tier, entry, fetchBytes: inMap, urlOf }))
        .then((g) => {
          if (!g) return;
          if (gone) g.dispose();
          else layered.push(g);
          g.ready?.catch?.((e) => console.info(`battlefront: ${world}'s ground layers skipped (${e.message})`));
        })
        .catch((e) => console.info(`battlefront: ${world}'s ground layers skipped (${e.message})`));
    });
  }

  function update(at) {
    last = at;
    if (sun) {
      // (the scene's sun found once, again if it leaves the scene)
      if (!sunLight?.parent) sunLight = null;
      const s = laneL.sunOf(scene, sunLight);
      if (s) {
        sunLight = s.light;
        sun.set(s.direction, s.color);
      }
    }
    if (!stream) return;
    const p = toPack(pack, at);
    stream.update(p, tier);
    level.update(p);
  }

  return {
    ready,
    group,
    get origin() {
      return pack?.origin ?? [0, 0, 0];
    },
    get pack() {
      return pack;
    },
    file: (name) =>
      fetchBytes(name)
        .then(json)
        .catch(() => null),
    update,
    // the ground's height at the export's (x, z): the pack's image layer in
    // its own frame, lifted back by the origin's height; 0 until it is in
    heightAt(x, z) {
      if (!layer) return 0;
      const [px, pz] = toPack(pack, [x, 0, z]);
      return LAYERS.image(px, pz, layer) + (pack.origin?.[1] ?? 0);
    },
    loaded: () => stream?.ready() ?? false,
    progress: () => stream?.progress() ?? 0,
    stats: () => level?.stats() ?? { tris: 0, calls: 0, instances: 0 },
    dispose() {
      gone = true;
      for (const g of layered) g.dispose();
      decals?.dispose();
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
      if (groundMesh) {
        groundMesh.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      }
      group.removeFromParent();
    },
  };
}
