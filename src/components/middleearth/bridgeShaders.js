// The bridge's one shader, moved out of ./Bridge3D.js as it was (it
// imports it), so ./nodes/bridgeShaders.js can be its twin.

import * as THREE from "three";

// the staff's ward: a shell of light, bright at its rim
export function wardMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader:
      "varying vec3 vN; varying vec3 vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: `
      uniform float opacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        gl_FragColor = vec4(vec3(1.5, 2.1, 3.2) * (0.06 + rim), opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
