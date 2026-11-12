// A generated nebula, drawn (the middle layer's wonders of kind 'nebula'):
// puffs scattered through a flattened ball `size` across, seeded, soft and
// additive. The rest of a sector is drawn by the endless space's parts:
// its stars a slot of the far layer (universe/farStars.js), its bodies
// discs (discs.js) and, near, whole (near.js); expanse.js puts it together.
// The nebulae are lane 1's (the endless universe's): its renderer, fixed in
// the world, replaces this one.
//
// nebula(w, made) → THREE.Points, its geometry and material pushed to `made`

import * as THREE from 'three';
import { rngOf } from '../gen/seed';

const NEBULA = '#b48cff';
const PUFFS = 48; // a nebula's

const PUFF_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / max(-mv.z, 1.0), 1.0, 512.0);
    vColor = aColor;
  }
`;
const PUFF_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord * 2.0 - 1.0);
    if (d > 1.0) discard;
    float a = (1.0 - d) * (1.0 - d);
    gl_FragColor = vec4(vColor * a * 0.35, 1.0);
  }
`;

// a nebula: puffs scattered through a flattened ball `size` across, seeded
export function nebula(w, made) {
  const rng = rngOf(w.seed);
  const pos = new Float32Array(PUFFS * 3);
  const size = new Float32Array(PUFFS);
  const col = new Float32Array(PUFFS * 3);
  const a = new THREE.Color(NEBULA);
  const b = new THREE.Color().setHSL(rng(), 0.7, 0.55);
  const c = new THREE.Color();
  for (let i = 0; i < PUFFS; i++) {
    const u = rng() * 2 - 1;
    const th = rng() * Math.PI * 2;
    const r = w.size * Math.cbrt(rng());
    const s = Math.sqrt(1 - u * u);
    pos.set([r * s * Math.cos(th), r * u * 0.4, r * s * Math.sin(th)], i * 3);
    size[i] = w.size * (0.3 + rng() * 0.4);
    c.copy(a).lerp(b, rng());
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    vertexShader: PUFF_VERT,
    fragmentShader: PUFF_FRAG,
    uniforms: { uScale: { value: 500 } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  const px = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    mat.uniforms.uScale.value = (renderer.getDrawingBufferSize(px).y / 2) * (camera.projectionMatrix.elements[5] || 1);
  };
  made.push(geo, mat);
  return points;
}
