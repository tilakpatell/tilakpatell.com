// The first five pages’ pop-ups: Bag End, the Shire’s edge, Bree,
// Weathertop and the Ford. A piece: { id, kind: 'card' | 'mound' | 'glow',
// w, h (metres), at: [x, z] on the spread (x ±0.24 across, z ±0.165, the
// reader at +z), turn (radians about the upright), lift (0 rises first, 1
// last), art ({ outline, draw }: ../figures.js), toy (the page’s toy it
// is), does (what touching it does: ../popupMesh.js’s acts), ghost (shown
// only under the Ring), find (the page’s thing to find) }.

import { ellipse, ridge } from '../paint';
import { eye, flame, peaks, person, rider, tree } from '../figures';
import { GRASS, NIGHT, band, gutter, heading, land } from './ground';

// a hill with a round green door in it, Bag End’s
const smial = {
  outline: ridge(0.35, { amp: 0.5, bumps: 1, seed: 2, bottom: 0.98 }),
  draw(p) {
    p.wash(ridge(0.35, { amp: 0.5, bumps: 1, seed: 2, bottom: 0.98 }), '#7f9c4f', { alpha: 0.85 });
    p.hatch(0.05, 0.2, 0.95, 0.9, { n: 120, len: 0.03, angle: -1.4, colour: '#3c5a22', alpha: 0.35 });
    p.wash(ellipse(0.5, 0.78, 0.15, 0.2), '#2f6a3a', { alpha: 1 });
    p.ink(ellipse(0.5, 0.78, 0.15, 0.2), { width: 0.01 });
    p.dots([[0.5, 0.78]], { size: 0.02, colour: '#c9a43a' });
    p.wash(ellipse(0.24, 0.66, 0.06, 0.07), '#f6d58a', { alpha: 0.9 });
    p.wash(ellipse(0.76, 0.66, 0.06, 0.07), '#f6d58a', { alpha: 0.9 });
    p.ink(ellipse(0.24, 0.66, 0.06, 0.07), { width: 0.008 });
    p.ink(ellipse(0.76, 0.66, 0.06, 0.07), { width: 0.008 });
    p.line([[0.12, 0.98], [0.3, 0.9], [0.5, 0.98]], { width: 0.006, alpha: 0.4 });
  },
};

// a green dragon of sparks, Gandalf’s best, on a rocket’s trail
const dragon = {
  outline: [[0.05, 0.6], [0.2, 0.42], [0.35, 0.46], [0.5, 0.3], [0.62, 0.06], [0.7, 0.3], [0.86, 0.12], [0.8, 0.4], [0.95, 0.5], [0.72, 0.6], [0.5, 0.62], [0.42, 0.98], [0.36, 0.98], [0.38, 0.64], [0.2, 0.66]],
  draw(p) {
    p.wash(dragon.outline, '#3b8a4a', { alpha: 0.9 });
    p.dots([[0.84, 0.46], [0.3, 0.5], [0.6, 0.4], [0.7, 0.2]], { size: 0.02, colour: '#ffe28a' });
    p.hatch(0.1, 0.35, 0.9, 0.6, { n: 40, len: 0.05, angle: 0.3, colour: '#d4ffb0', alpha: 0.6 });
    p.ink(dragon.outline, { width: 0.008 });
  },
};

// the party tree hung with lanterns
const partyTree = (() => {
  const t = tree({ kind: 'oak', leaf: '#5f7f32', seed: 0.4 });
  return {
    outline: t.outline,
    draw(p) {
      t.draw(p);
      p.dots([[0.3, 0.42], [0.45, 0.3], [0.62, 0.36], [0.72, 0.46], [0.38, 0.22], [0.55, 0.18], [0.24, 0.5]], { size: 0.03, colour: '#ffcf5a' });
    },
  };
})();

// the Prancing Pony: a tall inn, lit windows, a sign on a bracket
const inn = {
  outline: [[0.06, 0.98], [0.06, 0.38], [0.5, 0.06], [0.94, 0.38], [0.94, 0.98]],
  draw(p) {
    p.wash([[0.06, 0.98], [0.06, 0.38], [0.94, 0.38], [0.94, 0.98]], '#b9a07a', { alpha: 0.85 });
    p.wash([[0.06, 0.38], [0.5, 0.06], [0.94, 0.38]], '#5a4c46', { alpha: 0.9 });
    p.hatch(0.1, 0.12, 0.9, 0.36, { n: 60, len: 0.04, angle: 0.2, alpha: 0.3 });
    for (const [x, y] of [[0.2, 0.5], [0.42, 0.5], [0.64, 0.5], [0.2, 0.72], [0.64, 0.72]]) {
      p.glow(x + 0.06, y + 0.06, 0.12, '#ffcf6a', 0.6);
      p.wash([[x, y], [x + 0.12, y], [x + 0.12, y + 0.12], [x, y + 0.12]], '#ffd27a', { alpha: 1 });
      p.ink([[x, y], [x + 0.12, y], [x + 0.12, y + 0.12], [x, y + 0.12]], { width: 0.006 });
    }
    p.wash([[0.42, 0.98], [0.42, 0.74], [0.56, 0.74], [0.56, 0.98]], '#4a3020', { alpha: 1 });
    p.line([[0.06, 0.38], [0.94, 0.38]], { width: 0.01 });
    p.ink([[0.06, 0.98], [0.06, 0.38], [0.5, 0.06], [0.94, 0.38], [0.94, 0.98]], { width: 0.01 });
  },
};

// the inn sign: a white pony rearing on a board
const sign = {
  outline: [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]],
  draw(p) {
    p.wash(sign.outline, '#6a4a2a', { alpha: 1 });
    p.wash([[0.3, 0.8], [0.4, 0.5], [0.36, 0.3], [0.5, 0.2], [0.6, 0.36], [0.72, 0.5], [0.66, 0.8], [0.6, 0.6], [0.44, 0.62]], '#f2efe6', { alpha: 1 });
    p.ink(sign.outline, { width: 0.02, colour: '#c9a43a' });
  },
};

// rain on a card: long fine strokes slanting
const rain = {
  outline: [[0, 0], [1, 0], [1, 1], [0, 1]],
  draw(p) {
    p.hatch(0, 0, 1, 1, { n: 140, len: 0.12, angle: 1.9, colour: '#c8d4e4', alpha: 0.7, width: 0.004 });
  },
};

// Weathertop: a steep hill crowned with a broken ring of stones
const amonSul = {
  outline: [[0, 0.98], [0.2, 0.6], [0.32, 0.3], [0.38, 0.18], [0.4, 0.08], [0.48, 0.12], [0.56, 0.06], [0.62, 0.14], [0.66, 0.2], [0.72, 0.36], [0.84, 0.62], [1, 0.98]],
  draw(p) {
    p.wash(amonSul.outline, '#596b52', { alpha: 0.9 });
    p.wash([[0.36, 0.22], [0.4, 0.08], [0.48, 0.12], [0.56, 0.06], [0.62, 0.14], [0.66, 0.22]], '#8e8a84', { alpha: 0.9 });
    p.hatch(0.1, 0.3, 0.9, 0.95, { n: 90, len: 0.05, angle: -1.9, alpha: 0.35 });
    p.ink(amonSul.outline, { width: 0.008 });
  },
};

// the Ford: a band of water standing up as white horses
const flood = {
  outline: [[0, 0.98], [0, 0.5], [0.1, 0.3], [0.16, 0.42], [0.26, 0.2], [0.34, 0.38], [0.46, 0.12], [0.54, 0.36], [0.66, 0.18], [0.74, 0.4], [0.84, 0.22], [0.92, 0.42], [1, 0.3], [1, 0.98]],
  draw(p) {
    p.wash(flood.outline, '#9fc0d6', { alpha: 0.9 });
    p.wash([[0.08, 0.36], [0.14, 0.28], [0.22, 0.3], [0.2, 0.44]], '#ffffff', { alpha: 1 });
    p.wash([[0.42, 0.22], [0.46, 0.12], [0.54, 0.18], [0.5, 0.32]], '#ffffff', { alpha: 1 });
    p.wash([[0.8, 0.3], [0.84, 0.22], [0.9, 0.26], [0.88, 0.38]], '#ffffff', { alpha: 1 });
    p.hatch(0.05, 0.4, 0.95, 0.95, { n: 60, len: 0.06, angle: 0.15, colour: '#ffffff', alpha: 0.7 });
    p.ink(flood.outline, { width: 0.008, colour: '#2a4a5a' });
  },
};

// a ghost: the same figure, washed in the wraith-world’s pale light
const pale = (kind) => person({ kind, robe: '#d9e2ee', skin: '#eef3fa', hair: '#d0d8e4' });

const crown = {
  outline: [[0.1, 0.9], [0.1, 0.3], [0.3, 0.55], [0.5, 0.1], [0.7, 0.55], [0.9, 0.3], [0.9, 0.9]],
  draw(p) {
    p.wash(crown.outline, '#e8eef8', { alpha: 0.95 });
    p.ink(crown.outline, { width: 0.02, colour: '#9fb0c8' });
  },
};

export const SCENES = {
  'bag-end': {
    ground(p, page) {
      land(p, GRASS, { blotch: '#6f8f3e', seed: 3 });
      band(p, [[0.05, 0.92], [0.3, 0.8], [0.52, 0.72], [0.7, 0.8], [0.98, 0.7]], '#c8a978', { width: 0.04 });
      band(p, [[0.6, 0.98], [0.66, 0.86], [0.76, 0.7], [0.9, 0.6]], '#c8a978', { width: 0.02 });
      p.hatch(0.05, 0.2, 0.95, 0.98, { n: 260, len: 0.012, angle: -1.3, colour: '#4c6a2a', alpha: 0.35 });
      p.dots([[0.35, 0.55, 1.2], [0.38, 0.58], [0.82, 0.88], [0.12, 0.6, 0.8]], { size: 0.012, colour: '#e86a5a' });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'hill', kind: 'card', w: 0.26, h: 0.13, at: [0.04, -0.08], lift: 0.9, px: 512, art: smial, toy: 'door', does: [{ act: 'knock' }, { act: 'light', target: ['door'] }] },
      { id: 'door', kind: 'glow', at: [0.04, -0.07], y: 0.03, size: 0.08, colour: '#ffcf6a', on: false },
      { id: 'tree', kind: 'card', w: 0.12, h: 0.16, at: [-0.15, -0.04], turn: 0.4, lift: 0.7, px: 384, art: partyTree, toy: 'lanterns', does: [{ act: 'light', target: ['lanterns'] }] },
      { id: 'lanterns', kind: 'glow', at: [-0.15, -0.035], y: 0.1, size: 0.12, colour: '#ffcf5a', on: false },
      { id: 'gandalf', kind: 'card', w: 0.045, h: 0.11, at: [0.12, 0.05], turn: -0.3, lift: 0.2, px: 256, art: person({ kind: 'wizard', robe: '#8a8e96' }), toy: 'gandalf', does: [{ act: 'hop' }] },
      { id: 'bilbo', kind: 'card', w: 0.035, h: 0.06, at: [-0.03, 0.06], turn: 0.2, lift: 0.1, px: 192, art: person({ kind: 'hobbit', robe: '#a8452c' }), does: [{ act: 'hop' }] },
      { id: 'dragon', kind: 'card', w: 0.12, h: 0.09, at: [-0.02, -0.12], y: 0.11, lift: 1, px: 384, art: dragon, toy: 'dragon', does: [{ act: 'burst', colour: '#9cff7a' }, { act: 'fly' }] },
      { id: 'envelope', kind: 'card', w: 0.04, h: 0.03, at: [-0.08, 0.1], lift: 0.3, px: 128, ghost: true, find: true, art: { outline: [[0, 0.2], [1, 0.2], [1, 1], [0, 1]], draw: (p) => { p.wash([[0, 0.2], [1, 0.2], [1, 1], [0, 1]], '#f6efe0', { alpha: 1 }); p.glow(0.5, 0.6, 0.5, '#ffd36a', 1); p.ink(ellipse(0.5, 0.6, 0.2, 0.22), { width: 0.06, colour: '#d9a83a' }); } } },
    ],
  },
  'shire-edge': {
    ground(p, page) {
      land(p, '#7d9a58', { blotch: '#4f6b34', seed: 5, n: 14 });
      band(p, [[0, 0.62], [0.25, 0.58], [0.5, 0.66], [0.75, 0.56], [1, 0.6]], '#b49a6a', { width: 0.06 });
      p.hatch(0, 0, 1, 0.5, { n: 200, len: 0.02, angle: -1.1, colour: '#2c4020', alpha: 0.4 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'wood-l', kind: 'card', w: 0.1, h: 0.15, at: [-0.16, -0.1], turn: 0.2, lift: 0.9, px: 384, art: tree({ kind: 'oak', leaf: '#3f5a2a', seed: 1 }) },
      { id: 'wood-r', kind: 'card', w: 0.11, h: 0.17, at: [0.15, -0.11], turn: -0.2, lift: 0.95, px: 384, art: tree({ kind: 'oak', leaf: '#4a6630', seed: 2 }) },
      { id: 'roots', kind: 'card', w: 0.14, h: 0.12, at: [-0.04, -0.05], lift: 0.7, px: 384, art: tree({ kind: 'dead', seed: 3 }), toy: 'roots', does: [{ act: 'sway' }] },
      { id: 'rider', kind: 'card', w: 0.11, h: 0.1, at: [0.08, 0.02], turn: -0.15, lift: 0.4, px: 384, art: rider(), toy: 'rider', does: [{ act: 'sniff' }] },
      { id: 'frodo', kind: 'card', w: 0.03, h: 0.05, at: [-0.06, -0.01], lift: 0.5, px: 128, art: person({ kind: 'hobbit', robe: '#4f6a8a' }) },
      { id: 'mushrooms', kind: 'card', w: 0.05, h: 0.04, at: [-0.13, 0.08], lift: 0.1, px: 192, toy: 'mushrooms', does: [{ act: 'hop' }], art: { outline: [[0.05, 0.98], [0.05, 0.5], [0.3, 0.2], [0.7, 0.2], [0.95, 0.5], [0.95, 0.98]], draw: (p) => { p.wash([[0.05, 0.98], [0.05, 0.5], [0.95, 0.5], [0.95, 0.98]], '#8a6a3a', { alpha: 1 }); for (const x of [0.25, 0.5, 0.75]) p.wash(ellipse(x, 0.4, 0.14, 0.12), '#efe2c8', { alpha: 1 }); p.ink([[0.05, 0.98], [0.05, 0.5], [0.95, 0.5], [0.95, 0.98]], { width: 0.02 }); } } },
      { id: 'crown', kind: 'card', w: 0.04, h: 0.03, at: [0.09, 0.0], y: 0.105, lift: 0.4, px: 128, ghost: true, find: true, art: crown },
    ],
  },
  bree: {
    ground(p, page) {
      land(p, '#7c8a6a', { blotch: '#5a6650', seed: 8 });
      band(p, [[0, 0.8], [0.4, 0.74], [0.7, 0.8], [1, 0.76]], '#8a7a5a', { width: 0.07 });
      p.hatch(0, 0, 1, 1, { n: 300, len: 0.04, angle: 1.9, colour: '#4a5a70', alpha: 0.25 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'hill', kind: 'card', w: 0.4, h: 0.12, at: [0, -0.14], lift: 1, px: 512, art: { outline: ridge(0.3, { amp: 0.4, bumps: 1.3, seed: 4 }), draw: (p) => { p.wash(ridge(0.3, { amp: 0.4, bumps: 1.3, seed: 4 }), '#3d4a3c', { alpha: 0.9 }); p.dots([[0.2, 0.6], [0.3, 0.55], [0.7, 0.62], [0.82, 0.58]], { size: 0.012, colour: '#ffcf6a' }); } } },
      { id: 'inn', kind: 'card', w: 0.16, h: 0.15, at: [0.02, -0.05], lift: 0.7, px: 512, art: inn, toy: 'bell', does: [{ act: 'hop' }, { act: 'light', target: ['inn-glow'] }] },
      { id: 'inn-glow', kind: 'glow', at: [0.02, -0.03], y: 0.06, size: 0.2, colour: '#ffb84a', on: true },
      { id: 'sign', kind: 'card', w: 0.04, h: 0.035, at: [0.12, -0.02], y: 0.06, lift: 0.6, px: 128, art: sign, toy: 'sign', does: [{ act: 'swing' }] },
      { id: 'rain', kind: 'card', w: 0.44, h: 0.16, at: [0, 0.03], lift: 0.2, px: 512, art: rain, toy: 'rain', does: [{ act: 'sway' }], soft: true },
      { id: 'strider', kind: 'card', w: 0.04, h: 0.085, at: [-0.15, 0.0], turn: 0.4, lift: 0.4, px: 192, art: person({ kind: 'ranger', robe: '#3a4436' }), toy: 'strider', does: [{ act: 'hop' }] },
      { id: 'pint', kind: 'card', w: 0.03, h: 0.04, at: [-0.08, 0.08], lift: 0.1, px: 128, ghost: true, find: true, art: eye() },
    ],
  },
  weathertop: {
    ground(p, page) {
      land(p, NIGHT, { blotch: '#4a5262', seed: 11 });
      p.dots(Array.from({ length: 40 }, (_, i) => [((i * 37) % 100) / 100, ((i * 53) % 40) / 100, 0.6]), { size: 0.004, colour: '#f2f2e0' });
      heading(p, page, { colour: '#2b2116' });
      gutter(p);
    },
    pieces: [
      { id: 'hill', kind: 'card', w: 0.3, h: 0.17, at: [0.02, -0.08], lift: 0.9, px: 512, art: amonSul },
      { id: 'fire', kind: 'card', w: 0.03, h: 0.04, at: [0.02, -0.03], y: 0.0, lift: 0.3, px: 128, art: flame(), toy: 'fire', does: [{ act: 'light', target: ['fire-glow'] }] },
      { id: 'fire-glow', kind: 'glow', at: [0.02, -0.02], y: 0.02, size: 0.12, colour: '#ff9a3a', on: false, flicker: true },
      ...[-0.13, -0.08, 0.12, 0.16, 0.07].map((x, i) => ({ id: `wraith-${i}`, kind: 'card', w: 0.035, h: 0.09, at: [x, 0.02 + (i % 2) * 0.03], turn: x < 0 ? 0.4 : -0.4, lift: 0.5, px: 192, art: person({ kind: 'wraith', robe: '#16141a' }), toy: 'wraiths', does: [{ act: 'creep' }] })),
      { id: 'sam', kind: 'card', w: 0.03, h: 0.05, at: [-0.03, 0.07], lift: 0.1, px: 128, art: person({ kind: 'hobbit', robe: '#7a6a3a' }), toy: 'pans', does: [{ act: 'hop' }] },
      { id: 'blade', kind: 'card', w: 0.02, h: 0.07, at: [0.05, 0.08], lift: 0.2, px: 128, ghost: true, find: true, art: { outline: [[0.4, 0.98], [0.4, 0.75], [0.1, 0.72], [0.1, 0.66], [0.45, 0.66], [0.5, 0.02], [0.55, 0.66], [0.9, 0.66], [0.9, 0.72], [0.6, 0.75], [0.6, 0.98]], draw: (p) => { p.wash([[0.4, 0.98], [0.4, 0.66], [0.45, 0.66], [0.5, 0.02], [0.55, 0.66], [0.6, 0.66], [0.6, 0.98]], '#cfe0f0', { alpha: 1 }); p.glow(0.5, 0.4, 0.5, '#9ad0ff', 0.8); } } },
    ],
  },
  ford: {
    ground(p, page) {
      land(p, '#6f7f5a', { blotch: '#4f5f42', seed: 13 });
      band(p, [[0.0, 0.55], [0.3, 0.5], [0.6, 0.56], [1, 0.5]], '#7fa6c0', { width: 0.14, alpha: 0.85 });
      p.hatch(0, 0.45, 1, 0.62, { n: 120, len: 0.03, angle: 0.1, colour: '#ffffff', alpha: 0.5 });
      heading(p, page);
      gutter(p);
    },
    pieces: [
      { id: 'hills', kind: 'card', w: 0.42, h: 0.12, at: [0, -0.14], lift: 1, px: 512, art: peaks({ tops: [[0.15, 0.4], [0.4, 0.2], [0.7, 0.3], [0.9, 0.45]], rock: '#5e6a5a', snow: null }) },
      { id: 'flood', kind: 'card', w: 0.36, h: 0.09, at: [0, 0.0], lift: 0.6, px: 512, art: flood, toy: 'flood', does: [{ act: 'rise' }], low: true },
      { id: 'asfaloth', kind: 'card', w: 0.09, h: 0.08, at: [-0.13, -0.06], turn: 0.3, lift: 0.5, px: 384, art: rider({ colour: '#f4f2ea' }), toy: 'asfaloth', does: [{ act: 'hop' }] },
      ...[0.06, 0.12, 0.18].map((x, i) => ({ id: `rider-${i}`, kind: 'card', w: 0.08, h: 0.075, at: [x, 0.08 - i * 0.015], turn: -0.5, lift: 0.3, px: 256, art: rider(), toy: 'riders', does: [{ act: 'creep' }] })),
      { id: 'elflord', kind: 'card', w: 0.045, h: 0.1, at: [-0.17, 0.02], lift: 0.4, px: 192, ghost: true, find: true, art: pale('elf') },
    ],
  },
};
