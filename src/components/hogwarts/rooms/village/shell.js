// The village’s insides, the parts they share (the design’s §4.9): a room’s
// shell as a house in Hogsmeade has it (boards or flags underfoot, plaster
// walls over a wainscot, a ceiling on heavy beams that sag a little, the
// front wall with its door and its small-paned windows full of the street’s
// light), hanging lamps that really light, and a window’s light by the hour.
// Built into a room’s kit (../kit.js), so a shop is a few dozen draws.
// The room’s frame: the floor’s middle at the origin, the front wall at
// +z (the street outside it), the walk coming in looking along −z.
//
//   shell(kit, { w, d, h, floor, wall, lower, ceiling, beams, sag, door, windows, back, scan, leaf }) →
//     { bounds, front, door: [x, z] (inside the front door), panes: [{ at, w, h }] (the windows’, and the door’s glass) }
//     leaf: the door shut in its opening (false: an open doorway, its room says what is past it)
//   streetLight(hour) → { colour, k } what comes in at the windows (a day’s pale grey, a night’s lamplit blue)
//   panes(kit, list, hour) → the glass, lit from outside, and its leading
//   lamp(kit, group, { at, drop, colour, k, tier, distance }) → the lamp’s light (or null on low)
//   signBoard({ text, w, h, bg, fg, renderer }) → { mesh, dispose() }: a painted name board

import * as THREE from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { canvasTexture } from '../../../../lib/three/canvasTexture';

const T = 0.3; // m, a wall’s thickness

export function shell(kit, { w, d, h, floor = 'board', wall = '#cdbf9f', lower = 'darkoak', ceiling = '#b9ab8d', beams = 4, sag = 0.04, door = { x: 0, w: 1.3, h: 2.25 }, windows = [], back = null, scan = 'concrete', leaf = true }) {
  const W = w / 2;
  const D = d / 2;
  const plaster = typeof wall === 'string' && wall.startsWith('#') ? kit.paint(wall, { scan, metres: 2.2, strength: 0.5, rough: 0.95 }) : wall;
  const roof = kit.paint(ceiling, { scan, metres: 2.2, strength: 0.45, rough: 0.95 });
  // underfoot, and the ceiling over it
  kit.box(floor, 0, -0.2, 0, w + 2 * T, 0.2, d + 2 * T);
  kit.box(roof, 0, h, 0, w + 2 * T, 0.2, d + 2 * T);
  // the side walls and the back
  for (const s of [-1, 1]) kit.box(plaster, s * (W + T / 2), 0, 0, T, h, d + 2 * T);
  kit.box(back ?? plaster, 0, 0, -D - T / 2, w, h, T);
  // the front: round the door and the windows, as solid wall between them
  const holes = [{ x: door.x, w: door.w, y: 0, h: door.h }, ...windows.map((p) => ({ x: p.x, w: p.w, y: p.y, h: p.h }))].sort((a, b) => a.x - b.x);
  let x0 = -W;
  for (const o of holes) {
    const a = o.x - o.w / 2;
    if (a > x0) kit.box(plaster, (x0 + a) / 2, 0, D + T / 2, a - x0, h, T);
    if (o.y > 0) kit.box(plaster, o.x, 0, D + T / 2, o.w, o.y, T);
    kit.box(plaster, o.x, o.y + o.h, D + T / 2, o.w, h - o.y - o.h, T);
    // the frame round each opening, in the wainscot’s wood
    kit.box(lower, o.x, o.y + o.h, D + 0.02, o.w + 0.24, 0.12, 0.12);
    for (const sx of [-1, 1]) kit.box(lower, o.x + sx * (o.w / 2 + 0.06), o.y, D + 0.02, 0.12, o.h, 0.12);
    if (o.y > 0) kit.box(lower, o.x, o.y - 0.08, D - 0.02, o.w + 0.3, 0.08, 0.22);
    x0 = o.x + o.w / 2;
  }
  if (W > x0) kit.box(plaster, (x0 + W) / 2, 0, D + T / 2, W - x0, h, T);
  // the door itself, shut: boarded below, glazed above with the street’s light in its panes
  if (leaf) {
    kit.box(lower, door.x, 0, D + T / 2, door.w - 0.02, door.h * 0.48, 0.06);
    kit.box(lower, door.x, door.h * 0.93, D + T / 2, door.w - 0.02, door.h * 0.07, 0.06);
    for (const sx of [-1, 1]) kit.box(lower, door.x + sx * (door.w / 2 - 0.07), door.h * 0.48, D + T / 2, 0.12, door.h * 0.45, 0.06);
    kit.box(lower, door.x, door.h * 0.7, D + T / 2, door.w - 0.2, 0.05, 0.06);
    kit.cyl('brass', door.x + door.w / 2 - 0.16, door.h * 0.44, D + T / 2 - 0.05, 0.03, 0.03, 0.06, { seg: 8, rx: Math.PI / 2 });
  }
  // the wainscot: boards to a rail at hip height, round the three plain walls
  const rail = 1.05;
  for (const s of [-1, 1]) {
    kit.box(lower, s * (W - 0.03), 0, 0, 0.06, rail, d - 0.02);
    kit.box(lower, s * (W - 0.06), rail, 0, 0.1, 0.07, d - 0.02);
  }
  kit.box(lower, 0, 0, -D + 0.03, w - 0.02, rail, 0.06);
  kit.box(lower, 0, rail, -D + 0.06, w - 0.02, 0.07, 0.1);
  // the skirting along the front, between the openings
  kit.box(lower, 0, 0, D - 0.03, w - 0.02, 0.14, 0.06);
  // the beams across, each sagging a little, on posts along the walls
  for (let i = 0; i < beams; i++) {
    const z = -D + ((i + 0.5) * d) / beams;
    const droop = sag * (((i * 7) % 3) - 1);
    kit.box('darkoak', 0, h - 0.28 - Math.abs(droop), z, w, 0.28, 0.26, { rz: droop * 0.15 });
    for (const s of [-1, 1]) kit.box('darkoak', s * (W - 0.12), 0, z, 0.22, h - 0.28, 0.22);
  }
  // a beam down the room’s length, the joists resting on it
  kit.box('darkoak', 0, h - 0.5, 0, 0.3, 0.22, d);
  const glazed = leaf ? [{ at: [door.x, door.h * 0.48, D + T / 2 + 0.01], w: door.w - 0.26, h: door.h * 0.45 }] : [];
  return {
    bounds: { x0: -W + 0.35, x1: W - 0.35, z0: -D + 0.35, z1: D - 0.35 },
    front: D,
    door: [door.x, D - 0.9],
    panes: [...windows.map((p) => ({ at: [p.x, p.y, D + T / 2], w: p.w, h: p.h })), ...glazed],
  };
}

// what the windows let in: a pale day, a lamplit blue evening, a dark night
export function streetLight(hour = 12) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 8 && h < 17) return { colour: '#dfe6ee', k: 1.25 };
  if ((h >= 17 && h < 20) || (h >= 6 && h < 8)) return { colour: '#8a9ac0', k: 0.8 };
  return { colour: '#2c3858', k: 0.55 };
}

// the glass, lit from outside, in small panes of lead
export function panes(kit, list, hour = 12, { grime = 0 } = {}) {
  const light = streetLight(hour);
  const tint = new THREE.Color(light.colour).lerp(new THREE.Color('#6a5a3a'), grime);
  const glass = kit.glow(`#${tint.getHexString()}`, light.k * (1 - grime * 0.55));
  const lead = kit.paint('#2a2622', { rough: 0.5, metal: 0.4 });
  for (const p of list) {
    kit.box(glass, p.at[0], p.at[1], p.at[2] + 0.04, p.w, p.h, 0.02);
    // the leading: a grid of small panes
    const cols = Math.max(2, Math.round(p.w / 0.32));
    const rows = Math.max(2, Math.round(p.h / 0.32));
    for (let i = 1; i < cols; i++) kit.box(lead, p.at[0] - p.w / 2 + (i * p.w) / cols, p.at[1], p.at[2] - 0.0, 0.025, p.h, 0.03);
    for (let j = 1; j < rows; j++) kit.box(lead, p.at[0], p.at[1] + (j * p.h) / rows, p.at[2] - 0.0, p.w, 0.025, 0.03);
  }
  return light;
}

// a lamp hung from the beams on a chain: an iron cage round a glowing globe,
// and on mid and up a real light in it (the room’s hemisphere stands in on low)
export function lamp(kit, group, { at, drop = 0.7, colour = '#ffc27a', k = 10, tier = 'high', distance = 9, decay = 1.6 } = {}) {
  const [x, top, z] = at;
  const y = top - drop;
  kit.box('iron', x, y + 0.32, z, 0.02, drop - 0.32, 0.02);
  kit.box('iron', x, y + 0.28, z, 0.26, 0.04, 0.26);
  kit.box('iron', x, y - 0.02, z, 0.2, 0.04, 0.2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box('iron', x + sx * 0.1, y, z + sz * 0.1, 0.02, 0.3, 0.02);
  kit.add(kit.glow(colour, 3.2), new THREE.SphereGeometry(0.075, 10, 8), { at: [x, y + 0.13, z] });
  if (tier === 'low') return null;
  const light = new THREE.PointLight(colour, k, distance, decay);
  light.position.set(x, y + 0.13, z);
  group.add(light);
  return light;
}

// a painted board with a name on it (over a counter, a bar, a door): the
// site’s own lettering on a canvas, gilt on the shop’s colour
export function signBoard({ text, w = 2.4, h = 0.5, bg = '#5e2f3a', fg = '#e8c56a', renderer = null, font = 'Cinzel, Georgia, serif' }) {
  const canvas = typeof document === 'undefined' ? null : Object.assign(document.createElement('canvas'), { width: 1024, height: Math.round((1024 * h) / w) });
  let tex = null;
  if (canvas) {
    const g = canvas.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = fg;
    g.lineWidth = canvas.height * 0.05;
    g.strokeRect(canvas.height * 0.08, canvas.height * 0.08, canvas.width - canvas.height * 0.16, canvas.height * 0.84);
    g.fillStyle = fg;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${Math.round(canvas.height * 0.52)}px ${font}`;
    g.fillText(text, canvas.width / 2, canvas.height * 0.54, canvas.width * 0.88);
    tex = canvasTexture(canvas, renderer, { wrap: false });
  }
  const mat = new MeshStandardNodeMaterial({ map: tex, color: tex ? 0xffffff : bg, roughness: 0.6, metalness: 0.1 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  return {
    mesh,
    dispose() {
      mesh.geometry.dispose();
      mat.dispose();
      tex?.dispose();
      mesh.removeFromParent();
    },
  };
}
