// The Ravenclaw common room (the design’s §4.4): a wide round room at the top
// of the west tower, airy, in through the door with the eagle knocker that
// asks a riddle. Arched windows hung with blue and bronze silk all round, a
// domed ceiling painted with stars and the carpet under it midnight blue and
// starred to match, bookcases between the windows, tables to work at, and by
// the door up to the dormitories a tall statue of Rowena Ravenclaw in white
// marble with her diadem. The Grey Lady drifts through.

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { float, sin, time, vec3, attribute } from 'three/tsl';
import { HOUSES } from '../../rules/sorting';
import { bookcase, chair, fireplace, table } from '../parts/furniture';
import { commonRoom, roundWalls } from './shared';
import { createWindows } from '../parts/glass';
import { figure } from '../../cast/figures';

const R = 9;
const H = 7;
const DOME = 4.5; // m the dome rises over the walls
const [BLUE, BRONZE] = HOUSES.ravenclaw.colours;

// the dome’s painted stars: little bright points on its inside, twinkling each on its own
function stars(count = 360) {
  const geo = new THREE.OctahedronGeometry(0.035, 0);
  const at = new Float32Array(count * 4);
  let a = 77;
  const rnd = () => ((a = (a * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < count; i++) {
    // (over the dome’s inside, a little in from the paint)
    const u = rnd() * Math.PI * 2;
    const v = Math.acos(1 - rnd() * 0.95);
    const r = R - 0.15;
    at.set([Math.sin(v) * Math.cos(u) * r, H + Math.cos(v) * DOME - 0.1, Math.sin(v) * Math.sin(u) * r, rnd() * 6.28], i * 4);
  }
  geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(at, 4));
  const mat = new MeshBasicNodeMaterial({ fog: false });
  mat.userData.noHouse = true;
  const s = attribute('aStar', 'vec4');
  mat.positionNode = attribute('position', 'vec3').mul(sin(time.mul(1.3).add(s.w)).mul(0.35).add(1)).add(s.xyz);
  mat.colorNode = vec3(1.0, 0.86, 0.6).mul(sin(time.mul(2.1).add(s.w.mul(3))).mul(0.3).add(1.2)).mul(float(1.6));
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const id = new THREE.Matrix4();
  for (let i = 0; i < count; i++) mesh.setMatrixAt(i, id);
  mesh.frustumCulled = false;
  return { mesh, dispose: () => (geo.dispose(), mat.dispose()) };
}

export default commonRoom({
  id: 'ravenclaw',
  name: 'The Ravenclaw common room',
  house: 'ravenclaw',
  bounds: { x0: -R + 0.6, x1: R - 0.6, z0: -R + 0.6, z1: R - 0.6 },
  colliders: [
    { kind: 'circle', at: [0, -R + 1.1], r: 1.4 },
    { kind: 'box', at: [-3, 0], w: 3.2, d: 1.2, turn: 0 },
    { kind: 'box', at: [3, 0], w: 3.2, d: 1.2, turn: 0 },
    { kind: 'circle', at: [5.6, 4.6], r: 0.9 },
  ],
  spawn: { at: [0, 0, R - 1.6], yaw: 0 },
  floo: [0, -R + 2.2],
  bed: [6.6, 2.8],
  bedName: 'The dormitories, and your bed under its blue hangings',
  boardAt: [-3.4, R - 1.6],
  ghostPath: [[-5, -3], [5, -3], [5, 3], [-5, 3]],
  light: { hemi: [0xc8d8ff, 0x1c2030, 1.0], points: [[0, 1.5, -R + 2.2, 0xff9a4a, 12], [-4, 4, 0, 0xbfd0ff, 6], [4, 4, 0, 0xbfd0ff, 6], [0, 8, 0, 0xffe6c0, 6]] },
  poses: {
    dome: { at: [0, 1.5, 5], look: [0, 10, -2] },
    statue: { at: [2.8, 1.6, 0.5], look: [6.2, 2, 4.8] },
    room: { at: [0, 1.6, 7], look: [0, 2, -6] },
  },
  make(kit, { renderer, group, rt }) {
    const gaps = [];
    const windowsAt = [-2.3, -1.6, 1.6, 2.3, -0.9, 0.9];
    roundWalls(kit, { r: R, h: H, mat: 'ashlar', gaps });
    kit.cyl('board', 0, -0.2, 0, R + 0.6, R + 0.6, 0.2, { seg: 36 });
    // the dome: midnight blue, painted (its stars a draw of their own)
    const dome = new THREE.SphereGeometry(R + 0.2, 36, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.scale(1, DOME / (R + 0.2), 1);
    dome.translate(0, H, 0);
    const domeMat = new MeshStandardNodeMaterial({ color: new THREE.Color('#141c3a'), roughness: 0.9, side: THREE.BackSide });
    const domeMesh = new THREE.Mesh(dome, domeMat);
    group.add(domeMesh);
    kit.cyl(kit.paint(BRONZE, { rough: 0.35, metal: 0.8 }), 0, H - 0.05, 0, R + 0.05, R + 0.05, 0.18, { seg: 36, open: true });
    const sky = stars(rt?.quality?.tier === 'low' ? 140 : 360);
    group.add(sky.mesh);
    // the windows, silk either side of each in the house’s colours
    const silk = kit.paint(BLUE, { rough: 0.5 });
    const bronze = kit.paint(BRONZE, { rough: 0.45, metal: 0.4 });
    for (const a of windowsAt) {
      const x = Math.sin(a) * (R - 0.35);
      const z = Math.cos(a) * (R - 0.35);
      for (const side of [-1, 1]) {
        const ox = Math.cos(a) * side * 1.0;
        const oz = -Math.sin(a) * side * 1.0;
        kit.box(silk, x + ox, 0.3, z + oz, 0.5, 5.4, 0.12, { ry: a });
        kit.box(bronze, x + ox, 5.7, z + oz, 0.6, 0.12, 0.16, { ry: a });
      }
    }
    // bookcases between them, a hearth, the tables to work at
    for (const a of [-1.25, 1.25, 2.85, -2.85]) bookcase(kit, { at: [Math.sin(a) * (R - 0.45), 0, Math.cos(a) * (R - 0.45)], ry: a + Math.PI, w: 2, h: 3.4 });
    const fireAt = fireplace(kit, { at: [0, 0, -R + 0.5], ry: 0, w: 2.8, h: 2.4, mat: 'ashlar' });
    for (const x of [-3, 3]) {
      table(kit, { at: [x, 0, 0], ry: 0, len: 3, w: 1.1, top: 0.76, mat: 'oak' });
      for (const dx of [-1, 0, 1]) {
        chair(kit, { at: [x + dx, 0, -0.95], ry: 0, back: 1.0 });
        chair(kit, { at: [x + dx, 0, 0.95], ry: Math.PI, back: 1.0 });
      }
    }
    // the statue’s plinth, and the doorway up to the dormitories beside it
    kit.cyl('ashlar', 5.6, 0, 4.6, 0.75, 0.85, 0.7, { seg: 16 });
    kit.box(kit.paint('#0c0e18'), Math.sin(0.95) * (R - 0.05), 0, Math.cos(0.95) * (R - 0.05), 1.4, 2.6, 0.1, { ry: 0.95 + Math.PI });
    kit.box('board', -3.4, 1.0, R - 0.75, 1.9, 1.25, 0.08, { ry: Math.PI + 0.37 });
    const windows = createWindows(
      windowsAt.map((a) => ({ at: [Math.sin(a) * (R - 0.05), 1.0, Math.cos(a) * (R - 0.05)], w: 1.5, h: 4.6, ry: a + Math.PI })),
      { renderer },
    );
    windows.set({ day: 0, dusk: 0.12 });
    group.add(windows.group);
    // Rowena in white marble: one of the cast stood still in stone, her diadem in gold on her brow
    const marble = new MeshStandardNodeMaterial({ color: new THREE.Color('#ece8e0'), roughness: 0.35, metalness: 0 });
    const statue = figure('greylady', { rt, height: 2.3, ink: false, material: () => marble });
    statue.group.position.set(5.6, 0.7, 4.6);
    statue.group.rotation.y = -2.3;
    statue.set({ base: 'idle' });
    let posed = false;
    statue.ready.then((ok) => {
      if (!ok || posed) return;
      posed = true;
      // (one breath of the idle, then still: a statue doesn’t breathe)
      statue.tick(0.4);
      const head = statue.bone('Head');
      if (head) {
        const diadem = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 20), kit.paint('#d8b450', { rough: 0.25, metal: 1 }));
        diadem.rotation.x = Math.PI / 2;
        diadem.position.y = 0.09;
        diadem.scale.setScalar(1 / Math.max(1e-3, head.getWorldScale(new THREE.Vector3()).x));
        head.add(diadem);
      }
    });
    group.add(statue.group);
    return {
      fires: [{ at: fireAt, w: 1.5, h: 1.2, tongues: 4 }],
      board: { w: 1.75, h: 1.12, at: [-3.4, 1.62, R - 0.8], ry: Math.PI + 0.37 },
      rug: { colours: ['#18204a', BRONZE, '#0e1430'], r: 4.2, at: [0, 0.01, 0] },
      live: [
        {
          dispose() {
            dome.dispose();
            domeMat.dispose();
            sky.dispose();
            windows.dispose();
            statue.dispose();
            marble.dispose();
          },
        },
      ],
    };
  },
});
