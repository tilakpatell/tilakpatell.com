// A figure from Star Wars Battlefront II (2017), on the game's own skeleton
// (Walrus_HumanMale, kept whole: walrusRig.js), moved by the game's own
// clips: the packs scripts/bf2017-clips.mjs makes (a generic humanoid one,
// and one per hero, each under the site's clip names: walrusClips.js). The
// clips bind to the body by bone name, as they were made, so nothing is
// retargeted; a track naming a bone this body hasn't got is left out before
// the mixer sees it (three would warn and skip it every frame otherwise), a
// bone another clip of the set moves is put back to rest in a clip that
// leaves it alone (a pack doesn't send the channels that only hold rest, and
// three leaves an untouched bone where the last clip put it), and a name the
// packs lack plays the nearest one they have (walrusRig.js's CLIP_FALLBACK).
// No UAL or Meshy clip ever reaches one of these (the owner's ruling,
// 2026-10-10); the animator is told not to fetch from the library.
// (docs/superpowers/specs/2026-10-10-battlefront-2017-asset-pipeline-design.md, section 4)
//
//   loadWalrusPacks(urls, { loader }) → Promise<Map<name, AnimationClip>>:
//     each pack fetched once a page (gltfCache), later packs' clips over
//     earlier ones' of the same name, a pack's aliases (one clip under two
//     names) made into names; a pack that fails is skipped
//   clipsFor(body, clips) → { name: AnimationClip }: the set this body plays,
//     filtered to its bones, rest put back, the fallbacks named
//   socketsOf(body) → { weapon, muzzle, aim, handL, handR }: the bones, or null
//   loadWalrusBody(url, { packs, loader }) → Promise<{ model, clips, sockets }>:
//     a copy of the body (its own bones), its clips; refuses a tree that is
//     not the game's rig, naming what it lacks
//   PACK_DIR, packUrls(hero): the packs a figure loads, the humanoid first,
//     then the hero's own, or for a soldier (no hero) the soldiers' (npc:
//     walrusSets/npc.js's cover, awareness and arrivals), a hero's emotes
//     (emotes-<hero>: its four, its victories, its stage idle), and the
//     additive layer's; with { extras: false } (richClips: a phone's
//     levels) the humanoid's and the hero's alone
//     the additive layer's last (its clips marked `additive`: laid over the
//     pose by lib/three/additiveLayer.js, never played as one)
//   cutFor(url, level): which of a 2017 figure's three files a device loads
//     (lib/detail.js's level, from lib/device's tier): at ultra its
//     `.ultra` (the game's top mesh, every map at the game's 2048, up to
//     384 MB of GPU textures a hero), at high the plain one (that mesh at
//     1024 colour and 512 maps, 23 to 49 MB), at low and mid its `.lod1` (a
//     lighter mesh at 512 and 256, under 13 MB); the caller falls back to
//     the plain file when a cut isn't there

import * as THREE from 'three';
import { cloneScene, loadGLTF } from './gltfCache';
import { CLIP_FALLBACK, SOCKETS, checkWalrus, isWalrus } from './walrusRig.js';
import { EMOTE_HEROES } from './walrusSets/emotes.js';

export const PACK_DIR = '/models/galaxy/bf2017';
export const packUrls = (hero = null, { extras = true } = {}) => [
  `${PACK_DIR}/clips-humanoid.glb`,
  ...(hero ? [`${PACK_DIR}/clips-${hero}.glb`] : extras ? [`${PACK_DIR}/clips-npc.glb`] : []),
  ...(extras && EMOTE_HEROES.includes(hero) ? [`${PACK_DIR}/clips-emotes-${hero}.glb`] : []),
  ...(extras ? [`${PACK_DIR}/clips-additive.glb`] : []),
];
// whether a device's level loads the packs past a figure's own (the soldiers',
// the additive layer's, the stances'): not at a phone's levels, whose
// download the world's budget counts (worlds.js's WORLD_MB)
export const richClips = (level) => level === 'high' || level === 'ultra';

export const cutFor = (url, level) => (level === 'low' || level === 'mid' ? url.replace(/\.glb$/, '.lod1.glb') : level === 'ultra' ? url.replace(/\.glb$/, '.ultra.glb') : url);

// The cuts a figure fetches, in order: its light one first where the level
// wants a bigger one (the full cut of a 2017 hero is 10 to 45 MB of the
// game's own maps), then that one, which swapBody puts on the figure as it
// lands; on a saver connection the light one only.
export function cutsToLoad(url, level, { lowData = false } = {}) {
  const light = cutFor(url, 'low');
  const want = cutFor(url, level);
  return want === light || lowData ? [light] : [light, want];
}

// The full cut's skinned meshes on a figure already walking on its light
// one: each bound to the figure's own bones by name (the same skeleton, so
// the animator, the sockets and the saber keep theirs), hung where the
// light ones hang, and the light ones taken off; returns those, for their
// materials to be freed.
export function swapBody(model, full) {
  const bones = new Map();
  model.traverse((o) => o.isBone && !bones.has(o.name) && bones.set(o.name, o));
  const old = [];
  model.traverse((o) => o.isSkinnedMesh && old.push(o));
  if (!old.length) return [];
  const parent = old[0].parent;
  const fresh = [];
  full.traverse((o) => o.isSkinnedMesh && fresh.push(o));
  for (const m of fresh) {
    const mapped = m.skeleton.bones.map((b) => bones.get(b.name) ?? null);
    if (mapped.some((b) => !b)) continue;
    const skeleton = new THREE.Skeleton(mapped, m.skeleton.boneInverses.map((x) => x.clone()));
    const bindMatrix = m.bindMatrix.clone();
    m.removeFromParent();
    parent.add(m);
    m.bind(skeleton, bindMatrix);
    m.frustumCulled = false;
    m.castShadow = old[0].castShadow;
  }
  if (!fresh.some((m) => m.parent === parent)) return [];
  for (const o of old) o.removeFromParent();
  return old;
}

const boneOf = (track) => track.name.slice(0, track.name.lastIndexOf('.'));

export async function loadWalrusPacks(urls, { loader } = {}) {
  const gltfs = await Promise.all(urls.map((u) => loadGLTF(u, { loader })));
  const out = new Map();
  for (const g of gltfs) {
    if (!g) continue;
    for (const c of g.animations ?? []) out.set(c.name, c);
    const aliases = g.scene?.userData?.aliases ?? g.userData?.aliases ?? {};
    for (const [name, to] of Object.entries(aliases)) {
      const c = out.get(to);
      if (!c) continue;
      const copy = c.clone();
      copy.name = name;
      out.set(name, copy);
    }
  }
  return out;
}

// a bone's rest, as the body stands before any clip
const restTrack = (bone, path, end) => {
  const v = bone[path].toArray();
  const T = path === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
  return new T(`${bone.name}.${path}`, [0, end], [...v, ...v]);
};

export function clipsFor(body, clips) {
  // (the bones by name, a bone before any other node of its name)
  const bones = new Map();
  body.traverse((o) => o.isBone && o.name && !bones.has(o.name) && bones.set(o.name, o));
  body.traverse((o) => o.name && !bones.has(o.name) && bones.set(o.name, o));
  const own = {};
  // every bone and path any clip of the set moves, on this body
  const moved = new Map(); // `${bone}.${path}` → [bone, path]
  for (const [name, clip] of clips) {
    const tracks = clip.tracks.filter((t) => bones.has(boneOf(t)));
    if (!tracks.length) continue;
    const c = new THREE.AnimationClip(name, clip.duration, tracks);
    c.userData = { ...(clip.userData ?? {}) };
    own[name] = c;
    // (an additive's deltas are laid over the pose, never played: no rest in them, nor from them)
    if (c.userData.additive) continue;
    for (const t of tracks) {
      const path = t.name.slice(t.name.lastIndexOf('.') + 1);
      moved.set(t.name, [bones.get(boneOf(t)), path]);
    }
  }
  // (rest back where a clip leaves a moved bone alone)
  for (const c of Object.values(own)) {
    if (c.userData.additive) continue;
    const has = new Set(c.tracks.map((t) => t.name));
    for (const [id, [bone, path]] of moved) if (!has.has(id)) c.tracks.push(restTrack(bone, path, c.duration));
  }
  // (each its own copy: the mixer keeps one action a clip, so a fallback
  // sharing the idle's would have a dodge stop the idle for good)
  for (const [name, to] of Object.entries(CLIP_FALLBACK))
    if (!own[name] && own[to]) {
      own[name] = own[to].clone();
      own[name].name = name;
      own[name].userData = { ...own[to].userData };
    }
  return own;
}

export function socketsOf(body) {
  return Object.fromEntries(Object.entries(SOCKETS).map(([k, n]) => [k, body.getObjectByName(n) ?? null]));
}

export async function loadWalrusBody(url, { packs = packUrls(), loader } = {}) {
  const [gltf, clips] = await Promise.all([loadGLTF(url, { loader }), loadWalrusPacks(packs, { loader })]);
  if (!gltf) throw new Error(`${url}: no model`);
  const model = cloneScene(gltf);
  const names = [];
  model.traverse((o) => o.name && names.push(o.name));
  // (and its sockets: a 2017 figure without Wep_Root would hold its saber
  // as a Meshy hand does while the game's clips move it, half of each)
  const check = checkWalrus(names);
  if (!isWalrus(names) || !check.ok) {
    const { missing } = check;
    throw new Error(`${url} is not on the game's skeleton (Spine1, never Meshy's Spine02); it lacks ${missing.slice(0, 6).join(', ')}`);
  }
  return { model, clips: clipsFor(model, clips), sockets: socketsOf(model) };
}
