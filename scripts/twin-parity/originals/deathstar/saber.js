// The duel’s shaders as GLSL, as saber.js drew them on the classic renderer:
// kept for the parity check (scripts/twin-parity/cases/deathstar.js) and the
// twins’ tests, never imported by the world (its 'nodes' closure reaches
// src/components/deathstar/inside/scene/nodes/saber.js instead, the same factories as nodes).
//
//   bladeGlowMaterial() → 'ds-saber-glow'   the blades’ glows, the arcs, sparks, flashes and ripples, added
//   trailMaterial() → 'ds-trail'   the ribbon a swung blade leaves, added
//
// It lives here, beside the check that reads it, and not under src/: the
// world’s GLSL is gone from the site once it is ported (glsl-sites counts
// src/ only). Lane FL4 deletes it with the other originals.

import * as THREE from 'three';

// A sprite: a quad facing the eye, drawn out along a way (a blade, an
// arc’s piece) by as much of it as is seen across the view, so a blade
// pointed at you is a round glow. A soft glow, or with a band (aSize.z) a
// thin bright ring at its edge, as a ripple in the air catches the light.
const SPRITE_VERT = /* glsl */ `
attribute vec3 aAt;
attribute vec3 aDir;
attribute vec3 aSize;
attribute vec3 aColour;
varying vec2 vP;
varying float vCore;
varying float vHalf;
varying float vBand;
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
  vBand = aSize.z;
  vColour = aColour;
}`;
const SPRITE_FRAG = /* glsl */ `
varying vec2 vP;
varying float vCore;
varying float vHalf;
varying float vBand;
varying vec3 vColour;
void main() {
  vec2 q = vec2(max(abs(vP.x) - vCore, 0.0), vP.y);
  float r = length(q) / vHalf;
  if (r >= 1.0) discard;
  float glow = exp(-r * r * 5.0) * (1.0 - r);
  float w = max(vBand, 1e-3);
  float x = (r - 1.0 + w) / (0.5 * w);
  float ring = exp(-x * x);
  gl_FragColor = vec4(vColour * mix(glow, ring, step(1e-4, vBand)), 1.0);
  #include <colorspace_fragment>
}`;

// A trail: the ribbon between where a blade was and where it is, brightest
// along the tip’s path and fading to nothing at the hilt’s.
const TRAIL_VERT = /* glsl */ `
attribute vec3 aColour;
attribute float aEdge;
varying vec3 vColour;
varying float vEdge;
void main() {
  vColour = aColour;
  vEdge = aEdge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TRAIL_FRAG = /* glsl */ `
varying vec3 vColour;
varying float vEdge;
void main() {
  gl_FragColor = vec4(vColour * vEdge * vEdge * vEdge, 1.0);
  #include <colorspace_fragment>
}`;

export const bladeGlowMaterial = () => new THREE.ShaderMaterial({ name: 'ds-saber-glow', vertexShader: SPRITE_VERT, fragmentShader: SPRITE_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

export const trailMaterial = () => new THREE.ShaderMaterial({ name: 'ds-trail', vertexShader: TRAIL_VERT, fragmentShader: TRAIL_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
