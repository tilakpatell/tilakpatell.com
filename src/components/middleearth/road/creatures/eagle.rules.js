// The Eagles’ wings out of Mordor: a few deep beats, then a long glide,
// every BEAT seconds, as a great bird flies (Gwaihir does not flap like a
// sparrow). Pure: the scene turns each wing’s root by the angle.
//
//   flap(t, phase = 0) → the wings’ angle, radians (up +, down −)
//   phase: a share of a BEAT, so the three are not in step

export const BEAT = 4; // s: the beats and the glide, round again
export const FLAPS = 2.4; // s of it beating
export const LIFT = 0.6; // rad: the top and the bottom of a stroke
export const GLIDE = 0.12; // rad: the wings held a little up
const STROKES = 2; // beats in FLAPS

export function flap(t, phase = 0) {
  const c = (((t / BEAT + phase) % 1) + 1) % 1;
  const s = c * BEAT;
  if (s >= FLAPS) return GLIDE;
  // (each stroke a cosine from the glide’s angle and back to it, so it eases in and out)
  const k = s / FLAPS;
  const swing = Math.sin(k * Math.PI * 2 * STROKES);
  const fade = Math.sin(k * Math.PI);
  return GLIDE * (1 - fade) + LIFT * swing * fade;
}
