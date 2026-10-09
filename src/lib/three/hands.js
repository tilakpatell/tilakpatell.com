// The hand layer: a figure's fingers closed round a grip, made a fist,
// opened in a wave, relaxed at rest, on any rig that has finger bones (the
// ones scripts/hands-extend.mjs adds to Meshy's skeleton, Mixamo's,
// Unreal's, Rigify's, High Moon's, the Transformers: Prime game's), from
// one table of poses (handPoses.js) written in the canonical frame: +y
// along a finger, +z out of the back of the hand, a bend closing toward the
// palm. Each bone's turn from its own rest frame into the canonical one is
// worked out once, from the bones alone (the hand's line from the wrist to
// the knuckles, the thumb's side of it), as is how far it is bent at rest,
// so a pose is the same hand on a sculpt that rests curled and on a T-pose
// that rests straight. Laid on after the mixer, the layers and the look,
// each finger's turn set from its rest, so nothing winds up frame on frame.
// (docs/superpowers/specs/2026-10-08-npc-player-rigging-design.md, piece 3)
//
//   fingerOf(name) → { side: 'L' | 'R', finger: 'thumb' | 'index' |
//     'middle' | 'ring' | 'pinky' | 'fingers', joint: 1… } | null: a finger
//     bone by its rig's name (HAND_ROLES); an end bone, a metacarpal or
//     anything else, null
//   createHands(model, { canonical }) → hands, or NO_HANDS on a figure
//     with no finger bones (every call a no-op, so a caller never checks):
//     has: any; sides: { L, R }
//     set(side, pose | { from, to, k }, { rate = 14 }): what that hand eases
//       toward (exponentially, at `rate` a second)
//     hold(side, radius): a grip round that radius (the figure's units)
//     release(side): back to relaxed, where every hand starts
//     after(dt): eases and lays the hands on, once a frame, last
//     curl(side) → the bends laid on now ({ thumb, index…, spread }, or a
//       mitten's { thumb, fingers, spread }), for the checks
//     dispose(): every finger back as it rested
//   canonical: whether the finger bones already rest in the canonical
//   frame (hands-extend.mjs's, which mark the file's scene userData.hands);
//   unless given, read from the model.

import * as THREE from 'three';
import { FINGERS, POSES, gripFor, mix } from './handPoses';

const V = THREE.Vector3;
const Q = THREE.Quaternion;
const X = new V(1, 0, 0);
const Z = new V(0, 0, 1);

// a bone's name without its rig's prefix or the number a download appended
const plain = (n) =>
  n
    .replace(/^mixamorig\d*:?/i, '')
    .replace(/^DEF-/i, '')
    .replace(/_\d+$/, '');

const side = (s) => (/^(l|left)$/i.test(s) ? 'L' : 'R');
const finger = (f) => (/little/i.test(f) ? 'pinky' : f.toLowerCase());
// each rig's finger names: a pattern on the plain name, and its parts
export const HAND_ROLES = [
  // Meshy's, as hands-extend names them, and Mixamo's: LeftHandIndex1
  [/^(Left|Right)Hand(Thumb|Index|Middle|Ring|Pinky|Fingers)(\d)$/i, (m) => [m[1], m[2], m[3]]],
  // Unreal's: index_01_l
  [/^(thumb|index|middle|ring|pinky)_0?(\d)_(l|r)$/i, (m) => [m[3], m[1], m[2]]],
  // Rigify's: f_index01L, thumb01L
  [/^(?:f_)?(thumb|index|middle|ring|pinky)0?(\d)\.?(l|r)$/i, (m) => [m[3], m[1], m[2]]],
  // High Moon's Transformers: L_Finger02_Index01_XL2
  [/^(l|r)_finger\d+_(thumb|index|middle|ring|pinky)0?(\d)_x[a-z]+\d*$/i, (m) => [m[1], m[2], m[3]]],
  // the Transformers: Prime game's: Index1_Finger.l, Little2_Finger.l
  [/^(thumb|index|middle|ring|little)(\d)_finger\.(l|r)$/i, (m) => [m[3], m[1], m[2]]],
];

export function fingerOf(name) {
  const p = plain(name);
  if (/(^|_)end($|_)|nub$|metacarpal/i.test(p)) return null;
  for (const [re, parts] of HAND_ROLES) {
    const m = p.match(re);
    if (!m) continue;
    const [s, f, j] = parts(m);
    const joint = Number(j);
    // (a fourth joint is Mixamo's tip, weighted to nothing)
    if (joint < 1 || joint > 3) return null;
    return { side: side(s), finger: finger(f), joint };
  }
  return null;
}

const noop = () => {};
export const NO_HANDS = Object.freeze({ has: false, sides: Object.freeze({ L: false, R: false }), set: noop, hold: noop, release: noop, after: noop, curl: () => null, dispose: noop });

// how far each finger fans for a spread, toward the thumb
const FAN = { index: 1, middle: 0.3, ring: -0.35, pinky: -1 };

// a finger's bends over the joints it has: each of the pose's bends spread
// evenly over its share of the finger, and each joint given what falls in its
// share (three onto two: [c1 + c2 / 2, c2 / 2 + c3])
function resample(values, n) {
  if (values.length === n) return values;
  const m = values.length;
  const upTo = (x) => {
    let s = 0;
    for (let i = 0; i < m; i++) s += values[i] * Math.min(1, Math.max(0, x * m - i));
    return s;
  };
  return Array.from({ length: n }, (_, j) => upTo((j + 1) / n) - upTo(j / n));
}

function isExtended(model) {
  let found = false;
  model.traverse((o) => {
    if (o.userData?.hands) found = true;
  });
  return found;
}

const mean = (vs) => vs.reduce((s, v) => s.add(v), new V()).divideScalar(Math.max(1, vs.length));

// one hand: its chains, each bone's turn into the canonical frame, its bends at rest
function readHand(s, chains, canonical) {
  const first = Object.values(chains)[0][0];
  const hand = first.parent;
  const at = (b) => b.getWorldPosition(new V());
  const wrist = at(hand);
  const knuckles = Object.entries(chains)
    .filter(([f]) => f !== 'thumb')
    .map(([, c]) => at(c[0]));
  const along = mean(knuckles).sub(wrist).normalize();
  // the thumb's side of the hand: the thumb, else the index past the pinky
  let across = null;
  if (chains.thumb) across = at(chains.thumb[0]).sub(mean(knuckles));
  else if (chains.index && chains.pinky) across = at(chains.index[0]).sub(at(chains.pinky[0]));
  let back;
  if (across) {
    across.addScaledVector(along, -across.dot(along)).normalize();
    // (the palm faces along × thumb on a left hand, thumb × along on a right: held.js's rule)
    back = s === 'L' ? new V().crossVectors(across, along) : new V().crossVectors(along, across);
  } else back = new V(0, 0, 1).applyQuaternion(first.getWorldQuaternion(new Q()));
  back.normalize();
  const out = { hand, chains: [], kind: chains.fingers ? 'mitten' : 'fingers', length: 0 };
  const lengths = [];
  for (const [f, bones] of Object.entries(chains)) {
    let prevY = f === 'thumb' ? null : along;
    const segs = [];
    const joints = bones.map((bone, i) => {
      const next = bones[i + 1] ?? bone.children.find((c) => c.isBone) ?? null;
      const R = bone.getWorldQuaternion(new Q());
      let O;
      let y;
      if (canonical) {
        O = new Q();
        y = new V(0, 1, 0).applyQuaternion(R);
      } else {
        y = next ? at(next).sub(at(bone)).normalize() : prevY.clone();
        const z = back.clone().addScaledVector(y, -back.dot(y)).normalize();
        const C = new Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new V().crossVectors(y, z), y, z));
        O = R.clone().invert().multiply(C);
      }
      const x = X.clone().applyQuaternion(R.clone().multiply(O));
      // the bend it rests at against the bone before (the first: the hand's line)
      const rest = prevY ? -Math.atan2(new V().crossVectors(prevY, y).dot(x), prevY.dot(y)) : 0;
      prevY = y;
      if (next) segs.push(at(next).distanceTo(at(bone)));
      return { bone, rest: bone.quaternion.clone(), O, Oi: O.clone().invert(), bend: rest };
    });
    out.chains.push({ finger: f, joints });
    // (a finger's length: its bones, and its tip about as long as its last)
    if (f !== 'thumb' && segs.length) lengths.push(segs.reduce((a, b) => a + b, 0) + segs[segs.length - 1]);
  }
  out.length = lengths.length ? lengths.reduce((a, b) => a + b) / lengths.length : 0;
  return out;
}

export function createHands(model, { canonical = null } = {}) {
  const found = { L: {}, R: {} };
  model.traverse((o) => {
    if (!o.isBone) return;
    const f = fingerOf(o.name);
    if (f) (found[f.side][f.finger] ??= [])[f.joint - 1] = o;
  });
  for (const s of ['L', 'R']) for (const f of Object.keys(found[s])) found[s][f] = found[s][f].filter(Boolean);
  const sides = { L: Object.keys(found.L).length > 0, R: Object.keys(found.R).length > 0 };
  if (!sides.L && !sides.R) return NO_HANDS;
  model.updateMatrixWorld(true);
  const canon = canonical ?? isExtended(model);
  const hand = {};
  for (const s of ['L', 'R']) {
    if (!sides[s]) continue;
    hand[s] = readHand(s, found[s], canon);
    hand[s].target = POSES.relaxed;
    hand[s].rate = 14;
    hand[s].now = mix(POSES.relaxed, POSES.relaxed, 0);
  }
  const _q = new Q();
  const _k = new Q();
  const _s = new Q();

  // the bends a chain lays on, from the pose
  const bendsOf = (h, f, n, p) => {
    if (f === 'fingers') {
      const m = [0, 1, 2].map((j) => FINGERS.reduce((s, x) => s + p[x][j], 0) / FINGERS.length);
      return resample(m, n);
    }
    return resample(p[f], n);
  };

  function lay(s) {
    const h = hand[s];
    for (const { finger: f, joints } of h.chains) {
      const bends = bendsOf(h, f, joints.length, h.now);
      joints.forEach((j, i) => {
        _k.setFromAxisAngle(X, -(bends[i] - j.bend));
        // (the fingers fan at the knuckle: toward the thumb is +x on a left hand, −x on a right)
        if (i === 0 && FAN[f]) _k.premultiply(_s.setFromAxisAngle(Z, FAN[f] * h.now.spread * (s === 'L' ? -1 : 1)));
        j.bone.quaternion.copy(j.rest).multiply(_q.copy(j.O).multiply(_k).multiply(j.Oi));
      });
    }
  }

  return {
    has: true,
    sides,
    set(s, pose, { rate = 14 } = {}) {
      if (!hand[s]) return;
      hand[s].target = pose.from ? mix(pose.from, pose.to, pose.k) : pose;
      hand[s].rate = rate;
    },
    hold(s, radius) {
      if (hand[s]) this.set(s, gripFor(radius, hand[s].length));
    },
    release(s) {
      this.set(s, POSES.relaxed);
    },
    after(dt) {
      for (const s of ['L', 'R']) {
        const h = hand[s];
        if (!h) continue;
        const keep = Math.exp(-h.rate * Math.max(0, dt));
        const ease = (now, want) => want + (now - want) * keep;
        h.now.spread = ease(h.now.spread, h.target.spread);
        for (const f of ['thumb', ...FINGERS]) h.now[f] = h.now[f].map((x, i) => ease(x, h.target[f][i]));
        lay(s);
      }
    },
    curl(s) {
      const h = hand[s];
      if (!h) return null;
      const out = { thumb: [...h.now.thumb], spread: h.now.spread };
      for (const { finger: f, joints } of h.chains) if (f !== 'thumb') out[f] = bendsOf(h, f, joints.length, h.now);
      return out;
    },
    dispose() {
      for (const h of Object.values(hand)) for (const c of h.chains) for (const j of c.joints) j.bone.quaternion.copy(j.rest);
    },
  };
}
