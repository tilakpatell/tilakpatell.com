// ../../../towns/amonhen/sceneShaders.js on the node renderer: the lake, the
// GLSL line for line in TSL. uTime is a uniform node on `material.uniforms`,
// written by the scene as before; the sky’s water colours are the scene’s
// own { value } holders, shared back in as the original shares them, and
// read every frame (follow).
//
// The lake takes the scene’s fog (fog: true); its GLSL had no tone-mapping
// chunk, so it is not tone mapped (toneMapped: false).

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, dot, floor, fract, max, mix, modelWorldMatrix, normalize, positionGeometry, pow, reflect, sin, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import { follow } from '../../../../../lib/three/hookNodes';

const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');

export function lakeMaterial(water) {
  const SHARED = ['uSky', 'uDeep', 'uSun', 'uSunColor'];
  const uniforms = { uTime: uniform(0) };
  for (const k of SHARED) uniforms[k] = water.uniforms[k];
  const u = { ...uniforms };
  for (const k of SHARED) u[k] = follow(water.uniforms[k]);
  const lakeMat = new MeshBasicNodeMaterial({ fog: true, toneMapped: false });
  const vWorld = varying(modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz, 'vWorld');
  lakeMat.colorNode = Fn(() => {
    const p = vWorld.xz.mul(0.3);
    const n = noise(p.add(u.uTime.mul(0.07)))
      .mul(0.5)
      .add(noise(p.mul(2.4).sub(u.uTime.mul(0.1))).mul(0.5));
    const nrm = normalize(vec3(n.sub(0.5).mul(0.28), 1, noise(p.mul(1.7).add(3)).sub(0.5).mul(0.28)));
    const view = normalize(cameraPosition.sub(vWorld));
    const fres = pow(max(dot(nrm, view), 0).oneMinus(), 3);
    const col = mix(u.uDeep, u.uSky, fres.mul(0.75).add(0.2));
    return col.add(u.uSunColor.mul(pow(max(dot(reflect(normalize(u.uSun).negate(), nrm), view), 0), 120)).mul(2));
  })();
  lakeMat.uniforms = uniforms;
  return lakeMat;
}
