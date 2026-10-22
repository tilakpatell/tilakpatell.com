// A dementor (the design’s §4.8 and §4.10): the model made for the world
// (public/models/hogwarts/creatures/dementor.glb, scripts/hogwarts-creatures-meshy.mjs:
// a hooded cloak 2.9 m tall with nothing in the hood, grey hands out of the
// sleeves, its hem in rags), moved on the node renderer. It has no skeleton
// and needs none: a dementor drifts, so the mesh is moved where it stands.
// The rags at the hem stir by height (more the lower they hang, each in its
// own phase round the cloak), the whole of it drifts a little behind its
// hood as it goes, it leans in toward you as its hands reach, and it fades
// in from the water and out again. Until the model is in, the stand-in
// (./dementorStandIn.js) is drawn in its place; it goes as the model comes.
// In the house look (house.material, house.adopt), so the cold’s grey shade
// falls on it as on everything else.
//
//   createDementorFigure({ house, rt, tier, url }) → { group, ready, set({ t, fade, reach }), dispose() }
//     t: seconds (the rags’ stir); fade: 0…1 (gone … there); reach: 0…1 (leaning in, the hands out toward you)
//     ready: a promise of whether the model came (false: the stand-in stays)
//   DEMENTOR_URL, HEIGHT, RAGS, LEAN
//   stir(k) → 0…1, how much a point k of the way up (0 the hem, 1 the hood’s peak) stirs
//   leanOf(k) → 0…1, how much a point k of the way up leans in when it reaches

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { atan, clamp, float, positionLocal, sin, uniform, vec3 } from 'three/tsl';
import { createDementorFigure as createStandIn } from './dementorStandIn';

export const DEMENTOR_URL = '/models/hogwarts/creatures/dementor.glb';
export const HEIGHT = 2.9; // m, as the cut stands it (the hood’s peak; its base at 0)
export const RAGS = 0.42; // the lower share of its height that stirs: the skirts and their rags
export const LEAN = { from: 0.45, by: 0.1 }; // above this share it leans in; the hood comes this share of its height forward

const clamp01 = (v) => Math.max(0, Math.min(1, v));
// (the same sums as the node graph below: a test reads these)
export const stir = (k) => clamp01(1 - k / RAGS) ** 2;
export const leanOf = (k) => clamp01((k - LEAN.from) / (1 - LEAN.from)) ** 2;

// the node material: the model’s own colour map, in the look, the rags and the lean in its position
function materialFor(source, { house, span, lo, uT, uFade, uReach, seed }) {
  const opts = { map: source.map ?? null, color: source.color?.clone?.() ?? new THREE.Color(1, 1, 1), transparent: true, side: THREE.DoubleSide };
  const m = house?.material ? house.material(opts) : new MeshLambertNodeMaterial(opts);
  const p = positionLocal;
  const k = clamp(p.y.sub(lo).div(span), 0, 1);
  // the rags: the skirt flared and drawn in by a slow wave round the cloak, more the lower
  const low = clamp(float(1).sub(k.div(RAGS)), 0, 1);
  const w = low.mul(low);
  const round = atan(p.z, p.x);
  const wave = sin(uT.mul(1.7).add(round.mul(3)).add(seed)).mul(0.16).add(sin(uT.mul(2.9).sub(round.mul(5)).add(seed * 2)).mul(0.08));
  const flare = float(1).add(w.mul(wave));
  // the drift: the hem a little behind the hood as it goes, swinging slowly
  const drift = sin(uT.mul(0.9).add(p.y.div(span).mul(4)).add(seed)).mul(span * 0.018).mul(w);
  // the lean: the upper body in toward you as the hands reach
  const up = clamp(k.sub(LEAN.from).div(1 - LEAN.from), 0, 1);
  const lean = uReach.mul(up.mul(up)).mul(span * LEAN.by);
  m.positionNode = vec3(p.x.mul(flare).add(drift), p.y.sub(lean.mul(0.25)), p.z.mul(flare).add(lean));
  m.opacityNode = uFade;
  // (dark cloth: no sheen, and it writes its depth so its own folds sort among themselves)
  m.depthWrite = true;
  return m;
}

// the model, through the runtime’s asset cache (shared with any other dementor), else the site’s loader
const loadModel = (rt, url) => (rt?.assets?.gltf ? Promise.resolve(rt.assets.gltf(url)) : import('../../../../lib/three/gltf.js').then((g) => g.loadGltf(url)));

let made = 0;

export function createDementorFigure({ house = null, rt = null, tier = 'high', url = DEMENTOR_URL } = {}) {
  const group = new THREE.Group();
  group.name = 'dementor';
  const stand = createStandIn({ house });
  group.add(stand.group);
  const uT = uniform(0);
  const uFade = uniform(1);
  const uReach = uniform(0);
  // (each its own phase, so three over the water never stir as one)
  const seed = (made++ * 2.39996) % (Math.PI * 2);
  let model = null;
  let gone = false;
  const materials = [];
  const last = { t: 0, fade: 1, reach: 0 };

  const ready = loadModel(rt, url)
    .then((gltf) => {
      const scene = gltf?.scene;
      if (gone || !scene) return false;
      const copy = scene.clone(true);
      copy.updateMatrixWorld(true);
      copy.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const lo = g.boundingBox.min.y;
        const span = Math.max(1e-3, g.boundingBox.max.y - lo);
        const m = materialFor(o.material, { house, span, lo, uT, uFade, uReach, seed });
        o.material = m;
        materials.push(m);
        // (its hem moves past its bounds, and it’s never so big that culling it saves anything)
        o.frustumCulled = false;
        o.castShadow = tier !== 'low';
      });
      // (the cut stands it 2.9 m tall on its base; a model of another height is put to it)
      const box = new THREE.Box3().setFromObject(copy);
      const tall = box.max.y - box.min.y;
      if (tall > 0.1) {
        copy.scale.multiplyScalar(HEIGHT / tall);
        copy.position.y -= box.min.y * (HEIGHT / tall);
      }
      model = copy;
      group.add(model);
      house?.adopt?.(model);
      stand.group.visible = false;
      stand.dispose();
      return true;
    })
    .catch(() => false);

  return {
    group,
    ready,
    set({ t = last.t, fade = last.fade, reach = last.reach } = {}) {
      last.t = t;
      last.fade = fade;
      last.reach = reach;
      group.visible = fade > 0.01;
      if (!model) {
        stand.set({ t, fade, reach });
        return;
      }
      uT.value = t;
      uFade.value = clamp01(fade);
      uReach.value = clamp01(reach);
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      if (!model) stand.dispose();
      // (the geometry and the map are the cache’s, shared: only what this made is let go)
      for (const m of materials) m.dispose();
      materials.length = 0;
    },
  };
}
