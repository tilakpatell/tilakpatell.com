// Hogwarts, laid out: where the hero castle (castle/hero.js: Jzax’s voxel
// Hogwarts, its plan the films’) has its parts, its bridges, its stair and
// its doors, in the world’s frame, and what the walk can’t pass and walks
// on. Seen from the lake: the boathouse at the water under its hill, the
// zig-zag stair up the hill to the gatehouse, the Great Hall’s long roof
// along the cliff to the west, the Astronomy Tower highest by it, the
// courtyards and the clock tower to the east over the greenhouses’ terrace,
// the viaduct out south-east over the gorge to its knoll by the shore, the
// wooden bridge north from the north wing over the gorge to the stone
// circle, and the Owlery on its rock beside it.
//
// Pure data and pure reads (no three), so the Map, the colliders, the doors
// and a test read the same castle the builder draws.
//
//   PLAN: [{ kind, id, at: [x, z], y, …the line of a bridge or a stair }]: the castle’s named parts
//   BRIDGES: the viaduct’s and the covered bridge’s ends, [x, y, z]
//   CLOCK: the clock tower: { at: [x, z], y } (its face is the model’s)
//   DOORS: [{ id, place, at: [x, z], y, faces, w, h, leaves, room?, kind: 'room' | 'gate' }]
//   footprints() → [{ id, kind: 'box', at, w, d, turn }]: what you can’t walk through (the
//     castle’s ground where it has no floor: its halls and its walls)
//   floors() → [{ id, line: [[x, y, z], …], width }]: what you walk on that isn’t the ground (bridges, stairs)
//   floorAt(floors, x, z, y) → the deck or step under a point near that height, or null

import { CASTLE_FLOOR, placeById } from '../../rules/places';
import { SOLIDS, at, toWorld } from './hero';

const E = Math.PI / 2;
const N = Math.PI;
const S = 0;
const xz = (p) => [p[0], p[2]];

export const BRIDGES = {
  viaduct: { from: at('viaductFrom'), to: at('viaductTo') },
  covered: { from: at('bridgeFrom'), to: at('bridgeTo') },
};

export const CLOCK = { at: xz(at('clockTower')), y: CASTLE_FLOOR };

// The boathouse stair, up its hill in zig-zags from the boathouse to the
// gatehouse (read off the cut’s plan, in its frame: [x, z]), its height
// rising evenly along it
const STAIR = [[-83, 178], [-84, 168], [-72, 160], [-73, 150], [-92, 142], [-92, 128], [-73, 118], [-73, 104], [-93, 96], [-96, 84]];
const stairLine = (() => {
  const [y0, y1] = [at('stairFoot')[1], at('stairTop')[1]];
  let total = 0;
  const run = [0];
  for (let i = 1; i < STAIR.length; i++) run.push((total += Math.hypot(STAIR[i][0] - STAIR[i - 1][0], STAIR[i][1] - STAIR[i - 1][1])));
  return STAIR.map(([x, z], i) => {
    const [wx, , wz] = toWorld([x, 0, z]);
    return [wx, y0 + ((y1 - y0) * run[i]) / total, wz];
  });
})();

export const PLAN = [
  { kind: 'hall', id: 'great-hall', at: xz(at('greatHall')), y: CASTLE_FLOOR },
  // (the model’s tallest point, its cone’s tip)
  { kind: 'tower', id: 'astronomy', at: xz(at('astronomy')), y: CASTLE_FLOOR, top: toWorld([0, 156, 0])[1] },
  { kind: 'square', id: 'grand-staircase', at: xz(at('staircase')), y: CASTLE_FLOOR },
  { kind: 'court', id: 'courtyard', at: xz(at('courtyard')), y: CASTLE_FLOOR },
  { kind: 'square', id: 'clock-tower', at: CLOCK.at, y: CASTLE_FLOOR },
  { kind: 'gatehouse', id: 'gatehouse', at: xz(at('greatDoors')), y: CASTLE_FLOOR },
  { kind: 'viaduct', id: 'viaduct', from: BRIDGES.viaduct.from, to: BRIDGES.viaduct.to, width: 5.4 },
  { kind: 'covered', id: 'covered-bridge', from: BRIDGES.covered.from, to: BRIDGES.covered.to, width: 3.6 },
  { kind: 'stair', id: 'boathouse-stair', points: stairLine, width: 2.4 },
  { kind: 'boathouse', id: 'boathouse', at: xz(at('boathouse')), y: at('boathouse')[1] },
  { kind: 'tower', id: 'owlery', at: xz(at('owlery')), y: at('owlery')[1] },
];

// the doors that open (doors.js): where each stands, which way it faces
// (yaw from +z), its size and its leaves, and what is through it
const door = (id, o) => ({ id, place: o.place ?? id, at: o.at, y: o.y === undefined ? CASTLE_FLOOR : o.y, faces: o.faces, w: o.w, h: o.h, leaves: o.leaves ?? 2, room: o.room ?? null, kind: o.room ? 'room' : 'gate' });
const along = ({ from, to }) => Math.atan2(to[0] - from[0], to[2] - from[2]);
export const DOORS = [
  door('great-doors', { at: placeById('great-doors').at, faces: S, w: 5, h: 9, room: 'greatHall' }),
  door('courtyard-door', { at: placeById('courtyard-door').at, faces: E, w: 3.2, h: 5.6, room: 'staircase' }),
  door('viaduct-gate', { at: xz(BRIDGES.viaduct.from), y: BRIDGES.viaduct.from[1], faces: along(BRIDGES.viaduct), w: 5.2, h: 7.4 }),
  door('bridge-gate', { at: xz(BRIDGES.covered.from), y: BRIDGES.covered.from[1], faces: N, w: 4, h: 5.6 }),
  door('boathouse', { at: placeById('boathouse').at, y: 1.2, faces: N, w: 2, h: 3, leaves: 1, room: 'boathouse' }),
  door('owlery', { at: placeById('owlery').at, y: at('owlery')[1], faces: S, w: 1.6, h: 3, leaves: 1, room: 'owlery' }),
  door('greenhouse-door', { at: placeById('greenhouse-door').at, y: null, faces: N, w: 1.8, h: 2.6 }),
].map((d) => ({ ...d, name: placeById(d.place)?.door ?? d.id }));

// What a figure walks into: the castle’s ground where it has no floor (its
// halls, its towers, its walls), each a box, the doors’ ways in kept clear
export function footprints() {
  const clear = DOORS.map((d) => ({ at: d.at, r: Math.max(d.w, 3) }));
  return SOLIDS.filter((b) => !clear.some((c) => Math.hypot(b.at[0] - c.at[0], b.at[1] - c.at[1]) < c.r)).map((b, i) => ({ id: `castle-${i}`, kind: 'box', at: b.at, w: b.w, d: b.d, turn: 0 }));
}

// What the walk stands on that isn’t the ground: the viaduct’s deck, the
// wooden bridge’s, the boathouse stair
export function floors(plan = PLAN) {
  const out = [];
  for (const p of plan) {
    if (p.kind === 'viaduct' || p.kind === 'covered') out.push({ id: p.id, line: [p.from, p.to], width: (p.width ?? 5) - 0.8 });
    else if (p.kind === 'stair') out.push({ id: p.id, line: p.points, width: (p.width ?? 2.4) - 0.2 });
  }
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
