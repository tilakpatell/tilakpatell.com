// A close-up layer for the worlds' models. A model's own maps are made to
// be seen whole: a 40 m hall on one 2K map is a few texels a hand's width,
// and up close it smears. So the models that want it (a catalogue entry's
// `detail`: 'stone', 'adobe', 'metal'…) wear one of the kit's photo-scanned
// surfaces (public/cc0/galaxy/, the same the built props wear) over their
// own, laid on in the world, not the model's UVs: projected from the three
// axes and blended by which way the surface faces (triplanar), at the
// scan's real size, so a wall shows the grain and joints of real stone
// whatever its UVs, at any scale it's placed. The scan's colour, centred on
// 1, darkens and lightens the model's own (a stain stays a stain); its
// normal map adds the relief on top of the model's.
//
//   withDetail(material, { map, normalMap }, { metres, strength, normal, mean })
//     metres:   how much world one repeat of the scan covers
//     strength: how much of the scan's colour comes through (0…1)
//     normal:   how strong its relief is
//     mean:     the scan's mean brightness, sRGB (scripts/galaxy-textures.mjs
//               centres them there)
// Once per material (the clones of a model share theirs). Lit materials only.

const VERT_HEAD = /* glsl */ `
varying vec3 vDetailPos;
varying vec3 vDetailNormal;
`;
const VERT_BODY = /* glsl */ `
vec4 detailWorld = vec4(transformed, 1.0);
vec3 detailN = objectNormal;
#ifdef USE_INSTANCING
detailWorld = instanceMatrix * detailWorld;
detailN = mat3(instanceMatrix) * detailN;
#endif
detailWorld = modelMatrix * detailWorld;
vDetailPos = detailWorld.xyz;
vDetailNormal = normalize(mat3(modelMatrix) * detailN);
`;
const FRAG_HEAD = /* glsl */ `
uniform sampler2D detailMap;
uniform sampler2D detailNormal;
uniform float detailScale;
uniform float detailStrength;
uniform float detailNormalStrength;
uniform float detailMean;
varying vec3 vDetailPos;
varying vec3 vDetailNormal;
vec3 detailWeights(vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  return w / (w.x + w.y + w.z);
}
`;
const FRAG_COLOUR = /* glsl */ `
{
  vec3 dw = detailWeights(normalize(vDetailNormal));
  vec3 dp = vDetailPos * detailScale;
  vec3 dc = texture2D(detailMap, dp.zy).rgb * dw.x + texture2D(detailMap, dp.xz).rgb * dw.y + texture2D(detailMap, dp.xy).rgb * dw.z;
  diffuseColor.rgb *= mix(vec3(1.0), dc / detailMean, detailStrength);
}
`;
// (the relief: each axis's tangent-space normal swizzled into the world and
// blended the way Ben Golus's "UDN" triplanar does, then added to the
// model's own view-space normal as a change from the surface's)
const FRAG_NORMAL = /* glsl */ `
{
  vec3 nw = normalize(vDetailNormal);
  vec3 dw = detailWeights(nw);
  vec3 dp = vDetailPos * detailScale;
  vec3 tx = texture2D(detailNormal, dp.zy).xyz * 2.0 - 1.0;
  vec3 ty = texture2D(detailNormal, dp.xz).xyz * 2.0 - 1.0;
  vec3 tz = texture2D(detailNormal, dp.xy).xyz * 2.0 - 1.0;
  tx = vec3(tx.xy * detailNormalStrength + nw.zy, nw.x);
  ty = vec3(ty.xy * detailNormalStrength + nw.xz, nw.y);
  tz = vec3(tz.xy * detailNormalStrength + nw.xy, nw.z);
  vec3 dn = normalize(tx.zyx * dw.x + ty.xzy * dw.y + tz.xyz * dw.z);
  vec3 shift = (viewMatrix * vec4(dn - nw, 0.0)).xyz;
  normal = normalize(normal + shift * faceDirection);
}
`;

export function withDetail(material, scan, { metres = 2, strength = 0.55, normal = 0.8, mean = 0.8 } = {}) {
  if (!material?.isMeshStandardMaterial || !scan?.map || material.userData.detail) return material;
  const uniforms = {
    detailMap: { value: scan.map },
    detailNormal: { value: scan.normalMap ?? null },
    detailScale: { value: 1 / metres },
    detailStrength: { value: strength },
    detailNormalStrength: { value: scan.normalMap ? normal : 0 },
    // (the map is read decoded to linear: its sRGB mean, linear)
    detailMean: { value: mean ** 2.2 },
  };
  material.userData.detail = uniforms;
  const before = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    before?.call(material, shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>${VERT_HEAD}`).replace('#include <project_vertex>', `#include <project_vertex>${VERT_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_HEAD}`)
      .replace('#include <map_fragment>', `#include <map_fragment>${FRAG_COLOUR}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${scan.normalMap ? FRAG_NORMAL : ''}`);
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${key()}|detail${scan.normalMap ? 'n' : ''}`;
  material.needsUpdate = true;
  return material;
}
