// A level of the game in the export's frame: metres, +Y up, +Z forward,
// nothing rebased, so a spawn, a volume or a light from the rulebooks lands
// where the game has it.
//
// By level key (lane G2), the level's whole pack (scripts/bf2017-level.mjs
// --whole: levels/<world>/game/<key>/), built in the map's own frame (its
// origin 0, its yaw 0), every piece of it; a mode hides the other modes'
// own props (levels.js's hiddenFor). Where the whole pack is not published
// yet, the world's roam pack (lane L's and E0's, cut round a spot) in a
// group put back at that spot, as lane 5 drew Hoth, and `note` says so for
// the loading line. Lane L's stream does the order (the far list first, so
// the map is whole; then the cells round the player nearest first); this
// hands it the player's place in the pack's frame. The ground is the pack's
// two heightmaps (the `image` layer), drawn here (ground.js).
//
// The parts beside a pack's level.json (lane E0's): its placed lights
// (`lights`, for lane R's placed.js through applyGameLight), its reflection
// volumes (`volumes` and `loadCube`, for the same), its creatures and
// vehicles stood where the game put them (placed.js: still, scenery until
// lane G5's vehicles are entities), and its navgrid (`nav`, nav.bin, read in
// place of building one from the drawn ground).
//
//   createLevel({ scene, tier, renderer, level, world, mode, ground = true, deps })
//     → { ready: Promise, group, origin, key, whole, note, parts, nav,
//         update([x, y, z]), heightAt(x, z), progress(), loaded(), stats(), dispose() }
//   toPack(pack, [x, y, z]) → [x, z] in the pack's frame (pure)

import * as THREE from 'three';
import { assetUrl, withFallback } from '../../../lib/assetBase.js';
import { fromBin } from '../../../lib/battlefront/nav.js';
import { LAYERS } from '../../../lib/land/layers.js';
import * as laneL from '../../galaxy/shared/level.js';
import { buildGround } from './ground.js';
import { LEVELS, hiddenFor, layerShown, levelKeyOf, wholePackOf } from './levels.js';
import { createPlaced } from './placed.js';

export function toPack(pack, [x, , z]) {
  const [ox, , oz] = pack.origin ?? [0, 0, 0];
  const c = Math.cos(pack.yaw ?? 0);
  const s = Math.sin(pack.yaw ?? 0);
  const dx = x - ox;
  const dz = z - oz;
  return [dx * c + dz * s, -dx * s + dz * c];
}

// a pack's file, from the asset host where it is published, else the site
const bytes = (world) => (path) =>
  withFallback((u) =>
    fetch(u).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.arrayBuffer();
    }),
  )(laneL.packUrl(world, path));
const json = (world, path) => bytes(world)(path).then((b) => JSON.parse(new TextDecoder().decode(b)));
const DEPS = {
  packOf: (world) => json(world, 'level.json'),
  partOf: (world, file, empty) => json(world, file).catch(() => empty),
  bytesOf: (world, path) => bytes(world)(path),
  imageLayer: (world) => laneL.imageLayerOf(world),
  createLevelLoader: laneL.createLevelLoader,
  createLevelScene: laneL.createLevelScene,
  createLevelStream: laneL.createLevelStream,
  createPlaced,
  // a probe's six 64² HDR faces (probes/<id>.<face>.hdr) as the cube the light stack takes
  loadCube: (world, v) =>
    import('three/examples/jsm/loaders/HDRCubeTextureLoader.js').then(({ HDRCubeTextureLoader }) => new HDRCubeTextureLoader().loadAsync(FACES.map((f) => assetUrl(laneL.packUrl(world, `${v.faces}.${f}.hdr`))))),
};
const FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

// a probe as the light stack's volume: its box's world extent (the game's
// box is turned; the stack's are square to the axes)
export function volumeOf(p) {
  const half = [0, 1, 2].map((k) => p.axes.reduce((a, ax) => a + Math.abs(ax[k]) / 2, 0));
  return { id: p.id, faces: p.faces, min: p.centre.map((c, k) => c - half[k]), max: p.centre.map((c, k) => c + half[k]) };
}

// the world's pack to fall back on, or none
const roamOf = (key, world) => (key ? LEVELS[key].world : world);

export function createLevel({ scene, tier = 'high', renderer = null, level = null, world = null, mode = null, ground = true, deps = {} }) {
  const d = { ...DEPS, ...deps };
  const key = levelKeyOf(level ?? world);
  const roam = roamOf(key, world ?? 'hoth');
  const group = new THREE.Group();
  group.name = `level:${key ?? roam}`;
  scene.add(group);
  let pack = null;
  let packWorld = null;
  let layer = null;
  let scene_ = null;
  let stream = null;
  let loader = null;
  let groundMesh = null;
  let placed = null;
  let last = null;
  let gone = false;
  const out = {
    ready: null,
    group,
    key,
    whole: false,
    note: null,
    parts: { lights: null, volumes: [], loadCube: null, life: [], rides: [], things: [] },
    nav: null,
  };

  // the whole pack by key, else the roam pack, saying so
  const load = async () => {
    const whole = key ? wholePackOf(key) : null;
    if (whole) {
      try {
        return { world: whole, pack: await d.packOf(whole) };
      } catch {
        out.note = `${key}: the whole level is not published yet; drawing ${roam}'s roam pack`;
      }
    }
    return { world: roam, pack: await d.packOf(roam) };
  };

  out.ready = (async () => {
    const got = await load();
    if (gone) return;
    pack = got.pack;
    packWorld = got.world;
    out.whole = Boolean(pack.whole);
    const img = await d.imageLayer(packWorld).catch(() => null);
    if (gone) return;
    layer = img;
    group.position.fromArray(pack.origin ?? [0, 0, 0]);
    group.rotation.y = -(pack.yaw ?? 0);
    // (a mode hides the other modes' own props)
    const hidden = hiddenFor(pack, mode);
    const drawn = hidden.length ? { ...pack, cull: Object.fromEntries(Object.entries(pack.cull ?? {}).map(([t, c]) => [t, { ...c, dropped: [...new Set([...(c.dropped ?? []), ...hidden])] }])) } : pack;
    const fetchBytes = (path) => d.bytesOf(packWorld, path);
    loader = d.createLevelLoader({ world: packWorld, tier, renderer, fetchBytes, sizes: pack.tex });
    scene_ = d.createLevelScene({ scene: group, pack: drawn, loadGltf: loader.load, tier });
    stream = d.createLevelStream({ pack: drawn, fetch: fetchBytes, wanted: laneL.wanted, tier, onFar: scene_.setTable, onHorizon: scene_.setHorizon, onCell: () => {}, onDrop: () => {} });
    if (ground && layer) {
      groundMesh = buildGround(layer, pack.terrain);
      group.add(groundMesh);
    }
    if (last) update(last);
    await parts(drawn);
  })();

  // the parts: the lights and probes before the light is made, the navgrid
  // before the battle; the creatures and vehicles stand when their models come
  async function parts(p) {
    const [lights, probes, actors, vehicles, nav] = await Promise.all([
      d.partOf(packWorld, 'lights.json', null),
      d.partOf(packWorld, 'probes.json', { probes: [] }),
      d.partOf(packWorld, 'actors.json', { life: [] }),
      d.partOf(packWorld, 'vehicles.json', { rides: [], things: [] }),
      p.nav?.file
        ? d
            .bytesOf(packWorld, p.nav.file)
            .then(fromBin)
            .catch(() => null)
        : null,
    ]);
    if (gone) return;
    const mine = (r) => layerShown(r.layer, mode);
    out.parts = {
      lights: lights && Object.keys(lights.cells ?? {}).length ? lights : null,
      volumes: (probes.probes ?? []).map(volumeOf),
      loadCube: (v) => d.loadCube(packWorld, v),
      life: (actors.life ?? []).filter(mine),
      rides: (vehicles.rides ?? []).filter(mine),
      things: (vehicles.things ?? []).filter(mine),
    };
    out.nav = nav;
    placed = d.createPlaced({ group, rows: [...out.parts.life, ...out.parts.rides, ...out.parts.things], heightAt: (x, z) => (layer ? LAYERS.image(x, z, layer) : 0) });
  }

  function update(at) {
    last = at;
    if (!stream) return;
    const p = toPack(pack, at);
    stream.update(p, tier);
    scene_.update(p);
  }

  return Object.assign(out, {
    get origin() {
      return pack?.origin ?? [0, 0, 0];
    },
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
    stats: () => ({ ...(scene_?.stats() ?? { tris: 0, calls: 0, instances: 0 }), placed: placed?.count() ?? 0 }),
    dispose() {
      gone = true;
      stream?.dispose();
      scene_?.dispose();
      loader?.dispose();
      placed?.dispose();
      if (groundMesh) {
        groundMesh.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      }
      group.removeFromParent();
    },
  });
}
