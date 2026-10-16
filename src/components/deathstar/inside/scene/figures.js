// The people aboard the Death Star as figures: a model on the site’s shared
// 24-bone skeleton (rigged by Meshy, or moved onto it by
// scripts/rig-transfer.mjs: old Ben, C-3PO), moved by the site’s animator
// (lib/three/animator.js), as the galaxy’s, the office’s and the universe’s
// people are. Rick’s idle, walk and run are its own (borrowed from
// src/lib/three/clipLibrary.js, retargeted to its hips and turned to face
// where its walk does), paced by locomotion to the ground it covers, so its
// feet don’t skate, it walks backward and sideways with its hips turned to
// the way it goes, and leans into turns; every other clip comes from the
// library when first asked for: stances, consoles, talk, sitting,
// crouching, hits, falls, shots, sabre strokes, the Force. The figure turns
// its chest and head to where it aims, and holds its gun in its right hand
// pointed that way. A kind can be dyed (dye.js) or tinted. Models from
// other worlds are loaded by URL, never imported. A model that doesn’t load
// stands in as a plain capsule, so nobody vanishes.
//
//   PEOPLE                 kind → { url, tall }: the heroes and the stormtrooper
//   ALIAS                  the rules’ older clip names to the library’s (hit, die, dieFwd, dieBlown, taunt)
//   PRELOAD                the clips fetched up front, so the first fight isn’t late
//   motionOf(speed, side = 0, turn = 0) → { move, speed, side, turn }   pure: the animator’s motion for a
//     body going `speed` m/s ahead, `side` m/s to its right, turning `turn` rad/s to its left
//   playerKind({ side, hero, armour }) → kind   who the player is drawn as
//   loadPerson(kind, { tall, tint, dye, renderer }) → Promise<person>
//     kind: a PEOPLE key, or a model’s path; tall: metres (the kind’s own otherwise); tint: a colour
//     multiplied into its materials; dye: dye.js’s { color, gain, keep, roughness }
//     person: { object, kind, tall, hand, bones, play(name, opts), stop(layer, fade), base(name, opts),
//       look(target | null), setAim(yaw, pitch, raised), hold(gun), fall(opts) → bool, rise(), fallen,
//       settled, fade(k), update(dt, motion?), dispose() }
//     object: feet at its origin, facing −z, so object.rotation.y = −yaw faces yaw
//     play: a library clip by name (or an ALIAS), on the 'full' body (default) or the 'upper' or
//       'lower' half; { loop, hold, fade, speed }; null or a walk name stops the full body’s clip
//     base: a looping state in place of the walk (crouch, sit.idle, a stance; null back to walking)
//     setAim: the aim’s turn (+ to the right) and tilt (+ up) from where it faces; `raised` false
//       carries the gun low
//     fall: let go as a ragdoll (lib/three/ragdollPhysics.js) from the pose it is in, { collide, push,
//       speed, velocity }; false for a figure that can’t (a stand-in); settled once it lies still
//     update: motion as motionOf’s, or a speed ahead in m/s; without it, how far the object moved

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createAnimator } from '../../../../lib/three/animator';
import { asNode } from '../../../../lib/three/hookNodes';
import { RICK_HIPS, borrowClips, faceForward, heading, preload, retarget } from '../../../../lib/three/clipLibrary';
import { loadGltf } from '../../../../lib/three/gltf';
import { rigRagdoll } from '../../../../lib/three/ragdollPhysics';
import { BODY } from '../rules/walker';
import { dyed } from './dye';

export const PEOPLE = {
  luke: { url: '/models/galaxy/crew/luke.glb', tall: 1.72 },
  han: { url: '/models/galaxy/crew/han.glb', tall: 1.85 },
  leia: { url: '/models/galaxy/crew/leia.glb', tall: 1.5 },
  obiwan: { url: '/models/deathstar/obiwan.glb', tall: 1.78 },
  stormtrooper: { url: '/models/galaxy/troops/stormtrooper.glb', tall: 1.83, gloss: true },
};
const HEROES = ['luke', 'han', 'leia', 'obiwan'];

const WALKS = ['idle', 'walk', 'run'];
export const ALIAS = Object.freeze({ hit: 'hit.trooper', die: 'die.back', dieFwd: 'die.fwd', dieBlown: 'die.blown', taunt: 'taunt.trooper' });
const FALLS = new Set(['die', 'dieFwd', 'dieBlown', 'die.back', 'die.fwd', 'die.blown', 'die.2']);
export const PRELOAD = Object.freeze(['hit.trooper', 'hit.chest', 'hit.knock', 'die.back', 'die.fwd', 'shoot', 'idle.calm', 'talk', 'crouch', 'crouch.walk', 'sit.enter', 'sit.idle', 'sit.exit', 'kneel']);

const AIM = { yaw: 1.1, pitch: 0.9, chase: 12 }; // how far the chest and head turn and tilt, and how fast they follow
const SPINE = ['Spine', 'Spine01', 'Spine02']; // each takes a share of the turn, the neck and head the rest
const SHARE = { spine: 0.18, neck: 0.16, head: 0.3 };
const LOW = 0.75; // how far down a gun carried low points
const JUMP = 3; // metres moved in one update that are a teleport, not a stride
const WALK_MOVE = 0.45; // locomotion’s `move` at walking pace: all walk (its run starts at 0.55)

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function motionOf(speed, side = 0, turn = 0) {
  const ground = Math.hypot(speed || 0, side || 0);
  const move = ground <= BODY.walk ? (WALK_MOVE * ground) / BODY.walk : WALK_MOVE + (1 - WALK_MOVE) * clamp((ground - BODY.walk) / (BODY.run - BODY.walk), 0, 1);
  return { move, speed: speed || 0, side: side || 0, turn: turn || 0 };
}

export function playerKind({ side, hero, armour = false } = {}) {
  if (side === 'imperial' || armour) return 'stormtrooper';
  return HEROES.includes(hero) ? hero : 'luke';
}

// Rick’s three, fetched once for everyone; the rest come through the animator as asked for
let walks = null;
const ownWalks = () => (walks ??= Promise.all([borrowClips(WALKS), preload(PRELOAD)]).then(([w]) => w));

// ── the guns ──

// Each gun in metres, its grip at the origin and its muzzle towards −z: the
// parts as [shape, size, place, finish], where a 'rod' runs along z.
const GUNS = {
  // the E-11: a short black carbine, its finned shroud, the scope on top, the magazine out to the left
  e11: [
    ['box', [0.05, 0.07, 0.3], [0, 0.04, -0.1], 'dark'],
    ['rod', [0.024, 0.24], [0, 0.045, -0.36], 'dark'],
    ['rod', [0.013, 0.15], [0, 0.095, -0.12], 'grey'],
    ['box', [0.03, 0.1, 0.045], [0, -0.03, 0], 'dark'],
    ['box', [0.14, 0.025, 0.03], [-0.08, 0.035, -0.12], 'grey'],
    ['box', [0.02, 0.02, 0.22], [0, 0.085, 0.06], 'grey'],
  ],
  // the DL-44: Han’s heavy pistol, its scope, the flash hider at the muzzle
  dl44: [
    ['box', [0.04, 0.06, 0.2], [0, 0.04, -0.06], 'dark'],
    ['rod', [0.017, 0.12], [0, 0.04, -0.21], 'dark'],
    ['rod', [0.024, 0.04], [0, 0.04, -0.28], 'grey'],
    ['rod', [0.011, 0.1], [0, 0.085, -0.06], 'grey'],
    ['box', [0.03, 0.1, 0.04], [0, -0.03, 0], 'dark'],
  ],
  // the DH-17: the Tantive’s troopers’ pistol, short and plain
  dh17: [
    ['box', [0.04, 0.06, 0.22], [0, 0.04, -0.07], 'dark'],
    ['rod', [0.016, 0.09], [0, 0.045, -0.22], 'grey'],
    ['box', [0.03, 0.1, 0.04], [0, -0.03, 0], 'dark'],
    ['box', [0.02, 0.07, 0.025], [0, -0.04, -0.1], 'grey'],
  ],
  // the A280: a long rifle with a stock to the shoulder
  a280: [
    ['box', [0.05, 0.075, 0.42], [0, 0.04, -0.14], 'dark'],
    ['rod', [0.02, 0.32], [0, 0.05, -0.5], 'grey'],
    ['box', [0.04, 0.09, 0.26], [0, 0.0, 0.18], 'dark'],
    ['box', [0.03, 0.1, 0.045], [0, -0.03, 0], 'dark'],
    ['rod', [0.013, 0.16], [0, 0.1, -0.16], 'grey'],
  ],
};

function makeGun(kind, finish) {
  const spec = GUNS[kind];
  if (!spec) return null;
  const by = { dark: [], grey: [] };
  for (const [shape, size, [x, y, z], mat] of spec) {
    const g = shape === 'box' ? new THREE.BoxGeometry(...size) : new THREE.CylinderGeometry(size[0], size[0], size[1], 10).rotateX(Math.PI / 2);
    by[mat].push(g.translate(x, y, z));
  }
  const group = new THREE.Group();
  group.name = `gun-${kind}`;
  for (const [mat, geos] of Object.entries(by)) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    group.add(new THREE.Mesh(merged, finish[mat]));
  }
  return group;
}

// ── turning bones in the world ──

const _pq = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _v = new THREE.Vector3();
// turn a bone about an axis given in the world (its parent’s turn undone, the turn made, the parent’s put back)
function turnWorld(bone, axis, angle) {
  if (!bone?.parent || Math.abs(angle) < 1e-5) return;
  bone.parent.getWorldQuaternion(_pq);
  _dq.setFromAxisAngle(axis, angle);
  const local = _pq.clone().invert().multiply(_dq).multiply(_pq);
  bone.quaternion.premultiply(local);
}

// ── a person ──

function finishes() {
  return {
    dark: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.45, metalness: 0.6 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x4d5258, roughness: 0.4, metalness: 0.7 }),
  };
}

// What every person does whatever its body: hold a gun, aim it, carry it,
// keep its own clock on how far it has gone, and move on its animator.
function personOf({ object, kind, tall, hand, anim = null, bones = {}, owned }) {
  const finish = finishes();
  const aim = { yaw: 0, pitch: 0, wantYaw: 0, wantPitch: 0, raised: true };
  let gun = null;
  let gunKind = null;
  let based = null;
  const last = new THREE.Vector3().copy(object.position);
  let lastYaw = object.rotation.y;
  let measured = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const frame = { forward, up: new THREE.Vector3(0, 1, 0) };
  const _q = new THREE.Quaternion();
  let m = motionOf(0);
  let rag = null; // the ragdoll it fell as, once it has
  let wasSolid = true; // the fade last set
  let lastFade = 1;
  const fadedOut = new Set(); // what the fade hid, to show again

  function pose(dt) {
    const k = 1 - Math.exp(-dt * AIM.chase);
    aim.yaw += (aim.wantYaw - aim.yaw) * k;
    aim.pitch += (aim.wantPitch - aim.pitch) * k;
    if (!anim || !bones.Hips) return;
    object.getWorldQuaternion(_q);
    right.set(1, 0, 0).applyQuaternion(_q).applyAxisAngle(up, -aim.yaw);
    for (const n of SPINE) {
      turnWorld(bones[n], up, -aim.yaw * SHARE.spine);
      turnWorld(bones[n], right, aim.pitch * SHARE.spine);
    }
    for (const [n, share] of [['neck', SHARE.neck], ['Head', SHARE.head]]) {
      turnWorld(bones[n], up, -aim.yaw * share);
      turnWorld(bones[n], right, aim.pitch * share);
    }
  }

  function carry() {
    if (!gun) return;
    if (hand) {
      object.worldToLocal(hand.getWorldPosition(_v));
      gun.position.copy(_v);
    } else gun.position.set(0.22, tall * 0.55, -0.15);
    gun.rotation.set(aim.raised ? aim.pitch : -LOW, -aim.yaw, 0, 'YXZ');
  }

  const person = {
    object,
    kind,
    tall,
    hand,
    bones,
    anim,
    play(name, { loop = false, fade = 0.2, layer = 'full', hold, speed = 1 } = {}) {
      if (!anim) return;
      if (name == null || WALKS.includes(name)) {
        anim.stop('full', fade);
        return;
      }
      const clip = ALIAS[name] ?? name;
      // (a fall stays down; anything else fades back to what was under it)
      anim.play(clip, { layer, loop, hold: hold ?? FALLS.has(clip), fade, speed });
    },
    stop(layer = 'full', fade = 0.2) {
      anim?.stop(layer, fade);
    },
    base(name, opts) {
      if (!anim || (name ?? null) === based) return;
      based = name ?? null;
      anim.base(based, opts);
    },
    look(target) {
      anim?.look(target ?? null);
    },
    setAim(yaw, pitch, raised = true) {
      aim.wantYaw = clamp(yaw || 0, -AIM.yaw, AIM.yaw);
      aim.wantPitch = clamp(pitch || 0, -AIM.pitch, AIM.pitch);
      aim.raised = raised;
    },
    hold(kind) {
      if (kind === gunKind) return;
      if (gun) {
        gun.removeFromParent();
        gun.traverse((o) => o.geometry?.dispose());
      }
      gunKind = kind ?? null;
      gun = kind ? makeGun(kind, finish) : null;
      if (gun) object.add(gun);
    },
    // Let go as a ragdoll from the pose it is in: its clips stop, its gun drops,
    // and from now on update steps the body. collide, push, speed, velocity:
    // ragdollPhysics.js’s. A figure with no skeleton of ours can’t, and says so.
    fall({ collide = null, push = { x: 0, y: 0, z: 0 }, speed = 2, velocity = null } = {}) {
      if (rag || !anim || !bones.Hips) return Boolean(rag);
      person.hold(null);
      object.updateMatrixWorld(true);
      rag = rigRagdoll(bones, { collide, push, speed, velocity });
      return true;
    },
    // (up again, a checkpoint having put them back: the clips take the body back)
    rise() {
      rag = null;
    },
    get fallen() {
      return Boolean(rag);
    },
    // see-through, k of the way to solid (1): someone between the camera and you is faded so you
    // can see past them
    fade(k) {
      const solid = k >= 0.99;
      if (solid === wasSolid && (solid || Math.abs(k - lastFade) < 0.01)) return;
      wasSolid = solid;
      lastFade = k;
      for (const mat of owned) {
        mat.transparent = !solid;
        mat.opacity = solid ? 1 : k;
        mat.depthWrite = solid;
      }
      // what it wears or holds on materials it shares (the Death Star troopers' helmet, a gun) can't
      // be faded for it alone: out of sight while it is mostly faded
      // (only what the fade hid comes back: people.js hides the figure's own gun for its blaster)
      if (k > 0.5) {
        for (const o of fadedOut) o.visible = true;
        fadedOut.clear();
        return;
      }
      const mine = new Set(owned);
      object.traverse((o) => {
        if (!o.isMesh || mine.has(o.material) || !o.visible) return;
        o.visible = false;
        fadedOut.add(o);
      });
    },
    get settled() {
      return Boolean(rag?.settled);
    },
    update(dt, motion) {
      if (rag) {
        rag.step(dt);
        return;
      }
      if (motion === undefined) {
        // (no word from the caller: how far the object moved, and turned, since the last update)
        const moved = Math.hypot(object.position.x - last.x, object.position.z - last.z);
        if (dt > 0 && moved < JUMP) measured += (moved / dt - measured) * (1 - Math.exp(-dt * 10));
        m = motionOf(measured, 0, dt > 0 ? wrap(object.rotation.y - lastYaw) / dt : 0);
      } else m = typeof motion === 'number' ? motionOf(motion) : motion;
      last.copy(object.position);
      lastYaw = object.rotation.y;
      if (anim) {
        anim.locomote(m);
        anim.update(dt);
        object.updateMatrixWorld(true);
        // (the object faces −z: its forward in the world)
        forward.set(0, 0, -1).applyQuaternion(object.getWorldQuaternion(_q));
        anim.after(dt, m, frame);
      }
      pose(dt);
      carry();
    },
    dispose() {
      anim?.dispose();
      person.hold(null);
      object.removeFromParent();
      for (const mat of owned) mat.dispose();
      for (const mat of Object.values(finish)) mat.dispose();
    },
  };
  return person;
}

// A figure on the shared skeleton: scaled to `tall` from its skeleton at
// rest (the top of the head to the toes), its feet on the origin, turned to
// face −z, its materials finished (or dyed, or tinted) as its kind says.
function rig(model, walkClips, { kind, tall, tint, dye, gloss, key }) {
  const owned = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // (a skinned mesh's bounds don't follow its pose)
    const swap = (mat) => {
      // Meshy’s colours carry their own shading: matte, but armour keeps a plastic sheen
      const finish = { roughness: gloss ? 0.42 : 0.85, metalness: 0 };
      // (node materials from the start, as the dye’s are: the fade writes its own copies each
      // frame, and the house look would put its own in their place, which those writes never reach)
      const c = dye ? dyed(mat, { ...finish, ...dye }) : asNode(Object.assign(mat.clone(), finish));
      if (!dye && tint != null) c.color?.multiply(new THREE.Color(tint));
      owned.push(c);
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  const bones = {};
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
  });
  model.updateMatrixWorld(true);
  const y = (n) => bones[n]?.getWorldPosition(new THREE.Vector3()).y;
  const top = y('head_end') ?? y('Head');
  const toes = Math.min(y('LeftToeBase') ?? 0, y('RightToeBase') ?? 0);
  const box = new THREE.Box3().setFromObject(model);
  const height = top != null ? top - toes : box.getSize(new THREE.Vector3()).y;
  const k = tall / Math.max(height, 1e-6);
  model.scale.multiplyScalar(k);
  model.position.y -= (top != null ? toes : box.min.y) * k;

  const hips = bones.Hips;
  const hipsY = hips?.position.y ?? RICK_HIPS;
  // Rick’s three made for these hips, the idle and the run turned to face where the walk does
  // (Meshy’s idle stands side-on, a fighter’s stance)
  const own = {};
  for (const n of WALKS) if (walkClips[n]) own[n] = retarget(walkClips[n], hipsY, walkClips[n].userData?.hips ?? RICK_HIPS);
  const upLocal = hips?.parent ? new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
  const ahead = upLocal && own.walk ? heading(own.walk, upLocal) : null;
  if (ahead != null) for (const n of ['idle', 'run']) if (own[n]) faceForward(own[n], upLocal, ahead);

  const turn = new THREE.Group();
  turn.rotation.y = Math.PI; // (Meshy’s figures face +z)
  turn.add(model);
  const object = new THREE.Group();
  object.name = `person-${kind}`;
  object.add(turn);
  // one animator a figure; copies of one model at one height share its strides and its clips
  const anim = hips && Object.keys(own).length ? createAnimator(model, { clips: own, hipsY, up: upLocal, key: `ds:${key}:${tall.toFixed(3)}`, seed: Math.floor(Math.random() * 1e6), unit: 1 }) : null;
  return personOf({ object, kind, tall, hand: bones.RightHand ?? null, anim, bones, owned });
}

// a plain capsule and head for a model that didn’t load: white for a trooper, grey for anyone else
function standIn(kind, tall, tint) {
  const color = new THREE.Color(kind === 'stormtrooper' ? 0xe6e8ea : 0x8a8f96);
  if (tint != null) color.multiply(new THREE.Color(tint));
  const mat = asNode(new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  const head = tall * 0.13;
  const r = tall * 0.12;
  const object = new THREE.Group();
  object.name = `person-${kind}`;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.1, tall - head * 2 - r * 2), 4, 10), mat);
  body.position.y = (tall - head * 2) / 2;
  const top = new THREE.Mesh(new THREE.SphereGeometry(head, 12, 10), mat);
  top.position.y = tall - head;
  object.add(body, top);
  const person = personOf({ object, kind, tall, hand: null, owned: [mat] });
  const dispose = person.dispose;
  person.dispose = () => {
    body.geometry.dispose();
    top.geometry.dispose();
    dispose();
  };
  return person;
}

export async function loadPerson(kind, { tall, tint = null, dye = null, renderer = null } = {}) {
  const who = PEOPLE[kind] ?? (typeof kind === 'string' && kind.startsWith('/') ? { url: kind, tall: BODY.h } : PEOPLE.stormtrooper);
  const height = tall ?? who.tall;
  const [gltf, clips] = await Promise.all([loadGltf(who.url, { renderer, fresh: true }), ownWalks().catch(() => ({}))]);
  if (!gltf?.scene) return standIn(kind, height, tint);
  return rig(gltf.scene, clips ?? {}, { kind, tall: height, tint, dye, gloss: Boolean(who.gloss), key: who.url });
}
