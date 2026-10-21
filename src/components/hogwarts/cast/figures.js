// The castle’s people as figures on the site’s shared skeleton (the
// design’s §4.10): loaded through the runtime’s asset cache, walked and sat
// and made to cheer on the library’s clips (lib/three/animator.js,
// clipLibrary.js), the house’s ink line round each above low. Lane B makes
// the cast (public/models/hogwarts/cast/<name>.glb, listed in cast.json);
// until a name is in that list it is stood in by one of Middle-earth’s cast,
// one line a name below, so the swap is a line deleted, never a figure
// drawn in code.
//
//   STAND_IN: { name: middle-earth figure }    HEIGHTS: { name: metres }
//   manifest(rt) → Promise<{ name: { file, height? } }>  (Lane B’s cast.json, or {})
//   heightOf(name) → metres
//   loadFigure(name, rt) → Promise<template | null>
//   figure(name, { rt, height, seed, ink, material }) → { group, ready, set({ base, speed }),
//     play(clip, opts), look(target), tick(dt), dispose() }
//     base: a looping state in place of locomotion ('sit.idle', 'lantern', 'cast.idle'…) or null;
//     speed: metres a second over the ground; material(m) → a material in place of each of its own (the ghosts)
//   forgetFigures(): the templates let go, as the world goes

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createAnimator } from '../../../lib/three/animator';
import { faceAhead, forFigure, heading } from '../../../lib/three/clipLibrary';
import { inkHull } from '../../../lib/three/inkNodes';

const OWN = '/models/hogwarts/cast';
const ME = '/models/middleearth/cast';
const LOCO = ['idle', 'walk', 'run'];
const INK = 0.012;

// TODO(hogwarts cast): each line goes once Lane B’s figure of that name is in cast.json
export const STAND_IN = {
  harry: 'frodo',
  ron: 'pippin',
  hermione: 'rosie',
  neville: 'sam',
  malfoy: 'merry',
  student: 'hobbit',
  student2: 'sam',
  student3: 'merry',
  student4: 'rosie',
  firstyear: 'frodo',
  dumbledore: 'gandalfwhite',
  mcgonagall: 'galadriel',
  snape: 'aragorn',
  hagrid: 'gimli',
  flitwick: 'bilbo',
  sprout: 'rosie',
  hooch: 'eowyn',
  pince: 'arwen',
  filch: 'butterbur',
  nick: 'theoden',
  friar: 'butterbur',
  greylady: 'galadriel',
  baron: 'boromir',
  peeves: 'pippin',
  elf: 'goblin',
};

// how tall each stands (the films’ as the site reads them; the students at an eleven-year-old’s)
export const HEIGHTS = { hagrid: 2.6, flitwick: 0.95, elf: 0.9, firstyear: 1.38, student: 1.5, harry: 1.42, ron: 1.5, hermione: 1.4, neville: 1.42, malfoy: 1.45, peeves: 1.2, dumbledore: 1.88, snape: 1.86, mcgonagall: 1.74 };
export const heightOf = (name) => HEIGHTS[name] ?? (/^student/.test(name) ? 1.5 : 1.78);

// the bodies a crowd of students is made of (Lane B’s house students, once made)
export const CROWD = ['student', 'student2', 'student3', 'student4'];

let listed = null;
export function manifest(rt) {
  if (!listed)
    listed = Promise.resolve(typeof fetch === 'function' ? fetch(`${OWN}/cast.json`) : null)
      .then((r) => (r?.ok ? r.json() : {}))
      .then((j) => {
        // (a list of { name, file } or a map of name → entry: whichever Lane B writes)
        const list = Array.isArray(j) ? j : Array.isArray(j?.figures) ? j.figures : null;
        if (list) return Object.fromEntries(list.filter((e) => e?.name).map((e) => [e.name, e]));
        return j && typeof j === 'object' ? j : {};
      })
      .catch(() => ({}));
  void rt;
  return listed;
}

const templates = new Map();

export function loadFigure(name, rt) {
  if (templates.has(name)) return templates.get(name);
  const p = manifest(rt)
    .then((list) => {
      const own = list[name];
      if (own) return { model: `${OWN}/${own.file ?? `${name}.glb`}`, clips: [] };
      const me = STAND_IN[name] ?? 'hobbit';
      return { model: `${ME}/${me}.glb`, clips: LOCO.map((c) => `${ME}/${me}-${c}.glb`) };
    })
    .then(({ model, clips }) => Promise.all([model, ...clips].map((u) => Promise.resolve(rt?.assets?.gltf?.(u)).catch(() => null))))
    .then(([g, ...files]) => made(name, g, files))
    .catch(() => null);
  templates.set(name, p);
  p.then((t) => !t && templates.get(name) === p && templates.delete(name));
  return p;
}

async function made(name, g, files) {
  const scene = g?.scene;
  const hips = scene?.getObjectByName('Hips');
  if (!hips?.parent) return null;
  scene.updateMatrixWorld(true);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  const own = {};
  LOCO.forEach((c, i) => {
    const a = files[i]?.animations?.[0];
    if (a) own[c] = a;
  });
  // (a figure of the shared rig without its own walk takes the library’s, fitted to its hips)
  if (!own.idle || !own.walk) {
    const key = `hogwarts:${name}`;
    const got = await Promise.all(LOCO.map((c) => forFigure(c, { hipsY: hips.position.y, up, key }).catch(() => null)));
    LOCO.forEach((c, i) => {
      if (!own[c] && got[i]) own[c] = got[i];
    });
  }
  if (!own.idle && !own.walk) return null;
  if (own.walk) faceAhead(own, up);
  const box = new THREE.Box3().setFromObject(scene);
  const ground = box.isEmpty() ? 0 : box.min.y;
  const crown = scene.getObjectByName('head_end') ?? scene.getObjectByName('Head');
  const top = (crown ? crown.getWorldPosition(new THREE.Vector3()).y : box.max.y) - ground;
  if (!(top > 0.1)) return null;
  return { name, scene, own, up, hipsY: hips.position.y, ahead: own.walk ? heading(own.walk, up) : null, top, ground };
}

export const forgetFigures = () => {
  templates.clear();
  listed = null;
};

const LOOPS = new Set(['idle', 'walk', 'run']);

// locomotion.js reads `move` as idle under 0.04, the walk all there from 0.3,
// the run coming in from 0.55 and all there at 0.9 (Middle-earth’s castRules
// has the same sums; a world reads another’s only through its face, so here they are)
const ease01 = (k) => (k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k));
export function moveFor(speed, walk, run) {
  const v = Math.abs(Number.isFinite(speed) ? speed : 0);
  const w = walk > 0 ? walk : 1;
  const r = run > w ? run : w * 1.6;
  if (v < 1e-3) return 0;
  if (v < w * 0.35) return 0.3 * ease01(v / (w * 0.35));
  if (v < w * 1.25) return 0.3 + 0.25 * ((v - w * 0.35) / (w * 0.9));
  const top = Math.max(r * 0.9, w * 1.25 + 1e-3);
  if (v < top) return 0.55 + 0.45 * ease01((v - w * 1.25) / (top - w * 1.25));
  return 1;
}

export function figure(name, { rt = null, height = heightOf(name), seed = 0, ink = (rt?.quality?.tier ?? 'high') !== 'low', material = null } = {}) {
  const group = new THREE.Group();
  group.name = `hogwarts:${name}`;
  let st = null;
  let want = { base: null, speed: 0 };
  let shownBase = null;
  let gone = false;
  const ready = loadFigure(name, rt).then((tpl) => {
    if (!tpl || gone) return false;
    const model = cloneSkinned(tpl.scene);
    const materials = new Set();
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = material ? material(o.material) : o.material.clone();
      if (!material) {
        if ('roughness' in o.material) o.material.roughness = 0.85;
        if ('metalness' in o.material) o.material.metalness = 0;
      }
      materials.add(o.material);
      o.frustumCulled = false; // (a skinned mesh’s bounds don’t follow its pose)
      o.castShadow = !material;
    });
    const k = height / Math.max(tpl.top, 1e-3);
    model.scale.setScalar(k);
    model.position.y = -tpl.ground * k;
    group.add(model);
    if (ink && !material) materials.add(inkHull(model, INK / k));
    const anim = createAnimator(model, { clips: tpl.own, hipsY: tpl.hipsY, up: tpl.up, key: `hogwarts:${name}:${k.toFixed(2)}`, seed, unit: k });
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
    get loaded() {
      return Boolean(st);
    },
    set(next) {
      want = { ...want, ...next };
    },
    play(clip, opts = {}) {
      return st ? st.anim.play(clip, { layer: 'full', ...opts }) : Promise.resolve('cut');
    },
    look(target, opts) {
      st?.anim.look(target, opts);
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
      group.removeFromParent();
      if (!st) return;
      st.anim.dispose();
      for (const m of st.materials) m.dispose?.();
      st = null;
    },
  };
}
