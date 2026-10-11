// The crews' figures, loaded: who steps out of each ship (PARTY), and each
// one's figure, whatever it's made of (a Portal panic figure off the Meshy
// cast, a model of the site's on Rick's clips, a 2017 figure from the game
// on its own skeleton, or one built from shapes). footScene.js puts them on
// the ground; the galaxy's surface (galaxy/surface: scene.js, peers.js,
// crew.js) stands them on its worlds. Nothing here draws with GLSL of its
// own, so the surface can take it to the node renderer.
//
// The wardrobe's part (a look's body, its kind in the cast, and the look
// put on) comes in from whoever loads them, as wear = { bodyAsset,
// bodyKind, dress }: footScene.js hands in the classic wardrobe's
// (rickmorty/wardrobe/wear.js), the surface the node one's; the cast, as
// ever, comes in with each call.
//
//   figuresWith(wear) → { loadModel, loadParty, partyUrl }
//   loadSharedFigure(url, tall, { seed, from }), templateIn(models, url)
//   rigged, rigScene, built, seedFor, lookFor, HAND_GUNS, getLoader

import * as THREE from 'three';
import { gltfLoader } from '../../lib/three/gltf';
import { NO_CALLS, animatorCalls, seedOf } from '../../lib/three/figureCalls';
import { createAnimator } from '../../lib/three/animator';
import { cutsToLoad, loadWalrusBody, packUrls, richClips, swapBody } from '../../lib/three/walrus';
import { createCutter, cutUrl } from '../../lib/three/walrusCuts';
import { withStance } from '../../lib/three/walrusStance';
import { createAdditiveLayer } from '../../lib/three/additiveLayer';
import { loadOwnRigBody } from '../../lib/three/ownRig';
import { OWN_RIGS } from '../../lib/three/walrusClips';
import { cloneScene, loadGLTF } from '../../lib/three/gltfCache';
import { detailLevel } from '../../lib/detail';
import { device } from '../../lib/device';
import { breathe, createGait, sway } from '../../lib/three/gait';
import { seeded } from '../../lib/seeded';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { RICK_HIPS, borrowClips, faceForward, heading as headingOf, retarget } from '../rickmorty/portal/clips';
import { EVERYONE, LOOK_KEY, defaultLook, readLooks, writeLook } from '../rickmorty/wardrobe/looks';
import { local } from '../../lib/hooks';
import { smoothNormals } from '../cockpit/crew';
import { FOOT, METRE } from './foot';

const V = THREE.Vector3;

// who steps out of each ship: the one you play first, and who comes along
// (tall in metres; src: a Portal panic figure, a model of the site's, or
// one built here; the gun they carry (gunplay.js's GUNS), and the colour of
// its bolts)
export const PARTY = {
  cruiser: [
    { id: 'rick', name: 'Rick', tall: 1.88, src: { meshy: 'rick' }, gun: 'portal', bolt: '#8dff5a' },
    { id: 'morty', name: 'Morty', tall: 1.6, src: { meshy: 'morty' }, gun: 'laser', bolt: '#8dff5a' },
  ],
  rv: [
    { id: 'walt', name: 'Walt', tall: 1.79, src: { url: '/models/albuquerque/walt.glb' }, gun: 'revolver', bolt: '#ffd36b' },
    { id: 'jesse', name: 'Jesse', tall: 1.73, src: { url: '/models/albuquerque/jesse.glb' }, gun: 'pistol', bolt: '#ffd36b' },
  ],
  falcon: [
    { id: 'chewie', name: 'Chewie', tall: 2.28, src: { url: '/models/cockpit/chewie.glb' }, gun: 'bowcaster', bolt: '#ff4a3d' },
    { id: 'han', name: 'Han', tall: 1.85, src: { url: '/models/galaxy/crew/han.glb' }, gun: 'blaster', bolt: '#ff4a3d' },
  ],
  xwing: [
    { id: 'luke', name: 'Luke', tall: 1.72, src: { url: '/models/galaxy/crew/luke.glb' }, gun: 'blaster', bolt: '#ff3b30' },
    { id: 'artoo', name: 'Artoo', tall: 1.09, src: { built: 'artoo' }, gun: null, bolt: null },
  ],
};

// ── Loading the people ──

export const getLoader = () => gltfLoader();

// (Rick’s clips, for every Meshy figure without its own, are borrowed as
// the wardrobe’s cast borrows them: rickmorty/portal/clips.js)

// each figure's seed: its name and which of that name it is, so two of a
// kind (a squad's troopers, two pilots' Walts) never breathe or step together
const seeds = new Map(); // name → how many
export const seedFor = (name) => {
  const n = seeds.get(name) ?? 0;
  seeds.set(name, n + 1);
  return seedOf(name, n);
};

// a rigged figure: { model (feet on y = 0, facing +z, `tall` metres in map
// units), bones, update(dt, move, motion?), after(dt, motion, frame), loco,
// mixer, act, anim, play, stop, base, look, react, dispose }, on an animator
// of its own (lib/three/animator.js). With `motion` (locomotion.js: how fast
// it's going which way, turning, in the air, hit, going down) its clips are
// paced to the ground and posed on top by `after`, once it's placed;
// without, they play at the old pace (the galaxy's worlds, until they hand
// it over too). play, base, look and react are the animator's
// (lib/three/figureCalls.js's animatorCalls: the clip library's clips, on
// the Meshy skeleton these all stand on). `key`: the figure's template (its file, for
// the library's copies), `seed`: its clocks; `up` (in the space its hips
// turn in) and `hipsY`, for the library's clips made for it.
export function rigged(model, clips, tall, owned, { seed = seedFor('rigged'), key = null, up = null, hipsY = null, library = true } = {}) {
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  // how tall it stands, from its skeleton at rest: the top of the head to the toes
  model.updateMatrixWorld(true);
  const y = (n) => bones[n]?.getWorldPosition(new V()).y;
  // (the game's rig ends its head in HeadEnd, Meshy's in head_end)
  const top = y('head_end') ?? y('HeadEnd') ?? y('Head');
  const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
  const box = new THREE.Box3().setFromObject(model);
  const height = top != null ? top - toes : box.getSize(new V()).y;
  const k = (tall * METRE) / Math.max(height, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.y -= (top != null ? toes : box.min.y) * k;
  // (the game's additive clips are laid over the pose, never played as one: lib/three/additiveLayer.js)
  const own = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip && !clip.userData?.additive));
  const adds = Object.fromEntries(Object.entries(clips).filter(([, clip]) => clip?.userData?.additive));
  const anim = createAnimator(model, { clips: own, bones, hipsY, up, unit: METRE, seed, key: key == null ? null : `${key}:${tall}`, library });
  const additive = Object.keys(adds).length ? createAdditiveLayer(model, adds) : null;
  if (additive) anim.post((step) => additive.apply(step));
  const act = Object.fromEntries(['idle', 'walk', 'run'].filter((n) => anim.actions[n]).map((n) => [n, anim.actions[n]]));
  // (library: false, and the calls too play only the figure's own: a 2017
  // figure never takes a library clip, nor reacts with one)
  const calls = animatorCalls(anim, { model, seed, own: Object.keys(own), act, library });
  return {
    model,
    bones,
    loco: anim.loco,
    mixer: anim.mixer,
    act,
    anim,
    update(dt, move, motion) {
      calls.tick(dt, motion ? Math.hypot(motion.speed ?? 0, motion.side ?? 0) > 0.05 * METRE : move > 0.05);
      anim.locomote(motion ? { move, ...motion } : { move });
      anim.update(dt);
    },
    after: (dt, motion, frame) => anim.after(dt, motion, frame),
    play: calls.play,
    stop: calls.stop,
    base: calls.base,
    look: calls.look,
    // (a hit with the side it came in from: the game's additive flinch on top
    // of whatever it's doing, where it has one; else the reaction as ever)
    react: (event, ctx = {}) => (event === 'hit' && ctx.side && additive?.hit(ctx.side, ctx.kind) ? { event, clip: `add.hit.${ctx.side}`, layer: 'additive' } : calls.react(event, ctx)),
    // the chest aimed by pitch and yaw through the game's additive aims (the
    // stance's own, `prefix` 'p.' or 'l.', where it has them); false when it has none
    aimAt: (pitch, yaw = 0, prefix = '') => {
      if (!additive?.has('add.aim.up')) return false;
      additive.aim(pitch, yaw, prefix);
      return true;
    },
    dispose() {
      anim.dispose();
      for (const o of owned) o?.dispose?.();
    },
  };
}

// the wardrobe’s look for the cruiser’s Rick or Morty, the RV’s Walt or
// Jesse (as kept, or as given: a pilot’s from the wire may have one cast’s
// and not the other’s, which are then as the show has them)
const WEARS = new Set(EVERYONE);
export const lookFor = (who, looks) => (WEARS.has(who) ? readLooks(looks ?? local.get(LOOK_KEY))[who] : null);
export const HAND_GUNS = { portalgun: 'portal', laserpistol: 'laser' }; // the wardrobe's hand gear that's a gun on foot

// A figure from Star Wars Battlefront II (2017), on the game's whole
// skeleton and moved by the game's own clips (lib/three/walrus.js: the
// humanoid pack and, for a hero, theirs over it; never the library's, which
// are made for Meshy's rig): the same figure every loader here returns,
// with its sockets (Wep_Root, where its saber or blaster sits) and its clips
// (the saber's strokes come from these). Its materials are the copy's own.
async function walrusFigure(spec) {
  // (its light cut first, then the one lib/detail's level wants, put on the
  // figure as it lands: a hero's full cut is 10 to 45 MB of the game's own
  // maps, and nobody waits that long to see Luke; on a saver connection the
  // light one only; and the full one when the light one isn't there: a
  // figure is never lost for want of a cut)
  // (past its own, the soldiers', the additive layer's and the stances'
  // packs only where the device's level can spend them: walrus.js's richClips)
  const rich = richClips(detailLevel());
  const packs = spec.packs ?? packUrls(spec.pack, { extras: rich });
  // (and the stance of the weapon it takes up: lib/three/walrusStance.js)
  return withStance(await gameFigure(spec, (url) => loadWalrusBody(url, { packs })), { enabled: rich });
}

// A 2017 droid or beast on a skeleton of its own (lib/three/ownRig.js: the
// B1, the B2, the droideka, the Ewok, the astromech, the probe, the
// tauntaun), moved by its rig's pack of the game's clips, with no sockets:
// otherwise as walrusFigure's.
async function ownRigFigure(spec) {
  const fig = await gameFigure(spec, (url) => loadOwnRigBody(url, { rig: spec.ownRig, packs: spec.packs, bones: spec.bones ?? {} }).then((b) => ({ ...b, sockets: null })));
  // (its skeleton's name, for its own set of the game's hit capsules: boltPlay.js)
  return Object.assign(fig, { rig: 'own', skeleton: OWN_RIGS[spec.ownRig]?.skeleton ?? null });
}

// A 2017 figure from its body loader. A hero (three files by the level,
// walrus.js's cutsToLoad): its light cut, then the level's swapped on as it
// lands. A kind at full fidelity (`cuts.full`, phase 2's cast): its light
// cut, then the cut its distance wants, through cutAt (lib/three/
// walrusCuts.js: the full one near, within a page's share of the GPU's
// texture memory, the far one past the level's mid). Either way the cut
// goes onto the same bones (walrus.js's swapBody), so the animator, the
// sockets and the saber keep theirs; its small parts cast no shadow.
async function gameFigure(spec, loadBody) {
  const cuts = spec.cuts?.full ? spec.cuts : null;
  const level = detailLevel();
  const lowData = Boolean(device().saveData);
  const [first, next] = cuts ? [cutUrl(spec.src.url, cuts.lod ? 'lod1' : 'plain'), null] : cutsToLoad(spec.src.url, level, { lowData });
  const { model, clips, sockets } = await loadBody(first).catch((e) => (first === spec.src.url ? Promise.reject(e) : loadBody(spec.src.url)));
  // (each mesh's materials, the copy's own, returned for the figure to free)
  const dress = (root) => {
    const mats = [];
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      mats.push(...[].concat(o.material));
      meshes.push(o);
    });
    // (its small parts, the eyes, the teeth and the hair's cut-out cards,
    // cast no shadow: each part is a draw of its own, twice with one, and a
    // 2017 hero has up to thirteen; the body, the clothes and the cape do.
    // The cast, a crowd of five to nine parts a figure, casts its body's
    // alone: a world of thirty soldiers is otherwise a hundred draws more)
    const trisOf = (o) => (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    const body = cuts ? meshes.reduce((a, b) => (trisOf(b) > trisOf(a) ? b : a), meshes[0]) : null;
    for (const o of meshes) {
      o.userData.noShadow = cuts ? o !== body : trisOf(o) < 1500 || o.material?.alphaTest > 0;
      if (o.isSkinnedMesh) o.castShadow = !o.userData.noShadow;
    }
    return mats;
  };
  const owned = dress(model);
  const hips = model.getObjectByName('Hips');
  const fig = rigged(model, clips, spec.tall, owned, { seed: seedFor(spec.id ?? spec.src.url), key: spec.src.url, library: false });
  let gone = false;
  const own = fig.dispose;
  fig.dispose = () => {
    gone = true;
    own();
  };
  // (a cut onto the figure: the old one's materials freed and forgotten, the new one's kept to free)
  const swap = (gltf) => {
    if (gone || !gltf) return;
    const full = cloneScene(gltf);
    const mats = dress(full);
    const old = swapBody(model, full);
    if (!old.length) return mats.forEach((m) => m.dispose());
    for (const o of old)
      for (const m of [].concat(o.material)) {
        m.dispose();
        const i = owned.indexOf(m);
        if (i >= 0) owned.splice(i, 1);
      }
    owned.push(...mats);
  };
  if (next)
    loadGLTF(next)
      .then(swap)
      .catch(() => {}); // (the light cut stays: it was already a whole figure)
  const cutter = cuts ? createCutter({ url: spec.src.url, cuts, level, lowData, load: (u) => loadGLTF(u), swap }) : null;
  return Object.assign(fig, { rig: 'walrus', sockets, clips, hipsY: hips?.position.y ?? null, cutAt: cutter ? (d) => cutter.at(d) : null });
}

// A loaded Meshy figure (its scene, or a copy of one: `shared`, whose
// geometry and materials are the original's to free) rigged with Rick's
// clips, turned to walk the way it faces; `seed` and `key` as rigged's
export function rigScene(model, clips, tall, { shared = false, seed, key = null } = {}) {
  {
    const owned = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false; // a skinned mesh's bounds don't follow its pose
      if (shared) return;
      const m = o.material;
      if (m) {
        // Meshy's colours carry their own shading: keep them matte
        m.roughness = 0.85;
        m.metalness = 0;
        owned.push(m, m.map);
      }
      smoothNormals(o.geometry);
      owned.push(o.geometry);
    });
    const hips = model.getObjectByName('Hips');
    const hipsY = hips?.position.y ?? RICK_HIPS;
    const own = { idle: retarget(clips.idle, hipsY), walk: retarget(clips.walk, hipsY), run: retarget(clips.run, hipsY) };
    // (up, in the space the hips turn in: the library's clips are turned about it to face ahead too)
    const up = hips?.parent ? new V(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
    if (up && own.walk) {
      const ahead = headingOf(own.walk, up);
      if (ahead != null) for (const n of ['idle', 'run']) if (own[n]) faceForward(own[n], up, ahead);
    }
    // (the hips' height at rest goes with it, for the library's clips scaled to it)
    return Object.assign(rigged(model, own, tall, owned, { seed, key, up, hipsY: hips ? hipsY : null }), { hipsY: hips ? hipsY : null });
  }
}

// One figure per file, the rest copies of it: a battle's dozen troopers
// share one stormtrooper's geometry and maps (and the library's clips made
// for it), as the landings' troops share theirs. The first is rigged to
// keep the materials and smooth the normals; it's never drawn, and stays
// for the next world that wants one. (galaxy/surface/crew.js)
// (`from`: another such set of originals, url → Promise<{ scene, clips } |
// null>: a world whose copies are to take its own look, which goes onto the
// materials they share, keeps its own, as the map does its crews')
const sharedModels = new Map(); // url → Promise<{ scene, clips } | null>
// (the original, fetched and rigged the first time it's asked for)
export const templateIn = (models, url) => {
  if (!models.has(url))
    models.set(
      url,
      Promise.all([getLoader().loadAsync(url), borrowClips()]).then(
        ([gltf, clips]) => {
          rigScene(gltf.scene, clips, 1);
          return { scene: gltf.scene, clips };
        },
        () => {
          models.delete(url); // (a failed fetch is tried again next time)
          return null;
        },
      ),
    );
  return models.get(url);
};
export async function loadSharedFigure(url, tall, { seed, from = sharedModels } = {}) {
  const tpl = await templateIn(from, url);
  return tpl ? rigScene(cloneSkinned(tpl.scene), tpl.clips, tall, { shared: true, seed, key: url }) : null;
}

// ── The loaders that dress them ──

// The loaders a look goes through, on the wardrobe handed in (wear: its
// bodyAsset, bodyKind and dress); everything else they reach is the
// module's, the seeds and the shared models among it, whoever binds them.
export function figuresWith({ bodyAsset, bodyKind, dress }) {
  // (`templates`: a model of the site's as a copy of the one figure of it
  // kept there, loadSharedFigure's, rather than fetched and made afresh:
  // footScene's own, the map's alone)
  async function loadModel(spec, cast, looks = null, { templates = null } = {}) {
    if (spec.src.meshy) {
      const look = lookFor(spec.src.meshy, looks);
      // (the cast's figure reads its motion in metres: it's told how tall it stands)
      const opts = { tall: spec.tall, seed: seedFor(spec.id ?? spec.src.meshy) };
      let c = null;
      if (look) {
        const asset = bodyAsset(look);
        if (asset !== spec.src.meshy) await cast.load(null, [asset]).catch(() => {});
        c = cast.make(bodyKind(look), 0, opts);
      }
      c ??= cast.make(spec.src.meshy, 0, opts);
      if (!c) return null;
      // (on foot they carry a gun of their own, gunplay.js's: the look's
      // portal gun or laser pistol is that gun, held and fired; anything else
      // in the hand stays in the wardrobe)
      const gun = HAND_GUNS[look?.gear?.hand] ?? null;
      const undress = look ? dress(c, spec.gun ? { ...look, gear: { ...look.gear, hand: 'none' } } : look) : () => {};
      // the cast stands c.height tall in its own units: to metres, in map units
      c.group.scale.setScalar((spec.tall * METRE) / c.height);
      const k = c.group.scale.x; // (the cast's units, in the map's)
      const bones = {};
      c.group.traverse((o) => {
        if (o.isBone) bones[o.name] = o;
      });
      // The cast's own animator (one a figure: never a second over its
      // mixer), its motion's speeds in the cast's units and its crouch's drop
      // back in the map's.
      const anim = c.anim ?? null;
      const inCast = (m) => m && { ...m, speed: (m.speed ?? 0) / k, side: (m.side ?? 0) / k };
      return {
        model: c.group,
        bones,
        loco: anim && {
          get drop() {
            return anim.loco.drop * k;
          },
          rig: anim.loco.rig,
          strides: anim.loco.strides,
        },
        mixer: c.mixer ?? null,
        act: c.act ?? null,
        anim,
        update(dt, move, motion) {
          c.update(0, move, 0, { dt, motion: inCast(motion), after: false });
        },
        after: (dt, motion, frame) => c.after(dt, motion, frame),
        play: c.play,
        stop: c.stop,
        base: c.base,
        look: c.look,
        react: c.react,
        gun,
        // (its look off, and what the cast made for this one figure alone: the
        // cast itself lasts the page)
        dispose: () => {
          undress();
          c.release?.();
        },
      };
    }
    if (spec.rig === 'walrus' && spec.src.url) return walrusFigure(spec);
    if (spec.rig === 'own' && spec.src.url) return ownRigFigure(spec);
    if (spec.src.url && templates) return loadSharedFigure(spec.src.url, spec.tall, { seed: seedFor(spec.id ?? spec.src.url), from: templates });
    if (spec.src.url) {
      const [gltf, clips] = await Promise.all([getLoader().loadAsync(spec.src.url), borrowClips()]);
      return rigScene(gltf.scene, clips, spec.tall, { seed: seedFor(spec.id ?? spec.src.url), key: spec.src.url });
    }
    return built(spec);
  }

  // Walt and Jesse: the site’s own figures, loaded as anyone’s is (above),
  // in the body their look has (Mr. White and Heisenberg are Walt’s one
  // figure, Jesse in the lab’s suit his own) and dressed in it. They keep
  // their own guns, as the cruiser’s two do: a bag of blue in the hand stays
  // in the wardrobe. Anyone else is loaded as they were.
  async function loadParty(spec, cast, looks = null, { templates = null } = {}) {
    const look = spec.src.url ? lookFor(spec.id, looks) : null;
    if (!look) return loadModel(spec, cast, looks, { templates });
    const fig = await loadModel({ ...spec, src: { url: bodyAsset(look) } }, cast, looks, { templates });
    // (as the show has them, there’s nothing to put on)
    if (!fig?.model || JSON.stringify(writeLook(look)) === JSON.stringify(writeLook(defaultLook(spec.id)))) return fig;
    const undress = dress({ group: fig.model }, spec.gun ? { ...look, gear: { ...look.gear, hand: 'none' } } : look);
    const own = fig.dispose;
    fig.gun = HAND_GUNS[look.gear.hand] ?? null;
    fig.dispose = () => {
      undress();
      own?.();
    };
    return fig;
  }

  // the model a party member's figure is, where it's one of the site's (their
  // look's body: Heisenberg's is Walt's own figure, the lab suit Jesse's)
  const partyUrl = (spec, looks = null) => {
    if (!spec.src.url) return null;
    const look = lookFor(spec.id, looks);
    return look ? bodyAsset(look) : spec.src.url;
  };

  return { loadModel, loadParty, partyUrl };
}

// ── People built from shapes (no figure of their own) ──

// how each built person is dressed: Luke in his flight suit, Han in his
// shirt and vest, the Empire's troopers in white armour over black (a
// scout's mostly black), Jack's crew in flannel and jeans and a cap.
// harness: the vest cut short (a chest plate); closed: a helmet down over
// the face; gloves: the hands' colour
const LOOKS = {
  luke: { suit: '#e8742a', top: '#e8742a', legs: '#e8742a', boots: '#2a2622', skin: '#f0c7a5', hair: '#e9edf2', helmet: true, vest: '#f2f2ee', harness: true },
  han: { suit: '#f3f1ea', top: '#f3f1ea', legs: '#1d2a44', boots: '#2b1d14', skin: '#e9be98', hair: '#5a3a22', helmet: false, vest: '#151515' },
  stormtrooper: { suit: '#e9ebec', top: '#1c1d20', legs: '#e9ebec', boots: '#f1f2f3', skin: '#f1f2f3', gloves: '#1c1d20', hair: '#f4f5f6', helmet: true, closed: true, visor: '#101114', vest: '#f1f2f3', harness: true },
  scout: { suit: '#1c1d20', top: '#1c1d20', legs: '#1c1d20', boots: '#e9ebec', skin: '#f1f2f3', gloves: '#1c1d20', hair: '#f4f5f6', helmet: true, closed: true, visor: '#101114', vest: '#eceeef', harness: true },
  jackscrew: { suit: '#7a2a22', top: '#7a2a22', legs: '#3b4a63', boots: '#3a2b1c', skin: '#e2b48e', hair: '#3a2a1c', helmet: false, vest: '#5a1f1a', cap: '#2c2f33' },
};

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
// (a built figure has no clips to play or head to turn: its calls do nothing)
const UNPLAYED = { anim: null, play: NO_CALLS.play, stop: NO_CALLS.stop, base: NO_CALLS.base, look: NO_CALLS.look, react: NO_CALLS.react };
// how fast a built figure's going over the ground, in metres a second: its
// motion's (map units), else what `move` says of a run; + ahead, − back
const metresOf = (move, motion) => (motion ? Math.hypot(motion.speed ?? 0, motion.side ?? 0) * ((motion.speed ?? 0) < 0 ? -1 : 1) : move * FOOT.run) / METRE;

// Built from shapes, walking by the ground it covers (gait.js: the legs,
// Artoo's rock, never on the clock, so none marches on the spot or skates),
// breathing while it stands, each in its own time (its seed: its name and
// which it is)
export function built(spec) {
  const owned = [];
  const seed = seedFor(spec.id ?? spec.src.built);
  const r = seeded(seed);
  const mat = (c, extra) => {
    const m = std(c, extra);
    owned.push(m);
    return m;
  };
  const geo = (g) => {
    owned.push(g);
    return g;
  };
  const model = new THREE.Group();
  const s = spec.tall * METRE; // everything below in shares of their height
  if (spec.src.built === 'probe') {
    // an Imperial probe droid: a black ball with a red eye, hanging over the
    // ground on its repulsors, a skirt of thin legs dangling under it
    const black = mat('#18191c', { roughness: 0.45, metalness: 0.4 });
    const grey = mat('#5b5f66', { roughness: 0.5, metalness: 0.5 });
    const body = new THREE.Group();
    const ball = new THREE.Mesh(geo(new THREE.SphereGeometry(0.17, 18, 14)), black);
    body.add(ball);
    const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.06, 0.1, 0.08, 12)), grey);
    cap.position.y = 0.19;
    body.add(cap);
    for (let i = 0; i < 3; i++) {
      const eye = new THREE.Mesh(geo(new THREE.SphereGeometry(0.022, 8, 6)), mat('#111', { emissive: new THREE.Color('#ff2a1a'), emissiveIntensity: 2.5 }));
      const a = (i - 1) * 0.5;
      eye.position.set(Math.sin(a) * 0.16, 0.05, Math.cos(a) * 0.16);
      body.add(eye);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const leg = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.008, 0.012, 0.42, 5)), grey);
      leg.position.set(Math.sin(a) * 0.09, -0.32, Math.cos(a) * 0.09);
      leg.rotation.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18);
      body.add(leg);
    }
    body.position.y = 0.72;
    model.add(body);
    model.scale.setScalar(s / 0.95);
    let t = r() * 20; // (each one somewhere of its own in its drift)
    return {
      model,
      bones: {},
      hand: null,
      built: true,
      ...UNPLAYED,
      update(dt) {
        t += dt;
        body.position.y = 0.72 + Math.sin(t * 1.6) * 0.03; // (hanging, never still)
        body.rotation.y = Math.sin(t * 0.5) * 0.8;
      },
      dispose() {
        for (const o of owned) o.dispose();
      },
    };
  }
  if (spec.src.built === 'artoo') {
    // a white barrel with blue panels, a silver dome, a leg each side and a third under him
    const white = mat('#e9edf2');
    const blue = mat('#2f62c9');
    const silver = mat('#c9ced6', { metalness: 0.6, roughness: 0.35 });
    const body = new THREE.Group();
    const barrel = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.2, 0.19, 0.5, 20)), white);
    barrel.position.y = 0.55;
    body.add(barrel);
    for (const [a, h] of [
      [0, 0.12],
      [0.5, 0.2],
      [-0.6, 0.16],
    ]) {
      const p = new THREE.Mesh(geo(new THREE.BoxGeometry(0.08, h, 0.02)), blue);
      p.position.set(Math.sin(a) * 0.2, 0.55 + (h - 0.15) * 0.3, Math.cos(a) * 0.2);
      p.rotation.y = a;
      body.add(p);
    }
    const dome = new THREE.Mesh(geo(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), silver);
    dome.position.y = 0.8;
    body.add(dome);
    const eye = new THREE.Mesh(geo(new THREE.SphereGeometry(0.035, 10, 8)), mat('#111', { emissive: new THREE.Color('#ff3030'), emissiveIntensity: 2 }));
    eye.position.set(0, 0.9, 0.17);
    body.add(eye);
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 0.62, 0.12)), white);
      leg.position.set(x, 0.38, -0.02);
      leg.rotation.x = 0.12;
      model.add(leg);
      const foot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.06, 0.2)), blue);
      foot.position.set(x, 0.03, 0.02);
      model.add(foot);
    }
    model.add(body);
    model.scale.setScalar(s / 0.98);
    let t = r() * 20;
    // (a rock from foot to foot every half metre he rolls)
    const gait = createGait({ stride: 0.5, cadence: [2, 4], seed });
    return {
      model,
      bones: {},
      hand: null,
      ...UNPLAYED,
      update(dt, move, motion) {
        t += dt;
        const g = gait.step(dt, metresOf(move, motion));
        body.rotation.z = Math.sin(g.phase) * 0.05 * g.amount; // he rocks as he rolls
        dome.rotation.y = Math.sin(t * 0.7) * 0.9;
      },
      dispose() {
        for (const o of owned) o.dispose();
      },
    };
  }
  // a person: legs, a body, arms that swing, a head; the groups named as
  // Meshy's bones are (Spine, Head, RightArm, RightForeArm, RightHand…) so
  // gunplay.js poses them the same way
  const look = LOOKS[spec.src.built] ?? LOOKS.han;
  const limb = (r, l, m) => {
    const g = geo(new THREE.CapsuleGeometry(r, l, 4, 10));
    g.translate(0, -l / 2 - r * 0.5, 0); // hangs from its joint
    return new THREE.Mesh(g, m);
  };
  const legs = [];
  for (const x of [-0.075, 0.075]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.52, 0);
    const thigh = limb(0.055, 0.2, mat(look.legs));
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.26;
    const shin = limb(0.048, 0.2, mat(look.legs));
    knee.add(shin);
    const boot = new THREE.Mesh(geo(new THREE.BoxGeometry(0.1, 0.07, 0.17)), mat(look.boots));
    boot.position.set(0, -0.26, 0.03);
    knee.add(boot);
    hip.add(knee);
    model.add(hip);
    legs.push({ hip, knee });
  }
  // the upper body turns at the waist
  const WAIST = 0.58;
  const spine = new THREE.Group();
  spine.name = 'Spine';
  spine.position.y = WAIST;
  model.add(spine);
  const torso = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.13, 0.22, 4, 12)), mat(look.top));
  torso.position.y = 0.72 - WAIST;
  torso.scale.set(1, 1, 0.72);
  spine.add(torso);
  const vest = new THREE.Mesh(geo(new THREE.CapsuleGeometry(0.135, 0.16, 4, 12)), mat(look.vest));
  vest.position.y = 0.75 - WAIST;
  vest.scale.set(1.02, 1, 0.76);
  if (look.harness) vest.scale.set(1.03, 0.75, 0.77); // a short vest over the suit: Luke's harness, a trooper's chest plate
  spine.add(vest);
  const headG = new THREE.Group();
  headG.name = 'Head';
  headG.position.y = 0.99 - WAIST;
  spine.add(headG);
  const head = new THREE.Mesh(geo(new THREE.SphereGeometry(0.095, 16, 12)), mat(look.closed ? look.hair : look.skin));
  headG.add(head);
  const hair = new THREE.Mesh(geo(new THREE.SphereGeometry(look.helmet ? 0.112 : 0.1, 16, 10, 0, Math.PI * 2, 0, look.helmet ? Math.PI * 0.62 : Math.PI * 0.45)), mat(look.hair, look.helmet ? { roughness: 0.4 } : {}));
  hair.position.set(0, 0.01, look.helmet ? 0 : -0.012);
  headG.add(hair);
  if (look.helmet) {
    const visor = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.035, 0.03)), mat(look.visor ?? '#2a3340', { roughness: 0.2, metalness: 0.5 }));
    visor.position.set(0, 0.06, 0.1);
    headG.add(visor);
    // a trooper's helmet comes down over the face, with its jaw and its vents
    if (look.closed) {
      const jaw = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.07, 0.07)), mat(look.hair, { roughness: 0.4 }));
      jaw.position.set(0, -0.045, 0.07);
      headG.add(jaw);
      const grille = new THREE.Mesh(geo(new THREE.BoxGeometry(0.07, 0.025, 0.012)), mat('#1a1b1e'));
      grille.position.set(0, -0.05, 0.108);
      headG.add(grille);
    }
  }
  // a cap (Jack's crew)
  if (look.cap) {
    const cap = new THREE.Mesh(geo(new THREE.CylinderGeometry(0.1, 0.104, 0.05, 14)), mat(look.cap));
    cap.position.set(0, 0.07, 0);
    headG.add(cap);
    const peak = new THREE.Mesh(geo(new THREE.BoxGeometry(0.15, 0.012, 0.08)), mat(look.cap));
    peak.position.set(0, 0.05, 0.1);
    headG.add(peak);
  }
  const arms = [];
  for (const [x, side] of [
    [-0.165, 'Right'], // (facing +z, the figure's right is −x)
    [0.165, 'Left'],
  ]) {
    const shoulder = new THREE.Group();
    shoulder.name = `${side}Arm`;
    shoulder.position.set(x, 0.9 - WAIST, 0);
    shoulder.add(limb(0.042, 0.17, mat(look.suit)));
    const elbow = new THREE.Group();
    elbow.name = `${side}ForeArm`;
    elbow.position.y = -0.23;
    elbow.add(limb(0.038, 0.15, mat(look.suit)));
    const wrist = new THREE.Group();
    wrist.name = `${side}Hand`;
    wrist.position.y = -0.19;
    const hand = new THREE.Mesh(geo(new THREE.SphereGeometry(0.04, 10, 8)), mat(look.gloves ?? look.skin));
    hand.position.y = -0.03;
    wrist.add(hand);
    elbow.add(wrist);
    shoulder.add(elbow);
    spine.add(shoulder);
    arms.push({ shoulder, elbow, wrist, hand });
  }
  model.scale.setScalar(s / 1.1);
  const bones = { Hips: model, Spine: spine, Head: headG, RightArm: arms[0].shoulder, RightForeArm: arms[0].elbow, RightHand: arms[0].wrist, LeftArm: arms[1].shoulder, LeftForeArm: arms[1].elbow, LeftHand: arms[1].wrist };
  // A stride of three quarters its height, its legs swung just far enough
  // that the foot that's down goes back under it as fast as it goes over
  // the ground (a leg `leg` metres long swung ±amp covers 2·leg·sin(amp) a
  // step, two steps a stride), so its feet never skate
  const leg = (0.52 / 1.1) * spec.tall;
  const stride = 0.75 * spec.tall;
  const amp = Math.asin(Math.min(0.9, stride / (4 * leg)));
  const gait = createGait({ stride, cadence: [1.4, 2.4], seed });
  let t = r() * 20;
  return {
    model,
    bones,
    built: true,
    ...UNPLAYED,
    // the right hand
    hand: arms[0].hand,
    update(dt, move, motion) {
      t += dt;
      const g = gait.step(dt, metresOf(move, motion));
      const swing = Math.sin(g.phase) * amp * g.amount;
      const bend = 0.5 + 0.4 * g.run;
      // (every turn set whole, each frame: gunplay.js and locomotion.js turn
      // these groups too, and a turn left over would add up)
      legs[0].hip.rotation.set(swing, 0, 0);
      legs[1].hip.rotation.set(-swing, 0, 0);
      legs[0].knee.rotation.set(Math.max(0, -Math.sin(g.phase + 0.6)) * bend * g.amount, 0, 0);
      legs[1].knee.rotation.set(Math.max(0, Math.sin(g.phase + 0.6)) * bend * g.amount, 0, 0);
      spine.rotation.set(0, 0, 0);
      headG.rotation.set(0, 0, 0);
      // the arms swing against the legs (gunplay.js brings the gun arm up over this)
      arms[0].shoulder.rotation.set(-swing * 0.8, 0, 0);
      arms[1].shoulder.rotation.set(swing * 0.8, 0, 0);
      arms[0].elbow.rotation.set(-0.25, 0, 0);
      arms[1].elbow.rotation.set(-0.25, 0, 0);
      arms[0].wrist.rotation.set(0, 0, 0);
      arms[1].wrist.rotation.set(0, 0, 0);
      // up over each foot as it walks; a breath as it stands
      torso.position.y = 0.72 - WAIST + sway(g.phase, g.amount).bob * 0.012 + breathe(t, seed) * 0.004 * (1 - g.amount);
    },
    dispose() {
      for (const o of owned) o.dispose();
    },
  };
}
