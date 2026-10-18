// The nebula behind the stars, worked out once. space.js's sky draws it as
// noise on the view's direction, on every pixel of the screen every frame:
// five fractal sums of five octaves each, the costliest thing the cockpit
// draws, for a sky that never changes but for how bright it is. Here each
// nebula is drawn once into a cube (six looks out from its middle), and the
// dome shows the cube instead, looked up along the view: the same picture,
// for one texture read a pixel.
//
// space.js is a GLSL original with a twin (spaceNodes.js) and isn't edited
// (lane T's rule), so a dome is told by its uniforms, as rv.js already
// reaches its own. Its `uFade` (the jump and the night dim it) still says how
// bright it is: `update()` passes it on each frame.
//
// isNebula(object) → whether it's a sky's nebula dome
// bakeSkies(renderer, scene, { size }) → { count, update(), dispose() } | null

import * as THREE from 'three';

const LAYER = 31; // (the six looks see the dome alone)

export const isNebula = (o) => Boolean(o?.isMesh && o.material?.isShaderMaterial && o.material.uniforms?.uBand && o.material.uniforms.uDeep && o.material.uniforms.uFade);

export function bakeSkies(renderer, scene, { size = 512 } = {}) {
  const domes = [];
  scene.traverse((o) => isNebula(o) && domes.push(o));
  if (!domes.length) return null;
  const made = [];
  const was = { target: renderer.getRenderTarget(), autoClear: renderer.autoClear };
  renderer.autoClear = true;
  try {
    scene.updateMatrixWorld(true);
    for (const dome of domes) {
      const src = dome.material;
      const fade = src.uniforms.uFade.value;
      src.uniforms.uFade.value = 1;
      // (8 bits a channel in the screen's own curve: a dark sky's steps as
      // fine as the screen's, at half a float target's memory)
      const target = new THREE.WebGLCubeRenderTarget(size, { colorSpace: THREE.SRGBColorSpace, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
      if (!dome.geometry.boundingSphere) dome.geometry.computeBoundingSphere();
      const reach = dome.geometry.boundingSphere.radius * dome.getWorldScale(new THREE.Vector3()).x;
      const eye = new THREE.CubeCamera(reach * 0.01, reach * 2, target);
      eye.position.setFromMatrixPosition(dome.matrixWorld);
      for (const c of eye.children) c.layers.set(LAYER);
      eye.updateMatrixWorld(true);
      const shown = dome.visible;
      dome.visible = true;
      dome.layers.enable(LAYER);
      try {
        eye.update(renderer, scene);
      } finally {
        dome.layers.disable(LAYER);
        dome.visible = shown;
        src.uniforms.uFade.value = fade;
      }
      // looked up along the view: refracted through glass that bends
      // nothing (a ratio of 1), from a camera at the dome's middle
      target.texture.mapping = THREE.CubeRefractionMapping;
      const mat = new THREE.MeshBasicMaterial({
        envMap: target.texture,
        refractionRatio: 1,
        toneMapped: false,
        fog: false,
        side: src.side,
        transparent: src.transparent,
        blending: src.blending,
        depthWrite: src.depthWrite,
        depthTest: src.depthTest,
      });
      mat.name = 'BakedNebula';
      mat.color.setScalar(fade);
      dome.material = mat;
      made.push({ dome, src, mat, target });
    }
  } finally {
    renderer.setRenderTarget(was.target);
    renderer.autoClear = was.autoClear;
  }
  return {
    count: made.length,
    update() {
      for (const m of made) m.mat.color.setScalar(m.src.uniforms.uFade.value);
    },
    // (the dome given its own material back, so the vehicle's dispose frees it)
    dispose() {
      for (const m of made) {
        if (m.dome.material === m.mat) m.dome.material = m.src;
        m.mat.dispose();
        m.target.dispose();
      }
      made.length = 0;
    },
  };
}
