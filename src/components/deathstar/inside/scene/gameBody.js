// The people aboard on the 2017 game's own bodies: a kind the cast names a
// row of the site's one cast table for (rules/cast.js's `game`,
// src/lib/cast/bodies.js) is drawn on the game's whole skeleton and moved by
// the game's own clips, as the galaxy's and the universe's people are
// (docs/superpowers/specs/2026-10-21-battlefront-by-default-design.md,
// decision 4). The rules keep the clip names they always had: GAME_CLIPS
// says which of the game's stands in for each, a pose the game has no clip
// for is one frame of the nearest clip it has, held (poseOf), and a name it
// has nothing near is a still, the figure kept to its walk and its idle.
// Never a clip of the library's: those are made for the 24-bone figures
// (figures.js), and a 2017 figure plays only the game's (the owner's
// ruling, 2026-10-10: lib/three/walrus.js). The droids on a skeleton of
// their own (the astromechs, the gonk) come as their surfaces' models came,
// rocking as they roll, on the game's mesh and playing its idle.
//
//   GAME_CLIPS        the station's clip names → the game's: a name, or { clip, pose?, pack?, at? } (below)
//   gameClip(name, has, { rifle }) → that spec for one of the station's names, or null (a still)
//   poseOf(clip, t, name) → AnimationClip   the clip at t seconds, held: one frame to stand in
//   faceOf(model, rest) → radians   how far a posed body's chest has turned about the up axis from rest
//   loadGameBody(kind, { finish }) → Promise<{ model, clips, sockets, row, owned, swapped, gone() } | null>
//     kind: a row of the cast table on the game's humanoid skeleton; its light cut first, and a hero's
//     level's cut put on its bones as it lands (walrus.js's swapBody); finish(material) → material:
//     each of its materials as the kind wears it (a tint, a dye), the cut that lands after too;
//     owned, the materials to free with it; null where it won't load
//   loadPack(model, name) → Promise<{ name: AnimationClip }>   a pack of the game's clips bound to this body
//   loadGameDroid(kind) → Promise<{ scene, animations } | null>   a droid on its own rig as a model and its idle
//   gameRagdoll() → Promise<row | null>   the game's fifteen bodies for a fall (lib/three/ragdoll2017.js)

import * as THREE from 'three';
import { bodyOf } from '../../../../lib/cast/bodies';
import { cloneScene, loadGLTF } from '../../../../lib/three/gltfCache';
import { PACK_DIR, clipsFor, cutsToLoad, faceAlongZ, loadWalrusBody, loadWalrusPacks, packUrls, richClips, swapBody } from '../../../../lib/three/walrus';
import { cutUrl } from '../../../../lib/three/walrusCuts';
import { loadOwnRigBody } from '../../../../lib/three/ownRig';
import { ragdollOf } from '../../../../lib/three/ragdoll2017';
import { detailLevel } from '../../../../lib/detail';
import { device } from '../../../../lib/device';

// The station's names for what a person does, and the game's clip for each
// (lib/three/walrusClips.js's names; a pack past the figure's own where it
// is named, fetched the first time anyone aboard asks for it): `pose`, one
// frame of it at `at` of the way through, held (the game has no kneel: a
// soldier's crouch at low cover stands in, and a body down on the deck is
// its prone cover); otherwise
// the clip as it plays. A name that isn't here plays as it is if the
// figure's packs have it (talk, the sabre's strokes, the Force), and is a
// still if they haven't.
export const GAME_CLIPS = Object.freeze({
  'hit.trooper': 'hit.chest',
  'hit.stomach': 'hit.back',
  'hit.shoulder.l': 'hit.chest',
  'hit.shoulder.r': 'hit.chest',
  'hit.knock': 'stagger',
  'die.2': 'die',
  'idle.calm': 'idle.patrol',
  // (a gun up: the rifle's where it carries one, else the pistol's; gameClip turns them)
  'aim.pistol': 'aim.pistol',
  'shoot.pistol': 'aim.pistol',
  cast: ['force.push', 'force.choke', 'force.lightning'],
  'cast.double': ['force.lightning', 'force.electrocute'],
  'sword.light.d': 'sword.a',
  'sword.c': 'sword.uppercut',
  'sword.heavy': 'sword.heavy.a',
  'crouch.walk': 'crouch.run',
  crouch: { clip: 'crouch', pose: true, at: 1 },
  // (down on one knee: the low cover's crouch, held halfway through; the rifle's own crouch,
  // its last frame, stands nearly upright with the hands up, which read as no kneel at all)
  kneel: { clip: 'cover.low.idle', pack: 'npc', pose: true, at: 0.5 },
  // (sat: the troops waiting in the Lambda, a bench's sit with the hands on the knees)
  'sit.idle': { clip: 'deploy.lambda.wait', pack: 'vehicles' },
  // (Vader at the foot of the ramp: a hero's defeat, slumped on his knees; and laid down, the prone cover)
  'sit.ground': { clip: 'die', pose: true, at: 0.45 },
  lie: { clip: 'cover.prone', pack: 'npc', pose: true, at: 0.5 },
});

// (the rifles: aimed in the rifle's own pose, the hand on the grip where the station's carbine sits)
const RIFLES = new Set(['e11', 'a280']);

export function gameClip(name, has, { rifle = false } = {}) {
  if (name == null) return null;
  const want = GAME_CLIPS[name] ?? name;
  if (typeof want === 'object' && !Array.isArray(want)) return want;
  if (rifle && want === 'aim.pistol' && has('aim.rifle')) return { clip: 'aim.rifle' };
  const hit = [].concat(want).find((n) => has(n));
  return hit ? { clip: hit } : null;
}
export const isRifle = (gun) => RIFLES.has(gun);

export function poseOf(clip, t, name = `${clip.name}@${t.toFixed(2)}`) {
  const tracks = clip.tracks.map((track) => {
    const v = track.createInterpolant().evaluate(Math.min(t, clip.duration)).slice();
    return new track.constructor(track.name, [0, 1], [...v, ...v]);
  });
  const pose = new THREE.AnimationClip(name, 1, tracks);
  pose.userData = { ...clip.userData, pose: true };
  return pose;
}

// how far a body's chest has turned about the up axis since `rest` ({ bone,
// forward }: the chest and its forward in its own frame at rest), in the
// model's space; 0 when it has no chest
const _q = new THREE.Quaternion();
const _f = new THREE.Vector3();
export function faceOf(model, rest) {
  if (!rest?.bone) return 0;
  model.updateMatrixWorld(true);
  rest.bone.getWorldQuaternion(_q);
  _q.premultiply(model.getWorldQuaternion(new THREE.Quaternion()).invert());
  _f.copy(rest.forward).applyQuaternion(_q);
  return Math.atan2(_f.x, _f.z);
}

// a kind's cuts in the order it fetches them: a full-fidelity row's light
// cut alone (the station draws its crowds at it: the full ones are 13 to 27
// MB each, for the galaxy's ground to stream near the eye), a hero's light
// one, then the one the level wants (none more on a saver connection)
function cutsOf(row) {
  if (row.full) return [cutUrl(row.url, row.lod ? 'lod1' : 'plain')];
  return cutsToLoad(row.url, detailLevel(), { lowData: Boolean(device().saveData) });
}
const packsOf = (row) => packUrls(row.pack ?? null, { extras: richClips(detailLevel()) });

// (each mesh's materials, the copy's own, returned for the figure to free;
// a skinned mesh's bounds don't follow its pose, and the small parts cast
// no shadow, as the galaxy's crowds' don't)
function dress(root, finish = (m) => m) {
  const mats = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    if (o.material?.alphaTest > 0) o.castShadow = false;
    o.material = Array.isArray(o.material) ? o.material.map(finish) : finish(o.material);
    mats.push(...[].concat(o.material));
  });
  return mats;
}

export async function loadGameBody(kind, { finish } = {}) {
  const row = bodyOf(kind);
  if (row?.rig !== 'walrus') return null;
  const [first, next] = cutsOf(row);
  const packs = packsOf(row);
  const body = await loadWalrusBody(first, { packs })
    .catch(() => (first === row.url ? null : loadWalrusBody(row.url, { packs })))
    .catch(() => null);
  if (!body) return null;
  const owned = dress(body.model, finish);
  let gone = false;
  // (the level's cut onto the same bones as it lands: the old one's materials freed)
  const swapped = next
    ? loadGLTF(next)
        .then((gltf) => {
          if (gone || !gltf) return false;
          const full = cloneScene(gltf);
          const mats = dress(full, finish);
          const old = swapBody(body.model, full);
          if (!old.length) return mats.forEach((m) => m.dispose()), false;
          for (const o of old) for (const m of [].concat(o.material)) m.dispose();
          owned.splice(0, owned.length, ...mats);
          return true;
        })
        .catch(() => false) // (the light cut stays: it was already a whole figure)
    : Promise.resolve(false);
  return { ...body, row, owned, swapped, gone: () => (gone = true) };
}

const packCache = new Map(); // pack name → Promise<Map<name, AnimationClip>>
export function loadPack(model, name) {
  if (!packCache.has(name)) packCache.set(name, loadWalrusPacks([`${PACK_DIR}/clips-${name}.glb`]).catch(() => new Map()));
  return packCache.get(name).then((got) => clipsFor(model, got));
}

export async function loadGameDroid(kind) {
  const row = bodyOf(kind);
  if (row?.rig !== 'own') return null;
  const url = cutUrl(row.url, row.lod ? 'lod1' : 'plain');
  const body = await loadOwnRigBody(url, { rig: row.ownRig })
    .catch(() => (url === row.url ? null : loadOwnRigBody(row.url, { rig: row.ownRig })))
    .catch(() => null);
  if (!body?.model) return null;
  dress(body.model);
  faceAlongZ(body.model);
  // (its bounds as it stands, for people.js's buildProp to size it by: a skinned mesh's are its
  // bones' till they are worked out, and they aren't before it is first drawn)
  body.model.updateMatrixWorld(true);
  body.model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    o.computeBoundingBox();
  });
  const idle = body.clips?.idle ?? null;
  return { scene: body.model, animations: idle ? [idle] : [] };
}

let ragdoll = null;
// (the trooper's row, as the galaxy's ground war takes it for anyone on the game's skeleton)
export const gameRagdoll = () => (ragdoll ??= import('../../../../data/bf2017/physics/ragdoll.json').then((m) => ragdollOf(m.default ?? m, 'stormtroopershared')).catch(() => null));
