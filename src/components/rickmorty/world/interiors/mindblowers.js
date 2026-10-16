// Morty's Mind Blowers (../scene.js's AREA_BUILDERS; through the door in
// Rick's clone lab), as the show has it: a round room whose wall is shelves
// from the floor to the ceiling, dark teal with lit green strips along them,
// racked with glowing memory vials, most of them cyan, many red, some purple
// and pink, a few green and yellow; a round light in the middle of the
// ceiling; the mint reclining chair in the middle, the white memory helmet on
// its grey cart beside it; more vials stood on the floor either side of the
// way in. Its action `play(color)` flashes the room in a memory's colour as
// the chair plays it.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../stage';
import { FURNITURE, MEMORY_COLORS, RINGS } from '../rules';
import { at, rng } from '../kit';
import { BOX, PLANE, TAU, makeRoom, tiledPaint } from './shell';
import { softLight } from './basement';
import { ringAt, ringCeiling, ringFloor, ringWall } from './round';

const RING = RINGS.mindblowers;
const H = 3.6;
const DOOR_T = Math.PI / 2; // the way out, south
const SHELVES = [0.32, 0.92, 1.52, 2.12, 2.72]; // each tier's board
// how many vials a metre of shelf holds, by tier
const PLAN = { high: { per: 8, floor: 26 }, mid: { per: 6, floor: 18 }, low: { per: 4, floor: 12 } };
// the vials' colours, and how often each comes
const MIX = [
  [0x52d6ff, 0.5],
  [0xff4d5e, 0.27],
  [0xb47cff, 0.09],
  [0xff8fd0, 0.07],
  [0x7dff8a, 0.05],
  [0xffe14a, 0.02],
];
const piece = (id) => FURNITURE.find((f) => f.id === id);

export async function buildMindBlowers(kit) {
  const R = makeRoom(kit, 'mindblowers');
  const m = kit.mats;
  const plan = PLAN[kit.tier] ?? PLAN.high;
  const top = R.frame(0, 0, 0, { list: 'fixed' });
  const spills = [];

  // ── the room ──
  const floor = tiledPaint(m, 'c137-mind-floor', 128, 2.4, (g, w, h) => {
    g.fillStyle = '#123236';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,200,190,0.18)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  });
  R.tiled.add(R.own(ringFloor(RING)), floor, at(0, 0, 0));
  const ceil = tiledPaint(m, 'c137-mind-ceiling', 128, 3, (g, w, h) => {
    g.fillStyle = '#0c2629';
    g.fillRect(0, 0, w, h);
  });
  R.tiled.add(R.own(ringCeiling(RING, H)), ceil, at(0, 0, 0));
  const runs = ringWall(top, RING, { h: H, color: 0x0b2a2e, thick: 0.5, gaps: [DOOR_T - 0.1, DOOR_T + 0.1] });
  // the shelves: a board for each tier along each run, a lit strip on its edge, uprights between runs
  for (const r of runs) {
    const mid = { x: (r.a.x + r.b.x) / 2, z: (r.a.z + r.b.z) / 2 };
    const p = (d) => ({ x: mid.x + Math.sin(r.turn) * d, z: mid.z + Math.cos(r.turn) * d });
    for (const y of SHELVES) {
      const b = p(0.16);
      top.box(0x14454b, b.x, y - 0.04, b.z, r.len + 0.02, 0.04, 0.32, r.ry);
      const e = p(0.33);
      top.glow(BOX, 0x4dff9a, 1.2, e.x, y - 0.025, e.z, r.ry, r.len, 0.018, 0.012);
    }
    const u = r.a;
    top.box(0x0f363b, u.x + Math.sin(r.turn) * 0.16, 0, u.z + Math.cos(r.turn) * 0.16, 0.06, H, 0.34, r.ry);
  }
  vials(R, runs, plan);
  door(R);

  // ── the light in the middle of the ceiling ──
  const lamp = R.frame(RING.x, RING.z, 0, { list: 'fixed' });
  lamp.cyl(0x1a4a50, 0, H - 0.14, 0, 1.35, 0.14).cyl(0x2a6a70, 0, H - 0.2, 0, 1.15, 0.06);
  R.cell('fan', 256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#eafff8';
    g.beginPath();
    g.arc(w / 2, h / 2, w / 2 - 2, 0, TAU);
    g.fill();
    g.fillStyle = '#7fd8c8';
    for (let i = 0; i < 12; i++) {
      g.save();
      g.translate(w / 2, h / 2);
      g.rotate((i / 12) * TAU);
      g.fillRect(-5, 34, 10, 82);
      g.restore();
    }
    g.beginPath();
    g.arc(w / 2, h / 2, 26, 0, TAU);
    g.fill();
  });
  lamp.decal('fan', 0, H - 0.21, 0, 2.2, 2.2, { rx: Math.PI / 2, bright: true });
  spills.push([RING.x, 0.012, RING.z, 7, 7, -Math.PI / 2, 0, 0xbffff0, 0.22]);

  // ── the chair, the cart and the helmet ──
  chair(R, piece('mind-chair'));
  const helmet = cart(R, piece('mind-cart'));

  const spill = softLight(R, spills);
  // the flash as a memory plays: the room washed in its colour, fading
  const flash = new THREE.Mesh(R.own(new THREE.SphereGeometry(1, 24, 12)), R.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide })));
  flash.scale.set(RING.a - 0.6, H * 0.6, RING.b - 0.6);
  flash.position.set(RING.x, H * 0.45, RING.z);
  flash.visible = false;
  R.add(flash, { ink: false });
  let flashAt = -1;
  let now = 0;
  const tint = new THREE.Color(0x5ff3ff);

  R.tick((t) => {
    now = t;
    spill.opacity = 0.9 + Math.sin(t * 2.3) * 0.08;
    const k = flashAt < 0 ? 0 : Math.max(0, 1 - (t - flashAt) / 1.6);
    flash.visible = k > 0.01;
    flash.material.opacity = k * 0.5;
    helmet.material.color.copy(tint).multiplyScalar(1.4 + k * 1.6);
  });

  const built = R.build({ light: { sun: [0xcff7ff, 0.35], hemi: [0x9ff0e0, 0x081a1c, 1.45], fog: [0x041012, 10, 30], background: 0x020809 } });
  return {
    ...built,
    actions: {
      // a memory starts: the room flashes its vial's colour (blue, purple, red or pink)
      play(color) {
        const c = new THREE.Color(MEMORY_COLORS[color] ?? '#52d6ff');
        flash.material.color.copy(c);
        tint.copy(c);
        flashAt = now;
      },
    },
  };
}

// The vials on the shelves and on the floor: one instanced capsule, each its
// own colour, glowing
function vials(R, runs, plan) {
  const body = new THREE.CylinderGeometry(0.032, 0.032, 0.15, 6, 1, true).translate(0, 0.075, 0);
  const cap = new THREE.SphereGeometry(0.032, 6, 3, 0, TAU, 0, Math.PI / 2).translate(0, 0.15, 0);
  const foot = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 6).translate(0, 0.015, 0);
  const geo = R.own(mergeGeometries([body, cap, foot], false));
  for (const g of [body, cap, foot]) g.dispose();
  const r = rng(808);
  const pick = () => {
    let x = r();
    for (const [c, w] of MIX) if ((x -= w) <= 0) return c;
    return MIX[0][0];
  };
  const spots = [];
  for (const run of runs) {
    const n = Math.max(1, Math.floor(run.len * plan.per));
    for (const y of SHELVES)
      for (let i = 0; i < n; i++) {
        if (r() < 0.06) continue; // (one taken out here and there)
        const k = (i + 0.5) / n;
        const x = run.a.x + (run.b.x - run.a.x) * k + Math.sin(run.turn) * 0.16;
        const z = run.a.z + (run.b.z - run.a.z) * k + Math.cos(run.turn) * 0.16;
        spots.push([x, y, z, 1]);
      }
  }
  // the big ones on the floor, in a crowd round each of the two pieces
  for (const id of ['vials1', 'vials2']) {
    const f = piece(id);
    for (let i = 0; i < plan.floor; i++) spots.push([f.x + (r() - 0.5) * (f.w - 0.2), 0, f.z + (r() - 0.5) * (f.d - 0.2), 2.4 + r() * 0.8]);
  }
  const mesh = R.own(new THREE.InstancedMesh(geo, R.own(new THREE.MeshBasicMaterial({ color: hot(0xffffff, 1.6) })), spots.length));
  const c = new THREE.Color();
  spots.forEach(([x, y, z, s], i) => {
    mesh.setMatrixAt(i, at(x, y, z, r() * TAU, s));
    mesh.setColorAt(i, c.set(pick()));
  });
  R.add(mesh, { ink: false });
}

// The way out: a frame in the gap (its front, +v, into the room), the clone
// lab's blue light beyond it
function door(R) {
  const p = ringAt(RING, DOOR_T);
  const g = R.frame(p.x, p.z, Math.PI, { list: 'fixed' });
  const w = 1.4;
  const hh = 2.4;
  for (const s of [-1, 1]) g.box(0x0b2a2e, s * (w / 2 + 0.3), 0, 0, 0.6, H, 0.5);
  g.box(0x0b2a2e, 0, hh, 0, w + 1.2, H - hh, 0.5);
  g.box(0x0a1a2a, 0, 0, -0.56, w + 0.2, hh, 0.04);
  g.glow(PLANE, 0x3fb6ff, 0.7, 0, hh / 2, -0.53, 0, w, hh);
  for (const s of [-1, 1]) g.glow(BOX, 0x4dffc4, 1.4, (s * (w + 0.05)) / 2, hh / 2, 0.27, 0, 0.04, hh, 0.03);
  g.glow(BOX, 0x4dffc4, 1.4, 0, hh + 0.02, 0.27, 0, w + 0.1, 0.04, 0.03);
}

// The reclining chair: a white pedestal and frame, the mint cushion in three
// parts (the seat, the back raised towards the head at the north, the leg
// rest lowered to the south), white arms
function chair(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const MINT = 0x9fe8c8;
  const WHITE = 0xe8f2ef;
  f.cyl(WHITE, 0, 0, 0, 0.32, 0.06).cyl(0xc8d4d0, 0, 0.06, 0, 0.12, 0.34);
  f.box(WHITE, 0, 0.4, 0.05, 0.62, 0.06, 0.9);
  f.box(MINT, 0, 0.46, 0.05, 0.7, 0.14, 0.86);
  // the back, raised, its head end to the north
  f.box(WHITE, 0, 0.42, -0.72, 0.62, 0.06, 0.82, 0, -0.55).box(MINT, 0, 0.5, -0.74, 0.7, 0.14, 0.8, 0, -0.55);
  f.ball(MINT, 0, 0.98, -1.04, 0.22, 0.6);
  // the leg rest, down to the south
  f.box(WHITE, 0, 0.32, 0.72, 0.6, 0.05, 0.6, 0, 0.35).box(MINT, 0, 0.38, 0.73, 0.66, 0.12, 0.58, 0, 0.35);
  for (const s of [-1, 1]) f.box(WHITE, s * 0.42, 0.56, -0.05, 0.08, 0.08, 0.7).box(WHITE, s * 0.42, 0.42, -0.05, 0.05, 0.16, 0.05);
}

// The cart: a grey trolley, two shelves on four legs and casters; on top the
// white helmet, a dome with its pads and the glowing tube on its crown.
// Returns the tube's material, for the flash.
function cart(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const GREY = 0x8a949a;
  for (const y of [0.18, 0.78]) f.box(GREY, 0, y, 0, it.w, 0.04, it.d);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) f.box(0x6a7378, (sx * (it.w - 0.06)) / 2, 0.06, (sz * (it.d - 0.06)) / 2, 0.04, 0.76, 0.04).ball(0x2a2d33, (sx * (it.w - 0.06)) / 2, 0.04, (sz * (it.d - 0.06)) / 2, 0.04);
  // a box of vials on the lower shelf
  f.box(0x2a3a3e, 0, 0.22, 0, it.w - 0.2, 0.08, it.d - 0.16);
  // the helmet
  const hy = 0.82;
  f.part(new THREE.SphereGeometry(0.2, 16, 8, 0, TAU, 0, Math.PI / 2), 0xf2f6f6, 0, hy, 0);
  f.cyl(0xf2f6f6, 0, hy - 0.06, 0, 0.205, 0.06);
  for (const s of [-1, 1]) f.box(0x2a2d33, s * 0.2, hy - 0.04, 0, 0.05, 0.16, 0.16).glow(BOX, 0x5ff3ff, 1.6, s * 0.23, hy + 0.02, 0, 0, 0.01, 0.05, 0.08);
  const tubeMat = R.own(new THREE.MeshBasicMaterial({ color: hot(0x5ff3ff, 1.4) }));
  const tube = new THREE.Mesh(R.own(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 10)), tubeMat);
  tube.position.set(it.x, hy + 0.28, it.z);
  R.add(tube, { ink: false });
  return tube;
}
