import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { inkHull, rimToon, smoothNormals } from './ink';

const at = (g, i) => new THREE.Vector3().fromBufferAttribute(g.attributes.position, i);
const ink = (g, i) => new THREE.Vector3().fromBufferAttribute(g.attributes.inkNormal, i);

describe('smoothNormals', () => {
  it('gives every copy of a split corner one normal, pointing out of the corner', () => {
    const g = smoothNormals(new THREE.BoxGeometry(1, 1, 1));
    expect(g.attributes.position.count).toBe(24); // (split: three copies of each corner)
    for (let i = 0; i < g.attributes.position.count; i++) {
      const p = at(g, i);
      const n = ink(g, i);
      const want = new THREE.Vector3(Math.sign(p.x), Math.sign(p.y), Math.sign(p.z)).normalize();
      expect(n.distanceTo(want)).toBeLessThan(1e-5);
    }
  });

  it('writes unit normals on a geometry with no index and no normals', () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
    smoothNormals(g);
    for (let i = 0; i < 6; i++) expect(ink(g, i).length()).toBeCloseTo(1, 5);
  });

  it('does the work once per geometry', () => {
    const g = smoothNormals(new THREE.BoxGeometry(1, 1, 1));
    const was = g.attributes.inkNormal;
    smoothNormals(g);
    expect(g.attributes.inkNormal).toBe(was);
  });
});

describe('inkHull', () => {
  it('puts an ink mesh beside each mesh, sharing its geometry, with smoothed normals', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    root.add(mesh);
    const mat = inkHull(root, 0.02);
    const inks = root.children.filter((o) => o.userData.ink);
    expect(inks).toHaveLength(1);
    expect(inks[0].geometry).toBe(mesh.geometry);
    expect(inks[0].material).toBe(mat);
    expect(mesh.geometry.attributes.inkNormal).toBeDefined();
    expect(mat.side).toBe(THREE.BackSide);
  });

  it('pushes a skinned mesh’s line out, not in: the back side’s flipped normal turned back', () => {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
    const mat = inkHull(root, 0.02);
    const shader = { vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader, uniforms: {} };
    mat.onBeforeCompile(shader);
    // (three negates transformedNormal under FLIP_SIDED, which a BackSide
    // material defines: a skinned line pushed along it would sink into the
    // figure, out of sight)
    expect(THREE.ShaderChunk.defaultnormal_vertex).toMatch(/#ifdef FLIP_SIDED\s*transformedNormal = - transformedNormal;/);
    const skinned = shader.vertexShader.slice(shader.vertexShader.indexOf('#ifdef USE_SKINNING', shader.vertexShader.indexOf('#include <project_vertex>')));
    const branch = skinned.slice(0, skinned.indexOf('#else'));
    expect(branch).toMatch(/transformedNormal/);
    expect(branch).toMatch(/#ifdef FLIP_SIDED\s*inkN = -inkN;\s*#endif/);
  });
});

describe('rimToon', () => {
  it('keys its program on the rim, so it never shares one with a plain toon material', () => {
    const m = rimToon(new THREE.MeshToonMaterial());
    expect(m).toBeInstanceOf(THREE.MeshToonMaterial);
    expect(m.customProgramCacheKey()).toContain('rim');
  });
});
