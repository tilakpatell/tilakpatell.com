// ../../../towns/bree/sceneShaders.js on the node renderer: the Nazgûl’s
// sight, its GLSL line for line in TSL. The uniforms keep the GLSL’s names
// on `material.uniforms` (uniform nodes, so the scene’s `.value` writes
// land); a fresh node material a Rider, as each had its own ShaderMaterial.
// A ShaderMaterial’s defaults kept: no fog, and no tone mapping, the GLSL
// having no chunk for it.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, abs, atan, attribute, dot, floor, fract, length, mix, pow, sin, smoothstep, uniform, varying, vec2, vec4 } from 'three/tsl';

const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');

// The `i`th Rider’s sight, as far and as wide as NAZGUL says; the scene
// writes uTime and uOpacity.
export function sightMaterial(NAZGUL, i) {
  const uniforms = {
    uColor: uniform(new THREE.Color(0x8aa0d8)),
    uOpacity: uniform(0.3),
    uTime: uniform(0),
    uSight: uniform(NAZGUL.sight),
    uCone: uniform(NAZGUL.cone),
    uSeed: uniform(i * 3.7),
  };
  const u = uniforms;
  const m = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
  });
  const vP = varying(attribute('local', 'vec2'), 'vP');
  const r = length(vP).div(u.uSight);
  const a = abs(atan(vP.y.negate(), vP.x)).div(u.uCone);
  const edge = smoothstep(0.62, 1.12, a).oneMinus();
  const reach = pow(smoothstep(0, 1, r).oneMinus(), 1.4).mul(smoothstep(0, 0.08, r));
  const q = vP.mul(0.55).add(vec2(u.uTime.mul(0.35).add(u.uSeed), u.uTime.mul(-0.22)));
  const mist = noise(q)
    .mul(noise(q.mul(2.3).add(4.1)))
    .mul(0.45)
    .add(0.55);
  const ripple = sin(r.mul(22).sub(u.uTime.mul(3)))
    .mul(0.15)
    .add(0.85);
  const alpha = edge.mul(reach).mul(mist).mul(ripple).mul(u.uOpacity);
  m.colorNode = vec4(u.uColor.mul(r.oneMinus().mul(0.5).add(0.7)), alpha);
  m.uniforms = uniforms;
  return m;
}
