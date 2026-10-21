// St. Gloopy Noops ("Interstellar Hospital", "Interdimensional Cable 2"):
// a hospital ward in white and mint, a bed at the far end with Shrimply
// Pibbles in it (a model), curtains, a reception desk, benches, a vending
// machine, a cart, and the hospital's staff on their rounds (models,
// ./destinations.js). Jerry waits on a bench. The bed's bay is the theatre,
// its sign over the bed; the doctors keep the way to it, and once Jerry's
// things are taken back every one of them is after Morty.

import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffffff, 0.9], hemi: [0xf0fff8, 0x9aa8a0, 2.0], fog: null, background: 0x0a1a14 };
const MINT = 0xc8f0e0; // the counters
const WHITE = 0xf6faf8;

export async function buildGloopynoops(kit) {
  const S = stage(kit, 'gloopynoops', { floor: specks('#e8f4ee', ['#dcebe4', '#f2f8f4'], 3, 600, 2), floorTile: 2.5, wall: WHITE, ceiling: 0xf2f8f4, skirt: 0x6ab8a0 });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // ceiling panels of light
  for (let dz = -12; dz <= 12; dz += 6) for (let dx = -15; dx <= 15; dx += 15) R.frame(...P(dx, dz), 0, { list: 'fixed' }).glow(BOX, 0xffffff, 1.3, 0, H - 0.06, 0, 0, 2.4, 0.04, 1.2);
  // the bed's bay: curtain rail and curtains, half drawn
  const [bx, bz] = P(0, -13.6);
  R.frame(bx, bz, 0, { list: 'fixed' }).box(0x9aa8a0, 0, 2.6, 2.4, 7, 0.06, 0.06);
  for (const u of [-3.2, 3.2]) R.frame(bx + u, bz + 2.4, 0, { list: 'fixed' }).box(0xa8d8c8, 0, 0.1, 0, 1.2, 2.5, 0.08);
  // the theatre's sign, over the bed
  R.cell('theatresign', 192, 48, (g, w, h) => {
    g.fillStyle = '#6ab8a0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'THEATRE', w / 2, h / 2, w - 12, 18, { color: '#ffffff' });
  });
  R.frame(...P(0, -(A.z1 - A.z0) / 2 + 0.14), 0, { list: 'fixed' }).decal('theatresign', 0, 3.4, 0.06, 4, 1);
  // a monitor by the bed
  R.frame(bx + 2.2, bz - 1, 0).box(0xd8e0dc, 0, 0, 0, 0.6, 1.2, 0.6).box(0x0a1a14, 0, 1.2, 0, 0.7, 0.5, 0.1, 0, -0.2).glow(BOX, 0x6aff9a, 1.5, 0, 1.45, 0.06, 0, 0.6, 0.36, 0.02, -0.2);
  // reception, benches, the vending machine, a cart
  const [rx, rz] = P(12, 14);
  R.frame(rx, rz, Math.PI).box(MINT, 0, 0, 0, 5, 1.1, 1.4).box(WHITE, 0, 1.1, 0, 5.2, 0.06, 1.5);
  R.cell('gloopsign', 192, 48, (g, w, h) => {
    g.fillStyle = '#6ab8a0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'ST. GLOOPY NOOPS', w / 2, h / 2, w - 12, 18, { color: '#ffffff' });
  });
  R.frame(...P(12, (A.z1 - A.z0) / 2 - 0.14), Math.PI, { list: 'fixed' }).decal('gloopsign', 0, 3.2, 0.06, 5, 1.2);
  for (const [dx, dz] of [
    [-12, 6],
    [-6, 14],
  ]) R.frame(...P(dx, dz), 0).box(0x6ab8a0, 0, 0.4, 0, 3, 0.1, 1).box(0x6ab8a0, 0, 0.5, -0.45, 3, 0.6, 0.08).box(0x9aa8a0, -1.3, 0, 0, 0.08, 0.4, 0.9).box(0x9aa8a0, 1.3, 0, 0, 0.08, 0.4, 0.9);
  const V = R.frame(...P(-19.5, 12), Math.PI / 2);
  V.box(0x4a6a8a, 0, 0, 0, 1.2, 2, 1.6).glow(BOX, 0xbfe8ff, 1.3, 0, 0.6, 0.62, 0, 0.9, 1.1, 0.02);
  for (let k = 0; k < 6; k++) V.box([0xff6a6a, 0xffe24a, 0x6aff9a][k % 3], -0.3 + (k % 3) * 0.3, 0.8 + Math.floor(k / 3) * 0.4, 0.64, 0.2, 0.25, 0.02);
  R.frame(...P(8, -2), 0.3).box(0xd8e0dc, 0, 0.7, 0, 1.2, 0.05, 1.6).box(0xd8e0dc, 0, 0.1, 0, 1.2, 0.05, 1.6).cyl(0x9aa8a0, -0.5, 0, -0.7, 0.03, 0.7).cyl(0x9aa8a0, 0.5, 0, 0.7, 0.03, 0.7).ball(0xff6a6a, 0.2, 0.85, 0.2, 0.12);
  // the doors down the ward's east wall
  for (const dz of [-6, 2, 10]) R.frame(A.x1 - 0.12, P(0, dz)[1], -Math.PI / 2, { list: 'fixed' }).box(0x6ab8a0, 0, 0, 0, 1.2, 2.2, 0.08).glow(BALL, 0xff6a6a, 1.4, 0, 2.4, 0.06, 0, 0.1);

  S.people();
  const area = S.done(LIGHT, () => {});
  // (Jerry's things taken back: every doctor after him)
  area.actions = { ...area.actions, collected: () => S.hunt(true) };
  return area;
}
