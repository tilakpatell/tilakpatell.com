// Weathertop’s river at the ford, moved out of ./scene.js as it was, so
// ../../nodes/towns/weathertop/sceneShaders.js can be its twin on the node
// renderer. `water` is the scene’s: what the sky writes for water to read.

import * as THREE from "three";

export function riverMaterial(water) {
  const riverMat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uFlood: { value: 0 },
        uSky: water.uniforms.uSky,
        uDeep: water.uniforms.uDeep,
        uSun: water.uniforms.uSun,
        uSunColor: water.uniforms.uSunColor,
      },
    ]),
    fog: true,
    transparent: true,
    depthWrite: false,
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
      uniform float uTime, uFlood;
      uniform vec3 uSky, uDeep, uSun, uSunColor;
      varying vec3 vWorld;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        // it flows across the road, to +z; faster and whiter in the flood
        float speed = 1.2 + uFlood * 5.0;
        vec2 p = vec2(vWorld.x * 0.35, vWorld.z * 0.12 - uTime * speed);
        float n = noise(p * 2.0) * 0.6 + noise(p * 5.3 + 3.1) * 0.4;
        vec3 view = normalize(cameraPosition - vWorld);
        vec3 nrm = normalize(vec3((n - 0.5) * 0.35, 1.0, (noise(p * 3.1 + 7.0) - 0.5) * 0.35));
        float fres = pow(1.0 - max(dot(nrm, view), 0.0), 3.0);
        vec3 col = mix(uDeep, uSky, 0.35 + fres * 0.65);
        vec3 h = normalize(normalize(uSun) + view);
        col += uSunColor * pow(max(dot(nrm, h), 0.0), 120.0) * 2.4;
        // foam over the stones of the ford, and all of it in the flood
        float foam = smoothstep(0.62 - uFlood * 0.5, 0.9, noise(p * 3.7 + uTime * 0.6));
        col = mix(col, vec3(0.9, 0.97, 1.08), foam * (0.3 + uFlood * 0.45));
        gl_FragColor = vec4(col, 0.86);
        #include <fog_fragment>
      }`,
  });
  // (merge copies its uniforms: the sky's water colours are shared back in)
  for (const k of ["uSky", "uDeep", "uSun", "uSunColor"])
    riverMat.uniforms[k] = water.uniforms[k];
  return riverMat;
}
