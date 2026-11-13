// The big things as landmarks: the Maw, the Veil and the Cradle, and the
// big stars (Ember, Halcyon, the Twins, the Lantern, the home sun, and in
// the Rick and Morty sector the Curve's sun), drawn on the sky in their true
// direction at skyFar (deepspace.js's SKY_FAR), so they read from anywhere
// on the map. Each is drawn at least so big across (`least`: the Maw 4°, a
// nebula 14°, a star's glare 4°, the Lantern 2.5°), and as it grows past
// that on the way in, at its true size; past where it's real (`real`: where
// its true size meets the least, for the Maw and the nebulae; forty of its
// radii for a star; twenty of its reach for the Lantern) it's all landmark
// and the real thing is hidden; inside, the real thing; over a fifth either
// side they crossfade (landK), so nothing pops.
//
// How each looks: a star as galaxy/sky.js draws a system's sun (a white-hot
// disc in a glare and faint rays, in its colour); the Lantern a blue-white
// point with two beams sweeping round; the Maw a black shadow, its disk
// tipped as maw.js's TILT has it (white-blue hot inside to red outside, the
// side coming toward you brighter, swirling), the far side of it bent up
// over the top and a thin photon ring; a nebula a cloud painted once into an
// atlas (warped noise in its own colours, dark dust lanes across it that
// dim what's behind, a few young stars), each its own cell.
//
// The rules (LANDMARKS, drawnAngle, landK) are pure and tested;
// createLandmarks draws them all as one instanced quad, one draw call,
// premultiplied (light adds; the Maw's shadow and the dust take away),
// depth test off, in the opaque list just after the far stars (farStars.js)
// so anything solid drawn after covers it.
//
// createLandmarks(parent, { renderer, small, level, skyFar })
//   → { mesh, update(camera, t, { sector, groups }), kOf(id) → 0 (real) … 1 (landmark) | null, dispose() }
// `groups(id)` is the real thing's group (deep.js's wonder, or the home
// sun's), or null; `t` the scene's clock (the Twins go round on it).

import * as THREE from 'three';
import { WONDERS, binaryAt, reachOf } from './deep';
import { SUN } from './layout';
import { TILT } from './maw';
import { UPRIGHT_GLSL } from '../../lib/three/upright';

const deg = (d) => (d * Math.PI) / 180;
const LEAST = { hole: deg(4), nebula: deg(14), star: deg(4), pulsar: deg(2.5) };
const KIND = { star: 0, hole: 1, nebula: 2, pulsar: 3 };
const STAR_REAL = 40; // a star is real within this many of its radii
const PULSAR_REAL = 20; // the Lantern within this many of its reach
const FADE = 0.2; // the crossfade, a fifth either side of real

// the angle across it's drawn at: its true size, or the least, whichever's bigger
export const drawnAngle = (r, dist, least) => Math.max(least, 2 * Math.atan(r / Math.max(dist, 1e-6)));
// 0 inside 0.8 of real (the real thing), 1 past 1.2 (the landmark)
export function landK(dist, real) {
  const t = Math.min(1, Math.max(0, (dist - real * (1 - FADE)) / (real * 2 * FADE)));
  return t * t * (3 - 2 * t);
}
// where the true size meets the least
const meets = (r, least) => r / Math.tan(least / 2);

const wonder = (id) => WONDERS.find((w) => w.id === id);
const star = (w) => ({ id: w.id, kind: 'star', group: w.id, r: w.r, least: LEAST.star, real: w.r * STAR_REAL, colors: [w.color], sector: w.sector ?? 'main' });
const twins = wonder('twins');
const maw = wonder('maw');
const lantern = wonder('lantern');
export const LANDMARKS = [
  { id: 'maw', kind: 'hole', group: 'maw', r: maw.disk, least: LEAST.hole, real: meets(maw.disk, LEAST.hole), colors: ['#fff3e0', '#ff6a2a'], sector: 'main' },
  ...['veil', 'cradle'].map((id, cell) => {
    const w = wonder(id);
    return { id, kind: 'nebula', group: id, r: w.r, least: LEAST.nebula, real: meets(w.r, LEAST.nebula), colors: w.colors, sector: 'main', cell };
  }),
  ...['ember', 'halcyon', 'curvesun'].map((id) => star(wonder(id))),
  { id: 'sun', kind: 'star', group: 'sun', r: SUN.r, least: LEAST.star, real: SUN.r * STAR_REAL, colors: ['#ffcf6a'], sector: 'main' },
  { id: 'twins', kind: 'star', group: 'twins', part: 0, r: twins.r, least: LEAST.star, real: twins.r * STAR_REAL, colors: [twins.color], sector: 'main' },
  { id: 'twins', kind: 'star', group: 'twins', part: 1, r: twins.pair.r, least: LEAST.star, real: twins.r * STAR_REAL, colors: [twins.pair.color], sector: 'main' },
  { id: 'lantern', kind: 'pulsar', group: 'lantern', r: lantern.r, least: LEAST.pulsar, real: reachOf(lantern) * PULSAR_REAL, colors: [lantern.color], sector: 'main' },
];
export const LANDMARK_IDS = new Set(LANDMARKS.map((l) => l.id));

// where each is now (the Twins go round each other)
function centreOf(l, t) {
  if (l.group !== 'twins') return l.id === 'sun' ? SUN.at : wonder(l.id).at;
  const { a, b } = binaryAt(twins, t);
  return l.part === 0 ? a : b;
}
// the Maw's disk's normal, in its own (the map's) space
const MAW_AXIS = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...TILT));

const NOISE = /* glsl */ `
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}`;

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute float aSize;
attribute float aKind;
attribute vec3 aCol0;
attribute vec3 aCol1;
attribute float aK;
attribute float aCell;
attribute vec3 aAxis;
uniform float uFar;
uniform float uTime;
varying vec2 vUv;
varying float vKind;
varying vec3 vCol0;
varying vec3 vCol1;
varying float vK;
varying float vCell;
varying vec3 vAxis;
${UPRIGHT_GLSL}
void main() {
  vUv = position.xy;
  vKind = aKind;
  vCol0 = aCol0;
  vCol1 = aCol1;
  vK = aK;
  vCell = aCell;
  vAxis = normalize((modelViewMatrix * vec4(aAxis, 0.0)).xyz);
  float extent = uFar * tan(aSize * 0.5);
  vec4 mv;
  if (aKind > 1.5 && aKind < 2.5) {
    // a nebula is a thing on the sky, not in the lens: turned toward the
    // eye and kept upright to the map (lib/three/upright.js), so its clouds
    // don't spin round as the ship banks; and breathing, a slow swell of a
    // few per cent on a beat of its own
    vec3 c = (modelMatrix * vec4(aCenter, 1.0)).xyz;
    float breath = 1.0 + 0.03 * sin(uTime * 0.05 + aCell * 2.3);
    mv = viewMatrix * vec4(upright(c, position.xy * extent * breath), 1.0);
  } else {
    // a star's glare and rays are the lens's: square to the screen
    mv = modelViewMatrix * vec4(aCenter, 1.0);
    mv.xy += position.xy * extent;
  }
  gl_Position = aK > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
  // (never cut by the far plane: on foot it's at the landing's sky,
  // footScene's far(), which the landmarks are well past)
  if (aK > 0.0) gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999999);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uHasAtlas;
uniform float uTime;
varying vec2 vUv;
varying float vKind;
varying vec3 vCol0;
varying vec3 vCol1;
varying float vK;
varying float vCell;
varying vec3 vAxis;
// a big sun, from far off (galaxy/sky.js's, made to carry across the map):
// a white-hot disc in a wide glare of its colour, with long faint rays
vec3 sunOf(vec2 uv, vec3 col) {
  float r = length(uv);
  float disc = smoothstep(0.06, 0.045, r);
  float glow = exp(-r * 6.0) * 1.1 + exp(-r * 2.2) * 0.32;
  float a = atan(uv.y, uv.x);
  float rays = pow(abs(cos(a * 3.0)), 40.0) * exp(-r * 2.6) * 0.5 + pow(abs(cos(a * 2.0 + 0.6)), 70.0) * exp(-r * 3.0) * 0.32;
  return (col * 1.6 * (glow + rays) + vec3(6.0) * disc) * smoothstep(1.0, 0.65, r);
}
void main() {
  vec2 uv = vUv;
  float r = length(uv);
  if (r > 1.0) discard;
  vec4 c = vec4(0.0);
  if (vKind < 0.5) {
    c = vec4(sunOf(uv, vCol0), 0.0);
  } else if (vKind < 1.5) {
    // the Maw: its disk as an ellipse, squashed along the axis as seen
    vec2 ax = length(vAxis.xy) > 1e-3 ? normalize(vAxis.xy) : vec2(0.0, 1.0);
    vec2 major = vec2(ax.y, -ax.x);
    float tilt = max(abs(vAxis.z), 0.08);
    vec2 p = vec2(dot(uv, major), dot(uv, ax) / tilt);
    float rd = length(p);
    float ring = smoothstep(0.28, 0.36, rd) * (1.0 - smoothstep(0.78, 1.0, rd));
    float ang = atan(p.y, p.x);
    float swirl = 0.75 + 0.25 * sin(ang * 5.0 + 9.0 / max(rd, 0.2) - uTime * 0.7) * sin(ang * 3.0 - rd * 14.0);
    vec3 hot = mix(vCol0 * 2.2, vCol1 * 1.1, smoothstep(0.3, 0.95, rd));
    float doppler = 1.0 + 0.55 * (p.x / max(rd, 1e-3));
    // the far half of the disk is behind the shadow; the near half crosses it
    float shadow = 1.0 - smoothstep(0.14, 0.155, r);
    float near = step(dot(uv, ax), 0.0);
    vec3 disk = hot * ring * swirl * doppler * mix(1.0 - shadow, 1.0, near);
    // the far side bent up over the top, hugging the shadow; the photon ring
    float up = dot(r > 1e-3 ? uv / r : vec2(0.0), ax);
    float arc = exp(-pow((r - 0.24) / 0.05, 2.0)) * smoothstep(-0.3, 0.6, up) * 0.9;
    float photon = exp(-pow((r - 0.16) / 0.008, 2.0)) * 0.9;
    vec3 light = disk + hot * arc + vCol0 * photon * 1.6;
    float edge = smoothstep(1.0, 0.85, r);
    c = vec4(light * edge, shadow * (1.0 - near * ring));
  } else if (vKind < 2.5) {
    // a nebula: its cell of the atlas (light, and the dust's dimming)
    if (uHasAtlas > 0.5) {
      // its gas billowing: the painting read through a slow flow (a
      // couple of per cent of it, never a turn), its glow breathing
      float tt = uTime * 0.06 + vCell * 9.0;
      vec2 flow = vec2(sin(uv.y * 5.0 + tt) + sin(uv.y * 2.3 - tt * 0.7), cos(uv.x * 4.3 - tt * 0.8) + cos(uv.x * 1.9 + tt * 0.5)) * 0.012;
      vec2 wv = uv + flow * smoothstep(1.0, 0.6, r);
      vec2 cell = vec2((clamp(wv.x, -1.0, 1.0) * 0.5 + 0.5 + vCell) * 0.5, clamp(wv.y, -1.0, 1.0) * 0.5 + 0.5);
      vec4 t = texture2D(uAtlas, cell);
      float glow = 0.94 + 0.06 * sin(uTime * 0.08 + vCell * 4.1);
      c = vec4(t.rgb * glow, t.a * 0.6);
    }
  } else {
    // the Lantern: a point in a glare, two beams sweeping round
    float a = uTime * 1.6;
    vec2 dir = vec2(cos(a), sin(a));
    float across = abs(dot(uv, vec2(-dir.y, dir.x)));
    float beam = exp(-across * 38.0) * exp(-r * 1.4) * 0.8;
    vec3 col = vCol0 * (exp(-r * 7.0) + beam) + vec3(5.0) * smoothstep(0.06, 0.03, r);
    c = vec4(col * smoothstep(1.0, 0.8, r), 0.0);
  }
  gl_FragColor = c * vK;
}`;

// the nebulae, painted once: each cell's light (rgb) and its dust (a)
const PAINT_VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const PAINT_FRAG = /* glsl */ `
uniform vec3 uCol[6];
varying vec2 vUv;
${NOISE}
void main() {
  float cell = vUv.x < 0.5 ? 0.0 : 1.0;
  vec2 p = vec2(fract(vUv.x * 2.0), vUv.y) * 2.0 - 1.0;
  vec3 c0 = cell < 0.5 ? uCol[0] : uCol[3];
  vec3 c1 = cell < 0.5 ? uCol[1] : uCol[4];
  vec3 c2 = cell < 0.5 ? uCol[2] : uCol[5];
  vec2 s = p * 2.2 + cell * 17.3;
  vec2 q = vec2(fbm(s), fbm(s + vec2(5.2, 1.3))) - 0.5;
  vec2 w = s + q * 2.4;
  float gas = fbm(w);
  float rr = length(p + q * 0.3);
  float m = exp(-rr * rr * 1.3) * (1.0 - smoothstep(0.78, 1.0, length(p)));
  float body = smoothstep(0.22, 0.8, gas * (0.6 + 0.8 * m)) * m;
  float mixc = fbm(w * 1.7 + 3.1);
  vec3 col = mix(c0, c1, smoothstep(0.35, 0.65, mixc));
  col = mix(col, c2, smoothstep(0.6, 0.85, fbm(w * 2.3 + 8.0)) * 0.6);
  col = mix(col, vec3(dot(col, vec3(0.45))), body * body * 0.35);
  float dust = smoothstep(0.55, 0.78, fbm(w * 3.1 + vec2(11.0, 4.0))) * m;
  vec3 light = col * body * 0.75 * (1.0 - dust * 0.8) + c0 * m * 0.05;
  // a few young stars in the thick of it
  vec2 g = floor(vUv * vec2(512.0, 256.0));
  float st = step(0.9985, hash2(g + cell * 91.0)) * body;
  light += vec3(1.4, 1.35, 1.25) * st;
  gl_FragColor = vec4(light, dust * 0.9);
}`;

// the atlas's cell size, by the detail level (lib/device)
const cellSize = ({ small, level }) => (!small && (level === 'high' || level === 'ultra') ? 1024 : 512);

export function createLandmarks(parent, { renderer = null, small = false, level = null, skyFar }) {
  const n = LANDMARKS.length;
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.instanceCount = n;
  const inst = (size) => new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
  const A = { aCenter: inst(3), aSize: inst(1), aKind: inst(1), aCol0: inst(3), aCol1: inst(3), aK: inst(1), aCell: inst(1), aAxis: inst(3) };
  for (const [k, a] of Object.entries(A)) geo.setAttribute(k, a);
  const col = new THREE.Color();
  LANDMARKS.forEach((l, i) => {
    A.aKind.setX(i, KIND[l.kind]);
    col.set(l.colors[0]).convertSRGBToLinear();
    A.aCol0.setXYZ(i, col.r, col.g, col.b);
    col.set(l.colors[1] ?? l.colors[0]).convertSRGBToLinear();
    A.aCol1.setXYZ(i, col.r, col.g, col.b);
    A.aCell.setX(i, l.cell ?? 0);
    A.aAxis.setXYZ(i, MAW_AXIS.x, MAW_AXIS.y, MAW_AXIS.z);
  });

  // the nebulae's atlas, painted once (with no renderer, as in Node, none:
  // the nebulae aren't drawn)
  let atlas = null;
  if (renderer) {
    const size = cellSize({ small, level });
    atlas = new THREE.WebGLRenderTarget(size * 2, size, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const neb = LANDMARKS.filter((l) => l.kind === 'nebula');
    const cols = neb.flatMap((l) => [0, 1, 2].map((k) => new THREE.Color(l.colors[k] ?? l.colors[0]).convertSRGBToLinear()));
    const paint = new THREE.ShaderMaterial({ vertexShader: PAINT_VERT, fragmentShader: PAINT_FRAG, uniforms: { uCol: { value: cols } }, depthTest: false, depthWrite: false });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), paint));
    const was = { target: renderer.getRenderTarget(), toneMapping: renderer.toneMapping, autoClear: renderer.autoClear };
    try {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.autoClear = true;
      renderer.setRenderTarget(atlas);
      renderer.render(scene, new THREE.Camera());
    } finally {
      renderer.setRenderTarget(was.target);
      renderer.toneMapping = was.toneMapping;
      renderer.autoClear = was.autoClear;
      scene.children[0].geometry.dispose();
      paint.dispose();
    }
  }

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uFar: { value: skyFar }, uAtlas: { value: atlas?.texture ?? null }, uHasAtlas: { value: atlas ? 1 : 0 }, uTime: { value: 0 } },
    // premultiplied: light adds, the shadow and the dust take away what's behind
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: false,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'landmarks';
  mesh.renderOrder = -8;
  mesh.frustumCulled = false;
  parent.add(mesh);

  const hidden = new Map(); // group → whether this hid it (only its own undone)
  const ks = LANDMARKS.map(() => 1);
  const camAt = new THREE.Vector3();
  return {
    mesh,
    update(camera, t = 0, { sector = 'main', groups = () => null } = {}) {
      mat.uniforms.uTime.value = t;
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      const hideGroup = new Map();
      LANDMARKS.forEach((l, i) => {
        const at = centreOf(l, t);
        const dx = at[0] - camAt.x;
        const dy = at[1] - camAt.y;
        const dz = at[2] - camAt.z;
        const dist = Math.hypot(dx, dy, dz);
        const here = l.sector === sector;
        const k = here ? landK(dist, l.real) : 0;
        ks[i] = here ? k : 1;
        const s = dist > 1e-6 ? skyFar / dist : 0;
        A.aCenter.setXYZ(i, camAt.x + dx * s, camAt.y + dy * s, camAt.z + dz * s);
        A.aSize.setX(i, drawnAngle(l.r, dist, l.least));
        A.aK.setX(i, k);
        // the real thing: hidden while it's all landmark, or in another sector
        const hide = !here || k >= 1;
        hideGroup.set(l.group, (hideGroup.get(l.group) ?? true) && hide);
      });
      for (const [id, hide] of hideGroup) {
        const g = groups(id);
        if (!g) continue;
        if (hide !== (hidden.get(g) ?? false)) g.visible = !hide;
        hidden.set(g, hide);
      }
      for (const a of Object.values(A)) a.needsUpdate = true;
    },
    // how much of a landmark it is now (the nearest part, for the Twins)
    kOf(id) {
      let best = null;
      LANDMARKS.forEach((l, i) => {
        if (l.id === id) best = best === null ? ks[i] : Math.min(best, ks[i]);
      });
      return best;
    },
    dispose() {
      for (const [g, was] of hidden) if (was) g.visible = true;
      parent.remove(mesh);
      geo.dispose();
      quad.dispose();
      mat.dispose();
      atlas?.dispose();
    },
  };
}
