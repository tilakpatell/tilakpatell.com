// The Dead Marshes’ scene’s shader: the black water, its GLSL moved here
// whole from ./scene.js, and ../../nodes/towns/marshes/sceneShaders.js its
// twin on the node renderer.

import * as THREE from "three";

// The marsh’s water: black, still, a film of scum, the sky dull in it; its
// sky and deep the town’s water’s own (`water.uniforms`, which the sky writes)
export function marshMaterial(water) {
  const marshMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 } },
    ]),
    fog: true,
    transparent: false,
    vertexShader: `
      #include <fog_pars_vertex>
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uSky, uDeep;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // black, still, a film of scum, the sky dull in it
        vec2 p = vWorld.xz * 0.25;
        float n = noise(p + uTime * 0.02) * 0.6 + noise(p * 3.1) * 0.4;
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(view.y, 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.15 + fres * 0.55);
        col = mix(col, vec3(0.16, 0.18, 0.1), smoothstep(0.55, 0.8, n) * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ["uSky", "uDeep"]) marshMat.uniforms[k] = water.uniforms[k];
  return marshMat;
}
