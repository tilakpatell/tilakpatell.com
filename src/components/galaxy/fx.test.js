import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBolts, createFlashes } from './fx';

describe('the bolts', () => {
  it('make their instance colours from the start, so the first shot compiles nothing', () => {
    const scene = new THREE.Scene();
    const b = createBolts(scene, { count: 12 });
    expect(b.mesh.instanceColor).toBeTruthy();
    expect(b.mesh.instanceColor.count).toBe(12);
    // (and a shot afterwards keeps the same buffer, so the program is the same one)
    const before = b.mesh.instanceColor;
    b.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, 40), {});
    b.update(0.1);
    expect(b.mesh.instanceColor).toBe(before);
    expect(b.mesh.count).toBe(1);
    b.dispose();
  });
});

describe('the flashes', () => {
  it('swell and go out, and give their slot back', () => {
    const scene = new THREE.Scene();
    const f = createFlashes(scene, { count: 4 });
    expect(f.busy).toBe(false);
    f.at(new THREE.Vector3(1, 2, 3), { size: 1.6, life: 0.8 });
    f.update(0.1);
    expect(f.busy).toBe(true);
    f.update(1);
    expect(f.busy).toBe(false);
    f.dispose();
  });
});
