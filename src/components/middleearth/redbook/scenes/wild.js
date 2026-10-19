// Pages six to ten’s pop-ups: Rivendell, the Redhorn Gate, the Doors of
// Durin, Lothlórien and the Argonath, as toy theatres (./shire.js has the
// shape of a page; ../spread.js a piece’s fields).

import { blob, circle, many, oval, rgba, rough, shade, smooth, tint, top } from '../brush';
import { dwarf, elf, eye, hobbit, king, ranger, wizard } from '../figures';
import { clouds, mallorn, mallornOutline, moon, range, sky, stars, treeArt, water } from '../props';
import { ground } from './ground';
import { ARCH, farHills } from './shire';

const BOX = [[0, 0], [1, 0], [1, 1], [0, 1]];

// ------------------------------------------------------------ Rivendell
const valley = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#6a8ab0', mid: '#c8d4d8', bottom: '#f2e2b8' });
    clouds(b, [[0.3, 0.2, 0.08, 2], [0.7, 0.14, 0.1, 4]], { colour: '#f4f0e8' });
    // the valley’s walls, and the falls coming down them
    const L = [[0, 0.2], [0.12, 0.25], [0.2, 0.45], [0.26, 0.7], [0.3, 1], [0, 1]];
    const R = [[1, 0.18], [0.88, 0.24], [0.8, 0.42], [0.74, 0.7], [0.7, 1], [1, 1]];
    for (const side of [L, R]) {
      b.wash(smooth(side), { v: ['#a8a294', '#5a5a52'] }, { edge: 0.4 });
      b.hatch(smooth(side), { angle: 1.4, gap: 0.0016, alpha: 0.35 });
    }
    for (const [x, y0] of [[0.16, 0.3], [0.84, 0.28], [0.22, 0.55]]) {
      b.fill([[x - 0.008, y0], [x + 0.008, y0], [x + 0.014, 1], [x - 0.014, 1]], { v: ['#ffffff', '#cfe4ee'] }, 0.9);
      b.hatch([[x - 0.008, y0], [x + 0.008, y0], [x + 0.014, 1], [x - 0.014, 1]], { angle: 1.57, gap: 0.0008, colour: '#8ab0c8', alpha: 0.5 });
    }
    for (let i = 0; i < 10; i++) b.clump(0.04 + i * 0.1 + (i % 2) * 0.03, 0.9 - (i % 3) * 0.04, 0.03, ['#c8702a', '#d8a83a', '#a8452a'][i % 3], { seed: 60 + i });
  },
};

const HOUSE = [[0, 1], [0, 0.62], [0.06, 0.5], [0.12, 0.62], [0.2, 0.62], [0.24, 0.36], [0.3, 0.28], [0.36, 0.36], [0.44, 0.36], [0.5, 0.12], [0.56, 0.36], [0.64, 0.36], [0.7, 0.28], [0.76, 0.36], [0.8, 0.62], [0.88, 0.62], [0.94, 0.5], [1, 0.62], [1, 1]];
const lastHomelyHouse = {
  outline: smooth(HOUSE),
  draw(b) {
    const walls = '#efe6d0';
    b.wash(smooth(HOUSE), { from: [0.2, 0.2], to: [0.9, 1], stops: [[0, tint(walls, 0.2)], [1, shade(walls, 0.3)]] }, { edge: 0.4 });
    // the roofs, curved as the Elves make them
    for (const [x0, x1, y, peak] of [[0.2, 0.4, 0.38, 0.28], [0.4, 0.6, 0.38, 0.12], [0.6, 0.8, 0.38, 0.28], [0, 0.14, 0.64, 0.5], [0.86, 1, 0.64, 0.5]]) {
      const m = (x0 + x1) / 2;
      b.wash(smooth([[x0 - 0.02, y + 0.02], [x0 + (m - x0) * 0.5, y - (y - peak) * 0.4], [m, peak], [x1 - (x1 - m) * 0.5, y - (y - peak) * 0.4], [x1 + 0.02, y + 0.02], [m, y - 0.01]]), { v: ['#5a8a7a', '#2e5248'] }, { edge: 0.4 });
    }
    // the arches along the terraces, and their columns
    for (const [y, n, x0, x1] of [[0.48, 6, 0.22, 0.78], [0.74, 9, 0.04, 0.96]]) {
      for (let i = 0; i < n; i++) {
        const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
        const hw = ((x1 - x0) / n) * 0.32;
        const arch = smooth([[x - hw, y + 0.16], [x - hw, y + 0.04], [x, y - 0.02], [x + hw, y + 0.04], [x + hw, y + 0.16]]);
        b.fill(arch, { v: ['#f6d890', '#c8a05a'] }, 0.9).ink(arch, { width: 0.0003, twice: false });
      }
      b.line([[x0, y + 0.17], [x1, y + 0.17]], { width: 0.0006, twice: false });
    }
    b.stipple(smooth(HOUSE), { n: 40, size: 0.0007, colour: '#8a5a2a', alpha: 0.3 });
    b.silhouette(smooth(HOUSE), { width: 0.0005 });
  },
};

const autumn = (seed, leaf) => treeArt('oak', { seed, leaf });

const COUNCIL = [[0.02, 0.98], [0.02, 0.5], [0.12, 0.2], [0.22, 0.5], [0.3, 0.3], [0.4, 0.5], [0.5, 0.25], [0.6, 0.5], [0.7, 0.3], [0.78, 0.5], [0.88, 0.2], [0.98, 0.5], [0.98, 0.98]];
const chairs = {
  aspect: 3.4,
  outline: COUNCIL,
  draw(b) {
    b.wash(COUNCIL, { v: ['#a8784a', '#5a3a1e'] }, { edge: 0.5 });
    for (const x of [0.12, 0.3, 0.5, 0.7, 0.88]) b.fill(oval(x, 0.62, 0.035, 0.12), '#8a2a1e', 0.85);
    b.hatch(COUNCIL, { angle: 1.57, gap: 0.0012, alpha: 0.3 });
    b.silhouette(COUNCIL, { width: 0.0005 });
  },
};

const SHARDS = [[0.05, 0.98], [0.05, 0.62], [0.95, 0.62], [0.95, 0.98]];
const narsil = {
  aspect: 1.8,
  outline: many(SHARDS, [[0.12, 0.62], [0.16, 0.14], [0.2, 0.62]], [[0.3, 0.62], [0.36, 0.3], [0.42, 0.32], [0.4, 0.62]], [[0.55, 0.62], [0.58, 0.08], [0.62, 0.62]], [[0.74, 0.62], [0.74, 0.42], [0.86, 0.4], [0.88, 0.48], [0.82, 0.48], [0.82, 0.62]]),
  draw(b) {
    b.wash(SHARDS, { v: ['#a8302a', '#5a1410'] }, { edge: 0.5 });
    for (const s of [[[0.12, 0.62], [0.16, 0.14], [0.2, 0.62]], [[0.3, 0.62], [0.36, 0.3], [0.42, 0.32], [0.4, 0.62]], [[0.55, 0.62], [0.58, 0.08], [0.62, 0.62]]]) b.wash(s, { h: ['#f4f8ff', '#8a96a8'] }, { edge: 0.4 });
    b.wash([[0.74, 0.62], [0.74, 0.42], [0.86, 0.4], [0.88, 0.48], [0.82, 0.48], [0.82, 0.62]], { v: ['#e8c45a', '#8a6a2a'] });
    b.silhouette(narsil.outline, { width: 0.0004 });
  },
};

const bilbosBook = {
  aspect: 1.2,
  outline: many(smooth([[0.04, 0.4], [0.5, 0.5], [0.96, 0.4], [0.96, 0.9], [0.5, 0.98], [0.04, 0.9]]), [[0.42, 0.98], [0.58, 0.98], [0.56, 0.5], [0.44, 0.5]]),
  draw(b) {
    b.wash([[0.42, 0.98], [0.58, 0.98], [0.56, 0.5], [0.44, 0.5]], '#5a3a1e');
    const pages = smooth([[0.04, 0.4], [0.5, 0.5], [0.96, 0.4], [0.96, 0.9], [0.5, 0.98], [0.04, 0.9]]);
    b.wash(pages, { h: ['#fbf4e2', '#d8c8a0'] }, { edge: 0.4 });
    for (let i = 0; i < 6; i++) {
      b.line([[0.1, 0.52 + i * 0.06], [0.42, 0.56 + i * 0.06]], { width: 0.0002, alpha: 0.5, twice: false });
      b.line([[0.58, 0.56 + i * 0.06], [0.9, 0.52 + i * 0.06]], { width: 0.0002, alpha: 0.5, twice: false });
    }
    b.fill(pages, { h: [rgba('#8a2a18', 0), rgba('#8a2a18', 0.3)], x0: 0.4, x1: 0.5 });
    b.silhouette(bilbosBook.outline, { width: 0.0004 });
  },
};

const ringOnPlinth = {
  aspect: 0.8,
  outline: smooth([[0.25, 0.98], [0.3, 0.5], [0.2, 0.42], [0.5, 0.0], [0.8, 0.42], [0.7, 0.5], [0.75, 0.98]]),
  draw(b) {
    b.fill(ringOnPlinth.outline, { v: ['#fff2c0', '#c88a3a'] });
    b.glow(0.5, 0.35, 0.012, '#ffd36a', 1);
    b.ink(oval(0.5, 0.36, 0.22, 0.12), { width: 0.0008, colour: '#ffcf4a', twice: false });
  },
};

// ------------------------------------------------------------ Caradhras
const blizzard = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#7a808c', mid: '#b8bcc4', bottom: '#e2e4e8' });
    range(b, [[0.22, 0.42], [0.52, 0.06], [0.82, 0.36]], { rock: '#9a5a4a', snow: '#f8f8fa', foot: 1, seed: 7, snowLine: 0.3 });
    b.fill(BOX, { v: [rgba('#e8eaee', 0.1), rgba('#e8eaee', 0.55)] });
  },
};

const SLOPE = [[0, 0.5], [0.15, 0.3], [0.3, 0.42], [0.45, 0.2], [0.6, 0.38], [0.75, 0.25], [0.9, 0.4], [1, 0.32]];
const snowSlope = {
  outline: top(SLOPE),
  draw(b) {
    b.wash(top(SLOPE), { v: ['#ffffff', '#c8ccd8'] }, { edge: 0.3 });
    b.hatch(top(SLOPE), { angle: -0.4, gap: 0.0018, colour: '#8a90a8', alpha: 0.35, fade: (x, y) => Math.max(0, y - 0.4) });
    for (const [x, y] of [[0.12, 0.6], [0.4, 0.5], [0.7, 0.62], [0.88, 0.55]]) b.fill(rough([[x, y], [x + 0.04, y - 0.06], [x + 0.08, y], [x + 0.06, y + 0.06], [x, y + 0.05]], 0.01, Math.round(x * 50), { n: 2, closed: true }), '#6a5a52', 0.9);
    b.silhouette(top(SLOPE), { width: 0.0005 });
  },
};

const snowfall = {
  bare: true,
  outline: BOX,
  draw(b) {
    b.stipple(null, { n: 260, size: 0.0007, colour: '#ffffff', alpha: 0.9 });
    b.hatch(BOX, { angle: 2.2, gap: 0.006, width: 0.0002, colour: '#ffffff', alpha: 0.4 });
  },
};

const crebain = {
  aspect: 2.6,
  bare: true,
  outline: BOX,
  draw(b) {
    for (let i = 0; i < 34; i++) {
      const x = 0.08 + b.r() * 0.84;
      const y = 0.25 + b.r() * 0.5 + Math.sin(x * 6) * 0.1;
      const s = 0.012 + b.r() * 0.012;
      const crow = smooth([[x - s, y], [x - s * 0.4, y - s * 1.8], [x, y + s * 0.3], [x + s * 0.4, y - s * 1.8], [x + s, y], [x, y + s * 1.2]]);
      b.ink(crow, { width: 0.0007, colour: '#f3e7cb', alpha: 1, twice: false });
      b.fill(crow, '#120e0c', 1);
    }
  },
};

const fellowship = {
  aspect: 2.2,
  outline: many(...[0.1, 0.26, 0.42, 0.58, 0.72, 0.86].map((x, i) => oval(x, 0.6 + (i > 3 ? 0.12 : 0), 0.05, i > 3 ? 0.28 : 0.4))),
  draw(b) {
    [0.1, 0.26, 0.42, 0.58, 0.72, 0.86].forEach((x, i) => {
      const small = i > 3;
      const c = ['#7a7e86', '#3e4a36', '#4a3a2a', '#3a5a40', '#5a6a3a', '#4f6a8a'][i];
      b.wash(oval(x, 0.6 + (small ? 0.12 : 0), 0.05, small ? 0.28 : 0.4), { v: [tint(c, 0.2), shade(c, 0.3)] }, { edge: 0.4 });
      b.fill(circle(x, small ? 0.5 : 0.28, 0.022), '#e2c4a2');
    });
    b.silhouette(fellowship.outline, { width: 0.0004 });
  },
};

const windFace = {
  aspect: 1.4,
  outline: blob(0.5, 0.5, 0.45, { bumps: 7, depth: 0.25, seed: 9, aspect: 1.4 }),
  draw(b) {
    b.fill(windFace.outline, { radial: [0.5, 0.5, 0.5], stops: [[0, '#ffffff'], [1, '#c8d8f0']] });
    b.fill(oval(0.38, 0.45, 0.06, 0.05), '#6a7a9a').fill(oval(0.62, 0.45, 0.06, 0.05), '#6a7a9a');
    b.fill(oval(0.5, 0.7, 0.1, 0.06), '#6a7a9a');
  },
};

// ------------------------------------------------------------ Moria
const lakeNight = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#0c1222', mid: '#1c2640', bottom: '#2e3a54' });
    stars(b, { n: 110, box: [0, 0, 1, 0.7] });
    farHills(b, 0.94, '#141a26', { seed: 8, haze: '#3a4660' });
  },
};

const CLIFF = [[0, 0.42], [0.08, 0.3], [0.14, 0.16], [0.24, 0.1], [0.36, 0.04], [0.5, 0.0], [0.64, 0.05], [0.76, 0.12], [0.86, 0.2], [0.94, 0.32], [1, 0.4]];
const cliff = {
  outline: top(CLIFF),
  draw(b) {
    b.wash(top(CLIFF), { from: [0.3, 0], to: [0.7, 1], stops: [[0, '#5a6070'], [0.6, '#3a4050'], [1, '#22262e']] }, { edge: 0.5 });
    b.hatch(top(CLIFF), { angle: 1.45, gap: 0.0016, alpha: 0.35 });
    for (let i = 0; i < 14; i++) {
      const x = b.r();
      const y = 0.2 + b.r() * 0.7;
      b.line(rough([[x, y], [x + 0.03, y + 0.05]], 0.01, i + 3), { width: 0.0004, alpha: 0.5, twice: false });
    }
    // the cliff’s strata and ledges, and the old road along the lake to the doors
    for (let i = 0; i < 7; i++) {
      const y = 0.25 + i * 0.1;
      b.curve(rough([[0.02, y + 0.02], [0.3, y], [0.6, y + 0.03], [0.98, y + 0.01]], 0.01, 40 + i), { width: 0.0004, colour: '#14161c', alpha: 0.45, twice: false });
    }
    for (const [x, y] of [[0.12, 0.6], [0.82, 0.48], [0.68, 0.72], [0.2, 0.38], [0.9, 0.7]]) b.fill(rough([[x, y], [x + 0.05, y - 0.03], [x + 0.1, y], [x + 0.08, y + 0.04], [x, y + 0.04]], 0.008, Math.round(x * 60), { n: 2, closed: true }), '#6a7080', 0.6);
    b.fill([[0, 0.94], [1, 0.9], [1, 1], [0, 1]], '#2a2e36');
    b.line([[0, 0.94], [1, 0.9]], { width: 0.0005, alpha: 0.6, twice: false });
    // the hollies either side of the doors, Eregion’s mark
    for (const x of [0.25, 0.75]) b.clump(x, 0.84, 0.05, '#2a4a2e', { seed: Math.round(x * 30), lit: 0.25 });
    b.silhouette(top(CLIFF), { width: 0.0005 });
  },
};

// the ithildin, drawn as the moon shows it: the arch and its pillars, the
// two trees, the crown and seven stars, the star of the house of Fëanor
const ithildin = {
  aspect: 0.62,
  outline: smooth([[0.02, 0.98], [0.02, 0.28], [0.18, 0.08], [0.5, 0.0], [0.82, 0.08], [0.98, 0.28], [0.98, 0.98]]),
  draw(b) {
    const silver = '#e8f2ff';
    b.fill(ithildin.outline, { v: ['#3a4256', '#262a36'] });
    b.glow(0.5, 0.5, 0.05, '#9ab8e8', 0.35);
    const line = (pts, wdt = 0.0006) => b.curve(pts, { width: wdt, colour: silver, alpha: 0.95, twice: false });
    line([[0.12, 0.98], [0.12, 0.3], [0.3, 0.12], [0.5, 0.07], [0.7, 0.12], [0.88, 0.3], [0.88, 0.98]], 0.0008);
    line([[0.18, 0.98], [0.18, 0.34], [0.34, 0.18], [0.5, 0.14], [0.66, 0.18], [0.82, 0.34], [0.82, 0.98]]);
    for (const x of [0.32, 0.68]) {
      line([[x, 0.98], [x, 0.5]]);
      for (const a of [-0.8, -0.4, 0, 0.4, 0.8]) line([[x, 0.6 - Math.abs(a) * 0.05], [x + a * 0.12, 0.42 - Math.abs(a) * 0.04]]);
    }
    b.ink(circle(0.5, 0.55, 0.08), { width: 0.0006, colour: silver, twice: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      line([[0.5, 0.55], [0.5 + Math.cos(a) * 0.12, 0.55 + Math.sin(a) * 0.12 * (b.w / b.h)]], 0.0004);
    }
    for (let i = 0; i < 7; i++) b.fill(circle(0.3 + i * 0.067, 0.27 + Math.abs(i - 3) * 0.02, 0.012), silver);
    b.ink(smooth([[0.42, 0.37], [0.46, 0.32], [0.5, 0.36], [0.54, 0.32], [0.58, 0.37], [0.56, 0.4], [0.44, 0.4]]), { width: 0.0005, colour: silver, twice: false });
  },
};

const moonCard = {
  aspect: 1,
  outline: circle(0.5, 0.5, 0.48),
  draw(b) {
    moon(b, 0.5, 0.5, 0.46, { colour: '#efeadc', halo: '#c8d4f0' });
  },
};

const blackPool = {
  aspect: 4,
  outline: smooth([[0.02, 0.98], [0.06, 0.55], [0.3, 0.42], [0.7, 0.42], [0.94, 0.55], [0.98, 0.98]]),
  draw(b) {
    water(b, blackPool.outline, { deep: '#06080c', light: '#2a3448', y0: 0.4, y1: 1, n: 20 });
    for (const [x, r] of [[0.4, 0.06], [0.62, 0.09]]) b.ink(oval(x, 0.72, r, r * 0.6), { width: 0.0003, colour: '#8a9ab8', alpha: 0.6, twice: false });
  },
};

const tentacle = {
  aspect: 0.3,
  outline: smooth([[0.3, 0.98], [0.2, 0.6], [0.4, 0.3], [0.7, 0.05], [0.8, 0.12], [0.6, 0.35], [0.55, 0.6], [0.7, 0.98]]),
  draw(b) {
    b.wash(tentacle.outline, { h: ['#5a6a4a', '#1e2618'] }, { edge: 0.5 });
    b.stipple(tentacle.outline, { n: 14, size: 0.0006, colour: '#c8d0a8', alpha: 0.7 });
    b.silhouette(tentacle.outline, { width: 0.0004 });
  },
};

const deepDrum = {
  aspect: 1.1,
  outline: smooth([[0.1, 0.25], [0.5, 0.12], [0.9, 0.25], [0.9, 0.88], [0.5, 0.98], [0.1, 0.88]]),
  draw(b) {
    b.wash(deepDrum.outline, { h: ['#8a5a3a', '#3a2010'] }, { edge: 0.5 });
    b.wash(oval(0.5, 0.25, 0.4, 0.12), { v: ['#e8d8b8', '#b8a07a'] }, { edge: 0.4 });
    for (const x of [0.2, 0.4, 0.6, 0.8]) b.line([[x, 0.3], [x + 0.1, 0.9]], { width: 0.0004, colour: '#d8b04a', twice: false });
    b.silhouette(deepDrum.outline, { width: 0.0005 });
  },
};

const durinsCrown = {
  aspect: 1.4,
  outline: blob(0.5, 0.5, 0.46, { bumps: 9, depth: 0.08, seed: 3, aspect: 1.4 }),
  draw(b) {
    b.fill(durinsCrown.outline, { radial: [0.5, 0.5, 0.5], stops: [[0, '#ffffff'], [1, '#a8c8f8']] });
    b.ink([[0.25, 0.7], [0.25, 0.4], [0.37, 0.55], [0.5, 0.3], [0.63, 0.55], [0.75, 0.4], [0.75, 0.7]], { width: 0.0008, colour: '#3a5a9a', twice: false });
    for (let i = 0; i < 7; i++) b.fill(circle(0.2 + i * 0.1, 0.2 + Math.abs(i - 3) * 0.03, 0.015), '#3a5a9a');
  },
};

// ------------------------------------------------------------ Lothlórien
const twilight = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#1a2448', mid: '#3a4a7a', bottom: '#7a8ab8' });
    stars(b, { n: 70, box: [0, 0, 1, 0.5] });
    for (const [i, x] of [0.08, 0.26, 0.74, 0.92].entries()) mallorn(b, x, 1, 0.75 - (i % 2) * 0.1, { seed: i + 2, leaf: '#b8a04a', lamps: false });
    b.fill(BOX, { v: [rgba('#3a4a7a', 0), rgba('#3a4a7a', 0.45)], y0: 0.4, y1: 1 });
  },
};

const wood = {
  outline: many(...[0.12, 0.38, 0.62, 0.88].map((x, i) => mallornOutline(x, 1, 0.95 - (i % 2) * 0.1, { seed: 10 + i }))),
  draw(b) {
    [0.12, 0.38, 0.62, 0.88].forEach((x, i) => mallorn(b, x, 1, 0.95 - (i % 2) * 0.1, { seed: 10 + i }));
    // the flets: platforms high in the trees, and their lamps
    for (const [x, y] of [[0.12, 0.42], [0.38, 0.5], [0.62, 0.38], [0.88, 0.46]]) {
      b.fill([[x - 0.05, y], [x + 0.05, y], [x + 0.045, y + 0.015], [x - 0.045, y + 0.015]], '#e8e2d0').ink([[x - 0.05, y], [x + 0.05, y], [x + 0.045, y + 0.015], [x - 0.045, y + 0.015]], { width: 0.0003, twice: false });
    }
  },
};

const lampsCard = {
  bare: true,
  outline: BOX,
  draw(b) {
    for (let i = 0; i < 12; i++) {
      const x = 0.06 + i * 0.08 + Math.sin(i * 3) * 0.02;
      const y = 0.35 + Math.sin(i * 1.7) * 0.25;
      b.glow(x, y, 0.006, '#eef4ff', 1);
      b.fill(oval(x, y, 0.01, 0.06), '#f6f8ff');
    }
  },
};

const mirror = {
  aspect: 1.1,
  outline: many(smooth([[0.08, 0.3], [0.92, 0.3], [0.8, 0.5], [0.2, 0.5]]), [[0.42, 0.5], [0.58, 0.5], [0.62, 0.98], [0.38, 0.98]]),
  draw(b) {
    b.wash([[0.42, 0.5], [0.58, 0.5], [0.62, 0.98], [0.38, 0.98]], { h: ['#f2f2f4', '#8a8a96'] }, { edge: 0.4 });
    b.wash(smooth([[0.08, 0.3], [0.92, 0.3], [0.8, 0.5], [0.2, 0.5]]), { h: ['#ffffff', '#9a9aaa'] }, { edge: 0.4 });
    b.fill(oval(0.5, 0.32, 0.38, 0.05), { h: ['#4a6a9a', '#1a2a4a'] });
    b.stipple(oval(0.5, 0.32, 0.38, 0.05), { n: 12, size: 0.0004, colour: '#ffffff', alpha: 0.9 });
    b.silhouette(mirror.outline, { width: 0.0004 });
  },
};

const visionCard = {
  aspect: 1.6,
  outline: oval(0.5, 0.5, 0.48, 0.45),
  draw(b) {
    b.fill(visionCard.outline, { radial: [0.5, 0.5, 0.5], stops: [[0, '#ffb04a'], [0.6, '#a8301a'], [1, '#2a0a06']] });
    for (const x of [0.25, 0.45, 0.65]) b.fill(smooth([[x, 0.8], [x + 0.05, 0.55], [x + 0.1, 0.8]]), '#1a0c06');
  },
};

// ------------------------------------------------------------ the Argonath
const gorge = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#6a8aa8', mid: '#b8c8d0', bottom: '#e8e0c8' });
    clouds(b, [[0.25, 0.25, 0.08, 3], [0.7, 0.18, 0.1, 6]], { colour: '#f2eee4' });
    range(b, [[0.15, 0.5], [0.38, 0.4], [0.62, 0.42], [0.85, 0.5]], { rock: '#7a7a72', snow: null, foot: 0.95, haze: '#d8dcd8', seed: 9 });
  },
};

const rauros = {
  aspect: 3.2,
  outline: many([[0, 0.98], [0, 0.35], [0.35, 0.3], [0.35, 0.98]], [[0.65, 0.98], [0.65, 0.3], [1, 0.35], [1, 0.98]], [[0.35, 0.3], [0.65, 0.3], [0.68, 0.98], [0.32, 0.98]]),
  draw(b) {
    for (const s of [[[0, 0.98], [0, 0.35], [0.35, 0.3], [0.35, 0.98]], [[0.65, 0.98], [0.65, 0.3], [1, 0.35], [1, 0.98]]]) b.wash(s, { v: ['#8a8a80', '#4a4a44'] }, { edge: 0.4 });
    b.fill([[0.35, 0.3], [0.65, 0.3], [0.68, 0.98], [0.32, 0.98]], { v: ['#ffffff', '#c8dce8'] });
    b.hatch([[0.35, 0.3], [0.65, 0.3], [0.68, 0.98], [0.32, 0.98]], { angle: 1.57, gap: 0.0007, colour: '#7aa0b8', alpha: 0.5 });
    b.fill(oval(0.5, 0.95, 0.25, 0.1), '#ffffff', 0.8);
  },
};

const BANK_L = [[0, 0.1], [0.12, 0.05], [0.25, 0.15], [0.32, 0.4], [0.36, 1], [0, 1]];
const BANK_R = [[1, 0.1], [0.88, 0.05], [0.75, 0.15], [0.68, 0.4], [0.64, 1], [1, 1]];
const banks = {
  outline: many(BANK_L, BANK_R),
  draw(b) {
    for (const side of [BANK_L, BANK_R]) {
      b.wash(side, { v: ['#8a8478', '#3e3a34'] }, { edge: 0.5 });
      b.hatch(side, { angle: 1.4, gap: 0.0015, alpha: 0.4 });
      b.silhouette(side, { width: 0.0005 });
    }
  },
};

const BOAT = (x, y, s) => smooth([[x - s, y - s * 0.25], [x - s * 0.6, y + s * 0.15], [x + s * 0.6, y + s * 0.15], [x + s, y - s * 0.25], [x + s * 0.7, y - s * 0.1], [x - s * 0.7, y - s * 0.1]]);
const boats = {
  aspect: 3,
  outline: many(BOAT(0.2, 0.7, 0.14), BOAT(0.5, 0.6, 0.14), BOAT(0.8, 0.72, 0.14), ...[0.2, 0.5, 0.8].map((x, i) => oval(x, i === 1 ? 0.42 : 0.52, 0.025, 0.2))),
  draw(b) {
    [0.2, 0.5, 0.8].forEach((x, i) => {
      const y = i === 1 ? 0.6 : i === 0 ? 0.7 : 0.72;
      b.wash(oval(x, y - 0.18, 0.025, 0.2), '#5a6a52', { edge: 0.4 });
      b.fill(circle(x, y - 0.38, 0.018), '#e2c4a2');
      b.wash(BOAT(x, y, 0.14), { v: ['#f2f2ec', '#a8aca4'] }, { edge: 0.4 });
    });
    b.silhouette(boats.outline, { width: 0.0004 });
  },
};

export const SCENES = {
  rivendell: {
    ground: (b, page) =>
      ground(b, page, { far: '#a89a5a', near: '#7a6a3a', blotch: '#c8702a', seed: 21 }, (g) => {
        g.fill(oval(0.5, 0.62, 0.3, 0.2), { radial: [0.5, 0.62, 0.3], stops: [[0, '#d8ccb0'], [1, '#a89a7a']] });
        g.stipple(null, { n: 200, size: 0.0009, colour: '#c8602a', box: [0.03, 0.2, 0.97, 0.95] });
        g.stipple(null, { n: 160, size: 0.0009, colour: '#e8b83a', box: [0.03, 0.2, 0.97, 0.95] });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: valley, shadow: false },
      { id: 'house', kind: 'flat', at: [0, -0.11], w: 0.34, h: 0.13, fold: 'in', lift: 0.9, art: lastHomelyHouse },
      { id: 'tree-l', kind: 'card', at: [-0.17, -0.06], h: 0.12, turn: 0.3, lift: 0.75, art: autumn(3, '#c8702a') },
      { id: 'tree-r', kind: 'card', at: [0.17, -0.05], h: 0.13, turn: -0.3, lift: 0.75, art: autumn(4, '#d8a03a') },
      { id: 'chairs', kind: 'card', at: [-0.03, 0.0], h: 0.035, lift: 0.45, art: chairs, toy: 'council', does: [{ act: 'hop' }] },
      { id: 'elrond', kind: 'card', at: [-0.04, 0.02], h: 0.11, lift: 0.4, art: elf({ gown: '#7a2a3a', hair: '#2a1e18', crown: true }), toy: 'council', does: [{ act: 'hop' }] },
      { id: 'narsil', kind: 'card', at: [0.1, 0.06], h: 0.03, lift: 0.25, art: narsil, toy: 'narsil', does: [{ act: 'shine', colour: '#dfe8ff' }] },
      { id: 'book', kind: 'card', at: [-0.14, 0.08], h: 0.035, turn: 0.3, lift: 0.15, art: bilbosBook, toy: 'book', does: [{ act: 'hop' }] },
      { id: 'bilbo', kind: 'card', at: [-0.17, 0.06], h: 0.055, turn: 0.4, lift: 0.15, art: hobbit({ coat: '#6a4a2a', vest: '#c8402a', hair: '#d8d0c0' }), toy: 'book', does: [{ act: 'hop' }] },
      { id: 'plinth', kind: 'card', at: [0.03, 0.02], y: 0.035, h: 0.03, lift: 0.4, ghost: true, find: true, art: ringOnPlinth },
    ],
  },
  caradhras: {
    ground: (b, page) =>
      ground(b, page, { far: '#e8eaf0', near: '#c8ccd8', blotch: '#a8aec0', seed: 23 }, (g) => {
        g.stipple(null, { n: 300, size: 0.0008, colour: '#ffffff', alpha: 0.9 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.23, fold: 'in', lift: 1, art: blizzard, shadow: false },
      { id: 'redhorn', kind: 'flat', at: [0, -0.1], w: 0.46, h: 0.1, fold: 'in', lift: 0.9, art: snowSlope },
      { id: 'company', kind: 'card', at: [-0.05, -0.03], h: 0.05, lift: 0.6, art: fellowship },
      { id: 'crebain', kind: 'card', at: [-0.08, -0.08], y: 0.13, h: 0.06, lift: 0.9, art: crebain, toy: 'crebain', does: [{ act: 'fly' }], shadow: false },
      { id: 'gimli', kind: 'card', at: [0.07, 0.06], h: 0.06, turn: -0.2, lift: 0.25, art: dwarf(), toy: 'gimli', does: [{ act: 'hop' }] },
      { id: 'gandalf', kind: 'card', at: [-0.12, 0.05], h: 0.11, turn: 0.2, lift: 0.3, art: wizard({ robe: '#8a8e98' }) },
      { id: 'snow', kind: 'flat', at: [0, 0.03], w: 0.46, h: 0.16, fold: 'in', lift: 0.5, art: snowfall, toy: 'snow', does: [{ act: 'sway' }], soft: true, shadow: false },
      { id: 'voice', kind: 'card', at: [0.12, -0.02], y: 0.08, h: 0.05, lift: 0.6, ghost: true, find: true, art: windFace },
    ],
  },
  moria: {
    ground: (b, page) =>
      ground(b, page, { far: '#2a3040', near: '#181c24', blotch: '#0c0e14', seed: 25 }, (g) => {
        water(g, smooth([[0.1, 0.95], [0.08, 0.6], [0.3, 0.42], [0.7, 0.42], [0.92, 0.6], [0.9, 0.95]]), { deep: '#06080c', light: '#2a3448', y0: 0.42, y1: 0.95, n: 30 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.158], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: lakeNight, shadow: false },
      { id: 'cliff', kind: 'flat', at: [0, -0.13], w: 0.46, h: 0.2, fold: 'in', lift: 0.95, art: cliff, toy: 'doors', does: [{ act: 'speak' }] },
      { id: 'cliff-lit', kind: 'card', at: [0, -0.128], h: 0.13, lift: 0.95, hidden: true, art: ithildin, toy: 'doors', does: [{ act: 'speak' }], shadow: false },
      { id: 'moon', kind: 'card', at: [-0.17, -0.12], y: 0.17, h: 0.04, lift: 0.95, art: moonCard, toy: 'moon', does: [{ act: 'show', target: ['cliff-lit'], for: 8 }], shadow: false },
      { id: 'gandalf', kind: 'card', at: [-0.05, -0.06], h: 0.11, turn: 0.15, lift: 0.7, art: wizard({ robe: '#8a8e98' }) },
      { id: 'frodo', kind: 'card', at: [0.06, -0.05], h: 0.045, lift: 0.65, art: hobbit({ coat: '#4f6a8a', pack: true, cloak: '#5a6a52' }) },
      { id: 'pool', kind: 'card', at: [0, 0.04], w: 0.3, h: 0.06, lift: 0.25, art: blackPool, toy: 'pool', does: [{ act: 'tentacle' }], shadow: false },
      { id: 'tentacle', kind: 'card', at: [0.05, 0.05], h: 0.1, lift: 0.2, hidden: true, low: true, art: tentacle, shadow: false },
      { id: 'drum', kind: 'card', at: [0.16, 0.09], h: 0.035, lift: 0.1, art: deepDrum, toy: 'drum', does: [{ act: 'thud' }] },
      { id: 'durin', kind: 'card', at: [0, -0.125], y: 0.15, h: 0.04, lift: 1, ghost: true, find: true, art: durinsCrown },
    ],
  },
  lorien: {
    ground: (b, page) =>
      ground(b, page, { far: '#5a6a7a', near: '#3a4a5a', blotch: '#c8a84a', seed: 27 }, (g) => {
        g.stipple(null, { n: 260, size: 0.001, colour: '#e8c85a', box: [0.03, 0.2, 0.97, 0.95] });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: twilight, shadow: false },
      { id: 'wood', kind: 'flat', at: [0, -0.11], w: 0.46, h: 0.2, fold: 'in', lift: 0.95, art: wood },
      { id: 'lamps', kind: 'glow', at: [0, -0.09], y: 0.13, size: 0.3, colour: '#dfe8ff', on: true, toy: 'lamps' },
      { id: 'lamp-card', kind: 'flat', at: [0, -0.08], y: 0.08, w: 0.4, h: 0.07, fold: 'in', lift: 0.95, art: lampsCard, soft: true, toy: 'lamps', does: [{ act: 'light', target: ['lamps'] }], shadow: false },
      { id: 'basin', kind: 'card', at: [0.04, 0.03], h: 0.05, lift: 0.3, art: mirror, toy: 'basin', does: [{ act: 'show', target: ['vision'], for: 5 }] },
      { id: 'vision', kind: 'card', at: [0.04, 0.032], y: 0.04, h: 0.02, lift: 0.3, hidden: true, art: visionCard, shadow: false },
      { id: 'galadriel', kind: 'card', at: [-0.06, 0.02], h: 0.12, turn: 0.2, lift: 0.4, art: elf({ gown: '#f6f4ee', hair: '#e8c86a', light: false }), toy: 'galadriel', does: [{ act: 'shine', colour: '#ffffff' }] },
      { id: 'frodo', kind: 'card', at: [0.11, 0.06], h: 0.045, turn: -0.3, lift: 0.3, art: hobbit({ coat: '#4f6a8a', cloak: '#6a7a62' }) },
      { id: 'eye', kind: 'card', at: [0.04, 0.034], y: 0.065, h: 0.02, lift: 0.3, ghost: true, find: true, art: eye() },
    ],
  },
  anduin: {
    ground: (b, page) =>
      ground(b, page, { far: '#6a7a6a', near: '#4a5a4a', blotch: '#3a4a3a', seed: 29 }, (g) => {
        water(g, [[0.3, 0], [0.7, 0], [0.85, 1], [0.15, 1]], { deep: '#2a4a5a', light: '#8ab0c0', n: 60 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.158], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: gorge, shadow: false },
      { id: 'falls', kind: 'card', at: [0, -0.15], w: 0.2, h: 0.06, lift: 1, art: rauros, toy: 'falls', does: [{ act: 'sway' }], shadow: false },
      { id: 'banks', kind: 'flat', at: [0, -0.12], w: 0.46, h: 0.15, fold: 'in', lift: 0.95, art: banks },
      { id: 'king-l', kind: 'card', at: [-0.1, -0.075], h: 0.2, turn: 0.35, lift: 0.8, art: king(), toy: 'kings', does: [{ act: 'raise' }] },
      { id: 'king-r', kind: 'card', at: [0.1, -0.075], h: 0.2, turn: -0.35, lift: 0.8, art: king({ mirror: true }), toy: 'kings', does: [{ act: 'raise' }] },
      { id: 'boats', kind: 'card', at: [0, 0.03], h: 0.045, lift: 0.4, art: boats, toy: 'boats', does: [{ act: 'sail' }] },
      { id: 'aragorn', kind: 'card', at: [-0.02, 0.06], h: 0.075, lift: 0.25, art: ranger({ hood: false, cloak: '#3a4a3a' }), toy: 'aragorn', does: [{ act: 'hop' }] },
      { id: 'isildur', kind: 'card', at: [0.06, -0.01], h: 0.1, lift: 0.4, ghost: true, find: true, art: elf({ gown: '#e8eef8', hair: '#c8d0e0', crown: true, light: true }) },
    ],
  },
};

