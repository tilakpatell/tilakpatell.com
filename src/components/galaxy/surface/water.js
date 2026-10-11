// A world's water, out to the horizon. A sea or a swamp (Scarif's lagoons
// and surf, Kamino's storm, Naboo's lakes, Dagobah's black water) is a disc
// of Gerstner waves round the camera (ocean.js: each world's own swell),
// fine near it and coarse to the horizon; a depth map baked from the ground
// colours the shallows and the sand under them, stands the swell up on the
// beaches where it breaks, and washes foam up to the waterline. The sky in
// it by angle, light through the crests toward the sun, the sun's road,
// whitecaps where the waves pinch. Lava (Mustafar's rivers, glowing,
// crusting over) and a sea of cloud (Bespin, far below the city) stay one
// plane at the site's level; lava lights itself. Where the site's lava names
// the game's film (water.video: 'volcano', Mustafar) and a texture of it is
// handed in (lavaFilm.js: high and ultra only), the film's molten flow runs
// over the shader's own, which stays under it at the crust.
//
// Spray: where a wave runs up one of the water's legs (Kamino's stilts and
// its pad's column, site.water.legs) it throws spray (floats.js says how
// much), and splash(x, z, k) throws a burst (an aiwha going in).
//
// site.water: { level, color, deep, kind, foam?, glow?, legs?: [[x, z, r]…] }
// createWater(site, sunDir, sunColor, { heightAt, small, id, rings, depthN, foam, flow, flipped }) →
//   (rings, depthN: amounts.js's; foam: ultra's finer foam, shore, lava and chop;
//   flow: the lava film's texture, flipped as the game stores it)
//   { mesh, glow, spray, depth, update(t, camera, dt), height(x, z, t),
//     splash(x, z, k), dispose() }

//
// (The workings are waterCore.js's; these are its GLSL looks. The node
// renderer's are nodes/water.js's.)

import * as THREE from 'three';
import { WAVES_GLSL } from './ocean';
import { createWater as createWith } from './waterCore';

const PLANE_VERT = `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const PLANE_FRAG = `
varying vec3 vWorld;
uniform vec3 uColor, uDeep, uSun, uSunColor, uSky;
uniform float uTime, uKind, uFoam, uGlow, uWaves, uWaves2;
#include <fog_pars_fragment>
uniform sampler2D uNoise;
#ifdef VIDEO
uniform sampler2D uFlow;
uniform float uFlowFlip;
#endif
float wFbm(vec2 p) { vec4 a = texture2D(uNoise, p * 0.08); vec4 b = texture2D(uNoise, p * 0.19 + 0.37); return a.r * 0.35 + a.g * 0.3 + b.b * 0.2 + b.a * 0.15; }
void main() {
  vec2 xz = vWorld.xz;
  float dist = length(vWorld - cameraPosition);
  vec3 view = normalize(cameraPosition - vWorld);
  vec3 c;
  if (uKind > 1.5) {
    // lava: hot channels under a crust that cracks and drifts
    float flow = wFbm(xz * 0.05 + vec2(uTime * 0.02, uTime * 0.013));
    float crust = smoothstep(0.42, 0.62, wFbm(xz * 0.11 - vec2(uTime * 0.03, 0.0)));
    vec3 hot = mix(uColor, vec3(1.0, 0.85, 0.4), smoothstep(0.55, 0.8, flow));
    c = mix(hot * uGlow * (0.8 + 0.4 * flow), uDeep, crust * 0.85);
#ifdef VIDEO
    // the game's lava film (MT_Volcano2), a tile every 48 m, drifting with
    // the flow; the crust keeps its dark plates over it
    vec2 fuv = fract(xz / 48.0 + vec2(uTime * 0.004, uTime * 0.0027));
    if (uFlowFlip > 0.5) fuv.y = 1.0 - fuv.y;
    vec3 molten = texture2D(uFlow, fuv).rgb;
    // (the film is bright already: lifted a little by the glow, not by all of it)
    c = mix(c, molten * (0.55 + 0.25 * uGlow), 0.65 * (1.0 - crust * 0.55));
#endif
#ifdef FINE
    // close up: the crust broken into plates, glowing at the cracks between
    // them, and a finer skin on the plates
    float near = 1.0 - smoothstep(30.0, 260.0, dist);
    float plates = wFbm(xz * 0.42 + vec2(uTime * 0.01, 0.0));
    float crack = 1.0 - smoothstep(0.0, 0.035, abs(plates - 0.5));
    c += mix(uColor, vec3(1.0, 0.75, 0.3), 0.4) * uGlow * crack * crust * near * 0.9;
    c *= 1.0 - (wFbm(xz * 1.6) - 0.5) * 0.35 * crust * near;
#endif
  } else {
    // water (or cloud): waves in the light, darker looking down into it
    float e = 0.6;
    vec2 p = xz * 0.09 * uWaves;
    float t = uTime * 0.6;
    float h0 = wFbm(p + vec2(t * 0.3, t * 0.2));
    float hx = wFbm(p + vec2(e * 0.09, 0.0) + vec2(t * 0.3, t * 0.2));
    float hz = wFbm(p + vec2(0.0, e * 0.09) + vec2(t * 0.3, t * 0.2));
    if (uKind > 0.5) {
      // a cloud sea: a second, broader layer drifting the other way under
      // the first, so the sea has depth
      vec2 p2 = xz * 0.09 * uWaves2;
      vec2 d2 = vec2(t * -0.18, t * -0.12);
      float g0 = wFbm(p2 + d2);
      h0 = h0 * 0.6 + g0 * 0.4;
      hx = hx * 0.6 + wFbm(p2 + vec2(e * 0.09, 0.0) + d2) * 0.4;
      hz = hz * 0.6 + wFbm(p2 + vec2(0.0, e * 0.09) + d2) * 0.4;
    }
    float fade = 1.0 - smoothstep(80.0, 900.0, dist);
    vec3 n = normalize(vec3((h0 - hx) * 3.0 * fade, 1.0, (h0 - hz) * 3.0 * fade));
#ifdef FINE
    // a second, finer chop over the waves, close up
    vec2 q = xz * 0.31 * uWaves + vec2(t * -0.4, t * 0.25);
    float c0 = wFbm(q);
    n = normalize(n + vec3(c0 - wFbm(q + vec2(0.06, 0.0)), 0.0, c0 - wFbm(q + vec2(0.0, 0.06))) * 2.0 * (1.0 - smoothstep(20.0, 200.0, dist)));
#endif
    float facing = clamp(dot(n, view), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 4.0);
    c = mix(uDeep, uColor, 0.35 + 0.65 * (1.0 - facing));
    c = mix(c, uSky, fresnel * 0.75);
    vec3 h = normalize(uSun + view);
    float spec = pow(max(dot(n, h), 0.0), uKind > 0.5 ? 40.0 : 220.0);
    c += uSunColor * spec * (uKind > 0.5 ? 0.25 : 1.6);
    // the cloud sea's glints: the sun's way, caught on the tops
    if (uKind > 0.5) {
      float glint = pow(max(dot(reflect(-view, n), uSun), 0.0), 48.0) * 0.8;
      c += uSunColor * glint * smoothstep(0.45, 0.7, h0);
    }
    // foam, in streaks
    c = mix(c, vec3(0.92), smoothstep(0.72, 0.8, wFbm(p * 2.3 + t * 0.4)) * uFoam * fade);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

// ── The sea and the swamp ──

const SEA_VERT = (waves) => `
uniform vec2 uCentre;
uniform sampler2D uDepth;
uniform float uHalf, uMax, uReach, uBreakers, uLevel, uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vPinch;
varying float vDepth;
varying float vCrest;
varying float vShore;
#include <fog_pars_vertex>
${WAVES_GLSL(waves)}
// the depth there, and how far from the waterline (open sea past the map)
vec2 depthAt(vec2 p) {
  vec2 uv = (p + uHalf) / (2.0 * uHalf);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec2(uMax, uReach);
  return texture2D(uDepth, uv).rg * vec2(uMax, uReach);
}
// (ocean.js's damp: still on the sand, standing up in the shallows)
float shoal(float d) {
  if (d <= 0.0) return 0.0;
  return smoothstep(0.0, 1.2, d) * (1.0 + uBreakers * 0.45 * (1.0 - smoothstep(1.5, 9.0, d)));
}
void main() {
  vec2 p = position.xz + uCentre;
  vec2 dw = depthAt(p);
  float depth = dw.x;
  vec3 n;
  float pinch;
  vec3 d = gerstner(p, length(position.xz), shoal(depth), n, pinch);
  vWorld = vec3(p.x, uLevel, p.y) + d;
  vNormal = n;
  vPinch = pinch;
  vDepth = depth;
  vCrest = d.y;
  vShore = dw.y;
  vec4 mvPosition = viewMatrix * vec4(vWorld, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const SEA_FRAG = `
uniform vec3 uColor, uDeep, uShallow, uBed, uSun, uSunColor, uZenith, uHorizon, uFar;
uniform float uFarMix, uSkyMix;
uniform float uTime, uClarity, uCaps, uShore, uBreakers, uGlint, uRough, uScum;
uniform sampler2D uNoise;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vPinch;
varying float vDepth;
varying float vCrest;
varying float vShore;
#include <fog_pars_fragment>
void main() {
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 V = toEye / dist;
  vec2 w = vWorld.xz;
  // fine ripples: two layers of the noise tile sliding past each other
  float near = 1.0 / (1.0 + dist * 0.01);
  vec4 r1 = texture2D(uNoise, w * 0.045 + uTime * vec2(0.012, 0.008));
  vec4 r2 = texture2D(uNoise, w * 0.11 - uTime * vec2(0.018, 0.011));
  vec2 rip = ((r1.rg - 0.5) * 0.9 + (r2.ba - 0.5) * 0.6) * uRough * (0.3 + 0.7 * near);
  vec3 N = normalize(vNormal + vec3(rip.x, 0.0, rip.y));
  // mirror or water, by the angle you look at it
  float facing = max(dot(N, V), 0.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - facing, 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.8, abs(R.y)), 0.6));
  // the body: dark in the troughs, lit where a crest stands between you and
  // the sun, then the shallows' colour, then the bed showing through
  float crest = smoothstep(-0.5, 1.5, vCrest);
  vec3 sunFlat = normalize(vec3(uSun.x, 0.0, uSun.z) + vec3(1e-4));
  float through = pow(max(dot(V, -sunFlat), 0.0), 3.0) * crest;
  vec3 body = mix(uDeep, uColor, 0.35 + crest * 0.4 + through * 0.8);
  float shallow = exp(-vDepth / max(uClarity, 0.1));
  body = mix(body, uShallow, smoothstep(0.02, 0.6, shallow) * 0.85);
  body = mix(body, uBed, pow(shallow, 4.0) * 0.7);
  // (a sea that keeps its colour out to the horizon, where the sky in it
  // would wash it pale: Scarif's)
  body = mix(body, uFar, smoothstep(40.0, 500.0, dist) * uFarMix * (1.0 - shallow));
  vec3 col = mix(body, sky, fresnel * (1.0 - shallow * 0.4) * uSkyMix);
  // the sun's road on the water
  vec3 H = normalize(uSun + V);
  col += uSunColor * pow(max(dot(N, H), 0.0), 260.0) * uGlint * (0.3 + 0.7 * near);
  // foam: whitecaps where the waves pinch, the crests breaking in the surf,
  // and the wash running up to the waterline in bands, with lace at its edge
  vec4 n1 = texture2D(uNoise, w * 0.06 + uTime * vec2(0.01, 0.006));
  vec4 n2 = texture2D(uNoise, w * 0.21 - uTime * vec2(0.008, 0.012));
  float lumpy = n1.b * 0.6 + n2.a * 0.4;
  float wet = step(0.001, vDepth);
  float caps = smoothstep(0.82, 0.55, vPinch) * smoothstep(0.42, 0.66, lumpy) * uCaps;
  // (by the distance from the waterline, so a gentle beach's surf is as
  // narrow as a steep one's: breakers 5–28 m out, the wash in the last 9 m,
  // its bands running in toward the sand, lace along the edge)
  float surf = smoothstep(3.0, 7.0, vShore) * (1.0 - smoothstep(18.0, 30.0, vShore)) * wet;
  float breaking = surf * smoothstep(0.05, 0.45, vCrest) * uBreakers * smoothstep(0.35, 0.62, lumpy);
  float wash = (1.0 - smoothstep(2.0, 9.0, vShore)) * (0.5 + 0.5 * sin(vShore * 1.15 + uTime * 1.5 + lumpy * 2.5));
  wash = smoothstep(0.62, 0.92, wash) * uShore * wet;
  float lace = (1.0 - smoothstep(0.4, 2.2, vShore)) * uShore * 0.85 * wet;
  float foam = clamp(max(max(caps, breaking), max(wash, lace) * smoothstep(0.25, 0.55, lumpy + 0.2)), 0.0, 1.0);
#ifdef FOAM_DETAIL
  // the foam close up: bubbles and holes in it at two finer sizes, and a
  // thin bright lace where the wash's last band thins out over the sand
  vec4 f1 = texture2D(uNoise, w * 0.9 + uTime * vec2(0.03, -0.02));
  vec4 f2 = texture2D(uNoise, w * 2.7 - uTime * vec2(0.02, 0.035));
  float cells = smoothstep(0.3, 0.7, f1.g * 0.6 + f2.r * 0.4);
  float nearF = 1.0 - smoothstep(25.0, 120.0, dist);
  foam *= mix(1.0, 0.45 + 0.75 * cells, nearF);
  float edge = (1.0 - smoothstep(0.0, 1.2, vShore)) * smoothstep(0.45, 0.6, f2.b) * wet * uShore;
  foam = max(foam, edge * nearF);
#endif
  vec3 foamCol = vec3(0.86, 0.9, 0.92) * (0.55 + 0.6 * max(dot(N, uSun), 0.0));
  col = mix(col, foamCol, foam * 0.92);
  // a swamp's skin: scum and duckweed in patches
  float scum = smoothstep(0.55, 0.75, n1.r * 0.7 + r2.g * 0.3) * uScum;
  col = mix(col, uBed * 1.4 + vec3(0.03, 0.05, 0.0), scum * 0.7);
#ifdef FOAM_DETAIL
  // the shore blended: the last few centimetres of water clear over the
  // bed, so the waterline is a soft wet edge, not a line where two meshes meet
  float clear = 1.0 - smoothstep(0.0, 0.35, vDepth);
  col = mix(col, uBed * 0.8, clear * 0.55 * (1.0 - foam));
#endif
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

// the uniforms as the shaders take them: the values, the fog's, and the
// textures after the merge (which would clone them)
const glslUniforms = (values, late) => {
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { value: v }]))]);
  for (const [k, v] of Object.entries(late)) uniforms[k] = { value: v };
  return uniforms;
};

const LOOKS = {
  plane(values, late, { fine, video }) {
    const uniforms = glslUniforms(values, late);
    const defines = { ...(fine ? { FINE: '' } : {}), ...(video ? { VIDEO: '' } : {}) };
    return { material: new THREE.ShaderMaterial({ vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, uniforms, fog: true, defines }), uniforms };
  },
  sea(values, late, waves, { fine }) {
    const uniforms = glslUniforms(values, late);
    return { material: new THREE.ShaderMaterial({ vertexShader: SEA_VERT(waves), fragmentShader: SEA_FRAG, uniforms, fog: true, defines: fine ? { FOAM_DETAIL: '' } : {} }), uniforms };
  },
};

export const createWater = (site, sunDir, sunColor, opts = {}) => createWith(site, sunDir, sunColor, opts, LOOKS);
