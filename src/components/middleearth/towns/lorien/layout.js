// Lothlórien, the wood: in over the Nimrodel at the west, a path winding
// east among the mallorns to Caras Galadhon round its great tree, the
// Mirror's hollow to the south of it, and the landing on the Silverlode
// at the east, where the boats are. No drawing (./scene.js draws it,
// ./LorienWorld.jsx drives it), so it can be tested on its own.
//
// The river (the Anduin, down to the Argonath) is a separate stretch, run
// on rails (./rules.js RIVER), drawn well apart. The towns' conventions
// otherwise (../bree/layout.js): metres, +x east, +z south; a figure's
// `face` turns its +x to (cos face, -sin face).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { seeded } from './rules';
import { CARAS } from './story';
import { pushOut } from '../walker';

// the wood you can walk in
export const WOOD = { west: -74, east: 62, north: -48, south: 48 };
// the Nimrodel, along the west edge (you came over it)
export const streamX = (z) => -78 + 1.6 * Math.sin(z * 0.08);
export const START = { x: -69, z: 2, face: 0 };

// the great mallorn at the heart of Caras Galadhon, its stair up to the
// high flet, and the city's lesser trees round it: [angle, distance,
// trunk radius]
export const TREE = { x: 22, z: -4, r: 2.6, flet: 18 };
export const STAIR = { r: TREE.r + 0.6, rise: TREE.flet, turns: 1.25, start: Math.PI };
export const CITY = [
  [-2.6, 17, 1.5],
  [-1.75, 18.5, 1.4],
  [-0.95, 16, 1.6],
  [0.6, 17.5, 1.45],
  [2.45, 18, 1.5],
].map(([a, d, r]) => ({ x: TREE.x + Math.cos(a) * d, z: TREE.z + Math.sin(a) * d, r }));
// the Mirror, in its hollow, and the landing, with the gifts' table
// (the Mirror's hollow is ringed by a bank of earth, ./props.js mirror():
// its floor level with the wood, its crest `rim` high, its outer foot at
// `foot`; the steps come down it from the north)
export const MIRROR = { x: 22, z: 30, floor: 4.8, crest: 7.2, rim: 1.7, foot: 13.5 };
MIRROR.r = MIRROR.foot;
export const LANDING = { x: 59, z: -13 };
export const TABLE = { x: 51.5, z: -8.5, w: 2.4, d: 1 };
// the river's edge
export const BANK = WOOD.east;

// the paths: [x, z] points
export const PATHS = [
  [[START.x - 2, START.z], [-60, -3], [-48, 1], [-36, -5], [-24, -3], [-12, 1], [-2, 0], [6, -2], [TREE.x - STAIR.r - 2.4, TREE.z]],
  [[TREE.x, TREE.z + TREE.r + 2], [TREE.x + 1.5, TREE.z + 14], [MIRROR.x + 0.6, MIRROR.z - MIRROR.crest - 1.2]],
  [[TREE.x + TREE.r + 2, TREE.z], [36, -7], [46, -11], [LANDING.x, LANDING.z]],
];
// Haldir's way, from where he stops you to the city's edge
export const LEAD = [[-43, 0], [-36, -5], [-24, -3], [-12, 1], [-2, 0], [5, -1.5]];
// where the Galadhrim stand, bows drawn, round the path: [x, z]
export const AMBUSH = { x: -47, z: 0, r: 6.5 };
export const GALADHRIM = [0.4, 1.3, 2.1, 2.9, 3.7, 4.5, 5.3].map((a) => [AMBUSH.x + Math.cos(a) * AMBUSH.r, AMBUSH.z + Math.sin(a) * AMBUSH.r]);

// the distance from a point to a polyline
export function toPath(x, z, path) {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
export const nearPath = (x, z) => Math.min(...PATHS.map((p) => toPath(x, z, p)));

// Who's about, by how far you've got (`while`): the Fellowship, Haldir,
// the Lord and Lady. `look` is who they're drawn as.
export const CAST = [
  { id: 'gimli-wood', name: 'Gimli', look: 'gimli', x: -63, z: 6.5, face: 0, while: ['haldir'], lines: ['“Stay close, young hobbits! They say a great sorceress lives in these woods. An elf-witch, of terrible power. All who look upon her fall under her spell…”', '“Well, here’s one dwarf she won’t ensnare so easily. I have the eyes of a hawk and the ears of a fox!”'] },
  { id: 'sam-wood', name: 'Samwise Gamgee', look: 'sam', x: -66, z: -2.5, face: 0.3, while: ['haldir'], lines: ['“Mr. Frodo? Are you all right?”', 'He looks up at the golden trees. “I’ve never seen anything like it.”'] },
  { id: 'aragorn-wood', name: 'Aragorn', look: 'aragorn', x: -58, z: -6.5, face: 0, while: ['haldir'], lines: ['“Gandalf’s death was not in vain. Nor would he have you give up hope.”'] },
  { id: 'legolas-wood', name: 'Legolas', look: 'legolas', x: -55, z: 4, face: 0, while: ['haldir'], lines: ['He stops, and listens to the trees. “We are watched.”'] },
  { id: 'haldir-city', name: 'Haldir', look: 'haldir', x: TREE.x - STAIR.r - 2.6, z: TREE.z + 2.6, face: 0, while: ['caras'], lines: [CARAS, '“Up the stair. The Lady is expecting you.”'] },
  { id: 'legolas-city', name: 'Legolas', look: 'legolas', x: 3, z: 4, face: 0.2, while: ['caras'], lines: ['“The Galadhrim have not walked with dwarves for a long time.”'] },
  { id: 'gimli-city', name: 'Gimli', look: 'gimli', x: 7.5, z: -7, face: 0.2, while: ['caras'], lines: ['He keeps a hand on his axe, and his eyes on the lanterns.', '“A sorceress, I tell you.” Quieter now.'] },
  { id: 'sam-night', name: 'Samwise Gamgee', look: 'sam', x: TREE.x + 4.6, z: TREE.z + 8, face: Math.PI / 2, while: ['mirror'], lines: ['“I don’t think he would have wanted fireworks… The finest rockets ever seen, they burst in stars of blue and green, or after thunder silver showers came falling like a rain of flowers.” He stops. “Oh, that doesn’t do them justice by a long road.”'] },
  { id: 'legolas-night', name: 'Legolas', look: 'legolas', x: TREE.x - 6, z: TREE.z + 6, face: 0, while: ['mirror'], lines: ['The elves are singing, high and far off in the trees. “A lament for Gandalf. I have not the heart to tell you. For me the grief is still too near.”'] },
  { id: 'boromir-night', name: 'Boromir', look: 'boromir', x: TREE.x + 7, z: TREE.z - 5, face: Math.PI, while: ['mirror'], lines: ['“In the darkness she spoke to me. She said to me, ‘Boromir, there is hope.’ But I see no hope.”', '“My father is a noble man, but his rule is failing.”'] },
  { id: 'galadriel-mirror', name: 'Galadriel', look: 'galadriel', x: MIRROR.x + 1.6, z: MIRROR.z + 0.4, face: Math.PI, while: ['mirror'], lines: ['She is filling a silver ewer from the stream. She does not look round.'] },
  { id: 'legolas-landing', name: 'Legolas', look: 'legolas', x: 47, z: -16.5, face: 0, while: ['gifts'], gift: true, lines: ['He watches the elves loading the boats.'] },
  { id: 'merry-landing', name: 'Merry Brandybuck', look: 'merry', x: 49, z: -3.5, face: -0.6, while: ['gifts'], gift: true, lines: ['He has a lembas cake. “How many did you eat?”'] },
  { id: 'pippin-landing', name: 'Pippin Took', look: 'pippin', x: 50.6, z: -2.2, face: -0.6, while: ['gifts'], gift: true, lines: ['“Four.” He burps.'] },
  { id: 'sam-landing', name: 'Samwise Gamgee', look: 'sam', x: 56.5, z: -5.2, face: Math.PI, while: ['gifts'], gift: true, lines: ['He is coiling a length of grey rope. “Did she… is that elven rope?”'] },
  { id: 'gimli-landing', name: 'Gimli', look: 'gimli', x: 44, z: -9.5, face: 0, while: ['gifts'], gift: true, lines: ['He is red in the face, and won’t say why.'] },
  { id: 'aragorn-landing', name: 'Aragorn', look: 'aragorn', x: 57.5, z: -19.5, face: Math.PI / 2, while: ['gifts'], gift: true, lines: ['He stands apart, and looks down the river, south.'] },
  { id: 'boromir-landing', name: 'Boromir', look: 'boromir', x: 45, z: -20, face: 0.4, while: ['gifts'], gift: true, lines: ['“Little ones. You have to be ready for anything.”'] },
  { id: 'galadriel-landing', name: 'Galadriel', look: 'galadriel', x: 54, z: -12.5, face: Math.PI, while: ['gifts'], lines: ['“My gifts are on the table. Give them out for me, Ring-bearer.”'] },
  { id: 'celeborn-landing', name: 'Celeborn', look: 'celeborn', x: 54.5, z: -15, face: Math.PI, while: ['gifts'], lines: ['“The river will take you down to Amon Hen. Orcs are on the eastern shore.”'] },
  { id: 'aragorn-boats', name: 'Aragorn', look: 'aragorn', x: LANDING.x - 2.5, z: LANDING.z - 3, face: Math.PI / 2, while: ['argonath'], lines: ['“The boats are ready. We go by the river, Frodo.”'] },
  { id: 'sam-boats', name: 'Samwise Gamgee', look: 'sam', x: LANDING.x - 3, z: LANDING.z + 2.6, face: 0, while: ['argonath'], lines: ['He looks at the boat, and at the water, and swallows.'] },
];
// The wood's mallorns: a scatter, kept off the paths and out of the city,
// the hollow and the landing. [x, z, trunk radius, seed]
export const MALLORNS = (() => {
  const rand = seeded(29);
  const out = [];
  for (let n = 0; n < 900 && out.length < 46; n++) {
    const x = WOOD.west + 4 + rand() * (WOOD.east - WOOD.west - 10);
    const z = WOOD.north + 3 + rand() * (WOOD.south - WOOD.north - 6);
    const r = 1.1 + rand() * 1.0;
    if (nearPath(x, z) < r + 4.5) continue;
    if (Math.hypot(x - TREE.x, z - TREE.z) < 25) continue;
    if (Math.hypot(x - MIRROR.x, z - MIRROR.z) < MIRROR.foot + 3) continue;
    if (Math.hypot(x - LANDING.x, z - LANDING.z) < 13 || Math.hypot(x - TABLE.x, z - TABLE.z) < 9) continue;
    if (Math.hypot(x - AMBUSH.x, z - AMBUSH.z) < AMBUSH.r + 3) continue;
    if (CAST.some((c) => Math.hypot(x - c.x, z - c.z) < r + 2.5)) continue;
    if (out.some(([ox, oz, or]) => Math.hypot(x - ox, z - oz) < r + or + 7)) continue;
    out.push([x, z, r, Math.floor(rand() * 1000)]);
  }
  return out;
})();

const noise = makeNoise(53);
// The ground: rolling a little, the hollow sunk round the Mirror, the bank
// dropping to the river, and the stream's bed at the west.
export function woodHeight(x, z) {
  let h = (fbm(noise, x * 0.035, z * 0.035, { octaves: 3 }) - 0.5) * 2.2;
  // flat round the great tree and the landing
  h *= smooth(10, 22, Math.hypot(x - TREE.x, z - TREE.z)) * smooth(6, 14, Math.hypot(x - LANDING.x + 4, z - LANDING.z));
  // level where the Mirror's hollow is
  h *= smooth(MIRROR.foot, MIRROR.foot + 8, Math.hypot(x - MIRROR.x, z - MIRROR.z));
  h -= smooth(BANK - 3, BANK + 2, x) * 2.6;
  h -= smooth(-72, -77, x) * 1.8;
  return h;
}
// The bank round the Mirror (without its little bumps): what you walk on
// there, over the level ground.
function mirrorBank(x, z) {
  const rho = Math.hypot(x - MIRROR.x, z - MIRROR.z);
  if (rho <= MIRROR.floor || rho >= MIRROR.foot) return 0;
  return rho <= MIRROR.crest ? MIRROR.rim * smooth(MIRROR.floor, MIRROR.crest, rho) : MIRROR.rim * (1 - smooth(MIRROR.crest, MIRROR.foot, rho));
}
// where your feet are
export const groundHeight = (x, z) => woodHeight(x, z) + mirrorBank(x, z);
// the river's surface, and the stream's
export const RIVER_Y = -2.1;

const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });

// ── on the side: Legolas's targets ──
// A mark by the path west of the city where you stand to shoot, and five
// painted boards on their stands among the mallorns north of it: each
// [how far off, which way (degrees east of north), how high its middle].
export const BUTTS = { x: -17, z: -3.4, face: Math.PI / 2 };
export const BOARDS = [
  [11, 45, 1.3],
  [15, -6, 1.6],
  [19, -39, 1.4],
  [23, 3, 1.8],
  [31, 54, 1.5],
].map(([d, deg, up], id) => {
  const a = (deg * Math.PI) / 180;
  const x = BUTTS.x + Math.sin(a) * d;
  const z = BUTTS.z - Math.cos(a) * d;
  // `face` turns the board's front to the mark
  return { id, x, z, up, r: 0.55, face: Math.atan2(-(BUTTS.z - z), BUTTS.x - x) };
});

export const COLLIDERS = [
  circle('tree', TREE.x, TREE.z, TREE.r + 1.3, { top: 60 }),
  ...CITY.map((c, i) => circle(`city${i}`, c.x, c.z, c.r + 0.3, { top: 40 })),
  ...MALLORNS.map(([x, z, r], i) => circle(`mallorn${i}`, x, z, r + 0.3, { top: 40 })),
  circle('mirror', MIRROR.x, MIRROR.z, 0.95, { low: true, top: 1.1 }),
  box('table', TABLE, { low: true, top: 0.9 }),
  ...BOARDS.map((b) => circle(`board${b.id}`, b.x, b.z, 0.45, { low: true, top: 2.4 })),
];
// the wood's edges: the stream, the river, and the trees thick past north
// and south
export const WALLS = [
  [WOOD.west, WOOD.north, WOOD.west, WOOD.south, 0.4],
  [BANK, WOOD.north, BANK, WOOD.south, 0.4],
  [WOOD.west, WOOD.north, BANK, WOOD.north, 0.4],
  [WOOD.west, WOOD.south, BANK, WOOD.south, 0.4],
];

// Places to do things: [id, x, z, the quest it's for]
export const SPOTS = [
  { id: 'stair', x: TREE.x - STAIR.r - 2.2, z: TREE.z, r: 2.6, quest: 'caras' },
  { id: 'mirror', x: MIRROR.x + 0.6, z: MIRROR.z - MIRROR.crest - 1.2, r: 2.6, quest: 'mirror' },
  { id: 'table', x: TABLE.x - 1.6, z: TABLE.z, r: 2.4, quest: 'gifts' },
  { id: 'boats', x: LANDING.x - 1, z: LANDING.z, r: 3, quest: 'argonath' },
];

// The targets as the archery's rules see them (./rules.js newRange): where
// the arrow leaves the bow, the boards' middles, the trunks it can stick
// in, and the ground.
export const RANGE = {
  from: { x: BUTTS.x, y: groundHeight(BUTTS.x, BUTTS.z) + 1.05, z: BUTTS.z },
  targets: BOARDS.map((b) => ({ x: b.x, y: groundHeight(b.x, b.z) + b.up, z: b.z, r: b.r })),
  trunks: COLLIDERS.filter((c) => c.kind === 'circle' && !c.low).map((c) => ({ x: c.x, z: c.z, r: c.r - 0.3 })),
  ground: groundHeight,
};

export const castFor = (next) => CAST.filter((c) => !c.while || c.while.includes(next));

// The time of day, by what's next: the golden afternoon you come in, the
// night of the lanterns and the Mirror, the morning you leave.
export const moodFor = (next) => (next === 'caras' || next === 'mirror' ? 'night' : next === 'gifts' || next === 'argonath' ? 'dawn' : 'day');

// A saved spot, if it's a fair one: in the wood, out of everything.
export function validAt(saved) {
  const back = { ...START };
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (saved.x < WOOD.west + 1 || saved.x > BANK - 1 || saved.z < WOOD.north + 1 || saved.z > WOOD.south - 1) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, COLLIDERS, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
