// The Quaternius crowns on a landing, Bruno Simon's way (folio-2025's
// Foliage.js and Trees.js: research note Part 2 §5): the leaf cards stay
// the models' own, and each card, as one, leans with the wind where it is,
// flutters a little, and turns its leaf picture about its middle by how
// hard it's blowing there (his crawl: the crown's edge seems to move);
// lit as one soft volume (its normals out from the crown's middle) in two
// tones, the sunny side warm and the shaded one cool, darker inside; and
// a crown between the camera and you, or a card at the lens, opens to let
// you see. One wind for the page (lib/three/wind.js's), read where each
// card is in the landing's own metres, so the gusts that move the crowns
// are those that move the leaves on the ground (./litter.js).
//
// models.js puts it on every foliage material (scripts/quaternius.mjs's
// `foliage` mark: the leaves, the flowers, the grass) once, as it's first
// loaded, and bakes what it reads into each geometry drawn with one: a
// card's middle and phase (aCard), how high up the model each vertex is
// and, in a crown, how deep in it (aCrown). Those materials are the
// loader's, kept for the page, so the uniforms are too: canopy() is made
// once and never freed, and each landing aims it (aimCanopy) and each frame
// moves it on (tickCanopy, not with motion turned down).
//
//   CANOPY, familyOf(node), crownMaterial(material), canopyLevel()
//   cardGroups(geometry) → Int32Array, bakeCanopy(geometry, { foot, top, family, crown })
//   canopy() → { wind, uniforms }; aimCanopy({ n, f, R }), lookCanopy(look),
//     windCanopy({ strength, angle }), tickCanopy(dt), sunCanopy(dir), seeCanopy(point | null)
//   canopyShader(shader, { level }) → { vertexShader, fragmentShader, swapped } (pure)
//
// The level is the page's, from the device (high 'full': the wind's two
// lookups; mid 'lite': its slow one; low 'still': no vertex work at all),
// fixed once read, so no material's shader ever changes under it.

import * as THREE from 'three';
import { WIND_GLSL, createWind } from '../../../lib/three/wind';
import { spherifyNormals } from '../../../lib/three/foliage';
import { device } from '../../../lib/device';
import { METRE } from '../foot';

export const CANOPY = {
  // each material's (by its name, tinted copies keeping it): its bend and
  // its flutter (in the geometry's own units: a kit's node is about 2
  // tall), the flutter's rad/s (whole numbers: the clock wraps at 200π),
  // and whether its picture crawls
  K: {
    Leaves_NormalTree: [0.06, 0.004, 14, 1],
    Leaves_Pine: [0.04, 0.002, 17, 0],
    Flowers: [0.12, 0.008, 11, 0],
    Leaves: [0.12, 0.008, 11, 0],
    Grass: [0.2, 0.01, 9, 0],
    other: [0.08, 0.005, 12, 0],
  },
  keep: { tree: 0.35, bush: 0.4, pine: 0.4 }, // how much of a crown's own normals it keeps (a pine's middle 0.4 of its height below its box's)
  crawl: 2.2, // (Bruno's |wind| · 2.2, at most crawlMax)
  crawlMax: 0.6,
  near: [0.4, 1.5], // metres from the lens a card goes over
  seeEdge: [0.9, 2.6], // metres round the line to you a crown opens over
  // the two tones (multiplying the leaf's own colour) and how much darker inside
  look: { lit: [1.06, 1.03, 0.9], shade: [0.9, 0.95, 1.0], depth: 0.22 },
};

export const familyOf = (node = '') => (/^CommonTree_/.test(node) ? 'tree' : /^Bush_/.test(node) ? 'bush' : /^Pine_/.test(node) ? 'pine' : /^Grass_/.test(node) ? 'grass' : /^(Flower_|Fern_)/.test(node) ? 'flower' : 'other');
const baseName = (n = '') => n.replace(/\.\d+$/, '');
// (a crown's cards, not a flower's or a blade's)
export const crownMaterial = (m) => /^Leaves_(NormalTree|Pine)$/.test(baseName(m?.name));
export const canopyK = (m) => CANOPY.K[baseName(m?.name)] ?? CANOPY.K.other;

let level = null;
export function canopyLevel() {
  if (level) return level;
  try {
    const t = device().tier;
    level = t === 'high' ? 'full' : t === 'mid' ? 'lite' : 'still';
  } catch {
    level = 'full';
  }
  return level;
}

// Which card each vertex is on: the vertices its triangles join, whatever
// order they're in (the GLBs' are each a block of 4); numbered from 0
export function cardGroups(geometry) {
  const n = geometry.attributes.position.count;
  const up = new Int32Array(n);
  for (let i = 0; i < n; i++) up[i] = i;
  const find = (i) => {
    while (up[i] !== i) {
      up[i] = up[up[i]];
      i = up[i];
    }
    return i;
  };
  const join = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) up[ra] = rb;
  };
  const idx = geometry.index;
  const tris = idx ? idx.count : n;
  for (let t = 0; t + 2 < tris; t += 3) {
    const a = idx ? idx.getX(t) : t;
    join(a, idx ? idx.getX(t + 1) : t + 1);
    join(a, idx ? idx.getX(t + 2) : t + 2);
  }
  const out = new Int32Array(n);
  const ids = new Map();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!ids.has(r)) ids.set(r, ids.size);
    out[i] = ids.get(r);
  }
  return out;
}

// What the canopy reads, baked into a geometry once: each vertex's card's
// middle (its own units) and a phase of the card's (aCard), how high up
// the model it is from `foot` to `top` (its own y), and in a crown, how
// deep in it its card is and that it's a crown (aCrown); a crown of a tree,
// a bush or a pine has its normals pointed out from its middle too
const baked = new WeakSet();
const hash = (k) => {
  const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};
export function bakeCanopy(geometry, { foot = -1, top = 1, family = 'other', crown = false } = {}) {
  if (!geometry?.attributes?.position || baked.has(geometry)) return geometry;
  baked.add(geometry);
  const pos = geometry.attributes.position;
  const n = pos.count;
  const group = cardGroups(geometry);
  let groups = 0;
  for (let i = 0; i < n; i++) groups = Math.max(groups, group[i] + 1);
  const sum = new Float64Array(groups * 4);
  for (let i = 0; i < n; i++) {
    const g = 4 * group[i];
    sum[g] += pos.getX(i);
    sum[g + 1] += pos.getY(i);
    sum[g + 2] += pos.getZ(i);
    sum[g + 3] += 1;
  }
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const c = geometry.boundingBox.getCenter(new THREE.Vector3());
  const r = geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const card = new Float32Array(4 * n);
  const tone = new Uint8Array(4 * n);
  const span = top - foot || 1;
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  for (let i = 0; i < n; i++) {
    const g = 4 * group[i];
    const k = sum[g + 3];
    const x = sum[g] / k;
    const y = sum[g + 1] / k;
    const z = sum[g + 2] / k;
    card.set([x, y, z, hash(group[i])], 4 * i);
    tone[4 * i] = Math.round(clamp01((pos.getY(i) - foot) / span) * 255);
    if (crown) {
      const d = Math.hypot((x - c.x) / Math.max(1e-6, r.x), (y - c.y) / Math.max(1e-6, r.y), (z - c.z) / Math.max(1e-6, r.z));
      tone[4 * i + 1] = Math.round(clamp01(1 - d) * 255);
      tone[4 * i + 2] = 255;
    }
  }
  geometry.setAttribute('aCard', new THREE.BufferAttribute(card, 4));
  geometry.setAttribute('aCrown', new THREE.BufferAttribute(tone, 4, true));
  const keep = CANOPY.keep[family];
  if (crown && keep != null) spherifyNormals(geometry, { keep, centre: family === 'pine' ? c.clone().setY(c.y - 0.4 * r.y) : c, radii: r });
  return geometry;
}

// ── the page's one canopy ──

let one = null;
const tmp = new THREE.Vector3();
export function canopy() {
  if (one) return one;
  const wind = createWind({ strength: 0.45, angle: 0.6 * Math.PI });
  const uniforms = {
    ...wind.uniforms,
    uCanopyE1: { value: new THREE.Vector3(1, 0, 0) },
    uCanopyE2: { value: new THREE.Vector3(0, 0, 1) },
    uCanopyWind: { value: new THREE.Vector3(1, 0, 0) },
    uCanopyRm: { value: 1 },
    uCanopyClock: { value: 0 },
    uCanopySun: { value: new THREE.Vector3(0, 1, 0) },
    uCanopyLit: { value: new THREE.Vector3(...CANOPY.look.lit) },
    uCanopyShade: { value: new THREE.Vector3(...CANOPY.look.shade) },
    uCanopyDepth: { value: CANOPY.look.depth },
    uCanopySee: { value: new THREE.Vector4(0, 0, 0, 0) },
    uCanopySeeEdge: { value: new THREE.Vector2(CANOPY.seeEdge[0] * METRE, CANOPY.seeEdge[1] * METRE) },
    uCanopyNear: { value: new THREE.Vector2(CANOPY.near[0] * METRE, CANOPY.near[1] * METRE) },
  };
  one = { wind, uniforms };
  return one;
}

// the wind's way (its x and z on the landing's chart) in the planet's space
const aimWind = () => {
  const u = canopy().uniforms;
  const d = u.uWindDir.value;
  u.uCanopyWind.value.copy(u.uCanopyE1.value).multiplyScalar(d.x).addScaledVector(u.uCanopyE2.value, d.y);
};

// laid on a landing's frame ({ n, f }: where it's laid from, the planet's
// space, R its radius): x along n × f, as place() has it (foot.js), z along f
export function aimCanopy({ n, f, R }) {
  const u = canopy().uniforms;
  const N = tmp.set(...n);
  u.uCanopyE2.value.set(...f).normalize();
  u.uCanopyE1.value.crossVectors(N, u.uCanopyE2.value).normalize();
  u.uCanopyRm.value = R / METRE;
  aimWind();
}

export function lookCanopy(look = null) {
  const l = { ...CANOPY.look, ...(look ?? {}) };
  const u = canopy().uniforms;
  u.uCanopyLit.value.set(...l.lit);
  u.uCanopyShade.value.set(...l.shade);
  u.uCanopyDepth.value = l.depth;
}

export function windCanopy({ strength = null, angle = null } = {}) {
  canopy().wind.set({ strength, angle });
  aimWind();
}

export function tickCanopy(dt) {
  if (!(dt > 0)) return;
  const { wind, uniforms } = canopy();
  wind.update(dt);
  uniforms.uCanopyClock.value = (uniforms.uCanopyClock.value + dt) % (200 * Math.PI);
}

// toward the sun, in the world
export function sunCanopy(dir) {
  const u = canopy().uniforms.uCanopySun.value;
  u.copy(dir);
  if (u.lengthSq() < 1e-12) u.set(0, 1, 0);
  u.normalize();
}

// where you are (your chest, in the world), for a crown in the way to
// open round; null: none
export function seeCanopy(point = null) {
  const u = canopy().uniforms.uCanopySee.value;
  if (point) u.set(point.x, point.y, point.z, 1);
  else u.w = 0;
}

// ── the shader ──

// the wind's slow lookup alone (the 'lite' level): the same uniforms
const WIND_LITE = /* glsl */ `
uniform sampler2D uWindNoise;
uniform float uWindTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
vec2 windOffset(vec2 xz) {
  float b = texture2D(uWindNoise, xz * 0.05 + uWindDir * uWindTime * 0.2).r;
  return uWindDir * (2.0 * b - 1.0) * uWindStrength;
}
`;

const VERTEX_PARS = (lvl) => /* glsl */ `
${lvl === 'still' ? '#define CANOPY_STILL' : ''}
attribute vec4 aCard; // its card's middle (the geometry's units), w its phase
attribute vec4 aCrown; // x how high up the model 0…1, y how deep in the crown, z a crown's 1
uniform vec3 uCanopyE1;
uniform vec3 uCanopyE2;
uniform float uCanopyRm;
uniform vec3 uCanopyWind;
uniform float uCanopyClock;
uniform vec4 uCanopyK;
varying vec2 vCanopy;
${lvl === 'full' ? WIND_GLSL : lvl === 'lite' ? WIND_LITE : ''}
// (where a point of the planet's space is on the landing's chart, metres)
vec2 canopyXz(vec3 p) { vec3 d = normalize(p); return vec2(dot(d, uCanopyE1), dot(d, uCanopyE2)) * uCanopyRm; }
`;

// each card as one: leaning the wind's way by the square of how high up it
// is, fluttering, its picture turned about its middle (in the planet's
// space: the instance's matrix stands it there, the meshes over it unmoved;
// none of it at the 'still' level)
const MOTION = (lvl) => /* glsl */ `
vCanopy = aCrown.yz;
${lvl === 'still' ? '' : `#if defined(USE_INSTANCING) && !defined(CANOPY_STILL)
{
  mat3 cnM = mat3(instanceMatrix);
  vec2 cnW = windOffset(canopyXz((instanceMatrix * vec4(aCard.xyz, 1.0)).xyz));
  float cnG = dot(cnW, uWindDir);
  vec3 cnUp = normalize(transpose(cnM) * normalize(instanceMatrix[3].xyz));
  vec3 cnDir = transpose(cnM) * uCanopyWind;
  cnDir = normalize(cnDir - cnUp * dot(cnDir, cnUp) + vec3(1e-6));
  float cnH = aCrown.x;
  transformed += cnDir * (uCanopyK.x * cnH * cnH * (0.5 * uWindStrength + cnG));
  float cnF = sin(uCanopyClock * uCanopyK.z + aCard.w * 6.2831853) * uCanopyK.y * cnH * (0.35 + 2.5 * abs(cnG));
  transformed += cnUp * (0.5 * cnF) + cnDir * cnF;
  #ifdef USE_MAP
    // (Bruno's crawl, Foliage.js: the leaf picture turned by the wind there)
    float cnA = min(length(cnW) * ${CANOPY.crawl.toFixed(2)}, ${CANOPY.crawlMax.toFixed(2)}) * uCanopyK.w;
    vec2 cnUv = vMapUv - 0.5;
    vMapUv = vec2(cos(cnA) * cnUv.x - sin(cnA) * cnUv.y, sin(cnA) * cnUv.x + cos(cnA) * cnUv.y) + 0.5;
  #endif
}
#endif`}
`;

const FRAGMENT_PARS = /* glsl */ `
uniform vec3 uCanopySun;
uniform vec3 uCanopyLit;
uniform vec3 uCanopyShade;
uniform float uCanopyDepth;
uniform vec4 uCanopySee;
uniform vec2 uCanopySeeEdge;
uniform vec2 uCanopyNear;
varying vec2 vCanopy;
`;

// a card at the lens goes; a crown between the camera and you opens round
// the line to you (Bruno's Trees); the cut does the rest
const KEEP = /* glsl */ `
#ifdef USE_ALPHATEST
{
  vec3 cnAt = -vViewPosition;
  float cnKeep = smoothstep(uCanopyNear.x, uCanopyNear.y, -cnAt.z);
  if (uCanopySee.w > 0.5 && vCanopy.y > 0.5) {
    vec3 cnMe = (viewMatrix * vec4(uCanopySee.xyz, 1.0)).xyz;
    if (cnAt.z > cnMe.z) cnKeep *= smoothstep(uCanopySeeEdge.x, uCanopySeeEdge.y, length(cnAt.xy / -cnAt.z - cnMe.xy / -cnMe.z) * -cnMe.z);
  }
  diffuseColor.a *= cnKeep;
}
#endif
`;

// Bruno's two tones (Foliage.js), as a multiplier: the leaf's own picture
// stays, warmer toward the sun, cooler away, darker deep in
const TONE = /* glsl */ `
{
  float cnL = smoothstep(-0.2, 0.8, dot(normal, normalize(mat3(viewMatrix) * uCanopySun)));
  vec3 cnTone = mix(uCanopyShade, uCanopyLit, cnL) * (1.0 - uCanopyDepth * smoothstep(0.0, 0.75, vCanopy.x));
  diffuseColor.rgb *= mix(vec3(1.0), cnTone, vCanopy.y);
}
`;

// The rewrite, as pure strings: the motion after three's begin_vertex, the
// keep before its alpha test, the tone once its normal is known (before
// the lights read the colour). A part whose line isn't there is left out,
// and says so in `swapped` (the fragment's need the vertex's varying).
export function canopyShader({ vertexShader, fragmentShader }, { level: lvl = canopyLevel() } = {}) {
  const swapped = { motion: false, keep: false, tone: false };
  if (!vertexShader.includes('#include <common>') || !vertexShader.includes('#include <begin_vertex>')) return { vertexShader, fragmentShader, swapped };
  const vs = vertexShader.replace('#include <common>', `#include <common>\n${VERTEX_PARS(lvl)}`).replace('#include <begin_vertex>', `#include <begin_vertex>\n${MOTION(lvl)}`);
  swapped.motion = true;
  let fs = fragmentShader;
  if (!fs.includes('#include <common>')) return { vertexShader: vs, fragmentShader, swapped };
  if (fs.includes('#include <alphatest_fragment>')) {
    fs = fs.replace('#include <alphatest_fragment>', `${KEEP}#include <alphatest_fragment>`);
    swapped.keep = true;
  }
  if (fs.includes('#include <normal_fragment_maps>')) {
    fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${TONE}`);
    swapped.tone = true;
  }
  if (swapped.keep || swapped.tone) fs = fs.replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`);
  return { vertexShader: vs, fragmentShader: fs, swapped };
}
