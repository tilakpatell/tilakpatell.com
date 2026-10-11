import { describe, expect, it } from 'vitest';
import { probeScene } from './litWorld';

describe('the tier probe’s scene', () => {
  it('is the ring at high: 12 pillars, 12 spheres, the cube and the ground, all in the sun’s shadow', () => {
    const { scene, camera, dispose } = probeScene();
    const meshes = [];
    scene.traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes.length).toBe(26);
    expect(meshes.filter((m) => m.castShadow).length).toBe(25);
    const sun = scene.children.find((o) => o.isDirectionalLight);
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.mapSize.x).toBe(2048);
    expect(camera.aspect).toBeCloseTo(16 / 9);
    expect(() => dispose()).not.toThrow();
  });
});
