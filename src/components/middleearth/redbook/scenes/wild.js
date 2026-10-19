// The middle five pages’ pop-ups: Rivendell, Caradhras, Moria,
// Lothlórien and the Argonath (a piece’s fields: ./shire.js).

import { bird, eye, peaks, person, tree } from '../figures';
import { ellipse, ridge } from '../paint';
import { band, gutter, heading, land } from './ground';

// Elrond’s house: arches and a tower on the valley side, autumn round it
const house = {
  outline: [[0.04, 0.98], [0.04, 0.5], [0.2, 0.36], [0.36, 0.5], [0.42, 0.3], [0.5, 0.06], [0.58, 0.3], [0.64, 0.5], [0.8, 0.36], [0.96, 0.5], [0.96, 0.98]],
  draw(p) {
    p.wash(house.outline, '#e8dcc0', { alpha: 0.9 });
    for (const x of [0.12, 0.26, 0.68, 0.82]) {
      p.wash(ellipse(x, 0.7, 0.05, 0.1, { from: Math.PI, to: Math.PI * 2 }).concat([[x + 0.05, 0.9], [x - 0.05, 0.9]]), '#ffd58a', { alpha: 0.8 });
      p.ink(ellipse(x, 0.7, 0.05, 0.1, { from: Math.PI, to: Math.PI * 2 }).concat([[x + 0.05, 0.9], [x - 0.05, 0.9]]), { width: 0.006 });
    }
    p.wash([[0.42, 0.3], [0.5, 0.06], [0.58, 0.3]], '#a8743a', { alpha: 0.9 });
    p.hatch(0.05, 0.5, 0.95, 0.98, { n: 40, len: 0.05, angle: 0, alpha: 0.2 });
    p.ink(house.outline, { width: 0.008 });
  },
};

// the shards of Narsil on their cloth
const narsil = {
  outline: [[0.02, 0.98], [0.02, 0.55], [0.98, 0.55], [0.98, 0.98]],
  draw(p) {
    p.wash(narsil.outline, '#5a2a3a', { alpha: 0.95 });
    for (const [a, b] of [[[0.1, 0.75], [0.4, 0.7]], [[0.44, 0.72], [0.62, 0.68]], [[0.66, 0.7], [0.9, 0.66]]]) p.line([a, b], { width: 0.03, colour: '#d8dde4' });
    p.ink(narsil.outline, { width: 0.012, colour: '#c9a43a' });
  },
};

// the Council’s ring of chairs
const chairs = {
  outline: (ctx, w, h) => {
    for (let i = 0; i < 5; i++) ctx.rect((0.04 + i * 0.2) * w, 0.3 * h, 0.12 * w, 0.68 * h);
  },
  draw(p) {
    for (let i = 0; i < 5; i++) {
      const x = 0.04 + i * 0.2;
      p.wash([[x, 0.3], [x + 0.12, 0.3], [x + 0.12, 0.98], [x, 0.98]], '#8a5a2a', { alpha: 0.95 });
      p.ink([[x, 0.3], [x + 0.12, 0.3], [x + 0.12, 0.98], [x, 0.98]], { width: 0.01 });
    }
  },
};

// Bilbo’s book, red, open on a lectern
const redBook = {
  outline: [[0.1, 0.98], [0.4, 0.6], [0.1, 0.3], [0.5, 0.2], [0.9, 0.3], [0.6, 0.6], [0.9, 0.98]],
  draw(p) {
    p.wash([[0.1, 0.3], [0.5, 0.2], [0.9, 0.3], [0.5, 0.42]], '#f4ead2', { alpha: 1 });
    p.wash([[0.1, 0.3], [0.5, 0.42], [0.9, 0.3], [0.9, 0.36], [0.5, 0.48], [0.1, 0.36]], '#8a1f1a', { alpha: 1 });
    p.wash([[0.4, 0.98], [0.46, 0.46], [0.54, 0.46], [0.6, 0.98]], '#6a4a2a', { alpha: 1 });
    p.hatch(0.15, 0.24, 0.85, 0.36, { n: 30, len: 0.06, angle: 0.1, alpha: 0.4 });
  },
};

// the Doors of Durin: an arch on the cliff, its silver lines dark until the moon
const doors = (lit) => ({
  outline: [[0.04, 0.98], [0.04, 0.04], [0.96, 0.04], [0.96, 0.98]],
  draw(p) {
    p.wash([[0.04, 0.98], [0.04, 0.04], [0.96, 0.04], [0.96, 0.98]], '#4a4e5a', { alpha: 0.95 });
    p.hatch(0.05, 0.05, 0.95, 0.95, { n: 120, len: 0.05, angle: -1.9, alpha: 0.3, colour: '#22252c' });
    const arch = [...ellipse(0.5, 0.42, 0.26, 0.3, { from: Math.PI, to: Math.PI * 2, n: 24 }), [0.76, 0.96], [0.24, 0.96]];
    p.wash(arch, '#2c303a', { alpha: 0.9 });
    if (!lit) return;
    const silver = { width: 0.008, colour: '#e8f2ff', alpha: 0.95 };
    p.ink(arch, silver);
    p.line([[0.5, 0.14], [0.5, 0.96]], silver);
    p.ink(ellipse(0.5, 0.36, 0.06, 0.06), silver);
    p.line([[0.38, 0.6], [0.36, 0.3], [0.32, 0.22]], silver);
    p.line([[0.62, 0.6], [0.64, 0.3], [0.68, 0.22]], silver);
    p.dots([[0.42, 0.24], [0.5, 0.2], [0.58, 0.24], [0.46, 0.18], [0.54, 0.18]], { size: 0.01, colour: '#e8f2ff' });
    p.glow(0.5, 0.36, 0.2, '#cfe4ff', 0.5);
  },
});

// the Mirror: a silver basin on a pedestal
const basin = {
  outline: [[0.1, 0.36], [0.9, 0.36], [0.7, 0.6], [0.56, 0.62], [0.6, 0.98], [0.4, 0.98], [0.44, 0.62], [0.3, 0.6]],
  draw(p) {
    p.wash(basin.outline, '#c8ccd4', { alpha: 0.95 });
    p.wash(ellipse(0.5, 0.38, 0.38, 0.06), '#5a7a9a', { alpha: 0.9 });
    p.ink(basin.outline, { width: 0.012 });
  },
};

// the Pillars of the Kings: a stone king, his left hand raised
const king = (flip) => {
  const f = (pts) => (flip ? pts.map(([x, y]) => [1 - x, y]) : pts);
  const body = f([[0.2, 0.98], [0.26, 0.4], [0.36, 0.2], [0.44, 0.12], [0.56, 0.12], [0.64, 0.2], [0.7, 0.4], [0.86, 0.3], [0.96, 0.04], [1, 0.08], [0.9, 0.42], [0.76, 0.56], [0.8, 0.98]]);
  return {
    outline: body,
    draw(p) {
      p.wash(body, '#8f8b7e', { alpha: 0.95 });
      p.hatch(0.2, 0.2, 0.8, 0.98, { n: 60, len: 0.06, angle: 1.4, alpha: 0.3 });
      p.wash(f([[0.4, 0.12], [0.44, 0.02], [0.5, 0.06], [0.56, 0.02], [0.6, 0.12]]), '#a8a08a', { alpha: 1 });
      p.ink(body, { width: 0.008 });
    },
  };
};

const boat = {
  outline: [[0.02, 0.5], [0.98, 0.5], [0.8, 0.9], [0.2, 0.9]],
  draw(p) {
    p.wash(boat.outline, '#c8c4b4', { alpha: 1 });
    p.ink(boat.outline, { width: 0.02 });
  },
};

const flock = {
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]],
  draw(p) {
    for (let i = 0; i < 26; i++) bird(p.ctx, (0.1 + p.r() * 0.8) * p.w, (0.15 + p.r() * 0.7) * p.h, p.w * (0.02 + p.r() * 0.02), '#15110e');
  },
};

const lamp = (colour) => ({
  outline: ellipse(0.5, 0.5, 0.4, 0.4),
  draw(p) {
    p.glow(0.5, 0.5, 0.5, colour, 1);
    p.wash(ellipse(0.5, 0.5, 0.2, 0.2), '#ffffff', { alpha: 0.8 });
  },
});

export const SCENES = {
  rivendell: {
    ground(p, page) {
      land(p, '#8a8a4a', { blotch: '#b8783a', seed: 21, n: 14 });
      band(p, [[0.5, 0], [0.48, 0.3], [0.56, 0.6], [0.5, 1]], '#9fc0d6', { width: 0.04 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'cliffs', kind: 'card', w: 0.44, h: 0.16, at: [0, -0.15], lift: 1, px: 512, art: peaks({ tops: [[0.1, 0.1], [0.3, 0.3], [0.7, 0.25], [0.9, 0.06]], rock: '#7a7468', snow: null }) },
      { id: 'house', kind: 'card', w: 0.2, h: 0.12, at: [0.02, -0.08], lift: 0.8, px: 512, art: house },
      { id: 'tree-l', kind: 'card', w: 0.07, h: 0.1, at: [-0.16, -0.05], turn: 0.3, lift: 0.7, px: 256, art: tree({ kind: 'oak', leaf: '#c8843a', seed: 4 }) },
      { id: 'tree-r', kind: 'card', w: 0.07, h: 0.11, at: [0.17, -0.04], turn: -0.3, lift: 0.7, px: 256, art: tree({ kind: 'oak', leaf: '#d4a03a', seed: 5 }) },
      { id: 'chairs', kind: 'card', w: 0.14, h: 0.04, at: [-0.05, 0.02], lift: 0.4, px: 384, art: chairs, toy: 'council', does: [{ act: 'hop' }] },
      { id: 'narsil', kind: 'card', w: 0.07, h: 0.04, at: [0.1, 0.06], lift: 0.2, px: 256, art: narsil, toy: 'narsil', does: [{ act: 'shine', colour: '#dfe8ff' }] },
      { id: 'book', kind: 'card', w: 0.05, h: 0.05, at: [-0.14, 0.07], turn: 0.3, lift: 0.1, px: 192, art: redBook, toy: 'book', does: [{ act: 'hop' }] },
      { id: 'plinth', kind: 'card', w: 0.03, h: 0.03, at: [-0.05, 0.03], y: 0.035, lift: 0.4, px: 128, ghost: true, find: true, art: lamp('#ff8a2a') },
    ],
  },
  caradhras: {
    ground(p, page) {
      land(p, '#dfe4ea', { blotch: '#b8c0cc', seed: 23, n: 12 });
      p.hatch(0, 0, 1, 1, { n: 200, len: 0.01, angle: 0.8, colour: '#8a94a6', alpha: 0.35 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'redhorn', kind: 'card', w: 0.44, h: 0.22, at: [0, -0.13], lift: 1, px: 512, art: peaks({ tops: [[0.15, 0.4], [0.45, 0.05], [0.75, 0.3]], rock: '#9a5a4a', snow: '#ffffff' }) },
      { id: 'snow', kind: 'card', w: 0.44, h: 0.14, at: [0, -0.02], lift: 0.6, px: 512, toy: 'snow', does: [{ act: 'sway' }], soft: true, art: { outline: [[0, 0], [1, 0], [1, 1], [0, 1]], draw: (p) => p.dots(Array.from({ length: 120 }, () => [p.r(), p.r(), 0.5 + p.r()]), { size: 0.006, colour: '#ffffff' }) } },
      { id: 'crebain', kind: 'card', w: 0.16, h: 0.06, at: [-0.08, -0.08], y: 0.12, lift: 0.9, px: 384, art: flock, toy: 'crebain', does: [{ act: 'fly' }], soft: true },
      { id: 'gimli', kind: 'card', w: 0.04, h: 0.06, at: [0.06, 0.06], turn: -0.2, lift: 0.2, px: 192, art: person({ kind: 'dwarf', robe: '#7a4a2a' }), toy: 'gimli', does: [{ act: 'hop' }] },
      { id: 'company', kind: 'card', w: 0.04, h: 0.1, at: [-0.04, 0.04], lift: 0.3, px: 192, art: person({ kind: 'wizard', robe: '#8a8e96' }) },
      { id: 'voice', kind: 'card', w: 0.08, h: 0.06, at: [0.12, -0.02], y: 0.08, lift: 0.6, px: 256, ghost: true, find: true, art: eye() },
    ],
  },
  moria: {
    ground(p, page) {
      land(p, '#3e4450', { blotch: '#2a2f38', seed: 25 });
      p.wash(ellipse(0.5, 0.72, 0.36, 0.2), '#1a2230', { alpha: 0.9 });
      p.hatch(0.18, 0.56, 0.82, 0.88, { n: 60, len: 0.05, angle: 0, colour: '#6a7a90', alpha: 0.35 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'cliff', kind: 'card', w: 0.3, h: 0.22, at: [0, -0.13], lift: 1, px: 512, art: doors(false), toy: 'doors', does: [{ act: 'speak' }] },
      { id: 'cliff-lit', kind: 'card', w: 0.3, h: 0.22, at: [0, -0.129], lift: 1, px: 512, art: doors(true), hidden: true },
      { id: 'moon', kind: 'card', w: 0.05, h: 0.05, at: [-0.17, -0.12], y: 0.18, lift: 0.95, px: 192, art: lamp('#e8eeff'), toy: 'moon', does: [{ act: 'show', target: ['cliff-lit'] }] },
      { id: 'pool', kind: 'card', w: 0.16, h: 0.04, at: [0, 0.06], lift: 0.2, px: 384, art: { outline: ridge(0.5, { amp: 0.6, bumps: 4, seed: 9 }), draw: (p) => { p.wash(ridge(0.5, { amp: 0.6, bumps: 4, seed: 9 }), '#2a3a52', { alpha: 0.9 }); p.hatch(0, 0.4, 1, 1, { n: 30, len: 0.08, angle: 0, colour: '#9fb4d0', alpha: 0.6 }); } }, toy: 'pool', does: [{ act: 'tentacle' }] },
      { id: 'tentacle', kind: 'card', w: 0.03, h: 0.1, at: [0.05, 0.05], lift: 0.2, px: 128, hidden: true, art: { outline: [[0.3, 0.98], [0.4, 0.5], [0.6, 0.2], [0.8, 0.02], [0.7, 0.3], [0.6, 0.6], [0.7, 0.98]], draw: (p) => p.wash([[0.3, 0.98], [0.4, 0.5], [0.6, 0.2], [0.8, 0.02], [0.7, 0.3], [0.6, 0.6], [0.7, 0.98]], '#3a4a3a', { alpha: 1 }) } },
      { id: 'drum', kind: 'card', w: 0.04, h: 0.03, at: [0.15, 0.08], lift: 0.1, px: 128, toy: 'drum', does: [{ act: 'thud' }], art: { outline: ellipse(0.5, 0.5, 0.45, 0.4), draw: (p) => { p.wash(ellipse(0.5, 0.5, 0.45, 0.4), '#6a3a2a', { alpha: 1 }); p.ink(ellipse(0.5, 0.5, 0.45, 0.4), { width: 0.04 }); } } },
      { id: 'durin', kind: 'card', w: 0.07, h: 0.05, at: [0, -0.125], y: 0.15, lift: 1, px: 256, ghost: true, find: true, art: { outline: ellipse(0.5, 0.5, 0.45, 0.45), draw: (p) => { p.glow(0.5, 0.5, 0.5, '#e8f2ff', 1); p.dots([[0.3, 0.3], [0.5, 0.2], [0.7, 0.3], [0.4, 0.6], [0.6, 0.6], [0.5, 0.45]], { size: 0.03, colour: '#ffffff' }); } } },
    ],
  },
  lorien: {
    ground(p, page) {
      land(p, '#b8a24a', { blotch: '#d8c060', seed: 27, n: 12 });
      p.hatch(0, 0, 1, 1, { n: 200, len: 0.015, angle: 0.4, colour: '#8a7a2a', alpha: 0.35 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      ...[[-0.16, -0.1, 0.18], [0.0, -0.13, 0.22], [0.16, -0.1, 0.19]].map(([x, z, h], i) => ({ id: `mallorn-${i}`, kind: 'card', w: 0.1, h, at: [x, z], turn: -x, lift: 0.9, px: 384, art: tree({ kind: 'mallorn', leaf: '#e0b83a', seed: i }) })),
      { id: 'lamps', kind: 'glow', at: [0, -0.1], y: 0.15, size: 0.3, colour: '#dfe8ff', on: true, toy: 'lamps' },
      { id: 'lamp-card', kind: 'card', w: 0.24, h: 0.05, at: [0, -0.09], y: 0.12, lift: 0.95, px: 512, soft: true, toy: 'lamps', does: [{ act: 'light', target: ['lamps'] }], art: { outline: [[0, 0], [1, 0], [1, 1], [0, 1]], draw: (p) => p.dots([[0.1, 0.5], [0.3, 0.3], [0.5, 0.6], [0.7, 0.4], [0.9, 0.5]], { size: 0.12, colour: '#f0f4ff' }) } },
      { id: 'basin', kind: 'card', w: 0.06, h: 0.05, at: [0.03, 0.03], lift: 0.3, px: 256, art: basin, toy: 'basin', does: [{ act: 'show', target: ['vision'], for: 3 }] },
      { id: 'vision', kind: 'card', w: 0.05, h: 0.03, at: [0.03, 0.025], y: 0.05, lift: 0.3, px: 192, hidden: true, art: eye() },
      { id: 'galadriel', kind: 'card', w: 0.04, h: 0.11, at: [-0.06, 0.02], turn: 0.2, lift: 0.4, px: 192, art: person({ kind: 'elf', robe: '#f2f0e8', hair: '#e8c86a', light: '#ffffff' }), toy: 'galadriel', does: [{ act: 'shine', colour: '#ffffff' }] },
      { id: 'eye', kind: 'card', w: 0.04, h: 0.025, at: [0.03, 0.035], y: 0.07, lift: 0.3, px: 128, ghost: true, find: true, art: eye() },
    ],
  },
  anduin: {
    ground(p, page) {
      land(p, '#6a7a5a', { blotch: '#4f5f42', seed: 29 });
      band(p, [[0.5, 0], [0.48, 0.4], [0.52, 0.7], [0.5, 1]], '#6f98b4', { width: 0.26, alpha: 0.9 });
      p.hatch(0.38, 0, 0.62, 1, { n: 140, len: 0.03, angle: 1.5, colour: '#ffffff', alpha: 0.4 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'falls', kind: 'card', w: 0.2, h: 0.06, at: [0, -0.15], lift: 1, px: 384, toy: 'falls', does: [{ act: 'sway' }], art: { outline: ridge(0.4, { amp: 0.4, bumps: 2, seed: 3 }), draw: (p) => { p.wash(ridge(0.4, { amp: 0.4, bumps: 2, seed: 3 }), '#d8e8f4', { alpha: 0.9 }); p.hatch(0.1, 0.2, 0.9, 1, { n: 60, len: 0.08, angle: 1.57, colour: '#ffffff', alpha: 0.8 }); } } },
      { id: 'king-l', kind: 'card', w: 0.09, h: 0.2, at: [-0.11, -0.07], turn: 0.35, lift: 0.8, px: 384, art: king(false), toy: 'kings', does: [{ act: 'raise' }] },
      { id: 'king-r', kind: 'card', w: 0.09, h: 0.2, at: [0.11, -0.07], turn: -0.35, lift: 0.8, px: 384, art: king(true), toy: 'kings', does: [{ act: 'raise' }] },
      ...[0, 1, 2].map((i) => ({ id: `boat-${i}`, kind: 'card', w: 0.05, h: 0.015, at: [-0.02 + i * 0.025, 0.02 + i * 0.04], lift: 0.2, px: 128, art: boat, toy: 'boats', does: [{ act: 'sail' }] })),
      { id: 'aragorn', kind: 'card', w: 0.03, h: 0.06, at: [-0.02, 0.02], y: 0.008, lift: 0.25, px: 128, art: person({ kind: 'ranger', robe: '#4a5442' }), toy: 'aragorn', does: [{ act: 'hop' }] },
      { id: 'isildur', kind: 'card', w: 0.04, h: 0.1, at: [0.05, -0.02], lift: 0.4, px: 192, ghost: true, find: true, art: person({ kind: 'king', robe: '#d9e2ee', skin: '#eef3fa' }) },
    ],
  },
};
