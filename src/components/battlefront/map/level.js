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
//   createLevel({ scene, tier, renderer, world = 'hoth', ground = true, onCell, onDrop, deps })
//     → { ready: Promise, group, origin, pack, update([x, y, z]), heightAt(x, z),
//         loadBin(path), navOf() → Promise<mask | null>, progress(), loaded(), stats(), dispose() }
//   (onCell(key, bin, band) and onDrop(key): the stream's cells as they come
//   and go, for the collision; navOf: the pack's nav.bin, navMask.js's)
//   toPack(pack, [x, y, z]) → [x, z] in the pack's frame (pure)

import * as THREE from "three";
import { LAYERS } from "../../../lib/land/layers.js";
import { inflateMask } from "../../../lib/battlefront/navMask.js";
import * as laneL from "../../galaxy/shared/level.js";
import { buildGround } from "./ground.js";

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
const DEPS = {
  packOf: (world) =>
    bytes(world)("level.json").then((b) =>
      JSON.parse(new TextDecoder().decode(b)),
    ),
  imageLayer: (world) => laneL.imageLayerOf(world),
  createLevelLoader: laneL.createLevelLoader,
  createLevelScene: laneL.createLevelScene,
  createLevelStream: laneL.createLevelStream,
  navOf: (world) => bytes(world)("nav.bin").then(inflateMask),
};

export function createLevel({
  scene,
  tier = "high",
  renderer = null,
  world = "hoth",
  ground = true,
  onCell = () => {},
  onDrop = () => {},
  deps = {},
}) {
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
  const fetchBytes = bytes(world);

  const ready = (async () => {
    const [p, img] = await Promise.all([
      d.packOf(world),
      d.imageLayer(world).catch(() => null),
    ]);
    if (gone) return;
    pack = p;
    layer = img;
    group.position.fromArray(pack.origin ?? [0, 0, 0]);
    group.rotation.y = -(pack.yaw ?? 0);
    loader = d.createLevelLoader({
      world,
      tier,
      renderer,
      fetchBytes,
      sizes: pack.tex,
    });
    level = d.createLevelScene({
      scene: group,
      pack,
      loadGltf: loader.load,
      tier,
    });
    stream = d.createLevelStream({
      pack,
      fetch: (path) => fetchBytes(path),
      wanted: laneL.wanted,
      tier,
      onFar: level.setTable,
      onHorizon: level.setHorizon,
      onCell,
      onDrop,
    });
    if (ground && layer) {
      groundMesh = buildGround(layer, pack.terrain);
      group.add(groundMesh);
    }
    if (last) update(last);
  })();

  function update(at) {
    last = at;
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
    loadBin: fetchBytes,
    navOf: () =>
      Promise.resolve()
        .then(() => d.navOf(world))
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
