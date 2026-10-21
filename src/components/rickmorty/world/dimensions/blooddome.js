// The Blood Dome ("Rickmancing the Stone"): the Death Stalkers' arena in the
// wasteland, a ring of scrap and sand under a dome of bent girders, wrecked
// cars for stands, torches, a sign. Hemorrhage waits by the far gate till
// Morty steps into the ring (the area's 'fight'); the fight is stage.js's
// duel (./duel.js). Summer, the Death Stalkers and Armothy are models placed
// from ./destinations.js.

import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffe0b0, 1.3], hemi: [0xd8a070, 0x5a3a2a, 1.3], fog: [0xd8a070, 60, 280] };

export async function buildBlooddome(kit) {
  const S = stage(kit, 'blooddome', { ground: specks('#c89a5a', ['#b88a4e', '#d8aa6a', '#a87a4a'], 43, 2000, 2), groundTile: 6 });
  const { R, P } = S;

  // the ring: a circle of darker sand, bordered with tyres and scrap
  R.frame(...P(0, -5), 0, { list: 'fixed' }).cyl(0xa8703a, 0, 0.01, 0, 11, 0.04);
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const f = R.frame(...P(Math.cos(a) * 11, -5 + Math.sin(a) * 11), a, { list: 'fixed' });
    f.cyl(0x1a1a1a, 0, 0, 0, 0.5, 0.4, Math.PI / 2);
    if (k % 3 === 0) f.box(0x6a5a4a, 0, 0.4, 0, 0.8, 0.3, 0.6);
  }
  // the dome: bent girders over the ring, meeting high up
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const f = R.frame(...P(Math.cos(a) * 13, -5 + Math.sin(a) * 13), -a);
    f.box(0x4a4a4a, 0, 0, 0, 0.4, 12, 0.4, 0, 0, 0.55);
  }
  R.frame(...P(0, -5), 0, { list: 'fixed' }).cyl(0x4a4a4a, 0, 11, 0, 3, 0.6).glow(BALL, 0xff6a3a, 1.4, 0, 11.4, 0, 0, 0.8);
  // the posts with torches at the corners, and the gate where he waits
  for (const [dx, dz] of [
    [-8, -16],
    [8, -16],
    [-8, 6],
    [8, 6],
  ]) R.frame(...P(dx, dz), 0).cyl(0x5a4a3a, 0, 0, 0, 0.5, 3.5).glow(BALL, 0xff8a3a, 1.8, 0, 3.9, 0, 0, 0.5);
  R.frame(...P(0, -17), 0).box(0x4a4a4a, 0, 0, 0, 6, 4.4, 0.6).box(0x6a2a2a, 0, 4.4, 0, 7, 0.6, 1);
  // (the wrecked cars east and west are the croncar's model, the world's pieces, on their solids)
  // the sign
  R.cell('bloodsign', 192, 80, (g, w, h) => {
    g.fillStyle = '#3a2a1a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'BLOOD DOME', w / 2, h * 0.34, w - 16, 26, { color: '#d82a2a' });
    fitText(g, 'no weapons  no mercy  no refunds', w / 2, h * 0.72, w - 16, 11, { color: '#f6e8c8', weight: '400' });
    g.strokeStyle = '#d82a2a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w * 0.17, h * 0.72);
    g.lineTo(w * 0.36, h * 0.72);
    g.stroke();
  });
  R.frame(...P(0, 15.6), Math.PI).box(0x5a4a3a, 0, 0, 0, 0.16, 2.2, 0.16).box(0x3a2a1a, 0, 1.6, 0, 2.4, 1, 0.1).decal('bloodsign', 0, 2.1, 0.06, 2.3, 0.95);
  // bones and scrap about the sand
  for (let k = 0; k < 10; k++) R.frame(...P(-28 + (k * 23) % 56, -22 + ((k * 17) % 40)), k, { list: 'fixed' }).box(0xe8e0c8, 0, 0, 0, 0.6, 0.08, 0.1).box(0xe8e0c8, 0.25, 0, 0, 0.14, 0.14, 0.2);

  S.people();
  const area = S.done(LIGHT, () => {});
  area.actions = {
    ...area.actions,
    fight: () => S.hunt(true),
  };
  return area;
}
