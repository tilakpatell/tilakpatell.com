// Who's about on a world: Jawas round their sandcrawler, banthas grazing,
// stormtroopers on patrol, Ewoks in their village, Gamorreans at a Hutt's gate.
// Each wanders near its home (stopping, looking about, going on), or walks
// its beat (a patrol's path, round and round), or stands where it was put;
// someone with something to say turns to you as you come up, and says it
// when you ask (the scene shows it).
//
// And they live there. One with `needs` goes to the site's places and uses
// them (needs.js: a drink at the cantina's bar, a vaporator knelt at and
// fixed, a seat sat in), a slot each, facing as the place says. Two or
// three who want company stop and talk, a step apart, taking turns, the
// speaker's hands going; a band walks together, its leader in front; a
// walker in your way steps aside, and one you walk into is shoved
// (lib/ai/social.js). One with a word for you turns its head as you come
// up and waves the first time (a Tusken holds his gaffi stick high), and
// talks with its hands as it says its line. A shot or a blast it hears
// (hear(): the scene says where) startles a townsman into a run away from
// it, makes a stall keeper duck, and stops a trooper, his blaster up and
// his head turned to it (needs.js's manners). Their bodies show all of
// it: each moves on its feet by the ground it covers (lib/ai/body.js's
// motion, from where its brain put it a frame apart: the legs paced to it,
// no sliding, no walking on the spot), its clips and head through its
// figure's calls, which do nothing on a figure that can't.
//
// A kind with a model (catalog/*.js) is that model (walking with its own
// clips, if it came rigged); otherwise figures.js builds it, or props/*.js
// does (a walker: an AT-AT, an AT-ST, its legs going as it goes). `model:
// false` builds it even where there's a model (a walker that should walk).
//
// site.life: [{ kind, n, at: [x, z], spread, roam, speed, path, still, hang (metres: hung upside down, the feet that high),
//   face, y (hovering: a probe droid), name, says: [line…] (a line: text,
//   or [who, text]), voice (the voice their own lines are said in, where it
//   isn't their name's: voicelines.js; `says` can be talk.js's tree, by
//   the state of things), scale, solid, id (a quest's name for them), quest (the
//   quest they give: quests.js's), reach (talked to from this far: a Hutt
//   on his dais), level (the height of the floor they're on, where there
//   are floors over floors), hidden (not there till a quest says), dive
//   (over the sea, a glide that dives into it now and then: an aiwha;
//   floats.js's diveAt options, its heights over the water), needs
//   (needs.js: the kinds of the site's `wants` it goes to), fears / chases
//   (actor kinds it runs from, or goes after, when it has seen them),
//   group (the entry's figures walk as a band, the first in front), sit
//   (sat where it stands: a booth's), hears / greets / chats (needs.js's
//   manner, where its kind's isn't right), creature (the game's creature
//   settings it walks by: an actor entity's name, `Actor_Jawa_01`, or the
//   settings', `CLS_Jawa`; lib/battlefront/ai/creature.js: its path or its
//   wander at its own speed, and its reaction to you) }]
// site.wants: [{ id, kind, at: [x, z], pause?, slots?, spots?, clip?, base?,
//   face? }] (where the people go, and what they do there: needs.js)
//
// place: the world's id, for its everyday people's pool (pools.js)
// createActors(…) → { group, actors, places, update(dt, you, at), hear({ at,
//   loudness, t }), setZone, debug, find, hide, hideKinds, talker, say,
//   shove, dispose }
//   hear: a shot or a blast at `at` ([x, z] or { x, z }; loudness 1 a
//   blaster, 2 a detonator), heard by whoever's in earshot on the next update

import * as THREE from 'three';
import { SURFACE_MODELS, lodUrlFor, modelUrlFor } from './catalog';
import { markBuilt, resolveFigure } from './cast';
import { buildFigure } from './figures';
import { crewFigure } from './crew';
import { poolFor } from './pools';
import { PROPS } from './props';
import { cloneModel, loadGlb, squared } from './placer';
import { rng } from './noise';
import { groundAt, lineClear, tooDeep, turnToward } from './walker';
import { hear, mannerOf, pickWant, placesOf, relate } from './needs';
import { talkFor } from './talk';
import { zoneVisibility } from './near';
import { diveAt } from './floats';
import { heldBlade } from './heldBlade';
import { WALKERS, walkerFigure } from './walkers';
import { leggedFigure } from './legRig';
import { createAnimator } from '../../../lib/three/animator';
import { budgetClock } from '../../../lib/three/animBudget';
import { breathe, createGait, sway } from '../../../lib/three/gait';
import { bodyFrom } from '../../../lib/ai/body';
import { release, reserve, spotOf } from '../../../lib/ai/needs';
import { createSocial } from '../../../lib/ai/social';
import { NO_CALLS, animatorCalls, seedOf } from '../../../lib/three/figureCalls';
import { atPriority } from '../../../lib/assetLoad';
import { device } from '../../../lib/device';
import { detailLevel } from '../../../lib/detail';
import { firstCut, wantsUpgrade } from '../../../lib/net/progressive';
import { createCreatureMind, settingsFor } from '../../../lib/battlefront/ai/creature.js';

const TALK = 4.5; // metres: close enough to turn to you
const THERE = 0.6; // metres from where it's going: there
const AT_PLACE = 0.25; // metres from a place's spot: there, to use what's there
const RISE = 1.2; // seconds getting up off a seat before it goes
const ARRIVED = 0.12; // metres from a spot social.js gives it: there

// a brain: where it's going and what it's doing (pure)
export function brain(spec, home, r) {
  const b = {
    x: home[0],
    z: home[1],
    yaw: spec.face ?? r() * Math.PI * 2,
    home,
    speed: 0,
    to: null,
    wait: r() * 4,
    leg: 0, // the path point it's walking to
    visited: {}, // when it was last at each want (needs.js)
    last: null,
  };
  // (the game's creature settings, where it names them)
  const cls = spec.creature ? settingsFor(spec.creature) : null;
  if (cls) b.creature = createCreatureMind(cls, { home, get at() { return [b.x, b.z]; } });
  return b;
}

// a place it was using, or going to, given up (its slot freed)
function leave(b) {
  const w = b.use?.want ?? b.want;
  if (w?.slots != null) release(w, b);
  b.use = null;
  b.want = null;
}
// which way it faces using a place: as the place says, else toward its middle from its spot
const faceAt = (want, spot) => want.face ?? (Math.hypot(want.at[0] - spot[0], want.at[1] - spot[1]) > 0.05 ? Math.atan2(want.at[0] - spot[0], want.at[1] - spot[1]) : null);

// a step of it: on to where it's going, or a pause, or somewhere new
export function think(b, spec, dt, r, { avoid = null, wants = null, t = 0, you = null } = {}) {
  let pace = spec.speed ?? 1.2;
  if (spec.still) {
    b.speed = 0;
    return;
  }
  // on the game's creature settings: its mind says where and how fast (a fear or a chase still wins)
  if (b.creature && !b.flee && !b.chase && b.hold == null) {
    const c = b.creature.step(dt, { player: you ? [you.x, you.z] : null, waypoints: spec.path ?? null, rand: r });
    if (c.face != null) b.yaw = turnToward(b.yaw, c.face, 4 * dt);
    if (!c.to) {
      b.speed = Math.max(0, b.speed - dt * 6);
      return;
    }
    b.to = [...c.to];
    b.wait = 0;
    pace = c.speed;
  }
  // stood a while (startled by a shot, turned to look at one, getting up
  // off a seat): slowing to a stop, turning as it was told
  if (b.hold != null) {
    if (t < b.hold) {
      b.speed = Math.max(0, b.speed - dt * 6);
      if (b.holdFace != null) b.yaw = turnToward(b.yaw, b.holdFace, 4 * dt);
      return;
    }
    b.hold = null;
    b.holdFace = null;
  }
  // someone it fears in sight: away from them, at a run; someone it goes
  // after: toward them (needs.js's relate set these; hear, a shot's flight)
  if (b.flee && t < b.flee.until) {
    // (sat: up off the seat first)
    if (b.use?.want.base) {
      leave(b);
      b.hold = t + RISE;
      return;
    }
    if (b.use || b.want) leave(b);
    const a = Math.atan2(b.x - b.flee.from[0], b.z - b.flee.from[1]);
    b.to = [b.x + Math.sin(a) * 8, b.z + Math.cos(a) * 8];
    b.wait = 0;
    pace *= b.flee.pace ?? 1.6;
  } else if (b.flee) b.flee = null;
  else if (b.chase && t < b.chase.until) {
    b.to = [...b.chase.to];
    b.wait = 0;
    pace *= 1.3;
  } else if (b.chase) b.chase = null;
  if (!b.to) {
    b.wait -= dt;
    b.speed = Math.max(0, b.speed - dt * 3);
    if (b.wait > 0) {
      // (using a place: turned to it)
      if (b.use?.face != null) b.yaw = turnToward(b.yaw, b.use.face, 3 * dt);
      return;
    }
    // done there: away, a moment up off its seat first
    if (b.use) {
      const sat = Boolean(b.use.want.base);
      leave(b);
      if (sat) {
        b.hold = t + RISE;
        return;
      }
    }
    const want = spec.needs ? pickWant(spec, wants, b, t, r, { who: b }) : null;
    if (want) {
      // (a slot of its own there, and the spot that goes with it)
      if (want.slots != null) reserve(want, b);
      const s = spotOf(want, b);
      b.to = [s[0], s[1]];
      b.want = want;
    } else if (spec.path) {
      const p = spec.path[b.leg % spec.path.length];
      b.leg += 1;
      b.to = [p[0], p[1]];
    } else {
      const a = r() * Math.PI * 2;
      const d = (0.3 + r() * 0.7) * (spec.roam ?? 12);
      b.to = [b.home[0] + Math.cos(a) * d, b.home[1] + Math.sin(a) * d];
    }
  }
  const dx = b.to[0] - b.x;
  const dz = b.to[1] - b.z;
  const d = Math.hypot(dx, dz);
  const place = b.want?.slots != null; // (to a spot of its own: right up to it)
  if (d < (place ? AT_PLACE : THERE)) {
    b.to = null;
    b.wait = spec.path ? (spec.pause ?? 0.5) : 2 + r() * 6;
    if (b.want) {
      // (there: it stays a while, and remembers; a place, it uses)
      b.wait = b.want.pause ?? 6;
      (b.visited ??= {})[b.want.id] = t;
      b.last = b.want.id;
      if (place) b.use = { want: b.want, face: faceAt(b.want, spotOf(b.want, b)) };
      b.want = null;
    } else if (spec.needs) b.last = null; // (a wander between: the place it left may draw it again)
    return;
  }
  b.yaw = turnToward(b.yaw, Math.atan2(dx, dz), 3 * dt);
  // (slowing into a spot of its own, so it stops on it)
  b.speed = Math.min(pace, b.speed + dt * 2, place ? 0.35 + d : Infinity);
  // (it only goes the way it's facing, so it turns before it sets off)
  const ahead = Math.cos(b.yaw - Math.atan2(dx, dz));
  const step = b.speed * Math.max(0, ahead) * dt;
  let nx = b.x + Math.sin(b.yaw) * step;
  let nz = b.z + Math.cos(b.yaw) * step;
  if (avoid?.(nx, nz)) {
    // something in the way: somewhere else (a want it can't get to, not again next)
    b.to = null;
    b.wait = 0.5 + r();
    if (b.want) {
      b.last = b.want.id;
      leave(b);
    }
    nx = b.x;
    nz = b.z;
  }
  b.x = nx;
  b.z = nz;
}

// A step toward `to` (social.js's spots: someone to meet, a place in a
// band, out of your way), slowing into it so it stops on it. A short way,
// or with `sidestep`, it shuffles there without turning (facing `face`, if
// it's given one); further, it turns to where it's going as it walks. True
// once it's there. (Pure.)
export function approach(b, to, dt, { pace = 1.2, face = null, sidestep = false, avoid = null } = {}) {
  const dx = to.x - b.x;
  const dz = to.z - b.z;
  const d = Math.hypot(dx, dz);
  if (d < ARRIVED) {
    b.speed = Math.max(0, b.speed - dt * 4);
    if (face != null) b.yaw = turnToward(b.yaw, face, 4 * dt);
    return true;
  }
  const want = Math.min(pace, 0.4 + d * 1.2);
  b.speed = b.speed < want ? Math.min(want, b.speed + dt * 2) : Math.max(want, b.speed - dt * 4);
  let k = 1;
  if (sidestep || d < 0.8) {
    if (face != null) b.yaw = turnToward(b.yaw, face, 4 * dt);
  } else {
    const heading = Math.atan2(dx, dz);
    b.yaw = turnToward(b.yaw, heading, 4 * dt);
    k = Math.max(0, Math.cos(b.yaw - heading)); // (turned to it before it sets off)
  }
  const step = Math.min(d, b.speed * k * dt);
  const nx = b.x + (dx / d) * step;
  const nz = b.z + (dz / d) * step;
  if (avoid?.(nx, nz)) {
    b.speed = 0;
    return false;
  }
  b.x = nx;
  b.z = nz;
  return false;
}

// A kind's model (catalog/*.js) as a figure that walks: with its own clips
// where it came rigged (an idle and a walk, or only one of them), or a sway
// in its step where it didn't; null without a model. Each made is a seed of
// its own (its kind, and which of them it is). `models`: the book the kind
// is looked up in (the galaxy's, or a page's own).
const made = new Map(); // kind → how many
export async function modelFigure(kind, models = SURFACE_MODELS) {
  if (!models[kind]) return null;
  const n = made.get(kind) ?? 0;
  made.set(kind, n + 1);
  const row = models[kind];
  const gltf = await figureGlb(kind, models);
  if (!gltf) return null;
  // (a person who came as a statue: legs found in it, skinned and walked; legRig.js)
  if (row.legs && !row.anim) {
    const legged = leggedFigure(gltf.scene, { seed: seedOf(kind, n), legs: row.legs === true ? {} : row.legs });
    if (legged) return legged;
  }
  return modelFigureOf(cloneModel(gltf), { animations: gltf.animations, anim: row.anim, seed: seedOf(kind, n), clipSpeed: row.clipSpeed ?? null, machine: Boolean(row.machine) });
}

// A figure's file, through the site's pool (lib/assetLoad) ahead of the
// world's props (people are what the visitor looks at first). On a saver
// connection or 2G only its light cut is fetched (lib/net/progressive: the
// plain is never worth its bytes there); and where the plain cut won't come
// (a 404 on the bucket and the site, a dropped connection), the light cut
// stands in before the kind falls to its next maker (cast.js). The light cut
// came in square (placer.js's loadModel) and is drawn as it is.
const FIGURE_PRIORITY = 5;
async function figureGlb(kind, models) {
  const row = models[kind];
  const hasLod = Boolean(row.url ? row.lodUrl : row.lod);
  const level = detailLevel();
  const lowData = Boolean(device().saveData);
  const small = firstCut(0, level, { hasLod, lowData }) === 'lod1' && !wantsUpgrade(0, level, { lowData });
  const ask = (url) => atPriority(FIGURE_PRIORITY, () => loadGlb(url));
  if (small) return ask(lodUrlFor(kind, models));
  // (the level's own cut: at ultra the .ultra file where the kind has one)
  const plain = await ask(modelUrlFor(kind, level, models));
  if (plain) return squared(plain, kind, models);
  return hasLod ? ask(lodUrlFor(kind, models)) : null;
}

// what a move of 1 is, in metres a second (the people's update gives
// b.speed / 2.4)
const TOP = 2.4;
const UP = new THREE.Vector3(0, 1, 0);
const CREEP = 0.25; // the `move` a walk with no idle finishes its step at
const CONTACT = 0.04; // of a stride: near enough a foot coming down

// The feet of a rig that isn't Meshy's (a bantha's, a walker's): the
// lowest bone on each side of it as it stands (+x its left, facing +z, in
// its parent's frame), for its stride to be measured by; null without one
// on each side.
export function feetOf(root) {
  const top = root.parent ?? root;
  top.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(top.matrixWorld).invert();
  const p = new THREE.Vector3();
  let left = null;
  let right = null;
  root.traverse((o) => {
    if (!o.isBone) return;
    o.getWorldPosition(p).applyMatrix4(inv);
    if (p.x > 0.02 && (!left || p.y < left.y)) left = { o, y: p.y };
    if (p.x < -0.02 && (!right || p.y < right.y)) right = { o, y: p.y };
  });
  return left && right ? { left: left.o, right: right.o } : null;
}

// A model as a figure: { model, tall, anim, update(dt, move, motion?),
// play, stop, base, look, react, dispose }. `scene`: the model's own (a
// copy); `anim`: the catalogue's { idle, walk, run } to the clips' names in
// `animations`. `model` is a group round it, so the caller's scale and
// place are its and the sway's and the breath's are the scene's. update
// once it's placed; motion (lib/ai/body.js's, in metres a second: speed
// along its facing, side to its right, turn) is how it's moving.
//   Rigged, it's on an animator (lib/three/animator.js): the idle, walk and
//   run weighed to the whole and the one it lacks handed on, each copy's
//   clocks its own; motion paces them to the ground where they can be (its
//   strides measured by its toes, or by its feet on a rig not Meshy's, or
//   the catalogue row's clipSpeed). A walk with no idle, stopping, finishes
//   its step onto a foot rather than freezing mid-stride. Its calls play its
//   own clips (and the library's, when it stands on Meshy's skeleton), turn
//   its head and react.
//   Without legs to walk on (no clips, or only an idle), it sways in its
//   step (gait.js: a rise over each foot and a lean onto it, by the ground
//   it covers, never on the clock), and with no clips at all it breathes as
//   it stands, each in its own time: none frozen, none gliding at one
//   height. Its calls do nothing.
export function modelFigureOf(scene, { animations = [], anim: names = null, seed = 0, clipSpeed = null, machine = false } = {}) {
  const model = new THREE.Group();
  model.add(scene);
  const box = new THREE.Box3().setFromObject(scene);
  const tall = box.max.y - box.min.y;
  const clips = {};
  for (const [name, clipName] of Object.entries(names ?? {})) {
    const clip = animations.find((c) => c.name === clipName);
    if (clip) clips[name] = clip;
  }
  // (the library's clips are made for Meshy's skeleton: on another, its own
  // only; on it, turned about its up to face where its walk does)
  const meshy = ['Hips', 'LeftUpLeg', 'RightUpLeg', 'Spine02', 'Head'].every((n) => scene.getObjectByName(n)?.isBone);
  const hips = meshy ? scene.getObjectByName('Hips') : null;
  const up = hips?.parent ? new THREE.Vector3(0, 1, 0).applyQuaternion(hips.parent.getWorldQuaternion(new THREE.Quaternion()).invert()) : null;
  const walks = Boolean(clips.walk || clips.run); // (its clips walk it: no sway over them)
  // (a rig not Meshy's that walks: its feet stand in for the toes its stride's measured by)
  const feet = walks && !meshy ? feetOf(scene) : null;
  const bones = feet ? { LeftToeBase: feet.left, RightToeBase: feet.right } : null;
  const anim = Object.keys(clips).length ? createAnimator(scene, { clips, seed, up, bones, clipSpeed }) : null;
  // (a stride measured that can't be one, a clip that moves itself along: not gone by)
  if (anim && feet)
    for (const k of ['walk', 'run']) {
      const s = anim.loco.strides[k];
      if (s && !(s.speed > 0.08 * tall && s.speed < 2.5 * tall)) delete anim.loco.strides[k];
    }
  const calls = anim ? animatorCalls(anim, { model: scene, seed, own: Object.keys(clips), library: meshy }) : NO_CALLS;
  const rest = { y: scene.position.y, z: scene.rotation.z, scale: scene.scale.clone() };
  let gait = null; // (made at its first step: its stride is its height as the caller has scaled it)
  let clock = 0;
  let settled = true; // (a walk with no idle: standing on a foot)
  const forward = new THREE.Vector3();
  const q = new THREE.Quaternion();
  // a walk with no idle, stopped: on through its stride to the next foot
  // coming down (½ a stride apart, from where the left comes down), at a
  // creep, then held there
  const settle = (m, moving) => {
    if (clips.idle || !walks) return m;
    if (moving) {
      settled = false;
      return m;
    }
    const a = anim.actions.walk ?? anim.actions.run;
    if (settled || !a) return m;
    const stride = anim.loco.strides[anim.actions.walk ? 'walk' : 'run'];
    const at = ((((a.time / a.getClip().duration - (stride?.plant ?? 0)) % 1) + 1) % 1) % 0.5;
    if (at < CONTACT || at > 0.5 - CONTACT) {
      settled = true;
      return m;
    }
    // (with a stride to go by, its ground at a creep; without, its old pace's)
    return stride ? { ...m, move: CREEP, speed: stride.speed * 0.6, side: 0 } : { move: CREEP };
  };
  return {
    model,
    tall,
    anim,
    update(dt, move, motion = null) {
      clock += dt;
      // (the ground it covers, in metres a second, backward under 0)
      const speed = motion ? Math.hypot(motion.speed ?? 0, motion.side ?? 0) * ((motion.speed ?? 0) < 0 ? -1 : 1) : move * TOP;
      if (anim) {
        const moving = Math.abs(speed) > 0.05;
        // (in the units it stands in, under the caller's scale)
        const k = model.scale.x || 1;
        const m = settle(motion ? { move, ...motion, speed: (motion.speed ?? 0) / k, side: (motion.side ?? 0) / k } : { move }, moving);
        calls.tick(dt, moving);
        anim.locomote(m);
        // (the far ones are stepped four frames' worth at once: in tenths,
        // the most the animator takes at a time, up to four)
        for (let left = Math.min(dt, 0.4); left > 1e-6; left -= 0.1) anim.update(Math.min(0.1, left));
        model.getWorldQuaternion(q);
        forward.set(0, 0, 1).applyQuaternion(q);
        anim.after(dt, m, { forward, up: UP });
        if (walks) return;
      }
      // (a droid on wheels, repulsors or legs it came without: no person's
      // sway or breath, only a machine's hum, steady as it goes)
      if (machine) {
        scene.position.y = rest.y + Math.sin(clock * 9 + seed) * 0.004 * tall;
        return;
      }
      gait ??= createGait({ stride: 0.75 * tall * (model.scale.y || 1), cadence: [1.2, 2.2], seed });
      const g = gait.step(dt, speed);
      // (a shuffle sways less than a stride)
      const s = sway(g.phase, g.amount * Math.min(1, Math.abs(speed) / 1.2));
      scene.position.y = rest.y + s.bob * (anim ? 0.03 : 0.035) * tall;
      if (anim) return; // (its idle breathes for it)
      scene.rotation.z = rest.z + s.roll * 0.03;
      const b = breathe(clock, seed) * 0.006 * (1 - g.amount);
      scene.scale.set(rest.scale.x * (1 - b / 2), rest.scale.y * (1 + b), rest.scale.z * (1 - b / 2));
    },
    play: calls.play,
    stop: calls.stop,
    base: calls.base,
    look: calls.look,
    react: calls.react,
    // how far its step has it off where it stands (the sway's rise and roll,
    // in its own frame): for a rider on its back to go with it (riders.js)
    sway: () => ({ y: (scene.position.y - rest.y) * (model.scale.y || 1), roll: scene.rotation.z - rest.z }),
    dispose() {
      anim?.dispose();
    },
  };
}

// one of props/*.js's, walking: its update(t, dt, move) swings its legs
function propFigure(kind, spec, kit, i = 0) {
  const make = PROPS[kind];
  if (!make || !kit) return null;
  const made = make(kit, spec.opts ?? {});
  // (it walks: its scans go with it, kit.js's twins)
  kit.moving?.(made.object);
  let t = rng(seedOf(kind, i))() * 10; // (each of them somewhere of its own in its stride)
  const box = new THREE.Box3().setFromObject(made.object);
  return markBuilt({
    model: made.object,
    tall: box.max.y - box.min.y,
    update(dt, move) {
      t += dt;
      made.update?.(t, dt, move);
    },
    dispose() {},
  });
}
// A figure for any kind there is one of, by name: a crew model (crew.js), a
// catalogue model walking with its clips or a bob (modelFigure), a built
// figure (figures.js) or a humanoid prop (props/*.js, given the kit); null
// for a kind that's none of those. `spec.model: false` builds it even where
// there's a model; i is which of the entry's figures (a crew kind's face).
// `only`: a world that takes models only (a site's `cast: 'models'`): never
// built, its files tried twice, then a stand-in, then nothing (cast.js).
const warned = new Set();
const warnOnce = (kind) => {
  if (!import.meta.env?.DEV || warned.has(kind)) return;
  warned.add(kind);
  console.warn('[surface] no model for', kind);
};
export async function anyFigure(kind, spec = {}, kit = null, i = 0, models = SURFACE_MODELS, { only = false } = {}) {
  if (spec.model === false && !only) return buildFigure(kind) ?? propFigure(kind, spec, kit, i);
  return resolveFigure(
    kind,
    {
      // (a machine on legs its model came without: cut at its joints and walked, its rider up top; walkers.js)
      walker: (k) => (WALKERS[k] ? walkerFigure(k, i, models) : null),
      crew: (k) => crewFigure(k, i),
      model: (k) => modelFigure(k, models),
      built: (k) => buildFigure(k),
      prop: (k) => propFigure(k, spec, kit, i),
    },
    { only, warn: warnOnce },
  );
}

// How far off the fog has someone all but gone (97% fog, FogExp2's
// 1 − e^−(density·d)²): past it a person isn't drawn or moved about in.
export const fogCutoff = (density) => (density > 0 ? Math.sqrt(-Math.log(0.03)) / density : Infinity);
const FAR = 60; // metres: past it, a person's legs are moved four frames at a time
const LIVELY = 45; // metres: nearer, a person's head turns and its hands go (further, nobody'd see)
const MINGLE = 70; // metres from you: past it, nobody's company is worked out
const COMPANY = 70; // seconds for one who likes company to want it from none
const HEARD = 3; // seconds a head stays turned to a shot
const LEAP = 4; // metres moved between two steps that's no step: put somewhere (a quest's)
const EYES = 1.6; // metres: your eyes over your feet, for a head turned to you
const FLOOR = 4; // metres up or down: someone on another floor isn't greeting you

export function createActors({ parent, world, life = [], wants = [], talk = null, seed = 5, warm = (o) => Promise.resolve(o), small = false, kit = null, fog = () => 0, water = null, figure = null, models = SURFACE_MODELS, only = false, place = null }) {
  const group = new THREE.Group();
  group.name = 'life';
  parent.add(group);
  // (the people inside the zones: drawn only while you're in one)
  const rooms = new THREE.Group();
  rooms.name = 'life-inside';
  rooms.visible = false;
  parent.add(rooms);
  const r = rng(seed);
  // (the bodies' own chances, apart from the brains', so a brain's picks stay as they were)
  const r2 = rng(seed + 7919);
  const actors = [];
  // the site's wants as places, this scene's own (whose slot is whose goes with it)
  const places = placesOf(wants);
  const social = createSocial({ rand: rng(seed + 104729) });
  const heard = []; // (shots and blasts since the last update)
  let lastYou = null;
  let dead = false;

  // (a page's own maker first, the Rick and Morty cast; what it has nothing
  // for, or fails to make, is made as any other kind)
  // (a world's everyday people are the game's civilians of that place,
  // pools.js; one that won't load gives way to the kind the world named)
  const anyOf = (kind, spec, i) => {
    const pooled = poolFor(kind, place, i);
    const named = () => anyFigure(kind, spec, kit, i, models, { only });
    return pooled === kind ? named() : anyFigure(pooled, spec, kit, i, models, { only }).catch(() => null).then((f) => f ?? named());
  };
  const figureOf = figure
    ? (kind, spec, i) =>
        Promise.resolve(figure(kind, spec, i))
          .catch(() => null)
          .then((fig) => fig ?? anyOf(kind, spec, i))
    : anyOf;
  // (has something to say: a list with lines, or a tree)
  const talks = (spec) => (Array.isArray(spec.says) ? spec.says.length > 0 : Boolean(spec.says));

  life.forEach((spec, si) => {
    const n = spec.n ?? 1;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * (spec.spread ?? 0);
      const home = spec.path ? [...spec.path[i % spec.path.length]] : [spec.at[0] + Math.cos(a) * d, spec.at[1] + Math.sin(a) * d];
      const b = brain(spec, home, r);
      if (spec.path) b.leg = (i + 1) % spec.path.length;
      const holder = new THREE.Group();
      holder.visible = false;
      (spec.zone ? rooms : group).add(holder);
      const actor = {
        spec,
        b,
        holder,
        fig: null,
        said: 0,
        near: false,
        i,
        n: actors.length,
        hidden: Boolean(spec.hidden),
        culled: false,
        manner: mannerOf(spec),
        // (a band: the entry's figures together, the first in front)
        group: spec.group && n > 1 && !spec.path && !spec.still ? `band${si}` : null,
        company: r2() * 0.45,
        tick: budgetClock(actors.length),
        prev: null,
      };
      actors.push(actor);
      Promise.resolve(figureOf(spec.kind, spec, i))
        .then((fig) => {
          if (dead || !fig) return;
          fig.model.scale.multiplyScalar(spec.scale ?? 1);
          holder.add(fig.model);
          actor.fig = fig;
          // a standing Jedi's or Sith's lit blade (`blade`: { color, hilt? }),
          // held as the figures built in code held theirs
          if (spec.blade) {
            actor.saber = heldBlade(spec.blade, (fig.tall ?? 1.8) * (spec.scale ?? 1));
            holder.add(actor.saber.arm);
          }
          // (one sat in a booth: sat)
          if (spec.sit) fig.base?.('sit');
          return warm(holder).then(() => (holder.visible = !actor.hidden && !actor.culled));
        })
        .catch(() => {});
    }
  });
  // whom the people see: the others out and about, as needs.js's relate reads them, and the walls between
  let clock = 0;
  const seesThrough = (a, c) => lineClear(world.solids, a, c);
  const others = (self) => actors.filter((o) => o !== self && !o.hidden && !o.culled && o.fig).map((o) => ({ kind: o.spec.kind, x: o.b.x, z: o.b.z }));
  // not into each other, or walls and trees
  const avoider = (self) => (x, z) => {
    if (world.solids) for (const s of world.solids.near(x, z, 0.6)) if (!s.off && s.type === 'circle' ? Math.hypot(x - s.x, z - s.z) < s.r + 0.4 : false) return true;
    for (const o of actors) if (o !== self && Math.hypot(x - o.b.x, z - o.b.z) < 0.9 * (o.spec.scale ?? 1) && Math.hypot(self.b.x - o.b.x, self.b.z - o.b.z) > Math.hypot(x - o.b.x, z - o.b.z)) return true;
    // (and not out of the shallows into deep water, unless it's a swimmer)
    if (!self.spec.dive && tooDeep(world, x, z) && !tooDeep(world, self.b.x, self.b.z)) return true;
    // (inside somewhere, the floor's flat and the world's edge is far off)
    if (self.spec.zone) return false;
    return world.normalAt?.(x, z)[1] < 0.75 || Math.hypot(x, z) > (world.reach ?? 600);
  };
  const ways = (a) => (a.avoiding ??= { avoid: avoider(a), wants: places, t: 0 }); // (made once a person, not every frame)

  // ── who's with whom ──
  // (busy: somewhere it has to be, or something it's doing, that a
  // conversation, a band or making way won't take it from)
  const busy = (a) => {
    const { b, spec } = a;
    return Boolean(spec.still || spec.path || a.near || b.use || b.chase || (b.flee && clock < b.flee.until) || (b.hold != null && clock < b.hold));
  };
  // whom social.js has doing what this frame: the people near enough to matter
  function mingle(dt, you, at) {
    const out = new Map();
    if (!at) return out;
    const people = [];
    for (const a of actors) {
      if (a.hidden || a.culled || !a.fig || Math.hypot(at.x - a.b.x, at.z - a.b.z) > MINGLE) continue;
      // (wanting company more as time goes, and none once it's talked)
      const chatty = a.manner.chats && talks(a.spec) && !a.spec.id && !a.spec.quest && !a.group;
      const talking = social.talking(a.n);
      if (a.talked && !talking) a.company = 0;
      a.talked = talking;
      if (chatty) a.company = Math.min(1, a.company + dt / COMPANY);
      people.push({ id: a.n, x: a.b.x, z: a.b.z, yaw: a.b.yaw, company: chatty ? a.company : 0, busy: busy(a), knows: Boolean(a.spec.named || a.spec.quest || a.spec.id), line: talks(a.spec), group: a.group, leader: a.i === 0 });
    }
    if (!people.length) return out;
    const me = you ? { x: you.x, z: you.z, yaw: you.yaw ?? 0, speed: Math.abs(you.speed ?? 0) } : null;
    for (const e of social.step(people, clock, dt, { you: me })) out.set(actors[e.who], e);
    return out;
  }
  // a step social.js has for it (to meet someone, to keep its place in a
  // band, out of your way, settling into a conversation); false: its own brain's
  function mingled(a, e, dt, you) {
    if (!e || busy(a)) return false;
    const { b, spec } = a;
    const pace = spec.speed ?? 1.2;
    const avoid = ways(a).avoid;
    const toward = (p) => (p ? Math.atan2(p.x - b.x, p.z - b.z) : null);
    if (e.mode === 'walk') {
      if (!e.to) return false;
      // (a band's one left behind catches up at a jog)
      approach(b, e.to, dt, { pace: Math.hypot(e.to.x - b.x, e.to.z - b.z) > 3 ? pace * 1.5 : pace, avoid });
      return true;
    }
    if (e.mode === 'talk' || e.mode === 'listen') {
      const o = actors[e.look];
      approach(b, e.to ?? b, dt, { pace: pace * 0.7, face: o ? toward(o.b) : null, sidestep: true, avoid });
      return true;
    }
    if (e.mode === 'makeway' && e.to) {
      approach(b, e.to, dt, { pace: Math.max(pace, 1.2), face: toward(you), sidestep: true, avoid });
      return true;
    }
    return false; // (a greeting: its own way, its head on you)
  }

  // ── what it hears ──
  function hearIt({ at, loudness = 1 }) {
    const p = Array.isArray(at) ? at : [at.x, at.z];
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return;
    const target = { x: p[0], z: p[1] };
    for (const a of actors) {
      if (a.hidden) continue;
      const how = hear(a.b, a.spec, { at: p, loudness }, clock, r2);
      if (!how) continue;
      a.heard = { at: target, until: clock + HEARD };
      const fig = a.fig;
      if (!fig?.react || a.culled) continue;
      // a townsman's scared step back (cut short when it runs); a trooper's
      // blaster up at it; a Tusken's gaffi stick held high (not every shot)
      if (how === 'scatter') {
        if (fig.react('gunfire', { target, moving: false }) && !a.spec.still) a.startled = true;
      } else if (how === 'raise') fig.play('aim.pistol', { layer: 'upper', hold: 2.5 });
      else if (how === 'brandish' && !(a.brandished > clock)) {
        fig.play('cheer', { layer: 'upper' });
        a.brandished = clock + 4;
      }
    }
  }

  // ── its body ──
  const eyesOf = (you) => ({ x: you.x, y: (you.y ?? 0) + EYES, z: you.z });
  const headOf = (o) => ({ x: o.b.x, y: o.holder.position.y + (o.fig?.tall ?? 1.7) * (o.spec.scale ?? 1) * 0.93, z: o.b.z });
  const level = (a, you) => Boolean(you) && Math.abs((you.y ?? 0) - a.holder.position.y) < FLOOR;
  // where its head turns: to you (you're talking to it, or it's greeting
  // you or getting out of your way), to whom it's talking with, to a shot
  function lookOf(a, e, you) {
    if (a.near && you) return eyesOf(you);
    if (a.heard && clock < a.heard.until) return a.heard.at;
    if (e?.look == null) return null;
    if (typeof e.look === 'number') return actors[e.look]?.fig ? headOf(actors[e.look]) : null;
    return level(a, you) ? eyesOf(you) : null;
  }
  // a place it's using: its clip played or its seat sat in; and up again
  function using(a) {
    const w = a.b.use?.want ?? null;
    if (w === a.using) return;
    const fig = a.fig;
    if (a.using?.base) fig.base?.(null);
    else if (a.using?.clip) fig.stop?.(0.35);
    if (w?.base) fig.base?.(w.base);
    else if (w?.clip) fig.play?.(w.clip, { loop: true, lasts: Math.max(1, (w.duration ?? 6) - 0.3) });
    a.using = w;
  }
  // what it shows of what it's doing, before its figure's stepped
  function show(a, e, you) {
    const fig = a.fig;
    using(a);
    if (!fig.react) return;
    // (startled into a run: the step back let go as it goes)
    if (a.startled && !(a.b.hold > clock)) {
      fig.stop(0.25, 'full');
      a.startled = false;
    }
    const look = lookOf(a, e, you);
    if (look) fig.look(look);
    else if (a.looking) fig.look(null);
    a.looking = Boolean(look);
    // the first time you come up this time: a wave, or what its kind does instead
    if (e?.wave && level(a, you) && a.manner.greets) {
      if (a.manner.greets === 'wave') fig.react('greet', { target: eyesOf(you) });
      else if (!(a.brandished > clock)) {
        fig.play(a.manner.greets, { layer: 'upper' });
        a.brandished = clock + 4;
      }
    }
    // walked into: shoved, and a look
    if (e?.shove && !a.shoved) fig.react('hit', { where: 'chest', moving: true });
    a.shoved = Boolean(e?.shove);
    // its turn in a conversation: its hands going as it talks
    const chatting = e?.mode === 'talk';
    if (chatting !== Boolean(a.chatting)) {
      if (chatting) fig.play('talk', { layer: 'upper', loop: true });
      else fig.stop(0.3, 'upper');
      a.chatting = chatting;
    }
  }
  // its figure stepped: as often as how far off it is says (every frame
  // near, every fourth far, not at all far off on a small device), moving
  // as its brain moved it since it was last stepped
  function stepFigure(a, dt, d, you, e) {
    // (the cut its distance wants: a full-fidelity 2017 kind's, crew.js)
    a.fig.cutAt?.(d);
    const by = a.tick(d < FAR ? 1 : small ? 0 : 0.25, dt);
    if (!(by > 0)) return;
    const { b } = a;
    const now = { x: b.x, z: b.z, yaw: b.yaw };
    const leapt = !a.prev || Math.hypot(now.x - a.prev.x, now.z - a.prev.z) > LEAP;
    const m = leapt ? { speed: 0, side: 0, turn: 0 } : bodyFrom(a.prev, now, by).motion;
    a.prev = now;
    if (d < LIVELY) show(a, e, you);
    else using(a);
    a.fig.update(by, Math.min(1, Math.hypot(m.speed, m.side) / TOP), { speed: m.speed, side: m.side, turn: m.turn, air: 0 });
  }

  return {
    group,
    // in a zone, its people and not the world's; out, the other way round
    setZone(inZone) {
      const v = zoneVisibility(inZone);
      group.visible = v.outdoors;
      rooms.visible = v.zones;
    },
    actors,
    places,
    // a shot or a blast (loudness 1 a blaster's, 2 a detonator's), for whoever's in earshot
    hear({ at, loudness = 1 } = {}) {
      if (at) heard.push({ at, loudness });
    },
    // each frame: on with what they're doing; the ones near `you` turn to you
    // (`at`: where the fog is measured from, you even when you're riding or flying)
    update(dt, you, at = you) {
      clock += dt;
      lastYou = you;
      const cut = fogCutoff(fog());
      for (const s of heard.splice(0)) hearIt(s);
      const doing = mingle(dt, you, at);
      for (const a of actors) {
        const { b, spec } = a;
        if (a.hidden) continue;
        // (lost in the fog: not drawn, and not walked about; they pick up
        // where they were when you come near)
        const d = at ? Math.hypot(at.x - b.x, at.z - b.z) : 0;
        const culled = d > cut;
        if (culled !== a.culled) {
          a.culled = culled;
          a.holder.visible = !culled && Boolean(a.fig);
          a.prev = null;
        }
        if (culled) continue;
        const near = you && Math.hypot(you.x - b.x, you.z - b.z) < Math.max(TALK, spec.reach ?? 0) && Math.abs(you.y - a.holder.position.y) < 4 && (talks(spec) || spec.turn || spec.quest || spec.id);
        const e = doing.get(a) ?? null;
        a.mode = e?.mode ?? null;
        if (near) {
          b.speed = Math.max(0, b.speed - dt * 4);
          // (turned to you, unless it's sat or busy at something: then its head alone)
          if (!b.use && !spec.sit) b.yaw = turnToward(b.yaw, Math.atan2(you.x - b.x, you.z - b.z), 4 * dt);
        } else if (!mingled(a, e, dt, you)) {
          // (whom it knows, looked for every half second: the others of the kinds it fears or chases, in its sight)
          if ((spec.fears || spec.chases) && (a.looked = (a.looked ?? r()) + dt) > 0.5) {
            a.looked = 0;
            relate(b, spec, others(a), clock, { seesThrough });
          }
          const w = ways(a);
          w.t = clock;
          w.you = you;
          think(b, spec, dt, r, w);
        }
        a.near = Boolean(near);
        const g = groundAt(world, b.x, b.z, spec.level ?? Infinity);
        let y = spec.y != null ? g + spec.y + Math.sin(performance.now() / 700 + a.i) * 0.15 : g;
        let pitch = 0;
        if (spec.dive && water?.height) {
          // (down into the sea and out, a splash each way)
          const dv = diveAt(performance.now() / 1000, (a.i * 0.37) % 1, spec.dive);
          y = water.height(b.x, b.z) + dv.y;
          pitch = dv.pitch;
          if (a.under != null && a.under !== dv.y < 0 && d < 500) water.splash(b.x, b.z, 1.4);
          a.under = dv.y < 0;
        }
        // (one hung by the ankles, `hang` metres up: upside down, the feet at that height)
        a.holder.position.set(b.x, spec.hang != null ? g + spec.hang : y, b.z);
        a.holder.rotation.set(pitch, b.yaw, spec.hang != null ? Math.PI : 0, 'YXZ');
        if (a.fig) stepFigure(a, dt, d, you, e);
      }
    },
    // (for tests: who's about, where, and what each wants)
    debug: () =>
      actors
        .filter((a) => !a.hidden)
        .map((a) => ({ kind: a.spec.kind, id: a.spec.id ?? null, at: [+a.b.x.toFixed(1), +a.b.z.toFixed(1)], want: a.b.want?.id ?? null, last: a.b.last, flee: Boolean(a.b.flee), chase: Boolean(a.b.chase), culled: a.culled, use: a.b.use?.want.id ?? null, with: a.mode, fig: Boolean(a.fig), rigged: Boolean(a.fig?.anim) })),
    // one by its id (a quest's), where it is now
    find(id) {
      return actors.find((a) => a.spec.id === id && !a.hidden) ?? null;
    },
    // gone for now (someone a quest takes away: Greedo, out of his booth
    // and at you), or back
    hide(id, hidden = true) {
      for (const a of actors)
        if (a.spec.id === id) {
          a.hidden = hidden;
          a.holder.visible = !hidden && !a.culled && Boolean(a.fig);
        }
    },
    // everyone of some kinds gone for now (the troopers standing about a
    // world while a battle's fought over it), or back
    hideKinds(kinds, hidden = true) {
      for (const a of actors)
        if (kinds.includes(a.spec.kind)) {
          a.hidden = hidden;
          a.holder.visible = !hidden && !a.culled && Boolean(a.fig);
        }
    },
    // the nearest one with something to say, within reach of (x, z)
    talker(x, z, reach = 3, y = null) {
      let best = null;
      let bestD = Infinity;
      for (const a of actors) {
        if (!(talks(a.spec) || a.spec.quest || a.spec.id) || !a.fig || a.hidden) continue;
        if (y != null && Math.abs(y - a.holder.position.y) > 3) continue;
        // (someone big, a Hutt on his dais, can be talked to from further off)
        const d = Math.hypot(x - a.b.x, z - a.b.z);
        if (d < (a.spec.reach ?? reach) && d < bestD) {
          best = a;
          bestD = d;
        }
      }
      return best;
    },
    // what they say next (round and round their lines), and in whose voice
    // where it isn't their name's (voicelines.js); said with their body (a
    // Tusken's stick held high, anyone else's hands going for the line's
    // length, looking at you; a line that's only what it does, in brackets,
    // it does instead)
    say(a) {
      const lines = talkFor(a.spec.says, talk?.() ?? null);
      if (!lines.length) return null;
      const line = lines[a.said % lines.length];
      a.said += 1;
      const own = a.spec.name ?? a.spec.kind;
      const out = Array.isArray(line) ? { who: line[0], text: line[1] } : { who: own, text: line, voice: a.spec.voice ?? null };
      const fig = a.fig;
      if (fig?.react && out.who === own) {
        if (a.manner.greets === 'cheer') fig.play('cheer', { layer: 'upper' });
        else if (!/^\s*\(/.test(out.text)) fig.react('say', { target: lastYou ? eyesOf(lastYou) : null, hold: Math.min(6, Math.max(1.5, out.text.length / 14)) });
      }
      return out;
    },
    // keep `you` out of everyone (they're solid, but they move)
    shove(you, radius) {
      for (const a of actors) {
        if (a.spec.solid === false || !a.fig || a.hidden) continue;
        const rr = (a.spec.r ?? 0.4) * (a.spec.scale ?? 1) + radius;
        const dx = you.x - a.b.x;
        const dz = you.z - a.b.z;
        const d = Math.hypot(dx, dz);
        if (d < rr && d > 1e-6) {
          you.x = a.b.x + (dx / d) * rr;
          you.z = a.b.z + (dz / d) * rr;
        }
      }
    },
    dispose() {
      dead = true;
      for (const a of actors) {
        a.fig?.dispose();
        a.saber?.owned.forEach((o) => o.dispose?.());
      }
      group.removeFromParent();
      rooms.removeFromParent();
    },
  };
}
