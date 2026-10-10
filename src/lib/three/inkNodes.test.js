import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './ink';
import * as nodes from './inkNodes';

const cast = () => {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), new THREE.MeshToonMaterial()));
  const s = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshToonMaterial());
  s.position.set(2, 0, 0);
  g.add(s);
  return g;
};

describe('inkNodes, the twin of ink', () => {
  it('the same smoothed normals', () => {
    const a = glsl.smoothNormals(new THREE.BoxGeometry(1, 2, 1, 2, 2, 2));
    const n = nodes.smoothNormals(new THREE.BoxGeometry(1, 2, 1, 2, 2, 2));
    expect(Array.from(n.attributes.inkNormal.array)).toEqual(Array.from(a.attributes.inkNormal.array));
  });

  it('the same hull: one ink mesh a mesh, back faces, flagged and placed as the GLSL’s', () => {
    const a = cast();
    const n = cast();
    const ma = glsl.inkHull(a, 0.05, { clipY: 0.4 });
    const mn = nodes.inkHull(n, 0.05, { clipY: 0.4 });
    expect(mn.isNodeMaterial).toBe(true);
    expect(mn.side).toBe(ma.side);
    expect(mn.color.getHex()).toBe(ma.color.getHex());
    const inks = (g) => g.children.filter((o) => o.userData.ink);
    expect(inks(n).length).toBe(inks(a).length);
    inks(n).forEach((o, i) => {
      expect(o.position.toArray()).toEqual(inks(a)[i].position.toArray());
      expect(o).toMatchObject({ frustumCulled: false, castShadow: false });
      expect(o.userData.noPaint).toBe(true);
    });
    expect(mn.customProgramCacheKey()).toContain('ink-0.0500-0.4');
  });

  it('a rim of light, the same uniforms', () => {
    const a = glsl.rimToon(new THREE.MeshToonMaterial(), { color: 0xffeecc, power: 2, strength: 0.5 });
    const n = nodes.rimToon(new THREE.MeshToonMaterial(), { color: 0xffeecc, power: 2, strength: 0.5 });
    expect(n.isMeshToonNodeMaterial).toBe(true);
    expect(Object.keys(n.userData.rim).sort()).toEqual(Object.keys(a.userData.rim).sort());
    expect(n.userData.rim.rimColor.value.getHex()).toBe(0xffeecc);
    expect(n.userData.rim.rimPower.value).toBe(2);
    expect(n.userData.rim.rimStrength.value).toBe(0.5);
  });
});
