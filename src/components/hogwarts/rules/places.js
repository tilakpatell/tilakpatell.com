// Every place on the grounds with a name: where it is, what kind of place,
// how near counts as being there, and the door it has if it has one. The
// Marauder’s Map writes these names, the prompts say them (“E Go in · The
// Owlery”), the quests send you to them, and the world builds its
// landmarks where they say. Pure data and a few reads; the terrain
// (world/terrain.js) and the castle’s plan (world/castle/plan.js) take
// their anchors from here, so a place and its building never drift apart.
//
// The frame: metres, +x east, +z south, y up, the Black Lake’s water at
// y = 0. The ground is GROUND metres across, centred on the origin; the
// castle stands on its crag a little north of the middle with the lake to
// the south and west, the lawns falling east to the pitch, the forest west
// and north, the glen and the station north-east up the lake’s arm, and the
// moor behind. Hogsmeade, at the arm’s head, is Lane F’s ground.
//
//   PLACES: [{ id, name, kind, at: [x, z], r, y?, door?, room?, faces? }]
//     kind: 'castle' | 'door' | 'grounds' | 'lake' | 'forest' | 'wild' | 'village'
//     r: metres from `at` that count as being there
//     y: the height a place stands at where it isn’t the ground’s (the castle’s floor)
//     door: the door’s prompt (“The Great Hall”), for a place that is one
//     room: the room it opens onto (rooms/index.js), where it opens onto one
//     faces: the way out of the door, radians (yaw from +z), for the camera and the prompt
//   GROUND, HALF, CASTLE_FLOOR
//   placeById(id) → the place, or null
//   placesOf(kind) → every place of that kind
//   nearest(x, z, { kind, within }) → the nearest place (whose r it is inside, or within `within`), or null
//   placeAt(x, z) → the smallest place whose r you stand in, or null (what the Map says you are in)

export const GROUND = 1400; // m across
export const HALF = GROUND / 2;
export const CASTLE_FLOOR = 44; // m over the lake: the crag’s top, the castle’s ground floor

const E = Math.PI / 2; // (a door facing east opens toward +x)
const N = Math.PI;
const S = 0;

export const PLACES = [
  // the castle and its doors: where the hero castle has them (world/castle/hero.js’s
  // ANCHORS in the world’s frame; hero.test.js holds these to them)
  { id: 'castle', name: 'Hogwarts Castle', kind: 'castle', at: [31, -102], r: 150, y: CASTLE_FLOOR },
  { id: 'great-doors', name: 'The great doors', kind: 'door', at: [-54.6, -81.4], r: 6, y: CASTLE_FLOOR, door: 'The Great Hall', room: 'greatHall', faces: S },
  { id: 'great-hall', name: 'The Great Hall', kind: 'castle', at: [-88.7, -108.3], r: 30, y: CASTLE_FLOOR },
  { id: 'staircase', name: 'The Grand Staircase', kind: 'castle', at: [30.5, -115.4], r: 14, y: CASTLE_FLOOR },
  { id: 'courtyard', name: 'The courtyard', kind: 'castle', at: [49.3, -106.5], r: 18, y: CASTLE_FLOOR },
  { id: 'courtyard-door', name: 'The courtyard door', kind: 'door', at: [42.2, -102], r: 5, y: CASTLE_FLOOR, door: 'The Grand Staircase', room: 'staircase', faces: E },
  { id: 'clock-tower', name: 'The clock tower', kind: 'castle', at: [78, -70.6], r: 10, y: CASTLE_FLOOR },
  { id: 'astronomy-tower', name: 'The Astronomy Tower', kind: 'castle', at: [-54.6, -98.4], r: 10, y: CASTLE_FLOOR },
  { id: 'viaduct', name: 'The viaduct', kind: 'castle', at: [-12, -35], r: 30 },
  { id: 'viaduct-gate', name: 'The viaduct gate', kind: 'door', at: [-43, -67.1], r: 5, y: CASTLE_FLOOR, door: 'The viaduct', faces: S + E / 2 },
  { id: 'covered-bridge', name: 'The covered bridge', kind: 'castle', at: [-36.7, -234], r: 30 },
  { id: 'bridge-gate', name: 'The bridge’s gate', kind: 'door', at: [-36.7, -205.1], r: 5, y: CASTLE_FLOOR, door: 'The covered bridge', faces: N },
  { id: 'boathouse', name: 'The boathouse', kind: 'door', at: [-60, 29.7], r: 8, y: 1.2, door: 'The boathouse', room: 'boathouse', faces: N },
  { id: 'boathouse-stair', name: 'The boathouse steps', kind: 'castle', at: [-63, -15], r: 14 },
  { id: 'owlery', name: 'The Owlery', kind: 'door', at: [26.9, -264], r: 6, y: 85, door: 'The Owlery', room: 'owlery', faces: S },
  // the grounds
  { id: 'lawn', name: 'The lawn', kind: 'grounds', at: [165, -30], r: 70 },
  { id: 'greenhouses', name: 'The greenhouses', kind: 'grounds', at: [150, 42], r: 30 },
  { id: 'greenhouse-door', name: 'Greenhouse three', kind: 'door', at: [150, 27], r: 5, door: 'Greenhouse three', faces: N },
  { id: 'willow', name: 'The Whomping Willow', kind: 'grounds', at: [-135, -170], r: 16 },
  { id: 'hut', name: 'Hagrid’s hut', kind: 'door', at: [-250, -230], r: 8, door: 'Hagrid’s hut', room: 'hut', faces: E },
  { id: 'pumpkins', name: 'The pumpkin patch', kind: 'grounds', at: [-230, -250], r: 12 },
  { id: 'paddock', name: 'The paddock', kind: 'grounds', at: [-284, -248], r: 18 },
  { id: 'pitch', name: 'The Quidditch pitch', kind: 'grounds', at: [300, -50], r: 95 },
  { id: 'changing-rooms', name: 'The changing rooms', kind: 'grounds', at: [300, 40], r: 10 },
  // (at the wooden bridge’s far end, on its knoll, as the films have it)
  { id: 'stone-circle', name: 'The stone circle', kind: 'grounds', at: [-40, -282], r: 18 },
  // the lake
  { id: 'lake', name: 'The Black Lake', kind: 'lake', at: [-60, 250], r: 260 },
  { id: 'shore', name: 'The south shore', kind: 'lake', at: [30, 445], r: 40 },
  { id: 'end-rock', name: 'The end rock', kind: 'lake', at: [-150, 150], r: 8 },
  // the forest and the wild
  { id: 'forest-edge', name: 'The forest’s edge', kind: 'forest', at: [-330, -270], r: 30 },
  { id: 'forest', name: 'The Forbidden Forest', kind: 'forest', at: [-480, -360], r: 220 },
  { id: 'clearing', name: 'The clearing', kind: 'forest', at: [-450, -330], r: 18 },
  { id: 'glen', name: 'The glen', kind: 'wild', at: [380, -350], r: 90 },
  { id: 'moor', name: 'The moor', kind: 'wild', at: [200, -590], r: 150 },
  { id: 'station', name: 'Hogsmeade station', kind: 'village', at: [546, -470], r: 30 },
  { id: 'road', name: 'The road to Hogsmeade', kind: 'wild', at: [440, -390], r: 40 },
  { id: 'hogsmeade', name: 'Hogsmeade', kind: 'village', at: [665, -625], r: 60 },
];

const BY_ID = new Map(PLACES.map((p) => [p.id, p]));

export const placeById = (id) => BY_ID.get(id) ?? null;
export const placesOf = (kind) => PLACES.filter((p) => p.kind === kind);

export function nearest(x, z, { kind = null, within = Infinity } = {}) {
  let best = null;
  let bestD = Infinity;
  for (const p of PLACES) {
    if (kind && p.kind !== kind) continue;
    const d = Math.hypot(x - p.at[0], z - p.at[1]);
    if (d > Math.max(within === Infinity ? p.r : within, 0)) continue;
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

export function placeAt(x, z) {
  let best = null;
  for (const p of PLACES) {
    if (Math.hypot(x - p.at[0], z - p.at[1]) > p.r) continue;
    if (!best || p.r < best.r) best = p;
  }
  return best;
}
