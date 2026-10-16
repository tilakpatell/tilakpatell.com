import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './trail';
import * as nodes from './trailNodes';

const FLAGS = ['transparent', 'blending', 'side', 'depthWrite', 'depthTest', 'forceSinglePass'];
const flags = (m) => Object.fromEntries(FLAGS.map((k) => [k, m[k]]));

// a trail flown a few frames, the same way on both sides
const fly = (T, opts) => {
  const trail = T.createTrail(opts);
  trail.setColors('#ff6a36', '#fff0dc');
  const nozzle = new THREE.Vector3();
  const camera = new THREE.Vector3(0, 0.6, 2.4);
  for (let i = 1; i <= 30; i++) {
    nozzle.z -= 0.1;
    camera.z -= 0.1;
    trail.update(1 / 60, i / 60, nozzle, 1, camera, 1.5);
  }
  return trail;
};

describe('trailNodes, the twin of trail', () => {
  it('exports what trail exports', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
  });

  it('the plume: a node material, the same uniforms by name and value, the same flags and geometry', () => {
    const a = fly(glsl, { wobble: 0.5, sparks: 0 });
    const n = fly(nodes, { wobble: 0.5, sparks: 0 });
    const [pa] = a.mesh.children;
    const [pn] = n.mesh.children;
    expect(pn.material.isNodeMaterial).toBe(true);
    expect(flags(pn.material)).toEqual(flags(pa.material));
    expect(Object.keys(pn.material.uniforms).sort()).toEqual(Object.keys(pa.material.uniforms).sort());
    for (const k of ['uColor', 'uCore', 'uCam', 'uTime', 'uWobble']) {
      const v = pa.material.uniforms[k].value;
      expect(pn.material.uniforms[k].value?.toArray?.() ?? pn.material.uniforms[k].value).toEqual(v?.toArray?.() ?? v);
    }
    for (const k of ['aFade', 'aAlong', 'aSide']) expect(pn.geometry.attributes[k].array).toEqual(pa.geometry.attributes[k].array);
    expect(pn.visible).toBe(pa.visible);
    n.clear();
    expect(pn.visible).toBe(false);
    n.dispose();
  });

  it('the sparks: a node material, the same uniforms and flags, as many as asked', () => {
    const a = fly(glsl, { wobble: 1, sparks: 24 });
    const n = fly(nodes, { wobble: 1, sparks: 24 });
    const sa = a.mesh.children[1];
    const sn = n.mesh.children[1];
    expect(sn.material.isNodeMaterial).toBe(true);
    expect(flags(sn.material)).toEqual(flags(sa.material));
    expect(Object.keys(sn.material.uniforms).sort()).toEqual(Object.keys(sa.material.uniforms).sort());
    expect(sn.count).toBe(24);
    expect(sn.frustumCulled).toBe(false);
  });
});
