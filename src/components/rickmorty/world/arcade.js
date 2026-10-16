// Blips and Chitz, inside, for ./scene.js: a huge round atrium under a
// starry space dome. You come in on a walkway (the arcade's walkable floor in
// ./rules.js) that runs out from the entrance wall over the hall, railed on
// three sides, with three cabinets along it and Roy's chair at its end, the
// high-score board on the rail beside it. Past the end, the giant orange
// planet with BLIPS AND CHITZ across it turns slowly over the round kiosk on
// the floor below, coloured spheres going round it; tall diagonal pillars
// framed in neon and chevrons of yellow bulbs lean up to the dome; three
// balcony rings line the walls, each with its row of cabinets and big
// screens; round teal-topped tables fill the floor. Magenta, purple, teal and
// gold neon. The static parts are merged into a few meshes (vertex colours);
// cabinets, screens, bulbs, tables and the planet's spheres are instanced.
//
// buildArcade(kit) → { group, update, noInk, light, actions: { setBoard(best) } }.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, hot } from '../stage';
import { toon } from '../portal/toon';
import { AREAS, FURNITURE } from './rules';
import { at, batch, coloured, fitModel, glowMaterial, logoText, mergeParts, neonCopy, paint, rng } from './kit';
import { createNpcs } from './npc';

const A = AREAS.arcade;
const CX = (A.x0 + A.x1) / 2; // the walkway's middle line, and the hall's
const CZ = A.z0 - 10; // the hall's middle: 10 m past the end of the walkway
const R_IN = 23; // the balconies' front edge
const R_OUT = 30; // the outer wall
const PLAY_R = 27.3; // where a regular stands to play a cabinet (theirs are at 28.6, round every level)
const SOUTH = A.z1 + 0.3; // the entrance wall, behind the walkway
const FLOOR = -4.2; // the hall's floor, a storey under the walkway
const STOREY = 4.2;
const DECKS = [STOREY, STOREY * 2, STOREY * 3]; // the balconies
const TOP = STOREY * 4; // where the dome starts
const CUT = Math.acos((SOUTH - CZ) / R_OUT); // where the outer wall meets the entrance wall
const PLANET = { y: 5.5, r: 4.6, belt: 4.78 };
// how much each tier draws: the cabinets' spacing round the rings (and which
// rings have them), the bulbs' chevron spacing, the tables, the regulars, and
// how finely the rings of neon are drawn
const PLAN = {
  high: { step: 1.9, rings: 4, chevron: 1.3, tables: 34, regulars: true, seg: 160, wallScreen: 0.21, planet: [64, 40] },
  mid: { step: 3.8, rings: 4, chevron: 2.6, tables: 18, regulars: false, seg: 96, wallScreen: 0.3, planet: [48, 32] },
  low: { step: 3.8, rings: 3, chevron: 3.9, tables: 10, regulars: false, seg: 64, wallScreen: 0.42, planet: [40, 26] },
};
const BOARD = { x: CX + 3.4, z: A.z0, w: 2.3, h: 1.45, y: 1.12 }; // the high-score board, on the rail right of Roy
const NEON = { magenta: 0xff3fd0, pink: 0xff7ad9, teal: 0x2ff5e0, gold: 0xffc23a, purple: 0xa45bff, lime: 0x9dff5a, blue: 0x4f8bff, orange: 0xff8a2a };
// dark, purple and neon-lit: little sun, a violet sky light, a deep haze far off
const ARCADE_LIGHT = { sun: [0xffa8e6, 0.6], hemi: [0xa08cff, 0x3a1d5c, 1.6], fog: [0x1c0e3a, 32, 130], background: 0x07041a };
// the made-up games on the walkway's three cabinets (their toasts are the component's)
const CABINET_GAMES = { cabinet1: 'SPACE MORTYBALL', cabinet2: 'PLUMBUS SMASH', cabinet3: 'CRONENBERG CRUSH' };

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const TAU = Math.PI * 2;
// a point at radius r and angle a round the hall's middle (a = 0 is south, +z)
const P = (r, a) => [CX + r * Math.sin(a), CZ + r * Math.cos(a)];
// the turn that faces something at angle a towards the middle
const inward = (a) => a + Math.PI;

// Arcade screens, all different, all moving: scrolling stripes, a game of
// bat and ball, a grid of blocks flicking on and off, rings pulsing out (by
// each one's `aSeed`; 9 and up is Roy's green). Instanced planes.
function screenMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 } }]),
    vertexShader: `
      attribute float aSeed;
      varying vec2 vUv;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vSeed = aSeed;
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float t;
      varying vec2 vUv;
      varying float vSeed;
      #include <fog_pars_fragment>
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 uv = vUv;
        float s = vSeed;
        float tt = t * (0.7 + fract(s * 3.7) * 0.6) + s * 10.0;
        vec3 c;
        if (s >= 9.0) {
          // Roy's: green, a bar rolling down it
          c = vec3(0.25, 1.0, 0.35) * (0.75 + 0.25 * (1.0 - smoothstep(0.0, 0.1, abs(fract(uv.y + t * 0.25) - 0.5))));
        } else {
          float m = floor(fract(s * 7.13) * 4.0);
          if (m < 1.0) {
            c = hue(fract(uv.y * 0.6 + tt * 0.12)) * (0.55 + 0.45 * step(0.5, fract(uv.x * 5.0 - tt * 1.3)));
          } else if (m < 2.0) {
            vec2 b = abs(fract(vec2(tt * 0.31, tt * 0.53)) * 2.0 - 1.0);
            b = 0.1 + b * 0.8;
            float ball = step(length((uv - b) * vec2(1.6, 1.0)), 0.06);
            float bats = step(abs(uv.x - 0.05), 0.02) * step(abs(uv.y - b.y), 0.14) + step(abs(uv.x - 0.95), 0.02) * step(abs(uv.y - (1.0 - b.y) * 0.8 - 0.1), 0.14);
            c = vec3(0.05, 0.06, 0.22) + vec3(0.35, 1.0, 0.7) * max(ball, bats) + vec3(0.2) * step(abs(uv.x - 0.5), 0.006) * step(0.5, fract(uv.y * 10.0));
          } else if (m < 3.0) {
            vec2 g = uv * vec2(8.0, 5.0);
            vec2 id = floor(g);
            vec2 f = fract(g);
            float on = step(0.45, hash(id + floor(tt * 2.5)));
            float cell = step(0.15, f.x) * step(0.15, f.y) * step(f.x, 0.85) * step(f.y, 0.85);
            c = mix(vec3(0.1, 0.03, 0.2), hue(fract(s + id.y * 0.13)), on * cell);
          } else {
            float r = length(uv - 0.5);
            c = hue(fract(r * 1.5 - tt * 0.3 + s)) * (0.45 + 0.55 * smoothstep(0.0, 0.6, sin(r * 28.0 - tt * 5.0)));
          }
        }
        c *= 0.86 + 0.14 * sin(uv.y * 150.0);
        float e = smoothstep(0.0, 0.05, uv.x) * smoothstep(0.0, 0.05, 1.0 - uv.x) * smoothstep(0.0, 0.07, uv.y) * smoothstep(0.0, 0.07, 1.0 - uv.y);
        gl_FragColor = vec4(c * (0.25 + 0.75 * e) * 1.5, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// geometry with its faces turned to face in (for walls seen from inside)
function inside(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const p = g.attributes.position.array;
  const n = g.attributes.normal.array;
  const uv = g.attributes.uv?.array;
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) [p[i + 3 + k], p[i + 6 + k]] = [p[i + 6 + k], p[i + 3 + k]];
    for (let k = 0; k < 3; k++) [n[i + 3 + k], n[i + 6 + k]] = [n[i + 6 + k], n[i + 3 + k]];
  }
  if (uv) for (let i = 0; i < uv.length; i += 6) for (let k = 0; k < 2; k++) [uv[i + 2 + k], uv[i + 4 + k]] = [uv[i + 4 + k], uv[i + 2 + k]];
  for (let i = 0; i < n.length; i++) n[i] = -n[i];
  return g;
}

// The hall's plan at radius R_OUT with the entrance wall's chord across the
// south, a hole of radius `hole` in the middle; shape coords (x, -z) round
// the hall's middle, for a geometry laid flat with rotateX(-pi/2).
function planShape(hole = 0) {
  const s = new THREE.Shape();
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const a = CUT + ((TAU - CUT * 2) * i) / n;
    const x = R_OUT * Math.sin(a);
    const z = R_OUT * Math.cos(a);
    if (i === 0) s.moveTo(x, -z);
    else s.lineTo(x, -z);
  }
  s.closePath();
  if (hole) {
    const h = new THREE.Path();
    h.absarc(0, 0, hole, 0, TAU, true);
    s.holes.push(h);
  }
  return s;
}

// a matrix that stands a unit-tall thing on `from` reaching to `to` (its y
// axis along the way), its front (+z) turned towards `face` (a direction)
function strut(from, to, face, sx = 1, sz = 1) {
  const y = new THREE.Vector3().subVectors(to, from);
  const len = y.length();
  y.normalize();
  const z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  const m = new THREE.Matrix4().makeBasis(x.multiplyScalar(sx), y.clone().multiplyScalar(len), z.multiplyScalar(sz));
  m.setPosition(from.clone().add(to).multiplyScalar(0.5));
  return m;
}

// ── the pieces ──

// An upright arcade cabinet a metre each way, its front +z, standing on y = 0:
// the body takes the instance's colour, the bezel and the control panel stay dark.
// SCREEN and MARQUEE are where its lit parts go, in the same frame.
function cabinetGeometry() {
  const parts = [];
  const add = (geo, color, x, y, z, sx, sy, sz, rx = 0) => parts.push({ geo, color, matrix: at(x, y, z, 0, sx, sy, sz, rx) });
  add(BOX, 0xffffff, 0, 0.23, -0.05, 1, 0.46, 0.9); // base
  add(BOX, 0x262030, 0, 0.5, 0.27, 1.02, 0.07, 0.36, 0.38); // control panel
  add(BOX, 0xff3355, -0.18, 0.56, 0.26, 0.07, 0.08, 0.07); // the stick
  add(BOX, 0xffd21a, 0.12, 0.55, 0.27, 0.08, 0.04, 0.08); // buttons
  add(BOX, 0x34e0ff, 0.28, 0.55, 0.27, 0.08, 0.04, 0.08);
  add(BOX, 0xffffff, 0, 0.75, -0.2, 1, 0.5, 0.6); // upper body
  add(BOX, 0x1a1424, 0, 0.74, 0.1, 0.9, 0.44, 0.06, -0.14); // bezel
  add(BOX, 0xffffff, 0, 0.94, -0.12, 1.06, 0.14, 0.72); // marquee box
  for (const s of [-1, 1]) add(BOX, 0xb9b0c8, s * 0.515, 0.5, -0.08, 0.04, 1, 0.84); // side panels
  return mergeParts(parts);
}
const SCREEN = at(0, 0.74, 0.135, 0, 0.78, 0.36, 1, -0.14);
const MARQUEE = at(0, 0.94, 0.245, 0, 0.98, 0.11, 1);

// a round teal-topped table on a chrome stem, three stools round it
const CYL12 = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
function tableGeometry() {
  const parts = [];
  const add = (geo, color, x, y, z, sx, sy, sz) => parts.push({ geo, color, matrix: at(x, y, z, 0, sx, sy, sz) });
  add(CYL12, 0x1fc8b8, 0, 0.76, 0, 1.15, 0.06, 1.15);
  add(CYL12, 0x0d6e70, 0, 0.71, 0, 1.05, 0.05, 1.05);
  add(CYL12, 0xc4c9d4, 0, 0.36, 0, 0.1, 0.72, 0.1);
  add(CYL12, 0x8d93a3, 0, 0.02, 0, 0.6, 0.04, 0.6);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    add(CYL12, 0xff4fc8, Math.sin(a) * 0.95, 0.5, Math.cos(a) * 0.95, 0.42, 0.08, 0.42);
    add(CYL12, 0xc4c9d4, Math.sin(a) * 0.95, 0.25, Math.cos(a) * 0.95, 0.06, 0.5, 0.06);
  }
  return mergeParts(parts);
}

// The planet's paint: orange bands and craters.
function planetMap(renderer) {
  const map = paint(renderer, 1024, 512, (g, W, H) => {
    const r = rng(17);
    g.fillStyle = '#ff8b1f';
    g.fillRect(0, 0, W, H);
    const bands = [
      [0.07, 0.14, '#e8650f'],
      [0.2, 0.26, '#ffa63d'],
      [0.32, 0.4, '#f0731a'],
      [0.47, 0.53, '#ffb04a'],
      [0.6, 0.68, '#f0731a'],
      [0.74, 0.8, '#ffa63d'],
      [0.86, 0.93, '#e8650f'],
    ];
    for (const [a, b, c] of bands) {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(0, a * H);
      for (let x = 0; x <= W; x += 16) g.lineTo(x, a * H + Math.sin((x / W) * TAU * 3 + a * 20) * 5);
      for (let x = W; x >= 0; x -= 16) g.lineTo(x, b * H + Math.sin((x / W) * TAU * 4 + b * 13) * 5);
      g.fill();
    }
    // craters, wider near the poles (the map stretches there)
    for (let i = 0; i < 40; i++) {
      const y = H * (0.08 + r() * 0.84);
      const x = r() * W;
      const s = 6 + r() * 16;
      const k = 1 / Math.max(0.3, Math.sin((y / H) * Math.PI));
      g.fillStyle = 'rgba(170,58,10,0.6)';
      g.beginPath();
      g.ellipse(x, y, s * k, s, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,200,128,0.55)';
      g.beginPath();
      g.ellipse(x - s * 0.15 * k, y - s * 0.2, s * 0.68 * k, s * 0.52, 0, 0, TAU);
      g.fill();
    }
  });
  map.wrapT = THREE.ClampToEdgeWrapping;
  return map;
}

// The sign belt round the planet's middle: purple, gold-edged, with BLIPS
// AND CHITZ on its front and back (it stays put while the planet turns).
function beltMap(renderer) {
  return paint(renderer, 4096, 256, (g, w, h) => {
    const r = rng(9);
    g.fillStyle = '#3b1468';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd34a';
    g.fillRect(0, 0, w, 16);
    g.fillRect(0, h - 16, w, 16);
    g.fillStyle = '#ff7ad9';
    for (let i = 0; i < 60; i++) {
      const x = r() * w;
      const y = h * (0.25 + r() * 0.5);
      g.beginPath();
      g.arc(x, y, 3 + r() * 4, 0, TAU);
      g.fill();
    }
    for (const u of [0, 0.5, 1]) logoText(g, 'BLIPS AND CHITZ', w * u, h * 0.53, h * 0.62, { maxW: w * 0.27 });
  });
}

// The space dome: a deep violet sky full of stars, nebulae in purple and
// teal; the brightest stars twinkle (and bloom).
function domeMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
      float stars(vec2 p, float dens, float size) {
        vec2 id = floor(p), f = fract(p) - 0.5;
        float r = hash(id);
        vec2 o = vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5;
        vec2 q = f - o * 0.6;
        float d = length(q);
        float cross = max((1.0 - smoothstep(0.0, size * 0.35, abs(q.x))) * (1.0 - smoothstep(0.0, size * 3.0, abs(q.y))), (1.0 - smoothstep(0.0, size * 0.35, abs(q.y))) * (1.0 - smoothstep(0.0, size * 3.0, abs(q.x))));
        float s = max(1.0 - smoothstep(0.0, size, d), cross * 0.8);
        return s * step(1.0 - dens, r) * (0.55 + 0.45 * sin(t * (0.8 + r * 2.5) + r * 40.0));
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(vec3(0.16, 0.05, 0.3), vec3(0.025, 0.012, 0.075), smoothstep(0.0, 0.75, h));
        vec2 p = d.xz / (h + 0.35);
        c += vec3(0.42, 0.08, 0.5) * smoothstep(0.5, 0.85, fbm(p * 1.4 + 3.0)) * 0.55;
        c += vec3(0.04, 0.36, 0.42) * smoothstep(0.55, 0.9, fbm(p * 2.1 - 5.0)) * 0.45;
        c += vec3(0.85, 0.85, 1.0) * stars(p * 24.0, 0.25, 0.09) * 0.6;
        c += vec3(1.0, 0.92, 0.75) * stars(p * 7.0, 0.12, 0.07) * 2.6;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

// Yellow bulbs that chase up the chevrons: on or dim by each one's `aPhase`.
function bulbMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 } }]),
    vertexShader: `
      attribute float aPhase;
      uniform float t;
      varying float vOn;
      #include <fog_pars_vertex>
      void main() {
        vOn = step(0.4, fract(aPhase - t * 0.8));
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying float vOn;
      #include <fog_pars_fragment>
      void main() {
        gl_FragColor = vec4(mix(vec3(0.55, 0.32, 0.06), vec3(3.0, 2.1, 0.55), vOn), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
}

// The high-score board: Roy's best lives, Morty's 55 and the visitor's best.
function drawBoard(g, w, h, best) {
  g.fillStyle = '#0b0620';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#ff3fd0';
  g.lineWidth = 10;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.strokeStyle = '#2ff5e0';
  g.lineWidth = 4;
  g.strokeRect(30, 30, w - 60, h - 60);
  logoText(g, 'ROY: A LIFE WELL LIVED', w / 2, h * 0.17, h * 0.11, { maxW: w * 0.86 });
  g.fillStyle = '#2ff5e0';
  g.font = `700 ${h * 0.075}px 'Courier New', 'DejaVu Sans Mono', monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('HIGH SCORES', w / 2, h * 0.31);
  g.fillStyle = '#b9a6ff';
  g.font = `700 ${h * 0.05}px 'Courier New', 'DejaVu Sans Mono', monospace`;
  g.textAlign = 'left';
  g.fillText('PLAYER', w * 0.14, h * 0.42);
  g.textAlign = 'right';
  g.fillText('AGE', w * 0.86, h * 0.42);
  const you = Number.isFinite(best) && best > 0 ? Math.floor(best) : null;
  const rows = [
    ['MORTY', 55, '#ffd21a'],
    ['YOU', you, '#ffffff'],
  ].sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
  rows.forEach(([name, age, col], i) => {
    const y = h * (0.56 + i * 0.16);
    g.fillStyle = col;
    g.font = `700 ${h * 0.1}px 'Courier New', 'DejaVu Sans Mono', monospace`;
    g.textAlign = 'left';
    g.fillText(`${i + 1}. ${name}`, w * 0.12, y);
    g.textAlign = 'right';
    g.fillText(age == null ? '—' : String(age), w * 0.88, y);
    g.fillStyle = 'rgba(185,166,255,0.35)';
    g.fillRect(w * 0.12, y + h * 0.065, w * 0.76, 3);
  });
  g.fillStyle = '#ff7ad9';
  g.font = `700 ${h * 0.05}px 'Courier New', 'DejaVu Sans Mono', monospace`;
  g.textAlign = 'center';
  g.fillText('PUT THE HEADSET ON', w / 2, h * 0.9);
}

// ── the arcade ──

export async function buildArcade(kit) {
  const { renderer, models, mats, tier = 'high' } = kit;
  const need = kit.need ?? ((n, o) => kit.cast.load(null, n, o));
  const plan = PLAN[tier] ?? PLAN.high;
  const group = new THREE.Group();
  group.name = 'arcade';
  const owned = []; // materials and textures made here, not the kit's
  const own = (x) => (owned.push(x), x);
  const VC = mats.toon(0xffffff, { vertexColors: true });
  const glow = own(glowMaterial(2.3));
  const deck = batch(); // the building: takes shadows, casts none (it would shade the whole walkway)
  const props = batch(); // the walkway's things: cast shadows
  const neon = batch();
  const cache = new Map();
  const C = (geo, color) => {
    const k = `${geo.uuid}${color}`;
    if (!cache.has(k)) cache.set(k, coloured(geo, color));
    return cache.get(k);
  };
  const r = rng(42);
  const tmp = new THREE.Matrix4();
  const levels = [FLOOR, ...DECKS];

  // ── the shell: floor, walls, balconies, the dome ──
  const floorMat = mats.painted(
    'arcade-floor',
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#251643';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2e1b52';
      g.fillRect(0, 0, w / 2, h / 2);
      g.fillRect(w / 2, h / 2, w / 2, h / 2);
      g.strokeStyle = '#3fd8d0';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(w / 2, h / 2, w * 0.22, 0, TAU);
      g.stroke();
      g.strokeStyle = '#140b28';
      g.lineWidth = 4;
      g.strokeRect(0, 0, w, h);
    },
    { tile: 3 },
  );
  deck.add(new THREE.ShapeGeometry(planShape(), 60).rotateX(-Math.PI / 2), floorMat, at(CX, FLOOR, CZ));
  // the outer wall, and the entrance wall across the south
  const wallH = TOP - FLOOR;
  deck.add(C(inside(new THREE.CylinderGeometry(R_OUT, R_OUT, wallH, 120, 1, true, CUT, TAU - CUT * 2)), 0x2a1748), VC, at(CX, FLOOR + wallH / 2, CZ));
  const chord = R_OUT * Math.sin(CUT);
  deck.add(C(BOX, 0x2a1748), VC, at(CX, FLOOR + wallH / 2, SOUTH + 0.2, 0, chord * 2 + 0.4, wallH, 0.4));
  // the balconies: rings of floor round the hall, the fascia lit along its
  // edge, a railing with a glowing top rail; and a band of neon round the
  // wall under each one, and gold round the foot of the dome
  const deckColours = [NEON.magenta, NEON.teal, NEON.gold];
  const slab = new THREE.ExtrudeGeometry(planShape(R_IN), { depth: 0.45, bevelEnabled: false, curveSegments: 96 }).rotateX(-Math.PI / 2);
  const ring = (rad, tube, y, color, mat = glow, buf = neon) => buf.add(C(new THREE.TorusGeometry(rad, tube, 5, plan.seg).rotateX(Math.PI / 2), color), mat, at(CX, y, CZ));
  DECKS.forEach((y, i) => {
    deck.add(C(slab, 0x3a2160), VC, at(CX, y - 0.45, CZ));
    ring(R_IN - 0.02, 0.07, y - 0.15, deckColours[i]);
    ring(R_IN + 0.02, 0.05, y - 0.42, deckColours[(i + 1) % 3]);
    ring(R_IN + 0.12, 0.045, y + 1.05, deckColours[i]); // the top rail
    ring(R_IN + 0.12, 0.03, y + 0.55, 0xa6a1b8, VC, deck);
    ring(R_OUT - 0.08, 0.06, y - 0.62, NEON.purple);
    const posts = Math.round((TAU * R_IN) / 2.2);
    for (let k = 0; k < posts; k++) {
      const a = (k / posts) * TAU;
      const [x, z] = P(R_IN + 0.12, a);
      deck.add(C(BOX, 0xa6a1b8), VC, at(x, y + 0.52, z, a, 0.07, 1.05, 0.07));
    }
  });
  ring(R_OUT - 0.1, 0.12, TOP, NEON.gold);
  const domeMat = own(domeMaterial());
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R_OUT, 64, 20, 0, TAU, 0, Math.PI / 2).scale(1, 0.55, 1), domeMat);
  dome.position.set(CX, TOP, CZ);
  dome.renderOrder = -5;
  group.add(dome);

  // ── the walkway: carpet, railing, lit edges, the doors behind ──
  const carpet = mats.painted('arcade-carpet', 512, 512, drawCarpet, { tile: 2.6 });
  const W = A.x1 - A.x0;
  const D = A.z1 - A.z0;
  const mz = (A.z0 + A.z1) / 2;
  props.add(BOX, carpet, at(CX, -0.03, mz, 0, W, 0.06, D));
  deck.add(C(BOX, 0x2b1850), VC, at(CX, -0.32, mz, 0, W, 0.52, D));
  for (const x of [A.x0 + 3, A.x1 - 3]) for (const z of [A.z0 + 2.5, A.z0 + 8.5]) deck.add(C(CYL, 0x3a2160), VC, at(x, (FLOOR - 0.58) / 2, z, 0, 0.9, -FLOOR - 0.58, 0.9));
  neon.add(C(BOX, NEON.magenta), glow, at(CX, -0.3, A.z0 - 0.02, 0, W + 0.1, 0.07, 0.05));
  for (const x of [A.x0 - 0.02, A.x1 + 0.02]) neon.add(C(BOX, NEON.magenta), glow, at(x, -0.3, mz, 0, 0.05, 0.07, D));
  // the railing round three sides; its top rail glows
  for (const [x0, z0, x1, z1] of [
    [A.x0, A.z0, A.x1, A.z0],
    [A.x0, A.z0, A.x0, A.z1],
    [A.x1, A.z0, A.x1, A.z1],
  ]) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const alongX = z0 === z1;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    neon.add(C(BOX, NEON.teal), glow, at(cx, 1.04, cz, 0, alongX ? len : 0.06, 0.06, alongX ? 0.06 : len));
    props.add(C(BOX, 0xb7b2c9), VC, at(cx, 0.55, cz, 0, alongX ? len : 0.04, 0.04, alongX ? 0.04 : len));
    const n = Math.round(len / 1.6);
    for (let k = 0; k <= n; k++) props.add(C(BOX, 0xb7b2c9), VC, at(x0 + ((x1 - x0) * k) / n, 0.52, z0 + ((z1 - z0) * k) / n, 0, 0.07, 1.04, 0.07));
  }
  // the doors in the entrance wall, lit by the dusk outside, framed in neon
  const doorTex = own(
    paint(renderer, 128, 128, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#5a2a8a');
      gr.addColorStop(0.6, '#c45aa8');
      gr.addColorStop(1, '#ffb3d0');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2a1040';
      g.fillRect(w / 2 - 3, 0, 6, h);
      g.fillRect(0, 0, w, 6);
    }),
  );
  const doors = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3), own(new THREE.MeshBasicMaterial({ color: hot(0xffffff, 1.1), map: doorTex })));
  doors.position.set(CX, 1.5, SOUTH - 0.01);
  doors.rotation.y = Math.PI;
  group.add(doors);
  neon.add(C(BOX, NEON.teal), glow, at(CX, 3.08, SOUTH - 0.04, 0, 3.7, 0.08, 0.06));
  for (const s of [-1, 1]) neon.add(C(BOX, NEON.teal), glow, at(CX + s * 1.8, 1.54, SOUTH - 0.04, 0, 0.08, 3.08, 0.06));
  // the name over the doors, and the games' posters either side of them
  const POSTERS = ['ROY', ...Object.values(CABINET_GAMES)];
  const posterTex = own(
    paint(renderer, 1024, 512, (g, w, h) => {
      const pw = w / 5;
      POSTERS.forEach((name, i) => drawPoster(g, i * pw, 0, pw, h, name, i));
      g.fillStyle = '#12061f';
      g.fillRect(pw * 4, 0, pw, h);
      g.save();
      g.translate(pw * 4.5, h / 2);
      g.rotate(-Math.PI / 2);
      logoText(g, 'BLIPS AND CHITZ', 0, 0, pw * 0.5, { maxW: h * 0.94 });
      g.restore();
    }),
  );
  const posterGeo = [
    [CX - 7.6, 0],
    [CX - 4.4, 1],
    [CX + 4.4, 2],
    [CX + 7.6, 3],
    [CX, 4],
  ].map(([x, i]) => {
    const sign = i === 4;
    const g = new THREE.PlaneGeometry(sign ? 3.4 : 1.7, sign ? 0.6 : 2.5);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) {
      const [u, v] = [uv.getX(k), uv.getY(k)];
      // the sign is drawn on its side in the atlas
      if (sign) uv.setXY(k, (5 - v) / 5, u);
      else uv.setX(k, (i + u) / 5);
    }
    return g.applyMatrix4(at(x, sign ? 3.38 : 1.75, SOUTH - 0.02, Math.PI));
  });
  for (const [x] of [[CX - 7.6], [CX - 4.4], [CX + 4.4], [CX + 7.6]]) neon.add(C(BOX, NEON.purple), glow, at(x, 3.06, SOUTH - 0.05, 0, 1.8, 0.05, 0.05));
  const posters = new THREE.Mesh(mergeGeometries(posterGeo), own(new THREE.MeshBasicMaterial({ map: posterTex, color: hot(0xffffff, 1.05) })));
  group.add(posters);

  // ── the pillars: leaning from the floor up into the dome, neon on their
  // edges, chevrons of yellow bulbs up their faces ──
  const PILLARS = [0.64, 1.05, 1.75, 2.5, Math.PI, -2.5, -1.75, -1.05, -0.64];
  const PILLAR_R = 21;
  const bulbs = []; // [x, y, z, phase]
  const chevron = plan.chevron;
  for (const a of PILLARS) {
    const [bx, bz] = P(PILLAR_R, a);
    const tang = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    const base = new THREE.Vector3(bx, FLOOR, bz);
    const top = new THREE.Vector3(bx, TOP + 3, bz).addScaledVector(tang, 6);
    const face = new THREE.Vector3(CX - bx, 0, CZ - bz).normalize();
    const len = base.distanceTo(top);
    const frame = strut(base, top, face, 1.3, 0.9);
    deck.add(C(BOX, 0x2c1650), VC, frame);
    deck.add(C(BOX, 0x4b2a7a), VC, strut(base, base.clone().lerp(top, 0.7 / len), face, 1.75, 1.35));
    for (const [x, z, color] of [
      [-0.68, 0.48, NEON.magenta],
      [0.68, 0.48, NEON.magenta],
      [-0.68, -0.48, NEON.teal],
      [0.68, -0.48, NEON.teal],
    ])
      neon.add(C(BOX, color), glow, frame.clone().multiply(at(x / 1.3, 0, z / 0.9, 0, 0.09 / 1.3, 1, 0.09 / 0.9)));
    // ^ chevrons up the front face, the bulbs chasing upwards
    const up = new THREE.Vector3().subVectors(top, base).normalize();
    const side = new THREE.Vector3().crossVectors(up, face).normalize();
    const front = new THREE.Vector3().crossVectors(side, up).normalize();
    const n = Math.floor((len - 1.6) / chevron);
    for (let j = 0; j < n; j++)
      for (let i = -4; i <= 4; i++) {
        const u = Math.abs(i) / 4;
        const p = base
          .clone()
          .addScaledVector(up, 1.0 + j * chevron + 0.55 * (1 - u))
          .addScaledVector(side, i * 0.14)
          .addScaledVector(front, 0.5);
        bulbs.push([p.x, p.y, p.z, j / 6 - u * 0.15]);
      }
  }
  const bulbMat = own(bulbMaterial());
  const bulbMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), bulbMat, bulbs.length);
  const phase = new Float32Array(bulbs.length);
  bulbs.forEach(([x, y, z, p], i) => {
    bulbMesh.setMatrixAt(i, tmp.makeTranslation(x, y, z));
    phase[i] = p;
  });
  bulbMesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  bulbMesh.frustumCulled = false;
  group.add(bulbMesh);

  // ── the kiosk on the floor, the planet over it, the spheres round it ──
  const K = { x: CX, y: FLOOR, z: CZ };
  deck.add(C(CYL, 0x5a2a8a), VC, at(K.x, K.y + 0.55, K.z, 0, 6.6, 1.1, 6.6));
  deck.add(C(CYL, 0x25d0c0), VC, at(K.x, K.y + 1.16, K.z, 0, 7.1, 0.12, 7.1));
  deck.add(C(CYL, 0x24133d), VC, at(K.x, K.y + 2.2, K.z, 0, 1.8, 2.2, 1.8));
  deck.add(C(CYL, 0x3b1d66), VC, at(K.x, K.y + 3.5, K.z, 0, 3.4, 1.2, 3.4));
  deck.add(C(CYL, 0xffc23a), VC, at(K.x, K.y + 4.16, K.z, 0, 3.7, 0.12, 3.7));
  const kioskRing = (rad, y, color) => neon.add(C(new THREE.TorusGeometry(rad, 0.07, 6, 64).rotateX(Math.PI / 2), color), glow, at(K.x, y, K.z));
  kioskRing(3.35, K.y + 0.08, NEON.magenta);
  kioskRing(3.6, K.y + 1.2, NEON.teal);
  kioskRing(1.75, K.y + 2.9, NEON.gold);
  kioskRing(1.86, K.y + 4.22, NEON.magenta);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3;
    const from = new THREE.Vector3(CX + Math.sin(a) * 1.4, PLANET.y + PLANET.r * 0.9, CZ + Math.cos(a) * 1.4);
    const to = new THREE.Vector3(CX + Math.sin(a) * 4, TOP + 13, CZ + Math.cos(a) * 4);
    deck.add(C(CYL, 0x1a1028), VC, strut(from, to, new THREE.Vector3(0, 0, 1), 0.07, 0.07));
  }
  const planetTex = own(planetMap(renderer));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PLANET.r, ...plan.planet), own(toon(0xffffff, { map: planetTex, emissiveMap: planetTex, emissive: hot(0xffffff, 0.4) })));
  planet.position.set(CX, PLANET.y, CZ);
  planet.rotation.set(0.08, 0, 0.06);
  group.add(planet);
  const beltTex = own(beltMap(renderer));
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(PLANET.belt, PLANET.belt, 1.5, 96, 1, true, -Math.PI, TAU), own(new THREE.MeshBasicMaterial({ map: beltTex, color: hot(0xffffff, 1.3) })));
  belt.position.copy(planet.position);
  group.add(belt);
  // the orbits (three drawn faintly) and the spheres going round them
  // each tilted so it passes in front of the walkway well above or below the belt
  const ORBITS = [
    { r: 6.6, tilt: 0.38, node: 0.2, speed: 0.32, size: 0.62, color: NEON.magenta },
    { r: 7.4, tilt: -0.33, node: -0.3, speed: -0.24, size: 0.5, color: NEON.teal },
    { r: 7.0, tilt: 0.55, node: 0.35, speed: 0.27, size: 0.42, color: NEON.lime },
    { r: 8.0, tilt: 0.3, node: Math.PI - 0.25, speed: 0.19, size: 0.7, color: NEON.blue },
    { r: 6.3, tilt: -0.45, node: Math.PI + 0.3, speed: -0.36, size: 0.38, color: NEON.gold },
    { r: 7.7, tilt: 0.42, node: -0.15, speed: 0.22, size: 0.46, color: 0xff4a4a },
    { r: 8.5, tilt: -0.36, node: Math.PI, speed: -0.17, size: 0.55, color: NEON.purple },
  ].map((o, i) => ({ ...o, phase: i * 1.9, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(o.tilt, o.node, 0, 'YXZ')) }));
  for (const o of ORBITS.slice(0, 3)) neon.add(C(new THREE.TorusGeometry(o.r, 0.025, 4, 120).rotateX(Math.PI / 2), o.color), glow, new THREE.Matrix4().compose(planet.position, o.q, new THREE.Vector3(1, 1, 1)));
  const spheres = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 24, 16), mats.toon(0xffffff, { emissive: 0x2a1a3a }), ORBITS.length);
  ORBITS.forEach((o, i) => spheres.setColorAt(i, new THREE.Color(o.color)));
  spheres.frustumCulled = false;
  group.add(spheres);

  // ── Roy's chair, and the high-score board on the rail beside it ──
  const roySpot = FURNITURE.find((f) => f.id === 'roy');
  const roy = models.get('roy-cabinet');
  let royScreen = null;
  if (roy) {
    // deeper than its spot: it runs back a little, under the rail
    const front = roySpot.z + roySpot.d / 2;
    const { holder } = fitModel(roy, { x0: roySpot.x - 0.95, x1: roySpot.x + 0.95, z0: front - 1.55, z1: front }, { h: roySpot.h });
    const copies = new Map();
    roy.traverse((o) => {
      if (!o.isMesh) return;
      if (!copies.has(o.material)) copies.set(o.material, own(neonCopy(o.material, { mode: 'green', k: 1.7 })));
      o.material = copies.get(o.material);
      o.castShadow = true;
      o.receiveShadow = true;
    });
    group.add(holder);
  } else royScreen = royStandIn(props, C, VC, neon, glow, roySpot);
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 768;
  boardCanvas.height = 484;
  const boardG = boardCanvas.getContext('2d');
  drawBoard(boardG, boardCanvas.width, boardCanvas.height, null);
  const boardTex = own(canvasTexture(boardCanvas, renderer, { wrap: false }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.h), own(new THREE.MeshBasicMaterial({ map: boardTex, color: hot(0xffffff, 1.2) })));
  board.position.set(BOARD.x, BOARD.y + BOARD.h / 2, BOARD.z - 0.03);
  group.add(board);
  props.add(C(BOX, 0x241040), VC, at(BOARD.x, BOARD.y + BOARD.h / 2, BOARD.z - 0.09, 0, BOARD.w + 0.2, BOARD.h + 0.2, 0.1));
  neon.add(C(BOX, NEON.magenta), glow, at(BOARD.x, BOARD.y + BOARD.h + 0.11, BOARD.z - 0.04, 0, BOARD.w + 0.24, 0.05, 0.05));
  for (const s of [-1, 1]) props.add(C(BOX, 0xb7b2c9), VC, at(BOARD.x + s * (BOARD.w / 2 - 0.2), BOARD.y - 0.04, BOARD.z - 0.06, 0, 0.06, 0.12, 0.12));

  // ── cabinets, their screens and marquees, round every level and on the walkway ──
  const cabGeo = cabinetGeometry();
  const cabs = []; // [matrix, colour]
  const screens = []; // [matrix, seed]
  const marquees = []; // [matrix, colour]
  const BODY = [0x7a3cff, 0x1fb5c2, 0xff3fa8, 0xff8a2a, 0x3d6bff, 0x9b2fd0, 0x22c47a];
  const LIT = [NEON.magenta, NEON.teal, NEON.gold, NEON.lime, NEON.pink, NEON.blue];
  const pick = (list) => list[Math.floor(r() * list.length)];
  const step = plan.step / 28.6;
  for (const y of levels.slice(0, plan.rings))
    for (let a = 0.66; a < TAU - 0.66; a += step) {
      const [x, z] = P(28.6, a);
      const m = at(x, y, z, inward(a), 0.9, 1.8, 0.85);
      cabs.push([m, pick(BODY)]);
      screens.push([m.clone().multiply(SCREEN), r() * 8.9]);
      marquees.push([m.clone().multiply(MARQUEE), pick(LIT)]);
    }
  // big screens on the wall above them (on the floor, a band at the walkway's eye level)
  for (const y of levels)
    for (let a = 0.72; a < TAU - 0.72; a += y === FLOOR ? 0.27 : plan.wallScreen) {
      const [x, z] = P(R_OUT - 0.1, a);
      screens.push([y === FLOOR ? at(x, 1.2, z, inward(a), 4.6, 2.6, 1) : at(x, y + 2.55, z, inward(a), 2.6, 1.4, 1), r() * 8.9]);
    }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    screens.push([at(K.x + Math.sin(a) * 3.42, K.y + 0.6, K.z + Math.cos(a) * 3.42, a, 1.2, 0.7, 1), r() * 8.9]);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    screens.push([at(K.x + Math.sin(a) * 1.82, K.y + 3.5, K.z + Math.cos(a) * 1.82, a, 1.15, 0.85, 1), r() * 8.9]);
  }
  if (royScreen) screens.push([royScreen, 9.5]);
  // the walkway's three, bigger, each with its game's name lit on top
  const walkway = FURNITURE.filter((f) => f.area === 'arcade' && f.kind === 'arcade');
  const nameTex = own(
    paint(renderer, 512, 384, (g, w, h) => {
      walkway.forEach((f, i) => {
        const y0 = (i * h) / 3;
        const gr = g.createLinearGradient(0, y0, 0, y0 + h / 3);
        gr.addColorStop(0, ['#3a0f5e', '#06404a', '#4a1030'][i % 3]);
        gr.addColorStop(1, ['#12061f', '#031a20', '#1f0612'][i % 3]);
        g.fillStyle = gr;
        g.fillRect(0, y0, w, h / 3);
        logoText(g, CABINET_GAMES[f.id] ?? 'ARCADE', w / 2, y0 + h / 6, h * 0.15, { maxW: w * 0.92 });
      });
    }),
  );
  const nameGeo = walkway.map((f, i) => {
    const m = at(f.x, 0, f.z, f.turn, f.w * 0.92, f.h, f.d);
    props.add(tinted(cabGeo, BODY[(i * 3) % BODY.length]), VC, m);
    screens.push([m.clone().multiply(SCREEN), 1.3 + i * 2.1]);
    const g = new THREE.PlaneGeometry(1, 1);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, (2 - i + uv.getY(k)) / 3);
    return g.applyMatrix4(m.clone().multiply(MARQUEE).multiply(at(0, 0, 0.004)));
  });
  const nameMesh = new THREE.Mesh(mergeGeometries(nameGeo), own(new THREE.MeshBasicMaterial({ map: nameTex, color: hot(0xffffff, 1.35) })));
  group.add(nameMesh);
  const cabMesh = new THREE.InstancedMesh(cabGeo, VC, cabs.length);
  cabs.forEach(([m, c], i) => {
    cabMesh.setMatrixAt(i, m);
    cabMesh.setColorAt(i, new THREE.Color(c));
  });
  cabMesh.receiveShadow = true;
  group.add(cabMesh);
  const screenMat = own(screenMaterial());
  const screenMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), screenMat, screens.length);
  const seeds = new Float32Array(screens.length);
  screens.forEach(([m, s], i) => {
    screenMesh.setMatrixAt(i, m);
    seeds[i] = s;
  });
  screenMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  screenMesh.frustumCulled = false;
  group.add(screenMesh);
  const marqueeMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), own(new THREE.MeshBasicMaterial({ color: hot(0xffffff, 1.7) })), marquees.length);
  marquees.forEach(([m, c], i) => {
    marqueeMesh.setMatrixAt(i, m);
    marqueeMesh.setColorAt(i, new THREE.Color(c));
  });
  marqueeMesh.frustumCulled = false;
  group.add(marqueeMesh);

  // ── the tables on the floor ──
  const spots = [];
  for (let tries = 0; spots.length < plan.tables && tries < 3000; tries++) {
    const a = r() * TAU;
    const [x, z] = P(7 + r() * 13, a);
    if (Math.abs(x - CX) < 11.5 && z > A.z0 - 1.5) continue; // under the walkway
    if (PILLARS.some((p) => Math.hypot(P(PILLAR_R, p)[0] - x, P(PILLAR_R, p)[1] - z) < 2.6)) continue;
    if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 3.2)) continue;
    spots.push([x, z, r() * TAU]);
  }
  const tables = new THREE.InstancedMesh(tableGeometry(), VC, spots.length);
  spots.forEach(([x, z, turn], i) => tables.setMatrixAt(i, at(x, FLOOR, z, turn)));
  tables.receiveShadow = true;
  group.add(tables);

  // ── signs on the first balcony ──
  const SIGNS = ['TOKENS', 'PRIZES', 'SNACKS', 'VR GAMES'];
  const signTex = own(
    paint(renderer, 512, 512, (g, w, h) => {
      SIGNS.forEach((s, i) => {
        const y0 = (i * h) / 4;
        g.fillStyle = '#12061f';
        g.fillRect(0, y0, w, h / 4);
        g.strokeStyle = ['#ff3fd0', '#2ff5e0', '#ffc23a', '#9dff5a'][i];
        g.lineWidth = 8;
        g.strokeRect(8, y0 + 8, w - 16, h / 4 - 16);
        logoText(g, s, w / 2, y0 + h / 8, h * 0.12, { maxW: w * 0.84 });
      });
    }),
  );
  const signGeo = [Math.PI - 0.35, Math.PI + 0.55, 2.05, -2.05].map((a, i) => {
    const [x, z] = P(R_IN - 0.14, a);
    const g = new THREE.PlaneGeometry(3.2, 0.8);
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setY(k, (3 - i + uv.getY(k)) / 4);
    return g.applyMatrix4(at(x, DECKS[0] + 0.62, z, inward(a)));
  });
  const signMesh = new THREE.Mesh(mergeGeometries(signGeo), own(new THREE.MeshBasicMaterial({ map: signTex, color: hot(0xffffff, 1.3) })));
  group.add(signMesh);

  // ── the merged meshes ──
  deck.build(group, { cast: false, receive: true });
  props.build(group, { cast: true, receive: true });
  const glows = neon.build(group, { cast: false, receive: false });
  for (const g of cache.values()) g.dispose();

  // ── a few regulars, out over the hall ──
  // Each goes from cabinet to cabinet round its own level (../npc.js's
  // wander: a stop in front of each, turned to its screen), plays a while,
  // and now and then cheers or gloats at how it went (`cheer`)
  const regulars = [];
  const hall = createNpcs({ id: 'arcade', area: { x0: CX - R_OUT, x1: CX + R_OUT, z0: CZ - R_OUT, z1: CZ + R_OUT } });
  if (plan.regulars) {
    await need(['gromflomite', 'gazorpian'], { clips: ['idle', 'walk'] }).catch(() => {});
    // a stop in front of the cabinet at angle `a`: where it stands, and which way it faces (out, at the screen)
    const stop = (a) => [...P(PLAY_R, a), a - Math.PI / 2];
    const place = (kind, y, a0, turns) => {
      const c = kit.cast.make(kind);
      if (!c) return;
      const [x, z] = P(PLAY_R, a0);
      group.add(c.group);
      const n = hall.add(c, { x, z, y, face: a0 - Math.PI / 2, id: `${kind}-${regulars.length}`, ai: { wander: [a0, ...turns.map((d) => a0 + d)].map(stop), speed: 0.8, pause: 7, cheer: 0.45 } });
      c.group.position.set(x, y, z);
      c.group.rotation.y = a0;
      regulars.push(n);
    };
    place('gromflomite', DECKS[0], Math.PI + 0.5, [0.24, -0.2, 0.46, 0.1]);
    place('gazorpian', FLOOR, 2.25, [-0.26, 0.2, -0.08]);
    place('gromflomite', DECKS[1], Math.PI - 0.8, [-0.22, 0.3, 0.12, -0.4]);
  }

  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  return {
    group,
    noInk: [dome, bulbMesh, screenMesh, marqueeMesh, nameMesh, board, doors, posters, signMesh, ...glows],
    light: ARCADE_LIGHT,
    actions: {
      // the visitor's best age as Roy (a number; anything else shows "—")
      setBoard(best) {
        drawBoard(boardG, boardCanvas.width, boardCanvas.height, best);
        boardTex.needsUpdate = true;
      },
    },
    update(t, dt, state) {
      domeMat.uniforms.t.value = t;
      bulbMat.uniforms.t.value = t;
      screenMat.uniforms.t.value = t;
      planet.rotation.y = t * 0.1;
      for (let i = 0; i < ORBITS.length; i++) {
        const o = ORBITS[i];
        const a = o.phase + t * o.speed;
        v.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r).applyQuaternion(o.q).add(planet.position);
        spheres.setMatrixAt(i, tmp.compose(v, q, s.setScalar(o.size)));
      }
      spheres.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < regulars.length; i++) hall.step(regulars[i], t, dt, state);
    },
    dispose() {
      for (const o of owned) o.dispose?.();
    },
  };
}

// a copy of a vertex-coloured geometry, its white parts in `color`
function tinted(geo, color) {
  const g = geo.clone();
  const c = new THREE.Color(color);
  const a = g.attributes.color;
  for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getX(i) * c.r, a.getY(i) * c.g, a.getZ(i) * c.b);
  return g;
}

// A game's poster: a sky of its colour, a big shape for the game (a man in a
// headset for Roy, a ball, a plumbus, a blob) and its name across the foot.
function drawPoster(g, x, y, w, h, name, i) {
  const skies = [
    ['#1d6b5a', '#0a2a24'],
    ['#2a2a8a', '#0b0b30'],
    ['#8a2a6a', '#2a0b22'],
    ['#6a4a1a', '#241806'],
  ];
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, skies[i][0]);
  gr.addColorStop(1, skies[i][1]);
  g.fillStyle = gr;
  g.fillRect(x + 6, y + 6, w - 12, h - 12);
  g.strokeStyle = '#ffd34a';
  g.lineWidth = 6;
  g.strokeRect(x + 9, y + 9, w - 18, h - 18);
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  g.fillStyle = ['#9dff5a', '#ff8a2a', '#ff9ad0', '#c46aff'][i];
  g.beginPath();
  if (i === 0) {
    // a man's head and shoulders, the headset over his eyes
    g.arc(cx, cy - h * 0.06, w * 0.17, 0, Math.PI * 2);
    g.fill();
    g.fillRect(cx - w * 0.3, cy + h * 0.08, w * 0.6, h * 0.2);
    g.fillStyle = '#f2f2f6';
    g.fillRect(cx - w * 0.2, cy - h * 0.09, w * 0.4, h * 0.05);
  } else if (i === 1) {
    g.arc(cx, cy, w * 0.26, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#12061f';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, w * 0.26, -0.6, 0.6);
    g.arc(cx, cy, w * 0.26, Math.PI - 0.6, Math.PI + 0.6);
    g.stroke();
  } else if (i === 2) {
    g.ellipse(cx, cy, w * 0.16, h * 0.16, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy - h * 0.17, w * 0.07, h * 0.06, 0, 0, Math.PI * 2);
    g.fill();
  } else {
    for (let k = 0; k < 5; k++) g.arc(cx + Math.cos(k * 1.3) * w * 0.12, cy + Math.sin(k * 1.7) * h * 0.06, w * (0.1 + (k % 3) * 0.04), 0, Math.PI * 2);
    g.fill();
  }
  logoText(g, name, cx, y + h * 0.82, w * 0.15, { maxW: w * 0.86 });
}

// the walkway's carpet: squiggles, ringed planets, stars and triangles in
// neon on deep indigo
function drawCarpet(g, w, h) {
  const q = rng(5);
  g.fillStyle = '#1b1040';
  g.fillRect(0, 0, w, h);
  const cols = ['#c42fa3', '#22b8aa', '#c9a316', '#7f45c4', '#c46a20'];
  g.lineWidth = 6;
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const c = cols[Math.floor(q() * cols.length)];
    const kind = Math.floor(q() * 4);
    g.strokeStyle = c;
    g.fillStyle = c;
    g.save();
    g.translate(q() * w, q() * h);
    g.rotate(q() * TAU);
    g.beginPath();
    if (kind === 0) {
      for (let s = 0; s <= 20; s++) g.lineTo(s * 4 - 40, Math.sin(s * 0.9) * 9);
      g.stroke();
    } else if (kind === 1) {
      g.arc(0, 0, 14, 0, TAU);
      g.fill();
      g.beginPath();
      g.ellipse(0, 0, 26, 7, 0.3, 0, TAU);
      g.stroke();
    } else if (kind === 2) {
      for (let s = 0; s < 10; s++) g.lineTo(Math.cos((s / 10) * TAU) * (s % 2 ? 6 : 15), Math.sin((s / 10) * TAU) * (s % 2 ? 6 : 15));
      g.fill();
    } else {
      g.moveTo(-12, 10);
      g.lineTo(0, -12);
      g.lineTo(12, 10);
      g.closePath();
      g.stroke();
    }
    g.restore();
  }
}

// Roy's chair in shapes, if its model won't load: the padded orange recliner
// on a blue base, the purple hood over its head end with the headset hanging
// on its cable, and the screen at its foot. Returns where the screen goes.
function royStandIn(b, C, VC, neon, glow, f) {
  const { x, z } = f;
  const back = z - f.d / 2;
  const add = (geo, color, px, py, pz, sx, sy, sz, rx = 0) => b.add(C(geo, color), VC, at(px, py, pz, 0, sx, sy, sz, rx));
  add(BOX, 0x2f6aa8, x, 0.25, z, 1.3, 0.5, 1.1); // base
  add(BOX, 0x2c8c4a, x, 0.03, z, 1.9, 0.06, 1.2); // plinth
  add(BOX, 0xf06a2a, x, 0.62, z + 0.1, 1.1, 0.22, 0.9); // seat
  add(BOX, 0xf06a2a, x, 1.0, back + 0.35, 1.1, 0.75, 0.22, -0.5); // back
  for (const s of [-1, 1]) add(BOX, 0xf06a2a, x + s * 0.72, 0.62, z, 0.3, 0.14, 0.8); // arms
  b.add(C(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2), 0x8a3fa0), VC, at(x, 1.35, back + 0.45, 0, 0.95, 0.75, 0.75, -0.25)); // the hood
  add(BOX, 0xe9e9ef, x, 1.32, back + 0.62, 0.36, 0.16, 0.2); // the headset
  add(CYL, 0x777b88, x + 0.1, 1.6, back + 0.6, 0.04, 0.4, 0.04);
  add(BOX, 0x6a2a8a, x, 0.82, z + 0.48, 0.75, 0.55, 0.25, 0.2); // the screen's box
  neon.add(C(BOX, NEON.lime), glow, at(x, 0.05, z + f.d / 2 + 0.02, 0, 1.9, 0.04, 0.04));
  return at(x, 0.84, z + 0.61, 0, 0.6, 0.38, 1, 0.2);
}
