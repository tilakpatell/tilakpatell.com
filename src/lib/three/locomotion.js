// How a figure on foot moves under its clips: the legs paced to the ground
// it covers (so its feet don't skate), walking backward and sideways on
// clips that only walk forward (the hips turned toward where it's going,
// the chest kept facing ahead), leaning into turns and starts, tucked up in
// a jump and crouching on landing, flinching when it's hit, and going down
// at the knees when it's beaten. This was universe/locomotion.js; it
// re-exports from here.
//
// strideOf(root, mixer, actions, action, toes) → { speed, plant, dur } or
//   null: how much ground a clip's feet cover a second (in the units of
//   root's parent, measured by playing the clip through and watching the
//   foot that's on the ground), when in it the left foot comes down (0…1),
//   and how long it is.
// strideCache: the strides measured, by `${clip.uuid}:${key}`, so the
//   copies of one figure template measure a clip once between them, not
//   once each (it's 49 mixer updates a clip).
// createLocomotion(fig, { mixer, act, root, unit, clipSpeed, key, phase }) → {
//   update(dt, m), after(dt, m, frame), drop, rig, strides }
//   update runs before the mixer (it picks and paces the clips); after
//   runs once the figure's placed, turning bones on top of the clip. m: {
//   move (0…1, as blend() had it), speed (along the facing, + ahead), side
//   (+ right), turn (rad/s, + left), air (metres off the ground), hurt
//   (0…1), knock (−1…1, which way round a hit turns them), down (0…1) },
//   speeds in root's parent's units a second; `unit` its units to the
//   metre. frame: { forward, up } in the world. `drop`: how far (root's
//   parent's units) to lower the figure for the crouch it's in.
//   `clipSpeed`: for a figure without toe bones to measure by, the metres a
//   second its walk covers at 1× (a number; the run taken as RUN_PACE times
//   it), or { walk, run }. `key`: the figure's template, for the cache
//   (copies sharing a key must share their clips and their scale).
//   `phase`: where in its stride it starts (0…1; a seeded figure's own,
//   so a crowd doesn't step off together).
//   A missing clip hands its weight on (a run to the walk, then the idle;
//   a walk to the idle, then the run; an idle to the walk, then the run),
//   so the weights always sum to 1 and nothing blends toward the bind pose;
//   a walk standing in for the run is paced to the run's ground.
// fallTurn(k, dir, up) → the turn onto the ground about the feet, `k` of
//   the way through a fall the way `dir` points.

import * as THREE from 'three';
import { rotateWorld } from './ik';

const V = THREE.Vector3;
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ── measuring a clip's stride ──
export function strideOf(root, mixer, actions, action, toes, samples = 48) {
  const clip = action?.getClip();
  if (!clip || !toes?.[0] || !toes?.[1]) return null;
  const saved = actions.map((a) => ({ a, w: a.getEffectiveWeight(), t: a.time }));
  for (const a of actions) a.setEffectiveWeight(a === action ? 1 : 0);
  const dur = clip.duration;
  const inv = root.parent ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert() : new THREE.Matrix4();
  const p = new V();
  const pts = [[], []];
  for (let i = 0; i <= samples; i++) {
    action.time = (i / samples) * dur;
    mixer.update(0);
    root.updateMatrixWorld(true);
    toes.forEach((t, k) => {
      t.getWorldPosition(p).applyMatrix4(inv);
      pts[k].push({ t: (i / samples) * dur, y: p.y, z: p.z });
    });
  }
  for (const { a, w, t } of saved) {
    a.setEffectiveWeight(w);
    a.time = t;
  }
  mixer.update(0);
  // a foot's on the ground while it's within a little of its lowest; there it
  // goes back under the body as fast as the body goes over the ground
  let sum = 0;
  let n = 0;
  let plant = 0;
  pts.forEach((list, k) => {
    const ys = list.map((o) => o.y);
    const low = Math.min(...ys);
    const near = low + (Math.max(...ys) - low) * 0.12;
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1];
      const b = list[i];
      if (a.y > near || b.y > near) continue;
      const vz = (b.z - a.z) / (b.t - a.t);
      if (vz < 0) {
        sum -= vz;
        n += 1;
      }
    }
    if (k === 0) plant = list.reduce((best, o) => (o.y < best.y ? o : best), list[0]).t / dur;
  });
  return n ? { speed: sum / n, plant, dur } : null;
}

const LEGS = [
  ['LeftUpLeg', 'LeftLeg', 'LeftFoot'],
  ['RightUpLeg', 'RightLeg', 'RightFoot'],
];
const NAMES = ['Hips', 'Spine02', 'Spine01', 'Spine', 'neck', 'Head', 'LeftArm', 'RightArm', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];

// how much more ground a run covers than a walk at the same pace: what a
// walk standing in for a missing run is quickened by, and a run's clipSpeed
// when a figure gives only its walk's
export const RUN_PACE = 1.6;
// where a missing clip's weight goes, nearest first
const HAND = { idle: ['walk', 'run'], walk: ['idle', 'run'], run: ['walk', 'idle'] };
const holder = (act, k) => {
  if (act[k]) return k;
  for (const o of HAND[k]) if (act[o]) return o;
  return null;
};

export const strideCache = new Map(); // `${clip.uuid}:${key}` → stride | null

export function createLocomotion(fig, { mixer = null, act = null, root = null, unit = 1, clipSpeed = null, key = null, phase = Math.random() } = {}) {
  const model = fig.model;
  const b = {};
  for (const n of NAMES) b[n] = fig.bones?.[n] ?? model.getObjectByName(n) ?? null;
  const rig = Boolean(b.Hips && b.LeftUpLeg && b.RightUpLeg && b.LeftLeg && b.RightLeg && b.LeftFoot && b.RightFoot);
  const actions = act ? Object.values(act).filter(Boolean) : [];
  // the clips' strides, before the figure's put anywhere: once for each
  // template, when it says which it is
  const strides = {};
  if (mixer && root && b.LeftToeBase && b.RightToeBase)
    for (const k of ['walk', 'run']) {
      const a = act?.[k];
      if (!a) continue;
      const id = key == null ? null : `${a.getClip().uuid}:${key}`;
      if (id && strideCache.has(id)) strides[k] = strideCache.get(id);
      else {
        strides[k] = strideOf(root, mixer, actions, a, [b.LeftToeBase, b.RightToeBase]);
        if (id) strideCache.set(id, strides[k]);
      }
    }
  // without toes to measure by, the metres a second the clips cover at 1×
  const cs = typeof clipSpeed === 'number' ? { walk: clipSpeed } : (clipSpeed ?? {});
  const paceWalk = cs.walk > 0 ? cs.walk : 0;
  const paceRun = cs.run > 0 ? cs.run : paceWalk * RUN_PACE;
  // hip to ankle, for how far a crouch lowers it
  let legLen = 0;
  if (rig && root) {
    root.updateMatrixWorld(true);
    const inv = root.parent ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert() : new THREE.Matrix4();
    const p = (o) => o.getWorldPosition(new V()).applyMatrix4(inv);
    legLen = p(b.LeftUpLeg).distanceTo(p(b.LeftLeg)) + p(b.LeftLeg).distanceTo(p(b.LeftFoot));
  }
  const st = { phase, yaw: 0, lean: 0, pitch: 0, last: 0, air: 0, land: 0, wasAir: false, drop: 0 };
  const right = new V();
  const w = { idle: 0, walk: 0, run: 0 }; // the weights, after the hand-off

  return {
    get drop() {
      return st.drop;
    },
    rig,
    strides,
    // a clip of its own put in by hand (animator.js's restance): its stride measured afresh
    restride(k) {
      const a = act?.[k];
      if (!mixer || !root || !a || !b.LeftToeBase || !b.RightToeBase || (k !== 'walk' && k !== 'run')) return;
      const s = strideOf(root, mixer, Object.values(act).filter(Boolean), a, [b.LeftToeBase, b.RightToeBase]);
      if (s) strides[k] = s;
      else delete strides[k];
    },
    // before the mixer: which clips, how fast, and where in their stride
    update(dt, m = {}) {
      dt = Math.min(dt, 0.1);
      const fwd = m.speed ?? 0;
      const side = m.side ?? 0;
      const ground = Math.hypot(fwd, side);
      const moving = ground > 0.05 * unit;
      // backward: the walk backward; any other way, forward with the hips turned to it
      const heading = moving ? Math.atan2(side, fwd) : 0; // (+ to the right of the facing)
      const back = moving && Math.abs(heading) > Math.PI * 0.58;
      const want = moving ? clamp(back ? wrap(heading - Math.PI) : heading, -1.05, 1.05) : 0;
      st.yaw += (want - st.yaw) * (1 - Math.exp(-dt * 8));
      // leaning into the turn (a turn to the left leans left) and into a start
      const mps = ground / unit;
      st.lean += (clamp(-(m.turn ?? 0) * Math.min(mps, 6) * 0.035, -0.16, 0.16) - st.lean) * (1 - Math.exp(-dt * 6));
      const accel = (fwd - st.last) / Math.max(dt, 1e-3) / unit;
      st.last = fwd;
      st.pitch += (clamp(accel * 0.012, -0.12, 0.16) - st.pitch) * (1 - Math.exp(-dt * 5));
      if (!mixer || !act) return;
      const move = m.move ?? 0;
      const run = smooth(0.55, 0.9, move);
      const idle = 1 - smooth(0.04, 0.3, move);
      const walk = Math.max(0, 1 - run - idle);
      // a missing clip's weight to the nearest there, so they sum to 1
      w.idle = w.walk = w.run = 0;
      const hi = holder(act, 'idle');
      const hw = holder(act, 'walk');
      const hr = holder(act, 'run');
      if (hi) w[hi] += idle;
      if (hw) w[hw] += walk;
      if (hr) w[hr] += run;
      const fromRun = hr === 'walk' ? run : 0;
      act.idle?.setEffectiveWeight(w.idle);
      act.walk?.setEffectiveWeight(w.walk);
      act.run?.setEffectiveWeight(w.run);
      // one stride for both clips: the phase goes round at the ground
      // covered over the stride's length (between the walk's and the run's
      // by their blend), the two held in step from where each puts its
      // left foot down. A walk standing in for the run goes round at the
      // run's ground over its own stride, so it turns over faster.
      const known = m.speed != null || m.side != null;
      const lw = strides.walk ? strides.walk.speed * strides.walk.dur : 0;
      const lr = strides.run ? strides.run.speed * strides.run.dur : 0;
      const stride = known && w.walk + w.run > 0 && (lw || lr) ? ((lw || lr) * w.walk + (lr || lw) * w.run) / (w.walk + w.run) : 0;
      if (stride > 0) {
        if (moving) st.phase += ((back ? -1 : 1) * ground * dt) / stride;
        st.phase -= Math.floor(st.phase);
        for (const k of ['walk', 'run']) {
          const a = act[k];
          if (!a) continue;
          a.timeScale = 0; // (held where the phase says)
          a.time = ((st.phase + (strides[k]?.plant ?? 0)) % 1) * a.getClip().duration;
        }
      } else if (known && paceWalk > 0) {
        // no stride to go by: the clips' own metres a second, from the
        // model's catalog row
        const v = (back ? -1 : 1) * mps;
        if (act.walk) act.walk.timeScale = v / paceWalk;
        if (act.run) act.run.timeScale = v / paceRun;
      } else {
        // nothing to go by but `move`: blend()'s old pace, the walk's share
        // that's standing in for the run quickened to it, and its share
        // standing in for a missing idle held still
        const pace = 0.8 + move * 0.4;
        if (act.walk) act.walk.timeScale = w.walk > 0 ? (pace * (walk + fromRun * RUN_PACE)) / w.walk : pace;
        if (act.run) act.run.timeScale = pace;
      }
    },
    // after the mixer, the figure placed: bones turned on top of the clip
    after(dt, m = {}, frame = null) {
      if (!rig || !frame) return;
      dt = Math.min(dt, 0.1);
      const { forward, up } = frame;
      right.crossVectors(forward, up).normalize();
      // the hips round to where it's going, the chest back to ahead
      if (Math.abs(st.yaw) > 1e-3) {
        rotateWorld(b.Hips, up, -st.yaw, 1);
        const share = [0.45, 0.33, 0.22];
        [b.Spine02, b.Spine01, b.Spine].forEach((s, i) => s && rotateWorld(s, up, st.yaw * share[i], 1));
      }
      // (about `right`, + tips something upright back and swings something hanging forward)
      if (Math.abs(st.lean) > 1e-3) rotateWorld(b.Hips, forward, st.lean, 1);
      if (Math.abs(st.pitch) > 1e-3 && b.Spine02) rotateWorld(b.Spine02, right, -st.pitch, 1);
      // in the air: knees up, the lead leg higher, arms out a little; landing: a crouch
      const airborne = (m.air ?? 0) > 0.03;
      if (st.wasAir && !airborne) st.land = Math.min(1, 0.45 + st.air * 0.55);
      st.wasAir = airborne;
      st.air += ((airborne ? 1 : 0) - st.air) * (1 - Math.exp(-dt * (airborne ? 9 : 16)));
      st.land = Math.max(0, st.land - dt / 0.3);
      if (st.air > 0.01) {
        const k = st.air;
        rotateWorld(b.LeftUpLeg, right, 0.8 * k, 1);
        rotateWorld(b.LeftLeg, right, -1.2 * k, 1);
        rotateWorld(b.RightUpLeg, right, 0.3 * k, 1);
        rotateWorld(b.RightLeg, right, -0.85 * k, 1);
        if (b.LeftArm) rotateWorld(b.LeftArm, forward, 0.3 * k, 1);
        if (b.RightArm) rotateWorld(b.RightArm, forward, -0.3 * k, 1);
      }
      const down = m.down ?? 0;
      const bend = Math.max(Math.sin(st.land * Math.PI * 0.5) * 0.55, down > 0 ? smooth(0, 0.3, down) * 0.95 : 0);
      if (bend > 0.001) {
        for (const [thigh, calf, foot] of LEGS) {
          rotateWorld(b[thigh], right, bend * 0.9, 1);
          rotateWorld(b[calf], right, -bend * 1.8, 1);
          rotateWorld(b[foot], right, bend * 0.9, 1);
        }
        if (b.Spine02) rotateWorld(b.Spine02, right, -bend * 0.35, 1); // the chest over the knees
      }
      st.drop = legLen * (1 - Math.cos(bend * 0.9));
      // going over: the arms thrown up and out
      if (down > 0.2) {
        const k = smooth(0.2, 0.8, down);
        if (b.LeftArm) rotateWorld(b.LeftArm, forward, 1.1 * k, 1);
        if (b.RightArm) rotateWorld(b.RightArm, forward, -1.1 * k, 1);
      }
      // hit: the chest and head thrown back, and a little round
      const hurt = m.hurt ?? 0;
      if (hurt > 0.001) {
        const k = Math.sin(Math.min(1, hurt) * Math.PI * 0.5);
        if (b.Spine01) rotateWorld(b.Spine01, right, 0.24 * k, 1);
        if (b.Spine) rotateWorld(b.Spine, up, (m.knock ?? 0.4) * 0.3 * k, 1);
        if (b.Head) rotateWorld(b.Head, right, 0.32 * k, 1);
      }
    },
  };
}

// Going down: the turn onto the ground about the feet, `k` (0…1) of the
// way, falling the way `dir` (unit, along the ground) points: slow as the
// knees go, then over faster and faster, and a small settle at the end
export function fallTurn(k, dir, up, out = new THREE.Quaternion()) {
  const axis = new V().crossVectors(up, dir);
  if (axis.lengthSq() < 1e-10) return out.identity();
  const t = smooth(0.15, 0.75, k);
  const a = t * t * (Math.PI / 2) * (1 + 0.05 * Math.sin(smooth(0.75, 1, k) * Math.PI));
  return out.setFromAxisAngle(axis.normalize(), a);
}
