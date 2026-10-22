// The Hufflepuff common room (the design’s §4.4): round and low and warm,
// under the ground by the kitchens, in through the barrels. Honey-coloured
// wood, a low ceiling on beams, round doors set into the walls to the
// dormitories, copper lamps, plants everywhere (on the shelves, hung from the
// beams, trailing), yellow and black on the sofas, round windows high up
// with grass and dandelions against the glass, and over the hearth a
// portrait of Helga Hufflepuff raising her two-handled cup to whoever comes
// in. The Fat Friar drifts through, pleased to see you.

import * as THREE from 'three';
import { HOUSES } from '../../rules/sorting';
import { fireplace } from '../parts/furniture';
import { armchair, commonRoom, flat, lowTable, roundWalls, sofa } from './shared';
import { instanced } from '../kit';

const R = 8;
const H = 3.4;
const [YELLOW, BLACK] = HOUSES.hufflepuff.colours;

// Helga, painted: a round kind face, yellow silk, the gold cup raised
function paintHelga(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = Math.round(size * 1.3);
  const g = c.getContext('2d');
  const W = c.width;
  const Hh = c.height;
  const bg = g.createRadialGradient(W * 0.35, Hh * 0.3, 10, W * 0.5, Hh * 0.5, W);
  bg.addColorStop(0, '#6a5a2a');
  bg.addColorStop(1, '#1e1a0e');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#d8a82a';
  g.beginPath();
  g.moveTo(W * 0.2, Hh);
  g.quadraticCurveTo(W * 0.18, Hh * 0.5, W * 0.5, Hh * 0.45);
  g.quadraticCurveTo(W * 0.82, Hh * 0.5, W * 0.8, Hh);
  g.fill();
  g.fillStyle = '#e8c0a0';
  g.beginPath();
  g.ellipse(W * 0.5, Hh * 0.33, W * 0.13, W * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7a4a22';
  g.beginPath();
  g.ellipse(W * 0.5, Hh * 0.26, W * 0.16, W * 0.1, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1a10';
  g.fillRect(W * 0.44, Hh * 0.33, 4, 4);
  g.fillRect(W * 0.55, Hh * 0.33, 4, 4);
  g.fillStyle = '#b04a3a';
  g.fillRect(W * 0.47, Hh * 0.39, W * 0.06, 3);
  // the cup, raised in her right hand
  g.fillStyle = '#e0b84a';
  g.fillRect(W * 0.7, Hh * 0.32, W * 0.1, W * 0.12);
  g.strokeStyle = '#e0b84a';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(W * 0.68, Hh * 0.37, W * 0.03, Math.PI / 2, (Math.PI * 3) / 2);
  g.arc(W * 0.82, Hh * 0.37, W * 0.03, -Math.PI / 2, Math.PI / 2);
  g.stroke();
  g.fillStyle = 'rgba(122,90,32,0.25)';
  g.fillRect(0, 0, W, Hh);
  return c;
}

// the grass at the round windows: blades and dandelions against the light
function paintGrass(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#cfe8ff');
  sky.addColorStop(1, '#f4f0d0');
  g.fillStyle = sky;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size;
    const h = size * (0.3 + Math.random() * 0.5);
    g.strokeStyle = `hsl(${95 + Math.random() * 25},55%,${28 + Math.random() * 18}%)`;
    g.lineWidth = 2 + Math.random() * 3;
    g.beginPath();
    g.moveTo(x, size);
    g.quadraticCurveTo(x + (Math.random() - 0.5) * 30, size - h * 0.5, x + (Math.random() - 0.5) * 40, size - h);
    g.stroke();
  }
  for (let i = 0; i < 7; i++) {
    g.fillStyle = '#f2c81a';
    g.beginPath();
    g.arc(Math.random() * size, size * (0.35 + Math.random() * 0.3), 7 + Math.random() * 5, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export default commonRoom({
  id: 'hufflepuff',
  name: 'The Hufflepuff common room',
  house: 'hufflepuff',
  bounds: { x0: -R + 0.6, x1: R - 0.6, z0: -R + 0.6, z1: R - 0.6 },
  colliders: [
    { kind: 'circle', at: [0, -R + 1.1], r: 1.4 },
    { kind: 'box', at: [0, -3.0], w: 2.4, d: 0.9, turn: 0 },
    { kind: 'circle', at: [0, -1.8], r: 0.55 },
    { kind: 'circle', at: [-3.4, -2.4], r: 0.6 },
    { kind: 'circle', at: [3.4, -2.4], r: 0.6 },
    { kind: 'box', at: [-3.6, 2.6], w: 2.2, d: 0.9, turn: -0.8 },
  ],
  spawn: { at: [0, 0, R - 1.6], yaw: 0 },
  floo: [0, -R + 2.2],
  bed: [-R + 1.4, 0.6],
  bedName: 'A round door, and your patchwork-quilted bed',
  boardAt: [3.4, R - 1.6],
  ghostPath: [[-4, 0], [0, 4], [4, 0], [0, -3]],
  light: { hemi: [0xffe6b0, 0x3a2a14, 1.05], points: [[0, 1.5, -R + 2.2, 0xff9a4a, 12], [-3.5, 2.6, 2, 0xffc070, 6], [3.5, 2.6, 2, 0xffc070, 6], [0, 2.8, 0, 0xffd090, 5]] },
  poses: {
    room: { at: [0, 1.5, 6], look: [0, 1.4, -6] },
    helga: { at: [0, 1.6, -2.5], look: [0, 2.2, -R] },
    doors: { at: [3, 1.5, 1], look: [-R, 1.2, 0.6] },
  },
  make(kit, { renderer, group }) {
    roundWalls(kit, { r: R, h: H, mat: 'plaster' });
    kit.cyl('flags', 0, -0.2, 0, R + 0.6, R + 0.6, 0.2, { seg: 32 });
    kit.cyl('oak', 0, H, 0, R + 0.6, R + 0.6, 0.25, { seg: 32 });
    for (let i = 0; i < 6; i++) kit.box('oak', 0, H - 0.3, 0, 0.26, 0.3, R * 2 + 0.6, { ry: (i * Math.PI) / 6 });
    // a band of honey wood round the walls, waist high, and shelves over it
    for (let i = 0; i < 24; i++) {
      const a = (i + 0.5) * ((Math.PI * 2) / 24);
      kit.box('board', Math.sin(a) * (R - 0.05), 0, Math.cos(a) * (R - 0.05), 2.15, 1.1, 0.12, { ry: a });
      if (i % 3 === 1) kit.box('board', Math.sin(a) * (R - 0.25), 2.0, Math.cos(a) * (R - 0.25), 1.6, 0.06, 0.4, { ry: a });
    }
    // the round doors to the dormitories, set in the wall on the left
    for (const z of [-2.2, 0.6, 3.4]) {
      const x = -Math.sqrt(R * R - z * z) + 0.1;
      const ry = Math.atan2(-x, -z) + Math.PI;
      kit.cyl('oak', x, 0.95, z, 0.95, 0.95, 0.08, { rz: Math.PI / 2, ry: ry + Math.PI / 2, seg: 20 });
      kit.cyl('brass', x + 0.06, 0.95, z, 0.07, 0.07, 0.06, { rz: Math.PI / 2, ry: ry + Math.PI / 2, seg: 10 });
    }
    // the hearth, Helga over it; sofas in yellow and black, squashy chairs
    const fireAt = fireplace(kit, { at: [0, 0, -R + 0.5], ry: 0, w: 2.6, h: 1.9, mat: 'stonewarm' });
    sofa(kit, { at: [0, 0, -3.0], ry: Math.PI, cloth: YELLOW, len: 2.4 });
    lowTable(kit, { at: [0, 0, -1.8], r: 0.5, mat: 'oak' });
    armchair(kit, { at: [-3.4, 0, -2.4], ry: 0.9, cloth: '#3a2e22' });
    armchair(kit, { at: [3.4, 0, -2.4], ry: -0.9, cloth: YELLOW });
    sofa(kit, { at: [-3.6, 0, 2.6], ry: 0.8 + Math.PI, cloth: BLACK, len: 2.2 });
    kit.box('board', 3.4, 1.0, R - 0.75, 1.9, 1.25, 0.08, { ry: Math.PI - 0.44 });
    // copper lamps on the beams, and pots: on the shelves, and hung, trailing
    const copper = kit.paint('#b8733a', { rough: 0.35, metal: 0.85 });
    for (const [x, z] of [[-3.5, 2], [3.5, 2], [0, 0], [0, 4.5]]) {
      kit.cyl('iron', x, H - 0.9, z, 0.01, 0.01, 0.9, { seg: 4 });
      kit.cyl(copper, x, H - 1.15, z, 0.12, 0.2, 0.25, { seg: 10 });
      kit.cyl(kit.glow('#ffd28a', 1.4), x, H - 1.2, z, 0.1, 0.1, 0.06, { seg: 10 });
    }
    const pots = [];
    const leaves = [];
    for (let i = 0; i < 16; i++) {
      const a = (i + 0.3) * ((Math.PI * 2) / 16);
      const hung = i % 2 === 0;
      const r = hung ? R - 1.8 : R - 0.3;
      const y = hung ? H - 1.0 : 2.06;
      pots.push({ at: [Math.sin(a) * r, y, Math.cos(a) * r], s: hung ? 1 : 0.8 });
      // (a pot’s leaves: a crown of them, and from a hung one a trail down toward the floor)
      for (let k = 0; k < 14; k++) {
        const trail = hung && k > 5;
        const d = trail ? 0.14 : 0.08 + (k % 4) * 0.04;
        leaves.push({ at: [Math.sin(a) * r + Math.sin(k * 2.4) * d, y + (trail ? 0.1 - (k - 5) * 0.16 : 0.22 + (k % 3) * 0.05), Math.cos(a) * r + Math.cos(k * 2.4) * d], ry: k * 2.4, rx: trail ? 2.6 : -0.5 - (k % 3) * 0.25, s: 0.7 + (k % 4) * 0.12 });
      }
    }
    for (const p of pots) kit.cyl(kit.paint('#a0582e', { rough: 0.9 }), p.at[0], p.at[1], p.at[2], 0.17 * p.s, 0.12 * p.s, 0.24 * p.s, { seg: 10 });
    // a leaf: pointed at both ends, folded a little down its middle
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.07, 0.12, 0, 0.26);
    leafShape.quadraticCurveTo(-0.07, 0.12, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 3);
    const leafMat = kit.paint('#ffffff', { rough: 0.75, side: THREE.DoubleSide });
    const greens = instanced(leafGeo, leafMat, leaves, { colours: ['#3f7a32', '#4f8a3a', '#2f6a2a', '#5a9a40'] });
    group.add(greens);
    // the round windows high in the wall, grass and dandelions against them
    const flats = [];
    if (typeof document !== 'undefined') {
      // (Helga on the wall beside the hearth, raising her cup to the door you came in by)
      const ha = -0.62;
      const hx = Math.sin(ha) * (R - 0.32);
      const hz = Math.cos(ha) * (R - 0.32);
      const helga = flat(paintHelga(), { renderer, w: 1.0, h: 1.3, at: [hx, 1.95, hz], ry: ha + Math.PI });
      kit.box('gold', Math.sin(ha) * (R - 0.28), 1.22, Math.cos(ha) * (R - 0.28), 1.24, 1.5, 0.05, { ry: ha + Math.PI });
      flats.push(helga);
      const grassCanvas = paintGrass();
      for (const a of [2.3, 3.0, -2.3]) {
        const w = flat(grassCanvas, { renderer, w: 0.95, h: 0.95, at: [Math.sin(a) * (R - 0.02), 2.55, Math.cos(a) * (R - 0.02)], ry: a + Math.PI, rough: 0.6 });
        w.mesh.material.emissiveMap = w.mesh.material.map;
        w.mesh.material.emissive = new THREE.Color(0.9, 0.9, 0.8);
        flats.push(w);
      }
    }
    return {
      fires: [{ at: fireAt, w: 1.4, h: 1.1, tongues: 4 }],
      board: { w: 1.75, h: 1.12, at: [3.4, 1.62, R - 0.8], ry: Math.PI - 0.44 },
      rug: { colours: [YELLOW, BLACK, '#5a3a1a'], r: 2.6, at: [0, 0.01, -1.8] },
      flats,
      live: [{ dispose: () => (leafGeo.dispose(), greens.dispose?.()) }],
    };
  },
});
