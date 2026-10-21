// Interdimensional Customs ("Mortynight Run"'s way through, and the pilot's
// Mega Seeds): a bright white hall with pale green lanes on the floor, two
// scanner arches with a queue of travellers from other dimensions in the far
// one, the Gromflomite agents at their desks past the arches, Krombopulos
// Michael by a pillar, round portal pads with their swirls, and a long window
// on a yellow alien city. Rick's seeds wait on a table by the way in; taken
// (the area's 'took'), they're gone from it; walked through the scanner
// ('alarm'), the arch and the desks' lights go red and flash till Morty's
// gone ('calm', as every place is told when he leaves it).

import * as THREE from 'three';
import { BALL, CYL } from '../interiors/shell';
import { specks, stage } from './stage';

const LIGHT = { sun: [0xf6fff6, 0.8], hemi: [0xf2fff4, 0x8aa094, 1.8], fog: null, background: 0x1a2a22 };
const WHITE = 0xf2f4ef;
const TRIM = 0xc8d0ca;

// the alien city through the window: stalks, pods and towers on a yellow sky
const CITY = (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#f6d27a');
  sky.addColorStop(1, '#fbeab2');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#e8a0b0';
  g.beginPath();
  g.arc(w * 0.48, h * 0.18, 10, 0, Math.PI * 2);
  g.fill();
  const shapes = [
    ['#b8506a', 0.06, 0.55, 0.08],
    ['#e07a3a', 0.2, 0.38, 0.05],
    ['#a87a4a', 0.33, 0.2, 0.06],
    ['#5a9ab8', 0.45, 0.5, 0.1],
    ['#9ac85a', 0.55, 0.42, 0.06],
    ['#b86a9a', 0.68, 0.3, 0.07],
    ['#d8a04a', 0.82, 0.48, 0.06],
    ['#6ab88a', 0.93, 0.36, 0.05],
  ];
  for (const [c, x, top, wide] of shapes) {
    g.fillStyle = c;
    g.fillRect((x - wide / 2) * w, top * h, wide * w, h);
    g.beginPath();
    g.ellipse(x * w, top * h, wide * w * 0.9, wide * w * 0.5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2a2a2a';
    for (let k = 0; k < 3; k++) g.fillRect((x - 0.01) * w, (top + 0.12 + k * 0.12) * h, 0.02 * w, 0.04 * h);
  }
};

// the signs over the arches, in the alien script (squiggles, not letters)
const SIGN = (g, w, h) => {
  g.fillStyle = '#2a3a32';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#9dffb8';
  g.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const x = 14 + i * 16;
    g.beginPath();
    g.moveTo(x, 12);
    g.quadraticCurveTo(x + 8, 18 + (i % 3) * 4, x, 26);
    g.lineTo(x + 6, 34);
    g.stroke();
  }
};

export async function buildCustoms(kit) {
  const S = stage(kit, 'customs', { floor: specks('#e9ece6', ['#dfe4dc', '#f2f4f0']), wall: WHITE, ceiling: 0xf6f8f4, skirt: 0x8aa094 });
  const { R, P, A } = S;
  const H = S.d.ceiling;

  // the floor's lanes, pale green, up to each arch and on past the desks
  for (const dx of [0, -6]) R.frame(...P(dx, 4), 0, { list: 'fixed' }).box(0xa8dcb8, 0, 0, 0, 2.6, 0.02, 18);
  R.frame(...P(0, -9), 0, { list: 'fixed' }).box(0xa8dcb8, 0, 0, 0, 14, 0.02, 6);

  // the ceiling's ribs, and the white columns along the walls
  for (let dz = -12; dz <= 12; dz += 6) R.frame(...P(0, dz), 0, { list: 'fixed' }).box(TRIM, 0, H - 0.5, 0, A.x1 - A.x0, 0.5, 0.6);
  for (const dx of [-16.4, 16.4]) for (let dz = -10; dz <= 10; dz += 10) R.frame(...P(dx, dz), 0).box(TRIM, 0, 0, 0, 0.8, H, 0.8);

  // the scanner arches: grey posts and a beam, green strips, a lamp on top
  const lamps = [];
  for (const dx of [0, -6]) {
    const f = R.frame(...P(dx, 0), 0);
    f.box(0xd2d8d2, -1.45, 0, 0, 0.5, 2.8, 0.7).box(0xd2d8d2, 1.45, 0, 0, 0.5, 2.8, 0.7).box(0xd2d8d2, 0, 2.8, 0, 3.4, 0.5, 0.7);
    f.glow(BALL, 0x6dffa0, 1.4, -1.2, 1.4, 0, 0, 0.06, 2.2, 0.5).glow(BALL, 0x6dffa0, 1.4, 1.2, 1.4, 0, 0, 0.06, 2.2, 0.5);
    R.cell('customssign', 128, 48, SIGN);
    f.decal('customssign', 0, 3.05, 0.36, 2.6, 0.5, { bright: true });
    lamps.push(P(dx, 0));
  }
  // the agents' desks: cream consoles with green domes and a siren light each
  for (const dx of [-4, 4]) {
    const f = R.frame(...P(dx, -3.6), 0);
    f.box(0xe2e2d4, 0, 0, 0, 3, 1.05, 0.9).box(0x9aa8a0, 0, 1.05, 0, 3.1, 0.06, 1);
    f.box(0x2a3a32, 0, 1.11, 0.1, 1.2, 0.04, 0.5).glow(CYL, 0x7affc0, 1.2, 0, 1.14, 0.1, 0, 1.1, 0.02, 0.44);
    for (const u of [-0.9, 0.9]) f.glow(BALL, 0x6dff8a, 1.6, u, 1.2, -0.1, 0, 0.3, 0.24, 0.3);
    lamps.push(P(dx, -3.6));
  }
  // the red lamps, each its own mesh so the alarm can flash them
  const lampMat = R.own(new THREE.MeshBasicMaterial({ color: 0x7a2a2a }));
  const lampGeo = R.own(new THREE.SphereGeometry(0.22, 12, 8));
  for (const [i, [x, z]] of lamps.entries()) {
    const m = new THREE.Mesh(lampGeo, lampMat);
    m.position.set(x, i < 2 ? 3.45 : 1.45, z);
    R.add(m, { ink: false });
  }
  // the rope lane for the queue, posts and a red rope
  for (const dz of [2, 5, 8]) for (const dx of [-7.6, -4.4]) R.frame(...P(dx, dz), 0, { list: 'fixed' }).cyl(0xc8a24a, 0, 0, 0, 0.05, 0.95).ball(0xc8a24a, 0, 0.95, 0, 0.07);
  for (const dx of [-7.6, -4.4]) R.frame(...P(dx, 5), 0, { list: 'fixed' }).cyl(0xb8262c, 0, 0.85, 0, 0.025, 6, Math.PI / 2);

  // the seeds' table, a metal one, and the seeds on it in a little crate
  R.frame(...P(6, 6.6), 0).box(0xb8c0c2, 0, 0, 0, 1.6, 0.9, 0.8).box(0x8a9294, 0, 0, 0, 1.3, 0.04, 0.6);
  const crate = new THREE.Group();
  const wood = kit.mats.wood;
  const seed = R.own(new THREE.MeshBasicMaterial({ color: 0x9dff6a }));
  const box = new THREE.Mesh(R.own(new THREE.BoxGeometry(0.5, 0.18, 0.34)), wood);
  box.position.y = 0.09;
  crate.add(box);
  const seedGeo = R.own(new THREE.SphereGeometry(0.06, 8, 6));
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Mesh(seedGeo, seed);
    s.position.set(-0.16 + (k % 3) * 0.16, 0.2, k < 3 ? -0.06 : 0.07);
    crate.add(s);
  }
  crate.position.set(...[P(6, 6.6)[0], 0.92, P(6, 6.6)[1]]);
  R.add(crate);

  // the portal pads: round dishes on pillars, each with a swirl over it
  const swirls = [];
  for (const dx of [-10, 3]) {
    const f = R.frame(...P(dx, -10.5), 0);
    f.cyl(0xc8d0ca, 0, 0, 0, 0.7, 0.9).cyl(0xa8b4ae, 0, 0.9, 0, 1.7, 0.35).glow(CYL, 0x6ad8ff, 1.3, 0, 1.24, 0, 0, 2.8, 0.03, 2.8);
    const m = R.own(kit.portal());
    const sw = new THREE.Mesh(R.own(new THREE.PlaneGeometry(2.4, 2.8)), m);
    sw.position.set(P(dx, -10.5)[0], 2.8, P(dx, -10.5)[1]);
    R.add(sw, { ink: false });
    swirls.push([sw, m]);
  }

  // the long window on the city, across the north wall
  R.cell('customscity', 512, 128, CITY);
  R.frame(...P(0, -14.86), 0, { list: 'fixed' }).box(TRIM, 0, 2.2, 0, 30, 3.6, 0.12).decal('customscity', 0, 4, 0.08, 29, 3.2, { bright: true });
  // the screens on the east wall, in the alien script
  R.frame(...P(16.9, -4), -Math.PI / 2, { list: 'fixed' }).box(0x2a3a32, 0, 2.2, 0, 3, 1.8, 0.1).decal('customssign', 0, 3.1, 0.06, 2.8, 1.4, { bright: true });

  S.people();

  let alarm = false;
  let took = false;
  const area = S.done(LIGHT, (t, dt, state, camera) => {
    crate.visible = !took;
    // (the swirls face the camera, as the portal home does)
    for (const [sw, m] of swirls) {
      if (camera) sw.rotation.y = Math.atan2(camera.position.x - sw.position.x, camera.position.z - sw.position.z);
      m.uniforms.t.value = t;
      m.uniforms.open.value = 1;
    }
    lampMat.color.setHex(alarm && Math.sin(t * 9) > 0 ? 0xff2a1a : 0x7a2a2a);
  });
  area.actions = {
    ...area.actions,
    took: () => {
      took = true;
    },
    alarm: () => {
      alarm = true;
      S.hunt(true); // the agents come round their desks
    },
    calm: () => {
      alarm = false;
      took = false;
      S.calm();
    },
  };
  return area;
}
