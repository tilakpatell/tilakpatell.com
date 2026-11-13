// Rock: one material for every rock on the universe map (the belt, the rim
// at the map's edge, the meteors, deep space's streams), so they read as
// stone up close and not as painted lumps. On `high` and `mid` its surface
// is pitted by 3D noise in the rock's own space (each instance its own
// stretch of it): the pits darker than the instance's colour and a little
// rougher, and the light catching their edges (a bump from the noise's
// slope on the screen, faded out where a pit is under a pixel, so a far
// rock doesn't sparkle). `low` keeps the flat-shaded material it always had.
//
// Close in, finer scales come in over the pits as each grows past a couple
// of pixels: cracks (thin dark lines where a finer noise crosses nought,
// their edges catching the light) and a grit over everything, so a rock
// the ship flies past reads as broken stone, not a blotched lump.
//
// rockMaterial({ tier, scale }) → a MeshStandardMaterial in two tones (the
//   instance's colour and its pits')
//   (`scale`: how many pits across a rock a unit wide, times four)
// ROCK_RELIEF: { value: 1 }, every rock's relief at once (the pace's step 3
//   sets it to 0: the pits go flat, no shader is made again)
// rockHook(material, { tier, scale }) → the material: the same pits
//   on a rock material of your own, after any hook already on it (deep
//   space's tumbling streams)
// rock(seed, { craters }) → a lumpy rock's geometry, about a unit across;
//   with `craters`, a boulder: rounder, smooth, eight craters pressed in

import * as THREE from 'three';
import { NOISE } from './noiseGlsl';

// a deterministic "random", so a rock is the same every visit
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a lumpy rock: an icosphere with its points pushed in and out by a few
// waves, squashed a little; a boulder (`craters`) is finer, its points
// shared so it's smooth, with eight craters pressed in, each with a rim
export function rock(seed, { craters = false } = {}) {
  const rand = rng(seed);
  let g = new THREE.IcosahedronGeometry(1, craters ? 2 : 1);
  if (craters) {
    // (the faces' copies of a point made one, so it shades smooth)
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeByPosition(g);
  }
  const pos = g.attributes.position;
  const waves = Array.from({ length: 5 }, () => [new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), 1.5 + rand() * 3.5, rand() * 6, 0.06 + rand() * 0.1]);
  const v = new THREE.Vector3();
  const squash = new THREE.Vector3(1, 0.65 + rand() * 0.3, 0.8 + rand() * 0.25);
  const pits = craters ? Array.from({ length: 8 }, () => [new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(), 0.3 + rand() * 0.3, 0.08 + rand() * 0.07]) : [];
  // the same point on every face that shares it moves the same way
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let k = 1;
    for (const [dir, f, ph, amp] of waves) k += Math.sin(v.dot(dir) * f + ph) * (craters ? amp * 0.5 : amp);
    if (!craters) k -= Math.max(0, v.dot(waves[0][0]) - 0.6) * 0.5; // a flat, broken side
    for (const [dir, a, depth] of pits) {
      const d = Math.acos(Math.min(1, Math.max(-1, v.dot(dir))));
      if (d < a) k -= depth * (1 - (d / a) ** 2);
      k += depth * 0.35 * Math.exp(-(((d - a) / (0.3 * a)) ** 2)); // its rim
    }
    v.multiplyScalar(k).multiply(craters ? squash.set(1, 0.85, 0.92) : squash);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// one copy of each point, the faces indexed into them
function mergeByPosition(g) {
  const pos = g.attributes.position;
  const keys = new Map();
  const out = [];
  const index = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let k = keys.get(key);
    if (k === undefined) {
      k = out.length / 3;
      keys.set(key, k);
      out.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    }
    index.push(k);
  }
  g.dispose();
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  m.setIndex(index);
  return m;
}

const VERT_PARS = /* glsl */ `
varying vec3 vRockObj;
varying float vRockSize;`;
// where on the noise: the rock's own space, each instance moved along it
// by where it is, so no two rocks of a shape are pitted the same
// (and how big the rock is in the world, so the pits' slope is the same at any size)
const VERT = /* glsl */ `
vRockObj = position;
vRockSize = length(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
#ifdef USE_INSTANCING
vRockObj += instanceMatrix[3].xyz * 0.37;
vRockSize = length(mat3(modelMatrix) * mat3(instanceMatrix) * vec3(1.0, 0.0, 0.0));
#endif`;

const FRAG_PARS = /* glsl */ `
varying vec3 vRockObj;
varying float vRockSize;
uniform float uRockScale;
uniform float uRockRelief;
${NOISE}
float rockPits(vec3 p) {
  return noise(p * uRockScale) * 0.7 + noise(p * uRockScale * 2.7 + 11.0) * 0.3;
}`;

export const ROCK_RELIEF = { value: 1 };

export function rockMaterial({ tier = 'high', scale = 1 } = {}) {
  return rockHook(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0.05, flatShading: true, envMapIntensity: 0.4 }), { tier, scale });
}

export function rockHook(mat, { tier = 'high', scale = 1 } = {}) {
  if (tier === 'low') return mat;
  // (the pits shade it: its faces needn't be flat to read as rock)
  mat.flatShading = false;
  const u = { uRockScale: { value: 4 * scale }, uSeed: { value: new THREE.Vector3(17, 3, 41) }, uRockRelief: ROCK_RELIEF };
  mat.userData.rock = u;
  const prev = Object.hasOwn(mat, 'onBeforeCompile') ? mat.onBeforeCompile : null;
  const prevKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey : null;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    // (where it's drawn from, whatever an earlier hook made of begin_vertex)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${VERT_PARS}`).replace('#include <project_vertex>', `${VERT}\n#include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_PARS}`)
      // the pits: darker, as far as they're fine enough on the screen to
      // show (none where one's under a pixel)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float rockH = rockPits(vRockObj);
        float rockPx = length(fwidth(vRockObj)) * uRockScale;
        float rockPit = smoothstep(0.05, -0.45, rockH);
        float rockShow = smoothstep(0.6, 0.2, rockPx) * uRockRelief;
        diffuseColor.rgb *= 1.0 - 0.45 * rockPit * (0.4 + 0.6 * rockShow);
        // finer still, each only once it's a couple of pixels on the screen:
        // cracks (where a finer noise crosses nought: thin dark lines) and grit
        float rockFine = smoothstep(0.6, 0.2, rockPx * 3.1) * uRockRelief;
        float rockGrain = smoothstep(0.6, 0.2, rockPx * 8.3) * uRockRelief;
        float rockN1 = rockFine > 0.0 ? noise(vRockObj * uRockScale * 3.1 + 23.0) : 0.5;
        // (a crack only in patches, never a net over the whole rock; drawn at
        // least a pixel wide by its own slope on the screen, and fainter as
        // it's thinner than that, so it never breaks up into dots)
        float rockLine = max(0.06, fwidth(rockN1) * 1.5);
        float rockPatch = rockFine > 0.0 ? smoothstep(0.15, 0.55, noise(vRockObj * uRockScale * 1.3 + 71.0)) : 0.0;
        float rockCrack = (1.0 - smoothstep(0.0, rockLine, abs(rockN1))) * (0.06 / rockLine) * rockPatch * rockFine;
        float rockGrit = rockGrain > 0.0 ? noise(vRockObj * uRockScale * 8.3 + 47.0) * rockGrain : 0.0;
        diffuseColor.rgb *= (1.0 - 0.3 * rockCrack) * (1.0 + 0.08 * rockN1 * rockFine) * (1.0 + 0.16 * rockGrit);`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = min(1.0, roughnessFactor + 0.05 * rockPit + 0.04 * rockCrack);')
      // the light catching the pits' edges: a bump from the noise's slope
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          // (each scale's height by its size, so its slope is the same at any)
          float h = (rockH * 0.6 * rockShow + (rockN1 * 0.22 * rockFine - rockCrack * 0.3) / 3.1 + rockGrit * 0.14 / 8.3) * vRockSize / uRockScale;
          vec3 sx = dFdx(-vViewPosition);
          vec3 sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal);
          vec3 r2 = cross(normal, sx);
          float det = dot(sx, r1);
          vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
          normal = normalize(abs(det) * normal - grad);
        }`,
      );
  };
  mat.customProgramCacheKey = () => `rock${prevKey ? `-${prevKey.call(mat)}` : ''}`;
  return mat;
}
