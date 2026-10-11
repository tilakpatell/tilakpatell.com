// The ships you can fly round the universe map: Luke's X-wing and the
// Millennium Falcon, modelled in code down to their panel lines (hulls.js);
// Walt and Jesse's RV with its home-made wings, the site owner's Meshy model
// of it once it loads (until then, or without it, a camper built from simple
// shapes with a wing each side and a jet under each); and Rick's space
// cruiser, the classic saucer from the C-137 page with Rick at the wheel and
// Morty beside him (rickmorty/cruiser3d.js), once it loads.
// Each part of one colour is merged into one mesh, so a ship is a handful of
// draws.
//
// Any of them can wear a paint job (paint.js, put on by livery.js): its
// hull and markings recoloured, its engines' glow too; and carry the parts
// fitted in the hangar (outfit.js), bolted on by modules.js.
//
// buildShip(kind, textures, { build }) → { group, setThrottle(0…1),
//   paint(paint), rim({ colour, dir, key }), outfit(loadout) → modules, modules, engines, drive(dt,
//   motion), dress(model, { clone }), mount(model, extra), update(t),
//   dispose() }
// With a build (shipyard/build.js), the ship is that garage build, put
// together from its modules (shipyard/modules3d.js), whatever crew flies it:
// no model is mounted over it, and its engines are its own.
// Every ship points along −z, centred, about LENGTH long (they're built at
// BUILT long and scaled down as a whole).
//
// The ships are built here with their livery handed in,
// buildShipWith(createLivery, kind, textures, { build }): ./shipModels.js
// builds them in livery.js's GLSL, ./shipModelsNodes.js in liveryNodes.js's
// nodes, for a world on the node renderer.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { seg as segments } from '../../lib/detail';
import { SHIP_PROFILE, tune } from '../../lib/three/gltf';
import { sharpenMaterial } from '../../lib/three/textures';
import { tiled } from './kit';
import { buildModules } from './modules';
import { FALCON_ENGINES, XWING_ENGINES, buildFalcon, buildXwing, panelMaps } from './hulls';
import { assemble } from './shipyard/modules3d';
import { LENGTH } from './scale';

// (small against the planets, and much smaller than the stations: scale.js)
export { LENGTH };
export const BUILT = 0.36; // the length the ships below are built at
// the line round Rick and Morty in the cruiser (rickmorty/cruiser3d.js's
// crewInk, in the saucer's units): drawn as big as the map draws them, the
// C-137 page's would be wider than their fingers and Rick's spikes of hair
export const CREW_INK = 0.012;

// Geometries placed by [position, rotation, scale], merged into one.
function parts(list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const geos = list.map(([geo, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]]) => {
    m.compose(new THREE.Vector3(...pos), q.setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    geo.dispose();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    return g.applyMatrix4(m);
  });
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  return merged;
}

const lambert = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1, ...extra });
// a hull of real plates (or plain, if the textures didn't come)
const plated = (T, color, which, repeat, extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    map: which === 'hull' ? tiled(T.hull, repeat, repeat) : null,
    normalMap: tiled(T[`${which}-normal`], repeat, repeat),
    roughnessMap: tiled(T[`${which}-rough`], repeat, repeat),
    roughness: 1,
    metalness: 0.2,
    ...extra,
  });
const glowMat = (color) => new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide });

// along z: CylinderGeometry stands on y, so lay it down with its top forward
const tube = (rTop, rBottom, len, seg = 12) => new THREE.CylinderGeometry(rTop, rBottom, len, segments(seg)); // (lib/detail: rounder at ultra)
const LAY = [-Math.PI / 2, 0, 0];

// Until the C-137 page's cruiser arrives: a little saucer car with a glass
// dome, the same size.
function cruiser(T) {
  const group = new THREE.Group();
  const stand = new THREE.Group();
  const body = new THREE.Mesh(
    parts([
      [new THREE.SphereGeometry(0.1, segments(20), segments(12)), [0, 0, 0], [0, 0, 0], [1, 0.38, 1.6]],
      [new THREE.BoxGeometry(0.03, 0.05, 0.06), [-0.08, 0.015, 0.1], [0, 0, 0.4]],
      [new THREE.BoxGeometry(0.03, 0.05, 0.06), [0.08, 0.015, 0.1], [0, 0, -0.4]],
    ]),
    plated(T, '#b4bfc3', 'plates', 1),
  );
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.055, segments(16), segments(10), 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.6 }));
  dome.position.set(0, 0.025, -0.02);
  stand.add(body, dome);
  const glowM = glowMat('#9df06b');
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.03, segments(16)), glowM);
  glow.position.set(0, 0, 0.162);
  group.add(stand, glow);
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#9df06b') }], stand, glowMesh: glow, nose: Math.PI }; // its model's nose (the headlights) is +z
}

// where the RV model's jets end (either side, low, a little ahead of the
// middle), measured from the model in the frame it's built in
const POD = [0.098, -0.0505, -0.029];

// Walt and Jesse's RV, until its model comes: a boxy camper (the cab under
// the cab-over, a dark band of windows, the brown stripe, the wheels) with
// a straight wing bolted on each side at floor height and a jet hanging
// under each. Built to the model's own proportions (it's the wingspan that's
// BUILT across), so the jets' glow sits where the model's exhausts are too
// and stays put when the model comes.
function rv() {
  const group = new THREE.Group();
  const stand = new THREE.Group();
  const pods = [];
  const wingStripes = [];
  const wheels = [];
  const glows = [];
  for (const sx of [-1, 1]) {
    pods.push([tube(0.0105, 0.0085, 0.05), [sx * POD[0], POD[1] - 0.0025, -0.055], LAY]); // the intake forward
    pods.push([new THREE.BoxGeometry(0.004, 0.012, 0.02), [sx * POD[0], -0.041, -0.055]]); // the pylon
    wingStripes.push([new THREE.BoxGeometry(0.014, 0.008, 0.0535), [sx * 0.14, -0.038, -0.05]]);
    for (const z of [-0.085, 0.062]) wheels.push([tube(0.015, 0.015, 0.014, 12), [sx * 0.048, -0.055, z], [0, 0, Math.PI / 2]]);
    glows.push([new THREE.CircleGeometry(0.0095, segments(14)), [sx * POD[0], POD[1], POD[2]]]);
  }
  const body = new THREE.Mesh(
    parts([
      [new THREE.BoxGeometry(0.11, 0.115, 0.19), [0, 0.008, 0.025]], // the living box
      [new THREE.BoxGeometry(0.106, 0.04, 0.034), [0, 0.042, -0.084]], // the cab-over
      [new THREE.BoxGeometry(0.104, 0.072, 0.052), [0, -0.014, -0.094]], // the cab
      [new THREE.BoxGeometry(0.36, 0.007, 0.052), [0, -0.038, -0.05]], // the wings, one plank right across
    ]),
    lambert('#ebe2cc'),
  );
  const brown = new THREE.Mesh(parts([[new THREE.BoxGeometry(0.1126, 0.009, 0.1926), [0, 0, 0.025]], [new THREE.BoxGeometry(0.1066, 0.009, 0.052), [0, 0, -0.094]], ...wingStripes]), lambert('#8a5a34'));
  const dark = new THREE.Mesh(
    parts([
      [new THREE.BoxGeometry(0.1124, 0.02, 0.15), [0, 0.034, 0.035]], // the side windows
      [new THREE.BoxGeometry(0.1064, 0.022, 0.03), [0, 0.005, -0.1]], // the cab's
      [new THREE.BoxGeometry(0.09, 0.024, 0.004), [0, 0.005, -0.12]], // the windscreen
      [new THREE.BoxGeometry(0.044, 0.02, 0.004), [0, 0.034, 0.12]], // the back window
      [new THREE.BoxGeometry(0.112, 0.01, 0.006), [0, -0.047, 0.12]], // the bumper
      ...wheels,
    ]),
    lambert('#2b2d33'),
  );
  const grey = new THREE.Mesh(parts([...pods, [new THREE.BoxGeometry(0.04, 0.012, 0.04), [0, 0.07, 0.04]]]), lambert('#8d9097', { metalness: 0.3 }));
  stand.add(body, brown, dark, grey);
  const glowM = glowMat('#ffa04a');
  group.add(stand, new THREE.Mesh(parts(glows), glowM));
  return { group, glow: [{ mat: glowM, color: new THREE.Color('#ffa04a') }], stand, nose: -Math.PI / 2 }; // its model's cab is −x
}

// Where each ship's engines are, inside its pivot (in BUILT units, nose −z):
// the plumes leave from here (trail.js). The cruiser's are its exhaust cans,
// read off its model once it's mounted (see scene.js); these stand in.
export const ENGINES = {
  xwing: XWING_ENGINES,
  falcon: FALCON_ENGINES,
  cruiser: [
    [-0.115, 0, 0.17],
    [0.115, 0, 0.17],
  ],
  // the RV's two jets, one under each wing
  rv: [
    [-POD[0], POD[1], POD[2]],
    [POD[0], POD[1], POD[2]],
  ],
};

const BUILD = { xwing: buildXwing, falcon: buildFalcon, cruiser, rv };

// How a paint job sits on each ship (livery.js), read off its texture: a
// plain panel's luminance, the saturation its markings stand out by (the
// X-wing's stripes, the cruiser's lights, the Falcon's old red panels), or
// the darkness (the Falcon's darker plates and machinery, the RV's brown
// stripe and trim), and below what it's glass or a vent and left alone.
// FIT is for each ship's model; HULL_FIT for the X-wing and the Falcon built
// in code (hulls.js), which stand in while their models load; `built` for
// the RV's and the cruiser's stand-ins (and the parts bolted on: modules.js).
const FIT = {
  built: { mid: 0.4, marks: [0.5, 0.7], keep: 0.04 },
  build: { mid: 0.5, marks: [0.45, 0.65], keep: 0.03 }, // (a garage build: shipyard/modules3d.js's panel skin)
  xwing: { mid: 0.36, marks: [0.62, 0.76], keep: 0.04 },
  falcon: { mid: 0.12, marks: [0.6, 0.7], dark: [0.03, 0.05, 0.35], keep: 0.015 },
  rv: { mid: 0.32, marks: [0.58, 0.7], dark: [0.06, 0.1, 0.7], keep: 0.03 },
  cruiser: { mid: 0.28, marks: [0.5, 0.7], keep: 0.05 },
};
const HULL_FIT = {
  xwing: { mid: 0.58, marks: [0.45, 0.65], keep: 0.03 },
  falcon: { mid: 0.55, marks: [0.45, 0.65], dark: [0.14, 0.22, 1], keep: 0.03 },
};
// which way each model's nose points, as a turn about y that brings it to −z
const NOSE = { xwing: Math.PI, falcon: Math.PI };
// the materials a model's hull is made of, which take a paint job (its
// cockpit, glass, lights and engines' glow are left as they come)
const PAINTABLE = { xwing: /^xwing(Fuselage|Engines|Nurnies|Nose)$/, falcon: /^Tex_0095_[12]\.dds$/ };
// a model's own engine glow, which takes over from the stand-in's (its
// emissive maps too, as the Falcon's sublight band is): lit with the throttle
const LIGHTS = { xwing: /EngineGlow/ };
// where a model sits once it's centred (BUILT units): the Falcon's saucer
// on the stand-in's, so the parts and the exhaust are where they should be
const SHIFT = { falcon: [0, 0, -0.047] };
// how its paint takes the light: these come glossier than painted metal
// should, from their own maps, so those go, for the paint of the ship
// profile (lib/three/gltf: a satin at its roughest, a tenth metallic; the
// Falcon's was clay at roughness 1)
const PAINT = { metalness: SHIP_PROFILE.metalness.paint, roughness: SHIP_PROFILE.roughness[1] };
const FINISH = { xwing: { metalnessMap: null, roughnessMap: null, ...PAINT }, falcon: PAINT };
// a model's hull in its finish (before its shaders are made: a map gone is a different shader)
const finish = (kind, model) =>
  FINISH[kind] &&
  model.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (PAINTABLE[kind]?.test(m.name) && !m.userData.finished) Object.assign(m, FINISH[kind], { needsUpdate: true }).userData.finished = true;
  });

// the models that take over from the built ships, when they load (the
// cruiser is built by the C-137 page's own code instead; see scene.js): the
// X-wing and the Falcon are others' (Sketchfab, CC BY: scripts/sketchfab-batch.mjs,
// credited in data/modelCredits.json), and their stand-ins are built whole (hulls.js)
export const SHIP_MODELS = { xwing: '/models/sketchfab/xwing-hd.glb', falcon: '/models/sketchfab/falcon-hd.glb', rv: '/models/universe/rv-wings.glb' };

// the garage builds' panel skin (made once, in the browser)
const buildMaps = () => (typeof document === 'undefined' ? null : panelMaps('build', { base: '#c4c8ce', seed: 11, cols: 5, rows: 9, grime: 0.18 }));

export function buildShipWith(createLivery, kind, T = {}, { build = null } = {}) {
  const ship = build ? assemble(build, { maps: buildMaps() }) : (BUILD[kind] ?? cruiser)(T);
  const engines = build ? ship.engines : (ENGINES[kind] ?? []);
  const pivot = new THREE.Group(); // banks and bobs inside the group the scene moves
  pivot.scale.setScalar(LENGTH / BUILT);
  pivot.add(ship.group);
  const group = new THREE.Group();
  group.add(pivot);
  let mounted = null;
  let ownGlow = false;
  const livery = createLivery();
  livery.apply(ship.group, build ? FIT.build : (HULL_FIT[kind] ?? FIT.built));
  for (const g of ship.glow) g.own = g.color.clone();
  let throttle = 0;
  let coat = null; // the paint it wears
  let modules = null; // the parts bolted on
  let fitted = null; // and the loadout they're from
  let lights = []; // the model's own engine glow, once it's mounted
  let parked = false;
  const glow = () => {
    const k = parked ? 0.15 : 0.5 + 2.8 * throttle; // (past 1 at speed, so it blooms)
    for (const g of ship.glow) g.mat.color.copy(g.color).multiplyScalar(k);
    for (const m of lights) {
      m.emissive.set(coat?.glow ?? (m.emissiveMap ? '#ffffff' : ship.glow[0]?.own ?? '#ffffff'));
      m.emissiveIntensity = m.emissiveMap ? k * 0.9 : k;
    }
  };
  return {
    update(t) {
      mounted?.update?.(t);
      ship.update?.(t);
    },
    dispose() {
      mounted?.dispose?.();
      ship.dispose?.();
      modules?.dispose();
      livery.dispose();
    },
    build, // (the garage build it is, or null)
    // the wardrobe's looks on a crew its model seats (the cruiser's Rick and Morty)
    setLooks(looks) {
      mounted?.setLooks?.(looks);
    },
    engines, // (where its exhaust leaves, in BUILT units)
    group,
    pivot,
    setThrottle(k) {
      throttle = k;
      glow();
    },
    // the parts fitted (outfit.js's loadout): the old ones off, these on, in
    // the ship's paint
    outfit(loadout) {
      // (the parts just fitted swing into place; a ship's first fit is just there)
      const fresh = fitted ? Object.keys(loadout).filter((slot) => loadout[slot] !== fitted[slot]) : [];
      fitted = { ...loadout };
      if (modules) {
        modules.group.removeFromParent();
        modules.dispose();
      }
      modules = buildModules(kind, loadout, engines, { fresh, mounts: ship.mounts ?? null });
      livery.apply(modules.group, FIT.built);
      ship.group.add(modules.group);
      return modules;
    },
    get modules() {
      return modules;
    },
    // the parts' lights and vanes, as it flies: { throttle, boost, turn, climb }
    drive(dt, motion) {
      modules?.update(dt, motion);
    },
    // the light on its edges from the stars that aren't its key (livery.js), each frame
    rim(light) {
      livery.rim(light);
    },
    // a paint job (paint.js), or the factory's
    paint(p) {
      coat = p?.hull ? p : null;
      livery.set(coat);
      for (const g of ship.glow) g.color.set(coat?.glow ?? g.own);
      mounted?.tint?.(coat?.glow ?? null);
      glow();
    },
    // the ship's model, taught the paint before it's mounted (and before its
    // shaders are made, so mounting it doesn't stall); `clone` when its
    // materials are shared with others
    dress(model, { clone = false } = {}) {
      if (!model) return model;
      livery.apply(model, FIT[kind] ?? FIT.built, { clone, only: PAINTABLE[kind] });
      finish(kind, model);
      return model;
    },
    // parked on a planet (true): the engines' glow goes out
    park(on) {
      parked = on;
      if (ship.glowMesh) ship.glowMesh.visible = !on && !ownGlow;
      glow();
    },
    // the ship's model, when it comes: sized to the stand-in, which goes.
    // `extra` is what a built model brings: update(t) each frame, dispose(),
    // whether it has its own engine glow and tint(color) for it
    mount(model, extra = {}) {
      if (!ship.stand || !model || build) return false; // (a garage build is its own model)
      mounted = extra;
      livery.apply(model, FIT[kind] ?? FIT.built, { only: PAINTABLE[kind] }); // (if it wasn't dressed already)
      finish(kind, model);
      if (coat) extra.tint?.(coat.glow);
      const box = new THREE.Box3().setFromObject(model);
      const dims = box.getSize(new THREE.Vector3());
      model.position.sub(box.getCenter(new THREE.Vector3()));
      const holder = new THREE.Group();
      holder.add(model);
      holder.scale.setScalar(BUILT / Math.max(dims.x, dims.z, 1e-6));
      holder.rotation.y = NOSE[kind] ?? ship.nose ?? 0; // turned so its nose points along −z
      // paint over metal (lib/three/gltf's SHIP_PROFILE: the paint a satin a
      // tenth metallic, the parts named as metal 0.65), the space round it
      // in the hull, its maps sharp at a grazing angle (the chase camera's)
      model.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m.userData.finished) tune(m, SHIP_PROFILE); // (unless it has its own finish)
          else if ('envMapIntensity' in m) m.envMapIntensity = SHIP_PROFILE.envMapIntensity;
          sharpenMaterial(m);
          if (m.emissive && (m.emissiveMap || LIGHTS[kind]?.test(m.name)) && !lights.includes(m)) lights.push(m);
        }
      });
      if (SHIFT[kind]) holder.position.set(...SHIFT[kind]);
      if (lights.length) extra = { ...extra, ownGlow: true };
      ship.stand.visible = false;
      ship.group.add(holder);
      ownGlow = Boolean(extra.ownGlow);
      if (extra.ownGlow && ship.glowMesh) ship.glowMesh.visible = false;
      // the engines' glow at its tail, where the ship has one of its own
      // (its length runs along x if it was turned a quarter)
      if (ship.glowMesh && !ship.glowFixed) {
        const along = Math.abs(Math.sin(holder.rotation.y)) > 0.5 ? dims.x : dims.z;
        ship.glowMesh.position.z = (along / Math.max(dims.x, dims.z)) * (BUILT / 2) + 0.004;
        if (ship.glowOnModel) ship.glowMesh.scale.set(...ship.glowOnModel, 1);
      }
      glow();
      return true;
    },
  };
}
