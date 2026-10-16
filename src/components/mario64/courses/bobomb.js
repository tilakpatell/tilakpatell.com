// Bob-omb Ridge. A meadow with a trench across it at the start (one plank
// bridge over), Goombas and Bob-ombs in the grass, the Chain Chomp on its
// post to the west with a caged star behind it, a staircase of stone
// pillars to the east up to the red coin star's marker, and in the middle
// the mountain: a path that spirals up it twice round, 700 wide, with iron
// balls rolling down, to the summit where King Bob-omb waits.
//
// The mountain is the terrain itself. For a point at angle θ about its
// middle, the path's two turns pass at ψ = θ and ψ = θ + 2π (ψ is how far
// round the path has come), at radius spiralR(ψ) and height spiralH(ψ); the
// ground is the height of the highest turn whose outer edge the point is
// inside, so each turn is a terrace with a cliff up to the next.

import { TAU, rim, settle, smooth, wobble } from './parts';
import { ring, row } from './castle';

const PI = Math.PI;
export const MOUNT = { x: 0, z: -1500 };
const R0 = 3500; // the path's middle at its foot
const R1 = 1100; // …and at the top
const HALF = 350; // half the path's width
export const TOP = 2400;
const TURNS = 2;
const PSI = TURNS * TAU;
const SUMMIT_R = 900;
const EDGE = 500; // the steep rocky slope up from each turn to the next

const spiralR = (psi) => R0 + ((R1 - R0) * psi) / PSI;
const spiralH = (psi) => (TOP * psi) / PSI;
export const spiralAt = (psi, off = 0) => {
  const r = spiralR(psi) + off;
  return { x: MOUNT.x + Math.sin(psi) * r, y: spiralH(psi), z: MOUNT.z + Math.cos(psi) * r };
};

function mountain(x, z) {
  const dx = x - MOUNT.x, dz = z - MOUNT.z;
  const r = Math.hypot(dx, dz);
  if (r <= SUMMIT_R) return TOP;
  let h = -Infinity;
  const psi0 = ((Math.atan2(dx, dz) % TAU) + TAU) % TAU;
  for (let k = 0; k < TURNS; k++) {
    const psi = psi0 + k * TAU;
    const edge = spiralR(psi) + HALF;
    const H = spiralH(psi);
    if (r <= edge) h = Math.max(h, H);
    else if (r <= edge + EDGE) h = Math.max(h, H * (1 - smooth((r - edge) / EDGE)));
  }
  if (r <= SUMMIT_R + EDGE) h = Math.max(h, TOP * (1 - smooth((r - SUMMIT_R) / EDGE)));
  return h;
}

// on the path: within its width of a turn, at that turn's height
function onPath(x, z, y) {
  const dx = x - MOUNT.x, dz = z - MOUNT.z;
  const r = Math.hypot(dx, dz);
  const psi0 = ((Math.atan2(dx, dz) % TAU) + TAU) % TAU;
  for (let k = 0; k < TURNS; k++) {
    const psi = psi0 + k * TAU;
    if (Math.abs(r - spiralR(psi)) < HALF - 40 && Math.abs(y - spiralH(psi)) < 4) return true;
  }
  return false;
}

// the trench across the meadow at the start, too deep to climb out of
const TRENCH = [2800, 3600];
function trench(z) {
  if (z <= TRENCH[0] || z >= TRENCH[1]) return 0;
  return -1700 * smooth(Math.min(z - TRENCH[0], TRENCH[1] - z) / 140);
}

const PLAY = [-5400, -6000, 5400, 5700];
export function height(x, z) {
  let h = wobble(x, z) * 28;
  const m = mountain(x, z);
  if (m > h) h = m;
  h += trench(z);
  return h + rim(x, z, PLAY, 1900, 480);
}

function splat(x, z, ny, y) {
  if (ny < 0.62) return [0, 1, 0];
  if (ny < 0.8) return [0.5, 0.5, 0];
  if (onPath(x, z, y)) return [0, 0, 1];
  if (Math.hypot(x - MOUNT.x, z - MOUNT.z) < SUMMIT_R - 60 && y > TOP - 5) return [0.35, 0, 0.65];
  return [1, 0, 0];
}

// the stone pillars to the east, each 200 higher, up to the red coin star
const PILLARS = [
  { x: 2600, z: 2200, top: 200, s: 500 },
  { x: 3150, z: 1950, top: 400, s: 500 },
  { x: 3700, z: 1700, top: 600, s: 500 },
  { x: 4250, z: 1450, top: 800, s: 500 },
  { x: 4900, z: 900, top: 1000, s: 700 },
];
const TOWER = { x: 4200, z: -3500, top: 380, s: 600 }; // a double jump's height
const POST = { x: -3800, z: 1800 };
const GATE = { x: -4600, z: 900 };

function build(k) {
  k.terrain({ id: 'ridge', x0: -6000, z0: -6600, w: 12000, d: 12800, res: 128, height, splat, mats: ['grass', 'rock', 'path'] });
  // the plank bridge over the trench, and its rails
  k.box({ x: 0, y: -80, z: 3200, w: 600, h: 80, d: 1100, mat: 'wood' });
  for (const sx of [-1, 1]) k.box({ x: sx * 290, y: 0, z: 3200, w: 24, h: 110, d: 1100, mat: 'wood' });
  for (const p of PILLARS) k.box({ x: p.x, y: -200, z: p.z, w: p.s, h: p.top + 200, d: p.s, mat: 'stone', top: 'grass-stone' });
  k.box({ x: TOWER.x, y: -100, z: TOWER.z, w: TOWER.s, h: TOWER.top + 100, d: TOWER.s, mat: 'wood', top: 'wood' });
  // a fence along the trench's near side, either side of the bridge
  for (const [x0, x1] of [
    [-5300, -420],
    [420, 5300],
  ])
    for (let x = x0; x < x1; x += 400) k.box({ x: x + 200, y: height(x + 200, 3800) - 20, z: 3800, w: 380, h: 120, d: 26, mat: 'wood' });
}

// the iron balls' road: the path's middle from near the top to the foot
const BALL_PATH = [];
for (let psi = PSI - 0.25; psi > 0.05; psi -= 0.12) {
  const p = spiralAt(psi);
  BALL_PATH.push([p.x, p.y, p.z]);
}

const at = (psi, off = 0) => {
  const p = spiralAt(psi, off);
  return { x: p.x, y: p.y, z: p.z };
};

export const REDS = [
  { x: 0, y: 0, z: 3150 },
  { x: PILLARS[1].x, y: PILLARS[1].top, z: PILLARS[1].z },
  { x: PILLARS[3].x, y: PILLARS[3].top, z: PILLARS[3].z },
  at(PI),
  at(3 * PI),
  { x: 2500, z: -5000 },
  { x: -2600, z: 4500 },
  { x: TOWER.x, y: TOWER.top, z: TOWER.z },
];
const RED_STAR = { index: 1, x: PILLARS[4].x, y: PILLARS[4].top, z: PILLARS[4].z };
export { PILLARS, TOWER, POST, GATE };

const coinsOnPath = [];
for (let psi = 0.5; psi < PSI - 0.3; psi += 0.55) coinsOnPath.push({ type: 'coin', ...at(psi, (psi * 97) % 2 < 1 ? 150 : -150) });

const bobomb = {
  id: 'bobomb',
  course: 'bobomb',
  name: 'Bob-omb Ridge',
  sky: 'noon',
  fog: { color: '#c4dcff', near: 7000, far: 24000 },
  music: 'field',
  deathY: -1200,
  entries: { main: { x: 0, y: 0, z: 5000, yaw: PI } },
  redStar: RED_STAR,
  build,
  water: [],
  props: [
    ...[
      [-4200, 4600],
      [-3300, 5100],
      [2700, 4700],
      [4100, 4300],
      [-4600, -2200],
      [4700, -1900],
      [-3000, -4900],
      [3700, -5100],
      [1700, 5200],
      [-1900, 5300],
      [-4900, 3900],
      [-1500, -5400],
    ].map(([x, z], i) => ({ kind: i % 4 === 3 ? 'pine' : 'tree', x, y: height(x, z), z, yaw: i * 2.3, s: 0.9 + (i % 3) * 0.15, solid: { r: 90, h: 900 } })),
    ...[
      [1300, 4300],
      [-1800, 2500],
      [4300, -2700],
      [-4300, -1000],
    ].map(([x, z], i) => ({ kind: 'rock', x, y: height(x, z), z, yaw: i, s: 1 + i * 0.2, solid: { r: 160, h: 140 } })),
  ],
  actors: settle(height, [
    { type: 'sign', x: 320, z: 4750, yaw: PI, text: 'Bob-omb Ridge. King Bob-omb sits on the summit with a Power Star. Follow the path round and round the mountain, and look out for the iron balls!' },
    { type: 'sign', x: -2500, z: 2500, yaw: -PI / 2, text: 'The Chain Chomp’s post looks loose. A good ground pound or three might knock it right into the ground.' },
    { type: 'goomba', x: 1800, z: 4600 },
    { type: 'goomba', x: -1500, z: 4400 },
    { type: 'goomba', x: 2000, z: 1900 },
    { type: 'goomba', x: 2300, z: 4100 },
    { type: 'goomba', x: -800, z: -5500 },
    { type: 'goomba', x: 3400, z: -4300 },
    { type: 'bobomb', ...at(1.3) },
    { type: 'bobomb', ...at(3.2) },
    { type: 'bobomb', ...at(5.4) },
    { type: 'bobomb', x: 2000, z: -5200 },
    { type: 'king', x: MOUNT.x, y: TOP, z: MOUNT.z, yaw: 0, arena: { x: MOUNT.x, y: TOP, z: MOUNT.z, r: SUMMIT_R }, star: 0 },
    { type: 'ballspawner', x: BALL_PATH[0][0], y: BALL_PATH[0][1], z: BALL_PATH[0][2], path: BALL_PATH, every: 210, speed: 22 },
    { type: 'post', id: 'post', x: POST.x, z: POST.z },
    { type: 'chomp', post: 'post', gate: 'gate', x: POST.x + 400, z: POST.z },
    { type: 'gate', id: 'gate', x: GATE.x, z: GATE.z, star: 2 },
    ...REDS.map((p) => ({ type: 'coin', kind: 'red', ...p })),
    ...row([0, null, 4500], [0, null, 3800], 4),
    ...ring(-3300, 4400, 350, 8),
    ...coinsOnPath,
    ...ring(MOUNT.x, MOUNT.z, 600, 8, TOP),
    { type: 'oneup', x: PILLARS[2].x, y: PILLARS[2].top, z: PILLARS[2].z },
  ]),
};

export default bobomb;
