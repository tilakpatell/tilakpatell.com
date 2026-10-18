// Moria's scene's shader: the lake's GLSL, moved here whole from ./scene.js,
// and ../../nodes/towns/moria/sceneShaders.js its twin on the node renderer.

import * as THREE from "three";

// The lake: black and still, the moon on it; its sky, deep, sun and sun's
// colour the town's water's own (`water.uniforms`, which the sky writes)
export function lakeMaterial(water) {
  const lakeMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 }, uStir: { value: 0 } },
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
      uniform float uTime, uStir;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // still, but for slow rings; stirred when the Watcher wakes
        vec2 p = vWorld.xz * 0.4;
        float n = noise(p + uTime * 0.05) * 0.5 + noise(p * 2.7 - uTime * 0.08) * 0.5;
        float rip = sin(length(vWorld.xz - vec2(4.0, 10.0)) * 3.0 - uTime * 2.0) * uStir * 0.5;
        vec3 nrm = normalize(vec3((n - 0.5) * (0.12 + uStir * 0.5) + rip * 0.1, 1.0, (noise(p * 1.7 + 3.0) - 0.5) * (0.12 + uStir * 0.5)));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 4.0);
        vec3 col = mix(uDeep, uSky, fres * 0.8);
        col += uSunColor * pow(max(dot(reflect(-normalize(uSun), nrm), view), 0.0), 160.0) * 3.0;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ["uSky", "uDeep", "uSun", "uSunColor"])
    lakeMat.uniforms[k] = water.uniforms[k];
  return lakeMat;
}
