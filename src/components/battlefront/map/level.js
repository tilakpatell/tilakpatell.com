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
//   createLevel({ scene, tier, detail, texTier, renderer, world = 'hoth', inside = INSIDE[world], mode = null, ground = true, snow = true, onCell, onDrop, deps })
//   (inside: the level's interior, a district pack in the same frame drawn and
//    streamed with it: Hoth's Echo Base, `hoth/base`, which the pack builder
//    cuts from under the ground with --inside; its cells reach onCell and
//    onDrop with a fourth argument, 'inside', its keys being its own)
//   (mode: the mode played; where the level has a part for it (MODES: Hoth's
//    Galactic Assault, `hoth/ga`, the FantasyBattle sub-level's own meshes,
//    built with --part) it is a third pack in the same frame, its cells
//    handed on as 'mode'. Its mode.json (scripts/bf2017-level-mode.mjs) says
//    which of its instances the doors and the state props move or switch:
//    those leave its far table (map/doorsTable.js), and the level's
//    `modePart` hands them to map/doorsScene.js)
//   (snow: the ground in the game's snow maps on the node renderer; false, the flat colour;
//    detail: the quality level, 'ultra' where the tier is 'high' on a strong card, for the ground)
//     → { ready: Promise, group, origin, pack, inner: { pack, loadBin } | null,
//         modePart: { pack, loadBin, group, mode, match, rows: Promise<rows>, loadGltf } | null (once ready),
//         update([x, y, z]), heightAt(x, z), packHeightAt(px, pz),
//         loadBin(path), navOf() → Promise<mask | null>, progress(), loaded(), stats(), dispose() }
//   (onCell(key, bin, band) and onDrop(key): the stream's cells as they come
//   and go, for the collision; navOf: the pack's nav.bin, navMask.js's)
//   toPack(pack, [x, y, z]) → [x, z] in the pack's frame (pure)

import * as THREE from "three";
import { LAYERS } from "../../../lib/land/layers.js";
import { inflateMask } from "../../../lib/battlefront/navMask.js";
import * as laneL from "../../galaxy/shared/level.js";
import { buildGround } from "./ground.js";
import { controlled } from "./doors.js";
import { matcher, splitTable } from "./doorsTable.js";

// The levels whose interior is a pack of its own (scripts/bf2017-level.mjs
// --district <name> --inside: the instances under the ground), by hand: the
// pack does not name its interior.
export const INSIDE = { hoth: 'base' };
// The levels' mode parts (scripts/bf2017-level.mjs --district <name> --part:
// a mode's sub-level), by mode, by hand: Galactic Assault's on Hoth
export const MODES = { hoth: { galacticAssault: 'ga' } };

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
  modeOf: (world) =>
    bytes(world)("mode.json").then((b) =>
      JSON.parse(new TextDecoder().decode(b)),
    ),
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
  mode = null,
  still = false,
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
  // (the mode's part, the same again: its still art drawn, what moves split out for the doors)
  const part = mode && MODES[world]?.[mode];
  const modeSub = part
    ? createLevel({ scene, tier, texTier, renderer, world: `${world}/${part}`, inside: null, mode: null, still: true, ground: false, gpuScene, onCell: (k, b, band) => onCell(k, b, band, 'mode'), onDrop: (k) => onDrop(k, 'mode'), deps })
    : null;
  const subs = [sub, modeSub].filter(Boolean);
  // (a still part: its mode.json, the matcher of what moves, and those rows once the far table is in)
  let modeJson = null;
  let match = null;
  let gotRows = null;
  const rows = still ? new Promise((resolve) => (gotRows = resolve)) : null;

  const outside = (async () => {
    const [p, img, mj] = await Promise.all([
      d.packOf(world),
      d.imageLayer(world).catch(() => null),
      still ? d.modeOf(world).catch(() => null) : null,
    ]);
    if (gone) return;
    pack = p;
    if (still) {
      modeJson = mj;
      match = matcher(pack, mj ? controlled(mj) : []);
    }
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
      // (a still part's far table without what the doors and the props move: those rows to modePart.rows)
      onFar: still
        ? (bin) => {
            const split = splitTable(pack, bin, match);
            pack.far.draws = split.draws;
            level.setTable(split.bin);
            gotRows(split.rows);
          }
        : level.setTable,
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
  const ready = Promise.all([outside, ...subs.map((x) => x.ready)]).then(() => {});

  function update(at) {
    last = at;
    for (const x of subs) x.update(at);
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
    get modePart() {
      return modeSub?.still ?? null;
    },
    // (a still part's own: what map/doorsScene.js takes)
    get still() {
      return still && pack ? { pack, loadBin: fetchBytes, group, mode: modeJson, match, rows, loadGltf: (path) => loader?.load(path) ?? Promise.resolve(null) } : null;
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
    // the ground's height in the pack's frame (its origin's height off), for the physics' heightfields; null until it is in
    packHeightAt: (px, pz) => (layer ? LAYERS.image(px, pz, layer) : null),
    loaded: () => (stream?.ready() ?? false) && subs.every((x) => x.loaded()),
    progress: () => ((stream?.progress() ?? 0) + subs.reduce((n, x) => n + x.progress(), 0)) / (1 + subs.length),
    stats: () => subs.reduce((a, x) => sum(a, x.stats()), level?.stats() ?? { tris: 0, calls: 0, instances: 0 }),
    // (the GPU scene's frame: the occluders' depth, the pyramid and the cull
    // before the scene is drawn, the queries read after; nothing on the other paths)
    beforeRender: (camera) => {
      level?.beforeRender?.(camera);
      for (const x of subs) x.beforeRender(camera);
    },
    afterRender: () => {
      level?.afterRender?.();
      for (const x of subs) x.afterRender();
    },
    debug: () => level?.debug?.() ?? null,
    dispose() {
      gone = true;
      for (const x of subs) x.dispose();
      stream?.dispose();
      level?.dispose();
      loader?.dispose();
      groundMesh?.dispose();
      group.removeFromParent();
    },
  };
}
