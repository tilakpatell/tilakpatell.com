import { describe, expect, it } from 'vitest';
import { createShadowPhase, nearInstances, splitNear, zoneVisibility } from './near';

describe('the scatter near you', () => {
  it('finds the scatter near you', () => {
    const xs = Float32Array.from([0, 10, 100, -47]);
    const zs = Float32Array.from([0, 0, 0, 0]);
    expect([...nearInstances(xs, zs, 0, 0, 48)]).toEqual([0, 1, 3]);
  });

  it('measures across the ground, both ways', () => {
    const xs = Float32Array.from([30, 30, 0]);
    const zs = Float32Array.from([30, 40, -48.5]);
    expect([...nearInstances(xs, zs, 0, 0, 48)]).toEqual([0]); // (42.4 in, 50 out, 48.5 just out)
  });

  it('stops at a limit, the nearest kept', () => {
    const xs = Float32Array.from([40, 1, 20, 3, 30]);
    const zs = new Float32Array(5);
    expect([...nearInstances(xs, zs, 0, 0, 48, 3)].sort()).toEqual([1, 2, 3]);
  });
});

describe('going in and out', () => {
  it('shows the outdoors or the zones, never both', () => {
    expect(zoneVisibility(true)).toEqual({ outdoors: false, zones: true });
    expect(zoneVisibility(false)).toEqual({ outdoors: true, zones: false });
  });
});

describe('drawn into the shadow only', () => {
  it('is in the frustum during the shadow pass and out of it in the view', async () => {
    const THREE = await import('three');
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight();
    const shadows = createShadowPhase(scene, sun);
    const mesh = shadows.only(new THREE.Mesh(new THREE.BoxGeometry()));
    scene.onBeforeRender();
    expect(mesh.intersectsFrustum(new THREE.Frustum())).toBe(false);
    sun.shadow.updateMatrices(sun);
    expect(mesh.intersectsFrustum(new THREE.Frustum())).toBe(true);
    scene.onBeforeRender();
    expect(mesh.intersectsFrustum(new THREE.Frustum())).toBe(false);
    shadows.dispose();
  });
});

describe('near and far', () => {
  it('splits every instance into near and far, once each', () => {
    const xs = Float32Array.from([0, 10, 100, -47, 300]);
    const zs = Float32Array.from([0, 0, 0, 0, 5]);
    const { near, far } = splitNear(xs, zs, 0, 0, 60);
    expect([...near]).toEqual([0, 1, 3]);
    expect([...far]).toEqual([2, 4]);
  });
});
