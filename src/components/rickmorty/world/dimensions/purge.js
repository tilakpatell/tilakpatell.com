// The Purge Planet ("Look Who's Purging Now"): a farming village of cat
// people at dusk: cabins, a barn and a well with Arthricia by it, lanterns
// on posts, villagers about, and the purge siren on its pole (the village's
// own models, stood by its world: ./worlds2.js's pieces). Pulled
// (the area's 'siren' action, from RmWorld), it howls and the sky goes red;
// Morty has a minute to get back through the portal ('calm' once he's gone).

import * as THREE from 'three';
import { BALL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xffc890, 1.2], hemi: [0xb89ad8, 0x4a3a2a, 1.25], fog: [0x8a6a8a, 50, 260] };

export async function buildPurge(kit) {
  const S = stage(kit, 'purge', { ground: specks('#6a7a3a', ['#5a6a32', '#7a8a46', '#6e6a3a'], 17), groundTile: 6 });
  const { R, P } = S;

  // (the cabins, the barn, the well and the siren on its pole are the
  // village's own models, its world's pieces, on their solids)
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
