// The beacons of Gondor along the White Mountains, lit one after another
// from Amon Dîn west towards Rohan, seen far off across the dark from the
// Morgul Vale. Pure: the scene lights as many fires as this says.
//
//   lit(t) → how many burn t seconds into the beat (0 before it, 7 at the last)

export const BEACONS = 7;
export const EVERY = 1.8; // s between one fire and the next

export function lit(t) {
  if (t == null || Number.isNaN(t) || t < 0) return 0;
  return Math.min(BEACONS, 1 + Math.floor(t / EVERY + 1e-9));
}
