import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './toon';
import * as nodes from './toonNodes';

describe('toonNodes, the twin of toon', () => {
  it('has the paint’s exports, all but the ink pass (an EffectComposer pass)', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'InkPass').sort());
  });

  it('makes a toon node material on the same light steps, its extras taken', () => {
    const a = glsl.toon(0x336699, { transparent: true, opacity: 0.5 });
    const n = nodes.toon(0x336699, { transparent: true, opacity: 0.5 });
    expect(n.isMeshToonNodeMaterial).toBe(true);
    expect(n.gradientMap).toBe(a.gradientMap);
    expect(n.gradientMap).toBe(nodes.gradient());
    expect(n.color.getHex()).toBe(a.color.getHex());
    expect(n).toMatchObject({ transparent: true, opacity: 0.5 });
  });

  it('turns a model toon as toon.js does: tinted, its glass glowing', () => {
    const model = () => {
      const g = new THREE.Group();
      const glass = new THREE.MeshStandardMaterial({ color: 0x8899aa, name: 'window' });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(), glass), new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x44aa22 })));
      return g;
    };
    const a = glsl.toonify(model(), { tint: 0xff0000, glow: 0xffee88 });
    const n = nodes.toonify(model(), { tint: 0xff0000, glow: 0xffee88 });
    n.children.forEach((o, i) => {
      const was = a.children[i].material;
      expect(o.material.isMeshToonNodeMaterial).toBe(true);
      expect(o.material.color.getHex()).toBe(was.color.getHex());
      expect(o.material.emissive.getHex()).toBe(was.emissive.getHex());
      expect(o.material.emissiveIntensity).toBe(was.emissiveIntensity);
      expect(o).toMatchObject({ castShadow: true, receiveShadow: true });
    });
  });

  it('greens a leaf the same', () => {
    expect(nodes.releaf(new THREE.Color(0x55cc88), 0xaa3300).getHex()).toBe(glsl.releaf(new THREE.Color(0x55cc88), 0xaa3300).getHex());
  });
});
