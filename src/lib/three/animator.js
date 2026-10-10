// One body per rigged figure: its mixer, and everything laid over it. The
// base is the mixer, its weights always summing to exactly 1 (three.js
// fills a total under 1 with the bind pose): locomotion's idle, walk and
// run (locomotion.js, paced to the ground), or a base state in their place
// (sitting, crouching, swimming), and over both a full-body one-shot. An
// upper or lower layer (a wave while walking, a stance under a stroke), or
// an arm's (a held staff's arm kept from the walk's swing), is
// laid over the mixer's result by hand: the layer's clip sampled through its own interpolants at its own
// time, each masked bone slerped `w` of the way from where the mixer put it
// toward where the layer has it. Then the head turns to look.
// (docs/superpowers/specs/2026-10-07-living-characters-design.md, animator.js)
//
// createAnimator(model, { clips, hipsY, bones, unit = 1, seed = 0, up, key,
//   clipSpeed, library = true }) → animator
//   clips: { name: AnimationClip } the figure's own (idle, walk and run at
//   least, made for it); any other clip it's asked to play comes from the
//   library (clipLibrary.js forFigure: hipsY, up and key are for that, the
//   hips' height in its rig's units, the hips' parent's up, the figure's
//   template; `library: false` for a figure that plays only its own, as a
//   2017 one plays only the game's: walrus.js). bones: { name: Bone }, else found by name. unit, clipSpeed:
//   locomotion.js's. seed: every clock it starts (its idle's start, its
//   base loops', its fidgets'), so a crowd never breathes in unison.
//
//   mixer, actions ({ name: AnimationAction }), loco (locomotion.js's)
//   locomote(m): the motion for locomotion (its update's m); a caller that
//     knows only `move` gives { move }
//   add(name, clip) → bool: a clip the caller already has, the figure's
//     own from now on (played and based on as `clips`' are, never fetched);
//     false, and nothing changed, when it has one by that name already
//   base(name | null, { fade }) → Promise<'done' | 'cut'>: a looping base
//     state in place of locomotion (null: back to it). Into a group's state
//     ('sit.idle', 'sit.talk') through its `.enter` clip when it has one,
//     out through its `.exit`; resolves once it's there (its clips come and
//     it faded all the way in), cut by another ask
//   play(name, { layer = 'full' | 'upper' | 'lower' | 'arm.r' | 'arm.l', loop,
//     hold, fade, speed, at }) → Promise<'done' | 'cut'>: a clip on a layer,
//     each layer one slot (the arms' laid over the upper's; a full-body play
//     cuts them). The clip already in its slot restarts in place (its weight
//     kept, its promise still to come); another fades the last out (cut),
//     and one still fading from before is stopped first, so nothing's left
//     at a part weight. loop: whether it repeats (CLIPS's say, else no);
//     hold: kept on its last frame until stopped; at: seconds in to start
//     from. Done when it's played through; a clip it can't have is cut.
//   post(fn | null): fn(step) laid after the layers and before the look,
//     on each step (the game's additive clips: additiveLayer.js)
//   restance({ name: clip }) → [name…]: clips in place of its own by those
//     names (a weapon's stance, walrusSets/stance.js): idle, walk and run
//     taken over where they are, at their weight, their strides measured
//     afresh; any other the next time it's played (one playing now plays out)
//   stop(layer = 'full', fade): the layer's clip faded out (cut)
//   playing(layer = 'full') → the name of the clip in the layer's slot, or null
//   weight(layer, w?) → w: how much of a layer over the mixer is laid on
//     (1 unless set; 0 lays nothing), read when w is left out
//   look(target | null, { weight = 1, yaw = 1.1, pitch = 0.6, rate = 6 }):
//     the neck and head turned toward a point in the world (a copy is
//     kept), clamped to `yaw` and `pitch` either way, eased at `rate`, the
//     neck a third; beyond the clamp the chest turns a little and stops
//   idles({ fidgets: [name…], every: [lo, hi] } | null): standing still with
//     nothing else on, a fidget on the upper layer every lo to hi seconds
//   queue([{ play, …play's options } | { base, fade } | { wait } | { look,
//     …look's options }]) → Promise<'done' | 'cut'>: steps one after
//     another; a play or a base from outside on a layer it uses cuts it, as
//     does a step cut or another queue
//   update(dt, { lodRate = 1 }): before the figure's placed. A frame counts
//     for a tenth of a second at most; lodRate is the share of frames it's
//     stepped on (animBudget.js's rate: at 0.25 every fourth frame by the
//     four frames' time, at 0 not at all, its pose held)
//   after(dt, motion, frame): once it's placed (frame: { forward, up } in
//     the world, else its model's +z and +y): locomotion's bones, the
//     layers, the look. Call it every frame, frame or no, after update
//   dispose()
// MESHY_MASKS: { upper, lower, 'arm.r', 'arm.l' } the bones each layer may
//   move on Meshy's skeleton (the lower turns the hips, never moves them;
//   an arm's, the shoulder to the hand)

import * as THREE from 'three';
import { seeded } from '../seeded';
import { CLIPS, forFigure, heading } from './clipLibrary';
import { rotateWorld } from './ik';
import { createLocomotion } from './locomotion';

export const MESHY_MASKS = {
  // (and the 2017 game's chest and neck, Spine1, Spine2, Neck, Neck1: a body
  // on its skeleton has none of Meshy's names, nor a Meshy body these)
  upper: ['Spine02', 'Spine01', 'Spine', 'neck', 'Spine1', 'Spine2', 'Neck', 'Neck1', 'Head', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'],
  lower: ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'],
  'arm.r': ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'],
  'arm.l': ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'],
};
const MASK = Object.fromEntries(Object.entries(MESHY_MASKS).map(([k, v]) => [k, new Set(v)]));

const LONGEST = 0.1; // the most a frame counts for (s): a tab come back to doesn't leap
const FADE = 0.2; // a one-shot's fade in and out (s)
const BASE_FADE = 0.3; // between base states (s)
const CHEST = 0.3; // how far the chest turns after a look beyond its clamp (rad)
const LOCO = ['idle', 'walk', 'run'];
const LAYERS = ['upper', 'lower', 'arm.r', 'arm.l'];
const ARMS = ['arm.r', 'arm.l'];
const LAID = ['lower', 'upper', ...ARMS]; // (the order they're laid on, the arms last)
const SLOTS = new Set(['full', ...LAYERS]);
const each = (v) => Object.fromEntries([...SLOTS].map((k) => [k, v]));

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const group = (n) => (n == null ? null : n.split('.')[0]);
// a seed of any kind to the integers seeded() wants, small ones spread apart
const seedOf = (s) => Math.imul((Number.isInteger(s) ? s : Math.floor((Number(s) || 0) * 0x7fffffff)) ^ 0x2545f491, 0x9e3779b1);
// a bone's name without its rig's prefix or a download's number (rig.js's)
const plain = (n) =>
  n
    .replace(/^mixamorig:?/i, '')
    .replace(/^CC_Base_/i, '')
    .replace(/_\d+$/, '')
    .toLowerCase();
const HEADS = new Set(['head', 'c_spine04_head_xb']);
const parentBone = (b) => (b?.parent?.isBone ? b.parent : null);

// something to wait on: { promise, resolve, result }
const pending = (o = {}) => {
  o.result = null;
  o.promise = new Promise((r) => (o.resolve = r));
  return o;
};
const settle = (o, result) => {
  if (!o || o.result) return;
  o.result = result;
  o.resolve(result);
};
const settled = (result) => {
  const o = pending();
  settle(o, result);
  return o;
};

const _q = new THREE.Quaternion();
const _mq = new THREE.Quaternion();
const _h = new THREE.Vector3();
const _d = new THREE.Vector3();
const _f = new THREE.Vector3();
const _u = new THREE.Vector3();
const _l = new THREE.Vector3();
const _r = new THREE.Vector3();

// the sampled parts of a layer's clip: each masked bone the figure has,
// with its own interpolant; then laid `w` of the way on at time t
const lay = (parts, t, w) => {
  if (!(w > 1e-4)) return;
  for (const p of parts) {
    const v = p.at.evaluate(t);
    p.bone.quaternion.slerp(_q.set(v[0], v[1], v[2], v[3]), Math.min(1, w));
  }
};

export function createAnimator(model, { clips = {}, hipsY = null, bones = null, unit = 1, seed = 0, up = null, key = null, clipSpeed = null, library = true } = {}) {
  const byName = {};
  model.traverse((o) => {
    if (o.isBone && !(o.name in byName)) byName[o.name] = o;
  });
  const bone = (n) => bones?.[n] ?? byName[n] ?? null;
  const rand = seeded(seedOf(seed));
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  const got = new Map(Object.entries(clips).filter(([, c]) => c)); // name → clip, the figure's and those fetched for it
  hipsY ??= bone('Hips')?.position.y ?? null;
  const ahead = up && got.get('walk') ? heading(got.get('walk'), up) : null;

  const actionOf = (name) => {
    if (!actions[name] && got.has(name)) actions[name] = mixer.clipAction(got.get(name));
    return actions[name] ?? null;
  };
  // a clip from the library, made for this figure (once)
  const loading = new Map();
  const fetchClip = (name) => {
    if (got.has(name)) return Promise.resolve(got.get(name));
    if (!library || !CLIPS[name]) return Promise.resolve(null);
    if (!loading.has(name))
      loading.set(
        name,
        forFigure(name, { hipsY, up, key, ahead }).then(
          (c) => {
            // (one added by hand while it came stays: the figure's own)
            if (got.has(name)) return got.get(name);
            if (c) got.set(name, c);
            else loading.delete(name);
            return c;
          },
          () => {
            loading.delete(name);
            return got.get(name) ?? null;
          },
        ),
      );
    return loading.get(name);
  };

  // locomotion's clips, each started somewhere of the seed's choosing (the
  // first there, the idle when it is, all the weight until locomotion says)
  const act = {};
  for (const n of LOCO) {
    const a = actionOf(n);
    if (!a) continue;
    a.play();
    a.setEffectiveWeight(Object.keys(act).length ? 0 : 1);
    a.time = rand() * a.getClip().duration;
    act[n] = a;
  }
  const loco = createLocomotion({ model, bones: bones ?? byName }, { mixer, act, root: model, unit, clipSpeed, key, phase: rand() });

  // the head, the neck and the chest, for the look (by role, for rigs not Meshy's)
  const head = bone('Head') ?? Object.values(byName).find((b) => HEADS.has(plain(b.name))) ?? null;
  const neck = bone('neck') ?? parentBone(head);
  const chest = parentBone(neck) === bone('Hips') ? null : parentBone(neck); // (never the hips: the legs would go round with it)
  // The bones turned after the mixer, as the mixer left them: put back
  // before it runs, since it only writes a bone whose blend has changed
  // (a held clip, a frame of 0), and on top of last frame's turns they'd
  // add up.
  const posed = [...new Set([...MESHY_MASKS.upper, ...MESHY_MASKS.lower].map(bone).concat([head, neck, chest]).filter(Boolean))];
  const saved = posed.map((b) => b.quaternion.clone());

  const st = {
    motion: {},
    held: 0, // time not yet stepped (s)
    share: rand(), // of a frame, toward the next step (lodRate)
    step: 0,
    stepped: false,
    disposed: false,
    // the base: entries fading toward the last, where it's going (id null: locomotion)
    bases: [{ id: null, action: null, w: 1, once: false, fade: BASE_FADE }],
    path: [], // the steps still to come on the way to a base state
    at: null, // the base state it's in or going to
    want: null,
    baseWait: null,
    slots: each(null),
    fading: each(null),
    tokens: each(0),
    scale: each(1), // (weight(): each layer's share laid on)
    idles: null,
    queue: null,
  };
  const lk = { on: false, target: new THREE.Vector3(), weight: 1, yaw: 1.1, pitch: 0.6, rate: 6, y: 0, p: 0, c: 0 };

  // ── the base ──
  function enterBase({ name, once, fade }) {
    const bs = st.bases;
    let e = bs.find((x) => x.id === name);
    if (e) {
      bs.splice(bs.indexOf(e), 1);
      if (once) e.action.reset().play();
    } else {
      e = { id: name, action: name == null ? null : actionOf(name), w: 0 };
      const a = e.action;
      if (a) {
        a.reset();
        a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        a.clampWhenFinished = true;
        a.timeScale = 1;
        a.time = once ? 0 : rand() * a.getClip().duration;
        a.setEffectiveWeight(0);
        a.play();
      }
    }
    e.once = once;
    e.fade = Math.max(fade, 1e-3);
    bs.push(e);
  }
  // the way from where it is to `name`: out of its group through its exit,
  // into the new one through its entry, when they're there
  function route(name, fade) {
    if (name != null && !got.has(name)) {
      settle(st.baseWait, 'cut');
      st.want = st.at;
      return;
    }
    const from = st.bases.at(-1).id;
    const gf = group(from);
    const gt = group(name);
    const steps = [];
    const exit = `${gf}.exit`;
    if (from != null && gf !== gt && from !== `${gf}.enter` && from !== exit && got.has(exit)) steps.push({ name: exit, once: true, fade });
    const entry = `${gt}.enter`;
    if (name != null && gf !== gt && got.has(entry)) steps.push({ name: entry, once: true, fade });
    steps.push({ name, once: false, fade });
    st.at = name;
    st.path = steps;
    enterBase(st.path.shift());
  }
  function goBase(name, { fade = BASE_FADE } = {}) {
    name ??= null;
    if (st.disposed) return settled('cut');
    if (name === st.want && st.baseWait) return st.baseWait;
    settle(st.baseWait, 'cut');
    const wait = pending();
    st.baseWait = wait;
    st.want = name;
    const go = () => st.baseWait === wait && !st.disposed && route(name, fade);
    const need = [name, `${group(name)}.enter`, `${group(st.at)}.exit`].filter((n) => n && !got.has(n) && CLIPS[n]);
    if (need.length) Promise.all(need.map(fetchClip)).then(go);
    else go();
    return wait;
  }
  function stepBase(step) {
    const bs = st.bases;
    const cur = bs.at(-1);
    // a way in or out, near its end, hands on to the next
    if (cur.once && st.path.length && cur.action.getClip().duration - cur.action.time <= cur.fade) enterBase(st.path.shift());
    const now = bs.at(-1);
    for (let i = bs.length - 1; i >= 0; i--) {
      const e = bs[i];
      if (e === now) e.w = Math.min(1, e.w + step / now.fade);
      else {
        e.w -= step / now.fade;
        if (e.w <= 0) {
          bs.splice(i, 1);
          if (e.action && !bs.some((x) => x.action === e.action)) {
            e.action.setEffectiveWeight(0);
            e.action.stop();
          }
        }
      }
    }
    // (there once it's the one asked for: not while its clips are still coming)
    if (!st.path.length && now.w >= 1 && bs.length === 1 && now.id === st.want) settle(st.baseWait, 'done');
  }

  // ── the slots ──
  const partsCache = new Map(); // clip → { upper, lower }: its parts on this figure
  function partsOf(clip, layer) {
    let by = partsCache.get(clip);
    if (!by) partsCache.set(clip, (by = {}));
    by[layer] ??= clip.tracks
      .map((tr) => {
        const i = tr.name.lastIndexOf('.');
        if (tr.name.slice(i + 1) !== 'quaternion' || !MASK[layer].has(tr.name.slice(0, i))) return null;
        const b = bone(tr.name.slice(0, i));
        return b && { bone: b, at: tr.createInterpolant() };
      })
      .filter(Boolean);
    return by[layer];
  }
  function drop(layer, e) {
    if (layer === 'full' && e.action) {
      e.action.setEffectiveWeight(0);
      e.action.stop();
    }
  }
  function toFading(layer, s, fade) {
    const stale = st.fading[layer];
    if (stale) drop(layer, stale);
    s.fade = Math.max(fade, 1e-3);
    st.fading[layer] = s;
  }
  function begin(layer, name, clip, { loop = CLIPS[name]?.loop ?? false, hold = false, fade = FADE, speed = 1, at = 0 } = {}) {
    let s = st.slots[layer];
    if (s?.name === name) {
      // the same clip: restarted where it is, its weight kept
      if (s.result) pending(s);
    } else {
      // (one fading out under it is taken back, its weight kept)
      const back = st.fading[layer]?.name === name ? st.fading[layer] : null;
      if (back) st.fading[layer] = null;
      if (s) {
        settle(s, 'cut');
        toFading(layer, s, fade);
      }
      s = pending({ name, clip, w: back?.w ?? 0, t: 0 });
      if (layer === 'full') s.action = actionOf(name);
      else s.parts = partsOf(clip, layer);
      st.slots[layer] = s;
    }
    Object.assign(s, { loop, hold, fade: Math.max(fade, 1e-3), speed, t: at });
    const a = s.action;
    if (a) {
      a.reset();
      a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.timeScale = speed;
      a.time = at;
      a.setEffectiveWeight(s.w);
      a.play();
    }
    return s;
  }
  // the layer's clip faded out, and anything still coming for it dropped
  function cut(layer, fade) {
    st.tokens[layer]++;
    const s = st.slots[layer];
    if (!s) return;
    settle(s, 'cut');
    st.slots[layer] = null;
    toFading(layer, s, fade);
  }
  // a play, as something to wait on: now when the clip's here, else once fetched
  function start(name, opts = {}, layer = opts.layer ?? 'full') {
    if (st.disposed || !SLOTS.has(layer)) return settled('cut');
    if (layer === 'full') for (const arm of ARMS) cut(arm, opts.fade ?? FADE);
    const token = ++st.tokens[layer];
    const clip = got.get(name);
    if (clip) return begin(layer, name, clip, opts);
    const handle = pending();
    fetchClip(name).then((c) => {
      if (!c || token !== st.tokens[layer] || st.disposed) settle(handle, 'cut');
      else begin(layer, name, c, opts).promise.then((r) => settle(handle, r));
    });
    return handle;
  }
  function stepFull(step) {
    const s = st.slots.full;
    if (s) {
      // its weight in, and out over its last `fade` (by where the mixer's about to put it)
      const a = s.action;
      const d = s.clip.duration;
      const next = Math.min(d, a.time + (a.paused ? 0 : step * s.speed));
      const out = s.loop || s.hold ? 1 : clamp((d - next) / (Math.max(Math.abs(s.speed), 1e-3) * s.fade), 0, 1);
      s.w = Math.min(s.w + step / s.fade, out);
    }
    const f = st.fading.full;
    if (f) {
      f.w -= step / f.fade;
      if (f.w <= 0) {
        drop('full', f);
        st.fading.full = null;
      } else if (s && s.w + f.w > 1) f.w = 1 - s.w;
    }
  }
  function endFull() {
    const s = st.slots.full;
    if (!s || s.loop || s.action.time < s.clip.duration) return;
    settle(s, 'done');
    if (s.hold) return;
    st.slots.full = null;
    if (s.w > 1e-6) toFading('full', s, s.fade);
    else drop('full', s);
  }
  function stepLayers(step) {
    for (const layer of LAYERS) {
      for (const s of [st.fading[layer], st.slots[layer]]) {
        if (!s) continue;
        const d = s.clip.duration;
        s.t += step * s.speed;
        s.t = s.loop ? (d > 0 ? ((s.t % d) + d) % d : 0) : clamp(s.t, 0, d);
      }
      const s = st.slots[layer];
      if (s) {
        const d = s.clip.duration;
        const out = s.loop || s.hold ? 1 : clamp((d - s.t) / (Math.max(Math.abs(s.speed), 1e-3) * s.fade), 0, 1);
        s.w = Math.min(s.w + step / s.fade, out);
        if (!s.loop && s.t >= d) {
          settle(s, 'done');
          if (!s.hold) st.slots[layer] = null;
        }
      }
      const f = st.fading[layer];
      if (f && (f.w -= step / f.fade) <= 0) st.fading[layer] = null;
    }
  }

  // the base's share of the mixer, split between its entries, after the
  // full-body slot's: always 1 between them
  function weigh() {
    const full = (st.slots.full?.w ?? 0) + (st.fading.full?.w ?? 0);
    const share = Math.max(0, 1 - full);
    let sum = 0;
    for (const e of st.bases) sum += Math.max(0, e.w);
    let locoK = 0;
    for (const e of st.bases) {
      const k = sum > 0 ? (share * Math.max(0, e.w)) / sum : e === st.bases.at(-1) ? share : 0;
      if (e.id == null) locoK = k;
      else e.action.setEffectiveWeight(k);
    }
    for (const n of LOCO) act[n]?.setEffectiveWeight(act[n].getEffectiveWeight() * locoK);
    st.slots.full?.action.setEffectiveWeight(st.slots.full.w);
    st.fading.full?.action.setEffectiveWeight(st.fading.full.w);
  }

  // ── the idles and the queue ──
  const between = (every) => every[0] + rand() * (every[1] - every[0]);
  function stepIdles(step) {
    const I = st.idles;
    if (!I) return;
    const m = st.motion;
    const still = (m.move ?? 0) < 0.04 && Math.hypot(m.speed ?? 0, m.side ?? 0) < 0.05 * unit && !((m.air ?? 0) > 0.03) && !((m.down ?? 0) > 0) && !((m.hurt ?? 0) > 0);
    if (!still) {
      I.moved = true;
      return;
    }
    if (I.moved) {
      I.moved = false;
      I.next = between(I.every);
    }
    if (st.at != null || st.slots.full || st.slots.upper || st.queue) return;
    I.next -= step;
    if (I.next > 0) return;
    I.next = between(I.every);
    api.play(I.fidgets[Math.floor(rand() * I.fidgets.length)], { layer: 'upper' });
  }
  function cutQueue() {
    const q = st.queue;
    st.queue = null;
    settle(q, 'cut');
  }
  function stepQueue(step) {
    const q = st.queue;
    for (let guard = 0; guard < 64 && st.queue === q && q; guard++) {
      const c = q.cur;
      if (c?.wait != null) {
        c.wait -= step;
        step = 0;
        if (c.wait > 1e-9) return;
      } else if (c) {
        if (!c.result) return;
        if (c.result === 'cut') {
          st.queue = null;
          settle(q, 'cut');
          return;
        }
      }
      const s = q.steps[++q.i];
      if (!s) {
        st.queue = null;
        settle(q, 'done');
        return;
      }
      if ('play' in s) q.cur = start(s.play, s);
      else if ('base' in s) q.cur = goBase(s.base, s);
      else if ('wait' in s) q.cur = { wait: Math.max(0, s.wait) };
      else {
        if ('look' in s) api.look(s.look, s);
        q.cur = null;
        continue;
      }
      if (q.cur.wait != null) return;
    }
  }

  // ── the look, after the layers ──
  function stepLook(step, frame) {
    // (nothing to look at and nothing left of the last look: no turn, so no sums)
    if (!head || (!lk.on && Math.abs(lk.y) + Math.abs(lk.p) + Math.abs(lk.c) < 1e-6)) return;
    model.getWorldQuaternion(_mq);
    const forward = (frame?.forward ? _f.copy(frame.forward) : _f.set(0, 0, 1).applyQuaternion(_mq)).normalize();
    const upw = (frame?.up ? _u.copy(frame.up) : _u.set(0, 1, 0).applyQuaternion(_mq)).normalize();
    let wy = 0;
    let wp = 0;
    let wc = 0;
    if (lk.on) {
      head.getWorldPosition(_h);
      _d.copy(lk.target).sub(_h);
      _l.crossVectors(upw, forward).normalize(); // (the figure's left)
      const x = _d.dot(_l);
      const z = _d.dot(forward);
      const want = Math.atan2(x, z);
      wy = clamp(want, -lk.yaw, lk.yaw) * lk.weight;
      wc = Math.sign(want) * Math.min(CHEST, Math.max(0, Math.abs(want) - lk.yaw)) * lk.weight;
      wp = clamp(Math.atan2(_d.dot(upw), Math.hypot(x, z)), -lk.pitch, lk.pitch) * lk.weight;
    }
    const k = 1 - Math.exp(-lk.rate * step);
    lk.y += (wy - lk.y) * k;
    lk.p += (wp - lk.p) * k;
    lk.c += (wc - lk.c) * k;
    if (Math.abs(lk.y) + Math.abs(lk.p) + Math.abs(lk.c) < 1e-6) return;
    // the chest first (the neck and head ride on it), then a third of the
    // turn to the neck and the rest to the head; nodding about its left
    // and right as it's turned (+ tips it back, to look up)
    _r.crossVectors(forward, upw).normalize().applyAxisAngle(upw, lk.c + lk.y);
    if (chest) rotateWorld(chest, upw, lk.c);
    if (neck) {
      rotateWorld(neck, upw, lk.y / 3);
      rotateWorld(neck, _r, lk.p / 3);
    }
    const rest = neck ? 2 / 3 : 1;
    rotateWorld(head, upw, lk.y * rest);
    rotateWorld(head, _r, lk.p * rest);
  }

  // whether a clip of that name is in a slot, or fading from one
  const inSlot = (name) => [...SLOTS].some((l) => st.slots[l]?.name === name || st.fading[l]?.name === name);

  const api = {
    mixer,
    actions,
    loco,
    locomote(m) {
      st.motion = m ?? {};
    },
    add(name, clip) {
      if (st.disposed || typeof name !== 'string' || !Array.isArray(clip?.tracks) || got.has(name)) return false;
      got.set(name, clip);
      return true;
    },
    base(name = null, opts = {}) {
      if (st.queue?.layers.has('base')) cutQueue();
      return goBase(name, opts).promise;
    },
    play(name, opts = {}) {
      const layer = opts.layer ?? 'full';
      if (st.queue?.layers.has(layer)) cutQueue();
      return start(name, opts, layer).promise;
    },
    stop(layer = 'full', fade = FADE) {
      if (st.queue?.layers.has(layer)) cutQueue();
      if (SLOTS.has(layer)) cut(layer, fade);
    },
    post(fn) {
      st.post = typeof fn === 'function' ? fn : null;
    },
    restance(set = {}) {
      if (st.disposed) return [];
      const done = [];
      for (const [name, clip] of Object.entries(set)) {
        if (!clip || got.get(name) === clip) continue;
        got.set(name, clip);
        const old = actions[name] ?? null;
        if (LOCO.includes(name)) {
          const a = mixer.clipAction(clip);
          a.play();
          a.setEffectiveWeight(old ? old.getEffectiveWeight() : 0);
          if (old) {
            a.timeScale = old.timeScale;
            a.time = (old.time / Math.max(old.getClip().duration, 1e-6)) * clip.duration;
            old.stop();
          }
          actions[name] = a;
          act[name] = a;
          loco.restride(name);
        } else if (old && !inSlot(name)) delete actions[name];
        done.push(name);
      }
      return done;
    },
    playing(layer = 'full') {
      return st.slots[layer]?.name ?? null;
    },
    weight(layer, w) {
      if (!SLOTS.has(layer) || layer === 'full') return 1;
      if (w != null) st.scale[layer] = clamp(Number(w) || 0, 0, 1);
      return st.scale[layer];
    },
    look(target, { weight = 1, yaw = 1.1, pitch = 0.6, rate = 6 } = {}) {
      lk.on = Boolean(target);
      if (target) lk.target.copy(target);
      Object.assign(lk, { weight, yaw, pitch, rate });
    },
    idles(o) {
      st.idles = o?.fidgets?.length ? { fidgets: o.fidgets, every: o.every ?? [6, 14], moved: false } : null;
      if (st.idles) st.idles.next = between(st.idles.every);
    },
    queue(steps = []) {
      cutQueue();
      if (st.disposed) return Promise.resolve('cut');
      const q = pending({ steps, i: -1, cur: null, layers: new Set() });
      for (const s of steps) {
        if ('play' in s) q.layers.add(s.layer ?? 'full');
        if ('base' in s) q.layers.add('base');
      }
      st.queue = q;
      stepQueue(0);
      return q.promise;
    },
    update(dt, { lodRate = 1 } = {}) {
      st.stepped = false;
      if (st.disposed) return;
      dt = dt > 0 ? Math.min(dt, LONGEST) : 0;
      if (!(lodRate > 0)) {
        st.held = 0;
        return;
      }
      st.held += dt;
      st.share += Math.min(1, lodRate);
      if (st.share < 1) return;
      st.share -= 1;
      const step = st.held;
      st.held = 0;
      st.step = step;
      st.stepped = true;
      for (let i = 0; i < posed.length; i++) posed[i].quaternion.copy(saved[i]);
      stepQueue(step);
      stepIdles(step);
      loco.update(step, st.motion);
      stepBase(step);
      stepFull(step);
      weigh();
      mixer.update(step);
      for (let i = 0; i < posed.length; i++) saved[i].copy(posed[i].quaternion);
      endFull();
      stepLayers(step);
    },
    after(dt, motion = null, frame = null) {
      if (!st.stepped || st.disposed) return;
      st.stepped = false; // (once a step)
      const step = st.step;
      loco.after(step, motion ?? st.motion, frame);
      for (const layer of LAID) {
        const k = st.scale[layer];
        const f = st.fading[layer];
        if (f) lay(f.parts, f.t, f.w * k);
        const s = st.slots[layer];
        if (s) lay(s.parts, s.t, s.w * k);
      }
      st.post?.(step);
      stepLook(step, frame);
    },
    dispose() {
      if (st.disposed) return;
      st.disposed = true;
      for (const layer of ['full', ...LAYERS]) settle(st.slots[layer], 'cut');
      settle(st.baseWait, 'cut');
      cutQueue();
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
    },
  };
  return api;
}
