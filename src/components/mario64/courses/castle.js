// Peach's castle, the hub, in two areas. The grounds: a lawn between low
// hills, the moat round the castle's courtyard with the drawbridge across
// it, and the castle itself (the keep, four corner towers and the tall
// middle one, red roofs), its front door leading inside. The inside: the
// marble foyer with the red carpet, the stairs up to the balcony, and the
// five painting rooms, four of them behind star doors (1, 3, 5 and the big
// one, 8). Toad stands in the foyer with hints.

import { TAU, bump, outside, rim, room, settle, smooth, wobble } from './parts';

const PI = Math.PI;

// ─── The grounds ───────────────────────────────────────────────────────────
const COURT = [-2700, -5000, 2700, -700]; // the courtyard the castle stands in
const MOAT_W = 800;
const MOAT_Y = -80; // the water's surface
const PLAY = [-5600, -6600, 5600, 5600];

function moat(x, z) {
  const d = outside(x, z, ...COURT);
  if (d === 0 || d >= MOAT_W) return 0;
  return -420 * Math.min(smooth(d / 140), smooth((MOAT_W - d) / 140));
}

function groundsHeight(x, z) {
  let h = wobble(x, z, 0.8) * 30;
  if (outside(x, z, ...COURT) === 0) h = 0;
  h += moat(x, z);
  h += bump(x, z, -4700, 2700, 1600, 900) + bump(x, z, 4800, -1700, 1300, 650) + bump(x, z, 3900, 3800, 1200, 380) + bump(x, z, -3900, -4600, 1100, 500);
  return h + rim(x, z, PLAY, 1700, 520);
}

function groundsSplat(x, z, ny, y) {
  if (ny < 0.8) return [0, 1, 0];
  // the path from the lawn to the bridge, and the courtyard's walk
  const path = Math.abs(x) < 260 + 30 * Math.sin(z * 0.002) && z > -1600 && z < 4800;
  if (path && y > -40) return [0, 0, 1];
  if (y < -150) return [0.2, 0.8, 0];
  return [1, 0, 0];
}

function buildGrounds(k) {
  k.terrain({ id: 'lawn', x0: -6600, z0: -7600, w: 13200, d: 14200, res: 110, height: groundsHeight, splat: groundsSplat, mats: ['grass', 'rock', 'cobble'] });

  // the drawbridge, with a rail each side
  k.box({ x: 0, y: -70, z: -300, w: 700, h: 70, d: 1100, mat: 'wood' });
  for (const sx of [-1, 1]) k.box({ x: sx * 335, y: 0, z: -300, w: 30, h: 110, d: 1100, mat: 'wood' });

  // the castle: the keep, its front at z -1600
  k.box({ x: 0, y: 0, z: -2800, w: 3400, h: 1500, d: 2400, mat: 'castle', top: 'roof' });
  // the front steps (the door is the door actor's; the round window over it a prop)
  k.box({ x: 0, y: 0, z: -1450, w: 1000, h: 40, d: 300, mat: 'castle' });
  k.box({ x: 0, y: 1360, z: -1590, w: 700, h: 40, d: 30, mat: 'trim', collide: false });
  // battlements along the top of the front and sides
  for (let x = -1600; x <= 1600; x += 260) k.box({ x, y: 1500, z: -1640, w: 140, h: 150, d: 120, mat: 'castle' });
  // the corner towers and their roofs
  for (const [x, z] of [
    [-1700, -1600],
    [1700, -1600],
    [-1700, -4000],
    [1700, -4000],
  ]) {
    k.cyl({ x, y: 0, z, r: 400, h: 1950, seg: 24, mat: 'castle', top: 'roof' });
    k.cone({ x, y: 1950, z, r: 500, h: 820, seg: 24, mat: 'roof' });
  }
  // the tall tower in the middle
  k.cyl({ x: 0, y: 1500, z: -3000, r: 720, h: 1150, seg: 28, mat: 'castle', top: 'roof' });
  k.cone({ x: 0, y: 2650, z: -3000, r: 860, h: 1250, seg: 28, mat: 'roof' });
  for (const sx of [-1, 1]) {
    // the two turrets at the front corners of the middle tower
    k.cyl({ x: sx * 700, y: 1500, z: -2350, r: 220, h: 700, seg: 16, mat: 'castle' });
    k.cone({ x: sx * 700, y: 2200, z: -2350, r: 280, h: 520, seg: 16, mat: 'roof' });
  }
}

const TREES = [
  [-2400, 3600],
  [-3300, 2100],
  [-4100, 600],
  [-2900, 4800],
  [2500, 3300],
  [3400, 1800],
  [4300, 700],
  [2800, 5000],
  [-4500, -2500],
  [4300, -3600],
  [-1400, 5100],
  [1500, 5200],
];

const grounds = {
  id: 'grounds',
  course: null,
  name: 'Peach’s Castle',
  sky: 'noon',
  fog: { color: '#cfe3ff', near: 6000, far: 26000 },
  music: 'castle',
  deathY: -3000,
  entries: {
    start: { x: 0, y: 0, z: 4600, yaw: PI },
    door: { x: 0, y: 0, z: -1150, yaw: 0 },
  },
  build: buildGrounds,
  water: [
    { x0: -3500, z0: -800, x1: 3500, z1: 100, y: MOAT_Y },
    { x0: -3500, z0: -5800, x1: 3500, z1: -5000, y: MOAT_Y },
    { x0: -3500, z0: -5800, x1: -2700, z1: 100, y: MOAT_Y },
    { x0: 2700, z0: -5800, x1: 3500, z1: 100, y: MOAT_Y },
  ],
  props: [
    ...TREES.map(([x, z], i) => ({ kind: 'tree', x, z, yaw: i * 1.7, s: 1 + (i % 3) * 0.15, solid: { r: 90, h: 900 } })),
    { kind: 'waterfall', x: -4300, z: 1900, yaw: 0.9, s: 1 },
    { kind: 'window', x: 0, y: 1080, z: -1588, yaw: 0, s: 1.05 },
    { kind: 'flag', x: 0, y: 3900, z: -3000, s: 1 },
  ],
  actors: settle(groundsHeight, [
    { type: 'sign', x: 520, z: 650, yaw: PI, text: 'Welcome to Peach’s castle! The princess has gone quiet, and Bowser’s been seen about. Go in: the worlds are in the paintings.' },
    { type: 'door', x: 0, y: 40, z: -1590, yaw: 0, to: { area: 'castle', entry: 'main' } },
    ...ring(0, 3200, 450, 8),
    ...row([-260, null, 1400], [260, null, 1400], 3),
    { type: 'oneup', x: 3000, z: -6000 },
  ]),
};

// coins in a ring (y left out: settled onto the ground), and in a row
export function ring(x, z, r, n, y) {
  return Array.from({ length: n }, (_, i) => ({ type: 'coin', x: x + Math.sin((i / n) * TAU) * r, y, z: z + Math.cos((i / n) * TAU) * r }));
}
export function row(a, b, n, kind) {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return { type: 'coin', kind, x: a[0] + (b[0] - a[0]) * t, y: a[1] == null ? undefined : a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t };
  });
}

// ─── Inside ────────────────────────────────────────────────────────────────
// The foyer is [-1800, 1800]²; its walls stand outside that, 100 thick, so
// the rooms beyond start 100 further out.
const F = 1800;
const T = 100;
const STEP = 60; // the stairs' risers: under a step up, so walked
const BALCONY = 600;

function buildInside(k) {
  room(k, {
    x0: -F,
    x1: F,
    z0: -F,
    z1: F,
    h: 1600,
    floor: 'marble',
    ceil: 'plaster',
    walls: 'plaster',
    gaps: {
      w: [{ from: -250, to: 250, y0: 0, y1: 520 }],
      e: [{ from: -250, to: 250, y0: 0, y1: 520 }],
      n: [
        { from: -1450, to: -950, y0: 0, y1: 520 },
        { from: -300, to: 300, y0: BALCONY, y1: BALCONY + 620 },
        { from: 950, to: 1450, y0: BALCONY, y1: BALCONY + 520 },
      ],
    },
  });
  // the red carpet from the door to the stairs
  k.box({ x: 0, y: 0, z: 900, w: 640, h: 8, d: 1800, mat: 'carpet' });
  // the stairs up to the balcony, carpeted
  for (let i = 1; i <= BALCONY / STEP; i++) {
    k.box({ x: 0, y: 0, z: -(i - 0.5) * 120, w: 1000, h: i * STEP, d: 120, mat: 'marble', top: 'carpet' });
  }
  // the balcony along the north wall, and its rail either side of the stairs
  k.box({ x: 0, y: BALCONY - 60, z: -1500, w: 2 * F, h: 60, d: 600, mat: 'marble', top: 'carpet' });
  for (const [x0, x1] of [
    [-F, -500],
    [500, F],
  ])
    k.box({ x: (x0 + x1) / 2, y: BALCONY, z: -1215, w: x1 - x0, h: 110, d: 30, mat: 'trim' });
  // pillars at the foot of the stairs
  for (const sx of [-1, 1]) k.cyl({ x: sx * 620, y: 0, z: 60, r: 70, h: 1600, seg: 14, mat: 'marble' });

  // the painting rooms
  room(k, { x0: -3600, x1: -F - T, z0: -900, z1: 900, h: 1000, floor: 'wood-floor', ceil: 'plaster', walls: 'plaster', skip: ['e'] });
  room(k, { x0: F + T, x1: 3600, z0: -900, z1: 900, h: 1000, floor: 'wood-floor', ceil: 'plaster', walls: 'plaster', skip: ['w'] });
  room(k, { x0: -1800, x1: -600, z0: -3400, z1: -F - T, h: 1000, floor: 'wood-floor', ceil: 'plaster', walls: 'plaster', skip: ['s'] });
  room(k, { x0: 600, x1: 1800, z0: -3400, z1: -F - T, y: BALCONY, h: 900, floor: 'wood-floor', ceil: 'plaster', walls: 'plaster', skip: ['s'] });
  room(k, { x0: -450, x1: 450, z0: -3600, z1: -F - T, y: BALCONY, h: 1000, floor: 'carpet', ceil: 'plaster', walls: 'plaster', skip: ['s'] });
}

// the paintings, each on its room's far wall, 5 in front of it
const PAINTINGS = [
  { course: 'bobomb', x: -3595, y: 150, z: 0, yaw: PI / 2, w: 700, h: 700 },
  { course: 'snow', x: 3595, y: 150, z: 0, yaw: -PI / 2, w: 700, h: 700 },
  { course: 'beach', x: -1200, y: 140, z: -3395, yaw: 0, w: 700, h: 640 },
  { course: 'haunt', x: 1200, y: BALCONY + 140, z: -3395, yaw: 0, w: 700, h: 620 },
  { course: 'bowser', x: 0, y: BALCONY + 160, z: -3595, yaw: 0, w: 780, h: 760 },
];

const inside = {
  id: 'castle',
  course: null,
  name: 'Peach’s Castle',
  sky: 'inside',
  fog: { color: '#2a1d16', near: 5000, far: 14000 },
  music: 'castle',
  deathY: -2000,
  entries: {
    main: { x: 0, y: 8, z: 1300, yaw: PI },
    bobomb: { x: -3000, y: 0, z: 0, yaw: PI / 2 },
    snow: { x: 3000, y: 0, z: 0, yaw: -PI / 2 },
    beach: { x: -1200, y: 0, z: -2900, yaw: 0 },
    haunt: { x: 1200, y: BALCONY, z: -2900, yaw: 0 },
    bowser: { x: 0, y: BALCONY, z: -3100, yaw: 0 },
  },
  build: buildInside,
  water: [],
  props: [
    { kind: 'chandelier', x: 0, y: 1600, z: 300, s: 1 },
    { kind: 'chandelier', x: 0, y: 1600, z: -900, s: 0.8 },
    { kind: 'window', x: 0, y: 900, z: F - 2, yaw: PI, s: 1 },
  ],
  actors: [
    { type: 'door', x: 0, y: 8, z: F - 5, yaw: PI, to: { area: 'grounds', entry: 'door' } },
    { type: 'toad', x: 720, y: 0, z: 760, yaw: PI, lines: ['Mario! Thank goodness. Bowser has taken the castle’s Power Stars and hidden them in the paintings.', 'Jump into a painting to go into its world. There are three stars in each one.', 'The doors with a star on them only open once you have enough stars. The big one upstairs wants eight!', 'The first painting is through the door on the left. Good luck!'] },
    { type: 'stardoor', x: F + 50, y: 0, z: 0, yaw: -PI / 2, need: 1, w: 500, dh: 520 },
    { type: 'stardoor', x: -1200, y: 0, z: -F - 50, yaw: 0, need: 3, w: 500, dh: 520 },
    { type: 'stardoor', x: 1200, y: BALCONY, z: -F - 50, yaw: 0, need: 5, w: 500, dh: 520 },
    { type: 'stardoor', x: 0, y: BALCONY, z: -F - 50, yaw: 0, need: 8, w: 600, dh: 620, big: true },
    ...PAINTINGS.map((p) => ({ type: 'painting', ...p })),
    ...ring(-2700, 0, 300, 6, 0),
    { type: 'sign', x: -900, y: 0, z: 500, yaw: PI / 2, title: 'A note', text: 'Dear Mario: please come to the castle. I’ve baked a cake for you. Yours truly, Princess Toadstool. (The rest of the note has been scribbled over with a big, angry B.)' },
  ],
};

export const CASTLE = { grounds, castle: inside };
