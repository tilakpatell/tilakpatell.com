// Anatomy Park ("Anatomy Park"): inside Ruben, a red fleshy cavern with ribs
// arching overhead and red lamps glowing in it; the park's walkway of white
// rails, a kiosk, the Spleen Mountain sign; the five diseases' pens along the
// north (Meshy, every one), four of them got out and hunting the park (the
// row's people) and the plague still in its own; Dr. Xenon Bloom at the
// entrance, Poncho and Annie on the walkway, and the gate of Pirates of the
// Pancreas, the last ride, at the east end. The game is the row's: the park
// map's four pieces found while the diseases hunt, then out through the
// portal on the clock; the last piece found sets every one of them after
// Morty (as the simulation's last slip does).

import { BALL, CYL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffc0b0, 0.6], hemi: [0xff9a8a, 0x5a1a1e, 1.7], fog: [0x6a1a22, 12, 46], background: 0x2a0a0e };
const PENS = [
  ['hepatitis', -14, 2.4],
  ['gonorrhoea', -7, 2.8],
  ['tuberculosis', 0, 2.6],
  ['plague', 7, 2.1],
  ['ecoli', 14, 1.3],
];

export async function buildAnatomy(kit) {
  const S = stage(kit, 'anatomy', { floor: specks('#a8434a', ['#b85058', '#963a40', '#c25a60'], 5, 2400, 3), wall: 0xa83a44, ceiling: 0x8a2a32, skirt: 0x6a1a22 });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // the ribs: pale arches across the cavern
  const ribs = R.frame(0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const x = A.x0 + 3 + i * ((A.x1 - A.x0 - 6) / 6);
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * Math.PI;
      const z = (A.z0 + A.z1) / 2 + Math.cos(a) * (A.z1 - A.z0) * 0.48;
      ribs.ball(0xf2e2d2, x, 1 + Math.sin(a) * (H - 1.6), z, 0.45, 1.2);
    }
  }
  // fleshy lumps along the walls
  for (let i = 0; i < 22; i++) {
    const t = i / 22;
    const side = i % 2;
    const x = A.x0 + 1 + t * (A.x1 - A.x0 - 2);
    R.frame(x, side ? A.z0 + 0.6 : A.z1 - 0.6, 0, { list: 'fixed' }).ball(0xc25a62, 0, 0.6 + (i % 3) * 0.5, 0, 0.9 + (i % 4) * 0.25, 0.8);
  }

  // the walkway: a white-railed path round the park
  const rail = (x0, z0, x1, z1) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 2));
    for (let i = 0; i <= n; i++) R.frame(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, 0, { list: 'fixed' }).cyl(0xf6f2ea, 0, 0, 0, 0.05, 1);
    R.frame((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0), { list: 'fixed' }).box(0xf6f2ea, 0, 0.95, 0, Math.hypot(x1 - x0, z1 - z0), 0.08, 0.08);
  };
  const [ox, oz] = P(0, 0);
  rail(ox - 17, oz - 4.2, ox + 13, oz - 4.2);
  rail(ox - 17, oz + 4.6, ox - 4, oz + 4.6);
  R.frame(ox, oz, 0, { list: 'fixed' }).box(0xd8c8b8, -2, 0, 0, 30, 0.03, 8);

  // the pens: low glass walls on pink stone, each disease inside its own,
  // but the ones that got out (the row's hunters, by kind)
  const loose = new Map(S.d.people.filter((p) => p.ai?.hunt).map((p) => [p.who, p.id]));
  for (const [kind, dx, h] of PENS) {
    const [x, z] = P(dx, -10);
    const f = R.frame(x, z, 0);
    f.box(0xd88a90, 0, 0, 0, 5.6, 0.5, 3.6);
    f.glow(CYL, 0xbfe8ff, 0.7, 0, 1.2, 1.8, 0, 5.4, 1.4, 0.04);
    if (!loose.has(kind)) S.figure(kind, { x, z: z - 0.2, face: -Math.PI / 2, h, y: 0.5 });
  }

  // the kiosk and the Spleen Mountain sign
  const [kx, kz] = P(-14, 6);
  R.frame(kx, kz, 0).box(0xf6f2ea, 0, 0, 0, 2.2, 1.1, 2.2).box(0xff6a8a, 0, 2.4, 0, 2.5, 0.2, 2.5).cyl(0xf6f2ea, -1, 1.1, -1, 0.06, 1.3).cyl(0xf6f2ea, 1, 1.1, 1, 0.06, 1.3);
  R.cell('spleen', 192, 64, (g, w, h) => {
    g.fillStyle = '#2a8a6a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'SPLEEN MOUNTAIN', w / 2, h / 2, w - 16, 26, { color: '#fff3c8' });
  });
  R.frame(...P(-4, -12.6), 0, { list: 'fixed' }).cyl(0x6a4a2a, -2, 0, 0, 0.08, 4).cyl(0x6a4a2a, 2, 0, 0, 0.08, 4).decal('spleen', 0, 3.6, 0.06, 4.5, 1.5);

  // the gate of Pirates of the Pancreas: two posts and a skull-and-pancreas arch
  R.cell('pancreas', 192, 64, (g, w, h) => {
    g.fillStyle = '#1a1a2a';
    g.fillRect(0, 0, w, h);
    fitText(g, 'PIRATES OF THE', w / 2, 18, w - 16, 16, { color: '#ffd24a' });
    fitText(g, 'PANCREAS', w / 2, 44, w - 16, 26, { color: '#ffd24a' });
  });
  const [gx, gz] = P(16, 3);
  R.frame(gx, gz, Math.PI / 2).cyl(0x3a2a1e, -2.4, 0, 0, 0.35, 4).cyl(0x3a2a1e, 2.4, 0, 0, 0.35, 4).box(0x1a1a2a, 0, 4, 0, 5.6, 1.3, 0.3).decal('pancreas', 0, 4.65, 0.17, 5.2, 1.2, { bright: true });
  // the ride's little boat, waiting in its channel of pancreatic juice
  R.frame(gx + 2.5, gz, 0, { list: 'fixed' }).box(0xd8e86a, 0, 0, 0, 2, 0.06, 6).ball(0x8a5a2a, 0, 0.3, 0, 0.6, 0.5);

  // red lamps hung under the ribs
  for (let i = 0; i < 5; i++) R.frame(...P(-14 + i * 7, -2), 0, { list: 'fixed' }).glow(BALL, 0xff6a6a, 1.4, 0, H - 1.2, 0, 0, 0.5);

  // (the loose ones as tall as they stood in their pens)
  S.people({ who: Object.fromEntries(PENS.filter(([kind]) => loose.has(kind)).map(([kind, , h]) => [loose.get(kind), { h }])) });
  const area = S.done(LIGHT);
  area.actions = {
    ...area.actions,
    // the last piece of the map found: every one of them after him
    collected: () => S.hunt(true),
  };
  return area;
}
