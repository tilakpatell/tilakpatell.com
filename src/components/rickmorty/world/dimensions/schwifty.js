// The Get Schwifty show ("Get Schwifty"): a stage in a stadium at dusk, amps
// and light towers, the mic at the front, and the Cromulon heads filling the
// sky (the site's own cromulon model, far off and huge: ./destinations.js's
// extras). Water-T and Ice-T are models placed from the data. The stadium
// round it, its stands and the audience packed into the pit either side of
// the aisle, are its world's (./worlds.js).

import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffb060, 0.9], hemi: [0x6a5ab8, 0x2a1a3a, 1.4], fog: [0x4a3a6a, 80, 320] };

export async function buildSchwifty(kit) {
  const S = stage(kit, 'schwifty', { ground: specks('#4a6a3a', ['#3e5a32', '#567a44'], 11, 1600, 2), groundTile: 6 });
  const { R, P } = S;

  // the stage: a black deck with a lit edge, a back wall with the show's name
  const [sx, sz] = P(0, -14);
  R.frame(sx, sz, 0).box(0x1a1a22, 0, 0, 0, 30, 1, 6).glow(BOX, 0xff6ab0, 1.4, 0, 1.02, 3, 0, 30, 0.04, 0.1);
  R.cell('schwiftysign', 256, 64, (g, w, h) => {
    g.fillStyle = '#1a1a22';
    g.fillRect(0, 0, w, h);
    fitText(g, 'PLANET MUSIC', w / 2, h * 0.4, w - 24, 26, { color: '#ff6ab0' });
    fitText(g, 'show me what you got', w / 2, h * 0.78, w - 24, 12, { color: '#ffe24a', weight: '400' });
  });
  R.frame(...P(0, -17.4), 0, { list: 'fixed' }).box(0x1a1a22, 0, 1, 0, 30, 7, 0.4).decal('schwiftysign', 0, 5.6, 0.22, 16, 3.6, { bright: true });
  // the mic, the amps, the light towers
  R.frame(...P(0, -11), 0).cyl(0x2a2a30, 0, 1, 0, 0.03, 1.4).ball(0x9a9aa8, 0, 2.45, 0, 0.1).cyl(0x2a2a30, 0, 1, 0, 0.3, 0.04);
  for (const dx of [-12, 12]) R.frame(...P(dx, -13), 0).box(0x111118, 0, 1, 0, 2, 1.6, 1.6).box(0x2a2a30, 0, 1.2, 0.81, 1.6, 1.2, 0.04).glow(BALL, 0xff3a3a, 1.6, 0.7, 2.4, 0.82, 0, 0.06);
  for (const dx of [-20, 20]) {
    const f = R.frame(...P(dx, -16), 0);
    f.box(0x3a3a44, 0, 0, 0, 0.8, 12, 0.8);
    for (let k = 0; k < 4; k++) f.glow(BALL, [0xff6ab0, 0xffe24a, 0x6ad8ff, 0x9aff6a][k], 1.8, -0.9 + k * 0.6, 11.4, 0.5, 0, 0.3);
  }
  S.people();
  return S.done(LIGHT, () => {});
}
