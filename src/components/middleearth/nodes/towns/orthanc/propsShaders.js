// ../../../towns/orthanc/propsShaders.js on the node renderer: the
// palantír’s glass and the tower’s glassy stone, line for line in TSL, the
// same names. The glass keeps its uniforms under the GLSL’s names on
// `material.uniforms` (uniform nodes, so the palantír’s `.value` writes
// land); it was tone mapped (its GLSL had the chunk), and fogless. The
// tower’s patch is a node hook that returns the node material, which the
// kit puts in its place.

import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  abs,
  atan,
  cameraViewMatrix,
  dot,
  exp,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  modelNormalMatrix,
  normalGeometry,
  normalView,
  normalize,
  positionView,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { asNode, onLight } from "../../../../../lib/three/hookNodes";

// a falling smoothstep, as WGSL wants it: the rising one turned over
const fall = (a, b, x) => smoothstep(b, a, x).oneMinus();

const hash = Fn(
  ([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)),
  "float",
);
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(
    mix(hash(i), hash(i.add(vec2(1, 0))), f.x),
    mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x),
    f.y,
  );
}, "float");
// (the GLSL’s four octaves, unrolled)
const fbm = Fn(([p0]) => {
  let p = p0;
  let s = float(0);
  let a = 0.5;
  for (let i = 0; i < 4; i++) {
    s = s.add(noise(p).mul(a));
    p = p.mul(2.07).add(3.1);
    a *= 0.5;
  }
  return s;
}, "float");

// The palantír’s glass: dark, a cold sheen at its rim, and deep inside a
// fire that wakes as you look (uWake) and, at the last, the Eye (uEye).
export function stoneMaterial() {
  const uniforms = {
    uTime: uniform(0),
    uWake: uniform(0),
    uEye: uniform(0),
    uFire: uniform(new THREE.Color(1.0, 0.36, 0.08)),
  };
  const u = uniforms;
  const m = new MeshBasicNodeMaterial({ fog: false });
  // (normalMatrix’s normal: three’s modelNormalMatrix is the world’s, so
  // the camera’s view takes it on)
  const vN = varying(
    cameraViewMatrix.mul(vec4(modelNormalMatrix.mul(normalGeometry), 0)).xyz,
    "vN",
  );
  const n = normalize(vN);
  const v = normalize(positionView.negate());
  const facing = max(dot(n, v), 0);
  const rim = pow(facing.oneMinus(), 3);
  // the fire, deep down: seen best looking straight in
  const q = n.xy;
  const r = length(q);
  const sw = fbm(
    vec2(
      atan(q.y, q.x).mul(1.6).add(u.uTime.mul(0.25)),
      r.mul(5).sub(u.uTime.mul(0.6)),
    ),
  );
  const fire = pow(sw, 2.2)
    .mul(pow(facing, 1.6))
    .mul(u.uWake.mul(2.6).add(0.18));
  // the Eye: a fiery iris round a slit, looking out at you
  const iris = fall(0.62, 0.2, r).mul(
    fbm(q.mul(9).add(u.uTime)).mul(0.4).add(0.6),
  );
  const slit = fall(
    0.07,
    0.02,
    abs(q.x).div(max(0.15, abs(q.y).mul(1.4).oneMinus())),
  ).mul(fall(0.62, 0.3, abs(q.y)));
  const col = vec3(0.006, 0.007, 0.01)
    .add(vec3(0.16, 0.18, 0.24).mul(rim))
    .add(u.uFire.mul(fire))
    .add(u.uFire.mul(3).mul(iris).mul(u.uEye).mul(slit.oneMinus()));
  m.colorNode = vec4(
    mix(col, vec3(0), slit.mul(u.uEye).mul(fall(0.62, 0.2, r))),
    1,
  );
  m.uniforms = uniforms;
  return m;
}

// Orthanc's black stone is glassy: its knife edges and facets catch the
// storm's grey light at a slant, and the pits' fire from below, low down
export function glassyStone(m) {
  const n = asNode(m);
  return onLight(
    n,
    (light) => {
      const towerUp = normalize(cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz);
      const towerFacing = dot(normalView, towerUp);
      const towerRim = pow(
        abs(dot(normalize(positionView.negate()), normalView)).oneMinus(),
        3,
      );
      // (on the walls and the edges, not the tops of the steps)
      return light
        .add(
          vec3(0.26, 0.3, 0.38)
            .mul(towerRim)
            .mul(max(0, towerFacing.add(0.3)).mul(0.55).add(0.45))
            .mul(smoothstep(0.55, 0.9, towerFacing).oneMinus()),
        )
        .add(
          vec3(0.55, 0.16, 0.04)
            .mul(max(0, towerFacing.negate()))
            .mul(exp(positionWorld.y.negate().div(34)))
            .mul(0.9),
        );
    },
    "orthanc-tower-stone",
  );
}
