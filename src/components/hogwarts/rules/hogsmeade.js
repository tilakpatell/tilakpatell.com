// Hogsmeade (the design’s §4.9): the only all-wizard village in Britain, at
// the head of the lake’s arm past the station, as data. One High Street of a
// dozen buildings, a side lane down to the Hog’s Head, and the Shrieking
// Shack on its hill behind a fence. Pure, so the village’s builder
// (world/hogsmeade.js), the Map, the walkers’ paths and the tests read one
// street.
//
//   VILLAGE: { at: [x, z] (the street’s middle, rules/places.js’s
//     hogsmeade), axis: [ux, uz] (along the street, from the station’s end
//     to the far end), half (m either way from the middle), width (m between
//     the fronts) }
//   BUILDINGS: [{ id, name, sign, line, side (1 the right as you walk up
//     from the station, −1 the left), along (m from the middle), w, d, h,
//     lean, chimney, tone, room? }]: `sign` is what’s painted over the door,
//     `line` what the door says when you try it (a front with no inside);
//     `room` the inside it opens onto, for the three that have one
//   SHACK: { at, hill, fence }: the Shack on its hill, and its fence’s line
//   frameAt(along, across) → [x, z]: a point on the street’s frame
//   buildingAt(id) → { …the building, at: [x, z] (its middle), door: [x, z],
//     faces (the way out of its door, yaw from +z) }
//   doors() → every building’s door, for the prompts and the Map
//   snowAt(week, lawn) → 0…1 the snow lying in the village: the lawn’s from
//     the weather, and from the eighth week whatever the lawn is doing (the
//     films’ Hogsmeade is always under snow)

export const VILLAGE = {
  at: [665, -625],
  // (from the station toward the hills: the way the road comes in)
  axis: norm([119, -155]),
  half: 66,
  width: 13,
};

export const SNOW_FROM = 8;

// The street, from the station’s end up: on the right Honeydukes and the
// post office, on the left the Three Broomsticks across from them, the rest
// along both sides; the Hog’s Head down its own lane off the far end. Sizes
// in metres at house scale, a little crooked (lean: radians the roof leans).
export const BUILDINGS = [
  { id: 'founders', name: 'Hengist’s cottage', sign: 'Hengist of Woodcroft lived here', line: 'A plaque by the door. The first house in the village, built by a wizard who wanted to be left alone and got a village instead.', side: -1, along: -54, w: 8, d: 7, h: 5.5, lean: 0.05, chimney: 1, tone: 'old' },
  { id: 'post', name: 'The post office', sign: 'Hogsmeade Post Office', line: 'Two hundred owls inside, sorted by speed. The slow ones take the parcels.', side: 1, along: -44, w: 10, d: 9, h: 7, lean: 0.03, chimney: 1, tone: 'grey' },
  { id: 'honeydukes', name: 'Honeydukes', sign: 'Honeydukes', line: 'The smell of toffee comes out to meet you.', side: 1, along: -26, w: 14, d: 12, h: 9, lean: 0.02, chimney: 2, tone: 'pink', room: 'honeydukes' },
  { id: 'broomsticks', name: 'The Three Broomsticks', sign: 'The Three Broomsticks', line: 'Warm inside, and loud.', side: -1, along: -22, w: 16, d: 13, h: 9.5, lean: 0.04, chimney: 2, tone: 'warm', room: 'broomsticks' },
  { id: 'scrivenshaft', name: 'Scrivenshaft’s', sign: 'Scrivenshaft’s Quill Shop', line: 'Every quill in the window is writing its own price, and none of them agree.', side: 1, along: -8, w: 8, d: 9, h: 7.5, lean: 0.07, chimney: 1, tone: 'blue' },
  { id: 'gladrags', name: 'Gladrags Wizardwear', sign: 'Gladrags Wizardwear', line: 'A hat in the window is trying itself on a mannequin.', side: -1, along: -4, w: 10, d: 10, h: 8, lean: 0.04, chimney: 1, tone: 'green' },
  { id: 'zonkos', name: 'Zonko’s', sign: 'Zonko’s Joke Shop', line: 'Closed for stocktaking. Something behind the door is laughing at the stock.', side: 1, along: 8, w: 10, d: 10, h: 8, lean: 0.1, chimney: 1, tone: 'orange' },
  { id: 'dervish', name: 'Dervish and Banges', sign: 'Dervish and Banges', line: 'Instruments that tick, whirr and puff, mended and sold. Something in the back went bang a moment ago.', side: -1, along: 12, w: 11, d: 10, h: 8, lean: 0.06, chimney: 2, tone: 'grey' },
  { id: 'tomes', name: 'Tomes and Scrolls', sign: 'Tomes and Scrolls', line: 'The books in the window are asleep. Best not wake them.', side: 1, along: 24, w: 9, d: 9, h: 7.5, lean: 0.05, chimney: 1, tone: 'old' },
  { id: 'puddifoot', name: 'Madam Puddifoot’s', sign: 'Madam Puddifoot’s', line: 'Tea, lace and a great many cherubs. Couples only, by the look of it.', side: -1, along: 28, w: 8, d: 8, h: 7, lean: 0.04, chimney: 1, tone: 'pink' },
  { id: 'spintwitches', name: 'Spintwitches', sign: 'Spintwitches Sporting Needs', line: 'A Snitch in a glass case in the window, flying laps of it.', side: 1, along: 40, w: 10, d: 9, h: 7.5, lean: 0.03, chimney: 1, tone: 'warm' },
  { id: 'hogshead', name: 'The Hog’s Head', sign: 'The Hog’s Head', line: 'A goat looks at you from the step and goes back in.', side: -1, along: 52, w: 10, d: 10, h: 7, lean: 0.12, chimney: 1, tone: 'dark', room: 'hogshead', lane: 22 },
];

// the Shack on its hill above the village’s near end, a fence along the
// hill’s foot that nobody climbs
export const SHACK = { at: frameAt(-30, -78), hill: 9, r: 24, fence: [frameAt(-58, -46), frameAt(-2, -50)] };

function norm([x, z]) {
  const l = Math.hypot(x, z) || 1;
  return [x / l, z / l];
}

// the street’s frame: `along` the axis from the middle, `across` to the right as you walk up
export function frameAt(along, across) {
  const [ux, uz] = VILLAGE.axis;
  // (the right of a walker facing +axis, in a frame with +x east and +z south)
  const rx = -uz;
  const rz = ux;
  return [VILLAGE.at[0] + ux * along + rx * across, VILLAGE.at[1] + uz * along + rz * across];
}

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

export function buildingAt(id) {
  const b = BY_ID.get(id);
  if (!b) return null;
  // its front on the street’s edge, its middle back from it; the Hog’s Head down its lane
  const front = VILLAGE.width / 2 + (b.lane ?? 0);
  const across = b.side * (front + b.d / 2);
  const at = frameAt(b.along, across);
  const door = frameAt(b.along, b.side * front);
  // the way out of the door: toward the street
  const [ux, uz] = VILLAGE.axis;
  const out = [uz * b.side, -ux * b.side];
  return { ...b, at, door, faces: Math.atan2(out[0], out[1]) };
}

export const doors = () => BUILDINGS.map((b) => {
  const s = buildingAt(b.id);
  return { id: b.id, name: b.name, at: s.door, faces: s.faces, room: b.room ?? null, line: b.line };
});

export function snowAt(week, lawn = 0) {
  const own = week >= SNOW_FROM ? 0.85 : 0;
  return Math.max(own, Math.min(1, lawn));
}
