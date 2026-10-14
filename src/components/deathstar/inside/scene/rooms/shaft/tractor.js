// The tractor beam’s power terminal, as Obi-Wan finds it in A New Hope:
// a narrow ledge, no rail, out from the Level 6 corridor’s door over a
// shaft with no bottom to a small platform against the great column that
// couples the beam to the reactor; on the column’s face the terminal, a
// console of dials, indicator lights and its two power levers, with a
// board of big dials above. The column falls away into the dark, ringed
// with blue-white light, and far below, where it meets the reactor, it
// glows, the glow thinning out up the shaft in a long haze. Everything
// else is cool blue-grey and goes to black with depth. When the story
// turns the power down (the flag 'tractor-off'), the levers drop and the
// terminal’s lights go dark. Drawn from furnish’s props: the terminal,
// the two levers and the beam column, each where it says.
//
//   buildShaft(kit, room, layout, { renderer }) → { group, lamps, update(t, dt, ctx), dispose() }

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { seeded } from '../../../../../../lib/seeded';
import { detailCanvas, sharpen } from '../../../../../../lib/three/textures';
import { furnish } from '../../../rules/furnish';
import { probeRoom } from '../../probe';
import { deepWalls, glowDiscs, glowMaterial, hazeOf, lips, slab } from './depths';
import { approach, flagOn, hazeLayers, openEdges } from './plan';

const DOWN = { high: 56, small: 40 }; // metres the shaft is drawn under the ledge
const UP = 12; // and over the room’s ceiling
const BLUE = 0xa9cbff; // the beam’s light: blue-white
const COOL = 0xc4d6f2;
const LEVER = { on: 0.45, off: Math.PI - 0.45 }; // a lever’s tilt towards whoever works it, up and down
const GLOW = { on: 1.1, off: 0.04 }; // the terminal’s face, lit and dark

// facing yaw (0 faces −z), as a turn of the local +z for kit.at
const turnOf = (yaw) => Math.PI - yaw;

// ── the terminal’s faces ──

function lightsRow(ctx, x, y, n, step, size, colours, rand) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colours[Math.floor(rand() * colours.length)];
    ctx.fillRect(x + i * step, y, size[0], size[1]);
  }
}

// A dial: a pale face with ticks round its top two thirds and a needle.
function dial(ctx, x, y, r, at) {
  ctx.fillStyle = '#0c0e12';
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#56687c';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#15191f';
  ctx.lineWidth = 2;
  for (let k = 0; k <= 12; k++) {
    const a = Math.PI * (0.8 + (1.4 * k) / 12);
    const long = k % 3 === 0 ? 0.72 : 0.82;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * long, y + Math.sin(a) * r * long);
    ctx.lineTo(x + Math.cos(a) * r * 0.94, y + Math.sin(a) * r * 0.94);
    ctx.stroke();
  }
  const a = Math.PI * (0.8 + 1.4 * at);
  ctx.strokeStyle = '#d23a22';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86);
  ctx.stroke();
}

// The console’s front (between the levers: rows of lights, bar readouts,
// two small dials) and the board above (two big dials either side of a
// grid of lamps), painted once; their lit parts are the emissive map.
function paintFaces(kit, renderer) {
  const rand = seeded(7);
  const max = kit.small ? 256 : 512;
  const face = detailCanvas(512, 160, { level: kit.level, max });
  const board = detailCanvas(512, 240, { level: kit.level, max });
  // (mostly dark windows, a few lit: a working board, not a festival)
  const lit = ['#3fbf6a', '#d9963a', '#c8402c', '#b9c6d8', '#1a1e25', '#1a1e25', '#1a1e25'];
  for (const { ctx, h } of [{ ctx: face.ctx, h: 160 }, { ctx: board.ctx, h: 240 }]) {
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, 512, h);
    ctx.strokeStyle = '#1b1f26';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 504, h - 8);
  }
  const f = face.ctx;
  // the wells the levers stand in, dark
  for (const x of [20, 444]) {
    f.fillStyle = '#000';
    f.fillRect(x, 26, 48, 108);
  }
  for (let r = 0; r < 4; r++) lightsRow(f, 92, 22 + r * 16, 18, 18, [11, 8], lit, rand);
  for (let r = 0; r < 3; r++) {
    f.fillStyle = '#10141a';
    f.fillRect(92, 92 + r * 18, 220, 10);
    f.fillStyle = r === 1 ? '#9c7434' : '#2f8a55';
    f.fillRect(92, 92 + r * 18, 60 + rand() * 150, 10);
  }
  dial(f, 352, 112, 26, 0.3);
  dial(f, 408, 112, 26, 0.7);
  const b = board.ctx;
  dial(b, 110, 110, 62, 0.62);
  dial(b, 402, 110, 62, 0.35);
  for (let r = 0; r < 7; r++) lightsRow(b, 196, 40 + r * 18, 7, 18, [12, 9], lit, rand);
  lightsRow(b, 60, 196, 13, 32, [24, 14], ['#b9c6d8', '#4d86c4', '#3fbf6a', '#d9963a', '#1a1e25'], rand);
  b.fillStyle = '#4d86c4';
  b.fillRect(40, 14, 432, 4);
  const tex = (c) => sharpen(new THREE.CanvasTexture(c.canvas), { renderer, color: true });
  return { face: tex(face), board: tex(board) };
}

// ── the column ──

// The column from far under the ledge to far over it: a dark trunk, plated
// ribs all round, collars every 6 m each with a ring of the beam’s light
// and a fainter ring between, and six runs of light up it between the
// ribs, so that it reads in the dark and its rings and runs, going down
// into the haze, show how far down it goes.
function columnOf(kit, c, bottom, top, blue) {
  const r = c.w / 2;
  const H = top - bottom;
  const mid = (top + bottom) / 2;
  const parts = [{ geo: new THREE.CylinderGeometry(r - 0.12, r - 0.12, H, 40, 1, true).translate(c.x, mid, c.z), mat: 'trim' }];
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    parts.push({ geo: new THREE.BoxGeometry(0.2, H, 0.24).translate(r - 0.08, 0, 0).rotateY(a).translate(c.x, mid, c.z), mat: 'wall' });
  }
  for (let y = bottom + 3; y < top - 1; y += 6) {
    parts.push({ geo: new THREE.CylinderGeometry(r + 0.14, r + 0.14, 0.55, 40, 1, true).translate(c.x, y, c.z), mat: 'trim' });
    parts.push({ geo: new THREE.CylinderGeometry(r + 0.15, r + 0.15, 0.16, 40, 1, true).translate(c.x, y - 0.45, c.z), mat: blue });
    parts.push({ geo: new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.05, 40, 1, true).translate(c.x, y + 3, c.z), mat: blue });
  }
  for (let k = 0; k < 6; k++) {
    const a = ((k + 0.5) / 6) * Math.PI * 2 + Math.PI / 20;
    parts.push({ geo: new THREE.BoxGeometry(0.03, H, 0.07).translate(r - 0.1, 0, 0).rotateY(a).translate(c.x, mid, c.z), mat: blue });
  }
  return parts;
}

// Conduits from the column out to the shaft’s walls far down: the
// couplings to the reactor, each with a run of the beam’s light along it.
function couplingsOf(kit, c, room, bottom, blue) {
  const b = room.box;
  const r = c.w / 2;
  const parts = [];
  [[0.6, 18], [2.4, 27], [4.1, 36], [5.3, 46]].forEach(([a, down]) => {
    const dir = { x: Math.cos(a), z: Math.sin(a) };
    const reach = Math.min(...[dir.x > 0 ? (b.x1 - c.x) / dir.x : dir.x < 0 ? (b.x0 - c.x) / dir.x : Infinity, dir.z > 0 ? (b.z1 - c.z) / dir.z : dir.z < 0 ? (b.z0 - c.z) / dir.z : Infinity]);
    const y = Math.max(bottom + 4, room.y - down);
    const p = { x: c.x + dir.x * r, y, z: c.z + dir.z * r };
    const q = { x: c.x + dir.x * reach, y, z: c.z + dir.z * reach };
    parts.push(kit.beam(p, q, 1.1, 1.1, 'trim'));
    parts.push(kit.beam({ ...p, y: y + 0.58 }, { ...q, y: y + 0.58 }, 0.18, 0.06, blue));
  });
  return parts;
}

// ── the terminal ──

// The console in its own frame (x across its face, +z out to whoever
// works it, y up from the floor), the board on the column above it, the
// brackets back to the column, and the deck under it out to the column.
function terminalOf(kit, t, gap, face, board) {
  const [w, d, h] = [t.w, t.d, t.h];
  const parts = [
    kit.box(w, h - 0.06, d, 0, (h - 0.06) / 2, 0, 'trim'),
    kit.box(w + 0.06, 0.06, d + 0.06, 0, h - 0.03, 0, 'rail'),
    kit.box(w - 0.1, 0.1, 0.05, 0, 0.05, d / 2 + 0.01, 'black'),
    { geo: new THREE.PlaneGeometry(w - 0.3, 1).translate(0, 0.75, d / 2 + 0.004), mat: face },
    // the board: upright on the column’s side of the console, its dials in bezels
    kit.box(w, 1.6, 0.16, 0, h + 0.8, -d / 2 + 0.12, 'trim'),
    { geo: new THREE.PlaneGeometry(w - 0.2, 1.4).translate(0, h + 0.8, -d / 2 + 0.204), mat: board },
    kit.box(w + 0.2, 0.12, 0.5, 0, h + 1.66, -d / 2 + 0.2, 'trim'),
    // (the work light under the hood stays on when the power goes)
    kit.box(w - 0.4, 0.05, 0.05, 0, h + 1.58, -d / 2 + 0.43, 'strip'),
  ];
  for (const x of [-0.855, 0.855]) parts.push({ geo: new THREE.TorusGeometry(0.37, 0.028, 8, 36).translate(x, h + 0.86, -d / 2 + 0.215), mat: 'rail' });
  // the brackets that hold it to the column
  for (const x of [-w / 2 + 0.3, w / 2 - 0.3]) parts.push(kit.box(0.24, h + 1.5, gap + 0.1, x, (h + 1.5) / 2, -d / 2 - gap / 2, 'trim'));
  parts.push(kit.box(w + 0.4, 0.3, gap + d, 0, -0.16, -gap / 2, 'trim'));
  parts.push(kit.plate(w + 0.4, gap, 0, -0.008, -d / 2 - gap / 2, 'floor', 'up'));
  return parts;
}

// A lever on its pivot: a slot in the face, the arm and its lit knob; the
// pivot turns it (about x) from up to down.
function leverOf(kit, lamp) {
  const arm = new THREE.BoxGeometry(0.05, 0.24, 0.05).translate(0, 0.12, 0);
  const knob = new THREE.BoxGeometry(0.11, 0.08, 0.1).translate(0, 0.27, 0);
  const pivot = new THREE.Group();
  const metal = new THREE.Mesh(arm, kit.mat('rail'));
  const tip = new THREE.Mesh(knob, lamp);
  pivot.add(metal, tip);
  return { pivot, dispose: () => [arm, knob].forEach((g) => g.dispose()) };
}

export function buildShaft(kit, room, layout, { renderer = null } = {}) {
  const { props } = furnish(room, layout.station);
  const down = kit.small ? DOWN.small : DOWN.high;
  const bottom = room.y - down;
  const top = room.y + room.h + UP;
  const column = props.find((p) => p.kind === 'beam-column');
  const terminal = props.find((p) => p.kind === 'terminal');
  const levers = props.filter((p) => p.kind === 'lever');

  const blue = new THREE.MeshStandardMaterial({ color: 0x080b12, emissive: BLUE, emissiveIntensity: 4, roughness: 0.3, metalness: 0, name: 'ds-tractor-blue' });
  const { face: faceTex, board: boardTex } = paintFaces(kit, renderer);
  // (the face, the board and the lamps are node materials from the start: they
  // glow and go dark each frame, and the house look puts its own copy of a
  // classic material in its place, which these writes would never reach)
  const faceMat = new MeshStandardNodeMaterial({ color: 0x9aa3ad, map: faceTex, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: GLOW.on, roughness: 0.42, metalness: 0.25, name: 'ds-tractor-face' });
  const boardMat = faceMat.clone();
  boardMat.map = boardTex;
  boardMat.emissiveMap = boardTex;
  boardMat.name = 'ds-tractor-board';
  const lampMat = new MeshStandardNodeMaterial({ color: 0x1a0606, emissive: 0xff5a3c, emissiveIntensity: 2.6, roughness: 0.4, name: 'ds-tractor-lamp' });

  // the walls, shell and depths; the ledge and platform as slabs with lit lips; no ceiling
  const parts = kit.shell(room, layout, { floor: false, ceiling: false, bay: 2.4, rib: 0.34, ribDepth: 0.22, kick: 0.3, band: 0.5, tall: 1.9, lights: false, seed: 6 });
  parts.push(...deepWalls(kit, layout, room, { below: down, above: UP, storey: 4, every: 3, seed: 6 }));
  for (const f of room.floors) parts.push(...slab(kit, f, { thick: 0.3 }));
  parts.push(...lips(kit, openEdges(room), { thick: 0.3 }));
  // under the ledge, a girder out from the wall and a strut up to it; under the platform, struts to the column
  const box = room.box;
  // (the ledge is the floor that meets a wall, at the door; the platform stands free)
  const ledge = room.floors.find((f) => Math.abs(f.z1 - box.z1) < 1e-6 || Math.abs(f.z0 - box.z0) < 1e-6) ?? room.floors[0];
  const lx = (ledge.x0 + ledge.x1) / 2;
  parts.push(kit.box(0.5, 0.7, ledge.z1 - ledge.z0, lx, ledge.y - 0.65, (ledge.z0 + ledge.z1) / 2, 'trim'));
  const wallZ = Math.abs(ledge.z1 - box.z1) < Math.abs(ledge.z0 - box.z0) ? box.z1 : box.z0;
  const outZ = wallZ === box.z1 ? ledge.z0 + 1 : ledge.z1 - 1;
  parts.push(kit.beam({ x: lx, y: ledge.y - 5, z: wallZ }, { x: lx, y: ledge.y - 0.9, z: outZ }, 0.3, 0.4, 'trim'));
  if (column) {
    parts.push(...columnOf(kit, column, bottom, top, blue));
    parts.push(...couplingsOf(kit, column, room, bottom, blue));
    for (const f of room.floors.filter((g) => g !== ledge)) {
      for (const x of [f.x0 + 0.3, f.x1 - 0.3]) parts.push(kit.beam({ x, y: f.y - 3.4, z: column.z + Math.sign(f.z0 - column.z) * (column.w / 2 - 0.1) }, { x, y: f.y - 0.35, z: (f.z0 + f.z1) / 2 }, 0.2, 0.3, 'trim'));
    }
  }
  // the terminal, its board and its brackets, in its own frame; the levers’ slots and lamps
  let pivots = [];
  if (terminal) {
    const gap = column ? Math.max(0.05, Math.abs(terminal.z - column.z) - column.w / 2 - terminal.d / 2) : 0.2;
    parts.push(...kit.place(terminalOf(kit, terminal, gap, faceMat, boardMat), kit.at(terminal.x, terminal.y, terminal.z, turnOf(terminal.yaw))));
    const frame = kit.at(terminal.x, terminal.y, terminal.z, turnOf(terminal.yaw));
    const inv = frame.clone().invert();
    pivots = levers.map((l) => {
      const at = new THREE.Vector3(l.x, l.y, l.z).applyMatrix4(inv);
      const [x, y] = [at.x, at.y + l.h / 2];
      parts.push(...kit.place([kit.box(0.16, 0.44, 0.03, x, y, terminal.d / 2 + 0.015, 'black'), { geo: new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16).rotateX(Math.PI / 2).translate(x + (x < 0 ? 0.24 : -0.24), y + 0.12, terminal.d / 2 + 0.015), mat: lampMat }], frame));
      return { x, y, z: terminal.d / 2 + 0.03 };
    });
  }

  const built = kit.merge(parts);
  const group = new THREE.Group();
  group.name = room.id;
  group.add(built);

  // the levers, which move
  const holder = new THREE.Group();
  holder.name = 'tractor-levers';
  if (terminal) {
    holder.position.set(terminal.x, terminal.y, terminal.z);
    holder.rotation.y = turnOf(terminal.yaw);
  }
  const leverParts = pivots.map((p) => {
    const lever = leverOf(kit, lampMat);
    lever.pivot.position.set(p.x, p.y, p.z);
    lever.pivot.rotation.x = LEVER.on;
    holder.add(lever.pivot);
    return lever;
  });
  group.add(holder);

  // the dark down the shaft and over it, then the glow, added after it
  const haze = hazeOf(box, hazeLayers({ near: room.y - 2.5, far: bottom + 1, n: kit.small ? 7 : 14, keep: 0.02 }));
  const hazeUp = hazeOf(box, hazeLayers({ near: room.y + 6, far: top - 1, n: kit.small ? 3 : 6, keep: 0.06 }));
  group.add(haze, hazeUp);
  const glows = [];
  if (column) {
    const axis = { x: column.x, z: column.z };
    const r = column.w / 2;
    const shell = (radius, y0, y1, mat) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, y1 - y0, 48, 1, true).translate(column.x, (y0 + y1) / 2, column.z), mat);
      m.renderOrder = 2;
      return m;
    };
    // (a long falloff: blinding where the column meets the reactor, a blue
    // breath by the time it reaches the ledge)
    const core = glowMaterial({ color: BLUE, base: bottom, fall: 15, strength: 2.2, rim: false, top: room.y - 4, soft: 30 });
    const inner = glowMaterial({ color: BLUE, base: bottom, fall: 19, strength: 0.75, rim: true, top: room.y - 3, soft: 26 });
    const outer = glowMaterial({ color: 0x8fb6ff, base: bottom, fall: 24, strength: 0.3, rim: true, top: room.y - 3, soft: 30 });
    const discs = glowMaterial({ color: BLUE, base: bottom, fall: 18, strength: 0.2, rim: false, axis, radius: 8.5 });
    glows.push(
      shell(r + 0.2, bottom, room.y - 4, core),
      shell(r + 1.3, bottom, room.y - 3, inner),
      shell(r + 4.2, bottom, room.y - 3, outer),
      glowDiscs({ x: column.x, z: column.z, r: 8.5, ys: Array.from({ length: Math.floor((down - 6) / 4) }, (_, k) => bottom + 2 + k * 4) }, discs),
    );
    group.add(...glows);
  }

  const lamps = [
    { x: terminal?.x ?? room.x, y: room.y + 1.9, z: (terminal?.z ?? room.z) + 1.4, color: COOL, intensity: 5, distance: 7 },
    { x: column?.x ?? room.x, y: room.y - 12, z: (column?.z ?? room.z) + 4.5, color: BLUE, intensity: 320, distance: 34 },
    { x: lx, y: room.y + 2.6, z: wallZ + Math.sign(room.z - wallZ) * 1.2, color: COOL, intensity: 6, distance: 9 },
    // a cool light on the column’s face over the terminal, from across the shaft
    { x: column?.x ?? room.x, y: room.y + 6, z: (column?.z ?? room.z) + 6, color: COOL, intensity: 45, distance: 16 },
  ];
  const consoleLamp = lamps[0];
  const at = { x: terminal?.x ?? room.x, y: room.y + 1.5, z: (terminal?.z ?? room.z) + 2.2 };
  const reflection = probeRoom(renderer, group, at, { lamps });
  let off = null; // 0 lit, 1 dark; set from the flag at the first frame, then eased
  if (typeof window !== 'undefined') window.__tractorDebug = { group, glows, haze, hazeUp };

  return {
    group,
    lamps,
    update(t, dt, ctx) {
      for (const g of glows) g.material.uniforms.uTime.value = t;
      const want = flagOn(ctx, 'tractor-off') ? 1 : 0;
      off = off === null ? want : approach(off, want, dt, 1.4);
      // the lights stutter as they go, as power drains out of them
      const stutter = off > 0 && off < 1 ? 0.6 + 0.4 * Math.sin(t * 47) * Math.sin(t * 13) : 1;
      faceMat.emissiveIntensity = (GLOW.on + (GLOW.off - GLOW.on) * off) * stutter;
      boardMat.emissiveIntensity = faceMat.emissiveIntensity;
      lampMat.emissiveIntensity = 2.6 * (1 - off) * stutter;
      consoleLamp.intensity = 5 * (1 - 0.75 * off);
      for (const l of leverParts) l.pivot.rotation.x = LEVER.on + (LEVER.off - LEVER.on) * Math.min(1, off * 1.6);
    },
    dispose() {
      reflection.dispose();
      kit.free(built);
      for (const l of leverParts) l.dispose();
      for (const m of [haze, hazeUp, ...glows]) {
        m.geometry.dispose();
        m.material.dispose();
      }
      for (const m of [blue, faceMat, boardMat, lampMat]) m.dispose();
      faceTex.dispose();
      boardTex.dispose();
      group.removeFromParent();
    },
  };
}
