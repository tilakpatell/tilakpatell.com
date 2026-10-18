// ../../../towns/rivendell/sceneShaders.js on the node renderer: the river,
// its GLSL line for line in TSL. uTime is its own uniform node on
// `material.uniforms`, written by the scene as before; the sky, the deep,
// the sun and its colour follow the town’s water’s { value }s, which the
// sky writes. Fog is the scene’s, as fog_fragment’s was; no tone mapping,
// the GLSL having no chunk for it.

import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  dot,
  floor,
  fract,
  max,
  mix,
  modelViewMatrix,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  pow,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { follow, wrap } from "../../../../../lib/three/hookNodes";

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

// The river in its gorge, flowing south, quick and white over the stones;
// its sky, deep, sun and sun’s colour the town’s water’s own
// (`water.uniforms`, which the sky writes)
export function riverMaterial(water) {
  const uniforms = { uTime: uniform(0) };
  for (const k of ["uSky", "uDeep", "uSun", "uSunColor"])
    uniforms[k] = follow(water.uniforms[k]);
  const u = uniforms;
  const riverMat = new MeshBasicNodeMaterial({ fog: true, toneMapped: false });
  // (the GLSL’s vertex: the strip’s own position, nothing else moving it)
  wrap(
    riverMat,
    "setupPositionView",
    () => modelViewMatrix.mul(vec4(positionGeometry, 1)).xyz,
    "rivendell:river",
  );
  const vWorld = varying(
    modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz,
    "vWorld",
  );
  // flowing south, quick and white over the stones
  const p = vec2(vWorld.x.mul(0.45), vWorld.z.mul(0.14).sub(u.uTime.mul(1.6)));
  const n = noise(p.mul(2))
    .mul(0.6)
    .add(noise(p.mul(5).add(3)).mul(0.4));
  const view = normalize(cameraPosition.sub(vWorld));
  const nrm = normalize(
    vec3(n.sub(0.5).mul(0.4), 1, noise(p.mul(3).add(7)).sub(0.5).mul(0.4)),
  );
  const fres = pow(max(dot(nrm, view), 0).oneMinus(), 3);
  const col = mix(u.uDeep, u.uSky, fres.mul(0.6).add(0.3)).add(
    u.uSunColor
      .mul(pow(max(dot(nrm, normalize(normalize(u.uSun).add(view))), 0), 90))
      .mul(1.6),
  );
  riverMat.colorNode = mix(
    col,
    vec3(0.92, 0.95, 1.0),
    smoothstep(0.66, 0.92, noise(p.mul(3.4).add(u.uTime.mul(0.5)))).mul(0.55),
  );
  riverMat.uniforms = uniforms;
  return riverMat;
}
