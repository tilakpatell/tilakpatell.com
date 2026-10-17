// Smash Run's models: Midtown in 2012 at sunset, built from code. Wrecked
// cars (sedans, taxis, police cars, SUVs) as parts for instanced pools, the
// Chitauri's energy walls, scorched craters, the avenue's paint, blocks of
// brick walk-ups, limestone and glass with their storefronts, fire escapes and
// water towers, the warning a chariot paints down a lane, and Stark Tower with
// the Tesseract's beam going up into the portal.

import * as THREE from 'three';
import { hot } from '../hq/stage';
import { pbr } from '../hq/assets';
import { rng } from '../hq/rng';
import { PartBuilder, canvasTexture, rbox, taper } from '../hq/kit/shapes';
import { sharpen } from '../../../lib/three/textures';

// The avenue, in metres. The roadway runs from -half to half (three lanes in
// the middle, a parking lane each side of the edge lines), then 5 m of
// sidewalk to the building line. Blocks repeat every `block` metres: the
// sidewalk for `walk`, the buildings on it for `built`, then a cross street.
export const STREET = { half: 7, edge: 4.8, walk: 5, kerb: 0.15, block: 80, built: 62, corner: 64 };

// ── helpers ──

// A box whose texture coordinates are in metres (over `tile`), so a brick or
// paving texture keeps its size on any face.
export function meterBox(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // faces in order: +x, -x (d × h), +y, -y (w × d), +z, -z (w × h)
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
  return g;
}

// Squeeze a geometry's texture coordinates into one cell of an atlas.
function remapUV(geo, [u0, v0, u1, v1]) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + Math.min(1, Math.max(0, uv.getX(i))) * (u1 - u0), v0 + Math.min(1, Math.max(0, uv.getY(i))) * (v1 - v0));
  return geo;
}

// Flat quads, each showing one atlas cell: windows, shop fronts, signs. Far
// cheaper to make by the thousand than meshes.
class Quads {
  constructor() {
    this.p = [];
    this.n = [];
    this.uv = [];
  }
  // centre c, `right` and `up` unit vectors, w × h, atlas cell [u0, v0, u1, v1]
  add(c, right, up, w, h, [u0, v0, u1, v1]) {
    const nx = right[1] * up[2] - right[2] * up[1];
    const ny = right[2] * up[0] - right[0] * up[2];
    const nz = right[0] * up[1] - right[1] * up[0];
    const corner = (sr, su) => [c[0] + right[0] * sr * w * 0.5 + up[0] * su * h * 0.5, c[1] + right[1] * sr * w * 0.5 + up[1] * su * h * 0.5, c[2] + right[2] * sr * w * 0.5 + up[2] * su * h * 0.5];
    const a = corner(-1, -1);
    const b = corner(1, -1);
    const cc = corner(1, 1);
    const d = corner(-1, 1);
    for (const [p, u, v] of [
      [a, u0, v0],
      [b, u1, v0],
      [cc, u1, v1],
      [a, u0, v0],
      [cc, u1, v1],
      [d, u0, v1],
    ]) {
      this.p.push(...p);
      this.n.push(nx, ny, nz);
      this.uv.push(u, v);
    }
  }
  // on a wall facing +x (face 1) or -x (face -1); w along z
  x(x, y, z, w, h, cell, face = 1) {
    this.add([x, y, z], [0, 0, -face], [0, 1, 0], w, h, cell);
  }
  // on a wall facing +z (face 1) or -z (face -1); w along x
  z(x, y, z, w, h, cell, face = 1) {
    this.add([x, y, z], [face, 0, 0], [0, 1, 0], w, h, cell);
  }
  get empty() {
    return this.p.length === 0;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return g;
  }
}

// ── the facade atlas ──
// Every window, shop front, door, sign, awning and traffic light on the
// avenue is one cell of this: 8 × 8 cells, painted once, with an emissive
// copy (lit windows, shops and signs at dusk) and a roughness/metal copy
// (glass smooth, frames rough).
const CELLS = 8;
export const CELL = {
  brick: 0, // sash windows in brick: 0–3 dark, 4–7 lit
  stone: 1, // bronze-framed windows in limestone: 0–3 dark, 4–7 lit
  curtain: 2, // a glass tower's floor, one 3 m bay: 0–3 dark, 4–7 lit
  shop: 3, // shop windows: 0–6 lit, 7 closed
  door: 4, // 0–1 glass doors, 2 a wooden door, 3 a lobby; 4–6 roll-down shutters, 7 a loading door
  sign: 5, // shop signs in eight colours
  awning: 6, // awning fabric in eight colours
  misc: 7, // 0 louvres, 1 a red signal, 2 a green signal, 3 the hand, 4–7 posters
};
export const cellUV = (col, row, size = 1024) => {
  const pad = 3 / size;
  const u0 = col / CELLS + pad;
  const u1 = (col + 1) / CELLS - pad;
  const v1 = 1 - row / CELLS - pad;
  const v0 = 1 - (row + 1) / CELLS + pad;
  return [u0, v0, u1, v1];
};

export function facadeAtlas({ size = 1024 } = {}) {
  const cs = size / CELLS;
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  };
  const canvases = { c: mk(), e: mk(), r: mk() };
  const ctx = { c: canvases.c.getContext('2d'), e: canvases.e.getContext('2d'), r: canvases.r.getContext('2d') };
  ctx.c.fillStyle = '#6a6460';
  ctx.c.fillRect(0, 0, size, size);
  ctx.e.fillStyle = '#000';
  ctx.e.fillRect(0, 0, size, size);
  ctx.r.fillStyle = 'rgb(255,160,0)';
  ctx.r.fillRect(0, 0, size, size);
  const r = rng(41);

  // A cell is painted three times (colour, emissive, roughness) by the same
  // drawing, in unit coordinates (0..1 across and down); `p(c, e, rough, metal)`
  // picks the fill for the layer being drawn.
  const paint = (col, row, draw) => {
    for (const layer of ['c', 'e', 'r']) {
      const x = ctx[layer];
      x.save();
      x.translate(col * cs, row * cs);
      x.beginPath();
      x.rect(0, 0, cs, cs);
      x.clip();
      x.scale(cs, cs);
      // p(...) and grad(...) set the fill and hand back something to draw with
      const box = { rect: (a, b, w, h) => x.fillRect(a, b, w, h) };
      const p = (c, e = '#000', rough = 0.6, metal = 0) => {
        x.fillStyle = layer === 'c' ? c : layer === 'e' ? e : `rgb(255,${Math.round(rough * 255)},${Math.round(metal * 255)})`;
        return box;
      };
      const grad = (y0, y1, stops, e = null, rough = 0.06, metal = 0) => {
        if (layer === 'r') return p('', '', rough, metal);
        const list = layer === 'e' ? e : stops;
        if (!list) {
          x.fillStyle = '#000';
          return box;
        }
        const g = x.createLinearGradient(0, y0, 0, y1);
        list.forEach((s, i) => g.addColorStop(i / Math.max(1, list.length - 1), s));
        x.fillStyle = g;
        return box;
      };
      draw({ x, p, grad, layer });
      x.restore();
    }
  };
  const rect = (x, a, b, w, h) => x.fillRect(a, b, w, h);

  // glass seen from the street at dusk: the sky in it, darker below
  const darkGlass = [
    ['#5d6d80', '#2a3440', '#1a2028'],
    ['#6b7380', '#343a44', '#1c2026'],
    ['#4f6274', '#25303b', '#151b22'],
    ['#7a7470', '#3a3634', '#1e1c1c'],
  ];
  const warm = ['#ffe2b0', '#f2b26a', '#c97a3e'];
  const warmE = ['#ffd49a', '#e8a058', '#a8642e'];
  const cool = ['#d8e6ff', '#9fb8e8', '#6a82b8'];
  const coolE = ['#c8dcff', '#8aa6dc', '#5872a8'];

  // a pane's contents: blinds, curtains, an air conditioner, a lamp
  const extras = (x, p, kind, a, b, w, h, lit) => {
    if (kind === 1) {
      // blinds, half down
      for (let i = 0; i < 9; i++) p(lit ? '#f4e2c0' : '#b9b2a2', lit ? '#c8a878' : '#000', 0.7).rect(a, b + i * h * 0.05, w, h * 0.028);
    } else if (kind === 2) {
      // curtains drawn to the sides
      p(lit ? '#c4744a' : '#6e5a48', lit ? '#7a3a1e' : '#000', 0.9);
      rect(x, a, b, w * 0.22, h);
      rect(x, a + w * 0.78, b, w * 0.22, h);
    } else if (kind === 3) {
      // a window air conditioner in the lower sash
      p('#a7abae', '#000', 0.5, 0.3).rect(a + w * 0.15, b + h * 0.55, w * 0.7, h * 0.4);
      for (let i = 0; i < 5; i++) p('#6d7276', '#000', 0.6).rect(a + w * 0.2, b + h * (0.6 + i * 0.07), w * 0.6, h * 0.02);
    }
  };

  // row 0: sash windows in brick, a stone lintel and sill
  for (let i = 0; i < 8; i++) {
    const lit = i >= 4;
    const kind = i % 4;
    const glass = darkGlass[i % 4];
    paint(i, CELL.brick, ({ x, p, grad }) => {
      p('#7a3a2c', '#000', 0.9).rect(0, 0, 1, 1); // brick round it
      p('#c3b8a2', '#000', 0.8).rect(0.02, 0, 0.96, 0.1); // lintel
      p('#bdb29c', '#000', 0.8).rect(0.02, 0.9, 0.96, 0.08); // sill
      p('#2a2420', '#000', 0.9).rect(0.08, 0.1, 0.84, 0.8); // the reveal's shadow
      p('#e4ddcd', '#000', 0.55).rect(0.12, 0.13, 0.76, 0.76); // the frame
      for (const [y0, y1] of [
        [0.17, 0.49],
        [0.53, 0.85],
      ]) {
        grad(y0, y1, lit ? warm : glass, lit ? warmE : null, 0.05).rect(0.17, y0, 0.66, y1 - y0);
        extras(x, p, y0 < 0.3 && kind === 1 ? 1 : kind === 2 ? 2 : y0 > 0.3 && kind === 3 ? 3 : 0, 0.17, y0, 0.66, y1 - y0, lit);
      }
      if (lit && kind === 0) p('#5a3a28', '#2a1408', 0.8).rect(0.42, 0.62, 0.14, 0.23); // a lamp's shade
      p('#e4ddcd', '#000', 0.55).rect(0.12, 0.49, 0.76, 0.04); // meeting rail
    });
  }
  // row 1: tall windows in limestone, bronze frames with a transom
  for (let i = 0; i < 8; i++) {
    const lit = i >= 4;
    const kind = i % 4;
    paint(i, CELL.stone, ({ x, p, grad }) => {
      p('#c9bea6', '#000', 0.85).rect(0, 0, 1, 1);
      p('#b7ab92', '#000', 0.85).rect(0, 0.92, 1, 0.08);
      p('#3a3128', '#000', 0.45, 0.6).rect(0.1, 0.06, 0.8, 0.84);
      grad(0.1, 0.3, lit ? (i === 6 ? cool : warm) : darkGlass[(i + 1) % 4], lit ? (i === 6 ? coolE : warmE) : null, 0.04).rect(0.14, 0.1, 0.72, 0.18);
      grad(0.32, 0.86, lit ? (i === 6 ? cool : warm) : darkGlass[i % 4], lit ? (i === 6 ? coolE : warmE) : null, 0.04).rect(0.14, 0.32, 0.72, 0.54);
      extras(x, p, kind === 1 ? 1 : kind === 2 ? 2 : 0, 0.14, 0.32, 0.72, 0.54, lit);
      p('#3a3128', '#000', 0.45, 0.6).rect(0.48, 0.32, 0.04, 0.54);
    });
  }
  // row 2: a glass tower's floor: vision glass over a spandrel, mullions
  for (let i = 0; i < 8; i++) {
    const lit = i >= 4;
    const tint = [
      ['#4f7084', '#2c4656', '#1a2c38'],
      ['#5a6a78', '#303c48', '#1b232c'],
      ['#577a7a', '#2c4a4c', '#18292b'],
      ['#6e7c8c', '#3c4856', '#222a34'],
    ][i % 4];
    paint(i, CELL.curtain, ({ x, p, grad }) => {
      grad(0, 0.74, lit ? ['#eef4fb', '#cfdcec', '#9fb2c8'] : tint, lit ? ['#e2ecf8', '#b4c6dc', '#7c90aa'] : null, 0.03, 0.2).rect(0, 0, 1, 0.74);
      if (lit) {
        // ceiling lights, desks and a partition
        for (let k = 0; k < 4; k++) p('#ffffff', '#ffffff', 0.1).rect(0.05 + k * 0.25, 0.04, 0.16, 0.025);
        p('#6a7480', '#1a2028', 0.6).rect(0, 0.56, 1, 0.18);
        if (i % 2) p('#4a5460', '#101418', 0.6).rect(0.62, 0.2, 0.05, 0.54);
      } else {
        // a sheen across the glass
        x.globalAlpha = 0.18;
        p('#ffffff', '#000', 0.03, 0.2);
        x.beginPath();
        x.moveTo(0.1 + i * 0.1, 0);
        x.lineTo(0.35 + i * 0.1, 0);
        x.lineTo(0.05 + i * 0.1, 0.74);
        x.lineTo(-0.2 + i * 0.1, 0.74);
        x.fill();
        x.globalAlpha = 1;
      }
      p('#1d2830', '#000', 0.2, 0.3).rect(0, 0.74, 1, 0.26); // spandrel
      p('#8a9198', '#000', 0.35, 0.85);
      rect(x, 0, 0, 0.025, 1);
      rect(x, 0.4875, 0, 0.025, 1);
      rect(x, 0, 0.73, 1, 0.025);
    });
  }
  // row 3: shop windows, lit, with something in them
  const shopTints = [
    ['#fff3d6', '#f0cf8e'], // deli
    ['#fdf6ee', '#e8d6c2'], // clothes
    ['#f4fbff', '#cfe6f0'], // pharmacy
    ['#ffb08a', '#b8403a'], // bar
    ['#fff0c8', '#e6b66a'], // diner
    ['#e2ecff', '#a8bce0'], // bank
    ['#cfe0ff', '#6c8ad0'], // electronics
  ];
  for (let i = 0; i < 8; i++) {
    const lit = i < 7;
    paint(i, CELL.shop, ({ x, p, grad, layer }) => {
      p('#1b1c1e', '#000', 0.4, 0.7).rect(0, 0, 1, 1);
      const [a, b] = lit ? shopTints[i] : ['#3a434e', '#151a20'];
      grad(0.06, 0.94, lit ? [a, b] : [a, b], lit ? [a, b] : null, 0.05).rect(0.04, 0.06, 0.92, 0.84);
      if (!lit) return;
      const dim = layer === 'e' ? 0.55 : 1;
      x.globalAlpha = dim;
      if (i === 0 || i === 4) {
        // shelves of colourful things, or a counter and stools
        const cols = ['#c8402a', '#e2a12a', '#5c9a3a', '#e8d24a', '#a83a6a'];
        for (let s = 0; s < 3; s++) {
          p('#5a4a3a', '#2a1a0e', 0.7).rect(0.06, 0.4 + s * 0.17, 0.88, 0.02);
          for (let k = 0; k < 11; k++) p(cols[(k + s + i) % 5], cols[(k + s) % 5], 0.7).rect(0.08 + k * 0.08, 0.32 + s * 0.17, 0.06, 0.08);
        }
      } else if (i === 1) {
        // mannequins
        for (let k = 0; k < 3; k++) {
          p(['#2a2a2e', '#8a2a2a', '#d8d0c0'][k], '#3a3028', 0.7);
          x.beginPath();
          x.ellipse(0.22 + k * 0.28, 0.6, 0.07, 0.2, 0, 0, Math.PI * 2);
          x.fill();
          p('#e8dccc', '#806a50', 0.6);
          x.beginPath();
          x.arc(0.22 + k * 0.28, 0.33, 0.045, 0, Math.PI * 2);
          x.fill();
        }
      } else if (i === 2) {
        for (let s = 0; s < 4; s++) p('#ffffff', '#d8e8f0', 0.5).rect(0.06, 0.25 + s * 0.17, 0.88, 0.035);
        p('#2a8a4a', '#10a050', 0.4).rect(0.38, 0.1, 0.24, 0.08);
      } else if (i === 3) {
        // a neon script and the bar's warm dark
        p('#ff4a9a', '#ff4a9a', 0.3).rect(0.25, 0.22, 0.5, 0.05);
        p('#ffd24a', '#ffd24a', 0.3).rect(0.3, 0.32, 0.4, 0.04);
        p('#2a0e0e', '#000', 0.8).rect(0.04, 0.7, 0.92, 0.2);
      } else if (i === 5) {
        p('#9aa8bc', '#2a3446', 0.4).rect(0.2, 0.55, 0.6, 0.3);
      } else if (i === 6) {
        for (let k = 0; k < 4; k++) p('#3ad0ff', '#3ad0ff', 0.2).rect(0.08 + k * 0.22, 0.3, 0.18, 0.12);
      }
      x.globalAlpha = 1;
      p('#1b1c1e', '#000', 0.4, 0.7);
      rect(x, 0.33, 0.06, 0.02, 0.84);
      rect(x, 0.66, 0.06, 0.02, 0.84);
      // a shop's light is softer than its colours: dim the glow
      if (layer === 'e') {
        x.fillStyle = 'rgba(0,0,0,0.5)';
        x.fillRect(0, 0, 1, 1);
      }
    });
  }
  // row 4: doors and shutters
  for (let i = 0; i < 8; i++) {
    paint(i, CELL.door, ({ x, p, grad }) => {
      if (i < 2 || i === 3) {
        const bronze = i === 3;
        p(bronze ? '#5a4630' : '#2a2c2e', '#000', 0.4, 0.8).rect(0, 0, 1, 1);
        grad(0.06, 0.94, i === 1 ? cool : warm, i === 1 ? coolE : warmE, 0.05).rect(0.1, 0.06, 0.8, 0.9);
        p(bronze ? '#c8a46a' : '#b8bcc0', '#000', 0.3, 0.9).rect(0.12, 0.52, 0.76, 0.03);
      } else if (i === 2) {
        p('#4a2e1e', '#000', 0.7).rect(0, 0, 1, 1);
        p('#3a2214', '#000', 0.7);
        rect(x, 0.12, 0.08, 0.76, 0.36);
        rect(x, 0.12, 0.52, 0.76, 0.4);
        p('#c8a46a', '#000', 0.3, 0.9).rect(0.78, 0.5, 0.06, 0.04);
      } else {
        // a roll-down shutter, a little rust and a tag
        const base = ['#8d9196', '#7f8790', '#9a9890', '#5a5e64'][i - 4];
        p(base, '#000', 0.55, 0.6).rect(0, 0, 1, 1);
        for (let k = 0; k < 24; k++) p(k % 2 ? '#6a6e74' : '#a6aaae', '#000', 0.55, 0.6).rect(0, k / 24, 1, 0.012);
        p('#7a4a2a', '#000', 0.8).rect(0, 0.94, 1, 0.06);
        if (i === 5) p('#2a5a9a', '#000', 0.6).rect(0.2, 0.5, 0.5, 0.12);
      }
    });
  }
  // row 5: shop signs: a colour, and blocky letters (no names)
  const signs = [
    ['#b3261e', '#fff4e0'],
    ['#1f6b3a', '#f6f0d8'],
    ['#1d2d5c', '#ffd24a'],
    ['#151515', '#f0e6c8'],
    ['#ece8de', '#b3261e'],
    ['#e7b416', '#1b1b1b'],
    ['#6d1a2a', '#f4d6a0'],
    ['#11706f', '#ffffff'],
  ];
  for (let i = 0; i < 8; i++) {
    const [bg, fg] = signs[i];
    const letters = 5 + Math.floor(r() * 5);
    const widths = Array.from({ length: letters }, () => 0.5 + r() * 0.6);
    const lit = i % 3 !== 2;
    paint(i, CELL.sign, ({ p }) => {
      p(bg, '#000', 0.6).rect(0, 0, 1, 1);
      const total = widths.reduce((a, b) => a + b, 0) + letters * 0.25;
      let at = 0.5 - (total / 2) * 0.09;
      for (const w of widths) {
        p(fg, lit ? fg : '#000', 0.4).rect(at, 0.3, w * 0.09, 0.4);
        at += (w + 0.25) * 0.09;
      }
    });
  }
  // row 6: awning fabric
  const fabrics = [
    ['#a82020', null],
    ['#1f5a32', null],
    ['#1d2a50', null],
    ['#5a1626', null],
    ['#b82a24', '#efe6d6'],
    ['#2a6a3a', '#efe6d6'],
    ['#161616', null],
    ['#c8641c', '#f2e0c0'],
  ];
  for (let i = 0; i < 8; i++) {
    const [a, b] = fabrics[i];
    paint(i, CELL.awning, ({ p, grad }) => {
      p(a, '#000', 0.95).rect(0, 0, 1, 1);
      if (b) for (let k = 0; k < 8; k++) p(b, '#000', 0.95).rect(k / 8, 0, 1 / 16, 1);
      grad(0, 1, ['rgba(255,255,255,0.12)', 'rgba(0,0,0,0.25)'], null, 0.95).rect(0, 0, 1, 1);
    });
  }
  // row 7: louvres, the traffic lights, posters
  paint(0, CELL.misc, ({ p }) => {
    p('#5e6266', '#000', 0.6, 0.5).rect(0, 0, 1, 1);
    for (let k = 0; k < 12; k++) p('#3a3e42', '#000', 0.6, 0.5).rect(0, k / 12, 1, 0.03);
  });
  for (const [i, on] of [
    [1, 0],
    [2, 2],
  ]) {
    paint(i, CELL.misc, ({ x, p }) => {
      p('#c89a12', '#000', 0.5, 0.2).rect(0, 0, 1, 1); // the yellow housing
      for (let k = 0; k < 3; k++) {
        const c = ['#ff3a2a', '#ffb020', '#3aff8a'][k];
        p('#111', '#000', 0.4);
        x.beginPath();
        x.arc(0.5, 0.18 + k * 0.32, 0.13, 0, Math.PI * 2);
        x.fill();
        if (k === on) {
          p(c, c, 0.2);
          x.beginPath();
          x.arc(0.5, 0.18 + k * 0.32, 0.11, 0, Math.PI * 2);
          x.fill();
        } else {
          p('#2a2a28', '#000', 0.3);
          x.beginPath();
          x.arc(0.5, 0.18 + k * 0.32, 0.1, 0, Math.PI * 2);
          x.fill();
        }
      }
    });
  }
  paint(3, CELL.misc, ({ x, p }) => {
    p('#1a1a1a', '#000', 0.5).rect(0, 0, 1, 1);
    p('#ff7a1a', '#ff7a1a', 0.3);
    rect(x, 0.32, 0.25, 0.36, 0.42); // the raised hand
    rect(x, 0.3, 0.12, 0.08, 0.2);
    rect(x, 0.42, 0.08, 0.08, 0.2);
    rect(x, 0.54, 0.1, 0.08, 0.2);
  });
  for (let i = 4; i < 8; i++) {
    const hues = [
      ['#f2e6c8', '#c8302a', '#1a1a1a'],
      ['#1a2a5a', '#f2c43a', '#ffffff'],
      ['#e8e4dc', '#2a7a5a', '#c84a2a'],
      ['#2a1a1a', '#e85a8a', '#f2f2f2'],
    ][i - 4];
    const blocks = Array.from({ length: 4 }, () => [r() * 0.6, r() * 0.7, 0.2 + r() * 0.4, 0.1 + r() * 0.25]);
    paint(i, CELL.misc, ({ x, p }) => {
      p(hues[0], '#000', 0.7).rect(0, 0, 1, 1);
      blocks.forEach(([a, b, w, h], k) => p(hues[1 + (k % 2)], '#000', 0.7).rect(a, b, w, h));
      p('#d8d4cc', '#000', 0.6);
      rect(x, 0, 0, 1, 0.03);
      rect(x, 0, 0.97, 1, 0.03);
    });
  }

  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    sharpen(t);
    return t;
  };
  return { map: tex(canvases.c, true), emissiveMap: tex(canvases.e, true), roughnessMap: tex(canvases.r, false), size };
}

// ── the blocks ──

// The materials a block is made of (eight, so a block is eight draws):
// textured walls and paving, glass, iron, timber, and the atlas for
// everything on the walls.
export async function blockMaterials({ small = false, atlas } = {}) {
  const [sidewalk, brick, stone, base, iron, planks] = await Promise.all([
    pbr('sidewalk', { repeat: [1, 1], small, roughness: 0.85, metalness: 0, color: 0xc4c2bd }),
    pbr('brick', { repeat: [1, 1], small, roughness: 0.95, metalness: 0, color: 0xd8b8a8 }),
    pbr('concrete-wall', { repeat: [1, 1], small, roughness: 0.9, metalness: 0, color: 0xe2d4b8 }),
    pbr('concrete-worn', { repeat: [1, 1], small, roughness: 0.7, metalness: 0, color: 0x6a645c }),
    pbr('painted-metal', { repeat: [1, 1], small: true, roughness: 0.7, metalness: 0.6, color: 0x2a2c2e }),
    pbr('planks', { repeat: [1, 1], small: true, roughness: 0.9, metalness: 0, color: 0x8a6a4a }),
  ]);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x24323c, metalness: 0.3, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2 });
  const facade = new THREE.MeshStandardMaterial({
    map: atlas.map,
    emissiveMap: atlas.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 0.9,
    roughnessMap: atlas.roughnessMap,
    metalnessMap: atlas.roughnessMap,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1.3,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  return { sidewalk, brick, stone, base, iron, planks, glass, facade };
}

// texture tiling for each material, in metres per repeat
const TILE = { sidewalk: 2, brick: 2.4, stone: 3, base: 2, iron: 2, planks: 2 };

// What stands on a block: brick walk-ups with fire escapes, lofts, limestone
// prewar buildings stepped back at the top, and glass towers.
const KINDS = {
  walkup: { w: [7, 9.5], floors: [5, 7], floorH: 3.2, ground: 4.2, depth: 18, wall: ['brick'], win: CELL.brick, winW: 1.1, winH: 1.85, bay: 1.9 },
  loft: { w: [10, 14], floors: [8, 12], floorH: 3.6, ground: 4.6, depth: 22, wall: ['brick', 'stone'], win: CELL.stone, winW: 1.5, winH: 2.4, bay: 2.4 },
  prewar: { w: [14, 22], floors: [13, 22], floorH: 3.5, ground: 5.2, depth: 24, wall: ['stone'], win: CELL.stone, winW: 1.3, winH: 2.2, bay: 2.2 },
  tower: { w: [22, 30], floors: [28, 44], floorH: 4, ground: 7, depth: 26, wall: ['glass'], win: CELL.curtain, winW: 3, winH: 4, bay: 3 },
};
const pickWeighted = (r, list) => {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let k = r() * total;
  for (const [v, w] of list) if ((k -= w) <= 0) return v;
  return list[0][0];
};

// a step's cornice runs down the corner wall only when it's the street wall
const k0 = (s) => s.inset === 0;

// One side of one block, facing +x (the avenue): the kerb at x = 0, the
// building line at x = -5, from z = 0 (the corner nearest the run's start) to
// z = -STREET.corner. `size` is the atlas's, for its cells; `lite` draws it in
// fewer materials. Returns a group.
export function buildBlock(seed, mats, { size = 1024, lite = false } = {}) {
  const r = rng(seed);
  const B = new PartBuilder();
  const Q = new Quads();
  const cell = (col, row) => cellUV(col, row, size);
  const X = -STREET.walk; // the building line
  const Y = STREET.kerb; // the sidewalk's top
  const L = STREET.corner;
  // `lite` (phones): six materials, not eight; timber and granite go to iron and stone
  const LITE = { planks: 'iron', base: 'stone' };
  const add = (key, geo, place) => B.add(lite ? LITE[key] ?? key : key, geo, place);

  // the sidewalk, wrapping the corners down the cross streets, and its kerbs
  add('sidewalk', meterBox(30, Y, L, TILE.sidewalk), { p: [-15, Y / 2, -L / 2] });
  add('sidewalk', meterBox(0.3, Y + 0.01, L, TILE.sidewalk), { p: [-0.15, Y / 2, -L / 2] });
  for (const z of [-0.15, -L + 0.15]) add('sidewalk', meterBox(30, Y + 0.01, 0.3, TILE.sidewalk), { p: [-15, Y / 2, z] });

  // the buildings, along the block
  const plan = [];
  let z = -1;
  const end = -L + 1;
  let towers = 0;
  while (z > end + 0.5) {
    let kind = pickWeighted(r, [
      ['walkup', 0.36],
      ['loft', 0.2],
      ['prewar', 0.3],
      ['tower', towers ? 0 : 0.2],
    ]);
    const K = KINDS[kind];
    let w = K.w[0] + r() * (K.w[1] - K.w[0]);
    if (z - w < end + 6) w = z - end; // the last one takes what's left
    if (w > K.w[1] * 1.6) kind = w > 20 ? 'prewar' : 'loft';
    if (kind === 'tower') towers++;
    const floors = Math.round(KINDS[kind].floors[0] + r() * (KINDS[kind].floors[1] - KINDS[kind].floors[0]));
    plan.push({ kind, z0: z, z1: z - w, floors });
    z -= w;
  }
  const heightOf = (b) => (b ? KINDS[b.kind].ground + b.floors * KINDS[b.kind].floorH : 0);

  plan.forEach((bld, i) => {
    const K = KINDS[bld.kind];
    const { z0, z1, floors } = bld;
    const W = z0 - z1;
    const zc = (z0 + z1) / 2;
    const top = K.ground + floors * K.floorH;
    const wall = K.wall[Math.floor(r() * K.wall.length)];
    const depth = K.depth;
    const lit = bld.kind === 'tower' ? 0.42 : 0.3;
    const winCell = () => cell((r() < lit ? 4 : 0) + Math.floor(r() * 4), K.win);
    const corner0 = i === 0;
    const corner1 = i === plan.length - 1;
    const tall = (n) => heightOf(n) + 1; // windows on a side wall above its neighbour
    const sideFrom = [corner0 ? 0 : tall(plan[i - 1]), corner1 ? 0 : tall(plan[i + 1])];

    // setbacks: a prewar building's top steps back from the street
    const steps = [];
    if (bld.kind === 'prewar' && floors > 15) {
      const lower = floors - 4 - Math.floor(r() * 3);
      steps.push({ from: 0, to: lower, inset: 0 }, { from: lower, to: floors, inset: 3.5 });
    } else steps.push({ from: 0, to: floors, inset: 0 });

    for (const s of steps) {
      const y0 = s.from === 0 ? 0 : K.ground + s.from * K.floorH;
      const y1 = K.ground + s.to * K.floorH + (s.to === floors ? 1.1 : 0);
      const h = y1 - y0;
      const fx = X - s.inset;
      const bw = W - 0.04 - s.inset * (s.inset ? 0.8 : 0);
      add(wall, wall === 'glass' ? new THREE.BoxGeometry(depth - s.inset, h, bw) : meterBox(depth - s.inset, h, bw, TILE[wall]), { p: [fx - (depth - s.inset) / 2, Y + y0 + h / 2, zc] });
      // the windows on the front, floor by floor
      const bays = Math.max(1, Math.round(bw / K.bay));
      const bayW = bw / bays;
      for (let f = s.from; f < s.to; f++) {
        const y = Y + K.ground + f * K.floorH + K.floorH * 0.52;
        for (let b = 0; b < bays; b++) {
          const zb = zc + bw / 2 - (b + 0.5) * bayW;
          if (bld.kind === 'tower') Q.x(fx + 0.02, Y + K.ground + f * K.floorH + K.floorH / 2, zb, bayW, K.floorH, winCell());
          else Q.x(fx + 0.03, y, zb, Math.min(K.winW, bayW * 0.8), K.winH, winCell());
        }
      }
      // and on the side walls that can be seen: the corners, and above the neighbours
      const dBays = Math.max(1, Math.round((depth - s.inset) / K.bay));
      const dW = (depth - s.inset) / dBays;
      for (const [k, zs, face] of [
        [0, zc + bw / 2, 1],
        [1, zc - bw / 2, -1],
      ]) {
        // party walls of brick buildings stay blank unless on the corner
        if (bld.kind !== 'tower' && bld.kind !== 'prewar' && sideFrom[k] > 0) continue;
        for (let f = s.from; f < s.to; f++) {
          const yb = K.ground + f * K.floorH;
          if (yb < sideFrom[k]) continue;
          for (let b = 0; b < dBays; b++) {
            const xb = fx - (b + 0.5) * dW;
            if (bld.kind === 'tower') Q.z(xb, Y + yb + K.floorH / 2, zs + face * 0.02, dW, K.floorH, winCell(), face);
            else Q.z(xb, Y + yb + K.floorH * 0.52, zs + face * 0.03, Math.min(K.winW, dW * 0.8), K.winH, winCell(), face);
          }
        }
      }
      // a cornice where each part ends
      if (bld.kind !== 'tower') {
        const cy = Y + y1 - (s.to === floors ? 1.1 : 0) + 0.25;
        const corniceMat = wall === 'brick' ? (r() < 0.5 ? 'iron' : 'stone') : 'stone';
        add(corniceMat, rbox(0.9, 0.6, bw + 0.5, 0.12, 1), { p: [fx + 0.3, cy, zc] });
        add(corniceMat, rbox(0.3, 0.25, bw + 0.3, 0.05, 1), { p: [fx + 0.1, cy - 0.45, zc] });
        if (corner0 && k0(s)) add(corniceMat, rbox(depth - s.inset, 0.6, 0.9, 0.12, 1), { p: [fx - (depth - s.inset) / 2, cy, zc + bw / 2 + 0.3] });
        if (corner1 && k0(s)) add(corniceMat, rbox(depth - s.inset, 0.6, 0.9, 0.12, 1), { p: [fx - (depth - s.inset) / 2, cy, zc - bw / 2 - 0.3] });
      }
    }

    // the ground floor: shops in a granite surround, or a tower's lobby
    add('base', meterBox(0.36, K.ground + 0.1, W - 0.06, TILE.base), { p: [X + 0.12, Y + (K.ground + 0.1) / 2, zc] });
    add('stone', rbox(0.5, 0.35, W - 0.02, 0.06, 1), { p: [X + 0.2, Y + K.ground + 0.1, zc] }); // the beltcourse
    const front = X + 0.31;
    if (bld.kind === 'tower') {
      const n = Math.max(2, Math.round(W / 3));
      for (let k = 0; k < n; k++) {
        const zk = zc + W / 2 - (k + 0.5) * (W / n);
        Q.x(front, Y + K.ground * 0.45, zk, W / n - 0.3, K.ground * 0.8, k === Math.floor(n / 2) ? cell(3, CELL.door) : cell(5, CELL.shop));
      }
    } else {
      const shops = Math.max(1, Math.round(W / 6));
      const sw = W / shops;
      for (let k = 0; k < shops; k++) {
        const zk = zc + W / 2 - (k + 0.5) * sw;
        const closed = r() < 0.25;
        const doorAt = zk + (r() < 0.5 ? 1 : -1) * (sw / 2 - 1);
        const winZ = zk + (doorAt > zk ? -0.6 : 0.6);
        Q.x(front, Y + 0.35 + 1.45, winZ, sw - 2.1, 2.9, closed ? cell(4 + Math.floor(r() * 3), CELL.door) : cell(Math.floor(r() * 8), CELL.shop));
        Q.x(front, Y + 1.3, doorAt, 1.1, 2.6, cell(Math.floor(r() * 3), CELL.door));
        // the sign over it, and maybe an awning
        Q.x(front + 0.02, Y + K.ground - 0.62, zk, sw - 0.5, 0.75, cell(Math.floor(r() * 8), CELL.sign));
        if (r() < 0.45) {
          const fab = cell(Math.floor(r() * 8), CELL.awning);
          add('facade', remapUV(rbox(1.5, 0.06, sw - 0.7, 0.02, 1), fab), { p: [front + 0.7, Y + 3.1, zk], r: [0, 0, -0.38] });
          add('facade', remapUV(rbox(0.04, 0.32, sw - 0.7, 0.01, 1), fab), { p: [front + 1.38, Y + 2.68, zk] });
        }
      }
    }
    // corner buildings show their ground floor down the cross street too
    for (const [on, zs, face] of [
      [corner0, z0, 1],
      [corner1, z1, -1],
    ]) {
      if (!on) continue;
      add('base', meterBox(depth, K.ground + 0.1, 0.36, TILE.base), { p: [X - depth / 2, Y + (K.ground + 0.1) / 2, zs - face * 0.06] });
      for (let k = 0; k < Math.floor(depth / 6); k++) Q.z(X - 3.5 - k * 6, Y + 1.8, zs + face * 0.14, 4.4, 2.9, cell(Math.floor(r() * 8), CELL.shop), face);
    }

    // fire escapes on the walk-ups
    if (bld.kind === 'walkup' || (bld.kind === 'loft' && r() < 0.4)) {
      const span = Math.min(W - 1.5, 5.2);
      const ez = zc + (r() - 0.5) * (W - span - 1);
      const out = 1.05;
      for (let f = 1; f < floors; f++) {
        const yf = Y + K.ground + f * K.floorH + 0.05;
        add('iron', new THREE.BoxGeometry(out, 0.05, span), { p: [X + out / 2, yf, ez] });
        add('iron', new THREE.BoxGeometry(0.04, 0.04, span), { p: [X + out, yf + 0.95, ez] });
        add('iron', new THREE.BoxGeometry(0.03, 0.03, span), { p: [X + out, yf + 0.5, ez] });
        for (const zs of [-1, -0.33, 0.33, 1]) add('iron', new THREE.BoxGeometry(0.035, 0.95, 0.035), { p: [X + out, yf + 0.47, ez + (zs * span) / 2] });
        for (const zs of [-1, 1]) add('iron', new THREE.BoxGeometry(out, 0.035, 0.035), { p: [X + out / 2, yf + 0.95, ez + (zs * span) / 2] });
        // the stair up to the next landing, zigzagging
        if (f < floors - 1) {
          const dir = f % 2 ? 1 : -1;
          const run = span * 0.62;
          const za = ez - (dir * run) / 2;
          const zb = ez + (dir * run) / 2;
          const len = Math.hypot(K.floorH, run);
          add('iron', new THREE.BoxGeometry(0.55, 0.05, len), { p: [X + out - 0.36, yf + K.floorH / 2, (za + zb) / 2], r: [Math.atan2(-K.floorH, zb - za), 0, 0] });
        }
      }
      // the drop ladder
      const y2 = Y + K.ground + K.floorH;
      for (const s of [-0.22, 0.22]) add('iron', new THREE.BoxGeometry(0.03, 2.2, 0.03), { p: [X + out - 0.2, y2 - 1.1, ez + span / 2 - 0.5 + s] });
    }

    // the roof: a water tower, a stair bulkhead, plant, a mast on the towers
    const ry = Y + top + (bld.kind === 'tower' ? 0 : 1.1);
    const rd = depth - (steps.length > 1 ? 3.5 : 0);
    const rx = X - (steps.length > 1 ? 3.5 : 0);
    if ((bld.kind === 'walkup' || bld.kind === 'loft' || bld.kind === 'prewar') && r() < 0.55) waterTower(add, rx - rd * (0.45 + r() * 0.25), ry - 1.1, zc + (r() - 0.5) * (W * 0.4), 1.4 + r() * 0.8);
    if (bld.kind !== 'tower') add('base', meterBox(2.8, 2.6, 3.2, TILE.base), { p: [rx - rd * 0.7, ry - 1.1 + 1.3, zc - W * 0.2] });
    else {
      add('glass', new THREE.BoxGeometry(depth * 0.6, 6, W * 0.6), { p: [X - depth / 2, ry + 3, zc] });
      add('iron', new THREE.CylinderGeometry(0.15, 0.3, 14, 8), { p: [X - depth / 2, ry + 13, zc + W * 0.15] });
    }
    if (bld.kind === 'prewar' || bld.kind === 'loft') for (let k = 0; k < 2; k++) add('base', meterBox(2 + r() * 2, 1.4, 2 + r() * 3, TILE.base), { p: [rx - 3 - r() * (rd - 8), ry - 1.1 + 0.7, zc + (r() - 0.5) * W * 0.6] });
  });

  // a traffic light at the far corner, its arm out over the parking lane
  const tz = -L + 1.2;
  add('iron', new THREE.CylinderGeometry(0.11, 0.14, 6.6, 10), { p: [-0.7, Y + 3.3, tz] });
  add('iron', new THREE.CylinderGeometry(0.07, 0.09, 6.2, 8).rotateZ(Math.PI / 2), { p: [-0.7 + 3.1, Y + 6.2, tz] });
  for (const [x, c] of [
    [3.4, 1],
    [5.4, 1],
  ])
    add('facade', remapUV(rbox(0.36, 1.0, 0.32, 0.04, 1), cell(c, CELL.misc)), { p: [x, Y + 5.6, tz] });
  add('facade', remapUV(rbox(0.36, 0.36, 0.3, 0.04, 1), cell(3, CELL.misc)), { p: [-0.7, Y + 2.9, tz + 0.25] });
  // a hydrant and a mailbox, somewhere along the kerb
  const hz = -8 - r() * 40;
  add('facade', remapUV(new THREE.CylinderGeometry(0.14, 0.17, 0.75, 10), cell(0, CELL.awning)), { p: [-0.6, Y + 0.38, hz] });
  add('facade', remapUV(rbox(0.4, 0.2, 0.4, 0.06, 1), cell(0, CELL.awning)), { p: [-0.6, Y + 0.8, hz] });
  if (r() < 0.6) add('facade', remapUV(rbox(0.5, 1.2, 0.5, 0.08, 1), cell(2, CELL.awning)), { p: [-0.7, Y + 0.6, hz - 6 - r() * 10] });

  if (!Q.empty) B.add('facade', Q.geometry());
  const group = B.build(mats, { shadows: false });
  group.traverse((o) => {
    if (o.isMesh) o.receiveShadow = o.name === 'sidewalk';
  });
  return group;
}
// A water tower on its stand: a cedar barrel, iron hoops, a conical roof.
function waterTower(add, x, y, z, s = 1.6) {
  const legH = 3.4;
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    add('iron', new THREE.CylinderGeometry(0.07, 0.09, legH, 6), { p: [x + dx * s * 0.62, y + legH / 2, z + dz * s * 0.62] });
  add('iron', new THREE.BoxGeometry(s * 1.6, 0.12, s * 1.6), { p: [x, y + legH, z] });
  const H = s * 2.1;
  add('planks', new THREE.CylinderGeometry(s, s * 1.04, H, 18, 1, false), { p: [x, y + legH + H / 2 + 0.06, z] });
  for (let k = 0; k < 4; k++) add('iron', new THREE.TorusGeometry(s * 1.02 + (k ? 0 : 0.03), 0.025, 4, 20).rotateX(Math.PI / 2), { p: [x, y + legH + 0.3 + k * (H / 3.4), z] });
  add('iron', new THREE.ConeGeometry(s * 1.08, s * 0.9, 18), { p: [x, y + legH + H + s * 0.45 + 0.05, z] });
  add('iron', new THREE.SphereGeometry(0.1, 8, 6), { p: [x, y + legH + H + s * 0.92, z] });
}

// A plain street lamp for phones (the scanned one is 4,000 triangles): a pole
// on a base, an arm out along +z to a hood over the bulb (drawn apart).
export function lampGeometries() {
  const b = new PartBuilder();
  b.add('iron', new THREE.CylinderGeometry(0.2, 0.26, 0.7, 8), { p: [0, 0.35, 0] });
  b.add('iron', new THREE.CylinderGeometry(0.08, 0.12, 7.1, 8), { p: [0, 3.9, 0] });
  b.add('iron', new THREE.BoxGeometry(0.07, 0.07, 0.8), { p: [0, 7.45, 0.36] });
  b.add('iron', new THREE.ConeGeometry(0.32, 0.3, 10, 1, true), { p: [0, 7.52, 0.72] });
  return b.geometries();
}

// ── cars ──

// Side profiles: [z, y] round the body from the rear bottom, nose at +z.
const PROFILES = {
  sedan: {
    w: 1.86,
    wheel: 0.34,
    base: 1.42,
    body: [
      [-2.2, 0.3],
      [2.2, 0.3],
      [2.25, 0.56],
      [2.14, 0.76],
      [1.05, 0.9],
      [-1.42, 0.93],
      [-2.08, 0.92],
      [-2.25, 0.74],
    ],
    cabin: [
      [1.02, 0.89],
      [0.18, 1.42],
      [-0.92, 1.42],
      [-1.5, 0.92],
    ],
  },
  suv: {
    w: 1.96,
    wheel: 0.4,
    base: 1.4,
    body: [
      [-2.2, 0.4],
      [2.2, 0.4],
      [2.25, 0.74],
      [2.12, 1.02],
      [1.3, 1.12],
      [-2.12, 1.16],
      [-2.24, 0.98],
    ],
    cabin: [
      [1.3, 1.11],
      [0.55, 1.8],
      [-1.98, 1.82],
      [-2.1, 1.15],
    ],
  },
};

// A profile pushed out across the car, centred on x = 0.
function sideExtrude(pts, width, bevel = 0.05) {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, width - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  // the shape's x runs along the car (z), the extrusion across it (x)
  g.rotateY(-Math.PI / 2);
  g.computeBoundingBox();
  g.translate(-(g.boundingBox.min.x + g.boundingBox.max.x) / 2, 0, 0);
  return g;
}

export const CAR_KINDS = ['sedan', 'taxi', 'police', 'suv'];

// A car's parts for an instanced pool, nose along +z, wheels on the ground:
// paint (tinted per car), glass, trim (and tyres), chrome (and headlamps), red, and for a
// taxi its roof light (sign), for a police car its lightbar (siren) and stripe.
export function carGeometries(kind = 'sedan') {
  const P = kind === 'suv' ? PROFILES.suv : PROFILES.sedan;
  const b = new PartBuilder();
  const W = P.w;
  b.add('paint', sideExtrude(P.body, W, 0.07));
  const gw = W * 0.86;
  b.add('glass', sideExtrude(P.cabin, gw, 0.04));
  const [front, roofF, roofB, back] = P.cabin;
  // the roof and the pillars over the glass
  b.add('paint', rbox(gw + 0.03, 0.07, roofF[0] - roofB[0] + 0.02, 0.03, 2), { p: [0, roofF[1] + 0.025, (roofF[0] + roofB[0]) / 2] });
  for (const sd of [-1, 1]) {
    for (const [a, c] of [
      [front, roofF],
      [roofB, back],
    ]) {
      const dz = c[0] - a[0];
      const dy = c[1] - a[1];
      b.add('paint', rbox(0.08, Math.hypot(dz, dy) + 0.04, 0.1, 0.025, 2), { p: [(sd * gw) / 2, (a[1] + c[1]) / 2, (a[0] + c[0]) / 2], r: [Math.atan2(dz, dy), 0, 0] });
    }
    const cabinH = roofF[1] - front[1];
    const pillars = kind === 'suv' ? [-0.25, -1.25] : [-0.38];
    for (const pz of pillars) b.add('paint', rbox(0.08, cabinH, 0.12, 0.025, 2), { p: [(sd * gw) / 2, front[1] + cabinH / 2, pz] });
    // mirrors
    b.add('paint', rbox(0.1, 0.11, 0.2, 0.03, 2), { p: [sd * (W / 2 + 0.04), front[1] + 0.08, front[0] - 0.12] });
    b.add('trim', rbox(0.02, 0.06, 0.6, 0.01, 2), { p: [sd * (W / 2 + 0.005), front[1] - 0.18, 0.4] }); // door handles' strip
  }
  // wheels, their arches, the hubs
  const r = P.wheel;
  const tyre = new THREE.CylinderGeometry(r, r, 0.26, 20).rotateZ(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.27, 14).rotateZ(Math.PI / 2);
  const arch = new THREE.TorusGeometry(r + 0.06, 0.06, 6, 14, Math.PI).rotateY(Math.PI / 2);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = [sx * (W / 2 - 0.13), r, sz * P.base];
      b.add('trim', tyre, { p });
      b.add('chrome', hub, { p: [p[0] + sx * 0.005, r, p[2]] });
      b.add('trim', arch, { p: [sx * (W / 2 - 0.02), r + 0.02, sz * P.base] });
    }
  // bumpers, grille, lights, plates
  const by = kind === 'suv' ? 0.56 : 0.44;
  for (const sz of [-1, 1]) b.add('trim', rbox(W * 0.98, 0.2, 0.22, 0.06, 2), { p: [0, by, sz * 2.24] });
  b.add('trim', rbox(W * 0.5, 0.18, 0.06, 0.02, 2), { p: [0, by + 0.24, 2.24] });
  for (const sx of [-1, 1]) {
    b.add('chrome', rbox(0.34, 0.12, 0.06, 0.02, 2), { p: [sx * 0.62, by + 0.25, 2.21] });
    b.add('red', rbox(0.36, 0.13, 0.06, 0.02, 2), { p: [sx * 0.66, by + 0.3, -2.25] });
  }
  for (const sz of [-1, 1]) b.add('chrome', new THREE.BoxGeometry(0.34, 0.12, 0.02), { p: [0, by, sz * 2.36] });
  if (kind === 'taxi') b.add('sign', rbox(0.6, 0.22, 0.26, 0.04, 2), { p: [0, roofF[1] + 0.17, (roofF[0] + roofB[0]) / 2] });
  if (kind === 'police') {
    const ry = roofF[1] + 0.1;
    const rz = (roofF[0] + roofB[0]) / 2 + 0.1;
    b.add('trim', rbox(1.2, 0.08, 0.3, 0.03, 2), { p: [0, ry, rz] });
    b.add('red', rbox(0.5, 0.1, 0.24, 0.03, 2), { p: [-0.32, ry + 0.07, rz] });
    b.add('siren', rbox(0.5, 0.1, 0.24, 0.03, 2), { p: [0.32, ry + 0.07, rz] });
    for (const sd of [-1, 1]) b.add('stripe', new THREE.BoxGeometry(0.01, 0.12, 3.6), { p: [sd * (W / 2 + 0.005), 0.68, 0] });
    b.add('trim', rbox(1.1, 0.35, 0.12, 0.03, 2), { p: [0, by + 0.05, 2.38] }); // push bar
  }
  if (kind === 'suv') for (const sd of [-1, 1]) b.add('trim', rbox(0.05, 0.05, 2.2, 0.02, 2), { p: [sd * 0.62, roofF[1] + 0.09, -0.7] });
  return b.geometries();
}

// The materials every car shares. Paint is white, so each car's own colour
// (set per instance) is the paint you see.
export function carMaterials() {
  return {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.35, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x1a2028, metalness: 0.2, roughness: 0.06, clearcoat: 1, envMapIntensity: 1.4 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 0.65, metalness: 0.1 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xd0d4d8, roughness: 0.18, metalness: 1 }),
    red: new THREE.MeshStandardMaterial({ color: 0x8a0c0c, roughness: 0.25, metalness: 0.2, emissive: 0xff2010, emissiveIntensity: 0.25 }),
    sign: new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.4, emissive: 0xfff4d0, emissiveIntensity: 0.6 }),
    siren: new THREE.MeshStandardMaterial({ color: 0x1030a0, roughness: 0.25, emissive: 0x2050ff, emissiveIntensity: 0.4 }),
    stripe: new THREE.MeshStandardMaterial({ color: 0x163a8a, roughness: 0.4, metalness: 0.2 }),
  };
}

// The paint each kind comes in: sedans in what New Yorkers drove in 2012,
// taxis yellow, police cars white, SUVs dark. Some are scorched.
export const CAR_COLOURS = {
  sedan: [0xb8bcc0, 0x1a1c20, 0x6a1418, 0x1e2a44, 0xd8d8d4, 0x5a5e62, 0x8a8478, 0x2a3a2a],
  taxi: [0xf2b40a, 0xe8aa08, 0xf0b81a],
  police: [0xf2f2ee],
  suv: [0x16181a, 0x2a2e34, 0x5a5e62, 0x3a2a1e, 0xd0d0cc],
};

// ── the Chitauri's energy walls ──

// Two pylons `w` apart, for an instanced pool: armour, dark, glow.
export function wallGeometries(w = 3) {
  const b = new PartBuilder();
  for (const sd of [-1, 1]) {
    const x = sd * (w / 2 + 0.12);
    b.add('dark', rbox(0.95, 0.32, 1.05, 0.08, 1), { p: [x, 0.16, 0] }); // the foot
    for (const fz of [-1, 1]) b.add('armour', taper(rbox(0.3, 0.26, 0.75, 0.05, 1), 1, 0.4, { axis: 'z' }), { p: [x, 0.14, fz * 0.62], r: [0, fz > 0 ? 0 : Math.PI, 0] }); // claws
    b.add('armour', taper(rbox(0.46, 4.1, 0.56, 0.08, 1), 1, 0.42), { p: [x, 2.3, 0] }); // the pylon
    b.add('dark', taper(rbox(0.22, 3.7, 0.62, 0.04, 1), 1, 0.5), { p: [x + sd * 0.06, 2.2, 0] }); // its spine
    b.add('glow', rbox(0.05, 3.4, 0.07, 0.02, 1), { p: [x - sd * 0.22, 2.15, 0] }); // the seam that feeds the field
    for (let i = 0; i < 4; i++) b.add('armour', taper(rbox(0.55, 0.1, 0.42, 0.03, 1), 1, 0.3, { axis: 'x', zToo: true }), { p: [x + sd * 0.3, 1.0 + i * 0.85, 0], r: [0, sd > 0 ? 0 : Math.PI, -sd * 0.35] }); // fins
    b.add('glow', new THREE.SphereGeometry(0.17, 10, 8), { p: [x, 4.42, 0] }); // the emitter
    b.add('armour', new THREE.TorusGeometry(0.22, 0.05, 6, 14).rotateX(Math.PI / 2), { p: [x, 4.42, 0] });
  }
  return b.geometries();
}

// The field between the pylons: a hexagonal lattice with energy running up
// it, violet into blue. Works on its own or in an InstancedMesh.
export function wallField(w = 3, h = 3.9) {
  const geo = new THREE.PlaneGeometry(w, h).translate(0, h / 2 + 0.2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uSize: { value: new THREE.Vector2(w, h) } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vSeed;
      void main() {
        vUv = uv;
        vec4 p = vec4(position, 1.0);
        vSeed = 0.0;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          vSeed = instanceMatrix[3][0] * 0.37 + instanceMatrix[3][2] * 0.11;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uSize;
      varying vec2 vUv;
      varying float vSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      // distance to the nearest edge of a hexagonal lattice
      float hexEdge(vec2 p) {
        p.x *= 1.1547;
        p.y += mod(floor(p.x), 2.0) * 0.5;
        p = abs(fract(p) - 0.5);
        return abs(max(p.x * 1.5 + p.y, p.y * 2.0) - 1.0);
      }
      void main() {
        vec2 m = vUv * uSize;
        float t = uTime + vSeed;
        float e = hexEdge(m * 2.4);
        float lattice = 1.0 - smoothstep(0.0, 0.09, e);
        float flow = noise(vec2(m.x * 1.5, m.y * 0.8 - t * 2.2)) * 0.6 + noise(vec2(m.x * 4.0 + 3.0, m.y * 2.0 - t * 4.0)) * 0.4;
        float bands = pow(0.5 + 0.5 * sin(m.y * 5.0 - t * 7.0 + flow * 4.0), 6.0);
        float sides = smoothstep(0.75, 1.0, abs(vUv.x * 2.0 - 1.0));
        float fade = smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
        vec3 violet = vec3(0.55, 0.25, 1.0);
        vec3 blue = vec3(0.3, 0.65, 1.0);
        vec3 col = mix(violet, blue, flow);
        float k = 0.12 + lattice * (0.55 + flow * 0.5) + bands * 0.45 + sides * 0.9;
        k *= 0.8 + 0.2 * sin(t * 23.0 + m.y * 3.0);
        gl_FragColor = vec4(col * k * fade * 1.6, 1.0);
      }`,
  });
  return { geo, mat };
}

// ── craters ──

// A crater blasted in the asphalt: a black, broken hole, its lip of torn
// paving, scorch round it and cracks running out, embers still in it (the
// emissive map). `w` × `h` pixels: wider for one across the whole street.
export function craterMaps({ w = 512, h = 512, seed = 5 } = {}) {
  const r = rng(seed);
  const holes = [];
  // cracks: jagged polylines from the lip outward
  const cracks = Array.from({ length: 16 }, (_, i) => {
    let a = (i / 16) * Math.PI * 2 + r() * 0.3;
    let px = 0.5 + Math.cos(a) * 0.3;
    let py = 0.5 + Math.sin(a) * 0.3;
    const pts = [[px, py]];
    for (let k = 0; k < 5; k++) {
      a += (r() - 0.5) * 0.8;
      const step = 0.03 + r() * 0.04;
      px += Math.cos(a) * step;
      py += Math.sin(a) * step;
      pts.push([px, py]);
    }
    return { pts, wid: 0.008 + r() * 0.008 };
  });
  for (let i = 0; i < 40; i++) holes.push([0.5 + (r() - 0.5) * 0.5, 0.5 + (r() - 0.5) * 0.5, 0.004 + r() * 0.012, r()]);
  const lip = Array.from({ length: 48 }, (_, i) => 0.27 + r() * 0.05 + Math.sin(i * 1.7) * 0.01);
  const draw = (x, emissive) => {
    x.save();
    x.scale(w, h);
    x.clearRect(0, 0, 1, 1);
    if (emissive) {
      x.fillStyle = '#000';
      x.fillRect(0, 0, 1, 1);
    }
    if (!emissive) {
      // scorch
      const g = x.createRadialGradient(0.5, 0.5, 0.05, 0.5, 0.5, 0.5);
      g.addColorStop(0, 'rgba(12,10,9,1)');
      g.addColorStop(0.55, 'rgba(22,18,16,0.85)');
      g.addColorStop(0.8, 'rgba(30,26,24,0.35)');
      g.addColorStop(1, 'rgba(30,28,26,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 1, 1);
    }
    // the hole, a ragged outline
    x.beginPath();
    lip.forEach((rad, i) => {
      const a = (i / lip.length) * Math.PI * 2;
      const px = 0.5 + Math.cos(a) * rad;
      const py = 0.5 + Math.sin(a) * rad;
      if (i) x.lineTo(px, py);
      else x.moveTo(px, py);
    });
    x.closePath();
    if (emissive) {
      const g = x.createRadialGradient(0.5, 0.5, 0, 0.5, 0.5, 0.3);
      g.addColorStop(0, 'rgba(255,120,40,0.9)');
      g.addColorStop(0.4, 'rgba(160,40,10,0.5)');
      g.addColorStop(1, 'rgba(40,6,0,0)');
      x.fillStyle = g;
    } else {
      const g = x.createRadialGradient(0.5, 0.56, 0, 0.5, 0.5, 0.3);
      g.addColorStop(0, '#060505');
      g.addColorStop(0.75, '#141110');
      g.addColorStop(1, '#2a2522');
      x.fillStyle = g;
    }
    x.fill();
    if (!emissive) {
      // the lip catches the light on the far side
      x.lineWidth = 0.02;
      x.strokeStyle = 'rgba(120,112,104,0.55)';
      x.beginPath();
      lip.forEach((rad, i) => {
        const a = (i / lip.length) * Math.PI * 2;
        if (Math.sin(a) > 0.1) return;
        x.moveTo(0.5 + Math.cos(a) * rad, 0.5 + Math.sin(a) * rad);
        x.arc(0.5 + Math.cos(a) * rad, 0.5 + Math.sin(a) * rad, 0.006, 0, Math.PI * 2);
      });
      x.stroke();
    }
    // cracks
    x.lineCap = 'round';
    x.lineJoin = 'round';
    for (const c of cracks) {
      x.strokeStyle = emissive ? 'rgba(255,90,20,0.75)' : 'rgba(8,7,6,0.9)';
      x.lineWidth = emissive ? c.wid * 0.5 : c.wid;
      x.beginPath();
      c.pts.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
      if (emissive) {
        // only the first stretch, near the heat, glows
        x.globalAlpha = 0.8;
      }
      x.stroke();
      x.globalAlpha = 1;
    }
    // embers in the hole, chips of asphalt round it
    for (const [px, py, rad, k] of holes) {
      const inside = Math.hypot(px - 0.5, py - 0.5) < 0.26;
      if (emissive && !inside) continue;
      x.fillStyle = emissive ? `rgba(255,${140 + Math.round(k * 100)},60,${0.6 + k * 0.4})` : inside ? '#1a1412' : 'rgba(70,66,62,0.8)';
      x.beginPath();
      x.arc(px, py, rad, 0, Math.PI * 2);
      x.fill();
    }
    x.restore();
  };
  const map = canvasTexture(w, h, (x) => draw(x, false));
  const emissiveMap = canvasTexture(w, h, (x) => draw(x, true));
  return { map, emissiveMap };
}

// Slabs of asphalt tipped up round a crater's lip: [x, z, yaw, tilt, size],
// for an ellipse rx × rz.
export function craterRim(rx, rz, seed = 3, n = 16) {
  const r = rng(seed);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const k = 0.92 + r() * 0.14;
    return [Math.cos(a) * rx * k, Math.sin(a) * rz * k, -a, 0.35 + r() * 0.5, 0.35 + r() * 0.45];
  });
}

// ── the avenue's paint ──

// One block's worth of road (80 m along, 14 m across, x from -7 to 7): lane
// lines, edge lines, the stop line and crosswalks at the cross street,
// manholes, patches, skid marks and the battle's scorch, as a transparent
// decal over the asphalt. v runs along the course (0 at a block's start).
export function roadMarkings({ small = false, seed = 9 } = {}) {
  const W = small ? 256 : 512;
  const H = small ? 1024 : 2048;
  const r = rng(seed);
  const props = {
    manholes: Array.from({ length: 3 }, () => [(r() - 0.5) * 8, 6 + r() * 50]),
    patches: Array.from({ length: 5 }, () => [(r() - 0.5) * 10, 4 + r() * 54, 1 + r() * 3, 1 + r() * 5]),
    oil: Array.from({ length: 10 }, () => [[-3.2, 0, 3.2][Math.floor(r() * 3)] + (r() - 0.5) * 0.4, r() * 62, 0.3 + r() * 0.4]),
    skids: Array.from({ length: 3 }, () => [(r() - 0.5) * 8, 8 + r() * 40, 6 + r() * 10, (r() - 0.5) * 0.3]),
    scorch: Array.from({ length: 2 }, () => [(r() - 0.5) * 9, 10 + r() * 45, 1.5 + r() * 2]),
    cracks: Array.from({ length: 14 }, () => [(r() - 0.5) * 12, r() * 80, r() * Math.PI, 1 + r() * 3]),
  };
  return canvasTexture(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    // metres to pixels: x across from -7, s along the course (up the canvas)
    const px = (m) => ((m + 7) / 14) * W;
    const py = (s) => (1 - s / 80) * H;
    const mx = W / 14;
    const my = H / 80;
    const rectM = (x0, s0, w, l) => x.fillRect(px(x0), py(s0 + l), w * mx, l * my);
    // grime along the kerbs, in the parking lanes
    for (const sd of [-1, 1]) {
      const g = x.createLinearGradient(px(sd * 7), 0, px(sd * 4.6), 0);
      g.addColorStop(0, 'rgba(20,18,16,0.45)');
      g.addColorStop(1, 'rgba(20,18,16,0)');
      x.fillStyle = g;
      x.fillRect(Math.min(px(sd * 7), px(sd * 4.6)), 0, Math.abs(px(sd * 7) - px(sd * 4.6)), H);
    }
    // patches and oil
    for (const [cx, s, w, l] of props.patches) {
      x.fillStyle = 'rgba(16,16,18,0.35)';
      rectM(cx - w / 2, s, w, l);
      x.strokeStyle = 'rgba(10,10,10,0.4)';
      x.lineWidth = 1.5;
      x.strokeRect(px(cx - w / 2), py(s + l), w * mx, l * my);
    }
    for (const [cx, s, rad] of props.oil) {
      x.fillStyle = 'rgba(8,8,10,0.28)';
      x.beginPath();
      x.ellipse(px(cx), py(s), rad * mx, rad * 2.2 * my, 0, 0, Math.PI * 2);
      x.fill();
    }
    // cracks
    x.strokeStyle = 'rgba(8,8,8,0.55)';
    x.lineWidth = 1.2;
    for (const [cx, s, a, len] of props.cracks) {
      x.beginPath();
      x.moveTo(px(cx), py(s));
      let ax = cx;
      let as = s;
      for (let k = 0; k < 4; k++) {
        ax += Math.cos(a + Math.sin(k * 2.1) * 0.7) * (len / 4);
        as += Math.sin(a + Math.sin(k * 2.1) * 0.7) * (len / 4);
        x.lineTo(px(ax), py(as));
      }
      x.stroke();
    }
    // the paint: worn white
    const paint = (x0, s0, w, l, a = 0.88) => {
      x.fillStyle = `rgba(236,232,222,${a})`;
      rectM(x0, s0, w, l);
    };
    for (const lx of [-1.6, 1.6]) for (let s = 2; s < 60; s += 12) paint(lx - 0.06, s, 0.12, 3);
    for (const ex of [-4.8, 4.8]) paint(ex - 0.07, 1, 0.14, 62);
    paint(-4.8, 63.2, 9.6, 0.45); // the stop line
    // crosswalks, either side of the cross street
    for (const s0 of [64.6, 76.8]) for (let k = 0; k < 14; k++) paint(-6.6 + k * 0.96, s0, 0.55, 2.8, 0.85);
    // scorch and skids from the battle
    for (const [cx, s, rad] of props.scorch) {
      const g = x.createRadialGradient(px(cx), py(s), 0, px(cx), py(s), rad * mx * 1.4);
      g.addColorStop(0, 'rgba(10,8,6,0.75)');
      g.addColorStop(1, 'rgba(10,8,6,0)');
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(px(cx), py(s), rad * mx * 1.4, rad * my * 1.8, 0, 0, Math.PI * 2);
      x.fill();
    }
    for (const [cx, s, len, a] of props.skids) {
      x.strokeStyle = 'rgba(12,12,12,0.45)';
      x.lineWidth = 0.22 * mx;
      for (const o of [-0.8, 0.8]) {
        x.beginPath();
        x.moveTo(px(cx + o), py(s));
        x.quadraticCurveTo(px(cx + o + a * len * 0.5), py(s + len * 0.5), px(cx + o + a * len), py(s + len));
        x.stroke();
      }
    }
    // manholes
    for (const [cx, s] of props.manholes) {
      x.fillStyle = 'rgba(30,28,26,0.9)';
      x.beginPath();
      x.ellipse(px(cx), py(s), 0.38 * mx, 0.38 * my, 0, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = 'rgba(90,86,80,0.8)';
      x.lineWidth = 1.5;
      x.stroke();
    }
    // worn paint: knock specks out of everything
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < (small ? 1500 : 6000); i++) {
      x.fillStyle = `rgba(0,0,0,${0.3 + r() * 0.5})`;
      x.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
    }
    x.globalCompositeOperation = 'source-over';
  });
}

// ── a chariot's run ──

// What a chariot paints down a lane before it fires: red chevrons running at
// Hulk, faster as the run comes; then the burn, fire down the lane. A plane
// from z = 0 out to -len, `w` wide. uWarn 0..1 through the warning, uBurn
// 0..1 through the burn.
export function laneWarning(w = 2.8, len = 90) {
  const geo = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(0, 0, -len / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uWarn: { value: 0 }, uBurn: { value: 0 }, uLen: { value: len }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uWarn, uBurn, uLen, uOpacity;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        float d = vUv.y * uLen; // metres ahead of him
        float x = vUv.x * 2.0 - 1.0;
        // chevrons pointing at him, running at him
        float speed = 8.0 + uWarn * 26.0;
        float s = d - abs(x) * 1.4 + uTime * speed;
        float st = fract(s / 3.2);
        float chev = smoothstep(0.0, 0.06, st) * (1.0 - smoothstep(0.3, 0.38, st));
        float edge = smoothstep(0.82, 0.92, abs(x)) * (1.0 - smoothstep(0.96, 1.0, abs(x)));
        float pulse = 0.65 + 0.35 * sin(uTime * (9.0 + uWarn * 22.0));
        float fade = smoothstep(uLen, uLen * 0.55, d) * smoothstep(-0.5, 2.0, d);
        vec3 col = vec3(1.0, 0.1, 0.05) * (chev * 0.9 + edge * 1.3) * pulse * (0.35 + uWarn * 1.1) * (1.0 - uBurn);
        // the burn: fire boiling down the lane
        float n = noise(vec2(x * 3.0, d * 0.6 - uTime * 14.0)) * 0.6 + noise(vec2(x * 7.0, d * 1.7 - uTime * 30.0)) * 0.4;
        float core = 1.0 - smoothstep(0.1, 0.85, abs(x) + n * 0.3);
        col += mix(vec3(1.0, 0.3, 0.05), vec3(1.0, 0.85, 0.5), core) * core * uBurn * (1.2 + n * 2.0);
        gl_FragColor = vec4(col * fade * uOpacity, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// ── Stark Tower ──

// Offices lit and dark, as an emissive map for a tower's glass.
function towerWindows(cols, rows, seed, lit) {
  const r = rng(seed);
  return canvasTexture(512, 1024, (x, w, h) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    const cw = w / cols;
    const ch = h / rows;
    for (let j = 0; j < rows; j++) {
      // whole floors tend to be lit or dark together
      const floor = r() < lit ? 0.8 : 0.12;
      for (let i = 0; i < cols; i++) {
        if (r() > floor) continue;
        const k = 0.6 + r() * 0.4;
        x.fillStyle = r() < 0.75 ? `rgba(190,215,255,${k})` : `rgba(255,214,160,${k})`;
        x.fillRect(i * cw + 1, j * ch + 2, cw - 2, ch - 4);
      }
    }
  });
}

// Stark Tower in 2012: a glass shaft on a stone podium, its crown swept back
// in a curve, the landing pad off the top, STARK down the front in light, the
// arc reactor's ring, and the Tesseract on the roof with its beam going up.
// About 260 m tall, facing +z. Returns { group, beam, top, update(t) }.
export function buildStarkTower({ beamLength = 420 } = {}) {
  const group = new THREE.Group();
  group.name = 'stark-tower';
  const glassMat = (cols, rows, seed, lit) =>
    new THREE.MeshPhysicalMaterial({ color: 0x2a3a48, metalness: 0.5, roughness: 0.1, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: towerWindows(cols, rows, seed, lit), envMapIntensity: 1.6 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 0.85, metalness: 0 });
  const frame = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.35, metalness: 0.9 });
  const glow = new THREE.MeshBasicMaterial({ color: hot(0x9fe8ff, 3), toneMapped: false });

  // the stone, the frame and the lights are each merged into one draw; the
  // glass is two (the shaft and the crown carry their own windows)
  const B = new PartBuilder();
  const shaftH = 170;
  const crownH = 72;
  const padY = 26 + shaftH + 40;
  const roofY = 26 + shaftH + crownH;
  B.add('stone', new THREE.BoxGeometry(78, 26, 56), { p: [0, 13, 0] }); // the podium
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(46, shaftH, 34), glassMat(18, 42, 3, 0.45));
  shaft.position.y = 26 + shaftH / 2;
  group.add(shaft);
  // vertical fins up its corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add('frame', new THREE.BoxGeometry(1.4, shaftH + 4, 1.4), { p: [sx * 23, 26 + shaftH / 2 + 2, sz * 17] });
  // the crown: a side profile swept back as it rises, pushed out across
  const shape = new THREE.Shape();
  shape.moveTo(-17, 0);
  shape.lineTo(17, 0);
  shape.lineTo(17, 14);
  shape.quadraticCurveTo(15, 52, -2, crownH);
  shape.lineTo(-17, crownH);
  shape.closePath();
  const crownGeo = new THREE.ExtrudeGeometry(shape, { depth: 40, bevelEnabled: false, curveSegments: 16 });
  crownGeo.rotateY(-Math.PI / 2);
  crownGeo.computeBoundingBox();
  crownGeo.translate(-(crownGeo.boundingBox.min.x + crownGeo.boundingBox.max.x) / 2, 0, 0);
  const crown = new THREE.Mesh(crownGeo, glassMat(14, 18, 8, 0.6));
  crown.position.y = 26 + shaftH;
  group.add(crown);
  // the blade: a fin up the front of the crown
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(0, 0);
  bladeShape.lineTo(5, 0);
  bladeShape.quadraticCurveTo(3, 50, -14, crownH + 18);
  bladeShape.lineTo(-17, crownH + 18);
  bladeShape.quadraticCurveTo(-1, 48, 0, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 3, bevelEnabled: false, curveSegments: 16 });
  bladeGeo.rotateY(-Math.PI / 2);
  B.add('frame', bladeGeo, { p: [1.5, 26 + shaftH - 30, 17] });
  // STARK, down the front in light
  const name = canvasTexture(128, 640, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#ffffff';
    x.font = 'bold 112px "Archivo Variable", Arial, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    'STARK'.split('').forEach((c, i) => x.fillText(c, w / 2, 64 + i * 128));
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7, 35), new THREE.MeshBasicMaterial({ map: name, color: hot(0xe8f4ff, 2.2), transparent: true, toneMapped: false, depthWrite: false }));
  sign.position.set(0, 26 + shaftH - 50, 17.2);
  group.add(sign);
  // the landing pad, off the front of the crown, ringed with lights
  B.add('frame', new THREE.CylinderGeometry(10, 9, 1.4, 40), { p: [-10, padY, 26] });
  B.add('glow', new THREE.TorusGeometry(9.6, 0.25, 6, 48).rotateX(Math.PI / 2), { p: [-10, padY + 0.75, 26] });
  B.add('frame', new THREE.BoxGeometry(4, 2.5, 18), { p: [-10, padY - 1.5, 15] });
  // the arc reactor's ring on the roof, the Tesseract's hard white point in it, the spire
  B.add('glow', new THREE.TorusGeometry(7, 0.7, 10, 48).rotateX(Math.PI / 2), { p: [0, roofY + 1.2, -9.5] });
  B.add('glow', new THREE.SphereGeometry(3, 16, 12), { p: [0, roofY + 2, -9.5] });
  B.add('frame', new THREE.CylinderGeometry(0.4, 1.4, 34, 10), { p: [14, roofY + 17, -14] });
  group.add(B.build({ stone, frame, glow }, { shadows: false }));

  // the Tesseract's beam, straight up into the portal
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        // brightest facing us: the cylinder's sides fade out
        float face = 1.0 - smoothstep(0.0, 0.5, abs(fract(vUv.x * 2.0) - 0.5) * 2.0);
        float streak = 0.75 + 0.25 * sin(vUv.y * 140.0 - uTime * 40.0 + vUv.x * 30.0);
        float flicker = 0.85 + 0.15 * sin(uTime * 53.0) * sin(uTime * 31.0);
        float fade = smoothstep(0.0, 0.02, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y) * 0.6);
        vec3 col = mix(vec3(0.35, 0.7, 1.6), vec3(2.2, 2.6, 3.0), face);
        gl_FragColor = vec4(col * (0.4 + face) * streak * flicker * fade, 1.0);
      }`,
  });
  const beamGeo = new THREE.CylinderGeometry(1.8, 1.8, beamLength, 16, 1, true).translate(0, beamLength / 2, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, roofY + 1, -9.5);
  beam.renderOrder = 2;
  group.add(beam);
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, beamLength, 16, 1, true).translate(0, beamLength / 2, 0), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
    side: THREE.DoubleSide,
    uniforms: beamMat.uniforms,
    vertexShader: beamMat.vertexShader,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float face = 1.0 - smoothstep(0.0, 0.5, abs(fract(vUv.x * 2.0) - 0.5) * 2.0);
        float fade = smoothstep(0.0, 0.05, vUv.y) * (1.0 - vUv.y * 0.5);
        gl_FragColor = vec4(vec3(0.2, 0.45, 1.0) * face * face * 0.35 * fade * (0.9 + 0.1 * sin(uTime * 17.0)), 1.0);
      }`,
  }));
  halo.position.copy(beam.position);
  group.add(halo);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  const top = new THREE.Vector3(0, roofY + 2, -9.5);
  return {
    group,
    beam: beamMat,
    top,
    height: roofY,
    update(t) {
      beamMat.uniforms.uTime.value = t;
      glow.color.copy(hot(0x9fe8ff, 2.6 + Math.sin(t * 2) * 0.4));
    },
  };
}
