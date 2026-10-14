import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import * as glsl from './dye';
import * as nodes from './dyeNodes';

// A mesh’s two shaders built in Node, as the node renderer would build them
// (WGSL; no device), so a dye that wouldn’t compile fails here.
function build(mesh) {
  const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 };
  const r = new THREE.WebGPURenderer({ canvas });
  r.hasFeature = () => false;
  r.backend.renderer = r;
  const scene = new THREE.Scene();
  scene.add(mesh, new THREE.HemisphereLight());
  const camera = new THREE.PerspectiveCamera();
  const b = new THREE.WGSLNodeBuilder(mesh, r);
  b.getUniformBufferLimit = () => 65536; // (a device’s least)
  Object.assign(b, { scene, camera, material: mesh.material, lightsNode: r.lighting.getNode(scene, camera) });
  b.context.material = mesh.material;
  b.build();
  return { vertex: b.vertexShader, fragment: b.fragmentShader };
}

const map = () => new THREE.DataTexture(new Uint8Array([200, 120, 60, 255]), 1, 1);

describe('dyeNodes, the twin of dye', () => {
  it('copies the material into its node twin, leaving the original as it was', () => {
    const own = new THREE.MeshStandardMaterial({ color: 0x8a6a40, map: map(), roughness: 0.3, metalness: 0.5, name: 'uniform' });
    const a = glsl.dyed(own, { color: 0x222428, roughness: 0.85, metalness: 0 });
    const n = nodes.dyed(own, { color: 0x222428, roughness: 0.85, metalness: 0 });
    expect(n.isMeshStandardNodeMaterial).toBe(true);
    expect(n).not.toBe(own);
    expect(own.color.getHex()).toBe(0x8a6a40);
    expect(own.isNodeMaterial).toBeFalsy();
    // (a textured one’s colour goes white under the dye, as dye.js has it)
    for (const k of ['name', 'roughness', 'metalness', 'map']) expect(n[k]).toBe(a[k]);
    expect(n.color.getHex()).toBe(a.color.getHex());
  });

  it('keeps a plain material’s own colour as the luminance it dyes', () => {
    const own = new THREE.MeshStandardMaterial({ color: 0x556b2f });
    expect(nodes.dyed(own, { color: 0x111111 }).color.getHex()).toBe(glsl.dyed(own, { color: 0x111111 }).color.getHex());
  });

  it('holds the dye in uniforms under the GLSL names, at the values asked for', () => {
    const n = nodes.dyed(new THREE.MeshStandardMaterial(), { color: 0x7a1010, gain: 2.4, keep: 0.2, skin: false });
    const u = n.userData.dye;
    expect(Object.keys(u).sort()).toEqual(['uDye', 'uDyeGain', 'uDyeKeep', 'uDyeSkin']);
    expect(u.uDye.value.getHex()).toBe(0x7a1010);
    expect([u.uDyeGain.value, u.uDyeKeep.value, u.uDyeSkin.value]).toEqual([2.4, 0.2, 0]);
    expect(n.colorNode?.isNode).toBe(true);
  });

  it('gives every dyed copy uniforms of its own, so two dyes never share a program’s values', () => {
    const own = new THREE.MeshStandardMaterial();
    const a = nodes.dyed(own, { color: 0x111111 });
    const b = nodes.dyed(own, { color: 0x993333 });
    expect(a.userData.dye.uDye).not.toBe(b.userData.dye.uDye);
    expect(a.colorNode).not.toBe(b.colorNode);
  });

  it('builds, and dyes a node material too', () => {
    const lit = nodes.dyed(new THREE.MeshStandardMaterial({ map: map() }), { color: 0x333333 });
    expect(build(new THREE.Mesh(new THREE.BoxGeometry(), lit)).fragment).toMatch(/fn main/);
    const twice = nodes.dyed(new THREE.MeshStandardNodeMaterial({ color: 0xaa8866 }), { color: 0x224466, keep: 0.5 });
    expect(twice.isMeshStandardNodeMaterial).toBe(true);
    expect(build(new THREE.Mesh(new THREE.BoxGeometry(), twice)).fragment).toMatch(/fn main/);
  });
});
