import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LAMPS, UNSEEN, createLamps } from './lamps';

const lamp = (colour, intensity, at, { distance = 20, decay = 1.5 } = {}) => {
  const l = new THREE.PointLight(colour, intensity, distance, decay);
  l.position.set(...at);
  return l;
};

describe('lamps: the stages’ lights through a pool the scene always has', () => {
  it('the scene’s lights never change: the pool’s are its, a stage’s are on a layer no camera sees', () => {
    const scene = new THREE.Scene();
    const lamps = createLamps(scene);
    expect(lamps.lights).toHaveLength(LAMPS);
    const stage = new THREE.Group();
    stage.add(lamp(0xff8a3a, 7, [0, 1, 0]), lamp(0xdfe9ff, 0, [3, 2, 0]));
    scene.add(stage);
    expect(lamps.take(stage)).toBe(2);
    const camera = new THREE.PerspectiveCamera();
    const seen = [];
    scene.traverse((o) => {
      if (o.isLight && o.layers.test(camera.layers)) seen.push(o);
    });
    expect(seen).toEqual(lamps.lights);
    for (const l of stage.children) expect(l.layers.isEnabled(UNSEEN)).toBe(true);
  });

  it('each frame the brightest near the camera on the pool’s, where they stand in the world; the rest dark', () => {
    const scene = new THREE.Scene();
    const lamps = createLamps(scene, { count: 2 });
    const stage = new THREE.Group();
    stage.position.set(0, 0, 100);
    const fire = lamp(0xff5a1c, 900, [0, -30, 0], { distance: 90, decay: 1.2 });
    const staff = lamp(0xdfe9ff, 42, [0, 2, -10], { distance: 24, decay: 1.3 });
    const far = lamp(0xffffff, 5, [0, 2, 400]);
    const off = lamp(0xffffff, 0, [0, 2, 0]);
    stage.add(fire, staff, far, off);
    scene.add(stage);
    lamps.take(stage);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 2, 95);
    scene.updateMatrixWorld(true);
    lamps.update(camera);
    const [a, b] = lamps.lights;
    // (the staff 5 m off outweighs the fire 30 m down; the far one and the one out are left)
    expect(a.intensity).toBe(42);
    expect(a.position.toArray()).toEqual([0, 2, 90]);
    expect(a.distance).toBe(24);
    expect(a.decay).toBe(1.3);
    expect(b.intensity).toBe(900);
    expect(b.color.getHex()).toBe(0xff5a1c);
    // (a stage hidden, its lamps out of the pool; given back, gone for good)
    stage.visible = false;
    lamps.update(camera);
    expect(lamps.lights.map((l) => l.intensity)).toEqual([0, 0]);
    stage.visible = true;
    lamps.give(stage);
    lamps.update(camera);
    expect(lamps.lights.map((l) => l.intensity)).toEqual([0, 0]);
  });
});
