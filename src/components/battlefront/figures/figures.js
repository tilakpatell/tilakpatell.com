// A soldier entity drawn as a 2017 trooper on the game's skeleton (phase 1's
// walrus loader, phase 2's bodies), moved by the game's clips (the humanoid
// pack: the game's own clips under the site's names) as locomotion.js says
// from what the sim says. One figure an entity, made when it first appears
// in the view and freed when it leaves; placed between the sim's last two
// steps by `alpha`.
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
import { CROSSFADE, packClip, packFallback, stateFor } from './locomotion.js';

export const SIDE_OF_TEAM = { 1: 'light', 2: 'dark' };
export const KINDS = { dark: 'snowtrooper', light: 'hothtrooper' };
export const bodyUrl = (kind) => `${PACK_DIR}/crew/${kind}.lod1.glb`;
const ONCE = new Set(['die.fwd', 'die.back', 'die', 'dodge.front', 'hit.chest', 'crouch']);

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
    const f = { model: null, mixer: null, clips: null, sockets: null, actions: new Map(), clip: null, last: null, cur: null, weapon: null, stance: null };
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
            o.frustumCulled = false;
          }
        });
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

  function play(f, name) {
    const has = (n) => Boolean(f.clips[n]);
    const fallback = packFallback(name);
    const clip = resolveClip(name, has) ?? (fallback && resolveClip(fallback, has)) ?? (has('idle') ? 'idle' : null);
    if (!clip || clip === f.clip) return;
    let a = f.actions.get(clip);
    if (!a) {
      a = f.mixer.clipAction(f.clips[clip]);
      if (ONCE.has(clip)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      f.actions.set(clip, a);
    }
    const was = f.clip ? f.actions.get(f.clip) : null;
    a.reset().play();
    if (was) a.crossFadeFrom(was, CROSSFADE, false);
    f.clip = clip;
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
        play(f, packClip(stateFor(e), { stance: f.stance }));
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
