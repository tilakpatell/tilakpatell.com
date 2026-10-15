import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import * as glsl from '../fx';
import * as nodes from './fx';

const flashMat = (scene) => scene.children.find((o) => o.isInstancedMesh).material;

describe('nodes/fx, the twin of fx', () => {
  it('exports what fx exports, the lasers’ colours the same', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).sort());
    expect(nodes.LASER).toEqual(glsl.LASER);
  });

  it('draws the bolts with a node material, the same flags, their instance colours made from the start', () => {
    const a = new THREE.Scene();
    const n = new THREE.Scene();
    const was = glsl.createBolts(a, { count: 12 });
    const b = nodes.createBolts(n, { count: 12 });
    expect(b.mesh.material.isNodeMaterial).toBe(true);
    for (const k of ['transparent', 'blending', 'depthWrite', 'depthTest', 'side', 'toneMapped']) expect(b.mesh.material[k]).toBe(was.mesh.material[k]);
    expect(b.mesh.instanceColor.count).toBe(12);
    const before = b.mesh.instanceColor;
    const hits = [];
    expect(b.fire(new THREE.Vector3(), new THREE.Vector3(0, 0, 40), { onHit: (p) => hits.push(p.z) })).toBe(true);
    expect(b.fire(new THREE.Vector3(), new THREE.Vector3())).toBe(false);
    b.update(0.1);
    expect(b.mesh.instanceColor).toBe(before);
    expect(b.mesh.count).toBe(1);
    expect(b.busy).toBe(true);
    b.update(1);
    expect(hits).toEqual([40]);
    expect(b.busy).toBe(false);
    was.dispose();
    b.dispose();
  });

  it('draws the flashes with a node material, the original’s uniforms by name and its flags', () => {
    const a = new THREE.Scene();
    const n = new THREE.Scene();
    const was = glsl.createFlashes(a, { count: 4, look: null });
    const f = nodes.createFlashes(n, { count: 4, look: null });
    const ma = flashMat(a);
    const mn = flashMat(n);
    expect(mn.isNodeMaterial).toBe(true);
    expect(Object.keys(mn.uniforms).sort()).toEqual(Object.keys(ma.uniforms).sort());
    for (const k of ['transparent', 'blending', 'depthWrite', 'depthTest', 'side']) expect(mn[k]).toBe(ma[k]);
    expect(f.busy).toBe(false);
    f.at(new THREE.Vector3(1, 2, 3), { size: 1.6, life: 0.8 });
    f.update(0.1);
    expect(f.busy).toBe(true);
    f.update(1);
    expect(f.busy).toBe(false);
    was.dispose();
    f.dispose();
  });

  it('takes the game’s burst and its black-body ramp when it has them, its own look when not', () => {
    const scene = new THREE.Scene();
    const f = nodes.createFlashes(scene, { count: 2, look: null });
    const u = flashMat(scene).uniforms;
    expect(u.uHasMap.value).toBe(0);
    expect(u.uHasRamp.value).toBe(0);
    expect(u.uMap.value).toBe(null);
    const burst = new THREE.Texture();
    burst.userData.look = { name: 'impact', grid: [1, 1], channels: { burst: 'r' } };
    const ramp = new THREE.Texture();
    ramp.userData.look = { rampV: 0.3 };
    f.setLook({ burst, ramp });
    expect(u.uHasMap.value).toBe(1);
    expect(u.uHasRamp.value).toBe(1);
    expect(u.uMap.value).toBe(burst);
    expect(u.uRamp.value).toBe(ramp);
    expect(u.uRampV.value).toBe(0.3);
    expect(u.uChan.value.toArray()).toEqual([1, 0, 0, 0]);
    f.setLook({});
    expect(u.uMap.value).toBe(null);
    expect(u.uHasMap.value).toBe(0);
    f.dispose();
  });
});
