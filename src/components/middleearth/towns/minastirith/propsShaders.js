// Minas Tirith’s shaders, out of ./props.js and as they were there: the
// banners’ sway and the instanced houses’ fronts and roofs, each a patch on
// a standard material that returns it (the kit uses what it returns).
// ../../nodes/towns/minastirith/propsShaders.js is its twin on the node
// renderer, the same names.

// Banners sway: each vertex moves along the cloth's normal, more the further
// it is from the bar it hangs on (aWave: how far down, a phase, how much).
export function swayBanner(mat, U) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aWave;\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float wk = aWave.x;
      float wv = sin(uTime * 1.9 + aWave.y + wk * 2.6) * 0.65 + sin(uTime * 3.7 + aWave.y * 1.7 + wk * 5.2) * 0.25;
      transformed += objectNormal * wv * wk * aWave.z;`,
    );
  };
  mat.customProgramCacheKey = () => 'minas-banner';
  return mat;
}

// The houses, instanced: each a unit box scaled to its size, with offsets in
// metres on top (cornice, parapet, chimney, gables keep their own size). The
// shader paints the front from the atlas by the metre: bays across, storeys
// up, a door or a window or plain wall in each by the house's own dice, and
// lights some windows at night (the emissive map is the glass).
const HOUSE_GLSL = 'float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }';
export function houseShader(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec3 aOff;
        attribute float aPart;
        attribute float aSeed;
        attribute float aKind;
        varying vec3 vM;
        varying vec3 vSz;
        varying vec3 vLN;
        varying float vPart;
        flat varying float vSeed;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 hsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        transformed = position + aOff / hsc;
        bool hide = (aPart > 2.5 && aPart < 3.5 && aKind > 0.5) || (aPart > 4.5 && aKind < 0.5) || (aPart > 3.5 && aPart < 4.5 && fract(aSeed * 13.7) < 0.45);
        if (hide) transformed = vec3(0.0, 0.3, 0.0);
        vM = position * hsc + aOff;
        vSz = hsc;
        vLN = normal;
        vPart = aPart;
        vSeed = aSeed;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vM;
        varying vec3 vSz;
        varying vec3 vLN;
        varying float vPart;
        flat varying float vSeed;
        ${HOUSE_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `vec3 qAn = abs(vLN);
        vec2 qFm;
        float qFw;
        if (qAn.y > 0.5) { qFm = vM.xz; qFw = vSz.z; }
        else if (qAn.x > qAn.z) { qFm = vec2(vM.z, vM.y); qFw = vSz.z; }
        else { qFm = vec2(vM.x, vM.y); qFw = vSz.x; }
        float qNb = max(1.0, floor(qFw / 2.5 + 0.5));
        float qHTot = vSz.y - 0.34;
        float qSh = clamp(qHTot / max(1.0, floor(qHTot / 3.2 + 0.5)), 2.8, 3.6);
        float qNs = floor(qHTot / qSh + 0.01);
        vec2 qGq = vec2((qFm.x + qFw * 0.5) / (qFw / qNb), qFm.y / qSh);
        vec2 qCl = floor(qGq);
        vec2 qFr = fract(qGq);
        float qSide = qAn.x > qAn.z ? (vLN.x > 0.0 ? 0.0 : 2.0) : 1.0;
        float qSd = floor(vSeed * 997.0 + 0.5);
        float qHr = hh(qCl + vec2(qSd * 0.37, qSide * 11.0));
        float qRow = qCl.y < 0.5 ? 0.0 : 1.0;
        float qCol = 2.0;
        if (vPart < 0.5 && qAn.y < 0.5 && qCl.y < qNs) {
          if (qSide < 0.5) qCol = qRow < 0.5 ? (qHr < 0.42 ? 0.0 : qHr < 0.66 ? 1.0 : qHr < 0.84 ? 3.0 : 2.0) : (qHr < 0.4 ? 0.0 : qHr < 0.7 ? 1.0 : qHr < 0.88 ? 3.0 : 2.0);
          else qCol = qHr < 0.62 ? 2.0 : qRow < 0.5 ? 1.0 : (qHr < 0.82 ? 0.0 : 3.0);
        }
        vec2 qAuv = vec2((qCol + 0.004 + qFr.x * 0.992) / 4.0, (qRow + 0.004 + qFr.y * 0.992) / 2.0);
        vec2 qGd = qGq / vec2(4.0, 2.0);
        vec4 texelColor = textureGrad(map, qAuv, dFdx(qGd), dFdy(qGd));
        if (vPart > 0.5 && vPart < 1.5) texelColor.rgb *= 1.04;
        if (vPart > 1.5 && vPart < 2.5) texelColor.rgb *= vec3(0.56, 0.58, 0.62);
        if (vPart > 3.5 && vPart < 4.5) texelColor.rgb *= 0.9;
        texelColor.rgb *= 0.72 + 0.28 * smoothstep(0.0, 2.2, vM.y);
        diffuseColor *= texelColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `float qLit = step(0.6, hh(qCl * 1.7 + vec2(qSd * 0.53, 3.0))) * (qCol > 1.5 && qCol < 2.5 ? 0.0 : 1.0);
        totalEmissiveRadiance *= textureGrad(emissiveMap, qAuv, dFdx(qGd), dFdy(qGd)).r * qLit;`,
      );
  };
  mat.customProgramCacheKey = () => 'minas-house';
  return mat;
}

// The houses' pitched roofs: the same instancing, the slopes' normals put
// right for each house's own pitch, slates laid by the metre.
// (EAVE and RIDGE are the unit house’s, in metres: ./props.js builds the
// gables to them)
export function roofShader(mat, { EAVE, RIDGE }) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aOff;')
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
        vec3 hsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        if (abs(objectNormal.x) > 0.1 && abs(objectNormal.y) > 0.1) {
          objectNormal = normalize(vec3(sign(objectNormal.x) * ${RIDGE.toFixed(2)}, sign(objectNormal.y) * (hsc.x * 0.5 + ${EAVE.toFixed(2)}), 0.0)) * hsc;
        }`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed = position + aOff / hsc;
        vec3 rm = position * hsc + aOff;
        vMapUv = vec2(rm.z, abs(rm.x) * 1.16) / 2.6;
        #ifdef USE_NORMALMAP
        vNormalMapUv = vMapUv;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'minas-roof';
  return mat;
}
