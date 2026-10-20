// Where things stand on Gorgoroth, in the stage's frame (the lane along +z,
// x = 0): Mount Doom, the Mount Doom chapter's own mountain, ahead and to
// the right, its western road turned toward the walkers, filling the sky as
// they come; the orc column on the road; the rock the two wait on; and,
// far under the plain (the cut takes the camera there), the Sammath Naur,
// its spur running out along the lane over the Crack of Doom. Pure.
//
//   MOUNT: { at, turn }: the mountain's foot-middle and its turn about y
//   CHAMBER: { at, turn }: the Sammath Naur's door (its spur runs +z from it)
//   SPUR: { y, door, tip }: the spur's top, and where along the lane it runs
//   CRACKS: { frodo, sam, gollum: [x, z], camera, look }: the Cracks' places
//   COLUMN: the orcs' road beside the lane (columns.js's rankAt)
//   REFUGE: [x, z]: the rock in the fire
//   sweep(t) → [x, z]: where the Eye's beam touches the plain, t s into its beat

export const MOUNT = { at: [70, -24, 620], turn: -Math.PI / 2 };
export const CHAMBER = { at: [0, -200, 122], turn: -Math.PI / 2 };
const TIP = 14; // m: the spur's length (the chapter's sammathNaur)
export const SPUR = { y: CHAMBER.at[1], door: CHAMBER.at[2], tip: CHAMBER.at[2] + TIP };

export const CRACKS = {
  frodo: [0, SPUR.tip - 1.2],
  sam: [0, SPUR.tip - 5.6],
  gollum: [0, SPUR.tip - 3.2],
  // (low on the spur behind Sam, along it to Frodo at its broken tip over the fire)
  camera: [-2.6, SPUR.y + 1.7, SPUR.door + 5.5],
  look: [0, SPUR.y + 1, SPUR.tip - 1.2],
};

export const COLUMN = { from: [3.6, -24], to: [3.6, 92], files: 2, gap: 1.9, spacing: 1.15, speed: 1.6 };
export const REFUGE = [3.2, 158];

const BEAM_AT = 52; // m: the beam's beat
const SWEEP = [-70, 70]; // m across the plain the beam's spot runs
const SECONDS = 10;
export function sweep(t) {
  const k = Math.min(1, Math.max(0, t / SECONDS));
  return [SWEEP[0] + (SWEEP[1] - SWEEP[0]) * k, BEAM_AT + 6 + 6 * Math.sin(k * Math.PI)];
}
