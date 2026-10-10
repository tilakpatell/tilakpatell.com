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
//   createFigures({ scene, loadBody, kinds }) → { update(entities, dt, alpha), figure(id), count(), dispose() }

import * as THREE from 'three';
import { loadWalrusBody, packUrls, PACK_DIR } from '../../../lib/three/walrus.js';
import { resolveClip } from '../../../lib/three/walrusRig.js';
import { CROSSFADE, packClip, stateFor } from './locomotion.js';

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

export function createFigures({ scene, loadBody = (url) => loadWalrusBody(url, { packs: packUrls() }), kinds = KINDS } = {}) {
  const root = new THREE.Group();
  root.name = 'figures';
  scene.add(root);
  const figs = new Map(); // id → { model, mixer, actions, clip, prev: { at, yaw }, cur }
  let gone = false;

  function make(e) {
    const f = { model: null, mixer: null, clips: null, actions: new Map(), clip: null, last: null, cur: null };
    figs.set(e.id, f);
    const kind = kinds[SIDE_OF_TEAM[e.team]] ?? kinds.dark;
    loadBody(bodyUrl(kind))
      .then(({ model, clips }) => {
        if (gone || !figs.has(e.id)) return;
        model.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            o.frustumCulled = false;
          }
        });
        f.model = model;
        f.clips = clips;
        f.mixer = new THREE.AnimationMixer(model);
        root.add(model);
      })
      .catch((err) => {
        if (import.meta.env?.DEV) console.warn('figure failed', kind, err);
      });
    return f;
  }

  function play(f, name) {
    const has = (n) => Boolean(f.clips[n]);
    const clip = resolveClip(name, has) ?? (has('idle') ? 'idle' : null);
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
    update(entities, dt, alpha = 1) {
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
        f.model.position.set(lerp(f.last.at[0], f.cur.at[0], alpha), lerp(f.last.at[1], f.cur.at[1], alpha), lerp(f.last.at[2], f.cur.at[2], alpha));
        f.model.rotation.y = lerpAngle(f.last.yaw, f.cur.yaw, alpha);
        f.model.visible = e.visible !== false;
        play(f, packClip(stateFor(e)));
        f.mixer.update(dt);
      }
      for (const [id, f] of figs) {
        if (seen.has(id)) continue;
        f.model?.removeFromParent();
        f.mixer?.stopAllAction();
        figs.delete(id);
      }
    },
    figure: (id) => figs.get(id) ?? null,
    count: () => [...figs.values()].filter((f) => f.model).length,
    dispose() {
      gone = true;
      for (const f of figs.values()) {
        f.mixer?.stopAllAction();
        f.model?.removeFromParent();
      }
      figs.clear();
      root.removeFromParent();
    },
  };
}
