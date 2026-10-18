// ../../../towns/marshes/sceneShaders.js on the node renderer: the marsh’s
// black water, its GLSL line for line in TSL. uTime is its own uniform node
// on `material.uniforms`, written by the scene as before; the sky and the
// deep follow the town’s water’s { value }s, which the sky writes. Fog is
// the scene’s, as fog_fragment’s was; no tone mapping, the GLSL having no
// chunk for it.

import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  dot,
  floor,
  fract,
  max,
  mix,
  normalize,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { follow } from "../../../../../lib/three/hookNodes";

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

// The marsh’s water: black, still, a film of scum, the sky dull in it; its
// sky and deep the town’s water’s own (`water.uniforms`, which the sky writes)
export function marshMaterial(water) {
  const uniforms = { uTime: uniform(0) };
  for (const k of ["uSky", "uDeep"]) uniforms[k] = follow(water.uniforms[k]);
  const u = uniforms;
  const marshMat = new MeshBasicNodeMaterial({ fog: true, toneMapped: false });
  const vWorld = positionWorld;
  const p = vWorld.xz.mul(0.25);
  const n = noise(p.add(u.uTime.mul(0.02)))
    .mul(0.6)
    .add(noise(p.mul(3.1)).mul(0.4));
  const view = normalize(cameraPosition.sub(vWorld));
  const fres = pow(max(view.y, 0).oneMinus(), 3);
  const col = mix(u.uDeep, u.uSky, fres.mul(0.55).add(0.15));
  marshMat.colorNode = vec4(
    mix(col, vec3(0.16, 0.18, 0.1), smoothstep(0.55, 0.8, n).mul(0.5)),
    1,
  );
  marshMat.uniforms = uniforms;
  return marshMat;
}
