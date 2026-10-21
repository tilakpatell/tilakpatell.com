// Nuptia 4 ("Big Trouble in Little Sanchez"): the couples' retreat on a
// cliff above the clouds, violet grass and white pillars with lamps, a dais
// where Glexo Slim Slom receives, the machine beside it (a model), the edge
// where the cloud begins, and the mythologs on the lawn (models, hunting
// whoever comes close: ./destinations.js, stage.js's NPC behaviour).

import * as THREE from 'three';
import { BALL, fitText } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xfff0e0, 1.05], hemi: [0xd8b0f0, 0x5a3a7a, 1.5], fog: [0xe0c0e8, 50, 260] };

export async function buildNuptia(kit) {
  const S = stage(kit, 'nuptia', { ground: specks('#8a6ab8', ['#7a5aa8', '#9a7ac8', '#a88ad0'], 19, 1400, 2), groundTile: 6 });
  const { R, P, A } = S;

  // the cloud beyond the edge, a soft white plane from the rail out past the
  // fog (over the world's ground, which runs out under it), and the cliff's lip
  const CLOUD = { w: 900, d: 600 };
  const cloud = new THREE.Mesh(R.own(new THREE.PlaneGeometry(CLOUD.w, CLOUD.d)), R.own(new THREE.MeshBasicMaterial({ color: 0xf6f0ff })));
  cloud.rotation.x = -Math.PI / 2;
  cloud.position.set(P(0, 0)[0], 0.03, A.z0 - CLOUD.d / 2);
  R.add(cloud, { ink: false });
  R.frame(...P(0, -21.6), 0, { list: 'fixed' }).box(0x6a4a8a, 0, 0, 0, A.x1 - A.x0, 0.12, 0.6);
  // the pillars, white with a lamp each
  for (const [dx, dz] of [
    [-12, -16],
    [12, -16],
    [-24, 10],
    [24, 10],
  ]) R.frame(...P(dx, dz), 0).cyl(0xf6f2ff, 0, 0, 0, 0.8, 5).cyl(0xd8c8f0, 0, 5, 0, 1, 0.3).glow(BALL, 0x9ad8ff, 1.5, 0, 5.7, 0, 0, 0.45);
  // the dais
  R.frame(...P(0, -13.4), 0).cyl(0xf6f2ff, 0, 0, 0, 1.6, 0.4).cyl(0xd8c8f0, 0, 0.4, 0, 1.3, 0.1);
  // the sign at the way in
  R.cell('nuptiasign', 192, 64, (g, w, h) => {
    g.fillStyle = '#f6f2ff';
    g.fillRect(0, 0, w, h);
    fitText(g, 'NUPTIA 4', w / 2, h * 0.38, w - 20, 24, { color: '#6a4a8a' });
    fitText(g, 'love, scanned', w / 2, h * 0.76, w - 20, 11, { color: '#4a3a5a', weight: '400' });
  });
  R.frame(...P(6, 17), Math.PI).box(0xd8c8f0, 0, 0, 0, 0.14, 1.9, 0.14).box(0xf6f2ff, 0, 1.6, 0, 2.2, 0.8, 0.08).decal('nuptiasign', 0, 2, 0.05, 2.1, 0.75);
  // flower beds, dots of colour
  for (let k = 0; k < 24; k++) R.frame(...P(-30 + (k * 13) % 60, 6 + ((k * 7) % 9)), 0, { list: 'fixed' }).ball([0xff6ab0, 0xffe24a, 0x6ad8ff][k % 3], 0, 0.1, 0, 0.18);

  S.people();
  return S.done(LIGHT, () => {});
}
