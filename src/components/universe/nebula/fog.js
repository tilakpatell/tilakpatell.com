// The fog round the ship, while it is in a cloud: a few full-screen layers
// at set distances from the eye (rules.js fogLayers), each one sample of the
// cloud’s own field (shaders.js FIELD) at its depth. So the wisps are the
// same gas as the cloud seen from outside, fixed in the world, and stream
// past as you fly. Each layer is depth-tested at its radius: what is nearer
// hides it, so near things stay clearer than far ones, and the ship (at most
// 2.5 behind the eye) is in front of the first layer at 8. The ship’s own
// light scatters off the gas a couple of units ahead of the eye. The clouds’
// renderer (./index.js) owns it: it says which cloud, and starts that
// cloud’s march past the last layer, so nothing is counted twice.
//
// createFog({ volume, row }) → { mesh, show(cloud, layers), hide(), dispose() }
//   mesh: 'nebula-fog', hidden till shown; its owner puts it at the camera,
//     so its modelViewMatrix is the map’s turn alone and the ray reads the
//     map’s axes as the clouds’ does
//   show(cloud, layers): cloud = { centre, r, colours, seed, form, depth },
//     centre the cloud’s middle less the camera (true units, the map’s axes),
//     form its index, depth how deep in (insideOf); layers ascending
//     (fogLayers), [] for a cloud too small to fog the ship, which shows none
//   aLayer: (radius, the thickness to the layer inside it), far to near, so
//     each is drawn over what is behind it in the one draw

import * as THREE from 'three';
import { FORMS, FORM_INDEX } from './rules';
import { FOG_FRAG, FOG_VERT } from './shaders';

// (the forms’ numbers have one source: rules.js)
const formAt = (index) => FORMS[Object.keys(FORM_INDEX).find((k) => FORM_INDEX[k] === index)] ?? FORMS.cloud;

export function createFog({ volume, row }) {
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.instanceCount = 0;
  const aLayer = new THREE.InstancedBufferAttribute(new Float32Array(row.fog * 2), 2).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aLayer', aLayer);

  const uniforms = {
    uVolume: { value: volume },
    uCentre: { value: new THREE.Vector3() },
    uR: { value: 1 },
    uCol0: { value: new THREE.Color() },
    uCol1: { value: new THREE.Color() },
    uCol2: { value: new THREE.Color() },
    uSeed: { value: new THREE.Vector3() },
    uForm: { value: new THREE.Vector4() },
    uCore: { value: 1 },
    uDepth: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    name: 'nebula-fog',
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    uniforms,
    // premultiplied, as the clouds: the fog adds its light and dims what’s behind
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    // (a mirrored parent culls nothing, and one pass where three would draw
    // a transparent two-sided thing twice)
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'nebula-fog';
  mesh.frustumCulled = false;
  mesh.renderOrder = -4; // (after the clouds, which are -5)
  mesh.visible = false;

  let disposed = false;
  const hide = () => {
    mesh.visible = false;
    geo.instanceCount = 0;
  };

  return {
    mesh,
    show(cloud, layers) {
      const n = Math.min(layers.length, row.fog);
      if (disposed || n === 0) return hide();
      for (let i = 0; i < n; i++) {
        const k = n - 1 - i;
        aLayer.setXY(i, layers[k], k === 0 ? layers[0] : layers[k] - layers[k - 1]);
      }
      aLayer.clearUpdateRanges();
      aLayer.addUpdateRange(0, n * 2);
      aLayer.needsUpdate = true;
      geo.instanceCount = n;
      uniforms.uCentre.value.fromArray(cloud.centre);
      uniforms.uR.value = cloud.r;
      uniforms.uCol0.value.copy(cloud.colours[0]);
      uniforms.uCol1.value.copy(cloud.colours[1]);
      uniforms.uCol2.value.copy(cloud.colours[2]);
      uniforms.uSeed.value.fromArray(cloud.seed);
      const f = formAt(cloud.form);
      uniforms.uForm.value.set(f.inner, f.peak, f.outer, f.flat);
      uniforms.uCore.value = f.core;
      uniforms.uDepth.value = cloud.depth;
      mesh.visible = true;
    },
    hide,
    dispose() {
      if (disposed) return;
      disposed = true;
      hide();
      geo.dispose();
      quad.dispose();
      mat.dispose();
    },
  };
}
