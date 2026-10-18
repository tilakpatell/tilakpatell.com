// Lothlórien’s scene’s shader: the streams’ and the river’s water, its GLSL
// moved here whole from ./scene.js, and ../../nodes/towns/lorien/
// sceneShaders.js its twin on the node renderer.

import * as THREE from "three";

// Water: a slow ripple and the sky in it; `flow` runs it along +x.
export function waterMaterial(water, flow = 0) {
  const m = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 }, uFlow: { value: flow } },
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
      uniform float uTime, uFlow;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        vec2 p = vWorld.xz * 0.35 - vec2(uTime * uFlow, 0.0);
        float n = noise(p + uTime * 0.06) * 0.5 + noise(p * 2.3 - uTime * 0.09) * 0.5;
        vec3 nrm = normalize(vec3((n - 0.5) * 0.3, 1.0, (noise(p * 1.6 + 3.0) - 0.5) * 0.3));
        vec3 view = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.25 + fres * 0.7);
        col += uSunColor * pow(max(dot(reflect(-normalize(uSun), nrm), view), 0.0), 90.0) * 1.6;
        // a little white where it runs fast
        col += vec3(0.8) * smoothstep(0.82, 0.95, noise(p * 4.0 - uTime * uFlow * 0.5)) * min(uFlow, 1.0) * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  for (const k of ["uSky", "uDeep", "uSun", "uSunColor"])
    m.uniforms[k] = water.uniforms[k];
  return m;
}
