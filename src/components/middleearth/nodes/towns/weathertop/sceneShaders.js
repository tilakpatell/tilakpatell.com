// ../../../towns/weathertop/sceneShaders.js on the node renderer: the river
// at the ford, the GLSL line for line in TSL. uTime and uFlood are uniform
// nodes on `material.uniforms`, written by the scene as before; the sky’s
// water colours are the scene’s own { value } holders, shared back in as
// the original shares them, and read every frame (follow).
//
// The river takes the scene’s fog (fog: true); its GLSL had no tone-mapping
// chunk, so it is not tone mapped (toneMapped: false).

import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  dot,
  float,
  floor,
  fract,
  max,
  mix,
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

export function riverMaterial(water) {
  const SHARED = ["uSky", "uDeep", "uSun", "uSunColor"];
  const uniforms = { uTime: uniform(0), uFlood: uniform(0) };
  for (const k of SHARED) uniforms[k] = water.uniforms[k];
  const u = { ...uniforms };
  for (const k of SHARED) u[k] = follow(water.uniforms[k]);
  const riverMat = new MeshBasicNodeMaterial({
    fog: true,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const vWorld = varying(
    modelWorldMatrix.mul(vec4(positionGeometry, 1)).xyz,
    "vWorld",
  );
  riverMat.colorNode = Fn(() => {
    // it flows across the road, to +z; faster and whiter in the flood
    const speed = u.uFlood.mul(5).add(1.2);
    const p = vec2(
      vWorld.x.mul(0.35),
      vWorld.z.mul(0.12).sub(u.uTime.mul(speed)),
    );
    const n = noise(p.mul(2))
      .mul(0.6)
      .add(noise(p.mul(5.3).add(3.1)).mul(0.4));
    const view = normalize(cameraPosition.sub(vWorld));
    const nrm = normalize(
      vec3(
        n.sub(0.5).mul(0.35),
        1,
        noise(p.mul(3.1).add(7)).sub(0.5).mul(0.35),
      ),
    );
    const fres = pow(max(dot(nrm, view), 0).oneMinus(), 3);
    const col = mix(u.uDeep, u.uSky, fres.mul(0.65).add(0.35)).toVar();
    const h = normalize(normalize(u.uSun).add(view));
    col.addAssign(u.uSunColor.mul(pow(max(dot(nrm, h), 0), 120)).mul(2.4));
    // foam over the stones of the ford, and all of it in the flood
    const foam = smoothstep(
      u.uFlood.mul(-0.5).add(0.62),
      0.9,
      noise(p.mul(3.7).add(u.uTime.mul(0.6))),
    );
    return mix(
      col,
      vec3(0.9, 0.97, 1.08),
      foam.mul(u.uFlood.mul(0.45).add(0.3)),
    );
  })();
  riverMat.opacityNode = float(0.86);
  riverMat.uniforms = uniforms;
  return riverMat;
}
