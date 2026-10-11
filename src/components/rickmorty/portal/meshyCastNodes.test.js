import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './meshyCast';
import * as nodes from './meshyCastNodes';

// a Meshy model as it loads: a textured mesh, unrigged (a prop's)
const model = () => {
  const g = new THREE.Group();
  const map = new THREE.Texture();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ map })));
  return { scene: g, animations: [] };
};
const loader = { loadAsync: async () => model() };

describe('meshyCastNodes, the twin of meshyCast', () => {
  it('has every export meshyCast has, and the same tables', () => {
    for (const k of Object.keys(glsl)) expect(nodes[k], k).toBeDefined();
    expect(nodes.MESHY).toBe(glsl.MESHY);
    expect(nodes.RIGGED).toBe(glsl.RIGGED);
    expect(nodes.MESHY_ASSETS).toEqual(glsl.MESHY_ASSETS);
    expect(nodes.assetUrl('rick')).toBe(glsl.assetUrl('rick'));
  });

  it('paints a model in toon nodes on the same light steps, with the same rim', async () => {
    const paintOf = async (M) => {
      const cast = M.createMeshyCast({ kinds: { pickle: { a: 'pickle', h: 1.35 } }, rigged: new Set(), loader });
      await cast.load(null, ['pickle']);
      const f = cast.make('pickle');
      let mat = null;
      f.group.traverse((o) => o.isMesh && (mat = o.material));
      return { cast, f, mat };
    };
    const a = await paintOf(glsl);
    const n = await paintOf(nodes);
    expect(n.mat.isMeshToonNodeMaterial).toBe(true);
    expect(n.mat.gradientMap).toBe(a.mat.gradientMap);
    expect(n.mat.map).toBeTruthy();
    expect(Object.keys(n.mat.userData.rim).sort()).toEqual(Object.keys(a.mat.userData.rim).sort());
    expect(n.mat.userData.rim.rimColor.value.getHex()).toBe(a.mat.userData.rim.rimColor.value.getHex());
    expect(n.mat.userData.rim.rimStrength.value).toBe(a.mat.userData.rim.rimStrength.value);
    expect(n.mat.customProgramCacheKey()).toContain('rim');
    expect(n.f.height).toBe(a.f.height);
    a.cast.dispose();
    n.cast.dispose();
  });

  it('gives a Morty clone his shirt, its uniform where the GLSL kept it, on a program of its own', () => {
    const m = nodes.shirted(new THREE.Texture(), 0x7fc77a);
    expect(m.isMeshToonNodeMaterial).toBe(true);
    expect(m.userData.shirt.value.getHex()).toBe(0x7fc77a);
    expect(m.userData.rim).toBeDefined();
    const key = m.customProgramCacheKey();
    expect(key).toContain('shirted');
    expect(key).toContain('rim');
    expect(nodes.shirted(new THREE.Texture(), 0xe0795a).customProgramCacheKey()).not.toBe(key);
  });
});
