// Cloud City, inside, built in code (props/index.js has what a builder
// returns; insideCore.js is Coruscant's, insideForest.js Yavin's, the same
// way): the dining room (the white corridor in, the rotunda with its tall
// windows and the long table), the carbon-freezing chamber (the pit, red,
// its platform lowered on the 'freeze' signal and raised when it's off),
// the reactor shaft (the control room, the ring gantry round the well and
// the one out over it, nothing under it) and the corridor out to the
// platforms (two doors, opened by the 'lobot1' and 'lobot2' signals).
// BOUNDS is each one's [hw, hd, h].

import * as THREE from 'three';
import { box, cyl, part, rod } from '../kitCore';

const { PI, sin, cos } = Math;
const lit = (c, k = 2.2) => new THREE.Color(c).multiplyScalar(k);
const WHITE = '#d9d1c4';
const CREAM = '#bfb5a6';
const DARK = '#2c2828';
const STEEL = '#4a4e58';

export const BOUNDS = {
  dininginside: [14, 14, 7],
  carboninside: [17, 17, 12],
  reactorinside: [20, 24, 30],
  corridorinside: [6, 30, 4.5],
};

// a straight white corridor along z, hw wide, from z0 to z1: its floor,
// walls, an arched ceiling, the lit strips down each wall at head height
function corridor(parts, solids, floors, hw, z0, z1, h = 4.2, { color = WHITE, floor = CREAM } = {}) {
  const len = z1 - z0;
  const zc = (z0 + z1) / 2;
  parts.push(part(box(hw * 2 + 0.4, 0.2, len), { at: [0, -0.2, zc], color: floor, to: 'tiles' }));
  for (const x of [-1, 1]) {
    parts.push(part(box(0.2, h - 1, len), { at: [x * (hw + 0.1), 0, zc], color, to: 'cloth' }));
    parts.push(part(new THREE.BoxGeometry(len, 0.08, 0.06), { at: [x * (hw + 0.02), 2.6, zc], rot: [0, PI / 2, 0], color: lit('#ffe8c8', 1.6), to: 'glow' }));
    solids.push({ box: [x * (hw + 0.1), zc, 0.1, len / 2] });
  }
  // the arch: a half cylinder along z, seen from within
  parts.push(part(new THREE.CylinderGeometry(hw + 0.1, hw + 0.1, len, 20, 1, true, -PI / 2, PI).rotateX(PI / 2).rotateZ(PI / 2), { at: [0, h - 1, zc], color, to: 'cloth' }));
  floors.push({ x: 0, z: zc, hw, hd: len / 2, yaw: 0, y: 0 });
}

// a round room: its floor, its wall round (open where the way in is: a
// gap of `open` radians about +z), its solids round it
function rotunda(parts, solids, floors, r, h, { open = 0.4, color = WHITE, floor = CREAM, z = 0 } = {}) {
  parts.push(part(cyl(r, r, 0.2, 48), { at: [0, -0.2, z], color: floor, to: 'tiles' }));
  const a0 = open / 2;
  const sweep = PI * 2 - open;
  parts.push(part(new THREE.CylinderGeometry(r, r, h, 48, 1, true, a0, sweep), { at: [0, h / 2, z], color, to: 'cloth' }));
  const n = Math.round(sweep * r * 0.35);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (i / n) * sweep;
    solids.push({ box: [sin(a) * r, z + cos(a) * r, (sweep * r) / n / 2 + 0.2, 0.2, a] });
  }
  floors.push({ x: 0, z, r, y: 0 });
}

// a sliding door across a corridor at z: the slab (its own mesh, so it
// moves) and the solid that goes with it (tagged: the quest that opens it
// takes the solid away, `solid: 'door1', off: true`); returns the slab
function slidingDoor(k, object, solids, hw, z, h, tag) {
  const slab = k.build([part(new THREE.BoxGeometry(hw * 2, h - 0.4, 0.3), { color: '#b8b0a6', to: 'metal' }), part(new THREE.BoxGeometry(hw * 2 - 0.6, 0.08, 0.06), { at: [0, 0, 0.16], color: lit('#ff8a5a', 1.8), to: 'glow' }), part(new THREE.BoxGeometry(0.08, h - 1.2, 0.06), { at: [0, 0, 0.16], color: '#6a6660', to: 'metal' })], { name: tag });
  slab.position.set(0, (h - 0.4) / 2, z);
  object.add(slab);
  solids.push({ box: [0, z, hw, 0.2], tag });
  return slab;
}

const ease = (open, want, dt, rate) => (want > open ? Math.min(want, open + dt * rate) : Math.max(want, open - dt * rate));

export const PROPS = {
  // the dining room: the curved white corridor in from +z, the rotunda, its
  // nine tall windows glowing with the sunset outside, the long table down
  // its middle (whoever waits at its head is the zone's life)
  dininginside(k) {
    const parts = [];
    const solids = [];
    const floors = [];
    corridor(parts, solids, floors, 2.6, 5, 14, 4.5);
    rotunda(parts, solids, floors, 11, 7, { open: 0.5, z: -3 });
    // the dome over it
    parts.push(part(new THREE.SphereGeometry(11.1, 40, 12, 0, PI * 2, 0, PI * 0.5).rotateX(PI), { at: [0, 7, -3], scale: [1, 0.4, 1], color: '#e4ddd2', to: 'cloth' }));
    // the ceiling of the corridor's end, over the doorway
    for (let i = 0; i < 9; i++) {
      const a = PI * 0.36 + (i / 8) * PI * 1.28;
      parts.push(part(new THREE.BoxGeometry(1.5, 5.6, 0.1), { at: [sin(a) * 10.85, 3.6, -3 + cos(a) * 10.85], rot: [0, a, 0], color: lit('#ffc89a', 1.4), to: 'glow' }));
      parts.push(part(new THREE.BoxGeometry(1.8, 0.2, 0.2), { at: [sin(a) * 10.8, 6.5, -3 + cos(a) * 10.8], rot: [0, a, 0], color: '#c8c0b4', to: 'metal' }));
    }
    // the table, the chairs down each side, the place settings
    parts.push(part(box(1.8, 0.08, 9), { at: [0, 0.82, -3], color: '#d8d2c8', to: 'paint' }));
    for (const z of [-6, 0]) parts.push(part(cyl(0.3, 0.4, 0.82, 10), { at: [0, 0, z], color: '#a8a094', to: 'metal' }));
    for (let z = -6.5; z <= 0.5; z += 1.75)
      for (const s of [-1, 1]) {
        parts.push(part(box(0.55, 0.5, 0.55), { at: [s * 1.35, 0, z], color: '#3a3438', to: 'cloth' }));
        parts.push(part(box(0.55, 0.7, 0.1), { at: [s * 1.62, 0.5, z], color: '#3a3438', to: 'cloth' }));
        parts.push(part(cyl(0.16, 0.16, 0.02, 12), { at: [s * 0.55, 0.9, z], color: '#f0ece4', to: 'paint' }));
      }
    // the head of the table: the tall chair, turned to the door
    parts.push(part(box(0.8, 0.5, 0.8), { at: [0, 0, -8.4], color: '#1a1618', to: 'cloth' }));
    parts.push(part(box(0.8, 1.6, 0.12), { at: [0, 0.5, -8.8], color: '#1a1618', to: 'cloth' }));
    solids.push({ box: [0, -3, 1.0, 4.6, 0], top: 0.9 }, { box: [0, -8.5, 0.5, 0.5] });
    // the sideboard and the lamps in the corridor
    parts.push(part(box(3, 1, 0.6), { at: [-8.5, 0, -8], rot: [0, 0.6, 0], color: '#cdc4b8', to: 'paint' }));
    solids.push({ box: [-8.5, -8, 1.5, 0.4, 0.6], top: 1 });
    for (const z of [7, 11]) for (const x of [-1, 1]) parts.push(part(new THREE.BoxGeometry(0.1, 0.5, 0.5), { at: [x * 2.55, 3.1, z], color: lit('#ffe0a0', 2), to: 'glow' }));
    // the doorway from the corridor (the wall of the rotunda left open
    // there), its jambs, and the bright way out at the corridor's end
    for (const x of [-1, 1]) parts.push(part(box(0.3, 4.5, 0.3), { at: [x * 2.75, 0, 5.3], color: '#c8c0b4', to: 'metal' }));
    parts.push(part(new THREE.PlaneGeometry(5, 4).rotateY(PI), { at: [0, 2, 13.95], color: '#fff0d0', to: 'glow' }));
    return { object: k.build(parts, { name: 'dininginside' }), solids, floors };
  },

  // the carbon-freezing chamber: a round dark room, the pit in its middle
  // with the platform in it, the claws over it, the pipes and lamps up the
  // walls, all of it red; the platform (tagged freezeplatform, its floor
  // one that `moves`) goes down 2.4 m over three seconds on 'freeze'
  carboninside(k) {
    const parts = [];
    const solids = [];
    const floors = [];
    const R = 16;
    const PIT = 6;
    const object = new THREE.Group();
    // the room: its wall round (open at +z, the way in), its ceiling of
    // pipes, the floor in four pieces round the square the pit's cut from
    rotunda(parts, solids, [], R, 11, { open: 0.45, color: DARK, floor: '#2a2626' });
    parts.pop(); // (the round floor: the pit's cut through it, below)
    parts.push(part(new THREE.CylinderGeometry(R + 0.2, R + 0.2, 11, 48, 1, true, 0.225, PI * 2 - 0.45), { at: [0, 5.5, 0], color: '#e4dacd', to: 'adobe' }));
    parts.push(part(new THREE.RingGeometry(PIT, R, 48).rotateX(-PI / 2), { at: [0, 0, 0], color: '#2a2626', to: 'metal' }));
    parts.push(part(new THREE.CircleGeometry(R, 48).rotateX(PI / 2), { at: [0, 11, 0], color: '#1a1818', to: 'metal' }));
    floors.push({ x: 0, z: 11, hw: 17, hd: 5, yaw: 0, y: 0 }, { x: 0, z: -11, hw: 17, hd: 5, yaw: 0, y: 0 }, { x: 11, z: 0, hw: 5, hd: 6, yaw: 0, y: 0 }, { x: -11, z: 0, hw: 5, hd: 6, yaw: 0, y: 0 });
    // the pit: its wall, its floor far down, the glow round its rim
    parts.push(part(new THREE.CylinderGeometry(PIT, PIT, 2.6, 32, 1, true), { at: [0, -1.3, 0], color: '#1e1a1a', to: 'metal' }));
    parts.push(part(new THREE.CircleGeometry(PIT, 32).rotateX(-PI / 2), { at: [0, -2.6, 0], color: '#0a0808', to: 'dark' }));
    parts.push(part(new THREE.TorusGeometry(PIT + 0.05, 0.1, 6, 40).rotateX(PI / 2), { at: [0, 0.05, 0], color: lit('#ff3a1a', 2), to: 'glow' }));
    floors.push({ x: 0, z: 0, hw: PIT, hd: PIT, yaw: 0, y: -2.6 });
    // the way back up out of the pit: steps along its far wall
    for (let i = 0; i < 5; i++) {
      const y = -2.1 + i * 0.5;
      parts.push(part(box(0.7, 0.5, 0.7), { at: [-2.2 + i * 0.7, y - 0.5, -5.5], color: '#3a3434', to: 'metal' }));
      floors.push({ x: -2.2 + i * 0.7, z: -5.5, hw: 0.35, hd: 0.35, yaw: 0, y });
    }
    // the claws, arching over the pit
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + PI / 4;
      const base = [sin(a) * 7.2, 0, cos(a) * 7.2];
      const top = [sin(a) * 4.6, 7.4, cos(a) * 4.6];
      const tip = [sin(a) * 1.8, 5.2, cos(a) * 1.8];
      parts.push(rod(base, top, 0.4, 0.3, { color: '#4a4242', to: 'metal' }));
      parts.push(rod(top, tip, 0.28, 0.18, { color: '#4a4242', to: 'metal' }));
      parts.push(part(new THREE.SphereGeometry(0.45, 8, 6), { at: top, color: '#3a3434', to: 'metal' }));
      solids.push({ circle: [base[0], base[2], 0.5] });
    }
    // the pipes up the walls, the lamps between, the control desk by the way in
    for (let i = 0; i < 14; i++) {
      const a = 0.4 + (i / 13) * (PI * 2 - 0.8);
      parts.push(part(new THREE.CylinderGeometry(0.3, 0.3, 11, 8), { at: [sin(a) * (R - 0.4), 5.5, cos(a) * (R - 0.4)], color: '#3e3838', to: 'metal' }));
      if (i % 2) parts.push(part(new THREE.BoxGeometry(1.4, 0.4, 0.1), { at: [sin(a) * (R - 0.5), 8.5, cos(a) * (R - 0.5)], rot: [0, a, 0], color: lit('#ff5a2a', 2.2), to: 'glow' }));
    }
    parts.push(part(box(2.4, 1.1, 0.8), { at: [9, 0, 9], rot: [0, -PI / 4, 0], color: '#3a3634', to: 'metal' }));
    parts.push(part(new THREE.BoxGeometry(2.0, 0.5, 0.05), { at: [8.7, 1.2, 8.7], rot: [-0.5, -PI / 4, 0], color: lit('#ff8a4a', 1.8), to: 'glow' }));
    solids.push({ box: [9, 9, 1.2, 0.4, -PI / 4], top: 1.1 });
    // the way in, bright
    parts.push(part(new THREE.PlaneGeometry(6, 5).rotateY(PI), { at: [0, 2.5, R - 0.1], color: '#ffd0b0', to: 'glow' }));
    object.add(k.build(parts, { name: 'carboninside' }));
    // the platform: its own mesh, the hole in its middle with the glow round it
    const plat = k.build([part(cyl(5.2, 5.2, 0.4, 32), { color: '#3a3434', to: 'metal' }), part(new THREE.CircleGeometry(2.2, 24).rotateX(-PI / 2), { at: [0, 0.42, 0], color: '#050404', to: 'dark' }), part(new THREE.TorusGeometry(2.25, 0.12, 6, 32).rotateX(PI / 2), { at: [0, 0.45, 0], color: lit('#ff6a2a', 2.6), to: 'glow' }), part(new THREE.TorusGeometry(5.1, 0.1, 6, 40).rotateX(PI / 2), { at: [0, 0.45, 0], color: lit('#ff3a1a', 2), to: 'glow' })], { name: 'freezeplatform' });
    object.add(plat);
    const platFloor = { x: 0, z: 0, r: 5.2, y: 0.4, moves: true, tag: 'freezeplatform' };
    floors.push(platFloor);
    solids.push({ circle: [0, 0, 2.3] });
    // the steam, rising out of the hole
    const n = 12;
    const steamMat = k.own(new THREE.MeshBasicMaterial({ color: '#f4e4d8', transparent: true, opacity: 0.16, depthWrite: false }));
    const steamGeo = k.own(new THREE.IcosahedronGeometry(1, 1));
    const steam = new THREE.InstancedMesh(steamGeo, steamMat, n);
    steam.frustumCulled = false;
    object.add(steam);
    const m = new THREE.Matrix4();
    let open = 0;
    let want = 0;
    return {
      object,
      solids,
      floors,
      lowered: () => open,
      signal(name, on) {
        if (name === 'freeze') want = on ? 1 : 0;
      },
      update(t, dt = 0.016) {
        for (let i = 0; i < n; i++) {
          const p = (t * 0.2 + i / n) % 1;
          const s = (0.8 + p * 3.2) * (1 + open * 0.8);
          m.makeScale(s, s * 0.8, s).setPosition(sin(i * 2.1 + t * 0.3) * p * 2, 0.6 - open * 2.4 + p * 10, cos(i * 1.7) * p * 2);
          steam.setMatrixAt(i, m);
        }
        steam.instanceMatrix.needsUpdate = true;
        if (open === want) return;
        open = ease(open, want, dt, 1 / 3);
        plat.position.y = -2.4 * open;
        platFloor.y = 0.4 - 2.4 * open;
      },
    };
  },

  // the reactor shaft: the control room at +z (its window on the well),
  // the ring gantry round the well's wall and the one out over the drop
  // from it, lights down the shaft, and nothing under any of it
  reactorinside(k) {
    const parts = [];
    const solids = [];
    const floors = [];
    const R = 16;
    const ZC = -6; // (the well's middle)
    // the control room
    const CZ = 17;
    const [hw, hd, h] = [6, 5, 4];
    parts.push(part(box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, -0.2, CZ], color: '#3a3e48', to: 'tiles' }));
    parts.push(part(new THREE.BoxGeometry(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, h + 0.1, CZ], color: '#2a2e36', to: 'metal' }));
    parts.push(part(box(hw * 2 + 0.4, h, 0.2), { at: [0, 0, CZ + hd + 0.1], color: STEEL, to: 'metal' }));
    for (const x of [-1, 1]) {
      parts.push(part(box(0.2, h, hd * 2 + 0.4), { at: [x * (hw + 0.1), 0, CZ], color: STEEL, to: 'metal' }));
      solids.push({ box: [x * (hw + 0.1), CZ, 0.1, hd + 0.2] });
      // the -z wall either side of the door onto the gantry, the window over
      parts.push(part(box(hw - 1.4, 2.2, 0.2), { at: [x * (hw / 2 + 0.7), 0, CZ - hd - 0.1], color: STEEL, to: 'metal' }));
      parts.push(part(new THREE.BoxGeometry(hw - 1.6, 1.6, 0.06), { at: [x * (hw / 2 + 0.7), 3, CZ - hd - 0.05], color: lit('#a8c8ff', 1.2), to: 'glow' }));
      parts.push(part(box(hw - 1.4, 0.4, 0.2), { at: [x * (hw / 2 + 0.7), 3.8, CZ - hd - 0.1], color: STEEL, to: 'metal' }));
      solids.push({ box: [x * (hw / 2 + 0.7), CZ - hd - 0.1, hw / 2 - 0.7, 0.1] });
    }
    solids.push({ box: [0, CZ + hd + 0.1, hw + 0.2, 0.1] });
    // the consoles down its walls, their screens
    for (const x of [-1, 1]) {
      parts.push(part(box(0.8, 1.0, 6), { at: [x * (hw - 0.5), 0, CZ], color: '#3a3e48', to: 'metal' }));
      parts.push(part(new THREE.BoxGeometry(0.05, 0.6, 5.6), { at: [x * (hw - 0.92), 1.3, CZ], color: lit(x > 0 ? '#ff8a5a' : '#5ad0ff', 1.6), to: 'glow' }));
      solids.push({ box: [x * (hw - 0.5), CZ, 0.4, 3], top: 1 });
    }
    floors.push({ x: 0, z: CZ, hw, hd, yaw: 0, y: 0, tag: 'control' });
    parts.push(part(new THREE.PlaneGeometry(2.4, 3).rotateY(PI), { at: [0, 1.5, CZ + hd + 0.05], color: '#ffd0b0', to: 'glow' }));
    // the well: its wall, open where the room's door is, going down and up
    parts.push(part(new THREE.CylinderGeometry(R, R, 90, 48, 1, true, 0.12, PI * 2 - 0.24), { at: [0, -30, ZC], color: '#3a3e48', to: 'cloth' }));
    parts.push(part(new THREE.CylinderGeometry(R + 0.4, R + 0.4, 90, 48, 1, true, 0.12, PI * 2 - 0.24), { at: [0, -30, ZC], color: '#cfc6ba', to: 'adobe' }));
    parts.push(part(new THREE.CircleGeometry(R, 48).rotateX(-PI / 2), { at: [0, -75, ZC], color: lit('#ffb070', 1.4), to: 'glow' }));
    parts.push(part(new THREE.CircleGeometry(R, 48).rotateX(PI / 2), { at: [0, 15, ZC], color: '#1a1c22', to: 'metal' }));
    for (let y = 9; y > -72; y -= 9) parts.push(part(new THREE.TorusGeometry(R - 0.4, 0.2, 4, 48).rotateX(PI / 2), { at: [0, y, ZC], color: lit(y > -36 ? '#a8c8ff' : '#ffb27a', 1.8), to: 'glow' }));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2 + PI / 8;
      parts.push(part(new THREE.BoxGeometry(1.2, 90, 1.2), { at: [sin(a) * (R - 0.8), -30, ZC + cos(a) * (R - 0.8)], color: '#2a2e36', to: 'metal' }));
    }
    // the ring gantry round the wall (open at +z where the room is), its
    // rail on the inside only where the lights are: mostly none
    const RG = R - 1.4;
    const segs = 20;
    for (let i = 1; i < segs; i++) {
      const a = (i / segs) * PI * 2;
      const len = (PI * 2 * RG) / segs;
      parts.push(part(box(len + 0.2, 0.3, 1.6), { at: [sin(a) * RG, -0.3, ZC + cos(a) * RG], rot: [0, a, 0], color: '#5a5e68', to: 'metal' }));
      floors.push({ x: sin(a) * RG, z: ZC + cos(a) * RG, hw: len / 2 + 0.1, hd: 0.8, yaw: a, y: 0, tag: 'ring' });
      solids.push({ box: [sin(a) * (R - 0.4), ZC + cos(a) * (R - 0.4), len / 2 + 0.2, 0.2, a] });
    }
    // the gantry from the door out over the drop (Vader at its end), its
    // one rail and the lit edge
    const GZ0 = CZ - hd; // (the room's door)
    const GZ1 = ZC - 4;
    const glen = GZ0 - GZ1;
    parts.push(part(box(1.8, 0.4, glen), { at: [0, -0.4, (GZ0 + GZ1) / 2], color: '#5a5e68', to: 'metal' }));
    parts.push(part(new THREE.BoxGeometry(0.06, 0.06, glen), { at: [0.9, 1.0, (GZ0 + GZ1) / 2], color: '#7a7e88', to: 'metal' }));
    for (let i = 0; i < 6; i++) parts.push(rod([0.9, 0, GZ1 + 1 + i * 2.6], [0.9, 1.0, GZ1 + 1 + i * 2.6], 0.04, 0.04, { color: '#7a7e88', to: 'metal' }));
    parts.push(part(box(1.6, 1.0, 1.0), { at: [0, 0, GZ1 + 0.5], color: '#4a4e58', to: 'metal' }));
    parts.push(part(new THREE.BoxGeometry(0.5, 0.2, 0.05), { at: [0, 0.7, GZ1 - 0.02], color: lit('#ff5a3a', 2.4), to: 'glow' }));
    floors.push({ x: 0, z: (GZ0 + GZ1) / 2, hw: 0.9, hd: glen / 2, yaw: 0, y: 0, tag: 'gantry' });
    solids.push({ box: [0.95, (GZ0 + GZ1) / 2, 0.06, glen / 2] }, { box: [0, GZ1 + 0.5, 0.8, 0.5], top: 1 });
    const object = k.build(parts, { name: 'reactorinside' });
    return { object, solids, floors };
  },

  // the corridor out: the long white way to the platforms, two doors
  // across it (slid up on 'lobot1' and 'lobot2'), alcoves with lamps
  corridorinside(k) {
    const parts = [];
    const solids = [];
    const floors = [];
    const object = new THREE.Group();
    corridor(parts, solids, floors, 3, -29, 29, 4.2);
    // the ends: the way in behind you, bright, and the way out at the far end
    for (const z of [-29, 29]) {
      parts.push(part(box(6.4, 4.2, 0.2), { at: [0, 0, z], color: WHITE, to: 'cloth' }));
      parts.push(part(new THREE.PlaneGeometry(2.6, 3.4).rotateY(z > 0 ? PI : 0), { at: [0, 1.7, z - Math.sign(z) * 0.12], color: '#fff0d0', to: 'glow' }));
    }
    // the alcoves: a recess either side, a lamp, a bench
    for (const z of [-20, -2, 16]) {
      for (const x of [-1, 1]) {
        parts.push(part(box(1.6, 3.6, 2.4), { at: [x * 3.9, 0, z], color: '#e4ddd2', to: 'cloth' }));
        parts.push(part(box(0.5, 0.45, 2), { at: [x * 3.4, 0, z], color: '#cdc4b8', to: 'paint' }));
        parts.push(part(new THREE.BoxGeometry(0.08, 0.5, 0.5), { at: [x * 4.6, 3, z], color: lit('#ffe0a0', 2), to: 'glow' }));
      }
    }
    // the windows down one side, the clouds out there (a glow)
    for (let i = 0; i < 5; i++) parts.push(part(new THREE.BoxGeometry(0.08, 1.6, 2.4), { at: [3.02, 2, -26 + i * 9 + 4.5], color: lit('#ffc89a', 1.3), to: 'glow' }));
    // the doors' frames
    for (const z of [8, -12]) for (const x of [-1, 1]) parts.push(part(box(0.3, 4.2, 0.5), { at: [x * 2.85, 0, z], color: '#b8b0a6', to: 'metal' }));
    object.add(k.build(parts, { name: 'corridorinside' }));
    const d1 = slidingDoor(k, object, solids, 3, 8, 4.2, 'door1');
    const d2 = slidingDoor(k, object, solids, 3, -12, 4.2, 'door2');
    const open = [0, 0];
    const want = [0, 0];
    return {
      object,
      solids,
      floors,
      doorOpen: (n) => open[n - 1],
      signal(name, on) {
        if (name === 'lobot1') want[0] = on ? 1 : 0;
        if (name === 'lobot2') want[1] = on ? 1 : 0;
      },
      update(t, dt = 0.016) {
        for (const [i, slab] of [d1, d2].entries()) {
          if (open[i] === want[i]) continue;
          open[i] = ease(open[i], want[i], dt, 0.7);
          slab.position.y = 1.9 + open[i] * 3.9;
        }
      },
    };
  },
};
