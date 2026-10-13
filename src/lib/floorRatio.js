// The drawing buffer at the floor (the every-chip-plays addendum): at Low the
// Star Wars worlds draw at most 1,280 × 720, stretched to the screen, the most
// compressed the web build goes; the HUD is the DOM's and stays sharp. Every
// other level keeps the ratio it asked for. Pure.
//
//   floorRatio(ratio, { w, h, detail }) → the ratio to draw at

export const FLOOR_PIXELS = 1280 * 720;

export function floorRatio(ratio, { w = 0, h = 0, detail = null } = {}) {
  if (detail !== 'low' || !(w > 0 && h > 0)) return ratio;
  return Math.min(ratio, Math.sqrt(FLOOR_PIXELS / (w * h)));
}
