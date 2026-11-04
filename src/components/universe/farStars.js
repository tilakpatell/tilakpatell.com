// Far places as stars, the galaxy's way. In the Star Wars galaxy the other
// systems are only stars in the sky; here, every world, moon and wonder past
// where it's real (realAt: twenty of its reaches, never under 1,500) is a
// star on the sky along its true direction, at skyFar (deepspace.js's
// SKY_FAR, where the background galaxies ride): a white-hot core in a glare
// of its own colour (its swatch, a quarter of the way to white), with four
// faint spikes on the brighter ones, as galaxy/sky.js draws the other
// systems. Nearer is brighter and bigger (brightness: 7 to 20 px), and the
// one you're aimed at or going to pulses (`focus`). Its real mesh is hidden
// out there (its lights ride in its group); over the last fifth before it's
// real the star fades and the real thing takes over.
//
// Only the camera's own sector shows (`sector`, layout.js's mapSectorOf):
// from the main map the Rick and Morty sector's worlds are nothing at all,
// and the other way round. The home system's stations are no stars of their
// own: near the sun (within STATION_REAL of it) they're real, past that
// they're nothing, the home sun being the home system's star.
//
// The rules (realAt, starK, brightness, starPx, FAR_STARS) are pure and
// tested; createFarStars draws them: one Points for all of them, one draw
// call, no textures, on every tier. The Expanse (expanse/scene) draws its
// systems with it too, with no sector given (nothing filtered).
//
// createFarStars(parent, { places: [{ id, at, reach | r, color, sector?, station?, group? }], skyFar })
//   → { points, update(camera, dt, { focus, sector }), kOf(id) → 0 (real) … 1 (far), dispose() }
// `at` is in the parent's space (the map's), and the points are added to it.

import * as THREE from 'three';
import { WONDERS, reachOf } from './deep';
import { POSITIONS, REACH, SUN } from './layout';
import { MOONS, UNIVERSES } from './universes';
import { LANDMARK_IDS } from './landmarks';

const REAL_REACHES = 20; // a place is real within this many of its reaches
const REAL_LEAST = 1500; // and never less
const FADE = 0.2; // over this share of the way in, star and real thing blend
const BRIGHT_AT = 4; // full brightness within this many of its realAt
const DIM_LEAST = 0.12; // and never dimmer than this
const STATION_REAL = 2500; // the home system's stations: real within this of the sun
const WHITE = new THREE.Color('#ffffff');

export const realAt = ({ reach, r }) => Math.max(REAL_LEAST, (reach ?? r) * REAL_REACHES);

// 0 nearer than the last fifth (the real thing), 1 at real and past (the star), smoothstep between
export function starK(dist, real) {
  const t = Math.min(1, Math.max(0, (dist - real * (1 - FADE)) / (real * FADE)));
  return t * t * (3 - 2 * t);
}

// how bright and big a star is, by how far off it is against where it's real
export const brightness = (dist, real) => Math.min(1, Math.max(DIM_LEAST, (real * BRIGHT_AT) / Math.max(dist, 1e-6)));
export const starPx = (k) => 7 + 13 * k;

// every place that can be a star far off: the fandoms' worlds (their
// swatch), the Rick and Morty sector's, the home system's stations (folded
// into home) and every wonder (its colour, or its first) but the big ones,
// which are landmarks (landmarks.js: the Maw, the nebulae, the big stars and
// the home sun)
const stationIds = new Set(UNIVERSES.filter((u) => u.kind === 'core').map((u) => u.id));
export const FAR_STARS = [
  ...[...UNIVERSES, ...MOONS].map((u) => ({ id: u.id, at: POSITIONS[u.id], reach: REACH[u.id], color: u.swatch, sector: u.sector ?? 'main', ...(stationIds.has(u.id) ? { station: true } : {}) })),
  ...WONDERS.filter((w) => !LANDMARK_IDS.has(w.id)).map((w) => ({ id: w.id, at: w.at, reach: reachOf(w), color: w.color ?? w.colors?.[0] ?? '#ffb47a', sector: w.sector ?? 'main' })),
];

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aK;
  attribute float aBright;
  attribute float aFocus;
  uniform float uDpr;
  uniform float uTime;
  varying vec3 vColor;
  varying float vK;
  varying float vBright;
  varying float vFocus;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // (never cut by the far plane: on foot it's at the landing's sky,
    // footScene's far(), which the stars are well past)
    gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999999);
    float pulse = 1.0 + aFocus * (0.45 + 0.2 * sin(uTime * 6.0));
    gl_PointSize = aSize * uDpr * pulse;
    vColor = aColor;
    vK = aK;
    vBright = aBright;
    vFocus = aFocus;
  }
`;
// (galaxy/sky.js's beacon: a hot core, a glow in its colour, a cross of
// spikes, brighter for the brighter stars and the one in focus)
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vK;
  varying float vBright;
  varying float vFocus;
  void main() {
    if (vK <= 0.0) discard;
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    float core = smoothstep(0.2, 0.05, r);
    float glow = exp(-r * 5.5) * 0.9;
    float spikes = (exp(-abs(q.x) * 30.0) + exp(-abs(q.y) * 30.0)) * (1.0 - r) * (smoothstep(0.3, 0.8, vBright) * 0.5 + vFocus * 0.8);
    vec3 c = vColor * (glow + spikes) + vec3(1.6 + vFocus * 1.4) * core;
    gl_FragColor = vec4(c * smoothstep(1.0, 0.75, r) * vK, 1.0);
  }
`;

export function createFarStars(parent, { places, skyFar }) {
  const n = places.length;
  const real = places.map((p) => (p.station ? STATION_REAL : realAt(p)));
  const base = places.map((p) => new THREE.Color(p.color).lerp(WHITE, 0.25));
  const attr = (size) => new THREE.BufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  const A = { position: attr(3), aSize: attr(1), aColor: attr(3), aK: attr(1), aBright: attr(1), aFocus: attr(1) };
  for (const [k, a] of Object.entries(A)) geo.setAttribute(k, a);
  // Additive, and in the opaque list (transparent false) just after the sky
  // and before anything else there: with the depth test off a star never
  // hides behind the far plane or the sky, and anything solid drawn after it
  // (a near planet in front of a far one) still covers it
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uDpr: { value: 1 }, uTime: { value: 0 } },
    blending: THREE.AdditiveBlending,
    transparent: false,
    depthTest: false,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'far-stars';
  points.renderOrder = -9;
  points.frustumCulled = false;
  // (a point's size is in the frame's pixels as drawn: the page's px times
  // the ratio the frame is drawn at)
  // (the canvas's height on the page is read once and again only when it's
  // resized: read on every draw, it made the page lay itself out again in
  // the middle of a frame whenever the HUD had written to it)
  const px = new THREE.Vector2();
  let tall = 0; // the canvas's height on the page, once read (0: to read)
  let watched = null;
  let sizes = null;
  points.onBeforeRender = (renderer) => {
    const target = renderer.getRenderTarget();
    const h = target ? target.height : renderer.getDrawingBufferSize(px).y;
    const el = renderer.domElement;
    if (el !== watched) {
      watched = el;
      tall = 0;
      sizes?.disconnect();
      sizes = typeof ResizeObserver === 'function' && el ? new ResizeObserver(() => (tall = 0)) : null;
      sizes?.observe?.(el);
    }
    const page = tall || el?.clientHeight || 0;
    if (sizes) tall = page;
    mat.uniforms.uDpr.value = h / (page || h / renderer.getPixelRatio());
  };
  parent.add(points);

  const hidden = places.map(() => false); // (what this has done to each group, so it only ever undoes its own)
  const far = places.map(() => 1); // kOf: 0 real … 1 far
  const index = new Map(places.map((p, i) => [p.id, i]));
  const camAt = new THREE.Vector3();
  let clock = 0;
  return {
    points,
    update(camera, dt = 1 / 60, { focus = null, sector = null } = {}) {
      clock += dt;
      mat.uniforms.uTime.value = clock;
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      const sunD = Math.hypot(SUN.at[0] - camAt.x, SUN.at[1] - camAt.y, SUN.at[2] - camAt.z);
      for (let i = 0; i < n; i++) {
        const p = places[i];
        const dx = p.at[0] - camAt.x;
        const dy = p.at[1] - camAt.y;
        const dz = p.at[2] - camAt.z;
        const dist = Math.hypot(dx, dy, dz);
        const here = !sector || !p.sector || p.sector === sector;
        // how far it is (0 real … 1 a star), and how much of a star is drawn
        const k = !here ? 1 : p.station ? starK(sunD, real[i]) : starK(dist, real[i]);
        const shown = here && !p.station ? k : 0;
        far[i] = k;
        const s = dist > 1e-6 ? skyFar / dist : 0;
        A.position.setXYZ(i, camAt.x + dx * s, camAt.y + dy * s, camAt.z + dz * s);
        const b = brightness(dist, real[i]);
        A.aSize.setX(i, starPx(b));
        A.aBright.setX(i, b);
        const lift = 1.1 + 2 * b;
        A.aColor.setXYZ(i, base[i].r * lift, base[i].g * lift, base[i].b * lift);
        A.aK.setX(i, shown);
        A.aFocus.setX(i, p.id === focus ? 1 : 0);
        // the real thing hidden once it's all star (or nothing, for another
        // sector or a station far from home)
        const hide = k >= 1;
        const g = p.group;
        if (g && hide !== hidden[i]) g.visible = !hide;
        hidden[i] = hide;
      }
      for (const a of Object.values(A)) a.needsUpdate = true;
    },
    kOf(id) {
      const i = index.get(id);
      return i === undefined ? null : far[i];
    },
    dispose() {
      places.forEach((p, i) => {
        if (p.group && hidden[i]) p.group.visible = true;
      });
      sizes?.disconnect();
      parent.remove(points);
      geo.dispose();
      mat.dispose();
    },
  };
}
