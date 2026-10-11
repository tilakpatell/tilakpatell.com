// Foliage that reads as foliage, for nothing at run time: a canopy built of
// a dozen faceted blobs lights as a dozen flat things, and shimmers like
// broken glass as the camera moves; the same blobs with their normals
// pointing out from the middle of the whole crown light as one soft volume,
// the way a tree does (the trick studios do in Blender, a hull's normals
// transferred onto the cards; here it's a loop at build time). Light that
// wraps a little past a leaf's edge, and comes through from behind, keeps
// the shaded side of a crown from going flat. Wind is a few lines in the
// vertex shader, bending a tree from its foot by one clock, scaled where
// the model carries one by its own weight per vertex.
// (docs/research/2026-10-06-ground-grass-foliage-techniques.md, 2 and 7)
//
//   spherifyNormals(geometry, { centre, radii, keep })  normals out from an ellipsoid (pure)
//   liftNormals(geometry, { keep })                     normals turned up, as a lawn's (pure)
//   wrapLighting(material, { wrap, backScatter })       light past the terminator, and through
//   wind(material, { kind, time, dir, weight, ... })    a sway from the foot, a flutter in the leaves
//   faceless(material)                                  a two-sided card lit by its normal on both faces
//   wrapShader(shaders, opts, chunks), windShader(shaders, { weight })   the rewrites, as pure strings
//
// Call the material hooks before ones that look for three's lights chunks
// expanded (they expand the one they change).

import * as THREE from 'three';
export { liftNormals, spherifyNormals } from './foliageNormals';

// ── light that wraps ──

const DOT_LINE = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
const IRRADIANCE_LINE = 'vec3 irradiance = dotNL * directLight.color;';
const LIGHT_CHUNKS = ['lights_lambert_pars_fragment', 'lights_physical_pars_fragment'];

// The rewrite, as pure strings: the direct light's cosine wrapped past the
// terminator by uWrap, and a little of the light from behind let through
// (uBackScatter), in whichever of three's lights chunks the shader uses.
// Only the diffuse light wraps: the cosine three's own lines go on with is
// left as it is, the wrapped light's extra added to the diffuse after it
// (a standard material's specular, fed a wrapped cosine where the true one
// is nought, blows up at a grazing angle: a leaf seen edge on goes white).
export function wrapShader({ vertexShader, fragmentShader }, opts, chunks = THREE.ShaderChunk) {
  let fs = fragmentShader;
  let wrap = false;
  for (const name of LIGHT_CHUNKS) {
    const include = `#include <${name}>`;
    const src = chunks[name];
    if (!fs.includes(include) || typeof src !== 'string' || !src.includes(DOT_LINE) || !src.includes(IRRADIANCE_LINE)) continue;
    const out = src.replace(
      IRRADIANCE_LINE,
      `${IRRADIANCE_LINE}
	// (light past the terminator, the diffuse's alone)
	float dotNLWrap = saturate( ( dot( geometryNormal, directLight.direction ) + uWrap ) / ( 1.0 + uWrap ) );
	reflectedLight.directDiffuse += ( dotNLWrap - dotNL ) * directLight.color * BRDF_Lambert( material.diffuseColor );
	// (light from behind, through the leaves)
	reflectedLight.directDiffuse += uBackScatter * saturate( dot( - geometryNormal, directLight.direction ) ) * directLight.color * BRDF_Lambert( material.diffuseColor );`,
    );
    fs = fs.replace(include, out);
    wrap = true;
  }
  if (wrap) fs = fs.replace('#include <common>', '#include <common>\nuniform float uWrap;\nuniform float uBackScatter;');
  return { vertexShader, fragmentShader: fs, swapped: { wrap } };
}

export function wrapLighting(material, { wrap = 0.5, backScatter = 0.25 } = {}) {
  if (!material || material.userData.wrap) return material;
  const uniforms = { uWrap: { value: wrap }, uBackScatter: { value: backScatter } };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    const out = wrapShader(sh);
    sh.fragmentShader = out.fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|wrap`;
  material.userData.wrap = uniforms;
  material.needsUpdate = true;
  return material;
}

// ── both faces as one ──

// A double-sided card's back face has its normal turned round, so a crown
// whose cards point their normals out from the middle lights as tiles,
// half of them in shadow whichever way the sun is. Left as it is, both
// faces light by the crown's normal: the trick only works with it.
export function facelessShader({ vertexShader, fragmentShader }, chunks = THREE.ShaderChunk) {
  const include = '#include <normal_fragment_begin>';
  const src = chunks.normal_fragment_begin;
  if (!fragmentShader.includes(include) || typeof src !== 'string' || !src.includes('normal *= faceDirection;')) return { vertexShader, fragmentShader, swapped: { faceless: false } };
  return { vertexShader, fragmentShader: fragmentShader.replace(include, src.replace('normal *= faceDirection;', '')), swapped: { faceless: true } };
}

export function faceless(material) {
  if (!material || material.userData.faceless) return material;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    sh.fragmentShader = facelessShader(sh).fragmentShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|faceless`;
  material.userData.faceless = true;
  material.needsUpdate = true;
  return material;
}

// ── the wind ──

// How each kind moves: `height` the height (in the geometry's own metres)
// the bend reaches full strength at, `strength` how far the top goes, the
// trunk's slow sway and the leaves' quick flutter in Hz, and the flutter's size.
export const WIND = {
  tree: { height: 7, strength: 0.16, trunkHz: 0.45, leafHz: 2.6, leaf: 0.025 },
  shrub: { height: 1.3, strength: 0.05, trunkHz: 0.8, leafHz: 3.4, leaf: 0.012 },
};

// A weight is an attribute's name, written into the shader as it stands: a
// GLSL name or nothing.
const GLSL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
function checkWeight(weight) {
  if (weight != null && (typeof weight !== 'string' || !GLSL_NAME.test(weight))) throw new TypeError(`wind: weight must be an attribute's GLSL name, not ${JSON.stringify(weight)}`);
}

// The rewrite, as pure strings: after three's begin_vertex, the vertex moved
// along the wind by the square of its height (Crysis's main bending, short
// of keeping its length: at these sizes the stretch is a millimetre), in a
// phase from where the instance stands, plus a flutter by where the vertex is.
// `weight` names a float attribute the bend and the flutter are both scaled
// by (a kit tree's own, 0 at the foot of its trunk, 1 in its crown); without
// one, the shader is the one it always was.
export function windShader({ vertexShader, fragmentShader }, { weight = null } = {}) {
  checkWeight(weight);
  if (!vertexShader.includes('#include <begin_vertex>')) return { vertexShader, fragmentShader, swapped: { wind: false } };
  const decl = ['uWindTime', 'uWindStrength', 'uWindHeight', 'uWindTrunk', 'uWindLeaf', 'uWindLeafAmp'].map((u) => `uniform float ${u};`);
  decl.push('uniform vec2 uWindDir;');
  // (declared once: the shader may have the attribute already)
  if (weight && !vertexShader.includes(`attribute float ${weight};`)) decl.push(`attribute float ${weight};`);
  const w = weight ? ` * ${weight}` : '';
  const vs = vertexShader.replace('#include <common>', `#include <common>\n${decl.join('\n')}`).replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    {
      vec3 wBase = vec3(0.0);
      vec2 wDir = uWindDir;
      #ifdef USE_INSTANCING
        wBase = instanceMatrix[3].xyz;
        // (the wind blows one way across the world: turned into the instance's own frame)
        wDir = normalize((transpose(mat3(instanceMatrix)) * vec3(uWindDir.x, 0.0, uWindDir.y)).xz + 1e-5);
      #endif
      wBase = (modelMatrix * vec4(wBase, 1.0)).xyz;
      float wPhase = dot(wBase.xz, vec2(0.071, 0.113));
      float wH = clamp(transformed.y / uWindHeight, 0.0, 1.0);
      float wBend = wH * wH${w};
      float wT = uWindTime * uWindTrunk * 6.2832 + wPhase;
      float wSway = 0.6 + 0.4 * sin(wT) + 0.25 * sin(wT * 2.3 + 1.7);
      float wFlutter = sin(uWindTime * uWindLeaf * 6.2832 + dot(transformed, vec3(3.1, 1.7, 2.3)) + wPhase) * uWindLeafAmp * wH${w};
      transformed.xz += wDir * (wSway * uWindStrength * wBend) + vec2(wFlutter, -wFlutter * 0.7);
    }`,
  );
  return { vertexShader: vs, fragmentShader, swapped: { wind: true } };
}

// A material that sways: `kind` 'tree' or 'shrub' (WIND's numbers, any of
// them overridden here), `time` a { value } shared by everything in the wind
// (seconds; hold it still for reduced motion), `dir` where it blows to,
// `weight` the name of a per-vertex attribute that scales it (as the
// geometry has it: three's loader lower-cases a GLB's _WIND to _wind).
export function wind(material, { kind = 'tree', time = { value: 0 }, dir = new THREE.Vector2(0.8, 0.6), weight = null, ...over } = {}) {
  checkWeight(weight);
  if (!material || material.userData.wind) return material;
  const k = { ...(WIND[kind] ?? WIND.tree), ...over };
  const uniforms = {
    uWindTime: time,
    uWindStrength: { value: k.strength },
    uWindHeight: { value: k.height },
    uWindTrunk: { value: k.trunkHz },
    uWindLeaf: { value: k.leafHz },
    uWindLeafAmp: { value: k.leaf },
    uWindDir: { value: dir.clone().normalize() },
  };
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    before?.call(material, sh, r);
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = windShader(sh, { weight }).vertexShader;
  };
  const key = material.customProgramCacheKey;
  material.customProgramCacheKey = () => `${key ? key.call(material) : ''}|wind${weight ? `|w:${weight}` : ''}`;
  material.userData.wind = uniforms;
  material.needsUpdate = true;
  return material;
}
