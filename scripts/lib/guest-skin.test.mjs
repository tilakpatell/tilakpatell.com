import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { glbJson } from './bf2017-paths.mjs';
import { meshyRig } from './fixtures/meshy-rig.mjs';
import { readGuest } from './guest-file.mjs';
import { JOINT_MAP, fitSkeleton, measure, rowsOf, turnsOf, worldsOf } from './guest-skeleton.mjs';
import { bakeBind, bindPose, moveWeights, restPose, targetsOf } from './guest-skin.mjs';

const WALRUS = rowsOf(glbJson(readFileSync('public/models/galaxy/bf2017/walrus.glb')));
const at = (worlds, name) => new THREE.Vector3().setFromMatrixPosition(worlds.get(name));

// the hand-made rig, fitted, and its joints in a skin's order
const RIG = meshyRig();
const JOINTS = RIG.filter((r) => r.name !== 'Armature');
const NAMES = JOINTS.map((r) => r.name);
const MAP = JOINT_MAP(RIG);
const FITTED = fitSkeleton(WALRUS, measure(RIG));
const index = (name) => NAMES.indexOf(name);
// one vertex at `p` (metres), on these joints at these weights
const one = (p, on) => {
  const names = Object.keys(on);
  return {
    positions: Float32Array.from(p),
    normals: Float32Array.from([0, 0, 1]),
    skinIndex: Uint16Array.from([0, 1, 2, 3].map((k) => (names[k] ? index(names[k]) : 0))),
    skinWeight: Float32Array.from([0, 1, 2, 3].map((k) => on[names[k]] ?? 0)),
  };
};
const baked = (p, on) => {
  const v = one(p, on);
  return bakeBind(v.positions, v.normals, v.skinIndex, v.skinWeight, bindPose(RIG), restPose(RIG, FITTED, MAP), NAMES);
};

describe('a guest’s mesh at the fitted skeleton’s rest', () => {
  const own = worldsOf(RIG);
  const fit = worldsOf(FITTED);

  it('puts each of the guest’s joints at the fitted one, the head’s helpers with the head', () => {
    const pose = restPose(RIG, FITTED, MAP);
    for (const [from, to] of MAP) expect(at(pose, from).distanceTo(at(fit, to)), from).toBeLessThan(1e-9);
    for (const n of ['head_end', 'headfront']) expect(at(pose, n).distanceTo(at(fit, n)), n).toBeLessThan(1e-9);
    // (in metres: the root's hundredth is taken out of the bind and the pose alike)
    const s = new THREE.Vector3();
    pose.get('LeftHand').decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
    expect(s.toArray().map((v) => +v.toFixed(9))).toEqual([1, 1, 1]);
  });

  it('lands a vertex on a bone on the fitted bone', () => {
    // halfway down the left forearm, wholly the forearm's
    const mid = at(own, 'LeftForeArm').lerp(at(own, 'LeftHand'), 0.5);
    const out = baked(mid.toArray(), { LeftForeArm: 1 });
    const want = at(fit, 'LeftForeArm').lerp(at(fit, 'LeftHand'), 0.5);
    expect(new THREE.Vector3().fromArray(out.positions).distanceTo(want)).toBeLessThan(1e-6);
    // and a quarter down the right thigh
    const thigh = at(own, 'RightUpLeg').lerp(at(own, 'RightLeg'), 0.25);
    const leg = baked(thigh.toArray(), { RightUpLeg: 1 });
    expect(new THREE.Vector3().fromArray(leg.positions).distanceTo(at(fit, 'RightUpLeg').lerp(at(fit, 'RightLeg'), 0.25))).toBeLessThan(1e-6);
  });

  it('keeps a vertex at a joint on the joint, however its weight is shared across it', () => {
    const out = baked(at(own, 'LeftForeArm').toArray(), { LeftArm: 0.5, LeftForeArm: 0.5 });
    expect(new THREE.Vector3().fromArray(out.positions).distanceTo(at(fit, 'LeftForeArm'))).toBeLessThan(1e-6);
  });

  it('moves the trunk, the head and the feet without turning them', () => {
    const chest = at(own, 'C').add(new THREE.Vector3(0.05, 0.02, 0.08));
    const out = baked(chest.toArray(), { C: 1 });
    expect(new THREE.Vector3().fromArray(out.positions).distanceTo(at(fit, 'Spine2').add(new THREE.Vector3(0.05, 0.02, 0.08)))).toBeLessThan(1e-6);
    const sole = at(own, 'LeftFoot').add(new THREE.Vector3(0, -0.08, 0.05));
    const foot = baked(sole.toArray(), { LeftFoot: 1 });
    expect(new THREE.Vector3().fromArray(foot.positions).distanceTo(at(fit, 'LeftFoot').add(new THREE.Vector3(0, -0.08, 0.05)))).toBeLessThan(1e-6);
    expect([...foot.normals].map((v) => +v.toFixed(6))).toEqual([0, 0, 1]);
  });

  it('turns a normal with its bone, and leaves it a unit long', () => {
    const turn = turnsOf(measure(RIG).joints, WALRUS).LeftForeArm;
    const out = baked(at(own, 'LeftHand').toArray(), { LeftForeArm: 0.6, LeftHand: 0.4 });
    const n = new THREE.Vector3().fromArray(out.normals);
    expect(n.length()).toBeCloseTo(1, 6);
    expect(n.distanceTo(new THREE.Vector3(0, 0, 1).applyQuaternion(turn))).toBeLessThan(1e-6);
  });
});

describe('a guest’s weights on the game’s bones', () => {
  const gameIndexOf = (name) => FITTED.findIndex((r) => r.name === name);
  const names = (out, v = 0) => [0, 1, 2, 3].filter((k) => out.skinWeight[v * 4 + k] > 0).map((k) => FITTED[out.skinIndex[v * 4 + k]].name);

  it('says where each of the skin’s joints sends its weight: its counterpart, or its nearest mapped parent’s', () => {
    const to = targetsOf(JOINTS, MAP);
    expect(to[index('B')]).toBe('Spine');
    expect(to[index('C')]).toBe('Spine2');
    expect(to[index('LeftForeArm')]).toBe('LeftForeArm');
    expect(to[index('head_end')]).toBe('Head');
    expect(to[index('headfront')]).toBe('Head');
  });

  it('moves a weight to the joint’s counterpart, numbered as the game’s skeleton is', () => {
    const v = one([0, 0, 0], { B: 0.25, LeftUpLeg: 0.75 });
    const out = moveWeights(v.skinIndex, v.skinWeight, MAP, gameIndexOf, JOINTS);
    expect(names(out)).toEqual(['LeftUpLeg', 'Spine']);
    expect([...out.skinWeight]).toEqual([0.75, 0.25, 0, 0]);
  });

  it('gives an unmapped joint’s weight to its parent’s counterpart, and keeps the sum at one', () => {
    const v = one([0, 0, 0], { head_end: 0.2, headfront: 0.3, Head: 0.4, neck: 0.1 });
    const out = moveWeights(v.skinIndex, v.skinWeight, MAP, gameIndexOf, JOINTS);
    expect(names(out)).toEqual(['Head', 'Neck']);
    expect(out.skinWeight[0]).toBeCloseTo(0.9, 6);
    expect(out.skinWeight[1]).toBeCloseTo(0.1, 6);
    expect(out.skinWeight[0] + out.skinWeight[1] + out.skinWeight[2] + out.skinWeight[3]).toBeCloseTo(1, 6);
  });

  it('brings a vertex whose weights fell short back to one, on four joints at most', () => {
    const v = one([0, 0, 0], { LeftArm: 0.3, LeftForeArm: 0.3, LeftHand: 0.15, LeftShoulder: 0.15 });
    const out = moveWeights(v.skinIndex, v.skinWeight, MAP, gameIndexOf, JOINTS);
    expect(names(out).length).toBe(4);
    expect([...out.skinWeight].reduce((s, w) => s + w, 0)).toBeCloseTo(1, 6);
    expect(out.skinWeight[0]).toBeCloseTo(1 / 3, 6);
    // (a slot with no weight reads joint 0, times nothing)
    const lone = moveWeights(...Object.values(one([0, 0, 0], { Hips: 1 })).slice(2), MAP, gameIndexOf, JOINTS);
    expect([...lone.skinIndex].slice(1)).toEqual([0, 0, 0]);
  });

  it('refuses a weight on a joint it cannot place', () => {
    const v = one([0, 0, 0], { Hips: 1 });
    expect(() => moveWeights(v.skinIndex, v.skinWeight, MAP, () => -1, JOINTS)).toThrow(/Hips/);
  });
});

// A limb's ring: the vertices its joint and the bone above it move, within
// 1.5 cm of the plane through the joint across that bone. Its middle (the
// middle of its box across the bone) and its girth (its vertices' mean
// distance from that middle), before the fit and after.
const RINGS = ['Left', 'Right'].flatMap((s) => [['Hand', 'ForeArm'], ['ForeArm', 'Arm'], ['Leg', 'UpLeg'], ['Foot', 'Leg']].map(([j, up]) => [s + j, s + up]));
function ring(positions, verts, joint, a, b) {
  const box = [Infinity, -Infinity, Infinity, -Infinity];
  const p = new THREE.Vector3();
  for (const v of verts) {
    p.fromArray(positions, v * 3).sub(joint);
    box[0] = Math.min(box[0], p.dot(a));
    box[1] = Math.max(box[1], p.dot(a));
    box[2] = Math.min(box[2], p.dot(b));
    box[3] = Math.max(box[3], p.dot(b));
  }
  const middle = a.clone().multiplyScalar((box[0] + box[1]) / 2).add(b.clone().multiplyScalar((box[2] + box[3]) / 2));
  let girth = 0;
  for (const v of verts) girth += p.fromArray(positions, v * 3).sub(joint).sub(middle).length();
  return { middle, girth: girth / verts.length };
}

describe.each([['Rick', 'public/games/meshy/rick.glb'], ['Morty', 'public/games/meshy/morty.glb']])('%s’s own mesh, fitted', (who, file) => {
  let guest;
  let fit;
  let out;
  let turns;
  beforeAll(async () => {
    guest = await readGuest(file);
    const m = measure(guest.rows, guest.surface);
    const fitted = fitSkeleton(WALRUS, m);
    fit = worldsOf(fitted);
    turns = turnsOf(m.joints, WALRUS);
    const s = guest.surface;
    out = bakeBind(s.positions, s.normals, s.skinIndex, s.skinWeight, bindPose(guest.rows), restPose(guest.rows, fitted, JOINT_MAP(guest.rows)), s.joints);
  });

  it('is read at its bind, in metres, its soles on the ground', () => {
    const ys = [];
    for (let v = 0; v < guest.surface.positions.length / 3; v++) ys.push(guest.surface.positions[v * 3 + 1]);
    expect(Math.min(...ys)).toBeCloseTo(0, 3);
    expect(Math.max(...ys)).toBeCloseTo(who === 'Rick' ? 1.8 : 1.5, 3);
  });

  it('stands on the ground after the fit, and keeps its height within a centimetre', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let v = 0; v < out.positions.length / 3; v++) {
      lo = Math.min(lo, out.positions[v * 3 + 1]);
      hi = Math.max(hi, out.positions[v * 3 + 1]);
    }
    expect(Math.abs(lo)).toBeLessThan(0.005);
    expect(Math.abs(hi - (who === 'Rick' ? 1.8 : 1.5))).toBeLessThan(0.01);
  });

  it('carries every wrist, elbow, knee and ankle ring with its joint, within a centimetre, and collapses none', () => {
    const s = guest.surface;
    const own = worldsOf(guest.rows);
    const still = new THREE.Quaternion();
    for (const [joint, up] of RINGS) {
      const j = s.joints.indexOf(joint);
      const u = s.joints.indexOf(up);
      const J = at(own, joint);
      const along = J.clone().sub(at(own, up)).normalize();
      const verts = [];
      const p = new THREE.Vector3();
      for (let v = 0; v < s.positions.length / 3; v++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (s.skinIndex[v * 4 + k] === j || s.skinIndex[v * 4 + k] === u) w += s.skinWeight[v * 4 + k];
        if (w >= 0.5 && Math.abs(p.fromArray(s.positions, v * 3).sub(J).dot(along)) <= 0.015) verts.push(v);
      }
      expect(verts.length, joint).toBeGreaterThan(20);
      // (the ring is half the bone above's and half the joint's own: turned halfway between them)
      const turn = (turns[up] ?? still).clone().slerp(turns[joint] ?? still, 0.5);
      const a = new THREE.Vector3(0, 0, 1).cross(along).normalize();
      const b = along.clone().cross(a);
      const before = ring(s.positions, verts, J, a, b);
      const after = ring(out.positions, verts, at(fit, joint), a.clone().applyQuaternion(turn), b.clone().applyQuaternion(turn));
      expect(after.middle.distanceTo(before.middle.clone().applyQuaternion(turn)), `${joint} ring off its joint`).toBeLessThan(0.01);
      expect(after.girth / before.girth, `${joint} girth`).toBeGreaterThan(0.85);
      expect(after.girth / before.girth, `${joint} girth`).toBeLessThan(1.15);
    }
  });

  it('moves every vertex’s weight onto the game’s bones, summing to one', () => {
    const s = guest.surface;
    const names = [...fit.keys()];
    const moved = moveWeights(s.skinIndex, s.skinWeight, JOINT_MAP(guest.rows), (n) => names.indexOf(n), guest.joints);
    const used = new Set();
    for (let v = 0; v < s.positions.length / 3; v++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += moved.skinWeight[v * 4 + k];
        if (moved.skinWeight[v * 4 + k] > 0) used.add(names[moved.skinIndex[v * 4 + k]]);
      }
      if (Math.abs(sum - 1) > 1e-5) throw new Error(`vertex ${v} sums to ${sum}`);
    }
    // (the head's helpers' weight is the head's now, and no finger, face or socket carries any)
    expect(used.has('head_end') || used.has('headfront')).toBe(false);
    expect(used.has('Head')).toBe(true);
    expect(used.size).toBeLessThanOrEqual(22);
    expect([...used].every((n) => [...JOINT_MAP(guest.rows).values()].includes(n))).toBe(true);
  });
});
