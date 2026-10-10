import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { bladeInHand, heldBlade } from './heldBlade';
import { meshyRig } from '../../../lib/three/meshyRig.fixture';
import { walrusFigure } from './walrusFigure.fixture';

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

// a figure on the game's rig as activity.js has one: its model in a holder, in a scene
const standing = async () => {
  const w = await walrusFigure();
  return { ...w, rig: { bones: w.fig.bones } };
};
// one on another rig (Meshy's)
const meshy = () => {
  const rig = meshyRig();
  const scene = new THREE.Group();
  const holder = new THREE.Group();
  scene.add(holder);
  holder.add(rig.model);
  scene.updateMatrixWorld(true);
  return { rig, scene, holder, fig: { model: rig.model, bones: rig.bones, tall: 1.8 } };
};

describe('a duellist’s blade', () => {
  it('held where an unrigged figure’s hand would hang, lit, as before', () => {
    const h = heldBlade({ color: '#ff3b3b' }, 2);
    expect(h.arm.children).toContain(h.gun);
    expect(h.gun.getObjectByName('blade').visible).toBe(true);
    expect(h.arm.position.y).toBeCloseTo(0.94, 5);
    h.owned.forEach((o) => o.dispose?.());
  });

  it('in the game’s weapon socket of a figure on the game’s rig: lit, swung in its hero’s strikes', async () => {
    const { scene, fig } = await standing();
    const b = bladeInHand(fig, { color: '#ff3b3b' }, { parent: scene, who: 'vader' });
    expect(b).not.toBeNull();
    expect(b.gun.parent).toBe(b.gp.socket);
    expect(b.saber.rules.hero).toBe('vader');
    const blade = b.gun.getObjectByName('blade');
    for (let i = 0; i < 20; i++) {
      scene.updateMatrixWorld(true);
      b.pose(1 / 30, i / 30, { forward: FORWARD, up: UP, me: { x: 0, z: 0, yaw: 0 } });
    }
    expect(blade.visible).toBe(true);
    expect(blade.scale.y).toBeGreaterThan(0.9);
    // a strike: it's busy through it, and it ends
    expect(b.swing(1)).toBeTruthy();
    expect(b.busy).toBe(true);
    for (let i = 0; i < 90; i++) {
      scene.updateMatrixWorld(true);
      b.pose(1 / 30, 1 + i / 30, { forward: FORWARD, up: UP, me: { x: 0, z: 0, yaw: 0 } });
    }
    expect(b.busy).toBe(false);
    b.light(false);
    b.dispose();
  });

  it('nothing for a rigged figure off the game’s rig: it doesn’t fence (heldBlade’s arm then)', () => {
    const { scene, fig } = meshy();
    expect(bladeInHand(fig, { color: '#ff3b3b' }, { parent: scene })).toBeNull();
  });

  it('nothing for a figure with no hand to hold it (heldBlade’s arm then)', () => {
    const shapes = { model: new THREE.Group(), tall: 1.8 };
    expect(bladeInHand(shapes, { color: '#f00' })).toBeNull();
    expect(bladeInHand(null, { color: '#f00' })).toBeNull();
    // (a group named like a hand isn't a bone to hold it with)
    const g = new THREE.Group();
    const fake = new THREE.Group();
    fake.name = 'RightHand';
    g.add(fake);
    expect(bladeInHand({ model: g }, { color: '#f00' })).toBeNull();
  });
});

describe('a duellist’s blade and the eye', () => {
  it('hands the camera’s position to its saber as eye, held and going down (its light, out past 12 m: saberLight.js)', async () => {
    const { scene, fig } = await standing();
    const b = bladeInHand(fig, { color: '#ff3b3b' }, { parent: scene });
    const update = vi.spyOn(b.saber, 'update');
    const eye = new THREE.Vector3(0, 1.6, -3);
    b.pose(1 / 30, 0, { forward: FORWARD, up: UP, me: { x: 0, z: 0, yaw: 0 }, eye });
    expect(update.mock.calls.at(-1)[2].eye).toBe(eye);
    b.pose(1 / 30, 1 / 30, { forward: FORWARD, up: UP, me: { x: 0, z: 0, yaw: 0 } });
    expect(update.mock.calls.at(-1)[2].eye).toBe(null);
    b.out(1 / 30, 2 / 30, { forward: FORWARD, up: UP, eye });
    expect(update.mock.calls.at(-1)[2].eye).toBe(eye);
    b.dispose();
  });
});

describe('a duellist’s blade and the side a cut comes in on', () => {
  it('hands the side to its saber’s block (a 2017 hero’s block is the game’s for it: saber.js)', async () => {
    const { scene, fig } = await standing();
    const b = bladeInHand(fig, { color: '#ff3b3b' }, { parent: scene });
    const block = vi.spyOn(b.saber, 'block');
    b.block(true, 'left');
    expect(block).toHaveBeenLastCalledWith(true, 'left');
    b.block(false);
    expect(block.mock.calls.at(-1)[0]).toBe(false);
    b.dispose();
  });
});
