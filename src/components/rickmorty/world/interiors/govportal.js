// The President's portal (in Rick's garage, and its way back in the Oval
// Office): a steel frame, riveted, the seal on its head, a swirl in it once
// it's open. `open(state)` says whether it is (the garage's opens once Morty
// has met the President); shut, it's a dark sheet of steel with a red lamp.

import * as THREE from 'three';
import { BALL8, PLANE } from './shell';
import { glowSpot } from './lab';

const PORTAL_W = 1.5;
const PORTAL_H = 2.2;

// (x, z) the foot of its face, `turn` the way it faces (rules.js's: 0 south)
export function govPortal(R, x, z, turn, { open = () => true } = {}) {
  const kit = R.kit;
  const f = R.frame(x, z, turn, { list: 'fixed' });
  const w = PORTAL_W;
  const h = PORTAL_H;
  // the frame: posts, a head and a sill, steel, with bolts down the posts
  for (const s of [-1, 1]) {
    f.box(0x5d666e, (s * (w + 0.22)) / 2, 0, 0, 0.22, h + 0.3, 0.3);
    for (let y = 0.3; y < h; y += 0.5) f.ball(0xa9b1b7, (s * (w + 0.22)) / 2, y, 0.16, 0.03, 1, BALL8);
  }
  f.box(0x5d666e, 0, h + 0.1, 0, w + 0.44, 0.24, 0.3).box(0x4a5258, 0, 0, 0, w + 0.44, 0.08, 0.36);
  // the seal on the head: navy, a gold ring
  f.cyl(0x1f2a52, 0, h + 0.22, 0.16, 0.2, 0.04, Math.PI / 2).part(new THREE.TorusGeometry(0.17, 0.02, 6, 20), 0xd8b25a, 0, h + 0.22, 0.19);
  // shut: a dark plate, a red lamp over it
  const plate = new THREE.Mesh(R.own(new THREE.PlaneGeometry(w, h)), kit.mats.toon(0x2a3036));
  plate.position.set(0, h / 2 + 0.04, 0.02);
  const lamp = new THREE.Mesh(BALL8, R.own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a3a).multiplyScalar(2) })));
  lamp.scale.setScalar(0.09);
  lamp.position.set(0, h + 0.36, 0.1);
  // open: the swirl, and its light on the floor
  const pm = R.own(kit.portal());
  const swirl = new THREE.Mesh(R.own(new THREE.PlaneGeometry(w + 0.2, h + 0.3)), pm);
  swirl.position.set(0, h / 2 + 0.05, 0.03);
  swirl.renderOrder = 2;
  const spill = new THREE.Mesh(
    PLANE,
    R.own(new THREE.MeshBasicMaterial({ map: R.own(glowSpot()), color: new THREE.Color(0x6dff4a).multiplyScalar(0.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })),
  );
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.013, 0.9);
  spill.scale.set(2.4, 2.0, 1);
  // (the plate with the frame; the glows apart, kept out of the light bake)
  const place = (...things) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = turn;
    g.add(...things);
    return g;
  };
  R.add(place(plate));
  R.add(place(lamp, swirl, spill), { ink: false });
  let k = null; // how open it is, 0 to 1
  R.tick((t, dt, state) => {
    const want = open(state) ? 1 : 0;
    k = k == null ? want : k + Math.sign(want - k) * Math.min(Math.abs(want - k), dt * 1.5);
    pm.uniforms.t.value = t;
    pm.uniforms.open.value = k;
    swirl.visible = k > 0.01;
    spill.visible = swirl.visible;
    spill.material.opacity = k * (0.5 + Math.sin(t * 2.3) * 0.12);
    plate.visible = k < 0.99;
    lamp.visible = k < 0.5;
  });
}
