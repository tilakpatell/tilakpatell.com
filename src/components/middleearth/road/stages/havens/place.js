// Where things stand at the Grey Havens, in the stage's frame (the lane
// along +z, x = 0): the beach running down into the Gulf of Lune, the long
// grey quay out over the water, the white ship moored at its end, and the
// ship's way out once it sails, carrying those aboard. Pure.
//
//   WATER: the sea's level
//   QUAY: { x, from, z: [z0, z1], top }: the quay, the ramp up onto it from `from`
//   SAIL: m into the stage the ship casts off; SHIP: { moor: [x, z], length, beam, deck }
//   shipAt(local) → { x, z, k }: the ship's middle (k: 0 moored … 1 out on the lane)
//   floorAt(x, z, local) → what carries a walker there: the quay's top, the
//     ship's deck while it sails under them, else null (the land's)
//   DECK: { id: [x, z] } the places aboard, from the ship's middle
//   FAREWELL: { id: [x, z] } the four on the quay by the ship; STAYING: the three after
//   GANGWAY: { z, foot: [x, y], head: [x, y] }: the plank from the quay's edge up to her gunwale
//   boarding(k) → [x, y, z]: Frodo's way up into her, k 0 (on the quay) … 1 (at his place aboard)

export const WATER = -2;
export const QUAY = { x: 3, from: 34, z: [44, 172], top: 1.2 };
export const SAIL = 160;
export const SHIP = { moor: [6.4, SAIL + 4], length: 20, beam: 4.6, deck: WATER + 2.9 };
const OUT = 14; // m of the lane the ship takes to swing out from the quay onto it

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

export function shipAt(local) {
  const k = smooth((local - SAIL) / OUT);
  return { x: SHIP.moor[0] * (1 - k), z: Math.max(SHIP.moor[1], local + 4), k };
}

export function floorAt(x, z, local = 0) {
  if (local >= SAIL) {
    const s = shipAt(local);
    if (Math.abs(x - s.x) <= SHIP.beam / 2 && Math.abs(z - s.z) <= SHIP.length / 2) return SHIP.deck;
  }
  if (Math.abs(x) > QUAY.x || z < QUAY.from || z > QUAY.z[1]) return null;
  // (the ramp up from the beach: the land's own height under it is the caller's)
  if (z < QUAY.z[0]) return QUAY.top - ((QUAY.z[0] - z) / (QUAY.z[0] - QUAY.from)) * (QUAY.top - WATER);
  return QUAY.top;
}

// aboard: Frodo at the stern, looking back; the rest along the deck
export const DECK = { frodo: [0, -6.5], bilbo: [-0.9, -3.5], gandalfwhite: [1.1, -2], elrond: [-1.1, 0.5], galadriel: [1.1, 1.5] };
// the plank across, abreast of Frodo's place aboard: from the quay's edge
// up over her rail onto the gunwale (the hull's sheer there, props.js)
const ACROSS = SHIP.moor[1] + DECK.frodo[1];
export const GANGWAY = { z: ACROSS, foot: [QUAY.x - 0.1, QUAY.top], head: [SHIP.moor[0] - 1.65, SHIP.deck + 0.95] };
// the four on the quay by the gangway, Frodo turned to the three
export const FAREWELL = { frodo: [1.8, ACROSS], sam: [0.4, ACROSS - 1.9], merry: [-0.8, ACROSS - 2.9], pippin: [1.2, ACROSS - 3.3] };

// along the quay to the plank's foot, up it, down off the gunwale onto her
// deck and along to his place aboard: measured by length, so his pace holds
const WAY = [[FAREWELL.frodo[0], QUAY.top], GANGWAY.foot, GANGWAY.head, [SHIP.moor[0] - 1.1, SHIP.deck], [SHIP.moor[0] + DECK.frodo[0], SHIP.deck]];
const LEGS = WAY.slice(1).map((p, i) => Math.hypot(p[0] - WAY[i][0], p[1] - WAY[i][1]));
const WAY_LENGTH = LEGS.reduce((a, b) => a + b, 0);
export function boarding(k) {
  let d = Math.min(1, Math.max(0, k)) * WAY_LENGTH;
  for (let i = 0; i < LEGS.length; i++) {
    if (d <= LEGS[i] || i === LEGS.length - 1) {
      const f = LEGS[i] > 0 ? Math.min(1, d / LEGS[i]) : 1;
      const [a, b] = [WAY[i], WAY[i + 1]];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, ACROSS];
    }
    d -= LEGS[i];
  }
  return [WAY[WAY.length - 1][0], WAY[WAY.length - 1][1], ACROSS];
}
// the three at the quay's end, watching it go
export const STAYING = { sam: [0.4, QUAY.z[1] - 2], merry: [-0.8, QUAY.z[1] - 2.6], pippin: [1.5, QUAY.z[1] - 2.8] };
