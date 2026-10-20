// Gorgoroth’s beats (the design’s §4.3, row 14; the plan’s Stage table):
// the plain of ash under a red-black sky, the orc column on the road and
// its whip, the Eye’s beam passing over the two under their cloaks, the
// wind from the west turning the clouds, Sam carrying Frodo up the
// Mountain, the Cracks of Doom, the eruption with Barad-dûr falling, and
// the Eagles. `at` in metres into the stage, `hold` in seconds; a `params`
// height is over the ground (`above`), the stage’s scene reads the rest.
// Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the plain under the pall, the Tower on the horizon, the Mountain ahead
  { id: 'plain', kind: 'plain', at: 8, hold: 0, rig: 'wide', reach: 16, params: { at: [-6, 3, 2], lookAt: [10, 20, 90], above: true } },
  // the orc column on the road, the whip; the two pressed among it
  { id: 'column', kind: 'column', at: 30, hold: 8, rig: 'side', reach: 14 },
  // the Eye’s beam across the plain; the two under their cloaks
  { id: 'beam', kind: 'beam', at: 52, hold: 10, rig: 'wide', cut: 0, reach: 14, params: { at: [-5, 1.4, 46], lookAt: [6, 3, 58], above: true } },
  // the wind from the west: the sky brightening behind
  { id: 'wind', kind: 'wind', at: 74, hold: 0, rig: 'follow', reach: 14 },
  // Frodo can go no further: Sam carries him up the slope
  { id: 'carry', kind: 'carry', at: 100, hold: 6, rig: 'ride', reach: 14, params: { offset: [0.7, 1.5, -1.4] }, clip: 'carryYou' },
  // the Cracks of Doom: the ledge, the Ring on, Gollum, the finger, over
  { id: 'cracks', kind: 'cracks', at: 126, hold: 20, rig: 'seat', cut: 0, reach: 12, params: { at: [-3, 1.6, 120], lookAt: [1, 1.2, 130], above: true }, clip: 'myPrecious', fx: [{ kind: 'vision', at: 4, seconds: 6 }] },
  // the Mountain breaks, Barad-dûr falls, the Eye goes out
  { id: 'eruption', kind: 'eruption', at: 146, hold: 8, rig: 'wide', reach: 14, params: { at: [-10, 3, 138], lookAt: [20, 30, 110], above: true }, clip: 'oneRing', fx: [{ kind: 'shake', at: 0.5, seconds: 4 }] },
  // the Eagles: up and away west over the ruin
  { id: 'eagles', kind: 'eagles', at: 166, hold: 0, rig: 'ride', reach: 14, params: { offset: [0, 2.2, -5] } },
];
