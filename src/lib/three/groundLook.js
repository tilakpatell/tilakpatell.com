// A world's ground, shaded: a material for any land mesh (the galaxy's
// surfaces' height grid, the flight's leaves), coloured by a shader
// that reads the site's palette by height and slope (sand in the hollows,
// paler on the crests, rock on the cliffs, snow on the tops), broken up by
// noise at three sizes so no stretch of it repeats, with ripples in the
// light across it (wind-blown sand, wind-scoured snow) and grain close up.
// It takes the scene's light, shadows and fog like anything else (it's a
// MeshStandardMaterial underneath). `marks` is a texture over the walkable
// square that tints where something's been (the dark under a footprint,
// footprints in the snow): the scene paints into it.
//
// palette: { low, high, rock, accent, deep? } colours; hLow, hHigh: the
// heights low gives way to high between; rock: the slope (0 flat … 1 a
// wall) rock starts at; accent: how much of the accent there is (0…1) in
// patches; ripple: { strength, scale, wind }; grain: 0…1; sparkle: 0…1
// (snow, salt); wet: { level, color } darkening the ground near the water.
//
// Up close, the ground wears a photo-scanned surface (public/cc0/galaxy/,
// kit.js's scans: sand, snow, grass, a pine floor, leaf litter, mud, ash,
// red soil, gravel, a beach: ./scans.js), by the site's `ground.detail` (a role) and
// `ground.detailLook` ({ color, normal, metres, near, far }): its detail
// colour map laid over the palette's colour and its normal map tilting the
// light, at the scan's real size, fading out between `near` and `far`
// metres so the far ground stays the shader's own. Not on the low tier.
//
// At ultra (`splat`, amounts.js's), the ground is layered (splat.js's
// scans): the site's scan at two sizes turned against each other (so no
// tile repeats), a second scan in broad patches, rock wrapped round the
// slopes from the three axes, small blotches of a fourth, all reaching
// further out (never stretched down a cliff: the flat-laid scans give way
// to the wrapped rock there); and it's wet by the water and in the hollows (darker,
// smoother, catching the light). Its own program (SPLAT): high's is as it was.

// Moved down from galaxy/surface/ground.js, unchanged, so the flight's
// planets wear the walkable surfaces' own ground; `half` is the walkable
// square's half-width the marks cover (the surface's HALF, 640 m).
//
//   groundMaterial(site, { small, map, splat, half }) → { material, uniforms }

import * as THREE from 'three';
import { noiseTexture } from './noiseTex';
import { loadScan, scanOf } from './scans';
import { splatOf } from './splat';
import { detailLevel } from '../detail';
import { GROUND_GLSL } from './groundmap';

// (noise read from noiseTex.js's tile, at a few scales, rather than worked out)
const NOISE = `
uniform sampler2D uNoise;
float gHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec4 gTex(vec2 p) { return texture2D(uNoise, p); }
`;

export function groundMaterial(site, { small = false, map = null, splat: layered = false, half = 640 } = {}) {
  const g = site.ground;
  const p = g.palette;
  const col = (c, fallback) => new THREE.Color(c ?? fallback);
  const uniforms = {
    uLow: { value: col(p.low) },
    uHigh: { value: col(p.high, p.low) },
    uRock: { value: col(p.rock, p.low) },
    uAccent: { value: col(p.accent, p.high ?? p.low) },
    uDeep: { value: col(p.deep, p.low) },
    uHeights: { value: new THREE.Vector4(p.hLow ?? 0, p.hHigh ?? 30, p.rockAt ?? 0.42, p.accentCover ?? 0) },
    uRipple: { value: new THREE.Vector4(p.ripple?.strength ?? 0, p.ripple?.scale ?? 2.4, Math.cos(p.ripple?.wind ?? g.wind ?? 0), Math.sin(p.ripple?.wind ?? g.wind ?? 0)) },
    uGrain: { value: new THREE.Vector3(p.grain ?? 0.5, small ? 0 : (p.sparkle ?? 0), p.patch ?? 0.5) },
    uWet: { value: new THREE.Vector4(p.wet?.level ?? -1e4, p.wet?.band ?? 1.5, 0, 0) },
    uWetColor: { value: col(p.wet?.color, '#000000') },
    uMarks: { value: null },
    uMarkColor: { value: col(p.mark, '#000000') },
    uHalf: { value: half },
    // (where the square lies: the origin, or round you in the free roam, galaxy/surface/roam.js)
    uCentre: { value: new THREE.Vector2() },
    uNoise: { value: noiseTexture() },
    // the scan underfoot: its maps, repeats a metre, how strongly its colour
    // and its normal show, where it fades (near, far), and the linear
    // brightness its detail map is centred on (set when it's loaded)
    uScan: { value: null },
    uScanN: { value: null },
    uScanK: { value: new THREE.Vector4(0.5, 0, 0, 0.5) },
    uScanFade: { value: new THREE.Vector2(28, 90) },
    // the layered ground's (ultra): each layer's 1 / metres and its mean
    // (linear), and how strong the patches, the blotches and the wet
    // hollows are, w: all of them loaded
    uMacro: { value: null },
    uSteep: { value: null },
    uSteepN: { value: null },
    uDecal: { value: null },
    uLayerK: { value: [new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0.5, 0.5), new THREE.Vector2(0.5, 0.5)] },
    uSplatK: { value: new THREE.Vector4(0.6, 0.75, 0.6, 0) },
  };
  const look = g.detailLook ?? {};
  const scan = g.detail && !small && detailLevel() !== 'low' ? scanOf(g.detail) : null;
  if (scan) {
    uniforms.uScanFade.value.set(look.near ?? 28, look.far ?? 90);
    loadScan(g.detail).then((got) => {
      if (!got) return;
      uniforms.uScan.value = got.map;
      uniforms.uScanN.value = got.normalMap;
      const metres = look.metres ?? scan.metres ?? 2;
      uniforms.uScanK.value.set(1 / metres, look.color ?? 0.75, got.normalMap ? (look.normal ?? 0.7) : 0, Math.pow(scan.mean ?? 0.8, 2.2));
    });
  }
  // (the layers: on once every one of them is in; a missing one is the base again)
  const layers = scan && layered ? splatOf(site) : null;
  if (layers) {
    uniforms.uScanFade.value.set((look.near ?? 28) * 1.5, (look.far ?? 90) * 1.8);
    const s = site.ground.splatLook ?? {};
    uniforms.uSplatK.value.set(s.macro ?? 0.6, s.decal ?? 0.75, s.wet ?? (site.water && site.water.kind !== 'lava' ? 0.6 : 0.25), 0);
    const roles = [layers.base, layers.macro ?? layers.base, layers.steep ?? layers.base, layers.decal ?? layers.base];
    Promise.all(roles.map((r) => loadScan(r, { xl: true }))).then((got) => {
      if (got.some((x) => !x)) return;
      const [, macro, steep, decal] = got;
      uniforms.uMacro.value = macro.map;
      uniforms.uSteep.value = steep.map;
      uniforms.uSteepN.value = steep.normalMap;
      uniforms.uDecal.value = decal.map;
      roles.slice(1).forEach((r, i) => uniforms.uLayerK.value[i].set(1 / (scanOf(r).metres ?? 2), Math.pow(scanOf(r).mean ?? 0.8, 2.2)));
      uniforms.uSplatK.value.w = 1;
    });
  }
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: p.roughness ?? 0.94, metalness: 0 });
  // (the ground map, lib/three/groundmap: inside the walkable square the
  // floor takes its colour, the same rule painted once with the trees'
  // shade in it, so the floor, the grass and the bounce agree; fading to the
  // shader's own toward the square's edge and beyond)
  const fromMap = map
    ? `
  vec2 mq = abs(xz - uCentre) / uHalf;
  c = mix(c, groundColour(xz), 1.0 - smoothstep(0.88, 1.0, max(mq.x, mq.y)));`
    : '';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, map?.uniforms ?? {});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGround;\nvarying vec3 vGroundN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvGround = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvGroundN = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vGround;
varying vec3 vGroundN;
uniform vec3 uLow, uHigh, uRock, uAccent, uDeep, uGrain, uWetColor, uMarkColor;
uniform vec4 uHeights, uRipple, uWet, uScanK;
uniform vec2 uScanFade;
uniform sampler2D uMarks, uScan, uScanN;
uniform float uHalf;
uniform vec2 uCentre;
#ifdef SPLAT
uniform sampler2D uMacro, uSteep, uSteepN, uDecal;
uniform vec2 uLayerK[3];
uniform vec4 uSplatK;
float gWet;
vec3 gTri(sampler2D t, vec3 p, vec3 w) { return texture2D(t, p.zy).rgb * w.x + texture2D(t, p.xz).rgb * w.y + texture2D(t, p.xy).rgb * w.z; }
#endif
${map ? GROUND_GLSL : ''}
${NOISE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  vec2 xz = vGround.xz;
  float dist = length(vGround - cameraPosition);
  float nBig = gTex(xz / 560.0).r * 0.65 + gTex(xz / 140.0).g * 0.35;
  float nMid = gTex(xz / 70.0).g * 0.6 + gTex(xz / 22.0).b * 0.4;
  float nFine = gTex(xz / 9.0).a;
  float slope = 1.0 - clamp(vGroundN.y, 0.0, 1.0);
  float h = vGround.y + (nBig - 0.5) * (uHeights.y - uHeights.x) * 0.35;
  vec3 c = mix(uLow, uHigh, smoothstep(uHeights.x, uHeights.y, h));
  // patches of the accent, and the deep colour in the hollows
  c = mix(c, uAccent, smoothstep(1.0 - uHeights.w, 1.0 - uHeights.w + 0.12, nBig * 0.7 + nMid * 0.45) * step(0.001, uHeights.w));
  c = mix(c, uDeep, smoothstep(0.62, 0.8, nMid) * 0.35 * uGrain.z);
  // rock where it's steep
  float rock = smoothstep(uHeights.z, uHeights.z + 0.14, slope + (nMid - 0.5) * 0.16);
  vec3 rockC = uRock * (0.78 + 0.4 * gTex(vec2(xz.x * 0.004 + xz.y * 0.003, vGround.y * 0.035)).b); // strata
  c = mix(c, rockC, rock);
  // darker toward the water's edge
  c = mix(c, uWetColor, (1.0 - smoothstep(uWet.x, uWet.x + uWet.y, vGround.y)) * 0.75 * step(-9999.0, uWet.x));${fromMap}
  // grain close up, fading out before it shimmers
  float near = 1.0 - smoothstep(30.0, 160.0, dist);
  c *= 1.0 + ((nFine - 0.5) * 0.12 + (nMid - 0.5) * 0.16) * uGrain.x * mix(0.5, 1.0, near);
  // the scan underfoot, close up: its grain over the colour, centred on
  // its own brightness so the palette's colour still says what the ground is
#ifdef SPLAT
  gWet = 0.0;
  if (uScanK.y > 0.0 && uSplatK.w > 0.5) {
    float scanNear = 1.0 - smoothstep(uScanFade.x, uScanFade.y, dist);
    // the base at its size and again at about a third, turned (no tile repeats)
    vec3 sc = texture2D(uScan, xz * uScanK.x).rgb / max(uScanK.w, 0.05);
    vec3 sc2 = texture2D(uScan, mat2(0.8, -0.6, 0.6, 0.8) * xz * uScanK.x * 0.31).rgb / max(uScanK.w, 0.05);
    sc = mix(sc, sc * sc2, 0.5);
    // the second scan in broad patches
    float mK = smoothstep(0.5, 0.68, nBig * 0.75 + nMid * 0.35) * uSplatK.x;
    sc = mix(sc, texture2D(uMacro, xz * uLayerK[0].x).rgb / max(uLayerK[0].y, 0.05), mK);
    // blotches of the fourth: one in a cell, at a random spot, its edge broken up
    vec2 dc = xz / 7.0;
    vec2 cid = floor(dc);
    vec2 ctr = vec2(gHash(cid + 3.1), gHash(cid + 7.7)) * 0.6 + 0.2;
    float blot = (1.0 - smoothstep(0.16, 0.4, length(fract(dc) - ctr) + (nFine - 0.5) * 0.4)) * step(0.5, gHash(cid));
    sc = mix(sc, texture2D(uDecal, xz * uLayerK[2].x).rgb / max(uLayerK[2].y, 0.05), blot * uSplatK.y * (1.0 - rock));
    // rock on the slopes, from the three axes (never stretched)
    vec3 tw = pow(abs(normalize(vGroundN)), vec3(4.0));
    tw /= tw.x + tw.y + tw.z;
    sc = mix(sc, gTri(uSteep, vGround * uLayerK[1].x, tw) / max(uLayerK[1].y, 0.05), rock);
    c *= mix(vec3(1.0), sc, uScanK.y * scanNear);
  }
  // wet: by the water's edge, and in the hollows (darker, smoother)
  gWet = max((1.0 - smoothstep(uWet.x, uWet.x + uWet.y * 2.5, vGround.y)) * step(-9999.0, uWet.x), smoothstep(0.68, 0.86, nMid * 0.7 + nFine * 0.3) * uSplatK.z * (1.0 - rock)) * (1.0 - rock * 0.7);
  c *= 1.0 - 0.32 * gWet;
#else
  if (uScanK.y > 0.0) {
    float scanNear = 1.0 - smoothstep(uScanFade.x, uScanFade.y, dist);
    vec3 sc = texture2D(uScan, xz * uScanK.x).rgb / max(uScanK.w, 0.05);
    c *= mix(vec3(1.0), sc, uScanK.y * scanNear);
  }
#endif
  // where things have been
  vec2 muv = (xz - uCentre) / (2.0 * uHalf) + 0.5;
  if (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) c = mix(c, uMarkColor, texture2D(uMarks, muv).r);
  diffuseColor.rgb *= c;
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  // ripples across the wind, and a little roughness everywhere, in the light
  float dist = length(vGround - cameraPosition);
  float fadeR = 1.0 - smoothstep(40.0, 220.0, dist);
  vec2 xz = vGround.xz;
  vec2 across = vec2(uRipple.z, uRipple.w);
  float phase = dot(xz, across) * uRipple.y + gTex(xz / 40.0).b * 9.0;
  float flatK = smoothstep(0.65, 0.95, vGroundN.y);
  vec3 tilt = vec3(across.x, 0.0, across.y) * cos(phase) * uRipple.x * fadeR * flatK;
  vec2 g = xz / 7.0;
  float e = 1.0 / 256.0;
  float n0 = gTex(g).a;
  tilt += vec3(gTex(g + vec2(e, 0.0)).a - n0, 0.0, gTex(g + vec2(0.0, e)).a - n0) * 2.2 * uGrain.x * fadeR;
  // the scan's own relief, close up (its normal map laid flat on the ground)
  if (uScanK.z > 0.0) {
    float scanNear = 1.0 - smoothstep(uScanFade.x, uScanFade.y, dist);
    vec3 tn = texture2D(uScanN, xz * uScanK.x).xyz * 2.0 - 1.0;
    tilt -= vec3(tn.x, 0.0, tn.y) * uScanK.z * scanNear * flatK;
#ifdef SPLAT
    // the rock's relief on the slopes: its normal maps from the three axes
    if (uSplatK.w > 0.5) {
      vec3 nw = normalize(vGroundN);
      vec3 tw = pow(abs(nw), vec3(4.0));
      tw /= tw.x + tw.y + tw.z;
      vec3 sp = vGround * uLayerK[1].x;
      vec3 tx = texture2D(uSteepN, sp.zy).xyz * 2.0 - 1.0;
      vec3 tz = texture2D(uSteepN, sp.xy).xyz * 2.0 - 1.0;
      vec3 side = vec3(0.0, tx.y, tx.x) * tw.x + vec3(tz.x, tz.y, 0.0) * tw.z;
      tilt -= side * uScanK.z * scanNear * (1.0 - flatK);
    }
#endif
  }
  normal = normalize(normal - (viewMatrix * vec4(tilt, 0.0)).xyz);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  // glints off snow and salt, close up
  float dist = length(vGround - cameraPosition);
  // (a pin-prick at a random spot in one cell in seventy: a crystal catching
  // the sun, not a square of the cell; which ones shift as you move, as
  // real glitter does)
  vec2 gq = vGround.xz * 9.0;
  vec2 cellP = floor(gq);
  float seed = gHash(cellP + floor(cameraPosition.xz * 0.6));
  vec2 spot = vec2(gHash(cellP + 17.3), gHash(cellP + 41.9)) * 0.7 + 0.15;
  float pin = smoothstep(0.16, 0.0, length(fract(gq) - spot));
  float glint = step(0.986, seed) * pin;
  totalEmissiveRadiance += vec3(glint * uGrain.y * (1.0 - smoothstep(3.0, 16.0, dist)) * 1.2);
}`,
      );
  };
  // (wet ground is smoother)
  if (layers) {
    mat.defines = { ...(mat.defines ?? {}), SPLAT: '' };
    mat.onBeforeCompile = ((before) => (shader) => {
      before(shader);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor *= 1.0 - 0.55 * gWet;');
    })(mat.onBeforeCompile);
  }
  mat.customProgramCacheKey = () => `galaxy-ground${map ? ':map' : ''}${layers ? ':splat' : ''}`;
  return { material: mat, uniforms };
}
