// Albuquerque, the world: the map, what's open, the car, Hank and the town's
// traffic, with no drawing in them.
//
// You start on Walt's driveway in his Aztek and drive between the places the
// shows happen: the RV out in the desert, Saul's office, Los Pollos Hermanos,
// the superlab under the laundry, Casa Tranquila. They open as Walt's career
// grows (Metherria's, saved as tp-metherria): two orders and Saul will see
// you, Cap'n Cook and Gus will, the superlab once it's bought, and Casa
// Tranquila once you've met Gus. Hank cruises the blocks round Walt's street
// in his SUV; stay close to him for long and he pulls you over.
//
// The town is a city now: a grid of streets eight blocks across and six deep
// (plan.js stands a building, a yard or a car park on every lot), downtown's
// towers where Central crosses 4th, Route 66's motels and shops along
// Central, houses either side, warehouses by the tracks. Central and 4th run
// on out into the desert. The cars on the streets keep to their lanes, stop
// at the lights on Central and the boulevards and at the stop signs
// everywhere else, and wait for whatever's in front of them, you included.
//
// Metres; +x is east, +z is south. A heading (yaw) of 0 faces +z.

import { CAR_TYPES, planCity } from './plan';

// The edge of the world: a ranch fence right round, out in the dunes, where
// you can see it. (The city is flat; the dunes start at DUNES.)
export const WORLD_RADIUS = 420;
export const DUNES = 310;

// How high the ground is at a point: flat through town, then low dunes that
// level off before the mesas. The scene builds the desert from this, and the
// car rides it.
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= DUNES) return 0;
  const out = Math.min(1.25, (r - DUNES) / 250);
  return out * out * (6 + 5 * Math.sin(x * 0.013) * Math.cos(z * 0.017) + 3 * Math.sin((x + z) * 0.031)) - 0.05;
}

// ── the streets ──

// The grid: where its streets run (x for the ones running north–south, z
// for east–west), how wide the sidewalks are and how high the kerbs.
export const GRID = { xs: [-240, -180, -120, -60, 0, 60, 120, 180, 240], zs: [-180, -120, -60, 0, 60, 120, 180], sidewalk: 3, kerb: 0.14 };
const [X0, X1] = [GRID.xs[0], GRID.xs[GRID.xs.length - 1]];
const [Z0, Z1] = [GRID.zs[0], GRID.zs[GRID.zs.length - 1]];
const ew = (id, name, z, w, a = X0, b = X1) => ({ id, name, a: { x: a, z }, b: { x: b, z }, w });
const ns = (id, name, x, w, a = Z0, b = Z1) => ({ id, name, a: { x, z: a }, b: { x, z: b }, w });

// Roads: a centre line from a to b, and a width. Dirt is slower than asphalt.
// Central (Route 66) and 4th run out of town to the fence; the dirt track
// heads off west from the end of Coal toward To'hajiilee and the RV.
export const ROADS = [
  ew('lomas', 'Lomas Boulevard', -180, 12),
  ew('marquette', 'Marquette Avenue', -120, 10),
  ew('negra', 'Negra Arroyo Lane', -60, 10, X0, -60),
  ew('copper', 'Copper Avenue', -60, 10, -60, X1),
  ew('central', 'Central Avenue', 0, 16),
  ew('route66w', 'Route 66', 0, 11, -414, X0),
  ew('route66e', 'Route 66', 0, 11, X1, 414),
  ew('gold', 'Gold Avenue', 60, 10),
  ew('coal', 'Coal Avenue', 120, 10),
  ew('bridge', 'Bridge Boulevard', 180, 12),
  ns('coors', 'Coors Boulevard', -240, 12),
  ns('riogrande', 'Rio Grande Boulevard', -180, 10),
  ns('juan', 'Juan Tabo Boulevard', -120, 10),
  ns('sixth', '6th Street', -60, 10),
  ns('fourth', '4th Street', 0, 12),
  ns('fourthn', '4th Street', 0, 10, -414, Z0),
  ns('fourths', '4th Street', 0, 10, Z1, 414),
  ns('second', '2nd Street', 60, 10),
  ns('broadway', 'Broadway', 120, 12),
  ns('university', 'University Boulevard', 180, 10),
  ns('sanmateo', 'San Mateo Boulevard', 240, 12),
  { id: 'dirt', name: 'the track to To’hajiilee', a: { x: X0, z: 120 }, b: { x: -336, z: 120 }, w: 7, dirt: true },
];
// The wide ones: lights where two of them cross, and all along Central.
const ARTERIAL = (r) => r.w >= 12;

// ── the places ──

// The places: where the building stands (at, facing yaw), its footprint
// (w across its front, d deep), where you pull up (door), and how near is near.
export const PLACES = [
  { id: 'home', name: 'Walt’s house', sub: '308 Negra Arroyo Lane', at: { x: -100, z: -78 }, yaw: 0, w: 16, d: 12, foot: { w: 15.4, d: 12 }, door: { x: -95, z: -63 }, radius: 8, model: 'house' },
  { id: 'rv', name: 'The RV', sub: 'Out past To’hajiilee', at: { x: -340, z: 128 }, yaw: Math.PI / 2, w: 8.5, d: 3, foot: { w: 8.4, d: 2.7 }, door: { x: -330, z: 120 }, radius: 8, model: 'rv' },
  { id: 'saul', name: 'Saul Goodman & Associates', sub: 'Attorney at law', at: { x: -90, z: 22 }, yaw: Math.PI, w: 16, d: 10, foot: { w: 15.4, d: 15.2 }, door: { x: -90, z: 5 }, radius: 8, model: 'office' },
  { id: 'pollos', name: 'Los Pollos Hermanos', sub: 'The finest ingredients', at: { x: 90, z: -24 }, yaw: 0, w: 18, d: 12, foot: { w: 17.4, d: 17 }, door: { x: 90, z: -5 }, radius: 8, model: 'pollos' },
  { id: 'superlab', name: 'Lavandería Brillante', sub: 'The superlab is underneath', at: { x: 155, z: -24 }, yaw: 0, w: 24, d: 14, foot: { w: 23.4, d: 12 }, door: { x: 155, z: -5 }, radius: 9, model: 'laundry' },
  { id: 'casa', name: 'Casa Tranquila', sub: 'Hector has a visitor', at: { x: 24, z: 100 }, yaw: -Math.PI / 2, w: 20, d: 12, foot: { w: 17, d: 19.4 }, door: { x: 4, z: 100 }, radius: 8, model: 'casa' },
];
// how each one opens, and what to do if it hasn't
const OPENS = {
  home: () => true,
  rv: () => true,
  saul: (s) => s.served >= 2,
  pollos: (s) => s.points >= 40,
  superlab: (s) => s.upgrades.includes('superlab'),
  casa: (s) => s.visited.includes('pollos'),
};
const HINT = {
  saul: 'Serve two orders at the RV, and Saul will see you.',
  pollos: 'Make Cap’n Cook at the RV (40 points), and Gus will see you.',
  superlab: 'Buy the superlab at Saul’s office ($150).',
  casa: 'Meet Gus at Los Pollos Hermanos first.',
};
const GO = {
  rv: 'Drive out to the RV in the desert, west past Coors along the dirt track. Jesse’s waiting.',
  saul: 'Saul will see you now. Drive to Saul Goodman & Associates, on Central.',
  pollos: 'Gus will see you. Drive to Los Pollos Hermanos, on Central east of 2nd.',
  superlab: 'The superlab’s yours. Drive to the laundry on Central, past Broadway.',
  casa: 'Drive to Casa Tranquila, down 4th Street. Hector has a visitor.',
};
const ORDER = ['rv', 'saul', 'pollos', 'superlab', 'casa'];

// Landmarks you can't go into, and the neighbours' houses on Walt's street.
export const LANDMARKS = [{ id: 'carwash', name: 'A1A Car Wash', at: { x: 100, z: 26 }, yaw: Math.PI, w: 18, d: 10, foot: { w: 14.8, d: 17.4 }, model: 'carwash' }];
export const HOUSES = [-220, -199, -161, -139, -78]
  .map((x, i) => ({ id: `n${i}`, at: { x, z: -78 }, yaw: 0, w: 13, d: 10 }))
  .concat([-220, -199, -161, -139, -101, -79].map((x, i) => ({ id: `s${i}`, at: { x, z: -42 }, yaw: Math.PI, w: 13, d: 10 })));

// The rest of town the shows put somewhere: real Albuquerque (the KiMo
// Theatre, the Dog House, Loyola's diner) and the shows' own (the DEA's field
// office, the Crossroads Motel, a house under Vamonos Pest's tent, Jesse's
// place, Hank and Marie's, Old Joe's junkyard). `w` runs east-west and `d`
// north-south as each one stands; `face` is the side its front is on; `h`
// its height. scene's ./buildings.js builds each to exactly this footprint
// (the ones Meshy made have their model's own proportions here).
export const TOWN = [
  { id: 'kimo', kind: 'deco', name: 'KiMo Theatre', at: { x: -24, z: -20 }, w: 16.5, d: 17, h: 16, face: 's' },
  { id: 'doghouse', kind: 'hotdog', name: 'The Dog House', at: { x: -80, z: -20 }, w: 8.25, d: 7, h: 3.6, face: 's' },
  { id: 'gas', kind: 'gas', name: 'Big Chief', at: { x: 25, z: -21 }, w: 12, d: 8, h: 4, face: 's' },
  { id: 'motel', kind: 'motel', name: 'Crossroads Motel', at: { x: 210, z: -22 }, w: 34, d: 9.7, h: 4, face: 's' },
  { id: 'diner', kind: 'diner', name: 'Loyola’s', at: { x: 150, z: 20 }, w: 16, d: 11, h: 4.2, face: 'n' },
  { id: 'bank', kind: 'brick', name: 'Mesa Credit Union', at: { x: -25, z: 22 }, w: 18, d: 14, h: 9, face: 'n' },
  { id: 'dea', kind: 'office', name: 'DEA', at: { x: 32, z: 24 }, w: 24.2, d: 18, h: 24, face: 'n' },
  { id: 'pest', kind: 'tent', name: 'Vamonos Pest', at: { x: 150, z: 80 }, w: 11.2, d: 13, h: 6, face: 'n' },
  { id: 'tuco', kind: 'brick', name: 'Tampico Furniture', at: { x: 20, z: 150 }, w: 14, d: 18, h: 8, face: 'w' },
  { id: 'hank', kind: 'adobe', name: 'The Schraders’', at: { x: 200, z: -95 }, w: 12, d: 14.85, h: 4.4, face: 'w' },
  { id: 'jesse', kind: 'spanish', name: 'Jesse’s house', at: { x: -20, z: 90 }, w: 13, d: 13.75, h: 7.4, face: 'e' },
  { id: 'junkyard', kind: 'junkyard', name: 'Old Joe’s', at: { x: -31, z: 150 }, w: 26, d: 20, h: 3, face: 'e' },
  { id: 'tower', kind: 'tower', name: 'the water tower', at: { x: 80, z: 85 }, w: 7, d: 7, h: 19, face: 'n' },
  { id: 'beneke', kind: 'warehouse', name: 'Beneke Fabricators', at: { x: 90, z: -150 }, w: 30, d: 18, h: 8, face: 'n' },
  // Saul's yellow Suzuki Esteem, parked beside his office, and the water tank out where one of the drops is
  { id: 'esteem', kind: 'car', name: 'Saul’s Esteem', at: { x: -104, z: 18 }, w: 1.94, d: 4.2, h: 1.47, face: 'n' },
  { id: 'watertank', kind: 'tower', name: 'the water tank', at: { x: -275, z: -150 }, w: 7, d: 6.23, h: 13.6, face: 's' },
];
// The tracks north of town, and the freight that comes down them.
export const RAIL = { z: -205, from: -700, to: 700 };

// ── things out in the desert and round town ──

// Blue Sky: twelve crystals left about, mostly out in the desert, a few
// hidden in town (the park, the civic plaza, behind the junkyard, a yard by
// the tracks), all off the roads. Drive over one and it's yours (kept as
// tp-abq-blue); find all twelve and the night sky has something to say about it.
export const CRYSTALS = [
  { id: 'b1', x: -300, z: 170 },
  { id: 'b2', x: -330, z: -60 },
  { id: 'b3', x: 292, z: -40 },
  { id: 'b4', x: 150, z: 272 },
  { id: 'b5', x: -150, z: -262 },
  { id: 'b6', x: 262, z: -230 },
  { id: 'b7', x: -60, z: 300 },
  { id: 'b8', x: 330, z: 200 },
  { id: 'b9', x: -100, z: 101 },
  { id: 'b10', x: 14, z: -74 },
  { id: 'b11', x: -49, z: 166 },
  { id: 'b12', x: 150, z: -140 },
];
const CRYSTAL_REACH = 3.4;

// Deliveries: a drop somewhere out in the desert and a clock.
export const DROPS = [
  { id: 'd1', name: 'the cow house', x: -300, z: 230 },
  { id: 'd2', name: 'the wash under the mesa', x: 200, z: 300 },
  { id: 'd3', name: 'the old drive-in', x: 330, z: -120 },
  { id: 'd4', name: 'the water tank', x: -262, z: -150 },
  { id: 'd5', name: 'the arroyo', x: 90, z: -300 },
  { id: 'd6', name: 'the dunes past To’hajiilee', x: -360, z: 60 },
  { id: 'd7', name: 'the old billboard', x: 340, z: 150 },
  { id: 'd8', name: 'the dry lake', x: -100, z: 340 },
];

// The A1A Car Wash: pull up on its forecourt and the Aztek gets a wash.
export const WASH = { x: 100, z: 12.5, radius: 6, seconds: 3.2 };
export const atWash = (x, z) => Math.hypot(x - WASH.x, z - WASH.z) < WASH.radius;

// Walt's car, parked on his driveway, side on to the garage: the first
// press of W drives off along the drive, not into the garage door.
export const SPAWN = { x: -95, z: -68.8, yaw: Math.PI / 2 };

// ── the city on the grid ──

// What each block is: rows north to south (Lomas to Marquette first),
// columns west to east (Coors to Rio Grande first).
const ZONES = [
  ['res', 'res', 'res', 'ind', 'ind', 'ind', 'ind', 'ind'],
  ['res', 'res', 'res', 'core', 'civic', 'mid', 'res', 'res'],
  ['strip-s', 'strip-s', 'strip-s', 'core', 'core', 'strip-s', 'strip-s', 'strip-s'],
  ['strip-n', 'strip-n', 'strip-n', 'mid', 'mid', 'strip-n', 'strip-n', 'strip-n'],
  ['res', 'res', 'park', 'res', 'res', 'res', 'res', 'res'],
  ['res', 'res', 'res', 'ind', 'res', 'res', 'res', 'res'],
];

// What the shows have put somewhere, as land the city mustn't build on.
const footOf = (o) => {
  if (o.foot) return { w: o.foot.w, d: o.foot.d };
  if (o.yaw !== undefined) {
    const side = Math.abs(Math.sin(o.yaw)) > 0.5;
    return { w: side ? o.d : o.w, d: side ? o.w : o.d };
  }
  return { w: o.w, d: o.d };
};
const RESERVED = [
  ...[...PLACES, ...LANDMARKS].map((p) => ({ id: p.id, x: p.at.x, z: p.at.z, ...footOf(p), pad: 3 })),
  ...HOUSES.map((h) => ({ id: h.id, x: h.at.x, z: h.at.z, ...footOf(h), pad: 1 })),
  ...TOWN.map((t) => ({ id: t.id, x: t.at.x, z: t.at.z, w: t.w, d: t.d, pad: 3.4 })),
];
const KEEP = [
  ...PLACES.map((p) => ({ x: p.door.x, z: p.door.z, r: p.radius + 2 })),
  { x: WASH.x, z: WASH.z, r: WASH.radius + 2.5 },
  ...CRYSTALS.map((c) => ({ x: c.x, z: c.z, r: 4.2 })),
  ...DROPS.map((d) => ({ x: d.x, z: d.z, r: 9 })),
  { x: SPAWN.x, z: SPAWN.z, r: 5 },
];
// (the parking in front of the shows' own shops and offices)
const PADS = ['saul', 'pollos', 'superlab', 'carwash', 'dea', 'diner', 'gas', 'motel', 'bank', 'tuco'].map((id) => RESERVED.find((q) => q.id === id)).filter(Boolean);

export const CITY = planCity({ xs: GRID.xs, zs: GRID.zs, roads: ROADS, zoneAt: (i, j) => ZONES[j]?.[i] ?? 'res', reserved: RESERVED, keep: KEEP, sidewalk: GRID.sidewalk });
// Walt's drive
CITY.lots.push({ x: -95, z: -69.6, w: 3.6, d: 6.2, surface: 'concrete' });
for (const q of PADS) {
  // a car park round each, out to the sidewalk on the street side
  const b = CITY.blocks.find((k) => q.x > k.x0 && q.x < k.x1 && q.z > k.z0 && q.z < k.z1);
  if (!b) continue;
  const x0 = Math.max(b.x0, q.x - q.w / 2 - 6);
  const x1 = Math.min(b.x1, q.x + q.w / 2 + 6);
  const z0 = q.z < (b.z0 + b.z1) / 2 ? b.z0 : Math.max(b.z0, q.z - q.d / 2 - 6);
  const z1 = q.z < (b.z0 + b.z1) / 2 ? Math.min(b.z1, q.z + q.d / 2 + 6) : b.z1;
  CITY.lots.unshift({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, surface: 'asphalt', bays: 'z' });
}

// The size a parked car takes up, turned the way it's parked.
const CAR_BOX = { w: 2.05, d: 4.6 };
const parkedBox = (p, i) => {
  const across = Math.abs(Math.sin(p.yaw)) > 0.5;
  return { id: `p${i}`, x: p.x, z: p.z, w: across ? CAR_BOX.d : CAR_BOX.w, d: across ? CAR_BOX.w : CAR_BOX.d, kind: 'car' };
};

// What you can drive into. A building's `foot` is what its model really
// covers on the ground (across x, then z, as it stands, measured off the
// model), so the car stops at the wall it can see and nowhere else; without
// one, its w and d turned to its heading. Then the city's own: its
// buildings, the walls between back yards and the cars left parked.
const box = (o) => ({ id: o.id, x: o.at.x, z: o.at.z, ...footOf(o) });
export const COLLIDERS = [...PLACES, ...LANDMARKS, ...HOUSES]
  .map(box)
  .concat(TOWN.map((t) => ({ id: t.id, x: t.at.x, z: t.at.z, w: t.w, d: t.d })))
  .concat(CITY.buildings.map((b) => ({ id: b.id, x: b.x, z: b.z, w: b.w, d: b.d, h: b.h })))
  .concat(CITY.walls.map((w, i) => ({ id: `w${i}`, x: w.x, z: w.z, w: w.w, d: w.d, kind: 'wall' })))
  .concat(CITY.parked.map(parkedBox));

// The colliders by where they are, so a step only looks at what's near.
const CELL = 24;
const SPAN = 4; // a collider counts in every cell it reaches into, and this far round it
const HASH = new Map();
for (const c of COLLIDERS) {
  const [i0, i1] = [Math.floor((c.x - c.w / 2 - SPAN) / CELL), Math.floor((c.x + c.w / 2 + SPAN) / CELL)];
  const [j0, j1] = [Math.floor((c.z - c.d / 2 - SPAN) / CELL), Math.floor((c.z + c.d / 2 + SPAN) / CELL)];
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++) {
      const k = `${i},${j}`;
      if (!HASH.has(k)) HASH.set(k, []);
      HASH.get(k).push(c);
    }
}
const NONE = [];
// what the car (anything within SPAN of the point) could touch here
export const collidersNear = (x, z) => HASH.get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? NONE;

// The blocks stand a kerb's height above the street: the car rides up onto
// a sidewalk, a car park or a yard, and down again.
const ROWS = GRID.zs.length - 1;
export function onBlock(x, z) {
  if (x <= X0 || x >= X1 || z <= Z0 || z >= Z1) return false;
  let i = 0;
  while (GRID.xs[i + 1] < x) i++;
  let j = 0;
  while (GRID.zs[j + 1] < z) j++;
  const b = CITY.blocks[i * ROWS + j];
  return !!b && x > b.kerb.x0 && x < b.kerb.x1 && z > b.kerb.z0 && z < b.kerb.z1;
}
export const surfaceHeight = (x, z) => groundHeight(x, z) + (onBlock(x, z) ? GRID.kerb : 0);

// ── driving ──

// The Aztek: metres, seconds and radians. How fast it goes on each surface,
// how hard it pulls, brakes and coasts down (`bog` is how fast speed it
// can't hold comes off: running wide onto the sand slows it over a second,
// it doesn't stop it), and how it turns: `lock` is the
// front wheels' full lock and `wheelbase` the distance between its axles (a
// turning circle under eight metres across at parking speed); `grip` is the
// sideways pull its tyres hold on each surface (m/s²) before they slide, and
// `bite` how far past that a full turn of the wheel asks at speed (nothing
// on the road, where flat out it corners as hard as it grips and no harder;
// more on dirt and sand, where it drifts). The handbrake locks the back wheels: it slows the
// car (`handbrake`), leaves the tail a fraction of its grip (`loose`) and
// swings it round (`swing` times the turn, up to `spin` rad/s), for a
// handbrake turn. `response` is how quickly it takes up a turn (per second;
// `responseLoose` with the tail loose, and `carry` how slowly a spin dies
// away while the handbrake's still on), `align` how hard it straightens
// itself out of a small slide, and `power` how much of a sliding tyre's grip
// full throttle takes away (a slide is held on the throttle). `pivot` is the
// tightest it can turn about itself, sliding (metres): however it's
// spinning, it turns no faster than its speed over that.
export const CAR = {
  radius: 1.7,
  top: 24,
  dirt: 18,
  sand: 14,
  reverse: 9,
  accel: 13,
  taper: 0.5,
  brake: 28,
  coast: 3.5,
  bog: 8,
  handbrake: 6.5,
  wheelbase: 2.7,
  lock: 0.62,
  grip: { road: 19, dirt: 10.5, sand: 8.5 },
  bite: { road: 1, dirt: 1.25, sand: 1.3 },
  loose: 0.3,
  swing: 2.6,
  spin: 3.2,
  response: 10,
  responseLoose: 6,
  carry: 0.8,
  align: 2.2,
  power: 0.4,
  pivot: 0.9,
  // what a bump weighs, for the hit law (lib/impact.js): m/s into a wall
  // times this is the force it hears, so a knock at 4 m/s (where the dust and
  // the shake began) is just over its threshold and 20 m/s (a full shake) is
  // full
  mass: 6,
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const toSegment = (x, z, a, b) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz));
};
// the road you're on, if any (asphalt before dirt)
const roadAt = (x, z, roads = ROADS) => roads.find((r) => !r.dirt && toSegment(x, z, r.a, r.b) <= r.w / 2 + 0.01) ?? roads.find((r) => toSegment(x, z, r.a, r.b) <= r.w / 2 + 0.01) ?? null;
export const onRoad = (x, z, roads = ROADS) => roadAt(x, z, roads) !== null;
// what's under the wheels: 'road', 'dirt' or 'sand'
export const surfaceAt = (x, z) => {
  const road = roadAt(x, z);
  // (a block, a kerb up: sidewalk, car park or yard, all paved enough)
  return road ? (road.dirt ? 'dirt' : 'road') : onBlock(x, z) ? 'road' : 'sand';
};
const TOP = { road: CAR.top, dirt: CAR.dirt, sand: CAR.sand };

// How hard the tyres are sliding, 0 (gripping) to 1: for the smoke, the
// marks on the road and the squeal.
const SLIDING = 4.5; // m/s sideways that counts as flat out sideways
export const slipOf = (car) => clamp(Math.abs(car.slide ?? 0) / SLIDING, 0, 1);

// The car is { x, z, yaw, speed, slide, yawRate }: `speed` is along the way
// it points (negative backwards) and `slide` across it, toward the side a
// positive turn of the wheel swings the nose to (so a car whose tail has come
// out to the left is sliding one way, and to the right the other); `yawRate`
// is how fast it's turning. A car without the last two is one that grips
// and isn't turning (one parked before it could slide).
//
// One step of driving (`movers`: the traffic about, { x, z, r }, bumped off
// like a wall). input: { throttle −1…1, steer −1…1, handbrake,
// assist 0…2 (how much it straightens itself out of a slide; 1 as it comes) }.
// Returns the car, how hard it bumped into something (m/s into it, 0 if it
// didn't; `force`, that times CAR.mass, and `at`, where it touched, or
// null), how hard its tyres are sliding (0…1) and what it's on. However
// long the step, it's worked out in slices no longer than STEP, so the car
// drives the same at any frame rate.
const STEP = 1 / 120;
const LONGEST = 0.25;
const BOUNCE = 0.15;
export function stepCar(car, input = {}, dt, movers = NONE) {
  const c = { x: car.x, z: car.z, yaw: car.yaw, speed: car.speed ?? 0, slide: car.slide ?? 0, yawRate: car.yawRate ?? 0 };
  const out = { car: c, bump: 0, force: 0, at: null, slip: 0, surface: surfaceAt(c.x, c.z) };
  if (!(dt > 0)) return out;
  // (a frame that long is a stall, not driving; and nothing that isn't a
  // number gets as far as the car)
  const span = Math.min(dt, LONGEST);
  const num = (v, a, b, or = 0) => (Number.isFinite(v) ? clamp(v, a, b) : or);
  const ask = { throttle: num(input.throttle, -1, 1), steer: num(input.steer, -1, 1), handbrake: !!input.handbrake, assist: num(input.assist, 0, 2, 1) };
  const n = Math.max(1, Math.ceil(span / STEP - 1e-9));
  const h = span / n;
  for (let i = 0; i < n; i++) slice(c, ask, h, out, movers);
  out.force = out.bump * CAR.mass;
  return out;
}

// what's left of a velocity (vx, vz) that has run into something whose face
// looks along (nx, nz): out of it with a little bounce, and scrubbed along it
// the harder it hit. Returns how hard that was.
const hitV = { x: 0, z: 0 };
function strike(vx, vz, nx, nz) {
  const vn = vx * nx + vz * nz;
  hitV.x = vx;
  hitV.z = vz;
  if (vn >= 0) return 0;
  const tx = vx - vn * nx;
  const tz = vz - vn * nz;
  const keep = 1 - Math.min(0.2, 0.03 * -vn);
  hitV.x = tx * keep - BOUNCE * vn * nx;
  hitV.z = tz * keep - BOUNCE * vn * nz;
  return -vn;
}

function slice(c, { throttle, steer, handbrake, assist }, h, out, movers) {
  const surface = surfaceAt(c.x, c.z);
  const top = TOP[surface];
  let f = c.speed;
  let s = c.slide;
  let w = c.yawRate;

  // ── along: the engine, the brakes, the handbrake, and coasting down ──
  // (against the handbrake the engine gets a third of its pull to the road,
  // less than the handbrake holds: it's a brake, either way)
  const pull = handbrake ? 0.35 : 1;
  if (throttle > 0) f += (f < 0 ? CAR.brake : CAR.accel * (1 - CAR.taper * clamp(f / top, 0, 1)) * pull) * throttle * h;
  else if (throttle < 0) f += (f > 0 ? CAR.brake : f > -CAR.reverse ? CAR.accel * 0.6 * pull : 0) * throttle * h;
  else f -= Math.sign(f) * Math.min(Math.abs(f), CAR.coast * h);
  if (handbrake) f -= Math.sign(f) * Math.min(Math.abs(f), CAR.handbrake * h);
  // over the limit (onto the sand at speed; backwards out of a spin, faster
  // than reverse goes), it bleeds off rather than stops
  if (f > top) f = Math.max(top, f - CAR.bog * h);
  if (f < -CAR.reverse) f = Math.min(-CAR.reverse, f + CAR.bog * h);

  // ── round: the wheel, as far as it goes at this speed ──
  const v = Math.abs(f);
  const lock = Math.min(CAR.lock, Math.atan((CAR.wheelbase * CAR.grip[surface] * CAR.bite[surface]) / Math.max(v * v, 1e-6)));
  const turn = steer;
  let want = (f * Math.tan(lock * turn)) / CAR.wheelbase;
  let response = CAR.response;
  if (handbrake) {
    // the tail comes round the way the wheel is turned, and once it's
    // swinging its own weight carries it on (past sideways, where the front
    // wheels would steer it back): it's letting go that stops a spin
    const going = Math.hypot(f, s);
    want = Math.sign(f || 1) * turn * Math.min(CAR.spin, (CAR.swing * going * Math.tan(lock)) / CAR.wheelbase);
    response = CAR.responseLoose;
    if (want * w < 0) {
      want = 0;
      response = CAR.carry;
    } else if (Math.abs(want) < Math.abs(w)) response = CAR.carry;
  } else if (f > 1) {
    // gripping, it straightens itself out of a small slide, toward the way
    // it's going; a big one (the tail well out, off the handbrake) is left
    // alone, and the tyres pull the car round to where it points instead
    const off = Math.atan2(s, f);
    const big = clamp((Math.abs(off) - 0.3) / 0.6, 0, 1);
    want += CAR.align * clamp(assist, 0, 2) * off * (1 - big * big * (3 - 2 * big));
  }
  w += (want - w) * (1 - Math.exp(-h * response));
  // (it can't turn faster than it's moving: a spin stops with the car)
  const most = Math.hypot(f, s) / CAR.pivot;
  w = clamp(w, -most, most);
  const turned = w * h;
  const yaw = c.yaw + turned;
  // the car has turned under the way it was going
  const cs = Math.cos(turned);
  const sn = Math.sin(turned);
  const f1 = f * cs + s * sn;
  s = s * cs - f * sn;
  f = f1;

  // ── across: the tyres pull it back into line, as hard as they can hold ──
  // (a tyre that's sliding holds a little less than one that's gripping,
  // and less again with the power on: a slide is held on the throttle and
  // ended by lifting off)
  const sliding = clamp((Math.abs(s) - 0.5) / 2, 0, 1);
  const grip = CAR.grip[surface] * (handbrake ? CAR.loose : 1) * (1 - sliding * (0.15 + CAR.power * Math.max(0, throttle)));
  s = Math.abs(s) <= grip * h ? 0 : s - Math.sign(s) * grip * h;
  // (all told it goes no faster than the road allows, sideways included)
  const all = Math.hypot(f, s);
  if (all > top && f > 0) {
    const most = Math.max(top, all - CAR.bog * h) / all;
    f *= most;
    s *= most;
  }

  // ── where that takes it ──
  const hx = Math.sin(yaw);
  const hz = Math.cos(yaw);
  let vx = hx * f + hz * s;
  let vz = hz * f - hx * s;
  let x = c.x + vx * h;
  let z = c.z + vz * h;
  let hit = 0;
  let ax = 0; // where it hit hardest
  let az = 0;
  const touch = (v, px, pz) => {
    if (v <= hit) return;
    hit = v;
    ax = px;
    az = pz;
  };
  // the buildings: the car is a circle, pushed out of any footprint it's in
  for (const b of collidersNear(x, z)) {
    const px = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
    const pz = Math.max(b.z - b.d / 2, Math.min(z, b.z + b.d / 2));
    const dx = x - px;
    const dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d >= CAR.radius) continue;
    if (d > 1e-6) {
      x = px + (dx / d) * CAR.radius;
      z = pz + (dz / d) * CAR.radius;
      touch(strike(vx, vz, dx / d, dz / d), px, pz);
      vx = hitV.x;
      vz = hitV.z;
    } else {
      // inside it: out the way it came
      x = c.x;
      z = c.z;
      touch(Math.hypot(vx, vz), x, z);
      vx *= -0.2;
      vz *= -0.2;
    }
  }
  // the traffic: circles, bumped off the same way
  for (const m of movers) {
    const dx = x - m.x;
    const dz = z - m.z;
    const d = Math.hypot(dx, dz);
    const reach = CAR.radius + (m.r ?? 1.5);
    if (d >= reach || d < 1e-6) continue;
    x = m.x + (dx / d) * reach;
    z = m.z + (dz / d) * reach;
    touch(strike(vx, vz, dx / d, dz / d), m.x + (dx / d) * (m.r ?? 1.5), m.z + (dz / d) * (m.r ?? 1.5));
    vx = hitV.x;
    vz = hitV.z;
  }
  // the edge of the world
  const r = Math.hypot(x, z);
  if (r > WORLD_RADIUS) {
    x *= WORLD_RADIUS / r;
    z *= WORLD_RADIUS / r;
    touch(strike(vx, vz, -x / WORLD_RADIUS, -z / WORLD_RADIUS), x, z);
    vx = hitV.x;
    vz = hitV.z;
  }
  if (hit > 0) {
    f = vx * hx + vz * hz;
    s = vx * hz - vz * hx;
    w *= 0.6;
    if (hit > out.bump) out.at = { x: ax, z: az };
    out.bump = Math.max(out.bump, hit);
  }
  c.x = x;
  c.z = z;
  c.yaw = yaw;
  c.speed = f;
  c.slide = s;
  c.yawRate = w;
  out.slip = Math.max(slipOf(c), handbrake && Math.hypot(f, s) > 3 ? 0.55 : 0);
  out.surface = surface;
}

// ── things to knock over ──

// Along Central, in the gutter by the kerb (clear of the lanes the traffic
// drives, so only you hit them): a row of cones at each block's middle on
// the north side, a bin and a pair of crates on the south. Data only: the
// scene puts them through lib/three/knockables, bodies where the computer
// can afford the engine and standing still where it can't.
const GUTTER = 7.2;
export const STREET_PROPS = GRID.xs.slice(0, -1).flatMap((x0, i) => {
  const x = (x0 + GRID.xs[i + 1]) / 2;
  return [
    { kind: 'cone', x: x - 5, y: 0, z: GUTTER, yaw: 0 },
    { kind: 'cone', x, y: 0, z: GUTTER, yaw: 0.6 },
    { kind: 'cone', x: x + 5, y: 0, z: GUTTER, yaw: 1.2 },
    { kind: 'bin', x: x + 14, y: 0, z: -GUTTER, yaw: 0 },
    { kind: 'crate', x: x - 14, y: 0, z: -GUTTER, yaw: 0.2 },
    { kind: 'crate', x: x - 12.9, y: 0, z: -GUTTER - 0.2, yaw: -0.3 },
  ];
});

// ── a way out ──

// The last safe spot (Dot Matrix keeps one; the reset key puts you back on
// it, so a car wedged between a wall and a parked truck is never stuck):
// where the car was the last time it had driven SAFE.every seconds without
// touching anything. Standing still doesn't count: a car wedged and not
// pushing is as still as one parked.
export const SAFE = { every: 0.5, moving: 1 };
export function createSafeSpot(start) {
  const pick = (c) => ({ x: c.x, z: c.z, yaw: c.yaw });
  let spot = pick(start);
  let clean = 0;
  return {
    step(car, bump, dt) {
      if (!(dt > 0)) return;
      if (bump > 0 || !(Math.abs(car.speed ?? 0) >= SAFE.moving)) {
        clean = 0;
        return;
      }
      clean += dt;
      if (clean < SAFE.every - 1e-9) return;
      clean = 0;
      if ([car.x, car.z, car.yaw].every(Number.isFinite)) spot = pick(car);
    },
    get spot() {
      return { ...spot };
    },
    // the car there, stopped
    back: () => ({ ...spot, speed: 0, slide: 0, yawRate: 0 }),
  };
}

// ── the wheel in your hands ──

// The driving settings, kept between visits (the universe map's flying
// settings, for the road): how quickly the wheel goes over, how much the
// car straightens itself out of a slide (none, and a slide is yours to
// catch), and how tightly the camera swings round behind.
export const DRIVING_KEY = 'tp-abq-driving';
export const DRIVING = {
  steer: { min: 0.5, max: 2, step: 0.05, label: 'Steering', hint: 'How quickly the wheel goes over' },
  assist: { min: 0, max: 2, step: 0.1, label: 'Stability', hint: 'How much the car straightens itself out of a slide' },
  camera: { min: 0.5, max: 2, step: 0.05, label: 'Camera follow', hint: 'How tightly it swings round behind' },
};
export const DRIVING_DEFAULTS = { steer: 1, assist: 1, camera: 1 };
// whatever was kept (or nothing), as settings that can be used
export function readDriving(raw) {
  const d = { ...DRIVING_DEFAULTS };
  if (!raw || typeof raw !== 'object') return d;
  for (const [k, r] of Object.entries(DRIVING)) if (typeof raw[k] === 'number' && Number.isFinite(raw[k])) d[k] = clamp(raw[k], r.min, r.max);
  return d;
}

// The wheel, turned toward where the keys or the stick ask (−1…1), one step
// on. Keys are all or nothing, so the wheel goes over at a rate: quickly at
// parking speed, slower the faster the car is going (a twitch at speed is a
// swerve), back to the middle quicker than it left, and across from one
// lock to the other quickest of all. A stick (`analog`)
// says how far itself, with fine control near its middle, and the wheel
// follows it almost at once. `steer` is the setting above.
export function stepSteer(wheel, target, speed, dt, { steer = 1, analog = false } = {}) {
  let to = Number.isFinite(target) ? clamp(target, -1, 1) : 0;
  if (analog) to = Math.sign(to) * Math.abs(to) ** 1.7;
  const k = clamp(Math.abs(speed) / CAR.top, 0, 1);
  const away = Math.abs(to) > Math.abs(wheel) && to * wheel >= 0;
  const over = to * wheel < 0;
  const rate = (analog || over ? 14 : away ? 8 - 4.6 * k : 10) * steer;
  const d = to - wheel;
  const step = rate * dt;
  return Math.abs(d) <= step ? to : wheel + Math.sign(d) * step;
}

// The place you've pulled up at, if any.
export function nearPlace(x, z) {
  let best = null;
  for (const p of PLACES) {
    const d = Math.hypot(x - p.door.x, z - p.door.z);
    if (d < p.radius && (!best || d < best.d)) best = { ...p, d };
  }
  return best;
}

// What's open, and what to do next. snap: { served, points, upgrades, visited }.
export function progress(snap) {
  const s = { served: 0, points: 0, upgrades: [], visited: [], ...snap };
  const places = PLACES.map((p) => ({ ...p, open: OPENS[p.id](s), visited: s.visited.includes(p.id), hint: HINT[p.id] ?? '' }));
  const at = Object.fromEntries(places.map((p) => [p.id, p]));
  for (const id of ORDER) {
    if (!at[id].open) return { places, next: id, objective: HINT[id], done: false };
    if (!at[id].visited) return { places, next: id, objective: GO[id], done: false };
  }
  return { places, next: null, objective: 'Albuquerque’s yours. Say my name.', done: true };
}

// ── the streets as the traffic sees them ──

// Every corner where two streets meet (a node), every stretch of street
// between two of them (an edge), which have lights and which stop signs.
export const NODES = [];
export const EDGES = [];
{
  const road = (axis, line, mid) => ROADS.find((r) => !r.dirt && (axis === 'z' ? r.a.z === line && r.b.z === line && Math.min(r.a.x, r.b.x) <= mid && Math.max(r.a.x, r.b.x) >= mid : r.a.x === line && r.b.x === line && Math.min(r.a.z, r.b.z) <= mid && Math.max(r.a.z, r.b.z) >= mid));
  const id = (i, j) => j * GRID.xs.length + i;
  GRID.zs.forEach((z, j) =>
    GRID.xs.forEach((x, i) => {
      const e = road('z', z, x); // the street running east–west through it
      const n = road('x', x, z); // and north–south
      const signal = ARTERIAL(e) && ARTERIAL(n) ? true : e.id === 'central';
      // without lights, whoever's on the narrower street stops (both, if they're alike)
      const stop = signal ? null : ARTERIAL(e) === ARTERIAL(n) ? 'both' : ARTERIAL(e) ? 'ns' : 'ew';
      NODES.push({ id: id(i, j), i, j, x, z, hw: n.w / 2, hd: e.w / 2, signal, stop, ew: e.id, ns: n.id });
    }),
  );
  GRID.zs.forEach((z, j) => {
    for (let i = 0; i + 1 < GRID.xs.length; i++) {
      const r = road('z', z, (GRID.xs[i] + GRID.xs[i + 1]) / 2);
      EDGES.push({ a: id(i, j), b: id(i + 1, j), axis: 'x', w: r.w, road: r.id, fast: ARTERIAL(r) });
    }
  });
  GRID.xs.forEach((x, i) => {
    for (let j = 0; j + 1 < GRID.zs.length; j++) {
      const r = road('x', x, (GRID.zs[j] + GRID.zs[j + 1]) / 2);
      EDGES.push({ a: id(i, j), b: id(i, j + 1), axis: 'z', w: r.w, road: r.id, fast: ARTERIAL(r) });
    }
  });
}
const OUT = NODES.map(() => []);
EDGES.forEach((e, k) => {
  OUT[e.a].push({ e: k, dir: 1, to: e.b });
  OUT[e.b].push({ e: k, dir: -1, to: e.a });
});

// The lights: all of them on one cycle. East–west goes first, then north–south.
export const SIGNAL = { cycle: 32, green: 13, amber: 3 };
export function signalAt(t) {
  const s = ((t % SIGNAL.cycle) + SIGNAL.cycle) % SIGNAL.cycle;
  const half = SIGNAL.cycle / 2;
  const own = (k) => (k < SIGNAL.green ? 'green' : 'amber');
  return s < half ? { ew: own(s), ns: 'red' } : { ew: 'red', ns: own(s - half) };
}

// Where a lane runs along an edge, travelled one way: from where it leaves
// the corner behind (past the crossing) to the stop line at the one ahead,
// kept to the right of the centre line by `off`.
const LANE = { stop: 4.2 }; // the stop line, this far back from the cross street's kerb
function lanePath(k, dir, off) {
  const e = EDGES[k];
  const [A, B] = dir > 0 ? [NODES[e.a], NODES[e.b]] : [NODES[e.b], NODES[e.a]];
  const len = Math.hypot(B.x - A.x, B.z - A.z);
  const fx = (B.x - A.x) / len;
  const fz = (B.z - A.z) / len;
  // (the cross street's half-width at each end)
  const clear = (N) => (e.axis === 'x' ? N.hw : N.hd) + LANE.stop;
  const rx = -fz * off;
  const rz = fx * off;
  return { ax: A.x + fx * clear(A) + rx, az: A.z + fz * clear(A) + rz, bx: B.x - fx * clear(B) + rx, bz: B.z - fz * clear(B) + rz, fx, fz, len: len - clear(A) - clear(B), node: dir > 0 ? e.b : e.a };
}
// a lane's offset on its edge: one lane each way, two on Central
const laneOff = (e, lane) => (e.w >= 16 ? (lane ? 5.8 : 2.2) : e.w / 4);

// A quadratic curve from one lane's stop line, through the corner, into the next.
function turnPath(from, to) {
  const p0 = { x: from.bx, z: from.bz };
  const p2 = { x: to.ax, z: to.az };
  const straight = Math.abs(from.fx * to.fx + from.fz * to.fz) > 0.9;
  const p1 = straight ? { x: (p0.x + p2.x) / 2, z: (p0.z + p2.z) / 2 } : Math.abs(from.fx) > 0.5 ? { x: p2.x, z: p0.z } : { x: p0.x, z: p2.z };
  let len = 0;
  let px = p0.x;
  let pz = p0.z;
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    const z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z;
    len += Math.hypot(x - px, z - pz);
    px = x;
    pz = z;
  }
  return { p0, p1, p2, len: Math.max(0.5, len), straight };
}

// ── the traffic ──

export const TRAFFIC = { fast: 13.5, slow: 9.5, corner: 6, accel: 3.6, brake: 9, gap: 6.6, wait: 1.1 };

// A car's place on the map, from where it is on its lane or its turn.
function place(c) {
  if (c.seg === 'lane') {
    const L = c.path;
    // (sliding across from the lane it was in, after a lane change)
    const k = c.shift ?? 0;
    c.x = L.ax + L.fx * c.s - L.fz * k;
    c.z = L.az + L.fz * c.s + L.fx * k;
    c.yaw = Math.atan2(L.fx, L.fz) - k * 0.06;
  } else {
    const { p0, p1, p2, len } = c.turn;
    const t = Math.min(1, c.s / len);
    c.x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
    c.z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z;
    const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
    const dz = 2 * (1 - t) * (p1.z - p0.z) + 2 * t * (p2.z - p1.z);
    if (dx * dx + dz * dz > 1e-8) c.yaw = Math.atan2(dx, dz);
  }
  return c;
}

// The way out of a corner a car takes next: straight on most often, never
// back the way it came. A car with a `route` (Hank) keeps to it.
function chooseNext(c, rand) {
  const node = c.path.node;
  const ways = OUT[node].filter((o) => !(o.e === c.e && o.dir === -c.dir));
  if (c.route) {
    const at = c.route.indexOf(node);
    const want = c.route[(at + 1) % c.route.length];
    return ways.find((o) => o.to === want) ?? ways[0];
  }
  const e = EDGES[c.e];
  const weigh = (o) => (EDGES[o.e].axis === e.axis ? 2.2 : 1) * (EDGES[o.e].fast ? 1.4 : 1);
  const total = ways.reduce((n, o) => n + weigh(o), 0);
  let k = rand() * total;
  for (const o of ways) if ((k -= weigh(o)) <= 0) return o;
  return ways[ways.length - 1];
}

function enterLane(c, k, dir) {
  c.e = k;
  c.dir = dir;
  c.seg = 'lane';
  c.s = 0;
  c.path = lanePath(k, dir, laneOff(EDGES[k], c.lane));
  c.next = null;
  c.go = false;
  c.wait = 0;
  c.shift = 0;
  c.passing = null;
  c.move = null;
}

/**
 * createTraffic(n, { seed, route }) → the cars, spread over the streets.
 * Each is { id, type, x, z, yaw, speed, … }; `route` (a list of node ids,
 * round in a loop) makes one car that keeps to it (n is then 1).
 */
export function createTraffic(n, { seed = 66, route = null, at = 0, avoid = [], from = 0 } = {}) {
  let s = seed | 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const cars = [];
  for (let tries = 0; cars.length < n && tries < n * 40; tries++) {
    let k;
    let dir;
    if (route) {
      const a = route[at % route.length];
      const b = route[(at + 1) % route.length];
      const o = OUT[a].find((x) => x.to === b);
      k = o.e;
      dir = o.dir;
    } else {
      k = Math.floor(rand() * EDGES.length);
      dir = rand() < 0.5 ? 1 : -1;
    }
    const c = { id: from + cars.length, type: route ? -1 : Math.floor(rand() * CAR_TYPES.length), lane: rand() < 0.5 ? 0 : 1, speed: 0, rand, route };
    enterLane(c, k, dir);
    c.s = route ? 0 : rand() * c.path.len;
    place(c);
    if (cars.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 12) || avoid.some((o) => Math.hypot(o.x - c.x, o.z - c.z) < 14)) continue;
    c.speed = (EDGES[k].fast ? TRAFFIC.fast : TRAFFIC.slow) * 0.6;
    c.tint = rand();
    cars.push(c);
  }
  return cars;
}

let entered = 0; // (cars into a corner so far: who was first)

// Which way a car comes into a corner and what it does there: L, R or S(traight).
function moveOf(path, next) {
  const g = lanePath(next.e, next.dir, 0);
  const cross = path.fx * g.fz - path.fz * g.fx;
  return { fx: path.fx, fz: path.fz, turn: cross > 0.5 ? 'R' : cross < -0.5 ? 'L' : 'S' };
}
// Whether two ways through a corner cross: from the same side never; from
// opposite sides only if one of them turns left; from either side, always.
function crosses(a, b) {
  const dot = a.fx * b.fx + a.fz * b.fz;
  if (dot > 0.5) return false;
  if (dot < -0.5) return a.turn === 'L' || b.turn === 'L';
  return true;
}
// The corner's clear for this car to go into: nothing in it on a way that
// crosses, and (turning left) nothing coming the other way about to come through.
function boxFree(c, cars) {
  const node = c.path.node;
  for (const o of cars) {
    if (o === c) continue;
    if (o.seg === 'turn' && o.turnNode === node && o.s < o.turn.len * 0.92 && crosses(c.move, o.move)) return false;
    if (c.move.turn === 'L' && o.seg === 'lane' && o.path.node === node && o.move && o.move.fx * c.move.fx + o.move.fz * c.move.fz < -0.5 && !o.stopsAt && o.speed > 2 && o.path.len - o.s < 26) return false;
  }
  return true;
}

// How fast a car may go with whatever's in front of it (other cars, you,
// Hank): it keeps a gap, closing it only as fast as it can stop.
function clearAhead(c, others, own) {
  const hx = Math.sin(c.yaw);
  const hz = Math.cos(c.yaw);
  let best = Infinity;
  let what = null;
  const reach = 9 + c.speed * 1.6;
  for (const o of others) {
    if (o === own) continue;
    const dx = o.x - c.x;
    const dz = o.z - c.z;
    const along = dx * hx + dz * hz;
    if (along <= 0.5 || along > reach) continue;
    const side = Math.abs(dx * -hz + dz * hx);
    if (side > 2.1) continue;
    // something going the other way, already past the middle of the road, isn't in the way
    if (o.yaw !== undefined && Math.cos(o.yaw - c.yaw) < -0.5 && side > 1.2) continue;
    // in the corner, the car that got there first goes first: one crossing
    // this one's path waits only if it came in later (or hasn't come in yet)
    if (c.seg === 'turn' && o.seg !== undefined && Math.cos(o.yaw - c.yaw) < 0.5 && (o.seg !== 'turn' || o.order > c.order)) continue;
    if (along < best) {
      best = along;
      what = o;
    }
  }
  return { gap: best, what };
}

// Nothing's in the corner or about to come through it on the cross street
// (for a car that's stopped at a sign and wants to go).
function cornerClear(c, cars) {
  const N = NODES[c.path.node];
  for (const o of cars) {
    if (o === c) continue;
    if (Math.abs(o.x - N.x) < N.hw + 3 && Math.abs(o.z - N.z) < N.hd + 3 && o.speed > 0.5) return false;
    if (o.seg !== 'lane' || o.path.node !== N.id) continue;
    // coming through without stopping
    if (!o.stopsAt && o.speed > 2 && o.path.len - o.s < 22) return false;
    // or there first, waiting at its own sign
    if (o.stopsAt && o.path.len - o.s < 1.2 && (o.wait > c.wait || (o.wait === c.wait && o.id < c.id))) return false;
  }
  return true;
}

/**
 * stepTraffic(cars, dt, t, obstacles) moves every car on by dt seconds at
 * time t (the lights' clock). obstacles: [{ x, z, yaw? }] the cars must not
 * drive into (you, and Hank when he isn't one of `cars`).
 */
export function stepTraffic(cars, dt, t, obstacles = NONE) {
  const light = signalAt(t);
  const all = obstacles.length ? cars.concat(obstacles) : cars;
  for (const c of cars) {
    const e = EDGES[c.e];
    let want = c.seg === 'turn' ? (c.turn.straight ? TRAFFIC.slow : TRAFFIC.corner) : e.fast ? TRAFFIC.fast : TRAFFIC.slow;
    if (c.route) want *= 0.85;
    // the corner ahead: a light, a sign, and the turn to slow for
    c.stopsAt = false;
    if (c.seg === 'lane') {
      if (!c.next) {
        c.next = chooseNext(c, c.rand);
        c.move = moveOf(c.path, c.next);
      }
      const N = NODES[c.path.node];
      const left = c.path.len - c.s;
      let stop = false;
      if (N.signal) {
        const mine = e.axis === 'x' ? light.ew : light.ns;
        // amber: stop if there's room to, go on if there isn't
        stop = mine === 'red' || (mine === 'amber' && left > c.speed * 1.1 + 2);
      } else if (N.stop === 'both' || N.stop === (e.axis === 'x' ? 'ew' : 'ns')) stop = !c.go;
      if (stop) {
        c.stopsAt = true;
        want = Math.min(want, Math.max(0, (left - 0.4) * 1.1));
        if (left < 1.2 && c.speed < 0.4) {
          c.wait += dt;
          // a stop sign: a moment, then on when the corner's clear
          if (!N.signal && c.wait > TRAFFIC.wait && cornerClear(c, cars)) c.go = true;
        }
      }
      // and nobody in the corner whose way crosses this one's
      if (!stop && left < 10 + c.speed && !boxFree(c, cars)) {
        stop = true;
        c.stopsAt = true;
        want = Math.min(want, Math.max(0, (left - 0.4) * 1.1));
      }
      // slow for a turn coming up
      const turning = EDGES[c.next.e].axis !== e.axis;
      if (turning) want = Math.min(want, TRAFFIC.corner + Math.max(0, left - 6) * 0.45);
    }
    // whatever's in front
    const { gap, what } = clearAhead(c, all, c);
    if (gap < Infinity) {
      const room = Math.max(0, gap - TRAFFIC.gap);
      want = Math.min(want, room * 1.15);
      // stuck behind something that isn't moving: on Central, into the other
      // lane; on a street with one lane each way, round it (you, stopped in
      // the road), on the wrong side for a moment
      if (what && (what.speed ?? 0) < 0.3 && c.speed < 0.3 && c.seg === 'lane') {
        c.blocked = (c.blocked ?? 0) + dt;
        if (c.blocked > 2 && e.w >= 16) {
          const was = laneOff(e, c.lane);
          c.lane = 1 - c.lane;
          const s = c.s;
          c.path = lanePath(c.e, c.dir, laneOff(e, c.lane));
          c.s = Math.min(s, c.path.len);
          c.shift = was - laneOff(e, c.lane);
          c.blocked = 0;
        } else if (c.blocked > 2.5 && what.seg === undefined && !c.passing) {
          c.passing = what;
          c.blocked = 0;
        } else if (c.blocked > 2 && c.passing && what.seg !== undefined) {
          // someone coming the other way: back in, and try again after
          c.passing = null;
          c.blocked = 0;
        }
      } else c.blocked = 0;
    }
    if (c.passing) {
      // round it, until it's behind
      const o = c.passing;
      if ((o.x - c.x) * Math.sin(c.yaw) + (o.z - c.z) * Math.cos(c.yaw) < -5 || c.seg !== 'lane') c.passing = null;
      else if (Math.abs((c.shift ?? 0) + 2 * laneOff(e, c.lane)) > 0.6) want = Math.min(want, 2.2);
    }
    c.speed = want > c.speed ? Math.min(want, c.speed + TRAFFIC.accel * dt) : Math.max(want, c.speed - TRAFFIC.brake * dt);
    c.speed = Math.max(0, c.speed);
    c.s += c.speed * dt;
    {
      const target = c.passing ? -2 * laneOff(e, c.lane) : 0;
      const step = (c.passing ? 2.4 : 1 + c.speed * 0.25) * dt;
      const k = c.shift ?? 0;
      if (k !== target) c.shift = k < target ? Math.min(target, k + step) : Math.max(target, k - step);
    }
    // on into the corner, and out of it onto the next street
    if (c.seg === 'lane' && c.s >= c.path.len) {
      const over = c.s - c.path.len;
      const nx = c.next ?? chooseNext(c, c.rand);
      const ne = EDGES[nx.e];
      // onto Central: the outside lane turning right, the inside one turning left
      if (ne.w >= 16) {
        const g = lanePath(nx.e, nx.dir, 0);
        const cross = c.path.fx * g.fz - c.path.fz * g.fx;
        if (Math.abs(cross) > 0.5) c.lane = cross > 0 ? 1 : 0;
      }
      const to = lanePath(nx.e, nx.dir, laneOff(ne, c.lane));
      c.turn = turnPath(c.path, to);
      c.seg = 'turn';
      c.order = ++entered;
      c.turnNode = c.path.node;
      c.move = c.move ?? moveOf(c.path, nx);
      c.s = over;
      c.nextPath = { k: nx.e, dir: nx.dir };
    }
    if (c.seg === 'turn' && c.s >= c.turn.len) {
      const over = c.s - c.turn.len;
      enterLane(c, c.nextPath.k, c.nextPath.dir);
      c.s = over;
    }
    place(c);
  }
  return cars;
}

// ── Hank ──

// Hank, in his SUV: round the blocks between Central, 4th, Negra Arroyo
// and Juan Tabo, in the traffic, stopping where it stops.
const nodeAt = (x, z) => NODES.find((n) => n.x === x && n.z === z).id;
export const HANK_ROUTE = [nodeAt(0, 0), nodeAt(-60, 0), nodeAt(-120, 0), nodeAt(-120, -60), nodeAt(-60, -60), nodeAt(0, -60)];
const createHank = () => createTraffic(1, { route: HANK_ROUTE })[0];
// Hank first, then everyone else, none of them on top of each other or of `avoid` (you)
export function createStreets(n, { avoid = [] } = {}) {
  const hank = createHank();
  return [hank, ...createTraffic(n, { avoid: [hank, ...avoid], from: 1 })];
}

// (Hank as he was before the traffic, by the clock alone: kept for anything
// that only wants to know roughly where he is.)
const LOOP = [
  { x: 0, z: 0 },
  { x: -120, z: 0 },
  { x: -120, z: -60 },
  { x: 0, z: -60 },
];
const HANK_SPEED = 11;
const LEGS = LOOP.map((p, i) => ({ a: p, b: LOOP[(i + 1) % LOOP.length], len: Math.hypot(LOOP[(i + 1) % LOOP.length].x - p.x, LOOP[(i + 1) % LOOP.length].z - p.z) }));
const LAP = LEGS.reduce((n, l) => n + l.len, 0);
export function hankAt(t) {
  let s = (((t * HANK_SPEED) % LAP) + LAP) % LAP;
  for (const l of LEGS) {
    if (s <= l.len) {
      const k = s / l.len;
      return { x: l.a.x + (l.b.x - l.a.x) * k, z: l.a.z + (l.b.z - l.a.z) * k, yaw: Math.atan2(l.b.x - l.a.x, l.b.z - l.a.z) };
    }
    s -= l.len;
  }
  return { ...LOOP[0], yaw: 0 };
}

// Heat: it builds while Hank's close (faster the closer), and cools once
// you're well clear. At the top, he pulls you over. He only takes an
// interest in a car with a load on board or one going past him fast: his
// rounds pass Walt's door and Saul's, and he'd pull you over parked there.
export const HEAT = { near: 14, far: 26, rate: 0.3, cool: 0.35, linger: 0.12, notice: 12 };
export function stepHeat(heat, dist, dt, { speed = Infinity, load = true } = {}) {
  let h = heat;
  const wanted = load || speed > HEAT.notice;
  if (dist < HEAT.near && wanted) h += dt * HEAT.rate * (1.5 - dist / HEAT.near);
  else if (dist > HEAT.far) h -= dt * HEAT.cool;
  else h -= dt * HEAT.linger;
  h = Math.max(0, Math.min(1, h));
  return { heat: h, caught: h >= 1 };
}

// the crystal the car is on, if it hasn't been taken
export function crystalAt(x, z, got = []) {
  for (const c of CRYSTALS) if (!got.includes(c.id) && Math.hypot(x - c.x, z - c.z) < CRYSTAL_REACH) return c;
  return null;
}

// The times of day the HUD's clock steps through. 0 is midnight, 0.25
// sunrise, 0.5 noon, 0.75 sunset; the day also turns slowly on its own.
export const TIMES = [
  { id: 'golden', name: 'Golden hour', tod: 0.71 },
  { id: 'night', name: 'Night', tod: 0.93 },
  { id: 'dawn', name: 'Dawn', tod: 0.262 },
  { id: 'noon', name: 'High noon', tod: 0.5 },
];
// the named time the clock is in (each one runs until the next begins)
export function timeName(tod) {
  const t = ((tod % 1) + 1) % 1;
  if (t < 0.2 || t >= 0.82) return TIMES[1];
  if (t < 0.36) return TIMES[2];
  if (t < 0.62) return TIMES[3];
  return TIMES[0];
}

// ── things to do ──

// Deliveries: get to the drop in time and the buyer pays, more for a long
// run and for time left over; the money is the career's (Saul's office spends it).
// (the clock allows a pace the car keeps on the sand every drop is out in,
// with time to find the way)
export const RUN = { reach: 6, pace: 11, slack: 14, far: 110 };
// A run from where the car is: the `pick`th of the drops far enough away.
export function startRun(car, pick = 0) {
  const far = DROPS.filter((d) => Math.hypot(d.x - car.x, d.z - car.z) >= RUN.far);
  const d = far[((Math.floor(pick) % far.length) + far.length) % far.length];
  const dist = Math.hypot(d.x - car.x, d.z - car.z);
  return { ...d, dist, time: dist / RUN.pace + RUN.slack };
}
// One step of a run: 'on' (with what's left), 'made' (with the pay) or 'late'.
export function stepRun(run, car, left, dt) {
  const d = Math.hypot(run.x - car.x, run.z - car.z);
  if (d < RUN.reach) return { state: 'made', left, pay: runPay(run, left) };
  const t = left - dt;
  return t <= 0 ? { state: 'late', left: 0 } : { state: 'on', left: t, away: d };
}
export const runPay = (run, left) => Math.round(15 + run.dist / 8 + Math.max(0, left) * 2);
