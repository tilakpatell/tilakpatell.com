// The surface's own shaders on the classic renderer, as they were before
// the flip (main at #890: activity.js's beam, the assault's column and
// meter, the heroes-versus-villains wall), for the classic renderer. Their node
// twins, line for line, are ../nodes/activity.js, ../nodes/missions.js and
// ../nodes/hvv.js, with the same uniforms on `material.uniforms`.
//
//   beamMaterial(color), columnMaterial(color, alpha), meterMaterial(color),
//   wallMaterial(color) → material

import * as THREE from 'three';

const BEAM_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 2.0) * (1.0 - vUv.y) * (0.55 + 0.25 * sin(uTime * 3.0 - vUv.y * 12.0));
  gl_FragColor = vec4(uColor * 2.2, a);
}`;

export const beamMaterial = (color) =>
  new THREE.ShaderMaterial({ vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

const COLUMN_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const COLUMN_FRAG = `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uTime;
uniform float uAlpha;
void main() {
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float a = pow(edge, 1.6) * (1.0 - vUv.y) * (0.5 + 0.2 * sin(uTime * 2.0 - vUv.y * 10.0)) * uAlpha;
  gl_FragColor = vec4(uColor * 2.0, a);
}`;
// a ring that fills round from the top, by uFill (0…1)
const RING_VERT = `
varying float vAng;
void main() { vAng = atan(position.x, position.y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RING_FRAG = `
varying float vAng;
uniform vec3 uColor;
uniform float uFill;
void main() {
  float k = (vAng + 3.14159265) / 6.2831853;
  if (k > uFill) discard;
  gl_FragColor = vec4(uColor * 2.4, 0.85);
}`;

export const columnMaterial = (color, alpha) =>
  new THREE.ShaderMaterial({ vertexShader: COLUMN_VERT, fragmentShader: COLUMN_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uAlpha: { value: alpha } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });

export const meterMaterial = (color) =>
  new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uFill: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

const WALL_VERT = `
attribute float v;
varying float vV;
void main() { vV = v; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const WALL_FRAG = `
varying float vV;
uniform vec3 uColor;
uniform float uTime;
void main() {
  float a = (1.0 - vV) * (1.0 - vV) * (0.32 + 0.08 * sin(uTime * 1.6 + vV * 6.0));
  gl_FragColor = vec4(uColor * 1.6, a);
}`;

export const wallMaterial = (color = '#bcd8ff') =>
  new THREE.ShaderMaterial({ vertexShader: WALL_VERT, fragmentShader: WALL_FRAG, uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
