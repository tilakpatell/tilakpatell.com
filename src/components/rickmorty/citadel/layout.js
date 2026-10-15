// The Citadel of Ricks, the concourse: where everything stands, who's
// about, where the crowd walks and where the Cop Ricks patrol. No drawing
// (./concourse.js draws it, ./CitadelWorld.jsx drives it), so it can be
// tested on its own.
//
// Metres, the towns' way round (../../middleearth/towns/walker.js): +x is
// east, +z south, so north is -z; a figure's `face` turns its +x to
// (cos face, -sin face). A box's `turn` is its model's rotation.y. The
// floor is flat, at 0, all the way to the shopfronts round the edge.

import { pushOut } from '../../middleearth/towns/walker';
import { moodOf } from './story';

// The disc you can walk in: the concourse, up to its shopfronts.
export const WORLD = { radius: 40 };
// Rick C-137: a little taller and quicker than a hobbit
export const RICK = { radius: 0.42, walk: 3.6, run: 6.8, accel: 16, turn: 11 };

// the Citadel's core: a column of portal fluid up through the dome
export const CORE = { x: 0, z: 0, r: 5 };

// Through the portal from C-137, at the south end, facing up the concourse.
export const START = { x: 0, z: 31, face: Math.PI / 2 };
// In front of Candidate Morty's booth, facing the core: where the chase
// to the hangar starts, and starts again when a Cop Rick catches you.
export const ESCAPE_START = { x: -17.5, z: -17.5, face: -Math.PI / 4 };
// Coming out of Simple Rick's and the Council's chamber
export const FACTORY_DOOR = { x: 36, z: 0, face: Math.PI };
export const COUNCIL_DOOR = { x: 0, z: -36, face: -Math.PI / 2 };

// Morty Day Care: a low-fenced pen on the west side, its gate to the east.
export const PEN = { x: -25, z: 0, w: 14, d: 12, gate: { x: -18, z0: -2, z1: 2 } };
export const inPen = (x, z) => Math.abs(x - PEN.x) < PEN.w / 2 - 0.3 && Math.abs(z - PEN.z) < PEN.d / 2 - 0.3;

// The doors round the edge, in the shopfronts (drawn there; the edge of the
// disc is the wall)
export const DOORS = {
  factory: { x: 40, z: 0 },
  council: { x: 0, z: -40 },
  hangar: { x: 27.6, z: 27.6, w: 7 },
  portal: { x: 0, z: 38.6 },
  // the lift down to Mortytown (./mortytown.js), across from the hangar
  mortytown: { x: -27.6, z: 27.6, w: 7 },
};

// Candidate Morty's booth, in the north-west, facing the core
export const BOOTH = { x: -21.5, z: -21.5, w: 3.6, d: 1.6, turn: Math.PI / 4 };
// its backboard, `back` metres behind the podium's middle (Candidate Morty
// stands between them)
export const BOOTH_BACK = { w: 4.2, d: 0.3, back: 2.75 };
export const DESKS = {
  customs: { x: 5, z: 29, w: 3.2, d: 1.2, turn: 0 },
  daycare: { x: -15, z: -9, w: 2.4, d: 1, turn: 0 },
};
// cover: kiosks and planters stand tall (they hide you), benches don't
export const KIOSKS = [
  { x: 12, z: -12, w: 2.6, d: 2.6, turn: Math.PI / 4 },
  { x: -10, z: 14, w: 2.6, d: 2.6, turn: Math.PI / 4 },
];
export const PLANTERS = [
  [19, 3],
  [3, 19],
  [-13, -13],
  [16, 16],
];
export const PLANTER_R = 1.3;
export const BENCHES = [
  { x: 0, z: 22, w: 2.6, d: 0.7, turn: 0 },
  { x: 22, z: 0, w: 2.6, d: 0.7, turn: Math.PI / 2 },
  { x: 0, z: -24, w: 2.6, d: 0.7, turn: 0 },
];
// what's in the pen: a slide and a ball pit
export const SLIDE = { x: -28.5, z: -2.5, w: 1.4, d: 4, turn: 0 };
export const BALLPIT = { x: -26, z: 3, r: 1.6 };
// the portal's arch, at the south edge
export const ARCH = { x: 0, z: 38.6, w: 5, d: 1, turn: 0 };

// ── what's in the way ──

const box = (id, b, o = {}) => ({ id, kind: 'box', x: b.x, z: b.z, w: b.w, d: b.d, turn: b.turn || 0, ...o });
const circle = (id, x, z, r, o = {}) => ({ id, kind: 'circle', x, z, r, ...o });

export const COLLIDERS = [
  circle('core', CORE.x, CORE.z, CORE.r, { top: 60 }),
  box('booth', BOOTH, { top: 1.2 }),
  box('boothback', { x: BOOTH.x - Math.SQRT1_2 * BOOTH_BACK.back, z: BOOTH.z - Math.SQRT1_2 * BOOTH_BACK.back, w: BOOTH_BACK.w, d: BOOTH_BACK.d, turn: BOOTH.turn }, { top: 3.1 }),
  box('customs', DESKS.customs, { low: true, top: 1.1 }),
  box('daycaredesk', DESKS.daycare, { low: true, top: 1 }),
  ...KIOSKS.map((k, i) => box(`kiosk${i}`, k, { top: 3.4 })),
  ...PLANTERS.map(([x, z], i) => circle(`planter${i}`, x, z, PLANTER_R, { top: 3 })),
  ...BENCHES.map((b, i) => box(`bench${i}`, b, { low: true, top: 0.9 })),
  box('slide', SLIDE, { low: true, top: 2.2 }),
  circle('ballpit', BALLPIT.x, BALLPIT.z, BALLPIT.r, { low: true, top: 0.7 }),
  box('arch', ARCH, { top: 6 }),
];

// The pen's fence, low (you see over it), with the gate's gap in the east
// side. [x0, z0, x1, z1, thick, low]
const P = { x0: PEN.x - PEN.w / 2, x1: PEN.x + PEN.w / 2, z0: PEN.z - PEN.d / 2, z1: PEN.z + PEN.d / 2 };
const FENCE = [
  [P.x0, P.z0, P.x1, P.z0, 0.15, true],
  [P.x0, P.z1, P.x1, P.z1, 0.15, true],
  [P.x0, P.z0, P.x0, P.z1, 0.15, true],
  [P.x1, P.z0, P.x1, PEN.gate.z0, 0.15, true],
  [P.x1, PEN.gate.z1, P.x1, P.z1, 0.15, true],
];
export const WALLS = [...FENCE];
// the hangar's blast doors, shut: across the opening, just inside the edge
const hd = 38.4 / Math.SQRT2;
const ht = DOORS.hangar.w / 2 / Math.SQRT2;
export const HANGAR_WALLS = [[hd - ht, hd + ht, hd + ht, hd - ht, 0.3]];

// ── the places to stop ──

export const SPOTS = [
  { id: 'daycare', x: -15.5, z: 0, r: 2.2 },
  { id: 'factory', x: 37.2, z: 0, r: 2.2 },
  { id: 'council', x: 0, z: -37.2, r: 2.2 },
  { id: 'ballot', x: -19.4, z: -19.4, r: 2.2 },
  { id: 'hangar', x: 25.4, z: 25.4, r: 2.2 },
  { id: 'portal', x: 0, z: 35, r: 2.2 },
  { id: 'mortytown', x: -25.4, z: 25.4, r: 2.2 },
];
export const spot = (id) => SPOTS.find((s) => s.id === id);

// Who's about, by the Citadel's mood ('day', 'election', 'red'), and what
// they say as you come by (their lines go round in turn). The three with a
// `vote` say how they're voting on election day.
const OUT = ['day', 'election'];
export const CAST = [
  { id: 'customs', name: 'Customs Rick', kind: 'cop', x: 5, z: 27.6, face: -Math.PI / 2, moods: OUT, lines: ['Rick C-137. Welcome to the Citadel. The Council would like a word.', 'Portal gun registered? Never mind. Nobody’s ever stopped you before.', 'Keep your Morty close. We’ve had incidents.'] },
  { id: 'daycarerick', name: 'Day Care Rick', kind: 'rick', x: -15, z: -10.4, face: -Math.PI / 2 - 0.5, moods: OUT, lines: ['(He turns a page of his magazine.)', 'Morty Day Care. Drop-offs till six. No Evil Mortys.', 'They’re Mortys. They wander off. That’s what Mortys do.'] },
  { id: 'cowboy', name: 'Cowboy Rick', kind: 'cowboyrick', x: 15, z: -16.5, face: 2.4, moods: OUT, lines: ['Howdy, partner. Hell of a Citadel, ain’t it.', 'Yee-haw. That’s… that’s about all I’ve got.'], vote: 'Votin’ for the Morty. Ricks have had their turn, and look where it got us.' },
  { id: 'worker', name: 'A Simple Rick’s worker', kind: 'factoryrick', x: 33.5, z: -6, face: Math.PI - 0.3, moods: OUT, lines: ['Twelve hours on the line, then home to a pod the size of a closet.', 'Don’t eat the wafers. You know what’s in them? Nobody does. That’s the point.'], vote: 'Candidate Morty says he’ll shut the line down. I’d vote for a Gazorpian if he said that.' },
  { id: 'copmorty', name: 'Cop Morty', kind: 'copmorty', x: -8, z: 24, face: 0.6, moods: OUT, lines: ['Cop Morty. Don’t laugh. We’re the best cops in the Citadel.', 'My partner says real cops don’t need Ricks.'], vote: 'I’m voting Morty. A Morty in charge, for once. What could go wrong?' },
  { id: 'janitor', name: 'Mr. Meeseeks', kind: 'meeseeks', x: 9.5, z: 4, face: Math.PI, moods: OUT, lines: ['I’m Mr. Meeseeks! I’ve been mopping this concourse for three weeks! Existence is pain!', 'Look at me! Mind the wet floor!'] },
  { id: 'guard1', name: 'Council guard', kind: 'cop', x: -3.2, z: -35.5, face: -Math.PI / 2, moods: OUT, lines: ['The Council is in session.', 'State your business with the Council.'] },
  { id: 'guard2', name: 'Council guard', kind: 'cop', x: 3.2, z: -35.5, face: -Math.PI / 2, moods: OUT, lines: ['Rick C-137? They’ve been expecting you.', 'Go on in. They don’t bite. Much.'] },
  { id: 'evilmorty', name: 'Candidate Morty', kind: 'evilmorty', x: -22.8, z: -22.8, face: -Math.PI / 4, moods: ['election', 'red'], lines: ['Vote Morty. A Citadel for all of us.', 'The Ricks have run things long enough.'] },
];
export const castFor = (mood) => CAST.filter((c) => c.moods.includes(mood));

// Where the crowd walks: closed loops on open floor, round the core and
// along the north, east and south-west of the concourse.
const ring = (r, n, a0 = 0) => Array.from({ length: n }, (_, i) => [Math.round(Math.cos(a0 + (i / n) * Math.PI * 2) * r * 100) / 100, Math.round(Math.sin(a0 + (i / n) * Math.PI * 2) * r * 100) / 100]);
export const CROWD_LOOPS = [
  ring(12.5, 14),
  [[25, -10], [31, -10], [31, 8], [25, 8]],
  [[-10, -27], [10, -27], [10, -31], [-10, -31]],
  [[-26, 12], [-14, 21], [-17, 27], [-30, 18]],
];

// The Cop Ricks' rounds on red alert: round the core, the east side, the
// south, and across the hangar's doors.
export const ROUNDS = [
  [[0, -9], [9, 0], [0, 9], [-9, 0]],
  [[14, -6], [26, -6], [26, 10], [14, 10]],
  [[-6, 12], [8, 12], [8, 27], [-6, 27]],
  [[16, 28], [30, 14]],
];

// A saved spot, if it's still a fair one: on the concourse and clear of
// everything, the day's crowds too; and on red alert, always the start of
// the chase.
export function validAt(saved, done = []) {
  const has = (id) => done.includes(id);
  if (has('votemorty') && !has('citadelout')) return ESCAPE_START;
  if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.z)) return START;
  if (Math.hypot(saved.x, saved.z) > WORLD.radius - 0.5) return START;
  const all = [...COLLIDERS, ...crowdColliders(moodOf(done))];
  // (dead centre of something round doesn't get pushed anywhere)
  if (all.some((c) => c.kind === 'circle' && Math.hypot(saved.x - c.x, saved.z - c.z) < c.r + RICK.radius)) return START;
  const [x, z] = pushOut(saved.x, saved.z, RICK.radius, all, WALLS);
  if (Math.hypot(x - saved.x, z - saved.z) > 0.05) return START;
  return { x: saved.x, z: saved.z, face: Number.isFinite(saved.face) ? saved.face : 0 };
}

// ── the crowds ──
// Where the Citadel's crowds stand, by mood (./crowd.js draws them, a mix of
// every kind of Rick and Morty): onlookers at the terrace's edge looking out
// over the city, a queue at Simple Rick's, a crowd watching the core's
// holo-ads, petitioners at the Council's doors and a few talking in threes;
// on election day the watchers go to a rally in front of Candidate Morty's
// booth, and on red alert everyone's gone. [{ x, z, face, group }]
const faceTo = (x, z, tx, tz) => Math.atan2(-(tz - z), tx - x);
const jitter = (i, k = 1) => (((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1;
function crowdGroups() {
  const out = [];
  const add = (group, x, z, face) => out.push({ group, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, face: face + (jitter(out.length) - 0.5) * 0.3 });
  // at the edge, looking out
  for (const [a0, a1, n] of [
    [-2.75, -2.05, 8],
    // (either side of the lift down to Mortytown, not in front of it)
    [1.92, 2.18, 4],
    [2.54, 2.72, 3],
    [0.32, 0.6, 5],
  ]) {
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1);
      add('edge', Math.cos(a) * 38.3, Math.sin(a) * 38.3, Math.atan2(-Math.sin(a), Math.cos(a)));
    }
  }
  // the queue at Simple Rick's
  for (const [x, z] of [
    [35.2, 3.6],
    [34.3, 4.5],
    [33.4, 5.4],
    [32.6, 6.3],
  ])
    add('queue', x, z, faceTo(x, z, DOORS.factory.x, DOORS.factory.z));
  // watching the holo-ads on the core, on its south-west side
  for (const [r, n] of [
    [8, 6],
    [10.2, 6],
  ]) {
    for (let i = 0; i < n; i++) {
      const a = 1.95 + (1.4 * i) / (n - 1) + (r > 9 ? 0.12 : 0);
      add('core', Math.cos(a) * r, Math.sin(a) * r, faceTo(Math.cos(a) * r, Math.sin(a) * r, 0, 0));
    }
  }
  // at the Council's doors, either side of the way in
  for (const x of [-9, -7.6, -6.2, 6.2, 7.6, 9]) for (const z of [-33.4, -34.8]) add('council', x, z, faceTo(x, z, 0, -40));
  // talking in threes
  for (const [cx, cz] of [
    [16.6, -8.6],
    [-3.9, 19.3],
  ]) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + cx;
      const x = cx + Math.cos(a) * 0.72;
      const z = cz + Math.sin(a) * 0.72;
      add('talk', x, z, faceTo(x, z, cx, cz));
    }
  }
  return out;
}
const DAY = crowdGroups();
// the rally: rows facing the booth, on its south side, clear of the way to the ballot box
const RALLY_AT = { x: -26.4, z: -12.6 };
const RALLY_U = (() => {
  const ux = RALLY_AT.x - BOOTH.x;
  const uz = RALLY_AT.z - BOOTH.z;
  const ul = Math.hypot(ux, uz);
  return [ux / ul, uz / ul];
})();
const RALLY = (() => {
  const out = [];
  const c = RALLY_AT;
  const u = RALLY_U;
  const v = [-u[1], u[0]];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const i = row * 8 + col;
      const a = (row - 2) * 1.08 + (jitter(i, 3) - 0.5) * 0.24;
      const b = (col - 3.5) * 1.02 + (jitter(i, 5) - 0.5) * 0.24;
      const x = c.x + u[0] * a + v[0] * b;
      const z = c.z + u[1] * a + v[1] * b;
      out.push({ group: 'rally', x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, face: faceTo(x, z, BOOTH.x, BOOTH.z) + (jitter(i, 7) - 0.5) * 0.3 });
    }
  }
  return out;
})();
const CROWDS = { day: DAY, election: [...DAY.filter((c) => c.group !== 'core'), ...RALLY], red: [] };
export const crowdFor = (mood) => CROWDS[mood] ?? DAY;
// each of them in Rick's way (but not in a Cop Rick's line of sight); the
// rally, packed too close to walk through, as one block, so that if it
// gathers round Rick he's pushed out to its edge, not shut in
const RALLY_BLOCK = {
  id: 'rally',
  kind: 'box',
  ...RALLY_AT,
  // its rows run along v, its ranks along u (towards the booth's back)
  w: 7 * 1.02 + 0.24 + 0.66,
  d: 4 * 1.08 + 0.24 + 0.66,
  turn: Math.atan2(-RALLY_U[0], -RALLY_U[1]),
  low: true,
  top: 1.9,
};
const CROWD_COLLIDERS = Object.fromEntries(
  Object.entries(CROWDS).map(([m, list]) => [
    m,
    [...list.filter((c) => c.group !== 'rally').map((c, i) => ({ id: `crowd${i}`, kind: 'circle', x: c.x, z: c.z, r: 0.33, low: true, top: 1.9 })), ...(list.some((c) => c.group === 'rally') ? [RALLY_BLOCK] : [])],
  ]),
);
export const crowdColliders = (mood) => CROWD_COLLIDERS[mood] ?? CROWD_COLLIDERS.day;
