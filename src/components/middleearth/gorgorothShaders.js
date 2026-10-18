// Gorgoroth's three shaders (the Eye, its beam, and the pool the beam
// lights on the road), moved out of ./Gorgoroth3D.js as they were (it
// imports them), so ./nodes/gorgorothShaders.js can be their twin.

import * as THREE from 'three';

export function eyeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uLook: { value: 0 },
      uAnger: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float uTime, uLook, uAnger;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(2.0, 1.0);
        float lick = noise(vec2(p.x * 5.0, p.y * 6.0 - uTime * 2.2)) * 0.5 + noise(vec2(p.x * 11.0 + 3.0, p.y * 12.0 - uTime * 3.4)) * 0.25;
        float lid = 0.3 * pow(max(0.0, 1.0 - p.x * p.x * 1.25), 0.75) * (0.85 + 0.4 * lick);
        float lens = 1.0 - smoothstep(0.0, 1.0, abs(p.y) / (lid + 0.001));
        float halo = exp(-dot(p * vec2(1.0, 2.2), p * vec2(1.0, 2.2)) * 3.2);
        vec3 col = mix(vec3(0.9, 0.12, 0.02), vec3(2.6, 1.0, 0.16), lens) * lens;
        col += vec3(3.0, 2.3, 1.0) * pow(lens, 3.0);
        col += mix(vec3(0.7, 0.16, 0.03), vec3(1.4, 0.1, 0.02), uAnger) * halo * (0.5 + 0.5 * lick);
        vec2 q = vec2((p.x - uLook) / 0.05, p.y / 0.25);
        col *= smoothstep(0.75, 1.15, dot(q, q));
        gl_FragColor = vec4(col * (1.0 + uAnger * 0.8), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// the beam: a cone of lit dust from the Eye to the road
export function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(1.5, 0.75, 0.3) },
      uPower: { value: 1 },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader:
      'varying vec3 vN; varying vec3 vV; varying vec2 vUv; void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower, uTime;
      varying vec3 vN;
      varying vec3 vV;
      varying vec2 vUv;
      void main() {
        float face = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float along = mix(0.5, 1.0, vUv.y) * smoothstep(0.0, 0.06, vUv.y);
        float dust = 0.82 + 0.18 * sin(vUv.y * 60.0 - uTime * 3.0 + vUv.x * 12.0);
        gl_FragColor = vec4(uColor * face * along * dust * uPower * 0.12, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// where the beam lands, sharing the beam's uniforms
export function poolMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uPower;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        gl_FragColor = vec4(uColor * (1.0 - smoothstep(0.55, 1.0, d)) * uPower * 0.13, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
