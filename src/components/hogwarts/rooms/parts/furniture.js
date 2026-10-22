// The castle’s furniture, built into a room’s kit (../kit.js) as static
// pieces to be merged: long tables on trestles and their benches, high-backed
// chairs and the Headmaster’s gold one, the Sorting stool, the golden owl
// lectern, a stone fireplace, a pair of great oak doors, bookcases, a
// four-poster. Each takes a place and a turn; `frame()` puts a piece’s own
// boxes where the piece stands. Pieces, not people: these may be drawn in code.
//
//   frame(kit, { at: [x, y, z], ry }) → { box, cyl, add } in the piece’s own frame
//   table(kit, { at, ry, len, w, top, mat })
//   bench(kit, { at, ry, len, seat, mat })
//   chair(kit, { at, ry, mat, back })   throne(kit, { at, ry })
//   stool(kit, { at })   lectern(kit, { at, ry })
//   fireplace(kit, { at, ry, w, h }) → [x, y, z]: where its fire burns
//   doors(kit, { at, ry, w, h, open }) (open: 0…1, the leaves swung in)
//   bookcase(kit, { at, ry, w, h, shelves }) → [{ at, ry, w }]: the shelves, for the books
//   bed(kit, { at, ry, hangings })
//   rod(kit, mat, a, b, r, { seg }) a round bar from one point to another (a chain, a rope, a tripod’s leg)
//   chain(kit, a, b, { link }) a run of iron links from a to b

import * as THREE from 'three';

export function frame(kit, { at = [0, 0, 0], ry = 0 } = {}) {
  const c = Math.cos(ry);
  const s = Math.sin(ry);
  // (a local x, z turned by ry about +y, then moved to `at`)
  const to = (x, z) => [at[0] + x * c + z * s, at[2] - x * s + z * c];
  return {
    to,
    box(mat, x, y, z, w, h, d, { rx = 0, rz = 0, ry: r = 0 } = {}) {
      const [wx, wz] = to(x, z);
      kit.box(mat, wx, at[1] + y, wz, w, h, d, { ry: ry + r, rx, rz });
    },
    cyl(mat, x, y, z, r0, r1, h, opts = {}) {
      const [wx, wz] = to(x, z);
      kit.cyl(mat, wx, at[1] + y, wz, r0, r1, h, { ...opts, ry: ry + (opts.ry ?? 0) });
    },
    add(mat, geometry, { x = 0, y = 0, z = 0, ry: r = 0, rx = 0, rz = 0, scale = 1 } = {}) {
      const [wx, wz] = to(x, z);
      kit.add(mat, geometry, { at: [wx, at[1] + y, wz], ry: ry + r, rx, rz, scale });
    },
  };
}

// a long table along its own z: a thick top on trestles, a stretcher low between them
export function table(kit, { at, ry = 0, len = 4, w = 1.1, top = 0.78, mat = 'darkoak' }) {
  const f = frame(kit, { at, ry });
  f.box(mat, 0, top - 0.07, 0, w, 0.07, len);
  f.box(mat, 0, top - 0.11, 0, w - 0.12, 0.04, len - 0.1);
  const legs = Math.max(2, Math.round(len / 3.2) + 1);
  for (let i = 0; i < legs; i++) {
    const z = -len / 2 + 0.35 + (i * (len - 0.7)) / (legs - 1);
    f.box(mat, 0, 0, z, w - 0.18, 0.08, 0.16);
    f.box(mat, 0, 0.08, z, 0.14, top - 0.19, 0.14);
    f.box(mat, 0, top - 0.17, z, w - 0.25, 0.06, 0.12);
  }
  f.box(mat, 0, 0.22, 0, 0.08, 0.08, len - 0.8);
}

export function bench(kit, { at, ry = 0, len = 4, seat = 0.46, mat = 'oak' }) {
  const f = frame(kit, { at, ry });
  f.box(mat, 0, seat - 0.06, 0, 0.36, 0.06, len);
  const legs = Math.max(2, Math.round(len / 2.4) + 1);
  for (let i = 0; i < legs; i++) {
    const z = -len / 2 + 0.25 + (i * (len - 0.5)) / (legs - 1);
    f.box(mat, 0, 0, z, 0.3, seat - 0.06, 0.06);
  }
}

export function chair(kit, { at, ry = 0, mat = 'darkoak', back = 1.25, seat = 0.48 }) {
  const f = frame(kit, { at, ry });
  f.box(mat, 0, seat - 0.05, 0, 0.52, 0.05, 0.5);
  for (const x of [-0.22, 0.22]) for (const z of [-0.21, 0.21]) f.box(mat, x, 0, z, 0.05, seat - 0.05, 0.05);
  // the back: two posts with finials and three rails, a pointed panel at the top
  for (const x of [-0.24, 0.24]) {
    f.box(mat, x, seat, -0.23, 0.06, back, 0.06);
    f.cyl(mat, x, seat + back, -0.23, 0.035, 0.02, 0.1, { seg: 6 });
  }
  for (const y of [0.3, 0.62, back - 0.08]) f.box(mat, 0, seat + y, -0.23, 0.46, 0.06, 0.04);
  f.box(mat, 0, seat + 0.36, -0.235, 0.36, back - 0.5, 0.025);
}

export function throne(kit, { at, ry = 0 }) {
  const f = frame(kit, { at, ry });
  f.box('gold', 0, 0, 0, 0.78, 0.5, 0.66);
  f.box('gold', 0, 0.5, -0.29, 0.78, 1.7, 0.1);
  for (const x of [-0.36, 0.36]) {
    f.box('gold', x, 0.5, 0, 0.08, 0.3, 0.6);
    f.cyl('gold', x, 2.2, -0.29, 0.06, 0.04, 0.24, { seg: 8 });
  }
  // the crest at its top: a gilt disc between the finials
  f.cyl('gold', 0, 2.3, -0.29, 0.2, 0.2, 0.05, { seg: 20, rx: Math.PI / 2 });
  f.box(kit.paint('#5a1830', { rough: 0.8 }), 0, 0.5, 0.02, 0.62, 0.06, 0.56);
  f.box(kit.paint('#5a1830', { rough: 0.8 }), 0, 0.62, -0.23, 0.6, 1.2, 0.04);
}

// the three-legged stool the first-years sit on to be sorted
export function stool(kit, { at }) {
  const f = frame(kit, { at });
  f.cyl('board', 0, 0.5, 0, 0.22, 0.2, 0.06, { seg: 16 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    f.cyl('board', Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15, 0.03, 0.035, 0.5, { seg: 6, rx: Math.sin(a) * 0.12, rz: -Math.cos(a) * 0.12 });
  }
}

// the golden owl lectern: a column, and an owl with its wings spread holding the book rest
export function lectern(kit, { at, ry = 0 }) {
  const f = frame(kit, { at, ry });
  f.cyl('gold', 0, 0, 0, 0.32, 0.38, 0.12, { seg: 20 });
  f.cyl('gold', 0, 0.12, 0, 0.1, 0.14, 0.9, { seg: 12 });
  f.cyl('gold', 0, 1.02, 0, 0.18, 0.1, 0.12, { seg: 12 });
  // the owl standing on the column, its wings spread back and up to hold the rest on their tips
  f.add('gold', new THREE.SphereGeometry(0.13, 14, 10), { y: 1.27, scale: [1, 1.3, 0.85] });
  f.add('gold', new THREE.SphereGeometry(0.1, 14, 10), { y: 1.5, z: 0.02 });
  for (const x of [-1, 1]) {
    // the ear tufts and the eyes
    f.add('gold', new THREE.ConeGeometry(0.03, 0.09, 6), { x: x * 0.06, y: 1.62, rz: -x * 0.3 });
    f.add(kit.paint('#1a1208', { rough: 0.3 }), new THREE.SphereGeometry(0.02, 8, 6), { x: x * 0.04, y: 1.52, z: 0.09 });
    f.box('gold', x * 0.2, 1.22, -0.04, 0.3, 0.04, 0.2, { rz: x * 0.7 });
    f.box('gold', x * 0.32, 1.38, -0.06, 0.2, 0.035, 0.18, { rz: x * 1.05 });
  }
  f.add('gold', new THREE.ConeGeometry(0.02, 0.05, 6), { y: 1.47, z: 0.11, rx: Math.PI / 2 });
  // the rest on the wings’ tips, sloped toward the reader
  f.box('gold', 0, 1.5, -0.16, 0.66, 0.03, 0.42, { rx: -0.32 });
}

export function fireplace(kit, { at, ry = 0, w = 2.6, h = 2.4, mat = 'stonewarm' }) {
  const f = frame(kit, { at, ry });
  const d = 0.75;
  // the jambs, the lintel and its hood up the wall, the hearth stone, the dark firebox
  for (const x of [-w / 2 - 0.25, w / 2 + 0.25]) f.box(mat, x, 0, 0, 0.5, h, d);
  f.box(mat, 0, h, 0, w + 1.0, 0.45, d + 0.12);
  f.box(mat, 0, h + 0.45, -0.1, w + 0.6, 1.4, d - 0.25);
  f.box(mat, 0, h + 1.85, -0.18, w + 0.2, 0.25, d - 0.4);
  f.box('flags', 0, 0, 0.35, w + 1.4, 0.06, d + 0.5);
  // (the firebox’s soot a panel at the back, not a block: a block’s face stood in front of the fire and hid it)
  f.box(kit.paint('#14100c', { rough: 1 }), 0, 0.06, -d / 2 + 0.08, w, h - 0.06, 0.1);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) f.box(kit.paint('#1c1612', { rough: 1 }), x, 0.06, -0.05, 0.1, h - 0.06, d - 0.3);
  // the dogs and the logs
  for (const x of [-w / 3, w / 3]) f.box('iron', x, 0.06, 0.15, 0.06, 0.32, 0.5);
  for (let i = 0; i < 3; i++) f.cyl('board', -w / 4 + (i * w) / 4, 0.24, 0.12, 0.09, 0.09, w * 0.42, { seg: 7, rz: Math.PI / 2, ry: 0.15 * (i - 1) });
  const [x, z] = f.to(0, 0.12);
  return [x, at[1] + 0.3, z];
}

// a pair of great oak doors in their pointed arch, their straps and studs in iron
export function doors(kit, { at, ry = 0, w = 6, h = 8.5, open = 0 }) {
  const f = frame(kit, { at, ry });
  const leaf = w / 2;
  for (const side of [-1, 1]) {
    const swing = open * side * 1.25;
    // (each leaf turned about its hinge at the jamb)
    const hx = side * leaf;
    const cx = hx - side * (leaf / 2) * Math.cos(swing);
    const cz = (leaf / 2) * Math.sin(Math.abs(swing));
    f.box('darkoak', cx, 0, cz, leaf - 0.04, h - 1.2, 0.18, { ry: swing });
    for (const y of [0.9, h / 2 - 0.6, h - 2.3]) f.box('iron', cx, y, cz + 0.1 * Math.cos(swing), leaf - 0.2, 0.12, 0.03, { ry: swing });
  }
  // the arch over them, in dressed stone
  for (const x of [-w / 2 - 0.4, w / 2 + 0.4]) f.box('ashlar', x, 0, 0, 0.8, h - 1.2, 0.9);
  f.box('ashlar', 0, h - 1.2, 0, w + 1.6, 1.4, 0.9);
}

// a tall bookcase against a wall: its sides, its back, its shelves; the books are the room’s, instanced
export function bookcase(kit, { at, ry = 0, w = 2.4, h = 3.2, shelves = 6, mat = 'darkoak' }) {
  const f = frame(kit, { at, ry });
  const d = 0.42;
  for (const x of [-w / 2, w / 2]) f.box(mat, x, 0, 0, 0.06, h, d);
  f.box(mat, 0, 0, -d / 2 + 0.02, w, h, 0.03);
  f.box(mat, 0, h - 0.04, 0, w + 0.12, 0.1, d + 0.06);
  const out = [];
  for (let i = 0; i < shelves; i++) {
    const y = 0.12 + (i * (h - 0.3)) / shelves;
    f.box(mat, 0, y, 0, w - 0.06, 0.035, d - 0.02);
    const [x, z] = f.to(0, 0.02);
    out.push({ at: [x, at[1] + y + 0.035, z], ry, w: w - 0.12, h: (h - 0.3) / shelves - 0.05 });
  }
  return out;
}

// a four-poster with its hangings (the dormitories’ and the common rooms’ beds)
export function bed(kit, { at, ry = 0, hangings = '#7a1c22', len = 2.1, w = 1.2 }) {
  const f = frame(kit, { at, ry });
  f.box('darkoak', 0, 0.25, 0, w, 0.25, len);
  f.box(kit.paint('#e9e1cf', { rough: 0.95 }), 0, 0.5, 0.05, w - 0.08, 0.18, len - 0.12);
  f.box(kit.paint(hangings, { rough: 0.95 }), 0, 0.62, 0.3, w - 0.04, 0.08, len * 0.6);
  f.box(kit.paint('#f2ece0', { rough: 0.95 }), 0, 0.68, -len / 2 + 0.3, w - 0.3, 0.14, 0.4);
  for (const x of [-w / 2, w / 2]) for (const z of [-len / 2, len / 2]) f.box('darkoak', x, 0, z, 0.09, 2.3, 0.09);
  f.box('darkoak', 0, 2.25, 0, w + 0.1, 0.12, len + 0.1);
  // the curtains, drawn back to the posts
  const cloth = kit.paint(hangings, { rough: 0.95, side: THREE.DoubleSide });
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-len / 2 + 0.2, len / 2 - 0.2]) f.box(cloth, x, 0.3, z, 0.08, 1.95, 0.4);
  f.box(cloth, 0, 1.9, 0, w + 0.06, 0.35, len + 0.06);
}

// a round bar from a to b (in the room’s frame), its geometry turned onto the line
export function rod(kit, mat, a, b, r = 0.02, { seg = 6 } = {}) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  if (len < 1e-4) return;
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  g.translate(...a);
  kit.add(mat, g);
}

// iron links from a to b, each turned a quarter to the last, as a chain hangs
export function chain(kit, a, b, { link = 0.07, mat = 'iron' } = {}) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const n = Math.max(2, Math.round(d.length() / link));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  for (let i = 0; i < n; i++) {
    const k = (i + 0.5) / n;
    const g = new THREE.TorusGeometry(link * 0.42, link * 0.1, 4, 8);
    g.scale(0.7, 1, 1);
    g.rotateY(i % 2 ? Math.PI / 2 : 0);
    g.applyQuaternion(q);
    g.translate(a[0] + d.x * k, a[1] + d.y * k, a[2] + d.z * k);
    kit.add(mat, g);
  }
}
