import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from './bolts';
import * as nodes from './boltsNodes';

const KEYS = ['transparent', 'depthWrite', 'blending', 'toneMapped', 'fog', 'side'];
const sheet = (look) => {
  const t = new THREE.DataTexture(new Uint8Array(16).fill(255), 2, 2);
  t.userData.look = look;
  return t;
};

describe('boltsNodes, the twin of bolts', () => {
  it('the flashes: a node material, the same flags and uniforms', () => {
    const a = glsl.createBoltMeshes(new THREE.Scene(), { look: null });
    const b = nodes.createBoltMeshes(new THREE.Scene(), { look: null });
    const [ma, mb] = [a.flashes.material, b.flashes.material];
    expect(mb.isNodeMaterial).toBe(true);
    for (const k of KEYS) expect(mb[k]).toBe(ma[k]);
    expect(Object.keys(mb.uniforms).sort()).toEqual(Object.keys(ma.uniforms).sort());
    expect(mb.uniforms.uMap.value).toBe(null);
    a.dispose();
    b.dispose();
  });

  it('setLook writes the same, a picture or none', () => {
    const a = glsl.createBoltMeshes(new THREE.Scene(), { look: null });
    const b = nodes.createBoltMeshes(new THREE.Scene(), { look: null });
    const burst = sheet({ channels: { burst: 'b' } });
    const ramp = sheet({ rampV: 0.3 });
    for (const d of [a, b]) d.setLook({ burst, ramp });
    const [ua, ub] = [a.flashes.material.uniforms, b.flashes.material.uniforms];
    for (const k of ['uHasMap', 'uHasRamp', 'uRampV']) expect(ub[k].value).toBe(ua[k].value);
    expect(ub.uChan.value.toArray()).toEqual(ua.uChan.value.toArray());
    expect(ub.uMap.value).toBe(burst);
    expect(ub.uMap.node.value).toBe(burst);
    b.setLook({});
    expect(ub.uMap.value).toBe(null);
    expect(ub.uMap.node.value).not.toBe(null);
    expect(ub.uHasMap.value).toBe(0);
  });

  it('the same streaks and flashes', () => {
    const a = glsl.createBoltMeshes(new THREE.Scene(), { look: null });
    const b = nodes.createBoltMeshes(new THREE.Scene(), { look: null });
    for (const d of [a, b]) {
      d.sync([{ pos: [1, 1, 0], dir: [1, 0, 0], flown: 0.5, colour: '#4aa8ff' }]);
      d.flash([0, 1, 0]);
      d.update(0.05);
    }
    expect(b.mesh.count).toBe(a.mesh.count);
    expect(b.flashes.count).toBe(1);
    expect(b.flashes.geometry.attributes.aFlash.getY(0)).toBeCloseTo(a.flashes.geometry.attributes.aFlash.getY(0));
  });
});
