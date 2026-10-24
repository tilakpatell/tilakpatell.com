// Gear World ("Auto Erotic Assimilation"'s neighbour, Gearhead's home in
// "Mortynight Run"): a brass and copper city on the face of a vast cog under
// an amber sky; towers of stacked gears, Gearhead's shop at the west with him
// at its door, a great wheel beside the square, cog-shaped lamps, gear people
// about and the gear police on their beats. The city stands still till it's
// wound: each tower's crank and the great wheel are the sequence's cogs
// (../games/sequence.js), and a cog wound in its turn sets its stack turning
// (a wrong one stops them all); once the task's done, the whole city turns.
// Gearhead's sign always does.

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { litSets } from '../games/sequence';
import { stage } from './stage';

const LIGHT = { sun: [0xffe2b0, 1.7], hemi: [0xffd8a0, 0x5a3a1a, 1.25], fog: [0xc98a4a, 60, 300] };

// the cog painted on the ground: rings of brass plate and rivets
const COG = (g, w, h) => {
  g.fillStyle = '#9a7a4a';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#7a5a32';
  g.lineWidth = 3;
  for (let y = 0; y < h; y += 32) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.fillStyle = '#c8a26a';
  for (let y = 16; y < h; y += 32) for (let x = 8; x < w; x += 24) g.fillRect(x, y - 2, 4, 4);
};

// a gear: a toothed wheel as one geometry, lying flat (y up), radius r, `teeth` of them
function gearGeo(r, teeth, thick) {
  const s = new THREE.Shape();
  const inner = r * 0.86;
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2;
    const rr = i % 4 < 2 ? r : inner;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.25, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2);
}

export async function buildGearworld(kit) {
  const S = stage(kit, 'gearworld', { ground: COG, groundTile: 8 });
  const { R, P } = S;

  // the towers: stacks of gears, each layer turning its own way once its
  // cog's wound (`spins`: a cog's id to its meshes, their speeds and the axis
  // they turn on), and by each its crank, a little wheel on a post
  const spins = {};
  const brass = [0xc8a24a, 0xb87a3a, 0xd8b86a, 0x9a6a3a];
  const crank = R.own(gearGeo(0.45, 8, 0.12).rotateX(Math.PI / 2));
  const at = (id) => S.d.hotspots.find((h) => h.id === id);
  const tower = (dx, dz, r, layers, cog) => {
    const [x, z] = P(dx, dz);
    const list = (spins[cog] = []);
    for (let i = 0; i < layers; i++) {
      const rr = r * (1 - i * 0.12);
      const geo = R.own(gearGeo(rr, 10 + Math.round(rr * 2), 1.4));
      const m = new THREE.Mesh(geo, kit.mats.toon(brass[i % brass.length]));
      m.position.set(x, i * 1.6, z);
      R.add(m);
      list.push([m, (i % 2 ? 1 : -1) * (0.15 + 0.4 / rr), 'y']);
      R.frame(x, z, 0).cyl(0x5a3a1a, 0, i * 1.6, 0, rr * 0.3, 1.6);
    }
    const h = at(cog);
    R.frame(h.x, h.z, 0).cyl(0x5a3a1a, 0, 0, 0, 0.1, 1.3).box(0x7a4a22, 0, 0, 0, 0.6, 0.12, 0.6);
    const w = new THREE.Mesh(crank, kit.mats.toon(0xe8c84a));
    w.position.set(h.x, 1.45, h.z);
    R.add(w);
    list.push([w, 1.6, 'z']);
  };
  tower(-22, -12, 5, 6, 'gcog-nw');
  tower(22, -14, 6, 8, 'gcog-ne');
  tower(23, 7, 4, 5, 'gcog-se');
  tower(-23, 8, 4, 4, 'gcog-sw');
  // the great wheel by the square, upright, the first cog of the city
  const [wx, wz] = P(9, -12);
  const wheel = new THREE.Mesh(R.own(gearGeo(3.2, 14, 0.6).rotateX(Math.PI / 2)), kit.mats.toon(0xd8b86a));
  wheel.position.set(wx, 3.4, wz);
  R.add(wheel);
  spins.cogs = [[wheel, 0.3, 'z']];
  R.frame(wx, wz, 0).box(0x5a3a1a, -0.6, 0, 0, 0.3, 3.4, 0.3).box(0x5a3a1a, 0.6, 0, 0, 0.3, 3.4, 0.3);

  // Gearhead's shop: a copper front, a big gear over the door, a window of cogs
  const [sx, sz] = P(-7, -11.5);
  const shop = R.frame(sx, sz, 0);
  shop.box(0xb87a3a, 0, 0, 0, 8, 4.2, 5).box(0x7a4a22, 0, 4.2, 0, 8.4, 0.4, 5.4).box(0x3a2a1a, -1.8, 0, 2.52, 1.3, 2.4, 0.08).box(0xffd98a, 1.6, 1.2, 2.52, 2.6, 1.6, 0.06);
  const sign = new THREE.Mesh(R.own(gearGeo(1.1, 10, 0.25).rotateX(Math.PI / 2)), kit.mats.toon(0xe8c84a));
  sign.position.set(sx, 4.9, sz + 2.6);
  R.add(sign);

  // lamps: posts with a little gear for a shade, lit
  for (const [dx, dz] of [
    [-4, 4],
    [6, 4],
    [-14, -3],
    [14, -4],
  ])
    R.frame(...P(dx, dz), 0).cyl(0x5a3a1a, 0, 0, 0, 0.08, 3).cyl(0xc8a24a, 0, 3, 0, 0.45, 0.12).glow(BALL, 0xffd890, 1.5, 0, 2.8, 0, 0, 0.3);

  S.people();
  const items = S.d.sequence.items;
  const area = S.done(LIGHT, (t, dt, state) => {
    const lit = litSets({ items, ...area.actions.sequence() }, (state?.done ?? []).includes('gearworld'));
    for (const cog of lit) for (const [m, w, axis] of spins[cog]) m.rotation[axis] += w * dt;
    sign.rotation.y += 0.6 * dt;
  });
  return area;
}
