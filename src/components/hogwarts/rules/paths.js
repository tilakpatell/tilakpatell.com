// Where the castle’s people go and the ways between (the design’s §4.8):
// every spot a figure can be, on the grounds, in the castle and in
// Hogsmeade, in the grounds’ frame (metres, +x east, +z south, the frame of
// rules/places.js), and the passages and paths that join them. The
// Marauder’s Map draws its corridors from these edges, so the ink and the
// footprints never disagree; rules/people.js walks the figures along them.
// Pure.
//
// The castle’s inside is drawn as the Map draws it: every room at the place
// in the castle’s plan (world/castle/plan.js) it stands over, the dungeons
// under the Great Hall’s south side marked `below` (the Map draws them in a
// broken line). A spot is in one of three kinds of place:
//   inside: null      out on the grounds or in the village: a walker there is drawn when you’re near
//   inside: 'castle'  in the castle where no room is built: simulated only, on the Map
//   inside: '<room>'  in a room that is built (rooms/index.js): drawn when you’re in it
//
// The carriages that pull themselves (the road from the viaduct’s gate to
// the station and the village) are the edges marked `ride`: a walker on one
// is carried at the carriages’ pace, and the Map draws its wheel ruts.
//
//   SPOTS: [{ id, name, at: [x, z], r, inside, below?, house? }]
//   EDGES: [[a, b, { ride }?], …] (both ways)
//   ROOM_FRAMES: { [room]: { at: [x, z], yaw } }: a built room’s own frame on the
//     Map’s (a room is built at its own origin; at + its frame turned by yaw is here)
//   spotById(id) → the spot, or null
//   route(from, to) → [spot ids] from one to the other along the edges (the shortest), or null
//   rideBetween(a, b) → whether the way from one spot to the next is the carriages’
//   pathOf(ids, from?, fromId?) → { points: [[x, z]…], lengths (cumulative), length, rides: [bool a stretch] }
//   toRoom(room, [x, z]) → [x, z] in the room’s own frame; fromRoom(room, [x, z]) → the Map’s;
//   frameYaw(room) → how far the room’s frame is turned on the Map’s (a heading in it plus this is the Map’s)
//   indoorAt(a, b, k) → what a walk k of the way from spot a to spot b is in

import { VILLAGE, buildingAt, frameAt, SHACK } from './hogsmeade';

const spot = (id, name, at, r, inside = null, more = {}) => ({ id, name, at, r, inside, ...more });

// the doors into the village’s insides
const door = (id) => buildingAt(id).door;

export const SPOTS = [
  // the castle: the ground floor
  spot('entrance', 'The Entrance Hall', [37, 8], 10, 'castle'),
  spot('hall', 'The Great Hall', [-12, 11], 14, 'greatHall'),
  spot('high-table', 'The high table', [-36, 11], 5, 'greatHall'),
  spot('table-gryffindor', 'The Gryffindor table', [-10, 17.6], 4, 'greatHall', { house: 'gryffindor' }),
  spot('table-hufflepuff', 'The Hufflepuff table', [-10, 13.2], 4, 'greatHall', { house: 'hufflepuff' }),
  spot('table-ravenclaw', 'The Ravenclaw table', [-10, 8.8], 4, 'greatHall', { house: 'ravenclaw' }),
  spot('table-slytherin', 'The Slytherin table', [-10, 4.4], 4, 'greatHall', { house: 'slytherin' }),
  spot('filch-office', 'Filch’s office', [27, -6], 3, 'castle'),
  spot('staircase', 'The Grand Staircase', [2, -24], 8, 'staircase'),
  spot('witch', 'The One-Eyed Witch', [9, -31], 2, 'staircase'),
  spot('fat-lady', 'The Fat Lady', [-15, -23], 2, 'staircase'),
  spot('staffroom', 'The staff room', [-17, -42], 4, 'castle'),
  // the west wing: Charms, the towers, the way to the covered bridge
  spot('corridor-west', 'The west corridor', [-52, -14], 4, 'castle'),
  spot('charms', 'The Charms classroom', [-74, -12], 7, 'charms'),
  spot('gryffindor', 'Gryffindor Tower', [-34, -22], 5, 'gryffindor', { house: 'gryffindor' }),
  spot('ravenclaw', 'Ravenclaw Tower', [-94, -32], 5, 'ravenclaw', { house: 'ravenclaw' }),
  spot('bridge-in', 'The bridge corridor', [-104, -50], 3, 'castle'),
  // the north: the library, the hospital wing, Defence, the seventh floor, the Astronomy Tower
  spot('corridor-north', 'The north corridor', [-14, -64], 4, 'castle'),
  spot('library', 'The library', [-40, -60], 9, 'library'),
  spot('restricted', 'The Restricted Section', [-58, -62], 3, 'library'),
  spot('hospital', 'The hospital wing', [6, -66], 5, 'castle'),
  spot('defence', 'The Defence classroom', [-38, -96], 6, 'defence'),
  spot('requirement', 'The seventh-floor corridor', [-4, -100], 5, 'requirement'),
  spot('astronomy', 'The Astronomy Tower', [-82, -86], 5, 'astronomy'),
  spot('headmaster', 'The Headmaster’s office', [26, -80], 4, 'castle'),
  // below stairs: the kitchens, Hufflepuff, the dungeons, Slytherin
  spot('below', 'The stairs down', [6, 24], 2, 'castle', { below: true }),
  spot('kitchens', 'The kitchens', [20, 27], 5, 'kitchens', { below: true }),
  spot('hufflepuff', 'The Hufflepuff basement', [34, 28], 5, 'hufflepuff', { below: true, house: 'hufflepuff' }),
  spot('dungeons', 'The dungeons', [-12, 26], 3, 'castle', { below: true }),
  spot('potions', 'The Potions dungeon', [-28, 27], 6, 'potions', { below: true }),
  spot('slytherin', 'The Slytherin dungeon', [-48, 26], 5, 'slytherin', { below: true, house: 'slytherin' }),
  // the castle’s ways out
  spot('great-doors', 'The great doors', [53, 8], 4),
  spot('courtyard-door', 'The courtyard door', [16, -24], 2),
  spot('courtyard', 'The courtyard', [44, -52], 12),
  spot('viaduct-gate', 'The viaduct gate', [61, -113], 4),
  spot('viaduct', 'The viaduct', [140, -174], 8),
  spot('viaduct-end', 'The viaduct’s far end', [214, -228], 5),
  spot('bridge-gate', 'The bridge’s gate', [-114, -59], 3),
  spot('covered-bridge', 'The covered bridge', [-160, -70], 6),
  spot('terrace', 'The terrace', [-14, 37], 5),
  spot('boathouse', 'The boathouse', [-25, 46], 5, 'boathouse'),
  // the grounds
  spot('lawn', 'The lawn', [165, -30], 40),
  spot('greenhouse-door', 'Greenhouse three', [150, 27], 3),
  spot('greenhouses', 'The greenhouses', [150, 41], 8),
  spot('pitch', 'The Quidditch pitch', [300, -50], 40),
  spot('changing-rooms', 'The changing rooms', [300, 40], 6),
  spot('stone-circle', 'The stone circle', [-225, -82], 12),
  spot('willow', 'The Whomping Willow', [-135, -170], 6),
  spot('hut', 'Hagrid’s hut', [-250, -230], 5, 'hut'),
  spot('pumpkins', 'The pumpkin patch', [-230, -250], 8),
  spot('paddock', 'The paddock', [-284, -248], 12),
  spot('forest-edge', 'The forest’s edge', [-330, -270], 14),
  spot('clearing', 'The clearing', [-450, -330], 12),
  spot('owlery', 'The Owlery', [-30, -261], 4, 'owlery'),
  spot('owlery-path', 'The Owlery path', [-40, -128], 6),
  spot('glen', 'The glen', [384, -354], 30),
  spot('road', 'The road to Hogsmeade', [448, -400], 10),
  spot('station', 'Hogsmeade station', [546, -470], 16),
  // Hogsmeade
  spot('village-foot', 'The foot of the High Street', frameAt(-VILLAGE.half, 0), 6),
  spot('high-street', 'The High Street', VILLAGE.at, 20),
  spot('village-head', 'The head of the High Street', frameAt(VILLAGE.half - 10, 0), 6),
  spot('honeydukes', 'Honeydukes', door('honeydukes'), 5, 'honeydukes'),
  spot('broomsticks', 'The Three Broomsticks', door('broomsticks'), 6, 'broomsticks'),
  spot('hogshead', 'The Hog’s Head', door('hogshead'), 4, 'hogshead'),
  spot('post', 'The post office', door('post'), 3),
  spot('shack-fence', 'The Shrieking Shack’s fence', frameAt(-30, -46), 6),
  spot('shack', 'The Shrieking Shack', SHACK.at, 6, 'shack'),
];

const RIDE = { ride: true };

export const EDGES = [
  // the ground floor
  ['great-doors', 'entrance'],
  ['entrance', 'hall'],
  ['hall', 'high-table'],
  ['hall', 'table-gryffindor'],
  ['hall', 'table-hufflepuff'],
  ['hall', 'table-ravenclaw'],
  ['hall', 'table-slytherin'],
  ['entrance', 'filch-office'],
  ['entrance', 'staircase'],
  ['entrance', 'below'],
  ['entrance', 'terrace'],
  ['staircase', 'witch'],
  ['staircase', 'fat-lady'],
  ['fat-lady', 'gryffindor'],
  ['staircase', 'courtyard-door'],
  ['courtyard-door', 'courtyard'],
  ['staircase', 'staffroom'],
  // the west wing
  ['staircase', 'corridor-west'],
  ['corridor-west', 'charms'],
  ['corridor-west', 'ravenclaw'],
  ['corridor-west', 'bridge-in'],
  ['bridge-in', 'bridge-gate'],
  // the north
  ['staffroom', 'corridor-north'],
  ['corridor-north', 'library'],
  ['library', 'restricted'],
  ['corridor-north', 'hospital'],
  ['corridor-north', 'defence'],
  ['corridor-north', 'requirement'],
  ['defence', 'astronomy'],
  ['corridor-north', 'headmaster'],
  // below stairs
  ['below', 'kitchens'],
  ['kitchens', 'hufflepuff'],
  ['below', 'dungeons'],
  ['dungeons', 'potions'],
  ['potions', 'slytherin'],
  // out of the castle
  ['great-doors', 'courtyard'],
  ['courtyard', 'viaduct-gate'],
  ['viaduct-gate', 'owlery-path'],
  ['owlery-path', 'owlery'],
  ['terrace', 'boathouse'],
  ['bridge-gate', 'covered-bridge'],
  ['covered-bridge', 'stone-circle'],
  // the grounds
  ['great-doors', 'lawn'],
  ['great-doors', 'greenhouse-door'],
  ['greenhouse-door', 'greenhouses'],
  ['lawn', 'greenhouse-door'],
  ['lawn', 'pitch'],
  ['pitch', 'changing-rooms'],
  ['stone-circle', 'willow'],
  ['owlery-path', 'willow'],
  ['stone-circle', 'hut'],
  ['willow', 'hut'],
  ['hut', 'pumpkins'],
  ['hut', 'paddock'],
  ['paddock', 'forest-edge'],
  ['forest-edge', 'clearing'],
  // the carriages’ road, over the viaduct and down the glen
  ['viaduct-gate', 'viaduct', RIDE],
  ['viaduct', 'viaduct-end', RIDE],
  ['viaduct-end', 'glen', RIDE],
  ['glen', 'road', RIDE],
  ['road', 'station', RIDE],
  ['station', 'village-foot', RIDE],
  // Hogsmeade
  ['village-foot', 'high-street'],
  ['high-street', 'village-head'],
  ['high-street', 'honeydukes'],
  ['high-street', 'broomsticks'],
  ['high-street', 'post'],
  ['village-head', 'hogshead'],
  ['village-foot', 'shack-fence'],
  ['shack-fence', 'shack'],
];

// A built room’s frame on the Map: the Great Hall’s floor (rooms/plan/
// greatHall.js) is laid with its doors, its +z, toward the Entrance Hall
// (east, +x) and the dais west. A room not listed is laid square to the
// Map with its own origin on its spot.
export const ROOM_FRAMES = {
  greatHall: { at: [-12, 11], yaw: Math.PI / 2 },
  // (the village’s set is built in the Map’s own frame, its street’s middle at the set’s origin)
  hogsmeade: { at: VILLAGE.at, yaw: 0 },
  // (the village’s insides: each its own frame with its front door toward +z, stood in its
  // building facing the street; the Shack on its hill; the passage from the Willow toward it)
  ...Object.fromEntries(['honeydukes', 'broomsticks', 'hogshead'].map((id) => [id, { at: buildingAt(id).at, yaw: buildingAt(id).faces }])),
  shack: { at: SHACK.at, yaw: Math.atan2(VILLAGE.at[0] - SHACK.at[0], VILLAGE.at[1] - SHACK.at[1]) },
};

const BY_ID = new Map(SPOTS.map((s) => [s.id, s]));
export const spotById = (id) => BY_ID.get(id) ?? null;

const NEAR = new Map(SPOTS.map((s) => [s.id, []]));
const RIDES = new Set();
for (const [a, b, o] of EDGES) {
  const d = Math.hypot(BY_ID.get(a).at[0] - BY_ID.get(b).at[0], BY_ID.get(a).at[1] - BY_ID.get(b).at[1]);
  NEAR.get(a).push([b, d]);
  NEAR.get(b).push([a, d]);
  if (o?.ride) RIDES.add(`${a}|${b}`).add(`${b}|${a}`);
}
export const rideBetween = (a, b) => RIDES.has(`${a}|${b}`);

// the shortest ways from one spot to every other (Dijkstra; the graph is
// small, so each source is worked out once and kept)
const FROM = new Map();
function treeFrom(src) {
  let tree = FROM.get(src);
  if (tree) return tree;
  const dist = new Map([[src, 0]]);
  const prev = new Map();
  const open = new Set([src]);
  while (open.size) {
    let u = null;
    for (const v of open) if (u === null || dist.get(v) < dist.get(u)) u = v;
    open.delete(u);
    for (const [v, w] of NEAR.get(u)) {
      const d = dist.get(u) + w;
      if (d < (dist.get(v) ?? Infinity)) {
        dist.set(v, d);
        prev.set(v, u);
        open.add(v);
      }
    }
  }
  tree = { dist, prev };
  FROM.set(src, tree);
  return tree;
}

export function route(from, to) {
  if (!BY_ID.has(from) || !BY_ID.has(to)) return null;
  if (from === to) return [from];
  const { prev } = treeFrom(from);
  if (!prev.has(to)) return null;
  const out = [to];
  let at = to;
  while (at !== from) {
    at = prev.get(at);
    out.push(at);
  }
  return out.reverse();
}

// A walk along spots, from a point if it starts between them (`from`, on
// the way from the spot `fromId`): its corners, how far along each is, and
// which stretches are ridden. `to`: the last corner in place of the last
// spot’s middle (a figure’s own place in a room, not everyone’s one point).
export function pathOf(ids, from = null, fromId = null, to = null) {
  const points = [];
  const names = [];
  if (from) {
    points.push(from);
    names.push(fromId);
  }
  for (let i = 0; i < ids.length; i++) {
    const p = i === ids.length - 1 && to ? to : BY_ID.get(ids[i]).at;
    const last = points[points.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) {
      points.push(p);
      names.push(ids[i]);
    } else names[names.length - 1] = ids[i];
  }
  const lengths = [0];
  const rides = [false];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
    rides.push(rideBetween(names[i - 1], names[i]));
  }
  return { points, names, lengths, length: lengths[lengths.length - 1], rides };
}

const ROOM_SPOT = new Map();
for (const s of SPOTS) if (s.inside && s.inside !== 'castle' && !ROOM_SPOT.has(s.inside)) ROOM_SPOT.set(s.inside, s);
export const spotOfRoom = (room) => ROOM_SPOT.get(room) ?? null;

// the Map’s frame into a room’s and back (a room with no frame of its own
// sits square on its first spot)
const frameOf = (room) => ROOM_FRAMES[room] ?? { at: spotOfRoom(room)?.at ?? [0, 0], yaw: 0 };
export function toRoom(room, [x, z]) {
  const f = frameOf(room);
  const dx = x - f.at[0];
  const dz = z - f.at[1];
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [c * dx - s * dz, s * dx + c * dz];
}
export const frameYaw = (room) => frameOf(room).yaw;
export function fromRoom(room, [x, z]) {
  const f = frameOf(room);
  const c = Math.cos(f.yaw);
  const s = Math.sin(f.yaw);
  return [f.at[0] + c * x + s * z, f.at[1] - s * x + c * z];
}

// What a walk between two spots is in at k (0…1) of the way: a corridor
// between two rooms is the castle’s; a way out through a door is the
// inside’s until the last two metres, where the walker steps out and can be
// drawn on the grounds
export function indoorAt(a, b, k) {
  const A = BY_ID.get(a);
  const B = BY_ID.get(b);
  if (!A || !B) return null;
  if (A.inside === B.inside) return A.inside;
  if (!A.inside || !B.inside) {
    const len = Math.hypot(A.at[0] - B.at[0], A.at[1] - B.at[1]) || 1;
    if (A.inside) return k < 1 - 2 / len ? A.inside : null;
    return k > 2 / len ? B.inside : null;
  }
  // between two insides: the room at either end for the first and last stretch, the castle’s corridor between
  if (k < 0.2) return A.inside;
  if (k > 0.8) return B.inside;
  return 'castle';
}
