import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { skeleton } from '../../../lib/three/fixtures/gameSkeleton.js';
import { AITRAJECTORY_TURN } from './facing.js';
import { createFigures } from './figures.js';
import { createHeld, weaponUrl } from './held.js';

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};
const clip = (name) => new THREE.AnimationClip(name, 1, [new THREE.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0])]);

// a stand-in body: the game's root, hips and weapon socket, the humanoid's names
function body() {
  const model = new THREE.Group();
  const traj = new THREE.Object3D();
  traj.name = 'AITrajectory';
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const socket = new THREE.Bone();
  socket.name = 'Wep_Root';
  socket.position.set(0.3, 1.3, 0);
  hips.add(socket);
  traj.add(hips);
  model.add(traj);
  const clips = Object.fromEntries(['idle', 'aim.rifle', 'aim.pistol', 'walk', 'run', 'die.fwd'].map((n) => [n, clip(n)]));
  return { model, clips, sockets: { weapon: socket } };
}

function setup() {
  const guns = [];
  const stances = [];
  const waits = [];
  const held = createHeld({
    load: (url) => {
      guns.push(url);
      return Promise.resolve({ scene: new THREE.Group(), animations: [] });
    },
  });
  // (a stance pack lands when the test says)
  const loadStance = (key) => {
    stances.push(key);
    return new Promise((resolve) => waits.push(() => resolve(new Map([[`stance.${key}.idle`, clip(`stance.${key}.idle`)]]))));
  };
  const scene = new THREE.Scene();
  const figs = createFigures({ scene, loadBody: async () => body(), held, loadStance });
  return { figs, guns, stances, land: () => waits.shift()() };
}

const soldier = { id: 3, team: 2, at: [5, 0, 1], yaw: 0, state: 'alive', stance: 'stand', vel: [0, 0], t: 0, weapon: 'e11' };

describe('a soldier’s figure with its weapon', () => {
  it('turns the body to the sim’s facing (the clips’ AITrajectory turn put back)', async () => {
    const { figs } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    expect(figs.figure(3).model.getObjectByName('AITrajectory').quaternion.toArray()).toEqual(AITRAJECTORY_TURN);
    expect(figs.figure(3).model.rotation.y).toBe(0);
  });

  it('arms it with the class weapon and gives its muzzle in the world', async () => {
    const { figs, guns } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    expect(guns).toEqual([weaponUrl('e11')]);
    const out = new THREE.Vector3();
    expect(figs.muzzleOf(3, out)).toBe(out);
    // (the stand-in's socket under the turned AITrajectory: its +x is the
    // world's +z, its +z the world's −x; the hips a frame into the clip's rise)
    const hipsY = figs.figure(3).model.getObjectByName('Hips').position.y;
    expect(out.x).toBeCloseTo(5 - 0.298969, 6);
    expect(out.y).toBeCloseTo(hipsY + 1.3 + 0.049385, 6);
    expect(out.z).toBeCloseTo(1 + 0.3, 6);
    expect(figs.muzzleOf(99, out)).toBe(null);
    // (a new weapon: the gun swapped)
    figs.update([{ ...soldier, weapon: 'dh17', t: 1 }], 0.016);
    await settle();
    expect(guns).toEqual([weaponUrl('e11'), weaponUrl('dh17')]);
  });

  it('stands armed: a held pose until the stance pack lands, then the pack’s idle', async () => {
    const { figs, stances, land } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    expect(stances).toEqual(['t']);
    expect(figs.figure(3).clip).toBe('aim.rifle');
    land();
    await settle();
    figs.update([soldier], 0.016);
    expect(figs.figure(3).clip).toBe('stance.t.idle');
    // (a pistol's pose while its pack comes)
    figs.update([{ ...soldier, weapon: 'rk3', t: 1 }], 0.016);
    expect(stances).toEqual(['t', 'p']);
    expect(figs.figure(3).clip).toBe('aim.pistol');
  });

  it('takes the gun off a figure that leaves the view', async () => {
    const { figs } = setup();
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    const socket = figs.figure(3).sockets.weapon;
    expect(socket.children.length).toBe(1);
    figs.update([], 0.016);
    expect(socket.children.length).toBe(0);
  });
});

// a body on the game's skeleton with no clips, loaded at once
const gameBody = async () => {
  const model = new THREE.Group();
  model.add(skeleton().Hips.parent);
  return { model, clips: {} };
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const trooper = (over = {}) => ({ id: 'a', team: 2, kind: 'soldier', at: [1, 0, 2], yaw: 0, state: 'alive', t: 0, vel: [0, 0], fall: null, ...over });

// a stand-in for ragdolls.js: it takes every fall and has the body at once
function fakeRagdolls() {
  const handed = new Set();
  return {
    fall: vi.fn((id) => {
      handed.add(id);
      return true;
    }),
    handed: (id) => handed.has(id),
    drop: vi.fn((id) => handed.delete(id)),
  };
}

describe('the figures and the ragdolls', () => {
  it('hands a fallen soldier to the ragdolls with how it fell, then stops placing it', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper()], 0.05);
    await tick();
    figs.update([trooper()], 0.05);
    expect(ragdolls.fall).not.toHaveBeenCalled();
    const fall = { part: 'head', dir: [0, 0, 1], at: [1, 1.6, 2], weapon: 'e11' };
    const eye = [0, 2, 0];
    figs.update([trooper({ state: 'dying', fall, t: 0.05 })], 0.05, 1, eye);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
    expect(ragdolls.fall.mock.calls[0][0]).toBe('a');
    expect(ragdolls.fall.mock.calls[0][2]).toMatchObject({ fall, eye });
    const model = figs.figure('a').model;
    figs.update([trooper({ state: 'down', fall, at: [9, 0, 9], t: 0.1 })], 0.05, 1, eye);
    expect(model.position.x).toBeCloseTo(1, 9);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
  });

  it('drops the ragdoll when the sim takes the soldier away, or it stands again', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper(), trooper({ id: 'b' })], 0.05);
    await tick();
    figs.update([trooper({ state: 'dying' }), trooper({ id: 'b', state: 'dying' })], 0.05);
    figs.update([trooper({ state: 'alive', t: 1 })], 0.05);
    expect(ragdolls.drop).toHaveBeenCalledWith('b');
    expect(ragdolls.drop).toHaveBeenCalledWith('a');
    expect(figs.figure('a').model.visible).toBe(true);
    figs.update([trooper({ state: 'alive', at: [5, 0, 5], t: 2 })], 0.05);
    expect(figs.figure('a').model.position.x).toBeCloseTo(5, 9);
  });

  it('asks the ragdolls once per death: a refused body keeps its death clip and is not offered again', async () => {
    const ragdolls = fakeRagdolls();
    ragdolls.fall.mockImplementation(() => false);
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper()], 0.05);
    await tick();
    for (let i = 0; i < 20; i++) figs.update([trooper({ state: i < 2 ? 'dying' : 'down', at: [3, 0, 3], t: 1 + i })], 0.05);
    expect(ragdolls.fall).toHaveBeenCalledTimes(1);
    expect(ragdolls.drop).not.toHaveBeenCalled();
    expect(figs.figure('a').model.position.x).toBeCloseTo(3, 9);
    // (up again, then a new death: asked again)
    figs.update([trooper({ state: 'alive', t: 30 })], 0.05);
    expect(ragdolls.drop).not.toHaveBeenCalled();
    figs.update([trooper({ state: 'dying', t: 31 })], 0.05);
    expect(ragdolls.fall).toHaveBeenCalledTimes(2);
  });

  it('draws a soldier up again under the same id at its new place, not sliding from the corpse', async () => {
    const ragdolls = fakeRagdolls();
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody, ragdolls });
    figs.update([trooper()], 0.05);
    await tick();
    figs.update([trooper({ state: 'dying', at: [3, 0, 3], t: 1 })], 0.05);
    // (deployed between steps: the same step time, a new place)
    figs.update([trooper({ state: 'alive', at: [40, 0, 40], t: 1 })], 0.05, 0);
    expect(figs.figure('a').model.position.x).toBeCloseTo(40, 9);
  });

  it('draws as before with no ragdolls', async () => {
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: gameBody });
    figs.update([trooper()], 0.05);
    await tick();
    figs.update([trooper({ state: 'down', at: [3, 0, 3], t: 1 })], 0.05);
    expect(figs.figure('a').model.position.x).toBeCloseTo(3, 9);
  });
});

describe('the gun when the ragdoll has the body', () => {
  it('leaves the hand, so no bolt comes from a fallen soldier, and comes back if it stands', async () => {
    const ragdolls = fakeRagdolls();
    const guns = [];
    const held = createHeld({
      load: (url) => {
        guns.push(url);
        return Promise.resolve({ scene: new THREE.Group(), animations: [] });
      },
    });
    const figs = createFigures({ scene: new THREE.Scene(), loadBody: async () => body(), held, loadStance: async () => new Map(), ragdolls });
    figs.update([soldier], 0.016);
    await settle();
    figs.update([soldier], 0.016);
    await settle();
    const socket = figs.figure(3).sockets.weapon;
    expect(socket.children.length).toBe(1);
    figs.update([{ ...soldier, state: 'dying', t: 1 }], 0.016);
    expect(socket.children.length).toBe(0);
    expect(figs.muzzleOf(3, new THREE.Vector3())).toBe(null);
    figs.update([{ ...soldier, t: 2 }], 0.016);
    await settle();
    expect(socket.children.length).toBe(1);
    expect(guns).toEqual([weaponUrl('e11'), weaponUrl('e11')]);
  });
});
