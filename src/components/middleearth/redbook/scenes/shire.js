// The first five pages’ pop-ups: Bag End, the Shire’s edge, Bree,
// Weathertop and the Ford. Each is a toy theatre: a painted sky at the back,
// the land in flats before it, and the people cut out to stand among them
// (../spread.js has a piece’s fields; ../figures.js the people, ../props.js
// the land). x runs ±0.24 across the spread, z ±0.165 from the far edge to
// the reader’s.

import { circle, many, mixc, oval, rgba, rough, shade, smooth, tint, top } from '../brush';
import { dragon, eye, hobbit, rider, ranger, wizard, wraith, elf } from '../figures';
import { clouds, fire, hedge, lit, moon, oak, oakOutline, path, pine, pineOutline, range, ripples, sky, smoke, stars, treeArt, water } from '../props';
import { ground } from './ground';

const BOX = [[0, 0], [1, 0], [1, 1], [0, 1]];
// a sky’s outline: a soft arch over the stage
export const ARCH = top([[0, 0.14], [0.12, 0.04], [0.5, 0.0], [0.88, 0.04], [1, 0.14]]);

// the hills far off along a sky’s foot, hazed
export function farHills(b, y, colour, { seed = 2, amp = 0.08, haze = '#c8d0d8' } = {}) {
  const pts = Array.from({ length: 9 }, (_, i) => [i / 8, y - amp * (0.5 + 0.5 * Math.sin(i * 1.9 + seed))]);
  const shape = top(pts);
  b.wash(shape, { v: [mixc(colour, haze, 0.35), colour], y0: y - amp, y1: 1 }, { edge: 0.3 });
  b.ink(smooth(pts, { closed: false }), { width: 0.0004, alpha: 0.4, twice: false });
  return shape;
}

// ------------------------------------------------------------ Bag End
const bagEndSky = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#24325e', mid: '#c27a5e', bottom: '#f4c47c' });
    stars(b, { n: 40, box: [0, 0, 1, 0.3] });
    b.glow(0.78, 0.72, 0.09, '#ffd890', 0.6);
    clouds(b, [[0.2, 0.32, 0.07, 3], [0.62, 0.22, 0.09, 5], [0.86, 0.4, 0.06, 7]], { colour: '#e8a27a' });
    farHills(b, 0.82, '#5f7a6a', { seed: 1 });
    for (let i = 0; i < 9; i++) b.clump(0.06 + i * 0.11, 0.76 + Math.sin(i * 2.1) * 0.02, 0.012 + (i % 3) * 0.004, '#4a6650', { seed: 40 + i, ink: false });
    farHills(b, 0.92, '#4f6b4a', { seed: 4, amp: 0.05 });
  },
};

const HILL = [[0, 0.72], [0.18, 0.56], [0.38, 0.36], [0.55, 0.3], [0.72, 0.36], [0.88, 0.52], [1, 0.62]];
const theHill = {
  outline: many(top(HILL), oakOutline(0.6, 0.34, 0.33, { seed: 2 })),
  draw(b) {
    b.wash(top(HILL), { from: [0.3, 0.2], to: [0.8, 1], stops: [[0, '#a8c46a'], [0.5, '#7a9c48'], [1, '#4f6e30']] }, { edge: 0.4 });
    b.hatch(top(HILL), { angle: -1.2, gap: 0.0016, colour: '#2f4a1e', alpha: 0.45, fade: (x, y) => Math.max(0, (x - 0.55) * 2.2) * Math.min(1, y * 2) });
    b.grass(HILL, { n: 90, tall: 0.0035 });
    oak(b, 0.6, 0.34, 0.33, { seed: 2, leaf: '#5f8236' });
    // the gardens: a hedge, flowers, the fence along the lane
    hedge(b, 0.22, 0.4, 0.62, 0.08, { leaf: '#557a30', seed: 7 });
    b.stipple(top(HILL), { n: 70, size: 0.0007, colour: '#e86a5a', box: [0.2, 0.6, 0.8, 0.95] });
    b.stipple(top(HILL), { n: 50, size: 0.0007, colour: '#f2d25a', box: [0.2, 0.6, 0.8, 0.95] });
    for (let i = 0; i < 9; i++) b.line([[0.5 + i * 0.045, 0.86], [0.5 + i * 0.045, 0.8]], { width: 0.0005, colour: '#5a4028', twice: false });
    b.line([[0.5, 0.82], [0.86, 0.82]], { width: 0.0004, colour: '#5a4028', twice: false });
    // Bag End: the round green door with its brass knob in the middle, the
    // round windows either side, and the chimney’s smoke above
    b.wash(circle(0.44, 0.72, 0.062), { radial: [0.42, 0.7, 0.09], stops: [[0, '#9a8a6a'], [1, '#5a4a34']] }, { edge: 0.4 });
    b.wash(circle(0.44, 0.72, 0.05), { radial: [0.41, 0.67, 0.08], stops: [[0, '#4f9a5a'], [1, '#1f5a32']] }, { edge: 0.5 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.line([[0.44 + Math.cos(a) * 0.012, 0.72 + Math.sin(a) * 0.012 * 2.7], [0.44 + Math.cos(a) * 0.048, 0.72 + Math.sin(a) * 0.048 * 2.7]], { width: 0.00025, alpha: 0.45, twice: false });
    }
    b.fill(circle(0.44, 0.72, 0.008), '#f2c84a').ink(circle(0.44, 0.72, 0.008), { width: 0.0003, twice: false });
    b.fill([[0.38, 0.9], [0.5, 0.9], [0.52, 1], [0.36, 1]], '#a8906a');
    for (const x of [0.33, 0.555]) {
      lit(b, circle(x, 0.7, 0.02), { x, y: 0.7, r: 0.01 });
    }
    b.fill([[0.68, 0.33], [0.7, 0.33], [0.7, 0.24], [0.68, 0.24]], '#6a5a4a');
    smoke(b, 0.69, 0.22, 0.2, { colour: '#d8d0c4' });
    // the smials down the hill, their doors
    for (const [x, y, c] of [[0.16, 0.82, '#a8402a'], [0.8, 0.74, '#c89a2a'], [0.93, 0.84, '#34507a']]) {
      b.wash(circle(x, y, 0.017), '#7a6a52', { edge: 0.5 });
      b.wash(circle(x, y, 0.013), { radial: [x - 0.004, y - 0.01, 0.02], stops: [[0, tint(c, 0.2)], [1, shade(c, 0.35)]] }, { edge: 0.4 });
      b.fill(circle(x, y, 0.0025), '#f2c84a');
      lit(b, circle(x + 0.035, y - 0.01, 0.007), { x: x + 0.035, y: y - 0.01, r: 0.005, bars: false });
    }
    b.ink(top(HILL), { width: 0.0005, alpha: 0.7, twice: false });
  },
};

const partyTree = (() => {
  const t = treeArt('oak', { seed: 5, leaf: '#56782e' });
  return {
    ...t,
    draw(b) {
      t.draw(b);
      // lanterns strung through the boughs, unlit till they are touched
      const at = [[0.2, 0.52], [0.3, 0.47], [0.4, 0.44], [0.5, 0.43], [0.6, 0.44], [0.7, 0.47], [0.8, 0.52]];
      const hi = [[0.3, 0.3], [0.4, 0.27], [0.5, 0.26], [0.6, 0.27], [0.7, 0.3]];
      for (const row of [at, hi]) {
        b.curve(row, { width: 0.00025, alpha: 0.7, twice: false });
        row.forEach(([x, y], i) => {
          const c = ['#e85a3a', '#f2c84a', '#7ac85a', '#f29a3a'][i % 4];
          b.line([[x, y], [x, y + 0.015]], { width: 0.0002, twice: false });
          b.wash(oval(x, y + 0.03, 0.014, 0.018), { v: [tint(c, 0.3), shade(c, 0.2)], y0: y + 0.015, y1: y + 0.05 }, { edge: 0.4 });
          b.ink(oval(x, y + 0.03, 0.014, 0.018), { width: 0.0002, twice: false });
        });
      }
    },
  };
})();

const pavilion = {
  aspect: 1.6,
  outline: many([[0.05, 0.98], [0.1, 0.45], [0.3, 0.2], [0.5, 0.02], [0.7, 0.2], [0.9, 0.45], [0.95, 0.98]], [[0.49, 0.0], [0.51, 0.0], [0.51, 0.1], [0.49, 0.1]]),
  draw(b) {
    const tent = [[0.05, 0.98], [0.1, 0.45], [0.3, 0.2], [0.5, 0.02], [0.7, 0.2], [0.9, 0.45], [0.95, 0.98]];
    b.wash(tent, { h: ['#fbf6ea', '#c8bca4'] }, { edge: 0.4 });
    for (const x of [0.25, 0.5, 0.75]) b.line([[0.5, 0.04], [x, 0.98]], { width: 0.0003, alpha: 0.4, twice: false });
    for (let i = 0; i < 8; i++) b.fill([[0.1 + i * 0.1, 0.45 + (i % 2) * 0.01], [0.15 + i * 0.1, 0.45], [0.125 + i * 0.1, 0.55]], i % 2 ? '#c8452c' : '#3a6a9a');
    b.fill([[0.3, 0.98], [0.3, 0.62], [0.7, 0.62], [0.7, 0.98]], '#f6d890', 0.8);
    b.glow(0.5, 0.8, 0.012, '#ffd27a', 0.8);
    b.ink(tent, { width: 0.0004, twice: false });
  },
};

const bagEndHedge = {
  outline: top([[0, 0.2], [0.1, 0.05], [0.25, 0.25], [0.4, 0.1], [0.55, 0.3], [0.7, 0.05], [0.85, 0.2], [1, 0.1]]),
  draw(b) {
    b.wash(bagEndHedge.outline, { v: ['#8aa85a', '#5a7a36'] }, { edge: 0.3 });
    b.grass([[0.3, 1], [0.7, 1]], { n: 50, tall: 0.006, colour: '#3c5a22' });
    hedge(b, 0, 0.32, 1.05, 0.95, { leaf: '#4c6e2a', seed: 9 });
    hedge(b, 0.66, 1, 1.05, 0.95, { leaf: '#4c6e2a', seed: 12 });
    for (let i = 0; i < 12; i++) b.line([[0.3 + i * 0.035, 1], [0.3 + i * 0.035, 0.45]], { width: 0.0006, colour: '#6a4a2a', twice: false });
    b.line([[0.3, 0.55], [0.7, 0.55]], { width: 0.0005, colour: '#6a4a2a', twice: false });
    b.line([[0.3, 0.8], [0.7, 0.8]], { width: 0.0005, colour: '#6a4a2a', twice: false });
    b.stipple(null, { n: 80, size: 0.0008, colour: '#f2e2a0', box: [0, 0.3, 1, 1] });
    b.stipple(null, { n: 60, size: 0.0008, colour: '#e86a8a', box: [0, 0.3, 1, 1] });
  },
};

const envelope = {
  aspect: 1.4,
  outline: BOX,
  draw(b) {
    b.wash(BOX, { v: ['#fbf4e2', '#e2d4b4'] }, { edge: 0.4 });
    b.line([[0, 0], [0.5, 0.55], [1, 0]], { width: 0.0003, twice: false });
    b.glow(0.5, 0.62, 0.006, '#ffd36a', 1);
    b.ink(oval(0.5, 0.62, 0.16, 0.2), { width: 0.0007, colour: '#d9a83a', twice: false });
  },
};

// ------------------------------------------------------------ the Shire’s edge
const dusk = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#2a2a48', mid: '#6a5a78', bottom: '#c89a8a' });
    moon(b, 0.74, 0.32, 0.03, { colour: '#f0e4c8' });
    stars(b, { n: 30, box: [0, 0, 1, 0.35] });
    clouds(b, [[0.3, 0.42, 0.08, 2], [0.85, 0.5, 0.06, 6]], { colour: '#9a8aa0' });
    farHills(b, 0.86, '#3e4a52', { seed: 3 });
  },
};

const WOOD = [[0, 0.5], [0.08, 0.2], [0.18, 0.35], [0.3, 0.12], [0.42, 0.3], [0.52, 0.18], [0.64, 0.32], [0.76, 0.1], [0.88, 0.3], [1, 0.22]];
const woodyEnd = {
  outline: many(top(WOOD), ...[0.08, 0.3, 0.52, 0.76].map((x, i) => oakOutline(x, 0.7, 0.6, { seed: 20 + i }))),
  draw(b) {
    b.wash(top(WOOD), { v: ['#3e5636', '#22301e'], y0: 0.1, y1: 1 }, { edge: 0.3 });
    for (const [i, x] of [0.08, 0.3, 0.52, 0.76].entries()) oak(b, x, 0.7, 0.6, { seed: 20 + i, leaf: '#3c5a2c', light: 0.2 });
    for (const x of [0.2, 0.42, 0.64, 0.9]) pine(b, x, 0.95, 0.55, { leaf: '#24382a', seed: Math.round(x * 50) });
    b.fill(BOX, { v: [rgba('#3a3050', 0.0), rgba('#3a3050', 0.45)], y0: 0.4, y1: 1 });
  },
};

const ROOTS = [[0.02, 1], [0.08, 0.7], [0.2, 0.55], [0.35, 0.5], [0.42, 0.25], [0.58, 0.25], [0.65, 0.5], [0.8, 0.55], [0.92, 0.7], [0.98, 1]];
const greatRoots = {
  aspect: 1.25,
  outline: many(smooth(ROOTS), oakOutline(0.5, 0.42, 0.42, { seed: 31 })),
  draw(b) {
    oak(b, 0.5, 0.42, 0.42, { seed: 31, leaf: '#3c5a2a', light: 0.2 });
    b.wash(smooth(ROOTS), { h: ['#7a5a3a', '#3a2818'] }, { edge: 0.5 });
    // the hollow under the roots, where the hobbits lie still
    b.fill(smooth([[0.25, 1], [0.32, 0.75], [0.5, 0.66], [0.68, 0.75], [0.75, 1]]), '#120c08');
    for (const x of [0.2, 0.36, 0.64, 0.8]) b.curve([[x, 0.62], [x + (x < 0.5 ? -0.04 : 0.04), 0.82], [x + (x < 0.5 ? -0.08 : 0.08), 1]], { width: 0.0012, colour: '#4a3220' });
    b.hatch(smooth(ROOTS), { angle: 1.3, gap: 0.0012, alpha: 0.35, fade: (x) => Math.max(0, x - 0.4) * 1.6 });
    b.ink(smooth(ROOTS), { width: 0.0005, twice: false });
  },
};

const basket = {
  aspect: 1.3,
  outline: many(smooth([[0.06, 0.45], [0.94, 0.45], [0.84, 0.98], [0.16, 0.98]]), ...[0.25, 0.45, 0.65, 0.8].map((x, i) => oval(x, 0.38 - (i % 2) * 0.06, 0.13, 0.12))),
  draw(b) {
    const caps = [0.25, 0.45, 0.65, 0.8];
    caps.forEach((x, i) => b.wash(oval(x, 0.38 - (i % 2) * 0.06, 0.13, 0.12), { v: ['#f6ead0', '#c8a87a'], y0: 0.2, y1: 0.5 }, { edge: 0.4 }));
    const body = smooth([[0.06, 0.45], [0.94, 0.45], [0.84, 0.98], [0.16, 0.98]]);
    b.wash(body, { v: ['#b8884a', '#6a4422'] }, { edge: 0.4 });
    b.hatch(body, { angle: 0.6, gap: 0.0012, alpha: 0.4 }).hatch(body, { angle: -0.6, gap: 0.0012, alpha: 0.3 });
    b.ink(body, { width: 0.0005, twice: false });
  },
};

const ferns = {
  outline: top([[0, 0.3], [0.12, 0.1], [0.22, 0.4], [0.35, 0.2], [0.5, 0.5], [0.65, 0.25], [0.78, 0.45], [0.9, 0.1], [1, 0.3]]),
  draw(b) {
    b.wash(ferns.outline, { v: ['#4a6a34', '#24361c'] }, { edge: 0.4 });
    for (let i = 0; i < 26; i++) {
      const x = i / 25;
      b.curve([[x, 1], [x + 0.01, 0.6], [x + 0.03, 0.3 + (i % 3) * 0.08]], { width: 0.0006, colour: '#2a3e1e', alpha: 0.7, twice: false });
    }
    b.grass([[0, 0.5], [1, 0.5]], { n: 60, tall: 0.006, colour: '#5a7a3a' });
  },
};

const crown = {
  aspect: 1.4,
  outline: [[0.1, 0.9], [0.1, 0.35], [0.28, 0.6], [0.5, 0.1], [0.72, 0.6], [0.9, 0.35], [0.9, 0.9]],
  draw(b) {
    b.wash(crown.outline, { v: ['#ffffff', '#c8d4ea'] }, { edge: 0.3 });
    b.ink(crown.outline, { width: 0.0006, colour: '#8a9ac0', twice: false });
  },
};

// ------------------------------------------------------------ Bree
const rainNight = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#141a28', mid: '#2e3a50', bottom: '#4a5468' });
    clouds(b, [[0.15, 0.2, 0.12, 2], [0.5, 0.14, 0.14, 4], [0.85, 0.24, 0.1, 6]], { colour: '#3e4658', ink: false });
    // Bree-hill and the lights of the houses up it
    const HILLB = [[0, 0.7], [0.2, 0.5], [0.45, 0.38], [0.7, 0.45], [1, 0.62]];
    b.wash(top(HILLB), { v: ['#2e3a32', '#1a221c'] }, { edge: 0.3 });
    b.stipple(top(HILLB), { n: 26, size: 0.0009, colour: '#ffcf6a', alpha: 1, box: [0.1, 0.5, 0.9, 0.9] });
    b.hatch(BOX, { angle: 1.85, gap: 0.004, width: 0.00025, colour: '#aab8cc', alpha: 0.35 });
  },
};

const BREE = [[0, 0.45], [0.06, 0.45], [0.12, 0.25], [0.18, 0.45], [0.24, 0.45], [0.3, 0.2], [0.36, 0.42], [0.62, 0.42], [0.7, 0.18], [0.78, 0.42], [0.84, 0.42], [0.9, 0.28], [0.96, 0.42], [1, 0.42]];
const breeTown = {
  outline: [...BREE, [1, 1], [0, 1]],
  draw(b) {
    b.wash([...BREE, [1, 1], [0, 1]], { v: ['#5a5048', '#2a2420'] }, { edge: 0.4 });
    // the houses’ timbers and their lit windows
    for (const [x0, x1] of [[0, 0.24], [0.24, 0.36], [0.62, 0.84], [0.84, 1]]) {
      b.line([[x0 + 0.01, 0.45], [x0 + 0.01, 1]], { width: 0.0008, colour: '#1a1410', twice: false });
      b.line([[x0, 0.62], [x1, 0.62]], { width: 0.0008, colour: '#1a1410', twice: false });
      for (let x = x0 + 0.03; x < x1 - 0.03; x += 0.06) lit(b, [[x, 0.68], [x + 0.025, 0.68], [x + 0.025, 0.78], [x, 0.78]], { x: x + 0.0125, y: 0.73, r: 0.01 });
    }
    // the West Gate, and the dark road beyond it
    b.fill([[0.4, 1], [0.4, 0.6], [0.58, 0.6], [0.58, 1]], '#3a2c20');
    b.fill(smooth([[0.42, 1], [0.42, 0.7], [0.49, 0.62], [0.56, 0.7], [0.56, 1]]), '#0c0a08');
    b.hatch([...BREE, [1, 1], [0, 1]], { angle: 1.85, gap: 0.004, width: 0.00025, colour: '#aab8cc', alpha: 0.3 });
    b.ink([...BREE, [1, 1], [0, 1]], { width: 0.0005, twice: false });
  },
};

const INN = [[0.04, 1], [0.04, 0.42], [0.2, 0.42], [0.3, 0.16], [0.5, 0.0], [0.7, 0.16], [0.8, 0.42], [0.96, 0.42], [0.96, 1]];
const pony = {
  aspect: 1.05,
  outline: INN,
  draw(b) {
    b.wash(INN, { h: ['#d8c49a', '#9a8460'] }, { edge: 0.4 });
    b.wash([[0.04, 0.42], [0.2, 0.42], [0.3, 0.16], [0.5, 0.0], [0.7, 0.16], [0.8, 0.42], [0.96, 0.42], [0.9, 0.36], [0.5, 0.06], [0.1, 0.36]], { v: ['#6a5a52', '#3a3230'] }, { edge: 0.4 });
    b.hatch([[0.1, 0.36], [0.5, 0.06], [0.9, 0.36]], { angle: 0.25, gap: 0.0012, alpha: 0.4 });
    // the timbers
    for (const x of [0.04, 0.27, 0.5, 0.73, 0.96]) b.line([[x, 0.42], [x, 1]], { width: 0.001, colour: '#3a2818', twice: false });
    for (const y of [0.42, 0.66, 0.68]) b.line([[0.04, y], [0.96, y]], { width: 0.001, colour: '#3a2818', twice: false });
    for (const [x0, x1] of [[0.04, 0.27], [0.73, 0.96]]) b.line([[x0, 0.42], [x1, 0.66]], { width: 0.0007, colour: '#3a2818', twice: false });
    // its windows, all lit, and the door with a lamp
    for (const [x, y] of [[0.36, 0.25], [0.12, 0.5], [0.58, 0.48], [0.12, 0.76], [0.8, 0.76], [0.8, 0.5]]) lit(b, [[x, y], [x + 0.09, y], [x + 0.09, y + 0.1], [x, y + 0.1]], { x: x + 0.045, y: y + 0.05, r: 0.014 });
    b.fill(smooth([[0.4, 1], [0.4, 0.8], [0.47, 0.74], [0.54, 0.8], [0.54, 1]]), '#3a2010');
    b.glow(0.6, 0.78, 0.006, '#ffcf6a', 0.9);
    b.fill([[0.585, 0.76], [0.615, 0.76], [0.615, 0.8], [0.585, 0.8]], '#ffe2a0');
    b.fill([[0.62, 0.06], [0.68, 0.06], [0.68, 0.2], [0.62, 0.2]], '#5a4a40');
    smoke(b, 0.65, 0.05, 0.06, { colour: '#8a8a90' });
    b.ink(INN, { width: 0.0005, twice: false });
  },
};

const ponySign = {
  aspect: 1.2,
  outline: many([[0.05, 0.2], [0.95, 0.2], [0.95, 0.98], [0.05, 0.98]], [[0.45, 0], [0.55, 0], [0.55, 0.2], [0.45, 0.2]]),
  draw(b) {
    b.fill([[0.45, 0], [0.55, 0], [0.55, 0.2], [0.45, 0.2]], '#3a2818');
    b.wash([[0.05, 0.2], [0.95, 0.2], [0.95, 0.98], [0.05, 0.98]], { v: ['#7a5432', '#4a3018'] }, { edge: 0.4 });
    b.wash(smooth([[0.3, 0.9], [0.36, 0.62], [0.32, 0.42], [0.44, 0.32], [0.56, 0.4], [0.66, 0.5], [0.7, 0.62], [0.62, 0.66], [0.6, 0.9], [0.5, 0.7], [0.4, 0.72]]), '#f6f2ea', { edge: 0.3 });
    b.ink([[0.05, 0.2], [0.95, 0.2], [0.95, 0.98], [0.05, 0.98]], { width: 0.0007, colour: '#d8b04a', twice: false });
  },
};

const puddle = {
  aspect: 3,
  outline: oval(0.5, 0.6, 0.48, 0.38),
  draw(b) {
    water(b, oval(0.5, 0.6, 0.48, 0.38), { deep: '#2a3446', light: '#7a8aa8', n: 0 });
    for (const [x, y, r] of [[0.3, 0.55, 0.06], [0.62, 0.7, 0.08], [0.75, 0.45, 0.04]]) b.ink(oval(x, y, r, r * 0.9), { width: 0.0003, colour: '#d8e4f2', alpha: 0.7, twice: false });
    b.fill(oval(0.45, 0.5, 0.06, 0.12), '#ffd27a', 0.35);
  },
};

const pint = {
  aspect: 0.8,
  outline: smooth([[0.15, 0.1], [0.85, 0.1], [0.8, 0.95], [0.2, 0.95]]),
  draw(b) {
    b.wash(pint.outline, { v: ['#fff2c8', '#d8a84a'] });
    b.clip(pint.outline, () => eye().draw(b));
  },
};

// ------------------------------------------------------------ Weathertop
const moonNight = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#0e1424', mid: '#1e2a44', bottom: '#3a4a64' });
    stars(b, { n: 90, box: [0, 0, 1, 0.6] });
    moon(b, 0.2, 0.25, 0.035);
    clouds(b, [[0.6, 0.3, 0.1, 2], [0.88, 0.18, 0.07, 9]], { colour: '#4a5a78' });
    farHills(b, 0.9, '#1e2834', { seed: 5, haze: '#4a5a70' });
  },
};

const AMON = [[0, 0.98], [0.14, 0.82], [0.26, 0.6], [0.36, 0.34], [0.42, 0.18], [0.47, 0.12], [0.53, 0.1], [0.58, 0.13], [0.63, 0.2], [0.7, 0.4], [0.8, 0.66], [0.9, 0.84], [1, 0.98]];
const RUIN = [[0.42, 0.18], [0.43, 0.05], [0.45, 0.05], [0.46, 0.12], [0.49, 0.12], [0.5, 0.02], [0.52, 0.02], [0.53, 0.1], [0.56, 0.11], [0.57, 0.04], [0.59, 0.05], [0.6, 0.15]];
const amonSul = {
  outline: many(top(AMON), [...RUIN, [0.6, 0.2], [0.42, 0.2]]),
  draw(b) {
    b.wash(top(AMON), { from: [0.35, 0.1], to: [0.7, 1], stops: [[0, '#6a7a72'], [0.5, '#4a5a52'], [1, '#26302c']] }, { edge: 0.5 });
    b.light(top(AMON), 0.3, 0.3, 0.35, '#c8d4e8', 0.35);
    b.hatch(top(AMON), { angle: -1.1, gap: 0.0015, alpha: 0.45, fade: (x) => Math.max(0, x - 0.5) * 2 });
    // the crags, and the old stair up
    for (const [x, y] of [[0.3, 0.55], [0.66, 0.42], [0.74, 0.62], [0.22, 0.75]]) b.fill(rough([[x, y], [x + 0.04, y - 0.05], [x + 0.08, y], [x + 0.06, y + 0.06], [x - 0.01, y + 0.06]], 0.01, Math.round(x * 90), { n: 2, closed: true }), '#8a8a84', 0.85);
    b.line([[0.38, 0.95], [0.42, 0.8], [0.4, 0.66], [0.45, 0.5], [0.43, 0.36], [0.48, 0.2]], { width: 0.0005, alpha: 0.5, twice: false });
    b.wash([...RUIN, [0.6, 0.2], [0.42, 0.2]], { h: ['#b8b4aa', '#6a6862'] }, { edge: 0.5 });
    b.grass(AMON.slice(1, 6), { n: 40, colour: '#2a3a2a' });
    b.ink(top(AMON), { width: 0.0005, twice: false });
  },
};

const DELL = [[0, 0.6], [0.1, 0.3], [0.2, 0.5], [0.32, 0.25], [0.45, 0.55], [0.55, 0.55], [0.68, 0.2], [0.8, 0.45], [0.9, 0.25], [1, 0.5]];
const dell = {
  outline: top(DELL),
  draw(b) {
    b.wash(top(DELL), { v: ['#5a6458', '#262c26'], y0: 0.2 }, { edge: 0.5 });
    b.hatch(top(DELL), { angle: -1.2, gap: 0.0016, alpha: 0.4 });
    b.ink(top(DELL), { width: 0.0005, twice: false });
  },
};

const flameCard = {
  aspect: 0.8,
  outline: oval(0.5, 0.55, 0.48, 0.45),
  draw(b) {
    fire(b, 0.5, 0.95, 0.85);
    for (const a of [-0.5, 0.5]) b.line([[0.5 - a * 0.6, 1], [0.5 + a * 0.4, 0.82]], { width: 0.0012, colour: '#3a2414', twice: false });
  },
};

const morgulBlade = {
  aspect: 0.32,
  outline: [[0.4, 0.98], [0.4, 0.76], [0.1, 0.73], [0.1, 0.67], [0.44, 0.67], [0.5, 0.02], [0.56, 0.67], [0.9, 0.67], [0.9, 0.73], [0.6, 0.76], [0.6, 0.98]],
  draw(b) {
    b.wash(morgulBlade.outline, { v: ['#f2f8ff', '#9ab0d0'] });
    b.glow(0.5, 0.4, 0.02, '#bfe0ff', 0.8);
  },
};

// ------------------------------------------------------------ the Ford
const storm = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#4a5262', mid: '#7a8494', bottom: '#b8bcc0' });
    clouds(b, [[0.2, 0.22, 0.12, 1], [0.55, 0.15, 0.15, 3], [0.88, 0.25, 0.1, 8]], { colour: '#6a7282' });
    range(b, [[0.12, 0.5], [0.34, 0.42], [0.6, 0.55], [0.82, 0.4]], { rock: '#6a7480', snow: '#eef2f6', foot: 0.86, haze: '#b8bcc0', seed: 4 });
    farHills(b, 0.94, '#3e4e44', { seed: 6, amp: 0.06 });
  },
};

const BANK = [[0, 0.55], [0.15, 0.4], [0.3, 0.5], [0.45, 0.62], [0.55, 0.62], [0.7, 0.5], [0.85, 0.42], [1, 0.52]];
const farBank = {
  outline: many(top(BANK), ...[0.06, 0.18, 0.78, 0.92].map((x, i) => pineOutline(x, 0.6, 0.55, { seed: i + 1 }))),
  draw(b) {
    for (const [i, x] of [0.06, 0.18, 0.78, 0.92].entries()) pine(b, x, 0.6, 0.55, { leaf: '#2a4030', seed: i + 1 });
    b.wash(top(BANK), { v: ['#5e6a50', '#2e3628'] }, { edge: 0.5 });
    for (const [x, y] of [[0.1, 0.62], [0.3, 0.7], [0.72, 0.68], [0.9, 0.62]]) b.fill(rough([[x, y], [x + 0.05, y - 0.04], [x + 0.1, y], [x + 0.08, y + 0.08], [x, y + 0.08]], 0.01, Math.round(x * 70), { n: 2, closed: true }), '#8a8678', 0.8);
    b.ink(top(BANK), { width: 0.0005, twice: false });
  },
};
const CRESTS = [[0, 0.98], [0, 0.5], [0.06, 0.32], [0.12, 0.2], [0.18, 0.3], [0.24, 0.12], [0.3, 0.06], [0.36, 0.22], [0.44, 0.1], [0.52, 0.04], [0.58, 0.2], [0.66, 0.08], [0.74, 0.02], [0.8, 0.18], [0.88, 0.1], [0.94, 0.28], [1, 0.4], [1, 0.98]];
const flood = {
  aspect: 4,
  outline: smooth(CRESTS),
  draw(b) {
    water(b, smooth(CRESTS), { deep: '#3a6a84', light: '#c8e0ec', y0: 0, y1: 1, n: 30 });
    // the white horses: the crests curl over as manes, with an eye in each
    for (const [x, y] of [[0.12, 0.22], [0.3, 0.1], [0.52, 0.08], [0.74, 0.06], [0.88, 0.14]]) {
      b.fill(smooth([[x - 0.06, y + 0.25], [x - 0.04, y + 0.05], [x + 0.01, y - 0.02], [x + 0.05, y + 0.06], [x + 0.03, y + 0.2]]), '#ffffff', 0.95);
      b.curve([[x - 0.05, y + 0.12], [x - 0.08, y + 0.02], [x - 0.12, y + 0.06]], { width: 0.0007, colour: '#ffffff', alpha: 0.95, twice: false });
      b.fill(circle(x + 0.025, y + 0.06, 0.004), '#2a4a5a');
    }
    b.hatch(smooth(CRESTS), { angle: 0.1, gap: 0.0016, colour: '#ffffff', alpha: 0.4, fade: (x, y) => (y > 0.5 ? 1 : 0) });
    b.ink(smooth(CRESTS), { width: 0.0005, colour: '#1e3a4a', twice: false });
  },
};

const pale = (k) => elf({ gown: '#f4f2ea', hair: '#f2e4a8', light: true, ...k });

const bagEnd = (b, page) =>
  ground(b, page, { far: '#a8bc72', near: '#7a9a48', blotch: '#5f7f34', seed: 1 }, (g) => {
    path(g, [[0.04, 0.95], [0.25, 0.8], [0.45, 0.62], [0.62, 0.7], [0.96, 0.6]], '#c8aa78', { width: 0.03 });
    g.grass([[0.05, 0.98], [0.95, 0.98]], { n: 160, tall: 0.004, colour: '#3c5a22' });
    g.stipple(null, { n: 160, size: 0.0007, colour: '#e86a5a', box: [0.03, 0.4, 0.97, 0.95] });
    g.stipple(null, { n: 120, size: 0.0007, colour: '#fbf2c8', box: [0.03, 0.4, 0.97, 0.95] });
  });

export const SCENES = {
  'bag-end': {
    ground: bagEnd,
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: bagEndSky, shadow: false },
      { id: 'hill', kind: 'flat', at: [0.03, -0.11], w: 0.42, h: 0.16, fold: 'in', lift: 0.9, art: theHill, toy: 'door', does: [{ act: 'knock' }, { act: 'light', target: ['door'] }] },
      { id: 'door', kind: 'glow', at: [0.012, -0.105], y: 0.03, size: 0.07, colour: '#ffcf6a', on: false },
      { id: 'pavilion', kind: 'card', at: [0.13, -0.05], h: 0.05, turn: -0.2, lift: 0.75, art: pavilion },
      { id: 'tree', kind: 'card', at: [-0.15, -0.04], h: 0.17, turn: 0.35, lift: 0.7, art: partyTree, toy: 'lanterns', does: [{ act: 'light', target: ['lanterns'] }] },
      { id: 'lanterns', kind: 'glow', at: [-0.15, -0.035], y: 0.11, size: 0.16, colour: '#ffcf5a', on: false },
      { id: 'hedge', kind: 'flat', at: [0, 0.04], w: 0.46, h: 0.035, fold: 'in', lift: 0.4, art: bagEndHedge },
      { id: 'gandalf', kind: 'card', at: [0.1, 0.075], h: 0.12, turn: -0.25, lift: 0.2, art: wizard({ robe: '#8a8e98' }), toy: 'gandalf', does: [{ act: 'hop' }] },
      { id: 'bilbo', kind: 'card', at: [-0.04, 0.085], h: 0.062, turn: 0.15, lift: 0.1, art: hobbit({ coat: '#5a6a3a', vest: '#c8402a' }), does: [{ act: 'hop' }] },
      { id: 'dragon', kind: 'card', at: [-0.03, -0.12], y: 0.13, h: 0.07, lift: 1, art: dragon(), toy: 'dragon', does: [{ act: 'burst', colour: '#9cff7a' }, { act: 'fly' }], shadow: false },
      { id: 'envelope', kind: 'card', at: [-0.1, 0.11], h: 0.022, lift: 0.3, ghost: true, find: true, art: envelope },
    ],
  },
  'shire-edge': {
    ground: (b, page) =>
      ground(b, page, { far: '#5a7048', near: '#3e5432', blotch: '#2c3e24', seed: 5 }, (g) => {
        path(g, [[0, 0.62], [0.25, 0.58], [0.5, 0.66], [0.75, 0.56], [1, 0.6]], '#a08a62', { width: 0.06 });
        g.hatch([[0, 0], [1, 0], [1, 1], [0, 1]], { angle: -1.1, gap: 0.003, colour: '#1e2c16', alpha: 0.4 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.21, fold: 'in', lift: 1, art: dusk, shadow: false },
      { id: 'wood', kind: 'flat', at: [0, -0.12], w: 0.46, h: 0.17, fold: 'in', lift: 0.95, art: woodyEnd },
      { id: 'roots', kind: 'card', at: [-0.07, -0.05], h: 0.13, lift: 0.7, art: greatRoots, toy: 'roots', does: [{ act: 'sway' }] },
      { id: 'frodo', kind: 'card', at: [-0.07, -0.035], h: 0.042, lift: 0.6, art: hobbit({ coat: '#4f6a8a', vest: '#c9a23a', pack: true }) },
      { id: 'rider', kind: 'card', at: [0.1, 0.0], h: 0.115, turn: Math.PI - 0.15, lift: 0.4, art: rider(), toy: 'rider', does: [{ act: 'sniff' }] },
      { id: 'ferns', kind: 'flat', at: [0, 0.07], w: 0.46, h: 0.03, fold: 'in', lift: 0.3, art: ferns },
      { id: 'mushrooms', kind: 'card', at: [-0.15, 0.1], h: 0.035, lift: 0.1, art: basket, toy: 'mushrooms', does: [{ act: 'hop' }] },
      { id: 'crown', kind: 'card', at: [0.09, 0.0], y: 0.12, h: 0.022, lift: 0.4, ghost: true, find: true, art: crown },
    ],
  },
  bree: {
    ground: (b, page) =>
      ground(b, page, { far: '#5a5a50', near: '#3e3a32', blotch: '#2a2620', seed: 8 }, (g) => {
        path(g, [[0, 0.8], [0.4, 0.74], [0.7, 0.8], [1, 0.76]], '#6a5a42', { width: 0.08 });
        g.hatch([[0, 0], [1, 0], [1, 1], [0, 1]], { angle: 1.9, gap: 0.004, colour: '#8a98b0', alpha: 0.3 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.21, fold: 'in', lift: 1, art: rainNight, shadow: false },
      { id: 'town', kind: 'flat', at: [0, -0.12], w: 0.46, h: 0.11, fold: 'in', lift: 0.95, art: breeTown },
      { id: 'inn', kind: 'card', at: [0.03, -0.06], h: 0.15, lift: 0.75, art: pony, toy: 'bell', does: [{ act: 'hop' }, { act: 'light', target: ['inn-glow'] }] },
      { id: 'inn-glow', kind: 'glow', at: [0.03, -0.045], y: 0.05, size: 0.11, colour: '#ffb84a', on: true },
      { id: 'sign', kind: 'card', at: [0.125, -0.04], y: 0.075, h: 0.032, lift: 0.6, art: ponySign, toy: 'sign', does: [{ act: 'swing' }] },
      { id: 'strider', kind: 'card', at: [-0.14, 0.01], h: 0.11, turn: 0.4, lift: 0.4, art: ranger({ glint: true }), toy: 'strider', does: [{ act: 'hop' }] },
      { id: 'rain', kind: 'card', at: [-0.03, 0.09], h: 0.022, lift: 0.15, art: puddle, toy: 'rain', does: [{ act: 'sway' }] },
      { id: 'pint', kind: 'card', at: [-0.08, 0.07], y: 0.02, h: 0.024, lift: 0.1, ghost: true, find: true, art: pint },
    ],
  },
  weathertop: {
    ground: (b, page) =>
      ground(b, page, { far: '#3e4a46', near: '#262e2c', blotch: '#1a201e', seed: 11 }, (g) => {
        g.hatch([[0, 0], [1, 0], [1, 1], [0, 1]], { angle: -1.2, gap: 0.003, colour: '#0e1210', alpha: 0.4 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: moonNight, shadow: false },
      { id: 'hill', kind: 'flat', at: [0.02, -0.11], w: 0.4, h: 0.2, fold: 'in', lift: 0.9, art: amonSul },
      { id: 'dell', kind: 'flat', at: [0, -0.02], w: 0.46, h: 0.045, fold: 'in', lift: 0.6, art: dell },
      { id: 'fire', kind: 'card', at: [0.0, 0.02], h: 0.03, lift: 0.3, art: flameCard, toy: 'fire', does: [{ act: 'light', target: ['fire-glow'] }] },
      { id: 'fire-glow', kind: 'glow', at: [0.0, 0.025], y: 0.02, size: 0.16, colour: '#ff9a3a', on: false, flicker: true },
      ...[-0.15, -0.09, 0.09, 0.15, 0.04].map((x, i) => ({ id: `wraith-${i}`, kind: 'card', at: [x, 0.04 + (i % 2) * 0.03], h: 0.1, turn: x < 0 ? 0.4 : -0.4, lift: 0.5, art: wraith(), toy: 'wraiths', does: [{ act: 'creep' }] })),
      { id: 'sam', kind: 'card', at: [-0.03, 0.1], h: 0.05, lift: 0.1, art: hobbit({ coat: '#6a5a32', vest: '#8a3a2a', pans: true, pack: true }), toy: 'pans', does: [{ act: 'hop' }] },
      { id: 'blade', kind: 'card', at: [0.05, 0.1], h: 0.06, lift: 0.2, ghost: true, find: true, art: morgulBlade },
    ],
  },
  ford: {
    ground: (b, page) =>
      ground(b, page, { far: '#6a7a58', near: '#4a5a3a', blotch: '#3a4a2e', seed: 13 }, (g) => {
        water(g, [[0, 0.38], [1, 0.34], [1, 0.62], [0, 0.66]], { deep: '#3a6078', light: '#9ac0d4', y0: 0.34, y1: 0.66, n: 50 });
        ripples(g, [[0, 0.38], [1, 0.34], [1, 0.62], [0, 0.66]], { y0: 0.34, y1: 0.66, n: 40, colour: '#ffffff' });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.21, fold: 'in', lift: 1, art: storm, shadow: false },
      { id: 'bank', kind: 'flat', at: [0, -0.115], w: 0.46, h: 0.12, fold: 'in', lift: 0.95, art: farBank },
      { id: 'asfaloth', kind: 'card', at: [-0.12, -0.07], h: 0.085, turn: 0.25, lift: 0.7, art: rider({ horse: '#f2efe6', who: 'arwen', mane: '#e8e2d4' }), toy: 'asfaloth', does: [{ act: 'hop' }] },
      { id: 'flood', kind: 'card', at: [0, -0.01], w: 0.4, h: 0.09, lift: 0.6, art: flood, toy: 'flood', does: [{ act: 'rise' }], low: true, shadow: false },
      ...[0.07, 0.13, 0.19].map((x, i) => ({ id: `rider-${i}`, kind: 'card', at: [x, 0.07 - i * 0.012], h: 0.085, turn: Math.PI - 0.45, lift: 0.3, art: rider(), toy: 'riders', does: [{ act: 'creep' }] })),
      { id: 'elflord', kind: 'card', at: [-0.17, 0.02], h: 0.1, lift: 0.4, ghost: true, find: true, art: pale() },
    ],
  },
};

