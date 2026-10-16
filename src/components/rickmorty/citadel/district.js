// Mortytown, drawn as the show draws it in "The Ricklantis Mixup": a street
// of grimy slate-green and olive blocks under the Citadel's amber sky, cyan
// and green light strips on their faces, red lamps over doors, pipes and
// round air-con drums, boarded windows, neon over the shops, and the city's
// towers rising pale behind the rooftops. Morty Mart and The Creepy Morty
// are the Meshy models (scripts/meshy-rm-local.mjs, Phase 3), fitted to
// their blocks; everything else is built here in the show's toon look, every
// size from ./mortytown.js, so what you see is what you bump into.
//
// The district is drawn in its own frame, at ORIGIN far under the
// concourse, and only shown while Rick's down there (./scene.js).
//
// buildDistrict(renderer, { tier }) → Promise<{ group, floor, hide, lights,
//   update(t, dt), setMood(mood), dispose }>
//
// How fine it's made follows the graphics chip (lib/detail): the painted
// textures' size, the curves' segments, and how many towers, motes and puffs
// of steam there are.

import * as THREE from 'three';
import { toon } from '../portal/toon';
import { createMeshyCast } from '../portal/meshyCast';
import { bake } from '../../middleearth/towns/bake';
import { makeCanvas } from '../../../lib/paint';
import { hot } from '../stage';
import { detailLevel, seg, texScale } from '../../../lib/detail';
import { SKY_FRAG, paintWindowGlow, paintWindows, rng } from './city';
import { BINS, BLOCKS, CLUB_DOOR, CRUISER, FACTORY_BACK, FRONT, HIDES, LAMPS, LIFT, MART_DOOR, MORTYTOWN, ORIGIN, ROAD } from './mortytown';

const W = MORTYTOWN.x1 - MORTYTOWN.x0; // 120
const D = MORTYTOWN.z1 - MORTYTOWN.z0; // 60

// the street's colours, from the stills: slate green and olive, rust, grime
const C = {
  asphalt: '#3b4144',
  pavement: '#6f6c5f',
  kerb: '#8f8c7c',
  dark: 0x1e2426,
  trim: 0x2a3432,
  metal: 0x5d6b66,
  rust: 0x7a4a2e,
  cyan: 0x6ff3ff,
  green: 0x7dff6a,
  red: 0xff3b4a,
  pink: 0xff5ad2,
  amber: 0xffc874,
  warm: 0xffd9a0,
};
// each block's walls, its trim and its strips' light
const LOOKS = {
  bailbonds: { wall: '#58625a', strip: C.green, sign: ['BAIL BONDS', 'plate'], floors: 2, stairs: true },
  creepymorty: { wall: '#4a3f58', strip: C.pink },
  'tenement-n': { wall: '#4b5a4f', strip: C.cyan, sign: ['VOTE MORTY', 'posters'], floors: 3, boarded: 0.4, escape: true },
  newsstand: { wall: '#5c5a48', strip: C.green, sign: ['NEWS STAND', 'plate'], floors: 2, drum: true },
  pawn: { wall: '#50493e', strip: C.amber, sign: ['PAWN · GOLD · PORTAL GUNS', 'neon', '#ffd84a'], floors: 2, bars: true },
  'tenement-s': { wall: '#3f5650', strip: C.cyan, sign: ['NOODLE BAR', 'neon', '#ff5a4a'], floors: 3, boarded: 0.3, escape: true },
  laundry: { wall: '#566052', strip: C.cyan, sign: ['LAUNDROMAT', 'neon', '#7ff6ff'], floors: 2, washers: true },
  mortymart: { wall: '#4a564e', strip: C.red },
  corner: { wall: '#3c4c4a', strip: C.cyan, sign: ['XXX', 'bottle', '#6ff3ff'], floors: 3 },
};
// the backdrop's towers: the show's paler greens, hazed amber by the fog
const TOWERS = ['#7d9a84', '#8fa88a', '#6f8f86', '#9aa98a', '#7f9c94', '#8a9a7c'];

// ── painting ──

// a seeded random for each thing painted, so it's the same every visit
const rnd = (seed) => rng(seed);

// The floor: pavement slabs everywhere, the road down the middle with its
// faded centre line, cracks, patches and oil, kerbs, drains and manholes;
// and a second canvas of the neon's glow on it (the wet sheen under the
// signs), drawn as light.
function paintStreet(k) {
  const px = 17 * k; // pixels a metre
  const cw = Math.round(W * px);
  const ch = Math.round(D * px);
  const c = makeCanvas(cw, ch);
  const g = c.getContext('2d');
  const r = rnd(11);
  const X = (x) => (x - MORTYTOWN.x0) * px;
  const Z = (z) => (z - MORTYTOWN.z0) * px;
  // pavement slabs
  g.fillStyle = C.pavement;
  g.fillRect(0, 0, cw, ch);
  for (let x = MORTYTOWN.x0; x < MORTYTOWN.x1; x += 1.5) {
    for (let z = MORTYTOWN.z0; z < MORTYTOWN.z1; z += 1.5) {
      const v = Math.floor(r() * 22) - 11;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0}, ${v > 0 ? 250 : 0}, ${v > 0 ? 230 : 0}, ${Math.abs(v) / 260})`;
      g.fillRect(X(x) + 1, Z(z) + 1, 1.5 * px - 2, 1.5 * px - 2);
    }
  }
  g.strokeStyle = 'rgba(30, 32, 28, 0.35)';
  g.lineWidth = Math.max(1, px * 0.06);
  for (let x = MORTYTOWN.x0; x <= MORTYTOWN.x1; x += 1.5) {
    g.beginPath();
    g.moveTo(X(x), 0);
    g.lineTo(X(x), ch);
    g.stroke();
  }
  for (let z = MORTYTOWN.z0; z <= MORTYTOWN.z1; z += 1.5) {
    g.beginPath();
    g.moveTo(0, Z(z));
    g.lineTo(cw, Z(z));
    g.stroke();
  }
  // the road
  g.fillStyle = C.asphalt;
  g.fillRect(0, Z(ROAD.z0), cw, (ROAD.z1 - ROAD.z0) * px);
  // the side street up to Simple Rick's back door
  g.fillRect(X(-12), 0, 8 * px, Z(ROAD.z0));
  // its grain: flecks light and dark
  for (let i = 0; i < 26000 * k * k; i++) {
    const x = r() * cw;
    const z = Z(ROAD.z0) + r() * (ROAD.z1 - ROAD.z0) * px;
    g.fillStyle = r() < 0.5 ? 'rgba(255,255,240,0.05)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, z, 1 + r() * 2 * k, 1 + r() * 2 * k);
  }
  // patches of newer tar, and oil
  for (let i = 0; i < 28; i++) {
    const x = r() * cw;
    const z = Z(ROAD.z0 + 0.5 + r() * (ROAD.z1 - ROAD.z0 - 1));
    g.fillStyle = r() < 0.5 ? 'rgba(20, 24, 26, 0.35)' : 'rgba(70, 72, 70, 0.25)';
    g.fillRect(x, z, (1 + r() * 4) * px, (0.6 + r() * 2) * px);
  }
  for (let i = 0; i < 22; i++) {
    const x = r() * cw;
    const z = Z(-5 + r() * 10);
    const gr = g.createRadialGradient(x, z, 0, x, z, (0.4 + r()) * px);
    gr.addColorStop(0, 'rgba(8, 10, 14, 0.5)');
    gr.addColorStop(1, 'rgba(8, 10, 14, 0)');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, z, (0.5 + r()) * px, (0.3 + r() * 0.6) * px, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // cracks
  g.strokeStyle = 'rgba(14, 16, 18, 0.55)';
  for (let i = 0; i < 60; i++) {
    let x = r() * cw;
    let z = Z(-6 + r() * 12);
    g.lineWidth = Math.max(1, px * (0.04 + r() * 0.05));
    g.beginPath();
    g.moveTo(x, z);
    for (let s = 0; s < 6; s++) {
      x += (r() - 0.5) * px * 1.6;
      z += (r() - 0.5) * px * 1.2;
      g.lineTo(x, z);
    }
    g.stroke();
  }
  // the centre line, worn: dashes, some half gone
  for (let x = MORTYTOWN.x0 + 1; x < MORTYTOWN.x1 - 2; x += 4) {
    g.fillStyle = `rgba(214, 180, 70, ${0.35 + r() * 0.4})`;
    g.fillRect(X(x), Z(-0.08), 2.2 * px * (0.6 + r() * 0.4), 0.16 * px);
  }
  // the kerbs' edges, and the gutter's grime along them
  for (const z of [ROAD.z0, ROAD.z1]) {
    g.fillStyle = C.kerb;
    g.fillRect(0, Z(z) - 0.12 * px, cw, 0.24 * px);
    const gr = g.createLinearGradient(0, Z(z) - 0.8 * px * Math.sign(z), 0, Z(z));
    gr.addColorStop(0, 'rgba(20, 22, 18, 0)');
    gr.addColorStop(1, 'rgba(20, 22, 18, 0.4)');
    g.fillStyle = gr;
    g.fillRect(0, Math.min(Z(z), Z(z) - 0.8 * px * Math.sign(z)), cw, 0.8 * px);
  }
  // grime where the pavement meets the shopfronts and the alleys' walls
  for (const z of [-FRONT, FRONT]) {
    const gr = g.createLinearGradient(0, Z(z), 0, Z(z - Math.sign(z) * 1.6));
    gr.addColorStop(0, 'rgba(26, 24, 18, 0.5)');
    gr.addColorStop(1, 'rgba(26, 24, 18, 0)');
    g.fillStyle = gr;
    g.fillRect(0, Math.min(Z(z), Z(z - Math.sign(z) * 1.6)), cw, 1.6 * px);
  }
  for (const h of HIDES) {
    g.fillStyle = 'rgba(30, 30, 22, 0.45)';
    g.fillRect(X(h.x - 2), Z(Math.min(h.z, Math.sign(h.z) * FRONT)), 4 * px, Math.abs(h.z - Math.sign(h.z) * FRONT) * px + 4 * px);
  }
  // manholes and drains
  for (const [x, z] of [[-41, -2.5], [-6, 2.4], [24, -2.2], [47, 2.6]]) {
    g.fillStyle = '#2a2e2e';
    g.beginPath();
    g.arc(X(x), Z(z), 0.42 * px, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(150, 150, 130, 0.5)';
    g.lineWidth = Math.max(1, px * 0.05);
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(X(x - 0.3), Z(z + i * 0.12));
      g.lineTo(X(x + 0.3), Z(z + i * 0.12));
      g.stroke();
    }
  }
  for (let x = MORTYTOWN.x0 + 7; x < MORTYTOWN.x1; x += 14) {
    for (const z of [ROAD.z0 + 0.25, ROAD.z1 - 0.25]) {
      g.fillStyle = '#16191a';
      g.fillRect(X(x), Z(z) - 0.12 * px, 0.9 * px, 0.24 * px);
    }
  }
  return c;
}

// The neon's light on the wet street under it: soft pools of colour
function paintStreetGlow(k, pools) {
  const px = 4 * k;
  const c = makeCanvas(Math.round(W * px), Math.round(D * px));
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'lighter';
  for (const [x, z, r, hex, a] of pools) {
    const cx = (x - MORTYTOWN.x0) * px;
    const cz = (z - MORTYTOWN.z0) * px;
    const col = new THREE.Color(hex);
    const rgb = `${Math.round(col.r * 255)}, ${Math.round(col.g * 255)}, ${Math.round(col.b * 255)}`;
    const gr = g.createRadialGradient(cx, cz, 0, cx, cz, r * px);
    gr.addColorStop(0, `rgba(${rgb}, ${a})`);
    gr.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(cx, cz, r * px, r * px * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

// A block's street face: panels with their seams and rivets, rust run down
// from the top, grime up from the bottom; the shop at street level (a lit
// window, a door, a rolled-down shutter); floors of windows above, some lit,
// some dark with their blinds down, some boarded over. Its light is a second
// canvas, the lit panes alone.
function paintFacade(id, w, h, look, k) {
  const px = 18 * k;
  const cw = Math.max(32, Math.round(w * px));
  const ch = Math.max(32, Math.round(h * px));
  const c = makeCanvas(cw, ch);
  const e = makeCanvas(cw, ch);
  const g = c.getContext('2d');
  const ge = e.getContext('2d');
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, cw, ch);
  const r = rnd([...id].reduce((s, ch2) => s * 31 + ch2.charCodeAt(0), 7));
  const X = (x) => x * px; // metres from the left
  const Y = (y) => ch - y * px; // metres up from the street
  g.fillStyle = look.wall;
  g.fillRect(0, 0, cw, ch);
  // panels: each a shade off the wall's, with a seam and rivets round it
  const pw = 2.4;
  const ph = 1.7;
  for (let x = 0; x < w; x += pw) {
    for (let y = 0; y < h; y += ph) {
      const v = (r() - 0.5) * 0.12;
      g.fillStyle = v > 0 ? `rgba(255, 255, 235, ${v})` : `rgba(0, 0, 0, ${-v})`;
      g.fillRect(X(x), Y(y + ph), pw * px, ph * px);
      g.strokeStyle = 'rgba(18, 22, 20, 0.45)';
      g.lineWidth = Math.max(1, px * 0.05);
      g.strokeRect(X(x), Y(y + ph), pw * px, ph * px);
      g.fillStyle = 'rgba(20, 24, 22, 0.5)';
      for (const [a, b] of [[0.12, 0.12], [pw - 0.12, 0.12], [0.12, ph - 0.12], [pw - 0.12, ph - 0.12]]) g.fillRect(X(x + a) - px * 0.04, Y(y + b) - px * 0.04, px * 0.08, px * 0.08);
    }
  }
  // rust run down from the roof and from under the window sills
  const streak = (x, y, len, a) => {
    const gr = g.createLinearGradient(0, Y(y), 0, Y(y - len));
    gr.addColorStop(0, `rgba(122, 74, 46, ${a})`);
    gr.addColorStop(1, 'rgba(122, 74, 46, 0)');
    g.fillStyle = gr;
    g.fillRect(X(x), Y(y), (0.15 + r() * 0.4) * px, len * px);
  };
  for (let i = 0; i < w * 0.9; i++) streak(r() * w, h, 1 + r() * h * 0.5, 0.25 + r() * 0.3);
  // grime up from the street
  const gr = g.createLinearGradient(0, Y(0), 0, Y(2.4));
  gr.addColorStop(0, 'rgba(20, 18, 14, 0.55)');
  gr.addColorStop(1, 'rgba(20, 18, 14, 0)');
  g.fillStyle = gr;
  g.fillRect(0, Y(2.4), cw, 2.4 * px);

  // the shop at street level
  const shopW = Math.min(w - 2, Math.max(6, w * 0.55));
  const sx = (w - shopW) / 2;
  const lit = (x0, y0, ww, hh, col) => {
    const gg = g.createLinearGradient(0, Y(y0 + hh), 0, Y(y0));
    gg.addColorStop(0, col[0]);
    gg.addColorStop(1, col[1]);
    g.fillStyle = gg;
    g.fillRect(X(x0), Y(y0 + hh), ww * px, hh * px);
    ge.fillStyle = col[2];
    ge.fillRect(X(x0), Y(y0 + hh), ww * px, hh * px);
  };
  const frame = (x0, y0, ww, hh) => {
    g.strokeStyle = '#1b2022';
    g.lineWidth = Math.max(2, px * 0.14);
    g.strokeRect(X(x0), Y(y0 + hh), ww * px, hh * px);
  };
  // the window: a lit interior with shelves and shapes on them
  lit(sx, 0.7, shopW * 0.62, 2.5, ['#ffe9b8', '#b9824a', '#c89a5a']);
  for (let s = 0; s < 3; s++) {
    g.fillStyle = 'rgba(40, 32, 26, 0.6)';
    g.fillRect(X(sx + 0.2), Y(1.2 + s * 0.75), (shopW * 0.62 - 0.4) * px, 0.08 * px);
    for (let i = 0; i < shopW * 1.5; i++) {
      g.fillStyle = ['#e8483c', '#f3c33b', '#3e8ee0', '#5cc06a', '#a98ad8', '#f0f0e0'][Math.floor(r() * 6)];
      g.fillRect(X(sx + 0.3 + r() * (shopW * 0.62 - 0.8)), Y(1.2 + s * 0.75 + 0.42), 0.18 * px, 0.4 * px);
    }
  }
  if (look.washers) {
    for (let i = 0; i < 4; i++) {
      const cx = X(sx + 0.8 + i * 1.1);
      g.fillStyle = '#e8ecea';
      g.fillRect(cx - 0.45 * px, Y(1.6), 0.9 * px, 0.9 * px);
      g.fillStyle = '#5a8aa0';
      g.beginPath();
      g.arc(cx, Y(1.15), 0.3 * px, 0, Math.PI * 2);
      g.fill();
    }
  }
  frame(sx, 0.7, shopW * 0.62, 2.5);
  if (look.bars) {
    g.fillStyle = '#23292b';
    for (let x = sx + 0.15; x < sx + shopW * 0.62; x += 0.32) g.fillRect(X(x), Y(3.2), 0.06 * px, 2.5 * px);
  }
  // the door, lit inside
  lit(sx + shopW * 0.66, 0, 1.4, 2.6, ['#fff2d0', '#a07040', '#a07848']);
  frame(sx + shopW * 0.66, 0, 1.4, 2.6);
  // a shutter rolled down over the rest
  const shx = sx + shopW * 0.66 + 1.6;
  const shw = Math.max(0, sx + shopW - shx);
  if (shw > 0.6) {
    g.fillStyle = '#7d8580';
    g.fillRect(X(shx), Y(3), shw * px, 3 * px);
    g.fillStyle = 'rgba(30, 34, 32, 0.5)';
    for (let y = 0.1; y < 3; y += 0.16) g.fillRect(X(shx), Y(y), shw * px, 0.04 * px);
    // a tag on it
    g.fillStyle = r() < 0.5 ? '#a85adf' : '#4ad6c8';
    g.font = `900 ${Math.round(0.9 * px)}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.save();
    g.translate(X(shx + shw / 2), Y(1.4));
    g.rotate(-0.08);
    g.fillText(['LOCOS', 'M-TOWN', 'NO RICKS', '¡MORTY!'][Math.floor(r() * 4)], 0, 0);
    g.restore();
  }
  // the floors above: windows, lit warm or cyan, dark with blinds, or boarded
  const floors = look.floors ?? 2;
  const fh = (h - 4.4) / Math.max(1, floors);
  for (let f = 0; f < floors; f++) {
    const y0 = 4.6 + f * fh + fh * 0.18;
    const wh = Math.min(1.7, fh * 0.55);
    for (let x = 1.3; x + 1.3 < w; x += 2.9) {
      const roll = r();
      if (look.boarded && roll < look.boarded) {
        g.fillStyle = '#7a6046';
        g.fillRect(X(x), Y(y0 + wh), 1.4 * px, wh * px);
        g.fillStyle = '#8f7252';
        for (let p = 0; p < 3; p++) {
          g.save();
          g.translate(X(x + 0.7), Y(y0 + wh * (0.25 + p * 0.27)));
          g.rotate((r() - 0.5) * 0.4);
          g.fillRect(-0.85 * px, -0.11 * px, 1.7 * px, 0.22 * px);
          g.restore();
        }
      } else if (roll < 0.62) {
        g.fillStyle = '#26302f';
        g.fillRect(X(x), Y(y0 + wh), 1.4 * px, wh * px);
        g.fillStyle = 'rgba(160, 170, 150, 0.35)';
        for (let b = 0; b < wh * (0.3 + r() * 0.6); b += 0.12) g.fillRect(X(x + 0.06), Y(y0 + wh - b), 1.28 * px, 0.05 * px);
      } else {
        const warm = roll < 0.85;
        lit(x, y0, 1.4, wh, warm ? ['#ffe3a0', '#d08a40', '#ffcf80'] : ['#d2fff6', '#58a8a0', '#90fff0']);
        g.fillStyle = 'rgba(30, 30, 30, 0.35)';
        g.fillRect(X(x + 0.68), Y(y0 + wh), 0.06 * px, wh * px);
      }
      frame(x, y0, 1.4, wh);
      g.fillStyle = 'rgba(16, 18, 16, 0.6)';
      g.fillRect(X(x - 0.1), Y(y0), 1.6 * px, 0.12 * px);
      streak(x + 0.2 + r(), y0, 0.6 + r() * 1.4, 0.3);
    }
  }
  // posters: Vote Morty, a missing Morty, Mega Seeds
  if (look.sign?.[1] === 'posters' || r() < 0.6) {
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + r() * (w - 2);
      const y = 0.9 + r() * 1.3;
      const kind = Math.floor(r() * 3);
      g.save();
      g.translate(X(x), Y(y));
      g.rotate((r() - 0.5) * 0.12);
      g.fillStyle = ['#f3e2a8', '#f2f0e8', '#d8f0c0'][kind];
      g.fillRect(0, -1.1 * px, 0.8 * px, 1.1 * px);
      g.fillStyle = ['#c8262e', '#202020', '#2a6a1c'][kind];
      g.font = `900 ${Math.round(0.16 * px)}px "Arial Black", Arial, sans-serif`;
      g.textAlign = 'center';
      g.fillText(['VOTE', 'MISSING', 'MEGA'][kind], 0.4 * px, -0.86 * px);
      g.fillText(['MORTY', 'MORTY', 'SEEDS'][kind], 0.4 * px, -0.18 * px);
      // a Morty's round head, two eyes
      if (kind < 2) {
        g.fillStyle = '#f2c79a';
        g.beginPath();
        g.arc(0.4 * px, -0.52 * px, 0.2 * px, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#fff';
        g.beginPath();
        g.arc(0.33 * px, -0.54 * px, 0.06 * px, 0, Math.PI * 2);
        g.arc(0.47 * px, -0.54 * px, 0.06 * px, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#6b3d1e';
        g.fillRect(0.2 * px, -0.74 * px, 0.4 * px, 0.08 * px);
      }
      g.restore();
    }
  }
  return { map: c, glow: e };
}

// A block's side, down an alley or the side street: plainer panels, two
// floors of small windows (a few lit), a pipe and a vent, made to repeat
// every eight metres along and up the wall
function paintSide(k) {
  const px = 64 * k; // (the tile is 8 m square, at 512 pixels at high)
  const n = Math.round(8 * px);
  const c = makeCanvas(n, n);
  const e = makeCanvas(n, n);
  const g = c.getContext('2d');
  const ge = e.getContext('2d');
  ge.fillStyle = '#000';
  ge.fillRect(0, 0, n, n);
  const r = rnd(23);
  g.fillStyle = '#56605a';
  g.fillRect(0, 0, n, n);
  for (let x = 0; x < 8; x += 2) {
    for (let y = 0; y < 8; y += 1.6) {
      const v = (r() - 0.5) * 0.14;
      g.fillStyle = v > 0 ? `rgba(255, 255, 235, ${v})` : `rgba(0, 0, 0, ${-v})`;
      g.fillRect(x * px, y * px, 2 * px, 1.6 * px);
      g.strokeStyle = 'rgba(18, 22, 20, 0.4)';
      g.lineWidth = Math.max(1, px * 0.04);
      g.strokeRect(x * px, y * px, 2 * px, 1.6 * px);
    }
  }
  // rust down from each row of windows
  for (let i = 0; i < 14; i++) {
    const x = r() * n;
    const y = r() * n;
    const gr = g.createLinearGradient(0, y, 0, y + px * (1 + r() * 2));
    gr.addColorStop(0, 'rgba(122, 74, 46, 0.4)');
    gr.addColorStop(1, 'rgba(122, 74, 46, 0)');
    g.fillStyle = gr;
    g.fillRect(x, y, px * 0.2, px * 3);
  }
  // two windows a floor, two floors a tile
  for (const y of [1.2, 5.2]) {
    for (const x of [1.4, 5.2]) {
      const lit = r() < 0.3;
      g.fillStyle = lit ? '#ffd890' : '#252d2c';
      g.fillRect(x * px, y * px, 1.3 * px, 1.5 * px);
      if (lit) {
        ge.fillStyle = '#ffc870';
        ge.fillRect(x * px, y * px, 1.3 * px, 1.5 * px);
      } else {
        g.fillStyle = 'rgba(150, 160, 140, 0.3)';
        for (let b = 0.1; b < 1.5; b += 0.14) g.fillRect(x * px, (y + b) * px, 1.3 * px, 0.04 * px);
      }
      g.strokeStyle = '#1b2022';
      g.lineWidth = Math.max(2, px * 0.1);
      g.strokeRect(x * px, y * px, 1.3 * px, 1.5 * px);
    }
  }
  // a pipe down it, and a vent
  g.fillStyle = '#6d7872';
  g.fillRect(3.6 * px, 0, 0.22 * px, n);
  g.fillStyle = 'rgba(0, 0, 0, 0.3)';
  g.fillRect(3.78 * px, 0, 0.06 * px, n);
  g.fillStyle = '#3a4240';
  g.fillRect(6.6 * px, 3.4 * px, 0.9 * px, 0.6 * px);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = '#1c2120';
    g.fillRect(6.65 * px, (3.45 + i * 0.11) * px, 0.8 * px, 0.05 * px);
  }
  return { map: c, glow: e };
}

// A neon sign: tubes of light on a dark board, painted as glow on black
// (added, not laid over: the board behind is a mesh of its own)
function paintNeon(text, hex, k, { w = 1024, h = 256, font = '"Arial Black", Arial, sans-serif', italic = false, bottle = false } = {}) {
  const c = makeCanvas(Math.round(w * k), Math.round(h * k));
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = h * 0.62;
  g.font = `${italic ? 'italic ' : ''}900 ${size}px ${font}`;
  while (g.measureText(text).width > w * 0.86 && size > 20) {
    size -= 4;
    g.font = `${italic ? 'italic ' : ''}900 ${size}px ${font}`;
  }
  const tube = (fn) => {
    g.shadowColor = hex;
    for (const [blur, width, col] of [[h * 0.16, size * 0.09, hex], [h * 0.05, size * 0.05, hex], [0, size * 0.022, '#ffffff']]) {
      g.shadowBlur = blur;
      g.lineWidth = width;
      g.strokeStyle = col;
      fn();
    }
  };
  if (bottle) {
    // a bottle in tubes, as on the corner by Morty Mart
    tube(() => {
      g.beginPath();
      g.moveTo(w / 2 - 34, h * 0.86);
      g.lineTo(w / 2 - 34, h * 0.42);
      g.lineTo(w / 2 - 12, h * 0.3);
      g.lineTo(w / 2 - 12, h * 0.1);
      g.lineTo(w / 2 + 12, h * 0.1);
      g.lineTo(w / 2 + 12, h * 0.3);
      g.lineTo(w / 2 + 34, h * 0.42);
      g.lineTo(w / 2 + 34, h * 0.86);
      g.closePath();
      g.stroke();
    });
    g.font = `900 ${h * 0.16}px ${font}`;
    tube(() => g.strokeText(text, w / 2, h * 0.62));
    return c;
  }
  tube(() => g.strokeText(text, w / 2, h / 2 + 4));
  return c;
}

// A tag sprayed on an alley's wall
function paintGraffiti(k, seed) {
  const c = makeCanvas(Math.round(512 * k), Math.round(256 * k));
  const g = c.getContext('2d');
  g.scale(k, k);
  const r = rnd(seed);
  const words = ['LOCOS', 'MORTYTOWN', 'NO RICKS', 'M13', 'WUBBA'];
  const cols = ['#a85adf', '#4ad6c8', '#ff7a3a', '#e8e04a', '#ff5ad2'];
  for (let i = 0; i < 3; i++) {
    g.save();
    g.translate(60 + r() * 380, 70 + r() * 120);
    g.rotate((r() - 0.5) * 0.4);
    g.font = `900 ${50 + r() * 40}px "Arial Black", Arial, sans-serif`;
    g.lineJoin = 'round';
    g.lineWidth = 10;
    g.strokeStyle = '#141418';
    const word = words[Math.floor(r() * words.length)];
    g.strokeText(word, 0, 0);
    g.fillStyle = cols[Math.floor(r() * cols.length)];
    g.fillText(word, 0, 0);
    g.restore();
  }
  // drips
  g.fillStyle = 'rgba(168, 90, 223, 0.7)';
  for (let i = 0; i < 12; i++) g.fillRect(r() * 512, 120 + r() * 60, 3, 10 + r() * 40);
  return c;
}

// the lettering on the cruiser's doors, and on the loading dock and the lift
function paintPlate(text, bg, ink, k, { w = 512, h = 128 } = {}) {
  const c = makeCanvas(Math.round(w * k), Math.round(h * k));
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = ink;
  g.lineWidth = 8;
  g.strokeRect(6, 6, w - 12, h - 12);
  g.fillStyle = ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = h * 0.56;
  g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  while (g.measureText(text).width > w * 0.88 && size > 14) {
    size -= 2;
    g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  }
  g.fillText(text, w / 2, h / 2 + 3);
  return c;
}

// hazard stripes, for the gate at the east end and the lift's frame
function paintStripes(k) {
  const c = makeCanvas(Math.round(256 * k), Math.round(256 * k));
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = '#e8b830';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#1c1e20';
  for (let s = -256; s < 512; s += 64) {
    g.beginPath();
    g.moveTo(s, 256);
    g.lineTo(s + 32, 256);
    g.lineTo(s + 288, 0);
    g.lineTo(s + 256, 0);
    g.fill();
  }
  g.fillStyle = 'rgba(40, 30, 20, 0.35)';
  for (let i = 0; i < 40; i++) g.fillRect((i * 97) % 256, (i * 53) % 256, 20, 6);
  return c;
}

// ── building ──

export async function buildDistrict(renderer, { tier = 'high' } = {}) {
  const group = new THREE.Group();
  group.name = 'mortytown';
  group.position.set(ORIGIN.x, ORIGIN.y, ORIGIN.z);
  const statics = new THREE.Group();
  group.add(statics);
  const hide = []; // what the ink line leaves alone: the sky, the neon, the glows
  const moving = []; // what bake leaves alone
  const lights = []; // where the light pool may go: [x, y, z, colour], in the district's frame
  const owned = []; // textures and materials made here
  const lvl = detailLevel();
  const unlined = new Set(); // materials the ink line leaves alone, found again after the bake
  const k = texScale(1024, { max: 2048 }); // (1 at high, 2 at ultra, ½ low)
  const aniso = Math.min(tier === 'high' ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
  const tex = (canvas, { srgb = true, wrap = false } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (wrap) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = aniso;
    owned.push(t);
    return t;
  };
  const mat = (m) => (owned.push(m), m);
  const glowMat = (hex, power = 2) => mat(new THREE.MeshBasicMaterial({ color: hot(hex, power) }));

  const M = {
    dark: mat(toon(C.dark)),
    trim: mat(toon(C.trim)),
    metal: mat(toon(C.metal)),
    rust: mat(toon(C.rust)),
    concrete: mat(toon(0x7c7a6c)),
    bin: mat(toon(0x3a5a3e)),
    binB: mat(toon(0x2e4a58)),
    lid: mat(toon(0x24302a)),
    bag: mat(toon(0x26282a)),
    white: mat(toon(0xe8ece6)),
    black: mat(toon(0x1a1d20)),
    cream: mat(toon(0xf1e3c2)),
    wafer: mat(toon(0xd9a35b)),
    glass: mat(new THREE.MeshBasicMaterial({ color: 0x86d6cc, transparent: true, opacity: 0.32, depthWrite: false })),
    cyan: glowMat(C.cyan, 2.2),
    green: glowMat(C.green, 2),
    red: glowMat(C.red, 2.2),
    pink: glowMat(C.pink, 2.2),
    amber: glowMat(C.amber, 1.8),
    warm: glowMat(C.warm, 1.4),
    lamp: glowMat(0xdff8ff, 2.4),
  };
  const STRIP = { [C.cyan]: M.cyan, [C.green]: M.green, [C.red]: M.red, [C.pink]: M.pink, [C.amber]: M.amber };
  const side = paintSide(k);
  M.side = mat(toon(0xffffff, { map: tex(side.map, { wrap: true }), emissiveMap: tex(side.glow, { wrap: true }), emissive: hot(0xffffff, 0.8) }));

  const mesh = (geo, material, parent = statics) => {
    const m = new THREE.Mesh(geo, material);
    parent.add(m);
    return m;
  };
  const box = (w, h, dd, material, x, y, z, turn = 0, parent = statics) => {
    const m = mesh(new THREE.BoxGeometry(w, h, dd), material, parent);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    return m;
  };
  const cyl = (rt, rb, h, material, x, y, z, { n = 16, axis = 'y' } = {}, parent = statics) => {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, seg(n)), material, parent);
    m.position.set(x, y, z);
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  };
  const plane = (w, h, material, x, y, z, turn = 0, parent = statics) => {
    const m = mesh(new THREE.PlaneGeometry(w, h), material, parent);
    m.position.set(x, y, z);
    m.rotation.y = turn;
    return m;
  };

  // A block's sides, where they show (down an alley, up the side street):
  // the side tile over them, 8 m to a repeat; none against the district's ends
  const sideFaces = (x0, x1, z0, z1, h) => {
    for (const [x, e] of [[x0, -1], [x1, 1]]) {
      if (x <= MORTYTOWN.x0 + 0.5 || x >= MORTYTOWN.x1 - 0.5) continue;
      const geo = new THREE.PlaneGeometry(z1 - z0, h);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * (z1 - z0)) / 8, (uv.getY(i) * h) / 8);
      const m = mesh(geo, M.side);
      m.position.set(x + e * 0.02, h / 2, (z0 + z1) / 2);
      m.rotation.y = (e * Math.PI) / 2;
    }
  };

  // ── the floor ──
  // (the neon's pools on it, gathered as the signs go up, painted at the end)
  const pools = [];
  const floorMat = mat(toon(0xffffff, { map: tex(paintStreet(k)), emissive: hot(0xffffff, 0.55) }));
  const floor = mesh(new THREE.PlaneGeometry(W, D), floorMat, group);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((MORTYTOWN.x0 + MORTYTOWN.x1) / 2, 0, (MORTYTOWN.z0 + MORTYTOWN.z1) / 2);
  floor.name = 'floor';
  // the kerbs: a low edge either side of the road, broken for the side street
  for (const z of [ROAD.z0, ROAD.z1]) {
    for (const [x0, x1] of z < 0 ? [[MORTYTOWN.x0, -12], [-4, MORTYTOWN.x1]] : [[MORTYTOWN.x0, MORTYTOWN.x1]]) {
      box(x1 - x0, 0.08, 0.26, M.concrete, (x0 + x1) / 2, 0.04, z);
    }
  }

  // ── the blocks ──
  const facing = (b) => (b.z < 0 ? 1 : -1); // which way its street face points (+z for the north side)
  const frontZ = (b) => (b.z < 0 ? -FRONT : FRONT);
  const procedural = (b) => {
    const look = LOOKS[b.id] ?? LOOKS['tenement-n'];
    const s = facing(b);
    const fz = frontZ(b);
    const wallMat = mat(toon(look.wall));
    // the body, its sides, and its street face painted
    box(b.w, b.h, b.d, wallMat, b.x, b.h / 2, b.z);
    sideFaces(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, b.h);
    const paint = paintFacade(b.id, b.w, b.h, look, k);
    const faceMat = mat(toon(0xffffff, { map: tex(paint.map), emissiveMap: tex(paint.glow), emissive: hot(0xffffff, 0.9) }));
    plane(b.w, b.h, faceMat, b.x, b.h / 2, fz + s * 0.02, s > 0 ? 0 : Math.PI);
    // a cornice, and a parapet's lip
    box(b.w + 0.5, 0.45, 0.9, M.trim, b.x, b.h - 0.22, fz + s * 0.25);
    box(b.w, 0.6, 0.25, wallMat, b.x, b.h + 0.3, fz - s * 0.1);
    // ledges between the floors
    const floors = look.floors ?? 2;
    const fh = (b.h - 4.4) / Math.max(1, floors);
    for (let f = 0; f < floors; f++) box(b.w + 0.1, 0.16, 0.3, M.trim, b.x, 4.4 + f * fh, fz + s * 0.13);
    // the light strips up its corners, and one across under the cornice
    const strip = STRIP[look.strip] ?? M.cyan;
    for (const e of [-1, 1]) box(0.14, b.h - 4.6, 0.12, strip, b.x + e * (b.w / 2 - 0.25), 4.4 + (b.h - 4.6) / 2, fz + s * 0.08);
    box(b.w - 1, 0.12, 0.12, strip, b.x, b.h - 0.75, fz + s * 0.5);
    // an awning over the shop, lit along its edge
    const shopW = Math.min(b.w - 2, Math.max(6, b.w * 0.55));
    const aw = mesh(new THREE.BoxGeometry(shopW, 0.14, 1.5), M.dark);
    aw.position.set(b.x, 3.55, fz + s * 0.75);
    aw.rotation.x = s * 0.12;
    box(shopW, 0.08, 0.08, strip, b.x, 3.48, fz + s * 1.5);
    // pipes down the face, and a conduit along under the cornice
    cyl(0.12, 0.12, b.h - 0.5, M.metal, b.x - b.w / 2 + 0.7, (b.h - 0.5) / 2, fz + s * 0.2, { n: 8 });
    cyl(0.1, 0.1, b.w - 1.4, M.metal, b.x, b.h - 1.3, fz + s * 0.22, { n: 8, axis: 'x' });
    // a round air-con drum over the door, as the show hangs them
    if (look.drum || b.w > 24) {
      const dx = b.x + b.w * 0.2;
      cyl(0.65, 0.65, 2.2, M.metal, dx, 4.3, fz + s * 0.7, { n: 20, axis: 'x' });
      cyl(0.5, 0.5, 2.3, M.dark, dx, 4.3, fz + s * 0.7, { n: 20, axis: 'x' });
      box(2.3, 0.08, 0.06, M.green, dx, 3.7, fz + s * 1.36);
    }
    // a red lamp over a door, a pair of them
    for (const e of [-1, 1]) {
      const lx = b.x + shopW * 0.16 + e * 0.9;
      mesh(new THREE.SphereGeometry(0.16, seg(10), seg(8)), M.red).position.set(lx, 3.1, fz + s * 0.2);
    }
    // the shop's sign
    if (look.sign) {
      const [text, kind, hex] = look.sign;
      if (kind === 'plate') {
        const p = plane(Math.min(shopW, 7), 1.3, mat(new THREE.MeshBasicMaterial({ map: tex(paintPlate(text, '#e8e4d4', '#3a3a34', k)), color: 0xbdbab0 })), b.x, 4.2 + 0.05, fz + s * 0.06, s > 0 ? 0 : Math.PI);
        void p;
      } else if (kind === 'neon' || kind === 'bottle') {
        const sw = kind === 'bottle' ? 2.2 : Math.min(shopW, 8);
        const sh = kind === 'bottle' ? 3.2 : 1.6;
        const board = box(sw + 0.3, sh + 0.2, 0.14, M.black, b.x, kind === 'bottle' ? 6.2 : 4.35, fz + s * 0.12);
        void board;
        const neon = new THREE.MeshBasicMaterial({ map: tex(paintNeon(text, hex, k, kind === 'bottle' ? { w: 256, h: 384, bottle: true } : {})), color: hot(0xffffff, 1.7), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
        mat(neon);
        const n = plane(sw, sh, neon, b.x, kind === 'bottle' ? 6.2 : 4.35, fz + s * 0.21, s > 0 ? 0 : Math.PI);
        hide.push(n);
        flicker.push({ m: neon, base: 1.7, rate: 0.6 + flicker.length * 0.37 });
        pools.push([b.x, fz + s * 3, 4.5, new THREE.Color(hex).getHex(), 0.55]);
        lights.push([b.x, 4, fz + s * 2.4, new THREE.Color(hex).getHex()]);
      }
    }
    // stairs up to a side door, as on the street's corner in the show
    if (look.stairs) {
      const sx = b.x + b.w / 2 - 2.2;
      for (let i = 0; i < 6; i++) box(1.4, 0.2, 0.42, M.concrete, sx, 0.1 + i * 0.22, fz + s * (2.6 - i * 0.42));
      box(1.6, 0.16, 1.2, M.concrete, sx, 1.42, fz + s * 0.6);
      for (const e of [-1, 1]) {
        const rail = mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 6), M.metal);
        rail.position.set(sx + e * 0.72, 1.6, fz + s * 1.6);
        rail.rotation.x = s * 1.0;
      }
      plane(1.1, 2.2, M.warm, sx, 2.6, fz + s * 0.04, s > 0 ? 0 : Math.PI);
      lights.push([sx, 3.2, fz + s * 1.5, C.warm]);
    }
    // a fire escape: landings and ladders up the face
    if (look.escape) {
      const ex = b.x - b.w * 0.18;
      for (let f = 0; f < floors; f++) {
        const y = 4.4 + f * fh + 0.1;
        box(4.2, 0.08, 1.2, M.dark, ex, y, fz + s * 0.65);
        box(4.2, 0.05, 0.05, M.dark, ex, y + 1, fz + s * 1.24);
        for (let p = -2; p <= 2; p++) box(0.04, 1, 0.04, M.dark, ex + p * 1.04, y + 0.5, fz + s * 1.24);
        const lad = mesh(new THREE.BoxGeometry(0.5, fh * 1.08, 0.06), M.dark);
        lad.position.set(ex + (f % 2 ? -1.4 : 1.4), y - fh / 2 + 0.05, fz + s * 0.95);
        lad.rotation.z = (f % 2 ? 1 : -1) * 0.35;
      }
    }
    roofClutter(b);
  };
  // on the roofs: air-con units, vents, a water tank on legs, aerials
  const roofClutter = (b) => {
    const r = rnd(b.x * 13 + b.z * 7 + 3);
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const x = b.x + (r() - 0.5) * (b.w - 4);
      const z = b.z + (r() - 0.5) * (b.d - 6);
      const kind = r();
      if (kind < 0.4) box(1.6 + r(), 1 + r() * 0.6, 1.2 + r(), M.metal, x, b.h + 0.6, z, r() * 0.4);
      else if (kind < 0.65) cyl(0.35, 0.35, 1.6, M.metal, x, b.h + 0.8, z, { n: 10 });
      else if (kind < 0.85) {
        cyl(1.2, 1.2, 2.2, M.rust, x, b.h + 2.6, z, { n: 16 });
        mesh(new THREE.ConeGeometry(1.3, 0.8, seg(16)), M.dark).position.set(x, b.h + 4.1, z);
        for (const [a, c] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) box(0.12, 1.5, 0.12, M.dark, x + a, b.h + 0.75, z + c);
      } else {
        cyl(0.04, 0.06, 5, M.dark, x, b.h + 2.5, z, { n: 6 });
        mesh(new THREE.SphereGeometry(0.12, seg(8), seg(6)), M.red).position.set(x, b.h + 5.05, z);
      }
    }
  };
  const flicker = [];
  for (const b of BLOCKS) if (b.id !== 'mortymart' && b.id !== 'creepymorty') procedural(b);

  // ── the two Meshy shopfronts, fitted to their blocks ──
  // Each model stands on its block's street edge, as wide as fits, the rest
  // of the block behind it a plain body; a model that doesn't load leaves
  // its block drawn in code like the rest.
  const props = createMeshyCast();
  await props.load(null, ['mortymart', 'creepymorty']).catch(() => null);
  const fronts = [
    // Morty Mart: its sign and window are on the model's +x side, so it's
    // turned a quarter to face the street (north); its sign in red neon
    { id: 'mortymart', turn: Math.PI / 2, width: 16 },
    // The Creepy Morty: its door is on the model's +z side, the street's
    // (south) for a block on the north side
    { id: 'creepymorty', turn: 0, width: 19 },
  ];
  for (const f of fronts) {
    const b = BLOCKS.find((x) => x.id === f.id);
    const g = props.prop(f.id, 1);
    if (!g) {
      procedural({ ...b });
      continue;
    }
    g.rotation.y = f.turn;
    g.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
    const kk = f.width / size.x;
    g.scale.setScalar(kk);
    const depth = size.z * kk;
    const fz = frontZ(b);
    const s = facing(b);
    g.position.set(b.x, 0, fz - s * (depth / 2));
    group.add(g);
    // the block behind it, and its sides to the neighbours
    const back = b.d - depth;
    const sh = size.y * kk;
    const tall = Math.max(b.h, sh * 0.85);
    const wallMat = mat(toon(LOOKS[f.id].wall));
    // (from the block's far edge to the model's back)
    if (back > 0.5) box(b.w, tall, back, wallMat, b.x, tall / 2, (b.z - (s * b.d) / 2 + fz - s * depth) / 2);
    for (const e of [-1, 1]) {
      const gap = (b.w - f.width) / 2;
      if (gap > 0.3) {
        box(gap, tall, b.d, wallMat, b.x + e * (b.w / 2 - gap / 2), tall / 2, b.z);
        sideFaces(e < 0 ? b.x - b.w / 2 : Infinity, e > 0 ? b.x + b.w / 2 : -Infinity, b.z - b.d / 2, b.z + b.d / 2, tall);
        box(0.14, tall - 4.6, 0.12, STRIP[LOOKS[f.id].strip], b.x + e * (b.w / 2 - gap), 4.4 + (tall - 4.6) / 2, fz + s * 0.08);
      }
    }
    if (f.id === 'mortymart') {
      // the red neon over the shopfront, on the model's blank board
      const neon = new THREE.MeshBasicMaterial({ map: tex(paintNeon('MORTY MART', '#ff3a4a', k)), color: hot(0xffffff, 1.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      mat(neon);
      const n = plane(f.width * 0.62, f.width * 0.62 * 0.25, neon, b.x - f.width * 0.03, sh * 0.76, fz + s * 0.35, Math.PI);
      hide.push(n);
      flicker.push({ m: neon, base: 1.8, rate: 2.3 });
      pools.push([b.x, fz + s * 3.5, 6, 0xff3a4a, 0.6]);
      lights.push([MART_DOOR.x, 3.4, MART_DOOR.z + s * 2.2, 0xd8ffe0], [b.x, sh * 0.7, fz + s * 3, 0xff3a4a]);
    } else {
      // the club's name in pink, on a blade sign out from its corner
      const neon = new THREE.MeshBasicMaterial({ map: tex(paintNeon('THE CREEPY MORTY', '#ff5ad2', k, { italic: true })), color: hot(0xffffff, 1.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
      mat(neon);
      const bx = b.x + f.width / 2 - 1;
      box(0.2, 8.4, 2.6, M.black, bx, 8.2, fz + s * 1.4);
      // its name down each face, read from the top (each face its own plane:
      // a plane's back would show it mirrored)
      for (const e of [-1, 1]) {
        const n = mesh(new THREE.PlaneGeometry(8, 2), neon);
        n.position.set(bx + e * 0.12, 8.2, fz + s * 1.4);
        n.rotation.set(0, (e * Math.PI) / 2, -Math.PI / 2);
        hide.push(n);
      }
      flicker.push({ m: neon, base: 1.8, rate: 1.7 });
      pools.push([CLUB_DOOR.x, CLUB_DOOR.z + s * 3, 6, 0xff5ad2, 0.6], [bx, fz + s * 4, 4, 0xa86aff, 0.4]);
      lights.push([CLUB_DOOR.x, 3, CLUB_DOOR.z + s * 2, 0xff4ad8], [bx, 7, fz + s * 3, 0xc070ff]);
    }
  }

  // ── the alleys: a wall at the dead end, bins, bags, a caged bulb, tags ──
  for (const [i, h] of HIDES.entries()) {
    const s = Math.sign(h.z); // (the dead end's side)
    box(4.2, 11, 0.4, M.trim, h.x, 5.5, s * (MORTYTOWN.z1 - 0.2));
    box(0.5, 0.35, 0.5, M.dark, h.x, 3.6, s * (MORTYTOWN.z1 - 0.6));
    mesh(new THREE.SphereGeometry(0.14, seg(10), seg(8)), M.amber).position.set(h.x, 3.35, s * (MORTYTOWN.z1 - 0.6));
    lights.push([h.x, 3.2, s * (MORTYTOWN.z1 - 1.6), 0xffb060]);
    // two tags on the alley's walls
    const tag = mat(new THREE.MeshBasicMaterial({ map: tex(paintGraffiti(k, 40 + i)), transparent: true, depthWrite: false, alphaTest: 0.02 }));
    for (const e of [-1, 1]) {
      const t = plane(4.4, 2.2, tag, h.x + e * 1.98, 1.9, h.z - s * (4 + i), e > 0 ? -Math.PI / 2 : Math.PI / 2);
      hide.push(t);
    }
    // bags of rubbish at the dead end
    for (let j = 0; j < 4; j++) {
      const bag = mesh(new THREE.SphereGeometry(0.4, seg(10), seg(8)), M.bag);
      bag.scale.set(1, 0.75, 0.9);
      bag.position.set(h.x + (j % 2 ? 1.2 : -1.3) + (j > 1 ? 0.2 : 0), 0.3, s * (MORTYTOWN.z1 - 0.8 - j * 0.35));
    }
  }
  // lamps on the walls half way down each alley, and up the side street
  const wallLamp = (x, z, e) => {
    box(0.5, 0.08, 0.08, M.dark, x + e * 0.25, 4.2, z);
    const bulb = mesh(new THREE.SphereGeometry(0.16, seg(10), seg(8)), M.amber);
    bulb.position.set(x + e * 0.5, 4.05, z);
    lights.push([x + e * 1.2, 3.6, z, 0xffbe70]);
    pools.push([x + e * 1.4, z, 2.6, 0xffbe70, 0.4]);
  };
  for (const h of HIDES) wallLamp(h.x - 2, Math.sign(h.z) * 18, 1);
  wallLamp(-12, -15, 1);
  wallLamp(-4, -23, -1);

  // Big Morty's stool and his little table, by the club's door
  {
    const bm = { x: -19.2, z: -8.4, face: -Math.PI / 2 + 0.4 };
    const back = [-Math.cos(bm.face) * 0.12, Math.sin(bm.face) * 0.12];
    cyl(0.24, 0.2, 0.44, M.dark, bm.x + back[0], 0.22, bm.z + back[1], { n: 14 });
    mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.06, seg(16)), M.rust).position.set(bm.x + back[0], 0.46, bm.z + back[1]);
    const ahead = [Math.cos(bm.face) * 0.75, -Math.sin(bm.face) * 0.75];
    cyl(0.05, 0.08, 0.72, M.dark, bm.x + ahead[0], 0.36, bm.z + ahead[1], { n: 8 });
    cyl(0.42, 0.42, 0.05, M.metal, bm.x + ahead[0], 0.74, bm.z + ahead[1], { n: 18 });
    lights.push([bm.x, 2.6, bm.z + 0.6, 0xff6ad8]);
  }

  for (const [i, b] of BINS.entries()) {
    box(b.w, 1.05, b.d, i % 2 ? M.binB : M.bin, b.x, 0.62, b.z, b.turn);
    const lid = box(b.w + 0.06, 0.08, b.d + 0.08, M.lid, b.x, 1.18, b.z, b.turn);
    lid.rotation.z = 0.08;
    for (const [a, c] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) {
      const cx = b.x + Math.cos(b.turn) * a * (b.w / 1.7) + Math.sin(b.turn) * c;
      const cz = b.z - Math.sin(b.turn) * a * (b.w / 1.7) + Math.cos(b.turn) * c;
      cyl(0.09, 0.09, 0.06, M.dark, cx, 0.09, cz, { n: 8, axis: 'x' });
    }
  }

  // ── the side street: Simple Rick's loading dock ──
  {
    const z = FACTORY_BACK.z;
    box(8, 16, 0.6, mat(toon(0xd8c9a0)), FACTORY_BACK.x, 8, z - 0.1);
    box(8.4, 0.6, 1, mat(toon(0x7a4a1e)), FACTORY_BACK.x, 16, z);
    // the roller door, half up, warm light under it
    box(4.6, 2.2, 0.2, M.metal, FACTORY_BACK.x, 3.3, z + 0.3);
    plane(4.4, 2.2, M.warm, FACTORY_BACK.x, 1.1, z + 0.22);
    box(5.2, 0.4, 0.5, mat(toon(0x7a4a1e)), FACTORY_BACK.x, 4.6, z + 0.35);
    plane(5, 1.05, mat(new THREE.MeshBasicMaterial({ map: tex(paintPlate('SIMPLE RICK’S · DELIVERIES', '#f6e7c8', '#7a4a1e', k)) })), FACTORY_BACK.x, 5.6, z + 0.25);
    lights.push([FACTORY_BACK.x, 3, z + 2.5, C.warm]);
    pools.push([FACTORY_BACK.x, z + 2.5, 4, C.warm, 0.5]);
    // crates of wafers, stacked
    const r = rnd(5);
    for (let i = 0; i < 7; i++) {
      const x = FACTORY_BACK.x + (i < 4 ? 2.9 : -2.9) + (r() - 0.5) * 0.3;
      const y = 0.4 + (i % 4 === 3 ? 0.8 : 0) + (i > 4 ? 0.8 : 0);
      const zz = z + 1.2 + (i % 3) * 0.85;
      box(0.8, 0.8, 0.8, i % 2 ? M.cream : M.wafer, x, y, zz, (r() - 0.5) * 0.3);
    }
  }

  // hazard stripes, at the lift and the gate
  const stripes = mat(toon(0xffffff, { map: tex(paintStripes(k)) }));

  // ── the lift up to the concourse, at the west end ──
  {
    const x = LIFT.x;
    box(LIFT.w, 4, LIFT.d, M.dark, x, 2, LIFT.z);
    for (const e of [-1, 1]) box(0.4, 4.4, 0.4, stripes, x + 1.05, 2.2, LIFT.z + e * 1.9);
    box(0.4, 0.5, 4.2, stripes, x + 1.05, 4.4, LIFT.z);
    // its doors, shut, a strip of cyan glass down each
    for (const e of [-1, 1]) {
      box(0.1, 3.6, 1.6, M.metal, x + 1.02, 1.85, LIFT.z + e * 0.82);
      box(0.12, 2.8, 0.14, M.cyan, x + 1.05, 1.9, LIFT.z + e * 0.3);
    }
    plane(3.2, 0.8, mat(new THREE.MeshBasicMaterial({ map: tex(paintPlate('LIFT · CONCOURSE ↑', '#14402a', '#c8ffd0', k)) })), x + 1.08, 5.1, LIFT.z, Math.PI / 2);
    // the shaft, up out of sight
    box(3, 70, 6.4, M.trim, x - 1.2, 39, LIFT.z);
    for (const e of [-1, 1]) box(0.16, 66, 0.16, M.cyan, x + 0.32, 40, LIFT.z + e * 3.1);
    lights.push([x + 3, 3.5, LIFT.z, C.cyan]);
    pools.push([x + 3, LIFT.z, 4, C.cyan, 0.5]);
    // the end walls either side of it, hazard-striped at their feet
    for (const e of [-1, 1]) {
      box(0.6, 9, 7.2, M.trim, MORTYTOWN.x0 - 0.3, 4.5, e * 6.3);
      box(0.1, 1.2, 7.2, stripes, MORTYTOWN.x0 + 0.02, 0.6, e * 6.3);
    }
  }

  // ── the east end: a blast gate, shut, and a bridge over it ──
  {
    const x = MORTYTOWN.x1;
    box(0.8, 12, 20, M.trim, x + 0.4, 6, 0);
    box(0.3, 9, 13, M.metal, x - 0.1, 4.5, 0);
    box(0.32, 1.2, 13, stripes, x - 0.12, 0.6, 0);
    box(0.32, 0.12, 13, M.red, x - 0.14, 8.6, 0);
    plane(6, 1.2, mat(new THREE.MeshBasicMaterial({ map: tex(paintPlate('SECTOR 9 · CLOSED', '#20242c', '#ffd23a', k)) })), x - 0.3, 10.1, 0, -Math.PI / 2);
    box(6, 3, 24, M.trim, x - 3, 15, 0);
    box(6.1, 0.2, 24, M.cyan, x - 3, 13.4, 0);
    lights.push([x - 3, 6, 0, C.red]);
  }

  // ── the lamps along the kerbs: posts, arms and cyan-white heads ──
  {
    const n = LAMPS.length;
    const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.13, 5.2, seg(8)), M.dark, n);
    const arm = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.1, 0.1), M.dark, n);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.16, 0.36), M.lamp, n);
    const o = new THREE.Object3D();
    LAMPS.forEach(([x, z], i) => {
      const s = z < 0 ? 1 : -1; // (they lean out over the road)
      o.rotation.set(0, 0, 0);
      o.position.set(x, 2.6, z);
      o.updateMatrix();
      post.setMatrixAt(i, o.matrix);
      o.position.set(x, 5.15, z + s * 0.6);
      o.rotation.y = Math.PI / 2;
      o.updateMatrix();
      arm.setMatrixAt(i, o.matrix);
      o.position.set(x, 5.05, z + s * 1.25);
      o.updateMatrix();
      head.setMatrixAt(i, o.matrix);
      lights.push([x, 4.6, z + s * 1.3, 0xcff4ff]);
      pools.push([x, z + s * 1.4, 2.6, 0xbfefff, 0.35]);
    });
    group.add(post, arm, head);
  }

  // ── Cop Morty's cruiser at the kerb: a hovering black-and-white with its
  // light bar going ──
  const lightbar = [];
  {
    const car = new THREE.Group();
    car.position.set(CRUISER.x, 0, CRUISER.z);
    car.rotation.y = CRUISER.turn;
    group.add(car);
    moving.push(car);
    const rounded = (w, h, dd) => {
      const g = new THREE.CapsuleGeometry(h / 2, w - h, seg(4), seg(12));
      g.rotateZ(Math.PI / 2);
      g.scale(1, 1, dd / h);
      return g;
    };
    const lower = mesh(rounded(4.6, 0.7, 2), M.black, car);
    lower.position.y = 0.75;
    const upper = mesh(rounded(4.2, 0.6, 1.9), M.white, car);
    upper.position.y = 1.15;
    const cab = mesh(new THREE.SphereGeometry(1, seg(18), seg(10), 0, Math.PI * 2, 0, Math.PI / 2), mat(toon(0x223038)));
    cab.scale.set(1.25, 0.62, 0.86);
    cab.position.set(-0.3, 1.32, 0);
    car.add(cab);
    for (const e of [-1, 1]) {
      const plate = plane(1.6, 0.36, mat(new THREE.MeshBasicMaterial({ map: tex(paintPlate('POLICE', '#e8ece6', '#1a1d20', k, { w: 256, h: 64 })) })), 0.3, 1.0, e * 1.0, e > 0 ? 0 : Math.PI, car);
      void plate;
      // hover pads, glowing under it
      for (const a of [-1.5, 1.5]) {
        const pad = mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.18, seg(14)), M.dark, car);
        pad.position.set(a, 0.35, e * 0.75);
        const glow = mesh(new THREE.CircleGeometry(0.3, seg(14)), M.cyan, car);
        glow.rotation.x = Math.PI / 2;
        glow.position.set(a, 0.25, e * 0.75);
        hide.push(glow);
      }
    }
    // the bar, red and blue, each flashing in turn
    box(1.2, 0.12, 0.5, M.black, -0.2, 1.72, 0, 0, car);
    for (const [e, hex] of [[-1, C.red], [1, 0x3a7aff]]) {
      const m = new THREE.MeshBasicMaterial({ color: hot(hex, 2.6) });
      mat(m);
      const lamp = box(0.5, 0.18, 0.4, m, -0.2 + e * 0.3, 1.86, 0, 0, car);
      hide.push(lamp);
      lightbar.push({ m, hex, e });
    }
    pools.push([CRUISER.x, CRUISER.z, 3.2, 0x6ff3ff, 0.3]);
  }

  // ── over the street: skybridges between the blocks, and pipes across ──
  {
    for (const [x, y, w] of [[-30, 21, 5], [24, 27, 4]]) {
      box(w, 3.2, 20.4, M.trim, x, y, 0);
      box(w + 0.2, 0.3, 20.6, M.dark, x, y - 1.7, 0);
      for (const e of [-1, 1]) box(0.08, 0.9, 20, M.amber, x + e * (w / 2 + 0.02), y + 0.2, 0);
    }
    for (const [x, y, r] of [[-4, 15.5, 0.55], [-2.6, 16.2, 0.32], [46, 13.5, 0.7]]) cyl(r, r, 20.4, M.rust, x, y, 0, { n: 14, axis: 'z' });
  }

  // ── behind the roofs: taller blocks, then the Citadel's towers ──
  const towers = new THREE.Group();
  group.add(towers);
  {
    const r = rnd(77);
    const winMap = tex(paintWindows(), { wrap: true });
    const winGlow = tex(paintWindowGlow(), { wrap: true });
    const towerMat = mat(toon(0xffffff, { map: winMap, emissiveMap: winGlow, emissive: hot(0xffffff, 0.5), vertexColors: true }));
    const colour = new THREE.Color();
    const piece = (geo, hex) => {
      const pos = geo.attributes.position;
      colour.set(hex);
      const cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) cols.set([colour.r, colour.g, colour.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      geo.computeBoundingBox();
      const s = geo.boundingBox.getSize(new THREE.Vector3());
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * Math.max(s.x, s.z)) / 9, (uv.getY(i) * s.y) / 9);
      return geo;
    };
    const geos = [];
    // the next row back: a wall of taller blocks behind each side of the street
    for (const side of [-1, 1]) {
      for (let x = MORTYTOWN.x0 - 10; x < MORTYTOWN.x1 + 10; ) {
        const w = 10 + r() * 12;
        const h = 18 + r() * 26;
        const g = piece(new THREE.BoxGeometry(w, h, 14), TOWERS[Math.floor(r() * TOWERS.length)]);
        g.translate(x + w / 2, h / 2, side * (MORTYTOWN.z1 + 8 + r() * 4));
        geos.push(g);
        x += w + 1 + r() * 3;
      }
    }
    // and the towers, all round, tall and pale in the haze
    const count = { low: 18, mid: 34, high: 56, ultra: 80 }[lvl] ?? 40;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + r() * 0.1;
      const rad = 95 + r() * 160;
      const x = Math.cos(a) * rad * 1.3;
      const z = Math.sin(a) * rad;
      const h = 60 + r() * 170;
      const w = 12 + r() * 20;
      const kind = r();
      const hex = TOWERS[Math.floor(r() * TOWERS.length)];
      if (kind < 0.35) geos.push(piece(new THREE.CylinderGeometry(w / 2, w / 2, h, seg(20), 1), hex).translate(x, h / 2 - 20, z));
      else if (kind < 0.7) geos.push(piece(new THREE.BoxGeometry(w, h, w * 0.5), hex).rotateY(r() * Math.PI).translate(x, h / 2 - 20, z));
      else {
        let y = -20;
        let ww = w;
        for (const f of [0.55, 0.3, 0.15]) {
          geos.push(piece(new THREE.BoxGeometry(ww, h * f, ww * 0.8), hex).translate(x, y + (h * f) / 2, z));
          y += h * f;
          ww *= 0.7;
        }
      }
      // a lit strip up a third of them
      if (i % 3 === 0) {
        const strip = mesh(new THREE.BoxGeometry(0.6, h * 0.8, 0.6), i % 2 ? M.cyan : M.green, towers);
        strip.position.set(x + w / 2 + 0.3, h * 0.4 - 10, z);
      }
    }
    const merged = mergeAll(geos);
    if (merged) towers.add(new THREE.Mesh(merged, towerMat));
    for (const g of geos) g.dispose();
  }

  // ── the sky: the Citadel's, the dome's ribs on its amber ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(470, 48, 24),
    mat(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uRed: { value: 0 } },
        vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: SKY_FRAG,
      }),
    ),
  );
  sky.renderOrder = -10;
  group.add(sky);
  hide.push(sky);

  // ── what moves: dust in the air, steam from the vents ──
  const motes = (() => {
    const n = { low: 0, mid: 160, high: 320, ultra: 520 }[lvl] ?? 200;
    if (!n) return null;
    const r = rnd(9);
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos.set([MORTYTOWN.x0 + r() * W, 0.5 + r() * 9, MORTYTOWN.z0 + 8 + r() * (D - 16)], i * 3);
      seed[i] = r() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = mat(new THREE.PointsMaterial({ color: 0xffe6b0, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    const p = new THREE.Points(geo, m);
    group.add(p);
    hide.push(p);
    return { p, pos, seed, base: pos.slice() };
  })();
  const steam = (() => {
    const vents = [[-41, -2.5], [-6, 2.4], [24, -2.2], [47, 2.6], ...HIDES.map((h) => [h.x + 1.3, Math.sign(h.z) * (MORTYTOWN.z1 - 1.4)])];
    const per = { low: 0, mid: 10, high: 16, ultra: 24 }[lvl] ?? 12;
    if (!per) return null;
    const n = vents.length * per;
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = mat(new THREE.PointsMaterial({ color: 0xd8d0c0, size: 1.1, transparent: true, opacity: 0.16, depthWrite: false }));
    const p = new THREE.Points(geo, m);
    group.add(p);
    hide.push(p);
    return { p, pos, vents, per };
  })();

  // the neon's pools on the street, now they're all known
  floorMat.emissiveMap = tex(paintStreetGlow(k, pools));
  floorMat.needsUpdate = true;

  // everything that never moves, merged by material (and the merged neon,
  // tags and glows kept off the ink line, as the pieces were)
  for (const o of hide) if (o.material) unlined.add(o.material);
  const baked = bake(statics, moving);
  statics.add(baked);
  baked.traverse((o) => {
    if (o.isMesh && unlined.has(o.material)) hide.push(o);
  });

  // ── a frame ──
  let red = 0;
  const update = (t, dt) => {
    for (const f of flicker) {
      // a hum, and now and then a stutter
      const s = Math.sin(t * f.rate * 7.1) * Math.sin(t * f.rate * 3.3);
      const off = s > 0.96 ? 0.25 : 1;
      f.m.color.setScalar(f.base * off * (0.94 + 0.06 * Math.sin(t * 50 + f.rate)));
    }
    const phase = Math.floor(t * 3.2) % 2;
    for (const l of lightbar) l.m.color.set(l.hex).multiplyScalar(((l.e > 0) === (phase === 1) ? 2.8 : 0.35) + red * 0.4);
    if (motes) {
      const { pos, seed, base } = motes;
      for (let i = 0; i < seed.length; i++) {
        const s = seed[i];
        pos[i * 3] = base[i * 3] + Math.sin(t * 0.13 + s) * 1.6;
        pos[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.21 + s * 1.7) * 0.6;
        pos[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.11 + s) * 1.2;
      }
      motes.p.geometry.attributes.position.needsUpdate = true;
    }
    if (steam) {
      const { pos, vents, per } = steam;
      vents.forEach(([x, z], v) => {
        for (let j = 0; j < per; j++) {
          const life = ((t * 0.32 + j / per + v * 0.13) % 1 + 1) % 1;
          const i = (v * per + j) * 3;
          pos[i] = x + Math.sin(j * 2.3 + t * 0.7) * life * 0.9;
          pos[i + 1] = 0.2 + life * 4.2;
          pos[i + 2] = z + Math.cos(j * 1.7 + t * 0.5) * life * 0.7;
        }
      });
      steam.p.geometry.attributes.position.needsUpdate = true;
    }
    void dt;
  };
  const setMood = (mood) => {
    red = mood === 'red' ? 1 : 0;
    sky.material.uniforms.uRed.value = red;
  };

  const dispose = () => {
    group.traverse((o) => {
      if (o.userData?.shared) return;
      o.geometry?.dispose?.();
    });
    for (const o of owned) o.dispose?.();
    props.dispose();
    group.removeFromParent();
  };

  return { group, floor, hide, lights, update, setMood, dispose };
}

// many geometries with the same attributes as one
function mergeAll(geos) {
  if (!geos.length) return null;
  const keep = ['position', 'normal', 'uv', 'color'];
  const parts = geos.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(n.attributes)) if (!keep.includes(name)) n.deleteAttribute(name);
    return n;
  });
  let count = 0;
  for (const p of parts) count += p.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of keep) {
    const size = parts[0].attributes[name]?.itemSize;
    if (!size) continue;
    const arr = new Float32Array(count * size);
    let at = 0;
    for (const p of parts) {
      arr.set(p.attributes[name].array, at);
      at += p.attributes[name].array.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const p of parts) if (!geos.includes(p)) p.dispose();
  out.computeBoundingSphere();
  return out;
}
