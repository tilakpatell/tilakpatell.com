// The galaxy's ships and stations as the set pieces place them: the models
// that load (the Star Destroyer, the corvette, the X-wing, the interceptor,
// Slave I, the Republic's Venator, the Millennium Falcon, the Death Star, and
// the galaxy's own from Sketchfab: the Rebellion's cruisers and fighters, the
// Executor, the Separatists' and the Republic's ships) and the ones built in
// code (galaxy/fleet.js: everything else). Each kind is made once, its first
// copy kept as a template, and every ship of that kind after it is a copy
// sharing its geometry and materials (so the four Star Destroyers over Hoth
// cost one build). A kind that loads
// flies as its built stand-in until it's here (its own, or STAND_IN's where
// it has none), and a slot swaps over the moment it is.
//
// createModels({ prepare(object) → Promise }) → { slot(kind, size, { tint }) → slot,
//   want(kinds), prebuild(kinds), builtCount, update(t), dispose() }
// slot: { holder (place it, turn it), kind, size, ready }; every model sits in
// its holder centred, nose along +z, +y up, `size` long nose to tail (a
// station, or a ship that flies upright, `size` at its biggest side:
// universe/shipFit.js).

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { device } from '../../lib/device';
import { gen3dUrl } from '../../lib/three/gen3d';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { GLB } from '../universe/glbFleet';
import { fitScale } from '../universe/shipFit';
import { BUILT_KINDS } from '../universe/trafficModels';
import { GALAXY_KINDS, buildGalaxyShip } from './fleet';

// which way each loaded model's nose points as it comes (turned to +z): the
// universe's, and the galaxy's own from Sketchfab (scripts/sketchfab-galaxy.mjs),
// which take over from the ones built in code
export const MODELS = {
  ...Object.fromEntries(Object.entries(GLB).map(([k, d]) => [k, { url: d.url, nose: d.nose }])),
  venator: { url: '/models/universe/venator.glb', nose: Math.PI / 2 },
  falcon: { url: '/models/universe/falcon.glb', nose: -Math.PI / 2 },
  deathstar: { url: '/models/universe/death-star.glb', nose: 0 },
  moncal: { url: '/models/galaxy/moncal.glb', nose: 0 },
  nebulon: { url: '/models/galaxy/nebulon.glb', nose: 0 },
  awing: { url: '/models/galaxy/awing.glb', nose: 0 },
  ywing: { url: '/models/galaxy/ywing.glb', nose: 0 },
  bwing: { url: '/models/galaxy/bwing.glb', nose: 0 },
  uwing: { url: '/models/galaxy/uwing.glb', nose: Math.PI },
  ghost: { url: '/models/galaxy/ghost.glb', nose: 0 },
  executor: { url: '/models/galaxy/executor.glb', nose: 0 },
  tie: { url: '/models/galaxy/tie.glb', nose: 0 },
  tiebomber: { url: '/models/galaxy/tiebomber.glb', nose: 0 },
  tieadvanced: { url: '/models/galaxy/tieadvanced.glb', nose: 0 },
  shuttle: { url: '/models/galaxy/shuttle.glb', nose: 0 },
  lightcruiser: { url: '/models/galaxy/lightcruiser.glb', nose: -Math.PI / 2 },
  gozanti: { url: '/models/galaxy/gozanti.glb', nose: 0 },
  lucrehulk: { url: '/models/galaxy/lucrehulk.glb', nose: 0 },
  coreship: { url: '/models/galaxy/coreship.glb', nose: 0 },
  munificent: { url: '/models/galaxy/munificent.glb', nose: 0 },
  providence: { url: '/models/galaxy/providence.glb', nose: 0 },
  vulture: { url: '/models/galaxy/vulture.glb', nose: Math.PI },
  trifighter: { url: '/models/galaxy/trifighter.glb', nose: 0 },
  acclamator: { url: '/models/galaxy/acclamator.glb', nose: 0 },
  delta7: { url: '/models/galaxy/delta7.glb', nose: 0 },
  xwing65: { url: '/models/galaxy/xwing65.glb', nose: 0 }, // (the game's T-65, Starfighter Assault's: scripts/bf2017-fleet.mjs)
  arc170: { url: '/models/galaxy/arc170.glb', nose: Math.PI },
  n1: { url: '/models/galaxy/n1.glb', nose: 0 },
  nubian: { url: '/models/galaxy/nubian.glb', nose: 0 },
  razorcrest: { url: '/models/galaxy/surface/razorcrest.glb', nose: 0 }, // (the one the surfaces fly)
  // the ones that were built in code till somebody's model was found
  // (scripts/sketchfab-galaxy.mjs): the YT-2400, the Xg-1, the GR-75,
  // Bespin's cloud cars, the IG-2000 and the second Death Star (Cloud City
  // stays built: world.js's solids and landing fit its disc); and the
  // Interdictor, which came that way as a flat white wedge and was made
  // again with Meshy (scripts/meshy-galaxy-library.mjs, turned nose to +z)
  freighter: { url: '/models/galaxy/freighter.glb', nose: 0 },
  gunboat: { url: '/models/galaxy/gunboat.glb', nose: 0 },
  transport: { url: '/models/galaxy/transport.glb', nose: 0 },
  cloudcar: { url: '/models/galaxy/cloudcar.glb', nose: -Math.PI / 2 },
  ig2000: { url: '/models/galaxy/ig2000.glb', nose: 0 },
  interdictor: { url: '/models/galaxy/interdictor.glb', nose: 0 },
  deathstar2: { url: '/models/galaxy/deathstar2.glb', nose: 0 }, // (N8's since, scripts/deathstar-hd.mjs: dish to +z)
  // and the ones made with Meshy from Wookieepedia's picture of each
  // (scripts/meshy-galaxy-library.mjs), every one come nose to -x: the
  // Hound's Tooth, the Punishing One, the Hammerhead and the Gauntlet,
  // which were built in code; and the Twilight, the Scimitar, the TIE
  // Defender, the TIE Striker, the V-wing, the Eta-2, the Hyena, the
  // Sentinel, the Zeta, the Fang and the Naboo yacht, for the systems to fly
  houndstooth: { url: '/models/galaxy/houndstooth.glb', nose: Math.PI / 2 },
  punishingone: { url: '/models/galaxy/punishingone.glb', nose: Math.PI / 2 },
  hammerhead: { url: '/models/galaxy/hammerhead.glb', nose: Math.PI / 2 },
  gauntlet: { url: '/models/galaxy/gauntlet.glb', nose: Math.PI / 2 },
  twilight: { url: '/models/galaxy/twilight.glb', nose: Math.PI / 2 },
  scimitar: { url: '/models/galaxy/scimitar.glb', nose: Math.PI / 2 },
  tiedefender: { url: '/models/galaxy/tiedefender.glb', nose: Math.PI / 2 },
  tiestriker: { url: '/models/galaxy/tiestriker.glb', nose: Math.PI / 2 },
  vwing: { url: '/models/galaxy/vwing.glb', nose: Math.PI / 2 },
  eta2: { url: '/models/galaxy/eta2.glb', nose: Math.PI / 2 },
  hyena: { url: '/models/galaxy/hyena.glb', nose: Math.PI / 2 },
  sentinel: { url: '/models/galaxy/sentinel.glb', nose: Math.PI / 2 },
  zeta: { url: '/models/galaxy/zeta.glb', nose: Math.PI / 2 },
  fang: { url: '/models/galaxy/fang.glb', nose: Math.PI / 2 },
  naboocruiser: { url: '/models/galaxy/naboocruiser.glb', nose: Math.PI / 2 },
  // the universe map's corvette made again for the galaxy, where one flies
  // close by in every Rebel line (its own file: the universe map keeps the
  // lighter cr90.glb for its traffic), turned nose to +z in the making
  corvette: { url: '/models/galaxy/corvette.glb', nose: 0 },
  // and its TIE interceptor, out of a picture of the real ship (the made one
  // below, from the universe map's own model's render, came out lumpy and
  // grey, and at 746 KB weighed more than this one does)
  interceptor: { url: '/models/galaxy/interceptor.glb', nose: 0 },
  // the universe map's wars' flagships (scripts/meshy-war.mjs: Rick and
  // Morty's from the show's own pictures, Breaking Bad's from words)
  councildread: { url: '/models/universe/war/councildread.glb', nose: Math.PI / 2 },
  fedbattleship: { url: '/models/universe/war/fedbattleship.glb', nose: 0 },
  superlab: { url: '/models/universe/war/superlab.glb', nose: Math.PI / 2 },
  hacienda: { url: '/models/universe/war/hacienda.glb', nose: 0 }, // (its thrusters either side)
};
// the ones made again here (scripts/gen3d, remade from these models' own
// renders): kind → the made model's name, loaded in the light cut (20k
// triangles, 1024 maps) whatever the device. These are the galaxy's own
// fighters, not yours (your X-wing is its own model, universe/shipModels.js),
// and a fighter shows its whole model only inside LOD_NEAR times its size, a
// dozen units or so; the desktop's 120k-triangle cut of the X-wing and the
// interceptor came to 6.6 MB of every arrival, against 1.4 MB for these
// (the interceptor's now the Meshy one above).
export const MADE = { xwing: 'x-wing' };
for (const [kind, name] of Object.entries(MADE)) if (MODELS[kind]) MODELS[kind] = { ...MODELS[kind], url: gen3dUrl(name, 'low') };

// The capitals' close-up cut: Daniel Andersson's Imperial II and Nebulon-B
// (scripts/sketchfab-galaxy.mjs, `hq`), about 100k triangles with
// 2K maps, which hold up with a fighter flying along their hulls. Only a
// desktop with a graphics card loads them (detail high or ultra); a laptop
// or a phone keeps the lighter ones. Each has its own far-off copy, since
// the old one's, fitted to the new hull's box, would sit wrong on it
// (scripts/galaxy-lod.mjs hq/<kind>). The
// battles' subsystems, batteries and hulls (universe/wars.js) are shares of
// the ship's length, so they hold on either cut. nose: as each comes.
export const HQ = {
  destroyer: { url: '/models/galaxy/hq/destroyer.glb', nose: 0 },
  nebulon: { url: '/models/galaxy/hq/nebulon.glb', nose: 0 },
};
// And the Death Stars' 4096-pixel maps (scripts/deathstar-hd.mjs), loaded
// only on the strongest graphics (ultra), as the planets' biggest maps are:
// the two take about a quarter of a gigabyte of graphics memory between
// them. The same hulls as the 2048 cuts, so each keeps its own far-off copy
// (and the first Death Star none: the world draws its sphere).
export const HD_MAPS = {
  deathstar: '/models/universe/death-star.hq.glb',
  deathstar2: '/models/galaxy/deathstar2.hq.glb',
};
const HQ_DETAILS = new Set(['high', 'ultra']);
export const withHq = (models, detail) =>
  HQ_DETAILS.has(detail)
    ? {
        ...models,
        ...Object.fromEntries(Object.entries(HQ).filter(([k]) => models[k]).map(([k, d]) => [k, { url: d.url, nose: d.nose, hq: true }])),
        ...(detail === 'ultra' ? Object.fromEntries(Object.entries(HD_MAPS).filter(([k]) => models[k]).map(([k, url]) => [k, { ...models[k], url }])) : {}),
      }
    : models;
// the models as a device of this detail loads them (MODELS is this device's)
const LIGHT = { ...MODELS };
export const modelsAt = (detail) => withHq(LIGHT, detail);
Object.assign(MODELS, modelsAt(device().detail));

// what every system's arrival loads, whatever's there (galaxy/scene.js): the
// Star Destroyer and the corvette the set pieces and the battles fly, and the
// X-wing and the interceptor that fight over nearly every world
export const ARRIVAL = ['destroyer', 'corvette', 'xwing', 'interceptor'];

const BUILT = new Set([...BUILT_KINDS, ...GALAXY_KINDS]);

// a kind with no built version of its own flies as another's till its model
// loads (else its slot would be empty, and the ship would pop in): the
// Venator as a Star Destroyer, Slave I and the Falcon as a freighter, the TIE
// bomber as a TIE, Gideon's cruiser as a Star Destroyer, the Gozanti and the
// Ghost as freighters, the Invisible Hand as a Munificent, the wars'
// flagships as a ship of their side (the superlab as a Madrigal freighter,
// the hacienda as the cartel's lowrider). The Death Star has
// none here: the world puts a sphere of its own in its place.
export const STAND_IN = {
  venator: 'destroyer',
  slave1: 'freighter',
  falcon: 'freighter',
  tiebomber: 'tie',
  lightcruiser: 'destroyer',
  gozanti: 'freighter',
  providence: 'munificent',
  ghost: 'freighter',
  councildread: 'councilship',
  fedbattleship: 'fedcruiser',
  superlab: 'madrigal',
  hacienda: 'lowrider',
  // the Meshy-made library ships: each as the nearest built one of its kind
  twilight: 'freighter',
  scimitar: 'shuttle',
  tiedefender: 'tie',
  tiestriker: 'tie',
  vwing: 'delta7',
  xwing65: 'xwing',
  eta2: 'delta7',
  hyena: 'vulture',
  sentinel: 'shuttle',
  zeta: 'shuttle',
  fang: 'awing',
  naboocruiser: 'nubian',
};

// Far off, a ship is its LOD (scripts/galaxy-lod.mjs: one mesh of a few
// thousand triangles, its look baked into vertex colours), and farther still
// nothing (the engine glow keeps it a glint): past LOD_NEAR times its size, and
// LOD_FAR times. Tinted and skinned slots keep the full model at every range.
export const LOD_NEAR = 45;
export const LOD_FAR = 900;
export const lodUrl = (kind, models = MODELS) => (models[kind] && kind !== 'deathstar' ? `/models/galaxy/lod/${models[kind].hq ? 'hq/' : ''}${kind}.glb` : null);
export const lodLevels = (size) => [
  [0, 'full'],
  [LOD_NEAR * size, 'lod'],
  [LOD_FAR * size, 'none'],
];

// the models the hunters fly (universe/glbFleet.js flies them: the galaxy's
// droids and Imperial TIEs, and its X-wings and interceptors in the cut the
// battles load, each built until it's here). The Y-wing, the A-wing and the
// TIE bomber are the whole models, not GLB's far-off copies: those are for
// the universe map, where a fighter is a few pixels long, and they have no
// normals, so a wingman flying beside you came out in facets. The bounty
// hunters' ships and the navy's gunboats are their models too, where they
// were only ever the built ones. And the Star Destroyer and the corvette
// that jump in on you (universe/setpieces.js) are the battles' ones, which
// every arrival has loaded already: on a desktop the destroyer's is the
// close-up cut, where the universe map's would have been another 470 KB of a
// lesser ship, and the corvette is the galaxy's own.
export const HUNTER_GLB = {
  ...GLB,
  ...Object.fromEntries(['vulture', 'trifighter', 'tie', 'tieadvanced', 'xwing', 'interceptor', 'ywing', 'awing', 'tiebomber', 'gunboat', 'ig2000', 'houndstooth', 'punishingone', 'destroyer', 'corvette'].map((k) => [k, { ...MODELS[k], built: true }])),
  // (the war's other hunters and what their capital ships drop in: the
  // Republic's fighters, Wedge in an X-wing, a Mon Calamari cruiser, a Venator)
  ...Object.fromEntries(['arc170', 'delta7', 'moncal', 'venator'].map((k) => [k, { ...MODELS[k], built: false }])),
  redleader: { ...MODELS.xwing, built: false },
};

// a model's materials tuned to the scene's light: engines and lights hot
// enough to bloom, nothing mirror-shiny
function tune(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if ('roughness' in m) m.roughness = Math.min(Math.max(m.roughness ?? 1, 0.35), 0.75);
      if (/glow|light|engine/i.test(m.name) && m.emissive) {
        if (m.emissive.getHex() === 0) m.emissive.copy(m.color);
        m.emissiveIntensity = 3.2;
      } else if (m.emissiveMap) m.emissiveIntensity = 2.2;
    }
  });
}

// centred, nose to +z (a turn of `nose` about y), 1 long nose to tail (or 1
// at its biggest side: shipFit.js)
function normalise(root, nose = 0, kind = null) {
  const turn = new THREE.Group();
  turn.rotation.y = nose;
  turn.add(root);
  turn.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(turn, true);
  const size = box.getSize(new THREE.Vector3());
  const k = fitScale(kind, size);
  const holder = new THREE.Group();
  holder.add(turn);
  turn.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-1);
  holder.scale.setScalar(k);
  return { holder, size: size.multiplyScalar(k), fit: { nose, centre: turn.position.clone().negate(), k } };
}

// another model of the same thing (its LOD) put where `fit` put the first
function fitLike(root, { nose, centre, k }) {
  const turn = new THREE.Group();
  turn.rotation.y = nose;
  turn.position.copy(centre).negate();
  turn.add(root);
  const holder = new THREE.Group();
  holder.add(turn);
  holder.scale.setScalar(k);
  return holder;
}

// a copy in another paint (a slot's `tint`), darker or coloured
function tinted(root, color) {
  const c = new THREE.Color(color);
  const swapped = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const swap = (m) => {
      if (!swapped.has(m)) {
        const n = m.clone();
        if (n.color && n.toneMapped !== false && !/glow|light|engine/i.test(n.name)) n.color.multiply(c);
        swapped.set(m, n);
      }
      return swapped.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  return [...swapped.values()];
}

// a slice of the page's spare time (a timer where there's no such thing)
const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));
const unidle = (id) => (typeof requestIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id));

// (`load` is the page's one parse of a file, gltfCache.js; a test hands in its own)
export function createModels({ prepare = null, load: fetchModel = loadGLTF } = {}) {
  const loaded = new Map(); // kind → { holder, size, fit } (a loaded model, normalised)
  const lods = new Map(); // kind → the LOD's scene, in the shared material
  const lodReady = new Map(); // kind → its holder, fitted like the full model and warmed
  const lodLoading = new Set();
  const lodMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 });
  const loading = new Map(); // kind → Promise
  const built = new Map(); // kind → { model (buildGalaxyShip's), holder, size }
  const slots = [];
  const owned = []; // tinted materials, ours to free
  const queue = []; // kinds to build ahead (prebuild)
  let slice = 0; // the idle callback that builds the next
  let dead = false;

  const load = (kind) => {
    const def = MODELS[kind];
    if (!def || loading.has(kind)) return loading.get(kind);
    // (the parse is the page's, shared with the fleets and the planets' models: this
    // works on a copy of it, which tune and normalise change as they like)
    loadLod(kind);
    const p = fetchModel(def.url)
      .then((gltf) => (gltf && !dead ? cloneScene(gltf) : null))
      .then(async (root) => {
        if (!root) return;
        tune(root);
        const n = normalise(root, def.nose, kind);
        // (a skinned one's copies need bones of their own: SkeletonUtils)
        root.traverse((o) => o.isSkinnedMesh && (n.skinned = true));
        if (prepare) await prepare(n.holder);
        if (dead) return;
        loaded.set(kind, n);
        for (const s of slots) if (s.kind === kind && !s.real) fill(s);
        fitLod(kind);
      })
      .catch(() => {});
    loading.set(kind, p);
    return p;
  };

  // the kind's LOD: its normals worked out (the file has none) and the one
  // material for them all, then fitted once the full model's here too
  const loadLod = (kind) => {
    const url = lodUrl(kind);
    if (!url || lodLoading.has(kind)) return;
    lodLoading.add(kind);
    fetchModel(url)
      .then((gltf) => {
        if (!gltf || dead) return;
        const root = gltf.scene.clone(true); // (the geometry the cache's; the material swapped on this copy only)
        root.traverse((o) => {
          if (!o.isMesh) return;
          if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
          o.material = lodMaterial;
        });
        lods.set(kind, root);
        fitLod(kind);
      })
      .catch(() => {});
  };
  const fitLod = async (kind) => {
    const full = loaded.get(kind);
    const far = lods.get(kind);
    if (!full || !far || full.skinned || lodReady.has(kind)) return;
    const holder = fitLike(far, full.fit);
    lodReady.set(kind, null); // (being warmed)
    if (prepare) await prepare(holder);
    if (dead) return;
    lodReady.set(kind, holder);
    for (const s of slots) if (s.kind === kind && s.real && !s.lod && !s.tint) fill(s);
  };

  const template = (kind) => {
    if (built.has(kind)) return built.get(kind);
    if (!BUILT.has(kind)) return null;
    const model = buildGalaxyShip(kind);
    // (buildGalaxyShip makes it 1 long in z; fitted as the loaded ones are, so
    // a ship keeps its length when its model takes over)
    const s = model.size;
    const k = fitScale(kind, s);
    const holder = new THREE.Group();
    holder.add(model.group);
    holder.scale.setScalar(k);
    const t = { model, holder, size: s.clone().multiplyScalar(k) };
    built.set(kind, t);
    return t;
  };

  // the next of the kinds to build ahead, one to a slice of idle time (a ship is
  // its geometry and the canvases its lights and panels are drawn on: several
  // together in a frame would be a hitch)
  const buildNext = () => {
    slice = 0;
    if (dead) return;
    const kind = queue.shift();
    if (kind === undefined) return;
    try {
      template(kind);
    } catch {
      // (it's built when a slot wants it, and fails there if it's going to)
    }
    if (queue.length) slice = idle(buildNext);
  };

  // a slot's model: the loaded one's copy if it's here, else a copy of the
  // built stand-in (the kind's own built version, or STAND_IN's; else nothing yet)
  function fill(s) {
    const real = loaded.get(s.kind);
    const src = real ?? template(s.kind) ?? template(STAND_IN[s.kind]);
    if (!src) return;
    if (s.model) s.inner.remove(s.model);
    let copy = src.skinned ? cloneSkinned(src.holder) : src.holder.clone(true);
    if (s.tint) owned.push(...tinted(copy, s.tint));
    // (the loaded model near, its LOD farther, nothing past that)
    const far = real && !s.tint && !real.skinned ? lodReady.get(s.kind) : null;
    if (far) {
      const lod = new THREE.LOD();
      const [[near], [mid], [end]] = lodLevels(s.size);
      lod.addLevel(copy, near);
      lod.addLevel(far.clone(true), mid);
      lod.addLevel(new THREE.Object3D(), end);
      copy = lod;
    }
    s.model = copy;
    s.real = Boolean(real);
    s.lod = Boolean(far);
    s.ready = true;
    s.inner.add(copy);
    if (prepare && !real) {
      copy.visible = false;
      prepare(copy).then(() => (copy.visible = true));
    }
  }

  return {
    // a ship of `kind`, `size` long (a station `size` at its biggest side), in a holder to place
    slot(kind, size, { tint = null } = {}) {
      const holder = new THREE.Group();
      const inner = new THREE.Group();
      inner.scale.setScalar(size);
      holder.add(inner);
      const s = { kind, size, holder, inner, model: null, real: false, lod: false, ready: false, tint };
      slots.push(s);
      if (MODELS[kind]) load(kind);
      fill(s);
      return s;
    },
    // start loading these now (before a slot wants them)
    want(kinds) {
      for (const k of kinds) if (MODELS[k]) load(k);
    },
    // build these kinds' templates ahead, for the slots of a system about to be
    // built (they flew as the loaded model's stand-in, or are the built ship itself)
    prebuild(kinds) {
      if (dead) return;
      for (const k of kinds) {
        const kind = BUILT.has(k) ? k : STAND_IN[k];
        if (kind && BUILT.has(kind) && !built.has(kind) && !loaded.has(k) && !queue.includes(kind)) queue.push(kind);
      }
      if (queue.length && !slice) slice = idle(buildNext);
    },
    // how many templates are built (for the tests)
    get builtCount() {
      return built.size;
    },
    loaded: (kind) => loaded.has(kind),
    // let a slot go (its holder off the scene; the shared parts stay)
    drop(s) {
      s.holder.removeFromParent();
      const i = slots.indexOf(s);
      if (i >= 0) slots.splice(i, 1);
    },
    // the built ones' own motion (blinking lights, engine flicker): once per
    // kind, its copies share the materials
    update(t) {
      for (const b of built.values()) b.model.update(t);
    },
    dispose() {
      dead = true;
      if (slice) unidle(slice);
      slice = 0;
      queue.length = 0;
      for (const s of slots) s.holder.removeFromParent();
      slots.length = 0;
      for (const b of built.values()) {
        b.model.dispose();
        b.holder.traverse((o) => o.isMesh && o.geometry.dispose());
      }
      built.clear();
      // (a loaded model's geometry and textures are the page's cached ones, shared with
      // the fleets: freed with this scene, uploaded again if something draws them later)
      for (const l of loaded.values()) {
        l.holder.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
            m.dispose();
          }
        });
      }
      loaded.clear();
      for (const l of lods.values()) l.traverse((o) => o.isMesh && o.geometry.dispose());
      lods.clear();
      lodReady.clear();
      lodMaterial.dispose();
      for (const m of owned) m.dispose();
    },
  };
}
