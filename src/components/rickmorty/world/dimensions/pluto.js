// Pluto ("Something Ricked This Way Comes"): a flat blue-grey plain under a
// black sky with a ring of rocks across it and two close moons; mushrooms of
// three sizes, mushroom-shaped houses, the king's pyramid palace at the north
// with his podium before it; King Flippy Nips on the steps, Scroopy Noopers
// with his protest sign, and Plutonians gathered to hear the speech. On the
// palace's front hang four banners, each a claim about Pluto: the deal's
// things (../games/deal.js), weighed up and told the king; a claim told and
// the king cheers, and the rally with him.

import { BALL, CYL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xd8e4ff, 1.35], hemi: [0x8aa4e8, 0x2a2a4a, 1.3], fog: [0x1d2a55, 70, 320] };

export async function buildPluto(kit) {
  const S = stage(kit, 'pluto', { ground: specks('#7a8aa8', ['#6a7a98', '#8a9ab8', '#728296'], 23), groundTile: 6 });
  const { R, P } = S;

  // the palace: a stepped pyramid of pale blue stone, a gold cap
  const [px, pz] = P(0, -19);
  const pal = R.frame(px, pz, 0);
  for (let i = 0; i < 5; i++) pal.box(i % 2 ? 0xb8c8e8 : 0xa8b8d8, 0, i * 1.4, 0, 14 - i * 2.6, 1.4, 8 - i * 1.4);
  pal.box(0xe8c84a, 0, 7, 0, 1.6, 1, 1.4);
  // the steps down its front to the podium, and the king's banners: his
  // crest over a claim, west to east as the claims' spots stand
  pal.box(0xc8d4ee, 0, 0, 4.4, 4, 0.35, 1.2);
  for (const [u, id, a, b] of [
    [-5.4, 'claim-growing', 'IS', 'GROWING'],
    [-2.2, 'claim-moons', 'HAS TWO', 'MOONS'],
    [2.2, 'claim-mines', 'HAS NO', 'MINES'],
    [5.4, 'claim-planet', 'IS A', 'PLANET'],
  ]) {
    R.cell(`pluto-${id}`, 96, 192, (g, w, h) => {
      g.fillStyle = '#8a1a2a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#e8c84a';
      g.beginPath();
      g.arc(w / 2, 34, 18, 0, Math.PI * 2);
      g.fill();
      fitText(g, 'PLUTO', w / 2, 84, w - 12, 24, { color: '#f6e8b0' });
      fitText(g, a, w / 2, 118, w - 12, 20, { color: '#f6e8b0' });
      fitText(g, b, w / 2, 148, w - 12, 22, { color: '#e8c84a' });
    });
    pal.decal(`pluto-${id}`, u, 3.2, 4.02, 1.4, 2.8);
  }
  // the podium
  R.frame(...P(0, -9.2), 0).box(0x5a3a2a, 0, 0, 0, 1.2, 1.15, 0.8).cyl(0x2a2a2a, 0, 1.15, -0.2, 0.03, 0.35);

  // Scroopy's protest sign
  R.cell('plutosign', 128, 64, (g, w, h) => {
    g.fillStyle = '#f6f2e6';
    g.fillRect(0, 0, w, h);
    fitText(g, 'PLUTO IS', w / 2, 18, w - 16, 16, { color: '#2a2a5a' });
    fitText(g, 'SHRINKING', w / 2, 44, w - 16, 20, { color: '#b8262c' });
  });
  R.frame(...P(12.6, -2), -Math.PI / 2).cyl(0x6a4a2a, 0, 0, 0, 0.05, 2.2).box(0xf6f2e6, 0, 1.6, 0, 1.4, 0.8, 0.05).decal('plutosign', 0, 2.0, 0.03, 1.36, 0.7);

  // mushroom houses: a fat stalk with a door, a spotted cap
  for (const [dx, dz] of [
    [-20, -8],
    [-22, 7],
    [21, 8],
  ]) {
    const f = R.frame(...P(dx, dz), 0);
    f.cyl(0xe8e0cc, 0, 0, 0, 2.3, 3.4).ball(0xc84a4a, 0, 3.6, 0, 3.4, 0.5).box(0x6a4a2a, 0, 0, 2.25, 1, 1.9, 0.1).box(0xffd98a, 1.2, 1.6, 2.1, 0.7, 0.6, 0.1);
    for (let k = 0; k < 5; k++) f.ball(0xf6f2e6, Math.cos(k * 1.3) * 2, 4.4, Math.sin(k * 1.3) * 2, 0.35, 0.4);
  }
  // mushrooms all over the plain, three sizes
  for (let i = 0; i < 46; i++) {
    const dx = ((i * 53) % 66) - 33;
    const dz = ((i * 29) % 46) - 23;
    if (Math.abs(dx) < 8 && dz > -12) continue;
    if (Math.abs(dx) < 9 && dz < -13) continue;
    const s = [0.4, 0.8, 1.4][i % 3];
    R.frame(...P(dx, dz), 0, { list: 'fixed' }).cyl(0xe8e0cc, 0, 0, 0, 0.12 * s, 0.7 * s).ball([0x4a8ad8, 0xd84a8a, 0x8a4ad8][i % 3], 0, 0.7 * s, 0, 0.55 * s, 0.5);
  }

  // the sky's ring of rocks and the two moons, far off over the plain
  const sky = R.frame(...P(0, -200), 0, { list: 'fixed' });
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI;
    sky.ball(0x8a8aa8, Math.cos(a) * 260, 40 + Math.sin(a) * 90, -Math.sin(a) * 40, 2 + (i % 4), 0.7);
  }
  R.frame(...P(-70, -220), 0, { list: 'fixed' }).glow(BALL, 0xe8e8f8, 1.1, 0, 110, 0, 0, 28);
  R.frame(...P(90, -260), 0, { list: 'fixed' }).glow(BALL, 0xc8d8f8, 1.0, 0, 70, 0, 0, 16);
  // lamps on posts round the gathering
  for (const dx of [-6, 6]) R.frame(...P(dx, -7), 0).cyl(0x3a3a4a, 0, 0, 0, 0.08, 3).glow(CYL, 0x9adcff, 1.5, 0, 3, 0, 0, 0.5, 0.3, 0.5);

  // the king, to cheer a claim told; and the rally hops with him
  let king = null;
  S.people({ who: { flippynips: { onPlace: (c) => (king = c) } } });
  let told = 0;
  const area = S.done(LIGHT, () => {
    const n = S.taken().length;
    if (n > told) {
      area.actions.hop?.();
      king?.play?.('cheer', { hold: 0.2 });
    }
    told = n;
  });
  return area;
}
