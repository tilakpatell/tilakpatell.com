// The three rooms the Room of Requirement becomes (rules/requirement.js’s
// NEEDS), each built into its own kit and group, at its own place in the
// room’s frame (../requirement.js stands them far apart and shows the one
// you’re in):
//
//   practise: a wide room with cushions over the floor, straw duellers on
//     posts, targets painted on boards along one wall, and shelves of the
//     books on defence the one who asked wanted
//   hide: a hall the size of a church, heaped to the roof with everything
//     ever hidden in the castle (thousands of things, three draws), lanes
//     between the hills; an old bust in a wig and a tarnished tiara on a
//     cupboard, a tall black cabinet, and at the top of the biggest hill a
//     glint: a Chocolate Frog card
//   quiet: a small warm room, one good chair by a fire, a cup of tea going
//     cold, and a window onto the lake at dusk
//
//   buildNeed(id, { at: [x, z], y, tier, renderer, house }) → { group, colliders, bounds, spawn, card?, cabinet?, dispose() }
//     (y: the floor’s height in the room’s frame; the group stands there, the rest is in x and z)

import * as THREE from 'three';
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import { abs, float, mix, mx_fractal_noise_float, sin, smoothstep, time, uv, vec3 } from 'three/tsl';
import { createRoomKit, instanced } from '../kit';
import { bookcase, chair, fireplace, rod } from './furniture';
import { armchair, flat, lowTable, paintRug } from '../common/shared';
import { createBooks } from './shelves';
import { createFire } from './fire';

function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const JUNK = ['#6a4a2a', '#4a3a2a', '#8a6a4a', '#3a3530', '#7a2a22', '#2a3a4a', '#9a8a6a', '#b8a070', '#5a5a52', '#2a2a26', '#c8b890', '#6a2a3a'];

// a hill’s height at a share of its radius out: rounded at the top, spreading at the foot
export const surface = (top, k) => top * (1 - k) ** 1.4;

// hills of things: from each hill’s middle out, lower as they spread, every
// thing its own size and turn (pure: the test counts them)
export function heaps(hills, { seed = 3, each = 420 } = {}) {
  const rnd = rng(seed);
  const out = [];
  for (const [hx, hz, R, top] of hills)
    for (let i = 0; i < each; i++) {
      // (on the hill’s slope, a little sunk into it: a heap is things resting on things)
      const r = R * Math.sqrt(rnd());
      const t = rnd() * Math.PI * 2;
      const s = 0.18 + rnd() * rnd() * 0.9;
      const lift = surface(top, r / R) - s * (0.15 + rnd() * 0.35);
      out.push({ at: [hx + Math.cos(t) * r, Math.max(0, lift), hz + Math.sin(t) * r], ry: rnd() * Math.PI * 2, rx: (rnd() - 0.5) * 0.9, rz: (rnd() - 0.5) * 0.9, s, kind: rnd() < 0.68 ? 'box' : rnd() < 0.8 ? 'cyl' : 'ball', colour: JUNK[Math.floor(rnd() * JUNK.length)] });
    }
  return out;
}

function lights(group, hemi, points, tier) {
  group.add(new THREE.HemisphereLight(...hemi));
  for (const [x, y, z, colour, power] of points.slice(0, { low: 0, mid: 1, high: 3, ultra: 4 }[tier] ?? 2)) {
    const l = new THREE.PointLight(colour, power, 18, 1.6);
    l.position.set(x, y, z);
    group.add(l);
  }
}

function walls(kit, [cx, cz], w, l, h, mat) {
  kit.box(mat, cx - w - 0.5, 0, cz, 1, h, l * 2 + 2);
  kit.box(mat, cx + w + 0.5, 0, cz, 1, h, l * 2 + 2);
  kit.box(mat, cx, 0, cz - l - 0.5, w * 2, h, 1);
  kit.box(mat, cx, 0, cz + l + 0.5, w * 2, h, 1);
}

function practise(kit, group, [cx, cz], { tier }) {
  const W = 9;
  const L = 8;
  walls(kit, [cx, cz], W, L, 6, 'ashlar');
  kit.box('board', cx, -0.3, cz, W * 2, 0.3, L * 2);
  kit.box('darkoak', cx, 6, cz, W * 2 + 2, 0.3, L * 2 + 2);
  // the cushions, all over the floor, every colour
  const rnd = rng(31);
  const cushions = [];
  for (let i = 0; i < 46; i++) cushions.push({ at: [cx - W + 1 + rnd() * (W * 2 - 2), 0.12, cz - 2 + rnd() * (L + 1)], ry: rnd() * 3, s: [0.42 + rnd() * 0.2, 0.14, 0.42 + rnd() * 0.2] });
  const cushionGeo = new THREE.SphereGeometry(1, 12, 6);
  const cushionMat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.95 });
  group.add(instanced(cushionGeo, cushionMat, cushions, { colours: ['#8a2a2a', '#2a4a8a', '#c8a03a', '#2a6a3a', '#6a2a6a', '#c86a3a'] }));
  // the targets along the far wall: rings on boards
  const rings = ['#e8e0d0', '#a02020', '#e8e0d0', '#a02020', '#d8b040'];
  for (const x of [-6, -2, 2, 6]) {
    kit.box('board', cx + x, 0, cz - L + 0.2, 1.6, 2.6, 0.12);
    rings.forEach((c, i) => kit.cyl(kit.paint(c, { rough: 0.8 }), cx + x, 1.6, cz - L + 0.27 + i * 0.006, 0.7 - i * 0.14, 0.7 - i * 0.14, 0.01, { seg: 24, rx: Math.PI / 2 }));
  }
  // the straw duellers on their posts, wands of sticks
  for (const [x, z] of [[-5, -1], [0, -2.5], [5, -1]]) {
    kit.cyl('darkoak', cx + x, 0, cz + z, 0.06, 0.06, 1.2, { seg: 6 });
    kit.cyl(kit.paint('#c8a860', { rough: 1 }), cx + x, 1.0, cz + z, 0.24, 0.3, 0.8, { seg: 10 });
    kit.add(kit.paint('#c8a860', { rough: 1 }), new THREE.SphereGeometry(0.18, 10, 8), { at: [cx + x, 2.0, cz + z] });
    rod(kit, 'board', [cx + x + 0.25, 1.5, cz + z], [cx + x + 0.6, 1.8, cz + z + 0.2], 0.012);
  }
  // the books the one who asked was after, on the side walls
  const shelves = [...bookcase(kit, { at: [cx - W + 0.25, 0, cz + 2], ry: Math.PI / 2, w: 5, h: 3, shelves: 5 }), ...bookcase(kit, { at: [cx + W - 0.25, 0, cz + 2], ry: -Math.PI / 2, w: 5, h: 3, shelves: 5 })];
  const books = createBooks(shelves, { seed: 41 });
  group.add(books.mesh);
  lights(group, [0xfff0d8, 0x30281e, 1.1], [[cx, 4, cz, 0xffe0b0, 10], [cx - 5, 3, cz + 3, 0xffd090, 6], [cx + 5, 3, cz + 3, 0xffd090, 6]], tier);
  return {
    bounds: { x0: cx - W + 0.6, x1: cx + W - 0.6, z0: cz - L + 0.8, z1: cz + L - 0.6 },
    colliders: [[-5, -1], [0, -2.5], [5, -1]].map(([x, z]) => ({ at: [cx + x, cz + z], r: 0.45 })),
    spawn: { at: [cx, cz + L - 1.4], yaw: 0 },
    dispose() {
      cushionGeo.dispose();
      cushionMat.dispose();
      books.dispose();
    },
  };
}

function hide(kit, group, [cx, cz], { tier }) {
  const W = 16;
  const L = 22;
  const H = 18;
  walls(kit, [cx, cz], W, L, H, 'stonedark');
  kit.box('flags', cx, -0.3, cz, W * 2, 0.3, L * 2);
  // a high timber roof over it all, its trusses dim in the dust
  kit.box('darkoak', cx, H, cz, W * 2 + 2, 0.5, L * 2 + 2);
  for (let z = -L + 3; z < L; z += 5) {
    kit.box('darkoak', cx, H - 1.2, cz + z, W * 2, 0.5, 0.5);
    kit.box('darkoak', cx, H - 3.6, cz + z, 0.4, 2.4, 0.4);
  }
  // the high windows letting a dusty light down the lanes
  for (let z = -L + 4; z < L; z += 8) for (const s of [-1, 1]) kit.box(kit.glow('#c8c0a8', 1.1), cx + s * (W - 0.02), 10, cz + z, 0.05, 5, 1.6);
  // the hills of things, with lanes between them
  const hills = [
    [cx - 9, cz - 12, 6.5, 9],
    [cx + 9, cz - 10, 7, 11],
    [cx - 10, cz + 4, 6, 7],
    [cx + 10, cz + 6, 6.5, 8],
    [cx, cz - 20, 9, 14],
  ];
  const junk = heaps(hills, { seed: 13, each: { low: 160, mid: 300, high: 460, ultra: 600 }[tier] ?? 400 });
  // (each hill’s core under its things, so no gap shows the floor through it)
  for (const [x, z, R, top] of hills) {
    const prof = Array.from({ length: 9 }, (_, i) => new THREE.Vector2(R * (1 - i / 8) * 0.96 + 0.01, surface(top, 1 - i / 8) * 0.92));
    kit.add(kit.paint('#2a2420', { rough: 1 }), new THREE.LatheGeometry(prof.reverse(), 16), { at: [x, 0, z] });
  }
  const geos = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(0.4, 0.45, 1, 8), ball: new THREE.IcosahedronGeometry(0.5, 0) };
  const mat = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.05 });
  for (const kind of Object.keys(geos)) {
    const these = junk.filter((j) => j.kind === kind);
    const s = (j) => (kind === 'box' ? [j.s, j.s * (0.4 + (j.s * 7) % 0.8), j.s * 0.8] : [j.s * 0.6, j.s, j.s * 0.6]);
    group.add(instanced(geos[kind], mat, these.map((j) => ({ at: j.at, ry: j.ry, rx: j.rx, rz: j.rz, s: s(j) })), { colours: these.map((j) => j.colour) }));
  }
  // a cupboard by the lane, the old bust on it in a wig and a tarnished tiara
  const cupboard = [cx + 3.2, cz - 2];
  kit.box('darkoak', cupboard[0], 0, cupboard[1], 1.4, 1.5, 0.7);
  kit.cyl(kit.paint('#cfc8b8', { rough: 0.6 }), cupboard[0], 1.5, cupboard[1], 0.2, 0.26, 0.3, { seg: 12 });
  kit.add(kit.paint('#cfc8b8', { rough: 0.6 }), new THREE.SphereGeometry(0.2, 12, 10), { at: [cupboard[0], 2.0, cupboard[1]], scale: [0.85, 1.05, 0.9] });
  kit.add(kit.paint('#d8d0c0', { rough: 1 }), new THREE.SphereGeometry(0.22, 10, 8), { at: [cupboard[0], 2.1, cupboard[1] - 0.03], scale: [1, 0.7, 1] });
  const tiara = new THREE.TorusGeometry(0.15, 0.014, 5, 18, Math.PI);
  kit.add(kit.paint('#a89a6a', { rough: 0.45, metal: 0.8 }), tiara, { at: [cupboard[0], 2.16, cupboard[1] + 0.05], rx: -0.4 });
  kit.add(kit.paint('#7ab8d8', { rough: 0.2, metal: 0.3 }), new THREE.OctahedronGeometry(0.03, 0), { at: [cupboard[0], 2.33, cupboard[1] + 0.11] });
  // the tall black cabinet, its gilt worn
  const cabinet = [cx - 3.6, cz - 6];
  kit.box(kit.paint('#121014', { rough: 0.5 }), cabinet[0], 0, cabinet[1], 1.3, 2.6, 0.9);
  kit.box(kit.paint('#8a7240', { rough: 0.4, metal: 0.8 }), cabinet[0], 2.6, cabinet[1], 1.4, 0.12, 1.0);
  kit.box(kit.paint('#8a7240', { rough: 0.4, metal: 0.8 }), cabinet[0], 1.2, cabinet[1] + 0.46, 0.05, 0.3, 0.02);
  // the card at the top of the biggest hill, a glint of gold
  const card = [cx + 9, 10.4, cz - 10];
  kit.box(kit.glow('#ffd36a', 2.4), card[0], card[1], card[2], 0.12, 0.17, 0.01, { ry: 0.6, rx: -0.3 });
  lights(group, [0xe8dcc8, 0x3a3024, 1.5], [[cx, 12, cz - 6, 0xfff0d0, 40], [cx + 9, 11, cz - 10, 0xffd890, 10], [cx, 6, cz + 10, 0xfff0d0, 18]], tier);
  return {
    bounds: { x0: cx - W + 0.6, x1: cx + W - 0.6, z0: cz - L + 0.8, z1: cz + L - 0.6 },
    colliders: [...hills.map(([x, z, R]) => ({ at: [x, z], r: R * 0.85 })), { at: cupboard, r: 0.8 }, { at: cabinet, r: 0.8 }],
    spawn: { at: [cx, cz + L - 1.6], yaw: 0 },
    card: { foot: [cx + 9 - 6.6, cz - 6.4], at: card },
    cabinet: { at: [cabinet[0], cabinet[1] + 1.2] },
    dispose() {
      for (const g of Object.values(geos)) g.dispose();
      mat.dispose();
    },
  };
}

// the lake at dusk through the quiet room’s window: the sky going down to
// amber, the hills dark, the water with the last of the light moving on it
function lakeView() {
  const m = new MeshBasicNodeMaterial({ fog: false });
  m.userData.noHouse = true;
  const p = uv();
  const sky = mix(vec3(0.95, 0.62, 0.36), vec3(0.18, 0.22, 0.42), smoothstep(0.45, 1.0, p.y));
  const hills = float(0.5).add(mx_fractal_noise_float(vec3(p.x.mul(3), 1, 0), 3).mul(0.08));
  const land = smoothstep(hills.add(0.004), hills, p.y);
  const water = smoothstep(0.42, 0.4, p.y);
  const glint = smoothstep(0.75, 0.95, mx_fractal_noise_float(vec3(p.x.mul(40), p.y.mul(90), time.mul(0.4)), 2).mul(0.5).add(0.5)).mul(smoothstep(0.18, 0.0, abs(p.x.sub(0.62)))).mul(water);
  const lake = mix(vec3(0.1, 0.12, 0.2), vec3(0.6, 0.42, 0.3), p.y.mul(1.6)).add(glint.mul(0.8));
  const shore = vec3(0.05, 0.06, 0.08);
  m.colorNode = mix(mix(sky, shore, land), lake, water).mul(sin(time.mul(0.2)).mul(0.02).add(1));
  return m;
}

function quiet(kit, group, [cx, cz], { tier, renderer }) {
  const W = 3.4;
  const L = 3.4;
  // (the far wall left open for the window, the rest whole)
  kit.box('stonewarm', cx - W - 0.5, 0, cz, 1, 3.6, L * 2 + 2);
  kit.box('stonewarm', cx + W + 0.5, 0, cz, 1, 3.6, L * 2 + 2);
  kit.box('stonewarm', cx, 0, cz + L + 0.5, W * 2, 3.6, 1);
  for (const [x0, x1] of [[-W, -1.1], [1.1, W]]) kit.box('stonewarm', cx + (x0 + x1) / 2, 0, cz - L - 0.5, x1 - x0, 3.6, 1);
  kit.box('stonewarm', cx, 0, cz - L - 0.5, 2.2, 0.75, 1);
  kit.box('stonewarm', cx, 2.95, cz - L - 0.5, 2.2, 0.65, 1);
  kit.box('board', cx, -0.3, cz, W * 2, 0.3, L * 2);
  kit.box('darkoak', cx, 3.6, cz, W * 2 + 2, 0.3, L * 2 + 2);
  // the window in the far wall, deep, a seat in it
  kit.box('stonewarm', cx, 0.6, cz - L + 0.15, 2.4, 0.15, 0.6);
  for (const x of [-1.25, 1.25]) kit.box('stonewarm', cx + x, 0.75, cz - L + 0.05, 0.3, 2.2, 0.5);
  kit.box('stonewarm', cx, 2.95, cz - L + 0.05, 2.8, 0.3, 0.5);
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), lakeView());
  view.position.set(cx, 1.85, cz - L - 0.6);
  group.add(view);
  kit.box('iron', cx, 0.75, cz - L + 0.02, 0.04, 2.2, 0.04);
  kit.box('iron', cx, 1.85, cz - L + 0.02, 2.2, 0.04, 0.04);
  // the fire, the good chair, a small table with a cup on it, the books
  const fireAt = fireplace(kit, { at: [cx - W + 0.4, 0, cz + 0.2], ry: Math.PI / 2, w: 1.6, h: 1.5, mat: 'stonewarm' });
  armchair(kit, { at: [cx - 1.0, 0, cz + 0.6], ry: -Math.PI / 2 - 0.4, cloth: '#5a3a2a' });
  lowTable(kit, { at: [cx - 0.6, 0, cz - 0.8], r: 0.32 });
  kit.cyl(kit.paint('#f0ece0', { rough: 0.3 }), cx - 0.6, 0.48, cz - 0.8, 0.05, 0.04, 0.08, { seg: 12 });
  chair(kit, { at: [cx + 1.4, 0, cz + 1.8], ry: Math.PI + 0.3, back: 1.0 });
  const shelves = bookcase(kit, { at: [cx + W - 0.25, 0, cz], ry: -Math.PI / 2, w: 2.4, h: 2.4, shelves: 4 });
  const books = createBooks(shelves, { seed: 53 });
  group.add(books.mesh);
  const fire = createFire({ at: fireAt, w: 0.9, h: 0.8, tongues: 3, tier });
  group.add(fire.group);
  const rug = typeof document !== 'undefined' ? flat(paintRug(['#5a2a1e', '#c8a060', '#2a1a12']), { renderer, w: 2.6, h: 2.6, at: [cx - 0.6, 0.01, cz], rx: -Math.PI / 2 }) : null;
  if (rug) group.add(rug.mesh);
  lights(group, [0xffd8b0, 0x2a1c12, 0.8], [[cx, 2.6, cz, 0xffc890, 4]], tier);
  return {
    bounds: { x0: cx - W + 0.5, x1: cx + W - 0.5, z0: cz - L + 0.5, z1: cz + L - 0.5 },
    colliders: [{ at: [cx - 1.0, cz + 0.6], r: 0.55 }, { at: [cx - 0.6, cz - 0.8], r: 0.35 }, { at: [cx - W + 0.5, cz + 0.2], r: 0.8 }],
    spawn: { at: [cx + 1.2, cz + L - 0.9], yaw: 0.4 },
    step: (dt) => fire.step(dt),
    dispose() {
      view.geometry.dispose();
      view.material.dispose();
      books.dispose();
      fire.dispose();
      rug?.dispose();
    },
  };
}

const BUILD = { practise, hide, quiet };

export function buildNeed(id, { at, y = 0, tier = 'high', renderer = null, house = null }) {
  const group = new THREE.Group();
  group.name = `requirement:${id}`;
  group.position.y = y;
  const kit = createRoomKit({ house, tier });
  const z = BUILD[id](kit, group, at, { tier, renderer });
  kit.build(group);
  return {
    ...z,
    group,
    dispose() {
      z.dispose?.();
      kit.dispose();
      group.removeFromParent();
    },
  };
}
