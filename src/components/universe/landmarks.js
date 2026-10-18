// The big things as landmarks: the Maw and the big stars (Ember, Halcyon, the
// Twins, the Lantern, the home sun, and in the Rick and Morty sector the
// Curve’s sun), drawn on the sky in their true direction at skyFar
// (deepspace.js’s SKY_FAR), so they read from anywhere on the map. Each is
// drawn at least so big across (`least`: the Maw 4°, a star’s glare 4°, the
// Lantern 2.5°), and as it grows past that on the way in, at its true size;
// past where it’s real (`real`: where its true size meets the least, for the
// Maw; forty of its radii for a star; twenty of its reach for the Lantern)
// it’s all landmark and the real thing is hidden; inside, the real thing;
// over a fifth either side they crossfade (landK), so nothing pops.
//
// How each looks: a star as galaxy/sky.js draws a system’s sun (a white-hot
// disc in a glare and faint rays, in its colour); the Lantern a blue-white
// point with two beams sweeping round; the Maw a black shadow, its disk
// tipped as maw.js’s TILT has it (white-blue hot inside to red outside, the
// side coming toward you brighter, swirling), the far side of it bent up
// over the top and a thin photon ring.
//
// The nebulae, the Veil and the Cradle, are not drawn here: nebula/ draws
// them, fixed in the world. Their rows stay in LANDMARKS as data, last and
// outside the draw’s instanceCount, because aim.js makes them places to aim
// and jump at, farStars.js keeps them off the far stars through
// LANDMARK_IDS, and scene.js reads their kOf for names. NEBULAE is what the
// renderer is handed.
//
// The rules (LANDMARKS, drawnAngle, landK, quadAxes) are pure and tested;
// createLandmarks draws them all as one instanced quad, one draw call,
// premultiplied (light adds; the Maw’s shadow takes away). Each quad stands
// upright in the world (quadAxes: its up is the map’s up, not the screen’s),
// and is depth-tested, in the opaque list just after the far stars
// (farStars.js), so a nearer solid covers it.
//
// createLandmarks(parent, { skyFar })
//   → { mesh, update(camera, t, { sector, groups }), kOf(id) → 0 (real) … 1 (landmark) | null, dispose() }
// `groups(id)` is the real thing’s group (deep.js’s wonder, or the home
// sun’s), or null; `t` the scene’s clock (the Twins go round on it).

import * as THREE from 'three';
import { WONDERS, binaryAt, reachOf } from './deep';
import { SUN } from './layout';
import { TILT } from './maw';

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

// A quad facing along dir, standing upright in the world: right is level, up
// leans toward the map’s +y (never below it), so a landmark doesn’t spin with
// the ship’s roll. Straight up or down there is no level, so the map’s +x
// stands in. (The vertex shader works the same out, from the same rule.)
export function quadAxes(dir) {
  const [x, y, z] = dir;
  const ref = Math.abs(y) > 0.999 ? [1, 0, 0] : [0, 1, 0];
  let r = [y * ref[2] - z * ref[1], z * ref[0] - x * ref[2], x * ref[1] - y * ref[0]]; // dir × ref
  const rl = Math.hypot(...r);
  r = r.map((v) => v / rl);
  const u = [r[1] * z - r[2] * y, r[2] * x - r[0] * z, r[0] * y - r[1] * x]; // right × dir
  // (near the poles the stand-in can lean up below level: turn the quad half
  // round, which faces it the same way, so up never points down)
  return u[1] < 0 ? { right: r.map((v) => -v), up: u.map((v) => -v) } : { right: r, up: u };
}

const wonder = (id) => WONDERS.find((w) => w.id === id);
const star = (w) => ({ id: w.id, kind: 'star', group: w.id, r: w.r, least: LEAST.star, real: w.r * STAR_REAL, colors: [w.color], sector: w.sector ?? 'main' });
const twins = wonder('twins');
const maw = wonder('maw');
const lantern = wonder('lantern');
// the drawn ones first, then the nebulae (data only: see the header)
export const LANDMARKS = [
  { id: 'maw', kind: 'hole', group: 'maw', r: maw.disk, least: LEAST.hole, real: meets(maw.disk, LEAST.hole), colors: ['#fff3e0', '#ff6a2a'], sector: 'main' },
  ...['ember', 'halcyon', 'curvesun'].map((id) => star(wonder(id))),
  { id: 'sun', kind: 'star', group: 'sun', r: SUN.r, least: LEAST.star, real: SUN.r * STAR_REAL, colors: ['#ffcf6a'], sector: 'main' },
  { id: 'twins', kind: 'star', group: 'twins', part: 0, r: twins.r, least: LEAST.star, real: twins.r * STAR_REAL, colors: [twins.color], sector: 'main' },
  { id: 'twins', kind: 'star', group: 'twins', part: 1, r: twins.pair.r, least: LEAST.star, real: twins.r * STAR_REAL, colors: [twins.pair.color], sector: 'main' },
  { id: 'lantern', kind: 'pulsar', group: 'lantern', r: lantern.r, least: LEAST.pulsar, real: reachOf(lantern) * PULSAR_REAL, colors: [lantern.color], sector: 'main' },
  ...['veil', 'cradle'].map((id) => {
    const w = wonder(id);
    return { id, kind: 'nebula', group: id, r: w.r, least: LEAST.nebula, real: meets(w.r, LEAST.nebula), colors: w.colors, sector: 'main' };
  }),
];
export const LANDMARK_IDS = new Set(LANDMARKS.map((l) => l.id));
const DRAWN = LANDMARKS.filter((l) => l.kind !== 'nebula').length;

// what nebula/ is handed from deep space: each nebula, and the form it takes
const FORM_OF = { veil: 'shell', cradle: 'nursery' };
export const NEBULAE = WONDERS.filter((w) => w.kind === 'nebula').map((w) => ({ id: w.id, at: w.at, r: w.r, colors: w.colors, seed: w.id, form: FORM_OF[w.id] }));

// where each is now (the Twins go round each other)
function centreOf(l, t) {
  if (l.group !== 'twins') return l.id === 'sun' ? SUN.at : wonder(l.id).at;
  const { a, b } = binaryAt(twins, t);
  return l.part === 0 ? a : b;
}
// the Maw's disk's normal, in its own (the map's) space
const MAW_AXIS = new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...TILT));

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute float aSize;
attribute float aKind;
attribute vec3 aCol0;
attribute vec3 aCol1;
attribute float aK;
attribute vec3 aAxis;
uniform float uFar;
uniform vec3 uCam;
varying vec2 vUv;
varying float vKind;
varying vec3 vCol0;
varying vec3 vCol1;
varying float vK;
varying vec3 vAxis;
void main() {
  vUv = position.xy;
  vKind = aKind;
  vCol0 = aCol0;
  vCol1 = aCol1;
  vK = aK;
  // upright in the world (quadAxes in landmarks.js): right is level, up leans
  // to +y; straight up or down, +x stands in for the level
  vec3 f = normalize(aCenter - uCam);
  vec3 ref = abs(f.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 right = normalize(cross(f, ref));
  vec3 up = cross(right, f);
  if (up.y < 0.0) { right = -right; up = -up; }
  // the Maw's axis in the quad's own basis (x right, y up, z toward you)
  vAxis = vec3(dot(aAxis, right), dot(aAxis, up), -dot(aAxis, f));
  float extent = uFar * tan(aSize * 0.5);
  vec3 p = aCenter + (right * position.x + up * position.y) * extent;
  gl_Position = aK > 0.0 ? projectionMatrix * modelViewMatrix * vec4(p, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
  // (never cut by the far plane: on foot it's at the landing's sky,
  // footScene's far(), which the landmarks are well past)
  if (aK > 0.0) gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999999);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vKind;
varying vec3 vCol0;
varying vec3 vCol1;
varying float vK;
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

export function createLandmarks(parent, { skyFar }) {
  const n = LANDMARKS.length;
  const quad = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  // (the nebulae’s rows sit past this, so they cost no triangles)
  geo.instanceCount = DRAWN;
  const inst = (size) => new THREE.InstancedBufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
  const A = { aCenter: inst(3), aSize: inst(1), aKind: inst(1), aCol0: inst(3), aCol1: inst(3), aK: inst(1), aAxis: inst(3) };
  for (const [k, a] of Object.entries(A)) geo.setAttribute(k, a);
  const col = new THREE.Color();
  LANDMARKS.forEach((l, i) => {
    A.aKind.setX(i, KIND[l.kind]);
    col.set(l.colors[0]).convertSRGBToLinear();
    A.aCol0.setXYZ(i, col.r, col.g, col.b);
    col.set(l.colors[1] ?? l.colors[0]).convertSRGBToLinear();
    A.aCol1.setXYZ(i, col.r, col.g, col.b);
    A.aAxis.setXYZ(i, MAW_AXIS.x, MAW_AXIS.y, MAW_AXIS.z);
  });

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uFar: { value: skyFar }, uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } },
    // premultiplied: light adds, the shadow takes away what's behind
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: false,
    depthTest: true,
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
      mat.uniforms.uCam.value.copy(camAt);
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
        // a nebula is nebula/’s: nothing drawn here, and its group never hidden
        if (l.kind === 'nebula') {
          A.aK.setX(i, 0);
          return;
        }
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
    },
  };
}
