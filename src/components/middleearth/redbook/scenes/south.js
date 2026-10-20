// The last five pages’ pop-ups: the Dead Marshes, the stair of Cirith
// Ungol, the beacons and the White City, Mount Doom and the Grey Havens, and
// the back pages’ grounds (./shire.js has the shape of a page).

import { blob, circle, many, oval, rgba, smooth, top } from '../brush';
import { bird, elf, eye, hobbit, smeagol, wizard } from '../figures';
import { clouds, deadTree, lit, range, rangeOutline, ripples, sky, stars, water } from '../props';
import { border, gutter, ground, paper } from './ground';
import { ARCH, farHills } from './shire';

const BOX = [[0, 0], [1, 0], [1, 1], [0, 1]];

// ------------------------------------------------------------ the Dead Marshes
const murk = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#141a18', mid: '#2a3430', bottom: '#4a564e' });
    range(b, [[0.15, 0.62], [0.4, 0.55], [0.66, 0.6], [0.9, 0.5]], { rock: '#262a28', snow: null, foot: 0.92, haze: '#4a564e', seed: 13 });
    b.fill(BOX, { v: [rgba('#a8b8a8', 0), rgba('#a8b8a8', 0.35)], y0: 0.6, y1: 1 });
  },
};

const REEDS = [[0, 0.6], [0.1, 0.35], [0.2, 0.55], [0.3, 0.3], [0.42, 0.5], [0.55, 0.32], [0.68, 0.52], [0.8, 0.28], [0.9, 0.5], [1, 0.38]];
const reeds = {
  outline: top(REEDS),
  draw(b) {
    b.wash(top(REEDS), { v: ['#4a5038', '#1e2218'] }, { edge: 0.4 });
    for (let i = 0; i < 70; i++) {
      const x = i / 70 + (b.r() - 0.5) * 0.01;
      b.curve([[x, 1], [x + 0.005, 0.7], [x + 0.012 * (b.r() - 0.3), 0.35 + b.r() * 0.2]], { width: 0.0004, colour: '#8a8a5a', alpha: 0.7, twice: false });
    }
    // mist lying over the reeds
    for (let i = 0; i < 5; i++) b.fill(oval(0.1 + i * 0.2, 0.75, 0.16, 0.12), '#c8d4c8', 0.18);
    b.silhouette(top(REEDS), { width: 0.0005 });
  },
};

const marshLight = {
  aspect: 0.5,
  outline: oval(0.5, 0.6, 0.45, 0.38),
  draw(b) {
    b.glow(0.5, 0.55, 0.01, '#d8ff9a', 0.9);
    b.fill(smooth([[0.4, 0.8], [0.45, 0.45], [0.5, 0.25], [0.55, 0.45], [0.6, 0.8]]), '#f2ffd0');
  },
};

const TUFTS = [0.1, 0.32, 0.55, 0.78, 0.94];
const tussocks = {
  aspect: 4.5,
  outline: many(...TUFTS.map((x, i) => blob(x, 0.62, 0.075, { bumps: 7, depth: 0.35, seed: i + 2, aspect: 4.5 }))),
  draw(b) {
    TUFTS.forEach((x, i) => {
      const tuft = blob(x, 0.62, 0.075, { bumps: 7, depth: 0.35, seed: i + 2, aspect: 4.5 });
      b.wash(tuft, { v: ['#8a8a52', '#3a3a22'] }, { edge: 0.4 });
      b.hatch(tuft, { angle: -1.4, gap: 0.0008, colour: '#2a2a16', alpha: 0.5 });
      b.silhouette(tuft, { width: 0.0003 });
    });
  },
};

const facesBelow = {
  aspect: 3,
  outline: oval(0.5, 0.5, 0.48, 0.45),
  draw(b) {
    for (const x of [0.2, 0.5, 0.8]) {
      b.fill(oval(x, 0.5, 0.1, 0.36), '#e8f0f8', 0.85);
      b.fill(oval(x - 0.03, 0.42, 0.018, 0.06), '#5a6a88').fill(oval(x + 0.03, 0.42, 0.018, 0.06), '#5a6a88');
      b.fill(oval(x, 0.66, 0.025, 0.06), '#5a6a88');
    }
  },
};

// ------------------------------------------------------------ Cirith Ungol
const mordorSky = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#120808', mid: '#3a1410', bottom: '#8a3018' });
    clouds(b, [[0.2, 0.3, 0.1, 3], [0.6, 0.22, 0.14, 7], [0.9, 0.35, 0.08, 2]], { colour: '#3a1a14', ink: false });
    range(b, [[0.08, 0.5], [0.22, 0.38], [0.36, 0.52], [0.52, 0.34], [0.7, 0.48], [0.86, 0.32], [0.98, 0.46]], { rock: '#1e1414', snow: null, foot: 1, seed: 17 });
  },
};

const STAIR = [[0, 1], [0, 0.5], [0.12, 0.4], [0.2, 0.25], [0.3, 0.15], [0.42, 0.28], [0.5, 0.45], [0.6, 0.35], [0.72, 0.5], [0.84, 0.42], [1, 0.6], [1, 1]];
const stair = {
  outline: smooth(STAIR),
  draw(b) {
    b.wash(smooth(STAIR), { v: ['#3a3434', '#141010'] }, { edge: 0.5 });
    // the endless stair, cut in the rock, zig and zag
    const steps = [[0.08, 0.95], [0.22, 0.8], [0.12, 0.66], [0.26, 0.5], [0.18, 0.38], [0.28, 0.22]];
    for (let i = 0; i < steps.length - 1; i++) {
      const [x0, y0] = steps[i];
      const [x1, y1] = steps[i + 1];
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        b.line([[x - 0.02, y], [x + 0.02, y]], { width: 0.0004, colour: '#8a7a6a', alpha: 0.7, twice: false });
      }
    }
    // the tunnel’s mouth, and the dark in it
    b.fill(smooth([[0.55, 1], [0.56, 0.7], [0.65, 0.6], [0.74, 0.7], [0.75, 1]]), '#030202');
    b.hatch(smooth(STAIR), { angle: -1.2, gap: 0.0015, alpha: 0.4, colour: '#000000' });
    b.silhouette(smooth(STAIR), { width: 0.0005, colour: '#000000' });
  },
};

const TOWER = [[0.3, 1], [0.32, 0.6], [0.26, 0.55], [0.34, 0.4], [0.3, 0.3], [0.4, 0.22], [0.42, 0.08], [0.48, 0.14], [0.5, 0.0], [0.53, 0.14], [0.58, 0.08], [0.6, 0.22], [0.7, 0.3], [0.66, 0.4], [0.74, 0.55], [0.68, 0.6], [0.7, 1]];
const theTower = {
  aspect: 0.32,
  outline: TOWER,
  draw(b) {
    b.wash(TOWER, { h: ['#3a3434', '#0e0c0c'] }, { edge: 0.5 });
    b.hatch(TOWER, { angle: 0.1, gap: 0.0012, alpha: 0.4, colour: '#000000' });
    lit(b, [[0.47, 0.28], [0.53, 0.28], [0.53, 0.34], [0.47, 0.34]], { colour: '#ff6a2a', glow: '#ff3a1a', x: 0.5, y: 0.31, r: 0.006, bars: false });
    for (const y of [0.46, 0.64, 0.8]) b.fill(oval(0.5, y, 0.03, 0.01), '#ff8a3a', 0.8);
    b.silhouette(TOWER, { width: 0.0005, colour: '#000000' });
  },
};

const web = {
  aspect: 1.2,
  outline: blob(0.5, 0.5, 0.48, { bumps: 8, depth: 0.12, seed: 4, aspect: 1.2 }),
  draw(b) {
    b.fill(web.outline, '#0c0a0a', 0.75);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      b.line([[0.5, 0.5], [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5 * 1.2]], { width: 0.0004, colour: '#d8d8d0', alpha: 0.85, twice: false });
    }
    for (let r = 0.08; r < 0.5; r += 0.07) b.ink(blob(0.5, 0.5, r, { bumps: 10, depth: 0.2, seed: 5, aspect: 1.2 }), { width: 0.0003, colour: '#d8d8d0', alpha: 0.75, twice: false });
  },
};

const phial = {
  aspect: 0.6,
  outline: smooth([[0.4, 0.05], [0.6, 0.05], [0.58, 0.3], [0.8, 0.6], [0.7, 0.95], [0.3, 0.95], [0.2, 0.6], [0.42, 0.3]]),
  draw(b) {
    b.fill(phial.outline, { radial: [0.5, 0.65, 0.5], stops: [[0, '#ffffff'], [0.6, '#cfe6ff'], [1, '#7aa0d8']] });
    b.glow(0.5, 0.65, 0.005, '#ffffff', 1);
    b.silhouette(phial.outline, { width: 0.0003, colour: '#4a6a9a' });
  },
};

const eightEyes = {
  aspect: 2,
  outline: oval(0.5, 0.5, 0.48, 0.45),
  draw(b) {
    b.fill(eightEyes.outline, '#000000', 0.6);
    for (const [x, y, r] of [[0.3, 0.45, 0.06], [0.42, 0.4, 0.07], [0.58, 0.4, 0.07], [0.7, 0.45, 0.06], [0.22, 0.6, 0.04], [0.36, 0.62, 0.04], [0.64, 0.62, 0.04], [0.78, 0.6, 0.04]]) {
      b.glow(x, y, 0.003, '#9aff6a', 0.8);
      b.fill(circle(x, y, r * 0.5), '#d8ff9a');
    }
  },
};

// ------------------------------------------------------------ the beacons
const BEACONS = [[0.06, 0.4], [0.24, 0.28], [0.42, 0.36], [0.62, 0.22], [0.82, 0.32]];
const duskWest = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#2a3050', mid: '#8a6a6a', bottom: '#e8b47a' });
    stars(b, { n: 25, box: [0, 0, 1, 0.25] });
    clouds(b, [[0.3, 0.2, 0.08, 1], [0.75, 0.15, 0.07, 3]], { colour: '#c88a7a' });
  },
};

const whiteMountains = {
  outline: rangeOutline(BEACONS, { seed: 21 }),
  draw(b) {
    const shape = range(b, BEACONS, { rock: '#7a7a8a', snow: '#f6f4f2', foot: 1, seed: 21, snowLine: 0.12 });
    b.fill(shape, { v: [rgba('#3a3050', 0), rgba('#3a3050', 0.35)], y0: 0.3, y1: 1 });
    // a stack of wood ready on every peak
    for (const [x, y] of BEACONS) b.fill([[x - 0.012, y + 0.05], [x, y + 0.02], [x + 0.012, y + 0.05]], '#4a3018').ink([[x - 0.012, y + 0.05], [x, y + 0.02], [x + 0.012, y + 0.05]], { width: 0.0003, twice: false });
  },
};

// Minas Tirith: seven white walls stepped up the hill, the prow of rock, and
// the tower over all
const TIERS = 7;
const cityShape = (() => {
  const pts = [[0.02, 1]];
  for (let i = 0; i < TIERS; i++) {
    const hw = 0.48 - i * 0.05;
    pts.push([0.5 - hw, 0.95 - i * 0.085], [0.5 - hw + 0.008, 0.88 - i * 0.085]);
  }
  pts.push([0.485, 0.3], [0.488, 0.04], [0.5, 0.0], [0.512, 0.04], [0.515, 0.3]);
  for (let i = TIERS - 1; i >= 0; i--) {
    const hw = 0.48 - i * 0.05;
    pts.push([0.5 + hw - 0.008, 0.88 - i * 0.085], [0.5 + hw, 0.95 - i * 0.085]);
  }
  pts.push([0.98, 1]);
  return pts;
})();
const whiteCity = {
  aspect: 1.1,
  outline: cityShape,
  draw(b) {
    b.wash(cityShape, { h: ['#ffffff', '#b8b8c0'] }, { edge: 0.4 });
    for (let i = 0; i < TIERS; i++) {
      const hw = 0.48 - i * 0.05;
      const y = 0.88 - i * 0.085;
      b.line([[0.5 - hw, y], [0.5 + hw, y]], { width: 0.0004, twice: false });
      for (let x = 0.5 - hw + 0.03; x < 0.5 + hw - 0.03; x += 0.05) if ((x * 97 + i) % 3 < 1.2) b.fill([[x, y - 0.05], [x + 0.012, y - 0.05], [x + 0.012, y - 0.03], [x, y - 0.03]], '#f6d27a');
    }
    // the prow of rock that splits the city
    b.fill([[0.5, 0.95], [0.46, 0.4], [0.5, 0.25], [0.54, 0.4]], { h: ['#c8c8d0', '#7a7a88'] });
    b.dark(cityShape, { from: [0.5, 0], to: [1, 0], alpha: 0.3 });
    b.silhouette(cityShape, { width: 0.0005 });
  },
};

const army = {
  aspect: 2,
  outline: many(...[0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((x, i) => oval(x, 0.6 + (i % 2) * 0.05, 0.07, 0.38))),
  draw(b) {
    [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].forEach((x, i) => {
      b.fill(oval(x, 0.6 + (i % 2) * 0.05, 0.07, 0.38), { v: ['#f2f6ff', '#9ab0d0'] }, 0.9);
      b.fill(oval(x, 0.4 + (i % 2) * 0.05, 0.035, 0.08), '#3a4a6a');
    });
  },
};

// ------------------------------------------------------------ Mount Doom
const ashSky = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#1a0a08', mid: '#5a1a10', bottom: '#c84a1a' });
    clouds(b, [[0.15, 0.25, 0.12, 2], [0.45, 0.15, 0.16, 5], [0.8, 0.28, 0.12, 8]], { colour: '#2a1410', ink: false });
    farHills(b, 0.92, '#1a0c0a', { seed: 9, haze: '#5a2a1a' });
  },
};

const BARAD = [[0.25, 1], [0.3, 0.6], [0.24, 0.52], [0.34, 0.4], [0.32, 0.18], [0.4, 0.12], [0.36, 0.0], [0.46, 0.06], [0.5, 0.0], [0.54, 0.06], [0.64, 0.0], [0.6, 0.12], [0.68, 0.18], [0.66, 0.4], [0.76, 0.52], [0.7, 0.6], [0.75, 1]];
const baradDur = {
  aspect: 0.3,
  outline: BARAD,
  draw(b) {
    b.wash(BARAD, { h: ['#2a2424', '#060404'] }, { edge: 0.4 });
    b.hatch(BARAD, { angle: 0.05, gap: 0.0012, colour: '#000000', alpha: 0.5 });
    for (const y of [0.3, 0.5, 0.7, 0.86]) b.fill(oval(0.5, y, 0.025, 0.006), '#ff5a1a', 0.8);
    b.silhouette(BARAD, { width: 0.0005, colour: '#000000' });
  },
};

const DOOM = [[0, 1], [0.12, 0.8], [0.26, 0.55], [0.38, 0.2], [0.44, 0.08], [0.56, 0.08], [0.62, 0.22], [0.74, 0.55], [0.88, 0.8], [1, 1]];
const mountDoom = {
  aspect: 1.3,
  outline: smooth(DOOM),
  draw(b) {
    b.wash(smooth(DOOM), { from: [0.3, 0.2], to: [0.8, 1], stops: [[0, '#4a3430'], [0.6, '#2a1a18'], [1, '#120a08']] }, { edge: 0.5 });
    b.hatch(smooth(DOOM), { angle: -1.1, gap: 0.0016, alpha: 0.45, colour: '#000000', fade: (x) => Math.max(0, x - 0.45) * 2 });
    // the fire at its top and running down its side
    b.glow(0.5, 0.08, 0.02, '#ff7a2a', 0.9);
    b.fill(oval(0.5, 0.09, 0.06, 0.025), '#ffb04a');
    b.curve([[0.48, 0.12], [0.44, 0.3], [0.4, 0.5], [0.34, 0.75]], { width: 0.0014, colour: '#ff6a1a', alpha: 0.95, twice: false });
    b.curve([[0.55, 0.12], [0.6, 0.35], [0.64, 0.6]], { width: 0.001, colour: '#ff8a2a', alpha: 0.9, twice: false });
    // the door of Sammath Naur, glowing
    b.fill(smooth([[0.53, 0.5], [0.54, 0.44], [0.56, 0.42], [0.58, 0.44], [0.59, 0.5]]), '#ff9a3a');
    b.silhouette(smooth(DOOM), { width: 0.0005, colour: '#000000' });
  },
};

const ASH = [[0, 0.5], [0.15, 0.3], [0.3, 0.55], [0.45, 0.35], [0.6, 0.6], [0.75, 0.3], [0.9, 0.5], [1, 0.4]];
const ashPlain = {
  outline: top(ASH),
  draw(b) {
    b.wash(top(ASH), { v: ['#4a3a34', '#1a1210'] }, { edge: 0.4 });
    b.stipple(top(ASH), { n: 120, size: 0.0006, colour: '#8a7a70', alpha: 0.6 });
    b.silhouette(top(ASH), { width: 0.0005 });
  },
};

const ringBrink = {
  aspect: 1.2,
  outline: oval(0.5, 0.5, 0.46, 0.44),
  draw(b) {
    b.fill(ringBrink.outline, { radial: [0.5, 0.5, 0.5], stops: [[0, '#fff2b0'], [1, '#c87a2a']] });
    b.ink(oval(0.5, 0.5, 0.25, 0.2), { width: 0.001, colour: '#f2c040', twice: false });
  },
};

// ------------------------------------------------------------ the Grey Havens
const sunsetSea = {
  outline: ARCH,
  draw(b) {
    sky(b, BOX, { top: '#4a5a8a', mid: '#e8a87a', bottom: '#fbe2a8' });
    b.glow(0.5, 0.78, 0.12, '#fff4d0', 0.9);
    clouds(b, [[0.2, 0.32, 0.09, 2], [0.78, 0.25, 0.1, 6]], { colour: '#f2b88a' });
    water(b, [[0, 0.78], [1, 0.78], [1, 1], [0, 1]], { deep: '#5a6a8a', light: '#f8dca8', y0: 0.78, y1: 1, n: 30 });
    ripples(b, [[0.3, 0.78], [0.7, 0.78], [0.7, 1], [0.3, 1]], { y0: 0.8, y1: 1, n: 30, colour: '#fff8e0' });
  },
};

const PIER_L = [[0, 1], [0, 0.42], [0.05, 0.4], [0.07, 0.12], [0.1, 0.04], [0.13, 0.12], [0.15, 0.4], [0.22, 0.46], [0.3, 0.62], [0.34, 1]];
const PIER_R = [[1, 1], [1, 0.42], [0.95, 0.4], [0.93, 0.12], [0.9, 0.04], [0.87, 0.12], [0.85, 0.4], [0.78, 0.46], [0.7, 0.62], [0.66, 1]];
const haven = {
  outline: many(PIER_L, PIER_R),
  draw(b) {
    for (const [pier, x] of [[PIER_L, 0.1], [PIER_R, 0.9]]) {
      b.wash(pier, { v: ['#efebe2', '#8a8a8a'] }, { edge: 0.4 });
      b.dark(pier, { from: [x - 0.03, 0], to: [x + 0.05, 0], alpha: 0.3 });
      b.hatch(pier, { angle: 0.1, gap: 0.0016, alpha: 0.25 });
      for (let k = 0; k < 4; k++) b.line([[x - 0.03, 0.5 + k * 0.12], [x + 0.08 * (x < 0.5 ? 1 : -1) + 0.03, 0.5 + k * 0.12]], { width: 0.0003, alpha: 0.4, twice: false });
      lit(b, [[x - 0.006, 0.17], [x + 0.006, 0.17], [x + 0.006, 0.22], [x - 0.006, 0.22]], { x, y: 0.195, r: 0.004, bars: false });
      b.silhouette(pier, { width: 0.0005 });
    }
  },
};

const SHIP = [[0.08, 0.72], [0.3, 0.86], [0.75, 0.86], [0.92, 0.66], [0.98, 0.42], [0.94, 0.4], [0.88, 0.62], [0.52, 0.7], [0.52, 0.06], [0.56, 0.06], [0.56, 0.68], [0.2, 0.7]];
const SAIL = [[0.56, 0.1], [0.9, 0.5], [0.56, 0.62]];
const whiteShip = {
  aspect: 1,
  outline: many(SHIP, SAIL, [[0.52, 0.1], [0.18, 0.55], [0.52, 0.62]]),
  draw(b) {
    b.wash([[0.52, 0.1], [0.18, 0.55], [0.52, 0.62]], { h: ['#f6f2ea', '#c8c4bc'] }, { edge: 0.3 });
    b.wash(SAIL, { h: ['#ffffff', '#d8d4cc'] }, { edge: 0.3 });
    b.wash(SHIP, { v: ['#ffffff', '#a8a8b0'] }, { edge: 0.4 });
    // the swan’s neck at its prow
    b.curve([[0.88, 0.62], [0.96, 0.44], [0.92, 0.38], [0.88, 0.42]], { width: 0.0006, twice: false });
    b.fill(circle(0.92, 0.41, 0.008), '#e8c45a');
    b.silhouette(whiteShip.outline, { width: 0.0005 });
  },
};

const gulls = {
  aspect: 3,
  bare: true,
  outline: BOX,
  draw(b) {
    for (const [x, y, s] of [[0.15, 0.4, 0.03], [0.3, 0.3, 0.025], [0.45, 0.5, 0.035], [0.6, 0.35, 0.025], [0.75, 0.55, 0.03], [0.88, 0.3, 0.02]]) bird(b, x, y, s, '#f6f6f2');
    for (const [x, y, s] of [[0.15, 0.4, 0.03], [0.45, 0.5, 0.035], [0.75, 0.55, 0.03]]) bird(b, x, y + 0.03, s * 0.9, '#5a5a62');
  },
};

const POST = [[0.44, 0.98], [0.44, 0.3], [0.56, 0.3], [0.56, 0.98]];
const LANTERN = [[0.26, 0.3], [0.26, 0.12], [0.5, 0.02], [0.74, 0.12], [0.74, 0.3]];
const quayLamp = {
  aspect: 0.32,
  outline: many(POST, LANTERN, [[0.3, 0.98], [0.7, 0.98], [0.62, 0.9], [0.38, 0.9]]),
  draw(b) {
    b.wash(POST, { h: ['#7a7a82', '#2a2a30'] });
    b.wash([[0.3, 0.98], [0.7, 0.98], [0.62, 0.9], [0.38, 0.9]], '#4a4a52');
    b.wash(LANTERN, { v: ['#4a4a52', '#2a2a30'] });
    lit(b, [[0.32, 0.14], [0.68, 0.14], [0.68, 0.28], [0.32, 0.28]], { colour: '#ffe2a0', x: 0.5, y: 0.21, r: 0.004 });
    b.silhouette(quayLamp.outline, { width: 0.0004 });
  },
};

const straightRoad = {
  aspect: 3.5,
  outline: [[0, 1], [0.45, 0], [0.55, 0], [1, 1]],
  draw(b) {
    b.fill(straightRoad.outline, { v: ['#ffffff', '#fff0c8'] }, 0.9);
    b.glow(0.5, 0.1, 0.02, '#ffffff', 1);
  },
};

export const SCENES = {
  marshes: {
    ground: (b, page) =>
      ground(b, page, { far: '#3a4234', near: '#22281e', blotch: '#141810', seed: 31 }, (g) => {
        for (const [x, y, r] of [[0.2, 0.55, 0.12], [0.55, 0.7, 0.14], [0.82, 0.5, 0.1], [0.35, 0.85, 0.09]]) water(g, oval(x, y, r, r * 0.6), { deep: '#0a0e0c', light: '#3a4a44', y0: y - r * 0.6, y1: y + r * 0.6, n: 8 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.2, fold: 'in', lift: 1, art: murk, shadow: false },
      { id: 'reeds', kind: 'flat', at: [0, -0.12], w: 0.46, h: 0.09, fold: 'in', lift: 0.95, art: reeds },
      { id: 'dead-tree', kind: 'card', at: [0.15, -0.07], h: 0.13, turn: -0.3, lift: 0.8, art: { aspect: 0.8, bare: true, outline: oval(0.5, 0.5, 0.5, 0.5), draw: (b) => deadTree(b, 0.5, 0.995, 0.99, { seed: 4, margin: 0.0012 }) }, shadow: false },
      ...[[-0.14, 0.0], [-0.04, -0.04], [0.06, 0.02], [0.12, 0.09], [-0.12, 0.1]].map(([x, z], i) => ({ id: `candle-${i}`, kind: 'card', at: [x, z], y: 0.01, h: 0.02, lift: 0.5, art: marshLight, toy: 'candles', does: [{ act: 'chain', target: [0, 1, 2, 3, 4].map((k) => `candle-glow-${k}`) }], shadow: false })),
      ...[[-0.14, 0.0], [-0.04, -0.04], [0.06, 0.02], [0.12, 0.09], [-0.12, 0.1]].map(([x, z], i) => ({ id: `candle-glow-${i}`, kind: 'glow', at: [x, z], y: 0.02, size: 0.06, colour: '#c8ff8a', on: false, flicker: true })),
      { id: 'smeagol', kind: 'card', at: [-0.06, 0.06], h: 0.045, turn: 0.3, lift: 0.3, art: smeagol(), toy: 'smeagol', does: [{ act: 'hop' }] },
      { id: 'frodo', kind: 'card', at: [0.03, 0.08], h: 0.045, lift: 0.2, art: hobbit({ coat: '#4f6a8a', cloak: '#5a6a52' }) },
      { id: 'sam', kind: 'card', at: [0.08, 0.1], h: 0.047, lift: 0.2, art: hobbit({ coat: '#6a5a32', vest: '#8a3a2a', pack: true, cloak: '#5a6a52' }) },
      { id: 'tussocks', kind: 'card', at: [0.0, 0.12], h: 0.022, lift: 0.1, art: tussocks, toy: 'tussocks', does: [{ act: 'hop' }] },
      { id: 'faces', kind: 'card', at: [-0.05, 0.03], h: 0.02, lift: 0.3, ghost: true, find: true, art: facesBelow },
    ],
  },
  'cirith-ungol': {
    ground: (b, page) =>
      ground(b, page, { far: '#2a2220', near: '#141010', blotch: '#0a0606', seed: 33 }, (g) => {
        g.hatch([[0, 0], [1, 0], [1, 1], [0, 1]], { angle: -1.2, gap: 0.003, colour: '#000000', alpha: 0.45 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.21, fold: 'in', lift: 1, art: mordorSky, shadow: false },
      { id: 'tower', kind: 'card', at: [0.13, -0.11], h: 0.21, lift: 0.95, art: theTower, toy: 'tower', does: [{ act: 'shine', colour: '#ff5a2a' }] },
      { id: 'stair', kind: 'flat', at: [-0.03, -0.08], w: 0.4, h: 0.13, fold: 'in', lift: 0.85, art: stair },
      { id: 'web', kind: 'card', at: [-0.08, -0.03], h: 0.09, turn: 0.2, lift: 0.6, art: web, toy: 'web', does: [{ act: 'tear' }], shadow: false },
      { id: 'phial', kind: 'card', at: [-0.02, 0.05], y: 0.045, h: 0.028, lift: 0.3, art: phial, toy: 'phial', does: [{ act: 'light', target: ['phial-glow'] }] },
      { id: 'phial-glow', kind: 'glow', at: [-0.02, 0.05], y: 0.06, size: 0.26, colour: '#eaf4ff', on: false },
      { id: 'frodo', kind: 'card', at: [-0.03, 0.06], h: 0.047, lift: 0.25, art: hobbit({ coat: '#4f6a8a', cloak: '#5a6a52' }) },
      { id: 'sam', kind: 'card', at: [0.03, 0.08], h: 0.048, lift: 0.2, art: hobbit({ coat: '#6a5a32', vest: '#8a3a2a', pack: true, pans: true }), toy: 'sam', does: [{ act: 'hop' }] },
      { id: 'eyes', kind: 'card', at: [-0.08, -0.025], y: 0.05, h: 0.03, lift: 0.6, ghost: true, find: true, art: eightEyes },
    ],
  },
  beacons: {
    ground: (b, page) =>
      ground(b, page, { far: '#7a8a5a', near: '#4a5a34', blotch: '#3a4a28', seed: 35 }, (g) => {
        g.grass([[0.05, 0.98], [0.95, 0.98]], { n: 120, tall: 0.004 });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.21, fold: 'in', lift: 1, art: duskWest, shadow: false },
      { id: 'mountains', kind: 'flat', at: [0, -0.13], w: 0.46, h: 0.17, fold: 'in', lift: 0.95, art: whiteMountains, toy: 'beacon', does: [{ act: 'chain', target: BEACONS.map((_, i) => `beacon-${i}`) }] },
      ...BEACONS.map(([x, y], i) => ({ id: `beacon-${i}`, kind: 'glow', at: [-0.23 + x * 0.46, -0.128], y: (1 - y) * 0.17 + 0.008, size: 0.05, colour: '#ffa040', on: false, flicker: true })),
      { id: 'city', kind: 'card', at: [0.06, -0.04], h: 0.15, lift: 0.65, art: whiteCity, toy: 'city', does: [{ act: 'shine', colour: '#ffffff' }] },
      { id: 'gandalf', kind: 'card', at: [-0.13, 0.05], h: 0.11, turn: 0.3, lift: 0.25, art: wizard({ robe: '#f2f0ea', hat: '#e8e6e0' }) },
      { id: 'pippin', kind: 'card', at: [-0.07, 0.07], h: 0.045, turn: 0.3, lift: 0.2, art: hobbit({ livery: true }), toy: 'pippin', does: [{ act: 'hop' }] },
      { id: 'dead', kind: 'card', at: [-0.12, 0.0], h: 0.08, lift: 0.4, ghost: true, find: true, art: army },
    ],
  },
  doom: {
    ground: (b, page) =>
      ground(b, page, { far: '#3a2a24', near: '#1a1210', blotch: '#0e0a08', seed: 37 }, (g) => {
        g.stipple(null, { n: 200, size: 0.0007, colour: '#6a5a50', alpha: 0.6 });
        g.curve([[0.3, 0.2], [0.35, 0.4], [0.32, 0.6]], { width: 0.002, colour: '#ff5a1a', alpha: 0.7, twice: false });
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.21, fold: 'in', lift: 1, art: ashSky, shadow: false },
      { id: 'barad-dur', kind: 'card', at: [0.17, -0.145], h: 0.21, lift: 1, art: baradDur },
      { id: 'eye', kind: 'card', at: [0.17, -0.143], y: 0.205, h: 0.032, lift: 1, art: eye(), toy: 'eye', does: [{ act: 'stare' }], shadow: false },
      { id: 'mountain', kind: 'card', at: [-0.05, -0.1], h: 0.19, lift: 0.85, art: mountDoom, toy: 'cracks', does: [{ act: 'light', target: ['lava'] }] },
      { id: 'lava', kind: 'glow', at: [-0.05, -0.095], y: 0.18, size: 0.055, colour: '#ff6a1a', on: true, flicker: true },
      { id: 'plain', kind: 'flat', at: [0, -0.02], w: 0.46, h: 0.04, fold: 'in', lift: 0.5, art: ashPlain },
      { id: 'frodo', kind: 'card', at: [0.0, 0.06], h: 0.047, lift: 0.2, art: hobbit({ coat: '#5a5a4a', cloak: '#4a4a3a' }), toy: 'frodo', does: [{ act: 'hop' }] },
      { id: 'sam', kind: 'card', at: [0.045, 0.075], h: 0.048, lift: 0.2, art: hobbit({ coat: '#6a5a32', vest: '#8a3a2a', cloak: '#4a4a3a' }) },
      { id: 'brink', kind: 'card', at: [-0.04, -0.07], y: 0.12, h: 0.022, lift: 0.8, ghost: true, find: true, art: ringBrink },
    ],
  },
  havens: {
    ground: (b, page) =>
      ground(b, page, { far: '#8a9ab0', near: '#9a948a', blotch: '#7a746a', seed: 39 }, (g) => {
        water(g, [[0, 0], [1, 0], [1, 0.5], [0, 0.55]], { deep: '#4a5a7a', light: '#e8d4a8', y0: 0, y1: 0.55, n: 60 });
        g.fill([[0, 0.55], [1, 0.5], [1, 0.6], [0, 0.65]], '#b8b0a4');
      }),
    pieces: [
      { id: 'sky', kind: 'flat', at: [0, -0.155], w: 0.47, h: 0.22, fold: 'in', lift: 1, art: sunsetSea, shadow: false },
      { id: 'west', kind: 'glow', at: [0, -0.15], y: 0.06, size: 0.4, colour: '#fff2d0', on: true },
      { id: 'haven', kind: 'flat', at: [0, -0.12], w: 0.46, h: 0.13, fold: 'in', lift: 0.95, art: haven },
      { id: 'ship', kind: 'card', at: [0.02, -0.07], h: 0.11, lift: 0.8, art: whiteShip, toy: 'ship', does: [{ act: 'sail' }], shadow: false },
      { id: 'gulls', kind: 'card', at: [-0.07, -0.08], y: 0.12, h: 0.04, lift: 0.9, art: gulls, toy: 'gulls', does: [{ act: 'fly' }], shadow: false },
      { id: 'gandalf', kind: 'card', at: [0.08, 0.0], h: 0.11, turn: -0.2, lift: 0.4, art: wizard({ robe: '#f2f0ea', hat: '#e8e6e0' }) },
      { id: 'frodo', kind: 'card', at: [0.03, 0.02], h: 0.045, lift: 0.35, art: hobbit({ coat: '#4f6a8a', cloak: '#6a7a8a' }) },
      { id: 'elves', kind: 'card', at: [-0.03, -0.01], h: 0.1, lift: 0.4, art: elf({ gown: '#e8e4f0', hair: '#2a2a2a', cloakColour: '#8a9ab0' }) },
      { id: 'quay-lamp', kind: 'card', at: [0.14, 0.05], h: 0.07, lift: 0.3, art: quayLamp, toy: 'lamp', does: [{ act: 'light', target: ['lamp-glow'] }] },
      { id: 'lamp-glow', kind: 'glow', at: [0.14, 0.05], y: 0.065, size: 0.08, colour: '#ffd27a', on: false },
      { id: 'sam', kind: 'card', at: [-0.1, 0.08], h: 0.048, turn: 0.3, lift: 0.2, art: hobbit({ coat: '#6a5a32', vest: '#8a3a2a' }) },
      { id: 'road', kind: 'card', at: [0, -0.15], y: 0.09, h: 0.07, lift: 1, ghost: true, find: true, art: straightRoad, shadow: false },
    ],
  },
};

// the back pages: their heading and a frame for what the page tells
export const BACK_SCENES = {
  met: { ground: (b, page) => backGround(b, page, 'Those you met along the way, in the order you met them.') },
  kept: { ground: (b, page) => backGround(b, page, 'What you found, and what you were given.') },
};

function backGround(b, page, line) {
  paper(b);
  border(b, { title: page.title, date: 'The back pages' });
  b.text(page.title, 0.25, 0.2, { size: 0.06, align: 'center' });
  b.text(line, 0.25, 0.28, { size: 0.03, font: 'Georgia, serif', italic: true, weight: 500, colour: '#4a3520', align: 'center', max: 0.4 });
  for (let i = 0; i < 6; i++) {
    const x = 0.56 + (i % 3) * 0.14;
    const y = 0.12 + Math.floor(i / 3) * 0.42;
    b.ink([[x, y], [x + 0.11, y], [x + 0.11, y + 0.34], [x, y + 0.34]], { width: 0.0006, colour: '#8a2a18', alpha: 0.6, twice: false });
  }
  gutter(b);
}

