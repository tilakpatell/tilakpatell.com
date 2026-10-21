// The castle as it is seen from across the water: the site's own reading of
// the films' shape (no studio art), a crag with the school on it, built from
// a small kit of towers and halls. Every part is a plain geometry in metres
// with the role it is drawn in (stone, slate, glass, rock) and its colour,
// so whoever draws it picks the materials: the landing on the universe map
// through the surface kit's (universe/landings/potter.js, by
// ../../shared/castle.js) and the world through the house's on the node
// renderer (./far.js). Lane C's near castle grows from the same kit.
//
// The plan's origin is the crag's foot at the water's level, its middle; +z
// is the face the boats come in to, +x to the right as you look at it.
//
//   PLAN → the parts as data: [{ kind, at: [x, z], …sizes }]
//   CRAG → { top, wide, deep }: the rock the castle stands on
//   castleParts({ seed }) → [{ g, role, color }]   (role: 'stone' | 'roof' | 'glass' | 'rock')
//   SIZE → { wide, tall }: how far it spans and how high its highest spire stands

import * as THREE from 'three';

export const CRAG = { top: 58, wide: 300, deep: 170 };

// The towers: [x, z] on the crag's top, a radius, how tall the wall goes
// above the crag, and its cap (a slate cone, a pyramid on a square one, or a
// ring of battlements). The Astronomy Tower stands highest; the Grand
// Staircase's square tower behind the hall; Gryffindor's on the right of
// the middle; the clock tower to the right with its face lit.
export const PLAN = [
  { kind: 'tower', name: 'west', at: [-138, 6], r: 7, h: 44, cap: 'cone', capH: 20 },
  { kind: 'tower', name: 'west keep', at: [-112, -18], r: 7, h: 34, square: true, cap: 'battlement' },
  { kind: 'hall', name: 'Great Hall', at: [-62, 4], w: 74, d: 24, h: 26, roof: 17, windows: 7, tall: 10 },
  { kind: 'tower', name: 'Grand Staircase', at: [-58, -36], r: 10, h: 62, square: true, cap: 'pyramid', capH: 18 },
  { kind: 'tower', name: 'Ravenclaw', at: [-96, -48], r: 8, h: 56, cap: 'cone', capH: 24 },
  { kind: 'tower', name: 'Gryffindor', at: [-8, 2], r: 9, h: 50, cap: 'cone', capH: 22 },
  { kind: 'tower', name: 'Astronomy', at: [24, -22], r: 7.5, h: 94, cap: 'cone', capH: 24, gallery: true },
  { kind: 'hall', name: 'the classrooms', at: [58, 2], w: 42, d: 20, h: 24, roof: 11, windows: 6, tall: 4, rows: 2 },
  { kind: 'tower', name: 'clock', at: [92, -8], r: 7, h: 46, square: true, cap: 'pyramid', capH: 14, face: true },
  { kind: 'tower', name: 'east', at: [124, 10], r: 6, h: 30, cap: 'cone', capH: 15 },
  { kind: 'tower', name: 'south', at: [34, 28], r: 4.5, h: 22, cap: 'cone', capH: 11 },
  { kind: 'tower', name: 'Hufflepuff', at: [70, -46], r: 6, h: 36, cap: 'cone', capH: 15 },
  // the turrets at the corners
  ...[[-128, 30], [-84, 30], [-26, 30], [10, 32], [78, 32], [110, 30], [-30, -56], [48, -52]].map(([x, z], i) => ({ kind: 'tower', name: `turret ${i + 1}`, at: [x, z], r: 3, h: 14 + (i % 3) * 4, cap: 'cone', capH: 8 })),
  // the curtain wall along the crag's edge, and the hall behind the classrooms
  { kind: 'wall', at: [-133, 30], to: [-82, 30], h: 12 },
  { kind: 'wall', at: [-82, 30], to: [-26, 32], h: 12 },
  { kind: 'wall', at: [10, 32], to: [78, 32], h: 12 },
  { kind: 'wall', at: [78, 32], to: [118, 28], h: 12 },
  { kind: 'hall', name: 'the long gallery', at: [-20, -40], w: 40, d: 16, h: 30, roof: 10, windows: 5, tall: 5 },
  // the covered bridge out to the stone circle, and the viaduct over the glen
  { kind: 'bridge', at: [128, 0], to: [240, -40], y: 34, w: 5, h: 6, roofed: true },
  { kind: 'bridge', at: [-140, -30], to: [-280, -70], y: 40, w: 6, h: 3, piers: 6 },
  // the boathouse at the cliff's foot, under its stair, its lantern lit
  { kind: 'boathouse', at: [64, 96], w: 16, d: 12, h: 7, roof: 5 },
];

// how far it reaches across and how high its highest point is (the Astronomy Tower's cone)
export const SIZE = { wide: 560, tall: CRAG.top + 94 + 24 };

// a seeded random (mulberry32), so the castle is the same for everyone
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STONE = ['#7a7c84', '#6f7079', '#84838a', '#73767f'];
const SLATE = '#2e3542';
const ROCK = '#4a4a46';
const LIT = '#ffc46e';

// A window: a quad `w` by `h` with its bottom middle at p, facing along
// (nx, nz), a hand's breadth proud of the wall so it never fights it
function pane([x, y, z], nx, nz, w, h) {
  // (along the wall, so the quad winds to face out along the normal)
  const tx = nz;
  const tz = -nx;
  const o = 0.12;
  const bx = x + nx * o;
  const bz = z + nz * o;
  const p = [
    [bx - (tx * w) / 2, y, bz - (tz * w) / 2],
    [bx + (tx * w) / 2, y, bz + (tz * w) / 2],
    [bx + (tx * w) / 2, y + h, bz + (tz * w) / 2],
    [bx - (tx * w) / 2, y + h, bz - (tz * w) / 2],
  ];
  // (a pointed head: the quad's top pinched in, so the gothic arch reads even far off)
  p[2][1] -= h * 0.08;
  p[3][1] -= h * 0.08;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p[0], ...p[1], ...p[2], ...p[0], ...p[2], ...p[3]], 3));
  g.computeVertexNormals();
  return g;
}

// A gabled roof: its ridge along x, `w` long, over a base `d` deep, `h` high, standing on y = 0
function gable(w, d, h) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const v = [
    // the two slopes
    [x0, 0, z1], [x1, 0, z1], [x1, h, 0], [x0, 0, z1], [x1, h, 0], [x0, h, 0],
    [x1, 0, z0], [x0, 0, z0], [x0, h, 0], [x1, 0, z0], [x0, h, 0], [x1, h, 0],
    // the gable ends
    [x0, 0, z0], [x0, 0, z1], [x0, h, 0],
    [x1, 0, z1], [x1, 0, z0], [x1, h, 0],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
  g.computeVertexNormals();
  return g;
}

// The crag: a jagged block of rock, steep to the water at the front, its
// top flat where the castle stands, its foot spread
function crag(rand) {
  const g = new THREE.CylinderGeometry(0.5, 0.62, 1, 28, 5, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i) + 0.5; // 0 at the foot, 1 at the top
    const z = p.getZ(i);
    const a = Math.atan2(z, x);
    // (the front, +z, falls sheer; the sides and the back slope away into the hill)
    const front = Math.max(0, Math.sin(a));
    const jag = 1 + (Math.sin(a * 7 + 1.3) * 0.05 + Math.sin(a * 13 + y * 5) * 0.04 + (rand() - 0.5) * 0.06) * (y < 0.99 ? 1 : 0.3);
    const spread = 1 + (1 - y) * (0.35 - front * 0.25);
    p.setXYZ(i, x * CRAG.wide * jag * spread, y * CRAG.top * (y > 0.99 ? 1 : 0.97 + rand() * 0.06), z * CRAG.deep * jag * spread);
  }
  g.computeVertexNormals();
  return g;
}

export function castleParts({ seed = 7 } = {}) {
  const rand = rng(seed);
  const out = [];
  const Y = CRAG.top;
  const add = (g, role, color) => out.push({ g, role, color });
  const stone = () => STONE[Math.floor(rand() * STONE.length)];
  // a window lit, most of them: a few dark, as rooms are
  const lit = (g) => rand() < 0.86 && add(g, 'glass', LIT);
  add(crag(rand), 'rock', ROCK);

  for (const p of PLAN) {
    const [x, z] = p.at;
    if (p.kind === 'tower') {
      const body = p.square ? new THREE.BoxGeometry(p.r * 2, p.h, p.r * 2) : new THREE.CylinderGeometry(p.r, p.r * 1.06, p.h, p.r > 5 ? 14 : 8);
      add(body.translate(x, Y + p.h / 2, z), 'stone', stone());
      const top = Y + p.h;
      if (p.cap === 'cone') add(new THREE.ConeGeometry(p.r * 1.18, p.capH, p.r > 5 ? 14 : 8).translate(x, top + p.capH / 2, z), 'roof', SLATE);
      if (p.cap === 'pyramid') add(new THREE.ConeGeometry(p.r * 1.5, p.capH, 4).rotateY(Math.PI / 4).translate(x, top + p.capH / 2, z), 'roof', SLATE);
      if (p.cap === 'battlement') {
        const n = 12;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          add(new THREE.BoxGeometry(1.4, 1.6, 1.4).translate(x + Math.cos(a) * p.r * 0.92, top + 0.8, z + Math.sin(a) * p.r * 0.92), 'stone', STONE[0]);
        }
      }
      // the Astronomy Tower's gallery: a ring of stone round it near the top
      if (p.gallery) add(new THREE.CylinderGeometry(p.r * 1.45, p.r * 1.2, 2.2, 16).translate(x, top - 6, z), 'stone', STONE[2]);
      // the clock's face, lit from behind
      if (p.face) add(new THREE.CircleGeometry(p.r * 0.7, 20).translate(x, top - 7, z + p.r + 0.2), 'glass', '#ffe2a8');
      // its windows, up the side that faces the lake
      const rows = Math.max(2, Math.floor(p.h / 7));
      for (let k = 0; k < rows; k++) {
        const a = Math.PI / 2 + (rand() - 0.5) * 2.2;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        const reach = p.square ? p.r : p.r * 1.03;
        // (on a square tower, the window sits on the face it looks out of)
        const [wx, wz] = p.square ? (Math.abs(nx) > Math.abs(nz) ? [x + Math.sign(nx) * reach, z] : [x, z + Math.sign(nz) * reach]) : [x + nx * reach, z + nz * reach];
        const [fx, fz] = p.square ? (Math.abs(nx) > Math.abs(nz) ? [Math.sign(nx), 0] : [0, Math.sign(nz)]) : [nx, nz];
        lit(pane([wx, Y + 4 + k * ((p.h - 8) / rows), wz], fx, fz, p.r > 4 ? 1.4 : 0.9, p.r > 4 ? 2.6 : 1.6));
      }
    } else if (p.kind === 'hall') {
      add(new THREE.BoxGeometry(p.w, p.h, p.d).translate(x, Y + p.h / 2, z), 'stone', stone());
      add(gable(p.w * 1.02, p.d * 1.1, p.roof).translate(x, Y + p.h, z), 'roof', SLATE);
      // tall windows down the front (and the back: they show through at night)
      const rows = p.rows ?? 1;
      for (const side of [1, -1]) {
        for (let k = 0; k < p.windows; k++) {
          const wx = x - p.w / 2 + ((k + 0.5) / p.windows) * p.w;
          for (let r = 0; r < rows; r++) {
            const h = p.tall;
            const wy = Y + (rows === 1 ? p.h * 0.3 : 4 + r * (p.h / rows));
            if (side === 1) lit(pane([wx, wy, z + p.d / 2], 0, 1, Math.min(3, p.w / p.windows / 2.2), h));
            else if (rand() < 0.5) lit(pane([wx, wy, z - p.d / 2], 0, -1, Math.min(3, p.w / p.windows / 2.2), h));
          }
        }
      }
    } else if (p.kind === 'wall') {
      const [x1, z1] = p.to;
      const len = Math.hypot(x1 - x, z1 - z);
      const yaw = -Math.atan2(z1 - z, x1 - x);
      add(new THREE.BoxGeometry(len, p.h, 3).rotateY(yaw).translate((x + x1) / 2, Y + p.h / 2, (z + z1) / 2), 'stone', STONE[1]);
      // its battlements
      const n = Math.floor(len / 3.2);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        add(new THREE.BoxGeometry(1.4, 1.4, 3.2).rotateY(yaw).translate(x + (x1 - x) * t, Y + p.h + 0.7, z + (z1 - z) * t), 'stone', STONE[1]);
      }
    } else if (p.kind === 'bridge') {
      const [x1, z1] = p.to;
      const len = Math.hypot(x1 - x, z1 - z);
      const yaw = -Math.atan2(z1 - z, x1 - x);
      const mx = (x + x1) / 2;
      const mz = (z + z1) / 2;
      add(new THREE.BoxGeometry(len, p.h, p.w).rotateY(yaw).translate(mx, p.y + p.h / 2, mz), 'stone', STONE[3]);
      if (p.roofed) {
        add(gable(len, p.w * 1.3, 3).rotateY(yaw).translate(mx, p.y + p.h, mz), 'roof', SLATE);
        for (let k = 0; k < 10; k++) if (rand() < 0.6) lit(pane([x + ((x1 - x) * (k + 0.5)) / 10, p.y + 2, z + ((z1 - z) * (k + 0.5)) / 10 + p.w / 2], 0, 1, 1.2, 2));
      }
      // the viaduct's piers, down into the glen
      for (let k = 1; k <= (p.piers ?? 0); k++) {
        const t = k / ((p.piers ?? 0) + 1);
        add(new THREE.BoxGeometry(5, p.y, 6).rotateY(yaw).translate(x + (x1 - x) * t, p.y / 2, z + (z1 - z) * t), 'stone', STONE[3]);
      }
    } else if (p.kind === 'boathouse') {
      add(new THREE.BoxGeometry(p.w, p.h, p.d).translate(x, p.h / 2, z), 'stone', STONE[0]);
      add(gable(p.w * 1.08, p.d * 1.15, p.roof).rotateY(Math.PI / 2).translate(x, p.h, z), 'roof', SLATE);
      add(pane([x - 3, 1.6, z + p.d / 2], 0, 1, 1.6, 2.2), 'glass', LIT);
      add(pane([x + 3, 1.6, z + p.d / 2], 0, 1, 1.6, 2.2), 'glass', LIT);
      // and the long stair up the cliff behind it, a zigzag of lit lamps
      for (let k = 0; k < 6; k++) add(new THREE.SphereGeometry(0.7, 6, 4).translate(x - 8 + (k % 2) * 16, 10 + k * 8, z - 10 - k * 6), 'glass', '#ffd48a');
    }
  }
  return out;
}
