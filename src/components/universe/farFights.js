// Far fights. Since the spread (scale.js’s SPREAD) a fight is somewhere out
// in deep space, not something that comes to you: a skirmish (skirmish.js) at
// a waypoint (waypoints.js), the crew’s war at its beacon (front.js’s frontAt). Close
// to, it’s drawn as itself; further than FAR from the camera the real thing
// isn’t drawn, and this draws it instead: a cluster of flickering points of
// fire where it is, and the odd brighter flash of a bolt, so you see a fight
// from across a region and go to it. The chart names where it is
// (“Fighting near Middle-earth”). The design:
// docs/superpowers/specs/2026-10-07-universe-scale-hyperlanes-design.md,
// decision 9.
//
// The rules are pure and tested: FAR, isFar, impostorFor (how many points a
// fight is and how fast it flickers), fightLabel (the chart’s name for it)
// and pickFightNode (which waypoint the next skirmish is at).
// createFarFights draws them: a small pool of Points, one a fight, made once
// and sharing one material, so a frame allocates nothing and costs a draw
// call a far fight.
//
// createFarFights(parent) → { update(dt, fights: [{ id, at, size, hot }],
//   camera), dispose() }
// `at` is [x, y, z] or { x, y, z } in the parent’s space (the map’s); `size`
// is how many ships are in it; `hot` how fierce it is, 0 to 1 (the share of
// HOT_BOLTS that are flying).

import * as THREE from 'three';
import { NODES } from './waypoints';
import { regionAt } from './regions';

export const FAR = 2000; // past this from the camera, a fight is its impostor
const HOT_BOLTS = 16; // the bolts in flight that make a fight as hot as it gets
const POINTS = [12, 96]; // the fewest and most points a fight is drawn with
const PER_SHIP = 4; // and how many each ship in it adds
const FLICKER = [1.5, 12]; // how fast it flickers (Hz): calm, and at its fiercest
const PER_BOLT = 0.6; // and how much faster each bolt in flight makes it
const SPREAD = [30, 260]; // how far its points are spread (map units), least and most
const FLASHES = 10; // the bolt flashes a fight has going, each on for a moment
const POOL = 4; // far fights drawn at once, at most (the front and a skirmish or two)
const PX = 2.2; // a point’s size on screen (CSS px)
export const SKY = 24000; // past this a fight is drawn on the sky, this far out along its line (the camera sees to 45,000)
export const MIN_ANGLE = 0.008; // and never spread over less than this much of the view (radians, about 10 px), or from across the map it’s a speck

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const xyz = (p) => (Array.isArray(p) ? p : [p.x, p.y, p.z]);

// further than `far` from `cam` ({ x, y, z })
export function isFar(at, cam, far = FAR) {
  const [x, y, z] = xyz(at);
  return Math.hypot(x - cam.x, y - cam.y, z - cam.z) > far;
}

// where a fight's light goes and how wide it's spread, seen from `cam`: past
// SKY, brought in to SKY along the same line and shrunk with it (the same to
// the eye); and never narrower than MIN_ANGLE of the view
export function skyPlace(at, cam, spread, sky = SKY) {
  const [x, y, z] = xyz(at);
  const d = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
  const k = d > sky ? sky / d : 1;
  return { at: k === 1 ? [x, y, z] : [cam.x + (x - cam.x) * k, cam.y + (y - cam.y) * k, cam.z + (z - cam.z) * k], spread: Math.max(spread, d * MIN_ANGLE) * k };
}

// a fight as light: more points the more ships in it, and flickering faster
// the more bolts are flying (and spread wider, the bigger it is)
export function impostorFor({ size = 0, bolts = 0 } = {}) {
  return {
    points: Math.round(clamp(8 + size * PER_SHIP, POINTS[0], POINTS[1])),
    flicker: clamp(FLICKER[0] + bolts * PER_BOLT, FLICKER[0], FLICKER[1]),
    spread: clamp(20 + size * 6, SPREAD[0], SPREAD[1]),
  };
}

// what the chart calls a fight at `at`: by its region (whose name already
// reads “Near Middle-earth”, or “The home system”), or out in the void
export function fightLabel(at) {
  const r = regionAt(...xyz(at));
  if (!r) return 'Fighting in the void';
  if (r.name.startsWith('Near ')) return `Fighting near ${r.name.slice(5)}`;
  return `Fighting in ${r.name[0].toLowerCase()}${r.name.slice(1)}`;
}

// where the next skirmish is: a node (a ramp or a beacon) of the region
// you’re headed for, else any beacon, and always further than `far` from the
// ship, so you see it from afar and take a lane to it; null if there’s none
export function pickFightNode({ ship, headedFor = null, rand = Math.random, nodes = NODES, far = FAR }) {
  const away = (n) => isFar(n.at, ship, far);
  let pool = headedFor ? nodes.filter((n) => n.region === headedFor && away(n)) : [];
  if (!pool.length) pool = nodes.filter((n) => n.kind === 'beacon' && away(n));
  if (!pool.length) return null;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

// The drawing. Each point has a seed; the first FLASHES of a fight’s points
// are its bolt flashes (each somewhere new each time it comes on, for a
// moment, more often the hotter it is), the rest its cluster, each
// flickering at the fight’s rate out of step with the others. The points are
// fixed in a unit ball, and the Points scaled to the fight’s spread.
const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aFlash;
  uniform float uTime;
  uniform float uHz;
  uniform float uHot;
  uniform float uPx;
  varying float vA;
  varying vec3 vC;
  vec3 hash3(float n) {
    return fract(sin(vec3(n, n + 17.13, n + 41.71)) * 43758.5453);
  }
  void main() {
    vec3 p = position;
    if (aFlash > 0.5) {
      float phase = uTime * uHz * 0.35 * (0.6 + aSeed) + aSeed * 7.0;
      float f = fract(phase);
      p = (hash3(floor(phase) + aSeed * 13.0) * 2.0 - 1.0) * 0.8;
      vA = (f < 0.15 ? 1.0 - f / 0.15 : 0.0) * (0.3 + 0.7 * uHot);
      vC = vec3(0.85, 0.92, 1.0) * 1.6;
    } else {
      float s = 0.5 + 0.5 * sin(uTime * uHz * 6.2832 + aSeed * 40.0);
      vA = (0.25 + 0.75 * s * s) * (0.45 + 0.55 * uHot);
      vC = mix(vec3(1.0, 0.45, 0.18), vec3(1.0, 0.85, 0.55), aSeed);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uPx * (aFlash > 0.5 ? 1.8 : 1.0);
  }
`;
const FRAG = /* glsl */ `
  varying float vA;
  varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord * 2.0 - 1.0);
    if (d > 1.0 || vA <= 0.0) discard;
    gl_FragColor = vec4(vC * vA * (1.0 - d * d), 1.0);
  }
`;

export function createFarFights(parent) {
  const cap = FLASHES + POINTS[1];
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { uTime: { value: 0 }, uHz: { value: FLICKER[0] }, uHot: { value: 0 }, uPx: { value: PX } },
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  // (a seeded scatter, so a fight looks the same each visit)
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const slots = Array.from({ length: POOL }, () => {
    const pos = new Float32Array(cap * 3);
    const seeds = new Float32Array(cap);
    const flash = new Float32Array(cap);
    for (let i = 0; i < cap; i++) {
      // a point in the unit ball, thicker toward the middle
      const u = rand() * 2 - 1;
      const a = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.7);
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(a) * s * r;
      pos[i * 3 + 1] = u * r * 0.6; // (flatter than round: ships fight round a plane)
      pos[i * 3 + 2] = Math.sin(a) * s * r;
      seeds[i] = rand();
      flash[i] = i < FLASHES ? 1 : 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aFlash', new THREE.BufferAttribute(flash, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
    const points = new THREE.Points(geo, mat);
    points.name = 'far-fight';
    points.visible = false;
    points.userData.flicker = FLICKER[0];
    points.userData.hot = 0;
    // (one material for the pool: each fight’s own rate and heat go in just
    // before it’s drawn)
    points.onBeforeRender = () => {
      mat.uniforms.uHz.value = points.userData.flicker;
      mat.uniforms.uHot.value = points.userData.hot;
      mat.uniformsNeedUpdate = true;
    };
    parent.add(points);
    return { id: null, used: false, points };
  });

  const camAt = new THREE.Vector3();
  const cam = { x: 0, y: 0, z: 0 };
  let time = 0;
  // a fight’s slot: the one it had last frame (so its flicker doesn’t jump), or a free one
  const slotOf = (id) => {
    for (const s of slots) if (s.id === id && !s.used) return s;
    for (const s of slots) if (s.id === null && !s.used) return s;
    for (const s of slots) if (!s.used) return s;
    return null;
  };

  return {
    update(dt, fights, camera) {
      time += dt;
      mat.uniforms.uTime.value = time;
      parent.updateWorldMatrix(true, false);
      parent.worldToLocal(camera.getWorldPosition(camAt));
      cam.x = camAt.x;
      cam.y = camAt.y;
      cam.z = camAt.z;
      for (const s of slots) s.used = false;
      for (const f of fights ?? []) {
        if (!isFar(f.at, cam, f.near ?? FAR)) continue; // (the real one’s drawn; `near`: a fight drawn for real only nearer than that, the front's battle)
        const s = slotOf(f.id);
        if (!s) break;
        const hot = clamp(f.hot ?? 0, 0, 1);
        const look = impostorFor({ size: f.size, bolts: hot * HOT_BOLTS });
        const ease = s.id === f.id ? Math.min(1, dt * 2) : 1;
        s.id = f.id;
        s.used = true;
        const p = s.points;
        const sky = skyPlace(f.at, cam, look.spread);
        p.position.set(...sky.at);
        p.scale.setScalar(sky.spread);
        p.geometry.setDrawRange(0, FLASHES + look.points);
        p.userData.flicker += (look.flicker - p.userData.flicker) * ease;
        p.userData.hot += (hot - p.userData.hot) * ease;
        p.visible = true;
      }
      for (const s of slots) {
        if (s.used) continue;
        s.id = null;
        s.points.visible = false;
      }
    },
    dispose() {
      for (const s of slots) {
        parent.remove(s.points);
        s.points.geometry.dispose();
      }
      mat.dispose();
    },
  };
}
