import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createGadgetFx } from './gadgetFx';

const V = THREE.Vector3;
// a figure standing on the ground: a body and a head, its own material each
const figure = () => {
  const parent = new THREE.Group();
  const root = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#884422' });
  const head = new THREE.MeshStandardMaterial({ color: '#ffccaa' });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 0.3), body));
  root.add(new THREE.Mesh(new THREE.SphereGeometry(0.15), head));
  parent.add(root);
  return { parent, root, mats: [body, head] };
};
const run = (fx, seconds) => {
  for (let t = 0; t < seconds; t += 1 / 60) fx.update(1 / 60);
};

describe('the freeze ray', () => {
  it('stops them dead, ices them over, and shatters them at a second and a half', () => {
    const { parent, root, mats } = figure();
    const fx = createGadgetFx({ parent });
    const heard = [];
    const h = fx.freeze({ root, tall: 1.8, up: new V(0, 1, 0), push: new V(1, 0, 0), on: (e) => heard.push(e) });
    const at = root.position.clone();
    run(fx, 0.8);
    expect(root.visible).toBe(true);
    expect(root.position.distanceTo(at)).toBeLessThan(0.05); // (stopped where they stood)
    // the figure's own materials are untouched; its copies have gone to ice
    expect(mats[0].color.getHexString()).toBe('884422');
    const iced = root.children[0].material;
    expect(iced).not.toBe(mats[0]);
    expect(iced.color.b).toBeGreaterThan(iced.color.r);
    expect(parent.children.length).toBeGreaterThan(1); // (the ice round them)
    run(fx, 0.9);
    expect(heard).toEqual(['shatter']);
    expect(root.visible).toBe(false);
    expect(h.done).toBe(false);
    run(fx, 1.6);
    expect(h.done).toBe(true);
    h.dispose();
    expect(root.children[0].material).toBe(mats[0]);
    expect(root.visible).toBe(true);
    expect(parent.children).toEqual([root]);
    expect(fx.count).toBe(0);
  });

  it('throws the shards out and down onto the ground, never under it', () => {
    const { parent, root } = figure();
    const fx = createGadgetFx({ parent });
    const h = fx.freeze({ root, tall: 1.8, up: new V(0, 1, 0), push: new V(0, 0, 1) });
    run(fx, 1.55);
    expect(h.shards().length).toBeGreaterThan(20);
    run(fx, 0.5);
    const shards = h.shards();
    const spread = Math.max(...shards.map((s) => Math.hypot(s.x, s.z)));
    expect(spread).toBeGreaterThan(0.6);
    for (const s of shards) expect(s.y).toBeGreaterThanOrEqual(-1e-6);
    h.dispose();
  });
});

describe('the shrink ray', () => {
  it('takes them down to a tenth in half a second, squeaks, and pops', () => {
    const { parent, root } = figure();
    root.scale.setScalar(2);
    const fx = createGadgetFx({ parent });
    const heard = [];
    const h = fx.shrink({ root, tall: 1.8, up: new V(0, 1, 0), on: (e) => heard.push(e) });
    run(fx, 0.25);
    expect(root.scale.y).toBeLessThan(2);
    expect(root.scale.y).toBeGreaterThan(0.3);
    run(fx, 0.35);
    expect(root.scale.x).toBeCloseTo(0.2, 1);
    expect(heard).toContain('squeak');
    expect(root.visible).toBe(true);
    run(fx, 0.7);
    expect(heard).toEqual(['squeak', 'pop']);
    expect(root.visible).toBe(false);
    run(fx, 0.6);
    expect(h.done).toBe(true);
    h.dispose();
    expect(root.scale.x).toBe(2);
    expect(parent.children).toEqual([root]);
  });
});

describe('the Amban rifle and the particle beam', () => {
  it('flash light through them and take them away, the figure put back as it was after', () => {
    for (const ash of [false, true]) {
      const { parent, root, mats } = figure();
      const fx = createGadgetFx({ parent });
      const heard = [];
      const h = fx.light({ root, tall: 1.8, up: new V(0, 1, 0), ash, on: (e) => heard.push(e) });
      run(fx, 0.1);
      const lit = root.children[0].material;
      expect(lit).not.toBe(mats[0]);
      expect(lit.emissive.r + lit.emissive.g + lit.emissive.b, `ash ${ash}`).toBeGreaterThan(0.5);
      expect(root.visible).toBe(true);
      run(fx, 0.5);
      expect(heard).toEqual(['gone']);
      expect(root.visible).toBe(false);
      run(fx, 1.2);
      expect(h.done).toBe(true);
      h.dispose();
      expect(root.children[0].material).toBe(mats[0]);
      expect(root.visible).toBe(true);
      expect(parent.children).toEqual([root]);
    }
  });
});

describe('the repulsor gauntlet', () => {
  it('throws them back off their feet, lands them on their back the way they went, and they go', () => {
    const { parent, root } = figure();
    const fx = createGadgetFx({ parent });
    const heard = [];
    const h = fx.thrown({ root, tall: 1.8, up: new V(0, 1, 0), push: new V(1, 0, 0), seed: 1, on: (e) => heard.push(e) });
    run(fx, 0.4);
    expect(root.position.x).toBeGreaterThan(1);
    expect(root.position.y).toBeGreaterThan(0.3);
    run(fx, 0.8);
    expect(heard).toEqual(['land']);
    expect(root.position.y).toBeCloseTo(0, 5);
    // (lying down: the body's up turned to the way they were thrown)
    const head = new V(0, 1, 0).applyQuaternion(root.quaternion);
    expect(head.x).toBeGreaterThan(0.9);
    run(fx, 2);
    expect(h.done).toBe(true);
    expect(root.visible).toBe(false);
    h.dispose();
    expect(root.position.length()).toBe(0);
    expect(root.quaternion.w).toBeCloseTo(1);
    expect(root.visible).toBe(true);
  });
});
