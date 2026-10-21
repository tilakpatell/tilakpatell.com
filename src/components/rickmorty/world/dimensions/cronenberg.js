// Cronenberg World ("Rick Potion #9"): the Smiths' street in the dimension
// Rick and Morty left, a year on. Cracked road, dead grass, the house
// boarded and fenced with spears, two graves in the yard, a wall of rubble,
// a car on its side, a sky the colour of a bruise. The Smiths who stayed
// (the cast's Jerry, Beth and Summer) and the Cronenbergs (the cast's,
// hunting whoever comes close) are placed from ./destinations.js.

import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffc8a0, 0.9], hemi: [0x8a7a8a, 0x3a2a2a, 1.3], fog: [0x8a6a6a, 50, 240] };

export async function buildCronenberg(kit) {
  const S = stage(kit, 'cronenberg', { ground: specks('#7a6a4a', ['#6a5a3e', '#8a7a56', '#5a4a3a'], 37, 1800, 2), groundTile: 6 });
  const { R, P, A } = S;

  // the road, cracked, across the middle
  R.frame(...P(0, 0), 0, { list: 'fixed' }).box(0x4a4a4a, 0, 0.01, 0, A.x1 - A.x0 + 40, 0.04, 7);
  for (let k = 0; k < 14; k++) R.frame(...P(-30 + k * 4.6, -2 + ((k * 7) % 5)), 0.3 + k, { list: 'fixed' }).box(0x2a2a2a, 0, 0.03, 0, 1.6, 0.02, 0.12);
  // the house (its model, the world's piece, on its solid: ./worlds.js), and
  // a fence of spears round the yard
  for (let dx = -24; dx <= -6; dx += 1.5) R.frame(...P(dx, -14), 0, { list: 'fixed' }).cyl(0x5a4a3a, 0, 0, 0, 0.05, 1.8).ball(0x9a9a9a, 0, 1.85, 0, 0.08, 1.6);
  // two graves
  for (const dx of [-21, -19]) R.frame(...P(dx, -17.6), 0).box(0x5a4a3a, 0, 0, 0, 1.2, 0.3, 2.2).box(0x8a8a8a, 0, 0, -1.2, 0.8, 0.9, 0.1);
  // the shovel against the wall of rubble east of the road
  R.frame(...P(6, -20), 0).box(0x6a5a5a, 0, 0, 0, 10, 2, 1);
  for (let k = 0; k < 8; k++) R.frame(...P(2 + k * 1.2, -19.4 + ((k * 3) % 2) * 0.3), k, { list: 'fixed' }).box(0x7a6a6a, 0, 2, 0, 0.9, 0.5, 0.6);
  R.frame(...P(12, -12), 0.4).box(0x3a2a1a, 0, 0.2, 0, 0.06, 1.5, 0.06, 0, 0, -0.3).box(0x6a6a6a, 0, 0, 0.1, 0.3, 0.4, 0.06, 0, 0, -0.3);
  // (the wrecked car is its model, the world's piece, on its solid), a lamp
  // post bent, dead trees
  R.frame(...P(4, 6), 0).cyl(0x4a4a4a, 0, 0, 0, 0.12, 4, 0, 0.4).glow(BALL, 0xff9a4a, 0.6, 1.4, 3.8, 0, 0, 0.2);
  for (const [dx, dz] of [
    [-8, 4],
    [26, -4],
    [-26, 10],
  ]) R.frame(...P(dx, dz), dx).cyl(0x3a2a2a, 0, 0, 0, 0.25, 4).box(0x3a2a2a, 0.8, 3, 0, 1.8, 0.1, 0.1, 0, 0, 0.6).box(0x3a2a2a, -0.7, 3.4, 0.2, 1.4, 0.1, 0.1, 0.3, 0, -0.7);
  // rubble in the north-east
  R.frame(...P(22, -16), 0.5).ball(0x6a5a5a, 0, 0, 0, 2.4, 0.6).ball(0x7a6a6a, 1, 0.3, 0.6, 1.2, 0.7);
  // a sign, the street's, bent over
  R.cell('cronsign', 160, 48, (g, w, h) => {
    g.fillStyle = '#2a4a2a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'SMITH ST', w / 2, h / 2, w - 12, 20, { color: '#f6f6e8' });
  });
  R.frame(...P(-6, 5), 0.2).cyl(0x5a5a5a, 0, 0, 0, 0.06, 2.4, 0, 0.5).decal('cronsign', 0.5, 2.3, 0.06, 1.4, 0.4, { rz: 0.4 });

  S.people();
  return S.done(LIGHT, () => {});
}
