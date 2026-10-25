// The cable studio: where interdimensional cable is made, every channel's
// set on one sound stage. Flats along the north wall painted as the shows
// (the electronics shop, Baby Legs' precinct, Mr. Sneezy's living room,
// Gazorpazorpfield's kitchen), the Real Fake Doors on their stand under
// their banner, the Lil' Bits counter and the shmlo show's couch with a card
// each, cameras on tripods, lights on trusses, and the control booth by the
// way in. The people on the channels are models placed from
// ./destinations.js. Its game is a running order (./destinations.js's
// `sequence`, played by ./stage.js): a red on-air lamp over each set, lit as
// its set goes on, and each set titled as the meter names it.

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { mergeParts } from '../kit';
import { specks, stage } from './stage';

// a set's on-air lamp: [set, dx, dz, y, on a stand of its own]: over the
// flats along the north wall, on the doors' middle frame, and on a stand by
// the counter and by the couch
const LAMPS = [
  ['set-ants', -18, -14.8, 3.62],
  ['set-legs', -4.5, -14.8, 3.62],
  ['set-sneezy', 8, -14.8, 3.62],
  ['set-field', 18, -14.8, 3.62],
  ['set-doors', 0, -4.5, 2.56],
  ['set-bits', 8, 12.2, 2.6, true],
  ['set-shmlo', -17.9, 8, 2.6, true],
];

// each set's title, on its flat, banner or card: the name the meter calls it
// by (its spot's label, ./rows3.js, has it in)
export const TITLES = {
  'set-ants': 'ANTS IN MY EYES JOHNSON’S',
  'set-legs': 'BABY LEGS',
  'set-sneezy': 'MR. SNEEZY',
  'set-field': 'GAZORPAZORPFIELD',
  'set-doors': 'REAL FAKE DOORS',
  'set-bits': 'LIL’ BITS',
  'set-shmlo': 'THE SHMLO SHOW',
};

const LIGHT = { sun: [0xfff4e0, 0.95], hemi: [0xf0e8ff, 0x3a3a44, 1.8], fog: null, background: 0x0c0c12 };

const FLAT = (title, a, b) => (g, w, h) => {
  g.fillStyle = a;
  g.fillRect(0, 0, w, h);
  g.fillStyle = b;
  g.fillRect(0, h * 0.7, w, h * 0.3);
  for (let k = 0; k < 4; k++) g.fillRect(w * (0.1 + k * 0.22), h * 0.25, w * 0.14, h * 0.3);
  fitText(g, title, w / 2, h * 0.12, w - 16, 14, { color: '#ffffff' });
};
// a set's card: its title on a band of its colour
const CARD = (title, a, b) => (g, w, h) => {
  g.fillStyle = a;
  g.fillRect(0, 0, w, h);
  fitText(g, title, w / 2, h / 2, w - 16, Math.round(h * 0.6), { color: b });
};

export async function buildCable(kit) {
  const S = stage(kit, 'cablestudio', { floor: specks('#2a2a30', ['#242428', '#303036'], 7, 700, 2), floorTile: 3, wall: 0x1a1a20, ceiling: 0x111116, skirt: 0x44444c });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // the sets' flats, along the north wall
  const flats = [
    ['cable-ants', TITLES['set-ants'], '#5a7ab8', '#c8c8d0', -18, 8],
    ['cable-legs', TITLES['set-legs'], '#8a6a3a', '#4a3a2a', -4.5, 9],
    ['cable-sneezy', TITLES['set-sneezy'], '#8ab86a', '#d8c8a0', 8, 7],
    ['cable-field', TITLES['set-field'], '#f0b060', '#8a4a1a', 18, 8],
  ];
  for (const [cell, title, a, b, dx, w] of flats) {
    R.cell(cell, 192, 96, FLAT(title, a, b));
    const f = R.frame(...P(dx, -(A.z1 - A.z0) / 2 + 3), 0, { list: 'fixed' });
    f.box(0x3a3a44, 0, 0, 0, w, 3.4, 0.2).decal(cell, 0, 1.75, 0.12, w - 0.2, 3.2, { bright: true });
    f.box(0x5a5a66, 0, 0, 1.4, w, 0.06, 3);
  }
  // Real Fake Doors: three door frames in a row on a low stand, no walls
  const [dx0, dz0] = P(0, -4.5);
  R.frame(dx0, dz0, 0).box(0x8a6a4a, 0, 0, 0, 7, 0.2, 1);
  for (const u of [-2.2, 0, 2.2]) R.frame(dx0 + u, dz0, 0).box([0xd8d8e0, 0xc83a3a, 0x3a6ac8][(u + 2.2) / 2.2], 0, 0.2, 0, 1, 2.1, 0.08).box(0xf6f6f6, 0, 0.2, 0, 1.2, 0.08, 0.14).box(0xf6f6f6, 0, 2.3, 0, 1.2, 0.08, 0.14).ball(0xd8b25a, 0.35, 1.2, 0.06, 0.05);
  // (and their banner, on a pole at each end of the stand, over the lamp)
  R.cell('cable-doors', 256, 24, CARD(TITLES['set-doors'], '#c83a3a', '#ffffff'));
  R.frame(dx0, dz0, 0).cyl(0x2a2a30, -3.3, 0, 0, 0.04, 3.4).cyl(0x2a2a30, 3.3, 0, 0, 0.04, 3.4).box(0x3a3a44, 0, 2.85, 0, 6.4, 0.5, 0.06).decal('cable-doors', 0, 3.1, 0.04, 6.3, 0.44, { bright: true });
  // the Lil' Bits counter, and the shmlo show's couch, each with its card
  // on the side that faces its spot (the counter's front, the couch's back)
  R.cell('cable-bits', 192, 40, CARD(TITLES['set-bits'], '#ff6a8a', '#ffffff'));
  R.cell('cable-shmlo', 192, 32, CARD(TITLES['set-shmlo'], '#f6e6b0', '#4a2a5a'));
  R.frame(...P(8, 11), Math.PI).box(0xf6f2e8, 0, 0, 0, 4, 1, 1.6).box(0xff6a8a, 0, 1, 0, 4.1, 0.06, 1.7).decal('cable-bits', 0, 0.5, 0.82, 3.6, 0.75, { bright: true });
  for (let k = 0; k < 6; k++) R.frame(...P(6.8 + k * 0.5, 11), 0, { list: 'fixed' }).cyl(0xffffff, 0, 1.06, 0, 0.1, 0.01).ball([0xd8a24a, 0xc83a3a, 0x8ab86a][k % 3], 0, 1.08, 0, 0.04);
  R.frame(...P(-16, 8), 0).box(0x6a3a8a, 0, 0, 0, 3, 0.5, 1.2).box(0x6a3a8a, 0, 0.5, -0.5, 3, 0.6, 0.2).decal('cable-shmlo', 0, 0.8, -0.62, 2.8, 0.48, { ry: Math.PI, bright: true });
  // cameras on tripods, and the lights on trusses over the sets
  for (const [dx, dz, turn] of [
    [-10, -4, 0.6],
    [10, -4, -0.6],
  ]) R.frame(...P(dx, dz), turn).cyl(0x2a2a30, 0, 0, 0, 0.06, 1.5).box(0x1a1a20, 0, 1.5, 0, 0.6, 0.5, 0.9).cyl(0x3a3a44, 0, 1.6, -0.6, 0.18, 0.4, Math.PI / 2);
  for (let dx = -20; dx <= 20; dx += 10) R.frame(...P(dx, -8), 0, { list: 'fixed' }).box(0x3a3a44, 0, H - 1.2, 0, 8, 0.2, 0.2).glow(BALL, 0xfff0c8, 1.7, -2, H - 1.5, 0, 0, 0.3).glow(BALL, 0xfff0c8, 1.7, 2, H - 1.5, 0, 0, 0.3);
  // the control booth by the way in: a desk, a wall of screens
  const [bx, bz] = P(-14, 15);
  R.frame(bx, bz, Math.PI).box(0x2a2a30, 0, 0, 0, 8, 1.1, 1.6).box(0x44444c, 0, 1.1, 0, 8.1, 0.06, 1.7);
  R.cell('cable-screens', 256, 96, (g, w, h) => {
    g.fillStyle = '#060608';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 24; k++) {
      g.fillStyle = `hsl(${(k * 47) % 360} 60% ${30 + (k % 3) * 15}%)`;
      g.fillRect(6 + (k % 8) * 31, 6 + Math.floor(k / 8) * 30, 27, 24);
    }
  });
  R.frame(...P(0, (A.z1 - A.z0) / 2 - 0.14), Math.PI, { list: 'fixed' }).box(0x060608, 0, 1.4, 0, 8, 3, 0.1).decal('cable-screens', 0, 2.9, 0.07, 7.8, 2.8, { bright: true });

  // the on-air lamps, each its own mesh for the running order to light
  const lamps = {};
  for (const [set, dx, dz, y, stand] of LAMPS) {
    if (stand) R.frame(...P(dx, dz), 0).cyl(0x2a2a30, 0, 0, 0, 0.05, y - 0.17);
    const lit = [];
    R.frame(...P(dx, dz), 0, { glows: lit }).glow(BOX, 0xff3a3a, 1.6, 0, y, 0, 0, 1.1, 0.34, 0.12);
    const lamp = new THREE.Mesh(R.own(mergeParts(lit)), R.own(new THREE.MeshBasicMaterial({ vertexColors: true })));
    lamp.material.color.setScalar(0.15);
    R.add(lamp, { ink: false });
    lamps[set] = lamp;
  }
  S.sequence({ lamps });

  S.people();
  return S.done(LIGHT, () => {});
}
