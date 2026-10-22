// The Hog’s Head (the design’s §4.9): the other inn, down its lane off the
// High Street’s far end. One low room, dark at noon: windows so grimed the
// street is a brown glow through them, a bar of rough planks with a few
// bottles behind it, a fire that is mostly ash, candles stuck in bottles on
// the tables, a hog’s head on a board over the bar (the inn’s name, as the
// house keeps it) and the barman wiping a glass. He says nothing you could
// repeat. Something has been chewing a table leg.
//
// A room for rooms/host.js: build(rt, ctx) → room (its header says the shape);
// the frame: the floor’s middle at the origin, the lane door at +z.

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { createRoomKit, countOf } from './kit';
import { bench, fireplace, frame, table } from './parts/furniture';
import { createFire } from './parts/fire';
import { lamp, panes, shell } from './village/shell';
import { BOTTLES, createStock, fill } from './village/stock';
import { LINES, streetSide } from './village/plan';
import { figure } from '../cast/figures';

const W = 9;
const D = 8;
const H = 2.85;
const BAR = { x0: 0.9, x1: 4.2, z: -2.5, top: 1.04, d: 0.7 };
const ASK = [2.5, -1.75];
const LEG = [-2.6, 1.1];
const LAMP = 16; // dim, as a room kept dim on purpose is

// the hog’s head over the bar: a board, and on it the head, its snout and tusks and ears
function hog(kit, at) {
  const f = frame(kit, { at, ry: 0 });
  const hide = kit.paint('#6a4a36', { rough: 0.95, scan: 'bark', metres: 0.4, strength: 0.5 });
  const tusk = kit.paint('#d9cfb4', { rough: 0.5 });
  f.add('darkoak', new THREE.CylinderGeometry(0.42, 0.42, 0.05, 6).rotateX(Math.PI / 2), { z: 0.03 });
  f.add(hide, new THREE.SphereGeometry(0.22, 12, 10), { z: 0.2, scale: [1, 0.95, 1.1] });
  f.add(hide, new THREE.CylinderGeometry(0.1, 0.15, 0.3, 10).rotateX(Math.PI / 2), { y: -0.06, z: 0.42 });
  f.add(kit.paint('#5a3a30', { rough: 0.6 }), new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12).rotateX(Math.PI / 2), { y: -0.06, z: 0.575 });
  for (const s of [-1, 1]) {
    f.add(hide, new THREE.ConeGeometry(0.07, 0.18, 6), { x: s * 0.15, y: 0.2, z: 0.15, rz: -s * 0.5 });
    f.add(tusk, new THREE.ConeGeometry(0.018, 0.12, 6), { x: s * 0.09, y: -0.1, z: 0.5, rz: -s * 0.6 });
    f.add(kit.glow('#3a1a0a', 0.6), new THREE.SphereGeometry(0.02, 6, 5), { x: s * 0.09, y: 0.06, z: 0.37 });
  }
}

function build(rt, ctx = {}) {
  const tier = ctx.tier ?? rt?.quality?.tier ?? 'high';
  const props = ctx.props ?? {};
  const group = new THREE.Group();
  group.name = 'room:hogshead';
  const kit = createRoomKit({ tier });
  const floor = kit.paint('#3b2e22', { scan: 'wood', metres: 1.1, strength: 0.65, rough: 0.95 });
  const room = shell(kit, { w: W, d: D, h: H, floor, wall: '#6f604a', lower: 'darkoak', ceiling: '#4a3e30', beams: 4, sag: 0.1, door: { x: -0.6, w: 1.1, h: 2.05 }, windows: [-2.9, 2.5].map((x) => ({ x, w: 1.2, y: 1.0, h: 1.0 })), scan: 'mud' });
  panes(kit, room.panes, props.hour ?? 14, { grime: 0.8 });

  // the bar: rough planks on trestles, a shelf of bottles behind it, half of them empty
  const bx = (BAR.x0 + BAR.x1) / 2;
  kit.box('board', bx, 0, BAR.z, BAR.x1 - BAR.x0, BAR.top - 0.06, BAR.d);
  kit.box('darkoak', bx, BAR.top - 0.06, BAR.z, BAR.x1 - BAR.x0 + 0.1, 0.06, BAR.d + 0.08);
  kit.wall(BAR.x0, BAR.z, BAR.x1, BAR.z, 0.5);
  const shelf = frame(kit, { at: [bx, 0, -D / 2 + 0.2] });
  for (const y of [1.25, 1.75]) shelf.box('darkoak', 0, y, 0, 3, 0.04, 0.3);
  const bottles = createStock(fill([1.29, 1.79].map((y) => ({ at: [bx, y, -D / 2 + 0.2], ry: 0, w: 2.9, h: 0.45 })), { seed: 61, kinds: BOTTLES, tier: 'low' }), { tier });
  group.add(bottles.group);
  hog(kit, [bx, 2.25, -D / 2 + 0.02]);

  // three tables, a bench or two, stools that don’t match
  const tables = [
    [-2.6, 1.1, 0.3],
    [-2.4, -2.0, -0.2],
    [0.4, 1.5, 0.1],
  ];
  for (const [x, z, ry] of tables) {
    table(kit, { at: [x, 0, z], ry, len: 1.6, w: 0.85, top: 0.74, mat: 'board' });
    bench(kit, { at: [x + Math.cos(ry) * 0.75, 0, z - Math.sin(ry) * 0.75], ry, len: 1.4, seat: 0.44, mat: 'darkoak' });
    kit.solid(x, z, 0.95);
  }
  for (const [x, z] of [
    [-1.6, 1.2],
    [0.2, 2.6],
    [-1.4, -2.3],
  ])
    kit.cyl('oak', x, 0, z, 0.17, 0.2, 0.45, { seg: 8 });
  // (the chewed leg: a bite out of the near leg of the first table, pale where the wood shows)
  // (on the far leg from the door, where the door’s own prompt doesn’t reach)
  const [lx, lz] = frame(kit, { at: [LEG[0], 0, LEG[1]], ry: 0.3 }).to(0, -0.45);
  kit.box(kit.paint('#a88a62', { rough: 1 }), lx + 0.06, 0.22, lz, 0.05, 0.12, 0.1, { ry: 0.3 });
  // candles stuck in bottles, wax down their necks
  const wax = kit.paint('#d8ccb0', { rough: 0.7 });
  for (const [x, z] of tables) {
    kit.cyl(kit.paint('#2e3a24', { rough: 0.15 }), x + 0.2, 0.74, z, 0.04, 0.045, 0.2, { seg: 8 });
    kit.cyl(wax, x + 0.2, 0.94, z, 0.018, 0.018, 0.08, { seg: 6 });
    kit.cyl(wax, x + 0.2, 0.8, z, 0.046, 0.05, 0.06, { seg: 8 });
    kit.add(kit.glow('#ff9a4a', 2.4), new THREE.SphereGeometry(0.016, 6, 5), { at: [x + 0.2, 1.05, z], scale: [1, 1.7, 1] });
  }

  // the fire, mostly ash, in the left-hand wall
  const fireAt = fireplace(kit, { at: [-W / 2 + 0.35, 0, -1.2], ry: Math.PI / 2, w: 1.6, h: 1.4, mat: 'rock' });
  const fire = createFire({ at: fireAt, w: 0.9, h: 0.38, tongues: 3, tier, colour: '#ff6a2a' });
  fire.set({ k: 0.55 });
  group.add(fire.group);
  kit.solid(-W / 2 + 0.6, -1.2, 0.8);

  // the light: one lamp, the candles and the grimy windows; the room stays dim
  const lamps = [lamp(kit, group, { at: [0.6, H - 0.25, -0.6], tier, k: LAMP, colour: '#ffb060', distance: 8 }), lamp(kit, group, { at: [bx - 0.6, H - 0.2, BAR.z + 0.2], drop: 0.45, tier, k: LAMP * 0.8, colour: '#ffb060', distance: 6 })];
  const hemi = new THREE.HemisphereLight(0xc8b090, 0x3a2c1e, tier === 'low' ? 2.0 : 1.4);
  group.add(hemi);
  kit.build(group);

  // the barman behind his bar, a glass in his hand
  const barman = figure('aberforth', { rt, seed: 13 });
  barman.group.position.set(ASK[0] + 0.3, 0, BAR.z - 0.8);
  barman.set({ base: null, speed: 0 });
  group.add(barman.group);
  const glassMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#a8a090'), roughness: 0.3, transparent: true, opacity: 0.6 });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.1, 10), glassMat);
  glass.position.set(ASK[0] + 0.1, BAR.top + 0.05, BAR.z - 0.05);
  group.add(glass);
  let gone = false;
  barman.ready.then(() => !gone && ctx.house?.adopt?.(group));

  // dust in the windows’ light, turning slowly
  const motes = [];
  let s = 11;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (tier === 'low' ? 0 : 60); i++) motes.push([-3.4 + rnd() * 1.4 + (i % 2) * 5.4, 0.6 + rnd() * 1.8, D / 2 - 0.3 - rnd() * 2.4]);
  const moteGeo = new THREE.SphereGeometry(0.006, 4, 3);
  const moteMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#e8d8b0'), emissive: new THREE.Color('#5a4a30'), roughness: 1 });
  const moteMesh = new THREE.InstancedMesh(moteGeo, moteMat, Math.max(1, motes.length));
  moteMesh.count = motes.length;
  group.add(moteMesh);
  const m4 = new THREE.Matrix4();

  const street = streetSide('hogshead');
  let t = 0;
  return {
    id: 'hogshead',
    name: 'The Hog’s Head',
    group,
    spawn: { at: [room.door[0], 0, room.door[1] - 0.5], yaw: 0 },
    colliders: kit.colliders,
    floors: [],
    bounds: room.bounds,
    floorAt: () => 0,
    doors: [{ id: 'lane', at: [-0.6, D / 2 - 0.25], r: 0.8, name: 'Hogsmeade', verb: 'Go out', faces: 0, to: 'hogsmeade', toAt: street.at, toYaw: street.yaw }],
    out: { to: 'hogsmeade', at: street.at, yaw: street.yaw },
    spots: [
      { id: 'barman', at: ASK, r: 0.7, verb: 'Ask', label: 'The barman' },
      { id: 'leg', at: [LEG[0] - 0.5, LEG[1] - 1.3], r: 0.5, verb: 'Look at', label: 'The table leg' },
    ],
    places: [{ id: 'bar', name: 'The bar', at: [bx, BAR.z], r: 2 }],
    poses: {
      door: { at: [-0.6, 1.55, D / 2 - 1.0], look: [1.8, 1.3, -D / 2] },
      bar: { at: [0.6, 1.5, 0.6], look: [2.6, 1.5, -D / 2 + 0.2] },
      window: { at: [1.2, 1.4, -1.2], look: [-2.9, 1.3, D / 2] },
    },
    use(id) {
      if (id === 'barman') {
        ctx.say?.(LINES.barman);
        barman.look?.(group.localToWorld(new THREE.Vector3(ASK[0], 1.5, ASK[1])));
      } else if (id === 'leg') ctx.say?.(LINES.goatless);
    },
    step(dt) {
      t += dt;
      fire.step(dt);
      barman.tick(dt);
      // (the glass turned in the cloth, round and round)
      glass.rotation.y = t * 1.4;
      glass.position.y = BAR.top + 0.05 + Math.sin(t * 1.4) * 0.01;
      lamps.forEach((l, i) => l && (l.intensity = LAMP * (i ? 0.8 : 1) * (0.9 + 0.1 * Math.sin(t * 3.1 + i))));
      motes.forEach((p, i) => {
        m4.makeTranslation(p[0] + Math.sin(t * 0.13 + i) * 0.15, p[1] + Math.sin(t * 0.09 + i * 1.7) * 0.2, p[2] + Math.cos(t * 0.11 + i) * 0.15);
        moteMesh.setMatrixAt(i, m4);
      });
      moteMesh.instanceMatrix.needsUpdate = motes.length > 0;
    },
    set() {},
    info: () => ({ ...countOf(group) }),
    dispose() {
      gone = true;
      fire.dispose();
      barman.dispose();
      bottles.dispose();
      glass.geometry.dispose();
      glassMat.dispose();
      moteMesh.dispose();
      moteGeo.dispose();
      moteMat.dispose();
      kit.dispose();
      group.removeFromParent();
    },
  };
}

export default { id: 'hogshead', name: 'The Hog’s Head', build };
