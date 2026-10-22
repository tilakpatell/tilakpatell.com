// The people in the cockpits: Jesse beside you in the RV and Walt behind
// him, modelled with Meshy (scripts/meshy-cockpit.mjs), each the rigged
// model and a clip of Meshy's (sat in a chair, or stood) played on the
// model's own skeleton; and Chewie in the Falcon's co-pilot's seat, the 2017
// game's own Chewbacca from the site's one cast table, sat by the game's
// own clip (loadGameCrew). A seated figure is placed by its hips, so it sits
// on the seat whatever its size; `pose` (called after the clip each frame)
// can turn a bone or two on top, an arm reaching for a lever.

import * as THREE from 'three';
import { gltfLoader } from '../../lib/three/gltf';
import { sharpenMaterial } from '../../lib/three/textures';
import { bodyOf } from '../../lib/cast/bodies';
import { PACK_DIR, cutsToLoad, loadWalrusBody, loadWalrusPacks, swapBody } from '../../lib/three/walrus';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { detailLevel } from '../../lib/detail';
import { device } from '../../lib/device';
import { retarget } from '../rickmorty/portal/clips';

const BASE = '/models/cockpit';

let loader = null;
const getLoader = () => {
  if (!loader) {
    loader = gltfLoader();
  }
  return loader;
};

// Fetch a crew member's files ahead of time (the HTTP cache keeps them).
export const prefetchCrew = (names) => names.forEach((n) => fetch(`${BASE}/${n}.glb`).catch(() => {}));

// Loads `name` with its `clip` and resolves to a seated (or standing)
// figure, or null if it can't load:
//   { group, bones, update(dt), dispose() }
// `height` is how tall it stands (metres); `hips` is where its hips go in
// the parent's space; `face` turns it about y (Meshy's people face +z; the
// default, π, faces them down −z, the way the cockpits look). `file`:
// another figure of the same person on the same skeleton (the wardrobe’s
// Jesse in the lab’s suit, Albuquerque’s), sat on `name`’s clip.
export async function loadCrew(name, { file = null, clip = 'sit', height, hips = [0, 0.5, 0], face = Math.PI, rough = 0.85, smooth = true, pose = null } = {}) {
  const L = getLoader();
  let gltf;
  let anim;
  try {
    [gltf, anim] = await Promise.all([L.loadAsync(file ?? `${BASE}/${name}.glb`), clip ? L.loadAsync(`${BASE}/${name}-${clip}.glb`).catch(() => null) : null]);
  } catch {
    return null;
  }
  const model = gltf.scene;
  const owned = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
    o.castShadow = false;
    o.receiveShadow = false;
    const m = o.material;
    if (m) {
      // Meshy's colours carry their own shading: keep them matte
      m.roughness = rough;
      m.metalness = 0;
      sharpenMaterial(m);
      owned.push(m, m.map);
    }
    // Meshy's remeshed surfaces come flat-shaded; smooth them, so fur and
    // cloth don't read as facets up close
    if (smooth) smoothNormals(o.geometry);
    owned.push(o.geometry);
  });
  const hipBone = model.getObjectByName('Hips') ?? model.getObjectByName('hips') ?? model.getObjectByName('mixamorigHips') ?? null;
  // (on another figure, the clip’s hips scaled from the ones it was made on)
  const clipAnim = file && hipBone ? retarget(anim?.animations?.[0], hipBone.position.y, anim?.scene.getObjectByName('Hips')?.position.y ?? hipBone.position.y) : anim?.animations?.[0];
  return seat(model, clipAnim, { height, hips, face, pose, owned });
}

// A figure sat (or stood) where it goes: scaled to `height` from its
// skeleton at rest, its clip played from a moment of its own, turned by
// `face` and moved so its hips land on `hips`, which it keeps whatever the
// clip does to them; `owned`, what's freed with it.
function seat(model, clipAnim, { height, hips, face, pose, owned }) {
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  const hipBone = bones.Hips ?? bones.hips ?? bones.mixamorigHips ?? null;
  // how tall it stands, from its skeleton at rest (a skinned mesh's own
  // bounds don't know its pose until it's drawn): the top of the head to the
  // lower of the toes (the game's rig ends its head in HeadEnd, Meshy's in head_end)
  if (height) {
    model.updateMatrixWorld(true);
    const y = (n) => bones[n]?.getWorldPosition(new THREE.Vector3()).y;
    const top = y('head_end') ?? y('HeadEnd') ?? y('Head');
    const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
    const tall = top != null ? top - toes : new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
    if (tall > 0.01) model.scale.multiplyScalar(height / tall);
  }

  let mixer = null;
  if (clipAnim) {
    mixer = new THREE.AnimationMixer(model);
    const a = mixer.clipAction(clipAnim);
    a.play();
    a.time = Math.random() * clipAnim.duration;
    mixer.update(0);
  }

  // turn it, then move it so its hips land on `hips`
  const turn = new THREE.Group();
  turn.rotation.y = face;
  turn.add(model);
  const group = new THREE.Group();
  group.add(turn);
  group.updateMatrixWorld(true);
  if (hipBone) {
    const at = hipBone.getWorldPosition(new THREE.Vector3());
    turn.position.set(hips[0] - at.x, hips[1] - at.y, hips[2] - at.z);
  } else {
    turn.position.set(...hips);
  }
  // the clip moves the hips a little; keep the figure where it was put
  const rest = hipBone ? hipBone.position.clone() : null;

  return {
    group,
    bones,
    model,
    update(dt) {
      mixer?.update(dt);
      if (rest && hipBone) {
        hipBone.position.x = rest.x;
        hipBone.position.z = rest.z;
      }
      pose?.(bones, dt);
    },
    dispose() {
      mixer?.stopAllAction();
      for (const o of owned) o?.dispose?.();
    },
  };
}

// The pack a 2017 figure in a seat plays from: the drivers' and riders'
// (lib/three/walrusSets/vehicles.js: the X-34's driver sat at its controls,
// a hand on each side). Not the humanoid one every 2017 person stands on: a
// seat wants none of its clips, and it is a megabyte more for the intro
const SEAT_PACKS = [`${PACK_DIR}/clips-vehicles.glb`];
const HAIR_ROUGH = 0.95; // (the Falcon's Meshy Chewie's, as loadCrew's `rough` had it)
// a 2017 kind's cuts in the order it fetches them: its light one, then the
// one the device's level wants (none more on a saver connection)
const cutsOfKind = (kind) => (bodyOf(kind)?.rig === 'walrus' ? cutsToLoad(bodyOf(kind).url, detailLevel(), { lowData: Boolean(device().saveData) }) : []);

// A 2017 crew member's first cut and the seat's packs, fetched and parsed
// into the page's cache ahead of time (lib/three/gltfCache).
export function prefetchGameCrew(kind) {
  const [first] = cutsOfKind(kind);
  if (!first) return;
  loadGLTF(first);
  loadWalrusPacks(SEAT_PACKS).catch(() => {});
}

// A crew member on the 2017 game's own body (`kind`, a row of the site's
// one cast table: lib/cast/bodies.js), on the game's whole skeleton and sat
// by the game's own `clip` (a name in SEAT_PACKS), placed as loadCrew places
// one: { group, bones, model, update(dt), dispose() }, or null where the
// game has no body for it or it won't load (the caller's own stands in). Its
// light cut first, the level's put on the same bones as it lands
// (lib/three/walrus.js's swapBody): a hero's full cut is 10 to 45 MB, and
// nobody waits that long in the seat. Its materials are the game's own, as
// they are, each the copy's, freed with it.
export async function loadGameCrew(kind, { clip = 'ride.landspeeder', height = bodyOf(kind)?.tall, hips = [0, 0.5, 0], face = 0, pose = null } = {}) {
  const [first, next] = cutsOfKind(kind);
  if (!first) return null;
  const url = bodyOf(kind).url;
  const body = await loadWalrusBody(first, { packs: SEAT_PACKS })
    .catch(() => (first === url ? null : loadWalrusBody(url, { packs: SEAT_PACKS })))
    .catch(() => null);
  // (no seat's clip, its pack not come: the caller's own stands in, never one
  // stood in a chair; the copy's own materials freed)
  if (!body?.clips[clip]) {
    body?.model.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.dispose()));
    return null;
  }
  // (no shadow taken, as the Meshy crew take none: fur and shadow maps make
  // speckles; and the hair's cards matte, as the Meshy crew's are kept: the
  // game draws them with a hair shader of its own, and in a plain PBR one
  // their gloss under the cockpit's lamps is a glitter of white points)
  const dress = (root) => {
    const mats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      o.castShadow = false;
      o.receiveShadow = false;
      for (const m of [].concat(o.material)) {
        if (/hair/i.test(m.name) && m.roughnessMap) {
          m.roughnessMap = null;
          m.roughness = HAIR_ROUGH;
          m.needsUpdate = true;
        }
        mats.push(m);
      }
    });
    return mats;
  };
  const owned = dress(body.model);
  const sat = seat(body.model, body.clips[clip], { height, hips, face, pose, owned });
  let gone = false;
  if (next)
    loadGLTF(next)
      .then((gltf) => {
        if (gone || !gltf) return;
        const full = cloneScene(gltf);
        const mats = dress(full);
        const old = swapBody(body.model, full);
        // (what the light one threw, the full one throws: swapBody's, as the cockpit's shadows set it once)
        if (!old.length) return mats.forEach((m) => m.dispose());
        for (const o of old) for (const m of [].concat(o.material)) m.dispose();
        owned.splice(0, owned.length, ...mats);
      })
      .catch(() => {}); // (the light cut stays: it was already a whole figure)
  const free = sat.dispose;
  sat.dispose = () => {
    gone = true;
    free();
  };
  return sat;
}

// Normals averaged over every face that meets at a point, whatever seams
// split the point's vertices (Meshy's UV islands are many).
export function smoothNormals(geo) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const n = pos.count;
  const key = new Array(n);
  const ids = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    if (!ids.has(k)) ids.set(k, ids.size);
    key[i] = ids.get(k);
  }
  const acc = new Float32Array(ids.size * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const tris = idx ? idx.count / 3 : n / 3;
  for (let t = 0; t < tris; t++) {
    const i0 = idx ? idx.getX(t * 3) : t * 3;
    const i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    // the face's normal, weighted by its area
    b.sub(a);
    c.sub(a);
    b.cross(c);
    for (const i of [i0, i1, i2]) {
      acc[key[i] * 3] += b.x;
      acc[key[i] * 3 + 1] += b.y;
      acc[key[i] * 3 + 2] += b.z;
    }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a.set(acc[key[i] * 3], acc[key[i] * 3 + 1], acc[key[i] * 3 + 2]).normalize();
    out.set([a.x, a.y, a.z], i * 3);
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}

// Turn a bone by a small Euler on top of whatever the clip did this frame.
const e = new THREE.Euler();
const q = new THREE.Quaternion();
export function nudge(bone, x = 0, y = 0, z = 0) {
  if (!bone) return;
  q.setFromEuler(e.set(x, y, z));
  bone.quaternion.multiply(q);
}

// Turn a bone about an axis given in the world, on top of the clip (its
// parent's turn undone, the turn made, the parent's put back): for the
// game's skeleton, whose bones' own axes are not Meshy's, so a lean is
// said in the cockpit's directions and means the same on either.
const pq = new THREE.Quaternion();
const dq = new THREE.Quaternion();
export function nudgeWorld(bone, axis, angle) {
  if (!bone?.parent || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(pq);
  dq.setFromAxisAngle(axis, angle);
  bone.quaternion.premultiply(pq.clone().invert().multiply(dq).multiply(pq));
}
