// The sky's dome round the camera, whatever draws it: the mesh, the suns'
// ways, the frame's update and the cloudless copy the shiny things reflect.
// GLSL-free: the dome's look is handed in, sky.js's shader on the classic
// renderer and nodes/sky.js's node material on the node renderer.
//
//   skyDome(site, { material, uniforms, cloudless }) → { mesh, sunDirs, suns,
//     uniforms, update(camera, t, flash), envScene(), dispose() }
//   (cloudless(): the same material without its clouds, sharing the rest)

import * as THREE from 'three';

export const MAX_SUNS = 2;
export const MAX_BODIES = 3;

export const dirOf = (az, el) => new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));

export function skyDome(site, { material, uniforms, cloudless }) {
  const suns = (site.sky.suns ?? []).slice(0, MAX_SUNS);
  // (the uniform's own vectors: a sun moved, by a weather's fade or the
  // game's light, moves on the dome too)
  const sunDirs = suns.map((_, i) => uniforms.uSunDir.value[i]);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.name = 'sky';

  return {
    mesh,
    sunDirs,
    suns,
    // (the dome's own uniforms: the fog reads them, skyfog.js)
    uniforms,
    update(camera, t, flash = 0) {
      mesh.position.copy(camera.position);
      uniforms.uTime.value = t;
      uniforms.uFlash.value = flash;
    },
    // the sky alone (no clouds), for the shiny things to reflect
    envScene() {
      const scene = new THREE.Scene();
      const m = cloudless();
      const dome = new THREE.Mesh(mesh.geometry, m);
      scene.add(dome);
      return { scene, dispose: () => m.dispose() };
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
