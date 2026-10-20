// What Mount Doom’s node twins share (./propsShaders.js, ./propsEyeAndCavern.js):
// the Shire’s seeded random, the kit’s shared { value }s as nodes, the fog
// held back, a card’s place in the view, and the points’ sprites.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, PointsNodeMaterial } from 'three/webgpu';
import { densityFogFactor, mix, rangeFogFactor, reference, renderGroup, smoothstep, texture, vec4 } from 'three/tsl';
import { follow, wrap } from '../../../../../lib/three/hookNodes';

export const TAU = Math.PI * 2;
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// shire/props.js’s seeded random, copied (that file holds GLSL): the bombs
// fall where they fell
export function rng(seed = 1) {
  let a = Math.imul(seed | 0, 0x9e3779b1) ^ 0x5bd1e995;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a falling smoothstep, as WGSL wants it: the rising one turned over
export const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

// The kit’s shared { value }s as nodes, one each (U, key): the clock and
// the eruption read every render, the noise and the puff their textures.
export const SHARED = new WeakMap();
export function shared(U, k) {
  let m = SHARED.get(U);
  if (!m) SHARED.set(U, (m = {}));
  if (!m[k]) m[k] = U[k].value?.isTexture ? texture(U[k].value) : follow(U[k]);
  return m[k];
}
export const sample = (node, at) => texture(node.value, at);

// The fog, but only so much of it (FOG_CAP): mixed toward the fog’s colour
// by its factor times the cap; ADD (FOG_ADD), for added light, faded to
// nothing instead. A material whose scene has no Fog or FogExp2 is left be.
export function capFog(material, cap, add, tag) {
  return wrap(
    material,
    'setupFog',
    (out, builder, outputNode) => {
      const f = builder.scene?.fog;
      if (!f || !builder.fogNode || !(f.isFog || f.isFogExp2)) return out;
      const factor = f.isFogExp2 ? densityFogFactor(reference('density', 'float', f).setGroup(renderGroup)) : rangeFogFactor(reference('near', 'float', f).setGroup(renderGroup), reference('far', 'float', f).setGroup(renderGroup));
      const k = factor.mul(cap);
      if (add) return vec4(outputNode.rgb.mul(k.oneMinus()), outputNode.a);
      const color = reference('color', 'color', f).setGroup(renderGroup);
      return vec4(mix(outputNode.rgb, color, k), outputNode.a);
    },
    tag,
    { cap },
  );
}

// the view-space place a card or quad is drawn at, as its vertex shader put it
export const placeAt = (material, fn, tag) => wrap(material, 'setupPositionView', fn, tag);

// A ShaderMaterial’s defaults on a node material: no fog unless asked, no
// tone map (the GLSL had no such chunk).
export const basic = (o) => new MeshBasicNodeMaterial({ fog: false, toneMapped: false, ...o });

// A point’s sprite material: the place and the seed are instance
// attributes of the cloud’s geometry (aPoint, aSeed), its size in pixels.
export const pointsMaterial = (o) =>
  new PointsNodeMaterial({
    fog: false,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: false,
    ...o,
  });

// One sprite for a cloud of points: the sprite’s quad, instanced once a
// point, its place and seed from the points’ own arrays.
export function pointSprite(material, pos, seeds, count) {
  const quad = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.getAttribute('position'));
  geo.setAttribute('uv', quad.getAttribute('uv'));
  geo.setAttribute('aPoint', new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = count;
  const s = new THREE.Sprite(material);
  s.geometry = geo;
  s.count = count;
  return s;
}
