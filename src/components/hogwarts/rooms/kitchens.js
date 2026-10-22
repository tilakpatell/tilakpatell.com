// The kitchens (the design’s §4.4): a high vaulted room right under the Great
// Hall, in through the painting of a fruit bowl (you tickle the pear). Four
// long tables stand exactly where the house tables stand overhead, so what
// is set on them here is sent up through the ceiling to the hall above: a
// thing a reader of the books would look for. Copper pans on every wall, a
// great brick hearth with its fire and its pots, the house-elves at work
// (small figures on the shared skeleton), and one of them with a pie for you.

import { TABLES } from './plan/greatHall';
import { bench, fireplace, table } from './parts/furniture';
import { commonRoom } from './common/shared';
import { figure } from '../cast/figures';
import { LINES, NAMES } from '../rules/lines';

const W = 10; // m from the middle to the long walls (the hall’s width over it)
const L = 15;
const H = 7;
const ELVES = [
  { at: [-4.4, -8], yaw: 0, base: 'idle' },
  { at: [0, -11], yaw: Math.PI, base: 'talk' },
  { at: [4.4, -6], yaw: -1.4, base: 'idle' },
  { at: [-8, 2], yaw: 1.6, base: 'talk' },
  { at: [2.2, 6.5], yaw: Math.PI, base: 'idle' },
];

export default commonRoom({
  id: 'kitchens',
  name: 'The kitchens',
  bounds: { x0: -W + 0.6, x1: W - 0.6, z0: -L + 0.6, z1: L - 0.6 },
  colliders: [
    ...TABLES.flatMap((t) => Array.from({ length: 14 }, (_, i) => ({ kind: 'circle', at: [t.x, -9 + i * 1.4], r: 1.05 }))),
    { kind: 'circle', at: [0, -L + 1.2], r: 1.8 },
    ...ELVES.map((e) => ({ kind: 'circle', at: e.at, r: 0.4 })),
  ],
  spawn: { at: [0, 0, L - 1.6], yaw: 0 },
  floo: [0, -L + 2.4],
  places: [{ id: 'kitchens', name: 'The kitchens', at: [0, 0], r: 10 }],
  light: { hemi: [0xffd8a8, 0x3a2414, 1.0], points: [[0, 1.6, -L + 2.4, 0xff8a3a, 16], [-6, 4, 0, 0xffc080, 7], [6, 4, 0, 0xffc080, 7], [0, 4, 8, 0xffc080, 6]] },
  poses: {
    tables: { at: [0, 1.4, L - 2], look: [0, 1.0, -L + 2] },
    hearth: { at: [2, 1.2, -6], look: [0, 1.5, -L] },
  },
  make(kit, { group, rt, tell }) {
    // the vault: brick-warm stone, a barrel roof, flags underfoot
    kit.box('stonewarm', -W - 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('stonewarm', W + 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('stonewarm', 0, 0, -L - 0.5, W * 2, H + 2, 1);
    kit.box('stonewarm', 0, 0, L + 0.5, W * 2, H + 2, 1);
    kit.box('flags', 0, -0.3, 0, W * 2, 0.3, L * 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 11) * Math.PI;
      kit.box('stonewarm', Math.cos(a) * W, H + Math.sin(a) * 2.2, 0, 1.4, 0.8, L * 2, { rz: a - Math.PI / 2 });
    }
    // the four tables, under the four in the hall
    for (const t of TABLES) {
      table(kit, { at: [t.x, 0, 0.5], ry: Math.PI / 2, len: 19, w: 1.1, top: 0.86, mat: 'board' });
      bench(kit, { at: [t.x - 0.95, 0, 0.5], ry: Math.PI / 2, len: 19, mat: 'board' });
      bench(kit, { at: [t.x + 0.95, 0, 0.5], ry: Math.PI / 2, len: 19, mat: 'board' });
    }
    // what’s on them, ready to go up: platters, jugs and pies down each one
    const copper = kit.paint('#b8733a', { rough: 0.35, metal: 0.85 });
    const crust = kit.paint('#c88a3e', { rough: 0.8 });
    for (const t of TABLES)
      for (let i = 0; i < 9; i++) {
        const z = -8 + i * 2;
        if (i % 3 === 0) kit.cyl(crust, t.x, 0.86, z, 0.22, 0.24, 0.1, { seg: 12 });
        else if (i % 3 === 1) kit.cyl(kit.paint('#d8d0c0', { rough: 0.5 }), t.x, 0.86, z, 0.3, 0.3, 0.03, { seg: 14 });
        else kit.cyl(copper, t.x, 0.86, z, 0.08, 0.1, 0.28, { seg: 8 });
      }
    // the hearth, wide enough to stand in, a pot hung in it
    const fireAt = fireplace(kit, { at: [0, 0, -L + 0.5], ry: 0, w: 4.4, h: 3.2, mat: 'stonewarm' });
    kit.cyl('iron', 0, 0.9, -L + 1.1, 0.5, 0.4, 0.7, { seg: 14 });
    // copper pans on every wall, big to small
    for (const side of [-1, 1])
      for (let i = 0; i < 12; i++) {
        const z = -12 + i * 2.2;
        const r = 0.18 + (i % 4) * 0.06;
        kit.cyl(copper, side * (W - 0.12), 2.2 + (i % 2) * 0.8, z, r, r, 0.08, { rz: Math.PI / 2, seg: 14 });
      }
    // the painting of the fruit bowl, on the inside of the door
    kit.box('gold', 0, 1.3, L - 0.08, 1.2, 1.0, 0.06);
    kit.box(kit.paint('#5a4020'), 0, 1.38, L - 0.12, 1.0, 0.84, 0.04);
    kit.cyl(kit.paint('#7cb83a'), 0.12, 1.75, L - 0.16, 0.09, 0.07, 0.16, { seg: 8 });
    // the house-elves at work, small and busy; one with a pie for you
    const elves = ELVES.map((e, i) => {
      const f = figure('elf', { rt, seed: 11 + i });
      f.group.position.set(e.at[0], 0, e.at[1]);
      f.group.rotation.y = e.yaw;
      f.set({ base: null, speed: 0 });
      group.add(f.group);
      return f;
    });
    let pies = 0;
    return {
      fires: [{ at: fireAt, w: 2.4, h: 1.6, tongues: 6 }],
      live: [
        {
          step(dt) {
            for (const f of elves) f.tick(dt);
          },
          dispose() {
            for (const f of elves) f.dispose();
          },
        },
      ],
      doors: [
        {
          id: 'pie',
          at: [4.4, -5],
          r: 1.4,
          verb: pies ? 'Take another pie from' : 'Take a pie from',
          name: 'A house-elf',
          act: () => {
            pies++;
            tell('line', { who: 'elf', name: NAMES.elf, text: pies === 1 ? LINES.elf.pie : LINES.elf.shy });
            tell('pie', { n: pies });
          },
        },
      ],
    };
  },
});

