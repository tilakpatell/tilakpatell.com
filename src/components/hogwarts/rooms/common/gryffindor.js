// The Gryffindor common room (the design’s §4.4): the round room at the top
// of the tower, in through the portrait hole, scarlet and gold: the fire in
// its great hearth with the lion over it, the squashy armchairs drawn up to
// it, the tapestries of the house’s beast, the notice board by the hole, the
// windows onto the night, and the two stairs up to the dormitories, the
// girls’ of which turns into a slide when a boy tries it (the book’s joke,
// here for anyone, once a visit). Nearly Headless Nick drifts through.

import { HOUSES } from '../../rules/sorting';
import { fireplace } from '../parts/furniture';
import { armchair, commonRoom, lowTable, roundWalls, sofa } from './shared';
import { createBanners } from '../banners';
import { createWindows } from '../parts/glass';

const R = 8;
const H = 6.5;
const [RED, GOLD] = HOUSES.gryffindor.colours;

export default commonRoom({
  id: 'gryffindor',
  name: 'The Gryffindor common room',
  house: 'gryffindor',
  bounds: { x0: -R + 0.6, x1: R - 0.6, z0: -R + 0.6, z1: R - 0.6 },
  colliders: [
    { kind: 'circle', at: [0, -R + 1.1], r: 1.4 },
    { kind: 'circle', at: [-2.2, -4.2], r: 0.7 },
    { kind: 'circle', at: [2.2, -4.2], r: 0.7 },
    { kind: 'circle', at: [0, -3.2], r: 0.8 },
    { kind: 'circle', at: [-4.6, 1.2], r: 1.1 },
    { kind: 'circle', at: [0, -1.6], r: 0.7 },
  ],
  spawn: { at: [0, 0, R - 1.6], yaw: 0 },
  floo: [0, -R + 2.2],
  bed: [5.2, 4.3],
  bedName: 'The boys’ stairs, and your four-poster',
  boardAt: [-3.2, R - 1.6],
  ghostPath: [[-4, 2], [3, 3], [4, -3], [-3, -2]],
  light: { hemi: [0xffd0a0, 0x3a201a, 0.95], points: [[0, 1.6, -R + 2.2, 0xff9a4a, 14], [-5, 3.5, 3, 0xffc078, 6], [5, 3.5, 3, 0xffc078, 6], [0, 5.5, 0, 0xffb060, 5]] },
  poses: {
    hearth: { at: [0, 1.5, 3.5], look: [0, 1.6, -R] },
    hole: { at: [0, 1.6, -3], look: [0, 1.6, R] },
    stairs: { at: [-2, 1.6, 0], look: [6, 2.4, 5] },
  },
  make(kit, { renderer, group, toast }) {
    let slid = false;
    // the round tower room: warm stone, a timbered ceiling, the floor boarded with a rug in the house’s rings
    roundWalls(kit, { r: R, h: H, mat: 'stonewarm', gaps: [[2.6, 3.0], [-0.35, 0.35]] });
    kit.cyl('board', 0, -0.2, 0, R + 0.6, R + 0.6, 0.2, { seg: 32 });
    kit.cyl('darkoak', 0, H, 0, R + 0.6, R + 0.6, 0.3, { seg: 32 });
    for (let i = 0; i < 8; i++) kit.box('darkoak', 0, H - 0.35, 0, 0.3, 0.35, R * 2 + 0.6, { ry: (i * Math.PI) / 8 });
    // the hearth, and the chairs drawn up to it
    const fireAt = fireplace(kit, { at: [0, 0, -R + 0.5], ry: 0, w: 3.2, h: 2.6 });
    armchair(kit, { at: [-2.2, 0, -4.2], ry: 0.5, cloth: RED });
    armchair(kit, { at: [2.2, 0, -4.2], ry: -0.5, cloth: RED });
    sofa(kit, { at: [0, 0, -2.6], ry: Math.PI, cloth: '#8a2a1e', len: 2.4 });
    lowTable(kit, { at: [0, 0, -1.6], r: 0.55 });
    armchair(kit, { at: [-4.6, 0, 1.2], ry: 1.2, cloth: '#9a3a22' });
    lowTable(kit, { at: [-3.8, 0, 2.4], r: 0.45 });
    // the portrait hole behind you as you come in: a round-topped tunnel through the wall
    kit.box('ashlar', -1.1, 0, R - 0.1, 0.3, 2.2, 1.2);
    kit.box('ashlar', 1.1, 0, R - 0.1, 0.3, 2.2, 1.2);
    kit.box('ashlar', 0, 2.2, R - 0.1, 2.5, 0.4, 1.2);
    kit.box(kit.paint('#140c08'), 0, 0.3, R + 0.4, 1.9, 1.9, 0.1);
    // the two stairs up to the dormitories: a stone flight each into a doorway in the wall
    for (const [x, z, ry] of [[4.5, 4.8, -0.75], [6.1, 2.6, -1.0]]) {
      for (let i = 0; i < 7; i++) kit.box('ashlar', x - Math.sin(ry) * i * 0.32, i * 0.22, z - Math.cos(ry) * i * 0.32, 1.1, 0.22, 0.34, { ry });
      kit.box(kit.paint('#140c08'), x - Math.sin(ry) * 2.4, 1.5, z - Math.cos(ry) * 2.4, 1.2, 2.1, 0.1, { ry });
    }
    // the notice board by the hole, a writing table, the bookshelf
    kit.box('darkoak', -3.2, 1.0, R - 0.75, 1.9, 1.25, 0.08, { ry: Math.PI + 0.38 });
    kit.box('oak', 3.8, 0.74, -2.8, 1.6, 0.06, 0.8, { ry: -0.6 });
    for (const [x, z] of [[3.4, -3.4], [4.3, -2.2]]) kit.box('oak', x, 0, z, 0.06, 0.74, 0.06);
    // tapestries of the house’s beast and two tall windows onto the night
    // the lion over the hearth, and the house’s tapestries either side of the room
    const banners = createBanners(
      [{ house: 'gryffindor', at: [0, H - 0.3, -R + 0.95], ry: 0 }, ...[-1.9, 1.9].map((a) => ({ house: 'gryffindor', at: [Math.sin(a) * (R - 0.15), H - 0.8, Math.cos(a) * (R - 0.15)], ry: a + Math.PI }))],
      { renderer, w: 1.5, h: 3.2 },
    );
    const windows = createWindows(
      [-1.1, 1.1].map((a) => ({ at: [Math.sin(a) * (R - 0.05), 2.4, Math.cos(a) * (R - 0.05)], w: 1.4, h: 3.2, ry: a + Math.PI })),
      { renderer },
    );
    windows.set({ day: 0, dusk: 0.1 });
    group.add(banners.group, windows.group);
    return {
      fires: [{ at: fireAt, w: 1.7, h: 1.3, tongues: 5 }],
      board: { w: 1.75, h: 1.12, at: [-3.2 + Math.sin(Math.PI + 0.38) * -0.05, 1.62, R - 0.8], ry: Math.PI + 0.38 },
      rug: { colours: [RED, GOLD, '#3a1a14'], r: 2.4, at: [0, 0.01, -3] },
      live: [banners, windows].map((x) => ({ dispose: () => x.dispose() })),
      doors: [
        {
          id: 'girls',
          at: [5.0, 1.6],
          r: 1.3,
          verb: 'Go up',
          name: 'The girls’ stairs',
          act: () => {
            // (once a visit the stairs flatten into a slide; after that they let you be)
            toast(slid ? 'The stairs stay stairs this time. You still don’t trust them.' : 'Halfway up, the stairs flatten into a stone slide and you’re back on the rug.');
            slid = true;
          },
        },
      ],
    };
  },
});
