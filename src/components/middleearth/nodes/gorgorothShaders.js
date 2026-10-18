// ../gorgorothShaders.js on the node renderer: the Eye, its beam and the
// pool it lights, in TSL line for line with the GLSL, their uniforms
// uniform nodes under the GLSL’s names on `material.uniforms` (the pool
// takes the beam’s, the same nodes, as it took the same objects), so
// Gorgoroth’s `.value` writes still land. The tone map and the output
// colour space are the renderer’s own, as the GLSL’s chunks were; a
// ShaderMaterial never took fog.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, abs, dot, exp, floor, fract, length, max, mix, normalViewGeometry, normalize, positionView, pow, sin, smoothstep, uniform, uv, varying, vec2, vec3 } from 'three/tsl';

const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');

const additive = (side = THREE.FrontSide) =>
  new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

export function eyeMaterial() {
  const uniforms = { uTime: uniform(0), uLook: uniform(0), uAnger: uniform(0) };
  const { uTime, uLook, uAnger } = uniforms;
  const mat = additive();
  const p = uv().sub(0.5).mul(vec2(2, 1));
  const lick = noise(vec2(p.x.mul(5), p.y.mul(6).sub(uTime.mul(2.2))))
    .mul(0.5)
    .add(noise(vec2(p.x.mul(11).add(3), p.y.mul(12).sub(uTime.mul(3.4)))).mul(0.25));
  const lid = pow(max(p.x.mul(p.x).mul(1.25).oneMinus(), 0), 0.75)
    .mul(0.3)
    .mul(lick.mul(0.4).add(0.85));
  const lens = smoothstep(0, 1, abs(p.y).div(lid.add(0.001))).oneMinus();
  const ph = p.mul(vec2(1, 2.2));
  const halo = exp(dot(ph, ph).negate().mul(3.2));
  const q = vec2(p.x.sub(uLook).div(0.05), p.y.div(0.25));
  mat.colorNode = mix(vec3(0.9, 0.12, 0.02), vec3(2.6, 1, 0.16), lens)
    .mul(lens)
    .add(vec3(3, 2.3, 1).mul(pow(lens, 3)))
    .add(
      mix(vec3(0.7, 0.16, 0.03), vec3(1.4, 0.1, 0.02), uAnger)
        .mul(halo)
        .mul(lick.mul(0.5).add(0.5)),
    )
    .mul(smoothstep(0.75, 1.15, dot(q, q)))
    .mul(uAnger.mul(0.8).add(1));
  mat.uniforms = uniforms;
  return mat;
}

// the beam: a cone of lit dust from the Eye to the road
export function beamMaterial() {
  const uniforms = {
    uColor: uniform(new THREE.Color(1.5, 0.75, 0.3)),
    uPower: uniform(1),
    uTime: uniform(0),
  };
  const mat = additive(THREE.DoubleSide);
  const vN = varying(normalViewGeometry, 'vN');
  const vV = varying(normalize(positionView.negate()), 'vV');
  const vUv = uv();
  const face = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
  const along = mix(0.5, 1, vUv.y).mul(smoothstep(0, 0.06, vUv.y));
  const dust = sin(vUv.y.mul(60).sub(uniforms.uTime.mul(3)).add(vUv.x.mul(12)))
    .mul(0.18)
    .add(0.82);
  mat.colorNode = uniforms.uColor.mul(face).mul(along).mul(dust).mul(uniforms.uPower).mul(0.12);
  mat.uniforms = uniforms;
  return mat;
}

// where the beam lands, sharing the beam's uniforms
export function poolMaterial(uniforms) {
  const mat = additive();
  const d = length(uv().sub(0.5)).mul(2);
  mat.colorNode = uniforms.uColor
    .mul(smoothstep(0.55, 1, d).oneMinus())
    .mul(uniforms.uPower)
    .mul(0.13);
  mat.uniforms = uniforms;
  return mat;
}
