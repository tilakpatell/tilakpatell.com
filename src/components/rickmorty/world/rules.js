// Dimension C-137, the world: where everything stands (the Smiths' street
// with the President's motorcade, the Federation's agents and Shoney's; the
// Smith house on two floors and the garage lab with the hatch down to Rick's
// clone lab and Morty's Mind Blowers past it; the Oval Office through the
// President's portal; the school; the alien street with Blips and Chitz), how
// Morty walks about it, how Rick's cruiser flies over it, the things to do
// there and the pop quiz. No drawing (./scene.js draws it, ./RmWorld.jsx
// drives it), so it can be tested on its own. (The cruiser's voice and the
// Federation ship's flight are ./ship.js.)
//
// Metres; +x is east, +z is south, so north is -z. A figure's heading (`face`)
// is the angle that turns its +x round to face (cos face, -sin face), as in the
// Shire. The cruiser's nose points (sin yaw, cos yaw), so yaw 0 faces south.
// Each room (and each floor of the house) and the alien street is its own
// area, built far apart (the rooms down the x = -300 line, the annex out at
// x = 400) so a door is a jump.

import { seeded } from '../../../lib/seeded';
import { springStep } from '../../../lib/spring';
import { makeWalker, pushOut } from '../../middleearth/towns/walker';
import { DESTINATIONS, DIAL, GARAGE_BACK, isBigPlanet, isPlanet } from './dimensions/destinations';
import { CROSS, LANE, TOWN, TOWN_PEOPLE, TOWN_ROOFS, TOWN_SOLIDS, TOWN_SPOTS, TOWN_STANDING, TOWN_STEPS, TOWN_TASKS, TOWN_TREES, onRoad } from './town/plan';

export { behindYaw, cameraMove } from '../../middleearth/towns/walker';

// ── the areas ──

export const AREAS = {
  // (out to the hedges: the suburb's houses on along the road, the yards
  // behind, and the town round them, ./town/plan.js)
  street: TOWN,
  annex: { x0: 370, x1: 430, z0: -22, z1: 22 },
  // the Smith house, ground floor: the plan's rooms (PLAN) fill all of it but the
  // outside corner south-west
  house: { x0: -312, x1: -288, z0: -8, z1: 8.5 },
  upstairs: { x0: -306, x1: -294.7, z0: 394, z1: 410.3 },
  // (one car wide, as the show draws it: 7.2 m across, 8 m deep)
  garage: { x0: -303.6, x1: -296.4, z0: 98, z1: 106 },
  school: { x0: -308, x1: -292, z0: 194, z1: 206 },
  arcade: { x0: -310, x1: -290, z0: 292, z1: 308 },
  // Rick's clone lab, under the garage floor, and Morty's Mind Blowers through its east door
  basement: { x0: -310, x1: -290, z0: 494, z1: 510 },
  mindblowers: { x0: -306, x1: -294, z0: 594, z1: 606 },
  // the Oval Office, through the President's portal in the garage
  oval: { x0: -308, x1: -292, z0: 694, z1: 706 },
  // Shoney's, inside
  diner: { x0: -307, x1: -293, z0: 794, z1: 804 },
  // Dr. Wong's office, through its door in the house next to Shoney's
  wong: { x0: -305, x1: -295, z0: 894, z1: 904 },
  // the multiverse's destinations, through the garage portal as it's dialled (./dimensions/destinations.js)
  ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, d.area])),
};
export const ROOM_IDS = ['house', 'upstairs', 'garage', 'school', 'arcade', 'basement', 'mindblowers', 'oval', 'diner', 'wong'];
export const OUTDOOR = ['street', 'annex', ...DESTINATIONS.filter((d) => d.kind === 'outdoor').map((d) => d.id)];

// `pad` grows the area (shrinks it, below zero) all round
export const inArea = (id, x, z, pad = 0) => {
  const a = AREAS[id];
  return x >= a.x0 - pad && x <= a.x1 + pad && z >= a.z0 - pad && z <= a.z1 + pad;
};
export const areaAt = (x, z) => Object.keys(AREAS).find((id) => inArea(id, x, z)) ?? null;

// ── the street ──

// the asphalt is z in [-5, 5], the sidewalks go on to +-7, across the whole street
export const ROAD = { z: 0, w: 10, sidewalk: 2 };
const VERGE = ROAD.w / 2 + ROAD.sidewalk;

// A building: where its footprint's centre is, its width on x and depth on z,
// its wall height and its ridge's height. The footprint is the box the Meshy
// model is fitted over; what is in the way of walking is its PARTS, where the
// model is not a plain box (the Smith house, the school).
// The Smith house as it stands in the show: the garage wing on the west, 3 m
// forward of the two-storey east wing (x -3 to 5), the middle set back.
export const HOUSE = { id: 'house', x: -5, z: -22.6, w: 20, d: 10.8, h: 3.2, roof: 8.6 };
export const GARAGE = { id: 'garage', x: -19, z: -21, w: 8, d: 14, h: 3.4, roof: 6.2 };
export const SCHOOL = { id: 'school', x: 40, z: 23, w: 30, d: 16, h: 8, roof: 8.5 };
export const ARCADE = { id: 'arcade', x: 400, z: -10, w: 18, d: 12, h: 7, roof: 9 };
// the house and garage as one footprint, which is what the scene fits its model over
export const HOUSE_GARAGE = { x0: -23, x1: 5, z0: -28, z1: -14 };

// a part of a building, from its edges and the height of its roof
const part = (id, x0, x1, z0, z1, h) => ({ id, x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h });
// The Smith house, as the model has it: the two-storey wing (front -17.2), the
// middle set back (wall -19.3) and, over the front door, the porch gable (its
// step -17.8). The heights are the model's own.
export const HOUSE_PARTS = [part('wing', -3, 5, -28, -17.2, 8.6), part('middle', -15, -3, -28, -19.3, 6.4), part('porch', -8.7, -5.7, -19.3, -17.8, 4.2)];
// Harry Herpson High, as the model has it (measured off it, fitted over SCHOOL):
// a long front bar the whole width, the tall entrance block on the doors,
// standing forward of it, and a rear wing along the west half: the east end
// has no back to it.
export const SCHOOL_PARTS = [part('bar', 25, 55, 16.5, 24, 6.3), part('entrance', 35.8, 44.3, 15.8, 22.1, 8.7), part('rear', 25, 42.2, 24, 31, 5.9)];

// (the house next door to the west is pink, as in the show)
const TINTS = [0xf0a0a8, 0xb7d3c6, 0xe9c9a1, 0xc2cfe6, 0xf0dd9a, 0xd9bfd8];
// for the scene: each one's design (a two-storey colonial or a one-storey ranch) and its roof's colour
// (the north-east one is Shoney's: a diner, lower, with a parking lot in front)
const LOOKS = ['colonial', 'ranch', 'diner', 'ranch', 'colonial', 'ranch'];
const ROOF_TINTS = [0x5d5f6c, 0x6e4a36, 0x7a4038, 0x56606e, 0x6b4c3b, 0x4f5a52];
export const NEIGHBOURS = [
  [-42, -20],
  [24, -20],
  [46, -20],
  [-42, 21],
  [-18, 21],
  [4, 21],
].map(([x, z], i) => ({ id: `${z < 0 ? 'n' : 's'}${i % 3}`, x, z, w: 12, d: 10, h: LOOKS[i] === 'diner' ? 4.2 : 5.5, roof: LOOKS[i] === 'diner' ? 6.6 : 8, tint: TINTS[i], look: LOOKS[i], roofTint: ROOF_TINTS[i] }));
export const DINER = NEIGHBOURS.find((n) => n.look === 'diner');
export const BUILDINGS = [HOUSE, GARAGE, SCHOOL, ...NEIGHBOURS];
// The houses on along the road past the street's own, both sides, out to the
// hedges at its ends: solid, and drawn as the neighbours are
// (but where the town's cross roads come out: ./town/plan.js's CROSS)
export const OUTSKIRTS = [68, 91, 114, 137].flatMap((d, i) =>
  CROSS.some((c) => Math.abs(Math.abs(c) - d) < 10) ? [] : [-1, 1].flatMap((sx) => [-1, 1].map((sz) => ({ id: `out-${sx < 0 ? 'w' : 'e'}${sz < 0 ? 'n' : 's'}${i}`, x: sx * d, z: sz * 20, w: 12, d: 10, h: 5.5, roof: 8, look: (i + sx + sz) % 4 ? 'colonial' : 'ranch' }))),
);

const LAID_OUT = [-91, 91].flatMap((x) => [-20, 20].map((z) => ({ x, z, w: 12, d: 10 })));

// the driveway runs from the garage door to the sidewalk; the cruiser parks on it, nose south
export const DRIVEWAY = { x0: -23, x1: -15, z0: -14, z1: -7 };
export const BOARD = { x: -19, z: -10.5, yaw: 0 };
// the red-brick front walk, from the porch step (and the front door) to the sidewalk
export const FRONT_WALK = { x0: -7.8, x1: -6.6, z0: -17.4, z1: -7 };
// The concrete stoop at the front door, raised off the lawn on a brick face,
// the width of the porch over it, and its two steps down to the front walk:
// things Morty stands on (their `top`), walks up, and jumps off the edges of.
export const STOOP = [
  { id: 'stoop', x: -7.2, z: -17.1, w: 3, d: 1.4, top: 0.45 },
  { id: 'stoop-step1', x: -7.2, z: -16.2, w: 1.6, d: 0.4, top: 0.3 },
  { id: 'stoop-step2', x: -7.2, z: -15.8, w: 1.6, d: 0.4, top: 0.15 },
];

// on the sidewalk at the foot of the front walk, looking up at the house
export const START = { area: 'street', x: -8, z: -6, face: Math.PI / 2 };

// The President's limousine, parked at the north kerb a little east of the
// Smiths' front walk, nose east (a box `w` across and `d` long, turned a
// quarter); he and his Secret Service agent stand on the sidewalk beside it.
// It's there, and in the way, until Morty has met him (the `president` task):
// then the motorcade drives off east.
export const LIMO = { x: 5, z: -3.6, w: 2.3, d: 6.2, turn: Math.PI / 2 };
// the cars in Shoney's lot, nose in, either side of the way to its door
const LOT = [
  { id: 'car1', x: DINER.x - 4.4, tint: 0xa8acb0 },
  { id: 'car2', x: DINER.x + 4.4, tint: 0xe9dcc6 },
];

// ── doors, exits and portals ──
// A link is where you stand to go through. `arrive` is where you come out:
// a little way outside the matching door (facing away from it), 2 m in from
// a room's south wall (facing the far wall), or inside the house at the other
// end of its door or stairs, and always clear of every link's reach so you
// are never sent straight back. `kind` is 'door', 'exit' (back outside),
// 'portal', 'stairs' or 'hatch' (the ladder down to the secret lab, and up).

const ROOM_X = -300;
const FACE_N = Math.PI / 2;
const HOUSE_DOOR = { x: -7.2, z: -17.4 };
const GARAGE_DOOR = { x: -19, z: -13.4 };
const SCHOOL_DOOR = { x: 40, z: 14.4 };
const ARCADE_DOOR = { x: 400, z: -3.4 };
const DINER_DOOR = { x: DINER.x, z: DINER.z + DINER.d / 2 + 0.6 };
// Dr. Wong's practice: in the ranch house west of Shoney's, its door where Shoney's is on Shoney's
export const WONG_HOUSE = NEIGHBOURS.find((n) => n.z < 0 && n.x < DINER.x && n.x > DINER.x - 30);
const WONG_DOOR = { x: WONG_HOUSE.x, z: WONG_HOUSE.z + WONG_HOUSE.d / 2 + 0.6 };
// where you come out by a door: `across` and `along` metres from it, facing straight away from it
const beside = (door, across, along) => ({ x: door.x + across, z: door.z + along, face: Math.atan2(-along, across) });
// The hatch in the garage lab's floor, 1.2 m square, in the corner opposite
// the door to the kitchen, as the show has it: the south-west, by the garage
// door and past the Portal panic cabinet. Nothing stands over it and it is
// floor to walk on: the link is what takes Morty down it.
export const HATCH = { x: -302.85, z: 104.85, w: 1.2, d: 1.2 };
// The President's portal: a steel frame against the garage's east wall by
// the garage door, facing in (west); lit once he's put it there (`needs`).
export const GOV_PORTAL = { x: -296.55, z: 104.3 };
const into = (room) => ({ x: ROOM_X, z: AREAS[room].z1 - 2, face: FACE_N });
const exit = (room, to, arrive) => ({ id: `${room}-exit`, area: room, x: ROOM_X, z: AREAS[room].z1 - 0.6, r: 0.9, kind: 'exit', to, label: 'Back outside', arrive });

export const LINKS = [
  // the front door opens on the entry; the garage's on the lab
  { id: 'house-door', area: 'street', ...HOUSE_DOOR, r: 1.6, kind: 'door', to: 'house', label: 'Smith house', arrive: { x: -297.6, z: 1.4, face: FACE_N } },
  { id: 'garage-door', area: 'street', ...GARAGE_DOOR, r: 1.6, kind: 'door', to: 'garage', label: 'Rick’s garage', arrive: into('garage') },
  { id: 'school-door', area: 'street', ...SCHOOL_DOOR, r: 1.6, kind: 'door', to: 'school', label: 'Harry Herpson High', arrive: into('school') },
  { id: 'arcade-door', area: 'annex', ...ARCADE_DOOR, r: 1.6, kind: 'door', to: 'arcade', label: 'Blips and Chitz', arrive: into('arcade') },
  { id: 'front', area: 'house', x: -297.6, z: 3, r: 0.9, kind: 'exit', to: 'street', label: 'Back outside', arrive: beside(HOUSE_DOOR, 0, 2.4) },
  // out of the garage, to the east of the parked cruiser rather than into it
  exit('garage', 'street', beside(GARAGE_DOOR, 2.4, 1)),
  exit('school', 'street', beside(SCHOOL_DOOR, 0, -2.4)),
  exit('arcade', 'annex', beside(ARCADE_DOOR, 0, 2.4)),
  // the kitchen's west wall and the garage lab's east side
  { id: 'kitchen-garage', area: 'house', x: -311.6, z: 1.1, r: 0.9, kind: 'door', to: 'garage', label: 'Rick’s garage', arrive: { x: -298.1, z: 100.2, face: Math.PI } },
  { id: 'garage-kitchen', area: 'garage', x: -296.85, z: 100.2, r: 0.9, kind: 'door', to: 'house', label: 'The kitchen', arrive: { x: -309.4, z: 1.1, face: 0 } },
  { id: 'stairs-up', area: 'house', x: -295.1, z: 2.6, r: 0.9, kind: 'stairs', to: 'upstairs', label: 'Upstairs', arrive: { x: -303, z: 402, face: FACE_N } },
  { id: 'stairs-down', area: 'upstairs', x: -303, z: 403.4, r: 0.9, kind: 'stairs', to: 'house', label: 'Downstairs', arrive: { x: -296.9, z: 0.6, face: FACE_N } },
  // (the portal swirls on the garage's west wall, past the end of the bench;
  // its reach stops short of the portal gun's spot beside it, so the gun can be dialled)
  { id: 'garage-portal', area: 'garage', x: -303, z: 101.4, r: 1.1, kind: 'portal', to: 'annex', label: 'Through the portal', arrive: { x: 400, z: 9, face: FACE_N } },
  { id: 'annex-portal', area: 'annex', x: 400, z: 13, r: 1.4, kind: 'portal', to: 'garage', label: 'Back to the garage', arrive: { x: -301.2, z: 101.4, face: 0 } },
  // down the hatch to the foot of the ladder, and up it to beside the hatch
  { id: 'garage-hatch', area: 'garage', x: HATCH.x, z: HATCH.z, r: 0.9, kind: 'hatch', to: 'basement', label: 'Down the hatch', arrive: into('basement') },
  { id: 'basement-ladder', area: 'basement', x: ROOM_X, z: AREAS.basement.z1 - 0.6, r: 0.9, kind: 'hatch', to: 'garage', label: 'Up the ladder', arrive: beside(HATCH, 1.25, -0.95) },
  // the clone lab's east door, on to Morty's Mind Blowers, and back
  { id: 'basement-mind', area: 'basement', x: -291.9, z: 505.6, r: 0.9, kind: 'door', to: 'mindblowers', label: 'Morty’s Mind Blowers', arrive: into('mindblowers') },
  { id: 'mind-door', area: 'mindblowers', x: ROOM_X, z: AREAS.mindblowers.z1 - 0.6, r: 0.9, kind: 'door', to: 'basement', label: 'Rick’s clone lab', arrive: { x: -293.5, z: 505.6, face: Math.PI } },
  // the President's portal to the Oval Office (shut till he's met), and its way back
  { id: 'garage-oval', area: 'garage', x: GOV_PORTAL.x - 1.2, z: GOV_PORTAL.z, r: 1.2, kind: 'portal', to: 'oval', label: 'The Oval Office', needs: 'president', arrive: { x: ROOM_X, z: AREAS.oval.z1 - 2.7, face: FACE_N } },
  { id: 'oval-portal', area: 'oval', x: ROOM_X, z: AREAS.oval.z1 - 0.6, r: 1.4, kind: 'portal', to: 'garage', label: 'Back to the garage', arrive: beside({ x: GOV_PORTAL.x - 1.2, z: GOV_PORTAL.z }, -1.25, -0.85) },
  // Shoney's
  { id: 'diner-door', area: 'street', ...DINER_DOOR, r: 1.6, kind: 'door', to: 'diner', label: 'Shoney’s', arrive: into('diner') },
  exit('diner', 'street', beside(DINER_DOOR, 0, 2.4)),
  // Dr. Wong's office
  { id: 'wong-door', area: 'street', ...WONG_DOOR, r: 1.6, kind: 'door', to: 'wong', label: 'Dr. Wong’s office', arrive: into('wong') },
  exit('wong', 'street', beside(WONG_DOOR, 0, 2.4)),
  // every destination's portal, home to the garage (the garage's goes where the dial is set: ./dimensions/destinations.js's linkTarget)
  ...DESTINATIONS.map((d) => ({ id: `${d.id}-portal`, area: d.id, x: d.back.x, z: d.back.z, r: 1.4, kind: 'portal', to: 'garage', label: 'Back to the garage', arrive: GARAGE_BACK })),
];
// A link with `needs` stays shut until that thing's done
export const linkOpen = (l, done = []) => !l.needs || done.includes(l.needs);

const nearest = (list, area, x, z) => {
  let best = null;
  let bestD = Infinity;
  for (const o of list) {
    const d = Math.hypot(x - o.x, z - o.z);
    if (o.area === area && d <= o.r && d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
};
// (`done`, the things done: a link that needs one not done is shut; left out, every link counts)
export const nearLink = (area, x, z, done) => nearest(done ? LINKS.filter((l) => linkOpen(l, done)) : LINKS, area, x, z);

// ── trees and fences ──

const rectDist = (x0, x1, z0, z1, x, z) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
const edgeDist = (b, x, z) => rectDist(b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2, x, z);
const segDist = (px, pz, [x0, z0, x1, z1]) => {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const t = Math.max(0, Math.min(1, ((px - x0) * dx + (pz - z0) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (x0 + t * dx), pz - (z0 + t * dz));
};

// Each back yard is the house's width, from the back of the house to a low
// picket fence across behind, with a fence down each side. Nobody gets in: the
// house and the fences close it.
const YARD_PLANS = [
  { x0: HOUSE_GARAGE.x0, x1: HOUSE_GARAGE.x1, far: -33, back: HOUSE_GARAGE.z0 },
  ...NEIGHBOURS.map((n) => {
    const north = n.z < 0;
    return { x0: n.x - n.w / 2, x1: n.x + n.w / 2, far: north ? -33 : 33, back: n.z + (north ? -1 : 1) * (n.d / 2) };
  }),
];
export const FENCES = YARD_PLANS.flatMap(({ x0, x1, far, back }) =>
  [
    [x0, back, x0, far],
    [x1, back, x1, far],
    [x0, far, x1, far],
  ].map((run) => [...run, 0.08, true])
);
// the ground inside the fences, as rectangles
export const YARDS = YARD_PLANS.map(({ x0, x1, far, back }) => ({ x0, x1, z0: Math.min(far, back), z1: Math.max(far, back) }));

// ── the street's small things ──
// Things that stop Morty (and that ./street.js draws from): the flagpole, the
// "H.H.H.S." marquee and a tree in front of the school, telephone poles every
// 32 m along the south sidewalk, a mailbox by each house's driveway (the
// neighbours' on the side that's clear), and the fire hydrant on the Smiths'
// side. Round (`r`) but for the marquee, a box turned `turn`.
const DRIVE_SIDE = { n0: 1, n1: -1, n2: 1, s0: 1, s1: 1, s2: -1 };
export const DECOR = [
  { id: 'flagpole', kind: 'pole', x: 47.5, z: 11.8, r: 0.15 },
  { id: 'marquee', kind: 'box', x: 31.5, z: 9.4, w: 2.4, d: 0.5, turn: -2.75 },
  { id: 'school-tree', kind: 'tree', x: 27.5, z: 11.5, r: 0.35 },
  ...[-2, -1, 0, 1].map((k, i) => ({ id: `pole${i}`, kind: 'pole', x: 20 + 32 * k, z: 7.6, r: 0.15 })),
  { id: 'mailbox-smith', kind: 'mailbox', x: DRIVEWAY.x1 + 0.7, z: -7.5, r: 0.25 },
  // (where Shoney's would have its mailbox, its tall sign)
  ...NEIGHBOURS.map((n) => ({ id: n === DINER ? 'shoneys-sign' : `mailbox-${n.id}`, kind: n === DINER ? 'sign' : 'mailbox', x: n.x + DRIVE_SIDE[n.id] * (n.w / 2 + 1.8) + 2.1, z: Math.sign(n.z) * 7.5, r: n === DINER ? 0.3 : 0.25 })),
  { id: 'hydrant', kind: 'hydrant', x: -2.2, z: -7.45, r: 0.25 },
  // the cars in Shoney's lot, 2.2 by 4.6, nose to the diner
  ...LOT.map((c) => ({ id: c.id, kind: 'car', x: c.x, z: DINER.z + DINER.d / 2 + 3.6, w: 2.2, d: 4.6, turn: 0, tint: c.tint })),
];
// a small thing's round or (with a width) its box, as what's in the way
const decorCollider = (d) => (d.w ? box(d.id, d.x, d.z, d.w, d.d, d.turn) : circle(d.id, d.x, d.z, d.r));

// ── the multiverse's vehicles (Phase 6, Task 6.2) ──
// Where the family keeps them: Space Beth's battered ship on the Smiths' lawn
// east of the front walk, nose to the street; Jerry's car with Rick's rockets
// on the lawn west of it (the driveway is the cruiser's, and the car's wings
// won't fit beside it); and the combined Gotron, 24 m tall, on the open ground
// behind the houses across the street, over their roofs and facing the
// Smiths', a ferret at its feet. Each is its model (/models/c137/rm/<id>.glb)
// stood `h` tall on a box `w` across x and `d` along z, turned `turn` (the
// models face +z); solid, and a roof the cruiser flies over.
export const VEHICLES = [
  { id: 'spacebeth-ship', x: 0.8, z: -12.4, w: 3.9, d: 5.5, h: 2.4, turn: 0 },
  { id: 'jerry-ship', x: -11.3, z: -12.4, w: 5.4, d: 5.7, h: 1.5, turn: 0 },
  { id: 'gotron', x: -7, z: 44, w: 16.4, d: 6.4, h: 24, turn: Math.PI },
  { id: 'gotron-ferret', x: 9.5, z: 43, w: 2.3, d: 7.8, h: 3.4, turn: 0 },
];

// the straight way from the sidewalk to each street door, which no tree stands in
const LANES = LINKS.filter((l) => l.area === 'street').map((l) => [l.x, l.z, l.x, Math.sign(l.z) * VERGE]);
// where Morty comes out in the street
const LANDINGS = LINKS.filter((l) => l.to === 'street').map((l) => l.arrive);

// (on the street as it was first laid out, LANE: the town round it plants its own)
function treeFits(x, z) {
  if (x < LANE.x0 + 2 || x > LANE.x1 - 2 || z < LANE.z0 + 2 || z > LANE.z1 - 2 || Math.abs(z - ROAD.z) < VERGE + 0.5) return false;
  // (the houses on along the road as they were first laid, the two where the
  // cross roads now come out among them: so the trees keep their places)
  if ([...BUILDINGS, ...OUTSKIRTS, ...LAID_OUT].some((b) => edgeDist(b, x, z) < 2)) return false;
  if (onRoad(x, z, 1.5)) return false;
  if (rectDist(DRIVEWAY.x0, DRIVEWAY.x1, DRIVEWAY.z0, DRIVEWAY.z1, x, z) < 2) return false;
  if (LINKS.some((l) => l.area === 'street' && Math.hypot(x - l.x, z - l.z) < 2.5)) return false;
  if (LANDINGS.some((a) => Math.hypot(x - a.x, z - a.z) < 2.5)) return false;
  if (LANES.some((lane) => segDist(x, z, lane) < 2.5)) return false;
  if (FENCES.some((f) => segDist(x, z, f) < 1.2)) return false;
  if (DECOR.some((d) => Math.hypot(x - d.x, z - d.z) < 2)) return false;
  if (VEHICLES.some((v) => edgeDist(v, x, z) < 1.5)) return false;
  return Math.hypot(x - START.x, z - START.z) >= 3;
}

// a tree's trunk, as the round thing in the way
const trunk = (t) => 0.45 * t.s;

// Trees along the sidewalks and about the yards, the same every visit.
export const TREES = (() => {
  const rand = seeded(137);
  const out = [];
  for (let tries = 0; out.length < 20 && tries < 4000; tries++) {
    const x = LANE.x0 + 3 + rand() * (LANE.x1 - LANE.x0 - 6);
    const z = rand() < 0.4 ? (rand() < 0.5 ? -1 : 1) * (VERGE + 0.5 + rand() * 1.5) : LANE.z0 + 3 + rand() * (LANE.z1 - LANE.z0 - 6);
    if (!treeFits(x, z) || out.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    out.push({ x, z, s: 0.8 + rand() * 0.55, kind: Math.floor(rand() * 3), turn: rand() * Math.PI * 2 });
  }
  return out;
})();

// ── inside the Smith house: the plan ──

// The rooms of each floor, as the show's plans have them. `floor` is the
// colour of the floor for the scene. Everything in the house area that is not
// in a room is outside the house (blocked), as is the void beside the stairs
// upstairs.
const WOOD = 0xc4a77a;
const room = (id, area, name, x0, x1, z0, z1, floor = WOOD) => ({ id, area, name, x0, x1, z0, z1, floor });
export const PLAN = [
  room('kitchen', 'house', 'The kitchen', -312, -306.7, -8, 3.4),
  room('living', 'house', 'The living room', -306.7, -296.9, -8, -1.9),
  room('den', 'house', 'The den', -296.9, -288, -8, -1.6),
  room('dining', 'house', 'The dining room', -306.7, -299.5, -1.9, 3.4),
  room('entry', 'house', 'The entry', -299.5, -295.7, -1.9, 3.4),
  room('hall', 'house', 'The hall', -295.7, -288, -1.6, 0.5),
  room('stairs', 'house', 'The stairs', -295.7, -294.5, 0.5, 3.4),
  room('rickroom', 'house', 'The back room', -294.5, -288, 0.5, 8.5, 0x8d8aa3),
  room('summer', 'upstairs', 'Summer’s room', -306, -299.8, 394, 399.9, 0xd9a6b8),
  room('morty', 'upstairs', 'Morty’s room', -299.8, -294.7, 394, 399.9, 0x7da06a),
  room('upHall', 'upstairs', 'The upstairs hall', -306, -294.7, 399.9, 401.7),
  room('master', 'upstairs', 'Beth and Jerry’s room', -302.4, -294.7, 401.7, 408.8, 0xb9a58f),
  room('balcony', 'upstairs', 'The balcony', -302.4, -294.7, 408.8, 410.3, 0x9a7650),
  // the top of the stairs, a notch in the void, open to the hall and the master bedroom
  room('stairTop', 'upstairs', 'Top of the stairs', -303.6, -302.4, 401.7, 404),
  // under the garage: Rick's clone lab, and Morty's Mind Blowers past it
  room('clonelab', 'basement', 'Rick’s clone lab', -310, -290, 494, 510, 0x123548),
  room('mind', 'mindblowers', 'Morty’s Mind Blowers', -306, -294, 594, 606, 0x1d4a4c),
  // the Oval Office, and Shoney's
  room('office', 'oval', 'The Oval Office', -308, -292, 694, 706, 0xd9c79a),
  room('shoneys', 'diner', 'Shoney’s', -307, -293, 794, 804, 0xe8e2d2),
  room('wongoffice', 'wong', 'Dr. Wong’s office', -305, -295, 894, 904, 0x9a8a72),
];

// The round rooms: an ellipse in the area, `a` across x and `b` along z from
// its middle, walled all round (the scene draws the same ellipse). The clone
// lab and the Mind Blowers room are round, as the show has them, and the
// Oval Office is oval.
export const RINGS = {
  basement: { x: -300, z: 502, a: 10, b: 8 },
  mindblowers: { x: -300, z: 600, a: 6, b: 6 },
  oval: { x: -300, z: 700, a: 8, b: 6 },
};
// the ring as `n` straight runs of wall, [x0, z0, x1, z1, thick]
export const ringWalls = ({ x, z, a, b }, n = 32) =>
  Array.from({ length: n }, (_, i) => {
    const [t0, t1] = [(i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2];
    return [x + a * Math.cos(t0), z + b * Math.sin(t0), x + a * Math.cos(t1), z + b * Math.sin(t1), 0.12];
  });

// The rugs, flat on the floor and no collider (each is in the room of its own name):
// the red one in the entry, the olive one under the living room's coffee table,
// and Morty's round space rug.
export const RUGS = [
  { id: 'entry', area: 'house', x: -297.6, z: 0.75, w: 2.6, d: 3.4, color: 0xa23a2e },
  { id: 'living', area: 'house', x: -299.9, z: -3.5, w: 3, d: 3, color: 0x6b7a3a },
  { id: 'morty', area: 'upstairs', x: -297.8, z: 397, w: 2.4, d: 2.4, color: 0x2f4a8a, round: true },
  // the Oval Office's: the seal on blue, between the couches
  { id: 'office', area: 'oval', x: -300, z: 700.4, w: 5.2, d: 4.4, color: 0x2b3f73, round: true },
];

// The walls inside, between the rooms: [x0, z0, x1, z1, thick], 2.6 m high.
// A gap in a line of wall is a door (1.8 m, or 3 m for the living room's wide
// opening to the dining room): Morty is 0.8 m across.
const wall = (x0, z0, x1, z1) => [x0, z0, x1, z1, 0.12];
export const INNER_WALLS = {
  house: [
    // the kitchen: doors to the living room and the dining room
    wall(-306.7, -8, -306.7, -6),
    wall(-306.7, -4.2, -306.7, 0),
    wall(-306.7, 1.8, -306.7, 3.4),
    // the living room's south side and the entry's north: a wide opening to the dining room
    wall(-306.7, -1.9, -305.2, -1.9),
    wall(-302.2, -1.9, -295.7, -1.9),
    // the living room and the den: a door at the north end
    wall(-296.9, -6.2, -296.9, -1.9),
    // the dining room and the entry
    wall(-299.5, -1.9, -299.5, 0.3),
    wall(-299.5, 2.1, -299.5, 3.4),
    // the entry's east side, open to the hall and the stairs
    wall(-295.7, -1.9, -295.7, -1.3),
    // the hall: doors to the den (north) and the back room (south); the stairs are closed off from it
    wall(-295.7, -1.6, -293.4, -1.6),
    wall(-291.6, -1.6, -288, -1.6),
    wall(-295.7, 0.5, -291.9, 0.5),
    wall(-290.1, 0.5, -288, 0.5),
    // the stairs and the back room
    wall(-294.5, 0.5, -294.5, 3.4),
  ],
  upstairs: [
    // Summer's room and Morty's
    wall(-299.8, 394, -299.8, 399.9),
    // the hall's north wall: doors to each of them
    wall(-306, 399.9, -304.6, 399.9),
    wall(-302.8, 399.9, -298.4, 399.9),
    wall(-296.6, 399.9, -294.7, 399.9),
    // the hall's south wall: the master bedroom's one door (the top of the stairs is the hall's)
    wall(-302.4, 401.7, -299, 401.7),
    wall(-297.2, 401.7, -294.7, 401.7),
    // the master bedroom and the balcony: a wide glass door
    wall(-302.4, 408.8, -300, 408.8),
    wall(-297, 408.8, -294.7, 408.8),
  ],
};

// ── the furniture ──

// Each piece: its centre (x, z), its width across its front (w) and its depth
// (d) and height (h), and the way it faces. Its front faces +z (south) at
// `turn` 0; `turn` is its rotation.y, so a quarter turn of pi/2 faces it east
// and -pi/2 west. The scene draws from this list and each piece is a box in
// the way (the same list makes the colliders), so what you see is what you
// walk into.
const E = Math.PI / 2; // faces east
const W = -Math.PI / 2; // faces west
const N = Math.PI; // faces north
const item = (id, kind, area, x, z, w, d, h, turn = 0) => ({ id, kind, area, x, z, w, d, h, turn });
// the stairs: x, z, w (across, x -295.7 to -294.56), d (z 0.56 to its foot at 2.15), h
const STAIR_RUN = [-295.13, 1.355, 1.14, 1.59, 1.75];
// and their banister, a low wall up the open side
export const BANISTER = [-295.7, 0.56, -295.7, 2.15, 0.06, true];
export const FURNITURE = [
  // the kitchen: counters 0.7 m deep along the west wall (with the stove in
  // them, Beth at it) and the back wall (the sink under its window, then the
  // fridge in the corner), a short run on the east wall between the two
  // doorways, and the breakfast nook by the front window
  item('counter', 'counter', 'house', -311.65, -5.55, 3.5, 0.7, 0.95, E),
  item('stove', 'stove', 'house', -311.65, -3.4, 0.8, 0.7, 0.95, E),
  item('counter-w', 'counter', 'house', -311.65, -2, 2, 0.7, 0.95, E),
  item('counter-nw', 'counter', 'house', -311.15, -7.65, 1.7, 0.7, 0.95),
  item('sink', 'sink', 'house', -309.6, -7.65, 1.4, 0.7, 0.95),
  item('counter-ne', 'counter', 'house', -308.375, -7.65, 1.05, 0.7, 0.95),
  item('fridge', 'fridge', 'house', -307.375, -7.575, 0.95, 0.85, 1.85),
  item('counter-e', 'counter', 'house', -307.085, -2.15, 3.1, 0.65, 0.95, W),
  item('nook-table', 'nook-table', 'house', -309, 2.55, 0.9, 0.9, 0.75),
  item('chair-nook1', 'chair', 'house', -309.95, 2.55, 0.45, 0.45, 0.85, E),
  item('chair-nook2', 'chair', 'house', -308.05, 2.55, 0.45, 0.45, 0.85, W),
  // the living room: the TV on the east wall, the couch facing it with the
  // coffee table (on the olive rug) between, the armchair at the north of it,
  // the bookcase on the west wall, and Snuffles' dog bed (low, and a collider
  // like the rest) by the back wall's sliding door
  item('tv', 'tv', 'house', -297.4, -3.5, 2.6, 0.8, 1.4, W),
  item('couch', 'couch', 'house', -301.6, -3.5, 3, 1.1, 0.9, E),
  item('coffee-table', 'coffee-table', 'house', -299.6, -3.5, 1.2, 0.5, 0.42, E),
  item('armchair', 'armchair', 'house', -299.6, -6.1, 0.95, 0.95, 0.9),
  item('bookcase-living', 'bookcase', 'house', -306.42, -7.1, 1.6, 0.4, 1.9, E),
  item('dog-bed', 'dog-bed', 'house', -304.6, -7.5, 0.9, 0.6, 0.22),
  // the dining room: the table and its six chairs (two a side, one at each end, each turned to it)
  item('table', 'dining-table', 'house', -303.1, 0.8, 2.8, 1.3, 0.75),
  item('chair-d1', 'chair', 'house', -304, -0.35, 0.5, 0.5, 0.95),
  item('chair-d2', 'chair', 'house', -302.2, -0.35, 0.5, 0.5, 0.95),
  item('chair-d3', 'chair', 'house', -304, 1.95, 0.5, 0.5, 0.95, N),
  item('chair-d4', 'chair', 'house', -302.2, 1.95, 0.5, 0.5, 0.95, N),
  item('chair-d5', 'chair', 'house', -305, 0.8, 0.5, 0.5, 0.95, E),
  item('chair-d6', 'chair', 'house', -301.2, 0.8, 0.5, 0.5, 0.95, W),
  // the entry: the grandfather clock against the north wall, off the doorways
  item('clock', 'clock', 'house', -298.4, -1.62, 0.55, 0.4, 2.1),
  // the den
  item('desk-den', 'desk', 'house', -292.5, -7.5, 2.4, 1, 0.75),
  item('shelf-den', 'shelf', 'house', -288.3, -4.8, 3, 0.5, 1.9, W),
  // the back room
  item('bed-back', 'bed', 'house', -291.2, 7.4, 1.6, 2.1, 0.6, N),
  item('dresser-back', 'dresser', 'house', -288.3, 3, 1.8, 0.5, 0.9, W),
  // the flight of stairs, rising north from its foot (by the stairs-up link)
  // to the hall's wall, a hair in from the walls either side of it
  item('stair-run', 'stairs', 'house', ...STAIR_RUN),
  // upstairs: Summer's room, Morty's, Beth and Jerry's
  item('bed-summer', 'bed', 'upstairs', -304.95, 397.5, 1.1, 2.1, 0.6, E),
  item('desk-summer', 'desk', 'upstairs', -302, 394.5, 1.6, 0.8, 0.75),
  item('bed-morty', 'bed', 'upstairs', -295.75, 397.5, 1.1, 2.1, 0.6, W),
  item('desk-morty', 'desk', 'upstairs', -297.6, 394.5, 1.4, 0.8, 0.75),
  // Morty's nightstand at the head of his bed, his bookshelf by the desk, and the desk chair
  item('nightstand', 'nightstand', 'upstairs', -294.95, 398.35, 0.5, 0.4, 0.55, W),
  item('bookcase-morty', 'bookcase', 'upstairs', -295.8, 394.175, 1.4, 0.35, 1.5),
  item('chair-morty', 'chair', 'upstairs', -297.6, 395.4, 0.5, 0.5, 0.9, N),
  item('bed-master', 'bed', 'upstairs', -295.8, 405.3, 1.8, 2.2, 0.6, W),
  item('dresser-master', 'dresser', 'upstairs', -302.15, 406.5, 2, 0.5, 0.9, E),
  // Rick's garage lab, as the show lays it out: the bench along the back
  // wall and round the corner in an L, the washer and dryer beside it, the
  // plumbus factory in the corner by the kitchen door; the wire shelving
  // past that door; the long worktable in the middle; the Portal panic
  // cabinet on the west wall, before the hatch
  item('workbench', 'workbench', 'garage', -301.9, 98.375, 3.4, 0.75, 0.95),
  item('bench-arm', 'workbench', 'garage', -303.275, 99.475, 1.45, 0.65, 0.95, E),
  item('laundry', 'laundry', 'garage', -299.3, 98.33, 1.4, 0.66, 1.1),
  item('plumbus', 'machine', 'garage', -297.45, 98.3, 1.8, 0.55, 1.6),
  item('shelf-garage', 'shelf', 'garage', -296.65, 102.2, 1.8, 0.5, 1.9, W),
  item('worktable', 'worktable', 'garage', -299.9, 102.4, 2.2, 0.9, 0.92),
  item('portalpanic', 'arcade', 'garage', -303.225, 103.1, 0.8, 0.75, 1.8, E),
  // Space Beth's stool, at the worktable's east end (she's back, and sits in on Rick's work)
  item('stool-garage', 'stool', 'garage', -298.35, 102.4, 0.42, 0.42, 0.5),
  // Mr. Goldenfold's classroom: the chalkboard, his desk, six desks for the class
  item('chalkboard', 'chalkboard', 'school', -300, 194.1, 6, 0.2, 1.3),
  item('goldenfold-desk', 'goldenfold-desk', 'school', -300, 195.4, 3, 1.2, 0.8),
  ...[-304.6, -295.4].flatMap((x, i) => [199, 201, 203].map((z, j) => item(`school-desk${i * 3 + j + 1}`, 'school-desk', 'school', x, z, 2, 0.9, 0.75, N))),
  // Blips and Chitz
  item('roy', 'roy', 'arcade', -300, 292.8, 2, 1.2, 2.1),
  item('cabinet1', 'arcade', 'arcade', -309.5, 297, 1.4, 1, 1.8, E),
  item('cabinet2', 'arcade', 'arcade', -290.5, 300, 1.4, 1, 1.8, W),
  item('cabinet3', 'arcade', 'arcade', -309.5, 303, 1.4, 1, 1.8, E),
  // the President's portal, against the garage's east wall by the garage door, facing in
  item('govportal', 'govportal', 'garage', GOV_PORTAL.x, GOV_PORTAL.z, 1.8, 0.3, 2.5, W),
  // Rick's clone lab: the clone machine in the middle of the back, curved
  // desks down both sides (two lengths each, stepped to the round wall), and
  // the ladder up on the south wall (its foot is the way up, and where the hatch puts Morty)
  item('clone-machine', 'clone-machine', 'basement', -300, 498.6, 3.4, 3.4, 6),
  item('desk-w1', 'lab-desk', 'basement', -307.6, 499.2, 2, 0.8, 0.9, E),
  item('desk-w2', 'lab-desk', 'basement', -309, 501.6, 2, 0.8, 0.9, E),
  item('desk-e1', 'lab-desk', 'basement', -292.4, 499.2, 2, 0.8, 0.9, W),
  item('desk-e2', 'lab-desk', 'basement', -291, 501.6, 2, 0.8, 0.9, W),
  item('ladder', 'ladder', 'basement', -300, 509.94, 0.7, 0.12, 3.5, N),
  // Morty's Mind Blowers: the reclining chair in the middle, its foot to the
  // door, the helmet's cart beside it, and vials stood on the floor either side of the way in
  item('mind-chair', 'mind-chair', 'mindblowers', -300, 599.6, 0.9, 2, 1.1),
  item('mind-cart', 'mind-cart', 'mindblowers', -298.5, 599, 0.7, 0.5, 1),
  item('vials1', 'vials', 'mindblowers', -303.2, 603, 1.6, 1, 0.5),
  item('vials2', 'vials', 'mindblowers', -296.8, 603, 1.6, 1, 0.5),
  // the Oval Office: the desk before the windows with the flags behind it, the
  // couches facing over the coffee table, the fireplace on the west wall and the clock on the east
  item('resolute', 'resolute', 'oval', -300, 696.6, 2.2, 1.1, 0.78),
  item('flag1', 'flag', 'oval', -302, 694.9, 0.5, 0.5, 2.4),
  item('flag2', 'flag', 'oval', -298, 694.9, 0.5, 0.5, 2.4),
  item('couch-oval1', 'couch', 'oval', -302.6, 700.8, 2.2, 0.9, 0.85, E),
  item('couch-oval2', 'couch', 'oval', -297.4, 700.8, 2.2, 0.9, 0.85, W),
  item('table-oval', 'coffee-table', 'oval', -300, 700.8, 1.3, 0.7, 0.42, E),
  item('fireplace', 'fireplace', 'oval', -307.6, 700, 1.8, 0.5, 1.3, E),
  item('clock-oval', 'clock', 'oval', -292.3, 700, 0.55, 0.4, 2.1, W),
  // Shoney's: three booths along the windows on the west (a table between two
  // high-backed benches), the counter along the east wall with four stools at it
  ...[795.6, 798.1, 800.6].flatMap((z, i) => [
    item(`booth${i + 1}`, 'booth-table', 'diner', -305.9, z, 1.2, 0.8, 0.75),
    item(`booth${i + 1}n`, 'booth', 'diner', -305.9, z - 0.75, 1.4, 0.55, 1.1),
    item(`booth${i + 1}s`, 'booth', 'diner', -305.9, z + 0.75, 1.4, 0.55, 1.1, N),
  ]),
  item('diner-counter', 'diner-counter', 'diner', -293.6, 798.5, 6, 0.7, 1.05, W),
  ...[796.3, 797.8, 799.3, 800.8].map((z, i) => item(`stool${i + 1}`, 'stool', 'diner', -294.6, z, 0.45, 0.45, 0.75)),
  // Dr. Wong's office, as "Pickle Rick" has it: her armchair at the north with
  // a side table by it, the family's couch facing her across a low table, a
  // second chair at the west, a tall plant in the corner, her desk by the wall
  item('wong-armchair', 'armchair', 'wong', -300, 895.9, 0.95, 0.95, 0.95),
  item('wong-side', 'side-table', 'wong', -301.25, 895.7, 0.5, 0.5, 0.6),
  item('wong-table', 'coffee-table', 'wong', -300, 898.3, 1.2, 0.6, 0.4),
  item('wong-couch', 'couch', 'wong', -300, 900.2, 2.6, 0.95, 0.85, N),
  item('wong-chair', 'armchair', 'wong', -303.6, 898.2, 0.9, 0.9, 0.95, E),
  item('wong-plant', 'plant', 'wong', -304.3, 894.7, 0.6, 0.6, 1.6),
  item('wong-desk', 'desk', 'wong', -296.4, 894.5, 1.6, 0.7, 0.75),
];

// ── the people ──

// Who is where, and which way they face. Each who stands is a round thing in
// the way (PERSON m across) just behind the hotspot that talks to them; Jerry
// sits on the couch, facing the TV, and the Federation agent in his booth at
// Shoney's, and so are not in the way; the teacher stands behind Mr.
// Goldenfold's desk, in front of the board, and the President behind his.
// `who` is the model, where it isn't the id. `until`: there till that thing's
// done (the President's visit to the street, and his Secret Service agent).
const PERSON = 0.3;
const S = -Math.PI / 2; // facing south
export const PEOPLE = [
  { id: 'jerry', area: 'house', x: -301.6, z: -3.5, face: 0, sits: true },
  { id: 'beth', area: 'house', x: -310.95, z: -3.4, face: Math.PI },
  { id: 'summer', area: 'upstairs', x: -302.4, z: 396.9, face: -Math.PI / 2 },
  { id: 'rick', area: 'garage', x: -301.9, z: 99.15, face: Math.PI / 2 },
  { id: 'teacher', area: 'school', x: -300, z: 194.5, face: -Math.PI / 2 },
  // the motorcade, on the sidewalk by the limo, looking west along it to the Smiths'
  { id: 'president', area: 'street', x: LIMO.x - 1, z: -6.1, face: Math.PI, until: 'president' },
  { id: 'secretservice', area: 'street', x: LIMO.x + 2.3, z: -6.1, face: Math.PI, until: 'president' },
  // the Federation's agents at their posts: by the pink house, outside Shoney's, by the school
  { id: 'agent1', who: 'fedagent', area: 'street', x: -34.5, z: -6.2, face: S },
  { id: 'agent2', who: 'fedagent', area: 'street', x: DINER.x - 2, z: -6.4, face: S },
  { id: 'agent3', who: 'fedagent', area: 'street', x: 38.5, z: 6.2, face: Math.PI / 2 },
  // the street's walkers (../npc.js, through visitors.js): Jessica and Brad
  // along the near sidewalk, Mr. Goldenfold on his way to the school, Ethan
  // outside Shoney's. They roam, so they're not in the way.
  { id: 'jessica-walk', who: 'jessica', area: 'street', x: -18, z: -5.8, face: 0, roams: true, ai: { wander: [[-18, -5.8], [24, -5.8], [24, -6.6], [-18, -6.6]], speed: 0.9, pause: 2, bark: { r: 4, every: 18, lines: ['Hi, Morty.', 'Oh, hey, Morty. Brad’s around somewhere.', 'Did you do the thing for Goldenfold’s class? Me neither.'] } } },
  { id: 'brad-walk', who: 'brad', area: 'street', x: -14, z: -6.6, face: 0, roams: true, ai: { wander: [[-14, -6.6], [28, -6.6], [28, -5.8], [-14, -5.8]], speed: 0.9, pause: 2.5, bark: { r: 4, every: 20, lines: ['Sup, Morty.', 'Jessica’s with me, Morty. Just so you know.'] } } },
  { id: 'goldenfold-walk', who: 'goldenfold', area: 'street', x: 12, z: 6.6, face: 0, roams: true, ai: { wander: [[12, 6.6], [40, 6.6], [40, 5.8], [12, 5.8]], speed: 0.7, pause: 3, bark: { r: 4, every: 18, lines: ['Morty! Pop quiz on Monday. Don’t tell anyone I told you.', 'Have you seen Mrs. Pancakes? No? Good. Neither have I.'] } } },
  { id: 'ethan-walk', who: 'ethan', area: 'street', x: DINER.x + 6, z: 6.6, face: Math.PI, roams: true, ai: { wander: [[DINER.x + 6, 6.6], [DINER.x - 10, 6.6], [DINER.x - 10, 5.8], [DINER.x + 6, 5.8]], speed: 0.8, pause: 3, bark: { r: 4, every: 22, lines: ['Hey, Morty. Summer around?', 'They do a breakfast here. The agent gets one every day.'] } } },
  // the town round the street (./town/plan.js): who walks it, and the agent outside the cinema
  ...TOWN_PEOPLE.map((p) => ({ ...p, area: 'street', roams: true, town: true })),
  ...TOWN_STANDING.map((p) => ({ ...p, area: 'street', town: true })),
  // the Oval Office: the President behind the desk, a general either side of it
  { id: 'ovalpresident', who: 'president', area: 'oval', x: -300, z: 695.5, face: S },
  { id: 'general1', who: 'general', area: 'oval', x: -303.2, z: 696.8, face: S },
  { id: 'general2', who: 'general', area: 'oval', x: -296.8, z: 696.8, face: S },
  // Shoney's: the agent on the aisle end of the middle booth's north bench, facing the door
  // Harry Herpson High: the principal at the front by the board, and the class at their desks
  { id: 'principal', area: 'school', x: -303.4, z: 196.2, face: S },
  { id: 'jessica', area: 'school', x: -295.9, z: 199.25, face: Math.PI / 2, sits: true },
  { id: 'brad', area: 'school', x: -294.9, z: 201.25, face: Math.PI / 2, sits: true },
  { id: 'tammy', area: 'school', x: -304.1, z: 199.25, face: Math.PI / 2, sits: true },
  { id: 'ethan', area: 'school', x: -305.1, z: 201.25, face: Math.PI / 2, sits: true },
  { id: 'tinyrick', area: 'school', x: -304.1, z: 203.25, face: Math.PI / 2, sits: true },
  { id: 'dineragent', who: 'fedagent', area: 'diner', x: -305.6, z: 797.35, face: S, sits: true },
  // Phase 2 of the multiverse: Mr. Poopybutthole on the couch's north end by
  // Jerry; Space Beth on her stool in the garage; Nancy and Tricia on Summer's
  // bed, sleeping over; Diane, a hologram in the clone lab (`holo`: drawn, never
  // in the way); Dr. Wong in her armchair. Each is a Meshy figure that loads
  // when its room is first walked into, and is left out if it won't.
  { id: 'poopybutthole', area: 'house', x: -301.6, z: -4.6, face: 0, sits: true },
  { id: 'spacebeth', area: 'garage', x: -298.35, z: 102.4, face: Math.PI, sits: true },
  { id: 'nancy', area: 'upstairs', x: -305.25, z: 397.85, face: S, sits: true },
  { id: 'tricia', area: 'upstairs', x: -304.35, z: 397.85, face: S, sits: true },
  { id: 'diane', area: 'basement', x: -303.6, z: 504.6, face: -Math.PI / 4, holo: true },
  { id: 'drwong', area: 'wong', x: -300, z: 895.9, face: S, sits: true },
  // the destinations' people (./dimensions/destinations.js)
  ...DESTINATIONS.flatMap((d) => d.people),
];
// Is it there, with `done` done? (gone once its `until` is, there only once
// its `after` is; left out: everyone is)
export const present = (o, done) => !done || ((!o.until || !done.includes(o.until)) && (!o.after || done.includes(o.after)));
export const peopleIn = (area, done) => PEOPLE.filter((p) => p.area === area && present(p, done));

// ── Total Rickall's floor ──

// Where Total Rickall's crowd stands in the living room (./interiors/rickall.js
// says who goes where): six along the north wall before the sliding door, two
// by the west wall south of the kitchen door, one by the east wall north of
// the TV, three along the south wall from the couch to the TV, and two out on
// the open floor, the only ones with room for the Photography Raptor's tail
// or Mrs. Refrigerator's arms. `r` is the floor each has round it, clear of
// the furniture, the walls, a body's width of each doorway and the next one's,
// so whoever fits it never stands in anything or anyone. The bookcase's front
// is left free, to get at its shelves, and so is a way from the dining room
// up to every one of them. Each faces the middle of the room.
const LIVING = PLAN.find((r) => r.id === 'living');
const floorSpot = (x, z, r) => ({ x, z, r, face: Math.atan2(z - (LIVING.z0 + LIVING.z1) / 2, (LIVING.x0 + LIVING.x1) / 2 - x) });
export const HOUSE_SPOTS = [
  ...[-303.55, -302.63, -301.71, -300.79, -299.87, -298.95].map((x) => floorSpot(x, -7.55, 0.4)),
  floorSpot(-306.2, -3.45, 0.35),
  floorSpot(-306.2, -2.5, 0.35),
  floorSpot(-297.5, -5.45, 0.4),
  floorSpot(-300.5, -2.5, 0.4),
  floorSpot(-299.5, -2.45, 0.3),
  floorSpot(-298.5, -2.55, 0.4),
  floorSpot(-304, -5.6, 0.9),
  floorSpot(-303.9, -3.4, 0.65),
];

// ── what's in the way ──

// (`top`: how high it is, for what Morty can climb or jump onto; left out, it's too tall to)
const box = (id, x, z, w, d, turn = 0, top = null) => ({ id, kind: 'box', x, z, w, d, turn, ...(top != null && { top }) });
const slab = (id, x0, x1, z0, z1) => box(id, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0);
const circle = (id, x, z, r) => ({ id, kind: 'circle', x, z, r });
const furnished = (area) => [
  ...FURNITURE.filter((f) => f.area === area).map((f) => box(f.id, f.x, f.z, f.w, f.d, f.turn, f.h)),
  // (someone who roams, stage.js's NPC behaviour, is nowhere in particular: not in the way)
  ...PEOPLE.filter((p) => p.area === area && !p.sits && !p.holo && !p.roams).map((p) => circle(p.id, p.x, p.z, PERSON)),
];
// the President's motorcade: the limo and the two beside it, in the way till he's met
export const MOTORCADE = [box('limo', LIMO.x, LIMO.z, LIMO.w, LIMO.d, LIMO.turn), ...PEOPLE.filter((p) => p.until === 'president').map((p) => circle(p.id, p.x, p.z, PERSON))];

export const COLLIDERS = {
  street: [
    // the Smith house and the school as their parts
    ...BUILDINGS.filter((b) => b !== HOUSE && b !== SCHOOL).map((b) => box(b.id, b.x, b.z, b.w, b.d)),
    ...HOUSE_PARTS.map((p) => box(`house-${p.id}`, p.x, p.z, p.w, p.d)),
    ...SCHOOL_PARTS.map((p) => box(`school-${p.id}`, p.x, p.z, p.w, p.d)),
    ...OUTSKIRTS.map((b) => box(b.id, b.x, b.z, b.w, b.d)),
    ...STOOP.map((p) => box(p.id, p.x, p.z, p.w, p.d, 0, p.top)),
    ...TREES.map((t, i) => circle(`tree${i}`, t.x, t.z, trunk(t))),
    ...DECOR.map(decorCollider),
    ...VEHICLES.map((v) => box(v.id, v.x, v.z, v.w, v.d, v.turn)),
    ...PEOPLE.filter((p) => p.area === 'street' && !p.until && !p.roams).map((p) => circle(p.id, p.x, p.z, PERSON)),
    // the town round the street (./town/plan.js): its houses, shops, pond and
    // the rest, the bandstand's floor a step up, and its trees
    ...TOWN_SOLIDS.map((c) => (c.kind === 'box' ? box(c.id, c.x, c.z, c.w, c.d, c.turn) : circle(c.id, c.x, c.z, c.r))),
    ...TOWN_STEPS.map((c) => ({ ...c })),
    ...TOWN_TREES.map((t, i) => circle(`town-tree${i}`, t.x, t.z, trunk(t))),
  ],
  annex: [box('arcade', ARCADE.x, ARCADE.z, ARCADE.w, ARCADE.d)],
  // outside, south-west of the entry
  house: [slab('outside', AREAS.house.x0, -294.5, 3.4, AREAS.house.z1), ...furnished('house')],
  // the void west of the master bedroom, but for the notch at the top of the stairs
  upstairs: [slab('void-north', -306, -303.6, 401.7, 404), slab('void-south', -306, -302.4, 404, AREAS.upstairs.z1), ...furnished('upstairs')],
  garage: furnished('garage'),
  school: furnished('school'),
  arcade: furnished('arcade'),
  basement: furnished('basement'),
  mindblowers: furnished('mindblowers'),
  oval: furnished('oval'),
  diner: furnished('diner'),
  wong: furnished('wong'),
  // each destination's buildings and fittings, and its people (but those who
  // roam, people or crowd: they're never where they started for long)
  ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, [...d.solids.map((o) => ({ ...(o.r ? circle(o.id, o.x, o.z, o.r) : box(o.id, o.x, o.z, o.w, o.d, o.turn)), ...(o.top != null && { top: o.top }), ...(o.ledge && { ledge: true }) })), ...d.people.filter((o) => !o.roams).map((o) => circle(o.id, o.x, o.z, PERSON)), ...d.extras.flatMap((o, n) => (o.roams ? [] : [circle(`${d.id}-extra-${n}`, o.x, o.z, PERSON)]))]])),
};
// Walls: the street's fences, the house's inner walls and the low banister up
// the stairs' open side, and the balcony's low railing on its south edge. A
// room's outer walls are its area's edge, which `stepMorty` keeps in.
export const WALLS = {
  street: FENCES,
  annex: [],
  house: [...INNER_WALLS.house, BANISTER],
  upstairs: [...INNER_WALLS.upstairs, [-302.4, AREAS.upstairs.z1, -294.7, AREAS.upstairs.z1, 0.08, true]],
  garage: [],
  school: [],
  arcade: [],
  basement: ringWalls(RINGS.basement),
  mindblowers: ringWalls(RINGS.mindblowers),
  oval: ringWalls(RINGS.oval),
  diner: [],
  wong: [],
  ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, []])),
};
// The parked cruiser is not here: it moves, so whoever walks passes it in.
// Nor is the motorcade (`motorcade`: with it, as it stands till the President's met).
export const collidersIn = (area, { motorcade = false } = {}) => (motorcade && area === 'street' ? [...COLLIDERS.street, ...MOTORCADE] : COLLIDERS[area]);
export const wallsIn = (area) => WALLS[area];

// What's in the walking camera's way at an outdoor place (scene.js's
// clearance asks, and swings round it): its solids, not its people, each a
// little bigger, as the rooms' furniture is there. One with a `top` is in
// the way up to it, one that says how tall it's drawn (`h`: a well, a table,
// lower than the camera rides) up to that, and the rest at any height (a
// trunk, a house). A room's camera is in close under its ceiling, past
// furniture that carries no height, so its solids aren't asked.
const CAM_PAD = 0.3;
const CAM_SOLIDS = Object.fromEntries(
  DESTINATIONS.filter((d) => d.kind === 'outdoor').map((d) => [
    d.id,
    d.solids.map((o) => ({ x: o.x, z: o.z, y: (o.top ?? o.h ?? Infinity) + CAM_PAD, ...(o.r != null ? { r: o.r + CAM_PAD } : { hw: o.w / 2 + CAM_PAD, hd: o.d / 2 + CAM_PAD, c: Math.cos(o.turn ?? 0), s: Math.sin(o.turn ?? 0) }) })),
  ]),
);
export function camBlocked(area, x, y, z) {
  const list = CAM_SOLIDS[area];
  if (!list) return false;
  for (const o of list) {
    if (y > o.y) continue;
    const dx = x - o.x;
    const dz = z - o.z;
    if (o.r != null ? dx * dx + dz * dz < o.r * o.r : Math.abs(dx * o.c - dz * o.s) < o.hw && Math.abs(dx * o.s + dz * o.c) < o.hd) return true;
  }
  return false;
}

// ── the things to touch ──

const spot = (id, area, x, z, label, verb, more) => ({ id, area, x, z, r: 1.4, label, verb, ...more });
export const HOTSPOTS = [
  // the house: the TV is the east wall's, Jerry's on the couch facing it, Beth at the stove
  spot('cable', 'house', -298.1, -3.5, 'Watch interdimensional cable', 'Watch'),
  spot('jerry', 'house', -301.6, -3.5, 'Jerry', 'Talk'),
  spot('beth', 'house', -310.8, -3.4, 'Beth', 'Talk'),
  spot('butter', 'house', -302.6, 0.8, 'The butter robot', 'Switch on'),
  // an egg on the living room's bookcase that nobody remembers buying: it
  // starts Total Rickall (./interiors/rickall.js)
  spot('egg', 'house', -305.7, -7.1, 'A strange egg', 'Pick it up', { kind: 'rickall' }),
  spot('summer', 'upstairs', -302.4, 397.2, 'Summer', 'Talk'),
  spot('mortyroom', 'upstairs', -297.2, 397, 'Morty’s room', 'Look round'),
  spot('rick', 'garage', -301.9, 99.2, 'Rick', 'Talk'),
  spot('meeseeks', 'garage', -301.4, 102.4, 'Mr. Meeseeks box', 'Press'),
  spot('plumbus', 'garage', -297.45, 99, 'The plumbus factory', 'Watch'),
  spot('portalpanic', 'garage', -302.45, 103.1, 'Portal panic cabinet', 'Play'),
  // Rick's portal gun, on the bench's arm by the portal: its dial sets where the portal opens (./dimensions/destinations.js)
  spot('dial', 'garage', -302.55, 100.15, 'The portal gun: pick a dimension', 'Dial'),
  spot('quiz', 'school', -300, 196.4, 'Mr. Goldenfold’s pop quiz', 'Sit the quiz'),
  // the principal, and the class from the aisle beside their desks
  spot('principal', 'school', -303.4, 196.55, 'Principal Vagina', 'Talk'),
  spot('jessica', 'school', -296.9, 199.25, 'Jessica', 'Talk'),
  spot('brad', 'school', -296.9, 201.25, 'Brad', 'Talk'),
  spot('tammy', 'school', -303.1, 199.25, 'Tammy', 'Talk'),
  spot('ethan', 'school', -303.1, 201.25, 'Ethan', 'Talk'),
  spot('tinyrick', 'school', -303.1, 203.25, 'Tiny Rick', 'Talk'),
  spot('roy', 'arcade', -300, 293.6, 'Roy: A Life Well Lived', 'Put the headset on'),
  spot('cabinet1', 'arcade', -308.4, 297, 'Arcade cabinet', 'Play'),
  spot('cabinet2', 'arcade', -291.6, 300, 'Plumbus Smash', 'Play'),
  spot('cabinet3', 'arcade', -308.4, 303, 'Arcade cabinet', 'Play'),
  // Rick's clone lab: the tube, the west desk's screens, Pickle Rick in his jar on the east desk
  spot('clone', 'basement', -300, 500.9, 'The clone tube', 'Look'),
  spot('console', 'basement', -306.6, 499.2, 'Rick’s console', 'Look'),
  spot('pickle', 'basement', -293.4, 499.2, 'Pickle Rick', 'Look'),
  // Morty's Mind Blowers: at the chair's foot
  spot('chair', 'mindblowers', -300, 601.2, 'Morty’s Mind Blowers', 'Sit in the chair'),
  // the street: the President and his agent till he's met, and the Federation's agents
  spot('president', 'street', LIMO.x - 1.3, -6.1, 'The President', 'Talk', { until: 'president' }),
  spot('secretservice', 'street', LIMO.x + 2, -6.1, 'Secret Service agent', 'Talk', { until: 'president' }),
  spot('agent1', 'street', -34.5, -5.9, 'Federation agent', 'Talk'),
  spot('agent2', 'street', DINER.x - 2, -6.1, 'Federation agent', 'Talk'),
  spot('agent3', 'street', 38.5, 5.9, 'Federation agent', 'Talk'),
  // the town round the street: the park, the shops, the posters (./town/plan.js)
  ...TOWN_SPOTS.map(([id, x, z, label, verb]) => spot(id, 'street', x, z, label, verb, { town: true })),
  // the Oval Office: across the desk from the President, and in front of each general
  spot('ovalpresident', 'oval', -300, 697.5, 'The President', 'Talk'),
  spot('general1', 'oval', -303.2, 697.1, 'A general', 'Talk'),
  spot('general2', 'oval', -296.8, 697.1, 'A general', 'Talk'),
  // Shoney's: the agent in his booth
  spot('dineragent', 'diner', -305.6, 797.35, 'Federation agent', 'Sit down'),
  // Phase 2's people (each sitter's where they sit, as Jerry's is), Snuffles
  // asleep on his dog bed in the living room, and Dr. Wong in her armchair
  spot('poopybutthole', 'house', -301.6, -4.6, 'Mr. Poopybutthole', 'Talk'),
  spot('snuffles', 'house', -304.6, -6.85, 'Snuffles', 'Look'),
  spot('spacebeth', 'garage', -298.35, 102.4, 'Space Beth', 'Talk'),
  spot('nancy', 'upstairs', -305.25, 397.85, 'Nancy', 'Talk'),
  spot('tricia', 'upstairs', -304.35, 397.85, 'Tricia', 'Talk'),
  spot('diane', 'basement', -303.35, 504.35, 'Diane', 'Look'),
  spot('therapy', 'wong', -300, 895.9, 'Dr. Wong', 'Family therapy'),
  // the destinations' people and things (./dimensions/destinations.js)
  ...DESTINATIONS.flatMap((d) => d.hotspots),
];
// An area's hotspots, as there are to reach and to dot on the map (`done`: a
// hotspot whose `until` is done is gone; left out, they all count.
// `gone(id)`: one gone for now, a crystal picked up)
export const hotspotsIn = (area, done, gone = null) => HOTSPOTS.filter((h) => h.area === area && (!done || present(h, done)) && !gone?.(h.id));
export const nearHotspot = (area, x, z, done, gone = null) => nearest(done || gone ? hotspotsIn(area, done, gone) : HOTSPOTS, area, x, z);

// ── walking ──

// `step`: as high as he walks up without jumping; `jump`, how fast he leaves
// the ground (m/s) and `gravity` brings him down; `height`, to the top of his hair
export const MORTY = { radius: 0.4, walk: 3.6, run: 7, accel: 18, turn: 12, step: 0.3, jump: 5.4, gravity: 18, height: 1.6 };
// (`mode`: what's keeping him where he is; 'rickall', the living room while Total Rickall's on)
export const newMorty = (at = START, mode = null) => ({ x: at.x, z: at.z, face: at.face ?? 0, vx: 0, vz: 0, speed: 0, running: false, edge: false, y: 0, vy: 0, air: false, mode });
// as high as he gets onto anything: the top of a jump, and a step over it
export const CLIMB = MORTY.step + MORTY.jump ** 2 / (2 * MORTY.gravity);
// each area's ceiling (in the rooms, as ./interiors draws them; outside, the sky)
export const CEILING = { street: Infinity, annex: Infinity, house: 2.6, upstairs: 2.6, garage: 2.9, school: 2.9, arcade: 8, basement: 4.4, mindblowers: 3.6, oval: 3.4, diner: 3, wong: 2.8, ...Object.fromEntries(DESTINATIONS.map((d) => [d.id, d.kind === 'outdoor' ? Infinity : d.ceiling])) };

// What Morty can stand on in an area: what's low enough to get onto (or a
// place's ledge, `ledge: true`: got onto from the one below it, however high:
// ./dimensions/beanstalk.js), with room for him under the ceiling once he's
// up. Everything else is solid, however high he jumps.
export const standable = (area, c) => c.top != null && (c.top <= CLIMB + 1e-9 || c.ledge === true) && c.top + MORTY.height <= CEILING[area] + 1e-9;
const LOW = Object.fromEntries(Object.keys(AREAS).map((id) => [id, collidersIn(id).filter((c) => standable(id, c))]));
const TOPS = Object.fromEntries(Object.keys(LOW).map((id) => [id, [...new Set(LOW[id].map((c) => c.top))].sort((a, b) => a - b)]));
// what's in his way wherever he stands or jumps: the colliders he can't get onto
export const solidIn = (area, opts) => collidersIn(area, opts).filter((c) => !standable(area, c));

// Is (x, z) over collider c, a little way in from its edge or out past it?
function over(c, x, z, m) {
  if (c.kind === 'circle') return Math.hypot(x - c.x, z - c.z) < c.r + m;
  const t = c.turn || 0;
  const dx = x - c.x;
  const dz = z - c.z;
  const lx = dx * Math.cos(t) - dz * Math.sin(t);
  const lz = dx * Math.sin(t) + dz * Math.cos(t);
  return Math.abs(lx) < c.w / 2 + m && Math.abs(lz) < c.d / 2 + m;
}
// What he'd stand on at (x, z), at height y: the floor, or the top of the
// highest thing under him that he's up on (or can step up onto)
export function supportAt(area, x, z, y = 0) {
  let s = 0;
  for (const c of LOW[area]) if (c.top > s && c.top <= y + MORTY.step + 1e-6 && over(c, x, z, MORTY.radius * 0.25)) s = c.top;
  return s;
}

// Where a mode keeps him (his `mode`): Total Rickall, the living room, a
// body's width in from its walls, so not through its doorways either
const PENS = { rickall: { area: 'house', x0: LIVING.x0 + MORTY.radius, x1: LIVING.x1 - MORTY.radius, z0: LIVING.z0 + MORTY.radius, z1: LIVING.z1 - MORTY.radius } };
const inPen = (p, x, z) => x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1;

// Morty can't stand within a body's width of the edge of where he is (or out
// of his pen). At a height, what's low enough under him is no longer in his way.
const walkerFor = (area, extra = [], reach = 0, pen = null) =>
  makeWalker({
    radius: 1e4,
    colliders: [...collidersIn(area), ...extra].filter((c) => !(standable(area, c) && c.top <= reach)),
    walls: wallsIn(area),
    blocked: (x, z) => !inArea(area, x, z, -MORTY.radius) || (pen != null && !inPen(pen, x, z)),
    body: MORTY,
  });
// kept by area, how many of its tops he's above, the motorcade, where the
// cruiser's parked, his pen, and who's standing about (the crowd)
const WALKERS = new Map();
function walkerAt(area, y, cruiser, motorcade, pen, crowd) {
  const reach = y + MORTY.step + 1e-6;
  const tops = TOPS[area];
  let n = 0;
  while (n < tops.length && tops[n] <= reach) n++;
  const street = area === 'street';
  const who = crowd?.length ? crowd.map((c) => `${c.id}@${c.x},${c.z},${c.r}`).join(';') : '';
  const key = `${area}|${n}|${street && motorcade ? 1 : 0}|${street && cruiser ? `${cruiser.x},${cruiser.z}` : ''}|${pen ? `${pen.x0},${pen.z0}` : ''}|${who}`;
  let w = WALKERS.get(key);
  if (!w) {
    if (WALKERS.size > 64) WALKERS.clear();
    const extra = street ? [...(cruiser ? [circle('cruiser', cruiser.x, cruiser.z, CRUISER.radius)] : []), ...(motorcade ? MOTORCADE : [])] : [];
    for (const c of crowd ?? []) extra.push(circle(c.id, c.x, c.z, c.r));
    w = walkerFor(area, extra, n ? tops[n - 1] : -1, pen);
    WALKERS.set(key, w);
  }
  return w;
}

// One step of walking. `move` is where the visitor wants to go, already turned
// to the world (the camera does that): { x, z } up to length 1, `run`, and
// `jump` (on his feet, he jumps). `cruiser` is where the cruiser is parked, if
// it is: it stands in the street; `motorcade`, whether the President's limo
// and his people stand there too; `crowd`, others standing about ({ id, x, z,
// r }: Total Rickall's); `press`, his jump's (lib/press.js), read in place of
// `move.jump`. He walks up what's a step high, falls off edges,
// lands on what's under him, and a ceiling stops his head. His mode keeps him
// in its pen (brought in to its nearest point, if he's outside it).
export function stepMorty(m, move, dt, area, { cruiser, motorcade = false, crowd = null, press = null } = {}) {
  const pen = PENS[m.mode]?.area === area ? PENS[m.mode] : null;
  if (pen && !inPen(pen, m.x, m.z)) m = { ...m, x: clamp(m.x, pen.x0, pen.x1), z: clamp(m.z, pen.z0, pen.z1) };
  const y0 = m.y ?? 0;
  const n = walkerAt(area, y0, cruiser, motorcade, pen, crowd).step(m, move, dt);
  let y = y0;
  let vy = m.vy ?? 0;
  const ground = supportAt(area, n.x, n.z, y0);
  // a press (lib/press.js's createPress) jumps a moment before his feet touch, or a moment
  // after he's walked off an edge; without one, `move.jump` is this step's alone
  const feet = y <= ground + 1e-3 && vy <= 0;
  press?.ground(feet, dt);
  const jump = press ? press.take() : Boolean(move.jump);
  // `land`: how fast he came down, on the step he lands (0 on every other)
  let land = 0;
  // on his feet (or a step below where he's going): up onto it, and off again if he jumps
  if (feet) {
    // (come down to within a hair of it, the step before: a landing too)
    if (vy < 0) land = -vy;
    y = ground;
    vy = jump ? MORTY.jump : 0;
  } else if (jump && press) vy = MORTY.jump; // off the edge a moment ago: still a jump
  if (vy !== 0 || y > ground) {
    vy -= MORTY.gravity * dt;
    y += vy * dt;
    if (y <= ground) {
      land = -vy;
      y = ground;
      vy = 0;
    }
    const head = CEILING[area] - MORTY.height;
    if (y > head) {
      y = head;
      vy = Math.min(vy, 0);
    }
  }
  return { ...n, y, vy, air: y > ground + 1e-3, land, mode: m.mode ?? null };
}

// Over the open hatch in the garage floor (it's open whenever he's this near), on his feet:
// the way down, as if he'd taken it
export const dropAt = (area, x, z, y = 0) => (area === 'garage' && y < 0.2 && Math.abs(x - HATCH.x) < HATCH.w / 2 - 0.15 && Math.abs(z - HATCH.z) < HATCH.d / 2 - 0.15 ? LINKS.find((l) => l.id === 'garage-hatch') : null);

// ── the cruiser ──

export const CRUISER = { radius: 1.7, hover: 1.2, top: 22, accel: 9, turn: 1.8, climb: 8, ceiling: 120 };
// The cruiser as it's fitted and skilled: the universe's statsOf numbers (the
// pages hand them in: outfit.js's, with the Hangar's parts and the skill
// tree) over its own. The top speed takes the cruise and the boost, the
// pick-up the accel, the turn and the climb the agility; each kept to 0.7 to
// 1.6 of stock, so a street stays a street. Its size, hover and ceiling are
// its own.
const FIT = [0.7, 1.6];
const share = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
const fit = (v) => Math.max(FIT[0], Math.min(FIT[1], v));
export function cruiserOf(stats) {
  if (!stats) return CRUISER;
  const agile = fit(share(stats.agility));
  return { ...CRUISER, top: CRUISER.top * fit(share(stats.cruise) * share(stats.boost)), accel: CRUISER.accel * fit(share(stats.accel)), turn: CRUISER.turn * agile, climb: CRUISER.climb * agile };
}
// where it flies: well past the hedges, over the suburb (it lands only in the street)
export const FLY = { x0: -400, x1: 400, z0: -260, z1: 260 };
const EDGE = 2; // it keeps this far in from the edge of where it flies
const BANK = 0.45; // how far it leans, at most
// the lean is a spring (lib/spring.js): it comes into a turn about as quickly
// as the old 6-a-second ease did, and let go, it swings a hair past level and
// settles, which reads as the weight of the thing
const BANK_SPRING = { k: 60, c: 10 };

export const newCruiser = () => ({ x: BOARD.x, z: BOARD.z, y: CRUISER.hover, yaw: BOARD.yaw, speed: 0, vy: 0, bank: 0, bankV: 0 });

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// what it flies over: each building's footprint, the school's as its parts (flat roofs at their own heights)
// (and the town's: its houses, its shops' parapets, the water tower's tank and the bandstand's roof)
const ROOFS = [...BUILDINGS.filter((b) => b !== SCHOOL), ...OUTSKIRTS, ...SCHOOL_PARTS.map((p) => ({ ...p, roof: p.h })), ...VEHICLES.map((v) => ({ ...v, roof: v.h })), ...TOWN_ROOFS];
// the buildings it is over: their footprints, and the cruiser's own width round
const under = (x, z) => ROOFS.filter((b) => Math.abs(x - b.x) <= b.w / 2 + CRUISER.radius && Math.abs(z - b.z) <= b.d / 2 + CRUISER.radius);

// How low it can fly at (x, z): its hover height, or two metres over the roof
// of whatever it is over.
export const floorAt = (x, z) => Math.max(CRUISER.hover, ...under(x, z).map((b) => b.roof + 2));

// One step of flying. input: { throttle -1..1, steer -1..1 (1 is left, as the
// cars turn), lift -1..1 }; `k`: its numbers (cruiserOf's; stock if none).
export function stepCruiser(c, { throttle = 0, steer = 0, lift = 0 } = {}, dt, k = CRUISER) {
  const turn = clamp(steer, -1, 1);
  const yaw = c.yaw + turn * k.turn * dt;
  let speed = c.speed + clamp(clamp(throttle, -1, 1) * k.top - c.speed, -k.accel * dt, k.accel * dt);
  const s = FLY;
  const goX = Math.sin(yaw) * speed * dt;
  const goZ = Math.cos(yaw) * speed * dt;
  const x = clamp(c.x + goX, s.x0 + EDGE, s.x1 - EDGE);
  const z = clamp(c.z + goZ, s.z0 + EDGE, s.z1 - EDGE);
  // the edge of the street stops what it can't move: nosed into it, it slows to nothing; skimming it, it slides on
  const was = Math.abs(speed);
  if (Math.hypot(goX, goZ) > 1e-9) speed *= Math.hypot(x - c.x, z - c.z) / Math.hypot(goX, goZ);
  // `bump`: the speed something took off it this step (the edge, a roof, the
  // ground, the ceiling), so a knock is as hard as it was
  let bump = was - Math.abs(speed);
  let vy = c.vy + (clamp(lift, -1, 1) * k.climb - c.vy) * Math.min(1, dt * 5);
  let y = c.y + vy * dt;
  const floor = floorAt(x, z);
  if (y < floor || y > CRUISER.ceiling) {
    y = clamp(y, floor, CRUISER.ceiling);
    bump += Math.abs(vy);
    vy = 0;
  }
  const [bank, bankV] = springStep(c.bank ?? 0, c.bankV ?? 0, turn * clamp(speed / k.top, -1, 1) * BANK, BANK_SPRING.k, BANK_SPRING.c, dt);
  return { x, z, y, yaw, speed, vy, bank, bankV, bump };
}

// Slow, over open ground in the street: not a roof, a fenced back yard, a tree
// or any of the street's small things, and not on a street door or where
// Morty comes out into the street (it keeps far enough off that he stands
// clear of it there).
const inYard = (x, z) => YARDS.some((y) => x >= y.x0 && x <= y.x1 && z >= y.z0 && z <= y.z1);
const DOORSTEP = CRUISER.radius + MORTY.radius + 0.3;
const DOORSTEPS = [...LINKS.filter((l) => l.area === 'street'), ...LANDINGS];
const onSomething = (x, z, motorcade) =>
  TREES.some((t) => Math.hypot(x - t.x, z - t.z) < CRUISER.radius + trunk(t)) ||
  DECOR.some((d) => Math.hypot(x - d.x, z - d.z) < CRUISER.radius + (d.w ? Math.hypot(d.w, d.d) / 2 : d.r)) ||
  DOORSTEPS.some((p) => Math.hypot(x - p.x, z - p.z) < DOORSTEP) ||
  PEOPLE.some((p) => p.area === 'street' && !p.roams && (motorcade || !p.until) && Math.hypot(x - p.x, z - p.z) < CRUISER.radius + PERSON + 0.3) ||
  (motorcade && Math.hypot(x - LIMO.x, z - LIMO.z) < CRUISER.radius + Math.hypot(LIMO.w, LIMO.d) / 2);
// (`motorcade`: the President's limo and people are in the street, and in the way)
export const canLand = (c, { motorcade = false } = {}) => Math.abs(c.speed) < 3 && inArea('street', c.x, c.z) && under(c.x, c.z).length === 0 && !inYard(c.x, c.z) && !onSomething(c.x, c.z, motorcade);

// do the segments a-b and c-d cross?
const crosses = (ax, az, bx, bz, [cx, cz, dx, dz]) => {
  const side = (px, pz, qx, qz, rx, rz) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  return side(ax, az, bx, bz, cx, cz) * side(ax, az, bx, bz, dx, dz) < 0 && side(cx, cz, dx, dz, ax, az) * side(cx, cz, dx, dz, bx, bz) < 0;
};

// Where Morty steps out: beside it (its own +x side first, then round the
// compass), clear of the cruiser and everything else, never on the far side of
// a fence from it, facing the way its nose points.
export function exitCruiser(c, { motorcade = false } = {}) {
  const colliders = [...collidersIn('street', { motorcade }), circle('cruiser', c.x, c.z, CRUISER.radius)];
  const walls = wallsIn('street');
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  // a direction `a` to its +x side and `b` ahead of it
  const dir = (a, b) => [(fz * a + fx * b) / Math.hypot(a, b), (-fx * a + fz * b) / Math.hypot(a, b)];
  const dirs = [dir(1, 0), dir(-1, 0), dir(0, -1), dir(0, 1), dir(1, 1), dir(-1, 1), dir(1, -1), dir(-1, -1)];
  const gap = CRUISER.radius + MORTY.radius + 0.6;
  const spots = [0, 0.9, 1.8].flatMap((more) => dirs.map(([dx, dz]) => [c.x + dx * (gap + more), c.z + dz * (gap + more)]));
  const clear = ([x, z]) => {
    const [px, pz] = pushOut(x, z, MORTY.radius, colliders, walls);
    // (pushOut cannot tell which way to push a point exactly on a wall, so that is not clear either)
    return inArea('street', x, z, -MORTY.radius) && Math.hypot(px - x, pz - z) < 1e-6 && !walls.some((w) => segDist(x, z, w) < 1e-6 || crosses(c.x, c.z, x, z, w));
  };
  const [x, z] = spots.find(clear) ?? pushOut(...spots[0], MORTY.radius, colliders, walls);
  return { x, z, face: Math.atan2(-fz, fx) };
}

// ── what there is to do ──

export const TASKS = [
  { id: 'cable', name: 'Watch interdimensional cable', hint: 'Go into the Smith house and put interdimensional cable on the TV.' },
  { id: 'butter', name: 'The butter robot', hint: 'Switch on the butter robot at the Smiths’ breakfast table.' },
  { id: 'meeseeks', name: 'Summon a Meeseeks', hint: 'Press the Meeseeks box on the worktable in Rick’s garage.' },
  { id: 'plumbus', name: 'See a plumbus made', hint: 'Watch the plumbus factory in Rick’s garage.' },
  { id: 'portalpanic', name: 'Play Portal panic', hint: 'Play the Portal panic cabinet in Rick’s garage.' },
  { id: 'quiz', name: 'Pass the pop quiz', hint: 'Sit Mr. Goldenfold’s pop quiz at Harry Herpson High, and get seven right.' },
  { id: 'fly', name: 'Fly the cruiser', hint: 'Board Rick’s space cruiser in the driveway, then fly it through the rings over the street with the Federation ship on your tail.' },
  { id: 'president', name: 'Meet the President', hint: 'The President’s limo is parked outside the Smith house, and he wants Rick.' },
  { id: 'oval', name: 'Visit the Oval Office', hint: 'Take the President’s portal by the garage door in Rick’s garage.' },
  { id: 'diner', name: 'Have breakfast at Shoney’s', hint: 'A Federation agent is waiting in a booth at Shoney’s, up the street from the Smiths’.' },
  { id: 'portal', name: 'Go through the portal', hint: 'The portal gun is on Rick’s bench in the garage (or its button up top, from anywhere): dial a dimension, then step through the portal on the west wall.' },
  { id: 'basement', name: 'Find Rick’s secret lab', hint: 'There’s a hatch in the garage floor.' },
  { id: 'mindblowers', name: 'Watch Morty’s Mind Blowers', hint: 'Through the door in Rick’s clone lab, sit in the chair.' },
  { id: 'roy', name: 'Play Roy', hint: 'Dial Blips and Chitz on the portal gun, go through the portal and put the headset on at the Roy cabinet.' },
  { id: 'roy55', name: 'Outlive Morty’s 55', hint: 'Play Roy again and live past Morty’s 55.' },
  { id: 'rickall', name: 'Survive Total Rickall', hint: 'There’s an egg on the Smiths’ living-room bookcase that nobody remembers buying.' },
  { id: 'wong', name: 'Go to family therapy', hint: 'Dr. Wong’s office is in the house next to Shoney’s, up the street. Rick says it’s for Jerry.' },
  // (a big planet's box tasks are retired: it's a world of its own now, its
  // quests kept apart from these, so C-137 neither counts nor points to them)
  ...DESTINATIONS.filter((d) => !isBigPlanet(d.id)).flatMap((d) => d.tasks),
  // (the town's, new on the end of the list)
  ...TOWN_TASKS,
];

// ── Morty's Mind Blowers ──

// The memories Rick took out of Morty's head, one to a vial, as the chair
// plays them: the vial's colour (blue: Morty's mistakes; purple: the
// family's; red: Rick's own; pink: from the liquor cabinet) and what it was.
export const MEMORIES = [
  { id: 'tortoise', color: 'blue', caption: 'The Truth Tortoise. You looked it in the eye, and for a second everything made sense.' },
  { id: 'squirrels', color: 'blue', caption: 'You found out who really runs the planet. It was the squirrels. You had to move dimensions.' },
  { id: 'venzenulon', color: 'red', caption: 'Rick swore it was Venzenulon 7. It was Venzenulon 9.' },
  { id: 'saved', color: 'purple', caption: 'The day Mom had to choose which kid to save first.' },
  { id: 'voltematron', color: 'blue', caption: 'Voltematron moved into your body and wouldn’t leave.' },
  { id: 'zoo', color: 'red', caption: 'Rick got you both out of an alien zoo by talking NASA into taking your place.' },
  { id: 'snowball', color: 'purple', caption: 'Your head, on Snowball’s body. Nobody at dinner noticed.' },
  { id: 'cabinet', color: 'pink', caption: 'This one’s from by the liquor cabinet. Rick says don’t.' },
];
export const MEMORY_COLORS = { blue: '#52d6ff', purple: '#b47cff', red: '#ff4d5e', pink: '#ff8fd0' };

// the planets' things to do, done on the planets themselves (landed on from
// the universe map, or for the sector's four dialled too): the small ones'; a big planet's are retired with TASKS'
export const PLANET_TASKS = new Set(DESTINATIONS.filter((d) => isPlanet(d.id) && !isBigPlanet(d.id)).flatMap((d) => d.tasks.map((t) => t.id)));

// a thing to do's hint as this player's told it: on a touch screen, a row
// whose hint names a key (F, E) has its buttons' words too (`touch`)
export const hintOf = (t, touch = false) => (touch && t.touch) || t.hint;

// What's done and what's next. `done` is the ids finished, in any order.
// `skip` (ids, or a Set) is passed over when picking what's next, but still
// counts: C-137 skips PLANET_TASKS. On `touch`, what's next is said with its
// buttons (hintOf).
export function progress(done = [], { skip = [], touch = false } = {}) {
  const passed = new Set(skip);
  const finished = TASKS.filter((t) => done.includes(t.id));
  const left = TASKS.filter((t) => !done.includes(t.id));
  const next = left.find((t) => !passed.has(t.id)) ?? null;
  // (the planets whose things are left, by name: the map's alone, then the
  // ones the gun dials too, in the dial's order)
  const leftOn = (d) => d.tasks.some((x) => left.some((t) => t.id === x.id));
  const gun = DIAL.map((x) => DESTINATIONS.find((d) => d.id === x.id && isPlanet(d.id))).filter((d) => d && leftOn(d));
  const map = [...new Set(left.map((t) => DESTINATIONS.find((d) => isPlanet(d.id) && d.tasks.some((x) => x.id === t.id))))].filter((d) => d && !gun.includes(d));
  const named = (ds) => ds.map((d) => d.name.replace(/^The /, 'the ')).reduce((s, n, i, a) => (i ? `${s}${i === a.length - 1 ? ' and ' : ', '}${n}` : n), '');
  const onGun = gun.length ? `${named(gun)}, which ${gun.length === 1 ? 'is' : 'are'} on the portal gun too` : '';
  const rest = left.every((t) => PLANET_TASKS.has(t.id)) ? `Everything here’s done. The rest are on the planets in the Rick and Morty sector of the universe map: ${[named(map), onGun].filter(Boolean).join(', and ')}.` : 'Everything here’s done.';
  return { done: finished.map((t) => t.id), count: finished.length, total: TASKS.length, next, objective: next ? hintOf(next, touch) : left.length ? rest : 'Everything’s done. Wubba lubba dub dub.' };
}

// ── the pop quiz ──

// Ten questions on the show. `answer` is the index of the right option.
export const QUIZ = [
  { q: 'What is the name of Rick’s home dimension?', options: ['B-52', 'C-137', 'D-99', 'Z-612'], answer: 1 },
  { q: 'Which alien arcade does Rick take Morty to?', options: ['Blips and Chitz', 'Zorp’s Game Hole', 'Planet Pixel', 'The Citadel Arcade'], answer: 0 },
  { q: 'How old was Roy when Morty’s game of Roy: A Life Well Lived ended?', options: ['45', '65', '35', '55'], answer: 3 },
  { q: 'What did Rick turn himself into to get out of family therapy?', options: ['a teddy bear', 'a pickle', 'a toaster', 'a goldfish'], answer: 1 },
  { q: 'What does a Mr. Meeseeks exist to do?', options: ['cook breakfast for the family', 'guard Rick’s garage', 'complete one task, then vanish', 'fly the space cruiser'], answer: 2 },
  { q: 'What was the butter robot built to do?', options: ['toast the bread', 'wash the dishes', 'stir the coffee', 'pass the butter'], answer: 3 },
  { q: 'Which planet is Birdperson from?', options: ['Gazorpazorp', 'Bird World', 'Planet Squanch', 'Earth'], answer: 1 },
  { q: 'What do the giant floating heads in the sky demand?', options: ['Sing us a lullaby', 'Hand over the planet', 'Show me what you got', 'Pay the entry fee'], answer: 2 },
  { q: 'What is the line in Jerry’s apple ad?', options: ['Hungry for apples?', 'Got apples?', 'Crunch into summer?', 'Craving something sweet?'], answer: 0 },
  { q: 'Who is Morty’s sister?', options: ['Beth', 'Jessica', 'Summer', 'Tammy'], answer: 2 },
];

// `answers` is the option picked for each question, in order; a blank is wrong.
export function grade(answers = []) {
  const right = QUIZ.filter((q, i) => answers[i] === q.answer).length;
  return { right, total: QUIZ.length, pass: right >= 7 };
}
