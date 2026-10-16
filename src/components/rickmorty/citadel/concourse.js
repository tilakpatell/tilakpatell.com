// The Citadel's concourse, drawn as the show draws the city: a round
// terrace of pale paving with cyan light set in it, a balustrade at its
// edge over the drop to the lower city, and round it Simple Rick's, the
// Council of Ricks' hall, Hangar 7 and the portal terminal; in the middle
// the core, a great column of dark green portal fluid under a saucer cap
// with the holo-ads round its rim; the Morty Day Care pen,
// Candidate Morty's booth, kiosks, planters and benches; and past the edge
// the city itself (./city.js): towers, the monorail and the great dome's
// lattice in a golden sky. Built in code in the show's toon look; every size
// comes from ./layout.js, so what you see is what you bump into.

import * as THREE from 'three';
import { SWIRL_GLSL } from '../swirl';
import { toon, toonify } from '../portal/toon';
import { bake } from '../../middleearth/towns/bake';
import { makeCanvas } from '../../../lib/paint';
import { hot } from '../stage';
import { ARCH, BALLPIT, BENCHES, BOOTH, BOOTH_BACK, CORE, DESKS, DOORS, KIOSKS, PEN, PLANTERS, PLANTER_R, SLIDE } from './layout';
import { buildCity } from './city';
import { fluidMaterial } from './fluid';
import { curveHologram } from './curve';

const R = 40.9; // the balustrade at the terrace's edge

// the Citadel's colours, the show's: mint and sage, teal, cyan light
const C = {
  panel: 0xe4f1e6,
  panel2: 0xb9d4c4,
  trim: 0x2f8f86,
  dark: 0x1f3f3a,
  floor: 0xb9cdb4,
  glow: 0x6ff3ff,
  red: 0xff3b4a,
  glass: 0x7fe0d4,
  gold: 0xc9a95a,
  pen: [0xe8483c, 0xf3c33b, 0x3e8ee0, 0x5cc06a],
};
// the buildings at the terrace's edge: the ring angle each stands at, how
// far round either side it reaches, and how tall (the camera keeps out)
export const EDGE_BUILDINGS = [
  { id: 'factory', a: 0, half: 0.17, top: 10.5 },
  { id: 'council', a: -Math.PI / 2, half: 0.25, top: 15 },
  { id: 'hangar', a: Math.PI / 4, half: 0.14, top: 6.4 },
  { id: 'portal', a: Math.PI / 2, half: 0.12, top: 7 },
  { id: 'mortytown', a: (Math.PI * 3) / 4, half: 0.12, top: 7.4 },
];

// the angle round the ring of a point, and a ring point's inward turn
const turnIn = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));
const angleOf = (x, z) => Math.atan2(z, x);

// ── canvases ──

// the floor: rings of deck plates cut radially, seams, rivets, and two
// lit rings (the colour; the glow is a canvas of its own)
function paintDeck(size) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const m = size / 2;
  const k = size / (R * 2 + 4); // pixels a metre
  g.fillStyle = '#b3c8b0';
  g.fillRect(0, 0, size, size);
  // plates, ring by ring
  for (let ring = 0; ring * 2.6 < R + 2; ring++) {
    const r0 = ring * 2.6 * k;
    const r1 = (ring + 1) * 2.6 * k;
    const n = 8 + ring * 5;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const shade = (ring + i) % 2 ? 0 : 10;
      const tint = (i * 37 + ring * 11) % 7;
      g.fillStyle = `rgb(${170 + shade + tint}, ${194 + shade + tint}, ${172 + shade + tint})`;
      g.beginPath();
      g.arc(m, m, r1, a0, a1);
      g.arc(m, m, r0, a1, a0, true);
      g.closePath();
      g.fill();
      // a rivet at each plate's corner
      g.fillStyle = 'rgba(40, 70, 60, 0.45)';
      g.beginPath();
      g.arc(m + Math.cos(a0 + 0.02) * (r0 + 3), m + Math.sin(a0 + 0.02) * (r0 + 3), Math.max(1, k * 0.06), 0, Math.PI * 2);
      g.fill();
    }
  }
  // seams
  g.strokeStyle = 'rgba(46, 84, 72, 0.6)';
  g.lineWidth = Math.max(1, k * 0.05);
  for (let ring = 0; ring * 2.6 < R + 2; ring++) {
    g.beginPath();
    g.arc(m, m, ring * 2.6 * k, 0, Math.PI * 2);
    g.stroke();
    const n = 8 + ring * 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.moveTo(m + Math.cos(a) * ring * 2.6 * k, m + Math.sin(a) * ring * 2.6 * k);
      g.lineTo(m + Math.cos(a) * (ring + 1) * 2.6 * k, m + Math.sin(a) * (ring + 1) * 2.6 * k);
      g.stroke();
    }
  }
  // the inlaid light rings (drawn pale here; they glow from the glow map)
  for (const r of [7.2, 15.5, 33]) {
    g.strokeStyle = '#e4fffb';
    g.lineWidth = k * 0.22;
    g.beginPath();
    g.arc(m, m, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  // a walkway band from the portal up to the core, and the core's apron
  g.fillStyle = 'rgba(255, 255, 255, 0.10)';
  g.fillRect(m - 2.2 * k, m + 6 * k, 4.4 * k, 30 * k);
  return c;
}
function paintDeckGlow(size) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const m = size / 2;
  const k = size / (R * 2 + 4);
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  for (const r of [7.2, 15.5, 33]) {
    g.strokeStyle = '#fff';
    g.lineWidth = k * 0.16;
    g.beginPath();
    g.arc(m, m, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

// The shop signs and windows, all on one sheet (so the shopfronts bake
// into one draw): a grid of cells, each a sign or a window.
const SIGNS = [
  // special bays
  ['SIMPLE RICK’S', '#f6e7c8', '#7a4a1e', 'wafer'],
  ['COUNCIL OF RICKS', '#e6ecf5', '#1f2b44', 'council'],
  ['HANGAR 7', '#ffd23a', '#20242c', 'stripes'],
  ['PORTAL TERMINAL', '#c8ffd0', '#14402a', 'portal'],
  // the rest
  ['PORTAL FLUID', '#c8ffd0', '#14402a'],
  ['BLIPS AND CHITZ', '#ffe0f4', '#5a1650'],
  ['PLUMBUS', '#ffd6e0', '#7a2a44'],
  ['FLASK & BEAKER', '#e8f4ff', '#1d3a5c'],
  ['MORTY ACCESSORIES', '#fff3c4', '#5c4410'],
  ['INTERDIMENSIONAL CABLE', '#e4dcff', '#2e1f66'],
  ['SZECHUAN SAUCE', '#ffe4c8', '#6a2c10'],
  ['LAB COATS', '#f2f6fa', '#2a3a4c'],
  ['MEGA SEEDS', '#e4ffd8', '#2a5a1c'],
  ['MORTYTOWN ↓', '#ffd9f0', '#4a1640'],
  ['ANATOMY PARK', '#d8fff4', '#145248'],
  ['SCHMECKLES EXCHANGE', '#fff8d8', '#4c4414'],
];
const SHEET = { cols: 4, rows: 6, w: 2048, h: 1536 };
function paintSigns() {
  const c = makeCanvas(SHEET.w, SHEET.h);
  const g = c.getContext('2d');
  const cw = SHEET.w / SHEET.cols;
  const ch = SHEET.h / SHEET.rows;
  // signs fill the first four rows
  SIGNS.forEach(([text, bg, ink, mark], i) => {
    const x = (i % SHEET.cols) * cw;
    const y = Math.floor(i / SHEET.cols) * ch;
    g.fillStyle = bg;
    g.fillRect(x, y, cw, ch);
    g.strokeStyle = ink;
    g.lineWidth = 10;
    g.strokeRect(x + 8, y + 8, cw - 16, ch - 16);
    if (mark === 'stripes') {
      g.save();
      g.beginPath();
      g.rect(x + 14, y + 14, cw - 28, ch - 28);
      g.clip();
      g.fillStyle = '#20242c';
      for (let s = -ch; s < cw; s += 60) {
        g.beginPath();
        g.moveTo(x + s, y + ch);
        g.lineTo(x + s + 30, y + ch);
        g.lineTo(x + s + 30 + ch, y);
        g.lineTo(x + s + ch, y);
        g.fill();
      }
      g.restore();
      g.fillStyle = '#ffd23a';
      g.fillRect(x + cw * 0.18, y + ch * 0.22, cw * 0.64, ch * 0.56);
    }
    g.fillStyle = ink;
    let size = 64;
    g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    while (g.measureText(text).width > cw - (mark && mark !== 'stripes' ? 170 : 60) && size > 24) {
      size -= 2;
      g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tx = x + cw / 2 + (mark && mark !== 'stripes' ? 50 : 0);
    g.fillText(text, tx, y + ch / 2 + 4);
    // a mark at the left: a wafer, the Council's eye, a portal
    const mx = x + 80;
    const my = y + ch / 2;
    if (mark === 'wafer') {
      g.fillStyle = '#d9a35b';
      g.fillRect(mx - 46, my - 34, 92, 68);
      g.strokeStyle = '#8a5a22';
      g.lineWidth = 4;
      for (let k = -34; k <= 34; k += 17) {
        g.beginPath();
        g.moveTo(mx - 46, my + k);
        g.lineTo(mx + 46, my + k);
        g.stroke();
      }
      g.fillStyle = '#fff6e0';
      g.fillRect(mx - 46, my - 6, 92, 12);
    } else if (mark === 'council') {
      g.fillStyle = '#1f2b44';
      g.beginPath();
      g.ellipse(mx, my, 50, 30, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9fe8ff';
      g.beginPath();
      g.arc(mx, my, 16, 0, Math.PI * 2);
      g.fill();
    } else if (mark === 'portal') {
      const gr = g.createRadialGradient(mx, my, 4, mx, my, 46);
      gr.addColorStop(0, '#eaffd0');
      gr.addColorStop(0.5, '#7ef05a');
      gr.addColorStop(1, '#1d8a2a');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(mx, my, 46, 0, Math.PI * 2);
      g.fill();
    }
  });
  // windows: a lit shop interior, cool or warm, with shelves and shapes
  for (let i = 16; i < SHEET.cols * SHEET.rows; i++) {
    const x = (i % SHEET.cols) * cw;
    const y = Math.floor(i / SHEET.cols) * ch;
    const warm = i % 2;
    const gr = g.createLinearGradient(x, y, x, y + ch);
    gr.addColorStop(0, warm ? '#ffe7b8' : '#cdeeff');
    gr.addColorStop(1, warm ? '#c98a4a' : '#5a7fa8');
    g.fillStyle = gr;
    g.fillRect(x, y, cw, ch);
    g.fillStyle = 'rgba(30, 36, 52, 0.55)';
    for (let s = 0; s < 3; s++) g.fillRect(x + 30, y + 40 + s * 70, cw - 60, 10);
    for (let k = 0; k < 9; k++) {
      g.fillStyle = ['#e8483c', '#f3c33b', '#3e8ee0', '#5cc06a', '#a98ad8'][(k + i) % 5];
      g.fillRect(x + 40 + ((k * 53) % (cw - 100)), y + 14 + Math.floor(k / 3) * 70, 26, 26);
    }
    // glass sheen
    g.fillStyle = 'rgba(255, 255, 255, 0.18)';
    g.beginPath();
    g.moveTo(x + cw * 0.15, y);
    g.lineTo(x + cw * 0.35, y);
    g.lineTo(x + cw * 0.1, y + ch);
    g.lineTo(x - cw * 0.1, y + ch);
    g.fill();
  }
  return c;
}
// a plane showing one cell of the sheet
function cellPlane(w, h, cell) {
  const geo = new THREE.PlaneGeometry(w, h);
  const u0 = (cell % SHEET.cols) / SHEET.cols;
  const v1 = 1 - Math.floor(cell / SHEET.cols) / SHEET.rows;
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) / SHEET.cols, v1 - (1 - uv.getY(i)) / SHEET.rows);
  return geo;
}

// The holo-ring round the core: three ads by day, Vote Morty on election
// day, and the alert on red.
const HOLO = { w: 2048, h: 256 };
function paintHolo(c, mood) {
  const g = c.getContext('2d');
  g.clearRect(0, 0, HOLO.w, HOLO.h);
  const panels =
    mood === 'red'
      ? [['ALERT', 'RICK C-137 IS WANTED'], ['BY ORDER OF', 'PRESIDENT MORTY'], ['ALERT', 'REPORT ANY RICK C-137']]
      : mood === 'election'
        ? [['VOTE MORTY', 'A CITADEL FOR ALL OF US'], ['ELECTION DAY', 'EVERY RICK. EVERY MORTY.'], ['VOTE MORTY', 'THE RICKS HAVE HAD THEIR TURN']]
        : [['SIMPLE RICK’S', 'THE IMPOSSIBLE FLAVOR OF YOUR OWN COMPLETION'], ['THE CITADEL', 'A CITY OF RICKS, AND THEIR MORTYS'], ['MORTY DAY CARE', 'DROP-OFFS TILL SIX']];
  const col = mood === 'red' ? '255, 70, 80' : mood === 'election' ? '255, 214, 90' : '120, 240, 255';
  const pw = HOLO.w / panels.length;
  panels.forEach(([big, small], i) => {
    const x = i * pw;
    g.fillStyle = 'rgba(8, 26, 30, 0.78)';
    g.fillRect(x + 12, 16, pw - 24, HOLO.h - 32);
    g.fillStyle = `rgba(${col}, 0.12)`;
    g.fillRect(x + 12, 16, pw - 24, HOLO.h - 32);
    g.strokeStyle = `rgba(${col}, 0.9)`;
    g.lineWidth = 5;
    g.strokeRect(x + 12, 16, pw - 24, HOLO.h - 32);
    g.fillStyle = `rgba(${col}, 1)`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '900 92px "Arial Black", Arial, sans-serif';
    g.fillText(big, x + pw / 2, 100);
    let s = 34;
    g.font = `700 ${s}px Arial, sans-serif`;
    while (g.measureText(small).width > pw - 70 && s > 16) g.font = `700 ${(s -= 2)}px Arial, sans-serif`;
    g.fillText(small, x + pw / 2, 178);
  });
  // scan lines
  g.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let y = 0; y < HOLO.h; y += 6) g.fillRect(0, y, HOLO.w, 2);
}

// the portal's swirl, the show's green, as the rest of the site has it
const portalMat = () =>
  new THREE.ShaderMaterial({
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { t: { value: 0 }, seed: { value: 3 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform float t, seed;
      varying vec2 vUv;
      ${SWIRL_GLSL}
      void main() {
        vec4 c = portal((vUv * 2.0 - 1.0) * 1.22, t, 1.0, seed);
        if (c.a < 0.004) discard;
        gl_FragColor = c;
      }`,
  });

// ── the build ──

export async function buildConcourse(renderer, { models, tier = 'high', cruiser = null }) {
  const group = new THREE.Group();
  group.name = 'concourse';
  const statics = new THREE.Group();
  group.add(statics);
  const hide = []; // what the ink line leaves alone: sky, glass, glows
  const moving = []; // what bake leaves alone
  const lights = []; // where the light pool may go: [x, y, z, colour]
  const aniso = Math.min(tier === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  const tex = (canvas, { srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  // materials, by role
  const M = {
    panel: toon(C.panel),
    panel2: toon(C.panel2),
    trim: toon(C.trim),
    dark: toon(C.dark),
    floorEdge: toon(0x5f8a78),
    gold: toon(C.gold),
    glow: new THREE.MeshBasicMaterial({ color: hot(C.glow, 2.2) }),
    glowSoft: new THREE.MeshBasicMaterial({ color: hot(C.glow, 1.2) }),
    rail: new THREE.MeshBasicMaterial({ color: C.glass, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
    signs: null,
  };
  const mesh = (geo, mat, parent = statics) => {
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, turn = 0, parent = statics) => {
    const m = mesh(new THREE.BoxGeometry(w, h, d), mat, parent);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    return m;
  };

  // the shop signs' sheet (the edge buildings' signs, the kiosks' screens)
  const signsInit = () => {
    if (M.signs) return;
    const signsTex = tex(paintSigns());
    M.signs = new THREE.MeshBasicMaterial({ map: signsTex });
    M.windows = new THREE.MeshBasicMaterial({ map: signsTex, color: 0xdddddd });
  };

  // ── the terrace ──
  const deckSize = tier === 'low' ? 1024 : 2048;
  const floorMat = toon(0xffffff, { map: tex(paintDeck(deckSize)), emissiveMap: tex(paintDeckGlow(1024)), emissive: hot(C.glow, 0.32) });
  const floor = mesh(new THREE.CircleGeometry(R + 0.6, 96), floorMat, group);
  floor.rotation.x = -Math.PI / 2;
  floor.name = 'floor';
  // its edge: a deep fascia down toward the lower city, lit along its lip
  const fascia = mesh(new THREE.CylinderGeometry(R + 0.6, R + 0.2, 3.2, 96, 1, true), M.panel2);
  fascia.position.y = -1.6;
  const lip = mesh(new THREE.TorusGeometry(R + 0.62, 0.08, 4, 120), M.glowSoft);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.1;
  // the balustrade: posts, a lit rail and teal glass, open where the buildings are
  signsInit();
  const open = (a) => EDGE_BUILDINGS.some((b) => Math.abs(Math.atan2(Math.sin(a - b.a), Math.cos(a - b.a))) < b.half);
  const POSTS = 150;
  for (let i = 0; i < POSTS; i++) {
    const a = (i / POSTS) * Math.PI * 2;
    if (open(a)) continue;
    const t = turnIn(a);
    box(0.16, 1.15, 0.16, M.trim, Math.cos(a) * R, 0.58, Math.sin(a) * R, t);
    const next = ((i + 1) / POSTS) * Math.PI * 2;
    if (open(next)) continue;
    const mid = (a + next) / 2;
    const len = 2 * R * Math.sin(Math.PI / POSTS);
    const glassPane = box(len, 0.9, 0.04, M.rail, Math.cos(mid) * R, 0.55, Math.sin(mid) * R, turnIn(mid));
    void glassPane;
    box(len + 0.02, 0.09, 0.14, M.glowSoft, Math.cos(mid) * R, 1.16, Math.sin(mid) * R, turnIn(mid));
  }
  // the city past it
  const city = buildCity(renderer, { tier, gaps: EDGE_BUILDINGS.map((b) => b.a) });
  group.add(city.group);
  hide.push(...city.hide);

  // ── the buildings at the edge ──
  // what the edge buildings stand on, past the terrace: a deck out to them
  const facadeAt = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
  // Simple Rick's: cream and wafer-brown, its sign over a lit doorway
  {
    const a = EDGE_BUILDINGS[0].a;
    const t = turnIn(a);
    const cream = toon(0xf1e3c2);
    const brown = toon(0x8a5a2a);
    box(14, 10.5, 5, cream, ...facadeAt(a, R + 3.1).flatMap((v, i) => (i === 0 ? [v, 5.25] : [v])), t);
    box(14.4, 0.6, 5.4, brown, ...facadeAt(a, R + 3.1).flatMap((v, i) => (i === 0 ? [v, 10.5] : [v])), t);
    // pilasters like wafer stacks
    for (const s of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const p = box(1.1, 0.75, 0.5, k % 2 ? cream : toon(0xd9a35b), 0, 0.4 + k * 0.78, 0, t);
        p.position.set(Math.cos(a) * (R + 0.55) + Math.cos(t) * s * 5.6, 0.4 + k * 0.78, Math.sin(a) * (R + 0.55) - Math.sin(t) * s * 5.6);
      }
    }
    const door = mesh(new THREE.PlaneGeometry(4.6, 4.4), new THREE.MeshBasicMaterial({ color: hot(0xffd9a0, 1.05) }));
    door.position.set(Math.cos(a) * (R + 0.58), 2.2, Math.sin(a) * (R + 0.58));
    door.rotation.y = t;
    const frame = box(5.4, 0.4, 0.6, brown, Math.cos(a) * (R + 0.6), 4.6, Math.sin(a) * (R + 0.6), t);
    void frame;
    const s = mesh(cellPlane(9, 2.25, 0), M.signs);
    s.position.set(Math.cos(a) * (R + 0.52), 7.2, Math.sin(a) * (R + 0.52));
    s.rotation.y = t;
    lights.push([Math.cos(a) * (R - 3), 3, Math.sin(a) * (R - 3), 0xffd9a0]);
  }
  // the Council of Ricks' hall: tall, dark teal and gold, columns before its doors
  {
    const a = EDGE_BUILDINGS[1].a;
    const t = turnIn(a);
    const teal = toon(0x1f4a44);
    box(20, 15, 5, teal, ...facadeAt(a, R + 3.1).flatMap((v, i) => (i === 0 ? [v, 7.5] : [v])), t);
    box(20.6, 0.8, 5.6, M.gold, ...facadeAt(a, R + 3.1).flatMap((v, i) => (i === 0 ? [v, 15] : [v])), t);
    box(20.4, 0.4, 5.4, M.gold, ...facadeAt(a, R + 3.1).flatMap((v, i) => (i === 0 ? [v, 9.4] : [v])), t);
    // the yellow light strips up its face, as the Council's rooms have
    for (const x of [-8.5, -6.5, 6.5, 8.5]) {
      const st = box(0.22, 7.6, 0.1, new THREE.MeshBasicMaterial({ color: hot(0xf3e04a, 1.6) }), 0, 4.6, 0, t);
      st.position.set(Math.cos(a) * (R + 0.55) + Math.cos(t) * x, 4.6, Math.sin(a) * (R + 0.55) - Math.sin(t) * x);
    }
    for (const x of [-4.8, -2.9, 2.9, 4.8]) {
      const col = mesh(new THREE.CylinderGeometry(0.42, 0.5, 9, 16), M.panel);
      col.position.set(Math.cos(a) * (R + 0.3) + Math.cos(t) * x, 4.5, Math.sin(a) * (R + 0.3) - Math.sin(t) * x);
    }
    box(5.6, 7, 0.3, M.dark, Math.cos(a) * (R + 0.6), 3.5, Math.sin(a) * (R + 0.6), t);
    box(0.08, 6.8, 0.32, M.glow, Math.cos(a) * (R + 0.58), 3.5, Math.sin(a) * (R + 0.58), t);
    const s = mesh(cellPlane(9, 1.8, 1), M.signs);
    s.position.set(Math.cos(a) * (R + 0.52), 11.6, Math.sin(a) * (R + 0.52));
    s.rotation.y = t;
    lights.push([Math.cos(a) * (R - 4), 4, Math.sin(a) * (R - 4), 0xf3e7b0]);
  }
  // the portal terminal: an arch and the swirl, a pad on the floor
  const swirl = { mat: portalMat() };
  {
    // a ring standing on a plinth, the swirl in it
    const PR = ARCH.w / 2 - 0.25;
    const arch = mesh(new THREE.TorusGeometry(PR, 0.3, 12, 48), M.panel);
    arch.position.set(ARCH.x, PR + 0.45, ARCH.z);
    box(ARCH.w, 0.5, ARCH.d, M.trim, ARCH.x, 0.25, ARCH.z);
    const ring = mesh(new THREE.TorusGeometry(PR, 0.07, 8, 48), M.glow);
    ring.position.set(ARCH.x, PR + 0.45, ARCH.z - 0.31);
    const disc = mesh(new THREE.CircleGeometry(PR - 0.12, 48), swirl.mat, group);
    disc.position.set(ARCH.x, PR + 0.45, ARCH.z - 0.02);
    hide.push(disc);
    const pad = mesh(new THREE.RingGeometry(2.1, 2.35, 48), M.glowSoft);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.03, 35);
    // the terminal behind it: a canopy on two posts, and its sign
    const a = angleOf(DOORS.portal.x, DOORS.portal.z);
    for (const sx of [-4.2, 4.2]) box(0.5, 6.4, 0.5, M.trim, sx, 3.2, R + 1.2);
    box(10, 0.5, 3, M.panel, 0, 6.6, R + 1.2);
    box(10.1, 0.1, 3.05, M.glow, 0, 6.32, R + 1.2);
    const s = mesh(cellPlane(8, 1.6, 3), M.signs);
    s.position.set(0, 7.7, R - 0.25);
    s.rotation.y = turnIn(a);
    lights.push([0, 3, 35, 0x9effa0]);
  }
  // the hangar: blast doors in a striped frame, a bay behind with the
  // cruiser on its pad, open at the far end to space
  const hangar = new THREE.Group();
  group.add(hangar);
  const ha = angleOf(DOORS.hangar.x, DOORS.hangar.z);
  const ht = turnIn(ha);
  hangar.position.set(Math.cos(ha) * R, 0, Math.sin(ha) * R);
  hangar.rotation.y = ht + Math.PI; // its own +z points out, away from the core
  const doors = [];
  {
    const w = DOORS.hangar.w;
    const frameMat = toon(0x3a4256);
    const stripes = M.signs;
    for (const s of [-1, 1]) {
      const post = mesh(new THREE.BoxGeometry(1, 6.2, 1.4), frameMat, hangar);
      post.position.set(s * (w / 2 + 0.5), 3.1, 0);
    }
    const lintel = mesh(new THREE.BoxGeometry(w + 2, 0.8, 1.4), frameMat, hangar);
    lintel.position.set(0, 6.2, 0);
    const sign = mesh(cellPlane(w + 1.6, 0.75, 2), stripes, hangar);
    sign.position.set(0, 6.2, -0.72);
    sign.rotation.y = Math.PI;
    for (const s of [-1, 1]) {
      const d = mesh(new THREE.BoxGeometry(w / 2, 5.8, 0.4), toon(0x8fb0a8), hangar);
      d.position.set((s * w) / 4, 2.9, 0.1);
      const band = mesh(new THREE.BoxGeometry(w / 2 - 0.2, 0.5, 0.42), toon(0xffc93a), d);
      band.position.set(0, -1.2, 0);
      const lamp = mesh(new THREE.BoxGeometry(0.3, 0.3, 0.44), M.glow, d);
      lamp.position.set(-s * (w / 4 - 0.4), 2.4, 0);
      d.userData.side = s;
      doors.push(d);
      moving.push(d);
    }
    // the bay
    const bay = new THREE.Group();
    hangar.add(bay);
    const bw = 12;
    const bd = 16;
    const floorB = mesh(new THREE.PlaneGeometry(bw, bd), toon(0x52706a), bay);
    floorB.rotation.x = -Math.PI / 2;
    floorB.position.set(0, 0.01, bd / 2);
    for (const s of [-1, 1]) {
      const wall = mesh(new THREE.BoxGeometry(0.4, 6, bd), toon(0x8fb0a8), bay);
      wall.position.set((s * bw) / 2, 3, bd / 2);
      const strip = mesh(new THREE.BoxGeometry(0.1, 0.2, bd), M.glow, bay);
      strip.position.set(s * (bw / 2 - 0.25), 4.8, bd / 2);
    }
    const roof = mesh(new THREE.BoxGeometry(bw, 0.4, bd), toon(0x5f8a78), bay);
    roof.position.set(0, 6.1, bd / 2);
    const padB = mesh(new THREE.RingGeometry(2.4, 3, 40), M.glowSoft, bay);
    padB.rotation.x = -Math.PI / 2;
    padB.position.set(0, 0.03, 6);
    // the far end, open to space through a shimmering field
    const field = mesh(new THREE.PlaneGeometry(bw, 6), new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }), bay);
    field.position.set(0, 3, bd);
    hide.push(field);
    lights.push([hangar.position.x + Math.cos(ha) * 6, 5, hangar.position.z + Math.sin(ha) * 6, 0xffd9a0]);
  }
  const cruiserAt = new THREE.Group();
  hangar.add(cruiserAt);
  cruiserAt.position.set(0, 0, 6);
  cruiserAt.rotation.y = Math.PI; // nose to the doors
  const setCruiser = (c) => {
    cruiserAt.clear();
    if (c) cruiserAt.add(c);
  };
  if (cruiser) setCruiser(cruiser);

  // the lift down to Mortytown (./mortytown.js): a striped frame in the
  // shopfronts across from the hangar, its doors shut, its sign over them,
  // and the shaft dropping away under the terrace's edge
  {
    const a = angleOf(DOORS.mortytown.x, DOORS.mortytown.z);
    const lift = new THREE.Group();
    statics.add(lift);
    lift.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    lift.rotation.y = turnIn(a) + Math.PI; // its own +z points out, away from the core
    const w = DOORS.mortytown.w;
    const frameMat = toon(0x4a3a52);
    for (const e of [-1, 1]) {
      const post = mesh(new THREE.BoxGeometry(0.9, 6.6, 1.4), frameMat, lift);
      post.position.set(e * (w / 2 + 0.45), 3.3, 0);
      const strip = mesh(new THREE.BoxGeometry(0.12, 5.6, 0.1), M.glow, lift);
      strip.position.set(e * (w / 2 - 0.05), 3, -0.72);
    }
    const lintel = mesh(new THREE.BoxGeometry(w + 1.8, 1.4, 1.4), frameMat, lift);
    lintel.position.set(0, 6.6, 0);
    const sign = mesh(cellPlane(w + 1, 1.1, 13), M.signs, lift);
    sign.position.set(0, 6.6, -0.72);
    sign.rotation.y = Math.PI;
    // the doors, shut: a strip of pink light down the seam between them
    for (const e of [-1, 1]) {
      const door = mesh(new THREE.BoxGeometry(w / 2, 5.6, 0.3), toon(0x8a7a96), lift);
      door.position.set((e * w) / 4, 2.8, 0.2);
    }
    const seam = mesh(new THREE.BoxGeometry(0.1, 5.4, 0.34), new THREE.MeshBasicMaterial({ color: hot(0xff5ad2, 1.8) }), lift);
    seam.position.set(0, 2.8, 0.2);
    // the call panel by the doors, lit
    const panel = mesh(new THREE.BoxGeometry(0.4, 0.7, 0.12), M.glow, lift);
    panel.position.set(w / 2 + 0.45, 1.5, -0.76);
    // the shaft, on down past the terrace's fascia
    const shaft = mesh(new THREE.BoxGeometry(w + 1.4, 40, 4), toon(0x3a3046), lift);
    shaft.position.set(0, -20, 2.4);
    lights.push([Math.cos(a) * (R - 3), 3, Math.sin(a) * (R - 3), 0xffb0ec]);
  }

  // ── the core: the Citadel's portal fluid, a great column of it, dark
  // green and churning, in a teal frame behind a railing, under a saucer
  // of a cap; a thin stem of it goes on up to the top of the dome ──
  const fluid = fluidMaterial({ dark: 0.8, scale: [9, 11] });
  const stemFluid = fluidMaterial({ dark: 0.7, scale: [3, 26] });
  const CAP_Y = 22;
  {
    const frame = toon(0x1f4a44);
    const plinth = mesh(new THREE.CylinderGeometry(CORE.r - 0.05, CORE.r + 0.05, 1.2, 64), frame);
    plinth.position.y = 0.6;
    const lip = mesh(new THREE.TorusGeometry(CORE.r - 0.05, 0.08, 6, 96), M.glow);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 1.2;
    // the railing round it
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const post = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.05, 6), M.trim);
      post.position.set(Math.cos(a) * (CORE.r - 0.25), 1.72, Math.sin(a) * (CORE.r - 0.25));
    }
    const rail = mesh(new THREE.TorusGeometry(CORE.r - 0.25, 0.06, 6, 96), M.glowSoft);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = 2.25;
    // the fluid itself
    const col = mesh(new THREE.CylinderGeometry(3.6, 3.6, CAP_Y - 1.2, 64, 1, true), fluid, group);
    col.position.y = 1.2 + (CAP_Y - 1.2) / 2;
    // its frame: ribs up it and rings round it
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      box(0.45, CAP_Y - 1.2, 0.5, frame, Math.cos(a) * 3.72, 1.2 + (CAP_Y - 1.2) / 2, Math.sin(a) * 3.72, turnIn(a));
    }
    for (const y of [1.6, 7, 12.5, 18]) {
      const ring = mesh(new THREE.TorusGeometry(3.78, 0.2, 8, 72), frame);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      const glowRing = mesh(new THREE.TorusGeometry(3.72, 0.06, 6, 72), M.glow);
      glowRing.rotation.x = Math.PI / 2;
      glowRing.position.y = y - 0.24;
    }
    // the cap, a saucer over it with lights round its rim
    const capProfile = [
      [0.5, -1.4],
      [3.9, -1.1],
      [8.8, -0.15],
      [9.3, 0.3],
      [8.7, 0.95],
      [4.2, 1.5],
      [1.6, 2.6],
      [1.5, 3.4],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const cap = mesh(new THREE.LatheGeometry(capProfile, 64), toon(0x2f5f57));
    cap.position.y = CAP_Y;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      box(0.55, 0.16, 0.12, i % 4 ? M.glow : new THREE.MeshBasicMaterial({ color: hot(0xf3e04a, 1.8) }), Math.cos(a) * 9.02, CAP_Y - 0.25, Math.sin(a) * 9.02, turnIn(a));
    }
    // the stem, on up into the dome
    const stem = mesh(new THREE.CylinderGeometry(1.3, 1.3, 70, 24, 1, true), stemFluid, group);
    stem.position.y = CAP_Y + 3.4 + 35;
    for (let y = CAP_Y + 8; y < CAP_Y + 70; y += 9) {
      const sleeve = mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.8, 24), frame);
      sleeve.position.y = y;
    }
    // its green light on the terrace round it
    lights.push([0, 3.5, 7, 0x7dff6a], [-7, 3.5, 0, 0x7dff6a], [6, 3.5, -4, 0x7dff6a]);
  }
  const holoCanvas = makeCanvas(HOLO.w, HOLO.h);
  paintHolo(holoCanvas, 'day');
  const holoTex = tex(holoCanvas);
  holoTex.wrapS = THREE.RepeatWrapping;
  // the holo-ads: a ticker round the cap's rim
  holoTex.repeat.set(4, 1);
  const holo = mesh(new THREE.CylinderGeometry(9.45, 9.45, 1.5, 128, 1, true), new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, depthWrite: false, toneMapped: false }), group);
  holo.position.y = CAP_Y + 0.55;
  hide.push(holo);
  // and the Central Finite Curve, a hologram turning round the core over
  // everyone's heads
  const curve = curveHologram({ radius: 7.4, height: 2.4 });
  curve.group.position.y = 4.3;
  group.add(curve.group);
  hide.push(curve.group);

  // ── Morty Day Care ──
  const gate = [];
  {
    const x0 = PEN.x - PEN.w / 2;
    const x1 = PEN.x + PEN.w / 2;
    const z0 = PEN.z - PEN.d / 2;
    const z1 = PEN.z + PEN.d / 2;
    const mats = C.pen.map((c) => toon(c));
    const post = new THREE.CylinderGeometry(0.08, 0.08, 1.15, 8);
    const sides = [
      [x0, z0, x1, z0],
      [x0, z1, x1, z1],
      [x0, z0, x0, z1],
      [x1, z0, x1, PEN.gate.z0],
      [x1, PEN.gate.z1, x1, z1],
    ];
    let k = 0;
    for (const [ax, az, bx, bz] of sides) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i <= n; i++) {
        const p = mesh(post, M.panel);
        p.position.set(ax + ((bx - ax) * i) / n, 0.58, az + ((bz - az) * i) / n);
      }
      for (let i = 0; i < n; i++) {
        const cx = ax + ((bx - ax) * (i + 0.5)) / n;
        const cz = az + ((bz - az) * (i + 0.5)) / n;
        const panel = box(len / n - 0.18, 0.7, 0.08, mats[k++ % mats.length], cx, 0.55, cz, Math.atan2(-(bz - az), bx - ax));
        void panel;
      }
    }
    // the gate's two leaves, hinged at the posts
    for (const s of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(x1, 0, s < 0 ? PEN.gate.z0 : PEN.gate.z1);
      group.add(hinge);
      const leaf = mesh(new THREE.BoxGeometry(0.08, 0.8, 1.9), mats[2], hinge);
      leaf.position.set(0, 0.55, -s * 0.95);
      hinge.userData.side = s;
      gate.push(hinge);
    }
    // the arch over the gate, with its sign
    for (const s of [-1, 1]) box(0.3, 3.4, 0.3, M.panel, x1 + 0.2, 1.7, s * 2.6);
    box(0.3, 0.3, 5.5, M.trim, x1 + 0.2, 3.4, 0);
    const signCanvas = makeCanvas(1024, 256);
    {
      const g = signCanvas.getContext('2d');
      const colors = ['#e8483c', '#f3c33b', '#3e8ee0', '#5cc06a'];
      g.fillStyle = '#fff8e8';
      g.fillRect(0, 0, 1024, 256);
      g.lineWidth = 14;
      g.strokeStyle = '#3e8ee0';
      g.strokeRect(7, 7, 1010, 242);
      g.font = '900 104px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const text = 'MORTY DAY CARE';
      let x = 512 - g.measureText(text).width / 2;
      g.textAlign = 'left';
      [...text].forEach((ch, i) => {
        g.fillStyle = colors[i % 4];
        g.fillText(ch, x, 134);
        x += g.measureText(ch).width;
      });
    }
    const sign = mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: tex(signCanvas) }));
    sign.position.set(x1 + 0.4, 4.15, 0);
    sign.rotation.y = Math.PI / 2;
    // a soft floor inside
    const mat = mesh(new THREE.PlaneGeometry(PEN.w - 0.4, PEN.d - 0.4), toon(0x7fb6e8));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(PEN.x, 0.015, PEN.z);
    // the slide: a ladder tower, a platform, and the slide down
    const tower = box(SLIDE.w, 2.1, 1.2, toon(0xf3c33b), SLIDE.x, 1.05, SLIDE.z - SLIDE.d / 2 + 0.6);
    void tower;
    const chute = box(SLIDE.w * 0.8, 0.12, SLIDE.d - 0.6, toon(0xe8483c), SLIDE.x, 1.05, SLIDE.z + 0.45);
    chute.rotation.x = 0.55;
    for (const s of [-1, 1]) box(0.08, 0.35, SLIDE.d - 0.6, toon(0xe8483c), SLIDE.x + (s * SLIDE.w * 0.8) / 2, 1.22, SLIDE.z + 0.45).rotation.x = 0.55;
    // the ball pit
    const pit = mesh(new THREE.CylinderGeometry(BALLPIT.r, BALLPIT.r, 0.6, 32, 1, true), toon(0x3e8ee0, { side: THREE.DoubleSide }));
    pit.position.set(BALLPIT.x, 0.3, BALLPIT.z);
    const lip = mesh(new THREE.TorusGeometry(BALLPIT.r, 0.1, 8, 40), toon(0xf3c33b));
    lip.rotation.x = Math.PI / 2;
    lip.position.set(BALLPIT.x, 0.6, BALLPIT.z);
    const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), toon(0xffffff), 150);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < 150; i++) {
      const a = i * 2.39996;
      const r = Math.sqrt(i / 150) * (BALLPIT.r - 0.15);
      m4.makeTranslation(BALLPIT.x + Math.cos(a) * r, 0.42 + (i % 3) * 0.06, BALLPIT.z + Math.sin(a) * r);
      balls.setMatrixAt(i, m4);
      balls.setColorAt(i, col.set(C.pen[i % 4]));
    }
    group.add(balls);
    // the Day Care Rick's desk and chair
    box(DESKS.daycare.w, 0.1, DESKS.daycare.d, M.panel, DESKS.daycare.x, 0.95, DESKS.daycare.z);
    box(DESKS.daycare.w - 0.1, 0.9, DESKS.daycare.d - 0.3, M.panel2, DESKS.daycare.x, 0.45, DESKS.daycare.z);
    lights.push([PEN.x, 3.5, PEN.z, 0xfff1d0]);
  }
  // Kenney's chair for the Day Care Rick (and his magazine on the desk)
  const chair = await models?.load?.('station-chair');
  if (chair) {
    const c = models.single(chair, 1.15);
    toonify(c);
    c.position.set(DESKS.daycare.x, 0, DESKS.daycare.z - 1.35);
    c.rotation.y = Math.PI;
    group.add(c);
    moving.push(c);
  }

  // ── Candidate Morty's booth ──
  const booth = new THREE.Group();
  booth.position.set(BOOTH.x, 0, BOOTH.z);
  booth.rotation.y = BOOTH.turn;
  group.add(booth);
  const bannerCanvas = makeCanvas(1024, 512);
  const paintBanner = (mood) => {
    const g = bannerCanvas.getContext('2d');
    if (mood === 'day') {
      g.fillStyle = '#7d8798';
      g.fillRect(0, 0, 1024, 512);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let y = 0; y < 512; y += 32) g.fillRect(0, y, 1024, 6);
      g.fillStyle = '#e8edf4';
      g.font = '900 80px "Arial Black", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('ELECTION DAY', 512, 200);
      g.font = '700 52px Arial, sans-serif';
      g.fillText('COMING SOON', 512, 320);
      return;
    }
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, 1024, 512);
    g.fillStyle = '#1f3a8a';
    g.fillRect(0, 0, 1024, 120);
    g.fillStyle = '#c8262e';
    g.fillRect(0, 392, 1024, 120);
    // Morty's face, the campaign's
    g.fillStyle = '#f5d3a8';
    g.beginPath();
    g.arc(200, 256, 112, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#6b3d1c';
    g.beginPath();
    g.arc(200, 236, 118, Math.PI, 0);
    g.fill();
    g.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(200 + s * 40, 260, 30, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#111';
    g.beginPath();
    g.arc(160, 262, 6, 0, Math.PI * 2);
    g.fill();
    g.fillRect(212, 238, 56, 46); // the patch
    g.fillRect(150, 230, 120, 6);
    g.strokeStyle = '#111';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(170, 322);
    g.lineTo(230, 318);
    g.stroke();
    g.fillStyle = '#1f3a8a';
    g.font = '900 120px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('VOTE', 650, 200);
    g.fillStyle = '#c8262e';
    g.fillText('MORTY', 650, 320);
  };
  paintBanner('day');
  const bannerTex = tex(bannerCanvas);
  {
    const podium = mesh(new THREE.BoxGeometry(BOOTH.w, 1.15, BOOTH.d), M.panel, booth);
    podium.position.y = 0.575;
    const front = mesh(new THREE.BoxGeometry(BOOTH.w + 0.1, 0.18, BOOTH.d + 0.1), M.trim, booth);
    front.position.y = 1.2;
    // the backboard, with room for Candidate Morty between it and the podium
    const backboard = mesh(new THREE.BoxGeometry(BOOTH_BACK.w, 3.1, BOOTH_BACK.d), M.trim, booth);
    backboard.position.set(0, 1.55, -BOOTH_BACK.back);
    const banner = mesh(new THREE.PlaneGeometry(BOOTH.w + 0.3, (BOOTH.w + 0.3) / 2), new THREE.MeshBasicMaterial({ map: bannerTex }), booth);
    banner.position.set(0, 2.05, -BOOTH_BACK.back + BOOTH_BACK.d / 2 + 0.01);
    const ballot = mesh(new THREE.BoxGeometry(0.7, 0.6, 0.5), toon(0x1f3a8a), booth);
    ballot.position.set(0.9, 1.6, 0.1);
    const slot = mesh(new THREE.BoxGeometry(0.4, 0.02, 0.06), M.dark, booth);
    slot.position.set(0.9, 1.91, 0.1);
  }
  const posters = new THREE.Group();
  group.add(posters);
  for (const [x, z] of [
    [-25.5, -16.6],
    [-16.6, -25.5],
  ]) {
    const stand = new THREE.Group();
    stand.position.set(x, 0, z);
    stand.rotation.y = BOOTH.turn;
    posters.add(stand);
    const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), M.trim, stand);
    pole.position.y = 1.2;
    const p = mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }), stand);
    p.position.y = 2.1;
  }
  moving.push(booth, posters);

  // ── cover: kiosks, planters, benches; the customs desk ──
  for (const k of KIOSKS) {
    const body = mesh(new THREE.CylinderGeometry(k.w * 0.62, k.w * 0.68, 3.1, 6), M.panel);
    body.position.set(k.x, 1.55, k.z);
    body.rotation.y = k.turn;
    const cap = mesh(new THREE.CylinderGeometry(k.w * 0.72, k.w * 0.72, 0.25, 6), M.trim);
    cap.position.set(k.x, 3.2, k.z);
    cap.rotation.y = k.turn;
    const capGlow = mesh(new THREE.CylinderGeometry(k.w * 0.73, k.w * 0.73, 0.06, 6), M.glow);
    capGlow.position.set(k.x, 3.05, k.z);
    capGlow.rotation.y = k.turn;
    // a map screen on each of three faces
    for (let f = 0; f < 3; f++) {
      const a = k.turn + (f * Math.PI * 2) / 3 + Math.PI / 6;
      const scr = mesh(cellPlane(1.2, 0.9, 16 + f), M.windows);
      // (the face's distance in, at the screen's height)
      const r = k.w * (0.68 - (0.06 * 1.8) / 3.1) * Math.cos(Math.PI / 6) + 0.03;
      scr.position.set(k.x + Math.sin(a) * r, 1.8, k.z + Math.cos(a) * r);
      scr.rotation.y = a;
    }
  }
  const leafA = toon(0x3fae8a);
  const leafB = toon(0x7a5ad0);
  for (const [x, z] of PLANTERS) {
    const pot = mesh(
      new THREE.LatheGeometry(
        [
          [0.9, 0],
          [PLANTER_R, 0.15],
          [PLANTER_R, 0.85],
          [PLANTER_R - 0.12, 0.95],
          [0.2, 0.95],
        ].map(([a, b]) => new THREE.Vector2(a, b)),
        32,
      ),
      M.panel,
    );
    pot.position.set(x, 0, z);
    const band = mesh(new THREE.TorusGeometry(PLANTER_R + 0.01, 0.05, 6, 40), M.glowSoft);
    band.rotation.x = Math.PI / 2;
    band.position.set(x, 0.62, z);
    // an alien shrub: a trunk and puffs of leaves, tall enough to hide behind
    const trunk = mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 8), toon(0x6a4a3a));
    trunk.position.set(x, 1.6, z);
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + x;
      const puff = mesh(new THREE.IcosahedronGeometry(0.75 - i * 0.06, 1), i % 2 ? leafB : leafA);
      puff.position.set(x + Math.cos(a) * 0.45, 1.7 + i * 0.28, z + Math.sin(a) * 0.45);
      puff.scale.set(1, 0.8, 1);
    }
  }
  for (const b of BENCHES) {
    box(b.w, 0.1, b.d, M.panel, b.x, 0.48, b.z, b.turn);
    for (const s of [-1, 1]) {
      const leg = box(0.12, 0.46, b.d - 0.1, M.trim, b.x, 0.23, b.z, b.turn);
      leg.position.x += Math.cos(b.turn) * s * (b.w / 2 - 0.25);
      leg.position.z -= Math.sin(b.turn) * s * (b.w / 2 - 0.25);
    }
  }
  {
    const d = DESKS.customs;
    box(d.w, 1.05, d.d, M.panel, d.x, 0.525, d.z, d.turn);
    box(d.w + 0.1, 0.12, d.d + 0.1, M.trim, d.x, 1.1, d.z, d.turn);
    box(d.w, 0.08, 0.06, M.glow, d.x, 0.9, d.z + d.d / 2 + 0.01, d.turn);
    for (const s of [-1, 1]) {
      const scr = mesh(cellPlane(0.9, 0.6, 17), M.windows);
      scr.position.set(d.x + s * 0.8, 1.45, d.z - 0.2);
      scr.rotation.y = Math.PI;
      scr.rotation.x = -0.2;
    }
    const signCanvas = makeCanvas(512, 128);
    const g = signCanvas.getContext('2d');
    g.fillStyle = '#1f2b44';
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#9fe8ff';
    g.font = '900 68px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('CUSTOMS', 256, 68);
    const s = mesh(new THREE.PlaneGeometry(2.2, 0.55), new THREE.MeshBasicMaterial({ map: tex(signCanvas) }));
    s.position.set(d.x, 0.62, d.z + d.d / 2 + 0.02);
  }

  // what never moves, merged (and the merged glass kept out of the ink)
  const baked = bake(statics, moving);
  statics.add(baked);
  baked.traverse((o) => {
    if (o.material === M.rail || o.material === M.glass) hide.push(o);
  });

  // ── moods, and what moves ──
  const glowCols = { day: hot(C.glow, 2.2), election: hot(C.glow, 2.2), red: hot(C.red, 2.4) };
  const softCols = { day: hot(C.glow, 1.2), election: hot(C.glow, 1.2), red: hot(C.red, 1.3) };
  let mood = 'day';
  const setMood = (m) => {
    if (m === mood) return;
    mood = m;
    M.glow.color.copy(glowCols[m] ?? glowCols.day);
    M.glowSoft.color.copy(softCols[m] ?? softCols.day);
    floorMat.emissive.copy(m === 'red' ? hot(C.red, 0.5) : hot(C.glow, 0.32));
    city.setMood(m);
    curve.setMood(m);
    paintHolo(holoCanvas, m);
    holoTex.needsUpdate = true;
    paintBanner(m === 'day' ? 'day' : 'vote');
    bannerTex.needsUpdate = true;
    posters.visible = m !== 'day';
  };
  posters.visible = false;

  let gateK = 0;
  let doorK = 0;
  const update = (t, dt, { gateOpen = false, hangarOpen = false, escapeT = null } = {}) => {
    holo.rotation.y = t * 0.06;
    curve.update(t);
    fluid.uniforms.uTime.value = t;
    stemFluid.uniforms.uTime.value = t;
    fluid.uniforms.uAgitate.value = mood === 'red' ? 1 : 0;
    swirl.mat.uniforms.t.value = t;
    gateK += ((gateOpen ? 1 : 0) - gateK) * Math.min(1, dt * 3);
    for (const h of gate) h.rotation.y = -h.userData.side * gateK * 1.6; // out, to the east
    doorK += ((hangarOpen ? 1 : 0) - doorK) * Math.min(1, dt * 1.6);
    for (const d of doors) d.position.x = d.userData.side * (DOORS.hangar.w / 4 + doorK * (DOORS.hangar.w / 2 - 0.2));
    city.update(t);
    // the cruiser: up off its pad, round, and out through the far field
    if (escapeT != null) {
      const k = Math.max(0, escapeT - 1.2);
      cruiserAt.position.set(0, Math.min(2.2, k * 1.6) + Math.sin(t * 3) * 0.05, 6 + Math.max(0, k - 1.2) ** 2 * 7);
      cruiserAt.rotation.y = Math.PI + Math.min(Math.PI, Math.max(0, k - 0.4) * 2.6);
      cruiserAt.rotation.z = Math.sin(Math.min(1, k) * Math.PI) * 0.12;
    } else {
      cruiserAt.position.set(0, Math.sin(t * 1.4) * 0.04, 6);
      cruiserAt.rotation.set(0, Math.PI, 0);
    }
  };
  // the escape's camera: in the hangar's doorway, watching the cruiser go
  // (the same camera each time, to use at once)
  const escapeView = { at: new THREE.Vector3(), look: new THREE.Vector3() };
  const escapeCam = () => {
    hangar.localToWorld(escapeView.at.set(0, 3.2, -3.5));
    hangar.localToWorld(escapeView.look.set(0, 1.6, 0).add(cruiserAt.position));
    return escapeView;
  };

  const dispose = () => {
    group.traverse((o) => {
      if (o.userData?.shared) return;
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
        m.dispose?.();
      }
    });
    city.dispose();
    curve.dispose();
  };

  return { group, floor, hide, lights, setMood, update, escapeCam, setCruiser, swirl, dispose };
}
