// The fight’s effects’ shaders as GLSL, as fx.js drew them on the classic
// renderer: kept for the parity check (scripts/twin-parity/cases/deathstar.js)
// and the twins’ tests, never imported by the world (its 'nodes' closure
// reaches ../nodes/fx.js instead, the same factories as nodes). fx.js’s
// header says what each draws.
//
//   spriteMaterial() → 'ds-glow'   the bolts’ glows, sparks and muzzle flashes, added
//   puffMaterial() → 'ds-puff'   fire and smoke, premultiplied
//   scorchMaterial() → 'ds-scorch'   the burns on the walls, premultiplied, pulled towards the eye

import * as THREE from 'three';

// A sprite: a quad facing the eye, a soft round glow, or drawn out along a
// way (a bolt’s glow, a spark’s streak) by as much of that way as is seen
// across the view, so a bolt coming straight at you is a round glow.
const SPRITE_VERT = /* glsl */ `
attribute vec3 aAt;
attribute vec3 aDir;
attribute vec2 aSize;
attribute vec3 aColour;
varying vec2 vP;
varying float vCore;
varying float vHalf;
varying vec3 vColour;
void main() {
  vec4 c = viewMatrix * vec4(aAt, 1.0);
  vec2 axis = (viewMatrix * vec4(aDir, 0.0)).xy;
  float seen = length(axis);
  axis = seen > 1e-4 ? axis / seen : vec2(1.0, 0.0);
  vec2 side = vec2(-axis.y, axis.x);
  float core = aSize.x * seen;
  vec2 p = vec2(position.x * (core + aSize.y), position.y * aSize.y);
  c.xy += axis * p.x + side * p.y;
  gl_Position = projectionMatrix * c;
  vP = p;
  vCore = core;
  vHalf = aSize.y;
  vColour = aColour;
}`;
const SPRITE_FRAG = /* glsl */ `
varying vec2 vP;
varying float vCore;
varying float vHalf;
varying vec3 vColour;
void main() {
  vec2 q = vec2(max(abs(vP.x) - vCore, 0.0), vP.y);
  float r = length(q) / vHalf;
  if (r >= 1.0) discard;
  gl_FragColor = vec4(vColour * exp(-r * r * 5.0) * (1.0 - r), 1.0);
  #include <colorspace_fragment>
}`;

// a cheap value noise, for the ragged edges of smoke, fire and scorches
const NOISE = /* glsl */ `
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}`;

// A puff: a billow facing the eye. Its colour is premultiplied, so fire
// (light, nothing covered) and smoke (grey, covering what is behind) share
// one draw: alpha 0 adds, alpha 1 covers.
const PUFF_VERT = /* glsl */ `
attribute vec3 aAt;
attribute vec4 aShape;
attribute vec4 aColour;
varying vec2 vUv;
varying vec2 vSeed;
varying vec4 vColour;
void main() {
  vec4 c = viewMatrix * vec4(aAt, 1.0);
  float s = sin(aShape.y);
  float k = cos(aShape.y);
  c.xy += mat2(k, s, -s, k) * position.xy * aShape.x;
  gl_Position = projectionMatrix * c;
  vUv = position.xy;
  vSeed = aShape.zw;
  vColour = aColour;
}`;
const PUFF_FRAG = /* glsl */ `
${NOISE}
varying vec2 vUv;
varying vec2 vSeed;
varying vec4 vColour;
void main() {
  float d = length(vUv);
  if (d >= 1.0) discard;
  vec2 p = vUv * 2.2 + vSeed;
  float n = noise(p) * 0.65 + noise(p * 2.3 + 3.1) * 0.35;
  float shape = smoothstep(1.0, 0.25, d + (n - 0.5) * 0.6);
  gl_FragColor = vColour * shape;
  #include <colorspace_fragment>
}`;

// A scorch: soot darkening the wall, ragged at its edge, with an ember at
// its middle that glows orange and cools. Premultiplied too: the soot
// covers, the ember adds.
const SCORCH_VERT = /* glsl */ `
attribute vec3 aBurn;
varying vec2 vUv;
varying vec3 vBurn;
void main() {
  vUv = position.xy * 2.0;
  vBurn = aBurn;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const SCORCH_FRAG = /* glsl */ `
${NOISE}
varying vec2 vUv;
varying vec3 vBurn;
void main() {
  float d = length(vUv);
  if (d >= 1.0) discard;
  float n = noise(vUv * 3.0 + vBurn.z);
  float soot = smoothstep(1.0, 0.15, d + (n - 0.5) * 0.55) * 0.85 * vBurn.y;
  float ember = smoothstep(0.45, 0.0, d + (n - 0.5) * 0.3) * vBurn.x;
  gl_FragColor = vec4(vec3(3.0, 0.9, 0.25) * ember, soot);
  #include <colorspace_fragment>
}`;

export const spriteMaterial = () => new THREE.ShaderMaterial({ name: 'ds-glow', vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

export const puffMaterial = () => new THREE.ShaderMaterial({ name: 'ds-puff', vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.NormalBlending, toneMapped: false });

// (pulled towards the eye in depth, so a scorch never fights the wall it is on)
export const scorchMaterial = () =>
  new THREE.ShaderMaterial({ name: 'ds-scorch', vertexShader: SCORCH_VERT, fragmentShader: SCORCH_FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4, toneMapped: false });
