// Rick Prime's fortress ("Rickmurai Jack", "Unmortricken"): a cold grey
// hangar with ribbed steel walls and a grated floor, lit from strips in the
// ceiling. The Omega Device stands on a plinth in the middle, a black sphere
// in a cage of gold rings (its Meshy model). Along the west wall the tanks of
// his spares, a Rick floating in each. His security drones patrol
// (./destinations.js's extras, stage.js's NPC behaviour): one that sees
// Morty goes for him, and caught, he's back at the way in. At the
// far end the console, Rick Prime at it till Morty gets there: then he's
// gone (`until: 'fortress'`), and a portal's swirl hangs where he stood for a
// few seconds (the area's 'gone').

import * as THREE from 'three';
import { BALL, BOX, CYL } from '../interiors/shell';
import { stage } from './stage';

const LIGHT = { sun: [0xdfe8ff, 0.9], hemi: [0xc8d8f0, 0x3a3e4a, 2.3], fog: null, background: 0x0a0c12 };
const STEEL = 0x5a6070;
const DARK = 0x2a2e38;

// a grated floor: dark plates with a grid of lighter bars
const GRATE = (g, w, h) => {
  g.fillStyle = '#3a3e48';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#4e5464';
  g.lineWidth = 3;
  for (let i = 0; i <= w; i += w / 8) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, h);
    g.moveTo(0, i);
    g.lineTo(w, i);
    g.stroke();
  }
};

export async function buildFortress(kit) {
  const S = stage(kit, 'fortress', { floor: GRATE, floorTile: 4, wall: STEEL, ceiling: DARK, skirt: DARK });
  const { R, P, A } = S;
  const H = S.d.ceiling;
  const W = A.x1 - A.x0;

  // ribs up the walls, and strip lights across the ceiling
  for (let dz = -16; dz <= 16; dz += 4) for (const x of [A.x0 + 0.2, A.x1 - 0.2]) R.frame(x, P(0, dz)[1], 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.4, H, 0.6);
  for (let dx = -18; dx <= 18; dx += 4) for (const z of [A.z0 + 0.2, A.z1 - 0.2]) R.frame(P(dx, 0)[0], z, 0, { list: 'fixed' }).box(DARK, 0, 0, 0, 0.6, H, 0.4);
  for (let dz = -14; dz <= 14; dz += 7) R.frame(...P(0, dz), 0, { list: 'fixed' }).box(DARK, 0, H - 0.4, 0, W - 1, 0.3, 0.6).glow(BOX, 0xdfe8ff, 1.5, 0, H - 0.44, 0, 0, W - 2, 0.04, 0.3);

  // the Omega Device on its plinth (its model, which has its own plinth), a
  // ring of red lights round its foot
  const [ox, oz] = P(5, -4);
  const base = R.frame(ox, oz, 0);
  base.cyl(DARK, 0, 0, 0, 1.7, 0.3);
  for (let k = 0; k < 10; k++) base.glow(BALL, 0xff3a2a, 1.6, Math.cos((k / 10) * Math.PI * 2) * 1.5, 0.32, Math.sin((k / 10) * Math.PI * 2) * 1.5, 0, 0.12);
  let omega = null;
  S.figure('omegadevice', { x: ox, z: oz, y: 0.3, face: -Math.PI / 2, h: 3.4, onPlace: (c) => (omega = c.group) });

  // the tanks along the west wall: glass tubes on dark bases, a Rick in each, lit cyan
  const tubeMat = R.own(new THREE.MeshBasicMaterial({ color: 0x6ad8ff, transparent: true, opacity: 0.22, depthWrite: false }));
  const tubeGeo = R.own(new THREE.CylinderGeometry(0.95, 0.95, 3, 20, 1, true));
  const ricks = [];
  for (const dz of [-10, -6, -2, 2, 6, 10]) {
    const [x, z] = P(-18.2, dz);
    const f = R.frame(x, z, 0);
    f.cyl(DARK, 0, 0, 0, 1.1, 0.5).cyl(DARK, 0, 3.5, 0, 1.1, 0.4).glow(CYL, 0x6ad8ff, 1.3, 0, 0.5, 0, 0, 2, 0.02, 2);
    for (let k = 0; k < 3; k++) f.glow(BALL, k ? 0x6aff8a : 0xff5a3a, 1.5, -0.6 + k * 0.6, 3.95, 0.9, 0, 0.08);
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.set(x, 2, z);
    R.add(tube, { ink: false });
    // the spare: a Rick, floating in it, asleep (no flask to reach for in a tank)
    S.figure('rick', {
      x,
      z,
      y: 0.55,
      h: 2.0,
      face: -Math.PI / 2,
      onPlace: (c) => {
        c.anim?.idles(null);
        ricks.push(c.group);
      },
    });
  }

  // the console at the far end, his, the screens green on black
  const [cx, cz] = P(0, -14);
  const C = R.frame(cx, cz, 0);
  C.box(DARK, 0, 0, 0, 7, 1.1, 1.6).box(STEEL, 0, 1.1, 0, 7.1, 0.08, 1.7);
  C.box(0x0a0a10, 0, 1.2, -0.5, 6.4, 1.6, 0.14, 0, -0.35);
  C.glow(BOX, 0x4aff7a, 1.3, 0, 1.6, -0.42, 0, 6, 1.2, 0.02, -0.35);
  for (let k = 0; k < 10; k++) C.glow(BALL, k % 3 ? 0x4aff7a : 0xff5a3a, 1.6, -2.7 + k * 0.6, 1.16, 0.5, 0, 0.08);
  // (over it, the north wall's long window onto space: its world's, ./worlds.js)
  // the picture on the east wall: a garage, a family, two faces scribbled out
  R.cell('prime-picture', 96, 72, (g, w, h) => {
    g.fillStyle = '#2a1a0a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2e2b8';
    g.fillRect(4, 4, w - 8, h - 8);
    g.fillStyle = '#9aa0a8';
    g.fillRect(8, h * 0.3, w - 16, h * 0.6);
    const heads = ['#f2c8a0', '#f2c8a0', '#f2c8a0'];
    for (const [i, c] of heads.entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(w * (0.3 + i * 0.2), h * 0.5, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#111';
    g.lineWidth = 3;
    for (const i of [0, 2]) {
      const x = w * (0.3 + i * 0.2);
      g.beginPath();
      g.moveTo(x - 9, h * 0.5 - 9);
      g.lineTo(x + 9, h * 0.5 + 9);
      g.moveTo(x + 9, h * 0.5 - 9);
      g.lineTo(x - 9, h * 0.5 + 9);
      g.stroke();
    }
  });
  R.frame(A.x1 - 0.14, P(0, -8)[1], -Math.PI / 2, { list: 'fixed' }).decal('prime-picture', 0, 1.9, 0.06, 1.2, 0.9);
  // crates in the south-east corner
  R.frame(...P(14, 10), 0.2).box(STEEL, 0, 0, 0, 2.4, 1.6, 2.4).box(DARK, 0, 1.6, 0, 2.5, 0.1, 2.5);
  R.frame(...P(16.6, 8), -0.3).box(STEEL, 0, 0, 0, 1.8, 1.2, 1.8);

  // the swirl where he stood, for when he's gone
  const swirlMat = R.own(kit.portal());
  const swirl = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.6, 3)), swirlMat);
  swirl.position.set(cx, 1.6, cz + 1.6);
  swirl.visible = false;
  R.add(swirl, { ink: false });

  S.people();
  let goneAt = null;
  const area = S.done(LIGHT, (t, dt, state, camera) => {
    if (omega) omega.rotation.y = -Math.PI / 2 + Math.PI / 2 + t * 0.25;
    for (const [i, r] of ricks.entries()) r.position.y = 0.55 + Math.sin(t * 0.8 + i) * 0.12;
    if (goneAt != null) {
      const age = t - goneAt;
      swirl.visible = age < 5;
      swirlMat.uniforms.t.value = t;
      swirlMat.uniforms.open.value = age < 4 ? 1 : Math.max(0, 5 - age);
      if (camera) swirl.rotation.y = Math.atan2(camera.position.x - swirl.position.x, camera.position.z - swirl.position.z);
    }
  });
  let now = 0;
  R.tick((t) => (now = t));
  area.actions = {
    ...area.actions,
    gone: () => {
      goneAt = now;
    },
    calm: () => {
      goneAt = null;
      swirl.visible = false;
      S.calm();
    },
  };
  return area;
}
