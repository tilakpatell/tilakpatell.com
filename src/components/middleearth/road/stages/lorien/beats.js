// Lothlórien’s beats (the design’s §4.3, row 9; the plan’s Stage table):
// the Nimrodel’s stream, Haldir out of the trees, the climb round a
// mallorn to the flets, Galadriel and Celeborn on the dais, the Mirror (the
// basin darkening, the Eye in it, her light), and the boats at the hythe.
// `at` in metres into the stage, `hold` in seconds; a `params` height is
// over the ground (`above`), the stage’s scene reads the rest. Pure.

export { entered, left } from '../../beats';

export const BEATS = [
  // the stream under the first mallorns, gold leaves on the water
  { id: 'nimrodel', kind: 'nimrodel', at: 10, hold: 0, rig: 'side', reach: 14 },
  // Haldir out of the trees, bow in hand
  { id: 'haldir', kind: 'haldir', at: 28, hold: 6, rig: 'seat', reach: 10, params: { at: [4, 1.7, 24], lookAt: [-1.5, 1.6, 33], above: true }, lines: ['lorien-haldir'] },
  // up the stair round the great tree
  { id: 'climb', kind: 'climb', at: 46, hold: 0, rig: 'follow', reach: 28 },
  // the dais at the tree’s crown: the Lady and the Lord
  { id: 'dais', kind: 'dais', at: 80, hold: 8, rig: 'seat', reach: 10, params: { at: [3.2, 1.8, 76], lookAt: [-1, 1.8, 87], above: true }, lines: ['lorien-galadriel'] },
  // the Mirror: the basin goes dark, the Eye looks out, then her light
  { id: 'mirror', kind: 'mirror', at: 100, hold: 14, rig: 'seat', cut: 0, reach: 10, params: { at: [-2.6, 1.6, 98], lookAt: [1.2, 0.8, 104], above: true }, clip: 'taskAppointed', fx: [{ kind: 'vision', at: 3, seconds: 6 }] },
  // the hythe and the swan-boat; away down the Silverlode
  { id: 'boats', kind: 'boats', at: 128, hold: 6, rig: 'lead', reach: 16 },
];
