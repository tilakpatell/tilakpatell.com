// How much of the map behind the page a chapter's town hides, and so how
// often the WebGL map need be drawn while its camera moves under it
// (./MapBackdrop3D.js). A town's stage spans the page's width and most of
// the screen, so what shows of the map round it is a strip or two, blurred
// and veiled (styles/lazy/middleearth.css).
//
// The map is still drawn whole each time, only less often: a frame drawn in
// part would leave the rest of the canvas blank, and a page scrolled while
// the town is busy loading shows the rows that were under it before another
// frame can be drawn.

// a town that hides this much of the screen or more...
const MOSTLY = 3 / 4;
// ...has the map drawn behind it at most this often, in ms (a film's rate)
export const COVERED_MS = 1000 / 24;

// hiddenOf(height, covers) → the share of the screen's rows (0..1) under the
// [top, bottom] spans in `covers`, in CSS px from the top of the screen
export function hiddenOf(height, covers) {
  const spans = covers
    .map(([a, b]) => [Math.max(0, a), Math.min(height, b)])
    .filter(([a, b]) => b > a)
    .sort((p, q) => p[0] - q[0]);
  let hidden = 0;
  let reach = 0;
  for (const [a, b] of spans) {
    // (spans that overlap are counted once)
    if (b <= reach) continue;
    hidden += b - Math.max(a, reach);
    reach = b;
  }
  return height > 0 ? hidden / height : 0;
}

// waitOf(height, covers) → how long, in ms, the map may wait between frames
// drawn (0: every frame)
export const waitOf = (height, covers) => (hiddenOf(height, covers) >= MOSTLY ? COVERED_MS : 0);
