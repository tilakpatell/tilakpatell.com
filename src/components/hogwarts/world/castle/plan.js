// Hogwarts, composed: the castle as a list of parts from the kit (parts.js),
// the site’s own reading of the films’ silhouette, not a copy of anything
// drawn for them. Seen from the lake: the Great Hall’s long steep roof along
// the cliff, the Entrance Hall’s battlements at its east end over the
// lawns, the Grand Staircase’s square tower behind, Gryffindor’s round
// tower beside it, the clock tower with its face and its pendulum on the
// courtyard’s east side, the Headmaster’s tower, the library’s range, and
// highest of everything, at the north-west corner, the Astronomy Tower.
// The viaduct runs out north-east across the ravine to the glen; the
// covered bridge runs west to the stone circle; the boathouse sits at the
// cliff’s foot with its stair up the face; the Owlery stands alone on its
// knoll; the greenhouses below the castle’s south-east corner.
//
// Pure data and pure reads (no three), so the Map, the colliders, the
// doors and a test read the same castle the builder draws.
//
//   PLAN: [{ kind, id, …the part’s spec }] (parts.js’s kinds; `at` [x, z], heights over `base`)
//   BRIDGES: the viaduct’s and the covered bridge’s ends, [x, y, z]
//   CLOCK: the clock tower’s faces and its pendulum’s bay (for the hands and the swing)
//   DOORS: [{ id, place, at: [x, z], y, faces, w, h, leaves, room?, kind: 'room' | 'gate' }]
//   footprints() → [{ id, kind: 'circle', at, r } | { id, kind: 'box', at, w, d, turn }]: what you can’t walk through
//   floors() → [{ id, line: [[x, y, z], …], width }]: what you walk on that isn’t the ground (bridges, stairs)
//   floorAt(floors, x, z, y) → the deck or step under a point near that height, or null

import { CASTLE_FLOOR, placeById } from '../../rules/places';

const F = CASTLE_FLOOR;
const E = Math.PI / 2;
const S = 0;

// the bridges’ ends: the viaduct from its gate on the crag’s north-east
// shoulder over the ravine to the ridge the glen runs down from, the
// covered bridge from the west gate to the stone circle’s knoll
export const BRIDGES = {
  viaduct: { from: [64, F, -115], to: [214, 38.4, -232] },
  covered: { from: [-117, F, -60], to: [-204, 37.4, -80] },
};
const across = ({ from, to }) => Math.atan2(to[0] - from[0], to[2] - from[2]) - Math.PI; // (a gate across the way: its towers either side; it faces along it, away from the castle)

export const CLOCK = { at: [74, -40], w: 13, h: 46, face: { y: 36, r: 4.2, faces: ['right', 'left'] }, bay: { y: 15, w: 5.2, h: 15, faces: ['right'] } };

export const PLAN = [
  // the south range along the cliff: the Great Hall, its two towers at the west end, the Entrance Hall at the east
  { kind: 'hall', id: 'great-hall', at: [-12, 11], len: 70, w: 22, h: 21, roof: { h: 17 }, windows: { n: 7, w: 3.2, h: 12, sill: 5 }, ends: { window: { w: 7, h: 13, sill: 4 } }, dormers: 5 },
  { kind: 'square', id: 'entrance-hall', at: [37, 8], w: 26, d: 30, h: 28, roof: 'battlement', turrets: { r: 2.8, h: 35, cone: 9 }, windows: { rows: [7, 15, 22], per: 3, side: 3, w: 1.6, h: 3.6 } },
  { kind: 'tower', id: 'sw-tower', at: [-55, 6], r: 8, h: 46, roof: 'both', cone: { h: 20 }, windows: { rows: [10, 18, 26, 34, 40], per: 6 } },
  { kind: 'tower', id: 'sw-turret', at: [-61, 26], r: 4.5, h: 32, cone: { h: 13 }, windows: { rows: [12, 22], per: 4 }, tone: 'old' },
  { kind: 'tower', id: 'se-tower', at: [58, 24], r: 6, h: 38, cone: { h: 16 }, windows: { rows: [10, 20, 30], per: 5 }, tone: 'pale' },
  { kind: 'tower', id: 'stair-tower', at: [-14, 34], r: 3.6, h: 20, roof: 'both', cone: { h: 8 }, windows: { rows: [8, 14], per: 3, w: 0.8, h: 1.8 }, tone: 'old' },
  { kind: 'wall', id: 'terrace', from: [-58, 33], to: [-18, 36], h: 1.3, thick: 0.7, battlement: false },
  { kind: 'wall', id: 'terrace-east', from: [-10, 36], to: [50, 38], h: 1.3, thick: 0.7, battlement: false },
  // the middle: the Grand Staircase’s tower, Gryffindor’s, the west wing, Ravenclaw’s
  { kind: 'square', id: 'grand-staircase', at: [2, -24], w: 22, h: 62, roof: 'both', spire: 16, turrets: { r: 2.4, h: 68, cone: 8 }, windows: { rows: [10, 20, 30, 40, 50], per: 3, w: 1.4, h: 3.2 } },
  { kind: 'tower', id: 'gryffindor', at: [-34, -22], r: 7, h: 64, cone: { h: 22 }, windows: { rows: [12, 22, 32, 42, 52, 58], per: 5 } },
  { kind: 'square', id: 'west-wing', at: [-74, -12], w: 26, d: 20, h: 24, roof: 'gable', ridge: 9, windows: { rows: [6, 14], per: 4, side: 3, w: 1.3, h: 2.8 }, tone: 'old' },
  { kind: 'tower', id: 'ravenclaw', at: [-94, -32], r: 7.5, h: 56, roof: 'both', cone: { h: 18 }, windows: { rows: [14, 26, 38, 48], per: 6 }, tone: 'pale' },
  // the north: the library’s range, the Astronomy Tower at the corner, the Defence tower, the north range, the Headmaster’s tower
  { kind: 'square', id: 'library', at: [-40, -60], w: 48, d: 18, h: 24, roof: 'gable', ridge: 9, windows: { rows: [7, 15], per: 6, side: 2, w: 1.5, h: 4.2 } },
  { kind: 'tower', id: 'astronomy', at: [-82, -86], r: 8.5, h: 84, roof: 'both', cone: { h: 24 }, windows: { rows: [14, 28, 42, 56, 70, 78], per: 4 } },
  { kind: 'square', id: 'defence', at: [-38, -96], w: 13, h: 46, roof: 'pyramid', spire: 15, windows: { rows: [10, 22, 34], per: 2 }, tone: 'old' },
  { kind: 'square', id: 'north-range', at: [-4, -100], w: 30, d: 16, h: 22, roof: 'gable', ridge: 8, windows: { rows: [6, 13], per: 5, side: 2 } },
  { kind: 'tower', id: 'headmaster', at: [26, -80], r: 6.5, h: 54, cone: { h: 20 }, windows: { rows: [12, 24, 36, 46], per: 5 }, tone: 'pale' },
  // the courtyard: the clock tower on its east side, the fountain in its middle
  { kind: 'square', id: 'clock-tower', at: CLOCK.at, w: CLOCK.w, h: CLOCK.h, roof: 'pyramid', spire: 14, windows: { rows: [7, 40], per: 1 }, clock: CLOCK.face, bay: CLOCK.bay },
  { kind: 'fountain', id: 'fountain', at: [44, -52], r: 4.2 },
  // the skyline’s turrets
  { kind: 'tower', id: 'turret-a', at: [-18, -44], r: 3.2, h: 44, cone: { h: 11 }, windows: { rows: [20, 32], per: 3, w: 0.8, h: 1.8 } },
  { kind: 'tower', id: 'turret-b', at: [16, -44], r: 2.8, h: 38, cone: { h: 9 }, windows: { rows: [26], per: 3, w: 0.8, h: 1.8 } },
  { kind: 'tower', id: 'turret-c', at: [-64, -50], r: 4, h: 50, cone: { h: 14 }, windows: { rows: [18, 30, 42], per: 3 }, tone: 'old' },
  { kind: 'tower', id: 'turret-d', at: [-104, -10], r: 3.5, h: 34, cone: { h: 11 }, windows: { rows: [16, 26], per: 3 } },
  { kind: 'tower', id: 'turret-e', at: [46, -86], r: 3, h: 36, cone: { h: 10 }, windows: { rows: [22, 30], per: 3, w: 0.8, h: 1.8 } },
  { kind: 'tower', id: 'turret-f', at: [-20, -114], r: 3.6, h: 42, cone: { h: 12 }, windows: { rows: [18, 32], per: 3 } },
  { kind: 'tower', id: 'turret-g', at: [90, -64], r: 3, h: 30, cone: { h: 9 }, windows: { rows: [18], per: 3, w: 0.8, h: 1.8 }, tone: 'pale' },
  // the curtain walls between them
  { kind: 'wall', id: 'wall-west', from: [-62, -2], to: [-88, -24], h: 16 },
  { kind: 'wall', id: 'wall-bridge', from: [-98, -40], to: [-110, -54], h: 14 },
  { kind: 'wall', id: 'wall-astronomy', from: [-112, -64], to: [-88, -80], h: 16 },
  { kind: 'wall', id: 'wall-north', from: [-74, -92], to: [-45, -97], h: 15 },
  { kind: 'wall', id: 'wall-north-east', from: [11, -98], to: [21, -86], h: 14 },
  { kind: 'wall', id: 'wall-to-viaduct', from: [32, -84], to: [56, -108], h: 14 },
  { kind: 'wall', id: 'wall-east', from: [70, -110], to: [82, -48], h: 14 },
  // the gates and the bridges
  { kind: 'gatehouse', id: 'viaduct-gate', at: [BRIDGES.viaduct.from[0] - 3, BRIDGES.viaduct.from[2] + 2.3], turn: across(BRIDGES.viaduct), gap: 5.4, h: 16, arch: 8 },
  { kind: 'viaduct', id: 'viaduct', from: BRIDGES.viaduct.from, to: BRIDGES.viaduct.to, width: 5.4, span: 13 },
  { kind: 'gatehouse', id: 'bridge-gate', at: [BRIDGES.covered.from[0] + 3, BRIDGES.covered.from[2] + 0.7], turn: across(BRIDGES.covered), gap: 4.2, h: 14, arch: 6 },
  { kind: 'covered', id: 'covered-bridge', from: BRIDGES.covered.from, to: BRIDGES.covered.to, width: 3.6, height: 3.2 },
  // the boathouse under the cliff and its stair up the face
  { kind: 'boathouse', id: 'boathouse', at: [-25, 55], len: 14, w: 9, h: 6, turn: -E, base: 1.2, jetty: 10 },
  {
    kind: 'stair',
    id: 'boathouse-stair',
    width: 2.4,
    open: 1,
    points: [
      [-22, 1.2, 48],
      [-3, 12, 47],
      [-3, 12, 45.2],
      [-22, 23, 44],
      [-22, 23, 42.2],
      [-4, 34, 41],
      [-4, 34, 39.2],
      [-14, F, 37.5],
    ],
  },
  // the Owlery on its knoll
  { kind: 'tower', id: 'owlery', at: [-30, -268], base: 50, r: 5.5, h: 20, cone: { h: 9, flare: 1.15 }, windows: { rows: [13, 16.5], per: 8, w: 1, h: 2.2, voids: true }, stone: 'rubble', tone: 'old' },
  // the greenhouses below the south-east corner, in a row, their doors to the castle
  { kind: 'glasshouse', id: 'greenhouse-1', at: [128, 41], len: 24, w: 10, turn: -E },
  { kind: 'glasshouse', id: 'greenhouse-3', at: [150, 41], len: 24, w: 10, turn: -E },
  { kind: 'glasshouse', id: 'greenhouse-5', at: [172, 41], len: 24, w: 10, turn: -E },
];

// the doors that open (doors.js): where each stands, which way it faces
// (yaw from +z), its size and its leaves, and what is through it
const door = (id, o) => ({ id, place: o.place ?? id, at: o.at, y: o.y ?? F, faces: o.faces, w: o.w, h: o.h, leaves: o.leaves ?? 2, room: o.room ?? null, kind: o.room ? 'room' : 'gate' });
export const DOORS = [
  door('great-doors', { at: [50.2, 8], faces: E, w: 5, h: 9, room: 'greatHall' }),
  door('courtyard-door', { at: [13.2, -24], faces: E, w: 3.2, h: 5.6, room: 'staircase' }),
  door('viaduct-gate', { at: [BRIDGES.viaduct.from[0] - 3, BRIDGES.viaduct.from[2] + 2.3], faces: across(BRIDGES.viaduct) + Math.PI, w: 5.2, h: 7.4 }),
  door('bridge-gate', { at: [BRIDGES.covered.from[0] + 3, BRIDGES.covered.from[2] + 0.7], faces: across(BRIDGES.covered) + Math.PI, w: 4, h: 5.6 }),
  door('boathouse', { at: [-25, 47.4], y: 1.2, faces: Math.PI, w: 2, h: 3, leaves: 1, room: 'boathouse' }),
  door('owlery', { at: [-30, -262.4], y: 50, faces: S, w: 1.6, h: 3, leaves: 1, room: 'owlery' }),
  door('greenhouse-door', { at: [150, 29], y: null, faces: Math.PI, w: 1.8, h: 2.6 }),
].map((d) => ({ ...d, name: placeById(d.place)?.door ?? d.id }));

// What a figure walks into: each standing part’s outline on the ground
export function footprints(plan = PLAN) {
  const out = [];
  for (const p of plan) {
    if (p.kind === 'tower') out.push({ id: p.id, kind: 'circle', at: p.at, r: p.r + 0.3 });
    else if (p.kind === 'square') {
      out.push({ id: p.id, kind: 'box', at: p.at, w: p.w, d: p.d ?? p.w, turn: p.turn ?? 0 });
      if (p.turrets) {
        const c = Math.cos(p.turn ?? 0);
        const s = Math.sin(p.turn ?? 0);
        const d = p.d ?? p.w;
        for (const [u, v] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) out.push({ id: `${p.id}:turret`, kind: 'circle', at: [p.at[0] + ((u * p.w) / 2) * c + ((v * d) / 2) * s, p.at[1] - ((u * p.w) / 2) * s + ((v * d) / 2) * c], r: (p.turrets.r ?? 2.4) + 0.3 });
      }
    } else if (p.kind === 'hall') out.push({ id: p.id, kind: 'box', at: p.at, w: p.len + 3, d: p.w + 3, turn: p.turn ?? 0 });
    else if (p.kind === 'wall') {
      const L = Math.hypot(p.to[0] - p.from[0], p.to[1] - p.from[1]);
      out.push({ id: p.id, kind: 'box', at: [(p.from[0] + p.to[0]) / 2, (p.from[1] + p.to[1]) / 2], w: L, d: p.thick ?? 2.2, turn: Math.atan2(p.to[0] - p.from[0], p.to[1] - p.from[1]) - Math.PI / 2 });
    } else if (p.kind === 'gatehouse') {
      const c = Math.cos(p.turn ?? 0);
      const s = Math.sin(p.turn ?? 0);
      for (const side of [1, -1]) {
        const u = side * ((p.gap ?? 5) / 2 + 2.6);
        out.push({ id: `${p.id}:tower`, kind: 'circle', at: [p.at[0] + u * c, p.at[1] - u * s], r: 3.1 });
      }
    } else if (p.kind === 'glasshouse' || p.kind === 'boathouse') out.push({ id: p.id, kind: 'box', at: p.at, w: p.len, d: p.w, turn: p.turn ?? 0 });
    else if (p.kind === 'fountain') out.push({ id: p.id, kind: 'circle', at: p.at, r: (p.r ?? 4) + 0.2 });
  }
  return out;
}

// What a figure walks on that isn’t the ground: the bridges’ decks and the stair’s flights
export function floors(plan = PLAN) {
  const out = [];
  for (const p of plan) {
    if (p.kind === 'viaduct') out.push({ id: p.id, line: [p.from, p.to], width: (p.width ?? 5) - 0.8 });
    else if (p.kind === 'stair') out.push({ id: p.id, line: p.points, width: (p.width ?? 2.4) - 0.2 });
  }
  out.push({ id: 'covered-bridge', line: [BRIDGES.covered.from, BRIDGES.covered.to], width: 3 });
  return out;
}

export const partById = (id) => PLAN.find((p) => p.id === id) ?? null;

// The floor under a point at about height `y`: the deck or the stair whose
// line passes over it (within its width) nearest that height, or null. A
// figure on the viaduct walks its deck, one under it walks the ravine.
export function floorAt(list, x, z, y, { above = 1.2, below = 3 } = {}) {
  let best = null;
  let bestGap = Infinity;
  for (const f of list)
    for (let i = 1; i < f.line.length; i++) {
      const [ax, ay, az] = f.line[i - 1];
      const [bx, by, bz] = f.line[i];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      if (l2 < 1e-6) continue;
      const t = ((x - ax) * dx + (z - az) * dz) / l2;
      if (t < 0 || t > 1) continue;
      const off = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (off > f.width / 2) continue;
      const h = ay + (by - ay) * t;
      if (h > y + above || h < y - below) continue;
      const gap = Math.abs(h - y);
      if (gap < bestGap) {
        bestGap = gap;
        best = h;
      }
    }
  return best;
}
