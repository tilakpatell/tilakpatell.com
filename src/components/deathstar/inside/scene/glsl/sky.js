// The windows’ views’ shaders as GLSL, as views.js drew them on the classic
// renderer: kept for the parity check (scripts/twin-parity/cases/deathstar.js)
// and the twins’ tests, never imported by the world (its 'nodes' closure
// reaches ../nodes/sky.js instead, the same factories as nodes). views.js’s
// header says what each is.
//
//   skyUniforms(sun: Vector3, colour: [r, g, b]) → { uOrigin, uSun, uSunColour }   shared by everything a view draws
//   starsMesh(pos, colour, size, u, px) → Points   the stars, each `size` pixels times px across, on the far plane
//   bandMaterial(u, pole) · sunMaterial(u, size) · flashMaterial()
//   bodyMaterial(u, { air, map, normal, rough, clouds, giant }) → material.uniforms.uDrift, uAir …
//   haloMaterial(u, { air, r })   air: the body’s uAir, so the two share it
//   sunlit(material, u) → material   the view’s sun in a loaded model’s own lighting, kept out of the house look

import * as THREE from 'three';
import { NOISE } from '../../../../../lib/three/noiseGlsl';

const FAR_GLSL = /* glsl */ `
uniform vec3 uOrigin;
// the sky pinned round the eye (it never shifts as you walk past a window)
// and put on the far plane, behind everything the room has drawn
vec4 farClip(vec4 world) {
  world.xyz += cameraPosition - uOrigin;
  vec4 clip = projectionMatrix * viewMatrix * world;
  clip.z = clip.w * 0.99999;
  return clip;
}`;

const STAR_VERT = /* glsl */ `${FAR_GLSL}
attribute vec3 aColour;
attribute float aSize;
uniform float uPx;
varying vec3 vC;
void main() {
  vC = aColour;
  gl_PointSize = aSize * uPx;
  gl_Position = farClip(modelMatrix * vec4(position, 1.0));
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vC;
void main() {
  float a = max(0.0, 1.0 - dot(gl_PointCoord * 2.0 - 1.0, gl_PointCoord * 2.0 - 1.0));
  gl_FragColor = vec4(vC * a * a, 1.0);
}`;

const BAND_VERT = /* glsl */ `${FAR_GLSL}
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = farClip(modelMatrix * vec4(position, 1.0));
}`;
// the galaxy edge on: a soft band of light, mottled, a dark lane of dust along it
const BAND_FRAG = /* glsl */ `
uniform vec3 uPole;
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  float lat = dot(d, uPole);
  float n = clamp(noise(d * 5.0) * 0.5 + noise(d * 13.0) * 0.3 + 0.5, 0.0, 1.0);
  float band = exp(-lat * lat / 0.02);
  float lane = 1.0 - 0.6 * exp(-pow((lat - 0.012) / 0.03, 2.0)) * smoothstep(0.35, 0.75, n);
  vec3 c = mix(vec3(0.5, 0.56, 0.8), vec3(0.95, 0.84, 0.68), smoothstep(0.3, 0.8, n));
  gl_FragColor = vec4(c * band * lane * (0.4 + 0.8 * n) * 0.07, 1.0);
}`;

const SUN_VERT = /* glsl */ `
uniform vec3 uOrigin;
uniform float uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 w = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  w.xyz += cameraPosition - uOrigin;
  vec4 mv = viewMatrix * w;
  mv.xy += position.xy * uSize;
  vec4 clip = projectionMatrix * mv;
  clip.z = clip.w * 0.99999;
  gl_Position = clip;
}`;
// a white disc half a degree across, hot enough to bloom, in a wide soft glow
const SUN_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  float d = length(vUv);
  float disc = smoothstep(0.024, 0.018, d);
  float glow = exp(-d * d * 30.0) * 0.7 + exp(-d * 6.0) * 0.15;
  gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * (disc * 6.0 + glow) * smoothstep(1.0, 0.7, d), 1.0);
}`;

const BODY_VERT = /* glsl */ `${FAR_GLSL}
varying vec3 vN, vT, vB, vW, vC;
varying vec2 vUv;
void main() {
  vUv = uv;
  vC = modelMatrix[3].xyz + cameraPosition - uOrigin;
  mat3 m = mat3(modelMatrix);
  vec3 on = normalize(normal);
  // east and north on the sphere, the way its painted map runs (u east, v north)
  vec3 ot = vec3(on.z, 0.0, -on.x);
  ot = dot(ot, ot) > 1e-8 ? normalize(ot) : vec3(1.0, 0.0, 0.0);
  vN = normalize(m * on);
  vT = normalize(m * ot);
  vB = cross(vN, vT);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz + cameraPosition - uOrigin;
  gl_Position = farClip(w);
}`;
const BODY_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSun, uSunColour, uAir;
uniform float uDrift;
#ifdef RELIEF
uniform sampler2D uNormal, uRough;
#endif
#ifdef CLOUDS
uniform sampler2D uClouds;
#endif
varying vec3 vN, vT, vB, vW;
varying vec2 vUv;
void main() {
  vec3 v = normalize(cameraPosition - vW);
  vec3 g = normalize(vN);
  vec3 n = g;
  vec3 albedo = texture2D(uMap, vUv).rgb;
  float gloss = 0.0;
#ifdef RELIEF
  vec3 t = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  n = normalize(vT * t.x + vB * t.y + g * t.z);
  gloss = 1.0 - texture2D(uRough, vUv).r;
#endif
  float day = dot(g, uSun);
  // (the terminator soft, as the air bends a little light round it)
  vec3 col = albedo * max(dot(n, uSun), 0.0) * smoothstep(-0.08, 0.15, day);
  // the sun’s glint off open water
  col += vec3(0.5) * gloss * gloss * pow(max(dot(n, normalize(uSun + v)), 0.0), 80.0) * step(0.0, day);
#ifdef CLOUDS
  col = mix(col, vec3(0.92) * max(day, 0.0), texture2D(uClouds, vUv + vec2(uDrift, 0.0)).a);
#endif
  float rim = 1.0 - max(dot(g, v), 0.0);
#ifdef GIANT
  col *= 1.0 - 0.45 * rim * rim; // darker at the limb, through more of its air
#endif
  col += uAir * pow(rim, 3.0) * smoothstep(-0.3, 0.4, day) * 0.35;
  gl_FragColor = vec4(col * uSunColour * 0.3183, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
// the air round a body, seen edge on: brightest at the limb, fading out
// above it within a few hundredths of its radius, lit where the sun is up
const HALO_FRAG = /* glsl */ `
uniform vec3 uSun, uAir;
uniform float uR;
varying vec3 vW, vC;
void main() {
  vec3 rd = normalize(vW - cameraPosition);
  vec3 oc = vC - cameraPosition;
  vec3 foot = rd * dot(oc, rd) - oc; // from the middle to where the ray passes nearest it
  float h = length(foot) / uR;
  float a = h > 1.0 ? exp((1.0 - h) / 0.014) : pow(h, 12.0);
  gl_FragColor = vec4(uAir * a * 0.9 * smoothstep(-0.3, 0.45, dot(normalize(foot), uSun)), 1.0);
}`;

const FLASH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vC;
void main() {
  vUv = position.xy;
  vC = instanceColor;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  mv.xy += position.xy * length(instanceMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
}`;
const FLASH_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vC;
void main() {
  float d = dot(vUv, vUv);
  gl_FragColor = vec4(vC * (exp(-d * 9.0) + 0.25 * exp(-d * 2.5)) * (1.0 - smoothstep(0.7, 1.0, d)), 1.0);
}`;

// The view’s sun in a loaded model’s own material (three’s physical
// lighting, one more direct light), where a light in the scene would light
// the room too; and the room’s house look kept off it.
const SUN_GLSL = /* glsl */ `
{
  IncidentLight viewSun = IncidentLight(uViewSunColour, normalize((viewMatrix * vec4(uViewSun, 0.0)).xyz), true);
  RE_Direct(viewSun, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
}`;
export function sunlit(material, u) {
  material.userData.noHouse = true;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uViewSun = u.uSun;
    shader.uniforms.uViewSunColour = u.uSunColour;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uViewSun;\nuniform vec3 uViewSunColour;')
      .replace('#include <lights_fragment_begin>', `#include <lights_fragment_begin>\n${SUN_GLSL}`);
  };
  material.customProgramCacheKey = () => 'view-sun';
  material.needsUpdate = true;
  return material;
}

const farMaterial = (u, more) => new THREE.ShaderMaterial({ depthWrite: false, ...more, uniforms: { uOrigin: u.uOrigin, ...more.uniforms } });

export const skyUniforms = (sun, colour) => ({ uOrigin: { value: new THREE.Vector3() }, uSun: { value: sun.clone() }, uSunColour: { value: new THREE.Color(...colour) } });

export function starsMesh(pos, colour, size, u, px) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColour', new THREE.BufferAttribute(colour, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = farMaterial(u, { uniforms: { uPx: { value: px } }, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, blending: THREE.AdditiveBlending, toneMapped: false });
  return new THREE.Points(geo, mat);
}

export const bandMaterial = (u, pole) =>
  farMaterial(u, { uniforms: { uPole: { value: new THREE.Vector3(...pole) }, uSeed: { value: new THREE.Vector3(3, 7, 11) } }, vertexShader: BAND_VERT, fragmentShader: BAND_FRAG, side: THREE.BackSide, blending: THREE.AdditiveBlending, toneMapped: false });

export const sunMaterial = (u, size) => farMaterial(u, { uniforms: { uSize: { value: size } }, vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, blending: THREE.AdditiveBlending, toneMapped: false });

export function bodyMaterial(u, { air, map, normal = null, rough = null, clouds = null, giant = false }) {
  const defines = giant ? { GIANT: 1 } : { RELIEF: 1, ...(clouds ? { CLOUDS: 1 } : {}) };
  const uniforms = { uSun: u.uSun, uSunColour: u.uSunColour, uAir: { value: new THREE.Color(...air) }, uDrift: { value: 0 }, uMap: { value: map } };
  if (!giant) Object.assign(uniforms, { uNormal: { value: normal }, uRough: { value: rough } });
  if (defines.CLOUDS) uniforms.uClouds = { value: clouds };
  return farMaterial(u, { uniforms, defines, vertexShader: BODY_VERT, fragmentShader: BODY_FRAG });
}

export const haloMaterial = (u, { air, r }) => farMaterial(u, { uniforms: { uSun: u.uSun, uAir: air, uR: { value: r } }, vertexShader: BODY_VERT, fragmentShader: HALO_FRAG, blending: THREE.AdditiveBlending, toneMapped: false });

export const flashMaterial = () => new THREE.ShaderMaterial({ vertexShader: FLASH_VERT, fragmentShader: FLASH_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
