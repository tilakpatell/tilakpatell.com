// A figure on Meshy's skeleton, for the tests: the 24 bones by name as
// Luke's file has them (public/models/galaxy/crew/luke.glb: each bone's
// offset in centimetres under an armature scaled to metres, and its turn at
// rest, an A-pose's arms and legs whose bones point down their length), toes
// and all, and synthetic idle, walk and run clips made the way Meshy's are:
// each bone's track its turn at rest with a swing on top.
//
//   meshyRig({ without, fingers }) → { model, armature, bones, rest, clips: { idle, walk, run }, hipsY }
//     (rest: each bone's turn and offset at rest, and its parent's turn in the world)
//     without: bone names to leave out (their children hung on the bone
//     above, a rig that lacks them); model faces +z, +y up, feet at y = 0
//     fingers: true adds the 28 finger bones scripts/hands-extend.mjs adds
//     (FINGER_NAMES, after the 24), straight out of the hand, each in the
//     canonical frame: +y along the finger, +z out of the back of the hand,
//     +x = y × z (toward the thumb on the left hand, away from it on the
//     right: a mirror, since a turn can't flip a hand)
//   swingClip(rig, name, dur, swing, { hips }) → a clip in which every bone
//     the rig has is swung swing(boneName, t) radians (or 0) about the
//     figure's left–right axis (+ swings a leg back, an arm back), from its
//     turn at rest; `hips`: (t) → the hips' height off its rest, a position
//     track as Meshy's clips have
//   RIGHT_ANGLE: Math.PI / 2, the swing swingClip's tests turn every bone by
//   withHands(rig, { verts = 60 }) → rig, its model given a SkinnedMesh
//     (rig.hands) of `verts` vertices on each hand, bound at rest: a plate
//     8 cm out the fingers along the bone's +y, 1 cm thin across its x (the
//     palm faces in, as an A-pose's does), 3 cm wide along its z, and a
//     thumb nub 2 cm out at its +z (forward, where a thumb is at rest)

import * as THREE from 'three';

export const RIGHT_ANGLE = Math.PI / 2;

// [name, parent, offset (cm), turn at rest (x, y, z, w)]
export const MESHY_BONES = [
  ['Hips', null, [0.74, 95.5, -0.46], [0.0049, 0.0051, 0.0051, 1]],
  ['Spine02', 'Hips', [0, 12.17, 0]],
  ['Spine01', 'Spine02', [0, 12.17, 0]],
  ['Spine', 'Spine01', [0, 12.54, 0], [0, 0.0068, 0.0067, 1]],
  ['neck', 'Spine', [0, 8.93, 0]],
  ['Head', 'neck', [0, 6.88, 0], [0.0498, -0.0482, -0.0466, 0.9965]],
  ['head_end', 'Head', [0, 22.35, 0]],
  ['headfront', 'Head', [0.29, 0.49, 4.31], [0, -0.7438, -0.6665, 0.0504]],
  ['LeftShoulder', 'Spine', [3.57, 4.37, 0.05], [-0.5867, -0.4005, -0.4106, 0.5717]],
  ['LeftArm', 'LeftShoulder', [0, 15.8, 0], [-0.1988, 0.5823, -0.3848, 0.688]],
  ['LeftForeArm', 'LeftArm', [0, 23.65, 0], [0.1511, 0.109, 0.027, 0.9821]],
  ['LeftHand', 'LeftForeArm', [0, 23.45, 0], [0.0313, -0.1831, -0.1525, 0.9707]],
  ['RightShoulder', 'Spine', [-3.85, 4.55, -0.05], [-0.5848, 0.4031, 0.3857, 0.5888]],
  ['RightArm', 'RightShoulder', [0, 16.02, 0], [-0.2288, -0.5724, 0.3761, 0.6918]],
  ['RightForeArm', 'RightArm', [0, 22.35, 0], [0.2115, -0.1511, -0.0486, 0.9644]],
  ['RightHand', 'RightForeArm', [0, 24.65, 0], [-0.0777, 0.1861, 0.1349, 0.9701]],
  ['LeftUpLeg', 'Hips', [8.45, -9.7, 0.18], [0.997, 0.0444, 0.054, 0.0336]],
  ['LeftLeg', 'LeftUpLeg', [0, 38.72, 0], [0.1095, -0.0052, 0.0154, 0.9939]],
  ['LeftFoot', 'LeftLeg', [0, 35.46, 0], [-0.443, 0.0795, -0.1314, 0.8833]],
  ['LeftToeBase', 'LeftFoot', [0, 13.25, 0], [0.0851, 0.8995, -0.3587, 0.2347]],
  ['RightUpLeg', 'Hips', [-9.36, -9.52, 0], [0.9965, -0.0599, -0.0493, 0.032]],
  ['RightLeg', 'RightUpLeg', [0, 38.76, 0], [0.1084, 0.0199, -0.0304, 0.9934]],
  ['RightFoot', 'RightLeg', [0, 35.41, 0], [-0.4306, -0.1318, 0.1827, 0.874]],
  ['RightToeBase', 'RightFoot', [0, 13.26, 0], [0.111, -0.8808, 0.3439, 0.3059]],
];

// a hand's fingers as the extension names them: [finger, segment lengths
// (cm), offset across the knuckles toward the thumb (cm), knuckle along the
// hand (cm)]
const FINGERS = [
  ['Thumb', [3.5, 3], 2, 2.5],
  ['Index', [4, 2.4, 1.9], 2.7, 9],
  ['Middle', [4.4, 2.8, 2], 0.9, 9.3],
  ['Ring', [4.1, 2.6, 1.9], -0.9, 9],
  ['Pinky', [3.2, 2, 1.7], -2.7, 8.2],
];
export const FINGER_NAMES = ['Left', 'Right'].flatMap((s) => FINGERS.flatMap(([f, segs]) => segs.map((_, i) => `${s}Hand${f}${i + 1}`)));

const X = new THREE.Vector3(1, 0, 0);
const RATE = 30; // keys a second

export function meshyRig({ without = [], fingers = false } = {}) {
  const model = new THREE.Group();
  const armature = new THREE.Group();
  armature.name = 'Armature';
  armature.scale.setScalar(0.01);
  model.add(armature);
  const bones = {};
  const offset = {}; // a left-out bone's offset, added to its children's
  const parentOf = {};
  for (const [name, parent, at, turn] of MESHY_BONES) {
    const up = parent && !bones[parent] ? parentOf[parent] : parent;
    const extra = parent && !bones[parent] ? offset[parent] : [0, 0, 0];
    const p = [at[0] + extra[0], at[1] + extra[1], at[2] + extra[2]];
    parentOf[name] = up;
    if (without.includes(name)) {
      offset[name] = p;
      continue;
    }
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...p);
    if (turn) b.quaternion.set(...turn).normalize();
    (up ? bones[up] : armature).add(b);
    bones[name] = b;
  }
  if (fingers) for (const side of ['Left', 'Right']) if (bones[`${side}Hand`]) addFingers(bones, side);
  // its feet on the ground
  model.updateMatrixWorld(true);
  const toe = Math.min(...['LeftToeBase', 'RightToeBase', 'LeftFoot', 'RightFoot'].filter((n) => bones[n]).map((n) => bones[n].getWorldPosition(new THREE.Vector3()).y));
  armature.position.y = -toe;
  model.updateMatrixWorld(true);
  // each bone's turn at rest, and its parent's in the world, for the clips
  const rest = {};
  for (const b of Object.values(bones)) rest[b.name] = { turn: b.quaternion.clone(), at: b.position.clone(), parent: b.parent.getWorldQuaternion(new THREE.Quaternion()) };
  const rig = { model, armature, bones, rest, hipsY: bones.Hips.position.y };
  rig.clips = {
    idle: swingClip(rig, 'idle', 3, (n, t) => (n === 'Spine02' ? 0.03 * Math.sin((2 * Math.PI * t) / 3) : 0)),
    walk: gaitClip(rig, 'walk', 1, 0.4, 1.0, 0.3),
    run: gaitClip(rig, 'run', 0.7, 0.6, 1.4, 0.6),
  };
  return rig;
}

// The fingers under a hand, laid out in the hand bone's own frame: +y down
// the hand, +z toward the thumb, the back of the hand −x on the left and +x
// on the right (Meshy's hands mirror). A finger's first bone turns from the
// hand into the canonical frame; the joints past it carry on straight.
function addFingers(bones, side) {
  const hand = bones[`${side}Hand`];
  const back = new THREE.Vector3(side === 'Left' ? -1 : 1, 0, 0);
  const m = new THREE.Matrix4();
  for (const [f, segs, across, knuckle] of FINGERS) {
    const thumb = f === 'Thumb';
    const along = thumb ? new THREE.Vector3(0, 0.6, 0.8) : new THREE.Vector3(0, 1, 0);
    const z = back.clone().addScaledVector(along, -back.dot(along)).normalize();
    m.makeBasis(new THREE.Vector3().crossVectors(along, z), along, z);
    let parent = hand;
    segs.forEach((len, i) => {
      const b = new THREE.Bone();
      b.name = `${side}Hand${f}${i + 1}`;
      if (i === 0) {
        b.position.set(0, knuckle, across).addScaledVector(back, thumb ? -0.8 : 0);
        b.quaternion.setFromRotationMatrix(m);
      } else b.position.set(0, segs[i - 1], 0);
      parent.add(b);
      bones[b.name] = b;
      parent = b;
    });
  }
}

// a walk or a run: the thighs swung `a` either way, the knee bent up to `k`
// as the leg comes forward (so the foot that's down goes back under the
// body, and the one coming through is lifted), the arms against the legs
function gaitClip(rig, name, dur, a, k, arms) {
  const w = (2 * Math.PI) / dur;
  const legs = { LeftUpLeg: 0, RightUpLeg: Math.PI, LeftLeg: 0, RightLeg: Math.PI };
  return swingClip(rig, name, dur, (n, t) => {
    if (n in legs) {
      const s = w * t + legs[n];
      return n.endsWith('UpLeg') ? a * Math.sin(s) : k * Math.max(0, -Math.cos(s));
    }
    if (n === 'LeftArm') return -arms * Math.sin(w * t);
    if (n === 'RightArm') return arms * Math.sin(w * t);
    return 0;
  });
}

export function swingClip(rig, name, dur, swing, { hips = null } = {}) {
  const { bones, rest } = rig;
  const times = [];
  for (let i = 0, n = Math.max(2, Math.round(dur * RATE)); i <= n; i++) times.push((i / n) * dur);
  const tracks = [];
  const turn = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  for (const name of Object.keys(bones)) {
    // the bone's own turn, swung about the figure's x as its parent stands
    // at rest: parent⁻¹ · swing · parent · rest
    const { turn: own, parent } = rest[name];
    const inv = parent.clone().invert();
    const values = [];
    for (const t of times) {
      turn.setFromAxisAngle(X, swing(name, t) || 0);
      q.copy(inv).multiply(turn).multiply(parent).multiply(own);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
  }
  if (hips) {
    const p = rest.Hips.at;
    tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, times.flatMap((t) => [p.x, p.y + hips(t), p.z])));
  }
  return new THREE.AnimationClip(name, dur, tracks);
}

// the vertices of one hand, in its bone's space (cm): the plate, then the
// thumb nub (a tenth of them)
function handCloud(verts) {
  const nub = Math.max(2, Math.round(verts * 0.1));
  const plate = verts - nub;
  const pts = [];
  const rows = 6;
  for (let i = 0; i < plate; i++) {
    const a = i % rows;
    const b = Math.floor(i / rows);
    const cols = Math.max(1, Math.ceil(plate / rows));
    pts.push([b % 2 ? 0.5 : -0.5, 1 + (8 * a) / (rows - 1), cols > 1 ? -1.5 + (3 * (b % cols)) / (cols - 1) : 0]);
  }
  for (let i = 0; i < nub; i++) pts.push([0, 1 + (2 * i) / Math.max(1, nub - 1), 2]);
  return pts;
}

export function withHands(rig, { verts = 60 } = {}) {
  const { model, bones } = rig;
  model.updateMatrixWorld(true);
  const list = Object.values(bones);
  const pos = [];
  const idx = [];
  const wts = [];
  const v = new THREE.Vector3();
  for (const name of ['RightHand', 'LeftHand']) {
    const b = bones[name];
    if (!b) continue;
    const i = list.indexOf(b);
    for (const p of handCloud(verts)) {
      v.set(...p).applyMatrix4(b.matrixWorld);
      pos.push(v.x, v.y, v.z);
      idx.push(i, 0, 0, 0);
      wts.push(1, 0, 0, 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
  const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshBasicMaterial());
  mesh.name = 'hands';
  model.add(mesh);
  model.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  rig.hands = mesh;
  return rig;
}
