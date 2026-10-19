// The last five pages’ pop-ups: the Dead Marshes, Cirith Ungol, the
// beacons, Mount Doom and the Grey Havens (a piece’s fields: ./shire.js).

import { bird, eye, flame, peaks, person, tower, tree } from '../figures';
import { ellipse, ridge } from '../paint';
import { band, gutter, heading, land } from './ground';

const candle = {
  outline: ellipse(0.5, 0.5, 0.45, 0.45),
  draw(p) {
    p.glow(0.5, 0.5, 0.5, '#bfe8a0', 1);
    p.wash(ellipse(0.5, 0.5, 0.12, 0.16), '#f4ffe0', { alpha: 1 });
  },
};

const face = {
  outline: ellipse(0.5, 0.5, 0.4, 0.45),
  draw(p) {
    p.wash(ellipse(0.5, 0.5, 0.4, 0.45), '#c8d8e0', { alpha: 0.9 });
    p.fill(ellipse(0.36, 0.42, 0.06, 0.08), '#1a2228');
    p.fill(ellipse(0.64, 0.42, 0.06, 0.08), '#1a2228');
    p.fill(ellipse(0.5, 0.72, 0.1, 0.05), '#1a2228');
  },
};

// Sméagol, crouched, thin, big-eyed
const smeagol = {
  outline: [[0.2, 0.98], [0.3, 0.6], [0.2, 0.5], [0.34, 0.3], [0.5, 0.2], [0.66, 0.3], [0.72, 0.5], [0.66, 0.62], [0.8, 0.98]],
  draw(p) {
    p.wash(smeagol.outline, '#a8a07a', { alpha: 0.95 });
    p.wash(ellipse(0.42, 0.34, 0.06, 0.05), '#d8f0ff', { alpha: 1 });
    p.wash(ellipse(0.58, 0.34, 0.06, 0.05), '#d8f0ff', { alpha: 1 });
    p.dots([[0.42, 0.34], [0.58, 0.34]], { size: 0.02 });
    p.ink(smeagol.outline, { width: 0.012 });
  },
};

// the web across the tunnel’s mouth
const web = {
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]],
  draw(p) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.line([[0.5, 0.5], [0.5 + Math.cos(a) * 0.6, 0.5 + Math.sin(a) * 0.6]], { width: 0.006, colour: '#e8e8e0', alpha: 0.8 });
    }
    for (const r of [0.12, 0.22, 0.32, 0.42]) p.ink(ellipse(0.5, 0.5, r, r, { n: 12 }), { width: 0.005, colour: '#e8e8e0', alpha: 0.7 });
  },
};

const phial = {
  outline: ellipse(0.5, 0.5, 0.45, 0.45),
  draw(p) {
    p.glow(0.5, 0.5, 0.5, '#eaf4ff', 1);
    p.wash([[0.44, 0.3], [0.56, 0.3], [0.6, 0.7], [0.4, 0.7]], '#ffffff', { alpha: 1 });
  },
};

// the White City, its tiers and the tower
const city = {
  outline: [[0.1, 0.98], [0.14, 0.7], [0.22, 0.56], [0.32, 0.44], [0.42, 0.34], [0.46, 0.06], [0.5, 0.0], [0.54, 0.06], [0.58, 0.34], [0.68, 0.44], [0.78, 0.56], [0.86, 0.7], [0.9, 0.98]],
  draw(p) {
    p.wash(city.outline, '#eeeae0', { alpha: 0.95 });
    for (const y of [0.7, 0.56, 0.44, 0.34]) p.line([[0.5 - (0.98 - y) * 0.42, y], [0.5 + (0.98 - y) * 0.42, y]], { width: 0.006, alpha: 0.6 });
    p.hatch(0.15, 0.4, 0.85, 0.98, { n: 50, len: 0.02, angle: 0, alpha: 0.3 });
    p.ink(city.outline, { width: 0.008 });
  },
};

// a beacon’s peak with its pyre on top
const beacon = {
  outline: [[0, 0.98], [0.36, 0.3], [0.42, 0.18], [0.58, 0.18], [0.64, 0.3], [1, 0.98]],
  draw(p) {
    p.wash(beacon.outline, '#7a7a86', { alpha: 0.9 });
    p.wash([[0.36, 0.3], [0.46, 0.06], [0.54, 0.06], [0.64, 0.3]], '#f4f2ee', { alpha: 0.9 });
    p.wash([[0.42, 0.2], [0.58, 0.2], [0.54, 0.12], [0.46, 0.12]], '#5a3a1e', { alpha: 1 });
    p.hatch(0.1, 0.4, 0.9, 0.95, { n: 30, len: 0.06, angle: -2, alpha: 0.3 });
    p.ink(beacon.outline, { width: 0.01 });
  },
};

// Orodruin, the fire running down its side
const doom = {
  outline: [[0, 0.98], [0.3, 0.4], [0.4, 0.2], [0.46, 0.14], [0.54, 0.14], [0.6, 0.2], [0.7, 0.4], [1, 0.98]],
  draw(p) {
    p.wash(doom.outline, '#3a2e2a', { alpha: 0.95 });
    p.line([[0.5, 0.16], [0.52, 0.3], [0.48, 0.5], [0.56, 0.7], [0.52, 0.98]], { width: 0.02, colour: '#ff6a1a' });
    p.glow(0.5, 0.15, 0.2, '#ff8a2a', 0.8);
    p.hatch(0.1, 0.3, 0.9, 0.98, { n: 60, len: 0.06, angle: -2, colour: '#000000', alpha: 0.3 });
    p.ink(doom.outline, { width: 0.008 });
  },
};

const ship = {
  outline: [[0.06, 0.7], [0.94, 0.7], [0.8, 0.94], [0.2, 0.94], [0.06, 0.7], [0.48, 0.66], [0.5, 0.04], [0.52, 0.66]],
  draw(p) {
    p.wash([[0.06, 0.7], [0.94, 0.7], [0.8, 0.94], [0.2, 0.94]], '#f4f2ee', { alpha: 1 });
    p.wash([[0.52, 0.08], [0.86, 0.62], [0.52, 0.62]], '#ffffff', { alpha: 1 });
    p.wash([[0.48, 0.12], [0.2, 0.62], [0.48, 0.62]], '#f0eee6', { alpha: 1 });
    p.line([[0.5, 0.04], [0.5, 0.7]], { width: 0.012 });
    p.ink([[0.06, 0.7], [0.94, 0.7], [0.8, 0.94], [0.2, 0.94]], { width: 0.012 });
  },
};

const gulls = {
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]],
  draw(p) {
    for (let i = 0; i < 9; i++) bird(p.ctx, (0.1 + p.r() * 0.8) * p.w, (0.2 + p.r() * 0.6) * p.h, p.w * 0.04, '#5a6470');
  },
};

const ghostLight = (colour) => ({
  outline: ellipse(0.5, 0.5, 0.45, 0.45),
  draw(p) {
    p.glow(0.5, 0.5, 0.5, colour, 1);
  },
});

export const SCENES = {
  marshes: {
    ground(p, page) {
      land(p, '#4f5a48', { blotch: '#2f3a34', seed: 31, n: 16 });
      for (let i = 0; i < 8; i++) p.wash(ellipse(0.1 + ((i * 0.37) % 0.8), 0.3 + ((i * 0.23) % 0.6), 0.08, 0.05), '#2a3a40', { alpha: 0.8 });
      p.hatch(0, 0, 1, 1, { n: 200, len: 0.03, angle: -1.5, colour: '#6a7a4a', alpha: 0.4 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'reeds', kind: 'card', w: 0.44, h: 0.08, at: [0, -0.14], lift: 1, px: 512, art: { outline: ridge(0.5, { amp: 0.7, bumps: 9, seed: 7 }), draw: (p) => { p.wash(ridge(0.5, { amp: 0.7, bumps: 9, seed: 7 }), '#5a6440', { alpha: 0.9 }); p.hatch(0, 0.1, 1, 1, { n: 120, len: 0.1, angle: -1.6, alpha: 0.5 }); } } },
      { id: 'dead-tree', kind: 'card', w: 0.08, h: 0.12, at: [0.15, -0.07], turn: -0.3, lift: 0.8, px: 256, art: tree({ kind: 'dead' }) },
      ...[[-0.12, -0.02], [-0.02, 0.04], [0.08, -0.03], [0.14, 0.06]].map(([x, z], i) => ({ id: `candle-${i}`, kind: 'glow', at: [x, z], y: 0.012, size: 0.035, colour: '#cff0a8', on: true, flicker: true, toy: 'candles' })),
      { id: 'smeagol', kind: 'card', w: 0.045, h: 0.05, at: [-0.06, 0.07], turn: 0.3, lift: 0.3, px: 192, art: smeagol, toy: 'smeagol', does: [{ act: 'hop' }] },
      { id: 'frodo', kind: 'card', w: 0.03, h: 0.05, at: [0.03, 0.09], lift: 0.2, px: 128, art: person({ kind: 'hobbit', robe: '#4f6a8a' }) },
      { id: 'tussocks', kind: 'card', w: 0.12, h: 0.025, at: [0.0, 0.12], lift: 0.1, px: 256, toy: 'tussocks', does: [{ act: 'hop' }], art: { outline: ridge(0.4, { amp: 0.6, bumps: 5, seed: 12 }), draw: (p) => p.wash(ridge(0.4, { amp: 0.6, bumps: 5, seed: 12 }), '#7a8a4a', { alpha: 1 }) } },
      ...[[-0.1, 0.0], [0.1, 0.01]].map(([x, z], i) => ({ id: `face-${i}`, kind: 'card', w: 0.035, h: 0.04, at: [x, z], lift: 0.2, px: 128, ghost: true, find: i === 0, art: face })),
    ],
  },
  'cirith-ungol': {
    ground(p, page) {
      land(p, '#2e2a2e', { blotch: '#1a181c', seed: 33 });
      band(p, [[0.1, 0.95], [0.3, 0.7], [0.4, 0.5], [0.55, 0.35], [0.7, 0.2]], '#5a5458', { width: 0.04 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'mountains', kind: 'card', w: 0.44, h: 0.17, at: [0, -0.14], lift: 1, px: 512, art: peaks({ tops: [[0.1, 0.3], [0.35, 0.1], [0.6, 0.2], [0.9, 0.05]], rock: '#2a2428', dark: true }) },
      { id: 'tower', kind: 'card', w: 0.06, h: 0.2, at: [0.12, -0.1], lift: 0.9, px: 256, art: tower({ stone: '#3a3438', window: '#ff5a2a', dark: true, spikes: true }), toy: 'tower', does: [{ act: 'shine', colour: '#ff5a2a' }] },
      { id: 'web', kind: 'card', w: 0.12, h: 0.1, at: [-0.08, -0.04], turn: 0.2, lift: 0.6, px: 384, art: web, toy: 'web', does: [{ act: 'tear' }], soft: true },
      { id: 'phial', kind: 'card', w: 0.03, h: 0.03, at: [-0.02, 0.05], y: 0.04, lift: 0.3, px: 128, art: phial, toy: 'phial', does: [{ act: 'light', target: ['phial-glow'] }] },
      { id: 'phial-glow', kind: 'glow', at: [-0.02, 0.05], y: 0.05, size: 0.25, colour: '#eaf4ff', on: false },
      { id: 'frodo', kind: 'card', w: 0.03, h: 0.05, at: [-0.03, 0.06], lift: 0.25, px: 128, art: person({ kind: 'hobbit', robe: '#4f6a8a' }) },
      { id: 'sam', kind: 'card', w: 0.03, h: 0.05, at: [0.02, 0.08], lift: 0.2, px: 128, art: person({ kind: 'hobbit', robe: '#7a6a3a' }), toy: 'sam', does: [{ act: 'hop' }] },
      { id: 'eyes', kind: 'card', w: 0.06, h: 0.03, at: [-0.08, -0.05], y: 0.05, lift: 0.6, px: 192, ghost: true, find: true, art: { outline: [[0, 0], [1, 0], [1, 1], [0, 1]], draw: (p) => { for (const [x, y] of [[0.2, 0.4], [0.35, 0.3], [0.5, 0.5], [0.65, 0.3], [0.8, 0.4], [0.42, 0.7], [0.58, 0.7]]) p.glow(x, y, 0.08, '#b8ff9a', 1); } } },
    ],
  },
  beacons: {
    ground(p, page) {
      land(p, '#5a6478', { blotch: '#3a4458', seed: 35 });
      p.dots(Array.from({ length: 30 }, (_, i) => [((i * 31) % 100) / 100, ((i * 17) % 30) / 100, 0.6]), { size: 0.004, colour: '#f2f2e0' });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      ...[[-0.18, -0.14], [-0.09, -0.15], [0.0, -0.14], [0.09, -0.15], [0.18, -0.14]].map(([x, z], i) => ({ id: `peak-${i}`, kind: 'card', w: 0.1, h: 0.12 + (i % 2) * 0.03, at: [x, z], lift: 1, px: 256, art: beacon, toy: 'beacon', does: [{ act: 'chain', target: [0, 1, 2, 3, 4].map((j) => `pyre-${j}`) }] })),
      ...[[0.18, -0.14, 0.12], [0.09, -0.15, 0.15], [0.0, -0.14, 0.12], [-0.09, -0.15, 0.15], [-0.18, -0.14, 0.12]].map(([x, z, h], i) => ({ id: `pyre-${i}`, kind: 'glow', at: [x, z + 0.005], y: h * 0.84, size: 0.06, colour: '#ff9a2a', on: false, flicker: true })),
      { id: 'city', kind: 'card', w: 0.14, h: 0.14, at: [0.05, -0.02], lift: 0.6, px: 512, art: city, toy: 'city', does: [{ act: 'shine', colour: '#ffffff' }] },
      { id: 'pippin', kind: 'card', w: 0.025, h: 0.045, at: [-0.08, 0.05], turn: 0.3, lift: 0.2, px: 128, art: person({ kind: 'hobbit', robe: '#3a3a3a' }), toy: 'pippin', does: [{ act: 'hop' }] },
      { id: 'dead', kind: 'card', w: 0.12, h: 0.08, at: [-0.12, 0.0], lift: 0.4, px: 384, ghost: true, find: true, art: { outline: [[0, 0], [1, 0], [1, 1], [0, 1]], draw: (p) => { for (let i = 0; i < 7; i++) p.glow(0.1 + i * 0.13, 0.5 + Math.sin(i) * 0.15, 0.12, '#bfe8d8', 0.9); } } },
    ],
  },
  doom: {
    ground(p, page) {
      land(p, '#3a302c', { blotch: '#1e1816', seed: 37, n: 14 });
      p.hatch(0, 0, 1, 1, { n: 300, len: 0.01, angle: 0.3, colour: '#6a5a50', alpha: 0.4 });
      band(p, [[0.1, 0.95], [0.4, 0.75], [0.55, 0.55], [0.6, 0.35]], '#ff5a1a', { width: 0.008, ink: false });
      heading(p, page, { colour: '#2b2116' });
      gutter(p);
    },
    pieces: [
      { id: 'barad-dur', kind: 'card', w: 0.06, h: 0.22, at: [0.17, -0.14], lift: 1, px: 256, art: tower({ stone: '#1e1a1c', window: '#ff7a1a', dark: true, spikes: true }) },
      { id: 'eye', kind: 'card', w: 0.07, h: 0.035, at: [0.17, -0.139], y: 0.215, lift: 1, px: 256, art: eye(), toy: 'eye', does: [{ act: 'stare' }] },
      { id: 'mountain', kind: 'card', w: 0.26, h: 0.2, at: [-0.04, -0.09], lift: 0.8, px: 512, art: doom, toy: 'cracks', does: [{ act: 'light', target: ['lava'] }, { act: 'thud' }] },
      { id: 'lava', kind: 'glow', at: [-0.04, -0.08], y: 0.17, size: 0.12, colour: '#ff6a1a', on: true, flicker: true },
      { id: 'frodo', kind: 'card', w: 0.03, h: 0.05, at: [0.0, 0.06], lift: 0.2, px: 128, art: person({ kind: 'hobbit', robe: '#5a5a5a' }), toy: 'frodo', does: [{ act: 'hop' }] },
      { id: 'sam', kind: 'card', w: 0.03, h: 0.05, at: [0.04, 0.07], lift: 0.2, px: 128, art: person({ kind: 'hobbit', robe: '#6a5a3a' }) },
      { id: 'brink', kind: 'card', w: 0.03, h: 0.03, at: [-0.04, -0.07], y: 0.15, lift: 0.8, px: 128, ghost: true, find: true, art: { outline: ellipse(0.5, 0.5, 0.45, 0.45), draw: (p) => { p.glow(0.5, 0.5, 0.5, '#ffd36a', 1); p.ink(ellipse(0.5, 0.5, 0.25, 0.25), { width: 0.1, colour: '#e0b040' }); } } },
      { id: 'fire', kind: 'card', w: 0.03, h: 0.04, at: [-0.04, -0.08], y: 0.16, lift: 0.8, px: 128, art: flame({ colour: '#ff6a1a' }) },
    ],
  },
  havens: {
    ground(p, page) {
      land(p, '#8a9aa8', { blotch: '#6a7a8a', seed: 39 });
      p.wash([[0, 0], [1, 0], [1, 0.55], [0, 0.6]], '#9ab8d0', { alpha: 0.8 });
      p.hatch(0, 0, 1, 0.55, { n: 160, len: 0.04, angle: 0, colour: '#ffffff', alpha: 0.4 });
      band(p, [[0.0, 0.62], [0.4, 0.58], [0.6, 0.6], [1, 0.57]], '#8a8478', { width: 0.04 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'west', kind: 'glow', at: [0, -0.16], y: 0.08, size: 0.4, colour: '#fff2d0', on: true },
      { id: 'ship', kind: 'card', w: 0.1, h: 0.1, at: [0.02, -0.06], lift: 0.8, px: 384, art: ship, toy: 'ship', does: [{ act: 'sail' }] },
      { id: 'gulls', kind: 'card', w: 0.18, h: 0.06, at: [-0.06, -0.08], y: 0.1, lift: 0.9, px: 384, art: gulls, toy: 'gulls', does: [{ act: 'fly' }], soft: true },
      { id: 'quay-lamp', kind: 'card', w: 0.02, h: 0.07, at: [0.13, 0.04], lift: 0.3, px: 128, toy: 'lamp', does: [{ act: 'light', target: ['lamp-glow'] }], art: { outline: [[0.4, 0.98], [0.4, 0.3], [0.2, 0.3], [0.2, 0.05], [0.8, 0.05], [0.8, 0.3], [0.6, 0.3], [0.6, 0.98]], draw: (p) => { p.wash([[0.4, 0.98], [0.4, 0.3], [0.6, 0.3], [0.6, 0.98]], '#3a3a3a', { alpha: 1 }); p.wash([[0.2, 0.3], [0.2, 0.05], [0.8, 0.05], [0.8, 0.3]], '#ffe08a', { alpha: 1 }); } } },
      { id: 'lamp-glow', kind: 'glow', at: [0.13, 0.04], y: 0.06, size: 0.08, colour: '#ffd27a', on: false },
      { id: 'sam', kind: 'card', w: 0.03, h: 0.05, at: [-0.08, 0.06], turn: 0.3, lift: 0.2, px: 128, art: person({ kind: 'hobbit', robe: '#7a6a3a' }) },
      { id: 'road', kind: 'card', w: 0.3, h: 0.08, at: [0, -0.15], y: 0.1, lift: 1, px: 512, ghost: true, find: true, art: { outline: [[0, 1], [0.45, 0], [0.55, 0], [1, 1]], draw: (p) => { p.wash([[0, 1], [0.45, 0], [0.55, 0], [1, 1]], '#fff8e0', { alpha: 0.9 }); p.glow(0.5, 0.1, 0.5, '#ffffff', 1); } } },
    ],
  },
};

// the back pages: their heading and a frame for what the page tells
export const BACK_SCENES = {
  met: { ground: (p, page) => backGround(p, page, 'Those you met along the way, in the order you met them.') },
  kept: { ground: (p, page) => backGround(p, page, 'What you found, and what you were given.') },
};

function backGround(p, page, line) {
  heading(p, { title: page.title, date: 'The back pages' });
  p.text(line, 0.05, 0.22, { size: 0.026, font: 'Georgia, serif', italic: true, weight: 500, colour: '#4a3520', max: 0.4 });
  for (let i = 0; i < 6; i++) {
    const x = 0.56 + (i % 3) * 0.14;
    const y = 0.12 + Math.floor(i / 3) * 0.42;
    p.ink([[x, y], [x + 0.11, y], [x + 0.11, y + 0.34], [x, y + 0.34]], { width: 0.002, colour: '#7a2a18', alpha: 0.6 });
  }
  gutter(p);
}
