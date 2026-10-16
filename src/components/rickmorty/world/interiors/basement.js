// Rick's clone lab, under the garage (../scene.js's AREA_BUILDERS; down the
// hatch in the garage lab's floor), as the show has it: a round, high,
// dark-navy room. In the middle of the back the clone machine: a dark
// cylinder hung from the ceiling, a dozen black hoses curving down from it to
// a round base ringed with orange lights, and on the base a glass tube glowing
// cyan with a Rick clone floating in it, grated plates on the floor before it.
// Round the back wall, pale blue screens (cells with red dots, DNA turning,
// yellow rings, Rick's face waving), lamps over them; big pipes across the
// ceiling with red lamps; curved desks down both sides with a lamp, a pink
// flask, radios, a laptop, a box of dials, books, and Pickle Rick in a jar;
// a floor of dark hexagons lit by cyan lines; the yellow ladder up its shaft
// to the garage, and the door on to Morty's Mind Blowers. Everything stands
// where rules.js's FURNITURE says, inside rules.js's RINGS ellipse.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../../stage';
import { FURNITURE, LINKS, PEOPLE, RINGS } from '../rules';
import { at, mergeParts, rng } from '../kit';
import { BALL, BALL8, BOX, CYL, CYL8, PLANE, TAU, fitText, lathe, makeRoom, tiledPaint, tube } from './shell';
import { LADDER, crossed, fadeUp, glowSpot, hazardStripes } from './lab';
import { hologram, needCast, onEntry } from './people';
import { angleOf, inward, ringAt, ringCeiling, ringFloor, ringWall } from './round';

const RING = RINGS.basement;
const H = 4.4; // to the ceiling
const UP = LINKS.find((l) => l.id === 'basement-ladder');
const ON = LINKS.find((l) => l.id === 'basement-mind');
// the shaft up to the garage, over the ladder, and how high it's drawn
const SHAFT = { x0: UP.x - 0.6, x1: UP.x + 0.6, z0: RING.z + RING.b - 1.2, z1: RING.z + RING.b };
const RISE = 1.9;
// how much each tier draws: round things' sides, the light down the shaft,
// the screens' redraws a second, the bubbles in the tube, the hoses
const PLAN = {
  high: { seg: 24, haze: true, hz: 10, bubbles: 9, hoses: 12 },
  mid: { seg: 16, haze: false, hz: 6, bubbles: 6, hoses: 10 },
  low: { seg: 12, haze: false, hz: 4, bubbles: 4, hoses: 8 },
};
const NAVY = 0x14304a;
const NAVY_DARK = 0x0c1e30;
const DESK = 0x7cc6da;
const DESK_DARK = 0x2a6a84;
const HOSE = 0x1b1f26;
const ORANGE = 0xff9a3a;
const CYAN = 0x5ff3ff;
const piece = (id) => FURNITURE.find((f) => f.id === id);
// the door on, where its link is: the angle round the wall
const DOOR_T = angleOf(RING, ON.x, ON.z);

export async function buildBasement(kit) {
  const R = makeRoom(kit, 'basement');
  const m = kit.mats;
  const plan = PLAN[kit.tier] ?? PLAN.high;
  const top = R.frame(0, 0, 0, { list: 'fixed' }); // the world, for what's fixed
  const spills = []; // soft light on the floor and the walls: [x, y, z, w, h, rx, ry, colour, k]
  const screens = []; // the blue screens: [region, matrix]

  paintCells(R);

  // ── the room: the hexagon floor, the wall, the ceiling with the shaft's hole in it ──
  const floor = tiledPaint(m, 'c137-clonelab-hex', 256, 2.2, hexFloor);
  R.tiled.add(R.own(ringFloor(RING)), floor, at(0, 0, 0));
  const runs = ringWall(top, RING, { h: H, color: NAVY, thick: 0.24, gaps: [DOOR_T], skirt: 0x0a1826, skirtH: 0.22 });
  // a band of darker panelling along the top of the wall, and a lit strip under it
  for (const r of runs) {
    const mid = { x: (r.a.x + r.b.x) / 2, z: (r.a.z + r.b.z) / 2 };
    top.box(NAVY_DARK, mid.x + Math.sin(r.turn) * 0.04, H - 0.9, mid.z + Math.cos(r.turn) * 0.04, r.len + 0.02, 0.9, 0.06, r.ry);
    top.glow(BOX, 0x3fb6ff, 1.25, mid.x + Math.sin(r.turn) * 0.08, H - 0.93, mid.z + Math.cos(r.turn) * 0.08, r.ry, r.len, 0.035, 0.02);
  }
  const ceil = tiledPaint(m, 'c137-clonelab-ceiling', 256, 3, (g, w, h) => {
    g.fillStyle = '#0a1724';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,140,190,0.22)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo((i * w) / 4, 0);
      g.lineTo((i * w) / 4, h);
      g.moveTo(0, (i * h) / 4);
      g.lineTo(w, (i * h) / 4);
      g.stroke();
    }
  });
  R.tiled.add(R.own(ringCeiling(RING, H, [[SHAFT.x0, SHAFT.x1, SHAFT.z0, SHAFT.z1 + 0.3]])), ceil, at(0, 0, 0));

  // ── the ladder up, and its shaft ──
  ladder(R, piece('ladder'));
  for (const [x, z, w, d] of [
    [SHAFT.x0 - 0.05, (SHAFT.z0 + SHAFT.z1) / 2, 0.1, SHAFT.z1 - SHAFT.z0 + 0.2],
    [SHAFT.x1 + 0.05, (SHAFT.z0 + SHAFT.z1) / 2, 0.1, SHAFT.z1 - SHAFT.z0 + 0.2],
    [UP.x, SHAFT.z0 - 0.05, 1.2, 0.1],
  ])
    top.box(0x2a3440, x, H, z, w, RISE, d);
  top.glow(PLANE, 0xfff1d6, 1.7, UP.x, H + RISE - 0.02, (SHAFT.z0 + SHAFT.z1) / 2, 0, 1.2, 1.2, 1, Math.PI / 2);
  for (const [x, z, ry] of [
    [SHAFT.x0 + 0.003, (SHAFT.z0 + SHAFT.z1) / 2, Math.PI / 2],
    [SHAFT.x1 - 0.003, (SHAFT.z0 + SHAFT.z1) / 2, -Math.PI / 2],
    [UP.x, SHAFT.z0 + 0.003, 0],
  ]) {
    top.glow(PLANE, 0xffe6bc, 0.75, x, H + RISE - 0.35, z, ry, 1.2, 0.7);
    top.glow(PLANE, 0xd8bf96, 0.36, x, H + RISE - 0.95, z, ry, 1.2, 0.5);
  }
  spills.push([UP.x, 0.012, SHAFT.z1 - 0.7, 2.2, 2.0, -Math.PI / 2, 0, 0xffe2b0, 0.5]);
  hazardBox(top, UP.x, SHAFT.z1 - 0.62, 1.3, 1.1);

  // ── what's in it ──
  floorLines(top);
  wallScreens(R, runs, screens, spills);
  ceilingPipes(R, plan);
  mindDoor(R, spills);
  for (const id of ['desk-w1', 'desk-w2', 'desk-e1', 'desk-e2']) labDesk(R, piece(id));
  const machine = cloneMachine(R, piece('clone-machine'), plan, spills);

  // the moving parts
  const clone = await floatingClone(R, piece('clone-machine'));
  const pickle = await jarPickle(R, piece('desk-e1'));
  const screen = blueScreens(R, screens, plan);
  const spill = softLight(R, spills);
  let haze = null;
  if (plan.haze) {
    // the light down the shaft, on the ladder
    haze = new THREE.Mesh(
      R.own(crossed(1.1, H + RISE - 0.4)),
      R.own(new THREE.MeshBasicMaterial({ map: R.own(fadeUp(true)), color: new THREE.Color(0xffe2b4).multiplyScalar(0.45), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
    );
    haze.position.set(UP.x, (H + RISE + 0.4) / 2, (SHAFT.z0 + SHAFT.z1) / 2 - 0.15);
    R.add(haze, { ink: false });
  }

  R.tick((t, dt, state, camera) => {
    // (the haze is for seeing from the room: from right by the ladder it'd fill the view)
    if (haze && camera) haze.visible = Math.hypot(camera.position.x - haze.position.x, camera.position.z - haze.position.z) > 2.4;
    machine(t, dt);
    clone(t, dt);
    pickle(t);
    screen(t);
    spill.opacity = 0.9 + Math.sin(t * 5.3) * 0.05 + Math.sin(t * 1.7) * 0.05;
  });

  // Diane, Rick's wife, as he keeps her down here (the multiverse's Phase 2): a
  // hologram over a ring of light on the floor, see-through and drawn without
  // the ink. Fetched the first time Morty comes down, left out if she won't load.
  const diane = PEOPLE.find((p) => p.id === 'diane');
  const holo = R.add(new THREE.Group(), { ink: false });
  holo.add(new THREE.Mesh(R.own(new THREE.RingGeometry(0.32, 0.42, 40).rotateX(-Math.PI / 2)), R.own(new THREE.MeshBasicMaterial({ color: 0x7ff0ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }))));
  holo.children[0].position.set(diane.x, 0.02, diane.z);
  onEntry(R, () => hologram(R, 'diane', diane, { h: 1.85, flat: holo }));

  return R.build({ light: { sun: [0xbfe8ff, 0.45], hemi: [0x8fd0ff, 0x0b1a26, 1.5], fog: [0x040b12, 16, 48], background: 0x02060b } });
}

// ── paint ──

// dark hexagon tiles with lit seams
function hexFloor(g, w, h) {
  g.fillStyle = '#0d2533';
  g.fillRect(0, 0, w, h);
  const r = w / 8;
  const dx = r * Math.sqrt(3);
  for (let row = -1; row < h / (r * 1.5) + 1; row++)
    for (let col = -1; col < w / dx + 1; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * r * 1.5;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k + Math.PI / 6;
        const x = cx + Math.cos(a) * (r - 2);
        const y = cy + Math.sin(a) * (r - 2);
        if (k) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.closePath();
      g.fillStyle = (row + col) % 3 ? '#11303f' : '#0f2a38';
      g.fill();
      g.strokeStyle = 'rgba(70,190,220,0.35)';
      g.lineWidth = 2;
      g.stroke();
    }
}

// the pictures: the grate before the machine, the hazard stripe, the door's sign, the desk's things
function paintCells(R) {
  R.cell('hazard', 256, 32, hazardStripes);
  R.cell('grate', 128, 128, (g, w, h) => {
    g.fillStyle = '#2a3a46';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#0c141a';
    for (let y = 8; y < h - 4; y += 12) g.fillRect(8, y, w - 16, 6);
    g.strokeStyle = '#4c6272';
    g.lineWidth = 4;
    g.strokeRect(2, 2, w - 4, h - 4);
  });
  R.cell('mindsign', 256, 64, (g, w, h) => {
    g.fillStyle = '#081a20';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#4dffc4';
    g.lineWidth = 3;
    g.strokeRect(4, 4, w - 8, h - 8);
    fitText(g, 'MEMORIES', w / 2, h / 2 + 2, w - 40, 34, { color: '#7dffd6' });
  });
  R.cell('laptop', 96, 64, (g, w, h) => {
    g.fillStyle = '#0b2a3a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7fe8ff';
    for (let i = 0; i < 6; i++) g.fillRect(8, 8 + i * 8, 20 + ((i * 37) % 50), 3);
  });
  R.cell('jarlabel', 64, 40, (g, w, h) => {
    g.fillStyle = '#f2ead2';
    g.fillRect(0, 0, w, h);
    fitText(g, 'RICK', w / 2, h / 2 + 1, w - 10, 20, { color: '#2a5a1e' });
  });
}

// lit lines across the floor, as the still has them: out from the machine's front to the room's edge
function floorLines(f) {
  const c = piece('clone-machine');
  const fz = c.z + c.d / 2;
  const L = [
    // [x0, z0, x1, z1]
    [c.x - 1.4, fz + 0.2, c.x - 3.4, fz + 3.2],
    [c.x + 1.4, fz + 0.2, c.x + 3.4, fz + 3.2],
    [c.x - 3.4, fz + 3.2, c.x - 8.6, fz + 3.2],
    [c.x + 3.4, fz + 3.2, c.x + 8.6, fz + 3.2],
    [c.x, fz + 1.6, c.x, fz + 6.6],
  ];
  for (const [x0, z0, x1, z1] of L) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    f.glow(PLANE, CYAN, 1.3, (x0 + x1) / 2, 0.008, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0), len, 0.05, 1, -Math.PI / 2);
  }
  // the grate plates in front of the machine
  for (const u of [-0.6, 0.6]) f.decal('grate', c.x + u, 0.006, fz + 0.75, 1.1, 1.1, { rx: -Math.PI / 2 });
}

// ── the screens round the back ──

// Screens on the wall from the west desk round the back to the east desk, in
// two rows, each a region of one canvas (blueScreens draws them), with a
// lamp over each pair
const REGIONS = {
  cells: [0, 0, 256, 160],
  cells2: [256, 0, 256, 160],
  dna: [512, 0, 128, 160],
  rick: [640, 0, 192, 160],
  rings: [832, 0, 192, 160],
  dna2: [0, 160, 192, 128],
  helix: [192, 160, 128, 128],
  rings2: [320, 160, 192, 128],
  scan: [512, 160, 192, 128],
  cells3: [704, 160, 320, 128],
};
const SW = 1024;
const SH = 288;
function wallScreens(R, runs, screens, spills) {
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  // the back half, past the desks' ends: angles where -z (north)
  const back = runs.filter((r) => Math.sin(r.t) < -0.18);
  const names = Object.keys(REGIONS);
  back.forEach((r, i) => {
    const mid = { x: (r.a.x + r.b.x) / 2, z: (r.a.z + r.b.z) / 2 };
    const into = (d) => ({ x: mid.x + Math.sin(r.turn) * d, z: mid.z + Math.cos(r.turn) * d });
    // two screens, one over the other, sized by the run, in pale frames
    for (const [k, [y, hh]] of [
      [1.55, 1.05],
      [2.75, 1.0],
    ].entries()) {
      if ((i + k) % 5 === 4) continue; // (a gap here and there)
      const w = r.len * (0.82 - ((i * 3 + k) % 3) * 0.08);
      const p = into(0.09);
      f.box(0x9fd8ec, p.x, y - hh / 2 - 0.04, p.z, w + 0.08, hh + 0.08, 0.05, r.ry);
      const q = into(0.125);
      screens.push([names[(i * 2 + k) % names.length], at(q.x, y, q.z, r.ry, w, hh, 1)]);
    }
    // a lamp over them, its pool of light on the wall
    const l = into(0.3);
    f.cyl(0x22262c, l.x, H - 1.25, l.z, 0.12, 0.18).cyl(0x22262c, into(0.16).x, H - 1.12, into(0.16).z, 0.03, 0.2, Math.PI / 2);
    f.glow(BALL8, 0xfff0c8, 1.8, l.x, H - 1.27, l.z, 0, 0.18, 0.06, 0.18);
    const s = into(0.13);
    spills.push([s.x, H - 1.9, s.z, r.len * 0.9, 1.4, 0, r.ry, 0xbfe6ff, 0.35]);
  });
}

// the screens' canvas, redrawn `plan.hz` times a second: cells drifting, DNA
// turning, rings pulsing, a scan line, Rick waving
const SCREEN_BG = '#bfe9ff';
function blueScreens(R, list, plan) {
  const c = document.createElement('canvas');
  c.width = SW;
  c.height = SH;
  const g = c.getContext('2d');
  const tex = R.own(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  // (a plane's front, turned by its run's ry, faces into the room)
  const geos = list.map(([name, matrix]) => {
    const [x, y, w, h] = REGIONS[name];
    const q = PLANE.clone();
    const uv = q.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + 0.5 + uv.getX(i) * (w - 1)) / SW, 1 - (y + 0.5 + (1 - uv.getY(i)) * (h - 1)) / SH);
    return q.applyMatrix4(matrix);
  });
  const mesh = new THREE.Mesh(R.own(mergeGeometries(geos, false)), R.own(new THREE.MeshBasicMaterial({ map: tex, color: hot(0xffffff, 1.15) })));
  for (const q of geos) q.dispose();
  R.add(mesh, { ink: false });
  const dots = [];
  const r = rng(503);
  for (let i = 0; i < 140; i++) dots.push([r(), r(), 2 + r() * 4, r() * TAU, 0.2 + r() * 0.8]);
  let last = -1;
  const draw = (t) => {
    g.fillStyle = SCREEN_BG;
    g.fillRect(0, 0, SW, SH);
    // cells: pale blobs with red dots, drifting
    for (const k of ['cells', 'cells2', 'cells3']) {
      const [x, y, w, h] = REGIONS[k];
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      g.fillStyle = '#9fd6f2';
      for (let i = 0; i < 9; i++) {
        const [u, v, s] = dots[i + (k === 'cells2' ? 30 : k === 'cells3' ? 60 : 0)];
        g.beginPath();
        g.ellipse(x + ((u * w + t * 6) % w), y + v * h, 18 + s * 5, 10 + s * 3, s, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ff5a4a';
      for (const [u, v, s, a, sp] of dots) {
        const px = x + ((u * w + t * 9 * sp + Math.cos(t * sp + a) * 4) % w);
        const py = y + ((v * h + Math.sin(t * sp + a) * 5 + h) % h);
        g.beginPath();
        g.arc(px, py, s * 0.7, 0, TAU);
        g.fill();
      }
      g.restore();
    }
    // DNA: helices turning
    for (const k of ['dna', 'dna2', 'helix']) {
      const [x, y, w, h] = REGIONS[k];
      g.fillStyle = '#d9f4ff';
      g.fillRect(x + 6, y + 6, w - 12, h - 12);
      for (let i = 0; i < 14; i++) {
        const yy = y + 12 + i * ((h - 24) / 13);
        const a = i * 0.55 + t * 2;
        const x1 = x + w / 2 + Math.sin(a) * w * 0.28;
        const x2 = x + w / 2 - Math.sin(a) * w * 0.28;
        g.fillStyle = '#7fb8d6';
        g.fillRect(Math.min(x1, x2), yy, Math.abs(x1 - x2), 2);
        g.fillStyle = Math.cos(a) > 0 ? '#1e6fa8' : '#5aa8d4';
        g.beginPath();
        g.arc(x1, yy + 1, 3.5, 0, TAU);
        g.fill();
        g.fillStyle = Math.cos(a) > 0 ? '#5aa8d4' : '#1e6fa8';
        g.beginPath();
        g.arc(x2, yy + 1, 3.5, 0, TAU);
        g.fill();
      }
    }
    // rings: yellow targets, pulsing down a lane
    for (const k of ['rings', 'rings2']) {
      const [x, y, w, h] = REGIONS[k];
      g.fillStyle = '#4fa8d8';
      g.fillRect(x + w * 0.35, y, w * 0.3, h);
      for (let i = 0; i < 3; i++) {
        const cy = y + h * (0.2 + i * 0.3);
        const p = 0.5 + 0.5 * Math.sin(t * 3 - i);
        g.strokeStyle = '#ffe14a';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(x + w / 2, cy, 10 + p * 6, 0, TAU);
        g.stroke();
        g.beginPath();
        g.arc(x + w / 2, cy, 4, 0, TAU);
        g.stroke();
      }
    }
    // a scan: a figure outline and a line going down it
    {
      const [x, y, w, h] = REGIONS.scan;
      g.fillStyle = '#d9f4ff';
      g.fillRect(x + 6, y + 6, w - 12, h - 12);
      g.strokeStyle = '#1e6fa8';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(x + w / 2, y + 30, 12, 0, TAU);
      g.moveTo(x + w / 2, y + 42);
      g.lineTo(x + w / 2, y + 86);
      g.moveTo(x + w / 2 - 22, y + 56);
      g.lineTo(x + w / 2 + 22, y + 56);
      g.moveTo(x + w / 2, y + 86);
      g.lineTo(x + w / 2 - 14, y + 116);
      g.moveTo(x + w / 2, y + 86);
      g.lineTo(x + w / 2 + 14, y + 116);
      g.stroke();
      const sy = y + 10 + ((t * 40) % (h - 20));
      g.fillStyle = 'rgba(255,90,74,0.8)';
      g.fillRect(x + 10, sy, w - 20, 2);
    }
    // Rick, waving
    rickFace(g, REGIONS.rick, t);
    // a frame line round each region
    g.strokeStyle = '#6fb6dc';
    g.lineWidth = 3;
    for (const [x, y, w, h] of Object.values(REGIONS)) g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  };
  draw(0);
  return (t) => {
    if (t - last < 1 / plan.hz && t >= last) return;
    last = t;
    draw(t);
    tex.needsUpdate = true;
  };
}

// Rick's face on a screen, grinning, his hand waving
function rickFace(g, [x, y, w, h], t) {
  g.fillStyle = '#d9f4ff';
  g.fillRect(x + 6, y + 6, w - 12, h - 12);
  const cx = x + w / 2;
  const cy = y + h / 2 + 10;
  // the spiky hair
  g.fillStyle = '#9fd0e8';
  g.beginPath();
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI + (k / 12) * Math.PI;
    const rr = k % 2 ? 50 : 34;
    g.lineTo(cx + Math.cos(a) * rr * 1.1, cy - 8 + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  // the face, the brow, the eyes, the grin
  g.fillStyle = '#e8f6fc';
  g.beginPath();
  g.ellipse(cx, cy, 28, 34, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#2a5a78';
  g.lineWidth = 2;
  g.stroke();
  g.beginPath();
  g.moveTo(cx - 20, cy - 16);
  g.quadraticCurveTo(cx, cy - 22, cx + 20, cy - 16);
  g.stroke();
  for (const s of [-1, 1]) {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(cx + s * 10, cy - 6, 8, 0, TAU);
    g.fill();
    g.stroke();
    g.fillStyle = '#1e3a4e';
    g.fillRect(cx + s * 10 - 1, cy - 7, 3, 3);
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(cx - 16, cy + 12);
  g.quadraticCurveTo(cx, cy + 26, cx + 16, cy + 12);
  g.closePath();
  g.fill();
  g.stroke();
  // the hand, waving
  const a = Math.sin(t * 6) * 0.4;
  g.save();
  g.translate(cx + 52, cy + 10);
  g.rotate(a);
  g.fillStyle = '#e8f6fc';
  g.fillRect(-6, -30, 12, 30);
  g.beginPath();
  g.arc(0, -32, 9, 0, TAU);
  g.fill();
  g.stroke();
  g.restore();
}

// ── the ceiling's pipes ──

// big pipes, blue and black, across the ceiling from wall to wall, down the
// wall at their ends, with red lamps on brackets between them
function ceilingPipes(R, plan) {
  const parts = [];
  const add = (pts, r, color) => parts.push({ geo: R.own(tube(pts, r, plan.seg)), color, matrix: null });
  const y = H - 0.35;
  for (const [t0, t1, r, color, dy] of [
    [Math.PI * 1.08, Math.PI * 1.92, 0.22, 0x2a5aa8, 0],
    [Math.PI * 1.15, Math.PI * 1.85, 0.16, HOSE, -0.18],
    [Math.PI * 0.95, Math.PI * 0.05, 0.18, 0x1f4a8a, 0.05],
  ]) {
    const a = ringAt(RING, t0, 0.35);
    const b = ringAt(RING, t1, 0.35);
    const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    add(
      [
        [a.x, y - 1.6, a.z],
        [a.x, y + dy, a.z],
        [(a.x + m.x) / 2, y + dy + 0.15, (a.z + m.z) / 2 - 0.4],
        [(m.x + b.x) / 2, y + dy + 0.15, (m.z + b.z) / 2 - 0.4],
        [b.x, y + dy, b.z],
        [b.x, y - 1.6, b.z],
      ],
      r,
      color,
    );
  }
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  R.add(mesh);
  // the red lamps
  const f = R.frame(0, 0, 0, { list: 'fixed' });
  for (const t of [Math.PI * 1.25, Math.PI * 1.75, Math.PI * 1.5]) {
    const p = ringAt(RING, t, 0.5);
    f.cyl(0x22262c, p.x, H - 0.55, p.z, 0.16, 0.2).glow(BALL, 0xff3a3a, 2.2, p.x, H - 0.6, p.z, 0, 0.26, 0.14, 0.26);
  }
}

// ── the door on to the Mind Blowers ──

// a sci-fi door in the gap in the wall: a dark frame, the room beyond glowing
// with its vials, the sign over it
function mindDoor(R, spills) {
  const p = ringAt(RING, DOOR_T);
  const turn = inward(RING, DOOR_T);
  const f = R.frame(p.x, p.z, turn, { list: 'fixed' });
  const w = 1.5;
  const hh = 2.5;
  for (const s of [-1, 1]) f.box(0x0f2232, (s * (w + 0.4)) / 2, 0, -0.05, 0.4, hh, 0.36);
  f.box(0x0f2232, 0, hh, -0.05, w + 0.8, H - hh, 0.3);
  // the way through: dark, lit by the vials beyond
  f.box(0x061418, 0, 0, -0.5, w, hh, 0.04);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 9; j++) f.glow(CYL8, [0x52d6ff, 0xff4d5e, 0x52d6ff, 0xb47cff][(i + j) % 4], 1.4, -0.6 + j * 0.15, 0.5 + i * 0.5, -0.46, 0, 0.05, 0.16, 0.05);
  f.glow(BOX, 0x4dffc4, 1.5, 0, hh + 0.04, 0.14, 0, w + 0.1, 0.04, 0.03);
  for (const s of [-1, 1]) f.glow(BOX, 0x4dffc4, 1.5, (s * (w + 0.05)) / 2, hh / 2, 0.14, 0, 0.04, hh, 0.03);
  f.decal('mindsign', 0, hh + 0.42, 0.13, 1.1, 0.28, { bright: true });
  spills.push([p.x + Math.sin(turn) * 0.6, 0.012, p.z + Math.cos(turn) * 0.6, 1.6, 1.2, -Math.PI / 2, turn, 0x4dffc4, 0.22]);
}

// ── the desks ──

// a curved desk's length: a pale blue top over a dark front on legs; on it
// what the still has (by desk): an angle lamp, a pink cone flask, stacked
// radios, a laptop, a box of dials with two valves, books
function labDesk(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const { w, d, h } = it;
  f.box(DESK, 0, h - 0.06, 0, w, 0.06, d);
  f.box(DESK_DARK, 0, 0.12, -d / 2 + 0.08, w - 0.1, h - 0.2, 0.06);
  for (const s of [-1, 1]) f.box(DESK_DARK, s * (w / 2 - 0.08), 0, 0, 0.08, h - 0.06, d - 0.1);
  f.box(0x3fa0c0, 0, h - 0.07, d / 2 - 0.02, w, 0.04, 0.04);
  const y = h;
  if (it.id === 'desk-w1') {
    // the angle lamp
    f.cyl(0x2a2d33, -0.7, y, -0.2, 0.09, 0.03).box(0x2a2d33, -0.7, y, -0.2, 0.03, 0.42, 0.03, 0, 0, 0.5);
    f.box(0x2a2d33, -0.52, y + 0.42, -0.2, 0.03, 0.34, 0.03, 0, 0, -0.9).part(lathe([[0.02, 0], [0.12, -0.14]], 12), 0x2a2d33, -0.36, y + 0.55, -0.2);
    f.glow(BALL8, 0xfff2c8, 1.6, -0.36, y + 0.47, -0.2, 0, 0.06);
    // the pink cone flask
    f.part(lathe([[0.1, 0], [0.1, 0.01], [0.025, 0.2], [0.025, 0.26]], 12), 0xff5ad8, -0.2, y, 0.1);
    // radios, stacked
    for (const [k, c] of [0x8a9098, 0x6a7078, 0x9aa0a8].entries()) f.box(c, 0.35, y + k * 0.1, -0.1, 0.42 - k * 0.04, 0.1, 0.3);
    for (let k = 0; k < 3; k++) f.glow(BALL8, [0x7dff8a, 0xffd04a, 0xff5a4a][k], 1.6, 0.25 + k * 0.08, y + 0.05, 0.06, 0, 0.025);
    f.box(0x2a2d33, 0.75, y, 0.05, 0.2, 0.12, 0.12).glow(BALL8, 0x7dff8a, 1.8, 0.72, y + 0.16, 0.05, 0, 0.035).glow(BALL8, 0xffd04a, 1.8, 0.8, y + 0.16, 0.05, 0, 0.035);
  } else if (it.id === 'desk-w2') {
    // the laptop, open
    f.box(0x2a2d33, -0.2, y, 0.05, 0.4, 0.02, 0.28).box(0x2a2d33, -0.2, y, -0.1, 0.4, 0.26, 0.02, 0, -0.2);
    f.decal('laptop', -0.2, y + 0.14, -0.085, 0.34, 0.22, { bright: true, rx: -0.2 });
    // books
    for (const [k, c] of [0x8a3a2a, 0x2a4a8a, 0x3a6a3a].entries()) f.box(c, 0.55, y + k * 0.05, 0.05, 0.3, 0.05, 0.22, k * 0.2);
  } else if (it.id === 'desk-e1') {
    // the box of dials with its two valves (Pickle Rick's jar is beside it: jarPickle)
    f.box(0xb9b39a, 0.45, y, -0.1, 0.5, 0.26, 0.3);
    for (const s of [-1, 1]) {
      f.cyl(0xd8d0b0, 0.45 + s * 0.12, y + 0.26, -0.1, 0.03, 0.04).ball(0xfff6a0, 0.45 + s * 0.12, y + 0.34, -0.1, 0.05, 1.4);
      f.glow(BALL8, 0xfff27a, 1.5, 0.45 + s * 0.12, y + 0.35, -0.1, 0, 0.03);
    }
    for (let k = 0; k < 3; k++) f.cyl(0x2a2d33, 0.3 + k * 0.15, y + 0.12, 0.06, 0.03, 0.02, Math.PI / 2);
  } else {
    // a machine with a dial and a printer
    f.box(0x5a6068, -0.3, y, -0.05, 0.5, 0.22, 0.32).cyl(0xf2f2ea, -0.3, y + 0.12, 0.12, 0.06, 0.02, Math.PI / 2);
    f.box(0xe2e2da, 0.4, y, 0, 0.36, 0.14, 0.28).box(0xf8f8f2, 0.4, y + 0.14, 0.1, 0.24, 0.002, 0.16, 0, -0.6);
  }
}

// ── the clone machine ──

// Its base: a round plinth ringed with orange lights; on it the glass tube,
// glowing cyan, capped; over it the dark cylinder from the ceiling with its
// collar, and the black hoses curving out and down from the collar to the
// base. Returns its tick: the lights chasing round, the bubbles rising.
const TUBE = { r: 0.72, y0: 0.62, y1: 3.0 };
function cloneMachine(R, it, plan, spills) {
  const { x, z } = it;
  const f = R.frame(x, z, 0);
  const g = R.frame(x, z, 0, { list: 'fixed' });
  // the base: a plinth in two steps, a dark band with the lights in it
  f.cyl(0x1f262e, 0, 0, 0, 1.62, 0.2).cyl(0x2c3540, 0, 0.2, 0, 1.45, 0.3).cyl(0x3c4652, 0, 0.5, 0, 0.98, 0.12);
  f.cyl(0x161b21, 0, 0.62, 0, 0.82, 0.06);
  // the cap and its collar of lights
  f.cyl(0x2c3540, 0, TUBE.y1, 0, 0.9, 0.28).cyl(0x1f262e, 0, TUBE.y1 + 0.28, 0, 0.7, 0.22);
  // the cylinder down from the ceiling: a ribbed column, a collar where the hoses leave it
  g.cyl(0x1d222a, 0, TUBE.y1 + 0.5, 0, 0.55, H - TUBE.y1 - 0.5);
  for (let y = TUBE.y1 + 0.7; y < H - 0.1; y += 0.22) g.cyl(0x2a313a, 0, y, 0, 0.58, 0.05);
  g.cyl(0x252b33, 0, H - 0.9, 0, 0.95, 0.3).cyl(0x1d222a, 0, H - 0.3, 0, 1.15, 0.3);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU;
    g.ball(0x8a929c, Math.cos(a) * 0.95, H - 0.75, Math.sin(a) * 0.95, 0.05);
  }
  // the hoses: out of the collar, bulging out round the tube, down onto the base
  const hoses = [];
  for (let k = 0; k < plan.hoses; k++) {
    const a = (k / plan.hoses) * TAU + 0.2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const out = 1.7 + (k % 3) * 0.18;
    hoses.push({
      geo: R.own(
        tube(
          [
            [x + c * 0.85, H - 0.82, z + s * 0.85],
            [x + c * 1.3, H - 1.1, z + s * 1.3],
            [x + c * out, 2.6, z + s * out],
            [x + c * (out - 0.1), 1.3, z + s * (out - 0.1)],
            [x + c * 1.35, 0.55, z + s * 1.35],
          ],
          0.075,
          plan.seg,
        ),
      ),
      color: HOSE,
      matrix: null,
    });
    // the hose's fitting on the base
    f.cyl(0x6a727c, c * 1.35, 0.42, s * 1.35, 0.1, 0.14);
  }
  const hoseMesh = new THREE.Mesh(R.own(mergeParts(hoses)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  hoseMesh.castShadow = true;
  R.add(hoseMesh);
  // the tube: glass glowing cyan, a brighter rim at top and foot (no ink: it's glass)
  const glass = new THREE.Mesh(
    R.own(new THREE.CylinderGeometry(TUBE.r, TUBE.r, TUBE.y1 - TUBE.y0, plan.seg * 2, 1, true)),
    R.own(new THREE.MeshBasicMaterial({ map: R.own(fadeUp()), color: hot(CYAN, 0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  );
  glass.position.set(x, (TUBE.y0 + TUBE.y1) / 2, z);
  glass.renderOrder = 2;
  R.add(glass, { ink: false });
  for (const y of [TUBE.y0 + 0.03, TUBE.y1 - 0.03]) g.glow(new THREE.TorusGeometry(0.5, 0.03, 6, 32), CYAN, 1.8, 0, y, 0, 0, TUBE.r * 2, TUBE.r * 2, TUBE.r * 2, Math.PI / 2);
  spills.push([x, 0.012, z + 1.7, 3.2, 2.2, -Math.PI / 2, 0, CYAN, 0.55]);
  spills.push([x, TUBE.y1 + 0.3, z, 3.6, 3.6, -Math.PI / 2, 0, CYAN, 0.25]);

  // the orange lights round the base, and on the cap: chasing round
  const N = 16;
  const lamps = R.own(new THREE.InstancedMesh(BALL8, R.own(new THREE.MeshBasicMaterial({ color: hot(ORANGE, 2.2) })), N * 2));
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < N; k++) {
    const a = (k / N) * TAU;
    lamps.setMatrixAt(k, at(x + Math.cos(a) * 1.46, 0.36, z + Math.sin(a) * 1.46, 0, 0.09));
    lamps.setMatrixAt(N + k, at(x + Math.cos(a) * 0.91, TUBE.y1 + 0.14, z + Math.sin(a) * 0.91, 0, 0.08));
  }
  // (each lamp lit full, or dimmed to an ember)
  const on = new THREE.Color(1, 1, 1);
  const off = new THREE.Color(0.1, 0.08, 0.06);
  for (let k = 0; k < N * 2; k++) lamps.setColorAt(k, on);
  R.add(lamps, { ink: false });
  // the bubbles in the tube
  const bubbles = R.own(new THREE.InstancedMesh(BALL8, R.own(new THREE.MeshBasicMaterial({ color: hot(0xd8ffff, 1.5) })), plan.bubbles));
  R.add(bubbles, { ink: false });
  const seeds = Array.from({ length: plan.bubbles }, (_, i) => [(i * 2.39) % TAU, 0.25 + ((i * 0.37) % 0.4), 0.35 + ((i * 0.53) % 0.5), 0.05 + 0.03 * Math.sin(i)]);
  return (t) => {
    for (let k = 0; k < N * 2; k++) lamps.setColorAt(k, Math.sin(t * 5 - (k % N) * 0.8) > 0.2 ? on : off);
    lamps.instanceColor.needsUpdate = true;
    for (let i = 0; i < seeds.length; i++) {
      const [a, rr, sp, s] = seeds[i];
      const k = (t * sp + i * 0.31) % 1;
      m4.makeScale(s, s, s).setPosition(x + Math.cos(a + t * 0.3) * rr * TUBE.r, TUBE.y0 + 0.1 + k * (TUBE.y1 - TUBE.y0 - 0.2), z + Math.sin(a + t * 0.3) * rr * TUBE.r);
      bubbles.setMatrixAt(i, m4);
    }
    bubbles.instanceMatrix.needsUpdate = true;
  };
}

// The clone floating in the tube: Rick's Meshy figure (or Rick in shapes),
// his arms loose, bobbing and turning slowly; a clone in stasis has no flask
// to reach for (Rick's own sips are the cast's, meshyCast's `fidget`)
async function floatingClone(R, it) {
  const kit = R.kit;
  await needCast(kit, ['rick']);
  const c = kit.cast?.make?.('rick') ?? null;
  c?.anim?.idles(null);
  const holder = new THREE.Group();
  const tall = 1.55;
  if (c) {
    c.group.scale.setScalar(tall / c.height);
    holder.add(c.group);
  } else {
    const parts = [];
    const p = (geo, color, x, y, z, sx, sy = sx, sz = sx) => parts.push({ geo, color, matrix: at(x, y, z, 0, sx, sy, sz) });
    p(CYL, 0xe8eef0, 0, 0.75, 0, 0.36, 0.7, 0.24);
    p(BALL, 0xd8e2e6, 0, 1.3, 0, 0.3);
    p(BALL8, 0xa8d8f0, 0, 1.45, -0.04, 0.34, 0.24, 0.3);
    for (const s of [-1, 1]) p(CYL, 0x8a7a5a, s * 0.09, 0.2, 0, 0.12, 0.42, 0.12);
    holder.add(new THREE.Mesh(R.own(mergeParts(parts)), kit.mats.toon(0xffffff, { vertexColors: true })));
  }
  holder.position.set(it.x, TUBE.y0 + 0.35, it.z);
  R.add(holder);
  return (t, dt) => {
    holder.position.y = TUBE.y0 + 0.35 + Math.sin(t * 0.8) * 0.08;
    holder.rotation.y = Math.PI * 0.08 + Math.sin(t * 0.21) * 0.5;
    c?.update?.(t, 0, 0, { dt });
  };
}

// ── Pickle Rick, in a jar on the east desk ──

async function jarPickle(R, it) {
  const kit = R.kit;
  // on the desk, at the end by the room's middle (the turn faces west: u runs north)
  const jx = it.x + Math.sin(it.turn) * 0.1;
  const jz = it.z - 0.55;
  const y = it.h;
  const f = R.frame(jx, jz, 0);
  f.cyl(0x2a6a2a, 0, y, 0, 0.13, 0.02).cyl(0xb8c0c4, 0, y + 0.42, 0, 0.135, 0.05);
  f.decal('jarlabel', 0, y + 0.16, 0.135, 0.12, 0.08);
  const glass = new THREE.Mesh(
    R.own(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 20, 1, true)),
    R.own(new THREE.MeshBasicMaterial({ color: hot(0x9dffb0, 0.32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
  );
  glass.position.set(jx, y + 0.22, jz);
  R.add(glass, { ink: false });
  let pk = null;
  try {
    const need = kit.need ? kit.need(['pickle'], { clips: [] }) : kit.cast?.load(null, ['pickle'], { clips: [] });
    await Promise.race([need, new Promise((done) => setTimeout(done, 8000))]);
    pk = kit.cast?.prop?.('pickle', 0.3) ?? null;
  } catch {
    pk = null;
  }
  if (!pk) {
    pk = toonPickle(R);
    pk.scale.setScalar(0.32);
  }
  const holder = new THREE.Group();
  holder.add(pk);
  holder.position.set(jx, y + 0.04, jz);
  holder.rotation.y = Math.PI / 2;
  R.add(holder);
  return (t) => {
    holder.position.y = y + 0.05 + Math.sin(t * 1.1) * 0.012;
    holder.rotation.y = Math.PI / 2 + Math.sin(t * 0.4) * 0.25;
  };
}

// a pickle in shapes: green and knobbly, round eyes, a frown, teeth
function toonPickle(R) {
  const parts = [];
  const p = (geo, color, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) => parts.push({ geo, color, matrix: at(x, y, z, ry, sx, sy, sz, rx, rz) });
  p(new THREE.CapsuleGeometry(0.16, 0.58, 6, 14), 0x6fae3e, 0, 0.45, 0, 0, 1.1, 1, 0.95);
  const r = rng(29);
  for (let i = 0; i < 18; i++) {
    const a = r() * TAU;
    p(BALL8, 0x5a9432, Math.cos(a) * 0.17, 0.2 + r() * 0.55, Math.sin(a) * 0.155, 0, 0.05);
  }
  for (const s of [-1, 1]) {
    p(BALL, 0xfbfaf4, s * 0.07, 0.68, 0.13, 0, 0.13);
    p(BALL8, 0x111111, s * 0.068, 0.68, 0.19, 0, 0.04);
    p(BOX, 0x3e5e22, s * 0.075, 0.77, 0.15, 0, 0.11, 0.025, 0.03, 0, s * 0.25);
  }
  p(BOX, 0x2a1a14, 0, 0.55, 0.165, 0, 0.16, 0.05, 0.03);
  p(BOX, 0xfbfaf4, 0, 0.565, 0.172, 0, 0.13, 0.015, 0.02);
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), R.kit.mats.toon(0xffffff, { vertexColors: true }));
  mesh.castShadow = true;
  return mesh;
}

// ── odds and ends ──

// yellow rails from the floor up through the ceiling to the garage, rungs,
// brackets to the wall
function ladder(R, it) {
  const f = R.frame(it.x, it.z, it.turn);
  const len = H + RISE - 0.05;
  for (const s of [-1, 1]) {
    f.box(LADDER, s * 0.27, 0, 0, 0.055, len, 0.045);
    for (const y of [0.6, 1.9, 3.1, 4.3]) f.box(0x6f7880, s * 0.27, y, -0.04, 0.04, 0.05, 0.08);
    f.box(0x3a3d42, s * 0.27, 0, 0, 0.075, 0.04, 0.07);
  }
  for (let y = 0.3; y < len - 0.1; y += 0.3) f.cyl(0x9aa3ab, 0, y, 0, 0.018, 0.54, 0, Math.PI / 2);
}

// a warning stripe round a box on the floor (`skip`: the sides to leave off, of 'nsew')
function hazardBox(f, x, z, w, d, skip = '', band = 0.14) {
  for (const s of [-1, 1]) {
    if (!skip.includes(s < 0 ? 'n' : 's')) f.decal('hazard', x, 0.003, z + s * (d / 2 - band / 2), w, band, { rx: -Math.PI / 2 });
    if (!skip.includes(s < 0 ? 'w' : 'e')) f.decal('hazard', x + s * (w / 2 - band / 2), 0.003, z, d - band * 2, band, { rx: -Math.PI / 2, ry: Math.PI / 2 });
  }
}

// Soft light on the floor and the walls (each spill [x, y, z, w, h, rx, ry,
// colour, k]): one additive mesh, its brightness humming
export function softLight(R, spills) {
  const parts = spills.map(([x, y, z, w, h, rx, ry, color, k]) => ({ geo: PLANE, color: hot(color, k), matrix: at(x, y, z, ry, w, h, 1, rx) }));
  const mat = R.own(new THREE.MeshBasicMaterial({ map: R.own(glowSpot()), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  const mesh = new THREE.Mesh(R.own(mergeParts(parts)), mat);
  mesh.renderOrder = 1;
  R.add(mesh, { ink: false });
  return mat;
}
