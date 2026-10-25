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
// It is the far layer of generated space as well (the design's section A,
// expanse/scene/levels.js), still in its one draw: after the hand-made
// places come the slots, then the discs (one draw blends in its vertices'
// order, so the discs go last, over the specks).
//   - A disc is a star, planet or wonder within the far plane, drawn at its
//     true size, lit from its star (or shining), over whatever's behind it:
//     the discs writer takes them a frame, keeps the nearest it has room
//     for, and draws them far to near.
//   - A slot is a sector's stars (or a ring of sectors'), set once: each
//     speck's place is worked out on the chip, from its slot's centre (from
//     the camera, in doubles, each update) and where it is in the slot. Past
//     the far plane it is a speck on the sky, in its colour, falling off as
//     the square (speckBright); within it, it gives way to its disc. Every
//     speck fades to nothing at the edge it's given (setEdge: the levels'
//     beyondFade, as far as what's loaded reaches from the camera), so
//     nothing comes or goes there at once as the slots change.
// Everything is written from the camera, and the Points sit at the camera
// (in the parent's space), so what goes to the chip is small and exact even
// 10^9 out. Blending is premultiplied: a star or speck writes alpha 0, so it
// adds as it always has, and a disc writes its cover; drawn after them, a
// dark rock hides the places and specks behind it. It writes depth but
// tests none: a disc writes its own where it covers half a pixel or more,
// so a world farther off, drawn after it, can't cover it; a star or speck
// writes the far plane's, as it sits on the sky (skyFar, inside the far
// plane), not where it is, so it never cuts a mesh in front of it; and so
// does a faint disc or a disc's rim, so what's behind shows through it, not
// a hole of sky. What one draw can't do: a place's star nearer than a disc
// in line with it is covered by the disc (the place is drawn first, on the
// sky). It's rare and brief, and left as it is. Every vertex is drawn
// (the hidden are put out of the frame, so they cost next to nothing). The
// shaders take their numbers from levels.js's and this file's, so the chip
// can't drift from the rules.
//
// createFarStars(parent, { places: [{ id, at, reach | r, color, sector?, station?, group? }], skyFar, slots = [], discs = 0 })
//   → { points, update(camera, dt, { focus, sector }), kOf(id) → 0 (real) … 1 (far),
//       setSlot(i, slot), showSlots(list), hideSlots(list), fadeSlot(i, seconds),
//       setEdge(edge), discs: { begin(), push(…), end() }, pops() → { count, px }, dispose() }
// `at` is in the parent's space (the map's), and the points are added to it.
// `slots` is each slot's size in specks; `discs` how many discs it draws.
//   setSlot(i, { centre: [x, y, z], at: Float32Array, color: Uint8Array, r: Float32Array, count, key? })
//     a slot's specks: `at` (3 a speck) from `centre` (the parent's space),
//     `color` (3 a speck) as a hex colour's bytes, `r` the star's radius;
//     only that slot's range is uploaded, and it is hidden till shown;
//     `key` names what it holds (a sector's key, or a list of them for a
//     ring of sectors), for pops() alone
//   showSlots(list), hideSlots(list): at once, so a swap is one frame
//   fadeSlot(i, seconds): shown over that long, from where it is
//   setEdge(edge): every speck faded to nothing at `edge` from the camera,
//     from 0.8 of it (levels.js's beyondFade); none (Infinity, as it starts)
//     and nothing fades
//   discs.push(x, y, z, r, cr, cg, cb, lx, ly, lz, alpha, id?) between begin()
//     and end(), a frame: where (the parent's space), its radius, its
//     colour (the working space's, as a THREE.Color's), the way to its
//     star (none, 0, 0, 0: it shines) and how much of it shows (levels.js's
//     disc weight); `id`, if given, is for pops() alone
//   pops() (dev): what came in at over half in one frame since it was last
//     asked, the largest in the frame's pixels: a disc from nothing (by its
//     id) or a slot shown out of nothing (one shown in the frame another
//     drawn with one of its keys goes is a swap: the same thing, moved; one
//     with no key is always new). Nothing is counted till it's first asked.

import * as THREE from 'three';
import { BRIGHT_AT, FADE, FAR, REAL_LEAST, REAL_REACHES, SPECK_LEAST, beyondFade, discPx, levelWeights, realAt, speckBright } from '../expanse/shared/levels';
import { WONDERS, reachOf } from './deep';
import { POSITIONS, REACH, SUN } from './layout';
import { MOONS, UNIVERSES } from './universes';
import { LANDMARK_IDS } from './landmarks';

// (a place is real within REAL_REACHES of its reaches, never under
// REAL_LEAST; star and real thing blend over the last FADE of the way in;
// full brightness within BRIGHT_AT of its realAt: levels.js's numbers)
const DIM_LEAST = 0.12; // and a place's star never dimmer than this
const STATION_REAL = 2500; // the home system's stations: real within this of the sun
const PX_LEAST = 7; // a star's pixels, dim
const PX_MORE = 13; // and the more at full brightness
const TO_WHITE = 0.25; // a star's glare: its colour this share of the way to white
const LIFT = 1.1; // and lifted by this
const LIFT_MORE = 2; // and this more at full brightness
const MOST_SLOTS = 200; // (a uniform each: the chip holds 256 at least)
const FRAME_H = 1080; // (a frame's height till it's first drawn)
const NO_EDGE = 1e30; // (no edge: a float the chip holds, where Infinity would make a NaN)
const NO_KEYS = [];
const WHITE = new THREE.Color('#ffffff');

export { realAt };

// 0 nearer than the last fifth (the real thing), 1 at real and past (the star), smoothstep between
export function starK(dist, real) {
  const t = Math.min(1, Math.max(0, (dist - real * (1 - FADE)) / (real * FADE)));
  return t * t * (3 - 2 * t);
}

// how bright and big a star is, by how far off it is against where it's real
export const brightness = (dist, real) => Math.min(1, Math.max(DIM_LEAST, (real * BRIGHT_AT) / Math.max(dist, 1e-6)));
export const starPx = (k) => PX_LEAST + PX_MORE * k;

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

// (an sRGB colour's byte in the working space, a lookup a channel, so a
// ring's tens of thousands of specks are set in a frame: only while the
// working space has sRGB's primaries, where a channel needs only its own)
let LUT = null;
function byteLut() {
  if (THREE.ColorManagement.workingColorSpace !== THREE.LinearSRGBColorSpace) return null;
  if (!LUT) {
    const c = new THREE.Color();
    LUT = Float32Array.from({ length: 256 }, (_, i) => c.setRGB(i / 255, 0, 0, THREE.SRGBColorSpace).r);
  }
  return LUT;
}

// (a number as GLSL writes a float: 20 as 20.0)
const glf = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));

// A vertex is a place (aSlot −2: its pixels in aSize, its look worked out on
// the CPU), a disc (−1: its radius in aSize, where it is from the camera) or
// a slot's speck (its slot: its star's radius in aSize, where it is in the
// slot), and anything with nothing to show is put out of the frame
const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aK;
  attribute float aBright;
  attribute float aFocus;
  attribute vec3 aLight;
  attribute float aSlot;
  uniform float uDpr;
  uniform float uHeight;
  uniform float uTime;
  uniform float uSkyFar;
  uniform float uEdge;
  uniform vec4 uSlot[SLOTS];
  varying vec3 vColor;
  varying float vK;
  varying float vBright;
  varying float vFocus;
  varying float vDisc;
  varying vec3 vLight;
  varying float vPx;
  const float FAR = ${glf(FAR)};
  const float FADE = ${glf(FADE)};
  const float REAL_REACHES = ${glf(REAL_REACHES)};
  const float REAL_LEAST = ${glf(REAL_LEAST)};
  const float BRIGHT_AT = ${glf(BRIGHT_AT)};
  const float SPECK_LEAST = ${glf(SPECK_LEAST)};
  const float PX_LEAST = ${glf(PX_LEAST)};
  const float PX_MORE = ${glf(PX_MORE)};
  const float TO_WHITE = ${glf(TO_WHITE)};
  const float LIFT = ${glf(LIFT)};
  const float LIFT_MORE = ${glf(LIFT_MORE)};
  // (levels.js's: 1 short of the last fifth before the edge, 0 at it)
  float inside(float d, float edge) {
    float t = clamp((d - edge * (1.0 - FADE)) / (edge * FADE), 0.0, 1.0);
    return 1.0 - t * t * (3.0 - 2.0 * t);
  }
  void main() {
    vec3 at = position;
    float px = aSize;
    vColor = aColor;
    vK = aK;
    vBright = aBright;
    vFocus = aFocus;
    vDisc = 0.0;
    vLight = vec3(0.0);
    if (aSlot > -0.5) {
      // a speck: its slot's centre from the camera, and where it is in it;
      // on the sky past the far plane (speckBright, starPx), its disc within
      vec4 slot = uSlot[int(aSlot)];
      vec3 rel = slot.xyz + position;
      float d = max(length(rel), 1e-6);
      float k = BRIGHT_AT * max(REAL_LEAST, aSize * REAL_REACHES) / d;
      float b = clamp(k * k, SPECK_LEAST, 1.0);
      at = rel * (uSkyFar / d);
      px = PX_LEAST + PX_MORE * b;
      vColor = mix(aColor, vec3(1.0), TO_WHITE) * (LIFT + LIFT_MORE * b);
      vK = aSize > 0.0 ? slot.w * (1.0 - inside(d, FAR)) * inside(d, uEdge) : 0.0;
      vBright = b;
    } else if (aSlot > -1.5) {
      // a disc: its true size (levels.js's discPx), in the page's pixels
      px = aSize * projectionMatrix[1][1] * uHeight / max(length(position), 1e-6) / uDpr;
      vDisc = 1.0;
      vLight = mat3(modelViewMatrix) * aLight;
    }
    if (vK <= 0.0) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(at, 1.0);
    // (never cut by the far plane: on foot it's at the landing's sky,
    // footScene's far(), which the stars are well past)
    gl_Position.z = min(gl_Position.z, gl_Position.w * 0.999999);
    float pulse = 1.0 + aFocus * (0.45 + 0.2 * sin(uTime * 6.0));
    gl_PointSize = px * uDpr * pulse;
    vPx = gl_PointSize;
  }
`;
// (galaxy/sky.js's beacon: a hot core, a glow in its colour, a cross of
// spikes, brighter for the brighter stars and the one in focus; a disc is a
// ball in its colour, lit from its star or shining, its rim smoothed, and
// under a pixel across it covers only what it would. A star's depth is the
// far plane's, a disc's its own where it covers half the pixel or more)
const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vK;
  varying float vBright;
  varying float vFocus;
  varying float vDisc;
  varying vec3 vLight;
  varying float vPx;
  void main() {
    if (vK <= 0.0) discard;
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    if (vDisc > 0.5) {
      float lit = 1.0;
      if (dot(vLight, vLight) > 0.0) {
        vec3 n = vec3(q.x, -q.y, sqrt(1.0 - r * r));
        lit = 0.04 + 0.96 * max(dot(n, normalize(vLight)), 0.0);
      }
      float a = vK * (1.0 - smoothstep(1.0 - 2.0 / max(vPx, 2.0), 1.0, r)) * min(1.0, vPx * vPx);
      gl_FragDepth = a >= 0.5 ? gl_FragCoord.z : 1.0;
      gl_FragColor = vec4(vColor * lit * a, a);
      return;
    }
    float core = smoothstep(0.2, 0.05, r);
    float glow = exp(-r * 5.5) * 0.9;
    float spikes = (exp(-abs(q.x) * 30.0) + exp(-abs(q.y) * 30.0)) * (1.0 - r) * (smoothstep(0.3, 0.8, vBright) * 0.5 + vFocus * 0.8);
    vec3 c = vColor * (glow + spikes) + vec3(1.6 + vFocus * 1.4) * core;
    gl_FragDepth = 1.0;
    gl_FragColor = vec4(c * smoothstep(1.0, 0.75, r) * vK, 0.0);
  }
`;

// (a range of an attribute to upload, unless one waiting already holds it)
function mark(a, from, count) {
  if (count <= 0) return;
  const start = from * a.itemSize;
  const end = start + count * a.itemSize;
  const ranges = a.updateRanges;
  let held = false;
  for (let i = 0; i < ranges.length && !held; i++) held = ranges[i].start <= start && ranges[i].start + ranges[i].count >= end;
  if (!held) a.addUpdateRange(start, end - start);
  a.needsUpdate = true;
}

export function createFarStars(parent, { places, skyFar, slots = [], discs = 0 }) {
  const n = places.length;
  const D = Math.max(0, Math.floor(discs));
  const S = slots.length;
  if (S > MOST_SLOTS) throw new RangeError(`the far layer holds ${MOST_SLOTS} slots at most, not ${S}`);
  // the places, then each slot's specks, then the discs: one draw blends in
  // the vertices' order, so a disc drawn last covers the specks behind it
  const slotAt = new Int32Array(S + 1);
  slotAt[0] = n;
  for (let i = 0; i < S; i++) slotAt[i + 1] = slotAt[i] + Math.max(0, Math.floor(slots[i]));
  const discAt = slotAt[S];
  const total = discAt + D;
  const real = places.map((p) => (p.station ? STATION_REAL : realAt(p)));
  const base = places.map((p) => new THREE.Color(p.color).lerp(WHITE, TO_WHITE));
  const attr = (size) => new THREE.BufferAttribute(new Float32Array(total * size), size).setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  const A = { position: attr(3), aSize: attr(1), aColor: attr(3), aK: attr(1), aBright: attr(1), aFocus: attr(1), aLight: attr(3) };
  for (const [k, a] of Object.entries(A)) geo.setAttribute(k, a);
  // (what each kind writes, uploaded as written)
  const PLACE = [A.position, A.aSize, A.aBright, A.aColor, A.aK, A.aFocus];
  const DISC = [A.aSize, A.aColor, A.aLight, A.aK];
  const SPECK = [A.position, A.aColor, A.aSize];
  const kind = new Float32Array(total).fill(-1, discAt, total);
  kind.fill(-2, 0, n);
  for (let i = 0; i < S; i++) kind.fill(i, slotAt[i], slotAt[i + 1]);
  geo.setAttribute('aSlot', new THREE.BufferAttribute(kind, 1));
  const U = Array.from({ length: Math.max(1, S) }, () => new THREE.Vector4());
  // In the opaque list (transparent false) just after the sky and before
  // anything else there. Tested against nothing (AlwaysDepth), so nothing of
  // it hides behind the far plane or the sky; but it writes depth: a disc
  // its own, so a mesh farther off drawn after it fails against it, and a
  // star or speck the far plane's (1, what the depth is cleared to), so
  // anything solid drawn after it (a near planet in front of a far one)
  // still covers it. Premultiplied: a star adds (its alpha 0) and a disc
  // covers (its alpha its cover)
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { SLOTS: Math.max(1, S) },
    uniforms: { uDpr: { value: 1 }, uHeight: { value: FRAME_H }, uTime: { value: 0 }, uSkyFar: { value: skyFar }, uEdge: { value: NO_EDGE }, uSlot: { value: U } },
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: false,
    depthTest: true,
    depthFunc: THREE.AlwaysDepth,
    depthWrite: true,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'far-stars';
  points.renderOrder = -9;
  points.frustumCulled = false;
  // (a point's size is in the frame's pixels as drawn: the page's px times
  // the ratio the frame is drawn at)
  const px = new THREE.Vector2();
  points.onBeforeRender = (renderer) => {
    const target = renderer.getRenderTarget();
    const h = target ? target.height : renderer.getDrawingBufferSize(px).y;
    mat.uniforms.uHeight.value = h;
    mat.uniforms.uDpr.value = h / (renderer.domElement.clientHeight || h / renderer.getPixelRatio());
  };
  parent.add(points);

  const hidden = places.map(() => false); // (what this has done to each group, so it only ever undoes its own)
  const far = places.map(() => 1); // kOf: 0 real … 1 far
  const index = new Map(places.map((p, i) => [p.id, i]));
  const camAt = new THREE.Vector3();
  const P = A.position.array;
  let clock = 0;
  let fovY = 34; // (the camera's, as of the last update)

  // pops (dev): nothing's counted till it's first asked
  let track = false;
  let primed = false; // (the discs: a frame seen since it was asked)
  let popped = 0;
  let popPx = 0;
  let seen = new Map(); // a disc's id → how much showed last frame
  let seenNext = new Map();
  const gone = new Set(); // (the keys of the slots drawn last frame and hidden since)
  const pop = (size) => {
    popped++;
    popPx = Math.max(popPx, size);
  };

  // the slots: how much of each shows, its fade in (a second), how much of
  // what it holds was drawn last frame, its centre (the parent's space), how
  // many specks it has and what it holds (for pops)
  const sAlpha = new Float64Array(S);
  const sRate = new Float64Array(S);
  const sWas = new Float64Array(S);
  const sCentre = new Float64Array(S * 3);
  const sCount = new Int32Array(S);
  const sKey = new Array(S).fill(NO_KEYS); // (what each holds: its keys)
  let edge = Infinity;
  const tint = new THREE.Color();
  const weights = { full: 0, disc: 0, speck: 0 };
  const NONE = { reach: 0 };
  const placeSlot = (i) => U[i].set(sCentre[i * 3] - camAt.x, sCentre[i * 3 + 1] - camAt.y, sCentre[i * 3 + 2] - camAt.z, sAlpha[i]);
  const slotIn = (i) => {
    if (!(i >= 0 && i < S)) throw new RangeError(`no slot ${i} of ${S}`);
    return i;
  };
  const hide = (i) => {
    if (sWas[i] > 0) for (const k of sKey[i]) gone.add(k);
    sAlpha[i] = 0;
    sRate[i] = 0;
    U[i].w = 0;
  };
  // the largest speck a slot shows, in the frame's pixels (for pops)
  const slotPx = (i) => {
    const R = A.aSize.array;
    let most = 0;
    for (let v = slotAt[i], end = v + sCount[i]; v < end; v++) {
      if (!(R[v] > 0)) continue;
      const d = Math.hypot(U[i].x + P[v * 3], U[i].y + P[v * 3 + 1], U[i].z + P[v * 3 + 2]);
      if (sAlpha[i] * levelWeights(d, NONE, weights).speck * beyondFade(d, edge) > 0.5) most = Math.max(most, starPx(speckBright(d, R[v])) * mat.uniforms.uDpr.value);
    }
    return most;
  };

  // the discs: staged a frame (in the parent's space), the farthest kept on
  // top of a heap, so a full one swaps it for a nearer; then drawn far to near
  const dAt = new Float64Array(D * 3);
  const dR = new Float32Array(D);
  const dRGB = new Float32Array(D * 3);
  const dL = new Float32Array(D * 3);
  const dA = new Float32Array(D);
  const dD = new Float64Array(D);
  const dId = new Array(D).fill(null);
  const heap = new Int32Array(D);
  const shownAt = new Float64Array(D * 3); // (what's drawn, far to near)
  let staged = 0;
  let shown = 0;
  const up = (k) => {
    const s = heap[k];
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!(dD[s] > dD[heap[p]])) break;
      heap[k] = heap[p];
      k = p;
    }
    heap[k] = s;
  };
  const down = (k, size) => {
    const s = heap[k];
    for (;;) {
      let c = 2 * k + 1;
      if (c >= size) break;
      if (c + 1 < size && dD[heap[c + 1]] > dD[heap[c]]) c++;
      if (!(dD[heap[c]] > dD[s])) break;
      heap[k] = heap[c];
      k = c;
    }
    heap[k] = s;
  };
  const writeDiscs = () => {
    for (let k = 0; k < shown; k++) {
      const v = (discAt + k) * 3;
      P[v] = shownAt[k * 3] - camAt.x;
      P[v + 1] = shownAt[k * 3 + 1] - camAt.y;
      P[v + 2] = shownAt[k * 3 + 2] - camAt.z;
    }
    mark(A.position, discAt, shown);
  };
  const writer = {
    begin() {
      staged = 0;
    },
    push(x, y, z, r, cr, cg, cb, lx, ly, lz, alpha, id = null) {
      if (!(alpha > 0) || D === 0) return;
      const dx = x - camAt.x;
      const dy = y - camAt.y;
      const dz = z - camAt.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // (nowhere, or infinitely far: none, as a NaN would stick in the heap)
      if (!(d < Infinity)) return;
      let s;
      if (staged < D) {
        s = staged;
        dD[s] = d;
        heap[staged] = s;
        up(staged++);
      } else if (d < dD[heap[0]]) {
        s = heap[0];
        dD[s] = d;
        down(0, D);
      } else return;
      dAt[s * 3] = x;
      dAt[s * 3 + 1] = y;
      dAt[s * 3 + 2] = z;
      dR[s] = r;
      dRGB[s * 3] = cr;
      dRGB[s * 3 + 1] = cg;
      dRGB[s * 3 + 2] = cb;
      dL[s * 3] = lx;
      dL[s * 3 + 1] = ly;
      dL[s * 3 + 2] = lz;
      dA[s] = alpha;
      dId[s] = id;
    },
    end() {
      const was = shown;
      const m = staged;
      const R = A.aSize.array;
      const C = A.aColor.array;
      const L = A.aLight.array;
      const K = A.aK.array;
      if (track) seenNext.clear();
      for (let k = 0, size = m; k < m; k++) {
        const s = heap[0];
        if (--size > 0) {
          heap[0] = heap[size];
          down(0, size);
        }
        const v = discAt + k;
        for (let j = 0; j < 3; j++) {
          shownAt[k * 3 + j] = dAt[s * 3 + j];
          C[v * 3 + j] = dRGB[s * 3 + j];
          L[v * 3 + j] = dL[s * 3 + j];
        }
        R[v] = dR[s];
        K[v] = dA[s];
        const id = dId[s];
        if (track && id !== null) {
          if (primed && !(seen.get(id) > 0) && dA[s] > 0.5) pop(discPx(dD[s], dR[s], { fovY, height: mat.uniforms.uHeight.value }));
          seenNext.set(id, dA[s]);
        }
        dId[s] = null;
      }
      K.fill(0, discAt + m, discAt + was);
      shown = m;
      staged = 0;
      writeDiscs();
      for (const a of DISC) mark(a, discAt, Math.max(m, was));
      if (track) {
        const t = seen;
        seen = seenNext;
        seenNext = t;
        primed = true;
      }
    },
  };

  return {
    points,
    update(camera, dt = 1 / 60, { focus = null, sector = null } = {}) {
      clock += dt;
      mat.uniforms.uTime.value = clock;
      fovY = camera.getEffectiveFOV?.() ?? fovY;
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
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
        const shownK = here && !p.station ? k : 0;
        far[i] = k;
        // (on the sky from the camera, where the points sit)
        const s = dist > 1e-6 ? skyFar / dist : 0;
        A.position.setXYZ(i, dx * s, dy * s, dz * s);
        const b = brightness(dist, real[i]);
        A.aSize.setX(i, starPx(b));
        A.aBright.setX(i, b);
        const lift = LIFT + LIFT_MORE * b;
        A.aColor.setXYZ(i, base[i].r * lift, base[i].g * lift, base[i].b * lift);
        A.aK.setX(i, shownK);
        A.aFocus.setX(i, p.id === focus ? 1 : 0);
        // the real thing hidden once it's all star (or nothing, for another
        // sector or a station far from home)
        const hide = k >= 1;
        const g = p.group;
        if (g && hide !== hidden[i]) g.visible = !hide;
        hidden[i] = hide;
      }
      // (just the places: the whole of them, as ever, when they're all it draws)
      if (n) for (const a of PLACE) total === n ? (a.needsUpdate = true) : mark(a, 0, n);
      writeDiscs();
      // the slots round the camera, each fading in as it was asked
      for (let i = 0; i < S; i++) {
        if (sRate[i] > 0) {
          sAlpha[i] = Math.min(1, sAlpha[i] + dt * sRate[i]);
          if (sAlpha[i] >= 1) sRate[i] = 0;
        }
        placeSlot(i);
        // (out of nothing, unless it's what another drawn last frame held)
        if (track && !(sWas[i] > 0) && sAlpha[i] > 0.5 && !sKey[i].some((k) => gone.has(k))) {
          const most = slotPx(i);
          if (most > 0) pop(most);
        }
        sWas[i] = sAlpha[i];
      }
      gone.clear();
    },
    kOf(id) {
      const i = index.get(id);
      return i === undefined ? null : far[i];
    },
    setSlot(i, { centre, at, color, r, count, key = null }) {
      hide(slotIn(i));
      // (what it holds now was never drawn)
      sWas[i] = 0;
      sKey[i] = key === null ? NO_KEYS : Array.isArray(key) ? [...key] : [key];
      const from = slotAt[i];
      const size = slotAt[i + 1] - from;
      // (what fits, of what it was given)
      const c = Math.max(0, Math.min(size, Math.floor(count) || 0, Math.floor(at.length / 3), r.length, Math.floor(color.length / 3)));
      const R = A.aSize.array;
      const C = A.aColor.array;
      P.set(at.subarray(0, c * 3), from * 3);
      P.fill(0, (from + c) * 3, (from + size) * 3);
      R.set(r.subarray(0, c), from);
      R.fill(0, from + c, from + size);
      const lut = byteLut();
      if (lut) for (let k = 0; k < c * 3; k++) C[from * 3 + k] = lut[color[k]];
      else {
        for (let k = 0; k < c; k++) {
          tint.setRGB(color[k * 3] / 255, color[k * 3 + 1] / 255, color[k * 3 + 2] / 255, THREE.SRGBColorSpace);
          C[(from + k) * 3] = tint.r;
          C[(from + k) * 3 + 1] = tint.g;
          C[(from + k) * 3 + 2] = tint.b;
        }
      }
      C.fill(0, (from + c) * 3, (from + size) * 3);
      for (const a of SPECK) mark(a, from, size);
      sCount[i] = c;
      sCentre[i * 3] = centre[0];
      sCentre[i * 3 + 1] = centre[1];
      sCentre[i * 3 + 2] = centre[2];
      placeSlot(i);
    },
    showSlots(list) {
      for (const i of list) {
        sAlpha[slotIn(i)] = 1;
        sRate[i] = 0;
        U[i].w = 1;
      }
    },
    hideSlots(list) {
      for (const i of list) hide(slotIn(i));
    },
    fadeSlot(i, seconds) {
      slotIn(i);
      if (seconds > 0 && sAlpha[i] < 1) sRate[i] = 1 / seconds;
      else {
        sAlpha[i] = 1;
        sRate[i] = 0;
        U[i].w = 1;
      }
    },
    setEdge(e) {
      edge = e >= 0 ? e : 0;
      mat.uniforms.uEdge.value = Number.isFinite(edge) ? edge : NO_EDGE;
    },
    discs: writer,
    pops() {
      if (!track) {
        track = true;
        primed = false;
        sWas.set(sAlpha);
        popped = 0;
        popPx = 0;
      }
      const out = { count: popped, px: popPx };
      popped = 0;
      popPx = 0;
      return out;
    },
    dispose() {
      places.forEach((p, i) => {
        if (p.group && hidden[i]) p.group.visible = true;
      });
      parent.remove(points);
      geo.dispose();
      mat.dispose();
    },
  };
}
