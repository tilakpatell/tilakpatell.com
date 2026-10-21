// ../../../towns/moria/sceneShaders.js on the node renderer: the lake, its
// GLSL line for line in TSL. uTime and uStir are its own uniform nodes on
// `material.uniforms`, written by the scene as before; the sky, the deep,
// the sun and its colour follow the town’s water’s { value }s, which the
// sky writes. Fog is the scene’s, as fog_fragment’s was; no tone mapping,
// the GLSL having no chunk for it.

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, dot, floor, fract, length, max, mix, modelViewMatrix, modelWorldMatrix, normalize, positionGeometry, pow, reflect, sin, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import { follow, wrap } from '../../../../../lib/three/hookNodes';

const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');

// The lake: black and still, the moon on it; its sky, deep, sun and sun's
// colour the town's water's own (`water.uniforms`, which the sky writes)
export function lakeMaterial(water) {
  const uniforms = { uTime: uniform(0), uStir: uniform(0) };
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) uniforms[k] = follow(water.uniforms[k]);
  const u = uniforms;
  const lakeMat = new MeshBasicNodeMaterial({ fog: true, toneMapped: false });
  // (the GLSL’s vertex: the plane’s own position, nothing else moving it)
  wrap(lakeMat, 'setupPositionView', () => modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz, 'moria:lake');
  const vWorld = varying(modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz, 'vWorld');
  // still, but for slow rings; stirred when the Watcher wakes
  const p = vWorld.xz.mul(0.4);
  const n = noise(p.add(u.uTime.mul(0.05)))
    .mul(0.5)
    .add(noise(p.mul(2.7).sub(u.uTime.mul(0.08))).mul(0.5));
  const rip = sin(
    length(vWorld.xz.sub(vec2(4, 10)))
      .mul(3)
      .sub(u.uTime.mul(2)),
  )
    .mul(u.uStir)
    .mul(0.5);
  const stir = u.uStir.mul(0.5).add(0.12);
  const nrm = normalize(vec3(n.sub(0.5).mul(stir).add(rip.mul(0.1)), 1, noise(p.mul(1.7).add(3)).sub(0.5).mul(stir)));
  const view = normalize(cameraPosition.sub(vWorld));
  const fres = pow(max(dot(nrm, view), 0).oneMinus(), 4);
  lakeMat.colorNode = mix(u.uDeep, u.uSky, fres.mul(0.8)).add(u.uSunColor.mul(pow(max(dot(reflect(normalize(u.uSun).negate(), nrm), view), 0), 160)).mul(3));
  lakeMat.uniforms = uniforms;
  return lakeMat;
}
