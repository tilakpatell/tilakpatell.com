// Fantasy World ("Something Ricked This Way Comes"' sort of place, and
// Mortynight Run's): a medieval village square of cobbles under a summer
// sky, the Thirsty Step tavern (Meshy) at its head, timber cottages round it,
// Dale the giant standing beyond the square, the well with the Meeseeks at
// it, and King Jellybean by the privy until the climb's done. Up the
// tavern's west side, the three Stair Goblins stand in a flight, biting by
// turns (the stage poses them: ../games/climb.js); past them the beanstalk's
// shoots wind up round its stalk to the crown, where a giant waits on the
// cloud by the giants' castle (./worlds.js). Each shoot is drawn as the
// walker has it (./beanstalk.js): a column from the ground to its top, a
// leaf flush on it, nothing to walk under.

import { BALL, CYL } from '../interiors/shell';
import { gablePrism } from '../kit';
import { BEANSTALK } from './beanstalk';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff2d0, 1.9], hemi: [0xcfe6ff, 0x6a7a4a, 1.25], fog: [0xcfe2f2, 60, 320] };
const COBBLE = (g, w, h) => {
  g.fillStyle = '#8a8478';
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16)
    for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
      g.fillStyle = ['#a39d90', '#9a9486', '#aca699'][(x * 7 + y * 3) % 3];
      g.beginPath();
      g.ellipse(x + 8, y + 8, 6.5, 6, 0, 0, Math.PI * 2);
      g.fill();
    }
};

export async function buildFantasy(kit) {
  const S = stage(kit, 'fantasy', { ground: specks('#6f9a48', ['#5f8a3e', '#82ad58', '#76a04c'], 11), groundTile: 6 });
  const { R, P } = S;

  // the square's cobbles
  const [sx, sz] = P(0, -2);
  R.frame(sx, sz, 0, { list: 'fixed' }).box(0x9a9486, 0, 0, 0, 34, 0.04, 26);
  R.cell('cobbles', 128, 128, COBBLE);
  R.frame(sx, sz, 0, { list: 'fixed' }).decal('cobbles', 0, 0.05, 0, 34, 26, { rx: -Math.PI / 2 });

  // the cottages: cream plaster, dark timbers, steep roofs
  for (const [dx, dz, turn] of [
    [-25, -6, Math.PI / 2],
    [-25, 8, Math.PI / 2],
    [24, 4, -Math.PI / 2],
  ]) {
    const f = R.frame(...P(dx, dz), turn);
    f.box(0xefe2c4, 0, 0, 0, 7, 3.6, 6);
    for (const u of [-3.4, 0, 3.4]) f.box(0x4a3424, u, 0, 3.02, 0.25, 3.6, 0.06);
    f.box(0x4a3424, 0, 1.8, 3.02, 7, 0.22, 0.06);
    f.part(gablePrism(7.6, 6.6, 3.2), 0x7a4a2e, 0, 3.6, 0);
    f.box(0x5a3a22, 0, 0, 3.05, 1.1, 2.1, 0.08).box(0xffd98a, -2.2, 1.4, 3.05, 1, 0.9, 0.06).box(0xffd98a, 2.2, 1.4, 3.05, 1, 0.9, 0.06);
    f.box(0x8a8a8a, 2.4, 3.6, -1, 0.8, 2.6, 0.8);
  }

  // the well, stone, with its roof and bucket
  const w = R.frame(...P(5, -1.4), 0);
  w.cyl(0x8a8478, 0, 0, 0, 1.05, 0.9).cyl(0x2a3a4a, 0, 0.88, 0, 0.8, 0.04);
  w.box(0x5a3a22, -0.9, 0, 0, 0.14, 2.2, 0.14).box(0x5a3a22, 0.9, 0, 0, 0.14, 2.2, 0.14).part(gablePrism(2.4, 1.6, 0.7), 0x7a4a2e, 0, 2.2, 0);
  w.cyl(0x6a4a2a, 0, 1.5, 0, 0.05, 1.8, 0, Math.PI / 2).cyl(0x7a5a3a, 0.3, 1.0, 0, 0.18, 0.3);

  // the privy King Jellybean stands by
  const pv = R.frame(...P(-15.6, -3.5), Math.PI / 2);
  pv.box(0x7a5a3a, 0, 0, 0, 1.6, 2.3, 1.6).part(gablePrism(1.9, 1.9, 0.6), 0x5a3a22, 0, 2.3, 0).box(0x4a3424, 0, 1.8, 0.81, 0.18, 0.18, 0.04);

  // the beanstalk's landings, its shoots and its crown: green columns from the
  // ground to their tops (the walker's ledges are), each with a leaf flush on top
  const LEAF = 0.14;
  const ledge = (id) => BEANSTALK.solids.find((o) => o.id === id);
  BEANSTALK.path
    .filter((id) => !/^g\d-/.test(id))
    .forEach((id, i) => {
      const o = ledge(id);
      const f = R.frame(...P(o.dx, o.dz), o.turn ?? 0);
      const green = i % 2 ? 0x5aa846 : 0x4f9a3a;
      if (o.r != null) f.cyl(green, 0, 0, 0, o.r, o.top - LEAF).cyl(0x7acc58, 0, o.top - LEAF, 0, o.r, LEAF);
      else f.box(green, 0, 0, 0, o.w, o.top - LEAF, o.d).box(0x7acc58, 0, o.top - LEAF, 0, o.w, LEAF, o.d);
    });
  // the stalk's tip, curling north up into the cloud from the crown
  const crown = ledge('beanstalk');
  const tip = R.frame(...P(crown.dx, crown.dz), 0, { y: crown.top });
  [0.5, 0.42, 0.33, 0.24].forEach((r, i) => tip.cyl(0x4f9a3a, 0, i * 1.0, -i * i * 0.18, r, 1.1, -i * 0.22, 0, CYL));
  // the stumps the upper goblins stand on, from the ground to their feet
  for (const g of BEANSTALK.stairs.filter((st) => st.base > 0)) R.frame(...P(g.dx, g.dz), 0).box(0x6a4a2a, 0, 0, 0, g.h, g.base, g.h * 1.054);

  // a fence round the square's south side, and lanterns on posts
  for (let dx = -16; dx <= 16; dx += 2) if (Math.abs(dx) > 3) R.frame(...P(dx, 11), 0, { list: 'fixed' }).box(0x6a4a2a, 0, 0, 0, 0.12, 1, 0.12).box(0x7a5a3a, 1, 0.75, 0, 2, 0.1, 0.06);
  for (const [dx, dz] of [
    [-12, 6],
    [12, 6],
    [-12, -12],
    [12, -12],
  ])
    R.frame(...P(dx, dz), 0).box(0x3a2a1a, 0, 0, 0, 0.14, 2.6, 0.14).glow(BALL, 0xffc070, 1.6, 0, 2.7, 0, 0, 0.35);

  // the tavern, the giant beyond the square, and the Stair Goblins: a flight
  // of three, facing the square so their steps rise toward the beanstalk,
  // each on its stump (the stage poses them as their stair's mood has it)
  S.figure('thirstystep', { x: P(-6, -19)[0], z: P(-6, -19)[1], face: -Math.PI / 2, h: 8.5 });
  S.figure('giant', { x: P(16, -20)[0], z: P(16, -20)[1], face: -Math.PI / 2, h: 11 });
  const stairs = {};
  for (const g of BEANSTALK.stairs) S.figure('stairgoblin', { x: P(g.dx, g.dz)[0], z: P(g.dx, g.dz)[1], y: g.base, face: -Math.PI / 2, h: g.h, onPlace: (c) => (stairs[g.id] = c.group) });
  S.climb({ stairs });
  // and up on the cloud, by the castle's door, a giant looking down the beanstalk
  S.figure('giant', { x: P(-23, -25.6)[0], z: P(-23, -25.6)[1], y: 21.8, face: -Math.PI / 2, h: 11 });
  S.people();

  return S.done(LIGHT);
}
