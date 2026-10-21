// The Great Hall’s plan (the design’s §4.4), in metres in the hall’s own
// frame: the floor’s middle at the origin, +z toward the great doors, −z
// toward the dais and the staff table, +x on your right as you walk in.
// Pure data, so the room (../greatHall.js) and its tests read the same
// numbers: where the four tables run, where everyone sits, where the
// candles may float, what the walk may not walk through.
//
//   HALL: the room’s sizes
//   TABLES: [{ house, x }] in order from the doors’ left
//   hallPlan({ tier }) → { bounds, floorAt(x, z), tables, benches, seats,
//     staff, colliders, doors, places, hourglasses, windows, banners,
//     candles: { count, box }, trees, start, lectern, stool, fire }

export const HALL = {
  length: 56, // m, the doors to the back wall
  width: 20,
  wall: 13, // m to where the vault springs
  peak: 21, // m to the vault’s crown
  dais: { z: -21, height: 0.9, steps: 3 }, // the dais from z −28 to −21
  table: { length: 38, width: 1.1, top: 0.78, from: -18 },
  bench: { off: 0.95, width: 0.36, top: 0.46 },
  seat: 0.62, // m of bench a student takes
  doors: { width: 6, height: 8.5 },
};

const HALF_W = HALL.width / 2;
const HALF_L = HALL.length / 2;

// left to right from the doors: the rivals apart, against the two long walls
export const TABLES = [
  { house: 'gryffindor', x: -6.6 },
  { house: 'hufflepuff', x: -2.2 },
  { house: 'ravenclaw', x: 2.2 },
  { house: 'slytherin', x: 6.6 },
];

// the staff, left to right along the high table as the hall sees it; the
// Headmaster’s gold chair in the middle
export const STAFF = ['sprout', 'flitwick', 'snape', 'dumbledore', 'mcgonagall', 'hagrid', 'hooch', 'pince'];

const CANDLES = { low: 100, mid: 220, high: 420, ultra: 520 };

export function hallPlan({ tier = 'high' } = {}) {
  const { dais, table, bench } = HALL;
  const z0 = table.from;
  const z1 = table.from + table.length;
  const tables = TABLES.map((t) => ({ ...t, z0, z1 }));
  const benches = tables.flatMap((t) => [-1, 1].map((side) => ({ house: t.house, x: t.x + side * bench.off, z0, z1, side })));
  // a place every HALL.seat metres along each bench, facing the table
  const seats = [];
  for (const b of benches) {
    const n = Math.floor((b.z1 - b.z0 - 0.6) / HALL.seat);
    for (let i = 0; i < n; i++) seats.push({ house: b.house, at: [b.x, bench.top, b.z0 + 0.3 + (i + 0.5) * HALL.seat], yaw: b.side < 0 ? Math.PI / 2 : -Math.PI / 2, side: b.side, i });
  }
  const staffZ = -24.6;
  const staff = STAFF.map((who, i) => ({ who, at: [(i - (STAFF.length - 1) / 2) * 1.9, dais.height + 0.46, staffZ - 0.75], yaw: 0, gold: who === 'dumbledore' }));
  // the dais’ steps: from the floor at z −19.8 up to the dais at −21
  const stepRun = 1.2;
  const floorAt = (x, z) => {
    if (z <= dais.z) return dais.height;
    if (z < dais.z + stepRun && Math.abs(x) < HALF_W) return dais.height * (1 - Math.ceil(((z - dais.z) / stepRun) * dais.steps) / dais.steps);
    return 0;
  };
  // the walk goes round the tables and their benches, the staff table, the lectern and the hourglasses
  const colliders = [];
  for (const t of tables) for (let z = z0; z <= z1 + 1e-6; z += 0.8) colliders.push({ at: [t.x, z], r: 1.12 });
  for (let x = -8.2; x <= 8.2 + 1e-6; x += 0.8) colliders.push({ at: [x, staffZ], r: 0.9 });
  const lectern = { at: [0, dais.height, dais.z - 0.7] };
  colliders.push({ at: [lectern.at[0], lectern.at[2]], r: 0.6 });
  const hourglasses = ['gryffindor', 'slytherin', 'ravenclaw', 'hufflepuff'].map((house, i) => ({ house, at: [[-8.6, -6.4, 6.4, 8.6][i], 0, HALF_L - 1.6] }));
  for (const h of hourglasses) colliders.push({ at: [h.at[0], h.at[2]], r: 0.95 });
  // a great fireplace in each long wall below the dais, past the tables’
  // ends, so the outer aisles run clear beside them
  const fire = [
    { at: [HALF_W - 0.45, 0, -19.6], yaw: -Math.PI / 2 },
    { at: [-HALF_W + 0.45, 0, -19.6], yaw: Math.PI / 2 },
  ];
  for (const f of fire) colliders.push({ at: [f.at[0], f.at[2]], r: 0.7 });
  // tall windows along both long walls, six a side; the great window behind the staff
  const windows = [];
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) windows.push({ x: side * HALF_W, z: -9 + i * 6.4, y: 4.2, w: 2.6, h: 8.2, side });
  const great = { x: 0, z: -HALF_L, y: 3.6, w: 8, h: 11.5 };
  // three banners over each table, high under the vault
  const banners = tables.flatMap((t) => [-9, 3, 15].map((z) => ({ house: t.house, at: [t.x, HALL.wall + 3.4, z], w: 1.7, h: 5.2 })));
  const doors = [{ id: 'out', at: [0, HALF_L - 0.6], r: 2.6, to: 'out', name: 'The Entrance Hall', faces: 0 }];
  const places = [
    { id: 'high-table', name: 'The high table', at: [0, staffZ], r: 6 },
    ...tables.map((t) => ({ id: `${t.house}-table`, name: `The ${t.house[0].toUpperCase()}${t.house.slice(1)} table`, at: [t.x, 0], r: 3 })),
    { id: 'hourglasses', name: 'The house points', at: [0, HALF_L - 1.6], r: 5 },
  ];
  // the twelve trees at Christmas: six a long wall, between the windows
  const trees = [];
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) trees.push({ at: [side * (HALF_W - 1.4), 0, -12.2 + i * 6.4], s: 1 + ((i * 7 + (side > 0 ? 3 : 0)) % 5) * 0.06 });
  return {
    bounds: { x0: -HALF_W + 0.4, x1: HALF_W - 0.4, z0: -HALF_L + 0.4, z1: HALF_L - 0.4 },
    floorAt,
    tables,
    benches,
    seats,
    staff,
    staffZ,
    colliders,
    doors,
    places,
    hourglasses,
    windows,
    great,
    banners,
    candles: { count: CANDLES[tier] ?? CANDLES.high, box: { x: [-HALF_W + 1.2, HALF_W - 1.2], y: [5.6, 10.8], z: [-HALF_L + 2, HALF_L - 3] } },
    trees,
    lectern,
    stool: { at: [0, 0, dais.z + 2.4] },
    fire,
    start: { at: [0, HALF_L - 3], yaw: 0 },
  };
}
