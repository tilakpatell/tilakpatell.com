// A figure on a rig of its own: a game model whose skeleton is not a
// person's (Star Wars Battlefront II (2017)'s walkers and droids: the
// AT-AT's twelve-jointed legs, the droideka's three), played by the game's
// own clips for that skeleton, packed per rig (scripts/bf2017-rigclips.mjs,
// public/models/galaxy/bf2017/clips-<rig>.glb) and named for the site by
// ./rigSets.js. Nothing is retargeted and no bone renamed: a clip's tracks
// name the game's bones and the body has them all. rig.js's roles and
// legRig.js's stepping don't apply; the feet are planted by the clip, its
// rate matched to the ground the figure covers (the clip's `travel`, metres
// a cycle) so they stay planted at any pace.
//
// loadOwnRigFigure(url, { rig, tall, packs, bones: { root, feet }, load,
//   loadPack }) → a figure in the shape crew.js's are (model, tall, anim,
//   bones, play, stop, base, update(dt, move, motion?), look, react,
//   dispose), with rig: 'own'. It rejects, naming it, when the body hasn't
//   the root bone the row says it hangs from.
//   update: motion's speed (metres a second along its facing, as
//     lib/ai/body.js gives it) picks the walk, the walk back or the idle and
//     paces the walk; without it `move` (0 to 1) does, at the walk's own pace.
//   play(name, { loop }): one of the rig's clips by its site name (or the
//     game's); resolves true when a one-shot ends, false when there's none.
//   base(name): the clip it rests in instead of its idle ('cut' for none).
//   react('down', { cable, side }) → { clip }: its death (./rigSets.js
//     deathFor), held on the last frame (activity.js reads the clip);
//     react('fire') → whether it played the rig's own shot; react('hit') its
//     stagger where it has one.
// clipsFor(clips, has) → the clips with only the tracks for bones it has
// pickBase(motion, move, set) → the site name its legs should be playing
// paceOf(speed, clip) → the clip's rate for that speed (1 without a travel)
//
// Beside that whole figure (lane V's walkers, walkers.js), a body alone for
// the crew's droids and beasts (phase 2: the B2, the Ewok, the astromechs,
// the probe, the tauntaun; crewList.js's `rig: 'own'` rows), which
// footScene's figure animator moves as it does a person, on the game's
// clips for that rig (walrusClips.js's OWN_RIGS, their packs by
// scripts/bf2017-clips.mjs <rig> under the site's names):
//
// ownPackUrl(rig) → '/models/galaxy/bf2017/clips-<rig>.glb'
// loadOwnRigBody(url, { rig, packs?, bones?, loader? })
//   → Promise<{ model, clips: { name: AnimationClip }, bones: { hips, head,
//      … rig.js's roles }, rig }>: a copy of the file's scene, its pack's
//   clips filtered to it (walrus.js's clipsFor), its bones by rig.js's
//   findBones with the row's `bones` ({ role: boneName }) over its guesses.
//   Refuses, naming them, a body without a bone the row names, a statue,
//   and a rig with no pack. A rig is either a walker's (rigSets.js's RIGS,
//   the figure above) or a crew kind's (OWN_RIGS), never both: the droideka
//   is the walkers'.

import * as THREE from 'three';
import { NO_CALLS } from './figureCalls';
import { loadGltf } from './gltf';
import { RIGS, RIG_SET, clipFor, deathFor } from './rigSets';
import { cloneScene, loadGLTF } from './gltfCache';
import { findBones } from './rig';
import { PACK_DIR, clipsFor as walrusClipsFor, loadWalrusPacks } from './walrus';
import { OWN_RIGS } from './walrusClips';

const boneOf = (track) => track.name.slice(0, track.name.lastIndexOf('.'));

export function clipsFor(clips, has) {
  return clips.map((c) => {
    const tracks = c.tracks.filter((t) => has(boneOf(t)));
    const out = new THREE.AnimationClip(c.name, c.duration, tracks);
    out.userData = { ...(c.userData ?? {}) };
    return out;
  });
}

const STILL = 0.05; // metres a second: slower is standing

export function pickBase(motion, move, set) {
  const speed = motion ? (motion.speed ?? 0) : move;
  if (speed < -STILL && set['walk.back']) return 'walk.back';
  if (Math.abs(speed) > STILL) return 'walk';
  return 'idle';
}

export function paceOf(speed, clip) {
  const travel = clip?.userData?.travel ?? 0;
  const duration = clip?.userData?.duration ?? clip?.duration ?? 0;
  if (!travel || !duration) return 1;
  // (a walker urged past its clip's pace strides quicker, up to twice it, and
  // never so slowly the clip stops: its weight still shifts)
  return Math.min(2, Math.max(0.25, Math.abs(speed) / (travel / duration)));
}

const defaultLoad = (url) => loadGltf(url, { fresh: true });
const defaultPack = (url) => loadGltf(url);

export async function loadOwnRigFigure(url, { rig, tall = null, packs = [], bones = {}, load = defaultLoad, loadPack = defaultPack } = {}) {
  const spec = RIGS[rig] ?? null;
  const rootName = bones.root ?? spec?.root ?? 'Hips';
  const feet = bones.feet ?? spec?.feet ?? [];
  const [gltf, ...loaded] = await Promise.all([load(url), ...packs.map((p) => loadPack(p))]);
  if (!gltf?.scene) throw new Error(`${url}: no model`);
  const scene = gltf.scene;
  const named = new Map();
  scene.traverse((o) => {
    if (o.name && !named.has(o.name)) named.set(o.name, o);
  });
  if (!named.has(rootName)) throw new Error(`${url}: no ${rootName} bone, which ${rig ?? 'its row'} hangs from`);
  const set = spec?.set ?? {};
  const additive = new Set(spec?.additive ?? []);
  // the game's clips by the game's names (the model's own first, then each pack's)
  const all = clipsFor([...(gltf.animations ?? []), ...loaded.flatMap((p) => p?.animations ?? [])], (b) => named.has(b));
  const byGame = new Map(all.map((c) => [c.name, c]));
  const site = (name) => (byGame.has(name) ? name : clipFor(rig, name));
  const clipOf = (name) => byGame.get(site(name)) ?? null;
  for (const name of additive) {
    const c = clipOf(name);
    if (c) c.blendMode = THREE.AdditiveAnimationBlendMode;
  }

  const model = new THREE.Group();
  model.name = `own-${rig ?? 'rig'}`;
  model.add(scene);
  scene.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const box = new THREE.Box3().setFromObject(model);
  const mixer = new THREE.AnimationMixer(scene);
  const actions = new Map();
  const actionOf = (clip) => {
    if (!actions.has(clip)) {
      const a = mixer.clipAction(clip);
      if (clip.blendMode === THREE.AdditiveAnimationBlendMode) a.blendMode = THREE.AdditiveAnimationBlendMode;
      actions.set(clip, a);
    }
    return actions.get(clip);
  };
  const st = {
    base: null,
    baseName: null,
    rest: null,
    over: null,
    down: false,
    speed: 0,
  };
  const FADE = 0.35;

  function toBase(name) {
    const clip = clipOf(name);
    if (!clip || st.base === clip) return Boolean(clip);
    const a = actionOf(clip);
    a.reset().setLoop(THREE.LoopRepeat, Infinity).setEffectiveWeight(1);
    if (st.base) a.crossFadeFrom(actionOf(st.base), FADE, false);
    a.play();
    st.base = clip;
    st.baseName = name;
    return true;
  }

  // a one-shot over the legs (a death, a stagger, a landing): resolves when it ends
  function oneShot(name, { hold = false } = {}) {
    const clip = clipOf(name);
    if (!clip) return Promise.resolve(false);
    const a = actionOf(clip);
    a.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(1);
    a.clampWhenFinished = hold;
    if (clip.blendMode !== THREE.AdditiveAnimationBlendMode && st.base) a.crossFadeFrom(actionOf(st.base), 0.2, false);
    a.play();
    if (clip.blendMode !== THREE.AdditiveAnimationBlendMode) st.over = clip;
    return new Promise((done) => {
      const finished = (e) => {
        if (e.action !== a) return;
        mixer.removeEventListener('finished', finished);
        if (st.over === clip && !hold) {
          st.over = null;
          // (back to whatever it was walking or standing in)
          const back = st.base;
          st.base = null;
          if (back) toBase(st.baseName);
          a.fadeOut(0.2);
        }
        done(true);
      };
      mixer.addEventListener('finished', finished);
    });
  }

  toBase('idle');
  const calls = {
    play(name, { loop = false } = {}) {
      if (st.down) return Promise.resolve(false);
      if (loop) return Promise.resolve(toBase(name));
      return oneShot(name);
    },
    stop(name) {
      const clip = clipOf(name);
      if (clip && actions.has(clip)) actions.get(clip).fadeOut(0.2);
      if (clip && st.over === clip) st.over = null;
    },
    base(name) {
      st.rest = name ?? null;
      return Promise.resolve(name && clipOf(name) ? 'ok' : 'cut');
    },
    look: NO_CALLS.look,
    react(kind, opts = {}) {
      if (st.down) return null;
      if (kind === 'down') {
        st.down = true;
        const name = deathFor(rig, opts);
        oneShot(name, { hold: true });
        return { clip: name };
      }
      // (a shot: the game's own where the rig has one, laid over the legs for
      // the droideka's recoil, the AT-TE's big gun's loop; true when it played)
      if (kind === 'fire') {
        if (!clipOf('fire') || RIG_SET(rig)?.fire == null) return false;
        oneShot('fire');
        return true;
      }
      if (kind === 'hit') {
        const name = clipOf('stagger.front') ? 'stagger.front' : null;
        if (name) oneShot(name);
        return name;
      }
      return null;
    },
  };

  return {
    model,
    tall: tall ?? box.max.y - box.min.y,
    rig: 'own',
    anim: { mixer, clips: all, names: Object.keys(set) },
    // (its bones by the game's names: a rider or a gun is hung on one)
    bones: Object.fromEntries([...named].filter(([, o]) => o.isBone)),
    feet,
    update(dt, move = 0, motion = null) {
      if (!st.down && !st.over) {
        const want = pickBase(motion, move, set);
        const name = want === 'idle' && st.rest ? st.rest : want;
        toBase(clipOf(name) ? name : 'idle');
        const speed = motion ? (motion.speed ?? 0) : move * ((st.base?.userData?.travel ?? 0) / (st.base?.userData?.duration || 1));
        actionOf(st.base).timeScale = want === 'idle' ? 1 : paceOf(speed, st.base);
      }
      mixer.update(dt);
    },
    ...calls,
    dispose() {
      mixer.stopAllAction();
      for (const clip of actions.keys()) mixer.uncacheClip(clip);
      mixer.uncacheRoot(scene);
    },
  };
}

// ── a crew kind's body on its own rig (phase 2) ──

export const ownPackUrl = (rig) => `${PACK_DIR}/clips-${rig}.glb`;

export async function loadOwnRigBody(url, { rig, packs: given, bones: named = {}, loader } = {}) {
  // (a rig may hand its packs in; one of OWN_RIGS has its own)
  const packs = given ?? (OWN_RIGS[rig] ? [ownPackUrl(rig)] : []);
  if (!packs.length) throw new Error(`${url}: no pack for the rig ${rig} (walrusClips.js's OWN_RIGS)`);
  const [gltf, clips] = await Promise.all([loadGLTF(url, { loader }), loadWalrusPacks(packs, { loader })]);
  if (!gltf) throw new Error(`${url}: no model`);
  const model = cloneScene(gltf);
  const names = new Set();
  let boneCount = 0;
  model.traverse((o) => {
    if (o.name) names.add(o.name);
    if (o.isBone) boneCount++;
  });
  const lacks = Object.values(named).filter((n) => !names.has(n));
  if (lacks.length) throw new Error(`${url} lacks the bones its row names: ${lacks.join(', ')}`);
  if (!boneCount) throw new Error(`${url} has no skeleton: a statue is the catalogue's, not this loader's`);
  // (its pack not built or not there yet: refused, so the kind is skipped
  // as a pooled one is, rather than stood in its bind pose)
  const own = walrusClipsFor(model, clips);
  if (!Object.keys(own).length) throw new Error(`${url}: no clips for the rig ${rig} (is ${packs.join(', ')} built?)`);
  return { model, clips: own, bones: findBones(model, named).bones, rig };
}
