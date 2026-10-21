// The Purge Planet ("Look Who's Purging Now"): a farming village of cat
// people at dusk, thatched cottages, a barn, a well with Arthricia by it,
// lanterns on posts, villagers about; and the purge siren on its pole. Pulled
// (the area's 'siren' action, from RmWorld), it howls and the sky goes red;
// Morty has a minute to get back through the portal ('calm' once he's gone).

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { gablePrism } from '../kit';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffc890, 1.2], hemi: [0xb89ad8, 0x4a3a2a, 1.25], fog: [0x8a6a8a, 50, 260] };

export async function buildPurge(kit) {
  const S = stage(kit, 'purge', { ground: specks('#6a7a3a', ['#5a6a32', '#7a8a46', '#6e6a3a'], 17), groundTile: 6 });
  const { R, P } = S;

  // the cottages: white plaster, brown timbers, thick thatch
  for (const [dx, dz, turn] of [
    [-22, -10, Math.PI / 2],
    [-22, 6, Math.PI / 2],
    [18, -13, -Math.PI / 2],
    [22, 6, -Math.PI / 2],
  ]) {
    const f = R.frame(...P(dx, dz), turn);
    f.box(0xf2ead6, 0, 0, 0, 7, 3.2, 6).part(gablePrism(8, 7, 3.4), 0xc8a24a, 0, 3.2, 0);
    f.box(0x5a3a22, 0, 0, 3.02, 1.1, 2.1, 0.08).box(0xffc070, -2.2, 1.3, 3.02, 0.9, 0.8, 0.05).box(0xffc070, 2.2, 1.3, 3.02, 0.9, 0.8, 0.05);
  }
  // the barn, red, at the top of the village
  R.frame(...P(0, -19), 0).box(0x9a3a2a, 0, 0, 0, 10, 4.4, 7).part(gablePrism(10.6, 7.6, 3), 0x5a3a2a, 0, 4.4, 0).box(0x5a2a1a, 0, 0, 3.52, 3, 3.2, 0.08);
  // the well
  R.frame(...P(3, -3.4), 0).cyl(0x8a8478, 0, 0, 0, 1.05, 0.9).box(0x5a3a22, -0.9, 0, 0, 0.14, 2, 0.14).box(0x5a3a22, 0.9, 0, 0, 0.14, 2, 0.14).part(gablePrism(2.3, 1.5, 0.6), 0xc8a24a, 0, 2, 0);
  // the siren: a tall pole with a big brass horn on top and a pull lever
  R.frame(...P(-11, -13.4), 0).cyl(0x4a4a4a, 0, 0, 0, 0.14, 6).cyl(0xc8a24a, 0, 6, 0, 0.55, 0.9).box(0x8a2a2a, 0.3, 1.2, 0.2, 0.08, 0.6, 0.08);
  // fences and lanterns along the lanes
  for (let dx = -18; dx <= 18; dx += 2.2) if (Math.abs(dx) > 3.5) R.frame(...P(dx, 13), 0, { list: 'fixed' }).box(0x6a4a2a, 0, 0, 0, 0.12, 1, 0.12).box(0x7a5a3a, 1.1, 0.7, 0, 2.2, 0.1, 0.06);
  for (const [dx, dz] of [
    [-8, 6],
    [8, 6],
    [-8, -8],
    [10, -8],
    [0, 9],
  ]) {
    R.frame(...P(dx, dz), 0).box(0x3a2a1a, 0, 0, 0, 0.14, 2.6, 0.14).glow(BALL, 0xffb060, 1.6, 0, 2.7, 0, 0, 0.35);
  }

  S.people();

  // the purge: a red light of its own comes up over the village, and a red
  // veil over the sky (the world's light is set once, as the place is shown)
  const glare = new THREE.HemisphereLight(0xff3a22, 0x3a0808, 0);
  R.group.add(glare);
  const veil = new THREE.Mesh(R.own(new THREE.SphereGeometry(500, 24, 12)), R.own(new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false, fog: false })));
  veil.renderOrder = -8;
  veil.frustumCulled = false;
  R.add(veil, { ink: false });
  let purging = false;
  const area = S.done(LIGHT, (t, dt, state, camera) => {
    if (camera) veil.position.copy(camera.position);
    if (!purging) return;
    glare.intensity = Math.min(2.2, glare.intensity + dt * 1.2);
    veil.material.opacity = Math.min(0.45, veil.material.opacity + dt * 0.3);
  });
  area.actions = {
    ...area.actions,
    siren: () => {
      purging = true;
      S.hunt(true); // the villagers turn on him
    },
    // (left: the night's over by the next visit)
    calm: () => {
      purging = false;
      S.calm();
      glare.intensity = 0;
      veil.material.opacity = 0;
    },
  };
  return area;
}
