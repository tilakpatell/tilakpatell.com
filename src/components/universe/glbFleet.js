// The ships that are models rather than built: the game's X-wing in its light
// cut (Battlefront II (2017), lane V's import; lane S1 put it here over the
// gen3d one), the site owner's Meshy Slave I, and the Star Wars models they
// sent for the map: a TIE interceptor, a Star Destroyer and a Corellian
// corvette (the Tantive IV)
// (scripts/build-universe.py cuts them down for it); and the galaxy's
// Y-wing, A-wing and TIE bomber, each over a built one. Each is loaded the
// first time it's wanted, then copied, sharing its geometry and textures,
// for every ship of its kind; until it's come, the kind is built
// (trafficModels.js: the X-wing, the interceptor, the Star Destroyer and the
// corvette all have built stand-ins; Slave I has none and waits). Their
// engines and lights are turned up so they glow like the built ones.
// Traffic, hunters and the director's set pieces share one fleet.
//
// Its shaders are made before anything new is drawn (`prepare`, the
// scene's: compiled off the main thread, so a ship arriving doesn't stall a
// frame): a loaded model only takes over from its stand-in once they're
// ready, and each ship made keeps out of sight until they are (a frame or
// so, after the first of its kind).
//
// The built ones are made in code, which takes a moment: the scene builds
// one of each kind ahead, as it starts (for their shaders), and hands them
// over (`stock`), so the first of a kind to fly doesn't stall a frame being
// built.
//
// createFleet({ prepare(object) → Promise, build(kind) → model, glb, load }) → { want(kinds), loaded(kind), has(kind), make(kind) → model, stock(kind, model), stocked(kind) → how many, prepare (settable), dispose() }
// A model is { group, size (its box, 1 long in z as buildTraffic's are),
// fit (what to scale it by, times the size it flies at: 1 for a ship, whose
// size is its length, or what makes its biggest side 1 for a station, a ship
// that flies upright or a traveller who isn't a ship: shipFit.js), model
// (true for a copy of a loaded one), update(t), dispose() }, nose along +z.

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { gen3dUrl } from '../../lib/three/gen3d';
import { fitScale } from './shipFit';
import { buildTraffic } from './trafficModels';

// which way each one's nose points as it comes (turned to +z), and whether
// there's a built one to fly until it's here
export const GLB = {
  // (the game's T-65 in lane V's light cut, 7,000 triangles and 512 maps,
  // `_source`: catalog/bf2017-vehicles.js's xwing row: a fighter on this map
  // is a few pixels long, as its Y-wing and A-wing below are their far copies;
  // the galaxy flies the plain cut, galaxy/models.js)
  xwing: { url: '/models/galaxy/surface/xwing.lod1.glb', nose: 0, built: true },
  slave1: { url: '/models/universe/slave1.glb', nose: 0, built: false },
  interceptor: { url: gen3dUrl('tie-interceptor'), nose: 0, built: true }, // made here from the old one's render
  destroyer: { url: '/models/universe/star-destroyer.glb', nose: Math.PI, built: true },
  corvette: { url: '/models/universe/cr90.glb', nose: 0, built: true },
  // the galaxy's own, in their small cuts (public/models/galaxy/lod/: a
  // tenth of the size, and a fighter on this map is a few pixels long)
  ywing: { url: '/models/galaxy/lod/ywing.glb', nose: 0, built: true },
  awing: { url: '/models/galaxy/lod/awing.glb', nose: 0, built: true },
  tiebomber: { url: '/models/galaxy/lod/tiebomber.glb', nose: 0, built: true },
};

// (`build` makes a built one: the universe's own, unless another fleet's
// builder is given, as the galaxy gives its own, galaxy/fleet.js; `glb` is
// which are models, GLB's unless another fleet has more, as the galaxy's
// hunters are, galaxy/models.js; and `load` is the page's one parse of a
// file, gltfCache.js, unless a test hands in its own)
export function createFleet({ prepare = null, build = buildTraffic, glb = GLB, load = loadGLTF } = {}) {
  const templates = {};
  const stocked = {}; // kind → built ones made ahead, handed out first
  const loading = new Set();
  let dead = false;
  // (every model handed out says how it's fitted to its size, so whatever flies
  // it scales a ship by its length and the rest by their biggest side)
  const fitted = (kind, m) => {
    m.fit ??= fitScale(kind, m.size ?? { x: 1, y: 1, z: 1 });
    return m;
  };
  return {
    // start loading these (the ones that are models), if they aren't yet
    want(list) {
      for (const kind of list) {
        const def = glb[kind];
        if (!def || loading.has(kind)) continue;
        loading.add(kind);
        // (the parse is the page's, shared with the galaxy's own models and the planets'
        // models; the roughness clamp and the rest are done on this fleet's copy of it)
        load(def.url)
          .then((gltf) => {
            if (dead || !gltf) return;
            const root = cloneScene(gltf);
            // centred, nose to +z, 1 long nose to tail (or 1 at its biggest
            // side, for the kinds shipFit.js fits that way)
            const turn = new THREE.Group();
            turn.rotation.y = def.nose;
            turn.add(root);
            const box = new THREE.Box3().setFromObject(turn, true); // (precise: the vertices, as galaxy/models.js normalise measures)
            root.position.sub(box.getCenter(new THREE.Vector3()).applyAxisAngle(new THREE.Vector3(0, 1, 0), -def.nose));
            const holder = new THREE.Group();
            holder.add(turn);
            const size = box.getSize(new THREE.Vector3());
            const k = fitScale(kind, size);
            holder.scale.setScalar(k);
            root.traverse((o) => {
              if (!o.isMesh || !o.material) return;
              const m = o.material;
              if ('roughness' in m) m.roughness = Math.min(m.roughness ?? 1, 0.7);
              // engines and lights: hot enough to bloom
              if (/glow|light|engine/i.test(m.name) && m.emissive) {
                if (m.emissive.getHex() === 0) m.emissive.copy(m.color);
                m.emissiveIntensity = 3.2;
              } else if (m.emissiveMap) m.emissiveIntensity = 2.4;
            });
            const ready = () => {
              if (dead) return;
              templates[kind] = { holder, size: size.multiplyScalar(k) };
              // (the model's here: built stand-ins made ahead won't be wanted)
              for (const m of stocked[kind]?.splice(0) ?? []) m.dispose();
            };
            return prepare ? prepare(holder).then(ready) : ready();
          })
          .catch(() => {});
      }
    },
    // its model is here
    loaded: (kind) => Boolean(templates[kind]),
    // it can fly now (it's here, or it has a built stand-in, or it was never a model)
    has: (kind) => !glb[kind] || Boolean(templates[kind]) || glb[kind].built,
    make(kind) {
      const t = templates[kind];
      let made;
      if (t) {
        const group = new THREE.Group();
        group.add(t.holder.clone());
        made = { group, size: t.size.clone(), model: true, update() {}, dispose() {} }; // shares its template's geometry and textures
      } else if (stocked[kind]?.length) return fitted(kind, stocked[kind].pop()); // (made ahead, its shaders with it)
      else made = build(kind);
      // out of sight until its shaders are made
      const inner = made.group.children[0];
      if (prepare && inner) {
        inner.visible = false;
        prepare(made.group).then(() => {
          inner.visible = true;
        });
      }
      return fitted(kind, made);
    },
    // a built one made ahead, its shaders made too: the next make(kind) has it
    stock(kind, model) {
      if (dead || templates[kind]) model.dispose();
      else (stocked[kind] ??= []).push(model);
    },
    stocked: (kind) => stocked[kind]?.length ?? 0,
    // what makes a model's shaders (it can be set after the fleet is, before
    // any model is made)
    set prepare(fn) {
      prepare = fn;
    },
    dispose() {
      dead = true;
      for (const list of Object.values(stocked)) for (const m of list.splice(0)) m.dispose();
      // the models' own geometry and textures (the copies only shared them; the
      // page's cached parse does too, so what else draws them uploads them again)
      for (const t of Object.values(templates)) {
        t.holder.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          for (const value of Object.values(o.material)) if (value?.isTexture) value.dispose();
          o.material.dispose();
        });
      }
    },
  };
}
