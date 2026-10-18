// The hub’s whole-map framing, worked out from where the road’s stops stand
// rather than set by hand: the camera looks at the middle of the stops’
// bounds (40 sheet units of margin round them), leant as the hand-set
// framing leant, from as far off as frames them. ./MapBackdrop3D.js frames
// the hub with it; ./mapFlight.js ends there.
import { STOPS } from './road';

const MARGIN = 40;
// The hand-set framing (zoom 3.05) held the hand-drawn stops’ bounds, 554
// units across with the margin, so a unit of span is 3.05 / 554 of zoom.
// A screen is about 1.6 times as wide as it is tall, so the bounds’ height
// counts 1.6 times over against their width.
const ZOOM_PER_UNIT = 3.05 / 554;
const ASPECT = 1.6;
// The page’s title stands over the sheet’s top right and its chips along
// the foot, so the frame looks a little south-east of the bounds’ middle and
// Mordor clears the chips: the hand-set framing, [452, 322], leant so from
// the hand-drawn stops’ middle, [423, 304].
export const LEAN = [29, 18];

export function framing(stops = STOPS) {
  const xs = stops.map((s) => s.x);
  const ys = stops.map((s) => s.y);
  const [x0, x1, y0, y1] = [Math.min(...xs) - MARGIN, Math.max(...xs) + MARGIN, Math.min(...ys) - MARGIN, Math.max(...ys) + MARGIN];
  const span = Math.max(x1 - x0, (y1 - y0) * ASPECT);
  return { at: [(x0 + x1) / 2 + LEAN[0], (y0 + y1) / 2 + LEAN[1]], zoom: Math.round(span * ZOOM_PER_UNIT * 100) / 100 };
}
