// Dunder Mifflin Scranton, the world: the floor you walk about as Jim, laid
// out from the same plan as the 2D map and the 3D model on the page
// (../layout.js), with what a walk needs added to it: doorways into every
// room, the lobby and its lift, the stairwell, the supply room, and where
// each thing to do is. Pure data and a few helpers, no drawing.
//
// Metres, +x east, +z south, the floor at y 0. Plan units (3.2 cm) are
// turned into metres by `P`, as the 3D model on the page does.

import { CONFERENCE_TABLE, DESKS, GLASS, KITCHEN_COUNTER, KITCHEN_TABLE, BREAK_TABLES, RECEPTION_BOX, PLAN, WALLS_INNER, WALLS_INNER_2, WALLS_OUTER, segments, toWorld, wallRuns } from '../layout';

export const U = PLAN.metres;
export const P = (px, py) => toWorld(px, py);
export const CEILING = 2.75;

// Every doorway on the floor (plan units: a run along the wall it's cut
// from). The set's own: the suite's door off the lobby, the kitchen
// hallway's two ends. Added for walking: Michael's office and the
// conference room (in their glass fronts), Darryl's office, the break room,
// the supply room, both restrooms, Ryan's closet and the stairwell.
const DOORWAYS = [
  'M142 40 V70', // the suite, from the lobby
  'M514 200 V228', // the bullpen to the kitchen hallway
  'M739 200 V228', // the hallway to the annex
  'M300 127 H322', // Michael's office
  'M328 127 H352', // the conference room
  'M480 288 H504', // Darryl's office
  'M870 141 H896', // the break room
  'M250 384 H276', // the supply room
  'M530 252 H554', // the men's room
  'M700 252 H724', // the women's room
  'M590 252 H612', // Ryan's closet
  'M690 175 H716', // the stairwell
].join(' ');

// the lobby round the lift, outside the suite's door
const LOBBY_WALLS = 'M142 12 H14 V89 H142';

const ALL_WALLS = `${WALLS_OUTER} ${WALLS_INNER} ${WALLS_INNER_2} ${LOBBY_WALLS}`;

// Wall runs as metres: [x0, z0, x1, z1].
const toRuns = (runs) =>
  runs.map(([x0, y0, x1, y1]) => {
    const a = P(x0, y0);
    const b = P(x1, y1);
    return [a.x, a.z, b.x, b.z];
  });

// What's drawn: solid walls (the glass fronts cut out of them), and the glass.
export const SOLID = toRuns(wallRuns(ALL_WALLS, `${DOORWAYS} ${GLASS}`));
export const PANES = toRuns(wallRuns(GLASS, DOORWAYS));
// What stops a walk: walls and glass alike, the doorways open.
export const WALLS = toRuns(wallRuns(`${ALL_WALLS} ${GLASS}`, DOORWAYS)).map((r) => [...r, 0.1]);
// the doorways themselves, for drawing their frames and doors
export const DOORS = segments(DOORWAYS).map(([x0, y0, x1, y1]) => {
  const a = P(x0, y0);
  const b = P(x1, y1);
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, w: Math.hypot(b.x - a.x, b.z - a.z), along: y0 === y1 ? 'x' : 'z' };
});

// ── the floor's rooms (plan rectangles), for floors, ceilings and the map ──
export const ROOMS = {
  bullpen: { x: 142, y: 12, w: 372, h: 364 }, // (the entry by reception too; the rooms off it are smaller, so they win)
  michael: { x: 206, y: 12, w: 118, h: 115 },
  conference: { x: 324, y: 12, w: 190, h: 115 },
  hallway: { x: 514, y: 175, w: 225, h: 77 },
  men: { x: 514, y: 252, w: 114, h: 124 },
  women: { x: 628, y: 252, w: 111, h: 124 },
  closet: { x: 566, y: 252, w: 62, h: 48 },
  stairs: { x: 552, y: 12, w: 187, h: 163 },
  annex: { x: 739, y: 12, w: 187, h: 364 },
  breakroom: { x: 806, y: 12, w: 120, h: 129 },
  darryl: { x: 406, y: 288, w: 108, h: 88 },
  supplies: { x: 161, y: 384, w: 137, h: 125 },
  lobby: { x: 14, y: 12, w: 128, h: 77 },
};
export const rect = (r) => {
  const a = P(r.x, r.y);
  return { x: a.x, z: a.z, w: r.w * U, d: r.h * U, cx: a.x + (r.w * U) / 2, cz: a.z + (r.h * U) / 2 };
};
// which room a point is in (the smallest that holds it)
export function roomAt(x, z) {
  if (x >= 30 && x <= 54 && z >= -8 && z <= 8) return 'warehouse'; // (WAREHOUSE, below)
  if (x > 54 && x <= 88 && z >= -16 && z <= 16) return 'lot'; // (LOT, below)
  let best = null;
  for (const [id, r] of Object.entries(ROOMS)) {
    const m = rect(r);
    if (x >= m.x && x <= m.x + m.w && z >= m.z && z <= m.z + m.d && (!best || m.w * m.d < best.a)) best = { id, a: m.w * m.d };
  }
  return best?.id ?? null;
}

// ── desks: where each is, its chair, and who sits in it ──
// (as the page's 3D model sets them: the desk turned to face its chair's
// side, the chair pulled up 0.34 m from the front edge)
const SEAT_TURN = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
export const SEATS = DESKS.map((d, i) => {
  const [x, y, dw, dh] = d.at;
  const c = P(x + dw / 2, y + dh / 2);
  const across = d.seat === 'n' || d.seat === 's';
  const width = (across ? dw : dh) * U;
  const depth = (across ? dh : dw) * U;
  const turn = SEAT_TURN[d.seat];
  // the chair, in the desk's frame (0.1, front + 0.34), turned with it
  const lx = 0.1;
  const lz = depth / 2 + 0.34;
  const chair = { x: c.x + lx * Math.cos(turn) + lz * Math.sin(turn), z: c.z - lx * Math.sin(turn) + lz * Math.cos(turn) };
  return { i, who: d.who, exec: !!d.exec, x: c.x, z: c.z, turn, width, depth, chair, box: { kind: 'box', x: c.x, z: c.z, w: dw * U, d: dh * U, turn: 0, low: true } };
});
export const seatOf = (who) => SEATS.find((s) => s.who === who) ?? null;

// reception: Erin's chair inside the counter's L
export const RECEPTION = (() => {
  const r = RECEPTION_BOX;
  const c = P(r.x + r.w * 0.55, r.y + r.h * 0.62);
  const chair = P(r.x + r.w * 0.36, r.y + r.h * 0.74);
  return { x: c.x, z: c.z, chair, face: Math.atan2(c.x - chair.x, c.z - chair.z) };
})();

// ── furniture that's in the way (metres) ──
const box = (px, py, pw, ph, extra = {}) => {
  const a = P(px, py);
  return { kind: 'box', x: a.x + (pw * U) / 2, z: a.z + (ph * U) / 2, w: pw * U, d: ph * U, turn: 0, ...extra };
};
const circle = (px, py, r, extra = {}) => {
  const a = P(px, py);
  return { kind: 'circle', x: a.x, z: a.z, r, ...extra };
};

export const FRIDGE = box(582, 177, 22, 17, { top: 1.8 });
export const COPIER = box(474, 132, 30, 18, { top: 1.2 });
export const COOLER = circle(152, 112, 0.2, { top: 1.3 });
export const VENDING = [box(809, 18, 20, 26, { top: 1.85 }), box(809, 48, 20, 26, { top: 1.85 })];
export const FILES = [box(505, 236, 9, 46, { top: 1.3 }), box(150, 245, 11, 32, { top: 1.3 }), box(906, 150, 20, 14, { top: 1.3 })];
export const SHELVES = [box(163, 488, 133, 18, { top: 2.1 }), box(163, 400, 14, 82, { top: 2.1 }), box(282, 400, 14, 82, { top: 2.1 })];
export const PLANTS = [circle(150, 22, 0.28), circle(212, 140, 0.28), circle(918, 368, 0.28), circle(744, 168, 0.28), circle(318, 20, 0.24)];
const MICHAEL_CHAIRS = [circle(256, 92, 0.3), circle(290, 92, 0.3)];
const CABINET = box(208, 64, 14, 44, { top: 1.1 }); // Michael's credenza, his Dundies on it
export const TABLE = (() => {
  const t = CONFERENCE_TABLE;
  return box(t.x, t.y, t.w, t.h, { low: true });
})();
const COUNTER = box(KITCHEN_COUNTER.x, KITCHEN_COUNTER.y, KITCHEN_COUNTER.w, KITCHEN_COUNTER.h, { low: true });
const KTABLE = circle(KITCHEN_TABLE.x, KITCHEN_TABLE.y, KITCHEN_TABLE.r * U + 0.05, { low: true });
const BTABLES = BREAK_TABLES.map(([x, y]) => circle(x, y, 0.5, { low: true }));
// the reception counter: its L, as two boxes
const RECEPTION_COUNTER = [box(162, 178, 52, 14, { low: true }), box(200, 178, 14, 42, { low: true })];
// the stairs going down in the stairwell, and its rail
export const STAIRWELL = { ...rect(ROOMS.stairs), flight: box(565, 24, 112, 60, { low: true }) };

// ── the warehouse, downstairs: its own floor east of the office, reached by
// the stairwell (metres) ──
export const WAREHOUSE = { x: 30, z: -8, w: 24, d: 16 };
export const WH_STAIRS = { x: 32.2, z: -5.6 }; // the foot of the stairs up
export const HOOP = { x: 30.75, y: 3.05, z: 4, line: 4.2 }; // the rim, and the free-throw line's distance from it
export const RACKS = [
  { x: 44.5, z: -7.25, w: 15, d: 1.1 },
  { x: 44, z: -3.6, w: 14, d: 2.2 },
  { x: 44, z: 3.8, w: 14, d: 2.2 },
  { x: 45, z: 7.25, w: 13, d: 1.1 },
];
export const BALES = [
  { x: 52.4, z: 6.5, w: 1.1, d: 1.1 },
  { x: 52.4, z: -6.5, w: 1.1, d: 1.1 },
  { x: 47.6, z: 0.9, w: 1.1, d: 1.1 },
  { x: 35.2, z: -1.4, w: 1.1, d: 1.1 },
];
export const FORKLIFT = { x: 50.6, z: 0.2, turn: -Math.PI / 2 + 0.35 };
// the warehouse floor's odds and ends: empty pallets stacked by the dock,
// a pallet jack in the aisle, bollards at the dock doors, cones, the
// workbench under the accident sign, a trash barrel by the stairs
export const WH_PROPS = {
  pallets: { x: 53.0, z: -0.9, w: 1.2, d: 1.0, turn: 0.1 },
  jack: { x: 40.6, z: 1.5, turn: 0.15 },
  bollards: [
    [53.35, 1.65],
    [53.35, 5.35],
    [53.35, -1.65],
    [53.35, -5.35],
  ],
  cones: [
    [46.3, -0.7],
    [46.75, -1.25],
  ],
  bench: { x: 35.0, z: -7.55, w: 2.6, d: 0.7 },
  barrel: { x: 33.5, z: -3.6, r: 0.3 },
};
const WH_COLLIDERS = [
  ...RACKS.map((r) => ({ kind: 'box', x: r.x, z: r.z, w: r.w, d: r.d, turn: 0, top: 4.2 })),
  ...BALES.map((b) => ({ kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: 0, top: 1.6 })),
  { kind: 'box', x: FORKLIFT.x, z: FORKLIFT.z, w: 1.3, d: 3.0, turn: FORKLIFT.turn, top: 2.3 },
  { kind: 'box', x: WH_STAIRS.x, z: WH_STAIRS.z - 0.8, w: 1.6, d: 1.8, turn: 0, top: 2.4 },
  { kind: 'box', ...WH_PROPS.pallets, top: 1.0 },
  { kind: 'box', x: WH_PROPS.jack.x, z: WH_PROPS.jack.z, w: 1.6, d: 0.6, turn: WH_PROPS.jack.turn, low: true },
  ...WH_PROPS.bollards.map(([x, z]) => ({ kind: 'circle', x, z, r: 0.14, top: 1.1 })),
  ...WH_PROPS.cones.map(([x, z]) => ({ kind: 'circle', x, z, r: 0.2, low: true })),
  { kind: 'box', ...WH_PROPS.bench, turn: 0, top: 1.6 },
  { kind: 'circle', ...WH_PROPS.barrel, top: 0.95 },
];
// the dock's open door, out to the lot (the other one's shut)
const DOCK_DOOR = { z: WAREHOUSE.z + WAREHOUSE.d / 2 + 3.5, w: 3.2 };
const WH_WALLS = (() => {
  const { x, z, w, d } = WAREHOUSE;
  return [
    [x, z, x + w, z, 0.12],
    [x, z + d, x + w, z + d, 0.12],
    [x, z, x, z + d, 0.12],
    [x + w, z, x + w, DOCK_DOOR.z - DOCK_DOOR.w / 2, 0.12],
    [x + w, DOCK_DOOR.z + DOCK_DOOR.w / 2, x + w, z + d, 0.12],
  ];
})();
WALLS.push(...WH_WALLS);

// ── outside: the Scranton Business Park's lot, off the loading dock ──
export const LOT = { x: 54, z: -16, w: 34, d: 32 };
// the building's back, along the lot's west edge, beyond the warehouse
const LOT_WALLS = [
  [LOT.x, LOT.z, LOT.x + LOT.w, LOT.z, 0.2],
  [LOT.x, LOT.z + LOT.d, LOT.x + LOT.w, LOT.z + LOT.d, 0.2],
  [LOT.x + LOT.w, LOT.z, LOT.x + LOT.w, LOT.z + LOT.d, 0.2],
  [LOT.x, LOT.z, LOT.x, WAREHOUSE.z, 0.2],
  [LOT.x, WAREHOUSE.z + WAREHOUSE.d, LOT.x, LOT.z + LOT.d, 0.2],
];
WALLS.push(...LOT_WALLS);
export const inLot = (x, z) => x > LOT.x && x <= LOT.x + LOT.w && z >= LOT.z && z <= LOT.z + LOT.d;
// parked cars: [x, z, turn, colour, kind]
export const CARS = [
  [62, -11, 0, 0x8a1c22, 'transam'], // Dwight's
  [62, -7.6, 0, 0xb9bcbf, 'sebring'], // Michael's
  [62, 7.2, 0, 0x2f3d55, 'hatch'],
  [62, 10.6, 0, 0x5a5d61, 'suv'],
  [72, -11, Math.PI, 0xd8d6cf, 'sedan'],
  [72, -4.2, Math.PI, 0x7c1f24, 'sedan'],
  [72, 3.2, Math.PI, 0x1d1f22, 'suv'],
  [72, 10.6, Math.PI, 0xc9b58a, 'sedan'],
  [78, -7.6, 0, 0x3a6fb8, 'hatch'],
  [78, 7.2, 0, 0xe0e0da, 'suv'],
];
export const PARK_SIGN = { x: 84, z: -1, turn: -Math.PI / 2 };
export const LIGHT_POLES = [
  [67, -13],
  [67, 0],
  [67, 13],
  [80, -13],
  [80, 13],
];
export const TREES = [
  [86, -12],
  [86, -6],
  [86, 5],
  [86, 11],
  [57, -14.6],
  [57, 14.6],
];
export const DUMPSTER = { x: 56, z: -10.8, w: 1.9, d: 1.2 };
const LOT_COLLIDERS = [
  ...CARS.map(([x, z, turn, , kind]) => ({ kind: 'box', x, z, w: kind === 'suv' ? 2.0 : 1.85, d: kind === 'suv' ? 4.8 : 4.5, turn, top: 1.6 })),
  { kind: 'box', x: PARK_SIGN.x, z: PARK_SIGN.z, w: 0.7, d: 3.6, turn: 0, top: 2.2 },
  ...LIGHT_POLES.map(([x, z]) => ({ kind: 'circle', x, z, r: 0.25, top: 8 })),
  ...TREES.map(([x, z]) => ({ kind: 'circle', x, z, r: 0.45, top: 6 })),
  { kind: 'box', ...DUMPSTER, turn: 0, top: 1.4 },
];
export const inWarehouse = (x, z) => x >= WAREHOUSE.x && x <= WAREHOUSE.x + WAREHOUSE.w && z >= WAREHOUSE.z && z <= WAREHOUSE.z + WAREHOUSE.d;

// The doors, standing open: hinged at one end of their doorway and swung
// into the room to rest beside the wall, or (Ryan's closet's) folded right
// back flat against the hallway wall. [the doorway's run, the hinge's end,
// the way it swings in plan y (+1 south, -1 north), what it's made of, flat]
const LEAF_SPEC = [
  ['M300 127 H322', 'end', -1, 'wood'], // Michael's office
  ['M328 127 H352', 'start', -1, 'wood'], // the conference room
  ['M480 288 H504', 'end', 1, 'wood'], // Darryl's office
  ['M870 141 H896', 'end', -1, 'wood'], // the break room
  ['M250 384 H276', 'start', 1, 'steel'], // the supply room
  ['M530 252 H554', 'start', 1, 'wood'], // the men's room
  ['M700 252 H724', 'end', 1, 'wood'], // the women's room
  ['M590 252 H612', 'start', -1, 'wood', 'flat'], // Ryan's closet
  ['M690 175 H716', 'start', -1, 'steel'], // the stairwell
];
export const LEAVES = LEAF_SPEC.map(([run, hinge, swing, kind, flat]) => {
  const [x0, y0, x1] = run.match(/-?\d+(\.\d+)?/g).map(Number);
  const at = hinge === 'start' ? x0 : x1;
  const away = hinge === 'start' ? 1 : -1; // from the hinge across the opening
  const h = P(at, y0);
  const w = Math.abs(x1 - x0) * U - 0.04;
  const face = 0.06 + 0.024; // off the wall's line: half the wall, half the door
  const leaf = flat
    ? { x: h.x - away * (w / 2), z: h.z + swing * face, w, d: 0.048 }
    : { x: h.x + away * 0.03, z: h.z + swing * (0.06 + w / 2), w: 0.048, d: w };
  return { ...leaf, kind, hinge: { x: h.x, z: h.z }, swing, away, flat: !!flat, width: w };
});

export const COLLIDERS = [
  ...WH_COLLIDERS,
  ...LOT_COLLIDERS,
  ...SEATS.map((s) => s.box),
  // the chairs, with whoever's in them (not Jim's: he's up)
  ...SEATS.filter((s) => s.who !== 'jim').map((s) => ({ kind: 'circle', x: s.chair.x, z: s.chair.z, r: 0.32, low: true })),
  { kind: 'circle', x: RECEPTION.chair.x, z: RECEPTION.chair.z, r: 0.3, low: true },
  ...RECEPTION_COUNTER,
  TABLE,
  COUNTER,
  KTABLE,
  ...BTABLES,
  FRIDGE,
  COPIER,
  COOLER,
  ...VENDING,
  ...FILES,
  ...SHELVES,
  ...PLANTS,
  ...MICHAEL_CHAIRS,
  CABINET,
  STAIRWELL.flight,
  ...LEAVES.map((l) => ({ kind: 'box', x: l.x, z: l.z, w: l.w, d: l.d, turn: 0, top: 2.1 })),
];

// Who gets up from their desk now and then, where to, and how often:
// Meredith for coffee, Kevin to the jelly beans on reception's counter, Oscar to the copier,
// Angela to check on her yogurt, Creed into the supply room, Phyllis to
// the microwave. (to: where they stand, `face` the walker's way: 0 east,
// π/2 north; every: seconds between trips; offset: when in that the first
// one starts; wait: how long they stand there)
export const AMBLES = [
  { who: 'meredith', to: { x: 1.9, z: -1.72, face: Math.PI / 2 }, every: 80, offset: 12, wait: 9 },
  { who: 'kevin', to: { x: -9.0, z: -3.15, face: -Math.PI / 2 }, every: 96, offset: 44, wait: 8 },
  { who: 'oscar', to: { x: 0.6, z: -2.95, face: Math.PI / 2 }, every: 72, offset: 28, wait: 7 },
  { who: 'angela', to: { x: 3.93, z: -1.62, face: Math.PI / 2 }, every: 110, offset: 70, wait: 6 },
  { who: 'creed', to: { x: -7.5, z: 6.0, face: -Math.PI / 2 }, every: 124, offset: 56, wait: 10 },
  { who: 'phyllis', to: { x: 3.05, z: -1.72, face: Math.PI / 2 }, every: 104, offset: 90, wait: 8 },
];

// Jim's body: an office's walk, not a hobbit's
export const JIM = { radius: 0.28, walk: 2.3, run: 4.4, accel: 14, turn: 10 };
// the whole floor sits inside this disc (walls do the real work)
export const WORLD = { radius: 60, centre: [0, 0] };

// where you start: off the lift, facing the suite's door
export const START = { ...P(96, 60), face: 0 };

// ── places to do things (E) ──
const spotAt = (id, px, py, r = 1.2) => ({ id, ...P(px, py), r });
export const SPOTS = [
  spotAt('phones', 186, 230, 1.15), // reception, when Erin's on her break
  spotAt('toss', 292, 168, 1.0), // Jim's desk
  spotAt('factcheck', 345, 232, 1.15), // Dwight's desk
  spotAt('fridge', 597, 206, 1.2), // the kitchen fridge (the Jell-O)
  spotAt('chili', 94, 76, 1.3), // the pot of chili, at the lift
  spotAt('kitchen', 549, 202, 1.3), // the kitchen counter (the chili's going here)
  spotAt('seminar', 340, 140, 1.2), // the conference room door: Dwight's fire safety seminar
  spotAt('exit', 703, 150, 1.4), // the stairwell, the way out in a fire
  spotAt('dundies', 270, 102, 1.3), // Michael's office
  spotAt('downstairs', 703, 150, 1.4), // the stairwell, down to the warehouse
  { id: 'upstairs', x: WH_STAIRS.x, z: WH_STAIRS.z + 0.6, r: 1.3 }, // and back up
  { id: 'hoop', x: HOOP.x + HOOP.line + 0.3, z: HOOP.z, r: 1.1 }, // the free-throw line
];
// where you come out on each floor
export const WH_ARRIVE = { x: WH_STAIRS.x, z: WH_STAIRS.z + 1.4, face: -Math.PI / 2 };
export const OFFICE_ARRIVE = { ...P(703, 200), face: -Math.PI / 2 };
export const spot = (id) => SPOTS.find((s) => s.id === id);

// Things to look at (E): a line each.
export const THINGS = [
  { id: 'mug', ...P(258, 62), r: 1.4, name: 'Michael’s mug', line: 'WORLD’S BEST BOSS. He bought it himself, at Spencer Gifts. He’s very proud of it.' },
  { id: 'painting', ...P(146, 210), r: 1.2, name: 'Pam’s watercolour', line: 'Pam’s painting of the building. Michael bought it for the office, and hung it where the clients can see.' },
  { id: 'copier', ...P(489, 152), r: 1.1, name: 'The copier', line: 'Jammed. There’s a note on it in Dwight’s hand: “Do NOT touch. — Assistant Regional Manager.”' },
  { id: 'vending', ...P(838, 46), r: 1.2, name: 'The vending machine', line: 'You put a dollar in. The granola bar hangs on its coil, as it always does. Kevin has a technique for this.' },
  { id: 'cooler', ...P(160, 128), r: 1.1, name: 'The water cooler', line: 'Where the office talks about everyone who isn’t at the water cooler.' },
  { id: 'supplies', ...P(232, 450), r: 1.6, name: 'The supply room', line: 'Paper. A great deal of paper. It is, Michael would like you to know, a paper company.' },
  { id: 'whiteboard', ...P(334, 70), r: 1.3, name: 'The whiteboard', line: 'Today’s agenda, in Michael’s writing: 1. Morale. 2. Fun. 3. Morale (again). 4. Toby (no).' },
  { id: 'lift', ...P(94, 82), r: 1.2, name: 'The lift', line: 'It works. Mostly. The stairs are on the other side of the office, past the kitchen.' },
  { id: 'closet', ...P(600, 266), r: 1.0, name: 'Ryan’s closet', line: 'Ryan’s office, between the restrooms. He calls it his “workspace”. It has a door, which is more than the annex has.' },
  { id: 'forklift', x: FORKLIFT.x - 1.4, z: FORKLIFT.z + 0.4, r: 1.4, name: 'The forklift', line: 'Only the warehouse drives the forklift. Michael drove it once. They still talk about it, and not kindly.' },
  { id: 'accident', x: 34, z: -6.9, r: 1.6, name: 'The safety record', line: 'Zero days without a lost time accident. Michael was down here this morning.' },
  { id: 'bales', x: 47.6, z: 2.2, r: 1.2, name: 'A bale of paper', line: 'Shrink-wrapped, on a pallet, waiting for a truck. Somewhere in there is the paper Michael says is “the best in the business”.' },
  { id: 'dock', x: 52.2, z: 6.2, r: 1.2, name: 'The loading dock', line: 'One door up, one down. The trucks come at seven, and Darryl’s been here since six.' },
  { id: 'parksign', x: 82.4, z: -1, r: 1.8, name: 'Scranton Business Park', line: 'The sign at the front of the lot. Dunder Mifflin, Vance Refrigeration, and a few others nobody has ever met.' },
  { id: 'transam', x: 64.2, z: -11, r: 1.8, name: 'A red Trans Am', line: 'Dwight’s. Do not lean on it. He will know.' },
  { id: 'dumpster', x: 57.6, z: -10.8, r: 1.4, name: 'The dumpster', line: 'Behind the warehouse. People come out here to cry, to smoke, or to talk to the camera where nobody can hear.' },
];

// ── people: who's where, and what they say as you pass ──
// seated at their desks (SEATS), but for Erin at reception
export const LINES = {
  michael: ['Jim! My main man. Don’t tell Dwight I said that.', 'Would I rather be feared or loved? Easy. Both. I want people to be afraid of how much they love me.', 'I’m not superstitious. But I am a little stitious.'],
  dwight: ['Question. What are you doing at my desk?', 'I am faster than eighty percent of all snakes.', 'Whenever I’m about to do something, I think: would an idiot do that? And if they would, I do not do that thing.'],
  pam: ['Hey. Dwight’s been guarding his stapler all morning. Just so you know.', 'I painted the building again. It’s a good building.', 'Are you going to do something to Dwight? Can I watch?'],
  erin: ['Dunder Mifflin, this is Erin!', 'Could you cover the phones? Just for a minute? I really need a break.', 'Do you think the phones get lonely when I go on break?'],
  andy: ['Nard Dog, reporting for duty.', 'I went to Cornell. Ever heard of it?', 'Rit-dit-dit-di-doo! Rit-dit-dit-di-dee!'],
  phyllis: ['Bob Vance, Vance Refrigeration, says hi.', 'I knitted this. Don’t touch it.', 'Close your mouth, sweetie. You look like a trout.'],
  stanley: ['Did I stutter?', 'Is it Pretzel Day? No? Then I’m doing the crossword.', 'Boy, have you lost your mind? I’ll help you find it.'],
  angela: ['The party planning committee meets at four. You are not on it.', 'Sprinkles was my best friend. Don’t.', 'I don’t have a lot of time. I have cats.'],
  kevin: ['Why waste time say lot word when few word do trick?', 'My chili is the thing I do best. I’m not bragging. It’s just true.', 'Ah, I’m doing the numbers. The numbers are very hard today.'],
  oscar: ['Actually, it’s a little more complicated than that.', 'I’m the smartest person in this office. That’s not a brag. It’s a burden.'],
  creed: ['Nobody steals from Creed Bratton and gets away with it.', 'I’ve been involved in a number of cults, both as a leader and a follower.', 'I sprout mung beans on a damp paper towel in my desk drawer. Very nutritious.'],
  meredith: ['Is it Friday? It feels like a Friday.', 'If anyone needs me, I’ll be in the… actually, don’t need me.'],
  darryl: ['Office life. Glass walls. Very open. Very watched.', 'Mike’s been down to the warehouse twice today. Twice.'],
  ryan: ['I’m working on a website. It’s going to be huge.', 'This closet is temporary. Everything is temporary.'],
  toby: ['If anyone needs me, I’ll be over here. In the annex. As usual.', 'Michael said good morning to me today. Well. He said “morning”. At me.'],
  kelly: ['Oh my God, Jim. Did you hear about Ryan? Because I didn’t hear about Ryan.', 'I talk a lot, so I’ve learned to tune myself out.'],
};
// what they say instead while the job they want you for is waiting
export const ASKS = {
  kevin: 'Jim. Jim. My chili’s at the lift. Can you bring it to the kitchen? Careful. It’s my thing.',
  erin: 'Jim, could you cover the phones for a minute? Please? I really need a break.',
  michael: 'Jim! Get in here. Step into my office. Not you, Toby.',
};
// the lines the show said out loud, played as it said them (lib/clips.js);
// the rest are said in the speaker's own voice where it's been made (./voicelines.js)
export const SPOKEN = { 'I’m not superstitious. But I am a little stitious.': 'littleStitious', 'Did I stutter?': 'didIStutter' };
export const NAMES = { michael: 'Michael Scott', dwight: 'Dwight Schrute', jim: 'Jim Halpert', pam: 'Pam Beesly', erin: 'Erin Hannon', andy: 'Andy Bernard', phyllis: 'Phyllis Vance', stanley: 'Stanley Hudson', angela: 'Angela Martin', kevin: 'Kevin Malone', oscar: 'Oscar Martinez', creed: 'Creed Bratton', meredith: 'Meredith Palmer', darryl: 'Darryl Philbin', ryan: 'Ryan Howard', toby: 'Toby Flenderson', kelly: 'Kelly Kapoor' };

// where someone's head is when they're sitting (for who's near and the bubbles)
export function castAt(who) {
  if (who === 'erin') return { id: 'erin', x: RECEPTION.chair.x, z: RECEPTION.chair.z };
  const s = seatOf(who);
  return s ? { id: who, x: s.chair.x, z: s.chair.z } : null;
}
export const CAST = Object.keys(LINES).map(castAt).filter(Boolean);

// ── the jobs' paths ──
// Dwight, back from the men's room to his desk
export const DWIGHT_BACK = [P(542, 244), P(522, 214), P(470, 160), P(352, 160), P(352, 224)];
// Erin's break: to the break room's vending machines, and back
export const ERIN_BREAK = { at: P(842, 70), face: Math.PI }; // (facing the machines, west)
// Dwight's fire: a bin in the conference room
export const FIRE_BIN = P(486, 104);
// where the panicking run, in the fire (each a line run back and forth)
export const PANIC = [
  [P(225, 150), P(495, 150)],
  [P(350, 145), P(352, 275)],
  [P(262, 272), P(395, 276)],
  [P(455, 150), P(455, 270)],
  [P(178, 246), P(300, 274)],
  [P(560, 214), P(680, 214)],
];

// a saved place to come back to, if it's somewhere you can stand
export function validAt(at) {
  if (!at || !Number.isFinite(at.x) || !Number.isFinite(at.z)) return START;
  const r = roomAt(at.x, at.z);
  if (!r) return START;
  return { x: at.x, z: at.z, face: Number.isFinite(at.face) ? at.face : 0 };
}
