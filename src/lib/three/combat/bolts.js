// The bolts drawn: one instanced mesh of thin additive streaks placed from
// lib/combat/bolt.js's pool each frame, and the flashes where they land.
// It draws what the pool says and decides nothing, so every world's bolts
// look the same and fly the same.
//
// createBoltMeshes(parent, { pool = 48, flashes = 12, look = 'game' }) →
// { sync(live), flash(at), update(dt), setLook({ burst, ramp }), dispose() };
// `live`: the pool's live() (each { pos, dir, flown, colour }); `at`: an
// [x, y, z] or anything with x, y, z.
//
// A flash is the 2017 game's burst where the bucket had it (lib/three/fx/
// gameLook's `impact`, its green the burst's rays, cooling along the game's
// black-body ramp), else a soft hot disc as it always was; all of them one
// instanced draw. `look: null` loads nothing (setLook hands one in).
//
// (The streaks and the flashes' pool are ./boltsCore.js's, shared with
// boltsNodes.js; the GLSL is this file's alone.)

import * as THREE from 'three';
import { CHAN, createBoltMeshesWith } from './boltsCore';

const FLASH_VERT = /* glsl */ `
attribute vec2 aFlash; // age 0…1, size
varying vec2 vUv;
varying float vAge;
void main() {
  vUv = uv;
  vAge = aFlash.x;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * aFlash.y;
  gl_Position = projectionMatrix * mv;
}`;
const FLASH_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uRamp;
uniform float uHasMap;
uniform float uHasRamp;
uniform float uRampV;
uniform vec4 uChan;
varying vec2 vUv;
varying float vAge;
void main() {
  float k = 1.0 - vAge;
  float r = length(vUv * 2.0 - 1.0);
  // the game's rays, or a soft disc (the sphere it was, seen from anywhere)
  float m = uHasMap > 0.5 ? dot(texture2D(uMap, vUv), uChan) * 1.6 : 1.0 - smoothstep(0.75, 1.0, r);
  vec3 hot = uHasRamp > 0.5 ? texture2D(uRamp, vec2(0.02 + 0.96 * k, uRampV)).rgb * 3.2 : vec3(1.0, 0.816, 0.627) * 3.0;
  gl_FragColor = vec4(hot * m * 0.6 * k, 1.0);
}`;

// the flashes' material: what setLook hands in goes in its uniforms
function flashMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: FLASH_VERT,
    fragmentShader: FLASH_FRAG,
    uniforms: { uMap: { value: null }, uRamp: { value: null }, uHasMap: { value: 0 }, uHasRamp: { value: 0 }, uRampV: { value: 0.5 }, uChan: { value: new THREE.Vector4(...CHAN.g) } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export const createBoltMeshes = (parent, opts) => createBoltMeshesWith(flashMaterial, parent, opts);
