// The Microverse ("The Ricks Must Be Crazy"): Zeep Xanflorp's lab inside the
// car's battery, a round-cornered hall of white and green panels; the
// Miniverse battery, a glowing green cylinder, in the middle with Kyle beside
// it till he's been met; Zeep at his console; the gooble boxes the people
// stomp on to make the power, against the west wall; and a long window on
// the Microverse city's white towers. It's a game of the power kind
// (../games/power.js, the row's `power`): Zeep's cells carried to the gooble
// boxes before the world's charge runs down, the battery's glow dimming with
// the charge.

import * as THREE from 'three';
import { BALL, CYL } from '../interiors/shell';
import { mergeParts } from '../kit';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xeafff0, 0.75], hemi: [0xeafff2, 0x5a7a66, 1.8], fog: null, background: 0x0c1a12 };

export async function buildMicroverse(kit) {
  const S = stage(kit, 'microverse', { floor: specks('#e8efe8', ['#dbe4dc', '#f2f6f2']), wall: 0xeef3ee, ceiling: 0xf4f8f4, skirt: 0x2f8a52 });
  const { R, P, A } = S;

  // green bands round the walls, and panel seams
  const H = S.d.ceiling;
  for (const z of [A.z0 + 0.12, A.z1 - 0.12]) for (const y of [1.1, H - 0.6]) R.frame((A.x0 + A.x1) / 2, z, 0, { list: 'fixed' }).box(0x3fb46a, 0, y, 0, A.x1 - A.x0 - 0.24, 0.14, 0.06);
  for (const x of [A.x0 + 0.12, A.x1 - 0.12]) for (const y of [1.1, H - 0.6]) R.frame(x, (A.z0 + A.z1) / 2, 0, { list: 'fixed' }).box(0x3fb46a, 0, y, 0, 0.06, 0.14, A.z1 - A.z0);

  // the battery: a glass cylinder of green light on a white plinth, cabled to
  // the ceiling; its light (and inside it the world it holds, a tiny green
  // planet) in a mesh of its own, for the charge to dim
  const [bx, bz] = P(2, -2.7);
  const b = R.frame(bx, bz, 0);
  b.cyl(0xf2f6f2, 0, 0, 0, 1.25, 0.5).cyl(0xd8e2da, 0, H - 0.4, 0, 1.0, 0.4);
  for (const a of [0, 2.1, 4.2]) b.cyl(0x2a3a30, Math.cos(a) * 0.9, 3.8, Math.sin(a) * 0.9, 0.06, H - 3.8);
  const lit = [];
  R.frame(bx, bz, 0, { glows: lit }).glow(CYL, 0x6dff8a, 1.8, 0, 2.1, 0, 0, 1.6, 3.2, 1.6).glow(BALL, 0xb6ffb0, 2.4, 0, 2.1, 0, 0, 0.7);
  const charge = new THREE.Mesh(R.own(mergeParts(lit)), R.own(new THREE.MeshBasicMaterial({ vertexColors: true })));
  R.add(charge, { ink: false });
  S.power({ glow: charge });

  // Zeep's console: a long desk of screens
  const [kx, kz] = P(-1.5, -6.6);
  const c = R.frame(kx, kz, 0);
  c.box(0xf2f6f2, 0, 0, 0, 3.4, 0.95, 0.9).box(0x2f8a52, 0, 0.95, 0, 3.4, 0.05, 0.9);
  for (const u of [-1.1, 0, 1.1]) c.box(0x1a2a20, u, 1.05, -0.3, 0.9, 0.62, 0.06).glow(CYL, 0x7affc0, 1.3, u, 1.36, -0.26, 0, 0.8, 0.02, 0.5, Math.PI / 2);

  // the gooble boxes: rows of grey boxes with green buttons on top, stomped flat in places
  const [gx, gz] = P(-8.8, 1);
  const gb = R.frame(gx, gz, 0);
  for (let i = 0; i < 4; i++) gb.box(0x8a9a90, 0, 0, -1.6 + i * 1.07, 1.2, i === 2 ? 0.55 : 0.8, 0.9).cyl(0x3fd46a, 0, i === 2 ? 0.55 : 0.8, -1.6 + i * 1.07, 0.18, 0.06);

  // the window on the Microverse city: white towers against a green sky
  R.cell('microcity', 256, 96, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2f8a52');
    sky.addColorStop(1, '#bff2c8');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const x = (i * 37) % w;
      const tw = 10 + ((i * 13) % 14);
      const th = 30 + ((i * 29) % 50);
      g.fillStyle = i % 3 ? '#f2f6f2' : '#dbe8de';
      g.fillRect(x, h - th, tw, th);
      g.fillStyle = '#3fb46a';
      g.fillRect(x + 2, h - th + 4, tw - 4, 2);
    }
  });
  R.frame(...P(0, -7.86), 0, { list: 'fixed' }).box(0xd8e2da, 0, 1.4, 0, 9.4, 2.2, 0.12).decal('microcity', 0, 2.5, 0.08, 9, 2, { bright: true });

  S.people();
  return S.done(LIGHT);
}
