// An object’s two shaders built in Node, as the node renderer would build
// them for WebGPU (WGSL), with no device: the builder is told the chip has
// no optional features and the least uniform buffer any has. So a twin
// whose TSL wouldn’t compile fails in its test, not on its first frame.
//
//   buildShaders(object, { scene, camera }) → { vertex, fragment }   the object is put in the scene
//     (a lit material builds with the scene’s lights; a scene with none gets a sky light)

import * as THREE from 'three/webgpu';

const canvas = () => ({ style: {}, addEventListener() {}, removeEventListener() {}, getContext: () => null, width: 1, height: 1 });

export function buildShaders(object, { scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000) } = {}) {
  const renderer = new THREE.WebGPURenderer({ canvas: canvas() });
  renderer.hasFeature = () => false;
  renderer.backend.renderer = renderer;
  if (!object.parent) scene.add(object);
  if (!scene.children.some((o) => o.isLight)) scene.add(new THREE.HemisphereLight(0x9aa6b8, 0x0d0f13, 0.35));
  const b = new THREE.WGSLNodeBuilder(object, renderer);
  b.getUniformBufferLimit = () => 65536; // (the least a WebGPU device has)
  const lightsNode = renderer.lighting.getNode(scene, camera);
  lightsNode.setLights(scene.children.filter((o) => o.isLight));
  Object.assign(b, { scene, camera, material: object.material, lightsNode });
  b.context.material = object.material;
  b.build();
  return { vertex: b.vertexShader, fragment: b.fragmentShader };
}
