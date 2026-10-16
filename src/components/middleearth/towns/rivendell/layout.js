// Rivendell, the valley: the house of Elrond on its terraces to the west,
// the hall of Narsil to the north, Bilbo's pavilion to the south-west, the
// Council court on its spur over the gorge, the river and its one bridge,
// the south gate, and cliffs all round with the falls coming off them. No
// drawing (./scene.js draws it, ./RivendellWorld.jsx drives it), so it can
// be tested on its own.
//
// The towns' conventions (../bree/layout.js): metres, +x east, +z south; a
// figure's `face` turns its +x to (cos face, -sin face); a building's
// `turn` is the turn its model is given (its front faces local +z).

import { fbm, makeNoise, smooth } from '../../../../lib/paint';
import { pushOut } from '../walker';

// The disc you can walk in, and how far the valley goes on past it.
export const WORLD = { radius: 56, edge: 110 };

// ── where everything stands ──

// the house of Elrond, its front (and arcade) to the east
export const HOUSE = { id: 'house', x: -27, z: -4, w: 18, d: 10, turn: Math.PI / 2 };
// the hall of Narsil, open to the south
export const COLONNADE = { id: 'colonnade', x: -3, z: -37, w: 16, d: 5, turn: 0 };
// Bilbo's pavilion, open to the east
export const PAVILION = { id: 'pavilion', x: -33, z: 24, r: 3.1, turn: Math.PI / 2 };
// the Council court, on its spur over the gorge, its way in to the south
export const COURT = { id: 'court', x: 15, z: -17, r: 8, turn: 0 };
// the south gate, where the road leaves the valley
export const GATE = { id: 'gate', x: -3, z: 51, w: 4.2, turn: 0 };

// The river, down the valley's east side in its gorge: its middle at each z,
// how far out its rims are, and how deep.
export const GORGE = { rim: 5.4, floor: -7, water: -6.2 };
export const riverX = (z) => 32 + 2.6 * Math.sin(z * 0.045 + 0.5);
// the bridge across it: along x, centred on the river, its deck rising to
// the middle as y = y0 + rise · sin(π (u + 1/2)), u from -1/2 to 1/2
export const BRIDGE = { z: 16, len: 16, w: 2.6, y0: 1.2, rise: 1.3 };
BRIDGE.x = riverX(BRIDGE.z);
export const bridgeY = (x) => BRIDGE.y0 + BRIDGE.rise * Math.sin(Math.PI * ((x - BRIDGE.x) / BRIDGE.len + 0.5));
const onBridge = (x, z) => Math.abs(x - BRIDGE.x) <= BRIDGE.len / 2 && Math.abs(z - BRIDGE.z) <= BRIDGE.w / 2 + 0.6;

// paths between them: [x, z] points
export const PATHS = [
  [[GATE.x, GATE.z - 1], [-6, 36], [-10, 20], [-13, 6], [-19.5, -2]],
  [[-10, 20], [-20, 22], [-28.5, 23.5]],
  [[-13, 6], [-2, -4], [8, -8], [COURT.x, COURT.z + COURT.r - 0.5]],
  [[-13, 6], [-14, -14], [-8, -26], [COLONNADE.x, COLONNADE.z + 4]],
  [[-6, 36], [8, 26], [20, 18], [BRIDGE.x - BRIDGE.len / 2 - 0.5, BRIDGE.z]],
  [[BRIDGE.x + BRIDGE.len / 2 + 0.5, BRIDGE.z], [46, 10]],
];
// beeches and birches: [x, z, size, kind (0 beech, 1 birch)]
export const TREES = [
  [-12, 30, 1.1, 0],
  [2, 40, 1, 1],
  [-18, 42, 1.05, 0],
  [10, 34, 0.9, 1],
  [-40, 6, 1.1, 0],
  [-42, -18, 1, 1],
  [-20, -24, 1.15, 0],
  [8, -28, 1, 1],
  [-26, 34, 0.95, 1],
  [20, 6, 1.05, 0],
  [-4, 14, 0.9, 1],
  [-46, 30, 1, 0],
  [14, 44, 1.1, 0],
  [-34, -32, 1, 1],
  [24, -36, 0.95, 0],
  [46, 24, 1.05, 1],
  [44, -2, 1, 0],
];
// lanterns along the paths: [x, z, turn]
export const LAMPS = [
  [-8.6, 28, 0],
  [-12, 12, Math.PI],
  [0.4, -6.4, -Math.PI / 2],
  [-11, -20, 0],
  [17, 19.6, Math.PI / 2],
];
// the falls, off the cliffs past the rim: [x, z, height, width, turn]
export const FALLS = [
  [70, -24, 34, 5, -Math.PI / 2],
  [66, 30, 26, 4, -Math.PI / 2 - 0.3],
  [-42, -66, 46, 6, 0.5],
];

// ── the lie of the land ──

const noise = makeNoise(83);
const noise2 = makeNoise(19);
const toSeg = (x, z, a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
};
// 1 on a path, fading off it (for painting the ground)
export function pathAmount(x, z) {
  let best = 0;
  for (const p of PATHS) for (let i = 1; i < p.length; i++) best = Math.max(best, 1 - smooth(0.9, 2, toSeg(x, z, p[i - 1], p[i])));
  return best;
}

// a box in its own frame: how far outside it (x, z) is (negative inside)
export function boxDist(b, x, z) {
  const t = b.turn || 0;
  const dx = x - b.x;
  const dz = z - b.z;
  const lx = dx * Math.cos(t) - dz * Math.sin(t);
  const lz = dx * Math.sin(t) + dz * Math.cos(t);
  return Math.max(Math.abs(lx) - b.w / 2, Math.abs(lz) - b.d / 2);
}
const discDist = (c, x, z) => Math.hypot(x - c.x, z - c.z) - c.r;

// the valley before anything's built: rising to the west, cliffs all round
// but for the way out south, and the gorge
function land(x, z) {
  const r = Math.hypot(x, z);
  let h = (fbm(noise, x * 0.05 + 4, z * 0.05 - 2, { octaves: 3 }) - 0.5) * 1.1;
  h += smooth(14, -40, x) * 4.5;
  const south = smooth(30, 52, z) * (1 - smooth(10, 22, Math.abs(x)));
  h += smooth(54, 80, r) * (34 + fbm(noise2, x * 0.04, z * 0.04, { octaves: 3 }) * 22) * (1 - south * 0.85);
  return h;
}
const gorgeK = (x, z) => 1 - smooth(GORGE.rim - 0.6, GORGE.rim + 0.5, Math.abs(x - riverX(z)));

// Each building stands on a level pad, at the height of its middle; the
// bridge's ends too.
const PADS = [
  { ...HOUSE, w: HOUSE.w + 3, d: HOUSE.d + 3, kind: 'box' },
  { ...COLONNADE, w: COLONNADE.w + 3, d: COLONNADE.d + 3, kind: 'box' },
  { ...PAVILION, r: PAVILION.r + 1.5, kind: 'disc' },
  { ...COURT, r: COURT.r + 0.6, kind: 'disc' },
  { x: GATE.x, z: GATE.z, w: 9, d: 4, turn: 0, kind: 'box' },
  { x: BRIDGE.x - BRIDGE.len / 2 - 1.5, z: BRIDGE.z, w: 3, d: 5, turn: 0, kind: 'box', y: BRIDGE.y0 },
  { x: BRIDGE.x + BRIDGE.len / 2 + 1.5, z: BRIDGE.z, w: 3, d: 5, turn: 0, kind: 'box', y: BRIDGE.y0 },
].map((p) => ({ ...p, y: p.y ?? land(p.x, p.z) }));
const padDist = (p, x, z) => (p.kind === 'disc' ? discDist(p, x, z) : boxDist(p, x, z));

export function height(x, z) {
  if (onBridge(x, z)) return bridgeY(x);
  let h = land(x, z);
  for (const p of PADS) {
    const k = 1 - smooth(0.3, 3, padDist(p, x, z));
    if (k > 0) h += (p.y - h) * k;
  }
  const g = gorgeK(x, z);
  if (g > 0) h += (GORGE.floor - h) * g;
  return h - pathAmount(x, z) * 0.05;
}
export const groundY = height;
// the house's floor, the court's paving: where things stand on them
export const padY = (id) => PADS.find((p) => p.id === id)?.y ?? 0;

// ── what's in the way ──

const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });
const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });
export const COLLIDERS = [
  box('house', HOUSE, { top: 12 }),
  // its round tower, at the back corner, standing out past the walls
  circle('tower', HOUSE.x - 4.3, HOUSE.z + 8.3, 1.95, { top: 20 }),
  // the hall of Narsil: its back wall and ends, its columns, and the statue
  box('colonnade-back', { x: COLONNADE.x, z: COLONNADE.z - COLONNADE.d / 2 + 0.4, w: COLONNADE.w, d: 0.8 }, { top: 7 }),
  box('colonnade-w', { x: COLONNADE.x - COLONNADE.w / 2 + 0.4, z: COLONNADE.z, w: 0.8, d: COLONNADE.d }, { top: 7 }),
  box('colonnade-e', { x: COLONNADE.x + COLONNADE.w / 2 - 0.4, z: COLONNADE.z, w: 0.8, d: COLONNADE.d }, { top: 7 }),
  ...[-5.71, -3.43, -1.14, 1.14, 3.43, 5.71].map((lx, i) => circle(`column${i}`, COLONNADE.x + lx, COLONNADE.z + 2.2, 0.3, { top: 6 })),
  circle('statue', COLONNADE.x, COLONNADE.z - 1.2, 0.7, { top: 3 }),
  ...[-1.7, 1.7].map((lx, i) => circle(`candles${i}`, COLONNADE.x + lx, COLONNADE.z - 1, 0.2, { low: true, top: 1.6 })),
  circle('pavilion', PAVILION.x, PAVILION.z, PAVILION.r, { top: 6 }),
  circle('plinth', COURT.x, COURT.z, 0.7, { low: true, top: 1 }),
  ...[-1, 1].map((s, i) => circle(`gate${i}`, GATE.x + s * (GATE.w / 2 + 0.4), GATE.z, 0.55, { top: 6 })),
  ...TREES.map(([x, z, s], i) => circle(`tree${i}`, x, z, 0.4 * s, { top: 9 })),
  ...LAMPS.map(([x, z], i) => circle(`lamp${i}`, x, z, 0.16, { low: true, top: 2.6 })),
];

// Walls, [x0, z0, x1, z1, thick, low]: the gorge's rims (but for the
// bridge), and the court's balustrade (but for its way in).
function rim(side, z0, z1) {
  const out = [];
  const n = Math.ceil(Math.abs(z1 - z0) / 3);
  for (let i = 0; i < n; i++) {
    const a = z0 + ((z1 - z0) * i) / n;
    const b = z0 + ((z1 - z0) * (i + 1)) / n;
    out.push([riverX(a) + side * (GORGE.rim + 0.3), a, riverX(b) + side * (GORGE.rim + 0.3), b, 0.3, true]);
  }
  return out;
}
const gap = BRIDGE.w / 2 + 0.3;
const GORGE_WALLS = [...rim(-1, -70, BRIDGE.z - gap), ...rim(-1, BRIDGE.z + gap, 70), ...rim(1, -70, BRIDGE.z - gap), ...rim(1, BRIDGE.z + gap, 70)];
// the bridge's railings
const BRIDGE_WALLS = [-1, 1].map((s) => [BRIDGE.x - BRIDGE.len / 2, BRIDGE.z + s * (BRIDGE.w / 2 - 0.1), BRIDGE.x + BRIDGE.len / 2, BRIDGE.z + s * (BRIDGE.w / 2 - 0.1), 0.12, true]);
// the court's balustrade, round all but its way in (the south, +z)
const COURT_OPEN = [Math.PI / 2 - 0.42, Math.PI / 2 + 0.42];
const COURT_WALLS = (() => {
  const out = [];
  const a0 = COURT_OPEN[1];
  const a1 = COURT_OPEN[0] + Math.PI * 2;
  const n = 22;
  const r = COURT.r - 0.2;
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const b = a0 + ((a1 - a0) * (i + 1)) / n;
    out.push([COURT.x + Math.cos(a) * r, COURT.z + Math.sin(a) * r, COURT.x + Math.cos(b) * r, COURT.z + Math.sin(b) * r, 0.2, true]);
  }
  return out;
})();
export const WALLS = [...GORGE_WALLS, ...BRIDGE_WALLS, ...COURT_WALLS];

// ── the places to stop ──

// out of the house's arcade, after waking
export const HOUSE_DOOR = { x: HOUSE.x + HOUSE.d / 2 + 2.2, z: HOUSE.z + 2, face: 0 };
// where you start on a return visit: the path up from the gate
export const START = { x: -5.6, z: 40, face: Math.PI / 2 + 0.2 };
export const SPOTS = [
  { id: 'narsil', x: COLONNADE.x, z: COLONNADE.z + 1.4, r: 2.2 },
  { id: 'council', x: COURT.x, z: COURT.z + 3.6, r: 2.4 },
  { id: 'bilbo', x: PAVILION.x + PAVILION.r + 1.6, z: PAVILION.z, r: 2.2 },
  { id: 'gate', x: GATE.x, z: GATE.z - 2.6, r: 3 },
];
export const spot = (id) => SPOTS.find((s) => s.id === id);
// the bedroom, set apart under the valley: where it is
export const INSIDE = { x: 0, y: -60, z: 0 };

// The court's seats, in a ring facing the middle, and who sits where for
// the Council.
export const SEATS = Array.from({ length: 10 }, (_, i) => {
  const a = COURT_OPEN[1] + 0.35 + (i / 9) * (Math.PI * 2 - (COURT_OPEN[1] - COURT_OPEN[0]) - 0.7);
  const x = COURT.x + Math.cos(a) * 5.4;
  const z = COURT.z + Math.sin(a) * 5.4;
  return { x, z, face: Math.atan2(-(COURT.z - z), COURT.x - x) };
});

// The Nine's companions, about the valley before they set out: where each
// is, and what they say as they fall in behind you.
export const COMPANIONS = [
  { id: 'sam', name: 'Samwise Gamgee', x: -17, z: 3, face: 0.3, look: 'sam', joins: 'Sam has packed the pans, the salt, some rope, and Bill the pony. “Ready, Mr. Frodo.”' },
  { id: 'merry', name: 'Merry Brandybuck', x: -24, z: 30, face: -0.4, look: 'merry', joins: 'Merry: “We’re coming too. You’ll have to send us home tied up in a sack to stop us.”' },
  { id: 'pippin', name: 'Pippin Took', x: -21.6, z: 31.4, face: 0.6, look: 'pippin', joins: 'Pippin: “Anyway, you need people of intelligence on this sort of… mission… quest… thing.”' },
  { id: 'gandalf', name: 'Gandalf', x: 6, z: -7, face: Math.PI, look: 'gandalf', joins: 'Gandalf: “The Fellowship awaits the Ring-bearer.”' },
  { id: 'aragorn', name: 'Aragorn', x: BRIDGE.x - 0.6, z: BRIDGE.z + 0.4, face: 0, look: 'aragorn', joins: 'Aragorn turns from Arwen, the Evenstar in his hand. “If by my life or death I can protect you, I will. You have my sword.”' },
  { id: 'legolas', name: 'Legolas', x: 22, z: -2, face: -0.4, look: 'legolas', joins: 'Legolas: “And you have my bow.”' },
  { id: 'gimli', name: 'Gimli', x: -10.4, z: -30.6, face: Math.PI / 2, look: 'gimli', joins: 'Gimli: “And my axe!”' },
  { id: 'boromir', name: 'Boromir', x: 4.4, z: -31.2, face: Math.PI, look: 'boromir', joins: 'Boromir: “You carry the fate of us all, little one. If this is indeed the will of the Council, then Gondor will see it done.”' },
];

// Who's about, by how far you've got (`while`: only while one of those
// quests is next); their lines go round in turn as you come by.
export const CAST = [
  { id: 'arwen', name: 'Arwen', x: BRIDGE.x + 0.6, z: BRIDGE.z - 0.3, face: Math.PI, look: 'arwen', lines: ['“I would rather share one lifetime with him than face all the ages of this world alone.”', 'The Evenstar shines at her throat.'] },
  { id: 'elrond', name: 'Elrond', x: COURT.x - 2, z: COURT.z + 6.2, face: -Math.PI / 2, look: 'elrond', while: ['narsil', 'bilbo', 'fellowship'], lines: ['“Welcome, Frodo Baggins. The Council meets when all are come.”', '“The Ring cannot stay here.”'] },
  { id: 'boromir-shards', name: 'Boromir', x: COLONNADE.x + 2.2, z: COLONNADE.z + 1.2, face: Math.PI, look: 'boromir', while: ['narsil'], lines: ['“The shards of Narsil. The blade that cut the Ring from Sauron’s hand.”', '“It’s still sharp.”'] },
  { id: 'aragorn-shards', name: 'Aragorn', x: COLONNADE.x - 2.3, z: COLONNADE.z + 3.4, face: 0, look: 'aragorn', while: ['narsil'], lines: ['He says nothing, but watches Boromir with the shards.'] },
  { id: 'gimli-walk', name: 'Gimli', x: -12, z: -10, face: 0, look: 'gimli', while: ['narsil', 'council'], lines: ['“Elves. Never trust an Elf.”', '“Have you tried the food? Leaves. All of it, leaves.”'] },
  { id: 'legolas-walk', name: 'Legolas', x: 22, z: -2, face: -0.4, look: 'legolas', while: ['narsil', 'council', 'bilbo'], lines: ['He is watching the falls, and says nothing for a long while.'] },
  { id: 'sam-walk', name: 'Samwise Gamgee', x: -17, z: 3, face: 0.3, look: 'sam', while: ['narsil', 'council', 'bilbo'], lines: ['“I wanted to see the Elves, Mr. Frodo. More than anything.”', '“Mr. Frodo’s not going anywhere without me!”'] },
  { id: 'merry-walk', name: 'Merry Brandybuck', x: -24, z: 30, face: -0.4, look: 'merry', while: ['narsil', 'council', 'bilbo'], lines: ['“Have you seen the size of the beds? Built for Big Folk.”'] },
  { id: 'pippin-walk', name: 'Pippin Took', x: -21.6, z: 31.4, face: 0.6, look: 'pippin', while: ['narsil', 'council', 'bilbo'], lines: ['“Elves don’t do second breakfast, Merry. I’ve asked.”'] },
  { id: 'gandalf-walk', name: 'Gandalf', x: 6, z: -7, face: Math.PI, look: 'gandalf', while: ['narsil', 'council', 'bilbo'], lines: ['“Frodo. The Council will decide what is to be done with the Ring.”'] },
  { id: 'bilbo', name: 'Bilbo Baggins', x: PAVILION.x, z: PAVILION.z, face: 0, look: 'bilbo', lines: ['“Frodo, my lad! Come in, come in. I’ve been writing.”', '“There and Back Again: A Hobbit’s Tale, by Bilbo Baggins.”'] },
];
export const castFor = (next) => CAST.filter((c) => !c.while || c.while.includes(next));

// A saved spot, if it's still a fair one: never inside anything, never
// out of the disc, never down the gorge.
export function validAt(saved, done = []) {
  const back = done.includes('awake') ? HOUSE_DOOR : START;
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return back;
  if (Math.hypot(saved.x, saved.z) > WORLD.radius - 0.5) return back;
  if (gorgeK(saved.x, saved.z) > 0 && !onBridge(saved.x, saved.z)) return back;
  const [x, z] = pushOut(saved.x, saved.z, 0.4, COLLIDERS, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return back;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}
// can't stand here: down in the gorge, off the bridge
export const blocked = (x, z) => gorgeK(x, z) > 0.2 && !onBridge(x, z);
