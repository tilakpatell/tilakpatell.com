// The Road’s walkers: Middle-earth’s Meshy cast (public/models/middleearth/
// cast/<name>.glb, each with its own idle, walk and run beside it) on the
// shared skeleton, through lib/three’s rig, animator and locomotion, with
// the house’s ink line round each above low (inkNodes). Loaded through the runtime’s
// asset cache under the Road’s name, so they go when the Road does.
// (Middle-earth’s cast3d.js does this for the towns, but its closure
// carries GLSL; this is the same recipe on the node renderer.)
//
//   loadCast(names, rt) → Promise<{ ready: Set<name> }>
//   walker(name, { height, seed }) → { group, ready, set({ base, speed }), tick(dt), tip(out), dispose }
//     base: a looping clip in place of locomotion (sit.ground, tired, crawl…)
//     or null; speed: metres a second over the ground, the feet paced to it;
//     what the figure carries and wears (gear.js: Gandalf’s staff, Legolas’s
//     bow, the swords at the hip) on it once it’s in, the held through
//     lib/three/held.js (in the palm from the hand’s skin, a staff planted:
//     the arm kept still under it, its head up); tip(out) → where the head
//     of what it holds is in the world (a staff’s: Moria’s light), or null
//   forgetCast(): the templates let go, as the Road goes
//   heightOf(name) → metres, by kind (a hobbit, a man, an elf, a dwarf, a wizard)

import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createAnimator } from '../../../lib/three/animator';
import { faceAhead, heading } from '../../../lib/three/clipLibrary';
import { inkHull } from '../../../lib/three/inkNodes';
import { holdItem } from '../../../lib/three/held';
import { moveFor } from '../castRules';
import { gearFor, makeGear, wear } from './gear';

const DIR = '/models/middleearth/cast';
const LOCO = ['idle', 'walk', 'run'];
const LOOPS = new Set(['idle', 'walk', 'run', 'jog', 'walk.formal']);
// bases held at a moment of their clip rather than looped from its start:
// the kneel is a clip of kneeling to work at something, turning as it goes,
// held a little after it's down (as the Minas Tirith chapter holds it at the
// crowning) and let creep on slowly so it still breathes
const HELD = { 'kneel.fix': { at: 1.2, speed: 0.015 } };
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

// the templates let go with the Road (the runtime's asset cache forgets the
// files as the module goes; the next mount fetches them through it again)
export const forgetCast = () => templates.clear();

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
    const inked = (rt?.quality?.tier ?? 'high') !== 'low';
    // (not on low: the hull draws a figure twice, and a figure is never culled)
    if (inked) materials.add(inkHull(model, INK / k));
    group.updateMatrixWorld(true);
    // what it wears on its bones, put on in its bind pose (gear.js); what it holds, kept for the animator
    const items = [];
    const toHold = [];
    for (const g of gearFor(name)) {
      const item = makeGear(g.kind, height);
      if (!item) continue;
      if (g.held) toHold.push({ g, item });
      else if (wear(model, item, g, height)) items.push(item);
      else disposeItem(item);
    }
    const anim = createAnimator(model, { clips: tpl.own, hipsY: tpl.hipsY, up: tpl.up, key: `road:${name}:${k.toFixed(2)}`, seed, unit: k });
    const strides = anim.loco?.strides ?? {};
    // (in the palm, from the hand’s own skin; a hand the grip can’t read leaves the thing out)
    const holds = [];
    for (const { g, item } of toHold) {
      const h = holdItem({ model, anim }, item, g.as ?? g.kind, { hand: g.hand, curl: true });
      if (h) {
        holds.push(h);
        items.push(item);
      } else disposeItem(item);
    }
    if (inked) for (const item of items) materials.add(inkHull(item, INK / k));
    st = { model, anim, materials, items, holds, walkV: strides.walk?.speed ?? 0.9 * k, runV: strides.run?.speed ?? 2.6 * k };
    anim.update(0);
    for (const h of holds) h.update(0, { moving: false, busy: false });
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
        if (HELD[shownBase]) st.anim.stop('full', 0.4);
        shownBase = base;
        if (HELD[base]) {
          st.anim.base(null, { fade: 0.4 });
          st.anim.play(base, { layer: 'full', loop: true, fade: 0.4, ...HELD[base] });
        } else st.anim.base(base, { fade: 0.4 });
      }
      const speed = base ? 0 : want.speed;
      const motion = { move: moveFor(speed, st.walkV, st.runV), speed, side: 0, turn: 0, down: 0, air: 0 };
      st.anim.locomote(motion);
      st.anim.update(dt);
      // (what it holds carried over the walk: a staff’s arm still; a beat’s own clip, sat or down, has the arms)
      for (const h of st.holds) h.update(dt, { moving: speed > 0.1, busy: Boolean(base) });
      group.getWorldQuaternion(q);
      frame.forward.set(0, 0, 1).applyQuaternion(q);
      frame.up.set(0, 1, 0).applyQuaternion(q);
      st.anim.after(dt, motion, frame);
      for (const h of st.holds) h.after();
    },
    tip(out = new THREE.Vector3()) {
      const tip = st?.items.find((o) => o.getObjectByName('tip'))?.getObjectByName('tip');
      return tip ? tip.getWorldPosition(out) : null;
    },
    dispose() {
      gone = true;
      group.removeFromParent();
      if (!st) return;
      for (const h of st.holds) h.release();
      for (const item of st.items) disposeItem(item);
      st.anim.dispose();
      for (const m of st.materials) m.dispose();
      st = null;
    },
  };
}

// a thing of gear.js’s gone: off its bone, its own geometry and materials freed
function disposeItem(item) {
  item.removeFromParent();
  item.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) if (!o.userData.ink) m?.dispose();
  });
}
