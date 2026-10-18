// The Central Finite Curve, drawn: the Rick and Morty sector's edge
// (layout.js's SECTORS.rickmorty), where the ship's turned back (ship.js),
// as a faint luminous wall round the whole sector. The edge is a ball, so
// the wall is one too, seen from inside: a thin bright band round it at the
// disc's height, a soft glow either side of it, and its threads (the Curve's
// walled-off dimensions) short faint strands across the band, drifting
// slowly along it. Far off it's a ring on the horizon; close, it shimmers.
// The ball is as coarse as can be up and down: two rows, the old open
// cylinder's 512 triangles, round the same 256 ways. The band sits on its
// middle row, right on the edge; above and below, the rows lean in to the
// poles, but the glow is measured by height, not by the rows, and fades out
// within about 1,500 of the disc, so the coarse caps draw nothing anyone sees.
// Space scenery, so shaders only. Drawn only while the camera's inside the
// sector: from the main map it's nothing (and the far side of the portal
// is a long way off, but not past the far plane from all of the map).
//
// createCurve(parent) → { update(t, here), dispose() }

import * as THREE from 'three';
import { SECTORS } from './layout';
import { DEEP } from './deep';

// how far up or down the wall the height runs from 0 to 1 (the old
// cylinder's half-height, so the band and the glow are as thick as they were)
const HALF = (DEEP.ceiling * 1.3).toFixed(1);

const VERT = 'varying vec2 vUv; varying vec3 vPos; void main() { vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const FRAG = `
uniform float uTime;
varying vec2 vUv;
varying vec3 vPos;
float hash(float n) { return fract(sin(n) * 43758.5453); }
void main() {
  // round the wall (u, 0…1) and up it (h, 0 at the disc, ±1 HALF above or below it)
  float u = vUv.x;
  float h = vPos.y / ${HALF};
  // the glow: faint, at the disc's height, gone well before floor and ceiling
  float glow = exp(-h * h * 9.0) * 0.06;
  // the band round its middle: a thin bright line in a soft halo
  float band = exp(-pow(h * 40.0, 2.0)) * 0.3 + exp(-pow(h * 10.0, 2.0)) * 0.05;
  // the threads: short strands across the band, each its own height, a few
  // lit at a time and drifting along at their own pace; their edges a pixel
  // wide whatever the distance, and gone where they'd be only a few pixels
  // apart (far off, where they'd just flicker)
  float threads = 0.0;
  for (int i = 0; i < 2; i++) {
    float f = float(i);
    float s = u * (90.0 + f * 53.0) + uTime * (0.003 + f * 0.002);
    float id = floor(s);
    float w = fwidth(s);
    float line = 1.0 - smoothstep(0.0, max(w * 1.2, 0.02), abs(fract(s) - 0.5));
    float on = step(0.8, hash(id + f * 31.0)) * (0.5 + 0.5 * sin(uTime * (0.4 + hash(id) * 0.8) + id));
    float tall = 0.12 + 0.22 * hash(id + 7.0);
    threads += line * on * exp(-pow(h / tall, 2.0)) * (1.0 - smoothstep(0.08, 0.3, w)) * 0.16;
  }
  float a = glow + band + threads;
  vec3 col = mix(vec3(0.35, 1.0, 0.55), vec3(0.85, 1.0, 0.9), clamp(band * 2.0 + threads * 3.0, 0.0, 1.0));
  gl_FragColor = vec4(col * a, a);
}`;

export function createCurve(parent) {
  const sec = SECTORS.rickmorty;
  const geo = new THREE.SphereGeometry(sec.edge, 256, 2);
  const uTime = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const wall = new THREE.Mesh(geo, mat);
  wall.name = 'central-finite-curve';
  wall.position.set(...sec.origin);
  wall.renderOrder = -1;
  parent.add(wall);
  return {
    update(t, here) {
      wall.visible = here;
      uTime.value = t;
    },
    dispose() {
      parent.remove(wall);
      geo.dispose();
      mat.dispose();
    },
  };
}
