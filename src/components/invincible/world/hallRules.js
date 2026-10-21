// The inside of the Guardians of the Globe's hall, as rules only (./hall.js
// draws it): a round room under the dome, the eight on their plinths round
// it, Cecil's board at the back and the door on the south, the way in from
// the plaza and the way out. The room is its own zone (`hall`): the city
// is not drawn while he is in it, and he comes out where he went in.
// Plain [x, y, z] arrays, metres; the room's centre is the hall's (0, 0).

export const HALL = {
  r: 28, // the room
  high: 14, // the dome's top over the floor
  door: [0, 21], // (x, z) on the floor: the way out
  doorR: 4, // within this of the door, E leaves
  plinthR: 16, // the plinths' ring
  plinthH: 0.8,
  talkR: 4, // within this of a plinth, E speaks to the one on it
  board: [0, -20], // Cecil's board, at the back
  boardR: 5,
  n: 8,
  // where he stands coming in (just inside the door, facing the room) and
  // going out (on the steps, facing the plaza); `face` as the hero keeps it
  in: { p: [0, 0, 17], face: Math.PI },
  out: { p: [0, 0, 24], face: 0 },
  name: 'Guardians’ hall',
};

// The i-th plinth: on the ring, none in the doorway (south) or before the
// board (north): the eight sit at 22.5° either side of each.
export function plinthAt(i) {
  const a = Math.PI / HALL.n + (i * 2 * Math.PI) / HALL.n;
  return [Math.sin(a) * HALL.plinthR, 0, Math.cos(a) * HALL.plinthR];
}
export const PLINTHS = Array.from({ length: HALL.n }, (_, i) => plinthAt(i));
// the way a plinth faces: the room's middle
export const plinthFace = (i) => Math.atan2(-PLINTHS[i][0], -PLINTHS[i][2]);

const flat = (p, q) => Math.hypot(p[0] - q[0], p[2] - q[2]);

// Inside the room: the walls and the dome keep him in. Returns the same
// array when nothing needed clamping.
export function clampToRoom(p) {
  const r = Math.hypot(p[0], p[2]);
  const edge = HALL.r - 0.6;
  const y = Math.min(Math.max(p[1], 0), HALL.high - 1.6);
  if (r <= edge && y === p[1]) return p;
  const k = r > edge ? edge / r : 1;
  return [p[0] * k, y, p[2] * k];
}
export const inRoom = (p) => Math.hypot(p[0], p[2]) <= HALL.r && p[1] >= 0 && p[1] <= HALL.high;

// which plinth he is at (within talkR of its front), or -1
export function nearPlinth(p) {
  let best = -1;
  let bd = HALL.talkR;
  PLINTHS.forEach((q, i) => {
    const d = flat(p, q);
    if (d < bd) [best, bd] = [i, d];
  });
  return best;
}
export const nearBoard = (p) => flat(p, [HALL.board[0], 0, HALL.board[1]]) < HALL.boardR;
export const nearDoor = (p) => flat(p, [HALL.door[0], 0, HALL.door[1]]) < HALL.doorR;

// Whether the hall's door outside is close enough to go in: on the plaza, on
// the ground or just over it, within `r` of the door (x, z)
export const atDoor = (p, door = HALL.door, r = 6) => Math.hypot(p[0] - door[0], p[2] - door[1]) < r && p[1] < 12;

// Going in: the hero put just inside the door, and where he came from kept
// (`from`), so coming out puts him back on the steps; the zone is `hall`.
export function enterHall(h) {
  return { h: { ...h, p: [...HALL.in.p], v: [0, 0, 0], spd: 0, mode: 'ground', crouch: 0, stun: 0, face: HALL.in.face, zone: 'hall' }, inside: { met: [], from: { p: [...h.p], face: h.face } } };
}
// Coming out: on the steps, facing the plaza, the city's zone again
export function leaveHall(h) {
  return { ...h, p: [...HALL.out.p], v: [0, 0, 0], spd: 0, mode: 'ground', crouch: 0, stun: 0, face: HALL.out.face, zone: 'city' };
}

// He has spoken to the one on plinth i: the eight met is the achievement
// (`guardians`), once. → { inside, all: true the first time all eight are met }
export function meet(inside, i) {
  if (inside.met.includes(i)) return { inside, all: false };
  const met = [...inside.met, i];
  return { inside: { ...inside, met }, all: met.length === HALL.n };
}
