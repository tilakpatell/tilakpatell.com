import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { dropTransmission } from './glass';

describe('dropTransmission', () => {
  it('turns transmission into plain see-through glass', () => {
    const root = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ transmission: 0.78 });
    const paint = new THREE.MeshStandardMaterial();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), [glass, paint]));
    expect(dropTransmission(root)).toBe(1);
    expect(glass.transmission).toBe(0);
    expect(glass.transparent).toBe(true);
    expect(glass.opacity).toBeCloseTo(0.35);
    expect(glass.depthWrite).toBe(false);
    expect(paint.transparent).toBe(false);
  });

  it('counts each glass material once, however many meshes share it, and leaves a model with none alone', () => {
    const root = new THREE.Group();
    const glass = new THREE.MeshPhysicalMaterial({ transmission: 1 });
    const hull = new THREE.MeshPhysicalMaterial({ transmission: 0 });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), glass), new THREE.Mesh(new THREE.BoxGeometry(), glass), new THREE.Mesh(new THREE.BoxGeometry(), hull));
    expect(dropTransmission(root)).toBe(1);
    expect(hull.transparent).toBe(false);
    expect(hull.opacity).toBe(1);
    expect(dropTransmission(root)).toBe(0);
  });
});
