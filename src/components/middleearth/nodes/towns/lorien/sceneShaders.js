// ../../../towns/lorien/sceneShaders.js on the node renderer: the streams’
// and the river’s water, its GLSL line for line in TSL. uTime and uFlow are
// its own uniform nodes on `material.uniforms`, written by the scene as
// before; the sky, the deep, the sun and its colour follow the town’s
// water’s { value }s, which the sky writes. Fog is the scene’s, as
// fog_fragment’s was; no tone mapping, the GLSL having no chunk for it.

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, cameraPosition, dot, floor, fract, max, min, mix, modelViewMatrix, modelWorldMatrix, normalize, positionGeometry, pow, reflect, sin, smoothstep, uniform, varying, vec2, vec3, vec4 } from 'three/tsl';
import { follow, wrap } from '../../../../../lib/three/hookNodes';

const hash = Fn(([p]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453)), 'float');
const noise = Fn(([p]) => {
  const i = floor(p);
  const f0 = fract(p);
  const f = f0.mul(f0).mul(f0.mul(-2).add(3));
  return mix(mix(hash(i), hash(i.add(vec2(1, 0))), f.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), f.x), f.y);
}, 'float');

// Water: a slow ripple and the sky in it; `flow` runs it along +x.
export function waterMaterial(water, flow = 0) {
  const uniforms = { uTime: uniform(0), uFlow: uniform(flow) };
  for (const k of ['uSky', 'uDeep', 'uSun', 'uSunColor']) uniforms[k] = follow(water.uniforms[k]);
  const u = uniforms;
  const m = new MeshBasicNodeMaterial({ fog: true, toneMapped: false });
  // (the GLSL’s vertex: the plane’s own position, nothing else moving it)
  wrap(m, 'setupPositionView', () => modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz, 'lorien:water');
  const vWorld = varying(modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz, 'vWorld');
  const p = vWorld.xz.mul(0.35).sub(vec2(u.uTime.mul(u.uFlow), 0));
  const n = noise(p.add(u.uTime.mul(0.06)))
    .mul(0.5)
    .add(noise(p.mul(2.3).sub(u.uTime.mul(0.09))).mul(0.5));
  const nrm = normalize(vec3(n.sub(0.5).mul(0.3), 1, noise(p.mul(1.6).add(3)).sub(0.5).mul(0.3)));
  const view = normalize(cameraPosition.sub(vWorld));
  const fres = pow(max(dot(nrm, view), 0).oneMinus(), 3);
  const col = mix(u.uDeep, u.uSky, fres.mul(0.7).add(0.25)).add(u.uSunColor.mul(pow(max(dot(reflect(normalize(u.uSun).negate(), nrm), view), 0), 90)).mul(1.6));
  // a little white where it runs fast
  m.colorNode = col.add(
    vec3(0.8)
      .mul(smoothstep(0.82, 0.95, noise(p.mul(4).sub(u.uTime.mul(u.uFlow).mul(0.5)))))
      .mul(min(u.uFlow, 1))
      .mul(0.25),
  );
  m.uniforms = uniforms;
  return m;
}
