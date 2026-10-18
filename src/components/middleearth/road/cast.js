// The Road’s walkers: Middle-earth’s Meshy cast (public/models/middleearth/
// cast/<name>.glb, each with its own idle, walk and run beside it) on the
// shared skeleton, through lib/three’s rig, animator and locomotion, with
// the house’s ink line round each (inkNodes). Loaded through the runtime’s
// asset cache under the Road’s name, so they go when the Road does.
// (Middle-earth’s cast3d.js does this for the towns, but its closure
// carries GLSL; this is the same recipe on the node renderer.)
//
//   loadCast(names, rt) → Promise<{ ready: Set<name> }>
//   walker(name, { height, seed }) → { group, ready, set({ base, speed }), tick(dt), dispose }
//     base: a looping clip in place of locomotion (sit.ground, tired, crawl…)
//     or null; speed: metres a second over the ground, the feet paced to it
//   heightOf(name) → metres, by kind (a hobbit, a man, an elf, a dwarf, a wizard)

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createAnimator } from '../../../lib/three/animator';
import { faceAhead, heading } from '../../../lib/three/clipLibrary';
import { inkHull } from '../../../lib/three/inkNodes';
import { moveFor } from '../castRules';

const DIR = '/models/middleearth/cast';
const LOCO = ['idle', 'walk', 'run'];
const LOOPS = new Set(['idle', 'walk', 'run', 'jog', 'walk.formal']);
const INK = 0.012; // m: the ink line’s width round a figure

export const HEIGHTS = { hobbit: 1.05, man: 1.8, elf: 1.85, dwarf: 1.35, wizard: 1.9 };
const KINDS = { frodo: 'hobbit', sam: 'hobbit', merry: 'hobbit', pippin: 'hobbit', bilbo: 'hobbit', gollum: 'hobbit', gimli: 'dwarf', legolas: 'elf', arwen: 'elf', elrond: 'elf', galadriel: 'elf', gandalf: 'wizard', gandalfwhite: 'wizard' };
export const heightOf = (name) => HEIGHTS[KINDS[name] ?? 'man'];

const templates = new Map(); // name → Promise<template | null>

function template(name, rt) {
  if (templates.has(name)) return templates.get(name);
  const urls = [`${DIR}/${name}.glb`, ...LOCO.map((c) => `${DIR}/${name}-${c}.glb`)];
  const p = Promise.all(urls.map((u) => Promise.resolve(rt.assets?.gltf?.(u)).catch(() => null)))
    .then(([g, ...clips]) => made(name, g, clips))
    .catch(() => null);
  templates.set(name, p);
  p.then((t) => !t && templates.get(name) === p && templates.delete(name));
  return p;
}

function made(name, g, files) {
  const scene = g?.scene;
  const hips = scene?.getObjectByName('Hips');
  if (!hips?.parent) return null;
  const own = {};
  LOCO.forEach((c, i) => {
    const a = files[i]?.animations?.[0];
    if (a) own[c] = a;
  });
  if (!own.idle && !own.walk) return null;
  scene.updateMatrixWorld(true);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  if (own.walk) faceAhead(own, up);
  const box = new THREE.Box3().setFromObject(scene);
  const ground = box.isEmpty() ? 0 : box.min.y;
  const crown = scene.getObjectByName('head_end') ?? scene.getObjectByName('Head');
  const top = (crown ? crown.getWorldPosition(new THREE.Vector3()).y : box.max.y) - ground;
  if (!(top > 0.1)) return null;
  return { name, scene, own, up, hipsY: hips.position.y, ahead: own.walk ? heading(own.walk, up) : null, top, ground };
}

export async function loadCast(names, rt) {
  const got = await Promise.all(names.map((n) => template(n, rt).then((t) => (t ? n : null))));
  return { ready: new Set(got.filter(Boolean)) };
}

export function walker(name, { height = heightOf(name), seed = 0, rt = null } = {}) {
  const group = new THREE.Group();
  group.name = `road:${name}`;
  let st = null;
  let want = { base: null, speed: 0 };
  let shownBase = null;
  let gone = false;
  const ready = (rt ? template(name, rt) : templates.get(name) ?? Promise.resolve(null)).then((tpl) => {
    if (!tpl || gone) return false;
    const model = cloneSkinned(tpl.scene);
    const materials = new Set();
    model.traverse((o) => {
      if (!o.isMesh) return;
      // (matte: Meshy’s colours carry their own shading)
      o.material = o.material.clone();
      if ('roughness' in o.material) o.material.roughness = 0.85;
      if ('metalness' in o.material) o.material.metalness = 0;
      materials.add(o.material);
      o.frustumCulled = false; // (a skinned mesh’s bounds don’t follow its pose)
      o.castShadow = true;
    });
    const k = height / Math.max(tpl.top, 1e-3);
    model.scale.setScalar(k);
    model.position.y = -tpl.ground * k;
    group.add(model);
    const ink = inkHull(model, INK / k);
    materials.add(ink);
    group.updateMatrixWorld(true);
    const anim = createAnimator(model, { clips: tpl.own, hipsY: tpl.hipsY, up: tpl.up, key: `road:${name}:${k.toFixed(2)}`, seed, unit: k });
    const strides = anim.loco?.strides ?? {};
    st = { model, anim, materials, walkV: strides.walk?.speed ?? 0.9 * k, runV: strides.run?.speed ?? 2.6 * k };
    anim.update(0);
    return true;
  });
  const frame = { forward: new THREE.Vector3(), up: new THREE.Vector3() };
  const q = new THREE.Quaternion();
  return {
    group,
    ready,
    set(next) {
      want = { ...want, ...next };
    },
    tick(dt) {
      if (!st) return;
      const base = want.base && !LOOPS.has(want.base) ? want.base : null;
      if (base !== shownBase) {
        shownBase = base;
        st.anim.base(base, { fade: 0.4 });
      }
      const speed = base ? 0 : want.speed;
      const motion = { move: moveFor(speed, st.walkV, st.runV), speed, side: 0, turn: 0, down: 0, air: 0 };
      st.anim.locomote(motion);
      st.anim.update(dt);
      group.getWorldQuaternion(q);
      frame.forward.set(0, 0, 1).applyQuaternion(q);
      frame.up.set(0, 1, 0).applyQuaternion(q);
      st.anim.after(dt, motion, frame);
    },
    dispose() {
      gone = true;
      if (!st) return;
      st.anim.dispose();
      for (const m of st.materials) m.dispose();
      group.removeFromParent();
      st = null;
    },
  };
}
