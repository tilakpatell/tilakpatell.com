import * as THREE from 'three';
import { expect, it } from 'vitest';
import { nebulaBudget } from './budget';
import { createFog } from './fog';
import { fogLayers } from './rules';

it('shows its layers far to near, and hides', () => {
  const f = createFog({ volume: new THREE.Data3DTexture(new Uint8Array(2), 1, 1, 1), row: nebulaBudget('high') });
  f.show({ centre: [0, 0, -100], r: 700, colours: [new THREE.Color(), new THREE.Color(), new THREE.Color()], seed: [0.1, 0.2, 0.3], form: 0, depth: 0.8 }, fogLayers(nebulaBudget('high'), 700));
  expect(f.mesh.visible).toBe(true);
  expect(f.mesh.geometry.instanceCount).toBe(4);
  const radii = [0, 1, 2, 3].map((i) => f.mesh.geometry.attributes.aLayer.getX(i));
  expect(radii).toEqual([...radii].sort((a, b) => b - a));
  expect(f.mesh.material.uniforms.uDepth.value).toBe(0.8);
  f.hide();
  expect(f.mesh.visible).toBe(false);
  f.dispose();
});
