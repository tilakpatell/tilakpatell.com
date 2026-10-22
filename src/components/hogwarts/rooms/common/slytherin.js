// The Slytherin common room (the design’s §4.4): a long low dungeon under the
// Black Lake, in through a bare stretch of wall that slides back for the
// password. Rough dark stone, a carved mantel over the fire with serpents in
// silver along it, black leather and green lamps hung on chains, and down one
// wall the windows into the lake: green water lit from above, weed moving in
// it and, now and then, the giant squid’s arm going slowly by. The Bloody
// Baron drifts through and says nothing.

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { abs, float, fract, mix, mx_fractal_noise_float, positionWorld, sin, smoothstep, time, uniform, uv, vec3 } from 'three/tsl';
import { HOUSES } from '../../rules/sorting';
import { fireplace } from '../parts/furniture';
import { commonRoom, lowTable, sofa } from './shared';
import { createBanners } from '../banners';

const W = 9; // m from the middle to the long walls
const L = 6; // m to the end walls
const H = 4.2;
const [GREEN, SILVER] = HOUSES.slytherin.colours;
const SQUID_EVERY = 38; // s between the squid’s passes

// the lake through the glass: green from above, darker below, the light
// moving on it, weed, and the squid’s arm crossing the wall now and then
function lakeMaterial(uSquid) {
  const m = new MeshBasicNodeMaterial({ fog: false });
  m.userData.noHouse = true;
  const p = uv();
  const depth = mix(vec3(0.02, 0.09, 0.07), vec3(0.12, 0.42, 0.32), p.y.pow(1.4));
  const along = positionWorld.z.mul(0.35);
  const caustic = mx_fractal_noise_float(vec3(along, p.y.mul(3), time.mul(0.25)), 3).mul(0.5).add(0.5);
  const light = smoothstep(0.55, 0.85, caustic).mul(p.y).mul(0.35);
  // weed: dark ribbons up from the bottom, swaying
  const weed = smoothstep(0.06, 0.0, abs(fract(along.mul(1.7).add(sin(p.y.mul(4).add(time.mul(0.6))).mul(0.08))).sub(0.5))).mul(smoothstep(0.7, 0.1, p.y));
  // the squid’s arm: a dark curl crossing the wall as uSquid goes 0 → 1
  const x = positionWorld.z.div(L * 2).add(0.5).sub(uSquid.mul(1.6).sub(0.3));
  const curl = abs(p.y.sub(float(0.55).add(sin(x.mul(9).add(time)).mul(0.12)))).sub(smoothstep(0.4, 0.0, abs(x)).mul(0.07));
  const arm = smoothstep(0.02, 0.0, curl).mul(smoothstep(0.45, 0.2, abs(x)));
  m.colorNode = depth.add(vec3(0.3, 0.6, 0.45).mul(light)).mul(float(1).sub(weed.mul(0.6))).mul(float(1).sub(arm.mul(0.85)));
  return m;
}

export default commonRoom({
  id: 'slytherin',
  name: 'The Slytherin common room',
  house: 'slytherin',
  bounds: { x0: -W + 0.5, x1: W - 0.9, z0: -L + 0.5, z1: L - 0.5 },
  colliders: [
    { kind: 'circle', at: [-W + 1, 0], r: 1.4 },
    { kind: 'box', at: [-5.2, -1.8], w: 2.4, d: 0.9, turn: 0 },
    { kind: 'box', at: [-5.2, 1.8], w: 2.4, d: 0.9, turn: 0 },
    { kind: 'circle', at: [-5.2, 0], r: 0.6 },
    { kind: 'box', at: [3, -3.4], w: 2.4, d: 0.9, turn: 0 },
    { kind: 'circle', at: [3, -2.2], r: 0.55 },
  ],
  spawn: { at: [W - 2.2, 0, 0], yaw: Math.PI / 2 },
  floo: [-W + 2, 0],
  bed: [0, L - 1.2],
  bedName: 'The dormitories, and your green-hung bed',
  boardAt: [W - 2.4, -L + 1.3],
  ghostPath: [[-3, -3], [5, -2], [5, 3], [-3, 3]],
  light: { hemi: [0x9ad8b8, 0x10140f, 0.75], points: [[-W + 2, 1.4, 0, 0xff9a4a, 12], [-2, 3.3, -2, 0x58d890, 7], [3, 3.3, 2, 0x58d890, 7], [6, 2.4, -3, 0x6fd0c0, 5]] },
  poses: {
    lake: { at: [-4, 1.5, -1], look: [W, 1.8, 2] },
    hearth: { at: [2, 1.5, 0.5], look: [-W, 1.4, 0] },
  },
  make(kit, { renderer, group }) {
    // the dungeon: rough dark stone all round, a low vault of it, flags underfoot
    kit.box('stonedark', -W - 0.5, 0, 0, 1, H, L * 2 + 2);
    kit.box('stonedark', 0, 0, -L - 0.5, W * 2, H, 1);
    kit.box('stonedark', 0, 0, L + 0.5, W * 2, H, 1);
    kit.box('flags', 0, -0.3, 0, W * 2, 0.3, L * 2);
    kit.box('rock', 0, H, 0, W * 2 + 2, 0.5, L * 2 + 2);
    for (let i = -3; i <= 3; i++) kit.box('stonedark', i * 2.6, H - 0.45, 0, 0.5, 0.45, L * 2);
    // the lake wall: stone between the windows, the windows deep in it
    const panes = [-3.8, 0, 3.8];
    kit.box('stonedark', W + 0.5, 0, 0, 1, 0.9, L * 2);
    kit.box('stonedark', W + 0.5, 3.4, 0, 1, H - 3.4, L * 2);
    let z0 = -L;
    for (const z of [...panes, L + 1.5]) {
      const a = z - 1.5;
      if (a > z0) kit.box('stonedark', W + 0.5, 0.9, (z0 + a) / 2, 1, 2.5, a - z0);
      z0 = z + 1.5;
    }
    // the hearth under its carved mantel, serpents in silver along the lintel
    const fireAt = fireplace(kit, { at: [-W + 0.5, 0, 0], ry: Math.PI / 2, w: 3, h: 2.4, mat: 'stonedark' });
    for (let i = 0; i < 9; i++) kit.box(kit.paint(SILVER, { rough: 0.3, metal: 0.9 }), -W + 0.72, 2.75 + Math.sin(i * 1.1) * 0.12, -1.6 + i * 0.4, 0.06, 0.12, 0.36);
    // black leather drawn up to it, and by the lake
    sofa(kit, { at: [-5.2, 0, -1.8], ry: 0, cloth: '#141816', len: 2.4 });
    sofa(kit, { at: [-5.2, 0, 1.8], ry: Math.PI, cloth: '#141816', len: 2.4 });
    lowTable(kit, { at: [-5.2, 0, 0], r: 0.55, mat: 'darkoak' });
    sofa(kit, { at: [3, 0, -3.4], ry: 0, cloth: '#1c2420', len: 2.4 });
    lowTable(kit, { at: [3, 0, -2.2], r: 0.45 });
    // the green lamps on their chains
    const lamps = [[-2, -2], [3, 2], [-2, 3.2], [6, -3]];
    for (const [x, z] of lamps) {
      kit.cyl('iron', x, 3.2, z, 0.015, 0.015, H - 3.2, { seg: 4 });
      kit.cyl(kit.glow('#7cffb0', 1.6), x, 2.95, z, 0.16, 0.22, 0.3, { seg: 10 });
      kit.cyl('iron', x, 3.22, z, 0.24, 0.12, 0.08, { seg: 10 });
    }
    // the bare wall you came in through, and the dormitory passage
    kit.box('stonedark', W - 0.4, 0, L - 1.6, 0.2, 2.6, 1.6);
    kit.box(kit.paint('#0c100c'), 0, 0, L - 0.02, 1.6, 2.4, 0.06);
    kit.box('darkoak', W - 2.4, 1.0, -L + 0.06, 1.9, 1.25, 0.08);
    // the lake through the glass
    const uSquid = uniform(0);
    const lake = lakeMaterial(uSquid);
    const glass = new THREE.Group();
    for (const z of panes) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.5), lake);
      m.position.set(W + 0.15, 0.9 + 1.25, z);
      m.rotation.y = -Math.PI / 2;
      glass.add(m);
      // (the leading: an iron cross over each)
      kit.box('iron', W + 0.12, 0.9, z, 0.05, 2.5, 0.06);
      kit.box('iron', W + 0.12, 2.1, z, 0.05, 0.06, 3);
    }
    group.add(glass);
    const banners = createBanners([{ house: 'slytherin', at: [0, H - 0.4, -L + 0.12], ry: 0 }, { house: 'slytherin', at: [-3.4, H - 0.4, -L + 0.12], ry: 0 }], { renderer, w: 1.3, h: 3 });
    group.add(banners.group);
    let t = 7;
    return {
      fires: [{ at: fireAt, w: 1.6, h: 1.2, tongues: 5, colour: '#ff8a3c' }],
      board: { w: 1.75, h: 1.12, at: [W - 2.4, 1.62, -L + 0.12], ry: 0 },
      rug: { colours: [GREEN, SILVER, '#101410'], r: 2.2, at: [-5.2, 0.01, 0] },
      live: [
        {
          // (the squid’s pass: across the windows over twelve seconds, every so often)
          step(dt) {
            t += dt;
            const k = (t % SQUID_EVERY) / 12;
            uSquid.value = k <= 1 ? k : 2;
          },
          dispose() {
            for (const m of glass.children) m.geometry.dispose();
            lake.dispose();
            banners.dispose();
          },
        },
      ],
    };
  },
});
