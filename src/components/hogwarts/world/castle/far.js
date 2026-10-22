// The castle far off: the whole of it as one mesh and one draw, the plan
// (plan.js) built at the kit’s far cut (fewer sides round a tower, no
// merlons, sills, steps or pinnacles), every part’s colour baked into its
// vertices, and its windows in the same mesh, lit by the same night as the
// near castle’s (each window on its own threshold, so the far castle comes
// on at dusk one window at a time too). Past `FAR` metres from the castle
// this is all that is drawn of it, and on low it is the castle at every
// distance. The landing (the planet’s shore, far across the water) draws
// the same.
//
//   FAR: { low, mid, high, ultra }: metres from the castle past which only this is drawn (0: always)
//   buildFarGeometry({ ground }) → BufferGeometry (its `aLit` 2 where nothing shines)
//   createFarCastle({ house, ground, night }) → { mesh, group (the same: Lane A’s name), material, set(night), dispose }
//     night: a uniform node to share (the near castle’s uNight), else its own;
//     set takes the windows’ 0…1, or a light with its `windows` (rules/clock.js’s light())

import * as THREE from 'three';
import { MeshLambertNodeMaterial } from 'three/webgpu';
import { attribute, mix, sin, smoothstep, step, uniform, vec3 } from 'three/tsl';
import { createMesh } from './mesh';
import { PARTS } from './parts';
import { PLAN } from './plan';
import { heightAt } from '../terrain';
import { seeded } from '../../../../lib/seeded';

export const FAR = { low: 0, mid: 150, high: 300, ultra: 420 };

export function buildFarGeometry({ ground = heightAt } = {}) {
  const mesh = createMesh();
  const ctx = { mesh, ground, far: true, rng: seeded(11) };
  for (const p of PLAN) PARTS[p.kind](ctx, p);
  return mesh.merged({ glass: ['glass'] });
}

export function createFarCastle({ house = null, ground = heightAt, night = null } = {}) {
  const geometry = buildFarGeometry({ ground });
  const uNight = night ?? uniform(0);
  const material = house ? house.material({ vertexColors: true }) : new MeshLambertNodeMaterial({ vertexColors: true });
  // (the stone a touch darker than its tone: the near castle’s scans and its weathering darken it about so much)
  material.color.setScalar(0.86);
  const aLit = attribute('aLit', 'float');
  const glass = step(aLit, 1.5);
  const on = smoothstep(aLit.sub(0.05), aLit.add(0.05), uNight).mul(glass);
  const hue = mix(vec3(1.0, 0.42, 0.12), vec3(1.0, 0.62, 0.3), sin(aLit.mul(97.3)).mul(0.5).add(0.5));
  // (a little brighter than the near windows: a far window is a pixel or two, and must still read)
  material.emissiveNode = hue.mul(on).mul(3.2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'hogwarts:castle:far';
  return {
    mesh,
    group: mesh,
    material,
    uNight,
    set(n) {
      if (!night) uNight.value = typeof n === 'number' ? n : (n?.windows ?? 0);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
