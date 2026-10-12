// A soldier entity drawn as a 2017 trooper on the game's skeleton (phase 1's
// walrus loader, phase 2's bodies), moved by the game's clips (the humanoid
// pack: the game's own clips under the site's names) as locomotion.js says
// from what the sim says. One figure an entity, made when it first appears
// in the view and freed when it leaves; placed between the sim's last two
// steps by `alpha`.
//
// The walk is the game's blend (locomotion.js's locoBlend, from bf2-re's
// finding 24): on the move every loco clip the pack has is an action on
// the mixer, the two nearest directions weighted by the velocity's angle
// against the facing, the gaits by speed between the clips' own paces, all
// of them slaved to one stride phase (each clip's timeScale is the phase's
// rate times its own stride period, measured on the body by stride.js, and
// each starts at its own offset), so a change of direction or gait moves
// weights and never cuts a clip; the weights ease over CROSSFADE. The
// pack's clips play in place while the sim moves the body, and the phase
// runs at the body's speed over the blend's pace (rateFor), so the feet
// stay on the ground the body crosses. Standing, falling, rolling and dying
// are one clip at a time, eased in the same way.
//
// Bodies: Hoth's Galactic Assault puts the Empire (team 2, the attackers:
// maps/hoth.stages.json) in snowtroopers and the Rebels (team 1) in Hoth
// troopers, phase 2's light cuts (public/models/galaxy/bf2017/crew/), every
// class alike until the class kits' own bodies are imported.
//
// Each holds its class weapon (held.js: the game's mesh at Wep_Root, the
// view's `weapon` id) and stands in that weapon's stance (the stance pack
// its record names, laid over the humanoid's as `stance.<key>.<name>`;
// locomotion.js's packClip picks them, a held pose till the pack lands), the
// body turned to the sim's facing (facing.js).
//
// The fallen: with `ragdolls` (ragdolls.js) a soldier dying or down is
// offered to them with how it fell (the view's `fall`) and the camera's
// place (`eye`); once they have the body this stops placing and animating
// it, and lets it go when the sim takes the soldier away or it stands again.
// A body they refuse plays its death clip as before. The gun leaves the
// hand once they have the body (no figure to hold it, no muzzle to fire
// from), and comes back with the view's `weapon` if it stands again.
//
//   createFigures({ scene, loadBody, kinds, held, loadStance, ragdolls }) →
//     { update(entities, dt, alpha, eye), figure(id), muzzleOf(id, out), count(), dispose() }

import * as THREE from 'three';
import { clipsFor, loadWalrusBody, loadWalrusPacks, packUrls, PACK_DIR } from '../../../lib/three/walrus.js';
import { resolveClip } from '../../../lib/three/walrusRig.js';
import { stancePackUrl } from '../../../lib/three/walrusStance.js';
import { stanceClips } from '../../../lib/three/walrusSets/stance.js';
import { faceAlongZ } from './facing.js';
import { createHeld, heldOf } from './held.js';
import { CROSSFADE, LOCO_STATES, clipSpeed, locoBlend, locoClips, packClip, packFallback, relAngle, stateFor, timeAt } from './locomotion.js';
import { strideOf } from './stride.js';

export const SIDE_OF_TEAM = { 1: 'light', 2: 'dark' };
export const KINDS = { dark: 'snowtrooper', light: 'hothtrooper' };
export const bodyUrl = (kind) => `${PACK_DIR}/crew/${kind}.lod1.glb`;
const ONCE = new Set(['die.fwd', 'die.back', 'die', 'dodge.front', 'hit.chest', 'crouch']);

// A figure's parts are culled by one sphere round the whole body, as the
// game culls a soldier by its bounds. three's own bound of a skinned part
// is its bind pose (a glove's, which the arm swings out of), so the parts
// were drawn unculled: every figure into every pass, on screen or not (17
// soldiers were 126 draws in each cascade and the view, more than the
// level). The clips play in place while the sim moves the body, so a
// sphere of the whole body's bind pose, half as big again and never under
// BODY_REACH, holds every pose, a fallen one too.
export const BODY_REACH = 2.5;
export const BODY_MIDDLE = [0, 1, 0]; // m above the body's feet, in the body's own frame
const _at = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _inv = new THREE.Matrix4();
export function cullBy(model) {
  const parts = [];
  model.traverse((o) => o.isSkinnedMesh && parts.push(o));
  if (!parts.length) return null;
  // (the one sphere, the body's middle at BODY_REACH, carried into each
  // part's own frame: a part's node may sit off the body's root, or in
  // centimetres, and three tests a part's sphere through that node)
  model.updateMatrixWorld(true);
  const middle = _at.fromArray(BODY_MIDDLE).applyMatrix4(model.matrixWorld);
  const whole = new THREE.Sphere(middle.clone(), BODY_REACH * (model.getWorldScale(_scale).x || 1));
  for (const o of parts) {
    _inv.copy(o.matrixWorld).invert();
    const k = o.getWorldScale(_scale).x || 1;
    o.boundingSphere = new THREE.Sphere(whole.center.clone().applyMatrix4(_inv), whole.radius / k);
    o.frustumCulled = true;
  }
  return whole;
}

const lerp = (a, b, t) => a + (b - a) * t;
const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
};

const loadStancePack = (key) => loadWalrusPacks([stancePackUrl(key)]);
const DEAD = new Set(['dying', 'down']);

export function createFigures({ scene, loadBody = (url) => loadWalrusBody(url, { packs: packUrls() }), kinds = KINDS, held = createHeld(), loadStance = loadStancePack, ragdolls = null } = {}) {
  const root = new THREE.Group();
  root.name = 'figures';
  scene.add(root);
  const figs = new Map(); // id → { model, mixer, actions, clip, prev: { at, yaw }, cur }
  let gone = false;

  function make(e) {
    // (actions: every clip played so far; weights: each one's, eased;
    // loco: the names on the stride phase; phase in strides; walking: on
    // the move last frame, so a start seats every loco action at the phase)
    const f = { model: null, mixer: null, clips: null, sockets: null, actions: new Map(), weights: new Map(), speeds: new Map(), loco: new Set(), rings: null, ringsKey: null, phase: 0, walking: false, clip: null, last: null, cur: null, weapon: null, stance: null };
    figs.set(e.id, f);
    const kind = kinds[SIDE_OF_TEAM[e.team]] ?? kinds.dark;
    loadBody(bodyUrl(kind))
      .then(({ model, clips, sockets }) => {
        if (gone || !figs.has(e.id)) return;
        faceAlongZ(model);
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        cullBy(model);
        f.model = model;
        f.clips = clips;
        f.sockets = sockets ?? null;
        f.mixer = new THREE.AnimationMixer(model);
        root.add(model);
      })
      .catch((err) => {
        if (import.meta.env?.DEV) console.warn('figure failed', kind, err);
      });
    return f;
  }

  // the weapon the view says it holds, and that weapon's stance
  function arm(f, id) {
    if (f.weapon === id) return;
    f.weapon = id;
    if (!id) {
      held.disarm(f);
      f.stance = null;
      return;
    }
    held.arm(f, id);
    const key = heldOf(id)?.stance ?? null;
    f.stance = key;
    if (!key || f.clips[`stance.${key}.idle`]) return;
    Promise.resolve(loadStance(key))
      .then((got) => {
        if (gone || !f.model || !got?.size) return;
        // (bound to this body with the humanoid's, so each has the other's rest)
        const both = clipsFor(f.model, new Map([...Object.entries(f.clips), ...got]));
        for (const [name, c] of Object.entries(stanceClips(both, key))) f.clips[`stance.${key}.${name}`] ??= c;
      })
      .catch(() => {});
  }

  // (the clip's own pace read once: the clip does not change, the speed does)
  const paceOf = (f, clip) => {
    if (!f.speeds.has(clip)) f.speeds.set(clip, clipSpeed(f.clips[clip]));
    return f.speeds.get(clip);
  };

  // a clip's pace and its stride's period, for the blend
  const infoOf = (f, name) => ({ pace: paceOf(f, name), period: strideOf(f.model, name, f.clips[name])?.period ?? f.clips[name].duration });

  // the rings a stance plays on this body, kept while its clips are the same
  function ringsOf(f, stance) {
    const key = `${stance}:${f.stance}:${Object.keys(f.clips).length}`;
    if (f.ringsKey !== key) {
      f.rings = locoClips(stance, { key: f.stance, has: (n) => Boolean(f.clips[n]) });
      f.ringsKey = key;
      f.loco = new Set(f.rings.flat().map((r) => r.name));
    }
    return f.rings;
  }

  // an action playing at no weight, made once; a loco one seated on the phase
  function ensure(f, name) {
    let a = f.actions.get(name);
    if (!a) {
      a = f.mixer.clipAction(f.clips[name]);
      if (ONCE.has(name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      a.play();
      a.setEffectiveWeight(0);
      f.actions.set(name, a);
      f.weights.set(name, 0);
      if (f.loco.has(name)) a.time = timeAt(strideOf(f.model, name, f.clips[name]), f.phase, f.clips[name].duration);
    }
    return a;
  }

  // what a frame wants playing: on the move the blend's weights, every loco
  // action in step on the phase; else one clip. Sets f.clip to the lead.
  function wanted(f, e, s, dt) {
    const has = (n) => Boolean(f.clips[n]);
    if (LOCO_STATES.has(s.state) && s.speed > 0.2) {
      const rings = ringsOf(f, s.state === 'crouchWalk' ? 'crouch' : 'stand');
      if (rings.length) {
        const b = locoBlend({ state: s.state, speed: s.speed, angle: relAngle(e.yaw ?? 0, e.vel ?? [0, 0]) }, rings, (n) => infoOf(f, n));
        // (from a stand: the feet passing, every loco action seated there)
        const seat = !f.walking;
        if (seat) f.phase = 0;
        f.walking = true;
        for (const name of f.loco) {
          const a = ensure(f, name);
          const clip = f.clips[name];
          if (seat) a.time = timeAt(strideOf(f.model, name, clip), f.phase, clip.duration);
          a.timeScale = b.rate * (infoOf(f, name).period ?? clip.duration);
        }
        f.phase += b.rate * dt;
        let lead = null;
        for (const [name, w] of Object.entries(b.weights)) if (!lead || w > b.weights[lead]) lead = name;
        f.clip = lead;
        return b.weights;
      }
    }
    f.walking = false;
    for (const name of f.loco) if (f.actions.has(name)) f.actions.get(name).timeScale = 0;
    const name = packClip(s, { stance: f.stance });
    const fallback = packFallback(name);
    const clip = resolveClip(name, has) ?? (fallback && resolveClip(fallback, has)) ?? (has('idle') ? 'idle' : null);
    if (!clip) return {};
    const a = ensure(f, clip);
    if (clip !== f.clip) {
      // (a one-shot from its start; a loop where it was)
      if (ONCE.has(clip) || !a.isRunning()) a.reset();
      a.play();
      a.timeScale = 1;
    }
    f.clip = clip;
    return { [clip]: 1 };
  }

  // every action's weight toward what the frame wants, CROSSFADE from 0 to
  // 1; a one-clip action faded out is stopped, a loco one stays in step
  function blendTo(f, targets, dt) {
    // (nothing playing yet, a body just made: its first pose at once, not eased up from the bind pose)
    let step = CROSSFADE > 0 ? dt / CROSSFADE : 1;
    if (![...f.weights.values()].some((w) => w > 0)) step = 1;
    for (const [name, a] of f.actions) {
      const want = targets[name] ?? 0;
      const was = f.weights.get(name) ?? 0;
      const w = was + Math.max(-step, Math.min(step, want - was));
      f.weights.set(name, w);
      a.setEffectiveWeight(w);
      if (w <= 0 && want <= 0 && !f.loco.has(name) && a.isRunning()) a.stop();
    }
  }

  return {
    root,
    // entities: the view's (id, team, kind, at, yaw, state, stance, vel, aim, …);
    // the last step's places are kept so a frame between two steps is smooth
    update(entities, dt, alpha = 1, eye = null) {
      const seen = new Set();
      for (const e of entities) {
        // (a soldier only: the walkers and the turrets are lane 4's)
        if (e.kind && e.kind !== 'soldier') continue;
        if (e.state === 'deploying') continue;
        seen.add(e.id);
        const f = figs.get(e.id) ?? make(e);
        // (a new step: the last place becomes the one to blend from)
        if (!f.cur || f.cur.t !== e.t) {
          f.last = f.cur ?? { at: e.at.slice(), yaw: e.yaw ?? 0, t: e.t };
          f.cur = { at: e.at.slice(), yaw: e.yaw ?? 0, t: e.t };
        }
        if (!f.model) continue;
        if (ragdolls) {
          // (asked once per death: a refused body is 'refused', plays its death
          // clip and is not offered again, so a long-dead corpse never jumps)
          if (DEAD.has(e.state) && !f.fell) f.fell = ragdolls.fall(e.id, f, { fall: e.fall ?? null, vel: e.vel ?? null, eye }) ? true : 'refused';
          else if (!DEAD.has(e.state) && f.fell) {
            // (up again under the same id: the clips have it back, at its new place)
            if (f.fell === true) ragdolls.drop(e.id);
            f.fell = false;
            f.clip = null;
            f.model.visible = true;
            f.last = f.cur = { at: e.at.slice(), yaw: e.yaw ?? 0, t: e.t };
          }
          if (f.fell === true && ragdolls.handed(e.id)) {
            // (the ragdoll has the body: the gun leaves the hand)
            arm(f, null);
            continue;
          }
        }
        f.model.position.set(lerp(f.last.at[0], f.cur.at[0], alpha), lerp(f.last.at[1], f.cur.at[1], alpha), lerp(f.last.at[2], f.cur.at[2], alpha));
        f.model.rotation.y = lerpAngle(f.last.yaw, f.cur.yaw, alpha);
        f.model.visible = e.visible !== false;
        arm(f, e.weapon ?? null);
        const s = stateFor(e);
        blendTo(f, wanted(f, e, s, dt), dt);
        f.mixer.update(dt);
      }
      for (const [id, f] of figs) {
        if (seen.has(id)) continue;
        held.disarm(f);
        if (f.fell === true) ragdolls?.drop(id);
        f.model?.removeFromParent();
        f.mixer?.stopAllAction();
        figs.delete(id);
      }
    },
    figure: (id) => figs.get(id) ?? null,
    // where a soldier's gun's muzzle is in the world, or null (no figure, no gun yet)
    muzzleOf: (id, out) => {
      const f = figs.get(id);
      return f?.model ? held.muzzleOf(f, out) : null;
    },
    count: () => [...figs.values()].filter((f) => f.model).length,
    dispose() {
      gone = true;
      held.dispose();
      for (const [id, f] of figs) {
        if (f.fell === true) ragdolls?.drop(id);
        f.mixer?.stopAllAction();
        f.model?.removeFromParent();
      }
      figs.clear();
      root.removeFromParent();
    },
  };
}
