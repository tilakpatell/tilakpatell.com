// What a crowd of still copies is painted with, wherever it stands: each
// copy's geometry stood on the floor at its height (`standing`), and its
// breath in the vertex shader (`breathing`, `BREATH`). The Citadel's crowd
// (../citadel/crowd.js) was first; the dimensions' crowds
// (../world/dimensions/crowd.js) stand on the same.

import * as THREE from 'three';

// a figure's geometry in the world, standing on the floor at `height`
// metres, centred over its feet. The baked copies are quantized (positions
// as normalized Int16 in -1…1, the node's matrix holding the real size),
// so every attribute is decoded to floats first: moved in place, a point
// past 1 would wrap round to the other end.
export function standing(geometry, matrix, height) {
  const geo = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(geometry.attributes)) {
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (geometry.index) geo.setIndex(geometry.index.clone());
  geo.applyMatrix4(matrix);
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const k = height / (b.max.y - b.min.y);
  return geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2).scale(k, k, k);
}

// A still copy's breath, in its vertex shader: the chest and shoulders
// rising and falling a little (a breath every three and a half to four and
// a half seconds), each copy in a time of its own from where it stands.
// `clock` is shared ({ value }: seconds); `tall`, the copy's height.
export const BREATH = /* glsl */ `
#ifdef USE_INSTANCING
{
  vec2 crowdAt = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  float crowdSeed = fract(sin(dot(crowdAt, vec2(12.9898, 78.233))) * 43758.5453);
  float crowdUp = clamp(position.y / crowdTall, 0.0, 1.0);
  float crowdChest = smoothstep(0.45, 0.78, crowdUp);
  float crowdBreath = sin(crowdTime * 6.2832 / (3.4 + crowdSeed) + crowdSeed * 6.2832);
  transformed.xz *= 1.0 + 0.014 * crowdBreath * crowdChest;
  transformed.y += 0.007 * crowdBreath * crowdChest * crowdTall;
}
#endif
`;
export function breathing(mat, clock, tall) {
  mat.onBeforeCompile = (s) => {
    s.uniforms.crowdTime = clock;
    s.uniforms.crowdTall = { value: tall };
    s.vertexShader = s.vertexShader.replace('void main() {', 'uniform float crowdTime;\nuniform float crowdTall;\nvoid main() {').replace('#include <begin_vertex>', `#include <begin_vertex>\n${BREATH}`);
  };
  mat.customProgramCacheKey = () => 'crowd-breath';
  return mat;
}
