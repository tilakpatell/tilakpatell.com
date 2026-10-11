import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './livery';
import * as nodes from './liveryNodes';

const FIT = { mid: 0.4, marks: [0.5, 0.7], keep: 0.04 };
// the uniforms livery.js hands three, by name
const glslNames = () => {
  const m = new THREE.MeshStandardMaterial();
  glsl.createLivery().apply(new THREE.Mesh(new THREE.BoxGeometry(), m), FIT);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  m.onBeforeCompile(shader);
  return Object.keys(shader.uniforms).sort();
};

describe('liveryNodes, the twin of livery', () => {
  it('a lit material comes back as its node twin, painted, with the same uniforms', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: '#888888' }));
    nodes.createLivery().apply(mesh, FIT);
    const m = mesh.material;
    expect(m.isMeshStandardNodeMaterial).toBe(true);
    expect(m.color.getHex()).toBe(0x888888);
    expect(m.userData.painted).toBe(true);
    expect(m.customProgramCacheKey()).toContain('paint');
    expect(Object.keys(m.userData.paint).sort()).toEqual(glslNames());
    for (const n of Object.values(m.userData.paint)) expect(n.isNode).toBe(true);
  });

  it('a material shared by two meshes stays one twin; a clone is its own, freed with the livery', () => {
    const shared = new THREE.MeshLambertMaterial();
    const root = new THREE.Group();
    const a = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const b = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    root.add(a, b);
    const livery = nodes.createLivery();
    livery.apply(root, FIT);
    expect(a.material).toBe(b.material);
    expect(a.material.isNodeMaterial).toBe(true);
    // (applied again, as mount does after dress: nothing changes)
    livery.apply(root, FIT);
    expect(a.material).toBe(b.material);
    const c = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const own = c.material;
    livery.apply(c, FIT, { clone: true });
    expect(c.material).not.toBe(own);
    expect(own.userData.painted).toBeUndefined();
  });

  it('the paint and the rim write the uniforms every material reads', () => {
    const one = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const two = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshToonMaterial());
    const livery = nodes.createLivery();
    livery.apply(one, FIT);
    livery.apply(two, { ...FIT, mid: 0.3 });
    const [p, q] = [one.material.userData.paint, two.material.userData.paint];
    // (one node a shared uniform: the two share their programs)
    expect(p.paintHull).toBe(q.paintHull);
    expect(p.paintFit).not.toBe(q.paintFit);
    livery.set({ hull: '#336699', trim: '#ffcc00' });
    livery.rim({ colour: [0.2, 0.3, 0.9], dir: [0, 0, 1] });
    // (a node follows its { value } each render: updated as three would)
    const read = (n) => (n.update({}), n.value);
    expect(read(p.paintOn)).toBe(1);
    expect(read(q.paintHull).getHex()).toBe(new THREE.Color('#336699').getHex());
    expect(read(p.uRimDir).toArray()).toEqual([0, 0, 1]);
    expect(read(q.paintFit).x).toBe(0.3);
    livery.set(null);
    expect(read(q.paintOn)).toBe(0);
  });

  it('unlit, noPaint and ink are left alone, as the GLSL leaves them', () => {
    const basic = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const crew = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    crew.userData.noPaint = true;
    const root = new THREE.Group();
    root.add(basic, crew);
    const before = [basic.material, crew.material];
    nodes.createLivery().apply(root, FIT);
    expect([basic.material, crew.material]).toEqual(before);
  });

  it('the same complement', () => {
    expect(nodes.complement([1, 0.6, 0.3])).toEqual(glsl.complement([1, 0.6, 0.3]));
  });
});
