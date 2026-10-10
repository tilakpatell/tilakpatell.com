import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAdditiveLayer } from './additiveLayer';

// a chest bone and a turn of it by a quarter about y as an additive clip
const rig = () => {
  const root = new THREE.Group();
  const chest = new THREE.Bone();
  chest.name = 'Spine2';
  chest.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.3);
  root.add(chest);
  return { root, chest };
};
const quarter = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
const pose = (name, q = quarter, duration = 0) => {
  const c = new THREE.AnimationClip(name, duration, [new THREE.QuaternionKeyframeTrack('Spine2.quaternion', duration ? [0, duration] : [0], duration ? [0, 0, 0, 1, ...q.toArray()] : q.toArray())]);
  c.userData = { additive: true };
  return c;
};

describe('the additive layer', () => {
  it('lays an aim over the pose by its weight, and only once however often it’s laid', () => {
    const { root, chest } = rig();
    const base = chest.quaternion.clone();
    const layer = createAdditiveLayer(root, { 'add.aim.left': pose('add.aim.left') });
    layer.aim(0, Math.PI / 4); // (half way left: half the pose)
    layer.apply(0.016);
    expect(chest.quaternion.angleTo(base.clone().multiply(new THREE.Quaternion().slerp(quarter, 0.5)))).toBeLessThan(1e-4);
    layer.aim(0, Math.PI / 2); // (all the way left)
    layer.apply(0.016);
    const want = base.clone().multiply(quarter);
    expect(chest.quaternion.angleTo(want)).toBeLessThan(1e-4);
    layer.apply(0.016);
    expect(chest.quaternion.angleTo(want)).toBeLessThan(1e-4);
    layer.aim(0, 0);
    layer.apply(0.016);
    expect(chest.quaternion.angleTo(base)).toBeLessThan(1e-4);
  });
  it('takes a pose the clips set afresh as the one to lay over', () => {
    const { root, chest } = rig();
    const layer = createAdditiveLayer(root, { 'add.aim.left': pose('add.aim.left') });
    layer.aim(0, Math.PI / 2);
    layer.apply(0.016);
    const fresh = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2);
    chest.quaternion.copy(fresh); // (the mixer, the next frame)
    layer.apply(0.016);
    expect(chest.quaternion.angleTo(fresh.clone().multiply(quarter))).toBeLessThan(1e-4);
  });
  it('plays a hit by its side once through, and says when it has none', () => {
    const { root, chest } = rig();
    const base = chest.quaternion.clone();
    const layer = createAdditiveLayer(root, { 'add.hit.left': pose('add.hit.left', quarter, 0.5) });
    expect(layer.hit('front')).toBe(false);
    expect(layer.hit('left')).toBe(true);
    layer.apply(0.25);
    expect(chest.quaternion.angleTo(base)).toBeGreaterThan(0.1);
    for (let i = 0; i < 10; i++) layer.apply(0.1);
    expect(chest.quaternion.angleTo(base)).toBeLessThan(1e-4);
  });
  it('lays nothing, and leaves the pose be, with no additive clips (Review Focus 2)', () => {
    const { root, chest } = rig();
    const base = chest.quaternion.clone();
    const layer = createAdditiveLayer(root, {});
    expect(layer.has('add.aim.up')).toBe(false);
    layer.aim(0.5, 0.5);
    expect(layer.hit('front')).toBe(false);
    layer.apply(0.1);
    expect(chest.quaternion.equals(base)).toBe(true);
  });
});
