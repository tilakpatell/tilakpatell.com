// The people of the worlds made with Meshy (scripts/meshy-galaxy.mjs:
// public/models/galaxy/crew/), each rigged on a humanoid skeleton and
// walked with Rick's clips, borrowed (universe/footScene.js's
// loadPartyFigure), on an animator of its own (lib/three/animator.js);
// Jabba lies still, as he was made, breathing. A figure kind with one of
// these is that model; one without is built (figures.js).
//
// crewFigure(kind, i) → { model (in metres), tall, anim, update(dt, move,
// motion?), play, stop, base, look, react, dispose } or null (i: which of a
// life entry's figures, for a kind with other faces, and its clocks')
//   update: once it's placed (where it stands and which way it faces this
//   frame). motion: how it's moving, in metres a second (speed along its
//   facing, side to its right, turn to its left, as lib/ai/body.js's
//   bodyFrom gives it): its feet paced to the ground it covers, its hips
//   turned to a sidestep, leaning into its turns. Without, its clips go at
//   `move`'s old pace. Either way the clips played over its walk (a wave, a
//   drink, a scared step back) and its head's look are laid on.
//   cutAt(distance): a full-fidelity 2017 kind's cut kept to its distance
//   (null on the others)
//   play, stop, base, look, react: the animator's (meshyCast.js's
//   animatorCalls: the clip library's clips, on the Meshy skeleton these
//   all stand on); on Jabba they do nothing.

import * as THREE from 'three';
import { loadPartyFigure, loadSharedFigure } from '../../universe/footScene';
import { METRE } from '../../universe/foot';
import { breathe } from '../../../lib/three/gait';
import { NO_CALLS, seedOf } from '../../../lib/three/figureCalls';
import { EVERYONE } from '../../rickmorty/wardrobe/looks';
import { CREW, cutsOf, faceOf, figureLoaderFor, fileOf } from './crewList';
import { cloneModel, loadGlb } from './placer';

// (the list itself is crewList.js, plain data a page can read)
export { CREW, figureLoaderFor, fileOf };

// (the wardrobe's people come dressed as kept, each their own figure;
// anyone else is a copy of their file's one: a battle's troopers share theirs)
const DRESSED = new Set(EVERYONE);

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();

// a kind its loader refuses (an own rig whose pack isn't built yet): skipped,
// with one line for the kind
const said = new Set();
const refused = (kind, e) => {
  if (!said.has(kind)) {
    said.add(kind);
    console.warn(`[surface] ${kind} skipped: ${e?.message ?? e}`);
  }
  return null;
};

export async function crewFigure(kind, i = 0) {
  if (!CREW[kind]) return null;
  const c = faceOf(CREW[kind], i);
  const seed = seedOf(kind, i);
  if (c.still) {
    const gltf = await loadGlb(fileOf(c));
    if (!gltf) return null;
    const model = cloneModel(gltf);
    const body = new THREE.Group();
    body.add(model);
    let t = 0;
    return {
      model: body,
      tall: c.tall,
      anim: null,
      // (breathing, at a pace and a place in it of its own)
      update(dt) {
        t += dt;
        const b = breathe(t, seed);
        model.scale.set(1 + b * 0.012, 1 + b * 0.018, 1);
      },
      ...NO_CALLS,
      dispose() {},
    };
  }
  const how = figureLoaderFor(c, DRESSED.has(kind));
  const fig =
    how === 'shared'
      ? await loadSharedFigure(fileOf(c), c.tall, { seed }).catch(() => null)
      : await loadPartyFigure({ id: kind, name: kind, tall: c.tall, src: { url: fileOf(c) }, rig: c.rig, pack: c.pack, ownRig: c.ownRig, bones: c.bones, cuts: cutsOf(c) }, null).catch((e) => refused(kind, e));
  if (!fig) return null;
  const model = new THREE.Group();
  model.scale.setScalar(1 / METRE);
  model.add(fig.model);
  model.traverse((o) => {
    if (o.isMesh) o.castShadow = !o.userData.noShadow; // (a 2017 figure's small parts: none)
  });
  const forward = new THREE.Vector3();
  return {
    model,
    tall: c.tall,
    anim: fig.anim ?? null,
    // (its bones by name: a rider's limbs are put on what it rides, riders.js)
    bones: fig.bones ?? null,
    // (a 2017 figure's: the game's skeleton, its sockets and its clips, for the saber and the gun)
    rig: fig.rig ?? null,
    sockets: fig.sockets ?? null,
    // (a 2017 figure's weapon stance: lib/three/walrusStance.js)
    stance: fig.stance ?? null,
    // (and its chest aimed by the game's additive aims: footScene's rigged)
    aimAt: fig.aimAt ?? null,
    // (a droid's or a beast's own skeleton, by the game's name: its hit capsules)
    skeleton: fig.skeleton ?? null,
    clips: fig.clips ?? null,
    update(dt, move, motion = null) {
      // (the figure reads its motion in the units it stands in, under this
      // group: metres over the group's scale, which is the map's units over
      // the caller's own scale)
      const k = model.scale.x || 1 / METRE;
      const m = motion ? { ...motion, speed: (motion.speed ?? 0) / k, side: (motion.side ?? 0) / k } : null;
      // (the far ones are stepped four frames' worth at once: in tenths,
      // the most the animator takes at a time, up to four)
      for (let left = Math.min(dt, 0.4); left > 1e-6; left -= 0.1) {
        if (m) fig.update(Math.min(0.1, left), move, m);
        else fig.update(Math.min(0.1, left), move);
      }
      // its bones over the clips, which way it faces as it's placed
      model.getWorldQuaternion(_q);
      forward.set(0, 0, 1).applyQuaternion(_q);
      fig.after?.(dt, m, { forward, up: UP });
    },
    play: fig.play ?? NO_CALLS.play,
    stop: fig.stop ?? NO_CALLS.stop,
    base: fig.base ?? NO_CALLS.base,
    look: fig.look ?? NO_CALLS.look,
    react: fig.react ?? NO_CALLS.react,
    // (a kind at full fidelity: told how far it is from the eye, it draws
    // the cut that distance wants, lib/three/walrusCuts.js; nothing on others)
    cutAt: fig.cutAt ?? null,
    dispose: () => fig.dispose(),
  };
}
