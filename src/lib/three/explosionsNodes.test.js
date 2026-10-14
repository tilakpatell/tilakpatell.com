import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import * as glsl from './explosions';
import * as nodes from './explosionsNodes';

// A mesh’s two shaders built in Node, as the node renderer would build them
// (WGSL; no device: the builder asks for features and is told none), so a
// twin that wouldn’t compile fails here and not on the first frame.
function build(mesh) {
  const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 };
  const r = new THREE.WebGPURenderer({ canvas });
  r.hasFeature = () => false;
  r.backend.renderer = r;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const b = new THREE.WGSLNodeBuilder(mesh, r);
  b.getUniformBufferLimit = () => 65536; // (a device’s least)
  Object.assign(b, { scene, camera, material: mesh.material, lightsNode: r.lighting.getNode(scene, camera) });
  b.context.material = mesh.material;
  b.build();
  return { vertex: b.vertexShader, fragment: b.fragmentShader };
}

const FLAGS = ['transparent', 'depthWrite', 'premultipliedAlpha', 'blending', 'toneMapped', 'side'];

describe('explosionsNodes, the twin of explosions', () => {
  it('plans a blast as explosions.js does, moment by moment', () => {
    for (const size of [0.05, 0.2, 1.5]) {
      for (const tint of [null, [0.2, 0.6, 1]]) {
        for (const t of [0, 0.1, 0.45, 0.9, 1.39, 1.4, 2]) expect(nodes.explosionPlan(size, tint, t)).toEqual(glsl.explosionPlan(size, tint, t));
      }
    }
  });

  it('pools the same meshes, by name, order and flags, each a node material', () => {
    const a = glsl.createExplosions({ parent: new THREE.Group(), pool: 4 });
    const n = nodes.createExplosions({ parent: new THREE.Group(), pool: 4 });
    expect(n.meshes.map((m) => m.name)).toEqual(a.meshes.map((m) => m.name));
    n.meshes.forEach((m, i) => {
      const o = a.meshes[i];
      expect(m.material.isNodeMaterial).toBe(true);
      for (const k of FLAGS) expect(m.material[k]).toBe(o.material[k]);
      for (const k of ['renderOrder', 'frustumCulled', 'visible']) expect(m[k]).toBe(o[k]);
      expect(m.isInstancedMesh ?? false).toBe(o.isInstancedMesh ?? false);
    });
  });

  it('keeps each blast’s uniforms under the GLSL names, the noise seeded as before', () => {
    const a = glsl.createExplosions({ pool: 3 });
    const n = nodes.createExplosions({ pool: 3 });
    a.meshes.slice(0, 3).forEach((o, i) => {
      const u = n.meshes[i].material.uniforms;
      expect(Object.keys(u).sort()).toEqual(Object.keys(o.material.uniforms).sort());
      for (const k of Object.keys(u)) expect(u[k].isNode).toBe(true);
      expect(u.uSeed.value.toArray()).toEqual(o.material.uniforms.uSeed.value.toArray());
    });
  });

  it('bursts and plays a blast as the original does: the same uniforms, shards and rings', () => {
    const a = glsl.createExplosions({ pool: 2 });
    const n = nodes.createExplosions({ pool: 2 });
    for (const e of [a, n]) {
      e.burst(new THREE.Vector3(1, 2, 3), 0.8, [1, 0.5, 0.2]);
      e.update(0.3);
    }
    const [ua, un] = [a.meshes[0].material.uniforms, n.meshes[0].material.uniforms];
    for (const k of ['uRadius', 'uAlpha', 'uAge']) expect(un[k].value).toBeCloseTo(ua[k].value, 9);
    expect(un.uColour.value.getHex()).toBe(ua.uColour.value.getHex());
    const [sa, sn] = [a.meshes.at(-2), n.meshes.at(-2)];
    expect(sn.count).toBe(sa.count);
    expect(Array.from(sn.instanceMatrix.array)).toEqual(Array.from(sa.instanceMatrix.array));
    const [ra, rn] = [a.meshes.at(-1), n.meshes.at(-1)];
    expect(rn.count).toBe(ra.count);
    expect(Array.from(rn.geometry.attributes.aAge.array)).toEqual(Array.from(ra.geometry.attributes.aAge.array));
    expect(n.active).toBe(a.active);
    n.setMode('pop');
    expect(n.active).toBe(0);
  });

  it('builds every one of its shaders', () => {
    const n = nodes.createExplosions({ parent: new THREE.Group(), pool: 2 });
    for (const m of n.meshes) {
      const { vertex, fragment } = build(m);
      expect(vertex).toMatch(/fn main/);
      expect(fragment).toMatch(/fn main/);
    }
    // (the fire discards outside its disc; the rings read their age per instance)
    expect(build(n.meshes[0]).fragment).toMatch(/discard/);
    expect(build(n.meshes.at(-1)).vertex).toMatch(/aAge/);
  });

  it('frees what it made', () => {
    const n = nodes.createExplosions({ parent: new THREE.Group(), pool: 2 });
    let freed = 0;
    for (const m of n.meshes) m.material.addEventListener('dispose', () => freed++);
    n.dispose();
    expect(freed).toBe(n.meshes.length);
  });
});
