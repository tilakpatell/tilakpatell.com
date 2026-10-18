// Rivendell’s scene’s shader: the river’s GLSL, moved here whole from
// ./scene.js, and ../../nodes/towns/rivendell/sceneShaders.js its twin on
// the node renderer.

import * as THREE from "three";

// The river in its gorge, flowing south, quick and white over the stones;
// its sky, deep, sun and sun’s colour the town’s water’s own
// (`water.uniforms`, which the sky writes)
export function riverMaterial(water) {
  const riverMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 } },
    ]),
    fog: true,
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
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // flowing south, quick and white over the stones
        vec2 p = vec2(vWorld.x * 0.45, vWorld.z * 0.14 - uTime * 1.6);
        float n = noise(p * 2.0) * 0.6 + noise(p * 5.0 + 3.0) * 0.4;
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 nrm = normalize(vec3((n - 0.5) * 0.4, 1.0, (noise(p * 3.0 + 7.0) - 0.5) * 0.4));
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.3 + fres * 0.6);
        col += uSunColor * pow(max(dot(nrm, normalize(normalize(uSun) + view)), 0.0), 90.0) * 1.6;
        col = mix(col, vec3(0.92, 0.95, 1.0), smoothstep(0.66, 0.92, noise(p * 3.4 + uTime * 0.5)) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ["uSky", "uDeep", "uSun", "uSunColor"])
    riverMat.uniforms[k] = water.uniforms[k];
  return riverMat;
}
