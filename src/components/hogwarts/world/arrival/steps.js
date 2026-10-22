// The steps (the design’s §4.2, beat three): the boats come in under the
// cliff to an underground harbour (black water in a channel of rock, a stone
// quay, torches in iron brackets, the boats bumping at their rings), and the
// first-years climb a long stair up through the rock behind Hagrid’s lantern
// and come out at the top before the great oak doors, open, the light
// pouring out; inside, the Entrance Hall: flagstones, torches, the doors to
// the Great Hall on the right with the noise of the school behind them, and
// the marble staircase ahead with Professor McGonagall waiting on it.
//
// The set’s frame: the water channel down the −x side, the quay at y 0.6, the
// stair from z 6 rising up +z to the top at y 13.5 and z 60; the Entrance
// Hall from z 65 to 86 at that height.
//
//   (its numbers: ./sets.js’s STEPS and stairY)
//   createSteps({ rt, kit, tier, at }) → { group, step(dt, { camera }), dispose() }

import * as THREE from 'three';
import { createRoomKit } from '../../rooms/kit';
import { createFire } from '../../rooms/parts/fire';
import { doors } from '../../rooms/parts/furniture';
import { createCrowd } from '../../cast/crowd';
import { CROWD, figure } from '../../cast/figures';
import { hullGeometry } from './flotilla';
import { STEPS, stairY } from './sets';



export function createSteps({ rt = null, kit, tier = 'high', at = [0, 0, 0] }) {
  void kit;
  const group = new THREE.Group();
  group.name = 'arrival:steps';
  group.position.set(...at);
  group.visible = false;
  const K = createRoomKit({ tier });
  const { quay: Q, water: Wt, stair: S, hall: H, marble: M } = STEPS;
  const rock = K.paint('#6a645b', { scan: 'rock', metres: 3.2, strength: 0.8, rough: 1 });

  // the harbour: black water in its channel, the quay, the cave’s rock round all of it
  const waterMat = K.paint('#05080a', { rough: 0.08, metal: 0.6 });
  K.box(waterMat, (Wt.x0 + Wt.x1) / 2, -0.4, (Wt.z0 + Wt.z1) / 2, Wt.x1 - Wt.x0 + 1, 0.4, Wt.z1 - Wt.z0);
  K.box('flags', (Q.x0 + Q.x1) / 2, -0.6, (Q.z0 + Q.z1) / 2, Q.x1 - Q.x0, Q.y + 0.6, Q.z1 - Q.z0);
  K.box('ashlar', Q.x0 + 0.2, Q.y - 0.1, (Q.z0 + Q.z1) / 2, 0.4, 0.14, Q.z1 - Q.z0);
  for (let z = Q.z0 + 1.5; z < Q.z1; z += 4) {
    K.cyl('iron', Q.x0 + 0.5, Q.y, z, 0.07, 0.09, 0.5, { seg: 8 });
    K.add('iron', new THREE.TorusGeometry(0.12, 0.02, 6, 12), { at: [Q.x0 + 0.5, Q.y + 0.45, z], ry: Math.PI / 2 });
  }
  // the cave: a long vault of rough rock over the water and the quay
  const cave = new THREE.CylinderGeometry(9, 9, 60, 20, 6, true, Math.PI * 0.5, Math.PI);
  cave.rotateX(Math.PI / 2).rotateZ(Math.PI / 2);
  // (rough: each vertex pushed by a little noise, so it reads as rock and not a pipe)
  const p = cave.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const n = Math.sin(x * 0.9 + z * 0.37) * 0.5 + Math.sin(y * 1.3 - z * 0.71) * 0.4 + Math.sin(z * 2.1 + x) * 0.25;
    p.setXYZ(i, x * (1 + n * 0.06), y * (1 + n * 0.06), z);
  }
  // (its faces turned inward: the cave is seen from inside)
  cave.index && cave.setIndex(Array.from(cave.index.array).reverse());
  cave.computeVertexNormals();
  K.add(rock, cave, { at: [-1, -0.5, -18] });

  // the moored boats bumping at the quay
  const hull = hullGeometry({ len: 4.3, beam: 1.4, depth: 0.6 });
  const boatMat = K.paint('#3b2a1e', { rough: 0.7, scan: 'wood', metres: 0.9, strength: 0.55 });
  const boats = [];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(i ? hull : hull, boatMat);
    b.position.set(-4.6, -0.3, -10 + i * 4.6);
    b.rotation.y = Math.PI + (i % 2 ? 0.06 : -0.05);
    group.add(b);
    boats.push(b);
  }

  // the stair up through the rock: treads, the tunnel’s walls and its arched roof
  const steps = Math.round((S.z1 - S.z0) / 0.75);
  for (let i = 0; i < steps; i++) {
    const z = S.z0 + i * 0.75;
    const y = S.y0 + (i / steps) * (S.y1 - S.y0);
    K.box('flags', 0, y - 0.6, z + 0.375, S.w, 0.6 + (S.y1 - S.y0) / steps, 0.75);
  }
  const run = Math.hypot(S.z1 - S.z0, S.y1 - S.y0);
  const slope = Math.atan2(S.y1 - S.y0, S.z1 - S.z0);
  const midZ = (S.z0 + S.z1) / 2;
  const midY = (S.y0 + S.y1) / 2;
  for (const side of [-1, 1]) K.box(rock, side * (S.w / 2 + 0.6), midY - 2, midZ, 1.2, 6.5, run + 1, { rx: -slope });
  const roof = new THREE.CylinderGeometry(S.w / 2 + 0.5, S.w / 2 + 0.5, run + 1, 12, 1, true, -Math.PI / 2, Math.PI);
  roof.rotateX(Math.PI / 2);
  roof.setIndex(Array.from(roof.index.array).reverse());
  roof.computeVertexNormals();
  K.add(rock, roof, { at: [0, midY + 2.9, midZ], rx: -slope });

  // the top: a terrace of grass under the night, the castle’s wall and its great doors open
  K.box(K.paint('#1c2a1a', { scan: 'grass', metres: 2, strength: 0.6, rough: 1 }), 0, S.y1 - 0.3, 62, 40, 0.3, 6);
  K.box('stone', -15.5, S.y1, 65, 13, 22, 1.4);
  K.box('stone', 15.5, S.y1, 65, 13, 22, 1.4);
  K.box('stone', 0, S.y1 + 8.6, 65, 18, 13.4, 1.4);
  doors(K, { at: [0, S.y1, 65.6], ry: 0, w: 5.6, h: 8.4, open: 0.85 });

  // the Entrance Hall: flags, its walls and roof, the marble stair, the Great Hall’s doors on the right
  K.box('flags', 0, H.y - 0.3, (H.z0 + H.z1) / 2, H.x1 - H.x0, 0.3, H.z1 - H.z0);
  for (const side of [-1, 1]) K.box('stone', side * (H.x1 + 0.5), H.y, (H.z0 + H.z1) / 2, 1, H.h, H.z1 - H.z0);
  K.box('stone', 0, H.y, H.z1 + 0.5, H.x1 - H.x0 + 2, H.h, 1);
  K.box('stonedark', 0, H.y + H.h, (H.z0 + H.z1) / 2, H.x1 - H.x0 + 2, 1, H.z1 - H.z0 + 2);
  // (the ribs across its roof)
  for (let z = H.z0 + 3; z < H.z1; z += 4.5) K.box('ashlar', 0, H.y + H.h - 0.8, z, H.x1 - H.x0, 0.8, 0.5);
  const treads = 14;
  for (let i = 0; i < treads; i++) {
    const z = M.z0 + (i / treads) * (M.z1 - M.z0);
    K.box('ashlar', 0, H.y, z + (M.z1 - M.z0) / treads / 2, 7 - i * 0.05, ((i + 1) / treads) * M.rise, (M.z1 - M.z0) / treads);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < treads; i += 2) {
      const z = M.z0 + (i / treads) * (M.z1 - M.z0);
      K.cyl('ashlar', side * 3.6, H.y + (i / treads) * M.rise, z, 0.07, 0.09, 0.9, { seg: 8 });
    }
    K.box('ashlar', side * 3.6, H.y + M.rise / 2 + 0.85, (M.z0 + M.z1) / 2, 0.22, 0.14, M.z1 - M.z0 + 0.4, { rx: -Math.atan2(M.rise, M.z1 - M.z0) });
  }
  doors(K, { at: [H.x1 - 0.05, H.y, 72], ry: -Math.PI / 2, w: 4.6, h: 7.2, open: 0 });
  // (the light from the Great Hall under its doors and at their meeting)
  K.box(K.glow('#ffc27a', 2.2), H.x1 - 0.2, H.y + 0.01, 72, 0.06, 0.05, 4.4);
  K.box(K.glow('#ffb46a', 1.4), H.x1 - 0.24, H.y + 0.1, 72, 0.02, 6.9, 0.05);

  // torches: on the quay, up the stair, either side of the doors, round the Entrance Hall
  const torchAt = [
    [Q.x1 - 0.2, Q.y + 2.2, -8, -1],
    [Q.x1 - 0.2, Q.y + 2.2, 2, -1],
    ...[14, 26, 38, 50].map((z, i) => [(i % 2 ? 1 : -1) * (S.w / 2 + 0.05), stairY(z) + 2.1, z, i % 2 ? -1 : 1]),
    [-3.6, S.y1 + 3.2, 64.2, 0],
    [3.6, S.y1 + 3.2, 64.2, 0],
    [H.x0 + 0.2, H.y + 3.4, 70, 1],
    [H.x0 + 0.2, H.y + 3.4, 80, 1],
    [H.x1 - 0.2, H.y + 3.4, 79, -1],
  ];
  const fires = [];
  for (const [x, y, z, face] of torchAt) {
    K.cyl('iron', x + face * 0.18, y - 0.45, z, 0.05, 0.03, 0.45, { seg: 6, rz: face * 0.5 });
    K.cyl('iron', x + face * 0.3, y - 0.05, z, 0.08, 0.05, 0.12, { seg: 8 });
    const f = createFire({ at: [x + face * 0.3, y + 0.05, z], w: 0.3, h: 0.55, tongues: 2, tier: fires.length < 6 ? tier : 'low', light: true });
    group.add(f.group);
    fires.push(f);
  }

  // up the stair ahead: the first-years climbing behind Hagrid; and McGonagall waiting on the marble
  const climbers = [];
  for (let i = 0; i < (tier === 'low' ? 5 : 9); i++) climbers.push({ z: 14 + i * 1.6, x: (i % 2 ? 0.55 : -0.55) + (i % 3) * 0.12, v: 0.9 });
  const crowd = createCrowd({ rt, spots: climbers.map((c) => ({ at: [c.x, stairY(c.z), c.z], yaw: 0 })), bodies: CROWD, clips: { idle: 'walk' }, tier, sit: false });
  group.add(crowd.group);
  const hagrid = figure('hagrid', { rt, seed: 13 });
  hagrid.set({ base: 'lantern' });
  group.add(hagrid.group);
  const mcg = figure('mcgonagall', { rt, seed: 21 });
  mcg.set({ base: null, speed: 0 });
  const mz = STEPS.mcgonagall[2];
  const my = H.y + ((mz - M.z0) / (M.z1 - M.z0)) * M.rise;
  mcg.group.position.set(STEPS.mcgonagall[0], my, mz);
  mcg.group.rotation.y = Math.PI;
  group.add(mcg.group);
  // (the torches’ warmth everywhere they reach, and a lamp over McGonagall’s stair:
  // no moon down here, and only a little through the doors)
  const warm = new THREE.HemisphereLight(0xffb27a, 0x3a2414, 1.6);
  warm.position.set(0, 20, 30);
  const hallLamp = new THREE.PointLight(0xffc488, 30, 26, 1.6);
  hallLamp.position.set(0, H.y + 7, 74);
  const quayLamp = new THREE.PointLight(0xffa860, 60, 28, 1.4);
  quayLamp.position.set(2, Q.y + 3.5, -4);
  group.add(warm, hallLamp, quayLamp);
  K.build(group);

  let t = 0;
  const climbAt = [];
  return {
    group,
    ready: Promise.all([crowd.ready, hagrid.ready, mcg.ready]),
    step(dt, { camera } = {}) {
      t += dt;
      for (const f of fires) f.step(dt);
      climbAt.length = 0;
      for (const c of climbers) {
        c.z += c.v * dt;
        if (c.z > S.z1 - 1) c.z -= 44;
        climbAt.push({ at: [c.x, stairY(c.z), c.z], yaw: 0 });
      }
      crowd.move(climbAt);
      crowd.step(dt, { camera });
      // Hagrid a few steps ahead of the first of them, his lantern going up into the dark
      const lead = Math.max(...climbers.map((c) => c.z)) + 3;
      hagrid.group.position.set(0.2, stairY(lead), lead);
      hagrid.tick(dt);
      mcg.tick(dt);
      // the moored boats nudging their rings
      boats.forEach((b, i) => {
        b.position.y = -0.3 + Math.sin(t * 0.8 + i) * 0.03;
        b.rotation.z = Math.sin(t * 0.7 + i * 1.3) * 0.03;
      });
    },
    dispose() {
      crowd.dispose();
      hagrid.dispose();
      mcg.dispose();
      for (const f of fires) f.dispose();
      hull.dispose();
      K.dispose();
      group.removeFromParent();
    },
  };
}
