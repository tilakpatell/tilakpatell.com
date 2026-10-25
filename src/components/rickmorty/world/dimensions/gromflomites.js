// The Gromflomite base ("Mortynight Run"): a Federation hangar in their
// green steel, crates stacked about (they slow a guard round them; they
// don't hide Morty), the guards' lockers, a screen in their script, and at
// the far end the cell with Fart in it, its door sliding open when Morty gets
// there (the area's 'opened'). Krombopulos Michael waits by the way in. The
// guards walk their rounds (./destinations.js; stage.js's NPC behaviour) and
// go for him once he's near enough to see.

import * as THREE from 'three';
import { BALL, BOX, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xe8ffe8, 0.75], hemi: [0xc8f0d8, 0x2a3a30, 1.9], fog: null, background: 0x0a140e };
const STEEL = 0x4a6a5a;
const DARK = 0x2a3a32;

export async function buildGromflomites(kit) {
  const S = stage(kit, 'gromflomites', { floor: specks('#3a4a42', ['#34443c', '#405048'], 9, 900, 2), floorTile: 3, wall: STEEL, ceiling: DARK, skirt: 0x1a2a22 });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const W = A.x1 - A.x0;

  // ribs and ceiling strips
  for (let dz = -16; dz <= 16; dz += 4) for (const x of [A.x0 + 0.2, A.x1 - 0.2]) R.frame(x, P(0, dz)[1], 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.4, H, 0.5);
  for (let dz = -12; dz <= 12; dz += 6) R.frame(...P(0, dz), 0, { list: 'fixed' }).box(DARK, 0, H - 0.4, 0, W - 1, 0.3, 0.5).glow(BOX, 0x9affc0, 1.4, 0, H - 0.44, 0, 0, W - 2, 0.04, 0.25);
  // crates: green steel, a Federation mark on each
  R.cell('fedmark', 64, 64, (g, w, h) => {
    g.fillStyle = '#4a6a5a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d8ff80';
    g.lineWidth = 5;
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#d8ff80';
    g.fillRect(w / 2 - 3, h * 0.2, 6, h * 0.6);
  });
  for (const [dx, dz, w, d] of [
    [-6, 0, 2.6, 2.6],
    [6, 0, 2.6, 2.6],
    [0, -6, 3.2, 2],
    [-12, -6, 2, 2],
    [12, 6, 2, 2],
  ]) {
    const f = R.frame(...P(dx, dz), 0);
    f.box(STEEL, 0, 0, 0, w, 1.7, d).box(DARK, 0, 1.7, 0, w + 0.1, 0.1, d + 0.1).decal('fedmark', 0, 0.9, d / 2 + 0.03, 0.8, 0.8);
  }
  // the lockers along the west wall
  for (let dz = -5.5; dz <= 1.5; dz += 1) R.frame(...P(-18.6, dz), Math.PI / 2).box(0x5a7a6a, 0, 0, 0, 0.9, 2.2, 1.1).box(0x2a3a32, 0, 1, 0.56, 0.5, 0.04, 0.04);
  // the screen on the east wall
  R.cell('fedscreen', 192, 112, (g, w, h) => {
    g.fillStyle = '#061008';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#9affc0';
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.arc(w * 0.25 + (k % 2) * 16, h * 0.3 + Math.floor(k / 2) * 14, 5, 0, Math.PI * 2);
      g.fill();
    }
    fitText(g, '00:14:07', w * 0.68, h * 0.3, 60, 16, { color: '#9affc0' });
    g.strokeStyle = '#ff5a3a';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(w * 0.5, h * 0.72, 16, 0, Math.PI * 2);
    g.moveTo(w * 0.5 - 14, h * 0.72 - 14);
    g.lineTo(w * 0.5 + 14, h * 0.72 + 14);
    g.stroke();
    fitText(g, 'ʁiɔk', w * 0.5 + 40, h * 0.72, 50, 12, { color: '#ff5a3a' });
  });
  R.frame(A.x1 - 0.14, P(0, -2)[1], -Math.PI / 2, { list: 'fixed' }).box(0x0a140e, 0, 1.4, 0, 3.4, 2.2, 0.1).decal('fedscreen', 0, 2.5, 0.07, 3.2, 1.9, { bright: true });
  // the cell: a glass box on a dais, lit from below, its door a sliding pane
  const [cx, cz] = P(0, -15);
  const C = R.frame(cx, cz, 0);
  C.box(DARK, 0, 0, 0, 6.4, 0.3, 4.4).glow(BOX, 0x9affc0, 1.3, 0, 0.3, 0, 0, 6, 0.04, 4);
  for (const [u, v] of [
    [-3, -2],
    [3, -2],
    [-3, 2],
    [3, 2],
  ]) C.box(0x5a7a6a, u, 0.3, v, 0.24, 3.6, 0.24);
  C.box(0x5a7a6a, 0, 3.9, 0, 6.4, 0.2, 4.4);
  const glass = R.own(new THREE.MeshBasicMaterial({ color: 0x9affc0, transparent: true, opacity: 0.18, depthWrite: false }));
  for (const [u, v, w, d] of [
    [0, -2, 6, 0.06],
    [-3, 0, 0.06, 4],
    [3, 0, 0.06, 4],
  ]) {
    const pane = new THREE.Mesh(BOX, glass);
    pane.position.set(cx + u, 2.1, cz + v);
    pane.scale.set(w, 3.6, d);
    R.add(pane, { ink: false });
  }
  const door = new THREE.Mesh(BOX, glass);
  door.position.set(cx, 2.1, cz + 2);
  door.scale.set(6, 3.6, 0.06);
  R.add(door, { ink: false });
  for (let k = 0; k < 3; k++) C.glow(BALL, 0xff5a3a, 1.5, -0.6 + k * 0.6, 3.95, 2.1, 0, 0.08);

  S.people();
  let opened = false;
  const area = S.done(LIGHT, (t, dt) => {
    // the door slides up into the frame once opened, and comes back when the place settles
    const want = opened ? 5.9 : 2.1;
    door.position.y += (want - door.position.y) * Math.min(1, dt * 3);
  });
  area.actions = {
    ...area.actions,
    opened: () => {
      opened = true;
    },
    calm: () => {
      opened = false;
      S.calm();
    },
  };
  return area;
}
