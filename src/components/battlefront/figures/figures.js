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
// troopers, every class alike until the class kits' own bodies are imported.
// A body comes up on its light cut (public/models/galaxy/bf2017/crew/, the
// game's LOD4: 1,500 triangles, its cloth and coat skinned whole to the leg
// bones) and, with `cuts`, takes the cut its distance from the eye wants
// (lib/three/walrusCuts.js, as the galaxy's crowds do: the game's LOD0 near,
// within the quality level's share of the GPU and the download, the far cut
// past the level's `mid`), swapped onto the same bones (walrus.js's
// swapBody) so the mixer and the gun go on as they were. The player is the
// nearest body there is, so on a level that upgrades it is drawn as the
// game draws it, not as its distant LOD.
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
//   createFigures({ scene, loadBody, kinds, held, loadStance, ragdolls, cuts }) →
//     { update(entities, dt, alpha, eye), figure(id), muzzleOf(id, out), count(), dispose() }
//   cuts: { of(kind) → its cut row | null, level, lowData, load(url) → glTF } or
//     null (every body on its light cut); figureCuts({ level, lowData }) the page's
//   BODIES: a kind's plain file and cut row (crewList.js's rows for the same files)
//   preloadBody(kind, cuts) → Promise | null: that kind's near cut fetched ahead

import * as THREE from 'three';
import { cloneScene, loadGLTF } from '../../../lib/three/gltfCache.js';
import { clipsFor, cutsToLoad, loadWalrusBody, loadWalrusPacks, packUrls, PACK_DIR, swapBody } from '../../../lib/three/walrus.js';
import { createCutter, cutWanted, ledgerFor } from '../../../lib/three/walrusCuts.js';
import { CLOTH_PART, reskinCloth } from '../../../lib/three/clothFallback.js';
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
const crew = (kind) => `${PACK_DIR}/crew/${kind}.glb`;
// A kind's plain file and how it is cut. A trooper's row (fullMB: the LOD0's
// GPU textures, fullDL its download, both MB: the ledger's share) is cut by
// distance; a hero's (`pack`: its own clips, laid over the humanoid's) takes
// the level's cut once, as the galaxy's heroes do (walrus.js's cutsToLoad:
// its LOD0 at 1024 on high, at the game's 2048 on ultra).
export const BODIES = {
  snowtrooper: { url: crew('snowtrooper'), cuts: { lod: true, far: true, full: true, fullMB: 26, fullDL: 18 } },
  hothtrooper: { url: crew('hothtrooper'), cuts: { lod: true, far: true, full: true, fullMB: 50, fullDL: 27 } },
  deathtrooper: { url: crew('deathtrooper'), cuts: { lod: true, far: true, full: true, fullMB: 21, fullDL: 13 } },
  wookiee: { url: crew('wookiee'), cuts: { lod: true, full: true, fullMB: 34, fullDL: 19 } },
  ...Object.fromEntries(['luke', 'leia', 'han', 'chewie', 'lando', 'obiwan', 'anakin', 'bobafett', 'bossk', 'vader', 'palpatine', 'maul', 'dooku'].map((k) => [k, { url: crew(k), pack: k }])),
};
// The body a deployed unit wears: the rulebook's hero or reinforcement id
// (sim.js's unitId) to its kind; a unit with none here yet (Yoda, Iden,
// Grievous, the jump troopers, the ISB agent, the Ewok on its own rig) and
// every class wear their side's trooper
export const UNIT_KINDS = { luke: 'luke', leia: 'leia', hansolo: 'han', chewbacca: 'chewie', lando: 'lando', obiwan: 'obiwan', anakin: 'anakin', bobafett: 'bobafett', bossk: 'bossk', darthvader: 'vader', emperor: 'palpatine', maul: 'maul', dooku: 'dooku', DeathTrooper: 'deathtrooper', WookieWarrior: 'wookiee' };
export const kindOf = (e, kinds = KINDS) => UNIT_KINDS[e.unitId] ?? kinds[SIDE_OF_TEAM[e.team]] ?? kinds.dark;
export const figureCuts = ({ level, lowData = false }) => ({ of: (kind) => BODIES[kind]?.cuts ?? null, level, lowData, load: (url) => loadGLTF(url) });
// The near cut a kind's figures will want, fetched ahead (the waiting
// screen's minute: the player otherwise deployed on the light cut and the
// 18 MB LOD0 landed 10 to 25 s later), admitted to the level's share under
// the key the figures' cutters use, and left in the page's cache for them.
// Null where the level never draws it near.
export function preloadBody(kind, cuts) {
  const row = cuts?.of(kind);
  const url = BODIES[kind]?.url;
  if (!row || !url) return null;
  if (cutWanted(0, cuts.level, { hasLod: Boolean(row.lod), hasFar: Boolean(row.far), lowData: cuts.lowData, admitted: true }) !== 'plain') return null;
  if (!ledgerFor(cuts.level).admit(url, { gpu: row.fullMB ?? 0, download: row.fullDL ?? 0 })) return null;
  return Promise.resolve(cuts.load(url)).catch(() => null);
}
const loadKind = (url, kind) => loadWalrusBody(url, { packs: packUrls(BODIES[kind]?.pack ?? null) });
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

// a body's meshes as the figures draw them: each casts and takes shadows,
// its cloth on lib/three/clothFallback's skin (the game simulates it; drawn
// on the file's fallback skin it webs between the legs), the whole culled by
// one sphere
function dress(model) {
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
    if (o.isSkinnedMesh && [].concat(o.material).some((m) => CLOTH_PART.test(m?.name ?? ''))) reskinCloth(o);
  });
  cullBy(model);
}

export function createFigures({ scene, loadBody = loadKind, kinds = KINDS, held = createHeld(), loadStance = loadStancePack, ragdolls = null, cuts = null } = {}) {
  const root = new THREE.Group();
  root.name = 'figures';
  scene.add(root);
  const figs = new Map(); // id → { model, mixer, actions, clip, prev: { at, yaw }, cur }
  let gone = false;

  function make(e) {
    // (actions: every clip played so far; weights: each one's, eased;
    // loco: the names on the stride phase; phase in strides; walking: on
    // the move last frame, so a start seats every loco action at the phase)
    const kind = kindOf(e, kinds);
    const f = { kind, model: null, mixer: null, clips: null, sockets: null, actions: new Map(), weights: new Map(), speeds: new Map(), loco: new Set(), rings: null, ringsKey: null, phase: 0, walking: false, clip: null, last: null, cur: null, weapon: null, stance: null, cutter: null, cutAsked: null };
    figs.set(e.id, f);
    loadBody(bodyUrl(kind), kind)
      .then(({ model, clips, sockets }) => {
        // (gone, or this id's figure made again for another unit since)
        if (gone || figs.get(e.id) !== f) return;
        faceAlongZ(model);
        dress(model);
        f.model = model;
        f.clips = clips;
        f.sockets = sockets ?? null;
        f.mixer = new THREE.AnimationMixer(model);
        root.add(model);
        const row = cuts?.of(kind);
        if (row && BODIES[kind]) f.cutter = createCutter({ url: BODIES[kind].url, cuts: row, level: cuts.level, lowData: cuts.lowData, load: cuts.load, start: 'lod1', swap: (gltf) => swapCut(f, gltf) });
        else if (cuts && BODIES[kind]?.pack) {
          // (a hero: the level's cut once, over the light one it came up on)
          const [, want] = cutsToLoad(BODIES[kind].url, cuts.level, { lowData: cuts.lowData });
          if (want) Promise.resolve(cuts.load(want)).then((gltf) => swapCut(f, gltf)).catch(() => {});
        }
      })
      .catch((err) => {
        if (import.meta.env?.DEV) console.warn('figure failed', kind, err);
      });
    return f;
  }

  // a figure let go: its gun, its ragdoll, its body
  function drop(id, f) {
    held.disarm(f);
    if (f.fell === true) ragdolls?.drop(id);
    f.model?.removeFromParent();
    f.mixer?.stopAllAction();
    figs.delete(id);
  }

  // a cut onto a body that is still here: its meshes on the body's own bones,
  // the old cut's materials freed (each body's are its own: cloneScene)
  function swapCut(f, gltf) {
    if (gone || !f.model || !gltf) return;
    const next = cloneScene(gltf);
    const old = swapBody(f.model, next);
    if (!old.length) {
      next.traverse((o) => o.isMesh && [].concat(o.material).forEach((m) => m.dispose()));
      return;
    }
    for (const o of old) for (const m of [].concat(o.material)) m.dispose();
    dress(f.model);
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
        let f = figs.get(e.id);
        // (the id deployed again as another unit, a hero after a trooper: its own body, from the light cut up)
        if (f && !DEAD.has(e.state) && f.kind !== kindOf(e, kinds)) {
          drop(e.id, f);
          f = null;
        }
        f ??= make(e);
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
        // (the cut its distance wants, asked once a step: the cutter holds a band's edge and loads one at a time)
        if (f.cutter && eye && f.cutAsked !== e.t) {
          f.cutAsked = e.t;
          f.cutter.at(Math.hypot(f.cur.at[0] - eye.x, f.cur.at[1] - eye.y, f.cur.at[2] - eye.z));
        }
        f.model.position.set(lerp(f.last.at[0], f.cur.at[0], alpha), lerp(f.last.at[1], f.cur.at[1], alpha), lerp(f.last.at[2], f.cur.at[2], alpha));
        f.model.rotation.y = lerpAngle(f.last.yaw, f.cur.yaw, alpha);
        f.model.visible = e.visible !== false;
        arm(f, e.weapon ?? null);
        const s = stateFor(e);
        blendTo(f, wanted(f, e, s, dt), dt);
        f.mixer.update(dt);
      }
      for (const [id, f] of figs) if (!seen.has(id)) drop(id, f);
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
