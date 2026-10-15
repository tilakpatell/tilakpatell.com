// Infiltration's models: a HYDRA facility built as a physical miniature on the
// operations room's holotable. Walls of gunmetal panels cut away at waist
// height (the south row lower still, like an architect's section, so the rooms
// behind them show), server racks, desks, a security terminal, wall cameras,
// laser gates, glass partitions, the file and the lift out, and the table
// itself with its glowing rim. One tile is T metres.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hot } from '../hq/engine';
import { pbr } from '../hq/assets';
import { PartBuilder, canvasTexture, placed, rbox } from '../hq/kit/shapes';
import { cell, opaque, solid } from './rules';

export const T = 1.6;
export const WALL_H = 1.05;
export const CUT_H = 0.34;
export const RED = 0xff2a1f;
export const BLUE = 0x5fd4ff;

// a tile's centre in the world (the level centred on the origin)
export const toWorld = (def, x, y) => [(x - (def.w - 1) / 2) * T, (y - (def.h - 1) / 2) * T];

// A box whose texture coordinates are in metres over `tile`, from where it
// stands in the world, so neighbouring boxes carry one pattern across.
function worldBox(w, h, d, x, y, z, tile = T) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    if (ay > 0.5) uv.setXY(i, p.getX(i) / tile, p.getZ(i) / tile);
    else if (ax > 0.5) uv.setXY(i, p.getZ(i) / tile, p.getY(i) / tile);
    else uv.setXY(i, p.getX(i) / tile, p.getY(i) / tile);
  }
  return g;
}

// ── the HYDRA emblem: the skull and its six tentacles ──
function drawEmblem(x, cx, cy, r, color = '#c41a1f') {
  x.save();
  x.translate(cx, cy);
  x.fillStyle = color;
  x.strokeStyle = color;
  // the tentacles, each curling clockwise at its end
  for (let i = 0; i < 6; i++) {
    const a = ((-55 + i * 60) * Math.PI) / 180;
    x.save();
    x.rotate(a);
    x.beginPath();
    const seg = 26;
    const left = [];
    const right = [];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const rad = r * (0.33 + 0.62 * t - 0.12 * Math.max(0, t - 0.75) ** 2 * 16);
      const bend = 0.18 * t + Math.max(0, t - 0.55) ** 2 * 9;
      const px = Math.cos(bend) * rad;
      const py = Math.sin(bend) * rad;
      const w = r * 0.12 * (1 - t) ** 1.1 + r * 0.012;
      const nx = -Math.sin(bend);
      const ny = Math.cos(bend);
      left.push([px + nx * w, py + ny * w]);
      right.push([px - nx * w, py - ny * w]);
    }
    x.moveTo(...left[0]);
    for (const p of left) x.lineTo(...p);
    for (const p of right.reverse()) x.lineTo(...p);
    x.closePath();
    x.fill();
    x.restore();
  }
  // a ring behind the skull
  x.beginPath();
  x.arc(0, 0, r * 0.36, 0, Math.PI * 2);
  x.fill();
  // the skull, cut out of the ring in black, then drawn in the colour
  x.globalCompositeOperation = 'destination-out';
  x.beginPath();
  x.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  x.fill();
  x.globalCompositeOperation = 'source-over';
  x.beginPath();
  x.ellipse(0, -r * 0.05, r * 0.24, r * 0.22, 0, Math.PI, 0);
  x.lineTo(r * 0.22, r * 0.08);
  x.lineTo(r * 0.14, r * 0.14);
  x.lineTo(r * 0.12, r * 0.26);
  x.lineTo(-r * 0.12, r * 0.26);
  x.lineTo(-r * 0.14, r * 0.14);
  x.lineTo(-r * 0.22, r * 0.08);
  x.closePath();
  x.fill();
  x.globalCompositeOperation = 'destination-out';
  for (const sd of [-1, 1]) {
    x.beginPath();
    x.moveTo(sd * r * 0.04, -r * 0.02);
    x.lineTo(sd * r * 0.17, -r * 0.08);
    x.lineTo(sd * r * 0.16, r * 0.05);
    x.lineTo(sd * r * 0.06, r * 0.06);
    x.closePath();
    x.fill();
  }
  x.beginPath();
  x.moveTo(0, r * 0.07);
  x.lineTo(-r * 0.035, r * 0.13);
  x.lineTo(r * 0.035, r * 0.13);
  x.closePath();
  x.fill();
  for (let i = -2; i <= 2; i++) x.fillRect(i * r * 0.045 - r * 0.008, r * 0.17, r * 0.016, r * 0.09);
  x.restore();
}

// ── materials ──
export async function facilityMaterials({ small = false } = {}) {
  const floor = await pbr('concrete-floor', { repeat: [1, 1], small, color: 0x8d9094, roughness: 1, metalness: 0, normalScale: 0.8 });
  floor.metalness = 0;
  const wall = await pbr('sci-panels', { small, color: 0x7d8691, metalness: 0.45, roughness: 0.85, normalScale: 1.4, envMapIntensity: 1.1 });
  const wallRed = await pbr('painted-metal', { small, color: 0x9a1a18, metalness: 0.4, roughness: 1, normalScale: 0.7 });
  const top = await pbr('concrete-worn', { small, color: 0x3b3f45, metalness: 0, roughness: 1, normalScale: 1 });
  top.metalness = 0;
  const plate = await pbr('steel-plate', { small, color: 0x7a7f74, metalness: 0.8, roughness: 0.9 });
  const brushed = await pbr('brushed-steel', { small, color: 0x9aa1aa, metalness: 1, roughness: 0.55 });
  const carbon = await pbr('carbon', { small, color: 0x3a3e44, metalness: 0.2, roughness: 1, envMapIntensity: 0.25 });
  const crateWood = await pbr('plywood', { small, color: 0x9c7a52, metalness: 0, roughness: 1 });
  crateWood.metalness = 0;
  return {
    floor,
    wall,
    top,
    wallRed,
    plate,
    brushed,
    carbon,
    crateWood,
    cap: new THREE.MeshStandardMaterial({ color: 0x1c2026, metalness: 0.85, roughness: 0.4, envMapIntensity: 0.8 }),
    cut: new THREE.MeshStandardMaterial({ color: 0x23272d, metalness: 0.3, roughness: 0.85, map: hatchTexture() }),
    trim: new THREE.MeshStandardMaterial({ color: 0x0f1114, metalness: 0.7, roughness: 0.5 }),
    plant: new THREE.MeshStandardMaterial({ color: 0x4a5058, metalness: 0.7, roughness: 0.55 }),
    table: new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.35, roughness: 0.8, envMapIntensity: 0.4 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8a9099, metalness: 1, roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.6, roughness: 0.55 }),
    rack: new THREE.MeshStandardMaterial({ color: 0x14171b, metalness: 0.8, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 1.6, emissiveMap: rackLights() }),
    case: new THREE.MeshStandardMaterial({ color: 0x3b4235, metalness: 0.55, roughness: 0.7 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa8d4ff, metalness: 0, roughness: 0.06, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
    screen: new THREE.MeshBasicMaterial({ map: screenTexture('hydra'), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }),
    screenOk: new THREE.MeshBasicMaterial({ map: screenTexture('open'), toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }),
    ledRed: new THREE.MeshBasicMaterial({ color: hot(RED, 3), toneMapped: false }),
    ledBlue: new THREE.MeshBasicMaterial({ color: hot(BLUE, 2.6), toneMapped: false }),
    stripRed: new THREE.MeshBasicMaterial({ color: hot(0xff2618, 1.6), toneMapped: false }),
    tube: new THREE.MeshBasicMaterial({ color: hot(0xdfeaff, 2.2), toneMapped: false }),
    folder: new THREE.MeshStandardMaterial({ map: folderTexture(), roughness: 0.75 }),
  };
}

// diagonal hatching for the cut tops of the section walls
function hatchTexture() {
  return canvasTexture(
    128,
    128,
    (x, w) => {
      x.fillStyle = '#5a1512';
      x.fillRect(0, 0, w, w);
      x.strokeStyle = '#c0281f';
      x.lineWidth = 7;
      for (let i = -w; i < w * 2; i += 24) {
        x.beginPath();
        x.moveTo(i, 0);
        x.lineTo(i + w, w);
        x.stroke();
      }
    },
    { repeat: [1, 1] },
  );
}

// the racks' front panels: rows of status lights in the dark
function rackLights() {
  return canvasTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, w, h);
    let s = 3;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let row = 0; row < 14; row++) {
      const y = 12 + row * 17;
      for (let i = 0; i < 18; i++) {
        if (r() < 0.45) continue;
        const c = r();
        x.fillStyle = c < 0.55 ? '#3dff8a' : c < 0.8 ? '#4fc8ff' : c < 0.93 ? '#ffb02a' : '#ff3326';
        x.globalAlpha = 0.5 + r() * 0.5;
        x.fillRect(14 + i * 12.5, y, 4, 3);
      }
      x.globalAlpha = 0.25;
      x.fillStyle = '#6a8090';
      x.fillRect(10, y + 7, w - 20, 1);
      x.globalAlpha = 1;
    }
  });
}

// a terminal's screen: HYDRA's red interface, or access granted in blue
function screenTexture(kind) {
  return canvasTexture(256, 160, (x, w, h) => {
    const red = kind === 'hydra';
    x.fillStyle = red ? '#1a0405' : '#031018';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = red ? 'rgba(255,60,50,0.35)' : 'rgba(90,210,255,0.35)';
    for (let yy = 0; yy < h; yy += 4) {
      x.beginPath();
      x.moveTo(0, yy);
      x.lineTo(w, yy);
      x.globalAlpha = 0.25;
      x.stroke();
    }
    x.globalAlpha = 1;
    if (red) {
      drawEmblem(x, 52, 70, 40, '#ff3a2e');
      x.fillStyle = '#ff6a5a';
      x.font = 'bold 15px monospace';
      x.fillText('HYDRA', 108, 48);
      x.font = '11px monospace';
      x.fillText('SECURITY GRID', 108, 66);
      x.fillText('CAMERAS: ONLINE', 108, 84);
      x.fillStyle = '#ff3a2e';
      for (let i = 0; i < 6; i++) x.fillRect(108 + i * 22, 100, 16, 6 + ((i * 7) % 13));
    } else {
      x.fillStyle = '#7fe0ff';
      x.font = 'bold 15px monospace';
      x.fillText('ACCESS', 20, 52);
      x.fillText('GRANTED', 20, 72);
      x.font = '11px monospace';
      x.fillText('CAMERAS: OFFLINE', 20, 98);
      x.fillText('// N.R.', 20, 116);
      x.strokeStyle = '#7fe0ff';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(200, 70, 26, 0, Math.PI * 2);
      x.stroke();
      x.beginPath();
      x.moveTo(188, 70);
      x.lineTo(197, 80);
      x.lineTo(214, 60);
      x.stroke();
    }
  });
}

// the file: a buff folder, stamped
function folderTexture() {
  return canvasTexture(256, 192, (x, w, h) => {
    x.fillStyle = '#b89b6a';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(80,50,20,0.25)';
    x.fillRect(0, 0, w, 14);
    x.fillStyle = '#2a1c10';
    x.font = 'bold 20px monospace';
    x.fillText('ROMANOFF, N.', 18, 64);
    x.font = '13px monospace';
    x.fillText('FILE 7-B · RED ROOM', 18, 88);
    x.save();
    x.translate(150, 140);
    x.rotate(-0.18);
    x.strokeStyle = '#b3161b';
    x.lineWidth = 4;
    x.strokeRect(-70, -20, 140, 38);
    x.fillStyle = '#b3161b';
    x.font = 'bold 22px monospace';
    x.fillText('CLASSIFIED', -64, 8);
    x.restore();
  });
}

// ── the floor's paint and joints, for one level ──
export function floorDecal(def, px = 96) {
  const W = def.w * px;
  const H = def.h * px;
  const floorAt = (x, y) => !opaque(def, x, y) && cell(def, x, y) !== '#';
  return canvasTexture(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    // grime, in soft blotches
    let s = 11 + def.index * 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < def.w * def.h * 0.8; i++) {
      const gx = r() * W;
      const gy = r() * H;
      const rad = px * (0.2 + r() * 0.7);
      const g = x.createRadialGradient(gx, gy, 0, gx, gy, rad);
      g.addColorStop(0, `rgba(0,0,0,${0.08 + r() * 0.1})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(gx - rad, gy - rad, rad * 2, rad * 2);
    }
    // the HYDRA emblem painted in the biggest open square
    let best = null;
    for (const n of [3, 2])
      for (let y = 1; y < def.h - n && !best; y++)
        for (let xx = 1; xx < def.w - n && !best; xx++) {
          let ok = true;
          for (let j = 0; j < n && ok; j++) for (let i = 0; i < n && ok; i++) if (cell(def, xx + i, y + j) !== '.') ok = false;
          if (ok) best = { x: xx, y, n };
        }
    if (best) {
      x.globalAlpha = 0.5;
      drawEmblem(x, (best.x + best.n / 2) * px, (best.y + best.n / 2) * px, best.n * px * 0.42, '#8e1418');
      x.globalAlpha = 1;
    }
    for (let y = 0; y < def.h; y++)
      for (let xx = 0; xx < def.w; xx++) {
        if (!floorAt(xx, y)) continue;
        const X = xx * px;
        const Y = y * px;
        // expansion joints round each slab, with a lit edge
        x.strokeStyle = 'rgba(0,0,0,0.55)';
        x.lineWidth = Math.max(1.5, px / 48);
        x.strokeRect(X + 1, Y + 1, px - 2, px - 2);
        x.strokeStyle = 'rgba(255,255,255,0.05)';
        x.lineWidth = 1;
        x.strokeRect(X + 3, Y + 3, px - 6, px - 6);
        // doorways: hazard stripes across the threshold
        const ew = solid(def, xx - 1, y) && solid(def, xx + 1, y) && !solid(def, xx, y - 1) && !solid(def, xx, y + 1);
        const ns = solid(def, xx, y - 1) && solid(def, xx, y + 1) && !solid(def, xx - 1, y) && !solid(def, xx + 1, y);
        if (ew || ns) {
          x.save();
          x.beginPath();
          if (ew) x.rect(X + 4, Y + px * 0.42, px - 8, px * 0.16);
          else x.rect(X + px * 0.42, Y + 4, px * 0.16, px - 8);
          x.clip();
          x.fillStyle = 'rgba(214,170,40,0.55)';
          x.fillRect(X, Y, px, px);
          x.fillStyle = 'rgba(15,15,15,0.7)';
          for (let k = -px; k < px * 2; k += px / 6) {
            x.beginPath();
            x.moveTo(X + k, Y);
            x.lineTo(X + k + px / 12, Y);
            x.lineTo(X + k + px / 12 + px, Y + px);
            x.lineTo(X + k + px, Y + px);
            x.fill();
          }
          x.restore();
        }
      }
    // the file: a red box painted round it
    const [fx, fy] = def.file;
    x.strokeStyle = 'rgba(200,30,30,0.7)';
    x.setLineDash([px / 10, px / 14]);
    x.lineWidth = px / 28;
    x.strokeRect(fx * px + px * 0.1, fy * px + px * 0.1, px * 0.8, px * 0.8);
    x.setLineDash([]);
  });
}

// ── the walls, in one go: bodies, caps, the cut south row, skirting and the
// red strips that run along the tops of some ──
export function buildWalls(def, mats) {
  const pb = new PartBuilder();
  const isWall = (x, y) => cell(def, x, y) === '#';
  for (let y = 0; y < def.h; y++)
    for (let x = 0; x < def.w; x++) {
      if (!isWall(x, y)) continue;
      // walls with no floor anywhere round them are the solid rock of the base
      let near = false;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (!isWall(x + i, y + j) && x + i >= 0 && y + j >= 0 && x + i < def.w && y + j < def.h) near = true;
      const [wx, wz] = toWorld(def, x, y);
      const south = y === def.h - 1;
      const h = !near ? CUT_H * 0.6 : south ? CUT_H : WALL_H;
      pb.add(south || !near ? 'cutWall' : 'wall', worldBox(T, h, T, wx, h / 2, wz));
      pb.add(south || !near ? 'cut' : 'top', worldBox(T + 0.02, 0.04, T + 0.02, wx, h + 0.02, wz, T / 2));
      if (!near || south) continue;
      // skirting and top strips on faces that look onto floor
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (isWall(x + dx, y + dy) || y + dy >= def.h || y + dy < 0) continue;
        const fx = wx + (dx * T) / 2;
        const fz = wz + (dy * T) / 2;
        pb.add('trim', worldBox(dx ? 0.06 : T, 0.12, dy ? 0.06 : T, fx + dx * 0.01, 0.06, fz + dy * 0.01));
        // a strip of red light under the cap on faces turned to the camera
        if (dy === 1 && (x + y) % 3 !== 0) pb.add('strip', worldBox(T * 0.86, 0.022, 0.03, fx, h - 0.09, fz + 0.016));
        // vertical ribs where wall faces meet each tile
        pb.add('cap', worldBox(dx ? 0.07 : 0.08, h * 0.96, dy ? 0.07 : 0.08, fx + (dy ? -T / 2 + 0.04 : 0), h * 0.48, fz + (dx ? -T / 2 + 0.04 : 0)));
      }
    }
  // plant on the wall tops, where the walls run thick or long: vents, a duct,
  // an air handler, so the tops read as a building's and not as blocks
  for (let y = 0; y < def.h - 1; y++)
    for (let x = 0; x < def.w; x++) {
      if (!isWall(x, y)) continue;
      const hsh = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + def.index * 3.1) * 43758.5453) % 1;
      const [wx, wz] = toWorld(def, x, y);
      const top = WALL_H + 0.04;
      const ew = isWall(x - 1, y) && isWall(x + 1, y);
      const ns = isWall(x, y - 1) && isWall(x, y + 1);
      if (hsh < 0.18) {
        // a louvred vent
        pb.add('plant', worldBox(0.55, 0.12, 0.55, wx - 0.2, top + 0.06, wz + 0.1, 0.5));
        for (let i = 0; i < 4; i++) pb.add('trim', worldBox(0.5, 0.015, 0.04, wx - 0.2, top + 0.125, wz - 0.08 + i * 0.12));
      } else if (hsh < 0.3 && (ew || ns)) {
        // a duct along the wall
        pb.add('plant', ew ? worldBox(T, 0.22, 0.34, wx, top + 0.11, wz - 0.3, 0.6) : worldBox(0.34, 0.22, T, wx + 0.3, top + 0.11, wz, 0.6));
        pb.add('trim', ew ? worldBox(0.06, 0.24, 0.38, wx + T * 0.3, top + 0.12, wz - 0.3) : worldBox(0.38, 0.24, 0.06, wx + 0.3, top + 0.12, wz + T * 0.3));
      } else if (hsh > 0.93 && ew && ns) {
        // an air handler where the walls meet
        pb.add('plant', worldBox(0.9, 0.4, 0.7, wx, top + 0.2, wz, 0.6));
        pb.add('trim', new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20).translate(wx + 0.1, top + 0.415, wz));
      }
    }
  const g = pb.build({ wall: mats.wall, cutWall: mats.wall, top: mats.top, cap: mats.cap, cut: mats.cut, trim: mats.trim, strip: mats.stripRed, plant: mats.plant });
  g.getObjectByName('strip').castShadow = false;
  return g;
}

// ── props for the map's other letters ──
// A server rack, a desk with a monitor, a stack of cases, a glass panel, a
// terminal: each built at the origin, facing +z.
export function rackGeometry() {
  const pb = new PartBuilder();
  pb.add('body', rbox(T * 0.86, 1.62, T * 0.7, 0.03), { p: [0, 0.81, 0] });
  pb.add('face', new THREE.PlaneGeometry(T * 0.74, 1.46), { p: [0, 0.83, T * 0.351] });
  pb.add('face', new THREE.PlaneGeometry(T * 0.74, 1.46), { p: [0, 0.83, -T * 0.351], r: [0, Math.PI, 0] });
  pb.add('body', rbox(T * 0.9, 0.06, T * 0.74, 0.02), { p: [0, 1.64, 0] });
  for (const sd of [-1, 1]) pb.add('steel', rbox(0.04, 1.5, 0.04, 0.01), { p: [sd * T * 0.39, 0.8, T * 0.36] });
  return pb.geometries();
}

export function deskGeometry() {
  const pb = new PartBuilder();
  pb.add('top', rbox(T * 0.86, 0.05, T * 0.5, 0.01), { p: [0, 0.76, -0.05] });
  for (const sx of [-1, 1]) pb.add('dark', rbox(0.05, 0.74, T * 0.44, 0.01), { p: [sx * T * 0.39, 0.37, -0.05] });
  pb.add('dark', rbox(T * 0.8, 0.4, 0.03, 0.01), { p: [0, 0.52, -0.28] }); // modesty panel
  // two monitors on arms, a keyboard
  for (const sx of [-0.27, 0.27]) {
    pb.add('dark', rbox(0.58, 0.36, 0.04, 0.01), { p: [sx, 1.08, -0.2], r: [-0.08, sx > 0 ? -0.25 : 0.25, 0] });
    pb.add('screen', new THREE.PlaneGeometry(0.54, 0.32), { p: [sx + (sx > 0 ? -0.006 : 0.006), 1.08, -0.177], r: [-0.08, sx > 0 ? -0.25 : 0.25, 0] });
    pb.add('dark', new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), { p: [sx, 0.92, -0.22] });
  }
  pb.add('dark', rbox(0.5, 0.02, 0.16, 0.005), { p: [0, 0.795, 0.05] });
  // a chair
  pb.add('dark', rbox(0.46, 0.08, 0.44, 0.03), { p: [0, 0.48, 0.42] });
  pb.add('dark', rbox(0.44, 0.5, 0.06, 0.03), { p: [0, 0.78, 0.64], r: [-0.12, 0, 0] });
  pb.add('steel', new THREE.CylinderGeometry(0.03, 0.03, 0.42, 8), { p: [0, 0.22, 0.42] });
  return pb.geometries();
}

export function caseGeometry(seed) {
  const pb = new PartBuilder();
  let s = seed * 97 + 13;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = 2 + Math.floor(r() * 2);
  let y = 0;
  for (let i = 0; i < n; i++) {
    const w = T * (0.62 + r() * 0.2);
    const d = T * (0.5 + r() * 0.2);
    const h = 0.32 + r() * 0.16;
    const rot = (r() - 0.5) * 0.25;
    const ox = (r() - 0.5) * 0.15;
    const oz = (r() - 0.5) * 0.15;
    pb.add('case', rbox(w, h, d, 0.04), { p: [ox, y + h / 2, oz], r: [0, rot, 0] });
    // latches and ribs
    pb.add('steel', rbox(w * 1.01, 0.03, d * 1.01, 0.01), { p: [ox, y + h * 0.7, oz], r: [0, rot, 0] });
    pb.add('dark', rbox(0.1, 0.05, 0.03, 0.01), { p: [ox + Math.cos(rot) * w * 0.25, y + h * 0.7, oz + d / 2 + 0.01], r: [0, rot, 0] });
    y += h;
  }
  return pb.geometries();
}

export function glassGeometry(alongX) {
  const pb = new PartBuilder();
  const r = [0, alongX ? 0 : Math.PI / 2, 0];
  pb.add('glass', new THREE.BoxGeometry(T, 1.9, 0.03), { p: [0, 0.97, 0], r });
  pb.add('frame', rbox(T, 0.08, 0.1, 0.02), { p: [0, 0.04, 0], r });
  pb.add('frame', rbox(T, 0.05, 0.08, 0.02), { p: [0, 1.93, 0], r });
  for (const sd of [-1, 1]) pb.add('frame', rbox(0.05, 1.95, 0.08, 0.02), { p: alongX ? [(sd * T) / 2, 0.97, 0] : [0, 0.97, (sd * T) / 2] });
  return pb.geometries();
}

// The security terminal: a console with its screen tilted up, facing +z.
export function terminalGeometry() {
  const pb = new PartBuilder();
  pb.add('body', rbox(T * 0.62, 0.92, 0.5, 0.04), { p: [0, 0.46, -0.1] });
  pb.add('body', rbox(T * 0.62, 0.5, 0.12, 0.03), { p: [0, 1.1, -0.18], r: [-0.45, 0, 0] });
  pb.add('screen', new THREE.PlaneGeometry(T * 0.54, 0.42), { p: [0, 1.11, -0.11], r: [-0.45, 0, 0] });
  pb.add('steel', rbox(T * 0.58, 0.04, 0.26, 0.01), { p: [0, 0.92, 0.12], r: [0.2, 0, 0] });
  pb.add('led', rbox(0.05, 0.05, 0.02, 0.01), { p: [T * 0.24, 0.8, 0.16] });
  return pb.geometries();
}

// A wall camera on a short post: `head` turns (yaw) and tips (pitch).
export function buildCamera(mats) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.6, 10), mats.steel);
  post.position.y = 0.3;
  post.castShadow = true;
  g.add(post);
  const yaw = new THREE.Group();
  yaw.position.y = 0.62;
  g.add(yaw);
  const pitch = new THREE.Group();
  yaw.add(pitch);
  const housing = new THREE.Mesh(rbox(0.16, 0.15, 0.42, 0.04), mats.dark);
  housing.position.z = 0.12;
  housing.castShadow = true;
  pitch.add(housing);
  const hood = new THREE.Mesh(rbox(0.2, 0.03, 0.46, 0.01), mats.cap);
  hood.position.set(0, 0.09, 0.14);
  pitch.add(hood);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.04, 16).rotateX(Math.PI / 2), mats.trim);
  lens.position.z = 0.34;
  pitch.add(lens);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), mats.ledRed.clone());
  led.position.set(0.05, 0.05, 0.33);
  pitch.add(led);
  g.userData = { yaw, pitch, led, lens };
  return g;
}

// A laser emitter for a wall face: a slim housing with three lenses.
export function emitterGeometry() {
  const pb = new PartBuilder();
  pb.add('body', rbox(0.18, 1.0, 0.1, 0.03), { p: [0, 0.55, 0] });
  for (const y of [0.25, 0.55, 0.85]) pb.add('lens', new THREE.CylinderGeometry(0.03, 0.03, 0.03, 12), { p: [0, y, 0.055], r: [Math.PI / 2, 0, 0] });
  return pb.geometries();
}

// The file on its stand, and the marker over it.
export function buildFile(mats) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(rbox(0.5, 0.7, 0.4, 0.03), mats.dark);
  stand.position.y = 0.35;
  stand.castShadow = true;
  g.add(stand);
  const top = new THREE.Mesh(rbox(0.56, 0.04, 0.46, 0.01), mats.steel);
  top.position.y = 0.72;
  g.add(top);
  const folder = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.25), [mats.dark, mats.dark, mats.folder, mats.dark, mats.dark, mats.dark]);
  folder.position.set(0, 0.75, 0);
  folder.rotation.y = 0.25;
  folder.castShadow = true;
  g.add(folder);
  g.userData = { folder };
  return g;
}

// The lift out: a plate in the floor ringed with light.
export function buildExit(mats) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(rbox(T * 0.86, 0.06, T * 0.86, 0.03), mats.plate);
  plate.position.y = 0.03;
  plate.receiveShadow = true;
  g.add(plate);
  const ringMat = new THREE.MeshBasicMaterial({ color: hot(RED, 1.6), toneMapped: false, transparent: true });
  const ring = new THREE.Mesh(new THREE.RingGeometry(T * 0.3, T * 0.34, 48).rotateX(-Math.PI / 2), ringMat);
  ring.position.y = 0.065;
  g.add(ring);
  // chevrons pointing in
  const chev = new THREE.Shape();
  chev.moveTo(-0.12, 0);
  chev.lineTo(0, 0.08);
  chev.lineTo(0.12, 0);
  chev.lineTo(0.12, 0.04);
  chev.lineTo(0, 0.12);
  chev.lineTo(-0.12, 0.04);
  chev.closePath();
  const cg = [];
  for (let i = 0; i < 4; i++) cg.push(placed(new THREE.ShapeGeometry(chev).rotateX(-Math.PI / 2), { p: [0, 0.066, 0], r: [0, (i * Math.PI) / 2, 0] }).translate(Math.sin((i * Math.PI) / 2) * T * 0.4, 0, Math.cos((i * Math.PI) / 2) * T * 0.4));
  const chevrons = new THREE.Mesh(mergeGeometries(cg), ringMat);
  g.add(chevrons);
  g.userData = { ringMat };
  return g;
}

// The holotable under the facility: a dark slab with a bevelled edge, a strip
// of blue light round it, and the projector's markings on the surface.
export function buildTable(def, mats, title) {
  const g = new THREE.Group();
  const W = def.w * T + 2.6;
  const D = def.h * T + 2.6;
  const slab = new THREE.Mesh(rbox(W, 0.6, D, 0.12, 2), mats.table);
  slab.position.y = -0.31;
  slab.receiveShadow = true;
  g.add(slab);
  const lip = new THREE.Mesh(rbox(W + 0.24, 0.16, D + 0.24, 0.07, 2), mats.cap);
  lip.position.y = -0.62;
  g.add(lip);
  // the light round the edge
  const edge = new THREE.Mesh(rbox(W + 0.06, 0.035, D + 0.06, 0.016, 1), mats.ledBlue);
  edge.position.y = -0.05;
  g.add(edge);
  // markings on the table top, round the model
  const px = 40;
  const tex = canvasTexture(Math.round(W * px), Math.round(D * px), (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.strokeStyle = 'rgba(110,210,255,0.55)';
    x.fillStyle = 'rgba(110,210,255,0.7)';
    x.lineWidth = 2;
    const m = 0.5 * px;
    const L = 1.0 * px;
    for (const [cx, cy, sx, sy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ]) {
      x.beginPath();
      x.moveTo(cx, cy + sy * L);
      x.lineTo(cx, cy);
      x.lineTo(cx + sx * L, cy);
      x.stroke();
    }
    x.font = `600 ${Math.round(0.26 * px)}px monospace`;
    x.fillText(title, 1.3 * px, 0.85 * px);
    x.textAlign = 'right';
    x.fillText('S.H.I.E.L.D. // OPS', w - 1.3 * px, 0.85 * px);
    x.textAlign = 'left';
    x.globalAlpha = 0.6;
    x.font = `${Math.round(0.2 * px)}px monospace`;
    x.fillText(`GRID ${def.w}×${def.h} · ${(def.w * 1.6).toFixed(1)} M`, 1.3 * px, h - 0.6 * px);
  });
  const marks = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
  marks.position.y = 0.002;
  g.add(marks);
  g.userData = { marks };
  return g;
}

// A soft dark backdrop: the operations room, out of focus.
export function backdropTexture() {
  return canvasTexture(512, 512, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.5, w * 0.75);
    g.addColorStop(0, '#111a24');
    g.addColorStop(0.55, '#080c12');
    g.addColorStop(1, '#030407');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    // screens on the far wall, blurred
    let s = 5;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    x.filter = 'blur(6px)';
    for (let i = 0; i < 9; i++) {
      const sx = 40 + r() * (w - 120);
      const sy = 60 + r() * 120;
      x.fillStyle = r() < 0.75 ? `rgba(70,150,210,${0.12 + r() * 0.12})` : `rgba(200,40,40,${0.1 + r() * 0.1})`;
      x.fillRect(sx, sy, 50 + r() * 60, 30 + r() * 30);
    }
    x.filter = 'none';
  });
}
