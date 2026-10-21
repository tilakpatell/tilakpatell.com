// Heist-Con ("One Crew over the Crewcoo's Morty"): a convention hall in
// black and gold, a stage where Heistotron gives the keynote, glass behind it
// onto a casino strip at night (its world, ./worlds.js) and the con's banner
// over the glass, booths down the sides, a badge table by the way in,
// and heisters milling about (./destinations.js; stage.js's NPC behaviour).
// Miles Knightly is assembling a crew.

import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff0d8, 0.8], hemi: [0xffe8c8, 0x3a2a1a, 1.7], fog: null, background: 0x0c0a08 };
const BLACK = 0x1a1612;
const GOLD = 0xd8b25a;

export async function buildHeistcon(kit) {
  const S = stage(kit, 'heistcon', { floor: specks('#2a2420', ['#241f1b', '#302a24'], 5, 800, 2), floorTile: 3, wall: 0x2a2420, ceiling: BLACK, skirt: GOLD });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // the stage, the banner, spotlights
  const [sx, sz] = P(0, -14);
  R.frame(sx, sz, 0).box(BLACK, 0, 0, 0, 14, 0.8, 4).box(GOLD, 0, 0.8, 0, 14.2, 0.06, 4.2);
  R.cell('heistbanner', 256, 64, (g, w, h) => {
    g.fillStyle = '#1a1612';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8b25a';
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    fitText(g, 'HEIST-CON', w / 2, h * 0.42, w - 30, 30, { color: '#d8b25a' });
    fitText(g, 'the con is the heist', w / 2, h * 0.78, w - 30, 12, { color: '#f6e8c8', weight: '400' });
  });
  // (over the glass behind the stage, which shows the strip outside: ./worlds.js)
  R.frame(...P(0, -(A.z1 - A.z0) / 2 + 0.14), 0, { list: 'fixed' }).box(BLACK, 0, 6.15, 0, 7.2, 1.7, 0.1).decal('heistbanner', 0, 7.0, 0.07, 6.8, 1.7, { bright: true });
  for (const dx of [-5, 0, 5]) R.frame(...P(dx, -8), 0, { list: 'fixed' }).cyl(BLACK, 0, H - 0.6, 0, 0.2, 0.6).glow(BALL, 0xffe0a0, 1.6, 0, H - 0.7, 0, 0, 0.4);
  // the booths: a counter, a back board, a lamp
  for (const [dx, dz, turn] of [
    [15, 12, Math.PI],
    [-15, 12, Math.PI],
    [17, -10, -Math.PI / 2],
    [-17, -10, Math.PI / 2],
  ]) {
    const f = R.frame(...P(dx, dz), turn);
    f.box(0x3a302a, 0, 0, 0, 4, 1.05, 1.2).box(GOLD, 0, 1.05, 0, 4.1, 0.05, 1.3);
    f.box(BLACK, 0, 0, -1.1, 4, 2.6, 0.1).glow(BALL, 0xffd080, 1.5, 0, 2.4, -0.6, 0, 0.22);
    for (let k = 0; k < 4; k++) f.box([0x8a8a90, 0x4a4a50, 0xc8a24a, 0x2a2a30][k], -1.4 + k * 0.9, 1.1, 0, 0.5, 0.3 + (k % 2) * 0.3, 0.4);
  }
  // the badge table
  const [bx, bz] = P(-8, 13);
  R.frame(bx, bz, 0).box(0x3a302a, 0, 0, 0, 3, 0.9, 1).box(0xf6f2e8, 0, 0.9, 0, 3.1, 0.04, 1.1);
  for (let k = 0; k < 6; k++) R.frame(bx - 1.1 + k * 0.44, bz, 0, { list: 'fixed' }).box(0xffffff, 0, 0.95, 0, 0.3, 0.01, 0.2);
  // rope lanes to the stage
  for (const dz of [-6, -2, 2, 6]) for (const dx of [-4, 4]) R.frame(...P(dx, dz), 0, { list: 'fixed' }).cyl(GOLD, 0, 0, 0, 0.05, 0.95).ball(GOLD, 0, 0.95, 0, 0.07);
  for (const dx of [-4, 4]) R.frame(...P(dx, 0), 0, { list: 'fixed' }).cyl(0x8a1e22, 0, 0.85, 0, 0.025, 12, Math.PI / 2);

  S.people();
  return S.done(LIGHT, () => {});
}
