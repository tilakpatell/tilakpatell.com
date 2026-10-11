// bolts.js on the node renderer: the same streaks and flashes
// (./boltsCore.js), the flashes drawn by a MeshBasicNodeMaterial with the
// same flags and uniform names, line for line with bolts.js's GLSL. Its
// uniforms are on `material.uniforms` too, so setLook's `u.uMap.value =
// burst` writes them as before; a picture the GLSL left null (no burst, no
// ramp yet) is one black texel here, never shown: uHasMap and uHasRamp say
// so, and both are read before one is chosen.
//
// createBoltMeshes(parent, { pool, flashes, look }) → bolts.js's

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, dot, float, length, modelViewMatrix, positionGeometry, select, smoothstep, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl';
import { instanceMatrixOf, wrap } from '../hookNodes';
import { CHAN, createBoltMeshesWith } from './boltsCore';

const NONE = (() => {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
})();

// a texture node that takes a picture or null as the GLSL's sampler did
const picture = () => {
  const node = texture(NONE);
  let held = null;
  return {
    node,
    get value() {
      return held;
    },
    set value(t) {
      held = t ?? null;
      node.value = t ?? NONE;
    },
  };
};

function flashMaterial() {
  const map = picture();
  const ramp = picture();
  const u = { uMap: map, uRamp: ramp, uHasMap: uniform(0), uHasRamp: uniform(0), uRampV: uniform(0.5), uChan: uniform(new THREE.Vector4(...CHAN.g)) };
  const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  const flash = attribute('aFlash', 'vec2'); // age 0…1, size
  // a quad facing the camera about its instance's centre
  wrap(
    mat,
    'setupPositionView',
    (pv, builder) => {
      const im = instanceMatrixOf(builder);
      if (!im) return pv;
      return modelViewMatrix.mul(im.mul(vec4(0, 0, 0, 1))).xyz.add(vec3(positionGeometry.xy.mul(flash.y), 0));
    },
    'bolts:flash',
  );
  const vUv = uv();
  const k = flash.x.oneMinus();
  const r = length(vUv.mul(2).sub(1));
  // the game's rays, or a soft disc (the sphere it was, seen from anywhere)
  const m = select(u.uHasMap.greaterThan(0.5), dot(map.node.sample(vUv), u.uChan).mul(1.6), smoothstep(0.75, 1, r).oneMinus());
  const hot = select(u.uHasRamp.greaterThan(0.5), ramp.node.sample(vec2(k.mul(0.96).add(0.02), u.uRampV)).rgb.mul(3.2), vec3(1, 0.816, 0.627).mul(3));
  mat.colorNode = hot.mul(m).mul(0.6).mul(k);
  mat.opacityNode = float(1);
  mat.uniforms = u;
  return mat;
}

export const createBoltMeshes = (parent, opts) => createBoltMeshesWith(flashMaterial, parent, opts);
