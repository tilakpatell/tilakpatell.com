// What the ragdoll promises: a Verlet body whose sticks keep their lengths,
// that falls under gravity and comes to rest on the floor under it, never
// through a wall, falls on into a void, bends its knees and elbows only the
// way they bend, and goes still; and, laid over a skeleton, that it turns
// the bones to follow its points.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBody, rigRagdoll } from './ragdollPhysics';

const flatFloor = (y = 0) => (p, r) => {
  if (p.y - r < y) {
    p.y = y + r;
    return true;
  }
  return false;
};
const len = (b, i, j) => Math.hypot(b.pos[i * 3] - b.pos[j * 3], b.pos[i * 3 + 1] - b.pos[j * 3 + 1], b.pos[i * 3 + 2] - b.pos[j * 3 + 2]);
const run = (b, seconds, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) b.step(dt);
};

describe('createBody', () => {
  it('keeps a stick’s length as it falls and lands', () => {
    const b = createBody([{ x: 0, y: 1, z: 0 }, { x: 0.5, y: 1.3, z: 0 }], [{ a: 0, b: 1 }], { collide: flatFloor() });
    const l0 = len(b, 0, 1);
    run(b, 2);
    expect(len(b, 0, 1)).toBeCloseTo(l0, 1);
    expect(Math.abs(len(b, 0, 1) - l0) / l0).toBeLessThan(0.02);
  });

  it('comes to rest on the floor under it, and goes still', () => {
    const b = createBody([{ x: 0, y: 1, z: 0 }, { x: 0.4, y: 1, z: 0 }, { x: 0.2, y: 1.4, z: 0 }], [{ a: 0, b: 1 }, { a: 1, b: 2 }, { a: 0, b: 2 }], { collide: flatFloor(0), radius: 0.05 });
    run(b, 4);
    for (let i = 0; i < 3; i++) expect(b.pos[i * 3 + 1]).toBeGreaterThanOrEqual(0.05 - 1e-6);
    expect(Math.min(b.pos[1], b.pos[4], b.pos[7])).toBeLessThan(0.08);
    expect(b.settled).toBe(true);
  });

  it('falls on where there is no floor', () => {
    const void_ = (p, r) => {
      if (p.x < 0 && p.y - r < 0) {
        p.y = r;
        return true;
      }
      return false;
    };
    const b = createBody([{ x: 1, y: 0.5, z: 0 }], [], { collide: void_ });
    run(b, 1);
    expect(b.pos[1]).toBeLessThan(-3);
  });

  it('is pushed back out of a wall, staying on its side', () => {
    // a wall along x = 1, its room on the side x < 1
    const wall = (p, r) => {
      if (p.x > 1 - r) p.x = 1 - r;
      return flatFloor(0)(p, r);
    };
    const b = createBody([{ x: 0.5, y: 0.5, z: 0 }], [], { collide: wall, radius: 0.1 });
    b.kick(0, { x: 8, y: 0, z: 0 });
    run(b, 1);
    expect(b.pos[0]).toBeLessThanOrEqual(0.9 + 1e-6);
  });

  it('bends a hinge only the way it bends', () => {
    // a leg: hip, knee, foot in a line down; the knee may only go out to +z
    const b = createBody(
      [
        { x: 0, y: 1, z: 0 },
        { x: 0, y: 0.5, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      [{ a: 0, b: 1 }, { a: 1, b: 2 }],
      { gravity: 0, hinges: [{ a: 0, m: 1, b: 2, side: () => ({ x: 0, y: 0, z: 1 }) }] },
    );
    // the knee shoved backwards
    b.kick(1, { x: 0, y: 0, z: -3 });
    run(b, 0.5);
    // (the whole leg drifts back with it: the knee against the line from hip to foot)
    expect(b.pos[1 * 3 + 2] - (b.pos[0 * 3 + 2] + b.pos[2 * 3 + 2]) / 2).toBeGreaterThanOrEqual(-0.04 - 1e-3);
  });

  it('keeps a stick with a range within it', () => {
    const b = createBody([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }], [{ a: 0, b: 1, min: 0.6 }], { gravity: 0 });
    b.kick(1, { x: -20, y: 0, z: 0 });
    run(b, 0.3);
    expect(len(b, 0, 1)).toBeGreaterThan(0.58);
    expect(len(b, 0, 1)).toBeLessThan(1.02);
  });
});

// a little figure on Meshy's bones: hips, a spine up to the head, legs down
function figure() {
  const root = new THREE.Group();
  const bone = (name, parent, [x, y, z]) => {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(x, y, z);
    (parent ?? root).add(b);
    return b;
  };
  const bones = {};
  bones.Hips = bone('Hips', null, [0, 1, 0]);
  bones.Spine02 = bone('Spine02', bones.Hips, [0, 0.12, 0]);
  bones.Spine01 = bone('Spine01', bones.Spine02, [0, 0.12, 0]);
  bones.Spine = bone('Spine', bones.Spine01, [0, 0.12, 0]);
  bones.neck = bone('neck', bones.Spine, [0, 0.14, 0]);
  bones.Head = bone('Head', bones.neck, [0, 0.1, 0]);
  bones.head_end = bone('head_end', bones.Head, [0, 0.2, 0]);
  for (const [side, s] of [['Left', 1], ['Right', -1]]) {
    bones[`${side}Shoulder`] = bone(`${side}Shoulder`, bones.Spine, [0.06 * s, 0.1, 0]);
    bones[`${side}Arm`] = bone(`${side}Arm`, bones[`${side}Shoulder`], [0.12 * s, 0, 0]);
    bones[`${side}ForeArm`] = bone(`${side}ForeArm`, bones[`${side}Arm`], [0.05 * s, -0.27, 0]);
    bones[`${side}Hand`] = bone(`${side}Hand`, bones[`${side}ForeArm`], [0.03 * s, -0.25, 0]);
    bones[`${side}UpLeg`] = bone(`${side}UpLeg`, bones.Hips, [0.1 * s, -0.05, 0]);
    bones[`${side}Leg`] = bone(`${side}Leg`, bones[`${side}UpLeg`], [0, -0.44, 0]);
    bones[`${side}Foot`] = bone(`${side}Foot`, bones[`${side}Leg`], [0, -0.43, 0]);
    bones[`${side}ToeBase`] = bone(`${side}ToeBase`, bones[`${side}Foot`], [0, -0.06, 0.12]);
  }
  root.updateMatrixWorld(true);
  return { root, bones };
}
const world = (b) => b.getWorldPosition(new THREE.Vector3());

describe('rigRagdoll', () => {
  it('lays a standing figure down on the floor, the way it was pushed, its bones keeping their lengths', () => {
    const { root, bones } = figure();
    const shin = world(bones.LeftLeg).distanceTo(world(bones.LeftFoot));
    const rag = rigRagdoll(bones, { collide: flatFloor(0), push: { x: 0, y: 0, z: -1 }, speed: 2.5 });
    for (let t = 0; t < 4; t += 1 / 60) rag.step(1 / 60);
    root.updateMatrixWorld(true);
    // the head down near the floor, pushed towards −z
    const head = world(bones.Head);
    expect(head.y).toBeLessThan(0.45);
    expect(head.z).toBeLessThan(-0.3);
    // nothing under the floor
    for (const b of Object.values(bones)) expect(world(b).y, b.name).toBeGreaterThan(-0.05);
    // (the bones turned, not stretched: the shin as long as it was)
    expect(world(bones.LeftLeg).distanceTo(world(bones.LeftFoot))).toBeCloseTo(shin, 2);
    expect(rag.settled).toBe(true);
  });

  it('bends the knees forward, the way they bend, and never flies off falling from a kneel', () => {
    const { root, bones } = figure();
    // knelt: the right knee down in front, the left foot planted (the figure faces +z)
    bones.RightUpLeg.rotation.x = -1.3;
    bones.RightLeg.rotation.x = 1.4;
    bones.LeftUpLeg.rotation.x = -1.4;
    bones.LeftLeg.rotation.x = 1.4;
    bones.Hips.position.y = 0.62;
    root.updateMatrixWorld(true);
    const rag = rigRagdoll(bones, { collide: flatFloor(0), push: { x: 0, y: 0, z: -1 }, speed: 2.4 });
    let highest = 0;
    for (let t = 0; t < 4; t += 1 / 60) {
      rag.step(1 / 60);
      highest = Math.max(highest, rag.point('Hips').y);
    }
    expect(highest).toBeLessThan(0.9);
    const v = (n) => new THREE.Vector3(rag.point(n).x, rag.point(n).y, rag.point(n).z);
    const across = v('RightUpLeg').sub(v('LeftUpLeg'));
    const up = v('Spine').sub(v('Hips'));
    const forward = new THREE.Vector3().crossVectors(up, across).normalize();
    for (const s of ['Left', 'Right']) {
      const hip = v(`${s}UpLeg`);
      const foot = v(`${s}Foot`);
      const knee = v(`${s}Leg`);
      const line = foot.clone().sub(hip);
      const t = knee.clone().sub(hip).dot(line) / line.lengthSq();
      const out = knee.clone().sub(hip.clone().add(line.multiplyScalar(t)));
      expect(out.dot(forward), s).toBeGreaterThan(-0.05);
    }
  });

  it('puts the bones back as the points say every step, the hips where their point is', () => {
    const { root, bones } = figure();
    const rag = rigRagdoll(bones, { collide: flatFloor(0), push: { x: 1, y: 0, z: 0 }, speed: 1 });
    rag.step(1 / 60);
    root.updateMatrixWorld(true);
    const hips = world(bones.Hips);
    const p = rag.point('Hips');
    expect(hips.distanceTo(new THREE.Vector3(p.x, p.y, p.z))).toBeLessThan(1e-4);
  });

  it('names its points: indexOf a bone, -1 for one it has not', () => {
    const { bones } = figure();
    const rag = rigRagdoll(bones, { collide: flatFloor(0), speed: 0 });
    expect(rag.indexOf('Hips')).toBe(0);
    expect(rag.indexOf('Nobody')).toBe(-1);
    expect(rag.names).toHaveLength(rag.body.n);
    expect(rag.names[rag.indexOf('Head')]).toBe('Head');
  });
});
