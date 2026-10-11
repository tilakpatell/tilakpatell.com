import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as glsl from './cruiser3d';
import * as nodes from './cruiser3dNodes';
import { rimToon as rimGlsl } from '../../lib/three/ink';
import { rimToon as rimNodes } from '../../lib/three/inkNodes';

// a saucer of one mesh, painted as the cast paints it (a toon with its rim)
const saucer = (rim) => {
  const body = new THREE.Group();
  body.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), rim(new THREE.MeshToonMaterial({ color: 0x99aabb }))));
  return body;
};

describe('cruiser3dNodes, the twin of cruiser3d', () => {
  it('has cruiser3d’s exports but its canvas, the same measurements', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'createCruiser3D').sort());
    for (const k of ['TALL', 'GLASS', 'CREW', 'CANS', 'crewLife']) expect(nodes[k]).toBe(glsl[k]);
  });

  it('makes the dome glass on a copy of each mesh’s material, its rim kept', () => {
    const a = saucer(rimGlsl);
    const n = saucer(rimNodes);
    const was = n.children[0].material;
    const ya = glsl.glassDome(a);
    const yn = nodes.glassDome(n);
    expect(yn).toBe(ya);
    const m = n.children[0].material;
    expect(m).not.toBe(was);
    expect(m.isMeshToonNodeMaterial).toBe(true);
    expect(m.transparent).toBe(a.children[0].material.transparent);
    expect(n.children[0].userData.glass).toBe(m);
    const key = m.customProgramCacheKey();
    expect(key).toContain('rim');
    expect(key).toContain(`glass-${yn}`);
  });
});
