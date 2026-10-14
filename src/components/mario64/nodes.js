// The Mario 64 tribute’s own shaders on the node renderer (lane P1, the
// port of /dot-matrix/64 by lane T’s method): the terrain’s splat, the
// paintings’ ripple and the waterfall’s streaks, each the twin of the GLSL
// one in ./glsl.js (scene.js’s and things.js’s, as they were) with the same
// flags, the same uniforms under the same names and the same arithmetic,
// so the castle draws the same picture on WebGPU and WebGL 2. The look’s
// chain is ./looks.js.
//
//   splatMaterial(mats, small) → Promise<MeshStandardNodeMaterial>, its
//     uniforms on .uniforms (uMap1 … uRockScale, each a node whose value
//     is the GLSL one’s)
//   paintingMaterial(art) → { material, uniforms: { uRipple, uTime } }
//   waterfallMaterial() → { material, uniforms: { uTime } }
//   (things.js writes the uniforms’ .value each frame, as it did the GLSL ones’)

import * as THREE from 'three';
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, attribute, clamp, exp, fract, length, materialReference, max, modelWorldMatrix, normalGeometry, normalMap, output, positionLocal, positionWorld, pow, sin, smoothstep, texture, uniform, uv, varying, vec3, vec4 } from 'three/tsl';
import { loadSet } from '../avengers/hq/assets';
import { SCALE } from './courses/index';
import { MATS } from './textures';

const S = 0.01; // metres a game unit: scene.js’s S (the test holds the two together)

// a texture uniform read at a coordinate of its own, as GLSL’s texture2D(t,
// uv): no texture transform on it, and a value written to the uniform still
// reaching it
const at = (t, coord) => t.sample(coord).setUpdateMatrix(false);

// The terrain's material: three sets blended by the splat attribute (the
// GLSL one’s map_fragment, normal, roughness and ao chunks swapped for the
// blend). The first is the base, at the kit’s uv; the second (rock) is
// projected on three planes by the normal, so cliffs aren't stretched; the
// third is at its own scale. Each map’s uv is the mesh’s: the GLSL reads
// vMapUv, vNormalMapUv… through each map’s transform, and loadSet’s sets are
// never tiled (avengers/hq/assets’ pbr() tiles its own clones), so those
// transforms are all the identity.
export async function splatMaterial(mats, small) {
  const sets = await Promise.all(mats.map((k) => loadSet(MATS[k]?.set, { small })));
  const tint = mats.map((k) => new THREE.Color(MATS[k]?.tint ?? '#ffffff').multiplyScalar(MATS[k]?.boost ?? 1));
  const base = sets[0];
  const m = new MeshStandardNodeMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  if (!base || !sets[1] || !sets[2]) {
    m.color = tint[0];
    return m;
  }
  m.map = base.map;
  m.normalMap = base.normalMap;
  m.roughnessMap = base.arm;
  m.aoMap = base.arm;
  const s0 = SCALE[mats[0]] ?? 500;
  const u = {
    uMap1: texture(sets[1].map),
    uMap2: texture(sets[2].map),
    uNrm1: texture(sets[1].normalMap),
    uNrm2: texture(sets[2].normalMap),
    uArm1: texture(sets[1].arm),
    uArm2: texture(sets[2].arm),
    uTint0: uniform(tint[0]),
    uTint1: uniform(tint[1]),
    uTint2: uniform(tint[2]),
    uS1: uniform(s0 / (SCALE[mats[1]] ?? 500)),
    uS2: uniform(s0 / (SCALE[mats[2]] ?? 500)),
    uRockScale: uniform(1 / ((SCALE[mats[1]] ?? 600) * S)),
  };
  m.uniforms = u;

  const vUv = uv();
  const vSplat = attribute('splat', 'vec3');
  // (the GLSL’s varyings: the world position of the vertex, and its normal
  // turned by the model matrix alone, normalised at the vertex)
  const vWPos = positionWorld;
  const vWNrm = varying(normalGeometry.transformDirection(modelWorldMatrix));
  // tri(t): the texture on the three planes, weighted by the normal to the
  // fourth power, so a slope takes the plane it most faces
  const w4 = pow(abs(vWNrm), vec3(4));
  const w = w4.div(w4.x.add(w4.y).add(w4.z));
  const p = vWPos.mul(u.uRockScale);
  const tri = (t) => at(t, p.zy).mul(w.x).add(at(t, p.xz).mul(w.y)).add(at(t, p.xy).mul(w.z));

  const c0 = texture(base.map, vUv).mul(vec4(u.uTint0, 1));
  const c1 = tri(u.uMap1).mul(vec4(u.uTint1, 1));
  const c2 = at(u.uMap2, vUv.mul(u.uS2)).mul(vec4(u.uTint2, 1));
  // the rock shows through where the splat says, sharpened by the texture's own light and dark
  const sw0 = vec3(vSplat.x, clamp(vSplat.y.mul(c1.g.mul(0.6).add(0.7)), 0, 1), vSplat.z);
  const sw = sw0.div(max(0.001, sw0.x.add(sw0.y).add(sw0.z)));
  // (diffuseColor is vec4(color, opacity) before the GLSL multiplies it by
  // the blend; the node material multiplies the opacity in after)
  m.colorNode = vec4(materialReference('color', 'color'), 1).mul(c0.mul(sw.x).add(c1.mul(sw.y)).add(c2.mul(sw.z)));
  // the three normal maps blended before they are unpacked, then the
  // material's normal scale and the tangent frame from the uv’s
  // derivatives, as normal_fragment_maps does with no tangents
  const nrm = texture(base.normalMap, vUv).xyz.mul(sw.x).add(at(u.uNrm1, vUv.mul(u.uS1)).xyz.mul(sw.y)).add(at(u.uNrm2, vUv.mul(u.uS2)).xyz.mul(sw.z));
  m.normalNode = normalMap(nrm, materialReference('normalScale', 'vec2'));
  // the packed maps: roughness from green, ambient occlusion from red
  const arm = texture(base.arm, vUv).mul(sw.x).add(tri(u.uArm1).mul(sw.y)).add(at(u.uArm2, vUv.mul(u.uS2)).mul(sw.z));
  m.roughnessNode = materialReference('roughness', 'float').mul(arm.g);
  m.aoNode = arm.r.sub(1).mul(materialReference('aoMapIntensity', 'float')).add(1);
  return m;
}

// a painting's canvas, rippling out from its middle when he jumps in (the
// GLSL one’s begin_vertex: the plane pushed along its own z)
export function paintingMaterial(art) {
  const material = art ? new MeshStandardNodeMaterial({ map: art, roughness: 0.7 }) : new MeshStandardNodeMaterial({ color: '#7fb0e0' });
  const uniforms = { uRipple: uniform(0), uTime: uniform(0) };
  const d = length(positionLocal.xy);
  const push = uniforms.uRipple.mul(0.12).mul(sin(d.mul(9).sub(uniforms.uTime.mul(10)))).mul(exp(d.mul(-0.6)));
  material.positionNode = positionLocal.add(vec3(0, 0, push));
  return { material, uniforms };
}

// the waterfall's sheet: glassy water with bright streaks running down it.
// The GLSL adds them after dithering_fragment, so after the fog and in the
// linear colour the composer's render pass takes, before the bloom and the
// tone mapping; here that is the material's output, after its fog, which
// the chain's render pass takes the same way.
export function waterfallMaterial() {
  const material = new MeshPhysicalNodeMaterial({ color: '#cfeeff', roughness: 0.1, transmission: 0.4, transparent: true, opacity: 0.75, emissive: '#7fc8ff', emissiveIntensity: 0.15 });
  const uniforms = { uTime: uniform(0) };
  const vUv2 = uv();
  const streak = sin(vUv2.x.mul(80)).mul(0.5).add(0.5);
  const flow = fract(vUv2.y.mul(3).add(uniforms.uTime.mul(1.6)).add(streak.mul(0.3)));
  material.outputNode = output.add(vec4(vec3(0.25).mul(smoothstep(0.7, 1, flow)).mul(streak), 0));
  return { material, uniforms };
}
