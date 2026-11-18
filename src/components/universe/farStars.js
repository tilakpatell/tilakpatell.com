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
// createFarStars(parent, { places: [{ id, at, reach | r, color, sector?, station?, group? }], skyFar, slots = 0, slotSize = 400, discs = 0, far = 45000 })
//   → { points, update(camera, dt, { focus, sector }), kOf(id) → 0 (real) … 1 (far), dispose(),
//       setSlot, showSlots, hideSlots, fadeSlot, discs, pops }
// `at` is in the parent's space (the map's), and the points are added to it.
//
// The endless space's far layer rides in the same draw (expanse/scene):
// - `slots` sectors' specks, `slotSize` each: setSlot(i, { centre, at, color, r, count })
//   uploads one sector's stars (at: Float32Array xyz from its centre, color: Uint8Array
//   rgb, r: Float32Array radii) into its range alone, hidden; showSlots(list) and
//   hideSlots(list) flip slots in one call, so a swap lands in one frame, and
//   fadeSlot(i, seconds) eases one in instead. Each slot's centre is taken from the
//   camera in doubles every update and handed to the chip as uSlot[i], so its specks
//   are where they are however far out (a speck's own numbers are within a sector).
//   A speck is drawn past the far plane only (expanse/scene/levels.js): nearer, it's a disc.
// - `discs` bodies drawn as discs of their true size within the far plane:
//   discs.begin(), push(x, y, z, r, cr, cg, cb, lx, ly, lz, alpha, key?, rough?) in the map's
//   space (l: the way to its light, or nought for a star's own light; rough, 0 … 1: a rock's
//   own lumps, from its seed, or 0 for a smooth ball), end(); sorted
//   far to near, the nearest kept past capacity, written from the camera as last updated
//   (so after update() in the frame). Nothing is made a frame.
// - pops() → { count, px }: the discs that came from nothing to over half in one frame
//   since last asked, and the biggest's pixels across, for the endless check (dev).
// The hand-made places are written from the camera too, the points sat at it, so
// nothing in the buffers is bigger than the sky. Specks and places add light
// (alpha nought); a disc is drawn over (alpha one: a dark rock hides the stars).

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
export const FAR_SLOTS = 64; // sectors' specks the far layer can hold (universe/budget.js's nearSlots)
const SPECK_DIM = '0.06'; // the dimmest a generated speck goes (expanse/scene/levels.js's speckBright)

export const realAt = ({ reach, r }) => Math.max(REAL_LEAST, (reach ?? r) * REAL_REACHES);

// 0 nearer than the last fifth (the real thing), 1 at real and past (the star), smoothstep between
export function starK(dist, real) {
  const t = Math.min(1, Math.max(0, (dist - real * (1 - FADE)) / (real * FADE)));
  return t * t * (3 - 2 * t);
}

// how bright and big a star is, by how far off it is against where it's real
export const brightness = (dist, real) => Math.min(1, Math.max(DIM_LEAST, (real * BRIGHT_AT) / Math.max(dist, 1e-6)));
export const starPx = (k) => 7 + 13 * k;

// how a generated speck shows: like a star of the old sky under it (galaxy/sky.js's, most faint,
// a few bright), not a place's marker. Its brightness by how far off it is (`bright`,
// expanse/scene/levels.js's speckBright), times a magnitude of its own (`m`, 0…1, seeded by where
// it is) cubed, so most are faint; its light and its core by that, and from a pixel and a half
// across to eight. (A speck was drawn as a place is, seven pixels at least with a white core at
// full strength however faint: past the far plane nearly every one is at the dimmest, so the
// sectors' 26,000 came out an even snow over the sky.)
export const SPECK_LOOK = { least: 0.2, px: [1.5, 8] };
export function speckLook(bright, m) {
  const lum = bright * (SPECK_LOOK.least + (1 - SPECK_LOOK.least) * m * m * m);
  return { lum, px: SPECK_LOOK.px[0] + (SPECK_LOOK.px[1] - SPECK_LOOK.px[0]) * Math.sqrt(lum) };
}

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
  #define SLOTS ${FAR_SLOTS}
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aK;
  attribute float aBright;
  attribute float aFocus;
  attribute float aKind; // 0 a place, 1 a speck in a slot, 2 a disc
  attribute float aSlot;
  attribute float aR;
  attribute vec3 aLight;
  uniform float uDpr;
  uniform float uTime;
  uniform float uHeight; // the frame's pixels tall, as drawn
  uniform float uSkyFar;
  uniform float uFar;
  uniform vec4 uSlot[SLOTS]; // a slot's centre from the camera, and how much of it shows
  varying vec3 vColor;
  varying float vK;
  varying float vBright;
  varying float vLum;
  varying float vFocus;
  varying float vDisc;
  varying float vPx;
  varying vec3 vLight;
  void main() {
    vec3 p = position;
    vec3 color = aColor;
    float k = aK;
    float size = aSize;
    float bright = aBright;
    float lum = 1.0; // (a place at full strength; a speck by speckLook)
    vDisc = 0.0;
    vLight = vec3(0.0);
    if (aKind > 0.5 && aKind < 1.5) {
      // a speck: where its sector's slot is, on the sky, past the far plane only
      vec4 slot = uSlot[int(aSlot + 0.5)];
      vec3 rel = slot.xyz + position;
      float d = max(length(rel), 1e-3);
      p = rel / d * uSkyFar;
      float real = max(${REAL_LEAST.toFixed(1)}, aR * ${REAL_REACHES.toFixed(1)});
      float q = ${BRIGHT_AT.toFixed(1)} * real / d;
      bright = clamp(q * q, ${SPECK_DIM}, 1.0);
      // (its own magnitude, from where it is in its sector: speckLook)
      float m = fract(sin(dot(position, vec3(0.12989, 0.78233, 0.37719))) * 43758.5453);
      lum = bright * (${SPECK_LOOK.least.toFixed(2)} + ${(1 - SPECK_LOOK.least).toFixed(2)} * m * m * m);
      size = ${SPECK_LOOK.px[0].toFixed(1)} + ${(SPECK_LOOK.px[1] - SPECK_LOOK.px[0]).toFixed(1)} * sqrt(lum);
      color = aColor * (1.1 + 2.0 * bright);
      k = aK * slot.w * smoothstep(uFar * ${(1 - FADE).toFixed(2)}, uFar, d);
    } else if (aKind > 1.5) {
      // a disc: its true size, lit from where its light is
      float d = max(length(position), 1e-3);
      size = aR / d * projectionMatrix[1][1] * uHeight / uDpr;
      vDisc = 1.0;
      bright = aBright; // (a disc's: how rough it is, its seed, or nought)
      vLight = length(aLight) > 0.0 ? normalize((viewMatrix * modelMatrix * vec4(aLight, 0.0)).xyz) : vec3(0.0);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    // (never cut by the far plane: on foot it's at the landing's sky,
    // footScene's far(), which the stars are well past)
    gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999999);
    float pulse = 1.0 + aFocus * (0.45 + 0.2 * sin(uTime * 6.0));
    gl_PointSize = k > 0.0 ? size * uDpr * pulse : 0.0;
    if (k <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // (nothing to draw: off the frame)
    vPx = gl_PointSize;
    vColor = color;
    vK = k;
    vBright = bright;
    vLum = lum;
    vFocus = aFocus;
  }
`;
// (galaxy/sky.js's beacon: a hot core, a glow in its colour, a cross of
// spikes, brighter for the brighter stars and the one in focus; a disc a
// ball lit from one side, or all over for a star's own)
const FRAG = /* glsl */ `
  float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0)), f.x), f.y);
  }
  varying vec3 vColor;
  varying float vK;
  varying float vBright;
  varying float vLum;
  varying float vFocus;
  varying float vDisc;
  varying float vPx;
  varying vec3 vLight;
  void main() {
    if (vK <= 0.0) discard;
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    if (vDisc > 0.5) {
      // (a rock's lumps: its edge and its face pushed about by value noise, seeded by it)
      float edge = 1.0;
      vec3 bend = vec3(0.0);
      if (vBright > 0.0) {
        vec2 s = q * 2.5 + vBright * 37.0;
        edge = 0.82 + 0.18 * vn(vec2(atan(q.y, q.x) * 1.3, vBright * 11.0) * 2.0);
        bend = vec3(vn(s) - 0.5, vn(s + 5.2) - 0.5, 0.0) * 1.1;
      }
      if (r > edge) discard;
      float cover = clamp((edge - r) * vPx * 0.5, 0.0, 1.0) * vK;
      float rr = r / edge;
      vec3 n = normalize(vec3(q.x / edge, -q.y / edge, sqrt(max(0.0, 1.0 - rr * rr))) + bend);
      float lit = dot(vLight, vLight) > 0.0 ? 0.04 + 0.96 * max(dot(n, vLight), 0.0) : 1.0;
      gl_FragColor = vec4(vColor * lit * cover, cover);
      return;
    }
    float core = smoothstep(0.2, 0.05, r);
    float glow = exp(-r * 5.5) * 0.9;
    float spikes = (exp(-abs(q.x) * 30.0) + exp(-abs(q.y) * 30.0)) * (1.0 - r) * (smoothstep(0.3, 0.8, vBright) * 0.5 + vFocus * 0.8);
    vec3 c = (vColor * (glow + spikes) + vec3(1.6 + vFocus * 1.4) * core) * vLum;
    gl_FragColor = vec4(c * smoothstep(1.0, 0.75, r) * vK, 0.0);
  }
`;

export function createFarStars(parent, { places, skyFar, slots = 0, slotSize = 400, discs: discCap = 0, far: farPlane = 45000 }) {
  const n = places.length;
  const nSlots = Math.min(FAR_SLOTS, Math.max(0, slots));
  const slotBase = n; // (places, then the slots' specks, then the discs: specks behind discs, discs drawn over)
  const discBase = n + nSlots * slotSize;
  const total = discBase + discCap;
  const real = places.map((p) => (p.station ? STATION_REAL : realAt(p)));
  const base = places.map((p) => new THREE.Color(p.color).lerp(WHITE, 0.25));
  const attr = (size) => new THREE.BufferAttribute(new Float32Array(total * size), size).setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  const A = { position: attr(3), aSize: attr(1), aColor: attr(3), aK: attr(1), aBright: attr(1), aFocus: attr(1), aKind: attr(1), aSlot: attr(1), aR: attr(1), aLight: attr(3) };
  for (const [k, a] of Object.entries(A)) geo.setAttribute(k, a);
  for (let i = 0; i < nSlots * slotSize; i++) {
    A.aKind.array[slotBase + i] = 1;
    A.aSlot.array[slotBase + i] = Math.floor(i / slotSize);
  }
  A.aKind.array.fill(2, discBase, total);
  geo.setDrawRange(0, n);
  // In the opaque list (transparent false) just after the sky and before
  // anything else there: with the depth test off a star never hides behind
  // the far plane or the sky, and anything solid drawn after it (a near
  // planet in front of a far one) still covers it. Premultiplied: a star
  // adds its light (alpha nought), a disc is drawn over (alpha one)
  const slotU = Array.from({ length: FAR_SLOTS }, () => new THREE.Vector4(0, 0, 0, 0));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uDpr: { value: 1 }, uTime: { value: 0 }, uHeight: { value: 1080 }, uSkyFar: { value: skyFar }, uFar: { value: farPlane }, uSlot: { value: slotU } },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
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
    mat.uniforms.uHeight.value = h;
  };
  parent.add(points);

  const hidden = places.map(() => false); // (what this has done to each group, so it only ever undoes its own)
  const farK = places.map(() => 1); // kOf: 0 real … 1 far
  const index = new Map(places.map((p, i) => [p.id, i]));
  const camAt = new THREE.Vector3();
  let clock = 0;

  // ── the slots: a sector's specks each, placed on the chip from a centre kept here in doubles ──
  const slot = Array.from({ length: nSlots }, () => ({ centre: [0, 0, 0], w: 0, want: 0, rate: Infinity, count: 0 }));
  const range = (attr, from, count) => {
    attr.addUpdateRange(from * attr.itemSize, count * attr.itemSize);
    attr.needsUpdate = true;
  };
  let popCount = 0;
  let popPx = 0;
  const popped = (px) => {
    popCount++;
    popPx = Math.max(popPx, px);
  };
  const setSlot = (i, { centre, at, color, r, count }) => {
    const s = slot[i];
    if (!s) return;
    const m = Math.min(count, slotSize);
    const o = slotBase + i * slotSize;
    s.centre = [centre[0], centre[1], centre[2]];
    s.count = m;
    s.w = 0;
    slotU[i].w = 0;
    s.want = 0;
    s.rate = Infinity;
    A.position.array.set(at.subarray(0, m * 3), o * 3);
    for (let j = 0; j < m; j++) {
      A.aColor.array[(o + j) * 3] = color[j * 3] / 255;
      A.aColor.array[(o + j) * 3 + 1] = color[j * 3 + 1] / 255;
      A.aColor.array[(o + j) * 3 + 2] = color[j * 3 + 2] / 255;
      A.aR.array[o + j] = r[j];
    }
    A.aK.array.fill(1, o, o + m);
    A.aK.array.fill(0, o + m, o + slotSize);
    for (const a of [A.position, A.aColor, A.aR, A.aK]) range(a, o, slotSize);
  };
  const flip = (list, want) => {
    for (const i of list) {
      const s = slot[i];
      if (!s) continue;
      s.want = want;
      s.rate = Infinity;
    }
  };

  // ── the discs: pushed each frame in the map's space, written from the camera ──
  const D = 13; // x y z r cr cg cb lx ly lz alpha key rough
  const pushed = new Float64Array(Math.max(1, discCap * 2) * D);
  const order = new Int32Array(Math.max(1, discCap * 2));
  const dist2 = new Float64Array(Math.max(1, discCap * 2));
  let nPushed = 0;
  let nDiscs = 0;
  const seen = new Map(); // key → alpha last frame (for pops)
  const seenNow = new Map();
  const discs = {
    begin() {
      nPushed = 0;
    },
    push(x, y, z, r, cr, cg, cb, lx, ly, lz, alpha, key = -1, rough = 0) {
      if (nPushed >= order.length || !(alpha > 0)) return;
      const o = nPushed * D;
      pushed[o] = x;
      pushed[o + 1] = y;
      pushed[o + 2] = z;
      pushed[o + 3] = r;
      pushed[o + 4] = cr;
      pushed[o + 5] = cg;
      pushed[o + 6] = cb;
      pushed[o + 7] = lx;
      pushed[o + 8] = ly;
      pushed[o + 9] = lz;
      pushed[o + 10] = alpha;
      pushed[o + 11] = key;
      pushed[o + 12] = rough;
      const dx = x - camAt.x;
      const dy = y - camAt.y;
      const dz = z - camAt.z;
      dist2[nPushed] = dx * dx + dy * dy + dz * dz;
      order[nPushed] = nPushed;
      nPushed++;
    },
    end() {
      // the nearest `discCap` kept, drawn far to near (an insertion sort: they come nearly sorted frame to frame)
      for (let i = 1; i < nPushed; i++) {
        const v = order[i];
        let j = i - 1;
        while (j >= 0 && dist2[order[j]] < dist2[v]) {
          order[j + 1] = order[j];
          j--;
        }
        order[j + 1] = v;
      }
      const skip = Math.max(0, nPushed - discCap);
      nDiscs = nPushed - skip;
      seenNow.clear();
      for (let i = 0; i < nDiscs; i++) {
        const o = order[skip + i] * D;
        const v = discBase + i;
        A.position.setXYZ(v, pushed[o] - camAt.x, pushed[o + 1] - camAt.y, pushed[o + 2] - camAt.z);
        A.aR.setX(v, pushed[o + 3]);
        A.aColor.setXYZ(v, pushed[o + 4], pushed[o + 5], pushed[o + 6]);
        A.aLight.setXYZ(v, pushed[o + 7], pushed[o + 8], pushed[o + 9]);
        A.aK.setX(v, pushed[o + 10]);
        A.aBright.setX(v, pushed[o + 12]);
        const key = pushed[o + 11];
        if (key >= 0) {
          seenNow.set(key, pushed[o + 10]);
          if (pushed[o + 10] > 0.5 && !(seen.get(key) > 0)) popped(discPxAt(Math.sqrt(dist2[order[skip + i]]), pushed[o + 3]));
        }
      }
      seen.clear();
      for (const [k, a] of seenNow) seen.set(k, a);
      if (nDiscs) for (const a of [A.position, A.aR, A.aColor, A.aLight, A.aK, A.aBright]) range(a, discBase, nDiscs);
    },
    count: () => nDiscs,
  };
  // (how big a disc is on a 1080-pixel screen at flight.js's field of view: for pops)
  const discPxAt = (d, r) => ((2 * r) / (2 * Math.max(d, r) * Math.tan((34 * Math.PI) / 360))) * 1080;

  return {
    points,
    update(camera, dt = 1 / 60, { focus = null, sector = null } = {}) {
      clock += dt;
      mat.uniforms.uTime.value = clock;
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      // (sat at the camera: what's in the buffers is from it, never bigger than the sky)
      points.position.copy(camAt);
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
        farK[i] = k;
        const s = dist > 1e-6 ? skyFar / dist : 0;
        A.position.setXYZ(i, dx * s, dy * s, dz * s);
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
      if (n) for (const a of [A.position, A.aSize, A.aBright, A.aColor, A.aK, A.aFocus]) range(a, 0, n);
      // the slots: their centres from the camera, worked out here in doubles, and eased in or out
      let any = false;
      for (let i = 0; i < nSlots; i++) {
        const sl = slot[i];
        // (a slot shown whole is a swap for one just like it, by contract: a new
        // place fades in, fadeSlot; so only a disc can pop)
        if (sl.w !== sl.want) {
          const step = Number.isFinite(sl.rate) ? sl.rate * dt : Infinity;
          sl.w = sl.w < sl.want ? Math.min(sl.want, sl.w + step) : Math.max(sl.want, sl.w - step);
        }
        const u = slotU[i];
        u.set(sl.centre[0] - camAt.x, sl.centre[1] - camAt.y, sl.centre[2] - camAt.z, sl.w);
        if (sl.w > 0 && sl.count) any = true;
      }
      geo.setDrawRange(0, nDiscs ? discBase + nDiscs : any ? discBase : n);
    },
    kOf(id) {
      const i = index.get(id);
      return i === undefined ? null : farK[i];
    },
    slots: nSlots,
    slotSize,
    setSlot,
    showSlots: (list) => flip(list, 1),
    hideSlots: (list) => flip(list, 0),
    fadeSlot(i, seconds) {
      const s = slot[i];
      if (!s) return;
      s.want = 1;
      s.rate = seconds > 0 ? 1 / seconds : Infinity;
    },
    slotShown: (i) => slot[i]?.w ?? 0,
    discs,
    // (dev: since last asked)
    pops() {
      const r = { count: popCount, px: popPx };
      popCount = 0;
      popPx = 0;
      return r;
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
