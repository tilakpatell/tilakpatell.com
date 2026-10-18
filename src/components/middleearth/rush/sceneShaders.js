// The rush's one shader, moved out of ./scene.js as it was (./scene.js
// imports it), so ../nodes/rush/sceneShaders.js can be its twin.

import * as THREE from "three";

// A ring over a station, filling clockwise from the top.
export function ringMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uK: { value: 0 },
      uCol: { value: new THREE.Color() },
      uFlash: { value: 0 },
    },
    vertexShader:
      "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
      uniform float uK; uniform vec3 uCol; uniform float uFlash; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float a = atan(p.x, p.y) / 6.2831853 + 0.5;
        vec3 back = vec3(0.08, 0.06, 0.05);
        vec3 col = r < 0.6 ? back : (a > 1.0 - uK ? uCol : vec3(0.22, 0.2, 0.18));
        col = mix(col, vec3(1.0, 0.25, 0.15), uFlash * step(0.6, r));
        float edge = smoothstep(1.0, 0.92, r);
        gl_FragColor = vec4(col, 0.95 * edge);
      }`,
  });
}
