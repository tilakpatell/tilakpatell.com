// Putting things on a world: a kind (a vaporator, a sandcrawler, an Ewok
// hut) at a spot, turned and scaled, stood on the ground there, and made
// solid where it's solid. A kind with a model (catalog/*.js, from
// Sketchfab) is that model; one without (or whose model won't load) is
// built in code (props/*.js); a kind that's neither is left out. Scattered
// kinds (rocks by the hundred, palms, huts) are drawn instanced: one draw
// for all of them.
//
// createPlacer({ parent, kit, world, warm, house, models, kitTint }) → { put(spec),
// scatter(kind, items, opts), update(t, dt, you), signal(name, on) (to the
// built things that move when something happens: a trapdoor, a gate),
// setZone(inZone), ready (a promise: everything asked for so far is in),
// dispose() }
//   `models`: the book of models kinds are looked up in (catalog's
//   SURFACE_MODELS unless a page hands in its own); `props`, `scatter`:
//   the builds (props/'s PROPS and SCATTER unless a page hands in its own).
//   A thing or a scatter row whose `model` is 'kit:<pack>/<Name>' is that
//   kit model (lib/three/kit: public/kit/<pack>/), in place of its kind's:
//   each pack loaded once a placer, its leaves and bark in the world's wind
//   (the galaxy kit's clock and way) and in the house's look (`house`, the
//   world's lib/three/house), its materials tinted by `kitTint` (the
//   site's flora tint, flora.js: { [material name]: colour }). Scattered, it's drawn as a kind's model is,
//   its LOD1 far off; put, its parts stand under one group. A tree is solid
//   at its trunk (the manifest's `trunk`), anything else by its box. A
//   rigged one (the manifest's `rig`) is refused as one that won't load is,
//   said once a model: its skin is for its own mixer. One whose `model` is
//   'game:<name>' is that object of the drop's library (catalog/
//   bf2017-library.js), drawn as a kind's model is; one not imported yet,
//   or rigged, draws nothing, said once. Scattered, a row of the site's own
//   kind wearing one is the game's on mid and up (its own below, or where the
//   game's isn't there); a row that only adds one (kind 'game') draws on high
//   and up. A kind the game has the same of
//   (catalog/bf2017-game-for.js's GAME_FOR) is the game's on mid and up.
//   setKitLoader(fn) → the kits' loader (fn(pack, { house, wind }) → a kit,
//   as loadKit's) for the tests; null puts loadKit back.
//   With `seated` (ultra: amounts.js), whatever stands on the ground is
//   seated on the lowest ground under its footprint (seat.js), so it never
//   floats on a slope; below ultra, things stand as they always have.
//   Given `shadowOnly` (near.js's createShadowPhase(…).only), scattered
//   things don't cast shadows themselves: a stand-in for each part, drawn
//   only into the sun's shadow, holds just the instances near `you`
//   (near.js), found again each NEAR.step metres you walk.
//   Things put with `zone` (a room's build) are drawn only while you're in a
//   zone, and everything else only while you're not (setZone).
//   spec: { kind, at: [x, z], yaw, pitch, roll (radians: a walker on its
//   side), scale, y (over the ground), sink (into it), abs (y is the height
//   itself, not over the ground), solid (false: walk through it; or { r } /
//   { box: [hw, hd] } in place of its own), model (false: its build, even
//   where there's a model; 'kit:<pack>/<Name>': that kit model, its build
//   if it won't load), opts (for a built one), zone (it's a room's),
//   url (a model from elsewhere on the site, in place of the kind's: the
//   universe's Death Star over Scarif's sea; scaled to `metres` along its
//   longest side), fog (false: drawn clear of the fog, for something hung
//   in the sky far past where the fog would hide it) }

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { gltfLoader } from '../../../lib/three/gltf';
import { loadKit } from '../../../lib/three/kit';
import { sharpenMaterial } from '../../../lib/three/textures';
import { budget } from '../../../lib/budgets';
import { detailLevel } from '../../../lib/detail';
import { SURFACE_MODELS, lodUrlFor, modelUrlFor, wantsLod } from './catalog';
import { gameModel, isGame } from './catalog/bf2017-library';
import { modelFor } from './catalog/bf2017-game-for';
import { withDetail } from './detail';
import { LOOKS, loadScan, scanOf } from './kit';
import { wear as wearCore } from '../../../lib/three/core';
import { PROPS as GALAXY_PROPS, SCATTER as GALAXY_SCATTER } from './props';
import { litWindows } from './props/windows';
import { nearInstances, splitNear, zoneVisibility } from './near';
import { seatY } from './seat';
import { sizeFor } from '../../universe/landings/models';
import { dropTransmission } from '../../../lib/three/glass';
import { addLowLevel, addSolid, applyBuilt, clusterSpecs, copyInstances, kitFootprint, lodDistance, partsOf, radiusOf, unfogged, withLod } from './placerParts';

export { addLowLevel, applyBuilt, clusterSpecs, lodDistance, withLod };

const NEAR = { r: 70, max: 512, step: 8 }; // metres (the shadow box's corner, ±42 m, and the shadows long trees throw into it); instances; metres walked before they're found again

const getLoader = () => gltfLoader();
const cache = new Map(); // url → promise of the gltf (shared by every world, while the page is up)
// (every model a world has comes through here: things put and scattered,
// rides, people, their glass made plain see-through glass once, as it's
// parsed: lib/three/glass. A shuttle's canopy, a ramp's lamp or a pilot's
// visor with transmission had three draw the whole world twice a frame.)
export function loadGlb(url) {
  if (!cache.has(url))
    cache.set(
      url,
      getLoader()
        .loadAsync(url)
        .then((gltf) => (dropTransmission(gltf.scene), gltf))
        .catch(() => {
          cache.delete(url);
          return null;
        }),
    );
  return cache.get(url);
}
export const hasModel = (kind, models = SURFACE_MODELS) => Boolean(models[kind]);
// a `model: 'kit:<pack>/<Name>'`'s pack and name (null for anything else)
const KIT_REF = /^kit:([a-z0-9-]+)\/(\S+)$/i;
const kitRef = (model) => {
  const m = typeof model === 'string' ? KIT_REF.exec(model) : null;
  return m ? { pack: m[1], name: m[2] } : null;
};
let kitLoader = loadKit;
export function setKitLoader(fn) {
  kitLoader = fn ?? loadKit;
}
// whether a placed thing is drawn as a model: a kit model it names, or its
// kind's, where there is one, it wasn't asked to be built (model: false),
// and (an entry with `styles`) it's one of the styles the model is of
// (Theed's halls, not its towers), in `models` (the galaxy's, or a page's
// own book)
export const usesModel = (spec, models = SURFACE_MODELS) =>
  Boolean(kitRef(spec.model)) || (hasModel(spec.kind, models) && spec.model !== false && (!models[spec.kind].styles || models[spec.kind].styles.includes(spec.opts?.style)));

// A kind's model, and (its catalogue entry's `detail`: a scan's role) the
// scan laid over it up close (detail.js), on every tier but the lowest;
// resolves to the gltf, or null when it won't load. At ultra, a kind with an
// ultra cut loads that (catalog's modelUrlFor). `low`: the url is its light
// cut, which came in square and is left as it is; `models`: the book the
// kind is looked up in (the galaxy's, or a page's own).
// A model whose file came in turned off its nose (a catalogue row's `turn`,
// radians about its up: the bantha's lies 33° to its left): turned to face
// +z and its middle put back over its feet, once, in the loaded file itself,
// so every copy of it (a thing placed, a herd's beast, a ride) faces the way
// it walks. And one from a book whose files aren't in metres (a row with
// `tall`, `wide` or `long`: the Rick and Morty planets'), brought to that
// size and stood on y = 0 over its middle, once, as the moons' landings
// size theirs (landings/models.js's sizeFor). Gives the gltf back.
export function squared(gltf, kind, models = SURFACE_MODELS) {
  sized(gltf, models[kind]);
  const turn = models[kind]?.turn;
  const root = gltf?.scene;
  if (!turn || !root || root.userData.squared) return gltf;
  const inner = new THREE.Group();
  inner.name = 'squared';
  for (const c of [...root.children]) inner.add(c);
  inner.rotation.y = turn;
  root.add(inner);
  root.updateMatrixWorld(true);
  const c = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
  inner.position.x -= c.x;
  inner.position.z -= c.z;
  root.userData.squared = true;
  return gltf;
}
function sized(gltf, row) {
  const root = gltf?.scene;
  if (!root || root.userData.sized || !(row?.tall || row?.wide || row?.long)) return;
  const inner = new THREE.Group();
  inner.name = 'sized';
  for (const c of [...root.children]) inner.add(c);
  root.add(inner);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner);
  const k = sizeFor(box.getSize(new THREE.Vector3()), row);
  inner.scale.setScalar(k);
  inner.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  root.userData.sized = true;
}

// A kind's model, or its plain file when the cut asked for can't be had: a
// game-derived .ultra cut can live in the public bucket only (the pipeline
// design's section 6), so a site without the bucket, or a bucket without
// that file, still draws the kind, at high.
export const fallbackFor = (kind, url, models = SURFACE_MODELS) => {
  const plain = modelUrlFor(kind, 'high', models);
  return url !== plain && url === modelUrlFor(kind, 'ultra', models) ? plain : null;
};
// Which cut is drawn first and which swapped in after: a kind whose row is
// `native` (the game's own files, its plain and ultra cuts in the public
// bucket: the pipeline design's section 6) draws its light cut first, the
// level's own taking its place when it lands (lib/net/progressive.js's
// rule, a model's whole file the unit); otherwise the level's own cut,
// nothing after it.
export function cutsToLoad(kind, level, models = SURFACE_MODELS) {
  const url = modelUrlFor(kind, level, models);
  const row = models[kind];
  // (at low and mid a native kind's cut is the light one itself: nothing to swap in)
  if (row?.native && row.lod && url !== lodUrlFor(kind, models)) return { first: lodUrlFor(kind, models), then: url };
  return { first: url, then: null };
}

// the full cut's insides in place of the first's, under the same object (so
// whoever holds the first, a ride or a chase's bike, holds the full one)
export function swapIn(o, full) {
  for (const c of [...o.children]) o.remove(c);
  for (const c of [...full.children]) o.add(c);
  return o;
}

export function loadGlbOr(url, fallback = null) {
  return loadGlb(url).then((g) => g ?? (fallback ? loadGlb(fallback) : null));
}

export function loadModel(kind, { models = SURFACE_MODELS, low = false, url = low ? lodUrlFor(kind, models) : modelUrlFor(kind, detailLevel(), models) } = {}) {
  const role = models[kind]?.detail;
  const scan = role && detailLevel() !== 'low' ? loadScan(role) : null;
  return Promise.all([loadGlbOr(url, low ? null : fallbackFor(kind, url, models)).then((g) => (low ? g : squared(g, kind, models))), scan]).then(([gltf, got]) => {
    // (a model whose own finish reads wrong in the world: `look`, its
    // materials' metalness, roughness, ambient occlusion and reflections set)
    const look = models[kind]?.look;
    if (gltf && look && !gltf.scene.userData.looked) {
      gltf.scene.traverse((o) => {
        if (o.isMesh) for (const m of [o.material].flat()) for (const [k, v] of Object.entries(look)) if (k in m) m[k] = v;
      });
      gltf.scene.userData.looked = true;
    }
    // (a model that comes bare, its colour given here: `tint`)
    const tint = models[kind]?.tint;
    if (gltf && tint && !gltf.scene.userData.tinted) {
      const c = new THREE.Color(tint);
      gltf.scene.traverse((o) => {
        if (o.isMesh) for (const m of [o.material].flat()) m.color?.multiply(c);
      });
      gltf.scene.userData.tinted = true;
    }
    if (gltf && got && !gltf.scene.userData.detailed) {
      // (the scan's real size, and the brightness its detail map is centred on)
      const { metres = 2, mean = 0.8 } = scanOf(role) ?? {};
      gltf.scene.traverse((o) => {
        if (o.isMesh) for (const m of Array.isArray(o.material) ? o.material : [o.material]) withDetail(m, got, { metres, mean, ...models[kind].detailLook });
      });
      gltf.scene.userData.detailed = true;
    }
    return gltf;
  });
}

// the model, ready to place: shadows on, its maps sharp at a slant
function prepared(gltf) {
  const root = gltf.scene;
  if (!root.userData.prepared) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) sharpenMaterial(m);
    });
    root.userData.prepared = true;
  }
  return root;
}
export const cloneModel = (gltf) => {
  const root = prepared(gltf);
  let skinned = false;
  root.traverse((o) => (skinned ||= o.isSkinnedMesh));
  return skinned ? cloneSkinned(root) : root.clone();
};

// A loaded model laid over with a core role's scan (a thing's `wear: 'stone'`,
// for a model whose own pictures are mush): the scan on each of its lit
// materials, in the world at the scan's size; how many took it
const LIT_MODEL = (m) => Boolean(m && (m.isMeshStandardMaterial || m.isMeshLambertMaterial || m.isMeshPhongMaterial));
export async function wearModel(object, role, { wear = wearCore, load = loadScan } = {}) {
  const size = scanOf(role);
  if (!size) return 0;
  const scan = await load(role).catch(() => null);
  if (!scan?.map) return 0;
  const seen = new Set();
  object.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (LIT_MODEL(m) && !seen.has(m)) seen.add(m);
  });
  for (const m of seen) wear(m, scan, { metres: size.metres ?? 2, strength: LOOKS[role]?.strength ?? 0.55, normal: LOOKS[role]?.normal ?? 0.8, mean: size.mean ?? 0.8 });
  return seen.size;
}

export function createPlacer({ parent, kit, world, warm = (o) => Promise.resolve(o), shadowOnly = null, seated = false, house = null, kitTint = null, models = SURFACE_MODELS, props: PROPS = GALAXY_PROPS, scatter: SCATTER = GALAXY_SCATTER }) {
  // the kits named so far, by pack: each in the world's wind (the galaxy
  // kit's clock, and the way its foliage leans) and the house's look
  const kits = new Map();
  const lodWarned = new Set(); // (the kit models whose LOD1 wouldn't load, said once)
  const rigWarned = new Set(); // (the rigged kit models refused, said once)
  const gameWarned = new Set(); // (the library's `game:` objects not drawn, said once)
  const kitFor = (pack) => {
    if (!kits.has(pack)) {
      // (a copy of the way the foliage leans: wind() clones its dir, so the two agree only while nothing turns the wind at run time, and nothing does)
      const dir = kit?.mats?.foliage?.userData.wind?.uWindDir?.value;
      kits.set(pack, kitLoader(pack, { house, wind: { time: kit?.wind, ...(dir ? { dir } : {}) }, tint: kitTint }));
    }
    return kits.get(pack);
  };
  // a kit model's parts, once its pack's manifest is in; a rigged one is
  // refused as one that won't load is (its parts are a skinned mesh for its
  // own mixer: stood here, it would be its bind pose wherever its bones put it)
  const kitModel = (ref) => {
    const k = kitFor(ref.pack);
    return k.manifest.then(() => {
      if (k.info(ref.name)?.rig) throw Object.assign(new Error(`${ref.name} is rigged`), { rigged: true });
      return k.model(ref.name);
    });
  };
  // what's said when a kit model doesn't come (a rig, once a model), and
  // whether its build `stands` in
  const kitMissing = (model, e, stands) => {
    if (e?.rigged && rigWarned.has(model)) return;
    if (e?.rigged) rigWarned.add(model);
    console.warn(`placer: ${model} ${e?.rigged ? 'is rigged, and a placer draws still things' : `won't load (${e?.message ?? e})`}; ${stands ? 'its build stands in' : 'nothing stands in'}`);
  };
  const group = new THREE.Group();
  group.name = 'things';
  parent.add(group);
  const rooms = new THREE.Group(); // (the zones' builds: hidden till you're in one)
  rooms.name = 'rooms';
  rooms.visible = false;
  parent.add(rooms);
  const casters = []; // { mesh (the stand-in), src (the matrices of the instanced mesh it casts for), xs, zs }
  const splits = []; // { full, low (each [{ mesh, src }]), xs, zs, r }: scattered models drawn near and far
  let nearAt = null; // where you were when the casters were last filled
  const updates = [];
  const follows = []; // (the built things updated with where you are)
  const signals = [];
  const pending = [];
  let dead = false;

  const groundY = (x, z) => world.heightAt(x, z);
  const spot = (spec) => {
    const [x, z] = spec.at;
    return [x, (spec.abs ? 0 : groundY(x, z)) + (spec.y ?? 0) - (spec.sink ?? 0), z];
  };
  // stood on the lowest ground under its footprint (seat.js), so no side
  // floats over a slope: only what's stood on the ground itself (not one
  // hung at a height, nor a room's); a model put on its own (a building, a
  // hut, a landmark) goes down a metre at most, its own foundations holding
  // the rest
  const seatable = (spec) => seated && !spec.abs && spec.y == null && !spec.zone;
  const seat = (spec, at, r, max = 2) => {
    if (!seatable(spec) || !(r > 0.3)) return at;
    at[1] = seatY(groundY, at[0], at[2], r, { max }) - (spec.sink ?? 0);
    return at;
  };

  // a built one (made once for each kind and options and copied after,
  // geometry and materials shared, unless it moves: its own update or signal)
  const builtCache = new Map();
  const make = (spec) => {
    const fn = PROPS[spec.kind];
    if (!fn) return null;
    const key = `${spec.kind}|${JSON.stringify(spec.opts ?? {})}`;
    const had = builtCache.get(key);
    if (had) return { ...had, object: had.object.clone() };
    const made = fn(kit, spec.opts ?? {});
    if (!made.update && !made.signal) builtCache.set(key, { ...made, object: made.object.clone() });
    return made;
  };
  const build = (spec, at) => {
    const made = make(spec);
    if (!made) return null;
    const o = made.object;
    o.position.set(...at);
    o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
    o.scale.setScalar(spec.scale ?? 1);
    (spec.zone ? rooms : group).add(o);
    applyBuilt(made, spec, at, world, { updates, follows, signals, object: true });
    // (a built one that wears a model on a moving part of it, once it's
    // loaded: `wear: { url, on(model) }`, the dragonsnake's head)
    if (made.wear)
      loadGlb(made.wear.url)
        .then((gltf) => !dead && gltf && made.wear.on(cloneModel(gltf)))
        .catch(() => {});
    return o;
  };
  // a built one's walls and floors only, under its model (its meshes thrown
  // away: the model is drawn in its place)
  const builtSolids = (spec, at) => {
    const fn = PROPS[spec.kind];
    if (!fn) return;
    const made = fn(kit, spec.opts ?? {});
    applyBuilt(made, spec, at, world, { updates, signals, object: false });
    made.object.traverse((o) => o.geometry?.dispose());
  };

  // a model's own footprint, from its box: a circle for something small, a
  // box (a little inside its edges) for anything bigger
  const footprint = (o, spec, at) => {
    if (spec.solid === false) return;
    const yaw = spec.yaw ?? 0;
    if (spec.solid?.r) return world.solids.circle(at[0], at[2], spec.solid.r);
    if (spec.solid?.box) return addSolid(world, { box: [0, 0, ...spec.solid.box] }, at, yaw, 1, null);
    // (its box in its own frame: turned back square for the measuring)
    o.rotation.y = 0;
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    o.rotation.y = yaw;
    o.updateMatrixWorld(true);
    const size = box.getSize(new THREE.Vector3());
    const w = size.x / 2;
    const d = size.z / 2;
    if (Math.max(w, d) < 1.6) world.solids.circle(at[0], at[2], Math.min(w, d) * 0.8, { top: size.y < 0.8 ? at[1] + size.y : null });
    else world.solids.box(at[0], at[2], w * 0.85, d * 0.85, yaw, { top: size.y < 1 ? at[1] + size.y : null });
  };

  return {
    group,
    // one thing; resolves to its object (or null)
    put(spec) {
      // (a generic prop the game has, on mid and up: the game's, catalog/bf2017-game-for.js)
      const swap = spec.model === undefined && modelFor(spec.kind, detailLevel(), models);
      if (swap) spec = { ...spec, model: swap };
      // (the drop's library, `model: 'game:<name>'`: drawn as that object's kind, or nothing)
      if (isGame(spec.model)) {
        const game = gameModel(spec.model, models, gameWarned);
        if (!game) return Promise.resolve(null);
        spec = { ...spec, kind: game, model: undefined };
      }
      // (a cluster: its members put each in its place, turned with it)
      const ref = kitRef(spec.model);
      const cluster = !spec.zone && spec.model !== false && !ref && models[spec.kind]?.cluster;
      if (cluster) return Promise.all(clusterSpecs(spec, cluster).map((m) => this.put(m))).then(() => null);
      const at = spot(spec);
      // (a model from elsewhere on the site, by its url: stood at `at`, its
      // longest side `metres`; its build if it won't load)
      if (spec.url) {
        const p = loadGlb(spec.url)
          .then((gltf) => {
            if (dead) return null;
            if (!gltf) return build(spec, at);
            const o = cloneModel(gltf);
            const box = new THREE.Box3().setFromObject(o);
            const size = box.getSize(new THREE.Vector3());
            const k = (spec.metres ?? Math.max(size.x, size.y, size.z)) / Math.max(size.x, size.y, size.z);
            const c = box.getCenter(new THREE.Vector3());
            const inner = new THREE.Group();
            inner.add(o);
            o.position.set(-c.x * k, (spec.centred ? -c.y : -box.min.y) * k, -c.z * k);
            o.scale.setScalar(k);
            inner.position.set(...at);
            inner.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
            (spec.zone ? rooms : group).add(inner);
            if (spec.fog === false) unfogged(inner);
            if (spec.solid !== false) footprint(inner, spec, at);
            return warm(inner).then(() => inner);
          })
          .catch(() => null);
        pending.push(p);
        return p;
      }
      // (a kit model: its parts under one group, stood, turned and scaled
      // as a kind's model is; its build if it won't load or is rigged)
      if (ref) {
        const k = kitFor(ref.pack);
        const p = kitModel(ref)
          .then(
            (got) => {
              if (dead) return null;
              const o = new THREE.Group();
              o.name = spec.model;
              for (const part of got.parts) {
                const m = new THREE.Mesh(part.geometry, part.material);
                part.local.decompose(m.position, m.quaternion, m.scale);
                m.castShadow = true;
                m.receiveShadow = true;
                o.add(m);
              }
              const scale = spec.scale ?? 1;
              o.position.set(...at);
              o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
              o.scale.setScalar(scale);
              const foot = kitFootprint(got.parts, k.info(ref.name));
              o.position.y = seat(spec, at, foot.seat * scale, 1)[1];
              (spec.zone ? rooms : group).add(o);
              if (spec.fog === false) unfogged(o);
              if (foot.trunk && (spec.solid == null || spec.solid === true)) world.solids.circle(at[0], at[2], foot.trunk * scale);
              else footprint(o, spec, at);
              return warm(o).then(() => o);
            },
            (e) => {
              if (dead) return null;
              const o = build(spec, at);
              kitMissing(spec.model, e, o);
              return o;
            },
          )
          .catch(() => null);
        pending.push(p);
        return p;
      }
      if (usesModel(spec, models)) {
        const cuts = cutsToLoad(spec.kind, detailLevel(), models);
        const p = loadModel(spec.kind, { models, url: cuts.first })
          .then((gltf) => {
            if (dead) return null;
            if (!gltf) return build(spec, at);
            const o = cloneModel(gltf);
            // (the full cut after, swapped in when it lands; the plain stays if it can't be had)
            if (cuts.then)
              loadGlb(cuts.then)
                .then((full) => {
                  if (dead || !full) return;
                  swapIn(o, cloneModel(squared(full, spec.kind, models)));
                  warm(o);
                })
                .catch(() => {});
            o.position.set(...at);
            o.rotation.set(spec.pitch ?? 0, spec.yaw ?? 0, spec.roll ?? 0, 'YXZ');
            o.scale.setScalar(spec.scale ?? 1);
            // (seated by its box, a little inside its edges: a metre down at most)
            if (seatable(spec)) {
              const size = new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
              const r = Math.min(size.x, size.z) * 0.4;
              o.position.y = seat(spec, at, r, 1)[1];
            }
            const holder = spec.zone ? rooms : group;
            holder.add(o);
            if (spec.fog === false) unfogged(o);
            const entry = models[spec.kind];
            if (entry.solids === 'built') builtSolids(spec, at);
            else footprint(o, spec, at);
            // (worn before its shaders are made, so they're made once)
            const worn = spec.wear ? wearModel(o, spec.wear) : Promise.resolve();
            // (a tower: its windows lit in the shader, props/windows.js)
            if (spec.windows) o.traverse((m) => m.isMesh && [].concat(m.material).forEach((mat) => mat.isMeshStandardMaterial && litWindows(mat, { seed: 5, density: 0.5, cell: [4, 5] })));
            if (!wantsLod(spec.kind, detailLevel(), models)) return worn.then(() => warm(o)).then(() => o);
            // far off, its light model (fetched after the full one: the
            // first view doesn't wait for it)
            const lod = withLod(o, null, radiusOf(gltf) * (spec.scale ?? 1));
            holder.add(lod);
            loadModel(spec.kind, { models, low: true }).then((low) => {
              if (dead || !low) return;
              const l = cloneModel(low);
              addLowLevel(lod, l, radiusOf(gltf) * (spec.scale ?? 1));
              warm(l);
            });
            return worn.then(() => warm(o)).then(() => lod);
          })
          .catch(() => null);
        pending.push(p);
        return p;
      }
      return Promise.resolve(build(spec, at));
    },
    // many of one kind: items [{ at: [x, z], yaw, scale, y }]; drawn instanced
    // (`shadow: false`: no shadow at all, for ground cover too low to throw
    // one worth its draws)
    scatter(kind, items, { opts = {}, solid = true, model = true, shadow = true } = {}) {
      if (!items.length) return Promise.resolve(null);
      if (model === true) model = modelFor(kind, detailLevel(), models) || true;
      // (the drop's library: a row of the site's own kind wearing the game's
      // model is the game's on mid and up and the site's own below; one that
      // only adds, kind 'game', is drawn on high and up, the phones keeping
      // their budgets)
      if (isGame(model)) {
        const level = detailLevel();
        const adds = kind === 'game';
        const game = level === 'low' || (adds && level === 'mid') ? null : gameModel(model, models, gameWarned);
        if (!game && adds) return Promise.resolve(null);
        kind = game ?? kind;
        model = true;
      }
      const mats = items.map((it) => {
        const at = spot({ ...it });
        const s = it.scale ?? 1;
        return { at, s, yaw: it.yaw ?? 0, m: new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw ?? 0), new THREE.Vector3(s, s * (it.stretch ?? 1), s)) };
      });
      const xs = Float32Array.from(mats, (x) => x.at[0]);
      const zs = Float32Array.from(mats, (x) => x.at[2]);
      // each part an instanced mesh of every item (its matrices kept, `src`,
      // for the near shadow stand-ins and the near/far split to copy from)
      const instanceParts = (all) =>
        all.map((q) => (shadow ? q : { ...q, shadow: false })).map((p) => {
          const mesh = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
          mats.forEach((x, i) => mesh.setMatrixAt(i, p.local ? x.m.clone().multiply(p.local) : x.m));
          mesh.castShadow = !shadowOnly && p.shadow !== false; // (else its near stand-in casts for it)
          mesh.receiveShadow = true;
          mesh.computeBoundingSphere();
          group.add(mesh);
          const src = mesh.instanceMatrix.array.slice();
          if (shadowOnly && p.shadow !== false) casters.push({ mesh: casterFor(p, Math.min(NEAR.max, mats.length)), src, xs, zs });
          return { mesh, src };
        });
      // (each item seated by the footprint it turns out to have: `seatR`,
      // its radius at scale 1)
      const instance = (parts, radius, seatR = radius) => {
        if (seatR > 0)
          for (let i = 0; i < mats.length; i++) {
            const x = mats[i];
            const it = items[i];
            if (!seatable(it)) continue;
            x.at = seat(it, x.at, seatR * x.s * 0.8);
            x.m.setPosition(x.at[0], x.at[1], x.at[2]);
          }
        const made = instanceParts(parts);
        nearAt = null; // (found again on the next update, these with them)
        if (solid && radius) for (const x of mats) world.solids.circle(x.at[0], x.at[2], radius * x.s);
        return made;
      };
      // (built, as a kind with no model is: SCATTER's, or a prop's parts;
      // whether there was anything to build)
      const built = () => {
        const made = SCATTER[kind]?.(kit, opts) ?? (PROPS[kind] ? { parts: partsOf(PROPS[kind](kit, opts)), radius: opts.radius ?? 0.5 } : null);
        if (made) instance(made.parts, typeof solid === 'number' ? solid : made.radius, made.radius);
        return Boolean(made);
      };
      // a kit model: its parts as a kind's model's are, its LOD1 split off
      // far away as a kind's light copy is (at the levels that have one);
      // its build if it won't load or is rigged
      const ref = kitRef(model);
      if (ref) {
        const k = kitFor(ref.pack);
        const p = kitModel(ref).then(
          (got) => {
            if (dead) return null;
            const foot = kitFootprint(got.parts, k.info(ref.name));
            const full = instance(got.parts, typeof solid === 'number' ? solid : foot.radius, foot.seat);
            if (budget(detailLevel()).lod1)
              k.lod1(ref.name).then(
                (lowParts) => {
                  if (dead) return;
                  const low = instanceParts(lowParts.map((q) => ({ ...q, shadow: false })));
                  for (const l of low) l.mesh.castShadow = false; // (far off: past the shadow's reach)
                  splits.push({ full, low, xs, zs, r: lodDistance(got.radius) });
                  nearAt = null;
                },
                (e) => {
                  // (no LOD1: the full model at every distance, as at ultra)
                  if (dead || lodWarned.has(model)) return;
                  lodWarned.add(model);
                  console.warn(`placer: ${model}'s LOD1 won't load (${e?.message ?? e}); the full model draws at every distance`);
                },
              );
            return null;
          },
          (e) => {
            if (dead) return null;
            kitMissing(model, e, built());
            return null;
          },
        );
        pending.push(p);
        return p;
      }
      if (model && hasModel(kind, models)) {
        const p = loadModel(kind, { models }).then((gltf) => {
          if (dead) return null;
          if (!gltf) {
            const made = SCATTER[kind]?.(kit, opts);
            if (made) instance(made.parts, made.radius);
            return null;
          }
          const root = prepared(gltf);
          root.updateMatrixWorld(true);
          const parts = [];
          root.traverse((o) => {
            if (o.isMesh && !o.isSkinnedMesh) parts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() });
          });
          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const full = instance(parts, typeof solid === 'number' ? solid : Math.min(size.x, size.z) * 0.35, Math.min(size.x, size.z) * 0.45);
          // far off, its light copy: the items past lodDistance drawn with it
          // instead (split again as you walk, with the shadow stand-ins);
          // never at ultra, which draws the full model at every distance
          if (wantsLod(kind, detailLevel(), models))
            loadModel(kind, { models, low: true }).then((lowGltf) => {
              if (dead || !lowGltf) return;
              const lowRoot = prepared(lowGltf);
              lowRoot.updateMatrixWorld(true);
              const lowParts = [];
              lowRoot.traverse((o) => {
                if (o.isMesh && !o.isSkinnedMesh) lowParts.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone(), shadow: false });
              });
              const low = instanceParts(lowParts);
              for (const l of low) l.mesh.castShadow = false; // (far off: past the shadow's reach)
              splits.push({ full, low, xs, zs, r: lodDistance(radiusOf(gltf)) });
              nearAt = null;
              warm(lowRoot);
            });
          return null;
        });
        pending.push(p);
        return p;
      }
      built();
      return Promise.resolve(null);
    },
    get ready() {
      return Promise.all(pending);
    },
    update(t, dt, you = null) {
      for (const u of updates) u(t, dt);
      for (const f of follows) f(t, dt, you);
      if (you && (casters.length || splits.length) && (!nearAt || Math.hypot(you.x - nearAt[0], you.z - nearAt[1]) > NEAR.step)) {
        nearAt = [you.x, you.z];
        for (const c of casters) fillCaster(c, you.x, you.z);
        for (const sp of splits) fillSplit(sp, you.x, you.z);
      }
    },
    // in a zone, its room and not the world outside; out, the other way round
    setZone(inZone) {
      const v = zoneVisibility(inZone);
      group.visible = v.outdoors;
      rooms.visible = v.zones;
    },
    // something happening to what's built (a trapdoor opening, a gate
    // coming down, a band starting up): each built thing that answers to
    // `name` does it
    signal(name, on = true) {
      for (const s of signals) s(name, on);
    },
    dispose() {
      dead = true;
      group.removeFromParent();
      rooms.removeFromParent();
      for (const c of casters) c.mesh.material.dispose();
      for (const k of kits.values()) k.dispose();
      kits.clear();
    },
  };

  // a part's shadow stand-in: its geometry, in a material that keeps only what
  // the shadow pass reads (the cut-outs of leaves and fronds), drawn only in
  // the sun's shadow pass (shadowOnly), never in the view
  function casterFor(p, count) {
    const m = Array.isArray(p.material) ? p.material[0] : p.material;
    const material = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, map: m.alphaTest > 0 ? (m.map ?? null) : null, alphaMap: m.alphaMap ?? null, alphaTest: m.alphaTest ?? 0, side: m.side });
    const mesh = new THREE.InstancedMesh(p.geometry, material, count);
    mesh.count = 0;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    shadowOnly(mesh); // (and in the shadow pass, never culled: it's only what's round you, in the shadow camera's box)
    mesh.name = 'shadow-near';
    group.add(mesh);
    return mesh;
  }
  // the stand-in given the instances near (x, z): their matrices copied over
  function fillCaster(c, x, z) {
    const near = nearInstances(c.xs, c.zs, x, z, NEAR.r, c.mesh.instanceMatrix.count);
    copyInstances(c.mesh, c.src, near);
  }
  // a scattered model's items near (x, z) in its full meshes, the rest in its
  // light copy's
  function fillSplit(sp, x, z) {
    const { near, far } = splitNear(sp.xs, sp.zs, x, z, sp.r);
    for (const f of sp.full) copyInstances(f.mesh, f.src, near);
    for (const l of sp.low) copyInstances(l.mesh, l.src, far);
  }
}
