import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ANIM_BANDS, animDue, animEvery, quietBones } from './lod.js';

// a body as the game's rig hangs one: a root, the hips, a spine and an arm
// to the gun's socket, a leg to the foot, the skin beside the hips, a
// helmet on the head
function body() {
  const root = new THREE.Group();
  const bone = (name, parent) => {
    const b = new THREE.Bone();
    b.name = name;
    parent.add(b);
    return b;
  };
  const hips = bone('hips', root);
  const spine = bone('spine', hips);
  const arm = bone('arm', spine);
  const hand = bone('hand', arm);
  const leg = bone('leg', hips);
  const foot = bone('foot', leg);
  const head = bone('head', spine);
  head.add(new THREE.Mesh());
  root.add(new THREE.SkinnedMesh());
  return { root, hips, spine, arm, hand, leg, foot, head };
}

describe('the bones three need not walk', () => {
  it('are the ones with nothing drawn under them and no socket on them', () => {
    const b = body();
    expect(quietBones(b.root, [b.hand])).toBe(2);
    expect(b.leg.visible).toBe(false);
    expect(b.foot.visible).toBe(false);
    for (const k of ['hips', 'spine', 'arm', 'hand', 'head']) expect(b[k].visible, k).toBe(true);
  });

  it('keep a socket’s whole chain, so a gun put on it later is drawn', () => {
    const b = body();
    quietBones(b.root, [b.hand]);
    const gun = new THREE.Mesh();
    b.hand.add(gun);
    let drawn = true;
    for (let o = gun; o; o = o.parent) drawn &&= o.visible;
    expect(drawn).toBe(true);
  });

  it('are worked out afresh each time: a bone that gains a mesh is walked again', () => {
    const b = body();
    quietBones(b.root, [b.hand]);
    b.foot.add(new THREE.Mesh());
    expect(quietBones(b.root, [b.hand])).toBe(0);
    expect(b.leg.visible).toBe(true);
  });

  it('still move the skin: a hidden bone’s world matrix is made as any other’s', () => {
    const b = body();
    quietBones(b.root, [b.hand]);
    b.foot.position.set(0, -1, 0);
    b.root.updateMatrixWorld(true);
    expect(b.foot.matrixWorld.elements[13]).toBe(-1);
  });
});

describe('how often a soldier is animated', () => {
  it('every frame near, every second further, every fourth far', () => {
    expect(ANIM_BANDS.map(([d]) => d)).toEqual([30, 70, Infinity]);
    expect(animEvery(10)).toBe(1);
    expect(animEvery(45)).toBe(2);
    expect(animEvery(200)).toBe(4);
  });

  it('every frame when the distance is not known', () => {
    expect(animEvery(NaN)).toBe(1);
    expect(animEvery(undefined)).toBe(1);
  });

  it('spreads the far ones over the frames by their slot, each once in its every', () => {
    const due = (slot) => [0, 1, 2, 3, 4, 5, 6, 7].filter((f) => animDue(f, 4, slot));
    expect(due(0)).toEqual([0, 4]);
    expect(due(1)).toEqual([3, 7]);
    expect([0, 1, 2, 3].every((f) => animDue(f, 1, 7))).toBe(true);
  });
});
