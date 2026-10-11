// Coruscant's places you go into, built in code (props/index.js has what a
// builder returns; inside.js has the cantina and the palace, the pattern):
// Dex's Diner (the counter and its stools, the booths, the grill with nuna
// on it, WA-7's run behind the counter), the Outlander Club (the long bar,
// the neon in magenta and cyan, the booths, the dejarik tables stood by the
// site), and the Jedi Temple (the great hall and its columns, the Archives'
// stacks of holobooks glowing blue, and the training room behind a door
// that slides up on the 'remotes' signal). Each is built high over the world,
// out of sight, lit by its zone's lamps. BOUNDS is each one's [hw, hd, h],
// for the site's zone and the tests.

import * as THREE from 'three';
import { box, cyl, part, ring, rod } from '../kitCore';

const { PI, sin, cos } = Math;
const lit = (c, k = 2.2) => new THREE.Color(c).multiplyScalar(k);

export const BOUNDS = {
  dexinside: [7.5, 5, 3.6],
  clubinside: [9.5, 6.5, 4.6],
  templeinside: [35, 10, 10], // (the hall's wings: the Archives west, the training room east)
};

// a rectangular room: its floor, four walls and ceiling, a doorway in the
// +z wall (w wide), everything as thin boxes (seen from within)
function room(parts, hw, hd, h, { wall, trim, floor, ceil, door = 2.2 }) {
  parts.push(part(box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, -0.2, 0], color: floor.color, to: floor.to }));
  parts.push(part(new THREE.BoxGeometry(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, h + 0.1, 0], color: ceil.color, to: ceil.to }));
  parts.push(part(box(hw * 2 + 0.4, h, 0.2), { at: [0, 0, -hd - 0.1], color: wall.color, to: wall.to }));
  for (const x of [-1, 1]) {
    parts.push(part(box(0.2, h, hd * 2 + 0.4), { at: [x * (hw + 0.1), 0, 0], color: wall.color, to: wall.to }));
    // the +z wall, either side of the door
    const seg = hw - door / 2;
    parts.push(part(box(seg, h, 0.2), { at: [x * (door / 2 + seg / 2), 0, hd + 0.1], color: wall.color, to: wall.to }));
  }
  parts.push(part(box(door, h - 2.4, 0.2), { at: [0, 2.4, hd + 0.1], color: wall.color, to: wall.to }));
  // a strip of trim at the wall's foot and a bright doorway out
  parts.push(part(box(hw * 2, 0.12, 0.05), { at: [0, 0, -hd - 0.02], color: trim, to: 'metal' }));
  parts.push(part(new THREE.PlaneGeometry(door - 0.1, 2.3).rotateY(PI), { at: [0, 1.2, hd + 0.02], color: '#fff0d0', to: 'glow' }));
}

export const PROPS = {
  // Dex's Diner, inside: a 15 × 10 m room, the counter along the back
  // wall with the grill behind it, stools before it, four booths down the
  // east wall and the door on the street at +z
  dexinside(k) {
    const [hw, hd, h] = BOUNDS.dexinside;
    const parts = [];
    room(parts, hw, hd, h, { wall: { color: '#c9b9a0', to: 'paint' }, trim: '#b05a3a', floor: { color: '#6a5a4c', to: 'tiles' }, ceil: { color: '#e0d8cc', to: 'paint' } });
    // the counter: a long box, a chrome edge, the grill behind under its hood
    parts.push(part(box(11, 1.05, 0.9), { at: [0, 0, -2.2], color: '#b04a38', to: 'paint' }));
    parts.push(part(box(11.2, 0.08, 1.1), { at: [0, 1.05, -2.2], color: '#d8d4cc', to: 'metal' }));
    parts.push(part(box(11, 1.0, 0.7), { at: [0, 0, -4.4], color: '#8a8a88', to: 'metal' }));
    parts.push(part(box(5, 0.12, 0.9), { at: [0, 1.0, -4.4], color: '#4a4846', to: 'metal' }));
    for (let i = 0; i < 5; i++) parts.push(part(new THREE.SphereGeometry(0.11, 8, 6), { at: [-1.6 + i * 0.8, 1.2, -4.4], color: '#8a5a2a', to: 'cloth' })); // (nuna on the grill)
    parts.push(part(box(5.4, 1.2, 1.2), { at: [0, 2.3, -4.4], color: '#9a9a98', to: 'metal' }));
    for (let i = 0; i < 9; i++) {
      const x = -4.8 + i * 1.2;
      parts.push(part(cyl(0.07, 0.07, 0.7, 8), { at: [x, 0, -1.2], color: '#8a8a88', to: 'metal' }), part(cyl(0.24, 0.22, 0.1, 14), { at: [x, 0.7, -1.2], color: '#b04a38', to: 'cloth' }));
    }
    // the booths: a table between two benches, a lamp over each
    const solids = [{ box: [0, -2.2, 5.5, 0.5] }, { box: [0, -4.4, 5.5, 0.4] }];
    for (let i = 0; i < 4; i++) {
      const z = -2.6 + i * 2.1;
      parts.push(part(box(1.3, 0.75, 0.5), { at: [6.4, 0, z - 0.75], color: '#b04a38', to: 'cloth' }), part(box(1.3, 0.75, 0.5), { at: [6.4, 0, z + 0.75], color: '#b04a38', to: 'cloth' }));
      parts.push(part(box(1.4, 0.08, 0.8), { at: [6.4, 0.78, z], color: '#d8d4cc', to: 'metal' }), part(cyl(0.08, 0.08, 0.78, 8), { at: [6.4, 0, z], color: '#8a8a88', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.14, 8, 6), { at: [6.4, 2.2, z], color: lit('#ffb070'), to: 'glow' }));
      solids.push({ box: [6.4, z, 0.7, 1.1] });
    }
    // the windows on the street, the sign's glow
    for (const x of [-4, -1.5, 1.5, 4]) parts.push(part(new THREE.PlaneGeometry(1.6, 1.2).rotateY(PI), { at: [x, 2.0, hd + 0.05], color: '#f2a46a', to: 'glow' }));
    return { object: k.build(parts, { name: 'dexinside' }), solids, floors: [{ x: 0, z: 0, hw, hd, yaw: 0, y: 0 }] };
  },

  // the Outlander Club, inside: a 19 × 13 m room, the long bar along the
  // west wall, neon tubes in magenta and cyan along the walls and over the
  // bar, booths down the east wall, the floor for the dejarik tables the
  // site stands in it
  clubinside(k) {
    const [hw, hd, h] = BOUNDS.clubinside;
    const parts = [];
    room(parts, hw, hd, h, { wall: { color: '#2a2630', to: 'paint' }, trim: '#ff6ad0', floor: { color: '#1e1a24', to: 'tiles' }, ceil: { color: '#1a1620', to: 'paint' } });
    parts.push(part(box(0.9, 1.1, 10), { at: [-8.2, 0, 0], color: '#3a3440', to: 'metal' }));
    parts.push(part(box(1.1, 0.08, 10.2), { at: [-8.2, 1.1, 0], color: '#8a8aa0', to: 'metal' }));
    parts.push(part(box(0.3, 2.8, 10), { at: [-9.2, 1.0, 0], color: '#1a1620', to: 'metal' }));
    const bottle = ['#2a7a4a', '#b0661e', '#3a5ab8', '#b03a3a', '#c8b84a', '#8a3ab0'];
    for (let i = 0; i < 24; i++) parts.push(part(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 6).translate(0, 0.13, 0), { at: [-9.0, 1.6 + (i % 3) * 0.6, -4.5 + (i % 8) * 1.3], color: lit(bottle[i % 6], 1.4), to: 'glow' }));
    for (let i = 0; i < 8; i++) parts.push(part(cyl(0.07, 0.07, 0.7, 8), { at: [-7.2, 0, -4.2 + i * 1.2], color: '#3a3440', to: 'metal' }), part(cyl(0.24, 0.22, 0.1, 14), { at: [-7.2, 0.7, -4.2 + i * 1.2], color: '#6a2a60', to: 'cloth' }));
    // the neon: tubes along the walls at two heights, the two colours
    for (const [y, c] of [[2.6, '#ff6ad0'], [3.4, '#6ad0ff']]) {
      parts.push(part(box(hw * 2 - 0.4, 0.06, 0.06), { at: [0, y, -hd + 0.08], color: lit(c, 3), to: 'glow' }));
      for (const x of [-1, 1]) parts.push(part(box(0.06, 0.06, hd * 2 - 0.4), { at: [x * (hw - 0.08), y, 0], color: lit(c, 3), to: 'glow' }));
    }
    parts.push(part(ring(1.2, 0.05, 40), { at: [-8.2, 3.9, 0], color: lit('#ff6ad0', 3), to: 'glow' }));
    // the booths along the east wall
    const solids = [{ box: [-8.2, 0, 0.6, 5.2] }];
    for (let i = 0; i < 4; i++) {
      const z = -4.5 + i * 3;
      parts.push(part(box(1.6, 0.7, 0.5), { at: [8.2, 0, z - 0.9], color: '#6a2a60', to: 'cloth' }), part(box(1.6, 0.7, 0.5), { at: [8.2, 0, z + 0.9], color: '#6a2a60', to: 'cloth' }));
      parts.push(part(cyl(0.5, 0.5, 0.06, 20), { at: [8.2, 0.75, z], color: '#3a3440', to: 'metal' }), part(cyl(0.08, 0.1, 0.75, 8), { at: [8.2, 0, z], color: '#3a3440', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.12, 8, 6), { at: [8.2, 2.1, z], color: lit(i % 2 ? '#ff6ad0' : '#6ad0ff', 2.5), to: 'glow' }));
      solids.push({ box: [8.2, z, 0.9, 1.3] });
    }
    // a raised stage at the back, a screen of light behind it
    parts.push(part(box(8, 0.4, 2.6), { at: [1, 0, -5.0], color: '#3a3440', to: 'metal' }));
    parts.push(part(new THREE.PlaneGeometry(7.6, 2.4), { at: [1, 1.8, -6.3], color: lit('#5a2a9a', 1.6), to: 'glow' }));
    solids.push({ box: [1, -5.0, 4, 1.3], top: 0.4 });
    return { object: k.build(parts, { name: 'clubinside' }), solids, floors: [{ x: 0, z: 0, hw, hd, yaw: 0, y: 0 }, { x: 1, z: -5, hw: 4, hd: 1.3, yaw: 0, y: 0.4 }] };
  },

  // the Jedi Temple, inside: the great hall (42 × 20 m, ten columns, the
  // four statues of the Masters at the far end), the Archives through the
  // west wall (stacks of holobooks glowing blue, in rows), and the training
  // room through the east wall, behind a door that slides up on 'remotes'
  templeinside(k) {
    const [, hd, h] = BOUNDS.templeinside;
    const hw = 21; // (the hall itself; the wings go out past it)
    const parts = [];
    const STONE = '#d8ccb4';
    room(parts, hw, hd, h, { wall: { color: STONE, to: 'stone' }, trim: '#8a7a5a', floor: { color: '#b8ac94', to: 'tiles' }, ceil: { color: '#c8bca4', to: 'stone' }, door: 3.2 });
    const solids = [];
    const floors = [{ x: 0, z: 0, hw, hd, yaw: 0, y: 0 }];
    // the hall's columns, two rows, with a band of light up each
    for (let i = 0; i < 5; i++) {
      const z = -7 + i * 3.5;
      for (const x of [-5, 5]) {
        parts.push(part(cyl(0.7, 0.6, h, 16), { at: [x, 0, z], color: STONE, to: 'stone' }));
        parts.push(part(cyl(0.9, 0.9, 0.5, 16), { at: [x, 0, z], color: '#c0b498', to: 'stone' }));
        parts.push(part(box(0.1, h - 2, 0.4), { at: [x, 1, z + 0.72], color: lit('#cfd8ff', 1.8), to: 'glow' }));
        solids.push({ circle: [x, z, 0.8] });
      }
    }
    // the four statues at the far end: robed figures on plinths
    for (let i = 0; i < 4; i++) {
      const x = -6 + i * 4;
      parts.push(part(box(1.6, 1.2, 1.6), { at: [x, 0, -8.4], color: '#b8ac94', to: 'stone' }));
      parts.push(part(new THREE.ConeGeometry(0.6, 3.2, 10, 1, true).translate(0, 1.6, 0), { at: [x, 1.2, -8.4], color: '#cfc4ac', to: 'stone' }));
      parts.push(part(new THREE.SphereGeometry(0.32, 10, 8), { at: [x, 4.9, -8.4], color: '#cfc4ac', to: 'stone' }));
      solids.push({ box: [x, -8.4, 0.9, 0.9] });
    }
    // the Archives: through the west wall, three rows of stacks, blue
    const AX = -hw - 6;
    parts.push(part(box(12, 0.2, 14), { at: [AX, -0.2, -2], color: '#8a7e68', to: 'tiles' }));
    parts.push(part(new THREE.BoxGeometry(12, 0.2, 14), { at: [AX, 6.1, -2], color: '#9a8e78', to: 'stone' }));
    parts.push(part(box(0.2, 6, 14), { at: [AX - 6, 0, -2], color: STONE, to: 'stone' }));
    for (const z of [-9, 5]) parts.push(part(box(12, 6, 0.2), { at: [AX, 0, z], color: STONE, to: 'stone' }));
    for (const z of [-7, -2, 3]) {
      parts.push(part(box(10, 4.2, 0.6), { at: [AX, 0, z], color: '#2a3040', to: 'metal' }));
      for (let y = 0.6; y < 4; y += 0.8) parts.push(part(box(9.8, 0.08, 0.7), { at: [AX, y, z], color: lit('#5a9aff', 2.4), to: 'glow' }));
      solids.push({ box: [AX, z, 5, 0.4] });
    }
    floors.push({ x: AX, z: -2, hw: 6, hd: 7, yaw: 0, y: 0 });
    // the training room: through the east wall, square, a dais at its
    // middle, the door between slides up (the hall's wall is left open where
    // the door is: the door itself fills it)
    const TX = hw + 7;
    parts.push(part(box(14, 0.2, 14), { at: [TX, -0.2, 0], color: '#a89c84', to: 'tiles' }));
    parts.push(part(new THREE.BoxGeometry(14, 0.2, 14), { at: [TX, 7.1, 0], color: '#c8bca4', to: 'stone' }));
    parts.push(part(box(0.2, 7, 14), { at: [TX + 7, 0, 0], color: STONE, to: 'stone' }));
    for (const z of [-7, 7]) parts.push(part(box(14, 7, 0.2), { at: [TX, 0, z], color: STONE, to: 'stone' }));
    parts.push(part(cyl(2.2, 2.4, 0.4, 24), { at: [TX, 0, 0], color: '#c0b498', to: 'stone' }));
    parts.push(part(ring(2.3, 0.06, 32), { at: [TX, 0.42, 0], color: lit('#cfd8ff', 2), to: 'glow' }));
    floors.push({ x: TX, z: 0, hw: 7, hd: 7, yaw: 0, y: 0 });
    const object = k.build(parts, { name: 'templeinside' });
    // the two doorways in the hall's side walls (the wall built whole: the
    // doorways are cut as solids that stop at the door, and the door itself)
    const slab = k.build([part(new THREE.BoxGeometry(0.3, 4, 3.2), { color: '#6a6a72', to: 'metal' }), part(box(0.05, 3.6, 0.1), { at: [-0.18, -1.8, 0], color: lit('#cfd8ff', 2), to: 'glow' })], { name: 'templedoor' });
    slab.position.set(hw + 0.1, 2, 0);
    object.add(slab);
    solids.push({ box: [hw + 0.1, 0, 0.3, 1.6], tag: 'templedoor' });
    let open = 0;
    let want = 0;
    return {
      object,
      solids,
      floors,
      doorOpen: () => open,
      signal(name, on) {
        if (name === 'remotes') want = on ? 1 : 0;
      },
      update(t, dt = 0.016) {
        if (open === want) return;
        open = want > open ? Math.min(want, open + dt * 0.8) : Math.max(want, open - dt * 0.8);
        slab.position.y = 2 + open * 4.2;
      },
    };
  },

  // WA-7, Dex's waitress droid: a wheel, a slim torso, a head with a cap,
  // rolling (its update bobs it along)
  wa7(k) {
    const parts = [
      part(cyl(0.22, 0.22, 0.08, 16).rotateZ(PI / 2), { at: [0, 0.22, 0], color: '#3a3a3a', to: 'dark' }),
      part(cyl(0.12, 0.2, 0.9, 10), { at: [0, 0.4, 0], color: '#e8e4dc', to: 'paint' }),
      part(new THREE.SphereGeometry(0.2, 12, 10), { at: [0, 1.45, 0], scale: [1, 1.1, 1], color: '#e8e4dc', to: 'paint' }),
      part(cyl(0.22, 0.26, 0.06, 14), { at: [0, 1.58, 0], color: '#c84a3a', to: 'paint' }),
      part(box(0.18, 0.05, 0.04), { at: [0, 1.46, 0.18], color: '#4ac8ff', to: 'glow' }),
      rod([-0.12, 1.2, 0], [-0.45, 1.0, 0.25], 0.03, 0.03, { color: '#d8d4cc', to: 'metal' }),
      rod([0.12, 1.2, 0], [0.45, 1.0, 0.25], 0.03, 0.03, { color: '#d8d4cc', to: 'metal' }),
      part(cyl(0.2, 0.2, 0.03, 14), { at: [0.45, 1.0, 0.25], color: '#d8d4cc', to: 'metal' }),
    ];
    const body = k.build(parts, { name: 'wa7' });
    const object = new THREE.Group();
    object.add(body);
    return {
      object,
      update(t, dt, move = 0) {
        body.rotation.z = sin(t * 9) * 0.04 * move;
        body.position.y = Math.abs(cos(t * 9)) * 0.02 * move;
      },
    };
  },
};
