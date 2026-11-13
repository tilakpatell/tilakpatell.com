// Inside a nebula: its gas in layers round the ship (./index.js shows them
// while insideOf says you are in one). Each layer is a full-screen quad at
// the depth of its radius, the same field the cloud is marched through
// sampled there, so the wisps are fixed in the world and stream past as
// you fly; anything nearer than a layer hides it, so near things read
// clearer than far ones. The ship's lights scatter in the gas just ahead
// of the eye. One draw, the layers far to near.
//
// createFog({ volume, row }) → { mesh, show(cloud, layers), setTime(t), hide(), dispose() }
//   cloud: { centre: [x, y, z] (its middle less the camera, the map's axes, true units), r, colours: THREE.Color[3], seed: [a, b, c], form, depth }

import * as THREE from 'three';
import { formUniforms } from './uniforms';
import { FOG_FRAG, FOG_VERT } from './shaders';
import { EMIT } from './tone';

// how quickly a layer of gas hides what's behind it, per radius; tuned at the in-nebula pose
export const ABSORB_FOG = 0.8;
// the ship's lights' warm white
const GLOW = new THREE.Color(1, 0.9, 0.78).multiplyScalar(0.35);

export function createFog({ volume, row }) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  const layer = new THREE.InstancedBufferAttribute(new Float32Array(row.fog * 2), 2);
  layer.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aLayer', layer);
  geo.instanceCount = 0;
  quad.dispose();
  const mat = new THREE.ShaderMaterial({
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    uniforms: {
      uVolume: { value: volume },
      ...formUniforms(),
      uCentre: { value: new THREE.Vector3() },
      uRadius: { value: 1 },
      uC0: { value: new THREE.Color() },
      uC1: { value: new THREE.Color() },
      uC2: { value: new THREE.Color() },
      uSeed: { value: new THREE.Vector4() },
      uDepth: { value: 0 },
      uAbsorb: { value: ABSORB_FOG },
      uEmit: { value: EMIT },
      uGlow: { value: GLOW.clone() },
      uTime: { value: 0 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendEquation: THREE.AddEquation,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'nebula-fog';
  mesh.frustumCulled = false;
  mesh.renderOrder = -4;
  mesh.visible = false;
  const u = mat.uniforms;
  return {
    mesh,
    show(cloud, layers) {
      const n = Math.min(layers.length, row.fog);
      // far to near: each layer's radius, and the gas between it and the one inside it
      for (let i = 0; i < n; i++) {
        const k = n - 1 - i;
        layer.setXY(i, layers[k], layers[k] - (k > 0 ? layers[k - 1] : 0));
      }
      layer.needsUpdate = true;
      geo.instanceCount = n;
      u.uCentre.value.set(...cloud.centre);
      u.uRadius.value = cloud.r;
      u.uC0.value.copy(cloud.colours[0]);
      u.uC1.value.copy(cloud.colours[1]);
      u.uC2.value.copy(cloud.colours[2]);
      u.uSeed.value.set(...cloud.seed, cloud.form);
      u.uDepth.value = cloud.depth;
      mesh.visible = n > 0;
    },
    setTime(t) {
      u.uTime.value = t;
    },
    hide() {
      mesh.visible = false;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
