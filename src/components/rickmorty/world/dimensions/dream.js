// Mr. Goldenfold's dream ("Lawnmower Dog"): a bedroom that is also a
// classroom that is also nowhere, three dreams down. A floor in a checker
// that doesn't quite line up, walls in a violet that breathes, a melting
// clock, his desk with a quiz on it, a bed to hide under, a wardrobe, a
// piano, doors painted on the walls that go nowhere, and windows on the
// dream city outside (the place's world, ./worlds.js). Scary Terry hunts
// from the start (./destinations.js; stage.js's NPC behaviour), Mrs.
// Pancakes and Mr. Goldenfold are models placed from the data.

import * as THREE from 'three';
import { BALL, fitText } from '../interiors/shell';
import { stage } from './stage';

const LIGHT = { sun: [0xd8c0ff, 0.8], hemi: [0xb89ad8, 0x3a2a4a, 1.7], fog: null, background: 0x1a0c2a };
const VIOLET = 0x5a3a7a;

const CHECKER = (g, w, h) => {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      g.fillStyle = (x + y) % 2 ? '#3a2a4a' : '#d8c8e8';
      g.fillRect((x * w) / 8 + (y % 2) * 4, (y * h) / 8, w / 8, h / 8);
    }
};

export async function buildDream(kit) {
  const S = stage(kit, 'dream', { floor: CHECKER, floorTile: 4, wall: VIOLET, ceiling: 0x2a1a3a, skirt: 0x8a6aa8 });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // the melting clock, dripping off a shelf
  const [kx, kz] = P(-12, -10);
  const K = R.frame(kx, kz, 0);
  K.box(0x6a4a2a, 0, 1.6, 0, 1.6, 0.1, 0.8).cyl(0xf6f0e0, 0, 1.7, 0, 0.5, 0.08, Math.PI / 2 - 0.4).box(0xf6f0e0, 0.3, 0.9, 0.3, 0.3, 0.9, 0.08, 0, 0, 0.2);
  R.cell('dreamclock', 64, 64, (g, w, h) => {
    g.fillStyle = '#f6f0e0';
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#2a1a1a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w / 2, h / 2);
    g.lineTo(w * 0.7, h * 0.3);
    g.moveTo(w / 2, h / 2);
    g.lineTo(w * 0.4, h * 0.75);
    g.stroke();
    fitText(g, 'WED', w / 2, h * 0.8, 30, 9, { color: '#2a1a1a' });
  });
  K.decal('dreamclock', 0, 1.74, 0.5, 0.9, 0.9, { rx: -0.9 });
  // his desk and the quiz; the bed; the wardrobe; the piano
  const [dx, dz] = P(12, -10);
  R.frame(dx, dz, 0).box(0x8a6a4a, 0, 0, 0, 3, 0.8, 1.4).box(0xf6f6f0, -0.6, 0.81, 0.2, 0.6, 0.01, 0.8).box(0xf6f6f0, 0.5, 0.81, 0, 0.6, 0.01, 0.8, 0.3);
  const [bx, bz] = P(0, 2);
  R.frame(bx, bz, 0).box(0x6a4a2a, 0, 0, 0, 2.4, 0.5, 3.6).box(0xd8e8f8, 0, 0.5, 0, 2.3, 0.3, 3.5).box(0xf6f6f6, 0, 0.8, -1.2, 1.6, 0.25, 0.7).box(0x6a4a2a, 0, 0.5, -1.78, 2.4, 0.9, 0.08);
  R.frame(...P(-16, -2), Math.PI / 2).box(0x5a3a2a, 0, 0, 0, 2.6, 2.6, 1.4).box(0x3a2a1a, 0, 0.1, 0.71, 0.04, 2.4, 0.02).ball(0xd8b25a, 0.2, 1.3, 0.72, 0.04).ball(0xd8b25a, -0.2, 1.3, 0.72, 0.04);
  const Pn = R.frame(...P(16, -2), -Math.PI / 2);
  Pn.box(0x1a1a1e, 0, 0, 0, 1.6, 1.3, 2.6).box(0xf6f6f6, 0, 0.9, 0, 1.3, 0.06, 0.1);
  for (let k = 0; k < 10; k++) Pn.box(k % 2 ? 0x111111 : 0xf6f6f6, -0.6 + k * 0.13, 0.93, -0.05 - (k % 2) * 0.1, 0.1, 0.02, k % 2 ? 0.3 : 0.5);
  // doors painted on the walls, going nowhere
  R.cell('dreamdoor', 64, 128, (g, w, h) => {
    g.fillStyle = '#3a2a1a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#6a4a2a';
    g.fillRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#d8b25a';
    g.beginPath();
    g.arc(w * 0.78, h * 0.55, 3, 0, Math.PI * 2);
    g.fill();
  });
  for (const [x, z, turn] of [
    [A.x0 + 0.14, P(0, 6)[1], Math.PI / 2],
    [A.x1 - 0.14, P(0, 8)[1], -Math.PI / 2],
    [P(-8, 0)[0], A.z0 + 0.14, 0],
  ]) R.frame(x, z, turn, { list: 'fixed' }).decal('dreamdoor', 0, 1.1, 0.06, 1, 2.2);
  // the ceiling breathes: a violet light that swells
  const breath = new THREE.PointLight(0xb87aff, 0.6, 30, 1.5);
  breath.position.set(P(0, 0)[0], H - 1, P(0, 0)[1]);
  R.group.add(breath);
  for (let k = 0; k < 6; k++) R.frame(...P(-15 + k * 6, 14), 0, { list: 'fixed' }).glow(BALL, 0xff6ab0, 1.3, 0, H - 0.6 - (k % 2) * 0.4, 0, 0, 0.2);

  S.people();
  return S.done(LIGHT, (t) => {
    breath.intensity = 0.5 + Math.sin(t * 0.7) * 0.3;
  });
}
