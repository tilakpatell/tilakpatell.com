import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { CONTACT_SIZE, contactFor, createContactShadows } from './contact';

describe('contactFor', () => {
  it('on ultra and high only: the target’s size and how many figures', () => {
    expect(CONTACT_SIZE).toBe(2);
    expect(contactFor('ultra')).toEqual({ on: true, target: 256, count: 16, range: 30 });
    expect(contactFor('high')).toEqual({ on: true, target: 128, count: 8, range: 20 });
    expect(contactFor('mid').on).toBe(false);
    expect(contactFor('low').on).toBe(false);
  });
});

describe('createContactShadows', () => {
  const figure = (x, z) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.2), new THREE.MeshStandardNodeMaterial());
    m.position.set(x, 0.9, z);
    return m;
  };
  it('a 2 m plane under each tracked figure near the camera, at its feet; the far ones hidden', async () => {
    const scene = new THREE.Scene();
    const near = figure(1, -2);
    const far = figure(0, -60);
    scene.add(near, far);
    const contact = await createContactShadows(scene, { isWebGPURenderer: true }, { tier: 'high' });
    contact.track(near);
    contact.track(far);
    expect(contact.planes).toHaveLength(2);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 1.6, 0);
    contact.update(camera);
    const [a, b] = contact.planes;
    expect(a.visible).toBe(true);
    expect(a.position.x).toBeCloseTo(1);
    expect(a.position.z).toBeCloseTo(-2);
    expect(a.position.y).toBeCloseTo(0, 1);
    expect(a.geometry.parameters.width).toBe(CONTACT_SIZE);
    expect(b.visible).toBe(false);
    contact.untrack(near);
    expect(contact.planes).toHaveLength(1);
    contact.dispose();
    expect(scene.children.filter((o) => o.name === 'contact-shadow')).toHaveLength(0);
  });
  it('a pass that throws still gives the scene and the renderer back', async () => {
    const scene = new THREE.Scene();
    const env = new THREE.Texture();
    scene.environment = env;
    const f = figure(0, -2);
    scene.add(f);
    const target = { name: 'main' };
    let current = target;
    const renderer = {
      getRenderTarget: () => current,
      setRenderTarget: (t) => (current = t),
      getClearColor: (c) => c.set(0x123456),
      getClearAlpha: () => 1,
      setClearColor() {},
      clear() {},
      render() {
        throw new Error('lost');
      },
    };
    const contact = await createContactShadows(scene, renderer, { tier: 'ultra' });
    contact.track(f);
    const camera = new THREE.PerspectiveCamera();
    expect(() => contact.update(camera)).toThrow('lost');
    expect(scene.overrideMaterial).toBe(null);
    expect(scene.environment).toBe(env);
    expect(current).toBe(target);
    contact.dispose();
  });
  it('nothing on mid and low', async () => {
    const contact = await createContactShadows(new THREE.Scene(), {}, { tier: 'mid' });
    contact.track(figure(0, 0));
    expect(contact.planes).toHaveLength(0);
  });
});
