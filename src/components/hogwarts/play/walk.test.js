import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { WALK } from '../rules/walk';
import { createWalker, inputOf } from './walk';

const snap = (held = [], drag = null) => ({ action: (n) => held.includes(n), pointer: { drag } });
const FLAT = { floorAt: () => 0.5, level: 0, bounds: null, solids: [] };

describe('the player on foot', () => {
  it('reads the keys and the stick into the walk’s input, the stick pushed all the way a run', () => {
    expect(inputOf(snap(['forward', 'left']))).toEqual({ forward: 1, strafe: -1, run: false });
    expect(inputOf(snap(['back', 'right', 'run']))).toEqual({ forward: -1, strafe: 1, run: true });
    // (the stick's y is down the screen: pushed up is forward)
    expect(inputOf(snap(), { x: 0, y: -1 })).toEqual({ forward: 1, strafe: 0, run: true });
    expect(inputOf(snap(), { x: 0.3, y: 0 }).run).toBe(false);
  });

  it('puts the camera at a first-year’s eye over the floor, looking the way it faces', () => {
    const camera = new THREE.PerspectiveCamera();
    createWalker({ camera, world: FLAT, at: [3, 4], yaw: 0.5, reduced: true });
    expect(camera.position.toArray()).toEqual([3, 0.5 + WALK.eye, 4]);
    expect(camera.rotation.y).toBeCloseTo(0.5, 9);
  });

  it('walks and looks round as it steps', () => {
    const camera = new THREE.PerspectiveCamera();
    const w = createWalker({ camera, world: FLAT, at: [0, 0], yaw: 0, reduced: true });
    for (let i = 0; i < 60; i++) w.step(1 / 60, snap(['forward']));
    expect(w.state.z).toBeLessThan(-1);
    w.step(1 / 60, snap([], { dx: 100, dy: 0 }));
    expect(w.state.yaw).toBeLessThan(0);
  });
});
