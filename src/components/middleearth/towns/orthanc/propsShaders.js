// Orthanc’s shaders, out of ./props.js and as they were there: the
// palantír’s glass and the tower’s glassy black stone. ../../nodes/towns/
// orthanc/propsShaders.js is their twin on the node renderer, the same names.

import * as THREE from 'three';

// The palantír's glass: dark, a cold sheen at its rim, and deep inside a
// fire that wakes as you look (uWake) and, at the last, the Eye (uEye).
export function stoneMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWake: { value: 0 },
      uEye: { value: 0 },
      uFire: { value: new THREE.Color(1.0, 0.36, 0.08) },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vView; varying vec3 vP;
      void main() {
        vP = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uTime, uWake, uEye;
      uniform vec3 uFire;
      varying vec3 vN; varying vec3 vView; varying vec3 vP;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.07 + 3.1; a *= 0.5; } return s; }
      void main() {
        vec3 n = normalize(vN);
        vec3 v = normalize(vView);
        float facing = max(dot(n, v), 0.0);
        float rim = pow(1.0 - facing, 3.0);
        vec3 col = vec3(0.006, 0.007, 0.01) + vec3(0.16, 0.18, 0.24) * rim;
        // the fire, deep down: seen best looking straight in
        vec2 q = n.xy;
        float r = length(q);
        float sw = fbm(vec2(atan(q.y, q.x) * 1.6 + uTime * 0.25, r * 5.0 - uTime * 0.6));
        float fire = pow(sw, 2.2) * pow(facing, 1.6) * (0.18 + uWake * 2.6);
        col += uFire * fire;
        // the Eye: a fiery iris round a slit, looking out at you
        float iris = smoothstep(0.62, 0.2, r) * (0.6 + 0.4 * fbm(q * 9.0 + uTime));
        float slit = smoothstep(0.07, 0.02, abs(q.x) / max(0.15, 1.0 - abs(q.y) * 1.4)) * smoothstep(0.62, 0.3, abs(q.y));
        col += uFire * 3.0 * iris * uEye * (1.0 - slit);
        col = mix(col, vec3(0.0), slit * uEye * smoothstep(0.62, 0.2, r));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Orthanc's black stone is glassy: its knife edges and facets catch the
// storm's grey light at a slant, and the pits' fire from below, low down
export function glassyStone(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vTowerY;').replace('#include <project_vertex>', '#include <project_vertex>\nvTowerY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTowerY;').replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec3 towerUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
      float towerFacing = dot(normal, towerUp);
      float towerRim = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 3.0);
      // (on the walls and the edges, not the tops of the steps)
      totalEmissiveRadiance += vec3(0.26, 0.3, 0.38) * towerRim * (0.45 + 0.55 * max(0.0, towerFacing + 0.3)) * (1.0 - smoothstep(0.55, 0.9, towerFacing));
      totalEmissiveRadiance += vec3(0.55, 0.16, 0.04) * max(0.0, -towerFacing) * exp(-vTowerY / 34.0) * 0.9;`,
    );
  };
  m.customProgramCacheKey = () => 'orthanc-tower-stone';
  return m;
}
