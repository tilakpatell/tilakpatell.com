// The Force push the game's way: Luke's half-sphere (the 2017 drop's
// forcefronthalfsphere, ./gameLook's `force.push`), a front running out
// from the hand along the push, widening and fading as it goes, drawn as a rim of light
// (bright where it is seen edge on, clear through the middle), and for a
// pull the same drawn in. A few pooled, one draw each while they play.
// Null look (the bucket hadn't it): `push` returns false and the scene's
// own rush of dust stands alone.
//
// createPush(parent) → { ready: Promise, push(from, dir, { colour, pull, reach }) → bool, update(dt), dispose() }
//
// (The pool and the front's run are ./pushCore.js's, shared with
// pushNodes.js; the GLSL is this file's alone.)

import * as THREE from 'three';
import { createPushWith } from './pushCore';

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColour;
uniform float uAge;
varying vec3 vN;
varying vec3 vView;
void main() {
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 3.0);
  float k = 1.0 - uAge;
  // (never over the bloom's threshold: a wave of air, not a light)
  gl_FragColor = vec4(uColour * rim * k * k * 1.2, 1.0);
}`;

// a front's material: its colour, and its age (0…1) the frame writes
// (exported for the twins' comparison: scripts/twin-parity)
export function pushMaterial() {
  const u = { uColour: { value: new THREE.Color() }, uAge: { value: 1 } };
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
}

export const createPush = (parent) => createPushWith(pushMaterial, parent);
