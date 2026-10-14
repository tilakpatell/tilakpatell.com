// The flight's own two GLSL shaders, as they were before the flight went
// onto the node renderer (lane P1): the sky dome (scene.js's) and the city's
// lit windows (ground.js's). Nothing the flight draws imports this file:
// it is kept for the twins' parity check (scripts/twin-parity/cases/
// flight.js) and their test (nodes.test.js), against ./nodes.js.
//
//   skyDome(low, high) → the dome (a Mesh), material.uniforms { uLow, uHigh }
//   cityMaterial(colour) → a standard material, 'flight-city'

import * as THREE from 'three';

const SKY_R = 40000; // m: as scene.js's

// the sky: the horizon colour below, a gradient to the zenith above
export function skyDome(low, high) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uLow: { value: new THREE.Color(low) }, uHigh: { value: new THREE.Color(high) } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLow;
      uniform vec3 uHigh;
      varying vec3 vDir;
      void main() {
        float t = smoothstep(-0.02, 0.45, vDir.y);
        gl_FragColor = vec4(mix(uLow, uHigh, t), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

// A city's facades: lit windows read from where a face is in the world, so
// every tower's windows are 4 × 3.5 m however tall it's scaled, and about a
// third of them lit, warm, at the city's dusk
export function cityMaterial(colour) {
  const m = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.7, metalness: 0.15 });
  m.name = 'flight-city';
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityW;\nvarying vec3 vCityN;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
#ifdef USE_INSTANCING
vCityW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vCityN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
#else
vCityW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vCityN = normalize(mat3(modelMatrix) * objectNormal);
#endif`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCityW;\nvarying vec3 vCityN;\nfloat cityHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // each tower its own stone: a tint by the lot it stands on
  float t = cityHash(floor(vCityW.xz / 150.0) + 7.3);
  diffuseColor.rgb *= mix(vec3(0.82, 0.8, 0.84), vec3(1.18, 1.12, 1.04), t);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  // floors 3.5 m apart, panes 4 m wide, lit in runs along a floor (an
  // office lit, the next dark) as the films' towers are at dusk; where a
  // pane is smaller than a pixel the pattern gives way to its average, so a
  // far tower glows evenly instead of shimmering
  float side = 1.0 - abs(vCityN.y);
  float u = abs(vCityN.x) > 0.5 ? vCityW.z : vCityW.x;
  vec2 cell = vec2(u / 4.0, vCityW.y / 3.5);
  vec2 f = fract(cell);
  float pane = step(0.14, f.x) * step(f.x, 0.86) * step(0.25, f.y) * step(f.y, 0.8);
  float run = cityHash(vec2(floor(cell.x / 6.0), floor(cell.y)) + floor(vCityW.xz / 150.0));
  float lit = step(0.72, run) * step(0.25, cityHash(floor(cell)));
  float near = clamp(1.6 - max(fwidth(cell.x), fwidth(cell.y)) * 2.0, 0.0, 1.0);
  float glow = mix(0.13, pane * lit, near);
  totalEmissiveRadiance += vec3(1.0, 0.74, 0.46) * glow * side * 1.4;
  diffuseColor.rgb *= 1.0 - pane * side * 0.25 * near;
}`,
      );
  };
  m.customProgramCacheKey = () => 'flight-city';
  return m;
}
