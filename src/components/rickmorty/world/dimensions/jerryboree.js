// The Jerryboree ("Meeseeks and Destroy"' sister episode, "Mortynight Run"):
// a daycare for Jerrys, a bright room of soft colours with padded walls; a
// ball pit, a television showing the same programme it always does, cots, a
// reception desk with a Rick behind it and a ticket machine; Jerrys about the
// room from the six made (Meshy), one of them ours, dealt afresh each run by
// the stage's find (../games/find.js).

import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff6e8, 0.7], hemi: [0xfff8ee, 0x8a7a6a, 1.9], fog: null, background: 0x1a1612 };
export async function buildJerryboree(kit) {
  const S = stage(kit, 'jerryboree', { floor: specks('#bfe0e8', ['#a8d4de', '#d4ecf0'], 9), wall: 0xf6e6a8, ceiling: 0xfff6e0, skirt: 0x7ab8d8, dado: [1.1, 0xf2b8c8] });
  const { R, P } = S;

  // soft play mats on the floor in big squares
  const mats = [0xf2a0b0, 0x8ad0e8, 0xf6dc7a, 0x9ad89a];
  for (let i = 0; i < 6; i++) for (let k = 0; k < 4; k++) R.frame(...P(-9 + i * 3.6, -6.2 + k * 3.6), 0, { list: 'fixed' }).box(mats[(i + k) % 4], 0, 0, 0, 3.5, 0.03, 3.5);

  // the ball pit: a padded square full of coloured balls
  const [px, pz] = P(5, -4);
  const pit = R.frame(px, pz, 0);
  pit.box(0x6ab8e8, 0, 0, 0, 4.4, 0.6, 4.4);
  const balls = [0xff5a5a, 0x5ab4ff, 0xffd84a, 0x6ad86a, 0xff8ad0];
  for (let i = 0; i < 70; i++) pit.ball(balls[i % 5], ((i * 37) % 38) / 10 - 1.9, 0.62 + (i % 3) * 0.08, ((i * 53) % 38) / 10 - 1.9, 0.16);

  // the television on its stand, a show about fixing a house on it
  R.cell('jerrytv', 128, 80, (g, w, h) => {
    g.fillStyle = '#7ab0d8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c88a5a';
    g.fillRect(30, 30, 60, 40);
    g.fillStyle = '#8a3a2a';
    g.beginPath();
    g.moveTo(24, 32);
    g.lineTo(60, 10);
    g.lineTo(96, 32);
    g.fill();
  });
  R.frame(...P(-2, -7.4), 0).box(0x5a4a3a, 0, 0, 0, 2.4, 0.7, 0.6).box(0x1a1a1a, 0, 0.7, 0, 1.9, 1.15, 0.2).decal('jerrytv', 0, 1.27, 0.11, 1.75, 1.0, { bright: true });

  // cots against the west wall
  for (const dz of [-5, -2]) R.frame(...P(-8.5, dz), Math.PI / 2).box(0xd8d8e8, 0, 0, 0, 2, 0.45, 1.1).box(0xffffff, 0.7, 0.45, 0, 0.5, 0.12, 0.8);

  // the reception desk, the Rick behind it, the ticket machine and the sign
  const [dx, dz] = P(6.5, 3.1);
  R.frame(dx, dz, 0).box(0xf2b8c8, 0, 0, 0, 3.2, 1.05, 0.8).box(0xfff6e0, 0, 1.05, 0, 3.3, 0.06, 0.9).box(0x2a2a2a, -0.9, 1.11, -0.1, 0.5, 0.35, 0.05);
  const [tx, tz] = P(3.5, 5.9);
  R.frame(tx, tz, 0).box(0xe84a4a, 0, 0, 0, 0.5, 1.3, 0.5).box(0xffffff, 0, 1.0, 0.26, 0.2, 0.06, 0.02);
  R.cell('jerrysign', 256, 64, (g, w, h) => {
    g.fillStyle = '#f2b8c8';
    g.fillRect(0, 0, w, h);
    fitText(g, 'JERRYBOREE', w / 2, h / 2, w - 20, 40, { color: '#2a5a8a' });
  });
  R.frame(...P(6.5, 7.86), Math.PI, { list: 'fixed' }).decal('jerrysign', 0, 2.8, 0.06, 4, 1);

  // round lamps overhead
  for (const [lx, lz] of [
    [-5, -3],
    [5, -3],
    [0, 3],
  ])
    R.frame(...P(lx, lz), 0, { list: 'fixed' }).glow(BALL, 0xfff2c8, 1.3, 0, S.d.ceiling - 0.25, 0, 0, 0.9, 0.3);

  // the Jerrys (./destinations.js has where)
  S.people();
  return S.done(LIGHT);
}
