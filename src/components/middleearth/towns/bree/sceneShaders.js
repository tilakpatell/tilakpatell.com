// Bree’s scene’s shader: the Nazgûl’s sight, a cone of cold mist on the
// ground, its GLSL moved here whole from ./scene.js, and ../../nodes/towns/
// bree/sceneShaders.js its twin on the node renderer.

import * as THREE from 'three';

// The `i`th Rider’s sight, as far and as wide as NAZGUL says; the scene
// writes uTime and uOpacity.
export function sightMaterial(NAZGUL, i) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0x8aa0d8) },
      uOpacity: { value: 0.3 },
      uTime: { value: 0 },
      uSight: { value: NAZGUL.sight },
      uCone: { value: NAZGUL.cone },
      uSeed: { value: i * 3.7 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: 'attribute vec2 local; varying vec2 vP; void main() { vP = local; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity, uTime, uSight, uCone, uSeed;
          varying vec2 vP;
          float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
          void main() {
            float r = length(vP) / uSight;
            float a = abs(atan(-vP.y, vP.x)) / uCone;
            float edge = 1.0 - smoothstep(0.62, 1.12, a);
            float reach = pow(1.0 - smoothstep(0.0, 1.0, r), 1.4) * smoothstep(0.0, 0.08, r);
            vec2 q = vP * 0.55 + vec2(uTime * 0.35 + uSeed, -uTime * 0.22);
            float mist = 0.55 + 0.45 * noise(q) * noise(q * 2.3 + 4.1);
            float ripple = 0.85 + 0.15 * sin(r * 22.0 - uTime * 3.0);
            float alpha = edge * reach * mist * ripple * uOpacity;
            gl_FragColor = vec4(uColor * (0.7 + 0.5 * (1.0 - r)), alpha);
          }`,
  });
}
