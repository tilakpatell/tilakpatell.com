// The places you go into, built in code: the Mos Eisley cantina (its round
// room under a dome, the bar ringed round its pillar of bottles, the
// booths, the band on its stand) and Jabba's palace (the gate passage, the
// throne room with the Hutt's dais and the trapdoor in front of it, and the
// rancor's pit under the floor, its gate up over the den). Each is built
// high over its world, out of sight (sites/index.js puts it), and lit by
// its zone's own lamps. (props/index.js has what a builder returns.)
//
// The palace answers two signals: 'trapdoor' (the grate in front of the
// throne swings open, or shut) and 'gate' (the portcullis over the
// rancor's den slams down, or goes back up).

import * as THREE from 'three';
import { box, cyl, dome, part, ring, rod } from '../kitCore';

const { PI, cos, sin } = Math;

// a shape turned inside out, to be seen from within (a round wall, a dome
// overhead): each triangle's corners the other way round, its normals in
export function inward(g) {
  const n = g.index ? g.toNonIndexed() : g;
  if (n !== g) g.dispose();
  for (const name of ['position', 'normal', 'uv']) {
    const a = n.attributes[name];
    if (!a) continue;
    const k = a.itemSize;
    for (let i = 0; i < a.count; i += 3)
      for (let c = 0; c < k; c++) {
        const t = a.array[(i + 1) * k + c];
        a.array[(i + 1) * k + c] = a.array[(i + 2) * k + c];
        a.array[(i + 2) * k + c] = t;
      }
  }
  const nm = n.attributes.normal;
  if (nm) for (let i = 0; i < nm.array.length; i++) nm.array[i] *= -1;
  return n;
}

// round on the floor: a disc, a ring
const disc = (r, seg = 40) => new THREE.CircleGeometry(r, seg).rotateX(-PI / 2);
const flatRing = (r0, r1, seg = 40) => new THREE.RingGeometry(r0, r1, seg).rotateX(-PI / 2);

export const PROPS = {

  // The cantina, inside: 11 m across its round room, the passage in from
  // the street at +z (down three steps), the bar in the middle, six
  // booths round the wall, the band's stand at the back (-z)
  cantinainside(k) {
    const R = 11;
    const H = 4.2;
    const wall = '#b49a78';
    const wallDark = '#8c745a';
    const trim = '#6c5844';
    const gap = 0.15; // (the doorway's half-angle in the round wall)
    const parts = [
      // the floor, worn round the bar
      part(disc(R + 0.3, 56), { color: '#5a4834', to: 'stone' }),
      part(flatRing(4.0, 4.8, 48), { at: [0, 0.01, -1], color: '#6e5a42', to: 'stone' }),
      // the round wall, open to the passage, and the dome over it
      part(inward(new THREE.CylinderGeometry(R, R, H, 56, 1, true, gap, PI * 2 - gap * 2).translate(0, H / 2, 0)), { color: wall, to: 'adobe' }),
      part(inward(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 0.14, 56, 1, true, gap, PI * 2 - gap * 2)), { at: [0, 1.1, 0], color: trim, to: 'adobe' }),
      part(inward(dome(R, 2.6, 56)), { at: [0, H, 0], color: wallDark, to: 'adobe' }),
      // a ring of light round the dome's crown
      part(ring(2.2, 0.08, 40), { at: [0, H + 2.35, 0], color: '#ffc890', to: 'glow' }),
    ];
    // ribs up the wall, a lamp on each
    for (let i = 0; i < 16; i++) {
      const a = gap + 0.25 + (i / 15) * (PI * 2 - gap * 2 - 0.5);
      parts.push(part(box(0.45, H, 0.35), { at: [sin(a) * (R - 0.12), 0, cos(a) * (R - 0.12)], rot: [0, a, 0], color: wallDark, to: 'adobe' }));
      if (i % 2) parts.push(part(new THREE.SphereGeometry(0.11, 8, 6), { at: [sin(a) * (R - 0.42), 2.6, cos(a) * (R - 0.42)], color: '#ffb46a', to: 'glow' }));
    }

    // the passage in from the street: down three steps
    parts.push(
      part(box(3.4, 0.75, 5), { at: [0, 0, 14.1], color: '#5e4c38', to: 'stone' }),
      part(box(3.4, 0.5, 0.6), { at: [0, 0, 11.3], color: '#5e4c38', to: 'stone' }),
      part(box(3.4, 0.25, 0.6), { at: [0, 0, 10.7], color: '#5e4c38', to: 'stone' }),
      part(new THREE.BoxGeometry(4, 0.3, 6.6), { at: [0, 3.35, 13.6], color: wallDark, to: 'adobe' }),
      part(box(4, 3.2, 0.3), { at: [0, 0, 16.75], color: wall, to: 'adobe' }),
      // the round door out, bright with the day
      part(new THREE.CircleGeometry(1.2, 28).rotateY(PI), { at: [0, 1.95, 16.58], color: '#fff0d0', to: 'glow' }),
      part(ring(1.25, 0.1, 28).rotateX(PI / 2), { at: [0, 1.95, 16.55], color: trim, to: 'adobe' }),
    );
    for (const x of [-1, 1]) parts.push(part(box(0.3, 3.2, 6.6), { at: [x * 1.85, 0, 13.6], color: wall, to: 'adobe' }));

    // the bar: a ring of counter round a pillar of bottles
    const bar = [0, -1];
    parts.push(
      part(new THREE.CylinderGeometry(3.4, 3.3, 1.1, 48, 1, true).translate(0, 0.55, 0), { at: [bar[0], 0, bar[1]], color: '#867664', to: 'metal' }),
      part(inward(new THREE.CylinderGeometry(2.6, 2.6, 1.1, 40, 1, true).translate(0, 0.55, 0)), { at: [bar[0], 0, bar[1]], color: '#5a4c3e', to: 'metal' }),
      part(flatRing(2.5, 3.6, 48), { at: [bar[0], 1.1, bar[1]], color: '#3a2e24', to: 'dark' }),
      part(ring(3.42, 0.035, 48), { at: [bar[0], 0.12, bar[1]], color: '#b8662a', to: 'glow' }),
      part(cyl(1.0, 1.0, H), { at: [bar[0], 0, bar[1]], color: '#6a5a48', to: 'metal' }),
    );
    const bottle = ['#2a7a4a', '#b0661e', '#3a5ab8', '#b03a3a', '#c8b84a', '#8a3ab0'];
    for (const y of [1.5, 2.0, 2.5]) {
      parts.push(part(ring(1.14, 0.05, 28), { at: [bar[0], y, bar[1]], color: '#4a3e32', to: 'metal' }));
      for (let i = 0; i < 16; i++) {
        const b = (i / 16) * PI * 2 + y;
        parts.push(part(new THREE.CylinderGeometry(0.035, 0.05, 0.26, 6).translate(0, 0.13, 0), { at: [bar[0] + sin(b) * 1.1, y + 0.03, bar[1] + cos(b) * 1.1], color: bottle[(i + Math.round(y * 2)) % bottle.length], to: 'glow' }));
      }
    }
    // the stools round it, and a glass or two on the counter
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * PI * 2 + 0.26;
      const at = [bar[0] + sin(a) * 4.0, 0, bar[1] + cos(a) * 4.0];
      parts.push(part(cyl(0.06, 0.06, 0.7, 6), { at, color: '#55534e', to: 'metal' }), part(cyl(0.22, 0.2, 0.08, 14), { at: [at[0], 0.7, at[2]], color: '#6a2c22', to: 'cloth' }));
      if (i % 3 === 0) parts.push(part(new THREE.CylinderGeometry(0.04, 0.03, 0.12, 8).translate(0, 0.06, 0), { at: [bar[0] + sin(a) * 3.1, 1.1, bar[1] + cos(a) * 3.1], color: '#7ab0c8', to: 'glow' }));
    }

    // the booths round the wall: a curved bench, a table, a lamp over it
    const solids = [{ circle: [bar[0], bar[1], 3.5] }];
    const booths = [1.05, 1.65, 2.25, -1.05, -1.65, -2.25];
    for (const a of booths) {
      const at = (r, y = 0) => [sin(a) * r, y, cos(a) * r];
      parts.push(
        part(box(2.8, 0.45, 0.75), { at: at(R - 0.6), rot: [0, a, 0], color: '#6a3424', to: 'cloth' }),
        part(box(2.8, 1.25, 0.22), { at: at(R - 0.2), rot: [0, a, 0], color: '#5a2c1e', to: 'cloth' }),
        part(cyl(0.08, 0.12, 0.72, 8), { at: at(R - 1.7), color: '#3e3228', to: 'metal' }),
        part(cyl(0.6, 0.6, 0.06, 20), { at: at(R - 1.7, 0.72), color: '#4a3a2c', to: 'metal' }),
        part(new THREE.SphereGeometry(0.16, 10, 8), { at: at(R - 0.45, 2.15), color: '#ff9a4a', to: 'glow' }),
      );
      solids.push({ circle: [sin(a) * (R - 1.7), cos(a) * (R - 1.7), 0.62] }, { box: [sin(a) * (R - 0.6), cos(a) * (R - 0.6), 1.4, 0.4, a] });
    }

    // the band's stand at the back: a half-round stage under an arch,
    // their horns and the drum in front of where they stand
    parts.push(
      part(new THREE.CylinderGeometry(3.3, 3.3, 0.35, 32, 1, false, -PI / 2, PI).translate(0, 0.175, 0), { at: [0, 0, -R + 0.6], color: '#4a3c30', to: 'stone' }),
      part(new THREE.TorusGeometry(3.4, 0.14, 8, 28, PI), { at: [0, 0.35, -R + 0.45], color: trim, to: 'adobe' }),
      part(new THREE.TorusGeometry(3.15, 0.04, 6, 28, PI), { at: [0, 0.35, -R + 0.5], color: '#6a8aff', to: 'glow' }),
    );
    for (const x of [-2, -1, 0, 1]) {
      // a kloo horn: a long pipe down from the mouth to its bell
      const top = [x + 0.08, 1.95, -9.2];
      const bot = [x + 0.22, 1.05, -8.85];
      parts.push(rod(top, bot, 0.018, 0.03, { color: '#c8a040', to: 'metal' }), part(new THREE.ConeGeometry(0.08, 0.14, 12, 1, true), { at: [bot[0], bot[1] - 0.04, bot[2]], color: '#d4ac48', to: 'metal' }));
    }
    parts.push(part(cyl(0.26, 0.24, 0.3, 16), { at: [2.1, 0.95, -8.7], color: '#8a5a2c', to: 'bark' }), rod([2.1, 0.35, -8.7], [2.1, 0.95, -8.7], 0.03, 0.03, { color: '#3a3a3a', to: 'metal' }));
    solids.push({ box: [0, -R + 1.9, 3.1, 1.6, 0] });

    // the wall, solid all round but for the doorway; the passage's sides
    for (let i = 0; i < 44; i++) {
      const a = gap + 0.07 + (i / 43) * (PI * 2 - gap * 2 - 0.14);
      solids.push({ box: [sin(a) * (R + 0.2), cos(a) * (R + 0.2), 0.95, 0.4, a] });
    }
    for (const x of [-1, 1]) solids.push({ box: [x * 1.95, 13.6, 0.25, 3.3, 0] });
    solids.push({ box: [0, 17, 2, 0.3, 0] });

    const floors = [
      { x: 0, z: 0, r: R + 0.2, y: 0 },
      { x: 0, z: 10.7, hw: 1.7, hd: 0.3, y: 0.25 },
      { x: 0, z: 11.3, hw: 1.7, hd: 0.3, y: 0.5 },
      { x: 0, z: 14.1, hw: 1.7, hd: 2.5, y: 0.75 },
      // (the band's stand: walled off, but they stand on it)
      { x: 0, z: -8.9, hw: 3, hd: 1.5, y: 0.35 },
    ];
    return { object: k.build(parts, { name: 'cantinainside', shadows: false }), solids, floors };
  },

  // Jabba's palace, inside. The throne room (y = 0): 22 m across, 26 deep,
  // the passage in from the gate at +z, the dais at the back with the
  // trapdoor in front of it. The rancor's pit under it all (its floor 6 m
  // down), the den behind its gate at the back, the keeper's door at the
  // front.
  palaceinside(k) {
    const stone = '#76675a';
    const dark = '#463c34';
    const floorC = '#5a4e42';
    const parts = [];
    const solids = [];
    const floors = [];
    const slab = (x, z, w, d) => {
      parts.push(part(box(w, 0.4, d), { at: [x, -0.4, z], color: floorC, to: 'stone' }));
      floors.push({ x, z, hw: w / 2, hd: d / 2, y: 0 });
    };
    // the throne room's floor, round the trapdoor's hole (x ±1.6, z -3.6 … -0.4)
    // (out past the back wall, over the pit's far end, too)
    slab(-6.3, 2.15, 9.4, 27.7);
    slab(6.3, 2.15, 9.4, 27.7);
    slab(0, 7.8, 3.2, 16.4);
    slab(0, -7.65, 3.2, 8.1);
    floors.push({ x: 0, z: -2, hw: 1.6, hd: 1.6, y: 0, tag: 'trapdoor' });
    // its walls and ceiling, beams across it
    const wall = (x, z, w, h, d, y = 0, color = stone) => parts.push(part(box(w, h, d), { at: [x, y, z], color, to: 'stone' }));
    wall(-11.25, 3, 0.5, 7, 26.4);
    wall(11.25, 3, 0.5, 7, 26.4);
    wall(0, -10.25, 23, 7, 0.5);
    wall(-6.6, 16.25, 8.8, 7, 0.5);
    wall(6.6, 16.25, 8.8, 7, 0.5);
    parts.push(part(new THREE.BoxGeometry(23, 0.5, 26.6), { at: [0, 7.25, 3], color: dark, to: 'stone' }));
    for (let z = -8; z <= 14; z += 4.4) parts.push(part(new THREE.BoxGeometry(22.4, 0.5, 0.6), { at: [0, 6.75, z], color: '#3a322a', to: 'bark' }));
    solids.push({ box: [-11.25, 3, 0.25, 13.2, 0], base: -0.2 }, { box: [11.25, 3, 0.25, 13.2, 0], base: -0.2 }, { box: [0, -10.25, 11.5, 0.25, 0], base: -0.2 }, { box: [-6.6, 16.25, 4.4, 0.25, 0], base: -0.2 }, { box: [6.6, 16.25, 4.4, 0.25, 0], base: -0.2 });
    // pillars, and braziers on the walls
    for (const x of [-8.5, 8.5])
      for (const z of [9, -4]) {
        parts.push(part(cyl(0.85, 0.7, 7, 16), { at: [x, 0, z], color: '#6a5c4e', to: 'stone' }), part(cyl(1.05, 1.05, 0.5, 16), { at: [x, 0, z], color: dark, to: 'stone' }));
        solids.push({ circle: [x, z, 0.9], base: -0.2 });
      }
    for (const z of [-6, 0, 6, 12])
      for (const x of [-1, 1]) {
        parts.push(part(new THREE.ConeGeometry(0.28, 0.4, 10).rotateX(PI), { at: [x * 10.75, 3.2, z], color: '#3a3028', to: 'metal' }), part(new THREE.SphereGeometry(0.2, 8, 6), { at: [x * 10.75, 3.45, z], color: '#ff8a2a', to: 'glow' }));
      }
    // the dais at the back, the Hutt's cushions on it, hangings behind
    parts.push(
      part(box(7, 0.9, 4.4), { at: [0, 0, -7.6], color: dark, to: 'stone' }),
      part(cyl(1.9, 1.8, 0.25, 24), { at: [0, 0.9, -7.6], color: '#6e2a1c', to: 'cloth' }),
      rod([2.2, 0.9, -6.4], [2.2, 1.9, -6.4], 0.04, 0.04, { color: '#b8962a', to: 'metal' }),
      part(new THREE.SphereGeometry(0.22, 12, 8), { at: [2.2, 1.95, -6.4], color: '#9a3a8a', to: 'glass' }),
    );
    for (const x of [-3, -1, 1, 3]) parts.push(part(new THREE.BoxGeometry(1.6, 5, 0.06), { at: [x, 3.6, -9.95], color: x % 4 ? '#5a2a24' : '#7a5a2a', to: 'cloth' }));
    solids.push({ box: [0, -7.6, 3.5, 2.2, 0], base: -0.2 });
    floors.push({ x: 0, z: -7.6, hw: 3.5, hd: 2.2, y: 0.9 });
    // Han Solo in carbonite, hung on the left wall, its panels lit
    {
      const at = [-10.82, 0.35, 5];
      parts.push(part(box(0.4, 2.3, 1.1), { at, color: '#4c535c', to: 'metal' }));
      const relief = (g, y, z, sx = 1) => parts.push(part(g, { at: [at[0] + 0.24, at[1] + y, at[2] + z], scale: [sx, 1, 1], color: '#5a626c', to: 'metal' }));
      relief(new THREE.SphereGeometry(0.13, 10, 8), 1.75, 0, 0.6);
      relief(new THREE.CapsuleGeometry(0.17, 0.6, 4, 8), 1.15, 0, 0.5);
      relief(new THREE.CapsuleGeometry(0.05, 0.4, 3, 6).rotateX(0.6), 1.55, -0.3, 0.5);
      relief(new THREE.CapsuleGeometry(0.05, 0.4, 3, 6).rotateX(-0.6), 1.55, 0.3, 0.5);
      for (const z of [-0.45, 0.45]) parts.push(part(new THREE.BoxGeometry(0.05, 0.5, 0.08), { at: [at[0] + 0.22, at[1] + 0.5, at[2] + z], color: z < 0 ? '#ff3a2a' : '#3aff6a', to: 'glow' }));
      solids.push({ box: [-10.7, 5, 0.4, 0.6, 0], base: -0.2 });
    }
    // the band's organ, on the right
    parts.push(part(box(2.2, 1.0, 0.9), { at: [8, 0, 4], color: '#2e4a8a', to: 'paint' }));
    for (let i = 0; i < 6; i++) parts.push(part(cyl(0.06, 0.06, 0.6 + i * 0.12, 8), { at: [7.3 + i * 0.28, 1.0, 3.75], color: '#c8b070', to: 'metal' }));
    solids.push({ box: [8, 4, 1.15, 0.5, 0], base: -0.2 });

    // the passage in from the gate
    parts.push(part(box(4.4, 0.4, 14), { at: [0, -0.4, 23], color: floorC, to: 'stone' }));
    floors.push({ x: 0, z: 23, hw: 2.2, hd: 7, y: 0 });
    for (const x of [-1, 1]) {
      wall(x * 2.45, 23, 0.5, 5.5, 14);
      solids.push({ box: [x * 2.45, 23, 0.25, 7, 0] });
      parts.push(part(new THREE.SphereGeometry(0.16, 8, 6), { at: [x * 2.15, 3.0, 21], color: '#ff9a3a', to: 'glow' }));
    }
    parts.push(part(new THREE.BoxGeometry(5.4, 0.5, 14), { at: [0, 5.75, 23], color: dark, to: 'stone' }));
    wall(0, 16.25, 4.4, 1.5, 0.5, 5.5);
    // the gate, inside: iron, studded, a crack of daylight under it
    parts.push(part(box(4.4, 5.5, 0.4), { at: [0, 0, 30.2], color: '#3a3028', to: 'metal' }), part(new THREE.BoxGeometry(4.2, 0.06, 0.06), { at: [0, 0.03, 29.98], color: '#ffd8a0', to: 'glow' }));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) parts.push(part(new THREE.SphereGeometry(0.07, 6, 4), { at: [-1.6 + i * 0.8, 0.8 + j * 1.2, 29.98], color: '#6a5a48', to: 'metal' }));
    solids.push({ box: [0, 30.3, 2.2, 0.25, 0] });

    // ── the rancor's pit, 6 m down ──
    const PY = -6;
    parts.push(part(box(14.4, 0.4, 16.4), { at: [0, PY - 0.4, -3], color: '#8a7456', to: 'stone' }));
    floors.push({ x: 0, z: -3, hw: 7.2, hd: 8.2, y: PY });
    const pitWall = (x, z, w, d, h = 5.6, y = PY) => {
      parts.push(part(box(w, h, d), { at: [x, y, z], color: '#5e5044', to: 'stone' }));
      solids.push({ box: [x, z, w / 2, d / 2, 0], top: y + h });
    };
    pitWall(-7.45, -3, 0.5, 16.4);
    pitWall(7.45, -3, 0.5, 16.4);
    pitWall(0, 5.45, 15.4, 0.5);
    pitWall(-4.85, -11.45, 4.9, 0.5);
    pitWall(4.85, -11.45, 4.9, 0.5);
    parts.push(part(box(4.8, 1.6, 0.5), { at: [0, -2, -11.45], color: '#5e5044', to: 'stone' }));
    // the den behind the gate: dark, deep enough to hide something big
    parts.push(part(box(5.2, 0.4, 3.2), { at: [0, PY - 0.4, -12.9], color: '#6a5a44', to: 'stone' }), part(box(5.2, 4.4, 0.3), { at: [0, PY, -14.6], color: '#1c1612', to: 'stone' }), part(new THREE.BoxGeometry(5.6, 0.3, 3.4), { at: [0, -1.85, -12.9], color: '#1c1612', to: 'stone' }));
    for (const x of [-1, 1]) parts.push(part(box(0.3, 4.4, 3.2), { at: [x * 2.6, PY, -12.9], color: '#2a221c', to: 'stone' }));
    floors.push({ x: 0, z: -12.9, hw: 2.4, hd: 1.5, y: PY });
    solids.push({ box: [0, -14.5, 2.5, 0.2, 0], top: -2 }, { box: [-2.6, -12.9, 0.2, 1.6, 0], top: -2 }, { box: [2.6, -12.9, 0.2, 1.6, 0], top: -2 });
    // the keeper's door at the front, and the gate's control by the den
    parts.push(part(box(1.8, 2.6, 0.06), { at: [0, PY, 5.18], color: '#140e0a', to: 'dark' }), part(box(2.2, 0.3, 0.2), { at: [0, PY + 2.6, 5.14], color: '#3a3028', to: 'metal' }));
    parts.push(part(box(0.15, 0.9, 0.6), { at: [-7.12, PY + 1.0, -8.5], color: '#3c3a36', to: 'metal' }), part(new THREE.SphereGeometry(0.09, 8, 6), { at: [-7.02, PY + 1.55, -8.5], color: '#ff3020', to: 'glow' }));
    // bones, everywhere
    const rand = k.rand;
    for (let i = 0; i < 26; i++) {
      const x = (rand() - 0.5) * 13;
      const z = -3 + (rand() - 0.5) * 15;
      if (Math.hypot(x, z + 2) < 2) continue;
      parts.push(part(new THREE.CapsuleGeometry(0.05 + rand() * 0.04, 0.3 + rand() * 0.6, 3, 6).rotateZ(PI / 2).rotateY(rand() * PI), { at: [x, PY + 0.06, z], color: '#ddd4be', to: 'stone' }));
      if (i % 5 === 0) parts.push(part(new THREE.SphereGeometry(0.14, 10, 8), { at: [x + 0.3, PY + 0.1, z], scale: [1, 0.85, 1.2], color: '#e2dac6', to: 'stone' }));
    }

    const object = k.build(parts, { name: 'palaceinside', shadows: false });

    // the trapdoor: a grate on its hinge (the edge nearer the gate), and the
    // portcullis over the den: each its own, to move
    const iron = k.own(new THREE.MeshStandardMaterial({ color: '#4a4640', roughness: 0.5, metalness: 0.6 }));
    const hinge = new THREE.Group();
    hinge.position.set(0, 0, -0.4);
    const grate = new THREE.Group();
    grate.position.z = -1.6;
    hinge.add(grate);
    const plate = new THREE.Mesh(k.own(new THREE.BoxGeometry(3.2, 0.08, 3.2)), iron);
    plate.position.y = -0.04;
    grate.add(plate);
    const barGeo = k.own(new THREE.BoxGeometry(0.08, 0.06, 3.0));
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Mesh(barGeo, iron);
      b.position.set(-1.35 + i * 0.45, 0.01, 0);
      grate.add(b);
      const c = new THREE.Mesh(barGeo, iron);
      c.rotation.y = PI / 2;
      c.position.set(0, 0.01, -1.35 + i * 0.45);
      grate.add(c);
    }
    object.add(hinge);
    const portcullis = new THREE.Group();
    const bar = k.own(new THREE.BoxGeometry(0.12, 4.2, 0.12));
    for (let i = 0; i < 13; i++) {
      const b = new THREE.Mesh(bar, iron);
      b.position.set(-2.3 + i * 0.383, 2.1, 0);
      portcullis.add(b);
    }
    const cross = k.own(new THREE.BoxGeometry(4.8, 0.14, 0.14));
    for (const y of [0.6, 2.1, 3.6]) {
      const c = new THREE.Mesh(cross, iron);
      c.position.y = y;
      portcullis.add(c);
    }
    for (const spike of portcullis.children.slice(0, 13)) {
      const tip = new THREE.Mesh(k.own(new THREE.ConeGeometry(0.08, 0.3, 6).rotateX(PI)), iron);
      tip.position.y = -2.2;
      spike.add(tip);
    }
    const UP = PY + 4.2;
    portcullis.position.set(0, UP, -11.45); // (in the wall's slot)
    object.add(portcullis);

    // what each signal sets going: { from, to, t }
    const moves = { trapdoor: { at: 0, to: 0, speed: 3.2 }, gate: { at: 0, to: 0, speed: 5 } };
    return {
      object,
      solids,
      floors,
      signal(name, on) {
        if (moves[name]) moves[name].to = on ? 1 : 0;
      },
      update(t, dt = 0.016) {
        for (const m of Object.values(moves)) {
          if (m.at === m.to) continue;
          m.at = m.to > m.at ? Math.min(m.to, m.at + dt * m.speed) : Math.max(m.to, m.at - dt * m.speed * 0.3);
        }
        // the grate drops open on its hinge; the gate falls, fast at the end
        hinge.rotation.x = -(moves.trapdoor.at ** 1.5) * (PI / 2) * 0.96;
        portcullis.position.y = UP - moves.gate.at ** 2 * 4.2;
      },
    };
  },
};
