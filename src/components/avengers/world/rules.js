// The Avengers compound, the world: the compound's plan (../compound/plan.js)
// at walking scale, for Spider-Man to walk about. What's here: the
// buildings he can't walk through and the lawn he can't leave, the doors into
// the seven games, the portal the Space Stone opens, who's about and what
// they say, and how far the stone heist has got. Plain numbers, tested
// (rules.test.js); the drawing is in ./scene.js.
//
// The world is in metres: x east, z south (the plan's y), y up.

import { BERM, BRIDGE, CRES, CRES_FOOT, GATE, HANGAR, LAB, LAWN, PROW, RIVER, ROADS, STALLS, TRAINING, TREES, arcPt, inPoly } from '../compound/plan';

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
const EDGE = 1.4; // how near the edge of the lawn you can walk
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
export const PROW_PLANT = [
  [48, 23],
  [55, 27],
].map(([x, y]) => planBox(x, y, x + 3, y + 2.4));
export const WING_PLANT = [0.25, 0.5, 0.75].map((k) => {
  const [x, y] = arcPt((CRES.rIn + CRES.rOut) / 2, CRES.a0 + (CRES.a1 - CRES.a0) * k);
  return planBox(x - 1.6, y - 1.2, x + 1.6, y + 1.2);
});
// the hangar roof's solar panels, in two rows of five
export const SOLAR = [0, 1, 2, 3, 4].flatMap((i) => [9.5, 18.9].map((x0) => planBox(x0, 19 + i * 6.6, x0 + 7.6, 19 + i * 6.6 + 4.8)));
// plant on the training center's roof and the lab's, and the main building's comms mast
export const ROOF_PLANT = [
  { id: 'hvac-0', foot: planBox(102, 29, 105, 31), y0: 7 * V, h: 7 * V + 2.4 },
  { id: 'hvac-1', foot: planBox(108, 28.6, 111, 30.6), y0: 7 * V, h: 7 * V + 2.4 },
  { id: 'hvac-2', foot: planBox(114, 28.2, 117, 30.2), y0: 7 * V, h: 7 * V + 2.4 },
  { id: 'hvac-3', foot: planBox(101.8, 73, 104.2, 77), y0: 6 * V, h: 6 * V + 2.2 },
];
export const COMMS = { x: 57, y: 21, h: 6.5 }; // on the plan; the mast's height over the roof
// what's up off the ground: the bridge, and what stands on the roofs
export const OVERHEAD = [
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
// the bridge itself, for the drawing and the camera: overhead from 4.6 to 7 units
export const BRIDGE_SPAN = { y0: 4.6 * V, y1: 7 * V };

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

// Out of a footprint, or `rad` clear of it, by the nearest edge.
function outOf(x, z, foot, rad) {
  const inside = inPoly(x, z, foot);
  const e = nearestEdge(x, z, foot);
  if (!inside && e.d >= rad) return [x, z];
  let ux;
  let uz;
  if (e.d > 1e-6) {
    ux = (x - e.x) / e.d;
    uz = (z - e.z) / e.d;
    if (inside) {
      ux = -ux;
      uz = -uz;
    }
  } else {
    // on the edge: out along its normal, whichever way leaves
    const l = Math.hypot(e.nx, e.nz) || 1;
    ux = e.nx / l;
    uz = e.nz / l;
    if (inPoly(e.x + ux * 0.01, e.z + uz * 0.01, foot)) {
      ux = -ux;
      uz = -uz;
    }
  }
  return [e.x + ux * rad, e.z + uz * rad];
}

// Back inside the lawn, `rad` from its edge.
function onLawn(x, z, rad) {
  const inside = inPoly(x, z, LAWN_W);
  const e = nearestEdge(x, z, LAWN_W);
  if (inside && e.d >= rad) return [x, z];
  let ux;
  let uz;
  if (e.d > 1e-6) {
    // from the edge towards the middle of the lawn
    ux = (x - e.x) / e.d;
    uz = (z - e.z) / e.d;
    if (!inside) {
      ux = -ux;
      uz = -uz;
    }
  } else {
    const l = Math.hypot(e.nx, e.nz) || 1;
    ux = e.nx / l;
    uz = e.nz / l;
    if (!inPoly(e.x + ux * 0.01, e.z + uz * 0.01, LAWN_W)) {
      ux = -ux;
      uz = -uz;
    }
  }
  return [e.x + ux * rad, e.z + uz * rad];
}

export const BODY = 1.7; // how tall he is, for heads under the bridge
const STEP = 0.35; // a ledge he steps up onto, rather than walks into
// whether a solid is in the way of someone whose feet are at `y`
const atHeight = (s, y) => y < s.h - STEP && y + BODY > s.y0;

// Where (x, z) ends up for something `rad` round with its feet at `y`: out of
// whatever's at that height (the buildings, and the things on the lawn), and
// on the lawn.
export function collide(x, z, rad, y = 0) {
  for (let pass = 0; pass < 2; pass++) {
    for (const b of SOLIDS) {
      if (!atHeight(b, y)) continue;
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - rad || x > x1 + rad || z < z0 - rad || z > z1 + rad) continue;
      [x, z] = outOf(x, z, b.foot, rad);
    }
    [x, z] = offRound(x, z, rad, y);
    [x, z] = onLawn(x, z, Math.max(rad, EDGE));
  }
  return [x, z];
}

function offRound(x, z, rad, y) {
  for (const c of ROUND) {
    if (y >= c.top) continue;
    const dx = x - c.x;
    const dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + rad;
    if (d < min) {
      if (d > 1e-6) {
        x = c.x + (dx / d) * min;
        z = c.z + (dz / d) * min;
      } else x = c.x + min;
    }
  }
  return [x, z];
}

// Whether (x, z) is somewhere you can stand (on the lawn, or a roof at `y`,
// and in nothing).
export function walkable(x, z, rad = HERO_R, y = 0) {
  const [cx, cz] = collide(x, z, rad, y);
  return Math.hypot(cx - x, cz - z) < 1e-6;
}

// The ground under (x, z) for someone whose feet are at `y`: the highest roof
// there he's on or over, or the lawn.
export function floorAt(x, z, y = 0) {
  let f = 0;
  for (const s of SOLIDS) {
    if (s.h > y + STEP || s.h <= f) continue;
    const [x0, z0, x1, z1] = s.box;
    if (x < x0 || x > x1 || z < z0 || z > z1) continue;
    if (inPoly(x, z, s.foot)) f = s.h;
  }
  return f;
}

// The way out of a footprint from (x, z) beside it: the nearest edge's normal.
function wallNormal(x, z, foot) {
  const e = nearestEdge(x, z, foot);
  let nx = e.nx;
  let nz = e.nz;
  const l = Math.hypot(nx, nz) || 1;
  nx /= l;
  nz /= l;
  if (inPoly(e.x + nx * 0.05, e.z + nz * 0.05, foot)) {
    nx = -nx;
    nz = -nz;
  }
  return { x: e.x, z: e.z, nx, nz };
}

// A body come to (x, y, z) from a height `py`: onto a roof it came down on,
// under whatever it hit its head on, out of the walls it went into, over the
// things on the lawn it cleared, still on the lawn, and down on the ground.
// → { x, y, z, landed (the floor it's down on, or null), head, wall (the
// solid it's against, with the way out of it: nx, nz), lawn (the way back
// onto the lawn, if it went off it) }
function collide3(py, x, y, z) {
  let landed = null;
  let head = false;
  let wall = null;
  let lawn = null;
  for (let pass = 0; pass < 2; pass++) {
    for (const s of SOLIDS) {
      if (y >= s.h || y + BODY <= s.y0) continue;
      const [x0, z0, x1, z1] = s.box;
      if (x < x0 - HERO_R || x > x1 + HERO_R || z < z0 - HERO_R || z > z1 + HERO_R) continue;
      const inside = inPoly(x, z, s.foot);
      if (inside && py >= s.h - 0.05) {
        // came down on its roof
        y = s.h;
        landed = Math.max(landed ?? 0, s.h);
        continue;
      }
      if (inside && py + BODY <= s.y0 + 0.05) {
        // came up under it
        y = s.y0 - BODY;
        head = true;
        continue;
      }
      const [ox, oz] = outOf(x, z, s.foot, HERO_R);
      if (ox === x && oz === z) continue;
      x = ox;
      z = oz;
      const n = wallNormal(x, z, s.foot);
      wall = { s, nx: n.nx, nz: n.nz };
    }
    [x, z] = offRound(x, z, HERO_R, y);
    const [lx, lz] = onLawn(x, z, Math.max(HERO_R, EDGE));
    if (lx !== x || lz !== z) {
      const d = Math.hypot(lx - x, lz - z) || 1;
      lawn = { nx: (lx - x) / d, nz: (lz - z) / d };
      x = lx;
      z = lz;
    }
  }
  const f = floorAt(x, z, Math.max(py, y));
  if (y <= f) {
    y = f;
    landed = f;
  }
  return { x, y, z, landed, head, wall, lawn };
}

// ── walking ──

// metres a second, and how fast he gets there: a brisk walk, a run like a
// super-hero's, and a spider's jump (about a metre and three quarters)
export const HERO = { walk: 2.8, run: 9.5, accel: 15, turn: 11, jump: 8.4, gravity: 21, air: 0.35 };

// Which of his clips for how fast he's going, given the one playing: each
// change a little past the line it's at, so speeding up or easing off across
// it doesn't flick from one clip to the other and back every frame
export function gaitFor(playing, speed) {
  const line = (HERO.walk + HERO.run) / 2.2;
  if (speed < (playing === 'idle' ? 0.5 : 0.3)) return 'idle';
  if (playing === 'run') return speed < line - 0.5 ? 'walk' : 'run';
  if (playing === 'walk') return speed > line + 0.5 ? 'run' : 'walk';
  return speed < line ? 'walk' : 'run';
}

// ── swinging, and climbing ──
// Engineered from how Insomniac describe their web-swinging and how the
// open re-creations of it work (docs/research/2026-10-05-web-swinging.md):
// a web only ever sticks to something real (a roof's edge, a tree, a mast),
// picked as the best point ahead and above for where he's going; the swing is
// a rope, but not pure physics: it turns toward where you steer, pushes him
// off a wall he's swinging alongside, keeps a chain of swings at its height,
// turns a dive into speed, and hangs him a beat at the top of each flight.
// Let go on the upswing, past the anchor, for a perfect release (faster,
// higher, a flip); go into a wall and he sticks to it, running up it with the
// speed he had; come down on a roof and he's on it. A web zip (Shift in the
// air) is a burst along the way he's going.
export const SWING = {
  reach: 46, // the furthest a web catches (m)
  minUp: 4.5, // an anchor at least this far over his feet
  near: 7, // and no nearer than this: that's no swing at all
  elev: [0.45, 1.3], // the web's angle above the horizontal a swing wants (radians: 26° to 75°)
  arm: 0.22, // seconds of a jump held from the ground before it becomes a web
  rearm: 0.2, // a beat after letting go before a held button webs again (no pumping speed out of web spam)
  pump: 6.5, // a swing's own push along its arc (m/s²): he swings, he doesn't just hang
  pumpMax: 1.25, // and it never pushes an arc past this far from the vertical (radians)
  assist: 1.2, // how fast a swing (and a flight, at half that) turns toward where you steer (rad/s)
  steer: 5, // and a little push that way besides (m/s²)
  takeUp: 14, // how fast a web takes up its slack (m/s)
  clear: 1.4, // the lowest a swing comes to the ground, or a roof
  dip: 6, // nor further than this under where he caught the web: a chain of swings keeps its height
  push: 14, // out from a wall he's swinging alongside (m/s²), within `pushAt` of it
  pushAt: 3.2,
  maxSpeed: 40,
  ceiling: 75, // the sky, as far as he goes
  drag: 0.0035, // air resistance, per metre a second
  hang: 0.6, // gravity at the top of a flight (|vy| < 3): a beat of hang time
  dive: 0.6, // how much of a dive's fall a web turns into speed along the way he's going
  release: { boost: 1.03, pop: 2.5, popMax: 12 }, // letting go on the way up
  perfect: { from: 0.2, to: 0.95, boost: 1.1, lift: 4 }, // the release window: past the vertical, forward (radians)
  letGo: 1.25, // that far past the anchor, the web would only pull him back: he lets go
  zip: { speed: 11, up: 3, cool: 0.6, charges: 2, max: 30, reach: 20 }, // a web zip: +11 m/s forward, two per flight
  corner: { turn: 1, reach: 28, out: 2.5, whip: 3, time: 0.6, cool: 1 }, // a corner swing: steer this hard (rad) near a corner, and the web goes to it
  point: { reach: 45, speed: 32, accel: 70, launch: { out: 15, up: 11 }, window: 0.6 }, // a point launch: zip to a perch, jump off it
  glide: { sink: 3, speed: 15, push: 6, turn: 0.9, above: 3 }, // web wings: held web, nothing to catch, falling
  climb: 4.2, // up a wall (m/s), and with Shift
  climbRun: 7,
  wallRun: { carry: 0.75, min: 8, max: 16, fade: 9 }, // the speed he hits a wall with, carried up it
  kick: { out: 7.5, up: 8.6 }, // off a wall
  restick: 0.4, // seconds before the wall he kicked off will hold him again
  stick: 1.5, // how hard into a wall he has to be going to stick to it (m/s)
};
// Air tricks, as Insomniac's: in free flight (off a web, a wall or a perch,
// not on a web), a press turns a flip (forward, or back with the stick
// pulled back) or a twist (with the stick to a side). Each is worth style
// points, more for each in a row without touching down; a perfect release
// counts too; landing banks the lot, landing mid-trick loses it (a bail).
// The Iron Man armour by the workshop's door: suit up in it (E at the
// plinth) and it flies, on its repulsors: it hovers, Space takes it up and
// Shift brings it down, the stick drives it, and it leans into its speed.
// E again steps out of it, wherever you are, and the armour goes home.
export const SUIT = {
  r: 3.2, // how near the plinth you have to be to suit up
  accel: 26, // along the stick (m/s²)
  lift: 22, // up with Space, and down with Shift (m/s²)
  top: 38, // as fast as it goes (m/s)
  climb: 16, // and up or down
  drag: 1.4, // how quickly it stops when nothing's pressed (per second)
  hover: 1.3, // how high over the ground it holds, idle
  turn: 7, // how quickly it faces the way it's going (rad/s)
  ceiling: 120,
};
export const nearArmour = (x, z) => Math.hypot(x - ARMOUR.x, z - ARMOUR.z) < SUIT.r;

export const TRICK = {
  time: 0.75, // seconds a trick takes
  gap: 0.1, // between one and the next
  points: { flip: 100, back: 120, twist: 110, perfect: 150 },
  minAir: 0.15, // seconds off the ground before a trick counts (not a hop)
  bail: 0.45, // the crouch a bail lands in (s)
};

// ── the settings (O): how it feels, each live and kept between visits ──
// `look` scales the drag and the pad's right stick; `invert` turns the pitch
// over; `camera` scales how far back the camera sits; `assist` how much a
// swing (and a flight) comes round toward where you steer; `follow` how
// quickly the camera comes round behind him; `shake` the field-of-view
// bumps and the speed lines.
export const SETTINGS = {
  look: { label: 'Look sensitivity', min: 0.4, max: 2, step: 0.05, value: 1, hint: 'How far a drag of the mouse, or the pad’s right stick, turns the view.' },
  invert: { label: 'Invert the pitch', toggle: true, value: 0, hint: 'Drag up to look down, as a pilot would.' },
  camera: { label: 'Camera distance', min: 0.7, max: 1.6, step: 0.05, value: 1, hint: 'How far behind him the camera sits. It pulls back on its own with speed.' },
  assist: { label: 'Swing assist', min: 0, max: 2, step: 0.1, value: 1, hint: 'How much a swing comes round toward where you steer. Off, it’s a rope and nothing else.' },
  follow: { label: 'Camera follow', min: 0, max: 2, step: 0.1, value: 1, hint: 'How quickly the camera drifts round behind him once you let the view go.' },
  shake: { label: 'Camera kick', min: 0, max: 1, step: 0.05, value: 1, hint: 'The bump in the view with every web, and the lines at the edges when he’s fast.' },
};
export const SETTINGS_DEFAULTS = Object.fromEntries(Object.entries(SETTINGS).map(([k, r]) => [k, r.value]));
// Settings as kept (or anything): each within its range, the rest as they came.
export function readSettings(raw) {
  const out = { ...SETTINGS_DEFAULTS };
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, r] of Object.entries(SETTINGS)) {
    const v = raw[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = r.toggle ? (v ? 1 : 0) : Math.max(r.min, Math.min(r.max, v));
  }
  return out;
}

export const newHero = (at = START) => ({
  x: at.x,
  z: at.z,
  y: at.y ?? 0,
  vy: 0,
  face: at.face ?? 0,
  vx: 0,
  vz: 0,
  speed: 0,
  running: false,
  air: false,
  mode: 'ground', // ground | air | swing | wall | zipto | perch | suit (the armour)
  flown: 0, // metres flown in the armour
  to: null, // a point launch's perch: { x, y, z, roof }
  perchT: 0, // after landing on a perch: a jump now is a point launch
  glide: false, // web wings out
  web: null, // { a: the point he swings about, at: where it sticks, len, target, hand }
  wall: null, // { id, nx, nz }: the solid he's on, and the way out of it
  airT: 0,
  held: false, // the web button, last step
  rearm: 0,
  zips: SWING.zip.charges,
  zipT: 0,
  cornerT: -SWING.corner.cool, // a corner swing's whip, seconds left (then its cool-down, down to -cool)
  stuck: 0,
  lastWall: null,
  runUp: 0, // speed carried up a wall
  fly: false, // off a web or a wall: his own momentum, not a jump's
  flip: 0, // a perfect release's flip, seconds left
  combo: 0,
  trick: null, // an air trick going: { kind: 'flip' | 'back' | 'twist', dir, t: seconds left }
  trickGap: 0,
  style: 0, // style points this flight, banked on landing
  land: 0, // a hard landing's crouch, seconds left
  climb: 0, // metres climbed, for his hands and feet
  ev: [], // what happened this step
});

// One step. `move` is where the visitor wants to go, already turned to the
// world (the camera does that, cameraMove): { x, z } up to length 1, `run`,
// `jump` (a press, not a hold), `web` (the jump button, held), `zip` and
// `perch` (presses), and `assist` (the settings' swing assist, 1 as it comes).
export function stepHero(h0, { x: mx = 0, z: mz = 0, run = false, jump = false, web = false, zip = false, perch = false, trick = false, suit = false, assist = 1 } = {}, dt) {
  const h = { ...h0, web: h0.web ? { ...h0.web } : null, ev: [] };
  h.mode ??= h.y > 0 ? 'air' : 'ground';
  h.stuck = Math.max(0, (h.stuck ?? 0) - dt);
  h.flip = Math.max(0, (h.flip ?? 0) - dt);
  h.land = Math.max(0, (h.land ?? 0) - dt);
  h.rearm = Math.max(0, (h.rearm ?? 0) - dt);
  h.zipT = Math.max(0, (h.zipT ?? 0) - dt);
  h.cornerT = Math.max(-SWING.corner.cool, (h.cornerT ?? -SWING.corner.cool) - dt);
  h.zips ??= SWING.zip.charges;
  const len = Math.hypot(mx, mz);
  const k = len > 1 ? 1 / len : 1;
  const i = { mx: mx * k, mz: mz * k, len: Math.min(1, len), run, jump, web, zip, assist };
  h.perchT = Math.max(0, (h.perchT ?? 0) - dt);
  h.trickGap = Math.max(0, (h.trickGap ?? 0) - dt);
  h.style ??= 0;
  // the armour: into it at the plinth, out of it anywhere
  if (suit) {
    if (h.mode === 'suit') suitOff(h);
    else if (h.mode === 'ground' && nearArmour(h.x, h.z)) suitUp(h);
  }
  // a point launch: to the perch ahead
  if (perch && h.mode !== 'zipto' && h.mode !== 'suit') pointLaunch(h, i);
  // an air trick: in free flight, and only one at a time
  if (trick && h.mode === 'air' && h.fly && !h.web && !h.glide && !h.trick && h.trickGap <= 0 && h.airT >= TRICK.minAir) startTrick(h, i);
  if (h.trick) {
    h.trick = { ...h.trick, t: h.trick.t - dt };
    if (h.trick.t <= 0) {
      h.trick = null;
      h.trickGap = TRICK.gap;
    }
  }
  if (h.mode === 'suit') stepSuit(h, i, dt);
  else if (h.mode === 'zipto') stepZipTo(h, dt);
  else if (h.mode === 'perch') stepPerch(h, i, dt);
  else if (h.mode === 'wall') stepWall(h, i, dt);
  else if (h.mode === 'ground') stepGround(h, i, dt);
  else stepAir(h, i, dt);
  // on something solid again: the zips come back
  if (h.mode === 'ground' || h.mode === 'wall' || h.mode === 'perch') h.zips = SWING.zip.charges;
  if (h.mode !== 'air') h.glide = false;
  h.held = Boolean(web);
  h.air = h.mode !== 'ground';
  return h;
}

// turned toward the way (dx, dz), at `rate`
function turnTo(h, dx, dz, rate, dt) {
  const want = Math.atan2(-dz, dx);
  let d = want - h.face;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  h.face += d * Math.min(1, rate * dt);
}

// his horizontal velocity turned toward (dx, dz), by at most `max` radians,
// keeping its speed (the swing-where-you-steer assist)
function steerToward(h, dx, dz, max) {
  const hs = Math.hypot(h.vx, h.vz);
  if (hs < 4 || max <= 0) return;
  let d = Math.atan2(dz, dx) - Math.atan2(h.vz, h.vx);
  d = Math.atan2(Math.sin(d), Math.cos(d));
  // (not round to go back the way he came: a hard turn is a corner, a little at a time)
  const t = Math.max(-max, Math.min(max, d));
  const c = Math.cos(t);
  const sn = Math.sin(t);
  const vx = h.vx * c - h.vz * sn;
  h.vz = h.vx * sn + h.vz * c;
  h.vx = vx;
}

function stepGround(h, { mx, mz, len, run, jump }, dt) {
  const top = run ? HERO.run : HERO.walk;
  const grip = Math.min(1, ((HERO.accel * dt) / Math.max(1, top)) * 2.2);
  let vx = h.vx + (mx * top - h.vx) * grip;
  let vz = h.vz + (mz * top - h.vz) * grip;
  if (len < 0.05 && Math.hypot(vx, vz) < 0.05) {
    vx = 0;
    vz = 0;
  }
  const [x, z] = collide(h.x + vx * dt, h.z + vz * dt, HERO_R, h.y);
  const moved = Math.hypot(x - h.x, z - h.z) / Math.max(dt, 1e-6);
  if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  h.vx = (x - h.x) / Math.max(dt, 1e-6);
  h.vz = (z - h.z) / Math.max(dt, 1e-6);
  h.x = x;
  h.z = z;
  h.speed = moved;
  h.running = run && moved > HERO.walk + 0.5;
  h.airT = 0;
  h.fly = false;
  h.web = null;
  h.wall = null;
  h.runUp = 0;
  if (jump && h.perchT > 0) {
    launchOff(h, { mx, mz, len });
    return;
  }
  if (jump) {
    h.mode = 'air';
    h.vy = HERO.jump - HERO.gravity * dt;
    h.y += h.vy * dt;
    h.ev.push({ type: 'jump' });
    return;
  }
  // off the edge of a roof
  const f = floorAt(x, z, h.y);
  h.vy = 0;
  if (f < h.y - 0.05) h.mode = 'air';
  else h.y = f;
}

// How far past straight down from the anchor he's swung, the way he's
// going: 0 under it, more once he's past it (radians).
export function pastAnchor(h, w = h.web) {
  if (!w) return 0;
  const hs = Math.hypot(h.vx, h.vz);
  if (hs < 0.5) return 0;
  const along = ((h.x - w.a[0]) * h.vx + (h.z - w.a[2]) * h.vz) / hs;
  return Math.atan2(along, w.a[1] - h.y);
}

// The rope a web wants: no longer than it is, short enough that the bottom
// of the swing clears the ground (or the roof) under him, and no more than
// `dip` under where he caught it.
function ropeFor(a, len, entry, floor) {
  const bottom = Math.max(floor + SWING.clear, entry - SWING.dip);
  return Math.max(4, Math.min(len, a[1] - bottom));
}

// A web out to the best anchor; false if there's nothing to catch.
function attach(h, turn) {
  const w = aimWeb(h, turn);
  if (!w) return false;
  // a dive into a web: the fall turned into speed along the way he's going
  if (h.vy < -8) {
    const hs = Math.hypot(h.vx, h.vz);
    const dx = hs > 1 ? h.vx / hs : Math.cos(h.face);
    const dz = hs > 1 ? h.vz / hs : -Math.sin(h.face);
    const more = (-h.vy - 8) * SWING.dive;
    h.vx += dx * more;
    h.vz += dz * more;
    h.vy *= 0.55;
    h.ev.push({ type: 'dive', more });
  }
  h.web = { a: w.a, at: w.at, len: w.len, target: ropeFor(w.a, w.len, h.y, floorAt(h.x, h.z, h.y)), hand: w.hand, entry: h.y };
  h.mode = 'swing';
  h.fly = true;
  h.trick = null;
  h.zips = SWING.zip.charges;
  h.ev.push({ type: 'web', at: w.at, hand: w.hand, kind: w.kind });
  return true;
}

function letGo(h) {
  const w = h.web;
  h.web = null;
  h.mode = 'air';
  h.rearm = SWING.rearm;
  const past = pastAnchor(h, w);
  const sp = Math.hypot(h.vx, h.vy, h.vz);
  const P = SWING.perfect;
  const R = SWING.release;
  // let go on the way up and he's flung on and up; on the way down, he drops
  if (h.vy > 0) {
    h.vx *= R.boost;
    h.vz *= R.boost;
    h.vy = Math.min(Math.max(h.vy, R.popMax), h.vy + R.pop);
  }
  if (past > P.from && past < P.to && h.vy > 0 && sp > 11) {
    h.vx *= P.boost;
    h.vy = h.vy * P.boost + P.lift;
    h.vz *= P.boost;
    h.combo = (h.combo ?? 0) + 1;
    h.flip = 0.7;
    h.style = (h.style ?? 0) + TRICK.points.perfect * h.combo;
    h.ev.push({ type: 'perfect', combo: h.combo, style: h.style });
  } else h.ev.push({ type: 'release' });
}

// The corners of the buildings a swing can whip round: { x, z, nx, nz (out
// along the corner's bisector), h (its roof), id }.
export const CORNERS = (() => {
  const out = [];
  for (const b of BUILDINGS) {
    if (b.h < 8 || b.id === 'pier') continue;
    const f = b.foot;
    for (let i = 0; i < f.length; i++) {
      const p = f[(i - 1 + f.length) % f.length];
      const v = f[i];
      const q = f[(i + 1) % f.length];
      const n1 = wallNormal((p[0] + v[0]) / 2, (p[1] + v[1]) / 2, f);
      const n2 = wallNormal((v[0] + q[0]) / 2, (v[1] + q[1]) / 2, f);
      // a real corner, not a bend in a curve, and one that sticks out
      if (n1.nx * n2.nx + n1.nz * n2.nz > 0.87) continue;
      let nx = n1.nx + n2.nx;
      let nz = n1.nz + n2.nz;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l;
      nz /= l;
      if (inPoly(v[0] + nx * 0.3, v[1] + nz * 0.3, f)) continue;
      out.push({ x: v[0], z: v[1], nx, nz, h: b.h, id: b.id });
    }
  }
  return out;
})();

// Where a point launch can land him: the masts' and flagpoles' tops, and the
// roofs' corners. { x, y, z, roof } (roof: it's a roof he can walk on from there)
export const PERCHES = [
  ...MASTS.map((m) => ({ x: m.x, y: MAST_H + 0.95, z: m.z, roof: false })),
  ...FLAGS.map((f) => ({ x: f.x, y: FLAG_H + 0.5, z: f.z, roof: false })),
  ...CORNERS.map((c) => ({ x: c.x - c.nx * 0.7, y: c.h, z: c.z - c.nz * 0.7, roof: true })),
];

// The perch a point launch would go to: ahead of him (where you steer, or he
// faces), in reach, the nearer the straighter ahead, with nothing in the way.
export function findPerch(h, { mx = 0, mz = 0, len = 0 } = {}) {
  let fx = len > 0.1 ? mx : Math.cos(h.face);
  let fz = len > 0.1 ? mz : -Math.sin(h.face);
  const l = Math.hypot(fx, fz) || 1;
  fx /= l;
  fz /= l;
  let best = null;
  for (const p of PERCHES) {
    const rx = p.x - h.x;
    const rz = p.z - h.z;
    const d = Math.hypot(rx, p.y - h.y, rz);
    if (d < 4 || d > SWING.point.reach) continue;
    const hd = Math.hypot(rx, rz) || 1;
    const ahead = (rx * fx + rz * fz) / hd;
    if (ahead < 0.55) continue;
    const score = d * (2 - ahead);
    if (best && score >= best.score) continue;
    if (!clearLine(h.x, h.y + 1.2, h.z, p.x, p.y + 0.5, p.z)) continue;
    best = { p, score };
  }
  return best?.p ?? null;
}

// A point launch: a web out to the perch, and he's pulled to it.
function pointLaunch(h, i) {
  const p = findPerch(h, i);
  if (!p) return;
  h.to = { ...p };
  h.web = null;
  h.wall = null;
  h.glide = false;
  h.mode = 'zipto';
  h.fly = true;
  h.ev.push({ type: 'point', at: [p.x, p.y + 0.3, p.z] });
}

function stepZipTo(h, dt) {
  const P = SWING.point;
  const t = h.to;
  const dx = t.x - h.x;
  const dy = t.y - h.y;
  const dz = t.z - h.z;
  const d = Math.hypot(dx, dy, dz);
  const sp = Math.min(P.speed, Math.hypot(h.vx, h.vy, h.vz) + P.accel * dt);
  if (d <= sp * dt + 0.3) {
    // there: on top of it
    Object.assign(h, { x: t.x, y: t.y, z: t.z, vx: 0, vy: 0, vz: 0, mode: t.roof ? 'ground' : 'perch', to: null, fly: false, trick: null, perchT: P.window, speed: 0 });
    h.ev.push({ type: 'perched' });
    return;
  }
  h.vx = (dx / d) * sp;
  h.vy = (dy / d) * sp;
  h.vz = (dz / d) * sp;
  h.x += h.vx * dt;
  h.y += h.vy * dt;
  h.z += h.vz * dt;
  turnTo(h, dx, dz, 10, dt);
  h.speed = sp;
}

// On a perch (a mast's or a flagpole's top): crouched there until he jumps
// (a point launch, forward and up), webs off, or steps off.
function stepPerch(h, { mx, mz, len, jump, web }, dt) {
  h.airT = 0;
  h.vx = h.vy = h.vz = 0;
  h.speed = 0;
  if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  if (jump) launchOff(h, { mx, mz, len });
  else if (web && !h.held) {
    h.mode = 'air';
    h.fly = true;
  } else if (len > 0.6 && h.perchT <= 0) {
    // off the edge
    h.mode = 'air';
    h.vx = mx * 3;
    h.vz = mz * 3;
  }
}

// Off a perch with a jump: the point launch, out and up
function launchOff(h, { mx, mz, len }) {
  const L = SWING.point.launch;
  const dx = len > 0.1 ? mx : Math.cos(h.face);
  const dz = len > 0.1 ? mz : -Math.sin(h.face);
  const l = Math.hypot(dx, dz) || 1;
  Object.assign(h, { mode: 'air', fly: true, vx: (dx / l) * L.out, vz: (dz / l) * L.out, vy: L.up, perchT: 0, airT: 0 });
  h.face = Math.atan2(-dz, dx);
  h.ev.push({ type: 'launch' });
}

// Into the armour: it lifts off the ground at once
function suitUp(h) {
  Object.assign(h, { mode: 'suit', fly: true, web: null, wall: null, glide: false, trick: null, to: null, vy: 3, airT: 0, speed: 0, running: false, flown: 0 });
  h.ev.push({ type: 'suitup' });
}
// Out of it: he's Spider-Man again, in the air wherever the armour was
function suitOff(h) {
  Object.assign(h, { mode: 'air', fly: true, airT: 0, held: true, rearm: SWING.rearm, flown: 0 });
  h.ev.push({ type: 'suitoff', x: h.x, y: h.y, z: h.z });
}
// The armour flying: it hovers, Space takes it up and Shift down, the stick
// drives it, and it goes no faster than it goes. Walls stop it, a roof or
// the lawn holds it up, and it keeps to the lawn.
function stepSuit(h, { mx, mz, len, run, web }, dt) {
  h.web = null;
  h.fly = true;
  h.airT += dt;
  let vx = h.vx + mx * SUIT.accel * dt;
  let vz = h.vz + mz * SUIT.accel * dt;
  let vy = h.vy;
  // up on the repulsors, down with Shift; idle, it holds its height
  if (web) vy += SUIT.lift * dt;
  else if (run) vy -= SUIT.lift * dt;
  else vy -= vy * Math.min(1, 4 * dt);
  const k = Math.exp(-SUIT.drag * dt);
  if (len < 0.05) {
    vx *= k;
    vz *= k;
  }
  const hs = Math.hypot(vx, vz);
  if (hs > SUIT.top) {
    vx *= SUIT.top / hs;
    vz *= SUIT.top / hs;
  }
  vy = Math.max(-SUIT.climb, Math.min(SUIT.climb, vy));
  // on its way, in steps short enough not to go through a wall
  const n = Math.max(1, Math.ceil((Math.hypot(vx, vy, vz) * dt) / 0.45));
  const sdt = dt / n;
  let { x, y, z } = h;
  for (let s = 0; s < n; s++) {
    const py = y;
    x += vx * sdt;
    y += vy * sdt;
    z += vz * sdt;
    if (y > SUIT.ceiling) {
      y = SUIT.ceiling;
      vy = Math.min(0, vy);
    }
    const c = collide3(py, x, y, z);
    x = c.x;
    y = c.y;
    z = c.z;
    if (c.head) vy = Math.min(0, vy);
    if (c.lawn) {
      const into = vx * c.lawn.nx + vz * c.lawn.nz;
      if (into < 0) {
        vx -= c.lawn.nx * into;
        vz -= c.lawn.nz * into;
      }
    }
    if (c.wall) {
      const into = -(vx * c.wall.nx + vz * c.wall.nz);
      if (into > 0) {
        vx += c.wall.nx * into;
        vz += c.wall.nz * into;
      }
    }
    // the ground (or a roof) holds it up: it hovers a little over it, never below
    const floor = floorAt(x, z, Math.max(py, y));
    if (y < floor + SUIT.hover && vy <= 0 && !run) {
      y = Math.min(floor + SUIT.hover, y + SUIT.hover * sdt * 2);
      vy = 0;
    } else if (c.landed != null && vy <= 0) {
      y = c.landed;
      vy = 0;
    }
  }
  h.flown = (h.flown ?? 0) + Math.hypot(x - h.x, y - h.y, z - h.z);
  Object.assign(h, { x, y, z, vx, vy, vz });
  const hs2 = Math.hypot(vx, vz);
  if (hs2 > 1.5) turnTo(h, vx, vz, SUIT.turn, dt);
  else if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  h.speed = hs2;
  h.running = false;
}

// A trick: a flip forward, a backflip with the stick pulled back, a twist
// with it to a side (against the way he's going), worth more for each in a row
function startTrick(h, { mx, mz, len }) {
  let kind = 'flip';
  let dir = 1;
  if (len > 0.3) {
    const hs = Math.hypot(h.vx, h.vz);
    const fx = hs > 1 ? h.vx / hs : Math.cos(h.face);
    const fz = hs > 1 ? h.vz / hs : -Math.sin(h.face);
    const along = mx * fx + mz * fz;
    const side = fx * mz - fz * mx;
    if (along < -0.5) kind = 'back';
    else if (Math.abs(side) > 0.5) {
      kind = 'twist';
      dir = side > 0 ? 1 : -1;
    }
  }
  h.trick = { kind, dir, t: TRICK.time };
  h.combo = (h.combo ?? 0) + 1;
  h.style = (h.style ?? 0) + TRICK.points[kind] * h.combo;
  h.ev.push({ type: 'trick', kind, dir, combo: h.combo, style: h.style });
}

// A corner swing: steering hard (the stick well off the way he's going) with
// a building's corner ahead on that side, the web goes to the top of the
// corner and he whips round it, as Insomniac's corner swings do.
function cornerSwing(h, turn) {
  const C = SWING.corner;
  const hs = Math.hypot(h.vx, h.vz);
  if (hs < 8) return;
  const fx = h.vx / hs;
  const fz = h.vz / hs;
  const off = Math.atan2(fx * turn.z - fz * turn.x, fx * turn.x + fz * turn.z);
  if (Math.abs(off) < C.turn) return;
  let best = null;
  for (const c of CORNERS) {
    if (c.h < h.y + 3) continue;
    const rx = c.x - h.x;
    const rz = c.z - h.z;
    const d = Math.hypot(rx, rz);
    if (d > C.reach || d < 4) continue;
    // ahead of him, and on the side he's turning to
    const ahead = rx * fx + rz * fz;
    const side = fx * rz - fz * rx;
    if (ahead < 0 || Math.sign(side) !== Math.sign(off)) continue;
    if (!best || d < best.d) best = { c, d };
  }
  if (!best) return;
  const { c } = best;
  const a = [c.x + c.nx * C.out, c.h - 0.5, c.z + c.nz * C.out];
  const at = [c.x + c.nx * 0.05, c.h - 0.1, c.z + c.nz * 0.05];
  if (!clearLine(h.x, h.y + 1.5, h.z, at[0], at[1], at[2])) return;
  const len = Math.hypot(a[0] - h.x, a[1] - h.y, a[2] - h.z);
  if (len > SWING.reach) return;
  const left = (a[0] - h.x) * fz - (a[2] - h.z) * fx;
  h.web = { a, at, len, target: ropeFor(a, len, h.web.entry ?? h.y, floorAt(h.x, h.z, h.y)), hand: left > 0 ? 'L' : 'R', entry: h.web.entry ?? h.y };
  h.cornerT = C.time;
  h.ev.push({ type: 'corner', at, hand: h.web.hand });
}

// A web zip: a quick web out ahead and a burst along it.
function webZip(h, { mx, mz, len }) {
  const hs = Math.hypot(h.vx, h.vz);
  let dx;
  let dz;
  if (len > 0.1) {
    dx = mx;
    dz = mz;
  } else if (hs > 1) {
    dx = h.vx / hs;
    dz = h.vz / hs;
  } else {
    dx = Math.cos(h.face);
    dz = -Math.sin(h.face);
  }
  const l = Math.hypot(dx, dz) || 1;
  dx /= l;
  dz /= l;
  const Z = SWING.zip;
  const along = Math.max(0, h.vx * dx + h.vz * dz);
  const want = Math.min(Z.max, along + Z.speed);
  // what's left of his speed off to the side mostly goes
  const sx = h.vx - dx * along;
  const sz = h.vz - dz * along;
  h.vx = dx * want + sx * 0.3;
  h.vz = dz * want + sz * 0.3;
  h.vy = Math.max(h.vy, Z.up);
  h.zips -= 1;
  h.zipT = Z.cool;
  h.fly = true;
  h.ev.push({ type: 'zip', at: [h.x + dx * Z.reach, h.y + 1.6 + Math.min(4, Z.reach * 0.12), h.z + dz * Z.reach] });
}

// The wall he's swinging alongside, if any: { nx, nz, d } (the way out of
// it and how far it is), and only one he's going along rather than into.
function alongside(h) {
  let best = null;
  for (const s of SOLIDS) {
    if (!atHeight(s, h.y)) continue;
    const [x0, z0, x1, z1] = s.box;
    const r = SWING.pushAt;
    if (h.x < x0 - r || h.x > x1 + r || h.z < z0 - r || h.z > z1 + r) continue;
    if (inPoly(h.x, h.z, s.foot)) continue;
    const e = nearestEdge(h.x, h.z, s.foot);
    if (e.d >= r || (best && e.d >= best.d)) continue;
    best = { nx: (h.x - e.x) / (e.d || 1), nz: (h.z - e.z) / (e.d || 1), d: e.d };
  }
  if (!best) return null;
  const hs = Math.hypot(h.vx, h.vz);
  if (hs > 1 && (h.vx * best.nx + h.vz * best.nz) / hs < -0.55) return null; // heading into it: let him hit it
  return best;
}

function stepAir(h, { mx, mz, len, run, web, zip, assist = 1 }, dt) {
  h.airT = (h.airT ?? 0) + dt;
  const turn = len > 0.1 ? { x: mx, z: mz } : null;
  // the web: shot as the button goes down in the air (or after a moment, held
  // from a jump), let go as it comes up
  if (h.web && !web) letGo(h);
  else if (!h.web && web && h.rearm <= 0 && (!h.held || h.airT >= SWING.arm)) attach(h, turn);
  if (zip && !h.web && h.zips > 0 && h.zipT <= 0) webZip(h, { mx, mz, len });
  // web wings: the web held, nothing in reach to catch, and a way down to fall
  const wasGliding = h.glide;
  h.glide = !h.web && web && (h.vy < -2.5 || h.glide) && h.y - floorAt(h.x, h.z, h.y) > SWING.glide.above;
  if (h.glide) {
    h.fly = true;
    if (!wasGliding) h.ev.push({ type: 'glide' });
  }
  // steering hard round a building's corner: the web goes to the corner, and he whips round it
  if (h.web && turn && h.cornerT <= -SWING.corner.cool) cornerSwing(h, turn);
  const w = h.web;
  if (h.fly && turn) {
    // he goes where you steer: the swing (or the flight) comes round toward it (fast, whipping round a corner)
    // (the assist is the settings', down to none: then it's a rope and nothing else)
    steerToward(h, mx, mz, SWING.assist * assist * (w ? 1 : 0.5) * (h.cornerT > 0 ? SWING.corner.whip : 1) * len * dt);
    h.vx += mx * SWING.steer * assist * dt;
    h.vz += mz * SWING.steer * assist * dt;
  }
  let vx = h.vx;
  let vy = h.vy;
  let vz = h.vz;
  if (!h.fly) {
    // a jump: a little say in where it goes, as on foot
    const top = run ? HERO.run : HERO.walk;
    const grip = HERO.air * Math.min(1, ((HERO.accel * dt) / Math.max(1, top)) * 2.2);
    vx += (mx * top - vx) * grip;
    vz += (mz * top - vz) * grip;
  }
  if (h.glide) {
    // web wings: the fall slowed to a glide, and on along the way he's going
    const G = SWING.glide;
    vy += (-G.sink - vy) * Math.min(1, 3 * dt);
    const hs = Math.hypot(vx, vz) || 1;
    const dx = hs > 1 ? vx / hs : Math.cos(h.face);
    const dz = hs > 1 ? vz / hs : -Math.sin(h.face);
    if (hs < G.speed) {
      vx += dx * G.push * dt;
      vz += dz * G.push * dt;
    }
  } else {
    // gravity, and a beat of hang time at the top of a flight
    vy -= HERO.gravity * (h.fly && !w && Math.abs(vy) < 3 ? SWING.hang : 1) * dt;
  }
  let sp = Math.hypot(vx, vy, vz);
  // air resistance, more the faster he goes
  const drag = Math.exp(-SWING.drag * sp * dt);
  vx *= drag;
  vy *= drag;
  vz *= drag;
  if (w) {
    // the swing's own push, along the way he's going, under the anchor, so
    // long as the arc wouldn't go past pumpMax for it
    const energy = 0.5 * sp * sp + HERO.gravity * (h.y - w.a[1]);
    const reach = -energy / (HERO.gravity * Math.max(1, w.len)); // cos of the furthest the arc goes
    if (sp > 1 && h.y < w.a[1] && reach > Math.cos(SWING.pumpMax)) {
      vx += (vx / sp) * SWING.pump * dt;
      vy += (vy / sp) * SWING.pump * dt;
      vz += (vz / sp) * SWING.pump * dt;
    }
    // pushed off a wall he's swinging alongside, and his swing with him (so
    // he swings down the middle, not along the wall), as Insomniac do
    const side = alongside({ ...h, vx, vz });
    if (side) {
      const k = 1 - side.d / SWING.pushAt;
      vx += side.nx * SWING.push * k * dt;
      vz += side.nz * SWING.push * k * dt;
      w.a = [w.a[0] + side.nx * 3 * k * dt, w.a[1], w.a[2] + side.nz * 3 * k * dt];
    }
    // the web takes up its slack, down to what it wants
    w.target = Math.min(w.target, ropeFor(w.a, w.len, w.entry, floorAt(h.x, h.z, h.y)));
    if (w.len > w.target) w.len = Math.max(w.target, w.len - SWING.takeUp * dt);
  }
  sp = Math.hypot(vx, vy, vz);
  if (sp > SWING.maxSpeed) {
    vx *= SWING.maxSpeed / sp;
    vy *= SWING.maxSpeed / sp;
    vz *= SWING.maxSpeed / sp;
  }

  // on its way, in steps short enough not to go through a wall
  const n = Math.max(1, Math.ceil((Math.hypot(vx, vy, vz) * dt) / 0.45));
  const sdt = dt / n;
  let { x, y, z } = h;
  const before = -vy;
  for (let s = 0; s < n; s++) {
    const py = y;
    x += vx * sdt;
    y += vy * sdt;
    z += vz * sdt;
    // the web is a rope: past its length it pulls him back onto the circle
    if (h.web) {
      const a = h.web.a;
      const dx = x - a[0];
      const dy = y - a[1];
      const dz = z - a[2];
      const l = Math.hypot(dx, dy, dz);
      if (l > h.web.len) {
        const ux = dx / l;
        const uy = dy / l;
        const uz = dz / l;
        x = a[0] + ux * h.web.len;
        y = a[1] + uy * h.web.len;
        z = a[2] + uz * h.web.len;
        const out = vx * ux + vy * uy + vz * uz;
        if (out > 0) {
          vx -= ux * out;
          vy -= uy * out;
          vz -= uz * out;
        }
      }
    }
    if (y > SWING.ceiling) {
      y = SWING.ceiling;
      vy = Math.min(0, vy);
    }
    const c = collide3(py, x, y, z);
    x = c.x;
    y = c.y;
    z = c.z;
    if (c.head) vy = Math.min(0, vy);
    if (c.lawn) {
      const into = vx * c.lawn.nx + vz * c.lawn.nz;
      if (into < 0) {
        vx -= c.lawn.nx * into;
        vz -= c.lawn.nz * into;
      }
    }
    if (c.landed != null && vy <= 0) {
      Object.assign(h, { x, y, z, vx, vz });
      land(h, before);
      return;
    }
    if (c.wall) {
      const into = -(vx * c.wall.nx + vz * c.wall.nz);
      const pushing = -(mx * c.wall.nx + mz * c.wall.nz) > 0.3;
      const fresh = h.stuck <= 0 || c.wall.s.id !== h.lastWall;
      if (fresh && c.wall.s.h - y > 0.25 && (into > SWING.stick || pushing)) {
        // a spider: he sticks to it, and the speed he hit it with carries him up it
        const hit = Math.hypot(vx, vy, vz);
        const R = SWING.wallRun;
        Object.assign(h, { x, y, z, vx: 0, vy: 0, vz: 0, mode: 'wall', web: null, fly: false, trick: null, wall: { id: c.wall.s.id, nx: c.wall.nx, nz: c.wall.nz } });
        h.runUp = hit > R.min ? Math.min(R.max, hit * R.carry) : 0;
        h.face = Math.atan2(c.wall.nz, -c.wall.nx);
        h.speed = 0;
        h.ev.push({ type: 'stick', id: c.wall.s.id, run: h.runUp });
        return;
      }
      // or slides along it
      if (into > 0) {
        vx += c.wall.nx * into;
        vz += c.wall.nz * into;
      }
    }
  }
  Object.assign(h, { x, y, z, vx, vy, vz });
  // well past the anchor, the web would only pull him back: he lets it go
  if (h.web && pastAnchor(h) > SWING.letGo) letGo(h);
  const hs = Math.hypot(vx, vz);
  if (h.fly) {
    if (hs > 1) turnTo(h, vx, vz, 8, dt);
  } else if (len > 0.05) turnTo(h, mx, mz, HERO.turn, dt);
  h.speed = hs;
  h.running = false;
}

function land(h, impact) {
  h.ev.push({ type: 'land', impact, x: h.x, y: h.y, z: h.z });
  h.mode = 'ground';
  h.vy = 0;
  h.web = null;
  h.fly = false;
  h.airT = 0;
  h.speed = Math.hypot(h.vx, h.vz);
  h.running = false;
  // the flight's style: banked, unless he's still mid-trick, which is a bail
  if (h.trick) {
    h.ev.push({ type: 'bail', style: h.style, combo: h.combo });
    h.trick = null;
    h.land = Math.max(h.land, TRICK.bail);
    h.vx *= 0.3;
    h.vz *= 0.3;
  } else if (h.style > 0) h.ev.push({ type: 'bank', style: h.style, combo: h.combo });
  h.style = 0;
  h.combo = 0;
  // a long way down: down on one knee, the way he does, and the run taken out of him
  if (impact > 14) {
    h.land = 0.45;
    h.vx *= 0.3;
    h.vz *= 0.3;
  }
}

function stepWall(h, { mx, mz, run, jump }, dt) {
  const s = solidById(h.wall?.id);
  if (!s) {
    h.mode = 'air';
    h.wall = null;
    return;
  }
  h.airT = 0;
  h.web = null;
  h.fly = false;
  const { nx, nz } = h.wall;
  const tx = -nz;
  const tz = nx;
  const c = run ? SWING.climbRun : SWING.climb;
  // into the wall climbs, away from it climbs down, and along it goes along
  const into = Math.max(-1, Math.min(1, -(mx * nx + mz * nz)));
  let up = into * c;
  const side = Math.max(-1, Math.min(1, mx * tx + mz * tz)) * c * 0.75;
  // the speed he hit it with, carried on up it (unless he's pulling away)
  if (h.runUp > 0) {
    if (into > -0.2) up = Math.max(up, h.runUp);
    h.runUp = Math.max(0, h.runUp - SWING.wallRun.fade * dt);
  }
  if (jump) {
    // off the wall: out, up, and on along it the way he was going
    h.mode = 'air';
    h.fly = true;
    h.vx = nx * SWING.kick.out + tx * side * 0.8;
    h.vz = nz * SWING.kick.out + tz * side * 0.8;
    h.vy = SWING.kick.up + Math.max(0, up) * 0.4;
    h.x += nx * 0.05;
    h.z += nz * 0.05;
    h.stuck = SWING.restick;
    h.lastWall = s.id;
    h.wall = null;
    h.runUp = 0;
    h.face = Math.atan2(-h.vz, h.vx);
    h.ev.push({ type: 'kick' });
    return;
  }
  const y = h.y + up * dt;
  // along it, and back onto it wherever that is (round a corner, round the curve)
  const e = wallNormal(h.x + tx * side * dt, h.z + tz * side * dt, s.foot);
  let x = e.x + e.nx * (HERO_R + 0.02);
  let z = e.z + e.nz * (HERO_R + 0.02);
  if (y >= s.h - 0.15) {
    // over the top, onto the roof (running, if he came up it at a run)
    let rx = e.x - e.nx * 0.9;
    let rz = e.z - e.nz * 0.9;
    if (!inPoly(rx, rz, s.foot)) {
      rx = e.x - e.nx * 0.3;
      rz = e.z - e.nz * 0.3;
    }
    const on = Math.max(2, Math.min(HERO.run, up * 0.6));
    Object.assign(h, { x: rx, z: rz, y: s.h, vx: -e.nx * on, vz: -e.nz * on, vy: 0, mode: 'ground', wall: null, speed: on, runUp: 0 });
    h.face = Math.atan2(e.nz, -e.nx);
    h.ev.push({ type: 'mantle', id: s.id });
    return;
  }
  [x, z] = onLawn(x, z, Math.max(HERO_R, EDGE));
  const f = floorAt(x, z, y);
  if (y <= f) {
    // climbed down to the ground (or a roof below)
    Object.assign(h, { x, z, y: f, vx: 0, vz: 0, vy: 0, mode: 'ground', wall: null, speed: 0, runUp: 0 });
    return;
  }
  if (y < s.y0 - 0.5) {
    // off the bottom of something overhead
    Object.assign(h, { x, z, y, vx: 0, vz: 0, vy: 0, mode: 'air', wall: null, speed: 0, runUp: 0 });
    return;
  }
  Object.assign(h, { x, z, y, vx: tx * side, vz: tz * side, vy: up, wall: { id: s.id, nx: e.nx, nz: e.nz } });
  h.face = Math.atan2(e.nz, -e.nx); // facing the wall
  h.speed = Math.hypot(up, side);
  h.climb = (h.climb ?? 0) + h.speed * dt;
  h.running = false;
}

// ── what a web can catch ──
// { a: the point he swings about, at: where the web sticks, n: the way out
// of the wall it's on (roof edges), kind }. Insomniac tag every edge in the
// city a web can stick to; here they're every roof's edges, the trees and the
// masts. A web sticks to a roof's edge, but he swings about a point a couple
// of metres out from the wall, as in every Spider-Man game: anchored at the
// wall itself, a swing would carry him into it.
const OUT = 2.2;
function edgeAnchors(s, every = 3.5) {
  const out = [];
  const f = s.foot;
  for (let i = 0; i < f.length; i++) {
    const [ax, az] = f[i];
    const [bx, bz] = f[(i + 1) % f.length];
    const l = Math.hypot(bx - ax, bz - az);
    if (l < 0.5) continue;
    const n = wallNormal((ax + bx) / 2, (az + bz) / 2, f);
    const k = Math.max(1, Math.round(l / every));
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const px = x + n.nx * OUT;
      const pz = z + n.nz * OUT;
      if (!inPoly(px, pz, LAWN_W) || BUILDINGS.some((o) => inPoly(px, pz, o.foot))) continue;
      out.push({ a: [px, s.h - 0.5, pz], at: [x + n.nx * 0.05, s.h - 0.1, z + n.nz * 0.05], n: [n.nx, n.nz], kind: 'roof', id: s.id });
    }
  }
  return out;
}
// the firs round the lawn (there are none on the river's side): the web goes
// into one a few metres back in the woods, but he swings along the lawn's edge
function woodsAnchors(every = 9) {
  const out = [];
  const f = LAWN_W;
  for (let i = 0; i < f.length; i++) {
    const [ax, az] = f[i];
    const [bx, bz] = f[(i + 1) % f.length];
    const l = Math.hypot(bx - ax, bz - az);
    const n = wallNormal((ax + bx) / 2, (az + bz) / 2, f);
    const k = Math.max(1, Math.round(l / every));
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (inPoly(x + n.nx * 5, z + n.nz * 5, RIVER_W) || inPoly(x + n.nx * 12, z + n.nz * 12, RIVER_W)) continue;
      out.push({ a: [x - n.nx * 3, 11.5, z - n.nz * 3], at: [x + n.nx * 5, 12.5, z + n.nz * 5], kind: 'tree' });
    }
  }
  return out;
}
// (the lawn's trees are 9 to 12.5 m tall, as the drawing has them)
export const treeHeight = (t) => 9 + t.tone * 3.5;
export const ANCHORS = [
  ...BUILDINGS.filter((b) => b.id !== 'pier').flatMap((b) => edgeAnchors(b)),
  ...['bridge', 'clerestory'].flatMap((id) => edgeAnchors(solidById(id))),
  ...woodsAnchors(),
  ...LAWN_TREES.map((t) => {
    const p = [t.x, treeHeight(t) * 0.78, t.z];
    return { a: p, at: p, kind: 'tree' };
  }),
  ...MASTS.map((m) => ({ a: [m.x, MAST_H - 1, m.z], at: [m.x, MAST_H - 0.6, m.z], kind: 'mast' })),
  ...FLAGS.map((f) => ({ a: [f.x, FLAG_H - 0.6, f.z], at: [f.x, FLAG_H - 0.3, f.z], kind: 'mast' })),
];

// Whether a web from (x0, y0, z0) to (x1, y1, z1) is clear of the buildings.
export function clearLine(x0, y0, z0, x1, y1, z1) {
  for (let i = 1; i < 8; i++) {
    const t = i / 8;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const z = z0 + (z1 - z0) * t;
    for (const s of SOLIDS) {
      if (y >= s.h - 0.3 || y <= s.y0) continue;
      const [bx0, bz0, bx1, bz1] = s.box;
      if (x < bx0 || x > bx1 || z < bz0 || z > bz1) continue;
      if (inPoly(x, z, s.foot)) return false;
    }
  }
  return true;
}

// Where a web shot now would catch, as Insomniac's and its re-creations'
// searches do it: a point he'd like to swing from, ahead of him (further the
// faster he goes, toward where you steer if you are) and above him (but not
// far above the height a chain of swings likes, so the next arc dips back
// down rather than stair-stepping up the roofs); then the anchor nearest it
// that's in reach, in front of the wall it's on, at a good angle up (26° to
// 75°), not off to one side, with nothing between him and it nor in the way
// of the swing. → { a, at, len, hand ('L' | 'R'), kind } or null.
export function aimWeb(h, turn = null) {
  const hs = Math.hypot(h.vx, h.vz);
  let fx = hs > 3 ? h.vx / hs : Math.cos(h.face);
  let fz = hs > 3 ? h.vz / hs : -Math.sin(h.face);
  if (turn) {
    // steering: the way he's going, bent toward the way you want
    fx = fx * 0.55 + turn.x * 0.9;
    fz = fz * 0.55 + turn.z * 0.9;
    const l = Math.hypot(fx, fz) || 1;
    fx /= l;
    fz /= l;
  }
  const speed = Math.hypot(h.vx, h.vy, h.vz);
  const floor = floorAt(h.x, h.z, h.y);
  const band = floor + Math.min(34, 24 + speed * 0.25);
  const high = h.y > band - 4;
  const minUp = high ? 2 : SWING.minUp;
  const ahead = Math.min(32, Math.max(12, 10 + speed * 0.6));
  const dy = Math.max(minUp + 1, Math.min(13 + speed * 0.2, band - h.y));
  const D = [h.x + fx * ahead, h.y + dy, h.z + fz * ahead];
  const [lo, hi] = SWING.elev;
  const pick = (strict) => {
    const found = [];
    for (const an of ANCHORS) {
      const rx = an.a[0] - h.x;
      const ry = an.a[1] - h.y;
      const rz = an.a[2] - h.z;
      if (ry < (strict ? minUp : SWING.minUp)) continue;
      const len = Math.hypot(rx, ry, rz);
      if (len < SWING.near || len > SWING.reach) continue;
      const fwd = rx * fx + rz * fz;
      if (fwd < (strict ? 1 : -1)) continue;
      // in front of the wall it's on, not along it or behind it
      if (an.n && (h.x - an.at[0]) * an.n[0] + (h.z - an.at[2]) * an.n[1] < (strict ? 2.5 : 0.5)) continue;
      const lat = Math.abs(rx * fz - rz * fx);
      const elev = Math.atan2(ry, Math.hypot(rx, rz));
      let score = Math.hypot(an.a[0] - D[0], an.a[1] - D[1], an.a[2] - D[2]) / 8;
      score += Math.max(0, lat - 14) * 0.3 + Math.max(0, lo - elev) * 4 + Math.max(0, elev - hi) * 3 - Math.min(fwd, 30) * 0.02;
      found.push({ an, len, score });
    }
    found.sort((p, q) => p.score - q.score);
    for (const f of found.slice(0, 10)) {
      const { an } = f;
      if (!clearLine(h.x, h.y + 1.5, h.z, an.at[0], an.at[1], an.at[2])) continue;
      // and the way down to the bottom of the swing is clear too
      const rope = ropeFor(an.a, f.len, h.y, floor);
      if (!clearLine(h.x, h.y + 1, h.z, an.a[0], an.a[1] - rope + 1, an.a[2])) continue;
      // the hand on the anchor's side (his left is +x when he faces +z)
      const left = (an.a[0] - h.x) * fz - (an.a[2] - h.z) * fx;
      return { a: [...an.a], at: [...an.at], len: f.len, hand: left > 0 ? 'L' : 'R', kind: an.kind };
    }
    return null;
  };
  // (and if nothing fits, whatever's in reach and over him)
  return pick(true) ?? pick(false);
}

// The walking keys and the stick, turned by the camera's yaw into the world.
export function cameraMove(yaw, forward, right) {
  return { x: -Math.sin(yaw) * forward + Math.cos(yaw) * right, z: -Math.cos(yaw) * forward - Math.sin(yaw) * right };
}
// the yaw that puts the camera behind a hero facing `face`
export const behindYaw = (face) => Math.atan2(-Math.cos(face), Math.sin(face));

// How far from the hero (lx, lz) out to the camera (cx, cy, cz) it can be
// before it's in a building, under the bridge's deck or out in the woods:
// 0 (at the hero) to 1 (all the way).
export function camRoom(lx, lz, cx, cy, cz) {
  const len = Math.hypot(cx - lx, cz - lz);
  const n = Math.max(1, Math.ceil(len / 0.25));
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = lx + (cx - lx) * t;
    const z = lz + (cz - lz) * t;
    const y = cy; // (the camera's height; it barely changes along the way)
    let hit = !inPoly(x, z, LAWN_W) && y < 22;
    for (const b of SOLIDS) {
      if (hit) break;
      if (y > b.h + 0.6 || y < b.y0 - 0.6) continue;
      const [x0, z0, x1, z1] = b.box;
      if (x < x0 - 0.4 || x > x1 + 0.4 || z < z0 - 0.4 || z > z1 + 0.4) continue;
      hit = inPoly(x, z, b.foot) || nearestEdge(x, z, b.foot).d < 0.4;
    }
    if (hit) return Math.max(0, (i - 1) / n - 0.04);
  }
  return 1;
}

// ── photo mode: time stopped, a camera to put anywhere round him ──
// { yaw, pitch, dist, fov }: round him, up over him (or a little under),
// how far, and the lens. photoView puts the camera there, looking at his
// chest, brought in rather than go into a building and never under the
// ground or a roof.
export const PHOTO = { dist: [1.6, 30], pitch: [-0.35, 1.45], fov: [18, 90] };
export const newPhoto = (yaw = 0, pitch = 0.25) => ({ yaw, pitch: Math.max(PHOTO.pitch[0], Math.min(PHOTO.pitch[1], pitch)), dist: 5.5, fov: 50 });
export function readPhoto(p) {
  const c = (v, [a, b], d) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d);
  return { yaw: Number.isFinite(p?.yaw) ? p.yaw : 0, pitch: c(p?.pitch, PHOTO.pitch, 0.25), dist: c(p?.dist, PHOTO.dist, 5.5), fov: c(p?.fov, PHOTO.fov, 50) };
}
export function photoView(h, photo) {
  const { yaw, pitch, dist } = readPhoto(photo);
  const look = [h.x, h.y + 1.1, h.z];
  let at = [h.x + Math.sin(yaw) * Math.cos(pitch) * dist, look[1] + Math.sin(pitch) * dist, h.z + Math.cos(yaw) * Math.cos(pitch) * dist];
  const k = camRoom(look[0], look[2], at[0], at[1], at[2]);
  if (k < 1) {
    const kk = Math.max(0.12, k);
    at = at.map((v, i) => look[i] + (v - look[i]) * kk);
  }
  const floor = floorAt(at[0], at[2], Math.max(at[1], h.y)) + 0.3;
  if (at[1] < floor) at[1] = floor;
  return { at, look };
}

// ── where you are ──

export function nearPlace(x, z, r = DOOR_R) {
  let best = null;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < r && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}
export const underPortal = (x, z) => Math.hypot(x - PORTAL.x, z - PORTAL.z) < PORTAL.r;

// Where the hero stands coming out of a place: a step outside its door,
// facing out.
export function outside(p) {
  return newHero({ x: p.x + Math.cos(p.face) * 1.6, z: p.z - Math.sin(p.face) * 1.6, face: p.face });
}

// ── the swing tour: rings round the compound, against the clock ──
// Up the main drive, under the bridge, round the back of the main building,
// over the glass wing's roof, past the training center and the lab's roof,
// and home by the gate. Through the first ring starts the clock.
export const RING_R = 3.2;
export const TOUR = (() => {
  const at = [
    [96, 5, 100],
    [84, 11, 66],
    [64, 8.5, 56],
    [64.5, 7, 41.5],
    [63, 11, 15],
    [95, 12, 6],
    [127, 31.5, 27],
    [140, 13, 60],
    [178, 10, 66],
    [160, 11, 102],
    [148, 18, 126],
    [104, 8, 132],
  ];
  return at.map(([x, y, z], i) => {
    // facing along the course: from the ring before toward the ring after
    const a = at[Math.max(0, i - 1)];
    const b = at[Math.min(at.length - 1, i + 1)];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
    return { x, y, z, n: [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l] };
  });
})();
// how long a tour may go without a ring before it's given up (s)
export const TOUR_GAP = 30;

// Whether going from p0 to p1 (his middle) took him through a ring.
export function throughRing(p0, p1, r, rad = RING_R + 0.5) {
  const d0 = (p0[0] - r.x) * r.n[0] + (p0[1] - r.y) * r.n[1] + (p0[2] - r.z) * r.n[2];
  const d1 = (p1[0] - r.x) * r.n[0] + (p1[1] - r.y) * r.n[1] + (p1[2] - r.z) * r.n[2];
  if (d0 > 0 || d1 < 0 || d0 === d1) return false; // (only forwards, along the course)
  const t = d0 / (d0 - d1);
  const qx = p0[0] + (p1[0] - p0[0]) * t - r.x;
  const qy = p0[1] + (p1[1] - p0[1]) * t - r.y;
  const qz = p0[2] + (p1[2] - p0[2]) * t - r.z;
  return Math.hypot(qx, qy, qz) < rad;
}

export const newTour = (best = null) => ({ on: false, next: 0, t: 0, since: 0, best });
// One step of the tour, from where he was (p0) to where he is (p1): → [tour, events]
export function stepTour(tour, p0, p1, dt) {
  const t = { ...tour };
  const ev = [];
  if (t.on) {
    t.t += dt;
    t.since += dt;
    if (t.since > TOUR_GAP) {
      ev.push({ type: 'tour-lost' });
      return [newTour(t.best), ev];
    }
  }
  if (throughRing(p0, p1, TOUR[t.next])) {
    if (t.next === 0) {
      t.on = true;
      t.t = 0;
      ev.push({ type: 'tour-start' });
    } else ev.push({ type: 'tour-ring', n: t.next });
    t.since = 0;
    t.next += 1;
    if (t.next === TOUR.length) {
      const best = t.best == null || t.t < t.best;
      ev.push({ type: 'tour-done', time: t.t, best });
      return [newTour(best ? t.t : t.best), ev];
    }
  }
  return [t, ev];
}

// ── Peter's backpacks ──
// He keeps losing them, and webs them up wherever he was when he noticed:
// a dozen of them round the compound, on the roofs, up the masts and under
// the bridge, each with something of his in it and a word about it. Walk
// (or swing, or land) up to one to find it. `at` is [x, y, z] in metres,
// where it sits (a roof, a mast's top, the ground); `where` is for the list.
const packAt = (id, [px, py, pz], where, memento, line) => ({ id, x: px, y: py, z: pz, where, memento, line });
const roofAt = (b, x, y) => [x * S, solidById(b).h, y * S];
export const PACK_R = 1.7; // how near his middle has to come to one
export const PACKS = [
  packAt('hangar', roofAt('hangar', 18, 58), 'The hangar’s roof, by the A', 'The Stark Internship badge', 'Mr. Stark said it was a real internship. The badge doesn’t open any doors. I checked.'),
  packAt('prow', roofAt('prow', 55, 22), 'The main building’s roof, by the comms mast', 'A Midtown Tech decathlon medal', 'Second place. Flash still says the Washington trip didn’t count.'),
  packAt('wing', [(CRES.cx + 32 * Math.cos((44.75 * Math.PI) / 180)) * S, solidById('wing').h, (CRES.cy + 32 * Math.sin((44.75 * Math.PI) / 180)) * S], 'The glass wing’s roof, between the plant rooms', 'Happy’s business card', 'He’s not answering the number on it. He never answers the number on it.'),
  packAt('clerestory', roofAt('clerestory', 110, 22.5), 'The top of the training center’s clerestory', 'A web-fluid cartridge, empty', 'Note to self: refill before patrol. Every time, Peter.'),
  packAt('lab', roofAt('lab', 92, 75.8), 'The lab’s roof, between the roof lights', 'Ned’s Lego Emperor Palpatine', 'He wants it back. He’s wanted it back since sophomore year.'),
  packAt('bridge', roofAt('bridge', 37, 26.2), 'On top of the bridge', 'Half a churro', 'A nice lady gave me this after I helped her with directions. I’m saving it.'),
  packAt('underbridge', [41 * S, 0, 26.2 * S], 'Under the bridge', 'A Stark Expo ticket stub, 2010', 'I was eight. There was a guy in a helmet. It’s a long story.'),
  packAt('mast', [MASTS[1].x, MAST_H + 0.95, MASTS[1].z], 'The top of a floodlight mast, by the helipad', 'Aunt May’s walnut date loaf, wrapped', 'Nobody eats it, but you take it. That’s the rule.'),
  packAt('gate', roofAt('gate', 42, 100), 'The gatehouse roof', 'A library book, three years overdue', 'Midtown’s going to find out eventually.'),
  packAt('berm', roofAt('berm', -12, 14.5), 'On the range’s berm', 'Clint’s practice arrow, snapped', 'He said keep it. He also said I can’t aim. Both true.'),
  packAt('stalls', roofAt('stalls', -12, 66), 'The roof of the range’s stalls', 'A Sokovia Accords pamphlet', 'I was going to read it on the plane. Then there was an airport.'),
  packAt('flag', [FLAGS[1].x, FLAG_H + 0.5, FLAGS[1].z], 'The top of the middle flagpole', 'MJ’s drawing of me in a crisis', 'She says it’s not a compliment. I’m keeping it anyway.'),
];
export const packById = (id) => PACKS.find((p) => p.id === id) ?? null;
// The backpack within reach of someone whose feet are at (x, y, z) that isn't
// among `found` (ids), nearest first; null if none.
export function nearPack(x, y, z, found = []) {
  let best = null;
  for (const p of PACKS) {
    if (found.includes(p.id)) continue;
    const d = Math.hypot(p.x - x, p.y + 0.3 - (y + 1), p.z - z);
    if (d < PACK_R && (!best || d < best.d)) best = { p, d };
  }
  return best?.p ?? null;
}

// ── the best lap, as a ghost ──
// A tour is recorded as it goes: where he is every tenth of a second, as
// [x, y, z, face] to a decimal, and the best lap's recording is kept, so
// the next tour can race it: a hologram of him going round his best time.
export const LAP = { every: 0.1, max: 1200 }; // samples: two minutes at most
// The recording with a sample added, if a tenth of a second has gone since
// the last (`t` is the tour's clock): → the recording (the same one if not).
export function recordLap(rec, h, t) {
  if (rec.length >= LAP.max) return rec;
  const n = rec.length;
  if (n && t < n * LAP.every - 1e-6) return rec;
  const r1 = (v) => Math.round(v * 10) / 10;
  return [...rec, [r1(h.x), r1(h.y), r1(h.z), Math.round(h.face * 100) / 100]];
}
// Where the ghost is at `t` seconds into the lap: between the samples either
// side, held at the ends. → { x, y, z, face, speed } or null for no lap.
export function lapAt(rec, t) {
  if (!rec?.length) return null;
  const k = Math.max(0, Math.min(rec.length - 1, t / LAP.every));
  const i = Math.floor(k);
  const a = rec[i];
  const b = rec[Math.min(rec.length - 1, i + 1)];
  const f = k - i;
  let df = b[3] - a[3];
  df = Math.atan2(Math.sin(df), Math.cos(df));
  return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, z: a[2] + (b[2] - a[2]) * f, face: a[3] + df * f, speed: Math.hypot(b[0] - a[0], b[2] - a[2]) / LAP.every };
}
// A recording as kept (or anything): a list of four-number samples, or null.
export const readLap = (raw) => (Array.isArray(raw) && raw.length > 1 && raw.every((p) => Array.isArray(p) && p.length === 4 && p.every(Number.isFinite)) ? raw.slice(0, LAP.max) : null);

// ── the heist so far ──

const WHOLE = ['space', 'mind', 'reality', 'power', 'time', 'soul'];

// From the stones earned (as hq/stones keeps them, halves of Soul included):
// each place done or not, the next one to go to, which stones are back,
// whether the portal is open, and the line at the top of the screen.
export function progress(earned = []) {
  const has = new Set(earned);
  const places = PLACES.map((p) => ({ ...p, done: p.stone ? has.has(p.stone) : false }));
  // (the gate has no stone: it's never the next one for the heist)
  const next = places.find((p) => p.stone && !p.done) ?? null;
  const have = WHOLE.filter((s) => has.has(s));
  const stones = have.length;
  const portal = has.has('space');
  const finished = !next;
  const objective = finished
    ? 'Every stone is back. The portal is open over the helipad: walk under it, and Thanos is on the other side.'
    : portal
      ? `The portal is open over the helipad. ${stones} of 6 stones: ${next.hint}`
      : next.hint;
  return { places, next: next?.id ?? null, have, stones, portal, finished, objective, done: places.filter((p) => p.done).map((p) => p.id) };
}

// ── how he holds himself on a swing ──
// Where he is on his arc, from the way he's going: -1 dropping into it behind
// the anchor, 0 at the bottom, 1 up past it (the angle off straight down,
// over 0.9 rad, kept to -1..1); 0 off a web or with no way to be going.
export function swingArc(h) {
  const w = h.web;
  const hs = Math.hypot(h.vx, h.vz);
  if (!w?.a || hs < 0.5) return 0;
  const along = ((h.x - w.a[0]) * h.vx + (h.z - w.a[2]) * h.vz) / hs;
  const s = Math.atan2(along, w.a[1] - h.y) / 0.9;
  return Math.max(-1, Math.min(1, s));
}

// His pose through the arc (the figure's frame: +z ahead, +y up his web, +x
// his left; `free` and `freeFore` are the free arm's, its x away from his
// side): legs trailing as he drops in, knees tucked through the bottom,
// legs thrown out ahead on the way up, leaning back, the free hand reaching
// up for the next web.
const SWING_KEYS = {
  in: { free: [0.85, -0.05, -0.45], freeFore: [0.55, 0.1, -0.6], thighL: [0.06, -1, -0.32], calfL: [0.04, -1, -0.5], thighR: [-0.06, -1, -0.22], calfR: [-0.04, -1, -0.6], foot: [0, -0.5, -0.9], pitch: -0.15 },
  low: { free: [0.95, -0.15, 0.3], freeFore: [0.7, 0.25, 0.55], thighL: [0.1, -0.35, 0.95], calfL: [0.05, -1, -0.1], thighR: [-0.1, -0.55, 0.85], calfR: [-0.05, -1, 0.05], foot: [0, -0.4, 0.9], pitch: 0.22 },
  out: { free: [0.35, 0.55, 0.8], freeFore: [0.2, 0.6, 0.85], thighL: [0.08, -0.4, 0.92], calfL: [0.05, -0.25, 1], thighR: [-0.08, -0.6, 0.8], calfR: [-0.05, -0.5, 0.9], foot: [0, 0.25, 1], pitch: -0.18 },
};
export function swingPose(s) {
  const k = Math.min(1, Math.abs(s));
  const a = SWING_KEYS.low;
  const b = s < 0 ? SWING_KEYS.in : SWING_KEYS.out;
  const out = { pitch: a.pitch + (b.pitch - a.pitch) * k };
  for (const key of Object.keys(a)) if (key !== 'pitch') out[key] = a[key].map((v, i) => v + (b[key][i] - v) * k);
  return out;
}
