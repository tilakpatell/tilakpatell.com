// The plan at walking scale: the buildings and the lawn, the doors and the
// portal, the lamps, benches, planters and flags, who's about and what they
// say. Plain data and the few lookups on it.

import { BERM, BRIDGE, CRES, CRES_FOOT, GATE, HANGAR, LAB, LAWN, PROW, RIVER, ROADS, STALLS, TRAINING, TREES, arcPt, inPoly } from '../../compound/plan';

// A plan unit is about four metres from the air; on foot the compound is
// drawn smaller across the ground, so a walk between buildings takes seconds,
// and a little taller than that, so a floor is still a floor.
export const S = 1.6; // metres to a plan unit, along the ground
export const V = 2.4; // metres to a plan unit, upwards
export const toWorld = ([x, y]) => [x * S, y * S];
const footOf = (foot) => foot.map(toWorld);

// A path in the plan's SVG syntax (M, L, C only) as points, every `step`
// units (the drives).
export function samplePath(d, step = 1) {
  const tok = d.match(/[MLC]|-?\d*\.?\d+/g);
  const out = [];
  let i = 0;
  let cur = [0, 0];
  let cmd = 'M';
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    if (/[MLC]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') {
      cur = [num(), num()];
      out.push(cur);
      cmd = 'L';
    } else if (cmd === 'L') {
      const b = [num(), num()];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / step));
      for (let k = 1; k <= n; k++) out.push([cur[0] + ((b[0] - cur[0]) * k) / n, cur[1] + ((b[1] - cur[1]) * k) / n]);
      cur = b;
    } else {
      const c1 = [num(), num()];
      const c2 = [num(), num()];
      const b = [num(), num()];
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - cur[0], b[1] - cur[1]) / step) * 2);
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        const s = 1 - t;
        out.push([s * s * s * cur[0] + 3 * s * s * t * c1[0] + 3 * s * t * t * c2[0] + t * t * t * b[0], s * s * s * cur[1] + 3 * s * s * t * c1[1] + 3 * s * t * t * c2[1] + t * t * t * b[1]]);
      }
      cur = b;
    }
  }
  return out;
}

// ── the ground ──

export const LAWN_W = footOf(LAWN);
export const RIVER_W = footOf(RIVER);
export const ROADS_W = ROADS.map((d) => samplePath(d, 0.8).map(toWorld));
export const ROAD_HALF = (3.7 * S) / 2;
export const EDGE = 1.4; // how near the edge of the lawn you can walk
export const HERO_R = 0.45; // how round he is, for bumping into things

// ── the buildings: footprints (metres) and roof heights ──

const bounds = (foot) => {
  const xs = foot.map((p) => p[0]);
  const zs = foot.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
};
// `h` is the roof, where he stands on it; `y0` its foot (above the ground
// for what's overhead: the bridge, and what stands on the roofs)
const building = (id, foot, h, y0 = 0) => {
  const f = footOf(foot);
  return { id, foot: f, h, y0, box: bounds(f) };
};
// a box on the plan, [x0, y0]–[x1, y1] (units)
const planBox = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
// what stands on the ground (the walls you walk round)
export const BUILDINGS = [
  building('hangar', HANGAR, 9 * V),
  building('prow', PROW, 13 * V),
  building('wing', CRES_FOOT, (CRES.h + 0.6) * V),
  building('training', TRAINING, 7 * V),
  building('lab', LAB, 6 * V),
  building('gate', GATE, 3.2 * V),
  building('berm', BERM, 2.2 * V),
  building('stalls', STALLS, 3 * V),
  // the bridge from the hangar to the main building is overhead: only its pier stands on the lawn
  building('pier', [[36.6, 25.6], [37.6, 25.6], [37.6, 26.6], [36.6, 26.6]], 4.6 * V),
];
// the training center's clerestory, the lab's three roof lights (the drawing's too)
export const CLERESTORY = [
  [100, 21],
  [119, 19],
  [120, 24],
  [101, 26],
];
export const ROOF_LIGHTS = [0, 1, 2].map((k) => [
  [84, 72.5 + k * 5],
  [101.5, 71 + k * 5],
  [101.7, 72.6 + k * 5],
  [84.2, 74.1 + k * 5],
]);
// the plant rooms on the main building's roof and the glass wing's
const PROW_PLANT = [
  [48, 23],
  [55, 27],
].map(([x, y]) => planBox(x, y, x + 3, y + 2.4));
const WING_PLANT = [0.25, 0.5, 0.75].map((k) => {
  const [x, y] = arcPt((CRES.rIn + CRES.rOut) / 2, CRES.a0 + (CRES.a1 - CRES.a0) * k);
  return planBox(x - 1.6, y - 1.2, x + 1.6, y + 1.2);
});
// the hangar roof's solar panels, in two rows of five
const SOLAR = [0, 1, 2, 3, 4].flatMap((i) => [9.5, 18.9].map((x0) => planBox(x0, 19 + i * 6.6, x0 + 7.6, 19 + i * 6.6 + 4.8)));
// plant on the training center's roof and the lab's, and the main building's comms mast
export const ROOF_PLANT = [
  { id: 'hvac-0', foot: planBox(102, 29, 105, 31), y0: 7 * V, h: 7 * V + 2.4 },
  { id: 'hvac-1', foot: planBox(108, 28.6, 111, 30.6), y0: 7 * V, h: 7 * V + 2.4 },
  { id: 'hvac-2', foot: planBox(114, 28.2, 117, 30.2), y0: 7 * V, h: 7 * V + 2.4 },
  { id: 'hvac-3', foot: planBox(101.8, 73, 104.2, 77), y0: 6 * V, h: 6 * V + 2.2 },
];
export const COMMS = { x: 57, y: 21, h: 6.5 }; // on the plan; the mast's height over the roof
// what's up off the ground: the bridge, and what stands on the roofs
const OVERHEAD = [
  building('bridge', BRIDGE, 7 * V, 4.6 * V),
  building('clerestory', CLERESTORY, 8.4 * V, 7 * V),
  ...ROOF_LIGHTS.map((f, i) => building(`rooflight-${i}`, f, 7.2 * V, 6 * V)),
  ...PROW_PLANT.map((f, i) => building(`plant-${i}`, f, 14.1 * V, 13 * V)),
  ...WING_PLANT.map((f, i) => building(`wingplant-${i}`, f, (CRES.h + 1.7) * V, (CRES.h + 0.6) * V)),
  ...SOLAR.map((f, i) => building(`solar-${i}`, f, 9 * V + 1.35, 9 * V)),
  ...ROOF_PLANT.map((u) => building(u.id, u.foot, u.h, u.y0)),
  building('comms', planBox(COMMS.x - 0.4, COMMS.y - 0.4, COMMS.x + 0.4, COMMS.y + 0.4), 13 * V + COMMS.h, 13 * V),
];
// everything solid, on the ground and off it
export const SOLIDS = [...BUILDINGS, ...OVERHEAD];
export const solidById = (id) => SOLIDS.find((s) => s.id === id) ?? null;

// ── things on the lawn: the parked Quinjet, the cars, the trees down the drives ──

// the Quinjet parked on the landing pad, nose along `yaw` (the drawing's 1.15 scale)
export const PARKED_JET = { x: 12 * S, z: 80 * S, yaw: Math.PI + (22 * Math.PI) / 180, scale: 0.75 };
// cars in the car park by the gate: [x, z, yaw, kind, colour]
export const PARKED_CARS = [
  [52.8, 99, Math.PI, 'sedan', 0xc0392b],
  [57.2, 99, Math.PI, 'suv', 0xf2f2f2],
  [63.7, 99, 0, 'sedan', 0x22304a],
  [65.9, 103.3, 0, 'sedan', 0x8a949e],
  [53.9, 103.3, Math.PI, 'suv', 0xf2f2f2],
  [60.4, 103.3, 0, 'sedan', 0x1e2a44],
].map(([x, y, yaw, kind, color]) => ({ x: x * S, z: y * S, yaw, kind, color }));
// Floodlight masts round the lawn, the helipad and the drives (the open lawn
// has nothing else to swing from): [x, y] on the plan, 18 m tall.
export const MAST_H = 18;
export const MASTS = [
  [25, 96.9],
  [58.8, 53.1],
  [83.8, 48.1],
  [63.8, -1.3],
  [6.9, 95],
  [113.8, 43.8],
  [48.8, 78.1],
  [95.6, 50.6],
  [36.9, 85.6],
  [106.3, 1.9],
  [116.3, 64.4],
  [-1.9, 82.5],
  [53.8, 65.6],
  [71.3, 63.8],
  [-20.6, 48.1],
].map(([x, y]) => ({ x: x * S, z: y * S }));
// the trees that stand on the lawn (the rest are the woods round it)
export const LAWN_TREES = TREES.filter((t) => inPoly(t.x, t.y, LAWN)).map((t) => ({ x: t.x * S, z: t.y * S, r: t.r * S, tone: t.tone }));

// Round things the hero bumps into: { x, z, r, top } (he goes over them, higher up).
const jetBody = () => {
  const out = [];
  const s = PARKED_JET.scale;
  // along the fuselage, nose (+) to tail (−), in the jet's own metres
  for (const along of [12, 6, 0, -6, -12]) out.push({ x: PARKED_JET.x + Math.sin(PARKED_JET.yaw) * along * s, z: PARKED_JET.z + Math.cos(PARKED_JET.yaw) * along * s, r: 2.6 * s + 0.4, top: 4.6 });
  return out;
};
const carBody = (c) => [-1.25, 1.25].map((along) => ({ x: c.x + Math.sin(c.yaw) * along, z: c.z + Math.cos(c.yaw) * along, r: c.kind === 'suv' ? 1.15 : 1.05, top: c.kind === 'suv' ? 1.8 : 1.45 }));

// ── the doors into the games ──

// The middle of edge i of a footprint (plan units), `out` units outside it:
// where its door is, and the way out (nx, ny).
function doorOf(foot, i, out) {
  const a = foot[i];
  const b = foot[(i + 1) % foot.length];
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  let nx = (b[1] - a[1]) / l;
  let ny = -(b[0] - a[0]) / l;
  // the outside is away from the footprint's middle
  const cx = foot.reduce((s, p) => s + p[0], 0) / foot.length;
  const cy = foot.reduce((s, p) => s + p[1], 0) / foot.length;
  if ((mx - cx) * nx + (my - cy) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: (mx + nx * out) * S, z: (my + ny * out) * S, nx, ny };
}
// the facing (as the hero's `face`) that looks along plan direction (nx, ny)
const faceOf = (nx, ny) => Math.atan2(-ny, nx);
const at = (d) => ({ x: d.x, z: d.z, face: faceOf(d.nx, d.ny) });

const STARK = (() => {
  const a = (53 * Math.PI) / 180;
  const [x, y] = arcPt(CRES.rOut + 1.4, a);
  return { x: x * S, z: y * S, face: faceOf(Math.cos(a), Math.sin(a)) };
})();
const CRATER = { x: 45 * S, z: 58 * S, r: 2.6 };
// an Iron Man armour on a plinth beside the workshop's door, facing out
const ARMOUR = (() => {
  const ox = Math.cos(STARK.face);
  const oz = -Math.sin(STARK.face);
  return { x: STARK.x - ox * 0.6 + oz * 4, z: STARK.z - oz * 0.6 - ox * 4, face: STARK.face, r: 0.75 };
})();

// The doors, in the order of the tour: the seven buildings with a stone to
// win, and Spider-Man at the front gate, who has a game but no stone.
// `stone` is what winning there earns (Clint's and Natasha's halves of the
// Soul Stone are a stone between them); `face` is the way out of the door, which the hero faces as he leaves;
// `accent` is the game's own colour and `sign` what's over its door.
export const PLACES = [
  {
    id: 'stark',
    accent: '#8fe9ff',
    sign: 'Workshop',
    name: 'Tony Stark’s workshop',
    where: 'Main building · the glass wing',
    act: 'Suit up',
    stone: 'power',
    hint: 'Ultron’s drones are coming over the trees. Suit up at Tony’s workshop, in the glass wing.',
    blurb: 'Where the suits get built and tested. Out back is the test field, and Ultron’s drones are coming over the trees.',
    ...STARK,
  },
  {
    id: 'thor',
    accent: '#bfe0ff',
    sign: null,
    name: 'Mjolnir',
    where: 'The lawn, out front',
    act: 'Lift it',
    stone: 'reality',
    hint: 'Mjolnir is in its crater on the lawn. Lift it: the Chitauri are coming across the grass.',
    blurb: 'Mjolnir waits in a crater on the lawn, for someone worthy. Lift it, because the Chitauri are coming across the lawn in the rain.',
    x: CRATER.x + 2.4,
    z: CRATER.z + 1.4,
    face: faceOf(1, 0.5),
  },
  {
    id: 'cap',
    accent: '#ff6b5e',
    sign: 'Training',
    name: 'The training center',
    where: 'The training center',
    act: 'Train',
    stone: 'mind',
    hint: 'Twelve rooms of training bots, and a shield that bounces off steel. The training center, past the track.',
    blurb: 'Twelve rooms of training bots, and a shield that bounces off steel. It always comes back.',
    ...at(doorOf(TRAINING, 2, 1.6)),
  },
  {
    id: 'hawkeye',
    accent: '#c9a2ff',
    sign: 'Range',
    name: 'The range',
    where: 'Past the hangar',
    act: 'Pick up the bow',
    stone: 'soul-clint',
    hint: 'Clint’s range, past the hangar: boards out to sixty metres, clays, and trick arrows.',
    blurb: 'A clearing past the hangar, where Clint keeps his eye in: boards out to sixty metres, clays from the traps, and trick arrows for anyone who strings three together.',
    ...at(doorOf(STALLS, 1, 1.4)),
  },
  {
    id: 'widow',
    accent: '#ff4b3e',
    sign: 'Operations',
    name: 'Operations',
    where: 'Main building · the front door',
    act: 'Go in',
    stone: 'soul-natasha',
    hint: 'Natasha’s at the main door. A HYDRA facility is up on the holotable, eight levels deep.',
    blurb: 'Natasha ran the compound from this room for five years. On the holotable: a HYDRA facility, eight levels deep, and her file at the bottom of it. Every move she makes, the guards make one too.',
    ...at(doorOf(PROW, 2, 1.5)),
  },
  {
    id: 'banner',
    accent: '#7dff6a',
    sign: 'Laboratory',
    name: 'Bruce Banner’s lab',
    where: 'The lab',
    act: 'Go in',
    stone: 'time',
    hint: 'Bruce’s lab, down the east drive. It’s 2012 in there, and Midtown is full of Chitauri.',
    blurb: 'Gamma research, and a scientist who would rather you didn’t push him. Push him anyway: it’s 2012, the portal is open over Stark Tower, and Midtown is full of Chitauri.',
    ...at(doorOf(LAB, 0, 1.6)),
  },
  {
    id: 'spidey',
    accent: '#ff5a4f',
    sign: null,
    name: 'The front gate',
    where: 'Spider-Man · the gatehouse',
    act: 'Swing to school',
    stone: null,
    hint: 'Peter’s at the front gate, late for school, two kilometres away.',
    blurb: 'Happy dropped the kid off here. Inside, Tony had a new suit and a room full of reporters waiting; Peter turned both down and went back to Queens. Now he’s late for school, two kilometres away, and the quickest way there is between the buildings.',
    ...at(doorOf(GATE, 0, 1.6)),
  },
  {
    id: 'vault',
    accent: '#6cc8ff',
    sign: 'Hangar 1',
    name: 'The hangar',
    where: 'The hangar · the Tesseract',
    act: 'Go in',
    stone: 'space',
    hint: 'The Tesseract is in the hangar. Fly it home, slung under a Quinjet, and set it down gently.',
    blurb: 'The Quinjets live here, and so did the quantum tunnel for the time heist. The Tesseract has to come home to it, slung in its case under a Quinjet, through the hangar doors in a storm.',
    ...at(doorOf(HANGAR, 2, 1.5)),
  },
];
export const placeById = (id) => PLACES.find((p) => p.id === id) ?? null;
export const DOOR_R = 3.4; // how near a door you have to be to go in
export { ARMOUR, CRATER };

// The portal the Space Stone opens, over the helipad: walk under it to Titan.
export const PORTAL = { x: 70 * S, z: 52 * S, r: 6, y: 24 };

// Where you start: on the main drive, looking up it at the main building.
export const START = { x: 60.5 * S, z: 74 * S, face: Math.PI / 2 };

// ── who's about ──

// Lines go round in turn; `after` are a hero's lines once his game is won.
export const CAST = [
  {
    id: 'thor',
    name: 'Thor',
    style: 'thor',
    x: CRATER.x - 3.2,
    z: CRATER.z - 1.6,
    face: faceOf(0.6, 1),
    lines: ['Whosoever holds this hammer, if they be worthy, shall possess the power of Thor.', 'Go on, Spider-Man. Give it a pull. Nobody’s judging. Much.', 'The Chitauri are coming. I can feel it in the air.'],
    after: { place: 'thor', lines: ['I knew it!', 'Worthy! I knew there was something about you, spider.'] },
  },
  {
    id: 'natasha',
    name: 'Natasha Romanoff',
    style: 'widow',
    x: PROW[2][0] * S - 4.5,
    z: PROW[2][1] * S + 3.2,
    face: faceOf(-0.4, 1),
    lines: ['The file’s on the holotable. HYDRA, eight levels down.', 'I’ve got red in my ledger. I’d like to wipe it out.', 'Clint’s at the range, if you want the other half of that stone. Try to keep up, kid.'],
    after: { place: 'widow', lines: ['Clean. Not one guard saw me.', 'Ledger’s a little lighter today.'] },
  },
  {
    id: 'hulk',
    name: 'Hulk',
    style: 'hulk',
    x: LAB[0][0] * S + 6,
    z: LAB[0][1] * S - 5,
    face: faceOf(0.2, -1),
    lines: ['That’s my secret, kid. I’m always angry.', 'Hulk smash!', 'Puny god.'],
    after: { place: 'banner', lines: ['Hulk smash!', 'Midtown is safe. Mostly.'] },
    r: 0.9,
  },
  {
    id: 'bot',
    name: 'Training bot',
    style: 'bot',
    x: TRAINING[3][0] * S + 12,
    z: TRAINING[3][1] * S + 4.5,
    face: faceOf(0, 1),
    lines: ['Training sequence ready, Spider-Man.', 'Twelve rooms. One shield.', 'Please do not throw the shield at me.'],
    after: { place: 'cap', lines: ['Sequence complete. All units… dented.'] },
  },
];
export const linesFor = (c, done) => (c.after && done.includes(c.after.place) ? c.after.lines : c.lines);
export function nearCast(x, z, r = 3.4) {
  let best = null;
  for (const c of CAST) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < r && (!best || d < best.d)) best = { ...c, d };
  }
  return best;
}

// ── along the drives: street lamps, benches, planters by the doors, flags by the gate ──

// somewhere on the lawn, `r` clear of the buildings and in from the lawn's edge
const openAt = (x, z, r) => inPoly(x, z, LAWN_W) && nearestEdge(x, z, LAWN_W).d > 2 && !BUILDINGS.some((b) => inPoly(x, z, b.foot) || nearestEdge(x, z, b.foot).d < r);
const roadGap = (x, z) => Math.min(...ROADS_W.map((pts) => Math.min(...pts.map(([a, b]) => Math.hypot(a - x, b - z)))));
// clear of the doors, the people, the masts, the trees, the cars, the jet and the portal
const clearOfThings = (x, z, r) =>
  !PLACES.some((p) => Math.hypot(p.x - x, p.z - z) < 4.5 + r) &&
  !CAST.some((c) => Math.hypot(c.x - x, c.z - z) < 2.5 + r) &&
  !MASTS.some((m) => Math.hypot(m.x - x, m.z - z) < 5 + r) &&
  !LAWN_TREES.some((t) => Math.hypot(t.x - x, t.z - z) < 2.2 + r) &&
  !PARKED_CARS.some((c) => Math.hypot(c.x - x, c.z - z) < 3.2 + r) &&
  Math.hypot(PARKED_JET.x - x, PARKED_JET.z - z) > 15 + r &&
  Math.hypot(CRATER.x - x, CRATER.z - z) > 4.5 + r &&
  Math.hypot(ARMOUR.x - x, ARMOUR.z - z) > 2 + r &&
  Math.hypot(PORTAL.x - x, PORTAL.z - z) > PORTAL.r + 2 + r;

// Street lamps down the drives, every 22 m or so on alternate sides, their
// arms out over the drive: { x, z, yaw } (yaw turns the lamp's +x to the drive).
export const LAMPS = (() => {
  const out = [];
  ROADS_W.forEach((pts, ri) => {
    let run = 0;
    let next = 9;
    let side = ri % 2 ? 1 : -1;
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1];
      const [bx, bz] = pts[i];
      const l = Math.hypot(bx - ax, bz - az) || 1;
      run += l;
      if (run < next) continue;
      next = run + 22;
      const tx = (bx - ax) / l;
      const tz = (bz - az) / l;
      const off = ROAD_HALF + 1.3;
      const x = bx - tz * off * side;
      const z = bz + tx * off * side;
      side = -side;
      if (!openAt(x, z, 2.5) || !clearOfThings(x, z, 0.3) || roadGap(x, z) < ROAD_HALF + 0.9) continue;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 12)) continue;
      out.push({ x, z, yaw: Math.atan2(-(bz - z), bx - x) });
    }
  });
  return out;
})();
// Benches beside every third lamp, a little further back, facing the drive: { x, z, yaw }
// (yaw turns the bench's front, +z, to the drive)
export const BENCHES = LAMPS.filter((_, i) => i % 3 === 1)
  .map((l) => {
    const ox = Math.cos(l.yaw);
    const oz = -Math.sin(l.yaw);
    // back from the drive, and along it from the lamp
    const x = l.x - ox * 1.6 + oz * 2.4;
    const z = l.z - oz * 1.6 - ox * 2.4;
    return { x, z, yaw: Math.atan2(ox, oz) };
  })
  .filter((b) => openAt(b.x, b.z, 2) && clearOfThings(b.x, b.z, 1) && roadGap(b.x, b.z) > ROAD_HALF + 0.9);
// Round planters of shrubs either side of each building's door: { x, z }
export const PLANTERS = PLACES.filter((p) => p.sign).flatMap((p) => {
  const ox = Math.cos(p.face);
  const oz = -Math.sin(p.face);
  return [-1, 1]
    .map((k) => ({ x: p.x - ox * 1.1 + oz * 3.4 * k, z: p.z - oz * 1.1 - ox * 3.4 * k }))
    .filter((q) => openAt(q.x, q.z, 0.85) && !CAST.some((c) => Math.hypot(c.x - q.x, c.z - q.z) < 1.8) && Math.hypot(ARMOUR.x - q.x, ARMOUR.z - q.z) > 1.8);
});
// Three flagpoles inside the gate, 12 m tall
export const FLAG_H = 12;
export const FLAGS = [
  [44, 92],
  [46.5, 91.7],
  [49, 91.4],
].map(([x, y]) => ({ x: x * S, z: y * S }));

// ── things to knock over (the game-feel design’s Tier 3) ──

// Out on the lawn near where you start: a few sets of a slalom of five
// cones, and behind it two crates and a barrel, each where there's room
// (clear of the buildings, the drives, the lamps, benches and planters, and
// everything clearOfThings keeps clear). Data only: ./lawnProps.js puts
// them through lib/three/knockables, light bodies where the computer can
// afford the engine and standing still where it can't. { kind, x, y, z, yaw }
const PROP_CLEAR = 1.2;
const propRoom = (x, z) =>
  openAt(x, z, 2) &&
  clearOfThings(x, z, 1) &&
  roadGap(x, z) > ROAD_HALF + PROP_CLEAR &&
  ![...LAMPS, ...BENCHES, ...PLANTERS].some((o) => Math.hypot(o.x - x, o.z - z) < 2 + PROP_CLEAR) &&
  Math.hypot(START.x - x, START.z - z) > 6;
function propSet(x, z, a) {
  const ax = Math.cos(a);
  const az = Math.sin(a);
  // across the way out from the start, 1.6 m apart; the rest 3 m behind
  const at = (along, back) => ({ x: x - az * along + ax * back, z: z + ax * along + az * back });
  return [
    ...[-2, -1, 0, 1, 2].map((k) => ({ kind: 'cone', ...at(k * 1.6, 0), yaw: k * 0.4 })),
    { kind: 'crate', ...at(-0.6, 3), yaw: 0.2 },
    { kind: 'crate', ...at(0.4, 3.1), yaw: -0.3 },
    { kind: 'barrel', ...at(1.6, 3), yaw: 0 },
  ].map((p) => ({ ...p, y: 0 }));
}
export const LAWN_PROPS = (() => {
  const sets = [];
  for (let r = 12; r <= 70 && sets.length < 3; r += 4) {
    for (let i = 0; i < 24 && sets.length < 3; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = START.x + Math.cos(a) * r;
      const z = START.z + Math.sin(a) * r;
      if (sets.some((s) => Math.hypot(s[2].x - x, s[2].z - z) < 25)) continue;
      const set = propSet(x, z, a);
      if (set.every((p) => propRoom(p.x, p.z))) sets.push(set);
    }
  }
  return sets.flat();
})();

// ── bumping into things ──

// Everything round the hero bumps into, besides the buildings.
// (a tree's trunk, up to its crown: he goes through the leaves)
export const ROUND = [
  ...jetBody(),
  ...PARKED_CARS.flatMap(carBody),
  ...LAWN_TREES.map((t) => ({ x: t.x, z: t.z, r: 0.45, top: 3.2 })),
  ...MASTS.map((m) => ({ x: m.x, z: m.z, r: 0.42, top: MAST_H })),
  ...LAMPS.map((l) => ({ x: l.x, z: l.z, r: 0.2, top: 4 })),
  ...BENCHES.flatMap((b) => [-0.55, 0.55].map((k) => ({ x: b.x + Math.cos(b.yaw) * k, z: b.z - Math.sin(b.yaw) * k, r: 0.45, top: 0.85 }))),
  ...PLANTERS.map((q) => ({ x: q.x, z: q.z, r: 0.72, top: 0.75 })),
  ...FLAGS.map((f) => ({ x: f.x, z: f.z, r: 0.16, top: FLAG_H })),
  { x: CRATER.x, z: CRATER.z, r: 0.5, top: 0.6 },
  { x: ARMOUR.x, z: ARMOUR.z, r: ARMOUR.r, top: 2.3 },
  ...CAST.map((c) => ({ x: c.x, z: c.z, r: c.r ?? 0.5, top: c.style === 'hulk' ? 3 : 2.3 })),
];

// The nearest point on a polygon's edge to (x, z), and how far it is.
export function nearestEdge(x, z, foot) {
  let best = { x, z, d: Infinity };
  for (let i = 0; i < foot.length; i++) {
    const [ax, az] = foot[i];
    const [bx, bz] = foot[(i + 1) % foot.length];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    const px = ax + t * dx;
    const pz = az + t * dz;
    const d = Math.hypot(x - px, z - pz);
    if (d < best.d) best = { x: px, z: pz, d, nx: -dz, nz: dx };
  }
  return best;
}
