import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { clearGLTFCache, cloneScene, gltfStats, loadGLTF } from './gltfCache';

// a parsed model: one textured mesh (and, for the skinned case, one with bones)
const model = () => {
  const map = new THREE.Texture();
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }));
  scene.add(mesh);
  return { scene, animations: [], mesh, map };
};

const skinned = () => {
  const bone = new THREE.Bone();
  const geometry = new THREE.BoxGeometry();
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count).fill([1, 0, 0, 0]).flat(), 4));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.add(bone);
  mesh.bind(new THREE.Skeleton([bone]));
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene, animations: [], mesh, bone };
};

beforeEach(() => clearGLTFCache());

describe('loadGLTF', () => {
  it('fetches and parses each url once', async () => {
    const gltf = model();
    const loader = { loadAsync: vi.fn(async () => gltf) };
    const [a, b] = await Promise.all([loadGLTF('/a.glb', { loader }), loadGLTF('/a.glb', { loader })]);
    const c = await loadGLTF('/a.glb', { loader });
    expect(loader.loadAsync).toHaveBeenCalledTimes(1);
    expect(loader.loadAsync).toHaveBeenCalledWith('/a.glb');
    expect(a).toBe(gltf);
    expect(b).toBe(gltf);
    expect(c).toBe(gltf);
    await loadGLTF('/b.glb', { loader });
    expect(loader.loadAsync).toHaveBeenCalledTimes(2);
    expect(gltfStats()).toEqual({ requests: 4, parses: 2 });
  });

  it('forgets a failure so the next call retries', async () => {
    const gltf = model();
    const loader = { loadAsync: vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(gltf) };
    expect(await loadGLTF('/a.glb', { loader })).toBeNull();
    expect(await loadGLTF('/a.glb', { loader })).toBe(gltf);
    expect(loader.loadAsync).toHaveBeenCalledTimes(2);
    expect(await loadGLTF('/a.glb', { loader })).toBe(gltf);
    expect(loader.loadAsync).toHaveBeenCalledTimes(2);
  });
});

describe('cloneScene', () => {
  it('clones with materials of its own and the textures and geometry shared', () => {
    const gltf = model();
    const clone = cloneScene(gltf);
    const mesh = clone.children[0];
    expect(clone).not.toBe(gltf.scene);
    expect(mesh).not.toBe(gltf.mesh);
    expect(mesh.material).not.toBe(gltf.mesh.material);
    expect(mesh.material.map).toBe(gltf.map);
    expect(mesh.geometry).toBe(gltf.mesh.geometry);
  });

  it('clones each material of a mesh that has several', () => {
    const gltf = model();
    const second = new THREE.MeshStandardMaterial({ color: 'red' });
    gltf.mesh.material = [gltf.mesh.material, second];
    const mesh = cloneScene(gltf).children[0];
    expect(mesh.material).toHaveLength(2);
    expect(mesh.material[0]).not.toBe(gltf.mesh.material[0]);
    expect(mesh.material[1]).not.toBe(second);
    expect(mesh.material[1].color.getHexString()).toBe(second.color.getHexString());
    expect(mesh.material[0].map).toBe(gltf.map);
  });

  it('meshes that shared a material share its clone, one new material for the lot', () => {
    const gltf = model();
    const shared = gltf.mesh.material;
    const other = new THREE.Mesh(new THREE.SphereGeometry(), shared);
    const lone = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshStandardMaterial({ color: 'blue' }));
    gltf.scene.add(other, lone);
    const [a, b, c] = cloneScene(gltf).children;
    expect(a.material).toBe(b.material);
    expect(a.material).not.toBe(shared);
    expect(a.material.map).toBe(gltf.map);
    expect(c.material).not.toBe(a.material);
    expect(c.material).not.toBe(lone.material);
    // (and each call makes its own, so a copy's disposal leaves the next alone)
    expect(cloneScene(gltf).children[0].material).not.toBe(a.material);
  });

  it('a mesh with several materials shares them with the meshes that use them singly', () => {
    const gltf = model();
    const first = gltf.mesh.material;
    const second = new THREE.MeshStandardMaterial({ color: 'red' });
    gltf.scene.add(new THREE.Mesh(new THREE.SphereGeometry(), [second, first]));
    const [a, b] = cloneScene(gltf).children;
    expect(b.material[1]).toBe(a.material);
    expect(b.material[0]).not.toBe(second);
  });

  it('a cached entry still clones after an earlier clone is disposed', () => {
    const gltf = model();
    const first = cloneScene(gltf);
    first.children[0].material.dispose();
    const again = cloneScene(gltf);
    expect(again.children[0].material).not.toBe(first.children[0].material);
    expect(again.children[0].material.map).toBe(gltf.map);
    expect(gltf.mesh.material.map).toBe(gltf.map);
  });

  it('gives a skinned model bones of its own', () => {
    const gltf = skinned();
    const clone = cloneScene(gltf);
    const mesh = clone.children[0];
    expect(mesh.isSkinnedMesh).toBe(true);
    expect(mesh.skeleton).not.toBe(gltf.mesh.skeleton);
    expect(mesh.skeleton.bones[0]).not.toBe(gltf.bone);
    expect(mesh.material).not.toBe(gltf.mesh.material);
    expect(mesh.geometry).toBe(gltf.mesh.geometry);
  });
});
