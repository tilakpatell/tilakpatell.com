import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import * as GPU from 'three/webgpu';
import * as glsl from './recolour';
import * as nodes from './recolourNodes';

describe('recolourNodes, the twin of recolour', () => {
  it('exports what recolour exports, but the GLSL string; the same mean', () => {
    expect(Object.keys(nodes).sort()).toEqual(Object.keys(glsl).filter((k) => k !== 'recolourShader').sort());
    expect(nodes.REF).toBe(glsl.REF);
    const img = { width: 2, height: 1, data: Uint8Array.from([200, 30, 30, 255, 30, 200, 30, 10]) };
    expect(nodes.meanLuma(img)).toBe(glsl.meanLuma(img));
  });

  it('recolours once: a node material, its colour set, the same uniforms', () => {
    const a = glsl.recolour(new THREE.MeshLambertMaterial({ map: new THREE.Texture() }), '#3a8a30', { ref: 0.3 });
    const n = nodes.recolour(new THREE.MeshLambertMaterial({ map: new THREE.Texture() }), '#3a8a30', { ref: 0.3 });
    expect(n.isNodeMaterial).toBe(true);
    expect(n.color.getHex()).toBe(a.color.getHex());
    expect(Object.keys(n.userData.recolour).sort()).toEqual(Object.keys(a.userData.recolour).sort());
    expect(n.userData.recolour.uRecolour.value.getHex()).toBe(0x3a8a30);
    expect(n.userData.recolour.uRecolourRef.value).toBe(0.3);
    expect(nodes.recolour(n, '#ffffff')).toBe(n);
    expect(n.customProgramCacheKey()).toContain('|recolour');
  });

  it('keeps the map’s alpha, so a leaf’s cut-out is still cut', () => {
    // (built to WGSL as three's own builder would, no device in Node)
    const r = new GPU.WebGPURenderer({ canvas: { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 } });
    r.hasFeature = () => false;
    r.backend.renderer = r;
    const m = nodes.recolour(new GPU.MeshLambertNodeMaterial({ map: new THREE.Texture(), alphaTest: 0.5 }), '#3a8a30');
    const b = new GPU.WGSLNodeBuilder(new THREE.Mesh(new THREE.PlaneGeometry(), m), r);
    b.material = m;
    b.camera = new THREE.PerspectiveCamera();
    b.scene = new THREE.Scene();
    b.lightsNode = r.lighting.getNode(b.scene, b.camera);
    b.build();
    const fs = b.fragmentShader;
    const texel = fs.match(/(\w+) = textureSample\(/)[1];
    const diffuse = fs.match(/DiffuseColor = vec4<f32>\((.*)\);/)[1];
    expect(diffuse).toContain('clamp(');
    expect(diffuse.trim().endsWith(`${texel}.w )`) || diffuse.trim().endsWith(`${texel}.w`)).toBe(true);
    expect(fs).toContain('discard;');
  });
});
