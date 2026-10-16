// Moria, the land: outside, the shore under the cliff where the Doors of
// Durin are, with the lake to the south; inside, the passage in from the
// Doors, the fork's three archways, the great hall of pillars and the
// Chamber of Mazarbul off its north side. No drawing (./scene.js draws it,
// ./MoriaWorld.jsx drives it), so it can be tested on its own.
//
// The two are separate areas (`zone` 'gate' and 'halls'), each with its
// own ground, colliders and walls, in its own coordinates; the scene sets
// the halls well apart from the gate. The towns' conventions otherwise
// (../bree/layout.js): metres, +x east, +z south; a figure's `face` turns
// its +x to (cos face, -sin face); a building's `turn` faces its front
// (local +z).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';

// ── the West-gate ──

// the cliff's foot runs along z = CLIFF, the Doors in it at x = 0; the
// lake's edge is at z = SHORE; the shore runs out west to east
export const GATE = { cliff: -14, shore: 4, west: -26, east: 22, door: { x: 0, w: 3.6 } };
const HOLLY = [
  [-4.6, -12.4, 1],
  [4.6, -12.4, 1.05],
];
export const GATE_ROCKS = [
  [-18, -9, 1.3],
  [-11, 1.5, 0.9],
  [9, 0.8, 1.1],
  [15, -10, 1.4],
  [19, -4, 1],
];
const noise = makeNoise(37);
// the shore: rising a little towards the cliff, dropping into the lake
export function gateHeight(x, z) {
  let h = (fbm(noise, x * 0.08, z * 0.08, { octaves: 3 }) - 0.5) * 0.5;
  h += smooth(GATE.shore - 4, GATE.cliff, z) * 1.2;
  h -= smooth(GATE.shore - 0.5, GATE.shore + 2.5, z) * 2.4;
  // a flat apron of paving before the Doors
  const d = Math.hypot(x / 1.4, z - GATE.cliff - 3);
  const k = 1 - smooth(2.5, 4.5, d);
  if (k > 0) h += (1.15 - h) * k;
  return h;
}
// the water's surface
export const LAKE_Y = -0.9;
export const inLake = (x, z) => z > GATE.shore + 0.6;

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });

export const GATE_COLLIDERS = [...HOLLY.map(([x, z, s], i) => circle(`holly${i}`, x, z, 0.5 * s, { top: 7 })), ...GATE_ROCKS.map(([x, z, s], i) => circle(`rock${i}`, x, z, 0.9 * s, { low: true, top: 1.5 * s }))];
// the cliff (but the Doors, when they're open), and the ends of the shore
const dw = GATE.door.w / 2;
export const GATE_WALLS = [
  [GATE.west - 2, GATE.cliff, -dw, GATE.cliff, 0.4],
  [dw, GATE.cliff, GATE.east + 2, GATE.cliff, 0.4],
  [GATE.west, GATE.cliff, GATE.west, GATE.shore + 3, 0.4],
  [GATE.east, GATE.cliff, GATE.east, GATE.shore + 3, 0.4],
];
// the Doors, while they're shut
export const DOOR_WALL = [[-dw, GATE.cliff, dw, GATE.cliff, 0.4]];
export const GATE_START = { x: -20, z: -3, face: 0.25 };
// where the Watcher's dash begins: out on the shore, where the tentacle
// first takes Frodo
export const DASH_START = { x: 3.5, z: 1.4, face: Math.PI / 2 + 0.3 };

// ── the halls ──

// The great hall: a grid of pillars in a hall `w` by `d`, centred on the
// origin; the fork's wall at its west end, with three passages, and the
// passage from the Doors beyond it; the Chamber of Mazarbul off the north
// wall; the way out to the stair at the east.
export const HALL = { w: 60, d: 40, pillar: 2.6, spacing: 9 };
export const PILLARS = (() => {
  const out = [];
  for (let x = -HALL.w / 2 + 6; x <= HALL.w / 2 - 4; x += HALL.spacing)
    for (let z = -HALL.d / 2 + 6.5; z <= HALL.d / 2 - 6; z += HALL.spacing) {
      // the way across the middle is kept clear
      out.push({ x, z, w: HALL.pillar });
    }
  return out;
})();
// the fork: a wall across the passage, its three ways at these z; only one
// goes on, the others end in fallen rock
export const FORK = { x: -HALL.w / 2 - 4, ways: [-4.5, 0, 4.5], right: 2 };
// the passage in from the Doors, west of the fork
export const PASSAGE = { x0: -HALL.w / 2 - 22, x1: FORK.x, w: 14 };
// the Chamber of Mazarbul, its door in the hall's north wall
export const CHAMBER = { x: 6, z: -HALL.d / 2 - 8, w: 16, d: 14, door: 3.2 };
// (as ./props.js chamber() builds them: the tomb in the middle, the well
// in the back right corner, three columns down each side wall)
export const TOMB = { x: CHAMBER.x, z: CHAMBER.z, w: 2.8, d: 1.5 };
export const WELL = { x: CHAMBER.x + 5, z: CHAMBER.z - 5, r: 1.05 };
const CHAMBER_COLUMNS = [-7, 7].flatMap((dx) => [-4.5, 0, 4.5].map((dz) => ({ x: CHAMBER.x + dx, z: CHAMBER.z + dz, r: 0.72 })));
// the way out to the stair and the bridge
export const EAST_DOOR = { x: HALL.w / 2, z: 0, w: 4 };
// on the side: an old shaft in the floor between the pillars of the hall's
// south-west, with a plank laid across it (`plank` long, east to west)
export const SHAFT = { x: -10.5, z: 9, r: 1.45, plank: 3.9 };

// the floor of the halls is level, but for steps up to the fork
export const hallHeight = (x) => (x < FORK.x + 1 ? 0.6 * smooth(FORK.x + 1, FORK.x - 1, x) : 0);

// a wall from (x0, z0) to (x1, z1), thick, with gaps [from, to] along it
// (measured from its start)
function wall(x0, z0, x1, z1, gaps = [], thick = 0.5) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const out = [];
  let at = 0;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > at) out.push([x0 + ((x1 - x0) * at) / len, z0 + ((z1 - z0) * at) / len, x0 + ((x1 - x0) * a) / len, z0 + ((z1 - z0) * a) / len, thick]);
    at = b;
  }
  if (at < len) out.push([x0 + ((x1 - x0) * at) / len, z0 + ((z1 - z0) * at) / len, x1, z1, thick]);
  return out;
}
const hw = HALL.w / 2;
const hd = HALL.d / 2;
const pw = PASSAGE.w / 2;
const way = 2.2;
export const HALL_WALLS = [
  // the great hall: north (the chamber's door in it), south, and east (its
  // door out to the stair)
  ...wall(-hw, -hd, hw, -hd, [[CHAMBER.x + hw - CHAMBER.door / 2, CHAMBER.x + hw + CHAMBER.door / 2]]),
  ...wall(-hw, hd, hw, hd),
  ...wall(hw, -hd, hw, hd, [[hd + EAST_DOOR.z - EAST_DOOR.w / 2, hd + EAST_DOOR.z + EAST_DOOR.w / 2]]),
  // the hall's west wall, open where the right passage comes in
  ...wall(-hw, -hd, -hw, hd, [[hd + FORK.ways[FORK.right] - way / 2, hd + FORK.ways[FORK.right] + way / 2]]),
  // the fork's wall, with its three ways
  ...wall(FORK.x, -pw, FORK.x, pw, FORK.ways.map((z) => [pw + z - way / 2, pw + z + way / 2])),
  // the passages behind each way: two walls each; the wrong ones end in rock
  ...FORK.ways.flatMap((z, i) => [
    [FORK.x, z - way / 2 - 0.25, -hw, z - way / 2 - 0.25, 0.25],
    [FORK.x, z + way / 2 + 0.25, -hw, z + way / 2 + 0.25, 0.25],
    ...(i === FORK.right ? [] : [[FORK.x + 2.5, z - way / 2, FORK.x + 2.5, z + way / 2, 0.6]]),
  ]),
  // the passage in from the Doors
  ...wall(PASSAGE.x0, -pw, FORK.x, -pw),
  ...wall(PASSAGE.x0, pw, FORK.x, pw),
  [PASSAGE.x0, -pw, PASSAGE.x0, pw, 0.5],
  // the chamber's walls, open to the hall at its door
  ...wall(CHAMBER.x - CHAMBER.w / 2, CHAMBER.z - CHAMBER.d / 2, CHAMBER.x + CHAMBER.w / 2, CHAMBER.z - CHAMBER.d / 2),
  [CHAMBER.x - CHAMBER.w / 2, CHAMBER.z - CHAMBER.d / 2, CHAMBER.x - CHAMBER.w / 2, -hd, 0.5],
  [CHAMBER.x + CHAMBER.w / 2, CHAMBER.z - CHAMBER.d / 2, CHAMBER.x + CHAMBER.w / 2, -hd, 0.5],
];
export const HALL_COLLIDERS = [
  ...PILLARS.map((p, i) => box(`pillar${i}`, { x: p.x, z: p.z, w: p.w, d: p.w }, { top: 30 })),
  box('tomb', TOMB, { low: true, top: 1.2 }),
  circle('well', WELL.x, WELL.z, WELL.r, { low: true, top: 1 }),
  circle('shaft', SHAFT.x, SHAFT.z, SHAFT.r, { low: true, top: 0.2 }),
  ...CHAMBER_COLUMNS.map((c, i) => circle(`column${i}`, c.x, c.z, c.r, { top: 10 })),
];
// the chamber's doors, when they're barred
export const CHAMBER_DOOR_WALL = [[CHAMBER.x - CHAMBER.door / 2, -hd, CHAMBER.x + CHAMBER.door / 2, -hd, 0.5]];

// where you come in, and the places to stop
export const HALL_START = { x: PASSAGE.x0 + 3, z: 0, face: 0 };
export const SPOTS = [
  { zone: 'gate', id: 'doors', x: 0, z: GATE.cliff + 3, r: 2.6 },
  { zone: 'halls', id: 'tomb', x: CHAMBER.x, z: -hd + 2, r: 2.8 },
  { zone: 'halls', id: 'east', x: EAST_DOOR.x - 2.5, z: EAST_DOOR.z, r: 2.6 },
  // on the side: the west end of the plank over the old shaft
  { zone: 'halls', id: 'plank', x: SHAFT.x - SHAFT.plank / 2 - 0.5, z: SHAFT.z, r: 1.3 },
];
export const spot = (id) => SPOTS.find((s) => s.id === id);
// in the chamber, where the troll comes in and walks; and where Frodo
// stands when it starts
export const TROLL_ROUNDS = [
  [
    [CHAMBER.x, CHAMBER.z + 5.2],
    [CHAMBER.x + 4.2, CHAMBER.z + 0.5],
    [CHAMBER.x, CHAMBER.z - 4.6],
    [CHAMBER.x - 4.2, CHAMBER.z + 0.5],
  ],
];
export const TROLL_FRODO = { x: CHAMBER.x - 5.6, z: CHAMBER.z - 5.4, face: 0 };
export const TROLL_ZONE = { x0: CHAMBER.x - CHAMBER.w / 2, x1: CHAMBER.x + CHAMBER.w / 2, z0: CHAMBER.z - CHAMBER.d / 2, z1: -hd };

// the Fellowship with Frodo, in the order they walk: Gandalf leads them
export const COMPANY = ['gandalf', 'aragorn', 'sam', 'gimli', 'legolas', 'merry', 'pippin', 'boromir'];

// Who's about, by how far you've got (`while`) and where (`zone`).
export const CAST = [
  { zone: 'gate', id: 'gandalf-gate', name: 'Gandalf', x: -1.6, z: GATE.cliff + 2.2, face: Math.PI / 2, look: 'gandalf', while: ['doors'], lines: ['“The walls of Moria. Dwarf doors are invisible when closed.”', '“Ithildin. It mirrors only starlight and moonlight.”'] },
  { zone: 'gate', id: 'sam-gate', name: 'Samwise Gamgee', x: -9, z: -1.5, face: 0, look: 'sam', while: ['doors'], lines: ['“Goodbye, Bill.” He looks back down the road. “Go on, Bill, go on. Don’t worry, Sam; he knows the way home.”', '“I don’t like this place, Mr. Frodo.”'] },
  { zone: 'gate', id: 'boromir-gate', name: 'Boromir', x: 7.5, z: 0.2, face: Math.PI, look: 'boromir', while: ['doors'], lines: ['He tosses a stone into the still water. The ripples spread a long way.', '“What is it?”'] },
  { zone: 'gate', id: 'gimli-gate', name: 'Gimli', x: 3.2, z: -9.6, face: Math.PI, look: 'gimli', while: ['doors'], lines: ['“Soon, Master Elf, you will enjoy the fabled hospitality of the Dwarves: roaring fires, malt beer, ripe meat off the bone!”'] },
  { zone: 'halls', id: 'gandalf-fork', name: 'Gandalf', x: FORK.x - 3.2, z: -1.5, face: 0, look: 'gandalf', while: ['dark'], lines: ['“I have no memory of this place.”', '“Ah. It’s that way.” No: he’s still thinking.'] },
  { zone: 'halls', id: 'merry-fork', name: 'Merry Brandybuck', x: FORK.x - 6, z: 3, face: 0, look: 'merry', while: ['dark'], lines: ['“Are we lost?”', '“I think we are.”'] },
  { zone: 'halls', id: 'pippin-fork', name: 'Pippin Took', x: FORK.x - 6.5, z: 4.6, face: -0.3, look: 'pippin', while: ['dark'], lines: ['“Gandalf’s thinking.”', '“Merry?” Merry looks round. “I’m hungry.”'] },
  { zone: 'halls', id: 'gimli-hall', name: 'Gimli', x: CHAMBER.x - 1.5, z: -hd + 3.5, face: Math.PI / 2, look: 'gimli', while: ['tomb'], lines: ['“Balin! Balin!” He runs for the chamber.'] },
];
export const castFor = (zone, next) => CAST.filter((c) => c.zone === zone && (!c.while || c.while.includes(next)));

// The flight down the stair and across the bridge: how far along the run
// the gap in the stair is, and where the bridge begins and ends.
// (the stair is ./props.js stairs(): 14.4 m long, 12 m down, broken a
// third of the way up from its foot)
export const FLIGHT = { ledge: [0, 14], stair: [14, 28.4], gap: [22.6, 24.5], drop: 12, bridge: [40, 80], end: 86 };

// A saved spot, if it's a fair one: in the halls only once you're in, and
// never inside anything.
export function validAt(saved, done = []) {
  const inside = done.includes('doors');
  const back = inside ? { zone: 'halls', ...HALL_START } : { zone: 'gate', ...GATE_START };
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if ((saved.zone === 'halls') !== inside) return back;
  const [cs, ws] = inside ? [HALL_COLLIDERS, HALL_WALLS] : [GATE_COLLIDERS, [...GATE_WALLS, ...DOOR_WALL]];
  if (!inside && inLake(saved.x, saved.z)) return back;
  if (inside && (saved.x < PASSAGE.x0 || saved.x > HALL.w / 2 || saved.z < CHAMBER.z - CHAMBER.d / 2 || saved.z > HALL.d / 2)) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, cs, ws);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { zone: saved.zone, x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
// which of the fork's ways (0, 1, 2) a point in the passages is in, or -1
export function wayAt(x, z) {
  if (x < FORK.x || x > -HALL.w / 2) return -1;
  return FORK.ways.findIndex((w) => Math.abs(z - w) < way / 2 + 0.3);
}
