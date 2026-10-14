// The flight's own two shaders on the node renderer (lane P1, the port of
// /fly by lane T's method): the sky dome and the city's lit windows, each
// the GLSL one's twin (scene.js's skyDome, ground.js's cityMaterial) with
// the same flags, the same uniforms under the same names and the same
// arithmetic, so the flight draws the same picture on WebGPU and WebGL 2.
// The GLSL ones stay for the parity check (scripts/twin-parity) and their
// tests.
//
//   skyDome(low, high) → the dome (a Mesh): material.uniforms { uLow, uHigh }
//     (occurrenceScene tints the sky through them, each a uniform node whose
//     value is the THREE.Color)
//   cityMaterial(colour) → a standard node material, 'flight-city'

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, clamp, dot, floor, fract, fwidth, materialColor, max, mix, normalWorld, normalize, positionLocal, positionWorld, select, smoothstep, step, uniform, varying, vec2, vec3 } from 'three/tsl';

const SKY_R = 40000; // m: as scene.js's

// the sky: the horizon colour below, a gradient to the zenith above. The
// direction is the vertex's, carried to the pixel unnormalised, as the GLSL
// dome's varying is; its colour goes out with no tone mapping, as the GLSL
// one has no tone-mapping chunk
export function skyDome(low, high) {
  const uLow = uniform(new THREE.Color(low));
  const uHigh = uniform(new THREE.Color(high));
  const material = new MeshBasicNodeMaterial({ side: THREE.BackSide, depthWrite: false, fog: false });
  material.toneMapped = false;
  const dir = varying(normalize(positionLocal));
  material.colorNode = mix(uLow, uHigh, smoothstep(-0.02, 0.45, dir.y));
  material.uniforms = { uLow, uHigh };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY_R, 32, 16), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return mesh;
}

// ground.js's hash, as nodes
const cityHash = (p) => {
  const a = fract(p.mul(vec2(123.34, 456.21))).toVar();
  a.addAssign(dot(a, a.add(45.32)));
  return fract(a.x.mul(a.y));
};

// A city's facades: lit windows read from where a face is in the world, so
// every tower's windows are 4 × 3.5 m however tall it is scaled, and about a
// third of them lit, warm, at the city's dusk (ground.js's cityMaterial)
export function cityMaterial(colour) {
  const m = new MeshStandardNodeMaterial({ color: colour, roughness: 0.7, metalness: 0.15 });
  m.name = 'flight-city';
  const w = positionWorld;
  const n = normalWorld;
  const lot = floor(w.xz.div(150));
  // each tower its own stone: a tint by the lot it stands on
  const tint = mix(vec3(0.82, 0.8, 0.84), vec3(1.18, 1.12, 1.04), cityHash(lot.add(7.3)));
  // floors 3.5 m apart, panes 4 m wide, lit in runs along a floor (an
  // office lit, the next dark); where a pane is smaller than a pixel the
  // pattern gives way to its average, so a far tower glows evenly
  const side = abs(n.y).oneMinus();
  const u = select(abs(n.x).greaterThan(0.5), w.z, w.x);
  const cell = vec2(u.div(4), w.y.div(3.5));
  const f = fract(cell);
  const pane = step(0.14, f.x).mul(step(f.x, 0.86)).mul(step(0.25, f.y)).mul(step(f.y, 0.8));
  const run = cityHash(vec2(floor(cell.x.div(6)), floor(cell.y)).add(lot));
  const lit = step(0.72, run).mul(step(0.25, cityHash(floor(cell))));
  const near = clamp(max(fwidth(cell.x), fwidth(cell.y)).mul(2).oneMinus().add(0.6), 0, 1);
  const glow = mix(0.13, pane.mul(lit), near);
  m.colorNode = materialColor.mul(tint).mul(pane.mul(side).mul(0.25).mul(near).oneMinus());
  m.emissiveNode = vec3(1, 0.74, 0.46).mul(glow).mul(side).mul(1.4);
  return m;
}
