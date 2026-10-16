// The things that stand in the second Death Star’s working half, each
// drawn on the prop furnish puts down for it (its middle and foot, facing
// its yaw): the command centre’s crew stations, the firing switch with its
// beeping lights, Jerjerrod’s desk and the nameplate on it, the targeting
// screens, the rack of A280s; the crates along the bays’ walls; the
// antechamber’s columns and the Royal Guards’ posts. Each is built in its
// own frame (+z its front, y up from its foot) and set down by `onProp`.
//
//   onProp(kit, prop, local) → parts   a prop’s parts turned and set down where furnish put it
//   consoleParts(kit, w, d) → local parts   a crew station, its sloped face of buttons and its screens
//   switchParts(kit, w, d, blink) → local parts   the firing switch: a console with a guarded lever and lights
//   deskParts(kit, w, d, h) → local parts;   plateParts(kit, w, h, d, face) → local parts (the nameplate)
//   screenParts(kit, w, h, face) → local parts   a wall screen in its frame, foot at y 0
//   crateParts(kit, w, d, h) → local parts;   columnParts(kit, w, h) → local parts;   postParts(kit, w, d) → local parts
//   rackOn(kit, at) → { group, parts }   two A280s upright on a wall rack (the guns shared, from ../../guns)
//   targetFace(kit, renderer) → { material, update(t), dispose() }   the big screen: the station’s superlaser on a cruiser
//   nameFace(kit, text, renderer) → { material, dispose() }   lettering on a dark plate
//   blinker() → { material, update(t), dispose() }   lights that beep a short flash a second

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { detailCanvas, sharpen } from '../../../../../../lib/three/textures';
import { buildGun } from '../../guns';

const SLOPE = 1.13; // a console’s face leans back 65° from upright, as Docking Control’s do

export const onProp = (kit, prop, local) => kit.place(local, kit.at(prop.x, prop.y, prop.z, Math.PI - prop.yaw));

// a face w × h leaning back from upright towards −z, centred at x, y, z
const leaning = (w, h, x, y, z, role) => ({ geo: new THREE.PlaneGeometry(w, h).rotateX(-SLOPE).translate(x, y, z), mat: role });

export function consoleParts(kit, w, d) {
  const parts = [
    kit.box(w - 0.12, 0.1, d - 0.12, 0, 0.05, -0.03, 'black'),
    kit.box(w, 0.66, d, 0, 0.43, 0, 'trim'),
    kit.box(w - 0.2, 0.025, 0.02, 0, 0.115, d / 2 - 0.05, 'strip'),
    { geo: new THREE.BoxGeometry(w, 0.05, 0.36).rotateX(Math.PI / 2 - SLOPE).translate(0, 0.8, 0.03), mat: 'trim' },
    leaning(w - 0.08, 0.32, 0, 0.83, 0.04, 'console'),
    kit.box(w, 0.36, 0.13, 0, 0.92, -d / 2 + 0.065, 'trim'),
  ];
  const n = Math.max(1, Math.round(w / 0.8));
  for (let i = 0; i < n; i++) parts.push(kit.plate(w / n - 0.12, 0.24, ((i + 0.5) / n - 0.5) * w, 0.93, -d / 2 + 0.131, 'screen'));
  return parts;
}

export function switchParts(kit, w, d, blink) {
  const parts = consoleParts(kit, w, d);
  // the housing on the face, its lever under a guard lifted open, and the lights that beep
  parts.push(kit.box(0.56, 0.14, 0.3, 0, 0.88, 0.02, 'trim'), kit.box(0.4, 0.02, 0.2, 0, 0.955, 0.02, 'black'));
  parts.push(kit.beam({ x: 0, y: 0.95, z: 0.04 }, { x: 0, y: 1.16, z: 0.12 }, 0.035, 0.035, 'rail'), kit.box(0.2, 0.035, 0.035, 0, 1.17, 0.125, 'rail'));
  parts.push({ geo: new THREE.BoxGeometry(0.42, 0.02, 0.22).rotateX(-1.2).translate(0, 1.03, -0.12), mat: 'black' });
  for (let i = 0; i < 6; i++) parts.push(kit.box(0.05, 0.03, 0.03, -0.62 + i * 0.09, 0.79, 0.19, blink));
  for (const x of [0.46, 0.6]) parts.push(kit.box(0.07, 0.03, 0.07, x, 0.8, 0.12, 'red'));
  return parts;
}

export function deskParts(kit, w, d, h) {
  return [
    kit.box(w, 0.06, d, 0, h - 0.03, 0, 'trim'),
    kit.plate(w - 0.16, d - 0.16, 0, h + 0.001, 0, 'black', 'up'),
    kit.plate(0.5, 0.28, -w * 0.18, h + 0.002, -0.12, 'screen', 'up'),
    kit.box(w - 0.1, h - 0.16, 0.05, 0, (h - 0.06) / 2, d / 2 - 0.08, 'trim'),
    ...[-1, 1].map((s) => kit.box(0.42, h - 0.06, d - 0.12, s * (w / 2 - 0.26), (h - 0.06) / 2, -0.02, 'trim')),
    kit.box(w - 0.24, 0.02, 0.02, 0, h - 0.075, d / 2 - 0.02, 'strip'),
  ];
}

export function plateParts(kit, w, h, d, face) {
  return [kit.box(w, h, d, 0, h / 2, 0, 'trim'), { geo: new THREE.PlaneGeometry(w - 0.012, h - 0.014).translate(0, h / 2, d / 2 + 0.001), mat: face }];
}

export function screenParts(kit, w, h, face) {
  return [kit.box(w + 0.16, h + 0.16, 0.08, 0, h / 2, 0, 'trim'), { geo: new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0.041), mat: face }, kit.box(w * 0.6, 0.03, 0.03, 0, -0.1, 0.05, 'strip')];
}

export function crateParts(kit, w, d, h) {
  return [
    kit.box(w - 0.04, h - 0.04, d - 0.04, 0, h / 2, 0, 'trim'),
    kit.box(w, 0.1, d, 0, h - 0.05, 0, 'black'),
    kit.box(w, 0.1, d, 0, 0.05, 0, 'black'),
    kit.box(w * 0.42, 0.16, 0.012, 0, h * 0.62, d / 2 - 0.014, 'rail'),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => kit.box(0.07, h - 0.2, 0.07, sx * (w / 2 - 0.035), h / 2, sz * (d / 2 - 0.035), 'rail'))),
  ];
}

// A column of the antechamber: a square shaft on a plinth under a deep
// capital, a rib down each corner and a light set into each face.
export function columnParts(kit, w, h) {
  const c = w * 0.38;
  const parts = [kit.box(w * 0.76, h, w * 0.76, 0, h / 2, 0, 'wall'), kit.box(w, 0.4, w, 0, 0.2, 0, 'trim'), kit.box(w, 0.5, w, 0, h - 0.25, 0, 'trim'), kit.box(w * 0.9, 0.08, w * 0.9, 0, h - 0.54, 0, 'black')];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(kit.box(0.13, h - 0.9, 0.13, sx * c, h / 2 - 0.05, sz * c, 'trim'));
  for (const [x, z, bw, bd] of [[0, c + 0.005, 0.08, 0.02], [0, -c - 0.005, 0.08, 0.02], [c + 0.005, 0, 0.02, 0.08], [-c - 0.005, 0, 0.02, 0.08]]) parts.push(kit.box(bw, h - 1.8, bd, x, h / 2 - 0.1, z, 'strip'));
  return parts;
}

// A guard’s post: a square of dark steel let into the deck, edged bright.
export function postParts(kit, w, d) {
  const e = 0.05;
  return [kit.plate(w, d, 0, 0.003, 0, 'black', 'up'), ...[[w, e, 0, -d / 2], [w, e, 0, d / 2], [e, d, -w / 2, 0], [e, d, w / 2, 0]].map(([pw, pd, x, z]) => kit.plate(pw, pd, x, 0.005, z, 'rail', 'up'))];
}

// The rack: a plate on the wall with a shelf, a clamp at each muzzle and
// a lit label, and two A280s standing in it, barrels up, sides to the room.
export function rackOn(kit, at) {
  const local = [kit.box(1.3, 1.55, 0.04, 0, 1.25, 0.02, 'trim'), kit.box(1.3, 0.06, 0.2, 0, 0.6, 0.1, 'rail'), kit.box(1.3, 0.05, 0.12, 0, 1.45, 0.06, 'rail'), kit.box(0.5, 0.06, 0.02, 0, 1.9, 0.045, 'strip')];
  const group = new THREE.Group();
  group.name = 'rifle-rack';
  group.position.set(at.x, at.y ?? 0, at.z);
  group.rotation.y = Math.PI - at.yaw;
  // a gun’s barrel (−z) up, its side (+x) to the room (+z), its top along the wall
  const upright = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0));
  for (const x of [-0.3, 0.3]) {
    const gun = buildGun('a280');
    if (!gun) continue;
    gun.quaternion.setFromRotationMatrix(upright);
    gun.position.set(x, 0.98, 0.1);
    group.add(gun);
  }
  group.updateMatrixWorld(true);
  return { group, parts: kit.place(local, kit.at(at.x, at.y ?? 0, at.z, Math.PI - at.yaw)) };
}

const glyph = (ctx, x, y, s, rand) => {
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const [a, b] = [Math.floor(rand() * 9), Math.floor(rand() * 9)];
    ctx.moveTo(x + (a % 3) * s, y + Math.floor(a / 3) * s * 1.4);
    ctx.lineTo(x + (b % 3) * s, y + Math.floor(b / 3) * s * 1.4);
  }
  ctx.stroke();
};

// The targeting screen, painted once: a grid, the station as a wireframe
// with its unfinished side open and its dish lit, the beam’s line out to
// a cruiser boxed in a reticle, a range scale and columns of made-up
// Imperial lettering. The reticle pulses by the material’s glow.
function paintTarget(kit) {
  const [W, H] = [1024, 512];
  const { canvas, ctx } = detailCanvas(W, H, { level: kit.level, max: kit.small ? 512 : 1024 });
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  ctx.fillStyle = '#010604';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(70,255,150,0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 32) ctx.strokeRect(x, 0, 0, H);
  for (let y = 0; y <= H; y += 32) ctx.strokeRect(0, y, W, 0);
  const [cx, cy, r] = [300, 280, 170];
  ctx.strokeStyle = '#5dffb0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -0.25 * Math.PI, 1.55 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  for (let k = -3; k <= 3; k++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, Math.abs(r * Math.cos((k * Math.PI) / 7)), 0, k < 0 ? 0.1 : -0.2, Math.PI * 1.5);
    ctx.stroke();
  }
  // the unfinished side: girders reaching into the gap
  for (let k = 0; k < 9; k++) {
    const a = -0.25 * Math.PI - (k / 9) * 0.45 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55);
    ctx.lineTo(cx + Math.cos(a) * r * (0.85 + rand() * 0.2), cy + Math.sin(a) * r * (0.85 + rand() * 0.2));
    ctx.stroke();
  }
  const dish = { x: cx - r * 0.42, y: cy - r * 0.5 };
  ctx.fillStyle = '#c8ffe2';
  ctx.beginPath();
  ctx.arc(dish.x, dish.y, 26, 0, Math.PI * 2);
  ctx.fill();
  const target = { x: 820, y: 170 };
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = '#ff5a48';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(dish.x, dish.y);
  ctx.lineTo(target.x, target.y);
  ctx.stroke();
  ctx.setLineDash([]);
  // the cruiser: a long rounded hull, its engines aft
  ctx.strokeStyle = '#5dffb0';
  ctx.beginPath();
  ctx.ellipse(target.x, target.y, 64, 18, -0.15, 0, Math.PI * 2);
  ctx.stroke();
  for (let k = -1; k <= 1; k++) ctx.strokeRect(target.x + 56, target.y - 10 + k * 7, 14, 4);
  ctx.strokeStyle = '#ff5a48';
  ctx.lineWidth = 3;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(target.x + sx * 92, target.y + sy * 52);
    ctx.lineTo(target.x + sx * 92, target.y + sy * 30);
    ctx.moveTo(target.x + sx * 92, target.y + sy * 52);
    ctx.lineTo(target.x + sx * 66, target.y + sy * 52);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(93,255,176,0.8)';
  ctx.lineWidth = 1.4;
  for (let row = 0; row < 7; row++) for (let col = 0; col < 9; col++) glyph(ctx, 620 + col * 18, 290 + row * 26, 4, rand);
  ctx.fillStyle = '#5dffb0';
  for (let k = 0; k <= 20; k++) ctx.fillRect(560 + k * 22, 480, 2, k % 5 ? 8 : 16);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  return canvas;
}

export function targetFace(kit, renderer) {
  const texture = sharpen(new THREE.CanvasTexture(paintTarget(kit)), { renderer, color: true });
  // (a node material from the start: it pulses each frame, and the house look
  // puts its own copy of a classic material in its place, which no pulse reaches)
  const material = new MeshStandardNodeMaterial({ color: 0x000000, roughness: 0.25, emissive: 0xffffff, emissiveIntensity: 1.5, emissiveMap: texture, name: 'ds2-target' });
  return {
    material,
    update(t) {
      material.emissiveIntensity = 1.35 + 0.25 * Math.max(0, Math.sin(t * 4));
    },
    dispose() {
      material.dispose();
      texture.dispose();
    },
  };
}

// Lettering on a dark plate, in silver capitals, between thin rules.
function paintName(kit, text) {
  const [W, H] = [512, 96];
  const { canvas, ctx } = detailCanvas(W, H, { level: kit.level, max: 512 });
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#8d96a3';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = '#d9dee6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 44;
  ctx.font = `600 ${size}px sans-serif`;
  while (ctx.measureText(text.toUpperCase()).width > W - 48 && size > 16) ctx.font = `600 ${(size -= 2)}px sans-serif`;
  ctx.fillText(text.toUpperCase(), W / 2, H / 2 + 2);
  return canvas;
}

export function nameFace(kit, text, renderer) {
  const texture = sharpen(new THREE.CanvasTexture(paintName(kit, text)), { renderer, color: true });
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: 0.35, metalness: 0.4, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.35, name: 'ds2-nameplate' });
  return {
    material,
    dispose() {
      material.dispose();
      texture.dispose();
    },
  };
}

export function blinker() {
  // (a node material from the start, as the target’s face is: it blinks each frame)
  const material = new MeshStandardNodeMaterial({ color: 0x041008, roughness: 0.4, emissive: 0x6dff9a, emissiveIntensity: 0.4, name: 'ds2-blink' });
  return {
    material,
    // a short bright flash a second, a beep the eye can hear
    update(t) {
      material.emissiveIntensity = t % 1 < 0.14 ? 4 : 0.4;
    },
    dispose() {
      material.dispose();
    },
  };
}
