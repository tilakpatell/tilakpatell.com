// The props' own shaders on the classic renderer: the Gungans' shield and
// the light shafts under a canopy (moved here verbatim from props/core.js
// and props/forest.js, which take them from their kit's looks: kit.js hands
// these, nodes/kit.js their node twins in ../nodes/props.js).
//
//   shieldMaterial() → material (.uniforms: uTime, uColor)
//   shaftMaterial(color, strength) → material (.uniforms: uColor, uK)

import * as THREE from 'three';

// a shimmering dome, brightest at its rim, bands of light running up it
export function shieldMaterial() {
  const uniforms = { uTime: { value: 0 }, uColor: { value: new THREE.Color('#9ad6ff') } };
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main() { vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader:
      'uniform float uTime; uniform vec3 uColor; varying vec3 vN; varying vec3 vW; void main() { vec3 v = normalize(cameraPosition - vW); float f = 1.0 - abs(dot(normalize(vN), v)); float band = 0.5 + 0.5 * sin(vW.y * 0.5 - uTime * 2.2 + sin(vW.x * 0.04 + uTime * 0.7) * 3.0 + vW.z * 0.03); float a = 0.07 + pow(f, 2.2) * 0.75 + band * band * 0.08; gl_FragColor = vec4(uColor * (0.7 + band * 0.5) * a, 1.0); }',
  });
}

// light, slanting down through the canopy: soft columns along the sun's
// rays, brightest low down, fading out far off and close up
export function shaftMaterial(color, strength) {
  return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uK: { value: strength } },
      vertexShader: `
varying vec3 vN; varying vec3 vW; varying float vY;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vY = uv.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: `
uniform vec3 uColor; uniform float uK;
varying vec3 vN; varying vec3 vW; varying float vY;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  float d = length(cameraPosition - vW);
  float edge = pow(abs(dot(normalize(vN), v)), 3.0);
  float along = smoothstep(0.0, 0.1, vY) * (1.0 - smoothstep(0.45, 1.0, vY));
  float fade = smoothstep(6.0, 30.0, d) * (1.0 - smoothstep(110.0, 260.0, d));
  gl_FragColor = vec4(uColor * edge * along * fade * uK, 1.0);
}`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
}
