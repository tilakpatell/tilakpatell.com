import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { vec3 } from 'three/tsl';
import { finalGrade, finalUniforms } from './final';

// FINAL's fragment program as WebGL 2 builds it, in Node (no device)
function fragmentOf() {
  const { u, tNoise } = finalUniforms();
  const material = new THREE.MeshBasicNodeMaterial();
  material.colorNode = finalGrade(u, () => vec3(0.5), { tNoise });
  const canvas = { style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 };
  const renderer = new THREE.WebGPURenderer({ canvas, forceWebGL: true });
  const b = new THREE.GLSLNodeBuilder(new THREE.Mesh(new THREE.PlaneGeometry(), material), renderer);
  b.scene = new THREE.Scene();
  b.camera = new THREE.PerspectiveCamera();
  b.material = material;
  b.context.material = material;
  const warn = console.warn;
  console.warn = () => {};
  try {
    b.build();
  } finally {
    console.warn = warn;
  }
  return b.fragmentShader;
}

describe('FINAL under the record’s linear tone map', () => {
  // (the game's own order, its tonemap composite: the exposed picture
  // clamped, gamma-2.2 encoded, the LUT read with that, its answer shown as
  // it is; lib/three/light/passes.js's `graded`. Read with the linear value,
  // Hoth's LUT, black under 0.13, sent the shadows and mid-tones to black)
  it('encodes the clamped picture at gamma 2.2 before it reads the LUT', () => {
    expect(fragmentOf()).toMatch(/pow\([^;]*0\.4545/);
  });
});
