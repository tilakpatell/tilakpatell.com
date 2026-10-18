// Edoras’s shaders, out of ./props.js and as they were there: the banners
// and the grass in the wind, `WIND` (and `ACROSS` it) the town’s. ../../
// nodes/towns/edoras/propsShaders.js is their twin on the node renderer,
// the same names; each returns the material it patched.

const F5 = (v) => v.toFixed(5);

// Banners in the wind: each vertex rides a wave running out from the pole,
// bigger the further out it is (aWave: how far out, a phase, how much, the
// cloth's length), the end dipping as the gusts slacken. The normal leans
// with the wave, so the folds catch the light.
export function windBanner(mat, U, WIND, ACROSS) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    const W = `vec3(${F5(WIND.x)}, 0.0, ${F5(WIND.z)})`;
    const A = `vec3(${F5(ACROSS.x)}, 0.0, ${F5(ACROSS.z)})`;
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute vec4 aWave;\nuniform float uTime;",
      )
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        float bk = aWave.x;
        float gust = 0.72 + 0.28 * sin(uTime * 0.83 + aWave.y) * sin(uTime * 0.37 + aWave.y * 2.1);
        float bs1 = uTime * 7.0 - bk * 8.5 + aWave.y;
        float bs2 = uTime * 12.0 - bk * 17.0 + aWave.y * 1.7;
        float bf = sin(bs1) * 0.7 + sin(bs2) * 0.22;
        float bw = bf * bk * aWave.z * gust;
        float bd = (bf + (-8.5 * 0.7 * cos(bs1) - 17.0 * 0.22 * cos(bs2)) * bk) * aWave.z * gust;
        objectNormal = normalize(objectNormal - ${W} * bd / aWave.w);`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        transformed += ${A} * bw;
        transformed -= ${W} * abs(bw) * 0.4;
        transformed.y += sin(bs1 * 0.8 + 1.3 + position.y * 0.6) * bk * aWave.z * 0.35 * gust;
        transformed.y -= bk * bk * aWave.w * 0.07 * (1.25 - gust);`,
      );
  };
  mat.customProgramCacheKey = () => "edoras-banner";
  return mat;
}
// Grass (instanced, unturned) bends with the wind, more at the tip, gusting.
export function windGrass(mat, U, WIND, k = 0.5) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 root = instanceMatrix[3].xyz;
      #else
        vec3 root = vec3(0.0);
      #endif
      float bend = position.y * position.y;
      float sway = 0.55 + 0.45 * sin(uTime * 2.3 + root.x * 0.21 + root.z * 0.13) * sin(uTime * 0.9 + root.x * 0.05);
      transformed.x += ${F5(WIND.x)} * bend * ${F5(k)} * (0.6 + sway);
      transformed.z += ${F5(WIND.z)} * bend * ${F5(k)} * (0.6 + sway);
      transformed.y -= bend * ${F5(k * 0.25)} * sway;`,
      );
  };
  mat.customProgramCacheKey = () => `edoras-grass${k}`;
  return mat;
}
