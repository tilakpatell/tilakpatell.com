// The Vindicators' ship ("Vindicators 3: The Return of Worldender"), the
// morning after: the hall of white and blue panels, the round holo-table
// with a stain on it Noob-Noob has been mopping, the ship itself turning in
// the table's light as a hologram, the beacon on its plinth, the team's
// portraits along the north wall, stars through the long windows, and the
// door Rick has scrawled on, to the rooms he left them (RmWorld asks them:
// ./vindicatorsRules.js). The six of them stand about the hall.

import { BALL, CYL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xeaf2ff, 0.8], hemi: [0xeaf2ff, 0x4a5a7a, 1.8], fog: null, background: 0x0a1020 };
const PANEL = 0xeef2f8;
const BLUE = 0x2a4a8a;
const ORANGE = 0xf08a2a;

// the team's emblem: an orange V in a ring
const EMBLEM = (g, w, h) => {
  g.fillStyle = '#1a2a4a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f08a2a';
  g.lineWidth = w * 0.08;
  g.beginPath();
  g.arc(w / 2, h / 2, w * 0.36, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(w * 0.3, h * 0.32);
  g.lineTo(w / 2, h * 0.7);
  g.lineTo(w * 0.7, h * 0.32);
  g.stroke();
};
// a portrait: the member's colours as a bust, on the team's blue
const portrait = (body, head) => (g, w, h) => {
  g.fillStyle = '#d8e2f2';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a4a8a';
  g.fillRect(4, 4, w - 8, h - 8);
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(w / 2, h * 0.95, w * 0.34, h * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = head;
  g.beginPath();
  g.ellipse(w / 2, h * 0.42, w * 0.18, h * 0.16, 0, 0, Math.PI * 2);
  g.fill();
};
const PORTRAITS = [
  ['vance', '#3a6ac8', '#f2c8a0'],
  ['supernova', '#4a2a8a', '#b89ae8'],
  ['alanrails', '#2a2a2a', '#7a4a2a'],
  ['millionants', '#8a2a22', '#8a2a22'],
  ['crocubot', '#9aa8b8', '#c8a85a'],
  ['noobnoob', '#e8b8d8', '#f6d8c8'],
];

export async function buildVindicators(kit) {
  const S = stage(kit, 'vindicators', { floor: specks('#d8dfe8', ['#cdd5e0', '#e2e8f0']), floorTile: 3, wall: PANEL, ceiling: 0xf2f6fb, skirt: BLUE });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // blue bands and panel seams round the hall
  for (const z of [A.z0 + 0.12, A.z1 - 0.12]) for (const y of [0.9, H - 0.7]) R.frame((A.x0 + A.x1) / 2, z, 0, { list: 'fixed' }).box(BLUE, 0, y, 0, A.x1 - A.x0 - 0.24, 0.16, 0.06);
  for (const x of [A.x0 + 0.12, A.x1 - 0.12]) for (const y of [0.9, H - 0.7]) R.frame(x, (A.z0 + A.z1) / 2, 0, { list: 'fixed' }).box(BLUE, 0, y, 0, 0.06, 0.16, A.z1 - A.z0);
  for (let dx = -9; dx <= 9; dx += 3) R.frame(...P(dx, 0), 0, { list: 'fixed' }).box(0xd8e0ea, 0, H - 0.3, 0, 0.3, 0.3, A.z1 - A.z0);

  // the holo-table: a round white table, its top glowing, and the stain
  const [tx, tz] = P(0, -1.4);
  const t = R.frame(tx, tz, 0);
  t.cyl(PANEL, 0, 0, 0, 1.2, 0.95).cyl(0xc8d2e0, 0, 0.95, 0, 1.9, 0.08).glow(CYL, 0x6ad8ff, 1.2, 0, 1.04, 0, 0, 3.4, 0.02, 3.4);
  t.ball(0x6a4a2a, 0.5, 1.06, 0.3, 0.55, 0.04).ball(0x7a5a32, 0.1, 1.06, 0.6, 0.35, 0.04);
  // a mop and bucket where Noob-Noob left them
  R.frame(...P(-4.6, 3.6), 0.5).cyl(0xe8c84a, 0, 0, 0, 0.26, 0.4).cyl(0x8a6a4a, 0.3, 0, 0.1, 0.03, 1.4, 0, -0.25).ball(0xd8d0b8, 0.12, 0.08, 0.1, 0.16, 0.6);

  // the ship over the table, a hologram turning in its light
  let ship = null;
  S.figure('vindicators-ship', { x: tx, z: tz, y: 1.7, face: 0, h: 0.9, onPlace: (c) => (ship = c.group) });

  // the beacon: a plinth with the emblem glowing on top
  R.cell('vindemblem', 128, 128, EMBLEM);
  const b = R.frame(...P(9.6, -9), -Math.PI / 4);
  b.cyl(PANEL, 0, 0, 0, 0.55, 1.1).cyl(BLUE, 0, 1.1, 0, 0.6, 0.1).glow(BALL, ORANGE, 1.8, 0, 1.5, 0, 0, 0.5);
  // the emblem on the north wall, between the portraits
  R.frame(...P(0, -9.86), 0, { list: 'fixed' }).decal('vindemblem', 0, 4.1, 0.06, 1.6, 1.6);
  for (const [n, [id, body, head]] of PORTRAITS.entries()) {
    R.cell(`vind-${id}`, 64, 80, portrait(body, head));
    const dx = (n < 3 ? -7.6 : 2.6) + (n % 3) * 2.5;
    R.frame(...P(dx, -9.86), 0, { list: 'fixed' }).box(0xc8d2e0, 0, 2.6, 0, 1.6, 2, 0.06).decal(`vind-${id}`, 0, 3.6, 0.05, 1.4, 1.8);
  }
  // (the long window on the stars, in the east wall, is its world's: ./worlds.js)

  // the door to Rick's rooms, on the west wall, his scrawl taped over it
  R.cell('ricksrooms', 160, 64, (g, w, h) => {
    g.fillStyle = '#f6f2e0';
    g.fillRect(0, 0, w, h);
    fitText(g, 'RICK’S ROOMS', w / 2, h * 0.4, w - 14, 22, { color: '#b8262c', font: 'Comic Sans MS, Marker Felt, cursive' });
    fitText(g, 'good luck idiots', w / 2, h * 0.78, w - 20, 14, { color: '#2a2a2a', font: 'Comic Sans MS, Marker Felt, cursive', weight: '400' });
  });
  const d = R.frame(...P(-11.86, -6), Math.PI / 2, { list: 'fixed' });
  d.box(0x9aa8b8, 0, 0, 0, 2.2, 2.9, 0.1).box(0x5a6a7a, 0, 0, 0.04, 0.06, 2.8, 0.06).decal('ricksrooms', 0, 2.2, 0.08, 1.4, 0.56, { rz: 0.06 });
  d.glow(BALL, 0xff4a3a, 1.6, 0, 3.1, 0.1, 0, 0.22);

  S.people();
  return S.done(LIGHT, (time) => {
    if (ship) ship.rotation.y = time * 0.4;
  });
}
