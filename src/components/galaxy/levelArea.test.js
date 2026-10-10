import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createLevelArea } from './levelArea';

describe('a level’s area of its own (Kamino’s storm)', () => {
  const make = (scene) => createLevelArea(scene, { at: [100, 20, -50], radius: 140, sea: -0.5, fog: { color: '#56636d', density: 0.02 } });

  it('puts its sky and its sea round the battle, the sea at the level’s height', () => {
    const scene = new THREE.Scene();
    const a = make(scene);
    expect(scene.getObjectByName('level-area')).toBe(a.group);
    expect(a.group.getObjectByName('level-area-sea').position.y).toBeCloseTo(-20.5, 5);
    expect(a.group.getObjectByName('level-area-sky').geometry.parameters.radius).toBe(140);
  });

  it('lays the storm’s fog on while you’re inside, and gives the scene its own back', () => {
    const scene = new THREE.Scene();
    const own = new THREE.Fog('#000000', 1, 2);
    scene.fog = own;
    const a = make(scene);
    a.update({ position: { x: 100, y: 30, z: -50 } });
    expect(scene.fog).toBeInstanceOf(THREE.FogExp2);
    expect(scene.fog.density).toBe(0.02);
    a.update({ position: { x: 1000, y: 0, z: 0 } });
    expect(scene.fog).toBe(own);
    a.update({ position: { x: 90, y: 20, z: -40 } });
    a.dispose();
    expect(scene.fog).toBe(own);
    expect(scene.getObjectByName('level-area')).toBeUndefined();
  });
});
