// The whole map from lane L's pack (the game design's decision 15), in the
// export's frame: metres, +Y up, +Z forward, nothing rebased. Lane L's pack
// is cut round a spot (level.json's `origin`, turned by its `yaw`); its
// scene is drawn in a group put back at that origin, so a spawn, a volume or
// a light from the rulebooks lands where the game has it. Lane L's stream
// does the order (the far list first, so the map is whole; then the cells
// round the player nearest first; the horizon last) and keeps every cell's
// bytes once fetched; this hands it the player's place in the pack's frame.
// The ground is the pack's two heightmaps (the `image` layer), drawn here
// (ground.js) since the pack carries no ground mesh, in the game's snow on
// the node renderer: the galaxy draws its own over it.
//
//   createLevel({ scene, tier, detail, texTier, renderer, world = 'hoth', inside = INSIDE[world], ground = true, snow = true, onCell, onDrop, deps })
//   (inside: the level's interior, a district pack in the same frame drawn and
//    streamed with it: Hoth's Echo Base, `hoth/base`, which the pack builder
//    cuts from under the ground with --inside; its cells reach onCell and
//    onDrop with a fourth argument, 'inside', its keys being its own)
//   (snow: the ground in the game's snow maps on the node renderer; false, the flat colour;
//    detail: the quality level, 'ultra' where the tier is 'high' on a strong card, for the ground)
//     → { ready: Promise, group, origin, pack, inner: { pack, loadBin } | null, update([x, y, z]), heightAt(x, z),
//         loadBin(path), navOf() → Promise<mask | null>, progress(), loaded(), stats(), dispose() }
//   (onCell(key, bin, band) and onDrop(key): the stream's cells as they come
//   and go, for the collision; navOf: the pack's nav.bin, navMask.js's)
//   toPack(pack, [x, y, z]) → [x, z] in the pack's frame (pure)

import * as THREE from "three";
import { LAYERS } from "../../../lib/land/layers.js";
import { inflateMask } from "../../../lib/battlefront/navMask.js";
import * as laneL from "../../galaxy/shared/level.js";
import { buildGround } from "./ground.js";

// The levels whose interior is a pack of its own (scripts/bf2017-level.mjs
// --district <name> --inside: the instances under the ground), by hand: the
// pack does not name its interior.
export const INSIDE = { hoth: 'base' };

export function toPack(pack, [x, , z]) {
  const [ox, , oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  const dx = x - ox;
  const dz = z - oz;
  return [dx * c + dz * s, -dx * s + dz * c];
}

// the pack's level.json and its bytes, through the asset base as the
// galaxy's level fetches them (lane L's packBytes: the bucket by hash where
// the manifest names the file, the site's copy when the bucket fails; a plain
// fetch of the site path here drew nothing once the packs left git)
const bytes = (world) => laneL.packBytes(world);
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

// the two parts' numbers added (a count each; the rest the outside's)
function sum(a, b) {
  if (!b) return a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) if (typeof v === 'number' && typeof a[k] === 'number') out[k] = a[k] + v;
  return out;
}

export function createLevel({
  scene,
  tier = "high",
  texTier = null,
  renderer = null,
  world = "hoth",
  inside = INSIDE[world] ?? null,
  ground = true,
  snow = true,
  detail = null,
  gpuScene = false,
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
  // (the interior, in the same frame: its cells told apart from the outside's, whose keys it shares)
  const sub = inside
    ? createLevel({ scene, tier, texTier, renderer, world: `${world}/${inside}`, inside: null, ground: false, gpuScene, onCell: (k, b, band) => onCell(k, b, band, 'inside'), onDrop: (k) => onDrop(k, 'inside'), deps })
    : null;

  const outside = (async () => {
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
      texTier,
      world,
      tier,
      renderer,
      fetchBytes,
      sizes: pack.tex,
    });
    // (GPU-first lane N1's scene where asked and the renderer draws
    // indirect: the rows culled by compute, one indirect draw a material
    // group, the static groups in a render bundle; elsewhere lane L's
    // instanced path, as before)
    level = d.createLevelScene({
      scene: group,
      pack,
      loadGltf: loader.load,
      tier,
      gpuScene,
      renderer: gpuScene ? renderer : null,
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
      groundMesh = buildGround(layer, pack.terrain, { world, pack, tier: detail ?? tier, renderer: snow ? renderer : null });
      group.add(groundMesh);
    }
    if (last) update(last);
  })();
  const ready = Promise.all([outside, sub?.ready]).then(() => {});

  function update(at) {
    last = at;
    sub?.update(at);
    if (!stream) return;
    const p = toPack(pack, at);
    stream.update(p, tier);
    level.update(p);
    groundMesh?.update(p);
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
    get inner() {
      return sub?.pack ? { pack: sub.pack, loadBin: sub.loadBin } : null;
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
    loaded: () => (stream?.ready() ?? false) && (!sub || sub.loaded()),
    progress: () => (sub ? ((stream?.progress() ?? 0) + sub.progress()) / 2 : (stream?.progress() ?? 0)),
    stats: () => sum(level?.stats() ?? { tris: 0, calls: 0, instances: 0 }, sub?.stats()),
    // (the GPU scene's frame: the occluders' depth, the pyramid and the cull
    // before the scene is drawn, the queries read after; nothing on the other paths)
    beforeRender: (camera) => {
      level?.beforeRender?.(camera);
      sub?.beforeRender(camera);
    },
    afterRender: () => {
      level?.afterRender?.();
      sub?.afterRender();
    },
    debug: () => level?.debug?.() ?? null,
    dispose() {
      gone = true;
      sub?.dispose();
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
      groundMesh?.dispose();
      group.removeFromParent();
    },
  };
}
