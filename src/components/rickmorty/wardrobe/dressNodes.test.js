import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MeshToonNodeMaterial } from 'three/webgpu';
import * as glsl from './dress';
import * as nodes from './dressNodes';
import { rimToon } from '../../../lib/three/inkNodes';

const names = (m) => Object.keys(m.userData.regions.uniforms).sort();

describe('dressNodes, the twin of dress', () => {
  it('has every export dress has, and the same keys', () => {
    for (const k of Object.keys(glsl)) expect(nodes[k], k).toBeDefined();
    expect(nodes.KEYS).toBe(glsl.KEYS);
  });

  it('teaches a node material a body’s regions, with the same uniforms', () => {
    for (const body of ['rick', 'jesse']) {
      const a = glsl.recolor(new THREE.MeshToonMaterial(), body, { inner: 'portalgreen' });
      const n = nodes.recolor(new MeshToonNodeMaterial(), body, { inner: 'portalgreen' });
      expect(n.isNodeMaterial).toBe(true);
      expect(names(n), body).toEqual(names(a));
      expect(n.userData.regions.uniforms.rgOn.value).toEqual(a.userData.regions.uniforms.rgOn.value);
    }
    // (Walt’s and Jesse’s read how much the hips and the head move a texel; Rick’s doesn’t)
    expect(names(nodes.recolor(new MeshToonNodeMaterial(), 'jesse'))).toContain('rgLower');
    expect(names(nodes.recolor(new MeshToonNodeMaterial(), 'rick'))).not.toContain('rgLower');
  });

  it('takes a classic material as its node twin', () => {
    expect(nodes.recolor(new THREE.MeshToonMaterial(), 'morty').isMeshToonNodeMaterial).toBe(true);
  });

  it('changes the colours through set(), on the nodes it draws with', () => {
    const n = nodes.recolor(new MeshToonNodeMaterial(), 'morty', {});
    const before = n.userData.regions.uniforms.rgOn.value.filter(Boolean).length;
    n.userData.regions.set({ inner: 'portalgreen' });
    const u = n.userData.regions.uniforms;
    expect(u.rgOn.value.filter(Boolean).length).toBe(before + 1);
    expect(u.rgOn.node.array).toBe(u.rgOn.value);
    expect(u.rgSwatch.node.array).toBe(u.rgSwatch.value);
  });

  it('keys each material’s program on its body', () => {
    const a = nodes.recolor(new MeshToonNodeMaterial(), 'rick');
    const b = nodes.recolor(new MeshToonNodeMaterial(), 'morty');
    expect(a.customProgramCacheKey()).toContain('regions-rick');
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });

  it('dresses a figure in its own copies, the rim of light kept', () => {
    const bone = new THREE.Bone();
    bone.name = 'Spine';
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4));
    const was = rimToon(new MeshToonNodeMaterial());
    const mesh = new THREE.SkinnedMesh(g, was);
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    const group = new THREE.Group();
    group.add(mesh);
    const made = nodes.dressColors({ group }, { body: 'morty', colors: { inner: 'portalgreen' } });
    expect(made).toEqual([mesh.material]);
    expect(mesh.material).not.toBe(was);
    expect(mesh.material.setupLighting).toBe(was.setupLighting);
    const key = mesh.material.customProgramCacheKey();
    expect(key).toContain('rim');
    expect(key).toContain('regions-morty');
    expect(g.attributes.zone).toBeDefined();
  });

  it('copies a material with its hooks and its marks', () => {
    const m = rimToon(new MeshToonNodeMaterial());
    const house = { uLook: { value: 1 } };
    Object.defineProperty(m.userData, 'house', { value: house, enumerable: false, configurable: true });
    const copy = nodes.cloneShaded(m);
    expect(copy.setupLighting).toBe(m.setupLighting);
    expect(copy.customProgramCacheKey()).toBe(m.customProgramCacheKey());
    expect(copy.userData.house).toBe(house);
    expect(Object.keys(copy.userData)).not.toContain('house');
  });
});
