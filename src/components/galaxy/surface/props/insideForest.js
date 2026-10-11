// Yavin 4's Great Temple, inside, built in code (props/index.js has what a
// builder returns; insideCore.js is Coruscant's, the same way): the war
// room under the hangar (rows of benches, the lectern, and the briefing's
// hologram of the Death Star and its trench, an additive wireframe that
// plays on the 'brief' signal), the ceremony hall at the summit (the dais,
// the banners, the whole Rebellion in rows, one baked mesh), and the stair
// between the hangar and the summit (three landings joined by flights, a
// floor for every step). BOUNDS is each one's [hw, hd, h].

import * as THREE from 'three';
import { box, cyl, part, ring } from '../kitCore';

const { PI } = Math;
const lit = (c, k = 2.2) => new THREE.Color(c).multiplyScalar(k);
const STONE = '#8a8470';
const STONE_DARK = '#6a6452';

export const BOUNDS = {
  warroom: [14, 10, 6],
  ceremonyhall: [16, 22, 12],
  templestair: [6, 12, 16],
};

// a stone room: floor, four walls, ceiling, a doorway in the +z wall
function room(parts, hw, hd, h, { door = 3 } = {}) {
  parts.push(part(box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, -0.2, 0], color: STONE_DARK, to: 'stone' }));
  parts.push(part(new THREE.BoxGeometry(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, h + 0.1, 0], color: STONE_DARK, to: 'stone' }));
  parts.push(part(box(hw * 2 + 0.4, h, 0.2), { at: [0, 0, -hd - 0.1], color: STONE, to: 'stone' }));
  for (const x of [-1, 1]) {
    parts.push(part(box(0.2, h, hd * 2 + 0.4), { at: [x * (hw + 0.1), 0, 0], color: STONE, to: 'stone' }));
    const seg = hw - door / 2;
    parts.push(part(box(seg, h, 0.2), { at: [x * (door / 2 + seg / 2), 0, hd + 0.1], color: STONE, to: 'stone' }));
  }
  parts.push(part(box(door, h - 2.6, 0.2), { at: [0, 2.6, hd + 0.1], color: STONE, to: 'stone' }));
  parts.push(part(new THREE.PlaneGeometry(door - 0.1, 2.5).rotateY(PI), { at: [0, 1.3, hd + 0.02], color: '#e8f0d8', to: 'glow' }));
}

// a small figure, standing (a row of them is the Rebellion): a body, a
// head, in the colour given
const figure = (parts, x, z, color, skin = '#d8a888') => {
  parts.push(part(cyl(0.22, 0.26, 1.2, 8), { at: [x, 0, z], color, to: 'cloth' }));
  parts.push(part(new THREE.SphereGeometry(0.16, 8, 6), { at: [x, 1.4, z], color: skin, to: 'cloth' }));
};

export const PROPS = {
  // the war room: 28 × 20 m, benches in rows facing the lectern at -z,
  // the hologram over the table before it
  warroom(k) {
    const [hw, hd, h] = BOUNDS.warroom;
    const parts = [];
    room(parts, hw, hd, h);
    const solids = [];
    // the benches: six rows, two blocks
    for (let i = 0; i < 6; i++) {
      const z = -1 + i * 1.6;
      for (const x of [-5.5, 5.5]) {
        parts.push(part(box(8, 0.45, 0.4), { at: [x, 0, z], color: '#4a4236', to: 'metal' }));
        parts.push(part(box(8, 0.5, 0.08), { at: [x, 0.45, z - 0.2], color: '#4a4236', to: 'metal' }));
        solids.push({ box: [x, z, 4, 0.25], top: 0.5 });
      }
    }
    // the lectern and the holotable
    parts.push(part(box(1.2, 1.1, 0.6), { at: [-4, 0, -7.5], color: '#5a5246', to: 'metal' }));
    parts.push(part(cyl(2.2, 2.4, 0.8, 24), { at: [1, 0, -6.5], color: '#3a3630', to: 'metal' }));
    parts.push(part(ring(2.3, 0.06, 32), { at: [1, 0.82, -6.5], color: lit('#5ad0ff', 2), to: 'glow' }));
    solids.push({ box: [-4, -7.5, 0.6, 0.3] }, { circle: [1, -6.5, 2.4] });
    // the screens on the back wall, and the lamps down the sides
    for (const x of [-9, -3, 3, 9]) parts.push(part(new THREE.PlaneGeometry(4.5, 2.4), { at: [x, 3.2, -hd + 0.05], color: lit('#5a9aff', 1.4), to: 'glow' }));
    for (let i = 0; i < 4; i++) for (const x of [-1, 1]) parts.push(part(box(0.1, 0.3, 1.6), { at: [x * (hw - 0.08), 4.6, -7 + i * 4.5], color: lit('#ffe0a0', 2), to: 'glow' }));
    const object = k.build(parts, { name: 'warroom' });
    // the hologram: the station, a wireframe sphere, the trench a ring of
    // lines round it, scrolling while the briefing plays
    const holo = new THREE.Group();
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1.4, 14, 10)), new THREE.LineBasicMaterial({ color: new THREE.Color('#5ad0ff').multiplyScalar(2.2), transparent: true, opacity: 0.55, toneMapped: false }));
    const trench = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.05, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe08a').multiplyScalar(2.5), toneMapped: false }));
    trench.rotation.x = 0.3;
    holo.add(wire, trench);
    holo.position.set(1, 2.6, -6.5);
    holo.visible = false;
    object.add(holo);
    let want = 0;
    let on = 0;
    return {
      object,
      solids,
      floors: [{ x: 0, z: 0, hw, hd, yaw: 0, y: 0 }],
      playing: () => on > 0.5,
      signal(name, up) {
        if (name === 'brief') want = up ? 1 : 0;
      },
      update(t, dt = 0.016) {
        on += (want - on) * Math.min(1, dt * 2);
        holo.visible = on > 0.05;
        holo.scale.setScalar(0.2 + 0.8 * on);
        holo.rotation.y = t * 0.5;
        trench.rotation.z = t * 1.2;
      },
    };
  },

  // the ceremony hall at the summit: 32 × 44 m, the aisle up the middle to
  // the dais at -z, the Rebellion in rows either side (baked, one mesh),
  // banners down the walls, the doors at +z bright with the day
  ceremonyhall(k) {
    const [hw, hd, h] = BOUNDS.ceremonyhall;
    const parts = [];
    room(parts, hw, hd, h, { door: 5 });
    const solids = [];
    // the dais: three steps up, the throne's wall behind it
    for (let i = 0; i < 3; i++) parts.push(part(box(16 - i * 3, 0.4, 5 - i), { at: [0, i * 0.4, -hd + 4 + i * 0.5], color: STONE, to: 'stone' }));
    solids.push({ box: [0, -hd + 4, 8, 2.5], top: 1.2 });
    parts.push(part(box(16, 6, 0.6), { at: [0, 1.2, -hd + 1.6], color: STONE_DARK, to: 'stone' }));
    // the rows: the whole Rebellion, 14 rows of 9 a side, in the troops'
    // tan and the pilots' orange and the fleet's grey
    const colours = ['#c8b48c', '#e8742a', '#8a8f98', '#c8b48c', '#5a6a8a'];
    for (let r = 0; r < 14; r++) for (let i = 0; i < 9; i++) for (const side of [-1, 1]) figure(parts, side * (3.5 + i * 1.2), -hd + 12 + r * 2, colours[(r * 3 + i) % colours.length]);
    for (let r = 0; r < 14; r++) for (const side of [-1, 1]) solids.push({ box: [side * 8.3, -hd + 12 + r * 2, 5.2, 0.4] });
    // the banners down the walls, the lamps between
    for (let i = 0; i < 6; i++) {
      const z = -hd + 6 + i * 6;
      for (const x of [-1, 1]) {
        parts.push(part(box(0.1, 7, 1.6), { at: [x * (hw - 0.3), 3, z], color: '#8a2a2a', to: 'cloth' }));
        parts.push(part(new THREE.SphereGeometry(0.18, 8, 6), { at: [x * (hw - 0.6), 8.5, z + 3], color: lit('#ffe0a0', 2.4), to: 'glow' }));
      }
    }
    // the light down from the roof's slot over the aisle
    parts.push(part(box(3, 0.1, hd * 2 - 6), { at: [0, h - 0.2, 0], color: lit('#fff4dc', 2), to: 'glow' }));
    return { object: k.build(parts, { name: 'ceremonyhall' }), solids, floors: [{ x: 0, z: 0, hw, hd, yaw: 0, y: 0 }, { x: 0, z: -hd + 4, hw: 8, hd: 2.5, yaw: 0, y: 1.2 }] };
  },

  // the stair inside the temple: a shaft 12 × 24 m, three landings (the
  // hangar's level, a middle, the summit's) joined by flights along the
  // walls, a floor for every step, lamps at each landing
  templestair(k) {
    const [hw, hd, h] = BOUNDS.templestair;
    const parts = [];
    const floors = [];
    const solids = [];
    // the shaft's walls and floor; the way in at +z on the bottom landing,
    // the way out at -z on the top
    parts.push(part(box(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, -0.2, 0], color: STONE_DARK, to: 'stone' }));
    parts.push(part(new THREE.BoxGeometry(hw * 2 + 0.4, 0.2, hd * 2 + 0.4), { at: [0, h + 0.1, 0], color: STONE_DARK, to: 'stone' }));
    for (const x of [-1, 1]) parts.push(part(box(0.2, h, hd * 2 + 0.4), { at: [x * (hw + 0.1), 0, 0], color: STONE, to: 'stone' }));
    parts.push(part(box(hw * 2 + 0.4, h - 3, 0.2), { at: [0, 3, hd + 0.1], color: STONE, to: 'stone' }));
    for (const x of [-1, 1]) parts.push(part(box(hw - 1.5, 3, 0.2), { at: [x * (1.5 + (hw - 1.5) / 2), 0, hd + 0.1], color: STONE, to: 'stone' }));
    parts.push(part(new THREE.PlaneGeometry(2.9, 2.8).rotateY(PI), { at: [0, 1.5, hd + 0.02], color: '#e8f0d8', to: 'glow' }));
    const landings = [0, 7, 14];
    const top = landings.at(-1);
    parts.push(part(box(hw * 2 + 0.4, top - 0.2, 0.2), { at: [0, 0, -hd - 0.1], color: STONE, to: 'stone' }));
    parts.push(part(box(hw * 2 + 0.4, h - top - 3, 0.2), { at: [0, top + 3, -hd - 0.1], color: STONE, to: 'stone' }));
    for (const x of [-1, 1]) parts.push(part(box(hw - 1.5, 3, 0.2), { at: [x * (1.5 + (hw - 1.5) / 2), top, -hd - 0.1], color: STONE, to: 'stone' }));
    parts.push(part(new THREE.PlaneGeometry(2.9, 2.8), { at: [0, top + 1.5, -hd - 0.02], color: '#e8f0d8', to: 'glow' }));
    // the landings: the bottom one the whole floor; the middle and top ones
    // slabs across the shaft's ends
    floors.push({ x: 0, z: hd - 3, hw, hd: 3, yaw: 0, y: 0 });
    parts.push(part(box(hw * 2, 0.5, 6), { at: [0, landings[1] - 0.5, -hd + 3], color: STONE, to: 'stone' }));
    floors.push({ x: 0, z: -hd + 3, hw, hd: 3, yaw: 0, y: landings[1] });
    parts.push(part(box(hw * 2, 0.5, 6), { at: [0, top - 0.5, -hd + 3], color: STONE, to: 'stone' }));
    floors.push({ x: 0, z: -hd + 3, hw, hd: 3, yaw: 0, y: top });
    parts.push(part(box(hw * 2, 0.5, 6), { at: [0, top - 0.5, hd - 3], color: STONE, to: 'stone' }));
    floors.push({ x: 0, z: hd - 3, hw, hd: 3, yaw: 0, y: top });
    // the flights: up the east wall from the bottom landing to the middle
    // (toward -z), up the west wall from the middle to the top's far end
    // (toward +z), and the top's two ends joined by a walk along the east
    const flight = (x, z0, z1, y0, y1) => {
      const n = Math.ceil((y1 - y0) / 0.5);
      const rise = (y1 - y0) / n;
      const tread = (z1 - z0) / n;
      for (let i = 0; i < n; i++) {
        const y = y0 + (i + 1) * rise;
        const z = z0 + (i + 0.5) * tread;
        parts.push(part(box(2.8, 0.5, Math.abs(tread) + 0.04), { at: [x, y - 0.5, z], color: STONE, to: 'stone' }));
        floors.push({ x, z, hw: 1.4, hd: Math.abs(tread) / 2 + 0.03, yaw: 0, y });
      }
    };
    flight(hw - 1.5, hd - 6, -hd + 6, landings[0], landings[1]);
    flight(-hw + 1.5, -hd + 6, hd - 6, landings[1], top);
    parts.push(part(box(2.8, 0.5, hd * 2 - 12), { at: [hw - 1.5, top - 0.5, 0], color: STONE, to: 'stone' }));
    floors.push({ x: hw - 1.5, z: 0, hw: 1.4, hd: hd - 6, yaw: 0, y: top });
    // the lamps at the landings
    for (const [y, z] of [[2.6, hd - 1], [landings[1] + 2.6, -hd + 1], [top + 2.6, -hd + 1], [top + 2.6, hd - 1]]) parts.push(part(new THREE.SphereGeometry(0.16, 8, 6), { at: [0, y, z], color: lit('#ffe0a0', 2.4), to: 'glow' }));
    return { object: k.build(parts, { name: 'templestair' }), solids, floors };
  },
};
