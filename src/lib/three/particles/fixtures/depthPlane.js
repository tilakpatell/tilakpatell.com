// A camera 10 m up looking down at a floor at y = 0, in WebGPU's depth
// range (0 near, 1 far; 1 is nothing drawn), and the floor's depth buffer
// computed exactly from it: the synthetic plane collide.js's twin and
// gpu.js's paths are held to.
//
//   depthPlane({ floor = true, size = 64 }) → collide.js's options
//     ({ viewProj, invViewProj, camera, depthAt, texel }) and `depth` (the buffer)

import * as THREE from 'three';
import { depthSampler } from '../collide.js';

export function depthPlane({ floor = true, size = 64 } = {}) {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.coordinateSystem = THREE.WebGPUCoordinateSystem;
  cam.position.set(0, 10, 0.001);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  const inv = vp.clone().invert();
  const depth = new Float32Array(size * size).fill(1);
  if (floor) {
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const nx = ((x + 0.5) / size) * 2 - 1;
        const ny = (0.5 - (y + 0.5) / size) * 2;
        a.set(nx, ny, 0).applyMatrix4(inv);
        b.set(nx, ny, 1).applyMatrix4(inv);
        const t = a.y / (a.y - b.y);
        if (!(t > 0 && t < 1)) continue;
        depth[y * size + x] = a.clone().lerp(b, t).applyMatrix4(vp).z;
      }
  }
  return { viewProj: vp.elements, invViewProj: inv.elements, camera: cam.position.toArray(), depthAt: depthSampler(depth, size, size), texel: [1 / size, 1 / size], depth };
}
