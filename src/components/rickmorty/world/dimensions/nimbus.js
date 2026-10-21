// Mr. Nimbus's beach ("Mort Dinner Rick Andre"): pale sand running down to
// the sea, which moves; black rocks, a palm or two, and the shell throne
// where the king of the ocean sits, the treaty carved on a slab beside it.
// Mr. Nimbus and his Atlantean guard are models placed from
// ./destinations.js (the guard goes for anyone near the throne).

import * as THREE from 'three';
import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff4e0, 1.25], hemi: [0xbfe4ff, 0xc8b088, 1.4], fog: [0xbfe0f8, 70, 300] };

export async function buildNimbus(kit) {
  const S = stage(kit, 'nimbus', { ground: specks('#f0dca8', ['#e8d09a', '#f6e4b8', '#d8c090'], 41, 1800, 1.6), groundTile: 5 });
  const { R, P } = S;

  // the sea, from the throne's line north to the horizon (out past the
  // world's ground and its fog, Atlantis standing in it), its surface sliding
  const SEA = { w: 900, d: 600 };
  const seaMat = R.own(new THREE.MeshBasicMaterial({ color: 0x2a8ac8, transparent: true, opacity: 0.92 }));
  const sea = new THREE.Mesh(R.own(new THREE.PlaneGeometry(SEA.w, SEA.d)), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(P(0, 0)[0], 0.04, P(0, -19)[1] - SEA.d / 2);
  R.add(sea, { ink: false });
  const foamMat = R.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
  const foam = new THREE.Mesh(R.own(new THREE.PlaneGeometry(SEA.w, 1.2)), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(P(0, 0)[0], 0.06, P(0, -19)[1]);
  R.add(foam, { ink: false });
  // the rocks, black and wet
  for (const [dx, dz, r] of [
    [-22, -12, 3],
    [24, -14, 3.4],
    [26, 12, 2],
    [-28, 4, 1.6],
  ]) R.frame(...P(dx, dz), 0).ball(0x2a2e34, 0, 0, 0, r, 0.7).ball(0x3a4048, r * 0.4, 0.2, r * 0.3, r * 0.6, 0.6);
  // palms
  for (const [dx, dz] of [
    [-18, 12],
    [20, 14],
  ]) {
    const f = R.frame(...P(dx, dz), 0);
    f.cyl(0x8a6a4a, 0, 0, 0, 0.3, 6, 0, 0.12);
    for (let k = 0; k < 6; k++) f.box(0x3aa85a, Math.cos((k / 6) * Math.PI * 2) * 1.6, 5.8, Math.sin((k / 6) * Math.PI * 2) * 1.6, 3.2, 0.1, 0.8, (k / 6) * Math.PI * 2 + Math.PI / 2, 0, 0.5);
  }
  // the throne: a great shell on a dais of coral, and the treaty slab
  const T = R.frame(...P(0, -16.6), 0);
  T.cyl(0xff9a8a, 0, 0, 0, 2.2, 0.5).cyl(0xf6e0c0, 0, 0.5, 0, 1.2, 0.5);
  T.ball(0xf6e8d8, 0, 1.6, -0.6, 1.6, 1.1).box(0xf6e8d8, 0, 0.9, 0.2, 1.8, 0.3, 1.4);
  for (let k = 0; k < 5; k++) T.box(0xe8d0b8, -1.2 + k * 0.6, 1.4, -0.9, 0.12, 1.6 + (k === 2 ? 0.6 : 0), 0.2, 0, -0.2);
  T.glow(BALL, 0x6ad8ff, 1.4, 0, 2.9, -0.4, 0, 0.3);
  R.cell('treaty', 128, 160, (g, w, h) => {
    g.fillStyle = '#9aa0a8';
    g.fillRect(0, 0, w, h);
    fitText(g, 'THE TREATY', w / 2, 18, w - 12, 14, { color: '#2a2e34' });
    const lines = ['LAND: land', 'SEA: sea', 'RICK: out', '', '~ Ψ  ⌂'];
    for (const [i, l] of lines.entries()) fitText(g, l, w / 2, 44 + i * 20, w - 16, 11, { color: '#2a2e34', weight: '400' });
  });
  R.frame(...P(-4, -16), 0).box(0x9aa0a8, 0, 0, 0, 1.4, 1.9, 0.3, 0, 0, 0.05).decal('treaty', 0, 1, 0.16, 1.2, 1.6);
  // shells about the sand
  for (const [dx, dz, c] of [
    [16, 10, 0xffd0c0],
    [-8, 8, 0xf6e8d8],
    [8, 14, 0xffe0b0],
    [-14, -2, 0xf0d8e8],
  ]) R.frame(...P(dx, dz), 0, { list: 'fixed' }).ball(c, 0, 0, 0, 0.3, 0.5);

  S.people();
  return S.done(LIGHT, (t) => {
    sea.position.z = P(0, -19)[1] - SEA.d / 2 + Math.sin(t * 0.5) * 0.6;
    foam.position.z = P(0, -19)[1] + Math.sin(t * 0.5) * 0.6;
    foamMat.opacity = 0.45 + 0.3 * Math.max(0, Math.sin(t * 0.5));
  });
}
