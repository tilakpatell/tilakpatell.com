// The Defence Against the Dark Arts classroom (the design’s §4.4): a long,
// high room, the desks pushed back against the walls for the duelling club,
// the platform set up down the middle with a step at each end; a stair up to
// the professor’s office door on its gallery at the back; the skeleton of
// something with wings hung from the beams; and in the corner the old
// wardrobe that won’t keep still, because there is a boggart in it, with the
// gramophone on the desk beside it that the lesson wants. Two lessons are
// held here (Lane E’s): the duel on the platform and the boggart at the
// wardrobe, `lessons.duel` and `lessons.boggart`.

import * as THREE from 'three';
import { bench, rod, table } from './parts/furniture';
import { commonRoom, lessonDoor } from './common/shared';
import { createWindows } from './parts/glass';

const W = 9;
const L = 13;
const H = 8.5;
const STAGE = { x: 1.5, z0: -6.5, z1: 6.5, y: 0.6 }; // the duelling platform
const GALLERY = { z: -L + 2.6, y: 3.0 };
const WARDROBE = [-6.6, -9.4];

const floorAt = (x, z) => {
  if (Math.abs(x) <= STAGE.x && z >= STAGE.z0 && z <= STAGE.z1) return STAGE.y;
  // (a step at each end, half the platform’s height)
  if (Math.abs(x) <= STAGE.x && ((z < STAGE.z0 && z >= STAGE.z0 - 0.6) || (z > STAGE.z1 && z <= STAGE.z1 + 0.6))) return STAGE.y / 2;
  return 0;
};

export default commonRoom({
  id: 'defence',
  name: 'The Defence Against the Dark Arts classroom',
  bounds: { x0: -W + 0.5, x1: W - 0.5, z0: -L + 3.4, z1: L - 0.5 },
  floorAt,
  colliders: [
    // the platform’s long sides (up it by its ends), the desks along the walls, the wardrobe, the gramophone’s desk
    ...[-1, 1].map((side) => ({ kind: 'box', at: [side * (STAGE.x + 0.1), 0], w: 0.3, d: STAGE.z1 - STAGE.z0, turn: 0 })),
    ...[-1, 1].flatMap((side) => [-4, 1, 6].map((z) => ({ kind: 'box', at: [side * (W - 1.3), z], w: 1.6, d: 3.4, turn: 0 }))),
    { kind: 'box', at: WARDROBE, w: 1.9, d: 1.0, turn: 0 },
    { kind: 'box', at: [-3.8, -9.4], w: 1.6, d: 0.9, turn: 0 },
    { kind: 'box', at: [4.8, GALLERY.z + 1.4], w: 1.6, d: 4.2, turn: 0 },
  ],
  spawn: { at: [0, 0, L - 1.4], yaw: 0 },
  places: [
    { id: 'defence', name: 'The Defence classroom', at: [0, 0], r: 12 },
    { id: 'wardrobe', name: 'The wardrobe', at: WARDROBE, r: 2.5 },
  ],
  light: { hemi: [0xd8e0f0, 0x2a2a30, 0.95], points: [[0, 5.5, 0, 0xfff0d8, 8], [-5.6, 2.4, -8.6, 0xffc080, 5], [3, 4, 8, 0xe8f0ff, 5]] },
  poses: {
    platform: { at: [0, 2.2, L - 1.5], look: [0, 0.8, -6] },
    wardrobe: { at: [-3.2, 1.5, -5.6], look: [-6.6, 1.4, -9.6] },
    skeleton: { at: [2, 1.5, 6], look: [0, 6.6, -1] },
  },
  make(kit, { renderer, group, toast, lesson }) {
    // the room: stone, a high open roof of dark beams, flags underfoot
    kit.box('stone', -W - 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('stone', 0, 0, -L - 0.5, W * 2, H, 1);
    kit.box('stone', 0, 0, L + 0.5, W * 2, H, 1);
    kit.box('flags', 0, -0.3, 0, W * 2, 0.3, L * 2);
    kit.box('darkoak', 0, H, 0, W * 2 + 2, 0.3, L * 2 + 2);
    for (let z = -L + 2; z < L; z += 3.2) {
      kit.box('darkoak', 0, H - 0.6, z, W * 2, 0.35, 0.35);
      kit.box('darkoak', 0, H - 1.6, z, 0.3, 1.0, 0.3);
    }
    // windows down the right wall
    const wins = [-6, -1, 4, 9];
    kit.box('stone', W + 0.5, 0, 0, 1, 1.6, L * 2 + 2);
    kit.box('stone', W + 0.5, 6.4, 0, 1, H - 6.4, L * 2 + 2);
    let z0 = -L - 1;
    for (const z of [...wins, L + 3]) {
      const a = z - 1.1;
      if (a > z0) kit.box('stone', W + 0.5, 1.6, (z0 + a) / 2, 1, 4.8, a - z0);
      z0 = z + 1.1;
    }
    const windows = createWindows(wins.map((z) => ({ at: [W + 0.02, 1.6, z], w: 2.0, h: 4.8, ry: -Math.PI / 2 })), { renderer });
    windows.set({ day: 0.55, dusk: 0.2 });
    group.add(windows.group);
    // the duelling platform: a long stage of boards on a stone kerb, a step at each end, a red line down its middle
    kit.box('stonedark', 0, 0, 0, STAGE.x * 2 + 0.1, STAGE.y - 0.08, STAGE.z1 - STAGE.z0);
    kit.box('board', 0, STAGE.y - 0.08, 0, STAGE.x * 2 + 0.2, 0.08, STAGE.z1 - STAGE.z0 + 0.1);
    kit.box(kit.paint('#8a1a1a', { rough: 0.8 }), 0, STAGE.y + 0.001, 0, 0.12, 0.01, STAGE.z1 - STAGE.z0 - 0.6);
    for (const z of [STAGE.z0 - 0.3, STAGE.z1 + 0.3]) kit.box('stonedark', 0, 0, z, STAGE.x * 2, STAGE.y / 2, 0.6);
    // the desks pushed back to the walls, their benches up on them
    for (const side of [-1, 1])
      for (const z of [-4, 1, 6]) {
        table(kit, { at: [side * (W - 1.3), 0, z], ry: 0, len: 3.2, w: 1.0, top: 0.76, mat: 'oak' });
        bench(kit, { at: [side * (W - 1.3), 0.79, z], ry: 0, len: 3.0, mat: 'oak' });
      }
    // the stair up the right to the office door on its gallery
    const steps = 10;
    for (let i = 0; i < steps; i++) kit.box('stonedark', 4.8, 0, GALLERY.z + 3.4 - i * 0.34, 1.4, ((i + 1) / steps) * GALLERY.y, 0.34);
    kit.box('stonedark', 0, 0, -L + 1.3, W * 2, GALLERY.y, 2.6);
    kit.box('darkoak', 0, GALLERY.y, -L + 2.55, W * 2, 1.0, 0.1);
    for (let x = -W + 0.5; x < W; x += 0.6) kit.box('darkoak', x, GALLERY.y, -L + 2.55, 0.06, 1.0, 0.06);
    kit.box('darkoak', 3.2, GALLERY.y, -L + 0.06, 1.4, 2.4, 0.12);
    kit.box('iron', 3.75, GALLERY.y + 1.1, -L + 0.14, 0.05, 0.14, 0.05);
    // the wardrobe: tall, old, its doors shut (the left one shudders), on clawed feet
    kit.box('darkoak', WARDROBE[0], 0.12, WARDROBE[1], 1.8, 2.4, 0.9);
    kit.box('darkoak', WARDROBE[0], 2.52, WARDROBE[1], 1.95, 0.18, 1.0);
    for (const x of [-0.8, 0.8]) for (const z of [-0.36, 0.36]) kit.cyl('iron', WARDROBE[0] + x, 0, WARDROBE[1] + z, 0.06, 0.04, 0.12, { seg: 6 });
    kit.box('oak', WARDROBE[0] + 0.45, 0.25, WARDROBE[1] + 0.455, 0.84, 2.1, 0.02);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.84, 2.1, 0.05), kit.mat('oak'));
    leaf.geometry.translate(0.42, 1.05, 0);
    const hinge = new THREE.Group();
    hinge.position.set(WARDROBE[0] - 0.88, 0.25, WARDROBE[1] + 0.47);
    hinge.add(leaf);
    group.add(hinge);
    // the gramophone on its desk beside it, its horn turned to the room
    kit.box('oak', -3.8, 0, -9.4, 1.4, 0.8, 0.8);
    kit.box('darkoak', -3.8, 0.8, -9.4, 0.5, 0.2, 0.5);
    kit.cyl(kit.paint('#151210', { rough: 0.3 }), -3.8, 1.0, -9.4, 0.2, 0.2, 0.01, { seg: 20 });
    const horn = new THREE.ConeGeometry(0.34, 0.6, 18, 1, true);
    horn.rotateZ(Math.PI / 2);
    kit.add('brass', horn, { at: [-3.55, 1.38, -9.4], ry: -0.6 });
    rod(kit, 'brass', [-3.8, 1.0, -9.4], [-3.6, 1.32, -9.4], 0.025);
    // something with wings hung from the beams by chains: a spine, its ribs, a long skull
    const bone = kit.paint('#d8ccb0', { rough: 0.7 });
    const spine = (t) => [Math.sin(t * Math.PI) * 1.4 - 0.7, 6.6 + Math.sin(t * 2.6) * 0.35, -7 + t * 14];
    for (let i = 0; i < 34; i++) {
      const t = i / 33;
      const [x, y, z] = spine(t);
      kit.add(bone, new THREE.SphereGeometry(0.16 - Math.abs(t - 0.4) * 0.12, 6, 4), { at: [x, y, z] });
      // the ribs, the ribcage’s third of it
      if (t > 0.25 && t < 0.55)
        for (const side of [-1, 1]) {
          const r = 0.9 * Math.sin(((t - 0.25) / 0.3) * Math.PI);
          rod(kit, bone, [x, y, z], [x + side * r, y - r * 0.9, z], 0.035, { seg: 4 });
        }
    }
    const [hx, hy, hz] = spine(1);
    kit.add(bone, new THREE.ConeGeometry(0.26, 1.1, 6), { at: [hx, hy, hz + 0.5], rx: Math.PI / 2 });
    // the wings’ bones, spread
    for (const side of [-1, 1]) {
      const [sx, sy, sz] = spine(0.38);
      const elbow = [sx + side * 2.6, sy + 0.8, sz + 0.6];
      rod(kit, bone, [sx, sy, sz], elbow, 0.06, { seg: 5 });
      for (const f of [-1.6, -0.4, 0.8]) rod(kit, bone, elbow, [elbow[0] + side * 2.2, elbow[1] - 0.6, elbow[2] + f], 0.03, { seg: 4 });
    }
    for (const t of [0.15, 0.5, 0.85]) {
      const [x, y, z] = spine(t);
      rod(kit, 'iron', [x, y, z], [x, H - 0.6, z], 0.012, { seg: 4 });
    }
    let t = 0;
    let rattled = false;
    return {
      lessons: { duel: { at: [0, STAGE.y, STAGE.z1 - 1.2], yaw: 0 }, boggart: { at: [WARDROBE[0], 0, WARDROBE[1] + 3.2], yaw: 0 } },
      doors: [
        lessonDoor({ id: 'duel', name: 'The duelling club', at: [0, STAGE.z1 + 1.2], spot: [0, STAGE.y, STAGE.z1 - 1.2], yaw: 0, teacher: 'The duelling club', lesson, toast }),
        lessonDoor({ id: 'boggart', name: 'The boggart', at: [WARDROBE[0] + 1.6, WARDROBE[1] + 2.6], spot: [WARDROBE[0], 0, WARDROBE[1] + 3.2], yaw: 0, teacher: 'Nobody', lesson, toast }),
        {
          id: 'wardrobe',
          at: [WARDROBE[0], WARDROBE[1] + 1.4],
          r: 1.0,
          verb: 'Listen at',
          name: 'The wardrobe',
          act: () => toast(rattled ? 'It goes quiet when you lean close, which is worse.' : 'Something inside thumps against the door, once, twice. It knows you are there.'),
        },
      ],
      live: [
        {
          step(dt) {
            t += dt;
            // (the boggart in it: the left door knocks open a crack every few seconds and bangs shut)
            const k = (t % 5.5) / 5.5;
            const knock = k > 0.86 ? Math.sin(((k - 0.86) / 0.14) * Math.PI) : 0;
            hinge.rotation.y = -0.16 * knock * (0.6 + 0.4 * Math.sin(t * 31));
            if (knock > 0.5) rattled = true;
          },
          dispose() {
            leaf.geometry.dispose();
            windows.dispose();
          },
        },
      ],
    };
  },
});
