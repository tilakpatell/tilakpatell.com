// The Grey Havens' quay and the white ship, made in code on the Road's
// house look: the long grey quay of dressed stone out over the water, its
// coping, its bollards and its lamps, a slender arch of the Elves at its
// head; and the ship, a white hull pointed fore and aft, her prow a swan's
// neck and head, a silver mast and a sail bellied by the wind off the
// land. The quay's statics are one mesh; the ship is its own group, moved
// by the scene. Drawing only (place.js says where).
//
//   buildProps({ road }) → { group, ship, sail, gangway, lamps, dispose }

import * as THREE from 'three';
import { C, merged, part } from '../parts';
import { GANGWAY, QUAY, SHIP, WATER } from './place';

const STONE = [0x9a978f, 0x8e8b84, 0xa4a198, 0x878580];
const COPING = 0xb4b0a6;
const WHITE = 0xece9e2;
const SILVER = 0xc6cad2;
const GOLD = 0xd8c48a;
const BLOCK = 8; // m a length of the quay's stone

// a hull pointed fore and aft: U-shaped sections along z, its gunwale rising
// to both ends, its keel deepest amidships; the deck a strip between the gunwales
function hull({ length, beam, depth, sheer }) {
  const NZ = 28;
  const NU = 12;
  const pos = [];
  const idx = [];
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ;
    const z = (t - 0.5) * length;
    const w = (beam / 2) * Math.pow(Math.sin(Math.PI * t), 0.55) + 0.02;
    const top = sheer * (2 * t - 1) ** 2 + (t > 0.5 ? 0.6 * (2 * t - 1) ** 3 : 0);
    const d = depth * (0.35 + 0.65 * Math.sqrt(Math.sin(Math.PI * t)));
    for (let j = 0; j <= NU; j++) {
      const a = (Math.PI * j) / NU;
      pos.push(w * Math.cos(a), top - d * Math.sin(a), z);
    }
  }
  for (let i = 0; i < NZ; i++)
    for (let j = 0; j < NU; j++) {
      const a = i * (NU + 1) + j;
      const b = a + NU + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// the swan's neck up out of the prow, its head and its golden beak
function swan(length) {
  const bow = length / 2;
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.3, bow - 0.6), new THREE.Vector3(0, 1.8, bow + 0.4), new THREE.Vector3(0, 3.4, bow + 0.1), new THREE.Vector3(0, 4.1, bow - 0.7), new THREE.Vector3(0, 4.0, bow - 1.3)]);
  const neck = new THREE.TubeGeometry(curve, 24, 0.22, 8, false);
  // (thinning toward the head)
  const p = neck.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const u = Math.floor(i / 9) / 24;
    const c = curve.getPoint(Math.min(1, u));
    v.sub(c).multiplyScalar(1 - 0.45 * u).add(c);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  neck.computeVertexNormals();
  return [
    part(neck, C(WHITE)),
    part(new THREE.SphereGeometry(0.34, 10, 8), C(WHITE), { at: [0, 4.05, bow - 1.35], scale: [1, 0.85, 1.25] }),
    part(new THREE.ConeGeometry(0.11, 0.6, 6), C(GOLD), { at: [0, 3.92, bow - 1.85], pitch: -Math.PI / 2 - 0.25 }),
  ];
}

function buildShip(road) {
  const { length, beam } = SHIP;
  const ship = new THREE.Group();
  ship.name = 'havens:ship';
  const white = road.material({ vertexColors: true });
  const cloth = road.material({ vertexColors: true, side: THREE.DoubleSide });
  const shell = hull({ length, beam, depth: 2.6, sheer: 1.3 });
  // (her deck at place.js's height over the water: the hull drawn round it)
  const deckY = SHIP.deck - WATER;
  const parts = [
    part(shell, C(WHITE), { at: [0, deckY + 0.3, 0] }),
    part(new THREE.BoxGeometry(beam * 0.78, 0.12, length * 0.78), C(0xd8d2c4), { at: [0, deckY, 0] }),
    // the rail along each side, silver
    ...[-1, 1].map((s) => part(new THREE.BoxGeometry(0.08, 0.08, length * 0.72), C(SILVER), { at: [s * beam * 0.4, deckY + 0.75, 0] })),
    ...swan(length).map((g) => g.translate(0, deckY, 0)),
    // the stern post curling up
    part(new THREE.TorusGeometry(0.9, 0.16, 6, 14, Math.PI * 1.2), C(WHITE), { at: [0, deckY + 1.6, -length / 2 + 0.6], yaw: Math.PI / 2 }),
    // the mast and its yard
    part(new THREE.CylinderGeometry(0.11, 0.16, 12, 8), C(SILVER), { at: [0, deckY + 6, 0.8] }),
    part(new THREE.CylinderGeometry(0.07, 0.07, 7.6, 6), C(SILVER), { at: [0, deckY + 10.6, 1], roll: Math.PI / 2 }),
  ];
  const body = merged(parts, white, 'havens:ship-body');
  ship.add(body);
  // the sail, bellied forward by the wind off the land
  const sailGeo = new THREE.PlaneGeometry(7, 8.4, 10, 10);
  const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const u = sp.getX(i) / 7 + 0.5;
    const w = sp.getY(i) / 8.4 + 0.5;
    sp.setZ(i, 0.9 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, w * 0.9 + 0.05)));
  }
  sailGeo.computeVertexNormals();
  const sail = merged([part(sailGeo, C(0xf6f4ee), { at: [0, deckY + 6.3, 1.25] })], cloth, 'havens:sail');
  ship.add(sail);
  ship.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { ship, sail, materials: [white, cloth] };
}

export function buildProps({ road }) {
  const group = new THREE.Group();
  group.name = 'havens:props';
  const stone = road.material({ vertexColors: true });
  const parts = [];
  const [z0, z1] = QUAY.z;
  const foot = WATER - 1.2;
  // the quay: a length of dressed stone at a time, each its own grey, the coping over them
  for (let z = z0, k = 0; z < z1; z += BLOCK, k++) {
    const len = Math.min(BLOCK, z1 - z);
    parts.push(part(new THREE.BoxGeometry(QUAY.x * 2, QUAY.top - foot, len - 0.04), C(STONE[k % STONE.length]), { at: [0, (QUAY.top + foot) / 2, z + len / 2] }));
    // (its top the quay's walking height: place.js's QUAY.top)
    parts.push(part(new THREE.BoxGeometry(QUAY.x * 2 + 0.3, 0.16, len), C(COPING), { at: [0, QUAY.top - 0.08, z + len / 2] }));
  }
  // the ramp up onto it from the beach
  const ramp = new THREE.BoxGeometry(QUAY.x * 2, 0.3, Math.hypot(z0 - QUAY.from, QUAY.top - WATER));
  parts.push(part(ramp, C(COPING), { at: [0, (QUAY.top + WATER) / 2 - 0.15, (z0 + QUAY.from) / 2], pitch: -Math.atan2(QUAY.top - WATER, z0 - QUAY.from) }));
  // bollards along the ship's side, and lamps on slender posts
  const lamps = [];
  for (let z = z0 + 6; z < z1; z += 12) {
    parts.push(part(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 8), C(0x6e6a62), { at: [QUAY.x - 0.4, QUAY.top + 0.3, z] }));
    if (Math.round((z - z0) / 12) % 2 === 0) {
      for (const s of [-1, 1]) {
        parts.push(part(new THREE.CylinderGeometry(0.06, 0.09, 3.2, 6), C(SILVER), { at: [s * (QUAY.x - 0.5), QUAY.top + 1.6, z + 3] }));
        lamps.push([s * (QUAY.x - 0.5), QUAY.top + 3.35, z + 3]);
      }
    }
  }
  // the arch at the quay's head: two tapering pillars and a pointed arc between them
  for (const s of [-1, 1]) parts.push(part(new THREE.CylinderGeometry(0.22, 0.34, 7, 8), C(COPING), { at: [s * (QUAY.x + 0.4), QUAY.top + 3.5, z0 + 1] }));
  parts.push(part(new THREE.TorusGeometry(QUAY.x + 0.4, 0.18, 6, 24, Math.PI), C(COPING), { at: [0, QUAY.top + 7, z0 + 1] }));
  const quay = merged(parts, stone, 'havens:quay');
  // (it doesn't move: solid, the walkers on it, the camera kept out of it)
  quay.userData.solid = true;
  group.add(quay);
  // the lamps' glow, pale as the evening
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d8).multiplyScalar(1.6) });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 8, 6), glow, lamps.length);
  const m = new THREE.Matrix4();
  lamps.forEach((p, i) => bulbs.setMatrixAt(i, m.makeTranslation(...p)));
  bulbs.name = 'havens:lamps';
  group.add(bulbs);
  // the gangway: a plank of pale wood from the quay's edge up onto her gunwale, its cleats across it
  // (its own mesh: taken in as she casts off)
  const [fx, fy] = GANGWAY.foot;
  const [hx, hy] = GANGWAY.head;
  const run = Math.hypot(hx - fx, hy - fy);
  const slope = Math.atan2(hy - fy, hx - fx);
  const along = (f, lift = 0) => [fx + (hx - fx) * f - Math.sin(slope) * lift, fy + (hy - fy) * f + Math.cos(slope) * lift, GANGWAY.z];
  const plank = [part(new THREE.BoxGeometry(run + 0.3, 0.07, 0.8), C(0xc9bba0), { at: along(0.5, -0.035), roll: slope })];
  for (let f = 0.12; f < 1; f += 0.19) plank.push(part(new THREE.BoxGeometry(0.05, 0.04, 0.72), C(0xa8987c), { at: along(f, 0.02), roll: slope }));
  // (and a silver rope rail along each side of it, on two posts)
  for (const s of [-1, 1]) {
    plank.push(part(new THREE.CylinderGeometry(0.02, 0.02, run, 5), C(SILVER), { at: [...along(0.5, 0.75).slice(0, 2), GANGWAY.z + s * 0.38], roll: slope - Math.PI / 2 }));
    for (const f of [0.05, 0.95]) plank.push(part(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 5), C(SILVER), { at: [...along(f, 0.37).slice(0, 2), GANGWAY.z + s * 0.38], roll: slope }));
  }
  const wood = road.material({ vertexColors: true });
  const gangway = merged(plank, wood, 'havens:gangway');
  group.add(gangway);
  const { ship, sail, materials } = buildShip(road);
  ship.position.set(SHIP.moor[0], WATER, SHIP.moor[1]);
  group.add(ship);
  return {
    group,
    ship,
    sail,
    gangway,
    lamps,
    dispose() {
      group.traverse((o) => o.geometry?.dispose());
      for (const mat of [stone, glow, wood, ...materials]) mat.dispose();
    },
  };
}
