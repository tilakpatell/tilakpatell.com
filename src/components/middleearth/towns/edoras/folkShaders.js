// The host of Rohan's materials (./folk.js makes the host): the Riders'
// gallop and their colours, and the banners' wave, as GLSL patches on
// Lambert materials for the classic renderer; aRig and the uniforms are
// ./folk.js's (its "the host of Rohan" says what each holds).
// ../../nodes/towns/edoras/folkShaders.js is the same on the node renderer.

import * as THREE from "three";

const RIG_HEAD = /* glsl */ `
uniform float uTime;
uniform float uRide;
uniform float uCyc;
uniform float uReach;
uniform float uFlut;
uniform vec3 uCoat[6];
uniform vec3 uMane[6];
uniform vec3 uCloak[5];
uniform vec3 uPlume[5];
attribute vec4 aRig;
float hostSeed() {
#ifdef USE_INSTANCING
  return fract(sin(dot(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), vec2(12.9898, 78.233))) * 43758.5453);
#else
  return 0.37;
#endif
}
vec2 hostTurn(vec2 p, vec2 c, float a) {
  vec2 q = p - c;
  float cs = cos(a);
  float sn = sin(a);
  return c + vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs);
}
`;
const RIG_MOVE = /* glsl */ `
{
  float seed = hostSeed();
  float cyc = uCyc + seed * 7.0;
  float ride = smoothstep(0.0, 0.35, uRide);
  if (aRig.x > 0.5) {
    float off = aRig.x - 1.0;
    transformed.xy = hostTurn(transformed.xy, aRig.yz, ride * 0.62 * uReach * sin((cyc + off) * 6.2831853));
  }
  transformed.xy = hostTurn(transformed.xy, vec2(0.0, 1.3), ride * 0.07 * sin((cyc + 0.2) * 6.2831853));
  transformed.y += ride * (abs(sin((cyc + 0.1) * 3.14159265)) * 0.14 - 0.05);
}
`;
const RIG_PAINT = /* glsl */ `
{
  float seed = hostSeed();
  int p = int(aRig.w + 0.5);
  int c = int(fract(seed * 7.31) * 5.999);
  if (p == 1) vColor.xyz *= uCoat[c];
  else if (p == 3) vColor.xyz *= uMane[c];
  else if (p == 2) vColor.xyz *= uCloak[int(fract(seed * 3.71) * 4.999)];
  else if (p == 4) vColor.xyz *= uPlume[int(fract(seed * 11.3) * 4.999)];
}
`;
export function hostMaterial(uniforms) {
  const m = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + RIG_HEAD)
      .replace(
        "#include <color_vertex>",
        "#include <color_vertex>\n" + RIG_PAINT,
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + RIG_MOVE,
      );
  };
  m.customProgramCacheKey = () => "edoras-host";
  return m;
}
// The banner's cloth waves (aRig.y how far out from the pole); with `bob`,
// it rocks and rises with its rider, as the host does.
export function bannerMaterial(uniforms, bob) {
  const m = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + RIG_HEAD)
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
{
  float u = aRig.y;
  float seed = hostSeed();
  float w = 0.35 + 0.65 * smoothstep(0.0, 0.6, uRide);
  transformed.z += sin(uFlut - u * 4.0 + seed * 6.0) * 0.16 * u * w;
  transformed.y += sin(uTime * 2.1 - u * 3.0 + seed * 3.0) * 0.05 * u * w;
  transformed.x += (cos(uTime * 3.0 - u * 4.0) * 0.04 - 0.03) * u * w;
}
${bob ? RIG_MOVE : ""}`,
      );
  };
  m.customProgramCacheKey = () => (bob ? "edoras-banner-bob" : "edoras-banner");
  return m;
}
