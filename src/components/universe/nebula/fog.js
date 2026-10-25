// The fog round the ship inside a nebula: a few shells round the eye, each a
// full-screen quad, in one draw after the clouds' (shaders.js's FOG_VERT and
// FOG_FRAG). They hold the cloud's first stretch from the eye, the part its
// march skips (index.js starts it at the last shell), so the gas round the
// ship is drawn behind the ship, never over it, and is counted once.
//
// createFog({ volume, row }) → { mesh, show(cloud, layers), hide(), dispose() }
//   volume   the clouds' noise volume, lent: dispose() leaves it
//   row      the tier's (budget.js): row.fog shells at most
//   mesh     'nebula-fog', made hidden, so the scene's warm-up links it
//   show(cloud, layers)  cloud = { centre: [x, y, z] (its middle less the
//            eye, in the map's axes and units), r, colours: THREE.Color[3],
//            seed: [a, b, c], form: FORM_INDEX's number, depth: how deep the
//            eye is in it, 0…1 }; layers = rules.js's fogLayers, ascending
//   hide()   nothing drawn till the next show
//
// Each shell is one instance, drawn far to near. Its aLayer is (its radius,
// the gas it holds: from the shell inside it, the first from the eye), so
// together they hold exactly the stretch out to the last.

import * as THREE from 'three';
import { FORMS, FORM_INDEX } from './rules';
import { FOG, FOG_FRAG, FOG_VERT } from './shaders';

// the forms by their shader number
const BY_INDEX = [];
for (const [name, i] of Object.entries(FORM_INDEX)) BY_INDEX[i] = FORMS[name];

export function createFog({ volume, row }) {
  const cap = Math.max(1, row?.fog ?? 1);
  const geometry = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(2, 2);
  geometry.index = quad.index;
  geometry.setAttribute('position', quad.attributes.position);
  const aLayer = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  geometry.setAttribute('aLayer', aLayer);
  geometry.instanceCount = 0;
  const material = new THREE.ShaderMaterial({
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    uniforms: {
      uVolume: { value: volume },
      uTan: { value: new THREE.Vector2(1, 1) },
      uCentre: { value: new THREE.Vector3() },
      uRadius: { value: 1 },
      uColours: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      uSeed: { value: new THREE.Vector3() },
      uForm: { value: new THREE.Vector4() },
      uCore: { value: 1 },
      uDepth: { value: 0 },
      uGlow: { value: FOG.glow },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    // (premultiplied, as the clouds are)
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'nebula-fog';
  mesh.frustumCulled = false;
  mesh.renderOrder = -4;
  mesh.visible = false;
  const u = material.uniforms;
  // (the view's shape, for each pixel's ray)
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const e = camera.projectionMatrix.elements;
    u.uTan.value.set(1 / (e[0] || 1), 1 / (e[5] || 1));
  };

  let disposed = false;

  const hide = () => {
    mesh.visible = false;
  };

  const show = (cloud, layers) => {
    if (disposed) return;
    const n = Math.min(layers?.length ?? 0, cap);
    if (!cloud || !n) return hide();
    // far to near; a shell holds the gas from the one inside it
    let changed = geometry.instanceCount !== n;
    for (let i = 0; i < n; i++) {
      const k = n - 1 - i;
      const radius = layers[k];
      const thick = radius - (k > 0 ? layers[k - 1] : 0);
      if (aLayer.getX(i) !== Math.fround(radius) || aLayer.getY(i) !== Math.fround(thick)) {
        aLayer.setXY(i, radius, thick);
        changed = true;
      }
    }
    if (changed) aLayer.needsUpdate = true;
    geometry.instanceCount = n;
    u.uCentre.value.fromArray(cloud.centre);
    u.uRadius.value = cloud.r;
    for (let i = 0; i < 3; i++) u.uColours.value[i].copy(cloud.colours[i] ?? cloud.colours[0]);
    u.uSeed.value.fromArray(cloud.seed);
    const form = BY_INDEX[cloud.form] ?? FORMS.cloud;
    u.uForm.value.set(form.inner, form.peak, form.outer, form.flat);
    u.uCore.value = form.core;
    u.uDepth.value = cloud.depth;
    mesh.visible = true;
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    hide();
    geometry.dispose();
    material.dispose();
  };

  return { mesh, show, hide, dispose };
}
