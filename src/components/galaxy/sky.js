// The sky over a star system, as it is from where that system sits in the
// galaxy (systems.js): the galaxy's own disc seen from inside it, a band of
// stars and dust lanes all the way round the horizon (the galactic plane is
// each system's y = 0, its +x east and +z south as the map has them), with
// the core's bulge glowing in the direction of the galaxy's middle: huge and
// blazing over Coruscant, small and far off over Tatooine ("the planet it's
// farthest from"), and from the Unknown Regions the whole galaxy hangs off
// to one side, the other side all but empty. Three nebulae (nebulaeOf),
// clouds of gas glowing in their own colours, with dark dust across them and
// across the band. A field of stars, thickest along the band; and the
// system's own star or stars, glaring, the way the light comes from (they
// light the planet: bodies.js). And the other systems' stars, where they
// really are from here (systems.js courseTo), brighter the nearer: point the
// nose at one and you can jump to it (scene.js); the one picked pulses.
// Everything rides with the camera, so it's always as far off.
//
// The galaxy itself (the band, its lanes and star clouds, the core and the
// nebulae) doesn't move, so it's drawn once a system, not every frame: bake()
// renders it with a cube camera into a cube texture (1024 pixels a face, 512
// on a small screen or a weaker device: bakeSize), 8 bits in sRGB with its
// mipmaps, and the sphere you see just looks that up. Drawn once, its shader
// can afford what it couldn't every frame: noise twisted by noise, seven
// octaves deep. Until the first bake the sphere is black (the stars, the suns
// and the other systems' stars are drawn live, as ever). That shader is a big
// one (on some drivers its first link takes seconds), so prepare() starts the
// link at startup, in the background, and the first bake waits for nothing.
//
// Under it all, where the system has one (skyPanorama.js), Battlefront II's
// own star field for its space: Endor's, the Core's, the Outer Rim's, the
// game's KTX2 at the quality level's width, baked in with the rest, looked
// up at its sharpest level with the seam's wrap (no line where it joins). It
// loads after the system's first bake, and the sky is baked again with it.
//
// createSky({ small, renderer, beacons }) → { group, setSystem(system), bake(renderer),
//   prepare(renderer) → Promise, update(camera, t), focus(id), beacons, sunDirs,
//   setRatio(r), dispose() };
//   setSystem then bake (with the renderer it was made with, unless given
//   another); beacons: [{ id, dir }] (unit vectors), the other systems' stars
//   (drawn unless `beacons: false`, for a sky borrowed where there's no jumping)

import * as THREE from 'three';
import { precompile } from '../../lib/three/renderer';
import { tileFbm } from '../../lib/texture';
import { RIM, SYSTEMS, coreBearing, courseTo, distance } from './systems';
import { panoramaUrl } from './skyPanorama';

const SKY_R = 5200; // (inside the camera's far plane, outside everything else)
const SUN_R = 4800;
const TODAY = 4200; // the stars the sky always had (the ones past them are fainter: STARS_PAST)
const STARS_PAST = 0.7; // how bright the stars past those are, of what they'd be
const GRAIN_SIZE = 256;

const NOISE = /* glsl */ `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm4(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  return s;
}
float fbm7(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 7; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.4);
    a *= 0.5;
  }
  return s;
}`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w); // (on the far plane, whatever its distance)
}`;

// the sky as it's drawn every frame: the cube baked for the system, looked
// up the way you're looking, broken up finer than the cube's texels where
// it's bright (the band's star clouds, the core, the nebulae: a tiling
// noise on three sides of the sphere at two fine scales, so under a narrow
// lens the band doesn't go soft; the dark between untouched), with noise of
// half a step either way of the cube's own steps (8 bits, in sRGB), against
// banding in the dark
const LOOK_FRAG = /* glsl */ `
uniform samplerCube uSky;
uniform sampler2D uGrain;
varying vec3 vDir;
float grain(vec3 d, float f) {
  vec3 w = pow(abs(d), vec3(4.0));
  w /= w.x + w.y + w.z;
  return texture2D(uGrain, d.yz * f).r * w.x + texture2D(uGrain, d.zx * f).r * w.y + texture2D(uGrain, d.xy * f).r * w.z;
}
void main() {
  vec3 d = normalize(vDir);
  vec3 c = textureCube(uSky, d).rgb;
  float lit = smoothstep(0.004, 0.05, dot(c, vec3(0.2126, 0.7152, 0.0722)));
  if (lit > 0.0) {
    float g = grain(d, 40.0) * 0.55 + grain(d, 110.0) * 0.45;
    c *= 1.0 + clamp((g - 0.5) * 1.6, -1.0, 1.0) * 0.2 * lit;
  }
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c = sRGBTransferOETF(vec4(c, 1.0)).rgb + n / 255.0;
  gl_FragColor = vec4(sRGBTransferEOTF(vec4(max(c, 0.0), 1.0)).rgb, 1.0);
  #include <colorspace_fragment>
}`;

// the grain: fbm that tiles, made once (in code: nothing to fetch), with
// its mipmaps, so where it's finer than the pixels it fades to even
let grainTexture = null;
function grainMap() {
  if (grainTexture) return grainTexture;
  const fbm = tileFbm(11, { base: 8, octaves: 5 });
  const data = new Uint8Array(GRAIN_SIZE * GRAIN_SIZE * 4);
  for (let y = 0; y < GRAIN_SIZE; y++)
    for (let x = 0; x < GRAIN_SIZE; x++) {
      const v = Math.round(Math.min(1, Math.max(0, fbm(x / GRAIN_SIZE, y / GRAIN_SIZE))) * 255);
      const i = (y * GRAIN_SIZE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, GRAIN_SIZE, GRAIN_SIZE, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  grainTexture = t;
  return t;
}

// the sky as it's baked, once a system: the band, its lanes and star clouds,
// the core, three nebulae and the dust in front, every one of them drawn
// through noise twisted by noise (it runs for six faces, once, so it can
// afford to)
const BAKE_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const BAKE_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform float uNear;
uniform float uSide;
uniform float uSeed;
uniform vec3 uNebDir[3];
uniform vec3 uNebCol[3];
uniform vec2 uNebShape[3]; // (its size, in radians, and how twisted it is)
uniform sampler2D uPano;
uniform float uPanoOn;
varying vec3 vDir;
${NOISE}
void main() {
  vec3 d = normalize(vDir);
  float lat = d.y;
  // a slow twist across the whole sky, that every cloud and lane is drawn through
  vec3 s = d * 2.3 + uSeed;
  vec3 twist = vec3(fbm4(s), fbm4(s + vec3(5.2, 1.3, 2.8)), fbm4(s + vec3(1.7, 9.2, 4.1))) - 0.47;
  vec3 dw = d + twist * 0.3;
  // the band: the disc seen edge on, wider nearer the middle
  float width = mix(0.11, 0.2, uNear);
  float wl = lat + twist.y * 0.03;
  float band = exp(-wl * wl / (width * width));
  vec3 level = normalize(vec3(d.x, 0.0, d.z) + vec3(1e-5, 0.0, 0.0));
  float toward = dot(level, uCore) * 0.5 + 0.5;
  // out at the rim the galaxy's all to one side
  float side = mix(1.0, 0.08 + 0.92 * pow(toward, 1.6), uSide);
  float clouds = fbm7(dw * 7.0 + uSeed);
  float fine = fbm4(dw * 23.0 + uSeed * 1.7);
  // its lanes of dust, and the dust drifting in front of everything (it shows
  // against the band and the core in the disc, and against the nebulae)
  float lanes = smoothstep(0.46, 0.7, fbm7(dw * vec3(5.0, 14.0, 5.0) + 3.1 + uSeed)) * exp(-lat * lat / (width * width * 0.18));
  float dust = smoothstep(0.52, 0.76, fbm7(dw * vec3(7.0, 10.0, 7.0) + vec3(11.0, 4.0, 7.0) + uSeed));
  float dustBand = dust * exp(-lat * lat / (width * width * 2.5)); // (in the disc, over the band and the core)
  vec3 bandCol = mix(vec3(0.5, 0.58, 0.85), vec3(1.0, 0.86, 0.68), toward);
  vec3 col = bandCol * band * side * (0.18 + 0.62 * clouds + 0.35 * fine * fine) * 0.32;
  // its star clouds: a fine grain of light down its middle, stars too many to tell apart
  float grain = fbm4(d * 70.0 + uSeed * 2.3);
  col += bandCol * exp(-wl * wl / (width * width * 0.45)) * side * grain * grain * grain * 0.09;
  col *= 1.0 - max(vec3(lanes * 0.82), dustBand * vec3(0.5, 0.55, 0.62)); // (the dust takes more blue than red: it reddens what's behind)
  // the core's bulge: bigger and brighter the nearer the middle
  float ang = acos(clamp(dot(d, uCore), -1.0, 1.0));
  float size = mix(0.13, 0.95, uNear);
  float squash = exp(-(lat * lat) / (size * size * 0.32));
  float bulge = exp(-(ang * ang) / (size * size)) * mix(1.0, squash, 0.6);
  float core = exp(-(ang * ang) / (size * size * 0.06));
  vec3 coreCol = mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.95, 0.85), core);
  col += coreCol * (bulge * mix(0.22, 0.9, uNear) + core * mix(0.18, 0.7, uNear)) * (1.0 - max(lanes * 0.55, dustBand * 0.3)) * (0.75 + 0.25 * clouds);
  // the nebulae: gas glowing in its own colour, twisted its own amount,
  // whiter where it's thickest, with rifts of its own and the dust across it
  for (int i = 0; i < 3; i++) {
    float a = acos(clamp(dot(d, uNebDir[i]), -1.0, 1.0)) / uNebShape[i].x;
    float m = exp(-a * a);
    if (m < 0.004) continue; // (too far out to show)
    vec3 p = (d + twist * 0.25) * (2.0 / uNebShape[i].x) + float(i) * 7.3 + uSeed;
    vec3 q = vec3(fbm4(p), fbm4(p + vec3(3.1, 7.7, 1.9)), fbm4(p + vec3(8.3, 2.8, 5.4))) - 0.47;
    float gas = fbm7(p + q * 1.8 * uNebShape[i].y);
    float rift = smoothstep(0.56, 0.8, fbm4(p * 1.9 + q * 2.0 + 17.0));
    float body = smoothstep(0.25, 0.9, gas * (0.55 + 0.9 * m)) * sqrt(m) * (1.0 - rift * 0.75);
    vec3 tint = mix(uNebCol[i], vec3(dot(uNebCol[i], vec3(0.45))), body * body * 0.4);
    col += (tint * body * 0.15 + uNebCol[i] * m * 0.01) * (1.0 - dust * 0.85);
  }
  // and the dark between
  col += vec3(0.0035, 0.005, 0.011);
  // the game's own star field under it all (equirectangular: u round the
  // horizon, v up it), at its sharpest level so the seam's jump in u can't
  // pick a blurrier one along the join
  if (uPanoOn > 0.5) {
    vec2 uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
    col += textureLod(uPano, uv, 0.0).rgb;
  }
  // half a step of the cube's 8 bits either way before they round it, so
  // its long faint gradients come out smooth, not in steps
  float n = hash3(vec3(gl_FragCoord.xy, uSeed + 7.0)) - 0.5;
  col = sRGBTransferEOTF(vec4(max(sRGBTransferOETF(vec4(col, 1.0)).rgb + n / 255.0, 0.0), 1.0)).rgb;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
uniform float uDpr;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(aSize * uDpr, 1.0, 5.0 * uDpr);
  vColor = aColor;
  vec4 p = projectionMatrix * mv;
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;
const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(vColor * smoothstep(0.5, 0.1, d), 1.0);
  #include <colorspace_fragment>
}`;

// the other systems' stars: each a hot point in a glare with a cross of
// spikes, a size on screen whatever the screen; the picked one pulses
const BEACON_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aFocus;
uniform float uDpr;
uniform float uTime;
varying vec3 vColor;
varying float vFocus;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float pulse = 1.0 + aFocus * (0.45 + 0.2 * sin(uTime * 6.0));
  gl_PointSize = aSize * uDpr * pulse;
  vColor = aColor;
  vFocus = aFocus;
  vec4 p = projectionMatrix * mv;
  gl_Position = vec4(p.xy, p.w * 0.99998, p.w);
}`;
const BEACON_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vFocus;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q);
  float core = smoothstep(0.2, 0.05, r);
  float glow = exp(-r * 5.5) * 0.9;
  float spikes = (exp(-abs(q.x) * 30.0) + exp(-abs(q.y) * 30.0)) * (1.0 - r) * (0.5 + vFocus * 0.8);
  vec3 c = vColor * (glow + spikes) + vec3(1.6 + vFocus * 1.4) * core;
  gl_FragColor = vec4(c * smoothstep(1.0, 0.75, r), 1.0);
  #include <colorspace_fragment>
}`;

// a star of its own: a white-hot disc in a glare, with faint rays
const SUN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 scale = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz));
  mv.xy += position.xy * scale;
  vec4 p = projectionMatrix * mv;
  gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
}`;
const SUN_FRAG = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float disc = smoothstep(0.075, 0.06, r);
  float glow = exp(-r * 9.0) * 0.9 + exp(-r * 3.2) * 0.22;
  float a = atan(vUv.y, vUv.x);
  float rays = pow(abs(cos(a * 3.0)), 60.0) * exp(-r * 4.0) * 0.35 + pow(abs(cos(a * 2.0 + 0.6)), 90.0) * exp(-r * 5.0) * 0.25;
  vec3 c = uColor * (glow + rays) + vec3(6.0) * disc;
  gl_FragColor = vec4(c * smoothstep(1.0, 0.7, r), 1.0);
  #include <colorspace_fragment>
}`;

// the same numbers for the same system, every visit (and for every pilot)
function seeded(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NEBULAE = [
  ['#c4508f', '#4f7fd0'],
  ['#5fa8c8', '#9a5fc8'],
  ['#d07a4a', '#4a9a8a'],
  ['#7a5fd0', '#d05f7a'],
];

// A system's nebulae: three clouds of glowing gas, each with the way to it
// (a unit vector, nearer the band than not), its colour, its size (radians)
// and how twisted it is. The first two are where the sky has always had them,
// in the pair of colours it always had: they take the system's numbers (rand)
// just after the sky's seed, as they always did, so the stars after them stay
// where they were too. The third, the sizes and the twists come from numbers
// of their own.
function nebulaeFrom(sys, rand) {
  const more = seeded(`${sys.id}/nebulae`);
  const toward = (r) => {
    const v = new THREE.Vector3(r() * 2 - 1, (r() * 2 - 1) * 0.5, r() * 2 - 1).normalize();
    return [v.x, v.y, v.z];
  };
  const dirs = [toward(rand), toward(rand)];
  const k = Math.floor(rand() * NEBULAE.length);
  const other = NEBULAE[(k + 1 + Math.floor(more() * (NEBULAE.length - 1))) % NEBULAE.length];
  const colors = [...NEBULAE[k], other[more() < 0.5 ? 0 : 1]];
  dirs.push(toward(more));
  return dirs.map((dir, i) => ({ dir, color: colors[i], size: 0.18 + more() * 0.27, warp: 0.6 + more() }));
}
export function nebulaeOf(sys) {
  const rand = seeded(sys.id);
  rand(); // (the sky's seed)
  return nebulaeFrom(sys, rand);
}

// the size of a face of the baked sky, in pixels, by lib/device's detail
// level (none given: 1024): the map's lens is narrow (34°), so the sky's
// magnified, and the more pixels a face the sharper it stays
const BAKE = { ultra: 2048, high: 1536, mid: 1024, low: 512 };
export const bakeSize = ({ small = false, level = null } = {}) => (small ? 512 : (BAKE[level] ?? 1024));
// and how many stars it has: today's 4,200 first, the rest fainter
const STAR_COUNT = { ultra: 12000, high: 12000, mid: 7000, low: 3000 };
export const starCount = ({ small = false, level = null } = {}) => (small ? 3000 : (STAR_COUNT[level] ?? TODAY));

export function createSky({ small = false, level = null, renderer = null, beacons: showBeacons = true } = {}) {
  const group = new THREE.Group();
  group.renderOrder = -20;
  const made = [];
  let gone = false;

  // the sphere you see: it looks the baked cube up (black till there is one)
  const skyGeo = new THREE.SphereGeometry(SKY_R, 64, 32);
  const lookMat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: LOOK_FRAG, uniforms: { uSky: { value: null }, uGrain: { value: grainMap() } }, side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(skyGeo, lookMat);
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  group.add(sky);
  made.push(skyGeo, lookMat);

  // what's baked into it, once a system (bake): the same sphere, with the
  // galaxy's shader on it, alone in a scene of its own, seen by a cube
  // camera from its middle
  const bakeMat = new THREE.ShaderMaterial({
    vertexShader: BAKE_VERT,
    fragmentShader: BAKE_FRAG,
    uniforms: {
      uCore: { value: new THREE.Vector3(1, 0, 0) },
      uNear: { value: 0.3 },
      uSide: { value: 0.3 },
      uSeed: { value: 0 },
      uNebDir: { value: [0, 1, 2].map(() => new THREE.Vector3(0, 0, 1)) },
      uNebCol: { value: [0, 1, 2].map(() => new THREE.Color()) },
      uNebShape: { value: [0, 1, 2].map(() => new THREE.Vector2(0.3, 1)) },
      uPano: { value: null },
      uPanoOn: { value: 0 },
    },
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
  });
  made.push(bakeMat);
  const bakeScene = new THREE.Scene();
  const bakeSphere = new THREE.Mesh(skyGeo, bakeMat);
  bakeSphere.frustumCulled = false;
  bakeScene.add(bakeSphere);
  // (no mipmaps: the sky's only ever magnified, and at 2048 they'd be another third)
  const cube = new THREE.WebGLCubeRenderTarget(bakeSize({ small, level }), { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, generateMipmaps: false, minFilter: THREE.LinearFilter });
  const cubeCamera = new THREE.CubeCamera(1, 10000, cube);

  // the stars: positions made per system (setSystem), drawn in one go
  const n = starCount({ small, level });
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
  starGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const starMat = new THREE.ShaderMaterial({ vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, uniforms: { uDpr: { value: 1 } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -19;
  group.add(stars);
  made.push(starGeo, starMat);

  // the system's suns (up to two)
  const sunGeo = new THREE.PlaneGeometry(2, 2);
  made.push(sunGeo);
  const suns = [0, 1].map(() => {
    const mat = new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms: { uColor: { value: new THREE.Color() } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    const m = new THREE.Mesh(sunGeo, mat);
    m.frustumCulled = false;
    m.renderOrder = -18;
    m.visible = false;
    group.add(m);
    made.push(mat);
    return m;
  });
  const sunDirs = [];

  // the other systems' stars (all but the one you're in)
  const nb = SYSTEMS.length - 1;
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nb * 3), 3));
  beaconGeo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(nb), 1));
  beaconGeo.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(nb * 3), 3));
  beaconGeo.setAttribute('aFocus', new THREE.BufferAttribute(new Float32Array(nb), 1));
  const beaconMat = new THREE.ShaderMaterial({ vertexShader: BEACON_VERT, fragmentShader: BEACON_FRAG, uniforms: { uDpr: { value: 1 }, uTime: { value: 0 } }, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
  const beaconPoints = new THREE.Points(beaconGeo, beaconMat);
  beaconPoints.frustumCulled = false;
  beaconPoints.renderOrder = -17;
  beaconPoints.visible = showBeacons;
  group.add(beaconPoints);
  made.push(beaconGeo, beaconMat);
  const beacons = [];
  const beaconColor = new THREE.Color();
  let focused = null;

  const tints = [
    [1, 1, 1],
    [0.78, 0.86, 1],
    [1, 0.9, 0.76],
    [1, 0.78, 0.62],
  ];

  // the game's star field for the system, loaded once a system and baked
  // in again when it's here (null: none, the sky as it was)
  let baked = null;
  let wanted = null;
  const panoramas = new Map(); // url → Promise<texture | null>
  const setPanorama = (sys) => {
    const url = panoramaUrl(sys, level);
    wanted = url;
    bakeMat.uniforms.uPanoOn.value = 0;
    bakeMat.uniforms.uPano.value = null;
    if (!url) return;
    if (!panoramas.has(url)) panoramas.set(url, loadPanorama(url, renderer));
    panoramas.get(url).then((tex) => {
      if (gone || !tex || wanted !== url) return;
      bakeMat.uniforms.uPano.value = tex;
      bakeMat.uniforms.uPanoOn.value = 1;
      if (baked) out.bake(baked);
    });
  };
  made.push({ dispose: () => panoramas.forEach((p) => p.then((t) => t?.dispose())) });

  const out = {
    group,
    // the directions toward the system's suns, unit vectors (bodies.js lights by them)
    sunDirs,
    beacons,
    setSystem(sys) {
      setPanorama(sys);
      const rand = seeded(sys.id);
      const { dir, d } = coreBearing(sys);
      const near = Math.max(0, 1 - d / RIM);
      // what the bake draws (bake: until then the sky is the last system's)
      const u = bakeMat.uniforms;
      u.uCore.value.set(...dir);
      u.uNear.value = near * near * 0.85 + near * 0.15;
      u.uSide.value = Math.min(0.95, Math.max(0, (d / RIM - 0.45) * 1.6));
      u.uSeed.value = rand() * 40;
      nebulaeFrom(sys, rand).forEach((nb, i) => {
        u.uNebDir.value[i].set(...nb.dir);
        u.uNebCol.value[i].set(nb.color);
        u.uNebShape.value[i].set(nb.size, nb.warp);
      });
      // the stars: half anywhere, the rest along the band, thickest toward the core
      const pos = starGeo.attributes.position.array;
      const size = starGeo.attributes.aSize.array;
      const col = starGeo.attributes.aColor.array;
      const v = new THREE.Vector3();
      const core = new THREE.Vector3(...dir);
      for (let i = 0; i < n; i++) {
        const k = rand();
        if (k < 0.5) v.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
        else {
          const a = rand() * Math.PI * 2;
          const lat = (rand() + rand() + rand() - 1.5) * 0.16;
          v.set(Math.cos(a), lat, Math.sin(a));
          if (k > 0.82) v.lerp(core, rand() * 0.45 * near + 0.05);
        }
        v.normalize();
        // fewer on the empty side, out at the rim
        if (u.uSide.value > 0.2 && v.dot(core) < -0.2 && rand() < u.uSide.value * 0.7) v.lerp(core, 0.9).normalize();
        pos[i * 3] = v.x * SKY_R * 0.98;
        pos[i * 3 + 1] = v.y * SKY_R * 0.98;
        pos[i * 3 + 2] = v.z * SKY_R * 0.98;
        const b = (0.18 + rand() ** 3 * 0.9) * (i < TODAY ? 1 : STARS_PAST);
        const t = tints[rand() < 0.66 ? 0 : Math.floor(rand() * tints.length)];
        col[i * 3] = t[0] * b;
        col[i * 3 + 1] = t[1] * b;
        col[i * 3 + 2] = t[2] * b;
        size[i] = 0.8 + rand() ** 5 * 2.6;
      }
      starGeo.attributes.position.needsUpdate = true;
      starGeo.attributes.aSize.needsUpdate = true;
      starGeo.attributes.aColor.needsUpdate = true;
      // its suns
      sunDirs.length = 0;
      suns.forEach((m, i) => {
        const s = sys.suns[i];
        m.visible = Boolean(s);
        if (!s) return;
        const d3 = new THREE.Vector3(...s.dir).normalize();
        sunDirs.push(d3);
        m.position.copy(d3).multiplyScalar(SUN_R);
        m.scale.setScalar(SUN_R * 0.11 * s.size);
        m.material.uniforms.uColor.value.set(s.color).multiplyScalar(2.2);
      });
      // the other systems: their stars where they are, the nearer the bigger
      // and brighter (each in its own star's colour; two suns, a bit more)
      beacons.length = 0;
      focused = null;
      const bp = beaconGeo.attributes.position.array;
      const bs = beaconGeo.attributes.aSize.array;
      const bc = beaconGeo.attributes.aColor.array;
      const bf = beaconGeo.attributes.aFocus.array;
      for (const o of SYSTEMS) {
        if (o === sys) continue;
        const i = beacons.length;
        const dir = new THREE.Vector3(...courseTo(sys, o));
        beacons.push({ id: o.id, dir });
        bp[i * 3] = dir.x * SKY_R * 0.97;
        bp[i * 3 + 1] = dir.y * SKY_R * 0.97;
        bp[i * 3 + 2] = dir.z * SKY_R * 0.97;
        const d = distance(sys, o);
        const near = 1 / (1 + d * 0.35);
        bs[i] = 9 + 16 * near + (o.suns.length > 1 ? 3 : 0);
        beaconColor.set(o.suns[0].color).lerp(new THREE.Color('#ffffff'), 0.25).multiplyScalar(1.1 + 2.4 * near);
        bc[i * 3] = beaconColor.r;
        bc[i * 3 + 1] = beaconColor.g;
        bc[i * 3 + 2] = beaconColor.b;
        bf[i] = 0;
      }
      beaconGeo.setDrawRange(0, beacons.length);
      for (const a of Object.values(beaconGeo.attributes)) a.needsUpdate = true;
    },
    // the star picked (an id, or null): it pulses
    focus(id) {
      if (id === focused) return;
      focused = id;
      const bf = beaconGeo.attributes.aFocus.array;
      beacons.forEach((b, i) => (bf[i] = b.id === id ? 1 : 0));
      beaconGeo.attributes.aFocus.needsUpdate = true;
    },
    // the sky and its stars round the camera, wherever it flies
    update(camera, t = 0) {
      group.position.copy(camera.position);
      beaconMat.uniforms.uTime.value = t;
    },
    setRatio(dpr) {
      starMat.uniforms.uDpr.value = dpr;
      beaconMat.uniforms.uDpr.value = dpr;
    },
    // the bake's shader made and linking now, as the bake will draw it (to the
    // cube, so no tone mapping); resolves once it has. The first bake is then a
    // draw, not a wait for a link, wherever in the game it comes
    prepare(r = renderer) {
      if (gone || !r) return Promise.resolve();
      return precompile(r, bakeScene, cubeCamera.children[0], bakeScene, cube);
    },
    // the system's sky (setSystem's) drawn into the cube, once, and the
    // sphere looking it up from then on; the renderer is left as it was
    bake(r = renderer) {
      if (gone || !r) return;
      baked = r;
      const was = { target: r.getRenderTarget(), face: r.getActiveCubeFace(), level: r.getActiveMipmapLevel(), autoClear: r.autoClear, toneMapping: r.toneMapping, xr: r.xr?.enabled };
      r.autoClear = true;
      r.toneMapping = THREE.NoToneMapping;
      try {
        cubeCamera.update(r, bakeScene);
      } finally {
        r.setRenderTarget(was.target, was.face, was.level);
        r.autoClear = was.autoClear;
        r.toneMapping = was.toneMapping;
        if (r.xr) r.xr.enabled = was.xr;
      }
      lookMat.uniforms.uSky.value = cube.texture;
    },
    dispose() {
      gone = true;
      for (const x of made) x.dispose();
      cube.dispose();
    },
  };
  return out;
}

// a panorama's KTX2, through the site's loader (lib/three/gltf.js's, its
// transcoder fetched the first time) and the asset base; null if it fails
function loadPanorama(url, renderer) {
  return Promise.all([import('../../lib/three/gltf'), import('../../lib/assetBase')])
    .then(([{ ktx2Loader }, { withFallback }]) => ktx2Loader({ renderer }).then((k) => withFallback((u) => k.loadAsync(u))(url)))
    .then((tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    })
    .catch(() => null);
}
