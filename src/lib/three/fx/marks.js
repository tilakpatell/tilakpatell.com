// The game's sheets drawn as the galaxy's effects: one instanced draw a
// kind, pooled, nothing made after the first. A kind is a sheet (./gameLook)
// and how it is drawn:
//   decal  flat on what was hit, normal blending, fading after `life`: the
//          game's scorch (a mask channel, tinted) or its metal marks (colour)
//   glow   flat, additive: the hot marks a blast leaves, the ring that runs out
//   sprite facing the camera, additive: a burst's rays
// An additive kind's colour is the fire's: hot to cold along the game's
// black-body ramp (`ramp.blackbody`), times the instance's tint, so a bolt's
// colour shows in its embers. Their peak is set once against the galaxy's
// bloom (threshold 1.4, knee 0.5, strength 0.5: scripts/galaxy-bloom-check.mjs):
// a burst's core goes over it for its first tenth, a ring never does.
//
// createSheetFx(parent, { texture, ramp, mode, channel, count, life, fog })
//   → { mesh, add(at, normal, { size, frame, tint, bright, life, grow }), update(dt), clear(), dispose() }
// `texture` a sheet loadLook made (its grid on userData.look); `mode`
// 'decal' | 'decal-colour' | 'glow' | 'sprite'; `channel` 'r' | 'g' | 'b'.
//
// (The pool and the instances are ./marksCore.js's, shared with marksNodes.js;
// the GLSL is this file's alone.)

import * as THREE from 'three';
import { createSheetFxWith } from './marksCore';

const VERT = /* glsl */ `
attribute vec4 aInfo; // age 0…1, frame, unused, brightness
attribute vec3 aTint;
uniform vec2 uGrid;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vTint;
#include <fog_pars_vertex>
void main() {
  vInfo = aInfo;
  vTint = aTint;
  float col = mod(aInfo.y, uGrid.x);
  float row = floor(aInfo.y / uGrid.x);
  vUv = (uv + vec2(col, uGrid.y - 1.0 - row)) / uGrid;
#ifdef SPRITE
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mvPosition.xy += position.xy * length(instanceMatrix[0].xyz);
#else
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
#endif
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uRamp;
uniform float uHasRamp;
uniform float uRampV;
uniform vec4 uChan;
varying vec2 vUv;
varying vec4 vInfo;
varying vec3 vTint;
#include <fog_pars_fragment>
vec3 fire(float k) {
  // the game's ramp, or the site's own cooling where it has none
  return uHasRamp > 0.5 ? texture2D(uRamp, vec2(0.02 + 0.96 * k, uRampV)).rgb : mix(vec3(0.5, 0.08, 0.02), vec3(1.0, 0.95, 0.85), k * k);
}
void main() {
  vec4 t = texture2D(uMap, vUv);
  float age = vInfo.x;
#if defined(DECAL)
  float a = dot(t, uChan) * (1.0 - smoothstep(0.7, 1.0, age));
  gl_FragColor = vec4(vTint, a * vInfo.w);
#elif defined(DECAL_COLOUR)
  float l = dot(t.rgb, vec3(0.333));
  float a = clamp(l * 4.0, 0.0, 1.0) * (1.0 - smoothstep(0.7, 1.0, age));
  gl_FragColor = vec4(t.rgb * vTint, a * vInfo.w);
#else
  float m = dot(t, uChan);
  float heat = 1.0 - age;
  vec3 c = fire(heat) * vTint * m * vInfo.w * heat;
  gl_FragColor = vec4(c, 1.0);
#endif
  #include <fog_fragment>
}`;

const CHAN = { r: [1, 0, 0, 0], g: [0, 1, 0, 0], b: [0, 0, 1, 0] };

// The sheet's material (its uniforms the frame never writes: the instances
// carry what changes)
function sheetMaterial({ texture, ramp, mode, channel, fog, grid, additive }) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: mode === 'sprite' ? { SPRITE: '' } : mode === 'decal' ? { DECAL: '' } : mode === 'decal-colour' ? { DECAL_COLOUR: '' } : {},
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uGrid: { value: new THREE.Vector2(...grid) }, uChan: { value: new THREE.Vector4(...CHAN[channel]) }, uHasRamp: { value: ramp ? 1 : 0 }, uRampV: { value: ramp?.userData.look?.rampV ?? 0.5 } }]),
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    fog,
    // (a mark sits on what it marks, not in it)
    polygonOffset: !additive,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    side: THREE.DoubleSide,
  });
  // (set after the merge: a texture is not cloned)
  mat.uniforms.uMap = { value: texture };
  mat.uniforms.uRamp = { value: ramp };
  return mat;
}

export const createSheetFx = (parent, opts) => createSheetFxWith(sheetMaterial, parent, opts);
