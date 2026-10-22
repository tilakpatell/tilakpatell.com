// The Charms classroom (the design’s §4.4): a high, light room, the desks in
// tiers rising from the front so everyone can see the little professor, three
// tall windows down one side onto the grounds, a feather on every desk for
// the levitation lesson, the board with the charm in chalk, and at the front
// Professor Flitwick standing on a pile of books on his chair to see over his
// desk: the thing a reader looks for. The front desk’s place is the lesson’s
// (Lane E’s play/lessons/charms.js brings its own feather): `lessons.charms`.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { LINES, NAMES } from '../rules/lines';
import { bench, table } from './parts/furniture';
import { commonRoom, flat, lessonDoor, paintChalk } from './common/shared';
import { createWindows } from './parts/glass';
import { LEATHERS } from './parts/shelves';
import { figure } from '../cast/figures';
import { instanced } from './kit';

const W = 8;
const L = 9;
const H = 7.5;
// the tiers, from the front up: [z0, z1, floor]
export const TIERS = [
  [-L, 0, 0],
  [0, 2.2, 0.36],
  [2.2, 4.4, 0.72],
  [4.4, 6.6, 1.08],
  [6.6, L, 1.44],
];
const floorAt = (x, z) => {
  for (const [z0, z1, y] of TIERS) if (z >= z0 && z < z1) return y;
  return z < 0 ? 0 : TIERS.at(-1)[2];
};
const DESK_Z = (t) => (TIERS[t][0] + TIERS[t][1]) / 2 - 0.3;
const SIDES = [-4.2, 4.2]; // x of the desks either side of the steps up the middle

// a feather: a vane round a quill, lying flat (one shape, instanced)
function featherGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(0.03, 0.06, 0.022, 0.15);
  s.quadraticCurveTo(0.012, 0.21, 0, 0.23);
  s.quadraticCurveTo(-0.016, 0.18, -0.02, 0.1);
  s.quadraticCurveTo(-0.018, 0.04, 0, 0);
  const g = new THREE.ShapeGeometry(s, 4);
  g.rotateX(-Math.PI / 2);
  return g;
}

export default commonRoom({
  id: 'charms',
  name: 'The Charms classroom',
  bounds: { x0: -W + 0.5, x1: W - 0.5, z0: -L + 0.5, z1: L - 0.5 },
  floorAt,
  colliders: [
    ...[1, 2, 3].flatMap((t) => SIDES.map((x) => ({ kind: 'box', at: [x, DESK_Z(t) + 0.3], w: 5.4, d: 1.5, turn: 0 }))),
    ...SIDES.map((x) => ({ kind: 'box', at: [x, -1.0], w: 5.4, d: 1.5, turn: 0 })),
    { kind: 'box', at: [0, -6.4], w: 3.2, d: 1.2, turn: 0 },
  ],
  spawn: { at: [0, 1.44, L - 1.2], yaw: 0 },
  places: [{ id: 'charms', name: 'The Charms classroom', at: [0, 0], r: 9 }],
  light: { hemi: [0xfff0d8, 0x40362a, 1.15], points: [[0, 4, -5, 0xfff0d8, 7], [-4, 4, 2, 0xffe8c8, 5], [4, 4, 2, 0xffe8c8, 5]] },
  poses: {
    class: { at: [0, 3.2, L - 1.5], look: [0, 1.2, -L + 1] },
    flitwick: { at: [1.4, 1.5, -3], look: [0, 1.8, -6.6] },
    desks: { at: [6.6, 2.6, 6], look: [-2, 0.9, 0] },
  },
  make(kit, { renderer, group, rt, tell, toast, lesson }) {
    // the room: dressed stone, a coffered ceiling of oak, the tiers boarded
    kit.box('ashlar', -W - 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('ashlar', 0, 0, -L - 0.5, W * 2, H, 1);
    kit.box('ashlar', 0, 0, L + 0.5, W * 2, H, 1);
    kit.box('oak', 0, H, 0, W * 2 + 2, 0.4, L * 2 + 2);
    for (let x = -W + 2; x < W; x += 4) kit.box('darkoak', x, H - 0.4, 0, 0.3, 0.4, L * 2);
    for (let z = -L + 3; z < L; z += 4.5) kit.box('darkoak', 0, H - 0.4, z, W * 2, 0.4, 0.3);
    for (const [z0, z1, y] of TIERS) kit.box(y ? 'board' : 'flags', 0, y - 0.3, (z0 + z1) / 2, W * 2, 0.3, z1 - z0);
    // the window wall: three tall lights in deep reveals
    const wins = [-4.6, 0, 4.6];
    kit.box('ashlar', W + 0.5, 0, 0, 1, 1.4, L * 2 + 2);
    kit.box('ashlar', W + 0.5, 6.4, 0, 1, H - 6.4, L * 2 + 2);
    let z0 = -L - 1;
    for (const z of [...wins, L + 3]) {
      const a = z - 1.3;
      if (a > z0) kit.box('ashlar', W + 0.5, 1.4, (z0 + a) / 2, 1, 5.0, a - z0);
      z0 = z + 1.3;
    }
    const windows = createWindows(wins.map((z) => ({ at: [W + 0.02, 1.4, z], w: 2.4, h: 5.0, ry: -Math.PI / 2 })), { renderer });
    windows.set({ day: 0.75, dusk: 0.1 });
    group.add(windows.group);
    // the desks, tier on tier, a bench behind each; a feather and a book at every place
    const feathers = [];
    const books = [];
    const desks = [[0, -1.0], ...[1, 2, 3].map((t) => [t, DESK_Z(t)])];
    for (const [t, z] of desks) {
      const y = t ? TIERS[t][2] : 0;
      for (const x of SIDES) {
        table(kit, { at: [x, y, z], ry: Math.PI / 2, len: 5.2, w: 0.7, top: 0.74, mat: 'oak' });
        bench(kit, { at: [x, y, z + 0.6], ry: Math.PI / 2, len: 5.2, mat: 'oak' });
        for (let i = 0; i < 4; i++) {
          const px = x - 1.95 + i * 1.3;
          // (the lesson’s own place, the front left desk’s first, is left bare for its feather)
          if (t === 0 && x < 0 && i === 3) continue;
          feathers.push({ at: [px, y + 0.745, z + 0.05], ry: 0.4 + ((i * 7 + t * 3) % 5) * 0.3 });
          books.push({ at: [px + 0.3, y + 0.74, z - 0.12], ry: ((i + t) % 3) * 0.2 - 0.2, s: [0.18, 0.04, 0.24], colour: LEATHERS[(i * 3 + t) % LEATHERS.length] });
        }
      }
      // the steps up the middle
      if (t) kit.box('board', 0, y - 0.3, TIERS[t][0] + 0.15, 1.6, 0.3, 0.3);
    }
    const featherGeo = featherGeometry();
    const featherMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#f4efe4'), roughness: 0.85, side: THREE.DoubleSide });
    const feathersMesh = instanced(featherGeo, featherMat, feathers);
    const bookGeo = new THREE.BoxGeometry(1, 1, 1);
    bookGeo.translate(0, 0.5, 0);
    const bookMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.8 });
    const booksMesh = instanced(bookGeo, bookMat, books, { colours: books.map((b) => b.colour) });
    group.add(feathersMesh, booksMesh);
    // the professor’s desk at the front, his chair behind it, and on the chair the pile of books he stands on
    kit.box('darkoak', 0, 0, -6.4, 3.2, 0.82, 1.1);
    kit.box('oak', 0, 0.82, -6.4, 3.4, 0.06, 1.25);
    kit.box('darkoak', 0, 0, -7.4, 0.8, 0.48, 0.7);
    const pile = [];
    let top = 0.48;
    for (let i = 0; i < 9; i++) {
      const h = 0.06 + ((i * 5) % 4) * 0.015;
      pile.push({ at: [((i * 37) % 7) * 0.012 - 0.03, top, -7.4 + ((i * 13) % 5) * 0.01], ry: ((i * 29) % 9) * 0.06 - 0.25, s: [0.42 - (i % 3) * 0.03, h, 0.56 - (i % 4) * 0.03], colour: LEATHERS[(i * 4) % LEATHERS.length] });
      top += h;
    }
    const pileMesh = instanced(bookGeo, bookMat, pile, { colours: pile.map((b) => b.colour) });
    group.add(pileMesh);
    // the board, the charm on it in chalk
    const board = flat(typeof document !== 'undefined' ? paintChalk('Wingardium Leviosa', ['The swish, then the flick', 'The stress on the third syllable', 'Mind the feather, not the ceiling', 'A feather is not a brick']) : null, { renderer, w: 3.6, h: 2.4, at: [0, 2.2, -L + 0.06] });
    group.add(board.mesh);
    // Professor Flitwick, on top of his books
    const flitwick = figure('flitwick', { rt, seed: 5 });
    flitwick.group.position.set(0, top, -7.4);
    flitwick.set({ base: null, speed: 0 });
    group.add(flitwick.group);
    let spoke = false;
    const spot = [-4.2 - 1.95 + 3 * 1.3, 0, -0.2];
    return {
      lessons: { charms: { at: spot, yaw: 0 } },
      doors: [lessonDoor({ id: 'charms', name: 'Charms: the feather', at: [spot[0], spot[2] + 0.3], spot, yaw: 0, teacher: 'Professor Flitwick', lesson, toast })],
      live: [
        {
          step(dt, c = {}) {
            flitwick.tick(dt);
            if (!spoke && c.at && c.at[1] < 2) {
              spoke = true;
              tell('line', { who: 'flitwick', name: NAMES.flitwick, text: LINES.flitwick.feather });
            }
          },
          dispose() {
            flitwick.dispose();
            windows.dispose();
            board.dispose();
            featherGeo.dispose();
            featherMat.dispose();
            bookGeo.dispose();
            bookMat.dispose();
          },
        },
      ],
    };
  },
});
